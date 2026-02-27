const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { logAudit } = require('../../services/audit');
const airtable = require('../../services/database');
const env = require('../../config/env');
var { createClient } = require('@supabase/supabase-js');
var { uploadGeneral } = require('../../config/upload');

var supabase = createClient(
  (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, ''),
  (process.env.SUPABASE_SERVICE_KEY || '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const router = express.Router();

router.use(authenticate);

// ─── Helpers ─────────────────────────────────────────────
function arrayVal(v) { return Array.isArray(v) ? v[0] || '' : v || ''; }
function numVal(v) { return Array.isArray(v) ? parseFloat(v[0]) || 0 : parseFloat(v) || 0; }

function fmtDate(v) {
  if (!v) return '';
  try {
    var d = new Date(v);
    if (isNaN(d.getTime())) return v;
    var day = ('0' + d.getDate()).slice(-2);
    var mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
    var yr = d.getFullYear();
    var hr = ('0' + d.getHours()).slice(-2);
    var mn = ('0' + d.getMinutes()).slice(-2);
    return day + ' ' + mon + ' ' + yr + ' ' + hr + ':' + mn;
  } catch (e) { return v; }
}

// Retry Airtable create, stripping unknown fields
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

// Build lookup of client record IDs to names (from Clients + All Contacts tables)
function buildClientLookup() {
  return airtable.fetchAllFromTable('Clients').then(function (clients) {
    var clientLookup = {};
    (clients || []).forEach(function (c) {
      var f = c.fields || {};
      var name = arrayVal(f['Client Name']) || arrayVal(f['Full Name']) || arrayVal(f['Name']) || '';
      if (!name && f['First Name']) name = ((f['First Name'] || '') + ' ' + (f['Last Name'] || '')).trim();
      if (name) clientLookup[c.id] = name;
    });
    return airtable.fetchAllFromTable('All Contacts').then(function (contacts) {
      (contacts || []).forEach(function (c) {
        if (clientLookup[c.id]) return;
        var f = c.fields || {};
        var name = arrayVal(f['Full Name']) || arrayVal(f['Client Name']) || arrayVal(f['Name']) || '';
        if (!name && f['First Name']) name = ((f['First Name'] || '') + ' ' + (f['Last Name'] || '')).trim();
        if (name) clientLookup[c.id] = name;
      });
      return clientLookup;
    }).catch(function () { return clientLookup; });
  });
}

// Resolve client name from a raw field value using lookup
function resolveClientName(cnRaw, clientLookup) {
  if (Array.isArray(cnRaw) && cnRaw.length > 0) {
    return cnRaw.map(function (id) { return clientLookup[id] || id; }).join(', ');
  } else if (typeof cnRaw === 'string' && cnRaw.startsWith('rec')) {
    return clientLookup[cnRaw] || cnRaw;
  }
  return cnRaw || '';
}

// ═══════════════════════════════════════════════════════════
//  GET /api/clients — list clients from Clients table
// ═══════════════════════════════════════════════════════════
router.get('/', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json([]);

  airtable.fetchAllFromTableView('Clients', 'Client Active View').then(function (records) {
    var clients = (records || []).map(function (r) {
      var f = r.fields || {};
      return {
        airtable_id: r.id,
        name: arrayVal(f['Client Name'] || f['Full Name'] || ''),
        accountType: arrayVal(f['Account Type: Active or Inactive or Propsect'] || f['Account Type: Active or Inactive or Prospect'] || f['Account Type'] || ''),
        phone: arrayVal(f['Phone'] || f['Mobile'] || f['Phone Number'] || ''),
        email: arrayVal(f['Email'] || f['Email Address'] || ''),
        ndisNumber: arrayVal(f['NDIS Number'] || f['NDIS Ref'] || ''),
        suburb: arrayVal(f['Suburb'] || f['Location'] || ''),
        silOrCas: arrayVal(f['SIL or CAS?'] || f['SIL or CAS - Client'] || '')
      };
    }).filter(function (c) { return c.name; });
    console.log('Clients list: returning ' + clients.length + ' clients from Clients table');
    res.json(clients);
  }).catch(function (e) {
    console.error('Clients list error:', e.message);
    res.json([]);
  });
});

// ═══════════════════════════════════════════════════════════
//  GET /api/clients/ndis — NDIS client contacts from All Contacts
// ═══════════════════════════════════════════════════════════
router.get('/ndis', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json([]);

  var AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'All Contacts';
  var filter = encodeURIComponent("OR({Type of Contact (Single Select)}='NDIS Client (Active)',{Type of Contact (Single Select)}='NDIS Client (Prospect)')");
  var url = '?filterByFormula=' + filter + '&fields[]=Full Name&fields[]=NDIS Number&fields[]=Type of Contact (Single Select)&fields[]=Email&fields[]=Phone&fields[]=Address&fields[]=DOB&fields[]=Plan Start&fields[]=Plan End&fields[]=Support Coordinator&fields[]=Emergency Contact';
  var allRecords = [];

  function fetchPage(offset) {
    var pageUrl = url + '&pageSize=100' + (offset ? '&offset=' + offset : '');
    airtable.rawFetch(AIRTABLE_TABLE_NAME, 'GET', pageUrl).then(function (data) {
      allRecords = allRecords.concat(data.records || []);
      if (data.offset) return fetchPage(data.offset);
      console.log('NDIS clients fetched:', allRecords.length, 'records');
      res.json(allRecords.map(function (r) {
        var f = r.fields || {};
        return {
          id: r.id, name: f['Full Name'] || '', ndisNumber: f['NDIS Number'] || '',
          type: f['Type of Contact (Single Select)'] || f['Type'] || '', email: f['Email'] || '', phone: f['Phone'] || '',
          address: f['Address'] || '', dob: f['DOB'] || '',
          planStart: f['Plan Start'] || '', planEnd: f['Plan End'] || '',
          supportCoordinator: f['Support Coordinator'] || '',
          emergencyContact: f['Emergency Contact'] || ''
        };
      }));
    }).catch(function (err) { res.status(500).json({ error: err.message }); });
  }
  fetchPage(null);
});

// ═══════════════════════════════════════════════════════════
//  GET /api/clients/details — client details by name
// ═══════════════════════════════════════════════════════════
router.get('/details', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json({ error: 'Not configured' });
  var clientName = req.query.name || '';
  if (!clientName) return res.json({ error: 'No client name provided' });

  airtable.fetchAllFromTableView('Clients', 'Client Active View').then(function (records) {
    var match = null;
    (records || []).forEach(function (r) {
      var f = r.fields || {};
      var name = arrayVal(f['Client Name'] || f['Full Name'] || '');
      if (name.toLowerCase() === clientName.toLowerCase()) match = f;
    });
    if (!match) return res.json({ error: 'Client not found', name: clientName });

    console.log('Client Details fields for ' + clientName + ':', Object.keys(match).join(', '));

    var dob = arrayVal(match['Date of Birth'] || match['DOB'] || match['D.O.B'] || '');
    var age = '';
    if (dob) { try { var bd = new Date(dob); if (!isNaN(bd)) age = Math.floor((Date.now() - bd.getTime()) / 31557600000) + ''; } catch (e) { /* ignore */ } }

    var silCas = arrayVal(match['SIL or CAS?'] || match['SIL or CAS - Client'] || '').toLowerCase();
    var requiredSkills = match['Required Staff Skills'] || [];
    if (!Array.isArray(requiredSkills)) requiredSkills = requiredSkills ? [requiredSkills] : [];

    var result = {
      name: arrayVal(match['Client Name'] || match['Full Name'] || ''),
      accountType: arrayVal(match['Account Type: Active or Inactive or Propsect'] || match['Account Type: Active or Inactive or Prospect'] || match['Account Type'] || ''),
      silOrCas: arrayVal(match['SIL or CAS?'] || match['SIL or CAS - Client'] || ''),
      serviceType: silCas.indexOf('sil') >= 0 ? 'Supported Independent Living' : 'Community Access & Support',
      requiredSkills: requiredSkills,
      ndisNumber: arrayVal(match['NDIS Number'] || match['NDIS Ref'] || match['NDIS Reference'] || match['NDIS #'] || ''),
      ndisType: arrayVal(match['Type of NDIS Plan Grouped'] || match['Type of NDIS Plan'] || match['NDIS Plan Type'] || ''),
      planExpiry: arrayVal(match['NDIS Plan Expiry Date'] || ''),
      planStartDate: arrayVal(match['NDIS Plan Start Date'] || ''),
      supportCoordinator: arrayVal(match['Support Coordinator (from Support Coordinator Link)'] || match['Support Coordinator'] || ''),
      dateOfBirth: dob,
      age: age,
      gender: arrayVal(match['Gender'] || ''),
      suburb: arrayVal(match['Suburb'] || match['Location'] || ''),
      address: arrayVal(match['Address'] || match['Home Address'] || match['Street Address'] || ''),
      state: arrayVal(match['State'] || ''),
      postcode: arrayVal(match['Postcode'] || match['Post Code'] || ''),
      phone: arrayVal(match['Phone'] || match['Mobile'] || match['Phone Number'] || ''),
      email: arrayVal(match['Email'] || match['Email Address'] || ''),
      emergencyContact: arrayVal(match['Emergency Contact'] || match['Emergency Contact Name'] || match['Emergency Name'] || ''),
      emergencyPhone: arrayVal(match['Emergency Phone'] || match['Emergency Contact Phone'] || match['Emergency Contact Number'] || ''),
      emergencyEmail: arrayVal(match['Emergency Email'] || match['Emergency Contact Email'] || ''),
      emergencyRelationship: arrayVal(match['Emergency Relationship'] || match['Emergency Relationship to Client'] || match['Emergency Contact Relationship'] || ''),
      nominee: arrayVal(match['Nominee or Guardian'] || match['Nominee or Legal Guardian'] || match['Nominee'] || match['Guardian'] || ''),
      nomineePhone: arrayVal(match['Nominee Phone'] || match['Guardian Phone'] || ''),
      nomineeEmail: arrayVal(match['Nominee Email'] || ''),
      planManager: arrayVal(match['Plan Manager (from Plan Manager Link)'] || match['Plan Manager'] || ''),
      kmAllowance: arrayVal(match['KM Allowance'] || match['Km Allowance'] || match["KM's Allowance per week"] || ''),
      typeOfDisability: arrayVal(match['Type of Disability'] || match['Disability Type'] || match['Primary Disability'] || ''),
      generalBackground: arrayVal(match['General Background Info'] || match['General Background'] || match['Background'] || ''),
      ndisGoals: arrayVal(match['NDIS Client Goals as outlined in their plan'] || match['NDIS Goals'] || match['Client Goals'] || ''),
      allergiesAlerts: arrayVal(match['List the Allergies or Alerts & provide as much details here'] || match['Allergies'] || match['Alerts'] || ''),
      hasAllergies: arrayVal(match['Does the Client have any Allergies or Alerts?'] || ''),
      communicationAids: arrayVal(match['Do they use communication aids?'] || ''),
      communicationDetails: arrayVal(match['Tell us more about your communication aids.'] || ''),
      personalCare: arrayVal(match['Is there Personal Care involved in their Support?'] || ''),
      pbspYesNo: arrayVal(match['PBSP? Yes or No'] || ''),
      pbspPracName: arrayVal(match['PBSP Prac Name'] || match['Behaviour Practitioner'] || ''),
      pbspPracEmail: arrayVal(match['PBSP Prac Email'] || ''),
      pbspPhone: arrayVal(match['PBSP Phone'] || ''),
      pbspStrategies: arrayVal(match['PBSP Strategies Summary 2025'] || ''),
      knownTriggers: arrayVal(match['Any known triggers'] || ''),
      supportRatio: arrayVal(match['Support Ratio'] || ''),
      genderOfWorkers: arrayVal(match['Gender of Support Workers'] || ''),
      airtableId: match._airtableRecordId || '',
      allFields: match
    };

    res.json(result);
  }).catch(function (e) {
    console.error('Client details error:', e.message);
    res.status(500).json({ error: e.message });
  });
});

// ═══════════════════════════════════════════════════════════
//  GET /api/clients/support-plan — support plan by client name
// ═══════════════════════════════════════════════════════════
router.get('/support-plan', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json({ records: [], client: null });
  var clientName = req.query.name || '';
  if (!clientName) return res.json({ records: [], client: null });

  Promise.all([
    airtable.fetchAllFromTable('Support Plan - 2025'),
    airtable.fetchAllFromTableView('Clients', 'Client Active View')
  ]).then(function (results) {
    var spRecords = results[0] || [];
    var clientRecords = results[1] || [];

    // Match support plan records
    var matched = [];
    spRecords.forEach(function (r) {
      var f = r.fields || {};
      var cn = arrayVal(f['Client Name (from Client Name)'] || f['Client Name (from Client)'] || f['Full Name (from Client)'] || f['Name (from Client)'] || '');
      if (!cn) cn = arrayVal(f['Client Name'] || '');
      if (cn && cn.toLowerCase() === clientName.toLowerCase()) {
        if (matched.length === 0) console.log('Support Plan fields:', Object.keys(f).join(', '));
        matched.push(f);
      }
    });

    // Match client record for NDIS plan dates and stakeholders
    var clientMatch = null;
    clientRecords.forEach(function (r) {
      var f = r.fields || {};
      var cn = arrayVal(f['Client Name'] || f['Full Name'] || '');
      if (cn.toLowerCase() === clientName.toLowerCase()) clientMatch = f;
    });

    // Extract stakeholders from client record
    var stakeholders = {};
    if (clientMatch) {
      stakeholders = {
        supportCoordinator: {
          name: arrayVal(clientMatch['Support Coordinator (from Support Coordinator Link)'] || clientMatch['Support Coordinator'] || clientMatch['Support Coordinator Name'] || ''),
          email: arrayVal(clientMatch['Support Coordinator Email (from Support Coordinator Link)'] || clientMatch['Support Coordinator Email'] || ''),
          phone: arrayVal(clientMatch['Phone (from Support Coordinator )'] || clientMatch['Support Coordinator Phone'] || ''),
          company: arrayVal(clientMatch['Company Name (from Support Coordinator Link)'] || clientMatch['Support Coordinator Company'] || clientMatch['Organisation (from Support Coordinator Link)'] || '')
        },
        planManager: {
          name: arrayVal(clientMatch['Plan Manager (from Plan Manager Link)'] || clientMatch['Plan Manager'] || ''),
          email: arrayVal(clientMatch['Plan Manager Email (from Plan Manager Link)'] || clientMatch['Plan Manager Email'] || ''),
          phone: arrayVal(clientMatch['Plan Manager Phone (from Plan Manager Link)'] || clientMatch['Plan Manager Phone'] || ''),
          company: arrayVal(clientMatch['Company Name (from Plan Manager Link)'] || clientMatch['Plan Manager Company'] || '')
        },
        nominee: {
          name: arrayVal(clientMatch['Nominee or Guardian'] || clientMatch['Nominee or Legal Guardian'] || ''),
          phone: arrayVal(clientMatch['Nominee Phone'] || ''),
          email: arrayVal(clientMatch['Nominee Email'] || ''),
          relationship: arrayVal(clientMatch['Nominee Relationship'] || '')
        },
        opg: {
          name: arrayVal(clientMatch['OPG Officer'] || clientMatch['Public Guardian'] || clientMatch['OPG Name'] || ''),
          phone: arrayVal(clientMatch['OPG Phone'] || clientMatch['Public Guardian Phone'] || ''),
          email: arrayVal(clientMatch['OPG Email'] || clientMatch['Public Guardian Email'] || '')
        },
        behaviourPractitioner: {
          name: arrayVal(clientMatch['PBSP Prac Name'] || clientMatch['Behaviour Practitioner'] || clientMatch['Behaviour Practitioner Name'] || ''),
          email: arrayVal(clientMatch['PBSP Prac Email'] || clientMatch['Behaviour Practitioner Email'] || ''),
          phone: arrayVal(clientMatch['PBSP Phone'] || clientMatch['Behaviour Practitioner Phone'] || '')
        },
        emergency: {
          name: arrayVal(clientMatch['Emergency Contact'] || clientMatch['Emergency Name'] || clientMatch['Emergency Contact Name'] || ''),
          phone: arrayVal(clientMatch['Emergency Phone'] || clientMatch['Emergency Contact Phone'] || clientMatch['Emergency Contact Number'] || ''),
          email: arrayVal(clientMatch['Emergency Email'] || clientMatch['Emergency Contact Email'] || ''),
          relationship: arrayVal(clientMatch['Emergency Relationship'] || clientMatch['Emergency Relationship to Client'] || clientMatch['Emergency Contact Relationship'] || '')
        },
        decisions: {
          ownDecisionMaker: arrayVal(clientMatch['Is the Client their own decision maker?'] || ''),
          medical: arrayVal(clientMatch['Medical Decisions'] || ''),
          financial: arrayVal(clientMatch['Financial Decisions'] || ''),
          ndisAccommodation: arrayVal(clientMatch['NDIS Supports\n Plan & Accommodation decisions'] || clientMatch['NDIS Supports Plan & Accommodation decisions'] || ''),
          livingArrangements: arrayVal(clientMatch['Living Arrangements decisions'] || ''),
          legal: arrayVal(clientMatch['Legal Decisions'] || '')
        },
        ndisPlan: {
          startDate: arrayVal(clientMatch['NDIS Plan Start Date'] || ''),
          expiryDate: arrayVal(clientMatch['NDIS Plan Expiry Date'] || ''),
          planType: arrayVal(clientMatch['Type of NDIS Plan Grouped'] || clientMatch['Type of NDIS Plan'] || clientMatch['NDIS Plan Type'] || ''),
          ndisNumber: arrayVal(clientMatch['NDIS Number'] || clientMatch['NDIS Ref'] || clientMatch['NDIS Reference'] || clientMatch['NDIS #'] || '')
        }
      };
      console.log('Client stakeholders extracted for ' + clientName);
    }

    console.log('Support Plan: Found ' + matched.length + ' records for ' + clientName + ' (searched ' + spRecords.length + ' total SP records)' + (clientMatch ? ' (client record found)' : ' (no client record)'));
    if (matched.length === 0 && spRecords.length > 0) {
      var sampleNames = spRecords.slice(0, 3).map(function (r) {
        var f = r.fields || {};
        return arrayVal(f['Client Name (from Client Name)'] || f['Client Name'] || '???');
      });
      console.log('Support Plan sample names: ' + sampleNames.join(', '));
    }
    res.json({ records: matched, stakeholders: stakeholders, clientFound: !!clientMatch });
  }).catch(function (e) {
    console.error('Support Plan error:', e.message);
    res.status(500).json({ error: e.message, records: [] });
  });
});

// ═══════════════════════════════════════════════════════════
//  GET /api/clients/full-support-plan — Supabase support plan by client name
// ═══════════════════════════════════════════════════════════
router.get('/full-support-plan', function (req, res) {
  var clientName = (req.query.name || '').trim();
  if (!clientName) return res.status(400).json({ error: 'name query parameter is required' });

  try {
    supabase
      .from('clients')
      .select('id')
      .ilike('client_name', clientName)
      .limit(1)
      .then(function (clientResult) {
        if (clientResult.error) {
          console.error('Full support plan - client lookup error:', clientResult.error.message);
          return res.status(500).json({ error: clientResult.error.message });
        }
        if (!clientResult.data || clientResult.data.length === 0) {
          console.log('Full support plan: no client found for "' + clientName + '"');
          return res.json({ plan: null, client_id: null });
        }

        var clientId = clientResult.data[0].id;

        supabase
          .from('client_support_plans')
          .select('*')
          .eq('client_id', clientId)
          .limit(1)
          .then(function (planResult) {
            if (planResult.error) {
              console.error('Full support plan - plan lookup error:', planResult.error.message);
              return res.status(500).json({ error: planResult.error.message });
            }
            var plan = (planResult.data && planResult.data.length > 0) ? planResult.data[0] : null;
            console.log('Full support plan: ' + (plan ? 'found' : 'no plan') + ' for client "' + clientName + '" (id: ' + clientId + ')');
            res.json({ plan: plan, client_id: clientId });
          });
      });
  } catch (err) {
    console.error('Full support plan GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  POST /api/clients/full-support-plan — create new Supabase support plan
// ═══════════════════════════════════════════════════════════
router.post('/full-support-plan', function (req, res) {
  var body = req.body || {};
  if (!body.client_id) return res.status(400).json({ error: 'client_id is required' });

  try {
    supabase
      .from('client_support_plans')
      .insert(body)
      .select()
      .then(function (result) {
        if (result.error) {
          console.error('Full support plan create error:', result.error.message);
          return res.status(500).json({ error: result.error.message });
        }
        var created = (result.data && result.data.length > 0) ? result.data[0] : null;
        console.log('Full support plan created for client_id: ' + body.client_id);
        res.json({ success: true, data: created });
      });
  } catch (err) {
    console.error('Full support plan POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  PATCH /api/clients/full-support-plan/:id — update Supabase support plan
// ═══════════════════════════════════════════════════════════
router.patch('/full-support-plan/:id', function (req, res) {
  var planId = req.params.id;
  var body = req.body || {};
  if (!planId) return res.status(400).json({ error: 'Plan id is required' });

  try {
    supabase
      .from('client_support_plans')
      .update(body)
      .eq('id', planId)
      .select()
      .then(function (result) {
        if (result.error) {
          console.error('Full support plan update error:', result.error.message);
          return res.status(500).json({ error: result.error.message });
        }
        var updated = (result.data && result.data.length > 0) ? result.data[0] : null;
        console.log('Full support plan updated: ' + planId);
        res.json({ success: true, data: updated });
      });
  } catch (err) {
    console.error('Full support plan PATCH error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  POST /api/clients/full-support-plan/upload — upload file to Supabase Storage
// ═══════════════════════════════════════════════════════════
router.post('/full-support-plan/upload', uploadGeneral.single('file'), function (req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    var clientId = req.body.client_id || 'unknown';
    var fileType = req.body.fileType || 'general';
    var timestamp = Date.now();
    var fileName = req.file.originalname || 'file';
    var storagePath = clientId + '/' + fileType + '/' + timestamp + '_' + fileName;

    supabase.storage
      .from('support-plan-documents')
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype || 'application/octet-stream',
        upsert: false
      })
      .then(function (uploadResult) {
        if (uploadResult.error) {
          console.error('Support plan file upload error:', uploadResult.error.message);
          return res.status(500).json({ error: uploadResult.error.message });
        }

        var publicUrlResult = supabase.storage
          .from('support-plan-documents')
          .getPublicUrl(storagePath);

        var url = publicUrlResult.data ? publicUrlResult.data.publicUrl : '';
        console.log('Support plan file uploaded: ' + storagePath);
        res.json({ success: true, url: url, name: fileName });
      });
  } catch (err) {
    console.error('Support plan file upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  DELETE /api/clients/full-support-plan/file — delete file from Supabase Storage
// ═══════════════════════════════════════════════════════════
router.delete('/full-support-plan/file', function (req, res) {
  var filePath = (req.body && req.body.path) || '';
  if (!filePath) return res.status(400).json({ error: 'path is required' });

  try {
    supabase.storage
      .from('support-plan-documents')
      .remove([filePath])
      .then(function (result) {
        if (result.error) {
          console.error('Support plan file delete error:', result.error.message);
          return res.status(500).json({ error: result.error.message });
        }
        console.log('Support plan file deleted: ' + filePath);
        res.json({ success: true });
      });
  } catch (err) {
    console.error('Support plan file DELETE error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  GET /api/clients/calendar — client calendar events
// ═══════════════════════════════════════════════════════════
router.get('/calendar', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json({ records: [] });
  var clientName = req.query.name || '';
  if (!clientName) return res.json({ records: [] });

  airtable.fetchAllFromTable('Client Calendar').then(function (records) {
    var matched = [];
    (records || []).forEach(function (r) {
      var f = r.fields || {};
      var cn = arrayVal(f['Client Name'] || f['Client Name (from Client Name)'] || f['Client Name (from Client)'] || f['Full Name (from Client)'] || f['Name (from Client)'] || f['Client'] || '');
      if (cn.toLowerCase() === clientName.toLowerCase()) {
        if (matched.length === 0) console.log('Client Calendar fields:', Object.keys(f).join(', '));
        matched.push({
          id: r.id,
          uniqueRef: f['Unique Ref'] || '',
          clientName: cn,
          eventName: f['Event Name'] || '',
          appointmentType: f['Type of Appointment'] || '',
          startDate: f['START: Date & Time of Appointment'] || '',
          endDate: f['END: Date & Time of Appointment'] || '',
          address: f['Address & Suburb of Appointment'] || '',
          details: f['Details of Appointment'] || '',
          swInstructions: f['Instructions for Support Workers'] || '',
          createdBy: f['Created by'] || arrayVal(f['Created by'] || ''),
          createdDate: f['Created Date & Time'] || '',
          status: f['Status of Appointment'] || '',
          silOrCas: arrayVal(f['SIL or CAS? (from Client Name)'] || ''),
          files: (f['File Upload'] || []).map(function (a) { return { name: a.filename || 'File', url: a.url || '', type: a.type || '', size: a.size || 0 }; })
        });
      }
    });
    // Sort by start date descending (most recent first)
    matched.sort(function (a, b) {
      var da = a.startDate ? new Date(a.startDate) : new Date(0);
      var dbv = b.startDate ? new Date(b.startDate) : new Date(0);
      return dbv - da;
    });
    console.log('Client Calendar: Found ' + matched.length + ' records for ' + clientName);
    res.json({ records: matched });
  }).catch(function (e) {
    console.error('Client Calendar error:', e.message);
    res.status(500).json({ error: e.message, records: [] });
  });
});

// ═══════════════════════════════════════════════════════════
//  GET /api/clients/budgets — client core budgets
// ═══════════════════════════════════════════════════════════
router.get('/budgets', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json([]);
  var clientName = req.query.name || '';

  // Step 1: Build client lookup
  buildClientLookup().then(function (clientLookup) {
    // Step 2: Fetch Client Core Budgets (and Rosters in parallel for Mode B)
    var budgetPromise = airtable.fetchAllFromTable('Client Core Budgets');
    var rosterPromise = clientName ? Promise.resolve([]) : airtable.fetchAllFromTableView('Rosters 2025', 'Grid View').catch(function () { return []; });

    return Promise.all([budgetPromise, rosterPromise]).then(function (results) {
      var records = results[0];
      var rosters = results[1];

      // Build shift aggregation by client name (Mode B only — when no name filter)
      var shiftAgg = {};
      if (!clientName && rosters.length > 0) {
        rosters.forEach(function (r) {
          var f = r.fields || {};
          var cn = resolveClientName(f['Client Name'] || f['Client'] || '', clientLookup);
          if (!cn) return;
          var hours = parseFloat(f['Total Hours (Decimal)']) || 0;
          var charge = parseFloat(f['Charge per hour']) || 0;
          if (!shiftAgg[cn]) shiftAgg[cn] = { totalHours: 0, estimatedCost: 0, shiftCount: 0 };
          shiftAgg[cn].totalHours += hours;
          shiftAgg[cn].estimatedCost += hours * charge;
          shiftAgg[cn].shiftCount += 1;
        });
        console.log('Shift aggregation: ' + Object.keys(shiftAgg).length + ' clients from ' + rosters.length + ' rosters');
      }

      var all = [];
      (records || []).forEach(function (r) {
        var f = r.fields || {};

        if (all.length === 0) {
          console.log('Client Core Budgets fields:', Object.keys(f).join(', '));
          console.log('Client Name raw value:', JSON.stringify(f['Client Name']));
          console.log('Client lookup sample (first 5):', JSON.stringify(Object.entries(clientLookup).slice(0, 5)));
        }

        var cn = resolveClientName(f['Client Name'] || f['Client'] || '', clientLookup);
        if (all.length < 3) console.log('Client Name resolved: ' + JSON.stringify(f['Client Name'] || f['Client'] || '') + ' -> ' + cn);

        // If name filter provided, only match that client
        if (clientName && cn.toLowerCase() !== clientName.toLowerCase()) return;

        all.push({
          airtableId: r.id,
          uniqueRef: f['Unique Ref'] || '',
          clientName: cn,
          ndisRef: arrayVal(f['NDIS Ref # (from Client Name)'] || f['NDIS Ref'] || f['NDIS Number'] || ''),
          planType: arrayVal(f['Type of NDIS Plan (from Client Name)'] || f['Plan Type'] || f['Type of NDIS Plan'] || ''),
          uploadSOS: f['Upload SOS Agreement'] || null,
          lineItems: f['Line Items from SOS Agreement'] || '',
          lineItemsUploaded: f['Line Items from SOS Agreement uploaded'] || false,
          accountType: arrayVal(f['Account Type:  Active or Inactive or Propsect (from Client Name)'] || f['Account Type'] || ''),
          silOrCas: arrayVal(f['SIL or CAS? (from Client Name)'] || f['SIL or CAS'] || f['SIL or CAS?'] || ''),
          coreBudgetSIL: numVal(f['Core Budget (SIL) (from Client Name)'] || f['Core Budget (SIL)'] || 0),
          coreBudgetCA: numVal(f['Core Budget (Community Access) (from Client Name)'] || f['Core Budget (Community Access)'] || 0),
          coreBudgetTransport: numVal(f['Core Budget (Transport) (from Client Name)'] || f['Core Budget (Transport)'] || 0),
          totalBudget: numVal(f['Total Budget'] || 0),
          invoiceAmount: numVal(f['Invoice Amount'] || 0),
          fromWhichBudget: f['from which Budget?'] || f['from which Budget'] || '',
          created: fmtDate(f['Created'] || ''),
          lastUpdate: fmtDate(f['Last update'] || f['Last Update'] || f['Last Modified'] || ''),
          rosteredHours: shiftAgg[cn] ? Math.round(shiftAgg[cn].totalHours * 100) / 100 : 0,
          scheduledCost: shiftAgg[cn] ? Math.round(shiftAgg[cn].estimatedCost * 100) / 100 : 0,
          shiftCount: shiftAgg[cn] ? shiftAgg[cn].shiftCount : 0,
          allFields: f
        });
      });

      // If name was provided, return old format for backward compatibility (contact detail tab)
      if (clientName) {
        console.log('Client Core Budgets: Found ' + all.length + ' records for ' + clientName);
        var oldFormat = all.map(function (r) { return r.allFields; });
        return res.json({ records: oldFormat });
      }

      // No name = return full mapped array for Client Budget view
      console.log('Client Core Budgets: Returning ' + all.length + ' total records');
      res.json(all);
    });
  }).catch(function (e) {
    console.error('Client Core Budgets error:', e.message);
    if (clientName) return res.status(500).json({ error: e.message, records: [] });
    res.json([]);
  });
});

// ═══════════════════════════════════════════════════════════
//  POST /api/clients/budgets — create client budget record
// ═══════════════════════════════════════════════════════════
router.post('/budgets', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: 'Airtable not configured' });
  var fields = {};
  if (req.body.lineItems) fields['Line Items from SOS Agreement'] = req.body.lineItems;
  if (req.body.invoiceAmount) fields['Invoice Amount'] = parseFloat(req.body.invoiceAmount) || 0;
  if (req.body.fromWhichBudget) fields['from which Budget?'] = req.body.fromWhichBudget;

  var clientName = req.body.clientName || '';
  if (!clientName) return res.status(400).json({ error: 'Client name is required' });

  // Look up the client record ID from Clients table
  airtable.fetchAllFromTableView('Clients', 'Client Active View').then(function (clients) {
    var clientId = null;
    (clients || []).forEach(function (c) {
      var f = c.fields || {};
      var name = f['Full Name'] || f['Client Name'] || f['Name'] || '';
      if (name.toLowerCase() === clientName.toLowerCase()) clientId = c.id;
    });

    if (clientId) {
      fields['Client Name'] = [clientId];
    } else {
      fields['Client Name'] = clientName;
    }

    return airtable.rawFetch('Client Core Budgets', 'POST', '', { records: [{ fields: fields }] });
  }).then(function (data) {
    if (data.error) return res.status(400).json({ error: data.error.message || JSON.stringify(data.error) });
    console.log('Client Budget created for: ' + clientName);
    logAudit(req.user, 'create_client_budget', 'ClientBudget', data.records ? data.records[0].id : '', clientName, 'Created', '', JSON.stringify(Object.keys(fields)));
    res.json({ success: true, record: data.records ? data.records[0] : null });
  }).catch(function (err) {
    console.error('Create client budget error:', err.message);
    res.status(500).json({ error: err.message });
  });
});

// ═══════════════════════════════════════════════════════════
//  POST /api/clients/budgets/scan-sos — AI scan SOS PDF text
// ═══════════════════════════════════════════════════════════
router.post('/budgets/scan-sos', function (req, res) {
  var text = req.body.text || '';
  var fileName = req.body.fileName || '';
  if (!text || text.trim().length < 20) return res.json({ error: 'No text to scan' });
  var ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.json({ error: 'Anthropic API key not configured' });

  var prompt = 'You are an NDIS (National Disability Insurance Scheme) document parser for Australia.\nExtract the following fields from this Schedule of Support (SOS) agreement document text.\nReturn ONLY valid JSON with these exact keys (use empty string or 0 if not found):\n\n{\n  "clientName": "participant full name",\n  "ndisRef": "NDIS participant reference number",\n  "planType": "NDIA Managed or Plan Managed or Self Managed",\n  "silOrCas": "SIL or CAS or Both",\n  "coreBudgetSIL": 0,\n  "coreBudgetCA": 0,\n  "coreBudgetTransport": 0,\n  "totalBudget": 0,\n  "invoiceAmount": 0,\n  "lineItems": "extracted line items with amounts, one per line",\n  "planStartDate": "",\n  "planEndDate": "",\n  "fromWhichBudget": ""\n}\n\nRules:\n- Look for participant name and NDIS number (usually starts with 43)\n- Core budget amounts for SIL (Supported Independent Living), Community Access, Transport\n- Service line items with their allocated funding amounts\n- Plan type (NDIA managed, plan managed, self managed)\n- All dollar amounts should be numbers without $ sign\n- If a field cannot be determined, use empty string "" or 0 for numbers\n- Return ONLY the JSON object, no markdown, no backticks, no explanation\n\nDocument text (from file: ' + fileName + '):\n' + text.substring(0, 10000);

  var body = JSON.stringify({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }]
  });

  var https = require('https');
  var opts = {
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    }
  };

  var apiReq = https.request(opts, function (apiRes) {
    var data = '';
    apiRes.on('data', function (c) { data += c; });
    apiRes.on('end', function () {
      try {
        var j = JSON.parse(data);
        var content = '';
        if (j.content && j.content.length > 0) content = j.content[0].text || '';
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        var parsed = JSON.parse(content);
        console.log('SOS Scan [' + fileName + ']: ' + (parsed.clientName || 'Unknown') + ' — $' + (parsed.totalBudget || 0));
        res.json({ parsed: parsed });
      } catch (e) {
        console.error('SOS scan parse error:', e.message, 'Raw:', data.substring(0, 200));
        res.json({ error: 'Failed to parse AI response', raw: data.substring(0, 500) });
      }
    });
  });
  apiReq.on('error', function (e) { res.json({ error: e.message }); });
  apiReq.write(body);
  apiReq.end();
});

// ═══════════════════════════════════════════════════════════
//  GET /api/clients/budgets/shifts — individual shifts for budget detail
// ═══════════════════════════════════════════════════════════
router.get('/budgets/shifts', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json({ shifts: [], weeklyBurn: [] });
  var clientName = (req.query.name || '').trim();
  if (!clientName) return res.json({ shifts: [], weeklyBurn: [] });

  buildClientLookup().then(function (clientLookup) {
    return airtable.fetchAllFromTableView('Rosters 2025', 'Grid View').catch(function () {
      return airtable.fetchAllFromTable('Rosters 2025');
    }).then(function (rosters) {
      var shifts = [];
      var weeklyBurn = {};

      (rosters || []).forEach(function (r) {
        var f = r.fields || {};
        var cn = resolveClientName(f['Client Name'] || f['Client Full Name'] || f['Client'] || '', clientLookup);
        if (cn.toLowerCase() !== clientName.toLowerCase()) return;

        var hours = parseFloat(f['Total Hours (Decimal)']) || 0;
        var charge = parseFloat(f['Charge per hour']) || 0;
        var cost = Math.round(hours * charge * 100) / 100;

        var staffRaw = f['Staff Name'] || f['Staff'] || f['Employees'] || '';
        var staffName = '';
        if (Array.isArray(staffRaw) && staffRaw.length > 0) {
          staffName = staffRaw.map(function (id) { return clientLookup[id] || id; }).join(', ');
        } else { staffName = staffRaw || ''; }

        var startShift = f['Start Shift'] || '';
        var endShift = f['End Shift'] || '';
        var silOrCas = String(f['SIL or CAS?'] || '');
        var dayType = f['Day Type'] || '';
        var supportItem = f['Support Item Name'] || '';

        shifts.push({
          airtableId: r.id,
          staffName: staffName,
          startShift: startShift,
          endShift: endShift,
          hours: hours,
          chargePerHour: charge,
          cost: cost,
          silOrCas: silOrCas,
          dayType: dayType,
          supportItem: supportItem
        });

        // Build weekly aggregation
        if (startShift) {
          var dt = new Date(startShift);
          if (!isNaN(dt.getTime())) {
            var day = dt.getDay();
            var diff = dt.getDate() - day + (day === 0 ? -6 : 1);
            var mon = new Date(dt); mon.setDate(diff); mon.setHours(0, 0, 0, 0);
            var wk = mon.toISOString().split('T')[0];
            if (!weeklyBurn[wk]) weeklyBurn[wk] = { weekStart: wk, hours: 0, cost: 0, shiftCount: 0 };
            weeklyBurn[wk].hours += hours;
            weeklyBurn[wk].cost += cost;
            weeklyBurn[wk].shiftCount += 1;
          }
        }
      });

      // Sort shifts by date descending
      shifts.sort(function (a, b) {
        var da = a.startShift ? new Date(a.startShift).getTime() : 0;
        var dbv = b.startShift ? new Date(b.startShift).getTime() : 0;
        return dbv - da;
      });

      // Convert weeklyBurn to sorted array
      var weeklyArr = Object.keys(weeklyBurn).sort().map(function (wk) {
        var w = weeklyBurn[wk];
        w.hours = Math.round(w.hours * 100) / 100;
        w.cost = Math.round(w.cost * 100) / 100;
        return w;
      });

      console.log('Client budget shifts [' + clientName + ']: ' + shifts.length + ' shifts, ' + weeklyArr.length + ' weeks');
      res.json({ shifts: shifts, weeklyBurn: weeklyArr, total: shifts.length });
    });
  }).catch(function (e) {
    console.error('Client budget shifts error:', e.message);
    res.json({ shifts: [], weeklyBurn: [], error: e.message });
  });
});

// ═══════════════════════════════════════════════════════════
//  GET /api/clients/tasks — client tasks from Tasks table
// ═══════════════════════════════════════════════════════════
router.get('/tasks', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json({ records: [], total: 0 });
  var clientName = (req.query.name || '').trim();
  if (!clientName) return res.json({ records: [], total: 0 });

  airtable.fetchAllFromTableView('Tasks', 'Sorted by Latest Task').then(function (allRecords) {
    // Robust status resolver
    function resolveStatus(f) {
      var keys = Object.keys(f);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].toLowerCase().indexOf('follow up status') >= 0) {
          var val = f[keys[i]];
          if (val) {
            var sl = val.toLowerCase();
            if (sl.indexOf('complet') >= 0) return 'Completed';
            if (sl.indexOf('progress') >= 0) return 'In Progress';
            if (sl.indexOf('not start') >= 0) return 'Not Started';
            return val;
          }
        }
      }
      return '';
    }

    var matched = allRecords.filter(function (r) {
      var f = r.fields || {};
      var cn = f['Client Full Name (from Client Name)'];
      if (!cn) cn = f['Client Name'];
      var nameStr = Array.isArray(cn) ? cn.join(', ') : String(cn || '');
      return nameStr.toLowerCase() === clientName.toLowerCase();
    });

    var tasks = matched.map(function (r) {
      var f = r.fields || {};
      var typeOfUpdate = f['Type of Update (Multi-select)'] || '';
      if (Array.isArray(typeOfUpdate)) typeOfUpdate = typeOfUpdate.join(', ');
      var assignedTo = f['Full Name (from Assigned to Email)'] || f['Full Name (from Assigned to Office Staff)'] || '';
      if (Array.isArray(assignedTo)) assignedTo = assignedTo.join(', ');
      var linkedRef = f['Unique IR # (from Linked to Incident Report)'] || '';
      if (Array.isArray(linkedRef)) linkedRef = linkedRef[0] || '';
      var incidentSummary = f['Summarise the incident and/or allegation (without reference to peoples names). (from Linked to Incident Report)'] || '';
      if (Array.isArray(incidentSummary)) incidentSummary = incidentSummary[0] || '';
      var isReportable = f['Is this a Reportable Incident to the NDIS Quality Safeguards Commission?? (from Linked to Incident Report)'] || '';
      if (Array.isArray(isReportable)) isReportable = isReportable[0] || '';
      return {
        id: r.id, refNumber: f['Reference #'] || '', taskName: f['Task Name'] || '',
        description: f['Detailed Description'] || '', priority: f['Priority'] || '',
        status: resolveStatus(f), dueDate: f['Due Date for task to be completed'] || '',
        dateCompleted: f['Date Completed'] || '', createdDate: f['Created Date  & Time 2025'] || '',
        assignedTo: assignedTo, followUpRequired: f['Is there a follow up required?'] || '',
        followUpDetails: f['Details of follow up'] || '', actionsTaken: f['Actions taken to Complete task'] || '',
        typeOfUpdate: typeOfUpdate, methodOfContact: f['Method of Contact'] || '',
        createdBy: f['Created By'] || '', linkedIncidentRef: linkedRef,
        incidentSummary: incidentSummary, isNdisReportable: isReportable,
        isRecurring: f['Recurring Task?'] || '', recurringFrequency: f['Frequency of Recurring Task'] || '',
        nextDueDate: f['Next Due Date to occur'] || '', comments: []
      };
    });
    console.log('Client Tasks: Found ' + tasks.length + ' tasks for ' + clientName);
    res.json({ records: tasks, total: tasks.length });
  }).catch(function (e) {
    console.error('Client tasks error:', e.message);
    res.status(500).json({ error: e.message });
  });
});

// ═══════════════════════════════════════════════════════════
//  GET /api/clients/docs — client documents from Airtable
// ═══════════════════════════════════════════════════════════
var CLIENT_DOCS_TABLE = 'Client Docs';

router.get('/docs', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json([]);
  var clientName = req.query.clientName || '';
  if (!clientName) return res.json([]);

  var formula = "SEARCH(LOWER('" + clientName.replace(/'/g, "\\'").toLowerCase() + "'), LOWER({Client Name}))";
  var params = '?pageSize=50&filterByFormula=' + encodeURIComponent(formula);
  params += '&sort%5B0%5D%5Bfield%5D=Last+Updated&sort%5B0%5D%5Bdirection%5D=desc';

  airtable.rawFetch(CLIENT_DOCS_TABLE, 'GET', params)
    .then(function (data) {
      if (data.error) return res.json([]);
      var results = (data.records || []).map(function (r) {
        var f = r.fields || {};
        var files = (f['File Upload'] || []).map(function (a) {
          return { url: a.url || '', name: a.filename || a.name || '', size: a.size || 0, type: a.type || '' };
        });
        return {
          id: r.id,
          uniqueRef: f['Unique Ref #'] || '',
          clientName: f['Client Name'] || '',
          docType: f['Type of Document'] || '',
          expiryDate: f['Expiry Date of Document'] || '',
          lastUpdated: f['Last Updated'] || '',
          updatedBy: f['Updated by'] || '',
          attachmentSummary: f['Attachment Summary'] || '',
          statusOfDoc: f['Status of Doc'] || '',
          files: files
        };
      });
      res.json(results);
    })
    .catch(function (err) { console.error('Client docs GET error:', err); res.json([]); });
});

// ═══════════════════════════════════════════════════════════
//  POST /api/clients/docs/upload — upload / file a client doc
// ═══════════════════════════════════════════════════════════
router.post('/docs/upload', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: 'Airtable not configured' });
  var b = req.body;
  if (!b.clientName && !b.contactId) return res.status(400).json({ error: 'clientName or contactId required' });

  // Generate a unique 6-char reference
  var uniqueRef = (function () {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var ref = '';
    for (var i = 0; i < 6; i++) ref += chars.charAt(Math.floor(Math.random() * chars.length));
    return ref;
  })();

  var today = new Date().toISOString();
  var fields = {
    'Unique Ref #': uniqueRef,
    'Client Name': b.clientName || '',
    'Type of Document': b.docType || 'Other',
    'Last Updated': today,
    'Updated by': req.user ? (req.user.name || req.user.email || 'Titus') : 'Titus',
    'Status of Doc': 'Active'
  };

  // Parse expiry date if provided (expects dd/mm/yyyy or ISO)
  if (b.expiryDate) {
    try {
      var ep = b.expiryDate;
      if (ep.indexOf('/') >= 0) {
        var parts = ep.split('/');
        if (parts.length === 3) {
          var yr = parts[2].length === 2 ? '20' + parts[2] : parts[2];
          ep = yr + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
        }
      }
      fields['Expiry Date of Document'] = ep;
    } catch (e) { /* ignore */ }
  }

  airtable.rawFetch(CLIENT_DOCS_TABLE, 'POST', '', { records: [{ fields: fields }] })
    .then(function (data) {
      if (data.error) return res.status(500).json({ error: data.error.message || 'Failed to file document' });
      var recId = (data.records && data.records[0]) ? data.records[0].id : null;
      logAudit(req.user, 'upload_client_doc', 'ClientDoc', recId || '', b.clientName || '', 'Created', '', b.docType || 'Other');
      res.json({ success: true, id: recId, uniqueRef: uniqueRef });
    })
    .catch(function (err) { res.status(500).json({ error: err.message }); });
});

module.exports = router;
