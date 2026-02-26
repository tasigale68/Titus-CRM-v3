# Codebase Concerns

**Analysis Date:** 2026-02-26

## Tech Debt

**Temporary Airtable-based architecture:**
- Issue: Entire CRM database depends on Airtable API as primary data store. Documented as temporary pending Supabase migration (planned 4-6 weeks from project inception)
- Files: `src/services/airtable.js`, all route modules in `src/routes/*/index.js`
- Impact: Rate limiting (250ms between requests = 4 req/sec max), API dependency for all CRUD, pagination complexity, vendor lock-in
- Fix approach: Execute planned Supabase migration. Create abstraction layer in `src/services/airtable.js` to decouple routes from Airtable client

**Incomplete migration stubs returning empty responses:**
- Issue: Critical features marked TODO but returning empty arrays/objects instead of 404 or error
- Files: `src/routes/email/index.js`, `src/routes/compliance/index.js`
- Impact: Frontend cannot distinguish between "feature not implemented" vs "no data". Silent failures on audit log, incident reporting, email sync, attachment fetching
- Patterns:
  - `/api/email/inbox` - returns `{ emails: [] }`
  - `/api/email/sent` - returns `{ emails: [] }`
  - `/api/email/send` - returns `{ ok: true }` (no-op)
  - `/api/compliance/audit-log` - returns `{ logs: [] }`
  - `/api/compliance/incidents` - returns `{ incidents: [] }`
  - `/api/compliance/improvements` - returns `{ improvements: [] }`
  - `/api/compliance/tickets` - returns `{ tickets: [] }`
- Fix approach: Either implement features or return 501 Not Implemented with migration status message

**Dual database systems (SQLite + Airtable):**
- Issue: Critical app data split across SQLite (users, sessions, calls, SMS, audit logs) and Airtable (contacts, clients, rosters, budgets, progress notes)
- Files: `src/db/sqlite.js`, `src/services/airtable.js`, all route modules
- Impact: Data consistency complexity, join operations impossible, reporting requires multiple queries, migration path unclear
- Fix approach: Complete Supabase migration to consolidate into single database

**Large monolithic route files:**
- Issue: Routes exceed 1.5K lines, mixing concerns (auth, business logic, data access, validation)
- Files:
  - `src/routes/voice/index.js` (1537 lines) - Twilio, ElevenLabs, hunt group routing, call management, recording handling
  - `src/routes/scheduling/index.js` (1311 lines) - Roster CRUD, shift management, properties, staff availability
  - `src/routes/documents/index.js` (1310 lines) - Document templates, signing, scanning, OCR
- Impact: Hard to test, reuse, or maintain. Single file contains multiple business domains
- Fix approach: Extract each domain into separate modules. Example: `src/routes/voice/` directory structure:
  - `src/routes/voice/handlers/calls.js` - Call CRUD and management
  - `src/routes/voice/handlers/hunt-groups.js` - Hunt group routing logic
  - `src/routes/voice/handlers/recordings.js` - Recording and transcript handling
  - `src/routes/voice/index.js` - Router setup only

**Weak error handling patterns:**
- Issue: Silent failures throughout codebase. Catch blocks return null, empty arrays, or ignore errors
- Examples:
  - `src/routes/voice/index.js:74` - `catch(e) { return null; }`
  - `src/routes/scheduling/index.js:315` - `.catch(function(e) { console.log("...not found — skipping"); return []; })`
  - `src/services/airtable.js:130` - `.catch(function (e) { console.log(...); return allRecords; })`
- Files affected: 30+ catch blocks in scheduling, reports, clients, and voice routes
- Impact: Errors silently degrade functionality. Hard to debug production issues. No retry logic for transient failures
- Fix approach: Implement error middleware with structured logging. Catch blocks should log with context, retry on transient errors, or throw with operation context

---

## Known Bugs

**Hunt group agent busy check may miss calls:**
- Symptoms: Agent receives calls during active call, or system incorrectly marks as unavailable
- Files: `src/routes/voice/index.js:81-110`
- Trigger: (1) Agent has active call but status = 'available', (2) Call recorded with 2-hour lookback window misses older calls, (3) Multiple databases (SQLite for calls, Airtable for agents) may be out of sync
- Code review:
  ```javascript
  // Only checks last 2 hours
  var activeBrowserCall = db.prepare(
    "SELECT id FROM calls WHERE (...) AND created_at > datetime('now','-2 hours') LIMIT 1"
  ).get(clientId, clientId);

  // Airtable agent data may be stale — no sync with SQLite
  ```
- Workaround: Manually set agent status to "offline" if receiving unexpected calls

**Airtable rate limiting causes cascading timeouts:**
- Symptoms: API endpoints slow or timeout when fetching multiple tables
- Files: `src/services/airtable.js:4-15`
- Trigger: Multiple concurrent requests hit 250ms rate limiter. Example: `src/routes/scheduling/index.js:535-536` makes 2 requests sequentially
- Current: 4 requests/second (250ms limit)
- Workaround: None - frontend must implement exponential backoff/retry

**Password hashing uses weak salt:**
- Symptoms: Not a runtime bug but security issue
- Files: `src/middleware/auth.js:4`
- Code:
  ```javascript
  const SALT = 'titus-salt-2026';  // Hardcoded, visible in source
  ```
- Impact: If database is compromised, salt is also visible. Attacker can precompute rainbow tables
- Fix approach: Use bcrypt or Argon2 instead. If must use SHA256, use per-user random salt

**ElevenLabs webhook validation incomplete:**
- Symptoms: Webhook could be spoofed
- Files: `src/routes/voice/index.js:22`
- Code:
  ```javascript
  var ELEVENLABS_WEBHOOK_SECRET = process.env.ELEVENLABS_WEBHOOK_SECRET || "";
  // No signature validation in webhook handler
  ```
- Impact: Malicious requests could create fake call records
- Fix approach: Implement HMAC-SHA256 signature verification

---

## Security Considerations

**Hardcoded default passwords in seed data:**
- Risk: Development/demo users can be created with known password
- Files: `src/middleware/auth.js:51-67`
- Code:
  ```javascript
  saStmt.run('gus@deltacommunity.com.au', hashPassword('1234'), 'Gus');
  dirStmt.run('rina@deltacommunity.com.au', hashPassword('1234'), 'Rina');
  ```
- Current mitigation: `seedUsers()` only called at startup; users can change password
- Recommendations:
  - Move seed data to separate, unversioned script run only in development
  - Remove from production deployments
  - Log seed operations to audit trail
  - Add environment check to prevent seeding in production

**Hardcoded temporary passwords in templates:**
- Risk: Password values visible in code
- Files: `src/routes/recruitment/index.js:134-135`
- Code:
  ```javascript
  .replace(/\[LMS_TEMP_PASSWORD\]/g, "DeltaLMS2026!")
  .replace(/\[TEMP_PASSWORD\]/g, "DeltaWelcome2026!")
  ```
- Current mitigation: Passwords are static placeholders; users must change on first login
- Recommendations:
  - Generate random passwords instead of hardcoded defaults
  - Use environment variables for default password patterns
  - Log password resets to audit trail
  - Enforce password change on first login validation

**Session token in cookie and header:**
- Risk: Token exposure via multiple vectors
- Files: `src/middleware/auth.js:11-13`
- Code:
  ```javascript
  var token = req.headers.authorization
    ? req.headers.authorization.replace('Bearer ', '')
    : null;  // Falls back to cookie (not shown)
  ```
- Current mitigation: CORS enabled with `origin: '*'` (extremely permissive)
- Recommendations:
  - Restrict CORS to known domains in production
  - Use HttpOnly cookies to prevent XSS token theft
  - Implement CSRF protection for state-changing operations
  - Add SameSite=Strict cookie attribute

**CORS configured for '*':**
- Risk: Any domain can make requests on behalf of authenticated user
- Files: `src/server.js:35`
- Code:
  ```javascript
  const io = new Server(server, { cors: { origin: '*' } });
  app.use(cors());  // Default allows all origins
  ```
- Current mitigation: None
- Recommendations:
  - Set CORS origin to specific Railway deployment domain
  - Whitelist frontend URL explicitly
  - Validate origin header on sensitive operations

**Airtable API key in environment, but fallback hardcoded:**
- Risk: API key exposure if .env is leaked
- Files: `src/services/airtable.js:2`, `src/config/env.js:8-10`
- Current mitigation: Uses environment variable
- Recommendations: Already correct. Ensure `.env` is in `.gitignore` and never committed

**Admin bypass potential in role validation:**
- Risk: Role normalization may allow bypass
- Files: `src/middleware/auth.js:31`
- Code:
  ```javascript
  var role = (req.user.role || '').toLowerCase().replace(/\s+/g, '_');
  if (roles.indexOf(role) < 0) { return res.status(403)... }
  ```
- Risk: Whitespace variations ("super admin" vs "superadmin") could bypass checks if stored inconsistently
- Recommendations:
  - Normalize roles at storage time, not validation time
  - Add role enum validation on user creation
  - Add test coverage for role boundary conditions

---

## Performance Bottlenecks

**Airtable pagination requires sequential requests:**
- Problem: Fetching large datasets requires multiple round-trip requests (pageSize=100, offset-based pagination)
- Files: `src/services/airtable.js:43-57` (listRecords), `src/services/airtable.js:118-133` (fetchAllFromTable)
- Cause: Airtable API requires sequential page fetches with offset. Rate limiter adds 250ms per request
- Example: Fetching 1000 rosters = 10 requests × 250ms = 2.5 seconds minimum, plus network latency
- Improvement path:
  - Implement cursor-based pagination where possible
  - Cache frequently accessed tables (staff, properties, course definitions)
  - Implement incremental sync instead of full fetch every request
  - Consider background sync job to pre-populate SQLite read replicas

**Large JSON payloads from Airtable:**
- Problem: All related fields returned, not just needed subset
- Files: All route modules that call `airtable.fetchAllFromTable()`
- Cause: Airtable API returns full record objects; routes filter in memory
- Example: Fetching rosters returns all fields (scheduling, notes, attachments, linked records) even if only ID needed
- Improvement path: Use Airtable views to limit field selection, or implement GraphQL-style field selection at route layer

**N+1 query problem in roster/scheduling:**
- Problem: Scheduling route fetches rosters, then for each roster may fetch linked contact data
- Files: `src/routes/scheduling/index.js:122, 235, 311, 535-536`
- Cause: Sequential Airtable calls instead of batch fetching with linked record expansion
- Improvement path: Pre-fetch all linked records in single batch, then join in memory

**Console.log overhead (382 occurrences):**
- Problem: 382 console.log/error statements throughout codebase may impact performance under load
- Files: All route and service modules
- Impact: Each log write blocks event loop momentarily. Multiplied across 12 route modules
- Improvement path: Replace with structured logger (Winston, Pino) that can batch and async-write logs

**Socket.io broadcast without room filtering:**
- Problem: Some broadcasts may go to all connected sockets
- Files: `src/routes/voice/index.js:140` (call:summarised event)
- Cause: Global io.emit() rather than room-specific emit
- Improvement path: Ensure all real-time events are scoped to specific rooms/users

---

## Fragile Areas

**Hunt group routing logic (voice module):**
- Files: `src/routes/voice/index.js:39-110, 400-500` (estimated)
- Why fragile:
  - Multiple state sources: agent_availability table, active calls from two systems, manual status toggles
  - Race conditions: Agent status changes during call ring sequence
  - Time windows: 2-hour active call window is arbitrary, may miss recent calls
  - No distributed locking: Concurrent requests may route same call to multiple agents
- Safe modification:
  1. Add comprehensive test cases for all state combinations
  2. Implement call routing as isolated state machine
  3. Use database transactions to prevent race conditions
  4. Add logging for every routing decision
- Test coverage: None visible. No test directory exists

**Email integration (incomplete and no implementation):**
- Files: `src/routes/email/index.js`, `src/services/email.js`
- Why fragile:
  - 4 endpoints are unimplemented stubs (returns empty/ok: true)
  - Token refresh logic exists in email.js but not used in routes
  - Microsoft Graph OAuth requires tenantId/clientId setup
  - No error recovery for email send failures
- Safe modification:
  1. Implement endpoints one at a time
  2. Create integration tests with mock Microsoft Graph API
  3. Add retry queue for failed sends
- Test coverage: None

**Audit logging system:**
- Files: `src/services/audit.js`, all routes that call it, `src/db/sqlite.js:142-159`
- Why fragile:
  - Called ad-hoc from routes (inconsistent coverage)
  - No transaction support (audit log may be written if main operation fails)
  - 2000-char truncation of old/new values (arbitrary limit, data loss risk)
  - No indexing strategy for efficient audit queries
- Safe modification:
  1. Implement audit as middleware wrapping all mutations
  2. Use database transactions to atomically apply changes + log
  3. Review truncation limit with compliance team
- Test coverage: None

**Document signing and OCR pipeline:**
- Files: `src/routes/documents/index.js`, referenced external services (not shown)
- Why fragile:
  - File upload handling with multer (1310 lines, multiple file types)
  - OCR integration with Claude API (no error recovery shown)
  - Document templates stored in Airtable (no local cache)
  - Signing workflow split across frontend/backend
- Safe modification:
  1. Extract file handling to separate module
  2. Implement OCR as async job queue with retry
  3. Cache templates locally with versioning
- Test coverage: None

---

## Scaling Limits

**SQLite write contention:**
- Current capacity: Better-sqlite3 in WAL mode handles ~100 writes/second safely
- Limit: Multiple processes (if horizontal scaling attempted) will lock database
- Scaling path:
  - Complete Supabase migration to lift SQLite limit entirely
  - If SQLite must remain: Use Railway persistent volume as single writer
  - Implement session storage in Redis if deployed across multiple servers
  - Cache frequently read tables (users, permissions) in memory or Redis

**Airtable API quota:**
- Current capacity: Free tier = 5 API requests per second, Pro = 30 req/sec
- Limit: At 4 req/sec (250ms limiter), hits Pro tier limit at ~7.5 concurrent users
- Scaling path:
  - Implement request batching to reduce API calls
  - Implement caching layer (Redis) for frequently read tables
  - Batch writes into fewer, larger requests
  - Monitor Airtable quota usage in production
  - Plan for Supabase migration before user growth

**Twilio concurrent call limit:**
- Current capacity: Twilio Free = 1 concurrent call, Standard = depends on plan
- Limit: Check Twilio account plan limits
- Scaling path: Ensure Twilio plan scales with expected concurrent call volume

**Socket.io memory usage:**
- Current: No limits on socket connections or message queue
- Limit: Each connection consumes ~1MB memory (rough estimate). 1000 concurrent = 1GB
- Scaling path:
  - Implement memory limits and eviction policy
  - Use Redis adapter for Socket.io to scale across processes
  - Implement connection heartbeat with timeout

---

## Dependencies at Risk

**better-sqlite3 (production dependency):**
- Risk: Native module requiring compilation. Installation can fail on systems without build tools (Python 3, make, g++)
- Impact: Deployment failures if Railway doesn't have build environment
- Migration plan: Supabase migration eliminates SQLite entirely

**Airtable (external service):**
- Risk: Rate limiting, API changes, vendor lock-in. Business dependent on Airtable availability
- Impact: Service degradation if Airtable down. Cost scaling with data volume
- Migration plan: Supabase migration already planned

**ElevenLabs (voice agent fallback):**
- Risk: API cost per use, service availability, model quality
- Impact: If ElevenLabs unavailable, calls drop to IVR fallback (if configured)
- Current status: No fallback visible in code
- Recommendation: Implement TwiML hold message fallback if ElevenLabs unavailable

**Node.js version constraints:**
- Risk: Package lock file pins exact versions. Dependency security updates may require Node version bump
- Current: `node --watch` requires Node 18.11+
- Recommendation: Add `.node-version` or `.nvmrc` file specifying minimum Node LTS

---

## Missing Critical Features

**Distributed tracing and observability:**
- Problem: 382 console.log statements. No structured logging, no request tracing, no error aggregation
- Blocks: Cannot debug production issues, performance analysis impossible, security audit trail incomplete
- Impact: High MTTR (mean time to recovery) for production incidents

**Error recovery and retry logic:**
- Problem: No retry mechanism for transient failures (network timeouts, rate limits)
- Blocks: API failures cause permanent data loss or incomplete operations
- Impact: Data inconsistency between Airtable and SQLite possible

**Request validation:**
- Problem: Routes accept data without schema validation
- Blocks: Invalid/malicious data could corrupt Airtable records
- Impact: Data quality issues, potential security vulnerabilities

**Rate limiting on API endpoints:**
- Problem: No per-user or per-IP rate limiting
- Blocks: Vulnerable to abuse (credential stuffing, DoS, resource exhaustion)
- Impact: Service availability risk

**Database transaction support:**
- Problem: Operations spanning multiple tables (SQLite + Airtable) may partially fail
- Blocks: Data inconsistency if operation fails midway
- Impact: Audit trail, roster + contact updates may mismatch

---

## Test Coverage Gaps

**No test files found:**
- Problem: Zero test coverage across entire codebase
- Files: No `*.test.js`, `*.spec.js`, or `/test/` directory visible
- Risk areas (priority order):
  1. **Hunt group routing** (`src/routes/voice/index.js:39-110`) - Complex state machine, multiple race conditions possible
  2. **Authentication** (`src/middleware/auth.js`) - Role validation, session handling, password hashing
  3. **Airtable service** (`src/services/airtable.js`) - Rate limiting, pagination, error handling
  4. **Audit logging** (`src/services/audit.js`) - Data consistency, completeness
  5. **Report generation** (`src/routes/reports/*`) - Data aggregation, formula accuracy
- Priority: HIGH - Any production system must have test coverage for auth, core business logic, and data integrity

**Integration test gaps:**
- No tests for Twilio webhook handling
- No tests for ElevenLabs callback processing
- No tests for file upload and OCR pipeline
- No tests for email sending (Microsoft Graph integration)

**End-to-end test gaps:**
- No scenarios testing complete workflows (e.g., roster creation → shift assignment → call routing)
- No load tests for concurrent operations
- No Airtable API failure simulation

---

*Concerns audit: 2026-02-26*
