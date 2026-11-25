using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;

namespace KOOKPurifier.GUI
{
    public class RuleFile
    {
        public string FileName { get; private set; }
        public string ResourceName { get; private set; }

        public RuleFile(string fileName, string resourceName)
        {
            FileName = fileName;
            ResourceName = resourceName;
        }
    }

    public class RulePack
    {
        public string Version { get; set; }
        public bool FromRemote { get; set; }
        public bool FromCache { get; set; }
        public string Source { get; set; }
        public DateTime? FetchedAt { get; set; }
        public Dictionary<string, string> LocalFiles { get; set; }

        public RulePack()
        {
            LocalFiles = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }

        public string OriginLabel
        {
            get
            {
                if (FromRemote) return "在线规则 " + Version + "（获取于 " + RuleSync.FormatTime(FetchedAt) + "）";
                if (FromCache) return "缓存规则 " + Version + "（缓存于 " + RuleSync.FormatTime(FetchedAt) + "）";
                return "内置规则 " + Version;
            }
        }
    }

    internal class RuleStateEntry
    {
        [JsonProperty("sha256")] public string Sha256 { get; set; }
        [JsonProperty("size")] public long Size { get; set; }
    }

    internal class RuleState
    {
        [JsonProperty("source")] public string Source { get; set; }
        [JsonProperty("version")] public string Version { get; set; }
        [JsonProperty("fetchedAt")] public string FetchedAt { get; set; }
        [JsonProperty("files")] public Dictionary<string, RuleStateEntry> Files { get; set; }
    }

    public static class RuleSync
    {
        public static readonly RuleFile[] RuleFiles =
        {
            new RuleFile("kook-adblock.css", "KOOKPurifier.GUI.Resources.kook-adblock.css"),
            new RuleFile("kook-enhance.js", "KOOKPurifier.GUI.Resources.kook-enhance.js"),
            new RuleFile("kook-no-streamer-mode.js", "KOOKPurifier.GUI.Resources.kook-no-streamer-mode.js")
        };

        private const string GitHubBase = "https://raw.githubusercontent.com/Souma-Sumire/kook-purifier/main/src/";
        private const string JsDelivrBase = "https://cdn.jsdelivr.net/gh/Souma-Sumire/kook-purifier@main/src/";

        private const int RequestTimeoutMs = 5000;
        private const int SourceDeadlineMs = 12000;

        private static readonly Dictionary<string, DateTime> FailedSources = new Dictionary<string, DateTime>(StringComparer.OrdinalIgnoreCase);
        private static readonly TimeSpan FailedSourceCooldown = TimeSpan.FromMinutes(2);

        private static readonly HttpClient Http = CreateClient();

        public static string CacheDir
        {
            get
            {
                return Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "KOOKPurifier",
                    "rules");
            }
        }

        private static string StatePath
        {
            get { return Path.Combine(CacheDir, "state.json"); }
        }

        private static HttpClient CreateClient()
        {
            var client = new HttpClient();
            client.Timeout = TimeSpan.FromMilliseconds(RequestTimeoutMs + 2000);
            client.DefaultRequestHeaders.UserAgent.ParseAdd("KOOKPurifier/1.0");
            return client;
        }

        public static string EmbeddedVersion
        {
            get { return ReadEmbedded().Version; }
        }

        /// <summary>
        /// 让下次获取重新尝试此前失败的线路。
        /// </summary>
        public static void ResetFailures()
        {
            FailedSources.Clear();
        }

        /// <summary>
        /// 获取规则包：优先在线规则，失败依次回退本地缓存、内置资源。
        /// </summary>
        public static RulePack Acquire(Action<string> log)
        {
            string error = null;
            foreach (string source in BuildSources())
            {
                Dictionary<string, byte[]> files;
                string fetchError;
                if (!TryFetch(source, out files, out fetchError))
                {
                    FailedSources[source] = DateTime.UtcNow;
                    log("[警告] 规则源不可用：" + source + "（" + fetchError + "）");
                    error = fetchError;
                    continue;
                }

                string version = ComputeVersion(files);
                var previous = LoadCached();
                bool changed = previous == null || !string.Equals(previous.Version, version, StringComparison.OrdinalIgnoreCase);

                var pack = new RulePack
                {
                    Version = version,
                    FromRemote = true,
                    Source = source,
                    FetchedAt = DateTime.Now
                };

                try
                {
                    SaveCache(pack, files);
                }
                catch (Exception ex)
                {
                    log("[警告] 规则写入本地缓存失败：" + ex.Message);
                }

                log(changed
                    ? "[信息] 已同步" + pack.OriginLabel + "，来源 " + source
                    : "[信息] 在线规则已是最新：" + version + "，来源 " + source);
                return pack;
            }

            var cached = LoadCached();
            if (cached != null)
            {
                log("[警告] 在线规则获取失败（" + (error ?? "未知错误") + "），使用" + cached.OriginLabel);
                return cached;
            }

            var embedded = ReadEmbedded();
            log("[警告] 在线规则获取失败（" + (error ?? "未知错误") + "）且无本地缓存，使用" + embedded.OriginLabel);
            return embedded;
        }

        public static string FormatTime(DateTime? time)
        {
            return time.HasValue ? time.Value.ToString("yyyy-MM-dd HH:mm") : "未知时间";
        }

        private static List<string> BuildSources()
        {
            var list = new List<string>();

            // GitHub 直连取最新提交，jsDelivr 作为国内可达的备用线路（分支缓存可能滞后）
            foreach (string source in new[] { GitHubBase, JsDelivrBase })
            {
                if (!IsCoolingDown(source))
                    list.Add(source);
            }

            return list;
        }

        private static bool IsCoolingDown(string source)
        {
            DateTime failedAt;
            return FailedSources.TryGetValue(source, out failedAt) && DateTime.UtcNow - failedAt < FailedSourceCooldown;
        }

        private static string BuildUrl(string baseUrl, string fileName)
        {
            string url = baseUrl + fileName;

            // GitHub Raw 走 Fastly 缓存，带时间戳参数可确保拿到最新提交内容
            if (url.IndexOf("raw.githubusercontent.com", StringComparison.OrdinalIgnoreCase) >= 0)
                url += "?t=" + DateTimeOffset.UtcNow.ToUnixTimeSeconds();

            return url;
        }

        private static bool TryFetch(string baseUrl, out Dictionary<string, byte[]> files, out string error)
        {
            files = null;
            error = null;

            var result = new Dictionary<string, byte[]>(StringComparer.OrdinalIgnoreCase);
            var watch = Stopwatch.StartNew();

            foreach (var rule in RuleFiles)
            {
                if (watch.ElapsedMilliseconds > SourceDeadlineMs)
                {
                    error = "超时";
                    return false;
                }

                try
                {
                    using (var response = Http.GetAsync(BuildUrl(baseUrl, rule.FileName)).GetAwaiter().GetResult())
                    {
                        if (!response.IsSuccessStatusCode)
                        {
                            error = rule.FileName + " HTTP " + (int)response.StatusCode;
                            return false;
                        }

                        byte[] content = response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult();
                        if (content == null || content.Length < 128)
                        {
                            error = rule.FileName + " 内容异常";
                            return false;
                        }

                        result[rule.FileName] = NormalizeContent(content);
                    }
                }
                catch (Exception ex)
                {
                    error = rule.FileName + " " + Summarize(ex);
                    return false;
                }
            }

            files = result;
            return true;
        }

        private static string Summarize(Exception ex)
        {
            var aggregate = ex as AggregateException;
            if (aggregate != null && aggregate.InnerExceptions.Count > 0)
                ex = aggregate.InnerExceptions[0];

            if (ex is TaskCanceledException) return "请求超时";
            if (ex is HttpRequestException) return "网络不可达";
            return ex.Message;
        }

        private static RulePack ReadEmbedded()
        {
            Assembly asm = Assembly.GetExecutingAssembly();
            var files = new Dictionary<string, byte[]>(StringComparer.OrdinalIgnoreCase);

            foreach (var rule in RuleFiles)
            {
                using (Stream stream = asm.GetManifestResourceStream(rule.ResourceName))
                {
                    if (stream == null)
                        throw new Exception("资源未找到: " + rule.ResourceName);

                    using (var ms = new MemoryStream())
                    {
                        stream.CopyTo(ms);
                        files[rule.FileName] = NormalizeContent(ms.ToArray());
                    }
                }
            }

            return new RulePack
            {
                Version = ComputeVersion(files),
                FromRemote = false,
                FetchedAt = null
            };
        }

        private static RulePack LoadCached()
        {
            try
            {
                if (!File.Exists(StatePath)) return null;

                var state = JsonConvert.DeserializeObject<RuleState>(File.ReadAllText(StatePath, Encoding.UTF8));
                if (state == null || state.Files == null || state.Files.Count == 0) return null;

                var pack = new RulePack
                {
                    Version = state.Version,
                    FromCache = true,
                    Source = state.Source,
                    FetchedAt = ParseTime(state.FetchedAt)
                };

                foreach (var rule in RuleFiles)
                {
                    RuleStateEntry entry;
                    if (!state.Files.TryGetValue(rule.FileName, out entry) || entry == null) return null;

                    string path = Path.Combine(CacheDir, rule.FileName);
                    if (!File.Exists(path)) return null;

                    byte[] content = File.ReadAllBytes(path);
                    if (content.Length != entry.Size) return null;
                    if (!string.Equals(Hash(content), entry.Sha256, StringComparison.OrdinalIgnoreCase)) return null;

                    pack.LocalFiles[rule.FileName] = path;
                }

                return pack;
            }
            catch
            {
                return null;
            }
        }

        private static void SaveCache(RulePack pack, Dictionary<string, byte[]> files)
        {
            Directory.CreateDirectory(CacheDir);

            var state = new RuleState
            {
                Source = pack.Source,
                Version = pack.Version,
                FetchedAt = pack.FetchedAt.HasValue ? pack.FetchedAt.Value.ToString("o") : null,
                Files = new Dictionary<string, RuleStateEntry>(StringComparer.OrdinalIgnoreCase)
            };

            foreach (var rule in RuleFiles)
            {
                byte[] content = files[rule.FileName];
                string target = Path.Combine(CacheDir, rule.FileName);
                string temp = target + ".tmp";

                File.WriteAllBytes(temp, content);
                File.Copy(temp, target, true);
                File.Delete(temp);

                state.Files[rule.FileName] = new RuleStateEntry
                {
                    Sha256 = Hash(content),
                    Size = content.Length
                };
                pack.LocalFiles[rule.FileName] = target;
            }

            File.WriteAllText(StatePath, JsonConvert.SerializeObject(state, Formatting.Indented), Encoding.UTF8);
        }

        private static DateTime? ParseTime(string value)
        {
            if (string.IsNullOrEmpty(value)) return null;

            DateTimeOffset offset;
            if (DateTimeOffset.TryParse(value, out offset)) return offset.LocalDateTime;

            DateTime local;
            if (DateTime.TryParse(value, out local)) return local;

            return null;
        }

        private static byte[] NormalizeContent(byte[] content)
        {
            if (content == null || content.Length == 0) return content;

            string text;
            try
            {
                text = new UTF8Encoding(false, true).GetString(content);
            }
            catch (ArgumentException)
            {
                // 非 UTF-8 内容不做改动，按原始字节比较
                return content;
            }

            if (text.IndexOf('\r') < 0) return content;

            text = text.Replace("\r\n", "\n").Replace('\r', '\n');
            return new UTF8Encoding(false).GetBytes(text);
        }

        private static string ComputeVersion(Dictionary<string, byte[]> files)
        {
            using (var sha = SHA256.Create())
            using (var combined = new MemoryStream())
            {
                foreach (var rule in RuleFiles)
                {
                    byte[] content;
                    if (!files.TryGetValue(rule.FileName, out content) || content == null)
                        return "00000000";

                    byte[] digest = sha.ComputeHash(content);
                    combined.Write(digest, 0, digest.Length);
                }

                byte[] version = sha.ComputeHash(combined.ToArray());
                return ToHex(version).Substring(0, 8);
            }
        }

        private static string Hash(byte[] content)
        {
            using (var sha = SHA256.Create())
                return ToHex(sha.ComputeHash(content));
        }

        private static string ToHex(byte[] bytes)
        {
            var sb = new StringBuilder(bytes.Length * 2);
            foreach (byte b in bytes)
                sb.Append(b.ToString("x2"));
            return sb.ToString();
        }
    }
}
