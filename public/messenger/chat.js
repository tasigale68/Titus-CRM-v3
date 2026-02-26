// Chat thread rendering and interaction
var Chat = (function() {
  'use strict';

  var messages = [];
  var conversationData = null;
  var hasMore = false;
  var loading = false;

  // Roles that can manage members (add/remove)
  var staffRoles = ['superadmin', 'director', 'admin', 'team_leader', 'roster_officer', 'manager', 'ceo', 'office_staff'];

  async function load(conversationId) {
    var container = document.getElementById('messages');
    if (!container) return;

    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    messages = [];
    conversationData = null;
    hasMore = false;

    try {
      var data = await App.api('GET', '/api/chat/conversations/' + conversationId);
      conversationData = data.conversation;
      messages = data.messages || [];
      hasMore = !!data.has_more;

      // Update chat header
      var titleEl = document.getElementById('chat-title');
      var subEl = document.getElementById('chat-subtitle');
      if (titleEl) titleEl.textContent = conversationData.title || 'Chat';
      if (subEl) {
        if (conversationData.type === 'client_group') {
          var memberCount = conversationData.member_count || '';
          subEl.textContent = memberCount ? memberCount + ' members' : 'Client group';
        } else if (conversationData.type === 'direct' || conversationData.type === 'Direct') {
          subEl.textContent = 'Direct conversation';
        } else {
          subEl.textContent = conversationData.type || '';
        }
      }

      // Show/hide media button for client groups
      var mediaBtn = document.getElementById('media-btn');
      if (mediaBtn) {
        mediaBtn.style.display = (conversationData.type === 'client_group') ? '' : 'none';
      }

      renderMessages();
      scrollToBottom();

      // Mark as read
      try {
        await App.api('POST', '/api/chat/conversations/' + conversationId + '/read');
      } catch (e) { /* non-critical */ }

    } catch (e) {
      container.innerHTML = '<div class="empty-state">' +
        '<div class="empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/><path d="M12 8V12M12 16H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div>' +
        '<h3>Error loading chat</h3>' +
        '<p>' + App.escapeHtml(e.message) + '</p>' +
      '</div>';
    }
  }

  async function loadMore() {
    if (!hasMore || loading || messages.length === 0 || !conversationData) return;
    loading = true;

    var container = document.getElementById('messages');
    var scrollHeightBefore = container ? container.scrollHeight : 0;
    var oldest = messages[0].created_at;

    try {
      var data = await App.api('GET', '/api/chat/conversations/' + conversationData.id + '?before=' + encodeURIComponent(oldest));
      var newMsgs = data.messages || [];
      hasMore = !!data.has_more;
      messages = newMsgs.concat(messages);
      renderMessages();

      // Maintain scroll position
      if (container) {
        var scrollHeightAfter = container.scrollHeight;
        container.scrollTop = scrollHeightAfter - scrollHeightBefore;
      }
    } catch (e) {
      console.error('[Chat] Load more error:', e);
    }
    loading = false;
  }

  function renderMessages() {
    var container = document.getElementById('messages');
    if (!container) return;

    var user = App.getUser();
    var html = '';

    if (hasMore) {
      html += '<div class="load-more-bar">' +
        '<button class="load-more-btn" onclick="Chat.loadMore()">Load earlier messages</button>' +
      '</div>';
    }

    if (messages.length === 0) {
      html += '<div class="empty-state">' +
        '<div class="empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none"><path d="M21 15C21 15.53 20.79 16.04 20.41 16.41C20.04 16.79 19.53 17 19 17H7L3 21V5C3 4.47 3.21 3.96 3.59 3.59C3.96 3.21 4.47 3 5 3H19C19.53 3 20.04 3.21 20.41 3.59C20.79 3.96 21 4.47 21 5V15Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
        '<h3>No messages yet</h3>' +
        '<p>Send the first message</p>' +
      '</div>';
      container.innerHTML = html;
      return;
    }

    for (var i = 0; i < messages.length; i++) {
      var msg = messages[i];
      // Date separator
      if (i === 0 || !sameDay(messages[i - 1].created_at, msg.created_at)) {
        html += '<div class="date-separator"><span>' + formatDate(msg.created_at) + '</span></div>';
      }
      html += renderMessage(msg, user);
    }

    container.innerHTML = html;
  }

  function renderMessage(msg, user) {
    // Deleted message
    if (msg.deleted || msg.deleted_placeholder) {
      var deletedText = msg.deleted_placeholder || 'This message was removed';
      return '<div class="msg-bubble deleted">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M4.93 4.93L19.07 19.07" stroke="currentColor" stroke-width="2"/></svg>' +
        '<span>' + App.escapeHtml(deletedText) + '</span>' +
      '</div>';
    }

    // System message
    if (msg.sender_type === 'system') {
      return '<div class="msg-bubble system">' + App.escapeHtml(msg.content) + '</div>';
    }

    // AI message
    if (msg.sender_type === 'ai') {
      var aiHtml = '<div class="msg-bubble ai">';
      aiHtml += '<div class="msg-ai-badge">Titus AI</div>';
      aiHtml += '<div class="msg-content">' + formatContent(msg.content) + '</div>';
      aiHtml += '<div class="msg-time">' + formatMsgTime(msg.created_at) + '</div>';
      aiHtml += '</div>';
      return aiHtml;
    }

    // Regular user message
    var isSent = String(msg.sender_id) === String(user.id);
    var bubbleClass = isSent ? 'msg-bubble sent' : 'msg-bubble received';

    var msgHtml = '<div class="' + bubbleClass + '">';

    // Sender name for received messages in group conversations
    if (!isSent && conversationData && (conversationData.type === 'client_group' || conversationData.type === 'Client Group')) {
      var senderName = msg.sender_name || 'Unknown';
      msgHtml += '<div class="msg-sender">' + App.escapeHtml(senderName) + '</div>';
    }

    // Text content
    if (msg.content) {
      msgHtml += '<div class="msg-content">' + formatContent(msg.content) + '</div>';
    }

    // Attachments
    if (msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0) {
      if (msg.attachments.length === 1) {
        msgHtml += Attachments.renderAttachmentInMessage(msg.attachments[0]);
      } else {
        var images = msg.attachments.filter(function(a) { return a.file_category === 'image'; });
        var others = msg.attachments.filter(function(a) { return a.file_category !== 'image'; });

        if (images.length > 0) {
          msgHtml += '<div class="msg-attachment-grid">';
          images.forEach(function(a) {
            var src = escapeAttr(a.thumbnail_url || a.file_url);
            var fullUrl = escapeAttr(a.file_url);
            msgHtml += '<img src="' + src + '" alt="' + App.escapeHtml(a.filename || 'Image') + '" onclick="Lightbox.open(\'' + fullUrl + '\')" loading="lazy">';
          });
          msgHtml += '</div>';
        }
        others.forEach(function(a) {
          msgHtml += Attachments.renderAttachmentInMessage(a);
        });
      }
    }

    msgHtml += '<div class="msg-time">' + formatMsgTime(msg.created_at) + '</div>';
    msgHtml += '</div>';
    return msgHtml;
  }

  function appendMessage(msg) {
    var user = App.getUser();

    // Check for duplicate
    for (var i = 0; i < messages.length; i++) {
      if (messages[i].id === msg.id) return;
    }

    messages.push(msg);
    var container = document.getElementById('messages');
    if (!container) return;

    // Remove empty state if present
    var emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    // Check if we need a date separator
    var prefix = '';
    if (messages.length <= 1 || !sameDay(messages[messages.length - 2].created_at, msg.created_at)) {
      prefix = '<div class="date-separator"><span>' + formatDate(msg.created_at) + '</span></div>';
    }

    container.insertAdjacentHTML('beforeend', prefix + renderMessage(msg, user));
    scrollToBottom();
  }

  function scrollToBottom() {
    var container = document.getElementById('messages');
    if (container) {
      requestAnimationFrame(function() {
        container.scrollTop = container.scrollHeight;
      });
    }
  }

  function formatContent(text) {
    if (!text) return '';
    var escaped = App.escapeHtml(text);
    // Convert newlines to <br>
    escaped = escaped.replace(/\n/g, '<br>');
    // Auto-link URLs
    escaped = escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">$1</a>');
    return escaped;
  }

  function formatMsgTime(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Australia/Brisbane'
    });
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    var today = new Date();
    if (sameDay(dateStr, today.toISOString())) return 'Today';
    var yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (sameDay(dateStr, yesterday.toISOString())) return 'Yesterday';
    return d.toLocaleDateString('en-AU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'Australia/Brisbane'
    });
  }

  function sameDay(a, b) {
    var opts = { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' };
    var da = new Date(a).toLocaleDateString('en-AU', opts);
    var db = new Date(b).toLocaleDateString('en-AU', opts);
    return da === db;
  }

  function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ─── Member Panel ─────────────────────────────────────────────────
  async function showMembers() {
    var conv = App.getCurrentConversation();
    if (!conv) return;

    var panel = document.getElementById('member-panel');
    var overlay = document.getElementById('overlay');
    if (!panel) return;

    panel.innerHTML = '<div class="member-panel-header"><h3>Members</h3><button onclick="Chat.hideMembers()" aria-label="Close">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
      '</button></div><div class="member-list"><div class="loading"><div class="spinner"></div></div></div>';
    panel.classList.add('open');
    if (overlay) overlay.classList.add('open');

    try {
      var members = await App.api('GET', '/api/chat/conversations/' + conv.id + '/members');

      var user = App.getUser();
      var canManage = staffRoles.indexOf(user.role) !== -1;

      var html = '<div class="member-panel-header"><h3>Members</h3><button onclick="Chat.hideMembers()" aria-label="Close">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
        '</button></div>';
      html += '<div class="member-list">';

      var active = [];
      var former = [];
      (Array.isArray(members) ? members : []).forEach(function(m) {
        if (m.active === false) {
          former.push(m);
        } else {
          active.push(m);
        }
      });

      if (active.length > 0) {
        html += '<div class="member-section-title">CURRENT MEMBERS (' + active.length + ')</div>';
        active.forEach(function(m) {
          var initials = (m.user_name || '?').substring(0, 2).toUpperCase();
          var removeBtn = '';
          // Workers see NO add/remove buttons. Only authorized roles see controls.
          if (canManage && String(m.user_id) !== String(user.id)) {
            removeBtn = '<button class="remove-member-btn" onclick="Chat.removeMember(\'' + m.user_id + '\',\'' + escapeAttr(m.user_name || '') + '\')" title="Remove member" aria-label="Remove ' + escapeAttr(m.user_name || '') + '">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
            '</button>';
          }
          html += '<div class="member-item">' +
            '<div class="member-avatar">' + initials + '</div>' +
            '<div class="member-info">' +
              '<div class="member-name">' + App.escapeHtml(m.user_name || 'Unknown') + '</div>' +
              '<span class="member-role">' + App.escapeHtml(m.role || '') + '</span>' +
            '</div>' +
            removeBtn +
          '</div>';
        });
      }

      if (former.length > 0) {
        html += '<div class="member-section-title" style="margin-top:12px">FORMER MEMBERS (' + former.length + ')</div>';
        former.forEach(function(m) {
          var initials = (m.user_name || '?').substring(0, 2).toUpperCase();
          html += '<div class="member-item former">' +
            '<div class="member-avatar former">' + initials + '</div>' +
            '<div class="member-info">' +
              '<div class="member-name">' + App.escapeHtml(m.user_name || 'Unknown') + '</div>' +
              '<span class="member-role">' + App.escapeHtml(m.removed_reason || 'removed') + '</span>' +
            '</div>' +
          '</div>';
        });
      }

      if (active.length === 0 && former.length === 0) {
        html += '<div class="empty-state" style="padding:24px"><p>No members found</p></div>';
      }

      html += '</div>';
      panel.innerHTML = html;

    } catch (e) {
      panel.innerHTML = '<div class="member-panel-header"><h3>Members</h3><button onclick="Chat.hideMembers()" aria-label="Close">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
        '</button></div><div class="member-list"><div class="empty-state"><p>Error loading members</p></div></div>';
    }
  }

  function hideMembers() {
    var panel = document.getElementById('member-panel');
    var overlay = document.getElementById('overlay');
    if (panel) panel.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
  }

  async function removeMember(userId, userName) {
    if (!confirm('Remove ' + (userName || 'this member') + ' from this group?')) return;
    var conv = App.getCurrentConversation();
    if (!conv) return;

    try {
      await App.api('DELETE', '/api/chat/conversations/' + conv.id + '/members/' + userId);
      showMembers(); // Refresh the panel
    } catch (e) {
      alert('Error removing member: ' + e.message);
    }
  }

  // ─── Client Media Gallery ─────────────────────────────────────────
  async function showMediaGallery() {
    var conv = App.getCurrentConversation();
    if (!conv) return;

    var clientId = conv.client_id || conversationData?.client_id;
    if (!clientId) {
      alert('No client associated with this conversation.');
      return;
    }

    var panel = document.getElementById('member-panel');
    var overlay = document.getElementById('overlay');
    if (!panel) return;

    panel.innerHTML = '<div class="member-panel-header"><h3>Client Media</h3><button onclick="Chat.hideMembers()" aria-label="Close">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
      '</button></div><div class="member-list"><div class="loading"><div class="spinner"></div></div></div>';
    panel.classList.add('open');
    if (overlay) overlay.classList.add('open');

    try {
      var data = await App.api('GET', '/api/chat/client-media/' + clientId);
      var media = data.media || [];

      var html = '<div class="member-panel-header"><h3>Client Media</h3><button onclick="Chat.hideMembers()" aria-label="Close">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
        '</button></div>';
      html += '<div class="member-list" style="padding:8px">';

      if (media.length === 0) {
        html += '<div class="empty-state" style="padding:32px"><p>No media shared yet</p></div>';
      } else {
        var images = media.filter(function(m) { return m.file_category === 'image'; });
        var videos = media.filter(function(m) { return m.file_category === 'video'; });
        var docs = media.filter(function(m) { return m.file_category === 'document'; });

        if (images.length > 0) {
          html += '<div class="media-section-title">IMAGES (' + images.length + ')</div>';
          html += '<div class="media-grid">';
          images.forEach(function(m) {
            var src = escapeAttr(m.thumbnail_url || m.file_url);
            var full = escapeAttr(m.file_url);
            html += '<img src="' + src + '" class="media-grid-item" onclick="Lightbox.open(\'' + full + '\')" loading="lazy" alt="' + App.escapeHtml(m.filename || 'Image') + '">';
          });
          html += '</div>';
        }

        if (videos.length > 0) {
          html += '<div class="media-section-title">VIDEOS (' + videos.length + ')</div>';
          videos.forEach(function(m) {
            html += '<div class="media-list-item" onclick="window.open(\'' + escapeAttr(m.file_url) + '\',\'_blank\')">' +
              '<div class="media-list-icon">' +
                '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><polygon points="5,3 19,12 5,21" fill="currentColor"/></svg>' +
              '</div>' +
              '<div class="media-list-info">' +
                '<div class="media-list-name">' + App.escapeHtml(m.filename || 'Video') + '</div>' +
                '<div class="media-list-meta">' + App.escapeHtml(m.uploaded_by_name || '') + '</div>' +
              '</div>' +
            '</div>';
          });
        }

        if (docs.length > 0) {
          html += '<div class="media-section-title">DOCUMENTS (' + docs.length + ')</div>';
          docs.forEach(function(m) {
            html += '<div class="media-list-item" onclick="window.open(\'' + escapeAttr(m.file_url) + '\',\'_blank\')">' +
              '<div class="media-list-icon doc">' +
                '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" stroke="currentColor" stroke-width="1.5"/><path d="M14 2V8H20" stroke="currentColor" stroke-width="1.5"/></svg>' +
              '</div>' +
              '<div class="media-list-info">' +
                '<div class="media-list-name">' + App.escapeHtml(m.filename || 'Document') + '</div>' +
                '<div class="media-list-meta">' + App.escapeHtml(m.uploaded_by_name || '') + ' &middot; ' + Attachments.formatSize(m.file_size || 0) + '</div>' +
              '</div>' +
            '</div>';
          });
        }
      }

      html += '</div>';
      panel.innerHTML = html;

    } catch (e) {
      panel.innerHTML = '<div class="member-panel-header"><h3>Client Media</h3><button onclick="Chat.hideMembers()" aria-label="Close">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
        '</button></div><div class="member-list"><div class="empty-state"><p>Error loading media</p></div></div>';
    }
  }

  function getConversationData() {
    return conversationData;
  }

  return {
    load: load,
    loadMore: loadMore,
    renderMessages: renderMessages,
    appendMessage: appendMessage,
    scrollToBottom: scrollToBottom,
    showMembers: showMembers,
    hideMembers: hideMembers,
    removeMember: removeMember,
    showMediaGallery: showMediaGallery,
    getConversationData: getConversationData
  };
})();
