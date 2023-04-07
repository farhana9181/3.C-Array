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
exports.DeviceContext = void 0;
const fs = require("fs");
const path = require("path");
const vscode = require("vscode");
const constants = require("./common/constants");
const util = require("./common/util");
const constants_1 = require("./common/constants");
const workspace_1 = require("./common/workspace");
const deviceSettings_1 = require("./deviceSettings");
class DeviceContext {
    /**
     * @constructor
     */
    constructor() {
        this._settings = new deviceSettings_1.DeviceSettings();
        this._suppressSaveContext = false;
        if (vscode.workspace && workspace_1.ArduinoWorkspace.rootPath) {
            this._watcher = vscode.workspace.createFileSystemWatcher(path.join(workspace_1.ArduinoWorkspace.rootPath, constants_1.ARDUINO_CONFIG_FILE));
            // We only care about the deletion arduino.json in the .vscode folder:
            this._vscodeWatcher = vscode.workspace.createFileSystemWatcher(path.join(workspace_1.ArduinoWorkspace.rootPath, ".vscode"), true, true, false);
            this._watcher.onDidCreate(() => this.loadContext());
            this._watcher.onDidChange(() => this.loadContext());
            this._watcher.onDidDelete(() => this.loadContext());
            this._vscodeWatcher.onDidDelete(() => this.loadContext());
            this._sketchStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, constants.statusBarPriority.SKETCH);
            this._sketchStatusBar.command = "arduino.selectSketch";
            this._sketchStatusBar.tooltip = "Sketch File";
        }
    }
    static getInstance() {
        return DeviceContext._deviceContext;
    }
    dispose() {
        if (this._watcher) {
            this._watcher.dispose();
        }
        if (this._vscodeWatcher) {
            this._vscodeWatcher.dispose();
        }
    }
    get extensionPath() {
        return this._extensionPath;
    }
    set extensionPath(value) {
        this._extensionPath = value;
    }
    /**
     * TODO: Current we use the Arduino default settings. For future release, this dependency might be removed
     * and the setting only depends on device.json.
     * @method
     *
     * TODO EW, 2020-02-18:
     * A problem I discovered: here you try to find the config file location
     * and when you're writing below, you use a hard-coded location. When
     * resorting to "find", you have to store the file's location at least and
     * reuse it when saving.
     * But I think the intention is: load a config file from anywhere and save
     * it under .vscode/arduino.json. But then the initial load has to use find
     * and afterwards it must not use find anymore.
     */
    loadContext() {
        return vscode.workspace.findFiles(constants_1.ARDUINO_CONFIG_FILE, null, 1)
            .then((files) => {
            if (files && files.length > 0) {
                this._settings.load(files[0].fsPath);
                // on invalid configuration we continue with current settings
            }
            else {
                // No configuration file found, starting over with defaults
                this._settings.reset();
            }
            return this;
        }, (reason) => {
            // Workaround for change in API.
            // vscode.workspace.findFiles() for some reason now throws an error ehn path does not exist
            // vscode.window.showErrorMessage(reason.toString());
            // Logger.notifyUserError("arduinoFileUnhandleError", new Error(reason.toString()));
            // Workaround for change in API, populate required props for arduino.json
            this._settings.reset();
            return this;
        });
    }
    showStatusBar() {
        if (!this._settings.sketch.value) {
            return false;
        }
        this._sketchStatusBar.text = this._settings.sketch.value;
        this._sketchStatusBar.show();
    }
    get onChangePort() { return this._settings.port.emitter.event; }
    get onChangeBoard() { return this._settings.board.emitter.event; }
    get onChangeSketch() { return this._settings.sketch.emitter.event; }
    get onChangeOutput() { return this._settings.output.emitter.event; }
    get onChangeDebugger() { return this._settings.debugger.emitter.event; }
    get onChangeISAutoGen() { return this._settings.intelliSenseGen.emitter.event; }
    get onChangeConfiguration() { return this._settings.configuration.emitter.event; }
    get onChangePrebuild() { return this._settings.prebuild.emitter.event; }
    get onChangePostbuild() { return this._settings.postbuild.emitter.event; }
    get onChangeProgrammer() { return this._settings.programmer.emitter.event; }
    get port() {
        return this._settings.port.value;
    }
    set port(value) {
        this._settings.port.value = value;
        this.saveContext();
    }
    get board() {
        return this._settings.board.value;
    }
    set board(value) {
        this._settings.board.value = value;
        this.saveContext();
    }
    get sketch() {
        return this._settings.sketch.value;
    }
    set sketch(value) {
        this._settings.sketch.value = value;
        this.saveContext();
    }
    get prebuild() {
        return this._settings.prebuild.value;
    }
    get postbuild() {
        return this._settings.postbuild.value;
    }
    get output() {
        return this._settings.output.value;
    }
    set output(value) {
        this._settings.output.value = value;
        this.saveContext();
    }
    get debugger_() {
        return this._settings.debugger.value;
    }
    set debugger_(value) {
        this._settings.debugger.value = value;
        this.saveContext();
    }
    get intelliSenseGen() {
        return this._settings.intelliSenseGen.value;
    }
    set intelliSenseGen(value) {
        this._settings.intelliSenseGen.value = value;
        this.saveContext();
    }
    get configuration() {
        return this._settings.configuration.value;
    }
    set configuration(value) {
        this._settings.configuration.value = value;
        this.saveContext();
    }
    get programmer() {
        return this._settings.programmer.value;
    }
    set programmer(value) {
        this._settings.programmer.value = value;
        this.saveContext();
    }
    get suppressSaveContext() {
        return this._suppressSaveContext;
    }
    set suppressSaveContext(value) {
        this._suppressSaveContext = value;
    }
    get buildPreferences() {
        return this._settings.buildPreferences.value;
    }
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            if (workspace_1.ArduinoWorkspace.rootPath && util.fileExistsSync(path.join(workspace_1.ArduinoWorkspace.rootPath, constants_1.ARDUINO_CONFIG_FILE))) {
                vscode.window.showInformationMessage("Arduino.json already generated.");
                return;
            }
            else {
                if (!workspace_1.ArduinoWorkspace.rootPath) {
                    vscode.window.showInformationMessage("Please open a folder first.");
                    return;
                }
                yield this.resolveMainSketch();
                if (this.sketch) {
                    yield vscode.commands.executeCommand("arduino.changeBoardType");
                    vscode.window.showInformationMessage("The workspace is initialized with the Arduino extension support.");
                }
                else {
                    vscode.window.showInformationMessage("No sketch (*.ino or *.cpp) was found or selected - initialization skipped.");
                }
            }
        });
    }
    /**
     * Note: We're using the class' setter for the sketch (i.e. this.sketch = ...)
     * to make sure that any changes are synched to the configuration file.
     */
    resolveMainSketch() {
        return __awaiter(this, void 0, void 0, function* () {
            // TODO (EW, 2020-02-18): Here you look for *.ino files but below you allow
            //  *.cpp/*.c files to be set as sketch
            yield vscode.workspace.findFiles("**/*.ino", null)
                .then((fileUris) => __awaiter(this, void 0, void 0, function* () {
                if (fileUris.length === 0) {
                    let newSketchFileName = yield vscode.window.showInputBox({
                        value: "sketch.ino",
                        prompt: "No sketch (*.ino) found in workspace, please provide a name",
                        placeHolder: "Sketch file name (*.ino or *.cpp)",
                        validateInput: (value) => {
                            if (value && /^[\w-]+\.(?:ino|cpp)$/.test(value.trim())) {
                                return null;
                            }
                            else {
                                return "Invalid sketch file name. Should be *.ino/*.cpp";
                            }
                        },
                    });
                    newSketchFileName = (newSketchFileName && newSketchFileName.trim()) || "";
                    if (newSketchFileName) {
                        const snippets = fs.readFileSync(path.join(this.extensionPath, "snippets", "sample.ino"));
                        fs.writeFileSync(path.join(workspace_1.ArduinoWorkspace.rootPath, newSketchFileName), snippets);
                        this.sketch = newSketchFileName;
                        // Set a build directory in new configurations to avoid warnings about slow builds.
                        this.output = "build";
                        // Open the new sketch file.
                        const textDocument = yield vscode.workspace.openTextDocument(path.join(workspace_1.ArduinoWorkspace.rootPath, newSketchFileName));
                        vscode.window.showTextDocument(textDocument, vscode.ViewColumn.One, true);
                    }
                    else {
                        this.sketch = undefined;
                    }
                }
                else if (fileUris.length === 1) {
                    this.sketch = path.relative(workspace_1.ArduinoWorkspace.rootPath, fileUris[0].fsPath);
                }
                else if (fileUris.length > 1) {
                    const chosen = yield vscode.window.showQuickPick(fileUris.map((fileUri) => {
                        return {
                            label: path.relative(workspace_1.ArduinoWorkspace.rootPath, fileUri.fsPath),
                            description: fileUri.fsPath,
                        };
                    }), { placeHolder: "Select the main sketch file" });
                    if (chosen && chosen.label) {
                        this.sketch = chosen.label;
                    }
                }
            }));
            return this.sketch;
        });
    }
    saveContext() {
        if (!workspace_1.ArduinoWorkspace.rootPath) {
            return;
        }
        const deviceConfigFile = path.join(workspace_1.ArduinoWorkspace.rootPath, constants_1.ARDUINO_CONFIG_FILE);
        this._settings.save(deviceConfigFile);
    }
}
exports.DeviceContext = DeviceContext;
DeviceContext._deviceContext = new DeviceContext();

//# sourceMappingURL=deviceContext.js.map

// SIG // Begin signature block
// SIG // MIInyAYJKoZIhvcNAQcCoIInuTCCJ7UCAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // 4CjRt6xPbwlUccu2uwMKOa8YXmM1lVplcqIsoBxWviWg
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
// SIG // ARUwLwYJKoZIhvcNAQkEMSIEIJ5KRC9SaQsJNrnNRdCS
// SIG // iZC02abKIuMhgO9wkmcYC3VfMEIGCisGAQQBgjcCAQwx
// SIG // NDAyoBSAEgBNAGkAYwByAG8AcwBvAGYAdKEagBhodHRw
// SIG // Oi8vd3d3Lm1pY3Jvc29mdC5jb20wDQYJKoZIhvcNAQEB
// SIG // BQAEggEAVMnVEXlo7bNr7X7WUCeslshHVUKRTVlaRHWH
// SIG // jn9h8gLcjR9BTbqqSKAFbtBKP7ZhJqB28L2elJVcq22G
// SIG // WlAsPxGMjLXt3jfVWovgbQA8mvzsFt2/t8CQAvhdBIxU
// SIG // PIHVVqPmEyp95noCS5Dht3DmKntAGW6MMoPDLILg7Yec
// SIG // /YgFROakAYy2U2PKxS9YVD8AbDJ7eg6T2aS1+TDE5a7c
// SIG // FUG/WIpLLKl11V5Kw7tgrIk6FT+91bY3KkgOTwHagy/b
// SIG // jAFqbnhBW2ncXd6MTPPSMIxenWvdPVP/VSPB+CruFf4b
// SIG // q+IDNO3DkUWI3NALqOoU/Xf3hgHSgLi1zHye/OTyNKGC
// SIG // FykwghclBgorBgEEAYI3AwMBMYIXFTCCFxEGCSqGSIb3
// SIG // DQEHAqCCFwIwghb+AgEDMQ8wDQYJYIZIAWUDBAIBBQAw
// SIG // ggFZBgsqhkiG9w0BCRABBKCCAUgEggFEMIIBQAIBAQYK
// SIG // KwYBBAGEWQoDATAxMA0GCWCGSAFlAwQCAQUABCA9vv01
// SIG // DZH8c6YFUvkkY8FU/1VfwhbH1Bm0HwgmK1kc2wIGY8fd
// SIG // APXxGBMyMDIzMDEyNTAxMzAyOC4xMTJaMASAAgH0oIHY
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
// SIG // PAou4Anzt72bYfipFOWiSCAH1WQ4vM7rDa23BNvtd3Yw
// SIG // gfoGCyqGSIb3DQEJEAIvMYHqMIHnMIHkMIG9BCCGoTPV
// SIG // KhDSB7ZG0zJQZUM2jk/ll1zJGh6KOhn76k+/QjCBmDCB
// SIG // gKR+MHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNo
// SIG // aW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQK
// SIG // ExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMT
// SIG // HU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAyMDEwAhMz
// SIG // AAABs/4lzikbG4ocAAEAAAGzMCIEIMG4ycxxfCE3OrJq
// SIG // SFqpFNCBTvaAXUiS9kEd8Y80Y2/JMA0GCSqGSIb3DQEB
// SIG // CwUABIICAKxJECzmkUqQQSi7cOJpcv4RbasgDW2y/XyJ
// SIG // Q3rgyviHlBNYBQmE3iOcukN5epDfC0jy/Fx4lsul7Ej7
// SIG // RgP6n2uRhnF2eNrP4Xfq2gm1VI9G/cf7ROJfzMzpmjbt
// SIG // vEE8T5b+6AK+R/yy/L0M9zrc6IIkRSYFmIfTlEbc7aEI
// SIG // 49d9auXZ+08WY4GFxeTH57h6W0EDwRYhs8oml1RNKTXt
// SIG // szidoy1PPIoJe0c8LlGvESVeK2ZBuUGhS+3FqbrmE6Zf
// SIG // X8BY5jbHOnYWdLvORBiE7Upz/GyoYGFiTHeF33d+xHuF
// SIG // PBPE8zrz0OTJs+ocCN8Z2oEFTTxnKybjJYykhduQHAwa
// SIG // RON6LFgYxMdZC58UGsflOV2hY/Mjr3z3YnqUmi0y29Am
// SIG // px8H2W+Wvd15fJ5e9c23KORwY2LWMQYnu0GvzCYxnnXc
// SIG // 8X1h1ZC2cjQqGDntb9fJWBdERHeO2lkBw+1jMo5X4FdR
// SIG // rOifAlWibzeIEv1wiQlrWT01gs9Kiu43A+QRcJkdZUrT
// SIG // WTaO91PLF9GWYz3GfhxcON2RARVeB9qZz8Le3jepNd5M
// SIG // 8datSjjuxkccKmBqWCrx3rQ+3+hmQMYqikjQcJepwz/9
// SIG // p+r1CDH3q0ZIEVOQEPWoR8MuEURZ6NfS/YgmKbkFUSHR
// SIG // kLC5ybGhJD59mYsId0555QV3nW+QWe4D
// SIG // End signature block
