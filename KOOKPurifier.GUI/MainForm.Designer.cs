namespace KOOKPurifier.GUI
{
    partial class MainForm
    {
        private System.ComponentModel.IContainer components = null;

        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        private void InitializeComponent()
        {
            this.lblPath = new System.Windows.Forms.Label();
            this.txtPath = new System.Windows.Forms.TextBox();
            this.btnBrowse = new System.Windows.Forms.Button();
            this.btnApply = new System.Windows.Forms.Button();
            this.btnRestore = new System.Windows.Forms.Button();
            this.txtLog = new System.Windows.Forms.TextBox();
            this.grpOptions = new System.Windows.Forms.GroupBox();
            this.chkAdBlock = new System.Windows.Forms.CheckBox();
            this.chkEnhance = new System.Windows.Forms.CheckBox();
            this.chkDevTools = new System.Windows.Forms.CheckBox();
            this.chkNoStreamer = new System.Windows.Forms.CheckBox();
            this.chkDisableUpdate = new System.Windows.Forms.CheckBox();
            this.grpOptions.SuspendLayout();
            this.SuspendLayout();
            // 
            // lblPath
            // 
            this.lblPath.AutoSize = true;
            this.lblPath.Font = new System.Drawing.Font("微软雅黑", 9F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.lblPath.Location = new System.Drawing.Point(14, 18);
            this.lblPath.Name = "lblPath";
            this.lblPath.Size = new System.Drawing.Size(48, 17);
            this.lblPath.TabIndex = 0;
            this.lblPath.Text = "路径：";
            // 
            // txtPath
            // 
            this.txtPath.Font = new System.Drawing.Font("微软雅黑", 9F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.txtPath.Location = new System.Drawing.Point(68, 15);
            this.txtPath.Name = "txtPath";
            this.txtPath.Size = new System.Drawing.Size(350, 23);
            this.txtPath.TabIndex = 1;
            // 
            // btnBrowse
            // 
            this.btnBrowse.Font = new System.Drawing.Font("微软雅黑", 9F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.btnBrowse.Location = new System.Drawing.Point(426, 13);
            this.btnBrowse.Name = "btnBrowse";
            this.btnBrowse.Size = new System.Drawing.Size(78, 27);
            this.btnBrowse.TabIndex = 2;
            this.btnBrowse.Text = "浏览...";
            this.btnBrowse.UseVisualStyleBackColor = true;
            this.btnBrowse.Click += new System.EventHandler(this.btnBrowse_Click);
            // 
            // grpOptions
            // 
            this.grpOptions.Controls.Add(this.chkDisableUpdate);
            this.grpOptions.Controls.Add(this.chkNoStreamer);
            this.grpOptions.Controls.Add(this.chkDevTools);
            this.grpOptions.Controls.Add(this.chkEnhance);
            this.grpOptions.Controls.Add(this.chkAdBlock);
            this.grpOptions.Font = new System.Drawing.Font("微软雅黑", 9F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.grpOptions.Location = new System.Drawing.Point(15, 45);
            this.grpOptions.Name = "grpOptions";
            this.grpOptions.Size = new System.Drawing.Size(489, 72);
            this.grpOptions.TabIndex = 3;
            this.grpOptions.TabStop = false;
            this.grpOptions.Text = "选项";
            // 
            // chkAdBlock
            // 
            this.chkAdBlock.AutoSize = true;
            this.chkAdBlock.Checked = true;
            this.chkAdBlock.CheckState = System.Windows.Forms.CheckState.Checked;
            this.chkAdBlock.Location = new System.Drawing.Point(12, 22);
            this.chkAdBlock.Name = "chkAdBlock";
            this.chkAdBlock.Size = new System.Drawing.Size(99, 21);
            this.chkAdBlock.TabIndex = 0;
            this.chkAdBlock.Text = "屏蔽广告弹窗";
            this.chkAdBlock.UseVisualStyleBackColor = true;
            // 
            // chkEnhance
            // 
            this.chkEnhance.AutoSize = true;
            this.chkEnhance.Checked = true;
            this.chkEnhance.CheckState = System.Windows.Forms.CheckState.Checked;
            this.chkEnhance.Location = new System.Drawing.Point(135, 22);
            this.chkEnhance.Name = "chkEnhance";
            this.chkEnhance.Size = new System.Drawing.Size(99, 21);
            this.chkEnhance.TabIndex = 1;
            this.chkEnhance.Text = "屏蔽花哨特效";
            this.chkEnhance.UseVisualStyleBackColor = true;
            // 
            // chkDevTools
            // 
            this.chkDevTools.AutoSize = true;
            this.chkDevTools.Checked = true;
            this.chkDevTools.CheckState = System.Windows.Forms.CheckState.Checked;
            this.chkDevTools.Location = new System.Drawing.Point(260, 22);
            this.chkDevTools.Name = "chkDevTools";
            this.chkDevTools.Size = new System.Drawing.Size(116, 21);
            this.chkDevTools.TabIndex = 2;
            this.chkDevTools.Text = "解锁开发者工具";
            this.chkDevTools.UseVisualStyleBackColor = true;
            // 
            // chkNoStreamer
            // 
            this.chkNoStreamer.AutoSize = true;
            this.chkNoStreamer.Checked = true;
            this.chkNoStreamer.CheckState = System.Windows.Forms.CheckState.Checked;
            this.chkNoStreamer.Location = new System.Drawing.Point(12, 45);
            this.chkNoStreamer.Name = "chkNoStreamer";
            this.chkNoStreamer.Size = new System.Drawing.Size(116, 21);
            this.chkNoStreamer.TabIndex = 3;
            this.chkNoStreamer.Text = "禁用直播模式检测";
            this.chkNoStreamer.UseVisualStyleBackColor = true;
            // 
            // chkDisableUpdate
            // 
            this.chkDisableUpdate.AutoSize = true;
            this.chkDisableUpdate.Checked = true;
            this.chkDisableUpdate.CheckState = System.Windows.Forms.CheckState.Checked;
            this.chkDisableUpdate.Location = new System.Drawing.Point(135, 45);
            this.chkDisableUpdate.Name = "chkDisableUpdate";
            this.chkDisableUpdate.Size = new System.Drawing.Size(116, 21);
            this.chkDisableUpdate.TabIndex = 4;
            this.chkDisableUpdate.Text = "禁用自动更新";
            this.chkDisableUpdate.UseVisualStyleBackColor = true;
            // 
            // btnApply
            // 
            this.btnApply.Font = new System.Drawing.Font("微软雅黑", 10F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.btnApply.Location = new System.Drawing.Point(15, 124);
            this.btnApply.Name = "btnApply";
            this.btnApply.Size = new System.Drawing.Size(238, 38);
            this.btnApply.TabIndex = 4;
            this.btnApply.Text = "开始净化";
            this.btnApply.UseVisualStyleBackColor = true;
            this.btnApply.Click += new System.EventHandler(this.btnApply_Click);
            // 
            // btnRestore
            // 
            this.btnRestore.Font = new System.Drawing.Font("微软雅黑", 10F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.btnRestore.Location = new System.Drawing.Point(266, 124);
            this.btnRestore.Name = "btnRestore";
            this.btnRestore.Size = new System.Drawing.Size(238, 38);
            this.btnRestore.TabIndex = 5;
            this.btnRestore.Text = "还原官方";
            this.btnRestore.UseVisualStyleBackColor = true;
            this.btnRestore.Click += new System.EventHandler(this.btnRestore_Click);
            // 
            // txtLog
            // 
            this.txtLog.BackColor = System.Drawing.SystemColors.Window;
            this.txtLog.Font = new System.Drawing.Font("Consolas", 9F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.txtLog.Location = new System.Drawing.Point(15, 170);
            this.txtLog.Multiline = true;
            this.txtLog.Name = "txtLog";
            this.txtLog.ReadOnly = true;
            this.txtLog.ScrollBars = System.Windows.Forms.ScrollBars.Vertical;
            this.txtLog.Size = new System.Drawing.Size(489, 175);
            this.txtLog.TabIndex = 6;
            // 
            // MainForm
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(7F, 17F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(520, 360);
            this.Controls.Add(this.grpOptions);
            this.Controls.Add(this.txtLog);
            this.Controls.Add(this.btnRestore);
            this.Controls.Add(this.btnApply);
            this.Controls.Add(this.btnBrowse);
            this.Controls.Add(this.txtPath);
            this.Controls.Add(this.lblPath);
            this.Font = new System.Drawing.Font("微软雅黑", 9F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.FormBorderStyle = System.Windows.Forms.FormBorderStyle.FixedSingle;
            this.MaximizeBox = false;
            this.Name = "MainForm";
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
            this.Text = "KOOK Purifier";
            this.Load += new System.EventHandler(this.MainForm_Load);
            this.grpOptions.ResumeLayout(false);
            this.grpOptions.PerformLayout();
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private System.Windows.Forms.Label lblPath;
        private System.Windows.Forms.TextBox txtPath;
        private System.Windows.Forms.Button btnBrowse;
        private System.Windows.Forms.Button btnApply;
        private System.Windows.Forms.Button btnRestore;
        private System.Windows.Forms.TextBox txtLog;
        private System.Windows.Forms.GroupBox grpOptions;
        private System.Windows.Forms.CheckBox chkAdBlock;
        private System.Windows.Forms.CheckBox chkEnhance;
        private System.Windows.Forms.CheckBox chkDevTools;
        private System.Windows.Forms.CheckBox chkNoStreamer;
        private System.Windows.Forms.CheckBox chkDisableUpdate;
    }
}
