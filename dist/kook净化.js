// ==UserScript==
// @name         KOOK净化
// @namespace    https://greasyfork.org/zh-CN/scripts/546095
// @version      1.1.43
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

// 净化字符串形式的 JSON 数据，避免使用 JSON.parse 导致 64 位大整数 Snowflake ID 截断
  function purifyJsonString(str) {
    if (typeof str !== 'string' || !str) return str;
    return str
      .replace(/"is_vip"\s*:\s*[1-9]\d*/g, '"is_vip":0')
      .replace(/"vip"\s*:\s*[1-9]\d*/g, '"vip":0')
      .replace(/"vip_type"\s*:\s*[1-9]\d*/g, '"vip_type":0')
      .replace(/"vip_avatar"\s*:\s*[1-9]\d*/g, '"vip_avatar":0')
      .replace(/"vip_buff"\s*:\s*[1-9]\d*/g, '"vip_buff":0')
      .replace(/"nameplate"\s*:\s*(\{[^{}]*\}|"[^"]*"|[0-9]+)/g, '"nameplate":null')
      .replace(/"decorations"\s*:\s*(\[[^\[\]]*\]|\{[^{}]*\}|"[^"]*"|[0-9]+)/g, '"decorations":null');
  }

  // 语音、直播、RTC、网关、消息轮询及频道相关请求判定
  function isLiveOrRtcUrl(url) {
    if (!url || typeof url !== 'string') return false;
    var u = url.toLowerCase();
    return u.indexOf('check-join') !== -1 ||
           u.indexOf('go-live') !== -1 ||
           u.indexOf('game-live') !== -1 ||
           u.indexOf('voice') !== -1 ||
           u.indexOf('rtc') !== -1 ||
           u.indexOf('live') !== -1 ||
           u.indexOf('agora') !== -1 ||
           u.indexOf('volc') !== -1 ||
           u.indexOf('gateway') !== -1 ||
           u.indexOf('channel') !== -1 ||
           u.indexOf('webrtc') !== -1 ||
           u.indexOf('messages') !== -1 ||
           u.indexOf('message') !== -1;
  }

  // Hook Fetch 接口
  var origFetch = window.fetch;
  window.fetch = function (url, options) {
    var s = typeof url === 'string' ? url : (url && url.url) || '';
    if (isLiveOrRtcUrl(s)) {
      return origFetch.apply(this, arguments);
    }
    return origFetch.apply(this, arguments).then(function (res) {
      if (s.indexOf('/api/') !== -1) {
        return res.text().then(function (text) {
          var purifiedText = purifyJsonString(text);
          return new Response(purifiedText, {
            status: res.status,
            statusText: res.statusText,
            headers: res.headers
          });
        }).catch(function () {
          return res;
        });
      }
      return res;
    });
  };

  // Hook XMLHttpRequest
  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    var self = this;
    self._url = url || '';
    self._isLiveOrRtc = isLiveOrRtcUrl(self._url);
    return origOpen.apply(this, arguments);
  };

  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    if (!this._isLiveOrRtc && this._url.indexOf('/api/') !== -1) {
      var xhrSelf = this;
      var origOnReady = xhrSelf.onreadystatechange;
      xhrSelf.onreadystatechange = function () {
        if (xhrSelf.readyState === 4 && xhrSelf.status === 200) {
          try {
            if (typeof xhrSelf.responseText === 'string' && xhrSelf.responseText) {
              var purified = purifyJsonString(xhrSelf.responseText);
              try {
                Object.defineProperty(xhrSelf, 'responseText', { value: purified, writable: true, configurable: true });
              } catch (_) {}
              if (!xhrSelf.responseType || xhrSelf.responseType === 'text') {
                try {
                  Object.defineProperty(xhrSelf, 'response', { value: purified, writable: true, configurable: true });
                } catch (_) {}
              }
            }
          } catch (_) { }
        }
        if (origOnReady) origOnReady.apply(this, arguments);
      };
    }
    return origSend.apply(this, arguments);
  };

  // 移除 text-gradient class, VIP class 及内联 Style
  function cleanVipDom(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.classList) {
      if (el.classList.contains('text-gradient')) {
        el.classList.remove('text-gradient');
        el.style.backgroundImage = 'none';
        el.style.webkitTextFillColor = 'initial';
        el.style.backgroundClip = 'initial';
      }
      if (el.classList.contains('kook-avatar-is_vip')) el.classList.remove('kook-avatar-is_vip');
      if (el.classList.contains('kook-avatar-vip_avatar')) el.classList.remove('kook-avatar-vip_avatar');
    }
    var nodes = el.querySelectorAll ? el.querySelectorAll('.text-gradient, .kook-avatar-is_vip, .kook-avatar-vip_avatar') : [];
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.classList.contains('text-gradient')) {
        node.classList.remove('text-gradient');
        node.style.backgroundImage = 'none';
        node.style.webkitTextFillColor = 'initial';
        node.style.backgroundClip = 'initial';
      }
      node.classList.remove('kook-avatar-is_vip');
      node.classList.remove('kook-avatar-vip_avatar');
    }
  }

  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        cleanVipDom(added[j]);
      }
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
    cleanVipDom(document.body);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      observer.observe(document.body, { childList: true, subtree: true });
      cleanVipDom(document.body);
    });
  }

  // Moment.js 时间格式化原型 Hook（精准秒级时间显示）
  function hookMoment() {
    if (window.moment && window.moment.fn && !window.moment.fn._patched) {
      var origFormat = window.moment.fn.format;
      window.moment.fn.format = function (fmt) {
        if (typeof fmt === 'string') {
          fmt = fmt.replace(/HH:mm(?!:ss)/g, 'HH:mm:ss').replace(/hh:mm(?!:ss)/g, 'hh:mm:ss');
        }
        return origFormat.call(this, fmt);
      };
      window.moment.fn._patched = true;
    }
  }
  hookMoment();
  setInterval(hookMoment, 1000);

  // 个性化/装扮提示音 Hook（还原为默认入场/提示音）
  var DEFAULT_JOIN_SOUND = 'https://static.kookapp.cn/app/assets/audio/user-join.mp3';
  var soundPatterns = [
    /\/assets\/item\/resources\/.+\.mp3/i,
    /resources\/.+_notifications?_.+\.mp3/i
  ];

  function sanitizeAudioUrl(url) {
    if (typeof url === 'string' && soundPatterns.some(function (re) { return re.test(url); })) {
      return DEFAULT_JOIN_SOUND;
    }
    return url;
  }

  try {
    var mediaProto = window.HTMLMediaElement ? window.HTMLMediaElement.prototype : null;
    if (mediaProto) {
      var srcDesc = Object.getOwnPropertyDescriptor(mediaProto, 'src');
      if (srcDesc && srcDesc.set && srcDesc.get) {
        Object.defineProperty(mediaProto, 'src', {
          get: function () {
            return srcDesc.get.call(this);
          },
          set: function (val) {
            return srcDesc.set.call(this, sanitizeAudioUrl(val));
          },
          configurable: true,
          enumerable: true
        });
      }
    }
  } catch (_) {}

  try {
    var origSetAttr = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name, val) {
      if (typeof name === 'string' && name.toLowerCase() === 'src' && this instanceof HTMLMediaElement) {
        val = sanitizeAudioUrl(val);
      }
      return origSetAttr.call(this, name, val);
    };
  } catch (_) {}

  var OrigAudio = window.Audio;
  if (OrigAudio) {
    window.Audio = new Proxy(OrigAudio, {
      construct: function (target, args) {
        if (args && args.length > 0 && typeof args[0] === 'string') {
          args[0] = sanitizeAudioUrl(args[0]);
        }
        return new target(args[0]);
      }
    });
    window.Audio.prototype = OrigAudio.prototype;

    try {
      var preloadAudio = new OrigAudio(DEFAULT_JOIN_SOUND);
      preloadAudio.preload = 'auto';
      preloadAudio.load();
    } catch (_) {}
  }

  // DevTools 快捷键 Hook
  window.addEventListener('keydown', function (e) {
    var isF12 = e.key === 'F12';
    var isCtrlShiftI = (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i');
    if (isF12 || isCtrlShiftI) {
      try {
        if (window.require) {
          var electron = window.require('electron');
          if (electron && electron.ipcRenderer) {
            electron.ipcRenderer.send('toggle-devtools');
          }
        }
      } catch (_) { }
    }
  }, true);

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

    if (tasklist.emitter && tasklist.emitter.emit) {
      var origEmit = tasklist.emitter.emit.bind(tasklist.emitter);
      tasklist.emitter.emit = function (event) {
        if (event === 'tasklist') {
          var args = Array.prototype.slice.call(arguments);
          args[1] = [];
          return origEmit.apply(null, args);
        }
        return origEmit.apply(null, arguments);
      };
    }

    if (tasklist.getTaskListInfo) {
      tasklist.getTaskListInfo = function () {
        return Promise.resolve([]);
      };
    }

    if (tasklist.getSimpleTaskListInfo) {
      tasklist.getSimpleTaskListInfo = function () {
        return Promise.resolve([]);
      };
    }
  }

  patchTasklist();

  // 拦截 Electron IPC 进程查询通道，直接返回空数据
  try {
    if (window.require) {
      var electron = window.require('electron');
      if (electron && electron.ipcRenderer) {
        var origInvoke = electron.ipcRenderer.invoke;
        if (origInvoke) {
          electron.ipcRenderer.invoke = function (channel) {
            if (channel === 'get-tasklist' || channel === 'get-process-list') {
              return Promise.resolve([]);
            }
            return origInvoke.apply(this, arguments);
          };
        }
      }
    }
  } catch (_) {}

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

.chuanyu-modal-container:has(.dialog-user-profile),
.chuanyu-modal-container:has(.user-profile-group),
.chuanyu-modal-container:has(.dialog-confirm),
.chuanyu-modal-container:has(.guild-invite-modal-box),
.khj-modal-container:has(.dialog-user-profile),
.khj-modal-container:has(.user-profile-group),
.khj-modal-container:has(.dialog-confirm),
.dialog-user-profile {
  display: flex !important;
}

/* --- 隐藏广告/变现/推广/活动弹窗遮罩及内容 --- */
.chuanyu-modal-container:has(.promotion-dialog),
.chuanyu-modal-container:has(.kpm-vip-modal),
.chuanyu-modal-container:has(.vip-buy-modal),
.chuanyu-modal-container:has(.vip-promotion-modal),
.chuanyu-modal-container:has(.goods-modal),
.chuanyu-modal-container:has(.dialog-payment),
.chuanyu-modal-container:has(.recharge-modal),
.chuanyu-modal-container:has(.activity-dialog),
.chuanyu-modal-container:has(.activity-modal),
.chuanyu-modal-container:has(.festival-activity-modal),
.chuanyu-modal-container:has(.voice-quality-eval-modal),
.chuanyu-modal-container:has(.voice-eval-dialog),
.chuanyu-modal-container:has(.satisfaction-survey-modal),
.chuanyu-modal-container:has(.guide-modal),
.chuanyu-modal-container:has(.download-app-modal),
.chuanyu-modal-container:has(.first-newversion),
.chuanyu-modal-container:has(.firstlaunch-newversion),
.chuanyu-modal-container:has([class*="newversion"]),
.khj-modal-container:has(.promotion-dialog),
.khj-modal-container:has(.kpm-vip-modal),
.khj-modal-container:has(.dialog-payment),
.khj-modal-container:has(.goods-modal),
.khj-modal-container:has(.activity-dialog),
.khj-modal-container:has(.first-newversion),
.khj-modal-container:has(.firstlaunch-newversion),
.khj-modal-container:has([class*="newversion"]),
.guide-banner-container,
.download-modal,
.promotion-dialog,
.kpm-vip-modal,
.vip-buy-modal,
.vip-privilege-modal,
.vip-guide-modal,
.vip-promotion-modal,
.dialog-friend-gift-vip,
.goods-modal,
.dialog-payment,
.dialog-payment-goods,
.recharge-modal,
.first-recharge-modal,
.activity-dialog,
.activity-modal,
.festival-activity-modal,
.welfare-modal,
.welfare-center-modal,
.sign-in-modal,
.check-in-modal,
.guide-modal-container,
.guide-modal,
.onboarding-modal,
.newbie-guide-modal,
.download-app-modal,
.download-client-modal,
.update-notice-modal,
.kook-update-modal,
.first-newversion,
.firstlaunch-newversion,
.new-version-fix-dialog,
.update-view,
[class*="update-modal"],
[class*="newversion"],
.voice-quality-eval-modal,
.voice-quality-evaluation,
.voice-eval-dialog,
.voice-call-rating-modal,
.voice-call-eval,
.voice-call-feedback,
.voice-quality-feedback,
.dialog-voice-quality,
.dialog-voice-eval,
.dialog-survey,
.satisfaction-survey-modal,
.satisfaction-modal,
.call-quality-feedback {
  display: none !important;
}

/* --- 顶部标题栏广告 + 商城入口 + 下载客户端 --- */
#root>div.win-wapper>div.win-title-bar>div.win-title-inner>div.left>div.khj-entry-tag,
#root>div.win-wapper>div.win-title-bar>div.win-title-inner>div.left>div.kook-anchor-titlebar-left,
.kook-anchor-titlebar-left,
.client-download-tag,
.desktop-client-download-tip,
#root>div.win-wapper>div.desktop-client-download-tip,
.title-icon-wrapper {
  display: none !important;
}

/* --- 消息区顶部提醒/广告条 --- */
.kook-message-header-alert,
.kook-message-header-alert>div,
div[class*="message-header-alert"] {
  display: none !important;
}

/* --- Banner 横幅广告 --- */
.banner-box,
.guild-banner-box,
.guild-channel-banner-placeholder-box,
div[class*="guild-banner-box"],
.audio-center-promotion,
.kbc-banner-wrapper,
.mixed-ad-carousel-wrapper,
.mixed-ad-carousel,
.sdk-ad-container,
.kook-ad-image,
[class*="audio-center-promotion"],
[class*="mixed-ad-carousel"],
.discover-corner-ad-patch,
.discover-goods-ad,
.discover-goods-ad-border,
.discover-goods-ad-img,
.guide-banner-container,
.robot-home-dialog-banner,
.recording-ctrl-panel-banner {
  display: none !important;
}

/* --- 推广/任务系统 --- */
.promotion-banner,
.promotion-banner-section,
.promotion-dialog,
.promotion-header,
.promotion-info,
.promotion-task-item,
.new-task-block-container,
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
div[class*="quest-"],
.khj-drop-toast-layer,
.khj-drop-toast,
div[class*="drop-toast"],
div[class*="khj-drop-toast"] {
  display: none !important;
}


/* --- 道具/商品/商城 --- */
.goods-tag,
.kprop-new-tag,
.goods-modal,
.goto-kpropshop,
.setting-page-shop-panel,
.setting-page-to-shop,
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
.dialog-friend-gift-vip,
.user-info-card-gift-icon,
.user-info-card-gift-wrapper,
.meme-container-old,
.meme-container,
.meme-item-container,
.meme-item,
div[class*="meme-container"],
div[class*="meme-item"] {
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
.premium-indicator,
.setting-buy-vip,
.setting-buy-vip-expire,
.kpm-vip-modal,
.kpm-vip-top-parent,
.kmp_vip_tips,
.kmp_vip_tips_parent,
.vip-price-tips,
.invite-vip-gradient-bg {
  display: none !important;
}


/* --- 头像框、铭牌挂件、勋章与资料卡装饰品 --- */
.kook-avatar-frame-static,
.kook-avatar-frame-animate,
.kook-avatar-frame,
img.kook-avatar-frame-static,
img.kook-avatar-frame-animate,
[class*="avatar-frame"],
[class*="kook-avatar-frame"],
.left-munu-guild-avatar,
.left-menu-guild-avatar,
div[class*="guild-avatar"],
div[class*="left-munu-guild-avatar"],
.user-nameplates-panel,
.user-info-nameplate,
.namepalte-item,
.namepalte-item-animate,
.namepalte-item-static,
.nameplate,
.name-and-nameplate,
.s_nameplate,
.kook-nameplate-modal-wrapper,
.kook-nameplate-modal,
div[class*="nameplate"],
div[class*="namepalte"],
img[src*="nameplate"],
img[src*="s_nameplate"],
.user-name-info>img:not(.emoji),
.badge-list,
.badge-item,
.badge-more,
.nitro-badge,
.guild-voice-badge,
.icon-badge,
.invite-client-badge,
.invite-client-btn-badges,
.boost-badge,
div[class*="badge-list"],
div[class*="badge-item"],
.vip-decoration,
.vip-amp,
.vip-amp-animation,
.vip-icon,
.all_vip,
.show-other-vip,
.upload-preview-buy-vip,
.goods-vip,
.prizes-decorate,
.kook-prizes-decorate,
.show_prize,
.prize-item,
.prize-level-bg,
[class*="prizes-decorate"],
.buff-tag,
.buff_tag,
.buff-persona-tips,
[class*="buff-persona-tips"],
.invite-buff-icon,
.buff-pro-icon,
.buff-icon,
.booster-tag,
.guild-boost-tag,
.icon-user_tag,
.kprop-goods,
.kprop-scope,
.kprop-new-tag,
.button-decorations-kprop,
.button-decorations-kprop-add,
.action-prop-list,
.action-prop-item,
.action-props-box,
.goods-prop,
.prop-image-layer,
.prop-icon,
.prop-item,
.prop-item-img-bg,
.intimacy-img,
.intimacy-tag,
.user-banner,
.user-banner-shade,
div[class*="user-banner"] {
  display: none !important;
}

/* --- 亲密关系 (Intimacy) 浮动背景特效移除 --- */
.user-info-right.intimacy,
.user-info-right.intimacy_kpm,
.user-info-right.intimacy-animation,
.user-list-container .user-item .user-info-right.intimacy,
.user-list-container .user-item .user-info-right.intimacy_kpm,
.user-list-container .user-item:hover .user-info-right.intimacy-animation {
  background-image: none !important;
  background: transparent !important;
}

/* --- 设置页推广入口 --- */
#root>div.win-wapper>div.app-main-wrapper>div:nth-child(3)>div>div.setting-page-nav>div>div>div:nth-child(1)>div:nth-child(3),
#root>div.win-wapper>div.app-main-wrapper>div:nth-child(3)>div>div.setting-page-nav>div>div>div:nth-child(1)>div:nth-child(6),
.setting-cdk,
.setting-cdkey-input,
.user-setting-mf-goods-tag,
.user-setting-mf-mask-nav-group-item:has(.user-setting-mf-goods-tag),
.user-setting-mf-unread {
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
.user-setting-menu-list>.user-setting-menu-item:nth-child(1),
.user-setting-menu-list>.user-setting-menu-item:has(.tag),
.user-setting-menu-list>div:nth-child(1) {
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

/* --- HQ音质引导BUFF充值广告 --- */
body>div.buff-hq-tooltip {
  display: none !important;
}

/* --- 更新提醒 --- */
#root>div.win-wapper>div.win-title-bar>div.win-title-inner>div.right>div:nth-child(2)>div.win-title-bar-icon.win-download-icon.animate-button.kookiconfont {
  display: none !important;
}

/* --- 隐藏语音频道工具箱 --- */
.console-tools-container {
  display: none !important;
}
`;
document.head.appendChild(s);
console.log("[KOOK净化]");
})();
