(function () {
  'use strict';

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
})();
