import { ItemView, WorkspaceLeaf } from 'obsidian';
import { t } from './i18n/i18n';

export const VIEW_TYPE_REMOTE_SYNC_LOG = 'remote-sync-log-view';

export class RemoteSyncLogView extends ItemView {
  private syncLogsDiv: HTMLDivElement;
  private pluginLogsDiv: HTMLDivElement;
  public conflictsDiv: HTMLDivElement;
  private currentTab: 'sync' | 'plugin' | 'conflicts' = 'sync';
  private dryRun: boolean = false;

  // Callbacks for manual buttons
  public onManualSync: (direction: 'forward' | 'backward' | 'two-way', dryRun: boolean) => Promise<void>;
  public onCancel: () => void;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType() {
    return VIEW_TYPE_REMOTE_SYNC_LOG;
  }

  getDisplayText() {
    return t('view.title');
  }

  getIcon() {
    return 'list';
  }

  onOpen() {
    const container = this.contentEl;
    container.empty();

    // Button Bar
    const btnBar = container.createDiv({ cls: 'remote-sync-button-bar' });
    btnBar.style.display = 'flex';
    btnBar.style.flexWrap = 'wrap';
    btnBar.style.gap = '5px';
    btnBar.style.marginBottom = '10px';

    const syncBtn = btnBar.createEl('button', { text: t('view.buttons.sync') });
    syncBtn.onclick = () => this.onManualSync?.('two-way', this.dryRun);

    const fwdBtn = btnBar.createEl('button', { text: t('view.buttons.forward') });
    fwdBtn.onclick = () => this.onManualSync?.('forward', this.dryRun);

    const bwdBtn = btnBar.createEl('button', { text: t('view.buttons.backward') });
    bwdBtn.onclick = () => this.onManualSync?.('backward', this.dryRun);

    const cancelBtn = btnBar.createEl('button', { text: t('view.buttons.cancel'), cls: 'mod-warning' });
    cancelBtn.onclick = () => this.onCancel?.();

    const clearBtn = btnBar.createEl('button', { text: t('view.buttons.clear') });
    clearBtn.onclick = () => this.clearLogs();

    // Dry Run Toggle
    const dryRunContainer = btnBar.createDiv({ cls: 'remote-sync-dry-run-container' });
    dryRunContainer.style.display = 'flex';
    dryRunContainer.style.alignItems = 'center';
    dryRunContainer.style.gap = '5px';
    dryRunContainer.style.marginLeft = '5px';

    const dryRunCheckbox = dryRunContainer.createEl('input', { type: 'checkbox' });
    dryRunCheckbox.id = 'remote-sync-dry-run-checkbox';
    dryRunCheckbox.checked = this.dryRun;
    dryRunCheckbox.onchange = (e) => {
      this.dryRun = (e.target as HTMLInputElement).checked;
    };

    const dryRunLabel = dryRunContainer.createEl('label', { text: t('view.dry_run') });
    dryRunLabel.htmlFor = 'remote-sync-dry-run-checkbox';
    dryRunLabel.style.fontSize = 'var(--font-smallest)';

    // Tab Bar
    const tabBar = container.createDiv({ cls: 'remote-sync-tab-bar' });
    tabBar.style.display = 'flex';
    tabBar.style.gap = '10px';
    tabBar.style.borderBottom = '1px solid var(--background-modifier-border)';
    tabBar.style.marginBottom = '10px';

    const tabs: Record<string, HTMLDivElement> = {};

    const createTab = (id: 'sync' | 'plugin' | 'conflicts', label: string) => {
      const tab = tabBar.createDiv({ cls: 'remote-sync-tab', text: label });
      tab.style.cursor = 'pointer';
      tab.style.padding = '5px 10px';
      tab.onclick = () => this.switchTab(id, tabs);
      tabs[id] = tab;
      return tab;
    };

    createTab('sync', t('view.tabs.sync'));
    createTab('plugin', t('view.tabs.plugin'));
    createTab('conflicts', t('view.tabs.conflicts'));

    // Content Area
    this.syncLogsDiv = container.createDiv({ cls: 'remote-sync-tab-content remote-sync-logs' });
    this.pluginLogsDiv = container.createDiv({ cls: 'remote-sync-tab-content remote-sync-logs' });
    this.conflictsDiv = container.createDiv({ cls: 'remote-sync-tab-content remote-sync-conflicts' });

    // Ensure logs are selectable and scrollable
    [this.syncLogsDiv, this.pluginLogsDiv, this.conflictsDiv].forEach(div => {
      div.style.userSelect = 'text';
      div.style.webkitUserSelect = 'text';
      div.style.overflowY = 'auto';
      div.style.height = 'calc(100% - 100px)'; // Adjust based on btnBar and tabBar height
      div.style.padding = '5px';
      div.style.fontFamily = 'var(--font-monospace)';
      div.style.fontSize = 'var(--font-smallest)';
      div.style.whiteSpace = 'pre-wrap';
      div.style.wordBreak = 'break-all';
    });

    this.switchTab(this.currentTab, tabs);
  }

  private switchTab(tabId: 'sync' | 'plugin' | 'conflicts', tabs: Record<string, HTMLDivElement>) {
    this.currentTab = tabId;
    
    // Update tab styles
    for (const [id, tabEl] of Object.entries(tabs)) {
      if (id === tabId) {
        tabEl.style.borderBottom = '2px solid var(--interactive-accent)';
        tabEl.style.fontWeight = 'bold';
      } else {
        tabEl.style.borderBottom = 'none';
        tabEl.style.fontWeight = 'normal';
      }
    }

    // Update visibility
    if (this.syncLogsDiv) this.syncLogsDiv.style.display = tabId === 'sync' ? 'block' : 'none';
    if (this.pluginLogsDiv) this.pluginLogsDiv.style.display = tabId === 'plugin' ? 'block' : 'none';
    if (this.conflictsDiv) this.conflictsDiv.style.display = tabId === 'conflicts' ? 'block' : 'none';
  }

  onClose() {
    // Cleanup if necessary
  }

  public addLog(msg: string, type: 'sync' | 'plugin' = 'plugin') {
    const target = type === 'sync' ? this.syncLogsDiv : this.pluginLogsDiv;
    if (!target) return;
    const logEl = target.createDiv({ cls: 'remote-sync-log-item' });
    logEl.setText(`[${new Date().toLocaleTimeString()}] ${msg}`);
    this.logsDiv = target; // Update this.logsDiv for legacy reasons if any
    target.scrollTop = target.scrollHeight;
  }

  public updateLastLog(msg: string, type: 'sync' | 'plugin' = 'plugin') {
    const target = type === 'sync' ? this.syncLogsDiv : this.pluginLogsDiv;
    if (!target || !target.lastElementChild) return;
    target.lastElementChild.setText(`[${new Date().toLocaleTimeString()}] ${msg}`);
  }

  public clearLogs() {
    if (this.syncLogsDiv) this.syncLogsDiv.empty();
    if (this.pluginLogsDiv) this.pluginLogsDiv.empty();
  }

  public setConflicts(
    conflicts: string[],
    resolveCallback: (file: string, resolution: 'local' | 'remote') => void
  ) {
    if (!this.conflictsDiv) return;
    this.conflictsDiv.empty();

    if (conflicts.length === 0) {
      this.conflictsDiv.createDiv({ text: t('view.no_conflicts'), cls: 'remote-sync-no-conflicts' });
      return;
    }

    this.conflictsDiv.createEl('h5', { text: t('view.conflict_title') });

    for (const file of conflicts) {
      const conflictItem = this.conflictsDiv.createDiv({ cls: 'remote-sync-conflict-item' });
      conflictItem.createSpan({ text: file });

      const btnGroup = conflictItem.createDiv({ cls: 'remote-sync-conflict-actions' });

      const localBtn = btnGroup.createEl('button', { text: t('view.keep_local') });
      localBtn.onclick = () => {
        resolveCallback(file, 'local');
        conflictItem.remove();
      };

      const remoteBtn = btnGroup.createEl('button', { text: t('view.keep_remote') });
      remoteBtn.onclick = () => {
        resolveCallback(file, 'remote');
        conflictItem.remove();
      };
    }
  }
}
