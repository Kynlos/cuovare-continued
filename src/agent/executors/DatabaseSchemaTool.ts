import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ToolExecutor, ToolResult, ToolMetadata } from '../ToolRegistry';

interface DatabaseConnection {
    type: 'postgresql' | 'mysql' | 'sqlite' | 'mongodb' | 'redis';
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    connectionString?: string;
    file?: string; // For SQLite
}

interface TableSchema {
    name: string;
    columns: ColumnSchema[];
    indexes: IndexSchema[];
    constraints: ConstraintSchema[];
    relationships: RelationshipSchema[];
    stats?: TableStats;
}

interface ColumnSchema {
    name: string;
    type: string;
    nullable: boolean;
    defaultValue?: any;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
    isUnique: boolean;
    maxLength?: number;
    precision?: number;
    scale?: number;
    comment?: string;
}

interface IndexSchema {
    name: string;
    columns: string[];
    isUnique: boolean;
    isPrimary: boolean;
    type: 'btree' | 'hash' | 'gin' | 'gist' | 'text';
}

interface ConstraintSchema {
    name: string;
    type: 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK' | 'NOT NULL';
    columns: string[];
    referencedTable?: string;
    referencedColumns?: string[];
    definition?: string;
}

interface RelationshipSchema {
    type: 'one-to-one' | 'one-to-many' | 'many-to-many';
    fromTable: string;
    fromColumns: string[];
    toTable: string;
    toColumns: string[];
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
    onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

interface TableStats {
    rowCount: number;
    dataSize: string;
    indexSize: string;
    lastAnalyzed?: Date;
}

interface DatabaseSchema {
    name: string;
    type: string;
    version?: string;
    tables: TableSchema[];
    views: ViewSchema[];
    procedures: ProcedureSchema[];
    functions: FunctionSchema[];
    triggers: TriggerSchema[];
}

interface ViewSchema {
    name: string;
    definition: string;
    columns: ColumnSchema[];
    dependencies: string[];
}

interface ProcedureSchema {
    name: string;
    parameters: ParameterSchema[];
    returnType?: string;
    definition: string;
    language?: string;
}

interface FunctionSchema {
    name: string;
    parameters: ParameterSchema[];
    returnType: string;
    definition: string;
    language?: string;
    isAggregate?: boolean;
}

interface TriggerSchema {
    name: string;
    table: string;
    timing: 'BEFORE' | 'AFTER' | 'INSTEAD OF';
    events: ('INSERT' | 'UPDATE' | 'DELETE')[];
    definition: string;
}

interface ParameterSchema {
    name: string;
    type: string;
    mode: 'IN' | 'OUT' | 'INOUT';
    defaultValue?: any;
}

export class DatabaseSchemaTool implements ToolExecutor {
    public metadata: ToolMetadata = {
        name: 'DatabaseSchemaTool',
        description: 'Visual database exploration, schema analysis, and query generation',
        category: 'Database',
        parameters: [
            { name: 'action', description: 'connect | explore-schema | analyze-table | generate-query | export-schema | compare-schemas | optimize-schema', required: true, type: 'string' },
            { name: 'connectionString', description: 'Database connection string', required: false, type: 'string' },
            { name: 'dbType', description: 'Database type (postgresql, mysql, sqlite, mongodb, redis)', required: false, type: 'string' },
            { name: 'host', description: 'Database host', required: false, type: 'string' },
            { name: 'database', description: 'Database name', required: false, type: 'string' },
            { name: 'table', description: 'Table name for analysis', required: false, type: 'string' },
            { name: 'outputFormat', description: 'Output format (json, sql, markdown, diagram)', required: false, type: 'string' }
        ],
        examples: [
            'Explore schema: { "action": "explore-schema", "connectionString": "postgresql://user:pass@localhost/db" }',
            'Analyze table: { "action": "analyze-table", "table": "users", "includeStats": true }',
            'Generate query: { "action": "generate-query", "queryType": "select", "table": "users" }'
        ]
    };

    private connections: Map<string, any> = new Map();

    async execute(params: any, context: { workspaceRoot: string; outputChannel: any; onProgress?: (message: string) => void }): Promise<ToolResult> {
        const { 
            action, connectionString, dbType, host, port, database, 
            username, password, table, query, outputFormat, 
            includeData, includeStats 
        } = params;

        try {
            const connection: DatabaseConnection = {
                type: dbType || 'postgresql',
                host,
                port,
                database,
                username,
                password,
                connectionString
            };

            const options = {
                includeData: includeData !== false,
                includeStats: includeStats !== false,
                outputFormat: outputFormat || 'json'
            };

            switch (action) {
                case 'connect':
                    return await this.connectToDatabase(connection);
                case 'explore-schema':
                    return await this.exploreSchema(connection, options);
                case 'analyze-table':
                    return await this.analyzeTable(connection, table, options);
                case 'generate-query':
                    return await this.generateQuery(connection, params);
                case 'export-schema':
                    return await this.exportSchema(connection, options);
                case 'compare-schemas':
                    return await this.compareSchemas(params);
                case 'optimize-schema':
                    return await this.optimizeSchema(connection, table, options);
                default:
                    return await this.exploreSchema(connection, options);
            }
        } catch (error) {
            return { 
                success: false, 
                message: `Database operation failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async connectToDatabase(connection: DatabaseConnection): Promise<ToolResult> {
        try {
            // Simulate database connection (in real implementation, would use actual DB drivers)
            const connectionId = this.generateConnectionId(connection);
            
            // Store connection for reuse
            this.connections.set(connectionId, connection);

            // Test connection
            const isConnected = await this.testConnection(connection);
            
            if (isConnected) {
                return {
                    success: true,
                    message: `Successfully connected to ${connection.type} database`,
                    data: {
                        connectionId,
                        type: connection.type,
                        database: connection.database,
                        host: connection.host,
                        port: connection.port
                    }
                };
            } else {
                return {
                    success: false,
                    message: 'Failed to connect to database. Please check your connection parameters.'
                };
            }
        } catch (error) {
            return {
                success: false,
                message: `Connection error: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async exploreSchema(connection: DatabaseConnection, options: any): Promise<ToolResult> {
        const schema = await this.extractDatabaseSchema(connection, options);
        
        if (!schema) {
            return {
                success: false,
                message: 'Failed to extract database schema'
            };
        }

        const summary = {
            databaseName: schema.name,
            databaseType: schema.type,
            totalTables: schema.tables.length,
            totalViews: schema.views.length,
            totalProcedures: schema.procedures.length,
            totalFunctions: schema.functions.length,
            totalTriggers: schema.triggers.length,
            relationships: this.countRelationships(schema.tables),
            largestTables: this.getLargestTables(schema.tables, 5)
        };

        // Generate visual representation
        const erdDiagram = await this.generateERDDiagram(schema);
        
        return {
            success: true,
            message: `Explored schema for database '${schema.name}' with ${schema.tables.length} tables`,
            data: {
                schema,
                summary,
                erdDiagram,
                recommendations: await this.generateSchemaRecommendations(schema)
            }
        };
    }

    private async analyzeTable(connection: DatabaseConnection, tableName: string, options: any): Promise<ToolResult> {
        if (!tableName) {
            return { success: false, message: 'Table name is required for analysis' };
        }

        const tableSchema = await this.extractTableSchema(connection, tableName, options);
        
        if (!tableSchema) {
            return {
                success: false,
                message: `Table '${tableName}' not found or cannot be accessed`
            };
        }

        const analysis = {
            table: tableSchema,
            dataTypes: this.analyzeDataTypes(tableSchema.columns),
            indexAnalysis: this.analyzeIndexes(tableSchema.indexes),
            relationshipAnalysis: this.analyzeRelationships(tableSchema.relationships),
            performance: await this.analyzeTablePerformance(connection, tableName),
            suggestions: await this.generateTableSuggestions(tableSchema)
        };

        // Include sample data if requested
        if (options.includeData) {
            analysis['sampleData'] = await this.getSampleData(connection, tableName, 10);
        }

        return {
            success: true,
            message: `Analyzed table '${tableName}' with ${tableSchema.columns.length} columns`,
            data: analysis
        };
    }

    private async generateQuery(connection: DatabaseConnection, params: any): Promise<ToolResult> {
        const { queryType, table, columns, conditions, joins, orderBy, limit } = params;
        
        let generatedQuery = '';
        let explanation = '';

        switch (queryType) {
            case 'select':
                generatedQuery = this.generateSelectQuery(table, columns, conditions, joins, orderBy, limit);
                explanation = 'Generated SELECT query for data retrieval';
                break;
            case 'insert':
                generatedQuery = this.generateInsertQuery(table, params.data);
                explanation = 'Generated INSERT query for data insertion';
                break;
            case 'update':
                generatedQuery = this.generateUpdateQuery(table, params.data, conditions);
                explanation = 'Generated UPDATE query for data modification';
                break;
            case 'delete':
                generatedQuery = this.generateDeleteQuery(table, conditions);
                explanation = 'Generated DELETE query for data removal';
                break;
            case 'create-table':
                generatedQuery = await this.generateCreateTableQuery(connection, params.tableDefinition);
                explanation = 'Generated CREATE TABLE query for table creation';
                break;
            case 'alter-table':
                generatedQuery = this.generateAlterTableQuery(table, params.alterations);
                explanation = 'Generated ALTER TABLE query for schema modification';
                break;
            default:
                return { success: false, message: 'Unsupported query type' };
        }

        // Validate query syntax
        const validation = await this.validateQuery(connection, generatedQuery);

        return {
            success: true,
            message: explanation,
            data: {
                query: generatedQuery,
                queryType,
                validation,
                estimatedPerformance: await this.estimateQueryPerformance(connection, generatedQuery),
                suggestions: await this.generateQueryOptimizations(generatedQuery)
            }
        };
    }

    private async exportSchema(connection: DatabaseConnection, options: any): Promise<ToolResult> {
        const schema = await this.extractDatabaseSchema(connection, options);
        
        if (!schema) {
            return { success: false, message: 'Failed to extract schema for export' };
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return { success: false, message: 'No workspace folder found for export' };
        }

        const exportDir = path.join(workspaceFolder.uri.fsPath, 'database-export');
        await fs.promises.mkdir(exportDir, { recursive: true });

        const exports: string[] = [];

        // Export as SQL DDL
        if (options.outputFormat === 'sql' || options.outputFormat === 'all') {
            const sqlFile = path.join(exportDir, `${schema.name}_schema.sql`);
            const sqlContent = await this.generateSQLDDL(schema);
            await fs.promises.writeFile(sqlFile, sqlContent);
            exports.push(sqlFile);
        }

        // Export as JSON
        if (options.outputFormat === 'json' || options.outputFormat === 'all') {
            const jsonFile = path.join(exportDir, `${schema.name}_schema.json`);
            await fs.promises.writeFile(jsonFile, JSON.stringify(schema, null, 2));
            exports.push(jsonFile);
        }

        // Export as Markdown documentation
        if (options.outputFormat === 'markdown' || options.outputFormat === 'all') {
            const mdFile = path.join(exportDir, `${schema.name}_documentation.md`);
            const mdContent = await this.generateMarkdownDocumentation(schema);
            await fs.promises.writeFile(mdFile, mdContent);
            exports.push(mdFile);
        }

        // Export as ER Diagram
        if (options.outputFormat === 'diagram' || options.outputFormat === 'all') {
            const diagramFile = path.join(exportDir, `${schema.name}_erd.mermaid`);
            const diagramContent = await this.generateMermaidERD(schema);
            await fs.promises.writeFile(diagramFile, diagramContent);
            exports.push(diagramFile);
        }

        return {
            success: true,
            message: `Exported schema to ${exports.length} files`,
            data: {
                exportedFiles: exports.map(f => path.relative(workspaceFolder.uri.fsPath, f)),
                schema,
                exportDirectory: path.relative(workspaceFolder.uri.fsPath, exportDir)
            }
        };
    }

    private async compareSchemas(params: any): Promise<ToolResult> {
        const { sourceConnection, targetConnection, ignoreNames } = params;
        
        const sourceSchema = await this.extractDatabaseSchema(sourceConnection, {});
        const targetSchema = await this.extractDatabaseSchema(targetConnection, {});
        
        if (!sourceSchema || !targetSchema) {
            return { success: false, message: 'Failed to extract schemas for comparison' };
        }

        const differences = await this.computeSchemaDifferences(sourceSchema, targetSchema, ignoreNames);
        const migrationScript = await this.generateMigrationScript(differences);

        return {
            success: true,
            message: `Compared schemas: found ${differences.totalDifferences} differences`,
            data: {
                sourceSchema: sourceSchema.name,
                targetSchema: targetSchema.name,
                differences,
                migrationScript,
                recommendations: await this.generateMigrationRecommendations(differences)
            }
        };
    }

    private async optimizeSchema(connection: DatabaseConnection, tableName?: string, options?: any): Promise<ToolResult> {
        if (tableName) {
            // Optimize specific table
            const tableSchema = await this.extractTableSchema(connection, tableName, options || {});
            if (!tableSchema) {
                return { success: false, message: `Table '${tableName}' not found` };
            }

            const optimizations = await this.generateTableOptimizations(tableSchema);
            const optimizationQueries = await this.generateOptimizationQueries(optimizations);

            return {
                success: true,
                message: `Generated ${optimizations.length} optimization suggestions for table '${tableName}'`,
                data: {
                    table: tableName,
                    optimizations,
                    queries: optimizationQueries,
                    estimatedImpact: await this.estimateOptimizationImpact(optimizations)
                }
            };
        } else {
            // Optimize entire schema
            const schema = await this.extractDatabaseSchema(connection, options || {});
            if (!schema) {
                return { success: false, message: 'Failed to extract schema for optimization' };
            }

            const schemaOptimizations = await this.generateSchemaOptimizations(schema);
            
            return {
                success: true,
                message: `Generated ${schemaOptimizations.length} optimization suggestions for database schema`,
                data: {
                    schema: schema.name,
                    optimizations: schemaOptimizations,
                    prioritizedActions: await this.prioritizeOptimizations(schemaOptimizations),
                    estimatedImpact: await this.estimateSchemaOptimizationImpact(schemaOptimizations)
                }
            };
        }
    }

    // Helper methods for database operations

    private generateConnectionId(connection: DatabaseConnection): string {
        return `${connection.type}_${connection.host}_${connection.database}_${Date.now()}`;
    }

    private async testConnection(connection: DatabaseConnection): Promise<boolean> {
        // In a real implementation, this would test the actual database connection
        // For now, simulate based on connection parameters
        return !!(connection.host && connection.database) || !!connection.connectionString || !!connection.file;
    }

    private async extractDatabaseSchema(connection: DatabaseConnection, options: any): Promise<DatabaseSchema | null> {
        // Simulate schema extraction - in real implementation would use database-specific queries
        return {
            name: connection.database || 'sample_db',
            type: connection.type,
            version: '13.4',
            tables: await this.mockExtractTables(connection),
            views: await this.mockExtractViews(connection),
            procedures: await this.mockExtractProcedures(connection),
            functions: await this.mockExtractFunctions(connection),
            triggers: await this.mockExtractTriggers(connection)
        };
    }

    private async mockExtractTables(connection: DatabaseConnection): Promise<TableSchema[]> {
        // Mock table data - in real implementation would query database metadata
        return [
            {
                name: 'users',
                columns: [
                    { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false, isUnique: true },
                    { name: 'email', type: 'VARCHAR(255)', nullable: false, isPrimaryKey: false, isForeignKey: false, isUnique: true },
                    { name: 'name', type: 'VARCHAR(100)', nullable: false, isPrimaryKey: false, isForeignKey: false, isUnique: false },
                    { name: 'created_at', type: 'TIMESTAMP', nullable: false, isPrimaryKey: false, isForeignKey: false, isUnique: false }
                ],
                indexes: [
                    { name: 'users_pkey', columns: ['id'], isUnique: true, isPrimary: true, type: 'btree' },
                    { name: 'users_email_idx', columns: ['email'], isUnique: true, isPrimary: false, type: 'btree' }
                ],
                constraints: [
                    { name: 'users_pkey', type: 'PRIMARY KEY', columns: ['id'] },
                    { name: 'users_email_unique', type: 'UNIQUE', columns: ['email'] }
                ],
                relationships: [],
                stats: { rowCount: 1000, dataSize: '64KB', indexSize: '32KB' }
            },
            {
                name: 'posts',
                columns: [
                    { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false, isUnique: true },
                    { name: 'user_id', type: 'INTEGER', nullable: false, isPrimaryKey: false, isForeignKey: true, isUnique: false },
                    { name: 'title', type: 'VARCHAR(200)', nullable: false, isPrimaryKey: false, isForeignKey: false, isUnique: false },
                    { name: 'content', type: 'TEXT', nullable: true, isPrimaryKey: false, isForeignKey: false, isUnique: false },
                    { name: 'created_at', type: 'TIMESTAMP', nullable: false, isPrimaryKey: false, isForeignKey: false, isUnique: false }
                ],
                indexes: [
                    { name: 'posts_pkey', columns: ['id'], isUnique: true, isPrimary: true, type: 'btree' },
                    { name: 'posts_user_id_idx', columns: ['user_id'], isUnique: false, isPrimary: false, type: 'btree' }
                ],
                constraints: [
                    { name: 'posts_pkey', type: 'PRIMARY KEY', columns: ['id'] },
                    { name: 'posts_user_id_fkey', type: 'FOREIGN KEY', columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'] }
                ],
                relationships: [
                    { type: 'many-to-one', fromTable: 'posts', fromColumns: ['user_id'], toTable: 'users', toColumns: ['id'] }
                ],
                stats: { rowCount: 5000, dataSize: '2MB', indexSize: '512KB' }
            }
        ];
    }

    private async mockExtractViews(connection: DatabaseConnection): Promise<ViewSchema[]> {
        return [
            {
                name: 'user_post_count',
                definition: 'SELECT u.id, u.name, COUNT(p.id) as post_count FROM users u LEFT JOIN posts p ON u.id = p.user_id GROUP BY u.id, u.name',
                columns: [
                    { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: false, isForeignKey: false, isUnique: false },
                    { name: 'name', type: 'VARCHAR(100)', nullable: false, isPrimaryKey: false, isForeignKey: false, isUnique: false },
                    { name: 'post_count', type: 'BIGINT', nullable: false, isPrimaryKey: false, isForeignKey: false, isUnique: false }
                ],
                dependencies: ['users', 'posts']
            }
        ];
    }

    private async mockExtractProcedures(connection: DatabaseConnection): Promise<ProcedureSchema[]> {
        return [
            {
                name: 'create_user_with_profile',
                parameters: [
                    { name: 'p_email', type: 'VARCHAR(255)', mode: 'IN' },
                    { name: 'p_name', type: 'VARCHAR(100)', mode: 'IN' },
                    { name: 'user_id', type: 'INTEGER', mode: 'OUT' }
                ],
                definition: 'CREATE OR REPLACE PROCEDURE create_user_with_profile...',
                language: 'plpgsql'
            }
        ];
    }

    private async mockExtractFunctions(connection: DatabaseConnection): Promise<FunctionSchema[]> {
        return [
            {
                name: 'get_user_post_count',
                parameters: [
                    { name: 'user_id', type: 'INTEGER', mode: 'IN' }
                ],
                returnType: 'INTEGER',
                definition: 'CREATE OR REPLACE FUNCTION get_user_post_count...',
                language: 'plpgsql'
            }
        ];
    }

    private async mockExtractTriggers(connection: DatabaseConnection): Promise<TriggerSchema[]> {
        return [
            {
                name: 'update_user_modified',
                table: 'users',
                timing: 'BEFORE',
                events: ['UPDATE'],
                definition: 'CREATE TRIGGER update_user_modified...'
            }
        ];
    }

    private async extractTableSchema(connection: DatabaseConnection, tableName: string, options: any): Promise<TableSchema | null> {
        const schema = await this.extractDatabaseSchema(connection, options);
        return schema?.tables.find(t => t.name === tableName) || null;
    }

    private async generateERDDiagram(schema: DatabaseSchema): Promise<string> {
        let diagram = 'erDiagram\n';
        
        for (const table of schema.tables) {
            diagram += `    ${table.name} {\n`;
            for (const column of table.columns) {
                const keyIndicator = column.isPrimaryKey ? ' PK' : column.isForeignKey ? ' FK' : '';
                diagram += `        ${column.type} ${column.name}${keyIndicator}\n`;
            }
            diagram += '    }\n';
        }

        // Add relationships
        for (const table of schema.tables) {
            for (const rel of table.relationships) {
                const relationshipType = rel.type === 'one-to-one' ? '||--||' : 
                                       rel.type === 'one-to-many' ? '||--o{' : 
                                       'o{--o{';
                diagram += `    ${rel.fromTable} ${relationshipType} ${rel.toTable} : "${rel.fromColumns.join(',')}-${rel.toColumns.join(',')}"\n`;
            }
        }

        return diagram;
    }

    private countRelationships(tables: TableSchema[]): number {
        return tables.reduce((count, table) => count + table.relationships.length, 0);
    }

    private getLargestTables(tables: TableSchema[], limit: number): Array<{name: string, rowCount: number, dataSize: string}> {
        return tables
            .filter(t => t.stats)
            .sort((a, b) => (b.stats?.rowCount || 0) - (a.stats?.rowCount || 0))
            .slice(0, limit)
            .map(t => ({
                name: t.name,
                rowCount: t.stats!.rowCount,
                dataSize: t.stats!.dataSize
            }));
    }

    private async generateSchemaRecommendations(schema: DatabaseSchema): Promise<string[]> {
        const recommendations: string[] = [];
        
        // Check for missing indexes on foreign keys
        for (const table of schema.tables) {
            for (const column of table.columns) {
                if (column.isForeignKey) {
                    const hasIndex = table.indexes.some(idx => idx.columns.includes(column.name));
                    if (!hasIndex) {
                        recommendations.push(`Add index on foreign key ${table.name}.${column.name}`);
                    }
                }
            }
        }

        // Check for tables without primary keys
        for (const table of schema.tables) {
            const hasPrimaryKey = table.columns.some(col => col.isPrimaryKey);
            if (!hasPrimaryKey) {
                recommendations.push(`Add primary key to table ${table.name}`);
            }
        }

        return recommendations;
    }

    private analyzeDataTypes(columns: ColumnSchema[]): Record<string, number> {
        const typeCounts: Record<string, number> = {};
        for (const column of columns) {
            const baseType = column.type.split('(')[0].toUpperCase();
            typeCounts[baseType] = (typeCounts[baseType] || 0) + 1;
        }
        return typeCounts;
    }

    private analyzeIndexes(indexes: IndexSchema[]): any {
        return {
            totalIndexes: indexes.length,
            uniqueIndexes: indexes.filter(idx => idx.isUnique).length,
            compositeIndexes: indexes.filter(idx => idx.columns.length > 1).length,
            indexTypes: indexes.reduce((types: Record<string, number>, idx) => {
                types[idx.type] = (types[idx.type] || 0) + 1;
                return types;
            }, {})
        };
    }

    private analyzeRelationships(relationships: RelationshipSchema[]): any {
        return {
            totalRelationships: relationships.length,
            relationshipTypes: relationships.reduce((types: Record<string, number>, rel) => {
                types[rel.type] = (types[rel.type] || 0) + 1;
                return types;
            }, {})
        };
    }

    private async analyzeTablePerformance(connection: DatabaseConnection, tableName: string): Promise<any> {
        // Mock performance analysis
        return {
            queryPerformance: 'Good',
            indexUtilization: 85,
            tableScans: 12,
            indexScans: 145,
            recommendations: [
                'Consider adding index on frequently queried columns',
                'Table statistics are up to date'
            ]
        };
    }

    private async generateTableSuggestions(table: TableSchema): Promise<string[]> {
        const suggestions: string[] = [];
        
        // Check for large VARCHAR columns that could be TEXT
        for (const column of table.columns) {
            if (column.type.includes('VARCHAR') && column.maxLength && column.maxLength > 1000) {
                suggestions.push(`Consider using TEXT type for column ${column.name} instead of large VARCHAR`);
            }
        }

        // Check for missing NOT NULL constraints
        const nullableColumns = table.columns.filter(col => col.nullable && !col.isPrimaryKey);
        if (nullableColumns.length > table.columns.length * 0.5) {
            suggestions.push('Consider adding NOT NULL constraints to appropriate columns');
        }

        return suggestions;
    }

    private async getSampleData(connection: DatabaseConnection, tableName: string, limit: number): Promise<any[]> {
        // Mock sample data
        if (tableName === 'users') {
            return [
                { id: 1, email: 'john@example.com', name: 'John Doe', created_at: '2023-01-15T10:30:00Z' },
                { id: 2, email: 'jane@example.com', name: 'Jane Smith', created_at: '2023-01-16T14:22:00Z' }
            ];
        }
        return [];
    }

    private generateSelectQuery(table: string, columns?: string[], conditions?: any, joins?: any[], orderBy?: string, limit?: number): string {
        let query = `SELECT ${columns?.join(', ') || '*'} FROM ${table}`;
        
        if (joins && joins.length > 0) {
            for (const join of joins) {
                query += ` ${join.type || 'INNER'} JOIN ${join.table} ON ${join.condition}`;
            }
        }
        
        if (conditions) {
            const whereClause = Object.entries(conditions)
                .map(([key, value]) => `${key} = '${value}'`)
                .join(' AND ');
            query += ` WHERE ${whereClause}`;
        }
        
        if (orderBy) {
            query += ` ORDER BY ${orderBy}`;
        }
        
        if (limit) {
            query += ` LIMIT ${limit}`;
        }
        
        return query + ';';
    }

    private generateInsertQuery(table: string, data: Record<string, any>): string {
        const columns = Object.keys(data).join(', ');
        const values = Object.values(data).map(v => `'${v}'`).join(', ');
        return `INSERT INTO ${table} (${columns}) VALUES (${values});`;
    }

    private generateUpdateQuery(table: string, data: Record<string, any>, conditions: Record<string, any>): string {
        const setClause = Object.entries(data)
            .map(([key, value]) => `${key} = '${value}'`)
            .join(', ');
        const whereClause = Object.entries(conditions)
            .map(([key, value]) => `${key} = '${value}'`)
            .join(' AND ');
        return `UPDATE ${table} SET ${setClause} WHERE ${whereClause};`;
    }

    private generateDeleteQuery(table: string, conditions: Record<string, any>): string {
        const whereClause = Object.entries(conditions)
            .map(([key, value]) => `${key} = '${value}'`)
            .join(' AND ');
        return `DELETE FROM ${table} WHERE ${whereClause};`;
    }

    private async generateCreateTableQuery(connection: DatabaseConnection, tableDefinition: any): Promise<string> {
        // Generate CREATE TABLE statement based on table definition
        const { name, columns, constraints } = tableDefinition;
        
        let query = `CREATE TABLE ${name} (\n`;
        
        // Add columns
        const columnDefs = columns.map((col: any) => {
            let def = `  ${col.name} ${col.type}`;
            if (!col.nullable) def += ' NOT NULL';
            if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
            return def;
        });
        
        query += columnDefs.join(',\n');
        
        // Add constraints
        if (constraints && constraints.length > 0) {
            const constraintDefs = constraints.map((constraint: any) => {
                return `  CONSTRAINT ${constraint.name} ${constraint.definition}`;
            });
            query += ',\n' + constraintDefs.join(',\n');
        }
        
        query += '\n);';
        
        return query;
    }

    private generateAlterTableQuery(table: string, alterations: any[]): string {
        const alterStatements = alterations.map(alt => {
            switch (alt.type) {
                case 'ADD_COLUMN':
                    return `ADD COLUMN ${alt.name} ${alt.dataType}`;
                case 'DROP_COLUMN':
                    return `DROP COLUMN ${alt.name}`;
                case 'MODIFY_COLUMN':
                    return `ALTER COLUMN ${alt.name} TYPE ${alt.newType}`;
                default:
                    return alt.statement;
            }
        });
        
        return `ALTER TABLE ${table} ${alterStatements.join(', ')};`;
    }

    private async validateQuery(connection: DatabaseConnection, query: string): Promise<any> {
        // Mock query validation
        return {
            isValid: true,
            syntax: 'correct',
            warnings: [],
            errors: []
        };
    }

    private async estimateQueryPerformance(connection: DatabaseConnection, query: string): Promise<any> {
        // Mock performance estimation
        return {
            estimatedCost: 125.5,
            estimatedRows: 1000,
            estimatedTime: '2ms',
            planType: 'Index Scan'
        };
    }

    private async generateQueryOptimizations(query: string): Promise<string[]> {
        const optimizations: string[] = [];
        
        if (query.includes('SELECT *')) {
            optimizations.push('Specify only needed columns instead of using SELECT *');
        }
        
        if (query.includes('ORDER BY') && !query.includes('LIMIT')) {
            optimizations.push('Consider adding LIMIT clause to ORDER BY queries');
        }
        
        return optimizations;
    }

    private async generateSQLDDL(schema: DatabaseSchema): Promise<string> {
        let ddl = `-- Database Schema: ${schema.name}\n`;
        ddl += `-- Generated on: ${new Date().toISOString()}\n\n`;
        
        // Create tables
        for (const table of schema.tables) {
            ddl += `CREATE TABLE ${table.name} (\n`;
            
            const columnDefs = table.columns.map(col => {
                let def = `  ${col.name} ${col.type}`;
                if (!col.nullable) def += ' NOT NULL';
                if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
                return def;
            });
            
            ddl += columnDefs.join(',\n');
            
            if (table.constraints.length > 0) {
                const constraintDefs = table.constraints.map(constraint => {
                    let def = `  CONSTRAINT ${constraint.name} ${constraint.type}`;
                    if (constraint.columns.length > 0) {
                        def += ` (${constraint.columns.join(', ')})`;
                    }
                    if (constraint.referencedTable) {
                        def += ` REFERENCES ${constraint.referencedTable}(${constraint.referencedColumns?.join(', ')})`;
                    }
                    return def;
                });
                ddl += ',\n' + constraintDefs.join(',\n');
            }
            
            ddl += '\n);\n\n';
            
            // Create indexes
            for (const index of table.indexes) {
                if (!index.isPrimary) {
                    ddl += `CREATE ${index.isUnique ? 'UNIQUE ' : ''}INDEX ${index.name} ON ${table.name} (${index.columns.join(', ')});\n`;
                }
            }
            ddl += '\n';
        }
        
        return ddl;
    }

    private async generateMarkdownDocumentation(schema: DatabaseSchema): Promise<string> {
        let doc = `# Database Schema Documentation: ${schema.name}\n\n`;
        doc += `**Database Type:** ${schema.type}\n`;
        doc += `**Version:** ${schema.version || 'Unknown'}\n`;
        doc += `**Generated:** ${new Date().toISOString()}\n\n`;
        
        doc += `## Summary\n\n`;
        doc += `- **Tables:** ${schema.tables.length}\n`;
        doc += `- **Views:** ${schema.views.length}\n`;
        doc += `- **Procedures:** ${schema.procedures.length}\n`;
        doc += `- **Functions:** ${schema.functions.length}\n\n`;
        
        doc += `## Tables\n\n`;
        
        for (const table of schema.tables) {
            doc += `### ${table.name}\n\n`;
            
            if (table.stats) {
                doc += `**Statistics:** ${table.stats.rowCount} rows, ${table.stats.dataSize} data size\n\n`;
            }
            
            doc += `| Column | Type | Nullable | Key | Description |\n`;
            doc += `|--------|------|----------|-----|-------------|\n`;
            
            for (const column of table.columns) {
                const keyType = column.isPrimaryKey ? 'PK' : column.isForeignKey ? 'FK' : '';
                doc += `| ${column.name} | ${column.type} | ${column.nullable ? 'Yes' : 'No'} | ${keyType} | ${column.comment || ''} |\n`;
            }
            
            doc += '\n';
            
            if (table.indexes.length > 0) {
                doc += `**Indexes:**\n`;
                for (const index of table.indexes) {
                    doc += `- ${index.name}: ${index.columns.join(', ')} ${index.isUnique ? '(Unique)' : ''}\n`;
                }
                doc += '\n';
            }
            
            if (table.relationships.length > 0) {
                doc += `**Relationships:**\n`;
                for (const rel of table.relationships) {
                    doc += `- ${rel.type}: ${rel.fromTable}.${rel.fromColumns.join(',')} → ${rel.toTable}.${rel.toColumns.join(',')}\n`;
                }
                doc += '\n';
            }
        }
        
        return doc;
    }

    private async generateMermaidERD(schema: DatabaseSchema): Promise<string> {
        return await this.generateERDDiagram(schema);
    }

    private async computeSchemaDifferences(source: DatabaseSchema, target: DatabaseSchema, ignoreNames?: boolean): Promise<any> {
        const differences = {
            totalDifferences: 0,
            missingTables: [],
            extraTables: [],
            modifiedTables: [],
            missingColumns: [],
            extraColumns: [],
            modifiedColumns: []
        };
        
        // Compare tables
        const sourceTableNames = source.tables.map(t => t.name);
        const targetTableNames = target.tables.map(t => t.name);
        
        differences.missingTables = sourceTableNames.filter(name => !targetTableNames.includes(name));
        differences.extraTables = targetTableNames.filter(name => !sourceTableNames.includes(name));
        
        differences.totalDifferences = differences.missingTables.length + differences.extraTables.length;
        
        return differences;
    }

    private async generateMigrationScript(differences: any): Promise<string> {
        let script = '-- Database Migration Script\n';
        script += `-- Generated on: ${new Date().toISOString()}\n\n`;
        
        // Add missing tables
        for (const tableName of differences.missingTables) {
            script += `-- TODO: Create table ${tableName}\n`;
            script += `-- CREATE TABLE ${tableName} (...);\n\n`;
        }
        
        // Remove extra tables
        for (const tableName of differences.extraTables) {
            script += `-- TODO: Drop table ${tableName}\n`;
            script += `-- DROP TABLE ${tableName};\n\n`;
        }
        
        return script;
    }

    private async generateMigrationRecommendations(differences: any): Promise<string[]> {
        const recommendations: string[] = [];
        
        if (differences.missingTables.length > 0) {
            recommendations.push('Review missing tables before creating them in target database');
        }
        
        if (differences.extraTables.length > 0) {
            recommendations.push('Backup data before dropping extra tables');
        }
        
        return recommendations;
    }

    private async generateTableOptimizations(table: TableSchema): Promise<any[]> {
        const optimizations: any[] = [];
        
        // Check for missing indexes on foreign keys
        for (const column of table.columns) {
            if (column.isForeignKey) {
                const hasIndex = table.indexes.some(idx => idx.columns.includes(column.name));
                if (!hasIndex) {
                    optimizations.push({
                        type: 'add_index',
                        table: table.name,
                        column: column.name,
                        description: `Add index on foreign key ${column.name}`,
                        priority: 'high'
                    });
                }
            }
        }
        
        return optimizations;
    }

    private async generateOptimizationQueries(optimizations: any[]): Promise<string[]> {
        return optimizations.map(opt => {
            switch (opt.type) {
                case 'add_index':
                    return `CREATE INDEX idx_${opt.table}_${opt.column} ON ${opt.table}(${opt.column});`;
                default:
                    return `-- ${opt.description}`;
            }
        });
    }

    private async estimateOptimizationImpact(optimizations: any[]): Promise<any> {
        return {
            performanceImprovement: '15-25%',
            querySpeedIncrease: '2-3x faster',
            storageImpact: '+5MB indexes'
        };
    }

    private async generateSchemaOptimizations(schema: DatabaseSchema): Promise<any[]> {
        const optimizations: any[] = [];
        
        for (const table of schema.tables) {
            const tableOpts = await this.generateTableOptimizations(table);
            optimizations.push(...tableOpts);
        }
        
        return optimizations;
    }

    private async prioritizeOptimizations(optimizations: any[]): Promise<any[]> {
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        return optimizations.sort((a, b) => (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0));
    }

    private async estimateSchemaOptimizationImpact(optimizations: any[]): Promise<any> {
        return {
            totalOptimizations: optimizations.length,
            estimatedPerformanceGain: '20-40%',
            implementationEffort: 'Medium',
            riskLevel: 'Low'
        };
    }
}
