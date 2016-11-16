///<reference path="./typings/index.d.ts" />
import * as tl from "vsts-task-lib/task";
import * as tr from "vsts-task-lib/toolrunner";
import * as os from "os"
import * as path from "path"

class Settings {
    projectsToScan: string;
    auth: string;
    dev: boolean;
    failBuild: boolean;
    trustPolicies: boolean;
    org: string;
    additionalArguments: string;
}

async function run() {
    try {
        let snyk: string;
        const snykInstallation = tl.getInput("optionSnykInstallation", true);
        switch (snykInstallation) {
            case "builtin":
            {
                tl.debug(`Using built-in version.`);
                if (tl.getBoolInput("optionUpgrade", true)) {
                    await upgradeSnyk();
                }

                let isWindows: Boolean = os.platform() === "win32";
                snyk = path.join(__dirname , "/node_modules/.bin/snyk");
                if (isWindows) {
                    snyk += ".cmd";
                }
                break;
            }
            case "system":
                snyk = tl.which("snyk", true);
                tl.debug(`Using system installed snyk from: ${snyk}.`);
                break;
            case "path":
                snyk = tl.getPathInput("pathToSnyk", true, true);
                tl.debug(`Using user configured snyk from: ${snyk}.`);
                break;
        }

        if (!snyk) {
            tl.setResult(tl.TaskResult.Failed, "Could not locate snyk.");
            return;
        }

        const test: boolean = tl.getBoolInput("actionTest");
        const protect: boolean = tl.getBoolInput("actionProtect");
        
        const monitorBranches: string[] = tl.getDelimitedInput("optionMonitorBranches", ";\n", false) || [];
        let monitor = false;
        if (tl.getBoolInput("actionMonitor")) {
            const branch: string = tl.getVariable("Build.SourceBranch") || "";
            if (matchesMonitorBranch(monitorBranches, branch)) {
                monitor = true;
            } else {
                tl.debug(`Skipping monitor, branch '${branch}' doesn't match.`);
            }
        }

        const settings: Settings = new Settings();
        
        settings.projectsToScan = tl.getInput("optionProjectsToScan", true);
        
        settings.dev = tl.getBoolInput("optionDev", false);
        settings.failBuild = tl.getBoolInput("optionFailBuild", false);
        settings.trustPolicies = tl.getBoolInput("optionTrustPolicies", false);
        settings.org = tl.getInput("optionOrg", false);

        settings.additionalArguments = tl.getInput("optAdditionalArguments", false);

        if (protect || monitor) {
            const authenticationType: string = tl.getInput("optionAuthenticationType");
            tl.debug(`Reading snyk token from: ${authenticationType}.`);

            switch (authenticationType) {
                case "token":
                    settings.auth = tl.getInput("optAuth", true);
                    break;
                case "endpoint": {
                    const connectedServiceName: string = tl.getInput("optServiceEndpoint", false);
                    settings.auth = tl.getEndpointAuthorization(connectedServiceName, true).parameters["apitoken"];
                    break;
                }
            }

            await runSnyk(snyk, "auth", settings);
        }

        if (protect) {
            // detect patch.exe on windows systems if it can't be found in the path
            const oldPath = process.env["PATH"];
            try {
                if (!tl.which("patch")) {
                    const agentFolder = tl.getVariable("Agent.HomeDirectory");
                    tl.setEnvVar("PATH", oldPath + ";" + path.join(agentFolder, "/externals/git/usr/bin/") + ";");
                }
                await runSnyk(snyk, "protect", settings);
            } finally {
                tl.setEnvVar("PATH", oldPath);
            }
        }
        if (test) {
            await runSnyk(snyk, "test", settings);
        }
        if (monitor) {
            await runSnyk(snyk, "monitor", settings);
        }

        tl.setResult(tl.TaskResult.Succeeded, "Done.");
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

function matchesMonitorBranch(monitorBranches: string[], branch: string) {
    return (monitorBranches.length === 0 || tl.match([branch], monitorBranches, { matchBase: true, nocase: false }).length > 0);
}

async function upgradeSnyk() {
    tl.debug(`Updating snyk...`);
    const npmRunner = new tr.ToolRunner(tl.which("npm"));
    npmRunner.arg("update");
    npmRunner.arg("snyk@latest");
    npmRunner.arg("--prefix");
    npmRunner.arg(__dirname);

    const npmResult = await npmRunner.exec(<tr.IExecOptions>{ failOnStdErr: true });
    tl.debug(`result: ${npmResult}`);

    if (npmResult !== 0) {
        throw `Failed to update snyk.`;
    } else {
        tl.debug(`Done.`);
    }
}

async function runSnyk(path: string, command: string, settings: Settings)
{
    tl.debug(`Calling snyk ${command}...`);
    tl.setEnvVar("CONTINUOUS_INTEGRATION", "true");

    const snykRunner = new tr.ToolRunner(path);
    snykRunner.arg(command);

    switch (command) {
        case "auth":
            snykRunner.arg(settings.auth);
            break;

        case "protect":
        case "test": 
        case "monitor":
            if (settings.projectsToScan.match(/\*$/)) {
                snykRunner.arg("*");
                tl.cd(settings.projectsToScan.substring(0, settings.projectsToScan.length - 1));
            } else {
                tl.cd(settings.projectsToScan);
            }

            snykRunner.argIf(settings.dev, "--dev");
            snykRunner.argIf(settings.trustPolicies, "--trust-policies");
            snykRunner.argIf(settings.org, `--org="${settings.org}"`);

            snykRunner.arg(settings.additionalArguments);
            break;
    }

    const snykResult = await snykRunner.exec(<tr.IExecOptions>{ failOnStdErr: true });
    tl.debug(`result: ${snykResult}`);

    if (snykResult === 1 && !settings.failBuild && command === "test") {
        tl.warning("Snyk reported one or more issues. Ignoring due to 'Fail Build = false'.");
    }
    else if (snykResult !== 0) {
        throw `Failed: ${command}: ${snykResult}`;
    }
}

run();