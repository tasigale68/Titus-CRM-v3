var express = require('express');
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var PDFDocument = require('pdfkit');
var { authenticate } = require('../../middleware/auth');
var { db } = require('../../db/sqlite');
var { logAudit } = require('../../services/audit');
var airtable = require('../../services/database');
var env = require('../../config/env');
var { uploadDocScan, uploadTemplate } = require('../../config/upload');
var { msGraphFetch } = require('../../services/email');

var router = express.Router();

// ─── Constants ───────────────────────────────────────────
var DOC_TEMPLATES_TABLE = 'Employment Documents';
var DOC_SIGNING_TABLE = 'Document Signing Requests';
var CLIENT_DOCS_TABLE = 'Client Docs';
var COMPANY_FILES_TABLE = 'Company Files';
var AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'All Contacts';

var BASE_URL = process.env.BASE_URL || ('http://localhost:' + (process.env.PORT || 3000));

// ─── Helpers ─────────────────────────────────────────────

function isSeniorRole(user) {
  return user.role === 'superadmin' || user.role === 'director';
}

function generateUniqueRef() {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var r = '';
  for (var i = 0; i < 6; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
  return r;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  var d;
  if (dateStr instanceof Date) d = dateStr;
  else d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getFullYear()).slice(-2);
}

// Helper: get template settings from SQLite
function getTemplateSettings(airtableId) {
  var row = db.prepare('SELECT * FROM template_settings WHERE airtable_id = ?').get(airtableId);
  if (!row) return { reminderSettings: {}, signingFields: [], mergeFields: [] };
  var rs = {}; try { rs = JSON.parse(row.reminder_settings || '{}'); } catch (e) {}
  var sf = []; try { sf = JSON.parse(row.signing_fields || '[]'); } catch (e) {}
  var mf = []; try { mf = JSON.parse(row.merge_fields || '[]'); } catch (e) {}
  return { reminderSettings: rs, signingFields: sf, mergeFields: mf };
}

// Helper: save template settings to SQLite
function saveTemplateSettings(airtableId, reminderSettings, signingFields, mergeFields) {
  var existing = db.prepare('SELECT id FROM template_settings WHERE airtable_id = ?').get(airtableId);
  if (existing) {
    var updates = [];
    var params = [];
    if (reminderSettings !== undefined) { updates.push('reminder_settings = ?'); params.push(JSON.stringify(reminderSettings)); }
    if (signingFields !== undefined) { updates.push('signing_fields = ?'); params.push(JSON.stringify(signingFields)); }
    if (mergeFields !== undefined) { updates.push('merge_fields = ?'); params.push(JSON.stringify(mergeFields)); }
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(airtableId);
    if (updates.length > 1) db.prepare('UPDATE template_settings SET ' + updates.join(', ') + ' WHERE airtable_id = ?').run.apply(null, params);
  } else {
    db.prepare('INSERT INTO template_settings (airtable_id, reminder_settings, signing_fields, merge_fields) VALUES (?, ?, ?, ?)').run(
      airtableId,
      JSON.stringify(reminderSettings || {}),
      JSON.stringify(signingFields || []),
      JSON.stringify(mergeFields || [])
    );
  }
}

// ─── Compliance document scanning config ─────────────────
var DOC_TYPE_MAP = {
  'first_aid':      { attachField: 'First Aid',                   expiryFields: ['What is the expiry date of your First Aid Certificate?'],  numberField: null, label: 'First Aid' },
  'cpr':            { attachField: 'CPR',                         expiryFields: ['CPR Expiry Date'],                                        numberField: null, label: 'CPR' },
  'car_insurance':  { attachField: 'Comprehensive Car Insurance', expiryFields: ['Insurance Expiry'],                                       numberField: null, label: 'Car Insurance' },
  'drivers_licence':{ attachField: 'Drivers License',             expiryFields: ['D/License Expiry Date'],                                  numberField: null, label: 'Driver Licence' },
  'ndis_screening': { attachField: 'NDIS Worker Screening Card',  expiryFields: ['NDIS WS Expiry Date'],                                   numberField: null, label: 'NDIS Worker Screening' },
  'wwcc_blue_card': { attachField: 'WWCC Blue Card',              expiryFields: ['WWCC B/C Expiry'],                                       numberField: null, label: 'WWCC Blue Card' }
};


// ═══════════════════════════════════════════════════════════
//  PUBLIC ROUTES (no auth)
// ═══════════════════════════════════════════════════════════

// Redirect to static signing page
router.get('/sign-redirect/:token', function (req, res) {
  res.redirect('/sign.html?token=' + req.params.token);
});

// API to fetch signing details for the static page — NO AUTH
router.get('/signing/details/:token', function (req, res) {
  var token = req.params.token;
  if (!token || token.length < 10) return res.status(400).json({ error: 'Invalid signing link' });
  var formula = "{Signing Token} = '" + token.replace(/'/g, "\\'") + "'";
  var params = '?pageSize=1&filterByFormula=' + encodeURIComponent(formula);
  airtable.rawFetch(DOC_SIGNING_TABLE, 'GET', params)
    .then(function (data) {
      if (!data.records || data.records.length === 0) return res.status(404).json({ error: 'Signing request not found or expired' });
      var rec = data.records[0];
      var f = rec.fields || {};
      var docType = (function () { var v = f['Document Type (from Document Template)'] || f['Document Type']; if (Array.isArray(v)) return v[0] || 'Document'; return v || 'Document'; })();
      var templateFiles = f['Template File (from Document Template)'] || f['Template File (from Employment Documents)'] || [];
      var templateName = (function () { var v = f['Template Name (from Document Template)'] || f['Template Name (from Employment Documents)']; if (Array.isArray(v)) return v[0] || ''; return v || ''; })();
      var signerConfig = {};
      try { signerConfig = JSON.parse(f['Signer Config'] || '{}'); } catch (e) {}
      res.json({
        token: token,
        status: f['Status'] || 'Sent',
        recipientName: f['Recipient Name'] || '',
        docType: docType,
        templateName: templateName,
        fileUrl: templateFiles.length > 0 ? templateFiles[0].url || '' : '',
        fileName: templateFiles.length > 0 ? templateFiles[0].filename || '' : '',
        signerRole: f['Signer Role'] || 'participant',
        signerConfig: signerConfig,
        signedDate: f['Signed Date'] || null
      });
    })
    .catch(function (err) { console.error('Signing details error:', err); res.status(500).json({ error: 'Error loading signing details' }); });
});

// Submit signature — NO AUTH required
router.post('/signing/sign/:token', function (req, res) {
  var token = req.params.token;
  var signatureData = req.body.signature; // base64 PNG
  if (!token || !signatureData) return res.status(400).json({ error: 'Token and signature required' });

  // Look up the signing request
  var formula = "{Signing Token} = '" + token.replace(/'/g, "\\'") + "'";
  var params = '?pageSize=1&filterByFormula=' + encodeURIComponent(formula);
  airtable.rawFetch(DOC_SIGNING_TABLE, 'GET', params)
    .then(function (data) {
      if (!data.records || data.records.length === 0) return res.status(404).json({ error: 'Signing request not found' });
      var rec = data.records[0];
      var f = rec.fields || {};
      if (f['Status'] === 'Signed') return res.status(400).json({ error: 'Document already signed' });

      var today = new Date().toISOString();
      var signerIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';

      // Update the record
      var updateFields = {
        'Status': 'Signed',
        'Signed Date': today.split('T')[0],
        'Signer IP': signerIP
      };

      return airtable.rawFetch(DOC_SIGNING_TABLE, 'PATCH', '/' + rec.id, {
        fields: updateFields
      }).then(function (updated) {
        if (updated.error) return res.status(500).json({ error: 'Failed to save signature' });

        // Upload signature image as attachment
        // Airtable attachments need a URL - store the base64 data in a long text field instead
        airtable.rawFetch(DOC_SIGNING_TABLE, 'PATCH', '/' + rec.id, {
          fields: { 'Signature Image': signatureData.substring(0, 50000) }
        }).catch(function (e) { console.error('Signature image save error:', e); });

        // ── Post-signature workflow ──
        var signerRole = f['Signer Role'] || 'participant';
        var signerConfigRaw = f['Signer Config'] || '{}';
        var signerConfig = {};
        try { signerConfig = JSON.parse(signerConfigRaw); } catch (e) {}
        var recipientName = f['Recipient Name'] || '';
        var contactRecordIds = f['Staff Record'] || [];
        var templateIds = f['Document Template'] || [];
        var docType = (function () { var v = f['Document Type (from Document Template)'] || f['Document Type']; if (Array.isArray(v)) return v[0] || ''; return v || ''; })();
        var templateName = (function () { var v = f['Template Name (from Document Template)']; if (Array.isArray(v)) return v[0] || ''; return v || docType; })();

        // After participant/nominee signs, create DCS counter-sign token
        if (signerRole === 'participant' || signerRole === 'nominee') {
          var dcsToken = crypto.randomBytes(24).toString('hex');
          var dcsUrl = BASE_URL + '/sign/' + dcsToken;
          var dcsFields = {
            'Recipient Name': 'Delta Community Support (Authorised Representative)',
            'Recipient Email': 'operations@deltacommunity.com.au',
            'Document Type': docType || 'Agreement',
            'Status': 'Pending Counter-Signature',
            'Signing Token': dcsToken,
            'Signing URL': dcsUrl,
            'Sent Via (SMS , Email)': 'Internal',
            'Sent Date': new Date().toISOString().split('T')[0],
            'Signer Role': 'provider',
            'Parent Signing Token': token
          };
          if (templateIds.length > 0) dcsFields['Document Template'] = templateIds;
          if (contactRecordIds.length > 0) dcsFields['Staff Record'] = contactRecordIds;
          airtable.rawFetch(DOC_SIGNING_TABLE, 'POST', '', {
            records: [{ fields: dcsFields }]
          }).then(function (dcsRec) {
            var dcsId = (dcsRec.records && dcsRec.records[0]) ? dcsRec.records[0].id : null;
            console.log('DCS counter-sign request created. URL:', dcsUrl, 'RecID:', dcsId);
            // Alert DCS staff via email
            try {
              var alertPayload = {
                message: {
                  subject: 'Counter-signature required: ' + (docType || 'Agreement') + ' for ' + recipientName,
                  body: {
                    contentType: 'HTML',
                    content: '<p>A client has completed signing the <strong>' + (templateName || docType) + '</strong>.</p>' +
                      '<p>Participant: <strong>' + recipientName + '</strong></p>' +
                      '<p>Please counter-sign here: <a href=\'' + dcsUrl + '\'>' + dcsUrl + '</a></p>' +
                      '<p><small>Signer IP recorded at time of signing.</small></p>'
                  },
                  toRecipients: [{ emailAddress: { address: 'operations@deltacommunity.com.au' } }]
                },
                saveToSentItems: true
              };
              msGraphFetch('/users/' + env.microsoft.emailAddress + '/sendMail', 'POST', alertPayload).catch(function (e) {
                console.error('Counter-sign alert email error:', e);
              });
            } catch (emailErr) {
              console.error('Counter-sign alert email setup error:', emailErr);
            }
          }).catch(function (e) { console.error('DCS counter-sign creation error:', e); });
        }

        // After DCS counter-signs (provider role) — file to Client Docs + distribute to nominated recipients
        if (signerRole === 'provider') {
          var parentToken = f['Parent Signing Token'] || '';
          var executedDate = formatDate(new Date());

          // Mark current DCS record as Fully Executed
          airtable.rawFetch(DOC_SIGNING_TABLE, 'PATCH', '/' + rec.id, {
            fields: { 'Status': 'Fully Executed' }
          }).catch(function (e) { console.error('Provider status update error:', e); });

          // Core post-execution logic — runs once parent record is resolved
          function runPostExecution(distributionListJson) {
            var distList = [];
            try { distList = JSON.parse(distributionListJson || '[]'); } catch (e) {}

            // ── 1. File into Client Docs Airtable table ──
            var uniqueRef = generateUniqueRef();

            airtable.rawFetch(CLIENT_DOCS_TABLE, 'POST', '', { records: [{ fields: {
              'Unique Ref #': uniqueRef,
              'Client Name': recipientName,
              'Type of Document': docType || templateName || 'Service Agreement',
              'Last Updated': new Date().toISOString(),
              'Updated by': 'Titus (Auto-filed)',
              'Status of Doc': 'Active',
              'Attachment Summary': 'Auto-filed from e-signature workflow. Executed: ' + executedDate
            } }] }).then(function () {
              console.log('Client doc filed in Client Docs for: ' + recipientName + ' [' + uniqueRef + ']');
            }).catch(function (e) { console.error('Client Docs filing error:', e); });

            // ── 2. Send emails to nominated distribution recipients ──
            if (distList.length === 0) {
              console.log('No distribution recipients nominated — skipping distribution email.');
              return;
            }
            if (!env.microsoft.emailAddress) {
              console.log('Distribution email skipped — MS Graph not configured. Would send to:', distList.map(function (r) { return r.email; }).join(', '));
              return;
            }

            var emailRecipients = distList.map(function (r) {
              return { emailAddress: { address: r.email, name: r.name || r.email } };
            });

            var distBody = '<div style=\'font-family:Arial,sans-serif;max-width:620px\'>' +
              '<div style=\'background:linear-gradient(135deg,#1E3A5F,#2563EB);color:#fff;padding:20px 24px;border-radius:10px 10px 0 0\'>' +
              '<div style=\'font-size:11px;font-weight:600;opacity:.7;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px\'>Delta Community Support</div>' +
              '<h2 style=\'margin:0;font-size:20px;font-weight:700\'>Fully Executed Agreement</h2>' +
              '<p style=\'margin:6px 0 0;font-size:12px;opacity:.8\'>All parties have signed — this copy is for your records.</p>' +
              '</div><div style=\'padding:24px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px\'>' +
              '<p style=\'font-size:14px;color:#1e293b;margin-top:0\'>The following agreement has been fully executed and signed by all required parties.</p>' +
              '<table style=\'width:100%;border-collapse:collapse;margin:16px 0;border-radius:8px;overflow:hidden\'>' +
              '<tr style=\'background:#1E3A5F;color:#fff\'><th colspan=\'2\' style=\'padding:10px 14px;font-size:11px;font-weight:600;text-align:left;letter-spacing:.5px\'>AGREEMENT DETAILS</th></tr>' +
              '<tr style=\'background:#fff\'><td style=\'padding:10px 14px;font-size:11px;font-weight:600;color:#64748b;border:1px solid #e2e8f0;width:35%\'>Participant</td><td style=\'padding:10px 14px;font-size:13px;font-weight:700;color:#1e293b;border:1px solid #e2e8f0\'>' + recipientName + '</td></tr>' +
              '<tr style=\'background:#f8fafc\'><td style=\'padding:10px 14px;font-size:11px;font-weight:600;color:#64748b;border:1px solid #e2e8f0\'>Document Type</td><td style=\'padding:10px 14px;font-size:13px;color:#1e293b;border:1px solid #e2e8f0\'>' + (docType || templateName || 'Agreement') + '</td></tr>' +
              '<tr style=\'background:#fff\'><td style=\'padding:10px 14px;font-size:11px;font-weight:600;color:#64748b;border:1px solid #e2e8f0\'>Date Executed</td><td style=\'padding:10px 14px;font-size:13px;color:#1e293b;border:1px solid #e2e8f0\'>' + executedDate + '</td></tr>' +
              '<tr style=\'background:#f8fafc\'><td style=\'padding:10px 14px;font-size:11px;font-weight:600;color:#64748b;border:1px solid #e2e8f0\'>Reference #</td><td style=\'padding:10px 14px;font-size:13px;font-family:monospace;color:#1e293b;border:1px solid #e2e8f0\'>' + uniqueRef + '</td></tr>' +
              '</table>' +
              '<div style=\'background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:12px 16px;margin-top:16px\'>' +
              '<p style=\'font-size:12px;color:#065f46;margin:0\'>This agreement has been automatically filed in the Client Documents register in Titus under reference <strong>' + uniqueRef + '</strong>.</p>' +
              '</div>' +
              '<p style=\'font-size:11px;color:#94a3b8;margin-top:20px;margin-bottom:0\'>Sent automatically by Titus - Delta Community Support - NDIS Provider</p>' +
              '</div></div>';

            msGraphFetch('/users/' + env.microsoft.emailAddress + '/sendMail', 'POST', {
              message: {
                subject: 'Executed: ' + (docType || templateName || 'Agreement') + ' - ' + recipientName + ' [' + uniqueRef + ']',
                body: { contentType: 'HTML', content: distBody },
                toRecipients: emailRecipients
              },
              saveToSentItems: true
            }).then(function (d) {
              if (d && d.error) console.error('Distribution email error:', d.error);
              else console.log('Sent to ' + distList.length + ' recipient(s) for ' + recipientName);
            }).catch(function (e) { console.error('Distribution email send error:', e); });
          }

          // Resolve parent to get the distribution list stored at send time
          if (parentToken) {
            var pFormula = "{Signing Token} = '" + parentToken.replace(/'/g, "\\'") + "'";
            airtable.rawFetch(DOC_SIGNING_TABLE, 'GET', '?pageSize=1&filterByFormula=' + encodeURIComponent(pFormula))
              .then(function (pd) {
                var pRec = pd.records && pd.records[0];
                if (pRec) {
                  airtable.rawFetch(DOC_SIGNING_TABLE, 'PATCH', '/' + pRec.id, {
                    fields: { 'Status': 'Fully Executed' }
                  }).catch(function (e) { console.error('Parent status update error:', e); });
                  runPostExecution(pRec.fields['Distribution List'] || '[]');
                } else {
                  runPostExecution('[]');
                }
              }).catch(function (e) { console.error('Parent lookup error:', e); runPostExecution('[]'); });
          } else {
            runPostExecution(f['Distribution List'] || '[]');
          }
        }

        res.json({ success: true, message: 'Document signed successfully', nextStep: signerRole === 'provider' ? 'fully_executed' : 'awaiting_dcs_countersign' });
      });
    })
    .catch(function (err) { console.error('Sign error:', err); res.status(500).json({ error: 'Failed to process signature' }); });
});


// ═══════════════════════════════════════════════════════════
//  AUTHENTICATED ROUTES
// ═══════════════════════════════════════════════════════════

router.use(authenticate);


// ═══════════════════════════════════════════════════════════
//  DOCUMENT TEMPLATES
// ═══════════════════════════════════════════════════════════

// List document templates
router.get('/templates', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json([]);
  var showAll = req.query.all === '1';
  airtable.fetchAllFromTable(DOC_TEMPLATES_TABLE).then(function (records) {
    var templates = (records || []).map(function (r) {
      var f = r.fields || {};
      var settings = getTemplateSettings(r.id);
      var rs = settings.reminderSettings;
      return {
        id: r.id,
        name: f['Template Name'] || '',
        type: f['Document Type'] || '',
        status: f['Status'] || '',
        description: f['Description'] || '',
        files: (f['Template File'] || []).map(function (a) { return { url: a.url || '', name: a.filename || '', size: a.size || 0, type: a.type || '' }; }),
        created: f['Created Date'] || '',
        reminderEnabled: rs.enabled !== false,
        reminderDays: rs.days || 3,
        maxReminders: rs.max || 3,
        reminderVia: rs.via || 'Email',
        signingFields: settings.signingFields || [],
        mergeFields: settings.mergeFields || []
      };
    });
    if (!showAll) {
      templates = templates.filter(function (t) { return (t.status || '').toLowerCase() === 'active'; });
    }
    res.json(templates);
  }).catch(function (e) { console.error('Doc templates error:', e); res.json([]); });
});

// Upload template file
router.post('/templates/upload', uploadTemplate.single('file'), function (req, res) {
  if (!isSeniorRole(req.user)) return res.status(403).json({ error: 'Super Admin only' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  var fileUrl = BASE_URL + '/uploads/templates/' + req.file.filename;
  res.json({
    success: true,
    url: fileUrl,
    filename: req.file.originalname,
    size: req.file.size,
    storedName: req.file.filename
  });
});

// Create document template
router.post('/templates', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: 'Airtable not configured' });
  if (!isSeniorRole(req.user)) return res.status(403).json({ error: 'Super Admin only' });
  var b = req.body;
  if (!b.name || !b.type) return res.status(400).json({ error: 'Name and type required' });

  var fields = {
    'Template Name': b.name,
    'Document Type': b.type,
    'Status': b.status || 'Active',
    'Description': b.description || ''
  };

  // If a file was uploaded, attach it via URL
  if (b.fileUrl && b.fileName) {
    fields['Template File'] = [{ url: b.fileUrl, filename: b.fileName }];
  }

  airtable.rawFetch(DOC_TEMPLATES_TABLE, 'POST', '', {
    records: [{ fields: fields }]
  }).then(function (data) {
    if (data.error) return res.status(500).json({ error: data.error.message || 'Failed' });
    var rec = (data.records && data.records[0]) || {};
    var airtableId = rec.id;

    // Save reminder settings and signing fields to SQLite
    if (airtableId) {
      saveTemplateSettings(airtableId, {
        enabled: b.reminderEnabled !== false,
        days: b.reminderDays || 3,
        max: b.maxReminders || 3,
        via: b.reminderVia || 'Email'
      }, b.signingFields || [], b.mergeFields || []);
    }

    res.json({ success: true, id: airtableId });
  }).catch(function (err) { res.status(500).json({ error: 'Failed to create template' }); });
});

// Update document template
router.patch('/templates/:id', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: 'Airtable not configured' });
  if (!isSeniorRole(req.user)) return res.status(403).json({ error: 'Super Admin only' });
  var b = req.body;
  var fields = {};
  if (b.name !== undefined) fields['Template Name'] = b.name;
  if (b.type !== undefined) fields['Document Type'] = b.type;
  if (b.status !== undefined) fields['Status'] = b.status;
  if (b.description !== undefined) fields['Description'] = b.description;

  // If a new file was uploaded, update the attachment
  if (b.fileUrl && b.fileName) {
    fields['Template File'] = [{ url: b.fileUrl, filename: b.fileName }];
  }

  // Save reminder settings and signing/merge fields to SQLite (not Airtable)
  var hasSettingsUpdate = b.reminderEnabled !== undefined || b.reminderDays !== undefined ||
    b.maxReminders !== undefined || b.reminderVia !== undefined ||
    b.signingFields !== undefined || b.mergeFields !== undefined;

  if (hasSettingsUpdate) {
    var reminderUpdate = undefined;
    if (b.reminderEnabled !== undefined || b.reminderDays !== undefined || b.maxReminders !== undefined || b.reminderVia !== undefined) {
      reminderUpdate = {
        enabled: b.reminderEnabled !== undefined ? b.reminderEnabled : true,
        days: b.reminderDays || 3,
        max: b.maxReminders || 3,
        via: b.reminderVia || 'Email'
      };
    }
    saveTemplateSettings(req.params.id, reminderUpdate, b.signingFields, b.mergeFields);
  }

  // Only PATCH Airtable if there are Airtable field changes
  if (Object.keys(fields).length === 0) {
    return res.json({ success: true });
  }

  airtable.rawFetch(DOC_TEMPLATES_TABLE, 'PATCH', '/' + req.params.id, {
    fields: fields
  }).then(function (data) {
    if (data.error) return res.status(500).json({ error: data.error.message || 'Failed' });
    res.json({ success: true });
  }).catch(function (err) { res.status(500).json({ error: 'Failed to update template' }); });
});

// Delete document template
router.delete('/templates/:id', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: 'Airtable not configured' });
  if (!isSeniorRole(req.user)) return res.status(403).json({ error: 'Super Admin only' });

  // Clean up SQLite settings
  db.prepare('DELETE FROM template_settings WHERE airtable_id = ?').run(req.params.id);

  airtable.rawFetch(DOC_TEMPLATES_TABLE, 'DELETE', '/' + req.params.id)
    .then(function (data) {
      if (data.error) return res.status(500).json({ error: data.error.message || 'Failed' });
      res.json({ success: true });
    }).catch(function (err) { res.status(500).json({ error: 'Failed to delete template' }); });
});


// ═══════════════════════════════════════════════════════════
//  DOCUMENT SIGNING REQUESTS
// ═══════════════════════════════════════════════════════════

// List signing requests for a contact (by email)
router.get('/signing', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json([]);
  var email = req.query.email;
  if (!email) return res.json([]);
  var formula = "{Recipient Email} = '" + email.replace(/'/g, "\\'") + "'";
  var params = '?pageSize=100&filterByFormula=' + encodeURIComponent(formula);
  airtable.rawFetch(DOC_SIGNING_TABLE, 'GET', params)
    .then(function (data) {
      if (data.error) { console.error('Doc signing error:', data.error); return res.json([]); }
      var records = (data.records || []).map(function (rec) {
        var f = rec.fields || {};
        return {
          id: rec.id,
          recipientName: f['Recipient Name'] || '',
          recipientEmail: f['Recipient Email'] || '',
          templateName: (function () { var v = f['Template Name (from Document Template)'] || f['Document Template']; if (Array.isArray(v)) return v[0] || ''; return v || ''; })(),
          documentType: (function () { var v = f['Document Type (from Document Template)'] || f['Document Type']; if (Array.isArray(v)) return v[0] || ''; return v || ''; })(),
          status: f['Status'] || '',
          sentVia: f['Sent Via (SMS , Email)'] || f['Sent Via'] || '',
          sentDate: f['Sent Date'] || '',
          signedDate: f['Signed Date'] || '',
          signingToken: f['Signing Token'] || '',
          signingUrl: f['Signing URL'] || '',
          signerRole: f['Signer Role'] || 'participant',
          parentSigningToken: f['Parent Signing Token'] || '',
          signedDoc: (f['Signed Document'] || []).map(function (a) { return { url: a.url || '', name: a.filename || '' }; }),
          templateFile: (f['Template File (from Document Template)'] || f['Template File (from Employment Documents)'] || []).map(function (a) { return { url: a.url || '', name: a.filename || '' }; }),
          created: f['Created Date'] || ''
        };
      });
      records.sort(function (a, b) { return (b.sentDate || b.created || '').localeCompare(a.sentDate || a.created || ''); });
      res.json(records);
    })
    .catch(function (err) { console.error('Doc signing error:', err); res.json([]); });
});

// List all signing requests (admin view)
router.get('/signing/all', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json([]);
  var statusFilter = req.query.status;
  var params = '?pageSize=100&sort%5B0%5D%5Bfield%5D=Sent%20Date&sort%5B0%5D%5Bdirection%5D=desc';
  if (statusFilter) {
    params += '&filterByFormula=' + encodeURIComponent("{Status} = '" + statusFilter.replace(/'/g, "\\'") + "'");
  }
  airtable.rawFetch(DOC_SIGNING_TABLE, 'GET', params)
    .then(function (data) {
      if (data.error) { console.error('Doc signing all error:', data.error); return res.json([]); }
      var records = (data.records || []).map(function (rec) {
        var f = rec.fields || {};
        return {
          id: rec.id,
          recipientName: f['Recipient Name'] || '',
          recipientEmail: f['Recipient Email'] || '',
          recipientPhone: f['Recipient Phone'] || '',
          templateName: (function () { var v = f['Template Name (from Document Template)'] || f['Document Template']; if (Array.isArray(v)) return v[0] || ''; return v || ''; })(),
          documentType: (function () { var v = f['Document Type (from Document Template)'] || f['Document Type']; if (Array.isArray(v)) return v[0] || ''; return v || ''; })(),
          status: f['Status'] || '',
          sentVia: f['Sent Via (SMS , Email)'] || f['Sent Via'] || '',
          sentDate: f['Sent Date'] || '',
          signedDate: f['Signed Date'] || '',
          signingToken: f['Signing Token'] || '',
          signingUrl: f['Signing URL'] || '',
          signerRole: f['Signer Role'] || 'participant',
          parentSigningToken: f['Parent Signing Token'] || '',
          signedDoc: (f['Signed Document'] || []).map(function (a) { return { url: a.url || '', name: a.filename || '' }; }),
          templateFile: (f['Template File (from Document Template)'] || f['Template File (from Employment Documents)'] || []).map(function (a) { return { url: a.url || '', name: a.filename || '' }; }),
          created: f['Created Date'] || ''
        };
      });
      res.json(records);
    })
    .catch(function (err) { console.error('Doc signing all error:', err); res.json([]); });
});

// Send document for signing
router.post('/signing/send', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: 'Airtable not configured' });
  var b = req.body;
  if (!b.recipientName || !b.recipientEmail || !b.templateId) return res.status(400).json({ error: 'Recipient name, email, and template are required' });

  // Generate unique signing token
  var signingToken = crypto.randomBytes(24).toString('hex');
  var today = new Date().toISOString().split('T')[0];

  var fields = {
    'Recipient Name': b.recipientName,
    'Recipient Email': b.recipientEmail,
    'Document Type': b.documentType || '',
    'Status': 'Sent',
    'Signing Token': signingToken,
    'Sent Via (SMS , Email)': b.sendVia || 'Email',
    'Sent Date': today
  };
  if (b.recipientPhone) fields['Recipient Phone'] = b.recipientPhone;
  if (b.templateId) fields['Document Template'] = [b.templateId];
  if (b.contactRecordId) fields['Staff Record'] = [b.contactRecordId];
  if (b.signerRole) fields['Signer Role'] = b.signerRole; // participant | nominee | provider
  if (b.signerConfig) fields['Signer Config'] = typeof b.signerConfig === 'string' ? b.signerConfig : JSON.stringify(b.signerConfig);
  if (b.parentSigningToken) fields['Parent Signing Token'] = b.parentSigningToken;
  if (b.signingOrder) fields['Signing Order'] = b.signingOrder; // contact_first | provider_first
  // Store nominated distribution recipients as JSON in a long text field
  if (b.distributionEmails && Array.isArray(b.distributionEmails) && b.distributionEmails.length > 0) {
    fields['Distribution List'] = JSON.stringify(
      b.distributionEmails.map(function (email, i) {
        return { email: email, name: (b.distributionNames && b.distributionNames[i]) || email };
      })
    );
  }

  airtable.rawFetch(DOC_SIGNING_TABLE, 'POST', '', {
    records: [{ fields: fields }]
  }).then(function (data) {
    if (data.error) { console.error('Create signing request error:', data.error); return res.status(500).json({ error: data.error.message || 'Failed to create' }); }
    var rec = (data.records && data.records[0]) || {};
    var signingUrl = BASE_URL + '/sign/' + signingToken;
    // Store the signing URL in Airtable for easy retrieval
    airtable.rawFetch(DOC_SIGNING_TABLE, 'PATCH', '/' + rec.id, {
      fields: { 'Signing URL': signingUrl }
    }).catch(function (e) { console.error('Store signing URL error:', e); });

    // Send via SMS or Email
    if (b.sendVia === 'SMS' && b.recipientPhone) {
      // SMS sending would be done via Twilio if configured
      // For now, store the link for manual sharing
      console.log('Signing SMS would be sent to:', b.recipientPhone, 'URL:', signingUrl);
    } else if (b.sendVia === 'Email' || !b.sendVia) {
      // For email, provide the link
      console.log('Signing URL for ' + b.recipientName + ': ' + signingUrl);
    }

    res.json({ success: true, id: rec.id, signingUrl: signingUrl, token: signingToken });
  }).catch(function (err) { console.error('Create signing request error:', err); res.status(500).json({ error: 'Failed to create signing request' }); });
});

// Get signing requests for a specific contact/client
router.get('/signing/for-contact', function (req, res) {
  var contactId = req.query.contactId || '';
  var clientName = req.query.clientName || '';
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json([]);

  // Build filter formula — look for this contact's record ID in Staff Record field
  var formula = '';
  if (contactId) {
    formula = "FIND('" + contactId.replace(/'/g, "\\'") + "', {Staff Record})";
  } else if (clientName) {
    formula = "FIND('" + clientName.replace(/'/g, "\\'") + "', {Recipient Name})";
  } else {
    return res.json([]);
  }

  var params = '?pageSize=50&filterByFormula=' + encodeURIComponent(formula);
  params += '&sort%5B0%5D%5Bfield%5D=Sent+Date&sort%5B0%5D%5Bdirection%5D=desc';
  airtable.rawFetch(DOC_SIGNING_TABLE, 'GET', params)
    .then(function (data) {
      if (data.error) return res.json([]);
      var results = (data.records || []).map(function (r) {
        var f = r.fields || {};
        var docType = (function () { var v = f['Document Type (from Document Template)'] || f['Document Type']; if (Array.isArray(v)) return v[0] || ''; return v || ''; })();
        var templateName = (function () { var v = f['Template Name (from Document Template)']; if (Array.isArray(v)) return v[0] || ''; return v || ''; })();
        return {
          id: r.id,
          recipientName: f['Recipient Name'] || '',
          documentType: docType || templateName || 'Document',
          templateName: templateName,
          status: f['Status'] || '',
          sentDate: f['Sent Date'] || '',
          signedDate: f['Signed Date'] || '',
          signerRole: f['Signer Role'] || 'participant',
          signingUrl: f['Signing URL'] || '',
          signedDoc: (f['Signed Document'] || []).map(function (a) { return { url: a.url || '', name: a.filename || '' }; })
        };
      });
      res.json(results);
    })
    .catch(function (err) { console.error('Doc signing for contact error:', err); res.json([]); });
});


// ═══════════════════════════════════════════════════════════
//  CLIENT DOCS (Airtable Client Docs table)
// ═══════════════════════════════════════════════════════════

// Upload a document for a client (files it in the real Client Docs Airtable table)
router.post('/client-docs/upload', function (req, res) {
  var b = req.body;
  if (!b.clientName && !b.contactId) return res.status(400).json({ error: 'clientName or contactId required' });

  var uniqueRef = generateUniqueRef();
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
    } catch (e) {}
  }

  airtable.rawFetch(CLIENT_DOCS_TABLE, 'POST', '', { records: [{ fields: fields }] })
    .then(function (data) {
      if (data.error) return res.status(500).json({ error: data.error.message || 'Failed to file document' });
      var recId = (data.records && data.records[0]) ? data.records[0].id : null;
      res.json({ success: true, id: recId, uniqueRef: uniqueRef });
    })
    .catch(function (err) { res.status(500).json({ error: err.message }); });
});

// Get client docs from the real Client Docs Airtable table
router.get('/client-docs', function (req, res) {
  var clientName = req.query.clientName || '';
  if (!env.airtable.apiKey || !env.airtable.baseId || !clientName) return res.json([]);

  // Search by client name — exact first, then partial
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
//  COMPLIANCE DOCUMENT SCANNING (AI)
// ═══════════════════════════════════════════════════════════

// POST /api/documents/scan/:id — AI compliance document scanner
router.post('/scan/:id', uploadDocScan.single('file'), function (req, res) {
  var recordId = req.params.id;
  var documentType = req.body.documentType || '';
  var docConfig = DOC_TYPE_MAP[documentType];
  if (!docConfig) return res.status(400).json({ error: 'Invalid documentType. Must be one of: ' + Object.keys(DOC_TYPE_MAP).join(', ') });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!env.anthropic.apiKey) return res.status(500).json({ error: 'Anthropic API key not configured' });

  var filePath = req.file.path;
  var originalName = req.file.originalname || req.file.filename;
  var mimeType = req.file.mimetype || 'image/jpeg';
  var ext = path.extname(originalName).toLowerCase();
  var isPDF = ext === '.pdf' || mimeType === 'application/pdf';
  var fileUrl = BASE_URL + '/uploads/doc-scan/' + req.file.filename;

  console.log('[DocScan] Record:', recordId, 'Type:', documentType, 'File:', originalName, 'MIME:', mimeType);

  // Step 1: Upload attachment to Airtable
  var attachFields = {};
  attachFields[docConfig.attachField] = [{ url: fileUrl, filename: originalName }];
  airtable.rawFetch(AIRTABLE_TABLE_NAME, 'PATCH', '/' + recordId, { fields: attachFields }).then(function (data) {
    if (data.error) console.warn('[DocScan] Airtable attach warning:', JSON.stringify(data.error).substring(0, 200));
    else console.log('[DocScan] Attached to Airtable:', docConfig.attachField);
  }).catch(function (e) { console.warn('[DocScan] Airtable attach error:', e.message); });

  // Step 2: Send to Claude for AI extraction
  var base64Data = fs.readFileSync(filePath).toString('base64');
  var scanPrompt = 'Extract the following from this ' + docConfig.label + ' document:\n1) Document type (confirm it is a ' + docConfig.label + ')\n2) Card/certificate number (if visible)\n3) Expiry date (in DD/MM/YYYY format)\n4) Holder name\n\nReturn as JSON with keys: documentType, number, expiryDate, holderName, confidence (high/medium/low).\nIf a field cannot be determined, use null. Always use DD/MM/YYYY for dates.';

  var messageContent;
  if (isPDF) {
    messageContent = [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } },
      { type: 'text', text: scanPrompt }
    ];
  } else {
    var safeMime = mimeType;
    if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].indexOf(safeMime) < 0) safeMime = 'image/jpeg';
    messageContent = [
      { type: 'image', source: { type: 'base64', media_type: safeMime, data: base64Data } },
      { type: 'text', text: scanPrompt }
    ];
  }

  var apiHeaders = {
    'Content-Type': 'application/json',
    'x-api-key': env.anthropic.apiKey,
    'anthropic-version': '2023-06-01'
  };
  if (isPDF) apiHeaders['anthropic-beta'] = 'pdfs-2024-09-25';

  fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: apiHeaders,
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 500,
      messages: [{ role: 'user', content: messageContent }]
    })
  }).then(function (r) { return r.json(); }).then(function (d) {
    if (d.error) {
      console.error('[DocScan] Claude error:', JSON.stringify(d.error));
      return res.json({ error: d.error.message || 'AI scan failed', fileUrl: fileUrl });
    }
    var text = (d.content && d.content[0]) ? (d.content[0].text || '') : '';
    text = text.replace(/```json|```/g, '').trim();
    var jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];
    try {
      var parsed = JSON.parse(text);
      console.log('[DocScan] Extracted:', JSON.stringify(parsed));
      res.json({
        success: true,
        extracted: parsed,
        documentType: documentType,
        docLabel: docConfig.label,
        fileUrl: fileUrl,
        recordId: recordId
      });
    } catch (e) {
      console.error('[DocScan] Parse error:', e.message, 'Raw:', text.substring(0, 300));
      res.json({ error: 'Could not parse AI response', raw: text.substring(0, 500), fileUrl: fileUrl });
    }
    // Clean up after 3 minutes
    setTimeout(function () { try { fs.unlinkSync(filePath); } catch (e) {} }, 180000);
  }).catch(function (e) {
    console.error('[DocScan] Fetch error:', e.message);
    res.json({ error: e.message, fileUrl: fileUrl });
  });
});

// POST /api/documents/scan/:id/confirm — Save confirmed scan results
router.post('/scan/:id/confirm', function (req, res) {
  var recordId = req.params.id;
  var documentType = req.body.documentType || '';
  var expiryDate = req.body.expiryDate || '';
  var docNumber = req.body.number || '';
  var docConfig = DOC_TYPE_MAP[documentType];
  if (!docConfig) return res.status(400).json({ error: 'Invalid documentType' });

  // Convert DD/MM/YYYY to YYYY-MM-DD (Airtable date format)
  if (expiryDate && expiryDate.indexOf('/') >= 0) {
    var parts = expiryDate.split('/');
    if (parts.length === 3) {
      var dd = parts[0], mm = parts[1], yyyy = parts[2];
      if (yyyy.length === 2) yyyy = '20' + yyyy;
      expiryDate = yyyy + '-' + mm.padStart(2, '0') + '-' + dd.padStart(2, '0');
    }
  }

  if (!expiryDate && !docNumber) return res.json({ success: true, message: 'No fields to update' });

  // Try each expiry field name variant until one works
  var expiryFieldNames = docConfig.expiryFields || [];
  function tryExpiryField(idx) {
    var fields = {};
    if (expiryDate && idx < expiryFieldNames.length) {
      fields[expiryFieldNames[idx]] = expiryDate;
    } else if (expiryDate && idx >= expiryFieldNames.length) {
      // All expiry field names exhausted — skip expiry, just save number
      console.warn('[DocConfirm] All expiry field names failed for', documentType);
    }
    if (docNumber && docConfig.numberField) fields[docConfig.numberField] = docNumber;
    if (Object.keys(fields).length === 0) return res.json({ success: true, message: 'No writable fields found' });

    console.log('[DocConfirm] Record:', recordId, 'Trying fields:', JSON.stringify(fields));
    airtable.rawFetch(AIRTABLE_TABLE_NAME, 'PATCH', '/' + recordId, { fields: fields }).then(function (data) {
      if (data.error) {
        var errMsg = data.error.message || JSON.stringify(data.error);
        if (errMsg.indexOf('Unknown field name') >= 0 && expiryDate && idx < expiryFieldNames.length - 1) {
          console.log('[DocConfirm] Field not found:', expiryFieldNames[idx], '— trying next variant');
          return tryExpiryField(idx + 1);
        }
        console.error('[DocConfirm] Airtable error:', errMsg);
        return res.status(400).json({ error: errMsg });
      }
      console.log('[DocConfirm] Updated:', recordId, 'using field:', expiryDate ? expiryFieldNames[idx] : '(no expiry)');
      res.json({ success: true });
    }).catch(function (e) {
      console.error('[DocConfirm] Error:', e.message);
      res.status(500).json({ error: e.message });
    });
  }
  tryExpiryField(0);
});


// ═══════════════════════════════════════════════════════════
//  COMPANY FILES
// ═══════════════════════════════════════════════════════════

// GET /api/documents/company — list company files
router.get('/company', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json({ files: [] });
  var statusFilter = req.query.status || 'All';
  var categoryFilter = req.query.category || '';
  var formula = '';
  if (statusFilter && statusFilter !== 'All') {
    formula = "{Status}='" + statusFilter.replace(/'/g, "\\'") + "'";
  }
  if (categoryFilter && categoryFilter !== 'All') {
    var catPart = "{Category}='" + categoryFilter.replace(/'/g, "\\'") + "'";
    formula = formula ? 'AND(' + formula + ',' + catPart + ')' : catPart;
  }
  var params = '?pageSize=100';
  if (formula) params += '&filterByFormula=' + encodeURIComponent(formula);
  params += '&sort%5B0%5D%5Bfield%5D=Name&sort%5B0%5D%5Bdirection%5D=asc';
  airtable.rawFetch(COMPANY_FILES_TABLE, 'GET', params)
    .then(function (data) {
      if (data.error) {
        console.log('[Company Files] Table not found or error:', data.error.message || data.error.type);
        return res.json({ files: [] });
      }
      var files = (data.records || []).map(function (r) {
        var f = r.fields || {};
        var attachments = (f['File'] || f['Attachment'] || f['File Upload'] || []).map(function (a) {
          return { url: a.url || '', name: a.filename || a.name || '', size: a.size || 0, type: a.type || '' };
        });
        return {
          id: r.id,
          name: f['Name'] || f['File Name'] || '',
          description: f['Description'] || f['Notes'] || '',
          category: f['Category'] || f['Type'] || '',
          status: f['Status'] || 'Active',
          fileName: attachments.length > 0 ? attachments[0].name : '',
          fileUrl: attachments.length > 0 ? attachments[0].url : '',
          attachments: attachments,
          createdBy: f['Created By'] || f['Uploaded By'] || '',
          createdDate: f['Created'] || f['Date'] || f['Date Added'] || f['Upload Date'] || '',
          lastModified: f['Last Modified'] || f['Modified'] || '',
          modifiedBy: f['Modified By'] || f['Updated By'] || ''
        };
      });
      res.json({ files: files });
    })
    .catch(function (err) {
      console.error('[Company Files] Fetch error:', err.message);
      res.json({ files: [] });
    });
});

// PATCH /api/documents/company/:id — update company file
router.patch('/company/:id', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: 'Airtable not configured' });
  var fields = {};
  if (req.body.status) fields['Status'] = req.body.status;
  if (req.body.name) fields['Name'] = req.body.name;
  if (req.body.category) fields['Category'] = req.body.category;
  if (req.body.description !== undefined) fields['Description'] = req.body.description;
  if (Object.keys(fields).length === 0) return res.json({ success: true });
  airtable.rawFetch(COMPANY_FILES_TABLE, 'PATCH', '/' + req.params.id, { fields: fields })
    .then(function (data) {
      if (data && data.error) return res.status(400).json({ error: data.error.message || 'Update failed' });
      res.json({ success: true, id: req.params.id });
    })
    .catch(function (err) { res.status(500).json({ error: err.message }); });
});


// ═══════════════════════════════════════════════════════════
//  SERVICE AGREEMENTS
// ═══════════════════════════════════════════════════════════

// List agreements
router.get('/agreements', function (req, res) {
  var filters = [];
  if (req.query.status) filters.push("{Status}='" + req.query.status + "'");
  if (req.query.client) filters.push("{Client Name}='" + req.query.client + "'");
  var formula = filters.length ? 'AND(' + filters.join(',') + ')' : '';
  var url = formula ? '?filterByFormula=' + encodeURIComponent(formula) : '';
  airtable.rawFetch('Service Agreements', 'GET', url + (url ? '&' : '?') + 'pageSize=100&sort[0][field]=Agreement Date&sort[0][direction]=desc').then(function (data) {
    res.json((data.records || []).map(function (r) {
      var f = r.fields || {};
      return { id: r.id, clientName: f['Client Name'], ndisNumber: f['NDIS Number'],
        agreementDate: f['Agreement Date'], startDate: f['Start Date'], endDate: f['End Date'],
        services: f['Services'], termsVersion: f['Terms Version'], status: f['Status'],
        createdBy: f['Created By'], createdDate: f['Created Date'], notes: f['Notes'] };
    }));
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});

// Get single agreement
router.get('/agreements/:id', function (req, res) {
  airtable.rawFetch('Service Agreements', 'GET', '/' + req.params.id).then(function (rec) {
    var f = rec.fields || {};
    res.json({ id: rec.id, clientName: f['Client Name'], ndisNumber: f['NDIS Number'],
      agreementDate: f['Agreement Date'], startDate: f['Start Date'], endDate: f['End Date'],
      services: f['Services'], termsVersion: f['Terms Version'], status: f['Status'],
      createdBy: f['Created By'], createdDate: f['Created Date'], notes: f['Notes'] });
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});

// Create agreement
router.post('/agreements', function (req, res) {
  var fields = {
    'Client Name': req.body.clientName || '',
    'NDIS Number': req.body.ndisNumber || '',
    'Agreement Date': req.body.agreementDate || new Date().toISOString().split('T')[0],
    'Start Date': req.body.startDate || '',
    'End Date': req.body.endDate || '',
    'Services': typeof req.body.services === 'string' ? req.body.services : JSON.stringify(req.body.services || []),
    'Terms Version': req.body.termsVersion || '1.0',
    'Status': req.body.status || 'Draft',
    'Created By': req.user.name || req.user.email,
    'Created Date': new Date().toISOString().split('T')[0],
    'Notes': req.body.notes || ''
  };
  airtable.rawFetch('Service Agreements', 'POST', '', { records: [{ fields: fields }] }).then(function (data) {
    var created = (data.records && data.records[0]) ? data.records[0] : {};
    res.json({ success: true, id: created.id });
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});

// Update agreement
router.patch('/agreements/:id', function (req, res) {
  var fields = {};
  if (req.body.status) fields['Status'] = req.body.status;
  if (req.body.services) fields['Services'] = typeof req.body.services === 'string' ? req.body.services : JSON.stringify(req.body.services);
  if (req.body.startDate) fields['Start Date'] = req.body.startDate;
  if (req.body.endDate) fields['End Date'] = req.body.endDate;
  if (req.body.notes !== undefined) fields['Notes'] = req.body.notes;
  if (req.body.termsVersion) fields['Terms Version'] = req.body.termsVersion;
  airtable.rawFetch('Service Agreements', 'PATCH', '', { records: [{ id: req.params.id, fields: fields }] }).then(function () {
    res.json({ success: true });
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});

// Generate Agreement PDF
router.get('/agreements/:id/pdf', function (req, res) {
  airtable.rawFetch('Service Agreements', 'GET', '/' + req.params.id).then(function (rec) {
    var f = rec.fields || {};
    var services = [];
    try { services = JSON.parse(f['Services'] || '[]'); } catch (e) { services = []; }
    var doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=Agreement-' + (f['Client Name'] || '').replace(/\s/g, '-') + '.pdf');
    doc.pipe(res);
    // Cover page
    doc.fontSize(24).font('Helvetica-Bold').text('SERVICE AGREEMENT', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).font('Helvetica').text('Delta Community Support Pty Ltd', { align: 'center' });
    doc.text('ABN: 62 674 549 054', { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(12).font('Helvetica-Bold').text('Participant: ' + (f['Client Name'] || ''));
    doc.font('Helvetica').text('NDIS Number: ' + (f['NDIS Number'] || ''));
    doc.text('Agreement Date: ' + (f['Agreement Date'] || ''));
    doc.text('Start Date: ' + (f['Start Date'] || ''));
    doc.text('End Date: ' + (f['End Date'] || ''));
    doc.moveDown(1);
    // Services
    doc.font('Helvetica-Bold').fontSize(14).text('Services');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    if (services.length > 0) {
      services.forEach(function (svc, i) {
        doc.font('Helvetica-Bold').text((i + 1) + '. ' + (svc.name || svc.type || 'Service'));
        doc.font('Helvetica');
        if (svc.hoursPerWeek) doc.text('   Hours per week: ' + svc.hoursPerWeek);
        if (svc.rate) doc.text('   Rate: $' + svc.rate + '/hr');
        if (svc.startDate) doc.text('   Period: ' + svc.startDate + ' to ' + (svc.endDate || ''));
        doc.moveDown(0.3);
      });
    } else {
      doc.text('Services to be detailed in Schedule of Supports.');
    }
    doc.moveDown(1);
    // Terms
    doc.font('Helvetica-Bold').fontSize(14).text('Terms & Conditions');
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica');
    doc.text('1. Cancellation Policy: 48 hours notice is required for cancellation of scheduled supports. Short notice cancellations may be charged at full rate as per NDIS guidelines.');
    doc.moveDown(0.3);
    doc.text('2. Privacy & Consent: Delta Community Support will collect, use and disclose personal information in accordance with the Privacy Act 1988 and NDIS Practice Standards.');
    doc.moveDown(0.3);
    doc.text('3. Complaints & Feedback: Participants may raise complaints through DCS\'s internal complaints process or contact the NDIS Quality and Safeguards Commission.');
    doc.moveDown(0.3);
    doc.text('4. Service Agreement Review: This agreement will be reviewed annually or upon request by either party.');
    doc.moveDown(2);
    // Signatures
    doc.font('Helvetica-Bold').fontSize(12).text('Signatures');
    doc.moveDown(1);
    doc.fontSize(10);
    doc.text('Participant / Nominee: ________________________     Date: ____________');
    doc.moveDown(1);
    doc.text('Provider Representative: ________________________     Date: ____________');
    doc.moveDown(1);
    doc.fontSize(8).font('Helvetica').text('Delta Community Support Pty Ltd | ABN: 62 674 549 054 | Phone: 1300 123 456 | Email: info@deltacommunity.com.au', { align: 'center' });
    doc.end();
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});


// ═══════════════════════════════════════════════════════════
//  SCHEDULE OF SUPPORTS (SOS)
// ═══════════════════════════════════════════════════════════

// Create SOS items
router.post('/sos', function (req, res) {
  var items = req.body.items || [];
  if (items.length === 0) return res.status(400).json({ error: 'items required' });
  var records = items.map(function (item) {
    return {
      fields: {
        'Client Name': req.body.clientName || '',
        'Support Category': item.category || '',
        'Support Item': item.item || '',
        'Unit Price': parseFloat(item.unitPrice || 0),
        'Quantity Per Week': parseFloat(item.qtyPerWeek || 0),
        'Weekly Total': parseFloat(item.unitPrice || 0) * parseFloat(item.qtyPerWeek || 0),
        'Plan Total': parseFloat(item.unitPrice || 0) * parseFloat(item.qtyPerWeek || 0) * (parseFloat(req.body.planWeeks) || 52),
        'Plan Budget': parseFloat(item.planBudget || 0),
        'Remaining Budget': parseFloat(item.planBudget || 0) - (parseFloat(item.unitPrice || 0) * parseFloat(item.qtyPerWeek || 0) * (parseFloat(req.body.planWeeks) || 52))
      }
    };
  });
  var batches = [];
  for (var i = 0; i < records.length; i += 10) batches.push(records.slice(i, i + 10));
  Promise.all(batches.map(function (b) { return airtable.rawFetch('Schedule of Supports', 'POST', '', { records: b }); })).then(function () {
    res.json({ success: true, itemCount: items.length });
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});

// SOS PDF
router.get('/sos/:clientName/pdf', function (req, res) {
  var clientName = decodeURIComponent(req.params.clientName);
  var filter = encodeURIComponent("{Client Name}='" + clientName.replace(/'/g, "\\'") + "'");
  airtable.rawFetch('Schedule of Supports', 'GET', '?filterByFormula=' + filter).then(function (data) {
    var records = data.records || [];
    var doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=SOS-' + clientName.replace(/\s/g, '-') + '.pdf');
    doc.pipe(res);
    doc.fontSize(20).font('Helvetica-Bold').text('SCHEDULE OF SUPPORTS', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(12).font('Helvetica').text('Participant: ' + clientName, { align: 'center' });
    doc.moveDown(1);
    // Table header
    var y = doc.y;
    var cols = [50, 180, 310, 370, 430, 490];
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('Support Item', cols[0], y); doc.text('Category', cols[1], y);
    doc.text('Unit $', cols[2], y); doc.text('Qty/Wk', cols[3], y);
    doc.text('Wk Total', cols[4], y); doc.text('Plan Total', cols[5], y);
    y += 14;
    doc.moveTo(50, y).lineTo(545, y).stroke(); y += 4;
    doc.font('Helvetica').fontSize(8);
    var grandTotal = 0;
    records.forEach(function (r) {
      var f = r.fields || {};
      if (y > 720) { doc.addPage(); y = 50; }
      doc.text((f['Support Item'] || '').substring(0, 30), cols[0], y);
      doc.text((f['Support Category'] || '').substring(0, 20), cols[1], y);
      doc.text('$' + (parseFloat(f['Unit Price'] || 0)).toFixed(2), cols[2], y);
      doc.text(String(f['Quantity Per Week'] || 0), cols[3], y);
      var wkTotal = parseFloat(f['Weekly Total'] || 0);
      doc.text('$' + wkTotal.toFixed(2), cols[4], y);
      var plTotal = parseFloat(f['Plan Total'] || 0);
      grandTotal += plTotal;
      doc.text('$' + plTotal.toFixed(2), cols[5], y);
      y += 14;
    });
    y += 8;
    doc.moveTo(430, y).lineTo(545, y).stroke(); y += 6;
    doc.font('Helvetica-Bold').text('TOTAL:', 430, y); doc.text('$' + grandTotal.toFixed(2), 490, y);
    doc.end();
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});


// ═══════════════════════════════════════════════════════════
//  CV SUMMARY (AI)
// ═══════════════════════════════════════════════════════════

router.post('/cv-summary', function (req, res) {
  try {
    var cvUrl = req.body.cvUrl || '';
    var contactName = req.body.contactName || 'this person';
    var fileName = req.body.fileName || '';
    if (!cvUrl) return res.status(400).json({ error: 'No CV URL provided' });
    if (!env.anthropic.apiKey) return res.status(500).json({ error: 'Anthropic API key not configured' });

    var https = require('https');
    var http = require('http');

    // Step 1: Fetch the file from Airtable URL
    function fetchFile(url, cb) {
      var mod = url.startsWith('https') ? https : http;
      mod.get(url, function (response) {
        // Follow redirects (Airtable uses redirects)
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          return fetchFile(response.headers.location, cb);
        }
        var chunks = [];
        response.on('data', function (c) { chunks.push(c); });
        response.on('end', function () { cb(null, Buffer.concat(chunks), response.headers['content-type'] || ''); });
        response.on('error', function (e) { cb(e); });
      }).on('error', function (e) { cb(e); });
    }

    fetchFile(cvUrl, function (err, fileBuffer, contentType) {
      if (err) return res.status(502).json({ error: 'Failed to fetch CV: ' + err.message });
      if (!fileBuffer || fileBuffer.length === 0) return res.status(400).json({ error: 'Empty file' });

      var isPDF = contentType.indexOf('pdf') >= 0 || fileName.toLowerCase().endsWith('.pdf');
      var isWord = contentType.indexOf('word') >= 0 || contentType.indexOf('openxml') >= 0 ||
                   fileName.toLowerCase().endsWith('.docx') || fileName.toLowerCase().endsWith('.doc');

      var base64Data = fileBuffer.toString('base64');

      var summaryPrompt = 'Analyse this CV/resume for ' + contactName + ' and provide a structured summary. Focus on:\n\n' +
        '1. **Support Worker / Youth Worker Experience**: List any disability support, aged care, youth work, community services, or NDIS-related roles with approximate timeframes\n' +
        '2. **Qualifications & Certifications**: List relevant qualifications (e.g. Cert III/IV Individual Support, First Aid, CPR, WWCC, drivers licence, manual handling, medication management)\n' +
        '3. **Other Work Experience**: Brief summary of other employment history\n' +
        '4. **Key Skills**: Relevant skills mentioned (e.g. personal care, behaviour support, medication administration, transport, meal preparation, community access)\n' +
        '5. **Overall Assessment**: 2-3 sentence assessment of suitability for a Disability Support Worker role at an NDIS provider\n\n' +
        'Format your response in clear sections with the headings above. Be concise and factual. If a section has no relevant information, say "Not specified in CV".';

      // Build API request body
      var apiBody;
      if (isPDF) {
        // Use Claude's native PDF support
        apiBody = {
          model: 'claude-sonnet-4-5',
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } },
              { type: 'text', text: summaryPrompt }
            ]
          }]
        };
      } else {
        // For Word docs or unknown types, try to extract readable text from buffer
        var textContent = '';
        try {
          textContent = fileBuffer.toString('utf8');
          // Clean up binary garbage from Word docs — extract just readable text
          textContent = textContent.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s{3,}/g, ' ').trim();
        } catch (e) { textContent = ''; }

        if (textContent.length < 50) {
          return res.status(400).json({ error: 'Could not extract text from this file format. Please upload a PDF version.' });
        }

        apiBody = {
          model: 'claude-sonnet-4-5',
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: summaryPrompt + '\n\nCV Text:\n' + textContent.substring(0, 8000)
          }]
        };
      }

      var body = JSON.stringify(apiBody);
      var opts = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.anthropic.apiKey,
          'anthropic-version': '2023-06-01'
        }
      };

      var apiReq = https.request(opts, function (apiRes) {
        var data = '';
        apiRes.on('data', function (c) { data += c; });
        apiRes.on('end', function () {
          try {
            var j = JSON.parse(data);
            if (j.error) return res.status(502).json({ error: 'AI API error: ' + (j.error.message || JSON.stringify(j.error)) });
            var content = '';
            if (j.content && j.content.length > 0) content = j.content[0].text || '';
            console.log('CV Summary generated for: ' + contactName + ' (' + content.length + ' chars)');
            res.json({ summary: content });
          } catch (e) {
            console.error('CV summary parse error:', e.message);
            res.status(500).json({ error: 'Failed to parse AI response' });
          }
        });
      });
      apiReq.on('error', function (e) {
        console.error('CV summary request error:', e.message);
        res.status(502).json({ error: 'AI request failed: ' + e.message });
      });
      apiReq.write(body);
      apiReq.end();
    });
  } catch (err) {
    console.error('CV summary unexpected error:', err.message);
    res.status(500).json({ error: 'CV summary failed: ' + err.message });
  }
});


module.exports = router;
