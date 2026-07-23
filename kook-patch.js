const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const src = __dirname;
const RED = '\x1b[31m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', RST = '\x1b[0m';
const log = (msg) => console.log(`${GREEN}[KOOK-PATCH]${RST} ${msg}`);
const warn = (msg) => console.log(`${YELLOW}[WARN]${RST} ${msg}`);
const err = (msg) => { console.log(`${RED}[ERROR]${RST} ${msg}`); process.exit(1); };

// --- Find KOOK ---
log('Finding KOOK installation...');
const localAppData = process.env.LOCALAPPDATA;
const kookBase = path.join(localAppData, 'KOOK');
if (!fs.existsSync(kookBase)) err(`KOOK not found: ${kookBase}`);

const dirs = fs.readdirSync(kookBase).filter(d => /^app-\d+\.\d+\.\d+$/.test(d));
if (dirs.length === 0) err(`No KOOK app dir found: ${kookBase}\\app-*`);
dirs.sort((a, b) => {
  const va = a.replace('app-', '').split('.').map(Number);
  const vb = b.replace('app-', '').split('.').map(Number);
  for (let i = 0; i < 3; i++) if (va[i] !== vb[i]) return vb[i] - va[i];
  return 0;
});
const appDir = path.join(kookBase, dirs[0]);
log(`Found: ${appDir}`);

// --- Check if KOOK is running ---
try {
  execSync('tasklist /FI "IMAGENAME eq KOOK.exe" 2>NUL | find /I "KOOK.exe"', { stdio: 'pipe' });
  warn('KOOK is running! Please close KOOK first.');
  process.exit(1);
} catch (_) { /* not running */ }

const resourcesDir = path.join(appDir, 'resources');
const asar = path.join(resourcesDir, 'app.asar');
const asarBak = path.join(resourcesDir, 'app.asar.bak');
const srcBase = path.join(resourcesDir, 'app-src-base');
const appSrc = path.join(resourcesDir, 'app-src');
const unpackedDir = path.join(resourcesDir, 'app.asar.unpacked');
const unpackedBackup = path.join(resourcesDir, 'app.asar.unpacked.bak');

// --- Backup ---
if (!fs.existsSync(asarBak)) {
  fs.copyFileSync(asar, asarBak);
  log('Backup saved: app.asar.bak');
}

// --- Extract (cached) ---
if (!fs.existsSync(srcBase)) {
  log('Extracting app.asar (first time)...');
  if (!fs.existsSync(unpackedDir)) {
    if (fs.existsSync(unpackedBackup)) {
      copyDirSync(unpackedBackup, unpackedDir);
    } else {
      fs.mkdirSync(unpackedDir, { recursive: true });
    }
  }
  execSync(`npx asar extract "${asar}" "${srcBase}"`, { stdio: 'inherit', cwd: resourcesDir });
  log('Extract done, cached as app-src-base');
} else {
  log('Using cached extract: app-src-base');
}

// --- Copy base to working dir ---
log('Preparing working copy...');
if (fs.existsSync(appSrc)) fs.rmSync(appSrc, { recursive: true, force: true });
copyDirSync(srcBase, appSrc);
const buildDir = path.join(appSrc, 'webapp', 'build');

// --- Enable DevTools in main process ---
log('Enabling DevTools in main process...');
const mainPkgPath = path.join(appSrc, 'package.json');
if (fs.existsSync(mainPkgPath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(mainPkgPath, 'utf8'));
    const mainEntryRelative = pkg.main || 'index.js';
    const mainEntryPath = path.join(appSrc, mainEntryRelative);
    if (fs.existsSync(mainEntryPath)) {
      let mainContent = fs.readFileSync(mainEntryPath, 'utf8');

      mainContent = mainContent.replace(/devTools\s*:\s*(!1|false)/g, 'devTools: true');

      const devToolsSnippet = `
try {
  const { app: _app, BrowserWindow: _BrowserWindow, ipcMain: _ipcMain, autoUpdater: _autoUpdater } = require('electron');
  
  if (_autoUpdater) {
    _autoUpdater.checkForUpdates = () => {};
    _autoUpdater.quitAndInstall = () => {};
  }

  _app.on('browser-window-created', (event, win) => {
    win.webContents.on('before-input-event', (e, input) => {
      if (input.type === 'keyDown') {
        const isF12 = input.key === 'F12';
        const isCtrlShiftI = (input.control || input.meta) && input.shift && (input.key === 'I' || input.key === 'i');
        if (isF12 || isCtrlShiftI) {
          win.webContents.toggleDevTools();
        }
      }
    });
  });

  if (_ipcMain) {
    _ipcMain.on('toggle-devtools', (event) => {
      const win = _BrowserWindow.fromWebContents(event.sender);
      if (win) win.webContents.toggleDevTools();
    });
    
    // Disable KOOK AutoUpdate & HotUpdate IPC handlers
    _ipcMain.handle('check-update-get-config', () => null);
    _ipcMain.on('check-update-is-updating', (e) => { e.returnValue = false; });
    _ipcMain.on('autoUpdateInit', () => {});
    _ipcMain.on('autoUpdateChecking', () => {});
    _ipcMain.on('autoUpdateDownloading', () => {});
    _ipcMain.on('autoUpdateCompleted', () => {});
  }
} catch (_err) {}
`;
      mainContent = devToolsSnippet + '\n' + mainContent;
      fs.writeFileSync(mainEntryPath, mainContent, 'utf8');
      log(`  Patched main process entry: ${mainEntryRelative}`);
    }
  } catch (e) {
    warn(`Failed to patch main process: ${e.message}`);
  }
}

// --- Inject CSS ---
log('Injecting adblock CSS...');
const adblockCss = path.join(src, 'src', 'kook-adblock.css');
if (!fs.existsSync(adblockCss)) err('src/kook-adblock.css not found!');
fs.copyFileSync(adblockCss, path.join(buildDir, 'kook-adblock.css'));
log('Adblock CSS deployed');

// --- Inject sound JS ---
log('Injecting sound replacement...');
const soundJs = path.join(src, 'src', 'kook-sound.js');
if (fs.existsSync(soundJs)) fs.copyFileSync(soundJs, path.join(buildDir, 'kook-sound.js'));

// --- Inject enhance JS ---
log('Injecting enhance script...');
const enhanceJs = path.join(src, 'src', 'kook-enhance.js');
if (fs.existsSync(enhanceJs)) fs.copyFileSync(enhanceJs, path.join(buildDir, 'kook-enhance.js'));

// --- Inject no-streamer-mode JS ---
log('Injecting no-streamer-mode script...');
const noStreamerJs = path.join(src, 'src', 'kook-no-streamer-mode.js');
if (fs.existsSync(noStreamerJs)) fs.copyFileSync(noStreamerJs, path.join(buildDir, 'kook-no-streamer-mode.js'));

// --- Patch time format ---
log('Patching time format in JS bundles...');
const jsDir = path.join(buildDir, 'static', 'js');
if (fs.existsSync(jsDir)) {
  walkDir(jsDir, '.js', (filePath) => {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('.format("hh:mm")') || content.includes('.format("HH:mm")')) {
      const patched = content
        .replace(/\.format\("hh:mm"\)/g, '.format("hh:mm:ss")')
        .replace(/\.format\("HH:mm"\)/g, '.format("HH:mm:ss")');
      if (patched !== content) {
        fs.writeFileSync(filePath, patched);
        log(`  Patched: ${path.basename(filePath)}`);
      }
    }
  });
}

// --- Modify HTML ---
log('Modifying HTML entry files...');
const injectHead = '<link rel="stylesheet" href="/app/kook-adblock.css"><script src="/app/kook-sound.js"></script><script src="/app/kook-enhance.js"></script><script src="/app/kook-no-streamer-mode.js"></script></head>';
let htmCount = 0;
walkDir(buildDir, '.htm', (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  if (content.includes('hm.baidu.com')) {
    content = content.replace(/<script[^>]*src="https:\/\/hm\.baidu\.com\/hm\.js[^"]*"[^>]*><\/script>/g, '');
    modified = true;
  }
  if (content.includes('stylesheet') && !content.includes('kook-adblock.css')) {
    content = content.replace('</head>', injectHead);
    modified = true;
  }
  if (modified) {
    fs.writeFileSync(filePath, content);
    htmCount++;
  }
});
log(`Modified ${htmCount} HTML files`);

// --- Disable auto-update ---
log('Disabling auto-update...');
for (const ue of [path.join(appDir, 'Update.exe'), path.join(kookBase, 'Update.exe')]) {
  if (fs.existsSync(ue) && !fs.existsSync(ue + '.bak')) {
    fs.renameSync(ue, ue + '.bak');
    log(`Disabled: ${ue}`);
  }
}

// --- Repack ---
log('Repacking app.asar...');
if (fs.existsSync(unpackedDir)) {
  const oldUnpacked = path.join(resourcesDir, 'app.asar.unpacked.old');
  if (fs.existsSync(oldUnpacked)) fs.rmSync(oldUnpacked, { recursive: true, force: true });
  fs.renameSync(unpackedDir, oldUnpacked);
}
execSync('npx asar pack app-src app.asar --unpack-dir node_modules --unpack-dir resourse --unpack-dir src', { stdio: 'inherit', cwd: resourcesDir });
log('Repack done');

// --- Cleanup ---
log('Cleaning up...');
if (fs.existsSync(appSrc)) fs.rmSync(appSrc, { recursive: true, force: true });
const oldUnpacked = path.join(resourcesDir, 'app.asar.unpacked.old');
if (fs.existsSync(oldUnpacked)) fs.rmSync(oldUnpacked, { recursive: true, force: true });

// --- Done ---
const sizeMB = Math.round(fs.statSync(asar).size / (1024 * 1024));
console.log('');
console.log(`${GREEN}============================================${RST}`);
console.log(`${GREEN}  KOOK Patch Complete!${RST}`);
console.log(`${GREEN}  Size: ${sizeMB} MB  |  Backup: app.asar.bak${RST}`);
console.log(`${GREEN}============================================${RST}`);
console.log('');
log('Restart KOOK to apply changes.');
log(`To restore: copy '${asarBak}' over '${asar}'`);

// --- Helpers ---
function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirSync(s, d);
    else fs.copyFileSync(s, d);
  }
}

function walkDir(dir, ext, cb) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(p, ext, cb);
    else if (entry.name.endsWith(ext)) cb(p);
  }
}
