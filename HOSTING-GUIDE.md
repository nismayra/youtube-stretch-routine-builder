# Hosting & Setup Guide

## 1. Free Hosting Options (Ranked)

### Option A: GitHub Pages (Recommended - Simplest)

**Cost:** Free forever for public repos
**CI/CD:** Built-in via GitHub Actions (included in this repo)
**Custom domain:** Supported (free)

#### Setup Steps:

1. Push this repo to GitHub
2. Go to **Settings > Pages**
3. Under "Build and deployment", select **GitHub Actions**
4. The included `.github/workflows/deploy.yml` handles everything
5. Every push to `main` auto-deploys

**Your site will be live at:** `https://<username>.github.io/youtube-stretch-routine-builder/`

### Option B: Cloudflare Pages

**Cost:** Free (unlimited bandwidth)
**CI/CD:** Auto-deploys on git push
**Custom domain:** Free with Cloudflare DNS

1. Go to [pages.cloudflare.com](https://pages.cloudflare.com)
2. Connect your GitHub repo
3. Set build output directory to `/` (root)
4. No build command needed (static HTML)

### Option C: Netlify

**Cost:** Free tier (100GB bandwidth/month)
**CI/CD:** Auto-deploys on git push

1. Go to [netlify.com](https://netlify.com)
2. "New site from Git" > Select repo
3. No build command, publish directory: `/`

### Option D: Vercel

**Cost:** Free tier
**CI/CD:** Auto-deploys on git push

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repo
3. Framework: "Other", output: `/`

---

## 2. Google SSO Setup (Firebase Auth)

Firebase Authentication is free for unlimited users on the Spark (free) plan.

### Step 1: Create Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click "Add project"
3. Name it (e.g., `stretch-routine-builder`)
4. Disable Google Analytics (optional, simplifies setup)
5. Click "Create project"

### Step 2: Enable Google Sign-In

1. In Firebase Console > **Authentication** > **Sign-in method**
2. Click **Google** > **Enable**
3. Add your project's support email
4. Save

### Step 3: Add Your Domain

1. Go to **Authentication** > **Settings** > **Authorized domains**
2. Add your GitHub Pages domain: `<username>.github.io`
3. (Also add `localhost` for local development)

### Step 4: Get Firebase Config

1. Go to **Project settings** (gear icon)
2. Under "Your apps", click the web icon `</>`
3. Register your app (any nickname)
4. Copy the `firebaseConfig` object

### Step 5: Enable Firestore

1. In Firebase Console > **Firestore Database**
2. Click "Create database"
3. Start in **production mode**
4. Select a region close to your users

### Step 6: Set Firestore Security Rules

In Firestore > **Rules**, paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Public playlists: anyone can read
    match /playlists/{playlistId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null
        && request.auth.uid == resource.data.userId;
    }
  }
}
```

### Step 7: Update Your App

In `stretch-routine-builder.html`, find the `firebaseConfig` object and replace with your values:

```javascript
const firebaseConfig = {
    apiKey: "AIzaSy...",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123"
};
```

Then uncomment the Firebase SDK scripts at the bottom of the HTML file:

```html
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>
<script>initFirebase();</script>
```

### Step 8: Deploy

Push to GitHub. The CI/CD pipeline auto-deploys.

---

## 3. CI/CD Pipeline

The included GitHub Actions workflow (`.github/workflows/deploy.yml`) provides:

- **Automatic deployment** on every push to `main`
- **Manual deployment** via "Run workflow" button in GitHub Actions tab
- **Zero configuration** needed - just enable GitHub Pages

### How It Works

```
Push to main → GitHub Actions triggered → Static files uploaded → Live on GitHub Pages
```

No build step is needed since this is a static HTML app.

---

## 4. Architecture Summary

```
┌─────────────────────────────────────────┐
│            GitHub Repository            │
│  (stretch-routine-builder.html + assets)│
└──────────────┬──────────────────────────┘
               │ push to main
               ▼
┌─────────────────────────────────────────┐
│         GitHub Actions CI/CD            │
│    (.github/workflows/deploy.yml)       │
└──────────────┬──────────────────────────┘
               │ auto-deploy
               ▼
┌─────────────────────────────────────────┐
│          GitHub Pages (Free)            │
│   https://user.github.io/repo-name/    │
└──────────────┬──────────────────────────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌──────────────┐
│ Public │ │ Local  │ │ Cloud (Auth) │
│Playlists│ │Storage │ │  Firebase    │
│(built-in)│ │(browser)│ │  Firestore   │
└────────┘ └────────┘ └──────────────┘
```

**Public (default):** Built-in playlists + localStorage for anyone
**Private (opt-in):** Google SSO → Firebase Firestore for cloud sync

---

## 5. Cost Breakdown

| Service | Free Tier | Limits |
|---------|-----------|--------|
| GitHub Pages | Forever free | 100GB bandwidth/month, public repos |
| Firebase Auth | Forever free | Unlimited users |
| Firestore | Forever free | 1GB storage, 50K reads/day, 20K writes/day |
| GitHub Actions | 2,000 min/month | More than enough for static deploys |

**Total cost: $0/month** for most use cases.
