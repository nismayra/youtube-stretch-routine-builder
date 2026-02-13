/**
 * /api/submit-feedback - Serverless function for user feedback
 *
 * Handles bug reports and feature requests from the feedback widget.
 * Creates GitHub issues with proper labels and notifies Slack.
 *
 * Environment variables:
 *   GITHUB_TOKEN       - GitHub personal access token
 *   GITHUB_OWNER       - Repository owner
 *   GITHUB_REPO        - Repository name
 *   SLACK_WEBHOOK_URL  - (Optional) Slack webhook for notifications
 */

export default async function handler(req, res) {
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
    const feedback = req.body;

    if (!feedback || !feedback.title || !feedback.type) {
      return res.status(400).json({ error: 'Missing required fields: title, type' });
    }

    const githubToken = process.env.GITHUB_TOKEN;
    const githubOwner = process.env.GITHUB_OWNER;
    const githubRepo = process.env.GITHUB_REPO;

    if (!githubToken || !githubOwner || !githubRepo) {
      console.error('Missing GitHub configuration');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    let issue;
    if (feedback.type === 'bug') {
      issue = await createBugIssue(githubToken, githubOwner, githubRepo, feedback);
    } else {
      issue = await createFeatureIssue(githubToken, githubOwner, githubRepo, feedback);
    }

    // Notify Slack
    if (process.env.SLACK_WEBHOOK_URL) {
      await notifySlack(process.env.SLACK_WEBHOOK_URL, feedback, issue);
    }

    return res.status(200).json({
      success: true,
      issueUrl: issue.html_url,
      issueNumber: issue.number,
    });
  } catch (error) {
    console.error('Error processing feedback:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function createBugIssue(token, owner, repo, feedback) {
  const severityMap = {
    low: '🟢 Low',
    medium: '🟡 Medium',
    high: '🟠 High',
    critical: '🔴 Critical',
  };

  const title = `🐛 [User Report] ${feedback.title}`;
  const body = [
    '## User-Reported Bug',
    '',
    `**Severity:** ${severityMap[feedback.severity] || feedback.severity}`,
    `**Reported at:** ${feedback.timestamp}`,
    feedback.email ? `**Contact:** ${feedback.email}` : '',
    '',
    '### Description',
    '',
    feedback.title,
    '',
    feedback.steps
      ? ['### Steps to Reproduce', '', feedback.steps].join('\n')
      : '',
    '',
    '### Context',
    '',
    `- **Page:** ${feedback.url}`,
    `- **Browser:** ${feedback.userAgent}`,
    feedback.sessionId ? `- **Session:** \`${feedback.sessionId}\`` : '',
    '',
    feedback.screenshot
      ? [
          '### Screenshot',
          '',
          '> A screenshot was attached to this report.',
          `> Data URI length: ${feedback.screenshot.length} characters`,
        ].join('\n')
      : '',
    '',
    '---',
    '*This issue was created from user feedback via the in-app widget.*',
  ]
    .filter(Boolean)
    .join('\n');

  const labels = ['bug', 'user-reported'];
  if (feedback.severity === 'high' || feedback.severity === 'critical') {
    labels.push('priority:high');
  }

  return createGitHubIssue(token, owner, repo, title, body, labels);
}

async function createFeatureIssue(token, owner, repo, feedback) {
  const priorityMap = {
    'nice-to-have': '💭 Nice to have',
    important: '⭐ Important',
    critical: '🔥 Critical for workflow',
  };

  const title = `✨ [Feature Request] ${feedback.title}`;
  const body = [
    '## Feature Request',
    '',
    `**Priority:** ${priorityMap[feedback.priority] || feedback.priority}`,
    `**Requested at:** ${feedback.timestamp}`,
    feedback.email ? `**Contact:** ${feedback.email}` : '',
    '',
    '### Feature Description',
    '',
    feedback.title,
    '',
    feedback.useCase
      ? ['### Use Case', '', feedback.useCase].join('\n')
      : '',
    '',
    '### Context',
    '',
    `- **Page:** ${feedback.url}`,
    '',
    '---',
    '*This feature request was submitted via the in-app feedback widget.*',
    '',
    '**Voting:** React with 👍 to upvote this feature request.',
  ]
    .filter(Boolean)
    .join('\n');

  const labels = ['enhancement', 'user-requested'];

  return createGitHubIssue(token, owner, repo, title, body, labels);
}

async function createGitHubIssue(token, owner, repo, title, body, labels) {
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

async function notifySlack(webhookUrl, feedback, issue) {
  const isBug = feedback.type === 'bug';
  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: isBug
            ? `🐛 New Bug Report: ${truncate(feedback.title, 60)}`
            : `✨ Feature Request: ${truncate(feedback.title, 60)}`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Type:*\n${isBug ? 'Bug Report' : 'Feature Request'}`,
          },
          {
            type: 'mrkdwn',
            text: `*${isBug ? 'Severity' : 'Priority'}:*\n${isBug ? feedback.severity : feedback.priority}`,
          },
          {
            type: 'mrkdwn',
            text: `*Issue:*\n<${issue.html_url}|#${issue.number}>`,
          },
          {
            type: 'mrkdwn',
            text: feedback.email
              ? `*Contact:*\n${feedback.email}`
              : '*Contact:*\nNot provided',
          },
        ],
      },
      isBug && feedback.steps
        ? {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Steps to Reproduce:*\n${truncate(feedback.steps, 200)}`,
            },
          }
        : null,
      !isBug && feedback.useCase
        ? {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Use Case:*\n${truncate(feedback.useCase, 200)}`,
            },
          }
        : null,
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Issue' },
            url: issue.html_url,
            style: 'primary',
          },
        ],
      },
    ].filter(Boolean),
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
