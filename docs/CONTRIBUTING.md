# 🤝 Contributing to Cuovare

Thank you for your interest in contributing to Cuovare! This guide will help you get started and ensure your contributions align with our project goals.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Contribution Types](#contribution-types)
- [Code Standards](#code-standards)
- [Pull Request Process](#pull-request-process)
- [Community Guidelines](#community-guidelines)

## 🤗 Code of Conduct

### Our Pledge

We pledge to make participation in Cuovare a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

**Positive behaviors include:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behaviors include:**
- Harassment, trolling, or derogatory comments
- Publishing others' private information
- Any conduct that could be considered inappropriate in a professional setting

### Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be reported to the project maintainers. All complaints will be reviewed and investigated promptly and fairly.

## 🚀 Getting Started

### Prerequisites

Before contributing, ensure you have:

1. **GitHub Account** - For submitting pull requests
2. **Development Environment** - See [DEVELOPMENT.md](DEVELOPMENT.md)
3. **Basic Knowledge** - TypeScript, VS Code extensions, AI/ML concepts

### First Contribution

1. **Star the Repository** ⭐
2. **Fork the Repository** 🍴
3. **Join our Discord** 💬 (optional but recommended)
4. **Look for Good First Issues** 🔍

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/cuovare.git
cd cuovare

# Add upstream remote
git remote add upstream https://github.com/original-org/cuovare.git

# Install dependencies
pnpm install

# Start development
pnpm run watch
```

## 🔄 Development Workflow

### Branch Strategy

We use **GitHub Flow** - a simple, branch-based workflow:

```bash
# Create feature branch from main
git checkout -b feature/awesome-feature

# Make changes and commit
git add .
git commit -m "feat: add awesome feature"

# Push to your fork
git push origin feature/awesome-feature

# Create Pull Request on GitHub
```

### Branch Naming

Use descriptive branch names with prefixes:

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test improvements
- `chore/` - Maintenance tasks

**Examples:**
- `feature/streaming-responses`
- `fix/context-retrieval-memory-leak`
- `docs/api-documentation-update`

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Format
<type>[optional scope]: <description>

# Examples
feat: add streaming response support
fix(context): resolve memory leak in file analysis
docs: update API documentation
test: add unit tests for context retrieval
refactor(ui): improve webview performance
chore: update dependencies
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting (no code changes)
- `refactor` - Code refactoring
- `test` - Adding tests
- `chore` - Maintenance

## 🎯 Contribution Types

### 🐛 Bug Reports

**Before submitting:**
- Search existing issues
- Check if it's already fixed in `main` branch
- Test with minimal reproduction case

**Bug Report Template:**
```markdown
## Bug Description
Brief description of the bug

## Steps to Reproduce
1. Step one
2. Step two
3. See error

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: Windows/Mac/Linux
- VS Code Version: 1.100.0
- Cuovare Version: 0.0.1
- AI Provider: OpenAI/Anthropic/etc.

## Additional Context
Screenshots, logs, etc.
```

### 💡 Feature Requests

**Before submitting:**
- Check if feature already exists
- Search existing feature requests
- Consider if it fits project scope

**Feature Request Template:**
```markdown
## Feature Description
Clear description of the feature

## Use Case
Why is this feature needed?

## Proposed Solution
How should it work?

## Alternatives Considered
Other approaches you've thought of

## Additional Context
Mockups, examples, etc.
```

### 📖 Documentation

Documentation contributions are highly valued:

- **Code Comments** - Improve inline documentation
- **README Updates** - Keep installation/usage current
- **Guides** - Add tutorials and examples
- **API Documentation** - Document public interfaces
- **Translations** - Internationalization support

### 🧪 Testing

Help improve our test coverage:

- **Unit Tests** - Test individual components
- **Integration Tests** - Test component interactions
- **Performance Tests** - Ensure efficiency
- **Edge Cases** - Test error conditions

### 🎨 UI/UX Improvements

Enhance user experience:

- **Visual Design** - Improve aesthetics
- **Accessibility** - Support screen readers, keyboard navigation
- **Responsive Design** - Optimize for different screen sizes
- **User Flows** - Streamline common workflows

## 📏 Code Standards

### TypeScript Guidelines

```typescript
// ✅ Good: Use explicit types
function calculateRelevance(file: ContextualFile, query: string): number {
    return file.relevanceScore;
}

// ❌ Bad: Implicit any types
function calculateRelevance(file, query) {
    return file.relevanceScore;
}

// ✅ Good: Use interfaces for complex types
interface SearchOptions {
    maxFiles: number;
    includeTests: boolean;
}

// ✅ Good: Use async/await
async function processFiles(): Promise<ContextualFile[]> {
    const files = await findFiles();
    return files.map(processFile);
}
```

### Code Style

We use **ESLint** and **Prettier** for consistent formatting:

```bash
# Check code style
pnpm run lint

# Fix automatically
pnpm run lint:fix

# Format code
pnpm run format
```

**Key principles:**
- **Consistent naming** - camelCase for variables, PascalCase for classes
- **Clear function names** - Describe what the function does
- **Small functions** - Keep functions focused and testable
- **Error handling** - Always handle potential errors
- **Comments** - Explain complex logic, not obvious code

### File Organization

```typescript
// File structure template
import * as vscode from 'vscode';  // External dependencies first
import { LocalType } from './types';  // Local imports second

// Constants at top
const DEFAULT_MAX_FILES = 50;

// Types and interfaces
export interface ComponentConfig {
    // ...
}

// Main class/function
export class ComponentName {
    private readonly config: ComponentConfig;
    
    constructor(config: ComponentConfig) {
        this.config = config;
    }
    
    // Public methods first
    public async process(): Promise<void> {
        // ...
    }
    
    // Private methods last
    private validateConfig(): boolean {
        // ...
    }
}
```

### Error Handling

```typescript
// ✅ Good: Specific error handling
try {
    const result = await riskyOperation();
    return result;
} catch (error) {
    if (error instanceof NetworkError) {
        console.error('Network operation failed:', error.message);
        return defaultValue;
    }
    throw error; // Re-throw unknown errors
}

// ✅ Good: Input validation
function processQuery(query: string): ProcessedQuery {
    if (!query || query.trim().length === 0) {
        throw new Error('Query cannot be empty');
    }
    
    return { processed: query.trim().toLowerCase() };
}
```

### Security Guidelines

```typescript
// ✅ Good: Secure API key handling
const apiKey = await context.secrets.get('cuovare.apiKey');

// ❌ Bad: Never log sensitive data
console.log('API Key:', apiKey); // NEVER DO THIS

// ✅ Good: Input sanitization
function sanitizeInput(input: string): string {
    return input.trim().replace(/[<>]/g, '');
}

// ✅ Good: Path validation
function validateFilePath(filePath: string, workspaceRoot: string): boolean {
    const resolvedPath = path.resolve(filePath);
    return resolvedPath.startsWith(workspaceRoot);
}
```

## 🔍 Pull Request Process

### Before Creating PR

1. **Test thoroughly**
   ```bash
   pnpm run test          # All tests pass
   pnpm run lint          # No linting errors
   pnpm run typecheck     # No TypeScript errors
   ```

2. **Update documentation**
   - Update README if needed
   - Add/update code comments
   - Update CHANGELOG.md

3. **Ensure clean history**
   ```bash
   # Rebase onto latest main
   git fetch upstream
   git rebase upstream/main
   
   # Squash commits if needed
   git rebase -i HEAD~3
   ```

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change (fix or feature that breaks existing functionality)
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] New tests added for new functionality

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or clearly documented)

## Screenshots (if applicable)
Add screenshots of UI changes

## Additional Notes
Any additional context or notes for reviewers
```

### Review Process

1. **Automated Checks**
   - Tests must pass
   - Linting must pass
   - TypeScript compilation must succeed

2. **Code Review**
   - At least one maintainer approval required
   - Address all feedback before merging
   - Request changes if standards not met

3. **Manual Testing**
   - Test in Extension Development Host
   - Verify no regressions
   - Test with different AI providers

### Merge Requirements

- ✅ All automated checks pass
- ✅ At least one approval from maintainer
- ✅ No unresolved conversations
- ✅ Branch is up-to-date with main
- ✅ Documentation updated (if needed)

## 🏆 Recognition

### Contributor Credits

We recognize contributors in multiple ways:

- **README Contributors Section** - All contributors listed
- **Release Notes** - Major contributions highlighted
- **Discord Recognition** - Special roles for active contributors
- **Annual Awards** - Outstanding contributor recognition

### Contribution Levels

1. **First-Time Contributor** 🌱
   - First merged PR
   - Welcome package and mentorship

2. **Regular Contributor** 🌿
   - 5+ merged PRs
   - Invitation to contributor Discord channel

3. **Core Contributor** 🌳
   - 20+ merged PRs or major feature
   - Review privileges on PRs

4. **Maintainer** 🏛️
   - Trusted long-term contributor
   - Full repository access

## 💬 Community Guidelines

### Communication Channels

- **GitHub Issues** - Bug reports, feature requests
- **GitHub Discussions** - General questions, ideas
- **Discord** - Real-time chat, development coordination
- **Email** - Security issues, private matters

### Response Times

- **Issues**: We aim to respond within 48 hours
- **PRs**: Initial review within 72 hours
- **Security Issues**: Response within 24 hours

### Getting Help

**For Development Questions:**
1. Check [DEVELOPMENT.md](DEVELOPMENT.md) and [TESTING.md](TESTING.md)
2. Search existing GitHub issues and discussions
3. Ask in Discord #development channel
4. Create a GitHub discussion

**For Bug Reports:**
1. Search existing issues
2. Create detailed bug report with template
3. Include minimal reproduction case

**For Feature Requests:**
1. Check roadmap and existing requests
2. Create feature request with template
3. Participate in discussion

## 🎯 Project Roadmap

### Current Focus Areas

1. **Core Stability** - Bug fixes, performance improvements
2. **Context Intelligence** - Enhanced semantic search
3. **User Experience** - UI/UX improvements
4. **Testing** - Comprehensive test coverage

### How to Get Involved

- **New Contributors**: Look for `good first issue` labels
- **Experienced Developers**: Tackle `help wanted` issues
- **AI/ML Experts**: Improve context retrieval algorithms
- **UI/UX Designers**: Enhance user interface and experience
- **Technical Writers**: Improve documentation

### Feature Priorities

**High Priority:**
- Streaming responses
- Enhanced context filtering
- Performance optimizations

**Medium Priority:**
- Voice input/output
- Custom model support
- Advanced debugging tools

**Low Priority:**
- Collaborative features
- Enterprise integrations
- Mobile support

## 📞 Contact

### Maintainers

- **Lead Maintainer**: [@username](https://github.com/username)
- **AI Specialist**: [@ai-expert](https://github.com/ai-expert)
- **UI/UX Lead**: [@ui-designer](https://github.com/ui-designer)

### Communication

- **General Questions**: [GitHub Discussions](https://github.com/org/cuovare/discussions)
- **Bug Reports**: [GitHub Issues](https://github.com/org/cuovare/issues)
- **Security Issues**: security@cuovare.dev
- **Discord**: [Join our server](https://discord.gg/cuovare)

---

## 🙏 Thank You

Your contributions make Cuovare better for everyone! Whether you're fixing a bug, adding a feature, improving documentation, or helping other users, every contribution is valuable.

**Ready to contribute?** 

1. ⭐ Star the repository
2. 🍴 Fork the project  
3. 🔍 Find an issue to work on
4. 💻 Start coding!

---

*Happy contributing! 🚀*
