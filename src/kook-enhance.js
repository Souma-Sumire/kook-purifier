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
      } catch (_) {}
    }
  }, true);
})();

