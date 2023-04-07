"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.toStringArray = exports.resolveMacArduinoAppPath = exports.convertToHex = exports.getRegistryValues = exports.parseConfigFile = exports.padStart = exports.union = exports.trim = exports.formatVersion = exports.parseProperties = exports.filterJunk = exports.isJunk = exports.tryParseJSON = exports.decodeData = exports.getArduinoL4jCodepage = exports.spawn = exports.isArduinoFile = exports.cp = exports.rmdirRecursivelySync = exports.mkdirRecursivelySync = exports.readdirSync = exports.directoryExistsSync = exports.fileExistsSync = void 0;
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
        child.on("exit", (code) => {
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

//# sourceMappingURL=util.js.map

// SIG // Begin signature block
// SIG // MIInzAYJKoZIhvcNAQcCoIInvTCCJ7kCAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // Io77t0O+XOcWyK5SGdaYBz8GGchRd5NAwYQ8fydPqIKg
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
// SIG // ARUwLwYJKoZIhvcNAQkEMSIEIE8n1bNiq3Cv/HdNUnFO
// SIG // sfRriiYxH/r6Ebbt1gMCHRspMEIGCisGAQQBgjcCAQwx
// SIG // NDAyoBSAEgBNAGkAYwByAG8AcwBvAGYAdKEagBhodHRw
// SIG // Oi8vd3d3Lm1pY3Jvc29mdC5jb20wDQYJKoZIhvcNAQEB
// SIG // BQAEggEAK7VHNchNJreCslpGSXhFzzpXig6fBT/FU+/J
// SIG // G5icpExixAm2SPX6y5dfIyYFffYAGBosrfHcJovTc7xZ
// SIG // b/ctY/44Ubu2N1hdM5TDCaVcLy8AX9MUsbeZZaWO4Mer
// SIG // asRxUxpxydRL16aoaE0fl8pZPJQ7Hn0slN4tubKWI+u/
// SIG // 19YX7bqnS0UJ/IbFGzTnbz6OU9I0UhyTcfH1o7AiRvYf
// SIG // a4Qtb8y5AukFP3haOOVdFsZG1XElFlz23d76gETXzm0D
// SIG // 3N6MMyUPTDpXb2YhT6Fgeb9wxKM3XP2ldHrv+7SXoAWR
// SIG // EckaoUhf1OkWrv4aIWHpJLgflmABduVwFl3spp5g7aGC
// SIG // Fy0wghcpBgorBgEEAYI3AwMBMYIXGTCCFxUGCSqGSIb3
// SIG // DQEHAqCCFwYwghcCAgEDMQ8wDQYJYIZIAWUDBAIBBQAw
// SIG // ggFZBgsqhkiG9w0BCRABBKCCAUgEggFEMIIBQAIBAQYK
// SIG // KwYBBAGEWQoDATAxMA0GCWCGSAFlAwQCAQUABCDMOOGc
// SIG // xBvWX392nThLS2L6l2hjV7tkWvEfCrciHQimCQIGY8fd
// SIG // ephoGBMyMDIzMDEyNTAxMzAzNC4yNzJaMASAAgH0oIHY
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
// SIG // MSIEIEw9ZizHlSqwtJIRNGqFmMKAvlIDkVWQP+w8YSo5
// SIG // tlc8MIH6BgsqhkiG9w0BCRACLzGB6jCB5zCB5DCBvQQg
// SIG // J8oNNS1oZxaJ9hzc5WcimntiSfRLwlyVXOuUCAXxyIMw
// SIG // gZgwgYCkfjB8MQswCQYDVQQGEwJVUzETMBEGA1UECBMK
// SIG // V2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwG
// SIG // A1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSYwJAYD
// SIG // VQQDEx1NaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAx
// SIG // MAITMwAAAbWtGt/XhXBtEwABAAABtTAiBCB0KhIRZBBQ
// SIG // VnkHW8wjd0SkZ0XSm8H5u9C0Apim1E594jANBgkqhkiG
// SIG // 9w0BAQsFAASCAgB5n0AGDu9Df56bHUNM3+gr5mGcdCHv
// SIG // WSJUyYDxWVRDeCpGPEhIZtt8ZHOlTyjfKfIb36EIXuRz
// SIG // A7zTt5K0W5I6STzMuCL65SRZ//9qUEUEedx4iZYuyW+3
// SIG // pJki88CD/fOUI85/DKLa9NE3NPY132BkpTb5y2FTEy7l
// SIG // Pj28UTNDcNhVkEeG1NQHua7zaTYEybRONaGVK7GT7y+L
// SIG // ufhVpV6woa7N2nM0fX5bMf5xr4uPoW7SU5gbVM6RUftG
// SIG // f6rOmBo6eq7zo76KCxvg+AjT7qZjU7gtMfFmOovMmNn8
// SIG // iPhNGr5Pij0fkQFuNOkoXXOlBeQn4S24HHvo8ZLC3+VZ
// SIG // axApNu86fs5jYFLS9CCUSnvspK6n1Owgki9XYMgrkzmn
// SIG // lZyFnAFAkPb2TBXe5/ajLUIFffnC0OhSDL1yJ0S7ct3S
// SIG // wtv1kR9YLaYlrUP3BgDI2/0bsnQHbMPyIJ8er1VdHRXq
// SIG // 2mw2uf8ZW+R5IaV3HPlQzYv0Owys2zJn2nGwSUm/J98x
// SIG // 3FLYBigURTnBipM7NjOQfX27Xx0g0vUoOHdzngYltvSP
// SIG // D5ZHq0043SDhdMnpAUmv79Jc7Sh8NW0rl+qj8GFK/Q8V
// SIG // +OK5Zyw8bKSg9YnbDE7Snf+qvpcnoremyMP020MxlQy8
// SIG // BuiD5olU3BYvNCfdSVMRAanyxrxwmbcG7bBpRA==
// SIG // End signature block
