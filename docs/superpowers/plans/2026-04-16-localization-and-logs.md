# Localization and Log Condensation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add English/Korean localization support based on Obsidian app language and condense consecutive identical file change logs.

**Architecture:**
- **I18n Engine:** Create `src/i18n/i18n.ts` using `moment.locale()` to detect language and a `t()` helper to fetch strings from `en.ts` and `ko.ts`.
- **UI Localization:** Refactor `src/settings.ts`, `src/LogView.ts`, and `src/main.ts` to use `t()`.
- **Log Management:** Update `src/main.ts` to track the last logged path and use a new `updateLastLog` method in `RemoteSyncLogView` to show repeat counts (e.g., "(x5)").

**Tech Stack:** TypeScript, Obsidian API, Moment.js

---

### Task 1: I18n Infrastructure

**Files:**
- Create: `src/i18n/locales/en.ts`
- Create: `src/i18n/locales/ko.ts`
- Create: `src/i18n/i18n.ts`

- [ ] **Step 1: Create locale files**

```typescript
// src/i18n/locales/en.ts
export default {
  "settings.ssh_host.name": "SSH Host",
  "settings.ssh_host.desc": "The IP address or hostname of the remote SSH server.",
  "settings.ssh_user.name": "SSH User",
  "settings.ssh_user.desc": "The username for SSH authentication.",
  "settings.ssh_port.name": "SSH Port",
  "settings.ssh_port.desc": "The port for the SSH server (1-65535).",
  "settings.remote_dir.name": "Remote Directory",
  "settings.remote_dir.desc": "The absolute path to the remote Obsidian vault.",
  "settings.exclude_list.name": "Exclude List",
  "settings.exclude_list.desc": "Files and directories to exclude from sync (one per line).",
  "settings.detection_method.name": "Detection Method",
  "settings.detection_method.desc": "Method used to detect file changes.",
  "settings.auto_sync.name": "Auto Sync",
  "settings.auto_sync.desc": "Enable or disable automatic synchronization on file changes.",
  "settings.auto_sync_debounce.name": "Auto Sync Debounce",
  "settings.auto_sync_debounce.desc": "Delay in seconds to wait after the last file change before triggering sync.",
  "settings.remote_check_interval.name": "Remote Check Interval",
  "settings.remote_check_interval.desc": "Interval in minutes for periodic background synchronization to catch remote changes.",
  "view.title": "Remote Sync Status",
  "view.tabs.sync": "Sync",
  "view.tabs.plugin": "Plugin",
  "view.tabs.conflicts": "Conflicts",
  "view.buttons.sync": "Sync",
  "view.buttons.forward": "Forward",
  "view.buttons.backward": "Backward",
  "view.buttons.cancel": "Cancel",
  "view.buttons.clear": "Clear",
  "view.dry_run": "Dry Run",
  "view.no_conflicts": "No conflicts.",
  "view.conflict_title": "Conflicts",
  "view.keep_local": "Keep Local",
  "view.keep_remote": "Keep Remote",
  "logs.file_change_detected": "File change detected: {{path}}. Sync scheduled in {{sec}} sec...",
  "logs.sync_triggered": "Periodic background sync triggered.",
  "logs.sync_started": "Starting {{dir}} sync{{dry}}...",
  "logs.sync_complete": "{{dir}} sync complete{{dry}}.",
  "logs.sync_error": "Sync error: {{msg}}",
  "logs.resolving_conflict": "Resolving conflict for {{file}} using {{res}}{{dry}}...",
  "logs.conflict_resolved": "Conflict for {{file}} resolved{{dry}}.",
  "logs.sync_aborted": "Sync aborted.",
  "logs.starting_two_way": "Starting two-way sync{{dry}}...",
  "logs.two_way_complete": "Two-way sync complete{{dry}}.",
  "logs.pulling_files": "Pulling {{count}} files:",
  "logs.pushing_files": "Pushing {{count}} files:",
  "logs.deleting_remote": "Deleting {{count}} remote files:",
  "logs.deleting_local": "Deleting {{count}} local files:",
  "logs.conflict_detected": "Conflict detected: {{file}}"
};
```

```typescript
// src/i18n/locales/ko.ts
export default {
  "settings.ssh_host.name": "SSH 호스트",
  "settings.ssh_host.desc": "원격 SSH 서버의 IP 주소 또는 호스트 이름.",
  "settings.ssh_user.name": "SSH 사용자",
  "settings.ssh_user.desc": "SSH 인증을 위한 사용자 이름.",
  "settings.ssh_port.name": "SSH 포트",
  "settings.ssh_port.desc": "SSH 서버 포트 (1-65535).",
  "settings.remote_dir.name": "원격 디렉토리",
  "settings.remote_dir.desc": "원격 옵시디언 보관소의 절대 경로.",
  "settings.exclude_list.name": "제외 목록",
  "settings.exclude_list.desc": "동기화에서 제외할 파일 및 디렉토리 (한 줄에 하나씩).",
  "settings.detection_method.name": "감지 방식",
  "settings.detection_method.desc": "파일 변경을 감지하는 방식.",
  "settings.auto_sync.name": "자동 동기화",
  "settings.auto_sync.desc": "파일 변경 시 자동 동기화 활성화 여부.",
  "settings.auto_sync_debounce.name": "자동 동기화 지연 시간",
  "settings.auto_sync_debounce.desc": "마지막 파일 변경 후 동기화를 시작하기까지의 대기 시간 (초).",
  "settings.remote_check_interval.name": "원격 확인 주기",
  "settings.remote_check_interval.desc": "원격 변경 사항을 확인하기 위한 주기적인 백그라운드 동기화 간격 (분).",
  "view.title": "원격 동기화 상태",
  "view.tabs.sync": "동기화",
  "view.tabs.plugin": "플러그인",
  "view.tabs.conflicts": "충돌",
  "view.buttons.sync": "동기화",
  "view.buttons.forward": "Forward",
  "view.buttons.backward": "Backward",
  "view.buttons.cancel": "취소",
  "view.buttons.clear": "비우기",
  "view.dry_run": "Dry Run",
  "view.no_conflicts": "충돌이 없습니다.",
  "view.conflict_title": "충돌 파일",
  "view.keep_local": "로컬 유지",
  "view.keep_remote": "원격 유지",
  "logs.file_change_detected": "파일 변경 감지: {{path}}. {{sec}}초 후 동기화 예정...",
  "logs.sync_triggered": "주기적 백그라운드 동기화가 트리거되었습니다.",
  "logs.sync_started": "수동 {{dir}} 동기화 시작{{dry}}...",
  "logs.sync_complete": "수동 {{dir}} 동기화 완료{{dry}}.",
  "logs.sync_error": "동기화 오류: {{msg}}",
  "logs.resolving_conflict": "{{file}} 충돌 해결 중 (기준: {{res}}{{dry}})...",
  "logs.conflict_resolved": "{{file}} 충돌 해결됨{{dry}}.",
  "logs.sync_aborted": "동기화가 중단되었습니다.",
  "logs.starting_two_way": "양방향 동기화 시작{{dry}}...",
  "logs.two_way_complete": "양방향 동기화 완료{{dry}}.",
  "logs.pulling_files": "{{count}}개 파일 가져오는 중:",
  "logs.pushing_files": "{{count}}개 파일 보내는 중:",
  "logs.deleting_remote": "{{count}}개 원격 파일 삭제 중:",
  "logs.deleting_local": "{{count}}개 로컬 파일 삭제 중:",
  "logs.conflict_detected": "충돌 감지됨: {{file}}"
};
```

- [ ] **Step 2: Implement `t()` helper**

```typescript
// src/i18n/i18n.ts
import { moment } from "obsidian";
import en from "./locales/en";
import ko from "./locales/ko";

const localeMap: { [key: string]: any } = {
  en,
  ko,
};

export function t(key: string, vars?: { [key: string]: string | number }): string {
  const locale = moment.locale();
  const strings = localeMap[locale] || localeMap["en"];
  let result = strings[key] || en[key as keyof typeof en] || key;

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      result = result.replace(`{{${k}}}`, String(v));
    }
  }
  return result;
}
```

### Task 2: UI Localization Refactor

**Files:**
- Modify: `src/settings.ts`
- Modify: `src/LogView.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Localize `src/settings.ts`**
  - Replace all hardcoded labels and descriptions with `t()` calls.

- [ ] **Step 2: Localize `src/LogView.ts`**
  - Replace tab labels, button text, and static messages with `t()`.

- [ ] **Step 3: Localize `src/main.ts`**
  - Update all `addLog` messages to use `t()` with variables.

### Task 3: Log Condensation Implementation

**Files:**
- Modify: `src/LogView.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Add `updateLastLog` to `RemoteSyncLogView`**

```typescript
// src/LogView.ts
  public updateLastLog(msg: string, type: 'sync' | 'plugin' = 'plugin') {
    const target = type === 'sync' ? this.syncLogsDiv : this.pluginLogsDiv;
    if (!target || !target.lastElementChild) return;
    target.lastElementChild.setText(`[${new Date().toLocaleTimeString()}] ${msg}`);
  }
```

- [ ] **Step 2: Implement condensation logic in `src/main.ts`**

```typescript
// src/main.ts
  private lastLoggedPath: string = "";
  private repeatCount: number = 0;

  setupAutoSync() {
    const triggerSync = (path?: string) => {
      if (!this.settings.autoSyncEnabled) return;
      const currentPath = path || 'unknown';
      const view = this.getLogView();

      if (view) {
        if (currentPath === this.lastLoggedPath) {
          this.repeatCount++;
          const msg = t("logs.file_change_detected", { path: currentPath, sec: this.settings.autoSyncInterval });
          view.updateLastLog(`${msg} (x${this.repeatCount + 1})`, 'plugin');
        } else {
          this.lastLoggedPath = currentPath;
          this.repeatCount = 0;
          const msg = t("logs.file_change_detected", { path: currentPath, sec: this.settings.autoSyncInterval });
          view.addLog(msg, 'plugin');
        }
      }
      // ... rest of triggerSync
    }
  }
```

### Task 4: Cleanup and Verification

- [ ] **Step 1: Bump version to 1.3.0**
- [ ] **Step 2: Run `npm run build`**
- [ ] **Step 3: Run `npm run deploy`**
- [ ] **Step 4: Commit**
