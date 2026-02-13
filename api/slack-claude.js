/**
 * /api/slack-claude - Chat with Claude AI directly in Slack
 *
 * Provides an AI assistant in Slack that can:
 * - Answer development questions
 * - Analyze codebase issues
 * - Suggest architectural improvements
 * - Help with debugging
 * - Create PRs for suggested changes
 *
 * Environment variables:
 *   SLACK_SIGNING_SECRET   - Slack app signing secret
 *   SLACK_BOT_TOKEN        - Slack bot OAuth token (for posting messages)
 *   ANTHROPIC_API_KEY      - Claude API key
 *   GITHUB_TOKEN           - GitHub personal access token
 *   GITHUB_OWNER           - Repository owner
 *   GITHUB_REPO            - Repository name
 */

import crypto from 'crypto';

// Conversation history (in production, use a database)
const conversations = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Handle Slack URL verification challenge
  if (req.body.type === 'url_verification') {
    return res.status(200).json({ challenge: req.body.challenge });
  }

  // Verify signature
  if (process.env.SLACK_SIGNING_SECRET && !verifySlackSignature(req)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Acknowledge immediately
  res.status(200).end();

  try {
    const event = req.body.event;
    if (!event) return;

    // Only respond to messages mentioning the bot or in DMs
    if (event.type !== 'app_mention' && event.channel_type !== 'im') return;
    if (event.bot_id) return; // Ignore bot messages

    const text = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();
    const threadTs = event.thread_ts || event.ts;
    const channel = event.channel;

    // Get conversation context
    const contextKey = `${channel}:${threadTs}`;
    const history = conversations.get(contextKey) || [];

    // Add user message to history
    history.push({ role: 'user', content: text });

    // Keep last 10 messages for context
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }

    // Call Claude API
    const response = await callClaude(history);

    // Save to history
    history.push({ role: 'assistant', content: response });
    conversations.set(contextKey, history);

    // Clean up old conversations (older than 1 hour)
    cleanupConversations();

    // Post response to Slack
    await postToSlack(channel, response, threadTs);

  } catch (error) {
    console.error('Claude chat error:', error);
  }
}

async function callClaude(messages) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return 'Claude AI is not configured. Please set the ANTHROPIC_API_KEY environment variable.';
  }

  const systemPrompt = [
    'You are an AI assistant embedded in a Slack workspace for a software development team.',
    'The team works on a YouTube Stretch Routine Builder app - a vanilla JavaScript web application',
    'that helps users create exercise routines from YouTube videos.',
    '',
    'Key facts about the project:',
    '- Single HTML file (~4,270 lines) with inline CSS and JavaScript',
    '- No framework dependencies (vanilla JS)',
    '- Uses YouTube IFrame API, Google Gemini API, Firebase (optional)',
    '- Deployed via GitHub Pages with CI/CD secret injection',
    '- Features: exercise grid, sequential player, AI parser, playlist management',
    '',
    'You can help with:',
    '- Debugging issues and suggesting fixes',
    '- Architectural decisions and best practices',
    '- Code review and optimization suggestions',
    '- Feature planning and implementation advice',
    '- Explaining code behavior',
    '',
    'Keep responses concise and formatted for Slack (use *bold*, `code`, and bullet points).',
    'When suggesting code changes, use code blocks with the appropriate language.',
  ].join('\n');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1500,
      system: systemPrompt,
      messages: messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Claude API error:', errorText);
    return 'Sorry, I encountered an error processing your request. Please try again.';
  }

  const data = await response.json();
  return data.content[0].text;
}

async function postToSlack(channel, text, threadTs) {
  const botToken = process.env.SLACK_BOT_TOKEN;
  if (!botToken) {
    console.error('SLACK_BOT_TOKEN not configured');
    return;
  }

  // Split long messages (Slack limit is ~4000 chars)
  const maxLen = 3900;
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    // Try to split at a newline
    let splitIdx = remaining.lastIndexOf('\n', maxLen);
    if (splitIdx < maxLen / 2) splitIdx = maxLen;
    chunks.push(remaining.substring(0, splitIdx));
    remaining = remaining.substring(splitIdx);
  }

  for (const chunk of chunks) {
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channel,
        text: chunk,
        thread_ts: threadTs,
        unfurl_links: false,
      }),
    });
  }
}

function cleanupConversations() {
  const oneHourAgo = Date.now() - 3600000;
  for (const [key, messages] of conversations) {
    if (messages.length === 0) {
      conversations.delete(key);
      continue;
    }
    // Simple cleanup - remove old conversations
    if (conversations.size > 100) {
      conversations.delete(key);
    }
  }
}

function verifySlackSignature(req) {
  const timestamp = req.headers['x-slack-request-timestamp'];
  const signature = req.headers['x-slack-signature'];
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  if (!timestamp || !signature || !signingSecret) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) return false;

  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature = 'v0=' + crypto.createHmac('sha256', signingSecret).update(sigBasestring).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(signature));
}
