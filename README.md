# Remote Sync for Obsidian

A robust, transparent, and bidirectional synchronization plugin for Obsidian that bridges your local vault with a remote server using SSH and Rsync.

## Key Features

- **Bidirectional Synchronization**: Automatically handles additions, modifications, and deletions between local and remote environments.
- **Conflict Management**: Detected conflicts are safely put aside in a dedicated "Conflicts" tab, allowing you to choose the correct version manually.
- **Auto-Sync**: Triggers synchronization automatically after file changes (with customizable debounce delay) and performs periodic background checks to catch remote updates.
- **Dry Run Mode**: Preview changes without applying them—perfect for verifying your settings or troubleshooting.
- **Detailed Logging**: Separate tabs for synchronization logs and general plugin status, featuring log condensation for repeated events.
- **Security-First**: Uses system-level `ssh` and `rsync` with strict argument escaping. Supports custom SSH ports.
- **Localization**: Fully supports English and Korean based on your Obsidian language settings.

## Prerequisites

- **Environment**: Obsidian Desktop or a Node.js-enabled environment like Termux/Proot on Android.
- **System Binaries**: `ssh`, `rsync`, `find`, and `sha256sum` must be installed and available in your system path.
- **SSH Access**: You should have passwordless SSH access (using SSH keys) configured for your remote server.

## Installation

1.  Download the latest release or build from source.
2.  Place `main.js` and `manifest.json` in your vault's `.obsidian/plugins/obsidian-remote-sync/` directory.
3.  Enable the plugin in Obsidian's "Community plugins" settings.

## Configuration

Navigate to the plugin settings to configure:
- **SSH Connection**: Host, User, and Port.
- **Remote Path**: The absolute path to the vault on your remote server.
- **Exclude List**: Patterns for files and folders to ignore (e.g., `node_modules`, `.git`).
- **Detection Method**: Choose between fast `mtime` (modification time) or highly accurate `hash` (SHA-256).
- **Auto Sync**: Enable/disable automatic synchronization and adjust the debounce/periodic intervals.

## Usage

- **Sidebar View**: Click the ribbon icon (refresh icon) to open the Remote Sync sidebar.
- **Manual Control**: Use the **Sync**, **Forward** (Push), and **Backward** (Pull) buttons for manual intervention.
- **Conflict Resolution**: If conflicts occur, navigate to the **Conflicts** tab in the sidebar to resolve them file by file.
- **Clear Logs**: Use the **Clear** button to tidy up your log view.

## License

MIT
