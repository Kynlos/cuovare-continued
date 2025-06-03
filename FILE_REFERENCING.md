# File Referencing System - Cuovare

## Overview

Cuovare now includes a powerful file referencing system that allows you to include specific files and even line ranges in your chat context using the `@` symbol.

## Features

### 🎯 **File Autocomplete**
- Type `@` followed by part of a filename to see autocomplete suggestions
- Use arrow keys to navigate and Enter/Tab to select
- Supports fuzzy matching (e.g., `@index` will match `src/index.ts`)

### 📄 **File References**
Include entire files in your chat context:
```
@package.json
@src/extension.ts
@README.md
```

### 📏 **Line Range Support**
Reference specific lines from files:
```
@src/extension.ts:1-50        # Lines 1 through 50
@package.json:10              # Just line 10
@README.md:5-25              # Lines 5 through 25
```

### 🔄 **Multiple File References**
Reference multiple files in a single message:
```
Can you explain how @src/extension.ts:1-30 connects to @src/providers/ChatViewProvider.ts:50-100?
```

### ✨ **Visual Indicators**
- Referenced files appear as blue pills below the input
- Shows filename and line range (if specified)
- Click × to remove individual references

## Usage Examples

### Basic File Reference
```
Explain what @src/extension.ts does
```

### Line Range Analysis
```
Review @src/providers/ChatViewProvider.ts:200-250 for potential improvements
```

### Multi-file Comparison
```
Compare the implementation in @src/context/FileContextManager.ts:100-150 
with @src/providers/AIProviderManager.ts:50-100
```

### Code Generation with Context
```
Based on @package.json and @src/extension.ts:1-50, create a new command 
that opens the chat view programmatically
```

## Technical Details

### File Resolution
- Files are resolved relative to the workspace root
- Supports nested directories (e.g., `@src/providers/file.ts`)
- Case-insensitive matching for autocomplete

### Line Numbering
- Uses 1-based line numbering (like VS Code)
- Invalid line ranges are automatically clamped to file boundaries
- Missing files are gracefully ignored with console warnings

### Context Integration
- Referenced files are added to the AI system prompt
- Content is clearly labeled with filename and line ranges
- AI is instructed to pay special attention to referenced files

## Keyboard Shortcuts

- `@` - Start file reference
- `Arrow Keys` - Navigate autocomplete
- `Enter/Tab` - Select file
- `Escape` - Close autocomplete
- `Backspace` - Edit/remove references

## Tips

1. **Specific Questions**: Reference exact lines for precise analysis
2. **Code Reviews**: Include the specific function or class you want reviewed
3. **Debugging**: Reference error-prone sections with line numbers
4. **Documentation**: Reference config files when asking about setup
5. **Comparisons**: Reference multiple related files to understand relationships

## Error Handling

- Non-existent files are silently ignored
- Invalid line ranges are automatically corrected
- Workspace-relative paths are enforced for security
- Large files are truncated if necessary (with notification)

This system makes Cuovare context-aware and allows for precise, targeted assistance with your codebase.
