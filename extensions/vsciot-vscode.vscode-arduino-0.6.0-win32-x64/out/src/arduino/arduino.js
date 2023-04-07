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
    getAdditionalUrls() {
        // For better compatibility, merge urls both in user settings and arduino IDE preferences.
        const settingsUrls = vscodeSettings_1.VscodeSettings.getInstance().additionalUrls;
        let preferencesUrls = [];
        const preferences = this._settings.preferences;
        if (preferences && preferences.has("boardsmanager.additional.urls")) {
            preferencesUrls = util.toStringArray(preferences.get("boardsmanager.additional.urls"));
        }
        return util.union(settingsUrls, preferencesUrls);
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
                    if (updatingIndex) {
                        yield this.spawnCli(["core", "update-index"], undefined, { channel: showOutput ? outputChannel_1.arduinoChannel.channel : null });
                    }
                    else {
                        yield this.spawnCli(["core", "install", `${packageName}${arch && ":" + arch}${version && "@" + version}`], undefined, { channel: showOutput ? outputChannel_1.arduinoChannel.channel : null });
                    }
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
                    if (updatingIndex) {
                        this.spawnCli(["lib", "update-index"], undefined, { channel: showOutput ? outputChannel_1.arduinoChannel.channel : undefined });
                    }
                    else {
                        yield this.spawnCli(["lib", "install", `${libName}${version && "@" + version}`], undefined, { channel: showOutput ? outputChannel_1.arduinoChannel.channel : undefined });
                    }
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
            this._settings.useArduinoCli ? args.push("--verbose", "--no-color") : args.push("--verbose-build");
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
                        yield serialMonitor_1.SerialMonitor.getInstance().openSerialMonitor(true);
                    }
                }
                return ret;
            });
            // Wrap line-oriented callbacks to accept arbitrary chunks of data.
            const wrapLineCallback = (callback) => {
                let buffer = "";
                let startIndex = 0;
                const eol = this.useArduinoCli() ? "\n" : os.EOL;
                return (data) => {
                    buffer += data;
                    while (true) {
                        const pos = buffer.indexOf(eol, startIndex);
                        if (pos < 0) {
                            startIndex = buffer.length;
                            break;
                        }
                        const line = buffer.substring(0, pos + eol.length);
                        buffer = buffer.substring(pos + eol.length);
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
            const run = (...args) => this.useArduinoCli() ?
                this.spawnCli(...(args.slice(1))) :
                util.spawn.apply(undefined, args);
            return yield run(this._settings.commandPath, args, { cwd: workspace_1.ArduinoWorkspace.rootPath }, { /*channel: arduinoChannel.channel,*/ stdout: stdoutcb, stderr: stderrcb }).then(() => __awaiter(this, void 0, void 0, function* () {
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
    spawnCli(args = [], options = {}, output) {
        const additionalUrls = this.getAdditionalUrls();
        return util.spawn(this._settings.commandPath, args.concat(["--additional-urls", additionalUrls.join(",")]), options, output);
    }
}
exports.ArduinoApp = ArduinoApp;

//# sourceMappingURL=arduino.js.map

// SIG // Begin signature block
// SIG // MIInowYJKoZIhvcNAQcCoIInlDCCJ5ACAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // M0IDUi6FBz6Y1pMjTlxNphjmhn7W3qwrlB7fas3yhWmg
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
// SIG // ghl2MIIZcgIBATCBlTB+MQswCQYDVQQGEwJVUzETMBEG
// SIG // A1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9u
// SIG // ZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9u
// SIG // MSgwJgYDVQQDEx9NaWNyb3NvZnQgQ29kZSBTaWduaW5n
// SIG // IFBDQSAyMDExAhMzAAACzfNkv/jUTF1RAAAAAALNMA0G
// SIG // CWCGSAFlAwQCAQUAoIGuMBkGCSqGSIb3DQEJAzEMBgor
// SIG // BgEEAYI3AgEEMBwGCisGAQQBgjcCAQsxDjAMBgorBgEE
// SIG // AYI3AgEVMC8GCSqGSIb3DQEJBDEiBCCNYgu9ROlpy0Cw
// SIG // +ue2sic4nHawc1Nx7GACJzXcELC8RDBCBgorBgEEAYI3
// SIG // AgEMMTQwMqAUgBIATQBpAGMAcgBvAHMAbwBmAHShGoAY
// SIG // aHR0cDovL3d3dy5taWNyb3NvZnQuY29tMA0GCSqGSIb3
// SIG // DQEBAQUABIIBAEOX50ej6FN+rqjbrOgNn5TDu4F+2pVY
// SIG // zV2deriIHFAbPSE8xQgnFmcW1+AgjGtPT9COqlv1HWq/
// SIG // Te/uVKxsz1r7sw/01TcAKPSGToaTboQJJ74wohxYbzHF
// SIG // gWFM7bdOUsVY0n/X3MRU5/Ki2rZQLlVTy5tWVR5CnmdR
// SIG // 3G/53KaBO5/v4iECpAycp2hkIGN4a8cbVZWVff1CI12b
// SIG // QRG9sbqZEpWzX+nLJbyoOXiu8cahuFYY2VSG+TZn1J3h
// SIG // KmB3moRBopo3HYHSio5cgNdDTQ6SJ2g/DQu4Bsv2hFJ9
// SIG // a//0chrbg/eruylqZzPKoJHd96EhvdnhJRi8EapWV7TH
// SIG // zBOhghcAMIIW/AYKKwYBBAGCNwMDATGCFuwwghboBgkq
// SIG // hkiG9w0BBwKgghbZMIIW1QIBAzEPMA0GCWCGSAFlAwQC
// SIG // AQUAMIIBUQYLKoZIhvcNAQkQAQSgggFABIIBPDCCATgC
// SIG // AQEGCisGAQQBhFkKAwEwMTANBglghkgBZQMEAgEFAAQg
// SIG // c0CfOXZndgV7RQJVZ6MWuSNpNjpWQNB+GbYnmcD0FdAC
// SIG // BmPueaDJGRgTMjAyMzAzMTUyMTA2MzkuNDk3WjAEgAIB
// SIG // 9KCB0KSBzTCByjELMAkGA1UEBhMCVVMxEzARBgNVBAgT
// SIG // Cldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAc
// SIG // BgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjElMCMG
// SIG // A1UECxMcTWljcm9zb2Z0IEFtZXJpY2EgT3BlcmF0aW9u
// SIG // czEmMCQGA1UECxMdVGhhbGVzIFRTUyBFU046NDlCQy1F
// SIG // MzdBLTIzM0MxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1l
// SIG // LVN0YW1wIFNlcnZpY2WgghFXMIIHDDCCBPSgAwIBAgIT
// SIG // MwAAAcBVpI3DZBXFSwABAAABwDANBgkqhkiG9w0BAQsF
// SIG // ADB8MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGlu
// SIG // Z3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMV
// SIG // TWljcm9zb2Z0IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1N
// SIG // aWNyb3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAxMDAeFw0y
// SIG // MjExMDQxOTAxMjVaFw0yNDAyMDIxOTAxMjVaMIHKMQsw
// SIG // CQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQ
// SIG // MA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9z
// SIG // b2Z0IENvcnBvcmF0aW9uMSUwIwYDVQQLExxNaWNyb3Nv
// SIG // ZnQgQW1lcmljYSBPcGVyYXRpb25zMSYwJAYDVQQLEx1U
// SIG // aGFsZXMgVFNTIEVTTjo0OUJDLUUzN0EtMjMzQzElMCMG
// SIG // A1UEAxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAgU2Vydmlj
// SIG // ZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIB
// SIG // ALztYPtjYYZgUL5RpQkzjGhcN42yIVHQ06pGkIUaXR1W
// SIG // /oblP9BzYS5qEWL66e8+byKC9TDwJFQRViSJK3Bu7Eq3
// SIG // nZ8mcK3mNtOwvZ/F4ry/WQTkHolHi/0zJSelYp63Gn24
// SIG // XZ5DTuSQ5T6MwvXRskorm68nbORirbuvQ9cDWrfQyEJe
// SIG // mpRTuqZ3GSuESM37/is5DO0ZGN7x6YVdAvBBVKRfpcrG
// SIG // hiVxX/ULFFB8I/Vylh33PQX4S6AkXl1M74K7KXRZlZwP
// SIG // QE2F5onUo67IX/APhNPxaU3YVzyPV16rGQxwaq+w5WKE
// SIG // glN5b61Q0btaeaRx3+7N5DNeh6Sumqw7WN2otbKAEphK
// SIG // b9wtjf8uTAwQKQ3eEqUpCzGu/unrP3Wnku83R9anQmtk
// SIG // aCTzOhIf+mJgX6H4Xy0KHyjyZd+AC5WViuQM1bRUTTl2
// SIG // nKI+jABtnU/EXOX6Sgh9RN5+2Y3tHStuEFX0r/2DscOd
// SIG // hAmjC5VuT4R092SDTWgpkYHBwkwpTiswthTq9N2AXNsz
// SIG // zlumyFXV5aD5gTFWhPrYV6j5gDQcNGLJ3GjpFYIIw2+T
// SIG // uVajqffDJJR6SaCSOqZOcwJcfPzrQuxbra3bWDVAuspF
// SIG // 8zADxbmJFhoMf1uwNIrSlvFs2M8Dt2wIaa8M56LhmZkY
// SIG // sNpPKXp/NAc6s3cj72808ULDAgMBAAGjggE2MIIBMjAd
// SIG // BgNVHQ4EFgQUAETGePNI8KStz+qrlVlBCdHN9IUwHwYD
// SIG // VR0jBBgwFoAUn6cVXQBeYl2D9OXSZacbUzUZ6XIwXwYD
// SIG // VR0fBFgwVjBUoFKgUIZOaHR0cDovL3d3dy5taWNyb3Nv
// SIG // ZnQuY29tL3BraW9wcy9jcmwvTWljcm9zb2Z0JTIwVGlt
// SIG // ZS1TdGFtcCUyMFBDQSUyMDIwMTAoMSkuY3JsMGwGCCsG
// SIG // AQUFBwEBBGAwXjBcBggrBgEFBQcwAoZQaHR0cDovL3d3
// SIG // dy5taWNyb3NvZnQuY29tL3BraW9wcy9jZXJ0cy9NaWNy
// SIG // b3NvZnQlMjBUaW1lLVN0YW1wJTIwUENBJTIwMjAxMCgx
// SIG // KS5jcnQwDAYDVR0TAQH/BAIwADATBgNVHSUEDDAKBggr
// SIG // BgEFBQcDCDANBgkqhkiG9w0BAQsFAAOCAgEArU4dBEJ9
// SIG // epCkMgnlZPVXNdJui9BMC0aNwE0aLj+2HdoVnhAdmOGR
// SIG // eAiSnvan11hiSs1e7TFJugwLASmB/50/vMmyPLiYhxp3
// SIG // 51Yukoe4BY506X4dY9U/dB/7i3qBY6Tp//nqAqCZqK1u
// SIG // Rm9ns5U5aOSNJDQLm8bQsamy4s7jzT6G/JEQCkIL/uPw
// SIG // gtSZolBRtLiiDZSo/UrB3K1ngQUB1+tpzYM4iME+OCah
// SIG // 6wNNiOnJkAIvQWXLH+ezji6UWJc6Dx98f/pXUsklwJsi
// SIG // 6trkm1rULg/OCP9GYEvweS93sKk3YhNSmyl/PTFuSagi
// SIG // v8iP5gCEGppgJRz6lPXmWUzDzh0LNF66Qoo5ZPqsqNiW
// SIG // h4sksMOp7j6l81N7BI91VtNGIlUmsihLtSK0c819y2vK
// SIG // nujqi07yv+oLuV3Squ00/OdpweiD9EDPgbnba+BW8eP7
// SIG // L6ShxqSvf8wbmhxw11+QKEpLIf5Eg2Cn3n0CISH0CSc6
// SIG // BN1/jIpjCa4K8GV5bW+o9SC9B2N6gqWtNxoYItCE86n5
// SIG // MNzGp9xvJAdUJfknjXIj1I+9yp9r3iXpxi7U/CZFDPUV
// SIG // ItMKDtIrmOLSZ2Lkvknqmr11DlqlGFWNfRSK9Ty6qZlp
// SIG // G6zucSo5Mjh6AJi8YzWyozp5AMH7ftRtNJLpSqs6j25v
// SIG // kp/uOybBkBYTRm0wggdxMIIFWaADAgECAhMzAAAAFcXn
// SIG // a54Cm0mZAAAAAAAVMA0GCSqGSIb3DQEBCwUAMIGIMQsw
// SIG // CQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQ
// SIG // MA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9z
// SIG // b2Z0IENvcnBvcmF0aW9uMTIwMAYDVQQDEylNaWNyb3Nv
// SIG // ZnQgUm9vdCBDZXJ0aWZpY2F0ZSBBdXRob3JpdHkgMjAx
// SIG // MDAeFw0yMTA5MzAxODIyMjVaFw0zMDA5MzAxODMyMjVa
// SIG // MHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5n
// SIG // dG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVN
// SIG // aWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMTHU1p
// SIG // Y3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAyMDEwMIICIjAN
// SIG // BgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA5OGmTOe0
// SIG // ciELeaLL1yR5vQ7VgtP97pwHB9KpbE51yMo1V/YBf2xK
// SIG // 4OK9uT4XYDP/XE/HZveVU3Fa4n5KWv64NmeFRiMMtY0T
// SIG // z3cywBAY6GB9alKDRLemjkZrBxTzxXb1hlDcwUTIcVxR
// SIG // MTegCjhuje3XD9gmU3w5YQJ6xKr9cmmvHaus9ja+NSZk
// SIG // 2pg7uhp7M62AW36MEBydUv626GIl3GoPz130/o5Tz9bs
// SIG // hVZN7928jaTjkY+yOSxRnOlwaQ3KNi1wjjHINSi947SH
// SIG // JMPgyY9+tVSP3PoFVZhtaDuaRr3tpK56KTesy+uDRedG
// SIG // bsoy1cCGMFxPLOJiss254o2I5JasAUq7vnGpF1tnYN74
// SIG // kpEeHT39IM9zfUGaRnXNxF803RKJ1v2lIH1+/NmeRd+2
// SIG // ci/bfV+AutuqfjbsNkz2K26oElHovwUDo9Fzpk03dJQc
// SIG // NIIP8BDyt0cY7afomXw/TNuvXsLz1dhzPUNOwTM5TI4C
// SIG // vEJoLhDqhFFG4tG9ahhaYQFzymeiXtcodgLiMxhy16cg
// SIG // 8ML6EgrXY28MyTZki1ugpoMhXV8wdJGUlNi5UPkLiWHz
// SIG // NgY1GIRH29wb0f2y1BzFa/ZcUlFdEtsluq9QBXpsxREd
// SIG // cu+N+VLEhReTwDwV2xo3xwgVGD94q0W29R6HXtqPnhZy
// SIG // acaue7e3PmriLq0CAwEAAaOCAd0wggHZMBIGCSsGAQQB
// SIG // gjcVAQQFAgMBAAEwIwYJKwYBBAGCNxUCBBYEFCqnUv5k
// SIG // xJq+gpE8RjUpzxD/LwTuMB0GA1UdDgQWBBSfpxVdAF5i
// SIG // XYP05dJlpxtTNRnpcjBcBgNVHSAEVTBTMFEGDCsGAQQB
// SIG // gjdMg30BATBBMD8GCCsGAQUFBwIBFjNodHRwOi8vd3d3
// SIG // Lm1pY3Jvc29mdC5jb20vcGtpb3BzL0RvY3MvUmVwb3Np
// SIG // dG9yeS5odG0wEwYDVR0lBAwwCgYIKwYBBQUHAwgwGQYJ
// SIG // KwYBBAGCNxQCBAweCgBTAHUAYgBDAEEwCwYDVR0PBAQD
// SIG // AgGGMA8GA1UdEwEB/wQFMAMBAf8wHwYDVR0jBBgwFoAU
// SIG // 1fZWy4/oolxiaNE9lJBb186aGMQwVgYDVR0fBE8wTTBL
// SIG // oEmgR4ZFaHR0cDovL2NybC5taWNyb3NvZnQuY29tL3Br
// SIG // aS9jcmwvcHJvZHVjdHMvTWljUm9vQ2VyQXV0XzIwMTAt
// SIG // MDYtMjMuY3JsMFoGCCsGAQUFBwEBBE4wTDBKBggrBgEF
// SIG // BQcwAoY+aHR0cDovL3d3dy5taWNyb3NvZnQuY29tL3Br
// SIG // aS9jZXJ0cy9NaWNSb29DZXJBdXRfMjAxMC0wNi0yMy5j
// SIG // cnQwDQYJKoZIhvcNAQELBQADggIBAJ1VffwqreEsH2cB
// SIG // MSRb4Z5yS/ypb+pcFLY+TkdkeLEGk5c9MTO1OdfCcTY/
// SIG // 2mRsfNB1OW27DzHkwo/7bNGhlBgi7ulmZzpTTd2YurYe
// SIG // eNg2LpypglYAA7AFvonoaeC6Ce5732pvvinLbtg/SHUB
// SIG // 2RjebYIM9W0jVOR4U3UkV7ndn/OOPcbzaN9l9qRWqveV
// SIG // tihVJ9AkvUCgvxm2EhIRXT0n4ECWOKz3+SmJw7wXsFSF
// SIG // QrP8DJ6LGYnn8AtqgcKBGUIZUnWKNsIdw2FzLixre24/
// SIG // LAl4FOmRsqlb30mjdAy87JGA0j3mSj5mO0+7hvoyGtmW
// SIG // 9I/2kQH2zsZ0/fZMcm8Qq3UwxTSwethQ/gpY3UA8x1Rt
// SIG // nWN0SCyxTkctwRQEcb9k+SS+c23Kjgm9swFXSVRk2XPX
// SIG // fx5bRAGOWhmRaw2fpCjcZxkoJLo4S5pu+yFUa2pFEUep
// SIG // 8beuyOiJXk+d0tBMdrVXVAmxaQFEfnyhYWxz/gq77EFm
// SIG // PWn9y8FBSX5+k77L+DvktxW/tM4+pTFRhLy/AsGConsX
// SIG // HRWJjXD+57XQKBqJC4822rpM+Zv/Cuk0+CQ1ZyvgDbjm
// SIG // jJnW4SLq8CdCPSWU5nR0W2rRnj7tfqAxM328y+l7vzhw
// SIG // RNGQ8cirOoo6CGJ/2XBjU02N7oJtpQUQwXEGahC0HVUz
// SIG // WLOhcGbyoYICzjCCAjcCAQEwgfihgdCkgc0wgcoxCzAJ
// SIG // BgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAw
// SIG // DgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3Nv
// SIG // ZnQgQ29ycG9yYXRpb24xJTAjBgNVBAsTHE1pY3Jvc29m
// SIG // dCBBbWVyaWNhIE9wZXJhdGlvbnMxJjAkBgNVBAsTHVRo
// SIG // YWxlcyBUU1MgRVNOOjQ5QkMtRTM3QS0yMzNDMSUwIwYD
// SIG // VQQDExxNaWNyb3NvZnQgVGltZS1TdGFtcCBTZXJ2aWNl
// SIG // oiMKAQEwBwYFKw4DAhoDFQAQEOxMRdfSpMFS9RNwHfJN
// SIG // D3m+naCBgzCBgKR+MHwxCzAJBgNVBAYTAlVTMRMwEQYD
// SIG // VQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25k
// SIG // MR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24x
// SIG // JjAkBgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBD
// SIG // QSAyMDEwMA0GCSqGSIb3DQEBBQUAAgUA57yOIDAiGA8y
// SIG // MDIzMDMxNjAyMzQwOFoYDzIwMjMwMzE3MDIzNDA4WjB3
// SIG // MD0GCisGAQQBhFkKBAExLzAtMAoCBQDnvI4gAgEAMAoC
// SIG // AQACAgZBAgH/MAcCAQACAkq3MAoCBQDnvd+gAgEAMDYG
// SIG // CisGAQQBhFkKBAIxKDAmMAwGCisGAQQBhFkKAwKgCjAI
// SIG // AgEAAgMHoSChCjAIAgEAAgMBhqAwDQYJKoZIhvcNAQEF
// SIG // BQADgYEAYgYzJFbPC1ERZa4gVEq/vhgT0WJn7GZU2SFO
// SIG // BDIXy+lc9nM0vq9+CCuhYJMyslX8nbtcpwMDWxNwj46f
// SIG // pdWZEsDgc9TgkuElfntBOMvDpuf+1B+9Uy7lJo25sX4H
// SIG // pd2tiAQQuAx478IohQ8jkVGGVeL+Q1ku9s/Clsz2bT7J
// SIG // QLUxggQNMIIECQIBATCBkzB8MQswCQYDVQQGEwJVUzET
// SIG // MBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVk
// SIG // bW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0
// SIG // aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQgVGltZS1TdGFt
// SIG // cCBQQ0EgMjAxMAITMwAAAcBVpI3DZBXFSwABAAABwDAN
// SIG // BglghkgBZQMEAgEFAKCCAUowGgYJKoZIhvcNAQkDMQ0G
// SIG // CyqGSIb3DQEJEAEEMC8GCSqGSIb3DQEJBDEiBCAwqTeh
// SIG // x0QUxSlvM7SFSSvmmUKebe/o6EPMQWCYaH/WzzCB+gYL
// SIG // KoZIhvcNAQkQAi8xgeowgecwgeQwgb0EIFrxWKJSCFzB
// SIG // NMyv1ul7ApJGF+5WDW/cgPCccGNOD5NPMIGYMIGApH4w
// SIG // fDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0
// SIG // b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1p
// SIG // Y3Jvc29mdCBDb3Jwb3JhdGlvbjEmMCQGA1UEAxMdTWlj
// SIG // cm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTACEzMAAAHA
// SIG // VaSNw2QVxUsAAQAAAcAwIgQgl+nAbN6PyCLUy+wcFygw
// SIG // n40ZUtbHYbd33KUwnDX50pEwDQYJKoZIhvcNAQELBQAE
// SIG // ggIAMwokxnZYrMtvc+pt8n5fYKZErGCPxIom8GGuxpw5
// SIG // kxPWY4hX/QRcqq0WRXeOnGVmVLORqQ2HMvFqEXiFZ0m7
// SIG // lA0CZ7pw1DDHXO28C/Q2zndr+fY1EDOhMRs/tgE7AS/k
// SIG // JrcTl8T5Nymrh4m5Cr+PUDCr7IQU0TAMkXaA0iy7Lakt
// SIG // JErKJ32F8UpAs7kELp6p2jLln1vDYkY0YobRz6ezc4UP
// SIG // 8zmLBAFszuO+lNOjmdQ7HmnSYqXwb3Ukd3y4lys3P5cq
// SIG // 4zjS35P1t2P3jmxGDjDUokpgMw0fCR/yQgzeluFrfSbc
// SIG // 1zOXd3pHq3m+r4crk4bVePlsgEvJJ85DYusno0hEO5V2
// SIG // woK/p58GiPCwbSW+CCmTZAOHgWvXG6OQAgb1Psgjn+H1
// SIG // TZUcpbxjSasVP0NFwQ/4/ShSRhflkhLbpQERqiNUQgns
// SIG // knNofufn9iPBPpuQcKIk9ezxbfyE45qHRlDgtCubr4ls
// SIG // Yzk7NsDDILEJ2QeGdjM4zUEse5suCzMAIE2IIcUJLJSf
// SIG // Mg2QPYGF3eaeerwAtnK7gPiZZiTrVGwhHI1VG0TSDfpK
// SIG // 6excREoL84YHLgZ6n5V/MlDDg1P+vgNJiXwVOOlWoVl+
// SIG // yKYv1jJGjiK/eIJWdpZEG1XCmxHtLI30cug/uHit/Jr7
// SIG // lMzRTHLmamjQN3fK5nA+RcnRmb4=
// SIG // End signature block
