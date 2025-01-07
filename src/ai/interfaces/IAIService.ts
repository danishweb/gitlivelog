export interface IAIService {
    validateApiKey(): Promise<boolean>;
    generateCommitMessage(diff: string): Promise<string>;
    getProviderName(): string;
    generatePrompt(diff: string): string;
    formatResponse(response: any): string;
}

export interface AIServiceConfig {
    apiKey?: string;
    model?: string;
    // Add other common configuration options here
}
