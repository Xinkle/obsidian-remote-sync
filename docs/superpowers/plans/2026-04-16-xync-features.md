# Xync Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add auto-sync toggle, tabbed sidebar logs (Sync/Plugin), and manual sync buttons (Forward, Backward, Sync, Cancel) to the Xync plugin.

**Architecture:** 
- **Settings:** New `autoSyncEnabled` boolean setting.
- **LogView:** Refactored to use a tabbed interface and a button control bar.
- **Main/Sync:** Enhanced `runCommand` to support cancellation via `AbortController` or by tracking `ChildProcess`. Added manual trigger methods for different sync directions.

**Tech Stack:** Obsidian Plugin API, TypeScript, Node.js (`child_process`)

---

### Task 1: Settings Update

**Files:**
- Modify: `src/settings.ts`

- [x] **Step 1: Update `XyncPluginSettings` interface**
- [x] **Step 2: Add toggle to `XyncSettingTab`**

### Task 2: LogView Refactor - Tabs and Buttons

**Files:**
- Modify: `src/LogView.ts`

- [x] **Step 1: Update `XyncLogView` properties and state**
- [x] **Step 2: Implement tabbed UI in `onOpen`**
- [x] **Step 3: Update `addLog` to support types**

### Task 3: Command Cancellation Support

**Files:**
- Modify: `src/sync.ts`

- [x] **Step 1: Refactor `runCommand` to support `AbortSignal`**

### Task 4: Main Logic Wiring

**Files:**
- Modify: `src/main.ts`

- [x] **Step 1: Add `AbortController` and Manual Sync methods**
- [x] **Step 2: Update `setupAutoSync` and `runTwoWaySync`**

---
