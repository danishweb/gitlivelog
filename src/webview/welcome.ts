import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class WelcomePanel {
    public static currentPanel: WelcomePanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionPath: string;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionPath: string) {
        this._panel = panel;
        this._extensionPath = extensionPath;

        this._panel.webview.html = this._getWebviewContent();
        this._setWebviewMessageListener(this._panel.webview);
    }

    public static show(extensionPath: string) {
        if (WelcomePanel.currentPanel) {
            WelcomePanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'gitLiveLogWelcome',
            'Welcome to GitLiveLog',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        WelcomePanel.currentPanel = new WelcomePanel(panel, extensionPath);
    }

    private _getWebviewContent(): string {
        const htmlPath = path.join(this._extensionPath, 'src', 'webview', 'welcome.html');
        let htmlContent = fs.readFileSync(htmlPath, 'utf8');
        
        // Make paths absolute for webview
        const webview = this._panel.webview;
        htmlContent = htmlContent.replace(
            /(<link.+?href="|<script.+?src="|<img.+?src=")(.+?)"/g,
            (m, $1, $2) => {
                return $1 + webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionPath, $2))) + '"';
            }
        );
        
        return htmlContent;
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'finishSetup':
                        const config = vscode.workspace.getConfiguration('gitlivelog');
                        await config.update('autoCommitEnabled', message.settings.autoCommitEnabled, true);
                        await config.update('autoCommitInterval', message.settings.autoCommitInterval, true);
                        await config.update('useAICommitMessages', message.settings.useAICommitMessages, true);
                        await config.update('setupComplete', true, true);
                        this._panel.dispose();
                        vscode.window.showInformationMessage('GitLiveLog is ready! Your changes will be automatically committed based on your settings.');
                        break;
                }
            },
            undefined,
            this._disposables
        );
    }

    public dispose() {
        WelcomePanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
