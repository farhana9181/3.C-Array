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
exports.LibraryManager = void 0;
const fs = require("fs");
const path = require("path");
const util = require("../common/util");
class LibraryManager {
    constructor(_settings, _arduinoApp) {
        this._settings = _settings;
        this._arduinoApp = _arduinoApp;
    }
    get libraries() {
        return this._libraries;
    }
    loadLibraries(update = false) {
        return __awaiter(this, void 0, void 0, function* () {
            this._libraryMap = new Map();
            this._libraries = [];
            const libraryIndexFilePath = path.join(this._settings.packagePath, "library_index.json");
            if (update || !util.fileExistsSync(libraryIndexFilePath)) {
                yield this._arduinoApp.initializeLibrary(true);
            }
            // Parse libraries index file "library_index.json"
            const packageContent = fs.readFileSync(libraryIndexFilePath, "utf8");
            this.parseLibraryIndex(JSON.parse(packageContent));
            // Load default Arduino libraries from Arduino installation package.
            yield this.loadInstalledLibraries(this._settings.defaultLibPath, true);
            // Load manually installed libraries.
            yield this.loadInstalledLibraries(path.join(this._settings.sketchbookPath, "libraries"), false);
            // Load libraries from installed board packages.
            const builtinLibs = yield this.loadBoardLibraries();
            this._libraries = Array.from(this._libraryMap.values());
            this._libraries = this._libraries.concat(builtinLibs);
            // Mark those libraries that are supported by current board's architecture.
            this.tagSupportedLibraries();
        });
    }
    parseLibraryIndex(rawModel) {
        rawModel.libraries.forEach((library) => {
            // Arduino install-library program will replace the blank space of the library folder name with underscore,
            // here format library name consistently for better parsing at the next steps.
            const formattedName = library.name.replace(/\s+/g, "_");
            const existingLib = this._libraryMap.get(formattedName);
            if (existingLib) {
                existingLib.versions.push(library.version);
            }
            else {
                library.versions = [library.version];
                library.builtIn = false;
                library.version = "";
                this._libraryMap.set(formattedName, library);
            }
        });
    }
    loadInstalledLibraries(libRoot, isBuiltin) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!util.directoryExistsSync(libRoot)) {
                return;
            }
            const installedLibDirs = util.filterJunk(util.readdirSync(libRoot, true));
            for (const libDir of installedLibDirs) {
                let sourceLib = null;
                if (util.fileExistsSync(path.join(libRoot, libDir, "library.properties"))) {
                    const properties = yield util.parseProperties(path.join(libRoot, libDir, "library.properties"));
                    const formattedName = properties.name.replace(/\s+/g, "_");
                    sourceLib = this._libraryMap.get(formattedName);
                    if (!sourceLib) {
                        sourceLib = Object.assign({}, properties);
                        sourceLib.website = properties.url;
                        this._libraryMap.set(formattedName, sourceLib);
                    }
                    sourceLib.version = util.formatVersion(properties.version);
                }
                else {
                    // For manually imported library, library.properties may be missing. Take the folder name as library name.
                    sourceLib = this._libraryMap.get(libDir);
                    if (!sourceLib) {
                        sourceLib = {
                            name: libDir,
                            types: ["Contributed"],
                        };
                        this._libraryMap.set(libDir, sourceLib);
                    }
                }
                sourceLib.builtIn = isBuiltin;
                sourceLib.installed = true;
                sourceLib.installedPath = path.join(libRoot, libDir);
                sourceLib.srcPath = path.join(libRoot, libDir, "src");
                // If lib src folder doesn't exist, then fallback to the lib root path as source folder.
                sourceLib.srcPath = util.directoryExistsSync(sourceLib.srcPath) ? sourceLib.srcPath : path.join(libRoot, libDir);
            }
        });
    }
    // Builtin libraries from board packages.
    loadBoardLibraries() {
        return __awaiter(this, void 0, void 0, function* () {
            let builtinLibs = [];
            const librarySet = new Set(this._libraryMap.keys());
            const installedPlatforms = this._arduinoApp.boardManager.getInstalledPlatforms();
            for (const board of installedPlatforms) {
                const libs = yield this.parseBoardLibraries(board.rootBoardPath, board.architecture, librarySet);
                builtinLibs = builtinLibs.concat(libs);
            }
            return builtinLibs;
        });
    }
    parseBoardLibraries(rootBoardPath, architecture, librarySet) {
        return __awaiter(this, void 0, void 0, function* () {
            const builtInLib = [];
            const builtInLibPath = path.join(rootBoardPath, "libraries");
            if (util.directoryExistsSync(builtInLibPath)) {
                const libDirs = util.filterJunk(util.readdirSync(builtInLibPath, true));
                if (!libDirs || !libDirs.length) {
                    return builtInLib;
                }
                for (const libDir of libDirs) {
                    let sourceLib = {};
                    if (util.fileExistsSync(path.join(builtInLibPath, libDir, "library.properties"))) {
                        const properties = yield util.parseProperties(path.join(builtInLibPath, libDir, "library.properties"));
                        sourceLib = Object.assign({}, properties);
                        sourceLib.version = util.formatVersion(sourceLib.version);
                        sourceLib.website = properties.url;
                    }
                    else {
                        sourceLib.name = libDir;
                    }
                    sourceLib.builtIn = true;
                    sourceLib.installed = true;
                    sourceLib.installedPath = path.join(builtInLibPath, libDir);
                    sourceLib.srcPath = path.join(builtInLibPath, libDir, "src");
                    // If lib src folder doesn't exist, then fallback to lib root path as source folder.
                    sourceLib.srcPath = util.directoryExistsSync(sourceLib.srcPath) ? sourceLib.srcPath : path.join(builtInLibPath, libDir);
                    sourceLib.architectures = [architecture];
                    // For libraries with the same name, append architecture info to name to avoid duplication.
                    if (librarySet.has(sourceLib.name)) {
                        sourceLib.name = sourceLib.name + "(" + architecture + ")";
                    }
                    if (!librarySet.has(sourceLib.name)) {
                        librarySet.add(sourceLib.name);
                        builtInLib.push(sourceLib);
                    }
                }
            }
            return builtInLib;
        });
    }
    tagSupportedLibraries() {
        const currentBoard = this._arduinoApp.boardManager.currentBoard;
        if (!currentBoard) {
            return;
        }
        const targetArch = currentBoard.platform.architecture;
        this._libraries.forEach((library) => {
            const architectures = [].concat(library.architectures || "*");
            library.supported = !!architectures.find((arch) => {
                return arch.indexOf(targetArch) >= 0 || arch.indexOf("*") >= 0;
            });
        });
    }
}
exports.LibraryManager = LibraryManager;

//# sourceMappingURL=libraryManager.js.map

// SIG // Begin signature block
// SIG // MIInnAYJKoZIhvcNAQcCoIInjTCCJ4kCAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // I1fZH7JoDaOWtwY1gCuixI61LMgMVEYYVaHjElEKMAig
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
// SIG // SEXAQsmbdlsKgEhr/Xmfwb1tbWrJUnMTDXpQzTGCGXMw
// SIG // ghlvAgEBMIGVMH4xCzAJBgNVBAYTAlVTMRMwEQYDVQQI
// SIG // EwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4w
// SIG // HAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xKDAm
// SIG // BgNVBAMTH01pY3Jvc29mdCBDb2RlIFNpZ25pbmcgUENB
// SIG // IDIwMTECEzMAAALMjrWWpr3RyU4AAAAAAswwDQYJYIZI
// SIG // AWUDBAIBBQCgga4wGQYJKoZIhvcNAQkDMQwGCisGAQQB
// SIG // gjcCAQQwHAYKKwYBBAGCNwIBCzEOMAwGCisGAQQBgjcC
// SIG // ARUwLwYJKoZIhvcNAQkEMSIEINp3mYPhuuEOm3ySW8au
// SIG // O2lZp69n10cXRACImnbYwCrtMEIGCisGAQQBgjcCAQwx
// SIG // NDAyoBSAEgBNAGkAYwByAG8AcwBvAGYAdKEagBhodHRw
// SIG // Oi8vd3d3Lm1pY3Jvc29mdC5jb20wDQYJKoZIhvcNAQEB
// SIG // BQAEggEAGVbtotT1ImdJSWiBGCxwtDf3KVp4XFfqff5Q
// SIG // kSwOGPL927TrZObwOJ3DulPmUIHFw48f6J1AdK2/6Rsy
// SIG // W+nDKHyINODlrdw539TQ6PedjX8TdIz5kn7JhlBbhWLW
// SIG // GbzzKgIndbKauKgYDbQXG8DSuoHkHcXwxyX63Fo2bTvX
// SIG // 8WSDs3MGSAShR6jYwZ3rWCckHnidfUHFs9N/FJTs9L9w
// SIG // mWbfiP6XIP+b2AePG3Reo5VYLxozzNFbk0DavUleZ6zT
// SIG // e3VdD4xZmjt37OQBXV858FG81ZMp9oEuuKzkbroYX10L
// SIG // AYeU9E/ALOlBWASb8AZB0fuNpxSTqk6CdW3IRbxFpqGC
// SIG // Fv0wghb5BgorBgEEAYI3AwMBMYIW6TCCFuUGCSqGSIb3
// SIG // DQEHAqCCFtYwghbSAgEDMQ8wDQYJYIZIAWUDBAIBBQAw
// SIG // ggFRBgsqhkiG9w0BCRABBKCCAUAEggE8MIIBOAIBAQYK
// SIG // KwYBBAGEWQoDATAxMA0GCWCGSAFlAwQCAQUABCAaLnS/
// SIG // LQ+hWNPQ5C+2sB++jM0NjLALyNCcpgeA9mipvAIGY7/w
// SIG // h57CGBMyMDIzMDEyNTAxMzAyNy4xMDhaMASAAgH0oIHQ
// SIG // pIHNMIHKMQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2Fz
// SIG // aGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UE
// SIG // ChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSUwIwYDVQQL
// SIG // ExxNaWNyb3NvZnQgQW1lcmljYSBPcGVyYXRpb25zMSYw
// SIG // JAYDVQQLEx1UaGFsZXMgVFNTIEVTTjo3QkYxLUUzRUEt
// SIG // QjgwODElMCMGA1UEAxMcTWljcm9zb2Z0IFRpbWUtU3Rh
// SIG // bXAgU2VydmljZaCCEVQwggcMMIIE9KADAgECAhMzAAAB
// SIG // yPmw7mft6mtGAAEAAAHIMA0GCSqGSIb3DQEBCwUAMHwx
// SIG // CzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9u
// SIG // MRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNy
// SIG // b3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jv
// SIG // c29mdCBUaW1lLVN0YW1wIFBDQSAyMDEwMB4XDTIyMTEw
// SIG // NDE5MDEzN1oXDTI0MDIwMjE5MDEzN1owgcoxCzAJBgNV
// SIG // BAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYD
// SIG // VQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQg
// SIG // Q29ycG9yYXRpb24xJTAjBgNVBAsTHE1pY3Jvc29mdCBB
// SIG // bWVyaWNhIE9wZXJhdGlvbnMxJjAkBgNVBAsTHVRoYWxl
// SIG // cyBUU1MgRVNOOjdCRjEtRTNFQS1CODA4MSUwIwYDVQQD
// SIG // ExxNaWNyb3NvZnQgVGltZS1TdGFtcCBTZXJ2aWNlMIIC
// SIG // IjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAucud
// SIG // fihPgyRWwnnIuJCqc3TCtFk0XOimFcKjU9bS6WFng2l+
// SIG // FrIid0mPZ7KWs6Ewj21X+ZkGkM6x+ozHlmNtnHSQ48pj
// SIG // IFdlKXIoh7fSo41A4n0tQIlwhs8uIYIocp72xwDBHKSZ
// SIG // xGaEa/0707iyOw+aXZXNcTxgNiREASb9thlLZM75mfJI
// SIG // gBVvUmdLZc+XOUYwz/8ul7IEztPNH4cn8Cn0tJhIFfp2
// SIG // netr8GYNoiyIqxueG7+sSt2xXl7/igc5cHPZnWhfl9Pa
// SIG // B4+SutrA8zAhzVHTnj4RffxA4R3k4BRbPdGowQfOf95Z
// SIG // eYxLTHf5awB0nqZxOY+yuGWhf6hp5RGRouc9beVZv98M
// SIG // 1erYa55S1ahZgGDQJycVtEy82RlmKfTYY2uNmlPLWtnD
// SIG // 7sDlpVkhYQGKuTWnuwQKq9ZTSE+0V2cH8JaWBYJQMIuW
// SIG // WM83vLPo3IT/S/5jT2oZOS9nsJgwwCwRUtYtwtq8/PJt
// SIG // vt1V6VoG4Wd2/MAifgEJOkHF7ARPqI9Xv28+riqJZ5mj
// SIG // LGz84dP2ryoe0lxYSz3PT5ErKoS0+zJpYNAcxbv2UXiT
// SIG // k3Wj/mZ3tulz6z4XnSl5gy0PLer+EVjz4G96GcZgK2d9
// SIG // G+uYylHWwBneIv9YFQj6yMdW/4sEpkEbrpiJNemcxUCm
// SIG // BipZ7Sc35rv4utkJ4/UCAwEAAaOCATYwggEyMB0GA1Ud
// SIG // DgQWBBS1XC9JgbrSwLDTiJJT4iK7NUvk9TAfBgNVHSME
// SIG // GDAWgBSfpxVdAF5iXYP05dJlpxtTNRnpcjBfBgNVHR8E
// SIG // WDBWMFSgUqBQhk5odHRwOi8vd3d3Lm1pY3Jvc29mdC5j
// SIG // b20vcGtpb3BzL2NybC9NaWNyb3NvZnQlMjBUaW1lLVN0
// SIG // YW1wJTIwUENBJTIwMjAxMCgxKS5jcmwwbAYIKwYBBQUH
// SIG // AQEEYDBeMFwGCCsGAQUFBzAChlBodHRwOi8vd3d3Lm1p
// SIG // Y3Jvc29mdC5jb20vcGtpb3BzL2NlcnRzL01pY3Jvc29m
// SIG // dCUyMFRpbWUtU3RhbXAlMjBQQ0ElMjAyMDEwKDEpLmNy
// SIG // dDAMBgNVHRMBAf8EAjAAMBMGA1UdJQQMMAoGCCsGAQUF
// SIG // BwMIMA0GCSqGSIb3DQEBCwUAA4ICAQDD1nJSyEPDqSgn
// SIG // fkFifIbteJb7NkZCbRj5yBGiT1f9fTGvUb5CW7k3eSp3
// SIG // uxUqom9LWykcNfQa/Yfw0libEim9YRjUNcL42oIFqtp/
// SIG // 7rl9gg61oiB8PB+6vLEmjXkYxUUR8WjKKC5Q5dx96B21
// SIG // faSco2MOmvjYxGUR7An+4529lQPPLqbEKRjcNQb+p+mk
// SIG // QH2XeMbsh5EQCkTuYAimFTgnui2ZPFLEuBpxBK5z2HnK
// SIG // neHUJ9i4pcKWdCqF1AOVN8gXIH0R0FflMcCg5TW8v90V
// SIG // wx/mP3aE2Ige1uE8M9YNBn5776PxmA16Z+c2s+hYI+9s
// SIG // JZhhRA8aSYacrlLz7aU/56OvEYRERQZttuAFkrV+M/J+
// SIG // tCeGNv0Gd75Y4lKLMp5/0xoOviPBdB2rD5C/U+B8qt1b
// SIG // BqQLVZ1wHRy0/6HhJxbOi2IgGJaOCYLGX2zz0VAT6mZ2
// SIG // BTWrJmcK6SDv7rX7psgC+Cf1t0R1aWCkCHJtpYuyKjf7
// SIG // UodRazevOf6V01XkrARHKrI7bQoHFL+sun2liJCBjN51
// SIG // mDWoEgUCEvwB3l+RFYAL0aIisc5cTaGX/T8F+iAbz+j2
// SIG // GGVum85gEQS9uLzSedoYPyEXxTblwewGdAxqIZaKozRB
// SIG // ow49OnL+5CgooVMf3ZSqpxc2QC0E03l6c/vChkYyqMXq
// SIG // 7Lwd4PnHqjCCB3EwggVZoAMCAQICEzMAAAAVxedrngKb
// SIG // SZkAAAAAABUwDQYJKoZIhvcNAQELBQAwgYgxCzAJBgNV
// SIG // BAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYD
// SIG // VQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQg
// SIG // Q29ycG9yYXRpb24xMjAwBgNVBAMTKU1pY3Jvc29mdCBS
// SIG // b290IENlcnRpZmljYXRlIEF1dGhvcml0eSAyMDEwMB4X
// SIG // DTIxMDkzMDE4MjIyNVoXDTMwMDkzMDE4MzIyNVowfDEL
// SIG // MAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24x
// SIG // EDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jv
// SIG // c29mdCBDb3Jwb3JhdGlvbjEmMCQGA1UEAxMdTWljcm9z
// SIG // b2Z0IFRpbWUtU3RhbXAgUENBIDIwMTAwggIiMA0GCSqG
// SIG // SIb3DQEBAQUAA4ICDwAwggIKAoICAQDk4aZM57RyIQt5
// SIG // osvXJHm9DtWC0/3unAcH0qlsTnXIyjVX9gF/bErg4r25
// SIG // PhdgM/9cT8dm95VTcVrifkpa/rg2Z4VGIwy1jRPPdzLA
// SIG // EBjoYH1qUoNEt6aORmsHFPPFdvWGUNzBRMhxXFExN6AK
// SIG // OG6N7dcP2CZTfDlhAnrEqv1yaa8dq6z2Nr41JmTamDu6
// SIG // GnszrYBbfowQHJ1S/rboYiXcag/PXfT+jlPP1uyFVk3v
// SIG // 3byNpOORj7I5LFGc6XBpDco2LXCOMcg1KL3jtIckw+DJ
// SIG // j361VI/c+gVVmG1oO5pGve2krnopN6zL64NF50ZuyjLV
// SIG // wIYwXE8s4mKyzbnijYjklqwBSru+cakXW2dg3viSkR4d
// SIG // Pf0gz3N9QZpGdc3EXzTdEonW/aUgfX782Z5F37ZyL9t9
// SIG // X4C626p+Nuw2TPYrbqgSUei/BQOj0XOmTTd0lBw0gg/w
// SIG // EPK3Rxjtp+iZfD9M269ewvPV2HM9Q07BMzlMjgK8Qmgu
// SIG // EOqEUUbi0b1qGFphAXPKZ6Je1yh2AuIzGHLXpyDwwvoS
// SIG // CtdjbwzJNmSLW6CmgyFdXzB0kZSU2LlQ+QuJYfM2BjUY
// SIG // hEfb3BvR/bLUHMVr9lxSUV0S2yW6r1AFemzFER1y7435
// SIG // UsSFF5PAPBXbGjfHCBUYP3irRbb1Hode2o+eFnJpxq57
// SIG // t7c+auIurQIDAQABo4IB3TCCAdkwEgYJKwYBBAGCNxUB
// SIG // BAUCAwEAATAjBgkrBgEEAYI3FQIEFgQUKqdS/mTEmr6C
// SIG // kTxGNSnPEP8vBO4wHQYDVR0OBBYEFJ+nFV0AXmJdg/Tl
// SIG // 0mWnG1M1GelyMFwGA1UdIARVMFMwUQYMKwYBBAGCN0yD
// SIG // fQEBMEEwPwYIKwYBBQUHAgEWM2h0dHA6Ly93d3cubWlj
// SIG // cm9zb2Z0LmNvbS9wa2lvcHMvRG9jcy9SZXBvc2l0b3J5
// SIG // Lmh0bTATBgNVHSUEDDAKBggrBgEFBQcDCDAZBgkrBgEE
// SIG // AYI3FAIEDB4KAFMAdQBiAEMAQTALBgNVHQ8EBAMCAYYw
// SIG // DwYDVR0TAQH/BAUwAwEB/zAfBgNVHSMEGDAWgBTV9lbL
// SIG // j+iiXGJo0T2UkFvXzpoYxDBWBgNVHR8ETzBNMEugSaBH
// SIG // hkVodHRwOi8vY3JsLm1pY3Jvc29mdC5jb20vcGtpL2Ny
// SIG // bC9wcm9kdWN0cy9NaWNSb29DZXJBdXRfMjAxMC0wNi0y
// SIG // My5jcmwwWgYIKwYBBQUHAQEETjBMMEoGCCsGAQUFBzAC
// SIG // hj5odHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20vcGtpL2Nl
// SIG // cnRzL01pY1Jvb0NlckF1dF8yMDEwLTA2LTIzLmNydDAN
// SIG // BgkqhkiG9w0BAQsFAAOCAgEAnVV9/Cqt4SwfZwExJFvh
// SIG // nnJL/Klv6lwUtj5OR2R4sQaTlz0xM7U518JxNj/aZGx8
// SIG // 0HU5bbsPMeTCj/ts0aGUGCLu6WZnOlNN3Zi6th542DYu
// SIG // nKmCVgADsAW+iehp4LoJ7nvfam++Kctu2D9IdQHZGN5t
// SIG // ggz1bSNU5HhTdSRXud2f8449xvNo32X2pFaq95W2KFUn
// SIG // 0CS9QKC/GbYSEhFdPSfgQJY4rPf5KYnDvBewVIVCs/wM
// SIG // nosZiefwC2qBwoEZQhlSdYo2wh3DYXMuLGt7bj8sCXgU
// SIG // 6ZGyqVvfSaN0DLzskYDSPeZKPmY7T7uG+jIa2Zb0j/aR
// SIG // AfbOxnT99kxybxCrdTDFNLB62FD+CljdQDzHVG2dY3RI
// SIG // LLFORy3BFARxv2T5JL5zbcqOCb2zAVdJVGTZc9d/HltE
// SIG // AY5aGZFrDZ+kKNxnGSgkujhLmm77IVRrakURR6nxt67I
// SIG // 6IleT53S0Ex2tVdUCbFpAUR+fKFhbHP+CrvsQWY9af3L
// SIG // wUFJfn6Tvsv4O+S3Fb+0zj6lMVGEvL8CwYKiexcdFYmN
// SIG // cP7ntdAoGokLjzbaukz5m/8K6TT4JDVnK+ANuOaMmdbh
// SIG // IurwJ0I9JZTmdHRbatGePu1+oDEzfbzL6Xu/OHBE0ZDx
// SIG // yKs6ijoIYn/ZcGNTTY3ugm2lBRDBcQZqELQdVTNYs6Fw
// SIG // ZvKhggLLMIICNAIBATCB+KGB0KSBzTCByjELMAkGA1UE
// SIG // BhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNV
// SIG // BAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBD
// SIG // b3Jwb3JhdGlvbjElMCMGA1UECxMcTWljcm9zb2Z0IEFt
// SIG // ZXJpY2EgT3BlcmF0aW9uczEmMCQGA1UECxMdVGhhbGVz
// SIG // IFRTUyBFU046N0JGMS1FM0VBLUI4MDgxJTAjBgNVBAMT
// SIG // HE1pY3Jvc29mdCBUaW1lLVN0YW1wIFNlcnZpY2WiIwoB
// SIG // ATAHBgUrDgMCGgMVAN/OE1C7xjU0ClIDXQBiucAY7suy
// SIG // oIGDMIGApH4wfDELMAkGA1UEBhMCVVMxEzARBgNVBAgT
// SIG // Cldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAc
// SIG // BgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEmMCQG
// SIG // A1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIw
// SIG // MTAwDQYJKoZIhvcNAQEFBQACBQDneul9MCIYDzIwMjMw
// SIG // MTI1MDczNDIxWhgPMjAyMzAxMjYwNzM0MjFaMHQwOgYK
// SIG // KwYBBAGEWQoEATEsMCowCgIFAOd66X0CAQAwBwIBAAIC
// SIG // ICcwBwIBAAICEbYwCgIFAOd8Ov0CAQAwNgYKKwYBBAGE
// SIG // WQoEAjEoMCYwDAYKKwYBBAGEWQoDAqAKMAgCAQACAweh
// SIG // IKEKMAgCAQACAwGGoDANBgkqhkiG9w0BAQUFAAOBgQCi
// SIG // jv8Oj6zt4KClwJi1Cl/S7TppcfLIbI9yc8IXi0vHHFK/
// SIG // 4iZTRHN0zfePZDsJvOVF8KhHBfOhUbJhVqarAhX5Bavm
// SIG // 9Bgpf62bm7kSFgHsis6zG+Eu+6rV2RItDUyWMY3VR2HU
// SIG // Qn1H7iHkYE5e6kevgvGvyYmfmr0qJEQ3Lob/0zGCBA0w
// SIG // ggQJAgEBMIGTMHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQI
// SIG // EwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4w
// SIG // HAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAk
// SIG // BgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAy
// SIG // MDEwAhMzAAAByPmw7mft6mtGAAEAAAHIMA0GCWCGSAFl
// SIG // AwQCAQUAoIIBSjAaBgkqhkiG9w0BCQMxDQYLKoZIhvcN
// SIG // AQkQAQQwLwYJKoZIhvcNAQkEMSIEIAdfZaAAJ9qY5aXh
// SIG // P5OcsYFwF3H++bBI+B/QzSeMVccwMIH6BgsqhkiG9w0B
// SIG // CRACLzGB6jCB5zCB5DCBvQQgYgCYz80/baMvxw6jcqSv
// SIG // L0FW4TdvA09nxHfsPhuEA2YwgZgwgYCkfjB8MQswCQYD
// SIG // VQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4G
// SIG // A1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0
// SIG // IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQg
// SIG // VGltZS1TdGFtcCBQQ0EgMjAxMAITMwAAAcj5sO5n7epr
// SIG // RgABAAAByDAiBCBFp7ysZZbdD3FSCHGwr79evPHIczS2
// SIG // cOtmNhxNqjbvmjANBgkqhkiG9w0BAQsFAASCAgA/xo4Q
// SIG // vFhEfwshNAp+hrLIsB9EhXzIYN5ejeQWrcN0sEOgRQWO
// SIG // Ap/s/CaOSrRzBZuKT/eh6dGIFGU/ciwKCQVO+uYDmnO8
// SIG // Kc7dOzwjGGDwYpPbidsKfjYZ1tiv/Owj+c/ryqXH/K1s
// SIG // jLUkVr+YWw7M0zyORkc8ovHcRhNPXxEbVknWhQtOJOH3
// SIG // bNDeCaG0k44cDxFqCqmXokyuxLqqYF0RM0Xcbs8U7uHg
// SIG // fENwR8uAflEooLDFxy7ywp8/A/PwBlFuXAAxSI+NwHxN
// SIG // r0B+OgRw1SJFrFNrGteg6pRhniS3rlph0SjYhGF1Kici
// SIG // 9SSZhDiF3SUHvz02SuUSt0eZcZ/YKH+hAUE3jTdTBDr0
// SIG // u/5j3UQtDysSn7DEcEEkQJzwtwE6YbXNIcK4AOiZXI0r
// SIG // trV/FIrKAGR3Kh/Nq3zY/XpiR1BVzCFJOq81b43Nr+PT
// SIG // b3iCvYbGtLenvmU76lpQ1u+8LtMcCQBjPevSXW66s/WY
// SIG // 0CXPqDM/32dspfyMfucn9QBXAR+NZN9c+B7PmwOCXM0s
// SIG // QjaIHZv1lULZDMem2Q5ufQKE3HOZ2i5hBrU8nh7M4PXQ
// SIG // nAAW2iHuTdRELBnC5OkevgoD+7QA6RlMpWvLk6YI/Jm3
// SIG // B+e7GOEMBimS3Pro44x0THCo7GdoMZ0xjsOD89DmIAkP
// SIG // YFhNqPGIgiAXkcxL9w==
// SIG // End signature block
