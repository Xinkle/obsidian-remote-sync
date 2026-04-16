import { Plugin, FileSystemAdapter } from 'obsidian';
import { t } from './i18n/i18n';
import { RemoteSyncPluginSettings, DEFAULT_SETTINGS, RemoteSyncSettingTab } from './settings';
import { RemoteSyncLogView, VIEW_TYPE_REMOTE_SYNC_LOG } from './LogView';
import { syncTwoWay, SyncState, syncForward, syncBackward, getManifestLocal, getManifestRemote } from './sync';

export default class RemoteSyncPlugin extends Plugin {
  settings: RemoteSyncPluginSettings;
  private syncTimeout: NodeJS.Timeout | null = null;
  private remoteSyncInterval: NodeJS.Timeout | null = null;
  private isSyncing: boolean = false;
  private abortController: AbortController | null = null;
  private lastLoggedPath: string = "";
  private repeatCount: number = 0;
  state: SyncState = { baselineLocal: {}, baselineRemote: {} };

  async onload() {
    await this.loadSettings();
    await this.loadSyncState();

    this.addSettingTab(new RemoteSyncSettingTab(this.app, this));

    this.registerView(
      VIEW_TYPE_REMOTE_SYNC_LOG,
      (leaf) => {
        const view = new RemoteSyncLogView(leaf);
        view.onManualSync = (dir, dryRun) => this.runManualSync(dir, dryRun);
        view.onCancel = () => this.cancelSync();
        return view;
      }
    );

    this.addCommand({
      id: 'open-remote-sync-log',
      name: t('commands.open_log'),
      callback: async () => {
        await this.activateView();
      }
    });

    this.addRibbonIcon('refresh-cw', t('commands.open_log'), async () => {
      await this.activateView();
    });

    this.app.workspace.onLayoutReady(() => {
      this.setupAutoSync();
      this.restartRemoteSyncTimer();
    });
  }

  onunload() {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }
    if (this.remoteSyncInterval) {
      clearInterval(this.remoteSyncInterval);
      this.remoteSyncInterval = null;
    }
    this.cancelSync();
  }

  async activateView() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_REMOTE_SYNC_LOG)[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: VIEW_TYPE_REMOTE_SYNC_LOG, active: true });
      }
    }
    if (leaf) {
      this.app.workspace.revealLeaf(leaf);
    }
  }

  setupAutoSync() {
    // Interval is in SECONDS, convert to ms
    const debounceTime = this.settings.autoSyncInterval * 1000;
    
    const triggerSync = (path?: string) => {
      if (!this.settings.autoSyncEnabled) return;
      
      const currentPath = path || 'unknown';
      const view = this.getLogView();

      if (view) {
        if (currentPath === this.lastLoggedPath) {
          this.repeatCount++;
          const msg = t('logs.file_change_detected', { path: currentPath, sec: this.settings.autoSyncInterval });
          view.updateLastLog(`${msg} (x${this.repeatCount + 1})`, 'plugin');
        } else {
          this.lastLoggedPath = currentPath;
          this.repeatCount = 0;
          const msg = t('logs.file_change_detected', { path: currentPath, sec: this.settings.autoSyncInterval });
          view.addLog(msg, 'plugin');
        }
      }

      if (this.syncTimeout) clearTimeout(this.syncTimeout);
      this.syncTimeout = setTimeout(() => {
        this.runTwoWaySync();
      }, debounceTime);
    };

    this.registerEvent(this.app.vault.on('modify', (file) => triggerSync(file.path)));
    this.registerEvent(this.app.vault.on('create', (file) => triggerSync(file.path)));
    this.registerEvent(this.app.vault.on('delete', (file) => triggerSync(file.path)));
    this.registerEvent(this.app.vault.on('rename', (file) => triggerSync(file.path)));
  }

  restartRemoteSyncTimer() {
    if (this.remoteSyncInterval) {
      clearInterval(this.remoteSyncInterval);
    }

    const intervalMs = this.settings.remoteSyncInterval * 60 * 1000;
    this.remoteSyncInterval = setInterval(() => {
      if (this.settings.autoSyncEnabled && !this.isSyncing) {
        const view = this.getLogView();
        if (view) {
          view.addLog(t('logs.sync_triggered'), 'plugin');
        }
        this.runTwoWaySync();
      }
    }, intervalMs);
  }

  async runManualSync(direction: 'forward' | 'backward' | 'two-way', dryRun: boolean = false) {
    await this.activateView();
    if (this.isSyncing) return;
    this.abortController = new AbortController();

    const view = this.getLogView();
    if (view) {
      view.addLog(t('logs.sync_started', { dir: direction, dry: dryRun ? ' (DRY RUN)' : '' }), 'plugin');
    }

    try {
      if (direction === 'two-way') {
        await this.runTwoWaySync(dryRun);
      } else {
        this.isSyncing = true;
        const vaultPath = this.getVaultPath();
        if (!vaultPath) {
          if (view) view.addLog(t('logs.vault_path_error'), 'plugin');
          this.isSyncing = false;
          return;
        }

        if (direction === 'forward') {
          await syncForward(vaultPath, this.settings, undefined, this.abortController.signal, dryRun);
        } else {
          await syncBackward(vaultPath, this.settings, undefined, this.abortController.signal, dryRun);
        }
        
        if (view) view.addLog(t('logs.sync_complete', { dir: direction, dry: dryRun ? ' (DRY RUN)' : '' }), 'plugin');
      }
    } catch (e: any) {
      if (view) view.addLog(t('logs.manual_sync_failed', { msg: e.message }), 'plugin');
    } finally {
      this.isSyncing = false;
      this.abortController = null;
    }
  }

  cancelSync() {
    if (this.abortController) {
      this.abortController.abort();
      this.isSyncing = false;
      const view = this.getLogView();
      if (view) view.addLog(t('logs.sync_cancelled'), 'plugin');
      this.abortController = null;
    }
  }

  private getLogView(): RemoteSyncLogView | null {
    const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_REMOTE_SYNC_LOG)[0];
    return (leaf?.view as RemoteSyncLogView) || null;
  }

  private getVaultPath(): string | null {
    if (this.app.vault.adapter instanceof FileSystemAdapter) {
      return this.app.vault.adapter.getBasePath();
    }
    return null;
  }

  async runTwoWaySync(dryRun: boolean = false) {
    if (this.isSyncing) return;
    this.isSyncing = true;
    
    if (!this.abortController) {
      this.abortController = new AbortController();
    }
    const signal = this.abortController.signal;

    const view = this.getLogView();
    if (view) {
      view.addLog(t('logs.starting_two_way', { dry: dryRun ? ' (DRY RUN)' : '' }), 'plugin');
    }

    const vaultPath = this.getVaultPath();
    if (!vaultPath) {
      if (view) view.addLog(t('logs.vault_adapter_error'), 'plugin');
      this.isSyncing = false;
      this.abortController = null;
      return;
    }

    try {
      const result = await syncTwoWay(vaultPath, this.settings, this.state, signal, dryRun);
      
      if (view) {
        result.logs.forEach(log => view.addLog(log, 'sync'));
        
        view.setConflicts(result.conflicts, async (file, resolution) => {
          if (signal.aborted) return;
          view.addLog(t('logs.resolving_conflict', { file, res: resolution, dry: dryRun ? ' (DRY RUN)' : '' }), 'plugin');
          try {
            if (resolution === 'local') {
              await syncForward(vaultPath, this.settings, file, signal, dryRun);
            } else {
              await syncBackward(vaultPath, this.settings, file, signal, dryRun);
            }
            view.addLog(t('logs.conflict_resolved', { file, dry: dryRun ? ' (DRY RUN)' : '' }), 'plugin');
            
            if (!dryRun) {
              const localManifest = await getManifestLocal(vaultPath, this.settings, signal);
              const remoteManifest = await getManifestRemote(this.settings, signal);
              
              if (localManifest[file]) this.state.baselineLocal[file] = localManifest[file];
              else delete this.state.baselineLocal[file];

              if (remoteManifest[file]) this.state.baselineRemote[file] = remoteManifest[file];
              else delete this.state.baselineRemote[file];
              
              await this.saveSyncState();
            }
          } catch (e: any) {
            if (!signal.aborted) view.addLog(t('logs.manual_sync_failed', { msg: e.message }), 'plugin');
          }
        });
      }

      if (!dryRun) {
        const localManifest = await getManifestLocal(vaultPath, this.settings, signal);
        const remoteManifest = await getManifestRemote(this.settings, signal);

        this.state.baselineLocal = {};
        this.state.baselineRemote = {};

        for (const k of Object.keys(localManifest)) {
          if (!result.conflicts.includes(k)) this.state.baselineLocal[k] = localManifest[k];
        }
        for (const k of Object.keys(remoteManifest)) {
          if (!result.conflicts.includes(k)) this.state.baselineRemote[k] = remoteManifest[k];
        }

        await this.saveSyncState();
      }

      if (view) {
        if (signal.aborted) view.addLog(t('logs.sync_aborted'), 'plugin');
        else view.addLog(t('logs.two_way_complete', { dry: dryRun ? ' (DRY RUN)' : '' }), 'plugin');
      }
    } catch (e: any) {
      if (signal.aborted) {
        if (view) view.addLog(t('logs.sync_aborted'), 'plugin');
      } else {
        if (view) view.addLog(t('logs.sync_error', { msg: e.message }), 'plugin');
        console.error('Remote Sync error', e);
      }
    } finally {
      this.isSyncing = false;
      this.abortController = null;
    }
  }

  async loadSyncState() {
    try {
      const configDir = this.app.vault.configDir;
      const statePath = configDir + '/remote_sync_state.json';
      const oldStatePath = configDir + '/xync_sync_state.json';
      
      let data: string | null = null;
      if (await this.app.vault.adapter.exists(statePath)) {
        data = await this.app.vault.adapter.read(statePath);
      } else if (await this.app.vault.adapter.exists(oldStatePath)) {
        data = await this.app.vault.adapter.read(oldStatePath);
        // Clean up old state file after loading
        // For safety, we keep it for now but load it
      }

      if (data) {
        this.state = JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load sync state', e);
    }
  }

  async saveSyncState() {
    try {
      const configDir = this.app.vault.configDir;
      const statePath = configDir + '/remote_sync_state.json';
      await this.app.vault.adapter.write(statePath, JSON.stringify(this.state, null, 2));
    } catch (e) {
      console.error('Failed to save sync state', e);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    
    // Migration: If autoSyncInterval was 1 (meaning 1 min from previous version),
    // update it to 10 seconds for better responsiveness.
    if (this.settings.autoSyncInterval === 1) {
      this.settings.autoSyncInterval = 10;
      await this.saveSettings();
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
