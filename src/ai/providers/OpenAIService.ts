import * as vscode from 'vscode';
import OpenAI from 'openai';
import { IAIService, AIServiceConfig } from '../interfaces/IAIService';

export class OpenAIService implements IAIService {
    private readonly MODEL_NAME = 'gpt-3.5-turbo';
    private openai?: OpenAI;

    constructor(private config: AIServiceConfig) {
        if (config.apiKey) {
            this.initializeModel();
        }
    }

    private initializeModel(): void {
        if (this.config.apiKey) {
            this.openai = new OpenAI({ apiKey: this.config.apiKey });
        }
    }

    public getProviderName(): string {
        return 'OpenAI';
    }

    public generatePrompt(diff: string): string {
        return `As an AI assistant, generate a concise and meaningful git commit message for the following code changes. Focus on the main purpose and impact of the changes:\n\n${diff}`;
    }

    public formatResponse(response: any): string {
        if (!response?.choices?.[0]?.message?.content) {
            return 'Update code';
        }
        return response.choices[0].message.content.trim();
    }

    public async validateApiKey(): Promise<boolean> {
        if (!this.config.apiKey) {
            const action = await vscode.window.showErrorMessage(
                'GitLiveLog: OpenAI API key not found. AI-powered commit messages will not work.',
                'Configure API Key'
            );

            if (action === 'Configure API Key') {
                await vscode.env.openExternal(
                    vscode.Uri.parse('https://platform.openai.com/api-keys')
                );

                await vscode.window.showInformationMessage(
                    'To get an OpenAI API key:\n' +
                    '1. Sign in to OpenAI\n' +
                    '2. Navigate to API keys section\n' +
                    '3. Create a new API key\n' +
                    '4. Copy the API key'
                );

                await vscode.commands.executeCommand(
                    'workbench.action.openSettings',
                    'gitlivelog.ai.openaiApiKey'
                );
            }
            return false;
        }

        try {
            this.initializeModel();
            // Make a test API call
            await this.openai!.chat.completions.create({
                messages: [{ role: 'user', content: 'test' }],
                model: this.config.model || this.MODEL_NAME
            });
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`GitLiveLog: OpenAI API key validation failed - ${error}`);
            return false;
        }
    }

    public async generateCommitMessage(diff: string): Promise<string> {
        if (!this.openai) {
            throw new Error('OpenAI client not initialized');
        }

        try {
            const prompt = this.generatePrompt(diff);
            const response = await this.openai.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant that generates concise and meaningful git commit messages based on code changes.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                model: this.config.model || this.MODEL_NAME,
                temperature: 0.7,
                max_tokens: 50
            });

            return this.formatResponse(response);
        } catch (error) {
            console.error('Error generating commit message:', error);
            return 'Update code';
        }
    }
}
