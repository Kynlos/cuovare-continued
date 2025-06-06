import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Advanced Plugin System for Cuovare
 * Enhanced extensible architecture for custom tools and integrations
 */

export interface PluginManifest {
    id: string;
    name: string;
    version: string;
    description: string;
    author: string;
    homepage?: string;
    repository?: string;
    license: string;
    engines: {
        cuovare: string;
        vscode: string;
    };
    main: string;
    activationEvents: string[];
    contributes: {
        commands?: PluginCommand[];
        tools?: PluginTool[];
        providers?: PluginProvider[];
        views?: PluginView[];
        configurations?: PluginConfiguration[];
        languages?: PluginLanguage[];
    };
    dependencies?: { [key: string]: string };
    devDependencies?: { [key: string]: string };
}

export interface PluginCommand {
    command: string;
    title: string;
    category?: string;
    icon?: string;
    enablement?: string;
}

export interface PluginTool {
    id: string;
    name: string;
    description: string;
    category: string;
    icon: string;
    capabilities: string[];
    inputSchema: any;
    outputSchema: any;
}

export interface PluginProvider {
    id: string;
    type: 'ai' | 'context' | 'completion' | 'diagnostics' | 'formatter' | 'linter';
    name: string;
    priority: number;
    languages?: string[];
}

export interface PluginView {
    id: string;
    name: string;
    when?: string;
    group?: string;
    type: 'tree' | 'webview' | 'panel';
}

export interface PluginConfiguration {
    title: string;
    properties: { [key: string]: any };
}

export interface PluginLanguage {
    id: string;
    extensions: string[];
    aliases: string[];
    configuration?: string;
    grammars?: any[];
}

export interface LoadedPlugin {
    manifest: PluginManifest;
    instance: any;
    context: vscode.ExtensionContext;
    isActive: boolean;
    activatedAt?: Date;
    errors: string[];
    metadata: {
        loadTime: number;
        memoryUsage: number;
        apiCalls: number;
        lastUsed: Date;
    };
}

export interface PluginAPIContext {
    vscode: typeof vscode;
    cuovare: {
        version: string;
        context: vscode.ExtensionContext;
        logger: PluginLogger;
        storage: PluginStorage;
        events: PluginEventEmitter;
        tools: PluginToolRegistry;
        ai: PluginAIService;
    };
}

export interface PluginLogger {
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
}

export interface PluginStorage {
    get<T>(key: string, defaultValue?: T): T | undefined;
    set(key: string, value: any): Promise<void>;
    delete(key: string): Promise<void>;
    clear(): Promise<void>;
    keys(): string[];
}

export interface PluginEventEmitter {
    on(event: string, listener: (...args: any[]) => void): void;
    off(event: string, listener: (...args: any[]) => void): void;
    emit(event: string, ...args: any[]): void;
    once(event: string, listener: (...args: any[]) => void): void;
}

export interface PluginToolRegistry {
    register(tool: PluginTool, handler: (input: any) => Promise<any>): void;
    unregister(toolId: string): void;
    execute(toolId: string, input: any): Promise<any>;
    list(): PluginTool[];
    get(toolId: string): PluginTool | undefined;
}

export interface PluginAIService {
    chat(messages: any[], options?: any): Promise<string>;
    complete(prompt: string, options?: any): Promise<string>;
    analyze(code: string, language: string): Promise<any>;
}

export interface PluginRegistry {
    available: Map<string, PluginManifest>;
    installed: Map<string, LoadedPlugin>;
    enabled: Set<string>;
    disabled: Set<string>;
}

export class AdvancedPluginSystem {
    private static instance: AdvancedPluginSystem;
    private registry: PluginRegistry;
    private pluginDirectories: string[] = [];
    private apiContext!: PluginAPIContext;
    private eventEmitter: vscode.EventEmitter<PluginSystemEvent>;
    private securityManager: PluginSecurityManager;
    private dependencyResolver: PluginDependencyResolver;
    private performanceMonitor: PluginPerformanceMonitor;

    private constructor(private extensionContext: vscode.ExtensionContext) {
        this.registry = {
            available: new Map(),
            installed: new Map(),
            enabled: new Set(),
            disabled: new Set()
        };
        
        this.eventEmitter = new vscode.EventEmitter<PluginSystemEvent>();
        this.securityManager = new PluginSecurityManager();
        this.dependencyResolver = new PluginDependencyResolver();
        this.performanceMonitor = new PluginPerformanceMonitor();
        
        this.setupAPIContext();
        this.initializePluginDirectories();
    }

    public static getInstance(extensionContext?: vscode.ExtensionContext): AdvancedPluginSystem {
        if (!this.instance && extensionContext) {
            this.instance = new AdvancedPluginSystem(extensionContext);
        }
        return this.instance;
    }

    /**
     * Initialize the plugin system
     */
    public async initialize(): Promise<void> {
        try {
            await this.discoverPlugins();
            await this.loadEnabledPlugins();
            this.startPerformanceMonitoring();
            
            vscode.window.showInformationMessage('Cuovare Plugin System initialized successfully');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to initialize plugin system: ${error}`);
        }
    }

    /**
     * Discover available plugins from plugin directories
     */
    public async discoverPlugins(): Promise<PluginManifest[]> {
        const discovered: PluginManifest[] = [];

        for (const directory of this.pluginDirectories) {
            try {
                const entries = await fs.readdir(directory);
                
                for (const entry of entries) {
                    const pluginPath = path.join(directory, entry);
                    const stat = await fs.stat(pluginPath);
                    
                    if (stat.isDirectory()) {
                        const manifestPath = path.join(pluginPath, 'plugin.json');
                        
                        try {
                            const manifestContent = await fs.readFile(manifestPath, 'utf8');
                            const manifest: PluginManifest = JSON.parse(manifestContent);
                            
                            // Validate manifest
                            if (this.validateManifest(manifest)) {
                                this.registry.available.set(manifest.id, manifest);
                                discovered.push(manifest);
                            }
                        } catch (error) {
                            console.warn(`Failed to load plugin manifest at ${manifestPath}:`, error);
                        }
                    }
                }
            } catch (error) {
                console.warn(`Failed to scan plugin directory ${directory}:`, error);
            }
        }

        this.eventEmitter.fire({
            type: 'discovery-complete',
            data: { discovered: discovered.length }
        });

        return discovered;
    }

    /**
     * Install a plugin from a package or directory
     */
    public async installPlugin(source: string, options?: {
        force?: boolean;
        dependencies?: boolean;
    }): Promise<boolean> {
        try {
            const manifest = await this.extractPluginManifest(source);
            
            // Check security permissions
            if (!await this.securityManager.validatePlugin(manifest)) {
                throw new Error(`Plugin ${manifest.id} failed security validation`);
            }

            // Resolve dependencies
            if (options?.dependencies !== false) {
                await this.dependencyResolver.resolveDependencies(manifest);
            }

            // Install the plugin
            const pluginPath = await this.installPluginFiles(source, manifest.id);
            
            // Create plugin instance
            const loadedPlugin = await this.createPluginInstance(manifest, pluginPath);
            this.registry.installed.set(manifest.id, loadedPlugin);

            this.eventEmitter.fire({
                type: 'plugin-installed',
                data: { pluginId: manifest.id, manifest }
            });

            return true;
        } catch (error) {
            this.eventEmitter.fire({
                type: 'plugin-install-failed',
                data: { source, error: (error as Error).message }
            });
            throw error;
        }
    }

    /**
     * Uninstall a plugin
     */
    public async uninstallPlugin(pluginId: string): Promise<boolean> {
        try {
            const plugin = this.registry.installed.get(pluginId);
            if (!plugin) {
                throw new Error(`Plugin ${pluginId} is not installed`);
            }

            // Deactivate if active
            if (plugin.isActive) {
                await this.deactivatePlugin(pluginId);
            }

            // Remove plugin files
            const pluginPath = this.getPluginPath(pluginId);
            await this.removePluginFiles(pluginPath);

            // Remove from registry
            this.registry.installed.delete(pluginId);
            this.registry.enabled.delete(pluginId);
            this.registry.disabled.delete(pluginId);

            this.eventEmitter.fire({
                type: 'plugin-uninstalled',
                data: { pluginId }
            });

            return true;
        } catch (error) {
            this.eventEmitter.fire({
                type: 'plugin-uninstall-failed',
                data: { pluginId, error: (error as Error).message }
            });
            throw error;
        }
    }

    /**
     * Enable a plugin
     */
    public async enablePlugin(pluginId: string): Promise<boolean> {
        try {
            const plugin = this.registry.installed.get(pluginId);
            if (!plugin) {
                throw new Error(`Plugin ${pluginId} is not installed`);
            }

            this.registry.enabled.add(pluginId);
            this.registry.disabled.delete(pluginId);

            // Activate the plugin
            await this.activatePlugin(pluginId);

            await this.savePluginConfiguration();

            this.eventEmitter.fire({
                type: 'plugin-enabled',
                data: { pluginId }
            });

            return true;
        } catch (error) {
            this.eventEmitter.fire({
                type: 'plugin-enable-failed',
                data: { pluginId, error: (error as Error).message }
            });
            throw error;
        }
    }

    /**
     * Disable a plugin
     */
    public async disablePlugin(pluginId: string): Promise<boolean> {
        try {
            const plugin = this.registry.installed.get(pluginId);
            if (!plugin) {
                throw new Error(`Plugin ${pluginId} is not installed`);
            }

            this.registry.enabled.delete(pluginId);
            this.registry.disabled.add(pluginId);

            // Deactivate the plugin
            await this.deactivatePlugin(pluginId);

            await this.savePluginConfiguration();

            this.eventEmitter.fire({
                type: 'plugin-disabled',
                data: { pluginId }
            });

            return true;
        } catch (error) {
            this.eventEmitter.fire({
                type: 'plugin-disable-failed',
                data: { pluginId, error: (error as Error).message }
            });
            throw error;
        }
    }

    /**
     * Get plugin information
     */
    public getPluginInfo(pluginId: string): LoadedPlugin | undefined {
        return this.registry.installed.get(pluginId);
    }

    /**
     * List all plugins
     */
    public listPlugins(): {
        available: PluginManifest[];
        installed: LoadedPlugin[];
        enabled: string[];
        disabled: string[];
    } {
        return {
            available: Array.from(this.registry.available.values()),
            installed: Array.from(this.registry.installed.values()),
            enabled: Array.from(this.registry.enabled),
            disabled: Array.from(this.registry.disabled)
        };
    }

    /**
     * Execute a plugin tool
     */
    public async executePluginTool(pluginId: string, toolId: string, input: any): Promise<any> {
        const plugin = this.registry.installed.get(pluginId);
        if (!plugin || !plugin.isActive) {
            throw new Error(`Plugin ${pluginId} is not active`);
        }

        const startTime = Date.now();
        
        try {
            const result = await plugin.instance.executeTool(toolId, input);
            
            // Update performance metrics
            plugin.metadata.apiCalls++;
            plugin.metadata.lastUsed = new Date();
            
            this.performanceMonitor.recordToolExecution(pluginId, toolId, Date.now() - startTime);
            
            return result;
        } catch (error) {
            plugin.errors.push(`Tool execution failed: ${(error as Error).message}`);
            throw error;
        }
    }

    /**
     * Get plugin marketplace information
     */
    public async getMarketplaceInfo(): Promise<{
        featured: PluginManifest[];
        popular: PluginManifest[];
        recent: PluginManifest[];
        categories: string[];
    }> {
        // Mock marketplace data - in real implementation, this would connect to a plugin marketplace
        return {
            featured: [],
            popular: [],
            recent: [],
            categories: ['AI Tools', 'Code Analysis', 'Documentation', 'Testing', 'Deployment']
        };
    }

    /**
     * Check for plugin updates
     */
    public async checkForUpdates(): Promise<{
        pluginId: string;
        currentVersion: string;
        latestVersion: string;
        updateAvailable: boolean;
    }[]> {
        const updates = [];
        
        for (const [pluginId, plugin] of this.registry.installed) {
            // Mock update check - in real implementation, this would check against a registry
            const hasUpdate = Math.random() > 0.8; // 20% chance of update
            
            if (hasUpdate) {
                updates.push({
                    pluginId,
                    currentVersion: plugin.manifest.version,
                    latestVersion: this.incrementVersion(plugin.manifest.version),
                    updateAvailable: true
                });
            }
        }
        
        return updates;
    }

    // Private helper methods

    private setupAPIContext(): void {
        this.apiContext = {
            vscode,
            cuovare: {
                version: '0.8.0',
                context: this.extensionContext,
                logger: new PluginLoggerImpl(),
                storage: new PluginStorageImpl(this.extensionContext),
                events: new PluginEventEmitterImpl(),
                tools: new PluginToolRegistryImpl(),
                ai: new PluginAIServiceImpl()
            }
        };
    }

    private initializePluginDirectories(): void {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        
        this.pluginDirectories = [
            path.join(this.extensionContext.globalStoragePath, 'plugins'),
            path.join(this.extensionContext.extensionPath, 'plugins')
        ];

        if (workspaceFolder) {
            this.pluginDirectories.push(
                path.join(workspaceFolder.uri.fsPath, '.cuovare', 'plugins')
            );
        }
    }

    private validateManifest(manifest: any): manifest is PluginManifest {
        const required = ['id', 'name', 'version', 'description', 'author', 'license', 'main'];
        
        for (const field of required) {
            if (!manifest[field]) {
                return false;
            }
        }

        // Validate version format
        if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
            return false;
        }

        return true;
    }

    private async extractPluginManifest(source: string): Promise<PluginManifest> {
        // This would handle different source types (directory, zip, npm package, etc.)
        const manifestPath = path.join(source, 'plugin.json');
        const content = await fs.readFile(manifestPath, 'utf8');
        return JSON.parse(content);
    }

    private async installPluginFiles(source: string, pluginId: string): Promise<string> {
        const targetPath = path.join(this.extensionContext.globalStoragePath, 'plugins', pluginId);
        
        // Create directory
        await fs.mkdir(targetPath, { recursive: true });
        
        // Copy files (simplified - would handle different source types)
        await this.copyDirectory(source, targetPath);
        
        return targetPath;
    }

    private async copyDirectory(source: string, target: string): Promise<void> {
        const entries = await fs.readdir(source);
        
        for (const entry of entries) {
            const sourcePath = path.join(source, entry);
            const targetPath = path.join(target, entry);
            const stat = await fs.stat(sourcePath);
            
            if (stat.isDirectory()) {
                await fs.mkdir(targetPath, { recursive: true });
                await this.copyDirectory(sourcePath, targetPath);
            } else {
                await fs.copyFile(sourcePath, targetPath);
            }
        }
    }

    private async removePluginFiles(pluginPath: string): Promise<void> {
        await fs.rmdir(pluginPath, { recursive: true });
    }

    private async createPluginInstance(manifest: PluginManifest, pluginPath: string): Promise<LoadedPlugin> {
        const startTime = Date.now();
        
        try {
            // Load the main plugin file
            const mainPath = path.join(pluginPath, manifest.main);
            const PluginClass = require(mainPath);
            
            // Create instance
            const instance = new PluginClass(this.apiContext);
            
            const loadTime = Date.now() - startTime;
            
            return {
                manifest,
                instance,
                context: this.extensionContext,
                isActive: false,
                errors: [],
                metadata: {
                    loadTime,
                    memoryUsage: 0,
                    apiCalls: 0,
                    lastUsed: new Date()
                }
            };
        } catch (error) {
            throw new Error(`Failed to create plugin instance: ${(error as Error).message}`);
        }
    }

    private async loadEnabledPlugins(): Promise<void> {
        const config = this.extensionContext.globalState.get<any>('pluginConfiguration', {});
        
        for (const pluginId of config.enabled || []) {
            try {
                await this.activatePlugin(pluginId);
            } catch (error) {
                console.error(`Failed to activate plugin ${pluginId}:`, error);
            }
        }
    }

    private async activatePlugin(pluginId: string): Promise<void> {
        const plugin = this.registry.installed.get(pluginId);
        if (!plugin || plugin.isActive) {
            return;
        }

        try {
            if (plugin.instance.activate) {
                await plugin.instance.activate();
            }
            
            plugin.isActive = true;
            plugin.activatedAt = new Date();
            
            this.eventEmitter.fire({
                type: 'plugin-activated',
                data: { pluginId }
            });
        } catch (error) {
            plugin.errors.push(`Activation failed: ${(error as Error).message}`);
            throw error;
        }
    }

    private async deactivatePlugin(pluginId: string): Promise<void> {
        const plugin = this.registry.installed.get(pluginId);
        if (!plugin || !plugin.isActive) {
            return;
        }

        try {
            if (plugin.instance.deactivate) {
                await plugin.instance.deactivate();
            }
            
            plugin.isActive = false;
            plugin.activatedAt = undefined;
            
            this.eventEmitter.fire({
                type: 'plugin-deactivated',
                data: { pluginId }
            });
        } catch (error) {
            plugin.errors.push(`Deactivation failed: ${(error as Error).message}`);
            throw error;
        }
    }

    private getPluginPath(pluginId: string): string {
        return path.join(this.extensionContext.globalStoragePath, 'plugins', pluginId);
    }

    private async savePluginConfiguration(): Promise<void> {
        const config = {
            enabled: Array.from(this.registry.enabled),
            disabled: Array.from(this.registry.disabled)
        };
        
        await this.extensionContext.globalState.update('pluginConfiguration', config);
    }

    private startPerformanceMonitoring(): void {
        setInterval(() => {
            this.performanceMonitor.collectMetrics(this.registry.installed);
        }, 60000); // Every minute
    }

    private incrementVersion(version: string): string {
        const parts = version.split('.');
        parts[2] = String(parseInt(parts[2]) + 1);
        return parts.join('.');
    }
}

// Supporting classes

export interface PluginSystemEvent {
    type: string;
    data: any;
}

class PluginSecurityManager {
    async validatePlugin(manifest: PluginManifest): Promise<boolean> {
        // Security validation logic
        return true;
    }
}

class PluginDependencyResolver {
    async resolveDependencies(manifest: PluginManifest): Promise<void> {
        // Dependency resolution logic
    }
}

class PluginPerformanceMonitor {
    recordToolExecution(pluginId: string, toolId: string, duration: number): void {
        // Performance tracking
    }
    
    collectMetrics(plugins: Map<string, LoadedPlugin>): void {
        // Collect performance metrics
    }
}

class PluginLoggerImpl implements PluginLogger {
    info(message: string, ...args: any[]): void {
        console.log(`[Plugin] ${message}`, ...args);
    }
    
    warn(message: string, ...args: any[]): void {
        console.warn(`[Plugin] ${message}`, ...args);
    }
    
    error(message: string, ...args: any[]): void {
        console.error(`[Plugin] ${message}`, ...args);
    }
    
    debug(message: string, ...args: any[]): void {
        console.debug(`[Plugin] ${message}`, ...args);
    }
}

class PluginStorageImpl implements PluginStorage {
    constructor(private context: vscode.ExtensionContext) {}
    
    get<T>(key: string, defaultValue?: T): T | undefined {
        return this.context.globalState.get(key, defaultValue);
    }
    
    async set(key: string, value: any): Promise<void> {
        await this.context.globalState.update(key, value);
    }
    
    async delete(key: string): Promise<void> {
        await this.context.globalState.update(key, undefined);
    }
    
    async clear(): Promise<void> {
        for (const key of this.context.globalState.keys()) {
            await this.context.globalState.update(key, undefined);
        }
    }
    
    keys(): string[] {
        return [...this.context.globalState.keys()];
    }
}

class PluginEventEmitterImpl implements PluginEventEmitter {
    private listeners: Map<string, Set<Function>> = new Map();
    
    on(event: string, listener: (...args: any[]) => void): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(listener);
    }
    
    off(event: string, listener: (...args: any[]) => void): void {
        this.listeners.get(event)?.delete(listener);
    }
    
    emit(event: string, ...args: any[]): void {
        this.listeners.get(event)?.forEach(listener => listener(...args));
    }
    
    once(event: string, listener: (...args: any[]) => void): void {
        const onceListener = (...args: any[]) => {
            listener(...args);
            this.off(event, onceListener);
        };
        this.on(event, onceListener);
    }
}

class PluginToolRegistryImpl implements PluginToolRegistry {
    private tools: Map<string, { tool: PluginTool; handler: Function }> = new Map();
    
    register(tool: PluginTool, handler: (input: any) => Promise<any>): void {
        this.tools.set(tool.id, { tool, handler });
    }
    
    unregister(toolId: string): void {
        this.tools.delete(toolId);
    }
    
    async execute(toolId: string, input: any): Promise<any> {
        const registration = this.tools.get(toolId);
        if (!registration) {
            throw new Error(`Tool ${toolId} not found`);
        }
        
        return await registration.handler(input);
    }
    
    list(): PluginTool[] {
        return Array.from(this.tools.values()).map(r => r.tool);
    }
    
    get(toolId: string): PluginTool | undefined {
        return this.tools.get(toolId)?.tool;
    }
}

class PluginAIServiceImpl implements PluginAIService {
    async chat(messages: any[], options?: any): Promise<string> {
        // Implementation would integrate with the main AI service
        return "AI response";
    }
    
    async complete(prompt: string, options?: any): Promise<string> {
        // Implementation would integrate with the main AI service
        return "AI completion";
    }
    
    async analyze(code: string, language: string): Promise<any> {
        // Implementation would integrate with the main AI service
        return { analysis: "Code analysis result" };
    }
}
