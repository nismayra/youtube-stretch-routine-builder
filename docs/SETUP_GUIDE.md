# Complete Setup Guide - Auto Bug Fixer System

## Architecture Overview

```
┌─────────────────────────────────────────┐
│         Production Web App              │
│  ┌──────────────┐  ┌────────────────┐  │
│  │ Error Logger  │  │ Feedback Widget│  │
│  └──────┬───────┘  └───────┬────────┘  │
└─────────┼───────────────────┼───────────┘
          │                   │
          ▼                   ▼
   ┌──────────────────────────────┐
   │   Serverless API Functions   │
   │  /api/report-error           │
   │  /api/submit-feedback        │
   │  /api/slack-notify           │
   │  /api/slack-commands         │
   │  /api/slack-actions          │
   │  /api/slack-claude           │
   └──────────┬───────────────────┘
              │
              ▼
   ┌──────────────────┐    ┌─────────────┐
   │  GitHub Issues    │───▶│ GitHub      │
   │  (Auto-created)  │    │ Actions     │
   └──────────────────┘    └──────┬──────┘
                                  │
                                  ▼
                           ┌─────────────┐
                           │ Claude AI   │
                           │ (Analysis)  │
                           └──────┬──────┘
                                  │
                                  ▼
                           ┌─────────────┐
                           │ Pull Request│
                           │ (Auto-fix)  │
                           └──────┬──────┘
                                  │
                                  ▼
                           ┌─────────────┐
                           │ Slack Notify│
                           │ (Team)      │
                           └─────────────┘
```

## Environment Variables

### GitHub Actions Variables

Set in: Repository Settings → Variables → Actions

| Variable | Value | Purpose |
|----------|-------|---------|
| `FIREBASE_ENABLED` | `true`/`false` | Enable Firebase authentication |
| `YOUTUBE_API_ENABLED` | `true`/`false` | Enable YouTube Data API |
| `GA_ENABLED` | `true`/`false` | Enable Google Analytics |
| `AUTOBUG_ENABLED` | `true`/`false` | Enable error logger & feedback widget |

### GitHub Actions Secrets

Set in: Repository Settings → Secrets → Actions

| Secret | Required For | How to Get |
|--------|-------------|------------|
| `ANTHROPIC_API_KEY` | AI analysis | [console.anthropic.com](https://console.anthropic.com) |
| `SLACK_WEBHOOK_URL` | Slack notifications | Slack App → Incoming Webhooks |
| `GITHUB_TOKEN` | Auto (provided by Actions) | Automatic in GitHub Actions |

### Serverless Function Environment Variables

If deploying API functions to Vercel/Netlify, set these:

| Variable | Purpose |
|----------|---------|
| `GITHUB_TOKEN` | GitHub API access for creating issues/PRs |
| `GITHUB_OWNER` | Repository owner (e.g., `your-username`) |
| `GITHUB_REPO` | Repository name (e.g., `youtube-stretch-routine-builder`) |
| `ANTHROPIC_API_KEY` | Claude AI for /ask-claude and bug analysis |
| `SLACK_WEBHOOK_URL` | Default Slack notification webhook |
| `SLACK_BUGS_WEBHOOK` | (Optional) Dedicated #bugs channel webhook |
| `SLACK_FEATURES_WEBHOOK` | (Optional) Dedicated #features channel webhook |
| `SLACK_DEPLOYMENTS_WEBHOOK` | (Optional) Dedicated #deployments channel webhook |
| `SLACK_SIGNING_SECRET` | Verify Slack requests (from Slack App settings) |
| `SLACK_BOT_TOKEN` | Bot OAuth token for posting messages |

## Deploying API Functions

### Option A: Vercel (Recommended)

The `/api` directory is automatically recognized by Vercel as serverless functions.

1. Connect your GitHub repo to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy - functions are live at `your-app.vercel.app/api/*`

### Option B: Netlify

1. Move API files to `netlify/functions/` directory
2. Adjust import/export format for Netlify Functions
3. Set environment variables in Netlify dashboard

### Option C: Cloudflare Workers

1. Adapt API files to Cloudflare Workers format
2. Deploy using Wrangler CLI

## Component Details

### 1. Error Logger (`scripts/error-logger.js`)

Automatically captures:
- **JavaScript errors** - window.onerror
- **Promise rejections** - unhandledrejection events
- **Network failures** - Failed fetch/XHR requests (5xx only)
- **Console errors** - Intercepted console.error calls

Configuration:
```javascript
// After including the script, you can customize:
ErrorLogger.configure({
  apiEndpoint: '/api/report-error',   // API endpoint
  maxErrorsPerMinute: 10,             // Rate limiting
  batchInterval: 5000,                // Batch errors every 5s
  enableConsoleCapture: true,         // Capture console.error
  enableNetworkCapture: true,         // Capture network failures
});
```

Manual error reporting:
```javascript
ErrorLogger.captureError('Something went wrong', { context: 'user action' });
ErrorLogger.captureWarning('Potential issue', { detail: 'info' });
```

### 2. Feedback Widget (`scripts/feedback-widget.js`)

Features:
- Bug report form with severity selection
- Feature request form with priority
- Screenshot support (drag/drop/paste/upload)
- Email capture for follow-ups
- Auto-closes after submission

Configuration:
```javascript
FeedbackWidget.configure({
  apiEndpoint: '/api/submit-feedback',
  position: 'bottom-right',
  primaryColor: '#7c3aed',
});
```

Programmatic control:
```javascript
FeedbackWidget.open();   // Open the widget
FeedbackWidget.close();  // Close the widget
```

### 3. Auto Bug Analyzer (GitHub Action + Script)

Triggers when an issue is labeled `ai-analyze`. The workflow:
1. Reads all source code files
2. Sends the bug report + code to Claude
3. Claude identifies root cause and proposes fix
4. Creates a new branch with the fix
5. Opens a PR linked to the issue
6. Notifies Slack

### 4. Slack Integration

Six API endpoints for full ChatOps:

| Endpoint | Purpose |
|----------|---------|
| `/api/slack-notify` | Send formatted notifications |
| `/api/slack-commands` | Handle slash commands |
| `/api/slack-actions` | Handle button interactions |
| `/api/slack-claude` | AI chat in Slack |

## Workflow Examples

### Auto-Detected Bug → Fix
```
1. Error in production → error-logger.js captures it
2. POST /api/report-error → GitHub Issue created (bug, auto-detected)
3. Slack notified → Team clicks "AI Analyze" button
4. ai-analyze label added → GitHub Action triggers
5. Claude analyzes → Identifies root cause
6. PR created → Proposed fix with code changes
7. Slack notification → Team clicks "Approve & Merge"
8. Merged → Auto-deployed via existing CI/CD
```

### User Bug Report → Triage
```
1. User clicks feedback button → Fills bug form
2. POST /api/submit-feedback → GitHub Issue created (bug, user-reported)
3. Slack notified → Posted to #bugs channel
4. Team triages → Assigns priority
5. (Optional) Label with ai-analyze → AI proposes fix
```

## Security

- API endpoints validate request signatures from Slack
- GitHub tokens are stored as secrets, never in source code
- Rate limiting on error reporting (10/minute)
- Error logger ignores browser extensions and known noise
- Feedback widget sanitizes input before submission
- Screenshot data is base64 encoded (not uploaded to external services)
