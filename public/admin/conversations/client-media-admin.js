// ══════════════════════════════════════════════════════
// Titus Messenger — Client Media Administration
// Media gallery for admin panel within CRM Conversations view
// ══════════════════════════════════════════════════════

var ClientMediaAdmin = (function() {

  var _mediaCache = null; // cached media for filtering
  var _currentClientId = null;

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

  // ── Open Media Gallery ──────────────────────────────

  function open(clientId) {
    if (!clientId) {
      alert('No client associated with this conversation');
      return;
    }

    _currentClientId = clientId;

    var rp = document.getElementById('rightPanel');
    if (!rp) return;
    rp.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted)">' +
      '<div class="spin" style="width:24px;height:24px;border:3px solid var(--border);border-top-color:var(--teal);border-radius:50%"></div></div>';

    api('GET', '/api/chat/client-media/' + clientId).then(function(data) {
      var media = data.media || data || [];
      var total = data.total || media.length;
      _mediaCache = media;
      renderMediaView(clientId, media, total);
    }).catch(function(e) {
      rp.innerHTML = '<div class="rp-empty" style="flex-direction:column">' +
        '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--light)"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
        '<div style="margin-top:8px">Error: ' + escapeHtml(e.message) + '</div></div>';
    });
  }

  // ── Render Media View ───────────────────────────────

  function renderMediaView(clientId, media, total) {
    var rp = document.getElementById('rightPanel');
    if (!rp) return;

    var images = media.filter(function(m) { return m.file_category === 'image'; });
    var videos = media.filter(function(m) { return m.file_category === 'video'; });
    var docs = media.filter(function(m) { return m.file_category !== 'image' && m.file_category !== 'video'; });

    var html = '<div style="padding:16px;overflow-y:auto;height:100%">';

    // Header
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">';
    html += '<h2 style="font-size:16px;font-weight:700;color:var(--text)">Client Media (' + total + ' files)</h2>';
    html += '<button class="btn btn-sm" style="background:var(--surface2);border:1px solid var(--border);font-size:11px" onclick="ChatsTab.refreshThread()">Back to Thread</button>';
    html += '</div>';

    // Summary cards
    html += '<div class="chats-tab-media-summary">';
    html += '<div class="chats-tab-media-summary-card">';
    html += '<div style="font-size:22px;font-weight:700;color:var(--teal)">' + images.length + '</div>';
    html += '<div style="font-size:10px;color:var(--muted)">Images</div>';
    html += '</div>';
    html += '<div class="chats-tab-media-summary-card">';
    html += '<div style="font-size:22px;font-weight:700;color:var(--teal)">' + videos.length + '</div>';
    html += '<div style="font-size:10px;color:var(--muted)">Videos</div>';
    html += '</div>';
    html += '<div class="chats-tab-media-summary-card">';
    html += '<div style="font-size:22px;font-weight:700;color:var(--teal)">' + docs.length + '</div>';
    html += '<div style="font-size:10px;color:var(--muted)">Documents</div>';
    html += '</div>';
    html += '</div>';

    // Filter bar
    html += '<div class="chats-tab-media-filters">';
    html += '<button class="chats-tab-media-filter-btn active" onclick="ClientMediaAdmin.filterMedia(this,\'all\')">All</button>';
    html += '<button class="chats-tab-media-filter-btn" onclick="ClientMediaAdmin.filterMedia(this,\'image\')">Images</button>';
    html += '<button class="chats-tab-media-filter-btn" onclick="ClientMediaAdmin.filterMedia(this,\'video\')">Videos</button>';
    html += '<button class="chats-tab-media-filter-btn" onclick="ClientMediaAdmin.filterMedia(this,\'document\')">Documents</button>';
    html += '</div>';

    if (media.length === 0) {
      html += '<div style="text-align:center;padding:30px 20px;color:var(--muted);font-size:12px">No media yet. Media shared in this client\'s group will appear here.</div>';
    } else {
      html += '<div class="chats-tab-media-grid" id="chatsTabMediaGrid">';
      media.forEach(function(m) {
        html += renderMediaCard(m);
      });
      html += '</div>';
    }

    html += '</div>';
    rp.innerHTML = html;
  }

  // ── Render Single Media Card ────────────────────────

  function renderMediaCard(m) {
    var html = '<div class="chats-tab-media-card" data-category="' + (m.file_category || 'document') + '">';

    if (m.file_category === 'image') {
      var src = m.thumbnail_url || m.file_url;
      html += '<div class="chats-tab-media-card-thumb" onclick="ClientMediaAdmin._viewImage(\'' + (m.file_url || src) + '\')">';
      html += '<img src="' + src + '" alt="' + escapeHtml(m.filename || 'image') + '" loading="lazy">';
      html += '</div>';
    } else if (m.file_category === 'video') {
      html += '<div class="chats-tab-media-card-placeholder" onclick="window.open(\'' + m.file_url + '\',\'_blank\')">';
      html += '<span style="font-size:32px">&#127916;</span>';
      html += '</div>';
    } else {
      html += '<div class="chats-tab-media-card-placeholder" onclick="window.open(\'' + m.file_url + '\',\'_blank\')">';
      html += '<span style="font-size:32px">&#128196;</span>';
      html += '</div>';
    }

    html += '<div class="chats-tab-media-card-info">';
    html += '<div class="chats-tab-media-card-filename">' + escapeHtml(m.filename || 'Unknown file') + '</div>';
    html += '<div class="chats-tab-media-card-meta">' + escapeHtml(m.uploaded_by_name || 'Unknown') + ' &middot; ' + formatMediaDate(m.created_at) + '</div>';

    if (m.category && m.category !== 'general') {
      html += '<div class="chats-tab-media-card-meta" style="color:var(--teal)">' + escapeHtml(m.category) + '</div>';
    }

    html += '<div style="display:flex;gap:4px;margin-top:4px">';
    html += '<button style="background:none;border:none;cursor:pointer;font-size:12px;padding:2px 4px;color:var(--muted)" onclick="event.stopPropagation();ClientMediaAdmin.editMedia(\'' + m.id + '\')" title="Edit">&#9998;</button>';
    html += '<button style="background:none;border:none;cursor:pointer;font-size:12px;padding:2px 4px;color:var(--muted)" onclick="event.stopPropagation();window.open(\'' + m.file_url + '\',\'_blank\')" title="Download">&#11015;</button>';
    html += '</div>';

    html += '</div>';
    html += '</div>';
    return html;
  }

  // ── Filter Media ────────────────────────────────────

  function filterMedia(btn, category) {
    // Update active state
    var parent = btn.parentElement;
    if (parent) {
      parent.querySelectorAll('.chats-tab-media-filter-btn').forEach(function(b) {
        b.classList.remove('active');
      });
    }
    btn.classList.add('active');

    var grid = document.getElementById('chatsTabMediaGrid');
    if (!grid) return;
    var media = _mediaCache || [];

    var filtered = category === 'all' ? media : media.filter(function(m) {
      if (category === 'document') {
        return m.file_category !== 'image' && m.file_category !== 'video';
      }
      return m.file_category === category;
    });

    var html = '';
    if (filtered.length === 0) {
      html = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--muted);font-size:12px">No ' + category + ' files</div>';
    } else {
      filtered.forEach(function(m) {
        html += renderMediaCard(m);
      });
    }

    grid.innerHTML = html;
  }

  // ── Edit Media ──────────────────────────────────────

  function editMedia(mediaId) {
    var category = prompt('Category (e.g. progress, incident, general):');
    if (category === null) return;
    var description = prompt('Description (optional):');
    if (description === null) return;

    api('PATCH', '/api/chat/client-media/' + mediaId, {
      category: category || 'general',
      description: description || ''
    }).then(function() {
      alert('Media updated');
      // Reload if we have a client ID
      if (_currentClientId) {
        open(_currentClientId);
      }
    }).catch(function(e) {
      alert('Error: ' + e.message);
    });
  }

  // ── View Image (Lightbox) ───────────────────────────

  function _viewImage(url) {
    // Use existing global lightbox if available
    if (typeof window.openLightbox === 'function') {
      window.openLightbox(url);
      return;
    }
    // Fallback lightbox
    var lb = document.getElementById('chatsTabLightbox');
    if (!lb) {
      lb = document.createElement('div');
      lb.id = 'chatsTabLightbox';
      lb.className = 'chats-tab-lightbox';
      lb.onclick = function() { lb.style.display = 'none'; };
      lb.innerHTML = '<button class="chats-tab-lightbox-close" onclick="event.stopPropagation();document.getElementById(\'chatsTabLightbox\').style.display=\'none\'">&#10005;</button>' +
        '<img id="chatsTabLightboxImg" src="" alt="Full size">';
      document.body.appendChild(lb);
    }
    var img = document.getElementById('chatsTabLightboxImg');
    if (img) img.src = url;
    lb.style.display = 'flex';
  }

  // ── Helpers ─────────────────────────────────────────

  function formatMediaDate(dateStr) {
    if (!dateStr) return '';
    try {
      var tz = (typeof AU_TIMEZONES !== 'undefined' && typeof getAppTimezone === 'function')
        ? (AU_TIMEZONES[getAppTimezone()] || 'Australia/Brisbane')
        : 'Australia/Brisbane';
      return new Date(dateStr).toLocaleDateString('en-AU', {
        day: '2-digit', month: '2-digit', year: '2-digit',
        timeZone: tz
      });
    } catch (e) {
      return new Date(dateStr).toLocaleDateString('en-AU');
    }
  }

  function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  // ── Public API ──────────────────────────────────────

  return {
    open: open,
    filterMedia: filterMedia,
    editMedia: editMedia,
    formatSize: formatSize,
    _viewImage: _viewImage
  };
})();
