import * as vscode from 'vscode';

export class WelcomePanel {
    public static currentPanel: WelcomePanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel) {
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.html = this._getWebviewContent();
        this._setWebviewMessageListener(this._panel.webview);
    }

    public static show(extensionUri: vscode.Uri) {
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
                localResourceRoots: [extensionUri]
            }
        );

        WelcomePanel.currentPanel = new WelcomePanel(panel);
    }

    private _getWebviewContent() {
        return `<!DOCTYPE html>
        <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
                <title>Welcome to GitLiveLog</title>
                <style>
                    :root {
                        --container-padding: 20px;
                        --input-padding-vertical: 6px;
                        --input-padding-horizontal: 4px;
                        --input-margin-vertical: 4px;
                        --input-margin-horizontal: 0;
                    }

                    body {
                        padding: var(--container-padding);
                        color: var(--vscode-foreground);
                        font-size: var(--vscode-font-size);
                        font-weight: var(--vscode-font-weight);
                        font-family: var(--vscode-font-family);
                        background-color: var(--vscode-editor-background);
                    }

                    .container {
                        max-width: 800px;
                        margin: 0 auto;
                    }

                    h1 {
                        font-size: var(--vscode-font-size);
                        font-weight: 600;
                        margin-bottom: 1em;
                        color: var(--vscode-titleBar-activeForeground);
                    }

                    .step {
                        margin-bottom: 24px;
                        padding: 16px;
                        background: var(--vscode-editor-inactiveSelectionBackground);
                        border-radius: 4px;
                    }

                    .step h2 {
                        font-size: calc(var(--vscode-font-size) * 1.1);
                        margin-top: 0;
                        margin-bottom: 8px;
                        color: var(--vscode-titleBar-activeForeground);
                    }

                    button {
                        border: none;
                        padding: var(--input-padding-vertical) var(--input-padding-horizontal);
                        width: 100%;
                        text-align: center;
                        outline: 1px solid transparent;
                        outline-offset: 2px !important;
                        color: var(--vscode-button-foreground);
                        background: var(--vscode-button-background);
                        border-radius: 2px;
                        cursor: pointer;
                    }

                    button:hover {
                        background: var(--vscode-button-hoverBackground);
                    }

                    button:focus {
                        outline-color: var(--vscode-focusBorder);
                    }

                    input[type="checkbox"] {
                        margin: var(--input-margin-vertical) var(--input-margin-horizontal);
                        padding: var(--input-padding-vertical) var(--input-padding-horizontal);
                    }

                    select {
                        width: 100%;
                        padding: var(--input-padding-vertical) var(--input-padding-horizontal);
                        margin: var(--input-margin-vertical) var(--input-margin-horizontal);
                        border: none;
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        outline-color: var(--vscode-input-border);
                        border-radius: 2px;
                    }

                    .checkbox-container {
                        display: flex;
                        align-items: center;
                        margin: 8px 0;
                    }

                    .checkbox-container label {
                        margin-left: 8px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Welcome to GitLiveLog</h1>
                    <p>Configure your activity tracking settings to get started.</p>
                    
                    <div class="step">
                        <h2>1. Activity Log Location</h2>
                        <p>Choose where to store your activity data:</p>
                        <button id="selectLocation">Browse...</button>
                        <div id="selectedLocation" style="margin-top: 8px; font-size: 0.9em; color: var(--vscode-descriptionForeground);"></div>
                    </div>

                    <div class="step">
                        <h2>2. Tracking Settings</h2>
                        <div class="checkbox-container">
                            <input type="checkbox" id="trackFileTypes" checked>
                            <label for="trackFileTypes">Track file types and directories</label>
                        </div>
                        <div class="checkbox-container">
                            <input type="checkbox" id="trackFunctions" checked>
                            <label for="trackFunctions">Track function-level changes</label>
                        </div>
                        <div class="checkbox-container">
                            <input type="checkbox" id="aiSummaries">
                            <label for="aiSummaries">Enable AI-powered summaries</label>
                        </div>
                    </div>

                    <div class="step">
                        <h2>3. Update Frequency</h2>
                        <p>Choose how often to record your activity:</p>
                        <select id="interval">
                            <option value="15">Every 15 minutes</option>
                            <option value="30" selected>Every 30 minutes (recommended)</option>
                            <option value="60">Every hour</option>
                        </select>
                    </div>

                    <button id="finish" style="margin-top: 16px;">Start Tracking</button>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    
                    document.getElementById('selectLocation').addEventListener('click', () => {
                        vscode.postMessage({ command: 'selectLocation' });
                    });

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'updateLocation':
                                document.getElementById('selectedLocation').textContent = message.location;
                                break;
                        }
                    });

                    document.getElementById('finish').addEventListener('click', () => {
                        vscode.postMessage({
                            command: 'finishSetup',
                            settings: {
                                trackFileTypes: document.getElementById('trackFileTypes').checked,
                                trackFunctions: document.getElementById('trackFunctions').checked,
                                aiSummaries: document.getElementById('aiSummaries').checked,
                                interval: document.getElementById('interval').value
                            }
                        });
                    });
                </script>
            </body>
        </html>`;
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'selectLocation':
                        const location = await vscode.window.showOpenDialog({
                            canSelectFiles: false,
                            canSelectFolders: true,
                            canSelectMany: false,
                            openLabel: 'Select Log Location'
                        });
                        if (location && location[0]) {
                            await vscode.workspace.getConfiguration('gitlivelog').update('logLocation', location[0].fsPath, true);
                            webview.postMessage({ command: 'updateLocation', location: location[0].fsPath });
                        }
                        break;
                    case 'finishSetup':
                        const config = vscode.workspace.getConfiguration('gitlivelog');
                        await config.update('trackFileTypes', message.settings.trackFileTypes, true);
                        await config.update('trackFunctions', message.settings.trackFunctions, true);
                        await config.update('aiSummaries', message.settings.aiSummaries, true);
                        await config.update('interval', parseInt(message.settings.interval), true);
                        await config.update('setupComplete', true, true);
                        this._panel.dispose();
                        vscode.window.showInformationMessage('GitLiveLog setup complete! You can change these settings anytime in VS Code settings.');
                        break;
                }
            },
            undefined,
            this._disposables
        );
    }

    private dispose() {
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
