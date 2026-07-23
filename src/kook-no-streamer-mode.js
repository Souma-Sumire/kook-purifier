(function () {
  'use strict';

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
})();
