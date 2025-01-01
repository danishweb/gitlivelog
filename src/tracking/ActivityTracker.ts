import * as vscode from 'vscode';
import { ActivityEvent, ActivityEventType, ActivitySummary, StorageManager } from './types';
import { FileStorageManager } from './storage';

export class ActivityTracker {
    private static instance: ActivityTracker;
    private isTracking: boolean = false;
    private disposables: vscode.Disposable[] = [];
    private storage: StorageManager;
    private statusBarItem: vscode.StatusBarItem;

    private constructor() {
        this.storage = new FileStorageManager();
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.updateStatusBar(false);
        this.statusBarItem.show();
    }

    public static getInstance(): ActivityTracker {
        if (!ActivityTracker.instance) {
            ActivityTracker.instance = new ActivityTracker();
        }
        return ActivityTracker.instance;
    }

    private updateStatusBar(isTracking: boolean): void {
        this.statusBarItem.text = isTracking ? "$(pulse) GitLiveLog: Active" : "$(circle-slash) GitLiveLog: Paused";
        this.statusBarItem.tooltip = isTracking ? 
            "Click to pause activity tracking" : 
            "Click to resume activity tracking";
        this.statusBarItem.command = isTracking ? 
            'gitlivelog.pauseTracking' : 
            'gitlivelog.startTracking';
    }

    public startTracking(): void {
        if (this.isTracking) return;

        // Track file changes
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(async (e) => {
                if (e.document.uri.scheme !== 'file') return;

                const event: ActivityEvent = {
                    timestamp: Date.now(),
                    type: ActivityEventType.FILE_CHANGED,
                    file: e.document.fileName,
                    language: e.document.languageId,
                    lineNumber: e.document.lineCount
                };

                await this.storage.saveActivity(event);
            })
        );

        // Track file saves
        this.disposables.push(
            vscode.workspace.onDidSaveTextDocument(async (document) => {
                if (document.uri.scheme !== 'file') return;

                const event: ActivityEvent = {
                    timestamp: Date.now(),
                    type: ActivityEventType.FILE_SAVED,
                    file: document.fileName,
                    language: document.languageId,
                    lineNumber: document.lineCount
                };

                await this.storage.saveActivity(event);
            })
        );

        // Track file opens
        this.disposables.push(
            vscode.workspace.onDidOpenTextDocument(async (document) => {
                if (document.uri.scheme !== 'file') return;

                const event: ActivityEvent = {
                    timestamp: Date.now(),
                    type: ActivityEventType.FILE_OPENED,
                    file: document.fileName,
                    language: document.languageId,
                    lineNumber: document.lineCount
                };

                await this.storage.saveActivity(event);
            })
        );

        // Track file closes
        this.disposables.push(
            vscode.workspace.onDidCloseTextDocument(async (document) => {
                if (document.uri.scheme !== 'file') return;

                const event: ActivityEvent = {
                    timestamp: Date.now(),
                    type: ActivityEventType.FILE_CLOSED,
                    file: document.fileName,
                    language: document.languageId,
                    lineNumber: document.lineCount
                };

                await this.storage.saveActivity(event);
            })
        );

        this.isTracking = true;
        this.updateStatusBar(true);
    }

    public pauseTracking(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.isTracking = false;
        this.updateStatusBar(false);
    }

    public async getActivitySummary(startTime: number, endTime: number): Promise<ActivitySummary> {
        return await this.storage.getActivitySummary(startTime, endTime);
    }

    public dispose(): void {
        this.pauseTracking();
        this.statusBarItem.dispose();
    }
}
