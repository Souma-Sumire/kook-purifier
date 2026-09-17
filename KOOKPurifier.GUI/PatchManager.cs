using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Text.RegularExpressions;
using Newtonsoft.Json;

namespace KOOKPurifier.GUI
{
    public class PatchOptions
    {
        public bool AdBlock { get; set; }
        public bool Enhance { get; set; }
        public bool EnableDevTools { get; set; }
        public bool NoStreamer { get; set; }
        public bool DisableUpdate { get; set; }

        public PatchOptions()
        {
            AdBlock = true;
            Enhance = true;
            EnableDevTools = true;
            NoStreamer = true;
            DisableUpdate = true;
        }
    }

    public static class PatchManager
    {
        public static string FindKookDir()
        {
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string kookBase = Path.Combine(localAppData, "KOOK");

            if (!Directory.Exists(kookBase))
                return null;

            var dirs = new List<string>(Directory.GetDirectories(kookBase, "app-*"));
            if (dirs.Count == 0)
                return null;

            dirs.Sort((a, b) =>
            {
                var va = ParseVersion(Path.GetFileName(a));
                var vb = ParseVersion(Path.GetFileName(b));
                return vb.CompareTo(va);
            });

            return dirs[0];
        }

        private static Version ParseVersion(string dirName)
        {
            string clean = dirName.Replace("app-", "");
            Version v;
            if (Version.TryParse(clean, out v))
                return v;
            return new Version(0, 0, 0);
        }

        public static string ResolveAppDir(string inputPath)
        {
            if (string.IsNullOrWhiteSpace(inputPath)) return null;

            string path = inputPath.Trim().Trim('"', '\'');
            if (File.Exists(path))
            {
                path = Path.GetDirectoryName(path);
            }

            if (!Directory.Exists(path)) return null;

            // 若当前目录存在 resources，则本身就是目标 app-* 目录
            if (Directory.Exists(Path.Combine(path, "resources")))
            {
                return path;
            }

            // 若用户选的是 resources 目录自身，退回上一级
            string folderName = Path.GetFileName(path.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar));
            if (string.Equals(folderName, "resources", StringComparison.OrdinalIgnoreCase))
            {
                string parent = Path.GetDirectoryName(path.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar));
                if (!string.IsNullOrEmpty(parent) && Directory.Exists(Path.Combine(parent, "resources")))
                {
                    return parent;
                }
            }

            // 若用户选的是 KOOK 根目录（例如 AppData\Local\KOOK），自动选择版本号最新的 app-* 目录
            var subDirs = new List<string>(Directory.GetDirectories(path, "app-*"));
            if (subDirs.Count > 0)
            {
                subDirs.Sort((a, b) =>
                {
                    var va = ParseVersion(Path.GetFileName(a));
                    var vb = ParseVersion(Path.GetFileName(b));
                    return vb.CompareTo(va);
                });
                return subDirs[0];
            }

            return path;
        }

        public static bool IsKookRunning()
        {
            Process[] procs = Process.GetProcessesByName("KOOK");
            return procs != null && procs.Length > 0;
        }

        public static bool KillKookProcess(int timeoutMs = 5000)
        {
            try
            {
                Process[] procs = Process.GetProcessesByName("KOOK");
                if (procs == null || procs.Length == 0) return true;

                foreach (var p in procs)
                {
                    try { p.Kill(); } catch { }
                }

                var sw = System.Diagnostics.Stopwatch.StartNew();
                while (sw.ElapsedMilliseconds < timeoutMs)
                {
                    Process[] remaining = Process.GetProcessesByName("KOOK");
                    if (remaining == null || remaining.Length == 0)
                    {
                        System.Threading.Thread.Sleep(300);
                        return true;
                    }
                    System.Threading.Thread.Sleep(100);
                }
                return !IsKookRunning();
            }
            catch
            {
                return false;
            }
        }

        public static bool ApplyPatch(string inputDir, PatchOptions options, Action<string> log)
        {
            string appDir = ResolveAppDir(inputDir);
            if (string.IsNullOrEmpty(appDir) || !Directory.Exists(appDir))
            {
                log("[错误] 无效的 KOOK 安装目录: " + (inputDir ?? "空"));
                return false;
            }

            if (IsKookRunning())
            {
                log("[警告] 检测到 KOOK 正在运行，请先关闭 KOOK 客户端！");
                return false;
            }

            string resourcesDir = Path.Combine(appDir, "resources");
            string asarPath = Path.Combine(resourcesDir, "app.asar");
            string asarBakPath = Path.Combine(resourcesDir, "app.asar.bak");
            string tempSrcDir = Path.Combine(resourcesDir, "app-src-temp");

            if (!File.Exists(asarPath))
            {
                log("[错误] 未找到 app.asar 文件: " + asarPath);
                return false;
            }

            // 1. 备份 app.asar
            if (!File.Exists(asarBakPath))
            {
                File.Copy(asarPath, asarBakPath);
                log("[信息] 备份保存成功: app.asar.bak");
            }
            else
            {
                log("[信息] 检测到已存在备份文件: app.asar.bak");
            }

            // 备份 unpacked 文件夹
            string unpackedDir = Path.Combine(resourcesDir, "app.asar.unpacked");
            string unpackedBakDir = Path.Combine(resourcesDir, "app.asar.unpacked.bak");
            string asarBakUnpackedDir = Path.Combine(resourcesDir, "app.asar.bak.unpacked");

            if (Directory.Exists(unpackedDir) && !Directory.Exists(unpackedBakDir))
            {
                CopyDirectorySync(unpackedDir, unpackedBakDir);
                log("[信息] 备份保存成功: app.asar.unpacked.bak");
            }

            if (!Directory.Exists(asarBakUnpackedDir))
            {
                if (Directory.Exists(unpackedBakDir))
                    CopyDirectorySync(unpackedBakDir, asarBakUnpackedDir);
                else if (Directory.Exists(unpackedDir))
                    CopyDirectorySync(unpackedDir, asarBakUnpackedDir);
            }

            try
            {
                // 2. 解包
                log("[信息] 正在解包 app.asar ...");
                if (Directory.Exists(tempSrcDir))
                    Directory.Delete(tempSrcDir, true);

                AsarEngine.Extract(File.Exists(asarBakPath) ? asarBakPath : asarPath, tempSrcDir);
                log("[信息] 解包完成。");

                // 3. 修补主进程 (DevTools & Update IPC)
                if (options.EnableDevTools)
                {
                    PatchMainProcess(tempSrcDir, log);
                }

                // 4. 部署静态资源与注入 HTML
                string buildDir = Path.Combine(tempSrcDir, "webapp", "build");
                if (Directory.Exists(buildDir))
                    PatchWebapp(buildDir, options, log);

                // 5. 打包重装 app.asar
                log("[信息] 正在重新打包 app.asar ...");
                AsarEngine.Pack(tempSrcDir, asarPath);
                log("[信息] 打包成功: app.asar");

                // 6. 根据选项处理 Update.exe 启动引导程序
                if (options.DisableUpdate)
                {
                    DisableUpdateExe(appDir, log);
                }
                else
                {
                    EnsureUpdateExeRestored(appDir, log);
                }

                // 7. 清理临时目录
                if (Directory.Exists(tempSrcDir))
                    Directory.Delete(tempSrcDir, true);

                log("========================================");
                log("  KOOK 客户端净化修补成功！");
                log("========================================");
                return true;
            }
            catch (Exception ex)
            {
                log("[错误] 修补过程中发生异常: " + ex.Message);
                if (Directory.Exists(tempSrcDir))
                {
                    try { Directory.Delete(tempSrcDir, true); } catch { }
                }
                return false;
            }
        }

        public static bool RestorePatch(string inputDir, Action<string> log)
        {
            string appDir = ResolveAppDir(inputDir);
            if (string.IsNullOrEmpty(appDir) || !Directory.Exists(appDir))
            {
                log("[错误] 无效的 KOOK 安装目录: " + (inputDir ?? "空"));
                return false;
            }

            if (IsKookRunning())
            {
                log("[提示] 检测到 KOOK 进程正在运行，正在关闭...");
                if (!KillKookProcess(3000))
                {
                    log("[警告] 检测到 KOOK 仍有进程占用，请手动在任务管理器关闭 KOOK 后重试！");
                    return false;
                }
            }

            string resourcesDir = Path.Combine(appDir, "resources");
            if (!Directory.Exists(resourcesDir))
            {
                log("[错误] 未在目标目录中找到 resources 文件夹: " + appDir);
                return false;
            }

            string asarPath = Path.Combine(resourcesDir, "app.asar");
            string asarBakPath = Path.Combine(resourcesDir, "app.asar.bak");
            string unpackedDir = Path.Combine(resourcesDir, "app.asar.unpacked");

            string unpackedBakDir = Path.Combine(resourcesDir, "app.asar.unpacked.bak");
            if (!Directory.Exists(unpackedBakDir))
            {
                string altBak = Path.Combine(resourcesDir, "app.asar.bak.unpacked");
                if (Directory.Exists(altBak)) unpackedBakDir = altBak;
            }

            bool restored = false;

            if (File.Exists(asarBakPath))
            {
                int retry = 3;
                while (retry-- > 0)
                {
                    try
                    {
                        File.Copy(asarBakPath, asarPath, true);
                        log("[信息] 已恢复原始 app.asar 文件。");
                        restored = true;
                        break;
                    }
                    catch (Exception ex)
                    {
                        if (retry > 0)
                        {
                            System.Threading.Thread.Sleep(300);
                        }
                        else
                        {
                            log("[错误] 还原 app.asar 失败 (可能文件被占用): " + ex.Message);
                        }
                    }
                }
            }
            else
            {
                log("[警告] 未在 " + resourcesDir + " 找到 app.asar.bak 备份文件。");
            }

            if (Directory.Exists(unpackedBakDir))
            {
                try
                {
                    if (Directory.Exists(unpackedDir))
                    {
                        try { Directory.Delete(unpackedDir, true); } catch { }
                    }
                    CopyDirectorySync(unpackedBakDir, unpackedDir);
                    log("[信息] 已恢复原始 app.asar.unpacked 目录。");
                    restored = true;
                }
                catch (Exception ex)
                {
                    log("[警告] 恢复 app.asar.unpacked 时发生异常: " + ex.Message);
                }
            }

            EnsureUpdateExeRestored(appDir, log);

            if (restored)
            {
                log("========================================");
                log("  KOOK 官方客户端已成功还原！");
                log("========================================");
            }

            return restored;
        }

        private static void PatchMainProcess(string tempSrcDir, Action<string> log)
        {
            string pkgPath = Path.Combine(tempSrcDir, "package.json");
            if (!File.Exists(pkgPath)) return;

            string mainEntryRelative = "index.js";
            try
            {
                string pkgJson = File.ReadAllText(pkgPath);
                var dict = JsonConvert.DeserializeObject<Dictionary<string, object>>(pkgJson);
                if (dict != null && dict.ContainsKey("main"))
                    mainEntryRelative = dict["main"].ToString();
            }
            catch { }

            string mainEntryPath = Path.Combine(tempSrcDir, mainEntryRelative);
            if (!File.Exists(mainEntryPath)) return;

            string mainContent = File.ReadAllText(mainEntryPath);
            if (mainContent.Contains("toggle-devtools"))
            {
                log("[信息] 主进程已有 DevTools 解锁逻辑，跳过注入。");
                return;
            }

            mainContent = Regex.Replace(mainContent, @"devTools\s*:\s*(!1|false)", "devTools: true");

            string devToolsSnippet = @"
try {
  const { app: _app, BrowserWindow: _BrowserWindow, ipcMain: _ipcMain, autoUpdater: _autoUpdater } = require('electron');
  
  if (_autoUpdater) {
    try { _autoUpdater.checkForUpdates = () => {}; } catch (_) {}
    try { _autoUpdater.quitAndInstall = () => {}; } catch (_) {}
  }

  let _devToolsEnabled = true;

  if (_ipcMain) {
    try {
      _ipcMain.on('set-devtools-enabled', (event, val) => {
        _devToolsEnabled = !!val;
      });
      _ipcMain.on('toggle-devtools', (event) => {
        if (!_devToolsEnabled) return;
        const win = _BrowserWindow.fromWebContents(event.sender);
        if (win) win.webContents.toggleDevTools();
      });
    } catch (_) {}
    
    try { _ipcMain.handle('check-update-get-config', () => null); } catch (_) {}
    try { _ipcMain.on('check-update-is-updating', (e) => { e.returnValue = false; }); } catch (_) {}
    try { _ipcMain.on('autoUpdateInit', () => {}); } catch (_) {}
    try { _ipcMain.on('autoUpdateChecking', () => {}); } catch (_) {}
    try { _ipcMain.on('autoUpdateDownloading', () => {}); } catch (_) {}
    try { _ipcMain.on('autoUpdateCompleted', () => {}); } catch (_) {}
  }

  _app.on('browser-window-created', (event, win) => {
    win.webContents.on('before-input-event', (e, input) => {
      if (!_devToolsEnabled) return;
      if (input.type === 'keyDown') {
        const isF12 = input.key === 'F12';
        const isCtrlShiftI = (input.control || input.meta) && input.shift && (input.key === 'I' || input.key === 'i');
        if (isF12 || isCtrlShiftI) {
          win.webContents.toggleDevTools();
        }
      }
    });
  });
} catch (_err) {}
";
            mainContent = devToolsSnippet + "\n" + mainContent;
            File.WriteAllText(mainEntryPath, mainContent);
            log("[信息] 主进程注入 DevTools 解锁逻辑: " + mainEntryRelative);
        }

        private static void PatchWebapp(string buildDir, PatchOptions options, Action<string> log)
        {
            Assembly asm = Assembly.GetExecutingAssembly();

            if (options.AdBlock)
            {
                ExtractResource(asm, "KOOKPurifier.GUI.Resources.kook-adblock.css", Path.Combine(buildDir, "kook-adblock.css"));
                log("[信息] 已部署 kook-adblock.css");
            }

            if (options.Enhance)
            {
                ExtractResource(asm, "KOOKPurifier.GUI.Resources.kook-enhance.js", Path.Combine(buildDir, "kook-enhance.js"));
                log("[信息] 已部署 kook-enhance.js");
            }

            if (options.NoStreamer)
            {
                ExtractResource(asm, "KOOKPurifier.GUI.Resources.kook-no-streamer-mode.js", Path.Combine(buildDir, "kook-no-streamer-mode.js"));
                log("[信息] 已部署 kook-no-streamer-mode.js");
            }

            var headTags = new List<string>();
            if (options.AdBlock) headTags.Add("<link rel=\"stylesheet\" href=\"/app/kook-adblock.css\">");
            if (options.Enhance) headTags.Add("<script src=\"/app/kook-enhance.js\"></script>");
            if (options.NoStreamer) headTags.Add("<script src=\"/app/kook-no-streamer-mode.js\"></script>");

            if (headTags.Count == 0) return;

            string injectHead = string.Join("", headTags) + "</head>";
            int htmCount = 0;

            foreach (string file in Directory.GetFiles(buildDir, "*.htm*", SearchOption.AllDirectories))
            {
                string content = File.ReadAllText(file);
                bool modified = false;

                if (content.Contains("hm.baidu.com"))
                {
                    content = Regex.Replace(content, @"<script[^>]*src=""https://hm\.baidu\.com/hm\.js[^""]*""[^>]*></script>", "");
                    modified = true;
                }

                if (content.Contains("stylesheet") && !content.Contains("kook-adblock.css") && !content.Contains("kook-enhance.js"))
                {
                    content = content.Replace("</head>", injectHead);
                    modified = true;
                }

                if (modified)
                {
                    File.WriteAllText(file, content);
                    htmCount++;
                }
            }

            log(string.Format("[信息] 已完成修补 {0} 个 HTML 入口文件。", htmCount));
        }

        private static void DisableUpdateExe(string appDir, Action<string> log)
        {
            string kookBase = Path.GetDirectoryName(appDir);
            foreach (string dir in new[] { appDir, kookBase })
            {
                if (string.IsNullOrEmpty(dir)) continue;
                string ue = Path.Combine(dir, "Update.exe");
                string ueBak = ue + ".bak";
                if (File.Exists(ue) && !File.Exists(ueBak))
                {
                    try
                    {
                        File.Move(ue, ueBak);
                        log("[信息] 已禁用启动引导程序: " + ue);
                    }
                    catch (Exception ex)
                    {
                        log("[警告] 禁用 " + ue + " 失败: " + ex.Message);
                    }
                }
            }
        }

        private static void ExtractResource(Assembly asm, string resourceName, string destPath)
        {
            using (Stream stream = asm.GetManifestResourceStream(resourceName))
            {
                if (stream == null)
                    throw new Exception("资源未找到: " + resourceName);

                using (FileStream fs = new FileStream(destPath, FileMode.Create, FileAccess.Write))
                {
                    stream.CopyTo(fs);
                }
            }
        }

        private static void EnsureUpdateExeRestored(string appDir, Action<string> log)
        {
            string kookBase = Path.GetDirectoryName(appDir);
            foreach (string dir in new[] { appDir, kookBase })
            {
                if (string.IsNullOrEmpty(dir)) continue;
                string ue = Path.Combine(dir, "Update.exe");
                string ueBak = ue + ".bak";
                if (File.Exists(ueBak))
                {
                    if (File.Exists(ue)) File.Delete(ue);
                    File.Move(ueBak, ue);
                    log("[信息] 已恢复启动引导程序: " + ue);
                }
            }
        }

        private static void CopyDirectorySync(string src, string dest)
        {
            if (!Directory.Exists(dest)) Directory.CreateDirectory(dest);
            var dir = new DirectoryInfo(src);

            foreach (var file in dir.GetFiles())
            {
                file.CopyTo(Path.Combine(dest, file.Name), true);
            }

            foreach (var subDir in dir.GetDirectories())
            {
                CopyDirectorySync(subDir.FullName, Path.Combine(dest, subDir.Name));
            }
        }
    }
}
