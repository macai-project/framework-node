# Macai -  NodeJS Lambda Framework

Unopinionated and minimalist framework for AWS lambda in NodeJS

## Release

```
npm version [ major | minor | patch]
```

Stage and commit files you need for the relese.

```
gh release create <version>
```
*Note: <version> is the version created by the command npm version*

The release will trigger a Github Action which will publish the package to the NPM registry.
