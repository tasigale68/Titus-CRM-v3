// AYG Supabase Client — mirrors supabaseClient.js pattern
// Used to write assessment/lead data to khcyrpophlxxpprsjhio (AYG project)

var AYG_SUPABASE_URL = (process.env.AYG_SUPABASE_URL || 'https://khcyrpophlxxpprsjhio.supabase.co').trim().replace(/\/+$/, '');
var AYG_SUPABASE_SERVICE_KEY = (process.env.AYG_SUPABASE_SERVICE_KEY || '').trim();

function query(table, method, params) {
  var url = AYG_SUPABASE_URL + '/rest/v1/' + table;
  var queryParts = [];

  if (params) {
    if (params.select) queryParts.push('select=' + encodeURIComponent(params.select));
    if (params.eq) {
      Object.keys(params.eq).forEach(function(k) {
        queryParts.push(k + '=eq.' + encodeURIComponent(params.eq[k]));
      });
    }
    if (params.ilike) {
      Object.keys(params.ilike).forEach(function(k) {
        queryParts.push(k + '=ilike.' + encodeURIComponent(params.ilike[k]));
      });
    }
    if (params.order) queryParts.push('order=' + encodeURIComponent(params.order));
    if (params.limit) queryParts.push('limit=' + params.limit);
  }

  if (queryParts.length) url += '?' + queryParts.join('&');

  return fetch(url, {
    method: method || 'GET',
    headers: {
      'apikey': AYG_SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + AYG_SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      'Prefer': method === 'GET' ? 'count=exact' : 'return=representation'
    }
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error('AYG Supabase ' + r.status + ': ' + t.substring(0, 300)); });
    if (r.status === 204) return [];
    var ct = r.headers.get('content-type') || '';
    if (!ct.includes('json')) return [];
    return r.json();
  });
}

function insert(table, data) {
  var url = AYG_SUPABASE_URL + '/rest/v1/' + table;
  var body = Array.isArray(data) ? data : [data];
  return fetch(url, {
    method: 'POST',
    headers: {
      'apikey': AYG_SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + AYG_SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(body)
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error('AYG insert ' + r.status + ': ' + t.substring(0, 300)); });
    return r.json();
  });
}

function upsert(table, data, onConflict) {
  var url = AYG_SUPABASE_URL + '/rest/v1/' + table;
  var prefer = 'return=representation';
  if (onConflict) prefer += ',resolution=merge-duplicates';
  var body = Array.isArray(data) ? data : [data];
  return fetch(url, {
    method: 'POST',
    headers: {
      'apikey': AYG_SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + AYG_SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      'Prefer': prefer,
      'on-conflict': onConflict || ''
    },
    body: JSON.stringify(body)
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error('AYG upsert ' + r.status + ': ' + t.substring(0, 300)); });
    return r.json();
  });
}

function update(table, params, data) {
  var url = AYG_SUPABASE_URL + '/rest/v1/' + table;
  var queryParts = [];
  if (params && params.eq) {
    Object.keys(params.eq).forEach(function(k) {
      queryParts.push(k + '=eq.' + encodeURIComponent(params.eq[k]));
    });
  }
  if (queryParts.length) url += '?' + queryParts.join('&');
  return fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': AYG_SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + AYG_SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error('AYG update ' + r.status + ': ' + t.substring(0, 300)); });
    return r.json();
  });
}

module.exports = { query, insert, upsert, update };
