import * as vscode from 'vscode';
import { GitService } from '../utils/git';
import { StatusBar } from '../ui/StatusBar';

export class AutoCommit {
    private static instance: AutoCommit;
    private timer: NodeJS.Timeout | undefined;
    private lastCommit: Date | undefined;
    private gitService: GitService;
    private statusBar: StatusBar;

    private constructor() {
        this.gitService = GitService.getInstance();
        this.statusBar = StatusBar.getInstance();
    }

    public static getInstance(): AutoCommit {
        if (!AutoCommit.instance) {
            AutoCommit.instance = new AutoCommit();
        }
        return AutoCommit.instance;
    }

    public async startTracking(): Promise<void> {
        try {
            // Initialize Git service
            await this.gitService.initialize();

            // Get configuration
            const config = vscode.workspace.getConfiguration('gitlivelog');
            const interval = config.get<number>('commitFrequency', 30);

            // Start timer
            if (this.timer) {
                clearTimeout(this.timer);
            }
            this.timer = setInterval(() => this.checkAndCommit(), interval * 60 * 1000) as unknown as NodeJS.Timeout;
            
            // Update configuration and status
            await config.update('isTracking', true, true);
            this.statusBar.updateStatus(true, this.lastCommit);

            vscode.window.showInformationMessage('GitLiveLog: Started tracking your coding activity');
        } catch (error) {
            console.error('Failed to start tracking:', error);
            vscode.window.showErrorMessage('GitLiveLog: Failed to start tracking. Please check Git configuration.');
        }
    }

    public async stopTracking(): Promise<void> {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }

        const config = vscode.workspace.getConfiguration('gitlivelog');
        await config.update('isTracking', false, true);
        this.statusBar.updateStatus(false);

        vscode.window.showInformationMessage('GitLiveLog: Stopped tracking your coding activity');
    }

    private async checkAndCommit(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('gitlivelog');
            const excludePatterns = config.get<string[]>('exclude', []);
            
            // Filter changes based on exclude patterns
            const hasChanges = await this.gitService.hasUncommittedChanges(excludePatterns);
            if (!hasChanges) {
                console.log('GitLiveLog: No changes to commit');
                return;
            }

            // Get the list of changed files for notification
            const changedFiles = await this.gitService.getChangedFiles();
            
            // Show notification about pending commit
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "GitLiveLog",
                cancellable: false
            }, async (progress) => {
                progress.report({ message: 'Preparing to commit changes...' });
                
                const showDialog = config.get<boolean>('showCommitDialog', false);
                let shouldCommit = true;

                if (showDialog) {
                    // Create a detailed message about changes
                    const changeMessage = changedFiles.length > 5 
                        ? `${changedFiles.slice(0, 5).join('\n')}...\nand ${changedFiles.length - 5} more files`
                        : changedFiles.join('\n');

                    const result = await vscode.window.showInformationMessage(
                        `GitLiveLog: Ready to commit the following changes?\n\n${changeMessage}`,
                        { modal: true },
                        'Yes', 'No'
                    );
                    shouldCommit = result === 'Yes';
                } else {
                    // Just notify about the commit
                    vscode.window.setStatusBarMessage('GitLiveLog: Committing changes...', 3000);
                }

                if (shouldCommit) {
                    progress.report({ message: 'Committing changes...' });
                    await this.commitChanges();
                    progress.report({ message: 'Changes committed successfully!' });
                    
                    // Show notification with commit details
                    const message = changedFiles.length === 1 
                        ? '1 file was committed'
                        : `${changedFiles.length} files were committed`;
                        
                    vscode.window.showInformationMessage(
                        `GitLiveLog: ${message}`,
                        'View Changes'
                    ).then(selection => {
                        if (selection === 'View Changes') {
                            vscode.commands.executeCommand('git.viewHistory');
                        }
                    });
                }
            });
        } catch (error) {
            console.error('Failed to check/commit changes:', error);
            vscode.window.showErrorMessage('GitLiveLog: Failed to commit changes. Please check Git configuration.');
        }
    }

    private async commitChanges(): Promise<void> {
        try {
            const timestamp = new Date().toISOString();
            const message = `GitLiveLog: Activity update ${timestamp}`;
            
            await this.gitService.stageAll();
            await this.gitService.commit(message);
            
            this.lastCommit = new Date();
            this.statusBar.updateStatus(true, this.lastCommit);
            
            console.log('GitLiveLog: Successfully committed changes');
        } catch (error) {
            console.error('Failed to commit changes:', error);
            throw error;
        }
    }

    public async forceSync(): Promise<void> {
        try {
            await this.checkAndCommit();
            vscode.window.showInformationMessage('GitLiveLog: Successfully synced changes');
        } catch (error) {
            console.error('Failed to force sync:', error);
            vscode.window.showErrorMessage('GitLiveLog: Failed to sync changes. Please check Git configuration.');
        }
    }

    public dispose(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
    }
}
