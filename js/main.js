(function () {
  'use strict';

  function initTheme() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    function label() {
      var day = document.documentElement.getAttribute('data-theme') !== 'night';
      btn.textContent = day ? '◐' : '◑';
    }
    label();
    btn.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme') === 'night' ? 'night' : 'day';
      var next = cur === 'day' ? 'night' : 'day';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      label();
    });
  }

  function initReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window) || !els.length) {
      els.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  }

  function initBibCopy() {
    var btn = document.getElementById('bib-copy');
    var text = document.getElementById('bib-text');
    if (!btn || !text) return;
    btn.addEventListener('click', function () {
      var reset = function () { btn.textContent = 'Copy'; };
      navigator.clipboard.writeText(text.textContent).then(function () {
        btn.textContent = 'Copied';
        setTimeout(reset, 1500);
      }, reset);
    });
  }

  function initStagePlayer() {
    var slider = document.getElementById('stage-slider');
    var img = document.getElementById('stage-img');
    var img2 = document.getElementById('stage-img-2');
    var label = document.getElementById('stage-label');
    var nbtValue = document.getElementById('nbt-value');
    var folderBtns = document.querySelectorAll('.settings-toggle__btn');
    if (!slider || !img || !label) return;

    var root = 'assets/sequential_learning/';
    var suffix = '_continual_success_matrix.svg';
    var suffix2 = '_figure_ready_successes_plot.svg';
    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    var activeBtn = document.querySelector('.settings-toggle__btn[aria-pressed="true"]');
    var folder = activeBtn ? activeBtn.getAttribute('data-folder') : '01';
    if (activeBtn && nbtValue) nbtValue.textContent = activeBtn.getAttribute('data-nbt');

    function render() {
      var n = Number(slider.value);
      var prefix = root + folder + '/stage' + pad(n - 1);
      img.src = prefix + suffix;
      img.alt = 'Continual learning success matrix at training stage ' + n;
      if (img2) {
        img2.src = prefix + suffix2;
        img2.alt = 'Figure-ready successes plot at training stage ' + n;
      }
      label.textContent = n;
      slider.setAttribute('aria-valuetext', 'Stage ' + n);
    }

    slider.addEventListener('input', render);

    folderBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.getAttribute('aria-pressed') === 'true') return;
        folderBtns.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
        btn.setAttribute('aria-pressed', 'true');
        folder = btn.getAttribute('data-folder');
        if (nbtValue) nbtValue.textContent = btn.getAttribute('data-nbt');
        render();
      });
    });

    render();
  }

  /* reusable "Show Experiment Details" link -> <dialog>. Pair a
     .details-link[data-dialog-target] with a <dialog class="details-dialog">
     sharing that id and it wires up automatically; add as many as you like. */
  function initDetailsDialogs() {
    var links = document.querySelectorAll('.details-link[data-dialog-target]');
    links.forEach(function (link) {
      var dialog = document.getElementById(link.getAttribute('data-dialog-target'));
      if (!dialog || typeof dialog.showModal !== 'function') return;

      link.addEventListener('click', function () { dialog.showModal(); });

      dialog.addEventListener('click', function (e) {
        var r = dialog.getBoundingClientRect();
        var inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        if (!inside) dialog.close();
      });

      var closeBtn = dialog.querySelector('.details-dialog__close');
      if (closeBtn) closeBtn.addEventListener('click', function () { dialog.close(); });
    });
  }

  /* keeps a group of [data-video-sync] videos playing side by side in lockstep:
     starts them together once all are loaded, restarts the whole group the
     moment any one clip ends (so mismatched lengths don't drift apart), and
     nudges laggards back in line during playback. If the group has a
     [data-scrubbar], that bar tracks playback and lets the user drag to
     seek both videos at once; otherwise it just loops untouched. */
  function initVideoSync() {
    var groups = document.querySelectorAll('[data-video-sync]');
    groups.forEach(function (group) {
      var videos = Array.prototype.slice.call(group.querySelectorAll('video'));
      if (videos.length < 2) return;
      videos.forEach(function (v) { v.loop = false; });

      var bar = group.querySelector('[data-scrubbar]');
      var played = bar ? bar.querySelector('.scrubbar__played') : null;
      var handle = bar ? bar.querySelector('.scrubbar__handle') : null;
      var duration = 0;
      var scrubbing = false;
      var wasPlaying = false;

      if (bar) {
        var split = Number(bar.getAttribute('data-split')) || 0.5;
        bar.style.setProperty('--split', (split * 100) + '%');
      }

      function updateBar(time) {
        if (!bar || !duration) return;
        var pct = Math.max(0, Math.min(1, time / duration));
        if (played) played.style.width = (pct * 100) + '%';
        if (handle) handle.style.left = (pct * 100) + '%';
        bar.setAttribute('aria-valuenow', String(Math.round(pct * 100)));
      }

      function seekTo(time) {
        videos.forEach(function (v) { v.currentTime = Math.min(time, v.duration || time); });
        updateBar(time);
      }

      function restart() {
        videos.forEach(function (v) { v.currentTime = 0; });
        videos.forEach(function (v) { v.play().catch(function () {}); });
        updateBar(0);
      }

      var loadedCount = 0;
      videos.forEach(function (v) {
        v.addEventListener('loadedmetadata', function () {
          loadedCount++;
          if (loadedCount === videos.length) {
            duration = Math.min.apply(null, videos.map(function (vv) { return vv.duration; }));
            restart();
          }
        }, { once: true });
        v.addEventListener('ended', restart);
      });

      videos[0].addEventListener('timeupdate', function () {
        videos.slice(1).forEach(function (v) {
          if (!v.paused && Math.abs(v.currentTime - videos[0].currentTime) > 0.2) {
            v.currentTime = videos[0].currentTime;
          }
        });
      });

      if (!bar) return;

      // native `timeupdate` only fires a handful of times per second, which
      // reads as a jumpy bar — polling currentTime every animation frame
      // instead gives a smooth 60fps sweep during normal playback.
      (function tick() {
        if (!scrubbing) updateBar(videos[0].currentTime);
        requestAnimationFrame(tick);
      })();

      function fractionFromEvent(e) {
        var r = bar.getBoundingClientRect();
        var x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
        return Math.max(0, Math.min(1, x / r.width));
      }

      function moveScrub(e) {
        if (!scrubbing || !duration) return;
        seekTo(fractionFromEvent(e) * duration);
      }

      function endScrub() {
        if (!scrubbing) return;
        scrubbing = false;
        if (wasPlaying) videos.forEach(function (v) { v.play().catch(function () {}); });
      }

      bar.addEventListener('pointerdown', function (e) {
        scrubbing = true;
        wasPlaying = !videos[0].paused;
        videos.forEach(function (v) { v.pause(); });
        if (bar.setPointerCapture && e.pointerId != null) bar.setPointerCapture(e.pointerId);
        moveScrub(e);
      });
      bar.addEventListener('pointermove', moveScrub);
      bar.addEventListener('pointerup', endScrub);
      bar.addEventListener('pointercancel', endScrub);

      bar.addEventListener('keydown', function (e) {
        if (!duration) return;
        var step = duration * 0.02;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { seekTo(Math.min(duration, videos[0].currentTime + step)); e.preventDefault(); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { seekTo(Math.max(0, videos[0].currentTime - step)); e.preventDefault(); }
      });
    });
  }

  function initRailSpy() {
    var railLinks = document.querySelectorAll('.rail__links a');
    var links = document.querySelectorAll('.rail__links a, .nav__actions a');
    var sections = Array.prototype.map.call(links, function (a) {
      return document.getElementById(a.getAttribute('href').slice(1));
    }).filter(Boolean);
    if (!('IntersectionObserver' in window) || !sections.length) return;

    var current = null;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) current = entry.target.id;
      });
      if (!current) return;

      links.forEach(function (a) { a.removeAttribute('aria-current'); });
      railLinks.forEach(function (a) { a.removeAttribute('data-in'); });

      links.forEach(function (a) {
        if (a.getAttribute('href') === '#' + current) a.setAttribute('aria-current', 'true');
      });

      var activeSub = document.querySelector('.rail__links a[data-level="2"][href="#' + current + '"]');
      if (activeSub) {
        var part = activeSub.getAttribute('data-part');
        var parent = document.querySelector('.rail__links a[data-level="1"][href="#' + part + '"]');
        if (parent) parent.setAttribute('data-in', 'true');
      }
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach(function (s) { io.observe(s); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initTheme();
    initReveal();
    initBibCopy();
    initStagePlayer();
    initDetailsDialogs();
    initVideoSync();
    initRailSpy();
  });
})();
