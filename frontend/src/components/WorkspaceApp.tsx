import { ThemeProvider } from '@mui/material/styles';
import { getSpeechLang } from '../services/workspace';
import { makeRenimTheme } from '../theme/renimTheme';
import React, { useState, useEffect, useRef } from 'react';
import {
  DatabaseClient,
  AIEngine,
  AudioRecorderService,
  type Meeting,
  type Note,
  type TaskItem,
  type CalendarEvent,
  type ChatMessage,
  type ChatSession,
  type UserDocument,
  type SubTask
} from '../services/workspace';
import { ambientAudio } from '../services/ambientAudio';
import { renderMarkdownToHtml } from '../utils/markdown';

// Common Layout & UI
import { Sidebar, type ViewId } from './common/Sidebar';
import { Header } from './common/Header';
import { ToastContainer, type ToastItem } from './common/ToastContainer';
import { MobileBottomNav } from './common/MobileBottomNav';

// View Modules
import { TodayView } from './views/TodayView';
import { NotificationCenter } from './notifications/NotificationCenter';
import { useNotificationInbox, classifyMessage } from './notifications/useNotificationInbox';
import { WelcomeDialog, hasSeenWelcome, loadUseCases } from './onboarding/WelcomeDialog';
import { VerifyEmailBanner } from './onboarding/VerifyEmailBanner';
import { MeetingsView } from './views/MeetingsView';
import { NotesView } from './views/NotesView';
import { CalendarView } from './views/CalendarView';
import { TasksView } from './views/TasksView';
import { DocsView } from './views/DocsView';
import { ChatView } from './views/ChatView';
import { SettingsView } from './views/SettingsView';
import { EnterpriseRagView } from './views/EnterpriseRagView';
import { TeamOrgsView } from './views/TeamOrgsView';
import { AnalyticsView } from './views/AnalyticsView';
import { IntegrationsView } from './views/IntegrationsView';
import { BillingView } from './views/BillingView';
import { SecurityAuditView } from './views/SecurityAuditView';
import { GrowthHubView } from './views/GrowthHubView';
import { ProfileView } from './views/ProfileView';
import { SuperAdminView } from './views/SuperAdminView';
import type { Organization } from '../services/enterprise';
import {
  getTenantContext,
  createPublicShareLink,
  setResourceVisibility,
  type TenantOrg
} from '../services/tenant';
import { fetchUserProfile } from '../services/profile';

// Modal Dialogs
import { EventModal } from './modals/EventModal';
import { TaskModal } from './modals/TaskModal';
import { PasteTranscriptModal } from './modals/PasteTranscriptModal';
import { EmailModal } from './modals/EmailModal';
import { ShareModal } from './modals/ShareModal';
import { CommandPaletteModal } from './modals/CommandPaletteModal';
import { PomodoroModal } from './modals/PomodoroModal';
import { ScratchpadDrawer } from './modals/ScratchpadDrawer';
import { sanitizeHtml } from '../utils/sanitize';

const db = new DatabaseClient();
const ai = new AIEngine();
const recorder = new AudioRecorderService();

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const AI_THINKING_STEPS = [
  'Thinking',
  'Checking',
  'Fetching',
  'Analyzing',
  'Generating'
];

export default function WorkspaceApp() {
  // Navigation, Theme & Global Search
  const [activeView, setActiveView] = useState<ViewId>('view-today');
  const [activeOrgId, setActiveOrgId] = useState<string>('');
  const [activeOrgName, setActiveOrgName] = useState<string>('Personal');
  const [tenantOrgs, setTenantOrgs] = useState<TenantOrg[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showScratchpad, setShowScratchpad] = useState(false);
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('light');
  const [searchQuery, setSearchQuery] = useState('');

  // Workspace Data
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null);
  const activeChatSessionIdRef = useRef<string | null>(null);

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState('Renim AI User');
  const [userEmail, setUserEmail] = useState('guest@renimai.com');
  const [userAvatarUrl, setUserAvatarUrl] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Today View & Voice Memo
  const [briefingText, setBriefingText] = useState('Generating your personalized morning roadmap...');
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [isVoiceMemoActive, setIsVoiceMemoActive] = useState(false);
  const [voiceMemoStatus, setVoiceMemoStatus] = useState('Click mic to record a note, task, or reminder on the fly.');

  // Meetings Hub
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);
  const [isMeetingRecording, setIsMeetingRecording] = useState(false);
  const [liveTranscriptText, setLiveTranscriptText] = useState('');
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Smart Notes
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const activeNoteIdRef = useRef<string | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteSaveStatus, setNoteSaveStatus] = useState('Saved');
  const [noteLineSpacing, setNoteLineSpacing] = useState('1.65');
  const [noteSpellCheck, setNoteSpellCheck] = useState(true);
  const noteEditorRef = useRef<HTMLDivElement | null>(null);
  const noteSaveTimerRef = useRef<any>(null);
  const isCreatingNoteRef = useRef<Promise<Note> | null>(null);

  // Calendar View
  const [calMonthDate, setCalMonthDate] = useState(() => new Date());
  const [calSelectedDateStr, setCalSelectedDateStr] = useState(() => new Date().toISOString().slice(0, 10));

  // Copilot Chat
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Hello! I am your **Renim AI Workspace Copilot**. I have real-time memory of all your meetings, smart notes, calendar events, and action items. Ask me anything!'
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatThinking, setIsChatThinking] = useState(false);
  const [thinkingStepIndex, setThinkingStepIndex] = useState(0);
  const [typingMsgIndex, setTypingMsgIndex] = useState<number | null>(null);
  const [typingVisibleText, setTypingVisibleText] = useState('');
  const chatHistoryRef = useRef<HTMLDivElement | null>(null);
  const typingTimerRef = useRef<any>(null);

  // Settings
  const [cfgSbUrl, setCfgSbUrl] = useState(
    'postgresql://neondb_owner:...@ep-green-rain-aonl26e9-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb'
  );
  const [cfgSbAnon, setCfgSbAnon] = useState('Connected (PostgreSQL 18.6 AWS Singapore)');
  const [cfgAiUrl, setCfgAiUrl] = useState('https://2c-aim-api.2coms.com/v1');
  const [cfgAiKey, setCfgAiKey] = useState('twocoms_dev_z0_q6r3');
  const [cfgAiModel, setCfgAiModel] = useState('qwen2.5');

  // Modals
  const [showEventModal, setShowEventModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);

  // Knowledge Hub & Docs AI
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [docChatHistory, setDocChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [docChatInput, setDocChatInput] = useState('');
  const [isDocUploading, setIsDocUploading] = useState(false);
  const [isDocChatLoading, setIsDocChatLoading] = useState(false);
  const [showDocPreview, setShowDocPreview] = useState(false);
  const docFileInputRef = useRef<HTMLInputElement | null>(null);

  // Command Palette (Ctrl + K)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [cmdSearchQuery, setCmdSearchQuery] = useState('');

  // Tasks View Mode (Checklist vs Kanban)
  const [taskViewMode, setTaskViewMode] = useState<'checklist' | 'kanban'>('kanban');
  const [breakingDownTaskId, setBreakingDownTaskId] = useState<string | null>(null);

  // AI Email & Outreach Draftsman Modal
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTone, setEmailTone] = useState('Professional');
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailObjective, setEmailObjective] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isEmailGenerating, setIsEmailGenerating] = useState(false);

  // Note Share Preview Modal
  const [showShareModal, setShowShareModal] = useState(false);

  // Audio Upload Ref
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);

  // Google Calendar iCal (.ics) Ref
  const icsFileInputRef = useRef<HTMLInputElement | null>(null);

  // Mobile PWA Offline & Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isPWAInstallable, setIsPWAInstallable] = useState(false);
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);

  // Web Push Notifications & Resend API
  const [notificationPermission, setNotificationPermission] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const [isPushEnabled, setIsPushEnabled] = useState<boolean>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('renim_push_enabled');
      if (saved !== null) return saved === 'true';
    }
    return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
  });
  const [resendApiKey, setResendApiKey] = useState(
    typeof localStorage !== 'undefined' ? localStorage.getItem('renim_resend_api_key') || '' : ''
  );

  // Live Voice Dictation & Speech Recognition
  const [isVoiceDictating, setIsVoiceDictating] = useState(false);
  const [voiceDictationLang, setVoiceDictationLang] = useState<'bn-BD' | 'en-US'>(() => (getSpeechLang().startsWith('bn') ? 'bn-BD' : 'en-US'));
  const speechRecognitionRef = useRef<any>(null);

  // Kanban Drag and Drop & Sprint Velocity
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  // Focus Mode & Pomodoro Deep Work
  const [showFocusModal, setShowFocusModal] = useState(false);
  const [pomodoroSeconds, setPomodoroSeconds] = useState(25 * 60);
  const [pomodoroTotalSeconds, setPomodoroTotalSeconds] = useState(25 * 60);
  const [isPomodoroRunning, setIsPomodoroRunning] = useState(false);
  const [pomodoroMode, setPomodoroMode] = useState<'focus25' | 'deep50' | 'break5'>('focus25');
  const [ambientSound, setAmbientSound] = useState<'off' | 'rain' | 'space' | 'hum'>('off');
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const ambientAudioCtxRef = useRef<AudioContext | null>(null);
  const ambientGainNodeRef = useRef<GainNode | null>(null);
  const ambientSourcesRef = useRef<any[]>([]);

  // Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const inbox = useNotificationInbox(userEmail);
  const [showWelcome, setShowWelcome] = useState(false);
  const [useCases, setUseCases] = useState<string[]>([]);
  useEffect(() => {
    setUseCases(loadUseCases(userEmail));
  }, [userEmail]);

  useEffect(() => {
    if (!userEmail) return;
    getTenantContext(userEmail)
      .then((ctx) => setTenantOrgs(ctx.organizations || []))
      .catch(() => {});
    fetchUserProfile(userEmail)
      .then((data) => {
        if (data?.profile) {
          if (data.profile.full_name) setUserName(data.profile.full_name);
          setUserAvatarUrl(data.profile.avatar_url || '');
          setIsSuperAdmin(Boolean((data.profile as any).is_superadmin || (data.profile as any).role === 'superadmin'));
        } else {
          setIsSuperAdmin(false);
        }
      })
      .catch(() => {
        setIsSuperAdmin(false);
      });
  }, [userEmail]);

  const showToast = (message: string, type: ToastItem['type'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    inbox.add(message, classifyMessage(message, type));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const syncAuthUI = () => {
    const authed = db.isAuthenticated();
    setIsAuthenticated(authed);
    if (authed) {
      const email = db.user.email || 'guest@renimai.com';
      const name = db.user.full_name || email.split('@')[0];
      setUserName(name);
      setUserEmail(email);
    } else {
      setUserName('Workspace Guest');
      setUserEmail('guest@renimai.com');
    }
  };

  const DEFAULT_GREETING_MSG: ChatMessage = {
    role: 'assistant',
    content:
      'Hello! I am your **Renim AI Workspace Copilot**. I have real-time memory of all your meetings, smart notes, calendar events, and action items. Ask me anything!'
  };

  const toggleThemeMode = () => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('renim_theme', next);
      document.documentElement.className = next;
    }
  };

  const refreshWorkspaceData = async () => {
    try {
      const [mList, nList, tList, eList, cSessions, dList] = await Promise.all([
        db.getMeetings(),
        db.getNotes(),
        db.getTasks(),
        db.getCalendarEvents(),
        db.getChatSessions(),
        db.getDocuments()
      ]);
      setMeetings(mList);
      setNotes(nList);
      setTasks(tList);
      setEvents(eList);
      setChatSessions(cSessions);
      setDocuments(dList);
      if (dList.length > 0 && !activeDocId) {
        setActiveDocId(dList[0].id);
      }
      return { mList, nList, tList, eList, cSessions, dList };
    } catch (err) {
      console.warn('Data sync warning:', err);
      return { mList: [], nList: [], tList: [], eList: [], cSessions: [], dList: [] };
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
        setShowEmailModal(false);
        setShowShareModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const generateMorningBriefing = async (
    evOverride?: CalendarEvent[],
    taskOverride?: TaskItem[],
    noteOverride?: Note[]
  ) => {
    setIsBriefingLoading(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const evSource = evOverride || events;
      const taskSource = taskOverride || tasks;
      const noteSource = noteOverride || notes;

      const todayEvents = evSource.filter(e => e.event_date === todayStr);
      const pendingTasks = taskSource.filter(t => t.status !== 'done');
      const recentNotes = noteSource.slice(0, 3);

      const text = await ai.generateDailyBriefing(todayEvents, pendingTasks, recentNotes);
      setBriefingText(text || 'Good morning! Your workspace is synced and ready for today.');
    } catch {
      setBriefingText('Configure your AI Gateway API key in Settings to unlock your personalized Morning AI Briefing.');
    } finally {
      setIsBriefingLoading(false);
    }
  };

  // Initial Boot
  useEffect(() => {
    db.init();
    ai.init();
    if (!db.isAuthenticated()) {
      // Guest mode is disabled server-side by default; send visitors to sign in instead of a broken empty workspace.
      window.location.href = '/signin';
      return;
    }
    syncAuthUI();
    const savedTheme = (localStorage.getItem('renim_theme') as 'dark' | 'light') || 'light';
    setThemeMode(savedTheme);
    document.documentElement.className = savedTheme;

    setCfgAiUrl(ai.gatewayUrl || 'https://2c-aim-api.2coms.com/v1');
    setCfgAiKey(ai.apiKey || 'twocoms_dev_z0_q6r3');
    setCfgAiModel(ai.model || 'qwen2.5');

    refreshWorkspaceData().then(({ mList, eList, tList, nList, cSessions }) => {
      if (nList && nList.length > 0 && !activeNoteIdRef.current) {
        selectNote(nList[0]);
      }
      if (cSessions && cSessions.length > 0 && !activeChatSessionIdRef.current) {
        activeChatSessionIdRef.current = cSessions[0].id;
        setActiveChatSessionId(cSessions[0].id);
        setChatHistory(
          cSessions[0].messages && cSessions[0].messages.length > 0
            ? cSessions[0].messages
            : [DEFAULT_GREETING_MSG]
        );
      }
      generateMorningBriefing(eList, tList, nList);
      // First visit: no notes, tasks or meetings yet and the welcome hasn't been seen.
      const isEmpty = !(mList && mList.length) && !(nList && nList.length) && !(tList && tList.length);
      if (isEmpty && navigator.onLine && !hasSeenWelcome(db.getUserEmail())) {
        setShowWelcome(true);
      }
    });
  }, []);

  // PWA Offline & Install Prompt Listeners
  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsPWAInstallable(true);
    };
    const handleOnline = () => {
      setIsOffline(false);
      showToast('Back online! Syncing workspace data with cloud...', 'success');
      refreshWorkspaceData();
    };
    const handleOffline = () => {
      setIsOffline(true);
      showToast('You are currently offline. Running from local offline cache.', 'warning');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Background Calendar Reminder Monitor (Toast + Native Web Push)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const currentTotalMins = now.getHours() * 60 + now.getMinutes();

      events.forEach(ev => {
        if (ev.event_date === todayStr && !ev._notified && ev.start_time) {
          const [eventHour, eventMin] = ev.start_time.split(':').map(Number);
          const reminderMins = ev.reminder_minutes || 15;
          const eventTotalMins = eventHour * 60 + eventMin;

          if (eventTotalMins - currentTotalMins <= reminderMins && eventTotalMins - currentTotalMins >= 0) {
            ev._notified = true;
            showToast(`Upcoming Event Reminder: "${ev.title}" starts at ${ev.start_time.slice(0, 5)}!`, 'warning');
            
            // Native Browser Push Notification (only if enabled by user and granted by browser)
            if (isPushEnabled && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(`Renim AI Event: ${ev.title}`, {
                  body: `Scheduled for ${ev.start_time.slice(0, 5)} (${ev.category || 'Meeting'})`,
                  icon: '/icon.svg',
                });
              } catch (err) {
                console.warn('Native notification failed:', err);
              }
            }
          }
        }
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [events]);

  // Auto-scroll chat & cycle smart thinking steps
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [chatHistory, isChatThinking, thinkingStepIndex, typingVisibleText]);

  useEffect(() => {
    if (!isChatThinking && !isBriefingLoading) {
      setThinkingStepIndex(0);
      return;
    }
    const stepTimer = setInterval(() => {
      setThinkingStepIndex(prev => (prev + 1) % AI_THINKING_STEPS.length);
    }, 1150);
    return () => clearInterval(stepTimer);
  }, [isChatThinking, isBriefingLoading]);

  // Global Ctrl+K shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        document.getElementById('global-search-input')?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // --- Handlers:Auth ---
  const handleAuthTrigger = () => {
    if (isAuthenticated) {
      db.signOut();
      syncAuthUI();
      showToast('Signed out of Renim AI.', 'info');
      activeChatSessionIdRef.current = null;
      setActiveChatSessionId(null);
      setChatHistory([DEFAULT_GREETING_MSG]);
      window.location.href = '/signin';
    } else {
      window.location.href = '/signin';
    }
  };

  // --- Handlers: Voice Memo ---
  const handleVoiceMemoToggle = async () => {
    if (!isVoiceMemoActive) {
      try {
        setIsVoiceMemoActive(true);
        setVoiceMemoStatus('Listening... Speak your note, task, or reminder now.');
        await recorder.startRecording({
          source: 'mic',
          onTranscript: res => {
            if (res.interimText) setVoiceMemoStatus(`"${res.interimText}"`);
          }
        });
      } catch {
        setIsVoiceMemoActive(false);
        showToast('Microphone access denied or error.', 'error');
      }
    } else {
      setIsVoiceMemoActive(false);
      setVoiceMemoStatus('Processing voice memo with AI...');
      const result = recorder.stopRecording();
      const spokenText = result.fullText;

      if (!spokenText || spokenText.trim().length < 3) {
        setVoiceMemoStatus('Voice input was too short. Try again.');
        return;
      }

      try {
        const classified = await ai.classifyVoiceMemo(spokenText);
        if (classified.category === 'task') {
          await db.createTask({
            title: classified.title,
            description: classified.details,
            priority: classified.priority || 'Medium',
            due_date: classified.date_or_deadline ? new Date(classified.date_or_deadline).toISOString() : null,
            source_type: 'voice'
          });
          showToast(`Voice Task Created: "${classified.title}"`, 'success');
        } else if (classified.category === 'event') {
          await db.createCalendarEvent({
            title: classified.title,
            description: classified.details,
            event_date: classified.date_or_deadline || new Date().toISOString().slice(0, 10),
            start_time: classified.time || '10:00',
            category: 'Personal'
          });
          showToast(`Voice Event Scheduled: "${classified.title}"`, 'success');
        } else {
          await db.createNote({
            title: classified.title,
            content: classified.details,
            folder: 'Voice Memos'
          });
          showToast(`Voice Note Saved: "${classified.title}"`, 'success');
        }
        setVoiceMemoStatus('Voice memo organized successfully!');
        refreshWorkspaceData();
      } catch (err: any) {
        showToast(`Voice Processing Error: ${err.message}`, 'error');
        setVoiceMemoStatus('Voice captured. Click to record again.');
      }
    }
  };

  // --- Handlers: Meetings ---
  const activeMeeting = meetings.find(m => m.id === activeMeetingId) || null;

  const startMeetingRecording = async (source: 'mic' | 'tab') => {
    if (!isMeetingRecording) {
      try {
        setIsMeetingRecording(true);
        setLiveTranscriptText('Listening to speech...');
        await recorder.startRecording({
          source,
          canvasEl: waveformCanvasRef.current,
          onTranscript: t => {
            setLiveTranscriptText(t.fullText || 'Listening to speech...');
          }
        });
        showToast('Recording meeting audio with live speech recognition...', 'info');
      } catch (err: any) {
        setIsMeetingRecording(false);
        showToast(`Recording error: ${err.message}`, 'error');
      }
    } else {
      setIsMeetingRecording(false);
      const rec = recorder.stopRecording();
      if (!rec.fullText || rec.fullText.trim().length < 5) {
        showToast('Meeting too short to summarize.', 'info');
        return;
      }

      showToast('Analyzing meeting with AI Gateway...', 'info');
      try {
        const title = `Meeting ${new Date().toLocaleDateString()}`;
        const summaryObj = await ai.summarizeMeeting(rec.fullText, title);
        const saved = await db.saveMeeting({
          title: summaryObj.title || title,
          raw_transcript: rec.fullText,
          summary: summaryObj.summary,
          key_points: summaryObj.key_points || [],
          decisions: summaryObj.decisions || [],
          action_items: summaryObj.action_items || []
        });

        if (summaryObj.action_items && summaryObj.action_items.length > 0) {
          for (const item of summaryObj.action_items) {
            await db.createTask({
              title: item.task,
              priority: item.priority || 'Medium',
              assignee: item.owner || 'Me',
              source_type: 'meeting',
              source_id: saved.id
            });
          }
        }

        showToast('Meeting analyzed and saved to Cloud!', 'success');
        await refreshWorkspaceData();
        setActiveMeetingId(saved.id);
      } catch (err: any) {
        showToast(`AI Summary failed: ${err.message}`, 'error');
      }
    }
  };

  const handlePasteTranscriptSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const formData = new FormData(formEl);
    const title = String(formData.get('title') || '').trim();
    const transcript = String(formData.get('transcript') || '').trim();
    setShowPasteModal(false);
    formEl.reset();

    showToast('Analyzing pasted transcript with AI...', 'info');
    try {
      const summaryObj = await ai.summarizeMeeting(transcript, title);
      const saved = await db.saveMeeting({
        title: summaryObj.title || title,
        raw_transcript: transcript,
        summary: summaryObj.summary,
        key_points: summaryObj.key_points || [],
        decisions: summaryObj.decisions || [],
        action_items: summaryObj.action_items || []
      });

      if (summaryObj.action_items && summaryObj.action_items.length > 0) {
        for (const item of summaryObj.action_items) {
          await db.createTask({
            title: item.task,
            priority: item.priority || 'Medium',
            assignee: item.owner || 'Me',
            source_type: 'meeting',
            source_id: saved.id
          });
        }
      }

      showToast('Meeting summarized successfully!', 'success');
      await refreshWorkspaceData();
      setActiveMeetingId(saved.id);
    } catch (err: any) {
      showToast(`Summarization Error: ${err.message}`, 'error');
    }
  };

  const handleDeleteMeeting = async () => {
    if (!activeMeetingId) return;
    if (window.confirm('Are you sure you want to delete this meeting?')) {
      await db.deleteMeeting(activeMeetingId);
      showToast('Meeting deleted.', 'info');
      setActiveMeetingId(null);
      refreshWorkspaceData();
    }
  };

  const handleCopyMeetingMd = () => {
    if (!activeMeeting) return;
    let md = `# ${activeMeeting.title}\n\n## Summary\n${activeMeeting.summary}\n\n## Action Items\n`;
    (activeMeeting.action_items || []).forEach(a => {
      md += `- [ ] ${a.task} (@${a.owner || 'Me'})\n`;
    });
    navigator.clipboard.writeText(md).then(() => showToast('Meeting Markdown copied to clipboard!', 'success'));
  };

  // --- Handlers: Smart Notes (Rich Text + Paste Formatting + Reliable Cloud Save) ---
  const stripHtmlPreview = (html: string) => {
    if (!html) return '';
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const toEditorHtml = (raw: string) => {
    if (!raw) return '';
    // If it already contains HTML block tags, render as-is
    if (/<(p|div|h[1-6]|ul|ol|li|br|table|pre|blockquote|span|strong|b|i|u|font)\b/i.test(raw)) {
      return raw;
    }
    // Convert plain text newlines to paragraphs/br so line breaks are preserved
    return raw
      .split(/\n\n+/)
      .map(para => `<p>${para.replace(/\n/g, '<br/>')}</p>`)
      .join('');
  };

  const selectNote = (note: Note) => {
    activeNoteIdRef.current = note.id;
    setActiveNoteId(note.id);
    setNoteTitle(note.title || '');
    const formatted = sanitizeHtml(toEditorHtml(note.content || ''));
    setNoteContent(formatted);
    if (noteEditorRef.current) {
      noteEditorRef.current.innerHTML = formatted;
    }
    setNoteSaveStatus('Saved');
  };

  const handleNewNote = async () => {
    try {
      const newNote = await db.createNote({
        title: 'Untitled Note',
        content: ''
      });
      await refreshWorkspaceData();
      selectNote(newNote);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const persistNoteNow = async (nextTitle: string, nextContent: string, showNotification = false) => {
    setNoteSaveStatus('Saving...');
    try {
      let currentId = activeNoteIdRef.current;

      // If user started typing/pasting before selecting or creating a note, auto-create one!
      if (!currentId) {
        if (!isCreatingNoteRef.current) {
          isCreatingNoteRef.current = db.createNote({
            title: nextTitle.trim() || 'Untitled Note',
            content: nextContent
          });
        }
        const created = await isCreatingNoteRef.current;
        isCreatingNoteRef.current = null;
        currentId = created.id;
        activeNoteIdRef.current = currentId;
        setActiveNoteId(currentId);
      } else {
        await db.updateNote(currentId, {
          title: nextTitle.trim() || 'Untitled Note',
          content: nextContent
        });
      }

      setNoteSaveStatus('All changes saved to Cloud');
      await refreshWorkspaceData();
      if (showNotification) {
        showToast('Note saved to Cloud!', 'success');
      }
    } catch (err: any) {
      setNoteSaveStatus('Saved locally');
      if (showNotification) {
        showToast(`Save error: ${err.message}`, 'error');
      }
    }
  };

  const triggerNoteSave = (nextTitle: string, nextContent: string) => {
    setNoteSaveStatus('Saving...');
    if (noteSaveTimerRef.current) clearTimeout(noteSaveTimerRef.current);
    noteSaveTimerRef.current = setTimeout(() => {
      persistNoteNow(nextTitle, nextContent, false);
    }, 600);
  };

  const execEditorCmd = (command: string, value: string = '') => {
    if (noteEditorRef.current) {
      noteEditorRef.current.focus();
      document.execCommand(command, false, value);
      const html = noteEditorRef.current.innerHTML;
      setNoteContent(html);
      triggerNoteSave(noteTitle, html);
    }
  };

  const handleNotePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const htmlData = e.clipboardData.getData('text/html');
    const textData = e.clipboardData.getData('text/plain');

    // If rich HTML is on clipboard, sanitize dark-hostile inline backgrounds while keeping all structure
    if (htmlData && htmlData.trim().length > 0) {
      e.preventDefault();
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlData, 'text/html');
      doc.querySelectorAll('script, style, meta, link').forEach(el => el.remove());
      doc.querySelectorAll('*').forEach(el => {
        const htmlEl = el as HTMLElement;
        if (htmlEl.style) {
          htmlEl.style.backgroundColor = '';
          htmlEl.style.background = '';
          // Reset black/near-black text colors pasted from light-mode websites so it stays readable in dark mode
          const col = (htmlEl.style.color || '').replace(/\s+/g, '').toLowerCase();
          if (
            col === '#000' ||
            col === '#000000' ||
            col === 'black' ||
            col.startsWith('rgb(0,0,0') ||
            col.startsWith('rgb(15,23,42') ||
            col.startsWith('rgb(30,41,59') ||
            col.startsWith('rgb(17,24,39')
          ) {
            htmlEl.style.color = '';
          }
        }
      });
      document.execCommand('insertHTML', false, sanitizeHtml(doc.body.innerHTML));
    } else if (textData) {
      e.preventDefault();
      const escaped = textData
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const formattedText = escaped
        .split(/\r?\n\r?\n/)
        .map(block => `<p>${block.replace(/\r?\n/g, '<br/>')}</p>`)
        .join('');
      document.execCommand('insertHTML', false, formattedText);
    }

    if (noteEditorRef.current) {
      const updatedHtml = noteEditorRef.current.innerHTML;
      setNoteContent(updatedHtml);
      triggerNoteSave(noteTitle, updatedHtml);
    }
  };

  const handleInsertTable = () => {
    const tableHtml = `
      <table>
        <thead>
          <tr><th>Column 1</th><th>Column 2</th><th>Column 3</th></tr>
        </thead>
        <tbody>
          <tr><td>Data 1</td><td>Data 2</td><td>Data 3</td></tr>
          <tr><td>Data 4</td><td>Data 5</td><td>Data 6</td></tr>
        </tbody>
      </table><p><br/></p>
    `;
    execEditorCmd('insertHTML', tableHtml);
  };

  const handleInsertLink = () => {
    const url = window.prompt('Enter URL (e.g. https://example.com):', 'https://');
    if (url) execEditorCmd('createLink', url);
  };

  const handleInsertImage = () => {
    const url = window.prompt('Enter Image URL:', 'https://');
    if (url) execEditorCmd('insertImage', url);
  };

  const handleInsertCodeBlock = () => {
    const sel = window.getSelection()?.toString() || '// Write code here...';
    const safeSel = sel.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    execEditorCmd('insertHTML', `<pre><code>${safeSel}</code></pre><p><br/></p>`);
  };

  const handleDeleteNote = async () => {
    if (!activeNoteIdRef.current) return;
    if (window.confirm('Delete this note?')) {
      await db.deleteNote(activeNoteIdRef.current);
      activeNoteIdRef.current = null;
      setActiveNoteId(null);
      setNoteTitle('');
      setNoteContent('');
      if (noteEditorRef.current) noteEditorRef.current.innerHTML = '';
      showToast('Note deleted.', 'info');
      refreshWorkspaceData();
    }
  };

  const handleNoteAI = async (cmd: string) => {
    const plainText = noteEditorRef.current?.innerText || stripHtmlPreview(noteContent);
    if (!plainText || plainText.trim().length < 5) {
      showToast('Please write some content in the note first.', 'info');
      return;
    }
    showToast('AI Writing Assistant is processing note...', 'info');
    try {
      const result = await ai.processNoteWithAI(plainText, cmd);
      const formattedAi = result
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br/>');
      const updated = sanitizeHtml(`${noteContent}<hr/><h4>✨ AI Assistant Output</h4><p>${formattedAi}</p>`);
      setNoteContent(updated);
      if (noteEditorRef.current) {
        noteEditorRef.current.innerHTML = updated;
      }
      await persistNoteNow(noteTitle, updated, false);
      showToast('AI enhancement applied & saved!', 'success');
    } catch (err: any) {
      showToast(`AI Error: ${err.message}`, 'error');
    }
  };

  // --- Handlers: Tasks ---
  const handleToggleTask = async (id: string, currentStatus: string) => {
    const status = currentStatus === 'done' ? 'todo' : 'done';
    await db.updateTask(id, { status });
    refreshWorkspaceData();
  };

  const handleUpdateTaskStatus = async (id: string, status: string) => {
    await db.updateTask(id, { status });
    refreshWorkspaceData();
  };

  const handleDeleteTask = async (id: string) => {
    await db.deleteTask(id);
    refreshWorkspaceData();
  };

  const handleCreateTaskSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const formData = new FormData(formEl);
    const title = String(formData.get('title') || '').trim();
    const priority = String(formData.get('priority') || 'Medium');
    const dueDate = String(formData.get('due_date') || '');

    try {
      await db.createTask({
        title,
        priority,
        due_date: dueDate ? new Date(dueDate).toISOString() : null
      });
      setShowTaskModal(false);
      formEl.reset();
      showToast('Task added!', 'success');
      refreshWorkspaceData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // --- Handlers: Calendar ---
  const handleCreateEventSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const formData = new FormData(formEl);
    const title = String(formData.get('title') || '').trim();
    const event_date = String(formData.get('event_date') || '');
    const start_time = String(formData.get('start_time') || '10:00');
    const category = String(formData.get('category') || 'Work');
    const reminder_minutes = parseInt(String(formData.get('reminder_minutes') || '15'), 10);

    try {
      await db.createCalendarEvent({
        title,
        event_date,
        start_time,
        category,
        reminder_minutes
      });
      setShowEventModal(false);
      formEl.reset();
      showToast('Event created with reminder alert!', 'success');
      refreshWorkspaceData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    await db.deleteCalendarEvent(id);
    refreshWorkspaceData();
  };

  // --- Handlers: Chat (with Smart Thinking Animation, Smooth Typewriter Reveal & Per-User Session Storage) ---
  const animateAssistantTyping = (msgIdx: number, fullText: string) => {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    setTypingMsgIndex(msgIdx);
    setTypingVisibleText('');
    let cursor = 0;
    const stepSize = Math.max(4, Math.ceil(fullText.length / 95));

    typingTimerRef.current = setInterval(() => {
      cursor += stepSize;
      if (cursor >= fullText.length) {
        setTypingVisibleText(fullText);
        setTypingMsgIndex(null);
        clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
      } else {
        setTypingVisibleText(fullText.slice(0, cursor));
      }
    }, 18);
  };

  const deriveChatSessionTitle = (messages: ChatMessage[], currentSessionId: string | null) => {
    const existing = chatSessions.find(s => s.id === currentSessionId);
    if (existing && existing.title && existing.title !== 'New Chat') return existing.title;
    const firstUserMsg = messages.find(m => m.role === 'user');
    if (!firstUserMsg) return 'New Chat';
    const raw = firstUserMsg.content.trim().replace(/\s+/g, ' ');
    return raw.length > 42 ? raw.slice(0, 42) + '...' : raw;
  };

  const persistCurrentChatSession = async (messages: ChatMessage[]) => {
    try {
      const currentId = activeChatSessionIdRef.current;
      const title = deriveChatSessionTitle(messages, currentId);
      const saved = await db.saveChatSession({
        id: currentId || undefined,
        title,
        messages
      });
      if (saved && saved.id) {
        activeChatSessionIdRef.current = saved.id;
        setActiveChatSessionId(saved.id);
      }
      const updatedSessions = await db.getChatSessions();
      setChatSessions(updatedSessions);
    } catch (e) {
      console.warn('Chat session persistence warning:', e);
    }
  };

  const handleNewChatSession = () => {
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
      setTypingMsgIndex(null);
    }
    activeChatSessionIdRef.current = null;
    setActiveChatSessionId(null);
    setChatHistory([DEFAULT_GREETING_MSG]);
  };

  const handleSelectChatSession = (session: ChatSession) => {
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
      setTypingMsgIndex(null);
    }
    activeChatSessionIdRef.current = session.id;
    setActiveChatSessionId(session.id);
    setChatHistory(
      session.messages && session.messages.length > 0
        ? session.messages
        : [DEFAULT_GREETING_MSG]
    );
  };

  const handleDeleteChatSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await db.deleteChatSession(id);
    const updatedSessions = await db.getChatSessions();
    setChatSessions(updatedSessions);
    if (activeChatSessionIdRef.current === id) {
      if (updatedSessions.length > 0) {
        handleSelectChatSession(updatedSessions[0]);
      } else {
        handleNewChatSession();
      }
    }
    showToast('Chat session deleted.', 'info');
  };

  const handleChatSubmit = async () => {
    const query = chatInput.trim();
    if (!query || isChatThinking) return;
    setChatInput('');

    const updatedHistory: ChatMessage[] = [...chatHistory, { role: 'user', content: query }];
    setChatHistory(updatedHistory);
    setIsChatThinking(true);
    persistCurrentChatSession(updatedHistory);

    try {
      const answer = await ai.chatWithWorkspace(
        query,
        { meetings, notes, tasks, events },
        updatedHistory
      );
      const nextIdx = updatedHistory.length;
      const finalHistory: ChatMessage[] = [...updatedHistory, { role: 'assistant', content: answer }];
      setChatHistory(finalHistory);
      setIsChatThinking(false);
      animateAssistantTyping(nextIdx, answer);
      await persistCurrentChatSession(finalHistory);
    } catch (err: any) {
      setIsChatThinking(false);
      const errHistory: ChatMessage[] = [
        ...updatedHistory,
        { role: 'assistant', content: `**Chat Error:** ${err.message}` }
      ];
      setChatHistory(errHistory);
      await persistCurrentChatSession(errHistory);
    }
  };

  // --- Handlers: Settings ---
  const handleSaveSettings = () => {
    db.setConfig(cfgSbUrl, cfgSbAnon);
    ai.setConfig(cfgAiUrl, cfgAiKey, cfgAiModel);
    showToast('Configuration saved successfully!', 'success');
    syncAuthUI();
  };

  // --- Handlers: Knowledge Hub & Docs AI ---
  const activeDoc = documents.find(d => d.id === activeDocId) || documents[0] || null;

  const handleDocFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsDocUploading(true);
    showToast(`Uploading and indexing "${file.name}"...`, 'info');
    try {
      const newDoc = await db.uploadDocument(file);
      setDocuments(prev => [newDoc, ...prev]);
      setActiveDocId(newDoc.id);
      setDocChatHistory([]);
      showToast(`"${file.name}" indexed with AI summary!`, 'success');
    } catch (err: any) {
      showToast(`Upload failed: ${err.message}`, 'error');
    } finally {
      setIsDocUploading(false);
      if (docFileInputRef.current) docFileInputRef.current.value = '';
    }
  };

  const handleDeleteDoc = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await db.deleteDocument(id);
      setDocuments(prev => prev.filter(d => d.id !== id));
      if (activeDocId === id) {
        const remaining = documents.filter(d => d.id !== id);
        setActiveDocId(remaining.length > 0 ? remaining[0].id : null);
        setDocChatHistory([]);
      }
      showToast('Document deleted.', 'info');
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  };

  const handleDocChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = docChatInput.trim();
    if (!query || !activeDoc || isDocChatLoading) return;
    setDocChatInput('');
    const userMsg = { role: 'user', content: query };
    const nextHistory = [...docChatHistory, userMsg];
    setDocChatHistory(nextHistory);
    setIsDocChatLoading(true);

    try {
      const res = await db.chatWithDocument(activeDoc.id, query, nextHistory);
      setDocChatHistory([...nextHistory, { role: 'assistant', content: res.reply }]);
    } catch (err: any) {
      setDocChatHistory([...nextHistory, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setIsDocChatLoading(false);
    }
  };

  // --- Handlers: AI Task Breakdown ---
  const handleBreakdownTask = async (taskId: string) => {
    setBreakingDownTaskId(taskId);
    showToast('AI is breaking down task into subtasks...', 'info');
    try {
      const updated = await db.breakdownTask(taskId);
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
      showToast('Actionable subtasks generated!', 'success');
    } catch (err: any) {
      showToast(`Task breakdown failed: ${err.message}`, 'error');
    } finally {
      setBreakingDownTaskId(null);
    }
  };

  const handleToggleSubtask = async (taskId: string, subtaskIndex: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;
    const prevSubtasks = [...task.subtasks];
    const updatedSubtasks = [...task.subtasks];
    updatedSubtasks[subtaskIndex] = {
      ...updatedSubtasks[subtaskIndex],
      done: !updatedSubtasks[subtaskIndex].done
    };
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subtasks: updatedSubtasks } : t));
    try {
      await db.updateTask(taskId, { subtasks: updatedSubtasks });
    } catch (err) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subtasks: prevSubtasks } : t));
      showToast('Failed to update subtask', 'error');
      console.warn('Subtask toggle save error:', err);
    }
  };

  // --- Handlers: Note Export & Share ---
  const handleExportPDF = () => {
    window.print();
  };

  const handleExportMarkdown = () => {
    const plain = (noteEditorRef.current?.innerText || noteContent || '').trim();
    const mdContent = `# ${noteTitle || 'Untitled Note'}\n\n${plain}`;
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(noteTitle || 'Note').replace(/[^a-z0-9_-]/gi, '_')}.md`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Markdown file downloaded!', 'success');
  };

  // --- Handlers: Email & Outreach Assistant ---
  const handleOpenEmailModal = (source: 'note' | 'meeting') => {
    setEmailObjective(`Follow-up on ${source === 'note' ? (noteTitle || 'project notes') : 'recent meeting deliverables'}`);
    setEmailSubject('');
    setEmailBody('');
    setShowEmailModal(true);
  };

  const handleGenerateEmail = async () => {
    const activeNoteText = `Note Title: ${noteTitle}\n\n${noteEditorRef.current?.innerText || noteContent}`;
    setIsEmailGenerating(true);
    try {
      const res = await db.draftEmail({
        source_text: activeNoteText,
        tone: emailTone,
        recipient: emailRecipient,
        objective: emailObjective
      });
      setEmailSubject(res.subject);
      setEmailBody(res.body);
      showToast('Email draft generated!', 'success');
    } catch (err: any) {
      showToast(`Email drafting failed: ${err.message}`, 'error');
    } finally {
      setIsEmailGenerating(false);
    }
  };

  // --- Handlers: Audio File Upload ---
  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    showToast(`Uploading and transcribing "${file.name}"...`, 'info');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('user_email', db.getUserEmail());
      try { formData.append('language', String(JSON.parse(localStorage.getItem('renim_lang_prefs') || '{}').speechLang || 'en').slice(0, 2)); } catch {}

      const res = await fetch('/api/meetings/audio-transcribe', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        const savedMeeting = await db.saveMeeting({
          title: file.name.replace(/\.[^/.]+$/, ''),
          duration_seconds: data.duration_seconds || 80,
          word_count: data.word_count || 50,
          raw_transcript: data.transcript,
          summary: data.analysis,
          key_points: ['Uploaded audio processed', 'AI transcript generated'],
          action_items: []
        });
        setMeetings(prev => [savedMeeting, ...prev]);
        setActiveMeetingId(savedMeeting.id);
        showToast('Audio transcribed and meeting saved!', 'success');
      }
    } catch (err: any) {
      showToast(`Audio upload failed: ${err.message}`, 'error');
    } finally {
      if (audioFileInputRef.current) audioFileInputRef.current.value = '';
    }
  };

  // --- Handlers: Google Calendar & Notifications & PWA ---
  const getGoogleCalendarUrl = (e: CalendarEvent) => {
    const dateStr = (e.event_date || '').replace(/-/g, '');
    const timeClean = (e.start_time || '10:00:00').replace(/:/g, '').slice(0, 4) + '00';
    const startIso = `${dateStr}T${timeClean}`;
    const nextHour = String(Math.min(23, Number(timeClean.slice(0, 2)) + 1)).padStart(2, '0');
    const endIso = `${dateStr}T${nextHour}${timeClean.slice(2)}`;
    const title = encodeURIComponent(e.title || 'Renim AI Event');
    const details = encodeURIComponent(e.description || `Category: ${e.category || 'Work'} — Synchronized from Renim AI Workspace`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startIso}/${endIso}&details=${details}`;
  };

  const handleExportCalendarICS = () => {
    db.exportCalendarICS();
    showToast('Exporting calendar (.ics) for Google Calendar / Apple Cal...', 'success');
  };

  const handleImportCalendarICS = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    showToast(`Importing events from "${file.name}"...`, 'info');
    try {
      const res = await db.importCalendarICS(file);
      showToast(`Imported ${res.count} events into your calendar!`, 'success');
      refreshWorkspaceData();
    } catch (err: any) {
      showToast(`ICS import error: ${err.message}`, 'error');
    } finally {
      if (icsFileInputRef.current) icsFileInputRef.current.value = '';
    }
  };

  const handleTogglePushNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showToast('Push Notifications are not supported in this browser.', 'warning');
      return;
    }

    // If currently enabled, toggle it OFF (Mute)
    if (isPushEnabled) {
      setIsPushEnabled(false);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('renim_push_enabled', 'false');
      }
      showToast('Push notifications turned OFF (Muted).', 'info');
      return;
    }

    // If currently OFF, turn it ON
    try {
      if (Notification.permission === 'denied') {
        showToast('Browser notifications are blocked. Please click the site settings / lock icon in your browser address bar to allow.', 'warning');
        return;
      }

      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        setIsPushEnabled(true);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('renim_push_enabled', 'true');
        }
        showToast('Push notifications enabled for event reminders!', 'success');
        try {
          new Notification('Renim AI Alerts Active', {
            body: 'You will receive reminders 15 minutes before your scheduled meetings and events.',
            icon: '/icon.svg',
          });
        } catch (_) {}
      } else {
        setIsPushEnabled(false);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('renim_push_enabled', 'false');
        }
        showToast('Notification permission denied by browser.', 'warning');
      }
    } catch (err: any) {
      showToast(`Push notification error: ${err.message}`, 'error');
    }
  };

  const handleSendEmailReminder = async (event: CalendarEvent) => {
    const recipient = userEmail || 'user@renimai.com';
    showToast(`Dispatching email reminder for "${event.title}"...`, 'info');
    try {
      const res = await db.sendEmailNotification({
        to_email: recipient,
        subject: `Renim AI Reminder: ${event.title} at ${event.start_time.slice(0, 5)}`,
        html_content: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #0891b2;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
              <span style="font-size: 20px; font-weight: 800; color: #06b6d4;">Renim AI</span>
              <span style="font-size: 12px; background: rgba(8, 145, 178, 0.2); color: #22d3ee; padding: 2px 8px; border-radius: 12px;">Calendar Alert</span>
            </div>
            <h2 style="margin: 0 0 12px 0; color: #ffffff;">${event.title}</h2>
            <div style="background: #1e293b; padding: 16px; border-radius: 8px; border-left: 4px solid #06b6d4; margin-bottom: 20px;">
              <p style="margin: 4px 0; font-size: 14px;"><strong>Date:</strong> ${event.event_date}</p>
              <p style="margin: 4px 0; font-size: 14px;"><strong>Time:</strong> ${event.start_time.slice(0, 5)}</p>
              <p style="margin: 4px 0; font-size: 14px;"><strong>Category:</strong> ${event.category || 'Meeting'}</p>
              ${event.description ? `<p style="margin: 8px 0 0 0; font-size: 13px; color: #94a3b8;">${event.description}</p>` : ''}
            </div>
            <p style="font-size: 12px; color: #64748b; margin: 0;">Automated notification generated by Renim AI Workspace.</p>
          </div>
        `,
        resend_api_key: resendApiKey || undefined,
      });
      if (res.status === 'sent') {
        showToast('Email reminder sent via Resend API!', 'success');
      } else {
        showToast(res.message || 'Notification queued (Simulation mode)', 'info');
      }
    } catch (err: any) {
      showToast(`Email error: ${err.message}`, 'error');
    }
  };

  const handleInstallPWA = async () => {
    if (!deferredPrompt) {
      showToast('App is already installed or browser does not support prompt.', 'info');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      showToast('Renim AI installed to your desktop/homescreen!', 'success');
    }
    setDeferredPrompt(null);
    setIsPWAInstallable(false);
  };

  // --- Pomodoro Deep Work Timer Effect ---
  useEffect(() => {
    let interval: any = null;
    if (isPomodoroRunning) {
      interval = setInterval(() => {
        setPomodoroSeconds(prev => {
          if (prev <= 1) {
            setIsPomodoroRunning(false);
            stopAmbientAudio();
            // Audio Chime notification
            try {
              const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
              if (AudioCtx) {
                const ctx = new AudioCtx();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(587.33, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.35);
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.8);
              }
            } catch (e) {}
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && isPushEnabled) {
              new Notification('Renim AI Deep Work Session Complete!', {
                body: 'Fantastic focus! Take a 5-minute break to recharge.',
                icon: '/icon.svg'
              });
            }
            showToast('🎉 Focus session completed! Outstanding deep work!', 'success');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPomodoroRunning, isPushEnabled]);



  // --- Procedural Ambient Audio Synthesizer (Delegated to ambientAudio service) ---
  const stopAmbientAudio = () => {
    ambientAudio.stop();
  };

  const startAmbientAudio = (soundType: 'rain' | 'space' | 'hum') => {
    ambientAudio.start(soundType);
  };

  const handleSetPomodoroMode = (mode: 'focus25' | 'deep50' | 'break5') => {
    setPomodoroMode(mode);
    setIsPomodoroRunning(false);
    const secs = mode === 'focus25' ? 25 * 60 : mode === 'deep50' ? 50 * 60 : 5 * 60;
    setPomodoroSeconds(secs);
    setPomodoroTotalSeconds(secs);
  };

  const handleToggleAmbient = (sound: 'off' | 'rain' | 'space' | 'hum') => {
    setAmbientSound(sound);
    if (sound === 'off') {
      stopAmbientAudio();
    } else {
      startAmbientAudio(sound);
    }
  };

  // --- Voice Dictation (Web Speech API supporting Bengali & English) ---
  const toggleVoiceDictation = () => {
    if (isVoiceDictating) {
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop(); } catch(e) {}
      }
      setIsVoiceDictating(false);
      showToast('Voice dictation paused', 'info');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Web Speech API is not supported in this browser. Please use Google Chrome or Microsoft Edge.', 'warning');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = voiceDictationLang;
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsVoiceDictating(true);
        showToast(`Listening in ${voiceDictationLang === 'bn-BD' ? 'Bengali (বাংলা)' : 'English'}... Speak now!`, 'success');
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript + ' ';
          }
        }
        if (transcript.trim()) {
          const cleanText = transcript.trim();
          if (noteEditorRef.current) {
            noteEditorRef.current.focus();
            document.execCommand('insertText', false, ' ' + cleanText + ' ');
            const html = noteEditorRef.current.innerHTML;
            setNoteContent(html);
            triggerNoteSave(noteTitle, html);
          } else {
            setNoteContent(prev => prev + ' ' + cleanText);
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          showToast(`Speech notice: ${event.error}`, 'warning');
        }
        setIsVoiceDictating(false);
      };

      recognition.onend = () => {
        setIsVoiceDictating(false);
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Speech recognition error:', err);
      showToast('Microphone access denied or speech recognition unavailable.', 'error');
      setIsVoiceDictating(false);
    }
  };

  // --- Kanban Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    setDraggedTaskId(taskId);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverCol(null);
  };

  const handleDragOverColumn = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    if (dragOverCol !== colKey) {
      setDragOverCol(colKey);
    }
  };

  const handleDropToColumn = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (!taskId) return;

    const existingTask = tasks.find(t => t.id === taskId);
    const prevStatus = existingTask?.status || 'todo';
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, status: newStatus } : t)));
    try {
      await db.updateTask(taskId, { status: newStatus });
      showToast(`Task moved to ${newStatus.replace('_', ' ').toUpperCase()}`, 'info');
    } catch (err: any) {
      setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, status: prevStatus } : t)));
      console.error('Failed to update task status on drop:', err);
      showToast('Failed to persist task status', 'error');
    }
    setDraggedTaskId(null);
  };

  // --- Full Workspace Backup & Archive Handlers ---
  const handleExportFullJsonArchive = () => {
    try {
      const backupData = {
        exported_at: new Date().toISOString(),
        product: 'Renim AI Workspace Second Brain',
        version: '2.5.0',
        user: { name: userName, email: userEmail },
        counts: {
          notes: notes.length,
          tasks: tasks.length,
          events: events.length,
          meetings: meetings.length,
          documents: documents.length
        },
        notes,
        tasks,
        events,
        meetings,
        documents
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `renim_ai_workspace_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('💾 Full Workspace JSON Archive successfully downloaded!', 'success');
    } catch (e: any) {
      showToast('Failed to create backup: ' + e.message, 'error');
    }
  };

  const handleExportMarkdownArchive = () => {
    try {
      let md = `# Renim AI Workspace Comprehensive Archive\n`;
      md += `**Export Date:** ${new Date().toLocaleString()}\n`;
      md += `**User:** ${userName} (${userEmail})\n\n`;

      md += `## 📋 Tasks & Sprint Deliverables (${tasks.length})\n\n`;
      tasks.forEach(t => {
        const check = t.status === 'done' ? '[x]' : '[ ]';
        md += `- ${check} **${t.title}** (Status: *${t.status || 'todo'}*, Priority: *${t.priority || 'medium'}*)\n`;
        if (t.subtasks && t.subtasks.length > 0) {
          t.subtasks.forEach(st => {
            md += `    - ${st.done ? '[x]' : '[ ]'} ${st.title}\n`;
          });
        }
      });

      md += `\n## 📝 Smart Notes (${notes.length})\n\n`;
      notes.forEach(n => {
        md += `### ${n.title || 'Untitled Note'}\n`;
        md += `*Updated: ${n.updated_at || 'N/A'}*\n\n`;
        const plainText = (n.content || '').replace(/<[^>]+>/g, '\n').trim();
        md += `${plainText}\n\n---\n\n`;
      });

      md += `## 📅 Calendar Events (${events.length})\n\n`;
      events.forEach(e => {
        md += `- **${e.event_date} ${e.start_time || ''}**: ${e.title} [${e.category || 'General'}]\n`;
      });

      md += `\n## 🎙️ Meetings & Transcripts (${meetings.length})\n\n`;
      meetings.forEach(m => {
        md += `### ${m.title || 'Meeting'}\n`;
        md += `*Date: ${m.created_at || 'N/A'}*\n\n`;
        if (m.summary) md += `**Summary:**\n${m.summary}\n\n`;
        if (m.raw_transcript) md += `**Transcript:**\n${m.raw_transcript}\n\n`;
      });

      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `renim_ai_knowledge_archive_${new Date().toISOString().slice(0, 10)}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('📑 Markdown Knowledge Archive successfully downloaded!', 'success');
    } catch (e: any) {
      showToast('Failed to export Markdown archive: ' + e.message, 'error');
    }
  };

  // --- Filtered & Derived Data ---
  const q = searchQuery.toLowerCase().trim();
  const filteredMeetings = q ? meetings.filter(m => m.title.toLowerCase().includes(q) || (m.summary || '').toLowerCase().includes(q)) : meetings;
  const filteredNotes = q ? notes.filter(n => n.title.toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q)) : notes;
  const filteredTasks = q ? tasks.filter(t => t.title.toLowerCase().includes(q)) : tasks;

  // Sprint Velocity & Productivity Metrics
  const totalTasksCount = tasks.length;
  const completedTasksCount = tasks.filter(t => t.status === 'done').length;
  const inProgressTasksCount = tasks.filter(t => t.status === 'in_progress').length;
  const highPriorityCount = tasks.filter(t => (t.priority || '').toLowerCase() === 'high' && t.status !== 'done').length;
  const sprintCompletionPercent = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDateBadge = new Date()
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase();
  const todayEvents = events.filter(e => e.event_date === todayStr);
  const pendingTasks = filteredTasks.filter(t => t.status !== 'done');

  // Calendar grid generation
  const calYear = calMonthDate.getFullYear();
  const calMonth = calMonthDate.getMonth();
  const firstDayIndex = new Date(calYear, calMonth, 1).getDay();
  const totalDays = new Date(calYear, calMonth + 1, 0).getDate();
  const prevMonthDays = new Date(calYear, calMonth, 0).getDate();
  const nowDate = new Date();
  const isCurrentMonth = nowDate.getFullYear() === calYear && nowDate.getMonth() === calMonth;
  const totalRenderedCells = firstDayIndex + totalDays;
  const nextTrailingDays = (7 - (totalRenderedCells % 7)) % 7;
  const selectedDayEvents = events.filter(e => e.event_date === calSelectedDateStr);
  const muiTheme = React.useMemo(() => makeRenimTheme(themeMode === 'light' ? 'light' : 'dark'), [themeMode]);



  return (
    <ThemeProvider theme={muiTheme}>
    <div id="app" className={`app-layout ${themeMode === 'light' ? 'theme-light' : 'theme-dark'}`}>
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        counts={{
          meetings: meetings.length,
          notes: notes.length,
          tasks: tasks.length,
          events: events.length,
          documents: documents.length
        }}
        userName={userName}
        userEmail={userEmail}
        userAvatarUrl={userAvatarUrl}
        isSuperAdmin={isSuperAdmin}
        activeOrgName={activeOrgName}
        isAuthenticated={isAuthenticated}
        onAuthTrigger={handleAuthTrigger}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {mobileMenuOpen && (
        <div
          className="mobile-drawer-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div className="main-viewport">
        <div className="renim-aurora" aria-hidden="true"><span className="a1" /><span className="a2" /></div>
        <Header
          activeView={activeView}
          themeMode={themeMode}
          toggleThemeMode={toggleThemeMode}
          isAuthenticated={isAuthenticated}
          isOffline={isOffline}
          isPWAInstallable={isPWAInstallable}
          isPushEnabled={isPushEnabled}
          onInstallPWA={handleInstallPWA}
          onTogglePushNotifications={handleTogglePushNotifications}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenCreateDialog={() => setShowEventModal(true)}
          onOpenFocusModal={() => setShowFocusModal(true)}
          onOpenScratchpad={() => setShowScratchpad(true)}
          onToggleMobileMenu={() => setMobileMenuOpen((o) => !o)}
          userName={userName}
          userAvatarUrl={userAvatarUrl}
          onOpenProfile={() => setActiveView('view-profile')}
          notificationCenter={
            <NotificationCenter
              items={inbox.items}
              unreadCount={inbox.unreadCount}
              onMarkAllRead={inbox.markAllRead}
              onMarkRead={inbox.markRead}
              onClearAll={inbox.clearAll}
              isPushEnabled={isPushEnabled}
              onTogglePush={handleTogglePushNotifications}
            />
          }
          orgs={tenantOrgs}
          activeOrgId={activeOrgId}
          onSelectOrg={(orgId) => {
            setActiveOrgId(orgId);
            const found = tenantOrgs.find((o) => o.id === orgId);
            setActiveOrgName(found ? found.name : 'Personal');
            if (found?.brand_color) {
              document.documentElement.style.setProperty('--mui-primary', found.brand_color);
            } else {
              document.documentElement.style.removeProperty('--mui-primary');
            }
            showToast(found ? `Switched to ${found.name} (${found.role})` : 'Switched to Personal Workspace', 'info');
          }}
        />

        <VerifyEmailBanner
          accessToken={isAuthenticated ? db.accessToken : null}
          userEmail={userEmail}
          initialVerified={(db.user as any)?.email_verified}
          onNotify={showToast}
        />

        <WelcomeDialog
          open={showWelcome}
          userEmail={userEmail}
          userName={userName}
          onClose={() => setShowWelcome(false)}
          onUseCasesChange={setUseCases}
          onWriteNote={() => { setActiveView('view-notes'); handleNewNote(); }}
          onRecordMeeting={() => setActiveView('view-meetings')}
          onAddTask={() => setShowTaskModal(true)}
          isPushEnabled={isPushEnabled}
          onEnableNotifications={handleTogglePushNotifications}
          onConnectCalendar={() => setActiveView('view-calendar')}
        />

        <TodayView
          isActive={activeView === 'view-today'}
          useCases={useCases}
          userName={userName}
          isVoiceMemoActive={isVoiceMemoActive}
          handleVoiceMemoToggle={handleVoiceMemoToggle}
          voiceMemoStatus={voiceMemoStatus}
          generateMorningBriefing={generateMorningBriefing}
          todayDateBadge={todayDateBadge}
          isBriefingLoading={isBriefingLoading}
          thinkingStepIndex={thinkingStepIndex}
          aiThinkingSteps={AI_THINKING_STEPS}
          briefingText={briefingText}
          setShowTaskModal={setShowTaskModal}
          pendingTasks={pendingTasks}
          handleToggleTask={handleToggleTask}
          setShowEventModal={setShowEventModal}
          todayEvents={todayEvents}
          onOpenFocusModal={() => setShowFocusModal(true)}
          onNavigateView={setActiveView}
        />

          <MeetingsView
            isActive={activeView === 'view-meetings'}
            waveformCanvasRef={waveformCanvasRef}
            isMeetingRecording={isMeetingRecording}
            startMeetingRecording={startMeetingRecording}
            setShowPasteModal={setShowPasteModal}
            onUploadAudioClick={() => audioFileInputRef.current?.click()}
            filteredMeetings={filteredMeetings}
            activeMeetingId={activeMeetingId}
            setActiveMeetingId={setActiveMeetingId}
            activeMeeting={activeMeeting}
            handleCopyMeetingMd={handleCopyMeetingMd}
            handleDeleteMeeting={handleDeleteMeeting}
            liveTranscriptText={liveTranscriptText}
          />

          <NotesView
            isActive={activeView === 'view-notes'}
            handleNewNote={handleNewNote}
            filteredNotes={filteredNotes}
            activeNoteId={activeNoteId}
            selectNote={selectNote}
            stripHtmlPreview={stripHtmlPreview}
            noteTitle={noteTitle}
            setNoteTitle={setNoteTitle}
            noteEditorRef={noteEditorRef}
            noteContent={noteContent}
            setNoteContent={setNoteContent}
            triggerNoteSave={triggerNoteSave}
            execEditorCmd={execEditorCmd}
            noteLineSpacing={noteLineSpacing}
            setNoteLineSpacing={setNoteLineSpacing}
            handleInsertLink={handleInsertLink}
            handleInsertTable={handleInsertTable}
            handleInsertImage={handleInsertImage}
            handleInsertCodeBlock={handleInsertCodeBlock}
            noteSpellCheck={noteSpellCheck}
            setNoteSpellCheck={setNoteSpellCheck}
            isVoiceDictating={isVoiceDictating}
            toggleVoiceDictation={toggleVoiceDictation}
            voiceDictationLang={voiceDictationLang}
            setVoiceDictationLang={setVoiceDictationLang}
            handleNotePaste={handleNotePaste}
            noteSaveStatus={noteSaveStatus}
            handleDeleteNote={handleDeleteNote}
            noteSaveTimerRef={noteSaveTimerRef}
            persistNoteNow={persistNoteNow}
            onNotesChanged={refreshWorkspaceData}
            handleNoteAI={handleNoteAI}
            handleOpenEmailModal={handleOpenEmailModal}
            handleExportPDF={handleExportPDF}
            handleExportMarkdown={handleExportMarkdown}
            setShowShareModal={setShowShareModal}
            hasActiveOrg={!!activeOrgId}
            onPublicShareNote={async () => {
              if (!activeNoteId) return showToast('Save or select a note first', 'error');
              const res = await createPublicShareLink({
                resource_type: 'note',
                resource_id: activeNoteId,
                title: noteTitle || 'Shared Note',
                content: noteEditorRef.current?.innerText || noteContent || '',
                org_id: activeOrgId,
                user_email: userEmail
              });
              if (res.share_path) {
                const url = `${window.location.origin}${res.share_path}`;
                await navigator.clipboard.writeText(url);
                showToast(`Public link copied: ${res.share_path}`, 'success');
              } else {
                showToast(res.error || 'Failed to create public link', 'error');
              }
            }}
            onToggleTeamVisibility={async () => {
              if (!activeNoteId || !activeOrgId) return showToast('Select an Organization and Note first', 'error');
              const res = await setResourceVisibility({
                resource_type: 'note',
                resource_id: activeNoteId,
                org_id: activeOrgId,
                visibility: 'team',
                user_email: userEmail
              });
              if (res.updated) showToast(`Shared note to ${activeOrgName} Team Feed!`, 'success');
              else showToast(res.error || 'Failed to share to team', 'error');
            }}
          />

          <CalendarView
            isActive={activeView === 'view-calendar'}
            events={events}
            monthNames={MONTH_NAMES}
            calMonth={calMonth}
            calYear={calYear}
            setCalMonthDate={setCalMonthDate}
            setCalSelectedDateStr={setCalSelectedDateStr}
            calSelectedDateStr={calSelectedDateStr}
            firstDayIndex={firstDayIndex}
            prevMonthDays={prevMonthDays}
            totalDays={totalDays}
            isCurrentMonth={isCurrentMonth}
            nowDate={nowDate}
            nextTrailingDays={nextTrailingDays}
            handleExportCalendarICS={handleExportCalendarICS}
            icsFileInputRef={icsFileInputRef}
            setShowEventModal={setShowEventModal}
            selectedDayEvents={selectedDayEvents}
            getGoogleCalendarUrl={getGoogleCalendarUrl}
            handleSendEmailReminder={handleSendEmailReminder}
            handleDeleteEvent={handleDeleteEvent}
          />

          <TasksView
            isActive={activeView === 'view-tasks'}
            setShowFocusModal={setShowFocusModal}
            taskViewMode={taskViewMode}
            setTaskViewMode={setTaskViewMode}
            setShowTaskModal={setShowTaskModal}
            sprintCompletionPercent={sprintCompletionPercent}
            completedTasksCount={completedTasksCount}
            totalTasksCount={totalTasksCount}
            inProgressTasksCount={inProgressTasksCount}
            highPriorityCount={highPriorityCount}
            filteredTasks={filteredTasks}
            dragOverCol={dragOverCol}
            setDragOverCol={setDragOverCol}
            handleDragOverColumn={handleDragOverColumn}
            handleDropToColumn={handleDropToColumn}
            draggedTaskId={draggedTaskId}
            handleDragStart={handleDragStart}
            handleDragEnd={handleDragEnd}
            handleDeleteTask={handleDeleteTask}
            breakingDownTaskId={breakingDownTaskId}
            handleBreakdownTask={handleBreakdownTask}
            handleToggleSubtask={handleToggleSubtask}
            handleUpdateTaskStatus={handleUpdateTaskStatus}
            handleToggleTask={handleToggleTask}
          />

          <DocsView
            isActive={activeView === 'view-docs'}
            documents={documents}
            onUploadDocClick={() => docFileInputRef.current?.click()}
            isDocUploading={isDocUploading}
            activeDoc={activeDoc}
            setActiveDocId={setActiveDocId}
            setDocChatHistory={setDocChatHistory}
            handleDeleteDoc={handleDeleteDoc}
            showDocPreview={showDocPreview}
            setShowDocPreview={setShowDocPreview}
            docChatHistory={docChatHistory}
            isDocChatLoading={isDocChatLoading}
            handleDocChatSubmit={handleDocChatSubmit}
            docChatInput={docChatInput}
            setDocChatInput={setDocChatInput}
          />

          <ChatView
            isActive={activeView === 'view-chat'}
            handleNewChatSession={handleNewChatSession}
            chatSessions={chatSessions}
            activeChatSessionId={activeChatSessionId}
            handleSelectChatSession={handleSelectChatSession}
            handleDeleteChatSession={handleDeleteChatSession}
            chatHistoryRef={chatHistoryRef}
            chatHistory={chatHistory}
            typingMsgIndex={typingMsgIndex}
            typingVisibleText={typingVisibleText}
            isChatThinking={isChatThinking}
            aiThinkingSteps={AI_THINKING_STEPS}
            thinkingStepIndex={thinkingStepIndex}
            chatInput={chatInput}
            setChatInput={setChatInput}
            handleChatSubmit={handleChatSubmit}
          />

          <SettingsView
            isActive={activeView === 'view-settings'}
            cfgSbUrl={cfgSbUrl}
            cfgSbAnon={cfgSbAnon}
            cfgAiModel={cfgAiModel}
            setCfgAiModel={setCfgAiModel}
            cfgAiUrl={cfgAiUrl}
            setCfgAiUrl={setCfgAiUrl}
            cfgAiKey={cfgAiKey}
            setCfgAiKey={setCfgAiKey}
            handleSaveSettings={handleSaveSettings}
            isPushEnabled={isPushEnabled}
            handleTogglePushNotifications={handleTogglePushNotifications}
            isPWAInstallable={isPWAInstallable}
            handleInstallPWA={handleInstallPWA}
            resendApiKey={resendApiKey}
            setResendApiKey={setResendApiKey}
            showToast={showToast}
            handleExportFullJsonArchive={handleExportFullJsonArchive}
            handleExportMarkdownArchive={handleExportMarkdownArchive}
            notesCount={notes.length}
            tasksCount={tasks.length}
            eventsCount={events.length}
            meetingsCount={meetings.length}
          />

          {activeView === 'view-rag' && (
            <EnterpriseRagView userEmail={userEmail} showToast={showToast} />
          )}

          {activeView === 'view-team' && (
            <TeamOrgsView
              userEmail={userEmail}
              activeOrgId={activeOrgId}
              onSelectOrg={(org: Organization) => {
                setActiveOrgId(org.id);
                setActiveOrgName(org.name);
                db.activeOrgId = org.id || 'personal';
                try { sessionStorage.setItem('renim_active_org_id', org.id || 'personal'); } catch {}
                refreshWorkspaceData();
              }}
              showToast={showToast}
            />
          )}

          {activeView === 'view-analytics' && (
            <AnalyticsView userEmail={userEmail} showToast={showToast} />
          )}

          {activeView === 'view-integrations' && (
            <IntegrationsView userEmail={userEmail} showToast={showToast} />
          )}

          {activeView === 'view-billing' && (
            <BillingView userEmail={userEmail} activeOrgId={activeOrgId} showToast={showToast} />
          )}

          {activeView === 'view-security' && (
            <SecurityAuditView userEmail={userEmail} showToast={showToast} />
          )}

          {activeView === 'view-growth' && (
            <GrowthHubView
              userEmail={userEmail}
              notes={notes}
              onSaveUrlAsNote={async (title, content) => {
                const created = await db.createNote({ user_email: userEmail, title, content, tags: ['web-summary'] });
                if (created) setNotes((prev) => [created, ...prev]);
              }}
              showToast={showToast}
            />
          )}

          {activeView === 'view-profile' && (
            <ProfileView
              userEmail={userEmail}
              userName={userName}
              activeOrgName={activeOrgName}
              isAuthenticated={isAuthenticated}
              onAuthTrigger={handleAuthTrigger}
              onProfileUpdated={(newName, newAvatarUrl) => {
                setUserName(newName);
                setUserAvatarUrl(newAvatarUrl);
                try {
                  localStorage.setItem('renim_user_name', newName);
                } catch {}
              }}
              onNavigateView={(v) => setActiveView(v)}
              showToast={showToast}
            />
          )}

          {activeView === 'view-superadmin' && isSuperAdmin && (
            <SuperAdminView adminEmail={userEmail} showToast={showToast} />
          )}
      </div>

      <ScratchpadDrawer
        isOpen={showScratchpad}
        onClose={() => setShowScratchpad(false)}
        onSaveAsNote={async (title, text) => {
          const created = await db.createNote({ user_email: userEmail, title, content: `<p>${text.replace(/\n/g, '<br/>')}</p>`, tags: ['scratchpad'] });
          if (created) setNotes((prev) => [created, ...prev]);
        }}
        onSaveAsTask={async (title) => {
          const created = await db.createTask({ user_email: userEmail, title, priority: 'medium', status: 'todo' });
          if (created) setTasks((prev) => [created, ...prev]);
        }}
        showToast={showToast}
      />

      {/* Modals */}
      <EventModal
        isOpen={showEventModal}
        onClose={() => setShowEventModal(false)}
        onSubmit={handleCreateEventSubmit}
        calSelectedDateStr={calSelectedDateStr}
      />

      <TaskModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        onSubmit={handleCreateTaskSubmit}
      />

      <PasteTranscriptModal
        isOpen={showPasteModal}
        onClose={() => setShowPasteModal(false)}
        onSubmit={handlePasteTranscriptSubmit}
      />

      <EmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        emailRecipient={emailRecipient}
        setEmailRecipient={setEmailRecipient}
        emailTone={emailTone}
        setEmailTone={setEmailTone}
        emailObjective={emailObjective}
        setEmailObjective={setEmailObjective}
        emailSubject={emailSubject}
        setEmailSubject={setEmailSubject}
        emailBody={emailBody}
        setEmailBody={setEmailBody}
        isEmailGenerating={isEmailGenerating}
        onGenerateEmail={handleGenerateEmail}
        onCopyDraft={() => {
          navigator.clipboard.writeText(`Subject: ${emailSubject}\n\n${emailBody}`);
          showToast('Email draft copied to clipboard!', 'success');
        }}
      />

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        activeNoteId={activeNoteId}
        noteTitle={noteTitle}
        noteContent={noteContent}
        noteEditorHtml={noteEditorRef.current?.innerHTML}
        onCopyShareLink={() => {
          navigator.clipboard.writeText(`${window.location.origin}/share/note/${activeNoteId || 'note-preview'}`);
          showToast('Public preview link copied!', 'success');
        }}
      />

      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        query={cmdSearchQuery}
        setQuery={setCmdSearchQuery}
        notes={notes}
        tasks={tasks}
        documents={documents}
        onNavigateView={(view) => {
          setActiveView(view);
          setIsCommandPaletteOpen(false);
        }}
        onSelectNote={(noteId) => {
          const n = notes.find(item => item.id === noteId);
          if (n) selectNote(n);
          setActiveView('view-notes');
          setIsCommandPaletteOpen(false);
        }}
        onCreateNote={() => {
          handleNewNote();
          setIsCommandPaletteOpen(false);
        }}
        onCreateTask={() => {
          setShowTaskModal(true);
          setIsCommandPaletteOpen(false);
        }}
        onUploadDoc={() => {
          docFileInputRef.current?.click();
          setIsCommandPaletteOpen(false);
        }}
        onSelectDoc={(docId) => {
          setActiveDocId(docId);
          setActiveView('view-docs');
          setIsCommandPaletteOpen(false);
        }}
      />

      <PomodoroModal
        isOpen={showFocusModal}
        onClose={() => {
          setShowFocusModal(false);
          ambientAudio.stop();
          setAmbientSound('off');
        }}
        pomodoroSeconds={pomodoroSeconds}
        setPomodoroSeconds={setPomodoroSeconds}
        isPomodoroRunning={isPomodoroRunning}
        setIsPomodoroRunning={setIsPomodoroRunning}
        pomodoroMode={pomodoroMode}
        onSetPomodoroMode={handleSetPomodoroMode}
        ambientSound={ambientSound}
        onToggleAmbient={handleToggleAmbient}
        tasks={tasks}
        focusTaskId={focusTaskId}
        setFocusTaskId={setFocusTaskId}
        onToggleTask={handleToggleTask}
        showToast={showToast}
      />

      {/* Hidden File Inputs for Document, Audio & Calendar iCal (.ics) Upload */}
      <input
        type="file"
        ref={docFileInputRef}
        accept=".pdf,.txt,.docx,.md"
        style={{ display: 'none' }}
        onChange={handleDocFileUpload}
      />
      <input
        type="file"
        ref={audioFileInputRef}
        accept="audio/*,.mp3,.wav,.m4a"
        style={{ display: 'none' }}
        onChange={handleAudioFileUpload}
      />
      <input
        type="file"
        ref={icsFileInputRef}
        accept=".ics,text/calendar"
        style={{ display: 'none' }}
        onChange={handleImportCalendarICS}
      />

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeView={activeView}
        onSelectView={(v) => {
          setActiveView(v);
          setMobileMenuOpen(false);
        }}
        onOpenMenu={() => setMobileMenuOpen((o) => !o)}
        isMenuOpen={mobileMenuOpen}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} />
    </div>
    </ThemeProvider>
  );
}
