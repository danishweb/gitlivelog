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
exports.GitService = exports.GitConfig = exports.GitError = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
// Custom error types
class GitError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'GitError';
    }
}
exports.GitError = GitError;
// Configuration management
class GitConfig {
    static CONFIG_SECTION = 'gitlivelog';
    static getExcludePatterns() {
        return vscode.workspace.getConfiguration(this.CONFIG_SECTION).get('exclude', []);
    }
    static getCommitFrequency() {
        return vscode.workspace.getConfiguration(this.CONFIG_SECTION).get('commitFrequency', 30);
    }
    static getShowCommitDialog() {
        return vscode.workspace.getConfiguration(this.CONFIG_SECTION).get('showCommitDialog', false);
    }
}
exports.GitConfig = GitConfig;
class GitService {
    static instance;
    gitAPI;
    currentRepository;
    repositories = new Map();
    commandQueue = [];
    isProcessingQueue = false;
    cachedChanges = new Map();
    CACHE_TIMEOUT = 5000; // 5 seconds
    // State management
    repositoryState = {
        isInitialized: false,
        lastSync: null,
        pendingChanges: 0
    };
    stateChangeEmitter = new vscode.EventEmitter();
    onStateChange = this.stateChangeEmitter.event;
    constructor() {
        console.log('GitService: Initializing...');
    }
    async findGitPath() {
        console.log('GitService: Looking for Git installation...');
        // First check VS Code settings
        const config = vscode.workspace.getConfiguration('git');
        let gitPath = config.get('path');
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
            }
            catch (error) {
                // Ignore errors checking paths
            }
        }
        // If git is in PATH, just return 'git'
        try {
            return 'git';
        }
        catch (error) {
            this.handleError(error, 'find Git installation');
            return undefined;
        }
    }
    getPlatformGitPaths(platform) {
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
    handleError(error, operation) {
        const message = error instanceof Error ? error.message : String(error);
        throw new GitError(`Failed to ${operation}: ${message}`, 'GIT_OP_FAILED');
    }
    async initialize() {
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
                }
                catch (error) {
                    retryCount++;
                    if (retryCount === maxRetries) {
                        throw error;
                    }
                    console.log(`GitService: Initialization attempt ${retryCount} failed, retrying in ${retryDelay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
            }
        }
        catch (error) {
            this.handleError(error, 'initialize Git service');
        }
    }
    async initializeWithRetry() {
        const extension = vscode.extensions.getExtension('vscode.git');
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
    async isGitRepository(path) {
        try {
            const gitDir = vscode.Uri.file(vscode.Uri.joinPath(vscode.Uri.file(path), '.git').fsPath);
            await vscode.workspace.fs.stat(gitDir);
            return true;
        }
        catch {
            return false;
        }
    }
    async initializeRepository(path) {
        try {
            // Use VS Code's built-in Git commands
            await vscode.commands.executeCommand('git.init');
            // Wait a bit for the repository to be initialized
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Create initial commit
            await vscode.commands.executeCommand('git.stageAll');
            await vscode.commands.executeCommand('git.commit', 'Initial commit by GitLiveLog');
        }
        catch (error) {
            console.error('Failed to initialize repository:', error);
            throw new Error('Failed to initialize Git repository');
        }
    }
    static getInstance() {
        if (!GitService.instance) {
            GitService.instance = new GitService();
        }
        return GitService.instance;
    }
    async setRepository(workspaceRoot) {
        if (!this.gitAPI) {
            throw new Error('Git API not initialized');
        }
        console.log('GitService: Setting repository for workspace:', workspaceRoot);
        this.currentRepository = this.gitAPI.repositories.find(repo => repo.rootUri.fsPath === workspaceRoot);
        if (!this.currentRepository) {
            throw new Error('No Git repository found in workspace');
        }
        // Verify repository access
        await this.currentRepository.status();
        console.log('GitService: Repository access verified');
    }
    async hasUncommittedChanges(excludePatterns = []) {
        if (!this.currentRepository) {
            throw new Error('Repository not initialized');
        }
        await this.currentRepository.status();
        const state = this.currentRepository.state;
        // Helper function to check if a file matches exclude patterns
        const isExcluded = (filePath) => {
            return excludePatterns.some(pattern => {
                if (pattern.startsWith('*')) {
                    const extension = pattern.slice(1);
                    return filePath.endsWith(extension);
                }
                return filePath.includes(pattern);
            });
        };
        // Filter out excluded files
        const workingChanges = state.workingTreeChanges.filter(change => !isExcluded(change.uri.fsPath));
        const indexChanges = state.indexChanges.filter(change => !isExcluded(change.uri.fsPath));
        return workingChanges.length > 0 || indexChanges.length > 0;
    }
    async stageAll() {
        if (!this.currentRepository) {
            throw new Error('Repository not initialized');
        }
        const config = vscode.workspace.getConfiguration('gitlivelog');
        const excludePatterns = config.get('exclude', []);
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
    async commit(message) {
        if (!this.currentRepository) {
            throw new GitError('Repository not initialized', 'REPO_NOT_INIT');
        }
        await this.currentRepository.commit(message);
    }
    async push() {
        if (!this.currentRepository) {
            throw new GitError('Repository not initialized', 'REPO_NOT_INIT');
        }
        try {
            // Use VS Code's built-in Git commands for pushing
            await vscode.commands.executeCommand('git.push');
            console.log('GitService: Successfully pushed changes');
        }
        catch (error) {
            console.error('GitService: Failed to push changes:', error);
            throw new GitError('Failed to push changes', 'PUSH_FAILED');
        }
    }
    async getChangedFiles() {
        if (!this.currentRepository) {
            throw new Error('Repository not initialized');
        }
        await this.currentRepository.status();
        const state = this.currentRepository.state;
        const config = vscode.workspace.getConfiguration('gitlivelog');
        const excludePatterns = config.get('exclude', []);
        // Helper function to check if a file matches exclude patterns
        const isExcluded = (filePath) => {
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
    async getDiff() {
        if (!this.currentRepository) {
            throw new GitError('Repository not initialized', 'REPO_NOT_INIT');
        }
        try {
            // Get all changes, including staged and unstaged
            const changes = await this.currentRepository.diff(true);
            return changes || '';
        }
        catch (error) {
            console.error('Failed to get git diff:', error);
            throw new GitError('Failed to get changes', 'DIFF_FAILED');
        }
    }
}
exports.GitService = GitService;
//# sourceMappingURL=git.js.map