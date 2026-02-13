/**
 * /api/slack-commands - Handle Slack slash commands
 *
 * Supports:
 *   /bug <description>     - Report a bug from Slack
 *   /feature <description> - Request a feature from Slack
 *   /ask-claude <question> - Ask AI a question
 *   /bug-status [number]   - Check bug status
 *   /deploy [branch]       - Deploy to production
 *   /approve-pr <number>   - Approve and merge a PR
 *
 * Environment variables:
 *   SLACK_SIGNING_SECRET   - Slack app signing secret for verification
 *   GITHUB_TOKEN           - GitHub personal access token
 *   GITHUB_OWNER           - Repository owner
 *   GITHUB_REPO            - Repository name
 *   ANTHROPIC_API_KEY      - Claude API key (for /ask-claude)
 */

import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify Slack request signature
  if (process.env.SLACK_SIGNING_SECRET && !verifySlackSignature(req)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { command, text, user_name, response_url, trigger_id } = req.body;

  // Acknowledge immediately (Slack requires response within 3 seconds)
  res.status(200).json({
    response_type: 'ephemeral',
    text: `Processing your \`${command}\` command...`,
  });

  // Process command asynchronously
  try {
    let result;
    switch (command) {
      case '/bug':
        result = await handleBugCommand(text, user_name);
        break;
      case '/feature':
        result = await handleFeatureCommand(text, user_name);
        break;
      case '/ask-claude':
        result = await handleAskClaudeCommand(text, user_name);
        break;
      case '/bug-status':
        result = await handleBugStatusCommand(text);
        break;
      case '/deploy':
        result = await handleDeployCommand(text, user_name);
        break;
      case '/approve-pr':
        result = await handleApprovePRCommand(text, user_name);
        break;
      default:
        result = {
          response_type: 'ephemeral',
          text: `Unknown command: \`${command}\`. Available commands: /bug, /feature, /ask-claude, /bug-status, /deploy, /approve-pr`,
        };
    }

    // Send delayed response
    if (response_url) {
      await fetch(response_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      });
    }
  } catch (error) {
    console.error('Command processing error:', error);
    if (response_url) {
      await fetch(response_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response_type: 'ephemeral',
          text: `Error processing command: ${error.message}`,
        }),
      });
    }
  }
}

async function handleBugCommand(text, userName) {
  if (!text) {
    return {
      response_type: 'ephemeral',
      text: 'Usage: `/bug <description of the bug>`',
    };
  }

  const issue = await createGitHubIssue(
    `🐛 [Slack] ${text}`,
    [
      '## Bug Report (from Slack)',
      '',
      `**Reported by:** @${userName}`,
      `**Description:** ${text}`,
      `**Reported at:** ${new Date().toISOString()}`,
      '',
      '---',
      '*Reported via Slack /bug command*',
    ].join('\n'),
    ['bug', 'slack-reported']
  );

  return {
    response_type: 'in_channel',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🐛 *Bug reported by @${userName}*\n>${text}\n\nGitHub Issue: <${issue.html_url}|#${issue.number}>`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Issue' },
            url: issue.html_url,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'AI Analyze' },
            action_id: 'trigger_ai_analysis',
            value: String(issue.number),
          },
        ],
      },
    ],
  };
}

async function handleFeatureCommand(text, userName) {
  if (!text) {
    return {
      response_type: 'ephemeral',
      text: 'Usage: `/feature <description of the feature>`',
    };
  }

  const issue = await createGitHubIssue(
    `✨ [Slack] ${text}`,
    [
      '## Feature Request (from Slack)',
      '',
      `**Requested by:** @${userName}`,
      `**Description:** ${text}`,
      `**Requested at:** ${new Date().toISOString()}`,
      '',
      '👍 React to upvote this feature!',
      '',
      '---',
      '*Requested via Slack /feature command*',
    ].join('\n'),
    ['enhancement', 'slack-requested']
  );

  return {
    response_type: 'in_channel',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `✨ *Feature requested by @${userName}*\n>${text}\n\nGitHub Issue: <${issue.html_url}|#${issue.number}>\nReact with 👍 to upvote!`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Issue' },
            url: issue.html_url,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Add to Roadmap' },
            action_id: 'add_to_roadmap',
            value: String(issue.number),
          },
        ],
      },
    ],
  };
}

async function handleAskClaudeCommand(text, userName) {
  if (!text) {
    return {
      response_type: 'ephemeral',
      text: 'Usage: `/ask-claude <your question>`',
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      response_type: 'ephemeral',
      text: 'Claude AI is not configured. Set the ANTHROPIC_API_KEY environment variable.',
    };
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a helpful assistant for a software development team working on a YouTube Stretch Routine Builder app. Answer the following question concisely:\n\n${text}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const answer = data.content[0].text;

  return {
    response_type: 'in_channel',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*@${userName} asked:*\n>${text}`,
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🤖 *Claude:*\n${answer}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '_Reply in thread to continue the conversation_',
          },
        ],
      },
    ],
  };
}

async function handleBugStatusCommand(text) {
  const issueNumber = text ? text.trim() : null;
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env;

  if (issueNumber) {
    // Get specific issue
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${issueNumber}`,
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      return { response_type: 'ephemeral', text: `Issue #${issueNumber} not found.` };
    }

    const issue = await response.json();
    return {
      response_type: 'ephemeral',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*#${issue.number}: ${issue.title}*\n*State:* ${issue.state}\n*Labels:* ${issue.labels.map((l) => l.name).join(', ') || 'none'}\n*Assignee:* ${issue.assignee ? issue.assignee.login : 'unassigned'}\n<${issue.html_url}|View on GitHub>`,
          },
        },
      ],
    };
  }

  // List recent bugs
  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues?labels=bug&state=open&per_page=5&sort=created&direction=desc`,
    {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  const issues = await response.json();

  if (!issues.length) {
    return { response_type: 'ephemeral', text: '🎉 No open bugs! Great job!' };
  }

  const issueList = issues
    .map((i) => `• <${i.html_url}|#${i.number}> ${i.title} (${i.labels.map((l) => l.name).join(', ')})`)
    .join('\n');

  return {
    response_type: 'ephemeral',
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '🐛 Open Bugs' },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: issueList },
      },
    ],
  };
}

async function handleDeployCommand(text, userName) {
  const branch = text ? text.trim() : 'main';

  return {
    response_type: 'in_channel',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🚀 *Deployment requested by @${userName}*\n*Branch:* \`${branch}\`\n*Environment:* production`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Confirm Deploy' },
            action_id: 'confirm_deploy',
            value: JSON.stringify({ branch, requestedBy: userName }),
            style: 'primary',
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Cancel' },
            action_id: 'cancel_deploy',
            style: 'danger',
          },
        ],
      },
    ],
  };
}

async function handleApprovePRCommand(text, userName) {
  if (!text) {
    return { response_type: 'ephemeral', text: 'Usage: `/approve-pr <PR number>`' };
  }

  const prNumber = text.trim();
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env;

  // Get PR details
  const prResponse = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${prNumber}`,
    {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  if (!prResponse.ok) {
    return { response_type: 'ephemeral', text: `PR #${prNumber} not found.` };
  }

  const pr = await prResponse.json();

  return {
    response_type: 'in_channel',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🔀 *PR #${pr.number}: ${pr.title}*\n*Author:* ${pr.user.login}\n*Branch:* \`${pr.head.ref}\` → \`${pr.base.ref}\`\n*Files Changed:* ${pr.changed_files}`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Approve & Merge' },
            action_id: 'approve_merge_pr',
            value: JSON.stringify({ prNumber: pr.number, approver: userName }),
            style: 'primary',
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View PR' },
            url: pr.html_url,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Reject' },
            action_id: 'reject_pr',
            value: JSON.stringify({ prNumber: pr.number }),
            style: 'danger',
          },
        ],
      },
    ],
  };
}

async function createGitHubIssue(title, body, labels) {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env;
  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`,
    {
      method: 'POST',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, body, labels }),
    }
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }
  return response.json();
}

function verifySlackSignature(req) {
  const timestamp = req.headers['x-slack-request-timestamp'];
  const signature = req.headers['x-slack-signature'];
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  if (!timestamp || !signature || !signingSecret) return false;

  // Prevent replay attacks (5 minute window)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) return false;

  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature = 'v0=' + crypto.createHmac('sha256', signingSecret).update(sigBasestring).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(signature));
}
