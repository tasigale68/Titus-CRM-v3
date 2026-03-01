const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { db } = require('../../db/sqlite');
const { getUserPermissions } = require('../../services/permissions');
const { logAudit } = require('../../services/audit');
const airtable = require('../../services/database');
const sb = require('../../services/supabaseClient');
const env = require('../../config/env');

const router = express.Router();

router.use(authenticate);

var AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'All Contacts';
var AIRTABLE_VIEW_NAME = process.env.AIRTABLE_VIEW_NAME || 'Active Contacts 2026';

// ─── Airtable record mapper ──────────────────────────────
function mapAirtableRecord(rec) {
  var f = rec.fields || {};
  var keys = Object.keys(f);
  function findByPrefix(prefixes) {
    for (var p = 0; p < prefixes.length; p++) {
      if (f[prefixes[p]] !== undefined && f[prefixes[p]] !== null && f[prefixes[p]] !== '') return f[prefixes[p]];
    }
    for (var p = 0; p < prefixes.length; p++) {
      var pfx = prefixes[p].toLowerCase();
      for (var k = 0; k < keys.length; k++) {
        var kl = keys[k].toLowerCase();
        if (kl.indexOf(pfx) >= 0 && f[keys[k]] !== undefined && f[keys[k]] !== null && f[keys[k]] !== '') return f[keys[k]];
      }
    }
    return '';
  }
  function findArrayByPrefix(prefixes) {
    for (var p = 0; p < prefixes.length; p++) {
      if (Array.isArray(f[prefixes[p]]) && f[prefixes[p]].length > 0) return f[prefixes[p]];
    }
    for (var p = 0; p < prefixes.length; p++) {
      var pfx = prefixes[p].toLowerCase();
      for (var k = 0; k < keys.length; k++) {
        var kl = keys[k].toLowerCase();
        if (kl.indexOf(pfx) >= 0 && Array.isArray(f[keys[k]]) && f[keys[k]].length > 0) return f[keys[k]];
      }
    }
    return [];
  }
  var firstName = f['First Name'] || '';
  var lastName = f['Last Name'] || '';
  var fullName = f['Full Name'] || f.Name || f.name || '';
  if (!fullName && (firstName || lastName)) fullName = (firstName + ' ' + lastName).trim();
  return {
    id: rec.id,
    airtable_id: rec.id,
    name: fullName,
    firstName: firstName,
    lastName: lastName,
    phone: f['Formatted Mobile'] || f['Mobile'] || f['Final Phone'] || f.Phone || '',
    email: f['Email'] || f.email || '',
    signingEmail: f['Signing Email'] || f['Document Signing Email'] || f['Signing Email Address'] || '',
    contactType: f['Type of Contact (Single Select)'] || f['Type of Contact'] || f['Contact Type'] || f['Type'] || '',
    statusOfContact: f['Status of Contact'] || f['Status'] || '',
    gender: f['Gender'] || f['Gender (Single Select)'] || '',
    linkedToClient: f['Client Name (from Linked to Client)'] || f['Linked to Client'] || f['Linked Client'] || '',
    organisation: f['Organisation'] || f.Organisation || '',
    abn: f['ABN'] || f['ABN Number'] || '',
    abnEntityName: f['ABN Entity Name'] || '',
    abnStatus: f['ABN Status'] || '',
    gstRegistered: f['GST Registered'] || false,
    abnLastVerified: f['ABN Last Verified'] || '',
    jobTitle: f['Job Title'] || '',
    homeAddress: f['Home Address'] || '',
    suburb: f['Suburb'] || '',
    state: f['State'] || '',
    postcode: f['Postcode'] || '',
    emergencyContact: findByPrefix(['Emergency Contact Name']),
    emergencyRelationship: findByPrefix(['Relationship to you (Emergency Contact)', 'Relationship to you']),
    emergencyPhone: findByPrefix(['Day Time Number (Emergency Contact)', 'Day Time Number']),
    emergencyEmail: findByPrefix(['Emergency Contact Email', 'Emergency Email']),
    firstAidExpiry: findByPrefix(['First Aid Expiry Date (dd/mm/yy formula)', 'First Aid Expiry Date', 'What is the expiry date of your First Aid']),
    cprExpiry: findByPrefix(['CPR Expiry Date (formula)', 'CPR Expiry Date']),
    insuranceExpiry: findByPrefix(['Car Insurance Expiry', 'Insurance Expiry']),
    driversLicenseExpiry: findByPrefix(['D/License Expiry formula', 'D/License Expiry']),
    ndisExpiry: findByPrefix(['NDIS WS Expiry date (formula)', 'NDIS WS Expiry']),
    wwccExpiry: findByPrefix(['WWCC B/C Expiry formula', 'WWCC B/C Expiry']),
    notes: f.Notes || f.notes || '',
    photo: findArrayByPrefix(['PIC - SW Photo', 'PIC']).map(function (a) { return { url: a.url || '', thumbnailUrl: (a.thumbnails && a.thumbnails.large ? a.thumbnails.large.url : a.url) || '', name: a.filename || '' }; }),
    swProfile: findArrayByPrefix(['SW Profile', 'Support Worker Profile']).map(function (a) { return { url: a.url || '', name: a.filename || '', size: a.size || 0, type: a.type || '' }; }),
    cvResume: findArrayByPrefix(['CV/Resume', 'CV / Resume', 'Resume', 'CV']).map(function (a) { return { url: a.url || '', name: a.filename || '', size: a.size || 0, type: a.type || '' }; }),
    cvAiSummary: f['CV Ai Summary'] || '',
    cultureEthnicity: findByPrefix(['Cultural Ethnicity', 'Culture Ethnicity', 'Culture / Ethnicity', 'Ethnicity']),
    dob: findByPrefix(['Date of Birth', 'DOB', 'Birthday']),
    stageInRecruitment: findByPrefix(['Stage In Recruitment', 'Stage in Recruitment', 'Stage', 'Recruitment Stage']),
    dateApplied: findByPrefix(['Created time', 'Date Applied', 'Application Date']),
    appliedForRole: findByPrefix(['Applied for which Role?', 'Applied for Role', 'Applied For', 'Position Applied']),
    createdTime: f['Created time'] || f['Created Date & Time'] || f['Created Date'] || f['Created'] || '',
    employmentStartDate: findByPrefix(['Employment Start Date']),
    typeOfEmployment: findByPrefix(['Type of Employment']),
    employmentContract: (function () { var v = f['Employment Contract']; if (Array.isArray(v) && v.length > 0) return v.map(function (a) { return { url: a.url || '', name: a.filename || '', size: a.size || 0 }; }); return []; })(),
    secondaryEmployment: findByPrefix(['Secondary Employment']),
    detailsOfOtherEmployment: findByPrefix(['Details of Other Employment']),
    hasABN: findByPrefix(['Do you have a current ABN']),
    contractorPayRateName: findByPrefix(['Name (from Contractor Pay Rates)', 'Name (from SW Independant Contractor Rates)']),
    contractorWeekday: findByPrefix(['Weekday per hour (6am to 8pm) (from Contractor Pay Rates)', 'Weekday per hour (6am to 8pm) (from SW Independant Contractor Rates)']),
    contractorWeeknight: findByPrefix(['Weeknight (8pm to 6am) (from Contractor Pay Rates)', 'Weeknight (8pm to 6am) (from SW Independant Contractor Rates)']),
    contractorSaturday: findByPrefix(['Saturday (from Contractor Pay Rates)', 'Saturday (from SW Independant Contractor Rates)']),
    contractorSunday: findByPrefix(['Sunday (from Contractor Pay Rates)', 'Sunday (from SW Independant Contractor Rates)']),
    contractorPubHoliday: findByPrefix(['Public Holidays (from Contractor Pay Rates)', 'Public Holidays (from SW Independant Contractor Rates)']),
    contractorSleepover: findByPrefix(['Sleepover (per sleep) (from Contractor Pay Rates)', 'Sleepover (per sleep) (from SW Independant Contractor Rates)']),
    tfnPayLevel: findByPrefix(['Pay Level (from Casual TFN Employees)']),
    tfnDayRate: findByPrefix(['Day Rate (from Casual TFN Employees)']),
    tfnAfternoon: findByPrefix(['Afternoon (from Casual TFN Employees)']),
    tfnNight: findByPrefix(['Night (from Casual TFN Employees)']),
    tfnSaturday: findByPrefix(['Saturday (from Casual TFN Employees)']),
    tfnSunday: findByPrefix(['Sunday (from Casual TFN Employees)']),
    tfnPubHoliday: findByPrefix(['Pub Holidays (from Casual TFN Employees)']),
    tfnSleepover: findByPrefix(['Sleepover Allowance (from Casual TFN Employees)']),
    allFields: f,
  };
}

// ─── Helper: retry Airtable create, stripping unknown fields ──
function tryCreate(tableName, fieldsToSend) {
  return airtable.rawFetch(tableName, 'POST', '', { records: [{ fields: fieldsToSend }] })
    .then(function (data) {
      if (data.error && data.error.message && data.error.message.indexOf('Unknown field name') >= 0) {
        var match = data.error.message.match(/Unknown field name: "([^"]+)"/);
        if (match && match[1]) {
          console.log("Removing unknown field '" + match[1] + "' and retrying...");
          var retry = {};
          Object.keys(fieldsToSend).forEach(function (k) { if (k !== match[1]) retry[k] = fieldsToSend[k]; });
          return tryCreate(tableName, retry);
        }
      }
      return data;
    });
}

// ─── Supabase direct helpers ─────────────────────────────────
// Merge Supabase flat columns back into Airtable-style fields for mapAirtableRecord
function supabaseContactToAirtable(row) {
  var d = {};
  if (row.data) {
    var dataKeys = Object.keys(row.data);
    for (var i = 0; i < dataKeys.length; i++) d[dataKeys[i]] = row.data[dataKeys[i]];
  }
  if (row.full_name) d['Full Name'] = row.full_name;
  if (row.first_name) d['First Name'] = row.first_name;
  if (row.last_name) d['Last Name'] = row.last_name;
  if (row.email) d['Email'] = row.email;
  if (row.phone) d['Phone'] = row.phone;
  if (row.mobile) d['Mobile'] = row.mobile;
  if (row.formatted_mobile) d['Formatted Mobile'] = row.formatted_mobile;
  if (row.address) d['Home Address'] = row.address;
  if (row.suburb) d['Suburb'] = row.suburb;
  if (row.state) d['State'] = row.state;
  if (row.postcode) d['Postcode'] = row.postcode;
  if (row.dob) d['Date of Birth'] = row.dob;
  if (row.type_of_contact) d['Type of Contact (Single Select)'] = row.type_of_contact;
  if (row.type_of_employment) d['Type of Employment'] = row.type_of_employment;
  if (row.job_title) d['Job Title'] = row.job_title;
  if (row.photo_url) d['PIC - SW Photo'] = [{ url: row.photo_url }];
  if (row.emergency_contact) d['Emergency Contact Name'] = row.emergency_contact;
  if (row.emergency_phone) d['Day Time Number (Emergency Contact)'] = row.emergency_phone;
  return { id: row.id, fields: d };
}

// Check if a Supabase contact row is "active" based on data JSONB
function isActiveContact(row) {
  var d = row.data || {};
  var status = d['Status of Contact'] || '';
  if (!status) return true; // No status field = treat as active
  return status === 'Active Contact';
}

// Map a Supabase clients row to the contact format the frontend expects
function mapClientToContact(row) {
  var d = row.data || {};
  var name = row.client_name || row.full_name || '';
  if (Array.isArray(name)) name = name[0] || '';
  var at = d['Account Type:  Active or Inactive or Propsect'] || d['Account Type'] || '';
  var contactType = 'NDIS Client (Active)';
  if (at.toLowerCase().indexOf('prospect') >= 0) contactType = 'NDIS Client (Prospect)';
  else if (at.toLowerCase().indexOf('inactive') >= 0) contactType = 'NDIS Client (Inactive)';
  return {
    id: row.id, airtable_id: row.airtable_id || row.id,
    name: name,
    firstName: name.split(' ')[0] || '',
    lastName: name.split(' ').slice(1).join(' ') || '',
    phone: row.phone || row.mobile || d['Phone'] || d['Mobile'] || d['Phone Number'] || '',
    email: row.email || d['Email'] || d['Email Address'] || '',
    contactType: contactType,
    statusOfContact: at === 'Inactive' ? 'Inactive Contact' : (at === 'Prospect' ? 'Active Contact' : (at && at !== 'Active' ? at : 'Active Contact')),
    gender: d['Client Gender'] || d['Gender'] || '',
    suburb: row.suburb || d['Suburb'] || d['Location'] || '',
    state: row.state || d['State'] || '',
    postcode: row.postcode || d['Postcode'] || '',
    organisation: '', notes: '', photo: [], linkedToClient: '',
    allFields: d,
  };
}

// Staff type_of_contact values
var STAFF_CONTACT_TYPES = [
  'Employee',
  'Independent Contractor',
  'Jobseeker'
];

// ═══════════════════════════════════════════════════════════
//  GET /api/contacts — list contacts (Supabase direct queries)
// ═══════════════════════════════════════════════════════════
router.get('/', function (req, res) {
  var fullUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.user_id);
  var perms = fullUser ? getUserPermissions(fullUser) : { client_filter: 'all' };

  var typeFilter = (req.query.type || '').toLowerCase();

  // ─── Clients submenu: NDIS Client (Active) + NDIS Client (Prospect) ───
  if (typeFilter === 'client' || typeFilter === 'ndis client') {
    sb.query('clients', 'GET', {
      select: '*',
      order: 'client_name.asc',
      limit: 5000
    }).then(function (rows) {
      var records = (rows || []).filter(function (r) {
        if (!r.client_name || !r.client_name.trim()) return false;
        var d = r.data || {};
        var at = d['Account Type:  Active or Inactive or Propsect'] || d['Account Type'] || '';
        // Include Active, Prospect, and empty (assumed active). Exclude Inactive.
        return at !== 'Inactive';
      }).map(mapClientToContact);
      console.log('[Contacts] Clients submenu: ' + records.length + ' clients (active + prospect)');
      res.json(records);
    }).catch(function (err) {
      console.error('[Contacts] Clients fetch error:', err.message);
      res.json([]);
    });
    return;
  }

  // ─── Staff submenu: Employee + Independent Contractor + Jobseeker, Active only ───
  if (typeFilter === 'staff' || typeFilter === 'employee') {
    sb.query('contacts', 'GET', {
      select: '*',
      in_: { type_of_contact: STAFF_CONTACT_TYPES },
      order: 'full_name.asc',
      limit: 5000
    }).then(function (rows) {
      var records = (rows || []).filter(isActiveContact).map(function (r) {
        return mapAirtableRecord(supabaseContactToAirtable(r));
      });
      console.log('[Contacts] Staff submenu: ' + records.length + ' active staff');
      res.json(records);
    }).catch(function (err) {
      console.error('[Contacts] Staff fetch error:', err.message);
      res.json([]);
    });
    return;
  }

  // ─── All Contacts: fetch ALL contacts + ALL clients, frontend handles status filter ───
  Promise.all([
    sb.query('contacts', 'GET', {
      select: '*',
      order: 'full_name.asc',
      limit: 5000
    }),
    sb.query('clients', 'GET', {
      select: '*',
      order: 'client_name.asc',
      limit: 5000
    })
  ]).then(function (results) {
    var contactRows = results[0] || [];
    var clientRows = results[1] || [];

    // Map all contacts (no status pre-filter — frontend handles status dropdown)
    var contacts = contactRows.map(function (r) {
      return mapAirtableRecord(supabaseContactToAirtable(r));
    });

    // Map all clients with name
    var clients = clientRows.filter(function (r) {
      return r.client_name && r.client_name.trim();
    }).map(mapClientToContact);

    var records = contacts.concat(clients);

    // Apply any additional ?type= filter for specific contact types
    if (typeFilter && typeFilter !== 'all') {
      records = records.filter(function (r) {
        return (r.contactType || '').toLowerCase().indexOf(typeFilter) >= 0;
      });
    }

    console.log('[Contacts] All view: ' + contacts.length + ' contacts + ' + clients.length + ' clients = ' + records.length + ' total');
    res.json(records);
  }).catch(function (err) {
    console.error('[Contacts] Main fetch error:', err.message);
    res.json([]);
  });
});

// ═══ GET /api/contacts/debug-fields ═══
router.get('/debug-fields', function (req, res) {
  if (!env.airtable.apiKey) return res.json({ error: 'Not configured' });
  var params = '?pageSize=3';
  if (AIRTABLE_VIEW_NAME) params += '&view=' + encodeURIComponent(AIRTABLE_VIEW_NAME);
  airtable.rawFetch(AIRTABLE_TABLE_NAME, 'GET', params).then(function (data) {
    if (data.error) return res.json({ error: data.error });
    var result = (data.records || []).map(function (r) {
      return { id: r.id, fieldNames: Object.keys(r.fields || {}).sort(), fields: r.fields };
    });
    res.json(result);
  }).catch(function (err) { res.json({ error: err.message }); });
});

// ═══ GET /api/contacts/history ═══
router.get('/history', function (req, res) {
  if (!env.airtable.apiKey) return res.json([]);
  var email = req.query.email;
  var name = req.query.name;
  var clientName = req.query.clientName;
  if (!email && !name && !clientName) return res.json([]);

  var contactHistoryTable = clientName ? 'Client Contact History' : 'Employee Contact History';
  var viewName = clientName ? 'Grid view - Latest Date first' : 'by Support Worker Name';
  var params = '?pageSize=100&view=' + encodeURIComponent(viewName);
  var filterParts = [];
  if (clientName) {
    filterParts.push("FIND('" + clientName.replace(/'/g, "\\'") + "', {Client Name})");
    filterParts.push("FIND('" + clientName.replace(/'/g, "\\'") + "', ARRAYJOIN({Client Name (from Client)}))");
  } else {
    if (email) filterParts.push("FIND('" + email.replace(/'/g, "\\'") + "', ARRAYJOIN({Email (from Support Worker Name)}))");
    if (name) filterParts.push("FIND('" + name.replace(/'/g, "\\'") + "', ARRAYJOIN({Support Worker Name}))");
  }
  var formula = filterParts.length > 1 ? 'OR(' + filterParts.join(',') + ')' : filterParts[0];
  params += '&filterByFormula=' + encodeURIComponent(formula);

  airtable.rawFetch(contactHistoryTable, 'GET', params)
    .then(function (data) {
      if (data.error) { console.error('Contact History error:', data.error); return res.json([]); }
      var records = (data.records || []).map(function (rec) {
        var f = rec.fields || {};
        return {
          id: rec.id,
          date: f['Date & Time of...'] || f['Day of Contact'] || f['Date & Time of Contact'] || f['Date'] || '',
          workerName: f['Employees Full Name'] || f['Full Name (Formula)'] || (function () { var n = f['Full Name (from Support Worker Name)']; if (Array.isArray(n)) return n[0] || ''; return n || ''; }()) || '',
          staffName: (function () { var n = f['Staff Name']; if (Array.isArray(n)) return n.join(', '); return n || ''; }()),
          method: f['Method of Contact'] || [],
          reason: f['Reason for Contact'] || [],
          summary: f['Summarise'] || f['Summary'] || f['Notes'] || '',
          duration: f['Duration of work to...'] || f['Duration of work to complete contact'] || f['Duration'] || '',
          assignee: (function () { var n = f['Assignee']; if (Array.isArray(n)) return n[0] || ''; return n || ''; }()),
          jobTitle: f['Job Title'] || f['Job Title (Formula)'] || '',
          files: (f['Upload File here'] || f['Attachments'] || []).map(function (att) {
            return { name: att.filename || 'File', url: att.url || '', type: att.type || '', size: att.size || 0 };
          }),
          lastModified: f['Last modified'] || '',
          allFields: f,
        };
      });
      records.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
      res.json(records);
    })
    .catch(function (err) { console.error('Contact History error:', err); res.json([]); });
});

// ═══ POST /api/contacts/history — add a new contact history note ═══
router.post('/history', function (req, res) {
  if (!env.airtable.apiKey) return res.json({ error: 'Airtable not configured' });
  var type = req.body.type || 'staff'; // 'client' or 'staff'
  var tableName = type === 'client' ? 'Client Contact History' : 'Employee Contact History';
  var fields = {};
  fields['Date & Time of Contact'] = new Date().toISOString();
  if (req.body.method) fields['Method of Contact'] = [req.body.method];
  if (req.body.reason) fields['Reason for Contact'] = [req.body.reason];
  if (req.body.summary) fields['Summarise'] = req.body.summary;
  if (req.body.name && type === 'staff') fields['Employees Full Name'] = req.body.name;
  if (req.body.name && type === 'client') fields['Client Name'] = req.body.name;
  if (req.user && req.user.name) fields['Staff Name'] = req.user.name;

  airtable.rawFetch(tableName, 'POST', '', { records: [{ fields: fields }] })
    .then(function (data) {
      if (data.error) return res.json({ error: data.error.message || 'Failed to create' });
      if (data.records && data.records.length > 0) {
        res.json({ ok: true, id: data.records[0].id });
      } else {
        res.json({ error: 'No record created' });
      }
    })
    .catch(function (err) { res.json({ error: err.message }); });
});

// ═══ GET /api/contacts/progress-notes ═══
router.get('/progress-notes', function (req, res) {
  if (!env.airtable.apiKey) return res.json([]);
  var email = req.query.email;
  var clientName = req.query.clientName;
  if (!email && !clientName) return res.json([]);
  var tableName = process.env.AIRTABLE_PROGRESS_NOTES_TABLE || 'Progress Notes';
  var viewName = clientName ? 'Progress Note by Client' : 'Progress Note by Employee';
  var params = '?pageSize=100&view=' + encodeURIComponent(viewName);
  if (clientName) {
    params += '&filterByFormula=' + encodeURIComponent("OR(FIND('" + clientName.replace(/'/g, "\\'") + "', {Client Name (from Client)}), FIND('" + clientName.replace(/'/g, "\\'") + "', {Client Name}))");
  } else {
    params += '&filterByFormula=' + encodeURIComponent("FIND('" + email.replace(/'/g, "\\'") + "', {Support Workers Name})");
  }
  airtable.rawFetch(tableName, 'GET', params)
    .then(function (data) {
      if (data.error) { console.error('Progress Notes error:', data.error); return res.json([]); }
      var records = (data.records || []).map(function (rec) {
        var f = rec.fields || {};
        var kmsRaw = f['How many Kilometres did you transport Client in your vehicle today and list TO & FROM addresses?'] || f['KMs'] || '';
        var kmsNum = 0;
        if (typeof kmsRaw === 'number') kmsNum = kmsRaw;
        else if (typeof kmsRaw === 'string') { var m = kmsRaw.match(/[\d.]+/); if (m) kmsNum = parseFloat(m[0]) || 0; }
        return {
          id: rec.id,
          startDate: f['Start Date & Time Formula'] || f['Start Date and Time'] || f['Date'] || '',
          endDate: f['End Date & Time Formula'] || f['End Date and Time'] || '',
          totalHours: f['Total Hours'] || f['Hours'] || '',
          client: (function () { var n = f['Client Name (from Client)'] || f['Full Name (from Client)'] || f['Client Name (from Client Name)'] || f['Name (from Client)'] || f['Client']; if (Array.isArray(n)) return n[0] || ''; return n || ''; }()),
          clientId: (function () { var n = f['Unique Client ID (from Client)']; if (Array.isArray(n)) return n[0] || ''; return n || ''; }()),
          workerName: Array.isArray(f['Full Name (from Employees)']) ? f['Full Name (from Employees)'][0] : (f['Full Name (from Employees)'] || ''),
          transport: f['Did you transport the client in your vehicle today?'] || f['Transport'] || '',
          created: f['Created'] || f['Created Formula'] || '',
          shiftType: f['Shift Type'] || f['Service Type'] || '',
          notes: f['Progress Note'] || f['Notes'] || f['Summary'] || '',
          risks: f['Risks or Concerns'] || f['Risks'] || f['Risk'] || '',
          kms: kmsNum, kmsRaw: kmsRaw,
          from: f['Travel From'] || f['From'] || '', to: f['Travel To'] || f['To'] || '',
          files: (f['Attachments'] || f['Files'] || f['Upload'] || []).map(function (att) {
            return { name: att.filename || 'File', url: att.url || '', type: att.type || '' };
          }),
          allFields: f,
        };
      });
      records.sort(function (a, b) { return (b.startDate || '').localeCompare(a.startDate || ''); });
      res.json(records);
    })
    .catch(function (err) { console.error('Progress Notes error:', err); res.json([]); });
});

// ═══ POST /api/contacts/progress-notes ═══
router.post('/progress-notes', function (req, res) {
  if (!env.airtable.apiKey) return res.status(500).json({ error: 'Airtable not configured' });
  var b = req.body;
  var tableName = process.env.AIRTABLE_PROGRESS_NOTES_TABLE || 'Progress Notes';
  var fields = {};
  if (b.startDate) fields['Start Date and Time'] = b.startDate;
  if (b.endDate) fields['End Date and Time'] = b.endDate;
  if (b.shiftType) fields['Shift Type'] = b.shiftType;
  if (b.progressNote) fields['Progress Note'] = b.progressNote;
  if (b.transport) fields['Did you transport the client in your vehicle today?'] = b.transport;
  if (b.kms !== undefined && b.kms !== '' && b.kms !== null) fields['KMs'] = parseFloat(b.kms) || 0;
  if (b.travelFrom) fields['Travel From'] = b.travelFrom;
  if (b.travelTo) fields['Travel To'] = b.travelTo;
  if (b.risks) fields['Risks or Concerns'] = b.risks;
  if (b.status) fields['Status'] = b.status;
  if (b.attachments && Array.isArray(b.attachments) && b.attachments.length > 0) {
    fields['Attachments'] = b.attachments.map(function (a) { return { url: a.url, filename: a.filename || undefined }; });
  }
  if (b.clientId) fields['Client'] = [b.clientId];
  if (b.employeeId) fields['Employees'] = [b.employeeId];

  tryCreate(tableName, fields)
    .then(function (data) {
      if (data.error) return res.status(400).json({ error: data.error.message || 'Airtable error' });
      res.json({ success: true, record: data.records ? data.records[0] : null });
    })
    .catch(function (err) { res.status(500).json({ error: err.message }); });
});

// ═══ GET /api/contacts/incidents ═══
router.get('/incidents', function (req, res) {
  if (!env.airtable.apiKey) return res.json([]);
  var email = req.query.email;
  var clientName = req.query.clientName;
  if (!email && !clientName) return res.json([]);
  var tableName = 'IR Reports 2025';
  var formula;
  if (clientName) {
    formula = "OR(FIND('" + clientName.replace(/'/g, "\\'") + "', {Client Name (from Client Name)}), FIND('" + clientName.replace(/'/g, "\\'") + "', {Full Name (from Client)}))";
  } else {
    formula = "FIND('" + email.replace(/'/g, "\\'") + "', {Person completing IR})";
  }
  var params = '?pageSize=100&view=' + encodeURIComponent('Grid view');
  params += '&filterByFormula=' + encodeURIComponent(formula);

  airtable.rawFetch(tableName, 'GET', params)
    .then(function (data) {
      if (data.error) { console.error('IR Reports error:', data.error); return res.json([]); }
      var records = (data.records || []).map(function (rec) {
        var f = rec.fields || {};
        return {
          id: rec.id,
          date: f['Date & Time of Incident FORMULA'] || f['Date & Time of Incident'] || f['Date'] || '',
          categories: f['Incident Categories'] || f['Category'] || [],
          client: (function () { var n = f['Client Name (from Client Name)'] || f['Full Name (from Client)']; if (Array.isArray(n)) return n.join(', '); return n || ''; }()),
          reporter: Array.isArray(f['Full Name (from Person completing IR)']) ? f['Full Name (from Person completing IR)'][0] : (f['Full Name (from Person completing IR)'] || ''),
          reportable: f['Is this a Reportable Incident to the NDIS Quality Safeguards Commission??'] || f['Reportable Incident'] || '',
          type: f['Type of Incident'] || f['Incident Type'] || '',
          severity: f['Severity'] || f['Risk Level'] || '',
          status: f['Status'] || f['IR Status'] || '',
          description: f['Description'] || f['Summary'] || f['Details'] || f['What Happened'] || '',
          location: f['Location'] || f['Location of Incident'] || '',
          actionTaken: f['Action Taken'] || f['Immediate Action'] || '',
          followUp: f['Follow Up'] || f['Follow Up Actions'] || '',
          witnesses: f['Witnesses'] || '',
          injuries: f['Injuries'] || f['Injury Details'] || '',
          files: (f['Attachments'] || f['Files'] || f['Upload'] || f['Upload File here'] || []).map(function (att) {
            return { name: att.filename || 'File', url: att.url || '', type: att.type || '', size: att.size || 0 };
          }),
          allFields: f,
        };
      });
      records.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
      res.json(records);
    })
    .catch(function (err) { console.error('IR Reports error:', err); res.json([]); });
});

// ═══ POST /api/contacts/incidents ═══
router.post('/incidents', function (req, res) {
  if (!env.airtable.apiKey) return res.status(500).json({ error: 'Airtable not configured' });
  var b = req.body;
  var fields = {};
  if (b.dateTime) fields['Date & Time of Incident'] = b.dateTime;
  if (b.incidentType) fields['Type of Incident'] = b.incidentType;
  if (b.categories) fields['Incident Categories'] = Array.isArray(b.categories) ? b.categories : [b.categories];
  if (b.severity) fields['Severity'] = b.severity;
  if (b.reportable) fields['Is this a Reportable Incident to the NDIS Quality Safeguards Commission??'] = b.reportable;
  if (b.location) fields['Location'] = b.location;
  if (b.description) fields['Description'] = b.description;
  if (b.actionTaken) fields['Action Taken'] = b.actionTaken;
  if (b.followUp) fields['Follow Up'] = b.followUp;
  if (b.witnesses) fields['Witnesses'] = b.witnesses;
  if (b.injuries) fields['Injuries'] = b.injuries;
  if (b.status) fields['Status'] = b.status;
  if (b.attachments && Array.isArray(b.attachments) && b.attachments.length > 0) {
    fields['Attachments'] = b.attachments.map(function (a) { return { url: a.url, filename: a.filename || undefined }; });
  }
  if (b.clientId) fields['Client Name'] = [b.clientId];
  if (b.reporterId) fields['Person completing IR'] = [b.reporterId];

  tryCreate('IR Reports 2025', fields)
    .then(function (data) {
      if (data.error) return res.status(400).json({ error: data.error.message || 'Airtable error' });
      res.json({ success: true, record: data.records ? data.records[0] : null });
    })
    .catch(function (err) { res.status(500).json({ error: err.message }); });
});

// ═══ GET /api/contacts/kms ═══
router.get('/kms', function (req, res) {
  if (!env.airtable.apiKey) return res.json([]);
  var email = req.query.email;
  if (!email) return res.json([]);
  var tableName = process.env.AIRTABLE_PROGRESS_NOTES_TABLE || 'Progress Notes';
  var viewName = 'Progress Note YES to Transport KM';
  var formula = "FIND('" + email.replace(/'/g, "\\'") + "', {Support Workers Name})";
  var params = '?pageSize=100&view=' + encodeURIComponent(viewName) + '&filterByFormula=' + encodeURIComponent(formula);

  airtable.rawFetch(tableName, 'GET', params)
    .then(function (data) {
      if (data.error) { console.error('KMs error:', data.error); return res.json([]); }
      var records = (data.records || []).map(function (rec) {
        var f = rec.fields || {};
        var kmsRaw = f['How many Kilometres did you transport Client in your vehicle today and list TO & FROM addresses?'] || f['KMs'] || f['Kilometers'] || '';
        var kmsNum = 0;
        if (typeof kmsRaw === 'number') kmsNum = kmsRaw;
        else if (typeof kmsRaw === 'string') { var m = kmsRaw.match(/[\d.]+/); if (m) kmsNum = parseFloat(m[0]) || 0; }
        return {
          id: rec.id,
          date: f['Start Date & Time Formula'] || f['Start Date and Time'] || f['Date'] || '',
          client: (function () { var n = f['Client Name (from Client)'] || f['Full Name (from Client)'] || f['Client Name']; if (Array.isArray(n)) return n[0] || ''; return n || ''; }()),
          workerName: (function () { var n = f['Full Name (from Employees)']; if (Array.isArray(n)) return n[0] || ''; return n || ''; }()),
          kms: kmsNum, kmsRaw: kmsRaw,
          from: f['Travel From'] || f['From'] || '', to: f['Travel To'] || f['To'] || '',
        };
      });
      records.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
      res.json(records);
    })
    .catch(function (err) { console.error('KMs error:', err); res.json([]); });
});

// ═══ Health tracking charts ═══
function clientChartEndpoint(tableName, mapFn) {
  return function (req, res) {
    if (!env.airtable.apiKey) return res.json([]);
    var clientName = req.query.clientName;
    if (!clientName) return res.json([]);
    var params = '?pageSize=100&filterByFormula=' + encodeURIComponent("FIND('" + clientName.replace(/'/g, "\\'") + "', {Client Name})");
    airtable.rawFetch(tableName, 'GET', params)
      .then(function (data) {
        if (data.error) { console.error(tableName + ' error:', data.error); return res.json([]); }
        var records = (data.records || []).map(function (rec) { return mapFn(rec); });
        res.json(records);
      })
      .catch(function (err) { console.error(tableName + ' error:', err); res.json([]); });
  };
}

router.get('/sleep-chart', clientChartEndpoint('Client Sleep Chart', function (rec) {
  var f = rec.fields || {};
  return {
    id: rec.id,
    client: (function () { var n = f['Client Name (from Client Name)'] || f['Client Name']; if (Array.isArray(n)) return n[0] || ''; return n || ''; }()),
    date: f['Date'] || f['Sleep Date'] || '',
    bedTime: f['Bed Time'] || f['Time to Bed'] || '',
    wakeTime: f['Wake Time'] || f['Time Woke Up'] || '',
    hoursSlept: f['Hours Slept'] || f['Total Hours'] || '',
    quality: f['Sleep Quality'] || f['Quality'] || '',
    notes: f['Notes'] || f['Comments'] || f['Sleep Notes'] || '',
    disturbances: f['Disturbances'] || f['Night Disturbances'] || '',
    staff: (function () { var n = f['Full Name (from Staff)'] || f['Staff']; if (Array.isArray(n)) return n[0] || ''; return n || ''; }()),
    allFields: f,
  };
}));

router.get('/bowel-chart', clientChartEndpoint('Bowel Chart', function (rec) {
  var f = rec.fields || {};
  return {
    id: rec.id,
    client: (function () { var n = f['Client Name (from Client Name)'] || f['Client Name']; if (Array.isArray(n)) return n[0] || ''; return n || ''; }()),
    dateTime: f['Bowel Movement Date & Time'] || f['Date & Time'] || '',
    dateFormula: f['Bowel Movement Date (Formula)'] || '',
    size: f['Size of Bowel Movement'] || '', type: f['Type of Bowel Movement'] || '',
    comments: f['Comments'] || '',
    attachments: (f['Attachments'] || []).map(function (a) { return { name: a.filename || 'File', url: a.url || '', type: a.type || '' }; }),
    submitted: f['Date & Time Submitted'] || '',
    staff: (function () { var n = f['Full Name (from Staff)'] || f['Staff']; if (Array.isArray(n)) return n[0] || ''; return n || ''; }()),
    allFields: f,
  };
}));

router.get('/fluid-intake', clientChartEndpoint('Fluid Intake Diary', function (rec) {
  var f = rec.fields || {};
  return {
    id: rec.id,
    client: (function () { var n = f['Client Full Name (from Client Name)'] || f['Client Name']; if (Array.isArray(n)) return n[0] || ''; return n || ''; }()),
    dateTime: f['Date & Time'] || '',
    dateFormatted: f['Date & Time (with Day)'] || '',
    amountMl: f['Amount in mL'] || 0,
    fluidType: f['Type of Fluid'] || '',
    allFields: f,
  };
}));

router.get('/consumables', clientChartEndpoint('Client Consumables', function (rec) {
  var f = rec.fields || {};
  return {
    id: rec.id,
    client: (function () { var n = f['Client Name (from Client Name)'] || f['Client Full Name (from Client Name)'] || f['Client Name']; if (Array.isArray(n)) return n[0] || ''; return n || ''; }()),
    item: f['Supply Item'] || '',
    dateOrdered: f['Date Ordered'] || '',
    qtyOrdered: f['Qty Ordered'] || '',
    orderedBy: (function () { var n = f['Full Name (from Ordered By / Notified Mgmt)'] || f['Ordered By / Notified Mgmt']; if (Array.isArray(n)) return n[0] || ''; return n || ''; }()),
    dateArrived: f['Date Arrived'] || '',
    receivedBy: (function () { var n = f['Full Name (from Received By (On Shift))'] || f['Received By (On Shift)']; if (Array.isArray(n)) return n[0] || ''; return n || ''; }()),
    qtyConfirmed: f['Qty Confirmed & Signed Off'] || '',
    comments: f['Comments'] || '',
    allFields: f,
  };
}));

router.get('/behaviours', clientChartEndpoint('QR Code Data - Behaviours', function (rec) {
  var f = rec.fields || {};
  return {
    id: rec.id,
    client: (function () { var n = f['Client Name (from Client Name)'] || f['Client Name']; if (Array.isArray(n)) return n[0] || ''; return n || ''; }()),
    dateTime: f['Date & Time'] || '',
    location: f['Location/Environment'] || '',
    trigger: f['Trigger or event, before the behaviour'] || '',
    verbal: f['Behaviours (Verbal)'] || '',
    physical: f['Behaviours (Physical)'] || '',
    duration: f['Duration of Behaviour'] || '',
    deescalation: f['De-escalation strategies used'] || '',
    outcome: f['Outcome / Resolution'] || '',
    comments: f['Comments'] || '',
    attachments: (f['Attachments'] || []).map(function (a) { return { name: a.filename || 'File', url: a.url || '', type: a.type || '' }; }),
    created: f['Created'] || '',
    allFields: f,
  };
}));

// ═══ GET /api/contacts/conversations (call/SMS history from SQLite) ═══
router.get('/conversations', function (req, res) {
  var phone = req.query.phone;
  if (!phone) return res.json({ calls: [], sms: [] });
  var calls = db.prepare("SELECT * FROM calls WHERE from_number LIKE ? OR to_number LIKE ? ORDER BY created_at DESC LIMIT 50").all('%' + phone + '%', '%' + phone + '%');
  var sms = db.prepare("SELECT * FROM sms_messages WHERE from_number LIKE ? OR to_number LIKE ? ORDER BY created_at DESC LIMIT 50").all('%' + phone + '%', '%' + phone + '%');
  res.json({ calls: calls, sms: sms });
});

// ═══ Distance estimation ═══
router.get('/distance', function (req, res) {
  var from = req.query.from;
  var to = req.query.to;
  if (!from || !to) return res.json({ error: 'from and to required' });
  var gmKey = process.env.GOOGLE_MAPS_API_KEY || '';
  var mapsUrl = 'https://www.google.com/maps/dir/' + encodeURIComponent(from) + '/' + encodeURIComponent(to);
  if (!gmKey) return res.json({ estimated: null, mapsUrl: mapsUrl, note: 'No Google Maps API key configured' });

  var dmUrl = 'https://maps.googleapis.com/maps/api/distancematrix/json?origins=' + encodeURIComponent(from) + '&destinations=' + encodeURIComponent(to) + '&units=metric&region=au&key=' + gmKey;
  fetch(dmUrl).then(function (r) { return r.json(); }).then(function (data) {
    if (data.rows && data.rows[0] && data.rows[0].elements && data.rows[0].elements[0]) {
      var el = data.rows[0].elements[0];
      if (el.status === 'OK') {
        return res.json({ estimated: parseFloat((el.distance.value / 1000).toFixed(1)), duration: el.duration.text, mapsUrl: mapsUrl, distanceText: el.distance.text });
      }
    }
    res.json({ estimated: null, mapsUrl: mapsUrl, note: 'Could not calculate distance' });
  }).catch(function () { res.json({ estimated: null, mapsUrl: mapsUrl, note: 'Distance API error' }); });
});

// ═══ POST /api/contacts — create contact ═══
router.post('/', function (req, res) {
  if (!env.airtable.apiKey) return res.status(500).json({ error: 'Airtable not configured' });

  var fields = {};
  if (req.body.firstName) fields['First Name'] = req.body.firstName;
  if (req.body.lastName) fields['Last Name'] = req.body.lastName;
  if (req.body.name && !req.body.firstName && !req.body.lastName) fields['Full Name'] = req.body.name;
  if (req.body.phone) fields['Mobile'] = req.body.phone;
  if (req.body.email) fields['Email'] = req.body.email;
  if (req.body.contactType) fields['Type of Contact (Single Select)'] = req.body.contactType;

  var validStatuses = ['Active Contact', 'Draft', 'Inactive Contact', 'Archive (Gus only)'];
  if (req.body.statusOfContact) {
    fields['Status of Contact'] = validStatuses.indexOf(req.body.statusOfContact) >= 0 ? req.body.statusOfContact : 'Active Contact';
  }
  if (req.body.gender) fields['Gender'] = req.body.gender;
  if (req.body.organisation) fields['Organisation'] = req.body.organisation;
  if (req.body.linkedToClient && Array.isArray(req.body.linkedToClient)) fields['Linked to Client'] = req.body.linkedToClient;
  if (req.body.homeAddress) fields['Home Address'] = req.body.homeAddress;
  if (req.body.suburb) fields['Suburb'] = req.body.suburb;
  if (req.body.state) fields['State'] = req.body.state;
  if (req.body.postcode) fields['Postcode'] = req.body.postcode;
  if (req.body.abn) fields['ABN'] = req.body.abn;
  if (req.body.notes) fields['Notes'] = req.body.notes;
  if (req.body.signingEmail) fields['Signing Email'] = req.body.signingEmail;
  if (req.body.jobAppliedFor) fields['Applied for which Role?'] = req.body.jobAppliedFor;
  if (req.body.stageInRecruitment) fields['Stage-in-Recruitment'] = req.body.stageInRecruitment;

  if (req.body.extraFields && typeof req.body.extraFields === 'object') {
    var ef = req.body.extraFields;
    var safeExtra = ['Info Video Watched', 'Michael Call Completed', 'EOI Form Submitted', 'Video Interview Completed', 'Offer Sent Externally', 'Onboarded Externally', 'Recruitment Entry Notes', 'Application Date', 'Stage-in-Recruitment', 'Full Name'];
    safeExtra.forEach(function (k) { if (ef[k] !== undefined) fields[k] = ef[k]; });
  }

  airtable.rawFetch(AIRTABLE_TABLE_NAME, 'POST', '', { records: [{ fields: fields }] })
    .then(function (data) {
      if (data.error) return res.status(400).json({ error: (data.error.message || JSON.stringify(data.error)) });
      if (!data.records || !data.records[0]) return res.status(400).json({ error: 'No record returned from Airtable' });
      var _newRec = mapAirtableRecord(data.records[0]);
      logAudit(req.user, 'create_contact', 'Contact', data.records[0].id, _newRec.name || fields['Full Name'] || fields['First Name'] || 'New Contact', 'Created', '', JSON.stringify(Object.keys(fields)));
      res.json({ success: true, record: _newRec });
    })
    .catch(function (err) { res.status(500).json({ error: err.message }); });
});

// ═══ GET /api/contacts/:id ═══
router.get('/:id', function (req, res) {
  if (!env.airtable.apiKey) return res.status(500).json({ error: 'Airtable not configured' });
  airtable.rawFetch(AIRTABLE_TABLE_NAME, 'GET', '/' + req.params.id)
    .then(function (data) {
      if (data && data.error) return res.status(404).json({ error: data.error.message || 'Not found' });
      res.json({ record: mapAirtableRecord(data) });
    })
    .catch(function (err) { res.status(500).json({ error: err.message }); });
});

// ═══ PUT /api/contacts/:id ═══
router.put('/:id', function (req, res) {
  if (!env.airtable.apiKey) return res.status(500).json({ error: 'Airtable not configured' });
  var fields = {};
  if (req.body.firstName !== undefined && req.body.firstName !== '') fields['First Name'] = req.body.firstName;
  if (req.body.lastName !== undefined && req.body.lastName !== '') fields['Last Name'] = req.body.lastName;
  if (req.body.name !== undefined && req.body.firstName === undefined && req.body.lastName === undefined) fields['Full Name'] = req.body.name;
  if (req.body.phone !== undefined && req.body.phone !== '') fields['Mobile'] = req.body.phone;
  if (req.body.email !== undefined && req.body.email !== '') fields['Email'] = req.body.email;
  if (req.body.statusOfContact !== undefined && req.body.statusOfContact !== '') {
    var validPutStatuses = ['Active Contact', 'Draft', 'Inactive Contact', 'Archive (Gus only)'];
    fields['Status of Contact'] = validPutStatuses.indexOf(req.body.statusOfContact) >= 0 ? req.body.statusOfContact : 'Active Contact';
  }
  if (req.body.contactType !== undefined && req.body.contactType !== '') fields['Type of Contact (Single Select)'] = req.body.contactType;
  if (req.body.gender && req.body.gender !== '') fields['Gender'] = req.body.gender;
  if (req.body.homeAddress && req.body.homeAddress !== '') fields['Home Address'] = req.body.homeAddress;
  if (req.body.suburb && req.body.suburb !== '') fields['Suburb'] = req.body.suburb;
  if (req.body.state && req.body.state !== '') fields['State'] = req.body.state;
  if (req.body.postcode && req.body.postcode !== '') fields['Postcode'] = req.body.postcode;
  if (req.body.abn && req.body.abn !== '') fields['ABN'] = req.body.abn;
  if (req.body.abnEntityName !== undefined && req.body.abnEntityName !== '') fields['ABN Entity Name'] = req.body.abnEntityName;
  if (req.body.abnStatus !== undefined && req.body.abnStatus !== '') fields['ABN Status'] = req.body.abnStatus;
  if (req.body.gstRegistered !== undefined) fields['GST Registered'] = req.body.gstRegistered;
  if (req.body.abnLastVerified !== undefined && req.body.abnLastVerified !== '') fields['ABN Last Verified'] = req.body.abnLastVerified;
  if (req.body.notes !== undefined) fields['Notes'] = req.body.notes;
  if (req.body.organisation && req.body.organisation !== '') fields['Organisation'] = req.body.organisation;
  if (req.body.signingEmail && req.body.signingEmail !== '') fields['Signing Email'] = req.body.signingEmail;
  if (req.body.dateApplied && req.body.dateApplied !== '') fields['Date Applied'] = req.body.dateApplied;
  if (req.body.jobAppliedFor && req.body.jobAppliedFor !== '') fields['Applied for which Role?'] = req.body.jobAppliedFor;
  if (req.body.stageInRecruitment && req.body.stageInRecruitment !== '') fields['Stage In Recruitment'] = req.body.stageInRecruitment;
  if (req.body.cvAiSummary !== undefined) fields['CV Ai Summary'] = req.body.cvAiSummary;

  if (Object.keys(fields).length === 0) return res.json({ success: true, record: {} });

  var _auditFields = JSON.parse(JSON.stringify(fields));
  var _auditUser = req.user;
  var _auditId = req.params.id;
  var _auditLabel = req.body.name || req.body.firstName || '';

  airtable.rawFetch(AIRTABLE_TABLE_NAME, 'PATCH', '/' + req.params.id, { fields: fields })
    .then(function (data) {
      if (data && data.error) return res.status(400).json({ error: (data.error.message || data.error.type || JSON.stringify(data.error)) });
      try {
        var _mapped = mapAirtableRecord(data);
        var _afKeys = Object.keys(_auditFields);
        for (var _ai = 0; _ai < _afKeys.length; _ai++) {
          logAudit(_auditUser, 'update_contact', 'Contact', _auditId, _mapped.name || _auditLabel || _auditId, _afKeys[_ai], '', String(_auditFields[_afKeys[_ai]] || ''));
        }
        res.json({ success: true, record: _mapped });
      } catch (mapErr) {
        res.json({ success: true, record: { id: req.params.id } });
      }
    })
    .catch(function (err) { res.status(500).json({ error: err.message }); });
});

// ═══ DELETE /api/contacts/:id ═══
router.delete('/:id', function (req, res) {
  if (!env.airtable.apiKey) return res.status(500).json({ error: 'Airtable not configured' });
  var _delId = req.params.id;
  var _delUser = req.user;
  var _delLabel = req.query.name || _delId;

  airtable.rawFetch(AIRTABLE_TABLE_NAME, 'DELETE', '/' + _delId)
    .then(function (data) {
      if (data.error) return res.status(400).json({ error: data.error.message });
      logAudit(_delUser, 'delete_contact', 'Contact', _delId, _delLabel, 'Deleted', _delLabel, '');
      res.json({ success: true });
    })
    .catch(function (err) { res.status(500).json({ error: err.message }); });
});

// ═══ PAY RATES (Contractor & TFN) ═══
// These are separate Airtable tables containing rate cards

// GET /api/contacts/pay-rates/contractor — contractor rate table
router.get('/pay-rates/contractor', function (req, res) {
  if (!env.airtable.apiKey) return res.json([]);
  airtable.fetchAllFromTable('SW Independant Contractor Rates').then(function (records) {
    var result = (records || []).map(function (r) {
      var f = r.fields || {};
      return {
        id: r.id,
        name: f['Name'] || f['Level'] || f['Rate Name'] || '',
        weekday: f['Weekday per hour (6am to 8pm)'] || f['Weekday'] || '',
        weeknight: f['Weeknight (8pm to 6am)'] || f['Weeknight'] || '',
        saturday: f['Saturday'] || '',
        sunday: f['Sunday'] || '',
        pubHolidays: f['Public Holidays'] || f['Public Holiday'] || '',
        sleepover: f['Sleepover (per sleep)'] || f['Sleepover'] || '',
        description: f['Criteria'] || f['Description'] || f['Notes'] || ''
      };
    });
    res.json(result);
  }).catch(function (e) { console.error('Contractor pay rates error:', e.message); res.json([]); });
});

// GET /api/contacts/pay-rates/tfn — TFN employee rate table
router.get('/pay-rates/tfn', function (req, res) {
  // Try Supabase first
  sb.query('tfn_pay_rates', 'GET', { select: '*', order: 'pay_level' }).then(function (rows) {
    if (!rows || rows.length === 0) throw new Error('empty');
    var result = rows.map(function (r) {
      return {
        id: r.id,
        payLevel: r.pay_level || '',
        dayRate: r.hourly_rate ? '$' + r.hourly_rate + '/hr' : '',
        afternoon: r.afternoon_rate ? '$' + r.afternoon_rate + '/hr' : '',
        night: r.night_rate ? '$' + r.night_rate + '/hr' : '',
        saturday: r.saturday_rate ? '$' + r.saturday_rate + '/hr' : '',
        sunday: r.sunday_rate ? '$' + r.sunday_rate + '/hr' : '',
        pubHolidays: r.public_holiday_rate ? '$' + r.public_holiday_rate + '/hr' : '',
        sleepover: r.sleepover_rate ? '$' + r.sleepover_rate + '/per sleep' : '',
        lastUpdated: r.effective_date || ''
      };
    });
    console.log('[TFN] Supabase: ' + result.length + ' rate records');
    return res.json(result);
  }).catch(function (sbErr) {
    if (sbErr.message !== 'empty') console.warn('[TFN] Supabase error, falling back to Airtable:', sbErr.message);
    // Airtable fallback
    if (!env.airtable.apiKey) return res.json([]);
    airtable.fetchAllFromTable('TFN Pay Rates').then(function (records) {
      if (!records || records.length === 0) {
        return res.json([{
          level: "Home Care Stream",
          rates: {
            "Level 1 Casual": "$32.27/hr",
            "Level 2 Casual": "$34.19/hr",
            "Level 3 Casual": "$36.24/hr",
            "Level 4 Casual": "$38.49/hr",
            "Saturday Loading": "150%",
            "Sunday Loading": "200%",
            "Public Holiday": "250%"
          },
          source: "SCHADS Award 2025-26 (fallback)"
        }]);
      }
      var result = (records || []).map(function (r) {
        var f = r.fields || {};
        return {
          id: r.id,
          payLevel: f['Pay Level'] || f['Name'] || f['Level'] || '',
          dayRate: f['Day Rate'] || f['Weekday'] || '',
          afternoon: f['Afternoon'] || f['Afternoon Rate'] || '',
          night: f['Night'] || f['Night Rate'] || '',
          saturday: f['Saturday'] || '',
          sunday: f['Sunday'] || '',
          pubHolidays: f['Public Holidays'] || f['Public Holiday'] || '',
          sleepover: f['Sleepover'] || f['Sleepover (per sleep)'] || '',
          lastUpdated: f['Last Modified'] || f['Last Updated'] || ''
        };
      });
      res.json(result);
    }).catch(function (e) { console.error('TFN pay rates error:', e.message); res.json([]); });
  });
});

// ═══ STAFF AVAILABILITY / LEAVE ═══

// GET /api/contacts/staff-availability — get leave records for a staff member
router.get('/staff-availability', function (req, res) {
  var email = req.query.email || '';
  if (!email) return res.json([]);

  // Try Supabase first — look up contact by email, then fetch staff_availability records
  sb.query('contacts', 'GET', { select: 'id', eq: { email: email }, limit: 1 }).then(function (contacts) {
    if (!contacts || contacts.length === 0) throw new Error('no_contact');
    var contactId = contacts[0].id;
    return sb.query('staff_availability', 'GET', {
      select: '*',
      eq: { contact_id: contactId },
      order: 'start_date.desc'
    });
  }).then(function (rows) {
    if (!rows || rows.length === 0) throw new Error('empty');
    var result = rows.map(function (r) {
      return {
        id: r.id,
        startDate: r.start_date || '',
        endDate: r.end_date || '',
        leaveType: r.leave_type || '',
        status: r.status || 'Pending',
        reason: r.reason || '',
        totalDays: r.total_days || 0,
        employmentType: r.employment_type || '',
        approvedBy: r.approved_by || '',
        approvedDate: r.approved_date || '',
        statusComments: r.status_comments || ''
      };
    });
    console.log('[Staff Availability] Supabase: ' + result.length + ' records for ' + email);
    return res.json(result);
  }).catch(function (sbErr) {
    if (sbErr.message !== 'empty' && sbErr.message !== 'no_contact') {
      console.warn('[Staff Availability] Supabase error, falling back to Airtable:', sbErr.message);
    }
    // Airtable fallback
    if (!env.airtable.apiKey) return res.json([]);
    var formula = "FIND('" + email.replace(/'/g, "\\'") + "', {Email})";
    airtable.fetchAllFromTable(airtable.TABLES.STAFF_AVAILABILITY, formula).then(function (records) {
      var result = (records || []).map(function (r) {
        var f = r.fields || {};
        return {
          id: r.id,
          startDate: f['Start Date'] || f['From'] || '',
          endDate: f['End Date'] || f['To'] || '',
          leaveType: f['Leave Type'] || f['Type'] || f['Reason'] || '',
          status: f['Status'] || f['Approval Status'] || 'Pending',
          reason: f['Reason'] || f['Notes'] || f['Comments'] || '',
          totalDays: f['Total Days'] || f['Days'] || 0,
          employmentType: f['Employment Type'] || '',
          approvedBy: f['Approved By'] || '',
          approvedDate: f['Approved Date'] || '',
          statusComments: f['Status Comments'] || f['Decline Reason'] || ''
        };
      });
      result.sort(function (a, b) { return (b.startDate || '').localeCompare(a.startDate || ''); });
      res.json(result);
    }).catch(function (e) { console.error('Staff availability error:', e.message); res.json([]); });
  });
});

// POST /api/contacts/staff-availability — create leave request
router.post('/staff-availability', function (req, res) {
  if (!env.airtable.apiKey) return res.json({ error: 'Airtable not configured' });
  var fields = {};
  if (req.body.startDate) fields['Start Date'] = req.body.startDate;
  if (req.body.endDate) fields['End Date'] = req.body.endDate;
  if (req.body.leaveType) fields['Leave Type'] = req.body.leaveType;
  if (req.body.status) fields['Status'] = req.body.status;
  if (req.body.reason) fields['Reason'] = req.body.reason;
  if (req.body.employmentType) fields['Employment Type'] = req.body.employmentType;
  if (req.body.requiresApproval) fields['Requires Approval'] = req.body.requiresApproval;
  if (req.body.contactRecordId) fields['Contact'] = [req.body.contactRecordId];
  if (req.user && req.user.email) fields['Email'] = req.user.email;
  airtable.rawFetch(airtable.TABLES.STAFF_AVAILABILITY, 'POST', '', { records: [{ fields: fields }] })
    .then(function (data) {
      if (data.error) return res.json({ error: data.error.message || 'Failed to create' });
      if (data.records && data.records[0]) res.json({ ok: true, id: data.records[0].id });
      else res.json({ error: 'No record created' });
    })
    .catch(function (err) { res.json({ error: err.message }); });
});

// PATCH /api/contacts/staff-availability/:id — update leave request (approve/decline)
router.patch('/staff-availability/:id', function (req, res) {
  if (!env.airtable.apiKey) return res.json({ error: 'Airtable not configured' });
  var fields = {};
  if (req.body.status) fields['Status'] = req.body.status;
  if (req.body.approvedBy) fields['Approved By'] = req.body.approvedBy;
  if (req.body.approvedDate) fields['Approved Date'] = req.body.approvedDate;
  if (req.body.statusComments) fields['Status Comments'] = req.body.statusComments;
  airtable.rawFetch(airtable.TABLES.STAFF_AVAILABILITY, 'PATCH', '/' + req.params.id, { fields: fields })
    .then(function (data) {
      if (data.error) return res.json({ error: data.error.message || 'Update failed' });
      res.json({ ok: true });

      // Write contact_history entry to Supabase after successful availability update
      try {
        var staffName = req.body.staffName || data.fields && (data.fields['Full Name'] || data.fields['Staff Name'] || data.fields['Name']) || 'Staff member';
        var contactId = req.body.contactId || (data.fields && data.fields['Contact'] && Array.isArray(data.fields['Contact']) ? data.fields['Contact'][0] : null);
        var updatedBy = (req.user && (req.user.name || req.user.email)) || 'System';
        var dateStr = new Date().toISOString().split('T')[0];
        var statusText = req.body.status || 'Updated';

        if (contactId) {
          sb.insert('contact_history', {
            contact_id: contactId,
            type: 'auto',
            source: 'system',
            tag: 'Staff Availability Updated',
            note: staffName + "'s availability was " + statusText.toLowerCase() + " on " + dateStr + ". Updated by: " + updatedBy + ".",
            created_by: req.user ? req.user.id : null,
            created_at: new Date().toISOString()
          }).catch(function (e) {
            console.error('[STAFF AVAILABILITY] Failed to write contact_history:', e.message);
          });
        }
      } catch (histErr) {
        console.error('[STAFF AVAILABILITY] contact_history write error:', histErr.message);
      }
    })
    .catch(function (err) { res.json({ error: err.message }); });
});

module.exports = router;
