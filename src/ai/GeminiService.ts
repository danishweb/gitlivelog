import * as vscode from "vscode";
import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiService {
  private static instance: GeminiService;
  private readonly MODEL_NAME = "gemini-pro";
  private genAI?: GoogleGenerativeAI;
  private model?: any;

  private constructor() {}

  public static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  private getApiKey(): string | undefined {
    return vscode.workspace
      .getConfiguration("gitlivelog.ai")
      .get<string>("geminiApiKey");
  }

  private async validateApiKey(): Promise<boolean> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      const action = await vscode.window.showErrorMessage(
        "GitLiveLog: Google Gemini API key not found. AI-powered commit messages will not work.",
        "Configure API Key"
      );

      if (action === "Configure API Key") {
        // Open Google Gemini API key page
        await vscode.env.openExternal(
          vscode.Uri.parse("https://makersuite.google.com/app/apikey")
        );

        // Show information about getting an API key
        await vscode.window.showInformationMessage(
          "To get a Gemini API key:\n" +
            "1. Sign in to Google AI Studio\n" +
            '2. Click "Get API key"\n' +
            "3. Create a new API key or select existing one\n" +
            "4. Copy the API key"
        );

        // Open VS Code settings
        await vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "gitlivelog.ai.geminiApiKey"
        );
      }
      return false;
    }
    return true;
  }

  private initializeModel() {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("Gemini API key not configured");
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: this.MODEL_NAME });
  }

  private generatePrompt(gitDiff: string): string {
    // Truncate diff if it's too long
    const maxLength = vscode.workspace
      .getConfiguration("gitlivelog.ai")
      .get<number>("maxDiffSize", 5000);
    const truncatedDiff =
      gitDiff.length > maxLength
        ? gitDiff.substring(0, maxLength) + "\n... (truncated)"
        : gitDiff;

    return `As a commit message generator, create a concise and clear conventional commit message for these changes:

### Git Diff ###
${truncatedDiff}
### End Diff ###

Instructions:
1. Use conventional commit format: type(scope): description
2. Types: feat, fix, docs, style, refactor, perf, test, chore
3. Keep it concise (max 100 characters)
4. Focus on the main change
5. No body or footer needed
6. Return ONLY the commit message, nothing else`;
  }

  public async generateCommitMessage(gitDiff: string): Promise<string> {
    // Check if AI is enabled in settings
    const aiEnabled = vscode.workspace
      .getConfiguration("gitlivelog.ai")
      .get<boolean>("enabled", true);
    if (!aiEnabled) {
      return `chore: update ${new Date().toISOString()}`;
    }

    // Validate API key before proceeding
    if (!(await this.validateApiKey())) {
      return `chore: update ${new Date().toISOString()}`;
    }

    try {
      // Initialize model if needed
      if (!this.model) {
        this.initializeModel();
      }

      const prompt = this.generatePrompt(gitDiff);

      // Generate commit message
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const commitMessage = response.text().trim();

      return this.formatResponse(commitMessage);
    } catch (error) {
      console.error("Failed to generate commit message:", error);
      if (error instanceof Error) {
        vscode.window.showErrorMessage(
          `GitLiveLog: AI service error - ${error.message}`
        );
      }
      return `chore: update ${new Date().toISOString()}`;
    }
  }

  private formatResponse(response: string): string {
    const cleanResponse = response.trim();
    const conventionalCommitPattern =
      /^(feat|fix|docs|style|refactor|perf|test|chore)(\([^)]+\))?: .+/;

    if (conventionalCommitPattern.test(cleanResponse)) {
      return cleanResponse;
    }

    // If response doesn't match the pattern, extract the first meaningful line
    const firstLine = cleanResponse.split("\n")[0];
    if (firstLine.length > 5) {
      return `chore: ${firstLine}`;
    }

    // Last resort fallback
    return `chore: update ${new Date().toISOString()}`;
  }
}
