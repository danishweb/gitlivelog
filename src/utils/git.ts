import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface GitExtension {
    getAPI(version: number): GitAPI;
}

export interface GitAPI {
    repositories: Repository[];
}

export interface Repository {
    rootUri: vscode.Uri;
    state: RepositoryState;
    add: (paths: string[]) => Promise<void>;
    commit: (message: string) => Promise<void>;
    status: () => Promise<void>;
}

export interface RepositoryState {
    workingTreeChanges: GitChange[];
    indexChanges: GitChange[];
    mergeChanges: GitChange[];
    HEAD?: { name: string };
}

export interface GitChange {
    uri: vscode.Uri;
    status: number;
}

export class GitService {
    private static instance: GitService;
    private gitAPI: GitAPI | undefined;
    private currentRepository: Repository | undefined;

    private constructor() {
        console.log('GitService: Initializing...');
    }

    private findGitPath(): string | undefined {
        console.log('GitService: Looking for Git installation...');
        
        // First check VS Code settings
        const config = vscode.workspace.getConfiguration('git');
        let gitPath = config.get<string>('path');
        
        if (gitPath) {
            console.log('GitService: Found Git path in VS Code settings:', gitPath);
            return gitPath;
        }

        // Common Git installation paths on Windows
        const commonPaths = [
            'C:\\Program Files\\Git\\bin\\git.exe',
            'C:\\Program Files (x86)\\Git\\bin\\git.exe',
            'C:\\Program Files\\Git\\cmd\\git.exe',
            'C:\\Program Files (x86)\\Git\\cmd\\git.exe'
        ];

        // Check if Git is in PATH
        const pathEnv = process.env.PATH || '';
        const pathDirs = pathEnv.split(path.delimiter);
        
        // Add potential Git paths from PATH environment variable
        pathDirs.forEach(dir => {
            const gitExePath = path.join(dir, 'git.exe');
            if (!commonPaths.includes(gitExePath)) {
                commonPaths.push(gitExePath);
            }
        });

        // Try to find Git in common locations
        for (const path of commonPaths) {
            try {
                if (fs.existsSync(path)) {
                    console.log('GitService: Found Git at:', path);
                    return path;
                }
            } catch (error) {
                // Ignore errors checking paths
            }
        }

        console.log('GitService: Checking if git is available in PATH...');
        try {
            // If git is in PATH, just return 'git'
            return 'git';
        } catch (error) {
            console.error('GitService: Git not found in common locations');
            return undefined;
        }
    }

    public async initialize(): Promise<void> {
        try {
            console.log('GitService: Looking for Git extension...');
            
            // Try to initialize with retries
            let retryCount = 0;
            const maxRetries = 3;
            const retryDelay = 1000; // 1 second

            while (retryCount < maxRetries) {
                try {
                    const extension = vscode.extensions.getExtension<GitExtension>('vscode.git');
                    if (!extension) {
                        throw new Error('Git extension not found');
                    }

                    if (!extension.isActive) {
                        console.log('GitService: Activating Git extension...');
                        await extension.activate();
                        // Wait a bit after activation
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }

                    console.log('GitService: Getting Git API...');
                    const gitExtension = extension.exports;
                    this.gitAPI = gitExtension.getAPI(1);

                    // Find Git installation
                    const gitPath = this.findGitPath();
                    if (!gitPath) {
                        throw new Error('Git not found. Please install Git and configure its path in VS Code settings.');
                    }

                    // Update VS Code Git path setting if needed
                    const config = vscode.workspace.getConfiguration('git');
                    if (!config.get('path')) {
                        console.log('GitService: Updating VS Code Git path setting to:', gitPath);
                        await config.update('path', gitPath, true);
                    }

                    // Wait for workspace to be ready
                    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                        console.log('GitService: Waiting for workspace to be ready...');
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                            throw new Error('No workspace folder open');
                        }
                    }

                    // Try to initialize repository
                    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
                    
                    // Check if .git directory exists
                    if (!await this.isGitRepository(workspaceRoot)) {
                        console.log('GitService: Initializing new Git repository...');
                        await this.initializeRepository(workspaceRoot);
                    }

                    await this.setRepository(workspaceRoot);
                    console.log('GitService: Successfully initialized');
                    return;

                } catch (error) {
                    retryCount++;
                    if (retryCount === maxRetries) {
                        throw error;
                    }
                    console.log(`GitService: Initialization attempt ${retryCount} failed, retrying in ${retryDelay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
            }
        } catch (error) {
            console.error('GitService: Failed to initialize Git API:', error);
            throw error;
        }
    }

    private async isGitRepository(path: string): Promise<boolean> {
        try {
            const gitDir = vscode.Uri.file(vscode.Uri.joinPath(vscode.Uri.file(path), '.git').fsPath);
            await vscode.workspace.fs.stat(gitDir);
            return true;
        } catch {
            return false;
        }
    }

    private async initializeRepository(path: string): Promise<void> {
        try {
            // Use VS Code's built-in Git commands
            await vscode.commands.executeCommand('git.init');
            
            // Wait a bit for the repository to be initialized
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Create initial commit
            await vscode.commands.executeCommand('git.stageAll');
            await vscode.commands.executeCommand('git.commit', 'Initial commit by GitLiveLog');
        } catch (error) {
            console.error('Failed to initialize repository:', error);
            throw new Error('Failed to initialize Git repository');
        }
    }

    public static getInstance(): GitService {
        if (!GitService.instance) {
            GitService.instance = new GitService();
        }
        return GitService.instance;
    }

    private async setRepository(workspaceRoot: string): Promise<void> {
        if (!this.gitAPI) {
            throw new Error('Git API not initialized');
        }

        console.log('GitService: Setting repository for workspace:', workspaceRoot);
        this.currentRepository = this.gitAPI.repositories.find(
            repo => repo.rootUri.fsPath === workspaceRoot
        );

        if (!this.currentRepository) {
            throw new Error('No Git repository found in workspace');
        }

        // Verify repository access
        await this.currentRepository.status();
        console.log('GitService: Repository access verified');
    }

    public async hasUncommittedChanges(excludePatterns: string[] = []): Promise<boolean> {
        if (!this.currentRepository) {
            throw new Error('Repository not initialized');
        }

        await this.currentRepository.status();
        const state = this.currentRepository.state;
        
        // Helper function to check if a file matches exclude patterns
        const isExcluded = (filePath: string): boolean => {
            return excludePatterns.some(pattern => {
                if (pattern.startsWith('*')) {
                    const extension = pattern.slice(1);
                    return filePath.endsWith(extension);
                }
                return filePath.includes(pattern);
            });
        };

        // Filter out excluded files
        const workingChanges = state.workingTreeChanges.filter(
            change => !isExcluded(change.uri.fsPath)
        );
        const indexChanges = state.indexChanges.filter(
            change => !isExcluded(change.uri.fsPath)
        );

        return workingChanges.length > 0 || indexChanges.length > 0;
    }

    public async stageAll(): Promise<void> {
        if (!this.currentRepository) {
            throw new Error('Repository not initialized');
        }

        const config = vscode.workspace.getConfiguration('gitlivelog');
        const excludePatterns = config.get<string[]>('exclude', []);
        
        const state = this.currentRepository.state;
        const changes = state.workingTreeChanges
            .filter(change => !excludePatterns.some(pattern => {
                if (pattern.startsWith('*')) {
                    const extension = pattern.slice(1);
                    return change.uri.fsPath.endsWith(extension);
                }
                return change.uri.fsPath.includes(pattern);
            }))
            .map(change => change.uri.fsPath);
        
        if (changes.length > 0) {
            await this.currentRepository.add(changes);
        }
    }

    public async commit(message: string): Promise<void> {
        if (!this.currentRepository) {
            throw new Error('Repository not initialized');
        }

        await this.currentRepository.commit(message);
    }

    public async getChangedFiles(): Promise<string[]> {
        if (!this.currentRepository) {
            throw new Error('Repository not initialized');
        }

        await this.currentRepository.status();
        const state = this.currentRepository.state;
        
        const config = vscode.workspace.getConfiguration('gitlivelog');
        const excludePatterns = config.get<string[]>('exclude', []);

        // Helper function to check if a file matches exclude patterns
        const isExcluded = (filePath: string): boolean => {
            return excludePatterns.some(pattern => {
                if (pattern.startsWith('*')) {
                    const extension = pattern.slice(1);
                    return filePath.endsWith(extension);
                }
                return filePath.includes(pattern);
            });
        };

        // Get all changed files (both working tree and index)
        const allChanges = [
            ...state.workingTreeChanges,
            ...state.indexChanges
        ]
        .filter(change => !isExcluded(change.uri.fsPath))
        .map(change => {
            // Get relative path for better readability
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(change.uri);
            if (workspaceFolder) {
                return vscode.workspace.asRelativePath(change.uri);
            }
            return change.uri.fsPath;
        });

        // Remove duplicates
        return [...new Set(allChanges)];
    }
}
