// Attachment handling - images, videos, documents (NO audio files allowed)
var Attachments = (function() {
  'use strict';

  var ALLOWED_TYPES = {
    'image/jpeg': 'image',
    'image/png': 'image',
    'image/heic': 'image',
    'image/gif': 'image',
    'video/mp4': 'video',
    'video/quicktime': 'video',
    'application/pdf': 'document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document'
  };
  var MAX_SIZE = 25 * 1024 * 1024; // 25MB
  var MAX_FILES = 5;

  var pendingFiles = [];
  var previewContainer = null;

  function init(containerEl) {
    previewContainer = containerEl;
  }

  function validate(file) {
    // Explicitly reject all audio files
    if (file.type && file.type.startsWith('audio/')) {
      return { valid: false, error: 'Audio files are not supported. Use the voice-to-text button instead.' };
    }
    if (!ALLOWED_TYPES[file.type]) {
      return { valid: false, error: 'File type "' + (file.type || 'unknown') + '" is not supported. Allowed: images, videos, PDF, DOCX.' };
    }
    if (file.size > MAX_SIZE) {
      return { valid: false, error: '"' + file.name + '" exceeds the 25MB limit (' + formatSize(file.size) + ').' };
    }
    return { valid: true, category: ALLOWED_TYPES[file.type] };
  }

  function addFiles(fileList) {
    var errors = [];
    for (var i = 0; i < fileList.length; i++) {
      var file = fileList[i];
      if (pendingFiles.length >= MAX_FILES) {
        errors.push('Maximum ' + MAX_FILES + ' files per message.');
        break;
      }
      var result = validate(file);
      if (!result.valid) {
        errors.push(result.error);
        continue;
      }
      pendingFiles.push(file);
    }
    renderPreviews();
    return errors;
  }

  function removeFile(index) {
    // Revoke object URL if we created one
    if (pendingFiles[index] && pendingFiles[index]._previewUrl) {
      URL.revokeObjectURL(pendingFiles[index]._previewUrl);
    }
    pendingFiles.splice(index, 1);
    renderPreviews();
    // Update send button visibility
    var sendBtn = document.getElementById('send-btn');
    var msgInput = document.getElementById('msg-input');
    if (sendBtn) {
      var hasContent = (msgInput && msgInput.value.trim().length > 0) || pendingFiles.length > 0;
      sendBtn.classList.toggle('visible', hasContent);
    }
  }

  function clear() {
    // Revoke all object URLs
    pendingFiles.forEach(function(f) {
      if (f._previewUrl) URL.revokeObjectURL(f._previewUrl);
    });
    pendingFiles = [];
    renderPreviews();
  }

  function getFiles() {
    return pendingFiles;
  }

  function hasFiles() {
    return pendingFiles.length > 0;
  }

  function renderPreviews() {
    if (!previewContainer) return;
    if (pendingFiles.length === 0) {
      previewContainer.innerHTML = '';
      return;
    }

    var html = '';
    pendingFiles.forEach(function(file, i) {
      var category = ALLOWED_TYPES[file.type] || 'document';

      if (category === 'image') {
        if (!file._previewUrl) {
          file._previewUrl = URL.createObjectURL(file);
        }
        html += '<div class="attachment-thumb">' +
          '<img src="' + file._previewUrl + '" alt="' + escapeAttr(file.name) + '">' +
          '<button class="remove-btn" onclick="Attachments.removeFile(' + i + ')" aria-label="Remove">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>' +
          '</button>' +
          '<div class="attachment-thumb-label">' + truncateName(file.name, 12) + '</div>' +
        '</div>';
      } else if (category === 'video') {
        html += '<div class="attachment-thumb attachment-thumb-video">' +
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><polygon points="5,3 19,12 5,21" fill="currentColor"/></svg>' +
          '<button class="remove-btn" onclick="Attachments.removeFile(' + i + ')" aria-label="Remove">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>' +
          '</button>' +
          '<div class="attachment-thumb-label">' + truncateName(file.name, 12) + '</div>' +
        '</div>';
      } else {
        html += '<div class="attachment-thumb attachment-thumb-doc">' +
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" stroke="currentColor" stroke-width="1.5"/><path d="M14 2V8H20" stroke="currentColor" stroke-width="1.5"/></svg>' +
          '<button class="remove-btn" onclick="Attachments.removeFile(' + i + ')" aria-label="Remove">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>' +
          '</button>' +
          '<div class="attachment-thumb-label">' + truncateName(file.name, 12) + '</div>' +
        '</div>';
      }
    });

    previewContainer.innerHTML = html;
  }

  function formatSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function renderAttachmentInMessage(attachment) {
    var cat = attachment.file_category || 'document';
    var escapedUrl = escapeAttr(attachment.file_url || '');
    var escapedName = escapeAttr(attachment.filename || 'File');

    if (cat === 'image') {
      var src = escapeAttr(attachment.thumbnail_url || attachment.file_url || '');
      return '<div class="msg-attachment">' +
        '<img src="' + src + '" alt="' + escapedName + '" onclick="Lightbox.open(\'' + escapedUrl + '\')" loading="lazy">' +
      '</div>';
    }

    if (cat === 'video') {
      var poster = attachment.thumbnail_url ? escapeAttr(attachment.thumbnail_url) : '';
      var posterHtml = poster
        ? '<img src="' + poster + '" alt="Video thumbnail">'
        : '<div class="msg-video-placeholder"></div>';
      return '<div class="msg-attachment msg-video-thumb" onclick="window.open(\'' + escapedUrl + '\',\'_blank\')">' +
        posterHtml +
        '<div class="msg-video-play">' +
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="8,5 20,12 8,19"/></svg>' +
        '</div>' +
      '</div>';
    }

    // Document
    return '<div class="msg-attachment">' +
      '<a href="' + escapedUrl + '" target="_blank" rel="noopener" class="msg-file-card-link">' +
        '<div class="msg-file-card">' +
          '<span class="msg-file-icon">' +
            '<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" stroke="currentColor" stroke-width="1.5"/><path d="M14 2V8H20" stroke="currentColor" stroke-width="1.5"/></svg>' +
          '</span>' +
          '<div class="msg-file-info">' +
            '<div class="msg-file-name">' + (attachment.filename || 'Document') + '</div>' +
            '<div class="msg-file-size">' + formatSize(attachment.file_size || 0) + '</div>' +
          '</div>' +
        '</div>' +
      '</a>' +
    '</div>';
  }

  function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function truncateName(name, maxLen) {
    if (!name) return '';
    if (name.length <= maxLen) return name;
    var ext = name.lastIndexOf('.') > 0 ? name.substring(name.lastIndexOf('.')) : '';
    return name.substring(0, maxLen - ext.length - 1) + '..' + ext;
  }

  return {
    init: init,
    validate: validate,
    addFiles: addFiles,
    removeFile: removeFile,
    clear: clear,
    getFiles: getFiles,
    hasFiles: hasFiles,
    renderPreviews: renderPreviews,
    formatSize: formatSize,
    renderAttachmentInMessage: renderAttachmentInMessage
  };
})();

// Lightbox for fullscreen image viewing
var Lightbox = (function() {
  'use strict';

  function open(src) {
    var el = document.getElementById('lightbox');
    var img = document.getElementById('lightbox-img');
    if (el && img) {
      img.src = src;
      el.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  function close() {
    var el = document.getElementById('lightbox');
    var img = document.getElementById('lightbox-img');
    if (el) {
      el.classList.remove('open');
      document.body.style.overflow = '';
    }
    if (img) img.src = '';
  }

  // Close on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') close();
  });

  return { open: open, close: close };
})();
