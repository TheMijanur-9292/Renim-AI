/**
 * Renim AI - Side Panel Application Controller
 * Handles live speech stream, AI summarization via Gateway, Supabase Sync, and Auth.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // --- Service Clients ---
  const supabase = new SupabaseClient();
  const aiGateway = new AIGatewayClient();

  await supabase.init();
  await aiGateway.init();

  // --- App State ---
  const state = {
    isRecording: false,
    meetingId: null,
    meetingTitle: 'Google Meet Session',
    meetingUrl: '',
    startTime: null,
    durationSeconds: 0,
    timerInterval: null,
    transcripts: [],
    wordCount: 0,
    activeTab: 'tab-live',
    currentSummary: null,
    activeMeetTabId: null,
    authMode: 'login', // 'login' or 'signup'
    cachedMeetings: []
  };

  // --- DOM Elements ---
  const el = {
    // Nav & Layout
    navTabs: document.querySelectorAll('.nav-tab'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    connectionStatus: document.getElementById('connection-status'),
    globalBanner: document.getElementById('global-banner'),
    bannerText: document.getElementById('banner-text'),
    btnCloseBanner: document.getElementById('btn-close-banner'),
    userProfileMenu: document.getElementById('user-profile-menu'),
    btnLogout: document.getElementById('btn-logout'),

    // Recovery
    recoveryCard: document.getElementById('recovery-card'),
    recoveryDesc: document.getElementById('recovery-desc'),
    btnRecover: document.getElementById('btn-recover'),
    btnDiscardRecovery: document.getElementById('btn-discard-recovery'),

    // Tab 1: Live
    sessionTitle: document.getElementById('session-title'),
    statWords: document.getElementById('stat-words'),
    statTimer: document.getElementById('stat-timer'),
    btnToggleRecord: document.getElementById('btn-toggle-record'),
    btnRecordText: document.getElementById('btn-record-text'),
    btnSummarizeNow: document.getElementById('btn-summarize-now'),
    transcriptSearch: document.getElementById('transcript-search'),
    btnCopyRaw: document.getElementById('btn-copy-raw'),
    transcriptContainer: document.getElementById('transcript-container'),

    // Tab 2: Summary
    summaryMeetingTitle: document.getElementById('summary-meeting-title'),
    btnCopyMarkdown: document.getElementById('btn-copy-markdown'),
    btnSaveSupabase: document.getElementById('btn-save-supabase'),
    aiLoadingState: document.getElementById('ai-loading-state'),
    summaryContentArea: document.getElementById('summary-content-area'),
    summaryTldr: document.getElementById('summary-tldr'),
    summaryDecisions: document.getElementById('summary-decisions'),
    summaryActionsList: document.getElementById('summary-actions-list'),
    summaryKeypoints: document.getElementById('summary-keypoints'),

    // Tab 3: History
    historySearch: document.getElementById('history-search'),
    btnRefreshHistory: document.getElementById('btn-refresh-history'),
    historyList: document.getElementById('history-list'),

    // Tab 4: Settings
    inputSbUrl: document.getElementById('input-sb-url'),
    inputSbAnon: document.getElementById('input-sb-anon'),
    inputAiUrl: document.getElementById('input-ai-url'),
    inputAiKey: document.getElementById('input-ai-key'),
    inputAiModel: document.getElementById('input-ai-model'),
    btnSaveSettings: document.getElementById('btn-save-settings'),

    // Auth Modal
    authModal: document.getElementById('auth-modal'),
    authTabLogin: document.getElementById('auth-tab-login'),
    authTabSignup: document.getElementById('auth-tab-signup'),
    authForm: document.getElementById('auth-form'),
    authEmail: document.getElementById('auth-email'),
    authPassword: document.getElementById('auth-password'),
    authErrorMsg: document.getElementById('auth-error-msg'),
    btnAuthSubmit: document.getElementById('btn-auth-submit'),
    btnSkipAuth: document.getElementById('btn-skip-auth')
  };

  // --- Initial Setup & Auth State Check ---
  function updateAuthUI() {
    if (supabase.isAuthenticated()) {
      el.authModal.classList.add('hidden');
      el.userProfileMenu.classList.remove('hidden');
      el.btnLogout.title = `Signed in as ${supabase.user.email} (Click to Log Out)`;
    } else {
      el.userProfileMenu.classList.add('hidden');
      if (supabase.isConfigured()) {
        el.authModal.classList.remove('hidden');
      }
    }
  }

  function loadSettingsUI() {
    el.inputSbUrl.value = supabase.url || '';
    el.inputSbAnon.value = supabase.anonKey || '';
    el.inputAiUrl.value = aiGateway.gatewayUrl || '';
    el.inputAiKey.value = aiGateway.apiKey || '';
    el.inputAiModel.value = aiGateway.model || 'gpt-4o-mini';
  }

  // --- Navigation Tabs ---
  function switchTab(targetTabId) {
    state.activeTab = targetTabId;
    el.navTabs.forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-tab') === targetTabId);
    });
    el.tabPanes.forEach(pane => {
      pane.classList.toggle('active', pane.id === targetTabId);
    });

    if (targetTabId === 'tab-history' && supabase.isAuthenticated()) {
      fetchAndRenderHistory();
    }
  }

  el.navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.getAttribute('data-tab'));
    });
  });

  // --- Notification Banner ---
  function showBanner(message, isError = false) {
    el.bannerText.textContent = message;
    el.globalBanner.style.color = isError ? '#f87171' : '#93c5fd';
    el.globalBanner.classList.remove('hidden');
  }

  el.btnCloseBanner.addEventListener('click', () => {
    el.globalBanner.classList.add('hidden');
  });

  // --- Timer Management ---
  function startTimer() {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
      state.durationSeconds++;
      const mins = String(Math.floor(state.durationSeconds / 60)).padStart(2, '0');
      const secs = String(state.durationSeconds % 60).padStart(2, '0');
      el.statTimer.textContent = `${mins}:${secs}`;
    }, 1000);
  }

  function stopTimer() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }

  function resetTimer() {
    stopTimer();
    state.durationSeconds = 0;
    el.statTimer.textContent = '00:00';
  }

  // --- Active Meeting Connection Monitor ---
  async function checkActiveMeetTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    if (currentTab && currentTab.url && currentTab.url.includes('meet.google.com')) {
      state.activeMeetTabId = currentTab.id;
      setConnectionStatus(state.isRecording ? 'recording' : 'connected', 'Google Meet Active');

      // Query current state from Meet tab
      chrome.tabs.sendMessage(currentTab.id, { type: 'RENIM_GET_STATUS' }, (res) => {
        if (chrome.runtime.lastError || !res) return;
        state.isRecording = res.isRecording;
        state.meetingId = res.meetingId || state.meetingId;
        state.meetingTitle = res.meetingTitle || state.meetingTitle;
        state.transcripts = res.transcripts || [];
        state.wordCount = res.wordCount || 0;
        updateLiveFeedUI();
        updateRecordButtonState();
      });
    } else {
      setConnectionStatus('disconnected', 'Standby');
    }
  }

  function setConnectionStatus(type, label) {
    el.connectionStatus.className = `connection-pill status-${type}`;
    el.connectionStatus.querySelector('.status-text').textContent = label;
  }

  // --- Live Transcripts Rendering ---
  function updateLiveFeedUI(searchFilter = '') {
    el.sessionTitle.textContent = state.meetingTitle;
    el.statWords.textContent = `${state.wordCount} words`;

    const filter = (searchFilter || el.transcriptSearch.value || '').toLowerCase().trim();
    const items = filter
      ? state.transcripts.filter(t => t.text.toLowerCase().includes(filter) || t.speaker.toLowerCase().includes(filter))
      : state.transcripts;

    if (items.length === 0) {
      el.transcriptContainer.innerHTML = `
        <div class="feed-empty-state">
          <div class="empty-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <h3>${filter ? 'No matching speech found' : 'No Live Captions Yet'}</h3>
          <p>${filter ? 'Try a different search query' : 'Open Google Meet, turn on CC, and click Start Capture.'}</p>
        </div>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();
    items.forEach(t => {
      const card = document.createElement('div');
      card.className = 'transcript-card';
      const timeStr = t.timestamp ? new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
      const initial = (t.speaker || 'S').charAt(0).toUpperCase();

      card.innerHTML = `
        <div class="transcript-meta">
          <div class="speaker-badge">
            <span class="speaker-avatar">${initial}</span>
            <span>${escapeHtml(t.speaker || 'Speaker')}</span>
          </div>
          <span class="transcript-time">${timeStr}</span>
        </div>
        <div class="transcript-text">${escapeHtml(t.text)}</div>
      `;
      fragment.appendChild(card);
    });

    el.transcriptContainer.innerHTML = '';
    el.transcriptContainer.appendChild(fragment);

    // Auto-scroll to bottom unless user is searching
    if (!filter) {
      el.transcriptContainer.scrollTop = el.transcriptContainer.scrollHeight;
    }
  }

  function updateRecordButtonState() {
    if (state.isRecording) {
      el.btnRecordText.textContent = 'Pause Capture';
      el.btnToggleRecord.className = 'btn btn-secondary';
      setConnectionStatus('recording', 'Recording...');
    } else {
      el.btnRecordText.textContent = state.transcripts.length > 0 ? 'Resume Capture' : 'Start Capture';
      el.btnToggleRecord.className = 'btn btn-primary';
      if (state.activeMeetTabId) {
        setConnectionStatus('connected', 'Google Meet Ready');
      }
    }
  }

  // --- Live Recording Controls ---
  el.btnToggleRecord.addEventListener('click', async () => {
    if (!state.activeMeetTabId) {
      await checkActiveMeetTab();
    }
    if (!state.activeMeetTabId) {
      showBanner('Please focus on an active Google Meet tab first.', true);
      return;
    }

    if (state.isRecording) {
      chrome.tabs.sendMessage(state.activeMeetTabId, { type: 'RENIM_PAUSE_RECORDING' }, () => {
        state.isRecording = false;
        stopTimer();
        updateRecordButtonState();
      });
    } else {
      chrome.tabs.sendMessage(state.activeMeetTabId, { type: 'RENIM_START_RECORDING' }, () => {
        state.isRecording = true;
        startTimer();
        updateRecordButtonState();
      });
    }
  });

  el.transcriptSearch.addEventListener('input', (e) => {
    updateLiveFeedUI(e.target.value);
  });

  el.btnCopyRaw.addEventListener('click', () => {
    if (state.transcripts.length === 0) {
      showBanner('No transcripts to copy.', true);
      return;
    }
    const raw = state.transcripts.map(t => `[${t.speaker}]: ${t.text}`).join('\n');
    navigator.clipboard.writeText(raw).then(() => {
      showBanner('Raw transcript copied to clipboard!');
    });
  });

  // --- AI Summarization Trigger ---
  el.btnSummarizeNow.addEventListener('click', async () => {
    if (state.transcripts.length === 0) {
      showBanner('Cannot summarize: No transcripts captured yet.', true);
      return;
    }

    // Stop recording on Meet tab
    if (state.activeMeetTabId && state.isRecording) {
      chrome.tabs.sendMessage(state.activeMeetTabId, { type: 'RENIM_PAUSE_RECORDING' });
      state.isRecording = false;
      stopTimer();
      updateRecordButtonState();
    }

    switchTab('tab-summary');
    await runAISummarization();
  });

  async function runAISummarization() {
    if (!aiGateway.isConfigured()) {
      showBanner('Please configure your AI Gateway API Key in Settings first.', true);
      switchTab('tab-settings');
      return;
    }

    el.aiLoadingState.classList.remove('hidden');
    el.summaryContentArea.classList.add('hidden');

    try {
      const result = await aiGateway.generateMeetingSummary(state.transcripts, state.meetingTitle);
      state.currentSummary = result;

      // Update UI
      el.summaryMeetingTitle.value = result.title || state.meetingTitle;
      el.summaryTldr.innerHTML = `<p>${escapeHtml(result.summary || '')}</p>`;

      // Decisions
      if (result.decisions && result.decisions.length > 0) {
        el.summaryDecisions.innerHTML = result.decisions.map(d => `<li>${escapeHtml(d)}</li>`).join('');
      } else {
        el.summaryDecisions.innerHTML = '<li>No concrete decisions recorded.</li>';
      }

      // Key points
      if (result.key_points && result.key_points.length > 0) {
        el.summaryKeypoints.innerHTML = result.key_points.map(k => `<li>${escapeHtml(k)}</li>`).join('');
      } else {
        el.summaryKeypoints.innerHTML = '<li>No major discussion points noted.</li>';
      }

      // Action items
      renderActionItems(result.action_items || []);

      el.aiLoadingState.classList.add('hidden');
      el.summaryContentArea.classList.remove('hidden');

      // Auto save if user is logged in
      if (supabase.isAuthenticated()) {
        await saveMeetingToSupabase();
      }
    } catch (err) {
      el.aiLoadingState.classList.add('hidden');
      el.summaryContentArea.classList.remove('hidden');
      showBanner(`AI Summary Error: ${err.message}`, true);
    }
  }

  function renderActionItems(actionItems) {
    if (!actionItems || actionItems.length === 0) {
      el.summaryActionsList.innerHTML = '<p class="empty-hint">No action items detected.</p>';
      return;
    }

    el.summaryActionsList.innerHTML = actionItems.map((item, idx) => `
      <div class="action-item-row" data-idx="${idx}">
        <input type="checkbox" class="action-checkbox" id="action_chk_${idx}">
        <div class="action-content">
          <label for="action_chk_${idx}" class="action-text">${escapeHtml(item.task)}</label>
          <div class="action-meta">
            <span class="badge-owner">👤 ${escapeHtml(item.owner || 'Unassigned')}</span>
            <span class="badge-priority">⚡ ${escapeHtml(item.priority || 'Medium')}</span>
          </div>
        </div>
      </div>
    `).join('');

    // Bind interactive checkboxes
    el.summaryActionsList.querySelectorAll('.action-checkbox').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const textLabel = e.target.closest('.action-item-row').querySelector('.action-text');
        if (textLabel) {
          textLabel.classList.toggle('done', e.target.checked);
        }
      });
    });
  }

  // --- Export Markdown ---
  el.btnCopyMarkdown.addEventListener('click', () => {
    if (!state.currentSummary) {
      showBanner('No summary generated yet.', true);
      return;
    }

    const title = el.summaryMeetingTitle.value || 'Meeting Notes';
    const s = state.currentSummary;

    let md = `# ${title}\n\n`;
    md += `**Date:** ${new Date().toLocaleDateString()} | **Word Count:** ${state.wordCount}\n\n`;
    md += `## 📋 Executive Summary\n${s.summary}\n\n`;

    if (s.decisions && s.decisions.length > 0) {
      md += `## 🎯 Key Decisions\n` + s.decisions.map(d => `- ${d}`).join('\n') + `\n\n`;
    }

    if (s.action_items && s.action_items.length > 0) {
      md += `## ✅ Action Items\n` + s.action_items.map(a => `- [ ] **${a.task}** (Assignee: @${a.owner || 'Unassigned'}) [${a.priority}]`).join('\n') + `\n\n`;
    }

    if (s.key_points && s.key_points.length > 0) {
      md += `## 💡 Key Discussion Points\n` + s.key_points.map(k => `- ${k}`).join('\n') + `\n\n`;
    }

    navigator.clipboard.writeText(md).then(() => {
      showBanner('Formatted Markdown copied to clipboard!');
    });
  });

  // --- Supabase Cloud Save ---
  async function saveMeetingToSupabase() {
    if (!supabase.isAuthenticated()) {
      showBanner('Please sign in to save your meeting to Supabase Cloud.', true);
      el.authModal.classList.remove('hidden');
      return;
    }

    try {
      el.btnSaveSupabase.disabled = true;
      el.btnSaveSupabase.textContent = 'Saving...';

      const meetingTitle = el.summaryMeetingTitle.value || state.meetingTitle;
      const payload = {
        title: meetingTitle,
        meeting_url: state.meetingUrl,
        started_at: state.startTime || new Date().toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: state.durationSeconds,
        word_count: state.wordCount,
        summary: state.currentSummary?.summary || '',
        key_points: state.currentSummary?.key_points || [],
        decisions: state.currentSummary?.decisions || [],
        action_items: state.currentSummary?.action_items || []
      };

      const savedMeeting = await supabase.createMeeting(payload);
      if (savedMeeting && savedMeeting.id) {
        await supabase.saveTranscripts(savedMeeting.id, state.transcripts);
      }

      showBanner('Meeting and transcripts saved to Supabase Cloud!');
    } catch (err) {
      showBanner(`Save to Cloud failed: ${err.message}`, true);
    } finally {
      el.btnSaveSupabase.disabled = false;
      el.btnSaveSupabase.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
        <span>Save to Cloud</span>
      `;
    }
  }

  el.btnSaveSupabase.addEventListener('click', saveMeetingToSupabase);

  // --- History & Archive View ---
  async function fetchAndRenderHistory() {
    if (!supabase.isAuthenticated()) {
      el.historyList.innerHTML = `
        <div class="feed-empty-state">
          <p>Sign in with Supabase to view your cloud meeting history.</p>
        </div>
      `;
      return;
    }

    try {
      el.historyList.innerHTML = '<div class="feed-empty-state"><p>Loading cloud archive...</p></div>';
      const meetings = await supabase.getMeetings();
      state.cachedMeetings = meetings || [];

      if (state.cachedMeetings.length === 0) {
        el.historyList.innerHTML = `
          <div class="feed-empty-state">
            <h3>No Saved Meetings</h3>
            <p>Your recorded meetings will appear here once saved.</p>
          </div>
        `;
        return;
      }

      renderHistoryCards(state.cachedMeetings);
    } catch (err) {
      el.historyList.innerHTML = `
        <div class="feed-empty-state">
          <p class="form-error">Failed to load history: ${err.message}</p>
        </div>
      `;
    }
  }

  function renderHistoryCards(list) {
    const fragment = document.createDocumentFragment();
    list.forEach(m => {
      const card = document.createElement('div');
      card.className = 'history-item-card';
      const dateStr = new Date(m.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

      card.innerHTML = `
        <div class="history-card-header">
          <span class="history-card-title">${escapeHtml(m.title)}</span>
          <span class="history-card-date">${dateStr}</span>
        </div>
        <p class="history-card-snippet">${escapeHtml(m.summary || 'No summary generated.')}</p>
      `;

      card.addEventListener('click', () => {
        loadHistoryMeetingToView(m);
      });

      fragment.appendChild(card);
    });

    el.historyList.innerHTML = '';
    el.historyList.appendChild(fragment);
  }

  function loadHistoryMeetingToView(meeting) {
    state.currentSummary = {
      title: meeting.title,
      summary: meeting.summary,
      key_points: meeting.key_points || [],
      decisions: meeting.decisions || [],
      action_items: meeting.action_items || []
    };

    el.summaryMeetingTitle.value = meeting.title;
    el.summaryTldr.innerHTML = `<p>${escapeHtml(meeting.summary || 'No summary text')}</p>`;
    el.summaryDecisions.innerHTML = (meeting.decisions && meeting.decisions.length > 0)
      ? meeting.decisions.map(d => `<li>${escapeHtml(d)}</li>`).join('')
      : '<li>No decisions saved.</li>';
    el.summaryKeypoints.innerHTML = (meeting.key_points && meeting.key_points.length > 0)
      ? meeting.key_points.map(k => `<li>${escapeHtml(k)}</li>`).join('')
      : '<li>No discussion points saved.</li>';
    renderActionItems(meeting.action_items || []);

    switchTab('tab-summary');
  }

  el.btnRefreshHistory.addEventListener('click', fetchAndRenderHistory);
  el.historySearch.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    const filtered = state.cachedMeetings.filter(m =>
      m.title.toLowerCase().includes(q) || (m.summary && m.summary.toLowerCase().includes(q))
    );
    renderHistoryCards(filtered);
  });

  // --- Settings Form ---
  el.btnSaveSettings.addEventListener('click', async () => {
    try {
      const sbUrl = el.inputSbUrl.value.trim();
      const sbAnon = el.inputSbAnon.value.trim();
      const aiUrl = el.inputAiUrl.value.trim();
      const aiKey = el.inputAiKey.value.trim();
      const aiModel = el.inputAiModel.value.trim();

      await supabase.setConfig(sbUrl, sbAnon);
      await aiGateway.setConfig(aiUrl, aiKey, aiModel);

      showBanner('Configuration saved successfully!');
      updateAuthUI();
    } catch (err) {
      showBanner(`Failed to save settings: ${err.message}`, true);
    }
  });

  // --- Authentication Modal Handlers ---
  el.authTabLogin.addEventListener('click', () => {
    state.authMode = 'login';
    el.authTabLogin.classList.add('active');
    el.authTabSignup.classList.remove('active');
    el.btnAuthSubmit.textContent = 'Sign In';
    el.authErrorMsg.classList.add('hidden');
  });

  el.authTabSignup.addEventListener('click', () => {
    state.authMode = 'signup';
    el.authTabSignup.classList.add('active');
    el.authTabLogin.classList.remove('active');
    el.btnAuthSubmit.textContent = 'Create Account';
    el.authErrorMsg.classList.add('hidden');
  });

  el.authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    el.authErrorMsg.classList.add('hidden');
    el.btnAuthSubmit.disabled = true;

    try {
      const email = el.authEmail.value.trim();
      const pass = el.authPassword.value.trim();

      if (state.authMode === 'signup') {
        await supabase.signUp(email, pass);
        showBanner('Account created! Please check your email to confirm or sign in.');
      } else {
        await supabase.signIn(email, pass);
        showBanner(`Welcome back, ${email}!`);
      }
      updateAuthUI();
    } catch (err) {
      el.authErrorMsg.textContent = err.message;
      el.authErrorMsg.classList.remove('hidden');
    } finally {
      el.btnAuthSubmit.disabled = false;
    }
  });

  el.btnSkipAuth.addEventListener('click', () => {
    el.authModal.classList.add('hidden');
  });

  el.btnLogout.addEventListener('click', async () => {
    await supabase.signOut();
    updateAuthUI();
    showBanner('You have been signed out.');
  });

  // --- Crash Recovery Check ---
  async function checkForCrashBuffer() {
    const allStorage = await chrome.storage.local.get(null);
    const sessionKey = Object.keys(allStorage).find(k => k.startsWith('renim_active_session_'));
    if (sessionKey && allStorage[sessionKey]) {
      const saved = allStorage[sessionKey];
      if (saved.transcripts && saved.transcripts.length > 0) {
        el.recoveryDesc.textContent = `Found ${saved.transcripts.length} unsummarized transcript blocks from "${saved.meetingTitle || 'Meeting'}".`;
        el.recoveryCard.classList.remove('hidden');

        el.btnRecover.onclick = () => {
          state.transcripts = saved.transcripts;
          state.wordCount = saved.wordCount || 0;
          state.meetingTitle = saved.meetingTitle || state.meetingTitle;
          state.meetingUrl = saved.meetingUrl || '';
          updateLiveFeedUI();
          el.recoveryCard.classList.add('hidden');
          showBanner('Previous meeting session restored!');
        };

        el.btnDiscardRecovery.onclick = async () => {
          await chrome.storage.local.remove(sessionKey);
          el.recoveryCard.classList.add('hidden');
        };
      }
    }
  }

  // --- Real-time Message Listener from Content Script ---
  chrome.runtime.onMessage.addListener((message) => {
    switch (message.type) {
      case 'RENIM_TRANSCRIPT_UPDATE':
        state.transcripts = message.transcripts || [];
        state.wordCount = message.wordCount || 0;
        state.isRecording = message.isRecording;
        updateLiveFeedUI();
        updateRecordButtonState();
        break;

      case 'RENIM_STATUS_CHANGE':
        state.isRecording = message.isRecording;
        if (message.meetingTitle) state.meetingTitle = message.meetingTitle;
        if (message.wordCount !== undefined) state.wordCount = message.wordCount;
        if (message.transcripts) state.transcripts = message.transcripts;
        updateLiveFeedUI();
        updateRecordButtonState();
        break;

      case 'RENIM_NOTIFICATION':
        showBanner(message.message, message.level === 'error');
        break;

      default:
        break;
    }
  });

  // --- Utility Functions ---
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Bootstrap App ---
  loadSettingsUI();
  updateAuthUI();
  await checkActiveMeetTab();
  await checkForCrashBuffer();

  // Polling check for active tab switch
  chrome.tabs.onActivated.addListener(() => {
    checkActiveMeetTab();
  });
});
