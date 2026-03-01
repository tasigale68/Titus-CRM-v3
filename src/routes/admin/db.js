// Titus CRM — Master Admin Database Editor API
// Superadmin-only routes for browsing and editing Supabase tables

var express = require('express');
var sb = require('../../services/supabaseClient');
var { authenticate, requireRole } = require('../../middleware/auth');

var SUPABASE_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
var SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || '').trim();

var router = express.Router();

// All routes require superadmin
router.use(authenticate);
router.use(requireRole('superadmin'));

// Schemas to exclude from table listing
var EXCLUDED_SCHEMAS = ['pg_catalog', 'information_schema', 'auth', 'storage', 'extensions', 'graphql', 'graphql_public', 'realtime', 'supabase_functions', 'supabase_migrations', 'vault', 'pgsodium', 'pgsodium_masks', 'net', 'cron'];
var EXCLUDED_TABLE_PREFIXES = ['pg_', '_prisma', 'supabase_', 'auth_', 'storage_'];

// ─── Helper: raw SQL query via PostgREST rpc ────────────────

function rawSql(sql) {
  // Use the Supabase REST API to query information_schema directly
  // Since PostgREST doesn't expose information_schema, we use a direct fetch
  var url = SUPABASE_URL + '/rest/v1/rpc/';
  // Fallback: query via PostgREST-compatible approach
  return fetch(SUPABASE_URL + '/rest/v1/', {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY
    }
  });
}

// ─── Helper: fetch from information_schema via PostgREST ────

function fetchInfoSchema(table, params) {
  var url = SUPABASE_URL + '/rest/v1/' + table;
  var queryParts = [];

  if (params) {
    Object.keys(params).forEach(function(k) {
      queryParts.push(k + '=' + encodeURIComponent(params[k]));
    });
  }

  if (queryParts.length) url += '?' + queryParts.join('&');

  return fetch(url, {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'count=exact',
      'Accept-Profile': 'information_schema'
    }
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error('Info schema ' + r.status + ': ' + t.substring(0, 300)); });
    return r.json();
  });
}

// ─── Helper: validate table name (prevent injection) ────────

function isValidTableName(name) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

// ─── Helper: get text columns for a table ───────────────────

function getTextColumns(tableName) {
  return fetchInfoSchema('columns', {
    'select': 'column_name',
    'table_schema': 'eq.public',
    'table_name': 'eq.' + tableName,
    'data_type': 'in.(text,character varying,varchar,char,character,name,citext)'
  });
}

// ═══════════════════════════════════════════════════════
//  GET /tables — list all user tables
// ═══════════════════════════════════════════════════════

router.get('/tables', function(req, res) {
  try {
    fetchInfoSchema('tables', {
      'select': 'table_name,table_type',
      'table_schema': 'eq.public',
      'table_type': 'eq.BASE TABLE',
      'order': 'table_name.asc'
    }).then(function(tables) {
      // Filter out system tables
      var filtered = (tables || []).filter(function(t) {
        var name = t.table_name || '';
        for (var i = 0; i < EXCLUDED_TABLE_PREFIXES.length; i++) {
          if (name.indexOf(EXCLUDED_TABLE_PREFIXES[i]) === 0) return false;
        }
        return true;
      });

      var result = filtered.map(function(t) {
        return {
          name: t.table_name,
          type: t.table_type
        };
      });

      res.json({ tables: result });
    }).catch(function(err) {
      console.error('[Admin DB] List tables error:', err.message);
      res.status(500).json({ error: 'Failed to list tables: ' + err.message });
    });
  } catch (err) {
    console.error('[Admin DB] List tables error:', err.message);
    res.status(500).json({ error: 'Failed to list tables: ' + err.message });
  }
});

// ═══════════════════════════════════════════════════════
//  GET /:table/schema — get column definitions
// ═══════════════════════════════════════════════════════

router.get('/:table/schema', function(req, res) {
  var table = req.params.table;

  if (!isValidTableName(table)) {
    return res.status(400).json({ error: 'Invalid table name' });
  }

  try {
    fetchInfoSchema('columns', {
      'select': 'column_name,data_type,is_nullable,column_default,ordinal_position,character_maximum_length',
      'table_schema': 'eq.public',
      'table_name': 'eq.' + table,
      'order': 'ordinal_position.asc'
    }).then(function(columns) {
      if (!columns || columns.length === 0) {
        return res.status(404).json({ error: 'Table not found or has no columns: ' + table });
      }

      var result = columns.map(function(c) {
        return {
          name: c.column_name,
          type: c.data_type,
          nullable: c.is_nullable === 'YES',
          default_value: c.column_default,
          max_length: c.character_maximum_length,
          position: c.ordinal_position
        };
      });

      res.json({ table: table, columns: result });
    }).catch(function(err) {
      console.error('[Admin DB] Schema error:', err.message);
      res.status(500).json({ error: 'Failed to get schema: ' + err.message });
    });
  } catch (err) {
    console.error('[Admin DB] Schema error:', err.message);
    res.status(500).json({ error: 'Failed to get schema: ' + err.message });
  }
});

// ═══════════════════════════════════════════════════════
//  GET /:table — list records with pagination, search, sort
// ═══════════════════════════════════════════════════════

router.get('/:table', function(req, res) {
  var table = req.params.table;

  if (!isValidTableName(table)) {
    return res.status(400).json({ error: 'Invalid table name' });
  }

  var page = parseInt(req.query.page) || 1;
  var limit = parseInt(req.query.limit) || 50;
  var search = (req.query.search || '').trim();
  var sort = (req.query.sort || 'id').trim();
  var order = (req.query.order || 'asc').toLowerCase();

  if (page < 1) page = 1;
  if (limit < 1) limit = 1;
  if (limit > 500) limit = 500;
  if (order !== 'asc' && order !== 'desc') order = 'asc';

  var offset = (page - 1) * limit;

  try {
    // Build the query
    var queryParams = {
      select: '*',
      order: sort + '.' + order,
      limit: limit,
      offset: offset
    };

    // If search term provided, find text columns and build OR filter
    var searchPromise;
    if (search) {
      searchPromise = getTextColumns(table).then(function(columns) {
        if (columns && columns.length > 0) {
          var orParts = columns.map(function(c) {
            return c.column_name + '.ilike.*' + search + '*';
          });
          queryParams.or = orParts.join(',');
        }
        return queryParams;
      });
    } else {
      searchPromise = Promise.resolve(queryParams);
    }

    searchPromise.then(function(params) {
      // We need count=exact to get total, which the query function already sets
      var url = SUPABASE_URL + '/rest/v1/' + table;
      var qParts = [];

      if (params.select) qParts.push('select=' + encodeURIComponent(params.select));
      if (params.order) qParts.push('order=' + encodeURIComponent(params.order));
      if (params.limit) qParts.push('limit=' + params.limit);
      if (params.offset) qParts.push('offset=' + params.offset);
      if (params.or) qParts.push('or=(' + params.or + ')');

      if (qParts.length) url += '?' + qParts.join('&');

      return fetch(url, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'count=exact'
        }
      });
    }).then(function(r) {
      // Extract content-range header for total count
      var contentRange = r.headers.get('content-range') || '';
      var total = 0;
      // content-range format: "0-49/1234" or "*/0"
      var rangeMatch = contentRange.match(/\/(\d+)/);
      if (rangeMatch) total = parseInt(rangeMatch[1]);

      if (!r.ok) return r.text().then(function(t) { throw new Error('Query ' + r.status + ': ' + t.substring(0, 300)); });

      return r.json().then(function(records) {
        var pages = Math.ceil(total / limit) || 1;

        res.json({
          records: records || [],
          total: total,
          page: page,
          pages: pages
        });
      });
    }).catch(function(err) {
      console.error('[Admin DB] List records error:', err.message);
      res.status(500).json({ error: 'Failed to list records: ' + err.message });
    });
  } catch (err) {
    console.error('[Admin DB] List records error:', err.message);
    res.status(500).json({ error: 'Failed to list records: ' + err.message });
  }
});

// ═══════════════════════════════════════════════════════
//  GET /:table/:id — get single record
// ═══════════════════════════════════════════════════════

router.get('/:table/:id', function(req, res) {
  var table = req.params.table;
  var id = req.params.id;

  if (!isValidTableName(table)) {
    return res.status(400).json({ error: 'Invalid table name' });
  }

  try {
    sb.query(table, 'GET', { eq: { id: id } }).then(function(rows) {
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Record not found' });
      }
      res.json({ record: rows[0] });
    }).catch(function(err) {
      console.error('[Admin DB] Get record error:', err.message);
      res.status(500).json({ error: 'Failed to get record: ' + err.message });
    });
  } catch (err) {
    console.error('[Admin DB] Get record error:', err.message);
    res.status(500).json({ error: 'Failed to get record: ' + err.message });
  }
});

// ═══════════════════════════════════════════════════════
//  POST /:table — create record
// ═══════════════════════════════════════════════════════

router.post('/:table', function(req, res) {
  var table = req.params.table;

  if (!isValidTableName(table)) {
    return res.status(400).json({ error: 'Invalid table name' });
  }

  var data = req.body;
  if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Request body must contain field values' });
  }

  try {
    sb.insert(table, data).then(function(rows) {
      var record = (rows && rows.length > 0) ? rows[0] : data;
      res.status(201).json({ record: record });
    }).catch(function(err) {
      console.error('[Admin DB] Create record error:', err.message);
      res.status(500).json({ error: 'Failed to create record: ' + err.message });
    });
  } catch (err) {
    console.error('[Admin DB] Create record error:', err.message);
    res.status(500).json({ error: 'Failed to create record: ' + err.message });
  }
});

// ═══════════════════════════════════════════════════════
//  PATCH /:table/:id — update record
// ═══════════════════════════════════════════════════════

router.patch('/:table/:id', function(req, res) {
  var table = req.params.table;
  var id = req.params.id;

  if (!isValidTableName(table)) {
    return res.status(400).json({ error: 'Invalid table name' });
  }

  var data = req.body;
  if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Request body must contain field values to update' });
  }

  try {
    sb.update(table, { eq: { id: id } }, data).then(function(rows) {
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Record not found or no changes made' });
      }
      res.json({ record: rows[0] });
    }).catch(function(err) {
      console.error('[Admin DB] Update record error:', err.message);
      res.status(500).json({ error: 'Failed to update record: ' + err.message });
    });
  } catch (err) {
    console.error('[Admin DB] Update record error:', err.message);
    res.status(500).json({ error: 'Failed to update record: ' + err.message });
  }
});

// ═══════════════════════════════════════════════════════
//  DELETE /:table/:id — delete record
// ═══════════════════════════════════════════════════════

router.delete('/:table/:id', function(req, res) {
  var table = req.params.table;
  var id = req.params.id;

  if (!isValidTableName(table)) {
    return res.status(400).json({ error: 'Invalid table name' });
  }

  try {
    sb.remove(table, { eq: { id: id } }).then(function(rows) {
      res.json({ success: true, deleted: (rows && rows.length > 0) ? rows[0] : { id: id } });
    }).catch(function(err) {
      console.error('[Admin DB] Delete record error:', err.message);
      res.status(500).json({ error: 'Failed to delete record: ' + err.message });
    });
  } catch (err) {
    console.error('[Admin DB] Delete record error:', err.message);
    res.status(500).json({ error: 'Failed to delete record: ' + err.message });
  }
});

module.exports = router;
