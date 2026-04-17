import { exec } from 'child_process';
import { promisify } from 'util';
import { RemoteSyncPluginSettings } from './settings';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);

const DEFAULT_IGNORES = ['.git', '.trash', 'remote_sync_state.json', 'xync_sync_state.json'];

export function isExcluded(filePath: string, settings: RemoteSyncPluginSettings): boolean {
  const userPatterns = settings.excludeList.split('\n').map(e => e.trim()).filter(e => e.length > 0);
  
  const matches = (p: string, pattern: string) => {
    return p === pattern || 
           p.startsWith(pattern + '/') || 
           p.endsWith('/' + pattern) || 
           p.includes('/' + pattern + '/');
  };

  // Default ignores are always excluded
  if (DEFAULT_IGNORES.some(ig => matches(filePath, ig))) return true;

  // Process user patterns in order (last match wins or explicit include/exclude)
  let excluded = false;
  for (const pattern of userPatterns) {
    if (pattern.startsWith('!')) {
      const includePattern = pattern.substring(1).trim();
      if (includePattern && matches(filePath, includePattern)) {
        excluded = false;
      }
    } else {
      if (matches(filePath, pattern)) {
        excluded = true;
      }
    }
  }
  return excluded;
}

export function getRsyncArgs(settings: RemoteSyncPluginSettings): string[] {
  const args: string[] = ['--include="*/"'];
  // Default ignores are absolute and come first
  for (const ig of DEFAULT_IGNORES) {
    args.push(`--exclude=${escapeShellArg(ig)}`);
  }
  const userPatterns = settings.excludeList.split('\n').map(e => e.trim()).filter(e => e.length > 0);
  // User patterns in reverse order for "last match wins" behavior in rsync
  for (let i = userPatterns.length - 1; i >= 0; i--) {
    const pattern = userPatterns[i];
    if (pattern.startsWith('!')) {
      const p = pattern.substring(1).trim();
      if (p) args.push(`--include=${escapeShellArg(p)}`);
    } else {
      args.push(`--exclude=${escapeShellArg(pattern)}`);
    }
  }
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

export async function getManifestLocal(vaultPath: string, settings: RemoteSyncPluginSettings, signal?: AbortSignal): Promise<Record<string, string>> {
  const script = buildFindScript(vaultPath, settings.detectionMethod, settings);
  const output = await runCommand(script, signal);
  return parseManifest(output, settings);
}

export async function getManifestRemote(settings: RemoteSyncPluginSettings, signal?: AbortSignal): Promise<Record<string, string>> {
  const sshCmd = `ssh -p ${settings.sshPort} -o LogLevel=ERROR ${escapeShellArg(settings.sshUser + '@' + settings.sshHost)}`;
  const script = buildFindScript(settings.remoteDir, settings.detectionMethod, settings);
  const output = await runCommand(`${sshCmd} ${escapeShellArg(script)}`, signal);
  return parseManifest(output, settings);
}

export function parseManifest(output: string, settings: RemoteSyncPluginSettings): Record<string, string> {
  const manifest: Record<string, string> = {};
  if (!output) return manifest;
  output.split('\n').forEach(line => {
    const idx = line.indexOf('\t');
    if (idx !== -1) {
      const hash = line.slice(0, idx);
      const filePath = line.slice(idx + 1).replace(/^\.\//, '');
      if (!isExcluded(filePath, settings)) {
        manifest[filePath] = hash;
      }
    }
  });
  return manifest;
}

export function buildRsyncCmd(vaultPath: string, settings: RemoteSyncPluginSettings, direction: 'forward' | 'backward', file?: string, dryRun?: boolean): string {
  const remote = `${escapeShellArg(settings.sshUser + '@' + settings.sshHost)}:${escapeShellArg(settings.remoteDir)}/`;
  const local = `${escapeShellArg(vaultPath)}/`;
  
  const rsyncArgs = getRsyncArgs(settings).join(' ');
  
  const dryRunFlag = dryRun ? '-n' : '';
  const rsyncBase = `rsync -avz ${dryRunFlag} --delete -e "ssh -p ${settings.sshPort}" ${rsyncArgs}`;
  
  if (file) {
    const includes = `--include=${escapeShellArg(file)} --include="*/" --exclude="*"`;
    const rsyncSingle = `rsync -avz ${dryRunFlag} -e "ssh -p ${settings.sshPort}" ${rsyncArgs} ${includes}`;
    if (direction === 'forward') return `${rsyncSingle} ${local} ${remote}`;
    return `${rsyncSingle} ${remote} ${local}`;
  }

  if (direction === 'forward') return `${rsyncBase} ${local} ${remote}`;
  return `${rsyncBase} ${remote} ${local}`;
}

export async function syncForward(vaultPath: string, settings: RemoteSyncPluginSettings, file?: string, signal?: AbortSignal, dryRun?: boolean) {
  const cmd = buildRsyncCmd(vaultPath, settings, 'forward', file, dryRun);
  await runCommand(cmd, signal);
}

export async function syncBackward(vaultPath: string, settings: RemoteSyncPluginSettings, file?: string, signal?: AbortSignal, dryRun?: boolean) {
  const cmd = buildRsyncCmd(vaultPath, settings, 'backward', file, dryRun);
  await runCommand(cmd, signal);
}

export interface SyncState {
  baselineLocal: Record<string, string>;
  baselineRemote: Record<string, string>;
}

export interface SyncResult {
  conflicts: string[];
  logs: string[];
}

export async function syncTwoWay(vaultPath: string, settings: RemoteSyncPluginSettings, state: SyncState, signal?: AbortSignal, dryRun?: boolean): Promise<SyncResult> {
  const currentLocal = await getManifestLocal(vaultPath, settings, signal);
  const currentRemote = await getManifestRemote(settings, signal);
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
  const filteredFiles = Array.from(allFiles).filter(f => !isExcluded(f, settings));

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

    if (locChanged && remChanged && loc !== rem) {
      if (loc && rem) {
        conflicts.push(file);
        logs.push(`Conflict detected: ${file}`);
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
  
  const dryRunFlag = dryRun ? '-n' : '';
  const sshHostPrefix = `${escapeShellArg(settings.sshUser + '@' + settings.sshHost)}:`;
  const remotePath = `${sshHostPrefix}${escapeShellArg(settings.remoteDir)}/`;
  const localPath = `${escapeShellArg(vaultPath)}/`;

  const sshCmdBase = `ssh -p ${settings.sshPort} -o LogLevel=ERROR ${escapeShellArg(settings.sshUser + '@' + settings.sshHost)}`;
  const rsyncArgs = getRsyncArgs(settings).join(' ');
  const rsyncBase = `rsync -avz ${dryRunFlag} -e "ssh -p ${settings.sshPort}" ${rsyncArgs}`;

  // Use temporary files to avoid ARG_MAX issues
  const tempDir = os.tmpdir();
  
  // Batch Pull
  if (toPull.length > 0 && !signal?.aborted) {
    logs.push(`${dryRun ? '[dry-run] ' : '' }Pulling ${toPull.length} files:`);
    toPull.forEach(f => logs.push(`  [PULL] ${f}`));
    const pullListPath = path.join(tempDir, `remote-sync_pull_${Date.now()}.txt`);
    await writeFileAsync(pullListPath, toPull.join('\n'));
    try {
      const pullCmd = `${rsyncBase} --files-from=${escapeShellArg(pullListPath)} ${remotePath} ${localPath}`;
      await runCommand(pullCmd, signal);
    } finally {
      await unlinkAsync(pullListPath).catch(() => {});
    }
  }

  // Batch Push
  if (toPush.length > 0 && !signal?.aborted) {
    logs.push(`${dryRun ? '[dry-run] ' : '' }Pushing ${toPush.length} files:`);
    toPush.forEach(f => logs.push(`  [PUSH] ${f}`));
    const pushListPath = path.join(tempDir, `remote-sync_push_${Date.now()}.txt`);
    await writeFileAsync(pushListPath, toPush.join('\n'));
    try {
      const pushCmd = `${rsyncBase} --files-from=${escapeShellArg(pushListPath)} ${localPath} ${remotePath}`;
      await runCommand(pushCmd, signal);
    } finally {
      await unlinkAsync(pushListPath).catch(() => {});
    }
  }

  // Batch Delete Remote
  if (toDeleteRemote.length > 0 && !signal?.aborted) {
    logs.push(`${dryRun ? '[dry-run] ' : '' }Deleting ${toDeleteRemote.length} remote files:`);
    toDeleteRemote.forEach(f => logs.push(`  [REMOTE DELETE] ${f}`));
    // Delete in chunks of 100 to avoid ARG_MAX on remote
    const chunkSize = 100;
    for (let i = 0; i < toDeleteRemote.length; i += chunkSize) {
      if (signal?.aborted) break;
      const chunk = toDeleteRemote.slice(i, i + chunkSize);
      const delFiles = chunk.map(f => escapeShellArg(f)).join(' ');
      const remoteDelCmd = dryRun ? `echo cd ${escapeShellArg(settings.remoteDir)} && echo rm -f -- ${delFiles}` : `cd ${escapeShellArg(settings.remoteDir)} && rm -f -- ${delFiles}`;
      await runCommand(`${sshCmdBase} ${escapeShellArg(remoteDelCmd)}`, signal);
    }
  }

  // Batch Delete Local
  if (toDeleteLocal.length > 0 && !signal?.aborted) {
    logs.push(`${dryRun ? '[dry-run] ' : '' }Deleting ${toDeleteLocal.length} local files:`);
    toDeleteLocal.forEach(f => logs.push(`  [LOCAL DELETE] ${f}`));
    const chunkSize = 100;
    for (let i = 0; i < toDeleteLocal.length; i += chunkSize) {
      if (signal?.aborted) break;
      const chunk = toDeleteLocal.slice(i, i + chunkSize);
      const delFiles = chunk.map(f => escapeShellArg(path.join(vaultPath, f))).join(' ');
      const localDelCmd = dryRun ? `echo rm -f -- ${delFiles}` : `rm -f -- ${delFiles}`;
      await runCommand(localDelCmd, signal);
    }
  }

  return { conflicts, logs };
}
