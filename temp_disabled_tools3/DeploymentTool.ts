import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ToolExecutor, ToolResult } from '../ToolRegistry';

export class DeploymentTool implements ToolExecutor {
    readonly name = 'deployment';
    readonly description = 'Deployment automation, CI/CD pipeline generation, and infrastructure management';
    
    readonly metadata = {
        name: 'deployment',
        description: 'Deployment automation, CI/CD pipeline generation, and infrastructure management',
        category: 'Deployment',
        parameters: [
            {
                name: 'action',
                description: 'Deployment action to perform',
                required: true,
                type: 'string'
            }
        ],
        examples: [
            'Generate Dockerfile',
            'Create CI/CD pipeline',
            'Deploy to cloud platforms'
        ]
    };

    readonly methods = {
        'generateDockerfile': {
            description: 'Generate Dockerfile for the project',
            parameters: {
                projectType: { type: 'string', description: 'Project type (node, python, java, go, php)', optional: true },
                baseImage: { type: 'string', description: 'Base Docker image', optional: true },
                port: { type: 'number', description: 'Application port', optional: true }
            }
        },
        'createDockerCompose': {
            description: 'Create docker-compose.yml with services',
            parameters: {
                services: { type: 'array', description: 'List of services (web, database, redis, etc.)', optional: true },
                environment: { type: 'string', description: 'Environment (development, production)', optional: true }
            }
        },
        'generateCI': {
            description: 'Generate CI/CD pipeline configuration',
            parameters: {
                platform: { type: 'string', description: 'CI platform (github, gitlab, jenkins, azure)' },
                deployTarget: { type: 'string', description: 'Deploy target (aws, gcp, azure, heroku, vercel)', optional: true }
            }
        },
        'kubernetesConfig': {
            description: 'Generate Kubernetes deployment configuration',
            parameters: {
                appName: { type: 'string', description: 'Application name' },
                replicas: { type: 'number', description: 'Number of replicas', optional: true },
                namespace: { type: 'string', description: 'Kubernetes namespace', optional: true }
            }
        },
        'helmChart': {
            description: 'Generate Helm chart for Kubernetes deployment',
            parameters: {
                chartName: { type: 'string', description: 'Helm chart name' },
                appVersion: { type: 'string', description: 'Application version', optional: true }
            }
        },
        'terraformConfig': {
            description: 'Generate Terraform infrastructure configuration',
            parameters: {
                provider: { type: 'string', description: 'Cloud provider (aws, gcp, azure)' },
                resources: { type: 'array', description: 'Resources to provision', optional: true }
            }
        },
        'deployScript': {
            description: 'Generate deployment script',
            parameters: {
                target: { type: 'string', description: 'Deployment target' },
                strategy: { type: 'string', description: 'Deployment strategy (rolling, blue-green, canary)', optional: true }
            }
        },
        'nginxConfig': {
            description: 'Generate Nginx configuration for reverse proxy',
            parameters: {
                domain: { type: 'string', description: 'Domain name' },
                appPort: { type: 'number', description: 'Application port', optional: true },
                ssl: { type: 'boolean', description: 'Enable SSL/HTTPS', optional: true }
            }
        },
        'healthChecks': {
            description: 'Generate health check endpoints and monitoring',
            parameters: {
                framework: { type: 'string', description: 'Application framework', optional: true }
            }
        },
        'environmentConfig': {
            description: 'Generate environment-specific configuration files',
            parameters: {
                environments: { type: 'array', description: 'List of environments (dev, staging, prod)', optional: true }
            }
        },
        'secretsManagement': {
            description: 'Generate secrets management configuration',
            parameters: {
                platform: { type: 'string', description: 'Secrets platform (kubernetes, aws, azure, vault)' }
            }
        },
        'monitoringSetup': {
            description: 'Generate monitoring and logging configuration',
            parameters: {
                tools: { type: 'array', description: 'Monitoring tools (prometheus, grafana, elk)', optional: true }
            }
        }
    };

    async execute(method: string, args: Record<string, any>): Promise<ToolResult> {
        try {
            switch (method) {
                case 'generateDockerfile':
                    return await this.generateDockerfile(args.projectType, args.baseImage, args.port);
                case 'createDockerCompose':
                    return await this.createDockerCompose(args.services, args.environment);
                case 'generateCI':
                    return await this.generateCI(args.platform, args.deployTarget);
                case 'kubernetesConfig':
                    return await this.kubernetesConfig(args.appName, args.replicas, args.namespace);
                case 'helmChart':
                    return await this.helmChart(args.chartName, args.appVersion);
                case 'terraformConfig':
                    return await this.terraformConfig(args.provider, args.resources);
                case 'deployScript':
                    return await this.deployScript(args.target, args.strategy);
                case 'nginxConfig':
                    return await this.nginxConfig(args.domain, args.appPort, args.ssl);
                case 'healthChecks':
                    return await this.healthChecks(args.framework);
                case 'environmentConfig':
                    return await this.environmentConfig(args.environments);
                case 'secretsManagement':
                    return await this.secretsManagement(args.platform);
                case 'monitoringSetup':
                    return await this.monitoringSetup(args.tools);
                default:
                    return {
                        success: false,
                        error: `Unknown method: ${method}`
                    };
            }
        } catch (error) {
            return {
                success: false,
                error: `Error executing ${method}: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async generateDockerfile(projectType?: string, baseImage?: string, port?: number): Promise<ToolResult> {
        try {
            const detectedType = projectType || await this.detectProjectType();
            const dockerfile = this.createDockerfileContent(detectedType, baseImage, port);

            const dockerfilePath = path.join(
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                'Dockerfile'
            );

            await fs.writeFile(dockerfilePath, dockerfile.content);

            // Also create .dockerignore
            const dockerignorePath = path.join(
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                '.dockerignore'
            );
            await fs.writeFile(dockerignorePath, dockerfile.dockerignore);

            return {
                success: true,
                result: `Dockerfile generated at ${dockerfilePath}\n\nInstructions:\n${dockerfile.instructions}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to generate Dockerfile: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async createDockerCompose(services?: string[], environment: string = 'development'): Promise<ToolResult> {
        try {
            const detectedServices = services || await this.detectRequiredServices();
            const compose = this.createDockerComposeContent(detectedServices, environment);

            const composePath = path.join(
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                'docker-compose.yml'
            );

            await fs.writeFile(composePath, compose.content);

            // Generate environment file
            const envPath = path.join(
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                '.env.example'
            );
            await fs.writeFile(envPath, compose.envFile);

            return {
                success: true,
                result: `Docker Compose configuration generated at ${composePath}\n\nServices included: ${detectedServices.join(', ')}\n\nInstructions:\n${compose.instructions}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to create Docker Compose: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async generateCI(platform: string, deployTarget?: string): Promise<ToolResult> {
        try {
            const ci = this.createCIConfig(platform, deployTarget);

            const ciDir = path.join(
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                ci.directory
            );
            await fs.mkdir(ciDir, { recursive: true });

            const ciPath = path.join(ciDir, ci.filename);
            await fs.writeFile(ciPath, ci.content);

            return {
                success: true,
                result: `CI/CD pipeline generated at ${ciPath}\n\nPlatform: ${platform}\nDeploy target: ${deployTarget || 'none'}\n\nInstructions:\n${ci.instructions}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to generate CI config: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async kubernetesConfig(appName: string, replicas: number = 3, namespace: string = 'default'): Promise<ToolResult> {
        try {
            const k8sConfigs = this.createKubernetesConfigs(appName, replicas, namespace);

            const k8sDir = path.join(
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                'k8s'
            );
            await fs.mkdir(k8sDir, { recursive: true });

            const createdFiles = [];
            for (const [filename, content] of Object.entries(k8sConfigs.files)) {
                const filePath = path.join(k8sDir, filename);
                await fs.writeFile(filePath, content);
                createdFiles.push(filename);
            }

            return {
                success: true,
                result: `Kubernetes configuration generated in ${k8sDir}\n\nFiles created: ${createdFiles.join(', ')}\n\nInstructions:\n${k8sConfigs.instructions}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to generate Kubernetes config: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async helmChart(chartName: string, appVersion: string = '1.0.0'): Promise<ToolResult> {
        try {
            const chart = this.createHelmChart(chartName, appVersion);

            const chartDir = path.join(
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                'helm',
                chartName
            );
            await fs.mkdir(chartDir, { recursive: true });
            await fs.mkdir(path.join(chartDir, 'templates'), { recursive: true });

            const createdFiles = [];
            for (const [filePath, content] of Object.entries(chart.files)) {
                const fullPath = path.join(chartDir, filePath);
                await fs.mkdir(path.dirname(fullPath), { recursive: true });
                await fs.writeFile(fullPath, content);
                createdFiles.push(filePath);
            }

            return {
                success: true,
                result: `Helm chart generated in ${chartDir}\n\nFiles created: ${createdFiles.join(', ')}\n\nInstructions:\n${chart.instructions}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to generate Helm chart: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async terraformConfig(provider: string, resources?: string[]): Promise<ToolResult> {
        try {
            const defaultResources = resources || ['vpc', 'subnet', 'security_group', 'instance'];
            const terraform = this.createTerraformConfig(provider, defaultResources);

            const terraformDir = path.join(
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                'terraform'
            );
            await fs.mkdir(terraformDir, { recursive: true });

            const createdFiles = [];
            for (const [filename, content] of Object.entries(terraform.files)) {
                const filePath = path.join(terraformDir, filename);
                await fs.writeFile(filePath, content);
                createdFiles.push(filename);
            }

            return {
                success: true,
                result: `Terraform configuration generated in ${terraformDir}\n\nFiles created: ${createdFiles.join(', ')}\n\nProvider: ${provider}\n\nInstructions:\n${terraform.instructions}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to generate Terraform config: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async deployScript(target: string, strategy: string = 'rolling'): Promise<ToolResult> {
        try {
            const script = this.createDeploymentScript(target, strategy);

            const scriptsDir = path.join(
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                'scripts'
            );
            await fs.mkdir(scriptsDir, { recursive: true });

            const scriptPath = path.join(scriptsDir, script.filename);
            await fs.writeFile(scriptPath, script.content);

            // Make script executable on Unix systems
            if (process.platform !== 'win32') {
                await fs.chmod(scriptPath, '755');
            }

            return {
                success: true,
                result: `Deployment script generated at ${scriptPath}\n\nTarget: ${target}\nStrategy: ${strategy}\n\nInstructions:\n${script.instructions}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to generate deployment script: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async nginxConfig(domain: string, appPort: number = 3000, ssl: boolean = true): Promise<ToolResult> {
        try {
            const nginx = this.createNginxConfig(domain, appPort, ssl);

            const configDir = path.join(
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                'nginx'
            );
            await fs.mkdir(configDir, { recursive: true });

            const configPath = path.join(configDir, 'nginx.conf');
            await fs.writeFile(configPath, nginx.content);

            return {
                success: true,
                result: `Nginx configuration generated at ${configPath}\n\nDomain: ${domain}\nPort: ${appPort}\nSSL: ${ssl ? 'enabled' : 'disabled'}\n\nInstructions:\n${nginx.instructions}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to generate Nginx config: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async healthChecks(framework?: string): Promise<ToolResult> {
        try {
            const detectedFramework = framework || await this.detectFramework();
            const healthCheck = this.createHealthCheckConfig(detectedFramework);

            const healthDir = path.join(
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                'src/health'
            );
            await fs.mkdir(healthDir, { recursive: true });

            const createdFiles = [];
            for (const [filename, content] of Object.entries(healthCheck.files)) {
                const filePath = path.join(healthDir, filename);
                await fs.writeFile(filePath, content);
                createdFiles.push(filename);
            }

            return {
                success: true,
                result: `Health check configuration generated in ${healthDir}\n\nFiles created: ${createdFiles.join(', ')}\n\nFramework: ${detectedFramework}\n\nInstructions:\n${healthCheck.instructions}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to generate health checks: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async environmentConfig(environments?: string[]): Promise<ToolResult> {
        try {
            const envs = environments || ['development', 'staging', 'production'];
            const configs = this.createEnvironmentConfigs(envs);

            const configDir = path.join(
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                'config/environments'
            );
            await fs.mkdir(configDir, { recursive: true });

            const createdFiles = [];
            for (const [filename, content] of Object.entries(configs.files)) {
                const filePath = path.join(configDir, filename);
                await fs.writeFile(filePath, content);
                createdFiles.push(filename);
            }

            return {
                success: true,
                result: `Environment configurations generated in ${configDir}\n\nEnvironments: ${envs.join(', ')}\nFiles created: ${createdFiles.join(', ')}\n\nInstructions:\n${configs.instructions}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to generate environment configs: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async secretsManagement(platform: string): Promise<ToolResult> {
        try {
            const secrets = this.createSecretsConfig(platform);

            const secretsDir = path.join(
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                'secrets'
            );
            await fs.mkdir(secretsDir, { recursive: true });

            const createdFiles = [];
            for (const [filename, content] of Object.entries(secrets.files)) {
                const filePath = path.join(secretsDir, filename);
                await fs.writeFile(filePath, content);
                createdFiles.push(filename);
            }

            return {
                success: true,
                result: `Secrets management configuration generated in ${secretsDir}\n\nPlatform: ${platform}\nFiles created: ${createdFiles.join(', ')}\n\nInstructions:\n${secrets.instructions}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to generate secrets config: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async monitoringSetup(tools?: string[]): Promise<ToolResult> {
        try {
            const monitoringTools = tools || ['prometheus', 'grafana'];
            const monitoring = this.createMonitoringConfig(monitoringTools);

            const monitoringDir = path.join(
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                'monitoring'
            );
            await fs.mkdir(monitoringDir, { recursive: true });

            const createdFiles = [];
            for (const [filename, content] of Object.entries(monitoring.files)) {
                const filePath = path.join(monitoringDir, filename);
                await fs.writeFile(filePath, content);
                createdFiles.push(filename);
            }

            return {
                success: true,
                result: `Monitoring configuration generated in ${monitoringDir}\n\nTools: ${monitoringTools.join(', ')}\nFiles created: ${createdFiles.join(', ')}\n\nInstructions:\n${monitoring.instructions}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to generate monitoring setup: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    // Helper methods
    private async detectProjectType(): Promise<string> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return 'node';

        try {
            // Check for package.json (Node.js)
            await fs.access(path.join(workspaceFolder.uri.fsPath, 'package.json'));
            return 'node';
        } catch {}

        try {
            // Check for requirements.txt or setup.py (Python)
            await fs.access(path.join(workspaceFolder.uri.fsPath, 'requirements.txt'));
            return 'python';
        } catch {}

        try {
            // Check for pom.xml (Java)
            await fs.access(path.join(workspaceFolder.uri.fsPath, 'pom.xml'));
            return 'java';
        } catch {}

        try {
            // Check for go.mod (Go)
            await fs.access(path.join(workspaceFolder.uri.fsPath, 'go.mod'));
            return 'go';
        } catch {}

        return 'node'; // Default
    }

    private createDockerfileContent(projectType: string, baseImage?: string, port?: number): any {
        const dockerfiles = {
            node: {
                content: `# Node.js Dockerfile
FROM ${baseImage || 'node:18-alpine'}

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app source
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership
RUN chown -R nextjs:nodejs /usr/src/app
USER nextjs

# Expose port
EXPOSE ${port || 3000}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:${port || 3000}/health || exit 1

# Start the application
CMD ["npm", "start"]`,
                dockerignore: `node_modules
npm-debug.log
Dockerfile
.dockerignore
.git
.gitignore
README.md
.env
.nyc_output
coverage
.nyc_output
.coverage
.vscode
.next`,
                instructions: '1. Build: docker build -t myapp .\n2. Run: docker run -p 3000:3000 myapp\n3. Add health check endpoint to your app'
            },
            python: {
                content: `# Python Dockerfile
FROM ${baseImage || 'python:3.11-slim'}

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Create app directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    gcc \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy app source
COPY . .

# Create non-root user
RUN adduser --disabled-password --gecos '' appuser
RUN chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE ${port || 8000}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:${port || 8000}/health || exit 1

# Start the application
CMD ["python", "app.py"]`,
                dockerignore: `__pycache__
*.pyc
*.pyo
*.pyd
.Python
env
pip-log.txt
pip-delete-this-directory.txt
.tox
.coverage
.coverage.*
.cache
nosetests.xml
coverage.xml
*.cover
*.log
.git
.mypy_cache
.pytest_cache
.hypothesis`,
                instructions: '1. Build: docker build -t myapp .\n2. Run: docker run -p 8000:8000 myapp\n3. Add health check endpoint to your app'
            },
            java: {
                content: `# Java Dockerfile
FROM ${baseImage || 'openjdk:17-jre-slim'}

# Set working directory
WORKDIR /app

# Copy JAR file
COPY target/*.jar app.jar

# Create non-root user
RUN addgroup --system spring && adduser --system spring --ingroup spring
RUN chown spring:spring app.jar
USER spring:spring

# Expose port
EXPOSE ${port || 8080}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:${port || 8080}/actuator/health || exit 1

# Start the application
ENTRYPOINT ["java", "-jar", "app.jar"]`,
                dockerignore: `target/
.mvn/
*.iml
.idea/
.vscode/
*.log`,
                instructions: '1. Build: mvn clean package\n2. Build Docker: docker build -t myapp .\n3. Run: docker run -p 8080:8080 myapp'
            }
        };

        return dockerfiles[projectType as keyof typeof dockerfiles] || dockerfiles.node;
    }

    private async detectRequiredServices(): Promise<string[]> {
        const services = ['web'];
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return services;

        try {
            // Check for database usage
            const files = await fs.readdir(workspaceFolder.uri.fsPath);
            const content = await Promise.all(
                files.filter(f => f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.py'))
                    .slice(0, 5) // Limit files to check
                    .map(async f => {
                        try {
                            return await fs.readFile(path.join(workspaceFolder.uri.fsPath, f), 'utf8');
                        } catch {
                            return '';
                        }
                    })
            );

            const allContent = content.join(' ').toLowerCase();

            if (allContent.includes('postgres') || allContent.includes('postgresql')) {
                services.push('postgres');
            } else if (allContent.includes('mysql')) {
                services.push('mysql');
            } else if (allContent.includes('mongo')) {
                services.push('mongodb');
            }

            if (allContent.includes('redis')) {
                services.push('redis');
            }

        } catch (error) {
            // Default services if detection fails
        }

        return services;
    }

    private createDockerComposeContent(services: string[], environment: string): any {
        const serviceConfigs = {
            web: `  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=${environment}
    env_file:
      - .env
    depends_on:
      - postgres
      - redis
    restart: unless-stopped`,
            postgres: `  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=\${DB_NAME}
      - POSTGRES_USER=\${DB_USER}
      - POSTGRES_PASSWORD=\${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    restart: unless-stopped`,
            mysql: `  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=\${DB_ROOT_PASSWORD}
      - MYSQL_DATABASE=\${DB_NAME}
      - MYSQL_USER=\${DB_USER}
      - MYSQL_PASSWORD=\${DB_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "3306:3306"
    restart: unless-stopped`,
            mongodb: `  mongodb:
    image: mongo:6.0
    environment:
      - MONGO_INITDB_ROOT_USERNAME=\${DB_USER}
      - MONGO_INITDB_ROOT_PASSWORD=\${DB_PASSWORD}
      - MONGO_INITDB_DATABASE=\${DB_NAME}
    volumes:
      - mongodb_data:/data/db
    ports:
      - "27017:27017"
    restart: unless-stopped`,
            redis: `  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped`
        };

        const volumes = [];
        if (services.includes('postgres')) volumes.push('postgres_data:');
        if (services.includes('mysql')) volumes.push('mysql_data:');
        if (services.includes('mongodb')) volumes.push('mongodb_data:');
        if (services.includes('redis')) volumes.push('redis_data:');

        const content = `version: '3.8'

services:
${services.map(service => serviceConfigs[service as keyof typeof serviceConfigs]).filter(Boolean).join('\n\n')}

${volumes.length > 0 ? `volumes:\n${volumes.map(v => `  ${v}`).join('\n')}` : ''}

networks:
  default:
    name: app-network`;

        const envFile = `# Environment Variables
NODE_ENV=${environment}
PORT=3000

# Database Configuration
DB_NAME=myapp
DB_USER=myapp_user
DB_PASSWORD=secure_password
DB_ROOT_PASSWORD=root_password

# Redis Configuration
REDIS_URL=redis://redis:6379

# Application Secrets
JWT_SECRET=your_jwt_secret_here
API_KEY=your_api_key_here`;

        const instructions = `1. Copy .env.example to .env and update values
2. Start services: docker-compose up -d
3. View logs: docker-compose logs -f
4. Stop services: docker-compose down
5. Remove volumes: docker-compose down -v`;

        return { content, envFile, instructions };
    }

    private createCIConfig(platform: string, deployTarget?: string): any {
        const configs = {
            github: {
                directory: '.github/workflows',
                filename: 'ci-cd.yml',
                content: `name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  NODE_VERSION: '18'
  ${deployTarget ? `DEPLOY_TARGET: ${deployTarget}` : ''}

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: \${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linter
      run: npm run lint
    
    - name: Run tests
      run: npm test
      env:
        DATABASE_URL: postgres://postgres:postgres@localhost:5432/test
    
    - name: Build application
      run: npm run build

  security:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: Run security audit
      run: npm audit --audit-level high
    
    - name: Run Snyk security scan
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: \${{ secrets.SNYK_TOKEN }}

  deploy:
    needs: [test, security]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: \${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build application
      run: npm run build
    
    ${deployTarget === 'aws' ? `- name: Deploy to AWS
      env:
        AWS_ACCESS_KEY_ID: \${{ secrets.AWS_ACCESS_KEY_ID }}
        AWS_SECRET_ACCESS_KEY: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
      run: |
        # Add AWS deployment commands here
        echo "Deploying to AWS..."` : ''}
    
    ${deployTarget === 'vercel' ? `- name: Deploy to Vercel
      uses: amondnet/vercel-action@v25
      with:
        vercel-token: \${{ secrets.VERCEL_TOKEN }}
        vercel-org-id: \${{ secrets.ORG_ID }}
        vercel-project-id: \${{ secrets.PROJECT_ID }}
        vercel-args: '--prod'` : ''}`,
                instructions: `1. Add required secrets to GitHub repository settings
2. Customize build and test commands
3. Configure deployment target if specified
4. Push to main branch to trigger deployment`
            },
            gitlab: {
                directory: '',
                filename: '.gitlab-ci.yml',
                content: `stages:
  - test
  - security
  - build
  - deploy

variables:
  NODE_VERSION: "18"
  DOCKER_DRIVER: overlay2

before_script:
  - apt-get update -qq && apt-get install -y -qq git curl
  - curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
  - export NVM_DIR="\$HOME/.nvm" && [ -s "\$NVM_DIR/nvm.sh" ] && \\. "\$NVM_DIR/nvm.sh"
  - nvm install \$NODE_VERSION
  - nvm use \$NODE_VERSION

test:
  stage: test
  script:
    - npm ci
    - npm run lint
    - npm test
    - npm run build
  artifacts:
    paths:
      - dist/
    expire_in: 1 hour

security_scan:
  stage: security
  script:
    - npm audit --audit-level high
  allow_failure: true

build_docker:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -t \$CI_REGISTRY_IMAGE:\$CI_COMMIT_SHA .
    - docker push \$CI_REGISTRY_IMAGE:\$CI_COMMIT_SHA
  only:
    - main

deploy_production:
  stage: deploy
  script:
    - echo "Deploying to production..."
    # Add deployment commands here
  environment:
    name: production
    url: https://myapp.com
  only:
    - main
  when: manual`,
                instructions: `1. Configure GitLab CI/CD variables
2. Set up Docker registry
3. Customize deployment commands
4. Configure environments`
            }
        };

        return configs[platform as keyof typeof configs] || configs.github;
    }

    private createKubernetesConfigs(appName: string, replicas: number, namespace: string): any {
        const files = {
            'deployment.yaml': `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${appName}
  namespace: ${namespace}
  labels:
    app: ${appName}
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      app: ${appName}
  template:
    metadata:
      labels:
        app: ${appName}
    spec:
      containers:
      - name: ${appName}
        image: ${appName}:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: ${appName}-secrets
              key: database-url
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5`,

            'service.yaml': `apiVersion: v1
kind: Service
metadata:
  name: ${appName}-service
  namespace: ${namespace}
spec:
  selector:
    app: ${appName}
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: ClusterIP`,

            'ingress.yaml': `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${appName}-ingress
  namespace: ${namespace}
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - ${appName}.example.com
    secretName: ${appName}-tls
  rules:
  - host: ${appName}.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: ${appName}-service
            port:
              number: 80`,

            'secrets.yaml': `apiVersion: v1
kind: Secret
metadata:
  name: ${appName}-secrets
  namespace: ${namespace}
type: Opaque
data:
  database-url: cG9zdGdyZXM6Ly91c2VyOnBhc3NAaG9zdDpwb3J0L2RiIyBCYXNlNjQgZW5jb2RlZA==
  jwt-secret: eW91ci1qd3Qtc2VjcmV0LWhlcmUjQmFzZTY0IGVuY29kZWQ=`,

            'configmap.yaml': `apiVersion: v1
kind: ConfigMap
metadata:
  name: ${appName}-config
  namespace: ${namespace}
data:
  NODE_ENV: production
  PORT: "3000"
  LOG_LEVEL: info`
        };

        const instructions = `1. Apply namespace: kubectl create namespace ${namespace}
2. Apply configs: kubectl apply -f k8s/
3. Check status: kubectl get pods -n ${namespace}
4. View logs: kubectl logs -f deployment/${appName} -n ${namespace}
5. Update secrets with actual base64 encoded values`;

        return { files, instructions };
    }

    private createHelmChart(chartName: string, appVersion: string): any {
        const files = {
            'Chart.yaml': `apiVersion: v2
name: ${chartName}
description: A Helm chart for ${chartName}
type: application
version: 0.1.0
appVersion: "${appVersion}"`,

            'values.yaml': `replicaCount: 3

image:
  repository: ${chartName}
  pullPolicy: IfNotPresent
  tag: "latest"

service:
  type: ClusterIP
  port: 80
  targetPort: 3000

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: ${chartName}.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: ${chartName}-tls
      hosts:
        - ${chartName}.example.com

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 128Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80

nodeSelector: {}

tolerations: []

affinity: {}

env:
  NODE_ENV: production
  PORT: 3000

secrets:
  databaseUrl: "postgres://user:pass@host:port/db"
  jwtSecret: "your-jwt-secret"`,

            'templates/deployment.yaml': `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "${chartName}.fullname" . }}
  labels:
    {{- include "${chartName}.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "${chartName}.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "${chartName}.selectorLabels" . | nindent 8 }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.targetPort }}
              protocol: TCP
          livenessProbe:
            httpGet:
              path: /health
              port: http
          readinessProbe:
            httpGet:
              path: /health
              port: http
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          env:
            {{- range $key, $value := .Values.env }}
            - name: {{ $key }}
              value: {{ $value | quote }}
            {{- end }}`,

            'templates/_helpers.tpl': `{{- define "${chartName}.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "${chartName}.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "${chartName}.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "${chartName}.labels" -}}
helm.sh/chart: {{ include "${chartName}.chart" . }}
{{ include "${chartName}.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "${chartName}.selectorLabels" -}}
app.kubernetes.io/name: {{ include "${chartName}.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}`
        };

        const instructions = `1. Install: helm install ${chartName} ./helm/${chartName}
2. Upgrade: helm upgrade ${chartName} ./helm/${chartName}
3. Uninstall: helm uninstall ${chartName}
4. Debug: helm template ${chartName} ./helm/${chartName}
5. Customize values.yaml for your environment`;

        return { files, instructions };
    }

    private createTerraformConfig(provider: string, resources: string[]): any {
        const providerConfigs = {
            aws: {
                'main.tf': `terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# VPC
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "\${var.project_name}-vpc"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "\${var.project_name}-igw"
  }
}

# Public Subnet
resource "aws_subnet" "public" {
  count           = 2
  vpc_id          = aws_vpc.main.id
  cidr_block      = "10.0.\${count.index + 1}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "\${var.project_name}-public-\${count.index + 1}"
  }
}

# Security Group
resource "aws_security_group" "web" {
  name_prefix = "\${var.project_name}-web"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# EC2 Instance
resource "aws_instance" "web" {
  ami             = data.aws_ami.ubuntu.id
  instance_type   = var.instance_type
  subnet_id       = aws_subnet.public[0].id
  security_groups = [aws_security_group.web.id]

  user_data = file("user-data.sh")

  tags = {
    Name = "\${var.project_name}-web"
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}`,

                'variables.tf': `variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "myapp"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}`,

                'outputs.tf': `output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "instance_public_ip" {
  description = "Public IP address of the instance"
  value       = aws_instance.web.public_ip
}

output "instance_dns" {
  description = "Public DNS name of the instance"
  value       = aws_instance.web.public_dns
}`,

                'user-data.sh': `#!/bin/bash
apt-get update
apt-get install -y docker.io
systemctl start docker
systemctl enable docker
usermod -aG docker ubuntu

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Clone and run application
# git clone https://github.com/yourorg/yourapp.git /opt/app
# cd /opt/app
# docker-compose up -d`
            }
        };

        const instructions = `1. Initialize: terraform init
2. Plan: terraform plan
3. Apply: terraform apply
4. Destroy: terraform destroy
5. Configure AWS credentials and customize variables`;

        return {
            files: providerConfigs[provider as keyof typeof providerConfigs] || providerConfigs.aws,
            instructions
        };
    }

    private createDeploymentScript(target: string, strategy: string): any {
        const scripts = {
            kubernetes: {
                filename: 'deploy.sh',
                content: `#!/bin/bash
set -e

# Kubernetes Deployment Script
PROJECT_NAME="myapp"
NAMESPACE="default"
IMAGE_TAG="\${1:-latest}"

echo "Deploying \${PROJECT_NAME} with tag \${IMAGE_TAG}..."

# Build and push image
echo "Building Docker image..."
docker build -t \${PROJECT_NAME}:\${IMAGE_TAG} .
docker tag \${PROJECT_NAME}:\${IMAGE_TAG} your-registry/\${PROJECT_NAME}:\${IMAGE_TAG}
docker push your-registry/\${PROJECT_NAME}:\${IMAGE_TAG}

# Update deployment
echo "Updating Kubernetes deployment..."
kubectl set image deployment/\${PROJECT_NAME} \${PROJECT_NAME}=your-registry/\${PROJECT_NAME}:\${IMAGE_TAG} -n \${NAMESPACE}

# Wait for rollout
echo "Waiting for rollout to complete..."
kubectl rollout status deployment/\${PROJECT_NAME} -n \${NAMESPACE}

# Run health check
echo "Running health check..."
kubectl get pods -n \${NAMESPACE} -l app=\${PROJECT_NAME}

echo "Deployment completed successfully!"`,
                instructions: '1. Make executable: chmod +x scripts/deploy.sh\n2. Run: ./scripts/deploy.sh <tag>\n3. Configure registry and namespace'
            },
            docker: {
                filename: 'deploy.sh',
                content: `#!/bin/bash
set -e

# Docker Deployment Script
PROJECT_NAME="myapp"
IMAGE_TAG="\${1:-latest}"
CONTAINER_NAME="\${PROJECT_NAME}-\${IMAGE_TAG}"

echo "Deploying \${PROJECT_NAME} with Docker..."

# Build image
echo "Building Docker image..."
docker build -t \${PROJECT_NAME}:\${IMAGE_TAG} .

# Stop existing container
echo "Stopping existing container..."
docker stop \${PROJECT_NAME} 2>/dev/null || true
docker rm \${PROJECT_NAME} 2>/dev/null || true

# Run new container
echo "Starting new container..."
docker run -d \\
  --name \${PROJECT_NAME} \\
  --restart unless-stopped \\
  -p 80:3000 \\
  --env-file .env \\
  \${PROJECT_NAME}:\${IMAGE_TAG}

# Health check
echo "Waiting for application to start..."
sleep 10
curl -f http://localhost/health || echo "Health check failed"

echo "Deployment completed!"`,
                instructions: '1. Make executable: chmod +x scripts/deploy.sh\n2. Create .env file\n3. Run: ./scripts/deploy.sh'
            }
        };

        return scripts[target as keyof typeof scripts] || scripts.docker;
    }

    private createNginxConfig(domain: string, appPort: number, ssl: boolean): any {
        const sslConfig = ssl ? `
    # SSL Configuration
    listen 443 ssl http2;
    ssl_certificate /etc/ssl/certs/${domain}.crt;
    ssl_certificate_key /etc/ssl/private/${domain}.key;
    ssl_session_timeout 1d;
    ssl_session_cache shared:MozTLS:10m;
    ssl_session_tickets off;
    
    # Modern configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;` : `
    listen 80;`;

        const redirectConfig = ssl ? `
# HTTP redirect
server {
    listen 80;
    server_name ${domain} www.${domain};
    return 301 https://$server_name$request_uri;
}
` : '';

        const content = `# Nginx Configuration for ${domain}
upstream app {
    server localhost:${appPort};
    keepalive 32;
}

${redirectConfig}
server {${sslConfig}
    server_name ${domain} www.${domain};
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;
    
    # Static files
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }
    
    # API endpoints
    location /api/ {
        proxy_pass http://app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Main application
    location / {
        proxy_pass http://app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Health check
    location /nginx-health {
        access_log off;
        return 200 "healthy\\n";
        add_header Content-Type text/plain;
    }
}`;

        const instructions = `1. Copy configuration to /etc/nginx/sites-available/${domain}
2. Create symlink: ln -s /etc/nginx/sites-available/${domain} /etc/nginx/sites-enabled/
3. Test config: nginx -t
4. Reload: systemctl reload nginx
${ssl ? '5. Configure SSL certificates\n6. Test HTTPS configuration' : '5. Configure SSL with Let\'s Encrypt if needed'}`;

        return { content, instructions };
    }

    private async detectFramework(): Promise<string> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return 'express';

        try {
            const packageJsonPath = path.join(workspaceFolder.uri.fsPath, 'package.json');
            const content = await fs.readFile(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(content);
            
            const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
            
            if (dependencies.express) return 'express';
            if (dependencies.fastify) return 'fastify';
            if (dependencies.koa) return 'koa';
            if (dependencies.django) return 'django';
            if (dependencies.flask) return 'flask';
            
        } catch (error) {
            // If package.json doesn't exist or can't be read
        }

        return 'express'; // Default
    }

    private createHealthCheckConfig(framework: string): any {
        const configs = {
            express: {
                'health.js': `const express = require('express');
const os = require('os');

const createHealthCheck = (dependencies = {}) => {
  const router = express.Router();

  router.get('/health', async (req, res) => {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      memory: process.memoryUsage(),
      cpu: os.loadavg(),
      dependencies: {}
    };

    // Check dependencies
    for (const [name, checkFn] of Object.entries(dependencies)) {
      try {
        await checkFn();
        health.dependencies[name] = { status: 'ok' };
      } catch (error) {
        health.dependencies[name] = { 
          status: 'error', 
          error: error.message 
        };
        health.status = 'degraded';
      }
    }

    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
  });

  router.get('/health/ready', async (req, res) => {
    // Readiness check - is the app ready to serve traffic?
    try {
      // Add your readiness checks here
      res.status(200).json({ status: 'ready' });
    } catch (error) {
      res.status(503).json({ status: 'not ready', error: error.message });
    }
  });

  router.get('/health/live', (req, res) => {
    // Liveness check - is the app alive?
    res.status(200).json({ status: 'alive' });
  });

  return router;
};

module.exports = createHealthCheck;`,
                'health-checks.js': `// Example health check dependencies
const checkDatabase = async () => {
  // Check database connection
  // throw new Error('Database connection failed');
};

const checkRedis = async () => {
  // Check Redis connection
  // throw new Error('Redis connection failed');
};

const checkExternalAPI = async () => {
  // Check external service
  // const response = await fetch('https://api.example.com/health');
  // if (!response.ok) throw new Error('External API unavailable');
};

module.exports = {
  database: checkDatabase,
  redis: checkRedis,
  externalAPI: checkExternalAPI
};`
            }
        };

        const instructions = `1. Import health check router in your main app
2. Use: app.use(createHealthCheck(dependencies))
3. Access endpoints:
   - GET /health - Overall health
   - GET /health/ready - Readiness probe
   - GET /health/live - Liveness probe
4. Customize dependency checks`;

        return {
            files: configs[framework as keyof typeof configs] || configs.express,
            instructions
        };
    }

    private createEnvironmentConfigs(environments: string[]): any {
        const files: Record<string, string> = {};

        for (const env of environments) {
            files[`${env}.json`] = JSON.stringify({
                name: env,
                database: {
                    host: env === 'production' ? 'prod-db.example.com' : 'localhost',
                    port: 5432,
                    name: `myapp_${env}`,
                    ssl: env === 'production'
                },
                redis: {
                    host: env === 'production' ? 'redis.example.com' : 'localhost',
                    port: 6379
                },
                app: {
                    port: env === 'production' ? 3000 : 3000 + environments.indexOf(env),
                    logLevel: env === 'production' ? 'info' : 'debug',
                    cors: {
                        origin: env === 'production' ? 'https://myapp.com' : '*'
                    }
                },
                features: {
                    debugMode: env !== 'production',
                    analytics: env === 'production',
                    monitoring: env !== 'development'
                }
            }, null, 2);
        }

        // Configuration loader
        files['index.js'] = `const fs = require('fs');
const path = require('path');

const loadConfig = (environment = process.env.NODE_ENV || 'development') => {
  const configPath = path.join(__dirname, \`\${environment}.json\`);
  
  if (!fs.existsSync(configPath)) {
    throw new Error(\`Configuration file not found: \${configPath}\`);
  }
  
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  // Override with environment variables
  return {
    ...config,
    database: {
      ...config.database,
      host: process.env.DB_HOST || config.database.host,
      port: parseInt(process.env.DB_PORT) || config.database.port,
      name: process.env.DB_NAME || config.database.name
    },
    app: {
      ...config.app,
      port: parseInt(process.env.PORT) || config.app.port
    }
  };
};

module.exports = { loadConfig };`;

        const instructions = `1. Use: const { loadConfig } = require('./config/environments')
2. Load config: const config = loadConfig(process.env.NODE_ENV)
3. Set NODE_ENV environment variable
4. Override with environment variables as needed`;

        return { files, instructions };
    }

    private createSecretsConfig(platform: string): any {
        const configs = {
            kubernetes: {
                'secrets.yaml': `apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: default
type: Opaque
data:
  # Base64 encoded values
  database-url: cG9zdGdyZXM6Ly91c2VyOnBhc3N3b3JkQGhvc3Q6cG9ydC9kYXRhYmFzZQ==
  jwt-secret: eW91ci1qd3Qtc2VjcmV0LWhlcmU=
  api-key: eW91ci1hcGkta2V5LWhlcmU=`,
                'external-secrets.yaml': `apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: vault-backend
  namespace: default
spec:
  provider:
    vault:
      server: "https://vault.example.com"
      path: "secret"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: "myapp-role"
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: app-secrets-external
  namespace: default
spec:
  refreshInterval: 15s
  secretStoreRef:
    name: vault-backend
    kind: SecretStore
  target:
    name: app-secrets
    creationPolicy: Owner
  data:
  - secretKey: database-url
    remoteRef:
      key: myapp
      property: database_url
  - secretKey: jwt-secret
    remoteRef:
      key: myapp
      property: jwt_secret`
            },
            aws: {
                'secrets-manager.tf': `resource "aws_secretsmanager_secret" "app_secrets" {
  name                    = "myapp/secrets"
  description            = "Application secrets"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    database_url = "postgres://user:pass@host:port/db"
    jwt_secret   = "your-jwt-secret"
    api_key      = "your-api-key"
  })
}

# IAM role for accessing secrets
resource "aws_iam_role" "app_secrets_role" {
  name = "myapp-secrets-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "app_secrets_policy" {
  name = "myapp-secrets-policy"
  role = aws_iam_role.app_secrets_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = aws_secretsmanager_secret.app_secrets.arn
      }
    ]
  })
}`,
                'secrets-loader.js': `const AWS = require('aws-sdk');

const secretsManager = new AWS.SecretsManager({
  region: process.env.AWS_REGION || 'us-west-2'
});

const getSecrets = async (secretName = 'myapp/secrets') => {
  try {
    const result = await secretsManager.getSecretValue({
      SecretId: secretName
    }).promise();
    
    return JSON.parse(result.SecretString);
  } catch (error) {
    console.error('Error retrieving secrets:', error);
    throw error;
  }
};

module.exports = { getSecrets };`
            }
        };

        const instructions = platform === 'kubernetes' 
            ? `1. Apply secrets: kubectl apply -f secrets/
2. Use in pods via environment variables or volume mounts
3. Consider using External Secrets Operator for production
4. Encode secrets in base64: echo -n "secret" | base64`
            : `1. Apply Terraform: terraform apply
2. Use AWS SDK to retrieve secrets in application
3. Configure IAM roles for EC2/ECS/Lambda access
4. Set up secret rotation policies`;

        return {
            files: configs[platform as keyof typeof configs] || configs.kubernetes,
            instructions
        };
    }

    private createMonitoringConfig(tools: string[]): any {
        const files: Record<string, string> = {};

        if (tools.includes('prometheus')) {
            files['prometheus.yml'] = `global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'app'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s`;

            files['alert_rules.yml'] = `groups:
- name: application
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: High error rate detected

  - alert: HighMemoryUsage
    expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: High memory usage detected`;
        }

        if (tools.includes('grafana')) {
            files['grafana-dashboard.json'] = JSON.stringify({
                dashboard: {
                    title: "Application Monitoring",
                    panels: [
                        {
                            title: "Request Rate",
                            type: "graph",
                            targets: [
                                {
                                    expr: "rate(http_requests_total[5m])",
                                    legendFormat: "Requests/sec"
                                }
                            ]
                        },
                        {
                            title: "Response Time",
                            type: "graph",
                            targets: [
                                {
                                    expr: "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
                                    legendFormat: "95th percentile"
                                }
                            ]
                        },
                        {
                            title: "Error Rate",
                            type: "graph",
                            targets: [
                                {
                                    expr: "rate(http_requests_total{status=~\"5..\"}[5m])",
                                    legendFormat: "Error rate"
                                }
                            ]
                        }
                    ]
                }
            }, null, 2);
        }

        files['docker-compose.monitoring.yml'] = `version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - ./alert_rules.yml:/etc/prometheus/alert_rules.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.enable-lifecycle'

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
    depends_on:
      - prometheus

  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    ports:
      - "9100:9100"

  alertmanager:
    image: prom/alertmanager:latest
    container_name: alertmanager
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml

volumes:
  prometheus_data:
  grafana_data:`;

        files['alertmanager.yml'] = `global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@example.com'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
- name: 'web.hook'
  email_configs:
  - to: 'admin@example.com'
    subject: 'Alert: {{ .GroupLabels.alertname }}'
    body: |
      {{ range .Alerts }}
      Alert: {{ .Annotations.summary }}
      Description: {{ .Annotations.description }}
      {{ end }}

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'dev', 'instance']`;

        const instructions = `1. Start monitoring stack: docker-compose -f docker-compose.monitoring.yml up -d
2. Access Prometheus: http://localhost:9090
3. Access Grafana: http://localhost:3001 (admin/admin)
4. Import dashboard from grafana-dashboard.json
5. Configure alerting channels in Grafana
6. Add metrics to your application`;

        return { files, instructions };
    }
}
