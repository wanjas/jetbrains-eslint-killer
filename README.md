# jetbrains-eslint-killer

This script is a workaround for the issue with eslint integration in JetBrains IDEs and NX monorepo (or any other repository that has multiple eslint config files).

## The issue

Details are described in [this issue](https://youtrack.jetbrains.com/issue/WEB-57163/Option-to-make-eslint-language-services-expirable-or-limited-in-number) on JetBrains YouTrack.

**Summary**: jetbrains spawns multiple eslint processes that never die and consume a lot of memory especially when linting Typescript.

## The solution

This scripts monitors memory consumption of eslint processes and kills them when they exceed `max-memory` down to `optimal-process-count`. Oldest inactive processes are killed first.

## Disclaimer

Script's goal is killing only eslint processes started by the IDE but there is a **very** unlikely chance that it may interfere with other eslint processes started by other utilities. (See how filtration works in the code)

Script is tested only on Linux. It should work on Windows and other platforms because used packages are cross-platform but it is not tested.

## Usage

1. Checkout this repository
2. Run `pnpm install` or `npm install`
3. Run `node main.mjs` 

Or you can install package globally: 

`pnpm install -g jetbrains-eslint-killer` and then `jetbrains-eslint-killer` from any directory.

Try `node main.mjs --max-memory=10 --interval=60` or `node main.mjs --help` for more options. 

```
  -m, --max-memory             Maximum allowed memory consumption in GB. Exceeding this limit will lead to killings down to 'optimal-process-count'. Default: 6 GB
                                                      
  -c, --optimal-process-count  Number of eslint processes that should be left running if memory threshold is reached. Default: 2
                                                      
  -i, --interval               Check interval in seconds. Default: 30 seconds.
                                                      
  -s, --silent                 Don't output log messages. Default: false
                                                      
```
