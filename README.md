[![Donate](https://github.com/jessehouwing/vsts-snyk-task/blob/master/extension/images/donate.png?raw=true)](https://www.paypal.me/JesseHouwing/5)      

# Preview and 3rd party notice

* This task has been developed by Jesse Houwing and is not associated with Snyk.io.
* This task is currently in preview. Please provide feedback and suggestions in the GitHub issues.

# Release Notes

> **12-11-2016**
> - Added: Initial preview release

# Description

Snyk provides a quick and simple way to detect insecure package dependencies and optionally enables you to patch/upgrade the insecurities in place.

This task supports:

 * Scanning for insecure dependencies (snyk test)
 * Protecting your project by fixing or patching insecure dependencies (snyk protect)
 * Register your project with snyk to be notified of future issues (snyk monitor)
 
You can supply your snyk API-token through a service connection (recommended) or a text input.
 
This task depends on snyk, which is not bundled in the current version. There are a few options available:

 * Install snyk by prepending a NPM package task:
  * command: `install`
  * arguments: `snyk --prefix "$(Build.WorkFolder)\tools"`
  * working directory: e.g. `$(Build.WorkFolder)\tools`
  * Supply the path to snyk in the 'Path to Snyk' input, e.g. `$(Build.WorkFolder)\tools\node_modules\.bin\snyk.cmd`

 * Install snyk on your build server
  * Optionally add its path to the systems path environment variable
  * Or supply the path to snyk in the 'Path to Snyk' input

# Future options
 
 * Auto-install of snyk when needed.
 * Wildcard support in path to project?

# Documentation

Please check the [Wiki](https://github.com/jessehouwing/vsts-snyk-task/wiki) (coming soon).

If you have ideas or improvements to existing tasks, don't hestitate to leave feedback or [file an issue](https://github.com/jessehouwing/vsts-snyk-task/issues).
