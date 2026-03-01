# Changes: Supabase Data Sync — 1 March 2026

## Supabase Data Changes

### Clients Table (142 records)
- Set `account_type = 'Active'` for 41 clients (from CSV authoritative list)
- Set `account_type = 'Prospect'` for 7 clients (from CSV authoritative list)
- Set `account_type = 'Inactive'` for 94 remaining clients
- Handled 14 duplicate client records (kept richest data version, marked dupes Inactive)
- ALL 142 records now have a populated `account_type` column (was empty for all)

### Contacts Table (1585 records after inserts)
- Matched 190 unique active contacts from CSV against existing DB records
- Set `status = 'Active'` and correct `type_of_contact` for all 190 matched contacts
- Set `status = 'Inactive'` for all 1395 remaining contacts
- Inserted 141 new contact records for CSV names not found in DB
- No records deleted — all deactivated contacts marked Inactive only

### Active Contacts by Type (190 total)
- Employee: 84
- Independent Contractor: 12
- Jobseeker: 35
- Support Coordinator: 34
- Plan Manager: 13
- Public Guardian (OPG): 6
- Public Trustee: 1
- Child Safety Officer: 4
- Nominee or Guardian: 1

### Notes on CSV Matching
- Used case-insensitive TRIM matching for name comparison
- Handled double-space names (e.g., "Tasi  Gale" matched to "Tasi Gale")
- Handled deduplicated names (e.g., "Justine Justine Williams")
- "Andy Kebri" appeared twice in Employee CSV — kept one Active, duplicate Inactive
- "PAUL AKINSEYE" appeared twice in Jobseeker CSV — kept one Active
- "Plan Manager" appeared twice in Plan Manager CSV — single record matched

## Backend: `src/routes/contacts/index.js`

### Filtering Logic Rewrite
- `isActiveContact()` now uses `status` column (not JSONB `data['Status of Contact']`)
- `mapClientToContact()` now uses `account_type` column (not JSONB data field)
- **Clients query**: Uses `account_type IN ('Active', 'Prospect')` at DB level
- **Staff query**: Uses `status = 'Active'` AND `type_of_contact IN (...)` at DB level
- **All Contacts query**: Uses `status = 'Active'` for contacts + `account_type IN ('Active', 'Prospect')` for clients

### CRUD Operations Rewrite (Airtable → Supabase)
- `POST /api/contacts` now writes directly to Supabase (was Airtable)
- `GET /api/contacts/:id` now reads from Supabase (was Airtable)
- `PUT /api/contacts/:id` now updates Supabase with data JSONB merge (was Airtable)
- `DELETE /api/contacts/:id` now soft-deletes by setting `status = 'Inactive'` (was Airtable hard delete)

### All Fields Editable
- Added `buildSupabasePayload()` function to map frontend field names to Supabase columns + data JSONB
- Direct columns: full_name, first_name, last_name, email, phone, mobile, formatted_mobile, address, suburb, state, postcode, dob, type_of_contact, type_of_employment, job_title, department, team, training_status, photo_url, emergency_contact, emergency_phone, ndis_number
- Extended fields stored in `data` JSONB: gender, signingEmail, organisation, abn, abnEntityName, abnStatus, gstRegistered, notes, cultureEthnicity, languagesSpoken, emergencyContactRelationship, emergencyDaytimeNumber, emergencyAfterHoursNumber, managementNotes, directorNotes, hobbies, interests, medicalDisclosure, vehicleDetails, vehicleYear, summaryOfExperience, qualifications, referralSource, availabilityActive, availabilitySleepovers, canDoSleepovers, canDoPersonalCare, publicLiabilityInsurance, publicLiabilityExpiry, auslanSignLanguage, partnerSpouseInfo, kidsInfo, favouriteCoffee, favouriteHoliday, otherBackgroundInfo, employmentStartDate
- Compliance/certification fields in `data` JSONB: ndisWorkerScreeningCard, ndisWsExpiry, ndisWsStatus, driversLicense, driversLicenseExpiry, wwccBlueCard, wwccExpiry, firstAidCert, firstAidExpiry, cprCert, cprExpiry, carInsurance, carInsuranceExpiry, medicationAdminCert, medicationExpiry, diabetesTrainingCert, diabetesExpiry, infectionControlExpiry, handHygieneExpiry, teamTeachCert, teamTeachDate, covid19TrainingExpiry, dutyOfCareExpiry, handlingPatientDataExpiry, mentalHealthTrainingExpiry, mealtimeManagementExpiry, welcomeToDeltaDate, welcomeToDeltaExpiry, governanceOperationsDate, progressNotesTrainingDate, medicationsAdminDate, inductionCompletionDate, gaCompletionDate, gaDate, gaFeedback, gaComments, gaOutcome

### Mapper Enhancements
- `supabaseContactToAirtable()` now maps status, ndis_number, department, team, training_status columns
- PUT endpoint merges `data` JSONB (doesn't overwrite existing keys)

## Frontend: `public/index.html`

### Status Filter
- Reduced status dropdown options from 4 to 2: "Active Contact", "Inactive Contact"
- Updated `statusOfContactSelect()` dropdown to match

### Editable Fields
- Cultural Ethnicity: changed from `disabled` to editable with `id="editCultureEthnicity"`
- Job Title: changed from `disabled` to editable with `id="editJobTitle"`
- Date of Birth: changed from `disabled` to editable with `id="editDob"` (DD/MM/YYYY format)
- `saveContact()` function now collects jobTitle, dob, cultureEthnicity fields

### No Layout Changes
- All changes are data-filtering and field-editability only
- No CSS, HTML structure, grid layouts, or styling modifications
- LAYOUT_LOCK.md compliant

## Verification Results
- All Contacts view: 190 contacts + 48 clients = 238 total
- Clients view: 48 (41 Active + 7 Prospect)
- Staff view: 131 (84 Employee + 12 Independent Contractor + 35 Jobseeker)
- 0 invalid type_of_contact values on active contacts
- All modules load without errors
