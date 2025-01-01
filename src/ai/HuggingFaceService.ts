import * as vscode from 'vscode';
import { default as axios } from 'axios';

interface HuggingFaceError {
    error: string;
    estimated_time?: number;
}

export class HuggingFaceService {
    private static instance: HuggingFaceService;
    private readonly API_URL = 'https://api-inference.huggingface.co/models/Salesforce/codet5-base';
    private readonly MAX_RETRIES = 3;
    private readonly INITIAL_RETRY_DELAY = 2000; // 2 seconds
    private isModelLoaded: boolean = false;
    private modelLoadingPromise?: Promise<void>;
    
    private constructor() {}

    public static getInstance(): HuggingFaceService {
        if (!HuggingFaceService.instance) {
            HuggingFaceService.instance = new HuggingFaceService();
        }
        return HuggingFaceService.instance;
    }

    private getApiToken(): string | undefined {
        return vscode.workspace.getConfiguration('gitlivelog.ai').get<string>('huggingFaceToken');
    }

    private async validateToken(): Promise<boolean> {
        const token = this.getApiToken();
        if (!token) {
            const action = await vscode.window.showErrorMessage(
                'GitLiveLog: Hugging Face API token not found. AI-powered commit messages will not work.',
                'Configure Token'
            );
            
            if (action === 'Configure Token') {
                // First open the Hugging Face token page with specific scope instructions
                const tokenUrl = 'https://huggingface.co/settings/tokens?scope=inference-api';
                await vscode.env.openExternal(vscode.Uri.parse(tokenUrl));
                
                // Show information about required permissions
                await vscode.window.showInformationMessage(
                    'Please ensure your token has "inference-api" permission. Create a new token with:' +
                    '\n1. Role: inference-api' +
                    '\n2. Check "inference-api" in permissions'
                );
                
                // Then open VS Code settings
                await vscode.commands.executeCommand('workbench.action.openSettings', 'gitlivelog.ai.huggingFaceToken');
            }
            return false;
        }
        return true;
    }

    public async preloadModel(): Promise<void> {
        if (!await this.validateToken()) {
            return;
        }

        if (this.isModelLoaded || this.modelLoadingPromise) {
            return;
        }

        this.modelLoadingPromise = this.warmUpModel();
        try {
            await this.modelLoadingPromise;
            this.isModelLoaded = true;
            console.log('GitLiveLog: AI model preloaded successfully');
        } catch (error) {
            console.error('Failed to preload AI model:', error);
            // Reset the loading promise so we can try again
            this.modelLoadingPromise = undefined;
        }
    }

    private async warmUpModel(): Promise<void> {
        // Send a small test prompt to warm up the model
        const warmupPrompt = 'Generate a commit message for: Added README.md';
        try {
            await this.makeRequestWithRetry(warmupPrompt, 0, true);
            vscode.window.showInformationMessage('GitLiveLog: AI model ready for generating commit messages');
        } catch (error) {
            vscode.window.showWarningMessage('GitLiveLog: AI model warmup failed, will retry when needed');
            throw error;
        }
    }

    private generatePrompt(gitDiff: string): string {
        // Truncate diff if it's too long
        const maxLength = vscode.workspace.getConfiguration('gitlivelog.ai').get<number>('maxDiffSize', 5000);
        const truncatedDiff = gitDiff.length > maxLength ? 
            gitDiff.substring(0, maxLength) + '\n... (truncated)' : 
            gitDiff;

        return `Generate a conventional commit message for these changes:
### Git Diff ###
${truncatedDiff}
### End Diff ###

Instructions:
1. Use conventional commit format: type(scope): description
2. Types: feat, fix, docs, style, refactor, perf, test, chore
3. Keep it concise and clear
4. Focus on the main change
5. No body or footer needed`;
    }

    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async makeRequestWithRetry(prompt: string, retryCount = 0, isWarmup = false): Promise<string> {
        const token = this.getApiToken();
        if (!token) {
            throw new Error('Hugging Face API token not configured');
        }

        try {
            const response = await axios.post(this.API_URL, {
                inputs: prompt,
                parameters: {
                    max_length: 100,
                    temperature: 0.3,
                    top_p: 0.9
                }
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!isWarmup) {
                this.isModelLoaded = true;
            }
            return response.data[0].generated_text;
        } catch (error: any) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 401 || error.response?.status === 403) {
                    const action = await vscode.window.showErrorMessage(
                        'GitLiveLog: Invalid Hugging Face API token. Please check if it has the required permissions.',
                        'Update Token'
                    );

                    if (action === 'Update Token') {
                        // Open Hugging Face token page with specific scope
                        const tokenUrl = 'https://huggingface.co/settings/tokens?scope=inference-api';
                        await vscode.env.openExternal(vscode.Uri.parse(tokenUrl));
                        
                        await vscode.window.showInformationMessage(
                            'To fix the token:\n' +
                            '1. Create a new token with "inference-api" role\n' +
                            '2. Make sure "inference-api" permission is checked\n' +
                            '3. Copy the new token and update it in settings'
                        );
                        
                        await vscode.commands.executeCommand('workbench.action.openSettings', 'gitlivelog.ai.huggingFaceToken');
                    }
                    throw new Error('Invalid token permissions. Please create a new token with inference-api permission.');
                }
                
                if (error.response?.status === 503) {
                    const errorData = error.response.data as HuggingFaceError;
                    
                    if (errorData.error?.includes('loading') && retryCount < this.MAX_RETRIES) {
                        const waitTime = errorData.estimated_time ? 
                            Math.ceil(errorData.estimated_time * 1000) : 
                            this.INITIAL_RETRY_DELAY * (retryCount + 1);

                        const message = isWarmup ? 
                            `Warming up AI model, please wait ${Math.ceil(waitTime/1000)}s...` :
                            `AI model is warming up, retrying in ${Math.ceil(waitTime/1000)}s...`;

                        console.log(`Model is loading, waiting ${waitTime}ms before retry ${retryCount + 1}/${this.MAX_RETRIES}`);
                        vscode.window.showInformationMessage(`GitLiveLog: ${message}`);
                        
                        await this.delay(waitTime);
                        return this.makeRequestWithRetry(prompt, retryCount + 1, isWarmup);
                    }
                }
            }
            
            throw error;
        }
    }

    public async generateCommitMessage(gitDiff: string): Promise<string> {
        // Check if AI is enabled in settings
        const aiEnabled = vscode.workspace.getConfiguration('gitlivelog.ai').get<boolean>('enabled', true);
        if (!aiEnabled) {
            return `chore: update ${new Date().toISOString()}`;
        }

        // Validate token before proceeding
        if (!await this.validateToken()) {
            return `chore: update ${new Date().toISOString()}`;
        }

        try {
            // If model is still loading from preload, wait for it
            if (this.modelLoadingPromise) {
                await this.modelLoadingPromise;
            }
            // If model isn't loaded or preloading failed, try loading it now
            else if (!this.isModelLoaded) {
                await this.preloadModel();
            }

            const prompt = this.generatePrompt(gitDiff);
            const response = await this.makeRequestWithRetry(prompt);
            return this.formatResponse(response);
        } catch (error) {
            console.error('Failed to generate commit message:', error);
            if (axios.isAxiosError(error)) {
                vscode.window.showErrorMessage(`GitLiveLog: AI service error - ${error.message}`);
            }
            return `chore: update ${new Date().toISOString()}`;
        }
    }

    private formatResponse(response: string): string {
        const cleanResponse = response.trim();
        const conventionalCommitPattern = /^(feat|fix|docs|style|refactor|perf|test|chore)(\([^)]+\))?: .+/;
        
        if (conventionalCommitPattern.test(cleanResponse)) {
            return cleanResponse;
        }

        // If response doesn't match the pattern, extract the first meaningful line
        const firstLine = cleanResponse.split('\n')[0];
        if (firstLine.length > 5) {
            return `chore: ${firstLine}`;
        }

        // Last resort fallback
        return `chore: update ${new Date().toISOString()}`;
    }
}
