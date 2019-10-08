# 3rd party & deprecation notice

* This task has been developed by Jesse Houwing and is not associated directly with Snyk.io.

In the past 3 years I was able to fill the gap by providing this extension to add Snyk to your Azure Pipeline. Snyk has now officially released their own extension. This task will be maintained for a little while longer, but please do [upgrade to the official extension](https://marketplace.visualstudio.com/items?itemName=Snyk.snyk-security-scan).

# Description

Snyk provides a quick and simple way to detect insecure package dependencies and optionally enables you to patch/upgrade the vulnerabilities in place.

This task supports:

 * Scanning for insecure dependencies (snyk test)
 * Protecting your project by fixing or patching insecure dependencies (snyk protect)
 * Register your project with snyk to be notified of future issues (snyk monitor)
 
You can supply your snyk API-token through a service connection (recommended) or a text input.
 
Find the task in the Utility category of both Build and Release.

# Documentation

If you have ideas or improvements, don't hestitate to leave feedback or [file an issue](https://github.com/jessehouwing/azure-pipelines-snyk-task/issues).
