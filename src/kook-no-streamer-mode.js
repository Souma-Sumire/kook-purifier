(function () {
  'use strict';

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
})();
