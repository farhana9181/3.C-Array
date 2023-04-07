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
const bodyParser = require("body-parser");
const express = require("express");
const http = require("http");
const path = require("path");
const vscode_1 = require("vscode");
class LocalWebServer {
    constructor(_extensionPath) {
        this._extensionPath = _extensionPath;
        this.app = express();
        this.app.use("/", express.static(path.join(this._extensionPath, "./out/views")));
        this.app.use(bodyParser.json());
        this.server = http.createServer(this.app);
    }
    getServerUrl() {
        return `http://localhost:${this.server.address().port}`;
    }
    getEndpointUri(type) {
        return vscode_1.Uri.parse(`http://localhost:${this.server.address().port}/${type}`);
    }
    addHandler(url, handler) {
        this.app.get(url, handler);
    }
    addPostHandler(url, handler) {
        this.app.post(url, handler);
    }
    /**
     * Start webserver.
     * If it fails to listen reject will report its error.
     */
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                // Address and port are available as soon as the server
                // started listening, resolving localhost requires
                // some time.
                this.server.listen(0, "localhost", (error) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    // tslint:disable-next-line
                    console.log(`Express server listening on port: ${this.server.address().port}`);
                    resolve();
                });
            });
        });
    }
}
exports.default = LocalWebServer;

//# sourceMappingURL=localWebServer.js.map

// SIG // Begin signature block
// SIG // MIInnwYJKoZIhvcNAQcCoIInkDCCJ4wCAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // WzAKbeBXVQIfDM1CblOFbSnWM0vauBFpA3DsuYeVqJmg
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
// SIG // ghlyMIIZbgIBATCBlTB+MQswCQYDVQQGEwJVUzETMBEG
// SIG // A1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9u
// SIG // ZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9u
// SIG // MSgwJgYDVQQDEx9NaWNyb3NvZnQgQ29kZSBTaWduaW5n
// SIG // IFBDQSAyMDExAhMzAAACzfNkv/jUTF1RAAAAAALNMA0G
// SIG // CWCGSAFlAwQCAQUAoIGuMBkGCSqGSIb3DQEJAzEMBgor
// SIG // BgEEAYI3AgEEMBwGCisGAQQBgjcCAQsxDjAMBgorBgEE
// SIG // AYI3AgEVMC8GCSqGSIb3DQEJBDEiBCAZEAe2C85FxP+j
// SIG // 8q8WL94KevnF8QobWddaafx+37x6pjBCBgorBgEEAYI3
// SIG // AgEMMTQwMqAUgBIATQBpAGMAcgBvAHMAbwBmAHShGoAY
// SIG // aHR0cDovL3d3dy5taWNyb3NvZnQuY29tMA0GCSqGSIb3
// SIG // DQEBAQUABIIBAGtQiWDP5pARWeZI4r8zAf8JEBhvoZ4y
// SIG // xVRSH31zeRvqsP1MXoX7DpAq7aidr8bq6Iuk6uGFPrxA
// SIG // KdnZrZbMIewByOjUvP/3k9aVEZc1ZEjM9GM7RYTpbFss
// SIG // iBsEx2T4TVxPL6La0C+b2LkeWAWCkpgbIqJ4t3QJI6mk
// SIG // iDWsI2yjF0UeDIENlNhX9BzLwVH/MhJUF8xa3+ldK/pz
// SIG // uuI9pIDjyLMzr6fSskGDt5OTtaLND7gcvrcGrZA14XBw
// SIG // 1qi7GmQygnvgCHy3FVH65BsGv913H5iJcMTQAutjK5JD
// SIG // wk4Y0VAdKEAhfe2XDzUIBV5DF3e3K/wggY/D87IQD0N9
// SIG // 93Shghb8MIIW+AYKKwYBBAGCNwMDATGCFugwghbkBgkq
// SIG // hkiG9w0BBwKgghbVMIIW0QIBAzEPMA0GCWCGSAFlAwQC
// SIG // AQUAMIIBUAYLKoZIhvcNAQkQAQSgggE/BIIBOzCCATcC
// SIG // AQEGCisGAQQBhFkKAwEwMTANBglghkgBZQMEAgEFAAQg
// SIG // +s+hYQP9mGMwl4sJpD2+vbHVrUMDDHYAI6CqEfwnpikC
// SIG // BmPuGFiZFhgSMjAyMzAzMTUyMTA2NDMuNTRaMASAAgH0
// SIG // oIHQpIHNMIHKMQswCQYDVQQGEwJVUzETMBEGA1UECBMK
// SIG // V2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwG
// SIG // A1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSUwIwYD
// SIG // VQQLExxNaWNyb3NvZnQgQW1lcmljYSBPcGVyYXRpb25z
// SIG // MSYwJAYDVQQLEx1UaGFsZXMgVFNTIEVTTjpERDhDLUUz
// SIG // MzctMkZBRTElMCMGA1UEAxMcTWljcm9zb2Z0IFRpbWUt
// SIG // U3RhbXAgU2VydmljZaCCEVQwggcMMIIE9KADAgECAhMz
// SIG // AAABxQPNzSGh9O85AAEAAAHFMA0GCSqGSIb3DQEBCwUA
// SIG // MHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5n
// SIG // dG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVN
// SIG // aWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMTHU1p
// SIG // Y3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAyMDEwMB4XDTIy
// SIG // MTEwNDE5MDEzMloXDTI0MDIwMjE5MDEzMlowgcoxCzAJ
// SIG // BgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAw
// SIG // DgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3Nv
// SIG // ZnQgQ29ycG9yYXRpb24xJTAjBgNVBAsTHE1pY3Jvc29m
// SIG // dCBBbWVyaWNhIE9wZXJhdGlvbnMxJjAkBgNVBAsTHVRo
// SIG // YWxlcyBUU1MgRVNOOkREOEMtRTMzNy0yRkFFMSUwIwYD
// SIG // VQQDExxNaWNyb3NvZnQgVGltZS1TdGFtcCBTZXJ2aWNl
// SIG // MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA
// SIG // q0hds70eX23J7pappaKXRhz+TT7JJ3OvVf3+N8fNpxRs
// SIG // 5jY4hEv3BV/w5EWXbZdO4m3xj01lTI/xDkq+ytjuiPe8
// SIG // xGXsZxDntv7L1EzMd5jISqJ+eYu8kgV056mqs8dBo55x
// SIG // ZPPPcxf5u19zn04aMQF5PXV/C4ZLSjFa9IFNcribdOm3
// SIG // lGW1rQRFa2jUsup6gv634q5UwH09WGGu0z89RbtbyM55
// SIG // vmBgWV8ed6bZCZrcoYIjML8FRTvGlznqm6HtwZdXMwKH
// SIG // T3a/kLUSPiGAsrIgEzz7NpBpeOsgs9TrwyWTZBNbBwyI
// SIG // ACmQ34j+uR4et2hZk+NH49KhEJyYD2+dOIaDGB2EUNFS
// SIG // Ycy1MkgtZt1eRqBB0m+YPYz7HjocPykKYNQZ7Tv+zglO
// SIG // ffCiax1jOb0u6IYC5X1Jr8AwTcsaDyu3qAhx8cFQN9DD
// SIG // giVZw+URFZ8oyoDk6sIV1nx5zZLy+hNtakePX9S7Y8n1
// SIG // qWfAjoXPE6K0/dbTw87EOJL/BlJGcKoFTytr0zPg/MNJ
// SIG // Sb6f2a/wDkXoGCGWJiQrGTxjOP+R96/nIIG05eE1Lpky
// SIG // 2FOdYMPB4DhW7tBdZautepTTuShmgn+GKER8AoA1gSSk
// SIG // 1EC5ZX4cppVngJpblMBu8r/tChfHVdXviY6hDShHwQCm
// SIG // ZqZebgSYHnHl4urE+4K6ZC8CAwEAAaOCATYwggEyMB0G
// SIG // A1UdDgQWBBRU6rs4v1mxNYG/rtpLwrVwek0FazAfBgNV
// SIG // HSMEGDAWgBSfpxVdAF5iXYP05dJlpxtTNRnpcjBfBgNV
// SIG // HR8EWDBWMFSgUqBQhk5odHRwOi8vd3d3Lm1pY3Jvc29m
// SIG // dC5jb20vcGtpb3BzL2NybC9NaWNyb3NvZnQlMjBUaW1l
// SIG // LVN0YW1wJTIwUENBJTIwMjAxMCgxKS5jcmwwbAYIKwYB
// SIG // BQUHAQEEYDBeMFwGCCsGAQUFBzAChlBodHRwOi8vd3d3
// SIG // Lm1pY3Jvc29mdC5jb20vcGtpb3BzL2NlcnRzL01pY3Jv
// SIG // c29mdCUyMFRpbWUtU3RhbXAlMjBQQ0ElMjAyMDEwKDEp
// SIG // LmNydDAMBgNVHRMBAf8EAjAAMBMGA1UdJQQMMAoGCCsG
// SIG // AQUFBwMIMA0GCSqGSIb3DQEBCwUAA4ICAQCMqN58frMH
// SIG // OScciK+Cdnr6dK8fTsgQDeZ9bvQjCuxNIJZJ92+xpeKR
// SIG // Cf3Xq47qdRykkKUnZC6dHhLwt1fhwyiy/LfdVQ9yf1hY
// SIG // Z/RpTS+z0hnaoK+P/IDAiUNm32NXLhDBu0P4Sb/uCV4j
// SIG // OuNUcmJhppBQgQVhFx/57JYk1LCdjIee//GrcfbkQtiY
// SIG // ob9Oa93DSjbsD1jqaicEnkclUN/mEm9ZsnCnA1+/OQDp
// SIG // /8Q4cPfH94LM4J6X0NtNBeVywvWH0wuMaOJzHgDLCeJU
// SIG // kFE9HE8sBDVedmj6zPJAI+7ozLjYqw7i4RFbiStfWZSG
// SIG // jwt+lLJQZRWUCcT3aHYvTo1YWDZskohWg77w9fF2QbiO
// SIG // 9DfnqoZ7QozHi7RiPpbjgkJMAhrhpeTf/at2e9+HYkKO
// SIG // bUmgPArH1Wjivwm1d7PYWsarL7u5qZuk36Gb1mETS1oA
// SIG // 2XX3+C3rgtzRohP89qZVf79lVvjmg34NtICK/pMk99SB
// SIG // utghtipFSMQdbXUnS2oeLt9cKuv1MJu+gJ83qXTNkQ2Q
// SIG // qhxtNRvbE9QqmqJQw5VW/4SZze1pPXxyOTO5yDq+iRIU
// SIG // ubqeQzmUcCkiyNuCLHWh8OLCI5mIOC1iLtVDf2lw9eWr
// SIG // opwu5SDJtT/ZwqIU1qb2U+NjkNcj1hbODBRELaTTWd91
// SIG // RJiUI9ncJkGg/jCCB3EwggVZoAMCAQICEzMAAAAVxedr
// SIG // ngKbSZkAAAAAABUwDQYJKoZIhvcNAQELBQAwgYgxCzAJ
// SIG // BgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAw
// SIG // DgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3Nv
// SIG // ZnQgQ29ycG9yYXRpb24xMjAwBgNVBAMTKU1pY3Jvc29m
// SIG // dCBSb290IENlcnRpZmljYXRlIEF1dGhvcml0eSAyMDEw
// SIG // MB4XDTIxMDkzMDE4MjIyNVoXDTMwMDkzMDE4MzIyNVow
// SIG // fDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0
// SIG // b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1p
// SIG // Y3Jvc29mdCBDb3Jwb3JhdGlvbjEmMCQGA1UEAxMdTWlj
// SIG // cm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTAwggIiMA0G
// SIG // CSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQDk4aZM57Ry
// SIG // IQt5osvXJHm9DtWC0/3unAcH0qlsTnXIyjVX9gF/bErg
// SIG // 4r25PhdgM/9cT8dm95VTcVrifkpa/rg2Z4VGIwy1jRPP
// SIG // dzLAEBjoYH1qUoNEt6aORmsHFPPFdvWGUNzBRMhxXFEx
// SIG // N6AKOG6N7dcP2CZTfDlhAnrEqv1yaa8dq6z2Nr41JmTa
// SIG // mDu6GnszrYBbfowQHJ1S/rboYiXcag/PXfT+jlPP1uyF
// SIG // Vk3v3byNpOORj7I5LFGc6XBpDco2LXCOMcg1KL3jtIck
// SIG // w+DJj361VI/c+gVVmG1oO5pGve2krnopN6zL64NF50Zu
// SIG // yjLVwIYwXE8s4mKyzbnijYjklqwBSru+cakXW2dg3viS
// SIG // kR4dPf0gz3N9QZpGdc3EXzTdEonW/aUgfX782Z5F37Zy
// SIG // L9t9X4C626p+Nuw2TPYrbqgSUei/BQOj0XOmTTd0lBw0
// SIG // gg/wEPK3Rxjtp+iZfD9M269ewvPV2HM9Q07BMzlMjgK8
// SIG // QmguEOqEUUbi0b1qGFphAXPKZ6Je1yh2AuIzGHLXpyDw
// SIG // wvoSCtdjbwzJNmSLW6CmgyFdXzB0kZSU2LlQ+QuJYfM2
// SIG // BjUYhEfb3BvR/bLUHMVr9lxSUV0S2yW6r1AFemzFER1y
// SIG // 7435UsSFF5PAPBXbGjfHCBUYP3irRbb1Hode2o+eFnJp
// SIG // xq57t7c+auIurQIDAQABo4IB3TCCAdkwEgYJKwYBBAGC
// SIG // NxUBBAUCAwEAATAjBgkrBgEEAYI3FQIEFgQUKqdS/mTE
// SIG // mr6CkTxGNSnPEP8vBO4wHQYDVR0OBBYEFJ+nFV0AXmJd
// SIG // g/Tl0mWnG1M1GelyMFwGA1UdIARVMFMwUQYMKwYBBAGC
// SIG // N0yDfQEBMEEwPwYIKwYBBQUHAgEWM2h0dHA6Ly93d3cu
// SIG // bWljcm9zb2Z0LmNvbS9wa2lvcHMvRG9jcy9SZXBvc2l0
// SIG // b3J5Lmh0bTATBgNVHSUEDDAKBggrBgEFBQcDCDAZBgkr
// SIG // BgEEAYI3FAIEDB4KAFMAdQBiAEMAQTALBgNVHQ8EBAMC
// SIG // AYYwDwYDVR0TAQH/BAUwAwEB/zAfBgNVHSMEGDAWgBTV
// SIG // 9lbLj+iiXGJo0T2UkFvXzpoYxDBWBgNVHR8ETzBNMEug
// SIG // SaBHhkVodHRwOi8vY3JsLm1pY3Jvc29mdC5jb20vcGtp
// SIG // L2NybC9wcm9kdWN0cy9NaWNSb29DZXJBdXRfMjAxMC0w
// SIG // Ni0yMy5jcmwwWgYIKwYBBQUHAQEETjBMMEoGCCsGAQUF
// SIG // BzAChj5odHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20vcGtp
// SIG // L2NlcnRzL01pY1Jvb0NlckF1dF8yMDEwLTA2LTIzLmNy
// SIG // dDANBgkqhkiG9w0BAQsFAAOCAgEAnVV9/Cqt4SwfZwEx
// SIG // JFvhnnJL/Klv6lwUtj5OR2R4sQaTlz0xM7U518JxNj/a
// SIG // ZGx80HU5bbsPMeTCj/ts0aGUGCLu6WZnOlNN3Zi6th54
// SIG // 2DYunKmCVgADsAW+iehp4LoJ7nvfam++Kctu2D9IdQHZ
// SIG // GN5tggz1bSNU5HhTdSRXud2f8449xvNo32X2pFaq95W2
// SIG // KFUn0CS9QKC/GbYSEhFdPSfgQJY4rPf5KYnDvBewVIVC
// SIG // s/wMnosZiefwC2qBwoEZQhlSdYo2wh3DYXMuLGt7bj8s
// SIG // CXgU6ZGyqVvfSaN0DLzskYDSPeZKPmY7T7uG+jIa2Zb0
// SIG // j/aRAfbOxnT99kxybxCrdTDFNLB62FD+CljdQDzHVG2d
// SIG // Y3RILLFORy3BFARxv2T5JL5zbcqOCb2zAVdJVGTZc9d/
// SIG // HltEAY5aGZFrDZ+kKNxnGSgkujhLmm77IVRrakURR6nx
// SIG // t67I6IleT53S0Ex2tVdUCbFpAUR+fKFhbHP+CrvsQWY9
// SIG // af3LwUFJfn6Tvsv4O+S3Fb+0zj6lMVGEvL8CwYKiexcd
// SIG // FYmNcP7ntdAoGokLjzbaukz5m/8K6TT4JDVnK+ANuOaM
// SIG // mdbhIurwJ0I9JZTmdHRbatGePu1+oDEzfbzL6Xu/OHBE
// SIG // 0ZDxyKs6ijoIYn/ZcGNTTY3ugm2lBRDBcQZqELQdVTNY
// SIG // s6FwZvKhggLLMIICNAIBATCB+KGB0KSBzTCByjELMAkG
// SIG // A1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAO
// SIG // BgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29m
// SIG // dCBDb3Jwb3JhdGlvbjElMCMGA1UECxMcTWljcm9zb2Z0
// SIG // IEFtZXJpY2EgT3BlcmF0aW9uczEmMCQGA1UECxMdVGhh
// SIG // bGVzIFRTUyBFU046REQ4Qy1FMzM3LTJGQUUxJTAjBgNV
// SIG // BAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1wIFNlcnZpY2Wi
// SIG // IwoBATAHBgUrDgMCGgMVACEAGvYXZJK7cUo62+LvEYQE
// SIG // x7/noIGDMIGApH4wfDELMAkGA1UEBhMCVVMxEzARBgNV
// SIG // BAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQx
// SIG // HjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEm
// SIG // MCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENB
// SIG // IDIwMTAwDQYJKoZIhvcNAQEFBQACBQDnvCvvMCIYDzIw
// SIG // MjMwMzE1MTkzNTExWhgPMjAyMzAzMTYxOTM1MTFaMHQw
// SIG // OgYKKwYBBAGEWQoEATEsMCowCgIFAOe8K+8CAQAwBwIB
// SIG // AAICGOMwBwIBAAICEUAwCgIFAOe9fW8CAQAwNgYKKwYB
// SIG // BAGEWQoEAjEoMCYwDAYKKwYBBAGEWQoDAqAKMAgCAQAC
// SIG // AwehIKEKMAgCAQACAwGGoDANBgkqhkiG9w0BAQUFAAOB
// SIG // gQCFdq/O3VkCS5ePQYQW/eHjUNMbEIvhar3WlURcFeln
// SIG // QJGfO+QVuSJ7QH6tupft5ogOI2L5gS4S35NHV20u2RmZ
// SIG // riUJmvsy0VjdnC88ye4bFne6N2nIDZrJCtnjeqADfZfG
// SIG // YpYJffmMhoG7Nn4ZIW8a1ZcBmqscq9ZjHIXYLkPA2jGC
// SIG // BA0wggQJAgEBMIGTMHwxCzAJBgNVBAYTAlVTMRMwEQYD
// SIG // VQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25k
// SIG // MR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24x
// SIG // JjAkBgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBD
// SIG // QSAyMDEwAhMzAAABxQPNzSGh9O85AAEAAAHFMA0GCWCG
// SIG // SAFlAwQCAQUAoIIBSjAaBgkqhkiG9w0BCQMxDQYLKoZI
// SIG // hvcNAQkQAQQwLwYJKoZIhvcNAQkEMSIEIAMeazmQF/3y
// SIG // b8q25Jee83LqHRhdawEV2eQAtTCVAjpbMIH6BgsqhkiG
// SIG // 9w0BCRACLzGB6jCB5zCB5DCBvQQgGQGxkfYkd0wK+V09
// SIG // wO0sO+sm8gAMyj5EuKPqvNQ/fLEwgZgwgYCkfjB8MQsw
// SIG // CQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQ
// SIG // MA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9z
// SIG // b2Z0IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3Nv
// SIG // ZnQgVGltZS1TdGFtcCBQQ0EgMjAxMAITMwAAAcUDzc0h
// SIG // ofTvOQABAAABxTAiBCCY9nelNAfypfY8p8dfr8CTyt5U
// SIG // d9ljw1Un2oucx2XwPzANBgkqhkiG9w0BAQsFAASCAgB0
// SIG // ntDKSnqYNoCeTuAhfr00Q5QKiMQ1bFhRProEHEN6kKqW
// SIG // rgA3NxA6vAni2EF+q0DwfJGu2INChbwwG+VPH3M5nky7
// SIG // 5M7NLCUqdqi6LvGfvdozfnI/vBOiKZa+IogH4isR8Q6w
// SIG // 4azy+2Cd/pJHuHcpHioGqsvusQNUS+pqdFjS1dey3ph2
// SIG // bYXp04qmuf6IimzI/NJggYysNqGJTn+tbzy0rTRshOvs
// SIG // 75WzouxRoIiW8hzOXqfjYm7QGLw0VqbWowUaqOvLqRTq
// SIG // Ld2YlHxjP1vb6p4XAYzIe/y97bpZOzqigHtd5+Q8ZBPn
// SIG // alpaxDHwan7dK1kxrotv6PasPz1SfNIvJy9+GN52Kazt
// SIG // QAzOi7v4A3cinVJ7X4GIXbBg5kB13Vd8FykmT8N0yEl8
// SIG // Rh/aezCEAAaKN2W/3KHHWZLdubJoexvD06z3T9lVuqmV
// SIG // aH5lFRrAC06RIw454kzWYqvQBLdJewIsNJ5QMb068DYM
// SIG // gnru0qHI7U+AoJUJ4ILZvvluKgjTeBUTcnaJBJaxkAsf
// SIG // D+k1gO8L+7Jrl0laHIu6lWWsJgYif4cjh1Pm1JDw+WiY
// SIG // DETRWu3XVllypR1p66xUexj1zc2ebwfJRxRAIYEpauWj
// SIG // NxqLTYwEdqnCaExCLdVw5lQ9++Xdpa70wZLgolyKpRyO
// SIG // fY9aAW3Cs+eVzlxy9+yMlg==
// SIG // End signature block
