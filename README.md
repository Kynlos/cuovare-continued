# 🚀 Cuovare - Advanced AI Coding Assistant

[![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-blue?logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=cuovare.cuovare)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/Build-Passing-green)](https://github.com/your-org/cuovare)





## ✨ Features

### 🤖 Multi-Provider AI Support
- **OpenAI GPT-4o, GPT-4 Turbo** - Industry-leading language models
- **Anthropic Claude 3.5 Sonnet** - Advanced reasoning and code understanding  
- **Groq Llama 3.3 70B** - Ultra-fast inference with high quality
- **Grok (X.AI)** - Innovative AI with real-time capabilities
- **OpenRouter** - Access to 100+ AI models through one API

### 🧠 Intelligent Context System
- **Semantic Search** - Understands code concepts, not just keywords
- **Multi-Language Analysis** - TypeScript, JavaScript, Python, Java, and more
- **Smart File Discovery** - Finds relevant files based on your queries
- **Dependency Mapping** - Understands relationships between code files
- **Context Prioritization** - Includes the most relevant code automatically

### 🎨 Beautiful Modern UI
- **Responsive Design** - Optimized for VS Code's sidebar constraints
- **Syntax Highlighting** - Powered by Highlight.js with multiple themes
- **Markdown Support** - Rich text rendering with code blocks
- **Dark Mode Native** - Seamlessly integrates with VS Code themes
- **Mobile-First** - Works perfectly in narrohttps://github.com/Kynlos/cuovarew sidebar widths

### 🔧 Advanced Capabilities
- **@ File Referencing** - `@filename` or `@filename:1-150` for precise context
- **Agentic Code Actions** - Copy, apply, and create files directly from chat
- **Chat History** - Persistent sessions across VS Code restarts
- **MCP Integration** - Model Context Protocol for extensible tool support
- **Streaming Responses** - Real-time AI responses (coming soon)

### 🛡️ Security & Privacy
- **Secure API Key Storage** - Uses VS Code's encrypted storage
- **No Data Logging** - Your code stays private
- **Configurable Providers** - Full control over which AI services to use
- **Local Processing** - Context analysis happens locally

## 🚀 Quick Start

### Installation

1. **From VS Code Marketplace** (Recommended)
   ```
   Code → Extensions → Search "Cuovare" → Install
   ```

2. **From VSIX Package**
   ```bash
   code --install-extension cuovare-0.0.1.vsix
   ```

### Setup

1. **Open Cuovare** - Click the Cuovare icon in the sidebar
2. **Configure API Keys** - Click the settings gear and add your AI provider API keys
3. **Select Your Model** - Choose your preferred AI provider and model
4. **Start Chatting** - Ask questions about your code!

### API Key Setup

#### OpenAI
1. Visit [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Add to Cuovare settings: `sk-...`

#### Anthropic Claude
1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Generate an API key
3. Add to Cuovare settings: `sk-ant-...`

#### Groq
1. Visit [Groq Console](https://console.groq.com/)
2. Create an API key
3. Add to Cuovare settings: `gsk_...`

## 💡 Usage Examples

### Basic Code Questions
```
How does user authentication work in this project?
```

### File-Specific Queries
```
@UserService.ts explain this class and how it's used
@auth/middleware.ts:1-50 what does this middleware do?
```

### Debugging Help
```
I'm getting a TypeError in the login function, can you help debug it?
```

### Code Generation
```
Create a new React component for displaying user profiles with TypeScript
```

### Architecture Questions
```
Show me how the database layer connects to the API endpoints
```

## 🏗️ Project Structure

```
cuovare/
├── src/
│   ├── extension.ts              # Main extension entry point
│   ├── providers/
│   │   ├── AIProviderManager.ts  # Multi-provider AI integration
│   │   └── ChatViewProvider.ts   # Webview UI and chat logic
│   ├── context/
│   │   ├── ContextRetrievalEngine.ts  # Advanced context retrieval
│   │   ├── ContextIntegration.ts      # Integration layer
│   │   └── FileContextManager.ts      # Basic file context
│   └── mcp/
│       └── MCPManager.ts         # Model Context Protocol integration
├── resources/
│   ├── styles.css                # Modern UI styles with Tailwind
│   ├── main.js                   # Frontend JavaScript logic
│   └── icon.png                  # Extension icon
├── test/
│   ├── unit/                     # Unit tests
│   ├── context/                  # Integration tests
│   └── runUnitTests.js          # Test runner
├── docs/
│   ├── DEVELOPMENT.md           # Development guide
│   ├── TESTING.md              # Testing guide
│   └── CONTRIBUTING.md         # Contributor guidelines
└── package.json                # Extension manifest
```

## 🛠️ Development

### Prerequisites
- **Node.js 18+** and **pnpm**
- **VS Code 1.100.0+**
- **TypeScript 5.8+**

### Setup
```bash
# Clone the repository
git clone https://github.com/your-org/cuovare.git
cd cuovare

# Install dependencies
pnpm install

# Compile TypeScript
pnpm run compile

# Start development
code .
# Press F5 to launch Extension Development Host
```

### Available Scripts
```bash
pnpm run compile        # Compile TypeScript
pnpm run watch          # Watch mode for development
pnpm run lint           # Run ESLint
pnpm run test           # Run all tests
pnpm run unit-tests     # Run unit tests only
pnpm run build          # Build for production
pnpm run package        # Create VSIX package
```

## 🧪 Testing

### Unit Tests
```bash
pnpm run unit-tests     # Fast, isolated tests
```

### Integration Tests
```bash
pnpm run test           # Full VS Code extension tests
```

### Coverage
```bash
pnpm run test:coverage  # Generate coverage report
```

See [TESTING.md](docs/TESTING.md) for detailed testing information.

## 📋 Configuration

### VS Code Settings

```json
{
  "cuovare.defaultProvider": "anthropic",
  "cuovare.maxContextFiles": 50,
  "cuovare.autoIncludeOpenFiles": true,
  "cuovare.selectedModels": {
    "openai": "gpt-4o",
    "anthropic": "claude-3-5-sonnet-20241022",
    "groq": "llama-3.3-70b-versatile"
  },
  "cuovare.mcpServers": [
    {
      "name": "Database Tools",
      "command": "npx",
      "args": ["@modelcontextprotocol/server-postgres"]
    }
  ]
}
```

### Model Context Protocol (MCP)

Cuovare supports MCP servers for extending capabilities:

```json
{
  "cuovare.mcpServers": [
    {
      "name": "File System",
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "/path/to/project"]
    },
    {
      "name": "Git Tools", 
      "command": "npx",
      "args": ["@modelcontextprotocol/server-git"]
    }
  ]
}
```

## 🎯 Roadmap

### v0.1.0 - Core Features ✅
- [x] Multi-provider AI support
- [x] Basic context retrieval
- [x] Modern UI design
- [x] File referencing system

### v0.2.0 - Advanced Context 🚧
- [x] Semantic search engine
- [x] Intelligent code analysis
- [x] Comprehensive test suite
- [ ] Streaming responses

### v0.3.0 - Enhanced UX
- [ ] Voice input/output
- [ ] Custom model fine-tuning
- [ ] Advanced context filtering
- [ ] Plugin system

### v1.0.0 - Production Ready
- [ ] Performance optimizations
- [ ] Collaborative features
- [ ] Enterprise security
- [ ] Marketplace release

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

### Quick Contribution Guide

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Follow** our coding standards (ESLint + Prettier)
4. **Add** tests for new functionality
5. **Commit** with conventional commits: `feat: add amazing feature`
6. **Push** and create a **Pull Request**

### Development Guidelines

- **Code Style**: Follow existing TypeScript patterns
- **Testing**: All new features must include tests
- **Documentation**: Update docs for user-facing changes
- **Security**: Never commit API keys or sensitive data

## 📄 License

This project is licensed under the [MIT License](LICENSE) - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Sourcegraph Cody** - Inspiration for the AI coding assistant concept
- **VS Code Extension API** - Excellent platform for development tools
- **Anthropic, OpenAI, Groq** - Amazing AI providers
- **Model Context Protocol** - Future of AI tool integration

## 📞 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/your-org/cuovare/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/cuovare/discussions)
- **Discord**: [Join our community](https://discord.gg/cuovare)

---

<div align="center">

**[⭐ Star us on GitHub](https://github.com/your-org/cuovare)** • **[📦 VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=cuovare.cuovare)** • **[📖 Documentation](docs/)**

Made with ❤️ by the Cuovare team

</div>
