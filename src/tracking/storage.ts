import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ActivityEvent, ActivitySummary, StorageManager } from './types';

export class FileStorageManager implements StorageManager {
    private logLocation: string;
    private currentLogFile: string = '';

    constructor() {
        const config = vscode.workspace.getConfiguration('gitlivelog');
        this.logLocation = config.get<string>('logLocation', '');
        this.updateCurrentLogFile();
    }

    private updateCurrentLogFile() {
        const date = new Date();
        const fileName = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}.json`;
        this.currentLogFile = path.join(this.logLocation, fileName);
    }

    async saveActivity(event: ActivityEvent): Promise<void> {
        if (!this.logLocation) {
            throw new Error('Log location not configured');
        }

        try {
            // Ensure directory exists
            await fs.mkdir(path.dirname(this.currentLogFile), { recursive: true });

            // Read existing data or create new array
            let events: ActivityEvent[] = [];
            try {
                const data = await fs.readFile(this.currentLogFile, 'utf-8');
                events = JSON.parse(data);
            } catch (error) {
                // File doesn't exist or is invalid, start with empty array
            }

            // Add new event and save
            events.push(event);
            await fs.writeFile(this.currentLogFile, JSON.stringify(events, null, 2));
        } catch (error) {
            console.error('Failed to save activity:', error);
            throw error;
        }
    }

    async getActivitySummary(startTime: number, endTime: number): Promise<ActivitySummary> {
        if (!this.logLocation) {
            throw new Error('Log location not configured');
        }

        const summary: ActivitySummary = {
            startTime,
            endTime,
            totalEvents: 0,
            fileChanges: {},
            languages: {}
        };

        try {
            const files = await fs.readdir(this.logLocation);
            for (const file of files) {
                if (!file.endsWith('.json')) continue;

                const data = await fs.readFile(path.join(this.logLocation, file), 'utf-8');
                const events: ActivityEvent[] = JSON.parse(data);

                for (const event of events) {
                    if (event.timestamp >= startTime && event.timestamp <= endTime) {
                        summary.totalEvents++;

                        // Track file changes
                        if (!summary.fileChanges[event.file]) {
                            summary.fileChanges[event.file] = {
                                changeCount: 0,
                                saveCount: 0,
                                language: event.language
                            };
                        }

                        if (event.type === 'fileChanged') {
                            summary.fileChanges[event.file].changeCount++;
                        } else if (event.type === 'fileSaved') {
                            summary.fileChanges[event.file].saveCount++;
                        }

                        // Track languages
                        if (event.language) {
                            summary.languages[event.language] = (summary.languages[event.language] || 0) + 1;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Failed to get activity summary:', error);
            throw error;
        }

        return summary;
    }
}
