///<reference path="./typings/index.d.ts" />
import * as tl from "vsts-task-lib/task";
import * as tr from "vsts-task-lib/toolrunner";
import * as os from "os"

class Settings {
    projectsToScan: string;
    basePath: string;
    auth: string;
    dev: boolean;
    ignorePolicy: boolean;
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
                snyk = `${__dirname}/node_modules/.bin/snyk`;
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
        const monitor: boolean = tl.getBoolInput("actionMonitor");

        const settings: Settings = new Settings();
        
        settings.projectsToScan = tl.getInput("optionProjectsToScan", true);
        settings.basePath = tl.getInput("optionBasePath");
        tl.cd(settings.basePath || process.cwd());
        
        settings.dev = tl.getBoolInput("optionDev", false);
        settings.ignorePolicy = tl.getBoolInput("optionIgnorePolicy", false);
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
            await runSnyk(snyk, "protect", settings);
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
    const snykRunner = new tr.ToolRunner(path);
    snykRunner.arg(command);

    switch (command) {
        case "auth":
            snykRunner.arg(settings.auth);
            break;
        
        case "test": 
        case "protect":
        case "monitor":
            snykRunner.arg(settings.projectsToScan);

            snykRunner.argIf(settings.dev, "--dev");
            snykRunner.argIf(settings.ignorePolicy, "--ignore-policy");
            snykRunner.argIf(settings.trustPolicies, "--trust-policies");
            snykRunner.argIf(settings.org, `--org="${settings.org}"`);

            snykRunner.arg(settings.additionalArguments);
            break;
    }

    const snykResult = await snykRunner.exec(<tr.IExecOptions>{ failOnStdErr: true });
    tl.debug(`result: ${snykResult}`);

    if (snykResult !== 0) {
        throw `Failed: ${command}: ${snykResult}`;
    }
}

run();