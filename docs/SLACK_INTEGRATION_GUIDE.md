# Slack Integration Guide

## Overview

Full ChatOps integration that brings bug tracking, feature management, AI assistance, and deployment workflows into Slack.

## Slack App Setup

### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name: `Stretch Routine Bot`
4. Select your workspace

### 2. Configure Bot Permissions

Go to **OAuth & Permissions** → **Bot Token Scopes** and add:

| Scope | Purpose |
|-------|---------|
| `chat:write` | Post messages |
| `commands` | Slash commands |
| `app_mentions:read` | Respond to @mentions |
| `im:read` | Read DMs |
| `im:write` | Send DMs |

### 3. Set Up Slash Commands

Go to **Slash Commands** and create:

| Command | Request URL | Description |
|---------|-------------|-------------|
| `/bug` | `https://your-app.com/api/slack-commands` | Report a bug |
| `/feature` | `https://your-app.com/api/slack-commands` | Request a feature |
| `/ask-claude` | `https://your-app.com/api/slack-commands` | Ask AI a question |
| `/bug-status` | `https://your-app.com/api/slack-commands` | Check bug status |
| `/deploy` | `https://your-app.com/api/slack-commands` | Deploy to production |
| `/approve-pr` | `https://your-app.com/api/slack-commands` | Approve and merge a PR |

### 4. Enable Interactive Components

Go to **Interactivity & Shortcuts**:
- Turn on Interactivity
- Request URL: `https://your-app.com/api/slack-actions`

### 5. Set Up Event Subscriptions (for @mention chat)

Go to **Event Subscriptions**:
- Turn on Events
- Request URL: `https://your-app.com/api/slack-claude`
- Subscribe to bot events:
  - `app_mention`
  - `message.im`

### 6. Set Up Incoming Webhooks

Go to **Incoming Webhooks**:
- Turn on Incoming Webhooks
- Add webhook for your channel(s)

### 7. Install App to Workspace

Go to **Install App** → Install to Workspace

### 8. Save Credentials

Save these to your serverless function environment:

| Credential | Location |
|------------|----------|
| `SLACK_BOT_TOKEN` | OAuth & Permissions → Bot User OAuth Token (`xoxb-...`) |
| `SLACK_SIGNING_SECRET` | Basic Information → Signing Secret |
| `SLACK_WEBHOOK_URL` | Incoming Webhooks → Webhook URL |

## Slash Commands

### `/bug <description>`

Report a bug directly from Slack.

```
/bug The video player doesn't pause when switching exercises
```

Creates a GitHub issue with labels `bug` and `slack-reported`, and posts a confirmation to the channel.

### `/feature <description>`

Request a new feature.

```
/feature Add dark mode toggle for the exercise grid
```

Creates a GitHub issue with labels `enhancement` and `slack-requested`.

### `/ask-claude <question>`

Chat with Claude AI about the project.

```
/ask-claude How does the sequential player handle video transitions?
```

Claude responds with context about the project codebase.

### `/bug-status [issue-number]`

Check the status of bugs.

```
/bug-status         → Shows 5 most recent open bugs
/bug-status 42      → Shows details for issue #42
```

### `/deploy [branch]`

Request a deployment (requires confirmation).

```
/deploy             → Deploy main branch
/deploy feature/x   → Deploy specific branch
```

Shows a confirmation dialog before triggering the GitHub Actions deployment workflow.

### `/approve-pr <number>`

Approve and merge a pull request.

```
/approve-pr 15
```

Shows PR details with Approve & Merge / Reject buttons.

## Interactive Buttons

Slack messages include interactive buttons:

| Button | Action |
|--------|--------|
| **View Issue** | Opens GitHub issue in browser |
| **AI Analyze** | Adds `ai-analyze` label to trigger Claude analysis |
| **Approve & Merge** | Approves PR review and squash-merges |
| **Reject** | Closes the PR |
| **Confirm Deploy** | Triggers deployment workflow |
| **Add to Roadmap** | Adds `roadmap` label to feature request |
| **Acknowledge** | Acknowledges incident alert |

## AI Chat (@mention)

Mention the bot in any channel or DM it directly:

```
@StretchRoutineBot How should we optimize the video grid rendering?
```

Features:
- Maintains conversation context in threads
- Knows about the project architecture
- Can suggest code changes
- Responds with Slack-formatted messages

## Channel Organization

Recommended channel setup:

| Channel | Purpose | Webhook Variable |
|---------|---------|------------------|
| `#bugs` | Bug notifications | `SLACK_BUGS_WEBHOOK` |
| `#features` | Feature requests | `SLACK_FEATURES_WEBHOOK` |
| `#deployments` | Deploy notifications | `SLACK_DEPLOYMENTS_WEBHOOK` |
| `#general` | Default notifications | `SLACK_WEBHOOK_URL` |

## Notification Types

The `/api/slack-notify` endpoint supports these notification types:

| Type | When Sent |
|------|-----------|
| `bug` | New bug detected or reported |
| `feature` | New feature request |
| `deployment` | Deployment started/completed/failed |
| `digest` | Daily summary (configure with cron) |
| `incident` | Critical error alert |
| `pr` | AI-generated PR ready for review |

## Daily Digest

To send daily digests, set up a cron job or scheduled GitHub Action that calls:

```bash
curl -X POST https://your-app.com/api/slack-notify \
  -H "Content-Type: application/json" \
  -d '{
    "type": "digest",
    "data": {
      "newBugs": 3,
      "bugsFixed": 5,
      "featureRequests": 2,
      "deployments": 1,
      "openIssues": 12,
      "prsMerged": 4,
      "avgFixTime": "2.5 hours",
      "satisfaction": "94%"
    }
  }'
```
