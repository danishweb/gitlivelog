# GitLiveLog 🚀

> Tired of your GitHub activity graph making you look like you've been on a year-long sabbatical? Let GitLiveLog save you from commit embarrassment! 

GitLiveLog is your VS Code companion that automatically commits your code changes while you're in the flow. No more forgetting to commit - we've got you covered! 

![VS Code Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/danishweb.gitlivelog)
![VS Code Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/danishweb.gitlivelog)
![VS Code Marketplace Rating](https://img.shields.io/visual-studio-marketplace/r/danishweb.gitlivelog)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

<p align="center">
  <img src="resources/icon.svg" width="150" />
</p>

## Features ✨

- **🤖 Auto-Commit**: Automatically commits your changes while you code
- **🧠 AI-Powered**: Generates meaningful commit messages using AI
- **⚡ Zero Config**: Works out of the box with smart defaults
- **🎯 Focus Mode**: No more context switching to make commits
- **📊 Better History**: Granular commit history shows your actual progress
- **🎨 Flexible**: Customize commit frequency and AI models to your liking

## Quick Start 🎬

1. Install GitLiveLog from VS Code Marketplace
2. Open your project
3. Start coding! GitLiveLog will handle the commits

## Configuration ⚙️

Access settings through VS Code's settings menu:

```json
{
  "gitlivelog.isTracking": true,        // Enable/disable auto-tracking
  "gitlivelog.commitFrequency": 5,      // Minutes between commits
  "gitlivelog.ai.enabled": true,        // Enable AI commit messages
  "gitlivelog.ai.model": "gemini-pro",  // Choose AI model
  "gitlivelog.ai.apiKey": ""            // Your AI service API key
}
```

## Supported AI Models 🤖

- Gemini Pro (Default)
- GPT-3.5 Turbo
- GPT-4
- DeepSeek Chat

## Why GitLiveLog? 🤔

- **Never Forget to Commit**: Auto-commits while you code
- **Stay in the Zone**: No more interruptions to write commit messages
- **Smart History**: AI generates meaningful commit messages
- **Real Progress**: Your GitHub activity finally reflects your true effort

## For More Details 📚

Check out our [detailed documentation](docs/README.md) for:
- Advanced configuration
- Best practices
- Pro tips
- Troubleshooting

## Contributing 🤝

Contributions are welcome! Please feel free to submit a Pull Request. For major changes:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License 📄

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
Made with ❤️ by developers who kept forgetting to commit<br>
<a href="https://github.com/danishweb/gitlivelog/issues">Report Bug</a> · <a href="https://github.com/danishweb/gitlivelog/issues">Request Feature</a>
</p>
