/*
  i18n.js
  -------
  Generic translation loader — reusable on ANY page, not just this one.

  How language is picked (first match wins):
    1. ?lang=xx in the URL
    2. data-lang="xx" on the <html> tag of the page itself
    3. falls back to "en"

  Usage in HTML:
    <html data-lang="en">
    <h1 data-i18n="heading">Fallback text</h1>
    <input data-i18n-placeholder="search_placeholder" placeholder="Fallback">

  Add new strings by adding a key to assets/i18n/en.json, es.json, ko.json —
  no JS changes needed.
*/

(function () {
  'use strict';

  function detectLang() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('lang');
    if (fromQuery) return fromQuery;
    return document.documentElement.getAttribute('data-lang') || 'en';
  }

  function applyTranslations(dict) {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (dict[key] !== undefined) el.textContent = dict[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (dict[key] !== undefined) el.setAttribute('placeholder', dict[key]);
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria-label');
      if (dict[key] !== undefined) el.setAttribute('aria-label', dict[key]);
    });
  }

  async function initI18n() {
    const lang = detectLang();
    try {
      const res = await fetch(`assets/i18n/${lang}.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const dict = await res.json();
      applyTranslations(dict);
      document.documentElement.setAttribute('lang', lang);
      window.__i18nDict = dict; // exposed in case other scripts need strings
    } catch (err) {
      console.error(`i18n: failed to load "${lang}", keeping fallback text.`, err);
    }
  }

  document.addEventListener('DOMContentLoaded', initI18n);
})();