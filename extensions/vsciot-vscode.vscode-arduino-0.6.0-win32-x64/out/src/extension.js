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
exports.deactivate = exports.activate = void 0;
const impor = require("impor")(__dirname);
const fs = require("fs");
const path = require("path");
const uuidModule = impor("uuid/v4");
const vscode = require("vscode");
const constants = require("./common/constants");
const arduinoContentProviderModule = impor("./arduino/arduinoContentProvider");
const vscodeSettings_1 = require("./arduino/vscodeSettings");
const arduinoActivatorModule = impor("./arduinoActivator");
const arduinoContextModule = impor("./arduinoContext");
const constants_1 = require("./common/constants");
const platform_1 = require("./common/platform");
const util = require("./common/util");
const workspace_1 = require("./common/workspace");
const deviceContext_1 = require("./deviceContext");
const completionProviderModule = impor("./langService/completionProvider");
const arduino_1 = require("./arduino/arduino");
const Logger = require("./logger/logger");
const serialMonitor_1 = require("./serialmonitor/serialMonitor");
const usbDetectorModule = impor("./serialmonitor/usbDetector");
function activate(context) {
    return __awaiter(this, void 0, void 0, function* () {
        Logger.configure(context);
        arduinoActivatorModule.default.context = context;
        const activeGuid = uuidModule().replace(/-/g, "");
        Logger.traceUserData("start-activate-extension", { correlationId: activeGuid });
        // Show a warning message if the working file is not under the workspace folder.
        // People should know the extension might not work appropriately, they should look for the doc to get started.
        const openEditor = vscode.window.activeTextEditor;
        if (openEditor && openEditor.document.fileName.endsWith(".ino")) {
            const workingFile = path.normalize(openEditor.document.fileName);
            const workspaceFolder = (vscode.workspace && workspace_1.ArduinoWorkspace.rootPath) || "";
            if (!workspaceFolder || workingFile.indexOf(path.normalize(workspaceFolder)) < 0) {
                vscode.window.showWarningMessage(`The open file "${workingFile}" is not inside the workspace folder, ` +
                    "the arduino extension might not work properly.");
            }
        }
        const vscodeSettings = vscodeSettings_1.VscodeSettings.getInstance();
        const deviceContext = deviceContext_1.DeviceContext.getInstance();
        deviceContext.extensionPath = context.extensionPath;
        context.subscriptions.push(deviceContext);
        const commandExecution = (command, commandBody, args, getUserData) => __awaiter(this, void 0, void 0, function* () {
            const guid = uuidModule().replace(/-/g, "");
            Logger.traceUserData(`start-command-` + command, { correlationId: guid });
            const timer1 = new Logger.Timer();
            let telemetryResult;
            try {
                let result = commandBody(...args);
                if (result) {
                    result = yield Promise.resolve(result);
                }
                if (result && result.telemetry) {
                    telemetryResult = result;
                }
                else if (getUserData) {
                    telemetryResult = getUserData();
                }
            }
            catch (error) {
                Logger.traceError("executeCommandError", error, { correlationId: guid, command });
            }
            Logger.traceUserData(`end-command-` + command, Object.assign(Object.assign({}, telemetryResult), { correlationId: guid, duration: timer1.end() }));
        });
        function askSwitchToBundledCli(message) {
            return __awaiter(this, void 0, void 0, function* () {
                const result = yield vscode.window.showErrorMessage(message, "Use bundled arduino-cli", "View settings");
                switch (result) {
                    case "Use bundled arduino-cli": {
                        Logger.traceUserData("switched-to-bundled-arduino-cli");
                        yield vscodeSettings.setUseArduinoCli(true);
                        yield vscodeSettings.setArduinoPath(undefined);
                        yield vscodeSettings.setCommandPath(undefined);
                        yield vscode.commands.executeCommand("workbench.action.reloadWindow");
                        break;
                    }
                    case "View settings":
                        yield vscode.commands.executeCommand("workbench.action.openGlobalSettings");
                        break;
                }
            });
        }
        if (!vscodeSettings.useArduinoCli) {
            // This notification is intentionally a little bit annoying (popping on
            // workspace open with no permanent dismissal) because we want to move
            // users off of Arduino IDE.
            //
            // Unfortunately, we can't simply switch the default value of
            // useArduinoCli to true because that would break users that were
            // intentionally using the Arduino IDE but relied on the current default
            // value of false. A future will make this breaking change with
            // appropriate messaging.
            Logger.traceUserData("using-legacy-arduino-ide");
            void askSwitchToBundledCli(constants.messages.REMOVE_ARDUINO_IDE_SUPPORT + " " + constants.messages.SWITCH_TO_BUNDLED_CLI);
        }
        const registerArduinoCommand = (command, commandBody, getUserData) => {
            return context.subscriptions.push(vscode.commands.registerCommand(command, (...args) => __awaiter(this, void 0, void 0, function* () {
                if (!arduinoContextModule.default.initialized) {
                    yield arduinoActivatorModule.default.activate();
                }
                if (!serialMonitor_1.SerialMonitor.getInstance().initialized) {
                    serialMonitor_1.SerialMonitor.getInstance().initialize(context);
                }
                const arduinoPath = arduinoContextModule.default.arduinoApp.settings.arduinoPath;
                const commandPath = arduinoContextModule.default.arduinoApp.settings.commandPath;
                const useArduinoCli = arduinoContextModule.default.arduinoApp.settings.useArduinoCli;
                const usingBundledArduinoCli = arduinoContextModule.default.arduinoApp.settings.usingBundledArduinoCli;
                // Ask the user to switch to the bundled Arduino CLI if we can't resolve the specified path.
                if (!usingBundledArduinoCli && (!arduinoPath || !platform_1.validateArduinoPath(arduinoPath, useArduinoCli))) {
                    Logger.traceError("InvalidArduinoPath", new Error(constants.messages.INVALID_ARDUINO_PATH));
                    yield askSwitchToBundledCli(constants.messages.INVALID_ARDUINO_PATH + " " + constants.messages.SWITCH_TO_BUNDLED_CLI);
                }
                else if (!commandPath || !util.fileExistsSync(commandPath)) {
                    const error = new Error(constants.messages.INVALID_COMMAND_PATH + commandPath);
                    if (usingBundledArduinoCli) {
                        Logger.notifyUserError("InvalidCommandPath", error);
                    }
                    else {
                        Logger.traceError("InvalidCommandPath", error);
                        yield askSwitchToBundledCli(error.message + " " + constants.messages.SWITCH_TO_BUNDLED_CLI);
                    }
                }
                else {
                    yield commandExecution(command, commandBody, args, getUserData);
                }
            })));
        };
        const registerNonArduinoCommand = (command, commandBody, getUserData) => {
            return context.subscriptions.push(vscode.commands.registerCommand(command, (...args) => __awaiter(this, void 0, void 0, function* () {
                if (!serialMonitor_1.SerialMonitor.getInstance().initialized) {
                    serialMonitor_1.SerialMonitor.getInstance().initialize(context);
                }
                yield commandExecution(command, commandBody, args, getUserData);
            })));
        };
        registerArduinoCommand("arduino.initialize", () => __awaiter(this, void 0, void 0, function* () { return yield deviceContext.initialize(); }));
        registerArduinoCommand("arduino.verify", () => __awaiter(this, void 0, void 0, function* () {
            if (!arduinoContextModule.default.arduinoApp.building) {
                yield vscode.window.withProgress({
                    location: vscode.ProgressLocation.Window,
                    title: "Arduino: Verifying...",
                }, () => __awaiter(this, void 0, void 0, function* () {
                    yield arduinoContextModule.default.arduinoApp.build(arduino_1.BuildMode.Verify);
                }));
            }
        }), () => {
            return {
                board: (arduinoContextModule.default.boardManager.currentBoard === null) ? null :
                    arduinoContextModule.default.boardManager.currentBoard.name,
            };
        });
        registerArduinoCommand("arduino.upload", () => __awaiter(this, void 0, void 0, function* () {
            if (!arduinoContextModule.default.arduinoApp.building) {
                yield vscode.window.withProgress({
                    location: vscode.ProgressLocation.Window,
                    title: "Arduino: Uploading...",
                }, () => __awaiter(this, void 0, void 0, function* () {
                    yield arduinoContextModule.default.arduinoApp.build(arduino_1.BuildMode.Upload);
                }));
            }
        }), () => {
            return { board: arduinoContextModule.default.boardManager.currentBoard.name };
        });
        registerArduinoCommand("arduino.cliUpload", () => __awaiter(this, void 0, void 0, function* () {
            if (!arduinoContextModule.default.arduinoApp.building) {
                yield vscode.window.withProgress({
                    location: vscode.ProgressLocation.Window,
                    title: "Arduino: Using CLI to upload...",
                }, () => __awaiter(this, void 0, void 0, function* () {
                    yield arduinoContextModule.default.arduinoApp.build(arduino_1.BuildMode.CliUpload);
                }));
            }
        }), () => {
            return { board: arduinoContextModule.default.boardManager.currentBoard.name };
        });
        registerArduinoCommand("arduino.selectSketch", () => __awaiter(this, void 0, void 0, function* () {
            const sketchFileName = deviceContext.sketch;
            // Include any ino, cpp, or c files under the workspace folder
            const includePattern = "**/*.{ino,cpp,c}";
            // The sketchbook folder may contain hardware & library folders, any sketches under these paths
            // should be excluded
            const sketchbookPath = arduinoContextModule.default.arduinoApp.settings.sketchbookPath;
            const excludePatterns = [
                path.relative(workspace_1.ArduinoWorkspace.rootPath, sketchbookPath + "/hardware/**"),
                path.relative(workspace_1.ArduinoWorkspace.rootPath, sketchbookPath + "/libraries/**")
            ];
            // If an output path is specified, it should be excluded as well
            if (deviceContext.output) {
                const outputPath = path.relative(workspace_1.ArduinoWorkspace.rootPath, path.resolve(workspace_1.ArduinoWorkspace.rootPath, deviceContext.output));
                excludePatterns.push(`${outputPath}/**`);
            }
            const excludePattern = `{${excludePatterns.map((p) => p.replace("\\", "/")).join(",")}}`;
            const fileUris = yield vscode.workspace.findFiles(includePattern, excludePattern);
            const newSketchFileName = yield vscode.window.showQuickPick(fileUris.map((fileUri) => ({
                label: path.relative(workspace_1.ArduinoWorkspace.rootPath, fileUri.fsPath),
                description: fileUri.fsPath,
            })), { placeHolder: sketchFileName, matchOnDescription: true });
            if (!newSketchFileName) {
                return;
            }
            deviceContext.sketch = newSketchFileName.label;
            deviceContext.showStatusBar();
        }));
        registerArduinoCommand("arduino.uploadUsingProgrammer", () => __awaiter(this, void 0, void 0, function* () {
            if (!arduinoContextModule.default.arduinoApp.building) {
                yield vscode.window.withProgress({
                    location: vscode.ProgressLocation.Window,
                    title: "Arduino: Uploading (programmer)...",
                }, () => __awaiter(this, void 0, void 0, function* () {
                    yield arduinoContextModule.default.arduinoApp.build(arduino_1.BuildMode.UploadProgrammer);
                }));
            }
        }), () => {
            return { board: arduinoContextModule.default.boardManager.currentBoard.name };
        });
        registerArduinoCommand("arduino.cliUploadUsingProgrammer", () => __awaiter(this, void 0, void 0, function* () {
            if (!arduinoContextModule.default.arduinoApp.building) {
                yield vscode.window.withProgress({
                    location: vscode.ProgressLocation.Window,
                    title: "Arduino: Using CLI to upload (programmer)...",
                }, () => __awaiter(this, void 0, void 0, function* () {
                    yield arduinoContextModule.default.arduinoApp.build(arduino_1.BuildMode.CliUploadProgrammer);
                }));
            }
        }), () => {
            return { board: arduinoContextModule.default.boardManager.currentBoard.name };
        });
        registerArduinoCommand("arduino.rebuildIntelliSenseConfig", () => __awaiter(this, void 0, void 0, function* () {
            if (!arduinoContextModule.default.arduinoApp.building) {
                yield vscode.window.withProgress({
                    location: vscode.ProgressLocation.Window,
                    title: "Arduino: Rebuilding IS Configuration...",
                }, () => __awaiter(this, void 0, void 0, function* () {
                    yield arduinoContextModule.default.arduinoApp.build(arduino_1.BuildMode.Analyze);
                }));
            }
        }), () => {
            return { board: arduinoContextModule.default.boardManager.currentBoard.name };
        });
        registerArduinoCommand("arduino.selectProgrammer", () => __awaiter(this, void 0, void 0, function* () {
            // Note: this guard does not prevent building while setting the
            // programmer. But when looking at the code of selectProgrammer
            // it seems not to be possible to trigger building while setting
            // the programmer. If the timed IntelliSense analysis is triggered
            // this is not a problem, since it doesn't use the programmer.
            if (!arduinoContextModule.default.arduinoApp.building) {
                try {
                    yield arduinoContextModule.default.arduinoApp.programmerManager.selectProgrammer();
                }
                catch (ex) {
                }
            }
        }), () => {
            return {
                board: (arduinoContextModule.default.boardManager.currentBoard === null) ? null :
                    arduinoContextModule.default.boardManager.currentBoard.name,
            };
        });
        registerArduinoCommand("arduino.openExample", (path) => arduinoContextModule.default.arduinoApp.openExample(path));
        registerArduinoCommand("arduino.loadPackages", () => __awaiter(this, void 0, void 0, function* () { return yield arduinoContextModule.default.boardManager.loadPackages(true); }));
        registerArduinoCommand("arduino.installBoard", (packageName, arch, version = "") => __awaiter(this, void 0, void 0, function* () {
            let installed = false;
            const installedBoards = arduinoContextModule.default.boardManager.installedBoards;
            installedBoards.forEach((board, key) => {
                let _packageName;
                if (board.platform.package && board.platform.package.name) {
                    _packageName = board.platform.package.name;
                }
                else {
                    _packageName = board.platform.packageName;
                }
                if (packageName === _packageName &&
                    arch === board.platform.architecture &&
                    (!version || version === board.platform.installedVersion)) {
                    installed = true;
                }
            });
            if (!installed) {
                yield arduinoContextModule.default.boardManager.loadPackages(true);
                yield arduinoContextModule.default.arduinoApp.installBoard(packageName, arch, version);
            }
            return;
        }));
        // serial monitor commands
        const serialMonitor = serialMonitor_1.SerialMonitor.getInstance();
        context.subscriptions.push(serialMonitor);
        registerNonArduinoCommand("arduino.selectSerialPort", () => serialMonitor.selectSerialPort());
        registerNonArduinoCommand("arduino.openSerialMonitor", () => serialMonitor.openSerialMonitor());
        registerNonArduinoCommand("arduino.changeTimestampFormat", () => serialMonitor.changeTimestampFormat());
        registerNonArduinoCommand("arduino.closeSerialMonitor", (port) => serialMonitor.closeSerialMonitor(port));
        const completionProvider = new completionProviderModule.CompletionProvider();
        context.subscriptions.push(vscode.languages.registerCompletionItemProvider(constants_1.ARDUINO_MODE, completionProvider, "<", '"', "."));
        if (workspace_1.ArduinoWorkspace.rootPath && (util.fileExistsSync(path.join(workspace_1.ArduinoWorkspace.rootPath, constants_1.ARDUINO_CONFIG_FILE))
            || (openEditor && openEditor.document.fileName.endsWith(".ino")))) {
            (() => __awaiter(this, void 0, void 0, function* () {
                if (!arduinoContextModule.default.initialized) {
                    yield arduinoActivatorModule.default.activate();
                }
                if (!serialMonitor_1.SerialMonitor.getInstance().initialized) {
                    serialMonitor_1.SerialMonitor.getInstance().initialize(context);
                }
                vscode.commands.executeCommand("setContext", "vscode-arduino:showExampleExplorer", true);
            }))();
        }
        vscode.window.onDidChangeActiveTextEditor(() => __awaiter(this, void 0, void 0, function* () {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && ((path.basename(activeEditor.document.fileName) === "arduino.json"
                && path.basename(path.dirname(activeEditor.document.fileName)) === ".vscode")
                || activeEditor.document.fileName.endsWith(".ino"))) {
                if (!arduinoContextModule.default.initialized) {
                    yield arduinoActivatorModule.default.activate();
                }
                if (!serialMonitor_1.SerialMonitor.getInstance().initialized) {
                    serialMonitor_1.SerialMonitor.getInstance().initialize(context);
                }
                vscode.commands.executeCommand("setContext", "vscode-arduino:showExampleExplorer", true);
            }
        }));
        const allowPDEFiletype = vscodeSettings.allowPDEFiletype;
        if (allowPDEFiletype) {
            vscode.workspace.onDidOpenTextDocument((document) => __awaiter(this, void 0, void 0, function* () {
                if (/\.pde$/.test(document.uri.fsPath)) {
                    const newFsName = document.uri.fsPath.replace(/\.pde$/, ".ino");
                    yield vscode.commands.executeCommand("workbench.action.closeActiveEditor");
                    fs.renameSync(document.uri.fsPath, newFsName);
                    yield vscode.commands.executeCommand("vscode.open", vscode.Uri.file(newFsName));
                }
            }));
            vscode.window.onDidChangeActiveTextEditor((editor) => __awaiter(this, void 0, void 0, function* () {
                if (!editor) {
                    return;
                }
                const document = editor.document;
                if (/\.pde$/.test(document.uri.fsPath)) {
                    const newFsName = document.uri.fsPath.replace(/\.pde$/, ".ino");
                    yield vscode.commands.executeCommand("workbench.action.closeActiveEditor");
                    fs.renameSync(document.uri.fsPath, newFsName);
                    yield vscode.commands.executeCommand("vscode.open", vscode.Uri.file(newFsName));
                }
            }));
        }
        Logger.traceUserData("end-activate-extension", { correlationId: activeGuid });
        setTimeout(() => __awaiter(this, void 0, void 0, function* () {
            const arduinoManagerProvider = new arduinoContentProviderModule.ArduinoContentProvider(context.extensionPath);
            yield arduinoManagerProvider.initialize();
            context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(constants_1.ARDUINO_MANAGER_PROTOCOL, arduinoManagerProvider));
            registerArduinoCommand("arduino.showBoardManager", () => __awaiter(this, void 0, void 0, function* () {
                const panel = vscode.window.createWebviewPanel("arduinoBoardManager", "Arduino Board Manager", vscode.ViewColumn.Two, {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                });
                panel.webview.html = yield arduinoManagerProvider.provideTextDocumentContent(constants_1.BOARD_MANAGER_URI);
            }));
            registerArduinoCommand("arduino.showLibraryManager", () => __awaiter(this, void 0, void 0, function* () {
                const panel = vscode.window.createWebviewPanel("arduinoLibraryManager", "Arduino Library Manager", vscode.ViewColumn.Two, {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                });
                panel.webview.html = yield arduinoManagerProvider.provideTextDocumentContent(constants_1.LIBRARY_MANAGER_URI);
            }));
            registerArduinoCommand("arduino.showBoardConfig", () => __awaiter(this, void 0, void 0, function* () {
                const panel = vscode.window.createWebviewPanel("arduinoBoardConfiguration", "Arduino Board Configuration", vscode.ViewColumn.Two, {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                });
                panel.webview.html = yield arduinoManagerProvider.provideTextDocumentContent(constants_1.BOARD_CONFIG_URI);
            }));
            registerArduinoCommand("arduino.showExamples", (forceRefresh = false) => __awaiter(this, void 0, void 0, function* () {
                vscode.commands.executeCommand("setContext", "vscode-arduino:showExampleExplorer", true);
                if (forceRefresh) {
                    vscode.commands.executeCommand("arduino.reloadExample");
                }
                const panel = vscode.window.createWebviewPanel("arduinoExamples", "Arduino Examples", vscode.ViewColumn.Two, {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                });
                panel.webview.html = yield arduinoManagerProvider.provideTextDocumentContent(constants_1.EXAMPLES_URI);
            }));
            // change board type
            registerArduinoCommand("arduino.changeBoardType", () => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield arduinoContextModule.default.boardManager.changeBoardType();
                }
                catch (exception) {
                    Logger.error(exception.message);
                }
                arduinoManagerProvider.update(constants_1.LIBRARY_MANAGER_URI);
                arduinoManagerProvider.update(constants_1.EXAMPLES_URI);
            }), () => {
                return { board: arduinoContextModule.default.boardManager.currentBoard.name };
            });
            registerArduinoCommand("arduino.reloadExample", () => {
                arduinoManagerProvider.update(constants_1.EXAMPLES_URI);
            }, () => {
                return {
                    board: (arduinoContextModule.default.boardManager.currentBoard === null) ? null :
                        arduinoContextModule.default.boardManager.currentBoard.name,
                };
            });
        }), 100);
        setTimeout(() => {
            // delay to detect usb
            usbDetectorModule.UsbDetector.getInstance().initialize(context);
            usbDetectorModule.UsbDetector.getInstance().startListening();
        }, 200);
    });
}
exports.activate = activate;
function deactivate() {
    return __awaiter(this, void 0, void 0, function* () {
        const monitor = serialMonitor_1.SerialMonitor.getInstance();
        yield monitor.closeSerialMonitor(null);
        usbDetectorModule.UsbDetector.getInstance().stopListening();
        Logger.traceUserData("deactivate-extension");
    });
}
exports.deactivate = deactivate;

//# sourceMappingURL=extension.js.map

// SIG // Begin signature block
// SIG // MIInlAYJKoZIhvcNAQcCoIInhTCCJ4ECAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // 75nDzhY1zHGRMJi9kh0RPz1UE3qicbTleeG2ToYzK52g
// SIG // gg12MIIF9DCCA9ygAwIBAgITMwAAAsu3dTn7AnFCNgAA
// SIG // AAACyzANBgkqhkiG9w0BAQsFADB+MQswCQYDVQQGEwJV
// SIG // UzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMH
// SIG // UmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBv
// SIG // cmF0aW9uMSgwJgYDVQQDEx9NaWNyb3NvZnQgQ29kZSBT
// SIG // aWduaW5nIFBDQSAyMDExMB4XDTIyMDUxMjIwNDU1OVoX
// SIG // DTIzMDUxMTIwNDU1OVowdDELMAkGA1UEBhMCVVMxEzAR
// SIG // BgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1v
// SIG // bmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlv
// SIG // bjEeMBwGA1UEAxMVTWljcm9zb2Z0IENvcnBvcmF0aW9u
// SIG // MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA
// SIG // t7DdFnHRqRlz2SG+YjXxQdMWfK5yb2J8Q+lH9gR14JaW
// SIG // 0xH6Hvpjv/6C1pEcQMKaXYrbElTg9KIJSm7Z4fVqdgwE
// SIG // S3MWxmluGGpzlkgdS8i0aR550OTzpYdlOba4ON4EI75T
// SIG // WZUAd5S/s6z7WzbzAOxNFpJqPmemBZ7H+2npPihs2hm6
// SIG // AHhTuLimY0F2OUZjMxO9AcGs+4bwNOYw1EXUSh9Iv9ci
// SIG // vekw7j+yckRSzrwN1FzVs9NEfcO6aTA3DZV7a5mz4oL9
// SIG // 8RPRX6X5iUbYjmUCne9yu9lro5o+v0rt/gwU6TquzYHZ
// SIG // 7VtpSX1912uqHuBfT5PcUYZMB7JOybvRPwIDAQABo4IB
// SIG // czCCAW8wHwYDVR0lBBgwFgYKKwYBBAGCN0wIAQYIKwYB
// SIG // BQUHAwMwHQYDVR0OBBYEFK4P57f4I/gQS3dY2VmIaJO7
// SIG // +f8OMEUGA1UdEQQ+MDykOjA4MR4wHAYDVQQLExVNaWNy
// SIG // b3NvZnQgQ29ycG9yYXRpb24xFjAUBgNVBAUTDTIzMDAx
// SIG // Mis0NzA1MjgwHwYDVR0jBBgwFoAUSG5k5VAF04KqFzc3
// SIG // IrVtqMp1ApUwVAYDVR0fBE0wSzBJoEegRYZDaHR0cDov
// SIG // L3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9jcmwvTWlj
// SIG // Q29kU2lnUENBMjAxMV8yMDExLTA3LTA4LmNybDBhBggr
// SIG // BgEFBQcBAQRVMFMwUQYIKwYBBQUHMAKGRWh0dHA6Ly93
// SIG // d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMvY2VydHMvTWlj
// SIG // Q29kU2lnUENBMjAxMV8yMDExLTA3LTA4LmNydDAMBgNV
// SIG // HRMBAf8EAjAAMA0GCSqGSIb3DQEBCwUAA4ICAQCS+beq
// SIG // VYyEZUPI+HQBSWZzJHt60R3kAzjxcbMDOOx0b4EGthNY
// SIG // 3mtmmIjJNVpnalp2MNW2peCM0ZUlX+HM388dr4ziDomh
// SIG // pZVtgch5HygKZ4DsyZgEPBdecUhz0bzTJr6QtzxS7yjH
// SIG // 98uUsjycYfdtk06tKuXqSb9UoGQ1pVJRy/xMdZ1/JMwU
// SIG // YR73Og+heZWvqADuAN6P2QtOTjoJuBCcWT/TKlIuYond
// SIG // ncOCYPx77Q6QnC49RiyIQg2nmynoGowiZTIYcZw16xhS
// SIG // yX1/I+5Oy1L62Q7EJ4iWdw+uivt0mUy4b8Cu3TBlRblF
// SIG // CVHw4n65Qk4yhvZsbDw5ZX8nJOMxp0Wb/CcPUYBNcwII
// SIG // Z1NeC9L1VDTs4v+GxO8CLIkciHAnFaF0Z3gQN5/36y17
// SIG // 3Yw7G29paRru/PrNc2zuTdG4R1quI+VjLra7KQcRIaht
// SIG // j0gYwuWKYvo4bX7t/se+jZgb7Mirscffh5vwC55cysa+
// SIG // CsjEd/8+CETMwNUMqaTZOuVIvowdeIPsOL6JXt9zNaVa
// SIG // lXJK5knm1JJo5wrIQoh9diBYB2Re4EcBOGGaye0I8WXq
// SIG // Gah2irEC0TKeud23gXx33r2vcyT4QUnVXAlu8fatHNh1
// SIG // TyyR1/WAlFO9eCPqrS6Qxq3W2cQ/ZopD6i/06P9ZQ2dH
// SIG // IfBbXj4TBO4aLrqD3DCCB3owggVioAMCAQICCmEOkNIA
// SIG // AAAAAAMwDQYJKoZIhvcNAQELBQAwgYgxCzAJBgNVBAYT
// SIG // AlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQH
// SIG // EwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29y
// SIG // cG9yYXRpb24xMjAwBgNVBAMTKU1pY3Jvc29mdCBSb290
// SIG // IENlcnRpZmljYXRlIEF1dGhvcml0eSAyMDExMB4XDTEx
// SIG // MDcwODIwNTkwOVoXDTI2MDcwODIxMDkwOVowfjELMAkG
// SIG // A1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAO
// SIG // BgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29m
// SIG // dCBDb3Jwb3JhdGlvbjEoMCYGA1UEAxMfTWljcm9zb2Z0
// SIG // IENvZGUgU2lnbmluZyBQQ0EgMjAxMTCCAiIwDQYJKoZI
// SIG // hvcNAQEBBQADggIPADCCAgoCggIBAKvw+nIQHC6t2G6q
// SIG // ghBNNLrytlghn0IbKmvpWlCquAY4GgRJun/DDB7dN2vG
// SIG // EtgL8DjCmQawyDnVARQxQtOJDXlkh36UYCRsr55JnOlo
// SIG // XtLfm1OyCizDr9mpK656Ca/XllnKYBoF6WZ26DJSJhIv
// SIG // 56sIUM+zRLdd2MQuA3WraPPLbfM6XKEW9Ea64DhkrG5k
// SIG // NXimoGMPLdNAk/jj3gcN1Vx5pUkp5w2+oBN3vpQ97/vj
// SIG // K1oQH01WKKJ6cuASOrdJXtjt7UORg9l7snuGG9k+sYxd
// SIG // 6IlPhBryoS9Z5JA7La4zWMW3Pv4y07MDPbGyr5I4ftKd
// SIG // gCz1TlaRITUlwzluZH9TupwPrRkjhMv0ugOGjfdf8NBS
// SIG // v4yUh7zAIXQlXxgotswnKDglmDlKNs98sZKuHCOnqWbs
// SIG // YR9q4ShJnV+I4iVd0yFLPlLEtVc/JAPw0XpbL9Uj43Bd
// SIG // D1FGd7P4AOG8rAKCX9vAFbO9G9RVS+c5oQ/pI0m8GLhE
// SIG // fEXkwcNyeuBy5yTfv0aZxe/CHFfbg43sTUkwp6uO3+xb
// SIG // n6/83bBm4sGXgXvt1u1L50kppxMopqd9Z4DmimJ4X7Iv
// SIG // hNdXnFy/dygo8e1twyiPLI9AN0/B4YVEicQJTMXUpUMv
// SIG // dJX3bvh4IFgsE11glZo+TzOE2rCIF96eTvSWsLxGoGyY
// SIG // 0uDWiIwLAgMBAAGjggHtMIIB6TAQBgkrBgEEAYI3FQEE
// SIG // AwIBADAdBgNVHQ4EFgQUSG5k5VAF04KqFzc3IrVtqMp1
// SIG // ApUwGQYJKwYBBAGCNxQCBAweCgBTAHUAYgBDAEEwCwYD
// SIG // VR0PBAQDAgGGMA8GA1UdEwEB/wQFMAMBAf8wHwYDVR0j
// SIG // BBgwFoAUci06AjGQQ7kUBU7h6qfHMdEjiTQwWgYDVR0f
// SIG // BFMwUTBPoE2gS4ZJaHR0cDovL2NybC5taWNyb3NvZnQu
// SIG // Y29tL3BraS9jcmwvcHJvZHVjdHMvTWljUm9vQ2VyQXV0
// SIG // MjAxMV8yMDExXzAzXzIyLmNybDBeBggrBgEFBQcBAQRS
// SIG // MFAwTgYIKwYBBQUHMAKGQmh0dHA6Ly93d3cubWljcm9z
// SIG // b2Z0LmNvbS9wa2kvY2VydHMvTWljUm9vQ2VyQXV0MjAx
// SIG // MV8yMDExXzAzXzIyLmNydDCBnwYDVR0gBIGXMIGUMIGR
// SIG // BgkrBgEEAYI3LgMwgYMwPwYIKwYBBQUHAgEWM2h0dHA6
// SIG // Ly93d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMvZG9jcy9w
// SIG // cmltYXJ5Y3BzLmh0bTBABggrBgEFBQcCAjA0HjIgHQBM
// SIG // AGUAZwBhAGwAXwBwAG8AbABpAGMAeQBfAHMAdABhAHQA
// SIG // ZQBtAGUAbgB0AC4gHTANBgkqhkiG9w0BAQsFAAOCAgEA
// SIG // Z/KGpZjgVHkaLtPYdGcimwuWEeFjkplCln3SeQyQwWVf
// SIG // Liw++MNy0W2D/r4/6ArKO79HqaPzadtjvyI1pZddZYSQ
// SIG // fYtGUFXYDJJ80hpLHPM8QotS0LD9a+M+By4pm+Y9G6XU
// SIG // tR13lDni6WTJRD14eiPzE32mkHSDjfTLJgJGKsKKELuk
// SIG // qQUMm+1o+mgulaAqPyprWEljHwlpblqYluSD9MCP80Yr
// SIG // 3vw70L01724lruWvJ+3Q3fMOr5kol5hNDj0L8giJ1h/D
// SIG // Mhji8MUtzluetEk5CsYKwsatruWy2dsViFFFWDgycSca
// SIG // f7H0J/jeLDogaZiyWYlobm+nt3TDQAUGpgEqKD6CPxNN
// SIG // ZgvAs0314Y9/HG8VfUWnduVAKmWjw11SYobDHWM2l4bf
// SIG // 2vP48hahmifhzaWX0O5dY0HjWwechz4GdwbRBrF1HxS+
// SIG // YWG18NzGGwS+30HHDiju3mUv7Jf2oVyW2ADWoUa9WfOX
// SIG // pQlLSBCZgB/QACnFsZulP0V3HjXG0qKin3p6IvpIlR+r
// SIG // +0cjgPWe+L9rt0uX4ut1eBrs6jeZeRhL/9azI2h15q/6
// SIG // /IvrC4DqaTuv/DDtBEyO3991bWORPdGdVk5Pv4BXIqF4
// SIG // ETIheu9BCrE/+6jMpF3BoYibV3FWTkhFwELJm3ZbCoBI
// SIG // a/15n8G9bW1qyVJzEw16UM0xghl2MIIZcgIBATCBlTB+
// SIG // MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3Rv
// SIG // bjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWlj
// SIG // cm9zb2Z0IENvcnBvcmF0aW9uMSgwJgYDVQQDEx9NaWNy
// SIG // b3NvZnQgQ29kZSBTaWduaW5nIFBDQSAyMDExAhMzAAAC
// SIG // y7d1OfsCcUI2AAAAAALLMA0GCWCGSAFlAwQCAQUAoIGu
// SIG // MBkGCSqGSIb3DQEJAzEMBgorBgEEAYI3AgEEMBwGCisG
// SIG // AQQBgjcCAQsxDjAMBgorBgEEAYI3AgEVMC8GCSqGSIb3
// SIG // DQEJBDEiBCCZVYFyYEoi3y7RDRBueLiGc5o9pbPbkGvF
// SIG // LdOb5I7MMTBCBgorBgEEAYI3AgEMMTQwMqAUgBIATQBp
// SIG // AGMAcgBvAHMAbwBmAHShGoAYaHR0cDovL3d3dy5taWNy
// SIG // b3NvZnQuY29tMA0GCSqGSIb3DQEBAQUABIIBAIQEccop
// SIG // npWw23T/maadzysI59t42JzPPsQWjArVhVJ+KJ9wde27
// SIG // /09wsMYAn+z+4wItFLBvQNnv+wslpIPoqv7D2jOWqKE9
// SIG // stWpcMlAzcd4doSNpGeyk+e7QE+bD0Vvkic+0F9x1I5N
// SIG // Q8mVMI2T/wxryBhO44FfE82WnW8X5+ZBFzolOzsngtDt
// SIG // kaIrRErftX8FmTRb/HFaAd0VIcWzr0jq/zB/JkjXcpYS
// SIG // O7mtITd1YzKDdlFH7tQMFLQBsS0HDt6b0SkqR9aUbfMw
// SIG // rtrBYTwkzAdbNPTmTwfQTHktEZBHJLt//qZfLhFNuOaF
// SIG // LNS9CjCFc4YQsEnK+ooDttfnKbahghcAMIIW/AYKKwYB
// SIG // BAGCNwMDATGCFuwwghboBgkqhkiG9w0BBwKgghbZMIIW
// SIG // 1QIBAzEPMA0GCWCGSAFlAwQCAQUAMIIBUQYLKoZIhvcN
// SIG // AQkQAQSgggFABIIBPDCCATgCAQEGCisGAQQBhFkKAwEw
// SIG // MTANBglghkgBZQMEAgEFAAQgtI8y5Z+c93Qt4tS9Xca5
// SIG // wiIwJ63Yijq463tAvuWIq4wCBmPueaDJMBgTMjAyMzAz
// SIG // MTUyMTA2NDAuNzAzWjAEgAIB9KCB0KSBzTCByjELMAkG
// SIG // A1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAO
// SIG // BgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29m
// SIG // dCBDb3Jwb3JhdGlvbjElMCMGA1UECxMcTWljcm9zb2Z0
// SIG // IEFtZXJpY2EgT3BlcmF0aW9uczEmMCQGA1UECxMdVGhh
// SIG // bGVzIFRTUyBFU046NDlCQy1FMzdBLTIzM0MxJTAjBgNV
// SIG // BAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1wIFNlcnZpY2Wg
// SIG // ghFXMIIHDDCCBPSgAwIBAgITMwAAAcBVpI3DZBXFSwAB
// SIG // AAABwDANBgkqhkiG9w0BAQsFADB8MQswCQYDVQQGEwJV
// SIG // UzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMH
// SIG // UmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBv
// SIG // cmF0aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQgVGltZS1T
// SIG // dGFtcCBQQ0EgMjAxMDAeFw0yMjExMDQxOTAxMjVaFw0y
// SIG // NDAyMDIxOTAxMjVaMIHKMQswCQYDVQQGEwJVUzETMBEG
// SIG // A1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9u
// SIG // ZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9u
// SIG // MSUwIwYDVQQLExxNaWNyb3NvZnQgQW1lcmljYSBPcGVy
// SIG // YXRpb25zMSYwJAYDVQQLEx1UaGFsZXMgVFNTIEVTTjo0
// SIG // OUJDLUUzN0EtMjMzQzElMCMGA1UEAxMcTWljcm9zb2Z0
// SIG // IFRpbWUtU3RhbXAgU2VydmljZTCCAiIwDQYJKoZIhvcN
// SIG // AQEBBQADggIPADCCAgoCggIBALztYPtjYYZgUL5RpQkz
// SIG // jGhcN42yIVHQ06pGkIUaXR1W/oblP9BzYS5qEWL66e8+
// SIG // byKC9TDwJFQRViSJK3Bu7Eq3nZ8mcK3mNtOwvZ/F4ry/
// SIG // WQTkHolHi/0zJSelYp63Gn24XZ5DTuSQ5T6MwvXRskor
// SIG // m68nbORirbuvQ9cDWrfQyEJempRTuqZ3GSuESM37/is5
// SIG // DO0ZGN7x6YVdAvBBVKRfpcrGhiVxX/ULFFB8I/Vylh33
// SIG // PQX4S6AkXl1M74K7KXRZlZwPQE2F5onUo67IX/APhNPx
// SIG // aU3YVzyPV16rGQxwaq+w5WKEglN5b61Q0btaeaRx3+7N
// SIG // 5DNeh6Sumqw7WN2otbKAEphKb9wtjf8uTAwQKQ3eEqUp
// SIG // CzGu/unrP3Wnku83R9anQmtkaCTzOhIf+mJgX6H4Xy0K
// SIG // HyjyZd+AC5WViuQM1bRUTTl2nKI+jABtnU/EXOX6Sgh9
// SIG // RN5+2Y3tHStuEFX0r/2DscOdhAmjC5VuT4R092SDTWgp
// SIG // kYHBwkwpTiswthTq9N2AXNszzlumyFXV5aD5gTFWhPrY
// SIG // V6j5gDQcNGLJ3GjpFYIIw2+TuVajqffDJJR6SaCSOqZO
// SIG // cwJcfPzrQuxbra3bWDVAuspF8zADxbmJFhoMf1uwNIrS
// SIG // lvFs2M8Dt2wIaa8M56LhmZkYsNpPKXp/NAc6s3cj7280
// SIG // 8ULDAgMBAAGjggE2MIIBMjAdBgNVHQ4EFgQUAETGePNI
// SIG // 8KStz+qrlVlBCdHN9IUwHwYDVR0jBBgwFoAUn6cVXQBe
// SIG // Yl2D9OXSZacbUzUZ6XIwXwYDVR0fBFgwVjBUoFKgUIZO
// SIG // aHR0cDovL3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9j
// SIG // cmwvTWljcm9zb2Z0JTIwVGltZS1TdGFtcCUyMFBDQSUy
// SIG // MDIwMTAoMSkuY3JsMGwGCCsGAQUFBwEBBGAwXjBcBggr
// SIG // BgEFBQcwAoZQaHR0cDovL3d3dy5taWNyb3NvZnQuY29t
// SIG // L3BraW9wcy9jZXJ0cy9NaWNyb3NvZnQlMjBUaW1lLVN0
// SIG // YW1wJTIwUENBJTIwMjAxMCgxKS5jcnQwDAYDVR0TAQH/
// SIG // BAIwADATBgNVHSUEDDAKBggrBgEFBQcDCDANBgkqhkiG
// SIG // 9w0BAQsFAAOCAgEArU4dBEJ9epCkMgnlZPVXNdJui9BM
// SIG // C0aNwE0aLj+2HdoVnhAdmOGReAiSnvan11hiSs1e7TFJ
// SIG // ugwLASmB/50/vMmyPLiYhxp351Yukoe4BY506X4dY9U/
// SIG // dB/7i3qBY6Tp//nqAqCZqK1uRm9ns5U5aOSNJDQLm8bQ
// SIG // samy4s7jzT6G/JEQCkIL/uPwgtSZolBRtLiiDZSo/UrB
// SIG // 3K1ngQUB1+tpzYM4iME+OCah6wNNiOnJkAIvQWXLH+ez
// SIG // ji6UWJc6Dx98f/pXUsklwJsi6trkm1rULg/OCP9GYEvw
// SIG // eS93sKk3YhNSmyl/PTFuSagiv8iP5gCEGppgJRz6lPXm
// SIG // WUzDzh0LNF66Qoo5ZPqsqNiWh4sksMOp7j6l81N7BI91
// SIG // VtNGIlUmsihLtSK0c819y2vKnujqi07yv+oLuV3Squ00
// SIG // /OdpweiD9EDPgbnba+BW8eP7L6ShxqSvf8wbmhxw11+Q
// SIG // KEpLIf5Eg2Cn3n0CISH0CSc6BN1/jIpjCa4K8GV5bW+o
// SIG // 9SC9B2N6gqWtNxoYItCE86n5MNzGp9xvJAdUJfknjXIj
// SIG // 1I+9yp9r3iXpxi7U/CZFDPUVItMKDtIrmOLSZ2Lkvknq
// SIG // mr11DlqlGFWNfRSK9Ty6qZlpG6zucSo5Mjh6AJi8YzWy
// SIG // ozp5AMH7ftRtNJLpSqs6j25vkp/uOybBkBYTRm0wggdx
// SIG // MIIFWaADAgECAhMzAAAAFcXna54Cm0mZAAAAAAAVMA0G
// SIG // CSqGSIb3DQEBCwUAMIGIMQswCQYDVQQGEwJVUzETMBEG
// SIG // A1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9u
// SIG // ZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9u
// SIG // MTIwMAYDVQQDEylNaWNyb3NvZnQgUm9vdCBDZXJ0aWZp
// SIG // Y2F0ZSBBdXRob3JpdHkgMjAxMDAeFw0yMTA5MzAxODIy
// SIG // MjVaFw0zMDA5MzAxODMyMjVaMHwxCzAJBgNVBAYTAlVT
// SIG // MRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdS
// SIG // ZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9y
// SIG // YXRpb24xJjAkBgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0
// SIG // YW1wIFBDQSAyMDEwMIICIjANBgkqhkiG9w0BAQEFAAOC
// SIG // Ag8AMIICCgKCAgEA5OGmTOe0ciELeaLL1yR5vQ7VgtP9
// SIG // 7pwHB9KpbE51yMo1V/YBf2xK4OK9uT4XYDP/XE/HZveV
// SIG // U3Fa4n5KWv64NmeFRiMMtY0Tz3cywBAY6GB9alKDRLem
// SIG // jkZrBxTzxXb1hlDcwUTIcVxRMTegCjhuje3XD9gmU3w5
// SIG // YQJ6xKr9cmmvHaus9ja+NSZk2pg7uhp7M62AW36MEByd
// SIG // Uv626GIl3GoPz130/o5Tz9bshVZN7928jaTjkY+yOSxR
// SIG // nOlwaQ3KNi1wjjHINSi947SHJMPgyY9+tVSP3PoFVZht
// SIG // aDuaRr3tpK56KTesy+uDRedGbsoy1cCGMFxPLOJiss25
// SIG // 4o2I5JasAUq7vnGpF1tnYN74kpEeHT39IM9zfUGaRnXN
// SIG // xF803RKJ1v2lIH1+/NmeRd+2ci/bfV+AutuqfjbsNkz2
// SIG // K26oElHovwUDo9Fzpk03dJQcNIIP8BDyt0cY7afomXw/
// SIG // TNuvXsLz1dhzPUNOwTM5TI4CvEJoLhDqhFFG4tG9ahha
// SIG // YQFzymeiXtcodgLiMxhy16cg8ML6EgrXY28MyTZki1ug
// SIG // poMhXV8wdJGUlNi5UPkLiWHzNgY1GIRH29wb0f2y1BzF
// SIG // a/ZcUlFdEtsluq9QBXpsxREdcu+N+VLEhReTwDwV2xo3
// SIG // xwgVGD94q0W29R6HXtqPnhZyacaue7e3PmriLq0CAwEA
// SIG // AaOCAd0wggHZMBIGCSsGAQQBgjcVAQQFAgMBAAEwIwYJ
// SIG // KwYBBAGCNxUCBBYEFCqnUv5kxJq+gpE8RjUpzxD/LwTu
// SIG // MB0GA1UdDgQWBBSfpxVdAF5iXYP05dJlpxtTNRnpcjBc
// SIG // BgNVHSAEVTBTMFEGDCsGAQQBgjdMg30BATBBMD8GCCsG
// SIG // AQUFBwIBFjNodHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20v
// SIG // cGtpb3BzL0RvY3MvUmVwb3NpdG9yeS5odG0wEwYDVR0l
// SIG // BAwwCgYIKwYBBQUHAwgwGQYJKwYBBAGCNxQCBAweCgBT
// SIG // AHUAYgBDAEEwCwYDVR0PBAQDAgGGMA8GA1UdEwEB/wQF
// SIG // MAMBAf8wHwYDVR0jBBgwFoAU1fZWy4/oolxiaNE9lJBb
// SIG // 186aGMQwVgYDVR0fBE8wTTBLoEmgR4ZFaHR0cDovL2Ny
// SIG // bC5taWNyb3NvZnQuY29tL3BraS9jcmwvcHJvZHVjdHMv
// SIG // TWljUm9vQ2VyQXV0XzIwMTAtMDYtMjMuY3JsMFoGCCsG
// SIG // AQUFBwEBBE4wTDBKBggrBgEFBQcwAoY+aHR0cDovL3d3
// SIG // dy5taWNyb3NvZnQuY29tL3BraS9jZXJ0cy9NaWNSb29D
// SIG // ZXJBdXRfMjAxMC0wNi0yMy5jcnQwDQYJKoZIhvcNAQEL
// SIG // BQADggIBAJ1VffwqreEsH2cBMSRb4Z5yS/ypb+pcFLY+
// SIG // TkdkeLEGk5c9MTO1OdfCcTY/2mRsfNB1OW27DzHkwo/7
// SIG // bNGhlBgi7ulmZzpTTd2YurYeeNg2LpypglYAA7AFvono
// SIG // aeC6Ce5732pvvinLbtg/SHUB2RjebYIM9W0jVOR4U3Uk
// SIG // V7ndn/OOPcbzaN9l9qRWqveVtihVJ9AkvUCgvxm2EhIR
// SIG // XT0n4ECWOKz3+SmJw7wXsFSFQrP8DJ6LGYnn8AtqgcKB
// SIG // GUIZUnWKNsIdw2FzLixre24/LAl4FOmRsqlb30mjdAy8
// SIG // 7JGA0j3mSj5mO0+7hvoyGtmW9I/2kQH2zsZ0/fZMcm8Q
// SIG // q3UwxTSwethQ/gpY3UA8x1RtnWN0SCyxTkctwRQEcb9k
// SIG // +SS+c23Kjgm9swFXSVRk2XPXfx5bRAGOWhmRaw2fpCjc
// SIG // ZxkoJLo4S5pu+yFUa2pFEUep8beuyOiJXk+d0tBMdrVX
// SIG // VAmxaQFEfnyhYWxz/gq77EFmPWn9y8FBSX5+k77L+Dvk
// SIG // txW/tM4+pTFRhLy/AsGConsXHRWJjXD+57XQKBqJC482
// SIG // 2rpM+Zv/Cuk0+CQ1ZyvgDbjmjJnW4SLq8CdCPSWU5nR0
// SIG // W2rRnj7tfqAxM328y+l7vzhwRNGQ8cirOoo6CGJ/2XBj
// SIG // U02N7oJtpQUQwXEGahC0HVUzWLOhcGbyoYICzjCCAjcC
// SIG // AQEwgfihgdCkgc0wgcoxCzAJBgNVBAYTAlVTMRMwEQYD
// SIG // VQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25k
// SIG // MR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24x
// SIG // JTAjBgNVBAsTHE1pY3Jvc29mdCBBbWVyaWNhIE9wZXJh
// SIG // dGlvbnMxJjAkBgNVBAsTHVRoYWxlcyBUU1MgRVNOOjQ5
// SIG // QkMtRTM3QS0yMzNDMSUwIwYDVQQDExxNaWNyb3NvZnQg
// SIG // VGltZS1TdGFtcCBTZXJ2aWNloiMKAQEwBwYFKw4DAhoD
// SIG // FQAQEOxMRdfSpMFS9RNwHfJND3m+naCBgzCBgKR+MHwx
// SIG // CzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9u
// SIG // MRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNy
// SIG // b3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jv
// SIG // c29mdCBUaW1lLVN0YW1wIFBDQSAyMDEwMA0GCSqGSIb3
// SIG // DQEBBQUAAgUA57yOIDAiGA8yMDIzMDMxNjAyMzQwOFoY
// SIG // DzIwMjMwMzE3MDIzNDA4WjB3MD0GCisGAQQBhFkKBAEx
// SIG // LzAtMAoCBQDnvI4gAgEAMAoCAQACAgZBAgH/MAcCAQAC
// SIG // Akq3MAoCBQDnvd+gAgEAMDYGCisGAQQBhFkKBAIxKDAm
// SIG // MAwGCisGAQQBhFkKAwKgCjAIAgEAAgMHoSChCjAIAgEA
// SIG // AgMBhqAwDQYJKoZIhvcNAQEFBQADgYEAYgYzJFbPC1ER
// SIG // Za4gVEq/vhgT0WJn7GZU2SFOBDIXy+lc9nM0vq9+CCuh
// SIG // YJMyslX8nbtcpwMDWxNwj46fpdWZEsDgc9TgkuElfntB
// SIG // OMvDpuf+1B+9Uy7lJo25sX4Hpd2tiAQQuAx478IohQ8j
// SIG // kVGGVeL+Q1ku9s/Clsz2bT7JQLUxggQNMIIECQIBATCB
// SIG // kzB8MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGlu
// SIG // Z3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMV
// SIG // TWljcm9zb2Z0IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1N
// SIG // aWNyb3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAxMAITMwAA
// SIG // AcBVpI3DZBXFSwABAAABwDANBglghkgBZQMEAgEFAKCC
// SIG // AUowGgYJKoZIhvcNAQkDMQ0GCyqGSIb3DQEJEAEEMC8G
// SIG // CSqGSIb3DQEJBDEiBCDJ3SuvbSaEXbT4QDOtauknbPS/
// SIG // D66CoUX9Dft01KLnYDCB+gYLKoZIhvcNAQkQAi8xgeow
// SIG // gecwgeQwgb0EIFrxWKJSCFzBNMyv1ul7ApJGF+5WDW/c
// SIG // gPCccGNOD5NPMIGYMIGApH4wfDELMAkGA1UEBhMCVVMx
// SIG // EzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1Jl
// SIG // ZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3Jh
// SIG // dGlvbjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3Rh
// SIG // bXAgUENBIDIwMTACEzMAAAHAVaSNw2QVxUsAAQAAAcAw
// SIG // IgQgl+nAbN6PyCLUy+wcFygwn40ZUtbHYbd33KUwnDX5
// SIG // 0pEwDQYJKoZIhvcNAQELBQAEggIAuU0eQcocMH0V00jy
// SIG // K/97w9QpYaqUtpF05o0MliIqdrphteuyJtGuW46snCwe
// SIG // Sj3EsTLOlBRUZYyhcxCulYcDLyg/d5I5aUuy39b0gdeh
// SIG // S6k4VrPptMNbHOX+aOYMR1mibYuBNeOTBQAv6gRT/Kcr
// SIG // Dtu2VdZPmER7+liCIjPiyrAfL/ux6IKw8kO0mPVcTwFf
// SIG // KdDMM1QH0rNq2NkF7mDK/esFyHaM4RF6J8wHBXwzmzrg
// SIG // SiEdKoRkmibzbnNkQXTOWq+GuONgcO+KOPcOSygmsyHJ
// SIG // zLMIqVjeq0Z9J9AopZSOMSt6S+ZFDj4RS07XgsMY5dGV
// SIG // iupZ+JxLpik7V9OIgdPjanas9ClDj8+h2gTDBpEPeDNV
// SIG // yJeMgDv6jYQsqz+/Lz2j0QqzGOQSK8jMCLsLMqS2TmHB
// SIG // CEoPsAdbvu1/fn2B2MYH1I6VH72Da1y8swv3CLowUxFE
// SIG // L0zQeif3sSUhkMcW/nSRGYuRbetNSg6aVJOlOdl7D8fm
// SIG // pLcZnhmvQzI2Wr7YByeIzOgYSETMeYlR6rVYfGeenAQ3
// SIG // QhftS4hZ6kUjlatfC37P3qghj6CPPkwXVuod01OvvHKi
// SIG // ppEINEAyGu61BialkNicE2YYzV8WdjFbxNsVzS6qSW4E
// SIG // dXX9l4Z8VleVnhH8IgR1zlHhu6rgLl3COknE0K5Jtn5B
// SIG // 1pO6Jt0=
// SIG // End signature block
