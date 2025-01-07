import * as vscode from 'vscode';
import { IAIService, AIServiceConfig } from './interfaces/IAIService';
import { GeminiService } from './providers/GeminiService';
import { OpenAIService } from './providers/OpenAIService';

export enum AIProvider {
    GEMINI = 'gemini',
    OPENAI = 'openai',
    // Add more providers here
}

export class AIServiceFactory {
    private static instance: AIServiceFactory;
    private currentProvider: AIProvider;
    private services: Map<AIProvider, IAIService> = new Map();

    private constructor() {
        this.currentProvider = this.getConfiguredProvider();
    }

    public static getInstance(): AIServiceFactory {
        if (!AIServiceFactory.instance) {
            AIServiceFactory.instance = new AIServiceFactory();
        }
        return AIServiceFactory.instance;
    }

    private getConfiguredProvider(): AIProvider {
        const config = vscode.workspace.getConfiguration('gitlivelog.ai');
        return config.get<AIProvider>('provider', AIProvider.GEMINI);
    }

    public getCurrentService(): IAIService {
        const provider = this.getConfiguredProvider();
        
        if (!this.services.has(provider)) {
            this.services.set(provider, this.createService(provider));
        }

        return this.services.get(provider)!;
    }

    private createService(provider: AIProvider): IAIService {
        const config = this.getServiceConfig(provider);

        switch (provider) {
            case AIProvider.GEMINI:
                return new GeminiService(config);
            case AIProvider.OPENAI:
                return new OpenAIService(config);
            default:
                throw new Error(`Unsupported AI provider: ${provider}`);
        }
    }

    private getServiceConfig(provider: AIProvider): AIServiceConfig {
        const config = vscode.workspace.getConfiguration('gitlivelog.ai');
        return {
            apiKey: config.get<string>(`${provider}ApiKey`),
            model: config.get<string>(`${provider}Model`)
        };
    }
}
