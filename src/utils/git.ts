import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Custom error types
export class GitError extends Error {
    constructor(message: string, public readonly code: string) {
        super(message);
        this.name = 'GitError';
    }
}

// Configuration management
export class GitConfig {
    private static readonly CONFIG_SECTION = 'gitlivelog';
    
    static getExcludePatterns(): string[] {
        return vscode.workspace.getConfiguration(this.CONFIG_SECTION).get('exclude', []);
    }
    
    static getCommitFrequency(): number {
        return vscode.workspace.getConfiguration(this.CONFIG_SECTION).get('commitFrequency', 30);
    }

    static getShowCommitDialog(): boolean {
        return vscode.workspace.getConfiguration(this.CONFIG_SECTION).get('showCommitDialog', false);
    }
}

// Git-related interfaces
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

interface GitDiagnostics {
    gitVersion: string;
    repositoryStatus: string;
    lastSync: Date | null;
    pendingChanges: number;
}

export class GitService {
    private static instance: GitService;
    private gitAPI: GitAPI | undefined;
    private currentRepository: Repository | undefined;
    private repositories: Map<string, Repository> = new Map();
    private commandQueue: Array<() => Promise<void>> = [];
    private isProcessingQueue = false;
    private cachedChanges: Map<string, { changes: GitChange[], timestamp: number }> = new Map();
    private readonly CACHE_TIMEOUT = 5000; // 5 seconds

    // State management
    private repositoryState: {
        isInitialized: boolean;
        lastSync: Date | null;
        pendingChanges: number;
    } = {
        isInitialized: false,
        lastSync: null,
        pendingChanges: 0
    };

    private stateChangeEmitter = new vscode.EventEmitter<void>();
    public readonly onStateChange = this.stateChangeEmitter.event;

    private constructor() {
        console.log('GitService: Initializing...');
    }

    private async findGitPath(): Promise<string | undefined> {
        console.log('GitService: Looking for Git installation...');
        
        // First check VS Code settings
        const config = vscode.workspace.getConfiguration('git');
        let gitPath = config.get<string>('path');
        
        if (gitPath) {
            console.log('GitService: Found Git path in VS Code settings:', gitPath);
            return gitPath;
        }

        // Get platform-specific Git paths
        const platform = os.platform();
        const gitPaths = this.getPlatformGitPaths(platform);

        // Add paths from PATH environment variable
        const pathEnv = process.env.PATH || '';
        const pathDirs = pathEnv.split(path.delimiter);
        const executableName = platform === 'win32' ? 'git.exe' : 'git';
        
        pathDirs.forEach(dir => {
            const gitExePath = path.join(dir, executableName);
            if (!gitPaths.includes(gitExePath)) {
                gitPaths.push(gitExePath);
            }
        });

        // Try to find Git in all possible locations
        for (const gitPath of gitPaths) {
            try {
                if (fs.existsSync(gitPath)) {
                    console.log('GitService: Found Git at:', gitPath);
                    return gitPath;
                }
            } catch (error) {
                // Ignore errors checking paths
            }
        }

        // If git is in PATH, just return 'git'
        try {
            return 'git';
        } catch (error) {
            this.handleError(error, 'find Git installation');
            return undefined;
        }
    }

    private getPlatformGitPaths(platform: string): string[] {
        switch (platform) {
            case 'win32':
                return [
                    'C:\\Program Files\\Git\\bin\\git.exe',
                    'C:\\Program Files (x86)\\Git\\bin\\git.exe',
                    'C:\\Program Files\\Git\\cmd\\git.exe',
                    'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
                    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Git', 'bin', 'git.exe'),
                    path.join(os.homedir(), 'scoop', 'apps', 'git', 'current', 'bin', 'git.exe')
                ];
            case 'darwin':
                return [
                    '/usr/bin/git',
                    '/usr/local/bin/git',
                    '/opt/homebrew/bin/git'
                ];
            default: // Linux and others
                return [
                    '/usr/bin/git',
                    '/usr/local/bin/git',
                    '/opt/local/bin/git'
                ];
        }
    }

    private handleError(error: unknown, operation: string): never {
        const message = error instanceof Error ? error.message : String(error);
        throw new GitError(`Failed to ${operation}: ${message}`, 'GIT_OP_FAILED');
    }

    public async initialize(): Promise<void> {
        try {
            console.log('GitService: Looking for Git extension...');
            
            let retryCount = 0;
            const maxRetries = 3;
            const retryDelay = 1000;

            while (retryCount < maxRetries) {
                try {
                    await this.initializeWithRetry();
                    this.repositoryState.isInitialized = true;
                    this.stateChangeEmitter.fire();
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
            this.handleError(error, 'initialize Git service');
        }
    }

    private async initializeWithRetry(): Promise<void> {
        const extension = vscode.extensions.getExtension<GitExtension>('vscode.git');
        if (!extension) {
            throw new GitError('Git extension not found', 'GIT_EXT_NOT_FOUND');
        }

        if (!extension.isActive) {
            await extension.activate();
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        this.gitAPI = extension.exports.getAPI(1);
        const gitPath = await this.findGitPath();
        
        if (!gitPath) {
            throw new GitError('Git not found. Please install Git and configure its path.', 'GIT_NOT_FOUND');
        }

        const config = vscode.workspace.getConfiguration('git');
        if (!config.get('path')) {
            await config.update('path', gitPath, true);
        }

        if (!vscode.workspace.workspaceFolders?.length) {
            throw new GitError('No workspace folder open', 'NO_WORKSPACE');
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        if (!await this.isGitRepository(workspaceRoot)) {
            await this.initializeRepository(workspaceRoot);
        }

        await this.setRepository(workspaceRoot);
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
            throw new GitError('Repository not initialized', 'REPO_NOT_INIT');
        }

        await this.currentRepository.commit(message);
    }

    public async push(): Promise<void> {
        if (!this.currentRepository) {
            throw new GitError('Repository not initialized', 'REPO_NOT_INIT');
        }

        try {
            // Use VS Code's built-in Git commands for pushing
            await vscode.commands.executeCommand('git.push');
            console.log('GitService: Successfully pushed changes');
        } catch (error) {
            console.error('GitService: Failed to push changes:', error);
            throw new GitError('Failed to push changes', 'PUSH_FAILED');
        }
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
