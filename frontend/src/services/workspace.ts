/**
 * Renim AI — TypeScript Services & Domain Types
 * Connects to Python FastAPI + Neon Serverless PostgreSQL + 2Coms AIM Qwen 2.5 Gateway
 * Includes resilient Local Storage caching and Web Audio / Speech engines.
 */

export interface ActionItem {
  task: string;
  owner?: string;
  priority?: 'High' | 'Medium' | 'Low' | string;
}

export interface Meeting {
  id: string;
  title: string;
  duration_seconds?: number;
  word_count?: number;
  raw_transcript?: string;
  summary?: string;
  key_points?: string[];
  decisions?: string[];
  action_items?: ActionItem[];
  created_at: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  folder?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface SubTask {
  title: string;
  done: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  priority: 'High' | 'Medium' | 'Low' | string;
  status: 'todo' | 'in_progress' | 'review' | 'done' | string;
  due_date?: string | null;
  assignee?: string;
  source_type?: string;
  source_id?: string;
  subtasks?: SubTask[];
  created_at?: string;
}

export interface UserDocument {
  id: string;
  user_email: string;
  filename: string;
  file_type: string;
  file_size: number;
  summary: string;
  preview?: string;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  event_date: string;
  start_time: string;
  end_time?: string | null;
  category: 'Work' | 'Meeting' | 'Deadline' | 'Personal' | string;
  reminder_minutes?: number;
  _notified?: boolean;
  created_at?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatSession {
  id: string;
  user_email: string;
  title: string;
  messages: ChatMessage[];
  created_at?: string;
  updated_at?: string;
}

// ================= 1. UNIFIED DATABASE CLIENT (FASTAPI + NEON + LOCAL CACHE) =================

export class DatabaseClient {
  url = '';
  anonKey = '';
  accessToken: string | null = null;
  activeOrgId: string = 'personal';
  user = {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'guest@renimai.com',
    full_name: 'Renim AI User'
  };

  init() {
    if (typeof window === 'undefined') return;
    this.url = (localStorage.getItem('sb_url') || '').replace(/\/$/, '');
    this.anonKey = localStorage.getItem('sb_anon') || 'Neon Database Active';
    const storedSession = localStorage.getItem('sb_session');
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession);
        this.accessToken = parsed.access_token && parsed.access_token !== 'neon-session-token' ? parsed.access_token : null;
        if (this.accessToken && parsed.user) {
          this.user = parsed.user;
        }
      } catch {
        localStorage.removeItem('sb_session');
      }
    }
  }

  isAuthenticated(): boolean {
    return Boolean(this.accessToken && this.accessToken !== 'neon-session-token');
  }

  private getAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { ...extra };
    if (this.accessToken && this.accessToken !== 'neon-session-token') {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    if (this.activeOrgId && this.activeOrgId !== 'personal') {
      headers['X-Org-Id'] = this.activeOrgId;
    }
    return headers;
  }

  private apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
    const existingHeaders = (init.headers as Record<string, string>) || {};
    return fetch(url, {
      ...init,
      headers: this.getAuthHeaders(existingHeaders),
    });
  }

  setConfig(url: string, anonKey: string) {
    this.url = (url || '').trim().replace(/\/$/, '');
    this.anonKey = (anonKey || '').trim();
    localStorage.setItem('sb_url', this.url);
    localStorage.setItem('sb_anon', this.anonKey);
  }

  async signUp(email: string, password: string, fullName = '') {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: fullName })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }
    this.user = data.user;
    this.accessToken = data.access_token || null;
    localStorage.setItem('sb_session', JSON.stringify({ access_token: this.accessToken, user: this.user }));
    return { user: this.user };
  }

  async signIn(email: string, password: string) {
    const res = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Invalid credentials');
    }
    this.user = data.user;
    this.accessToken = data.access_token || null;
    localStorage.setItem('sb_session', JSON.stringify({ access_token: this.accessToken, user: this.user }));
    return { user: this.user };
  }

  signOut() {
    this.accessToken = null;
    this.user = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'guest@renimai.com',
      full_name: 'Renim AI User'
    };
    localStorage.removeItem('sb_session');
  }

  getUserEmail(): string {
    return (this.user?.email || 'guest@renimai.com').toLowerCase().trim();
  }

  private getStorageKey(prefix: string): string {
    return `${prefix}_${this.getUserEmail()}`;
  }

  // --- Meetings (Per-User Isolated) ---
  async getMeetings(): Promise<Meeting[]> {
    const email = this.getUserEmail();
    const key = this.getStorageKey('cached_meetings');
    try {
      const res = await this.apiFetch(`/api/meetings?user_email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          localStorage.setItem(key, JSON.stringify(data));
          return data;
        }
      }
    } catch {}
    return JSON.parse(localStorage.getItem(key) || '[]');
  }

  async saveMeeting(meetingData: Partial<Meeting>): Promise<Meeting> {
    const email = this.getUserEmail();
    const key = this.getStorageKey('cached_meetings');
    try {
      const res = await this.apiFetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...meetingData, user_email: email })
      });
      if (res.ok) return await res.json();
    } catch {}
    const local: Meeting[] = JSON.parse(localStorage.getItem(key) || '[]');
    const newM: Meeting = {
      id: 'm_' + Date.now(),
      title: meetingData.title || 'New Meeting Session',
      raw_transcript: meetingData.raw_transcript || '',
      summary: meetingData.summary || '',
      key_points: meetingData.key_points || [],
      decisions: meetingData.decisions || [],
      action_items: meetingData.action_items || [],
      created_at: new Date().toISOString()
    };
    local.unshift(newM);
    localStorage.setItem(key, JSON.stringify(local));
    return newM;
  }

  async deleteMeeting(id: string): Promise<boolean> {
    const key = this.getStorageKey('cached_meetings');
    try {
      await this.apiFetch(`/api/meetings/${id}`, { method: 'DELETE' });
    } catch {}
    const local: Meeting[] = JSON.parse(localStorage.getItem(key) || '[]').filter((m: Meeting) => m.id !== id);
    localStorage.setItem(key, JSON.stringify(local));
    return true;
  }

  // --- Notes (Per-User Isolated) ---
  async getNotes(): Promise<Note[]> {
    const email = this.getUserEmail();
    const key = this.getStorageKey('cached_notes');
    try {
      const res = await this.apiFetch(`/api/notes?user_email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          localStorage.setItem(key, JSON.stringify(data));
          return data;
        }
      }
    } catch {}
    return JSON.parse(localStorage.getItem(key) || '[]');
  }

  async createNote(noteData: Partial<Note>): Promise<Note> {
    const email = this.getUserEmail();
    const key = this.getStorageKey('cached_notes');
    try {
      const res = await this.apiFetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...noteData, user_email: email })
      });
      if (res.ok) return await res.json();
    } catch {}
    const local: Note[] = JSON.parse(localStorage.getItem(key) || '[]');
    const newN: Note = {
      id: 'n_' + Date.now(),
      title: noteData.title || 'Untitled Note',
      content: noteData.content || '',
      folder: noteData.folder || 'General',
      updated_at: new Date().toISOString()
    };
    local.unshift(newN);
    localStorage.setItem(key, JSON.stringify(local));
    return newN;
  }

  async updateNote(id: string, noteData: Partial<Note>): Promise<Note> {
    const email = this.getUserEmail();
    const key = this.getStorageKey('cached_notes');
    try {
      const res = await this.apiFetch(`/api/notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...noteData, user_email: email })
      });
      if (res.ok) return await res.json();
    } catch {}
    const local: Note[] = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = local.findIndex((n: Note) => n.id === id);
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...noteData, updated_at: new Date().toISOString() };
      localStorage.setItem(key, JSON.stringify(local));
      return local[idx];
    }
    return { id, title: noteData.title || 'Untitled Note', content: noteData.content || '' };
  }

  async deleteNote(id: string): Promise<boolean> {
    const key = this.getStorageKey('cached_notes');
    try {
      await this.apiFetch(`/api/notes/${id}`, { method: 'DELETE' });
    } catch {}
    const local: Note[] = JSON.parse(localStorage.getItem(key) || '[]').filter((n: Note) => n.id !== id);
    localStorage.setItem(key, JSON.stringify(local));
    return true;
  }

  // --- Tasks (Per-User Isolated) ---
  async getTasks(): Promise<TaskItem[]> {
    const email = this.getUserEmail();
    const key = this.getStorageKey('cached_tasks');
    try {
      const res = await this.apiFetch(`/api/tasks?user_email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          localStorage.setItem(key, JSON.stringify(data));
          return data;
        }
      }
    } catch {}
    return JSON.parse(localStorage.getItem(key) || '[]');
  }

  async createTask(taskData: Partial<TaskItem>): Promise<TaskItem> {
    const email = this.getUserEmail();
    const key = this.getStorageKey('cached_tasks');
    try {
      const res = await this.apiFetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...taskData, user_email: email })
      });
      if (res.ok) return await res.json();
    } catch {}
    const local: TaskItem[] = JSON.parse(localStorage.getItem(key) || '[]');
    const newT: TaskItem = {
      id: 't_' + Date.now(),
      title: taskData.title || 'New Task',
      priority: taskData.priority || 'Medium',
      status: taskData.status || 'todo',
      due_date: taskData.due_date || null,
      created_at: new Date().toISOString()
    };
    local.unshift(newT);
    localStorage.setItem(key, JSON.stringify(local));
    return newT;
  }

  async updateTask(id: string, taskData: Partial<TaskItem>): Promise<TaskItem> {
    const email = this.getUserEmail();
    const key = this.getStorageKey('cached_tasks');
    try {
      const res = await this.apiFetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...taskData, user_email: email })
      });
      if (res.ok) return await res.json();
    } catch {}
    const local: TaskItem[] = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = local.findIndex((t: TaskItem) => t.id === id);
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...taskData };
      localStorage.setItem(key, JSON.stringify(local));
      return local[idx];
    }
    return { id, title: taskData.title || '', priority: 'Medium', status: taskData.status || 'todo' };
  }

  async deleteTask(id: string): Promise<boolean> {
    const key = this.getStorageKey('cached_tasks');
    try {
      await this.apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
    } catch {}
    const local: TaskItem[] = JSON.parse(localStorage.getItem(key) || '[]').filter((t: TaskItem) => t.id !== id);
    localStorage.setItem(key, JSON.stringify(local));
    return true;
  }

  // --- Calendar Events (Per-User Isolated) ---
  async getCalendarEvents(): Promise<CalendarEvent[]> {
    const email = this.getUserEmail();
    const key = this.getStorageKey('cached_events');
    try {
      const res = await this.apiFetch(`/api/calendar?user_email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          localStorage.setItem(key, JSON.stringify(data));
          return data;
        }
      }
    } catch {}
    return JSON.parse(localStorage.getItem(key) || '[]');
  }

  async createCalendarEvent(eventData: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const email = this.getUserEmail();
    const key = this.getStorageKey('cached_events');
    try {
      const res = await this.apiFetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...eventData, user_email: email })
      });
      if (res.ok) return await res.json();
    } catch {}
    const local: CalendarEvent[] = JSON.parse(localStorage.getItem(key) || '[]');
    const newE: CalendarEvent = {
      id: 'e_' + Date.now(),
      title: eventData.title || 'New Event',
      event_date: eventData.event_date || new Date().toISOString().slice(0, 10),
      start_time: eventData.start_time || '10:00',
      category: eventData.category || 'Work',
      reminder_minutes: eventData.reminder_minutes || 15,
      created_at: new Date().toISOString()
    };
    local.push(newE);
    localStorage.setItem(key, JSON.stringify(local));
    return newE;
  }

  async deleteCalendarEvent(id: string): Promise<boolean> {
    const key = this.getStorageKey('cached_events');
    try {
      await this.apiFetch(`/api/calendar/${id}`, { method: 'DELETE' });
    } catch {}
    const local: CalendarEvent[] = JSON.parse(localStorage.getItem(key) || '[]').filter((e: CalendarEvent) => e.id !== id);
    localStorage.setItem(key, JSON.stringify(local));
    return true;
  }

  exportCalendarICS(): void {
    const email = this.getUserEmail();
    const link = document.createElement('a');
    link.href = `/api/calendar/export-ics?user_email=${encodeURIComponent(email)}`;
    link.download = 'renim_ai_calendar.ics';
    link.click();
  }

  async importCalendarICS(file: File): Promise<{ imported: boolean; count: number }> {
    const email = this.getUserEmail();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_email', email);
    const res = await this.apiFetch('/api/calendar/import-ics', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Import failed' }));
      throw new Error(err.error || 'Import failed');
    }
    return await res.json();
  }

  async sendEmailNotification(payload: { to_email: string; subject: string; html_content: string; resend_api_key?: string }): Promise<any> {
    const res = await this.apiFetch('/api/notifications/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Email dispatch failed' }));
      throw new Error(err.error || 'Email dispatch failed');
    }
    return await res.json();
  }

  // --- Chat Sessions (User & Session-wise History) ---
  private getChatStorageKey(): string {
    const email = (this.user?.email || 'guest@renimai.com').toLowerCase().trim();
    return `cached_chat_sessions_${email}`;
  }

  async getChatSessions(): Promise<ChatSession[]> {
    const email = (this.user?.email || 'guest@renimai.com').toLowerCase().trim();
    const key = this.getChatStorageKey();
    try {
      const res = await this.apiFetch(`/api/chat/sessions?user_email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          localStorage.setItem(key, JSON.stringify(data));
          return data;
        }
      }
    } catch {}
    return JSON.parse(localStorage.getItem(key) || '[]');
  }

  async saveChatSession(sessionData: Partial<ChatSession>): Promise<ChatSession> {
    const email = (this.user?.email || 'guest@renimai.com').toLowerCase().trim();
    const key = this.getChatStorageKey();
    const payload = {
      ...sessionData,
      user_email: email
    };

    try {
      const res = await this.apiFetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const saved = await res.json();
        const local: ChatSession[] = JSON.parse(localStorage.getItem(key) || '[]');
        const idx = local.findIndex(s => s.id === saved.id || (sessionData.id && s.id === sessionData.id));
        if (idx !== -1) {
          local[idx] = saved;
        } else {
          local.unshift(saved);
        }
        localStorage.setItem(key, JSON.stringify(local));
        return saved;
      }
    } catch {}

    const local: ChatSession[] = JSON.parse(localStorage.getItem(key) || '[]');
    const existingIdx = sessionData.id ? local.findIndex(s => s.id === sessionData.id) : -1;
    const nowIso = new Date().toISOString();

    if (existingIdx !== -1) {
      local[existingIdx] = {
        ...local[existingIdx],
        title: sessionData.title || local[existingIdx].title || 'Conversation',
        messages: sessionData.messages || local[existingIdx].messages || [],
        updated_at: nowIso
      };
      localStorage.setItem(key, JSON.stringify(local));
      return local[existingIdx];
    }

    const newS: ChatSession = {
      id: sessionData.id || 's_' + Date.now(),
      user_email: email,
      title: sessionData.title || 'New Conversation',
      messages: sessionData.messages || [],
      created_at: nowIso,
      updated_at: nowIso
    };
    local.unshift(newS);
    localStorage.setItem(key, JSON.stringify(local));
    return newS;
  }

  async deleteChatSession(id: string): Promise<boolean> {
    const key = this.getChatStorageKey();
    try {
      await this.apiFetch(`/api/chat/sessions/${id}`, { method: 'DELETE' });
    } catch {}
    const local: ChatSession[] = JSON.parse(localStorage.getItem(key) || '[]').filter((s: ChatSession) => s.id !== id);
    localStorage.setItem(key, JSON.stringify(local));
    return true;
  }

  // --- User Documents (PDF & Docs Knowledge Hub) ---
  async getDocuments(): Promise<UserDocument[]> {
    const email = this.getUserEmail();
    const key = this.getStorageKey('cached_documents');
    try {
      const res = await this.apiFetch(`/api/documents?user_email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          localStorage.setItem(key, JSON.stringify(data));
          return data;
        }
      }
    } catch {}
    return JSON.parse(localStorage.getItem(key) || '[]');
  }

  async uploadDocument(file: File): Promise<UserDocument> {
    const email = this.getUserEmail();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_email', email);

    const res = await this.apiFetch('/api/documents/upload', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      throw new Error('Failed to upload document');
    }
    const newDoc = await res.json();
    const key = this.getStorageKey('cached_documents');
    const local = JSON.parse(localStorage.getItem(key) || '[]');
    local.unshift(newDoc);
    localStorage.setItem(key, JSON.stringify(local));
    return newDoc;
  }

  async deleteDocument(id: string): Promise<boolean> {
    const key = this.getStorageKey('cached_documents');
    try {
      await this.apiFetch(`/api/documents/${id}`, { method: 'DELETE' });
    } catch {}
    const local = JSON.parse(localStorage.getItem(key) || '[]').filter((d: UserDocument) => d.id !== id);
    localStorage.setItem(key, JSON.stringify(local));
    return true;
  }

  async chatWithDocument(docId: string, question: string, history: { role: string; content: string }[] = []): Promise<{ reply: string }> {
    const res = await this.apiFetch(`/api/documents/${docId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, history }),
    });
    if (!res.ok) {
      throw new Error('Document chat failed');
    }
    return await res.json();
  }

  // --- Task Breakdown ---
  async breakdownTask(taskId: string): Promise<TaskItem> {
    const res = await this.apiFetch(`/api/tasks/${taskId}/breakdown`, { method: 'POST' });
    if (!res.ok) throw new Error('Task breakdown failed');
    const updated = await res.json();
    const key = this.getStorageKey('cached_tasks');
    const local: TaskItem[] = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = local.findIndex((t: TaskItem) => t.id === taskId);
    if (idx !== -1) {
      local[idx] = updated;
      localStorage.setItem(key, JSON.stringify(local));
    }
    return updated;
  }

  // --- Email Drafting ---
  async draftEmail(payload: { source_text: string; tone: string; recipient?: string; objective?: string }): Promise<{ subject: string; body: string }> {
    const res = await this.apiFetch('/api/ai/draft-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Email drafting failed');
    return await res.json();
  }
}

// ================= 2. AI GATEWAY ENGINE (FASTAPI ZERO-CORS PROXY + DIRECT FALLBACK) =================

export class AIEngine {
  gatewayUrl = 'https://2c-aim-api.2coms.com/v1';
  apiKey = 'twocoms_dev_z0_q6r3';
  model = 'qwen2.5';

  init() {
    if (typeof window === 'undefined') return;
    this.gatewayUrl = (localStorage.getItem('ai_url') || 'https://2c-aim-api.2coms.com/v1').trim().replace(/\/$/, '');
    this.apiKey = (localStorage.getItem('ai_key') || 'twocoms_dev_z0_q6r3').trim();
    this.model = (localStorage.getItem('ai_model') || 'qwen2.5').trim();
  }

  setConfig(gatewayUrl: string, apiKey: string, model: string) {
    this.gatewayUrl = (gatewayUrl || 'https://2c-aim-api.2coms.com/v1').trim().replace(/\/$/, '');
    this.apiKey = (apiKey || '').trim();
    this.model = (model || 'qwen2.5').trim();
    localStorage.setItem('ai_url', this.gatewayUrl);
    localStorage.setItem('ai_key', this.apiKey);
    localStorage.setItem('ai_model', this.model);
  }

  async callLLM(messages: ChatMessage[], temperature = 0.3): Promise<string> {
    const payload = {
      model: this.model || 'qwen2.5',
      messages,
      temperature
    };

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (typeof window !== 'undefined') {
        try {
          const s = JSON.parse(localStorage.getItem('sb_session') || '{}');
          if (s?.access_token && s.access_token !== 'neon-session-token') {
            headers['Authorization'] = `Bearer ${s.access_token}`;
          }
        } catch {}
      }
      const proxyRes = await fetch('/api/ai/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      if (proxyRes.status === 402 || proxyRes.status === 403) {
        const err = await proxyRes.json().catch(() => ({}));
        throw new Error(err.error || 'AI access restricted');
      }
      if (proxyRes.ok) {
        const data = await proxyRes.json();
        return data.choices?.[0]?.message?.content?.trim() || '';
      }
    } catch (err: any) {
      if (err?.message && (err.message.includes('credit limit') || err.message.includes('suspended'))) {
        throw err;
      }
    }

    const endpoint = this.gatewayUrl.endsWith('/chat/completions')
      ? this.gatewayUrl
      : `${this.gatewayUrl}/chat/completions`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || err.message || `AI request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
  }

  async summarizeMeeting(transcript: string, title = 'Meeting Session') {
    const systemPrompt = `You are an elite, executive-level meeting intelligence assistant.
Analyze the provided meeting dialogue and output a clean, valid JSON object strictly matching this schema:
{
  "title": "A crisp, descriptive meeting title",
  "summary": "A 2-3 paragraph executive summary covering objectives, discussions, and outcomes.",
  "key_points": ["Point 1", "Point 2", "Point 3"],
  "decisions": ["Decision 1", "Decision 2"],
  "action_items": [
    {
      "task": "Specific actionable task",
      "owner": "Person name or 'Me'",
      "priority": "High" | "Medium" | "Low"
    }
  ]
}
Return ONLY valid raw JSON without markdown fences.`;

    const raw = await this.callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Meeting Title: ${title}\n\nTranscript:\n${transcript}` }
    ]);

    return this.parseJson(raw, {
      title,
      summary: raw,
      key_points: [],
      decisions: [],
      action_items: []
    });
  }

  async processNoteWithAI(content: string, command: string): Promise<string> {
    const systemPrompt = 'You are an intelligent note-taking and writing assistant.';
    let userPrompt = `Content:\n${content}\n\n`;

    switch (command) {
      case 'summarize':
        userPrompt += 'Provide a high-impact, bulleted executive summary of the content above.';
        break;
      case 'action_items':
        userPrompt += 'Extract all actionable tasks, to-dos, and commitments from this note with checkmarks.';
        break;
      case 'professional':
        userPrompt += 'Rewrite this note with executive polish, crisp structure, and professional tone while preserving all key details.';
        break;
      case 'expand':
        userPrompt += 'Brainstorm relevant ideas, strategic next steps, and considerations to expand on this topic.';
        break;
      case 'fix_grammar':
        userPrompt += 'Fix any spelling, punctuation, and grammatical mistakes. Improve clarity without changing meaning.';
        break;
      case 'translate_bn':
        userPrompt += 'Translate this entire note into natural, accurate, fluent Bengali (বাংলা). Maintain clear formatting and bullet points.';
        break;
      case 'translate_en':
        userPrompt += 'Translate this entire note into crisp, professional, high-level English (US). Maintain clear structure and executive clarity.';
        break;
      case 'tone_clevel':
        userPrompt += 'Transform this note into a high-stakes C-Level Executive Briefing with Strategic Highlights, Key Metrics, and Critical Action Items.';
        break;
      case 'tone_pitch':
        userPrompt += 'Rewrite this note as an engaging, persuasive Client & Investor Pitch emphasizing unique value, ROI, and clear next steps.';
        break;
      case 'polish_voice_memo':
        userPrompt += 'You received an unedited, dictated spoken voice memo. Clean it up into a structured, executive-ready note with a bold title, key takeaways, and action items.';
        break;
      default:
        userPrompt += 'Improve this note and make it clear, concise, and structured.';
        break;
    }

    return await this.callLLM(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      0.4
    );
  }

  async generateDailyBriefing(todayEvents: CalendarEvent[], pendingTasks: TaskItem[], recentNotes: Note[]): Promise<string> {
    const userName = (this.user?.full_name || this.user?.email || 'User').split('@')[0];
    const systemPrompt = `You are Renim AI, the user's personal executive chief-of-staff.
Generate an inspiring, crisp, structured Morning Briefing for today.
The user's name is ${userName}.
Include:
1. Quick Motivational Opener (1 line) using their name.
2. Today's Key Schedule (High-impact summary of events)
3. Top 3 Priority Focus Tasks
4. Smart Recommendation / Productivity Tip
Keep it energetic, clear, and professional.`;

    const todayDateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const context = `
TODAY'S DATE: ${todayDateStr}

TODAY'S CALENDAR EVENTS:
${todayEvents.length > 0 ? todayEvents.map(e => `- ${e.start_time}: ${e.title} (${e.category})`).join('\n') : 'No scheduled events today.'}

PENDING HIGH/MEDIUM PRIORITY TASKS:
${pendingTasks.length > 0 ? pendingTasks.map(t => `- [${t.priority}] ${t.title} ${t.due_date ? '(Due: ' + t.due_date + ')' : ''}`).join('\n') : 'No pending tasks.'}

RECENT NOTES HIGHLIGHTS:
${recentNotes.length > 0 ? recentNotes.slice(0, 3).map(n => `- ${n.title}`).join('\n') : 'No recent notes.'}
`;

    return await this.callLLM(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: context }
      ],
      0.5
    );
  }

  async chatWithWorkspace(
    userQuery: string,
    workspaceData: { meetings: Meeting[]; notes: Note[]; tasks: TaskItem[]; events: CalendarEvent[] },
    chatHistory: ChatMessage[] = []
  ): Promise<string> {
    const systemPrompt = `You are Renim AI Copilot, a powerful and intelligent personal workspace assistant. You have full awareness of the user's workspace including their meetings, notes, tasks, and calendar events.
Answer the user's query accurately, referencing relevant items from their workspace context.
IMPORTANT: You are exclusively Renim AI Copilot. Do NOT mention "2COMS" or any "group portal".
If specific information is not in the context, be helpful, concise, and state what is available.`;

    const wantsSearch = /search\s*(web|browser|internet|online)|look\s*up/i.test(userQuery) || userQuery.toLowerCase().includes("search");
    let searchContext = "";
    if (wantsSearch) {
      try {
        const searchRes = await fetch('/api/ai/search?q=' + encodeURIComponent(userQuery));
        if (searchRes.ok) {
          const data = await searchRes.json();
          if (data.results && data.results !== "No results found.") {
            searchContext = `\n\n=== WEB SEARCH RESULTS ===\n${data.results}\n\nCRITICAL INSTRUCTION: You DO have access to the internet, and the above results are real-time web search results fetched for you just now. You MUST use them to answer the user's question. NEVER say you don't have access to the internet, web browsers, or real-time searches. NEVER mention your knowledge cutoff date.`;
          }
        }
      } catch (e) {}
    }

    const stripHtmlForContext = (raw: string) =>
      String(raw || '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .trim();

    const contextPayload = `
=== USER WORKSPACE CONTEXT ===

RECENT MEETINGS:
${workspaceData.meetings?.slice(0, 5).map(m => `* Title: ${m.title} | Summary: ${m.summary} | Decisions: ${JSON.stringify(m.decisions)}`).join('\n\n') || 'None'}

NOTES:
${workspaceData.notes?.slice(0, 8).map(n => `* Note [${n.title}]:\n${stripHtmlForContext(n.content || '').slice(0, 2000)}`).join('\n\n') || 'None'}

TASKS & TO-DOS:
${workspaceData.tasks?.slice(0, 10).map(t => `* [${t.status}] (${t.priority}) ${t.title}`).join('\n') || 'None'}

UPCOMING CALENDAR EVENTS:
${workspaceData.events?.slice(0, 8).map(e => `* ${e.event_date} at ${e.start_time}: ${e.title}`).join('\n') || 'None'}
`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt + searchContext },
      { role: 'system', content: contextPayload },
      ...chatHistory.slice(-4),
      { role: 'user', content: userQuery }
    ];

    return await this.callLLM(messages, 0.3);
  }

  async classifyVoiceMemo(voiceText: string) {
    const systemPrompt = `Analyze the user's spoken voice memo and classify it.
Output valid raw JSON with this exact structure:
{
  "category": "task" | "note" | "event",
  "title": "Clean, concise title",
  "details": "Refined and structured text content",
  "priority": "High" | "Medium" | "Low",
  "date_or_deadline": "YYYY-MM-DD or null if not mentioned",
  "time": "HH:MM or null if not mentioned"
}`;

    const raw = await this.callLLM(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Voice input:\n"${voiceText}"` }
      ],
      0.2
    );

    return this.parseJson(raw, {
      category: 'note',
      title: 'Voice Note',
      details: voiceText,
      priority: 'Medium',
      date_or_deadline: null,
      time: null
    });
  }

  parseJson<T>(text: string, fallback: T): T {
    let clean = text.trim();
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '').trim();
    }
    try {
      return JSON.parse(clean) as T;
    } catch {
      return fallback;
    }
  }
}

// ================= 3. AUDIO RECORDER & CANVAS VISUALIZER ENGINE =================

export class AudioRecorderService {
  mediaStream: MediaStream | null = null;
  mediaRecorder: MediaRecorder | null = null;
  audioChunks: Blob[] = [];
  audioContext: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  animFrameId: number | null = null;
  recognition: any = null;
  isRecording = false;
  transcriptList: { speaker: string; text: string; time: string }[] = [];
  onTranscriptUpdate: ((res: { finalTranscripts: any[]; interimText: string; fullText: string }) => void) | null = null;

  isSpeechSupported(): boolean {
    return typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  }

  async startRecording(options: {
    source?: 'mic' | 'tab';
    canvasEl?: HTMLCanvasElement | null;
    onTranscript?: (res: { finalTranscripts: any[]; interimText: string; fullText: string }) => void;
  }) {
    this.transcriptList = [];
    this.audioChunks = [];
    this.onTranscriptUpdate = options.onTranscript || null;

    if (options.source === 'tab') {
      this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
    } else {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    }

    this.isRecording = true;

    if (options.canvasEl) {
      this.initVisualizer(options.canvasEl);
    }

    this.mediaRecorder = new MediaRecorder(this.mediaStream);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.audioChunks.push(e.data);
    };
    this.mediaRecorder.start(1000);

    this.initSpeechRecognition();
    return true;
  }

  private initVisualizer(canvas: HTMLCanvasElement) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      if (!this.mediaStream || !this.audioContext) return;
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (!this.isRecording || !this.analyser) return;
        this.animFrameId = requestAnimationFrame(draw);

        this.analyser.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 1.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height * 0.9;
          const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
          gradient.addColorStop(0, '#4f46e5');
          gradient.addColorStop(1, '#818cf8');

          ctx.fillStyle = gradient;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(x, (canvas.height - barHeight) / 2, barWidth - 2, Math.max(barHeight, 4), [3]);
          } else {
            ctx.rect(x, (canvas.height - barHeight) / 2, barWidth - 2, Math.max(barHeight, 4));
          }
          ctx.fill();

          x += barWidth;
        }
      };

      draw();
    } catch (e) {
      console.warn('Canvas visualizer failed to initialize:', e);
    }
  }

  private initSpeechRecognition() {
    if (!this.isSpeechSupported()) return;

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.recognition = new SpeechRec();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript.trim();
          if (text) {
            this.transcriptList.push({
              speaker: 'Speaker',
              text,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
          }
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (this.onTranscriptUpdate) {
        this.onTranscriptUpdate({
          finalTranscripts: this.transcriptList,
          interimText: interim,
          fullText: this.transcriptList.map(t => t.text).join(' ') + (interim ? ' ' + interim : '')
        });
      }
    };

    this.recognition.onend = () => {
      if (this.isRecording && this.recognition) {
        try {
          this.recognition.start();
        } catch {}
      }
    };

    try {
      this.recognition.start();
    } catch {}
  }

  stopRecording() {
    this.isRecording = false;

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    return {
      transcripts: this.transcriptList,
      fullText: this.transcriptList.map(t => t.text).join('\n')
    };
  }
}
