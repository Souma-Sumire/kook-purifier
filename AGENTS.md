# 开发规范

- **功能可配置原则**：新增任何功能均须接入设置菜单并提供显式开关，严禁硬编码功能行为，确保用户拥有自主启闭的权利。
- **配置正交与精准原则**：
  1. **按用户心智整合**：严禁按技术实现维度（如界面隐藏与网络拦截）将同一业务目标的配置割裂拆分，必须以用户的业务诉求为粒度统合配置，消除不必要的认知负荷。
  2. **保持选项概念正交**：配置项之间必须职责清晰、边界互斥，严禁出现定位重叠、功能冗余或语义模棱两可的选项。
  3. **权责与文案精准对等**：选项命名必须真实、完整地映射其实际影响范围与控制边界，严禁文案描述小于或偏离实际代码行为。

---

# CSS 拦截规则规范

## 渲染基元不得全局隐藏

以下 class 是 KOOK 的渲染基元，在背包、详情弹窗、设置页等合法 UI 中均有使用，禁止加入全局 display:none 列表：

- prop-image-layer / prop-icon / image-bg-layer / image-contont-layer
- prop-item / prop-item-img-bg / action-prop-img
- kprop-item / kprop-header / kprop-resource-preview

需要拦截商业推广中的道具卡片时，使用精准上下文选择器：

`css
/* 正确：仅在广告投放区拦截 */
.discover-goods-ad .kprop-goods { display: none !important; }

/* 错误：全局隐藏，误伤背包/弹窗 */
.kprop-goods { display: none !important; }
`

## 禁止白名单恢复模式

"全局隐藏 + 父容器白名单 display:revert"的模式存在结构性缺陷：

1. 父容器 class 随版本变动即失效（如 .setting-page → .user-setting-mf-page）。
2. 弹窗容器与设置页树完全独立，需单独列举，遗漏必然导致损坏。
3. 维护成本线性增长。

根本解决方案：将拦截粒度收窄到语义明确的商业容器，而非渲染基元。

## 选择器禁止项

- nth-child / nth-of-type 位置选择器：布局增减节点即失效。
- 深度 > 链式路径（如 #root > div.win-wapper > div:nth-child(3) > ...）。
- 过宽通配符片段：[class*="-reward-"]、[class*="-bonus-"]、[class*="quest-"] 等单词片段，易误伤合法 UI。

## 选择器要求

- 优先语义 class（如 .kpm-vip-modal、.goods-modal）。
- 动态内容使用 :has() 锚定语义子元素（如 .user-setting-menu-item:has(.ShopSvgIcon)）。
- 通配符仅在前缀语义足够具体时使用（如 [class*="newversion"]、div[class*="promotion-task"]）。

## 调试规范

修复"某区域元素不可见"问题前，必须先获得该区域的实际 HTML 结构，确认：

1. 根容器 class 是什么，不得凭历史经验猜测。
2. 被隐藏元素的直接父级是什么。
3. 在 app-src-base/webapp/build/static/css/ 中确认该 class 的实际选择器上下文。

未确认上述三点前，不得提交修复。

## 版本兼容注意

KOOK 使用微前端架构，旧版设置页（.setting-page）与新版（.user-setting-mf-page）并行存在或交替替换。规则应通过精准语义选择器实现，避免对特定容器 class 形成硬依赖。
