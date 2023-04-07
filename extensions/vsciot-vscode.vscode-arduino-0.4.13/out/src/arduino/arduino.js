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
exports.ArduinoApp = exports.BuildMode = void 0;
const fs = require("fs");
const glob = require("glob");
const os = require("os");
const path = require("path");
const vscode = require("vscode");
const constants = require("../common/constants");
const util = require("../common/util");
const logger = require("../logger/logger");
const deviceContext_1 = require("../deviceContext");
const intellisense_1 = require("./intellisense");
const vscodeSettings_1 = require("./vscodeSettings");
const outputChannel_1 = require("../common/outputChannel");
const workspace_1 = require("../common/workspace");
const serialMonitor_1 = require("../serialmonitor/serialMonitor");
const usbDetector_1 = require("../serialmonitor/usbDetector");
/**
 * Supported build modes. For further explanation see the documentation
 * of ArduinoApp.build().
 * The strings are used for status reporting within the above function.
 */
var BuildMode;
(function (BuildMode) {
    BuildMode["Verify"] = "Verifying";
    BuildMode["Analyze"] = "Analyzing";
    BuildMode["Upload"] = "Uploading";
    BuildMode["CliUpload"] = "Uploading using Arduino CLI";
    BuildMode["UploadProgrammer"] = "Uploading (programmer)";
    BuildMode["CliUploadProgrammer"] = "Uploading (programmer) using Arduino CLI";
})(BuildMode = exports.BuildMode || (exports.BuildMode = {}));
/**
 * Represent an Arduino application based on the official Arduino IDE.
 */
class ArduinoApp {
    /**
     * @param {IArduinoSettings} _settings ArduinoSetting object.
     */
    constructor(_settings) {
        this._settings = _settings;
        /**
         * Indicates if a build is currently in progress.
         * If so any call to this.build() will return false immediately.
         */
        this._building = false;
        const analysisDelayMs = 1000 * 3;
        this._analysisManager = new intellisense_1.AnalysisManager(() => this._building, () => __awaiter(this, void 0, void 0, function* () { yield this.build(BuildMode.Analyze); }), analysisDelayMs);
    }
    /**
     * Need refresh Arduino IDE's setting when starting up.
     * @param {boolean} force - Whether force initialize the arduino
     */
    initialize(force = false) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!util.fileExistsSync(this._settings.preferencePath)) {
                try {
                    // Use empty pref value to initialize preference.txt file
                    yield this.setPref("boardsmanager.additional.urls", "");
                    this._settings.reloadPreferences(); // reload preferences.
                }
                catch (ex) {
                }
            }
            if (force || !util.fileExistsSync(path.join(this._settings.packagePath, "package_index.json"))) {
                try {
                    // Use the dummy package to initialize the Arduino IDE
                    yield this.installBoard("dummy", "", "", true);
                }
                catch (ex) {
                }
            }
            if (this._settings.analyzeOnSettingChange) {
                // set up event handling for IntelliSense analysis
                const requestAnalysis = () => __awaiter(this, void 0, void 0, function* () {
                    if (intellisense_1.isCompilerParserEnabled()) {
                        yield this._analysisManager.requestAnalysis();
                    }
                });
                const dc = deviceContext_1.DeviceContext.getInstance();
                dc.onChangeBoard(requestAnalysis);
                dc.onChangeConfiguration(requestAnalysis);
                dc.onChangeSketch(requestAnalysis);
            }
        });
    }
    /**
     * Initialize the arduino library.
     * @param {boolean} force - Whether force refresh library index file
     */
    initializeLibrary(force = false) {
        return __awaiter(this, void 0, void 0, function* () {
            if (force || !util.fileExistsSync(path.join(this._settings.packagePath, "library_index.json"))) {
                try {
                    // Use the dummy library to initialize the Arduino IDE
                    yield this.installLibrary("dummy", "", true);
                }
                catch (ex) {
                }
            }
        });
    }
    /**
     * Set the Arduino preferences value.
     * @param {string} key - The preference key
     * @param {string} value - The preference value
     */
    setPref(key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (this.useArduinoCli()) {
                    yield util.spawn(this._settings.commandPath, ["--build-property", `${key}=${value}`]);
                }
                else {
                    yield util.spawn(this._settings.commandPath, ["--pref", `${key}=${value}`, "--save-prefs"]);
                }
            }
            catch (ex) {
            }
        });
    }
    /**
     * Returns true if a build is currently in progress.
     */
    get building() {
        return this._building;
    }
    /**
     * Runs the arduino builder to build/compile and - if necessary - upload
     * the current sketch.
     * @param buildMode Build mode.
     *  * BuildMode.Upload: Compile and upload
     *  * BuildMode.UploadProgrammer: Compile and upload using the user
     *     selectable programmer
     *  * BuildMode.Analyze: Compile, analyze the output and generate
     *     IntelliSense configuration from it.
     *  * BuildMode.Verify: Just compile.
     * All build modes except for BuildMode.Analyze run interactively, i.e. if
     * something is missing, it tries to query the user for the missing piece
     * of information (sketch, board, etc.). Analyze runs non interactively and
     * just returns false.
     * @param buildDir Override the build directory set by the project settings
     * with the given directory.
     * @returns true on success, false if
     *  * another build is currently in progress
     *  * board- or programmer-manager aren't initialized yet
     *  * or something went wrong during the build
     */
    build(buildMode, buildDir) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._boardManager || !this._programmerManager || this._building) {
                return false;
            }
            this._building = true;
            return yield this._build(buildMode, buildDir)
                .then((ret) => {
                this._building = false;
                return ret;
            })
                .catch((reason) => {
                this._building = false;
                logger.notifyUserError("ArduinoApp.build", reason, `Unhandled exception when cleaning up build "${buildMode}": ${JSON.stringify(reason)}`);
                return false;
            });
        });
    }
    // Include the *.h header files from selected library to the arduino sketch.
    includeLibrary(libraryPath) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!workspace_1.ArduinoWorkspace.rootPath) {
                return;
            }
            const dc = deviceContext_1.DeviceContext.getInstance();
            const appPath = path.join(workspace_1.ArduinoWorkspace.rootPath, dc.sketch);
            if (util.fileExistsSync(appPath)) {
                const hFiles = glob.sync(`${libraryPath}/*.h`, {
                    nodir: true,
                    matchBase: true,
                });
                const hIncludes = hFiles.map((hFile) => {
                    return `#include <${path.basename(hFile)}>`;
                }).join(os.EOL);
                // Open the sketch and bring up it to current visible view.
                const textDocument = yield vscode.workspace.openTextDocument(appPath);
                yield vscode.window.showTextDocument(textDocument, vscode.ViewColumn.One, true);
                const activeEditor = vscode.window.visibleTextEditors.find((textEditor) => {
                    return path.resolve(textEditor.document.fileName) === path.resolve(appPath);
                });
                if (activeEditor) {
                    // Insert *.h at the beginning of the sketch code.
                    yield activeEditor.edit((editBuilder) => {
                        editBuilder.insert(new vscode.Position(0, 0), `${hIncludes}${os.EOL}${os.EOL}`);
                    });
                }
            }
        });
    }
    /**
     * Installs arduino board package.
     * (If using the aduino CLI this installs the corrosponding core.)
     * @param {string} packageName - board vendor
     * @param {string} arch - board architecture
     * @param {string} version - version of board package or core to download
     * @param {boolean} [showOutput=true] - show raw output from command
     */
    installBoard(packageName, arch = "", version = "", showOutput = true) {
        return __awaiter(this, void 0, void 0, function* () {
            outputChannel_1.arduinoChannel.show();
            const updatingIndex = packageName === "dummy" && !arch && !version;
            if (updatingIndex) {
                outputChannel_1.arduinoChannel.start(`Update package index files...`);
            }
            else {
                try {
                    const packagePath = path.join(this._settings.packagePath, "packages", packageName, arch);
                    if (util.directoryExistsSync(packagePath)) {
                        util.rmdirRecursivelySync(packagePath);
                    }
                    outputChannel_1.arduinoChannel.start(`Install package - ${packageName}...`);
                }
                catch (error) {
                    outputChannel_1.arduinoChannel.start(`Install package - ${packageName} failed under directory : ${error.path}${os.EOL}
                                      Please make sure the folder is not occupied by other procedures .`);
                    outputChannel_1.arduinoChannel.error(`Error message - ${error.message}${os.EOL}`);
                    outputChannel_1.arduinoChannel.error(`Exit with code=${error.code}${os.EOL}`);
                    return;
                }
            }
            outputChannel_1.arduinoChannel.info(`${packageName}${arch && ":" + arch}${version && ":" + version}`);
            try {
                if (this.useArduinoCli()) {
                    yield util.spawn(this._settings.commandPath, ["core", "install", `${packageName}${arch && ":" + arch}${version && "@" + version}`], undefined, { channel: showOutput ? outputChannel_1.arduinoChannel.channel : null });
                }
                else {
                    yield util.spawn(this._settings.commandPath, ["--install-boards", `${packageName}${arch && ":" + arch}${version && ":" + version}`], undefined, { channel: showOutput ? outputChannel_1.arduinoChannel.channel : null });
                }
                if (updatingIndex) {
                    outputChannel_1.arduinoChannel.end("Updated package index files.");
                }
                else {
                    outputChannel_1.arduinoChannel.end(`Installed board package - ${packageName}${os.EOL}`);
                }
            }
            catch (error) {
                // If a platform with the same version is already installed, nothing is installed and program exits with exit code 1
                if (error.code === 1) {
                    if (updatingIndex) {
                        outputChannel_1.arduinoChannel.end("Updated package index files.");
                    }
                    else {
                        outputChannel_1.arduinoChannel.end(`Installed board package - ${packageName}${os.EOL}`);
                    }
                }
                else {
                    outputChannel_1.arduinoChannel.error(`Exit with code=${error.code}${os.EOL}`);
                }
            }
        });
    }
    uninstallBoard(boardName, packagePath) {
        outputChannel_1.arduinoChannel.start(`Uninstall board package - ${boardName}...`);
        util.rmdirRecursivelySync(packagePath);
        outputChannel_1.arduinoChannel.end(`Uninstalled board package - ${boardName}${os.EOL}`);
    }
    /**
     * Downloads or updates a library
     * @param {string} libName - name of the library to download
     * @param {string} version - version of library to download
     * @param {boolean} [showOutput=true] - show raw output from command
     */
    installLibrary(libName, version = "", showOutput = true) {
        return __awaiter(this, void 0, void 0, function* () {
            outputChannel_1.arduinoChannel.show();
            const updatingIndex = (libName === "dummy" && !version);
            if (updatingIndex) {
                outputChannel_1.arduinoChannel.start("Update library index files...");
            }
            else {
                outputChannel_1.arduinoChannel.start(`Install library - ${libName}`);
            }
            try {
                if (this.useArduinoCli()) {
                    yield util.spawn(this._settings.commandPath, ["lib", "install", `${libName}${version && "@" + version}`], undefined, { channel: showOutput ? outputChannel_1.arduinoChannel.channel : undefined });
                }
                else {
                    yield util.spawn(this._settings.commandPath, ["--install-library", `${libName}${version && ":" + version}`], undefined, { channel: showOutput ? outputChannel_1.arduinoChannel.channel : undefined });
                }
                if (updatingIndex) {
                    outputChannel_1.arduinoChannel.end("Updated library index files.");
                }
                else {
                    outputChannel_1.arduinoChannel.end(`Installed library - ${libName}${os.EOL}`);
                }
            }
            catch (error) {
                // If a library with the same version is already installed, nothing is installed and program exits with exit code 1
                if (error.code === 1) {
                    if (updatingIndex) {
                        outputChannel_1.arduinoChannel.end("Updated library index files.");
                    }
                    else {
                        outputChannel_1.arduinoChannel.end(`Installed library - ${libName}${os.EOL}`);
                    }
                }
                else {
                    outputChannel_1.arduinoChannel.error(`Exit with code=${error.code}${os.EOL}`);
                }
            }
        });
    }
    uninstallLibrary(libName, libPath) {
        outputChannel_1.arduinoChannel.start(`Remove library - ${libName}`);
        util.rmdirRecursivelySync(libPath);
        outputChannel_1.arduinoChannel.end(`Removed library - ${libName}${os.EOL}`);
    }
    openExample(example) {
        function tmpName(name) {
            let counter = 0;
            let candidateName = name;
            // eslint-disable-next-line no-constant-condition
            while (true) {
                if (!util.fileExistsSync(candidateName) && !util.directoryExistsSync(candidateName)) {
                    return candidateName;
                }
                counter++;
                candidateName = `${name}_${counter}`;
            }
        }
        // Step 1: Copy the example project to a temporary directory.
        const sketchPath = path.join(this._settings.sketchbookPath, "generated_examples");
        if (!util.directoryExistsSync(sketchPath)) {
            util.mkdirRecursivelySync(sketchPath);
        }
        let destExample = "";
        if (util.directoryExistsSync(example)) {
            destExample = tmpName(path.join(sketchPath, path.basename(example)));
            util.cp(example, destExample);
        }
        else if (util.fileExistsSync(example)) {
            const exampleName = path.basename(example, path.extname(example));
            destExample = tmpName(path.join(sketchPath, exampleName));
            util.mkdirRecursivelySync(destExample);
            util.cp(example, path.join(destExample, path.basename(example)));
        }
        if (destExample) {
            // Step 2: Scaffold the example project to an arduino project.
            const items = fs.readdirSync(destExample);
            const sketchFile = items.find((item) => {
                return util.isArduinoFile(path.join(destExample, item));
            });
            if (sketchFile) {
                // Generate arduino.json
                const dc = deviceContext_1.DeviceContext.getInstance();
                const arduinoJson = {
                    sketch: sketchFile,
                    // TODO EW, 2020-02-18: COM1 is Windows specific - what about OSX and Linux users?
                    port: dc.port || "COM1",
                    board: dc.board,
                    configuration: dc.configuration,
                };
                const arduinoConfigFilePath = path.join(destExample, constants.ARDUINO_CONFIG_FILE);
                util.mkdirRecursivelySync(path.dirname(arduinoConfigFilePath));
                fs.writeFileSync(arduinoConfigFilePath, JSON.stringify(arduinoJson, null, 4));
            }
            // Step 3: Open the arduino project at a new vscode window.
            vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(destExample), true);
        }
        return destExample;
    }
    get settings() {
        return this._settings;
    }
    get boardManager() {
        return this._boardManager;
    }
    set boardManager(value) {
        this._boardManager = value;
    }
    get libraryManager() {
        return this._libraryManager;
    }
    set libraryManager(value) {
        this._libraryManager = value;
    }
    get exampleManager() {
        return this._exampleManager;
    }
    set exampleManager(value) {
        this._exampleManager = value;
    }
    get programmerManager() {
        return this._programmerManager;
    }
    set programmerManager(value) {
        this._programmerManager = value;
    }
    /**
     * Runs the pre or post build command.
     * Usually before one of
     *  * verify
     *  * upload
     *  * upload using programmer
     * @param dc Device context prepared during one of the above actions
     * @param what "pre" if the pre-build command should be run, "post" if the
     * post-build command should be run.
     * @returns True if successful, false on error.
     */
    runPrePostBuildCommand(dc, environment, what) {
        return __awaiter(this, void 0, void 0, function* () {
            const cmdline = what === "pre"
                ? dc.prebuild
                : dc.postbuild;
            if (!cmdline) {
                return true; // Successfully done nothing.
            }
            outputChannel_1.arduinoChannel.info(`Running ${what}-build command: "${cmdline}"`);
            let cmd;
            let args;
            // pre-/post-build commands feature full bash support on UNIX systems.
            // On Windows you have full cmd support.
            if (os.platform() === "win32") {
                args = [];
                cmd = cmdline;
            }
            else {
                args = ["-c", cmdline];
                cmd = "bash";
            }
            try {
                yield util.spawn(cmd, args, {
                    shell: os.platform() === "win32",
                    cwd: workspace_1.ArduinoWorkspace.rootPath,
                    env: Object.assign({}, environment),
                }, { channel: outputChannel_1.arduinoChannel.channel });
            }
            catch (ex) {
                const msg = ex.error
                    ? `${ex.error}`
                    : ex.code
                        ? `Exit code = ${ex.code}`
                        : JSON.stringify(ex);
                outputChannel_1.arduinoChannel.error(`Running ${what}-build command failed: ${os.EOL}${msg}`);
                return false;
            }
            return true;
        });
    }
    /**
     * Checks if the arduino cli is being used
     * @returns {bool} - true if arduino cli is being use
     */
    useArduinoCli() {
        return this._settings.useArduinoCli;
        // return VscodeSettings.getInstance().useArduinoCli;
    }
    /**
     * Checks if the line contains memory usage information
     * @param line output line to check
     * @returns {bool} true if line contains memory usage information
     */
    isMemoryUsageInformation(line) {
        return line.startsWith("Sketch uses ") || line.startsWith("Global variables use ");
    }
    /**
     * Private implementation. Not to be called directly. The wrapper build()
     * manages the build state.
     * @param buildMode See build()
     * @param buildDir See build()
     * @see https://github.com/arduino/Arduino/blob/master/build/shared/manpage.adoc
     */
    _build(buildMode, buildDir) {
        return __awaiter(this, void 0, void 0, function* () {
            const dc = deviceContext_1.DeviceContext.getInstance();
            const args = [];
            let restoreSerialMonitor = false;
            const verbose = vscodeSettings_1.VscodeSettings.getInstance().logLevel === constants.LogLevel.Verbose;
            if (!this.boardManager.currentBoard) {
                if (buildMode !== BuildMode.Analyze) {
                    logger.notifyUserError("boardManager.currentBoard", new Error(constants.messages.NO_BOARD_SELECTED));
                }
                return false;
            }
            const boardDescriptor = this.boardManager.currentBoard.getBuildConfig();
            if (this.useArduinoCli()) {
                args.push("-b", boardDescriptor);
            }
            else {
                args.push("--board", boardDescriptor);
            }
            if (!workspace_1.ArduinoWorkspace.rootPath) {
                vscode.window.showWarningMessage("Workspace doesn't seem to have a folder added to it yet.");
                return false;
            }
            if (!dc.sketch || !util.fileExistsSync(path.join(workspace_1.ArduinoWorkspace.rootPath, dc.sketch))) {
                if (buildMode === BuildMode.Analyze) {
                    // Analyze runs non interactively
                    return false;
                }
                if (!(yield dc.resolveMainSketch())) {
                    vscode.window.showErrorMessage("No sketch file was found. Please specify the sketch in the arduino.json file");
                    return false;
                }
            }
            const selectSerial = () => __awaiter(this, void 0, void 0, function* () {
                const choice = yield vscode.window.showInformationMessage("Serial port is not specified. Do you want to select a serial port for uploading?", "Yes", "No");
                if (choice === "Yes") {
                    vscode.commands.executeCommand("arduino.selectSerialPort");
                }
            });
            if (buildMode === BuildMode.Upload) {
                if ((!dc.configuration || !/upload_method=[^=,]*st[^,]*link/i.test(dc.configuration)) && !dc.port) {
                    yield selectSerial();
                    return false;
                }
                if (this.useArduinoCli()) {
                    args.push("compile", "--upload");
                }
                else {
                    args.push("--upload");
                }
                if (dc.port) {
                    args.push("--port", dc.port);
                }
            }
            else if (buildMode === BuildMode.CliUpload) {
                if ((!dc.configuration || !/upload_method=[^=,]*st[^,]*link/i.test(dc.configuration)) && !dc.port) {
                    yield selectSerial();
                    return false;
                }
                if (!this.useArduinoCli()) {
                    outputChannel_1.arduinoChannel.error("This command is only available when using the Arduino CLI");
                    return false;
                }
                args.push("upload");
                if (dc.port) {
                    args.push("--port", dc.port);
                }
            }
            else if (buildMode === BuildMode.UploadProgrammer) {
                const programmer = this.programmerManager.currentProgrammer;
                if (!programmer) {
                    logger.notifyUserError("programmerManager.currentProgrammer", new Error(constants.messages.NO_PROGRAMMMER_SELECTED));
                    return false;
                }
                if (!dc.port) {
                    yield selectSerial();
                    return false;
                }
                if (this.useArduinoCli()) {
                    args.push("compile", "--upload", "--programmer", programmer);
                }
                else {
                    args.push("--upload", "--useprogrammer", "--pref", `programmer=${programmer}`);
                }
                args.push("--port", dc.port);
            }
            else if (buildMode === BuildMode.CliUploadProgrammer) {
                const programmer = this.programmerManager.currentProgrammer;
                if (!programmer) {
                    logger.notifyUserError("programmerManager.currentProgrammer", new Error(constants.messages.NO_PROGRAMMMER_SELECTED));
                    return false;
                }
                if (!dc.port) {
                    yield selectSerial();
                    return false;
                }
                if (!this.useArduinoCli()) {
                    outputChannel_1.arduinoChannel.error("This command is only available when using the Arduino CLI");
                    return false;
                }
                args.push("upload", "--programmer", programmer, "--port", dc.port);
            }
            else {
                if (this.useArduinoCli()) {
                    args.unshift("compile");
                }
                else {
                    args.push("--verify");
                }
            }
            if (dc.buildPreferences) {
                for (const pref of dc.buildPreferences) {
                    // Note: BuildPrefSetting makes sure that each preference
                    // value consists of exactly two items (key and value).
                    if (this.useArduinoCli()) {
                        args.push("--build-property", `${pref[0]}=${pref[1]}`);
                    }
                    else {
                        args.push("--pref", `${pref[0]}=${pref[1]}`);
                    }
                }
            }
            // We always build verbosely but filter the output based on the settings
            this._settings.useArduinoCli ? args.push("--verbose") : args.push("--verbose-build");
            if (verbose && !this._settings.useArduinoCli) {
                args.push("--verbose-upload");
            }
            yield vscode.workspace.saveAll(false);
            // we prepare the channel here since all following code will
            // or at leas can possibly output to it
            outputChannel_1.arduinoChannel.show();
            if (vscodeSettings_1.VscodeSettings.getInstance().clearOutputOnBuild) {
                outputChannel_1.arduinoChannel.clear();
            }
            outputChannel_1.arduinoChannel.start(`${buildMode} sketch '${dc.sketch}'`);
            if (buildDir || dc.output) {
                // 2020-02-29, EW: This whole code appears a bit wonky to me.
                //   What if the user specifies an output directory "../builds/my project"
                // the first choice of the path should be from the users explicit settings.
                if (dc.output) {
                    buildDir = path.resolve(workspace_1.ArduinoWorkspace.rootPath, dc.output);
                }
                else {
                    buildDir = path.resolve(workspace_1.ArduinoWorkspace.rootPath, buildDir);
                }
                const dirPath = path.dirname(buildDir);
                if (!util.directoryExistsSync(dirPath)) {
                    util.mkdirRecursivelySync(dirPath);
                }
                if (this.useArduinoCli()) {
                    args.push("--build-path", buildDir);
                }
                else {
                    args.push("--pref", `build.path=${buildDir}`);
                }
                outputChannel_1.arduinoChannel.info(`Please see the build logs in output path: ${buildDir}`);
            }
            else {
                const msg = "Output path is not specified. Unable to reuse previously compiled files. Build will be slower. See README.";
                outputChannel_1.arduinoChannel.warning(msg);
            }
            // Environment variables passed to pre- and post-build commands
            const env = {
                VSCA_BUILD_MODE: buildMode,
                VSCA_SKETCH: dc.sketch,
                VSCA_BOARD: boardDescriptor,
                VSCA_WORKSPACE_DIR: workspace_1.ArduinoWorkspace.rootPath,
                VSCA_LOG_LEVEL: verbose ? constants.LogLevel.Verbose : constants.LogLevel.Info,
            };
            if (dc.port) {
                env["VSCA_SERIAL"] = dc.port;
            }
            if (buildDir) {
                env["VSCA_BUILD_DIR"] = buildDir;
            }
            // TODO EW: What should we do with pre-/post build commands when running
            //   analysis? Some could use it to generate/manipulate code which could
            //   be a prerequisite for a successful build
            if (!(yield this.runPrePostBuildCommand(dc, env, "pre"))) {
                return false;
            }
            // stop serial monitor when everything is prepared and good
            // what makes restoring of its previous state easier
            if (buildMode === BuildMode.Upload ||
                buildMode === BuildMode.UploadProgrammer ||
                buildMode === BuildMode.CliUpload ||
                buildMode === BuildMode.CliUploadProgrammer) {
                restoreSerialMonitor = yield serialMonitor_1.SerialMonitor.getInstance().closeSerialMonitor(dc.port);
                usbDetector_1.UsbDetector.getInstance().pauseListening();
            }
            // Push sketch as last argument
            args.push(path.join(workspace_1.ArduinoWorkspace.rootPath, dc.sketch));
            const cocopa = intellisense_1.makeCompilerParserContext(dc);
            const cleanup = (result) => __awaiter(this, void 0, void 0, function* () {
                let ret = true;
                if (result === "ok") {
                    ret = yield this.runPrePostBuildCommand(dc, env, "post");
                }
                yield cocopa.conclude();
                if (buildMode === BuildMode.Upload || buildMode === BuildMode.UploadProgrammer) {
                    usbDetector_1.UsbDetector.getInstance().resumeListening();
                    if (restoreSerialMonitor) {
                        yield serialMonitor_1.SerialMonitor.getInstance().openSerialMonitor();
                    }
                }
                return ret;
            });
            // Wrap line-oriented callbacks to accept arbitrary chunks of data.
            const wrapLineCallback = (callback) => {
                let buffer = "";
                let startIndex = 0;
                return (data) => {
                    buffer += data;
                    while (true) {
                        const pos = buffer.indexOf(os.EOL, startIndex);
                        if (pos < 0) {
                            startIndex = buffer.length;
                            break;
                        }
                        const line = buffer.substring(0, pos + os.EOL.length);
                        buffer = buffer.substring(pos + os.EOL.length);
                        startIndex = 0;
                        callback(line);
                    }
                };
            };
            const stdoutcb = wrapLineCallback((line) => {
                if (cocopa.callback) {
                    cocopa.callback(line);
                }
                if (verbose) {
                    outputChannel_1.arduinoChannel.channel.append(line);
                }
                else {
                    // Output sketch memory usage in non-verbose mode
                    if (this.isMemoryUsageInformation(line)) {
                        outputChannel_1.arduinoChannel.channel.append(line);
                    }
                }
            });
            const stderrcb = wrapLineCallback((line) => {
                if (os.platform() === "win32") {
                    line = line.trim();
                    if (line.length <= 0) {
                        return;
                    }
                    line = line.replace(/(?:\r|\r\n|\n)+/g, os.EOL);
                    line = `${line}${os.EOL}`;
                }
                if (!verbose) {
                    // Don't spill log with spurious info from the backend. This
                    // list could be fetched from a config file to accommodate
                    // messages of unknown board packages, newer backend revisions
                    const filters = [
                        /^Picked\sup\sJAVA_TOOL_OPTIONS:\s+/,
                        /^\d+\d+-\d+-\d+T\d+:\d+:\d+.\d+Z\s(?:INFO|WARN)\s/,
                        /^(?:DEBUG|TRACE|INFO)\s+/,
                        // 2022-04-09 22:48:46.204 Arduino[55373:2073803] Arg 25: '--pref'
                        /^[\d\-.:\s]*Arduino\[[\d:]*\]/,
                    ];
                    for (const f of filters) {
                        if (line.match(f)) {
                            return;
                        }
                    }
                }
                outputChannel_1.arduinoChannel.channel.append(line);
            });
            return yield util.spawn(this._settings.commandPath, args, { cwd: workspace_1.ArduinoWorkspace.rootPath }, { /*channel: arduinoChannel.channel,*/ stdout: stdoutcb, stderr: stderrcb }).then(() => __awaiter(this, void 0, void 0, function* () {
                const ret = yield cleanup("ok");
                if (ret) {
                    outputChannel_1.arduinoChannel.end(`${buildMode} sketch '${dc.sketch}'${os.EOL}`);
                }
                return ret;
            }), (reason) => __awaiter(this, void 0, void 0, function* () {
                yield cleanup("error");
                const msg = reason.code
                    ? `Exit with code=${reason.code}`
                    : JSON.stringify(reason);
                outputChannel_1.arduinoChannel.error(`${buildMode} sketch '${dc.sketch}': ${msg}${os.EOL}`);
                return false;
            }));
        });
    }
}
exports.ArduinoApp = ArduinoApp;

//# sourceMappingURL=arduino.js.map

// SIG // Begin signature block
// SIG // MIInyAYJKoZIhvcNAQcCoIInuTCCJ7UCAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // BXn8zb6WLbDGwUxwQco/8K4iKpa0R88nXOIvE5DTGb2g
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
// SIG // ARUwLwYJKoZIhvcNAQkEMSIEIAHywTU7Qqn3FsGneAZV
// SIG // f7dCEwzNwZr4EPlrHeBF5FcLMEIGCisGAQQBgjcCAQwx
// SIG // NDAyoBSAEgBNAGkAYwByAG8AcwBvAGYAdKEagBhodHRw
// SIG // Oi8vd3d3Lm1pY3Jvc29mdC5jb20wDQYJKoZIhvcNAQEB
// SIG // BQAEggEAYVCDdUtOPrjJ8jK8GV9dHWn42DqJ6JPNNV5B
// SIG // YUSz+6a+puiwQrL5IBU8F7CiiwwKJYdVtvHZYvJVRes7
// SIG // tfiIa+kq8EfIRZ0Hdj/zDBW4ZwBVkEBvhgS4r5r17EC6
// SIG // xXCCU6oDTr1TqCo1Dq0f4S906LQVoknev+Slkw2FwDoR
// SIG // txVjOxekcFwNm8nopOTsSkWh4XF3YKu6A9NIJvhaceKw
// SIG // D0iEBo/61qieaKsSlZ1d4uT4a7wY0zPEYeh/cZTLU8mu
// SIG // DtKL0CyL3WYuWvP24nCZnioaxKqZxpGFu8Q/VzaIOkz8
// SIG // hgUutQ42sPWbZ9SN+Zf2hc/XdF8jJ3RRF7RA48JI9KGC
// SIG // FykwghclBgorBgEEAYI3AwMBMYIXFTCCFxEGCSqGSIb3
// SIG // DQEHAqCCFwIwghb+AgEDMQ8wDQYJYIZIAWUDBAIBBQAw
// SIG // ggFZBgsqhkiG9w0BCRABBKCCAUgEggFEMIIBQAIBAQYK
// SIG // KwYBBAGEWQoDATAxMA0GCWCGSAFlAwQCAQUABCAMavYP
// SIG // Tsu1tQRLM2InQT5aIl2PxkhydZQk6XPrVqgVhQIGY8fd
// SIG // APYPGBMyMDIzMDEyNTAxMzAyOC41OTRaMASAAgH0oIHY
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
// SIG // dYPk46GhJ7E2OrqgC0f6tY0uYE+HsTQ+8FWqsFQth88w
// SIG // gfoGCyqGSIb3DQEJEAIvMYHqMIHnMIHkMIG9BCCGoTPV
// SIG // KhDSB7ZG0zJQZUM2jk/ll1zJGh6KOhn76k+/QjCBmDCB
// SIG // gKR+MHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNo
// SIG // aW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQK
// SIG // ExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMT
// SIG // HU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAyMDEwAhMz
// SIG // AAABs/4lzikbG4ocAAEAAAGzMCIEIMG4ycxxfCE3OrJq
// SIG // SFqpFNCBTvaAXUiS9kEd8Y80Y2/JMA0GCSqGSIb3DQEB
// SIG // CwUABIICAGnfkxI9apd6LWmx8OgZcVaVZjSsvApDRtHE
// SIG // Wj1W0JLSojDe5Bam9B9Kq/TT3j8a2W7UZNMqlmxL6cMr
// SIG // rrZ0GZdl3jb0zqaMh2efCxZ0GwnwBkRiFR7ioT8pmWNo
// SIG // wlVtQS0IQgo2H2Subwqt35NWi1MDg9XMxXf9jWGFqhrh
// SIG // trV0WR7shXD954MNn6pyHSAQa63ReRo4iQYlZLBKvx90
// SIG // nD7WaAvqg36azS72AVWrMD2dGvyBu0pJxbTuOK2Z8mkY
// SIG // iy5zKWjmZE8j/t2QPl9M8cgjJWvZ++0kmYlzSrGicYzi
// SIG // EwXIwXZGX218om/mg5iIC4Xg7OQsghsA1aCAsDdTl2SJ
// SIG // N+iCdChwgXD6Z/zLSSBp9xg9CBtkP0P2V4yp9xK+5yK0
// SIG // EljPvFcqDGDzB6Fzj5V9y5svJzepXhF/e1D9CRoXDGZB
// SIG // Dq81jb5pXlYtADc3JDpAfBMYuxzaqqLJvtPLW+X6DiLs
// SIG // f3fF5tTmlF7CoxZUCRgmUaDzGuzSTNojCiNKjQZfnm4F
// SIG // iBQDoZLFDUYpO+fHobfGOg5E97u5/uhjQ3d3tffAAx27
// SIG // 1LLsO8/1ttF3EkgYW1I8Wzh5ijUlqTuls1FoF3VZ741W
// SIG // P44m7Xz382qtY6SeY0ZEo6CrTJZS1KtR0N6dOCCdTK0y
// SIG // oYGmF92+0XsUCoqr6YPM424Wrqi1JXGX
// SIG // End signature block
