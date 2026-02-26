# Testing Patterns

**Analysis Date:** 2026-02-26

## Test Framework

**Runner:**
- None configured
- No test framework detected (no Jest, Vitest, Mocha, etc.)
- No test files found in project (only in node_modules from dependencies)

**Assertion Library:**
- Not applicable — no testing infrastructure present

**Run Commands:**
- No test commands in `package.json`
- Suggested setup (not currently implemented):
  ```bash
  npm test                  # Run all tests (when configured)
  npm run test:watch       # Watch mode (when configured)
  npm run test:coverage    # Coverage report (when configured)
  ```

## Test File Organization

**Current State:**
- No tests exist in the codebase
- No test directory structure
- No test files co-located with source

**Recommended Location:**
- Co-located pattern would be `src/routes/[module]/__tests__/` for route tests
- Co-located pattern would be `src/services/__tests__/` for service tests
- Or centralized in `__tests__/` directory at project root

**Naming (Recommended):**
- `[name].test.js` for individual test files
- `[name].spec.js` as alternative

**Recommended Directory Structure:**
```
src/
├── routes/
│   ├── auth/
│   │   ├── __tests__/
│   │   │   └── auth.test.js
│   │   └── index.js
│   └── contacts/
│       ├── __tests__/
│       │   └── contacts.test.js
│       └── index.js
├── services/
│   ├── __tests__/
│   │   ├── airtable.test.js
│   │   ├── audit.test.js
│   │   └── permissions.test.js
│   └── ...
└── middleware/
    ├── __tests__/
    │   ├── auth.test.js
    │   └── error-handler.test.js
    └── ...
```

## Test Structure

**Recommended Suite Organization:**
```javascript
const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const { db } = require('../../../db/sqlite');

describe('auth routes', () => {
  describe('POST /api/auth/login', () => {
    it('should return 400 if email missing', async () => {
      // test code
    });

    it('should return 401 if password incorrect', async () => {
      // test code
    });

    it('should return token and user on successful login', async () => {
      // test code
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should delete session token', async () => {
      // test code
    });
  });
});
```

**Patterns (to implement):**
- **Setup:** Use `beforeEach()` to seed test data into SQLite test database
- **Teardown:** Use `afterEach()` to clear test data and reset state
- **Assertion:** Use `expect()` for assertions (Jest standard)
- **Group related tests:** Use `describe()` blocks by endpoint and scenario

## Mocking

**Recommended Framework:**
- Jest with built-in mock support
- No third-party mocking library needed

**Recommended Patterns:**

Mock external API calls:
```javascript
jest.mock('../../services/airtable', () => ({
  listRecords: jest.fn().mockResolvedValue([
    { id: 'rec123', fields: { 'Full Name': 'John Doe' } }
  ]),
  getRecord: jest.fn().mockResolvedValue({
    id: 'rec123',
    fields: { 'Full Name': 'John Doe' }
  }),
  TABLES: { CLIENTS: 'Clients' }
}));
```

Mock Twilio client:
```javascript
jest.mock('twilio', () => {
  return jest.fn(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({ sid: 'SM123' })
    },
    calls: {
      create: jest.fn().mockResolvedValue({ sid: 'CA123' })
    }
  }));
});
```

Mock environment variables:
```javascript
beforeEach(() => {
  process.env.TWILIO_ACCOUNT_SID = 'test-sid';
  process.env.TWILIO_AUTH_TOKEN = 'test-token';
});

afterEach(() => {
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
});
```

**What to Mock:**
- External API services (Airtable, Twilio, ElevenLabs, Anthropic, Microsoft Graph)
- Environment-dependent values (API keys, phone numbers)
- Date/time for reproducible tests (use `jest.useFakeTimers()`)
- Socket.io events for WebRTC testing

**What NOT to Mock:**
- Database queries — use test database instance instead
- Express middleware/routing — test full request/response cycle
- Internal helper functions — test with real implementation
- Password hashing — use real hash function for authentication tests
- Core Node.js modules — don't mock unless essential

## Fixtures and Factories

**Recommended Test Data Pattern:**

Factory function in `__tests__/fixtures/users.js`:
```javascript
function createUser(overrides = {}) {
  return {
    id: Math.floor(Math.random() * 10000),
    email: 'test@example.com',
    name: 'Test User',
    role: 'admin',
    permissions: JSON.stringify({}),
    ...overrides
  };
}

function createSession(userId) {
  return {
    token: 'test-token-' + userId,
    user_id: userId,
    created_at: new Date().toISOString()
  };
}

module.exports = { createUser, createSession };
```

Factory for Airtable records in `__tests__/fixtures/airtable.js`:
```javascript
function createContact(overrides = {}) {
  return {
    id: 'rec' + Math.random().toString(36).substr(2, 9),
    fields: {
      'Full Name': 'John Doe',
      'Email': 'john@example.com',
      'Phone': '+61412345678',
      'Type of Contact': 'Employee',
      ...overrides
    }
  };
}

module.exports = { createContact };
```

**Location:**
- `src/__tests__/fixtures/` for shared test data
- Import into test files: `const { createUser } = require('../fixtures/users');`

## Coverage

**Requirements:**
- None enforced currently
- Recommendation: Implement 70%+ coverage minimum for:
  - All route handlers (authentication, CRUD operations)
  - All service functions (Airtable, audit, permissions)
  - All middleware (auth, error-handler)

**View Coverage:**
```bash
npm run test:coverage
# Displays:
# - Lines: X% (lines executed)
# - Statements: X%
# - Functions: X%
# - Branches: X%
```

## Test Types

**Unit Tests (to implement):**
- **Scope:** Individual functions and services in isolation
- **Examples:**
  - `airtable.listRecords()` returns array of records
  - `permissions.getUserPermissions()` returns correct permission object
  - `audit.logAudit()` inserts record into database
  - Helper functions like `formatAUPhone()`, `arrayVal()` with various inputs
- **Approach:** Mock external dependencies, test single responsibility

**Integration Tests (to implement):**
- **Scope:** Full request/response cycle through route handlers
- **Examples:**
  - `POST /api/auth/login` with valid credentials returns token
  - `GET /api/contacts` with auth returns contact list from Airtable
  - `PATCH /api/tasks/:id` updates database and logs audit
  - Twilio webhook receives call, updates database, returns TwiML
- **Approach:** Use test database, mock external APIs, test middleware chain

**E2E Tests (not implemented):**
- Not used currently
- Would require separate test environment or staging server
- Not recommended for this architecture

## Common Patterns

**Async Testing:**

With Jest/async-await:
```javascript
it('should create user in database', async () => {
  const user = await createUserInDb('test@example.com', 'password123');
  expect(user.id).toBeDefined();
  expect(user.email).toBe('test@example.com');
});

it('should make API request with retry', async () => {
  const result = await airtable.listRecords('Contacts');
  expect(Array.isArray(result)).toBe(true);
});
```

With Jest/Promise chains:
```javascript
it('should fetch records paginated', (done) => {
  airtable.listRecords('Clients')
    .then(records => {
      expect(records.length).toBeGreaterThan(0);
      done();
    })
    .catch(done);
});
```

**Error Testing:**

Test error response from route:
```javascript
it('should return 401 when not authenticated', async () => {
  const response = await request(app)
    .post('/api/contacts')
    .send({})
    .expect(401);

  expect(response.body.error).toMatch(/Not authenticated/);
});
```

Test validation errors:
```javascript
it('should return 400 when email missing', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ password: 'test123' })
    .expect(400);

  expect(response.body.error).toMatch(/Email and password required/);
});
```

Test error handling in service:
```javascript
it('should return empty array on Airtable error', async () => {
  jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

  const result = await airtable.fetchAllFromTable('Contacts');

  expect(result).toEqual([]);
  expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Fetch error'));
});
```

## Test Infrastructure Recommendations

**To Add:**
1. **Package:** Install Jest
   ```bash
   npm install --save-dev jest
   ```

2. **Config file:** `jest.config.js`
   ```javascript
   module.exports = {
     testEnvironment: 'node',
     testMatch: ['**/__tests__/**/*.test.js'],
     collectCoverageFrom: [
       'src/**/*.js',
       '!src/server.js',
       '!src/**/*.test.js'
     ],
     coveragePathIgnorePatterns: ['/node_modules/']
   };
   ```

3. **Helper:** `__tests__/setup.js` for test database
   ```javascript
   const { db } = require('../src/db/sqlite');

   beforeAll(() => {
     // Initialize test database schema
     db.exec('DELETE FROM users; DELETE FROM sessions;');
   });

   afterEach(() => {
     // Clean up after each test
     db.exec('DELETE FROM users; DELETE FROM sessions; DELETE FROM audit_log;');
   });
   ```

4. **Scripts in package.json:**
   ```json
   {
     "test": "jest",
     "test:watch": "jest --watch",
     "test:coverage": "jest --coverage"
   }
   ```

---

*Testing analysis: 2026-02-26*
