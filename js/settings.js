(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var $all = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  function initTabs() {
    $all('.settings-nav-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $all('.settings-nav-btn').forEach(function (b) { b.classList.remove('is-active'); });
        $all('.settings-panel').forEach(function (p) { p.classList.remove('is-active'); });
        btn.classList.add('is-active');
        document.querySelector('.settings-panel[data-panel="' + btn.getAttribute('data-panel') + '"]').classList.add('is-active');
      });
    });
  }

  function initGenericSave() {
    $all('[data-save]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (window.Shell) Shell.toast(btn.getAttribute('data-save'), 'success');
      });
    });
  }

  function initPassword() {
    $('#pwSaveBtn').addEventListener('click', function () {
      var current = $('#pwCurrent').value;
      var next = $('#pwNew').value;
      var confirm = $('#pwConfirm').value;

      if (!current || !next) {
        if (window.Shell) Shell.toast('يرجى تعبئة جميع الحقول', 'danger');
        return;
      }
      if (next !== confirm) {
        if (window.Shell) Shell.toast('كلمة المرور الجديدة غير متطابقة', 'danger');
        return;
      }
      if (next.length < 8) {
        if (window.Shell) Shell.toast('يجب ألا تقل كلمة المرور عن 8 أحرف', 'danger');
        return;
      }
      $('#pwCurrent').value = ''; $('#pwNew').value = ''; $('#pwConfirm').value = '';
      if (window.Shell) Shell.toast('تم تحديث كلمة المرور بنجاح', 'success');
    });
  }

  function initSecurity() {
    $('#tfaToggle').addEventListener('change', function () {
      if (window.Shell) Shell.toast(this.checked ? 'تم تفعيل التحقق بخطوتين' : 'تم إيقاف التحقق بخطوتين', this.checked ? 'success' : 'danger');
    });
    $('#endSessionBtn').addEventListener('click', function () {
      if (window.confirm('سيتم تسجيل خروجك من هذا الجهاز. هل تريد المتابعة؟') && window.Shell) Shell.logout();
    });
  }

  function randomKey() {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var key = 'ammar_live_';
    for (var i = 0; i < 32; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
    return key;
  }

  function initApiKeys() {
    var stored = null;
    try { stored = localStorage.getItem('ammar_api_key'); } catch (e) { /* ignore */ }
    var key = stored || randomKey();
    try { localStorage.setItem('ammar_api_key', key); } catch (e) { /* ignore */ }
    $('#apiKeyField').value = key;

    $('#apiCopyBtn').addEventListener('click', function () {
      navigator.clipboard.writeText($('#apiKeyField').value).then(function () {
        if (window.Shell) Shell.toast('تم نسخ المفتاح إلى الحافظة', 'success');
      }).catch(function () {
        if (window.Shell) Shell.toast('تعذر النسخ التلقائي، يرجى النسخ يدوياً', 'danger');
      });
    });

    $('#apiRegenBtn').addEventListener('click', function () {
      if (!window.confirm('سيتم إبطال المفتاح الحالي فوراً. هل تريد إنشاء مفتاح جديد؟')) return;
      var newKey = randomKey();
      try { localStorage.setItem('ammar_api_key', newKey); } catch (e) { /* ignore */ }
      $('#apiKeyField').value = newKey;
      if (window.Shell) Shell.toast('تم إنشاء مفتاح API جديد', 'success');
    });
  }

  function initTheme() {
    function syncButtons() {
      var theme = Shell.getTheme();
      $('#themeLightBtn').style.outline = theme === 'light' ? '2px solid var(--primary-600)' : 'none';
      $('#themeDarkBtn').style.outline = theme === 'dark' ? '2px solid var(--primary-600)' : 'none';
    }
    $('#themeLightBtn').addEventListener('click', function () { Shell.setTheme('light'); syncButtons(); Shell.toast('تم تفعيل الوضع الفاتح'); });
    $('#themeDarkBtn').addEventListener('click', function () { Shell.setTheme('dark'); syncButtons(); Shell.toast('تم تفعيل الوضع الداكن'); });
    syncButtons();
  }

  document.addEventListener('DOMContentLoaded', function () {
    initTabs();
    initGenericSave();
    initPassword();
    initSecurity();
    initApiKeys();
    if (window.Shell) initTheme();
  });
})();
