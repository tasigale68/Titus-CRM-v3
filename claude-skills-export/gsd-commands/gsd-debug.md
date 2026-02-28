# GSD: Debug

## Description
Systematic debugging with persistent state across context resets. Uses scientific method with subagent isolation. Orchestrator gathers symptoms, spawns gsd-debugger agent, handles checkpoints, and spawns continuations. Investigation burns context fast so fresh 200k context is used per investigation while main context stays lean for user interaction.

## Trigger
`/gsd:debug [issue description]`

## Instructions

```
name: gsd:debug
description: Systematic debugging with persistent state across context resets
argument-hint: [issue description]
allowed-tools: Read, Bash, Task, AskUserQuestion
```

### Objective
Debug issues using scientific method with subagent isolation.

**Orchestrator role:** Gather symptoms, spawn gsd-debugger agent, handle checkpoints, spawn continuations.

**Why subagent:** Investigation burns context fast (reading files, forming hypotheses, testing). Fresh 200k context per investigation. Main context stays lean for user interaction.

### Context
User's issue: $ARGUMENTS

Check for active sessions:
```bash
ls .planning/debug/*.md 2>/dev/null | grep -v resolved | head -5
```

### Process

#### 0. Initialize Context
```bash
INIT=$(node gsd-tools.cjs state load)
```
Extract `commit_docs` from init JSON. Resolve debugger model:
```bash
DEBUGGER_MODEL=$(node gsd-tools.cjs resolve-model gsd-debugger --raw)
```

#### 1. Check Active Sessions
If active sessions exist AND no $ARGUMENTS:
- List sessions with status, hypothesis, next action
- User picks number to resume OR describes new issue

If $ARGUMENTS provided OR user describes new issue:
- Continue to symptom gathering

#### 2. Gather Symptoms (if new issue)
Use AskUserQuestion for each:
1. **Expected behavior** - What should happen?
2. **Actual behavior** - What happens instead?
3. **Error messages** - Any errors? (paste or describe)
4. **Timeline** - When did this start? Ever worked?
5. **Reproduction** - How do you trigger it?

After all gathered, confirm ready to investigate.

#### 3. Spawn gsd-debugger Agent
Fill prompt with symptoms and spawn:
```
Task(
  prompt=filled_prompt,
  subagent_type="gsd-debugger",
  model="{debugger_model}",
  description="Debug {slug}"
)
```

#### 4. Handle Agent Return
**If `## ROOT CAUSE FOUND`:**
- Display root cause and evidence summary
- Offer options: "Fix now", "Plan fix", "Manual fix"

**If `## CHECKPOINT REACHED`:**
- Present checkpoint details to user
- Get user response
- Spawn continuation agent (see step 5)

**If `## INVESTIGATION INCONCLUSIVE`:**
- Show what was checked and eliminated
- Offer options: "Continue investigating", "Manual investigation", "Add more context"

#### 5. Spawn Continuation Agent (After Checkpoint)
When user responds to checkpoint, spawn fresh agent with prior state and checkpoint response.

### Success Criteria
- Active sessions checked
- Symptoms gathered (if new)
- gsd-debugger spawned with context
- Checkpoints handled correctly
- Root cause confirmed before fixing
