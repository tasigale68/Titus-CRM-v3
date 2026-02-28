# GSD: Reapply Patches

## Description
After a GSD update wipes and reinstalls files, this command merges user's previously saved local modifications back into the new version. Uses intelligent comparison to handle cases where the upstream file also changed.

## Trigger
`/gsd:reapply-patches`

## Instructions

```
description: Reapply local modifications after a GSD update
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
```

### Purpose
After a GSD update wipes and reinstalls files, this command merges user's previously saved local modifications back into the new version. Uses intelligent comparison to handle cases where the upstream file also changed.

### Process

#### Step 1: Detect backed-up patches
Check for local patches directory. Read `backup-meta.json` from the patches directory.

**If no patches found:**
```
No local patches found. Nothing to reapply.
Local patches are automatically saved when you run /gsd:update
after modifying any GSD workflow, command, or agent files.
```
Exit.

#### Step 2: Show patch summary
Display table of files to reapply with status (Pending).

#### Step 3: Merge each file
For each file in `backup-meta.json`:
1. **Read the backed-up version** (user's modified copy)
2. **Read the newly installed version** (current file after update)
3. **Compare and merge:**
   - If identical: skip (modification was incorporated upstream)
   - If differs: identify user's modifications and apply to new version

   **Merge strategy:**
   - Read both versions fully
   - Identify sections the user added or modified
   - Apply user's additions/modifications to the new version
   - If conflict: flag, show both versions, ask user which to keep

4. **Write merged result**
5. **Report status:** Merged / Skipped / Conflict

#### Step 4: Update manifest
After reapplying, regenerate the file manifest so future updates correctly detect modifications.

#### Step 5: Cleanup option
Ask user: Keep or clean up patch backups?

#### Step 6: Report
Display final status table with count of files updated.

### Success Criteria
- All backed-up patches processed
- User modifications merged into new version
- Conflicts resolved with user input
- Status reported for each file
