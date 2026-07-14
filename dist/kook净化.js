// ==UserScript==
// @name         KOOK净化
// @namespace    https://greasyfork.org/zh-CN/scripts/546095
// @version      1.1.12
// @description  隐藏KOOK网页版广告，替换入场音效，禁用主播模式进程检测
// @author       KOOK Purifier
// @match        https://www.kookapp.cn/*
// @match        https://kookapp.cn/*
// @icon         https://www.kookapp.cn/favicon.ico
// @grant        none
// @downloadURL  https://greasyfork.org/zh-CN/scripts/546095-kook%E5%87%80%E5%8C%96/code/koOK%E5%87%80%E5%8C%96.user.js
// @updateURL    https://greasyfork.org/zh-CN/scripts/546095-kook%E5%87%80%E5%8C%96/code/koOK%E5%87%80%E5%8C%96.meta.js
// ==/UserScript==

(function () {
"use strict";

var patterns = [
    /img\.kookapp\.cn\/assets\/item\/resources\/.+\.mp3/,
    /resources\/.+_notifications?_.+\.mp3/
  ];
  var OriginalAudio = Audio;

  window.Audio = new Proxy(OriginalAudio, {
    construct: function (target, args) {
      var audio = new target(args[0]);
      var originalPlay = audio.play;

      audio.play = function () {
        try {
          if (patterns.some(function (re) { return re.test(audio.src); })) {
            audio.src = 'https://static.kookapp.cn/app/assets/audio/user-join.mp3';
          }
        } catch (e) {}
        return originalPlay.apply(audio, arguments);
      };

      return audio;
    }
  });

var blocked = ['hm.baidu.com', 'sentry.kookapp.cn'];

  var origFetch = window.fetch;
  window.fetch = function (url, options) {
    var s = typeof url === 'string' ? url : (url && url.url) || '';
    if (blocked.some(function (d) { return s.indexOf(d) !== -1; })) {
      return Promise.resolve(new Response('', { status: 200 }));
    }
    return origFetch.apply(this, arguments);
  };

  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    if (blocked.some(function (d) { return (url || '').indexOf(d) !== -1; })) {
      this._blocked = true;
    }
    return origOpen.apply(this, arguments);
  };

  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    if (this._blocked) {
      var self = this;
      setTimeout(function () {
        Object.defineProperty(self, 'status', { value: 200 });
        Object.defineProperty(self, 'readyState', { value: 4 });
        if (self.onreadystatechange) self.onreadystatechange();
      }, 0);
      return;
    }
    return origSend.apply(this, arguments);
  };

  var origBeacon = navigator.sendBeacon;
  navigator.sendBeacon = function (url, data) {
    if (blocked.some(function (d) { return (url || '').indexOf(d) !== -1; })) {
      return true;
    }
    return origBeacon.apply(navigator, arguments);
  };

var HIDDEN_PROCESSES = [
    'obs64',
    'livehime',
  ];

  function shouldHide(processName) {
    if (!processName) return false;
    var name = processName.toLowerCase().replace(/\.exe$/i, '');
    return HIDDEN_PROCESSES.indexOf(name) !== -1;
  }

  function filterProcessList(list) {
    if (!Array.isArray(list)) return list;
    return list.filter(function (item) {
      return !shouldHide(item.ProcessName || item.process_name || item.name || '');
    });
  }

  var patchRetry = 0;
  function patchTasklist() {
    var kaiheila = window.Kaiheila;
    if (!kaiheila || !kaiheila.tasklist) {
      if (++patchRetry > 50) return;
      setTimeout(patchTasklist, 100);
      return;
    }

    var tasklist = kaiheila.tasklist;
    if (tasklist.__kookPurifierPatched) return;
    tasklist.__kookPurifierPatched = true;

    var origEmit = tasklist.emitter.emit.bind(tasklist.emitter);
    tasklist.emitter.emit = function (event) {
      if (event === 'tasklist') {
        var args = Array.prototype.slice.call(arguments);
        if (Array.isArray(args[1])) {
          args[1] = filterProcessList(args[1]);
        }
        return origEmit.apply(null, args);
      }
      return origEmit.apply(null, arguments);
    };

    var origGetTaskListInfo = tasklist.getTaskListInfo;
    tasklist.getTaskListInfo = function () {
      return origGetTaskListInfo.apply(tasklist, arguments).then(filterProcessList);
    };

    var origGetSimple = tasklist.getSimpleTaskListInfo;
    tasklist.getSimpleTaskListInfo = function () {
      return origGetSimple.apply(tasklist, arguments).then(filterProcessList);
    };
  }

  patchTasklist();

const s = document.createElement("style");
s.textContent = `
/* --- 全局广告容器 --- */
#kook-ads-container,
#kook-ads-container *,
#qihoo360-ad-container,
#qihoo360-ad-container *,
#exp-root,
#exp-root * {
  display: none !important;
}

/* --- 弹窗广告（排除确认框、资料卡、昵称修改、服务器邀请等系统弹窗） --- */
body>div>div.chuanyu-modal-container.kaihei-modal-animate:not(.dialog-confirm-mask):not(.dialog-user-profile):not(:has(.dialog-confirm)):not(:has(.guild-invite-modal-box)) {
  display: none !important;
}

/* --- 顶部标题栏广告 + 商城入口 + 下载客户端 --- */
#root>div.win-wapper>div.win-title-bar>div.win-title-inner>div.left>div.khj-entry-tag,
.client-download-tag,
.title-icon-wrapper {
  display: none !important;
}

/* --- 消息区顶部提醒/广告条 --- */
#root>div.win-wapper>div.app-main-wrapper>div>div.content-wrapper-box.app-content-wrapper>div>div.room-layout>div>div.room-content-left>div.kook-message-header-alert>div {
  display: none !important;
}

/* --- Banner 横幅广告 --- */
div.banner-box,
div.audio-center-promotion,
div.kbc-banner-wrapper,
div.mixed-ad-carousel-wrapper,
.discover-corner-ad-patch {
  display: none !important;
}

/* --- 推广/任务系统 --- */
.promotion-banner,
.promotion-banner-section,
.promotion-dialog,
.promotion-header,
.promotion-info,
.promotion-task-item,
.promotion-footer,
.promotion-button,
.promotion-icon,
.promotion-options,
.promotion-prize-image,
.promotion-subtitle,
.promotion-title,
.promotion-filter-content,
.promotion-gameplay-task-accepted,
.promotion-only-pc-client,
.accelerator-promotion,
div[class*="promotion-banner"],
div[class*="advertisement"],
div[class*="promotion-task"],
div[class*="-task-item"],
div[class*="-task-entry"],
div[class*="-task-icon"],
div[class*="-task-dialog"],
div[class*="daily-task"],
div[class*="growth-task"],
div[class*="activity-task"],
div[class*="task-center"],
div[class*="daily-check-in"],
div[class*="daily-bonus"],
div[class*="daily-sign-in"],
div[class*="redpacket"],
div[class*="red-packet"],
div[class*="activity-center"],
div[class*="newbie-guide"],
div[class*="onboarding"],
div[class*="-reward-"],
div[class*="-bonus-"],
div[class*="mission-"],
div[class*="quest-"] {
  display: none !important;
}


/* --- 道具/商品/商城 --- */
.goods-tag,
.kprop-new-tag,
.goods-modal,
.goods-modal__content,
.goods-modal__content__desc,
.goods-modal__content__subtitle,
.goods-modal__content-wrap,
.goods-modal__footer,
.goods-modal__footer__buy,
.goods-modal__footer__coupon,
.buff-goods-desc,
.button-decorations-kprop,
.button-decorations-kprop-add,
.button-kprop,
.dialog-payment-goods,
.goods-list,
.goods-description,
.goods-formula-panel,
.goods-discount-symbol,
.goods-free,
.goods-price,
.goods-price-inline,
.goods-price-origin,
.goods-price-pay,
.origin-price,
.price-tag,
.price-text-disable,
.buy__price__unit,
.vip-guide-price,
.vip-price,
.boost_pricepercontstr,
.kook-tootip.kook-tootip-text-align-left.kook-tootip-text-wrap-break.shop-icon-tooltip-big:has(>.shop-icon-tooltip-big-content) {
  display: none !important;
}

/* --- 代币/余额系统 --- */
.balance-icon,
.balance-text,
.coin-balance,
.buy__coin,
.get-more-coin,
.token-mall,
.token-icon,
.token-price,
.token-price-number,
.token-payment,
.token-pay-content-tip,
.token-pay-count-tip,
.all-token-pay,
.only-token-pay-info,
.only-token-pay-qrcode-border,
.only-token-pay-qrcode-wapper,
.only-token-pay-wrapper,
.only-token-price,
.is-use-token-pay,
.use-token-pay-tip,
.use-payment-custom-token-tip,
.payment-token-tip,
.payment-custom-token,
.payment-custom-token-tip,
.payment-cutsom-token,
.merchant-token-wrapper,
.radio-token-icon,
.placeholder-token-icon,
.buy-radio-token-dialog,
.buy-radio-token-dialog-title,
.token__custom-input,
.token__custom-tip,
.token__custom-title,
.token__item-kb,
.token__item-kb-name,
.token__item-rmb,
.token__items-wrapper {
  display: none !important;
}

/* --- 支付/充值弹窗 --- */
.dialog-payment,
.dialog-payment-mode,
.dialog-payment-target,
.dialog-payment-title,
.guild-recharge-pay-info-wrapper,
.guild-recharge-payment-order-content,
.recharge-icon,
.payment-mode,
.payment-comfirm-button,
.payment-desc,
.payment-descript__wrapper,
.payment-goods-list-wrapper,
.payment-info,
.payment-info-wrapper,
.payment-order-item,
.payment-price,
.payment-protocol,
.payment-qrcode,
.payment-qrcode-border,
.payment-state,
.payment-state-text,
.payment-support-tips,
.payment-title,
.pay-way,
.pay-card,
.pay-icon,
.pay_logo,
.order-pay-icon,
.order-pay-info,
.kook-golive-pay-container,
.kook-golive-pay-dialog,
.only-qrcode-pay-info,
.only-qrcode-pay-input-loading,
.only-qrcode-pay-loading,
.only-qrcode-pay-platform-list,
.only-qrcode-pay-price,
.only-qrcode-pay-price-number,
.only-qrcode-pay-qrcode,
.only-qrcode-pay-qrcode-border,
.only-qrcode-pay-qrcode-image,
.only-qrcode-pay-refresh,
.only-qrcode-pay-support-tips,
.only-qrcode-pay-wrapper,
.only_qrcode_pay,
.payment_price,
.payment_time,
.paymentResult,
.buff_paylab,
.buff_paymentstr,
.buff_paytimestr,
.buff_paytypestr {
  display: none !important;
}

/* --- 礼物系统 --- */
.gift-entry,
.gift-message,
.gift-message-icon,
.gift-message-text,
.gift-animation,
.gift-tip,
.give-gift-button,
.has-gift,
.gift-icon,
.gift-detail,
.gift-play-item,
.gift-play-item-level,
.gift-select-friend-item,
.gift-canvas,
.gift-entry-button,
.giftButtonClick,
.dialog-friend-gift-vip {
  display: none !important;
}

/* --- 服务器助推 (Boost) --- */
.guild-boost-level,
.guild-boost-level-detail,
.guild-boost-level-item,
.guild-booster-level,
.boost-level,
.boost-level-progress,
.boost-level-rights,
.boost-level-tip,
.boost-badge,
.booster-logo {
  display: none !important;
}

/* --- VIP/高级会员 --- */
div.vip-tag,
.vip-decoration,
.nitro-badge,
.premium-indicator {
  display: none !important;
}

/* --- 文字渐变色恢复（VIP 功能还原） --- */
.text-gradient {
  color: inherit !important;
  background: none !important;
  -webkit-background-clip: unset !important;
  -webkit-text-fill-color: unset !important;
}

/* --- 头像框装饰 --- */
div.kook-avatar-frame-static {
  display: none !important;
}

/* --- 设置页推广入口 --- */
#root>div.win-wapper>div.app-main-wrapper>div:nth-child(3)>div>div.setting-page-nav>div>div>div:nth-child(1)>div:nth-child(3),
#root>div.win-wapper>div.app-main-wrapper>div:nth-child(3)>div>div.setting-page-nav>div>div>div:nth-child(1)>div:nth-child(6),
.setting-cdk,
.setting-cdkey-input {
  display: none !important;
}

/* --- 设置页推广分割线（保留1,2,4号） --- */
.entry-list>.entry-line {
  display: none !important;
}
.entry-list>.entry-line:nth-child(1),
.entry-list>.entry-line:nth-child(2),
.entry-list>.entry-line:nth-child(4) {
  display: block !important;
}

/* --- 用户菜单推广 + 红点 --- */
div.user-setting-entry-mask>div>div.bottom-content.menu-background>div.user-setting-menu-list>div:nth-child(1) {
  display: none !important;
}
.user-setting-menu-list .red-dot,
.user-setting-menu-list .badge,
.user-setting-menu-list [class*="dot"],
.user-setting-menu-list [class*="badge"],
.user-setting-menu-list [class*="unread"],
.user-setting-entry-mask .red-dot,
.user-setting-entry-mask .badge,
.user-setting-entry-mask [class*="dot"],
.user-setting-entry-mask [class*="unread"] {
  display: none !important;
}

/* --- 戳一戳消息 --- */
.text-message-item:has(.poke-msg-icon) {
  display: none !important;
}

/* --- 其他推广 --- */
#icon-app-download,
div.voice-icon.screen,
div.text-channel-unread-icon,
div.guild-unread-icon,
div.connect-info,
div.sidebar-server-list-bottom-ad,
div.guild-list-bottom-banner,
div.activity-feed-ad,
div.activity-banner-ad,
div.activity-disabled-banner,
div.voice-channel-promotion,
div.friend-list-ad-banner,
.tip-entry-button {
  display: none !important;
}

/* --- 隐藏左下角个人设置红点 --- */
.app-self-info-unread,
.app-self-info .red-dot,
.app-self-info .badge,
.app-self-info .unread-badge,
.app-self-info [class*="dot"],
.app-self-info [class*="badge"],
.app-self-info [class*="notify"],
.app-self-bottom-icon .red-dot,
.app-self-bottom-icon .badge,
.app-self-bottom-icon [class*="dot"] {
  display: none !important;
}

/* --- 隐藏增值服务相关模块 --- */
.guild-boost-item,
.guild-boost-level-list,
.boost-level-rights,
.guild-guide-role-wrapper,
.activity-list-header,
.custom-activity-header-action,
.custom-activity-header-add-btn {
  display: none !important;
}

`;
document.head.appendChild(s);
console.log("[KOOK净化]");
})();
