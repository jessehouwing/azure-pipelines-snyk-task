///<reference path="./typings/main.d.ts" />
import * as tl from "vsts-task-lib/task";
import * as trm from "vsts-task-lib/toolrunner";

async function run() {
    try {
        const snyk = tl.which('snyk');
        const snykRunner = new trm.ToolRunner(snyk);

        // Set the commandline arguments
        snykRunner.arg(tl.getInput("samplestring", true));

        const snykResult: number = await snykRunner.exec();
        tl.setResult(snykResult, tl.loc("SnykReturnCode", snykResult));
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

run();