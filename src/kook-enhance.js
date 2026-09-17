(function () {
  'use strict';

  var CONFIG_KEY = 'kook_purifier_config';
  var defaultConfig = {
    replaceJoinSound: true,
    purifyVip: true,
    preciseTime: true,
    blockAds: true,
    enableDevTools: true
  };

  function loadConfig() {
    try {
      var raw = localStorage.getItem(CONFIG_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        var res = {};
        for (var k in defaultConfig) {
          res[k] = typeof parsed[k] === 'boolean' ? parsed[k] : defaultConfig[k];
        }
        return res;
      }
    } catch (_) {}
    var copy = {};
    for (var key in defaultConfig) copy[key] = defaultConfig[key];
    return copy;
  }

  var currentConfig = loadConfig();

  function saveConfig() {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(currentConfig));
    } catch (_) {}
  }

  // 净化字符串形式的 JSON 数据，避免使用 JSON.parse 导致 64 位大整数 Snowflake ID 截断
  function purifyJsonString(str) {
    if (!currentConfig.purifyVip) return str;
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
        var ct = res.headers && res.headers.get ? res.headers.get('content-type') : '';
        if (ct && ct.indexOf('application/json') === -1) {
          return res;
        }
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
    if (!currentConfig.purifyVip) return;
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

  var pendingDomNodes = [];
  var domCleanScheduled = false;

  function processPendingDomClean() {
    domCleanScheduled = false;
    if (!currentConfig.purifyVip || pendingDomNodes.length === 0) {
      pendingDomNodes = [];
      return;
    }
    var batch = pendingDomNodes;
    pendingDomNodes = [];
    for (var i = 0; i < batch.length; i++) {
      cleanVipDom(batch[i]);
    }
  }

  function scheduleDomClean(node) {
    if (!currentConfig.purifyVip || !node || node.nodeType !== 1) return;
    pendingDomNodes.push(node);
    if (!domCleanScheduled) {
      domCleanScheduled = true;
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(processPendingDomClean);
      } else {
        setTimeout(processPendingDomClean, 16);
      }
    }
  }

  var observer = new MutationObserver(function (mutations) {
    if (!currentConfig.purifyVip) return;
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        scheduleDomClean(added[j]);
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
        if (currentConfig.preciseTime && typeof fmt === 'string') {
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
    if (!currentConfig.replaceJoinSound) return url;
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
    try {
      window.Audio.prototype = OrigAudio.prototype;
    } catch (_) {}

    try {
      var preloadAudio = new OrigAudio(DEFAULT_JOIN_SOUND);
      preloadAudio.preload = 'auto';
      preloadAudio.load();
    } catch (_) {}
  }

  // DevTools 快捷键 Hook
  window.addEventListener('keydown', function (e) {
    if (!currentConfig.enableDevTools) return;
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

  // 动态同步去广告样式生效状态
  function applyAdBlockState() {
    var nodes = document.querySelectorAll('link[href*="kook-adblock.css"], style[data-kook-adblock]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].disabled = !currentConfig.blockAds;
    }
  }

  function isElectronClient() {
    try {
      return !!(window.require && window.require('electron')) ||
             (navigator && navigator.userAgent && navigator.userAgent.indexOf('Electron') !== -1);
    } catch (_) {
      return false;
    }
  }

  // 右上角功能与设置下拉菜单
  function initSettingsUI() {
    if (document.getElementById('kp-settings-root')) return;

    var rightOffset = isElectronClient() ? '140px' : '16px';
    var styleEl = document.createElement('style');
    styleEl.textContent =
      '#kp-settings-root { position: fixed; top: 7px; right: ' + rightOffset + '; z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 12px; line-height: 1.4; user-select: none; }' +
      '#kp-settings-btn { background: #25272d; border: 1px solid #3c404a; border-radius: 3px; color: #cfd3dc; padding: 2px 8px; cursor: pointer; display: flex; align-items: center; gap: 4px; height: 24px; box-sizing: border-box; outline: none; transition: background 0.15s, border-color 0.15s; }' +
      '#kp-settings-btn:hover { background: #2f323a; border-color: #505563; color: #ffffff; }' +
      '#kp-settings-btn .kp-arrow { font-size: 9px; opacity: 0.7; margin-left: 2px; }' +
      '#kp-settings-panel { position: absolute; top: calc(100% + 4px); right: 0; width: 220px; background: #1c1e22; border: 1px solid #363940; border-radius: 4px; box-shadow: 0 4px 16px rgba(0,0,0,0.5); padding: 8px 10px; box-sizing: border-box; display: none; }' +
      '#kp-settings-panel.kp-show { display: block; }' +
      '.kp-panel-header { font-size: 11px; font-weight: 600; color: #8a8f9d; padding-bottom: 6px; border-bottom: 1px solid #282b31; margin-bottom: 4px; }' +
      '.kp-panel-item { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid #23252a; cursor: pointer; color: #c0c4cc; }' +
      '.kp-panel-item:last-of-type { border-bottom: none; }' +
      '.kp-panel-item:hover { color: #ffffff; }' +
      '.kp-switch { position: relative; width: 28px; height: 16px; -webkit-appearance: none; appearance: none; background: #3c4048; outline: none; border-radius: 8px; cursor: pointer; transition: background 0.2s; margin: 0; }' +
      '.kp-switch:checked { background: #3ba55d; }' +
      '.kp-switch::before { content: ""; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; background: #ffffff; border-radius: 50%; transition: transform 0.2s; }' +
      '.kp-switch:checked::before { transform: translateX(12px); }' +
      '.kp-panel-footer { font-size: 10px; color: #686c77; padding-top: 6px; text-align: center; }';
    document.head.appendChild(styleEl);

    var container = document.createElement('div');
    container.id = 'kp-settings-root';
    container.innerHTML =
      '<button id="kp-settings-btn" type="button" title="KOOK 净化设置">' +
        '<span>净化设置</span><span class="kp-arrow">▾</span>' +
      '</button>' +
      '<div id="kp-settings-panel">' +
        '<div class="kp-panel-header">功能设置</div>' +
        '<label class="kp-panel-item"><span>入场音效替换</span><input type="checkbox" data-key="replaceJoinSound" class="kp-switch"' + (currentConfig.replaceJoinSound ? ' checked' : '') + ' /></label>' +
        '<label class="kp-panel-item"><span>VIP与装扮净化</span><input type="checkbox" data-key="purifyVip" class="kp-switch"' + (currentConfig.purifyVip ? ' checked' : '') + ' /></label>' +
        '<label class="kp-panel-item"><span>秒级时间显示</span><input type="checkbox" data-key="preciseTime" class="kp-switch"' + (currentConfig.preciseTime ? ' checked' : '') + ' /></label>' +
        '<label class="kp-panel-item"><span>界面广告屏蔽</span><input type="checkbox" data-key="blockAds" class="kp-switch"' + (currentConfig.blockAds ? ' checked' : '') + ' /></label>' +
        '<label class="kp-panel-item"><span>F12 开发者工具</span><input type="checkbox" data-key="enableDevTools" class="kp-switch"' + (currentConfig.enableDevTools ? ' checked' : '') + ' /></label>' +
        '<div class="kp-panel-footer">即时生效，部分项刷新后完全应用</div>' +
      '</div>';

    document.body.appendChild(container);

    var btn = container.querySelector('#kp-settings-btn');
    var panel = container.querySelector('#kp-settings-panel');

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      panel.classList.toggle('kp-show');
    });

    panel.addEventListener('click', function (e) {
      e.stopPropagation();
    });

    document.addEventListener('click', function () {
      panel.classList.remove('kp-show');
    });

    var switches = panel.querySelectorAll('.kp-switch');
    for (var i = 0; i < switches.length; i++) {
      switches[i].addEventListener('change', function () {
        var key = this.getAttribute('data-key');
        if (key in currentConfig) {
          currentConfig[key] = this.checked;
          saveConfig();
          if (key === 'blockAds') {
            applyAdBlockState();
          }
        }
      });
    }

    applyAdBlockState();
  }

  if (document.body) {
    initSettingsUI();
  } else {
    document.addEventListener('DOMContentLoaded', initSettingsUI);
  }
  setTimeout(applyAdBlockState, 1000);
})();
