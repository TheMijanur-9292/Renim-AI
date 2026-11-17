/**
 * Renim AI - Enterprise Google Meet DOM Observer Engine
 * 
 * Features:
 * - Multi-selector adaptive fallback (Semantic aria-live, jsname, structural heuristics)
 * - Intelligent sentence finalizer & speaker deduplication
 * - Real-time state synchronization with Side Panel and Background Worker
 * - Auto Write-Ahead Local Buffer (Zero data loss on tab close/crash)
 * - Non-intrusive floating status widget
 */

(function () {
  if (window.__RENIM_AI_OBSERVER_INITIALIZED__) return;
  window.__RENIM_AI_OBSERVER_INITIALIZED__ = true;

  // --- State Management ---
  const state = {
    isRecording: false,
    meetingId: null,
    meetingTitle: document.title.replace('- Google Meet', '').trim() || 'Google Meet Call',
    meetingUrl: window.location.href,
    startTime: null,
    transcripts: [],
    currentSpeaker: null,
    currentBuffer: '',
    wordCount: 0,
    observer: null,
    storageKey: null
  };

  // --- Configuration & Selectors ---
  const SELECTORS = {
    // Containers where Google Meet renders live subtitles
    captionContainers: [
      'div[jsname="YSxPC"]',
      'div[aria-live="polite"]',
      'div[jsname="tgaKEf"]',
      '.a4bMb',
      '.iTTPOb'
    ],
    // Speaker name elements
    speakerNames: [
      'div[jsname="r4nke"]',
      '.zs7LEd',
      '.bh44bd',
      '.jT5TU',
      '[data-sender-name]'
    ],
    // Caption text spans / containers
    captionText: [
      'span[jsname="VbkSUe"]',
      '.ygicle',
      '.CNhiXd',
      '.TBMuR'
    ],
    // Captions toggle button on bottom bar
    ccButton: [
      'button[jsname="r8qRAd"]',
      'button[aria-label*="turn on captions" i]',
      'button[aria-label*="turn off captions" i]',
      'button[data-tooltip*="captions" i]'
    ]
  };

  // --- Local Recovery Buffer (Write-Ahead Log) ---
  function initStorageKey() {
    const meetCode = window.location.pathname.replace('/', '') || 'session';
    state.storageKey = `renim_active_session_${meetCode}`;
  }

  async function persistToLocalBuffer() {
    if (!state.isRecording || !state.storageKey) return;
    try {
      await chrome.storage.local.set({
        [state.storageKey]: {
          meetingId: state.meetingId,
          meetingTitle: state.meetingTitle,
          meetingUrl: state.meetingUrl,
          startTime: state.startTime,
          transcripts: state.transcripts,
          wordCount: state.wordCount,
          lastUpdated: Date.now()
        }
      });
    } catch (e) {
      console.warn('[Renim AI] Buffer write warning:', e);
    }
  }

  async function clearLocalBuffer() {
    if (!state.storageKey) return;
    try {
      await chrome.storage.local.remove(state.storageKey);
    } catch (e) {
      // Ignore
    }
  }

  // --- Floating Status Widget ---
  let widgetEl = null;

  function createFloatingWidget() {
    if (document.getElementById('renim-floating-widget')) return;

    widgetEl = document.createElement('div');
    widgetEl.id = 'renim-floating-widget';
    widgetEl.className = 'renim-widget-container';
    widgetEl.innerHTML = `
      <div class="renim-widget-inner">
        <span class="renim-status-dot renim-dot-idle"></span>
        <span class="renim-widget-title">Renim AI</span>
        <span class="renim-word-counter" id="renim-widget-counter">0 words</span>
        <button class="renim-widget-btn" id="renim-widget-toggle" title="Toggle Live Recording">Start</button>
      </div>
    `;

    document.body.appendChild(widgetEl);

    // Bind event
    const toggleBtn = document.getElementById('renim-widget-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        if (state.isRecording) {
          stopRecording();
        } else {
          startRecording();
        }
      });
    }
  }

  function updateWidgetUI() {
    const dot = widgetEl?.querySelector('.renim-status-dot');
    const counter = document.getElementById('renim-widget-counter');
    const toggleBtn = document.getElementById('renim-widget-toggle');

    if (counter) counter.textContent = `${state.wordCount} words`;

    if (state.isRecording) {
      if (dot) {
        dot.className = 'renim-status-dot renim-dot-recording';
      }
      if (toggleBtn) {
        toggleBtn.textContent = 'Pause';
        toggleBtn.className = 'renim-widget-btn renim-btn-active';
      }
    } else {
      if (dot) {
        dot.className = 'renim-status-dot renim-dot-idle';
      }
      if (toggleBtn) {
        toggleBtn.textContent = 'Resume';
        toggleBtn.className = 'renim-widget-btn';
      }
    }
  }

  // --- Real-time Caption Extraction Engine ---

  function extractSpeakerAndText(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return null;

    // Search for speaker name
    let speaker = null;
    for (const sel of SELECTORS.speakerNames) {
      const el = node.querySelector(sel);
      if (el && el.textContent.trim()) {
        speaker = el.textContent.trim();
        break;
      }
    }

    // Fallback: check if node itself or parent has data-sender-name
    if (!speaker) {
      speaker = node.getAttribute('data-sender-name') ||
                node.closest('[data-sender-name]')?.getAttribute('data-sender-name');
    }

    // Search for spoken text
    let text = '';
    for (const sel of SELECTORS.captionText) {
      const spans = node.querySelectorAll(sel);
      if (spans.length > 0) {
        text = Array.from(spans).map(s => s.textContent.trim()).filter(Boolean).join(' ');
        break;
      }
    }

    if (!text && node.textContent) {
      // Fallback: entire text excluding speaker name
      const full = node.textContent.trim();
      text = speaker ? full.replace(speaker, '').trim() : full;
    }

    return { speaker: speaker || state.currentSpeaker || 'Speaker', text: text.trim() };
  }

  function handleCaptionStream(extracted) {
    if (!extracted || !extracted.text) return;
    const { speaker, text } = extracted;

    // Normalize text
    const cleanText = text.replace(/\s+/g, ' ').trim();
    if (!cleanText || cleanText.length < 2) return;

    const timestamp = new Date().toISOString();

    // Check if continuing previous speaker's sentence
    const lastItem = state.transcripts[state.transcripts.length - 1];

    if (lastItem && lastItem.speaker === speaker) {
      // If the incoming text starts with or extends the last item
      if (cleanText.startsWith(lastItem.text) || cleanText.length > lastItem.text.length) {
        lastItem.text = cleanText;
        lastItem.timestamp = timestamp;
      } else if (!lastItem.text.endsWith(cleanText) && !lastItem.text.includes(cleanText)) {
        // New sentence chunk from same speaker
        lastItem.text = `${lastItem.text} ${cleanText}`.trim();
        lastItem.timestamp = timestamp;
      }
    } else {
      // New speaker or first transcript
      state.currentSpeaker = speaker;
      state.transcripts.push({
        id: 't_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        speaker: speaker,
        text: cleanText,
        timestamp: timestamp
      });
    }

    // Update global word count
    state.wordCount = state.transcripts.reduce((acc, curr) => {
      return acc + (curr.text ? curr.text.split(/\s+/).filter(Boolean).length : 0);
    }, 0);

    updateWidgetUI();
    persistToLocalBuffer();

    // Broadcast to Side Panel
    broadcastToSidePanel({
      type: 'RENIM_TRANSCRIPT_UPDATE',
      transcripts: state.transcripts,
      wordCount: state.wordCount,
      activeSpeaker: speaker,
      isRecording: state.isRecording
    });
  }

  function startObserver() {
    if (state.observer) state.observer.disconnect();

    state.observer = new MutationObserver((mutations) => {
      if (!state.isRecording) return;

      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const res = extractSpeakerAndText(node);
              if (res && res.text) {
                handleCaptionStream(res);
              }
            }
          });
        } else if (mutation.type === 'characterData' || mutation.type === 'subtree') {
          const target = mutation.target.nodeType === Node.ELEMENT_NODE
            ? mutation.target
            : mutation.target.parentElement;
          if (target) {
            const res = extractSpeakerAndText(target);
            if (res && res.text) {
              handleCaptionStream(res);
            }
          }
        }
      }
    });

    // Observe document body with resilient subtree configuration
    state.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    console.log('[Renim AI] Captions MutationObserver engaged.');
  }

  // --- Recording Lifecycle ---

  function startRecording() {
    state.isRecording = true;
    if (!state.startTime) {
      state.startTime = new Date().toISOString();
      state.meetingId = 'meet_' + Date.now();
      state.meetingTitle = document.title.replace('- Google Meet', '').trim() || 'Google Meet Call';
      state.meetingUrl = window.location.href;
      initStorageKey();
    }

    startObserver();
    updateWidgetUI();
    persistToLocalBuffer();

    broadcastToSidePanel({
      type: 'RENIM_STATUS_CHANGE',
      isRecording: true,
      meetingId: state.meetingId,
      meetingTitle: state.meetingTitle,
      startTime: state.startTime,
      transcripts: state.transcripts,
      wordCount: state.wordCount
    });

    // Check if Google Meet captions button is active
    checkAndNotifyCC();
  }

  function stopRecording() {
    state.isRecording = false;
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    updateWidgetUI();
    persistToLocalBuffer();

    broadcastToSidePanel({
      type: 'RENIM_STATUS_CHANGE',
      isRecording: false,
      meetingId: state.meetingId,
      meetingTitle: state.meetingTitle,
      transcripts: state.transcripts,
      wordCount: state.wordCount
    });
  }

  function resetSession() {
    stopRecording();
    clearLocalBuffer();
    state.meetingId = null;
    state.startTime = null;
    state.transcripts = [];
    state.wordCount = 0;
    state.currentSpeaker = null;
    updateWidgetUI();

    broadcastToSidePanel({
      type: 'RENIM_SESSION_RESET'
    });
  }

  function checkAndNotifyCC() {
    // Check if captions are turned on in Google Meet
    let ccActive = false;
    for (const sel of SELECTORS.ccButton) {
      const btn = document.querySelector(sel);
      if (btn) {
        const ariaPressed = btn.getAttribute('aria-pressed');
        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
        if (ariaPressed === 'true' || ariaLabel.includes('turn off captions')) {
          ccActive = true;
          break;
        }
      }
    }

    if (!ccActive) {
      broadcastToSidePanel({
        type: 'RENIM_NOTIFICATION',
        level: 'info',
        message: 'Tip: Please make sure Captions (CC) are enabled in Google Meet for live capture.'
      });
    }
  }

  // --- Extension Messaging Gateway ---

  function broadcastToSidePanel(payload) {
    try {
      chrome.runtime.sendMessage(payload, () => {
        // Suppress benign closed port error if side panel is not currently open
        if (chrome.runtime.lastError) { /* ignore */ }
      });
    } catch (e) {
      // Extension context invalidated
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'RENIM_GET_STATUS':
        sendResponse({
          isRecording: state.isRecording,
          meetingId: state.meetingId,
          meetingTitle: state.meetingTitle,
          meetingUrl: state.meetingUrl,
          startTime: state.startTime,
          transcripts: state.transcripts,
          wordCount: state.wordCount
        });
        break;

      case 'RENIM_START_RECORDING':
        startRecording();
        sendResponse({ success: true, isRecording: true });
        break;

      case 'RENIM_PAUSE_RECORDING':
        stopRecording();
        sendResponse({ success: true, isRecording: false });
        break;

      case 'RENIM_RESET_SESSION':
        resetSession();
        sendResponse({ success: true });
        break;

      default:
        break;
    }
    return true;
  });

  // --- Auto Initialization ---
  window.addEventListener('DOMContentLoaded', () => {
    createFloatingWidget();
  });

  // If already loaded
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    createFloatingWidget();
  }

  // Clean-up on tab unload
  window.addEventListener('beforeunload', () => {
    if (state.observer) {
      state.observer.disconnect();
    }
  });

  console.log('[Renim AI] Google Meet Observer loaded successfully.');
})();
