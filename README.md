# jetbrains-eslint-killer

This script is a workaround for the issue with eslint integration in JetBrains IDEs and NX monorepo (or any other repository that has multiple eslint config files).

## The issue

Details are described in [this issue](https://youtrack.jetbrains.com/issue/WEB-57163/Option-to-make-eslint-language-services-expirable-or-limited-in-number) on JetBrains YouTrack.

**Summary**: jetbrains spawns multiple eslint processes that newer die and consume a lot of memory especially when linting Typescript.

## The solution

This scripts monitors memory consumption of eslint processes and kills them when they exceed the limit (6 GB by default).

## Caveat

Script's goal is killing only eslint processes started by the IDE but there is a small chance that it may interfere with other eslint processes started by other utilities. (See how filtration works in the code)

## Usage

1. Checkout this repository
2. Run `pnpm install` or `npm install`
3. [optional] Confirm default options in `main.mjs`
4. Run `node main.mjs` 

