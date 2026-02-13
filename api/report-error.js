/**
 * /api/report-error - Serverless function for automatic error reporting
 *
 * Receives error data from error-logger.js, creates GitHub issues
 * with labels "bug" and "auto-detected", and optionally notifies Slack.
 *
 * Environment variables:
 *   GITHUB_TOKEN       - GitHub personal access token
 *   GITHUB_OWNER       - Repository owner
 *   GITHUB_REPO        - Repository name
 *   SLACK_WEBHOOK_URL  - (Optional) Slack webhook for notifications
 */

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { errors, environment, errorCount } = req.body;

    if (!errors || !Array.isArray(errors) || errors.length === 0) {
      return res.status(400).json({ error: 'No errors provided' });
    }

    const githubToken = process.env.GITHUB_TOKEN;
    const githubOwner = process.env.GITHUB_OWNER;
    const githubRepo = process.env.GITHUB_REPO;

    if (!githubToken || !githubOwner || !githubRepo) {
      console.error('Missing GitHub configuration environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const results = [];

    // Group errors by type and message to avoid duplicate issues
    const grouped = groupErrors(errors);

    for (const group of grouped) {
      const issue = await createGitHubIssue(
        githubToken,
        githubOwner,
        githubRepo,
        group,
        environment
      );
      results.push(issue);

      // Notify Slack if configured
      if (process.env.SLACK_WEBHOOK_URL) {
        await notifySlack(process.env.SLACK_WEBHOOK_URL, group, issue);
      }
    }

    return res.status(200).json({
      success: true,
      issuesCreated: results.length,
      issues: results.map((r) => ({ id: r.number, url: r.html_url })),
    });
  } catch (error) {
    console.error('Error processing report:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function groupErrors(errors) {
  const groups = {};
  for (const err of errors) {
    const key = `${err.type}:${err.message}`;
    if (!groups[key]) {
      groups[key] = { ...err, count: 1 };
    } else {
      groups[key].count++;
    }
  }
  return Object.values(groups);
}

async function createGitHubIssue(token, owner, repo, errorGroup, environment) {
  const severityEmoji = {
    error: '🔴',
    warning: '🟡',
    info: '🔵',
  };

  const emoji = severityEmoji[errorGroup.severity] || '🔴';
  const title = `${emoji} [Auto-Detected] ${errorGroup.type}: ${truncate(errorGroup.message, 80)}`;

  const body = [
    '## Auto-Detected Error Report',
    '',
    `**Type:** \`${errorGroup.type}\``,
    `**Severity:** ${errorGroup.severity}`,
    `**Occurrences:** ${errorGroup.count}`,
    `**First Seen:** ${errorGroup.timestamp}`,
    '',
    '### Error Details',
    '',
    '```',
    errorGroup.message,
    '```',
    '',
    errorGroup.source ? `**Source:** \`${errorGroup.source}\`` : '',
    errorGroup.line ? `**Line:** ${errorGroup.line}` : '',
    errorGroup.column ? `**Column:** ${errorGroup.column}` : '',
    '',
    errorGroup.stack
      ? ['### Stack Trace', '', '```', errorGroup.stack, '```'].join('\n')
      : '',
    '',
    '### Environment',
    '',
    `- **URL:** ${environment.url}`,
    `- **User Agent:** ${environment.userAgent}`,
    `- **Screen:** ${environment.screenSize}`,
    `- **Viewport:** ${environment.viewportSize}`,
    `- **Session:** \`${environment.sessionId}\``,
    `- **Timestamp:** ${environment.timestamp}`,
    '',
    '---',
    '*This issue was automatically created by the error detection system.*',
    '*Label this issue with `ai-analyze` to trigger automatic AI analysis and fix proposal.*',
  ]
    .filter(Boolean)
    .join('\n');

  const labels = ['bug', 'auto-detected'];
  if (errorGroup.severity === 'error' || errorGroup.severity === 'critical') {
    labels.push('priority:high');
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues`,
    {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, body, labels }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API error: ${response.status} ${text}`);
  }

  return response.json();
}

async function notifySlack(webhookUrl, errorGroup, issue) {
  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🚨 Auto-Detected Bug: ${truncate(errorGroup.message, 60)}`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Type:*\n\`${errorGroup.type}\`` },
          { type: 'mrkdwn', text: `*Severity:*\n${errorGroup.severity}` },
          { type: 'mrkdwn', text: `*Occurrences:*\n${errorGroup.count}` },
          { type: 'mrkdwn', text: `*Issue:*\n<${issue.html_url}|#${issue.number}>` },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Issue' },
            url: issue.html_url,
            style: 'primary',
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Trigger AI Analysis' },
            action_id: 'trigger_ai_analysis',
            value: String(issue.number),
          },
        ],
      },
    ],
  };

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}
