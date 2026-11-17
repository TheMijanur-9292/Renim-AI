import React, { useEffect, useState } from 'react';
import {
  fetchHabits,
  createHabit,
  toggleHabitToday,
  deleteHabit,
  fetchGoals,
  createGoal,
  updateGoalProgress,
  deleteGoal,
  fetchJournals,
  createJournal,
  generateWeeklyWinReport,
  summarizeWebUrl,
  generateFlashcardsApi,
  type HabitItem,
  type GoalItem,
  type JournalItem,
  type FlashcardItem
} from '../../services/powerups';
import { renderMarkdownToHtml } from '../../utils/markdown';
import type { Note } from '../../services/workspace';
import {
  generateMindMap,
  generateMeetingFollowup,
  type MindMapResult
} from '../../services/tenant';

interface GrowthHubViewProps {
  userEmail: string;
  notes: Note[];
  onSaveUrlAsNote: (title: string, content: string) => Promise<void>;
  showToast: (msg: string) => void;
}

type HubTab = 'habits' | 'goals' | 'journal' | 'url' | 'flashcards' | 'mindmap';

function getLast28Days(): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 27; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function calcStreak(dates: string[]): number {
  const set = new Set(dates);
  let streak = 0;
  const d = new Date();
  while (true) {
    const s = d.toISOString().slice(0, 10);
    if (set.has(s)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else if (streak === 0) {
      // allow checking yesterday if today not checked yet
      d.setDate(d.getDate() - 1);
      const y = d.toISOString().slice(0, 10);
      if (set.has(y)) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    } else {
      break;
    }
  }
  return streak;
}

export const GrowthHubView: React.FC<GrowthHubViewProps> = ({
  userEmail,
  notes,
  onSaveUrlAsNote,
  showToast
}) => {
  const [tab, setTab] = useState<HubTab>('habits');
  const todayStr = new Date().toISOString().slice(0, 10);
  const last28 = getLast28Days();

  // Habits
  const [habits, setHabits] = useState<HabitItem[]>([]);
  const [habitTitle, setHabitTitle] = useState('');

  // Goals
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalCategory, setGoalCategory] = useState('Work');
  const [goalDate, setGoalDate] = useState('');

  // Journal
  const [journals, setJournals] = useState<JournalItem[]>([]);
  const [mood, setMood] = useState('🚀');
  const [winText, setWinText] = useState('');
  const [blockerText, setBlockerText] = useState('');
  const [weeklyReport, setWeeklyReport] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  // URL Summarizer
  const [urlInput, setUrlInput] = useState('');
  const [urlResult, setUrlResult] = useState<{ title: string; url: string; summary: string } | null>(null);
  const [urlLoading, setUrlLoading] = useState(false);

  // Flashcards
  const [fcTitle, setFcTitle] = useState('');
  const [fcContent, setFcContent] = useState('');
  const [flashcards, setFlashcards] = useState<FlashcardItem[]>([]);
  const [flippedIdx, setFlippedIdx] = useState<Record<number, boolean>>({});
  const [fcLoading, setFcLoading] = useState(false);

  // Mind-Map & Meeting Follow-Up
  const [mmTitle, setMmTitle] = useState('');
  const [mmContent, setMmContent] = useState('');
  const [mindMap, setMindMap] = useState<MindMapResult | null>(null);
  const [mmLoading, setMmLoading] = useState(false);
  const [followupResult, setFollowupResult] = useState<{ subject?: string; email_body?: string; action_items?: string[] } | null>(null);

  const getAiCfg = () =>
    typeof window !== 'undefined'
      ? {
          api_key: localStorage.getItem('renim_ai_api_key') || undefined,
          model: localStorage.getItem('renim_ai_model') || undefined,
          base_url: localStorage.getItem('renim_ai_base_url') || undefined
        }
      : undefined;

  const loadData = async () => {
    try {
      const [h, g, j] = await Promise.all([
        fetchHabits(userEmail),
        fetchGoals(userEmail),
        fetchJournals(userEmail)
      ]);
      setHabits(h.habits);
      setGoals(g.goals);
      setJournals(j.journals);
    } catch (e: any) {
      showToast(e.message || 'Failed to load growth data');
    }
  };

  useEffect(() => {
    loadData();
  }, [userEmail]);

  const totalCompletedToday = habits.filter((h) => (h.completed_dates || []).includes(todayStr)).length;

  return (
    <section className="workspace-view active" id="view-growth">
      <div className="mui-card" style={{ marginBottom: '18px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'habits', label: 'Habits & Streaks', icon: 'local_fire_department' },
            { id: 'goals', label: 'Goals & OKRs', icon: 'flag' },
            { id: 'journal', label: 'Daily Journal & Weekly AI', icon: 'menu_book' },
            { id: 'url', label: 'Web URL Summarizer', icon: 'link' },
            { id: 'flashcards', label: 'AI Flashcards', icon: 'style' },
            { id: 'mindmap', label: 'AI Mind-Map & Follow-Up', icon: 'account_tree' }
          ].map((t) => (
            <button
              key={t.id}
              className={`mui-btn mui-btn-sm ${tab === t.id ? 'mui-btn-primary' : 'mui-btn-outlined'}`}
              onClick={() => setTab(t.id as HubTab)}
            >
              <span className="material-symbols-rounded icon-sm">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: HABITS & HEATMAP */}
      {tab === 'habits' && (
        <div className="mui-card">
          <div className="card-header-flex" style={{ marginBottom: '14px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Daily Habit Tracker & 28-Day Heatmap</h2>
              <p className="muted-sm" style={{ marginTop: '4px' }}>
                Completed today: <strong>{totalCompletedToday} / {habits.length}</strong> habits
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <input
              type="text"
              className="mui-input"
              placeholder="New daily habit (e.g. Deep Work 60m, Read 20 pages, Exercise)"
              value={habitTitle}
              onChange={(e) => setHabitTitle(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && habitTitle.trim()) {
                  await createHabit(habitTitle.trim(), 5, userEmail);
                  setHabitTitle('');
                  loadData();
                }
              }}
              style={{ flex: 1 }}
            />
            <button
              className="mui-btn mui-btn-primary"
              onClick={async () => {
                if (!habitTitle.trim()) return showToast('Enter a habit name');
                await createHabit(habitTitle.trim(), 5, userEmail);
                setHabitTitle('');
                showToast('Habit added!');
                loadData();
              }}
            >
              Add Habit
            </button>
          </div>

          {habits.length === 0 ? (
            <p className="muted-sm">No habits yet. Add your first daily habit above to start your streak!</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {habits.map((h) => {
                const dates = h.completed_dates || [];
                const doneToday = dates.includes(todayStr);
                const streak = calcStreak(dates);
                return (
                  <div
                    key={h.id}
                    style={{
                      padding: '14px',
                      borderRadius: '12px',
                      border: '1px solid var(--mui-border)',
                      background: 'var(--mui-bg-paper)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          className={`mui-btn mui-btn-sm ${doneToday ? 'mui-btn-primary' : 'mui-btn-outlined'}`}
                          onClick={async () => {
                            await toggleHabitToday(h.id, todayStr, userEmail);
                            loadData();
                          }}
                        >
                          <span className="material-symbols-rounded icon-sm">
                            {doneToday ? 'check_circle' : 'radio_button_unchecked'}
                          </span>
                          <span>{doneToday ? 'Done Today' : 'Check In'}</span>
                        </button>
                        <strong style={{ fontSize: '15px' }}>{h.title}</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="cmd-badge" style={{ color: '#f59e0b' }}>🔥 {streak} day streak</span>
                        <button
                          className="mui-btn-icon"
                          title="Delete habit"
                          onClick={async () => {
                            await deleteHabit(h.id, userEmail);
                            loadData();
                          }}
                        >
                          <span className="material-symbols-rounded icon-sm">delete</span>
                        </button>
                      </div>
                    </div>
                    <div style={{ overflowX: 'auto', paddingBottom: '4px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(28, minmax(8px, 1fr))', gap: '4px', minWidth: '280px' }}>
                        {last28.map((d) => {
                          const hit = dates.includes(d);
                          return (
                            <div
                              key={d}
                              title={`${d}: ${hit ? 'Completed' : 'Missed'}`}
                              style={{
                                height: '14px',
                                borderRadius: '3px',
                                background: hit ? '#10b981' : 'var(--mui-border)',
                                opacity: hit ? 1 : 0.45
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: GOALS & OKRs */}
      {tab === 'goals' && (
        <div className="mui-card">
          <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 700 }}>Goals & OKR Progress Tracker</h2>
          <p className="muted-sm" style={{ marginBottom: '14px' }}>
            Track quarterly objectives, personal milestones, and project progress.
          </p>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="mui-input"
              placeholder="Goal title (e.g. Launch Renim AI v2.0)"
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              style={{ flex: 1, minWidth: '200px' }}
            />
            <select className="mui-input" value={goalCategory} onChange={(e) => setGoalCategory(e.target.value)} style={{ width: '130px' }}>
              <option value="Work">Work</option>
              <option value="Learning">Learning</option>
              <option value="Health">Health</option>
              <option value="Finance">Finance</option>
            </select>
            <input
              type="date"
              className="mui-input"
              value={goalDate}
              onChange={(e) => setGoalDate(e.target.value)}
              style={{ width: '150px' }}
            />
            <button
              className="mui-btn mui-btn-primary"
              onClick={async () => {
                if (!goalTitle.trim()) return showToast('Enter a goal title');
                await createGoal(goalTitle.trim(), goalCategory, goalDate, userEmail);
                setGoalTitle('');
                showToast('Goal created!');
                loadData();
              }}
            >
              Add Goal
            </button>
          </div>

          {goals.length === 0 ? (
            <p className="muted-sm">No goals set yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {goals.map((g) => (
                <div key={g.id} style={{ padding: '14px', borderRadius: '12px', border: '1px solid var(--mui-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div>
                      <strong>{g.title}</strong>
                      <div className="muted-sm">{g.category} {g.target_date ? `• Target: ${g.target_date}` : ''}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ color: '#06b6d4' }}>{g.progress}%</strong>
                      <button
                        className="mui-btn-icon"
                        onClick={async () => {
                          await deleteGoal(g.id, userEmail);
                          loadData();
                        }}
                      >
                        <span className="material-symbols-rounded icon-sm">delete</span>
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={g.progress}
                    onChange={async (e) => {
                      const val = Number(e.target.value);
                      setGoals((prev) => prev.map((item) => (item.id === g.id ? { ...item, progress: val } : item)));
                      await updateGoalProgress(g.id, val, userEmail);
                    }}
                    style={{ width: '100%', accentColor: '#06b6d4' }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DAILY JOURNAL & AI WEEKLY WIN REPORT */}
      {tab === 'journal' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          <div className="mui-card">
            <h2 style={{ margin: '0 0 10px 0', fontSize: '17px', fontWeight: 700 }}>Daily Check-In & Reflection</h2>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              {['🚀', '😊', '😐', '😓', '🔥'].map((m) => (
                <button
                  key={m}
                  className={`mui-btn mui-btn-sm ${mood === m ? 'mui-btn-primary' : 'mui-btn-outlined'}`}
                  onClick={() => setMood(m)}
                >
                  {m}
                </button>
              ))}
            </div>
            <textarea
              className="mui-input"
              placeholder="Today's biggest win..."
              value={winText}
              onChange={(e) => setWinText(e.target.value)}
              rows={3}
              style={{ width: '100%', marginBottom: '10px' }}
            />
            <textarea
              className="mui-input"
              placeholder="Any blocker or tomorrow's priority..."
              value={blockerText}
              onChange={(e) => setBlockerText(e.target.value)}
              rows={2}
              style={{ width: '100%', marginBottom: '12px' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="mui-btn mui-btn-primary"
                onClick={async () => {
                  if (!winText.trim()) return showToast('Write at least one win for today!');
                  await createJournal(mood, winText.trim(), blockerText.trim(), userEmail);
                  setWinText('');
                  setBlockerText('');
                  showToast('Daily reflection saved!');
                  loadData();
                }}
              >
                Save Check-In
              </button>
              <button
                className="mui-btn mui-btn-outlined"
                disabled={reportLoading}
                onClick={async () => {
                  setReportLoading(true);
                  try {
                    const res = await generateWeeklyWinReport(userEmail, getAiCfg());
                    setWeeklyReport(res.report);
                  } catch (e: any) {
                    showToast(e.message);
                  } finally {
                    setReportLoading(false);
                  }
                }}
              >
                {reportLoading ? 'Generating...' : 'AI Weekly Win Report'}
              </button>
            </div>
          </div>

          <div className="mui-card">
            <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 700 }}>
              {weeklyReport ? 'AI Weekly Win Report' : 'Recent Reflections'}
            </h3>
            {weeklyReport ? (
              <div className="markdown-body" dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(weeklyReport) }} />
            ) : journals.length === 0 ? (
              <p className="muted-sm">No journal entries yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {journals.map((j) => (
                  <div key={j.id} style={{ padding: '10px', borderRadius: '10px', border: '1px solid var(--mui-border)' }}>
                    <div style={{ fontWeight: 700, marginBottom: '4px' }}>{j.mood} {j.entry_date}</div>
                    <div style={{ fontSize: '13px' }}><strong>Win:</strong> {j.win_text}</div>
                    {j.blocker_text && <div className="muted-sm"><strong>Next/Blocker:</strong> {j.blocker_text}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: WEB URL AI SUMMARIZER */}
      {tab === 'url' && (
        <div className="mui-card">
          <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 700 }}>Web Article & Documentation AI Summarizer</h2>
          <p className="muted-sm" style={{ marginBottom: '14px' }}>
            Paste any blog post, docs page, or news URL to extract an executive summary and save it to Smart Notes.
          </p>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <input
              type="url"
              className="mui-input"
              placeholder="https://example.com/article"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              className="mui-btn mui-btn-primary"
              disabled={urlLoading}
              onClick={async () => {
                if (!urlInput.trim()) return showToast('Paste a valid URL');
                setUrlLoading(true);
                try {
                  const res = await summarizeWebUrl(urlInput.trim(), userEmail, getAiCfg());
                  setUrlResult(res);
                } catch (e: any) {
                  showToast(e.message);
                } finally {
                  setUrlLoading(false);
                }
              }}
            >
              {urlLoading ? 'Reading URL...' : 'Summarize URL'}
            </button>
          </div>

          {urlResult && (
            <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--mui-border)', background: 'var(--mui-bg-paper)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '10px', flexWrap: 'wrap' }}>
                <strong>{urlResult.title}</strong>
                <button
                  className="mui-btn mui-btn-outlined mui-btn-sm"
                  onClick={async () => {
                    await onSaveUrlAsNote(urlResult.title, `${urlResult.summary}\n\nSource: ${urlResult.url}`);
                    showToast('Saved summary to Smart Notes!');
                  }}
                >
                  Save to Smart Notes
                </button>
              </div>
              <div className="markdown-body" dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(urlResult.summary) }} />
            </div>
          )}
        </div>
      )}

      {/* TAB 5: AI FLASHCARDS & QUIZ STUDIO */}
      {tab === 'flashcards' && (
        <div className="mui-card">
          <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 700 }}>AI Study Flashcards & Quiz Generator</h2>
          <p className="muted-sm" style={{ marginBottom: '14px' }}>
            Pick one of your Smart Notes or paste any study material to generate interactive flip-cards.
          </p>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {notes.slice(0, 5).map((n) => (
              <button
                key={n.id}
                className="mui-btn mui-btn-outlined mui-btn-sm"
                onClick={() => {
                  setFcTitle(n.title);
                  setFcContent((n.content || '').replace(/<[^>]+>/g, ' '));
                }}
              >
                Load Note: {n.title.slice(0, 22)}
              </button>
            ))}
          </div>

          <input
            type="text"
            className="mui-input"
            placeholder="Topic Title"
            value={fcTitle}
            onChange={(e) => setFcTitle(e.target.value)}
            style={{ width: '100%', marginBottom: '8px' }}
          />
          <textarea
            className="mui-input"
            rows={4}
            placeholder="Paste study text, lecture notes, or meeting highlights..."
            value={fcContent}
            onChange={(e) => setFcContent(e.target.value)}
            style={{ width: '100%', marginBottom: '12px' }}
          />
          <button
            className="mui-btn mui-btn-primary"
            disabled={fcLoading}
            onClick={async () => {
              if (fcContent.trim().length < 20) return showToast('Paste at least a few sentences');
              setFcLoading(true);
              try {
                const res = await generateFlashcardsApi(fcTitle || 'Study Topic', fcContent, userEmail, getAiCfg());
                setFlashcards(res.flashcards);
                setFlippedIdx({});
              } catch (e: any) {
                showToast(e.message);
              } finally {
                setFcLoading(false);
              }
            }}
          >
            {fcLoading ? 'Generating Cards...' : 'Generate 6 Flashcards'}
          </button>

          {flashcards.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginTop: '18px' }}>
              {flashcards.map((card, i) => {
                const flipped = !!flippedIdx[i];
                return (
                  <div
                    key={i}
                    onClick={() => setFlippedIdx((prev) => ({ ...prev, [i]: !prev[i] }))}
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      minHeight: '130px',
                      border: flipped ? '2px solid #10b981' : '1px solid #06b6d4',
                      background: flipped ? 'rgba(16, 185, 129, 0.08)' : 'rgba(6, 182, 212, 0.06)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span className="cmd-badge" style={{ alignSelf: 'flex-start' }}>
                      {flipped ? `Answer #${i + 1}` : `Question #${i + 1}`}
                    </span>
                    <div style={{ fontSize: '14px', fontWeight: flipped ? 500 : 700, margin: '10px 0' }}>
                      {flipped ? card.a : card.q}
                    </div>
                    <span className="muted-sm" style={{ fontSize: '11px' }}>Click card to flip</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: AI MIND-MAP & MEETING FOLLOW-UP */}
      {tab === 'mindmap' && (
        <div className="mui-card">
          <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 700 }}>
            AI Visual Mind-Map & Meeting Follow-Up Studio
          </h2>
          <p className="muted-sm" style={{ marginBottom: '12px' }}>
            Convert any Note or Meeting transcript into a structured visual Mind Map or an executive follow-up email with action items.
          </p>

          {notes.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <span className="muted-sm" style={{ alignSelf: 'center' }}>Load Note:</span>
              {notes.slice(0, 4).map((n) => (
                <button
                  key={n.id}
                  className="mui-btn mui-btn-outlined mui-btn-sm"
                  onClick={() => {
                    setMmTitle(n.title || 'Note');
                    setMmContent(n.content || '');
                  }}
                >
                  {(n.title || 'Untitled').slice(0, 22)}
                </button>
              ))}
            </div>
          )}

          <input
            className="mui-input"
            placeholder="Topic or Meeting Title..."
            value={mmTitle}
            onChange={(e) => setMmTitle(e.target.value)}
            style={{ marginBottom: '10px' }}
          />
          <textarea
            className="mui-input"
            rows={4}
            placeholder="Paste notes, brainstorm ideas, or meeting transcript..."
            value={mmContent}
            onChange={(e) => setMmContent(e.target.value)}
            style={{ marginBottom: '12px' }}
          />

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <button
              className="mui-btn mui-btn-primary"
              disabled={mmLoading}
              onClick={async () => {
                if (!mmContent.trim()) return showToast('Enter content first');
                setMmLoading(true);
                try {
                  const res = await generateMindMap({ title: mmTitle || 'Mind Map', content: mmContent, user_email: userEmail });
                  if (res.mindmap) setMindMap(res.mindmap);
                  else showToast(res.error || 'Failed');
                } finally {
                  setMmLoading(false);
                }
              }}
            >
              <span className="material-symbols-rounded icon-sm">account_tree</span>
              <span>{mmLoading ? 'Generating...' : 'Generate Visual Mind Map'}</span>
            </button>

            <button
              className="mui-btn mui-btn-outlined"
              disabled={mmLoading}
              onClick={async () => {
                if (!mmContent.trim()) return showToast('Enter meeting notes first');
                setMmLoading(true);
                try {
                  const res = await generateMeetingFollowup({ title: mmTitle || 'Team Sync', transcript: mmContent, user_email: userEmail });
                  setFollowupResult(res);
                } finally {
                  setMmLoading(false);
                }
              }}
            >
              <span className="material-symbols-rounded icon-sm">mail</span>
              <span>Draft Follow-Up Email + Actions</span>
            </button>
          </div>

          {mindMap && (
            <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--mui-border)', background: 'var(--mui-bg-paper)', marginBottom: '16px' }}>
              <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                <span style={{ display: 'inline-block', padding: '8px 18px', borderRadius: '999px', background: 'linear-gradient(135deg, #0891b2, #06b6d4)', color: '#fff', fontWeight: 700, fontSize: '14px' }}>
                  {mindMap.root}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
                {mindMap.branches.map((b, idx) => (
                  <div key={idx} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #0891b2', background: 'rgba(8, 145, 178, 0.06)' }}>
                    <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#22d3ee', marginBottom: '6px' }}>
                      {b.title}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12.5px' }}>
                      {b.nodes.map((node, ni) => (
                        <li key={ni} style={{ marginBottom: '3px' }}>{node}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {followupResult && (
            <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--mui-border)', background: 'var(--mui-bg-paper)' }}>
              <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '8px' }}>
                Subject: {followupResult.subject}
              </div>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '13px', marginBottom: '12px', color: 'var(--mui-text-secondary)' }}>
                {followupResult.email_body}
              </pre>
              {followupResult.action_items && followupResult.action_items.length > 0 && (
                <div>
                  <strong style={{ fontSize: '13px' }}>Extracted Action Items:</strong>
                  <ul style={{ marginTop: '6px', paddingLeft: '18px', fontSize: '13px' }}>
                    {followupResult.action_items.map((a, idx) => (
                      <li key={idx}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
