# UI Localization Refactor - Part 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the localization refactor for `src/main.ts` and ensure all i18n keys are present and correctly translated.

**Architecture:** Use the existing `t()` function from `src/i18n/i18n.ts` to replace hardcoded strings. Centralize all UI strings in `src/i18n/locales/en.ts` and `src/i18n/locales/ko.ts`.

**Tech Stack:** TypeScript, Obsidian API.

---

### Task 1: Update i18n Locale Files

**Files:**
- Modify: `src/i18n/locales/en.ts`
- Modify: `src/i18n/locales/ko.ts`

- [ ] **Step 1: Add missing keys to `src/i18n/locales/en.ts`**

```typescript
  "view.keep_remote": "Keep Remote",
  "commands.open_log": "Open Remote Sync Log",
  "logs.file_change_detected": "File change detected: {{path}}. Sync scheduled in {{sec}} sec...",
```

- [ ] **Step 2: Add missing keys to `src/i18n/locales/ko.ts`**

```typescript
  "view.keep_remote": "원격 유지",
  "commands.open_log": "원격 동기화 로그 열기",
  "logs.file_change_detected": "파일 변경 감지: {{path}}. {{sec}}초 후 동기화 예정...",
  "logs.sync_triggered": "주기적 백그라운드 동기화가 트리거되었습니다.",
  "logs.sync_started": "수동 {{dir}} 동기화 시작{{dry}}...",
  "logs.sync_complete": "수동 {{dir}} 동기화 완료{{dry}}.",
  "logs.sync_error": "동기화 오류: {{msg}}",
  "logs.sync_cancelled": "사용자가 동기화를 취소했습니다.",
  "logs.vault_path_error": "오류: 보관소 경로를 확인할 수 없습니다.",
  "logs.vault_adapter_error": "오류: Vault 어댑터가 FileSystemAdapter가 아닙니다.",
  "logs.manual_sync_failed": "수동 동기화 실패: {{msg}}",
  "logs.resolving_conflict": "{{file}} 충돌 해결 중 (기준: {{res}}{{dry}})...",
  "logs.conflict_resolved": "{{file}} 충돌 해결됨{{dry}}.",
  "logs.sync_aborted": "동기화가 중단되었습니다.",
  "logs.starting_two_way": "양방향 동기화 시작{{dry}}...",
  "logs.two_way_complete": "양방향 동기화 완료{{dry}}.",
```

- [ ] **Step 3: Commit i18n changes**

```bash
git add src/i18n/locales/en.ts src/i18n/locales/ko.ts
git commit -m "i18n: add missing keys for main.ts localization"
```

### Task 2: Localize `src/main.ts`

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Add import and localize commands/ribbon**

- [ ] **Step 2: Localize `addLog` calls in `setupAutoSync` and `restartRemoteSyncTimer`**

- [ ] **Step 3: Localize `addLog` calls in `runManualSync` and `cancelSync`**

- [ ] **Step 4: Localize `addLog` calls in `runTwoWaySync`**

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Successful build without errors.

- [ ] **Step 6: Commit changes**

```bash
git add src/main.ts
git commit -m "refactor: localize src/main.ts using t()"
```

### Task 3: Final Verification

- [ ] **Step 1: Check all files for remaining hardcoded strings**

- [ ] **Step 2: Commit any final fixes**
