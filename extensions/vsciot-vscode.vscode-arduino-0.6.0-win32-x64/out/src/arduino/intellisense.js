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
// SIG // MIInoAYJKoZIhvcNAQcCoIInkTCCJ40CAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // C8A+Ee1vQZ4hxSgmqNeSwZLxAI+9hX54PrcMgBp5TTag
// SIG // gg2FMIIGAzCCA+ugAwIBAgITMwAAAs3zZL/41ExdUQAA
// SIG // AAACzTANBgkqhkiG9w0BAQsFADB+MQswCQYDVQQGEwJV
// SIG // UzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMH
// SIG // UmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBv
// SIG // cmF0aW9uMSgwJgYDVQQDEx9NaWNyb3NvZnQgQ29kZSBT
// SIG // aWduaW5nIFBDQSAyMDExMB4XDTIyMDUxMjIwNDYwMloX
// SIG // DTIzMDUxMTIwNDYwMlowdDELMAkGA1UEBhMCVVMxEzAR
// SIG // BgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1v
// SIG // bmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlv
// SIG // bjEeMBwGA1UEAxMVTWljcm9zb2Z0IENvcnBvcmF0aW9u
// SIG // MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA
// SIG // 6yM7GOtjJiq83q4Ju1HJ7vg7kh3YM0WVQiBovQmpRa4c
// SIG // LYivtxSA85TmG7P88x8Liwt4Yq+ecFYB6GguJYkMEOtM
// SIG // FckdexGT2uAUNvAuQEZcan7Xadx/Ea11m1cr0GlJwUFW
// SIG // TO91w8hldaFD2RhxlrYHarQVHetFY5xTyAkn/KZxYore
// SIG // ob0sR+SFViNIjp36nV2KD1lLVVDJlaltcgV9DbW0JUhy
// SIG // FOoZT76Pf7qir5IxVBQNi2wvQFkGyZh/tbjNJeJw0inw
// SIG // qnHL3SOZd84xJPclElJodSEIQxZ/uUi9iZpwhdI2RGeH
// SIG // +RxO8pAz/qIgN0Pn4SgrHoPtGhB4vg0T2QIDAQABo4IB
// SIG // gjCCAX4wHwYDVR0lBBgwFgYKKwYBBAGCN0wIAQYIKwYB
// SIG // BQUHAwMwHQYDVR0OBBYEFNFsph+Aj+7NfskJLRMG3C0L
// SIG // kfWcMFQGA1UdEQRNMEukSTBHMS0wKwYDVQQLEyRNaWNy
// SIG // b3NvZnQgSXJlbGFuZCBPcGVyYXRpb25zIExpbWl0ZWQx
// SIG // FjAUBgNVBAUTDTIzMDAxMis0NzA1MzAwHwYDVR0jBBgw
// SIG // FoAUSG5k5VAF04KqFzc3IrVtqMp1ApUwVAYDVR0fBE0w
// SIG // SzBJoEegRYZDaHR0cDovL3d3dy5taWNyb3NvZnQuY29t
// SIG // L3BraW9wcy9jcmwvTWljQ29kU2lnUENBMjAxMV8yMDEx
// SIG // LTA3LTA4LmNybDBhBggrBgEFBQcBAQRVMFMwUQYIKwYB
// SIG // BQUHMAKGRWh0dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9w
// SIG // a2lvcHMvY2VydHMvTWljQ29kU2lnUENBMjAxMV8yMDEx
// SIG // LTA3LTA4LmNydDAMBgNVHRMBAf8EAjAAMA0GCSqGSIb3
// SIG // DQEBCwUAA4ICAQBOy0rrjTmwgVmLrbcSQIIpVyfdhqcl
// SIG // f304slx2f/S2817PzHypz8EcnZZgNmpNKxliwxYfPcwF
// SIG // hxSPLfSS8KXf1UaFRN/lss0yLJHWwZx239co6P/tLaR5
// SIG // Z66BSXXA0jCLB/k+89wpWPulp40k3raYNWP6Szi12aWY
// SIG // 2Hl0IhcKPRuZc1HEnfGFUDT0ABiApdiUUmgjZcwHSBQh
// SIG // eTzSqF2ybRKg3D2fKA6zPSnTu06lBOVangXug4IGNbGW
// SIG // J0A/vy1pc+Q9MAq4jYBkP01lnsTMMJxKpSMH5CHDRcaN
// SIG // EDQ/+mGvQ0wFMpJNkihkj7dJC7R8TRJ9hib3DbX6IVWP
// SIG // 29LbshdOXlxN3HbWGW3hqFNcUIsT2QJU3bS5nhTZcvNr
// SIG // gVW8mwGeFLdfBf/1K7oFUPVFHStbmJnPtknUUEAnHCsF
// SIG // xjrmIGdVC1truT8n1sc6OAUfvudzgf7WV0Kc+DpIAWXq
// SIG // rPWGmCxXykZUB1bZkIIRR8web/1haJ8Q1Zbz8ctoKGtL
// SIG // vWfmZSKb6KGUb5ujrV8XQIzAXFgQLJwUa/zo+bN+ehA3
// SIG // X9pf7C8CxWBOtbfjBIjWHctKVy+oDdw8U1X9qoycVxZB
// SIG // X4404rJ3bnR7ILhDJPJhLZ78KPXzkik+qER4TPbGeB04
// SIG // P00zI1JY5jd5gWFgFiORMXQtYp7qINMaypjllTCCB3ow
// SIG // ggVioAMCAQICCmEOkNIAAAAAAAMwDQYJKoZIhvcNAQEL
// SIG // BQAwgYgxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNo
// SIG // aW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQK
// SIG // ExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xMjAwBgNVBAMT
// SIG // KU1pY3Jvc29mdCBSb290IENlcnRpZmljYXRlIEF1dGhv
// SIG // cml0eSAyMDExMB4XDTExMDcwODIwNTkwOVoXDTI2MDcw
// SIG // ODIxMDkwOVowfjELMAkGA1UEBhMCVVMxEzARBgNVBAgT
// SIG // Cldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAc
// SIG // BgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEoMCYG
// SIG // A1UEAxMfTWljcm9zb2Z0IENvZGUgU2lnbmluZyBQQ0Eg
// SIG // MjAxMTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoC
// SIG // ggIBAKvw+nIQHC6t2G6qghBNNLrytlghn0IbKmvpWlCq
// SIG // uAY4GgRJun/DDB7dN2vGEtgL8DjCmQawyDnVARQxQtOJ
// SIG // DXlkh36UYCRsr55JnOloXtLfm1OyCizDr9mpK656Ca/X
// SIG // llnKYBoF6WZ26DJSJhIv56sIUM+zRLdd2MQuA3WraPPL
// SIG // bfM6XKEW9Ea64DhkrG5kNXimoGMPLdNAk/jj3gcN1Vx5
// SIG // pUkp5w2+oBN3vpQ97/vjK1oQH01WKKJ6cuASOrdJXtjt
// SIG // 7UORg9l7snuGG9k+sYxd6IlPhBryoS9Z5JA7La4zWMW3
// SIG // Pv4y07MDPbGyr5I4ftKdgCz1TlaRITUlwzluZH9TupwP
// SIG // rRkjhMv0ugOGjfdf8NBSv4yUh7zAIXQlXxgotswnKDgl
// SIG // mDlKNs98sZKuHCOnqWbsYR9q4ShJnV+I4iVd0yFLPlLE
// SIG // tVc/JAPw0XpbL9Uj43BdD1FGd7P4AOG8rAKCX9vAFbO9
// SIG // G9RVS+c5oQ/pI0m8GLhEfEXkwcNyeuBy5yTfv0aZxe/C
// SIG // HFfbg43sTUkwp6uO3+xbn6/83bBm4sGXgXvt1u1L50kp
// SIG // pxMopqd9Z4DmimJ4X7IvhNdXnFy/dygo8e1twyiPLI9A
// SIG // N0/B4YVEicQJTMXUpUMvdJX3bvh4IFgsE11glZo+TzOE
// SIG // 2rCIF96eTvSWsLxGoGyY0uDWiIwLAgMBAAGjggHtMIIB
// SIG // 6TAQBgkrBgEEAYI3FQEEAwIBADAdBgNVHQ4EFgQUSG5k
// SIG // 5VAF04KqFzc3IrVtqMp1ApUwGQYJKwYBBAGCNxQCBAwe
// SIG // CgBTAHUAYgBDAEEwCwYDVR0PBAQDAgGGMA8GA1UdEwEB
// SIG // /wQFMAMBAf8wHwYDVR0jBBgwFoAUci06AjGQQ7kUBU7h
// SIG // 6qfHMdEjiTQwWgYDVR0fBFMwUTBPoE2gS4ZJaHR0cDov
// SIG // L2NybC5taWNyb3NvZnQuY29tL3BraS9jcmwvcHJvZHVj
// SIG // dHMvTWljUm9vQ2VyQXV0MjAxMV8yMDExXzAzXzIyLmNy
// SIG // bDBeBggrBgEFBQcBAQRSMFAwTgYIKwYBBQUHMAKGQmh0
// SIG // dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9wa2kvY2VydHMv
// SIG // TWljUm9vQ2VyQXV0MjAxMV8yMDExXzAzXzIyLmNydDCB
// SIG // nwYDVR0gBIGXMIGUMIGRBgkrBgEEAYI3LgMwgYMwPwYI
// SIG // KwYBBQUHAgEWM2h0dHA6Ly93d3cubWljcm9zb2Z0LmNv
// SIG // bS9wa2lvcHMvZG9jcy9wcmltYXJ5Y3BzLmh0bTBABggr
// SIG // BgEFBQcCAjA0HjIgHQBMAGUAZwBhAGwAXwBwAG8AbABp
// SIG // AGMAeQBfAHMAdABhAHQAZQBtAGUAbgB0AC4gHTANBgkq
// SIG // hkiG9w0BAQsFAAOCAgEAZ/KGpZjgVHkaLtPYdGcimwuW
// SIG // EeFjkplCln3SeQyQwWVfLiw++MNy0W2D/r4/6ArKO79H
// SIG // qaPzadtjvyI1pZddZYSQfYtGUFXYDJJ80hpLHPM8QotS
// SIG // 0LD9a+M+By4pm+Y9G6XUtR13lDni6WTJRD14eiPzE32m
// SIG // kHSDjfTLJgJGKsKKELukqQUMm+1o+mgulaAqPyprWElj
// SIG // HwlpblqYluSD9MCP80Yr3vw70L01724lruWvJ+3Q3fMO
// SIG // r5kol5hNDj0L8giJ1h/DMhji8MUtzluetEk5CsYKwsat
// SIG // ruWy2dsViFFFWDgycScaf7H0J/jeLDogaZiyWYlobm+n
// SIG // t3TDQAUGpgEqKD6CPxNNZgvAs0314Y9/HG8VfUWnduVA
// SIG // KmWjw11SYobDHWM2l4bf2vP48hahmifhzaWX0O5dY0Hj
// SIG // Wwechz4GdwbRBrF1HxS+YWG18NzGGwS+30HHDiju3mUv
// SIG // 7Jf2oVyW2ADWoUa9WfOXpQlLSBCZgB/QACnFsZulP0V3
// SIG // HjXG0qKin3p6IvpIlR+r+0cjgPWe+L9rt0uX4ut1eBrs
// SIG // 6jeZeRhL/9azI2h15q/6/IvrC4DqaTuv/DDtBEyO3991
// SIG // bWORPdGdVk5Pv4BXIqF4ETIheu9BCrE/+6jMpF3BoYib
// SIG // V3FWTkhFwELJm3ZbCoBIa/15n8G9bW1qyVJzEw16UM0x
// SIG // ghlzMIIZbwIBATCBlTB+MQswCQYDVQQGEwJVUzETMBEG
// SIG // A1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9u
// SIG // ZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9u
// SIG // MSgwJgYDVQQDEx9NaWNyb3NvZnQgQ29kZSBTaWduaW5n
// SIG // IFBDQSAyMDExAhMzAAACzfNkv/jUTF1RAAAAAALNMA0G
// SIG // CWCGSAFlAwQCAQUAoIGuMBkGCSqGSIb3DQEJAzEMBgor
// SIG // BgEEAYI3AgEEMBwGCisGAQQBgjcCAQsxDjAMBgorBgEE
// SIG // AYI3AgEVMC8GCSqGSIb3DQEJBDEiBCAepeLa5MIyWpTk
// SIG // Vp+Z7rEjAb0wUNllnrsavwsnpPUrTTBCBgorBgEEAYI3
// SIG // AgEMMTQwMqAUgBIATQBpAGMAcgBvAHMAbwBmAHShGoAY
// SIG // aHR0cDovL3d3dy5taWNyb3NvZnQuY29tMA0GCSqGSIb3
// SIG // DQEBAQUABIIBANyV6OLrEjUzLB7P4W6cpcL/k6eBCKqM
// SIG // 6hPOTXFoRCwBKHiBGsvPt76pLv4TXEsDGSWlcP5X0qSR
// SIG // 2G11XxqRALDKacwbymxP7PiAw9VyUmlmeZ0twe/W5FUi
// SIG // acQtXnmiBRKHbi+9mpGn4PNZIWXHnE99TgBnYAvUhmCX
// SIG // 1Pr2L5SFy5KKLyVhbJBcoRNwEMv9Qe9+IrqWc7ROJsA3
// SIG // x/RDNBNJlgmm9rlI9J65Zk3FqD4RnPxtaNSOVWVNDRQq
// SIG // /ai25FG2SRy3bbing8RFgb7JVeqnNPtjhTt8UBQD39Sa
// SIG // 7YE3BWRO1wZA6zysBH9jy1P5SzF1kgoGtQtT2tIla5SQ
// SIG // /zehghb9MIIW+QYKKwYBBAGCNwMDATGCFukwghblBgkq
// SIG // hkiG9w0BBwKgghbWMIIW0gIBAzEPMA0GCWCGSAFlAwQC
// SIG // AQUAMIIBUQYLKoZIhvcNAQkQAQSgggFABIIBPDCCATgC
// SIG // AQEGCisGAQQBhFkKAwEwMTANBglghkgBZQMEAgEFAAQg
// SIG // k5OUT8obVgU8PxnHHdVicqgAgwK+w34dyq6+ifP08VsC
// SIG // BmPuK1sMVhgTMjAyMzAzMTUyMTA2NDMuODc5WjAEgAIB
// SIG // 9KCB0KSBzTCByjELMAkGA1UEBhMCVVMxEzARBgNVBAgT
// SIG // Cldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAc
// SIG // BgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjElMCMG
// SIG // A1UECxMcTWljcm9zb2Z0IEFtZXJpY2EgT3BlcmF0aW9u
// SIG // czEmMCQGA1UECxMdVGhhbGVzIFRTUyBFU046RDZCRC1F
// SIG // M0U3LTE2ODUxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1l
// SIG // LVN0YW1wIFNlcnZpY2WgghFUMIIHDDCCBPSgAwIBAgIT
// SIG // MwAAAcf7AKBKW/In3AABAAABxzANBgkqhkiG9w0BAQsF
// SIG // ADB8MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGlu
// SIG // Z3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMV
// SIG // TWljcm9zb2Z0IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1N
// SIG // aWNyb3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAxMDAeFw0y
// SIG // MjExMDQxOTAxMzVaFw0yNDAyMDIxOTAxMzVaMIHKMQsw
// SIG // CQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQ
// SIG // MA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9z
// SIG // b2Z0IENvcnBvcmF0aW9uMSUwIwYDVQQLExxNaWNyb3Nv
// SIG // ZnQgQW1lcmljYSBPcGVyYXRpb25zMSYwJAYDVQQLEx1U
// SIG // aGFsZXMgVFNTIEVTTjpENkJELUUzRTctMTY4NTElMCMG
// SIG // A1UEAxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAgU2Vydmlj
// SIG // ZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIB
// SIG // AK9C3FbZ2rTRTAa0E7RvT/CEgD8shpsTX4RM2jlZbdPP
// SIG // KQVBQCGrJjf3jooxOlHGn93Nm1Zzf9NoodLJkqmJJuT9
// SIG // 2cFO2VttNm+nDwyY13K4yY9Kn57nHAbRN1lNL2fAokA+
// SIG // 6qysXhfGATXEvj1bb7KoXeWFugMIVqoY8NZmLi3rReW+
// SIG // mj4n/90c5cqht0le0D4kiXp3bO4BuN+UbMtRyeF56s7T
// SIG // iUeNSNI9xENOSTBeUDUYu5E+r100/jB1Y9uxVUO23n/1
// SIG // PthAGxY9l9gDlm74JWGmJzN5vyPzlgx1IBsPCiHbA4d1
// SIG // tXrrJxdg+6HpxoLWobPktRuVKJX+REoP/Wft/K4UMC4K
// SIG // JGOZOqfJOWq2FrbM3SSuiYiEZfONx++JO/kKpU9i2wED
// SIG // 6vIr0L9IHXJVtmibp9Sq1vr+dkd7wBwjrW1Jsbw9XjRh
// SIG // 6hqi2oLZavVBVyl7l56lyaq7gmJn8HRTA9FD+ootZRXX
// SIG // ii/Oz3Y3QMMgolXAhKC57w88r4zY8bZE3c+keMhdTf1+
// SIG // D0kB+BZYLJcgSF4IGkpT7bz7sQLbmnPyE4+JNCEUoRom
// SIG // CwTNg8OqHrCzqMXtOzlDzvql1znCTFR4RNDJYYZ8Xzdg
// SIG // dSVhT1sEOqKFoqgDkA6s3A8fu/bIcQNQsdCu9HjgaZTK
// SIG // INu4GKC6Qb+50c+LR6qE8rwNAgMBAAGjggE2MIIBMjAd
// SIG // BgNVHQ4EFgQUBVDS3Rw+wQBf1VP1/3hBy4lEkiAwHwYD
// SIG // VR0jBBgwFoAUn6cVXQBeYl2D9OXSZacbUzUZ6XIwXwYD
// SIG // VR0fBFgwVjBUoFKgUIZOaHR0cDovL3d3dy5taWNyb3Nv
// SIG // ZnQuY29tL3BraW9wcy9jcmwvTWljcm9zb2Z0JTIwVGlt
// SIG // ZS1TdGFtcCUyMFBDQSUyMDIwMTAoMSkuY3JsMGwGCCsG
// SIG // AQUFBwEBBGAwXjBcBggrBgEFBQcwAoZQaHR0cDovL3d3
// SIG // dy5taWNyb3NvZnQuY29tL3BraW9wcy9jZXJ0cy9NaWNy
// SIG // b3NvZnQlMjBUaW1lLVN0YW1wJTIwUENBJTIwMjAxMCgx
// SIG // KS5jcnQwDAYDVR0TAQH/BAIwADATBgNVHSUEDDAKBggr
// SIG // BgEFBQcDCDANBgkqhkiG9w0BAQsFAAOCAgEA0MuXPKID
// SIG // 9MvMQLC1XGtO8FstZk/p6mIABZ89ve9pDTviiewBOH/k
// SIG // lW7zp5Hnrjj6t8XPuk0vINxbiimBMGKr50R8V+fLY5bH
// SIG // GbGXip7u3xjVJaTU/WzkBR1gC1EbqF6fEyx4cY9zxKvY
// SIG // 8xWAT9mDTC6Je9KI2Naqc3t5zDCX6Xbq3QQaWji5SZkT
// SIG // Uy4cXfkSRiUG2NVwHMeqfxYoMKgWrEg1MaftMhTxAQfb
// SIG // gRNyiCwLaun3MxqeBDHqJ+mJpMghgLVzCgxUEIHT/yE3
// SIG // u1YIQFWz01ZT94WNXRYHPrfGCtqGxUhVSrJZAEgEwx7p
// SIG // QjIbflqyLLpHJRFD/Q2jJqau0tESzgzInCOj7aqhjoXZ
// SIG // 2kZbQNHfln/tLT7fUlFbazycju1jDym8pAkV85hytOs6
// SIG // 9JJ9WIlGDVwrDoGhxeSJjtmcEOeFBNSOeY41HZXco8v1
// SIG // DyYMUZvTcl3ju2nWK/CvH+kNpzxdL1qhRu3sMGgJeQpS
// SIG // nq87IX4QfM7o1UdHdUWu2dNZZ12IVrj6lWWshZeyR6+o
// SIG // uoboaVOgUOv1YGNHAYpLF+JjTPiEmPNU9UWLe31gEzbv
// SIG // 85IyDXM4qc234OUvt3wgKPIFQevugOS9LwYN/XbBSE7+
// SIG // jFibkPGWcu38JRQWROHeSBW0bnWpDcChncixjNqLWjau
// SIG // 8Jt5Lu8eNVBgJpAwggdxMIIFWaADAgECAhMzAAAAFcXn
// SIG // a54Cm0mZAAAAAAAVMA0GCSqGSIb3DQEBCwUAMIGIMQsw
// SIG // CQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQ
// SIG // MA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9z
// SIG // b2Z0IENvcnBvcmF0aW9uMTIwMAYDVQQDEylNaWNyb3Nv
// SIG // ZnQgUm9vdCBDZXJ0aWZpY2F0ZSBBdXRob3JpdHkgMjAx
// SIG // MDAeFw0yMTA5MzAxODIyMjVaFw0zMDA5MzAxODMyMjVa
// SIG // MHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5n
// SIG // dG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVN
// SIG // aWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMTHU1p
// SIG // Y3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAyMDEwMIICIjAN
// SIG // BgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA5OGmTOe0
// SIG // ciELeaLL1yR5vQ7VgtP97pwHB9KpbE51yMo1V/YBf2xK
// SIG // 4OK9uT4XYDP/XE/HZveVU3Fa4n5KWv64NmeFRiMMtY0T
// SIG // z3cywBAY6GB9alKDRLemjkZrBxTzxXb1hlDcwUTIcVxR
// SIG // MTegCjhuje3XD9gmU3w5YQJ6xKr9cmmvHaus9ja+NSZk
// SIG // 2pg7uhp7M62AW36MEBydUv626GIl3GoPz130/o5Tz9bs
// SIG // hVZN7928jaTjkY+yOSxRnOlwaQ3KNi1wjjHINSi947SH
// SIG // JMPgyY9+tVSP3PoFVZhtaDuaRr3tpK56KTesy+uDRedG
// SIG // bsoy1cCGMFxPLOJiss254o2I5JasAUq7vnGpF1tnYN74
// SIG // kpEeHT39IM9zfUGaRnXNxF803RKJ1v2lIH1+/NmeRd+2
// SIG // ci/bfV+AutuqfjbsNkz2K26oElHovwUDo9Fzpk03dJQc
// SIG // NIIP8BDyt0cY7afomXw/TNuvXsLz1dhzPUNOwTM5TI4C
// SIG // vEJoLhDqhFFG4tG9ahhaYQFzymeiXtcodgLiMxhy16cg
// SIG // 8ML6EgrXY28MyTZki1ugpoMhXV8wdJGUlNi5UPkLiWHz
// SIG // NgY1GIRH29wb0f2y1BzFa/ZcUlFdEtsluq9QBXpsxREd
// SIG // cu+N+VLEhReTwDwV2xo3xwgVGD94q0W29R6HXtqPnhZy
// SIG // acaue7e3PmriLq0CAwEAAaOCAd0wggHZMBIGCSsGAQQB
// SIG // gjcVAQQFAgMBAAEwIwYJKwYBBAGCNxUCBBYEFCqnUv5k
// SIG // xJq+gpE8RjUpzxD/LwTuMB0GA1UdDgQWBBSfpxVdAF5i
// SIG // XYP05dJlpxtTNRnpcjBcBgNVHSAEVTBTMFEGDCsGAQQB
// SIG // gjdMg30BATBBMD8GCCsGAQUFBwIBFjNodHRwOi8vd3d3
// SIG // Lm1pY3Jvc29mdC5jb20vcGtpb3BzL0RvY3MvUmVwb3Np
// SIG // dG9yeS5odG0wEwYDVR0lBAwwCgYIKwYBBQUHAwgwGQYJ
// SIG // KwYBBAGCNxQCBAweCgBTAHUAYgBDAEEwCwYDVR0PBAQD
// SIG // AgGGMA8GA1UdEwEB/wQFMAMBAf8wHwYDVR0jBBgwFoAU
// SIG // 1fZWy4/oolxiaNE9lJBb186aGMQwVgYDVR0fBE8wTTBL
// SIG // oEmgR4ZFaHR0cDovL2NybC5taWNyb3NvZnQuY29tL3Br
// SIG // aS9jcmwvcHJvZHVjdHMvTWljUm9vQ2VyQXV0XzIwMTAt
// SIG // MDYtMjMuY3JsMFoGCCsGAQUFBwEBBE4wTDBKBggrBgEF
// SIG // BQcwAoY+aHR0cDovL3d3dy5taWNyb3NvZnQuY29tL3Br
// SIG // aS9jZXJ0cy9NaWNSb29DZXJBdXRfMjAxMC0wNi0yMy5j
// SIG // cnQwDQYJKoZIhvcNAQELBQADggIBAJ1VffwqreEsH2cB
// SIG // MSRb4Z5yS/ypb+pcFLY+TkdkeLEGk5c9MTO1OdfCcTY/
// SIG // 2mRsfNB1OW27DzHkwo/7bNGhlBgi7ulmZzpTTd2YurYe
// SIG // eNg2LpypglYAA7AFvonoaeC6Ce5732pvvinLbtg/SHUB
// SIG // 2RjebYIM9W0jVOR4U3UkV7ndn/OOPcbzaN9l9qRWqveV
// SIG // tihVJ9AkvUCgvxm2EhIRXT0n4ECWOKz3+SmJw7wXsFSF
// SIG // QrP8DJ6LGYnn8AtqgcKBGUIZUnWKNsIdw2FzLixre24/
// SIG // LAl4FOmRsqlb30mjdAy87JGA0j3mSj5mO0+7hvoyGtmW
// SIG // 9I/2kQH2zsZ0/fZMcm8Qq3UwxTSwethQ/gpY3UA8x1Rt
// SIG // nWN0SCyxTkctwRQEcb9k+SS+c23Kjgm9swFXSVRk2XPX
// SIG // fx5bRAGOWhmRaw2fpCjcZxkoJLo4S5pu+yFUa2pFEUep
// SIG // 8beuyOiJXk+d0tBMdrVXVAmxaQFEfnyhYWxz/gq77EFm
// SIG // PWn9y8FBSX5+k77L+DvktxW/tM4+pTFRhLy/AsGConsX
// SIG // HRWJjXD+57XQKBqJC4822rpM+Zv/Cuk0+CQ1ZyvgDbjm
// SIG // jJnW4SLq8CdCPSWU5nR0W2rRnj7tfqAxM328y+l7vzhw
// SIG // RNGQ8cirOoo6CGJ/2XBjU02N7oJtpQUQwXEGahC0HVUz
// SIG // WLOhcGbyoYICyzCCAjQCAQEwgfihgdCkgc0wgcoxCzAJ
// SIG // BgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAw
// SIG // DgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3Nv
// SIG // ZnQgQ29ycG9yYXRpb24xJTAjBgNVBAsTHE1pY3Jvc29m
// SIG // dCBBbWVyaWNhIE9wZXJhdGlvbnMxJjAkBgNVBAsTHVRo
// SIG // YWxlcyBUU1MgRVNOOkQ2QkQtRTNFNy0xNjg1MSUwIwYD
// SIG // VQQDExxNaWNyb3NvZnQgVGltZS1TdGFtcCBTZXJ2aWNl
// SIG // oiMKAQEwBwYFKw4DAhoDFQDiAEj9CUm7+Udt8MXIkIrx
// SIG // 8nJGKKCBgzCBgKR+MHwxCzAJBgNVBAYTAlVTMRMwEQYD
// SIG // VQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25k
// SIG // MR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24x
// SIG // JjAkBgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBD
// SIG // QSAyMDEwMA0GCSqGSIb3DQEBBQUAAgUA57w/zTAiGA8y
// SIG // MDIzMDMxNTIwNTk1N1oYDzIwMjMwMzE2MjA1OTU3WjB0
// SIG // MDoGCisGAQQBhFkKBAExLDAqMAoCBQDnvD/NAgEAMAcC
// SIG // AQACAgkBMAcCAQACAhHXMAoCBQDnvZFNAgEAMDYGCisG
// SIG // AQQBhFkKBAIxKDAmMAwGCisGAQQBhFkKAwKgCjAIAgEA
// SIG // AgMHoSChCjAIAgEAAgMBhqAwDQYJKoZIhvcNAQEFBQAD
// SIG // gYEAoplZ83G0nsD7e/RdXn/p9OF7wsxNdcMKBZrr8P7h
// SIG // 3r+zIlDeTDdx3lxUpdtsscpudhvoJLfL+yqFTvkFSf2U
// SIG // vdrmfYd4SwOuFG/7exwgGfcuEBDxf+Jmxmct6+VssIOi
// SIG // Vkd8fymE5ANNZSUcFBDfsjri8en6PLhvHXSqosCqB1Qx
// SIG // ggQNMIIECQIBATCBkzB8MQswCQYDVQQGEwJVUzETMBEG
// SIG // A1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9u
// SIG // ZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9u
// SIG // MSYwJAYDVQQDEx1NaWNyb3NvZnQgVGltZS1TdGFtcCBQ
// SIG // Q0EgMjAxMAITMwAAAcf7AKBKW/In3AABAAABxzANBglg
// SIG // hkgBZQMEAgEFAKCCAUowGgYJKoZIhvcNAQkDMQ0GCyqG
// SIG // SIb3DQEJEAEEMC8GCSqGSIb3DQEJBDEiBCDFCMkn02ny
// SIG // eSzQHLkQ3nv/9D5H1XOTbRJpPOwgbX9XuTCB+gYLKoZI
// SIG // hvcNAQkQAi8xgeowgecwgeQwgb0EIEfn5dviUrJFCznl
// SIG // WC23jIJOx3SG0RJgLI8LXMujCZLJMIGYMIGApH4wfDEL
// SIG // MAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24x
// SIG // EDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jv
// SIG // c29mdCBDb3Jwb3JhdGlvbjEmMCQGA1UEAxMdTWljcm9z
// SIG // b2Z0IFRpbWUtU3RhbXAgUENBIDIwMTACEzMAAAHH+wCg
// SIG // SlvyJ9wAAQAAAccwIgQg3nadB6UNUpTLqfH1PCasSh5V
// SIG // 14rpoHngPXMKqSTxKQ0wDQYJKoZIhvcNAQELBQAEggIA
// SIG // V9s/TABRZ+JhC9ffBwDFjCYJqDnuPoSZzG63NpxKNhlb
// SIG // I1Qy8ZSXBieIjpqNHcrEWESGuBKE0qaQG0aymXIEjd0b
// SIG // 0bzdEAH68UBg5U86VngknKfoQTwch6YxuZMJVQldHdCy
// SIG // GLxy8ZvP0mZzKkbRXDZmy49eDjBXzZAhvfOZuJBlwj+8
// SIG // iBi2hVfAYQU5ehttReFt8ndlqW6W3Joashpge+Yjcido
// SIG // pkEUHT5G6DAcqKk5vKz1ygR2txezRZhjFSWPZDJkWymi
// SIG // +uXS+s8OO2Ydme+ikyqRdQcZS9rNq8CjrfimetF5H4RG
// SIG // PzB5hKowWLWI9+rg0Ke6orhSTUrfoZe6THv8Q/U/+e2w
// SIG // +5P2NBWtE/UVR+0lE4YMp/9PptA476gYDTLi+3XzCPke
// SIG // 2fQnF29FKYw2idG5hsHQGz608X1Uz6ppb9ovBMibPona
// SIG // uhz+MEczNH2lWHGQU/qdns4fq4dgyOuokaF9U7RdBXtS
// SIG // Oi+kKXVEf9z9kI8lG4Q6YIOqEgTenruA/LnZiA0xoG6i
// SIG // jcO9FqzdiKS/fKNVqlWcklg1n0TOSePK/eiWHRQbXhGB
// SIG // M1fSrzL5ibm7bt2lkNhA9AJPWroldKyKfBf0GdZEn8/r
// SIG // QR+JLBSbIKToaRfBcb6BJ/nrg3+k5BUv3JM8yIplDkY2
// SIG // KBqCkKxcQFlA+qZM8FoTcxc=
// SIG // End signature block
