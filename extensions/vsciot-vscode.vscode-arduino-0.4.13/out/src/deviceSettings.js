"use strict";
// Copyright (c) Elektronik Workshop. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceSettings = void 0;
const fs = require("fs");
const path = require("path");
const vscode = require("vscode");
const constants = require("./common/constants");
const util = require("./common/util");
const logger = require("./logger/logger");
/**
 * Generic class which provides monitoring of a specific settings value.
 * If the value is modified a flag is set and an event is emitted.
 *
 * Usually you want to specialize the setter for any given value type
 * to prevent invalid or badly formatted values to enter your settings.
 */
class Setting {
    constructor(defaultValue) {
        /** Event emitter which fires when the value is changed. */
        this._emitter = new vscode.EventEmitter();
        this.default = defaultValue;
        this._value = this.default;
    }
    /**
     * Value-setter - sets the value.
     * If modified, the modified flag is set and the modified event is
     * fired.
     */
    set value(value) {
        if (value !== this._value) {
            this._value = value;
            this._modified = true;
            this._emitter.fire(this._value);
        }
    }
    /** Value-getter - returns the internal value. */
    get value() {
        return this._value;
    }
    /**
     * Returns true, if the internal value has been modified.
     * To clear the modified flag call commit().
     */
    get modified() {
        return this._modified;
    }
    /** Returns the modified-event emitter. */
    get emitter() {
        return this._emitter;
    }
    /**
     * Returns the internal value to its default value.
     * If the default value is different from the previous value,
     * it triggers the modified event and the modified flag is set.
     */
    reset() {
        this.value = this.default;
    }
    /** Reset the modified flag (if you know what you're doing) */
    commit() {
        this._modified = false;
    }
}
/**
 * String specialization of the Setting class.
 */
class StrSetting extends Setting {
    /**
     * When we override setter (below) we have to override getter as well
     * (see JS language specs).
     */
    get value() {
        return super.value;
    }
    /**
     * Set string value. Anything else than a string will set the value to
     * its default value (undefined). White spaces at the front and back are
     * trimmed before setting the value.
     * If the setting's value is changed during this operation, the base
     * class' event emitter will fire and the modified flag will be set.
     */
    set value(value) {
        if (typeof value !== "string") {
            value = this.default;
        }
        else {
            value = value.trim();
        }
        super.value = value;
    }
}
class BuildPrefSetting extends Setting {
    get value() {
        return super.value;
    }
    set value(value) {
        if (!Array.isArray(value)) {
            super.value = super.default;
            return;
        }
        if (value.length <= 0) {
            super.value = super.default;
            return;
        }
        for (const pref of value) {
            if (!Array.isArray(pref) || pref.length !== 2) {
                super.value = super.default;
                return;
            }
            for (const i of pref) {
                if (typeof i !== "string") {
                    super.value = super.default;
                    return;
                }
            }
        }
        super.value = value;
    }
}
/**
 * This class encapsulates all device/project specific settings and
 * provides common operations on them.
 */
class DeviceSettings {
    constructor() {
        this.port = new StrSetting();
        this.board = new StrSetting();
        this.sketch = new StrSetting();
        this.output = new StrSetting();
        this.debugger = new StrSetting();
        this.intelliSenseGen = new StrSetting();
        this.configuration = new StrSetting();
        this.prebuild = new StrSetting();
        this.postbuild = new StrSetting();
        this.programmer = new StrSetting();
        this.buildPreferences = new BuildPrefSetting();
    }
    /**
     * @returns true if any of the settings values has its modified flag
     * set.
     */
    get modified() {
        return this.port.modified ||
            this.board.modified ||
            this.sketch.modified ||
            this.output.modified ||
            this.debugger.modified ||
            this.intelliSenseGen.modified ||
            this.configuration.modified ||
            this.prebuild.modified ||
            this.postbuild.modified ||
            this.programmer.modified ||
            this.buildPreferences.modified;
    }
    /**
     * Clear modified flags of all settings values.
     */
    commit() {
        this.port.commit();
        this.board.commit();
        this.sketch.commit();
        this.output.commit();
        this.debugger.commit();
        this.intelliSenseGen.commit();
        this.configuration.commit();
        this.prebuild.commit();
        this.postbuild.commit();
        this.programmer.commit();
        this.buildPreferences.commit();
    }
    /**
     * Resets all settings values to their default values.
     * @param commit If true clear the modified flags after all values are
     * reset.
     */
    reset(commit = true) {
        this.port.reset();
        this.board.reset();
        this.sketch.reset();
        this.output.reset();
        this.debugger.reset();
        this.intelliSenseGen.reset();
        this.configuration.reset();
        this.prebuild.reset();
        this.postbuild.reset();
        this.programmer.reset();
        this.buildPreferences.reset();
        if (commit) {
            this.commit();
        }
    }
    /**
     * Load settings values from the given file.
     * If a value is changed through this operation, its event emitter will
     * fire.
     * @param file Path to the file the settings should be loaded from.
     * @param commit If true reset the modified flags after all values are read.
     * @returns true if the settings are loaded successfully.
     */
    load(file, commit = true) {
        const settings = util.tryParseJSON(fs.readFileSync(file, "utf8"));
        if (settings) {
            this.port.value = settings.port;
            this.board.value = settings.board;
            this.sketch.value = settings.sketch;
            this.configuration.value = settings.configuration;
            this.output.value = settings.output;
            this.debugger.value = settings.debugger;
            this.intelliSenseGen.value = settings.intelliSenseGen;
            this.prebuild.value = settings.prebuild;
            this.postbuild.value = settings.postbuild;
            this.programmer.value = settings.programmer;
            this.buildPreferences.value = settings.buildPreferences;
            if (commit) {
                this.commit();
            }
            return true;
        }
        else {
            logger.notifyUserError("arduinoFileError", new Error(constants.messages.ARDUINO_FILE_ERROR));
            return false;
        }
    }
    /**
     * Writes the settings to the given file if there are modified
     * values. The modification flags are reset (commit()) on successful write.
     * On write failure the modification flags are left unmodified.
     * @param file Path to file the JSON representation of the settings should
     * written to. If either the folder or the file does not exist they are
     * created.
     * @returns true on succes, false on write failure.
     */
    save(file) {
        if (!this.modified) {
            return true;
        }
        let settings = {};
        if (util.fileExistsSync(file)) {
            settings = util.tryParseJSON(fs.readFileSync(file, "utf8"));
        }
        if (!settings) {
            logger.notifyUserError("arduinoFileError", new Error(constants.messages.ARDUINO_FILE_ERROR));
            return false;
        }
        settings.sketch = this.sketch.value;
        settings.port = this.port.value;
        settings.board = this.board.value;
        settings.output = this.output.value;
        settings.debugger = this.debugger.value;
        settings.intelliSenseGen = this.intelliSenseGen.value;
        settings.configuration = this.configuration.value;
        settings.programmer = this.programmer.value;
        util.mkdirRecursivelySync(path.dirname(file));
        fs.writeFileSync(file, JSON.stringify(settings, undefined, 4));
        this.commit();
        return true;
    }
}
exports.DeviceSettings = DeviceSettings;

//# sourceMappingURL=deviceSettings.js.map

// SIG // Begin signature block
// SIG // MIInzAYJKoZIhvcNAQcCoIInvTCCJ7kCAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // R39wx8Mjk151xzyNyR41YvYqVE1Yx8xv8Dvn2c2IiQyg
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
// SIG // ARUwLwYJKoZIhvcNAQkEMSIEIO9wgiWLz2932qkQu2pr
// SIG // cA3pxTLct0UhuoXh2UKZY7uzMEIGCisGAQQBgjcCAQwx
// SIG // NDAyoBSAEgBNAGkAYwByAG8AcwBvAGYAdKEagBhodHRw
// SIG // Oi8vd3d3Lm1pY3Jvc29mdC5jb20wDQYJKoZIhvcNAQEB
// SIG // BQAEggEAKy4N0GJRV4D34ISc8hewE8I8r3FiPX57cd1Z
// SIG // kj/fB72+nbeX3+hGIyL9MxKpzCruP/i9fr8GLs/aoeyN
// SIG // oY2wGQtfw52XHfRkgBcK1vWxBN3BCELcg68Beg+SFj1D
// SIG // NsYpUM1X0n+9uZblLTSIxvI2zUbQOnz7SHHNrMpllTMt
// SIG // JJ3pHP41vE72lWzkQuD27szqZkmxkx2d76qsoXma/nB/
// SIG // Eq1cIVkO7Oo+TRtJRCsM4nvMm3Z0b0l60m0/5bZrWD28
// SIG // XTF8ZRc/2o6Fo3yIyewYnhnh45bokfnBgskDvQ4/N1nH
// SIG // LWs27uuyEQ4m4cNEJpaFFFcW71plffh3YvZ3q9Itn6GC
// SIG // Fy0wghcpBgorBgEEAYI3AwMBMYIXGTCCFxUGCSqGSIb3
// SIG // DQEHAqCCFwYwghcCAgEDMQ8wDQYJYIZIAWUDBAIBBQAw
// SIG // ggFZBgsqhkiG9w0BCRABBKCCAUgEggFEMIIBQAIBAQYK
// SIG // KwYBBAGEWQoDATAxMA0GCWCGSAFlAwQCAQUABCAO3Rbt
// SIG // ls2RbCyEEzh6r+x8IlCcPNgMCbGM1vW/4Xcw9QIGY8fd
// SIG // epfoGBMyMDIzMDEyNTAxMzAyNy42NjNaMASAAgH0oIHY
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
// SIG // MSIEIN9QN0aW/7SC9OyFuf1WHgcKLD76y21ECTLS52yF
// SIG // GYO0MIH6BgsqhkiG9w0BCRACLzGB6jCB5zCB5DCBvQQg
// SIG // J8oNNS1oZxaJ9hzc5WcimntiSfRLwlyVXOuUCAXxyIMw
// SIG // gZgwgYCkfjB8MQswCQYDVQQGEwJVUzETMBEGA1UECBMK
// SIG // V2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwG
// SIG // A1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSYwJAYD
// SIG // VQQDEx1NaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAx
// SIG // MAITMwAAAbWtGt/XhXBtEwABAAABtTAiBCB0KhIRZBBQ
// SIG // VnkHW8wjd0SkZ0XSm8H5u9C0Apim1E594jANBgkqhkiG
// SIG // 9w0BAQsFAASCAgAiaqzk0Wih01JU5QtBc8f8gfXh5DYa
// SIG // d5podlXodD0itDETPYrLYMfBwbuAVZE3PPRMTquO9gZ6
// SIG // g8tvsZOQe7H2I8UlcUgMF12SzublQYAXYXEkqJ6WMktI
// SIG // QQ9Rt1hfEClBrE6eeuDrp6gXxQ9I2WJ96+OOPL7Sw03K
// SIG // 6c+eDZdIj/kMxgUsz+OcZpdfFgGrtygha+JCHSTs5z7H
// SIG // zSlzJ/hQrPblgIUwoktrivHtO6TEJsfbxZk1JITNZXLa
// SIG // rTKmtk8W2pIwfHj14G0uMmxiPV/knk/ZbV1okyMObdWd
// SIG // t1JX2qaxcMn301HGbspilEIwU/IahfOobc2aMW3jCxwO
// SIG // MmCh70q9UOnA3OD4pKyhkicGWJV25OsFDWRsKmR+L5hQ
// SIG // j5a0MwWmFLE57KGd/istzVz0dA8iAUiUgLMk7ZlGDsud
// SIG // DbvR+7xqn2Q5SwLpojp2RrVeofe6lkCJtFPoAxfpj6cp
// SIG // jNC31qq1A2hHqvw3lt8Aiy3swHhxobl0/JCsFXe64gx4
// SIG // wS8SyCEZTap1cRbY+R3b89ipxL2U/n5jJtpMJy0797LF
// SIG // eiCE46hhRS3454e7d7nLDWX2WG+I7ZxeRMUElb+a4bGQ
// SIG // 0XrMmf0YLnZnN42eBv72Gaxm7IHllae/l1OAxWTfx/9X
// SIG // 6ETu+AEDxKwLe00H+cMD7EXDPImgNEXhPH1Eqw==
// SIG // End signature block
