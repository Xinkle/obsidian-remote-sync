# Project Renaming: Xync to Remote Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename all occurrences of "xync" to "remote-sync" or "Remote Sync" across the codebase, including IDs, class names, file names, and project metadata.

**Architecture:** Systematic search and replace using case-appropriate mapping.

**Tech Stack:** TypeScript, Obsidian Plugin API, Node.js (package.json).

---

### Task 1: Update Metadata Files

**Files:**
- Modify: `package.json`
- Modify: `manifest.json`

- [ ] **Step 1: Update package.json**
  - Name: `xync-obsidian` -> `obsidian-remote-sync`
  - Version: `1.1.4` -> `1.2.0`
  - Deploy script: `~/Xync/.obsidian/plugins/xync-obsidian` -> `~/Xync/.obsidian/plugins/obsidian-remote-sync`
- [ ] **Step 2: Update manifest.json**
  - ID: `xync-obsidian` -> `obsidian-remote-sync`
  - Name: `Xync Sync` -> `Remote Sync`
  - Version: `1.1.4` -> `1.2.0`
  - Author: `Xync` -> `Remote Sync`

### Task 2: Update Source Code (src/)

**Files:**
- Modify: `src/main.ts`
- Modify: `src/settings.ts`
- Modify: `src/LogView.ts`
- Modify: `src/sync.ts`

- [ ] **Step 1: Global case-insensitive replacement in src/**
  - `XyncPlugin` -> `RemoteSyncPlugin`
  - `XyncLogView` -> `RemoteSyncLogView`
  - `XyncSettingTab` -> `RemoteSyncSettingTab`
  - `XyncPluginSettings` -> `RemoteSyncPluginSettings`
  - `VIEW_TYPE_XYNC_LOG` -> `VIEW_TYPE_REMOTE_SYNC_LOG`
  - `xync-log-view` -> `remote-sync-log-view`
  - `xync_sync_state.json` -> `remote_sync_state.json`
  - `Xync Sync` -> `Remote Sync`
  - `Xync` -> `Remote Sync` (where appropriate for display)

### Task 3: Verification and Build

- [ ] **Step 1: Run build**
  - Command: `npm run build`
  - Expected: Build completes without errors.

### Task 4: Commit Changes

- [ ] **Step 1: Commit with git-commit skill**
  - Message: `chore: rename project from xync to remote-sync and bump version to 1.2.0`
