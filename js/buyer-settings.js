(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var PREFS_KEY = 'ammar_buyer_prefs';

  var NOTIF_TYPES = [
    { key: 'order', label: 'تحديثات الطلبات', desc: 'عند تغيّر حالة أي طلب لك' },
    { key: 'shipping', label: 'إشعارات الشحن', desc: 'عند شحن طلبك ووصوله' },
    { key: 'invoice', label: 'الفواتير المستحقة', desc: 'عند إصدار فاتورة أو اقتراب استحقاقها' },
    { key: 'offer', label: 'العروض والخصومات', desc: 'عروض جديدة على المنتجات التي تهمّك' }
  ];

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, kind) { if (window.Shell) Shell.toast(msg, kind); }

  function readPrefs() {
    var defaults = { language: 'ar', currency: 'SAR', notifs: { order: true, shipping: true, invoice: true, offer: true } };
    try {
      var raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return defaults;
      var saved = JSON.parse(raw);
      return Object.assign(defaults, saved, { notifs: Object.assign(defaults.notifs, saved.notifs || {}) });
    } catch (e) { return defaults; }
  }

  function writePrefs(prefs) {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ }
  }

  /* ---------------- التبويبات ---------------- */
  function initTabs() {
    $all('.settings-nav-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $all('.settings-nav-btn').forEach(function (b) { b.classList.remove('is-active'); });
        $all('.settings-panel').forEach(function (p) { p.classList.remove('is-active'); });
        btn.classList.add('is-active');
        var panel = $('.settings-panel[data-panel="' + btn.getAttribute('data-panel') + '"]');
        if (panel) panel.classList.add('is-active');
      });
    });
  }

  /* ---------------- البيانات الشخصية ---------------- */
  function fillCities(keep) {
    var regions = window.SAUDI_REGIONS || [];
    var names = [];
    regions.forEach(function (r) { r.cities.forEach(function (c) { names.push(c.name); }); });

    $('#bsCity').innerHTML = '<option value="">اختر المدينة</option>' +
      names.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
    if (keep) $('#bsCity').value = keep;
  }

  function fillProfile() {
    var p = Buyer.profile();
    $('#bsName').value = p.name || '';
    $('#bsEmail').value = p.email || '';
    $('#bsPhone').value = (p.phone || '').replace(/^\+966/, '').replace(/\s/g, '');
    fillCities(p.city);
  }

  function initProfile() {
    $('#bsSaveProfile').addEventListener('click', function () {
      var panel = $('.settings-panel[data-panel="profile"]');
      if (window.Validate && !Validate.isValid(panel)) {
        toast('يرجى تصحيح الحقول المطلوبة', 'danger');
        return;
      }

      Buyer.saveProfile({
        name: $('#bsName').value.trim(),
        email: $('#bsEmail').value.trim(),
        phone: $('#bsPhone').value.trim(),
        city: $('#bsCity').value
      });

      $('#dashCompanyName').textContent = $('#bsName').value.trim();
      toast('تم حفظ بياناتك', 'success');
    });
  }

  /* ---------------- كلمة المرور ---------------- */
  function initSecurity() {
    $('#bsSavePw').addEventListener('click', function () {
      var current = $('#bsPwCurrent').value;
      var next = $('#bsPwNew').value;
      var confirmVal = $('#bsPwConfirm').value;
      var err = $('#bsPwError');
      err.textContent = '';

      if (!current || !next) { err.textContent = 'يرجى تعبئة كلمة المرور الحالية والجديدة'; return; }
      if (next.length < 8) { err.textContent = 'يجب ألا تقل كلمة المرور عن 8 أحرف'; return; }
      if (next !== confirmVal) { err.textContent = 'كلمة المرور الجديدة غير متطابقة'; return; }

      $('#bsPwCurrent').value = ''; $('#bsPwNew').value = ''; $('#bsPwConfirm').value = '';
      toast('تم تحديث كلمة المرور بنجاح', 'success');
    });
  }

  /* ---------------- التفضيلات ---------------- */
  function syncThemeButtons() {
    if (!window.Shell) return;
    var theme = Shell.getTheme();
    $('#bsThemeLight').style.outline = theme === 'light' ? '2px solid var(--primary-600)' : 'none';
    $('#bsThemeDark').style.outline = theme === 'dark' ? '2px solid var(--primary-600)' : 'none';
  }

  function initPrefs() {
    var prefs = readPrefs();
    $('#bsLanguage').value = prefs.language;
    $('#bsCurrency').value = prefs.currency;

    $('#bsLanguage').addEventListener('change', function () {
      var p = readPrefs(); p.language = this.value; writePrefs(p);
      // الترجمة الكاملة تحتاج ملفات لغة — الاختيار محفوظ فقط حالياً
      toast(this.value === 'ar'
        ? 'تم حفظ اللغة: العربية'
        : 'تم حفظ التفضيل — ترجمة الواجهة ستتوفر عند الإطلاق', 'success');
    });

    $('#bsCurrency').addEventListener('change', function () {
      var p = readPrefs(); p.currency = this.value; writePrefs(p);
      toast('تم حفظ العملة المعروضة', 'success');
    });

    if (window.Shell) {
      $('#bsThemeLight').addEventListener('click', function () {
        Shell.setTheme('light'); syncThemeButtons(); toast('تم تفعيل الوضع الفاتح');
      });
      $('#bsThemeDark').addEventListener('click', function () {
        Shell.setTheme('dark'); syncThemeButtons(); toast('تم تفعيل الوضع الداكن');
      });
      syncThemeButtons();
    }
  }

  /* ---------------- الإشعارات ---------------- */
  function renderNotifPrefs() {
    var prefs = readPrefs();

    $('#bsNotifs').innerHTML = NOTIF_TYPES.map(function (t) {
      var on = prefs.notifs[t.key] !== false;
      return '<div class="toggle-row">' +
        '<div><strong>' + esc(t.label) + '</strong><small>' + esc(t.desc) + '</small></div>' +
        '<label class="ob-toggle"><input type="checkbox" data-notif="' + esc(t.key) + '"' + (on ? ' checked' : '') + ' />' +
        '<span class="ob-toggle-switch"></span></label>' +
      '</div>';
    }).join('');

    $all('[data-notif]', $('#bsNotifs')).forEach(function (box) {
      box.addEventListener('change', function () {
        var p = readPrefs();
        p.notifs[box.getAttribute('data-notif')] = box.checked;
        writePrefs(p);
        toast('تم تحديث تفضيلات الإشعارات', 'success');
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initTabs();
    initProfile();
    initSecurity();
    initPrefs();

    fillProfile();
    renderNotifPrefs();

    if (window.Validate) Validate.attachAll(document);
  });
})();
