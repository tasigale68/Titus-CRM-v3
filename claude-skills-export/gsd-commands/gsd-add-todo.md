# GSD: Add Todo

## Description
Capture an idea, task, or issue that surfaces during a GSD session as a structured todo for later work. Handles directory structure creation, content extraction from arguments or conversation, area inference from file paths, duplicate detection and resolution, todo file creation with frontmatter, STATE.md updates, and git commits.

## Trigger
`/gsd:add-todo [optional description]`

## Instructions

```
name: gsd:add-todo
description: Capture idea or task as todo from current conversation context
argument-hint: [optional description]
allowed-tools: Read, Write, Bash, AskUserQuestion
```

### Objective
Capture an idea, task, or issue that surfaces during a GSD session as a structured todo for later work.

Routes to the add-todo workflow which handles:
- Directory structure creation
- Content extraction from arguments or conversation
- Area inference from file paths
- Duplicate detection and resolution
- Todo file creation with frontmatter
- STATE.md updates
- Git commits

### Execution Context
Loads workflow from `workflows/add-todo.md`.

### Context
Arguments: $ARGUMENTS (optional todo description)

State is resolved in-workflow via `init todos` and targeted reads.

### Process
**Follow the add-todo workflow**.

The workflow handles all logic including:
1. Directory ensuring
2. Existing area checking
3. Content extraction (arguments or conversation)
4. Area inference
5. Duplicate checking
6. File creation with slug generation
7. STATE.md updates
8. Git commits
