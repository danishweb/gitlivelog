import * as vscode from 'vscode';
import { ActivitySummary } from '../tracking/types';

export class StatsPanel {
    public static currentPanel: StatsPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, summary: ActivitySummary) {
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.html = this._getWebviewContent(summary);
        this._setWebviewMessageListener(this._panel.webview);
    }

    public static show(extensionUri: vscode.Uri, summary: ActivitySummary) {
        if (StatsPanel.currentPanel) {
            StatsPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
            StatsPanel.currentPanel._updateContent(summary);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'gitLiveLogStats',
            'GitLiveLog Activity Stats',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri]
            }
        );

        StatsPanel.currentPanel = new StatsPanel(panel, summary);
    }

    private _updateContent(summary: ActivitySummary): void {
        this._panel.webview.html = this._getWebviewContent(summary);
    }

    private _getWebviewContent(summary: ActivitySummary): string {
        const timeRange = this._formatTimeRange(summary.startTime, summary.endTime);
        const fileStats = this._generateFileStats(summary);
        const languageStats = this._generateLanguageStats(summary);

        return `<!DOCTYPE html>
        <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; img-src https: data:;">
                <title>GitLiveLog Activity Stats</title>
                <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
                <style>
                    :root {
                        --container-padding: 20px;
                        --input-padding-vertical: 6px;
                        --input-padding-horizontal: 4px;
                    }

                    body {
                        padding: var(--container-padding);
                        color: var(--vscode-foreground);
                        font-size: var(--vscode-font-size);
                        font-weight: var(--vscode-font-weight);
                        font-family: var(--vscode-font-family);
                        background-color: var(--vscode-editor-background);
                    }

                    .container {
                        max-width: 1200px;
                        margin: 0 auto;
                    }

                    .stats-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                        gap: 20px;
                        margin: 20px 0;
                    }

                    .stats-card {
                        background: var(--vscode-editor-inactiveSelectionBackground);
                        border-radius: 4px;
                        padding: 16px;
                    }

                    .stats-card h2 {
                        margin-top: 0;
                        color: var(--vscode-titleBar-activeForeground);
                        font-size: calc(var(--vscode-font-size) * 1.2);
                    }

                    .chart-container {
                        position: relative;
                        height: 300px;
                        margin: 20px 0;
                    }

                    .file-list {
                        max-height: 300px;
                        overflow-y: auto;
                        margin: 10px 0;
                    }

                    .file-item {
                        display: flex;
                        justify-content: space-between;
                        padding: 4px 0;
                        border-bottom: 1px solid var(--vscode-input-border);
                    }

                    .file-name {
                        flex: 1;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        padding-right: 10px;
                    }

                    .file-stats {
                        flex-shrink: 0;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Activity Summary</h1>
                    <p>${timeRange}</p>

                    <div class="stats-grid">
                        <div class="stats-card">
                            <h2>Overview</h2>
                            <p>Total Events: ${summary.totalEvents}</p>
                            <div class="chart-container">
                                <canvas id="activityChart"></canvas>
                            </div>
                        </div>

                        <div class="stats-card">
                            <h2>Language Distribution</h2>
                            <div class="chart-container">
                                <canvas id="languageChart"></canvas>
                            </div>
                        </div>

                        ${fileStats}
                    </div>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    const ctx = document.getElementById('activityChart');
                    const languageCtx = document.getElementById('languageChart');

                    // Configure Chart.js defaults for VS Code theme
                    Chart.defaults.color = getComputedStyle(document.body).getPropertyValue('--vscode-foreground');
                    Chart.defaults.borderColor = getComputedStyle(document.body).getPropertyValue('--vscode-input-border');

                    ${this._generateChartData(summary)}

                    new Chart(ctx, {
                        type: 'bar',
                        data: activityData,
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    position: 'top',
                                }
                            }
                        }
                    });

                    new Chart(languageCtx, {
                        type: 'doughnut',
                        data: languageData,
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    position: 'right',
                                }
                            }
                        }
                    });
                </script>
            </body>
        </html>`;
    }

    private _formatTimeRange(startTime: number, endTime: number): string {
        const start = new Date(startTime);
        const end = new Date(endTime);
        return `${start.toLocaleDateString()} ${start.toLocaleTimeString()} - ${end.toLocaleDateString()} ${end.toLocaleTimeString()}`;
    }

    private _generateFileStats(summary: ActivitySummary): string {
        const fileEntries = Object.entries(summary.fileChanges)
            .map(([file, stats]) => ({
                file,
                ...stats,
                total: stats.changeCount + stats.saveCount
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);

        const chartData = fileEntries.slice(0, 5).map(entry => ({
            label: this._getShortFileName(entry.file),
            changes: entry.changeCount,
            saves: entry.saveCount
        }));

        return `
            <div class="stats-card">
                <h2>Most Active Files</h2>
                <div class="chart-container">
                    <canvas id="fileActivityChart"></canvas>
                </div>
                <div class="file-list">
                    ${fileEntries.map(entry => `
                        <div class="file-entry" title="${entry.file}">
                            <span class="file-name">${this._getShortFileName(entry.file)}</span>
                            <span class="file-stats">
                                <span class="stat">Changes: ${entry.changeCount}</span>
                                <span class="stat">Saves: ${entry.saveCount}</span>
                                ${entry.gitBranch ? `<span class="stat">Branch: ${entry.gitBranch}</span>` : ''}
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>
            <script>
                const fileCtx = document.getElementById('fileActivityChart').getContext('2d');
                new Chart(fileCtx, {
                    type: 'bar',
                    data: {
                        labels: ${JSON.stringify(chartData.map(d => d.label))},
                        datasets: [{
                            label: 'Changes',
                            data: ${JSON.stringify(chartData.map(d => d.changes))},
                            backgroundColor: 'rgba(54, 162, 235, 0.5)',
                            borderColor: 'rgba(54, 162, 235, 1)',
                            borderWidth: 1
                        }, {
                            label: 'Saves',
                            data: ${JSON.stringify(chartData.map(d => d.saves))},
                            backgroundColor: 'rgba(75, 192, 192, 0.5)',
                            borderColor: 'rgba(75, 192, 192, 1)',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: {
                                beginAtZero: true,
                                title: {
                                    display: true,
                                    text: 'Count'
                                }
                            }
                        }
                    }
                });
            </script>
        `;
    }

    private _generateLanguageStats(summary: ActivitySummary): string {
        const languages = Object.entries(summary.languages)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

        return languages.map(([lang, count]) => `
            <div class="language-item">
                <strong>${lang}:</strong> ${count} events
            </div>
        `).join('');
    }

    private _generateChartData(summary: ActivitySummary): string {
        const fileData = Object.entries(summary.fileChanges)
            .sort(([, a], [, b]) => b.changeCount - a.changeCount)
            .slice(0, 5);

        const languageData = Object.entries(summary.languages)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

        return `
            const activityData = {
                labels: ${JSON.stringify(fileData.map(([file]) => file.split('/').pop()))},
                datasets: [
                    {
                        label: 'Changes',
                        data: ${JSON.stringify(fileData.map(([, stats]) => stats.changeCount))},
                        backgroundColor: 'rgba(75, 192, 192, 0.5)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Saves',
                        data: ${JSON.stringify(fileData.map(([, stats]) => stats.saveCount))},
                        backgroundColor: 'rgba(153, 102, 255, 0.5)',
                        borderColor: 'rgba(153, 102, 255, 1)',
                        borderWidth: 1
                    }
                ]
            };

            const languageData = {
                labels: ${JSON.stringify(languageData.map(([lang]) => lang))},
                datasets: [{
                    data: ${JSON.stringify(languageData.map(([, count]) => count))},
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.5)',
                        'rgba(54, 162, 235, 0.5)',
                        'rgba(255, 206, 86, 0.5)',
                        'rgba(75, 192, 192, 0.5)',
                        'rgba(153, 102, 255, 0.5)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)'
                    ],
                    borderWidth: 1
                }]
            };
        `;
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'error':
                        vscode.window.showErrorMessage(message.text);
                        return;
                }
            },
            undefined,
            this._disposables
        );
    }

    public dispose() {
        StatsPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private _getShortFileName(file: string): string {
        return file.split('/').pop();
    }
}
