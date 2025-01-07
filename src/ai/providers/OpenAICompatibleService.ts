import * as vscode from "vscode";
import OpenAI from "openai";
import { IAIService } from "../interfaces/IAIService";
import { AIModelConfig } from "../interfaces/AIModels";

export class OpenAICompatibleService implements IAIService {
  private client?: OpenAI;
  private readonly defaultMaxTokens = 500;

  constructor(private config: AIModelConfig) {
    if (config.apiKey) {
      this.initializeClient();
    }
  }

  private initializeClient(): void {
    if (!this.config.apiKey) return;

    const clientConfig: any = {
      apiKey: this.config.apiKey,
    };

    // Add baseURL for OpenAI-compatible services
    if (this.config.baseURL) {
      clientConfig.baseURL = this.config.baseURL;
    }

    this.client = new OpenAI(clientConfig);
  }

  public getProviderName(): string {
    return this.config.baseURL ? "OpenAI Compatible" : "OpenAI";
  }

  public generatePrompt(diff: string): string {
    return `As an AI assistant, generate a concise and meaningful git commit message for the following code changes. Focus on the main purpose and impact of the changes:\n\n${diff}`;
  }

  public formatResponse(response: any): string {
    if (!response?.choices?.[0]?.message?.content) {
      return "Update code";
    }
    return response.choices[0].message.content.trim();
  }

  public async validateApiKey(): Promise<boolean> {
    if (!this.config.apiKey) {
      const action = await vscode.window.showErrorMessage(
        `GitLiveLog: API key not found for ${this.config.name}. AI-powered commit messages will not work.`,
        "Configure API Key"
      );

      if (action === "Configure API Key") {
        await vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "gitlivelog.ai.apiKey"
        );
      }
      return false;
    }

    try {
      this.initializeClient();
      // Make a test API call
      await this.client!.chat.completions.create({
        messages: [{ role: "user", content: "test" }],
        model: this.config.name,
        max_tokens: this.defaultMaxTokens,
      });
      return true;
    } catch (error) {
      vscode.window.showErrorMessage(
        `GitLiveLog: API key validation failed - ${error}`
      );
      return false;
    }
  }

  public async generateCommitMessage(diff: string): Promise<string> {
    if (!this.client) {
      const error = "OpenAI client not initialized";
      vscode.window.showErrorMessage(`GitLiveLog: ${error}`);
      throw new Error(error);
    }

    try {
      const prompt = this.generatePrompt(diff);
      const response = await this.client.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that generates concise and meaningful git commit messages based on code changes.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        model: this.config.name,
        temperature: 0.7,
        max_tokens: this.config.maxOutputTokens || this.defaultMaxTokens,
      });

      const message = this.formatResponse(response);
      if (!message || message === "Update code") {
        const error = "Failed to generate meaningful commit message";
        vscode.window.showErrorMessage(`GitLiveLog: ${error}`);
        throw new Error(error);
      }

      return message;
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.error?.message ||
        error?.message ||
        "Unknown error";
      const userMessage = `Failed to generate commit message using ${this.config.name}: ${errorMessage}`;
      console.error("[GitLiveLog] Error:", userMessage);
      vscode.window.showErrorMessage(`GitLiveLog: ${userMessage}`);
      throw error;
    }
  }
}
