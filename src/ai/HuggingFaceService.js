"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HuggingFaceService = void 0;
const vscode = __importStar(require("vscode"));
const axios_1 = __importDefault(require("axios"));
class HuggingFaceService {
    static instance;
    API_URL = 'https://api-inference.huggingface.co/models/Salesforce/codet5-base';
    MAX_RETRIES = 3;
    INITIAL_RETRY_DELAY = 2000; // 2 seconds
    isModelLoaded = false;
    modelLoadingPromise;
    constructor() { }
    static getInstance() {
        if (!HuggingFaceService.instance) {
            HuggingFaceService.instance = new HuggingFaceService();
        }
        return HuggingFaceService.instance;
    }
    getApiToken() {
        return vscode.workspace.getConfiguration('gitlivelog.ai').get('huggingFaceToken');
    }
    async validateToken() {
        const token = this.getApiToken();
        if (!token) {
            const action = await vscode.window.showErrorMessage('GitLiveLog: Hugging Face API token not found. AI-powered commit messages will not work.', 'Configure Token');
            if (action === 'Configure Token') {
                vscode.env.openExternal(vscode.Uri.parse('https://huggingface.co/settings/tokens'));
                await vscode.commands.executeCommand('workbench.action.openSettings', 'gitlivelog.ai.huggingFaceToken');
            }
            return false;
        }
        return true;
    }
    async preloadModel() {
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
        }
        catch (error) {
            console.error('Failed to preload AI model:', error);
            // Reset the loading promise so we can try again
            this.modelLoadingPromise = undefined;
        }
    }
    async warmUpModel() {
        // Send a small test prompt to warm up the model
        const warmupPrompt = 'Generate a commit message for: Added README.md';
        try {
            await this.makeRequestWithRetry(warmupPrompt, 0, true);
            vscode.window.showInformationMessage('GitLiveLog: AI model ready for generating commit messages');
        }
        catch (error) {
            vscode.window.showWarningMessage('GitLiveLog: AI model warmup failed, will retry when needed');
            throw error;
        }
    }
    generatePrompt(gitDiff) {
        // Truncate diff if it's too long
        const maxLength = vscode.workspace.getConfiguration('gitlivelog.ai').get('maxDiffSize', 5000);
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
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async makeRequestWithRetry(prompt, retryCount = 0, isWarmup = false) {
        const token = this.getApiToken();
        if (!token) {
            throw new Error('Hugging Face API token not configured');
        }
        try {
            const response = await axios_1.default.post(this.API_URL, {
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
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                if (error.response?.status === 401 || error.response?.status === 403) {
                    vscode.window.showErrorMessage('GitLiveLog: Invalid Hugging Face API token. Please check your configuration.');
                    throw error;
                }
                if (error.response?.status === 503) {
                    const errorData = error.response.data;
                    if (errorData.error?.includes('loading') && retryCount < this.MAX_RETRIES) {
                        const waitTime = errorData.estimated_time ?
                            Math.ceil(errorData.estimated_time * 1000) :
                            this.INITIAL_RETRY_DELAY * (retryCount + 1);
                        const message = isWarmup ?
                            `Warming up AI model, please wait ${Math.ceil(waitTime / 1000)}s...` :
                            `AI model is warming up, retrying in ${Math.ceil(waitTime / 1000)}s...`;
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
    async generateCommitMessage(gitDiff) {
        // Check if AI is enabled in settings
        const aiEnabled = vscode.workspace.getConfiguration('gitlivelog.ai').get('enabled', true);
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
        }
        catch (error) {
            console.error('Failed to generate commit message:', error);
            if (axios_1.default.isAxiosError(error)) {
                vscode.window.showErrorMessage(`GitLiveLog: AI service error - ${error.message}`);
            }
            return `chore: update ${new Date().toISOString()}`;
        }
    }
    formatResponse(response) {
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
exports.HuggingFaceService = HuggingFaceService;
//# sourceMappingURL=HuggingFaceService.js.map