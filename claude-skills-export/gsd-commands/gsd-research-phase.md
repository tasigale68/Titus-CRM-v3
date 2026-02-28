# GSD: Research Phase

## Description
Research how to implement a phase. Spawns gsd-phase-researcher agent with phase context. Standalone research command. For most workflows, use `/gsd:plan-phase` which integrates research automatically.

## Trigger
`/gsd:research-phase [phase]`

**Use this command when:**
- You want to research without planning yet
- You want to re-research after planning is complete
- You need to investigate before deciding if a phase is feasible

## Instructions

```
name: gsd:research-phase
description: Research how to implement a phase (standalone - usually use /gsd:plan-phase instead)
argument-hint: "[phase]"
allowed-tools: Read, Bash, Task
```

### Objective
Research how to implement a phase. Spawns gsd-phase-researcher agent with phase context.

**Orchestrator role:** Parse phase, validate against roadmap, check existing research, gather context, spawn researcher agent, present results.

**Why subagent:** Research burns context fast (WebSearch, Context7 queries, source verification). Fresh 200k context for investigation. Main context stays lean for user interaction.

### Context
Phase number: $ARGUMENTS (required)

Normalize phase input in step 1 before any directory lookups.

### Process

#### 0. Initialize Context
Extract phase info and resolve researcher model.

#### 1. Validate Phase
Error if phase not found in roadmap.

#### 2. Check Existing Research
If RESEARCH.md exists: Offer to update, view, or skip. If not: continue.

#### 3. Gather Phase Context
Use paths from INIT (do not inline file contents in orchestrator context):
- requirements_path
- context_path
- state_path

#### 4. Spawn gsd-phase-researcher Agent
Research discovers:
- What's the established architecture pattern?
- What libraries form the standard stack?
- What problems do people commonly hit?
- What's SOTA vs what Claude's training thinks is SOTA?
- What should NOT be hand-rolled?

**Downstream consumer:** RESEARCH.md will be loaded by `/gsd:plan-phase` which uses specific sections:
- `## Standard Stack` -> Plans use these libraries
- `## Architecture Patterns` -> Task structure follows these
- `## Don't Hand-Roll` -> Tasks NEVER build custom solutions for listed problems
- `## Common Pitfalls` -> Verification steps check for these
- `## Code Examples` -> Task actions reference these patterns

Be prescriptive, not exploratory. "Use X" not "Consider X or Y."

**Quality gate:** All domains investigated, negative claims verified, multiple sources for critical claims, confidence levels assigned honestly.

#### 5. Handle Agent Return
- **RESEARCH COMPLETE:** Display summary, offer: Plan phase, Dig deeper, Review full, Done.
- **CHECKPOINT REACHED:** Present to user, get response, spawn continuation.
- **RESEARCH INCONCLUSIVE:** Show what was attempted, offer: Add context, Try different mode, Manual.

#### 6. Spawn Continuation Agent
Continue research with prior state and checkpoint response.

### Success Criteria
- Phase validated against roadmap
- Existing research checked
- gsd-phase-researcher spawned with context
- Checkpoints handled correctly
- User knows next steps
