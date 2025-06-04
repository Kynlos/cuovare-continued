import os
import re

# Tools to fix
tools = [
    'ProjectScaffoldingTool.ts',
    'DatabaseSchemaTool.ts', 
    'APIDocumentationTool.ts'
]

categories = {
    'ProjectScaffoldingTool.ts': 'Project Management',
    'DatabaseSchemaTool.ts': 'Database',
    'APIDocumentationTool.ts': 'Documentation'
}

for tool in tools:
    filepath = f'src/agent/executors/{tool}'
    
    if not os.path.exists(filepath):
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix imports
    content = re.sub(
        r'import { ToolExecutor, ToolResult } from',
        'import { ToolExecutor, ToolResult, ToolMetadata } from',
        content
    )
    
    # Fix metadata declaration
    content = re.sub(
        r'static metadata = {',
        'public metadata: ToolMetadata = {',
        content
    )
    
    # Add category
    category = categories.get(tool, 'Development')
    content = re.sub(
        r'(description: [\'"][^\'"]+[\'"],)',
        rf'\1\n        category: \'{category}\',',
        content
    )
    
    # Fix execute method signature
    content = re.sub(
        r'async execute\(params: Record<string, any>\): Promise<ToolResult>',
        'async execute(params: any, context: { workspaceRoot: string; outputChannel: any; onProgress?: (message: string) => void }): Promise<ToolResult>',
        content
    )
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print(f'Fixed {tool}')

print('All tools fixed!')
