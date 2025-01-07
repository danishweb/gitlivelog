import * as vscode from 'vscode';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { IAIService, AIServiceConfig } from '../interfaces/IAIService';

export class GeminiService implements IAIService {
    private readonly MODEL_NAME = 'gemini-pro';
    private genAI?: GoogleGenerativeAI;
    private model?: any;

    constructor(private config: AIServiceConfig) {
        if (config.apiKey) {
            this.initializeModel();
        }
    }

    private initializeModel(): void {
        if (this.config.apiKey) {
            this.genAI = new GoogleGenerativeAI(this.config.apiKey);
            this.model = this.genAI.getGenerativeModel({ model: this.config.model || this.MODEL_NAME });
        }
    }

    public getProviderName(): string {
        return 'Google Gemini';
    }

    public generatePrompt(diff: string): string {
        return `As an AI assistant, generate a concise and meaningful git commit message for the following code changes. Focus on the main purpose and impact of the changes:\n\n${diff}`;
    }

    public formatResponse(response: any): string {
        if (!response) return 'Update code';
        return response.text().trim() || 'Update code';
    }

    public async validateApiKey(): Promise<boolean> {
        if (!this.config.apiKey) {
            const action = await vscode.window.showErrorMessage(
                'GitLiveLog: Google Gemini API key not found. AI-powered commit messages will not work.',
                'Configure API Key'
            );

            if (action === 'Configure API Key') {
                await vscode.env.openExternal(
                    vscode.Uri.parse('https://makersuite.google.com/app/apikey')
                );

                await vscode.window.showInformationMessage(
                    'To get a Gemini API key:\n' +
                    '1. Sign in to Google AI Studio\n' +
                    '2. Click "Get API key"\n' +
                    '3. Create a new API key or select existing one\n' +
                    '4. Copy the API key'
                );

                await vscode.commands.executeCommand(
                    'workbench.action.openSettings',
                    'gitlivelog.ai.geminiApiKey'
                );
            }
            return false;
        }

        try {
            this.initializeModel();
            // Make a test API call
            await this.model.generateContent('test');
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`GitLiveLog: Gemini API key validation failed - ${error}`);
            return false;
        }
    }

    public async generateCommitMessage(diff: string): Promise<string> {
        if (!this.model) {
            throw new Error('Gemini model not initialized');
        }

        try {
            const prompt = this.generatePrompt(diff);
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return this.formatResponse(response);
        } catch (error) {
            console.error('Error generating commit message:', error);
            return 'Update code';
        }
    }
}
