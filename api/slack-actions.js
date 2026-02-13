/**
 * /api/slack-actions - Handle Slack interactive button actions
 *
 * Handles interactive actions from Slack messages:
 *   - trigger_ai_analysis   - Trigger AI analysis on an issue
 *   - approve_merge_pr      - Approve and merge a PR
 *   - reject_pr             - Close a PR
 *   - confirm_deploy        - Confirm a deployment
 *   - cancel_deploy         - Cancel a deployment
 *   - acknowledge_incident  - Acknowledge an incident
 *   - add_to_roadmap        - Add feature to roadmap label
 *
 * Environment variables:
 *   SLACK_SIGNING_SECRET   - Slack app signing secret
 *   GITHUB_TOKEN           - GitHub personal access token
 *   GITHUB_OWNER           - Repository owner
 *   GITHUB_REPO            - Repository name
 */

import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Slack sends interactive payloads as URL-encoded with a 'payload' field
  let payload;
  try {
    payload = typeof req.body === 'string'
      ? JSON.parse(req.body)
      : req.body.payload
        ? JSON.parse(req.body.payload)
        : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  // Verify signature
  if (process.env.SLACK_SIGNING_SECRET && !verifySlackSignature(req)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Acknowledge immediately
  res.status(200).end();

  const responseUrl = payload.response_url;
  const action = payload.actions && payload.actions[0];

  if (!action) return;

  try {
    let result;

    switch (action.action_id) {
      case 'trigger_ai_analysis':
        result = await handleTriggerAIAnalysis(action.value);
        break;
      case 'approve_merge_pr':
        result = await handleApproveMergePR(action.value, payload.user);
        break;
      case 'reject_pr':
        result = await handleRejectPR(action.value, payload.user);
        break;
      case 'confirm_deploy':
        result = await handleConfirmDeploy(action.value, payload.user);
        break;
      case 'cancel_deploy':
        result = { replace_original: true, text: '❌ Deployment cancelled.' };
        break;
      case 'acknowledge_incident':
        result = await handleAcknowledgeIncident(action.value, payload.user);
        break;
      case 'add_to_roadmap':
        result = await handleAddToRoadmap(action.value);
        break;
      default:
        result = { text: `Unknown action: ${action.action_id}` };
    }

    if (responseUrl && result) {
      await fetch(responseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      });
    }
  } catch (error) {
    console.error('Action processing error:', error);
    if (responseUrl) {
      await fetch(responseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `Error: ${error.message}` }),
      });
    }
  }
}

async function handleTriggerAIAnalysis(value) {
  const issueNumber = typeof value === 'string' && value.startsWith('{')
    ? JSON.parse(value).issueNumber
    : value;

  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env;

  // Add ai-analyze label to the issue to trigger the GitHub Action
  await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${issueNumber}/labels`,
    {
      method: 'POST',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ labels: ['ai-analyze'] }),
    }
  );

  return {
    response_type: 'in_channel',
    text: `🤖 AI analysis triggered for issue #${issueNumber}. Claude will analyze the bug and propose a fix.`,
  };
}

async function handleApproveMergePR(value, user) {
  const data = JSON.parse(value);
  const prNumber = data.prNumber;
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env;

  // Create approval review
  await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${prNumber}/reviews`,
    {
      method: 'POST',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        body: `Approved via Slack by ${user.name || user.username}`,
        event: 'APPROVE',
      }),
    }
  );

  // Merge the PR
  const mergeResponse = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${prNumber}/merge`,
    {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        commit_title: `Merge PR #${prNumber} (approved via Slack by ${user.name || user.username})`,
        merge_method: 'squash',
      }),
    }
  );

  if (!mergeResponse.ok) {
    const error = await mergeResponse.text();
    return {
      response_type: 'in_channel',
      text: `❌ Failed to merge PR #${prNumber}: ${error}`,
    };
  }

  return {
    response_type: 'in_channel',
    text: `✅ PR #${prNumber} approved and merged by ${user.name || user.username}!`,
  };
}

async function handleRejectPR(value, user) {
  const data = JSON.parse(value);
  const prNumber = data.prNumber;
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env;

  // Close the PR
  await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${prNumber}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ state: 'closed' }),
    }
  );

  return {
    response_type: 'in_channel',
    text: `❌ PR #${prNumber} rejected by ${user.name || user.username}.`,
  };
}

async function handleConfirmDeploy(value, user) {
  const data = JSON.parse(value);
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env;

  // Trigger deployment workflow
  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/deploy.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: data.branch || 'main',
        inputs: {
          deployer: user.name || user.username,
        },
      }),
    }
  );

  if (!response.ok) {
    return {
      replace_original: true,
      text: `❌ Deployment failed to start. Check GitHub Actions permissions.`,
    };
  }

  return {
    replace_original: true,
    text: `🚀 Deployment started!\n*Branch:* \`${data.branch || 'main'}\`\n*Started by:* ${user.name || user.username}\n*Status:* Check GitHub Actions for progress.`,
  };
}

async function handleAcknowledgeIncident(value, user) {
  const data = JSON.parse(value);

  return {
    replace_original: false,
    response_type: 'in_channel',
    text: `🔔 Incident acknowledged by ${user.name || user.username} at ${new Date().toISOString()}`,
  };
}

async function handleAddToRoadmap(value) {
  const issueNumber = typeof value === 'string' && value.startsWith('{')
    ? JSON.parse(value).issueNumber
    : value;

  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env;

  await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${issueNumber}/labels`,
    {
      method: 'POST',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ labels: ['roadmap'] }),
    }
  );

  return {
    response_type: 'in_channel',
    text: `📋 Issue #${issueNumber} added to the roadmap!`,
  };
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
