import * as tl from "azure-pipelines-task-lib/task";
import * as tr from "azure-pipelines-task-lib/toolrunner";
import * as os from "os";
import * as path from "path";
import { chmodSync } from "fs";

class Settings {
    debug: boolean;
    cwd: string;
    file: string;
    filesGlob: string;
    files: string[];
    auth: string;
    dev: boolean;
    failBuild: boolean;
    trustPolicies: boolean;
    org: string;
    additionalArguments: string;
    severityThreshold: string;
    policyFile: string;
}

async function run() {
    try {
        tl.warning("============================ DEPRECATION NOTICE ============================");
        tl.warning("Snyk has published their official Azure Pipelines extension. Get it here:");
        tl.warning("https://marketplace.visualstudio.com/items?itemName=Snyk.snyk-security-scan");
        tl.warning("");
        tl.warning("                       Thank you for trusting my work over the past 3 years.");
        tl.warning("============================ DEPRECATION NOTICE ============================");

        let snyk: string;
        const snykInstallation = tl.getInput("whichSnyk", true);
        switch (snykInstallation) {
            case "builtin":
            {
                tl.debug(`Using built-in version.`);
                if (tl.getBoolInput("autoUpdate", true)) {
                    await upgradeSnyk();
                }

                let isWindows: Boolean = os.platform() === "win32";
                snyk = path.join(__dirname , "/node_modules/.bin/snyk");
                if (isWindows) {
                    snyk += ".cmd";
                } else {
                    chmodSync(snyk, "777");
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
            await tl.exec(snyk, "--version");
        }

        const test: boolean = tl.getBoolInput("test");
        const protect: boolean = tl.getBoolInput("protect");

        const monitorBranches: string[] = tl.getDelimitedInput("branches", ";\n", false) || [];
        let monitor = false;
        if (tl.getBoolInput("monitor")) {
            const branch: string = tl.getVariable("Build.SourceBranch") || "";
            if (matchesMonitorBranch(monitorBranches, branch)) {
                monitor = true;
            } else {
                tl.debug(`Skipping monitor, branch '${branch}' doesn't match.`);
            }
        }

        const settings: Settings = new Settings();

        const debugMode: string = tl.getVariable('System.Debug');
        settings.debug = debugMode ? debugMode.toLowerCase() != 'false' : false;
        settings.severityThreshold = tl.getInput("severityThreshold", false) || "default";
        settings.cwd = tl.getInput("workingDirectory", true) || tl.cwd();

        if (!(tl.getBoolInput("multiFile", false) || false))
        {
            settings.files = [ tl.getInput("file", false) || "default" ];
        } else {
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
            const authenticationType: string = tl.getInput("authType", true);
            tl.debug(`Reading snyk token from: ${authenticationType}.`);

            switch (authenticationType) {
                case "token": {
                    settings.auth = tl.getInput("token", true);
                    break;
                }
                case "endpoint": {
                    const connectedServiceName: string = tl.getInput("endpoint", true);
                    settings.auth = tl.getEndpointAuthorization(connectedServiceName, false).parameters["apitoken"];
                    break;
                }
                case "none": {
                    throw new Error("Authentication is required in order to use Snyk Test or Monitor.");
                }
            }

            await runSnyk(snyk, "auth", settings);
        }

        for (let i = 0; i < settings.files.length; i++) {
            settings.file = path.resolve(settings.files[i]);
            
            if (settings.file.endsWith("\\vendor\\vendor.json") 
             || settings.file.endsWith("\\obj\\project.assets.json")
             || settings.file.endsWith("/vendor/vendor.json") 
             || settings.file.endsWith("/obj/project.assets.json") )
            {
                settings.cwd = path.resolve(path.join(path.dirname(settings.file), "../"));
            }
            
            if (protect) {
                await runSnyk(snyk, "protect", settings);
            }
            if (test) {
                await runSnyk(snyk, "test", settings);
            }
            if (monitor) {
                await runSnyk(snyk, "monitor", settings);
            }
        }

        tl.setResult(tl.TaskResult.Succeeded, "Done.", true);
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message, true);
    }
}

function matchesMonitorBranch(monitorBranches: string[], branch: string) {
    return (monitorBranches.length === 0 || tl.match([branch], monitorBranches, null, { matchBase: true, nocase: false }).length > 0);
}

async function upgradeSnyk() {
    tl.debug(`Updating snyk...`);
    const npmRunner = new tr.ToolRunner(tl.which("npm"));
    npmRunner.arg("install");
    npmRunner.arg("snyk@latest");
    npmRunner.arg("--prefix");
    npmRunner.arg(__dirname);

    const npmResult = await npmRunner.exec(<tr.IExecOptions>{ failOnStdErr: false });
    tl.debug(`result: ${npmResult}`);

    if (npmResult !== 0) {
        throw `Failed to update snyk.`;
    } else {
        tl.debug(`Done.`);
    }
}

async function runSnyk(path: string, command: string, settings: Settings) {
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

    if (tl.cwd) {
        tl.cd(settings.cwd);
    }
    const snykResult = await snykRunner.exec(<tr.IExecOptions>{ failOnStdErr: false, ignoreReturnCode: true });
    tl.debug(`result: ${snykResult}`);

    if (snykResult === 1 && command === "test") {
        const message = "Snyk found issues: " + settings.file;
        if (!settings.failBuild){
            tl.warning(message)
            tl.warning("Ignoring due to 'Fail Build = false'.");
        }
        else
        {
            tl.setResult(tl.TaskResult.Failed, message);
        }
    }
    else if (snykResult !== 0) {
        throw `Failed: ${command}: ${snykResult}`;
    }
}

void run();