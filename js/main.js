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

    /* The stage/plot images are only ever fetched the first time the slider
       or a budget button asks for them, so the very first drag on a fresh
       page load pays a network round-trip before it can paint. Warm the
       browser's HTTP cache for every stage x budget combo in the background
       once the page is idle, so by the time someone actually touches the
       slider the images are already local. Folder list is read off the
       buttons themselves so this stays in sync if more are ever added. */
    function prefetchStageAssets() {
      var folders = Array.prototype.map.call(folderBtns, function (b) { return b.getAttribute('data-folder'); });
      if (!folders.length) folders = [folder];
      folders.forEach(function (f) {
        for (var i = 0; i < 10; i++) {
          var prefix = root + f + '/stage' + pad(i);
          new Image().src = prefix + suffix;
          new Image().src = prefix + suffix2;
        }
      });
    }
    if ('requestIdleCallback' in window) requestIdleCallback(prefetchStageAssets, { timeout: 2000 });
    else setTimeout(prefetchStageAssets, 1000);
  }

  /* the VLA success-matrix switcher: same pill-toggle interaction as
     initStagePlayer's ER-buffer picker, but scoped to its own [data-vla-viewer]
     container (rather than a global .settings-toggle__btn query) so it can't
     get pulled into that unrelated handler */
  function initVlaViewer() {
    var root = document.querySelector('[data-vla-viewer]');
    if (!root) return;
    var img = root.querySelector('#vla-matrix-img');
    var caption = root.querySelector('#vla-matrix-caption');
    var btns = root.querySelectorAll('.viewer-toggle__btn');
    if (!img || !btns.length) return;

    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.getAttribute('aria-pressed') === 'true') return;
        btns.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
        btn.setAttribute('aria-pressed', 'true');
        var key = btn.getAttribute('data-image');
        var text = btn.getAttribute('data-caption');
        img.src = 'assets/results/' + key + '.png';
        img.alt = 'Continual learning success matrix: ' + text;
        if (caption) caption.textContent = text;
      });
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

  /* Example banks for the overlap-style demos: one entry per sampled image,
     each with its own image path, headline label, and explanation text.
     Add a new key here (matching a [data-overlap-demo] element's id in the
     HTML) for every new demo — e.g. the future Action Disagreement /
     Anchor Selection sections can each get their own list. Edit freely;
     the array can hold as many examples as you like (10-15 is plenty). */
  var OVERLAP_EXAMPLE_SETS = {
    'overlap-demo-state-overlap': [
      { image: 'assets/method/id_1.png', label: 'Inside Overlap', text: 'Reaching down is shared by many existing tasks, including Plate to Stove, Bowl to Drawer, Bowl to Stove, and Cream Cheese to Bowl.' },
      { image: 'assets/method/id_2.png', label: 'Inside Overlap', text: 'Grabbing the bowl is shared by existing tasks Bowl to Drawer, Bowl to Stove.' },
      { image: 'assets/method/id_3.png', label: 'Inside Overlap', text: 'Reaching down is shared by many existing tasks, including Plate to Stove, Bowl to Drawer, Bowl to Stove, and Cream Cheese to Bowl.' },
      { image: 'assets/method/id_4.png', label: 'Inside Overlap', text: 'The initial robot pose is shared by all existing tasks.' },
      { image: 'assets/method/id_5.png', label: 'Inside Overlap', text: 'Grabbing the bowl is shared by existing tasks Bowl to Drawer, Bowl to Stove.' },
      { image: 'assets/method/od_1.png', label: 'Outside Overlap', text: 'Moving the bowl to the plate no longer matches any other bowl tasks seen before.' },
      { image: 'assets/method/od_2.png', label: 'Outside Overlap', text: 'Moving the bowl to the plate no longer matches any other bowl tasks seen before.' },
      { image: 'assets/method/od_3.png', label: 'Outside Overlap', text: 'Moving the bowl to the plate no longer matches any other bowl tasks seen before.' },
      { image: 'assets/method/od_4.png', label: 'Outside Overlap', text: 'Moving the bowl to the plate no longer matches any other bowl tasks seen before.' },
      { image: 'assets/method/od_5.png', label: 'Outside Overlap', text: 'Moving the bowl to the plate no longer matches any other bowl tasks seen before.' },
    ],
    'overlap-demo-action-disagreement': [
      { image: 'assets/method/agree_1.png', video: 'assets/method/agree_1.mp4', label: 'Low Action Disagreement', text: 'The current policy already agrees with the new task reaching towards the bowl.' },
      { image: 'assets/method/agree_2.png', video: 'assets/method/agree_2.mp4', label: 'Low Action Disagreement', text: 'The current policy already agrees with the new task reaching towards the bowl.'},
      { image: 'assets/method/agree_3.png', video: 'assets/method/agree_3.mp4', label: 'Low Action Disagreement', text: 'The current policy already agrees with the new task reaching towards the bowl.' },
      { image: 'assets/method/agree_4.png', video: 'assets/method/agree_4.mp4', label: 'Low Action Disagreement', text: 'The current policy already agrees with the new task reaching towards the bowl.' },
      { image: 'assets/method/disagree_1.png', video: 'assets/method/disagree_1.mp4', label: 'Moderate Action Disagreement', text: 'The current policy reaches more towards the plate / cream cheese (old task), not the bowl.' },
      { image: 'assets/method/disagree_2.png', video: 'assets/method/disagree_2.mp4', label: 'High Action Disagreement', text: 'Closer to the bowl, the current policy strongly reaches for the plate (old task), not the bowl' },
      { image: 'assets/method/disagree_3.png', video: 'assets/method/disagree_3.mp4', label: 'High Action Disagreement', text: 'After grabbing the bowl, the current policy moves the bowl back to the stove (old task), not the plate.' },
      { image: 'assets/method/disagree_4.png', video: 'assets/method/disagree_4.mp4', label: 'High Action Disagreement', text: 'After grabbing the bowl, the current policy moves the bowl back to the stove (old task), not the plate.' }
    ]
  };

  /* slow continuous auto-scroll for [data-autoscroll] tracks, paused while
     the pointer or keyboard focus is inside so the tooltip/label underneath
     doesn't slide away mid-hover; loops back to the start at the end.
     Opt-in via the attribute so it never applies to plain scrollable
     strips like .orderings__track. */
  function initAutoScrollTracks() {
    var tracks = document.querySelectorAll('[data-autoscroll]');
    tracks.forEach(function (track) {
      var paused = false;
      track.addEventListener('pointerenter', function () { paused = true; });
      track.addEventListener('pointerleave', function () { paused = false; });
      track.addEventListener('focusin', function () { paused = true; });
      track.addEventListener('focusout', function () { paused = false; });

      (function tick() {
        if (!paused) {
          var max = track.scrollWidth - track.clientWidth;
          if (max > 0) {
            track.scrollLeft = track.scrollLeft >= max - 1 ? 0 : track.scrollLeft + 0.6;
          }
        }
        requestAnimationFrame(tick);
      })();
    });
  }

  /* text box under a .framestrip carousel that shows the highlighted
     card's caption + a longer explanation (from data-explain) on
     hover/focus; reverts to a default prompt once the pointer/focus
     leaves the whole track rather than staying pinned to a card */
  function initFramestripDetail() {
    var DEFAULT_LABEL = 'Memory Anchor';
    var DEFAULT_TEXT = 'Hover over a Memory Anchor for more details.';

    document.querySelectorAll('.framestrip').forEach(function (strip) {
      var detail = strip.querySelector('[data-framestrip-detail]');
      var track = strip.querySelector('.framestrip__track');
      if (!detail || !track) return;
      var labelEl = detail.querySelector('[data-framestrip-detail-label]');
      var textEl = detail.querySelector('[data-framestrip-detail-text]');
      var cards = strip.querySelectorAll('.framestrip__card');

      function show(card) {
        var tooltip = card.querySelector('.framestrip__tooltip');
        if (labelEl && tooltip) {
          labelEl.textContent = tooltip.innerHTML.replace(/<br\s*\/?>/i, ' · ');
        }
        if (textEl) textEl.textContent = card.getAttribute('data-explain') || '';
      }

      function showDefault() {
        if (labelEl) labelEl.textContent = DEFAULT_LABEL;
        if (textEl) textEl.textContent = DEFAULT_TEXT;
      }

      cards.forEach(function (card) {
        card.addEventListener('pointerenter', function () { show(card); });
        card.addEventListener('focusin', function () { show(card); });
      });
      track.addEventListener('pointerleave', showDefault);
      track.addEventListener('focusout', function (e) {
        if (!track.contains(e.relatedTarget)) showDefault();
      });

      showDefault();
    });
  }

  function initOverlapDemo() {
    var demos = document.querySelectorAll('[data-overlap-demo]');
    demos.forEach(function (demo) {
      var img = demo.querySelector('[data-overlap-img]');
      var video = demo.querySelector('[data-overlap-video]');
      var label = demo.querySelector('[data-overlap-label]');
      var text = demo.querySelector('[data-overlap-text]');
      var indexEl = demo.querySelector('[data-overlap-index]');
      var totalEl = demo.querySelector('[data-overlap-total]');
      var btn = demo.querySelector('[data-overlap-resample]');
      if (!img || !btn) return;

      var examples = OVERLAP_EXAMPLE_SETS[demo.id] || [{
        image: img.getAttribute('src'),
        video: video ? video.getAttribute('src') : null,
        label: label ? label.textContent : '',
        text: text ? text.textContent : ''
      }];
      if (totalEl) totalEl.textContent = examples.length;

      var current = 0;
      function show(i) {
        var ex = examples[i];
        img.src = ex.image;
        if (video && ex.video) {
          video.src = ex.video;
          video.load();
          video.play().catch(function () {});
        }
        if (label) label.textContent = ex.label;
        if (text) text.textContent = ex.text;
        if (indexEl) indexEl.textContent = i + 1;
      }
      show(current);

      btn.addEventListener('click', function () {
        if (examples.length < 2) return;
        var next;
        do { next = Math.floor(Math.random() * examples.length); } while (next === current);
        current = next;
        show(current);
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
    initVlaViewer();
    initVideoSync();
    initOverlapDemo();
    initAutoScrollTracks();
    initFramestripDetail();
    initRailSpy();
  });
})();
