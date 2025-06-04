# 🛠️ Modular Tool System Architecture

The Cuovare Agent features a revolutionary modular tool system that provides enterprise-grade development capabilities through dynamically discovered tools. This document provides a comprehensive guide to understanding, using, and extending the tool system.

## 🏗️ Architecture Overview

### Core Components

```
src/agent/
├── ToolRegistry.ts       # Central tool discovery and management
├── AgentMode.ts         # Tool orchestration and execution
└── executors/           # Individual tool implementations
    ├── DebuggingTool.ts      # 🐛 Debugging & profiling
    ├── DatabaseTool.ts       # 🗄️ Database operations
    ├── APITool.ts            # 🌐 API development
    ├── SecurityTool.ts       # 🛡️ Security analysis
    ├── PerformanceTool.ts    # ⚡ Performance optimization
    ├── DeploymentTool.ts     # 🚀 Infrastructure & deployment
    ├── PackageManagerTool.ts # 📦 Dependency management
    ├── WebScrapingTool.ts    # 🌍 Web content extraction
    ├── FileOperationTool.ts  # 📁 Enhanced file operations
    ├── TerminalTool.ts       # 💻 Terminal commands
    ├── SearchTool.ts         # 🔍 Code search
    └── GitTool.ts            # 🔄 Git operations
```

### ToolExecutor Interface

All tools implement the standardized `ToolExecutor` interface:

```typescript
interface ToolExecutor {
  readonly name: string;
  readonly description: string;
  readonly methods: Record<string, MethodDefinition>;
  execute(method: string, args: Record<string, any>): Promise<ToolResult>;
}
```

## 🛠️ Comprehensive Tool Suite

### 🐛 DebuggingTool
**Advanced debugging and code analysis capabilities**

#### Key Methods
- `setBreakpoint` - Set breakpoints with optional conditions
- `analyzeError` - Parse error messages and stack traces
- `findDeadCode` - Identify unused code and functions
- `analyzePerformance` - Profile code performance bottlenecks
- `inspectVariable` - Variable inspection during debugging
- `findMemoryLeaks` - Detect memory leak patterns
- `validateTypes` - TypeScript type validation

#### Example Usage
```typescript
// Set a conditional breakpoint
await debuggingTool.execute('setBreakpoint', {
  filePath: 'src/auth.ts',
  lineNumber: 42,
  condition: 'user.id === null'
});

// Analyze memory usage patterns
await debuggingTool.execute('findMemoryLeaks', {
  filePath: 'src/dataProcessor.ts'
});
```

### 🗄️ DatabaseTool
**Complete database lifecycle management**

#### Key Methods
- `generateSchema` - Generate DB schema from TypeScript interfaces
- `generateMigration` - Create database migration files
- `generateORM` - Generate ORM models (TypeORM, Prisma, Sequelize)
- `optimizeQuery` - Analyze and optimize SQL queries
- `generateSeeds` - Create seed data files
- `createRepository` - Generate repository pattern implementation
- `generateAPI` - Generate REST API from schema

#### Example Usage
```typescript
// Generate schema from TypeScript interfaces
await databaseTool.execute('generateSchema', {
  filePath: 'src/models/User.ts',
  dbType: 'postgresql'
});

// Create optimized migration
await databaseTool.execute('generateMigration', {
  migrationName: 'add_user_profiles',
  operations: 'Add user profile table with relationships'
});
```

### 🌐 APITool
**Complete API development and testing suite**

#### Key Methods
- `testEndpoint` - Test API endpoints with various HTTP methods
- `generateOpenAPI` - Generate OpenAPI specs from routes
- `generateClient` - Generate API client code (TypeScript, Python, Java)
- `mockServer` - Create mock servers from OpenAPI specs
- `testSuite` - Generate comprehensive test suites
- `loadTest` - Perform load testing on endpoints
- `generatePostman` - Create Postman collections
- `analyzeAPI` - Analyze APIs for best practices

#### Example Usage
```typescript
// Test an API endpoint
await apiTool.execute('testEndpoint', {
  url: 'https://api.example.com/users',
  method: 'POST',
  body: { name: 'John Doe' },
  auth: { type: 'bearer', token: 'xyz123' }
});

// Generate TypeScript client
await apiTool.execute('generateClient', {
  specPath: 'api/openapi.yaml',
  language: 'typescript',
  outputDir: 'src/api-client'
});
```

### 🛡️ SecurityTool
**Comprehensive security analysis and vulnerability detection**

#### Key Methods
- `scanVulnerabilities` - Scan code for security vulnerabilities
- `findSecrets` - Detect exposed secrets and API keys
- `auditDependencies` - Audit dependencies for known vulnerabilities
- `generateSecurityHeaders` - Generate security header configurations
- `validateInputSanitization` - Check input validation patterns
- `generateCSP` - Create Content Security Policy configurations
- `sqlInjectionScan` - Scan for SQL injection vulnerabilities
- `xssAnalysis` - Analyze for XSS vulnerabilities

#### Example Usage
```typescript
// Comprehensive vulnerability scan
await securityTool.execute('scanVulnerabilities', {
  filePath: 'src/',
  scanType: 'full'
});

// Generate CSP policy
await securityTool.execute('generateCSP', {
  appType: 'spa',
  strictness: 'strict'
});
```

### ⚡ PerformanceTool
**Performance optimization and monitoring**

#### Key Methods
- `analyzeBundle` - Analyze bundle size and dependencies
- `profileCode` - Profile code performance and complexity
- `optimizeImages` - Analyze and optimize image assets
- `analyzeMemoryUsage` - Memory usage pattern analysis
- `generateLighthouse` - Create Lighthouse performance configs
- `webVitals` - Generate Web Vitals monitoring setup
- `lazyLoading` - Identify lazy loading opportunities
- `treeShaking` - Analyze tree shaking effectiveness

#### Example Usage
```typescript
// Analyze bundle performance
await performanceTool.execute('analyzeBundle', {
  buildDir: 'dist/',
  framework: 'webpack'
});

// Generate Web Vitals monitoring
await performanceTool.execute('webVitals', {
  framework: 'react'
});
```

### 🚀 DeploymentTool
**Complete DevOps and infrastructure automation**

#### Key Methods
- `generateDockerfile` - Generate optimized Dockerfiles
- `createDockerCompose` - Create multi-service Docker Compose configs
- `generateCI` - Generate CI/CD pipeline configurations
- `kubernetesConfig` - Generate Kubernetes deployment manifests
- `helmChart` - Create Helm charts for Kubernetes
- `terraformConfig` - Generate Terraform infrastructure code
- `nginxConfig` - Generate Nginx reverse proxy configurations
- `monitoringSetup` - Set up monitoring with Prometheus/Grafana

#### Example Usage
```typescript
// Generate Dockerfile
await deploymentTool.execute('generateDockerfile', {
  projectType: 'node',
  port: 3000
});

// Create Kubernetes configuration
await deploymentTool.execute('kubernetesConfig', {
  appName: 'myapp',
  replicas: 3,
  namespace: 'production'
});
```

### 📦 PackageManagerTool
**Advanced dependency and project management**

#### Key Methods
- `analyzePackages` - Comprehensive dependency analysis
- `updateDependencies` - Generate safe update strategies
- `findUnused` - Identify unused dependencies
- `licenseAudit` - Audit package licenses for compliance
- `duplicateAnalysis` - Find duplicate dependencies
- `cleanupProject` - Clean up project files and caches
- `bundleAnalysis` - Analyze package bundle impact
- `migratePackageManager` - Generate migration scripts
- `validatePackages` - Validate package.json structure

#### Example Usage
```typescript
// Comprehensive package analysis
await packageTool.execute('analyzePackages', {
  packageFile: 'package.json'
});

// Find and remove unused dependencies
await packageTool.execute('findUnused', {
  directory: 'src/'
});
```

### 🌍 WebScrapingTool
**Intelligent web content extraction with domain security**

#### Key Methods
- `scrapeUrl` - Scrape content from allowed documentation domains
- `extractUrls` - Extract URLs from user text with domain filtering
- `scrapeMultiple` - Scrape multiple URLs with content aggregation

#### Example Usage
```typescript
// Scrape documentation content
await webScrapingTool.execute('scrapeUrl', {
  url: 'https://docs.microsoft.com/api-guide',
  maxLength: 5000,
  includeCodeExamples: true
});

// Extract and scrape URLs from user prompt
await webScrapingTool.execute('extractUrls', {
  text: 'Check out https://react.dev/learn and https://nodejs.org/docs'
});
```

### 📁 Enhanced FileOperationTool
**Advanced file operations with intelligent editing**

#### Key Methods
- `read` - Read file contents
- `write` / `create` - Write or create new files
- `edit` - Advanced editing with find/replace, line insertion, positioning
- `copy` / `move` - File management operations
- `delete` - Safe file deletion

#### Example Usage
```typescript
// Advanced find/replace editing
await fileOperationTool.execute('edit', {
  filePath: 'src/app.ts',
  searchText: 'console.log',
  replaceText: 'logger.info'
});

// Insert content at specific line
await fileOperationTool.execute('edit', {
  filePath: 'src/utils.ts',
  content: 'import { Logger } from "./logger";',
  lineNumber: 1
});

// Append content to end of file
await fileOperationTool.execute('edit', {
  filePath: 'README.md',
  content: '\n## New Section\nAdditional documentation...',
  insertAt: 'end'
});
```

## 🔧 Tool Discovery System

### Automatic Discovery
The `ToolRegistry` automatically discovers all tools in the `src/agent/executors/` directory:

```typescript
class ToolRegistry {
  private async discoverTools(): Promise<void> {
    const executorsDir = path.join(__dirname, 'executors');
    const files = await fs.readdir(executorsDir);
    
    for (const file of files) {
      if (file.endsWith('Tool.ts')) {
        const toolModule = await import(path.join(executorsDir, file));
        const ToolClass = Object.values(toolModule)[0] as any;
        const tool = new ToolClass();
        this.tools.set(tool.name, tool);
      }
    }
  }
}
```

### Tool Registration
Tools are automatically registered and made available to the AI agent:

```typescript
const registry = new ToolRegistry();
await registry.initialize();

// Tools are now available for AI execution
const availableTools = registry.getAllTools();
```

## 🤖 Agent Integration

### Tool Selection
The AI agent automatically selects appropriate tools based on user requests:

```typescript
// User: "Analyze the security of my authentication system"
// Agent selects: SecurityTool.scanVulnerabilities + SecurityTool.checkAuthentication

// User: "Optimize my app's performance"  
// Agent selects: PerformanceTool.analyzeBundle + PerformanceTool.profileCode
```

### Multi-Tool Execution
Tools can be executed in parallel or sequence:

```typescript
// Parallel execution for independent tasks
await Promise.all([
  securityTool.execute('findSecrets', { directory: 'src/' }),
  performanceTool.execute('analyzeBundle', { buildDir: 'dist/' }),
  packageTool.execute('findUnused', { directory: 'src/' })
]);

// Sequential execution for dependent tasks
const schema = await databaseTool.execute('generateSchema', { filePath: 'models.ts' });
const api = await apiTool.execute('generateAPI', { schemaFile: schema.result });
```

## 🔌 Extending the Tool System

### Creating a New Tool

1. **Create the Tool File**
```typescript
// src/agent/executors/CustomTool.ts
import { ToolExecutor, ToolResult } from '../ToolRegistry';

export class CustomTool implements ToolExecutor {
  readonly name = 'custom';
  readonly description = 'Custom tool functionality';

  readonly methods = {
    'customMethod': {
      description: 'Performs custom operation',
      parameters: {
        input: { type: 'string', description: 'Input parameter' }
      }
    }
  };

  async execute(method: string, args: Record<string, any>): Promise<ToolResult> {
    switch (method) {
      case 'customMethod':
        return await this.customMethod(args.input);
      default:
        return { success: false, error: `Unknown method: ${method}` };
    }
  }

  private async customMethod(input: string): Promise<ToolResult> {
    // Implement custom logic
    return {
      success: true,
      result: `Processed: ${input}`
    };
  }
}
```

2. **Tool Auto-Discovery**
The tool will be automatically discovered and loaded by the `ToolRegistry` on the next restart.

3. **AI Integration**
The AI agent will automatically have access to the new tool and its methods.

### Best Practices for Tool Development

#### Error Handling
```typescript
async execute(method: string, args: Record<string, any>): Promise<ToolResult> {
  try {
    // Tool logic
    return { success: true, result: 'Success' };
  } catch (error) {
    return {
      success: false,
      error: `Error executing ${method}: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
```

#### Parameter Validation
```typescript
readonly methods = {
  'methodName': {
    description: 'Clear description of what the method does',
    parameters: {
      required_param: { 
        type: 'string', 
        description: 'Clear parameter description' 
      },
      optional_param: { 
        type: 'number', 
        description: 'Optional parameter', 
        optional: true 
      }
    }
  }
};
```

#### File Operations
```typescript
// Always use workspace-relative paths
const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
const filePath = path.join(workspaceFolder.uri.fsPath, relativePath);

// Handle file access safely
try {
  await fs.access(filePath);
  const content = await fs.readFile(filePath, 'utf8');
} catch (error) {
  return { success: false, error: 'File not accessible' };
}
```

## 📊 Tool Statistics

### Current Implementation
- **13 Tools** - Complete development workflow coverage with internet access
- **10,000+ Lines** - Enterprise-grade implementation
- **130+ Methods** - Comprehensive functionality including web research
- **Auto-Discovery** - Zero-configuration tool loading
- **Type Safety** - Full TypeScript implementation
- **Error Handling** - Robust error recovery and reporting
- **Domain Security** - Whitelisted web scraping for safe internet access

### Tool Method Breakdown
| Tool | Methods | Lines of Code | Primary Focus |
|------|---------|---------------|---------------|
| DebuggingTool | 12 | ~1,200 | Debugging & profiling |
| DatabaseTool | 10 | ~1,500 | Database lifecycle |
| APITool | 10 | ~1,800 | API development |
| SecurityTool | 12 | ~1,600 | Security analysis |
| PerformanceTool | 12 | ~1,400 | Performance optimization |
| DeploymentTool | 12 | ~1,800 | DevOps & infrastructure |
| PackageManagerTool | 12 | ~1,200 | Dependency management |
| WebScrapingTool | 3 | ~400 | Web content extraction |
| Enhanced FileOperationTool | 7 | ~500 | Advanced file operations |

## 🚀 Future Enhancements

### Planned Tool Additions
- **TestingTool** - Comprehensive test generation and execution
- **DocumentationTool** - Automated documentation generation
- **RefactoringTool** - Intelligent code refactoring
- **AnalyticsTool** - Code metrics and analysis
- **IntegrationTool** - Third-party service integrations
- **MLTool** - Machine learning model integration

### Advanced Features
- **Tool Composition** - Combine multiple tools for complex workflows
- **Tool Templates** - Pre-configured tool chains for common tasks
- **Custom Tool Marketplace** - Share and discover community tools
- **Tool Monitoring** - Performance metrics and usage analytics
- **Dynamic Tool Loading** - Hot-reload tools without restart

## 🛡️ Security Considerations

### Safe Execution
- **Workspace Boundaries** - Tools operate only within the current workspace
- **Command Whitelisting** - Terminal commands are validated before execution
- **File Access Control** - Restricted to workspace and temporary directories
- **Input Validation** - All tool inputs are validated and sanitized
- **Domain Whitelisting** - Web scraping restricted to approved documentation sites

### Secret Management
- **No Secret Logging** - Sensitive data is never logged or stored
- **Environment Variables** - Secrets accessed through environment variables
- **Secure Storage** - Uses VS Code's encrypted storage for API keys

### Web Security
- **Domain Restriction** - Only 50+ approved documentation domains allowed
- **Content Filtering** - HTML/CSS/JS stripped while preserving code examples
- **Size Limits** - 5000 character limit prevents memory exhaustion
- **Timeout Protection** - 10-second request timeout prevents hanging

## 📖 Documentation Links

- **[Agent Mode Guide](AGENT_MODE.md)** - Complete autonomous agent documentation
- **[Development Guide](DEVELOPMENT.md)** - Setting up development environment
- **[Testing Guide](TESTING.md)** - Testing strategies and guidelines
- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute new tools

---

The Modular Tool System represents the future of AI-assisted development, providing enterprise-grade capabilities through a clean, extensible architecture that grows with your needs.
