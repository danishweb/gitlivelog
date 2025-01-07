import * as vscode from 'vscode';
import { IAIService } from './interfaces/IAIService';
import { AVAILABLE_MODELS, AIModelConfig } from './interfaces/AIModels';
import { OpenAICompatibleService } from './providers/OpenAICompatibleService';
import { GeminiService } from './providers/GeminiService';

export class AIModelFactory {
    private static instance: AIModelFactory;
    private currentModel?: IAIService;
    private lastModelName?: string;

    private constructor() {}

    public static getInstance(): AIModelFactory {
        if (!AIModelFactory.instance) {
            AIModelFactory.instance = new AIModelFactory();
        }
        return AIModelFactory.instance;
    }

    public getCurrentModel(): IAIService {
        const config = vscode.workspace.getConfiguration('gitlivelog.ai');
        const modelName = config.get<string>('model', 'gemini-pro');
        const apiKey = config.get<string>('apiKey', '');

        console.log(`AI Model: ${modelName}`);

        // If model hasn't changed and we have an instance, return it
        if (this.currentModel && this.lastModelName === modelName) {
            return this.currentModel;
        }

        const modelConfig = AVAILABLE_MODELS[modelName];
        if (!modelConfig) {
            throw new Error(`Unknown model: ${modelName}`);
        } 

        if (modelConfig.baseURL) {
            console.log(`Cus API endpoint: ${modelConfig.baseURL}`);
        }

        // Update model config with API key
        const fullConfig = {
            ...modelConfig,
            apiKey
        };

        this.lastModelName = modelName;
        this.currentModel = this.createModel(fullConfig);
        return this.currentModel;
    }

    private createModel(config: AIModelConfig): IAIService {
        switch (config.provider) {
            case 'gemini':
                return new GeminiService(config);
            case 'openai':
            case 'openai-compatible':
                return new OpenAICompatibleService(config);
            default:
                throw new Error(`Unsupported provider: ${config.provider}`);
        }
    }

    public async validateCurrentModel(): Promise<boolean> {
        const model = this.getCurrentModel();
        return await model.validateApiKey();
    }

    public getAvailableModels(): AIModelConfig[] {
        return Object.values(AVAILABLE_MODELS);
    }

    public getModelInfo(modelName: string): AIModelConfig | undefined {
        return AVAILABLE_MODELS[modelName];
    }
}
