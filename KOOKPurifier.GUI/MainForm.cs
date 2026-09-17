using System;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace KOOKPurifier.GUI
{
    public partial class MainForm : Form
    {
        public MainForm()
        {
            InitializeComponent();
        }

        private void MainForm_Load(object sender, EventArgs e)
        {
            Log("欢迎使用 KOOK Purifier！");
            DetectKookDir();
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
                Log("自动识别 KOOK 目录: " + kookDir);
            }
            else
            {
                Log("[提示] 未能自动识别 KOOK 目录，请手动点击“浏览”选择。");
            }
        }

        private void btnBrowse_Click(object sender, EventArgs e)
        {
            using (var dialog = new FolderBrowserDialog())
            {
                dialog.Description = "请选择 KOOK 的 app-* 目录 (如 AppData\\Local\\KOOK\\app-0.81.0)";
                if (dialog.ShowDialog() == DialogResult.OK)
                {
                    txtPath.Text = dialog.SelectedPath;
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
                    Log("[提示] 修补已取消：请关闭 KOOK 后重试。");
                    return;
                }
            }

            SetControlsEnabled(false);

            var options = new PatchOptions();

            bool success = false;
            await Task.Run(() =>
            {
                success = PatchManager.ApplyPatch(path, options, Log);
            });

            SetControlsEnabled(true);

            if (success)
            {
                MessageBox.Show("修补成功！重新启动 KOOK 客户端即可生效。", "修补完成", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            else
            {
                MessageBox.Show("修补失败，请查看日志获取详细信息。", "错误", MessageBoxButtons.OK, MessageBoxIcon.Error);
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
                    Log("[提示] 还原已取消：请关闭 KOOK 后重试。");
                    return;
                }
            }

            SetControlsEnabled(false);

            bool success = false;
            await Task.Run(() =>
            {
                success = PatchManager.RestorePatch(path, Log);
            });

            SetControlsEnabled(true);

            if (success)
            {
                MessageBox.Show("已恢复官方客户端！", "还原成功", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            else
            {
                MessageBox.Show("还原失败，请查看下方日志窗口获取详细原因。", "提示", MessageBoxButtons.OK, MessageBoxIcon.Warning);
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
