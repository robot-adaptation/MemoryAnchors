(function () {
  'use strict';

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* Splits a clip's data-rate ("14/20 (70%)") into the parts the task grids
     need. One shared tier calculation drives both the marker on the clip and
     the rate's color in the detail box, so those two can't drift apart. A
     rate with no parseable percentage (a "Placeholder" not yet filled in)
     comes back with tier '' and is left uncolored rather than guessed at. */
  function parseRate(rate) {
    var full = rate || '';
    var m = /\((\d+(?:\.\d+)?)%\)/.exec(full);
    var pct = m ? parseFloat(m[1]) : null;
    return {
      full: full,
      short: full.replace(/\s*\([^)]*\)\s*/, '').trim() || full, // "14/20"
      pct: pct,
      tier: pct === null ? '' : pct >= 65 ? 'pass' : pct <= 30 ? 'fail' : 'partial'
    };
  }

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
    /* Trigger on a shrunken root rather than a ratio threshold. A ratio can
       never exceed viewportHeight / elementHeight, so a threshold like 0.12
       is silently unreachable for any .reveal taller than ~8 viewports — the
       Impact section clears that on a short window, and the section would
       then stay at opacity 0 forever. rootMargin doesn't depend on the
       element's height, so it behaves the same for a 260px block and a
       6000px one: reveal once the top edge is 12% of a viewport in. */
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px -12% 0px' });
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

  /* the VLA success-matrix switcher: each result card on the right owns a
     [data-toggle-group] of viewer-toggle buttons; clicking a card swaps in
     that card's group (hiding the other) and resets it to its first option,
     so the qualitative viewer always reflects whichever card is selected */
  function initVlaViewer() {
    var root = document.querySelector('[data-vla-viewer]');
    if (!root) return;
    var img = root.querySelector('#vla-matrix-img');
    var caption = root.querySelector('#vla-matrix-caption');
    var groups = root.querySelectorAll('.viewer-toggle-groups .viewer-toggle');
    var cards = root.querySelectorAll('.vlacard--selectable');
    if (!img || !groups.length) return;

    function showImage(btn) {
      var key = btn.getAttribute('data-image');
      var text = btn.getAttribute('data-caption');
      img.src = 'assets/results/' + key + '.png';
      img.alt = 'Continual learning success matrix: ' + text;
      if (caption) caption.textContent = text;
    }

    function selectGroup(name) {
      groups.forEach(function (group) {
        var active = group.getAttribute('data-toggle-group') === name;
        group.hidden = !active;
        if (!active) return;
        var groupBtns = group.querySelectorAll('.viewer-toggle__btn');
        groupBtns.forEach(function (b, i) { b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false'); });
        if (groupBtns.length) showImage(groupBtns[0]);
      });
    }

    groups.forEach(function (group) {
      var groupBtns = group.querySelectorAll('.viewer-toggle__btn');
      groupBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (btn.getAttribute('aria-pressed') === 'true') return;
          groupBtns.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
          btn.setAttribute('aria-pressed', 'true');
          showImage(btn);
        });
      });
    });

    cards.forEach(function (card) {
      function select() {
        if (card.getAttribute('aria-pressed') === 'true') return;
        cards.forEach(function (c) {
          c.classList.remove('vlacard--selected');
          c.setAttribute('aria-pressed', 'false');
        });
        card.classList.add('vlacard--selected');
        card.setAttribute('aria-pressed', 'true');
        selectGroup(card.getAttribute('data-card-target'));
      }
      card.addEventListener('click', select);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
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
      var pendingSeek = null;

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

      function applySeek(time) {
        pendingSeek = null;
        videos.forEach(function (v) { v.currentTime = Math.min(time, v.duration || time); });
      }

      /* Hold at most one outstanding seek per group. A drag emits pointermove
         far faster than a decoder can serve seeks, and each queued seek is
         work the pointer has already moved past -- issuing them all is what
         makes a fast scrub visibly trail the finger. Keeping only the newest
         target and handing it over once the previous seek lands lets the clip
         converge on where the pointer is *now*, dropping the intermediate
         positions nobody sees anyway. Cheap seeks matter as much as few ones:
         these clips are encoded with a keyframe every 5 frames so landing on
         an arbitrary position decodes ~5 frames rather than replaying the
         whole clip from its only keyframe at t=0. */
      function flushSeek() {
        if (pendingSeek === null) return;
        if (videos.some(function (v) { return v.seeking; })) return;
        applySeek(pendingSeek);
      }

      /* the bar moves synchronously so it stays glued to the pointer no
         matter how far the decoder trails behind it */
      function seekTo(time) {
        pendingSeek = time;
        updateBar(time);
        flushSeek();
      }

      function restart() {
        videos.forEach(function (v) { v.currentTime = 0; });
        videos.forEach(function (v) { v.play().catch(function () {}); });
        updateBar(0);
      }

      /* Unlike every other clip on the page, these carry no `autoplay`/`loop`
         attribute -- the group is started and re-looped from here so the two
         halves stay in lockstep. That makes this readiness check the only
         thing between a fresh load and a frozen pair, so it must not hang off
         `loadedmetadata` alone: with preload="auto" and a warm cache the
         metadata is frequently already in by the time DOMContentLoaded runs
         this, and a listener attached after the event has fired never runs.
         Missing it left `duration` at 0, which both stopped playback from
         ever starting and made the scrub bar inert, since every seek path
         bails on !duration -- the "frozen video I also can't drag" symptom.
         So check readyState synchronously here, and treat durationchange /
         canplay as extra chances rather than trusting one shot at one event. */
      var ready = videos.map(function () { return false; });
      var started = false;

      function startGroup(durs) {
        duration = Math.min.apply(null, durs);
        started = true;
        restart();
      }

      function markReady(i) {
        var v = videos[i];
        if (ready[i] || v.readyState < 1 || !isFinite(v.duration) || !v.duration) return;
        ready[i] = true;
        if (started || !ready.every(Boolean)) return;
        startGroup(videos.map(function (vv) { return vv.duration; }));
      }

      videos.forEach(function (v, i) {
        ['loadedmetadata', 'durationchange', 'canplay'].forEach(function (evt) {
          v.addEventListener(evt, function () { markReady(i); });
        });
        v.addEventListener('ended', restart);
        markReady(i);
      });

      /* If one clip 404s or stalls, the group would otherwise wait forever on
         a `ready` slot that never fills. Fall back to whatever did load so the
         surviving video still plays and the bar still scrubs. */
      setTimeout(function () {
        if (started) return;
        var durs = videos.map(function (v) { return v.duration; })
          .filter(function (d) { return isFinite(d) && d > 0; });
        if (durs.length) startGroup(durs);
      }, 5000);

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
        flushSeek();
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
        /* land exactly where the pointer was released before resuming, so a
           coalesced-away intermediate can't leave playback a few frames off */
        if (pendingSeek !== null) applySeek(pendingSeek);
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
      { image: 'assets/method/id_1.png', label: 'Inside Overlap', tone: 'in', text: 'Reaching down is shared by many existing tasks, including Plate to Stove, Bowl to Drawer, Bowl to Stove, and Cream Cheese to Bowl.' },
      { image: 'assets/method/id_2.png', label: 'Inside Overlap', tone: 'in', text: 'Grabbing the bowl is shared by existing tasks Bowl to Drawer and Bowl to Stove.' },
      { image: 'assets/method/id_3.png', label: 'Inside Overlap', tone: 'in', text: 'Reaching down is shared by many existing tasks, including Plate to Stove, Bowl to Drawer, Bowl to Stove, and Cream Cheese to Bowl.' },
      { image: 'assets/method/id_4.png', label: 'Inside Overlap', tone: 'in', text: 'The initial robot pose is shared by all existing tasks.' },
      { image: 'assets/method/id_5.png', label: 'Inside Overlap', tone: 'in', text: 'Grabbing the bowl is shared by existing tasks Bowl to Drawer and Bowl to Stove.' },
      { image: 'assets/method/od_1.png', label: 'Outside Overlap', tone: 'out', text: 'Moving the bowl to the plate no longer matches any other bowl tasks seen before.' },
      { image: 'assets/method/od_2.png', label: 'Outside Overlap', tone: 'out', text: 'Moving the bowl to the plate no longer matches any other bowl tasks seen before.' },
      { image: 'assets/method/od_3.png', label: 'Outside Overlap', tone: 'out', text: 'Moving the bowl to the plate no longer matches any other bowl tasks seen before.' },
      { image: 'assets/method/od_4.png', label: 'Outside Overlap', tone: 'out', text: 'Moving the bowl to the plate no longer matches any other bowl tasks seen before.' },
      { image: 'assets/method/od_5.png', label: 'Outside Overlap', tone: 'out', text: 'Moving the bowl to the plate no longer matches any other bowl tasks seen before.' },
    ],
    'overlap-demo-action-disagreement': [
      { image: 'assets/method/agree_1.png', video: 'assets/method/agree_1.mp4', label: 'Low Action Disagreement', text: 'The current policy already agrees with the new task reaching towards the bowl.' },
      { image: 'assets/method/agree_2.png', video: 'assets/method/agree_2.mp4', label: 'Low Action Disagreement', text: 'The current policy already agrees with the new task reaching towards the bowl.'},
      { image: 'assets/method/agree_3.png', video: 'assets/method/agree_3.mp4', label: 'Low Action Disagreement', text: 'The current policy already agrees with the new task reaching towards the bowl.' },
      { image: 'assets/method/agree_4.png', video: 'assets/method/agree_4.mp4', label: 'Low Action Disagreement', text: 'The current policy already agrees with the new task reaching towards the bowl.' },
      { image: 'assets/method/disagree_1.png', video: 'assets/method/disagree_1.mp4', label: 'Moderate Action Disagreement', text: 'The current policy reaches more towards the plate / cream cheese (old task), not the bowl.' },
      { image: 'assets/method/disagree_2.png', video: 'assets/method/disagree_2.mp4', label: 'High Action Disagreement', text: 'Closer to the bowl, the current policy strongly reaches for the plate (old task), not the bowl.' },
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

  /* the cross-task video matrix's shared info box: same show/showDefault
     pattern as initFramestripDetail, but keyed off each clip's
     data-method/data-eval/data-train/data-rate/data-note rather than a
     figcaption tooltip */
  function initTaskGridDetail() {
    document.querySelectorAll('[data-taskgrid]').forEach(function (root) {
      var detail = root.querySelector('[data-taskgrid-detail]');
      var labelEl = detail && detail.querySelector('[data-taskgrid-detail-label]');
      var textEl = detail && detail.querySelector('[data-taskgrid-detail-text]');
      var videos = root.querySelectorAll('.taskgrid__video');
      if (!detail || !videos.length) return;
      /* each grid ships its own default copy in the detail box's initial
         markup (e.g. "OpenJar Continual Learning Task") — read it once
         instead of a shared module-level constant, so multiple grids on
         the same page (OpenJar, sweater folding, ...) each restore their
         own idle text rather than all falling back to the first one's */
      var DEFAULT_LABEL = labelEl ? labelEl.textContent : '';
      var DEFAULT_TEXT = textEl ? textEl.textContent : '';

      function show(v) {
        var method = v.getAttribute('data-method');
        var evalTask = v.getAttribute('data-eval');
        var trainTask = v.getAttribute('data-train');
        var rate = v.getAttribute('data-rate');
        var note = v.getAttribute('data-note') || '';
        if (labelEl) labelEl.textContent = method + ' · Eval Task ' + evalTask + ', Trained Through Task ' + trainTask;
        if (textEl) {
          var r = parseRate(rate);
          var rateHTML = '<strong class="taskgrid__rate' + (r.tier ? ' taskgrid__rate--' + r.tier : '') + '">'
            + escapeHTML(r.full) + '</strong>';
          textEl.innerHTML = 'Success rate: ' + rateHTML + '. ' + escapeHTML(note);
        }
      }
      function showDefault() {
        if (labelEl) labelEl.textContent = DEFAULT_LABEL;
        if (textEl) textEl.textContent = DEFAULT_TEXT;
      }

      videos.forEach(function (v) {
        v.setAttribute('tabindex', '0');
        v.addEventListener('pointerenter', function () { show(v); });
        v.addEventListener('focusin', function () { show(v); });
      });
      root.addEventListener('pointerleave', showDefault);
      root.addEventListener('focusout', function (e) {
        if (!root.contains(e.relatedTarget)) showDefault();
      });

      showDefault();
    });
  }

  /* Pins each clip's success rate into the corner of its cell, colored by the
     same tier as the rate in the detail box. Built from data-rate rather than
     authored in the markup so the number on the clip can't drift from the one
     below it; a clip whose rate is still a placeholder just gets no chip. */
  function initTaskGridRateChips() {
    document.querySelectorAll('[data-taskgrid] .taskgrid__cell').forEach(function (cell) {
      var video = cell.querySelector('.taskgrid__video');
      if (!video) return;
      var r = parseRate(video.getAttribute('data-rate'));
      if (!r.tier) return;
      var chip = document.createElement('span');
      chip.className = 'taskgrid__ratechip taskgrid__ratechip--' + r.tier;
      /* the same number is announced via the detail box on hover/focus, so
         keep this copy decorative for screen readers */
      chip.setAttribute('aria-hidden', 'true');
      chip.textContent = r.short;
      cell.appendChild(chip);
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
        if (label) {
          label.textContent = ex.label;
          /* the label is the one field that flips category between samples, so
             color it by the example's own `tone` to make that the thing the eye
             lands on after a resample. Driven by the data rather than matched
             off the label string, so rewording a label can't silently drop the
             color; an example with no tone just stays the default ink. */
          label.classList.remove('overlapdemo__label--in', 'overlapdemo__label--out');
          if (ex.tone) label.classList.add('overlapdemo__label--' + ex.tone);
        }
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
    initTaskGridDetail();
    initTaskGridRateChips();
    initOverlapDemo();
    initAutoScrollTracks();
    initFramestripDetail();
    initRailSpy();
  });
})();
