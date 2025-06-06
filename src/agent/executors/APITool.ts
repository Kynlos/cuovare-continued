import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ToolExecutor, ToolMetadata, ToolResult } from '../ToolRegistry';

export class APITool implements ToolExecutor {
    readonly metadata: ToolMetadata = {
        name: 'api',
        description: 'API testing, documentation generation, and integration tools',
        category: 'API & Integration',
        parameters: [
            {
                name: 'action',
                description: 'API action to perform',
                required: true,
                type: 'string'
            }
        ]
    };

    readonly methods = {
        'testEndpoint': {
            description: 'Test an API endpoint with various HTTP methods',
            parameters: {
                url: { type: 'string', description: 'API endpoint URL' },
                method: { type: 'string', description: 'HTTP method (GET, POST, PUT, DELETE, PATCH)' },
                headers: { type: 'object', description: 'Request headers', optional: true },
                body: { type: 'object', description: 'Request body for POST/PUT/PATCH', optional: true },
                auth: { type: 'object', description: 'Authentication credentials', optional: true }
            }
        },
        'generateOpenAPI': {
            description: 'Generate OpenAPI specification from Express routes or code',
            parameters: {
                routesPath: { type: 'string', description: 'Path to routes directory or file' },
                outputPath: { type: 'string', description: 'Output path for OpenAPI spec', optional: true }
            }
        },
        'validateOpenAPI': {
            description: 'Validate OpenAPI specification file',
            parameters: {
                specPath: { type: 'string', description: 'Path to OpenAPI specification file' }
            }
        },
        'generateClient': {
            description: 'Generate API client code from OpenAPI spec',
            parameters: {
                specPath: { type: 'string', description: 'Path to OpenAPI specification' },
                language: { type: 'string', description: 'Target language (typescript, javascript, python, java)' },
                outputDir: { type: 'string', description: 'Output directory for generated client', optional: true }
            }
        },
        'mockServer': {
            description: 'Generate mock server from OpenAPI specification',
            parameters: {
                specPath: { type: 'string', description: 'Path to OpenAPI specification' },
                port: { type: 'number', description: 'Port for mock server', optional: true }
            }
        },
        'testSuite': {
            description: 'Generate comprehensive API test suite',
            parameters: {
                specPath: { type: 'string', description: 'Path to OpenAPI specification' },
                framework: { type: 'string', description: 'Test framework (jest, mocha, cypress)', optional: true }
            }
        },
        'loadTest': {
            description: 'Perform load testing on API endpoints',
            parameters: {
                url: { type: 'string', description: 'API endpoint URL' },
                concurrency: { type: 'number', description: 'Number of concurrent requests', optional: true },
                duration: { type: 'number', description: 'Test duration in seconds', optional: true }
            }
        },
        'generatePostman': {
            description: 'Generate Postman collection from OpenAPI spec',
            parameters: {
                specPath: { type: 'string', description: 'Path to OpenAPI specification' },
                outputPath: { type: 'string', description: 'Output path for Postman collection', optional: true }
            }
        },
        'analyzeAPI': {
            description: 'Analyze API for best practices and security issues',
            parameters: {
                specPath: { type: 'string', description: 'Path to OpenAPI specification' }
            }
        },
        'generateDocs': {
            description: 'Generate beautiful API documentation',
            parameters: {
                specPath: { type: 'string', description: 'Path to OpenAPI specification' },
                outputDir: { type: 'string', description: 'Output directory for documentation', optional: true },
                theme: { type: 'string', description: 'Documentation theme (swagger-ui, redoc, slate)', optional: true }
            }
        }
    };

    async execute(method: string, args: Record<string, any>): Promise<ToolResult> {
        try {
            switch (method) {
                case 'testEndpoint':
                    return await this.testEndpoint(args.url, args.method, args.headers, args.body, args.auth);
                case 'generateOpenAPI':
                    return await this.generateOpenAPI(args.routesPath, args.outputPath);
                case 'validateOpenAPI':
                    return await this.validateOpenAPI(args.specPath);
                case 'generateClient':
                    return await this.generateClient(args.specPath, args.language, args.outputDir);
                case 'mockServer':
                    return await this.mockServer(args.specPath, args.port);
                case 'testSuite':
                    return await this.testSuite(args.specPath, args.framework);
                case 'loadTest':
                    return await this.loadTest(args.url, args.concurrency, args.duration);
                case 'generatePostman':
                    return await this.generatePostman(args.specPath, args.outputPath);
                case 'analyzeAPI':
                    return await this.analyzeAPI(args.specPath);
                case 'generateDocs':
                    return await this.generateDocs(args.specPath, args.outputDir, args.theme);
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

    private async testEndpoint(
        url: string, 
        method: string, 
        headers?: Record<string, string>, 
        body?: any, 
        auth?: Record<string, string>
    ): Promise<ToolResult> {
        try {
            const requestOptions: RequestInit = {
                method: method.toUpperCase(),
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                }
            };

            // Add authentication
            if (auth) {
                if (auth.type === 'bearer') {
                    requestOptions.headers = {
                        ...requestOptions.headers,
                        'Authorization': `Bearer ${auth.token}`
                    };
                } else if (auth.type === 'basic') {
                    const credentials = btoa(`${auth.username}:${auth.password}`);
                    requestOptions.headers = {
                        ...requestOptions.headers,
                        'Authorization': `Basic ${credentials}`
                    };
                }
            }

            // Add body for POST/PUT/PATCH requests
            if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
                requestOptions.body = JSON.stringify(body);
            }

            const startTime = Date.now();
            const response = await fetch(url, requestOptions);
            const endTime = Date.now();
            const responseTime = endTime - startTime;

            let responseData;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                responseData = await response.json();
            } else {
                responseData = await response.text();
            }

            const result = {
                url,
                method: method.toUpperCase(),
                status: response.status,
                statusText: response.statusText,
                responseTime: `${responseTime}ms`,
                headers: Object.fromEntries(response.headers.entries()),
                data: responseData,
                success: response.ok
            };

            return {
                success: true,
                result: JSON.stringify(result, null, 2)
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to test endpoint: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async generateOpenAPI(routesPath: string, outputPath?: string): Promise<ToolResult> {
        try {
            const routes = await this.extractRoutes(routesPath);
            const openAPISpec = this.createOpenAPISpec(routes);

            const outputFile = outputPath || path.join(path.dirname(routesPath), 'openapi.yaml');
            await fs.writeFile(outputFile, this.convertToYAML(openAPISpec));

            return {
                success: true,
                result: `OpenAPI specification generated at ${outputFile}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to generate OpenAPI spec: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async validateOpenAPI(specPath: string): Promise<ToolResult> {
        try {
            const content = await fs.readFile(specPath, 'utf8');
            const spec = this.parseOpenAPISpec(content);
            const validation = this.validateOpenAPIStructure(spec);

            return {
                success: validation.valid,
                result: JSON.stringify(validation, null, 2)
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to validate OpenAPI spec: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async generateClient(specPath: string, language: string, outputDir?: string): Promise<ToolResult> {
        try {
            const spec = await this.loadOpenAPISpec(specPath);
            const clientCode = this.generateClientCode(spec, language);

            const outputDirectory = outputDir || path.join(path.dirname(specPath), 'generated-client');
            await fs.mkdir(outputDirectory, { recursive: true });

            const files = await this.writeClientFiles(clientCode, outputDirectory, language);

            return {
                success: true,
                result: `API client generated in ${outputDirectory}: ${files.join(', ')}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to generate client: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async mockServer(specPath: string, port: number = 3001): Promise<ToolResult> {
        try {
            const spec = await this.loadOpenAPISpec(specPath);
            const mockServerCode = this.generateMockServerCode(spec, port);

            const serverPath = path.join(path.dirname(specPath), 'mock-server.js');
            await fs.writeFile(serverPath, mockServerCode);

            return {
                success: true,
                result: `Mock server generated at ${serverPath}. Run with: node ${serverPath}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to generate mock server: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async testSuite(specPath: string, framework: string = 'jest'): Promise<ToolResult> {
        try {
            const spec = await this.loadOpenAPISpec(specPath);
            const testCode = this.generateTestSuite(spec, framework);

            const testDir = path.join(path.dirname(specPath), 'api-tests');
            await fs.mkdir(testDir, { recursive: true });

            const testFiles = await this.writeTestFiles(testCode, testDir, framework);

            return {
                success: true,
                result: `API test suite generated in ${testDir}: ${testFiles.join(', ')}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to generate test suite: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async loadTest(url: string, concurrency: number = 10, duration: number = 30): Promise<ToolResult> {
        try {
            const results = await this.performLoadTest(url, concurrency, duration);

            return {
                success: true,
                result: JSON.stringify(results, null, 2)
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to perform load test: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async generatePostman(specPath: string, outputPath?: string): Promise<ToolResult> {
        try {
            const spec = await this.loadOpenAPISpec(specPath);
            const collection = this.createPostmanCollection(spec);

            const outputFile = outputPath || path.join(path.dirname(specPath), 'postman-collection.json');
            await fs.writeFile(outputFile, JSON.stringify(collection, null, 2));

            return {
                success: true,
                result: `Postman collection generated at ${outputFile}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to generate Postman collection: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async analyzeAPI(specPath: string): Promise<ToolResult> {
        try {
            const spec = await this.loadOpenAPISpec(specPath);
            const analysis = this.performAPIAnalysis(spec);

            return {
                success: true,
                result: JSON.stringify(analysis, null, 2)
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to analyze API: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async generateDocs(specPath: string, outputDir?: string, theme: string = 'swagger-ui'): Promise<ToolResult> {
        try {
            const spec = await this.loadOpenAPISpec(specPath);
            const docsHtml = this.generateDocumentationHTML(spec, theme);

            const outputDirectory = outputDir || path.join(path.dirname(specPath), 'api-docs');
            await fs.mkdir(outputDirectory, { recursive: true });

            const indexPath = path.join(outputDirectory, 'index.html');
            await fs.writeFile(indexPath, docsHtml);

            return {
                success: true,
                result: `API documentation generated at ${indexPath}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to generate documentation: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    // Helper methods
    private async extractRoutes(routesPath: string): Promise<any[]> {
        const routes = [];
        
        try {
            const stats = await fs.stat(routesPath);
            
            if (stats.isDirectory()) {
                const files = await fs.readdir(routesPath);
                for (const file of files) {
                    if (file.endsWith('.ts') || file.endsWith('.js')) {
                        const filePath = path.join(routesPath, file);
                        const fileRoutes = await this.parseRouteFile(filePath);
                        routes.push(...fileRoutes);
                    }
                }
            } else {
                const fileRoutes = await this.parseRouteFile(routesPath);
                routes.push(...fileRoutes);
            }
        } catch (error) {
            // If file/directory doesn't exist, return empty routes
        }

        return routes;
    }

    private async parseRouteFile(filePath: string): Promise<any[]> {
        const content = await fs.readFile(filePath, 'utf8');
        const routes = [];

        // Simple regex to extract Express routes
        const routeRegex = /(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
        let match;

        while ((match = routeRegex.exec(content)) !== null) {
            routes.push({
                method: match[1].toUpperCase(),
                path: match[2],
                file: filePath
            });
        }

        return routes;
    }

    private createOpenAPISpec(routes: any[]): any {
        const spec = {
            openapi: '3.0.0',
            info: {
                title: 'Generated API',
                version: '1.0.0',
                description: 'API specification generated from routes'
            },
            servers: [
                {
                    url: 'http://localhost:3000',
                    description: 'Development server'
                }
            ],
            paths: {} as Record<string, any>
        };

        for (const route of routes) {
            if (!spec.paths[route.path]) {
                spec.paths[route.path] = {};
            }

            spec.paths[route.path][route.method.toLowerCase()] = {
                summary: `${route.method} ${route.path}`,
                responses: {
                    '200': {
                        description: 'Successful response',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object'
                                }
                            }
                        }
                    }
                }
            };
        }

        return spec;
    }

    private convertToYAML(obj: any): string {
        // Simple YAML conversion for basic objects
        return JSON.stringify(obj, null, 2)
            .replace(/"/g, '')
            .replace(/,\n/g, '\n')
            .replace(/{\n/g, '\n')
            .replace(/}\n/g, '\n');
    }

    private parseOpenAPISpec(content: string): any {
        try {
            // Try JSON first
            return JSON.parse(content);
        } catch {
            // Simple YAML parsing (basic implementation)
            return this.parseSimpleYAML(content);
        }
    }

    private parseSimpleYAML(content: string): any {
        // Very basic YAML parsing - in production, use a proper YAML library
        const lines = content.split('\n');
        const result: any = {};
        
        // This is a simplified implementation
        // In practice, you'd use a proper YAML parser like js-yaml
        
        return result;
    }

    private validateOpenAPIStructure(spec: any): any {
        const issues = [];
        const warnings = [];

        // Required fields validation
        if (!spec.openapi) {
            issues.push('Missing required field: openapi');
        }

        if (!spec.info) {
            issues.push('Missing required field: info');
        } else {
            if (!spec.info.title) {
                issues.push('Missing required field: info.title');
            }
            if (!spec.info.version) {
                issues.push('Missing required field: info.version');
            }
        }

        if (!spec.paths) {
            issues.push('Missing required field: paths');
        } else {
            // Validate paths
            for (const [path, methods] of Object.entries(spec.paths)) {
                if (typeof methods !== 'object') {
                    issues.push(`Invalid path definition: ${path}`);
                }
            }
        }

        // Best practices warnings
        if (!spec.servers || spec.servers.length === 0) {
            warnings.push('Consider adding server definitions');
        }

        if (!spec.components) {
            warnings.push('Consider using components for reusable schemas');
        }

        return {
            valid: issues.length === 0,
            issues,
            warnings
        };
    }

    private async loadOpenAPISpec(specPath: string): Promise<any> {
        const content = await fs.readFile(specPath, 'utf8');
        return this.parseOpenAPISpec(content);
    }

    private generateClientCode(spec: any, language: string): any {
        switch (language) {
            case 'typescript':
                return this.generateTypeScriptClient(spec);
            case 'javascript':
                return this.generateJavaScriptClient(spec);
            case 'python':
                return this.generatePythonClient(spec);
            default:
                throw new Error(`Unsupported language: ${language}`);
        }
    }

    private generateTypeScriptClient(spec: any): any {
        const baseUrl = spec.servers?.[0]?.url || 'http://localhost:3000';
        
        return {
            'api-client.ts': `export class APIClient {
  private baseUrl: string;

  constructor(baseUrl: string = '${baseUrl}') {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    path: string,
    method: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<T> {
    const response = await fetch(\`\${this.baseUrl}\${path}\`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(\`API request failed: \${response.statusText}\`);
    }

    return response.json();
  }

  ${this.generateClientMethods(spec.paths, 'typescript')}
}`,
            'types.ts': this.generateTypeScriptTypes(spec)
        };
    }

    private generateJavaScriptClient(spec: any): any {
        const baseUrl = spec.servers?.[0]?.url || 'http://localhost:3000';
        
        return {
            'api-client.js': `class APIClient {
  constructor(baseUrl = '${baseUrl}') {
    this.baseUrl = baseUrl;
  }

  async request(path, method, data, headers = {}) {
    const response = await fetch(\`\${this.baseUrl}\${path}\`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(\`API request failed: \${response.statusText}\`);
    }

    return response.json();
  }

  ${this.generateClientMethods(spec.paths, 'javascript')}
}

module.exports = { APIClient };`
        };
    }

    private generatePythonClient(spec: any): any {
        const baseUrl = spec.servers?.[0]?.url || 'http://localhost:3000';
        
        return {
            'api_client.py': `import requests
from typing import Dict, Any, Optional

class APIClient:
    def __init__(self, base_url: str = "${baseUrl}"):
        self.base_url = base_url

    def _request(self, path: str, method: str, data: Optional[Dict[str, Any]] = None, 
                headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        headers = headers or {}
        headers.update({"Content-Type": "application/json"})
        
        response = requests.request(
            method=method,
            url=url,
            json=data,
            headers=headers
        )
        
        response.raise_for_status()
        return response.json()

    ${this.generateClientMethods(spec.paths, 'python')}
`
        };
    }

    private generateClientMethods(paths: any, language: string): string {
        const methods = [];
        
        for (const [path, pathMethods] of Object.entries(paths)) {
            for (const [method, operation] of Object.entries(pathMethods as any)) {
                const methodName = this.generateMethodName(method, path);
                methods.push(this.generateMethod(methodName, method, path, operation, language));
            }
        }
        
        return methods.join('\n\n  ');
    }

    private generateMethodName(method: string, path: string): string {
        const pathSegments = path.split('/').filter(segment => segment && !segment.startsWith(':'));
        const resource = pathSegments[pathSegments.length - 1] || 'resource';
        
        return `${method}${resource.charAt(0).toUpperCase() + resource.slice(1)}`;
    }

    private generateMethod(methodName: string, method: string, path: string, operation: any, language: string): string {
        switch (language) {
            case 'typescript':
                return `async ${methodName}(${this.generateTSParams(path, operation)}): Promise<any> {
    return this.request('${path}', '${method.toUpperCase()}'${this.generateTSArgs(operation)});
  }`;
            case 'javascript':
                return `async ${methodName}(${this.generateJSParams(path, operation)}) {
    return this.request('${path}', '${method.toUpperCase()}'${this.generateJSArgs(operation)});
  }`;
            case 'python':
                return `def ${methodName.toLowerCase()}(self${this.generatePyParams(path, operation)}) -> Dict[str, Any]:
        return self._request('${path}', '${String(method).toUpperCase()}'${this.generatePyArgs(operation)})`;
            default:
                return '';
        }
    }

    private generateTSParams(path: string, operation: any): string {
        const params = [];
        
        // Path parameters
        const pathParams = path.match(/{([^}]+)}/g);
        if (pathParams) {
            params.push(...pathParams.map(param => `${param.slice(1, -1)}: string`));
        }
        
        // Body parameter for POST/PUT/PATCH
        if (operation.requestBody) {
            params.push('data?: any');
        }
        
        return params.join(', ');
    }

    private generateJSParams(path: string, operation: any): string {
        const params = [];
        
        // Path parameters
        const pathParams = path.match(/{([^}]+)}/g);
        if (pathParams) {
            params.push(...pathParams.map(param => param.slice(1, -1)));
        }
        
        // Body parameter
        if (operation.requestBody) {
            params.push('data');
        }
        
        return params.join(', ');
    }

    private generatePyParams(path: string, operation: any): string {
        const params = [];
        
        // Path parameters
        const pathParams = path.match(/{([^}]+)}/g);
        if (pathParams) {
            params.push(...pathParams.map(param => `, ${param.slice(1, -1)}: str`));
        }
        
        // Body parameter
        if (operation.requestBody) {
            params.push(', data: Optional[Dict[str, Any]] = None');
        }
        
        return params.join('');
    }

    private generateTSArgs(operation: any): string {
        if (operation.requestBody) {
            return ', data';
        }
        return '';
    }

    private generateJSArgs(operation: any): string {
        if (operation.requestBody) {
            return ', data';
        }
        return '';
    }

    private generatePyArgs(operation: any): string {
        if (operation.requestBody) {
            return ', data';
        }
        return '';
    }

    private generateTypeScriptTypes(spec: any): string {
        // Generate TypeScript interfaces from OpenAPI components
        return `// Generated TypeScript types
export interface APIResponse<T = any> {
  data: T;
  status: number;
  message?: string;
}

// Add more specific types based on your API schema
`;
    }

    private async writeClientFiles(clientCode: any, outputDir: string, language: string): Promise<string[]> {
        const files = [];
        
        for (const [filename, content] of Object.entries(clientCode)) {
            const filePath = path.join(outputDir, filename);
            await fs.writeFile(filePath, content as string);
            files.push(filename);
        }
        
        return files;
    }

    private generateMockServerCode(spec: any, port: number): string {
        return `const express = require('express');
const app = express();
const port = ${port};

app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

${this.generateMockRoutes(spec.paths)}

app.listen(port, () => {
  console.log(\`Mock server running on http://localhost:\${port}\`);
});
`;
    }

    private generateMockRoutes(paths: any): string {
        const routes = [];
        
        for (const [path, methods] of Object.entries(paths)) {
            for (const [method, operation] of Object.entries(methods as any)) {
                const expressPath = path.replace(/{([^}]+)}/g, ':$1');
                const mockData = this.generateMockData(operation);
                
                routes.push(`app.${method}('${expressPath}', (req, res) => {
  res.json(${JSON.stringify(mockData, null, 2)});
});`);
            }
        }
        
        return routes.join('\n\n');
    }

    private generateMockData(operation: any): any {
        // Generate mock data based on operation responses
        return {
            id: 1,
            message: 'Mock response',
            timestamp: new Date().toISOString(),
            data: {}
        };
    }

    private generateTestSuite(spec: any, framework: string): any {
        switch (framework) {
            case 'jest':
                return this.generateJestTests(spec);
            case 'mocha':
                return this.generateMochaTests(spec);
            case 'cypress':
                return this.generateCypressTests(spec);
            default:
                throw new Error(`Unsupported test framework: ${framework}`);
        }
    }

    private generateJestTests(spec: any): any {
        return {
            'api.test.js': `const { APIClient } = require('../generated-client/api-client');

describe('API Tests', () => {
  let client;

  beforeAll(() => {
    client = new APIClient();
  });

  ${this.generateJestTestCases(spec.paths)}
});`
        };
    }

    private generateMochaTests(spec: any): any {
        return {
            'api.test.js': `const { expect } = require('chai');
const { APIClient } = require('../generated-client/api-client');

describe('API Tests', () => {
  let client;

  before(() => {
    client = new APIClient();
  });

  ${this.generateMochaTestCases(spec.paths)}
});`
        };
    }

    private generateCypressTests(spec: any): any {
        return {
            'api.cy.js': `describe('API Tests', () => {
  ${this.generateCypressTestCases(spec.paths)}
});`
        };
    }

    private generateJestTestCases(paths: any): string {
        const testCases = [];
        
        for (const [path, methods] of Object.entries(paths)) {
            for (const [method, operation] of Object.entries(methods as any)) {
                testCases.push(`it('should ${method.toUpperCase()} ${path}', async () => {
    // Add your test implementation
    expect(true).toBe(true);
  });`);
            }
        }
        
        return testCases.join('\n\n  ');
    }

    private generateMochaTestCases(paths: any): string {
        const testCases = [];
        
        for (const [path, methods] of Object.entries(paths)) {
            for (const [method, operation] of Object.entries(methods as any)) {
                testCases.push(`it('should ${method.toUpperCase()} ${path}', async () => {
    // Add your test implementation
    expect(true).to.be.true;
  });`);
            }
        }
        
        return testCases.join('\n\n  ');
    }

    private generateCypressTestCases(paths: any): string {
        const testCases = [];
        
        for (const [path, methods] of Object.entries(paths)) {
            for (const [method, operation] of Object.entries(methods as any)) {
                testCases.push(`it('should ${method.toUpperCase()} ${path}', () => {
    cy.request('${method.toUpperCase()}', '${path}').then((response) => {
      expect(response.status).to.eq(200);
    });
  });`);
            }
        }
        
        return testCases.join('\n\n  ');
    }

    private async writeTestFiles(testCode: any, testDir: string, framework: string): Promise<string[]> {
        const files = [];
        
        for (const [filename, content] of Object.entries(testCode)) {
            const filePath = path.join(testDir, filename);
            await fs.writeFile(filePath, content as string);
            files.push(filename);
        }
        
        return files;
    }

    private async performLoadTest(url: string, concurrency: number, duration: number): Promise<any> {
        const results = {
            url,
            concurrency,
            duration,
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            minResponseTime: Infinity,
            maxResponseTime: 0,
            requestsPerSecond: 0
        };

        const startTime = Date.now();
        const endTime = startTime + (duration * 1000);
        const responseTimes: number[] = [];

        const makeRequest = async (): Promise<void> => {
            const requestStart = Date.now();
            try {
                const response = await fetch(url);
                const requestEnd = Date.now();
                const responseTime = requestEnd - requestStart;
                
                responseTimes.push(responseTime);
                results.totalRequests++;
                
                if (response.ok) {
                    results.successfulRequests++;
                } else {
                    results.failedRequests++;
                }
                
                results.minResponseTime = Math.min(results.minResponseTime, responseTime);
                results.maxResponseTime = Math.max(results.maxResponseTime, responseTime);
            } catch (error) {
                results.totalRequests++;
                results.failedRequests++;
            }
        };

        const workers = Array(concurrency).fill(null).map(async () => {
            while (Date.now() < endTime) {
                await makeRequest();
                // Small delay to prevent overwhelming the server
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        });

        await Promise.all(workers);

        // Calculate statistics
        if (responseTimes.length > 0) {
            results.averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        }
        
        results.requestsPerSecond = results.totalRequests / duration;

        return results;
    }

    private createPostmanCollection(spec: any): any {
        const collection = {
            info: {
                name: spec.info?.title || 'Generated API Collection',
                description: spec.info?.description || 'Generated from OpenAPI specification',
                schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
            },
            item: [] as any[]
        };

        for (const [path, methods] of Object.entries(spec.paths)) {
            for (const [method, operation] of Object.entries(methods as any)) {
                const operationTyped = operation as any;
                const item = {
                    name: `${method.toUpperCase()} ${path}`,
                    request: {
                        method: method.toUpperCase(),
                        header: [
                            {
                                key: 'Content-Type',
                                value: 'application/json'
                            }
                        ],
                        url: {
                            raw: `{{baseUrl}}${path}`,
                            host: ['{{baseUrl}}'],
                            path: path.split('/').filter(segment => segment)
                        }
                    }
                };

                if (operationTyped.requestBody) {
                    (item.request as any).body = {
                        mode: 'raw',
                        raw: JSON.stringify(this.generateSampleBody(operationTyped.requestBody), null, 2)
                    };
                }

                collection.item.push(item);
            }
        }

        return collection;
    }

    private generateSampleBody(requestBody: any): any {
        // Generate sample request body based on schema
        return {
            example: 'data'
        };
    }

    private performAPIAnalysis(spec: any): any {
        const analysis = {
            overview: {
                title: spec.info?.title,
                version: spec.info?.version,
                pathCount: Object.keys(spec.paths || {}).length,
                operationCount: this.countOperations(spec.paths)
            },
            security: this.analyzeSecurityIssues(spec),
            bestPractices: this.analyzeBestPractices(spec),
            performance: this.analyzePerformance(spec),
            recommendations: [] as string[]
        };

        // Generate recommendations based on analysis
        if (analysis.security.issues.length > 0) {
            analysis.recommendations.push('Address security issues found in the analysis');
        }

        if (analysis.bestPractices.issues.length > 0) {
            analysis.recommendations.push('Follow API best practices to improve consistency');
        }

        return analysis;
    }

    private countOperations(paths: any): number {
        let count = 0;
        for (const methods of Object.values(paths || {})) {
            count += Object.keys(methods as any).length;
        }
        return count;
    }

    private analyzeSecurityIssues(spec: any): any {
        const issues = [];
        const recommendations = [];

        // Check for security schemes
        if (!spec.components?.securitySchemes) {
            issues.push('No security schemes defined');
            recommendations.push('Add authentication mechanisms like JWT, API keys, or OAuth');
        }

        // Check for global security
        if (!spec.security) {
            issues.push('No global security requirements defined');
            recommendations.push('Define global security requirements');
        }

        return { issues, recommendations };
    }

    private analyzeBestPractices(spec: any): any {
        const issues = [] as string[];
        const recommendations = [] as string[];

        // Check for consistent naming
        const paths = Object.keys(spec.paths || {});
        const hasInconsistentNaming = paths.some(path => 
            path.includes('_') && paths.some(p => p.includes('-'))
        );

        if (hasInconsistentNaming) {
            issues.push('Inconsistent path naming conventions');
            recommendations.push('Use consistent naming (either snake_case or kebab-case)');
        }

        // Check for missing descriptions
        for (const [path, methods] of Object.entries(spec.paths || {})) {
            for (const [method, operation] of Object.entries(methods as any)) {
                const operationTyped = operation as any;
                if (!operationTyped.description && !operationTyped.summary) {
                    issues.push(`Missing description for ${method.toUpperCase()} ${path}`);
                }
            }
        }

        return { issues, recommendations };
    }

    private analyzePerformance(spec: any): any {
        const issues = [] as any[];
        const recommendations = [] as string[];

        // Check for pagination
        const hasPaginationParams = JSON.stringify(spec).includes('limit') || 
                                  JSON.stringify(spec).includes('offset') ||
                                  JSON.stringify(spec).includes('page');

        if (!hasPaginationParams) {
            recommendations.push('Consider implementing pagination for list endpoints');
        }

        // Check for caching headers
        const hasCachingHeaders = JSON.stringify(spec).includes('ETag') ||
                                JSON.stringify(spec).includes('Cache-Control');

        if (!hasCachingHeaders) {
            recommendations.push('Consider implementing caching headers for better performance');
        }

        return { issues, recommendations };
    }

    private generateDocumentationHTML(spec: any, theme: string): string {
        switch (theme) {
            case 'swagger-ui':
                return this.generateSwaggerUIHTML(spec);
            case 'redoc':
                return this.generateRedocHTML(spec);
            case 'slate':
                return this.generateSlateHTML(spec);
            default:
                return this.generateSwaggerUIHTML(spec);
        }
    }

    private generateSwaggerUIHTML(spec: any): string {
        return `<!DOCTYPE html>
<html>
<head>
    <title>${spec.info?.title || 'API Documentation'}</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui.css" />
    <style>
        html {
            box-sizing: border-box;
            overflow: -moz-scrollbars-vertical;
            overflow-y: scroll;
        }
        *, *:before, *:after {
            box-sizing: inherit;
        }
        body {
            margin:0;
            background: #fafafa;
        }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                spec: ${JSON.stringify(spec, null, 2)},
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout"
            });
        };
    </script>
</body>
</html>`;
    }

    private generateRedocHTML(spec: any): string {
        return `<!DOCTYPE html>
<html>
<head>
    <title>${spec.info?.title || 'API Documentation'}</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>
        body {
            margin: 0;
            padding: 0;
        }
    </style>
</head>
<body>
    <redoc spec-url="./openapi.json"></redoc>
    <script src="https://cdn.jsdelivr.net/npm/redoc@2.0.0/bundles/redoc.standalone.js"></script>
    <script>
        Redoc.init(${JSON.stringify(spec, null, 2)}, {}, document.body);
    </script>
</body>
</html>`;
    }

    private generateSlateHTML(spec: any): string {
        return `<!DOCTYPE html>
<html>
<head>
    <title>${spec.info?.title || 'API Documentation'}</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background: #f8f9fa;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #2c3e50; }
        h2 { color: #34495e; border-bottom: 2px solid #ecf0f1; padding-bottom: 10px; }
        .endpoint { 
            margin: 20px 0; 
            padding: 15px; 
            border-left: 4px solid #3498db; 
            background: #f8f9fa; 
        }
        .method { 
            display: inline-block; 
            padding: 5px 10px; 
            border-radius: 4px; 
            color: white; 
            font-weight: bold; 
            margin-right: 10px; 
        }
        .get { background: #27ae60; }
        .post { background: #e74c3c; }
        .put { background: #f39c12; }
        .delete { background: #8e44ad; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${spec.info?.title || 'API Documentation'}</h1>
        <p>${spec.info?.description || 'API Documentation'}</p>
        
        ${this.generateSlateContent(spec)}
    </div>
</body>
</html>`;
    }

    private generateSlateContent(spec: any): string {
        let content = '<h2>Endpoints</h2>';
        
        for (const [path, methods] of Object.entries(spec.paths || {})) {
            for (const [method, operation] of Object.entries(methods as any)) {
                const operationTyped = operation as any;
                content += `
                    <div class="endpoint">
                        <span class="method ${method}">${method.toUpperCase()}</span>
                        <strong>${path}</strong>
                        <p>${operationTyped.summary || operationTyped.description || 'No description available'}</p>
                    </div>
                `;
            }
        }
        
        return content;
    }
}
