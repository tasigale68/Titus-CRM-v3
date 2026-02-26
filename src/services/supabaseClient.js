// Titus CRM — Direct Supabase Client for SaaS features
// Use this for all new multi-tenant code (NOT the legacy airtable-compat layer)

var SUPABASE_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
var SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || '').trim();

function query(table, method, params) {
  // Build PostgREST query URL from params object
  // params: { select, eq (object of col:val), order, limit, offset, or, filter }
  var url = SUPABASE_URL + '/rest/v1/' + table;
  var queryParts = [];

  if (params) {
    if (params.select) queryParts.push('select=' + encodeURIComponent(params.select));
    if (params.eq) {
      Object.keys(params.eq).forEach(function(k) {
        queryParts.push(k + '=eq.' + encodeURIComponent(params.eq[k]));
      });
    }
    if (params.neq) {
      Object.keys(params.neq).forEach(function(k) {
        queryParts.push(k + '=neq.' + encodeURIComponent(params.neq[k]));
      });
    }
    if (params.gt) {
      Object.keys(params.gt).forEach(function(k) {
        queryParts.push(k + '=gt.' + encodeURIComponent(params.gt[k]));
      });
    }
    if (params.lt) {
      Object.keys(params.lt).forEach(function(k) {
        queryParts.push(k + '=lt.' + encodeURIComponent(params.lt[k]));
      });
    }
    if (params.gte) {
      Object.keys(params.gte).forEach(function(k) {
        queryParts.push(k + '=gte.' + encodeURIComponent(params.gte[k]));
      });
    }
    if (params.lte) {
      Object.keys(params.lte).forEach(function(k) {
        queryParts.push(k + '=lte.' + encodeURIComponent(params.lte[k]));
      });
    }
    if (params.ilike) {
      Object.keys(params.ilike).forEach(function(k) {
        queryParts.push(k + '=ilike.' + encodeURIComponent(params.ilike[k]));
      });
    }
    if (params.in_) {
      Object.keys(params.in_).forEach(function(k) {
        queryParts.push(k + '=in.(' + params.in_[k].map(encodeURIComponent).join(',') + ')');
      });
    }
    if (params.contains) {
      Object.keys(params.contains).forEach(function(k) {
        queryParts.push(k + '=cs.' + encodeURIComponent(JSON.stringify(params.contains[k])));
      });
    }
    if (params.order) queryParts.push('order=' + encodeURIComponent(params.order));
    if (params.limit) queryParts.push('limit=' + params.limit);
    if (params.offset) queryParts.push('offset=' + params.offset);
    if (params.or) queryParts.push('or=(' + params.or + ')');
  }

  if (queryParts.length) url += '?' + queryParts.join('&');

  var headers = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
    'Content-Type': 'application/json',
    'Prefer': method === 'GET' ? 'count=exact' : 'return=representation'
  };

  var opts = { method: method || 'GET', headers: headers };

  return fetch(url, opts).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error('Supabase ' + r.status + ': ' + t.substring(0, 300)); });
    if (r.status === 204) return [];
    var ct = r.headers.get('content-type') || '';
    if (!ct.includes('json')) return [];
    return r.json();
  });
}

function insert(table, data) {
  var url = SUPABASE_URL + '/rest/v1/' + table;
  var body = Array.isArray(data) ? data : [data];
  return fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(body)
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error('Supabase insert ' + r.status + ': ' + t.substring(0, 300)); });
    return r.json();
  });
}

function update(table, params, data) {
  var url = SUPABASE_URL + '/rest/v1/' + table;
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
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error('Supabase update ' + r.status + ': ' + t.substring(0, 300)); });
    return r.json();
  });
}

function remove(table, params) {
  var url = SUPABASE_URL + '/rest/v1/' + table;
  var queryParts = [];
  if (params && params.eq) {
    Object.keys(params.eq).forEach(function(k) {
      queryParts.push(k + '=eq.' + encodeURIComponent(params.eq[k]));
    });
  }
  if (queryParts.length) url += '?' + queryParts.join('&');

  return fetch(url, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error('Supabase delete ' + r.status + ': ' + t.substring(0, 300)); });
    if (r.status === 204) return [];
    return r.json();
  });
}

// Supabase Storage helper
function storageUpload(bucket, path, buffer, contentType) {
  var url = SUPABASE_URL + '/storage/v1/object/' + bucket + '/' + path;
  return fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
      'Content-Type': contentType || 'application/octet-stream',
      'x-upsert': 'true'
    },
    body: buffer
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error('Storage upload ' + r.status + ': ' + t.substring(0, 200)); });
    return r.json();
  });
}

function storageUrl(bucket, path) {
  return SUPABASE_URL + '/storage/v1/object/public/' + bucket + '/' + path;
}

function rpc(fnName, params) {
  var url = SUPABASE_URL + '/rest/v1/rpc/' + fnName;
  return fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params || {})
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error('Supabase RPC ' + r.status + ': ' + t.substring(0, 300)); });
    return r.json();
  });
}

module.exports = { query, insert, update, remove, storageUpload, storageUrl, rpc };
