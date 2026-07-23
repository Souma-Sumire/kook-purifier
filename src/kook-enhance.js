(function () {
  'use strict';

  var blocked = [
    // 第三方与自研数据统计/埋点上报
    'hm.baidu.com',
    'sentry.kookapp.cn',
    'sentry.io',
    'log.kookapp.cn',
    'errorlog.kookapp.com.cn',
    'stat.kookapp.cn',
    'analytics.kookapp.cn',
    'tracker.kookapp.cn',
    'order_tracker',

    // API数据收集与日志上报接口
    '/api/v2/reports',
    '/api/v2/assets/log',
    '/api/v3/message/report',
    '/api/v3/user/report-activity',
    '/api/v3/mall/box-log',

    // 自动更新与热更新检测
    '/api/v3/app/version',
    '/api/v3/app/check-update',
    '/api/v3/app/hot-update',
    'hotupdate.kookapp.cn',
    'update.kookapp.cn'
  ];

  // 净化 API 数据结构中的 VIP / 挂件 / 铭牌 状态
  function purifyData(data) {
    if (!data || typeof data !== 'object') return data;
    if (Array.isArray(data)) {
      for (var i = 0; i < data.length; i++) {
        purifyData(data[i]);
      }
    } else {
      if ('is_vip' in data) data.is_vip = 0;
      if ('vip' in data && typeof data.vip === 'number') data.vip = 0;
      if ('vip_type' in data) data.vip_type = 0;
      if ('vip_avatar' in data) data.vip_avatar = 0;
      if ('vip_buff' in data) data.vip_buff = 0;
      if ('nameplate' in data) data.nameplate = null;
      if ('decorations' in data) data.decorations = null;
      for (var k in data) {
        if (Object.prototype.hasOwnProperty.call(data, k) && typeof data[k] === 'object') {
          purifyData(data[k]);
        }
      }
    }
    return data;
  }

  // Hook Fetch 接口
  var origFetch = window.fetch;
  window.fetch = function (url, options) {
    var s = typeof url === 'string' ? url : (url && url.url) || '';
    if (blocked.some(function (d) { return s.indexOf(d) !== -1; })) {
      return Promise.resolve(new Response('', { status: 200 }));
    }
    return origFetch.apply(this, arguments).then(function (res) {
      if (s.indexOf('/api/') !== -1) {
        var clone = res.clone();
        return clone.json().then(function (json) {
          purifyData(json);
          return new Response(JSON.stringify(json), {
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
    this._url = url || '';
    if (blocked.some(function (d) { return (this._url).indexOf(d) !== -1; })) {
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
    if (this._url.indexOf('/api/') !== -1) {
      var xhrSelf = this;
      var origOnReady = xhrSelf.onreadystatechange;
      xhrSelf.onreadystatechange = function () {
        if (xhrSelf.readyState === 4 && xhrSelf.status === 200 && xhrSelf.responseText) {
          try {
            var json = JSON.parse(xhrSelf.responseText);
            purifyData(json);
            Object.defineProperty(xhrSelf, 'responseText', { value: JSON.stringify(json) });
            Object.defineProperty(xhrSelf, 'response', { value: JSON.stringify(json) });
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

  // WebSocket 实时长连接数据清洗 Hook
  var OrigWS = window.WebSocket;
  window.WebSocket = function (url, protocols) {
    var ws = protocols ? new OrigWS(url, protocols) : new OrigWS(url);
    var origAddEventListener = ws.addEventListener;
    ws.addEventListener = function (type, listener, options) {
      if (type === 'message') {
        var wrappedListener = function (e) {
          if (e && typeof e.data === 'string' && e.data.charAt(0) === '{') {
            try {
              var json = JSON.parse(e.data);
              purifyData(json);
              var newEvent = new MessageEvent('message', {
                data: JSON.stringify(json),
                origin: e.origin,
                lastEventId: e.lastEventId,
                source: e.source,
                ports: e.ports
              });
              return listener.call(this, newEvent);
            } catch (_) {}
          }
          return listener.apply(this, arguments);
        };
        return origAddEventListener.call(this, type, wrappedListener, options);
      }
      return origAddEventListener.apply(this, arguments);
    };
    return ws;
  };
  window.WebSocket.prototype = OrigWS.prototype;

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

  // 个性化/装扮提示音 Hook（还原为默认提示音）
  var soundPatterns = [
    /img\.kookapp\.cn\/assets\/item\/resources\/.+\.mp3/,
    /resources\/.+_notifications?_.+\.mp3/
  ];
  var OrigAudio = window.Audio;
  window.Audio = new Proxy(OrigAudio, {
    construct: function (target, args) {
      var audio = new target(args[0]);
      var origPlay = audio.play;
      audio.play = function () {
        try {
          if (soundPatterns.some(function (re) { return re.test(audio.src); })) {
            audio.src = 'https://static.kookapp.cn/app/assets/audio/user-join.mp3';
          }
        } catch (_) {}
        return origPlay.apply(audio, arguments);
      };
      return audio;
    }
  });

  var origBeacon = navigator.sendBeacon;
  navigator.sendBeacon = function (url, data) {
    if (blocked.some(function (d) { return (url || '').indexOf(d) !== -1; })) {
      return true;
    }
    return origBeacon.apply(navigator, arguments);
  };

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

