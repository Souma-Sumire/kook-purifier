(function () {
  'use strict';

  var CONFIG_KEY = 'kook_purifier_config';
  var defaultConfig = {
    replaceJoinSound: true,
    purifyVip: true,
    blockAds: true,
    enableDevTools: true,
    noStreamer: true
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

  // DevTools 快捷键与主进程状态同步
  function syncDevToolsStateToMain() {
    try {
      if (window.require) {
        var electron = window.require('electron');
        if (electron && electron.ipcRenderer) {
          electron.ipcRenderer.send('set-devtools-enabled', currentConfig.enableDevTools);
        }
      }
    } catch (_) {}
  }

  window.addEventListener('keydown', function (e) {
    var isF12 = e.key === 'F12';
    var isCtrlShiftI = (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i');
    if (isF12 || isCtrlShiftI) {
      if (!currentConfig.enableDevTools) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
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
  syncDevToolsStateToMain();

  // 动态同步去广告样式生效状态
  function applyAdBlockState() {
    var nodes = document.querySelectorAll('link[href*="kook-adblock.css"], style[data-kook-adblock]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].disabled = !currentConfig.blockAds;
    }
  }

  // 右上角功能与设置下拉菜单单例与常驻挂载守护
  var settingsRoot = null;
  var settingsGroup = null;

  function ensureStyles() {
    if (document.getElementById('kp-settings-style')) return;
    var styleEl = document.createElement('style');
    styleEl.id = 'kp-settings-style';
    styleEl.textContent =
      '#kp-settings-group {' +
      '  display: inline-flex !important;' +
      '  align-items: center !important;' +
      '  height: 100% !important;' +
      '  margin-right: 6px !important;' +
      '  -webkit-app-region: no-drag !important;' +
      '  vertical-align: middle !important;' +
      '}' +
      '#kp-settings-root {' +
      '  position: relative;' +
      '  display: inline-flex;' +
      '  align-items: center;' +
      '  height: 100%;' +
      '  -webkit-app-region: no-drag !important;' +
      '  user-select: none;' +
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;' +
      '  -webkit-font-smoothing: antialiased;' +
      '  -moz-osx-font-smoothing: grayscale;' +
      '  font-size: 12px;' +
      '  line-height: 1.4;' +
      '  vertical-align: middle;' +
      '}' +
      '#kp-settings-root.kp-fallback-mode {' +
      '  position: fixed;' +
      '  top: 7px;' +
      '  right: 16px;' +
      '  z-index: 999999;' +
      '}' +
      '#kp-settings-btn {' +
      '  background: #26282d;' +
      '  border: 1px solid #3c414c;' +
      '  border-radius: 4px;' +
      '  color: #e4e7ed;' +
      '  padding: 0 9px;' +
      '  cursor: pointer;' +
      '  display: inline-flex;' +
      '  align-items: center;' +
      '  gap: 4px;' +
      '  height: 24px;' +
      '  box-sizing: border-box;' +
      '  outline: none;' +
      '  font-size: 12px;' +
      '  font-weight: 500;' +
      '  letter-spacing: 0.2px;' +
      '  transition: all 0.15s ease;' +
      '  -webkit-app-region: no-drag !important;' +
      '}' +
      '#kp-settings-btn:hover {' +
      '  background: #30333b;' +
      '  border-color: #525866;' +
      '  color: #ffffff;' +
      '}' +
      '#kp-settings-btn .kp-arrow {' +
      '  font-size: 9px;' +
      '  color: #a4a9b6;' +
      '  margin-left: 2px;' +
      '}' +
      '#kp-settings-panel {' +
      '  position: absolute;' +
      '  top: calc(100% + 5px);' +
      '  right: 0;' +
      '  width: 260px;' +
      '  background: #1e2025;' +
      '  border: 1px solid #363a43;' +
      '  border-radius: 6px;' +
      '  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.65);' +
      '  padding: 9px 12px;' +
      '  box-sizing: border-box;' +
      '  z-index: 999999;' +
      '  display: none;' +
      '  -webkit-app-region: no-drag !important;' +
      '}' +
      '#kp-settings-panel.kp-show {' +
      '  display: block;' +
      '}' +
      '.kp-panel-header {' +
      '  font-size: 12px;' +
      '  font-weight: 600;' +
      '  color: #cbd0db;' +
      '  padding-bottom: 7px;' +
      '  border-bottom: 1px solid #2d3037;' +
      '  margin-bottom: 4px;' +
      '  display: flex;' +
      '  justify-content: space-between;' +
      '}' +
      '.kp-panel-item {' +
      '  display: flex;' +
      '  justify-content: space-between;' +
      '  align-items: center;' +
      '  padding: 6px 0;' +
      '  border-bottom: 1px solid #272a30;' +
      '  cursor: pointer;' +
      '  color: #dcdfe6;' +
      '  font-size: 13px;' +
      '  font-weight: 500;' +
      '}' +
      '.kp-panel-item:last-of-type {' +
      '  border-bottom: none;' +
      '}' +
      '.kp-panel-item:hover {' +
      '  color: #ffffff;' +
      '}' +
      '.kp-item-info {' +
      '  display: flex;' +
      '  align-items: center;' +
      '}' +
      '.kp-badge {' +
      '  font-size: 11px;' +
      '  font-weight: 500;' +
      '  padding: 1px 6px;' +
      '  border-radius: 3px;' +
      '  margin-left: 7px;' +
      '  line-height: 1.3;' +
      '}' +
      '.kp-badge-instant {' +
      '  background: rgba(67, 181, 129, 0.2);' +
      '  color: #52c48f;' +
      '  border: 1px solid rgba(67, 181, 129, 0.45);' +
      '}' +
      '.kp-badge-refresh {' +
      '  background: rgba(250, 166, 26, 0.2);' +
      '  color: #ffb733;' +
      '  border: 1px solid rgba(250, 166, 26, 0.45);' +
      '}' +
      '.kp-badge-restart {' +
      '  background: rgba(114, 137, 218, 0.2);' +
      '  color: #9bb1ff;' +
      '  border: 1px solid rgba(114, 137, 218, 0.45);' +
      '}' +
      '.kp-switch {' +
      '  position: relative;' +
      '  width: 28px;' +
      '  height: 16px;' +
      '  -webkit-appearance: none;' +
      '  appearance: none;' +
      '  background: #3e424c;' +
      '  outline: none;' +
      '  border-radius: 8px;' +
      '  cursor: pointer;' +
      '  transition: background 0.2s;' +
      '  margin: 0;' +
      '}' +
      '.kp-switch:checked {' +
      '  background: #3ba55d;' +
      '}' +
      '.kp-switch::before {' +
      '  content: "";' +
      '  position: absolute;' +
      '  top: 2px;' +
      '  left: 2px;' +
      '  width: 12px;' +
      '  height: 12px;' +
      '  background: #ffffff;' +
      '  border-radius: 50%;' +
      '  transition: transform 0.2s;' +
      '}' +
      '.kp-switch:checked::before {' +
      '  transform: translateX(12px);' +
      '}' +
      '.kp-panel-footer {' +
      '  margin-top: 7px;' +
      '  padding-top: 7px;' +
      '  border-top: 1px solid #2d3037;' +
      '}' +
      '.kp-footer-note {' +
      '  font-size: 11px;' +
      '  color: #9aa0ad;' +
      '  margin-bottom: 7px;' +
      '}' +
      '.kp-reload-btn {' +
      '  width: 100%;' +
      '  background: #2c2f36;' +
      '  border: 1px solid #3d434f;' +
      '  border-radius: 4px;' +
      '  color: #dce0e8;' +
      '  font-size: 12px;' +
      '  font-weight: 500;' +
      '  padding: 5px 0;' +
      '  cursor: pointer;' +
      '  transition: background 0.15s, color 0.15s;' +
      '}' +
      '.kp-reload-btn:hover {' +
      '  background: #383d47;' +
      '  color: #ffffff;' +
      '}';
    (document.head || document.documentElement).appendChild(styleEl);
  }

  function getSettingsElement() {
    if (settingsRoot) return settingsRoot;

    ensureStyles();

    var container = document.createElement('div');
    container.id = 'kp-settings-root';
    container.innerHTML =
      '<button id="kp-settings-btn" type="button" title="KOOK 净化设置">' +
        '<span>净化设置</span><span class="kp-arrow">▾</span>' +
      '</button>' +
      '<div id="kp-settings-panel">' +
        '<div class="kp-panel-header">' +
          '<span>净化功能设置</span>' +
        '</div>' +
        '<label class="kp-panel-item">' +
          '<div class="kp-item-info"><span>入场音效替换</span><span class="kp-badge kp-badge-instant">即时</span></div>' +
          '<input type="checkbox" data-key="replaceJoinSound" class="kp-switch"' + (currentConfig.replaceJoinSound ? ' checked' : '') + ' />' +
        '</label>' +
        '<label class="kp-panel-item">' +
          '<div class="kp-item-info"><span>界面广告屏蔽</span><span class="kp-badge kp-badge-instant">即时</span></div>' +
          '<input type="checkbox" data-key="blockAds" class="kp-switch"' + (currentConfig.blockAds ? ' checked' : '') + ' />' +
        '</label>' +
        '<label class="kp-panel-item">' +
          '<div class="kp-item-info"><span>F12 开发者工具</span><span class="kp-badge kp-badge-instant">即时</span></div>' +
          '<input type="checkbox" data-key="enableDevTools" class="kp-switch"' + (currentConfig.enableDevTools ? ' checked' : '') + ' />' +
        '</label>' +
        '<label class="kp-panel-item">' +
          '<div class="kp-item-info"><span>VIP与装扮净化</span><span class="kp-badge kp-badge-refresh">需刷新</span></div>' +
          '<input type="checkbox" data-key="purifyVip" class="kp-switch"' + (currentConfig.purifyVip ? ' checked' : '') + ' />' +
        '</label>' +
        '<label class="kp-panel-item">' +
          '<div class="kp-item-info"><span>禁用主播检测</span><span class="kp-badge kp-badge-restart">需重启</span></div>' +
          '<input type="checkbox" data-key="noStreamer" class="kp-switch"' + (currentConfig.noStreamer ? ' checked' : '') + ' />' +
        '</label>' +
        '<div class="kp-panel-footer">' +
          '<div class="kp-footer-note">提示：需刷新或需重启的项在变更后需重载应用</div>' +
          '<button id="kp-reload-btn" type="button" class="kp-reload-btn">重载页面 (Ctrl+R)</button>' +
        '</div>' +
      '</div>';

    var btn = container.querySelector('#kp-settings-btn');
    var panel = container.querySelector('#kp-settings-panel');
    var reloadBtn = container.querySelector('#kp-reload-btn');

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

    if (reloadBtn) {
      reloadBtn.addEventListener('click', function () {
        window.location.reload();
      });
    }

    var switches = panel.querySelectorAll('.kp-switch');
    for (var i = 0; i < switches.length; i++) {
      switches[i].addEventListener('change', function () {
        var key = this.getAttribute('data-key');
        if (key in currentConfig) {
          currentConfig[key] = this.checked;
          saveConfig();
          if (key === 'blockAds') {
            applyAdBlockState();
          } else if (key === 'enableDevTools') {
            syncDevToolsStateToMain();
          }
        }
      });
    }

    settingsRoot = container;
    return settingsRoot;
  }

  function getSettingsGroup() {
    if (settingsGroup) return settingsGroup;
    var group = document.createElement('div');
    group.id = 'kp-settings-group';
    group.className = 'win-title-bar-icon-group';
    settingsGroup = group;
    return settingsGroup;
  }

  function isElectronApp() {
    try {
      return !!(window.require && window.require('electron')) ||
             (navigator && navigator.userAgent && navigator.userAgent.indexOf('Electron') !== -1);
    } catch (_) {
      return false;
    }
  }

  function syncSettingsUIAttachment() {
    var rightBox = document.querySelector('.win-title-inner .right');
    if (rightBox) {
      var container = getSettingsElement();
      var group = getSettingsGroup();

      if (container.parentNode !== group) {
        group.appendChild(container);
      }

      // 查找 right 容器中所有的 win-title-bar-icon-group（排除我们自己的 group）
      var iconGroups = rightBox.querySelectorAll(':scope > .win-title-bar-icon-group:not(#kp-settings-group)');
      var windowControlGroup = iconGroups.length > 0 ? iconGroups[iconGroups.length - 1] : null;

      if (windowControlGroup) {
        // 挂载到最小化/最大化/关闭按钮组的前方（左侧）
        if (group.nextElementSibling !== windowControlGroup || group.parentNode !== rightBox) {
          rightBox.insertBefore(group, windowControlGroup);
        }
      } else {
        if (group.parentNode !== rightBox) {
          rightBox.appendChild(group);
        }
      }
      container.classList.remove('kp-fallback-mode');
    } else if (!isElectronApp()) {
      // 纯网页版：仅在应用主视图就绪后挂载到右上角
      var isWebReady = !!document.querySelector('.guild-list, .chat-panel, .user-me-wrapper, #root .app-background');
      if (isWebReady) {
        var container = getSettingsElement();
        var body = document.body || document.documentElement;
        if (body && (container.parentNode !== body || !body.contains(container))) {
          container.classList.add('kp-fallback-mode');
          body.appendChild(container);
        }
      }
    } else {
      // 桌面客户端在开屏 Loading 阶段：保持隐藏，绝不在 loading 画面浮现
      if (settingsGroup && settingsGroup.parentNode) {
        settingsGroup.parentNode.removeChild(settingsGroup);
      }
      if (settingsRoot && settingsRoot.parentNode && settingsRoot.parentNode !== settingsGroup) {
        settingsRoot.parentNode.removeChild(settingsRoot);
      }
    }

    applyAdBlockState();
  }

  var syncAttachmentScheduled = false;
  function scheduleSyncAttachment() {
    if (syncAttachmentScheduled) return;
    syncAttachmentScheduled = true;
    var raf = window.requestAnimationFrame || function (cb) { setTimeout(cb, 16); };
    raf(function () {
      syncAttachmentScheduled = false;
      syncSettingsUIAttachment();
    });
  }

  // 永久监听 DOM 树变动（解决 React 切频道重绘标题栏导致节点被卸载问题）
  var titleWatchObserver = new MutationObserver(function () {
    scheduleSyncAttachment();
  });

  function startTitleWatcher() {
    var rootEl = document.documentElement || document.body;
    if (rootEl) {
      titleWatchObserver.observe(rootEl, { childList: true, subtree: true });
    }
    syncSettingsUIAttachment();
    setInterval(syncSettingsUIAttachment, 1500);
    window.addEventListener('popstate', scheduleSyncAttachment);
    window.addEventListener('hashchange', scheduleSyncAttachment);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startTitleWatcher);
  } else {
    startTitleWatcher();
  }
})();
