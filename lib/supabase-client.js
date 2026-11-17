/**
 * Renim AI - Lightweight Supabase Client for Chrome Extension (Manifest V3)
 * Full Auth & REST API support without external npm dependencies.
 */

class SupabaseClient {
  constructor() {
    this.url = '';
    this.anonKey = '';
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
  }

  async init(config = null) {
    if (config) {
      this.url = (config.url || '').replace(/\/$/, '');
      this.anonKey = config.anonKey || '';
    } else {
      const defaultEnv = (typeof window !== 'undefined' && window.ENV_CONFIG) || (typeof globalThis !== 'undefined' && globalThis.ENV_CONFIG) || {};
      const stored = await chrome.storage.local.get(['supabaseUrl', 'supabaseAnonKey', 'sb_session']);
      
      this.url = (stored.supabaseUrl || defaultEnv.SUPABASE_URL || '').replace(/\/$/, '');
      this.anonKey = stored.supabaseAnonKey || defaultEnv.SUPABASE_ANON_KEY || '';
      
      if (stored.sb_session) {
        this.accessToken = stored.sb_session.access_token;
        this.refreshToken = stored.sb_session.refresh_token;
        this.user = stored.sb_session.user;
      }
    }
  }

  isConfigured() {
    return Boolean(this.url && this.anonKey);
  }

  isAuthenticated() {
    return Boolean(this.accessToken && this.user);
  }

  async setConfig(url, anonKey) {
    this.url = (url || '').trim().replace(/\/$/, '');
    this.anonKey = (anonKey || '').trim();
    await chrome.storage.local.set({
      supabaseUrl: this.url,
      supabaseAnonKey: this.anonKey
    });
  }

  _getHeaders(useAuth = true) {
    const headers = {
      'apikey': this.anonKey,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
    if (useAuth && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    return headers;
  }

  async _saveSession(session) {
    if (session && session.access_token) {
      this.accessToken = session.access_token;
      this.refreshToken = session.refresh_token;
      this.user = session.user;
      await chrome.storage.local.set({ sb_session: session });
    } else {
      this.accessToken = null;
      this.refreshToken = null;
      this.user = null;
      await chrome.storage.local.remove('sb_session');
    }
  }

  // --- Authentication ---

  async signUp(email, password) {
    if (!this.isConfigured()) throw new Error('Supabase URL and Anon Key are not configured.');
    const response = await fetch(`${this.url}/auth/v1/signup`, {
      method: 'POST',
      headers: this._getHeaders(false),
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.msg || data.message || data.error_description || 'Signup failed');
    }
    if (data.session) {
      await this._saveSession(data.session);
    }
    return data;
  }

  async signIn(email, password) {
    if (!this.isConfigured()) throw new Error('Supabase URL and Anon Key are not configured.');
    const response = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: this._getHeaders(false),
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error_description || data.msg || data.message || 'Login failed');
    }
    await this._saveSession(data);
    return data;
  }

  async signOut() {
    if (this.accessToken) {
      try {
        await fetch(`${this.url}/auth/v1/logout`, {
          method: 'POST',
          headers: this._getHeaders(true)
        });
      } catch (err) {
        console.warn('Signout remote error:', err);
      }
    }
    await this._saveSession(null);
  }

  async refreshSession() {
    if (!this.refreshToken) return null;
    try {
      const response = await fetch(`${this.url}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: this._getHeaders(false),
        body: JSON.stringify({ refresh_token: this.refreshToken })
      });
      if (response.ok) {
        const data = await response.json();
        await this._saveSession(data);
        return data;
      }
    } catch (e) {
      console.warn('Session refresh failed:', e);
    }
    await this.signOut();
    return null;
  }

  // --- Database CRUD Operations ---

  async createMeeting(meetingData) {
    if (!this.isAuthenticated()) throw new Error('User not authenticated.');
    const payload = {
      ...meetingData,
      user_id: this.user.id
    };

    const response = await fetch(`${this.url}/rest/v1/meetings`, {
      method: 'POST',
      headers: this._getHeaders(true),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to save meeting.');
    }

    const saved = await response.json();
    return Array.isArray(saved) ? saved[0] : saved;
  }

  async updateMeeting(meetingId, updateData) {
    if (!this.isAuthenticated()) throw new Error('User not authenticated.');
    const response = await fetch(`${this.url}/rest/v1/meetings?id=eq.${meetingId}`, {
      method: 'PATCH',
      headers: this._getHeaders(true),
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to update meeting.');
    }
    const updated = await response.json();
    return Array.isArray(updated) ? updated[0] : updated;
  }

  async saveTranscripts(meetingId, transcriptList) {
    if (!this.isAuthenticated()) throw new Error('User not authenticated.');
    if (!transcriptList || transcriptList.length === 0) return [];

    const rows = transcriptList.map(t => ({
      meeting_id: meetingId,
      user_id: this.user.id,
      speaker_name: t.speaker || 'Unknown',
      text: t.text || '',
      timestamp: t.timestamp ? new Date(t.timestamp).toISOString() : new Date().toISOString()
    }));

    const response = await fetch(`${this.url}/rest/v1/transcripts`, {
      method: 'POST',
      headers: this._getHeaders(true),
      body: JSON.stringify(rows)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to save transcripts.');
    }
    return await response.json();
  }

  async getMeetings() {
    if (!this.isAuthenticated()) throw new Error('User not authenticated.');
    const response = await fetch(`${this.url}/rest/v1/meetings?select=*&order=created_at.desc`, {
      method: 'GET',
      headers: this._getHeaders(true)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to load meetings.');
    }
    return await response.json();
  }

  async getMeetingTranscripts(meetingId) {
    if (!this.isAuthenticated()) throw new Error('User not authenticated.');
    const response = await fetch(`${this.url}/rest/v1/transcripts?meeting_id=eq.${meetingId}&select=*&order=timestamp.asc`, {
      method: 'GET',
      headers: this._getHeaders(true)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to load transcripts.');
    }
    return await response.json();
  }

  async deleteMeeting(meetingId) {
    if (!this.isAuthenticated()) throw new Error('User not authenticated.');
    const response = await fetch(`${this.url}/rest/v1/meetings?id=eq.${meetingId}`, {
      method: 'DELETE',
      headers: this._getHeaders(true)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to delete meeting.');
    }
    return true;
  }
}

// Export singleton or class
if (typeof window !== 'undefined') {
  window.SupabaseClient = SupabaseClient;
}
