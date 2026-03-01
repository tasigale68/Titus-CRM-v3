require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Airtable — DEPRECATED, migrated to Supabase
  // Guards still check env.airtable.apiKey; set truthy when Supabase is configured
  // so existing route guards pass without modification
  airtable: {
    apiKey: process.env.AIRTABLE_API_KEY || (process.env.SUPABASE_SERVICE_KEY ? '__supabase__' : ''),
    baseId: process.env.AIRTABLE_BASE_ID || (process.env.SUPABASE_URL ? '__supabase__' : '') || 'appg3Cz7mEsGA6IOI',
  },

  // Twilio (calls, SMS, WebRTC)
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
    apiKey: process.env.TWILIO_API_KEY,
    apiSecret: process.env.TWILIO_API_SECRET,
    twimlAppSid: process.env.TWILIO_TWIML_APP_SID,
  },

  // ElevenLabs (AI voice agent)
  elevenLabs: {
    apiKey: process.env.ELEVENLABS_API_KEY,
    agentId: process.env.ELEVENLABS_AGENT_ID,
  },

  // Anthropic Claude API
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },

  // Microsoft Graph (email)
  microsoft: {
    tenantId: process.env.MS_TENANT_ID,
    clientId: process.env.MS_CLIENT_ID,
    clientSecret: process.env.MS_CLIENT_SECRET,
    emailAddress: process.env.MS_EMAIL_ADDRESS,
  },

  // Supabase (database migration target)
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
  },

  // Database toggle: 'supabase' (default) — Airtable sync disabled 2026-03-01
  database: process.env.DATABASE || 'supabase',

  // Railway deployment
  railway: {
    volumeMountPath: process.env.RAILWAY_VOLUME_MOUNT_PATH,
  },
};
