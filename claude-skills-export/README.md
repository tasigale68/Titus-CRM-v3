# Claude Code Skills Export

A complete export of all Claude Code skills, commands, and custom instructions from this workspace. Each skill is formatted as clean markdown that can be used as a Claude.ai custom instruction or project knowledge file.

## How to Use

### In Claude Desktop / Claude.ai (Projects)
1. Create a new project in Claude.ai
2. Go to Project Knowledge
3. Upload individual `.md` files for the skills you want active
4. Or upload `ALL-SKILLS.md` to load everything at once

### In Claude.ai (System Prompt)
1. Open the relevant `.md` file
2. Copy the full "Instructions" section
3. Paste into the system prompt or custom instructions field

### In Claude Code (CLI)
These skills are already installed in their original locations. This export is for portability to other Claude interfaces.

## Skills Inventory

### Category 1: GSD Commands (31 files)

Project management framework with milestone planning, phase execution, testing, and debugging.

| File | Command | Description |
|------|---------|-------------|
| `gsd-commands/gsd-add-phase.md` | `/gsd:add-phase` | Add new phase to end of current milestone |
| `gsd-commands/gsd-add-tests.md` | `/gsd:add-tests` | Generate unit and E2E tests for a completed phase |
| `gsd-commands/gsd-add-todo.md` | `/gsd:add-todo` | Capture idea or task as structured todo |
| `gsd-commands/gsd-audit-milestone.md` | `/gsd:audit-milestone` | Audit milestone completion against original intent |
| `gsd-commands/gsd-check-todos.md` | `/gsd:check-todos` | List pending todos and select one to work on |
| `gsd-commands/gsd-cleanup.md` | `/gsd:cleanup` | Archive phase directories from completed milestones |
| `gsd-commands/gsd-complete-milestone.md` | `/gsd:complete-milestone` | Archive completed milestone and prepare for next |
| `gsd-commands/gsd-debug.md` | `/gsd:debug` | Systematic debugging with persistent state |
| `gsd-commands/gsd-discuss-phase.md` | `/gsd:discuss-phase` | Gather phase context through adaptive questioning |
| `gsd-commands/gsd-execute-phase.md` | `/gsd:execute-phase` | Execute all plans with wave-based parallelization |
| `gsd-commands/gsd-health.md` | `/gsd:health` | Diagnose planning directory health and repair |
| `gsd-commands/gsd-help.md` | `/gsd:help` | Show available GSD commands and usage guide |
| `gsd-commands/gsd-insert-phase.md` | `/gsd:insert-phase` | Insert urgent work as decimal phase between existing phases |
| `gsd-commands/gsd-join-discord.md` | `/gsd:join-discord` | Join the GSD Discord community |
| `gsd-commands/gsd-list-phase-assumptions.md` | `/gsd:list-phase-assumptions` | Surface Claude's assumptions about a phase |
| `gsd-commands/gsd-map-codebase.md` | `/gsd:map-codebase` | Analyze codebase with parallel mapper agents |
| `gsd-commands/gsd-new-milestone.md` | `/gsd:new-milestone` | Start a new milestone cycle |
| `gsd-commands/gsd-new-project.md` | `/gsd:new-project` | Initialize a new project with deep context gathering |
| `gsd-commands/gsd-pause-work.md` | `/gsd:pause-work` | Create context handoff when pausing work |
| `gsd-commands/gsd-plan-milestone-gaps.md` | `/gsd:plan-milestone-gaps` | Create phases to close audit-identified gaps |
| `gsd-commands/gsd-plan-phase.md` | `/gsd:plan-phase` | Create detailed phase plan with verification loop |
| `gsd-commands/gsd-progress.md` | `/gsd:progress` | Check project progress and route to next action |
| `gsd-commands/gsd-quick.md` | `/gsd:quick` | Execute quick task with GSD guarantees |
| `gsd-commands/gsd-reapply-patches.md` | `/gsd:reapply-patches` | Reapply local modifications after GSD update |
| `gsd-commands/gsd-remove-phase.md` | `/gsd:remove-phase` | Remove future phase and renumber subsequent |
| `gsd-commands/gsd-research-phase.md` | `/gsd:research-phase` | Research how to implement a phase |
| `gsd-commands/gsd-resume-work.md` | `/gsd:resume-work` | Resume work with full context restoration |
| `gsd-commands/gsd-set-profile.md` | `/gsd:set-profile` | Switch model profile for GSD agents |
| `gsd-commands/gsd-settings.md` | `/gsd:settings` | Configure GSD workflow toggles |
| `gsd-commands/gsd-update.md` | `/gsd:update` | Update GSD to latest version |
| `gsd-commands/gsd-verify-work.md` | `/gsd:verify-work` | Validate built features through conversational UAT |

### Category 2: Custom Skills (4 files)

Specialized domain skills for finance, branding, and UI/UX design.

| File | Skill | Description |
|------|-------|-------------|
| `custom-skills/creating-financial-models.md` | Financial Models | DCF, sensitivity, Monte Carlo, scenario planning |
| `custom-skills/analyzing-financial-statements.md` | Financial Statements | Financial ratio calculation and analysis |
| `custom-skills/applying-brand-guidelines.md` | Brand Guidelines | Corporate branding for documents |
| `custom-skills/ui-ux-pro-max.md` | UI/UX Pro Max | 50+ styles, 97 palettes, 57 font pairings, 9 stacks |

### Category 3: Project Skills (7 files)

Project-specific skills for various tools and frameworks.

| File | Skill | Description |
|------|-------|-------------|
| `project-skills/n8n-mcp.md` | n8n MCP | MCP server for n8n workflow automation |
| `project-skills/remotion.md` | Remotion | Video framework monorepo development guide |
| `project-skills/financial-statements.md` | Financial Statements | Project-level financial ratio calculator |
| `project-skills/brand-guidelines.md` | Brand Guidelines | Project-level corporate branding |
| `project-skills/financial-models.md` | Financial Models | Project-level financial modeling suite |
| `project-skills/cookbook-audit.md` | Cookbook Audit | Anthropic Cookbook notebook audit rubric |
| `project-skills/awesome-claude-code.md` | Awesome Claude Code | Claude Code ecosystem knowledge base and evaluator |

### Category 4: Remotion Sub-Skills (9 files)

Specific workflows for the Remotion video framework.

| File | Skill | Description |
|------|-------|-------------|
| `remotion-sub-skills/add-cli-option.md` | Add CLI Option | Add new CLI flag to Remotion |
| `remotion-sub-skills/add-expert.md` | Add Expert | Add expert to Remotion experts page |
| `remotion-sub-skills/add-new-package.md` | Add New Package | Create new package in Remotion monorepo |
| `remotion-sub-skills/add-sfx.md` | Add Sound Effect | Add sound effect to @remotion/sfx |
| `remotion-sub-skills/docs-demo.md` | Docs Demo | Add interactive demo to documentation |
| `remotion-sub-skills/pr.md` | Make PR | Open pull request with proper formatting |
| `remotion-sub-skills/video-report.md` | Video Report | Debug video rendering issues |
| `remotion-sub-skills/web-renderer-test.md` | Web Renderer Test | Add visual snapshot test |
| `remotion-sub-skills/writing-docs.md` | Writing Docs | Documentation writing guidelines |

### Category 5: Plugin Skills (3 files)

Third-party integration skills.

| File | Skill | Description |
|------|-------|-------------|
| `plugin-skills/stripe-best-practices.md` | Stripe Best Practices | Payment integration best practices |
| `plugin-skills/stripe-test-cards.md` | Stripe Test Cards | Test card number reference |
| `plugin-skills/stripe-explain-error.md` | Stripe Explain Error | Error code explanation with solutions |

## Total: 54 skills exported
