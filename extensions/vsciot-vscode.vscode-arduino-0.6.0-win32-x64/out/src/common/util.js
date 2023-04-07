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
exports.getPlatform = exports.toStringArray = exports.resolveMacArduinoAppPath = exports.convertToHex = exports.getRegistryValues = exports.parseConfigFile = exports.padStart = exports.union = exports.trim = exports.formatVersion = exports.parseProperties = exports.filterJunk = exports.isJunk = exports.tryParseJSON = exports.decodeData = exports.getArduinoL4jCodepage = exports.spawn = exports.isArduinoFile = exports.cp = exports.rmdirRecursivelySync = exports.mkdirRecursivelySync = exports.readdirSync = exports.directoryExistsSync = exports.fileExistsSync = void 0;
const child_process = require("child_process");
const fs = require("fs");
const iconv = require("iconv-lite");
const os = require("os");
const path = require("path");
const properties = require("properties");
const WinReg = require("winreg");
const outputChannel_1 = require("./outputChannel");
const encodingMapping = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../misc", "codepageMapping.json"), "utf8"));
/**
 * This function will detect the file existing in the sync mode.
 * @function fileExistsSync
 * @argument {string} filePath
 */
function fileExistsSync(filePath) {
    try {
        return fs.statSync(filePath).isFile();
    }
    catch (e) {
        return false;
    }
}
exports.fileExistsSync = fileExistsSync;
/**
 * This function will detect the directoy existing in the sync mode.
 * @function directoryExistsSync
 * @argument {string} dirPath
 */
function directoryExistsSync(dirPath) {
    try {
        return fs.statSync(dirPath).isDirectory();
    }
    catch (e) {
        return false;
    }
}
exports.directoryExistsSync = directoryExistsSync;
/**
 * This function will implement the same function as the fs.readdirSync,
 * besides it could filter out folders only when the second argument is true.
 * @function readdirSync
 * @argument {string} dirPath
 * @argument {boolean} folderOnly
 */
function readdirSync(dirPath, folderOnly = false) {
    const dirs = fs.readdirSync(dirPath);
    if (folderOnly) {
        return dirs.filter((subdir) => {
            return directoryExistsSync(path.join(dirPath, subdir));
        });
    }
    else {
        return dirs;
    }
}
exports.readdirSync = readdirSync;
/**
 * Recursively create directories. Equals to "mkdir -p"
 * @function mkdirRecursivelySync
 * @argument {string} dirPath
 */
function mkdirRecursivelySync(dirPath) {
    if (directoryExistsSync(dirPath)) {
        return;
    }
    const dirname = path.dirname(dirPath);
    if (path.normalize(dirname) === path.normalize(dirPath)) {
        fs.mkdirSync(dirPath);
    }
    else if (directoryExistsSync(dirname)) {
        fs.mkdirSync(dirPath);
    }
    else {
        mkdirRecursivelySync(dirname);
        fs.mkdirSync(dirPath);
    }
}
exports.mkdirRecursivelySync = mkdirRecursivelySync;
/**
 * Recursively delete files. Equals to "rm -rf"
 * @function rmdirRecursivelySync
 * @argument {string} rootPath
 */
function rmdirRecursivelySync(rootPath) {
    if (fs.existsSync(rootPath)) {
        fs.readdirSync(rootPath).forEach((file) => {
            const curPath = path.join(rootPath, file);
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                rmdirRecursivelySync(curPath);
            }
            else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(rootPath);
    }
}
exports.rmdirRecursivelySync = rmdirRecursivelySync;
function copyFileSync(src, dest, overwrite = true) {
    if (!fileExistsSync(src) || (!overwrite && fileExistsSync(dest))) {
        return;
    }
    const BUF_LENGTH = 64 * 1024;
    const buf = new Buffer(BUF_LENGTH);
    let lastBytes = BUF_LENGTH;
    let pos = 0;
    let srcFd = null;
    let destFd = null;
    try {
        srcFd = fs.openSync(src, "r");
    }
    catch (error) {
    }
    try {
        destFd = fs.openSync(dest, "w");
    }
    catch (error) {
    }
    try {
        while (lastBytes === BUF_LENGTH) {
            lastBytes = fs.readSync(srcFd, buf, 0, BUF_LENGTH, pos);
            fs.writeSync(destFd, buf, 0, lastBytes);
            pos += lastBytes;
        }
    }
    catch (error) {
    }
    if (srcFd) {
        fs.closeSync(srcFd);
    }
    if (destFd) {
        fs.closeSync(destFd);
    }
}
function copyFolderRecursivelySync(src, dest) {
    if (!directoryExistsSync(src)) {
        return;
    }
    if (!directoryExistsSync(dest)) {
        mkdirRecursivelySync(dest);
    }
    const items = fs.readdirSync(src);
    for (const item of items) {
        const fullPath = path.join(src, item);
        const targetPath = path.join(dest, item);
        if (directoryExistsSync(fullPath)) {
            copyFolderRecursivelySync(fullPath, targetPath);
        }
        else if (fileExistsSync(fullPath)) {
            copyFileSync(fullPath, targetPath);
        }
    }
}
/**
 * Copy files & directories recursively. Equals to "cp -r"
 * @argument {string} src
 * @argument {string} dest
 */
function cp(src, dest) {
    if (fileExistsSync(src)) {
        let targetFile = dest;
        if (directoryExistsSync(dest)) {
            targetFile = path.join(dest, path.basename(src));
        }
        if (path.relative(src, targetFile)) {
            // if the source and target file is the same, skip copying.
            return;
        }
        copyFileSync(src, targetFile);
    }
    else if (directoryExistsSync(src)) {
        copyFolderRecursivelySync(src, dest);
    }
    else {
        throw new Error(`No such file or directory: ${src}`);
    }
}
exports.cp = cp;
/**
 * Check if the specified file is an arduino file (*.ino, *.pde).
 * @argument {string} filePath
 */
function isArduinoFile(filePath) {
    return fileExistsSync(filePath) && (path.extname(filePath) === ".ino" || path.extname(filePath) === ".pde");
}
exports.isArduinoFile = isArduinoFile;
/**
 * Send a command to arduino
 * @param {string} command - base command path (either Arduino IDE or CLI)
 * @param {vscode.OutputChannel} outputChannel - output display channel
 * @param {string[]} [args=[]] - arguments to pass to the command
 * @param {any} [options={}] - options and flags for the arguments
 * @param {(string) => {}} - callback for stdout text
 */
function spawn(command, args = [], options = {}, output) {
    return new Promise((resolve, reject) => {
        options.cwd = options.cwd || path.resolve(path.join(__dirname, ".."));
        const child = child_process.spawn(command, args, options);
        let codepage = "65001";
        if (os.platform() === "win32") {
            codepage = getArduinoL4jCodepage(command.replace(/.exe$/i, ".l4j.ini"));
            if (!codepage) {
                try {
                    const chcp = child_process.execSync("chcp.com");
                    codepage = chcp.toString().split(":").pop().trim();
                }
                catch (error) {
                    outputChannel_1.arduinoChannel.warning(`Defaulting to code page 850 because chcp.com failed.\
                    \rEnsure your path includes %SystemRoot%\\system32\r${error.message}`);
                    codepage = "850";
                }
            }
        }
        if (output) {
            if (output.channel || output.stdout) {
                child.stdout.on("data", (data) => {
                    const decoded = decodeData(data, codepage);
                    if (output.stdout) {
                        output.stdout(decoded);
                    }
                    if (output.channel) {
                        output.channel.append(decoded);
                    }
                });
            }
            if (output.channel || output.stderr) {
                child.stderr.on("data", (data) => {
                    const decoded = decodeData(data, codepage);
                    if (output.stderr) {
                        output.stderr(decoded);
                    }
                    if (output.channel) {
                        output.channel.append(decoded);
                    }
                });
            }
        }
        child.on("error", (error) => reject({ error }));
        // It's important to use use the "close" event instead of "exit" here.
        // There could still be buffered data in stdout or stderr when the
        // process exits that we haven't received yet.
        child.on("close", (code) => {
            if (code === 0) {
                resolve({ code });
            }
            else {
                reject({ code });
            }
        });
    });
}
exports.spawn = spawn;
function getArduinoL4jCodepage(filePath) {
    const encoding = parseConfigFile(filePath).get("-Dfile.encoding");
    if (encoding === "UTF8") {
        return "65001";
    }
    return Object.keys(encodingMapping).reduce((r, key) => {
        return encodingMapping[key] === encoding ? key : r;
    }, undefined);
}
exports.getArduinoL4jCodepage = getArduinoL4jCodepage;
function decodeData(data, codepage) {
    if (Object.prototype.hasOwnProperty.call(encodingMapping, codepage)) {
        return iconv.decode(data, encodingMapping[codepage]);
    }
    return data.toString();
}
exports.decodeData = decodeData;
function tryParseJSON(jsonString) {
    try {
        const jsonObj = JSON.parse(jsonString);
        if (jsonObj && typeof jsonObj === "object") {
            return jsonObj;
        }
    }
    catch (ex) { }
    return undefined;
}
exports.tryParseJSON = tryParseJSON;
function isJunk(filename) {
    // tslint:disable-next-line
    const re = /^npm-debug\.log$|^\..*\.swp$|^\.DS_Store$|^\.AppleDouble$|^\.LSOverride$|^Icon\r$|^\._.*|^\.Spotlight-V100(?:$|\/)|\.Trashes|^__MACOSX$|~$|^Thumbs\.db$|^ehthumbs\.db$|^Desktop\.ini$/;
    return re.test(filename);
}
exports.isJunk = isJunk;
function filterJunk(files) {
    return files.filter((file) => !isJunk(file));
}
exports.filterJunk = filterJunk;
function parseProperties(propertiesFile) {
    return new Promise((resolve, reject) => {
        properties.parse(propertiesFile, { path: true }, (error, obj) => {
            if (error) {
                reject(error);
            }
            else {
                resolve(obj);
            }
        });
    });
}
exports.parseProperties = parseProperties;
function formatVersion(version) {
    if (!version) {
        return version;
    }
    const versions = String(version).split(".");
    if (versions.length < 2) {
        versions.push("0");
    }
    if (versions.length < 3) {
        versions.push("0");
    }
    return versions.join(".");
}
exports.formatVersion = formatVersion;
function trim(value) {
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            value[i] = trim(value[i]);
        }
    }
    else if (typeof value === "string") {
        value = value.trim();
    }
    return value;
}
exports.trim = trim;
function union(a, b, compare) {
    const result = [].concat(a);
    b.forEach((item) => {
        const exist = result.find((element) => {
            return (compare ? compare(item, element) : Object.is(item, element));
        });
        if (!exist) {
            result.push(item);
        }
    });
    return result;
}
exports.union = union;
/**
 * This method pads the current string with another string (repeated, if needed)
 * so that the resulting string reaches the given length.
 * The padding is applied from the start (left) of the current string.
 * @argument {string} sourceString
 * @argument {string} targetLength
 * @argument {string} padString
 */
function padStart(sourceString, targetLength, padString) {
    if (!sourceString) {
        return sourceString;
    }
    if (!String.prototype.padStart) {
        // https://github.com/uxitten/polyfill/blob/master/string.polyfill.js
        padString = String(padString || " ");
        if (sourceString.length > targetLength) {
            return sourceString;
        }
        else {
            targetLength = targetLength - sourceString.length;
            if (targetLength > padString.length) {
                padString += padString.repeat(targetLength / padString.length); // append to original to ensure we are longer than needed
            }
            return padString.slice(0, targetLength) + sourceString;
        }
    }
    else {
        return sourceString.padStart(targetLength, padString);
    }
}
exports.padStart = padStart;
function parseConfigFile(fullFileName, filterComment = true) {
    const result = new Map();
    if (fileExistsSync(fullFileName)) {
        const rawText = fs.readFileSync(fullFileName, "utf8");
        const lines = rawText.split("\n");
        lines.forEach((line) => {
            if (line) {
                line = line.trim();
                if (filterComment) {
                    if (line.trim() && line.startsWith("#")) {
                        return;
                    }
                }
                const separator = line.indexOf("=");
                if (separator > 0) {
                    const key = line.substring(0, separator).trim();
                    const value = line.substring(separator + 1, line.length).trim();
                    result.set(key, value);
                }
            }
        });
    }
    return result;
}
exports.parseConfigFile = parseConfigFile;
function getRegistryValues(hive, key, name) {
    return new Promise((resolve, reject) => {
        try {
            const regKey = new WinReg({
                hive,
                key,
            });
            regKey.valueExists(name, (e, exists) => {
                if (e) {
                    return reject(e);
                }
                if (exists) {
                    regKey.get(name, (err, result) => {
                        if (!err) {
                            resolve(result ? result.value : "");
                        }
                        else {
                            reject(err);
                        }
                    });
                }
                else {
                    resolve("");
                }
            });
        }
        catch (ex) {
            reject(ex);
        }
    });
}
exports.getRegistryValues = getRegistryValues;
function convertToHex(number, width = 0) {
    return padStart(number.toString(16), width, "0");
}
exports.convertToHex = convertToHex;
/**
 * This will accept any Arduino*.app on Mac OS,
 * in case you named Arduino with a version number
 * @argument {string} arduinoPath
 */
function resolveMacArduinoAppPath(arduinoPath, useArduinoCli = false) {
    if (useArduinoCli || /Arduino.*\.app/.test(arduinoPath)) {
        return arduinoPath;
    }
    else {
        return path.join(arduinoPath, "Arduino.app");
    }
}
exports.resolveMacArduinoAppPath = resolveMacArduinoAppPath;
/**
 * If given an string, splits the string on commas. If given an array, returns
 * the array. All strings in the output are trimmed.
 * @param value String or string array to convert.
 * @returns Array of strings split from the input.
 */
function toStringArray(value) {
    if (value) {
        let result;
        if (typeof value === "string") {
            result = value.split(",");
        }
        else {
            result = value;
        }
        return trim(result);
    }
    return [];
}
exports.toStringArray = toStringArray;
// Ideally VS Code would provide an API to get the target platform name. For
// now, copy the logic from VS Code.
// https://github.com/microsoft/vscode/issues/170196
// tslint:disable-next-line
// https://github.com/microsoft/vscode/blob/78d05ca56a6881e7503a5173131c9803b059012d/src/vs/platform/extensionManagement/common/extensionManagementUtil.ts#L171-L196
function getPlatform() {
    return __awaiter(this, void 0, void 0, function* () {
        let platform = process.platform;
        if (platform === "linux") {
            let content;
            try {
                content = yield fs.promises.readFile("/etc/os-release", "ascii");
            }
            catch (error) {
                try {
                    content = yield fs.promises.readFile("/usr/lib/os-release", "ascii");
                }
                catch (error) {
                    /* Ignore */
                }
            }
            if (!!content &&
                // eslint-disable-next-line no-control-regex
                (content.match(/^ID=([^\u001b\r\n]*)/m) || [])[1] === "alpine") {
                platform = "alpine";
            }
        }
        return `${platform}-${process.arch}`;
    });
}
exports.getPlatform = getPlatform;

//# sourceMappingURL=util.js.map

// SIG // Begin signature block
// SIG // MIInkQYJKoZIhvcNAQcCoIIngjCCJ34CAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // dpeT7bXsJOZfMbs0v0/mmjc12Neuy84vTRkZ2mDuQ86g
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
// SIG // a/15n8G9bW1qyVJzEw16UM0xghlzMIIZbwIBATCBlTB+
// SIG // MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3Rv
// SIG // bjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWlj
// SIG // cm9zb2Z0IENvcnBvcmF0aW9uMSgwJgYDVQQDEx9NaWNy
// SIG // b3NvZnQgQ29kZSBTaWduaW5nIFBDQSAyMDExAhMzAAAC
// SIG // y7d1OfsCcUI2AAAAAALLMA0GCWCGSAFlAwQCAQUAoIGu
// SIG // MBkGCSqGSIb3DQEJAzEMBgorBgEEAYI3AgEEMBwGCisG
// SIG // AQQBgjcCAQsxDjAMBgorBgEEAYI3AgEVMC8GCSqGSIb3
// SIG // DQEJBDEiBCAqaH4y/HY7zbp6PO8xNYVEzkSA6wmoRYQE
// SIG // yiAYVf6skDBCBgorBgEEAYI3AgEMMTQwMqAUgBIATQBp
// SIG // AGMAcgBvAHMAbwBmAHShGoAYaHR0cDovL3d3dy5taWNy
// SIG // b3NvZnQuY29tMA0GCSqGSIb3DQEBAQUABIIBABC8iFQ3
// SIG // XW1eUi1Vg4B36gkFQoah4d67lq/pN2ZY2lMSZ1UDvaRJ
// SIG // o1MoLzl2586i3+RziPaCTgay4YOwFR0LK30cjQ13RBIr
// SIG // R5B+ti9jFrZhrX7wznte7v3B1gf3YwPTX3cCD8fwfj6n
// SIG // Ba+Xs8NKRLvXnXxnji0q4FY6FQv2339Zo++KSAgR2AIf
// SIG // iMwA9RPE6TyeI27sPhgo4cFRYrlSnltwOFSdrCBgMPq3
// SIG // fKuaUq1JdtlATk0fPv7KYh+lPn0uy4EtARR401vfyDd9
// SIG // /uuhpkfhPFJu9KQmrlP2qw/K+M7ZK/F0rTn7RMgnwI9s
// SIG // hxTrbfsCrkAV4BcBzseP+mq5s8Whghb9MIIW+QYKKwYB
// SIG // BAGCNwMDATGCFukwghblBgkqhkiG9w0BBwKgghbWMIIW
// SIG // 0gIBAzEPMA0GCWCGSAFlAwQCAQUAMIIBUQYLKoZIhvcN
// SIG // AQkQAQSgggFABIIBPDCCATgCAQEGCisGAQQBhFkKAwEw
// SIG // MTANBglghkgBZQMEAgEFAAQghFP/SXouUI9kVB3LRw1s
// SIG // p4UgHuvf0+ImNzV3nPq7CCcCBmPuUGmOFBgTMjAyMzAz
// SIG // MTUyMTA2NDAuODE4WjAEgAIB9KCB0KSBzTCByjELMAkG
// SIG // A1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAO
// SIG // BgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29m
// SIG // dCBDb3Jwb3JhdGlvbjElMCMGA1UECxMcTWljcm9zb2Z0
// SIG // IEFtZXJpY2EgT3BlcmF0aW9uczEmMCQGA1UECxMdVGhh
// SIG // bGVzIFRTUyBFU046MTJCQy1FM0FFLTc0RUIxJTAjBgNV
// SIG // BAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1wIFNlcnZpY2Wg
// SIG // ghFUMIIHDDCCBPSgAwIBAgITMwAAAcpPwrPtAw0YbAAB
// SIG // AAAByjANBgkqhkiG9w0BAQsFADB8MQswCQYDVQQGEwJV
// SIG // UzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMH
// SIG // UmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBv
// SIG // cmF0aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQgVGltZS1T
// SIG // dGFtcCBQQ0EgMjAxMDAeFw0yMjExMDQxOTAxNDBaFw0y
// SIG // NDAyMDIxOTAxNDBaMIHKMQswCQYDVQQGEwJVUzETMBEG
// SIG // A1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9u
// SIG // ZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9u
// SIG // MSUwIwYDVQQLExxNaWNyb3NvZnQgQW1lcmljYSBPcGVy
// SIG // YXRpb25zMSYwJAYDVQQLEx1UaGFsZXMgVFNTIEVTTjox
// SIG // MkJDLUUzQUUtNzRFQjElMCMGA1UEAxMcTWljcm9zb2Z0
// SIG // IFRpbWUtU3RhbXAgU2VydmljZTCCAiIwDQYJKoZIhvcN
// SIG // AQEBBQADggIPADCCAgoCggIBAMMBnKvY+dK1hJHC0pRm
// SIG // S8HlFX8V0WlI4j7MmjVcT3TEbNwlXufLIrvxJGlbe7ez
// SIG // zUz5KP7PJTbbrAHixJ85IuOMsZNnPXpJvBNUkNmFfW/P
// SIG // yzsXymqWfLVZT8scOg5hczRUI4n1ZvBIme5RUaGOOPL6
// SIG // XGwQ9fKo2DRf9md0kHIXLHVdTfWOldlhpeeVZi6hUV+f
// SIG // nabXY63gV84t1lvU7KAhFnGAgSucGIEvbU9kkkk82nt4
// SIG // 5ncONIPiziMq1Txdg6M5Erb+iQQz78GoV1qShqTu6x6y
// SIG // hfqOxAjf1YkBTGcqf78Xj4lAAQzasxFCPLO5JWJnh174
// SIG // 3kDqvwjNwv2PG493yTm52R+3gF70Q58U/Eelv7g9ZhlC
// SIG // b7/TPQTLt54SqSpksc8zuS7XDBIdrTF8YTBhjTFD9wzh
// SIG // Ct1/tvyw9WdN7rCU5OaRzaB/4AyL26e/OwsONLbAKYgL
// SIG // 7ax2MLm9E6iL/GcutpfJ/LPzL/z++uAk6q8XF82pQR4f
// SIG // l8uFz45mnZz5GScnKdynM25IPUG7yadB/9BbMB0vnnxa
// SIG // H6QzScC4dYbP2jItSv6MxL+/1iyD7A4Cten1P2scm6jC
// SIG // pNDTsYHpVIwGCpeMFNGOkOKvTf/T8AEtHLIn0IWNaKEH
// SIG // wCNIgwgkhAE7JQ/G0ztLUbanXCHWrzkXqs6D3bwL9w69
// SIG // V10PAgMBAAGjggE2MIIBMjAdBgNVHQ4EFgQU+sf+pUuB
// SIG // EkPCmYXdEYFO0WFzPH8wHwYDVR0jBBgwFoAUn6cVXQBe
// SIG // Yl2D9OXSZacbUzUZ6XIwXwYDVR0fBFgwVjBUoFKgUIZO
// SIG // aHR0cDovL3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9j
// SIG // cmwvTWljcm9zb2Z0JTIwVGltZS1TdGFtcCUyMFBDQSUy
// SIG // MDIwMTAoMSkuY3JsMGwGCCsGAQUFBwEBBGAwXjBcBggr
// SIG // BgEFBQcwAoZQaHR0cDovL3d3dy5taWNyb3NvZnQuY29t
// SIG // L3BraW9wcy9jZXJ0cy9NaWNyb3NvZnQlMjBUaW1lLVN0
// SIG // YW1wJTIwUENBJTIwMjAxMCgxKS5jcnQwDAYDVR0TAQH/
// SIG // BAIwADATBgNVHSUEDDAKBggrBgEFBQcDCDANBgkqhkiG
// SIG // 9w0BAQsFAAOCAgEA2NB5KgktyrinnxV/P65v3bQ/dOun
// SIG // ShJXjaq4sGarDOGJvBMOEIqjqju5lqGGGOCucvHl0jhy
// SIG // jVzn6TukW2mI/IwjnCQAebai5eYYjIGjGwFS65dYZYsf
// SIG // bJaDuOSzjdCaYSr2tw+gFSgOz+/JgPYkR2WFFa0Ysn70
// SIG // I1sZlJ8YYrPH6Jvdvv0R3BGdQ4efqeIM3ni/OGJdNFsq
// SIG // vRHIASin4KtJQo1jUqtQFBtbBC5YFzkrymeP5V1x/jH4
// SIG // XB3vdViyGmZEvx7vcHU0+iNeAQve8oQ7GVlwJdCCfNNS
// SIG // OlLRBaQrE3jsmQSewhdK3+ZcSfLRPaIzbMqlySrsFZ9H
// SIG // sAjJGas/3BML/RRMfEJrGdGTaHU7bJflfXWZvnlKzCmZ
// SIG // OjyrCgK7UPox5H1bB4Cjg5aHpaTph6oF+1GztDVZyJaT
// SIG // +eYEE6le+r1O8EV6VH8+yoRNwWVzYMBtOXUZwlw8K4YW
// SIG // M/iLW87NStUfCOGDAyY1vdAEgoPSX/scoESmRih46Ngb
// SIG // Nl8mirjdT+hRQiFVzeyoB5f22YmpBqu5OU0ODlyucZIQ
// SIG // h4Y3YB7sY94SuQGjsvhl8Tv428qhkanksX/k0z7loQ1r
// SIG // qyKN90TAxnuQ2yJo3G3I+nVYUHr6hwpUdTh0n6/vJtYV
// SIG // kSRpQtWrXDlimowK8DlEaiUlZU4cFYCMsxjZo84wggdx
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
// SIG // U02N7oJtpQUQwXEGahC0HVUzWLOhcGbyoYICyzCCAjQC
// SIG // AQEwgfihgdCkgc0wgcoxCzAJBgNVBAYTAlVTMRMwEQYD
// SIG // VQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25k
// SIG // MR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24x
// SIG // JTAjBgNVBAsTHE1pY3Jvc29mdCBBbWVyaWNhIE9wZXJh
// SIG // dGlvbnMxJjAkBgNVBAsTHVRoYWxlcyBUU1MgRVNOOjEy
// SIG // QkMtRTNBRS03NEVCMSUwIwYDVQQDExxNaWNyb3NvZnQg
// SIG // VGltZS1TdGFtcCBTZXJ2aWNloiMKAQEwBwYFKw4DAhoD
// SIG // FQCjjueXDE+LMjz+pwpYNiFn2ozKpKCBgzCBgKR+MHwx
// SIG // CzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9u
// SIG // MRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNy
// SIG // b3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jv
// SIG // c29mdCBUaW1lLVN0YW1wIFBDQSAyMDEwMA0GCSqGSIb3
// SIG // DQEBBQUAAgUA57xmDDAiGA8yMDIzMDMxNTIzNDMwOFoY
// SIG // DzIwMjMwMzE2MjM0MzA4WjB0MDoGCisGAQQBhFkKBAEx
// SIG // LDAqMAoCBQDnvGYMAgEAMAcCAQACAhdBMAcCAQACAhFR
// SIG // MAoCBQDnvbeMAgEAMDYGCisGAQQBhFkKBAIxKDAmMAwG
// SIG // CisGAQQBhFkKAwKgCjAIAgEAAgMHoSChCjAIAgEAAgMB
// SIG // hqAwDQYJKoZIhvcNAQEFBQADgYEATfiIMyPh1WtKvtVP
// SIG // SBjlrULTWgOUzlQDKq7ok9zJPXq/w+PKSahsa0AyV74g
// SIG // SuAWqGgsln4fcd3ArC41ICz1PlNDey7AOdZohHW/WmR0
// SIG // GWfxfwjijO4BiXAV/DxG71cwjpARZ04Gkeme+zeO4Aeu
// SIG // V/VCpSXEIQCCAl+RTIIymLcxggQNMIIECQIBATCBkzB8
// SIG // MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3Rv
// SIG // bjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWlj
// SIG // cm9zb2Z0IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNy
// SIG // b3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAxMAITMwAAAcpP
// SIG // wrPtAw0YbAABAAAByjANBglghkgBZQMEAgEFAKCCAUow
// SIG // GgYJKoZIhvcNAQkDMQ0GCyqGSIb3DQEJEAEEMC8GCSqG
// SIG // SIb3DQEJBDEiBCC58o/xocX/bOtMBDyYLaWECF2wry1j
// SIG // yn+X4hPj0uBlFzCB+gYLKoZIhvcNAQkQAi8xgeowgecw
// SIG // geQwgb0EIBM9G/Ob61VNrJWQJOI7dUgxJOiM2QMFQqFs
// SIG // Bdys3BrgMIGYMIGApH4wfDELMAkGA1UEBhMCVVMxEzAR
// SIG // BgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1v
// SIG // bmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlv
// SIG // bjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAg
// SIG // UENBIDIwMTACEzMAAAHKT8Kz7QMNGGwAAQAAAcowIgQg
// SIG // /gz7WWcdy3GSAagkyfOCVD3e6qDVrAMquc0JmtbDh2gw
// SIG // DQYJKoZIhvcNAQELBQAEggIAez7P734Jj3yZeKUw3g5o
// SIG // Rm3Ch8wkI5aLfYP2n5P9SVD9KkW+BUGhlE7rKeA9QxJT
// SIG // NWcNZarWevKC7nRn4jbVT5tsI6ZqKqkPa2avo7zZ1j08
// SIG // p+Al6R74HkZpUpjnDvkl4LIdy5OFA67SG+hHT/+yUY3P
// SIG // RUp0vAVq2k2oeOEVZNSW1RIw7qVnEdCZZVSRqtMHhkeH
// SIG // W//R+F2Tb5UvKpAarMnPTrKm0aqeyKYSOsD4wNKXncQ9
// SIG // Vzv/Vq+TmFlQpB42GBlGMIeSV68Zg1KlZOSoUZaeVHM2
// SIG // 5V7xYOBOFeY3p7L5gGX7mP7RqdlIJJMtW2MJPHlf3Pds
// SIG // jTLvahf+kOij+xbADyWd6hG9EKRFFOiG+W9rblg8s+Fu
// SIG // Oyp3j7oODFO8/rvQwQcTpaYqOmYh7GAd1hbe1MNCeKFU
// SIG // vrynNnWj8Qj9SLpPVNBUmFQy5kGYi4iVEBKxmJIPnVC0
// SIG // Tl1iyCuXEI+rDcbpfdDAP/ZJVOqqXfk3LJu6mShBUn0B
// SIG // XYZQA4bhvl5yxnVsE07GbUqmtK6oxVRGS+3mzkwd9Odr
// SIG // 8UKVSprbUOpt5c2ii6Tvg1RxJDFX9CNBPio9LTJ5biD7
// SIG // QaY1WHJbY09R0PT+ldVgDvi+bPNN6AFQhCSDPYPa3WPc
// SIG // OCRKAwxdhkgqN8Yo6lMKNuDVE3Sqo3m73HP2SKL7tNHh5UQ=
// SIG // End signature block
