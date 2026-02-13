/**
 * Bug Analyzer - AI-powered bug analysis and auto-fix system
 *
 * This script is run by the GitHub Action when an issue is labeled 'ai-analyze'.
 * It uses Claude to:
 * 1. Analyze the bug report
 * 2. Search the codebase for related code
 * 3. Identify the root cause
 * 4. Propose a fix
 * 5. Create a PR with the fix
 *
 * Environment variables (set by GitHub Action):
 *   ANTHROPIC_API_KEY - Claude API key
 *   GITHUB_TOKEN      - GitHub token (automatic in Actions)
 *   GITHUB_OWNER      - Repository owner
 *   GITHUB_REPO       - Repository name
 *   ISSUE_NUMBER      - Issue number to analyze
 *   ISSUE_TITLE       - Issue title
 *   ISSUE_BODY        - Issue body
 *   SLACK_WEBHOOK_URL - (Optional) Slack notification webhook
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
  ANTHROPIC_API_KEY,
  GITHUB_TOKEN,
  GITHUB_OWNER,
  GITHUB_REPO,
  ISSUE_NUMBER,
  ISSUE_TITLE,
  ISSUE_BODY,
  SLACK_WEBHOOK_URL,
} = process.env;

async function main() {
  console.log(`\n🔍 Analyzing issue #${ISSUE_NUMBER}: ${ISSUE_TITLE}\n`);

  // Step 1: Read relevant source files
  const sourceFiles = readSourceFiles();
  console.log(`📂 Read ${sourceFiles.length} source files`);

  // Step 2: Ask Claude to analyze the bug
  console.log('🤖 Asking Claude to analyze the bug...');
  const analysis = await analyzeBug(sourceFiles);
  console.log('✅ Analysis complete');

  // Step 3: Comment on the issue with the analysis
  console.log('💬 Posting analysis to issue...');
  await commentOnIssue(analysis.analysis);

  // Step 4: If a fix is proposed, create a PR
  if (analysis.fix && analysis.fix.changes && analysis.fix.changes.length > 0) {
    console.log('🔧 Creating fix branch and PR...');
    await createFixPR(analysis);
  } else {
    console.log('ℹ️ No automated fix proposed - manual review needed');
    await addLabel('needs-manual-review');
  }

  // Step 5: Notify Slack
  if (SLACK_WEBHOOK_URL) {
    console.log('📢 Notifying Slack...');
    await notifySlack(analysis);
  }

  // Step 6: Remove ai-analyze label, add ai-analyzed
  await removeLabel('ai-analyze');
  await addLabel('ai-analyzed');

  console.log('\n✨ Bug analysis complete!\n');
}

function readSourceFiles() {
  const files = [];
  const repoRoot = path.resolve(__dirname, '..');

  // Read the main HTML file
  const mainHtml = path.join(repoRoot, 'stretch-routine-builder.html');
  if (fs.existsSync(mainHtml)) {
    const content = fs.readFileSync(mainHtml, 'utf-8');
    // Extract just the JavaScript portion (it's a large file)
    const scriptMatch = content.match(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g);
    if (scriptMatch) {
      files.push({
        path: 'stretch-routine-builder.html (JavaScript)',
        content: scriptMatch.join('\n\n// --- Next script block ---\n\n').substring(0, 50000),
      });
    }
    // Extract CSS
    const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/g);
    if (styleMatch) {
      files.push({
        path: 'stretch-routine-builder.html (CSS)',
        content: styleMatch.join('\n').substring(0, 20000),
      });
    }
  }

  // Read API files
  const apiDir = path.join(repoRoot, 'api');
  if (fs.existsSync(apiDir)) {
    for (const file of fs.readdirSync(apiDir)) {
      if (file.endsWith('.js')) {
        files.push({
          path: `api/${file}`,
          content: fs.readFileSync(path.join(apiDir, file), 'utf-8'),
        });
      }
    }
  }

  // Read script files
  const scriptsDir = path.join(repoRoot, 'scripts');
  if (fs.existsSync(scriptsDir)) {
    for (const file of fs.readdirSync(scriptsDir)) {
      if (file.endsWith('.js') && file !== 'bug-analyzer.js') {
        files.push({
          path: `scripts/${file}`,
          content: fs.readFileSync(path.join(scriptsDir, file), 'utf-8'),
        });
      }
    }
  }

  return files;
}

async function analyzeBug(sourceFiles) {
  const codeContext = sourceFiles
    .map((f) => `### File: ${f.path}\n\`\`\`javascript\n${f.content}\n\`\`\``)
    .join('\n\n');

  const prompt = `You are an expert software engineer analyzing a bug report for a YouTube Stretch Routine Builder web application.

## Bug Report

**Issue #${ISSUE_NUMBER}: ${ISSUE_TITLE}**

${ISSUE_BODY}

## Source Code

${codeContext}

## Instructions

Analyze this bug report and provide:

1. **Root Cause Analysis**: What is causing this bug? Be specific about the file, function, and line of code.

2. **Impact Assessment**: How severe is this bug? What functionality is affected?

3. **Proposed Fix**: Provide the exact code changes needed to fix this bug. Format each change as:
   - File path
   - The original code (exact match)
   - The replacement code

4. **Testing Notes**: How should this fix be tested?

Respond in the following JSON format:
{
  "analysis": "Markdown formatted analysis with root cause, impact, and explanation",
  "severity": "low|medium|high|critical",
  "rootCause": "Brief description of root cause",
  "fix": {
    "description": "Brief description of the fix",
    "changes": [
      {
        "file": "path/to/file",
        "original": "exact original code to replace",
        "replacement": "new code"
      }
    ]
  },
  "testingNotes": "How to test the fix"
}

If you cannot determine a fix automatically, set changes to an empty array and explain why in the analysis.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = data.content[0].text;

  // Parse JSON from the response
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.warn('Failed to parse JSON response, using text as analysis');
  }

  return {
    analysis: text,
    severity: 'medium',
    rootCause: 'See analysis',
    fix: { description: 'Manual review needed', changes: [] },
    testingNotes: 'Manual testing required',
  };
}

async function commentOnIssue(analysis) {
  const body = [
    '## 🤖 AI Bug Analysis',
    '',
    analysis,
    '',
    '---',
    '*This analysis was generated by Claude AI. Please review before applying any suggested fixes.*',
  ].join('\n');

  await githubApi(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${ISSUE_NUMBER}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

async function createFixPR(analysis) {
  const branchName = `ai-fix/issue-${ISSUE_NUMBER}`;

  // Get the default branch
  const repoInfo = await githubApi(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}`);
  const defaultBranch = repoInfo.default_branch || 'main';

  // Get the latest commit SHA of the default branch
  const refData = await githubApi(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/${defaultBranch}`
  );
  const baseSha = refData.object.sha;

  // Create a new branch
  try {
    await githubApi(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha }),
    });
  } catch (e) {
    // Branch might already exist, try to update it
    await githubApi(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${branchName}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: baseSha, force: true }),
    });
  }

  // Apply each change
  for (const change of analysis.fix.changes) {
    try {
      // Get current file content
      const fileData = await githubApi(
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${change.file}?ref=${branchName}`
      );

      const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
      const newContent = currentContent.replace(change.original, change.replacement);

      if (currentContent === newContent) {
        console.log(`⚠️ No match found for change in ${change.file}, skipping`);
        continue;
      }

      // Update the file
      await githubApi(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${change.file}`, {
        method: 'PUT',
        body: JSON.stringify({
          message: `fix: ${analysis.fix.description} (issue #${ISSUE_NUMBER})`,
          content: Buffer.from(newContent).toString('base64'),
          sha: fileData.sha,
          branch: branchName,
        }),
      });

      console.log(`✅ Updated ${change.file}`);
    } catch (e) {
      console.error(`❌ Failed to update ${change.file}: ${e.message}`);
    }
  }

  // Create the PR
  const prBody = [
    `## AI-Generated Fix for #${ISSUE_NUMBER}`,
    '',
    `**Root Cause:** ${analysis.rootCause}`,
    '',
    `### Changes`,
    '',
    analysis.fix.description,
    '',
    analysis.fix.changes.map((c) => `- \`${c.file}\`: Applied fix`).join('\n'),
    '',
    `### Testing Notes`,
    '',
    analysis.testingNotes,
    '',
    '---',
    `Fixes #${ISSUE_NUMBER}`,
    '',
    '⚠️ *This PR was generated by AI. Please review carefully before merging.*',
  ].join('\n');

  const pr = await githubApi(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls`, {
    method: 'POST',
    body: JSON.stringify({
      title: `🤖 Fix: ${ISSUE_TITLE}`,
      body: prBody,
      head: branchName,
      base: defaultBranch,
    }),
  });

  console.log(`✅ Created PR #${pr.number}: ${pr.html_url}`);

  // Comment on the issue with a link to the PR
  await githubApi(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${ISSUE_NUMBER}/comments`, {
    method: 'POST',
    body: JSON.stringify({
      body: `🔧 **AI Fix Proposed:** PR #${pr.number}\n\nPlease review the proposed fix: ${pr.html_url}`,
    }),
  });

  return pr;
}

async function addLabel(label) {
  try {
    await githubApi(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${ISSUE_NUMBER}/labels`,
      {
        method: 'POST',
        body: JSON.stringify({ labels: [label] }),
      }
    );
  } catch (e) {
    console.warn(`Could not add label "${label}": ${e.message}`);
  }
}

async function removeLabel(label) {
  try {
    await githubApi(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${ISSUE_NUMBER}/labels/${encodeURIComponent(label)}`,
      { method: 'DELETE' }
    );
  } catch (e) {
    console.warn(`Could not remove label "${label}": ${e.message}`);
  }
}

async function notifySlack(analysis) {
  if (!SLACK_WEBHOOK_URL) return;

  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🤖 AI Analysis Complete: #${ISSUE_NUMBER}`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Issue:*\n${ISSUE_TITLE}` },
          { type: 'mrkdwn', text: `*Severity:*\n${analysis.severity}` },
          { type: 'mrkdwn', text: `*Root Cause:*\n${analysis.rootCause}` },
          {
            type: 'mrkdwn',
            text: `*Fix:*\n${analysis.fix.changes.length > 0 ? 'PR created' : 'Manual review needed'}`,
          },
        ],
      },
    ],
  };

  await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function githubApi(endpoint, options = {}) {
  const url = endpoint.startsWith('https')
    ? endpoint
    : `https://api.github.com${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${response.status}: ${text}`);
  }

  // Some DELETE requests return 204 No Content
  if (response.status === 204) return {};

  return response.json();
}

// Run
main().catch((error) => {
  console.error('❌ Bug analysis failed:', error);
  process.exit(1);
});
