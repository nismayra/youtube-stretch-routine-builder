# YouTube Stretch Routine Builder 🧘‍♂️

> A powerful, customizable web application for creating and following exercise routines from YouTube videos

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](https://github.com/nismayra/youtube-stretch-routine-builder/releases)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

## ✨ Features

- **📚 Quick Load Presets** - 3 built-in routines with one-click loading
- **🎬 Sequential Player** - Auto-progression with visual playlist
- **⏱️ Dual Pause System** - Separate timers for repeats vs transitions
- **🔄 Overall Repeats** - Do entire routine multiple times
- **📋 Clone Exercises** - Duplicate any stretch instantly
- **🗑️ Delete Exercises** - Remove unwanted stretches
- **↕️ Reorder Exercises** - Move up/down to customize sequence
- **💾 Export/Import** - Save custom routines as JSON
- **📱 Mobile Responsive** - Works on desktop and mobile
- **🚫 No Installation** - Just open in browser!

## 🚀 Quick Start

### Option 1: Run Locally

```bash
# Clone the repository
git clone https://github.com/nismayra/youtube-stretch-routine-builder.git

# Navigate to directory
cd youtube-stretch-routine-builder

# Start local server
python -m http.server 8000

# Open in browser
# Visit: http://localhost:8000
```

### Option 2: GitHub Pages (Live Demo)

Visit the live demo at: **[https://nismayra.github.io/youtube-stretch-routine-builder/](https://nismayra.github.io/youtube-stretch-routine-builder/)**

### Option 3: Download and Open

1. Download `index.html`
2. Open in any modern browser
3. Start using immediately!

## 📦 Included Preset Routines

### 🧘 Lower Back Stretches
- **10 exercises** for lower back pain relief
- **5 minutes** per sequence
- **No equipment** needed
- Perfect for daily stretching

### 💪 Hip Strengthening
- **9 exercises** from basic to advanced
- **20 minutes** per sequence
- **Resistance band + weights** required
- Progressive difficulty levels

### 🏃 Neck & Upper Back
- **6 exercises** for neck pain relief
- **5 minutes** per sequence
- **No equipment** needed
- Office-friendly, desk-side routine

## 🎮 How It Works

### 1. Select a Preset
Go to **Configuration** tab → Click any preset card → Instantly loaded!

### 2. Customize (Optional)
- **Clone** favorite exercises (📋 button)
- **Delete** unwanted exercises (🗑️ button)
- **Reorder** with ↑↓ buttons
- **Edit** descriptions and timings

### 3. Follow Along
- **Grid View**: See all exercises at once
- **Sequential Mode**: Follow one-by-one with auto-progression
- **Pause Controls**: Configure rest time between exercises

### 4. Save Your Routine
Click "**Save Config**" to download your custom routine as JSON

## 📸 Screenshots

### Grid View
All exercises visible with individual controls and loop options.

### Sequential Player
Auto-advancing player with visual playlist and progress tracking.

### Preset Selector
One-click loading of built-in exercise routines.

## 🛠️ Technical Details

- **Built with**: Vanilla JavaScript, HTML5, CSS3
- **API**: YouTube IFrame API
- **Storage**: JSON configuration files
- **Hosting**: Static files (no backend needed)
- **Browser Support**: Chrome, Firefox, Safari, Edge

## 📖 Documentation

- **[USER-GUIDE.md](USER-GUIDE.md)** - Complete user manual with examples
- **[HIP-EXERCISES-README.md](HIP-EXERCISES-README.md)** - Hip exercises guide
- **[NECK-STRETCHES-README.md](NECK-STRETCHES-README.md)** - Neck stretches guide
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - How to contribute
- **[GIT-SETUP.md](GIT-SETUP.md)** - Git sync instructions

## 🎯 Use Cases

- **Physical Therapy** - Follow prescribed exercise routines
- **Daily Stretching** - Quick morning or evening routines
- **Desk Workers** - Combat sitting-related pain
- **Athletes** - Warm-up and cool-down sequences
- **Seniors** - Gentle mobility exercises
- **Teachers/Trainers** - Create routines for students

## 🔧 Configuration Format

Create your own routines with simple JSON:

```json
{
  "layout": "5x2",
  "videoId": "DEFAULT_VIDEO_ID",
  "stretches": [
    {
      "name": "Exercise Name",
      "videoId": "SPECIFIC_VIDEO_ID",
      "start": 120,
      "end": 180,
      "repeat": 3,
      "loop": true,
      "description": "What this exercise does"
    }
  ]
}
```

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Ways to Contribute:
- 🐛 Report bugs
- 💡 Suggest features
- 📝 Add new preset configurations
- 🔧 Submit pull requests
- 📖 Improve documentation

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- YouTube IFrame API for video playback
- Bob & Brad Physical Therapy for exercise videos
- All contributors and users

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/nismayra/youtube-stretch-routine-builder/issues)
- **Discussions**: [GitHub Discussions](https://github.com/nismayra/youtube-stretch-routine-builder/discussions)

## 🌟 Star History

If you find this project useful, please consider giving it a star! ⭐

---

**Made with ❤️ for everyone who needs better mobility and less pain**

[Report Bug](https://github.com/nismayra/youtube-stretch-routine-builder/issues) · [Request Feature](https://github.com/nismayra/youtube-stretch-routine-builder/issues) · [View Demo](https://nismayra.github.io/youtube-stretch-routine-builder/)
