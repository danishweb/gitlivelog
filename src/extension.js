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
exports.activate = activate;
exports.deactivate = deactivate;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __importStar(require("vscode"));
const AutoCommit_1 = require("./tracking/AutoCommit");
const git_1 = require("./utils/git");
const StatusBar_1 = require("./ui/StatusBar");
const welcome_1 = require("./webview/welcome");
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
async function activate(context) {
    console.log('GitLiveLog: Extension is being activated...');
    const autoCommit = AutoCommit_1.AutoCommit.getInstance();
    const gitService = git_1.GitService.getInstance();
    const statusBar = StatusBar_1.StatusBar.getInstance();
    // Check if this is the first installation
    const isFirstInstall = !context.globalState.get('gitlivelog.installed');
    if (isFirstInstall) {
        // Mark as installed
        await context.globalState.update('gitlivelog.installed', true);
        // Show welcome screen
        welcome_1.WelcomePanel.show(context.extensionPath);
        // Start tracking automatically
        try {
            await autoCommit.startTracking();
            vscode.window.showInformationMessage('GitLiveLog: Started tracking your coding journey!');
        }
        catch (error) {
            console.error('Failed to start initial tracking:', error);
            vscode.window.showErrorMessage('GitLiveLog: Please configure Git before starting to track.');
        }
    }
    // Register commands
    let disposables = [
        vscode.commands.registerCommand('gitlivelog.showCommands', async () => {
            const config = vscode.workspace.getConfiguration('gitlivelog');
            const isTracking = config.get('isTracking', true);
            const items = [
                {
                    label: isTracking ? "$(stop-circle) Stop Tracking" : "$(play-circle) Start Tracking",
                    description: isTracking ? "Stop tracking your coding activity" : "Start tracking your coding activity",
                    detail: isTracking ? "Currently tracking your changes" : "Not currently tracking"
                },
                {
                    label: "$(gear) Open Settings",
                    description: "Configure GitLiveLog settings",
                    detail: "Customize commit frequency, exclusions, and other options"
                }
            ];
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a GitLiveLog command...',
                matchOnDescription: true,
                matchOnDetail: true
            });
            if (selected) {
                switch (selected.label) {
                    case "$(notebook-state-success) Show Welcome Screen":
                        welcome_1.WelcomePanel.show(context.extensionPath);
                        break;
                    case "$(stop-circle) Stop Tracking":
                        await autoCommit.stopTracking();
                        break;
                    case "$(play-circle) Start Tracking":
                        await autoCommit.startTracking();
                        break;
                    case "$(sync) Force Sync Now":
                        await autoCommit.forceSync();
                        break;
                    case "$(gear) Open Settings":
                        await vscode.commands.executeCommand('workbench.action.openSettings', 'gitlivelog');
                        break;
                    case "$(history) View History":
                        await vscode.commands.executeCommand('git.viewHistory');
                        break;
                }
            }
        }),
        vscode.commands.registerCommand('gitlivelog.showWelcome', () => {
            welcome_1.WelcomePanel.show(context.extensionPath);
        }),
        vscode.commands.registerCommand('gitlivelog.startTracking', async () => {
            try {
                await autoCommit.startTracking();
            }
            catch (error) {
                vscode.window.showErrorMessage('Failed to start tracking. Please check Git configuration.');
            }
        }),
        vscode.commands.registerCommand('gitlivelog.stopTracking', async () => {
            await autoCommit.stopTracking();
        }),
        vscode.commands.registerCommand('gitlivelog.forceSync', async () => {
            await autoCommit.forceSync();
        })
    ];
    // Add disposables to context
    context.subscriptions.push(...disposables);
    // Initialize status bar and restore tracking state
    const config = vscode.workspace.getConfiguration('gitlivelog');
    const isTracking = config.get('isTracking', true); // Default to true
    if (isTracking) {
        // Delay the initialization slightly to allow VS Code to fully load
        setTimeout(async () => {
            try {
                await gitService.initialize();
                await autoCommit.startTracking();
            }
            catch (error) {
                console.error('Failed to restore tracking state:', error);
                // Don't show error message here as it might be annoying on every VS Code start
                // Just update the configuration to reflect the actual state
                await config.update('isTracking', false, true);
                // Show status bar in inactive state
                statusBar.updateStatus(false);
                // If this is a new installation, show a more helpful message
                if (context.globalState.get('gitlivelog.installed') === undefined) {
                    vscode.window.showInformationMessage('GitLiveLog needs a Git repository to track your changes. Would you like to initialize one?', 'Yes', 'No').then(async (answer) => {
                        if (answer === 'Yes') {
                            try {
                                await gitService.initialize();
                                await autoCommit.startTracking();
                                vscode.window.showInformationMessage('GitLiveLog: Started tracking your coding journey!');
                            }
                            catch (initError) {
                                vscode.window.showErrorMessage('Failed to initialize Git repository. Please try again later.');
                            }
                        }
                    });
                }
            }
        }, 2000); // Wait 2 seconds before initializing
    }
}
// This method is called when your extension is deactivated
function deactivate() {
    const autoCommit = AutoCommit_1.AutoCommit.getInstance();
    autoCommit.dispose();
}
//# sourceMappingURL=extension.js.map