# Feedback Widget Guide

## Overview

The feedback widget provides an in-app portal for users to submit bug reports and feature requests. It appears as a floating button (💬) in the bottom-right corner of the page.

## Features

### Bug Reports
- **Title** - Brief description of the issue
- **Steps to Reproduce** - Detailed reproduction steps
- **Severity** - Low / Medium / High / Critical
- **Screenshot** - Drag & drop, paste from clipboard, or file upload
- **Email** - Optional, for follow-up communication

### Feature Requests
- **Title** - Feature description
- **Use Case** - How and why the feature would be used
- **Priority** - Nice to have / Important / Critical for workflow
- **Email** - Optional, for updates when shipped

## How It Works

```
User clicks 💬 → Fills form → Submit
                                 │
                                 ▼
                     POST /api/submit-feedback
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼             ▼
             GitHub Issue   Slack Notify   User Sees
             (auto-created) (#bugs or     "Thank you!"
                            #features)
```

## Enabling the Widget

### For GitHub Pages deployment

1. Set the `AUTOBUG_ENABLED` variable to `true` in your repository settings
2. Push to main - the deploy workflow will uncomment the script tags

### For local development

Uncomment the script tags manually in `stretch-routine-builder.html`:

```html
<!-- Change this: -->
<!-- __AUTOBUG_SCRIPTS_START__
<script src="scripts/error-logger.js"></script>
<script src="scripts/feedback-widget.js"></script>
__AUTOBUG_SCRIPTS_END__ -->

<!-- To this: -->
<script src="scripts/error-logger.js"></script>
<script src="scripts/feedback-widget.js"></script>
```

## Configuration

```javascript
// Configure after the script loads
FeedbackWidget.configure({
  apiEndpoint: '/api/submit-feedback',  // Your API endpoint
  position: 'bottom-right',             // Widget position
  primaryColor: '#7c3aed',              // Brand color
  accentColor: '#a78bfa',               // Accent color
});
```

## Programmatic Control

```javascript
// Open the widget programmatically
FeedbackWidget.open();

// Close the widget
FeedbackWidget.close();
```

## Screenshot Support

Users can attach screenshots in three ways:

1. **Drag and drop** - Drag an image file onto the screenshot zone
2. **Paste from clipboard** - Take a screenshot (Cmd/Ctrl+Shift+4) and paste (Cmd/Ctrl+V) while the widget is open
3. **File upload** - Click the screenshot zone to open a file picker

Screenshots are encoded as base64 data URIs and included in the feedback submission.

## Styling

The widget uses its own scoped CSS that won't interfere with your app styles. The dark theme matches the Stretch Routine Builder aesthetic:

- Dark background (`#1a1a2e`)
- Purple gradient accents
- Rounded corners and smooth animations
- Responsive design (adapts to mobile)

## GitHub Issue Labels

Bug reports are created with:
- `bug` - Standard bug label
- `user-reported` - Indicates user-submitted
- `priority:high` - Added for high/critical severity

Feature requests are created with:
- `enhancement` - Standard feature label
- `user-requested` - Indicates user-submitted
