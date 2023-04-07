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
exports.BoardManager = void 0;
const fs = require("fs");
const path = require("path");
const url = require("url");
const vscode = require("vscode");
const util = require("../common/util");
const constants = require("../common/constants");
const outputChannel_1 = require("../common/outputChannel");
const utils_1 = require("../common/sharedUtilities/utils");
const deviceContext_1 = require("../deviceContext");
const board_1 = require("./board");
const package_1 = require("./package");
const programmer_1 = require("./programmer");
const vscodeSettings_1 = require("./vscodeSettings");
class BoardManager {
    constructor(_settings, _arduinoApp) {
        this._settings = _settings;
        this._arduinoApp = _arduinoApp;
        this._onBoardTypeChanged = new vscode.EventEmitter();
        this._boardConfigStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, constants.statusBarPriority.BOARD);
        this._boardConfigStatusBar.command = "arduino.showBoardConfig";
        this._boardConfigStatusBar.tooltip = "Show Board Config";
    }
    loadPackages(update = false) {
        return __awaiter(this, void 0, void 0, function* () {
            this._packages = [];
            this._platforms = [];
            this._installedPlatforms = [];
            const additionalUrls = this._arduinoApp.getAdditionalUrls();
            if (update) { // Update index files.
                yield this.setPreferenceUrls(additionalUrls);
                yield this._arduinoApp.initialize(true);
            }
            // Parse package index files.
            const indexFiles = ["package_index.json"].concat(additionalUrls);
            const rootPackageFolder = this._settings.packagePath;
            for (const indexFile of indexFiles) {
                const indexFileName = this.getIndexFileName(indexFile);
                if (!indexFileName) {
                    continue;
                }
                if (!update && !util.fileExistsSync(path.join(rootPackageFolder, indexFileName))) {
                    yield this.setPreferenceUrls(additionalUrls);
                    yield this._arduinoApp.initialize(true);
                }
                this.loadPackageContent(indexFileName);
            }
            // Load default platforms from arduino installation directory and user manually installed platforms.
            this.loadInstalledPlatforms();
            // Load all supported board types
            this.loadInstalledBoards();
            this.loadInstalledProgrammers();
            this.updateStatusBar();
            this._boardConfigStatusBar.show();
            const dc = deviceContext_1.DeviceContext.getInstance();
            dc.onChangeBoard(() => this.onDeviceContextBoardChange());
            dc.onChangeConfiguration(() => this.onDeviceContextConfigurationChange());
            // load initial board from DeviceContext by emulating
            // a board change event.
            this.onDeviceContextBoardChange();
            this.updateStatusBar(true);
        });
    }
    changeBoardType() {
        return __awaiter(this, void 0, void 0, function* () {
            const supportedBoardTypes = this.listBoards();
            if (supportedBoardTypes.length === 0) {
                vscode.window.showInformationMessage("No supported board is available.");
                return;
            }
            // TODO:? Add separator item between different platforms.
            const chosen = yield vscode.window.showQuickPick(supportedBoardTypes.map((entry) => {
                return {
                    label: entry.name,
                    description: entry.platform.name,
                    entry,
                };
            }).sort((a, b) => {
                if (a.description === b.description) {
                    return a.label === b.label ? 0 : (a.label > b.label ? 1 : -1);
                }
                else {
                    return a.description > b.description ? 1 : -1;
                }
            }), { placeHolder: "Select board type" });
            if (chosen && chosen.label) {
                this.doChangeBoardType(chosen.entry);
            }
        });
    }
    updatePackageIndex(indexUri) {
        return __awaiter(this, void 0, void 0, function* () {
            let allUrls = this._arduinoApp.getAdditionalUrls();
            if (!(allUrls.indexOf(indexUri) >= 0)) {
                allUrls = allUrls.concat(indexUri);
                vscodeSettings_1.VscodeSettings.getInstance().updateAdditionalUrls(allUrls);
                yield this._arduinoApp.setPref("boardsmanager.additional.urls", this._arduinoApp.getAdditionalUrls().join(","));
            }
            return true;
        });
    }
    get onBoardTypeChanged() {
        return this._onBoardTypeChanged.event;
    }
    doChangeBoardType(targetBoard) {
        const dc = deviceContext_1.DeviceContext.getInstance();
        if (dc.board === targetBoard.key) {
            return;
        }
        // Resetting the board first that we don't overwrite the configuration
        // of the previous board.
        this._currentBoard = null;
        // This will cause a configuration changed event which will have no
        // effect because no current board is set.
        dc.configuration = targetBoard.customConfig;
        // This will generate a device context board event which will set the
        // correct board and configuration. We know that it will trigger - we
        // made sure above that the boards actually differ
        dc.board = targetBoard.key;
    }
    get packages() {
        return this._packages;
    }
    get platforms() {
        return this._platforms;
    }
    get installedBoards() {
        return this._boards;
    }
    get installedProgrammers() {
        return this._programmers;
    }
    get currentBoard() {
        return this._currentBoard;
    }
    getInstalledPlatforms() {
        // Always using manually installed platforms to overwrite the same platform from arduino installation directory.
        const installedPlatforms = this.getDefaultPlatforms();
        const mergePlatform = (plat) => {
            const find = installedPlatforms.find((_plat) => {
                return _plat.packageName === plat.packageName && _plat.architecture === plat.architecture;
            });
            if (!find) {
                installedPlatforms.push(plat);
            }
            else {
                find.defaultPlatform = plat.defaultPlatform;
                find.version = plat.version;
                find.rootBoardPath = plat.rootBoardPath;
            }
        };
        const customPlatforms = this.getCustomPlatforms();
        const manuallyInstalled = this.getManuallyInstalledPlatforms();
        customPlatforms.forEach(mergePlatform);
        manuallyInstalled.forEach(mergePlatform);
        return installedPlatforms;
    }
    loadPackageContent(indexFile) {
        const indexFileName = this.getIndexFileName(indexFile);
        if (!util.fileExistsSync(path.join(this._settings.packagePath, indexFileName))) {
            return;
        }
        const packageContent = fs.readFileSync(path.join(this._settings.packagePath, indexFileName), "utf8");
        if (!packageContent) {
            return;
        }
        let rawModel = null;
        try {
            rawModel = JSON.parse(packageContent);
        }
        catch (ex) {
            outputChannel_1.arduinoChannel.error(`Invalid json file "${path.join(this._settings.packagePath, indexFileName)}".
            Suggest to remove it manually and allow boardmanager to re-download it.`);
            return;
        }
        if (!rawModel || !rawModel.packages || !rawModel.packages.length) {
            return;
        }
        this._packages = this._packages.concat(rawModel.packages);
        rawModel.packages.forEach((pkg) => {
            pkg.platforms.forEach((plat) => {
                plat.package = pkg;
                const addedPlatform = this._platforms
                    .find((_plat) => _plat.architecture === plat.architecture && _plat.package.name === plat.package.name);
                if (addedPlatform) {
                    // union boards from all versions.
                    // We should not union boards: https://github.com/Microsoft/vscode-arduino/issues/414
                    // addedPlatform.boards = util.union(addedPlatform.boards, plat.boards, (a, b) => {
                    //     return a.name === b.name;
                    // });
                    // Check if platform name is the same, if not, we should use the name from the latest version.
                    if (addedPlatform.name !== plat.name) {
                        addedPlatform.name = plat.name;
                    }
                    addedPlatform.versions.push(plat.version);
                    // Check if this is the latest version. Platforms typically support more boards in later versions.
                    addedPlatform.versions.sort(utils_1.versionCompare);
                    if (plat.version === addedPlatform.versions[addedPlatform.versions.length - 1]) {
                        addedPlatform.boards = plat.boards;
                    }
                }
                else {
                    plat.versions = [plat.version];
                    // Clear the version information since the plat will be used to contain all supported versions.
                    plat.version = "";
                    this._platforms.push(plat);
                }
            });
        });
    }
    updateInstalledPlatforms(pkgName, arch) {
        const archPath = path.join(this._settings.packagePath, "packages", pkgName, "hardware", arch);
        const allVersion = util.filterJunk(util.readdirSync(archPath, true));
        if (allVersion && allVersion.length) {
            const newPlatform = {
                packageName: pkgName,
                architecture: arch,
                version: allVersion[0],
                rootBoardPath: path.join(archPath, allVersion[0]),
                defaultPlatform: false,
            };
            const existingPlatform = this._platforms.find((_plat) => {
                return _plat.package.name === pkgName && _plat.architecture === arch;
            });
            if (existingPlatform) {
                existingPlatform.defaultPlatform = newPlatform.defaultPlatform;
                if (!existingPlatform.installedVersion) {
                    existingPlatform.installedVersion = newPlatform.version;
                    existingPlatform.rootBoardPath = newPlatform.rootBoardPath;
                    this._installedPlatforms.push(existingPlatform);
                }
                this.loadInstalledBoardsFromPlatform(existingPlatform);
                this.loadInstalledProgrammersFromPlatform(existingPlatform);
            }
        }
    }
    updateStatusBar(show = true) {
        if (show) {
            this._boardConfigStatusBar.show();
            if (this._currentBoard) {
                this._boardConfigStatusBar.text = this._currentBoard.name;
            }
            else {
                this._boardConfigStatusBar.text = "<Select Board Type>";
            }
        }
        else {
            this._boardConfigStatusBar.hide();
        }
    }
    /**
     * Event callback if DeviceContext detected a new board - either when
     * loaded from configuration file or when set by the doChangeBoardType
     * member.
     */
    onDeviceContextBoardChange() {
        const dc = deviceContext_1.DeviceContext.getInstance();
        const newBoard = this._boards.get(dc.board);
        if (board_1.boardEqual(newBoard, this._currentBoard)) {
            return;
        }
        if (newBoard) {
            this._currentBoard = newBoard;
            if (dc.configuration) {
                // In case the configuration is incompatible, we reset it as
                // setting partially valid configurations can lead to nasty
                // surprises. When setting a new board this is acceptable
                const r = this._currentBoard.loadConfig(dc.configuration);
                if (r !== package_1.BoardConfigResult.Success && r !== package_1.BoardConfigResult.SuccessNoChange) {
                    this._currentBoard.resetConfig();
                    // we don't reset dc.configuration to give the user a
                    // chance to fix her/his configuration
                    this.invalidConfigWarning(r);
                }
            }
            else {
                this._currentBoard.resetConfig();
                dc.configuration = undefined;
            }
        }
        else {
            this._currentBoard = null;
        }
        this._onBoardTypeChanged.fire();
        this.updateStatusBar();
    }
    /**
     * Event callback if DeviceContext detected a configuration change
     * - either when loaded from configuration file or when set by the
     * doChangeBoardType member.
     */
    onDeviceContextConfigurationChange() {
        const dc = deviceContext_1.DeviceContext.getInstance();
        if (this._currentBoard) {
            const r = this._currentBoard.loadConfig(dc.configuration);
            if (r !== package_1.BoardConfigResult.Success && r !== package_1.BoardConfigResult.SuccessNoChange) {
                this._currentBoard.resetConfig();
                // We reset the configuration here but do not write it back
                // to the configuration file - this can be annoying when
                // someone tries to set a special configuration and doesn't
                // get it right the first time.
                this.invalidConfigWarning(r);
            }
        }
    }
    invalidConfigWarning(result) {
        let what = "";
        switch (result) {
            case package_1.BoardConfigResult.InvalidFormat:
                what = ": Invalid format must be of the form \"key1=value2,key1=value2,...\"";
                break;
            case package_1.BoardConfigResult.InvalidConfigID:
                what = ": Invalid configuration key";
                break;
            case package_1.BoardConfigResult.InvalidOptionID:
                what = ": Invalid configuration value";
                break;
        }
        vscode.window.showWarningMessage(`Invalid board configuration detected in configuration file${what}. Falling back to defaults.`);
    }
    loadInstalledPlatforms() {
        const installed = this.getInstalledPlatforms();
        installed.forEach((platform) => {
            const existingPlatform = this._platforms.find((_plat) => {
                return _plat.package.name === platform.packageName && _plat.architecture === platform.architecture;
            });
            if (existingPlatform) {
                existingPlatform.defaultPlatform = platform.defaultPlatform;
                if (!existingPlatform.installedVersion) {
                    existingPlatform.installedVersion = platform.version;
                    existingPlatform.rootBoardPath = platform.rootBoardPath;
                    this._installedPlatforms.push(existingPlatform);
                }
            }
            else {
                platform.installedVersion = platform.version;
                this._installedPlatforms.push(platform);
            }
        });
    }
    // Default arduino package information from arduino installation directory.
    getDefaultPlatforms() {
        const defaultPlatforms = [];
        try {
            const packageBundled = fs.readFileSync(path.join(this._settings.defaultPackagePath, "package_index_bundled.json"), "utf8");
            if (!packageBundled) {
                return defaultPlatforms;
            }
            const bundledObject = JSON.parse(packageBundled);
            if (bundledObject && bundledObject.packages) {
                for (const pkg of bundledObject.packages) {
                    for (const platform of pkg.platforms) {
                        if (platform.version) {
                            defaultPlatforms.push({
                                packageName: pkg.name,
                                architecture: platform.architecture,
                                version: platform.version,
                                rootBoardPath: path.join(this._settings.defaultPackagePath, pkg.name, platform.architecture),
                                defaultPlatform: true,
                            });
                        }
                    }
                }
            }
        }
        catch (ex) {
        }
        return defaultPlatforms;
    }
    getCustomPlatforms() {
        const customPlatforms = [];
        const hardwareFolder = path.join(this._settings.sketchbookPath, "hardware");
        if (!util.directoryExistsSync(hardwareFolder)) {
            return customPlatforms;
        }
        const dirs = util.filterJunk(util.readdirSync(hardwareFolder, true)); // in Mac, filter .DS_Store file.
        if (!dirs || dirs.length < 1) {
            return customPlatforms;
        }
        for (const packageName of dirs) {
            const architectures = util.filterJunk(util.readdirSync(path.join(hardwareFolder, packageName), true));
            if (!architectures || architectures.length < 1) {
                continue;
            }
            architectures.forEach((architecture) => {
                const platformFolder = path.join(hardwareFolder, packageName, architecture);
                if (util.fileExistsSync(path.join(platformFolder, "boards.txt")) && util.fileExistsSync(path.join(platformFolder, "platform.txt"))) {
                    const configs = util.parseConfigFile(path.join(platformFolder, "platform.txt"));
                    customPlatforms.push({
                        packageName,
                        architecture,
                        version: configs.get("version"),
                        rootBoardPath: path.join(hardwareFolder, packageName, architecture),
                        defaultPlatform: false,
                    });
                }
            });
        }
        return customPlatforms;
    }
    // User manually installed packages.
    getManuallyInstalledPlatforms() {
        const manuallyInstalled = [];
        const rootPackagePath = path.join(path.join(this._settings.packagePath, "packages"));
        if (!util.directoryExistsSync(rootPackagePath)) {
            return manuallyInstalled;
        }
        const dirs = util.filterJunk(util.readdirSync(rootPackagePath, true)); // in Mac, filter .DS_Store file.
        for (const packageName of dirs) {
            const archPath = path.join(this._settings.packagePath, "packages", packageName, "hardware");
            if (!util.directoryExistsSync(archPath)) {
                continue;
            }
            const architectures = util.filterJunk(util.readdirSync(archPath, true));
            architectures.forEach((architecture) => {
                const allVersion = util.filterJunk(util.readdirSync(path.join(archPath, architecture), true));
                if (allVersion && allVersion.length) {
                    manuallyInstalled.push({
                        packageName,
                        architecture,
                        version: allVersion[0],
                        rootBoardPath: path.join(archPath, architecture, allVersion[0]),
                        defaultPlatform: false,
                    });
                }
            });
        }
        return manuallyInstalled;
    }
    loadInstalledBoards() {
        this._boards = new Map();
        this._installedPlatforms.forEach((plat) => {
            this.loadInstalledBoardsFromPlatform(plat);
        });
    }
    loadInstalledBoardsFromPlatform(plat) {
        if (util.fileExistsSync(path.join(plat.rootBoardPath, "boards.txt"))) {
            const boardContent = fs.readFileSync(path.join(plat.rootBoardPath, "boards.txt"), "utf8");
            const res = board_1.parseBoardDescriptor(boardContent, plat);
            res.forEach((bd) => {
                this._boards.set(bd.key, bd);
            });
        }
    }
    loadInstalledProgrammers() {
        this._programmers = new Map();
        this._installedPlatforms.forEach((plat) => {
            this.loadInstalledProgrammersFromPlatform(plat);
        });
    }
    loadInstalledProgrammersFromPlatform(plat) {
        if (util.fileExistsSync(path.join(plat.rootBoardPath, "programmers.txt"))) {
            const programmersContent = fs.readFileSync(path.join(plat.rootBoardPath, "programmers.txt"), "utf8");
            const res = programmer_1.parseProgrammerDescriptor(programmersContent, plat);
            res.forEach((prog) => {
                this._programmers.set(prog.name, prog);
            });
        }
    }
    listBoards() {
        const result = [];
        this._boards.forEach((b) => {
            result.push(b);
        });
        return result;
    }
    getIndexFileName(uriString) {
        if (!uriString) {
            return;
        }
        const normalizedUrl = url.parse(uriString);
        if (!normalizedUrl) {
            return;
        }
        return normalizedUrl.pathname.substr(normalizedUrl.pathname.lastIndexOf("/") + 1);
    }
    setPreferenceUrls(additionalUrls) {
        return __awaiter(this, void 0, void 0, function* () {
            const settingsUrls = additionalUrls.join(",");
            if (this._settings.preferences.get("boardsmanager.additional.urls") !== settingsUrls) {
                yield this._arduinoApp.setPref("boardsmanager.additional.urls", settingsUrls);
            }
        });
    }
}
exports.BoardManager = BoardManager;

//# sourceMappingURL=boardManager.js.map

// SIG // Begin signature block
// SIG // MIInzAYJKoZIhvcNAQcCoIInvTCCJ7kCAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // MMG0SwvEof03FUT9nMuK89Wkv6Iu3COWSJ82kB0hFAug
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
// SIG // ghmfMIIZmwIBATCBlTB+MQswCQYDVQQGEwJVUzETMBEG
// SIG // A1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9u
// SIG // ZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9u
// SIG // MSgwJgYDVQQDEx9NaWNyb3NvZnQgQ29kZSBTaWduaW5n
// SIG // IFBDQSAyMDExAhMzAAACzfNkv/jUTF1RAAAAAALNMA0G
// SIG // CWCGSAFlAwQCAQUAoIGuMBkGCSqGSIb3DQEJAzEMBgor
// SIG // BgEEAYI3AgEEMBwGCisGAQQBgjcCAQsxDjAMBgorBgEE
// SIG // AYI3AgEVMC8GCSqGSIb3DQEJBDEiBCCHCB8GfND/x8vF
// SIG // tptJSFrXzJLoj/dTLtp8imepiy/yLzBCBgorBgEEAYI3
// SIG // AgEMMTQwMqAUgBIATQBpAGMAcgBvAHMAbwBmAHShGoAY
// SIG // aHR0cDovL3d3dy5taWNyb3NvZnQuY29tMA0GCSqGSIb3
// SIG // DQEBAQUABIIBADW+rrZmRJkehkmxzKHThIKIQmB4S3vk
// SIG // GGpsaDhjg6AmCWvCTdrOcG3uUoC5yUW/FY3ltMnGPTX/
// SIG // XNVUNoEcYezGUA5vSxJaiL8bOf2iDnwXAps5IWTzPv8o
// SIG // PJIS4vZqWikSvz3YAbtB5bxNZRpvYkUSg+KHxdDX13gr
// SIG // flhWZo4xZBSnGbzaJ4sw3YG1JXDwJTzb236h25MpNnDu
// SIG // h2iKsVk6B+bjC+Dge5qeWkbhlZ/zrZVrn26BG01+GcrO
// SIG // y/DF/OG7bcK4aqhK3Y5NJxWCD0FinnbTasL6hrZ22bbx
// SIG // spwzeILW5uWuwPcB3dHoQrT02NcShwQtDf7gISR0mI4O
// SIG // wQChghcpMIIXJQYKKwYBBAGCNwMDATGCFxUwghcRBgkq
// SIG // hkiG9w0BBwKgghcCMIIW/gIBAzEPMA0GCWCGSAFlAwQC
// SIG // AQUAMIIBWQYLKoZIhvcNAQkQAQSgggFIBIIBRDCCAUAC
// SIG // AQEGCisGAQQBhFkKAwEwMTANBglghkgBZQMEAgEFAAQg
// SIG // LocvOknrSFPOpRqVmStSgcB5EKaFb2Qoek0tAir2hf4C
// SIG // BmP3WVm7hBgTMjAyMzAzMTUyMTA2NDEuNzk4WjAEgAIB
// SIG // 9KCB2KSB1TCB0jELMAkGA1UEBhMCVVMxEzARBgNVBAgT
// SIG // Cldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAc
// SIG // BgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEtMCsG
// SIG // A1UECxMkTWljcm9zb2Z0IElyZWxhbmQgT3BlcmF0aW9u
// SIG // cyBMaW1pdGVkMSYwJAYDVQQLEx1UaGFsZXMgVFNTIEVT
// SIG // TjozQkQ0LTRCODAtNjlDMzElMCMGA1UEAxMcTWljcm9z
// SIG // b2Z0IFRpbWUtU3RhbXAgU2VydmljZaCCEXgwggcnMIIF
// SIG // D6ADAgECAhMzAAABtPuACEQF0i36AAEAAAG0MA0GCSqG
// SIG // SIb3DQEBCwUAMHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQI
// SIG // EwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4w
// SIG // HAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAk
// SIG // BgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAy
// SIG // MDEwMB4XDTIyMDkyMDIwMjIwOVoXDTIzMTIxNDIwMjIw
// SIG // OVowgdIxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNo
// SIG // aW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQK
// SIG // ExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xLTArBgNVBAsT
// SIG // JE1pY3Jvc29mdCBJcmVsYW5kIE9wZXJhdGlvbnMgTGlt
// SIG // aXRlZDEmMCQGA1UECxMdVGhhbGVzIFRTUyBFU046M0JE
// SIG // NC00QjgwLTY5QzMxJTAjBgNVBAMTHE1pY3Jvc29mdCBU
// SIG // aW1lLVN0YW1wIFNlcnZpY2UwggIiMA0GCSqGSIb3DQEB
// SIG // AQUAA4ICDwAwggIKAoICAQC0R6aeZQcyQh+86K7bsrzp
// SIG // lvBaGSwbBXvYOXW4Z2qvakqb6Z/OhP5ieCSr1osR/5cO
// SIG // 0APID7YohlTSI7xYbv14mPPPb1+VmkEpsqDzGXY/c712
// SIG // uV65DDdOc1803j5AiCMxekTe3E8XszshEspkyI63cV+Q
// SIG // VZWaJckADsTc4jAmCmGDT22HdO/OnwxPz4c60bdt2tF3
// SIG // /La7xWtCxBMtmJXBNnqoNgo1Pw9BmXvEWtJI7dDNdr3U
// SIG // uKlmdg6XeyIYkMJ57UFrtfWLXd1AUfEqXkV/gnMN244F
// SIG // nzl7ZWunIXLVrdrIZTMGsjDn2OExuMjD1hVxC32RRae3
// SIG // IKY2TXlbJsJL6FekQMMtWPVflb2yeahbWq7Tf66emtCN
// SIG // ZBpW47sF9y9B01V3IpKoB4rLV5PYdxzmfVoBV5cWbqxt
// SIG // UmZnM9ARBHcmvtbxhxOOSoLmFPaqti4hxgY5/c+Pg6p1
// SIG // ebVCqG7C2yTG+K/vLLdn4/EmnErH7Z7rMZFqhCYiUt+D
// SIG // 9rjZc1UdN/pbOvmTtDXDu/S4D+wWyDIqYjsfModfTzEM
// SIG // NKYmihcDlu0PoHSXH8uqzpBvgq2GcDs3YgR0nmyMwiHI
// SIG // dnAGvt/MOyRT/5KCnZSd+qs3VV1r+Bv6maVsnCLwymG8
// SIG // SVjONPs9krYObh6ityPHtPZBV7cQh6Uu4ZvHPJtuVmhF
// SIG // OQIDAQABo4IBSTCCAUUwHQYDVR0OBBYEFMtEheXxlLg6
// SIG // nLsSKLdO3jjMMtl+MB8GA1UdIwQYMBaAFJ+nFV0AXmJd
// SIG // g/Tl0mWnG1M1GelyMF8GA1UdHwRYMFYwVKBSoFCGTmh0
// SIG // dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMvY3Js
// SIG // L01pY3Jvc29mdCUyMFRpbWUtU3RhbXAlMjBQQ0ElMjAy
// SIG // MDEwKDEpLmNybDBsBggrBgEFBQcBAQRgMF4wXAYIKwYB
// SIG // BQUHMAKGUGh0dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9w
// SIG // a2lvcHMvY2VydHMvTWljcm9zb2Z0JTIwVGltZS1TdGFt
// SIG // cCUyMFBDQSUyMDIwMTAoMSkuY3J0MAwGA1UdEwEB/wQC
// SIG // MAAwFgYDVR0lAQH/BAwwCgYIKwYBBQUHAwgwDgYDVR0P
// SIG // AQH/BAQDAgeAMA0GCSqGSIb3DQEBCwUAA4ICAQAS0Q8F
// SIG // jCm3gmKhKrSOgbPCphfpKg0fthuqmACt2Wet23q7e6Qp
// SIG // ESW4oRWpLZdqNfHHRSRcZzheL12nZtLGm7JCdOSr4hDC
// SIG // SDunV0qvABra92Zo3PPeatJp5QS7jTIJOEfCq5CTB6gb
// SIG // h6pFFl7X061VKYMM0LdlDoiDSrPv2+K9eDLl0VaTienE
// SIG // DkvFIZHjAFpdoi5WGgRrTq93/3/ZixD31sKJHtLElG3V
// SIG // etDmQkYdSLQWGDPXnyq9eB+aruo2p+p9NKaxBGu1t7hm
// SIG // /9f6o+j+Xpp75KsuRyNF+vQ41XS8VW40rHoJv3QPkuA2
// SIG // lz3HxX+ogcSv4ldtZdbqYBFVWo1AKZeVUeNMGOFxfBKZ
// SIG // p1HU6i1w3+wqnYQ4z0k9ivzo71j8kBkL3O6D2qWMpOuh
// SIG // lN9gDssh1yY+vr27UVIP/qK8vodEdl3+TYQvsW1nDM1x
// SIG // FF0UX9WCmQ7Ech+q+NdqZvCgyhP6+0ZO2qCiu6GFKTRs
// SIG // zUX+kGmL+c9m1U0sZM1orxa3qSxxsL0bp/T2DP/AEEk4
// SIG // Ga9Ms845P/e1oIZKgmgMAFacr4N7mmJ7gpfwHHEpBsm/
// SIG // HPu9GxUnlHqYbH4G9q/kCOzG9lnDp5CaQjS89FyTEv1M
// SIG // JUJ9ZLS7IgqbKjpN2iydsE7+iyt7uvSNL0AfyykSpWWE
// SIG // VylA186D8K91LbE1UzCCB3EwggVZoAMCAQICEzMAAAAV
// SIG // xedrngKbSZkAAAAAABUwDQYJKoZIhvcNAQELBQAwgYgx
// SIG // CzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9u
// SIG // MRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNy
// SIG // b3NvZnQgQ29ycG9yYXRpb24xMjAwBgNVBAMTKU1pY3Jv
// SIG // c29mdCBSb290IENlcnRpZmljYXRlIEF1dGhvcml0eSAy
// SIG // MDEwMB4XDTIxMDkzMDE4MjIyNVoXDTMwMDkzMDE4MzIy
// SIG // NVowfDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hp
// SIG // bmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoT
// SIG // FU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEmMCQGA1UEAxMd
// SIG // TWljcm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTAwggIi
// SIG // MA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQDk4aZM
// SIG // 57RyIQt5osvXJHm9DtWC0/3unAcH0qlsTnXIyjVX9gF/
// SIG // bErg4r25PhdgM/9cT8dm95VTcVrifkpa/rg2Z4VGIwy1
// SIG // jRPPdzLAEBjoYH1qUoNEt6aORmsHFPPFdvWGUNzBRMhx
// SIG // XFExN6AKOG6N7dcP2CZTfDlhAnrEqv1yaa8dq6z2Nr41
// SIG // JmTamDu6GnszrYBbfowQHJ1S/rboYiXcag/PXfT+jlPP
// SIG // 1uyFVk3v3byNpOORj7I5LFGc6XBpDco2LXCOMcg1KL3j
// SIG // tIckw+DJj361VI/c+gVVmG1oO5pGve2krnopN6zL64NF
// SIG // 50ZuyjLVwIYwXE8s4mKyzbnijYjklqwBSru+cakXW2dg
// SIG // 3viSkR4dPf0gz3N9QZpGdc3EXzTdEonW/aUgfX782Z5F
// SIG // 37ZyL9t9X4C626p+Nuw2TPYrbqgSUei/BQOj0XOmTTd0
// SIG // lBw0gg/wEPK3Rxjtp+iZfD9M269ewvPV2HM9Q07BMzlM
// SIG // jgK8QmguEOqEUUbi0b1qGFphAXPKZ6Je1yh2AuIzGHLX
// SIG // pyDwwvoSCtdjbwzJNmSLW6CmgyFdXzB0kZSU2LlQ+QuJ
// SIG // YfM2BjUYhEfb3BvR/bLUHMVr9lxSUV0S2yW6r1AFemzF
// SIG // ER1y7435UsSFF5PAPBXbGjfHCBUYP3irRbb1Hode2o+e
// SIG // FnJpxq57t7c+auIurQIDAQABo4IB3TCCAdkwEgYJKwYB
// SIG // BAGCNxUBBAUCAwEAATAjBgkrBgEEAYI3FQIEFgQUKqdS
// SIG // /mTEmr6CkTxGNSnPEP8vBO4wHQYDVR0OBBYEFJ+nFV0A
// SIG // XmJdg/Tl0mWnG1M1GelyMFwGA1UdIARVMFMwUQYMKwYB
// SIG // BAGCN0yDfQEBMEEwPwYIKwYBBQUHAgEWM2h0dHA6Ly93
// SIG // d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMvRG9jcy9SZXBv
// SIG // c2l0b3J5Lmh0bTATBgNVHSUEDDAKBggrBgEFBQcDCDAZ
// SIG // BgkrBgEEAYI3FAIEDB4KAFMAdQBiAEMAQTALBgNVHQ8E
// SIG // BAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAfBgNVHSMEGDAW
// SIG // gBTV9lbLj+iiXGJo0T2UkFvXzpoYxDBWBgNVHR8ETzBN
// SIG // MEugSaBHhkVodHRwOi8vY3JsLm1pY3Jvc29mdC5jb20v
// SIG // cGtpL2NybC9wcm9kdWN0cy9NaWNSb29DZXJBdXRfMjAx
// SIG // MC0wNi0yMy5jcmwwWgYIKwYBBQUHAQEETjBMMEoGCCsG
// SIG // AQUFBzAChj5odHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20v
// SIG // cGtpL2NlcnRzL01pY1Jvb0NlckF1dF8yMDEwLTA2LTIz
// SIG // LmNydDANBgkqhkiG9w0BAQsFAAOCAgEAnVV9/Cqt4Swf
// SIG // ZwExJFvhnnJL/Klv6lwUtj5OR2R4sQaTlz0xM7U518Jx
// SIG // Nj/aZGx80HU5bbsPMeTCj/ts0aGUGCLu6WZnOlNN3Zi6
// SIG // th542DYunKmCVgADsAW+iehp4LoJ7nvfam++Kctu2D9I
// SIG // dQHZGN5tggz1bSNU5HhTdSRXud2f8449xvNo32X2pFaq
// SIG // 95W2KFUn0CS9QKC/GbYSEhFdPSfgQJY4rPf5KYnDvBew
// SIG // VIVCs/wMnosZiefwC2qBwoEZQhlSdYo2wh3DYXMuLGt7
// SIG // bj8sCXgU6ZGyqVvfSaN0DLzskYDSPeZKPmY7T7uG+jIa
// SIG // 2Zb0j/aRAfbOxnT99kxybxCrdTDFNLB62FD+CljdQDzH
// SIG // VG2dY3RILLFORy3BFARxv2T5JL5zbcqOCb2zAVdJVGTZ
// SIG // c9d/HltEAY5aGZFrDZ+kKNxnGSgkujhLmm77IVRrakUR
// SIG // R6nxt67I6IleT53S0Ex2tVdUCbFpAUR+fKFhbHP+Crvs
// SIG // QWY9af3LwUFJfn6Tvsv4O+S3Fb+0zj6lMVGEvL8CwYKi
// SIG // excdFYmNcP7ntdAoGokLjzbaukz5m/8K6TT4JDVnK+AN
// SIG // uOaMmdbhIurwJ0I9JZTmdHRbatGePu1+oDEzfbzL6Xu/
// SIG // OHBE0ZDxyKs6ijoIYn/ZcGNTTY3ugm2lBRDBcQZqELQd
// SIG // VTNYs6FwZvKhggLUMIICPQIBATCCAQChgdikgdUwgdIx
// SIG // CzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9u
// SIG // MRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNy
// SIG // b3NvZnQgQ29ycG9yYXRpb24xLTArBgNVBAsTJE1pY3Jv
// SIG // c29mdCBJcmVsYW5kIE9wZXJhdGlvbnMgTGltaXRlZDEm
// SIG // MCQGA1UECxMdVGhhbGVzIFRTUyBFU046M0JENC00Qjgw
// SIG // LTY5QzMxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1lLVN0
// SIG // YW1wIFNlcnZpY2WiIwoBATAHBgUrDgMCGgMVAGWc2JDz
// SIG // m5f2c3gpEm3+AeQnHgkIoIGDMIGApH4wfDELMAkGA1UE
// SIG // BhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNV
// SIG // BAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBD
// SIG // b3Jwb3JhdGlvbjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRp
// SIG // bWUtU3RhbXAgUENBIDIwMTAwDQYJKoZIhvcNAQEFBQAC
// SIG // BQDnvDTnMCIYDzIwMjMwMzE1MjAxMzI3WhgPMjAyMzAz
// SIG // MTYyMDEzMjdaMHQwOgYKKwYBBAGEWQoEATEsMCowCgIF
// SIG // AOe8NOcCAQAwBwIBAAICDN8wBwIBAAICEbwwCgIFAOe9
// SIG // hmcCAQAwNgYKKwYBBAGEWQoEAjEoMCYwDAYKKwYBBAGE
// SIG // WQoDAqAKMAgCAQACAwehIKEKMAgCAQACAwGGoDANBgkq
// SIG // hkiG9w0BAQUFAAOBgQBs9tJEWUsyRJUEWM6QkSgHgnmM
// SIG // nddEcf7e0SYobRJKHlLA+8YT9xcydPZQBl9w0GE8ACWA
// SIG // ZhrXtagF43Ki3Ghh2P4fF7gC2Ptx2CANPiLU2GNUL4K6
// SIG // 2fFryqQ0OlRSEihWfzYIqOqiZhBdLJEZyjSisoZukLnC
// SIG // x8w6Ul/911HuSDGCBA0wggQJAgEBMIGTMHwxCzAJBgNV
// SIG // BAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYD
// SIG // VQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQg
// SIG // Q29ycG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jvc29mdCBU
// SIG // aW1lLVN0YW1wIFBDQSAyMDEwAhMzAAABtPuACEQF0i36
// SIG // AAEAAAG0MA0GCWCGSAFlAwQCAQUAoIIBSjAaBgkqhkiG
// SIG // 9w0BCQMxDQYLKoZIhvcNAQkQAQQwLwYJKoZIhvcNAQkE
// SIG // MSIEIO5utTZlEzyeASycDXcRK5laZlMimJy7Muj+o7SN
// SIG // BFpaMIH6BgsqhkiG9w0BCRACLzGB6jCB5zCB5DCBvQQg
// SIG // 08j3e+ajMHAGUXG9+v+sSWt4U9Hi7Hu9crHaeLcB9wYw
// SIG // gZgwgYCkfjB8MQswCQYDVQQGEwJVUzETMBEGA1UECBMK
// SIG // V2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwG
// SIG // A1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSYwJAYD
// SIG // VQQDEx1NaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAx
// SIG // MAITMwAAAbT7gAhEBdIt+gABAAABtDAiBCBsmmrWrF8f
// SIG // BmADQdHC6RzU2ICQO0FNBncscBNmHKgDBjANBgkqhkiG
// SIG // 9w0BAQsFAASCAgBjSfKalAT/V8nX1GRRYdaXP7h4LzDb
// SIG // G4V9nn7ovTPpIud9H8HwQXZoGj8aC3AsDQV3utJYcnCL
// SIG // yJ5pz6HojzjNiMJQ8Se6AIKuJMUznOhJkBtO2uqxiAKB
// SIG // Pk3vNF4GJ5GFyUuFqDniPkkR3hX/7TsECQ724av0RKze
// SIG // N95/SDZrEUmyQot608O5VbFv73YdFJHQQTkHx/LOHRIj
// SIG // 8FPVrfFcTYY5cC2M+ukL8JYNmxd7lJ67/g2SWfD1do8g
// SIG // Ro6L/lxdP2BvcdlrPGe+ngVL/e1mFQsiGLCQgIwosUlA
// SIG // SxAm5hzhVZtiyUj+xv68Fe+iUj+RGRZzU+Pj1b/4RTiL
// SIG // 34mRUc5XsF8g6hlf2WoTTA2j91xcPXP98YseqX0Aa4xN
// SIG // 21muwcgIl7vUp0YpQmuQK5QTeup0pe8CHEb8DeRin2ZE
// SIG // Vt2OGH2zSlA9MAe5kuNd2+cihbeIaFLYvQWPmazVn0H+
// SIG // BpWsJZ7EuE9g6Qp7eqYPS376QUOsfXcPRBjhd6pbtFkL
// SIG // q9YRa9eUMoNCqq0FRi9exUii7FxpE/BsjJUp5TzjMam7
// SIG // ra0nDIO0A+JF7nOKMb186QoGSzVP02pQFWk1cGqGa1WY
// SIG // N3tE9nooeY+8YGKo0xV44vtchPPbS/nTtHF9OpefDwJl
// SIG // uYcp/YRvRXIe/8PWCJq3X2Fvah9Ii6EM10jQWw==
// SIG // End signature block
