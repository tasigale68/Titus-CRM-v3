// ══════════════════════════════════════════════════════
// Titus Messenger — Chat Admin Controls
// Message deletion, audit log, worker management
// Integrates with ChatsTab in the CRM Conversations view
// ══════════════════════════════════════════════════════

var ChatAdminControls = (function() {

  function getToken() {
    return localStorage.getItem('titus_token') || '';
  }

  function api(method, path, body) {
    var opts = {
      method: method,
      headers: {
        'Authorization': 'Bearer ' + getToken(),
        'Content-Type': 'application/json'
      }
    };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);
    return fetch(path, opts).then(function(res) {
      if (!res.ok) {
        return res.json().catch(function() { return { error: res.statusText }; }).then(function(err) {
          throw new Error(err.error || res.statusText);
        });
      }
      return res.json();
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Delete Message ──────────────────────────────────

  function deleteMessage(messageId, conversationId) {
    var reason = prompt('Reason for deleting this message (optional):');
    if (reason === null) return; // User cancelled

    api('DELETE', '/api/chat/messages/' + messageId, { reason: reason || '' }).then(function() {
      // Refresh the thread in the right panel
      if (typeof ChatsTab !== 'undefined' && typeof ChatsTab.refreshThread === 'function') {
        ChatsTab.refreshThread();
      }
    }).catch(function(e) {
      alert('Delete error: ' + e.message);
    });
  }

  // ── Deletion Audit Log ──────────────────────────────

  function showDeletionLog(conversationId) {
    var rp = document.getElementById('rightPanel');
    if (!rp) return;

    rp.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted)">' +
      '<div class="spin" style="width:24px;height:24px;border:3px solid var(--border);border-top-color:var(--teal);border-radius:50%"></div></div>';

    var url = '/api/chat/deletion-log';
    if (conversationId) url += '?conversation_id=' + conversationId;

    api('GET', url).then(function(logs) {
      if (!Array.isArray(logs)) logs = logs.logs || logs.data || [];

      var html = '<div style="padding:16px;overflow-y:auto;height:100%">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">';
      html += '<h2 style="font-size:16px;font-weight:700;color:var(--text)">Deletion Audit Log</h2>';
      html += '<button class="btn btn-sm" style="background:var(--surface2);border:1px solid var(--border);font-size:11px" onclick="ChatsTab.refreshThread()">Back to Thread</button>';
      html += '</div>';

      if (logs.length === 0) {
        html += '<div style="text-align:center;padding:30px 20px;color:var(--muted);font-size:12px">No deletions recorded</div>';
      } else {
        html += '<div style="overflow-x:auto">';
        html += '<table class="chats-tab-audit-table">';
        html += '<thead><tr>';
        html += '<th>Date</th>';
        html += '<th>Deleted By</th>';
        html += '<th>Role</th>';
        html += '<th>Original Sender</th>';
        html += '<th>Content</th>';
        html += '<th>Reason</th>';
        html += '</tr></thead><tbody>';

        logs.forEach(function(log) {
          var dateStr = '';
          if (log.deleted_at) {
            try {
              var tz = (typeof AU_TIMEZONES !== 'undefined' && typeof getAppTimezone === 'function')
                ? (AU_TIMEZONES[getAppTimezone()] || 'Australia/Brisbane')
                : 'Australia/Brisbane';
              dateStr = new Date(log.deleted_at).toLocaleDateString('en-AU', {
                day: '2-digit', month: '2-digit', year: '2-digit',
                hour: '2-digit', minute: '2-digit',
                timeZone: tz
              });
            } catch (e) {
              dateStr = new Date(log.deleted_at).toLocaleDateString('en-AU');
            }
          }

          var content = (log.original_content || '').substring(0, 80);
          if ((log.original_content || '').length > 80) content += '...';

          html += '<tr>';
          html += '<td>' + escapeHtml(dateStr) + '</td>';
          html += '<td>' + escapeHtml(log.deleted_by_name || '') + '</td>';
          html += '<td>' + escapeHtml(log.deleted_by_role || '') + '</td>';
          html += '<td>' + escapeHtml(log.original_sender_name || '') + '</td>';
          html += '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(content) + '</td>';
          html += '<td>' + escapeHtml(log.reason || '—') + '</td>';
          html += '</tr>';
        });

        html += '</tbody></table>';
        html += '</div>';
      }

      html += '</div>';
      rp.innerHTML = html;
    }).catch(function(e) {
      rp.innerHTML = '<div class="rp-empty" style="flex-direction:column">' +
        '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--light)"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
        '<div style="margin-top:8px">Error: ' + escapeHtml(e.message) + '</div></div>';
    });
  }

  // ── Worker Management ───────────────────────────────

  function showWorkerManagement() {
    var rp = document.getElementById('rightPanel');
    if (!rp) return;

    rp.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted)">' +
      '<div class="spin" style="width:24px;height:24px;border:3px solid var(--border);border-top-color:var(--teal);border-radius:50%"></div></div>';

    // Get all direct conversations to list workers
    api('GET', '/api/chat/conversations?type=direct').then(function(data) {
      var convList = Array.isArray(data) ? data : (data.conversations || data || []);
      var workers = [];
      var seen = {};

      convList.forEach(function(c) {
        if (c.worker_id && !seen[c.worker_id]) {
          seen[c.worker_id] = true;
          workers.push({
            id: c.worker_id,
            name: c.worker_name || c.title || 'Unknown',
            conversation_id: c.id,
            status: c.worker_status || c.status || 'active',
            last_active: c.updated_at || ''
          });
        }
      });

      var html = '<div style="padding:16px;overflow-y:auto;height:100%">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">';
      html += '<h2 style="font-size:16px;font-weight:700;color:var(--text)">Worker Management</h2>';
      html += '<button class="btn btn-sm" style="background:var(--surface2);border:1px solid var(--border);font-size:11px" onclick="ChatsTab.refreshThread()">Back to Thread</button>';
      html += '</div>';

      if (workers.length === 0) {
        html += '<div style="text-align:center;padding:30px 20px;color:var(--muted);font-size:12px">No workers found</div>';
      } else {
        html += '<div style="overflow-x:auto">';
        html += '<table class="chats-tab-worker-table">';
        html += '<thead><tr>';
        html += '<th>Worker</th>';
        html += '<th>ID</th>';
        html += '<th>Last Active</th>';
        html += '<th>Status</th>';
        html += '<th>Actions</th>';
        html += '</tr></thead><tbody>';

        workers.forEach(function(w) {
          var lastActive = '—';
          if (w.last_active) {
            try {
              var tz = (typeof AU_TIMEZONES !== 'undefined' && typeof getAppTimezone === 'function')
                ? (AU_TIMEZONES[getAppTimezone()] || 'Australia/Brisbane')
                : 'Australia/Brisbane';
              lastActive = new Date(w.last_active).toLocaleDateString('en-AU', {
                day: '2-digit', month: '2-digit', year: '2-digit',
                timeZone: tz
              });
            } catch (e) {
              lastActive = new Date(w.last_active).toLocaleDateString('en-AU');
            }
          }

          var isActiveWorker = w.status === 'active';
          var statusBadge = isActiveWorker
            ? '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;background:#D1FAE5;color:#065F46">Active</span>'
            : '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;background:var(--surface2);color:var(--muted)">Inactive</span>';

          html += '<tr>';
          html += '<td><strong>' + escapeHtml(w.name) + '</strong></td>';
          html += '<td style="font-size:10px;color:var(--muted)">' + escapeHtml(w.id) + '</td>';
          html += '<td>' + lastActive + '</td>';
          html += '<td>' + statusBadge + '</td>';
          html += '<td style="white-space:nowrap">';

          if (isActiveWorker) {
            html += '<button class="btn btn-sm" style="background:#FEE2E2;color:#991B1B;border:1px solid #FECACA;font-size:10px;padding:3px 8px" ' +
              'onclick="ChatAdminControls.deactivateWorker(\'' + w.id + '\',\'' + escapeHtml(w.name).replace(/'/g, "\\'") + '\')">Deactivate</button>';
          } else {
            html += '<button class="btn btn-sm" style="background:#D1FAE5;color:#065F46;border:1px solid #A7F3D0;font-size:10px;padding:3px 8px" ' +
              'onclick="ChatAdminControls.reactivateWorker(\'' + w.id + '\',\'' + escapeHtml(w.name).replace(/'/g, "\\'") + '\')">Reactivate</button>';
          }

          html += '</td>';
          html += '</tr>';
        });

        html += '</tbody></table>';
        html += '</div>';
      }

      html += '</div>';
      rp.innerHTML = html;
    }).catch(function(e) {
      rp.innerHTML = '<div class="rp-empty" style="flex-direction:column">' +
        '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--light)"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
        '<div style="margin-top:8px">Error: ' + escapeHtml(e.message) + '</div></div>';
    });
  }

  // ── Deactivate / Reactivate Worker ──────────────────

  function deactivateWorker(workerId, workerName) {
    if (!confirm('Deactivate ' + workerName + '? This will remove them from all groups.')) return;

    api('POST', '/api/chat/workers/' + workerId + '/deactivate').then(function(result) {
      var removedFrom = (result && result.removed_from) ? result.removed_from : 0;
      alert(workerName + ' deactivated. Removed from ' + removedFrom + ' group(s).');
      showWorkerManagement(); // Refresh the list
    }).catch(function(e) {
      alert('Error: ' + e.message);
    });
  }

  function reactivateWorker(workerId, workerName) {
    if (!confirm('Reactivate ' + workerName + '? This will restore their group memberships.')) return;

    api('POST', '/api/chat/workers/' + workerId + '/reactivate').then(function(result) {
      var reactivated = (result && result.reactivated) ? result.reactivated : 0;
      alert(workerName + ' reactivated. Restored ' + reactivated + ' membership(s).');
      showWorkerManagement(); // Refresh the list
    }).catch(function(e) {
      alert('Error: ' + e.message);
    });
  }

  // ── Public API ──────────────────────────────────────

  return {
    deleteMessage: deleteMessage,
    showDeletionLog: showDeletionLog,
    showWorkerManagement: showWorkerManagement,
    deactivateWorker: deactivateWorker,
    reactivateWorker: reactivateWorker
  };
})();
