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
exports.AutoCommit = void 0;
const vscode = __importStar(require("vscode"));
const git_1 = require("../utils/git");
const StatusBar_1 = require("../ui/StatusBar");
const HuggingFaceService_1 = require("../ai/HuggingFaceService");
class AutoCommit {
    static instance;
    commitCheckTimer;
    lastCommit = new Date();
    gitService;
    statusBar;
    aiService;
    activityState = {
        lastActivityTime: new Date(),
        changeCount: 0,
        pendingChanges: false
    };
    // Constants
    MIN_CHANGES_FOR_COMMIT = 3; // Minimum number of changes before considering a commit
    MAX_CHECK_INTERVAL = 300000; // 5 minutes in milliseconds
    // Dynamic settings
    commitFrequencyMs = 60000; // Default 1 minute, will be updated from settings
    constructor() {
        this.gitService = git_1.GitService.getInstance();
        this.statusBar = StatusBar_1.StatusBar.getInstance();
        this.aiService = HuggingFaceService_1.HuggingFaceService.getInstance();
        this.setupActivityListeners();
    }
    updateTimingSettings() {
        const config = vscode.workspace.getConfiguration('gitlivelog');
        const commitFrequencyMinutes = config.get('commitFrequency', 1);
        // Convert minutes to milliseconds
        this.commitFrequencyMs = commitFrequencyMinutes * 60 * 1000;
        console.log(`GitLiveLog: Updated commit frequency to ${commitFrequencyMinutes} minutes`);
    }
    setupActivityListeners() {
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
    handleActivity(type) {
        this.activityState.lastActivityTime = new Date();
        this.activityState.changeCount++;
        this.activityState.pendingChanges = true;
        // Clear existing debounce timer
        if (this.activityState.debounceTimer) {
            clearTimeout(this.activityState.debounceTimer);
        }
    }
    async startTracking() {
        try {
            await this.gitService.initialize();
            // Update timing settings from configuration
            this.updateTimingSettings();
            // Start timer for regular checks
            if (this.commitCheckTimer) {
                clearInterval(this.commitCheckTimer);
            }
            // Preload AI model in the background
            const aiEnabled = vscode.workspace.getConfiguration('gitlivelog.ai').get('enabled', true);
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
        }
        catch (error) {
            console.error('Failed to start tracking:', error);
            vscode.window.showErrorMessage('GitLiveLog: Failed to start tracking. Please check Git configuration.');
        }
    }
    async checkForCommit() {
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
        }
        catch (error) {
            console.error('Failed to check/commit changes:', error);
            vscode.window.showErrorMessage('GitLiveLog: Failed to commit changes. Please check Git configuration.');
        }
    }
    async commitChanges() {
        try {
            // Get the diff for AI analysis
            const diff = await this.gitService.getDiff();
            let commitMessage;
            try {
                // Generate AI-powered commit message
                commitMessage = await this.aiService.generateCommitMessage(diff);
                console.log('GitLiveLog: Generated AI commit message:', commitMessage);
            }
            catch (error) {
                console.warn('Failed to generate AI commit message:', error);
                commitMessage = `chore: activity update ${new Date().toISOString()}`;
            }
            await this.gitService.stageAll();
            await this.gitService.commit(commitMessage);
            // Push changes after commit
            try {
                await this.gitService.push();
                console.log('GitLiveLog: Successfully pushed changes');
            }
            catch (error) {
                console.error('GitLiveLog: Failed to push changes:', error);
                vscode.window.showWarningMessage('GitLiveLog: Changes committed but failed to push. Will retry on next sync.');
            }
            this.lastCommit = new Date();
            this.statusBar.updateStatus(true, this.lastCommit);
            console.log('GitLiveLog: Successfully committed changes');
        }
        catch (error) {
            console.error('Failed to commit changes:', error);
            throw error;
        }
    }
    async forceSync() {
        try {
            await this.checkForCommit();
            // Always try to push during force sync, even if there were no new commits
            try {
                await this.gitService.push();
                vscode.window.showInformationMessage('GitLiveLog: Successfully synced and pushed changes');
            }
            catch (error) {
                vscode.window.showErrorMessage('GitLiveLog: Failed to push changes. Please check your Git configuration.');
            }
        }
        catch (error) {
            console.error('Failed to force sync:', error);
            vscode.window.showErrorMessage('GitLiveLog: Failed to sync changes. Please check Git configuration.');
        }
    }
    dispose() {
        if (this.commitCheckTimer) {
            clearInterval(this.commitCheckTimer);
            this.commitCheckTimer = undefined;
        }
        if (this.activityState.debounceTimer) {
            clearTimeout(this.activityState.debounceTimer);
            this.activityState.debounceTimer = undefined;
        }
    }
    async stopTracking() {
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
    static getInstance() {
        if (!AutoCommit.instance) {
            AutoCommit.instance = new AutoCommit();
        }
        return AutoCommit.instance;
    }
}
exports.AutoCommit = AutoCommit;
//# sourceMappingURL=AutoCommit.js.map