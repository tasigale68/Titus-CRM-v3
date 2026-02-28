# Remotion: Make PR

## Description
Open a pull request for the current feature in the Remotion repo, including formatting with Oxfmt and proper commit/PR title conventions.

## Trigger
When ready to open a pull request for a Remotion feature or fix.

## Instructions

Ensure we are not on the main branch, make a branch if necessary.
For all packages affected, run Oxfmt to format the code:

```
bunx oxfmt src --write
```

Commit the changes, use the following format:

```
`[package-name]`: [commit-message]
```

For example, "`@remotion/shapes`: Add heart shape".
The package name must be obtained from package.json.
If multiple packages are affected, use the one that you think is most relevant.

Push the changes to the remote branch.
Use the `gh` CLI to create a pull request and use the same format as above for the title.
