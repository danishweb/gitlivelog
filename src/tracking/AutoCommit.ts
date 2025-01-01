import * as vscode from 'vscode';
import { GitService } from '../utils/git';
import { StatusBar } from '../ui/StatusBar';
import { HuggingFaceService } from '../ai/HuggingFaceService';

interface ActivityState {
    lastActivityTime: Date;
    changeCount: number;
    debounceTimer?: NodeJS.Timeout;
    pendingChanges: boolean;
}

export class AutoCommit {
    private static instance: AutoCommit;
    private commitCheckTimer?: NodeJS.Timeout;
    private lastCommit: Date = new Date();
    private gitService: GitService;
    private statusBar: StatusBar;
    private aiService: HuggingFaceService;
    private activityState: ActivityState = {
        lastActivityTime: new Date(),
        changeCount: 0,
        pendingChanges: false
    };

    // Constants
    private readonly MIN_CHANGES_FOR_COMMIT = 3; // Minimum number of changes before considering a commit
    private readonly MAX_CHECK_INTERVAL = 300000; // 5 minutes in milliseconds
    
    // Dynamic settings
    private commitFrequencyMs: number = 60000; // Default 1 minute, will be updated from settings

    private constructor() {
        this.gitService = GitService.getInstance();
        this.statusBar = StatusBar.getInstance();
        this.aiService = HuggingFaceService.getInstance();
        this.setupActivityListeners();
    }

    private updateTimingSettings(): void {
        const config = vscode.workspace.getConfiguration('gitlivelog');
        const commitFrequencyMinutes = config.get<number>('commitFrequency', 1);
        
        // Convert minutes to milliseconds
        this.commitFrequencyMs = commitFrequencyMinutes * 60 * 1000;
        
        console.log(`GitLiveLog: Updated commit frequency to ${commitFrequencyMinutes} minutes`);
    }

    private setupActivityListeners() {
        // Listen for file changes
        vscode.workspace.onDidChangeTextDocument(() => {
            this.handleActivity('edit');
        });

        // Listen for file creation/deletion
        vscode.workspace.onDidCreateFiles(() => {
            this.handleActivity('create');
        });

        vscode.workspace.onDidDeleteFiles(() => {
            this.handleActivity('delete');
        });

        // Listen for file saves
        vscode.workspace.onDidSaveTextDocument(() => {
            this.handleActivity('save');
        });

        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('gitlivelog.commitFrequency')) {
                this.updateTimingSettings();
            }
        });
    }

    private handleActivity(type: 'edit' | 'create' | 'delete' | 'save') {
        this.activityState.lastActivityTime = new Date();
        this.activityState.changeCount++;
        this.activityState.pendingChanges = true;

        // Clear existing debounce timer
        if (this.activityState.debounceTimer) {
            clearTimeout(this.activityState.debounceTimer);
        }
    }

    public async startTracking(): Promise<void> {
        try {
            await this.gitService.initialize();

            // Update timing settings from configuration
            this.updateTimingSettings();

            // Start timer for regular checks
            if (this.commitCheckTimer) {
                clearInterval(this.commitCheckTimer);
            }

            // Preload AI model in the background
            const aiEnabled = vscode.workspace.getConfiguration('gitlivelog.ai').get<boolean>('enabled', true);
            if (aiEnabled) {
                this.aiService.preloadModel().catch(error => {
                    console.warn('Failed to preload AI model:', error);
                });
            }

            // Check exactly at the commit frequency interval
            this.commitCheckTimer = setInterval(async () => {
                const now = new Date();
                const timeSinceLastCommit = now.getTime() - this.lastCommit.getTime();

                // Only commit if we've waited the full interval
                if (timeSinceLastCommit >= this.commitFrequencyMs) {
                    await this.checkForCommit();
                }
            }, Math.min(this.commitFrequencyMs, this.MAX_CHECK_INTERVAL));

            const config = vscode.workspace.getConfiguration('gitlivelog');
            await config.update('isTracking', true, true);
            this.statusBar.updateStatus(true, this.lastCommit);

            // Reset activity state
            this.activityState = {
                lastActivityTime: new Date(),
                changeCount: 0,
                pendingChanges: false
            };

            vscode.window.showInformationMessage('GitLiveLog: Started tracking your coding activity');
        } catch (error) {
            console.error('Failed to start tracking:', error);
            vscode.window.showErrorMessage('GitLiveLog: Failed to start tracking. Please check Git configuration.');
        }
    }

    private async checkForCommit(): Promise<void> {
        try {
            // Only proceed if we have enough changes
            if (this.activityState.changeCount < this.MIN_CHANGES_FOR_COMMIT) {
                console.log('GitLiveLog: Not enough changes for commit');
                return;
            }

            const hasChanges = await this.gitService.hasUncommittedChanges();
            if (!hasChanges) {
                console.log('GitLiveLog: No changes to commit');
                return;
            }

            // Calculate time since last activity
            const now = new Date();
            const timeSinceLastActivity = now.getTime() - this.activityState.lastActivityTime.getTime();
            const timeSinceLastCommit = now.getTime() - this.lastCommit.getTime();
            
            // Ensure we've waited the full commit frequency
            if (timeSinceLastCommit < this.commitFrequencyMs) {
                console.log(`GitLiveLog: Waiting for full commit interval (${Math.round((this.commitFrequencyMs - timeSinceLastCommit) / 1000)}s remaining)`);
                return;
            }

            // Only commit if there has been recent activity
            if (timeSinceLastActivity > this.commitFrequencyMs) {
                console.log('GitLiveLog: No recent activity, skipping commit');
                return;
            }

            await this.commitChanges();
            
            // Reset activity state after successful commit
            this.activityState.changeCount = 0;
            this.activityState.pendingChanges = false;

        } catch (error) {
            console.error('Failed to check/commit changes:', error);
            vscode.window.showErrorMessage('GitLiveLog: Failed to commit changes. Please check Git configuration.');
        }
    }

    private async commitChanges(): Promise<void> {
        try {
            // Get the diff for AI analysis
            const diff = await this.gitService.getDiff();
            let commitMessage: string;

            try {
                // Generate AI-powered commit message
                commitMessage = await this.aiService.generateCommitMessage(diff);
                console.log('GitLiveLog: Generated AI commit message:', commitMessage);
            } catch (error) {
                console.warn('Failed to generate AI commit message:', error);
                commitMessage = `chore: activity update ${new Date().toISOString()}`;
            }
            
            await this.gitService.stageAll();
            await this.gitService.commit(commitMessage);
            
            // Push changes after commit
            try {
                await this.gitService.push();
                console.log('GitLiveLog: Successfully pushed changes');
            } catch (error) {
                console.error('GitLiveLog: Failed to push changes:', error);
                vscode.window.showWarningMessage('GitLiveLog: Changes committed but failed to push. Will retry on next sync.');
            }
            
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
            await this.checkForCommit();
            
            // Always try to push during force sync, even if there were no new commits
            try {
                await this.gitService.push();
                vscode.window.showInformationMessage('GitLiveLog: Successfully synced and pushed changes');
            } catch (error) {
                vscode.window.showErrorMessage('GitLiveLog: Failed to push changes. Please check your Git configuration.');
            }
        } catch (error) {
            console.error('Failed to force sync:', error);
            vscode.window.showErrorMessage('GitLiveLog: Failed to sync changes. Please check Git configuration.');
        }
    }

    public dispose(): void {
        if (this.commitCheckTimer) {
            clearInterval(this.commitCheckTimer);
            this.commitCheckTimer = undefined;
        }

        if (this.activityState.debounceTimer) {
            clearTimeout(this.activityState.debounceTimer);
            this.activityState.debounceTimer = undefined;
        }
    }

    public async stopTracking(): Promise<void> {
        if (this.commitCheckTimer) {
            clearInterval(this.commitCheckTimer);
            this.commitCheckTimer = undefined;
        }

        if (this.activityState.debounceTimer) {
            clearTimeout(this.activityState.debounceTimer);
            this.activityState.debounceTimer = undefined;
        }

        const config = vscode.workspace.getConfiguration('gitlivelog');
        await config.update('isTracking', false, true);
        this.statusBar.updateStatus(false);

        vscode.window.showInformationMessage('GitLiveLog: Stopped tracking your coding activity');
    }

    public static getInstance(): AutoCommit {
        if (!AutoCommit.instance) {
            AutoCommit.instance = new AutoCommit();
        }
        return AutoCommit.instance;
    }
}
