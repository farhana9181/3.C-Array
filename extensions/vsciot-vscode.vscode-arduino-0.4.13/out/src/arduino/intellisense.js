"use strict";
// Copyright (c) Elektronik Workshop. All rights reserved.
// Licensed under the MIT license.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalysisManager = exports.makeCompilerParserContext = exports.isCompilerParserEnabled = void 0;
const ccp = require("cocopa");
const os = require("os");
const path = require("path");
const constants = require("../common/constants");
const outputChannel_1 = require("../common/outputChannel");
const workspace_1 = require("../common/workspace");
const deviceContext_1 = require("../deviceContext");
const vscodeSettings_1 = require("./vscodeSettings");
/**
 * Returns true if the combination of global enable/disable and project
 * specific override enable the auto-generation of the IntelliSense
 * configuration.
 */
function isCompilerParserEnabled(dc) {
    if (!dc) {
        dc = deviceContext_1.DeviceContext.getInstance();
    }
    const globalDisable = vscodeSettings_1.VscodeSettings.getInstance().disableIntelliSenseAutoGen;
    const projectSetting = dc.intelliSenseGen;
    return projectSetting !== "disable" && !globalDisable ||
        projectSetting === "enable";
}
exports.isCompilerParserEnabled = isCompilerParserEnabled;
/**
 * Creates a context which is used for compiler command parsing
 * during building (verify, upload, ...).
 *
 * This context makes sure that it can be used in those sections
 * without having to check whether this feature is en- or disabled
 * and keeps the calling context more readable.
 *
 * @param dc The device context of the caller.
 *
 * Possible enhancements:
 *
 * * Order of includes: Perhaps insert the internal includes at the front
 *     as at least for the forcedIncludes IntelliSense seems to take the
 *     order into account.
 */
function makeCompilerParserContext(dc) {
    // TODO: callback for local setting: when IG gen is re-enabled file
    //   analysis trigger. Perhaps for global possible as well?
    if (!isCompilerParserEnabled(dc)) {
        return {
            callback: undefined,
            conclude: () => __awaiter(this, void 0, void 0, function* () {
                outputChannel_1.arduinoChannel.info("IntelliSense auto-configuration disabled.");
            }),
        };
    }
    const engines = makeCompilerParserEngines(dc);
    const runner = new ccp.Runner(engines);
    // Set up the callback to be called after parsing
    const _conclude = () => __awaiter(this, void 0, void 0, function* () {
        if (!runner.result) {
            outputChannel_1.arduinoChannel.warning("Failed to generate IntelliSense configuration.");
            return;
        }
        // Normalize compiler and include paths (resolve ".." and ".")
        runner.result.normalize();
        // Remove invalid paths
        yield runner.result.cleanup();
        // Search for Arduino.h in the include paths - we need it for a
        // forced include - users expect Arduino symbols to be available
        // in main sketch without having to include the header explicitly
        const ardHeader = yield runner.result.findFile("Arduino.h");
        const forcedIncludes = ardHeader.length > 0
            ? ardHeader
            : undefined;
        if (!forcedIncludes) {
            outputChannel_1.arduinoChannel.warning("Unable to locate \"Arduino.h\" within IntelliSense include paths.");
        }
        // The C++ standard is set to the following default value if no compiler flag has been found.
        const content = new ccp.CCppPropertiesContentResult(runner.result, constants.C_CPP_PROPERTIES_CONFIG_NAME, ccp.CCppPropertiesISMode.Gcc_X64, ccp.CCppPropertiesCStandard.C11, ccp.CCppPropertiesCppStandard.Cpp11, forcedIncludes);
        // The following 4 lines are added to prevent null.d from being created in the workspace
        // directory on MacOS and Linux. This is may be a bug in intelliSense
        const mmdIndex = runner.result.options.findIndex((element) => element === "-MMD");
        if (mmdIndex) {
            runner.result.options.splice(mmdIndex);
        }
        // Add USB Connected marco to defines
        runner.result.defines.push("USBCON");
        try {
            const cmd = os.platform() === "darwin" ? "Cmd" : "Ctrl";
            const help = `To manually rebuild your IntelliSense configuration run "${cmd}+Alt+I"`;
            const pPath = path.join(workspace_1.ArduinoWorkspace.rootPath, constants.CPP_CONFIG_FILE);
            const prop = new ccp.CCppProperties();
            prop.read(pPath);
            prop.merge(content, ccp.CCppPropertiesMergeMode.ReplaceSameNames);
            if (prop.write(pPath)) {
                outputChannel_1.arduinoChannel.info(`IntelliSense configuration updated. ${help}`);
            }
            else {
                outputChannel_1.arduinoChannel.info(`IntelliSense configuration already up to date. ${help}`);
            }
        }
        catch (e) {
            const estr = JSON.stringify(e);
            outputChannel_1.arduinoChannel.error(`Failed to read or write IntelliSense configuration: ${estr}`);
        }
    });
    return {
        callback: runner.callback(),
        conclude: _conclude,
    };
}
exports.makeCompilerParserContext = makeCompilerParserContext;
/**
 * Assembles compiler parser engines which then will be used to find the main
 * sketch's compile command and parse the infomation from it required for
 * assembling an IntelliSense configuration from it.
 *
 * It could return multiple engines for different compilers or - if necessary -
 * return specialized engines based on the current board architecture.
 *
 * @param dc Current device context used to generate the engines.
 */
function makeCompilerParserEngines(dc) {
    const sketch = path.basename(dc.sketch);
    const trigger = ccp.getTriggerForArduinoGcc(sketch);
    const gccParserEngine = new ccp.ParserGcc(trigger);
    return [gccParserEngine];
}
// Not sure why eslint fails to detect usage of these enums, so disable checking.
/**
 * Possible states of AnalysisManager's state machine.
 */
var AnalysisState;
(function (AnalysisState) {
    /**
     * No analysis request pending.
     */
    AnalysisState["Idle"] = "idle";
    /**
     * Analysis request pending. Waiting for the time out to expire or for
     * another build to complete.
     */
    AnalysisState["Waiting"] = "waiting";
    /**
     * Analysis in progress.
     */
    AnalysisState["Analyzing"] = "analyzing";
    /**
     * Analysis in progress with yet another analysis request pending.
     * As soon as the current analysis completes the manager will directly
     * enter the Waiting state.
     */
    AnalysisState["AnalyzingWaiting"] = "analyzing and waiting";
})(AnalysisState || (AnalysisState = {}));
/**
 * Events (edges) which cause state changes within AnalysisManager.
 */
var AnalysisEvent;
(function (AnalysisEvent) {
    /**
     * The only external event. Requests an analysis to be run.
     */
    AnalysisEvent[AnalysisEvent["AnalysisRequest"] = 0] = "AnalysisRequest";
    /**
     * The internal wait timeout expired.
     */
    AnalysisEvent[AnalysisEvent["WaitTimeout"] = 1] = "WaitTimeout";
    /**
     * The current analysis build finished.
     */
    AnalysisEvent[AnalysisEvent["AnalysisBuildDone"] = 2] = "AnalysisBuildDone";
})(AnalysisEvent || (AnalysisEvent = {}));
/**
 * This class manages analysis builds for the automatic IntelliSense
 * configuration synthesis. Its primary purposes are:
 *
 *  * delaying analysis requests caused by DeviceContext setting change
 *      events such that multiple subsequent requests don't cause
 *      multiple analysis builds
 *  * make sure that an analysis request is postponed when another build
 *      is currently in progress
 *
 * TODO: check time of c_cpp_properties.json and compare it with
 * * arduino.json
 * * main sketch file
 * This way we can perhaps optimize this further. But be aware
 * that settings events fire before their corresponding values
 * are actually written to arduino.json -> time of arduino.json
 * is outdated if no countermeasure is taken.
 */
class AnalysisManager {
    /**
     * Constructor.
     * @param isBuilding Provide a callback which returns true if another build
     * is currently in progress.
     * @param doBuild Provide a callback which runs the analysis build.
     * @param waitPeriodMs The delay the manger should wait for potential new
     * analysis request. This delay is used as polling interval as well when
     * checking for ongoing builds.
     */
    constructor(isBuilding, doBuild, waitPeriodMs = 1000) {
        /** The manager's state. */
        this._state = AnalysisState.Idle;
        this._isBuilding = isBuilding;
        this._doBuild = doBuild;
        this._waitPeriodMs = waitPeriodMs;
    }
    /**
     * File an analysis request.
     * The analysis will be delayed until no further requests are filed
     * within a wait period or until any build in progress has terminated.
     */
    requestAnalysis() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.update(AnalysisEvent.AnalysisRequest);
        });
    }
    /**
     * Update the manager's state machine.
     * @param event The event which will cause the state transition.
     *
     * Implementation note: asynchronous edge actions must be called after
     * setting the new state since they don't return immediately.
     */
    update(event) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (this._state) {
                case AnalysisState.Idle:
                    if (event === AnalysisEvent.AnalysisRequest) {
                        this._state = AnalysisState.Waiting;
                        this.startWaitTimeout();
                    }
                    break;
                case AnalysisState.Waiting:
                    if (event === AnalysisEvent.AnalysisRequest) {
                        // every new request restarts timer
                        this.startWaitTimeout();
                    }
                    else if (event === AnalysisEvent.WaitTimeout) {
                        if (this._isBuilding()) {
                            // another build in progress, continue waiting
                            this.startWaitTimeout();
                        }
                        else {
                            // no other build in progress -> launch analysis
                            this._state = AnalysisState.Analyzing;
                            yield this.startAnalysis();
                        }
                    }
                    break;
                case AnalysisState.Analyzing:
                    if (event === AnalysisEvent.AnalysisBuildDone) {
                        this._state = AnalysisState.Idle;
                    }
                    else if (event === AnalysisEvent.AnalysisRequest) {
                        this._state = AnalysisState.AnalyzingWaiting;
                    }
                    break;
                case AnalysisState.AnalyzingWaiting:
                    if (event === AnalysisEvent.AnalysisBuildDone) {
                        // emulate the transition from idle to waiting
                        // (we don't care if this adds an additional
                        // timeout - event driven analysis is not time-
                        // critical)
                        this._state = AnalysisState.Idle;
                        yield this.update(AnalysisEvent.AnalysisRequest);
                    }
                    break;
            }
        });
    }
    /**
     * Starts the wait timeout timer.
     * If it's already running, the current timer is stopped and restarted.
     * The timeout callback will then update the state machine.
     */
    startWaitTimeout() {
        if (this._timer) {
            clearTimeout(this._timer);
        }
        this._timer = setTimeout(() => {
            // reset timer variable first - calling update can cause
            // the timer to be restarted.
            this._timer = undefined;
            this.update(AnalysisEvent.WaitTimeout);
        }, this._waitPeriodMs);
    }
    /**
     * Starts the analysis build.
     * When done, the callback will update the state machine.
     */
    startAnalysis() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this._doBuild()
                .then(() => {
                this.update(AnalysisEvent.AnalysisBuildDone);
            })
                .catch((reason) => {
                this.update(AnalysisEvent.AnalysisBuildDone);
            });
        });
    }
}
exports.AnalysisManager = AnalysisManager;

//# sourceMappingURL=intellisense.js.map

// SIG // Begin signature block
// SIG // MIInzAYJKoZIhvcNAQcCoIInvTCCJ7kCAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // C8A+Ee1vQZ4hxSgmqNeSwZLxAI+9hX54PrcMgBp5TTag
// SIG // gg2BMIIF/zCCA+egAwIBAgITMwAAAsyOtZamvdHJTgAA
// SIG // AAACzDANBgkqhkiG9w0BAQsFADB+MQswCQYDVQQGEwJV
// SIG // UzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMH
// SIG // UmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBv
// SIG // cmF0aW9uMSgwJgYDVQQDEx9NaWNyb3NvZnQgQ29kZSBT
// SIG // aWduaW5nIFBDQSAyMDExMB4XDTIyMDUxMjIwNDYwMVoX
// SIG // DTIzMDUxMTIwNDYwMVowdDELMAkGA1UEBhMCVVMxEzAR
// SIG // BgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1v
// SIG // bmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlv
// SIG // bjEeMBwGA1UEAxMVTWljcm9zb2Z0IENvcnBvcmF0aW9u
// SIG // MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA
// SIG // ok2x7OvGwA7zbnfezc3HT9M4dJka+FaQ7+vCqG40Bcm1
// SIG // QLlYIiDX/Whts0LVijaOvtl9iMeuShnAV7mchItKAVAA
// SIG // BpyHuTuav2NCI9FsA8jFmlWndk3uK9RInNx1h1H4ojYx
// SIG // dBExyoN6muwwslKsLEfauUml7h5WAsDPpufTZd4yp2Jy
// SIG // iy384Zdd8CJlfQxfDe+gDZEciugWKHPSOoRxdjAk0GFm
// SIG // 0OH14MyoYM4+M3mm1oH7vmSQohS5KIL3NEVW9Mdw7csT
// SIG // G5f93uORLvrJ/8ehFcGyWVb7UGHJnRhdcgGIbfiZzZls
// SIG // AMS/DIBzM8RHKGNUNSbbLYmN/rt7pRjL4QIDAQABo4IB
// SIG // fjCCAXowHwYDVR0lBBgwFgYKKwYBBAGCN0wIAQYIKwYB
// SIG // BQUHAwMwHQYDVR0OBBYEFIi4R40ylsyKlSKfrDNqzhx9
// SIG // da30MFAGA1UdEQRJMEekRTBDMSkwJwYDVQQLEyBNaWNy
// SIG // b3NvZnQgT3BlcmF0aW9ucyBQdWVydG8gUmljbzEWMBQG
// SIG // A1UEBRMNMjMwMDEyKzQ3MDUyOTAfBgNVHSMEGDAWgBRI
// SIG // bmTlUAXTgqoXNzcitW2oynUClTBUBgNVHR8ETTBLMEmg
// SIG // R6BFhkNodHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20vcGtp
// SIG // b3BzL2NybC9NaWNDb2RTaWdQQ0EyMDExXzIwMTEtMDct
// SIG // MDguY3JsMGEGCCsGAQUFBwEBBFUwUzBRBggrBgEFBQcw
// SIG // AoZFaHR0cDovL3d3dy5taWNyb3NvZnQuY29tL3BraW9w
// SIG // cy9jZXJ0cy9NaWNDb2RTaWdQQ0EyMDExXzIwMTEtMDct
// SIG // MDguY3J0MAwGA1UdEwEB/wQCMAAwDQYJKoZIhvcNAQEL
// SIG // BQADggIBAHgPA7DgB0udzEyB2LvG216zuskLUQ+iX8jF
// SIG // nl2i7tzXPDw5xXNXn2KvxdzBsf2osDW3LCdjFOwSjVkz
// SIG // +SUFQQNhjSHkd5knF6pzrL9V6lz72XiEg1Vi2gUM3HiL
// SIG // XSMIKOgdd78ZZJEmDLwdA692MO/1vVOFpOSv0QzpyBr5
// SIG // iqiotwMMsZVdZqXn8u9vRSmlk+3nQXdyOPoZXTGPLHXw
// SIG // z41kbSc4zI12bONTlDsLR3HD2s44wuyp3c72R8f9FVi/
// SIG // J9DU/+NOL37Z1yonzGZEuKdrAd6CvupAnLMlrIEv93mB
// SIG // sNRXuDDp4p9UYYK1taxzzgyUxgFDpluMHN0Oiiq9s73u
// SIG // 7DA2XvbX8paJz8IZPe9a1/KhsOi5Kxhb99SCXiUnv2lG
// SIG // xnVAz5G6wAW1bzxJYKI+Xj90RKseY3X5EMO7TnVpIZ9I
// SIG // w1IdrkHp/QLY90ZCch7kdBlLCVTFhSXZCDv4BcM6DhpR
// SIG // zbJsb6QDVfOv9aoG9aGV3a1EacyaedzLA2gWP6cTnCdA
// SIG // r4OrlrN5EFoCpOWgc77F/eQc3SLR06VTLVT1uKuNVxL2
// SIG // xZlD9Z+qC+a3TXa0zI/x1zEZNSgpLGsdVcaN6r/td3Ar
// SIG // GQGkDWiAL7eS75LIWZA2SD//9B56uzZ1nmEd8+KBYsPT
// SIG // dp922/W2kFrlj7MBtA6vWE/ZG/grOKiCMIIHejCCBWKg
// SIG // AwIBAgIKYQ6Q0gAAAAAAAzANBgkqhkiG9w0BAQsFADCB
// SIG // iDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0
// SIG // b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1p
// SIG // Y3Jvc29mdCBDb3Jwb3JhdGlvbjEyMDAGA1UEAxMpTWlj
// SIG // cm9zb2Z0IFJvb3QgQ2VydGlmaWNhdGUgQXV0aG9yaXR5
// SIG // IDIwMTEwHhcNMTEwNzA4MjA1OTA5WhcNMjYwNzA4MjEw
// SIG // OTA5WjB+MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2Fz
// SIG // aGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UE
// SIG // ChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSgwJgYDVQQD
// SIG // Ex9NaWNyb3NvZnQgQ29kZSBTaWduaW5nIFBDQSAyMDEx
// SIG // MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA
// SIG // q/D6chAcLq3YbqqCEE00uvK2WCGfQhsqa+laUKq4Bjga
// SIG // BEm6f8MMHt03a8YS2AvwOMKZBrDIOdUBFDFC04kNeWSH
// SIG // fpRgJGyvnkmc6Whe0t+bU7IKLMOv2akrrnoJr9eWWcpg
// SIG // GgXpZnboMlImEi/nqwhQz7NEt13YxC4Ddato88tt8zpc
// SIG // oRb0RrrgOGSsbmQ1eKagYw8t00CT+OPeBw3VXHmlSSnn
// SIG // Db6gE3e+lD3v++MrWhAfTVYoonpy4BI6t0le2O3tQ5GD
// SIG // 2Xuye4Yb2T6xjF3oiU+EGvKhL1nkkDstrjNYxbc+/jLT
// SIG // swM9sbKvkjh+0p2ALPVOVpEhNSXDOW5kf1O6nA+tGSOE
// SIG // y/S6A4aN91/w0FK/jJSHvMAhdCVfGCi2zCcoOCWYOUo2
// SIG // z3yxkq4cI6epZuxhH2rhKEmdX4jiJV3TIUs+UsS1Vz8k
// SIG // A/DRelsv1SPjcF0PUUZ3s/gA4bysAoJf28AVs70b1FVL
// SIG // 5zmhD+kjSbwYuER8ReTBw3J64HLnJN+/RpnF78IcV9uD
// SIG // jexNSTCnq47f7Fufr/zdsGbiwZeBe+3W7UvnSSmnEyim
// SIG // p31ngOaKYnhfsi+E11ecXL93KCjx7W3DKI8sj0A3T8Hh
// SIG // hUSJxAlMxdSlQy90lfdu+HggWCwTXWCVmj5PM4TasIgX
// SIG // 3p5O9JawvEagbJjS4NaIjAsCAwEAAaOCAe0wggHpMBAG
// SIG // CSsGAQQBgjcVAQQDAgEAMB0GA1UdDgQWBBRIbmTlUAXT
// SIG // gqoXNzcitW2oynUClTAZBgkrBgEEAYI3FAIEDB4KAFMA
// SIG // dQBiAEMAQTALBgNVHQ8EBAMCAYYwDwYDVR0TAQH/BAUw
// SIG // AwEB/zAfBgNVHSMEGDAWgBRyLToCMZBDuRQFTuHqp8cx
// SIG // 0SOJNDBaBgNVHR8EUzBRME+gTaBLhklodHRwOi8vY3Js
// SIG // Lm1pY3Jvc29mdC5jb20vcGtpL2NybC9wcm9kdWN0cy9N
// SIG // aWNSb29DZXJBdXQyMDExXzIwMTFfMDNfMjIuY3JsMF4G
// SIG // CCsGAQUFBwEBBFIwUDBOBggrBgEFBQcwAoZCaHR0cDov
// SIG // L3d3dy5taWNyb3NvZnQuY29tL3BraS9jZXJ0cy9NaWNS
// SIG // b29DZXJBdXQyMDExXzIwMTFfMDNfMjIuY3J0MIGfBgNV
// SIG // HSAEgZcwgZQwgZEGCSsGAQQBgjcuAzCBgzA/BggrBgEF
// SIG // BQcCARYzaHR0cDovL3d3dy5taWNyb3NvZnQuY29tL3Br
// SIG // aW9wcy9kb2NzL3ByaW1hcnljcHMuaHRtMEAGCCsGAQUF
// SIG // BwICMDQeMiAdAEwAZQBnAGEAbABfAHAAbwBsAGkAYwB5
// SIG // AF8AcwB0AGEAdABlAG0AZQBuAHQALiAdMA0GCSqGSIb3
// SIG // DQEBCwUAA4ICAQBn8oalmOBUeRou09h0ZyKbC5YR4WOS
// SIG // mUKWfdJ5DJDBZV8uLD74w3LRbYP+vj/oCso7v0epo/Np
// SIG // 22O/IjWll11lhJB9i0ZQVdgMknzSGksc8zxCi1LQsP1r
// SIG // 4z4HLimb5j0bpdS1HXeUOeLpZMlEPXh6I/MTfaaQdION
// SIG // 9MsmAkYqwooQu6SpBQyb7Wj6aC6VoCo/KmtYSWMfCWlu
// SIG // WpiW5IP0wI/zRive/DvQvTXvbiWu5a8n7dDd8w6vmSiX
// SIG // mE0OPQvyCInWH8MyGOLwxS3OW560STkKxgrCxq2u5bLZ
// SIG // 2xWIUUVYODJxJxp/sfQn+N4sOiBpmLJZiWhub6e3dMNA
// SIG // BQamASooPoI/E01mC8CzTfXhj38cbxV9Rad25UAqZaPD
// SIG // XVJihsMdYzaXht/a8/jyFqGaJ+HNpZfQ7l1jQeNbB5yH
// SIG // PgZ3BtEGsXUfFL5hYbXw3MYbBL7fQccOKO7eZS/sl/ah
// SIG // XJbYANahRr1Z85elCUtIEJmAH9AAKcWxm6U/RXceNcbS
// SIG // oqKfenoi+kiVH6v7RyOA9Z74v2u3S5fi63V4GuzqN5l5
// SIG // GEv/1rMjaHXmr/r8i+sLgOppO6/8MO0ETI7f33VtY5E9
// SIG // 0Z1WTk+/gFcioXgRMiF670EKsT/7qMykXcGhiJtXcVZO
// SIG // SEXAQsmbdlsKgEhr/Xmfwb1tbWrJUnMTDXpQzTGCGaMw
// SIG // ghmfAgEBMIGVMH4xCzAJBgNVBAYTAlVTMRMwEQYDVQQI
// SIG // EwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4w
// SIG // HAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xKDAm
// SIG // BgNVBAMTH01pY3Jvc29mdCBDb2RlIFNpZ25pbmcgUENB
// SIG // IDIwMTECEzMAAALMjrWWpr3RyU4AAAAAAswwDQYJYIZI
// SIG // AWUDBAIBBQCgga4wGQYJKoZIhvcNAQkDMQwGCisGAQQB
// SIG // gjcCAQQwHAYKKwYBBAGCNwIBCzEOMAwGCisGAQQBgjcC
// SIG // ARUwLwYJKoZIhvcNAQkEMSIEIB6l4trkwjJalORWn5nu
// SIG // sSMBvTBQ2WWeuxq/Cyek9StNMEIGCisGAQQBgjcCAQwx
// SIG // NDAyoBSAEgBNAGkAYwByAG8AcwBvAGYAdKEagBhodHRw
// SIG // Oi8vd3d3Lm1pY3Jvc29mdC5jb20wDQYJKoZIhvcNAQEB
// SIG // BQAEggEALYVdrxNg78o0ZvoBcWK5ULPfEZzPkh+YTg2e
// SIG // hs3B4vJ019njEWymSzVveFw7auIS0FXY0LRmdX142exp
// SIG // pODmvYzYtGo08UKVesT2KeSAySz/8xMt0tcjE3Bbcc3C
// SIG // si7g/dCrxYNMN1nEjxzd/Z930N1590VNns/RSkQgzdd/
// SIG // qEy8so0NZpirM/iENSsVbhQiVKRsJfjaFo/YARPnAGZV
// SIG // tpmmQdkMR25p8VtXMt0RA5mjJdUvPe0ElgwDfADIuMDQ
// SIG // 8sKreDvI+eFPfDp660LSRw8nDp92+aAYqUy0oUiE5pWM
// SIG // ZhaRSAr7mWptYl/KZjxkmXCQrWU1ZaXYWDngysXrjqGC
// SIG // Fy0wghcpBgorBgEEAYI3AwMBMYIXGTCCFxUGCSqGSIb3
// SIG // DQEHAqCCFwYwghcCAgEDMQ8wDQYJYIZIAWUDBAIBBQAw
// SIG // ggFZBgsqhkiG9w0BCRABBKCCAUgEggFEMIIBQAIBAQYK
// SIG // KwYBBAGEWQoDATAxMA0GCWCGSAFlAwQCAQUABCDuBp3L
// SIG // Rx6sdoNjkrQ5WGt8GABMlQYOKpzMgyHEqp45SAIGY8fd
// SIG // ephCGBMyMDIzMDEyNTAxMzAzMC4wMjRaMASAAgH0oIHY
// SIG // pIHVMIHSMQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2Fz
// SIG // aGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UE
// SIG // ChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMS0wKwYDVQQL
// SIG // EyRNaWNyb3NvZnQgSXJlbGFuZCBPcGVyYXRpb25zIExp
// SIG // bWl0ZWQxJjAkBgNVBAsTHVRoYWxlcyBUU1MgRVNOOjE3
// SIG // OUUtNEJCMC04MjQ2MSUwIwYDVQQDExxNaWNyb3NvZnQg
// SIG // VGltZS1TdGFtcCBTZXJ2aWNloIIRfDCCBycwggUPoAMC
// SIG // AQICEzMAAAG1rRrf14VwbRMAAQAAAbUwDQYJKoZIhvcN
// SIG // AQELBQAwfDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldh
// SIG // c2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNV
// SIG // BAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEmMCQGA1UE
// SIG // AxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTAw
// SIG // HhcNMjIwOTIwMjAyMjExWhcNMjMxMjE0MjAyMjExWjCB
// SIG // 0jELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0
// SIG // b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1p
// SIG // Y3Jvc29mdCBDb3Jwb3JhdGlvbjEtMCsGA1UECxMkTWlj
// SIG // cm9zb2Z0IElyZWxhbmQgT3BlcmF0aW9ucyBMaW1pdGVk
// SIG // MSYwJAYDVQQLEx1UaGFsZXMgVFNTIEVTTjoxNzlFLTRC
// SIG // QjAtODI0NjElMCMGA1UEAxMcTWljcm9zb2Z0IFRpbWUt
// SIG // U3RhbXAgU2VydmljZTCCAiIwDQYJKoZIhvcNAQEBBQAD
// SIG // ggIPADCCAgoCggIBAJcLCrhlXoLCjYmFxcFPgkh57dmu
// SIG // z31sNsj8IlvmEZRCbB94mxSIj35P8m5TKfCRmp7bvuw4
// SIG // v/t3ucFjf52yVCDFIxFiZ3PCTI6D5hwlrDLSTrkf9Ubu
// SIG // GmtUa8ULSHpatPfEwZeJOzbBBPO5e6ihZsvIsBjUI5MK
// SIG // 9GzLuAScMuwVF4lx3oDklPfdq30OMTWaMc57+Nky0LHP
// SIG // TZnAauVrJZKlQE3HPD0n4ASxKXRtQ6dsKjcOCayRcCTQ
// SIG // NW3800nGAAXObJkWQYLD+CYiv/Ala5aHIXhMkKJ45t6x
// SIG // bba6IwK3klJ4sQC7vaQ67ASOA1Dxht+KCG4niNaKhZf8
// SIG // ZOwPu7jPJOKPInzFVjU2nM2z5XQ2LZ+oQa3u69uURA+L
// SIG // nnAsT/A8ct+GD1BJVpZTz9ywF6eXDMEY8fhFs4xLSCxC
// SIG // l7gHH8a1wk8MmIZuVzcwgmWIeP4BdlNsv22H3pCqWqBW
// SIG // MJKGXk+mcaEG1+Sn7YI/rWZBVdtVL2SJCem9+Gv+OHba
// SIG // 7CunYk5lZzUzPSej+hIZZNrH3FMGxyBi/JmKnSjosneE
// SIG // cTgpkr3BTZGRIK5OePJhwmw208jvcUszdRJFsW6fJ/yx
// SIG // 1Z2fX6eYSCxp7ZDM2g+Wl0QkMh0iIbD7Ue0P6yqB8oxa
// SIG // oLRjvX7Z8WL8cza2ynjAs8JnKsDK1+h3MXtEnimfAgMB
// SIG // AAGjggFJMIIBRTAdBgNVHQ4EFgQUbFCG2YKGVV1V1VkF
// SIG // 9DpNVTtmx1MwHwYDVR0jBBgwFoAUn6cVXQBeYl2D9OXS
// SIG // ZacbUzUZ6XIwXwYDVR0fBFgwVjBUoFKgUIZOaHR0cDov
// SIG // L3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9jcmwvTWlj
// SIG // cm9zb2Z0JTIwVGltZS1TdGFtcCUyMFBDQSUyMDIwMTAo
// SIG // MSkuY3JsMGwGCCsGAQUFBwEBBGAwXjBcBggrBgEFBQcw
// SIG // AoZQaHR0cDovL3d3dy5taWNyb3NvZnQuY29tL3BraW9w
// SIG // cy9jZXJ0cy9NaWNyb3NvZnQlMjBUaW1lLVN0YW1wJTIw
// SIG // UENBJTIwMjAxMCgxKS5jcnQwDAYDVR0TAQH/BAIwADAW
// SIG // BgNVHSUBAf8EDDAKBggrBgEFBQcDCDAOBgNVHQ8BAf8E
// SIG // BAMCB4AwDQYJKoZIhvcNAQELBQADggIBAJBRjqcoyldr
// SIG // NrAPsE6g8A3YadJhaz7YlOKzdzqJ01qm/OTOlh9fXPz+
// SIG // de8boywoofx5ZT+cSlpl5wCEVdfzUA5CQS0nS02/zULX
// SIG // E9RVhkOwjE565/bS2caiBbSlcpb0Dcod9Qv6pAvEJjac
// SIG // s2pDtBt/LjhoDpCfRKuJwPu0MFX6Gw5YIFrhKc3RZ0Xc
// SIG // ly99oDqkr6y4xSqb+ChFamgU4msQlmQ5SIRt2IFM2u3J
// SIG // xuWdkgP33jKvyIldOgM1GnWcOl4HE66l5hJhNLTJnZeO
// SIG // DDBQt8BlPQFXhQlinQ/Vjp2ANsx4Plxdi0FbaNFWLRS3
// SIG // enOg0BXJgd/BrzwilWEp/K9dBKF7kTfoEO4S3IptdnrD
// SIG // p1uBeGxwph1k1VngBoD4kiLRx0XxiixFGZqLVTnRT0fM
// SIG // IrgA0/3x0lwZJHaS9drb4BBhC3k858xbpWdem/zb+nbW
// SIG // 4EkWa3nrCQTSqU43WI7vxqp5QJKX5S+idMMZPee/1FWJ
// SIG // 5o40WOtY1/dEBkJgc5vb7P/tm49Nl8f2118vL6ue45jV
// SIG // 0NrnzmiZt5wHA9qjmkslxDo/ZqoTLeLXbzIx4YjT5XX4
// SIG // 9EOyqtR4HUQaylpMwkDYuLbPB0SQYqTWlaVn1OwXEZ/A
// SIG // XmM3S6CM8ESw7Wrc+mgYaN6A/21x62WoMaazOTLDAf61
// SIG // X2+V59WEu/7hMIIHcTCCBVmgAwIBAgITMwAAABXF52ue
// SIG // AptJmQAAAAAAFTANBgkqhkiG9w0BAQsFADCBiDELMAkG
// SIG // A1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAO
// SIG // BgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29m
// SIG // dCBDb3Jwb3JhdGlvbjEyMDAGA1UEAxMpTWljcm9zb2Z0
// SIG // IFJvb3QgQ2VydGlmaWNhdGUgQXV0aG9yaXR5IDIwMTAw
// SIG // HhcNMjEwOTMwMTgyMjI1WhcNMzAwOTMwMTgzMjI1WjB8
// SIG // MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3Rv
// SIG // bjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWlj
// SIG // cm9zb2Z0IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNy
// SIG // b3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAxMDCCAiIwDQYJ
// SIG // KoZIhvcNAQEBBQADggIPADCCAgoCggIBAOThpkzntHIh
// SIG // C3miy9ckeb0O1YLT/e6cBwfSqWxOdcjKNVf2AX9sSuDi
// SIG // vbk+F2Az/1xPx2b3lVNxWuJ+Slr+uDZnhUYjDLWNE893
// SIG // MsAQGOhgfWpSg0S3po5GawcU88V29YZQ3MFEyHFcUTE3
// SIG // oAo4bo3t1w/YJlN8OWECesSq/XJprx2rrPY2vjUmZNqY
// SIG // O7oaezOtgFt+jBAcnVL+tuhiJdxqD89d9P6OU8/W7IVW
// SIG // Te/dvI2k45GPsjksUZzpcGkNyjYtcI4xyDUoveO0hyTD
// SIG // 4MmPfrVUj9z6BVWYbWg7mka97aSueik3rMvrg0XnRm7K
// SIG // MtXAhjBcTyziYrLNueKNiOSWrAFKu75xqRdbZ2De+JKR
// SIG // Hh09/SDPc31BmkZ1zcRfNN0Sidb9pSB9fvzZnkXftnIv
// SIG // 231fgLrbqn427DZM9ituqBJR6L8FA6PRc6ZNN3SUHDSC
// SIG // D/AQ8rdHGO2n6Jl8P0zbr17C89XYcz1DTsEzOUyOArxC
// SIG // aC4Q6oRRRuLRvWoYWmEBc8pnol7XKHYC4jMYctenIPDC
// SIG // +hIK12NvDMk2ZItboKaDIV1fMHSRlJTYuVD5C4lh8zYG
// SIG // NRiER9vcG9H9stQcxWv2XFJRXRLbJbqvUAV6bMURHXLv
// SIG // jflSxIUXk8A8FdsaN8cIFRg/eKtFtvUeh17aj54WcmnG
// SIG // rnu3tz5q4i6tAgMBAAGjggHdMIIB2TASBgkrBgEEAYI3
// SIG // FQEEBQIDAQABMCMGCSsGAQQBgjcVAgQWBBQqp1L+ZMSa
// SIG // voKRPEY1Kc8Q/y8E7jAdBgNVHQ4EFgQUn6cVXQBeYl2D
// SIG // 9OXSZacbUzUZ6XIwXAYDVR0gBFUwUzBRBgwrBgEEAYI3
// SIG // TIN9AQEwQTA/BggrBgEFBQcCARYzaHR0cDovL3d3dy5t
// SIG // aWNyb3NvZnQuY29tL3BraW9wcy9Eb2NzL1JlcG9zaXRv
// SIG // cnkuaHRtMBMGA1UdJQQMMAoGCCsGAQUFBwMIMBkGCSsG
// SIG // AQQBgjcUAgQMHgoAUwB1AGIAQwBBMAsGA1UdDwQEAwIB
// SIG // hjAPBgNVHRMBAf8EBTADAQH/MB8GA1UdIwQYMBaAFNX2
// SIG // VsuP6KJcYmjRPZSQW9fOmhjEMFYGA1UdHwRPME0wS6BJ
// SIG // oEeGRWh0dHA6Ly9jcmwubWljcm9zb2Z0LmNvbS9wa2kv
// SIG // Y3JsL3Byb2R1Y3RzL01pY1Jvb0NlckF1dF8yMDEwLTA2
// SIG // LTIzLmNybDBaBggrBgEFBQcBAQROMEwwSgYIKwYBBQUH
// SIG // MAKGPmh0dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9wa2kv
// SIG // Y2VydHMvTWljUm9vQ2VyQXV0XzIwMTAtMDYtMjMuY3J0
// SIG // MA0GCSqGSIb3DQEBCwUAA4ICAQCdVX38Kq3hLB9nATEk
// SIG // W+Geckv8qW/qXBS2Pk5HZHixBpOXPTEztTnXwnE2P9pk
// SIG // bHzQdTltuw8x5MKP+2zRoZQYIu7pZmc6U03dmLq2HnjY
// SIG // Ni6cqYJWAAOwBb6J6Gngugnue99qb74py27YP0h1AdkY
// SIG // 3m2CDPVtI1TkeFN1JFe53Z/zjj3G82jfZfakVqr3lbYo
// SIG // VSfQJL1AoL8ZthISEV09J+BAljis9/kpicO8F7BUhUKz
// SIG // /AyeixmJ5/ALaoHCgRlCGVJ1ijbCHcNhcy4sa3tuPywJ
// SIG // eBTpkbKpW99Jo3QMvOyRgNI95ko+ZjtPu4b6MhrZlvSP
// SIG // 9pEB9s7GdP32THJvEKt1MMU0sHrYUP4KWN1APMdUbZ1j
// SIG // dEgssU5HLcEUBHG/ZPkkvnNtyo4JvbMBV0lUZNlz138e
// SIG // W0QBjloZkWsNn6Qo3GcZKCS6OEuabvshVGtqRRFHqfG3
// SIG // rsjoiV5PndLQTHa1V1QJsWkBRH58oWFsc/4Ku+xBZj1p
// SIG // /cvBQUl+fpO+y/g75LcVv7TOPqUxUYS8vwLBgqJ7Fx0V
// SIG // iY1w/ue10CgaiQuPNtq6TPmb/wrpNPgkNWcr4A245oyZ
// SIG // 1uEi6vAnQj0llOZ0dFtq0Z4+7X6gMTN9vMvpe784cETR
// SIG // kPHIqzqKOghif9lwY1NNje6CbaUFEMFxBmoQtB1VM1iz
// SIG // oXBm8qGCAtgwggJBAgEBMIIBAKGB2KSB1TCB0jELMAkG
// SIG // A1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAO
// SIG // BgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29m
// SIG // dCBDb3Jwb3JhdGlvbjEtMCsGA1UECxMkTWljcm9zb2Z0
// SIG // IElyZWxhbmQgT3BlcmF0aW9ucyBMaW1pdGVkMSYwJAYD
// SIG // VQQLEx1UaGFsZXMgVFNTIEVTTjoxNzlFLTRCQjAtODI0
// SIG // NjElMCMGA1UEAxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAg
// SIG // U2VydmljZaIjCgEBMAcGBSsOAwIaAxUAjTCfa9dUWY9D
// SIG // 1rt7pPmkBxdyLFWggYMwgYCkfjB8MQswCQYDVQQGEwJV
// SIG // UzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMH
// SIG // UmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBv
// SIG // cmF0aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQgVGltZS1T
// SIG // dGFtcCBQQ0EgMjAxMDANBgkqhkiG9w0BAQUFAAIFAOd6
// SIG // 7YMwIhgPMjAyMzAxMjUwNzUxMzFaGA8yMDIzMDEyNjA3
// SIG // NTEzMVoweDA+BgorBgEEAYRZCgQBMTAwLjAKAgUA53rt
// SIG // gwIBADALAgEAAgMAyIUCAf8wBwIBAAICET4wCgIFAOd8
// SIG // PwMCAQAwNgYKKwYBBAGEWQoEAjEoMCYwDAYKKwYBBAGE
// SIG // WQoDAqAKMAgCAQACAwehIKEKMAgCAQACAwGGoDANBgkq
// SIG // hkiG9w0BAQUFAAOBgQCGDIyQc0zA6EA1uxXke6KnIg3K
// SIG // gORWpAr30QWu66+HBSsckYowx08vlHPOuu81oWYj9gLD
// SIG // 3Bvu3T3BSDHZTjo0aH+FVuxg1sBFRFoAwzfbq3A/kmVY
// SIG // M321jS63nxzhgMYbj/vEaTDRAFGFz81rJTDcSx5PHG/h
// SIG // WhEogBAECL+6QjGCBA0wggQJAgEBMIGTMHwxCzAJBgNV
// SIG // BAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYD
// SIG // VQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQg
// SIG // Q29ycG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jvc29mdCBU
// SIG // aW1lLVN0YW1wIFBDQSAyMDEwAhMzAAABta0a39eFcG0T
// SIG // AAEAAAG1MA0GCWCGSAFlAwQCAQUAoIIBSjAaBgkqhkiG
// SIG // 9w0BCQMxDQYLKoZIhvcNAQkQAQQwLwYJKoZIhvcNAQkE
// SIG // MSIEIFxy0HuPLBmu2i7BrrXCo1d94lMUCpwq3ZrCipaH
// SIG // ZCsDMIH6BgsqhkiG9w0BCRACLzGB6jCB5zCB5DCBvQQg
// SIG // J8oNNS1oZxaJ9hzc5WcimntiSfRLwlyVXOuUCAXxyIMw
// SIG // gZgwgYCkfjB8MQswCQYDVQQGEwJVUzETMBEGA1UECBMK
// SIG // V2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwG
// SIG // A1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSYwJAYD
// SIG // VQQDEx1NaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAx
// SIG // MAITMwAAAbWtGt/XhXBtEwABAAABtTAiBCB0KhIRZBBQ
// SIG // VnkHW8wjd0SkZ0XSm8H5u9C0Apim1E594jANBgkqhkiG
// SIG // 9w0BAQsFAASCAgATH9gN3nuMoUZh1ZI2LkKySpNezJKa
// SIG // FdAs2XQL2I2x0wVwxPp229rNy/YEFQoUQjOH1k4dmirG
// SIG // 6DJtSH5vVmMdwLIIqTHmMu9F07eTkdvo764iIGhPglJu
// SIG // tKUr+W7enXZY3aDFqboI6TJPyJOKsnOrWkQo+68589a/
// SIG // SQcyahTDE71U6KftdkYy5ORkeXuIrOSNcnZFF1HE9Hsl
// SIG // VuxHlHu9+2qCKz+zZfjJXx6X+1qZNqxPMCamem1abLl6
// SIG // jxavPuQLXbJBqeNvFOSd8B1KABNLj0PMVhBQtOJ9erLf
// SIG // /hiu0kZfvBDJOEwsJRswmsJbZJqATvCHJLtTFo67oXMK
// SIG // TPq5y/8tsgn7HC4LdJ8LmG13FwFvzbl7ySdoOfPP145h
// SIG // J4shBC/Op+9Jj84lJM9aZod0f7PVNZpvgX8qkShmADbL
// SIG // rLGtFRx+JDoDCOnu1McleA12lerYBg5Pzbp0L+909L9o
// SIG // 8TU5GyxIGsJ+6B2PhjtJcycRnfh+WmK/jWzuSWhnTPrQ
// SIG // bVmUejfMxyqQp1fJ1E7hDmI/Ic9ivCwo2tvrxkOQY/tJ
// SIG // dFIcW9mAWUNR9qpWwl6xuehd8zT56z3oLpgc6ueFJeSD
// SIG // Wj/fSGMh254J6nMx4i9JWVAmWITVr+KWpOrL7OWR5bga
// SIG // Vl4cdDqqTcaBF1pL35yuc2J9ovBC3Bf6dWZSgg==
// SIG // End signature block
