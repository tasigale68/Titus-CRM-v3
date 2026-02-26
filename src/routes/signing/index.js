// Titus CRM — Digital Signing Routes (SaaS multi-tenant)
// Service agreement + SOS signing = CORE (no module gate)
// Employment contract signing requires 'employment_signing' add-on module

var express = require('express');
var crypto = require('crypto');
var router = express.Router();

var sb = require('../../services/supabaseClient');
var { authenticate, requireRole } = require('../../middleware/auth');
var { tenantFromSession, scopeQuery } = require('../../middleware/tenant');
var { requireModule, hasModule } = require('../../middleware/modules');

// ─── Authenticated routes ────────────────────────────────────────────────────

// GET /api/signing/documents — list signing documents for tenant
router.get('/documents',
  authenticate, tenantFromSession,
  function(req, res) {
    var tid = req.tenant.id;
    var params = scopeQuery({ order: 'created_at.desc' }, tid);

    if (req.query.type) params.eq.document_type = req.query.type;
    if (req.query.status) params.eq.status = req.query.status;

    sb.query('signing_documents', 'GET', params).then(function(docs) {
      res.json({ documents: docs });
    }).catch(function(err) {
      console.error('[SIGNING] list error:', err.message);
      res.status(500).json({ error: 'Failed to load signing documents' });
    });
  }
);

// POST /api/signing/documents — create signing document
router.post('/documents',
  authenticate, tenantFromSession,
  function(req, res, next) {
    // Employment contracts require module; service_agreement and sos are CORE
    if (req.body.document_type === 'employment_contract') {
      return requireModule('employment_signing')(req, res, next);
    }
    next();
  },
  function(req, res) {
    var tid = req.tenant.id;
    var body = req.body;

    if (!body.document_type || !body.title) {
      return res.status(400).json({ error: 'document_type and title are required' });
    }

    var validTypes = ['service_agreement', 'sos', 'employment_contract'];
    if (validTypes.indexOf(body.document_type) < 0) {
      return res.status(400).json({ error: 'Invalid document_type. Must be: ' + validTypes.join(', ') });
    }

    if (!body.signatories || !Array.isArray(body.signatories) || !body.signatories.length) {
      return res.status(400).json({ error: 'At least one signatory is required' });
    }

    var doc = {
      tenant_id: tid,
      document_type: body.document_type,
      related_id: body.related_id || null,
      related_type: body.related_type || null,
      title: body.title,
      pdf_template_path: body.pdf_template_path || null,
      status: 'draft',
      created_by: req.user.user_id || req.user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    sb.insert('signing_documents', doc).then(function(rows) {
      var newDoc = rows[0];

      // Create signing requests for each signatory
      var requests = body.signatories.map(function(sig) {
        return {
          tenant_id: tid,
          document_id: newDoc.id,
          name: sig.name,
          email: sig.email || null,
          phone: sig.phone || null,
          role: sig.role || 'signatory',
          token: crypto.randomBytes(32).toString('hex'),
          status: 'pending',
          created_at: new Date().toISOString()
        };
      });

      return sb.insert('signing_requests', requests).then(function(sigRows) {
        newDoc.signing_requests = sigRows;
        res.status(201).json({ document: newDoc });
      });
    }).catch(function(err) {
      console.error('[SIGNING] create error:', err.message);
      res.status(500).json({ error: 'Failed to create signing document' });
    });
  }
);

// GET /api/signing/documents/:id — get document with signing requests
router.get('/documents/:id',
  authenticate, tenantFromSession,
  function(req, res) {
    var tid = req.tenant.id;

    sb.query('signing_documents', 'GET', scopeQuery({ eq: { id: req.params.id } }, tid)).then(function(docs) {
      if (!docs || !docs.length) return res.status(404).json({ error: 'Document not found' });
      var doc = docs[0];

      return sb.query('signing_requests', 'GET', scopeQuery({ eq: { document_id: doc.id }, order: 'created_at.asc' }, tid)).then(function(requests) {
        doc.signing_requests = requests || [];
        res.json({ document: doc });
      });
    }).catch(function(err) {
      console.error('[SIGNING] get error:', err.message);
      res.status(500).json({ error: 'Failed to load signing document' });
    });
  }
);

// POST /api/signing/documents/:id/send — send signing requests
router.post('/documents/:id/send',
  authenticate, tenantFromSession,
  function(req, res) {
    var tid = req.tenant.id;

    sb.query('signing_documents', 'GET', scopeQuery({ eq: { id: req.params.id } }, tid)).then(function(docs) {
      if (!docs || !docs.length) return res.status(404).json({ error: 'Document not found' });
      var doc = docs[0];

      if (doc.status !== 'draft') {
        return res.status(400).json({ error: 'Document must be in draft status to send' });
      }

      // Get existing signing requests
      return sb.query('signing_requests', 'GET', scopeQuery({ eq: { document_id: doc.id } }, tid)).then(function(requests) {
        if (!requests || !requests.length) {
          return res.status(400).json({ error: 'No signatories found for this document' });
        }

        // Ensure each request has a token
        var updates = requests.map(function(req) {
          var token = req.token || crypto.randomBytes(32).toString('hex');
          return sb.update('signing_requests', { eq: { id: req.id, tenant_id: tid } }, {
            token: token,
            status: 'sent',
            sent_at: new Date().toISOString()
          });
        });

        return Promise.all(updates).then(function() {
          // Update document status
          return sb.update('signing_documents', { eq: { id: doc.id, tenant_id: tid } }, {
            status: 'sent',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }).then(function(updatedDocs) {
          res.json({ document: updatedDocs[0], message: 'Signing requests sent to ' + requests.length + ' signator(ies)' });
        });
      });
    }).catch(function(err) {
      console.error('[SIGNING] send error:', err.message);
      res.status(500).json({ error: 'Failed to send signing requests' });
    });
  }
);

// POST /api/signing/documents/:id/void — void document
router.post('/documents/:id/void',
  authenticate, tenantFromSession,
  function(req, res) {
    var tid = req.tenant.id;

    sb.query('signing_documents', 'GET', scopeQuery({ eq: { id: req.params.id } }, tid)).then(function(docs) {
      if (!docs || !docs.length) return res.status(404).json({ error: 'Document not found' });
      var doc = docs[0];

      if (doc.status === 'voided') {
        return res.status(400).json({ error: 'Document is already voided' });
      }

      return sb.update('signing_documents', { eq: { id: doc.id, tenant_id: tid } }, {
        status: 'voided',
        voided_at: new Date().toISOString(),
        voided_by: req.user.user_id || req.user.id,
        updated_at: new Date().toISOString()
      }).then(function(updatedDocs) {
        res.json({ document: updatedDocs[0], message: 'Document voided' });
      });
    }).catch(function(err) {
      console.error('[SIGNING] void error:', err.message);
      res.status(500).json({ error: 'Failed to void document' });
    });
  }
);

// POST /api/signing/documents/:id/remind — resend reminder to unsigned signatories
router.post('/documents/:id/remind',
  authenticate, tenantFromSession,
  function(req, res) {
    var tid = req.tenant.id;

    sb.query('signing_documents', 'GET', scopeQuery({ eq: { id: req.params.id } }, tid)).then(function(docs) {
      if (!docs || !docs.length) return res.status(404).json({ error: 'Document not found' });
      var doc = docs[0];

      if (doc.status !== 'sent') {
        return res.status(400).json({ error: 'Can only send reminders for documents with status "sent"' });
      }

      // Get unsigned signing requests
      return sb.query('signing_requests', 'GET', scopeQuery({
        eq: { document_id: doc.id, status: 'sent' },
        order: 'created_at.asc'
      }, tid)).then(function(requests) {
        var unsigned = requests.filter(function(r) { return r.status !== 'signed'; });

        if (!unsigned.length) {
          return res.json({ message: 'All signatories have already signed' });
        }

        // Update reminded_at for unsigned requests
        var updates = unsigned.map(function(r) {
          return sb.update('signing_requests', { eq: { id: r.id, tenant_id: tid } }, {
            reminded_at: new Date().toISOString()
          });
        });

        return Promise.all(updates).then(function() {
          res.json({
            message: 'Reminder sent to ' + unsigned.length + ' unsigned signator(ies)',
            unsigned_count: unsigned.length
          });
        });
      });
    }).catch(function(err) {
      console.error('[SIGNING] remind error:', err.message);
      res.status(500).json({ error: 'Failed to send reminders' });
    });
  }
);

// GET /api/signing/stats — counts by status for tenant
router.get('/stats',
  authenticate, tenantFromSession,
  function(req, res) {
    var tid = req.tenant.id;

    sb.query('signing_documents', 'GET', scopeQuery({}, tid)).then(function(docs) {
      var stats = { draft: 0, sent: 0, signed: 0, voided: 0, expired: 0, total: docs.length };
      docs.forEach(function(d) {
        if (stats.hasOwnProperty(d.status)) {
          stats[d.status]++;
        }
      });
      res.json({ stats: stats });
    }).catch(function(err) {
      console.error('[SIGNING] stats error:', err.message);
      res.status(500).json({ error: 'Failed to load signing stats' });
    });
  }
);

// ─── Public signing routes (no auth) ────────────────────────────────────────

// GET /api/sign/:token — validate token, return document info
router.get('/public/:token', function(req, res) {
  var token = req.params.token;

  sb.query('signing_requests', 'GET', { eq: { token: token }, limit: 1 }).then(function(requests) {
    if (!requests || !requests.length) return res.status(404).json({ error: 'Invalid or expired signing link' });
    var sigReq = requests[0];

    if (sigReq.status === 'signed') {
      return res.status(400).json({ error: 'This document has already been signed' });
    }

    return sb.query('signing_documents', 'GET', {
      eq: { id: sigReq.document_id, tenant_id: sigReq.tenant_id },
      limit: 1
    }).then(function(docs) {
      if (!docs || !docs.length) return res.status(404).json({ error: 'Document not found' });
      var doc = docs[0];

      if (doc.status === 'voided') {
        return res.status(400).json({ error: 'This document has been voided' });
      }

      res.json({
        document: {
          id: doc.id,
          title: doc.title,
          document_type: doc.document_type,
          pdf_template_path: doc.pdf_template_path
        },
        signatory: {
          name: sigReq.name,
          email: sigReq.email,
          role: sigReq.role
        }
      });
    });
  }).catch(function(err) {
    console.error('[SIGNING] public get error:', err.message);
    res.status(500).json({ error: 'Failed to load signing document' });
  });
});

// POST /api/sign/:token — submit signature
router.post('/public/:token', function(req, res) {
  var token = req.params.token;
  var body = req.body;

  if (!body.full_name || !body.signature_data) {
    return res.status(400).json({ error: 'full_name and signature_data are required' });
  }

  sb.query('signing_requests', 'GET', { eq: { token: token }, limit: 1 }).then(function(requests) {
    if (!requests || !requests.length) return res.status(404).json({ error: 'Invalid or expired signing link' });
    var sigReq = requests[0];

    if (sigReq.status === 'signed') {
      return res.status(400).json({ error: 'This document has already been signed by this signatory' });
    }

    // Check document is still valid
    return sb.query('signing_documents', 'GET', {
      eq: { id: sigReq.document_id, tenant_id: sigReq.tenant_id },
      limit: 1
    }).then(function(docs) {
      if (!docs || !docs.length) return res.status(404).json({ error: 'Document not found' });
      var doc = docs[0];

      if (doc.status === 'voided') {
        return res.status(400).json({ error: 'This document has been voided' });
      }

      // Record signature
      var now = new Date().toISOString();
      return sb.update('signing_requests', { eq: { id: sigReq.id, tenant_id: sigReq.tenant_id } }, {
        status: 'signed',
        signed_name: body.full_name,
        signature_data: body.signature_data,
        signed_at: now,
        signed_ip: req.ip,
        signed_device: req.headers['user-agent'] || 'unknown'
      }).then(function() {
        // Check if all signatories have signed
        return sb.query('signing_requests', 'GET', {
          eq: { document_id: doc.id, tenant_id: sigReq.tenant_id }
        });
      }).then(function(allRequests) {
        var allSigned = allRequests.every(function(r) { return r.status === 'signed' || r.id === sigReq.id; });

        if (allSigned) {
          // Update document status to signed
          return sb.update('signing_documents', { eq: { id: doc.id, tenant_id: sigReq.tenant_id } }, {
            status: 'signed',
            completed_at: now,
            updated_at: now
          }).then(function() {
            res.json({ message: 'Signature recorded. All signatories have signed — document is complete.', document_complete: true });
          });
        } else {
          res.json({ message: 'Signature recorded successfully.', document_complete: false });
        }
      });
    });
  }).catch(function(err) {
    console.error('[SIGNING] public sign error:', err.message);
    res.status(500).json({ error: 'Failed to record signature' });
  });
});

module.exports = router;
