/**
 * Renim AI - AI Gateway Client
 * Calls OpenAI-compatible or custom AI Gateway endpoints for meeting summarization,
 * key takeaways, decisions, and action item extraction.
 */

class AIGatewayClient {
  constructor() {
    this.gatewayUrl = '';
    this.apiKey = '';
    this.model = 'gpt-4o-mini';
  }

  async init(config = null) {
    if (config) {
      this.gatewayUrl = (config.gatewayUrl || '').trim().replace(/\/$/, '');
      this.apiKey = (config.apiKey || '').trim();
      this.model = config.model || 'gpt-4o-mini';
    } else {
      const defaultEnv = (typeof window !== 'undefined' && window.ENV_CONFIG) || (typeof globalThis !== 'undefined' && globalThis.ENV_CONFIG) || {};
      const stored = await chrome.storage.local.get(['aiGatewayUrl', 'aiApiKey', 'aiModel']);
      
      this.gatewayUrl = (stored.aiGatewayUrl || defaultEnv.AI_GATEWAY_URL || 'https://api.openai.com/v1').trim().replace(/\/$/, '');
      this.apiKey = (stored.aiApiKey || defaultEnv.AI_GATEWAY_API_KEY || '').trim();
      this.model = stored.aiModel || defaultEnv.AI_GATEWAY_MODEL || 'gpt-4o-mini';
    }
  }

  isConfigured() {
    return Boolean(this.apiKey && this.gatewayUrl);
  }

  async setConfig(gatewayUrl, apiKey, model) {
    this.gatewayUrl = (gatewayUrl || 'https://api.openai.com/v1').trim().replace(/\/$/, '');
    this.apiKey = (apiKey || '').trim();
    this.model = (model || 'gpt-4o-mini').trim();

    await chrome.storage.local.set({
      aiGatewayUrl: this.gatewayUrl,
      aiApiKey: this.apiKey,
      aiModel: this.model
    });
  }

  /**
   * Generates structured meeting analysis from raw transcripts.
   * @param {Array<{speaker: string, text: string, timestamp: string}>} transcripts
   * @param {string} meetingTitle
   * @returns {Promise<{title: string, summary: string, key_points: string[], decisions: string[], action_items: Array<{task: string, owner: string, priority: string}>}>}
   */
  async generateMeetingSummary(transcripts, meetingTitle = 'Google Meet Session') {
    if (!this.isConfigured()) {
      throw new Error('AI Gateway URL or API Key is missing. Please configure it in Settings.');
    }

    if (!transcripts || transcripts.length === 0) {
      throw new Error('No transcripts recorded to summarize.');
    }

    // Format transcripts into a clean script
    const transcriptText = transcripts
      .map(t => `[${t.speaker || 'Speaker'}]: ${t.text}`)
      .join('\n');

    const systemPrompt = `You are an elite, highly professional Executive Meeting Assistant.
Your task is to analyze the provided meeting transcript and generate a structured, comprehensive, and crisp report.
You MUST output your response in valid JSON matching this exact structure:
{
  "title": "A concise, professional title summarizing the core topic of the meeting",
  "summary": "A comprehensive 2-3 paragraph executive summary explaining the main context, discussions, and outcomes",
  "key_points": [
    "Key discussion point or highlight 1",
    "Key discussion point or highlight 2"
  ],
  "decisions": [
    "Concrete decision agreed upon 1",
    "Concrete decision agreed upon 2"
  ],
  "action_items": [
    {
      "task": "Clear, actionable description of the task",
      "owner": "Name of the person responsible (or 'Unassigned' if not mentioned)",
      "priority": "High" | "Medium" | "Low"
    }
  ]
}
Return ONLY the raw JSON object, without any surrounding conversational text or markdown code fences if possible.`;

    const userPrompt = `Meeting Title: ${meetingTitle}\n\nTranscript:\n${transcriptText}`;

    // Target endpoint
    const endpoint = this.gatewayUrl.endsWith('/chat/completions')
      ? this.gatewayUrl
      : `${this.gatewayUrl}/chat/completions`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || err.message || `AI Gateway request failed with status ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response received from AI Gateway.');
    }

    return this._parseJsonResponse(content);
  }

  _parseJsonResponse(text) {
    let clean = text.trim();
    // Strip markdown code fences if present
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '').trim();
    }
    try {
      return JSON.parse(clean);
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', clean);
      // Fallback fallback structured object
      return {
        title: 'Meeting Notes',
        summary: clean,
        key_points: ['Summary parsed in raw format.'],
        decisions: [],
        action_items: []
      };
    }
  }
}

if (typeof window !== 'undefined') {
  window.AIGatewayClient = AIGatewayClient;
}
