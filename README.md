# 3rd party notice

* This task has been developed by Jesse Houwing and is not associated directly with Snyk.io.

# Release Notes

> **30-11-2016**
> - Removed: Preview flag
> - Updated: Screenshots & documentation links 

> **19-11-2016**
> - Workaround: snyk can't find `patch.exe` on windows agents
> - Added: fail build now optional
> - Removed: Ignore Policies option
> - Workaround: snyk doesn't detect VSTS/TFS build agent and log CI suggestion

> **12-11-2016**
> - Added: Initial preview release

# Description

Snyk provides a quick and simple way to detect insecure package dependencies and optionally enables you to patch/upgrade the vulnerabilities in place.

This task supports:

 * Scanning for insecure dependencies (snyk test)
 * Protecting your project by fixing or patching insecure dependencies (snyk protect)
 * Register your project with snyk to be notified of future issues (snyk monitor)
 
You can supply your snyk API-token through a service connection (recommended) or a text input.
 
This task depends on snyk, which is bundled in the current version. Should you want to use a specific version there are a few options available:

 * Install snyk by prepending a NPM package task:
  * command: `install`
  * arguments: `snyk --prefix "$(Build.WorkFolder)\_tools"`
  * working directory: e.g. `$(Build.WorkFolder)\_tools`
  * Supply the path to snyk in the 'Path to Snyk' input, e.g. `$(Build.WorkFolder)\_tools\node_modules\.bin\snyk.cmd`

 * Install snyk on your build server
  * Optionally add its path to the systems path environment variable
  * Or supply the path to snyk in the 'Path to Snyk' input

Find the task in the Utility category of both Build and Release.

# Known issues
 
 * Windows: `path\to\project\*` causes `snyk test` to fail.
 * Windows: `path\to\project\*` causes `snyk protect` to fail.
 
# Documentation

Please check the [Wiki](https://github.com/jessehouwing/vsts-snyk-task/wiki) (coming soon).

If you have ideas or improvements, don't hestitate to leave feedback or [file an issue](https://github.com/jessehouwing/vsts-snyk-task/issues).
