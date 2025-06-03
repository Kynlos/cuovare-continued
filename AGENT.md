# Cuovare Development Guide

## Project Structure

```
cuovare/
├── src/
│   ├── extension.ts              # Main extension entry point
│   ├── providers/
│   │   ├── AIProviderManager.ts  # Multi-provider AI integration
│   │   └── ChatViewProvider.ts   # Webview UI and chat logic
│   ├── context/
│   │   ├── ContextRetrievalEngine.ts  # Advanced semantic search engine
│   │   ├── ContextIntegration.ts      # Integration layer for chat
│   │   └── FileContextManager.ts      # Basic codebase understanding
│   └── mcp/
│       └── MCPManager.ts         # Model Context Protocol integration
├── resources/
│   ├── styles.css                # Beautiful modern UI styles (Tailwind-based)
│   ├── main.js                   # Frontend JavaScript logic
│   └── icon.png                  # Extension icon
├── test/
│   ├── unit/                     # Unit tests (fast, isolated)
│   ├── context/                  # Integration tests (VS Code environment)
│   └── runUnitTests.js          # Custom test runner
├── docs/
│   ├── DEVELOPMENT.md           # Development setup and workflow
│   ├── TESTING.md              # Testing strategy and guides
│   └── CONTRIBUTING.md         # Contributor guidelines
├── package.json                  # Extension manifest and dependencies
└── tsconfig.json                 # TypeScript configuration
```

## Key Commands

### Development
```bash
pnpm install           # Install dependencies
pnpm run compile       # Compile TypeScript
pnpm run watch         # Watch mode for development
pnpm run lint          # Run ESLint
pnpm run test          # Run all tests (VS Code integration tests)
pnpm run unit-tests    # Run unit tests only (fast)
```

### Build & Package
```bash
pnpm run vscode:prepublish  # Prepare for publishing
vsce package               # Create .vsix package
vsce publish               # Publish to marketplace
```

## Architecture Overview

### Core Components

1. **Extension Main (`extension.ts`)**
   - Registers commands and webview provider
   - Initializes all managers
   - Handles VS Code lifecycle

2. **AI Provider Manager (`AIProviderManager.ts`)**
   - Supports OpenAI, Anthropic, Groq, Grok, OpenRouter
   - Handles API key management
   - Formats requests/responses per provider

3. **Chat View Provider (`ChatViewProvider.ts`)**
   - Manages webview UI
   - Handles user interactions
   - Coordinates between AI and context managers

4. **Context Retrieval Engine (`ContextRetrievalEngine.ts`)**
   - Advanced semantic search with concept expansion
   - Multi-language code analysis (TypeScript, JavaScript, Python, Java)
   - Smart relevance scoring and file prioritization
   - Performance-optimized with configurable limits

5. **Context Integration (`ContextIntegration.ts`)**
   - Integration layer between context engine and chat system
   - Handles @ file referencing with line ranges
   - Provides autocomplete suggestions for files/functions
   - Formats context for AI provider consumption

6. **File Context Manager (`FileContextManager.ts`)**
   - Basic file context and project analysis
   - Legacy context system (being phased out)
   - Simple file prioritization and content extraction

7. **MCP Manager (`MCPManager.ts`)**
   - Manages Model Context Protocol servers
   - Handles tool discovery and execution
   - Enables external integrations

### Key Features

- **Multi-Provider Support**: Seamlessly switch between AI providers
- **Intelligent Context**: Automatically includes relevant project files
- **Beautiful UI**: Modern, responsive design with code highlighting
- **MCP Integration**: Extend capabilities with external tools
- **Security**: API keys stored securely in VS Code

## Configuration

### Settings Schema
```json
{
  "cuovare.apiKeys": {
    "openai": "sk-...",
    "anthropic": "sk-ant-...",
    "groq": "gsk_...",
    "grok": "xai-...",
    "openrouter": "sk-or-..."
  },
  "cuovare.defaultProvider": "anthropic",
  "cuovare.mcpServers": [
    {
      "name": "Database Tools",
      "command": "npx",
      "args": ["@modelcontextprotocol/server-postgres"]
    }
  ],
  "cuovare.maxContextFiles": 50,
  "cuovare.autoIncludeOpenFiles": true
}
```

## Development Guidelines

### Code Style
- Use TypeScript strict mode
- Follow VS Code extension best practices
- Maintain clean separation of concerns
- Add proper error handling
- Use async/await for all async operations

### Testing
- Test with multiple AI providers
- Verify context gathering works correctly
- Test MCP server integration
- Ensure UI is responsive and accessible

### Security
- Never log API keys
- Store sensitive data in VS Code secure storage
- Validate all user inputs
- Use HTTPS for all API calls

## Adding New AI Providers

1. Add provider configuration in `AIProviderManager.ts`
2. Update package.json settings schema
3. Add UI elements in webview
4. Test API integration thoroughly

Example provider addition:
```typescript
this.providers.set('newprovider', {
    name: 'New Provider',
    baseUrl: 'https://api.newprovider.com/v1/chat',
    models: ['model-1', 'model-2'],
    headers: (apiKey: string) => ({
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    }),
    formatRequest: (messages: Message[], model: string) => ({
        model,
        messages,
        stream: false
    }),
    parseResponse: (response: any) => response.data.choices[0].message.content
});
```

## Troubleshooting

### Common Issues
1. **Compilation errors**: Check TypeScript strict mode compliance
2. **Webview not loading**: Verify CSP settings and resource URIs
3. **API errors**: Check API key configuration and provider status
4. **Context issues**: Verify workspace folder access and file permissions

### Debug Mode
- Use `console.log` statements (visible in VS Code Developer Tools)
- Enable VS Code extension development logging
- Test with minimal configuration first

## Future Enhancements

### Planned Features
- [ ] Streaming responses for better UX
- [ ] Custom model fine-tuning support
- [ ] Advanced context filtering
- [ ] Plugin system for custom providers
- [ ] Collaborative features
- [ ] Voice input/output
- [ ] Code generation templates
- [ ] Automated testing suggestions

### Technical Debt
- [ ] Add comprehensive unit tests
- [ ] Improve error handling and user feedback
- [ ] Optimize bundle size
- [ ] Add telemetry (opt-in)
- [ ] Implement proper logging system

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Run full test suite
4. Build and test .vsix package
5. Publish to marketplace
6. Create GitHub release with notes

## Support & Contributing

- Report issues on GitHub
- Follow conventional commit messages
- Add tests for new features
- Update documentation
- Respect code style guidelines

---

*This extension represents the cutting edge of AI-assisted development in VS Code. Every feature is designed to enhance developer productivity while maintaining the highest standards of security and user experience.*
