import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ToolExecutor, ToolResult } from '../ToolRegistry';

export class DatabaseTool implements ToolExecutor {
    readonly name = 'database';
    readonly description = 'Database operations, schema management, and SQL query tools';
    
    readonly metadata = {
        name: 'database',
        description: 'Database operations, schema management, and SQL query tools',
        category: 'Database',
        parameters: [
            {
                name: 'action',
                description: 'Database action to perform',
                required: true,
                type: 'string'
            },
            {
                name: 'params',
                description: 'Parameters for the action',
                required: false,
                type: 'object'
            }
        ],
        examples: [
            'Generate schema from TypeScript interfaces',
            'Create database migration',
            'Validate SQL queries',
            'Optimize database queries'
        ]
    };

    readonly methods = {
        'generateSchema': {
            description: 'Generate database schema from TypeScript interfaces or classes',
            parameters: {
                filePath: { type: 'string', description: 'Path to the TypeScript file containing interfaces/classes' },
                dbType: { type: 'string', description: 'Database type (mysql, postgresql, sqlite, mongodb)', optional: true }
            }
        },
        'generateMigration': {
            description: 'Generate database migration files',
            parameters: {
                migrationName: { type: 'string', description: 'Name of the migration' },
                operations: { type: 'string', description: 'Description of operations (create table, add column, etc.)' }
            }
        },
        'validateSQL': {
            description: 'Validate SQL syntax and structure',
            parameters: {
                sqlQuery: { type: 'string', description: 'SQL query to validate' },
                dbType: { type: 'string', description: 'Database type for validation', optional: true }
            }
        },
        'generateORM': {
            description: 'Generate ORM models from database schema',
            parameters: {
                schemaFile: { type: 'string', description: 'Path to schema file' },
                ormType: { type: 'string', description: 'ORM type (typeorm, prisma, sequelize, mongoose)' }
            }
        },
        'optimizeQuery': {
            description: 'Analyze and suggest optimizations for SQL queries',
            parameters: {
                sqlQuery: { type: 'string', description: 'SQL query to optimize' }
            }
        },
        'generateSeeds': {
            description: 'Generate database seed files with sample data',
            parameters: {
                tableName: { type: 'string', description: 'Table name for seed data' },
                recordCount: { type: 'number', description: 'Number of records to generate', optional: true }
            }
        },
        'createRepository': {
            description: 'Generate repository pattern implementation',
            parameters: {
                entityName: { type: 'string', description: 'Entity name for repository' },
                includeTests: { type: 'boolean', description: 'Include unit tests', optional: true }
            }
        },
        'generateBackup': {
            description: 'Generate database backup scripts',
            parameters: {
                dbType: { type: 'string', description: 'Database type' },
                includeData: { type: 'boolean', description: 'Include data in backup', optional: true }
            }
        },
        'analyzeSchema': {
            description: 'Analyze database schema for potential issues',
            parameters: {
                schemaFile: { type: 'string', description: 'Path to schema file or directory' }
            }
        },
        'generateAPI': {
            description: 'Generate REST API endpoints from database schema',
            parameters: {
                schemaFile: { type: 'string', description: 'Path to schema file' },
                framework: { type: 'string', description: 'API framework (express, fastify, nestjs)', optional: true }
            }
        }
    };

    async execute(method: string, args: Record<string, any>): Promise<ToolResult> {
        try {
            switch (method) {
                case 'generateSchema':
                    return await this.generateSchema(args.filePath, args.dbType);
                case 'generateMigration':
                    return await this.generateMigration(args.migrationName, args.operations);
                case 'validateSQL':
                    return await this.validateSQL(args.sqlQuery, args.dbType);
                case 'generateORM':
                    return await this.generateORM(args.schemaFile, args.ormType);
                case 'optimizeQuery':
                    return await this.optimizeQuery(args.sqlQuery);
                case 'generateSeeds':
                    return await this.generateSeeds(args.tableName, args.recordCount);
                case 'createRepository':
                    return await this.createRepository(args.entityName, args.includeTests);
                case 'generateBackup':
                    return await this.generateBackup(args.dbType, args.includeData);
                case 'analyzeSchema':
                    return await this.analyzeSchema(args.schemaFile);
                case 'generateAPI':
                    return await this.generateAPI(args.schemaFile, args.framework);
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

    private async generateSchema(filePath: string, dbType: string = 'postgresql'): Promise<ToolResult> {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const interfaces = this.extractInterfaces(content);
            const schema = this.generateDatabaseSchema(interfaces, dbType);

            const outputPath = path.join(path.dirname(filePath), `schema.${this.getSchemaExtension(dbType)}`);
            await fs.writeFile(outputPath, schema);

            return {
                success: true,
                result: `Database schema generated at ${outputPath}`
            };
        } catch (error) { (error as Error).message : String(error)}`
            };
        }
    }

    private async generateMigration(migrationName: string, operations: string): Promise<ToolResult> {
        try {
            const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
            const fileName = `${timestamp}_${migrationName.toLowerCase().replace(/\s+/g, '_')}.sql`;
            
            const migrationContent = this.createMigrationContent(migrationName, operations);
            const migrationsDir = path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', 'migrations');
            
            try {
                await fs.access(migrationsDir);
            } catch {
                await fs.mkdir(migrationsDir, { recursive: true });
            }

            const migrationPath = path.join(migrationsDir, fileName);
            await fs.writeFile(migrationPath, migrationContent);

            return {
                success: true,
                result: `Migration created at ${migrationPath}`
            };
        } catch (error) { (error as Error).message : String(error)}`
            };
        }
    }

    private async validateSQL(sqlQuery: string, dbType: string = 'postgresql'): Promise<ToolResult> {
        try {
            const validationResult = this.validateSQLSyntax(sqlQuery, dbType);
            
            return {
                success: true,
                result: JSON.stringify(validationResult, null, 2)
            };
        } catch (error) { (error as Error).message : String(error)}`
            };
        }
    }

    private async generateORM(schemaFile: string, ormType: string): Promise<ToolResult> {
        try {
            const schemaContent = await fs.readFile(schemaFile, 'utf8');
            const models = this.generateORMModels(schemaContent, ormType);

            const outputDir = path.join(path.dirname(schemaFile), 'models');
            try {
                await fs.access(outputDir);
            } catch {
                await fs.mkdir(outputDir, { recursive: true });
            }

            const promises = models.map(async (model) => {
                const modelPath = path.join(outputDir, `${model.name}.${this.getFileExtension(ormType)}`);
                await fs.writeFile(modelPath, model.content);
                return modelPath;
            });

            const createdFiles = await Promise.all(promises);

            return {
                success: true,
                result: `ORM models generated: ${createdFiles.join(', ')}`
            };
        } catch (error) { (error as Error).message : String(error)}`
            };
        }
    }

    private async optimizeQuery(sqlQuery: string): Promise<ToolResult> {
        try {
            const analysis = this.analyzeQueryPerformance(sqlQuery);
            const optimizations = this.generateQueryOptimizations(analysis);

            return {
                success: true,
                result: JSON.stringify({
                    originalQuery: sqlQuery,
                    analysis,
                    optimizations,
                    improvedQuery: optimizations.optimizedQuery || sqlQuery
                }, null, 2)
            };
        } catch (error) { (error as Error).message : String(error)}`
            };
        }
    }

    private async generateSeeds(tableName: string, recordCount: number = 10): Promise<ToolResult> {
        try {
            const seedData = this.generateSeedData(tableName, recordCount);
            const seedsDir = path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', 'seeds');
            
            try {
                await fs.access(seedsDir);
            } catch {
                await fs.mkdir(seedsDir, { recursive: true });
            }

            const seedPath = path.join(seedsDir, `${tableName}_seeds.sql`);
            await fs.writeFile(seedPath, seedData);

            return {
                success: true,
                result: `Seed file generated at ${seedPath} with ${recordCount} records`
            };
        } catch (error) { (error as Error).message : String(error)}`
            };
        }
    }

    private async createRepository(entityName: string, includeTests: boolean = false): Promise<ToolResult> {
        try {
            const repositoryContent = this.generateRepositoryCode(entityName);
            const repositoryPath = path.join(
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                'src/repositories',
                `${entityName}Repository.ts`
            );

            const repositoryDir = path.dirname(repositoryPath);
            try {
                await fs.access(repositoryDir);
            } catch {
                await fs.mkdir(repositoryDir, { recursive: true });
            }

            await fs.writeFile(repositoryPath, repositoryContent);

            const createdFiles = [repositoryPath];

            if (includeTests) {
                const testContent = this.generateRepositoryTests(entityName);
                const testPath = path.join(
                    path.dirname(repositoryPath),
                    `${entityName}Repository.test.ts`
                );
                await fs.writeFile(testPath, testContent);
                createdFiles.push(testPath);
            }

            return {
                success: true,
                result: `Repository created: ${createdFiles.join(', ')}`
            };
        } catch (error) { (error as Error).message : String(error)}`
            };
        }
    }

    private async generateBackup(dbType: string, includeData: boolean = true): Promise<ToolResult> {
        try {
            const backupScript = this.createBackupScript(dbType, includeData);
            const scriptPath = path.join(
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                'scripts',
                `backup_${dbType}.${this.getScriptExtension()}`
            );

            const scriptDir = path.dirname(scriptPath);
            try {
                await fs.access(scriptDir);
            } catch {
                await fs.mkdir(scriptDir, { recursive: true });
            }

            await fs.writeFile(scriptPath, backupScript);

            return {
                success: true,
                result: `Backup script generated at ${scriptPath}`
            };
        } catch (error) { (error as Error).message : String(error)}`
            };
        }
    }

    private async analyzeSchema(schemaFile: string): Promise<ToolResult> {
        try {
            const content = await fs.readFile(schemaFile, 'utf8');
            const analysis = this.performSchemaAnalysis(content);

            return {
                success: true,
                result: JSON.stringify(analysis, null, 2)
            };
        } catch (error) { (error as Error).message : String(error)}`
            };
        }
    }

    private async generateAPI(schemaFile: string, framework: string = 'express'): Promise<ToolResult> {
        try {
            const schemaContent = await fs.readFile(schemaFile, 'utf8');
            const apiRoutes = this.generateAPIRoutes(schemaContent, framework);

            const apiDir = path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', 'src/api');
            try {
                await fs.access(apiDir);
            } catch {
                await fs.mkdir(apiDir, { recursive: true });
            }

            const promises = apiRoutes.map(async (route) => {
                const routePath = path.join(apiDir, `${route.name}.ts`);
                await fs.writeFile(routePath, route.content);
                return routePath;
            });

            const createdFiles = await Promise.all(promises);

            return {
                success: true,
                result: `API routes generated: ${createdFiles.join(', ')}`
            };
        } catch (error) { (error as Error).message : String(error)}`
            };
        }
    }

    // Helper methods
    private extractInterfaces(content: string): any[] {
        const interfaceRegex = /interface\s+(\w+)\s*{([^}]*)}/g;
        const interfaces: string[] = [];
        let match;

        while ((match = interfaceRegex.exec(content)) !== null) {
            const name = match[1 as keyof typeof match];
            const body = match[2 as keyof typeof match];
            const properties = this.parseInterfaceProperties(body);
            interfaces.push({ name, properties });
        }

        return interfaces;
    }

    private parseInterfaceProperties(body: string): any[] {
        const properties: string[] = [];
        const lines = body.split('\n').map(line => line.trim()).filter(line => line);

        for (const line of lines) {
            const match = line.match(/(\w+)(\?)?:\s*([^;]+)/);
            if (match) {
                properties.push({
                    name: match[1 as keyof typeof match],
                    optional: !!match[2 as keyof typeof match],
                    type: match as any[3 as keyof typeof match].trim()
                });
            }
        }

        return properties;
    }

    private generateDatabaseSchema(interfaces: any[], dbType: string): string {
        let schema = '';

        for (const iface of interfaces) {
            schema += this.generateTableSchema(iface, dbType);
            schema += '\n\n';
        }

        return schema;
    }

    private generateTableSchema(iface: any, dbType: string): string {
        const tableName = iface.name.toLowerCase();
        let schema = `CREATE TABLE ${tableName} (\n`;
        
        schema += '  id SERIAL PRIMARY KEY,\n';
        
        for (const prop of iface.properties) {
            const sqlType = this.mapTypeToSQL(prop.type, dbType);
            const nullable = prop.optional ? '' : ' NOT NULL';
            schema += `  ${prop.name} ${sqlType}${nullable},\n`;
        }
        
        schema += '  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n';
        schema += '  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n';
        schema += ');';
        
        return schema;
    }

    private mapTypeToSQL(tsType: string, dbType: string): string {
        const typeMap: Record<string, Record<string, string>> = {
            postgresql: {
                'string': 'VARCHAR(255)',
                'number': 'INTEGER',
                'boolean': 'BOOLEAN',
                'Date': 'TIMESTAMP',
                'object': 'JSONB'
            },
            mysql: {
                'string': 'VARCHAR(255)',
                'number': 'INT',
                'boolean': 'BOOLEAN',
                'Date': 'DATETIME',
                'object': 'JSON'
            },
            sqlite: {
                'string': 'TEXT',
                'number': 'INTEGER',
                'boolean': 'BOOLEAN',
                'Date': 'DATETIME',
                'object': 'TEXT'
            }
        };

        return typeMap[dbType as keyof typeof typeMap]?.[tsType] || 'TEXT';
    }

    private getSchemaExtension(dbType: string): string {
        return 'sql';
    }

    private createMigrationContent(name: string, operations: string): string {
        return `-- Migration: ${name}
-- Created: ${new Date().toISOString()}
-- Description: ${operations}

-- Add your migration SQL here
-- Example:
-- CREATE TABLE example (
--   id SERIAL PRIMARY KEY,
--   name VARCHAR(255) NOT NULL
-- );

-- Rollback SQL (optional)
-- DROP TABLE IF EXISTS example;
`;
    }

    private validateSQLSyntax(sql: string, dbType: string): any {
        // Basic SQL validation
        const issues: string[] = [];
        
        if (!sql.trim()) {
            issues.push({ type: 'error', message: 'SQL query is empty' });
        }
        
        if (sql.includes('SELECT *') && sql.toLowerCase().includes('join')) {
            issues.push({ type: 'warning', message: 'Consider specifying columns instead of SELECT *' });
        }
        
        if (!sql.trim().endsWith(';')) {
            issues.push({ type: 'warning', message: 'SQL statement should end with semicolon' });
        }

        return {
            valid: issues.filter(i => i.type === 'error').length === 0,
            issues,
            suggestions: this.generateSQLSuggestions(sql)
        };
    }

    private generateSQLSuggestions(sql: string): string[] {
        const suggestions: string[] = [];
        
        if (sql.toLowerCase().includes('select')) {
            suggestions.push('Consider adding LIMIT clause for large datasets');
        }
        
        if (sql.toLowerCase().includes('where')) {
            suggestions.push('Ensure WHERE conditions use indexed columns');
        }
        
        return suggestions;
    }

    private generateORMModels(schema: string, ormType: string): any[] {
        // This would parse the schema and generate appropriate ORM models
        return [{
            name: 'ExampleModel',
            content: this.generateORMModelContent('Example', ormType)
        }];
    }

    private generateORMModelContent(entityName: string, ormType: string): string {
        switch (ormType) {
            case 'typeorm':
                return this.generateTypeORMModel(entityName);
            case 'prisma':
                return this.generatePrismaModel(entityName);
            case 'sequelize':
                return this.generateSequelizeModel(entityName);
            default:
                return `// ${ormType} model for ${entityName}`;
        }
    }

    private generateTypeORMModel(entityName: string): string {
        return `import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('${entityName.toLowerCase()}s')
export class ${entityName} {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
`;
    }

    private generatePrismaModel(entityName: string): string {
        return `model ${entityName} {
  id        Int      @id @default(autoincrement())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("${entityName.toLowerCase()}s")
}
`;
    }

    private generateSequelizeModel(entityName: string): string {
        return `import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database';

export class ${entityName} extends Model {
  public id!: number;
  public name!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

${entityName}.init({
  id: {
    type: DataTypes as any.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes as any.STRING,
    allowNull: false,
  },
}, {
  sequelize,
  tableName: '${entityName.toLowerCase()}s',
});
`;
    }

    private getFileExtension(ormType: string): string {
        return ormType === 'prisma' ? 'prisma' : 'ts';
    }

    private analyzeQueryPerformance(sql: string): any {
        const issues: string[] = [];
        
        if (sql.toLowerCase().includes('select *')) {
            issues.push({
                type: 'performance',
                severity: 'medium',
                message: 'SELECT * can be inefficient for large tables'
            });
        }
        
        if (!sql.toLowerCase().includes('limit') && sql.toLowerCase().includes('select')) {
            issues.push({
                type: 'performance',
                severity: 'high',
                message: 'Consider adding LIMIT clause'
            });
        }

        return { issues, estimatedComplexity: 'medium' };
    }

    private generateQueryOptimizations(analysis: any): any {
        const optimizations: string[] = [];
        
        for (const issue of analysis.issues) {
            if (issue.message.includes('SELECT *')) {
                optimizations.push('Replace SELECT * with specific column names');
            }
            if (issue.message.includes('LIMIT')) {
                optimizations.push('Add LIMIT clause to prevent large result sets');
            }
        }

        return { optimizations };
    }

    private generateSeedData(tableName: string, recordCount: number): string {
        let seedSQL = `-- Seed data for ${tableName}\n`;
        seedSQL += `INSERT INTO ${tableName} (name, created_at) VALUES\n`;
        
        const values: string[] = [];
        for (let i = 1; i <= recordCount; i++) {
            values.push(`('Sample ${tableName} ${i}', NOW())`);
        }
        
        seedSQL += values.join(',\n') + ';';
        return seedSQL;
    }

    private generateRepositoryCode(entityName: string): string {
        return `import { Repository } from 'typeorm';
import { ${entityName} } from '../entities/${entityName}';

export class ${entityName}Repository {
  constructor(private repository: Repository<${entityName}>) {}

  async findAll(): Promise<${entityName}[]> {
    return this.repository.find();
  }

  async findById(id: number): Promise<${entityName} | null> {
    return this.repository.findOne({ where: { id } });
  }

  async create(data: Partial<${entityName}>): Promise<${entityName}> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async update(id: number, data: Partial<${entityName}>): Promise<${entityName} | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected > 0;
  }
}
`;
    }

    private generateRepositoryTests(entityName: string): string {
        return `import { ${entityName}Repository } from './${entityName}Repository';
import { Repository } from 'typeorm';
import { ${entityName} } from '../entities/${entityName}';

describe('${entityName}Repository', () => {
  let repository: ${entityName}Repository;
  let mockTypeormRepository: jest.Mocked<Repository<${entityName}>>;

  beforeEach(() => {
    mockTypeormRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    repository = new ${entityName}Repository(mockTypeormRepository);
  });

  describe('findAll', () => {
    it('should return all entities', async () => {
      const entities = [{ id: 1, name: 'Test' }] as ${entityName}[];
      mockTypeormRepository.find.mockResolvedValue(entities);

      const result = await repository.findAll();

      expect(result).toEqual(entities);
      expect(mockTypeormRepository.find).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return entity by id', async () => {
      const entity = { id: 1, name: 'Test' } as ${entityName};
      mockTypeormRepository.findOne.mockResolvedValue(entity);

      const result = await repository.findById(1);

      expect(result).toEqual(entity);
      expect(mockTypeormRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });
});
`;
    }

    private createBackupScript(dbType: string, includeData: boolean): string {
        switch (dbType) {
            case 'postgresql':
                return this.createPostgresBackupScript(includeData);
            case 'mysql':
                return this.createMySQLBackupScript(includeData);
            default:
                return `# Backup script for ${dbType}\n# Add appropriate backup commands for your database`;
        }
    }

    private createPostgresBackupScript(includeData: boolean): string {
        return `#!/bin/bash
# PostgreSQL Backup Script

DB_NAME="your_database"
DB_USER="your_username"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

${includeData ? 
`# Full backup with data
pg_dump -U $DB_USER -h localhost -d $DB_NAME > $BACKUP_DIR/full_backup_$TIMESTAMP.sql` :
`# Schema only backup
pg_dump -U $DB_USER -h localhost -d $DB_NAME --schema-only > $BACKUP_DIR/schema_backup_$TIMESTAMP.sql`}

echo "Backup completed: $BACKUP_DIR/backup_$TIMESTAMP.sql"
`;
    }

    private createMySQLBackupScript(includeData: boolean): string {
        return `#!/bin/bash
# MySQL Backup Script

DB_NAME="your_database"
DB_USER="your_username"
DB_PASSWORD="your_password"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

${includeData ?
`# Full backup with data
mysqldump -u $DB_USER -p$DB_PASSWORD $DB_NAME > $BACKUP_DIR/full_backup_$TIMESTAMP.sql` :
`# Schema only backup
mysqldump -u $DB_USER -p$DB_PASSWORD --no-data $DB_NAME > $BACKUP_DIR/schema_backup_$TIMESTAMP.sql`}

echo "Backup completed: $BACKUP_DIR/backup_$TIMESTAMP.sql"
`;
    }

    private getScriptExtension(): string {
        return process.platform === 'win32' ? 'bat' : 'sh';
    }

    private performSchemaAnalysis(content: string): any {
        const analysis = {
            tables: [] as any[],
            indexes: [] as any[],
            foreignKeys: [] as any[],
            issues: [] as any[],
            recommendations: [] as any[]
        };

        // Basic schema analysis
        const createTableRegex = /CREATE TABLE\s+(\w+)/gi;
        let match;
        while ((match = createTableRegex.exec(content)) !== null) {
            analysis.tables.push(match[1 as keyof typeof match]);
        }

        // Check for missing indexes
        if (content.includes('WHERE') && !content.includes('INDEX')) {
            analysis.issues.push({
                type: 'performance',
                message: 'Consider adding indexes for WHERE clauses'
            });
        }

        // Check for foreign key constraints
        if (content.includes('REFERENCES')) {
            analysis.recommendations.push('Good use of foreign key constraints');
        }

        return analysis;
    }

    private generateAPIRoutes(schema: string, framework: string): any[] {
        // Extract table names from schema
        const tableRegex = /CREATE TABLE\s+(\w+)/gi;
        const tables: string[] = [];
        let match;
        
        while ((match = tableRegex.exec(schema)) !== null) {
            tables.push(match[1 as keyof typeof match]);
        }

        return tables.map(table => ({
            name: `${table}Routes`,
            content: this.generateAPIRouteContent(table, framework)
        }));
    }

    private generateAPIRouteContent(tableName: string, framework: string): string {
        const entityName = tableName.charAt(0).toUpperCase() + tableName.slice(1);
        
        switch (framework) {
            case 'express':
                return this.generateExpressRoutes(tableName, entityName);
            case 'fastify':
                return this.generateFastifyRoutes(tableName, entityName);
            default:
                return `// API routes for ${tableName}`;
        }
    }

    private generateExpressRoutes(tableName: string, entityName: string): string {
        return `import { Router } from 'express';
import { ${entityName}Repository } from '../repositories/${entityName}Repository';

const router = Router();
const ${tableName}Repository = new ${entityName}Repository();

// GET /${tableName}
router.get('/', async (req, res) => {
  try {
    const items = await ${tableName}Repository.findAll();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /${tableName}/:id
router.get('/:id', async (req, res) => {
  try {
    const item = await ${tableName}Repository.findById(parseInt(req.params.id));
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /${tableName}
router.post('/', async (req, res) => {
  try {
    const item = await ${tableName}Repository.create(req.body);
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /${tableName}/:id
router.put('/:id', async (req, res) => {
  try {
    const item = await ${tableName}Repository.update(parseInt(req.params.id), req.body);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /${tableName}/:id
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await ${tableName}Repository.delete(parseInt(req.params.id));
    if (!deleted) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
`;
    }

    private generateFastifyRoutes(tableName: string, entityName: string): string {
        return `import { FastifyInstance } from 'fastify';
import { ${entityName}Repository } from '../repositories/${entityName}Repository';

export async function ${tableName}Routes(fastify: FastifyInstance) {
  const ${tableName}Repository = new ${entityName}Repository();

  // GET /${tableName}
  fastify.get('/', async (request, reply) => {
    try {
      const items = await ${tableName}Repository.findAll();
      return items;
    } catch (error) {
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // GET /${tableName}/:id
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const item = await ${tableName}Repository.findById(parseInt(id));
      if (!item) {
        reply.code(404).send({ error: 'Item not found' });
        return;
      }
      return item;
    } catch (error) {
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // POST /${tableName}
  fastify.post('/', async (request, reply) => {
    try {
      const item = await ${tableName}Repository.create(request.body);
      reply.code(201).send(item);
    } catch (error) {
      reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
`;
    }
}
