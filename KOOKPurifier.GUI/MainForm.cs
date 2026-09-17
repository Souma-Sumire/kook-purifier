using System;
using System.Drawing;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace KOOKPurifier.GUI
{
    public partial class MainForm : Form
    {
        private const int COLLAPSED_HEIGHT = 116;
        private const int EXPANDED_HEIGHT = 300;

        public MainForm()
        {
            InitializeComponent();
        }

        private void MainForm_Load(object sender, EventArgs e)
        {
            this.ClientSize = new Size(480, COLLAPSED_HEIGHT);
            txtLog.Visible = false;
            Log("欢迎使用 KOOK Purifier！");
            DetectKookDir();
        }

        private void SetStatus(string text, Color? color = null)
        {
            if (InvokeRequired)
            {
                Invoke(new Action<string, Color?>(SetStatus), text, color);
                return;
            }
            lblStatus.Text = text;
            lblStatus.ForeColor = color ?? Color.DimGray;
        }

        private void ExpandLogWindow()
        {
            if (InvokeRequired)
            {
                Invoke(new Action(ExpandLogWindow));
                return;
            }
            this.ClientSize = new Size(480, EXPANDED_HEIGHT);
            txtLog.Visible = true;
        }

        private void Log(string msg)
        {
            if (InvokeRequired)
            {
                Invoke(new Action<string>(Log), msg);
                return;
            }

            string time = DateTime.Now.ToString("HH:mm:ss");
            txtLog.AppendText(string.Format("[{0}] {1}{2}", time, msg, Environment.NewLine));
        }

        private void DetectKookDir()
        {
            string kookDir = PatchManager.FindKookDir();
            if (!string.IsNullOrEmpty(kookDir))
            {
                txtPath.Text = kookDir;
                string dirName = Path.GetFileName(kookDir.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar));
                SetStatus("状态：已就绪 (" + dirName + ")");
                Log("自动识别 KOOK 目录: " + kookDir);
            }
            else
            {
                SetStatus("状态：请点击“浏览”选择 KOOK 目录", Color.FromArgb(180, 100, 0));
                Log("[提示] 未能自动识别 KOOK 目录，请手动点击“浏览”选择。");
            }
        }

        private void btnBrowse_Click(object sender, EventArgs e)
        {
            using (var dialog = new FolderBrowserDialog())
            {
                dialog.Description = "请选择 KOOK 安装目录或 app-* 目录";
                if (dialog.ShowDialog() == DialogResult.OK)
                {
                    txtPath.Text = dialog.SelectedPath;
                    SetStatus("状态：已选择目录");
                    Log("已选择目录: " + dialog.SelectedPath);
                }
            }
        }

        private async void btnApply_Click(object sender, EventArgs e)
        {
            string path = txtPath.Text.Trim();
            if (string.IsNullOrEmpty(path) || !Directory.Exists(path))
            {
                MessageBox.Show("请先选择有效的 KOOK 客户端安装目录！", "提示", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            if (PatchManager.IsKookRunning())
            {
                var result = MessageBox.Show("检测到 KOOK 正在运行，是否关闭 KOOK 客户端？", "确认关闭", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
                if (result == DialogResult.Yes)
                {
                    PatchManager.KillKookProcess();
                    Log("已结束 KOOK 进程。");
                }
                else
                {
                    SetStatus("状态：操作已取消");
                    return;
                }
            }

            SetControlsEnabled(false);
            SetStatus("状态：正在净化修补...", Color.FromArgb(0, 102, 204));

            var options = new PatchOptions();
            bool success = false;
            await Task.Run(() =>
            {
                success = PatchManager.ApplyPatch(path, options, Log);
            });

            SetControlsEnabled(true);

            if (success)
            {
                SetStatus("状态：修补成功！重新启动 KOOK 即可生效", Color.FromArgb(46, 125, 50));
                var dr = MessageBox.Show("修补成功！重新启动 KOOK 客户端即可生效。\n\n是否立即启动 KOOK 客户端？", "完成", MessageBoxButtons.YesNo, MessageBoxIcon.Information);
                if (dr == DialogResult.Yes)
                {
                    PatchManager.LaunchKook(path);
                    Log("已拉起 KOOK 客户端进程。");
                }
            }
            else
            {
                SetStatus("状态：修补失败，已展开日志", Color.FromArgb(198, 40, 40));
                ExpandLogWindow();
                MessageBox.Show("修补失败，已为您展开下方日志排查原因。", "错误", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private async void btnRestore_Click(object sender, EventArgs e)
        {
            string path = txtPath.Text.Trim();
            if (string.IsNullOrEmpty(path) || !Directory.Exists(path))
            {
                MessageBox.Show("请先选择有效的 KOOK 客户端安装目录！", "提示", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            if (PatchManager.IsKookRunning())
            {
                var result = MessageBox.Show("检测到 KOOK 正在运行，是否关闭 KOOK 客户端？", "确认关闭", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
                if (result == DialogResult.Yes)
                {
                    PatchManager.KillKookProcess();
                    Log("已结束 KOOK 进程。");
                }
                else
                {
                    SetStatus("状态：操作已取消");
                    return;
                }
            }

            SetControlsEnabled(false);
            SetStatus("状态：正在还原官方客户端...", Color.FromArgb(0, 102, 204));

            bool success = false;
            await Task.Run(() =>
            {
                success = PatchManager.RestorePatch(path, Log);
            });

            SetControlsEnabled(true);

            if (success)
            {
                SetStatus("状态：已恢复官方客户端", Color.FromArgb(46, 125, 50));
                MessageBox.Show("已恢复官方客户端！", "还原成功", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            else
            {
                SetStatus("状态：还原失败，已展开日志", Color.FromArgb(198, 40, 40));
                ExpandLogWindow();
                MessageBox.Show("还原失败，已为您展开下方日志排查原因。", "提示", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        private void SetControlsEnabled(bool enabled)
        {
            btnApply.Enabled = enabled;
            btnRestore.Enabled = enabled;
            btnBrowse.Enabled = enabled;
        }
    }
}
