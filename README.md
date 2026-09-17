# KOOK Purifier

KOOK 客户端去广告、去弹窗净化补丁。

仅供个人学习与研究，请勿用于商业用途。

## 效果对比

| 净化前 | 净化后 |
| :---: | :---: |
| ![净化前](docs/before.png) | ![净化后](docs/after.png) |

## 功能

- 关掉各种烦人的广告和活动弹窗
- 清掉各种勋章、动效、气泡与头饰挂件
- 解锁 F12 开发者工具
- 绕过 OBS / 直播姬 进程检测

## 使用方法

1. 下载最新 [Release](https://github.com/Souma-Sumire/kook-purifier/releases)
1. 打开 `KOOKPurifier.exe`，点击 **“开始净化”**

## 开发者

```bash
# 使用 Node.js 脚本修补（运行前请先关闭 KOOK）
node kook-patch.js

# 生成油猴脚本
node kook-userscript.js

# 自行编译 GUI 工具
dotnet build KOOKPurifier.GUI -c Release
```
