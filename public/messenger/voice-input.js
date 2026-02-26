// Voice-to-text dictation using Web Speech API
// NO audio recording, NO MediaRecorder, NO audio Blobs, NO audio uploads
// Purely client-side speech recognition -> text in input field

const VoiceInput = (function() {
  'use strict';

  let recognition = null;
  let isListening = false;
  let targetInput = null;
  let micButton = null;
  let originalPlaceholder = 'Type a message...';

  function isSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function init(inputEl, btnEl) {
    if (!isSupported()) {
      if (btnEl) btnEl.style.display = 'none';
      return false;
    }

    targetInput = inputEl;
    micButton = btnEl;
    if (targetInput) {
      originalPlaceholder = targetInput.placeholder || 'Type a message...';
    }

    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-AU';
    recognition.maxAlternatives = 1;

    recognition.onresult = function(event) {
      var interimTranscript = '';
      var finalTranscript = '';

      for (var i = event.resultIndex; i < event.results.length; i++) {
        var transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript && targetInput) {
        var currentVal = targetInput.value;
        var separator = currentVal && !currentVal.endsWith(' ') ? ' ' : '';
        targetInput.value = currentVal + separator + finalTranscript;
        targetInput.dispatchEvent(new Event('input', { bubbles: true }));
        targetInput.placeholder = originalPlaceholder;
      } else if (interimTranscript && targetInput) {
        targetInput.placeholder = interimTranscript;
      }
    };

    recognition.onerror = function(event) {
      console.log('[VoiceInput] Error:', event.error);
      if (event.error === 'not-allowed') {
        alert('Microphone access is required for voice input. Please allow microphone permission.');
      }
      stop();
    };

    recognition.onend = function() {
      stop();
    };

    return true;
  }

  function start() {
    if (!recognition || isListening) return;
    try {
      recognition.start();
      isListening = true;
      if (micButton) {
        micButton.classList.add('listening');
        micButton.setAttribute('title', 'Listening... tap to stop');
        micButton.setAttribute('aria-label', 'Stop listening');
      }
    } catch (e) {
      console.error('[VoiceInput] Start error:', e);
      isListening = false;
    }
  }

  function stop() {
    if (!recognition) return;
    try {
      recognition.stop();
    } catch (e) { /* already stopped */ }
    isListening = false;
    if (micButton) {
      micButton.classList.remove('listening');
      micButton.setAttribute('title', 'Voice input');
      micButton.setAttribute('aria-label', 'Voice input');
    }
    if (targetInput) {
      targetInput.placeholder = originalPlaceholder;
    }
  }

  function toggle() {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }

  return {
    isSupported: isSupported,
    init: init,
    start: start,
    stop: stop,
    toggle: toggle,
    isListening: function() { return isListening; }
  };
})();
