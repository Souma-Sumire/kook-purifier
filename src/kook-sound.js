(function () {
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
})();
