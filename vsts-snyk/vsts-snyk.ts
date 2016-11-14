///<reference path="./typings/index.d.ts" />
import * as tl from "vsts-task-lib/task";
import * as trm from "vsts-task-lib/toolrunner";
import * as os from "os"

class Settings {
    projectsToScan: string;
    basePath: string;
    auth: string;
    failBuild: boolean;
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
                let isWindows: Boolean = os.platform() === "win32";

                snyk = `${__dirname}/node_modules/.bin/snyk`;
                if (isWindows) {
                    snyk += ".cmd";
                }
                break;
            }
            case "system":
                snyk = tl.which("snyk", true);
                break;
            case "path":
                snyk = tl.getPathInput("pathToSnyk", true, true);
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
        
        settings.failBuild = tl.getBoolInput("optionFailBuild", false);
        settings.dev = tl.getBoolInput("optionDev", false);
        settings.ignorePolicy = tl.getBoolInput("optionIgnorePolicy", false);
        settings.trustPolicies = tl.getBoolInput("optionTrustPolicies", false);
        settings.org = tl.getInput("optionOrg", false);

        settings.additionalArguments = tl.getInput("optAdditionalArguments", false);

        if (protect || monitor) {
            const authenticationType: string = tl.getInput("optionAuthenticationType");
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

        if (test) {
            await runSnyk(snyk, "test", settings);
        }
        if (protect) {
            await runSnyk(snyk, "protect", settings);
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

async function runSnyk(path: string, command: string, settings: Settings)
{
    const snykRunner = new trm.ToolRunner(path);
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

    const snykResult: number = await snykRunner.exec(<trm.IExecOptions>{ failOnStdErr: true });
    tl.debug(`result: ${snykResult}`);

    if (snykResult !== 0){
        throw `Failed: ${command}: ${snykResult}`;
    }
}

run();