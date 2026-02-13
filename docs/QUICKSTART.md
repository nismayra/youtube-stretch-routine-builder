# Quick Start Guide - Auto Bug Fixer System

Get the AI-powered bug detection, feedback widget, and Slack integration running in 2 minutes.

## Prerequisites

- GitHub repository with Actions enabled
- (Optional) Slack workspace for notifications
- (Optional) Anthropic API key for AI analysis

## Step 1: Enable Frontend Scripts

Set the GitHub Actions variable to enable the error logger and feedback widget:

```
Repository Settings → Variables → Actions → New variable
  Name: AUTOBUG_ENABLED
  Value: true
```

This will uncomment the script tags at deploy time, enabling:
- **Error Logger** - Auto-detects JS errors, promise rejections, and network failures
- **Feedback Widget** - Floating button for users to report bugs and request features

## Step 2: Set Up GitHub Secrets

Add these secrets for the auto-fix system:

| Secret | Required | Description |
|--------|----------|-------------|
| `ANTHROPIC_API_KEY` | For AI analysis | Claude API key from console.anthropic.com |
| `SLACK_WEBHOOK_URL` | For notifications | Slack incoming webhook URL |

## Step 3: Deploy

Push to main branch - the CI/CD pipeline will:
1. Inject the scripts into the HTML
2. Deploy to GitHub Pages

## Step 4: Test It

1. **Error Detection**: Open your deployed site, open browser console, type `throw new Error("test")` - an issue will be created on GitHub
2. **Feedback Widget**: Click the 💬 button in the bottom-right corner of your site
3. **AI Analysis**: Add the `ai-analyze` label to any bug issue - Claude will analyze it and propose a fix

## What Happens Next?

```
Error detected → GitHub Issue created → Label with "ai-analyze" →
Claude analyzes → PR created with fix → Slack notification →
Team reviews → Approve & merge → Auto-deployed
```

## Next Steps

- [Full Setup Guide](SETUP_GUIDE.md) - Detailed configuration
- [Feedback Widget Guide](FEEDBACK_WIDGET_GUIDE.md) - Customization options
- [Slack Integration Guide](SLACK_INTEGRATION_GUIDE.md) - Slack app setup
