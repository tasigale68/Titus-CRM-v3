var express = require('express');
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var { authenticate } = require('../../middleware/auth');
var airtable = require('../../services/database');
var env = require('../../config/env');
var { uploadsDir } = require('../../config/upload');

var router = express.Router();

// ═══════════════════════════════════════════════════════════
//  Receipt form HTML (inline fallback)
// ═══════════════════════════════════════════════════════════

var RECEIPT_FORM_HTML = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="default">\n<meta name="apple-mobile-web-app-title" content="DCS Receipts">\n<title>Receipt Scanner — Delta Community Support</title>\n<style>\n  *{box-sizing:border-box;margin:0;padding:0;}\n  body{font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;background:#fafafa;min-height:100vh;color:#1f2937;}\n  .header{background:linear-gradient(135deg,#78350f,#d97706);padding:20px 20px 24px;text-align:center;}\n  .header h1{font-size:22px;font-weight:800;color:#fff;margin-bottom:4px;}\n  .header p{font-size:13px;color:rgba(255,255,255,.7);}\n  .logo{width:44px;height:44px;background:rgba(255,255,255,.2);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;margin:0 auto 10px;}\n  .card{background:#fff;border-radius:16px;padding:20px;margin:12px 16px;box-shadow:0 2px 12px rgba(0,0,0,.06);border:1px solid #e5e7eb;}\n  .scan-zone{background:linear-gradient(135deg,#fef3c7,#fffbeb);border:2px dashed #d97706;border-radius:14px;padding:20px;text-align:center;cursor:pointer;position:relative;transition:all .2s;}\n  .scan-zone.scanning{border-color:#7c3aed;background:linear-gradient(135deg,#f5f3ff,#ede9fe);}\n  .scan-zone.done{border-color:#059669;background:linear-gradient(135deg,#ecfdf5,#d1fae5);}\n  .scan-zone:active{transform:scale(.98);}\n  .scan-icon{font-size:36px;margin-bottom:8px;transition:all .3s;}\n  .scan-zone h3{font-size:15px;font-weight:700;color:#78350f;margin-bottom:3px;}\n  .scan-zone.scanning h3{color:#7c3aed;}\n  .scan-zone.done h3{color:#059669;}\n  .scan-zone p{font-size:11px;color:#92400e;}\n  .preview-img{max-width:100%;max-height:160px;border-radius:10px;margin:10px auto 0;display:block;object-fit:contain;border:1px solid #e5e7eb;}\n  .ai-badge{display:inline-flex;align-items:center;gap:5px;background:#f5f3ff;color:#7c3aed;font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;border:1px solid #ede9fe;margin-top:8px;}\n  .file-types{font-size:10px;color:#92400e;margin-top:6px;opacity:.8;}\n  label.field-label{display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:5px;}\n  input,select,textarea{width:100%;padding:11px 13px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:15px;font-family:inherit;outline:none;color:#1f2937;background:#fff;transition:border-color .15s;-webkit-appearance:none;appearance:none;}\n  input:focus,select:focus,textarea:focus{border-color:#d97706;box-shadow:0 0 0 3px rgba(217,119,6,.08);}\n  .field{margin-bottom:14px;}\n  .row2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}\n  .row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}\n  .cat-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;}\n  .cat-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;cursor:pointer;transition:all .15s;font-size:12px;font-weight:500;user-select:none;}\n  .cat-item input[type=checkbox]{width:16px;min-width:16px;height:16px;padding:0;margin:0;cursor:pointer;accent-color:#d97706;}\n  .cat-item.selected{border-color:#d97706;background:#fffbeb;color:#78350f;font-weight:700;}\n  .btn-primary{width:100%;padding:16px;background:linear-gradient(135deg,#d97706,#b45309);color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;letter-spacing:.02em;box-shadow:0 4px 12px rgba(217,119,6,.3);}\n  .btn-primary:active{transform:scale(.98);}\n  .btn-primary:disabled{opacity:.6;cursor:not-allowed;transform:none;}\n  .status{padding:12px 14px;border-radius:10px;font-size:13px;font-weight:600;text-align:center;margin:8px 0;line-height:1.4;}\n  .status.scanning{background:#f5f3ff;color:#7c3aed;border:1px solid #ede9fe;}\n  .status.success{background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;}\n  .status.error{background:#fef2f2;color:#dc2626;border:1px solid #fecaca;}\n  .status.warning{background:#fffbeb;color:#d97706;border:1px solid #fde68a;}\n  .section-title{font-size:14px;font-weight:700;color:#374151;margin-bottom:12px;display:flex;align-items:center;gap:8px;}\n  .spinner{width:18px;height:18px;border:2.5px solid rgba(124,58,237,.2);border-top-color:#7c3aed;border-radius:50%;animation:spin .8s linear infinite;display:inline-block;vertical-align:middle;margin-right:6px;}\n  @keyframes spin{to{transform:rotate(360deg)}}\n  .retry-btn{display:none;width:100%;margin-top:8px;padding:9px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;}\n  .submitted-overlay{display:none;position:fixed;inset:0;background:linear-gradient(135deg,#78350f,#d97706);z-index:100;align-items:center;justify-content:center;flex-direction:column;text-align:center;padding:40px;}\n  .submitted-overlay.show{display:flex;}\n  .submitted-overlay .big-check{font-size:80px;margin-bottom:20px;animation:pop .4s ease;}\n  .submitted-overlay h2{font-size:28px;font-weight:800;color:#fff;margin-bottom:8px;}\n  .submitted-overlay p{font-size:15px;color:rgba(255,255,255,.8);max-width:280px;margin:0 auto 24px;}\n  .submitted-overlay button{padding:14px 32px;background:#fff;color:#d97706;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;}\n  @keyframes pop{0%{transform:scale(.5);opacity:0}70%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}\n  select option{font-size:15px;}\n</style>\n</head>\n<body>\n\n<div class="submitted-overlay" id="successOverlay">\n  <div class="big-check">&#x2705;</div>\n  <h2>Receipt Saved!</h2>\n  <p>Your receipt has been uploaded and saved to the register.</p>\n  <button onclick="resetForm()">Add Another Receipt</button>\n</div>\n\n<div class="header">\n  <div class="logo">&#x1F9FE;</div>\n  <h1>Receipt Scanner</h1>\n  <p>Delta Community Support</p>\n</div>\n\n<!-- AI Scan Card -->\n<div class="card">\n  <div class="section-title">&#x1F916; AI Receipt Scanner</div>\n  <div class="scan-zone" id="scanZone" onclick="document.getElementById(\'photoInput\').click()">\n    <div class="scan-icon" id="scanIcon">&#x1F4F7;</div>\n    <h3 id="scanTitle">Take Photo or Upload File</h3>\n    <p id="scanSubtitle">AI extracts all fields automatically</p>\n    <div class="ai-badge">&#x2728; Powered by Claude AI</div>\n    <div class="file-types">Supports: JPG &middot; PNG &middot; PDF &middot; Word (.docx) &middot; Any image</div>\n  </div>\n  <input type="file" id="photoInput" accept="image/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style="display:none" onchange="handleFileUpload(this)">\n  <img id="photoPreview" class="preview-img" style="display:none" alt="Receipt preview">\n  <div id="scanStatus" style="margin-top:8px"></div>\n  <button class="retry-btn" id="retryBtn" onclick="retryLastScan()">&#x1F504; Retry AI Scan</button>\n</div>\n\n<!-- Receipt Details -->\n<div class="card">\n  <div class="section-title">&#x1F4CB; Receipt Details</div>\n  <div class="field">\n    <label class="field-label">Supplier / Vendor Name *</label>\n    <input type="text" id="f_supplier" placeholder="e.g. Woolworths, Officeworks, Google..." autocomplete="off" autocorrect="off">\n  </div>\n  <div class="row2 field">\n    <div>\n      <label class="field-label">Purchase Date *</label>\n      <input type="date" id="f_date">\n    </div>\n    <div>\n      <label class="field-label">Currency</label>\n      <select id="f_currency">\n        <option value="AUD">&#x1F1E6;&#x1F1FA; AUD</option>\n        <option value="USD">&#x1F1FA;&#x1F1F8; USD</option>\n        <option value="NZD">&#x1F1F3;&#x1F1FF; NZD</option>\n        <option value="EUR">&#x1F1EA;&#x1F1FA; EUR</option>\n        <option value="GBP">&#x1F1EC;&#x1F1E7; GBP</option>\n      </select>\n    </div>\n  </div>\n  <div class="row2 field">\n    <div>\n      <label class="field-label">Total Amount *</label>\n      <input type="text" id="f_amount" placeholder="e.g. 45.99" inputmode="decimal" autocomplete="off">\n    </div>\n    <div>\n      <label class="field-label">GST Amount</label>\n      <input type="text" id="f_gst" placeholder="e.g. 4.18" inputmode="decimal" autocomplete="off">\n    </div>\n  </div>\n  <div class="field">\n    <label class="field-label">Your Name / Email</label>\n    <input type="text" id="f_staff" placeholder="Your name or email address" autocomplete="name">\n  </div>\n  <div class="field">\n    <label class="field-label">Comments (optional)</label>\n    <textarea id="f_comments" rows="2" placeholder="Any extra notes about this purchase..."></textarea>\n  </div>\n</div>\n\n<!-- Purpose of Purchase -->\n<div class="card">\n  <div class="section-title">&#x1F3F7;&#xFE0F; Purpose of Purchase</div>\n  <div class="cat-grid" id="catGrid"></div>\n</div>\n\n<!-- Submit -->\n<div style="padding:0 16px 40px">\n  <button class="btn-primary" id="submitBtn" onclick="submitReceiptForm()">&#x1F4BE; Save Receipt</button>\n  <div id="submitStatus" style="margin-top:10px"></div>\n</div>\n\n<script>\nvar CATS = [\n  \'Airfares\',\'Attending Conference\',\'Car Rental\',\'Client Meeting\',\'Consultation\',\n  \'Marketing for business\',\'New Business Meeting\',\'New Business Workshop\',\n  \'Office Shopping\',\'SIL Maintenance & Lawns\',\'SIL Mobile Bill\',\'SIL Shopping\',\n  \'Software\',\'Staff Uniforms\',\'Website\',\'Other\'\n];\n\nvar _uploadedFile = null;\nvar _lastScanData = null;\n\n(function buildCats() {\n  var grid = document.getElementById(\'catGrid\');\n  CATS.forEach(function(c) {\n    var item = document.createElement(\'label\');\n    item.className = \'cat-item\';\n    item.dataset.cat = c;\n    var cb = document.createElement(\'input\');\n    cb.type = \'checkbox\';\n    cb.value = c;\n    cb.addEventListener(\'change\', function() {\n      item.classList.toggle(\'selected\', this.checked);\n    });\n    item.appendChild(cb);\n    item.appendChild(document.createTextNode(c));\n    grid.appendChild(item);\n  });\n})();\n\ndocument.getElementById(\'f_date\').value = new Date().toISOString().split(\'T\')[0];\n\nfunction handleFileUpload(input) {\n  if (!input.files || !input.files[0]) return;\n  var file = input.files[0];\n  var ext = file.name.split(\'.\').pop().toLowerCase();\n  var mime = file.type || \'\';\n  var isPDF = mime === \'application/pdf\' || ext === \'pdf\';\n  var isWord = ext === \'docx\' || ext === \'doc\' || mime === \'application/vnd.openxmlformats-officedocument.wordprocessingml.document\' || mime === \'application/msword\';\n  var isImage = mime.indexOf(\'image\') === 0;\n  if (isImage) {\n    var prev = document.getElementById(\'photoPreview\');\n    prev.src = URL.createObjectURL(file);\n    prev.style.display = \'block\';\n  }\n  setScanState(\'scanning\', \'&#x23F3; Reading file...\');\n  var reader = new FileReader();\n  reader.onload = function(e) {\n    var dataUrl = e.target.result;\n    var base64 = dataUrl.split(\',\')[1] || dataUrl;\n    var mimeType = isPDF ? \'application/pdf\' : isWord ? (ext === \'docx\' ? \'application/vnd.openxmlformats-officedocument.wordprocessingml.document\' : \'application/msword\') : (mime || \'image/jpeg\');\n    if (isImage) {\n      resizeImage(dataUrl, function(resizedBase64) {\n        _uploadedFile = { base64: resizedBase64, mimeType: mimeType, name: file.name };\n        _lastScanData = { base64: resizedBase64, mimeType: mimeType, name: file.name };\n        setScanState(\'scanning\', \'<span class="spinner"></span> Scanning with AI...\');\n        doAIScan(resizedBase64, mimeType, file.name);\n      });\n    } else {\n      _uploadedFile = { base64: base64, mimeType: mimeType, name: file.name };\n      _lastScanData = { base64: base64, mimeType: mimeType, name: file.name };\n      setScanState(\'scanning\', \'<span class="spinner"></span> Scanning \' + (isPDF ? \'PDF\' : \'Word document\') + \' with AI...\');\n      doAIScan(base64, mimeType, file.name);\n    }\n  };\n  reader.onerror = function() { setScanState(\'error\', \'&#x274C; Could not read file. Please try again.\'); };\n  reader.readAsDataURL(file);\n}\n\nfunction resizeImage(dataUrl, callback) {\n  var img = new Image();\n  img.onload = function() {\n    var MAX = 1400;\n    var w = img.naturalWidth, h = img.naturalHeight;\n    if (w > MAX || h > MAX) {\n      if (w > h) { h = Math.round(h * MAX / w); w = MAX; }\n      else { w = Math.round(w * MAX / h); h = MAX; }\n    }\n    var canvas = document.createElement(\'canvas\');\n    canvas.width = w; canvas.height = h;\n    canvas.getContext(\'2d\').drawImage(img, 0, 0, w, h);\n    var result = canvas.toDataURL(\'image/jpeg\', 0.82).split(\',\')[1];\n    URL.revokeObjectURL(img.src);\n    callback(result);\n  };\n  img.onerror = function() { callback(dataUrl.split(\',\')[1] || dataUrl); };\n  img.src = dataUrl;\n}\n\nfunction doAIScan(base64, mimeType, filename) {\n  fetch(window.location.origin + \'/api/receipts/scan\', {\n    method: \'POST\',\n    headers: { \'Content-Type\': \'application/json\' },\n    body: JSON.stringify({ base64: base64, mimeType: mimeType, filename: filename })\n  }).then(function(r) {\n    if (!r.ok) throw new Error(\'Server error \' + r.status);\n    return r.json();\n  }).then(function(d) {\n    if (d && d.error) { setScanState(\'warning\', \'&#x26A0;&#xFE0F; \' + d.error); return; }\n    if (d && d.supplierName) {\n      setVal(\'f_supplier\', d.supplierName);\n      setVal(\'f_date\', d.purchaseDate);\n      setVal(\'f_amount\', d.totalAmount ? String(d.totalAmount).replace(/[^0-9.]/g,\'\') : \'\');\n      setVal(\'f_gst\', d.gstAmount ? String(d.gstAmount).replace(/[^0-9.]/g,\'\') : \'\');\n      if (d.currency) document.getElementById(\'f_currency\').value = d.currency;\n      if (d.description) setVal(\'f_comments\', d.description);\n      if (d.categories && d.categories.length) {\n        document.querySelectorAll(\'#catGrid .cat-item input\').forEach(function(cb) {\n          var checked = d.categories.indexOf(cb.value) >= 0;\n          cb.checked = checked;\n          cb.closest(\'.cat-item\').classList.toggle(\'selected\', checked);\n        });\n      }\n      setScanState(\'done\', \'&#x2705; AI extracted receipt details \\u2014 review and save below\');\n    } else {\n      setScanState(\'warning\', \'&#x26A0;&#xFE0F; Could not auto-extract fields \\u2014 please fill in manually below\');\n    }\n  }).catch(function(err) {\n    console.error(\'Scan error:\', err);\n    setScanState(\'warning\', \'&#x26A0;&#xFE0F; AI scan unavailable \\u2014 fill in the fields below and tap Save. Your receipt will still be saved.\');\n  });\n}\n\nfunction retryLastScan() {\n  if (!_lastScanData) return;\n  document.getElementById(\'retryBtn\').style.display = \'none\';\n  setScanState(\'scanning\', \'<span class="spinner"></span> Retrying...\');\n  doAIScan(_lastScanData.base64, _lastScanData.mimeType, _lastScanData.name);\n}\n\nfunction setVal(id, val) { var el = document.getElementById(id); if (el && val) el.value = val; }\n\nfunction setScanState(state, msg) {\n  var zone = document.getElementById(\'scanZone\');\n  var icon = document.getElementById(\'scanIcon\');\n  var title = document.getElementById(\'scanTitle\');\n  var sub = document.getElementById(\'scanSubtitle\');\n  var statusEl = document.getElementById(\'scanStatus\');\n  var retryBtn = document.getElementById(\'retryBtn\');\n  zone.className = \'scan-zone \' + (state === \'scanning\' ? \'scanning\' : state === \'done\' ? \'done\' : \'\');\n  if (state === \'scanning\') { icon.textContent = \'&#x1F50D;\'; title.textContent = \'Scanning...\'; sub.textContent = \'AI is reading your receipt\'; }\n  else if (state === \'done\') { icon.textContent = \'&#x2705;\'; title.textContent = \'Scan Complete\'; sub.textContent = \'Fields filled below\'; }\n  else if (state === \'warning\') { icon.textContent = \'&#x26A0;&#xFE0F;\'; title.textContent = \'Scan Unavailable\'; sub.textContent = \'Fill in fields manually\'; }\n  else if (state === \'error\') { icon.textContent = \'&#x274C;\'; title.textContent = \'Error\'; sub.textContent = \'Try again\'; }\n  statusEl.innerHTML = msg ? \'<div class="status \' + state + \'">\' + msg + \'</div>\' : \'\';\n  retryBtn.style.display = (state === \'warning\' || state === \'error\') ? \'block\' : \'none\';\n}\n\nfunction submitReceiptForm() {\n  var supplier = (document.getElementById(\'f_supplier\').value || \'\').trim();\n  var amount = (document.getElementById(\'f_amount\').value || \'\').trim();\n  var date = document.getElementById(\'f_date\').value || \'\';\n  if (!supplier) { showSubmitError(\'Please enter the supplier name\'); return; }\n  if (!amount) { showSubmitError(\'Please enter the total amount\'); return; }\n  var btn = document.getElementById(\'submitBtn\');\n  btn.disabled = true;\n  btn.textContent = \'&#x23F3; Saving...\';\n  document.getElementById(\'submitStatus\').innerHTML = \'\';\n  var cats = [];\n  document.querySelectorAll(\'#catGrid .cat-item input:checked\').forEach(function(cb) { cats.push(cb.value); });\n  var cleanAmount = amount.replace(/[^0-9.]/g, \'\');\n  var cleanGST = (document.getElementById(\'f_gst\').value || \'\').replace(/[^0-9.]/g, \'\');\n  var payload = {\n    supplierName: supplier,\n    purchaseDate: date,\n    totalAmount: cleanAmount,\n    gstAmount: cleanGST || \'0\',\n    currency: document.getElementById(\'f_currency\').value || \'AUD\',\n    purpose: cats,\n    staffEmail: (document.getElementById(\'f_staff\').value || \'\').trim(),\n    comments: (document.getElementById(\'f_comments\').value || \'\').trim(),\n    fileData: _uploadedFile || null\n  };\n  fetch(window.location.origin + \'/api/receipts\', {\n    method: \'POST\',\n    headers: { \'Content-Type\': \'application/json\' },\n    body: JSON.stringify(payload)\n  }).then(function(r) {\n    if (!r.ok) throw new Error(\'Server error \' + r.status);\n    return r.json();\n  }).then(function(d) {\n    if (d && d.id) {\n      document.getElementById(\'successOverlay\').classList.add(\'show\');\n    } else {\n      btn.disabled = false;\n      btn.textContent = \'&#x1F4BE; Save Receipt\';\n      showSubmitError(d && d.error ? d.error : \'Failed to save \\u2014 please try again\');\n    }\n  }).catch(function(e) {\n    btn.disabled = false;\n    btn.textContent = \'&#x1F4BE; Save Receipt\';\n    showSubmitError(\'Connection error: \' + e.message);\n  });\n}\n\nfunction showSubmitError(msg) {\n  document.getElementById(\'submitStatus\').innerHTML = \'<div class="status error">&#x274C; \' + msg + \'</div>\';\n}\n\nfunction resetForm() {\n  document.getElementById(\'successOverlay\').classList.remove(\'show\');\n  document.getElementById(\'f_supplier\').value = \'\';\n  document.getElementById(\'f_date\').value = new Date().toISOString().split(\'T\')[0];\n  document.getElementById(\'f_amount\').value = \'\';\n  document.getElementById(\'f_gst\').value = \'\';\n  document.getElementById(\'f_currency\').value = \'AUD\';\n  document.getElementById(\'f_staff\').value = \'\';\n  document.getElementById(\'f_comments\').value = \'\';\n  document.getElementById(\'photoPreview\').style.display = \'none\';\n  document.getElementById(\'photoInput\').value = \'\';\n  document.getElementById(\'scanStatus\').innerHTML = \'\';\n  document.getElementById(\'retryBtn\').style.display = \'none\';\n  document.getElementById(\'submitStatus\').innerHTML = \'\';\n  document.getElementById(\'submitBtn\').disabled = false;\n  document.getElementById(\'submitBtn\').textContent = \'&#x1F4BE; Save Receipt\';\n  document.querySelectorAll(\'#catGrid .cat-item\').forEach(function(el) { el.classList.remove(\'selected\'); });\n  document.querySelectorAll(\'#catGrid input[type=checkbox]\').forEach(function(cb) { cb.checked = false; });\n  var zone = document.getElementById(\'scanZone\');\n  zone.className = \'scan-zone\';\n  document.getElementById(\'scanIcon\').textContent = \'&#x1F4F7;\';\n  document.getElementById(\'scanTitle\').textContent = \'Take Photo or Upload File\';\n  document.getElementById(\'scanSubtitle\').textContent = \'AI extracts all fields automatically\';\n  _uploadedFile = null;\n  _lastScanData = null;\n}\n</script>\n</body>\n</html>';

// ═══════════════════════════════════════════════════════════
//  Public routes (no auth required) — receipt form + AI scan
// ═══════════════════════════════════════════════════════════

// ─── Receipt form HTML pages ─────────────────────────────
router.get('/form', function (req, res) {
  var htmlPath = path.join(__dirname, '..', '..', '..', 'public', 'receipt-form.html');
  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.redirect('/api/receipts/form-inline');
  }
});

router.get('/form-inline', function (req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(RECEIPT_FORM_HTML);
});

// ─── CORS preflight for public routes ────────────────────
router.options('/scan', function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.sendStatus(200);
});

router.options('/', function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.sendStatus(200);
});

// ═══════════════════════════════════════════════════════════
//  AI Receipt Scan (public, no auth — used by mobile form)
// ═══════════════════════════════════════════════════════════

var EXTRACT_INSTRUCTION = 'You are a receipt/invoice scanner. Extract fields from the receipt. Return ONLY raw JSON (no markdown, no backticks):\n{"supplierName":"","purchaseDate":"","totalAmount":"","gstAmount":"","currency":"","categories":[],"description":""}\nRules: purchaseDate=YYYY-MM-DD ISO format. totalAmount include $ sign (e.g. "$45.99"). gstAmount include $ sign, "$0.00" if none. currency=AUD unless stated. categories: pick 1-3 from [Airfares,Attending Conference,Car Rental,Client Meeting,Consultation,Marketing for business,New Business Meeting,New Business Workshop,Office Shopping,SIL Maintenance & Lawns,SIL Mobile Bill,SIL Shopping,Software,Staff Uniforms,Website,Other]. Return ONLY the JSON object.';

function sendToClaudeVision(messageContent, headers, res) {
  fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 700,
      messages: [{ role: 'user', content: messageContent }]
    })
  }).then(function (r) {
    if (!r.ok) return r.text().then(function (t) { throw new Error('Anthropic ' + r.status + ': ' + t.substring(0, 120)); });
    return r.json();
  }).then(function (d) { parseClaudeReceiptResponse(d, res); })
  .catch(function (e) { console.error('Claude vision error:', e.message); res.json({ error: e.message }); });
}

function sendToClaudeText(messageContent, res) {
  fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': env.anthropic.apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 700,
      messages: [{ role: 'user', content: messageContent }]
    })
  }).then(function (r) {
    if (!r.ok) return r.text().then(function (t) { throw new Error('Anthropic ' + r.status + ': ' + t.substring(0, 120)); });
    return r.json();
  }).then(function (d) { parseClaudeReceiptResponse(d, res); })
  .catch(function (e) { console.error('Claude text error:', e.message); res.json({ error: e.message }); });
}

function parseClaudeReceiptResponse(d, res) {
  if (d.error) { console.error('Anthropic error:', JSON.stringify(d.error)); return res.json({ error: d.error.message || 'Anthropic API error' }); }
  var text = (d.content && d.content[0]) ? (d.content[0].text || '') : '';
  text = text.replace(/```json|```/g, '').trim();
  var jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) text = jsonMatch[0];
  try {
    var parsed = JSON.parse(text);
    console.log('Receipt scan success:', parsed.supplierName, parsed.totalAmount);
    res.json(parsed);
  } catch (e) {
    console.error('Receipt scan parse error:', e.message, '| Raw:', text.substring(0, 200));
    res.json({ error: 'AI could not extract fields — try a clearer photo or different file' });
  }
}

router.post('/scan', function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  var b = req.body || {};
  var base64Data = b.base64 || '';
  var mimeType = b.mimeType || 'image/jpeg';
  var filename = b.filename || 'receipt';

  if (!base64Data) return res.json({ error: 'No file data provided' });
  if (!env.anthropic.apiKey) return res.json({ error: 'AI not configured — ANTHROPIC_API_KEY missing in environment' });

  var isPDF = mimeType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf');
  var isWord = mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
               mimeType === 'application/msword' ||
               filename.toLowerCase().endsWith('.docx') ||
               filename.toLowerCase().endsWith('.doc');

  console.log('Receipt scan: starting for', filename, mimeType, 'base64 length:', base64Data.length);

  // ── Word doc: extract text first, then send as text to Claude ──
  if (isWord) {
    try {
      var buf = Buffer.from(base64Data, 'base64');
      var str = buf.toString('binary');
      // Extract text from DOCX XML (w:t tags contain the text content)
      var matches = str.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
      var docText = matches.map(function (m) { return m.replace(/<[^>]+>/g, '').trim(); }).filter(Boolean).join(' ');
      if (!docText || docText.length < 10) {
        return res.json({ error: 'Could not extract text from Word document — try saving as PDF first' });
      }
      console.log('Word doc text extracted:', docText.substring(0, 100));
      var wordContent = [{ type: 'text', text: EXTRACT_INSTRUCTION + '\n\nDocument text:\n' + docText.substring(0, 8000) }];
      sendToClaudeText(wordContent, res);
    } catch (e) {
      console.error('Word doc extraction error:', e.message);
      return res.json({ error: 'Failed to read Word document: ' + e.message });
    }
    return;
  }

  // ── PDF: send as document type ──
  if (isPDF) {
    var pdfHeaders = {
      'Content-Type': 'application/json',
      'x-api-key': env.anthropic.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25'
    };
    var pdfContent = [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } },
      { type: 'text', text: EXTRACT_INSTRUCTION }
    ];
    sendToClaudeVision(pdfContent, pdfHeaders, res);
    return;
  }

  // ── Image: send as vision ──
  var validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  var safeMime = validImageTypes.indexOf(mimeType) >= 0 ? mimeType : 'image/jpeg';
  var imageHeaders = {
    'Content-Type': 'application/json',
    'x-api-key': env.anthropic.apiKey,
    'anthropic-version': '2023-06-01'
  };
  var imageContent = [
    { type: 'image', source: { type: 'base64', media_type: safeMime, data: base64Data } },
    { type: 'text', text: EXTRACT_INSTRUCTION }
  ];
  sendToClaudeVision(imageContent, imageHeaders, res);
});

// ═══════════════════════════════════════════════════════════
//  POST /api/receipts — Create receipt (public, no auth)
// ═══════════════════════════════════════════════════════════

router.post('/', function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Allow unauthenticated (public mobile form) but log it
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json({ error: 'Airtable not configured' });
  var b = req.body || {};

  var fields = {};
  if (b.supplierName) fields['Supplier Name'] = b.supplierName;
  // Date: Airtable expects YYYY-MM-DD ISO string
  if (b.purchaseDate) fields['Purchase Date'] = b.purchaseDate;
  // Currency fields: Airtable expects a number, not a string
  if (b.totalAmount != null && b.totalAmount !== '') {
    var amtNum = parseFloat(String(b.totalAmount).replace(/[^0-9.]/g, ''));
    if (!isNaN(amtNum)) fields['Total Receipt Amount'] = amtNum;
  }
  if (b.gstAmount != null && b.gstAmount !== '') {
    var gstNum = parseFloat(String(b.gstAmount).replace(/[^0-9.]/g, ''));
    if (!isNaN(gstNum)) fields['GST Amount'] = gstNum;
  }
  if (b.currency) fields['Currency'] = b.currency;
  // Purpose of Purchase: Airtable multi-select expects an array
  if (b.purpose) {
    var purposeArr = typeof b.purpose === 'string'
      ? b.purpose.split(',').map(function (s) { return s.trim(); }).filter(Boolean)
      : (Array.isArray(b.purpose) ? b.purpose : []);
    if (purposeArr.length) fields['Purpose of Purchase'] = purposeArr;
  }
  if (b.comments) fields['Comments'] = b.comments;
  // Staff Name: linked field — send email, Airtable will match to contact
  if (b.staffEmail) fields['Staff Name'] = b.staffEmail;
  // Reimbursement single select - default NO
  fields['Reimbursement?'] = (b.reimbursement === 'YES') ? 'YES' : 'NO';

  // Handle file upload - save locally and attach URL to Airtable
  var fileUrl = '';

  if (b.fileData && b.fileData.base64) {
    var ext = path.extname(b.fileData.name || 'receipt.jpg') || '.jpg';
    var safeName = 'receipt_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex') + ext;
    var filePath = path.join(uploadsDir, safeName);
    try {
      var fileBuf = Buffer.from(b.fileData.base64, 'base64');
      fs.writeFileSync(filePath, fileBuf);
      var protocol = 'https';
      var host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
      fileUrl = protocol + '://' + host + '/uploads/' + safeName;
      fields['Receipt Upload'] = [{ url: fileUrl, filename: b.fileData.name || safeName }];
    } catch (e) {
      console.warn('Receipt file save error:', e.message);
    }
  }

  airtable.rawFetch('Receipts', 'POST', '', { records: [{ fields: fields }] })
    .then(function (data) {
      if (data.records && data.records.length > 0) {
        console.log('Receipt created:', data.records[0].id, b.supplierName, b.totalAmount);
        res.json({ id: data.records[0].id, success: true, fileUrl: fileUrl });
      } else {
        console.error('Receipt create failed:', JSON.stringify(data));
        res.json({ error: data.error || 'Failed to create receipt' });
      }
    }).catch(function (e) {
      console.error('Receipt create error:', e.message);
      res.json({ error: e.message });
    });
});

// ═══════════════════════════════════════════════════════════
//  Authenticated routes
// ═══════════════════════════════════════════════════════════

router.use(authenticate);

// ─── GET /api/receipts — list all receipts ───────────────
router.get('/', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json([]);
  airtable.fetchAllFromTable('Receipts').then(function (records) {
    if (!records) return res.json([]);
    var result = (records || []).filter(function (r) {
      return r.fields && r.fields['Supplier Name'];
    }).map(function (r) {
      var f = r.fields || {};
      // Parse receipt upload URL
      var uploads = f['Receipt Upload'] || [];
      var receiptUrl = '';
      if (Array.isArray(uploads) && uploads.length > 0) receiptUrl = uploads[0].url || '';

      // Staff name from lookup
      var staffName = f['Full Name (from Staff Name)'] || '';
      if (Array.isArray(staffName)) staffName = staffName[0] || '';
      var jobTitle = f['Job Title (from Staff Name)'] || '';
      if (Array.isArray(jobTitle)) jobTitle = jobTitle[0] || '';

      return {
        id: r.id,
        uniqueId: f['Unique ID'] || '',
        purchaseDate: f['Purchase Date'] || '',
        purchaseDateFormatted: f['Purchase Date (Formula)'] || '',
        supplierName: f['Supplier Name'] || '',
        purpose: Array.isArray(f['Purpose of Purchase']) ? f['Purpose of Purchase'].join(',') : (f['Purpose of Purchase'] || ''),
        staffEmail: f['Staff Name'] || '',
        staffName: staffName,
        jobTitle: jobTitle,
        receiptUrl: receiptUrl,
        totalAmount: f['Total Receipt Amount'] != null ? (typeof f['Total Receipt Amount'] === 'number' ? '$' + f['Total Receipt Amount'].toFixed(2) : String(f['Total Receipt Amount'])) : '',
        gstAmount: f['GST Amount'] != null ? (typeof f['GST Amount'] === 'number' ? '$' + f['GST Amount'].toFixed(2) : String(f['GST Amount'])) : '',
        currency: f['Currency'] || 'AUD',
        comments: f['Comments'] || '',
        aiSummary: f['Summary (Receipt Upload)'] || '',
        createdDate: f['Created'] || '',
        reimbursement: f['Reimbursement?'] || 'NO'
      };
    });
    result.sort(function (a, b) { return (b.purchaseDate || '').localeCompare(a.purchaseDate || ''); });
    console.log('Receipts: loaded', result.length);
    res.json(result);
  }).catch(function (e) {
    console.error('Receipts error:', e.message);
    res.json([]);
  });
});

// ─── PATCH /api/receipts/:id — update receipt ────────────
router.patch('/:id', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json({ error: 'Airtable not configured' });
  var id = req.params.id;
  var b = req.body || {};
  var fields = {};
  if (b.reimbursement !== undefined) fields['Reimbursement?'] = (b.reimbursement === 'YES') ? 'YES' : 'NO';
  if (!Object.keys(fields).length) return res.json({ success: true });
  airtable.rawFetch('Receipts', 'PATCH', '', { records: [{ id: id, fields: fields }] })
    .then(function (data) {
      if (data.records) {
        console.log('Receipt updated:', id, JSON.stringify(fields));
        res.json({ success: true });
      } else {
        res.json({ error: data.error || 'Update failed' });
      }
    }).catch(function (e) {
      console.error('Receipt patch error:', e.message);
      res.json({ error: e.message });
    });
});

module.exports = router;
