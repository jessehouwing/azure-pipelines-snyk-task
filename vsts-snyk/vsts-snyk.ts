///<reference path="./typings/index.d.ts" />
import * as tl from "vsts-task-lib/task";
import * as trm from "vsts-task-lib/toolrunner";

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
        const filePath: string = tl.getPathInput("pathToSnyk", true, true);
        let snyk: string;

        if (!filePath) {
            snyk = tl.which("snyk");
        } else {
            snyk = filePath;
        }

        const test: boolean = tl.getBoolInput("actionTest");
        const protect: boolean = tl.getBoolInput("actioProtect");
        const monitor: boolean = tl.getBoolInput("actionMonitor");

        const settings: Settings = new Settings();
        
        settings.projectsToScan = tl.getInput("optionProjectsToScan", true);
        settings.basePath = tl.getInput("optionBasePath");
        tl.cd(settings.basePath || process.cwd());
        
        settings.failBuild = tl.getBoolInput("optionFailBuild", true);
        settings.dev = tl.getBoolInput("optionDev", true);
        settings.ignorePolicy = tl.getBoolInput("optionIgnorePolicy", true);
        settings.trustPolicies = tl.getBoolInput("optionTrustPolicies", true);
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

            snykRunner.argIf(settings.additionalArguments, settings.additionalArguments);
            break;
    }

    const snykResult: number = await snykRunner.exec(<trm.IExecOptions>{ failOnStdErr: true });

    if (!snykResult){
        throw `Failed: ${command}: ${snykResult}`;
    }
}

run();