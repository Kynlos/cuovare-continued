import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ToolExecutor, ToolResult, ToolMetadata } from '../ToolRegistry';

interface ProjectTemplate {
    name: string;
    description: string;
    type: string;
    language: string;
    framework?: string;
    structure: FileStructure[];
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
    config?: Record<string, any>;
}

interface FileStructure {
    path: string;
    type: 'file' | 'directory';
    content?: string;
    template?: string;
    executable?: boolean;
}

interface ScaffoldOptions {
    projectName: string;
    targetDirectory: string;
    includeTests: boolean;
    includeDocs: boolean;
    includeCI: boolean;
    includeDocker: boolean;
    gitInit: boolean;
    installDependencies: boolean;
    lintingSetup: boolean;
    formattingSetup: boolean;
}

export class ProjectScaffoldingTool implements ToolExecutor {
    public metadata: ToolMetadata = {
        name: 'ProjectScaffoldingTool',
        description: 'Generate new projects with best practices and modern tooling',
        category: 'Project Management',
        parameters: [
            { name: 'action', description: 'create-project | list-templates | create-template | add-feature', required: true, type: 'string' },
            { name: 'template', description: 'Project template name or type', required: false, type: 'string' },
            { name: 'projectName', description: 'Name of the new project', required: false, type: 'string' },
            { name: 'language', description: 'Programming language (typescript, javascript, python, java, etc.)', required: false, type: 'string' },
            { name: 'framework', description: 'Framework to use (react, vue, express, fastapi, spring, etc.)', required: false, type: 'string' },
            { name: 'features', description: 'Additional features (testing, docs, ci, docker, etc.)', required: false, type: 'string' },
            { name: 'includeTests', description: 'Include test setup (boolean)', required: false, type: 'boolean' },
            { name: 'includeCI', description: 'Include CI/CD configuration (boolean)', required: false, type: 'boolean' }
        ],
        examples: [
            'Create React project: { "action": "create-project", "template": "react-typescript", "projectName": "my-app" }',
            'List templates: { "action": "list-templates", "language": "typescript" }',
            'Add features: { "action": "add-feature", "features": "testing,ci,docker" }'
        ]
    };

    private templates: Map<string, ProjectTemplate> = new Map();

    constructor() {
        this.initializeTemplates();
    }

    async execute(params: any, context: { workspaceRoot: string; outputChannel: any; onProgress?: (message: string) => void }): Promise<ToolResult> {
        const { 
            action, template, projectName, targetDir, language, framework, features,
            includeTests, includeDocs, includeCI, includeDocker, gitInit, installDeps
        } = params;

        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder && !targetDir) {
                return { success: false, message: 'No workspace folder found and no target directory specified' };
            }

            const baseDir = targetDir || workspaceFolder!.uri.fsPath;

            const options: ScaffoldOptions = {
                projectName: projectName || 'new-project',
                targetDirectory: baseDir,
                includeTests: includeTests !== false,
                includeDocs: includeDocs !== false,
                includeCI: includeCI !== false,
                includeDocker: includeDocker !== false,
                gitInit: gitInit !== false,
                installDependencies: installDeps !== false,
                lintingSetup: true,
                formattingSetup: true
            };

            switch (action) {
                case 'create-project':
                    return await this.createProject(template, language, framework, features, options);
                case 'list-templates':
                    return await this.listTemplates(language, framework);
                case 'create-template':
                    return await this.createCustomTemplate(params);
                case 'add-feature':
                    return await this.addFeature(features, options);
                default:
                    return await this.createProject(template, language, framework, features, options);
            }
        } catch (error) {
            return { 
                success: false, 
                message: `Project scaffolding failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async createProject(template: string, language?: string, framework?: string, features?: string, options?: ScaffoldOptions): Promise<ToolResult> {
        if (!options) {
            return { success: false, message: 'No options provided' };
        }

        // Determine template to use
        let projectTemplate = this.getTemplate(template, language, framework);
        if (!projectTemplate) {
            projectTemplate = await this.generateTemplate(language, framework, features);
        }

        // Create project directory
        const projectPath = path.join(options.targetDirectory, options.projectName);
        await fs.promises.mkdir(projectPath, { recursive: true });

        const createdFiles: string[] = [];
        const errors: string[] = [];

        try {
            // Create directory structure
            for (const item of projectTemplate.structure) {
                const itemPath = path.join(projectPath, item.path);
                
                if (item.type === 'directory') {
                    await fs.promises.mkdir(itemPath, { recursive: true });
                } else {
                    // Ensure parent directory exists
                    await fs.promises.mkdir(path.dirname(itemPath), { recursive: true });
                    
                    // Generate file content
                    const content = await this.generateFileContent(item, projectTemplate, options);
                    await fs.promises.writeFile(itemPath, content);
                    
                    if (item.executable) {
                        await fs.promises.chmod(itemPath, '755');
                    }
                    
                    createdFiles.push(path.relative(options.targetDirectory, itemPath));
                }
            }

            // Create package.json or equivalent
            await this.createProjectManifest(projectPath, projectTemplate, options);
            createdFiles.push('package.json');

            // Create configuration files
            await this.createConfigFiles(projectPath, projectTemplate, options);

            // Initialize git repository
            if (options.gitInit) {
                await this.initializeGit(projectPath);
                createdFiles.push('.git');
            }

            // Install dependencies
            if (options.installDependencies) {
                await this.installDependencies(projectPath, projectTemplate);
            }

        } catch (error) {
            errors.push(`Error creating project: ${error instanceof Error ? error.message : String(error)}`);
        }

        const result = {
            projectName: options.projectName,
            projectPath,
            template: projectTemplate.name,
            createdFiles,
            errors,
            nextSteps: this.generateNextSteps(projectTemplate, options)
        };

        const message = errors.length > 0 
            ? `Project created with ${errors.length} errors. Created ${createdFiles.length} files.`
            : `Successfully created ${projectTemplate.name} project '${options.projectName}' with ${createdFiles.length} files`;

        return {
            success: errors.length === 0,
            message,
            data: result
        };
    }

    private async listTemplates(language?: string, framework?: string): Promise<ToolResult> {
        const allTemplates = Array.from(this.templates.values());
        
        let filteredTemplates = allTemplates;
        if (language) {
            filteredTemplates = filteredTemplates.filter(t => t.language.toLowerCase() === language.toLowerCase());
        }
        if (framework) {
            filteredTemplates = filteredTemplates.filter(t => t.framework?.toLowerCase() === framework.toLowerCase());
        }

        const templateList = filteredTemplates.map(t => ({
            name: t.name,
            description: t.description,
            type: t.type,
            language: t.language,
            framework: t.framework
        }));

        return {
            success: true,
            message: `Found ${templateList.length} available templates`,
            data: {
                totalTemplates: allTemplates.length,
                filteredTemplates: templateList.length,
                templates: templateList,
                filters: { language, framework }
            }
        };
    }

    private async createCustomTemplate(params: Record<string, any>): Promise<ToolResult> {
        // TODO: Implement custom template creation
        return {
            success: false,
            message: 'Custom template creation not yet implemented'
        };
    }

    private async addFeature(features: string, options: ScaffoldOptions): Promise<ToolResult> {
        if (!features) {
            return { success: false, message: 'No features specified' };
        }

        const featureList = features.split(',').map(f => f.trim());
        const addedFeatures: string[] = [];
        const errors: string[] = [];

        for (const feature of featureList) {
            try {
                const success = await this.addSingleFeature(feature, options);
                if (success) {
                    addedFeatures.push(feature);
                } else {
                    errors.push(`Failed to add feature: ${feature}`);
                }
            } catch (error) {
                errors.push(`Error adding ${feature}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        return {
            success: errors.length === 0,
            message: `Added ${addedFeatures.length} features, ${errors.length} errors`,
            data: {
                addedFeatures,
                errors,
                targetDirectory: options.targetDirectory
            }
        };
    }

    private initializeTemplates(): void {
        // React TypeScript Template
        this.templates.set('react-typescript', {
            name: 'React TypeScript',
            description: 'Modern React application with TypeScript, Vite, and best practices',
            type: 'web-app',
            language: 'typescript',
            framework: 'react',
            structure: [
                { path: 'src', type: 'directory' },
                { path: 'src/components', type: 'directory' },
                { path: 'src/hooks', type: 'directory' },
                { path: 'src/utils', type: 'directory' },
                { path: 'src/types', type: 'directory' },
                { path: 'src/App.tsx', type: 'file', template: 'react-app' },
                { path: 'src/main.tsx', type: 'file', template: 'react-main' },
                { path: 'src/App.css', type: 'file', template: 'react-css' },
                { path: 'src/index.css', type: 'file', template: 'react-index-css' },
                { path: 'src/vite-env.d.ts', type: 'file', template: 'vite-env' },
                { path: 'public', type: 'directory' },
                { path: 'public/vite.svg', type: 'file', template: 'vite-svg' },
                { path: 'index.html', type: 'file', template: 'react-index-html' },
                { path: 'vite.config.ts', type: 'file', template: 'vite-config' },
                { path: 'tsconfig.json', type: 'file', template: 'react-tsconfig' },
                { path: 'tsconfig.node.json', type: 'file', template: 'react-tsconfig-node' }
            ],
            dependencies: {
                'react': '^18.2.0',
                'react-dom': '^18.2.0'
            },
            devDependencies: {
                '@types/react': '^18.2.43',
                '@types/react-dom': '^18.2.17',
                '@typescript-eslint/eslint-plugin': '^6.14.0',
                '@typescript-eslint/parser': '^6.14.0',
                '@vitejs/plugin-react': '^4.2.1',
                'eslint': '^8.55.0',
                'eslint-plugin-react-hooks': '^4.6.0',
                'eslint-plugin-react-refresh': '^0.4.5',
                'typescript': '^5.2.2',
                'vite': '^5.0.8'
            },
            scripts: {
                'dev': 'vite',
                'build': 'tsc && vite build',
                'lint': 'eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0',
                'preview': 'vite preview'
            }
        });

        // Node.js Express TypeScript API
        this.templates.set('express-typescript', {
            name: 'Express TypeScript API',
            description: 'RESTful API server with Express, TypeScript, and modern tooling',
            type: 'api',
            language: 'typescript',
            framework: 'express',
            structure: [
                { path: 'src', type: 'directory' },
                { path: 'src/controllers', type: 'directory' },
                { path: 'src/middleware', type: 'directory' },
                { path: 'src/models', type: 'directory' },
                { path: 'src/routes', type: 'directory' },
                { path: 'src/utils', type: 'directory' },
                { path: 'src/types', type: 'directory' },
                { path: 'src/app.ts', type: 'file', template: 'express-app' },
                { path: 'src/server.ts', type: 'file', template: 'express-server' },
                { path: 'src/routes/index.ts', type: 'file', template: 'express-routes' },
                { path: 'src/controllers/healthController.ts', type: 'file', template: 'express-health-controller' },
                { path: 'src/middleware/errorHandler.ts', type: 'file', template: 'express-error-middleware' },
                { path: 'src/utils/logger.ts', type: 'file', template: 'express-logger' },
                { path: 'tsconfig.json', type: 'file', template: 'node-tsconfig' },
                { path: '.env.example', type: 'file', template: 'env-example' }
            ],
            dependencies: {
                'express': '^4.18.2',
                'cors': '^2.8.5',
                'helmet': '^7.0.0',
                'morgan': '^1.10.0',
                'dotenv': '^16.3.1'
            },
            devDependencies: {
                '@types/express': '^4.17.21',
                '@types/cors': '^2.8.17',
                '@types/morgan': '^1.9.9',
                '@types/node': '^20.9.0',
                'typescript': '^5.2.2',
                'ts-node': '^10.9.1',
                'nodemon': '^3.0.1'
            },
            scripts: {
                'dev': 'nodemon src/server.ts',
                'build': 'tsc',
                'start': 'node dist/server.js',
                'lint': 'eslint src --ext .ts'
            }
        });

        // Python FastAPI Template
        this.templates.set('fastapi-python', {
            name: 'FastAPI Python',
            description: 'Modern Python API with FastAPI, Pydantic, and async support',
            type: 'api',
            language: 'python',
            framework: 'fastapi',
            structure: [
                { path: 'app', type: 'directory' },
                { path: 'app/__init__.py', type: 'file', content: '' },
                { path: 'app/main.py', type: 'file', template: 'fastapi-main' },
                { path: 'app/api', type: 'directory' },
                { path: 'app/api/__init__.py', type: 'file', content: '' },
                { path: 'app/api/routes.py', type: 'file', template: 'fastapi-routes' },
                { path: 'app/core', type: 'directory' },
                { path: 'app/core/__init__.py', type: 'file', content: '' },
                { path: 'app/core/config.py', type: 'file', template: 'fastapi-config' },
                { path: 'app/models', type: 'directory' },
                { path: 'app/models/__init__.py', type: 'file', content: '' },
                { path: 'app/schemas', type: 'directory' },
                { path: 'app/schemas/__init__.py', type: 'file', content: '' },
                { path: 'requirements.txt', type: 'file', template: 'fastapi-requirements' },
                { path: 'requirements-dev.txt', type: 'file', template: 'fastapi-requirements-dev' },
                { path: '.env.example', type: 'file', template: 'python-env-example' }
            ],
            scripts: {
                'dev': 'uvicorn app.main:app --reload',
                'start': 'uvicorn app.main:app --host 0.0.0.0 --port 8000'
            }
        });

        // Vue.js TypeScript Template
        this.templates.set('vue-typescript', {
            name: 'Vue TypeScript',
            description: 'Vue 3 application with TypeScript, Vite, and Composition API',
            type: 'web-app',
            language: 'typescript',
            framework: 'vue',
            structure: [
                { path: 'src', type: 'directory' },
                { path: 'src/components', type: 'directory' },
                { path: 'src/composables', type: 'directory' },
                { path: 'src/views', type: 'directory' },
                { path: 'src/router', type: 'directory' },
                { path: 'src/stores', type: 'directory' },
                { path: 'src/App.vue', type: 'file', template: 'vue-app' },
                { path: 'src/main.ts', type: 'file', template: 'vue-main' },
                { path: 'src/style.css', type: 'file', template: 'vue-style' },
                { path: 'src/vite-env.d.ts', type: 'file', template: 'vite-env' },
                { path: 'public', type: 'directory' },
                { path: 'index.html', type: 'file', template: 'vue-index-html' },
                { path: 'vite.config.ts', type: 'file', template: 'vue-vite-config' },
                { path: 'tsconfig.json', type: 'file', template: 'vue-tsconfig' }
            ],
            dependencies: {
                'vue': '^3.3.11',
                'vue-router': '^4.2.5',
                'pinia': '^2.1.7'
            },
            devDependencies: {
                '@vitejs/plugin-vue': '^4.5.1',
                'typescript': '^5.2.2',
                'vite': '^5.0.8',
                'vue-tsc': '^1.8.25'
            }
        });
    }

    private getTemplate(template: string, language?: string, framework?: string): ProjectTemplate | null {
        // Direct template match
        if (this.templates.has(template)) {
            return this.templates.get(template)!;
        }

        // Try to find by language and framework
        if (language && framework) {
            const key = `${framework}-${language}`;
            if (this.templates.has(key)) {
                return this.templates.get(key)!;
            }
        }

        // Find by language only
        if (language) {
            for (const [, tmpl] of this.templates) {
                if (tmpl.language.toLowerCase() === language.toLowerCase()) {
                    if (!framework || tmpl.framework?.toLowerCase() === framework.toLowerCase()) {
                        return tmpl;
                    }
                }
            }
        }

        return null;
    }

    private async generateTemplate(language?: string, framework?: string, features?: string): Promise<ProjectTemplate> {
        // Generate a basic template based on language and framework
        const template: ProjectTemplate = {
            name: `${framework || 'basic'}-${language || 'project'}`,
            description: `Generated ${language} ${framework ? framework + ' ' : ''}project`,
            type: 'generated',
            language: language || 'javascript',
            framework,
            structure: [
                { path: 'src', type: 'directory' },
                { path: 'src/index.js', type: 'file', template: 'basic-index' },
                { path: 'README.md', type: 'file', template: 'basic-readme' }
            ],
            dependencies: {},
            devDependencies: {},
            scripts: {}
        };

        // Customize based on language
        if (language === 'typescript') {
            template.structure.push(
                { path: 'tsconfig.json', type: 'file', template: 'basic-tsconfig' }
            );
            template.devDependencies = {
                'typescript': '^5.2.2',
                '@types/node': '^20.9.0'
            };
        }

        if (language === 'python') {
            template.structure = [
                { path: 'src', type: 'directory' },
                { path: 'src/__init__.py', type: 'file', content: '' },
                { path: 'src/main.py', type: 'file', template: 'python-main' },
                { path: 'requirements.txt', type: 'file', template: 'python-requirements' },
                { path: 'README.md', type: 'file', template: 'basic-readme' }
            ];
        }

        return template;
    }

    private async generateFileContent(item: FileStructure, template: ProjectTemplate, options: ScaffoldOptions): Promise<string> {
        if (item.content) {
            return item.content;
        }

        if (!item.template) {
            return '';
        }

        const templates = this.getFileTemplates();
        const templateContent = templates[item.template];
        
        if (!templateContent) {
            return '';
        }

        // Replace placeholders
        return templateContent
            .replace(/{{PROJECT_NAME}}/g, options.projectName)
            .replace(/{{PROJECT_DESCRIPTION}}/g, template.description)
            .replace(/{{LANGUAGE}}/g, template.language)
            .replace(/{{FRAMEWORK}}/g, template.framework || '')
            .replace(/{{AUTHOR}}/g, 'Your Name')
            .replace(/{{EMAIL}}/g, 'your.email@example.com');
    }

    private getFileTemplates(): Record<string, string> {
        return {
            'react-app': `import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <h1>{{PROJECT_NAME}}</h1>
        <div className="card">
          <button onClick={() => setCount((count) => count + 1)}>
            count is {count}
          </button>
        </div>
      </div>
    </>
  )
}

export default App`,

            'react-main': `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,

            'react-index-html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{PROJECT_NAME}}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,

            'vite-config': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
})`,

            'react-tsconfig': `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}`,

            'express-app': `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from 'dotenv';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';

config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', routes);

// Error handling
app.use(errorHandler);

export default app;`,

            'express-server': `import app from './app';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(\`Server running on port \${PORT}\`);
});`,

            'fastapi-main': `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import routes
from app.core.config import settings

app = FastAPI(
    title="{{PROJECT_NAME}}",
    description="{{PROJECT_DESCRIPTION}}",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_HOSTS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(routes.router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "Welcome to {{PROJECT_NAME}}"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}`,

            'basic-readme': `# {{PROJECT_NAME}}

{{PROJECT_DESCRIPTION}}

## Getting Started

### Prerequisites

- Node.js (for JavaScript/TypeScript projects)
- Python 3.8+ (for Python projects)

### Installation

\`\`\`bash
# Clone the repository
git clone <repository-url>
cd {{PROJECT_NAME}}

# Install dependencies
npm install  # or pip install -r requirements.txt
\`\`\`

### Development

\`\`\`bash
npm run dev  # or python src/main.py
\`\`\`

### Build

\`\`\`bash
npm run build
\`\`\`

## Project Structure

\`\`\`
{{PROJECT_NAME}}/
├── src/
│   └── ...
├── README.md
└── package.json
\`\`\`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License`
        };
    }

    private async createProjectManifest(projectPath: string, template: ProjectTemplate, options: ScaffoldOptions): Promise<void> {
        if (template.language === 'python') {
            // Create setup.py or pyproject.toml
            const setupPy = `from setuptools import setup, find_packages

setup(
    name="${options.projectName}",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        # Add your dependencies here
    ],
    author="{{AUTHOR}}",
    author_email="{{EMAIL}}",
    description="${template.description}",
    python_requires=">=3.8",
)`;
            await fs.promises.writeFile(path.join(projectPath, 'setup.py'), setupPy);
        } else {
            // Create package.json
            const packageJson = {
                name: options.projectName,
                version: '0.1.0',
                description: template.description,
                main: 'src/index.js',
                scripts: {
                    ...template.scripts,
                    test: 'echo "Error: no test specified" && exit 1'
                },
                dependencies: template.dependencies || {},
                devDependencies: template.devDependencies || {},
                keywords: [template.language, template.framework].filter(Boolean),
                author: '{{AUTHOR}}',
                license: 'MIT'
            };

            if (options.includeTests) {
                packageJson.devDependencies = {
                    ...packageJson.devDependencies,
                    'jest': '^29.7.0',
                    '@types/jest': '^29.5.8'
                };
                packageJson.scripts.test = 'jest';
            }

            await fs.promises.writeFile(
                path.join(projectPath, 'package.json'), 
                JSON.stringify(packageJson, null, 2)
            );
        }
    }

    private async createConfigFiles(projectPath: string, template: ProjectTemplate, options: ScaffoldOptions): Promise<void> {
        // Create .gitignore
        const gitignoreContent = this.generateGitignore(template.language);
        await fs.promises.writeFile(path.join(projectPath, '.gitignore'), gitignoreContent);

        // Create README.md if not already created
        const readmePath = path.join(projectPath, 'README.md');
        if (!await this.fileExists(readmePath)) {
            const readmeContent = this.getFileTemplates()['basic-readme']
                .replace(/{{PROJECT_NAME}}/g, options.projectName)
                .replace(/{{PROJECT_DESCRIPTION}}/g, template.description);
            await fs.promises.writeFile(readmePath, readmeContent);
        }

        // Create ESLint config for JavaScript/TypeScript projects
        if (options.lintingSetup && ['javascript', 'typescript'].includes(template.language)) {
            await this.createEslintConfig(projectPath, template);
        }

        // Create Prettier config
        if (options.formattingSetup) {
            await this.createPrettierConfig(projectPath);
        }

        // Create Docker files
        if (options.includeDocker) {
            await this.createDockerFiles(projectPath, template);
        }

        // Create CI/CD configuration
        if (options.includeCI) {
            await this.createCIConfig(projectPath, template);
        }
    }

    private generateGitignore(language: string): string {
        const common = `# Dependencies
node_modules/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
`;

        const languageSpecific: Record<string, string> = {
            'javascript': `# Build outputs
dist/
build/

# TypeScript
*.tsbuildinfo
`,
            'typescript': `# Build outputs
dist/
build/

# TypeScript
*.tsbuildinfo
`,
            'python': `# Byte-compiled / optimized / DLL files
__pycache__/
*.py[cod]
*$py.class

# Virtual environments
venv/
env/
ENV/

# Distribution / packaging
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg
MANIFEST

# PyInstaller
*.manifest
*.spec

# Unit test / coverage reports
htmlcov/
.tox/
.coverage
.coverage.*
.cache
nosetests.xml
coverage.xml
*.cover
.hypothesis/
.pytest_cache/
`
        };

        return common + (languageSpecific[language] || '');
    }

    private async createEslintConfig(projectPath: string, template: ProjectTemplate): Promise<void> {
        const eslintConfig = {
            env: {
                browser: true,
                es2021: true,
                node: true
            },
            extends: [
                'eslint:recommended',
                template.language === 'typescript' ? '@typescript-eslint/recommended' : null
            ].filter(Boolean),
            parser: template.language === 'typescript' ? '@typescript-eslint/parser' : undefined,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module'
            },
            plugins: template.language === 'typescript' ? ['@typescript-eslint'] : [],
            rules: {}
        };

        await fs.promises.writeFile(
            path.join(projectPath, '.eslintrc.json'),
            JSON.stringify(eslintConfig, null, 2)
        );
    }

    private async createPrettierConfig(projectPath: string): Promise<void> {
        const prettierConfig = {
            semi: true,
            trailingComma: 'es5',
            singleQuote: true,
            printWidth: 80,
            tabWidth: 2,
            useTabs: false
        };

        await fs.promises.writeFile(
            path.join(projectPath, '.prettierrc'),
            JSON.stringify(prettierConfig, null, 2)
        );
    }

    private async createDockerFiles(projectPath: string, template: ProjectTemplate): Promise<void> {
        let dockerfile = '';
        
        if (template.language === 'javascript' || template.language === 'typescript') {
            dockerfile = `FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

${template.language === 'typescript' ? 'RUN npm run build' : ''}

EXPOSE 3000

CMD ["npm", "start"]`;
        } else if (template.language === 'python') {
            dockerfile = `FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "src/main.py"]`;
        }

        if (dockerfile) {
            await fs.promises.writeFile(path.join(projectPath, 'Dockerfile'), dockerfile);
        }

        // Docker Compose
        const dockerCompose = `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
    volumes:
      - .:/app
      - /app/node_modules
`;

        await fs.promises.writeFile(path.join(projectPath, 'docker-compose.yml'), dockerCompose);
    }

    private async createCIConfig(projectPath: string, template: ProjectTemplate): Promise<void> {
        // GitHub Actions workflow
        const workflowDir = path.join(projectPath, '.github', 'workflows');
        await fs.promises.mkdir(workflowDir, { recursive: true });

        let workflow = '';
        
        if (template.language === 'javascript' || template.language === 'typescript') {
            workflow = `name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js \${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: \${{ matrix.node-version }}
        cache: 'npm'
    
    - run: npm ci
    - run: npm run build --if-present
    - run: npm test
    - run: npm run lint`;
        } else if (template.language === 'python') {
            workflow = `name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        python-version: [3.9, 3.10, 3.11]

    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python \${{ matrix.python-version }}
      uses: actions/setup-python@v3
      with:
        python-version: \${{ matrix.python-version }}
    
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt
        pip install -r requirements-dev.txt
    
    - name: Run tests
      run: pytest
    
    - name: Run linting
      run: flake8 src/`;
        }

        if (workflow) {
            await fs.promises.writeFile(path.join(workflowDir, 'ci.yml'), workflow);
        }
    }

    private async initializeGit(projectPath: string): Promise<void> {
        try {
            const { spawn } = require('child_process');
            
            await new Promise<void>((resolve, reject) => {
                const git = spawn('git', ['init'], { cwd: projectPath });
                git.on('close', (code) => {
                    if (code === 0) resolve();
                    else reject(new Error(`Git init failed with code ${code}`));
                });
            });
        } catch (error) {
            // Git not available, skip
        }
    }

    private async installDependencies(projectPath: string, template: ProjectTemplate): Promise<void> {
        try {
            const { spawn } = require('child_process');
            
            if (template.language === 'python') {
                // Install Python dependencies
                await new Promise<void>((resolve, reject) => {
                    const pip = spawn('pip', ['install', '-r', 'requirements.txt'], { cwd: projectPath });
                    pip.on('close', (code) => {
                        if (code === 0) resolve();
                        else reject(new Error(`Pip install failed with code ${code}`));
                    });
                });
            } else {
                // Install Node.js dependencies
                await new Promise<void>((resolve, reject) => {
                    const npm = spawn('npm', ['install'], { cwd: projectPath });
                    npm.on('close', (code) => {
                        if (code === 0) resolve();
                        else reject(new Error(`npm install failed with code ${code}`));
                    });
                });
            }
        } catch (error) {
            // Package manager not available, skip
        }
    }

    private async addSingleFeature(feature: string, options: ScaffoldOptions): Promise<boolean> {
        switch (feature.toLowerCase()) {
            case 'testing':
                return await this.addTestingFeature(options.targetDirectory);
            case 'docs':
                return await this.addDocsFeature(options.targetDirectory);
            case 'ci':
                return await this.addCIFeature(options.targetDirectory);
            case 'docker':
                return await this.addDockerFeature(options.targetDirectory);
            case 'linting':
                return await this.addLintingFeature(options.targetDirectory);
            default:
                return false;
        }
    }

    private async addTestingFeature(projectPath: string): Promise<boolean> {
        try {
            // Create test directory
            const testDir = path.join(projectPath, 'tests');
            await fs.promises.mkdir(testDir, { recursive: true });

            // Create sample test file
            const testContent = `// Sample test file
describe('Sample Test', () => {
  it('should pass', () => {
    expect(true).toBe(true);
  });
});`;

            await fs.promises.writeFile(path.join(testDir, 'sample.test.js'), testContent);
            return true;
        } catch (error) {
            return false;
        }
    }

    private async addDocsFeature(projectPath: string): Promise<boolean> {
        try {
            const docsDir = path.join(projectPath, 'docs');
            await fs.promises.mkdir(docsDir, { recursive: true });

            const docsContent = `# Documentation

## Getting Started

Add your documentation here.

## API Reference

Document your API endpoints and functions.

## Contributing

Guidelines for contributors.
`;

            await fs.promises.writeFile(path.join(docsDir, 'README.md'), docsContent);
            return true;
        } catch (error) {
            return false;
        }
    }

    private async addCIFeature(projectPath: string): Promise<boolean> {
        try {
            const workflowDir = path.join(projectPath, '.github', 'workflows');
            await fs.promises.mkdir(workflowDir, { recursive: true });

            const ciContent = `name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
`;

            await fs.promises.writeFile(path.join(workflowDir, 'ci.yml'), ciContent);
            return true;
        } catch (error) {
            return false;
        }
    }

    private async addDockerFeature(projectPath: string): Promise<boolean> {
        try {
            const dockerfile = `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "start"]`;

            await fs.promises.writeFile(path.join(projectPath, 'Dockerfile'), dockerfile);
            return true;
        } catch (error) {
            return false;
        }
    }

    private async addLintingFeature(projectPath: string): Promise<boolean> {
        try {
            const eslintConfig = {
                env: { browser: true, es2021: true, node: true },
                extends: ['eslint:recommended'],
                parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
                rules: {}
            };

            await fs.promises.writeFile(
                path.join(projectPath, '.eslintrc.json'),
                JSON.stringify(eslintConfig, null, 2)
            );
            return true;
        } catch (error) {
            return false;
        }
    }

    private generateNextSteps(template: ProjectTemplate, options: ScaffoldOptions): string[] {
        const steps = [
            `cd ${options.projectName}`,
        ];

        if (template.language === 'javascript' || template.language === 'typescript') {
            if (!options.installDependencies) {
                steps.push('npm install');
            }
            steps.push('npm run dev');
        } else if (template.language === 'python') {
            if (!options.installDependencies) {
                steps.push('pip install -r requirements.txt');
            }
            steps.push('python src/main.py');
        }

        steps.push('Start coding!');
        return steps;
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}
