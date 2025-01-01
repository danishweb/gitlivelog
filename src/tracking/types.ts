import * as vscode from 'vscode';

export interface ActivityEvent {
    timestamp: number;
    type: ActivityEventType;
    file: string;
    lineNumber?: number;
    charNumber?: number;
    language?: string;
    gitBranch?: string;
}

export enum ActivityEventType {
    FILE_OPENED = 'fileOpened',
    FILE_CHANGED = 'fileChanged',
    FILE_SAVED = 'fileSaved',
    FILE_CLOSED = 'fileClosed'
}

export interface ActivitySummary {
    startTime: number;
    endTime: number;
    totalEvents: number;
    fileChanges: {
        [filename: string]: {
            changeCount: number;
            saveCount: number;
            language?: string;
        }
    };
    languages: {
        [language: string]: number;
    };
}

export interface StorageManager {
    saveActivity(event: ActivityEvent): Promise<void>;
    getActivitySummary(startTime: number, endTime: number): Promise<ActivitySummary>;
}
