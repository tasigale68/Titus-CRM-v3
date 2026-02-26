// Titus CRM — AI Staff & Policy Chatbot Widget
// Floating bubble + slide-up panel for web app
(function() {
  var token = '';
  var sessionId = null;
  var messages = [];
  var isOpen = false;
  var isLoading = false;

  function getToken() {
    return localStorage.getItem('titus_token') || '';
  }

  function apiCall(method, path, body) {
    var opts = {
      method: method,
      headers: { 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    return fetch(path, opts).then(function(r) { return r.json(); });
  }

  function createWidget() {
    // Bubble
    var bubble = document.createElement('div');
    bubble.id = 'chatbotBubble';
    bubble.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>';
    bubble.style.cssText = 'position:fixed;bottom:24px;right:24px;width:56px;height:56px;background:#0f172a;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:9990;transition:transform .2s,box-shadow .2s';
    bubble.onmouseenter = function() { bubble.style.transform = 'scale(1.08)'; bubble.style.boxShadow = '0 6px 24px rgba(0,0,0,.3)'; };
    bubble.onmouseleave = function() { bubble.style.transform = 'scale(1)'; bubble.style.boxShadow = '0 4px 16px rgba(0,0,0,.2)'; };
    bubble.onclick = togglePanel;
    document.body.appendChild(bubble);

    // Panel
    var panel = document.createElement('div');
    panel.id = 'chatbotPanel';
    panel.style.cssText = 'position:fixed;bottom:90px;right:24px;width:400px;height:560px;background:#fff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.15);z-index:9991;display:none;flex-direction:column;overflow:hidden;border:1px solid #e5e7eb;font-family:"Plus Jakarta Sans",-apple-system,sans-serif';
    panel.innerHTML = '<div style="background:#0f172a;color:#fff;padding:16px 20px;display:flex;align-items:center;justify-content:space-between">' +
      '<div><div style="font-size:15px;font-weight:700">AI Assistant</div><div style="font-size:11px;color:rgba(255,255,255,.5)">Staff policies, SOPs &amp; payroll help</div></div>' +
      '<button onclick="document.getElementById(\'chatbotPanel\').style.display=\'none\'" style="background:none;border:none;color:#fff;cursor:pointer;padding:4px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>' +
      '</div>' +
      '<div id="chatbotMessages" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px"></div>' +
      '<div id="chatbotSuggestions" style="padding:0 16px 8px;display:flex;gap:6px;flex-wrap:wrap"></div>' +
      '<div style="padding:12px 16px;border-top:1px solid #e5e7eb;display:flex;gap:8px">' +
      '<input id="chatbotInput" type="text" placeholder="Ask me anything..." style="flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;font-size:13px;font-family:inherit;outline:none" />' +
      '<button id="chatbotSend" style="background:#0d9488;color:#fff;border:none;border-radius:8px;padding:10px 16px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:background .2s">Send</button>' +
      '</div>' +
      '<div style="padding:4px 16px 10px;font-size:9px;color:#9ca3af;text-align:center">Not a substitute for HR or legal advice</div>';
    document.body.appendChild(panel);

    document.getElementById('chatbotSend').onclick = sendMessage;
    document.getElementById('chatbotInput').onkeydown = function(e) { if (e.key === 'Enter') sendMessage(); };

    showSuggestions();
  }

  function togglePanel() {
    var panel = document.getElementById('chatbotPanel');
    isOpen = !isOpen;
    panel.style.display = isOpen ? 'flex' : 'none';
    if (isOpen && messages.length === 0) showWelcome();
  }

  function showWelcome() {
    appendBotMessage('Hi! I\'m your AI assistant. I can help with SOPs, policies, SCHADS Award rates, and general questions. What would you like to know?');
  }

  function showSuggestions() {
    var box = document.getElementById('chatbotSuggestions');
    if (!box) return;
    var suggestions = ['How do I write a progress note?', 'SCHADS Level 2 rate?', 'What is a restrictive practice?', 'How to request leave?'];
    box.innerHTML = suggestions.map(function(s) {
      return '<button style="background:#f0fdf4;color:#0d9488;border:1px solid #bbf7d0;border-radius:6px;padding:5px 10px;font-size:11px;cursor:pointer;font-family:inherit;white-space:nowrap;transition:background .15s" onmouseenter="this.style.background=\'#dcfce7\'" onmouseleave="this.style.background=\'#f0fdf4\'" onclick="document.getElementById(\'chatbotInput\').value=\'' + s.replace(/'/g, "\\'") + '\';document.getElementById(\'chatbotSend\').click()">' + s + '</button>';
    }).join('');
  }

  function appendUserMessage(text) {
    var box = document.getElementById('chatbotMessages');
    var div = document.createElement('div');
    div.style.cssText = 'align-self:flex-end;background:#0d9488;color:#fff;padding:10px 14px;border-radius:14px 14px 4px 14px;font-size:13px;max-width:80%;line-height:1.5;word-break:break-word';
    div.textContent = text;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  function appendBotMessage(text) {
    var box = document.getElementById('chatbotMessages');
    var div = document.createElement('div');
    div.style.cssText = 'align-self:flex-start;background:#f3f4f6;color:#111827;padding:10px 14px;border-radius:14px 14px 14px 4px;font-size:13px;max-width:85%;line-height:1.6;word-break:break-word';
    div.textContent = text;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  function showTyping() {
    var box = document.getElementById('chatbotMessages');
    var div = document.createElement('div');
    div.id = 'chatbotTyping';
    div.style.cssText = 'align-self:flex-start;background:#f3f4f6;color:#9ca3af;padding:10px 14px;border-radius:14px 14px 14px 4px;font-size:13px';
    div.innerHTML = '<span style="display:inline-flex;gap:4px"><span style="width:6px;height:6px;background:#9ca3af;border-radius:50%;animation:cbDot .6s infinite alternate">&#8203;</span><span style="width:6px;height:6px;background:#9ca3af;border-radius:50%;animation:cbDot .6s .2s infinite alternate">&#8203;</span><span style="width:6px;height:6px;background:#9ca3af;border-radius:50%;animation:cbDot .6s .4s infinite alternate">&#8203;</span></span>';
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  function hideTyping() {
    var el = document.getElementById('chatbotTyping');
    if (el) el.remove();
  }

  function sendMessage() {
    var input = document.getElementById('chatbotInput');
    var text = (input.value || '').trim();
    if (!text || isLoading) return;
    input.value = '';
    appendUserMessage(text);
    messages.push({ role: 'user', content: text });

    // Hide suggestions after first message
    var sug = document.getElementById('chatbotSuggestions');
    if (sug) sug.style.display = 'none';

    isLoading = true;
    showTyping();

    apiCall('POST', '/api/chatbot/message', { message: text, session_id: sessionId })
      .then(function(data) {
        hideTyping();
        isLoading = false;
        if (data.session_id) sessionId = data.session_id;
        if (data.response) {
          appendBotMessage(data.response);
          messages.push({ role: 'assistant', content: data.response });
        } else if (data.error) {
          appendBotMessage('Sorry, I encountered an error. Please try again.');
        }
      })
      .catch(function() {
        hideTyping();
        isLoading = false;
        appendBotMessage('Sorry, I\'m having trouble connecting. Please try again.');
      });
  }

  // Add animation styles
  var style = document.createElement('style');
  style.textContent = '@keyframes cbDot{from{opacity:.3;transform:translateY(0)}to{opacity:1;transform:translateY(-3px)}}' +
    '@media(max-width:480px){#chatbotPanel{bottom:0!important;right:0!important;width:100%!important;height:100vh!important;border-radius:0!important}#chatbotBubble{bottom:16px!important;right:16px!important}}';
  document.head.appendChild(style);

  // Init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidget);
  } else {
    createWidget();
  }
})();
