var express = require('express');
var { authenticate } = require('../../middleware/auth');
var airtable = require('../../services/airtable');

var router = express.Router();

router.use(authenticate);

// ─── Helpers ─────────────────────────────────────────────
function av(v) { return Array.isArray(v) ? v[0] || '' : v || ''; }

function getAttachments(f, key) {
  var v = f[key];
  if (!Array.isArray(v)) return [];
  return v.filter(function(a) { return a && (a.url || a.filename); }).map(function(a) {
    return {
      url: a.url || '',
      thumbnailUrl: (a.thumbnails && a.thumbnails.large ? a.thumbnails.large.url : a.url) || '',
      name: a.filename || 'File',
      size: a.size || 0,
      type: a.type || ''
    };
  });
}

function resolveLinked(v, clientLookup) {
  if (!v) return '';
  if (Array.isArray(v)) return v.map(function(id) { return clientLookup[id] || id; }).join(', ');
  return clientLookup[v] || v;
}

// Build lookup of record IDs to client names (from Clients + All Contacts tables)
function buildClientLookup() {
  var clientLookup = {};
  return airtable.fetchAllFromTable('Clients').then(function(clients) {
    (clients || []).forEach(function(c) {
      var f = c.fields || {};
      var name = av(f['Client Name']) || av(f['Full Name']) || av(f['Name']) || '';
      if (!name && f['First Name']) name = ((f['First Name'] || '') + ' ' + (f['Last Name'] || '')).trim();
      if (name) clientLookup[c.id] = name;
    });
    return airtable.fetchAllFromTable('All Contacts');
  }).then(function(contacts) {
    (contacts || []).forEach(function(c) {
      if (clientLookup[c.id]) return;
      var f = c.fields || {};
      var name = av(f['Full Name']) || av(f['Client Name']) || av(f['Name']) || '';
      if (!name && f['First Name']) name = ((f['First Name'] || '') + ' ' + (f['Last Name'] || '')).trim();
      if (name) clientLookup[c.id] = name;
    });
    return clientLookup;
  });
}

// ─── GET /api/accommodation ──────────────────────────────
// Full accommodation listing with client lookup, photos and all field mappings
router.get('/', function(req, res) {
  buildClientLookup().then(function(clientLookup) {
    return airtable.fetchAllFromTableView('SIL Properties', 'Grid view').then(function(records) {
      if (records && records.length > 0) {
        console.log('SIL Properties fields:', Object.keys(records[0].fields || {}).sort().join(', '));
      }

      var result = (records || []).map(function(r) {
        var f = r.fields || {};
        // Collect ALL photos and attachments
        var photos = [];
        var attachments = [];
        Object.keys(f).forEach(function(k) {
          var v = f[k];
          if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && (v[0].url || v[0].filename)) {
            v.forEach(function(att) {
              var isImg = (att.type && att.type.indexOf('image') >= 0) || (att.filename && /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(att.filename));
              var item = {
                url: att.url || '',
                thumbnailUrl: (att.thumbnails && att.thumbnails.large ? att.thumbnails.large.url : att.url) || '',
                name: att.filename || 'File',
                size: att.size || 0,
                type: att.type || '',
                field: k
              };
              if (isImg) photos.push(item);
              else attachments.push(item);
            });
          }
        });

        // Gallery photos specifically
        var galleryPhotos = getAttachments(f, 'Property Photo Gallery');
        if (galleryPhotos.length === 0) galleryPhotos = photos;

        return {
          airtableId: r.id,
          name: f['Name'] || '',
          suburb: f['Suburb'] || '',
          address: f['Address'] || '',
          status: f['Active or Inactive?'] || '',
          description: f['Description'] || '',
          silNum: f['SIL #'] || '',
          weeklyRent: f['Weekly Rent Amount'] || '',
          propertyType: f['Type of Property'] || '',
          totalRooms: f['Total # of rooms'] || '',
          vacancies: f['# of Vacancies'] || '',
          hasVacancy: f['Vacancy?'] || '',
          typeOfAccom: f['Type of Accom'] || '',
          bathrooms: f['# of Bathrooms'] || f['# of bathroom'] || '',
          notes: f['Notes'] || '',
          clients: resolveLinked(f['Linked Clients'] || f['Client Name (from Linked Clients)'] || '', clientLookup),
          clientNames: av(f['Client Name (from Linked Clients)'] || ''),
          houseLeader: av(f['Full Name (from House Leader Name)'] || ''),
          // Real Estate tab
          realEstateName: f['Real Estate Name'] || '',
          realEstatePhone: f['Real Estate Phone #'] || '',
          realEstateEmail: f['Real Estate Email'] || '',
          sdaProviderName: f['SDA Provider Name'] || '',
          sdaPhone: f['SDA Phone Number'] || '',
          sdaEmail: f['SDA Email Address'] || '',
          leaseStartDate: f['Lease Start Date'] || '',
          leaseEndDate: f['Lease End Date'] || '',
          // Property Docs tab
          leaseAgreement: getAttachments(f, 'Lease Agreement'),
          entryReport: getAttachments(f, 'Entry Report'),
          safeEnvDoc: getAttachments(f, 'Safe Environment Document'),
          fireDrill: getAttachments(f, 'Fire Drill'),
          conditionReport: f['Was a Condition Report completed for this property?'] || '',
          conditionReportBy: f['Completed by whom?'] || '',
          // Utilities tab
          electricityProvider: f['Electricity Provider Name'] || '',
          gasProvider: f['Gas Provider Name'] || '',
          internetProvider: f['Internet Provider Name'] || '',
          electricityConnected: f['Electricity connected?'] || '',
          gasConnected: f['Gas Connected?'] || '',
          internetConnected: f['Internet'] || '',
          // Repairs
          electricalRepairs: f['Electrical Repairs'] || '',
          plumbingRepairs: f['Plumbing Repairs'] || '',
          otherRepairs: f['Other Repairs'] || '',
          // Lawns
          lawns: f['Lawns Maintenance'] || '',
          lawnsEmail: f['Lawns Email'] || '',
          lawnsMobile: f['Lawns Mobile'] || '',
          // SIL Details
          silLandline: f['SIL Landline'] || '',
          silMobile: f['SIL Mobile (Formula)'] || f['SIL Mobile'] || '',
          silEmail: f['SIL Email'] || '',
          mobilePin: f['Mobile Phone Pin #'] || '',
          emailPassword: f['Email Password'] || '',
          laptopPassword: f['Laptop Password'] || '',
          wifiModem: f['WIFI Modem'] || '',
          wifiPassword: f['WIFI Password'] || '',
          printerMakeModel: f['Printer Make & Model'] || '',
          printerInkCartridge: f['Printer Ink Cartridge'] || '',
          lockboxDetails: f['Lockbox or Keypad Details'] || '',
          // SIL Onboarding
          intakeForm: f['Intake Form'] || '',
          riskAssessment: f['Individual Risk Assessment Form'] || '',
          clientConsent: f['Client Consent Form'] || '',
          emergencyPlan: f['Emergency Personal Plan'] || '',
          supportPlan: f['Support Plan'] || '',
          serviceAgreement: f['Service Agreement Completed'] || '',
          scheduleOfSupport: f['Schedule of Support Completed?'] || '',
          silAssetRegister: f['SIL Asset Register Completed?'] || '',
          wifiConnected: f['Wifi/Internet Connected?'] || '',
          roomingAgreement: f['Rooming Agreement Completed?'] || '',
          laptopEmailMobile: f['Laptop, Email & Mobile setup?'] || f['Laptop\n Email & Mobile setup?'] || '',
          clientInfoCRM: f['Client info in Titus CRM'] || '',
          policiesProcedures: f['Policies & Procedures in the Staffroom'] || '',
          onboardingPct: f['Onboarding %'] || '',
          // Site Audit
          siteVisits: f['SIL Site Visits'] || [],
          genderSW: f['Gender of Support Workers'] || '',
          emergencyDrillDate: f['Emergency & Fire Drill Date'] || '',
          // Photos & files
          photos: photos,
          galleryPhotos: galleryPhotos,
          attachments: attachments,
          allFields: f
        };
      });
      console.log('Accommodation: Found ' + result.length + ' properties');
      res.json(result);
    });
  }).catch(function(e) {
    console.error('Accommodation error:', e.message);
    res.json([]);
  });
});

// ─── GET /api/accommodation/properties ───────────────────
// Lightweight property list using paginated listRecords
router.get('/properties', async function(req, res, next) {
  try {
    var records = await airtable.listRecords(airtable.TABLES.SIL_PROPERTIES);
    res.json({ properties: records.map(function(r) { return { id: r.id, ...r.fields }; }) });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/accommodation/properties/:id ───────────────
// Single property detail
router.get('/properties/:id', async function(req, res, next) {
  try {
    var record = await airtable.getRecord(airtable.TABLES.SIL_PROPERTIES, req.params.id);
    res.json({ property: { id: record.id, ...record.fields } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
