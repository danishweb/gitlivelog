// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { WelcomePanel } from './webview/welcome';
import { StatsPanel } from './webview/stats';
import { ActivityTracker } from './tracking/ActivityTracker';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('GitLiveLog is now active!');

	// Initialize activity tracker
	const tracker = ActivityTracker.getInstance();

	// Check if this is first activation
	const config = vscode.workspace.getConfiguration('gitlivelog');
	const setupComplete = config.get('setupComplete');

	if (!setupComplete) {
		// Show welcome screen on first activation
		WelcomePanel.show(context.extensionUri);
	} else {
		// Start tracking if setup is complete
		tracker.startTracking();
	}

	// Register commands
	let disposables = [
		vscode.commands.registerCommand('gitlivelog.showWelcome', () => {
			WelcomePanel.show(context.extensionUri);
		}),
		vscode.commands.registerCommand('gitlivelog.startTracking', () => {
			tracker.startTracking();
			vscode.window.showInformationMessage('GitLiveLog: Activity tracking started');
		}),
		vscode.commands.registerCommand('gitlivelog.pauseTracking', () => {
			tracker.pauseTracking();
			vscode.window.showInformationMessage('GitLiveLog: Activity tracking paused');
		}),
		vscode.commands.registerCommand('gitlivelog.showStats', async () => {
			try {
				const now = Date.now();
				const dayStart = now - (24 * 60 * 60 * 1000); // Last 24 hours
				const summary = await tracker.getActivitySummary(dayStart, now);
				StatsPanel.show(context.extensionUri, summary);
			} catch (error: any) {
				vscode.window.showErrorMessage(`Failed to load activity stats: ${error.message}`);
			}
		})
	];

	context.subscriptions.push(...disposables);
}

// This method is called when your extension is deactivated
export function deactivate() {
	ActivityTracker.getInstance().dispose();
}
