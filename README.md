# Renim AI — All-in-One Daily AI Productivity SaaS Web Application

An enterprise-grade, all-in-one daily productivity SaaS platform unifying AI morning briefings, real-time meeting note-taking with in-browser audio waveforms, second-brain smart notes, interactive calendar scheduling with proactive reminders, and an AI workspace copilot.

---

## 🚀 Key Modules & Capabilities

1. ☀️ **Today / Daily Briefing:** AI morning summary, agenda overview, priority tasks, and quick voice-to-action memo recording.
2. 🎙️ **Meetings Hub:** In-browser microphone & system audio recording with live HTML5 canvas waveform visualizer, live speech-to-text, executive summaries, decisions, and action item extraction.
3. 📝 **Smart Notes (Second Brain):** Distraction-free note editor with AI writing assistant (summarize, extract tasks, fix grammar, rewrite professionally, brainstorm next steps).
4. 📅 **Interactive Calendar & Reminders:** Month/Week scheduling with categories (`Work`, `Meeting`, `Deadline`, `Personal`) and active background reminder toast notifications.
5. ✅ **Tasks & Action Items:** Priority levels (`High`, `Medium`, `Low`), status tracking, and 1-click meeting action item sync.
6. 💬 **Ask AI Copilot:** RAG-style workspace intelligence chatting across meetings, notes, tasks, and calendar events.
7. 🌐 **Light Mode Product Landing Page:** Stripe/Linear-style marketing homepage with interactive bento grid, workspace demo showcase, comparison table, pricing plans (`Free`, `Pro $12/mo`, `Team $29/mo`), and FAQ.

---

## 🎨 Design System

- **Framework:** Material-UI (MUI) Design Principles with elevated surfaces.
- **Theme:** 
  - Product Homepage: **Light Mode** (`#f8fafc` / `#ffffff` with royal indigo accents).
  - Workspace Dashboard: **Dark Mode** (`#09090b` / `#121215` / `#18181b`).
- **Iconography:** High-precision Google `Material Symbols Rounded` vector icons (**Zero keyboard emojis**).

---

## 🗄️ Database Setup (Supabase PostgreSQL)

1. Open your [Supabase Dashboard](https://supabase.com).
2. Navigate to the **SQL Editor**.
3. Copy and run the contents of [`supabase-schema.sql`](./supabase-schema.sql).
4. All tables (`profiles`, `meetings`, `transcripts`, `notes`, `tasks`, `calendar_events`, `chat_messages`) are strictly secured with **Row Level Security (RLS)**.

---

## ⚙️ Configuration & Credentials

Set your credentials in `.env` or in `js/config.js` (or via the in-app **Settings & Cloud** tab):

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key

AI_GATEWAY_URL=https://api.openai.com/v1
AI_GATEWAY_API_KEY=your-ai-gateway-key
AI_GATEWAY_MODEL=gpt-4o-mini
```

---

## 💻 Local Execution

Run the zero-dependency local static server:

```bash
node server.js
```

- **Product Homepage:** `http://localhost:3000/`
- **Workspace Web App:** `http://localhost:3000/app`

---

## 🚢 1-Click Production Deployment

This project includes [`vercel.json`](./vercel.json) pre-configured with URL rewrites:
- Deploy to **Vercel**, **Netlify**, or **Cloudflare Pages** without any build step.
- `/` serves the Light Mode SaaS Homepage.
- `/app` serves the Dark Mode Workspace Web Application.
