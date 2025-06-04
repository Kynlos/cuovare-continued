# 🚀 Cuovare - Advanced AI Coding Assistant

[![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-blue?logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=cuovare.cuovare)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)





## ✨ Features

### 🤖 Multi-Provider AI Support
- **OpenAI GPT-4o, GPT-4 Turbo** - Industry-leading language models
- **Anthropic Claude 3.5 Sonnet** - Advanced reasoning and code understanding  
- **Groq Llama 3.3 70B** - Ultra-fast inference with high quality
- **Grok (X.AI)** - Innovative AI with real-time capabilities
- **Google AI Gemini** - Latest 2.5 Flash & Pro models with advanced capabilities
- **Ollama** - Local model hosting with popular open-source models
- **Local/Custom** - Connect to any local API endpoint (LM Studio, etc.)
- **OpenRouter** - Access to 100+ AI models through one API
- **Custom Models** - Add and save custom models for any provider

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
- **Mobile-First** - Works perfectly in narrow sidebar widths
- **CDN Optimized** - Fast loading with reliable external resources

### 🔧 Advanced Capabilities
- **Enhanced MCP Tool Support** - Universal tool execution across all AI providers
- **@ File Referencing** - `@filename` or `@filename:1-150` for precise context
- **AI-Powered Git Commits** - Generate conventional commit messages with analysis
- **Agentic Code Actions** - Copy, apply, and create files directly from chat
- **Parallel Tool Execution** - Run multiple tools simultaneously with smart validation
- **Auto-Tool Detection** - AI automatically discovers and uses available tools
- **Chat History** - Persistent sessions across VS Code restarts
- **Real-time Server Monitoring** - Health status and auto-reconnection for MCP servers

### 🤖 Full Agent Mode ⭐ **NEW!**
- **Revolutionary Modular Tool System** - Dynamic tool discovery and LLM integration
- **True Autonomous Agent** - Actually executes tasks instead of just analyzing
- **Plug-and-Play Architecture** - Add new capabilities by simply creating tool files
- **Multi-Step Planning** - AI breaks down complex tasks into concrete, executable actions
- **File Operations** - Read, write, edit, create, and delete files autonomously
- **Terminal Commands** - Execute shell commands and build scripts safely
- **Code Search & Analysis** - Intelligent semantic search across your codebase
- **Git Automation** - Automated branching, commits, and repository management
- **Real-time Execution** - Progress tracking with error recovery and user oversight
- **Intelligent Task Understanding** - Understands user intent and creates deliverables
- **Safe Operations** - Built-in safeguards with workspace boundaries and command whitelisting
- **Extensible Design** - Easy to add new tools without modifying core agent logic

### 🛡️ Security & Privacy
- **Secure API Key Storage** - Uses VS Code's encrypted storage
- **API Key Management** - Easy add/remove functionality for each provider
- **Local Model Support** - Run models completely offline with Ollama
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
5. **Enable Agent Mode** - Click the purple robot icon (🤖) for autonomous coding assistance

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

#### Google AI (Gemini)
1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Generate an API key
3. Add to Cuovare settings: Your API key

#### Grok (X.AI)
1. Visit [X.AI Console](https://console.x.ai/)
2. Create an API key
3. Add to Cuovare settings: `xai-...`

#### Ollama (Local Models)
1. Install [Ollama](https://ollama.ai/)
2. Download models: `ollama pull llama3.2`
3. Start Ollama server: `ollama serve`
4. Select "Ollama" provider in Cuovare (no API key needed)

#### Local/Custom Endpoints
1. Set up your local API server (LM Studio, vLLM, etc.)
2. Select "Local/Custom" provider in Cuovare
3. Configure custom endpoint URL in settings if needed

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

### Git Workflow
```
[Use the git commit button in chat header for AI-generated commit messages]
```

### 🤖 Agent Mode Examples
```
# Documentation Creation
"Document the authentication system" → Reads auth files, creates comprehensive docs

# Feature Development  
"Create a new React component with TypeScript and tests" → Writes actual code files

# Bug Investigation & Fixes
"Fix the memory leak in data processing" → Identifies issue, implements solution

# Project Setup
"Set up a new microservice with Express and Docker" → Creates full project structure

# Code Refactoring
"Refactor authentication to use JWT tokens" → Modifies existing codebase safely

# Automated Analysis
"Review code quality and suggest improvements" → Analyzes and creates improvement plan
```

## 🏗️ Project Structure

```
cuovare/
├── src/
│   ├── extension.ts              # Main extension entry point
│   ├── providers/
│   │   ├── AIProviderManager.ts  # Multi-provider AI integration
│   │   └── ChatViewProvider.ts   # Webview UI and chat logic
│   ├── agent/
│   │   ├── AgentMode.ts          # Full Agent Mode orchestration
│   │   ├── ToolRegistry.ts       # Dynamic tool discovery and management
│   │   └── executors/            # Modular tool implementations
│   │       ├── FileOperationTool.ts  # File operations (read, write, create, delete)
│   │       ├── TerminalTool.ts       # Safe terminal command execution
│   │       ├── SearchTool.ts         # Code search and analysis
│   │       └── GitTool.ts            # Git operations and automation
│   ├── context/
│   │   ├── ContextRetrievalEngine.ts  # Advanced semantic search engine
│   │   ├── ContextIntegration.ts      # Integration layer for chat
│   │   └── FileContextManager.ts      # Basic file context management
│   └── mcp/
│       └── MCPManager.ts         # Model Context Protocol integration
├── resources/
│   ├── styles.css                # Modern UI styles with Tailwind
│   ├── main.js                   # Frontend JavaScript logic
│   └── icon.png                  # Extension icon
├── test/
│   ├── unit/                     # Unit tests (fast, isolated)
│   ├── context/                  # Integration tests (VS Code environment)
│   └── runUnitTests.js          # Custom test runner
├── docs/
│   ├── AGENT_MODE.md            # Complete Agent Mode documentation
│   ├── MODULAR_TOOL_SYSTEM.md  # Tool system architecture guide
│   ├── DEVELOPMENT.md           # Development setup and workflow
│   ├── TESTING.md              # Testing strategy and guides
│   └── CONTRIBUTING.md         # Contributor guidelines
└── package.json                # Extension manifest and dependencies
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
    "groq": "llama-3.3-70b-versatile",
    "google": "gemini-2.5-flash-preview-05-20",
    "grok": "grok-2-1212",
    "ollama": "llama3.2:latest",
    "local": "local-model"
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

### Enhanced Model Context Protocol (MCP)

Cuovare features a completely overhauled MCP implementation with universal tool support:

#### Basic Configuration
```json
{
  "cuovare.mcpServers": [
    {
      "name": "Filesystem Server",
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "/path/to/workspace"],
      "autoReconnect": true
    },
    {
      "name": "Database Server",
      "command": "python",
      "args": ["-m", "mcp_server_postgres"],
      "env": {
        "DATABASE_URL": "postgresql://user:pass@localhost/db"
      },
      "autoReconnect": true
    }
  ],
  "cuovare.toolsEnabled": true,
  "cuovare.autoExecuteTools": true,
  "cuovare.maxConcurrentToolExecutions": 5,
  "cuovare.toolExecutionTimeout": 30000
}
```

#### Tool Support by Provider
- **OpenAI**: Full function calling with `tools` and `tool_choice`
- **Anthropic**: Native tool use with `input_schema` validation
- **Groq**: Complete function calling support
- **Grok**: Tool descriptions in system prompts
- **Google AI**: Native function declarations with structured parameters
- **Ollama**: Basic tool support via system prompts
- **Local/Custom**: Basic tool support via system prompts
- **OpenRouter**: Model-specific tool support detection

#### Key Features
- 🔧 **Universal Tool Support** across all AI providers
- 🚀 **Parallel Execution** with configurable limits
- 🎯 **Smart Validation** using input schemas
- 💡 **Auto-Discovery** of tools from connected servers
- 📊 **Health Monitoring** with real-time status
- 🔄 **Auto-Reconnection** with intelligent backoff

See [Enhanced MCP Guide](docs/MCP_ENHANCED_GUIDE.md) for complete documentation.

## 🆕 Recent Updates

### v0.4.0 - Agent System ⭐ **LATEST!**
- **🚀 Modular Tool System**: Dynamic tool discovery and LLM integration for infinite extensibility
- **🤖 True Agent Behavior**: Agent now executes tasks instead of just providing information
- **🔧 Plug-and-Play Tools**: Add new capabilities by creating files in `/executors` directory
- **⚡ Enhanced Planning**: Improved AI planning that focuses on concrete deliverables
- **🛡️ Smart Safety**: Workspace boundaries, command whitelisting, and user oversight
- **📈 Better Task Understanding**: Agent properly interprets user intent and creates actual results

### v0.3.0 - Enhanced Context & Git Integration
- **✅ AI-Powered Git Commits**: Generate conventional commit messages with AI analysis
- **✅ Intelligent Context Engine**: Advanced semantic search that understands code concepts
- **✅ Multi-Workspace Support**: Properly handles multi-root VS Code workspaces
- **✅ Fixed @ File References**: Resolved file referencing with autocomplete and proper path resolution
- **✅ Context Scope Control**: Context engine now stays within project boundaries
- **✅ Message Update System**: Real-time context updates without duplicate messages

### v0.2.2 - Local Models & API Key Management
- **✅ Ollama Integration**: Run models locally with popular open-source models
- **✅ Local/Custom Provider**: Connect to any local API endpoint (LM Studio, vLLM, etc.)
- **✅ API Key Management**: Add remove buttons for easy key management
- **✅ Provider Switching Fix**: Fixed provider selection persistence across sessions

### v0.2.1 - Enhanced Stability & Google AI Support
- **✅ Fixed UI Issues**: Resolved JavaScript errors and SVG rendering problems
- **✅ Google AI Integration**: Added latest Gemini 2.5 Flash & Pro models with tool support
- **✅ Universal Custom Models**: Fixed custom model saving for all providers (not just Groq)
- **✅ MCP Display Fix**: Resolved server configuration display issues
- **✅ CDN Optimization**: Improved reliability with external resource loading

### Latest Model Support
- **Gemini 2.5 Flash Preview** - Best price-performance with adaptive thinking
- **Gemini 2.5 Pro Preview** - State-of-the-art reasoning for complex problems
- **Gemini 2.0 Flash** - Next generation with enhanced performance
- **Ollama Models** - llama3.2, codellama, mistral, gemma2, qwen2.5 and more
- **Custom Models** - Add and persist custom models across all providers
- **Local Endpoints** - Full compatibility with LM Studio and similar tools

## 🎯 Roadmap

### v0.1.0 - Core Features ✅
- [x] Multi-provider AI support
- [x] Basic context retrieval
- [x] Modern UI design
- [x] File referencing system

### v0.2.0 - Advanced Context ✅
- [x] Semantic search engine
- [x] Intelligent code analysis
- [x] Comprehensive test suite
- [x] Enhanced MCP support with universal tool execution
- [x] Google AI provider integration
- [x] Universal custom model support
- [x] Local model support (Ollama, LM Studio)
- [x] API key management improvements

### v0.3.0 - Enhanced UX ✅
- [x] AI-powered git commit generation
- [x] Multi-workspace support
- [x] Fixed @ file references with autocomplete
- [x] Context scope control
- [x] Real-time message updates
- [ ] Streaming responses

### v0.4.0 - Revolutionary Agent System ✅
- [x] **Full Agent Mode** - Complete autonomous coding assistant with workspace control
- [x] **Modular Tool System** - Dynamic tool discovery and infinite extensibility  
- [x] **True Agent Behavior** - Executes tasks instead of just providing information
- [x] **Plug-and-Play Architecture** - Add capabilities by creating tool files
- [x] **Smart Safety Controls** - Workspace boundaries and command whitelisting
- [x] **Multi-Step Planning** - AI breaks down complex tasks into executable actions
- [ ] **Streaming Responses** - Real-time token streaming for better UX
- [ ] **Multi-file Editing** - Edit multiple files simultaneously with AI coordination

### v0.5.0 - Enhanced Agent Capabilities
- [ ] **Advanced Code Review** - AI-powered code analysis with suggestions
- [ ] **Auto-testing Generation** - Generate unit tests for selected code
- [ ] **Code Refactoring Assistant** - Intelligent code restructuring suggestions
- [ ] **Real-time Error Detection** - Live code analysis with fix suggestions
- [ ] **Performance Optimization Scanner** - Identify and fix performance bottlenecks
- [ ] **Security Vulnerability Detection** - Scan code for security issues
- [ ] **Code Quality Metrics** - Complexity analysis and maintainability scores
- [ ] **Smart Import Management** - Auto-organize and optimize imports

### v0.6.0 - Workspace Intelligence
- [ ] **Documentation Generator** - Auto-generate docs from code comments and structure
- [ ] **Workspace-wide Search & Replace** - AI-powered find and replace across projects
- [ ] **Code Navigation Assistant** - Smart go-to-definition and reference finding
- [ ] **Project Scaffolding** - Generate new projects with best practices
- [ ] **Database Schema Understanding** - Visual database exploration and queries
- [ ] **API Documentation Integration** - Live API docs and endpoint testing

### v0.7.0 - Advanced Features
- [ ] **Voice Input/Output** - Talk to your AI coding assistant
- [ ] **Custom Model Fine-tuning** - Train models on your specific codebase
- [ ] **Advanced Context Filtering** - Smart context selection and prioritization
- [ ] **Code Snippets Library** - AI-curated reusable code templates
- [ ] **File Tree Manipulation** - Create, move, and organize files with AI
- [ ] **Collaborative Coding** - Real-time pair programming with AI

### v0.8.0 - Enterprise & Integration
- [ ] **CI/CD Pipeline Integration** - Connect with GitHub Actions, Jenkins, etc.
- [ ] **Advanced Plugin System** - Enhanced extensible architecture for custom tools
- [ ] **Enterprise SSO Support** - SAML, OAuth, and corporate authentication
- [ ] **Audit Logging** - Comprehensive activity tracking for compliance
- [ ] **Team Workspace Management** - Shared configurations and knowledge bases
- [ ] **Custom Model Hosting** - Self-hosted AI models for enterprise

### v0.9.0 - Professional Features
- [ ] **Advanced Formatting Engine** - Context-aware code formatting
- [ ] **Intelligent Auto-completion** - AI-powered code suggestions
- [ ] **Code Style Enforcement** - Automated style guide compliance
- [ ] **Performance Profiling** - Real-time performance analysis
- [ ] **Dependency Management** - Smart package updates and vulnerability checks
- [ ] **Cross-language Support** - Enhanced support for 20+ programming languages

### v1.0.0 - Production Ready
- [ ] **Performance Optimizations** - Sub-second response times
- [ ] **Enterprise Security** - SOC2, GDPR compliance
- [ ] **Marketplace Release** - Official VS Code Marketplace publication
- [ ] **Professional Support** - Dedicated support channels
- [ ] **Advanced Analytics** - Usage insights and productivity metrics
- [ ] **Mobile Companion App** - Code review and monitoring on mobile

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
- **Anthropic, OpenAI, Groq, Google AI, X.AI** - Amazing AI providers
- **Ollama & Open Source AI Community** - Making local AI accessible to everyone
- **Model Context Protocol** - Future of AI tool integration
- **Tailwind CSS & Highlight.js** - Beautiful UI components and syntax highlighting

## 📞 Support

- **Documentation**: [docs/](docs/)
  - **[🤖 Agent Mode Guide](docs/AGENT_MODE.md)** - Complete guide to autonomous AI development
  - **[🔧 MCP Integration](docs/MCP_ENHANCED_GUIDE.md)** - External tool setup and configuration
  - **[👩‍💻 Development Guide](docs/DEVELOPMENT.md)** - Contributing to Cuovare
- **Issues**: [GitHub Issues](https://github.com/Kynlos/cuovare/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Kynlos/cuovare/discussions)

---

<div align="center">

**[⭐ Star us on GitHub](https://github.com/Kynlos/cuovare)** • **[📦 VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=cuovare.cuovare)** • **[📖 Documentation](docs/)**

Made with ❤️ by the Cuovare team

</div>
