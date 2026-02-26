// ══════════════════════════════════════════════════════
// Titus Messenger — Chats Tab for CRM Conversations View
// Integrates into the existing Conversations tab bar (All | Calls | SMS | Chats)
// Also hides the Email tab
// ══════════════════════════════════════════════════════

var ChatsTab = (function() {
  var conversations = [];
  var currentConv = null;
  var messages = [];
  var hasMore = false;
  var loading = false;
  var currentFilter = 'all'; // 'all', 'group_chats', 'worker_conversations', 'escalated'
  var searchQuery = '';
  var pollTimer = null;
  var threadPollTimer = null;
  var isActive = false;
  var workerSections = {}; // worker_id -> { expanded: bool }

  // ── Auth & API ──────────────────────────────────────

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

  // ── Initialization ──────────────────────────────────

  function init() {
    // Wait for the render() cycle to build the tab bar, then inject our Chats tab
    // We hook into the existing render cycle by observing the midTabs element
    injectChatsTab();

    // Also hook into the global render function to re-inject after each render cycle
    if (typeof window._originalRender === 'undefined' && typeof window.render === 'function') {
      window._originalRender = window.render;
      window.render = function() {
        window._originalRender();
        // After the original render rebuilds tabs, re-inject Chats tab
        if (typeof currentView !== 'undefined' && currentView === 'conversations') {
          injectChatsTab();
        }
      };
    }

    // Listen for search input when chats tab is active
    var searchEl = document.getElementById('midSearch');
    if (searchEl) {
      searchEl.addEventListener('input', function() {
        if (!isActive) return;
        searchQuery = searchEl.value.trim().toLowerCase();
        renderChatsList();
      });
    }
  }

  function injectChatsTab() {
    var tabBar = document.getElementById('midTabs');
    if (!tabBar) return;

    // Check if Chats tab already exists
    var existing = tabBar.querySelector('[data-filter="chats"]');
    if (existing) return;

    // Hide the Email tab
    var emailTab = tabBar.querySelector('[data-filter="email"]');
    if (emailTab) {
      emailTab.style.display = 'none';
    }

    // Create and append the Chats tab button
    var chatsBtn = document.createElement('button');
    chatsBtn.className = 'mid-tab';
    chatsBtn.setAttribute('data-filter', 'chats');
    chatsBtn.textContent = 'Chats';
    tabBar.appendChild(chatsBtn);

    // Handle click
    chatsBtn.addEventListener('click', function() {
      // Remove 'on' from all tabs
      tabBar.querySelectorAll('.mid-tab').forEach(function(b) { b.classList.remove('on'); });
      chatsBtn.classList.add('on');

      // Set global convFilter so the main render() knows we're on chats
      if (typeof window.convFilter !== 'undefined') {
        window.convFilter = 'chats';
      }

      activateChatsTab();
    });

    // If convFilter is already 'chats' (e.g. after a re-render), re-activate
    if (typeof window.convFilter !== 'undefined' && window.convFilter === 'chats') {
      tabBar.querySelectorAll('.mid-tab').forEach(function(b) { b.classList.remove('on'); });
      chatsBtn.classList.add('on');
      activateChatsTab();
    }
  }

  function activateChatsTab() {
    isActive = true;

    // Load conversations from chat API
    loadConversations().then(function() {
      renderChatsList();
    });

    // Clear the right panel to show empty state
    if (!currentConv) {
      renderEmptyState();
    }

    // Start polling
    startPolling();
  }

  function deactivate() {
    isActive = false;
    currentConv = null;
    messages = [];
    stopPolling();
  }

  // ── Polling ─────────────────────────────────────────

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(function() {
      if (!isActive) return;
      loadConversations().then(function() {
        renderChatsList();
      });
    }, 5000);
  }

  function startThreadPolling() {
    stopThreadPolling();
    if (!currentConv) return;
    threadPollTimer = setInterval(function() {
      if (!isActive || !currentConv) return;
      refreshThread();
    }, 3000);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    stopThreadPolling();
  }

  function stopThreadPolling() {
    if (threadPollTimer) {
      clearInterval(threadPollTimer);
      threadPollTimer = null;
    }
  }

  // ── Load Data ───────────────────────────────────────

  function loadConversations() {
    return api('GET', '/api/chat/conversations').then(function(data) {
      conversations = Array.isArray(data) ? data : (data.conversations || data || []);
    }).catch(function(e) {
      console.error('[ChatsTab] Load conversations error:', e);
      conversations = [];
    });
  }

  // ── Filtering ───────────────────────────────────────

  function getFilteredConversations() {
    var filtered = conversations.slice();

    // Sub-filter
    if (currentFilter === 'group_chats') {
      filtered = filtered.filter(function(c) {
        return c.type === 'client_group' || c.type === 'Client Group';
      });
    } else if (currentFilter === 'worker_conversations') {
      filtered = filtered.filter(function(c) {
        return c.type === 'direct' || c.type === 'Direct';
      });
    } else if (currentFilter === 'escalated') {
      filtered = filtered.filter(function(c) {
        return c.classification === 'incident' ||
               c.classification === 'shift_cover' ||
               c.classification === 'callback';
      });
    }

    // Search
    if (searchQuery) {
      filtered = filtered.filter(function(c) {
        return (c.title || '').toLowerCase().indexOf(searchQuery) >= 0 ||
               (c.client_name || '').toLowerCase().indexOf(searchQuery) >= 0 ||
               (c.worker_name || '').toLowerCase().indexOf(searchQuery) >= 0;
      });
    }

    return filtered;
  }

  // ── Render: Sub-filter Bar + Conversation List ──────

  function renderChatsList() {
    var list = document.getElementById('midList');
    if (!list) return;

    var html = '';

    // Sub-filter bar
    html += '<div class="chats-tab-subfilters">';
    html += renderSubFilterBtn('all', 'All');
    html += renderSubFilterBtn('group_chats', 'Group Chats');
    html += renderSubFilterBtn('worker_conversations', 'Worker Conversations');
    html += renderSubFilterBtn('escalated', 'Escalated');
    html += '</div>';

    // New Group button (for authorized roles)
    var user = window.currentUser || window._adminUser;
    if (user) {
      var staffRoles = ['superadmin', 'director', 'admin', 'team_leader', 'roster_officer', 'manager', 'ceo', 'office_staff'];
      if (staffRoles.indexOf(user.role) >= 0) {
        html += '<div class="chats-tab-actions">';
        html += '<button class="btn btn-teal" style="width:100%;padding:7px 12px;font-size:12px;font-weight:600" onclick="ChatsTab.showNewGroupModal()">+ New Group</button>';
        html += '</div>';
      }
    }

    var filtered = getFilteredConversations();

    if (filtered.length === 0) {
      html += '<div class="empty-state" style="padding:30px 20px"><p style="font-size:12px;color:var(--muted)">No conversations found</p></div>';
      list.innerHTML = html;
      return;
    }

    // Worker Conversations grouping
    if (currentFilter === 'worker_conversations') {
      html += renderWorkerGrouped(filtered);
    } else {
      filtered.forEach(function(c) {
        html += renderConvItem(c);
      });
    }

    list.innerHTML = html;

    // Attach click handlers
    list.querySelectorAll('.chats-tab-conv-item').forEach(function(el) {
      el.addEventListener('click', function() {
        var id = this.getAttribute('data-conv-id');
        if (id) openConversation(id);
      });
    });

    // Attach worker section toggle handlers
    list.querySelectorAll('.chats-tab-worker-header').forEach(function(el) {
      el.addEventListener('click', function() {
        var wid = this.getAttribute('data-worker-id');
        toggleWorkerSection(wid);
      });
    });
  }

  function renderSubFilterBtn(filter, label) {
    var cls = currentFilter === filter ? 'chats-tab-filter-btn active' : 'chats-tab-filter-btn';
    return '<button class="' + cls + '" onclick="ChatsTab._setFilter(\'' + filter + '\')">' + label + '</button>';
  }

  function renderConvItem(c) {
    var isActive = currentConv && currentConv.id === c.id;
    var initials = getInitialsFromTitle(c.title || c.client_name || c.worker_name || '?');
    var isGroup = c.type === 'client_group' || c.type === 'Client Group';
    var avatarClass = isGroup ? 'chats-tab-avatar group' : 'chats-tab-avatar direct';

    var time = '';
    if (c.last_message && c.last_message.created_at) {
      time = formatRelativeTime(c.last_message.created_at);
    } else if (c.updated_at) {
      time = formatRelativeTime(c.updated_at);
    }

    var preview = '';
    if (c.last_message) {
      var sender = c.last_message.sender_name ? (c.last_message.sender_name + ': ') : '';
      var content = c.last_message.content || '';
      preview = escapeHtml(sender + content.substring(0, 60));
    }

    var badge = '';
    if (c.unread_count && c.unread_count > 0) {
      badge = '<div class="chats-tab-badge">' + c.unread_count + '</div>';
    }

    var classDot = '';
    if (c.classification === 'incident') {
      classDot = '<span class="chats-tab-class-dot incident"></span>';
    } else if (c.classification === 'shift_cover') {
      classDot = '<span class="chats-tab-class-dot shift-cover"></span>';
    } else if (c.classification === 'callback') {
      classDot = '<span class="chats-tab-class-dot callback"></span>';
    }

    var memberInfo = '';
    if (isGroup && c.member_count) {
      memberInfo = '<span class="chats-tab-member-count">' + c.member_count + ' members</span>';
    }

    var html = '<div class="chats-tab-conv-item' + (isActive ? ' active' : '') + '" data-conv-id="' + c.id + '">';
    html += '<div class="' + avatarClass + '">' + escapeHtml(initials) + '</div>';
    html += '<div class="chats-tab-conv-info">';
    html += '<div class="chats-tab-conv-name">' + classDot + escapeHtml(c.title || c.client_name || c.worker_name || 'Chat') + '</div>';
    if (memberInfo) html += memberInfo;
    html += '<div class="chats-tab-conv-preview">' + preview + '</div>';
    html += '</div>';
    html += '<div class="chats-tab-conv-meta">';
    html += '<div class="chats-tab-conv-time">' + time + '</div>';
    html += badge;
    html += '</div>';
    html += '</div>';
    return html;
  }

  // ── Worker Conversations Grouping ───────────────────

  function renderWorkerGrouped(filtered) {
    // Group by worker
    var groups = {};
    filtered.forEach(function(c) {
      var wid = c.worker_id || c.id;
      var wname = c.worker_name || c.title || 'Unknown Worker';
      if (!groups[wid]) {
        groups[wid] = {
          worker_id: wid,
          worker_name: wname,
          conversations: [],
          last_activity: null
        };
      }
      groups[wid].conversations.push(c);
      var ts = c.updated_at || (c.last_message ? c.last_message.created_at : null);
      if (ts && (!groups[wid].last_activity || ts > groups[wid].last_activity)) {
        groups[wid].last_activity = ts;
      }
    });

    // Sort workers by last activity
    var sortedWorkers = Object.values(groups).sort(function(a, b) {
      return (b.last_activity || '').localeCompare(a.last_activity || '');
    });

    var html = '';
    sortedWorkers.forEach(function(w) {
      var expanded = workerSections[w.worker_id] !== false; // default expanded
      var lastActive = w.last_activity ? formatRelativeTime(w.last_activity) : '';

      html += '<div class="chats-tab-worker-section">';
      html += '<div class="chats-tab-worker-header' + (expanded ? ' expanded' : '') + '" data-worker-id="' + w.worker_id + '">';
      html += '<span class="chats-tab-worker-arrow">' + (expanded ? '&#9660;' : '&#9654;') + '</span>';
      html += '<span class="chats-tab-worker-name">' + escapeHtml(w.worker_name) + '</span>';
      html += '<span class="chats-tab-worker-count">' + w.conversations.length + ' conversation' + (w.conversations.length !== 1 ? 's' : '') + '</span>';
      if (lastActive) html += '<span class="chats-tab-worker-time">' + lastActive + '</span>';
      html += '</div>';

      if (expanded) {
        html += '<div class="chats-tab-worker-convos">';
        w.conversations.forEach(function(c) {
          html += renderConvItem(c);
        });
        html += '</div>';
      }

      html += '</div>';
    });

    return html;
  }

  function toggleWorkerSection(workerId) {
    if (workerSections[workerId] === undefined) {
      workerSections[workerId] = false; // collapse
    } else {
      workerSections[workerId] = !workerSections[workerId];
    }
    renderChatsList();
  }

  // ── Open Conversation / Thread ──────────────────────

  function openConversation(id) {
    currentConv = conversations.find(function(c) { return c.id === id; }) || { id: id };

    // Update sidebar selection
    renderChatsList();

    // Load thread into right panel
    loadThread(id);

    // Start thread polling
    startThreadPolling();
  }

  function loadThread(conversationId) {
    var rp = document.getElementById('rightPanel');
    if (!rp) return;
    rp.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted)"><div class="spin" style="width:24px;height:24px;border:3px solid var(--border);border-top-color:var(--teal);border-radius:50%"></div></div>';

    api('GET', '/api/chat/conversations/' + conversationId).then(function(data) {
      currentConv = data.conversation || currentConv;
      messages = data.messages || [];
      hasMore = data.has_more || false;
      renderThread();
    }).catch(function(e) {
      rp.innerHTML = '<div class="rp-empty" style="flex-direction:column"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--light)"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><div style="margin-top:8px">Error: ' + escapeHtml(e.message) + '</div></div>';
    });
  }

  function refreshThread() {
    if (!currentConv) return;
    api('GET', '/api/chat/conversations/' + currentConv.id).then(function(data) {
      currentConv = data.conversation || currentConv;
      messages = data.messages || [];
      hasMore = data.has_more || false;
      renderThread();
    }).catch(function() {
      // Silently fail on poll refresh
    });
  }

  function loadMore() {
    if (!hasMore || loading || messages.length === 0 || !currentConv) return;
    loading = true;
    var oldest = messages[0].created_at;
    api('GET', '/api/chat/conversations/' + currentConv.id + '?before=' + oldest).then(function(data) {
      var newMsgs = data.messages || [];
      hasMore = data.has_more || false;
      messages = newMsgs.concat(messages);
      renderThread();
      loading = false;
    }).catch(function(e) {
      console.error('[ChatsTab] Load more error:', e);
      loading = false;
    });
  }

  // ── Render Thread (Right Panel) ─────────────────────

  function renderThread() {
    var rp = document.getElementById('rightPanel');
    if (!rp || !currentConv) return;

    var conv = currentConv;
    var user = window.currentUser || window._adminUser || {};

    // ── Thread Header ──
    var statusBadge = '';
    if (conv.status === 'active') statusBadge = '<span class="chats-tab-status-badge active">Active</span>';
    else if (conv.status === 'archived') statusBadge = '<span class="chats-tab-status-badge archived">Archived</span>';

    var classBadge = '';
    if (conv.classification === 'incident') {
      classBadge = '<span class="chats-tab-status-badge incident">Incident' + (conv.incident_tier ? ' - ' + escapeHtml(conv.incident_tier) : '') + '</span>';
    } else if (conv.classification === 'shift_cover') {
      classBadge = '<span class="chats-tab-status-badge escalated">Shift Cover</span>';
    } else if (conv.classification === 'callback') {
      classBadge = '<span class="chats-tab-status-badge callback">Callback</span>';
    }

    var isGroup = conv.type === 'client_group' || conv.type === 'Client Group';
    var subtitle = isGroup
      ? 'Client group' + (conv.member_count ? ' - ' + conv.member_count + ' members' : '')
      : 'Direct conversation' + (conv.worker_name ? ' - ' + escapeHtml(conv.worker_name) : '');

    var html = '<div class="chats-tab-thread-header">';
    html += '<div class="chats-tab-thread-title-area">';
    html += '<div class="chats-tab-thread-title">' + escapeHtml(conv.title || 'Chat') + ' ' + statusBadge + ' ' + classBadge + '</div>';
    html += '<div class="chats-tab-thread-subtitle">' + subtitle + '</div>';
    html += '</div>';
    html += '<div class="chats-tab-thread-actions">';
    html += '<button class="btn btn-sm" style="background:var(--surface2);border:1px solid var(--border);font-size:11px;color:var(--text)" onclick="ChatsTab.toggleMembers()" title="Members">Members</button>';
    if (isGroup && conv.client_id) {
      html += '<button class="btn btn-sm" style="background:var(--surface2);border:1px solid var(--border);font-size:11px;color:var(--text)" onclick="ClientMediaAdmin.open(\'' + conv.client_id + '\')" title="Media">Media</button>';
    }
    html += '<button class="btn btn-sm" style="background:var(--surface2);border:1px solid var(--border);font-size:11px;color:var(--text)" onclick="ChatAdminControls.showDeletionLog(\'' + conv.id + '\')" title="Audit">Audit</button>';
    html += '</div>';
    html += '</div>';

    // ── Messages Area ──
    html += '<div class="rp-thread chats-tab-messages-area" id="chatsThreadMessages">';

    if (hasMore) {
      html += '<div style="text-align:center;padding:8px"><button class="btn btn-sm" style="background:var(--surface2);border:1px solid var(--border);font-size:11px" onclick="ChatsTab.loadMore()">Load earlier messages</button></div>';
    }

    var prevDate = null;
    messages.forEach(function(msg, i) {
      // Date separator
      var msgDate = msg.created_at ? formatDateLabel(msg.created_at) : '';
      if (msgDate && msgDate !== prevDate) {
        html += '<div class="thread-date" style="text-align:center;padding:8px 0;font-size:10px;color:var(--muted);font-weight:600">' + msgDate + '</div>';
        prevDate = msgDate;
      }
      html += renderMessage(msg, user, conv);
    });

    html += '</div>';

    rp.innerHTML = html;

    // Scroll to bottom
    var area = document.getElementById('chatsThreadMessages');
    if (area) area.scrollTop = area.scrollHeight;
  }

  function renderMessage(msg, user, conv) {
    // Deleted message
    if (msg.deleted || msg.deleted_placeholder) {
      return '<div class="chats-tab-msg-bubble deleted" style="text-align:center;font-style:italic;color:var(--muted);font-size:12px;padding:6px 0;max-width:100%">' +
        escapeHtml(msg.deleted_placeholder || 'This message was removed') + '</div>';
    }

    // System message
    if (msg.sender_type === 'system') {
      return '<div class="chats-tab-msg-bubble system" style="text-align:center;font-size:11px;color:var(--muted);padding:4px 0;max-width:100%">' +
        escapeHtml(msg.content) + '</div>';
    }

    // AI message
    if (msg.sender_type === 'ai') {
      return '<div class="chats-tab-msg-bubble ai">' +
        '<div style="font-size:10px;font-weight:700;color:#7C3AED;margin-bottom:2px">Titus AI</div>' +
        '<div>' + formatContent(msg.content) + '</div>' +
        renderAttachments(msg) +
        '<div style="font-size:10px;opacity:.6;margin-top:2px;text-align:right">' + formatMsgTime(msg.created_at) + '</div>' +
      '</div>';
    }

    // Regular message
    var isSent = String(msg.sender_id) === String(user.id);
    var bubbleClass = isSent ? 'chats-tab-msg-bubble sent' : 'chats-tab-msg-bubble received';
    var isGroup = conv.type === 'client_group' || conv.type === 'Client Group';

    var html = '<div class="msg-row' + (isSent ? ' out' : '') + '">';

    // Avatar for received messages
    if (!isSent) {
      var initials = getInitialsFromTitle(msg.sender_name || '?');
      html += '<div class="msg-ava">' + escapeHtml(initials) + '</div>';
    }

    html += '<div><div class="' + bubbleClass + '" style="position:relative">';

    // Delete button on hover (for admin roles)
    var staffRoles = ['superadmin', 'director', 'admin', 'team_leader', 'roster_officer', 'manager', 'ceo', 'office_staff'];
    if (user.role && staffRoles.indexOf(user.role) >= 0) {
      html += '<div class="chats-tab-msg-hover-actions">' +
        '<button class="chats-tab-msg-delete-btn" onclick="event.stopPropagation();ChatAdminControls.deleteMessage(\'' + msg.id + '\',\'' + msg.conversation_id + '\')" title="Delete message">&#128465;</button>' +
      '</div>';
    }

    // Sender name for group received messages
    if (!isSent && isGroup && msg.sender_name) {
      html += '<div style="font-size:11px;font-weight:600;color:var(--teal);margin-bottom:2px">' + escapeHtml(msg.sender_name) + '</div>';
    }

    // Content
    if (msg.content) {
      html += '<div>' + formatContent(msg.content) + '</div>';
    }

    // Attachments
    html += renderAttachments(msg);

    // Time
    html += '<div class="msg-meta"><span class="msg-type-badge" style="background:rgba(13,148,136,.08);color:var(--teal)">Chat</span> ' + formatMsgTime(msg.created_at) + '</div>';

    html += '</div></div>';

    // Avatar for sent messages
    if (isSent) {
      var senderInitials = getInitialsFromTitle(user.name || '?');
      html += '<div class="msg-ava">' + escapeHtml(senderInitials) + '</div>';
    }

    html += '</div>';
    return html;
  }

  function renderAttachments(msg) {
    if (!msg.attachments || !Array.isArray(msg.attachments) || msg.attachments.length === 0) return '';

    var html = '';
    msg.attachments.forEach(function(a) {
      if (a.file_category === 'image') {
        var src = a.thumbnail_url || a.file_url;
        html += '<img src="' + src + '" alt="' + escapeHtml(a.filename || 'image') + '" ' +
          'style="max-width:200px;border-radius:6px;cursor:pointer;margin-top:4px;display:block" ' +
          'onclick="event.stopPropagation();ChatsTab._openLightbox(\'' + (a.file_url || src) + '\')" loading="lazy">';
      } else if (a.file_category === 'video') {
        html += '<div class="chats-tab-msg-attachment" onclick="event.stopPropagation();window.open(\'' + a.file_url + '\',\'_blank\')">' +
          '<span style="font-size:18px">&#127916;</span>' +
          '<span>' + escapeHtml(a.filename || 'video') + '</span>' +
        '</div>';
      } else {
        html += '<div class="chats-tab-msg-attachment" onclick="event.stopPropagation();window.open(\'' + a.file_url + '\',\'_blank\')">' +
          '<span style="font-size:18px">&#128196;</span>' +
          '<span>' + escapeHtml(a.filename || 'file') + '</span>' +
        '</div>';
      }
    });
    return html;
  }

  function renderEmptyState() {
    var rp = document.getElementById('rightPanel');
    if (!rp) return;
    rp.innerHTML = '<div class="rp-empty"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--light)"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Select a chat conversation to view the thread</div>';
  }

  // ── Member Panel ────────────────────────────────────

  function toggleMembers() {
    // Use a member panel overlay in the right panel area
    var rp = document.getElementById('rightPanel');
    if (!rp || !currentConv) return;

    // Check if member panel is already showing
    var existingPanel = document.getElementById('chatsTabMemberPanel');
    if (existingPanel) {
      existingPanel.remove();
      return;
    }

    var panel = document.createElement('div');
    panel.id = 'chatsTabMemberPanel';
    panel.className = 'chats-tab-member-panel';
    panel.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;padding:20px;color:var(--muted)"><div class="spin" style="width:20px;height:20px;border:2px solid var(--border);border-top-color:var(--teal);border-radius:50%"></div></div>';
    rp.appendChild(panel);

    api('GET', '/api/chat/conversations/' + currentConv.id + '/members').then(function(members) {
      if (!Array.isArray(members)) members = members.members || [];
      var active = members.filter(function(m) { return m.active !== false; });
      var former = members.filter(function(m) { return m.active === false; });

      var html = '<div class="chats-tab-member-panel-header">';
      html += '<h3 style="font-size:14px;font-weight:700">Members (' + active.length + ')</h3>';
      html += '<button style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--muted);padding:4px" onclick="ChatsTab.toggleMembers()">&#10005;</button>';
      html += '</div>';

      html += '<div style="padding:6px 12px"><button class="btn btn-teal btn-sm" onclick="ChatsTab.showAddMemberUI()" style="width:100%;font-size:11px">+ Add Member</button></div>';
      html += '<div id="chatsTabAddMemberArea"></div>';

      html += '<div class="chats-tab-member-list">';
      active.forEach(function(m) {
        var initials = getInitialsFromTitle(m.user_name || '?');
        html += '<div class="chats-tab-member-item">';
        html += '<div class="chats-tab-member-avatar">' + escapeHtml(initials) + '</div>';
        html += '<div class="chats-tab-member-name">' + escapeHtml(m.user_name || 'Unknown') + '</div>';
        html += '<span class="chats-tab-member-role">' + escapeHtml(m.role || 'member') + '</span>';
        html += '<button class="chats-tab-member-remove" onclick="ChatsTab.removeMember(\'' + m.user_id + '\',\'' + escapeHtml(m.user_name || '') + '\')" title="Remove">&#10005;</button>';
        html += '</div>';
      });

      if (former.length > 0) {
        html += '<div style="padding:6px 12px;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-top:8px">Former Members</div>';
        former.forEach(function(m) {
          var initials = getInitialsFromTitle(m.user_name || '?');
          html += '<div class="chats-tab-member-item" style="opacity:.5">';
          html += '<div class="chats-tab-member-avatar" style="background:var(--muted)">' + escapeHtml(initials) + '</div>';
          html += '<div class="chats-tab-member-name">' + escapeHtml(m.user_name || 'Unknown') + '</div>';
          html += '<span class="chats-tab-member-role">' + escapeHtml(m.removed_reason || 'removed') + '</span>';
          html += '</div>';
        });
      }

      html += '</div>';
      panel.innerHTML = html;
    }).catch(function(e) {
      panel.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:12px">Error: ' + escapeHtml(e.message) + '</div>';
    });
  }

  function showAddMemberUI() {
    var area = document.getElementById('chatsTabAddMemberArea');
    if (!area) return;
    area.innerHTML = '<div style="padding:6px 12px">' +
      '<input type="text" id="chatsTabMemberName" placeholder="Worker name..." style="width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:var(--rs,6px);font-size:12px;margin-bottom:4px;outline:none;font-family:inherit">' +
      '<input type="text" id="chatsTabMemberId" placeholder="Worker ID..." style="width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:var(--rs,6px);font-size:12px;margin-bottom:4px;outline:none;font-family:inherit">' +
      '<button class="btn btn-teal btn-sm" onclick="ChatsTab.addMember()" style="width:100%;font-size:11px">Add</button>' +
    '</div>';
  }

  function addMember() {
    var nameEl = document.getElementById('chatsTabMemberName');
    var idEl = document.getElementById('chatsTabMemberId');
    if (!nameEl || !idEl || !currentConv) return;
    var name = nameEl.value.trim();
    var uid = idEl.value.trim();
    if (!name || !uid) { alert('Name and ID required'); return; }

    api('POST', '/api/chat/conversations/' + currentConv.id + '/members', {
      user_id: uid,
      user_name: name,
      user_type: 'worker'
    }).then(function() {
      // Close and reopen member panel to refresh
      toggleMembers();
      setTimeout(function() { toggleMembers(); }, 150);
    }).catch(function(e) {
      alert('Error: ' + e.message);
    });
  }

  function removeMember(userId, userName) {
    if (!confirm('Remove ' + userName + ' from this group?')) return;
    if (!currentConv) return;

    api('DELETE', '/api/chat/conversations/' + currentConv.id + '/members/' + userId).then(function() {
      toggleMembers();
      setTimeout(function() { toggleMembers(); }, 150);
    }).catch(function(e) {
      alert('Error: ' + e.message);
    });
  }

  // ── New Group Modal ─────────────────────────────────

  function showNewGroupModal() {
    var overlay = document.createElement('div');
    overlay.className = 'chats-tab-modal-overlay';
    overlay.id = 'chatsTabNewGroupModal';

    overlay.innerHTML = '<div class="chats-tab-modal">' +
      '<div class="chats-tab-modal-header">' +
        '<h2 style="font-size:16px;font-weight:700">Create Client Group</h2>' +
        '<button style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted);padding:4px" onclick="ChatsTab.closeNewGroupModal()">&#10005;</button>' +
      '</div>' +
      '<div class="chats-tab-modal-body">' +
        '<div class="chats-tab-form-group"><label>Client Name *</label><input type="text" id="chatsTabNgClientName" placeholder="e.g. John Smith"></div>' +
        '<div class="chats-tab-form-group"><label>Client ID *</label><input type="text" id="chatsTabNgClientId" placeholder="Airtable record ID or reference"></div>' +
        '<div class="chats-tab-form-group"><label>Add Members (optional)</label>' +
          '<div style="display:flex;gap:4px">' +
            '<input type="text" id="chatsTabNgMemberName" placeholder="Name" style="flex:1">' +
            '<input type="text" id="chatsTabNgMemberId" placeholder="ID" style="flex:1">' +
            '<button class="btn btn-sm" style="background:var(--surface2);border:1px solid var(--border)" onclick="ChatsTab.addGroupMember()">+</button>' +
          '</div>' +
          '<div class="chats-tab-selected-members" id="chatsTabNgMembers"></div>' +
        '</div>' +
      '</div>' +
      '<div class="chats-tab-modal-footer">' +
        '<button class="btn btn-sm" style="background:var(--surface2);border:1px solid var(--border)" onclick="ChatsTab.closeNewGroupModal()">Cancel</button>' +
        '<button class="btn btn-teal btn-sm" onclick="ChatsTab.createGroup()">Create Group</button>' +
      '</div>' +
    '</div>';

    document.body.appendChild(overlay);
    window._chatsTabNewGroupMembers = [];
  }

  function closeNewGroupModal() {
    var modal = document.getElementById('chatsTabNewGroupModal');
    if (modal) modal.remove();
    window._chatsTabNewGroupMembers = [];
  }

  function addGroupMember() {
    var nameEl = document.getElementById('chatsTabNgMemberName');
    var idEl = document.getElementById('chatsTabNgMemberId');
    if (!nameEl || !idEl) return;
    var name = nameEl.value.trim();
    var uid = idEl.value.trim();
    if (!name || !uid) return;

    window._chatsTabNewGroupMembers = window._chatsTabNewGroupMembers || [];
    window._chatsTabNewGroupMembers.push({ user_id: uid, user_name: name, user_type: 'worker' });

    nameEl.value = '';
    idEl.value = '';

    renderGroupMembers();
  }

  function removeGroupMember(index) {
    window._chatsTabNewGroupMembers.splice(index, 1);
    renderGroupMembers();
  }

  function renderGroupMembers() {
    var list = document.getElementById('chatsTabNgMembers');
    if (!list) return;
    var members = window._chatsTabNewGroupMembers || [];
    var html = '';
    members.forEach(function(m, i) {
      html += '<span class="chats-tab-selected-tag">' + escapeHtml(m.user_name) +
        '<button onclick="ChatsTab.removeGroupMember(' + i + ')">&#10005;</button></span>';
    });
    list.innerHTML = html;
  }

  function createGroup() {
    var nameEl = document.getElementById('chatsTabNgClientName');
    var idEl = document.getElementById('chatsTabNgClientId');
    if (!nameEl || !idEl) return;
    var clientName = nameEl.value.trim();
    var clientId = idEl.value.trim();
    if (!clientName || !clientId) { alert('Client name and ID required'); return; }

    api('POST', '/api/chat/conversations/group', {
      client_id: clientId,
      client_name: clientName,
      member_ids: window._chatsTabNewGroupMembers || []
    }).then(function(conv) {
      closeNewGroupModal();
      return loadConversations().then(function() {
        renderChatsList();
        if (conv && conv.id) openConversation(conv.id);
      });
    }).catch(function(e) {
      alert('Error: ' + e.message);
    });
  }

  // ── Lightbox ────────────────────────────────────────

  function _openLightbox(url) {
    // Use the existing global lightbox if available
    if (typeof window.openLightbox === 'function') {
      window.openLightbox(url);
      return;
    }
    // Fallback: open in new tab
    window.open(url, '_blank');
  }

  // ── Helpers ─────────────────────────────────────────

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatContent(text) {
    if (!text) return '';
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  function formatMsgTime(dateStr) {
    if (!dateStr) return '';
    try {
      var tz = (typeof AU_TIMEZONES !== 'undefined' && typeof getAppTimezone === 'function')
        ? (AU_TIMEZONES[getAppTimezone()] || 'Australia/Brisbane')
        : 'Australia/Brisbane';
      return new Date(dateStr).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: tz });
    } catch (e) {
      return new Date(dateStr).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
    }
  }

  function formatDateLabel(dateStr) {
    if (!dateStr) return '';
    try {
      var tz = (typeof AU_TIMEZONES !== 'undefined' && typeof getAppTimezone === 'function')
        ? (AU_TIMEZONES[getAppTimezone()] || 'Australia/Brisbane')
        : 'Australia/Brisbane';
      var d = new Date(dateStr);
      var now = new Date();

      // Use TitusDate if available
      if (typeof TitusDate !== 'undefined' && typeof TitusDate.formatInTZ === 'function') {
        var dStr = TitusDate.formatInTZ(dateStr, tz);
        var nowStr = TitusDate.formatInTZ(now, tz);
        if (dStr === nowStr) return 'Today';
        var yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        var yStr = TitusDate.formatInTZ(yesterday, tz);
        if (dStr === yStr) return 'Yesterday';
      } else {
        // Simple same-day check
        if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()) return 'Today';
        var yest = new Date(now);
        yest.setDate(yest.getDate() - 1);
        if (d.getFullYear() === yest.getFullYear() && d.getMonth() === yest.getMonth() && d.getDate() === yest.getDate()) return 'Yesterday';
      }

      return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz });
    } catch (e) {
      return new Date(dateStr).toLocaleDateString('en-AU');
    }
  }

  function formatRelativeTime(dateStr) {
    if (!dateStr) return '';
    try {
      // Reuse existing fmtTime if available
      if (typeof window.fmtTime === 'function') return window.fmtTime(dateStr);

      var d = new Date(dateStr);
      var now = new Date();
      var diff = now - d;
      if (diff < 60000) return 'now';
      if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
      if (diff < 86400000 && d.getDate() === now.getDate()) {
        return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: 'Australia/Brisbane' });
      }
      if (diff < 604800000) {
        return d.toLocaleDateString('en-AU', { weekday: 'short', timeZone: 'Australia/Brisbane' });
      }
      return d.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', timeZone: 'Australia/Brisbane' });
    } catch (e) {
      return '';
    }
  }

  function getInitialsFromTitle(name) {
    // Reuse existing getInitials if available
    if (typeof window.getInitials === 'function') return window.getInitials(name);

    if (!name || typeof name !== 'string') return '?';
    var n = name.trim();
    if (!n) return '?';
    var parts = n.split(' ').filter(function(p) { return p.length > 0; });
    if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return n.substring(0, 2).toUpperCase();
  }

  // ── Internal filter setter (called from onclick) ────

  function _setFilter(filter) {
    currentFilter = filter;
    renderChatsList();
  }

  // ── Public API ──────────────────────────────────────

  return {
    init: init,
    loadConversations: loadConversations,
    openConversation: openConversation,
    loadMore: loadMore,
    toggleMembers: toggleMembers,
    showAddMemberUI: showAddMemberUI,
    addMember: addMember,
    removeMember: removeMember,
    showNewGroupModal: showNewGroupModal,
    closeNewGroupModal: closeNewGroupModal,
    addGroupMember: addGroupMember,
    removeGroupMember: removeGroupMember,
    createGroup: createGroup,
    api: api,
    escapeHtml: escapeHtml,
    getToken: getToken,
    getCurrentConv: function() { return currentConv; },
    refreshThread: refreshThread,
    deactivate: deactivate,
    _setFilter: _setFilter,
    _openLightbox: _openLightbox
  };
})();
