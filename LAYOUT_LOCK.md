# TITUS CRM — LAYOUT LOCK

## THIS FILE IS A PERMANENT DEVELOPMENT RULE
## DO NOT IGNORE. DO NOT OVERRIDE.

### THE RULE:
The visual layout of Titus CRM is LOCKED and must NEVER be changed
unless the prompt explicitly contains the heading:

# LAYOUT CHANGE

If the heading "LAYOUT CHANGE" does not appear in the prompt,
treat ALL of the following as READ-ONLY — do not touch them:

LOCKED LAYOUT ELEMENTS:
- CSS styles (colours, padding, margins, border radius, shadows)
- HTML structure and element ordering
- Column and grid layout (sidebar width, main area, right panel)
- Flex and grid arrangements
- Profile photo position and size
- Card backgrounds and surface colours
- Font sizes on existing elements
- Section heading sizes and weights
- Sidebar menu item order and structure
- Modal and slide-over widths and positions
- Button positions, sizes, and colours
- Table column widths and styling
- Navigation header layout
- All spacing between existing elements
- Design tokens (--navy, --teal, --royal, --surface colours)

WHAT IS ALLOWED WITHOUT "LAYOUT CHANGE":
- Adding new JavaScript functions
- Fixing API endpoints and fetch logic
- Connecting data to existing UI elements
- Bug fixes that don't affect visual appearance
- Adding new data to existing tables or lists
- Backend route changes
- Supabase query changes
- Adding new modals triggered by NEW buttons only
  (existing modal styles must not change)

### HOW TO REQUEST A LAYOUT CHANGE:
If A4 wants to change the visual layout, the prompt must include
this exact heading at the top:

# LAYOUT CHANGE

Without this heading, Claude Code must:
1. Complete all requested functionality fixes
2. Leave every layout element exactly as it was
3. If a functionality fix would require a layout change to work,
   FLAG IT in the output as:
   "LAYOUT CHANGE REQUIRED: [description of what needs to change
   and why] — skipped pending approval"
   Do not make the layout change — just flag it.

### BEFORE EVERY COMMIT:
Run a self-check:
- Did this prompt contain "# LAYOUT CHANGE"?
  - YES → layout changes permitted
  - NO → scan the diff for any changes to CSS, HTML structure,
    or layout — if found, REVERT them before committing
