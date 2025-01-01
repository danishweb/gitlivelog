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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WelcomePanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class WelcomePanel {
    static currentPanel;
    _panel;
    _extensionPath;
    _disposables = [];
    constructor(panel, extensionPath) {
        this._panel = panel;
        this._extensionPath = extensionPath;
        this._panel.webview.html = this._getWebviewContent();
        this._setWebviewMessageListener(this._panel.webview);
    }
    static show(extensionPath) {
        if (WelcomePanel.currentPanel) {
            WelcomePanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
            return;
        }
        const panel = vscode.window.createWebviewPanel('gitLiveLogWelcome', 'Welcome to GitLiveLog', vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true
        });
        WelcomePanel.currentPanel = new WelcomePanel(panel, extensionPath);
    }
    _getWebviewContent() {
        const htmlPath = path.join(this._extensionPath, 'src', 'webview', 'welcome.html');
        let htmlContent = fs.readFileSync(htmlPath, 'utf8');
        // Make paths absolute for webview
        const webview = this._panel.webview;
        htmlContent = htmlContent.replace(/(<link.+?href="|<script.+?src="|<img.+?src=")(.+?)"/g, (m, $1, $2) => {
            return $1 + webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionPath, $2))) + '"';
        });
        return htmlContent;
    }
    _setWebviewMessageListener(webview) {
        webview.onDidReceiveMessage(async (message) => {
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
        }, undefined, this._disposables);
    }
    dispose() {
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
exports.WelcomePanel = WelcomePanel;
//# sourceMappingURL=welcome.js.map