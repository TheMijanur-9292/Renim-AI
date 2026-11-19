/**
 * Renim AI - Workspace API client for the Chrome Extension (Manifest V3).
 *
 * Talks to the same Renim AI backend as the web app (/api/auth/*, /api/meetings), so meetings
 * captured in the extension show up in the web workspace. The class keeps its historical name
 * (SupabaseClient) and method signatures so the side panel code does not need to change.
 */

class SupabaseClient {
  constructor() {
    this.url = '';        // Renim AI workspace URL, e.g. https://app.renimai.com
    this.anonKey = '';    // unused — kept for backwards compatibility with stored settings
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
  }

  async init(config = null) {
    if (config) {
      this.url = (config.url || '').replace(/\/$/, '');
    } else {
      const defaultEnv = (typeof window !== 'undefined' && window.ENV_CONFIG) || (typeof globalThis !== 'undefined' && globalThis.ENV_CONFIG) || {};
      const stored = await chrome.storage.local.get(['supabaseUrl', 'sb_session']);
      this.url = (stored.supabaseUrl || defaultEnv.RENIM_API_URL || '').replace(/\/$/, '');
      if (stored.sb_session) {
        this.accessToken = stored.sb_session.access_token;
        this.user = stored.sb_session.user;
      }
    }
  }

  isConfigured() {
    return Boolean(this.url);
  }

  isAuthenticated() {
    return Boolean(this.accessToken && this.user);
  }

  async setConfig(url /*, anonKey (ignored) */) {
    this.url = (url || '').trim().replace(/\/$/, '');
    await chrome.storage.local.set({ supabaseUrl: this.url });
  }

  _getHeaders(useAuth = true) {
    const headers = { 'Content-Type': 'application/json' };
    if (useAuth && this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;
    return headers;
  }

  async _request(path, options = {}, useAuth = true) {
    if (!this.isConfigured()) throw new Error('Add your Renim AI workspace URL in Settings first.');
    const response = await fetch(`${this.url}${path}`, {
      ...options,
      headers: { ...this._getHeaders(useAuth), ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && useAuth) {
      await this._saveSession(null);
      throw new Error('Your session expired. Please sign in again.');
    }
    if (!response.ok) throw new Error(data.error || data.detail || `Request failed (${response.status})`);
    return data;
  }

  async _saveSession(session) {
    if (session && session.access_token) {
      this.accessToken = session.access_token;
      this.user = session.user;
      await chrome.storage.local.set({ sb_session: { access_token: session.access_token, user: session.user } });
    } else {
      this.accessToken = null;
      this.refreshToken = null;
      this.user = null;
      await chrome.storage.local.remove('sb_session');
    }
  }

  // --- Authentication ---

  async signUp(email, password) {
    const data = await this._request('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name: String(email).split('@')[0] }),
    }, false);
    await this._saveSession(data);
    return data;
  }

  async signIn(email, password) {
    const data = await this._request('/api/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, false);
    if (data.requires_2fa) {
      throw new Error('This account uses 2-step verification. Sign in on the web app to continue.');
    }
    await this._saveSession(data);
    return data;
  }

  async signOut() {
    await this._saveSession(null);
  }

  async refreshSession() {
    // Renim AI tokens are long-lived; an expired token signs the user out on the next request.
    return this.isAuthenticated() ? { access_token: this.accessToken, user: this.user } : null;
  }

  // --- Meetings ---

  async createMeeting(meetingData) {
    if (!this.isAuthenticated()) throw new Error('Please sign in first.');
    const payload = {
      title: meetingData.title,
      duration_seconds: meetingData.duration_seconds || 0,
      word_count: meetingData.word_count || 0,
      raw_transcript: meetingData.raw_transcript || '',
      summary: meetingData.summary || '',
      key_points: meetingData.key_points || [],
      decisions: meetingData.decisions || [],
      action_items: meetingData.action_items || [],
    };
    return this._request('/api/meetings', { method: 'POST', body: JSON.stringify(payload) });
  }

  async updateMeeting() {
    throw new Error('Editing saved meetings is done in the Renim AI web app.');
  }

  /** Transcripts are stored with the meeting itself (raw_transcript), so nothing extra to save. */
  async saveTranscripts() {
    return [];
  }

  async getMeetings() {
    if (!this.isAuthenticated()) throw new Error('Please sign in first.');
    const data = await this._request('/api/meetings', { method: 'GET' });
    return (Array.isArray(data) ? data : []).map((m) => ({ ...m, created_at: m.created_at || m.started_at }));
  }

  async getMeetingTranscripts(meetingId) {
    const meetings = await this.getMeetings();
    const m = meetings.find((x) => String(x.id) === String(meetingId));
    if (!m || !m.raw_transcript) return [];
    return m.raw_transcript.split('\n').filter(Boolean).map((line) => {
      const match = line.match(/^\[([^\]]+)\]:\s*(.*)$/);
      return { speaker_name: match ? match[1] : 'Speaker', text: match ? match[2] : line, timestamp: m.created_at };
    });
  }

  async deleteMeeting(meetingId) {
    await this._request(`/api/meetings/${encodeURIComponent(meetingId)}`, { method: 'DELETE' });
    return true;
  }
}

if (typeof window !== 'undefined') {
  window.SupabaseClient = SupabaseClient;
}
