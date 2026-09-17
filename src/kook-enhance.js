(function () {
  'use strict';

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
})();
