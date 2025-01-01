import * as vscode from 'vscode';

export class StatusBar {
    private static instance: StatusBar;
    private statusBarItem: vscode.StatusBarItem;
    private syncStatusItem: vscode.StatusBarItem;

    private constructor() {
        // Create main status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.statusBarItem.command = 'gitlivelog.showCommands';

        // Create sync status bar item
        this.syncStatusItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            99
        );
        this.syncStatusItem.command = 'gitlivelog.forceSync';

        this.updateStatus(false);
    }

    public static getInstance(): StatusBar {
        if (!StatusBar.instance) {
            StatusBar.instance = new StatusBar();
        }
        return StatusBar.instance;
    }

    public updateStatus(isTracking: boolean, lastSync?: Date): void {
        if (isTracking) {
            this.statusBarItem.text = "$(radio-tower) GitLiveLog: Active";
            this.statusBarItem.tooltip = "Click to show GitLiveLog commands";
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            
            if (lastSync) {
                this.syncStatusItem.text = `$(sync) Last sync: ${this.formatTime(lastSync)}`;
                this.syncStatusItem.tooltip = "Click to force sync now";
                this.syncStatusItem.show();
            }
        } else {
            this.statusBarItem.text = "$(circle-slash) GitLiveLog: Inactive";
            this.statusBarItem.tooltip = "Click to show GitLiveLog commands";
            this.statusBarItem.backgroundColor = undefined;
            this.syncStatusItem.hide();
        }
        this.statusBarItem.show();
    }

    private formatTime(date: Date): string {
        const now = new Date();
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000); // seconds

        if (diff < 60) {
            return 'just now';
        } else if (diff < 3600) {
            const minutes = Math.floor(diff / 60);
            return `${minutes}m ago`;
        } else if (diff < 86400) {
            const hours = Math.floor(diff / 3600);
            return `${hours}h ago`;
        } else {
            const days = Math.floor(diff / 86400);
            return `${days}d ago`;
        }
    }

    public dispose(): void {
        this.statusBarItem.dispose();
        this.syncStatusItem.dispose();
    }
}
