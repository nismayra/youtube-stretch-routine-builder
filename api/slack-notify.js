/**
 * /api/slack-notify - Send notifications to Slack channels
 *
 * Sends rich formatted messages to Slack for:
 * - Bug alerts
 * - Feature requests
 * - Deployment updates
 * - Daily digests
 * - Incident management
 *
 * Environment variables:
 *   SLACK_WEBHOOK_URL        - Default webhook URL
 *   SLACK_BUGS_WEBHOOK       - (Optional) #bugs channel webhook
 *   SLACK_FEATURES_WEBHOOK   - (Optional) #features channel webhook
 *   SLACK_DEPLOYMENTS_WEBHOOK - (Optional) #deployments channel webhook
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { type, data } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'Missing notification type' });
    }

    const webhookUrl = getWebhookUrl(type);
    if (!webhookUrl) {
      return res.status(500).json({ error: 'Slack webhook not configured' });
    }

    const message = buildMessage(type, data);
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status}`);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Slack notification error:', error);
    return res.status(500).json({ error: 'Failed to send notification' });
  }
}

function getWebhookUrl(type) {
  const webhooks = {
    bug: process.env.SLACK_BUGS_WEBHOOK || process.env.SLACK_WEBHOOK_URL,
    feature: process.env.SLACK_FEATURES_WEBHOOK || process.env.SLACK_WEBHOOK_URL,
    deployment: process.env.SLACK_DEPLOYMENTS_WEBHOOK || process.env.SLACK_WEBHOOK_URL,
    digest: process.env.SLACK_WEBHOOK_URL,
    incident: process.env.SLACK_WEBHOOK_URL,
    pr: process.env.SLACK_WEBHOOK_URL,
  };
  return webhooks[type] || process.env.SLACK_WEBHOOK_URL;
}

function buildMessage(type, data) {
  const builders = {
    bug: buildBugMessage,
    feature: buildFeatureMessage,
    deployment: buildDeploymentMessage,
    digest: buildDigestMessage,
    incident: buildIncidentMessage,
    pr: buildPRMessage,
  };

  const builder = builders[type];
  if (!builder) {
    return { text: `[${type}] ${JSON.stringify(data)}` };
  }
  return builder(data);
}

function buildBugMessage(data) {
  return {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `🐛 Bug: ${truncate(data.title, 60)}` },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Severity:*\n${data.severity || 'unknown'}` },
          { type: 'mrkdwn', text: `*Source:*\n${data.source || 'user report'}` },
          { type: 'mrkdwn', text: `*Status:*\n${data.status || 'new'}` },
          data.issueUrl
            ? { type: 'mrkdwn', text: `*Issue:*\n<${data.issueUrl}|#${data.issueNumber}>` }
            : { type: 'mrkdwn', text: '*Issue:*\nPending' },
        ],
      },
      data.description
        ? { type: 'section', text: { type: 'mrkdwn', text: truncate(data.description, 300) } }
        : null,
      {
        type: 'actions',
        elements: [
          data.issueUrl
            ? { type: 'button', text: { type: 'plain_text', text: 'View Issue' }, url: data.issueUrl, style: 'primary' }
            : null,
          {
            type: 'button',
            text: { type: 'plain_text', text: 'AI Analyze' },
            action_id: 'trigger_ai_analysis',
            value: JSON.stringify({ issueNumber: data.issueNumber }),
          },
        ].filter(Boolean),
      },
    ].filter(Boolean),
  };
}

function buildFeatureMessage(data) {
  return {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `✨ Feature: ${truncate(data.title, 60)}` },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Priority:*\n${data.priority || 'normal'}` },
          { type: 'mrkdwn', text: `*Votes:*\n${data.votes || 0}` },
          data.issueUrl
            ? { type: 'mrkdwn', text: `*Issue:*\n<${data.issueUrl}|#${data.issueNumber}>` }
            : { type: 'mrkdwn', text: '*Issue:*\nPending' },
        ],
      },
      data.useCase
        ? { type: 'section', text: { type: 'mrkdwn', text: `*Use Case:*\n${truncate(data.useCase, 300)}` } }
        : null,
      {
        type: 'actions',
        elements: [
          data.issueUrl
            ? { type: 'button', text: { type: 'plain_text', text: 'View Issue' }, url: data.issueUrl, style: 'primary' }
            : null,
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Add to Roadmap' },
            action_id: 'add_to_roadmap',
            value: JSON.stringify({ issueNumber: data.issueNumber }),
          },
        ].filter(Boolean),
      },
    ].filter(Boolean),
  };
}

function buildDeploymentMessage(data) {
  const statusEmoji = {
    success: '✅',
    failed: '❌',
    pending: '⏳',
    rollback: '⏪',
  };
  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${statusEmoji[data.status] || '📦'} Deployment: ${data.status}`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Environment:*\n${data.environment || 'production'}` },
          { type: 'mrkdwn', text: `*Branch:*\n\`${data.branch || 'main'}\`` },
          { type: 'mrkdwn', text: `*Commit:*\n\`${truncate(data.commit, 8)}\`` },
          { type: 'mrkdwn', text: `*Author:*\n${data.author || 'unknown'}` },
        ],
      },
      data.changes
        ? { type: 'section', text: { type: 'mrkdwn', text: `*Changes:*\n${truncate(data.changes, 300)}` } }
        : null,
      data.url
        ? {
            type: 'actions',
            elements: [
              { type: 'button', text: { type: 'plain_text', text: 'View Deployment' }, url: data.url, style: 'primary' },
            ],
          }
        : null,
    ].filter(Boolean),
  };
}

function buildDigestMessage(data) {
  return {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `📊 Daily Digest - ${new Date().toLocaleDateString()}` },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*New Bugs:*\n${data.newBugs || 0}` },
          { type: 'mrkdwn', text: `*Bugs Fixed:*\n${data.bugsFixed || 0}` },
          { type: 'mrkdwn', text: `*Feature Requests:*\n${data.featureRequests || 0}` },
          { type: 'mrkdwn', text: `*Deployments:*\n${data.deployments || 0}` },
        ],
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Open Issues:*\n${data.openIssues || 0}` },
          { type: 'mrkdwn', text: `*PRs Merged:*\n${data.prsMerged || 0}` },
          { type: 'mrkdwn', text: `*Avg Fix Time:*\n${data.avgFixTime || 'N/A'}` },
          { type: 'mrkdwn', text: `*User Satisfaction:*\n${data.satisfaction || 'N/A'}` },
        ],
      },
      data.topIssues
        ? {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Top Issues:*\n${data.topIssues.map((i, idx) => `${idx + 1}. <${i.url}|${i.title}>`).join('\n')}`,
            },
          }
        : null,
    ].filter(Boolean),
  };
}

function buildIncidentMessage(data) {
  return {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `🚨 INCIDENT: ${truncate(data.title, 50)}` },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Severity:* ${data.severity || 'HIGH'}\n*Impact:* ${data.impact || 'Unknown'}\n*Started:* ${data.startedAt || new Date().toISOString()}`,
        },
      },
      data.description
        ? { type: 'section', text: { type: 'mrkdwn', text: data.description } }
        : null,
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Acknowledge' },
            action_id: 'acknowledge_incident',
            value: JSON.stringify({ incidentId: data.id }),
            style: 'danger',
          },
          data.issueUrl
            ? { type: 'button', text: { type: 'plain_text', text: 'View Issue' }, url: data.issueUrl }
            : null,
        ].filter(Boolean),
      },
    ].filter(Boolean),
  };
}

function buildPRMessage(data) {
  return {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `🔀 PR: ${truncate(data.title, 60)}` },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Author:*\n${data.author || 'AI'}` },
          { type: 'mrkdwn', text: `*Status:*\n${data.status || 'open'}` },
          { type: 'mrkdwn', text: `*Files Changed:*\n${data.filesChanged || 'N/A'}` },
          data.issueNumber
            ? { type: 'mrkdwn', text: `*Fixes:*\n#${data.issueNumber}` }
            : null,
        ].filter(Boolean),
      },
      data.description
        ? { type: 'section', text: { type: 'mrkdwn', text: truncate(data.description, 300) } }
        : null,
      {
        type: 'actions',
        elements: [
          { type: 'button', text: { type: 'plain_text', text: 'Review PR' }, url: data.prUrl, style: 'primary' },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Approve & Merge' },
            action_id: 'approve_merge_pr',
            value: JSON.stringify({ prNumber: data.prNumber }),
            style: 'primary',
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Reject' },
            action_id: 'reject_pr',
            value: JSON.stringify({ prNumber: data.prNumber }),
            style: 'danger',
          },
        ],
      },
    ],
  };
}

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}
