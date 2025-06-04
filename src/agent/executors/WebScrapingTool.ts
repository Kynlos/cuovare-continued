import { ToolExecutor, ToolResult } from '../ToolRegistry';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

export class WebScrapingTool implements ToolExecutor {
    readonly name = 'webscraping';
    readonly description = 'Scrape web content from URLs mentioned in user prompts for context enhancement';
    
    readonly metadata = {
        name: 'webscraping',
        description: 'Scrape web content from URLs mentioned in user prompts for context enhancement',
        category: 'Web Scraping',
        parameters: [
            {
                name: 'action',
                description: 'Web scraping action to perform',
                required: true,
                type: 'string'
            }
        ],
        examples: [
            'Scrape web content',
            'Extract documentation',
            'Monitor websites'
        ]
    };

    readonly methods = {
        'scrapeUrl': {
            description: 'Scrape content from a URL, filtering out page-building code while preserving documentation code',
            parameters: {
                url: { type: 'string', description: 'URL to scrape content from' },
                maxLength: { type: 'number', description: 'Maximum characters to return (default: 5000)', optional: true },
                includeCodeExamples: { type: 'boolean', description: 'Whether to include code examples from documentation (default: true)', optional: true }
            }
        },
        'extractUrls': {
            description: 'Extract URLs from user prompt text',
            parameters: {
                text: { type: 'string', description: 'Text to extract URLs from' }
            }
        },
        'scrapeMultiple': {
            description: 'Scrape multiple URLs and combine content for context',
            parameters: {
                urls: { type: 'array', description: 'Array of URLs to scrape' },
                maxTotalLength: { type: 'number', description: 'Maximum total characters across all URLs (default: 5000)', optional: true }
            }
        }
    };

    private readonly allowedDomains = [
        // Documentation sites
        'docs.microsoft.com',
        'developer.mozilla.org',
        'stackoverflow.com',
        'github.com',
        'npmjs.com',
        'nodejs.org',
        'reactjs.org',
        'vuejs.org',
        'angular.io',
        'typescript.org',
        'python.org',
        'docs.python.org',
        'go.dev',
        'rust-lang.org',
        'java.com',
        'oracle.com/java',
        'spring.io',
        'docker.com',
        'kubernetes.io',
        'aws.amazon.com',
        'cloud.google.com',
        'azure.microsoft.com',
        'firebase.google.com',
        'vercel.com',
        'netlify.com',
        'heroku.com',
        'digitalocean.com',
        // Code repositories and examples
        'gitlab.com',
        'bitbucket.org',
        'codepen.io',
        'jsfiddle.net',
        'replit.com',
        // Learning resources
        'w3schools.com',
        'freecodecamp.org',
        'codecademy.com',
        'udemy.com',
        'coursera.org',
        'edx.org',
        // Package managers and registries
        'pypi.org',
        'crates.io',
        'packagist.org',
        'rubygems.org',
        'nuget.org'
    ];

    async execute(method: string, args: Record<string, any>): Promise<ToolResult> {
        try {
            switch (method) {
                case 'scrapeUrl':
                    return await this.scrapeUrl(args.url, args.maxLength, args.includeCodeExamples);
                case 'extractUrls':
                    return await this.extractUrls(args.text);
                case 'scrapeMultiple':
                    return await this.scrapeMultiple(args.urls, args.maxTotalLength);
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

    private async scrapeUrl(url: string, maxLength: number = 5000, includeCodeExamples: boolean = true): Promise<ToolResult> {
        try {
            // Validate URL
            const parsedUrl = new URL(url);
            
            // Check if domain is allowed
            if (!this.isDomainAllowed(parsedUrl.hostname)) {
                return {
                    success: false,
                    error: `Domain ${parsedUrl.hostname} is not in the allowed list for scraping`
                };
            }

            // Fetch content
            const htmlContent = await this.fetchUrl(url);
            
            // Clean and extract content
            const cleanedContent = this.cleanHtmlContent(htmlContent, includeCodeExamples);
            
            // Truncate to max length
            const truncatedContent = cleanedContent.length > maxLength 
                ? cleanedContent.substring(0, maxLength) + '...[truncated]'
                : cleanedContent;

            return {
                success: true,
                result: JSON.stringify({
                    url,
                    domain: parsedUrl.hostname,
                    contentLength: cleanedContent.length,
                    truncatedLength: truncatedContent.length,
                    content: truncatedContent,
                    timestamp: new Date().toISOString()
                }, null, 2)
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to scrape URL: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async extractUrls(text: string): Promise<ToolResult> {
        try {
            // Enhanced URL regex that captures various URL formats
            const urlRegex = /https?:\/\/(?:[-\w.])+(?:[:\d]+)?(?:\/(?:[\w\/_.])*)?(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?/gi;
            const urls = text.match(urlRegex) || [];
            
            // Filter for allowed domains
            const allowedUrls = urls.filter(url => {
                try {
                    const parsedUrl = new URL(url);
                    return this.isDomainAllowed(parsedUrl.hostname);
                } catch {
                    return false;
                }
            });

            // Remove duplicates
            const uniqueUrls = [...new Set(allowedUrls)];

            return {
                success: true,
                result: JSON.stringify({
                    totalUrls: urls.length,
                    allowedUrls: uniqueUrls.length,
                    urls: uniqueUrls,
                    blocked: urls.filter(url => !uniqueUrls.includes(url))
                }, null, 2)
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to extract URLs: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async scrapeMultiple(urls: string[], maxTotalLength: number = 5000): Promise<ToolResult> {
        try {
            const results = [];
            let totalLength = 0;
            const maxPerUrl = Math.floor(maxTotalLength / urls.length);

            for (const url of urls) {
                if (totalLength >= maxTotalLength) break;

                const result = await this.scrapeUrl(url, maxPerUrl, true);
                if (result.success && result.result) {
                    const data = JSON.parse(result.result);
                    results.push({
                        url: data.url,
                        domain: data.domain,
                        contentLength: data.contentLength,
                        content: data.content
                    });
                    totalLength += data.content.length;
                }
            }

            return {
                success: true,
                result: JSON.stringify({
                    scrapedCount: results.length,
                    totalLength,
                    maxTotalLength,
                    results
                }, null, 2)
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to scrape multiple URLs: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private isDomainAllowed(hostname: string): boolean {
        return this.allowedDomains.some(domain => 
            hostname === domain || hostname.endsWith('.' + domain)
        );
    }

    private async fetchUrl(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const client = parsedUrl.protocol === 'https:' ? https : http;
            
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'Cuovare-Agent/1.0 (VS Code Extension)',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'identity',
                    'Connection': 'close'
                },
                timeout: 10000 // 10 second timeout
            };

            const req = client.request(options, (res) => {
                let data = '';

                // Check content type
                const contentType = res.headers['content-type'] || '';
                if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
                    reject(new Error('Content type not supported for scraping'));
                    return;
                }

                res.on('data', (chunk) => {
                    data += chunk;
                    // Prevent excessive memory usage
                    if (data.length > 1000000) { // 1MB limit
                        req.destroy();
                        reject(new Error('Content too large'));
                    }
                });

                res.on('end', () => {
                    resolve(data);
                });
            });

            req.on('error', (err) => {
                reject(err);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }

    private cleanHtmlContent(html: string, includeCodeExamples: boolean): string {
        try {
            // Remove script tags and their content
            let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            
            // Remove style tags and their content
            cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
            
            // Remove HTML comments
            cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
            
            // Remove navigation elements
            cleaned = cleaned.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, '');
            cleaned = cleaned.replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, '');
            cleaned = cleaned.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, '');
            
            // Remove sidebar and menu elements
            cleaned = cleaned.replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, '');
            cleaned = cleaned.replace(/<div[^>]*class="[^"]*(?:sidebar|menu|nav)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
            
            // Preserve code blocks if includeCodeExamples is true
            let codeBlocks: string[] = [];
            if (includeCodeExamples) {
                // Extract and preserve code blocks
                const codeRegex = /<(?:pre|code)\b[^>]*>[\s\S]*?<\/(?:pre|code)>/gi;
                const matches = cleaned.match(codeRegex);
                if (matches) {
                    codeBlocks = matches;
                    matches.forEach((match, index) => {
                        cleaned = cleaned.replace(match, `__CODE_BLOCK_${index}__`);
                    });
                }
            }
            
            // Remove all remaining HTML tags
            cleaned = cleaned.replace(/<[^>]*>/g, '');
            
            // Restore code blocks
            if (includeCodeExamples) {
                codeBlocks.forEach((codeBlock, index) => {
                    // Clean the code block of HTML tags but preserve the content
                    const cleanCode = codeBlock.replace(/<[^>]*>/g, '');
                    cleaned = cleaned.replace(`__CODE_BLOCK_${index}__`, `\n[CODE EXAMPLE]\n${cleanCode}\n[/CODE EXAMPLE]\n`);
                });
            }
            
            // Decode HTML entities
            cleaned = this.decodeHtmlEntities(cleaned);
            
            // Clean up whitespace
            cleaned = cleaned.replace(/\s+/g, ' ');
            cleaned = cleaned.replace(/\n\s*\n/g, '\n');
            cleaned = cleaned.trim();
            
            return cleaned;
        } catch (error) {
            // If cleaning fails, return a basic text extraction
            return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        }
    }

    private decodeHtmlEntities(text: string): string {
        const entities: Record<string, string> = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#39;': "'",
            '&apos;': "'",
            '&nbsp;': ' ',
            '&copy;': '©',
            '&reg;': '®',
            '&trade;': '™'
        };
        
        return text.replace(/&[a-zA-Z0-9#]+;/g, (entity) => {
            return entities[entity] || entity;
        });
    }
}
