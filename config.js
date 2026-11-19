/**
 * Renim AI - Global Environment & Configuration Loader
 * 
 * Paste your credentials here or in .env. 
 * The extension automatically picks these up on launch.
 */

const ENV_CONFIG = {
  // Renim AI workspace (same backend as the web app), e.g. "https://app.renimai.com"
  RENIM_API_URL: "",

  // AI Gateway Configuration
  AI_GATEWAY_URL: "https://api.openai.com/v1",
  AI_GATEWAY_API_KEY: "your-ai-gateway-api-key",
  AI_GATEWAY_MODEL: "gpt-4o-mini"
};

if (typeof window !== 'undefined') {
  window.ENV_CONFIG = ENV_CONFIG;
}

if (typeof globalThis !== 'undefined') {
  globalThis.ENV_CONFIG = ENV_CONFIG;
}
