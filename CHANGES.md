# Changes: Data Filtering Fix for Clients/Staff/Contacts Views

## Database Fix
- Updated 46 records in `contacts.type_of_contact` from "Independant Contractor" to "Independent Contractor"

## Backend: `src/routes/contacts/index.js`
- Renamed `ALLOWED_CONTACT_TYPES` to `STAFF_CONTACT_TYPES` with correct values: `['Employee', 'Independent Contractor', 'Jobseeker']`
- Added `supabaseContactToAirtable()` helper to merge flat Supabase columns back into Airtable-style `{id, fields}` format
- Added `isActiveContact()` helper using `data->>'Status of Contact'` JSONB field (not the useless `status` column)
- Fixed `mapClientToContact()` to map account types to correct statusOfContact values:
  - Active → "Active Contact"
  - Inactive → "Inactive Contact"
  - Prospect → "Active Contact"
- **Clients query** (`?type=client`): Changed filter from `at === 'Active'` to `at !== 'Inactive'` so Prospects are included
- **Staff query** (`?type=staff`): Added 'Jobseeker' to staff types, fixed "Independant" → "Independent" spelling
- **All Contacts query** (no type param): Removed type pre-filtering so ALL contact types are returned; removed status pre-filtering so frontend dropdown works correctly

## Backend: `src/routes/recruitment/index.js`
- Fixed 2 occurrences of "Independant Contractor" → "Independent Contractor" (lines 121, 718)

## Frontend: `public/index.html`
- Replaced all "Independant Contractor" → "Independent Contractor" (~15 occurrences)
- Replaced all `.indexOf("independant")` → `.indexOf("independent")` (~7 occurrences)
- Added active status filter to `renderFilteredContactList()` so Clients and Staff views only show active contacts
- Fixed duplicate "Independent Contractor" entry in contact type color map
- Added missing contact type colors: Support Coordinator, Plan Manager, Behaviour Practitioner, Child Safety Officer, Public Guardian, Public Trustee, Nominee or Guardian
- Fixed contractor signing `contactTypes` array to remove duplicate entry

## Intentionally Unchanged
- Airtable field/table name references in JSONB data lookups (e.g., `'SW Independant Contractor Rates'`) — these match original Airtable names stored in the database

## Verification Results
- All Contacts view: 1000 contacts + 136 clients = 1136 total (frontend filters by status dropdown)
- Clients view: 78 shown (71 Active + 7 Prospect, excludes 58 Inactive)
- Staff view: 148 active (98 Employee + 14 Independent Contractor + 36 Jobseeker)
- No "Independant" spelling remaining in type_of_contact column
- No CSS/layout changes (LAYOUT_LOCK.md compliant)
