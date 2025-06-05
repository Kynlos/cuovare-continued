import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Advanced Context Filtering System
 * Provides intelligent context selection and prioritization for optimal AI performance
 */

export interface ContextFile {
    path: string;
    content: string;
    score: number;
    size: number;
    lastModified: Date;
    language: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    reasons: string[];
}

export interface FilterCriteria {
    maxFiles: number;
    maxTokens: number;
    priorityThreshold: number;
    recencyWeight: number;
    relevanceWeight: number;
    sizeWeight: number;
    languagePreferences: string[];
    excludePatterns: string[];
    includePatterns: string[];
}

export interface FilterResult {
    selectedFiles: ContextFile[];
    filteredFiles: ContextFile[];
    totalFiles: number;
    totalTokens: number;
    efficiency: number;
    reasoning: string[];
}

export class AdvancedContextFilter {
    private static readonly DEFAULT_CRITERIA: FilterCriteria = {
        maxFiles: 25,
        maxTokens: 12000,
        priorityThreshold: 0.3,
        recencyWeight: 0.2,
        relevanceWeight: 0.5,
        sizeWeight: 0.3,
        languagePreferences: ['typescript', 'javascript', 'python', 'java'],
        excludePatterns: ['node_modules', '.git', 'dist', 'build', '.vscode'],
        includePatterns: ['src', 'lib', 'components', 'utils', 'services']
    };

    /**
     * Apply advanced filtering to context files
     */
    public static async filterContext(
        files: ContextFile[],
        query: string,
        criteria: Partial<FilterCriteria> = {}
    ): Promise<FilterResult> {
        const fullCriteria = { ...this.DEFAULT_CRITERIA, ...criteria };
        const reasoning: string[] = [];

        // Step 1: Initial filtering based on patterns
        let filteredFiles = this.applyPatternFiltering(files, fullCriteria);
        reasoning.push(`Pattern filtering: ${files.length} → ${filteredFiles.length} files`);

        // Step 2: Query-specific relevance scoring
        filteredFiles = await this.scoreRelevance(filteredFiles, query);
        reasoning.push(`Relevance scoring applied to ${filteredFiles.length} files`);

        // Step 3: Priority-based filtering
        filteredFiles = this.applyPriorityFiltering(filteredFiles, fullCriteria);
        reasoning.push(`Priority filtering: threshold ${fullCriteria.priorityThreshold}`);

        // Step 4: Smart selection algorithm
        const selectedFiles = this.selectOptimalFiles(filteredFiles, fullCriteria);
        reasoning.push(`Selected ${selectedFiles.length} optimal files`);

        // Step 5: Calculate metrics
        const totalTokens = this.calculateTokens(selectedFiles);
        const efficiency = this.calculateEfficiency(selectedFiles, files);

        reasoning.push(`Token usage: ${totalTokens}/${fullCriteria.maxTokens} (${Math.round(efficiency * 100)}% efficiency)`);

        return {
            selectedFiles,
            filteredFiles: filteredFiles.filter(f => !selectedFiles.includes(f)),
            totalFiles: files.length,
            totalTokens,
            efficiency,
            reasoning
        };
    }

    /**
     * Apply include/exclude pattern filtering
     */
    private static applyPatternFiltering(files: ContextFile[], criteria: FilterCriteria): ContextFile[] {
        return files.filter(file => {
            const relativePath = file.path;

            // Check exclude patterns
            for (const pattern of criteria.excludePatterns) {
                if (relativePath.includes(pattern)) {
                    return false;
                }
            }

            // Check include patterns (if any specified)
            if (criteria.includePatterns.length > 0) {
                const matchesInclude = criteria.includePatterns.some(pattern => 
                    relativePath.includes(pattern)
                );
                if (!matchesInclude) {
                    return false;
                }
            }

            return true;
        });
    }

    /**
     * Score files based on query relevance
     */
    private static async scoreRelevance(files: ContextFile[], query: string): Promise<ContextFile[]> {
        const queryTerms = this.extractQueryTerms(query);
        
        return files.map(file => {
            let relevanceScore = 0;
            const reasons: string[] = [];

            // Content relevance
            const contentScore = this.calculateContentRelevance(file.content, queryTerms);
            relevanceScore += contentScore * 0.4;
            if (contentScore > 0.5) {
                reasons.push('High content relevance');
            }

            // Path relevance
            const pathScore = this.calculatePathRelevance(file.path, queryTerms);
            relevanceScore += pathScore * 0.3;
            if (pathScore > 0.5) {
                reasons.push('Relevant file path');
            }

            // Language preference
            const langScore = this.calculateLanguageScore(file.language);
            relevanceScore += langScore * 0.3;
            if (langScore > 0.7) {
                reasons.push('Preferred language');
            }

            // Update file score and reasons
            file.score = Math.max(file.score, relevanceScore);
            file.reasons = [...file.reasons, ...reasons];

            return file;
        });
    }

    /**
     * Extract meaningful terms from query
     */
    private static extractQueryTerms(query: string): string[] {
        const terms = query.toLowerCase()
            .split(/\s+/)
            .filter(term => term.length > 2)
            .filter(term => !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'].includes(term));
        
        return [...new Set(terms)];
    }

    /**
     * Calculate content relevance score
     */
    private static calculateContentRelevance(content: string, queryTerms: string[]): number {
        if (queryTerms.length === 0) return 0.5;

        const contentLower = content.toLowerCase();
        let matches = 0;
        let totalOccurrences = 0;

        for (const term of queryTerms) {
            const occurrences = (contentLower.match(new RegExp(term, 'g')) || []).length;
            if (occurrences > 0) {
                matches++;
                totalOccurrences += occurrences;
            }
        }

        const termCoverage = matches / queryTerms.length;
        const density = Math.min(totalOccurrences / (content.length / 1000), 1);

        return (termCoverage * 0.7) + (density * 0.3);
    }

    /**
     * Calculate path relevance score
     */
    private static calculatePathRelevance(filePath: string, queryTerms: string[]): number {
        if (queryTerms.length === 0) return 0.5;

        const pathLower = filePath.toLowerCase();
        let matches = 0;

        for (const term of queryTerms) {
            if (pathLower.includes(term)) {
                matches++;
            }
        }

        return matches / queryTerms.length;
    }

    /**
     * Calculate language preference score
     */
    private static calculateLanguageScore(language: string): number {
        const preferredLanguages = ['typescript', 'javascript', 'python', 'java', 'tsx', 'jsx'];
        
        if (preferredLanguages.includes(language.toLowerCase())) {
            return 1.0;
        }
        
        if (['html', 'css', 'scss', 'json', 'yaml', 'xml'].includes(language.toLowerCase())) {
            return 0.7;
        }
        
        return 0.5;
    }

    /**
     * Apply priority-based filtering
     */
    private static applyPriorityFiltering(files: ContextFile[], criteria: FilterCriteria): ContextFile[] {
        return files.filter(file => file.score >= criteria.priorityThreshold);
    }

    /**
     * Select optimal files using weighted scoring
     */
    private static selectOptimalFiles(files: ContextFile[], criteria: FilterCriteria): ContextFile[] {
        // Calculate composite scores
        const scoredFiles = files.map(file => {
            const recencyScore = this.calculateRecencyScore(file.lastModified);
            const sizeScore = this.calculateSizeScore(file.size);
            
            const compositeScore = 
                (file.score * criteria.relevanceWeight) +
                (recencyScore * criteria.recencyWeight) +
                (sizeScore * criteria.sizeWeight);

            return { ...file, compositeScore };
        });

        // Sort by composite score
        scoredFiles.sort((a, b) => b.compositeScore - a.compositeScore);

        // Select files within constraints
        const selectedFiles: ContextFile[] = [];
        let totalTokens = 0;

        for (const file of scoredFiles) {
            if (selectedFiles.length >= criteria.maxFiles) break;

            const fileTokens = this.estimateTokens(file.content);
            if (totalTokens + fileTokens > criteria.maxTokens) break;

            selectedFiles.push(file);
            totalTokens += fileTokens;
        }

        return selectedFiles;
    }

    /**
     * Calculate recency score (newer = higher)
     */
    private static calculateRecencyScore(lastModified: Date): number {
        const now = new Date();
        const hoursSinceModified = (now.getTime() - lastModified.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceModified < 1) return 1.0;
        if (hoursSinceModified < 24) return 0.8;
        if (hoursSinceModified < 168) return 0.6; // 1 week
        if (hoursSinceModified < 720) return 0.4; // 1 month
        
        return 0.2;
    }

    /**
     * Calculate size score (moderate size = higher)
     */
    private static calculateSizeScore(size: number): number {
        // Optimal file size range: 1KB - 50KB
        if (size < 1000) return 0.6; // Too small
        if (size < 50000) return 1.0; // Optimal
        if (size < 100000) return 0.8; // Large but manageable
        if (size < 500000) return 0.4; // Very large
        
        return 0.2; // Extremely large
    }

    /**
     * Estimate token count for content
     */
    private static estimateTokens(content: string): number {
        // Rough estimation: 1 token ≈ 4 characters
        return Math.ceil(content.length / 4);
    }

    /**
     * Calculate total tokens for selected files
     */
    private static calculateTokens(files: ContextFile[]): number {
        return files.reduce((total, file) => total + this.estimateTokens(file.content), 0);
    }

    /**
     * Calculate filtering efficiency
     */
    private static calculateEfficiency(selectedFiles: ContextFile[], allFiles: ContextFile[]): number {
        if (allFiles.length === 0) return 1.0;

        const avgScore = selectedFiles.reduce((sum, file) => sum + file.score, 0) / selectedFiles.length;
        const selectionRatio = selectedFiles.length / allFiles.length;
        
        // Efficiency = high average score with reasonable selection ratio
        return Math.min(avgScore + (1 - selectionRatio) * 0.3, 1.0);
    }

    /**
     * Create context filtering criteria for specific scenarios
     */
    public static createScenarioCriteria(scenario: 'debugging' | 'review' | 'learning' | 'implementation'): FilterCriteria {
        const base = this.DEFAULT_CRITERIA;

        switch (scenario) {
            case 'debugging':
                return {
                    ...base,
                    maxFiles: 15,
                    maxTokens: 8000,
                    priorityThreshold: 0.4,
                    recencyWeight: 0.4,
                    relevanceWeight: 0.6,
                    includePatterns: ['src', 'lib', 'components', 'test']
                };

            case 'review':
                return {
                    ...base,
                    maxFiles: 30,
                    maxTokens: 15000,
                    priorityThreshold: 0.2,
                    recencyWeight: 0.3,
                    relevanceWeight: 0.4,
                    sizeWeight: 0.3
                };

            case 'learning':
                return {
                    ...base,
                    maxFiles: 20,
                    maxTokens: 10000,
                    priorityThreshold: 0.3,
                    languagePreferences: ['typescript', 'javascript', 'python'],
                    includePatterns: ['src', 'examples', 'docs']
                };

            case 'implementation':
                return {
                    ...base,
                    maxFiles: 25,
                    maxTokens: 12000,
                    priorityThreshold: 0.35,
                    relevanceWeight: 0.6,
                    includePatterns: ['src', 'lib', 'components', 'utils']
                };

            default:
                return base;
        }
    }

    /**
     * Get filtering statistics
     */
    public static getFilteringStats(result: FilterResult): {
        efficiency: string;
        tokenUsage: string;
        fileReduction: string;
        topReasons: string[];
    } {
        const tokenUsage = `${result.totalTokens} tokens (${Math.round(result.efficiency * 100)}% efficiency)`;
        const fileReduction = `${result.selectedFiles.length}/${result.totalFiles} files selected`;
        
        // Get top reasons for file selection
        const reasonCounts = new Map<string, number>();
        result.selectedFiles.forEach(file => {
            file.reasons.forEach(reason => {
                reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
            });
        });

        const topReasons = Array.from(reasonCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([reason, count]) => `${reason} (${count} files)`);

        return {
            efficiency: `${Math.round(result.efficiency * 100)}%`,
            tokenUsage,
            fileReduction,
            topReasons
        };
    }
}
