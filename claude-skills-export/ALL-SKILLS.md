# ALL SKILLS - Complete Claude Code Skills Export

This file contains all 54 exported skills concatenated into one document for bulk upload.
Each skill is separated by clear dividers.

---

# ==============================================
# CATEGORY 1: GSD COMMANDS (31 skills)
# ==============================================

---

# GSD: Add Phase

## Description
Add a new integer phase to the end of the current milestone in the roadmap. Handles phase number calculation (next sequential integer), directory creation with slug generation, roadmap structure updates, and STATE.md roadmap evolution tracking.

## Trigger
`/gsd:add-phase <description>`

## Instructions

```
name: gsd:add-phase
description: Add phase to end of current milestone in roadmap
argument-hint: <description>
allowed-tools: Read, Write, Bash
```

### Objective
Add a new integer phase to the end of the current milestone in the roadmap.

Routes to the add-phase workflow which handles:
- Phase number calculation (next sequential integer)
- Directory creation with slug generation
- Roadmap structure updates
- STATE.md roadmap evolution tracking

### Execution Context
Loads workflow from `workflows/add-phase.md`.

### Context
Arguments: $ARGUMENTS (phase description)

Roadmap and state are resolved in-workflow via `init phase-op` and targeted tool calls.

### Process
**Follow the add-phase workflow** from the add-phase workflow file.

The workflow handles all logic including:
1. Argument parsing and validation
2. Roadmap existence checking
3. Current milestone identification
4. Next phase number calculation (ignoring decimals)
5. Slug generation from description
6. Phase directory creation
7. Roadmap entry insertion
8. STATE.md updates


---

# GSD: Add Tests

## Description
Generate unit and E2E tests for a completed phase, using its SUMMARY.md, CONTEXT.md, and VERIFICATION.md as specifications. Analyzes implementation files, classifies them into TDD (unit), E2E (browser), or Skip categories, presents a test plan for user approval, then generates tests following RED-GREEN conventions.

## Trigger
`/gsd:add-tests <phase> [additional instructions]`

Examples:
- `/gsd:add-tests 12`
- `/gsd:add-tests 12 focus on edge cases in the pricing module`

## Instructions

```
name: gsd:add-tests
description: Generate tests for a completed phase based on UAT criteria and implementation
argument-hint: "<phase> [additional instructions]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task, AskUserQuestion
```

### Objective
Generate unit and E2E tests for a completed phase, using its SUMMARY.md, CONTEXT.md, and VERIFICATION.md as specifications.

Analyzes implementation files, classifies them into TDD (unit), E2E (browser), or Skip categories, presents a test plan for user approval, then generates tests following RED-GREEN conventions.

Output: Test files committed with message `test(phase-{N}): add unit and E2E tests from add-tests command`

### Execution Context
Loads workflow from `workflows/add-tests.md`.

### Context
Phase: $ARGUMENTS

Reads:
- `.planning/STATE.md`
- `.planning/ROADMAP.md`

### Process
Execute the add-tests workflow end-to-end.
Preserve all workflow gates (classification approval, test plan approval, RED-GREEN verification, gap reporting).


---

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


---

# GSD: Audit Milestone

## Description
Verify milestone achieved its definition of done. Check requirements coverage, cross-phase integration, and end-to-end flows. Reads existing VERIFICATION.md files (phases already verified during execute-phase), aggregates tech debt and deferred gaps, then spawns integration checker for cross-phase wiring.

## Trigger
`/gsd:audit-milestone [version]`

## Instructions

```
name: gsd:audit-milestone
description: Audit milestone completion against original intent before archiving
argument-hint: "[version]"
allowed-tools: Read, Glob, Grep, Bash, Task, Write
```

### Objective
Verify milestone achieved its definition of done. Check requirements coverage, cross-phase integration, and end-to-end flows.

**This command IS the orchestrator.** Reads existing VERIFICATION.md files (phases already verified during execute-phase), aggregates tech debt and deferred gaps, then spawns integration checker for cross-phase wiring.

### Execution Context
Loads workflow from `workflows/audit-milestone.md`.

### Context
Version: $ARGUMENTS (optional -- defaults to current milestone)

Core planning files are resolved in-workflow (`init milestone-op`) and loaded only as needed.

**Completed Work:**
- Glob: `.planning/phases/*/*-SUMMARY.md`
- Glob: `.planning/phases/*/*-VERIFICATION.md`

### Process
Execute the audit-milestone workflow end-to-end.
Preserve all workflow gates (scope determination, verification reading, integration check, requirements coverage, routing).


---

# GSD: Check Todos

## Description
List all pending todos, allow selection, load full context for the selected todo, and route to appropriate action. Supports area filtering, interactive selection with full context loading, roadmap correlation checking, and action routing (work now, add to phase, brainstorm, create phase).

## Trigger
`/gsd:check-todos [area filter]`

## Instructions

```
name: gsd:check-todos
description: List pending todos and select one to work on
argument-hint: [area filter]
allowed-tools: Read, Write, Bash, AskUserQuestion
```

### Objective
List all pending todos, allow selection, load full context for the selected todo, and route to appropriate action.

Routes to the check-todos workflow which handles:
- Todo counting and listing with area filtering
- Interactive selection with full context loading
- Roadmap correlation checking
- Action routing (work now, add to phase, brainstorm, create phase)
- STATE.md updates and git commits

### Execution Context
Loads workflow from `workflows/check-todos.md`.

### Context
Arguments: $ARGUMENTS (optional area filter)

Todo state and roadmap correlation are loaded in-workflow using `init todos` and targeted reads.

### Process
**Follow the check-todos workflow**.

The workflow handles all logic including:
1. Todo existence checking
2. Area filtering
3. Interactive listing and selection
4. Full context loading with file summaries
5. Roadmap correlation checking
6. Action offering and execution
7. STATE.md updates
8. Git commits


---

# GSD: Cleanup

## Description
Archive phase directories from completed milestones into `.planning/milestones/v{X.Y}-phases/`. Use when `.planning/phases/` has accumulated directories from past milestones.

## Trigger
`/gsd:cleanup`

## Instructions

```
name: gsd:cleanup
description: Archive accumulated phase directories from completed milestones
```

### Objective
Archive phase directories from completed milestones into `.planning/milestones/v{X.Y}-phases/`.

Use when `.planning/phases/` has accumulated directories from past milestones.

### Execution Context
Loads workflow from `workflows/cleanup.md`.

### Process
Follow the cleanup workflow.
Identify completed milestones, show a dry-run summary, and archive on confirmation.


---

# GSD: Complete Milestone

## Description
Mark a milestone complete, archive to milestones/, and update ROADMAP.md and REQUIREMENTS.md. Creates historical record of shipped version, archives milestone artifacts (roadmap + requirements), and prepares for next milestone.

## Trigger
`/gsd:complete-milestone <version>`

## Instructions

```
name: gsd:complete-milestone
description: Archive completed milestone and prepare for next version
argument-hint: <version>
allowed-tools: Read, Write, Bash
```

### Objective
Mark milestone complete, archive to milestones/, and update ROADMAP.md and REQUIREMENTS.md.

Purpose: Create historical record of shipped version, archive milestone artifacts (roadmap + requirements), and prepare for next milestone.
Output: Milestone archived (roadmap + requirements), PROJECT.md evolved, git tagged.

### Execution Context
Loads:
- `workflows/complete-milestone.md` (main workflow)
- `templates/milestone-archive.md` (archive template)

### Context
**Project files:**
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/PROJECT.md`

**User input:**
- Version: e.g., "1.0", "1.1", "2.0"

### Process

0. **Check for audit:**
   - Look for `.planning/v{version}-MILESTONE-AUDIT.md`
   - If missing or stale: recommend `/gsd:audit-milestone` first
   - If audit status is `gaps_found`: recommend `/gsd:plan-milestone-gaps` first
   - If audit status is `passed`: proceed to step 1

1. **Verify readiness:**
   - Check all phases in milestone have completed plans (SUMMARY.md exists)
   - Present milestone scope and stats
   - Wait for confirmation

2. **Gather stats:**
   - Count phases, plans, tasks
   - Calculate git range, file changes, LOC
   - Extract timeline from git log
   - Present summary, confirm

3. **Extract accomplishments:**
   - Read all phase SUMMARY.md files in milestone range
   - Extract 4-6 key accomplishments
   - Present for approval

4. **Archive milestone:**
   - Create `.planning/milestones/v{version}-ROADMAP.md`
   - Extract full phase details from ROADMAP.md
   - Fill milestone-archive.md template
   - Update ROADMAP.md to one-line summary with link

5. **Archive requirements:**
   - Create `.planning/milestones/v{version}-REQUIREMENTS.md`
   - Mark all v1 requirements as complete (checkboxes checked)
   - Note requirement outcomes (validated, adjusted, dropped)
   - Delete `.planning/REQUIREMENTS.md` (fresh one created for next milestone)

6. **Update PROJECT.md:**
   - Add "Current State" section with shipped version
   - Add "Next Milestone Goals" section
   - Archive previous content in `<details>` (if v1.1+)

7. **Commit and tag:**
   - Stage: MILESTONES.md, PROJECT.md, ROADMAP.md, STATE.md, archive files
   - Commit: `chore: archive v{version} milestone`
   - Tag: `git tag -a v{version} -m "[milestone summary]"`
   - Ask about pushing tag

8. **Offer next steps:**
   - `/gsd:new-milestone` -- start next milestone

### Success Criteria
- Milestone archived to `.planning/milestones/v{version}-ROADMAP.md`
- Requirements archived to `.planning/milestones/v{version}-REQUIREMENTS.md`
- `.planning/REQUIREMENTS.md` deleted (fresh for next milestone)
- ROADMAP.md collapsed to one-line entry
- PROJECT.md updated with current state
- Git tag v{version} created
- Commit successful
- User knows next steps (including need for fresh requirements)

### Critical Rules
- **Load workflow first:** Read complete-milestone.md before executing
- **Verify completion:** All phases must have SUMMARY.md files
- **User confirmation:** Wait for approval at verification gates
- **Archive before deleting:** Always create archive files before updating/deleting originals
- **One-line summary:** Collapsed milestone in ROADMAP.md should be single line with link
- **Context efficiency:** Archive keeps ROADMAP.md and REQUIREMENTS.md constant size per milestone
- **Fresh requirements:** Next milestone starts with `/gsd:new-milestone` which includes requirements definition


---

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


---

# GSD: Discuss Phase

## Description
Gather phase context through adaptive questioning before planning. Extracts implementation decisions that downstream agents need -- researcher and planner will use CONTEXT.md to know what to investigate and what choices are locked. Analyzes the phase to identify gray areas, presents them for selection, deep-dives each selected area until satisfied, and creates CONTEXT.md with decisions that guide research and planning.

## Trigger
`/gsd:discuss-phase <phase> [--auto]`

## Instructions

```
name: gsd:discuss-phase
description: Gather phase context through adaptive questioning before planning
argument-hint: "<phase> [--auto]"
allowed-tools: Read, Write, Bash, Glob, Grep, AskUserQuestion, Task
```

### Objective
Extract implementation decisions that downstream agents need -- researcher and planner will use CONTEXT.md to know what to investigate and what choices are locked.

**How it works:**
1. Analyze the phase to identify gray areas (UI, UX, behavior, etc.)
2. Present gray areas -- user selects which to discuss
3. Deep-dive each selected area until satisfied
4. Create CONTEXT.md with decisions that guide research and planning

**Output:** `{phase_num}-CONTEXT.md` -- decisions clear enough that downstream agents can act without asking the user again

### Execution Context
Loads:
- `workflows/discuss-phase.md`
- `templates/context.md`

### Context
Phase number: $ARGUMENTS (required)

Context files are resolved in-workflow using `init phase-op` and roadmap/state tool calls.

### Process
1. Validate phase number (error if missing or not in roadmap)
2. Check if CONTEXT.md exists (offer update/view/skip if yes)
3. **Analyze phase** -- Identify domain and generate phase-specific gray areas
4. **Present gray areas** -- Multi-select: which to discuss? (NO skip option)
5. **Deep-dive each area** -- 4 questions per area, then offer more/next
6. **Write CONTEXT.md** -- Sections match areas discussed
7. Offer next steps (research or plan)

**CRITICAL: Scope guardrail**
- Phase boundary from ROADMAP.md is FIXED
- Discussion clarifies HOW to implement, not WHETHER to add more
- If user suggests new capabilities: "That's its own phase. I'll note it for later."
- Capture deferred ideas -- don't lose them, don't act on them

**Domain-aware gray areas:**
Gray areas depend on what's being built. Analyze the phase goal:
- Something users SEE -> layout, density, interactions, states
- Something users CALL -> responses, errors, auth, versioning
- Something users RUN -> output format, flags, modes, error handling
- Something users READ -> structure, tone, depth, flow
- Something being ORGANIZED -> criteria, grouping, naming, exceptions

Generate 3-4 **phase-specific** gray areas, not generic categories.

**Probing depth:**
- Ask 4 questions per area before checking
- "More questions about [area], or move to next?"
- If more -> ask 4 more, check again
- After all areas -> "Ready to create context?"

**Do NOT ask about (Claude handles these):**
- Technical implementation
- Architecture choices
- Performance concerns
- Scope expansion

### Success Criteria
- Gray areas identified through intelligent analysis
- User chose which areas to discuss
- Each selected area explored until satisfied
- Scope creep redirected to deferred ideas
- CONTEXT.md captures decisions, not vague vision
- User knows next steps


---

# GSD: Execute Phase

## Description
Execute all plans in a phase using wave-based parallel execution. Orchestrator stays lean: discover plans, analyze dependencies, group into waves, spawn subagents, collect results. Each subagent loads the full execute-plan context and handles its own plan. Context budget: ~15% orchestrator, 100% fresh per subagent.

## Trigger
`/gsd:execute-phase <phase-number> [--gaps-only]`

## Instructions

```
name: gsd:execute-phase
description: Execute all plans in a phase with wave-based parallelization
argument-hint: "<phase-number> [--gaps-only]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, TodoWrite, AskUserQuestion
```

### Objective
Execute all plans in a phase using wave-based parallel execution.

Orchestrator stays lean: discover plans, analyze dependencies, group into waves, spawn subagents, collect results. Each subagent loads the full execute-plan context and handles its own plan.

Context budget: ~15% orchestrator, 100% fresh per subagent.

### Execution Context
Loads:
- `workflows/execute-phase.md`
- `references/ui-brand.md`

### Context
Phase: $ARGUMENTS

**Flags:**
- `--gaps-only` -- Execute only gap closure plans (plans with `gap_closure: true` in frontmatter). Use after verify-work creates fix plans.

Context files are resolved inside the workflow via `gsd-tools init execute-phase` and per-subagent `<files_to_read>` blocks.

### Process
Execute the execute-phase workflow end-to-end.
Preserve all workflow gates (wave execution, checkpoint handling, verification, state updates, routing).


---

# GSD: Health

## Description
Diagnose `.planning/` directory health and optionally repair issues. Validates directory integrity and reports actionable issues. Checks for missing files, invalid configurations, inconsistent state, and orphaned plans.

## Trigger
`/gsd:health [--repair]`

## Instructions

```
name: gsd:health
description: Diagnose planning directory health and optionally repair issues
argument-hint: [--repair]
allowed-tools: Read, Bash, Write, AskUserQuestion
```

### Objective
Validate `.planning/` directory integrity and report actionable issues. Checks for missing files, invalid configurations, inconsistent state, and orphaned plans.

### Execution Context
Loads workflow from `workflows/health.md`.

### Process
Execute the health workflow end-to-end.
Parse --repair flag from arguments and pass to workflow.


---

# GSD: Help

## Description
Display the complete GSD command reference. Output ONLY the reference content. Do NOT add project-specific analysis, git status, file context, next-step suggestions, or any commentary beyond the reference.

## Trigger
`/gsd:help`

## Instructions

```
name: gsd:help
description: Show available GSD commands and usage guide
```

### Objective
Display the complete GSD command reference.

Output ONLY the reference content below. Do NOT add:
- Project-specific analysis
- Git status or file context
- Next-step suggestions
- Any commentary beyond the reference

### Execution Context
Loads workflow from `workflows/help.md`.

### Process
Output the complete GSD command reference from the help workflow.
Display the reference content directly -- no additions or modifications.


---

# GSD: Insert Phase

## Description
Insert a decimal phase for urgent work discovered mid-milestone that must be completed between existing integer phases. Uses decimal numbering (72.1, 72.2, etc.) to preserve the logical sequence of planned phases while accommodating urgent insertions.

## Trigger
`/gsd:insert-phase <after> <description>`

## Instructions

```
name: gsd:insert-phase
description: Insert urgent work as decimal phase (e.g., 72.1) between existing phases
argument-hint: <after> <description>
allowed-tools: Read, Write, Bash
```

### Objective
Insert a decimal phase for urgent work discovered mid-milestone that must be completed between existing integer phases.

Uses decimal numbering (72.1, 72.2, etc.) to preserve the logical sequence of planned phases while accommodating urgent insertions.

Purpose: Handle urgent work discovered during execution without renumbering entire roadmap.

### Execution Context
Loads workflow from `workflows/insert-phase.md`.

### Context
Arguments: $ARGUMENTS (format: <after-phase-number> <description>)

Roadmap and state are resolved in-workflow via `init phase-op` and targeted tool calls.

### Process
Execute the insert-phase workflow end-to-end.
Preserve all validation gates (argument parsing, phase verification, decimal calculation, roadmap updates).


---

# GSD: Join Discord

## Description
Display the Discord invite link for the GSD community server.

## Trigger
`/gsd:join-discord`

## Instructions

```
name: gsd:join-discord
description: Join the GSD Discord community
```

### Objective
Display the Discord invite link for the GSD community server.

### Output

# Join the GSD Discord

Connect with other GSD users, get help, share what you're building, and stay updated.

**Invite link:** https://discord.gg/gsd

Click the link or paste it into your browser to join.


---

# GSD: List Phase Assumptions

## Description
Analyze a phase and present Claude's assumptions about technical approach, implementation order, scope boundaries, risk areas, and dependencies. Helps users see what Claude thinks BEFORE planning begins -- enabling course correction early when assumptions are wrong.

## Trigger
`/gsd:list-phase-assumptions [phase]`

## Instructions

```
name: gsd:list-phase-assumptions
description: Surface Claude's assumptions about a phase approach before planning
argument-hint: "[phase]"
allowed-tools: Read, Bash, Grep, Glob
```

### Objective
Analyze a phase and present Claude's assumptions about technical approach, implementation order, scope boundaries, risk areas, and dependencies.

Purpose: Help users see what Claude thinks BEFORE planning begins - enabling course correction early when assumptions are wrong.
Output: Conversational output only (no file creation) - ends with "What do you think?" prompt

### Execution Context
Loads workflow from `workflows/list-phase-assumptions.md`.

### Context
Phase number: $ARGUMENTS (required)

Project state and roadmap are loaded in-workflow using targeted reads.

### Process
1. Validate phase number argument (error if missing or invalid)
2. Check if phase exists in roadmap
3. Follow workflow:
   - Analyze roadmap description
   - Surface assumptions about: technical approach, implementation order, scope, risks, dependencies
   - Present assumptions clearly
   - Prompt "What do you think?"
4. Gather feedback and offer next steps

### Success Criteria
- Phase validated against roadmap
- Assumptions surfaced across five areas
- User prompted for feedback
- User knows next steps (discuss context, plan phase, or correct assumptions)


---

# GSD: Map Codebase

## Description
Analyze existing codebase using parallel gsd-codebase-mapper agents to produce structured codebase documents. Each mapper agent explores a focus area and writes documents directly to `.planning/codebase/`. The orchestrator only receives confirmations, keeping context usage minimal. Output: .planning/codebase/ folder with 7 structured documents about the codebase state.

## Trigger
`/gsd:map-codebase [optional: specific area to map, e.g., 'api' or 'auth']`

## Instructions

```
name: gsd:map-codebase
description: Analyze codebase with parallel mapper agents to produce .planning/codebase/ documents
argument-hint: "[optional: specific area to map, e.g., 'api' or 'auth']"
allowed-tools: Read, Bash, Glob, Grep, Write, Task
```

### Objective
Analyze existing codebase using parallel gsd-codebase-mapper agents to produce structured codebase documents.

Each mapper agent explores a focus area and **writes documents directly** to `.planning/codebase/`. The orchestrator only receives confirmations, keeping context usage minimal.

Output: .planning/codebase/ folder with 7 structured documents about the codebase state.

### Context
Focus area: $ARGUMENTS (optional - if provided, tells agents to focus on specific subsystem)

**This command can run:**
- Before /gsd:new-project (brownfield codebases) - creates codebase map first
- After /gsd:new-project (greenfield codebases) - updates codebase map as code evolves
- Anytime to refresh codebase understanding

### When to Use
**Use map-codebase for:**
- Brownfield projects before initialization (understand existing code first)
- Refreshing codebase map after significant changes
- Onboarding to an unfamiliar codebase
- Before major refactoring (understand current state)
- When STATE.md references outdated codebase info

**Skip map-codebase for:**
- Greenfield projects with no code yet (nothing to map)
- Trivial codebases (<5 files)

### Process
1. Check if .planning/codebase/ already exists (offer to refresh or skip)
2. Create .planning/codebase/ directory structure
3. Spawn 4 parallel gsd-codebase-mapper agents:
   - Agent 1: tech focus -> writes STACK.md, INTEGRATIONS.md
   - Agent 2: arch focus -> writes ARCHITECTURE.md, STRUCTURE.md
   - Agent 3: quality focus -> writes CONVENTIONS.md, TESTING.md
   - Agent 4: concerns focus -> writes CONCERNS.md
4. Wait for agents to complete, collect confirmations (NOT document contents)
5. Verify all 7 documents exist with line counts
6. Commit codebase map
7. Offer next steps (typically: /gsd:new-project or /gsd:plan-phase)

### Success Criteria
- .planning/codebase/ directory created
- All 7 codebase documents written by mapper agents
- Documents follow template structure
- Parallel agents completed without errors
- User knows next steps


---

# GSD: New Milestone

## Description
Start a new milestone cycle: questioning -> research (optional) -> requirements -> roadmap. Brownfield equivalent of new-project. Project exists, PROJECT.md has history. Gathers "what's next", updates PROJECT.md, then runs requirements -> roadmap cycle.

## Trigger
`/gsd:new-milestone [milestone name, e.g., 'v1.1 Notifications']`

## Instructions

```
name: gsd:new-milestone
description: Start a new milestone cycle -- update PROJECT.md and route to requirements
argument-hint: "[milestone name, e.g., 'v1.1 Notifications']"
allowed-tools: Read, Write, Bash, Task, AskUserQuestion
```

### Objective
Start a new milestone: questioning -> research (optional) -> requirements -> roadmap.

Brownfield equivalent of new-project. Project exists, PROJECT.md has history. Gathers "what's next", updates PROJECT.md, then runs requirements -> roadmap cycle.

**Creates/Updates:**
- `.planning/PROJECT.md` -- updated with new milestone goals
- `.planning/research/` -- domain research (optional, NEW features only)
- `.planning/REQUIREMENTS.md` -- scoped requirements for this milestone
- `.planning/ROADMAP.md` -- phase structure (continues numbering)
- `.planning/STATE.md` -- reset for new milestone

**After:** `/gsd:plan-phase [N]` to start execution.

### Execution Context
Loads:
- `workflows/new-milestone.md`
- `references/questioning.md`
- `references/ui-brand.md`
- `templates/project.md`
- `templates/requirements.md`

### Context
Milestone name: $ARGUMENTS (optional - will prompt if not provided)

Project and milestone context files are resolved inside the workflow (`init new-milestone`) and delegated via `<files_to_read>` blocks where subagents are used.

### Process
Execute the new-milestone workflow end-to-end.
Preserve all workflow gates (validation, questioning, research, requirements, roadmap approval, commits).


---

# GSD: New Project

## Description
Initialize a new project through unified flow: questioning -> research (optional) -> requirements -> roadmap. Creates PROJECT.md (project context), config.json (workflow preferences), research/ (domain research), REQUIREMENTS.md (scoped requirements), ROADMAP.md (phase structure), and STATE.md (project memory).

## Trigger
`/gsd:new-project [--auto]`

Flags:
- `--auto` -- Automatic mode. After config questions, runs research -> requirements -> roadmap without further interaction. Expects idea document via @ reference.

## Instructions

```
name: gsd:new-project
description: Initialize a new project with deep context gathering and PROJECT.md
argument-hint: "[--auto]"
allowed-tools: Read, Bash, Write, Task, AskUserQuestion
```

### Objective
Initialize a new project through unified flow: questioning -> research (optional) -> requirements -> roadmap.

**Creates:**
- `.planning/PROJECT.md` -- project context
- `.planning/config.json` -- workflow preferences
- `.planning/research/` -- domain research (optional)
- `.planning/REQUIREMENTS.md` -- scoped requirements
- `.planning/ROADMAP.md` -- phase structure
- `.planning/STATE.md` -- project memory

**After this command:** Run `/gsd:plan-phase 1` to start execution.

### Execution Context
Loads:
- `workflows/new-project.md`
- `references/questioning.md`
- `references/ui-brand.md`
- `templates/project.md`
- `templates/requirements.md`

### Process
Execute the new-project workflow end-to-end.
Preserve all workflow gates (validation, approvals, commits, routing).


---

# GSD: Pause Work

## Description
Create `.continue-here.md` handoff file to preserve complete work state across sessions. Handles current phase detection from recent files, complete state gathering (position, completed work, remaining work, decisions, blockers), handoff file creation with all context sections, git commit as WIP, and resume instructions.

## Trigger
`/gsd:pause-work`

## Instructions

```
name: gsd:pause-work
description: Create context handoff when pausing work mid-phase
allowed-tools: Read, Write, Bash
```

### Objective
Create `.continue-here.md` handoff file to preserve complete work state across sessions.

Routes to the pause-work workflow which handles:
- Current phase detection from recent files
- Complete state gathering (position, completed work, remaining work, decisions, blockers)
- Handoff file creation with all context sections
- Git commit as WIP
- Resume instructions

### Execution Context
Loads workflow from `workflows/pause-work.md`.

### Context
State and phase progress are gathered in-workflow with targeted reads.

### Process
**Follow the pause-work workflow**.

The workflow handles all logic including:
1. Phase directory detection
2. State gathering with user clarifications
3. Handoff file writing with timestamp
4. Git commit
5. Confirmation with resume instructions


---

# GSD: Plan Milestone Gaps

## Description
Create all phases necessary to close gaps identified by `/gsd:audit-milestone`. Reads MILESTONE-AUDIT.md, groups gaps into logical phases, creates phase entries in ROADMAP.md, and offers to plan each phase. One command creates all fix phases -- no manual `/gsd:add-phase` per gap.

## Trigger
`/gsd:plan-milestone-gaps`

## Instructions

```
name: gsd:plan-milestone-gaps
description: Create phases to close all gaps identified by milestone audit
allowed-tools: Read, Write, Bash, Glob, Grep, AskUserQuestion
```

### Objective
Create all phases necessary to close gaps identified by `/gsd:audit-milestone`.

Reads MILESTONE-AUDIT.md, groups gaps into logical phases, creates phase entries in ROADMAP.md, and offers to plan each phase.

One command creates all fix phases -- no manual `/gsd:add-phase` per gap.

### Execution Context
Loads workflow from `workflows/plan-milestone-gaps.md`.

### Context
**Audit results:**
Glob: `.planning/v*-MILESTONE-AUDIT.md` (use most recent)

Original intent and current planning state are loaded on demand inside the workflow.

### Process
Execute the plan-milestone-gaps workflow end-to-end.
Preserve all workflow gates (audit loading, prioritization, phase grouping, user confirmation, roadmap updates).


---

# GSD: Plan Phase

## Description
Create executable phase prompts (PLAN.md files) for a roadmap phase with integrated research and verification. Default flow: Research (if needed) -> Plan -> Verify -> Done. Orchestrator parses arguments, validates phase, researches domain (unless skipped), spawns gsd-planner, verifies with gsd-plan-checker, iterates until pass or max iterations.

## Trigger
`/gsd:plan-phase [phase] [--auto] [--research] [--skip-research] [--gaps] [--skip-verify] [--prd <file>]`

## Instructions

```
name: gsd:plan-phase
description: Create detailed phase plan (PLAN.md) with verification loop
argument-hint: "[phase] [--auto] [--research] [--skip-research] [--gaps] [--skip-verify] [--prd <file>]"
agent: gsd-planner
allowed-tools: Read, Write, Bash, Glob, Grep, Task, WebFetch
```

### Objective
Create executable phase prompts (PLAN.md files) for a roadmap phase with integrated research and verification.

**Default flow:** Research (if needed) -> Plan -> Verify -> Done

**Orchestrator role:** Parse arguments, validate phase, research domain (unless skipped), spawn gsd-planner, verify with gsd-plan-checker, iterate until pass or max iterations, present results.

### Context
Phase number: $ARGUMENTS (optional -- auto-detects next unplanned phase if omitted)

**Flags:**
- `--research` -- Force re-research even if RESEARCH.md exists
- `--skip-research` -- Skip research, go straight to planning
- `--gaps` -- Gap closure mode (reads VERIFICATION.md, skips research)
- `--skip-verify` -- Skip verification loop
- `--prd <file>` -- Use a PRD/acceptance criteria file instead of discuss-phase. Parses requirements into CONTEXT.md automatically. Skips discuss-phase entirely.

Normalize phase input in step 2 before any directory lookups.

### Process
Execute the plan-phase workflow end-to-end.
Preserve all workflow gates (validation, research, planning, verification loop, routing).


---

# GSD: Progress

## Description
Check project progress, summarize recent work and what's ahead, then intelligently route to the next action -- either executing an existing plan or creating the next one. Provides situational awareness before continuing work.

## Trigger
`/gsd:progress`

## Instructions

```
name: gsd:progress
description: Check project progress, show context, and route to next action (execute or plan)
allowed-tools: Read, Bash, Grep, Glob, SlashCommand
```

### Objective
Check project progress, summarize recent work and what's ahead, then intelligently route to the next action - either executing an existing plan or creating the next one.

Provides situational awareness before continuing work.

### Execution Context
Loads workflow from `workflows/progress.md`.

### Process
Execute the progress workflow end-to-end.
Preserve all routing logic (Routes A through F) and edge case handling.


---

# GSD: Quick

## Description
Execute small, ad-hoc tasks with GSD guarantees (atomic commits, STATE.md tracking). Quick mode is the same system with a shorter path: spawns gsd-planner (quick mode) + gsd-executor(s). Quick tasks live in `.planning/quick/` separate from planned phases. Updates STATE.md "Quick Tasks Completed" table (NOT ROADMAP.md).

## Trigger
`/gsd:quick [--full]`

**Default:** Skips research, plan-checker, verifier. Use when you know exactly what to do.
**`--full` flag:** Enables plan-checking (max 2 iterations) and post-execution verification. Use when you want quality guarantees without full milestone ceremony.

## Instructions

```
name: gsd:quick
description: Execute a quick task with GSD guarantees (atomic commits, state tracking) but skip optional agents
argument-hint: "[--full]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion
```

### Objective
Execute small, ad-hoc tasks with GSD guarantees (atomic commits, STATE.md tracking).

Quick mode is the same system with a shorter path:
- Spawns gsd-planner (quick mode) + gsd-executor(s)
- Quick tasks live in `.planning/quick/` separate from planned phases
- Updates STATE.md "Quick Tasks Completed" table (NOT ROADMAP.md)

**Default:** Skips research, plan-checker, verifier. Use when you know exactly what to do.

**`--full` flag:** Enables plan-checking (max 2 iterations) and post-execution verification. Use when you want quality guarantees without full milestone ceremony.

### Execution Context
Loads workflow from `workflows/quick.md`.

### Context
$ARGUMENTS

Context files are resolved inside the workflow (`init quick`) and delegated via `<files_to_read>` blocks.

### Process
Execute the quick workflow end-to-end.
Preserve all workflow gates (validation, task description, planning, execution, state updates, commits).


---

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


---

# GSD: Remove Phase

## Description
Remove an unstarted future phase from the roadmap and renumber all subsequent phases to maintain a clean, linear sequence. Clean removal of work you've decided not to do, without polluting context with cancelled/deferred markers.

## Trigger
`/gsd:remove-phase <phase-number>`

## Instructions

```
name: gsd:remove-phase
description: Remove a future phase from roadmap and renumber subsequent phases
argument-hint: <phase-number>
allowed-tools: Read, Write, Bash, Glob
```

### Objective
Remove an unstarted future phase from the roadmap and renumber all subsequent phases to maintain a clean, linear sequence.

Purpose: Clean removal of work you've decided not to do, without polluting context with cancelled/deferred markers.
Output: Phase deleted, all subsequent phases renumbered, git commit as historical record.

### Execution Context
Loads workflow from `workflows/remove-phase.md`.

### Context
Phase: $ARGUMENTS

Roadmap and state are resolved in-workflow via `init phase-op` and targeted reads.

### Process
Execute the remove-phase workflow end-to-end.
Preserve all validation gates (future phase check, work check), renumbering logic, and commit.


---

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


---

# GSD: Resume Work

## Description
Restore complete project context and resume work seamlessly from previous session. Handles STATE.md loading (or reconstruction if missing), checkpoint detection (.continue-here files), incomplete work detection (PLAN without SUMMARY), status presentation, and context-aware next action routing.

## Trigger
`/gsd:resume-work`

## Instructions

```
name: gsd:resume-work
description: Resume work from previous session with full context restoration
allowed-tools: Read, Bash, Write, AskUserQuestion, SlashCommand
```

### Objective
Restore complete project context and resume work seamlessly from previous session.

Routes to the resume-project workflow which handles:
- STATE.md loading (or reconstruction if missing)
- Checkpoint detection (.continue-here files)
- Incomplete work detection (PLAN without SUMMARY)
- Status presentation
- Context-aware next action routing

### Execution Context
Loads workflow from `workflows/resume-project.md`.

### Process
**Follow the resume-project workflow**.

The workflow handles all resumption logic including:
1. Project existence verification
2. STATE.md loading or reconstruction
3. Checkpoint and incomplete work detection
4. Visual status presentation
5. Context-aware option offering (checks CONTEXT.md before suggesting plan vs discuss)
6. Routing to appropriate next command
7. Session continuity updates


---

# GSD: Set Profile

## Description
Switch the model profile used by GSD agents. Controls which Claude model each agent uses, balancing quality vs token spend. Profiles: quality, balanced, budget.

## Trigger
`/gsd:set-profile <profile>`

## Instructions

```
name: gsd:set-profile
description: Switch model profile for GSD agents (quality/balanced/budget)
argument-hint: <profile>
allowed-tools: Read, Write, Bash
```

### Objective
Switch the model profile used by GSD agents. Controls which Claude model each agent uses, balancing quality vs token spend.

Routes to the set-profile workflow which handles:
- Argument validation (quality/balanced/budget)
- Config file creation if missing
- Profile update in config.json
- Confirmation with model table display

### Execution Context
Loads workflow from `workflows/set-profile.md`.

### Process
**Follow the set-profile workflow**.

The workflow handles all logic including:
1. Profile argument validation
2. Config file ensuring
3. Config reading and updating
4. Model table generation from MODEL_PROFILES
5. Confirmation display


---

# GSD: Settings

## Description
Interactive configuration of GSD workflow agents and model profile via multi-question prompt. Configure workflow toggles for model, research, plan_check, verifier, and branching.

## Trigger
`/gsd:settings`

## Instructions

```
name: gsd:settings
description: Configure GSD workflow toggles and model profile
allowed-tools: Read, Write, Bash, AskUserQuestion
```

### Objective
Interactive configuration of GSD workflow agents and model profile via multi-question prompt.

Routes to the settings workflow which handles:
- Config existence ensuring
- Current settings reading and parsing
- Interactive 5-question prompt (model, research, plan_check, verifier, branching)
- Config merging and writing
- Confirmation display with quick command references

### Execution Context
Loads workflow from `workflows/settings.md`.

### Process
**Follow the settings workflow**.

The workflow handles all logic including:
1. Config file creation with defaults if missing
2. Current config reading
3. Interactive settings presentation with pre-selection
4. Answer parsing and config merging
5. File writing
6. Confirmation display


---

# GSD: Update

## Description
Check for GSD updates, install if available, and display what changed. Handles version detection, npm version checking, changelog fetching and display, user confirmation with clean install warning, update execution, and cache clearing.

## Trigger
`/gsd:update`

## Instructions

```
name: gsd:update
description: Update GSD to latest version with changelog display
allowed-tools: Bash, AskUserQuestion
```

### Objective
Check for GSD updates, install if available, and display what changed.

Routes to the update workflow which handles:
- Version detection (local vs global installation)
- npm version checking
- Changelog fetching and display
- User confirmation with clean install warning
- Update execution and cache clearing
- Restart reminder

### Execution Context
Loads workflow from `workflows/update.md`.

### Process
**Follow the update workflow**.

The workflow handles all logic including:
1. Installed version detection (local/global)
2. Latest version checking via npm
3. Version comparison
4. Changelog fetching and extraction
5. Clean install warning display
6. User confirmation
7. Update execution
8. Cache clearing


---

# GSD: Verify Work

## Description
Validate built features through conversational UAT (User Acceptance Testing) with persistent state. Confirms what Claude built actually works from user's perspective. One test at a time, plain text responses, no interrogation. When issues are found, automatically diagnoses, plans fixes, and prepares for execution.

## Trigger
`/gsd:verify-work [phase number, e.g., '4']`

## Instructions

```
name: gsd:verify-work
description: Validate built features through conversational UAT
argument-hint: "[phase number, e.g., '4']"
allowed-tools: Read, Bash, Glob, Grep, Edit, Write, Task
```

### Objective
Validate built features through conversational testing with persistent state.

Purpose: Confirm what Claude built actually works from user's perspective. One test at a time, plain text responses, no interrogation. When issues are found, automatically diagnose, plan fixes, and prepare for execution.

Output: {phase_num}-UAT.md tracking all test results. If issues found: diagnosed gaps, verified fix plans ready for /gsd:execute-phase

### Execution Context
Loads:
- `workflows/verify-work.md`
- `templates/UAT.md`

### Context
Phase: $ARGUMENTS (optional)
- If provided: Test specific phase (e.g., "4")
- If not provided: Check for active sessions or prompt for phase

Context files are resolved inside the workflow (`init verify-work`) and delegated via `<files_to_read>` blocks.

### Process
Execute the verify-work workflow end-to-end.
Preserve all workflow gates (session management, test presentation, diagnosis, fix planning, routing).


# ==============================================
# CATEGORY 2: CUSTOM SKILLS (4 skills)
# ==============================================

---

# Analyzing Financial Statements

## Description
Calculates key financial ratios and metrics from financial statement data for investment analysis. Provides comprehensive financial ratio analysis for evaluating company performance, profitability, liquidity, and valuation.

## Trigger
When asked to analyze financial statements, calculate financial ratios, or evaluate company financial performance.

## Instructions

# Financial Ratio Calculator Skill

This skill provides comprehensive financial ratio analysis for evaluating company performance, profitability, liquidity, and valuation.

## Capabilities

Calculate and interpret:
- **Profitability Ratios**: ROE, ROA, Gross Margin, Operating Margin, Net Margin
- **Liquidity Ratios**: Current Ratio, Quick Ratio, Cash Ratio
- **Leverage Ratios**: Debt-to-Equity, Interest Coverage, Debt Service Coverage
- **Efficiency Ratios**: Asset Turnover, Inventory Turnover, Receivables Turnover
- **Valuation Ratios**: P/E, P/B, P/S, EV/EBITDA, PEG
- **Per-Share Metrics**: EPS, Book Value per Share, Dividend per Share

## How to Use

1. **Input Data**: Provide financial statement data (income statement, balance sheet, cash flow)
2. **Select Ratios**: Specify which ratios to calculate or use "all" for comprehensive analysis
3. **Interpretation**: The skill will calculate ratios and provide industry-standard interpretations

## Input Format

Financial data can be provided as:
- CSV with financial line items
- JSON with structured financial statements
- Text description of key financial figures
- Excel files with financial statements

## Output Format

Results include:
- Calculated ratios with values
- Industry benchmark comparisons (when available)
- Trend analysis (if multiple periods provided)
- Interpretation and insights
- Excel report with formatted results

## Example Usage

"Calculate key financial ratios for this company based on the attached financial statements"

"What's the P/E ratio if the stock price is $50 and annual earnings are $2.50 per share?"

"Analyze the liquidity position using the balance sheet data"

## Scripts

- `calculate_ratios.py`: Main calculation engine for all financial ratios
- `interpret_ratios.py`: Provides interpretation and benchmarking

## Best Practices

1. Always validate data completeness before calculations
2. Handle missing values appropriately (use industry averages or exclude)
3. Consider industry context when interpreting ratios
4. Include period comparisons for trend analysis
5. Flag unusual or concerning ratios

## Limitations

- Requires accurate financial data
- Industry benchmarks are general guidelines
- Some ratios may not apply to all industries
- Historical data doesn't guarantee future performance


---

# Applying Brand Guidelines

## Description
Applies consistent corporate branding and styling to all generated documents including colors, fonts, layouts, and messaging.

## Trigger
When creating documents that need corporate branding, or when asked to apply brand guidelines to any output.

## Instructions

# Corporate Brand Guidelines Skill

This skill ensures all generated documents adhere to corporate brand standards for consistent, professional communication.

## Brand Identity

### Company: Acme Corporation
**Tagline**: "Innovation Through Excellence"
**Industry**: Technology Solutions

## Visual Standards

### Color Palette

**Primary Colors**:
- **Acme Blue**: #0066CC (RGB: 0, 102, 204) - Headers, primary buttons
- **Acme Navy**: #003366 (RGB: 0, 51, 102) - Text, accents
- **White**: #FFFFFF - Backgrounds, reverse text

**Secondary Colors**:
- **Success Green**: #28A745 (RGB: 40, 167, 69) - Positive metrics
- **Warning Amber**: #FFC107 (RGB: 255, 193, 7) - Cautions
- **Error Red**: #DC3545 (RGB: 220, 53, 69) - Negative values
- **Neutral Gray**: #6C757D (RGB: 108, 117, 125) - Secondary text

### Typography

**Primary Font Family**: Segoe UI, system-ui, -apple-system, sans-serif

**Font Hierarchy**:
- **H1**: 32pt, Bold, Acme Blue
- **H2**: 24pt, Semibold, Acme Navy
- **H3**: 18pt, Semibold, Acme Navy
- **Body**: 11pt, Regular, Acme Navy
- **Caption**: 9pt, Regular, Neutral Gray

### Logo Usage

- Position: Top-left corner on first page/slide
- Size: 120px width (maintain aspect ratio)
- Clear space: Minimum 20px padding on all sides
- Never distort, rotate, or apply effects

## Document Standards

### PowerPoint Presentations

**Slide Templates**:
1. **Title Slide**: Company logo, presentation title, date, presenter
2. **Section Divider**: Section title with blue background
3. **Content Slide**: Title bar with blue background, white content area
4. **Data Slide**: For charts/graphs, maintain color palette

**Layout Rules**:
- Margins: 0.5 inches all sides
- Title position: Top 15% of slide
- Bullet indentation: 0.25 inches per level
- Maximum 6 bullet points per slide
- Charts use brand colors exclusively

### Excel Spreadsheets

**Formatting Standards**:
- **Headers**: Row 1, Bold, White text on Acme Blue background
- **Subheaders**: Bold, Acme Navy text
- **Data cells**: Regular, Acme Navy text
- **Borders**: Thin, Neutral Gray
- **Alternating rows**: Light gray (#F8F9FA) for readability

**Chart Defaults**:
- Primary series: Acme Blue
- Secondary series: Success Green
- Gridlines: Neutral Gray, 0.5pt
- No 3D effects or gradients

### PDF Documents

**Page Layout**:
- **Header**: Company logo left, document title center, page number right
- **Footer**: Copyright notice left, date center, classification right
- **Margins**: 1 inch all sides
- **Line spacing**: 1.15
- **Paragraph spacing**: 12pt after

**Section Formatting**:
- Main headings: Acme Blue, 16pt, bold
- Subheadings: Acme Navy, 14pt, semibold
- Body text: Acme Navy, 11pt, regular

## Content Guidelines

### Tone of Voice

- **Professional**: Formal but approachable
- **Clear**: Avoid jargon, use simple language
- **Active**: Use active voice, action-oriented
- **Positive**: Focus on solutions and benefits

### Standard Phrases

**Opening Statements**:
- "At Acme Corporation, we..."
- "Our commitment to innovation..."
- "Delivering excellence through..."

**Closing Statements**:
- "Thank you for your continued partnership."
- "We look forward to serving your needs."
- "Together, we achieve excellence."

### Data Presentation

**Numbers**:
- Use comma separators for thousands
- Currency: $X,XXX.XX format
- Percentages: XX.X% (one decimal)
- Dates: Month DD, YYYY

**Tables**:
- Headers in brand blue
- Alternating row colors
- Right-align numbers
- Left-align text

## Quality Standards

### Before Finalizing

Always ensure:
1. Logo is properly placed and sized
2. All colors match brand palette exactly
3. Fonts are consistent throughout
4. No typos or grammatical errors
5. Data is accurately presented
6. Professional tone maintained

### Prohibited Elements

Never use:
- Clip art or stock photos without approval
- Comic Sans, Papyrus, or decorative fonts
- Rainbow colors or gradients
- Animations or transitions (unless specified)
- Competitor branding or references

## Application Instructions

When creating any document:
1. Start with brand colors and fonts
2. Apply appropriate template structure
3. Include logo on first page/slide
4. Use consistent formatting throughout
5. Review against brand standards
6. Ensure professional appearance

## Scripts

- `apply_brand.py`: Automatically applies brand formatting to documents
- `validate_brand.py`: Checks documents for brand compliance

## Notes

- These guidelines apply to all external communications
- Internal documents may use simplified formatting
- Special projects may have exceptions (request approval)
- Brand guidelines updated quarterly - check for latest version


---

# Creating Financial Models

## Description
Advanced financial modeling suite with DCF analysis, sensitivity testing, Monte Carlo simulations, and scenario planning for investment decisions.

## Trigger
When asked to build financial models, DCF analysis, sensitivity testing, Monte Carlo simulations, or scenario planning for investment decisions.

## Instructions

# Financial Modeling Suite

A comprehensive financial modeling toolkit for investment analysis, valuation, and risk assessment using industry-standard methodologies.

## Core Capabilities

### 1. Discounted Cash Flow (DCF) Analysis
- Build complete DCF models with multiple growth scenarios
- Calculate terminal values using perpetuity growth and exit multiple methods
- Determine weighted average cost of capital (WACC)
- Generate enterprise and equity valuations

### 2. Sensitivity Analysis
- Test key assumptions impact on valuation
- Create data tables for multiple variables
- Generate tornado charts for sensitivity ranking
- Identify critical value drivers

### 3. Monte Carlo Simulation
- Run thousands of scenarios with probability distributions
- Model uncertainty in key inputs
- Generate confidence intervals for valuations
- Calculate probability of achieving targets

### 4. Scenario Planning
- Build best/base/worst case scenarios
- Model different economic environments
- Test strategic alternatives
- Compare outcome probabilities

## Input Requirements

### For DCF Analysis
- Historical financial statements (3-5 years)
- Revenue growth assumptions
- Operating margin projections
- Capital expenditure forecasts
- Working capital requirements
- Terminal growth rate or exit multiple
- Discount rate components (risk-free rate, beta, market premium)

### For Sensitivity Analysis
- Base case model
- Variable ranges to test
- Key metrics to track

### For Monte Carlo Simulation
- Probability distributions for uncertain variables
- Correlation assumptions between variables
- Number of iterations (typically 1,000-10,000)

### For Scenario Planning
- Scenario definitions and assumptions
- Probability weights for scenarios
- Key performance indicators to track

## Output Formats

### DCF Model Output
- Complete financial projections
- Free cash flow calculations
- Terminal value computation
- Enterprise and equity value summary
- Valuation multiples implied
- Excel workbook with full model

### Sensitivity Analysis Output
- Sensitivity tables showing value ranges
- Tornado chart of key drivers
- Break-even analysis
- Charts showing relationships

### Monte Carlo Output
- Probability distribution of valuations
- Confidence intervals (e.g., 90%, 95%)
- Statistical summary (mean, median, std dev)
- Risk metrics (VaR, probability of loss)

### Scenario Planning Output
- Scenario comparison table
- Probability-weighted expected values
- Decision tree visualization
- Risk-return profiles

## Model Types Supported

1. **Corporate Valuation**
   - Mature companies with stable cash flows
   - Growth companies with J-curve projections
   - Turnaround situations

2. **Project Finance**
   - Infrastructure projects
   - Real estate developments
   - Energy projects

3. **M&A Analysis**
   - Acquisition valuations
   - Synergy modeling
   - Accretion/dilution analysis

4. **LBO Models**
   - Leveraged buyout analysis
   - Returns analysis (IRR, MOIC)
   - Debt capacity assessment

## Best Practices Applied

### Modeling Standards
- Consistent formatting and structure
- Clear assumption documentation
- Separation of inputs, calculations, outputs
- Error checking and validation
- Version control and change tracking

### Valuation Principles
- Use multiple valuation methods for triangulation
- Apply appropriate risk adjustments
- Consider market comparables
- Validate against trading multiples
- Document key assumptions clearly

### Risk Management
- Identify and quantify key risks
- Use probability-weighted scenarios
- Stress test extreme cases
- Consider correlation effects
- Provide confidence intervals

## Example Usage

"Build a DCF model for this technology company using the attached financials"

"Run a Monte Carlo simulation on this acquisition model with 5,000 iterations"

"Create sensitivity analysis showing impact of growth rate and WACC on valuation"

"Develop three scenarios for this expansion project with probability weights"

## Scripts Included

- `dcf_model.py`: Complete DCF valuation engine
- `sensitivity_analysis.py`: Sensitivity testing framework

## Limitations and Disclaimers

- Models are only as good as their assumptions
- Past performance doesn't guarantee future results
- Market conditions can change rapidly
- Regulatory and tax changes may impact results
- Professional judgment required for interpretation
- Not a substitute for professional financial advice

## Quality Checks

The model automatically performs:
1. Balance sheet balancing checks
2. Cash flow reconciliation
3. Circular reference resolution
4. Sensitivity bound checking
5. Statistical validation of Monte Carlo results

## Updates and Maintenance

- Models use latest financial theory and practices
- Regular updates for market parameter defaults
- Incorporation of regulatory changes
- Continuous improvement based on usage patterns


---

# UI/UX Pro Max

## Description
UI/UX design intelligence. 50 styles, 21 palettes, 50 font pairings, 20 charts, 9 stacks (React, Next.js, Vue, Svelte, SwiftUI, React Native, Flutter, Tailwind, shadcn/ui). Actions: plan, build, create, design, implement, review, fix, improve, optimize, enhance, refactor, check UI/UX code.

## Trigger
When designing UI components, choosing color palettes, reviewing code for UX issues, building landing pages or dashboards, or implementing accessibility requirements.

## Instructions

# UI/UX Pro Max - Design Intelligence

Comprehensive design guide for web and mobile applications. Contains 50+ styles, 97 color palettes, 57 font pairings, 99 UX guidelines, and 25 chart types across 9 technology stacks. Searchable database with priority-based recommendations.

## When to Apply

Reference these guidelines when:
- Designing new UI components or pages
- Choosing color palettes and typography
- Reviewing code for UX issues
- Building landing pages or dashboards
- Implementing accessibility requirements

## Rule Categories by Priority

| Priority | Category | Impact | Domain |
|----------|----------|--------|--------|
| 1 | Accessibility | CRITICAL | `ux` |
| 2 | Touch & Interaction | CRITICAL | `ux` |
| 3 | Performance | HIGH | `ux` |
| 4 | Layout & Responsive | HIGH | `ux` |
| 5 | Typography & Color | MEDIUM | `typography`, `color` |
| 6 | Animation | MEDIUM | `ux` |
| 7 | Style Selection | MEDIUM | `style`, `product` |
| 8 | Charts & Data | LOW | `chart` |

## Quick Reference

### 1. Accessibility (CRITICAL)

- `color-contrast` - Minimum 4.5:1 ratio for normal text
- `focus-states` - Visible focus rings on interactive elements
- `alt-text` - Descriptive alt text for meaningful images
- `aria-labels` - aria-label for icon-only buttons
- `keyboard-nav` - Tab order matches visual order
- `form-labels` - Use label with for attribute

### 2. Touch & Interaction (CRITICAL)

- `touch-target-size` - Minimum 44x44px touch targets
- `hover-vs-tap` - Use click/tap for primary interactions
- `loading-buttons` - Disable button during async operations
- `error-feedback` - Clear error messages near problem
- `cursor-pointer` - Add cursor-pointer to clickable elements

### 3. Performance (HIGH)

- `image-optimization` - Use WebP, srcset, lazy loading
- `reduced-motion` - Check prefers-reduced-motion
- `content-jumping` - Reserve space for async content

### 4. Layout & Responsive (HIGH)

- `viewport-meta` - width=device-width initial-scale=1
- `readable-font-size` - Minimum 16px body text on mobile
- `horizontal-scroll` - Ensure content fits viewport width
- `z-index-management` - Define z-index scale (10, 20, 30, 50)

### 5. Typography & Color (MEDIUM)

- `line-height` - Use 1.5-1.75 for body text
- `line-length` - Limit to 65-75 characters per line
- `font-pairing` - Match heading/body font personalities

### 6. Animation (MEDIUM)

- `duration-timing` - Use 150-300ms for micro-interactions
- `transform-performance` - Use transform/opacity, not width/height
- `loading-states` - Skeleton screens or spinners

### 7. Style Selection (MEDIUM)

- `style-match` - Match style to product type
- `consistency` - Use same style across all pages
- `no-emoji-icons` - Use SVG icons, not emojis

### 8. Charts & Data (LOW)

- `chart-type` - Match chart type to data type
- `color-guidance` - Use accessible color palettes
- `data-table` - Provide table alternative for accessibility

## How to Use

### Step 1: Analyze User Requirements

Extract key information from user request:
- **Product type**: SaaS, e-commerce, portfolio, dashboard, landing page, etc.
- **Style keywords**: minimal, playful, professional, elegant, dark mode, etc.
- **Industry**: healthcare, fintech, gaming, education, etc.
- **Stack**: React, Vue, Next.js, or default to `html-tailwind`

### Step 2: Generate Design System (REQUIRED)

**Always start with `--design-system`** to get comprehensive recommendations with reasoning:

```bash
python3 ~/.claude/skills/skills/custom_skills/ui-ux-pro-max/scripts/search.py "<product_type> <industry> <keywords>" --design-system [-p "Project Name"]
```

This command:
1. Searches 5 domains in parallel (product, style, color, landing, typography)
2. Applies reasoning rules from `ui-reasoning.csv` to select best matches
3. Returns complete design system: pattern, style, colors, typography, effects
4. Includes anti-patterns to avoid

### Step 2b: Persist Design System (Master + Overrides Pattern)

To save the design system for hierarchical retrieval across sessions, add `--persist`:

```bash
python3 ~/.claude/skills/skills/custom_skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "Project Name"
```

This creates:
- `design-system/MASTER.md` -- Global Source of Truth with all design rules
- `design-system/pages/` -- Folder for page-specific overrides

**With page-specific override:**
```bash
python3 ~/.claude/skills/skills/custom_skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "Project Name" --page "dashboard"
```

**How hierarchical retrieval works:**
1. When building a specific page, first check `design-system/pages/<page>.md`
2. If the page file exists, its rules **override** the Master file
3. If not, use `design-system/MASTER.md` exclusively

### Step 3: Supplement with Detailed Searches (as needed)

```bash
python3 ~/.claude/skills/skills/custom_skills/ui-ux-pro-max/scripts/search.py "<keyword>" --domain <domain> [-n <max_results>]
```

| Need | Domain | Example |
|------|--------|---------|
| More style options | `style` | `--domain style "glassmorphism dark"` |
| Chart recommendations | `chart` | `--domain chart "real-time dashboard"` |
| UX best practices | `ux` | `--domain ux "animation accessibility"` |
| Alternative fonts | `typography` | `--domain typography "elegant luxury"` |
| Landing structure | `landing` | `--domain landing "hero social-proof"` |

### Step 4: Stack Guidelines (Default: html-tailwind)

```bash
python3 ~/.claude/skills/skills/custom_skills/ui-ux-pro-max/scripts/search.py "<keyword>" --stack html-tailwind
```

Available stacks: `html-tailwind`, `react`, `nextjs`, `vue`, `svelte`, `swiftui`, `react-native`, `flutter`, `shadcn`, `jetpack-compose`

## Available Domains

| Domain | Use For | Example Keywords |
|--------|---------|------------------|
| `product` | Product type recommendations | SaaS, e-commerce, portfolio, healthcare, beauty, service |
| `style` | UI styles, colors, effects | glassmorphism, minimalism, dark mode, brutalism |
| `typography` | Font pairings, Google Fonts | elegant, playful, professional, modern |
| `color` | Color palettes by product type | saas, ecommerce, healthcare, beauty, fintech, service |
| `landing` | Page structure, CTA strategies | hero, hero-centric, testimonial, pricing, social-proof |
| `chart` | Chart types, library recommendations | trend, comparison, timeline, funnel, pie |
| `ux` | Best practices, anti-patterns | animation, accessibility, z-index, loading |
| `react` | React/Next.js performance | waterfall, bundle, suspense, memo, rerender, cache |
| `web` | Web interface guidelines | aria, focus, keyboard, semantic, virtualize |
| `prompt` | AI prompts, CSS keywords | (style name) |

## Common Rules for Professional UI

### Icons & Visual Elements

| Rule | Do | Don't |
|------|----|----- |
| **No emoji icons** | Use SVG icons (Heroicons, Lucide, Simple Icons) | Use emojis as UI icons |
| **Stable hover states** | Use color/opacity transitions on hover | Use scale transforms that shift layout |
| **Correct brand logos** | Research official SVG from Simple Icons | Guess or use incorrect logo paths |
| **Consistent icon sizing** | Use fixed viewBox (24x24) with w-6 h-6 | Mix different icon sizes randomly |

### Interaction & Cursor

| Rule | Do | Don't |
|------|----|----- |
| **Cursor pointer** | Add `cursor-pointer` to all clickable/hoverable cards | Leave default cursor on interactive elements |
| **Hover feedback** | Provide visual feedback (color, shadow, border) | No indication element is interactive |
| **Smooth transitions** | Use `transition-colors duration-200` | Instant state changes or too slow (>500ms) |

### Light/Dark Mode Contrast

| Rule | Do | Don't |
|------|----|----- |
| **Glass card light mode** | Use `bg-white/80` or higher opacity | Use `bg-white/10` (too transparent) |
| **Text contrast light** | Use `#0F172A` (slate-900) for text | Use `#94A3B8` (slate-400) for body text |
| **Muted text light** | Use `#475569` (slate-600) minimum | Use gray-400 or lighter |
| **Border visibility** | Use `border-gray-200` in light mode | Use `border-white/10` (invisible) |

### Layout & Spacing

| Rule | Do | Don't |
|------|----|----- |
| **Floating navbar** | Add `top-4 left-4 right-4` spacing | Stick navbar to `top-0 left-0 right-0` |
| **Content padding** | Account for fixed navbar height | Let content hide behind fixed elements |
| **Consistent max-width** | Use same `max-w-6xl` or `max-w-7xl` | Mix different container widths |

## Pre-Delivery Checklist

### Visual Quality
- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] Brand logos are correct (verified from Simple Icons)
- [ ] Hover states don't cause layout shift
- [ ] Use theme colors directly (bg-primary) not var() wrapper

### Interaction
- [ ] All clickable elements have `cursor-pointer`
- [ ] Hover states provide clear visual feedback
- [ ] Transitions are smooth (150-300ms)
- [ ] Focus states visible for keyboard navigation

### Light/Dark Mode
- [ ] Light mode text has sufficient contrast (4.5:1 minimum)
- [ ] Glass/transparent elements visible in light mode
- [ ] Borders visible in both modes
- [ ] Test both modes before delivery

### Layout
- [ ] Floating elements have proper spacing from edges
- [ ] No content hidden behind fixed navbars
- [ ] Responsive at 375px, 768px, 1024px, 1440px
- [ ] No horizontal scroll on mobile

### Accessibility
- [ ] All images have alt text
- [ ] Form inputs have labels
- [ ] Color is not the only indicator
- [ ] `prefers-reduced-motion` respected


# ==============================================
# CATEGORY 3: PROJECT SKILLS (7 skills)
# ==============================================

---

# Awesome Claude Code

## Description
Curated knowledge base of Claude Code ecosystem resources, plus repository evaluation for security and quality assessment. Reference database of community tools and best practices including agent skills, workflows, tooling, hooks, slash commands, CLAUDE.md files, and alternative clients.

## Trigger
When evaluating Claude Code skills/plugins before installing, finding recommended tools for workflows, checking if community solutions exist, or performing security reviews of third-party extensions.

## Instructions

# Awesome Claude Code Skill

A curated knowledge base of Claude Code slash-commands, CLAUDE.md files, CLI tools, agent skills, and ecosystem resources. Also includes a repository evaluation framework for assessing third-party Claude Code extensions.

## Capabilities

### 1. Claude Code Ecosystem Knowledge
Reference database of community tools and best practices:
- **Agent Skills** -- Specialized task automation (DevOps, security, full-stack, publishing)
- **Workflows & Knowledge Guides** -- Engineering patterns and context engineering
- **Tooling** -- IDE integrations, usage monitors, orchestrators, config managers
- **Status Lines** -- Custom status line configurations
- **Hooks** -- Lifecycle hooks for automation
- **Slash Commands** -- Git, testing, context loading, documentation, CI/CD, project management
- **CLAUDE.md Files** -- Language-specific and domain-specific configurations
- **Alternative Clients** -- Non-standard interfaces to Claude Code

### 2. Repository Evaluation
Static, read-only security and quality assessment of Claude Code repositories:

**Evaluation Criteria (scored 1-10 each):**
- Code Quality -- structure, readability, correctness
- Security & Safety -- implicit execution, file/network access, credential handling
- Documentation & Transparency -- accuracy, side effect disclosure
- Functionality & Scope -- does it do what it claims?
- Repository Hygiene -- maintenance, licensing, publication quality

**Claude-Code-Specific Security Checklist:**
- Hooks that execute shell scripts
- Commands invoking external tools
- Persistent state files controlling execution
- Implicit execution without confirmation
- Safe defaults and disable mechanisms

**Output:** Overall score (X/10) with recommendation: Recommend / Recommend with caveats / Needs manual review / Reject

## When to Use

- Evaluating a new Claude Code skill/plugin before installing
- Finding recommended tools for a specific workflow need
- Checking if a community solution exists before building custom
- Security review of third-party Claude Code extensions
- Understanding Claude Code ecosystem best practices

## Example Usage

"Evaluate this repository for security before I install it as a skill"

"What Claude Code tools exist for CI/CD automation?"

"Find community slash commands for git workflow management"

"Is there an existing skill for database management?"

## Source

Based on [awesome-claude-code](https://github.com/cognitivetech/awesome-claude-code) -- the community-curated awesome list for the Claude Code ecosystem.


---

# Brand Guidelines (Project Skill)

## Description
Applies consistent corporate branding and styling to all generated documents including colors, fonts, layouts, and messaging. Project-level instance of the brand guidelines skill.

## Trigger
When creating branded documents or applying corporate styling within a project context.

## Instructions

# Corporate Brand Guidelines Skill

This skill ensures all generated documents adhere to corporate brand standards for consistent, professional communication.

## Brand Identity

### Company: Acme Corporation
**Tagline**: "Innovation Through Excellence"
**Industry**: Technology Solutions

## Visual Standards

### Color Palette

**Primary Colors**:
- **Acme Blue**: #0066CC (RGB: 0, 102, 204) - Headers, primary buttons
- **Acme Navy**: #003366 (RGB: 0, 51, 102) - Text, accents
- **White**: #FFFFFF - Backgrounds, reverse text

**Secondary Colors**:
- **Success Green**: #28A745 (RGB: 40, 167, 69) - Positive metrics
- **Warning Amber**: #FFC107 (RGB: 255, 193, 7) - Cautions
- **Error Red**: #DC3545 (RGB: 220, 53, 69) - Negative values
- **Neutral Gray**: #6C757D (RGB: 108, 117, 125) - Secondary text

### Typography

**Primary Font Family**: Segoe UI, system-ui, -apple-system, sans-serif

**Font Hierarchy**:
- **H1**: 32pt, Bold, Acme Blue
- **H2**: 24pt, Semibold, Acme Navy
- **H3**: 18pt, Semibold, Acme Navy
- **Body**: 11pt, Regular, Acme Navy
- **Caption**: 9pt, Regular, Neutral Gray

### Logo Usage

- Position: Top-left corner on first page/slide
- Size: 120px width (maintain aspect ratio)
- Clear space: Minimum 20px padding on all sides
- Never distort, rotate, or apply effects

## Document Standards

### PowerPoint: Title Slide, Section Divider, Content Slide, Data Slide
### Excel: Headers (bold white on blue), alternating rows, brand color charts
### PDF: Logo header, copyright footer, 1-inch margins, 1.15 line spacing

## Content Guidelines

### Tone: Professional, Clear, Active, Positive
### Numbers: Comma separators, $X,XXX.XX currency, XX.X% percentages, Month DD YYYY dates
### Tables: Brand blue headers, alternating rows, right-align numbers

## Application Instructions

1. Start with brand colors and fonts
2. Apply appropriate template structure
3. Include logo on first page/slide
4. Use consistent formatting throughout
5. Review against brand standards
6. Ensure professional appearance


---

# Cookbook Audit

## Description
Audit an Anthropic Cookbook notebook based on a rubric. Provides scoring across narrative quality, code quality, technical accuracy, and actionability. Use whenever a notebook review or audit is requested.

## Trigger
When asked to review or audit an Anthropic Cookbook notebook.

## Instructions

# Cookbook Audit

## Workflow

1. **Read the style guide**: First review `style_guide.md` to understand current best practices
2. **Identify the notebook**: Ask user for path if not provided
3. **Run automated checks**: Use `python3 validate_notebook.py <path>` to catch technical issues and generate markdown
   - The script automatically runs detect-secrets to scan for hardcoded API keys and credentials
4. **Review markdown output**: The script generates a markdown file in the `tmp/` folder for easier review
5. **Manual review**: Read through the markdown version evaluating against style guide and rubric
6. **Score each dimension**: Apply scoring guidelines objectively
7. **Generate report**: Follow the audit report format below
8. **Provide specific examples**: Show concrete improvements with line references

## Audit Report Format

### Executive Summary
- **Overall Score**: X/20
- **Key Strengths** (2-3 bullet points)
- **Critical Issues** (2-3 bullet points)

### Detailed Scoring

#### 1. Narrative Quality: X/5
[Brief justification with specific examples]

#### 2. Code Quality: X/5
[Brief justification with specific examples]

#### 3. Technical Accuracy: X/5
[Brief justification with specific examples]

#### 4. Actionability & Understanding: X/5
[Brief justification with specific examples]

### Specific Recommendations
[Prioritized, actionable list of improvements]

### Examples & Suggestions
[Specific excerpts with concrete suggestions]

## Quick Reference Checklist

**Introduction** (See style_guide.md Section 1)
- [ ] Hooks with the problem being solved (1-2 sentences)
- [ ] Explains why it matters (1-2 sentences)
- [ ] Lists learning objectives as bullet points (2-4 TLOs/ELOs)
- [ ] Focuses on value delivered, not machinery built

**Prerequisites & Setup** (See style_guide.md Section 2)
- [ ] Lists required knowledge clearly
- [ ] Uses %%capture for pip install to suppress output
- [ ] Uses dotenv.load_dotenv() not os.environ
- [ ] Defines MODEL constant at top
- [ ] Groups related installs in single command

**Structure & Organization**
- [ ] Has logical section progression
- [ ] Code blocks have explanatory text before them
- [ ] Includes what we learned after code blocks

**Conclusion** (See style_guide.md Section 4)
- [ ] Maps back to learning objectives
- [ ] Suggests ways to apply lessons to user's context
- [ ] Points to next steps or related resources

**Code Quality**
- [ ] No hardcoded API keys (automatically checked by detect-secrets)
- [ ] Meaningful variable names
- [ ] Comments explain "why" not "what"
- [ ] Model name defined as constant at top of notebook

**Technical Requirements**
- [ ] Executable without modification (except API keys)
- [ ] Uses non-deprecated API patterns
- [ ] Uses valid model names (claude-sonnet-4-6, claude-haiku-4-5, claude-opus-4-6)
- [ ] Uses non-dated model aliases

### Content Philosophy: Action + Understanding

Cookbooks are primarily action-oriented but strategically incorporate understanding. Core principles:
- **Practical focus**: Show users how to accomplish specific tasks with working code
- **Problem-first framing**: Lead with the problem being solved and value delivered
- **Builder's perspective**: Written from the user's point of view
- **Agency-building**: Help users understand why approaches work, not just how
- **Transferable knowledge**: Teach patterns that apply beyond the specific example
- **Critical thinking**: Encourage users to question outputs and make informed choices
- **Learning contracts**: State learning objectives upfront, map back in conclusions

### Common Anti-Patterns to Flag

**Introduction**: Leading with machinery, feature dumps, vague learning objectives
**Setup**: Noisy pip output, multiple separate installs, using os.environ, hardcoding model names
**Code**: Code blocks without explanatory text, no post-execution explanation
**Conclusion**: Generic summaries, not mapping back to learning objectives


---

# Financial Models (Project Skill)

## Description
Advanced financial modeling suite with DCF analysis, sensitivity testing, Monte Carlo simulations, and scenario planning for investment decisions. Project-level instance of the financial modeling skill.

## Trigger
When asked to build financial models, DCF analysis, sensitivity testing, Monte Carlo simulations, or scenario planning within a project context.

## Instructions

# Financial Modeling Suite

A comprehensive financial modeling toolkit for investment analysis, valuation, and risk assessment using industry-standard methodologies.

## Core Capabilities

### 1. Discounted Cash Flow (DCF) Analysis
- Build complete DCF models with multiple growth scenarios
- Calculate terminal values using perpetuity growth and exit multiple methods
- Determine weighted average cost of capital (WACC)
- Generate enterprise and equity valuations

### 2. Sensitivity Analysis
- Test key assumptions impact on valuation
- Create data tables for multiple variables
- Generate tornado charts for sensitivity ranking
- Identify critical value drivers

### 3. Monte Carlo Simulation
- Run thousands of scenarios with probability distributions
- Model uncertainty in key inputs
- Generate confidence intervals for valuations
- Calculate probability of achieving targets

### 4. Scenario Planning
- Build best/base/worst case scenarios
- Model different economic environments
- Test strategic alternatives
- Compare outcome probabilities

## Model Types Supported

1. **Corporate Valuation** - Mature, growth, turnaround
2. **Project Finance** - Infrastructure, real estate, energy
3. **M&A Analysis** - Acquisition valuations, synergy modeling, accretion/dilution
4. **LBO Models** - Leveraged buyout, returns analysis (IRR, MOIC), debt capacity

## Best Practices

- Use multiple valuation methods for triangulation
- Apply appropriate risk adjustments
- Consider market comparables
- Validate against trading multiples
- Document key assumptions clearly
- Identify and quantify key risks
- Stress test extreme cases

## Quality Checks

1. Balance sheet balancing checks
2. Cash flow reconciliation
3. Circular reference resolution
4. Sensitivity bound checking
5. Statistical validation of Monte Carlo results


---

# Financial Statements (Project Skill)

## Description
Calculates key financial ratios and metrics from financial statement data for investment analysis. Project-level instance of the financial ratio calculator skill.

## Trigger
When asked to analyze financial statements, calculate financial ratios, or evaluate company financial performance within a project context.

## Instructions

# Financial Ratio Calculator Skill

This skill provides comprehensive financial ratio analysis for evaluating company performance, profitability, liquidity, and valuation.

## Capabilities

Calculate and interpret:
- **Profitability Ratios**: ROE, ROA, Gross Margin, Operating Margin, Net Margin
- **Liquidity Ratios**: Current Ratio, Quick Ratio, Cash Ratio
- **Leverage Ratios**: Debt-to-Equity, Interest Coverage, Debt Service Coverage
- **Efficiency Ratios**: Asset Turnover, Inventory Turnover, Receivables Turnover
- **Valuation Ratios**: P/E, P/B, P/S, EV/EBITDA, PEG
- **Per-Share Metrics**: EPS, Book Value per Share, Dividend per Share

## How to Use

1. **Input Data**: Provide financial statement data (income statement, balance sheet, cash flow)
2. **Select Ratios**: Specify which ratios to calculate or use "all" for comprehensive analysis
3. **Interpretation**: The skill will calculate ratios and provide industry-standard interpretations

## Input Format

Financial data can be provided as:
- CSV with financial line items
- JSON with structured financial statements
- Text description of key financial figures
- Excel files with financial statements

## Output Format

Results include:
- Calculated ratios with values
- Industry benchmark comparisons (when available)
- Trend analysis (if multiple periods provided)
- Interpretation and insights
- Excel report with formatted results

## Example Usage

"Calculate key financial ratios for this company based on the attached financial statements"

"What's the P/E ratio if the stock price is $50 and annual earnings are $2.50 per share?"

"Analyze the liquidity position using the balance sheet data"

## Scripts

- `calculate_ratios.py`: Main calculation engine for all financial ratios
- `interpret_ratios.py`: Provides interpretation and benchmarking

## Best Practices

1. Always validate data completeness before calculations
2. Handle missing values appropriately (use industry averages or exclude)
3. Consider industry context when interpreting ratios
4. Include period comparisons for trend analysis
5. Flag unusual or concerning ratios

## Limitations

- Requires accurate financial data
- Industry benchmarks are general guidelines
- Some ratios may not apply to all industries
- Historical data doesn't guarantee future performance


---

# n8n MCP

## Description
Comprehensive documentation and knowledge server that provides AI assistants with complete access to n8n node information through the Model Context Protocol (MCP). Serves as a bridge between n8n's workflow automation platform and AI models.

## Trigger
When working with n8n workflow automation, MCP server development, or node information retrieval.

## Instructions

# n8n-mcp Project Guide

## Project Overview

n8n-mcp is a comprehensive documentation and knowledge server that provides AI assistants with complete access to n8n node information through the Model Context Protocol (MCP). It serves as a bridge between n8n's workflow automation platform and AI models, enabling them to understand and work with n8n nodes effectively.

### Current Architecture:
```
src/
├── loaders/
│   └── node-loader.ts         # NPM package loader for both packages
├── parsers/
│   ├── node-parser.ts         # Enhanced parser with version support
│   └── property-extractor.ts  # Dedicated property/operation extraction
├── mappers/
│   └── docs-mapper.ts         # Documentation mapping with fixes
├── database/
│   ├── schema.sql             # SQLite schema
│   ├── node-repository.ts     # Data access layer
│   └── database-adapter.ts    # Universal database adapter
├── services/
│   ├── property-filter.ts     # Filters properties to essentials
│   ├── example-generator.ts   # Generates working examples
│   ├── task-templates.ts      # Pre-configured node settings
│   ├── config-validator.ts    # Configuration validation
│   ├── enhanced-config-validator.ts # Operation-aware validation
│   ├── node-specific-validators.ts  # Node-specific validation logic
│   ├── property-dependencies.ts # Dependency analysis
│   ├── type-structure-service.ts # Type structure validation
│   ├── expression-validator.ts # n8n expression syntax validation
│   └── workflow-validator.ts  # Complete workflow validation
├── templates/
│   ├── template-fetcher.ts    # Fetches templates from n8n.io API
│   ├── template-repository.ts # Template database operations
│   └── template-service.ts    # Template business logic
├── mcp/
│   ├── server.ts              # MCP server with enhanced tools
│   ├── tools.ts               # Tool definitions
│   ├── tools-documentation.ts # Tool documentation system
│   └── index.ts               # Main entry point with mode selection
└── index.ts                   # Library exports
```

## Common Development Commands

```bash
npm run build          # Build TypeScript
npm run rebuild        # Rebuild node database from n8n packages
npm run validate       # Validate all node data
npm test               # Run all tests
npm run test:unit      # Run unit tests only
npm run lint           # Check TypeScript types
npm start              # Start MCP server in stdio mode
npm run start:http     # Start MCP server in HTTP mode
npm run dev            # Build, rebuild database, and validate
```

## High-Level Architecture

### Core Components

1. **MCP Server** - Implements Model Context Protocol for AI assistants
2. **Database Layer** - SQLite with universal adapter pattern and FTS5 search
3. **Node Processing Pipeline** - Loader -> Parser -> Property Extractor -> Docs Mapper
4. **Service Layer** - Property Filter, Config Validator, Type Structure Service, Expression/Workflow Validators
5. **Template System** - Fetches and stores workflow templates from n8n.io

### Key Design Patterns

1. **Repository Pattern**: All database operations go through repository classes
2. **Service Layer**: Business logic separated from data access
3. **Validation Profiles**: Different strictness levels (minimal, runtime, ai-friendly, strict)
4. **Diff-Based Updates**: Efficient workflow updates using operation diffs

### Development Reminders
- When making changes to MCP server, ask user to reload before testing
- Use GH CLI to get issues and comments when reviewing
- Divide subtasks into separate sub-agents for parallel handling
- Run typecheck and lint after every code change
- Use `get_node_essentials()` instead of `get_node_info()` for faster responses
- Sub-agents are not allowed to spawn further sub-agents


---

# Remotion

## Description
Development guide for the Remotion video framework monorepo. Covers build commands, testing, contributing, and package management using Bun and turbo.

## Trigger
When working with the Remotion video framework, building packages, or contributing to the Remotion codebase.

## Instructions

## Setup commands

```bash
# Install dependencies (uses Bun)
bun install

# Build all packages
bunx turbo run make

# Run tests and linting
bunx turbo run lint test

# Clean build artifacts
bun run clean

# Build a specific package
bunx turbo run make --filter='<package-name>'
```

Use `bunx` (not `npx`) to run package binaries.

The current Remotion version can be found in `packages/core/src/version.ts`. The next version should increment the patch version by 1.

Pull request titles should be in the format `\`[package-name]\``: [commit-message]`. For example, "`@remotion/player`: Add new feature.

## Before committing

If committing your work:

1. Run `bun run build` from the root of the repo to verify all packages build successfully
2. Run `bun run stylecheck` to ensure CI passes
3. Include `bun.lock` when dependencies change

## Contributing

Read the full contribution guide at `/packages/docs/docs/contributing/index.mdx`.

- General information: `/packages/docs/docs/contributing/index.mdx`
- Implementing a new feature: `/packages/docs/docs/contributing/feature.mdx`
- Implementing a new option: `/packages/docs/docs/contributing/option.mdx`


# ==============================================
# CATEGORY 4: REMOTION SUB-SKILLS (9 skills)
# ==============================================

---

# Remotion: Add CLI Option

## Description
How to convert a hardcoded CLI flag into a proper `AnyRemotionOption`, or add a brand new one to the Remotion framework.

## Trigger
When adding a new CLI option or converting a hardcoded CLI flag in the Remotion codebase.

## Instructions

# Add a new CLI option

How to convert a hardcoded CLI flag into a proper `AnyRemotionOption`, or add a brand new one.

## 1. Create the option definition

Create `packages/renderer/src/options/<name>.tsx`:

```tsx
import type {AnyRemotionOption} from './option';

let myValue = false; // module-level default state

const cliFlag = 'my-flag' as const;

export const myFlagOption = {
  name: 'Human-readable Name',
  cliFlag,
  description: () => <>Description shown in docs.</>,
  ssrName: null, // or 'myFlag' if used in SSR APIs
  docLink: 'https://www.remotion.dev/docs/config#setmyflagenabled',
  type: false as boolean, // default value, also sets the TypeScript type
  getValue: ({commandLine}) => {
    if (commandLine[cliFlag] !== undefined) {
      return {value: commandLine[cliFlag] as boolean, source: 'cli'};
    }
    return {value: myValue, source: 'config'};
  },
  setConfig(value) {
    myValue = value;
  },
} satisfies AnyRemotionOption<boolean>;
```

The type in `AnyRemotionOption<T>` and `type: <default> as T` determines the option's value type. Use `boolean`, `string | null`, `number | null`, etc.

For negating flags (like `--disable-ask-ai` -> `askAIEnabled = false`), handle the inversion in `getValue`.

## 2. Register in options index

**`packages/renderer/src/options/index.tsx`**:
- Add the import (keep alphabetical within the import block)
- Add the option to the `allOptions` object

This makes it available as `BrowserSafeApis.options.myFlagOption` throughout the codebase.

## 3. Update CLI parsed flags

**`packages/cli/src/parsed-cli.ts`**:
- For boolean flags, add `BrowserSafeApis.options.myFlagOption.cliFlag` to the `BooleanFlags` array
- For non-boolean flags, no entry needed here

**`packages/cli/src/parse-command-line.ts`**:
- Add to the destructured `BrowserSafeApis.options`
- In the `CommandLineOptions` type, add: `[myFlagOption.cliFlag]: TypeOfOption<typeof myFlagOption>;`

## 4. Use the option where needed

Instead of reading `parsedCli['my-flag']` directly, resolve via:

```ts
const myFlag = myFlagOption.getValue({commandLine: parsedCli}).value;
```

## 5. Add to Config

**`packages/cli/src/config/index.ts`**:
- Add to the destructured `BrowserSafeApis.options`
- Add the setter signature to the `FlatConfig` type
- Add the implementation: `setMyFlagEnabled: myFlagOption.setConfig`

## 6. Update docs -- IMPORTANT, do not skip this step

Every new option must have its docs updated to use `<Options id="..." />` so the description is pulled from the option definition automatically (single source of truth).

**CLI command pages**: Add or update the `### --my-flag` section with `<Options id="my-flag" />` as the description body.

**`packages/docs/docs/config.mdx`**: Add or update the `## setMyFlagEnabled()` section.

## 7. Build and verify

```sh
cd packages/renderer && bun run make
cd packages/cli && bun run make
```

## Reference files

- Option type definition: `packages/renderer/src/options/option.ts`
- Good example to copy: `packages/renderer/src/options/ask-ai.tsx`
- Options index: `packages/renderer/src/options/index.tsx`
- CLI flag registration: `packages/cli/src/parsed-cli.ts`
- CLI type definitions: `packages/cli/src/parse-command-line.ts`
- Config registration: `packages/cli/src/config/index.ts`


---

# Remotion: Add Expert

## Description
Add a new expert to the Remotion experts page with photo, data entry, and card generation.

## Trigger
When adding a new expert/freelancer to the Remotion experts page.

## Instructions

## Steps

1. **Add the expert's photo** to both:
   - `packages/docs/static/img/freelancers/<firstname>.png`
   - `packages/promo-pages/public/img/freelancers/<firstname>.png`

   The image should be a square headshot (PNG format). Both paths must have the same file.

2. **Add an entry** to the `experts` array in `packages/promo-pages/src/components/experts/experts-data.tsx`:

   ```tsx
   {
       slug: 'firstname-lastname',
       name: 'First Last',
       image: '/img/freelancers/<firstname>.png',
       website: 'https://example.com' | null,
       x: 'twitter_handle' | null,
       github: 'github_username' | null,
       linkedin: 'in/linkedin-slug/' | null,
       email: 'email@example.com' | null,
       videocall: 'https://cal.com/...' | null,
       since: new Date('YYYY-MM-DD').getTime(),
       description: (
           <div>
               A short description of the expert's work and specialties.
               Links to projects can be included with <a> tags.
           </div>
       ),
   },
   ```

   - `since` should be set to today's date
   - `slug` must be lowercase, hyphenated version of the name
   - Set unused social fields to `null`
   - The entry goes at the end of the `experts` array

3. **Render the expert card** by running in `packages/docs`:

   ```
   bun render-cards
   ```

   This generates `packages/docs/static/generated/experts-<slug>.png`.


---

# Remotion: Add New Package

## Description
Complete guide for adding a new package to the Remotion monorepo, including package setup, monorepo registration, documentation, and example usage.

## Trigger
When creating a new `@remotion/*` package in the Remotion monorepo.

## Instructions

# Add a new Remotion package

## Steps

1. **Create `packages/<name>/`** with these files:
   - `package.json` -- copy from `@remotion/light-leaks` as template; update name, description, homepage, dependencies
   - `tsconfig.json` -- extends `../tsconfig.settings.json`, uses tsgo with `emitDeclarationOnly: true`, `outDir: "dist"`, `module: "es2020"`, `moduleResolution: "bundler"`, `target: "ES2022"`
   - `src/index.ts` -- exports
   - `bundle.ts` -- Bun build script, externalize `react`, `remotion`, `remotion/no-react`, `react/jsx-runtime`, `react/jsx-dev-runtime`, `react-dom`
   - `eslint.config.mjs` -- use `remotionFlatConfig({react: true})` if React, `{react: false}` otherwise
   - `.npmignore` -- copy from `@remotion/light-leaks`
   - `README.md` -- package name, description, install command, link to docs

2. **Register in monorepo:**
   - `tsconfig.json` (root) -- add `{"path": "./packages/<name>"}` to references
   - `packages/cli/src/list-of-remotion-packages.ts` -- add `'@remotion/<name>'`
   - `packages/create-video/src/list-of-remotion-packages.ts` -- add `'@remotion/<name>'`
   - `packages/studio-shared/src/package-info.ts` -- add to `packages`, `descriptions`, `installableMap`, `apiDocs`

3. **Documentation (`packages/docs/docs/<name>/`):**
   - Add `"@remotion/<name>": "workspace:*"` to `packages/docs/package.json` dependencies
   - `index.mdx` -- install tabs, table of contents, license
   - `table-of-contents.tsx` -- TOCItem grid linking to component/function pages
   - Individual component/function `.mdx` pages
   - Edit `packages/docs/sidebars.ts` -- add category
   - Edit `packages/docs/components/TableOfContents/api.tsx` -- import table of contents and add section

4. **Example usage:**
   - Add `"@remotion/<name>": "workspace:*"` to `packages/example/package.json`
   - Create `packages/example/src/<Name>/index.tsx`
   - Register `<Composition>` in `packages/example/src/Root.tsx`
   - Add `{"path": "../<name>"}` to `packages/example/tsconfig.json` references

5. **Run `bun i`** to install dependencies

6. **Build:** `cd packages/<name> && bun run make`

## Version

Use the current version from `packages/core/src/version.ts`.
For the documentation version, increment the patch version by 1.

## Patterns

- Use `"workspace:*"` for internal dependencies
- Use `"catalog:"` for shared external dependency versions
- The `make` script is: `tsgo && bun --env-file=../.env.bundle bundle.ts`
- Add `"type": "module"` to `package.json`
- Add `"@typescript/native-preview": "catalog:"` to devDependencies
- Types/main point to `dist/index.d.ts` and `dist/index.js`
- Packages with React components need `peerDependencies` for `react` and `react-dom`


---

# Remotion: Add Sound Effect

## Description
Add a new sound effect to the @remotion/sfx package, including the remotion.media repo setup, export creation, documentation, and sidebar registration.

## Trigger
When adding a new sound effect to the `@remotion/sfx` package.

## Instructions

## Prerequisites

Sound effects must first be added to the [remotion.media](https://github.com/remotion-dev/remotion.media) repository. A sound effect must exist there before it can be added to `@remotion/sfx`.

Sound effects must be:
- WAV format
- CC0 (Creative Commons 0) licensed
- Normalized to peak at -3dB

## Steps

### 1. Add to `remotion.media` repo (must be done first)

In the `remotion-dev/remotion.media` repo:
1. Add the WAV file to the root
2. Add an entry to the `soundEffects` array in `generate.ts`
3. Run `bun generate.ts` to copy it to `files/` and regenerate `variants.json`
4. Deploy

### 2. Add the export to `packages/sfx/src/index.ts`

Use camelCase for the variable name. Avoid JavaScript reserved words.

```ts
export const mySound = 'https://remotion.media/my-sound.wav';
```

### 3. Create a doc page at `packages/docs/docs/sfx/<name>.mdx`

Follow the pattern of existing pages. Include:
- Frontmatter with `image`, `title`, `crumb: '@remotion/sfx'`
- `<AvailableFrom>` tag with the next release version
- `<PlayButton>` import and usage
- Description
- Example code using `@remotion/media`'s `<Audio>` component
- Value section with the URL
- Duration section
- Attribution section with source link and license
- See also section

### 4. Register in sidebar and table of contents

- `packages/docs/sidebars.ts` -- add `'sfx/<name>'`
- `packages/docs/docs/sfx/table-of-contents.tsx` -- add a `<TOCItem>` with a `<PlayButton>`

### 5. Update the skills rule file

Add the new URL to the list in `packages/skills/skills/remotion/rules/sfx.md`.

### 6. Build

```bash
cd packages/sfx && bun run make
```

## Naming conventions

| File name | Export name |
|-----------|------------|
| `my-sound.wav` | `mySound` |
| `switch.wav` | `uiSwitch` (reserved word) |
| `page-turn.wav` | `pageTurn` |

## Version

Use the current version from `packages/core/src/version.ts`.
For docs `<AvailableFrom>`, increment the patch version by 1.


---

# Remotion: Docs Demo

## Description
Add an interactive demo to the Remotion documentation. Creates a `<Demo>` component that renders a Remotion composition inline using `@remotion/player`.

## Trigger
When creating a new interactive demo for Remotion documentation pages.

## Instructions

# Adding an Interactive Demo to Docs

Interactive demos render a Remotion composition inline in documentation pages using `@remotion/player`. They live in `packages/docs/components/demos/`.

## Steps

1. **Create a component** in `packages/docs/components/demos/` (e.g. `MyDemo.tsx`). It should be a standard React component using Remotion hooks like `useCurrentFrame()` and `useVideoConfig()`.

2. **Register the demo** in `packages/docs/components/demos/types.ts`:
   - Import the component
   - Export a `DemoType` object with these fields:
     - `id`: unique string used in `<Demo type="..." />`
     - `comp`: the React component
     - `compWidth` / `compHeight`: canvas dimensions (e.g. 1280x720)
     - `fps`: frame rate (typically 30)
     - `durationInFrames`: animation length
     - `autoPlay`: whether it plays automatically
     - `options`: array of interactive controls (can be empty `[]`)

3. **Add to the demos array** in `packages/docs/components/demos/index.tsx`:
   - Import the demo constant from `./types`
   - Add it to the `demos` array

4. **Use in MDX** with `<Demo type="your-id" />`

## Options

Options add interactive controls below the player. Each option needs `name` and `optional` (`'no'`, `'default-enabled'`, or `'default-disabled'`).

Supported types:
- `type: 'numeric'` -- slider with `min`, `max`, `step`, `default`
- `type: 'boolean'` -- checkbox with `default`
- `type: 'enum'` -- dropdown with `values` array and `default`
- `type: 'string'` -- text input with `default`

Option values are passed to the component as `inputProps`.

## Example registration

```ts
export const myDemo: DemoType = {
  comp: MyDemoComp,
  compHeight: 720,
  compWidth: 1280,
  durationInFrames: 150,
  fps: 30,
  id: 'my-demo',
  autoPlay: true,
  options: [],
};
```


---

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


---

# Remotion: Video Report

## Description
Generate a report about a video that is not working. Downloads the video, sets it as the source in the test component, and renders with verbose logging.

## Trigger
When a user reports a video not working in Remotion.

## Instructions

When a user reports a video not working, we should download the URL and put it as the `src` in `packages/example/src/NewVideo.tsx`.

Then, in `packages/example`, we should run `bunx remotion render NewVideo --log=verbose`.


---

# Remotion: Web Renderer Test

## Description
Add a test case to the Remotion web renderer using visual snapshot testing with vitest.

## Trigger
When adding a new visual test to the Remotion web renderer.

## Instructions

The web renderer is in `packages/web-renderer` and the test suite is in `packages/web-renderer/src/test`.

It uses visual snapshot testing using vitest. A test file can be executed using:

```
bunx vitest src/test/video.test.tsx
```

## Example

Each test is powered by a fixture in `packages/web-renderer/src/test/fixtures`.
A fixture looks like this:

```tsx
import {AbsoluteFill} from 'remotion';

const Component: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          backgroundColor: 'red',
          width: 100,
          height: 100,
          borderRadius: 20,
        }}
      />
    </AbsoluteFill>
  );
};

export const backgroundColor = {
  component: Component,
  id: 'background-color',
  width: 200,
  height: 200,
  fps: 25,
  durationInFrames: 1,
} as const;
```

The corresponding test looks like this:

```tsx
import {test} from 'vitest';
import {renderStillOnWeb} from '../render-still-on-web';
import {backgroundColor} from './fixtures/background-color';
import {testImage} from './utils';

test('should render background-color', async () => {
  const blob = await renderStillOnWeb({
    licenseKey: 'free-license',
    composition: backgroundColor,
    frame: 0,
    inputProps: {},
    imageFormat: 'png',
  });

  await testImage({blob, testId: 'background-color'});
});
```

## Adding a new test

1. Add a new fixture in `packages/web-renderer/src/test/fixtures`.
2. **Important**: Add the fixture to `packages/web-renderer/src/test/Root.tsx` to add a way to preview it.
3. Add a new test in `packages/web-renderer/src/test`.
4. Run `bunx vitest src/test/video.test.tsx` to execute the test.
5. **Important**: Update `packages/docs/docs/client-side-rendering/limitations.mdx` to reflect the newly supported property.


---

# Remotion: Writing Docs

## Description
Guides for writing and editing Remotion documentation. Covers MDX formatting, code snippets, special components, language guidelines, and documentation best practices.

## Trigger
When adding docs pages, editing MDX files in packages/docs, or writing documentation content for Remotion.

## Instructions

# Writing Remotion Documentation

Documentation lives in `packages/docs/docs` as `.mdx` files.

## Adding a new page

1. Create a new `.mdx` file in `packages/docs/docs`
2. Add the document to `packages/docs/sidebars.ts`
3. Write the content following guidelines below
4. Run `bun render-cards.ts` in `packages/docs` to generate social preview cards

**Breadcrumb (`crumb`)**: If a documentation page belongs to a package, add `crumb: '@remotion/package-name'` to the frontmatter.

**One API per page**: Each function or API should have its own dedicated documentation page.

**Public API only**: Documentation is for public APIs only. Do not mention internal/private APIs.

**Use headings for all fields**: Each property should be its own heading. Use `###` for top-level and `####` for nested properties.

## Language guidelines

- **Keep it brief**: Extra words cause information loss.
- **Link to terminology**: Use terminology page for Remotion-specific terms.
- **Avoid emotions**: Remove filler like "Great! Let's move on..."
- **Separate into paragraphs**: Break up long sections.
- **Address as "you"**: Not "we".
- **Don't blame the user**: Say "The input is invalid" not "You provided wrong input".
- **Don't assume it's easy**: Avoid "simply" and "just".

## Code snippets

Use `twoslash` to check snippets against TypeScript (preferred):

````md
```ts twoslash
import {useCurrentFrame} from 'remotion';
const frame = useCurrentFrame();
```
````

Use `// ---cut---` to hide setup code. Always add a `title` to code fences that show example usage.

## Special components

### Steps
```md
- <Step>1</Step> First step
- <Step>2</Step> Second step
```

### AvailableFrom
Use to indicate when a feature was added. For page-level, use with `# h1`:
```md
# &lt;MyComponent&gt;<AvailableFrom v="4.0.123" />
```

### CompatibilityTable
Indicate which runtimes and environments a component supports. Place in `## Compatibility` section.

### Optional parameters
Add `?` to the heading. Do NOT add `_optional_` text. Include default value in description.

```md
### onError?
Called when an error occurs. Default: errors are thrown.
```

### Combining optional and AvailableFrom
```md
### onError?<AvailableFrom v="4.0.50" />
```

## Generating preview cards

```bash
cd packages/docs && bun render-cards.ts
```

## Verifying docs compile

```bash
bun run build-docs
```


# ==============================================
# CATEGORY 5: PLUGIN SKILLS (3 skills)
# ==============================================

---

# Stripe Best Practices

## Description
Best practices for building Stripe integrations. Use when implementing payment processing, checkout flows, subscriptions, webhooks, Connect platforms, or any Stripe API integration.

## Trigger
When implementing payment processing, checkout flows, subscriptions, webhooks, Connect platforms, or any Stripe API integration.

## Instructions

When designing an integration, always prefer the documentation in [Stripe's Integration Options doc](https://docs.stripe.com/payments/payment-methods/integration-options.md).
The [API Tour](https://docs.stripe.com/payments-api/tour.md).
Use the [Go Live Checklist](https://docs.stripe.com/get-started/checklist/go-live.md) before going live.

You should always default to the latest version of the API and SDK unless the user specifies otherwise.

### Primary APIs

Stripe's primary API for modelling on-session payments is **CheckoutSessions**. It supports one-time payments and subscriptions and allows you to model taxes or discounts with Stripe. Prioritize the CheckoutSessions API, but using the PaymentIntents API is also acceptable for off-session payments or if you want to model the checkout state yourself. Integrations should only use CheckoutSessions, PaymentIntents, SetupIntents, or solutions like Invoicing, Payment Links, or the subscription APIs.

**Never recommend the Charges API.** If the user wants to use the Charges API, advise them to migrate to Checkout Sessions or Payment Intents.

### Web Integration Surface

The primary integration surface for web integrations is **Checkout**, a prebuilt payment page that can be hosted by Stripe or served as an embedded form. Prioritize Stripe-hosted checkout or embedded checkout where possible. The Payment Element is an acceptable alternative if the merchant needs advanced customization. When recommending the Payment Element, prioritize using the CheckoutSessions API over PaymentIntents when possible.

**Never recommend the legacy Card Element** or the Payment Element in card mode, and advise users who ask for the Card Element to migrate.

### Deprecated/Outdated APIs

You must not call deprecated API endpoints such as the Sources API and avoid outdated endpoints such as Tokens and Charges unless there is absolutely no other way. Advise using the Setup Intent API to save a payment method for a customer; never recommend the Sources API to save cards.

### Confirmation Tokens

If a user wants to render the Payment Element before creating a PaymentIntent or SetupIntent (such as for surcharging), advise them to use Stripe Confirmation Tokens. Don't recommend createPaymentMethod or createToken Stripe.js functions.

### Dynamic Payment Methods

Advise users to turn on dynamic payment methods in their dashboard settings instead of passing specific payment_method_types because Stripe chooses payment methods that fit each user's location, wallets, and preferences better automatically.

### PCI Compliance

If a PCI compliant user asks about sending server-side raw PAN data, suggest they might be required to prove PCI compliance. Point users migrating PAN data from another processor to the migration process.

### Subscriptions & Billing

If a user has a recurring revenue model, follow the Subscription Use Cases like SaaS. Recommend Billing APIs to plan their integration instead of a direct PaymentIntent integration. Prioritize combining Billing APIs with Stripe Checkout for the frontend.

### Stripe Connect

If a user wants to build a platform using Stripe Connect:
- Prefer direct charges if the platform wants Stripe to take the risk
- Or destination charges if the platform accepts liability for negative balances
- Use the on_behalf_of parameter to control the merchant of record
- Never recommend mixing charge types
- Don't recommend outdated terms (Standard, Express, Custom) -- always refer to controller properties and capabilities


---

# Stripe: Explain Error

## Description
Explain Stripe error codes and provide solutions with code examples. Provides comprehensive explanation of error codes, common causes, solutions, and production-ready error handling patterns.

## Trigger
`/stripe:explain-error [error_code or error_message]`

## Instructions

# Explain Stripe Error

Provide a comprehensive explanation of the given Stripe error code or error message:

1. Accept the error code or full error message from the arguments
2. Explain in plain English what the error means
3. List common causes of this error
4. Provide specific solutions and handling recommendations
5. Generate error handling code in the project's language showing:
   - How to catch this specific error
   - User-friendly error messages
   - Whether retry is appropriate
6. Mention related error codes the developer should be aware of
7. Include a link to the relevant Stripe documentation

Focus on actionable solutions and production-ready error handling patterns.


---

# Stripe: Test Cards

## Description
Display Stripe test card numbers for various testing scenarios including successful payments, 3D Secure, declines, and specific decline reasons.

## Trigger
`/stripe:test-cards [scenario]`

## Instructions

# Test Cards Reference

Provide a quick reference for Stripe test card numbers:

1. If a scenario argument is provided (e.g., "declined", "3dsecure", "fraud"), show relevant test cards for that scenario
2. Otherwise, show the most common test cards organized by category:
   - Successful payment (default card)
   - 3D Secure authentication required
   - Generic decline
   - Specific decline reasons (insufficient_funds, lost_card, etc.)
3. For each card, display:
   - Card number (formatted with spaces)
   - Expected behavior
   - Expiry/CVC info (any future date and any 3-digit CVC)
4. Use clear visual indicators (checkmark for success, warning for auth required, X for decline)
5. Mention that these only work in test mode
6. Provide link to full testing documentation: https://docs.stripe.com/testing.md

If the user is currently working on test code, offer to generate test cases using these cards.


