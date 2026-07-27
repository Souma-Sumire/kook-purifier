using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using Newtonsoft.Json;

namespace KOOKPurifier.GUI
{
    public class AsarFileNode
    {
        public int size { get; set; }
        public string offset { get; set; }
        public bool? unpacked { get; set; }
        public Dictionary<string, AsarFileNode> files { get; set; }
    }

    public class AsarHeader
    {
        public Dictionary<string, AsarFileNode> files { get; set; }
    }

    public static class AsarEngine
    {
        public static void Extract(string asarPath, string destDir)
        {
            if (!File.Exists(asarPath))
                throw new FileNotFoundException("ASAR 文件未找到: " + asarPath);

            string resourcesDir = Path.GetDirectoryName(asarPath);
            var unpackedSearchPaths = new List<string>
            {
                asarPath + ".unpacked",
                Path.Combine(resourcesDir, "app.asar.unpacked.bak"),
                Path.Combine(resourcesDir, "app.asar.bak.unpacked"),
                Path.Combine(resourcesDir, "app.asar.unpacked")
            };

            using (var fs = new FileStream(asarPath, FileMode.Open, FileAccess.Read, FileShare.Read))
            using (var br = new BinaryReader(fs))
            {
                int sizeLen = br.ReadInt32();
                if (sizeLen != 4)
                    throw new InvalidDataException("不是有效的 ASAR 文件（pickle 头部校验失败）");

                int headerSize = br.ReadInt32();
                int headerSize4 = br.ReadInt32();
                int jsonLen = br.ReadInt32();

                if (jsonLen <= 0 || jsonLen > 100 * 1024 * 1024)
                    throw new InvalidDataException("ASAR 文件头异常：JSON 长度不合法");

                byte[] jsonBytes = br.ReadBytes(jsonLen);
                string jsonStr = Encoding.UTF8.GetString(jsonBytes);

                long baseOffset = 8 + headerSize;

                var header = JsonConvert.DeserializeObject<AsarHeader>(jsonStr);

                if (header == null || header.files == null)
                    throw new InvalidOperationException("ASAR 头部解析失败，缺少 files 节点");

                ExtractNode(header.files, destDir, "", fs, baseOffset, unpackedSearchPaths);
            }
        }

        private static void ExtractNode(Dictionary<string, AsarFileNode> files, string currentDir, string relativePath, FileStream fs, long baseOffset, List<string> unpackedSearchPaths)
        {
            if (!Directory.Exists(currentDir))
                Directory.CreateDirectory(currentDir);

            foreach (var kv in files)
            {
                string name = kv.Key;
                AsarFileNode node = kv.Value;
                string targetPath = Path.Combine(currentDir, name);
                string currentRelativePath = string.IsNullOrEmpty(relativePath) ? name : Path.Combine(relativePath, name);

                if (node.files != null)
                {
                    ExtractNode(node.files, targetPath, currentRelativePath, fs, baseOffset, unpackedSearchPaths);
                }
                else
                {
                    string parentDir = Path.GetDirectoryName(targetPath);
                    if (!string.IsNullOrEmpty(parentDir) && !Directory.Exists(parentDir))
                        Directory.CreateDirectory(parentDir);

                    bool isUnpacked = node.unpacked == true || string.IsNullOrEmpty(node.offset);

                    if (isUnpacked)
                    {
                        bool found = false;
                        foreach (string unpackedDir in unpackedSearchPaths)
                        {
                            if (string.IsNullOrEmpty(unpackedDir) || !Directory.Exists(unpackedDir))
                                continue;

                            string realFilePath = Path.Combine(unpackedDir, currentRelativePath);
                            if (File.Exists(realFilePath) && new FileInfo(realFilePath).Length > 0)
                            {
                                File.Copy(realFilePath, targetPath, true);
                                found = true;
                                break;
                            }
                        }

                        if (!found)
                        {
                            File.WriteAllBytes(targetPath, new byte[0]);
                        }
                        continue;
                    }

                    long fileOffset = baseOffset + long.Parse(node.offset);
                    int fileSize = node.size;

                    fs.Seek(fileOffset, SeekOrigin.Begin);
                    byte[] buffer = new byte[fileSize];
                    int totalRead = 0;
                    while (totalRead < fileSize)
                    {
                        int read = fs.Read(buffer, totalRead, fileSize - totalRead);
                        if (read <= 0)
                            throw new EndOfStreamException(string.Format("解包读取数据遇到意外末尾: {0} (已读 {1}/{2} 字节)", currentRelativePath, totalRead, fileSize));
                        totalRead += read;
                    }

                    File.WriteAllBytes(targetPath, buffer);
                }
            }
        }

        public static void Pack(string srcDir, string asarPath)
        {
            if (!Directory.Exists(srcDir))
                throw new DirectoryNotFoundException("源目录未找到: " + srcDir);

            string unpackedDir = asarPath + ".unpacked";
            if (Directory.Exists(unpackedDir))
            {
                try { Directory.Delete(unpackedDir, true); } catch { }
            }

            var rootFilesDict = new Dictionary<string, object>();
            var fileList = new List<string>();
            long currentOffset = 0;

            BuildNodeRecursive(srcDir, srcDir, rootFilesDict, fileList, ref currentOffset, unpackedDir);

            var headerDict = new Dictionary<string, object>
            {
                { "files", rootFilesDict }
            };

            string jsonStr = JsonConvert.SerializeObject(headerDict);

            byte[] jsonBytes = Encoding.UTF8.GetBytes(jsonStr);

            int jsonLen = jsonBytes.Length;
            int alignedJsonLen = (jsonLen + 3) & ~3;
            byte[] paddedJsonBytes = new byte[alignedJsonLen];
            Array.Copy(jsonBytes, paddedJsonBytes, jsonLen);

            int headerSize = alignedJsonLen + 8;
            int headerSize4 = alignedJsonLen + 4;
            int sizeLen = 4;

            string dirName = Path.GetDirectoryName(asarPath);
            if (!string.IsNullOrEmpty(dirName) && !Directory.Exists(dirName))
                Directory.CreateDirectory(dirName);

            string tempAsarPath = asarPath + ".tmp";
            if (File.Exists(tempAsarPath))
            {
                try { File.Delete(tempAsarPath); } catch { }
            }

            using (var fs = new FileStream(tempAsarPath, FileMode.Create, FileAccess.Write, FileShare.None))
            using (var bw = new BinaryWriter(fs))
            {
                bw.Write(sizeLen);
                bw.Write(headerSize);
                bw.Write(headerSize4);
                bw.Write(jsonLen);
                bw.Write(paddedJsonBytes);

                foreach (string filePath in fileList)
                {
                    byte[] content = File.ReadAllBytes(filePath);
                    bw.Write(content);
                }
            }

            for (int attempt = 0; attempt < 10; attempt++)
            {
                try
                {
                    File.Copy(tempAsarPath, asarPath, true);
                    File.Delete(tempAsarPath);
                    break;
                }
                catch (IOException)
                {
                    if (attempt == 9) throw;
                    System.Threading.Thread.Sleep(500);
                }
            }
        }

        private static void BuildNodeRecursive(string rootDir, string currentDir, Dictionary<string, object> parentDict, List<string> fileList, ref long currentOffset, string unpackedDir)
        {
            var dirInfo = new DirectoryInfo(currentDir);

            var files = dirInfo.GetFiles().OrderBy(f => f.Name, StringComparer.Ordinal).ToArray();
            var dirs = dirInfo.GetDirectories().OrderBy(d => d.Name, StringComparer.Ordinal).ToArray();

            // 1. 先打包文件节点（匹配 official asar 规范）
            foreach (var file in files)
            {
                string relativePath = GetRelativePath(rootDir, file.FullName);
                bool isUnpacked = ShouldUnpackFile(relativePath);

                var fileNode = new Dictionary<string, object>
                {
                    { "size", (int)file.Length }
                };

                if (isUnpacked)
                {
                    fileNode["unpacked"] = true;

                    string targetUnpackedPath = Path.Combine(unpackedDir, relativePath);
                    string targetUnpackedDir = Path.GetDirectoryName(targetUnpackedPath);
                    if (!string.IsNullOrEmpty(targetUnpackedDir) && !Directory.Exists(targetUnpackedDir))
                        Directory.CreateDirectory(targetUnpackedDir);

                    File.Copy(file.FullName, targetUnpackedPath, true);
                    parentDict[file.Name] = fileNode;
                    // unpacked 文件不计入 offset，也不写入 asar payload fileList
                }
                else
                {
                    fileNode["offset"] = currentOffset.ToString();
                    parentDict[file.Name] = fileNode;
                    fileList.Add(file.FullName);
                    currentOffset += file.Length;
                }
            }

            // 2. 再递归打包子目录
            foreach (var dir in dirs)
            {
                var subFilesDict = new Dictionary<string, object>();
                var dirNode = new Dictionary<string, object>
                {
                    { "files", subFilesDict }
                };
                parentDict[dir.Name] = dirNode;
                BuildNodeRecursive(rootDir, dir.FullName, subFilesDict, fileList, ref currentOffset, unpackedDir);
            }
        }

        private static bool ShouldUnpackFile(string relativePath)
        {
            string normalized = relativePath.Replace('/', '\\').ToLowerInvariant();

            if (normalized.EndsWith(".node") || normalized.EndsWith(".dll"))
                return true;

            if (normalized.StartsWith("node_modules\\agora-electron-sdk\\"))
                return true;

            if ((normalized.StartsWith("resourse\\") || normalized.StartsWith("resources\\")) && normalized.EndsWith(".ico"))
                return true;

            if (normalized.Equals("src\\channelconfig.json"))
                return true;

            return false;
        }

        private static string GetRelativePath(string relativeTo, string path)
        {
            if (!relativeTo.EndsWith("\\") && !relativeTo.EndsWith("/"))
                relativeTo += "\\";

            if (path.StartsWith(relativeTo, StringComparison.OrdinalIgnoreCase))
                return path.Substring(relativeTo.Length);

            return path;
        }
    }
}
