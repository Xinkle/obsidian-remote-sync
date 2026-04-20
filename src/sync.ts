import { Ignore } from 'ignore';
import { exec } from 'child_process';
import { promisify } from 'util';
import { RemoteSyncPluginSettings } from './settings';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Use require to ensure we get the constructor function correctly in all environments
const ignore = require('ignore');

const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);

const DEFAULT_IGNORES = ['.git', '.trash', 'remote_sync_state.json', 'xync_sync_state.json'];

export function createIgnoreInstance(settings: RemoteSyncPluginSettings): Ignore {
  // Ensure we are calling a function
  const ignoreCreator = typeof ignore === 'function' ? ignore : (ignore as any).default;
  if (typeof ignoreCreator !== 'function') {
    throw new Error('ignore library failed to load correctly: constructor not found');
  }
  
  const ig = ignoreCreator();
  if (typeof ig.ignores !== 'function') {
    throw new Error('ignore instance created but ignores() method is missing');
  }

  // Always ignore defaults
  ig.add(DEFAULT_IGNORES);

  const userPatterns = settings.excludeList.split('\n').map(e => e.trim()).filter(e => e.length > 0);
  ig.add(userPatterns);
  
  return ig;
}

export function isExcluded(filePath: string, settings: RemoteSyncPluginSettings, ig?: Ignore): boolean {
  const matcher = ig ?? createIgnoreInstance(settings);
  // ignore library requires relative paths without leading slash
  const safePath = filePath.replace(/^\//, '');
  return matcher.ignores(safePath);
}

export function getRsyncArgs(settings: RemoteSyncPluginSettings): string[] {
  const args: string[] = [];
  for (const ig of DEFAULT_IGNORES) {
    args.push(`--exclude=${escapeShellArg(ig)}`);
  }
  // User patterns are handled in JS, so we only need system ignores here
  return args;
}

export async function runCommand(cmd: string, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = exec(cmd, (error, stdout, stderr) => {
      if (stderr && stderr.trim().length > 0 && !stderr.includes('Warning: Permanently added')) {
        console.warn(`Command stderr: ${stderr}`);
      }
      if (error) {
        if (signal?.aborted) {
          resolve('');
        } else {
          console.error(`Command failed: ${cmd}`, error);
          reject(error);
        }
        return;
      }
      resolve(stdout.trim());
    });

    if (signal) {
      if (signal.aborted) {
        process.kill();
        resolve('');
        return;
      }
      signal.addEventListener('abort', () => {
        process.kill();
        resolve('');
      }, { once: true });
    }
  });
}

export function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

function buildFindScript(dir: string, method: 'hash' | 'mtime', settings: RemoteSyncPluginSettings): string {
  const pruneExpr = DEFAULT_IGNORES.map(ig => `-name ${escapeShellArg(ig)}`).join(' -o ');
  const findBase = `find . \\( ${pruneExpr} \\) -prune -o -type f`;
  
  const safeDir = escapeShellArg(dir);

  if (method === 'hash') {
    return `cd ${safeDir} && ${findBase} -exec sha256sum {} + | sed 's/  /\\t/'`;
  } else {
    return `cd ${safeDir} && ${findBase} -printf '%s_%T@\\t%p\\n'`;
  }
}

export async function getManifestLocal(vaultPath: string, settings: RemoteSyncPluginSettings, ig?: Ignore, signal?: AbortSignal): Promise<Record<string, string>> {
  const matcher = ig ?? createIgnoreInstance(settings);
  const script = buildFindScript(vaultPath, settings.detectionMethod, settings);
  const output = await runCommand(script, signal);
  return parseManifest(output, matcher);
}

export async function getManifestRemote(settings: RemoteSyncPluginSettings, ig?: Ignore, signal?: AbortSignal): Promise<Record<string, string>> {
  const matcher = ig ?? createIgnoreInstance(settings);
  const sshCmd = `ssh -p ${settings.sshPort} -o LogLevel=ERROR ${escapeShellArg(settings.sshUser + '@' + settings.sshHost)}`;
  const script = buildFindScript(settings.remoteDir, settings.detectionMethod, settings);
  const output = await runCommand(`${sshCmd} ${escapeShellArg(script)}`, signal);
  return parseManifest(output, matcher);
}

export function parseManifest(output: string, ig: Ignore): Record<string, string> {
  const manifest: Record<string, string> = {};
  if (!output) return manifest;
  output.split('\n').forEach(line => {
    const idx = line.indexOf('\t');
    if (idx !== -1) {
      const hash = line.slice(0, idx);
      const filePath = line.slice(idx + 1).replace(/^\.\//, '');
      if (!ig.ignores(filePath)) {
        manifest[filePath] = hash;
      }
    }
  });
  return manifest;
}

export async function syncForward(vaultPath: string, settings: RemoteSyncPluginSettings, file?: string, signal?: AbortSignal, dryRun?: boolean): Promise<SyncResult> {
  const ig = createIgnoreInstance(settings);
  const logs: string[] = [];

  if (file) {
    if (ig.ignores(file)) {
      logs.push(`Skipping excluded file: ${file}`);
      return { conflicts: [], logs };
    }
    await performBatchPush(vaultPath, settings, [file], signal, dryRun, logs);
    return { conflicts: [], logs };
  }

  const currentLocal = await getManifestLocal(vaultPath, settings, ig, signal);
  const currentRemote = await getManifestRemote(settings, ig, signal);
  
  const toPush = Object.keys(currentLocal);
  const toDeleteRemote = Object.keys(currentRemote).filter(f => !currentLocal[f]);

  await performBatchPush(vaultPath, settings, toPush, signal, dryRun, logs);
  await performBatchDeleteRemote(settings, toDeleteRemote, signal, dryRun, logs);

  return { conflicts: [], logs };
}

export async function syncBackward(vaultPath: string, settings: RemoteSyncPluginSettings, file?: string, signal?: AbortSignal, dryRun?: boolean): Promise<SyncResult> {
  const ig = createIgnoreInstance(settings);
  const logs: string[] = [];

  if (file) {
    if (ig.ignores(file)) {
      logs.push(`Skipping excluded file: ${file}`);
      return { conflicts: [], logs };
    }
    await performBatchPull(vaultPath, settings, [file], signal, dryRun, logs);
    return { conflicts: [], logs };
  }

  const currentLocal = await getManifestLocal(vaultPath, settings, ig, signal);
  const currentRemote = await getManifestRemote(settings, ig, signal);
  
  const toPull = Object.keys(currentRemote);
  const toDeleteLocal = Object.keys(currentLocal).filter(f => !currentRemote[f]);

  await performBatchPull(vaultPath, settings, toPull, signal, dryRun, logs);
  await performBatchDeleteLocal(vaultPath, toDeleteLocal, signal, dryRun, logs);

  return { conflicts: [], logs };
}

export interface SyncState {
  baselineLocal: Record<string, string>;
  baselineRemote: Record<string, string>;
}

export interface SyncResult {
  conflicts: string[];
  logs: string[];
}

async function performBatchPull(vaultPath: string, settings: RemoteSyncPluginSettings, files: string[], signal?: AbortSignal, dryRun?: boolean, logs: string[] = []): Promise<void> {
  if (files.length === 0 || signal?.aborted) return;
  
  const sshHostPrefix = `${escapeShellArg(settings.sshUser + '@' + settings.sshHost)}:`;
  const remotePath = `${sshHostPrefix}${escapeShellArg(settings.remoteDir)}/`;
  const localPath = `${escapeShellArg(vaultPath)}/`;
  const rsyncArgs = getRsyncArgs(settings).join(' ');
  const dryRunFlag = dryRun ? '-n' : '';
  const rsyncBase = `rsync -avz ${dryRunFlag} -e "ssh -p ${settings.sshPort}" ${rsyncArgs}`;
  
  logs.push(`${dryRun ? '[dry-run] ' : '' }Pulling ${files.length} files:`);
  files.forEach(f => logs.push(`  [PULL] ${f}`));
  
  const tempDir = os.tmpdir();
  const pullListPath = path.join(tempDir, `remote-sync_pull_${Date.now()}.txt`);
  await writeFileAsync(pullListPath, files.join('\n'));
  try {
    const pullCmd = `${rsyncBase} --files-from=${escapeShellArg(pullListPath)} ${remotePath} ${localPath}`;
    await runCommand(pullCmd, signal);
  } finally {
    await unlinkAsync(pullListPath).catch(() => {});
  }
}

async function performBatchPush(vaultPath: string, settings: RemoteSyncPluginSettings, files: string[], signal?: AbortSignal, dryRun?: boolean, logs: string[] = []): Promise<void> {
  if (files.length === 0 || signal?.aborted) return;

  const sshHostPrefix = `${escapeShellArg(settings.sshUser + '@' + settings.sshHost)}:`;
  const remotePath = `${sshHostPrefix}${escapeShellArg(settings.remoteDir)}/`;
  const localPath = `${escapeShellArg(vaultPath)}/`;
  const rsyncArgs = getRsyncArgs(settings).join(' ');
  const dryRunFlag = dryRun ? '-n' : '';
  const rsyncBase = `rsync -avz ${dryRunFlag} -e "ssh -p ${settings.sshPort}" ${rsyncArgs}`;

  logs.push(`${dryRun ? '[dry-run] ' : '' }Pushing ${files.length} files:`);
  files.forEach(f => logs.push(`  [PUSH] ${f}`));
  
  const tempDir = os.tmpdir();
  const pushListPath = path.join(tempDir, `remote-sync_push_${Date.now()}.txt`);
  await writeFileAsync(pushListPath, files.join('\n'));
  try {
    const pushCmd = `${rsyncBase} --files-from=${escapeShellArg(pushListPath)} ${localPath} ${remotePath}`;
    await runCommand(pushCmd, signal);
  } finally {
    await unlinkAsync(pushListPath).catch(() => {});
  }
}

async function performBatchDeleteRemote(settings: RemoteSyncPluginSettings, files: string[], signal?: AbortSignal, dryRun?: boolean, logs: string[] = []): Promise<void> {
  if (files.length === 0 || signal?.aborted) return;

  const sshCmdBase = `ssh -p ${settings.sshPort} -o LogLevel=ERROR ${escapeShellArg(settings.sshUser + '@' + settings.sshHost)}`;
  
  logs.push(`${dryRun ? '[dry-run] ' : '' }Deleting ${files.length} remote files:`);
  files.forEach(f => logs.push(`  [REMOTE DELETE] ${f}`));
  
  const chunkSize = 100;
  for (let i = 0; i < files.length; i += chunkSize) {
    if (signal?.aborted) break;
    const chunk = files.slice(i, i + chunkSize);
    const delFiles = chunk.map(f => escapeShellArg(f)).join(' ');
    const remoteDelCmd = dryRun ? `echo cd ${escapeShellArg(settings.remoteDir)} && echo rm -f -- ${delFiles}` : `cd ${escapeShellArg(settings.remoteDir)} && rm -f -- ${delFiles}`;
    await runCommand(`${sshCmdBase} ${escapeShellArg(remoteDelCmd)}`, signal);
  }
}

async function performBatchDeleteLocal(vaultPath: string, files: string[], signal?: AbortSignal, dryRun?: boolean, logs: string[] = []): Promise<void> {
  if (files.length === 0 || signal?.aborted) return;

  logs.push(`${dryRun ? '[dry-run] ' : '' }Deleting ${files.length} local files:`);
  files.forEach(f => logs.push(`  [LOCAL DELETE] ${f}`));
  
  const chunkSize = 100;
  for (let i = 0; i < files.length; i += chunkSize) {
    if (signal?.aborted) break;
    const chunk = files.slice(i, i + chunkSize);
    const delFiles = chunk.map(f => escapeShellArg(path.join(vaultPath, f))).join(' ');
    const localDelCmd = dryRun ? `echo rm -f -- ${delFiles}` : `rm -f -- ${delFiles}`;
    await runCommand(localDelCmd, signal);
  }
}

export async function syncTwoWay(vaultPath: string, settings: RemoteSyncPluginSettings, state: SyncState, signal?: AbortSignal, dryRun?: boolean): Promise<SyncResult> {
  const ig = createIgnoreInstance(settings);
  const currentLocal = await getManifestLocal(vaultPath, settings, ig, signal);
  const currentRemote = await getManifestRemote(settings, ig, signal);
  const conflicts: string[] = [];
  const logs: string[] = [];
  
  if (signal?.aborted) return { conflicts: [], logs: [] };

  let allFiles = new Set([
    ...Object.keys(currentLocal),
    ...Object.keys(currentRemote),
    ...Object.keys(state.baselineLocal),
    ...Object.keys(state.baselineRemote)
  ]);

  // Filter out excluded files to prevent them from being detected as "deleted"
  const filteredFiles = Array.from(allFiles).filter(f => !ig.ignores(f));

  const toPush: string[] = [];
  const toPull: string[] = [];
  const toDeleteLocal: string[] = [];
  const toDeleteRemote: string[] = [];

  for (const file of filteredFiles) {
    const loc = currentLocal[file];
    const rem = currentRemote[file];
    const baseLoc = state.baselineLocal[file];
    const baseRem = state.baselineRemote[file];

    const locChanged = loc !== baseLoc;
    const remChanged = rem !== baseRem;

    // Detect baseline inconsistency (e.g. from failed previous sync or manual edit of state)
    const baselineInconsistent = baseLoc !== baseRem;

    if ((locChanged && remChanged && loc !== rem) || (baselineInconsistent && !locChanged && !remChanged && loc !== rem)) {
      if (loc && rem) {
        conflicts.push(file);
        logs.push(`Conflict detected: ${file}${baselineInconsistent ? ' (Inconsistent Baseline)' : ''}`);
      } else if (!loc && !rem) {
        // Both deleted -> do nothing
      } else {
        conflicts.push(file);
        logs.push(`Conflict (one deleted, one changed): ${file}`);
      }
    } else if (locChanged && (!remChanged || loc === rem)) {
      if (loc) {
        toPush.push(file);
      } else {
        toDeleteRemote.push(file);
      }
    } else if (remChanged && (!locChanged || loc === rem)) {
      if (rem) {
        toPull.push(file);
      } else {
        toDeleteLocal.push(file);
      }
    }
  }
  
  await performBatchPull(vaultPath, settings, toPull, signal, dryRun, logs);
  await performBatchPush(vaultPath, settings, toPush, signal, dryRun, logs);
  await performBatchDeleteRemote(settings, toDeleteRemote, signal, dryRun, logs);
  await performBatchDeleteLocal(vaultPath, toDeleteLocal, signal, dryRun, logs);

  return { conflicts, logs };
}
