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
exports.StatusBar = void 0;
const vscode = __importStar(require("vscode"));
class StatusBar {
    static instance;
    statusBarItem;
    syncStatusItem;
    constructor() {
        // Create main status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBarItem.command = 'gitlivelog.showCommands';
        // Create sync status bar item
        this.syncStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
        this.syncStatusItem.command = 'gitlivelog.forceSync';
        this.updateStatus(false);
    }
    static getInstance() {
        if (!StatusBar.instance) {
            StatusBar.instance = new StatusBar();
        }
        return StatusBar.instance;
    }
    updateStatus(isTracking, lastSync) {
        if (isTracking) {
            this.statusBarItem.text = "$(radio-tower) GitLiveLog: Active";
            this.statusBarItem.tooltip = "Click to show GitLiveLog commands";
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            if (lastSync) {
                this.syncStatusItem.text = `$(sync) Last sync: ${this.formatTime(lastSync)}`;
                this.syncStatusItem.tooltip = "Click to force sync now";
                this.syncStatusItem.show();
            }
        }
        else {
            this.statusBarItem.text = "$(circle-slash) GitLiveLog: Inactive";
            this.statusBarItem.tooltip = "Click to show GitLiveLog commands";
            this.statusBarItem.backgroundColor = undefined;
            this.syncStatusItem.hide();
        }
        this.statusBarItem.show();
    }
    formatTime(date) {
        const now = new Date();
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000); // seconds
        if (diff < 60) {
            return 'just now';
        }
        else if (diff < 3600) {
            const minutes = Math.floor(diff / 60);
            return `${minutes}m ago`;
        }
        else if (diff < 86400) {
            const hours = Math.floor(diff / 3600);
            return `${hours}h ago`;
        }
        else {
            const days = Math.floor(diff / 86400);
            return `${days}d ago`;
        }
    }
    dispose() {
        this.statusBarItem.dispose();
        this.syncStatusItem.dispose();
    }
}
exports.StatusBar = StatusBar;
//# sourceMappingURL=StatusBar.js.map