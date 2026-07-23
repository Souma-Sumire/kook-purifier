# KOOK Purifier

KOOK 客户端净化/去广告补丁。

本项目仅供个人学习与研究，请勿用于商业或违规用途。

## 功能

- 屏蔽各种广告、弹窗
- 屏蔽各种装饰、挂件、勋章、动效、标识
- 屏蔽数据埋点与日志上报
- 解锁 F12 开发者工具
- 解锁 OBS / 直播姬进程检测
- 禁用自动更新

## 环境要求

[Node.js LTS](https://nodejs.org/zh-cn)

## 使用

```bash
# 修补本地 KOOK 客户端（执行前请先关闭 KOOK）
node kook-patch.js

# 生成油猴脚本
node kook-userscript.js
```
