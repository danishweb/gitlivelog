# GitLiveLog 🚀

Never let your GitHub activity graph look empty again! GitLiveLog automatically tracks and commits your coding activity in real-time, powered by AI for meaningful commit messages.

## Features ✨ 

- **AI-Powered Commit Messages**: Generates meaningful commit messages using various AI models
- **Multiple AI Providers**: Support for:
  - Google Gemini
  - OpenAI (GPT-3.5, GPT-4)
  - DeepSeek
  - More coming soon!
- **Customizable Settings**: Configure commit frequency, AI providers, and more
- **Smart Diffing**: Only commits meaningful changes
- **Status Bar Integration**: See your tracking status at a glance

## Requirements 📋

- VS Code 1.85.0 or higher
- Git installed and configured
- API key for your chosen AI provider

## Installation 🔧

1. Install the extension from VS Code Marketplace
2. Configure your preferred AI provider in settings
3. Start coding! GitLiveLog will handle the rest

## Configuration ⚙️

Access settings through VS Code's settings UI or settings.json:

```json
{
  "gitlivelog.isTracking": true,
  "gitlivelog.commitFrequency": 5,
  "gitlivelog.ai.enabled": true,
  "gitlivelog.ai.model": "gemini-pro",
  "gitlivelog.ai.apiKey": "your-api-key-here"
}
```

## AI Models 🤖

Currently supported models:
- gemini-pro (Google)
- gpt-3.5-turbo (OpenAI)
- gpt-4 (OpenAI)
- deepseek-chat (DeepSeek)

## Commands 🎮

- `GitLiveLog: Show Menu`: Open the GitLiveLog command menu
- `GitLiveLog: Start Tracking`: Start tracking your coding activity
- `GitLiveLog: Stop Tracking`: Stop tracking
- `GitLiveLog: Configure Settings`: Open settings

## Contributing 🤝

Contributions are welcome! Please check our [contribution guidelines](CONTRIBUTING.md).

## License 📄

MIT License - see [LICENSE](LICENSE) for details.

## Support 💬

Having issues or suggestions? Please [open an issue](https://github.com/Codeium-team/gitlivelog/issues).
