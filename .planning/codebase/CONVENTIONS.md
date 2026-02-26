# Coding Conventions

**Analysis Date:** 2026-02-26

## Naming Patterns

**Files:**
- Route modules: kebab-case directory names under `src/routes/[module]/index.js` (e.g., `src/routes/auth/index.js`, `src/routes/voice/index.js`)
- Service files: kebab-case in `src/services/` (e.g., `airtable.js`, `audit.js`, `permissions.js`)
- Config files: kebab-case in `src/config/` (e.g., `env.js`, `upload.js`)
- Database: `sqlite.js` for database module in `src/db/`
- Middleware: kebab-case in `src/middleware/` (e.g., `auth.js`, `error-handler.js`)

**Functions:**
- camelCase for all function names and methods
- Prefix helper functions with domain context when in modules (e.g., `formatAUPhone()`, `findDate()`, `mapAirtableRecord()`)
- No underscore prefix for "private" functions — all functions follow same camelCase pattern
- Handler functions follow pattern: `function nameHandler()` or unnamed arrow functions in route handlers

**Variables:**
- camelCase for all variable names in modern code (e.g., `firstName`, `lastName`, `phoneNumber`, `linkedToClient`)
- UPPERCASE_SNAKE_CASE for constants that are configuration (e.g., `RATE_LIMIT_MS`, `SALT`, `BASE_URL`, `TWILIO_SID`)
- UPPERCASE_SNAKE_CASE for immutable lookup objects and enum-like values (e.g., `TABLES`, `PERMISSION_KEYS`, `SENIOR_ROLES`)
- Single letter variables only in tight loops or mathematical contexts (e.g., `i`, `p`, `k` in for loops; `r`, `d` for results/data in promise chains)
- Verbose names in query results and data transforms (e.g., `linkedToClient`, `signingEmail`, `abnEntityName`)
- Abbreviations acceptable only when clear from context (e.g., `abn` for Australian Business Number, `gst` for Goods and Services Tax, `cwcc` for Working with Children Check)

**Types/Objects:**
- No TypeScript — pure JavaScript project
- No formal type annotations
- Objects created as plain JavaScript objects with `{}` notation
- Class-based constructors (Database via `new Database()`) initialized at module level

## Code Style

**Formatting:**
- No linter configuration (eslint, prettier) detected
- Inconsistent style across codebase:
  - Mix of var/const declarations (use `const` for new code, `var` in older code)
  - Varied spacing and indentation (2 or 4 spaces)
  - Some one-liners in helpers, some multi-line statements
- Recommendation: Use `const` consistently for all variable declarations unless reassignment is needed (rare)

**Linting:**
- No ESLint or Prettier configuration found
- No automated style enforcement in place
- Code review should enforce consistent style manually

**Template Literals:**
- Use backticks for dynamic strings with interpolation (e.g., ``const url = `${BASE_URL}/${endpoint}` ``)
- Use single quotes for static strings (e.g., `'All Contacts'`)
- Multi-line strings: Use backticks with newlines preserved

## Import Organization

**Order:**
1. Core Node.js modules (`express`, `crypto`, `path`, `http`, etc.)
2. Third-party packages (`cors`, `multer`, `twilio`, `better-sqlite3`, etc.)
3. Internal modules (`../config/env`, `../../db/sqlite`, `../../services/airtable`, etc.)
4. Router and middleware initialization

**Example from `src/routes/auth/index.js`:**
```javascript
const express = require('express');
const crypto = require('crypto');
const { db } = require('../../db/sqlite');
const { authenticate, requirePhase2, hashPassword } = require('../../middleware/auth');
const { getUserPermissions, isSeniorRole } = require('../../services/permissions');
const { logAudit } = require('../../services/audit');
const env = require('../../config/env');

const router = express.Router();
```

**Path Aliases:**
- No alias system configured
- Use relative paths: `../../db/sqlite`, `../../services/airtable`
- Avoid `require('.')` — always specify module name

## Error Handling

**Patterns:**
- **Route validation:** Return status with error message immediately
  ```javascript
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  ```
- **Try-catch for I/O:** Wrap database and external API calls
  ```javascript
  try {
    var group = db.prepare("SELECT * FROM call_hunt_groups WHERE active=1 LIMIT 1").get();
    // ...
  } catch(e) { return null; }
  ```
- **Promise chains:** Use `.catch()` to handle errors and fallback
  ```javascript
  return fetchPage(offset).catch(function (e) {
    console.log('Fetch error:', e.message);
    return allRecords;
  });
  ```
- **Silent errors:** Many promises silently return default values (empty array, null) on error
- **Global error handler:** `src/middleware/error-handler.js` catches unhandled route errors
  - Logs timestamp, method, path, and error message
  - Returns 500 with generic message for unhandled errors

**Error Response Format:**
- All errors return JSON with `error` key:
  ```javascript
  { error: 'Invalid email or password' }
  { error: 'Insufficient permissions' }
  ```

## Logging

**Framework:** `console` object only — no logging library

**Patterns:**
- **console.log()** for informational messages
  - Socket connections: `console.log('Socket connected: ${socket.id}')`
  - Service initialization: `console.log('Voice: Twilio client connected')`
  - Domain-specific prefixes in brackets: `console.log('[AUDIT] Error logging:', e.message)`
  - Numbered results: `console.log("[SCHEDULER] " + result.length + " shifts: " + withName + " with staff name")`

- **console.error()** for errors
  - Timestamped in global error handler: `` `[${new Date().toISOString()}] ${req.method} ${req.path}: ${err.message}` ``
  - Domain-specific prefixes: `console.error('[WELCOME] Failed to send to ' + toEmail + ':', err.message)`
  - Unhandled errors: `console.error('Scheduler error:', e.message)`

- **Domain prefixes used:**
  - `[AUDIT]` — audit logging failures
  - `[SCHEDULER]` — roster scheduling operations
  - `[WELCOME]` — welcome email operations
  - `Voice:` — voice module initialization

- **When to log:**
  - Service initialization (Twilio connected, misconfigured)
  - Async operation completion (email sent, roster built)
  - API errors and rate limiting
  - Unhandled exceptions and fallbacks

## Comments

**When to Comment:**
- Section headers using ASCII art dividers (see below)
- Complex business logic transformation (field mapping, data normalization)
- Workarounds or non-obvious implementation choices
- No comments for obvious code

**Comment Styles:**

Header comments with ASCII dividers:
```javascript
// ═══════════════════════════════════════════════════════
//  API Routes
// ═══════════════════════════════════════════════════════
```

Sub-section comments with dashes:
```javascript
// ─── Airtable record mapper ──────────────────────────────
function mapAirtableRecord(rec) { ... }
```

Inline comment for complex transformations:
```javascript
// Airtable allows max 10 records per batch
for (let i = 0; i < records.length; i += 10) {
```

**JSDoc/TSDoc:**
- Not used
- No formal type hints or function documentation blocks
- Documentation should be inline comments only

## Function Design

**Size:**
- Helpers often compressed to 1-3 lines for utility functions
- Route handlers typically 5-30 lines
- No maximum enforced; prefer clarity over compression

**Parameters:**
- Use destructuring for route body parameters:
  ```javascript
  const { title, description, assigned_to, project_id, priority, due_date } = req.body;
  ```
- Pass objects directly to service functions
- No parameter validation beyond null checks in handlers

**Return Values:**
- Functions return data directly (arrays, objects, null)
- Promise-based functions return Promise via `.then()` chains
- Error cases return null, empty array, or default value silently
- HTTP responses via `res.json()`, `res.status().json()`

## Module Design

**Exports:**
- Express route handlers export `router` directly:
  ```javascript
  const router = express.Router();
  // ... add routes ...
  module.exports = router;
  ```
- Service modules export object with named functions:
  ```javascript
  module.exports = { listRecords, getRecord, createRecords, updateRecords, deleteRecords, TABLES };
  ```
- Config module exports plain object:
  ```javascript
  module.exports = { port: ..., airtable: {...}, twilio: {...} };
  ```

**Barrel Files:**
- Not used
- Each route file is a standalone Express router
- No index files re-exporting multiple modules

**Module Dependencies:**
- All modules follow clear dependency pattern:
  - Routes depend on services, middleware, config
  - Services depend on config and database
  - Middleware depends on database and services
  - No circular dependencies

---

*Convention analysis: 2026-02-26*
