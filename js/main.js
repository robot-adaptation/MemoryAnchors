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
    initRailSpy();
  });
})();
