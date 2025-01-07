// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { AutoCommit } from './tracking/AutoCommit';
import { GitService } from './utils/git';
import { StatusBar } from './ui/StatusBar';
import { WelcomePanel } from './webview/welcome';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

    const autoCommit = AutoCommit.getInstance();
    const gitService = GitService.getInstance();
    const statusBar = StatusBar.getInstance();

    // Check if this is the first installation
    const isFirstInstall = !context.globalState.get('gitlivelog.installed');
    if (isFirstInstall) {
        // Mark as installed
        await context.globalState.update('gitlivelog.installed', true);
        
        // Show welcome screen
        WelcomePanel.show(context.extensionPath);
        
        // Start tracking automatically
        try {
            await autoCommit.startTracking();
            vscode.window.showInformationMessage('GitLiveLog: Started tracking your coding journey!');
        } catch (error) {
            console.error('Failed to start initial tracking:', error);
            vscode.window.showErrorMessage('GitLiveLog: Please configure Git before starting to track.');
        }
    }

    // Register commands
    let disposables = [
        vscode.commands.registerCommand('gitlivelog.showCommands', async () => {
            const config = vscode.workspace.getConfiguration('gitlivelog');
            const isTracking = config.get<boolean>('isTracking', true);

            const items: vscode.QuickPickItem[] = [
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
                        WelcomePanel.show(context.extensionPath);
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
            WelcomePanel.show(context.extensionPath);
        }),

        vscode.commands.registerCommand('gitlivelog.startTracking', async () => {
            try {
                await autoCommit.startTracking();
            } catch (error) {
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
    const isTracking = config.get<boolean>('isTracking', true); // Default to true
    
    if (isTracking) {
        // Delay the initialization slightly to allow VS Code to fully load
        setTimeout(async () => {
            try {
                await gitService.initialize();
                await autoCommit.startTracking();
            } catch (error) {
                console.error('Failed to restore tracking state:', error);
                // Don't show error message here as it might be annoying on every VS Code start
                // Just update the configuration to reflect the actual state
                await config.update('isTracking', false, true);
                
                // Show status bar in inactive state
                statusBar.updateStatus(false);
                
                // If this is a new installation, show a more helpful message
                if (context.globalState.get('gitlivelog.installed') === undefined) {
                    vscode.window.showInformationMessage(
                        'GitLiveLog needs a Git repository to track your changes. Would you like to initialize one?',
                        'Yes', 'No'
                    ).then(async answer => {
                        if (answer === 'Yes') {
                            try {
                                await gitService.initialize();
                                await autoCommit.startTracking();
                                vscode.window.showInformationMessage('GitLiveLog: Started tracking your coding journey!');
                            } catch (initError) {
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
export function deactivate() {
    const autoCommit = AutoCommit.getInstance();
    autoCommit.dispose();
}
