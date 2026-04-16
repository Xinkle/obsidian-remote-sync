import { App, PluginSettingTab, Setting } from 'obsidian';
import type RemoteSyncPlugin from './main';
import { t } from './i18n/i18n';

export interface RemoteSyncPluginSettings {
  sshUser: string;
  sshHost: string;
  sshPort: number;
  remoteDir: string;
  excludeList: string;
  detectionMethod: 'hash' | 'mtime';
  autoSyncInterval: number; // Unit: seconds
  autoSyncEnabled: boolean;
  remoteSyncInterval: number; // Unit: minutes
}

export const DEFAULT_SETTINGS: RemoteSyncPluginSettings = {
  sshUser: '',
  sshHost: '',
  sshPort: 22,
  remoteDir: '',
  excludeList: '.git\n.gitignore\n.obsidian/plugins\n.obsidian/appearance.json\n.obsidian/workspace.json\n.obsidian/community-plugins.json\n.trash',
  detectionMethod: 'mtime',
  autoSyncInterval: 10, // Default: 10 seconds
  autoSyncEnabled: false,
  remoteSyncInterval: 10 // Default: 10 minutes
};

export class RemoteSyncSettingTab extends PluginSettingTab {
  plugin: RemoteSyncPlugin;

  constructor(app: App, plugin: RemoteSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    
    new Setting(containerEl)
      .setName(t('settings.ssh_host.name'))
      .setDesc(t('settings.ssh_host.desc'))
      .addText(text => text
        .setValue(this.plugin.settings.sshHost)
        .onChange(async (value) => {
          this.plugin.settings.sshHost = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(t('settings.ssh_user.name'))
      .setDesc(t('settings.ssh_user.desc'))
      .addText(text => text
        .setValue(this.plugin.settings.sshUser)
        .onChange(async (value) => {
          this.plugin.settings.sshUser = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(t('settings.ssh_port.name'))
      .setDesc(t('settings.ssh_port.desc'))
      .addText(text => text
        .setValue(this.plugin.settings.sshPort.toString())
        .onChange(async (value) => {
          const parsed = parseInt(value, 10);
          if (!isNaN(parsed) && parsed > 0 && parsed <= 65535) {
            this.plugin.settings.sshPort = parsed;
            await this.plugin.saveSettings();
          }
        }));

    new Setting(containerEl)
      .setName(t('settings.remote_dir.name'))
      .setDesc(t('settings.remote_dir.desc'))
      .addText(text => text
        .setValue(this.plugin.settings.remoteDir)
        .onChange(async (value) => {
          this.plugin.settings.remoteDir = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(t('settings.exclude_list.name'))
      .setDesc(t('settings.exclude_list.desc'))
      .addTextArea(text => text
        .setValue(this.plugin.settings.excludeList)
        .onChange(async (value) => {
          this.plugin.settings.excludeList = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(t('settings.detection_method.name'))
      .setDesc(t('settings.detection_method.desc'))
      .addDropdown(dropdown => dropdown
        .addOption('mtime', t('settings.detection_method.mtime'))
        .addOption('hash', t('settings.detection_method.hash'))
        .setValue(this.plugin.settings.detectionMethod)
        .onChange(async (value: 'mtime' | 'hash') => {
          this.plugin.settings.detectionMethod = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(t('settings.auto_sync.name'))
      .setDesc(t('settings.auto_sync.desc'))
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoSyncEnabled)
        .onChange(async (value) => {
          this.plugin.settings.autoSyncEnabled = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(t('settings.auto_sync_debounce.name'))
      .setDesc(t('settings.auto_sync_debounce.desc'))
      .addText(text => text
        .setValue(this.plugin.settings.autoSyncInterval.toString())
        .onChange(async (value) => {
          const parsed = parseInt(value, 10);
          if (!isNaN(parsed) && parsed >= 0) {
            this.plugin.settings.autoSyncInterval = parsed;
            await this.plugin.saveSettings();
          }
        }));

    new Setting(containerEl)
      .setName(t('settings.remote_check_interval.name'))
      .setDesc(t('settings.remote_check_interval.desc'))
      .addText(text => text
        .setValue(this.plugin.settings.remoteSyncInterval.toString())
        .onChange(async (value) => {
          const parsed = parseInt(value, 10);
          if (!isNaN(parsed) && parsed > 0) {
            this.plugin.settings.remoteSyncInterval = parsed;
            await this.plugin.saveSettings();
            this.plugin.restartRemoteSyncTimer();
          }
        }));
  }
}
