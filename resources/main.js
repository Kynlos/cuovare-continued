// Cuovare Advanced AI Assistant - Main JavaScript

(function() {
    'use strict';

    // Get VS Code API
    const vscode = acquireVsCodeApi();
    
    // Global state
    let chatHistory = [];
    let isLoading = false;
    let settings = {};
    let workspaceFiles = [];
    let fileReferences = [];
    let autocompleteVisible = false;
    let selectedAutocompleteIndex = -1;

    // DOM elements
    const chatMessages = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const settingsPanel = document.getElementById('settingsPanel');
    const historyPanel = document.getElementById('historyPanel');
    const settingsBtn = document.getElementById('settingsBtn');
    const historyBtn = document.getElementById('historyBtn');
    const newChatBtn = document.getElementById('newChatBtn');
    const generateCommitBtn = document.getElementById('generateCommitBtn');
    const clearBtn = document.getElementById('clearBtn');
    const closeSettings = document.getElementById('closeSettings');
    const closeHistory = document.getElementById('closeHistory');
    const mcpServerModal = document.getElementById('mcpServerModal');
    const addMCPServerBtn = document.getElementById('addMCPServerBtn');
    const fileReferencesDiv = document.getElementById('fileReferences');
    const fileReferencesList = document.getElementById('fileReferencesList');
    const autocompleteDropdown = document.getElementById('autocompleteDropdown');

    // Initialize the application
    function init() {
        setupEventListeners();
        requestSettings();
        setupMessageInput();
        setupCodeHighlighting();
        setupFileReferencing();
        requestWorkspaceFiles();
    }

    function setupEventListeners() {
        // Message input and sending
        sendBtn.addEventListener('click', sendMessage);
        messageInput.addEventListener('keydown', handleInputKeydown);
        messageInput.addEventListener('input', updateSendButton);

        // Header buttons
        settingsBtn.addEventListener('click', showSettings);
        historyBtn.addEventListener('click', showHistory);
        newChatBtn.addEventListener('click', createNewChat);
        generateCommitBtn.addEventListener('click', generateCommitMessage);
        if (clearBtn) clearBtn.addEventListener('click', clearChat);
        closeSettings.addEventListener('click', hideSettings);
        closeHistory.addEventListener('click', hideHistory);

        // MCP Server modal
        addMCPServerBtn.addEventListener('click', showMCPServerModal);
        document.getElementById('saveMCPServer').addEventListener('click', saveMCPServer);
        document.getElementById('cancelMCPServer').addEventListener('click', hideMCPServerModal);

        // Listen for VS Code messages
        window.addEventListener('message', handleVSCodeMessage);

        // Auto-resize textarea
        messageInput.addEventListener('input', autoResizeTextarea);
        
        // File referencing
        messageInput.addEventListener('input', handleFileReferencing);
        messageInput.addEventListener('keydown', handleAutocompleteKeydown);
        
        // Click outside to close autocomplete
        document.addEventListener('click', (e) => {
            if (!autocompleteDropdown.contains(e.target) && e.target !== messageInput) {
                hideAutocomplete();
            }
        });
    }

    function setupMessageInput() {
        // Focus on input by default
        messageInput.focus();
        
        // Placeholder animation
        let placeholderIndex = 0;
        const placeholders = [
            "Ask me anything about your code...",
            "Explain this function...",
            "How can I optimize this?",
            "Generate a test for...",
            "Review my code...",
            "What does this error mean?"
        ];

        setInterval(() => {
            placeholderIndex = (placeholderIndex + 1) % placeholders.length;
            messageInput.placeholder = placeholders[placeholderIndex];
        }, 3000);
    }

    function setupCodeHighlighting() {
        // Import and configure highlight.js if available
        if (typeof hljs !== 'undefined') {
            hljs.configure({
                languages: ['javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'html', 'css', 'json', 'xml', 'sql', 'shell', 'bash', 'yaml', 'markdown', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'scala', 'r', 'matlab', 'powershell'],
                classPrefix: 'hljs-',
                ignoreUnescapedHTML: true
            });
        }
    }

    function setupFileReferencing() {
        // Initialize file references
        updateFileReferencesDisplay();
    }

    function requestWorkspaceFiles() {
        vscode.postMessage({ type: 'getWorkspaceFiles' });
    }

    function handleFileReferencing(e) {
        const input = e.target.value;
        const cursorPos = e.target.selectionStart;
        
        // Check if we're typing after an @ symbol
        const beforeCursor = input.substring(0, cursorPos);
        const atMatch = beforeCursor.match(/@([^@\s]*)$/);
        
        if (atMatch) {
            const query = atMatch[1];
            showAutocomplete(query, cursorPos - query.length - 1);
        } else {
            hideAutocomplete();
        }
        
        // Update file references
        updateFileReferences(input);
    }

    function handleAutocompleteKeydown(e) {
        if (!autocompleteVisible) return;
        
        const items = autocompleteDropdown.querySelectorAll('.autocomplete-item');
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                selectedAutocompleteIndex = Math.min(selectedAutocompleteIndex + 1, items.length - 1);
                updateAutocompleteSelection();
                break;
            case 'ArrowUp':
                e.preventDefault();
                selectedAutocompleteIndex = Math.max(selectedAutocompleteIndex - 1, -1);
                updateAutocompleteSelection();
                break;
            case 'Enter':
            case 'Tab':
                e.preventDefault();
                if (selectedAutocompleteIndex >= 0 && items[selectedAutocompleteIndex]) {
                    selectAutocompleteItem(items[selectedAutocompleteIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                hideAutocomplete();
                break;
        }
    }

    function showAutocomplete(query, startPos) {
        const filteredFiles = workspaceFiles.filter(file => 
            file.toLowerCase().includes(query.toLowerCase())
        );
        
        if (filteredFiles.length === 0) {
            hideAutocomplete();
            return;
        }
        
        autocompleteDropdown.innerHTML = '';
        autocompleteDropdown.classList.remove('hidden');
        autocompleteVisible = true;
        selectedAutocompleteIndex = -1;
        
        filteredFiles.slice(0, 10).forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.innerHTML = `
                <svg class="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <span class="font-mono text-sm text-slate-300 truncate">${file}</span>
            `;
            item.addEventListener('click', () => selectAutocompleteItem(item));
            item.dataset.file = file;
            item.dataset.startPos = startPos;
            autocompleteDropdown.appendChild(item);
        });
        
        // Position the dropdown
        const rect = messageInput.getBoundingClientRect();
        autocompleteDropdown.style.bottom = (rect.height + 8) + 'px';
        autocompleteDropdown.style.left = '0';
        autocompleteDropdown.style.width = '100%';
    }

    function hideAutocomplete() {
        autocompleteDropdown.classList.add('hidden');
        autocompleteVisible = false;
        selectedAutocompleteIndex = -1;
    }

    function updateAutocompleteSelection() {
        const items = autocompleteDropdown.querySelectorAll('.autocomplete-item');
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === selectedAutocompleteIndex);
        });
    }

    function selectAutocompleteItem(item) {
        const file = item.dataset.file;
        const startPos = parseInt(item.dataset.startPos);
        const input = messageInput.value;
        const cursorPos = messageInput.selectionStart;
        
        // Find the end of the current @ reference
        const beforeCursor = input.substring(0, cursorPos);
        const atMatch = beforeCursor.match(/@([^@\s]*)$/);
        
        if (atMatch) {
            const newInput = input.substring(0, startPos) + '@' + file + input.substring(cursorPos);
            messageInput.value = newInput;
            messageInput.setSelectionRange(startPos + file.length + 1, startPos + file.length + 1);
        }
        
        hideAutocomplete();
        updateFileReferences(messageInput.value);
        messageInput.focus();
    }

    function updateFileReferences(input) {
        // Parse file references from input
        const references = [];
        const regex = /@([^\s@]+)(?::(\d+)(?:-(\d+))?)?/g;
        let match;
        
        while ((match = regex.exec(input)) !== null) {
            const [fullMatch, fileName, startLine, endLine] = match;
            references.push({
                fileName,
                startLine: startLine ? parseInt(startLine) : null,
                endLine: endLine ? parseInt(endLine) : null,
                fullMatch
            });
        }
        
        fileReferences = references;
        updateFileReferencesDisplay();
    }

    function updateFileReferencesDisplay() {
        if (fileReferences.length === 0) {
            fileReferencesDiv.classList.add('hidden');
            return;
        }
        
        fileReferencesDiv.classList.remove('hidden');
        fileReferencesList.innerHTML = fileReferences.map(ref => {
            const lineInfo = ref.startLine ? 
                (ref.endLine ? `:${ref.startLine}-${ref.endLine}` : `:${ref.startLine}`) : '';
            
            return `
                <div class="file-reference">
                    <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <span class="font-medium">${ref.fileName}${lineInfo}</span>
                    <button onclick="removeFileReference('${ref.fullMatch.replace(/'/g, "\\'")}')">×</button>
                </div>
            `;
        }).join('');
    }

    // Global function to remove file reference
    window.removeFileReference = function(fullMatch) {
        const input = messageInput.value;
        const newInput = input.replace(fullMatch, '').replace(/\s+/g, ' ').trim();
        messageInput.value = newInput;
        updateFileReferences(newInput);
    };

    // Global functions for code actions
    window.copyCode = async function(codeId) {
        const container = document.querySelector(`[data-code-id="${codeId}"]`);
        if (!container) return;
        
        const codeElement = container.querySelector('pre code');
        if (!codeElement) return;
        
        const code = codeElement.textContent;
        
        try {
            await navigator.clipboard.writeText(code);
            showCodeActionFeedback(container.querySelector('.copy-btn'), 'Copied!', 'success');
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = code;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showCodeActionFeedback(container.querySelector('.copy-btn'), 'Copied!', 'success');
        }
    };

    window.applyCode = function(codeId, code, language) {
        const container = document.querySelector(`[data-code-id="${codeId}"]`);
        
        // Check if there's a file path comment in the code
        const filePathMatch = code.match(/\/\/\s*File:\s*(.+)|#\s*File:\s*(.+)|<!--\s*File:\s*(.+)\s*-->/);
        let targetFile = null;
        
        if (filePathMatch) {
            targetFile = filePathMatch[1] || filePathMatch[2] || filePathMatch[3];
            targetFile = targetFile.trim();
            
            // Apply to specific file
            vscode.postMessage({
                type: 'applyCodeToFile',
                filePath: targetFile,
                content: code.replace(/\/\/\s*File:\s*.+\n?|#\s*File:\s*.+\n?|<!--\s*File:\s*.+\s*-->\n?/, '').trim()
            });
            
            showCodeActionFeedback(container.querySelector('.apply-btn'), `Applied to ${targetFile}`, 'success');
        } else {
            // Apply to current file
            vscode.postMessage({
                type: 'getActiveFile'
            });
            
            // Store the code to apply when we get the active file response
            window.pendingApplyCode = { code, language, codeId };
            showCodeActionFeedback(container.querySelector('.apply-btn'), 'Applying...', 'info');
        }
    };

    window.createFile = function(codeId, code, language) {
        const container = document.querySelector(`[data-code-id="${codeId}"]`);
        
        // Try to extract filename from code comments or generate one
        let fileName = extractFileName(code, language);
        
        if (!fileName) {
            // Generate filename based on language
            const extensions = {
                'javascript': 'js',
                'typescript': 'ts',
                'python': 'py',
                'java': 'java',
                'cpp': 'cpp',
                'c': 'c',
                'html': 'html',
                'css': 'css',
                'json': 'json',
                'sql': 'sql',
                'bash': 'sh',
                'yaml': 'yml',
                'markdown': 'md',
                'php': 'php',
                'ruby': 'rb',
                'go': 'go',
                'rust': 'rs',
                'swift': 'swift'
            };
            
            const ext = extensions[language] || 'txt';
            fileName = `generated_${Date.now()}.${ext}`;
        }
        
        vscode.postMessage({
            type: 'createNewFile',
            fileName: fileName,
            content: code,
            language: language
        });
        
        showCodeActionFeedback(container.querySelector('.create-btn'), `Creating ${fileName}`, 'success');
    };

    function extractFileName(code, language) {
        // Look for filename hints in comments
        const patterns = [
            /\/\/\s*File:\s*(.+)/,
            /\/\/\s*@file\s+(.+)/,
            /#\s*File:\s*(.+)/,
            /<!--\s*File:\s*(.+)\s*-->/,
            /\/\*\s*File:\s*(.+)\s*\*\//,
            /\/\/\s*(.+\.(js|ts|py|java|cpp|html|css|json|sql|sh|yml|md|php|rb|go|rs|swift))/i
        ];
        
        for (const pattern of patterns) {
            const match = code.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }
        
        // Try to extract class or function names for filename
        if (language === 'java' || language === 'typescript' || language === 'javascript') {
            const classMatch = code.match(/(?:export\s+)?(?:default\s+)?class\s+(\w+)/);
            if (classMatch) {
                const ext = language === 'java' ? 'java' : (language === 'typescript' ? 'ts' : 'js');
                return `${classMatch[1]}.${ext}`;
            }
        }
        
        if (language === 'python') {
            const classMatch = code.match(/class\s+(\w+)/);
            if (classMatch) {
                return `${classMatch[1].toLowerCase()}.py`;
            }
        }
        
        return null;
    }

    function showCodeActionFeedback(button, message, type = 'info') {
        if (!button) return;
        
        const originalContent = button.innerHTML;
        const originalTitle = button.title;
        
        // Update button
        button.innerHTML = message;
        button.title = message;
        button.classList.add('feedback', type);
        
        // Reset after delay
        setTimeout(() => {
            button.innerHTML = originalContent;
            button.title = originalTitle;
            button.classList.remove('feedback', 'info', 'success', 'error');
        }, 2000);
    }

    function handleInputKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    function autoResizeTextarea() {
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
        updateSendButton();
    }

    function updateSendButton() {
        const hasText = messageInput.value.trim().length > 0;
        sendBtn.disabled = !hasText || isLoading;
    }

    function sendMessage() {
        const message = messageInput.value.trim();
        if (!message || isLoading) return;

        vscode.postMessage({
            type: 'sendMessage',
            message: message,
            fileReferences: fileReferences.map(ref => ref.fileName)
        });

        messageInput.value = '';
        fileReferences = [];
        updateFileReferencesDisplay();
        autoResizeTextarea();
        updateSendButton();
    }

    function clearChat() {
        if (confirm('Are you sure you want to clear the chat history?')) {
            vscode.postMessage({ type: 'clearChat' });
        }
    }

    function showSettings() {
        settingsPanel.classList.remove('hidden');
        requestSettings();
    }

    function hideSettings() {
        settingsPanel.classList.add('hidden');
    }

    function showHistory() {
        historyPanel.classList.remove('hidden');
        vscode.postMessage({ type: 'getSessions' });
    }

    function hideHistory() {
        historyPanel.classList.add('hidden');
    }

    function createNewChat() {
        vscode.postMessage({ type: 'newChat' });
    }

    function generateCommitMessage() {
        // Show loading state on button
        const btn = document.getElementById('generateCommitBtn');
        const originalHTML = btn.innerHTML;
        btn.classList.add('animate-pulse');
        btn.innerHTML = `
            <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
        `;
        
        vscode.postMessage({ type: 'generateCommitMessage' });
        
        // Reset button after a delay (the backend will handle the actual completion)
        setTimeout(() => {
            btn.classList.remove('animate-pulse');
            btn.innerHTML = originalHTML;
        }, 3000);
    }

    function requestSettings() {
        vscode.postMessage({ type: 'getSettings' });
    }

    function showMCPServerModal() {
        mcpServerModal.classList.remove('hidden');
    }

    function hideMCPServerModal() {
        mcpServerModal.classList.add('hidden');
        clearMCPServerForm();
    }

    function clearMCPServerForm() {
        document.getElementById('serverName').value = '';
        document.getElementById('serverCommand').value = '';
        document.getElementById('serverArgs').value = '';
    }

    function saveMCPServer() {
        const name = document.getElementById('serverName').value.trim();
        const command = document.getElementById('serverCommand').value.trim();
        const args = document.getElementById('serverArgs').value.trim().split(',').map(s => s.trim()).filter(s => s);

        if (!name || !command) {
            showNotification('Please fill in server name and command', 'error');
            return;
        }

        vscode.postMessage({
            type: 'addMCPServer',
            server: { name, command, args }
        });

        hideMCPServerModal();
    }

    function handleVSCodeMessage(event) {
        const message = event.data;

        switch (message.type) {
            case 'chatHistory':
                updateChatHistory(message.data);
                setLoading(message.isLoading);
                break;
            case 'newMessage':
                addNewMessage(message.message);
                break;
            case 'updateMessage':
                updateMessage(message.message);
                break;
            case 'loadingState':
                setLoading(message.isLoading);
                break;
            case 'settings':
                updateSettings(message.data);
                break;
            case 'showSettings':
                showSettings();
                break;
            case 'notification':
                showNotification(message.message);
                break;
            case 'sessionList':
                renderSessionList(message.data);
                break;
            case 'activeFileInfo':
                handleActiveFileInfo(message.data);
                break;
            case 'workspaceFiles':
                workspaceFiles = message.data;
                break;
        }
    }

    function updateChatHistory(history) {
        chatHistory = history;
        renderChatMessages();
    }

    function addNewMessage(message) {
        chatHistory.push(message);
        const messageElement = createMessageElement(message);
        chatMessages.appendChild(messageElement);
        scrollToBottom();
        highlightCode();
    }

    function updateMessage(message) {
        // Find and update existing message in history
        const messageIndex = chatHistory.findIndex(m => m.id === message.id);
        if (messageIndex !== -1) {
            chatHistory[messageIndex] = message;
            
            // Find and update DOM element
            const existingElement = chatMessages.querySelector(`[data-message-id="${message.id}"]`);
            if (existingElement) {
                const newElement = createMessageElement(message);
                existingElement.parentNode.replaceChild(newElement, existingElement);
                highlightCode();
            }
        }
    }

    function setLoading(loading) {
        isLoading = loading;
        loadingIndicator.classList.toggle('hidden', !loading);
        updateSendButton();
        
        if (loading) {
            scrollToBottom();
        }
    }

    function renderChatMessages() {
        chatMessages.innerHTML = '';

        if (chatHistory.length === 0) {
            const welcomeMessage = createWelcomeMessage();
            chatMessages.appendChild(welcomeMessage);
        } else {
            chatHistory.forEach(message => {
                const messageElement = createMessageElement(message);
                chatMessages.appendChild(messageElement);
            });
        }

        scrollToBottom();
        highlightCode();
    }

    function createWelcomeMessage() {
        const welcomeDiv = document.createElement('div');
        welcomeDiv.className = 'fade-in text-center py-4 px-3 max-w-sm mx-auto';
        welcomeDiv.innerHTML = `
            <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
            </div>
            <h3 class="text-lg font-bold mb-2 text-slate-100">Welcome to Cuovare</h3>
            <p class="text-slate-400 mb-4 text-sm">Your AI coding companion</p>
            
            <div class="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 mb-4 text-left">
                <div class="grid grid-cols-2 gap-2">
                    <div class="flex items-center gap-2 p-2 bg-slate-800/30 rounded-md">
                        <div class="w-6 h-6 bg-blue-500/20 rounded flex items-center justify-center">
                            <svg class="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                            </svg>
                        </div>
                        <div class="text-xs text-slate-300">Analyze Code</div>
                    </div>
                    
                    <div class="flex items-center gap-2 p-2 bg-slate-800/30 rounded-md">
                        <div class="w-6 h-6 bg-green-500/20 rounded flex items-center justify-center">
                            <svg class="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
                            </svg>
                        </div>
                        <div class="text-xs text-slate-300">Generate Code</div>
                    </div>
                    
                    <div class="flex items-center gap-2 p-2 bg-slate-800/30 rounded-md">
                        <div class="w-6 h-6 bg-purple-500/20 rounded flex items-center justify-center">
                            <svg class="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                        </div>
                        <div class="text-xs text-slate-300">Review Code</div>
                    </div>
                    
                    <div class="flex items-center gap-2 p-2 bg-slate-800/30 rounded-md">
                        <div class="w-6 h-6 bg-red-500/20 rounded flex items-center justify-center">
                            <svg class="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                            </svg>
                        </div>
                        <div class="text-xs text-slate-300">Debug Issues</div>
                    </div>
                </div>
                
                <div class="mt-3 p-2 bg-blue-500/10 border border-blue-500/20 rounded-md">
                    <div class="flex items-center gap-1 text-blue-400 text-xs font-medium mb-1">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        File References
                    </div>
                    <div class="text-slate-400 text-xs">Use <code class="text-blue-300 bg-blue-500/10 px-1 rounded">@filename</code> to reference files</div>
                </div>
            </div>
            
            <div class="bg-slate-800/40 border border-slate-700/50 rounded-md p-3">
                <div class="flex items-center gap-1 text-xs text-slate-400 mb-1">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Setup
                </div>
                <div id="currentProviderInfo" class="text-slate-300 font-medium text-xs">Configure AI provider in settings</div>
            </div>
        `;
        return welcomeDiv;
    }

    function createMessageElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `fade-in ${message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`;
        messageDiv.setAttribute('data-message-id', message.id);

        const contentWrapper = document.createElement('div');
        const isUser = message.role === 'user';
        
        contentWrapper.className = `max-w-[min(85%,42rem)] ${
            isUser 
                ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg' 
                : 'bg-slate-800/60 border border-slate-700/50 text-slate-100 backdrop-blur-sm'
        } rounded-2xl ${isUser ? 'rounded-br-md' : 'rounded-bl-md'} p-4 transition-all duration-200 hover:shadow-xl`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'prose prose-invert max-w-none text-sm leading-relaxed';
        
        // Process markdown content with agentic capabilities
        const processedContent = processMarkdownWithAgentic(message.content);
        contentDiv.innerHTML = processedContent;

        const metadataDiv = document.createElement('div');
        metadataDiv.className = `flex items-center gap-2 mt-3 pt-2 border-t ${
            isUser ? 'border-blue-500/30' : 'border-slate-700/50'
        } text-xs ${isUser ? 'text-blue-100' : 'text-slate-400'}`;
        
        const timestamp = new Date(message.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        let metadataHTML = `
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span>${timestamp}</span>
        `;
        
        if (message.metadata?.provider) {
            metadataHTML += `
                <div class="flex items-center gap-1">
                    <div class="w-1 h-1 bg-current rounded-full opacity-50"></div>
                    <span class="px-2 py-0.5 bg-gradient-to-r from-emerald-500/20 to-teal-600/20 border border-emerald-500/30 rounded-full text-emerald-400 font-medium">${message.metadata.provider}</span>
                </div>
            `;
        }
        
        if (message.metadata?.model) {
            metadataHTML += `
                <div class="flex items-center gap-1">
                    <div class="w-1 h-1 bg-current rounded-full opacity-50"></div>
                    <span class="font-mono opacity-75">${message.metadata.model}</span>
                </div>
            `;
        }
        
        if (message.metadata?.files?.length > 0) {
            const fileCount = message.metadata.files.length;
            metadataHTML += `
                <div class="flex items-center gap-1" title="Explicit files: ${message.metadata.files.join(', ')}">
                    <div class="w-1 h-1 bg-current rounded-full opacity-50"></div>
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <span>${fileCount} ${fileCount === 1 ? 'file' : 'files'}</span>
                </div>
            `;
        }
        
        if (message.metadata?.intelligentContextFiles?.length > 0) {
            const intelligentFileCount = message.metadata.intelligentContextFiles.length;
            metadataHTML += `
                <div class="flex items-center gap-1" title="AI-selected context: ${message.metadata.intelligentContextFiles.join(', ')}">
                    <div class="w-1 h-1 bg-current rounded-full opacity-50"></div>
                    <svg class="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                    </svg>
                    <span class="text-blue-400">${intelligentFileCount} smart context</span>
                </div>
            `;
        }

        metadataDiv.innerHTML = metadataHTML;

        // Add copy message button for assistant messages
        if (!isUser) {
            const copyMessageBtn = document.createElement('button');
            copyMessageBtn.className = 'copy-message-btn absolute top-2 right-2 opacity-0 hover:opacity-100 transition-opacity duration-200 p-1 rounded bg-slate-700/50 hover:bg-slate-600 text-slate-300 hover:text-white';
            copyMessageBtn.innerHTML = `
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                </svg>
            `;
            copyMessageBtn.title = 'Copy message';
            copyMessageBtn.onclick = () => copyMessage(message.content);
            
            contentWrapper.style.position = 'relative';
            contentWrapper.appendChild(copyMessageBtn);
        }

        metadataDiv.innerHTML = metadataHTML;

        contentWrapper.appendChild(contentDiv);
        contentWrapper.appendChild(metadataDiv);
        messageDiv.appendChild(contentWrapper);

        return messageDiv;
    }

    // Global function to copy entire message
    window.copyMessage = async function(content) {
        // Strip HTML tags for plain text copy
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        const plainText = tempDiv.textContent || tempDiv.innerText || '';
        
        try {
            await navigator.clipboard.writeText(plainText);
            showNotification('Message copied to clipboard', 'success');
        } catch (err) {
            // Fallback
            const textArea = document.createElement('textarea');
            textArea.value = plainText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showNotification('Message copied to clipboard', 'success');
        }
    }

    function processMarkdownWithAgentic(content) {
        // Enhanced markdown processing with agentic capabilities
        let processed = content;

        // Code blocks with agentic actions and language detection
        processed = processed.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, language, code) => {
            const detectedLang = language || detectCodeLanguage(code);
            const codeId = 'code_' + Math.random().toString(36).substr(2, 9);
            const trimmedCode = code.trim();
            const escapedCode = escapeHtml(trimmedCode);
            const safeCode = JSON.stringify(trimmedCode); // Better escaping
            
            // Check if this looks like a file modification (contains function names, imports, etc.)
            const isFileEdit = detectFileEdit(trimmedCode);
            const hasFilePath = /\/\/\s*File:\s*(.+)|#\s*File:\s*(.+)|<!--\s*File:\s*(.+)\s*-->/.test(trimmedCode);
            
            return `
                <div class="code-block-container" data-code-id="${codeId}" data-language="${detectedLang}">
                    <div class="code-header">
                        <div class="code-language">${detectedLang || 'code'}</div>
                        <div class="code-actions">
                            <button class="code-action-btn copy-btn" onclick="copyCode('${codeId}')" title="Copy to clipboard">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                                </svg>
                            </button>
                            ${isFileEdit || hasFilePath ? `
                                <button class="code-action-btn apply-btn" onclick="applyCode('${codeId}', ${safeCode}, '${detectedLang}')" title="Apply to current file">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                    </svg>
                                </button>
                            ` : ''}
                            <button class="code-action-btn create-btn" onclick="createFile('${codeId}', ${safeCode}, '${detectedLang}')" title="Create new file">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <pre><code class="language-${detectedLang}">${escapedCode}</code></pre>
                </div>
            `;
        });

        // Enhanced inline code with better formatting
        processed = processed.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');

        // Headers
        processed = processed.replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold text-slate-200 mt-4 mb-2">$1</h3>');
        processed = processed.replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold text-slate-100 mt-6 mb-3">$1</h2>');
        processed = processed.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-slate-100 mt-8 mb-4">$1</h1>');

        // Lists with better formatting
        processed = processed.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="ml-4 text-slate-200">• $1</li>');
        processed = processed.replace(/^\s*\d+\.\s+(.*$)/gim, '<li class="ml-4 text-slate-200 list-decimal">$1</li>');

        // Bold and italic
        processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-100">$1</strong>');
        processed = processed.replace(/\*(.*?)\*/g, '<em class="italic text-slate-300">$1</em>');

        // Links
        processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">$1</a>');

        // Blockquotes
        processed = processed.replace(/^>\s+(.*$)/gim, '<blockquote class="border-l-4 border-blue-500 pl-4 italic text-slate-300 bg-slate-800/30 py-2 my-2">$1</blockquote>');

        // Line breaks (preserve double line breaks as paragraphs)
        processed = processed.replace(/\n\n/g, '</p><p class="mb-3">');
        processed = processed.replace(/\n/g, '<br>');
        
        // Wrap in paragraph if not already wrapped
        if (!processed.startsWith('<')) {
            processed = '<p class="mb-3">' + processed + '</p>';
        }

        return processed;
    }

    function detectCodeLanguage(code) {
        const trimmed = code.trim();
        
        // Check for specific patterns
        if (trimmed.includes('import ') && trimmed.includes('from ') || trimmed.includes('export ')) {
            if (trimmed.includes('interface ') || trimmed.includes(': string') || trimmed.includes(': number')) {
                return 'typescript';
            }
            return 'javascript';
        }
        
        if (trimmed.includes('def ') || trimmed.includes('import ') && trimmed.includes('as ')) {
            return 'python';
        }
        
        if (trimmed.includes('public class ') || trimmed.includes('private ') || trimmed.includes('System.out')) {
            return 'java';
        }
        
        if (trimmed.includes('#include') || trimmed.includes('std::')) {
            return 'cpp';
        }
        
        if (trimmed.includes('func ') || trimmed.includes('package main')) {
            return 'go';
        }
        
        if (trimmed.includes('fn ') || trimmed.includes('let mut ')) {
            return 'rust';
        }
        
        if (trimmed.includes('<!DOCTYPE') || trimmed.includes('<html')) {
            return 'html';
        }
        
        if (trimmed.includes('{') && (trimmed.includes('color:') || trimmed.includes('margin:'))) {
            return 'css';
        }
        
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                JSON.parse(trimmed);
                return 'json';
            } catch (e) {}
        }
        
        if (trimmed.includes('SELECT ') || trimmed.includes('INSERT ') || trimmed.includes('UPDATE ')) {
            return 'sql';
        }
        
        if (trimmed.includes('#!/bin/bash') || trimmed.includes('echo ') || trimmed.includes('cd ')) {
            return 'bash';
        }
        
        return 'text';
    }

    function detectFileEdit(code) {
        // Detect if code looks like a file modification
        const patterns = [
            /function\s+\w+\s*\(/,
            /class\s+\w+/,
            /interface\s+\w+/,
            /import\s+.*from/,
            /export\s+(default\s+)?(function|class|const|let)/,
            /@\w+\(/,  // Decorators
            /def\s+\w+\s*\(/,  // Python functions
            /public\s+(class|interface|enum)/,  // Java/C# 
            /#include\s*</,  // C/C++ includes
            /package\s+\w+/  // Go/Java packages
        ];
        
        return patterns.some(pattern => pattern.test(code));
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function highlightCode() {
        // Apply syntax highlighting to code blocks
        if (typeof hljs !== 'undefined') {
            chatMessages.querySelectorAll('pre code').forEach(block => {
                hljs.highlightElement(block);
            });
        }
    }

    function scrollToBottom() {
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 100);
    }

    function updateSettings(settingsData) {
        settings = settingsData;
        renderSettings();
        updateProviderInfo();
    }

    function updateProviderInfo() {
        const infoElement = document.getElementById('currentProviderInfo');
        if (!infoElement) return;

        // Find the active provider (one that has API key)
        let activeProvider = null;
        if (settings.defaultProvider && settings.apiKeyStatus?.[settings.defaultProvider]) {
            activeProvider = settings.defaultProvider;
        } else if (settings.availableProviders && settings.availableProviders.length > 0) {
            activeProvider = settings.availableProviders[0];
        }

        if (activeProvider && settings.selectedModels && settings.selectedModels[activeProvider]) {
            const model = settings.selectedModels[activeProvider];
            infoElement.innerHTML = `Provider: <strong>${activeProvider}</strong> | Model: <strong>${model}</strong>`;
        } else if (activeProvider) {
            const models = settings.providerModels?.[activeProvider] || [];
            const defaultModel = models[0] || 'No model';
            infoElement.innerHTML = `Provider: <strong>${activeProvider}</strong> | Model: <strong>${defaultModel}</strong> (default)`;
        } else {
            infoElement.innerHTML = '⚠️ Configure your API keys in settings to get started';
        }
    }

    function renderSettings() {
        renderAPIKeys();
        renderProviderSelect();
        renderMCPServers();
        renderMCPTools();
    }

    function renderAPIKeys() {
        const container = document.getElementById('apiKeysContainer');
        container.innerHTML = '';

        settings.allProviders?.forEach(provider => {
            const div = document.createElement('div');
            div.className = 'bg-slate-800/60 border border-slate-700/50 rounded-lg p-2';
            
            const isConfigured = settings.apiKeyStatus?.[provider] === true;
            const inputId = `apiKey_${provider}`;
            const eyeId = `eyeToggle_${provider}`;
            
            div.innerHTML = `
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center">
                            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                            </svg>
                        </div>
                        <div>
                            <h4 class="font-medium text-slate-200 capitalize">${provider}</h4>
                            <p class="text-xs text-slate-400">API Key Configuration</p>
                        </div>
                    </div>
                    <div class="flex items-center">
                        ${isConfigured 
                            ? `<div class="flex items-center gap-1 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded-full">
                                 <svg class="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 13l4 4L19 7"/>
                                 </svg>
                                 <span class="text-green-400 text-xs font-medium">Configured</span>
                               </div>` 
                            : `<div class="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-full">
                                 <svg class="w-3 h-3 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                                 </svg>
                                 <span class="text-yellow-400 text-xs font-medium">Not Set</span>
                               </div>`}
                    </div>
                </div>
                
                <div class="space-y-2">
                    <div class="relative">
                        <input type="password" 
                               id="${inputId}" 
                               class="w-full bg-slate-800/80 border border-slate-700/50 text-slate-100 rounded-md px-3 py-2 pr-10 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all"
                               value="${isConfigured ? '••••••••••••••••••••••••••••••••' : ''}" 
                               placeholder="Enter your API key..."
                               data-provider="${provider}">
                        ${isConfigured ? `
                            <button type="button" 
                                class="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 rounded transition-colors" 
                                id="${eyeId}" 
                                onclick="toggleApiKeyVisibility('${provider}')" 
                                title="Show/Hide API Key">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                </svg>
                            </button>
                        ` : ''}
                    </div>
                    
                    <div class="flex gap-2">
                        <button class="flex-1 px-3 py-2 bg-gradient-to-r from-yellow-600 to-orange-700 hover:from-yellow-700 hover:to-orange-800 text-white rounded-md transition-all duration-200 font-medium text-sm" onclick="saveAPIKey('${provider}')">
                            ${isConfigured ? 'Update API Key' : 'Save API Key'}
                        </button>
                        ${isConfigured ? `
                            <button class="px-3 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-md transition-all duration-200 font-medium text-sm" onclick="removeAPIKey('${provider}')" title="Remove API Key">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
            
            container.appendChild(div);
        });
    }

    function renderProviderSelect() {
        const select = document.getElementById('providerSelect');
        select.innerHTML = '';

        settings.allProviders?.forEach(provider => {
            const option = document.createElement('option');
            option.value = provider;
            const hasApiKey = settings.apiKeyStatus?.[provider] === true;
            const displayName = provider.charAt(0).toUpperCase() + provider.slice(1);
            option.textContent = hasApiKey ? displayName : `${displayName} (No API Key)`;
            option.selected = provider === settings.defaultProvider;
            select.appendChild(option);
        });

        select.addEventListener('change', (e) => {
            vscode.postMessage({
                type: 'setProvider',
                provider: e.target.value
            });
        });

        renderModelSelection();
        renderQuickModelSelect();
    }

    function renderModelSelection() {
        const container = document.getElementById('modelSelectionContainer');
        container.innerHTML = '';

        if (!settings.allProviders || !settings.providerModels) {
            return;
        }

        settings.allProviders.forEach(provider => {
            const isConfigured = settings.apiKeyStatus?.[provider] === true;
            if (!isConfigured) return; // Only show providers with API keys

            const div = document.createElement('div');
            div.className = 'bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 mb-3';

            const allModels = settings.providerModels[provider] || [];
            const baseModels = settings.allProviders ? Array.from(settings.allProviders).find(p => p === provider) ? 
                Array.from(new Set(allModels.filter(model => !settings.customModels?.[provider]?.includes(model)))) : [] : [];
            const customProviderModels = settings.customModels?.[provider] || [];
            const currentModel = settings.selectedModels?.[provider] || allModels[0] || 'Not selected';

            // Create model options with sections
            const baseModelOptions = baseModels.length > 0 ? 
                '<optgroup label="Official Models">' +
                baseModels.map(model => 
                    `<option value="${model}" ${model === currentModel ? 'selected' : ''} class="bg-slate-800 text-slate-100">${model}</option>`
                ).join('') +
                '</optgroup>' : '';
            
            const customModelOptions = customProviderModels.length > 0 ? 
                '<optgroup label="Custom Models">' +
                customProviderModels.map(model => 
                    `<option value="${model}" ${model === currentModel ? 'selected' : ''} class="bg-slate-800 text-slate-100">${model}</option>`
                ).join('') +
                '</optgroup>' : '';

            div.innerHTML = `
                <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-medium text-slate-300">${provider.charAt(0).toUpperCase() + provider.slice(1)}</span>
                    <span class="text-xs text-slate-400">${currentModel}</span>
                </div>
                <div class="space-y-2">
                    <label class="block text-xs font-medium text-slate-300">Model:</label>
                    <select class="model-select w-full bg-slate-800 border border-slate-600 text-slate-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all" data-provider="${provider}">
                        ${baseModelOptions}
                        ${customModelOptions}
                        <option value="custom" class="bg-slate-800 text-slate-100">+ Add Custom Model...</option>
                        ${customProviderModels.length > 0 ? '<option value="manage-custom" class="bg-slate-800 text-slate-100">🗑️ Manage Custom Models...</option>' : ''}
                    </select>
                </div>
                <div class="custom-model-input hidden space-y-2">
                    <label class="block text-xs font-medium text-slate-300">Custom Model Name:</label>
                    <div class="flex gap-2">
                        <input type="text" class="custom-model-name flex-1 bg-slate-800/80 border border-slate-700/50 text-slate-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all" placeholder="Enter model name..." />
                        <button class="set-custom-model px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-md transition-all duration-200 text-sm">Add</button>
                        <button class="cancel-custom-model px-3 py-2 text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 rounded-md transition-all duration-200 text-sm">Cancel</button>
                    </div>
                </div>
                <div class="manage-custom-models hidden space-y-2">
                    <label class="block text-xs font-medium text-slate-300">Custom Models:</label>
                    <div class="custom-models-list space-y-1">
                        ${customProviderModels.map(model => `
                            <div class="flex items-center justify-between p-2 bg-slate-800/60 rounded-md">
                                <span class="text-sm text-slate-200">${model}</span>
                                <button class="delete-custom-model text-red-400 hover:text-red-300 text-xs" data-model="${model}">Delete</button>
                            </div>
                        `).join('')}
                    </div>
                    <button class="close-manage-custom px-3 py-2 text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 rounded-md transition-all duration-200 text-sm">Done</button>
                </div>
            `;

            // Add event listener for model selection
            const modelSelect = div.querySelector('.model-select');
            const customModelInput = div.querySelector('.custom-model-input');
            const customModelName = div.querySelector('.custom-model-name');
            const setCustomButton = div.querySelector('.set-custom-model');
            const cancelCustomButton = div.querySelector('.cancel-custom-model');
            const manageCustomModels = div.querySelector('.manage-custom-models');
            const closeManageCustomButton = div.querySelector('.close-manage-custom');

            modelSelect.addEventListener('change', (e) => {
                if (e.target.value === 'custom') {
                    customModelInput.classList.remove('hidden');
                    manageCustomModels.classList.add('hidden');
                    customModelName.focus();
                } else if (e.target.value === 'manage-custom') {
                    manageCustomModels.classList.remove('hidden');
                    customModelInput.classList.add('hidden');
                    modelSelect.value = currentModel; // Reset selection
                } else {
                    customModelInput.classList.add('hidden');
                    manageCustomModels.classList.add('hidden');
                    vscode.postMessage({
                        type: 'setModel',
                        provider: provider,
                        model: e.target.value
                    });
                }
            });

            setCustomButton.addEventListener('click', () => {
                const customModel = customModelName.value.trim();
                if (customModel) {
                    vscode.postMessage({
                        type: 'setModel',
                        provider: provider,
                        model: customModel
                    });
                    customModelInput.classList.add('hidden');
                    customModelName.value = '';
                }
            });

            cancelCustomButton.addEventListener('click', () => {
                customModelInput.classList.add('hidden');
                customModelName.value = '';
                modelSelect.value = currentModel; // Reset to current selection
            });

            closeManageCustomButton.addEventListener('click', () => {
                manageCustomModels.classList.add('hidden');
            });

            // Handle delete custom model buttons
            div.querySelectorAll('.delete-custom-model').forEach(button => {
                button.addEventListener('click', () => {
                    const modelToDelete = button.dataset.model;
                    if (confirm(`Delete custom model "${modelToDelete}"?`)) {
                        vscode.postMessage({
                            type: 'deleteCustomModel',
                            provider: provider,
                            model: modelToDelete
                        });
                    }
                });
            });

            customModelName.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    setCustomButton.click();
                }
            });

            container.appendChild(div);
        });
    }

    function renderQuickModelSelect() {
        const select = document.getElementById('quickModelSelect');
        select.innerHTML = '<option value="">Select Model...</option>';

        // Find the best provider to show - either default if it has API key, or first available
        let activeProvider = null;
        
        if (settings.defaultProvider && settings.apiKeyStatus?.[settings.defaultProvider]) {
            activeProvider = settings.defaultProvider;
        } else if (settings.availableProviders && settings.availableProviders.length > 0) {
            activeProvider = settings.availableProviders[0];
        }

        if (!activeProvider || !settings.providerModels) {
            return;
        }

        const allModels = settings.providerModels[activeProvider] || [];
        const currentModel = settings.selectedModels?.[activeProvider];
        const customProviderModels = settings.customModels?.[activeProvider] || [];

        // Add all models (predefined + custom)
        allModels.forEach(model => {
            const option = document.createElement('option');
            option.value = `${activeProvider}:${model}`;
            const isCustom = customProviderModels.includes(model);
            option.textContent = `${activeProvider}: ${model}${isCustom ? ' (custom)' : ''}`;
            option.selected = model === currentModel;
            select.appendChild(option);
        });

        // Add option to enter custom model
        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = '+ Custom Model...';
        select.appendChild(customOption);

        select.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                // Reset the select and show settings to add custom model
                e.target.value = '';
                vscode.postMessage({ type: 'showSettings' });
                setTimeout(() => renderQuickModelSelect(), 100);
            } else if (e.target.value) {
                const [providerName, modelName] = e.target.value.split(':');
                vscode.postMessage({
                    type: 'setModel',
                    provider: providerName,
                    model: modelName
                });
            }
        });
    }

    function renderSessionList(data) {
        const container = document.getElementById('sessionsList');
        container.innerHTML = '';

        if (!data.sessions || data.sessions.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-400 py-8">No chat history yet</p>';
            return;
        }

        data.sessions.forEach(session => {
            const div = document.createElement('div');
            div.className = `bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 cursor-pointer hover:bg-slate-800/80 hover:border-slate-600/50 transition-all duration-200 ${session.id === data.currentSessionId ? 'ring-2 ring-blue-500/50 bg-slate-800/80' : ''}`;
            
            const lastUpdate = new Date(session.lastUpdated).toLocaleDateString();
            const messageCount = session.messages.length;
            
            div.innerHTML = `
                <div class="flex items-start justify-between mb-3">
                    <div class="flex items-start gap-3 flex-1 min-w-0">
                        <div class="w-8 h-8 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg flex items-center justify-center mt-0.5 flex-shrink-0">
                            <svg class="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                            </svg>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="font-medium text-slate-200 truncate mb-1">${session.title}</div>
                            <div class="flex items-center gap-3 text-xs text-slate-400">
                                <div class="flex items-center gap-1">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                                    </svg>
                                    <span>${messageCount} ${messageCount === 1 ? 'message' : 'messages'}</span>
                                </div>
                                <div class="flex items-center gap-1">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                    <span>${lastUpdate}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button class="flex items-center justify-center w-8 h-8 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200 flex-shrink-0 ml-2" onclick="deleteSession('${session.id}')" title="Delete session">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </button>
                </div>
            `;

            div.addEventListener('click', (e) => {
                if (!e.target.classList.contains('delete-session') && !e.target.textContent.includes('🗑️')) {
                    vscode.postMessage({
                        type: 'loadSession',
                        sessionId: session.id
                    });
                    hideHistory();
                }
            });

            container.appendChild(div);
        });
    }

    // Global function for session deletion
    window.deleteSession = function(sessionId) {
        if (confirm('Are you sure you want to delete this chat session?')) {
            vscode.postMessage({
                type: 'deleteSession',
                sessionId: sessionId
            });
        }
    };

    // Global agentic functions
    window.copyCode = function(codeId) {
        const codeElement = document.querySelector(`[data-code-id="${codeId}"] code`);
        if (codeElement) {
            const code = codeElement.textContent;
            navigator.clipboard.writeText(code).then(() => {
                showNotification('Code copied to clipboard!', 'success');
            }).catch(() => {
                showNotification('Failed to copy code', 'error');
            });
        }
    };

    window.applyCode = function(codeId, code, language) {
        // First, get the current active editor file
        vscode.postMessage({
            type: 'getActiveFile'
        });
        
        // Store the code to apply for when we get the response
        window.pendingCodeApplication = {
            code: code,
            language: language,
            action: 'apply'
        };
    };

    window.createFile = function(codeId, code, language) {
        // Suggest a filename based on the language
        const extensions = {
            'javascript': 'js',
            'typescript': 'ts',
            'python': 'py',
            'java': 'java',
            'cpp': 'cpp',
            'c': 'c',
            'html': 'html',
            'css': 'css',
            'json': 'json',
            'xml': 'xml',
            'sql': 'sql',
            'shell': 'sh',
            'bash': 'sh',
            'powershell': 'ps1'
        };
        
        const ext = extensions[language] || 'txt';
        const defaultName = `new_file.${ext}`;
        
        const fileName = prompt(`Enter filename for the new file:`, defaultName);
        if (fileName && fileName.trim()) {
            vscode.postMessage({
                type: 'createNewFile',
                fileName: fileName.trim(),
                content: code,
                language: language
            });
        }
    };

    function handleActiveFileInfo(fileInfo) {
        if (window.pendingCodeApplication) {
            const { code, language, action } = window.pendingCodeApplication;
            
            if (action === 'apply' && fileInfo.filePath) {
                // Show confirmation dialog with file info
                const confirmMessage = `Apply code to file: ${fileInfo.fileName}?\n\nThis will replace the current content.`;
                
                if (confirm(confirmMessage)) {
                    vscode.postMessage({
                        type: 'applyCodeToFile',
                        filePath: fileInfo.filePath,
                        content: code,
                        language: language
                    });
                }
            } else if (action === 'apply' && !fileInfo.filePath) {
                // No active file, create new one
                const fileName = prompt('No active file. Enter filename to create new file:', 'new_file.txt');
                if (fileName && fileName.trim()) {
                    vscode.postMessage({
                        type: 'createNewFile',
                        fileName: fileName.trim(),
                        content: code,
                        language: language
                    });
                }
            }
            
            window.pendingCodeApplication = null;
        }
        
        // Handle new pendingApplyCode
        if (window.pendingApplyCode) {
            const { code, language, codeId } = window.pendingApplyCode;
            const container = document.querySelector(`[data-code-id="${codeId}"]`);
            
            if (fileInfo.filePath) {
                // Show confirmation dialog with file info
                const confirmMessage = `Apply code to file: ${fileInfo.fileName}?\n\nThis will replace the current content.`;
                
                if (confirm(confirmMessage)) {
                    vscode.postMessage({
                        type: 'applyCodeToFile',
                        filePath: fileInfo.filePath,
                        content: code
                    });
                    showCodeActionFeedback(container?.querySelector('.apply-btn'), `Applied to ${fileInfo.fileName}`, 'success');
                } else {
                    showCodeActionFeedback(container?.querySelector('.apply-btn'), 'Cancelled', 'error');
                }
            } else {
                // No active file, ask to create new one
                const fileName = prompt('No active file. Enter filename to create new file:', extractFileName(code, language) || `new_file.${getFileExtension(language)}`);
                if (fileName && fileName.trim()) {
                    vscode.postMessage({
                        type: 'createNewFile',
                        fileName: fileName.trim(),
                        content: code,
                        language: language
                    });
                    showCodeActionFeedback(container?.querySelector('.apply-btn'), `Created ${fileName.trim()}`, 'success');
                } else {
                    showCodeActionFeedback(container?.querySelector('.apply-btn'), 'Cancelled', 'error');
                }
            }
            
            window.pendingApplyCode = null;
        }
    }

    function getFileExtension(language) {
        const extensions = {
            'javascript': 'js',
            'typescript': 'ts',
            'python': 'py',
            'java': 'java',
            'cpp': 'cpp',
            'c': 'c',
            'html': 'html',
            'css': 'css',
            'json': 'json',
            'sql': 'sql',
            'bash': 'sh',
            'yaml': 'yml',
            'markdown': 'md',
            'php': 'php',
            'ruby': 'rb',
            'go': 'go',
            'rust': 'rs',
            'swift': 'swift'
        };
        return extensions[language] || 'txt';
    }

    function renderMCPServers() {
        const container = document.getElementById('mcpServersContainer');
        container.innerHTML = '';

        settings.mcpServers?.forEach(server => {
            const div = document.createElement('div');
            div.className = 'mcp-server';
            
            const status = settings.mcpStatus?.[server.name] || 'disconnected';
            
            div.innerHTML = `
                <div class="mcp-server-header">
                    <span class="mcp-server-name">${server.name}</span>
                    <span class="mcp-server-status ${status}">${status}</span>
                </div>
                <div style="font-size: 12px; opacity: 0.8;">
                    Command: ${server.command}<br>
                    Args: ${Array.isArray(server.args) ? server.args.join(', ') : (server.args || 'none')}
                </div>
            `;
            
            container.appendChild(div);
        });
    }

    function renderMCPTools() {
        const container = document.getElementById('mcpToolsContainer');
        container.innerHTML = '';

        if (!settings.mcpTools || settings.mcpTools.length === 0) {
            container.innerHTML = '<p style="opacity: 0.6; font-style: italic;">No MCP tools available</p>';
            return;
        }

        settings.mcpTools.forEach(tool => {
            const div = document.createElement('div');
            div.className = 'mcp-tool';
            
            div.innerHTML = `
                <div class="mcp-tool-name">${tool.name}</div>
                <div class="mcp-tool-desc">${tool.description}</div>
            `;
            
            div.addEventListener('click', () => {
                const args = prompt(`Enter arguments for ${tool.name} (JSON format):`);
                if (args) {
                    try {
                        const parsedArgs = JSON.parse(args);
                        vscode.postMessage({
                            type: 'callMCPTool',
                            tool: tool.name,
                            args: parsedArgs
                        });
                    } catch (e) {
                        showNotification('Invalid JSON format', 'error');
                    }
                }
            });
            
            container.appendChild(div);
        });
    }

    // Global functions for inline event handlers
    window.saveAPIKey = function(provider) {
        const input = document.getElementById(`apiKey_${provider}`);
        const apiKey = input.value.trim();
        
        if (!apiKey || apiKey.startsWith('••••')) {
            showNotification('Please enter a valid API key', 'error');
            return;
        }

        vscode.postMessage({
            type: 'saveApiKey',
            provider: provider,
            apiKey: apiKey
        });
    };

    window.removeAPIKey = function(provider) {
        vscode.postMessage({
            type: 'confirmRemoveApiKey',
            provider: provider
        });
    };

    window.toggleApiKeyVisibility = function(provider) {
        const input = document.getElementById(`apiKey_${provider}`);
        const eyeBtn = document.getElementById(`eyeToggle_${provider}`);
        
        if (input.type === 'password') {
            // Show the actual value (user needs to enter it to see it)
            const newKey = prompt(`Enter your ${provider} API key to view it:`, '');
            if (newKey && newKey.trim()) {
                input.type = 'text';
                input.value = newKey;
                eyeBtn.textContent = '🙈';
                eyeBtn.title = 'Hide API Key';
            }
        } else {
            // Hide it again
            input.type = 'password';
            input.value = '••••••••••••••••••••';
            eyeBtn.textContent = '👁️';
            eyeBtn.title = 'Show API Key';
        }
    };

    function showNotification(message, type = 'success') {
        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cursor = 'pointer';
        notification.title = 'Click to dismiss';
        
        document.body.appendChild(notification);

        // Auto remove after 3 seconds
        const timeout = setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
        
        // Allow manual dismiss by clicking
        notification.addEventListener('click', () => {
            clearTimeout(timeout);
            if (notification.parentNode) {
                notification.remove();
            }
        });
    }

    // Initialize the application when DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
