"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
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
exports.ArduinoDebugConfigurationProvider = void 0;
const path = require("path");
const vscode = require("vscode");
const arduino_1 = require("../arduino/arduino");
const arduinoActivator_1 = require("../arduinoActivator");
const arduinoContext_1 = require("../arduinoContext");
const vscodeSettings_1 = require("../arduino/vscodeSettings");
const constants = require("../common/constants");
const platform = require("../common/platform");
const util = require("../common/util");
const workspace_1 = require("../common/workspace");
const deviceContext_1 = require("../deviceContext");
const Logger = require("../logger/logger");
class ArduinoDebugConfigurationProvider {
    constructor() { }
    provideDebugConfigurations(folder, token) {
        return [
            this.getDefaultDebugSettings(folder),
        ];
    }
    // Try to add all missing attributes to the debug configuration being launched.
    resolveDebugConfiguration(folder, config, token) {
        if (!config || !config.request) {
            config = this.getDefaultDebugSettings(folder);
        }
        return this.resolveDebugConfigurationAsync(config);
    }
    getDefaultDebugSettings(folder) {
        return {
            name: "Arduino",
            type: "arduino",
            request: "launch",
            program: "${file}",
            cwd: "${workspaceFolder}",
            MIMode: "gdb",
            targetArchitecture: "arm",
            miDebuggerPath: "",
            debugServerPath: "",
            debugServerArgs: "",
            customLaunchSetupCommands: [
                {
                    text: "target remote localhost:3333",
                },
                {
                    text: "file \"${file}\"",
                },
                {
                    text: "load",
                },
                {
                    text: "monitor reset halt",
                },
                {
                    text: "monitor reset init",
                },
            ],
            stopAtEntry: true,
            serverStarted: "Info\\ :\\ [\\w\\d\\.]*:\\ hardware",
            launchCompleteCommand: "exec-continue",
            filterStderr: true,
            args: [],
        };
    }
    resolveDebugConfigurationAsync(config) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!arduinoContext_1.default.initialized) {
                yield arduinoActivator_1.default.activate();
            }
            if (vscodeSettings_1.VscodeSettings.getInstance().logLevel === constants.LogLevel.Verbose && !config.logging) {
                config = Object.assign(Object.assign({}, config), { logging: {
                        engineLogging: true,
                    } });
            }
            if (!arduinoContext_1.default.boardManager.currentBoard) {
                vscode.window.showErrorMessage("Please select a board.");
                return undefined;
            }
            if (!this.resolveOpenOcd(config)) {
                return undefined;
            }
            if (!(yield this.resolveOpenOcdOptions(config))) {
                return undefined;
            }
            if (!this.resolveDebuggerPath(config)) {
                return undefined;
            }
            if (!(yield this.resolveProgramPath(config))) {
                return undefined;
            }
            // Use the C++ debugger MIEngine as the real internal debugger
            config.type = "cppdbg";
            const dc = deviceContext_1.DeviceContext.getInstance();
            Logger.traceUserData("start-cppdbg", { board: dc.board });
            return config;
        });
    }
    resolveProgramPath(config) {
        return __awaiter(this, void 0, void 0, function* () {
            const dc = deviceContext_1.DeviceContext.getInstance();
            if (!config.program || config.program === "${file}") {
                const outputFolder = path.join(dc.output || `.build`);
                const outputPath = path.join(workspace_1.ArduinoWorkspace.rootPath, outputFolder);
                // if the directory was already there, clear the folder so that it's not corrupted from previous builds.
                if (util.directoryExistsSync(outputPath)) {
                    util.rmdirRecursivelySync(outputPath);
                }
                util.mkdirRecursivelySync(outputPath);
                if (!dc.sketch || !util.fileExistsSync(path.join(workspace_1.ArduinoWorkspace.rootPath, dc.sketch))) {
                    yield dc.resolveMainSketch();
                }
                if (!dc.sketch) {
                    vscode.window.showErrorMessage("No sketch file was found. Please specify the sketch in the arduino.json file");
                    return false;
                }
                if (!util.fileExistsSync(path.join(workspace_1.ArduinoWorkspace.rootPath, dc.sketch))) {
                    vscode.window.showErrorMessage(`Cannot find ${dc.sketch}, Please specify the sketch in the arduino.json file`);
                    return false;
                }
                config.program = path.join(outputPath, `${path.basename(dc.sketch)}.elf`);
                // always compile elf to make sure debug the right elf
                if (!(yield arduinoContext_1.default.arduinoApp.build(arduino_1.BuildMode.Verify, outputFolder))) {
                    vscode.window.showErrorMessage("Failed to verify the program, please check the output for details.");
                    return false;
                }
                config.program = config.program.replace(/\\/g, "/");
                config.customLaunchSetupCommands.forEach((obj) => {
                    if (obj.text && obj.text.indexOf("${file}") > 0) {
                        obj.text = obj.text.replace(/\$\{file\}/, config.program);
                    }
                });
            }
            if (!util.fileExistsSync(config.program)) {
                vscode.window.showErrorMessage("Cannot find the elf file.");
                return false;
            }
            return true;
        });
    }
    resolveDebuggerPath(config) {
        if (!config.miDebuggerPath) {
            config.miDebuggerPath = platform.findFile(platform.getExecutableFileName("arm-none-eabi-gdb"), path.join(arduinoContext_1.default.arduinoApp.settings.packagePath, "packages", arduinoContext_1.default.boardManager.currentBoard.getPackageName()));
        }
        if (!util.fileExistsSync(config.miDebuggerPath)) {
            config.miDebuggerPath = arduinoContext_1.default.debuggerManager.miDebuggerPath;
        }
        if (!util.fileExistsSync(config.miDebuggerPath)) {
            vscode.window.showErrorMessage("Cannot find the debugger path.");
            return false;
        }
        return true;
    }
    resolveOpenOcd(config) {
        if (!config.debugServerPath) {
            config.debugServerPath = platform.findFile(platform.getExecutableFileName("openocd"), path.join(arduinoContext_1.default.arduinoApp.settings.packagePath, "packages", arduinoContext_1.default.boardManager.currentBoard.getPackageName()));
        }
        if (!util.fileExistsSync(config.debugServerPath)) {
            config.debugServerPath = arduinoContext_1.default.debuggerManager.debugServerPath;
        }
        if (!util.fileExistsSync(config.debugServerPath)) {
            vscode.window.showErrorMessage("Cannot find the OpenOCD from the launch.json debugServerPath property." +
                "Please input the right path of OpenOCD");
            return false;
        }
        return true;
    }
    resolveOpenOcdOptions(config) {
        return __awaiter(this, void 0, void 0, function* () {
            if (config.debugServerPath && !config.debugServerArgs) {
                try {
                    config.debugServerArgs = yield arduinoContext_1.default.debuggerManager.resolveOpenOcdOptions(config);
                    if (!config.debugServerArgs) {
                        return false;
                    }
                }
                catch (error) {
                    vscode.window.showErrorMessage(error.message);
                    return false;
                }
            }
            return true;
        });
    }
}
exports.ArduinoDebugConfigurationProvider = ArduinoDebugConfigurationProvider;

//# sourceMappingURL=configurationProvider.js.map

// SIG // Begin signature block
// SIG // MIInyAYJKoZIhvcNAQcCoIInuTCCJ7UCAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // R6pSSLTnyOCklKhqN2t3vOfagJMAJJxZEo3ZDQslXsKg
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
// SIG // SEXAQsmbdlsKgEhr/Xmfwb1tbWrJUnMTDXpQzTGCGZ8w
// SIG // ghmbAgEBMIGVMH4xCzAJBgNVBAYTAlVTMRMwEQYDVQQI
// SIG // EwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4w
// SIG // HAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xKDAm
// SIG // BgNVBAMTH01pY3Jvc29mdCBDb2RlIFNpZ25pbmcgUENB
// SIG // IDIwMTECEzMAAALMjrWWpr3RyU4AAAAAAswwDQYJYIZI
// SIG // AWUDBAIBBQCgga4wGQYJKoZIhvcNAQkDMQwGCisGAQQB
// SIG // gjcCAQQwHAYKKwYBBAGCNwIBCzEOMAwGCisGAQQBgjcC
// SIG // ARUwLwYJKoZIhvcNAQkEMSIEIDoA30PDTLu9TPUzKiMn
// SIG // dIsXk+8tpz01Gdaz4gTXHuCHMEIGCisGAQQBgjcCAQwx
// SIG // NDAyoBSAEgBNAGkAYwByAG8AcwBvAGYAdKEagBhodHRw
// SIG // Oi8vd3d3Lm1pY3Jvc29mdC5jb20wDQYJKoZIhvcNAQEB
// SIG // BQAEggEAR6gbr+tUcUZK9Wh7dxREgdFTcgWam/SSqSeQ
// SIG // P9sMpaKJXwKAYUUwOK4Zcf6lknjBya5C5orSLTWq25Wx
// SIG // C1w28yx72jE/g2YeBoyGTnWU9JKQLUm4UWBSzNNCdnZ4
// SIG // pzOQFWzFs/8d1v4uzOZieQikuvvyL05ZgXTAHqBbYBUT
// SIG // jWIgmNtGfTllqdZjqHGU54nG75IUnprxESQjk0VecTKk
// SIG // Xs7CzgGXGBimjePXrSzfktgWpIuyGB83bKRR9m4uWraQ
// SIG // g601+06TLKWLRnp5JjVtrwNwxdSyYIMVRFL8iySiFZbO
// SIG // H3y6Nu7z/vPFD+Vj9hADjMDK8ypYIIWrcqxM3eefgKGC
// SIG // FykwghclBgorBgEEAYI3AwMBMYIXFTCCFxEGCSqGSIb3
// SIG // DQEHAqCCFwIwghb+AgEDMQ8wDQYJYIZIAWUDBAIBBQAw
// SIG // ggFZBgsqhkiG9w0BCRABBKCCAUgEggFEMIIBQAIBAQYK
// SIG // KwYBBAGEWQoDATAxMA0GCWCGSAFlAwQCAQUABCCvDKxO
// SIG // arpMp4BK7fQZ4ilV1p+iEn2o1KEr7mOFKefhegIGY8fd
// SIG // APYSGBMyMDIzMDEyNTAxMzAyOC42MjRaMASAAgH0oIHY
// SIG // pIHVMIHSMQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2Fz
// SIG // aGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UE
// SIG // ChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMS0wKwYDVQQL
// SIG // EyRNaWNyb3NvZnQgSXJlbGFuZCBPcGVyYXRpb25zIExp
// SIG // bWl0ZWQxJjAkBgNVBAsTHVRoYWxlcyBUU1MgRVNOOjhE
// SIG // NDEtNEJGNy1CM0I3MSUwIwYDVQQDExxNaWNyb3NvZnQg
// SIG // VGltZS1TdGFtcCBTZXJ2aWNloIIReDCCBycwggUPoAMC
// SIG // AQICEzMAAAGz/iXOKRsbihwAAQAAAbMwDQYJKoZIhvcN
// SIG // AQELBQAwfDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldh
// SIG // c2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNV
// SIG // BAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEmMCQGA1UE
// SIG // AxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTAw
// SIG // HhcNMjIwOTIwMjAyMjAzWhcNMjMxMjE0MjAyMjAzWjCB
// SIG // 0jELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0
// SIG // b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1p
// SIG // Y3Jvc29mdCBDb3Jwb3JhdGlvbjEtMCsGA1UECxMkTWlj
// SIG // cm9zb2Z0IElyZWxhbmQgT3BlcmF0aW9ucyBMaW1pdGVk
// SIG // MSYwJAYDVQQLEx1UaGFsZXMgVFNTIEVTTjo4RDQxLTRC
// SIG // RjctQjNCNzElMCMGA1UEAxMcTWljcm9zb2Z0IFRpbWUt
// SIG // U3RhbXAgU2VydmljZTCCAiIwDQYJKoZIhvcNAQEBBQAD
// SIG // ggIPADCCAgoCggIBALR8D7rmGICuLLBggrK9je3hJSpc
// SIG // 9CTwbra/4Kb2eu5DZR6oCgFtCbigMuMcY31QlHr/3kuW
// SIG // hHJ05n4+t377PHondDDbz/dU+q/NfXSKr1pwU2OLylY0
// SIG // sw531VZ1sWAdyD2EQCEzTdLD4KJbC6wmAConiJBAqvhD
// SIG // yXxJ0Nuvlk74rdVEvribsDZxzClWEa4v62ENj/HyiCUX
// SIG // 3MZGnY/AhDyazfpchDWoP6cJgNCSXmHV9XsJgXJ4l+AY
// SIG // AgaqAvN8N+EpN+0TErCgFOfwZV21cg7vgenOV48gmG/E
// SIG // Mf0LvRAeirxPUu+jNB3JSFbW1WU8Z5xsLEoNle35icdE
// SIG // T+G3wDNmcSXlQYs4t94IWR541+PsUTkq0kmdP4/1O4GD
// SIG // 54ZsJ5eUnLaawXOxxT1fgbWb9VRg1Z4aspWpuL5gFwHa
// SIG // 8UNMRxsKffor6qrXVVQ1OdJOS1JlevhpZlssSCVDodMc
// SIG // 30I3fWezny6tNOofpfaPrtwJ0ukXcLD1yT+89u4uQB/r
// SIG // qUK6J7HpkNu0fR5M5xGtOch9nyncO9alorxDfiEdb6ze
// SIG // qtCfcbo46u+/rfsslcGSuJFzlwENnU+vQ+JJ6jJRUrB+
// SIG // mr51zWUMiWTLDVmhLd66//Da/YBjA0Bi0hcYuO/WctfW
// SIG // k/3x87ALbtqHAbk6i1cJ8a2coieuj+9BASSjuXkBAgMB
// SIG // AAGjggFJMIIBRTAdBgNVHQ4EFgQU0BpdwlFnUgwYizhI
// SIG // If9eBdyfw40wHwYDVR0jBBgwFoAUn6cVXQBeYl2D9OXS
// SIG // ZacbUzUZ6XIwXwYDVR0fBFgwVjBUoFKgUIZOaHR0cDov
// SIG // L3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9jcmwvTWlj
// SIG // cm9zb2Z0JTIwVGltZS1TdGFtcCUyMFBDQSUyMDIwMTAo
// SIG // MSkuY3JsMGwGCCsGAQUFBwEBBGAwXjBcBggrBgEFBQcw
// SIG // AoZQaHR0cDovL3d3dy5taWNyb3NvZnQuY29tL3BraW9w
// SIG // cy9jZXJ0cy9NaWNyb3NvZnQlMjBUaW1lLVN0YW1wJTIw
// SIG // UENBJTIwMjAxMCgxKS5jcnQwDAYDVR0TAQH/BAIwADAW
// SIG // BgNVHSUBAf8EDDAKBggrBgEFBQcDCDAOBgNVHQ8BAf8E
// SIG // BAMCB4AwDQYJKoZIhvcNAQELBQADggIBAFqGuzfOsAm4
// SIG // wAJfERmJgWW0tNLLPk6VYj53+hBmUICsqGgj9oXNNatg
// SIG // Cq+jHt03EiTzVhxteKWOLoTMx39cCcUJgDOQIH+Gjuyj
// SIG // YVVdOCa9Fx6lI690/OBZFlz2DDuLpUBuo//v3e4Kns41
// SIG // 2mO3A6mDQkndxeJSsdBSbkKqccB7TC/muFOhzg39mfij
// SIG // GICc1kZziJE/6HdKCF8p9+vs1yGUR5uzkIo+68q/n5kN
// SIG // t33hdaQ234VEh0wPSE+dCgpKRqfxgYsBT/5tXa3e8TXy
// SIG // JlVoG9jwXBrKnSQb4+k19jHVB3wVUflnuANJRI9azWwq
// SIG // YFKDbZWkfQ8tpNoFfKKFRHbWomcodP1bVn7kKWUCTA8Y
// SIG // G2RlTBtvrs3CqY3mADTJUig4ckN/MG6AIr8Q+ACmKBEm
// SIG // 4OFpOcZMX0cxasopdgxM9aSdBusaJfZ3Itl3vC5C3RE9
// SIG // 7uURsVB2pvC+CnjFtt/PkY71l9UTHzUCO++M4hSGSzkf
// SIG // u+yBhXMGeBZqLXl9cffgYPcnRFjQT97Gb/bg4ssLIFuN
// SIG // JNNAJub+IvxhomRrtWuB4SN935oMfvG5cEeZ7eyYpBZ4
// SIG // DbkvN44ZvER0EHRakL2xb1rrsj7c8I+auEqYztUpDnuq
// SIG // 6BxpBIUAlF3UDJ0SMG5xqW/9hLMWnaJCvIerEWTFm64j
// SIG // thAi0BDMwnCwMIIHcTCCBVmgAwIBAgITMwAAABXF52ue
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
// SIG // oXBm8qGCAtQwggI9AgEBMIIBAKGB2KSB1TCB0jELMAkG
// SIG // A1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAO
// SIG // BgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29m
// SIG // dCBDb3Jwb3JhdGlvbjEtMCsGA1UECxMkTWljcm9zb2Z0
// SIG // IElyZWxhbmQgT3BlcmF0aW9ucyBMaW1pdGVkMSYwJAYD
// SIG // VQQLEx1UaGFsZXMgVFNTIEVTTjo4RDQxLTRCRjctQjNC
// SIG // NzElMCMGA1UEAxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAg
// SIG // U2VydmljZaIjCgEBMAcGBSsOAwIaAxUAcYtE6JbdHhKl
// SIG // wkJeKoCV1JIkDmGggYMwgYCkfjB8MQswCQYDVQQGEwJV
// SIG // UzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMH
// SIG // UmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBv
// SIG // cmF0aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQgVGltZS1T
// SIG // dGFtcCBQQ0EgMjAxMDANBgkqhkiG9w0BAQUFAAIFAOd6
// SIG // 7QowIhgPMjAyMzAxMjUwNzQ5MzBaGA8yMDIzMDEyNjA3
// SIG // NDkzMFowdDA6BgorBgEEAYRZCgQBMSwwKjAKAgUA53rt
// SIG // CgIBADAHAgEAAgICATAHAgEAAgIRYDAKAgUA53w+igIB
// SIG // ADA2BgorBgEEAYRZCgQCMSgwJjAMBgorBgEEAYRZCgMC
// SIG // oAowCAIBAAIDB6EgoQowCAIBAAIDAYagMA0GCSqGSIb3
// SIG // DQEBBQUAA4GBACYKzEtuELRkT4pW04rWSum0PlSn46lV
// SIG // wu/B8BC9zByYAKFFAifWfCMYbEyQa1LSkwJut9HBwjrm
// SIG // T6uMbDhcihaV9+woFjivsjdyMZJ09E0QjF3yUYlqMaTu
// SIG // YCmjgGKWZoQabx1sJEaF3cAdOzSxoiphckcAvbhNLlaV
// SIG // 5mjXrwguMYIEDTCCBAkCAQEwgZMwfDELMAkGA1UEBhMC
// SIG // VVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcT
// SIG // B1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jw
// SIG // b3JhdGlvbjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUt
// SIG // U3RhbXAgUENBIDIwMTACEzMAAAGz/iXOKRsbihwAAQAA
// SIG // AbMwDQYJYIZIAWUDBAIBBQCgggFKMBoGCSqGSIb3DQEJ
// SIG // AzENBgsqhkiG9w0BCRABBDAvBgkqhkiG9w0BCQQxIgQg
// SIG // oQHK6k+qXUtO5B1t9Z/OU1KbYX/5IFLziX+GkLJoEjMw
// SIG // gfoGCyqGSIb3DQEJEAIvMYHqMIHnMIHkMIG9BCCGoTPV
// SIG // KhDSB7ZG0zJQZUM2jk/ll1zJGh6KOhn76k+/QjCBmDCB
// SIG // gKR+MHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNo
// SIG // aW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQK
// SIG // ExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMT
// SIG // HU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAyMDEwAhMz
// SIG // AAABs/4lzikbG4ocAAEAAAGzMCIEIMG4ycxxfCE3OrJq
// SIG // SFqpFNCBTvaAXUiS9kEd8Y80Y2/JMA0GCSqGSIb3DQEB
// SIG // CwUABIICADTjPXDLcOWFKOrjB8rcgbb5Spn5QrsexxUC
// SIG // a05xVkB79fybaz0QgJyJk0yMtYpe5frNY8QsCqfYkS66
// SIG // ii5cwgrb7oW/+Tue5ARXkohgKxFx6YgdzZucmuYlcwD3
// SIG // LQqS1XOSEKkTRP+OqDGUcMFRs5fVRMGutQMz4Fhch4Ye
// SIG // Wn14Nuu95rRNIpnK9HeaKbf5P9UFOWOZqc6fecPMOSqB
// SIG // bs4n2Tmvs6RMwFt+ytddrZfHfSuN2o9IuMAXHKQRH1IT
// SIG // ZXD8fyxhxFSugaV6+NlpbuO2z7Xqos8uMBotzqDziZSL
// SIG // PhlHLmWYgCxeuVa2CvtqtN2Ma/E0n2hZZmdSLVLotjyS
// SIG // z6ANDeZlB0GH9YjeZqYYLkgoKPPXKrbw04hn2LScI1cs
// SIG // HllratD2pGiogFydv+HoSjMKLNWlUPRfqZlV1m5WkMh2
// SIG // GbKTXc62ebb4YVw0KjU53U0fnHgG6pgdllC87aIJndXp
// SIG // W7a1g8DD7p9YzvDrtvgQ2xAoBtpvjoLQ3ouayVHdCEpb
// SIG // 0zGve2yZ1Q5ZaXT+ZYc11xw+iEBmvMj/mJiIbcBlFVi0
// SIG // 9Kp1pMJu8vzZyzKLVqRswO5E9/+XQ6Aak5Wh0COJzWr3
// SIG // vCPcSSzv8V8Txk21a86DsxuM92RbCPTP+tMwexPZ3u+X
// SIG // Gt7w1lwIgkl3ncMyQU2ixnU/WR8rxHma
// SIG // End signature block
