///<reference path="./typings/main.d.ts" />
import * as tl from "vsts-task-lib/task";
import * as trm from "vsts-task-lib/toolrunner";

async function run() {
    try {
        let snyk = tl.which('snyk');
        let snykRunner = new trm.ToolRunner(snyk);

        // Set the commandline arguments
        snykRunner.arg(tl.getInput('samplestring', true));

        await snykRunner.exec();
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

run();