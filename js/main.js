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

  function initRailSpy() {
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
      links.forEach(function (a) {
        var match = a.getAttribute('href') === '#' + current;
        a.toggleAttribute('aria-current', match);
        if (match) a.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach(function (s) { io.observe(s); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initTheme();
    initReveal();
    initBibCopy();
    initRailSpy();
  });
})();
