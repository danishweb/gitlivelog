export interface AIModelConfig {
    name: string;
    provider: 'gemini' | 'openai-compatible' | 'openai';
    apiKey?: string;
    baseURL?: string;  // Base URL for API calls
    contextWindow: number;  // Maximum context window size
    maxOutputTokens: number;
    costPer1kTokens: number;  // Cost in USD per 1000 tokens
}

export const AVAILABLE_MODELS: { [key: string]: AIModelConfig } = {
    'gemini-pro': {
        name: 'gemini-pro',
        provider: 'gemini',
        contextWindow: 30720,
        maxOutputTokens: 2048,
        costPer1kTokens: 0.00025  // $0.00025 per 1k tokens
    },
    'gpt-3.5-turbo': {
        name: 'gpt-3.5-turbo',
        provider: 'openai',
        contextWindow: 4096,
        maxOutputTokens: 500,
        costPer1kTokens: 0.0015  // $0.0015 per 1k tokens
    },
    'gpt-4': {
        name: 'gpt-4',
        provider: 'openai',
        contextWindow: 8192,
        maxOutputTokens: 1000,
        costPer1kTokens: 0.03  // $0.03 per 1k tokens
    },
    'deepseek-chat': {
        name: 'deepseek-chat',
        provider: 'openai-compatible',
        baseURL: 'https://api.deepseek.com',
        contextWindow: 8192,
        maxOutputTokens: 1000,
        costPer1kTokens: 0.002  // Example cost, adjust as needed
    }
    // Add more models here
};
