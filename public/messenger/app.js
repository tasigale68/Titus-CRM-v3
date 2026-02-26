// Titus Messenger - Main app controller
var App = (function() {
  'use strict';

  var currentUser = null;
  var conversations = [];
  var currentConversation = null;
  var currentTab = 'all'; // 'all', 'chats', 'my_messages'
  var pollTimer = null;
  var threadPollTimer = null;

  // Roles that can manage members (same list used by Chat.js)
  var staffRoles = ['superadmin', 'director', 'admin', 'team_leader', 'roster_officer', 'manager', 'ceo', 'office_staff'];

  // ─── API Helpers ──────────────────────────────────────────────────

  function getToken() {
    return localStorage.getItem('titus_token') || '';
  }

  async function api(method, path, body) {
    var opts = {
      method: method,
      headers: {
        'Authorization': 'Bearer ' + getToken(),
        'Content-Type': 'application/json'
      }
    };
    if (body && method !== 'GET') {
      opts.body = JSON.stringify(body);
    }
    var res = await fetch(path, opts);
    if (res.status === 401) {
      window.location.href = '/';
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      var err;
      try { err = await res.json(); } catch (e) { err = { error: res.statusText }; }
      throw new Error(err.error || err.message || res.statusText);
    }
    return res.json();
  }

  async function apiUpload(path, formData) {
    var res = await fetch(path, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + getToken() },
      body: formData
    });
    if (res.status === 401) {
      window.location.href = '/';
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      var err;
      try { err = await res.json(); } catch (e) { err = { error: res.statusText }; }
      throw new Error(err.error || err.message || res.statusText);
    }
    return res.json();
  }

  // ─── Initialization ───────────────────────────────────────────────

  async function init() {
    // Check authentication
    try {
      var data = await api('GET', '/api/auth/me');
      if (!data || !data.user) {
        window.location.href = '/';
        return;
      }
      currentUser = data.user;
    } catch (e) {
      window.location.href = '/';
      return;
    }

    // Show user name in header
    var userNameEl = document.getElementById('user-name');
    if (userNameEl) {
      userNameEl.textContent = currentUser.name || currentUser.email || '';
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/messenger/sw.js');
        navigator.serviceWorker.addEventListener('message', handleSWMessage);
      } catch (e) {
        console.error('[SW] Registration failed:', e);
      }
    }

    // Init push notifications
    try {
      var pushReady = await PushNotifications.init();
      if (pushReady) await PushNotifications.subscribe();
    } catch (e) {
      console.log('[Push] Init skipped:', e.message);
    }

    // Init voice input
    var micBtn = document.getElementById('mic-btn');
    var textInput = document.getElementById('msg-input');
    if (micBtn && textInput) {
      var supported = VoiceInput.init(textInput, micBtn);
      if (!supported) micBtn.style.display = 'none';
    }

    // Init attachments
    var previewEl = document.getElementById('attachment-previews');
    if (previewEl) Attachments.init(previewEl);

    // Setup input handlers
    setupInputHandlers();

    // Load conversations
    await loadConversations();
    renderConversationList();

    // Start polling
    startPolling();

    // Visibility change: stop polling when backgrounded, resume on focus
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        stopPolling();
      } else {
        startPolling();
        loadConversations().then(function() { renderConversationList(); });
      }
    });

    // Handle hash navigation
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
  }

  // ─── Polling ──────────────────────────────────────────────────────

  function startPolling() {
    stopPolling();
    // Poll conversations every 5 seconds
    pollTimer = setInterval(function() {
      loadConversations().then(function() { renderConversationList(); });
    }, 5000);
    // Poll active thread every 3 seconds
    threadPollTimer = setInterval(function() {
      if (currentConversation) {
        pollActiveThread();
      }
    }, 3000);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (threadPollTimer) { clearInterval(threadPollTimer); threadPollTimer = null; }
  }

  async function pollActiveThread() {
    if (!currentConversation) return;
    try {
      var data = await api('GET', '/api/chat/conversations/' + currentConversation.id);
      var newMessages = data.messages || [];
      if (newMessages.length > 0) {
        // Append only messages we don't have yet
        newMessages.forEach(function(msg) {
          Chat.appendMessage(msg);
        });
      }
    } catch (e) {
      // Silently ignore poll errors
    }
  }

  // ─── Service Worker Messages ──────────────────────────────────────

  function handleSWMessage(event) {
    if (event.data && event.data.type === 'open_conversation') {
      openConversation(event.data.conversationId);
    }
  }

  // ─── Conversations ────────────────────────────────────────────────

  async function loadConversations() {
    try {
      var data = await api('GET', '/api/chat/conversations');
      conversations = Array.isArray(data) ? data : (data.conversations || []);
    } catch (e) {
      console.error('[App] Load conversations error:', e);
    }
  }

  function renderConversationList() {
    var list = document.getElementById('conv-list');
    if (!list) return;

    // Filter based on current tab
    var filtered;
    if (currentTab === 'chats') {
      filtered = conversations.filter(function(c) {
        return c.display_section === 'group_chats' || c.type === 'Client Group' || c.type === 'client_group';
      });
    } else if (currentTab === 'my_messages') {
      filtered = conversations.filter(function(c) {
        return c.display_section === 'worker_conversations' || c.type === 'Direct' || c.type === 'direct';
      });
    } else {
      filtered = conversations;
    }

    var html = '';

    if (currentTab === 'all') {
      // Render with section headers
      var chats = conversations.filter(function(c) {
        return c.display_section === 'group_chats' || c.type === 'Client Group' || c.type === 'client_group';
      });
      var directs = conversations.filter(function(c) {
        return c.display_section === 'worker_conversations' || c.type === 'Direct' || c.type === 'direct';
      });

      if (chats.length > 0) {
        html += '<div class="conv-section-title">CHATS</div>';
        chats.forEach(function(c) { html += renderConvItem(c); });
      }

      html += '<div class="conv-section-title">MY CONVERSATIONS</div>';

      // Message Office button for workers only
      if (!staffRoles.includes(currentUser.role)) {
        html += '<button class="msg-office-btn" onclick="App.messageOffice()">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 15C21 15.53 20.79 16.04 20.41 16.41C20.04 16.79 19.53 17 19 17H7L3 21V5C3 4.47 3.21 3.96 3.59 3.59C3.96 3.21 4.47 3 5 3H19C19.53 3 20.04 3.21 20.41 3.59C20.79 3.96 21 4.47 21 5V15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          ' Message Office</button>';
      }

      if (directs.length === 0) {
        html += '<div class="empty-state" style="padding:24px"><p>No conversations yet</p></div>';
      } else {
        directs.forEach(function(c) { html += renderConvItem(c); });
      }

    } else if (currentTab === 'chats') {
      if (filtered.length === 0) {
        html += '<div class="empty-state" style="padding:40px"><p>No group chats</p></div>';
      } else {
        filtered.forEach(function(c) { html += renderConvItem(c); });
      }

    } else if (currentTab === 'my_messages') {
      // Message Office button for workers
      if (!staffRoles.includes(currentUser.role)) {
        html += '<button class="msg-office-btn" onclick="App.messageOffice()">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 15C21 15.53 20.79 16.04 20.41 16.41C20.04 16.79 19.53 17 19 17H7L3 21V5C3 4.47 3.21 3.96 3.59 3.59C3.96 3.21 4.47 3 5 3H19C19.53 3 20.04 3.21 20.41 3.59C20.79 3.96 21 4.47 21 5V15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          ' Message Office</button>';
      }
      if (filtered.length === 0) {
        html += '<div class="empty-state" style="padding:40px"><p>No direct messages</p></div>';
      } else {
        filtered.forEach(function(c) { html += renderConvItem(c); });
      }
    }

    list.innerHTML = html;
  }

  function renderConvItem(c) {
    var title = c.title || 'Untitled';
    var initials = title.substring(0, 2).toUpperCase();
    var isGroup = c.type === 'client_group' || c.type === 'Client Group' || c.display_section === 'group_chats';
    var avatarClass = isGroup ? 'conv-avatar' : 'conv-avatar direct';

    // Time
    var time = '';
    if (c.last_message && c.last_message.created_at) {
      time = formatTime(c.last_message.created_at);
    } else if (c.updated_at) {
      time = formatTime(c.updated_at);
    }

    // Preview text
    var preview = '';
    if (c.last_message) {
      var senderPrefix = c.last_message.sender_name ? c.last_message.sender_name + ': ' : '';
      if (c.last_message.content) {
        preview = senderPrefix + c.last_message.content.substring(0, 60);
      } else if (c.last_message.has_attachments) {
        var typeLabel = 'Attachment';
        if (c.last_message.attachment_type === 'image') typeLabel = 'Photo';
        else if (c.last_message.attachment_type === 'video') typeLabel = 'Video';
        else if (c.last_message.attachment_type === 'document') typeLabel = 'Document';
        preview = senderPrefix + typeLabel;
      }
    }

    // Unread badge
    var badge = '';
    if (c.unread_count && c.unread_count > 0) {
      badge = '<div class="conv-badge">' + (c.unread_count > 99 ? '99+' : c.unread_count) + '</div>';
    }

    // Member count for groups
    var membersText = '';
    if (isGroup && c.member_count) {
      membersText = '<div class="conv-members">' + c.member_count + ' members</div>';
    }

    return '<div class="conv-item" onclick="App.openConversation(\'' + c.id + '\')">' +
      '<div class="' + avatarClass + '">' + escapeHtml(initials) + '</div>' +
      '<div class="conv-info">' +
        '<div class="conv-name">' + escapeHtml(title) + '</div>' +
        '<div class="conv-preview">' + escapeHtml(preview) + '</div>' +
        membersText +
      '</div>' +
      '<div class="conv-meta">' +
        '<div class="conv-time">' + time + '</div>' +
        badge +
      '</div>' +
    '</div>';
  }

  // ─── Tab Switching ────────────────────────────────────────────────

  function switchTab(tab) {
    currentTab = tab;
    // Update active tab styling
    var tabs = document.querySelectorAll('.tab-bar .tab');
    tabs.forEach(function(t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === tab);
    });
    renderConversationList();
  }

  // ─── Conversation Actions ─────────────────────────────────────────

  async function openConversation(id) {
    var conv = null;
    for (var i = 0; i < conversations.length; i++) {
      if (String(conversations[i].id) === String(id)) {
        conv = conversations[i];
        break;
      }
    }
    currentConversation = conv || { id: id };
    window.location.hash = 'chat/' + id;
    showChatView();
    await Chat.load(id);
  }

  async function messageOffice() {
    try {
      var conv = await api('POST', '/api/chat/conversations/direct', {
        worker_id: String(currentUser.id),
        worker_name: currentUser.name || currentUser.email
      });
      await loadConversations();
      renderConversationList();
      openConversation(conv.id);
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  // ─── View Toggling ────────────────────────────────────────────────

  function showChatView() {
    var listView = document.getElementById('list-view');
    var chatView = document.getElementById('chat-view');
    var tabBar = document.getElementById('tab-bar');
    var headerBackBtn = document.getElementById('header-back-btn');

    if (listView) listView.style.display = 'none';
    if (tabBar) tabBar.style.display = 'none';
    if (chatView) chatView.classList.add('active');
    if (headerBackBtn) headerBackBtn.style.display = 'flex';
  }

  function showListView() {
    var listView = document.getElementById('list-view');
    var chatView = document.getElementById('chat-view');
    var tabBar = document.getElementById('tab-bar');
    var headerBackBtn = document.getElementById('header-back-btn');

    if (listView) listView.style.display = '';
    if (tabBar) tabBar.style.display = '';
    if (chatView) chatView.classList.remove('active');
    if (headerBackBtn) headerBackBtn.style.display = 'none';

    currentConversation = null;
    window.location.hash = '';

    // Clear input state
    var input = document.getElementById('msg-input');
    if (input) { input.value = ''; input.style.height = 'auto'; }
    Attachments.clear();
    var sendBtn = document.getElementById('send-btn');
    if (sendBtn) sendBtn.classList.remove('visible');

    // Refresh list
    loadConversations().then(function() { renderConversationList(); });
  }

  // ─── Hash Routing ─────────────────────────────────────────────────

  function handleRoute() {
    var hash = window.location.hash.slice(1);
    if (hash.startsWith('chat/')) {
      var id = hash.split('/')[1];
      if (id && (!currentConversation || String(currentConversation.id) !== String(id))) {
        openConversation(id);
      }
    } else {
      if (currentConversation) showListView();
    }
  }

  // ─── Input Handling ───────────────────────────────────────────────

  function setupInputHandlers() {
    var input = document.getElementById('msg-input');
    var sendBtn = document.getElementById('send-btn');

    if (input) {
      input.addEventListener('input', function() {
        // Auto-expand textarea
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 100) + 'px';
        // Show/hide send button
        if (sendBtn) {
          var hasContent = input.value.trim().length > 0 || Attachments.hasFiles();
          sendBtn.classList.toggle('visible', hasContent);
        }
      });
    }

    // File input change
    var fileInput = document.getElementById('file-input');
    if (fileInput) {
      fileInput.addEventListener('change', function() {
        if (fileInput.files.length > 0) {
          var errors = Attachments.addFiles(fileInput.files);
          if (errors.length > 0) alert(errors.join('\n'));
          fileInput.value = '';
          if (sendBtn) sendBtn.classList.toggle('visible', true);
        }
      });
    }
  }

  // ─── Send Message ─────────────────────────────────────────────────

  async function sendMessage() {
    var input = document.getElementById('msg-input');
    var content = input ? input.value.trim() : '';
    if (!content && !Attachments.hasFiles()) return;
    if (!currentConversation) return;

    var sendBtn = document.getElementById('send-btn');
    if (sendBtn) { sendBtn.disabled = true; sendBtn.classList.add('sending'); }

    try {
      if (Attachments.hasFiles()) {
        // Upload with attachments
        var formData = new FormData();
        formData.append('conversation_id', currentConversation.id);
        if (content) formData.append('content', content);
        var files = Attachments.getFiles();
        for (var i = 0; i < files.length; i++) {
          formData.append('files', files[i]);
        }
        await apiUpload('/api/chat/attachment', formData);
        Attachments.clear();
      } else {
        // Text only
        await api('POST', '/api/chat/message', {
          conversation_id: currentConversation.id,
          content: content
        });
      }

      // Clear input
      if (input) {
        input.value = '';
        input.style.height = 'auto';
      }
      if (sendBtn) sendBtn.classList.remove('visible');

    } catch (e) {
      alert('Failed to send: ' + e.message);
    }

    if (sendBtn) { sendBtn.disabled = false; sendBtn.classList.remove('sending'); }
  }

  // ─── Utility Functions ────────────────────────────────────────────

  function formatTime(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    var now = new Date();
    var today = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Brisbane' }));
    var dateInBris = new Date(d.toLocaleString('en-US', { timeZone: 'Australia/Brisbane' }));

    // Same day
    if (dateInBris.getFullYear() === today.getFullYear() &&
        dateInBris.getMonth() === today.getMonth() &&
        dateInBris.getDate() === today.getDate()) {
      return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: 'Australia/Brisbane' });
    }

    // Yesterday
    var yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateInBris.getFullYear() === yesterday.getFullYear() &&
        dateInBris.getMonth() === yesterday.getMonth() &&
        dateInBris.getDate() === yesterday.getDate()) {
      return 'Yesterday';
    }

    // Within last 7 days
    var diff = now - d;
    if (diff < 604800000) {
      return d.toLocaleDateString('en-AU', { weekday: 'short', timeZone: 'Australia/Brisbane' });
    }

    // Older
    return d.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', timeZone: 'Australia/Brisbane' });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ─── Accessors ────────────────────────────────────────────────────

  function getUser() { return currentUser; }
  function getConversations() { return conversations; }
  function getCurrentConversation() { return currentConversation; }

  // ─── Public API ───────────────────────────────────────────────────

  return {
    init: init,
    api: api,
    apiUpload: apiUpload,
    getToken: getToken,
    loadConversations: loadConversations,
    renderConversationList: renderConversationList,
    openConversation: openConversation,
    messageOffice: messageOffice,
    switchTab: switchTab,
    showListView: showListView,
    showChatView: showChatView,
    sendMessage: sendMessage,
    formatTime: formatTime,
    escapeHtml: escapeHtml,
    getUser: getUser,
    getConversations: getConversations,
    getCurrentConversation: getCurrentConversation
  };
})();

// Boot the app
document.addEventListener('DOMContentLoaded', function() {
  App.init();
});
