# AGENTS.md

## Project Direction
Remote Sync is designed to provide a robust, transparent, and user-controlled synchronization bridge between an Obsidian vault and a remote server. Unlike "black-box" sync solutions, this project prioritizes visibility into the sync process and explicit handling of file states.

The ultimate goal is to enable seamless cross-device workflows (specifically targeting Termux/Proot environments) where external agents or secondary devices can interact with the vault content without causing silent data loss or complex merge conflicts.

## Environment & Infrastructure
The plugin operates within a Node.js-enabled Obsidian environment (Desktop/Termux-Proot). It relies on system-level binaries:
- `ssh`: For secure communication and remote command execution.
- `rsync`: For efficient file delta transfers.
- `find`, `sha256sum`, `sed`: For manifest generation and change detection.

Authentication must be handled at the SSH layer (e.g., SSH keys via `ssh-agent`), as the plugin does not store or manage credentials directly.

## Intent and Hidden Logic

### The Baseline Philosophy
The core synchronization logic is a **3-way state comparison**. It doesn't just compare Local vs. Remote; it compares both against a shared **Baseline** (stored in `remote_sync_state.json`). 
- **Intent**: This allows the plugin to distinguish between a "new file" and a "deleted file" without needing a central server or persistent database. If a file exists in the Baseline but is missing in Local, it is interpreted as an intentional deletion by the user.

### Safety over Speed
- **Conflict Handling**: When a file has changed on both sides since the last sync, the plugin **aborts** the sync for that specific file and delegates the decision to the human. This is an intentional design choice to prevent automatic, incorrect merges of complex Markdown data.
- **Batching & Shell Safety**: All shell commands are constructed using strict argument escaping. File transfers and deletions are batched using temporary files (`--files-from`) to avoid system limits (`ARG_MAX`) and ensure atomicity at the batch level.

### Debounced Responsiveness
The auto-sync trigger is debounced (default 10s). 
- **Intent**: To group rapid bursts of activity (like a flurry of edits or an automated script running in the vault) into a single synchronization session, reducing network overhead and the risk of partial syncs.

### Localization Intent
The I18n system is designed to be lightweight and zero-dependency, relying on Obsidian's internal `moment` locale. The intent is to keep the plugin accessible while maintaining a minimal bundle size.
