"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const tl = require("azure-pipelines-task-lib/task");
const tr = require("azure-pipelines-task-lib/toolrunner");
const os = require("os");
const path = require("path");
const fs_1 = require("fs");
class Settings {
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let snyk;
            const snykInstallation = tl.getInput("whichSnyk", true);
            switch (snykInstallation) {
                case "builtin":
                    {
                        tl.debug(`Using built-in version.`);
                        if (tl.getBoolInput("autoUpdate", true)) {
                            yield upgradeSnyk();
                        }
                        let isWindows = os.platform() === "win32";
                        snyk = path.join(__dirname, "/node_modules/.bin/snyk");
                        if (isWindows) {
                            snyk += ".cmd";
                        }
                        else {
                            fs_1.chmodSync(snyk, "777");
                        }
                        break;
                    }
                case "system":
                    snyk = tl.which("snyk", true);
                    tl.debug(`Using system installed snyk from: ${snyk}.`);
                    break;
                case "path":
                    snyk = tl.getPathInput("snykPath", true, true);
                    tl.debug(`Using user configured snyk from: ${snyk}.`);
                    break;
            }
            if (!snyk) {
                tl.setResult(tl.TaskResult.Failed, "Could not locate snyk.");
                return;
            }
            else {
                tl.debug(`Using version:`);
                yield tl.exec(snyk, "--version");
            }
            const test = tl.getBoolInput("test");
            const protect = tl.getBoolInput("protect");
            const monitorBranches = tl.getDelimitedInput("branches", ";\n", false) || [];
            let monitor = false;
            if (tl.getBoolInput("monitor")) {
                const branch = tl.getVariable("Build.SourceBranch") || "";
                if (matchesMonitorBranch(monitorBranches, branch)) {
                    monitor = true;
                }
                else {
                    tl.debug(`Skipping monitor, branch '${branch}' doesn't match.`);
                }
            }
            const settings = new Settings();
            const debugMode = tl.getVariable('System.Debug');
            settings.debug = debugMode ? debugMode.toLowerCase() != 'false' : false;
            settings.severityThreshold = tl.getInput("severityThreshold", false) || "default";
            settings.cwd = tl.getInput("workingDirectory", true) || tl.cwd();
            if (!(tl.getBoolInput("multiFile", false) || false)) {
                settings.files = [tl.getInput("file", false) || "default"];
            }
            else {
                settings.files = tl.findMatch(settings.cwd, [...tl.getDelimitedInput("filesGlob", "\n", false)]);
                if (settings.files.length === 0) {
                    tl.warning("No matching files found.");
                }
            }
            settings.dev = tl.getBoolInput("dev", false);
            settings.failBuild = tl.getBoolInput("failBuild", false);
            settings.trustPolicies = tl.getBoolInput("trustPolicies", false);
            settings.org = tl.getInput("org", false);
            settings.additionalArguments = tl.getInput("args", false);
            if (test || monitor) {
                const authenticationType = tl.getInput("authType", true);
                tl.debug(`Reading snyk token from: ${authenticationType}.`);
                switch (authenticationType) {
                    case "token": {
                        settings.auth = tl.getInput("token", true);
                        break;
                    }
                    case "endpoint": {
                        const connectedServiceName = tl.getInput("endpoint", true);
                        settings.auth = tl.getEndpointAuthorization(connectedServiceName, false).parameters["apitoken"];
                        break;
                    }
                    case "none": {
                        throw new Error("Authentication is required in order to use Snyk Test or Monitor.");
                    }
                }
                yield runSnyk(snyk, "auth", settings);
            }
            if (protect) {
                yield runSnyk(snyk, "protect", settings);
            }
            for (let i = 0; i < settings.files.length; i++) {
                settings.file = settings.files[i];
                if (test) {
                    yield runSnyk(snyk, "test", settings);
                }
                if (monitor) {
                    yield runSnyk(snyk, "monitor", settings);
                }
            }
            tl.setResult(tl.TaskResult.Succeeded, "Done.", true);
        }
        catch (err) {
            tl.setResult(tl.TaskResult.Failed, err.message, true);
        }
    });
}
function matchesMonitorBranch(monitorBranches, branch) {
    return (monitorBranches.length === 0 || tl.match([branch], monitorBranches, null, { matchBase: true, nocase: false }).length > 0);
}
function upgradeSnyk() {
    return __awaiter(this, void 0, void 0, function* () {
        tl.debug(`Updating snyk...`);
        const npmRunner = new tr.ToolRunner(tl.which("npm"));
        npmRunner.arg("install");
        npmRunner.arg("snyk@latest");
        npmRunner.arg("--prefix");
        npmRunner.arg(__dirname);
        const npmResult = yield npmRunner.exec({ failOnStdErr: false });
        tl.debug(`result: ${npmResult}`);
        if (npmResult !== 0) {
            throw `Failed to update snyk.`;
        }
        else {
            tl.debug(`Done.`);
        }
    });
}
function runSnyk(path, command, settings) {
    return __awaiter(this, void 0, void 0, function* () {
        tl.debug(`Calling snyk ${command}...`);
        process.env["CONTINUOUS_INTEGRATION"] = "true";
        const snykRunner = new tr.ToolRunner(path);
        snykRunner.arg(command);
        switch (command) {
            case "auth":
                snykRunner.arg(settings.auth);
                break;
            case "protect":
            case "test":
            case "monitor":
                tl.cd(settings.cwd);
                snykRunner.argIf(settings.severityThreshold !== "default", `--severity-threshold=${settings.severityThreshold}`);
                snykRunner.argIf(settings.dev, "--dev");
                snykRunner.argIf(settings.trustPolicies, "--trust-policies");
                snykRunner.argIf(settings.org, `--org=${settings.org}`);
                snykRunner.argIf(settings.file !== "default", `--file=${settings.file}`);
                snykRunner.argIf(settings.debug, "--debug");
                snykRunner.line(settings.additionalArguments);
                break;
        }
        const snykResult = yield snykRunner.exec({ failOnStdErr: false, ignoreReturnCode: true });
        tl.debug(`result: ${snykResult}`);
        if (snykResult === 1 && !settings.failBuild && command === "test") {
            tl.warning("Snyk reported one or more issues. Ignoring due to 'Fail Build = false'.");
        }
        else if (snykResult !== 0) {
            tl.setResult(tl.TaskResult.Failed, "Vulerabilities found.");
        }
    });
}
void run();
//# sourceMappingURL=snyk.js.map