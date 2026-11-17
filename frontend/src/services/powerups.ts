export interface HabitItem {
  id: string;
  title: string;
  target_per_week: number;
  completed_dates: string[];
  created_at?: string;
}

export interface GoalItem {
  id: string;
  title: string;
  category: string;
  target_date: string;
  progress: number;
  created_at?: string;
}

export interface JournalItem {
  id: string;
  entry_date: string;
  mood: string;
  win_text: string;
  blocker_text: string;
  created_at?: string;
}

export interface FlashcardItem {
  q: string;
  a: string;
}

export const SMART_NOTE_TEMPLATES = [
  {
    id: '1on1',
    name: '1-on-1 Meeting',
    icon: 'people',
    title: '1-on-1 Sync Notes',
    content: `<h2>1-on-1 Check-in</h2><p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p><h3>Wins & Highlights</h3><ul><li>What went well this week?</li></ul><h3>Challenges & Blockers</h3><ul><li>Where do you need support?</li></ul><h3>Action Items</h3><ul><li>[ ] Follow-up item</li></ul>`
  },
  {
    id: 'prd',
    name: 'Product Spec (PRD)',
    icon: 'architecture',
    title: 'Product Requirements Document',
    content: `<h2>Problem Statement</h2><p>Describe the user pain point...</p><h2>Goals & Success Metrics</h2><ul><li>Target KPI:</li></ul><h2>User Flow & Scope</h2><ul><li>Phase 1 (MVP):</li><li>Out of Scope:</li></ul>`
  },
  {
    id: 'retro',
    name: 'Sprint Retro',
    icon: 'replay',
    title: 'Sprint Retrospective',
    content: `<h2>Sprint Retrospective</h2><h3>What Went Well</h3><ul><li>...</li></ul><h3>What Can Improve</h3><ul><li>...</li></ul><h3>Action Items for Next Sprint</h3><ul><li>[ ] Owner: ...</li></ul>`
  },
  {
    id: 'cornell',
    name: 'Cornell Study Notes',
    icon: 'school',
    title: 'Study Notes — Topic',
    content: `<h2>Key Questions / Cues</h2><ul><li>Main concept?</li></ul><h2>Detailed Notes</h2><p>Write lecture or reading notes here...</p><h2>Summary (2-3 sentences)</h2><p>Key takeaway...</p>`
  },
  {
    id: 'bug',
    name: 'Bug Report',
    icon: 'bug_report',
    title: 'Bug Investigation Report',
    content: `<h2>Bug Summary</h2><p><strong>Severity:</strong> High / Medium</p><h3>Steps to Reproduce</h3><ol><li>Step 1</li><li>Step 2</li></ol><h3>Expected vs Actual</h3><p>Expected: ... | Actual: ...</p>`
  }
];

export const AI_PERSONAS = [
  {
    id: 'default',
    label: 'Workspace Copilot',
    icon: 'smart_toy',
    instruction: ''
  },
  {
    id: 'coach',
    label: 'Executive Coach',
    icon: 'psychology',
    instruction: 'Act as a sharp Executive Productivity Coach. Give strategic, prioritized, high-leverage advice: '
  },
  {
    id: 'architect',
    label: 'Senior Architect',
    icon: 'code',
    instruction: 'Act as a Staff Software Architect. Focus on clean system design, scalability, security, and concise code examples: '
  },
  {
    id: 'writer',
    label: 'Marketing Copywriter',
    icon: 'campaign',
    instruction: 'Act as an expert B2B SaaS Copywriter. Write crisp, persuasive, conversion-focused copy: '
  },
  {
    id: 'legal',
    label: 'Contract Analyst',
    icon: 'gavel',
    instruction: 'Act as a careful Legal & Contract Analyst. Highlight risks, liabilities, and key clauses clearly: '
  },
  {
    id: 'bengali',
    label: 'Bengali-English Tutor',
    icon: 'translate',
    instruction: 'Respond clearly in natural Bengali/Banglish mixed with clean English technical terms so it is super easy to understand: '
  }
];

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('renim_jwt_token') || localStorage.getItem('renim_access_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function reqJson<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, headers: { ...getHeaders(), ...(opts?.headers || {}) } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export const fetchHabits = (email: string) =>
  reqJson<{ habits: HabitItem[] }>(`/api/powerups/habits?user_email=${encodeURIComponent(email)}`);

export const createHabit = (title: string, targetPerWeek: number, email: string) =>
  reqJson<{ habit: HabitItem }>('/api/powerups/habits', {
    method: 'POST',
    body: JSON.stringify({ title, target_per_week: targetPerWeek, user_email: email })
  });

export const toggleHabitToday = (habitId: string, dateStr: string, email: string) =>
  reqJson<{ habit: HabitItem }>(`/api/powerups/habits/${encodeURIComponent(habitId)}/toggle`, {
    method: 'POST',
    body: JSON.stringify({ date_str: dateStr, user_email: email })
  });

export const deleteHabit = (habitId: string, email: string) =>
  reqJson<{ deleted: boolean }>(`/api/powerups/habits/${encodeURIComponent(habitId)}?user_email=${encodeURIComponent(email)}`, {
    method: 'DELETE'
  });

export const fetchGoals = (email: string) =>
  reqJson<{ goals: GoalItem[] }>(`/api/powerups/goals?user_email=${encodeURIComponent(email)}`);

export const createGoal = (title: string, category: string, targetDate: string, email: string) =>
  reqJson<{ goal: GoalItem }>('/api/powerups/goals', {
    method: 'POST',
    body: JSON.stringify({ title, category, target_date: targetDate, progress: 0, user_email: email })
  });

export const updateGoalProgress = (goalId: string, progress: number, email: string) =>
  reqJson<{ goal: GoalItem }>(`/api/powerups/goals/${encodeURIComponent(goalId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ progress, user_email: email })
  });

export const deleteGoal = (goalId: string, email: string) =>
  reqJson<{ deleted: boolean }>(`/api/powerups/goals/${encodeURIComponent(goalId)}?user_email=${encodeURIComponent(email)}`, {
    method: 'DELETE'
  });

export const fetchJournals = (email: string) =>
  reqJson<{ journals: JournalItem[] }>(`/api/powerups/journals?user_email=${encodeURIComponent(email)}`);

export const createJournal = (mood: string, winText: string, blockerText: string, email: string) =>
  reqJson<{ journal: JournalItem }>('/api/powerups/journals', {
    method: 'POST',
    body: JSON.stringify({ mood, win_text: winText, blocker_text: blockerText, user_email: email })
  });

export const generateWeeklyWinReport = (email: string, aiCfg?: { api_key?: string; model?: string; base_url?: string }) =>
  reqJson<{ report: string }>('/api/powerups/journals/weekly-report', {
    method: 'POST',
    body: JSON.stringify({ user_email: email, ...(aiCfg || {}) })
  });

export const summarizeWebUrl = (url: string, email: string, aiCfg?: { api_key?: string; model?: string; base_url?: string }) =>
  reqJson<{ title: string; url: string; summary: string }>('/api/powerups/summarize-url', {
    method: 'POST',
    body: JSON.stringify({ url, user_email: email, ...(aiCfg || {}) })
  });

export const generateFlashcardsApi = (
  title: string,
  content: string,
  email: string,
  aiCfg?: { api_key?: string; model?: string; base_url?: string }
) =>
  reqJson<{ flashcards: FlashcardItem[] }>('/api/powerups/flashcards', {
    method: 'POST',
    body: JSON.stringify({ title, content, count: 6, user_email: email, ...(aiCfg || {}) })
  });
