(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var $all = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  var PROFILE_KEY = 'ammar_company_profile';

  function loadOnboardingFields() {
    try {
      var raw = localStorage.getItem('ammar_onboarding_data');
      return raw ? (JSON.parse(raw).fields || {}) : {};
    } catch (e) { return {}; }
  }

  function loadProfile() {
    try {
      var raw = localStorage.getItem(PROFILE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function initFields() {
    var fields = loadOnboardingFields();
    var profile = loadProfile();
    var companyName = null;
    try { companyName = localStorage.getItem('ammar_company_name'); } catch (e) { /* ignore */ }

    var name = companyName || fields.companyName || 'شركة البناء الحديث للمقاولات العامة';
    $('#coName').value = name;
    $('#coLogoPreview').textContent = name.trim().charAt(0);
    $('#coCr').value = fields.crNumber || '1010234567';
    $('#coDesc').value = profile.description || '';
    $('#coDescCount').textContent = String((profile.description || '').length);
    $('#coWebsite').value = profile.website || '';
    $('#coTwitter').value = profile.twitter || '';
    $('#coInstagram').value = profile.instagram || '';

    var verified = false;
    try { verified = localStorage.getItem('ammar_supplier_profile_verified') === 'true'; } catch (e) { /* ignore */ }
    var statusEl = $('#coVerifyStatus');
    if (verified) { statusEl.textContent = 'معتمد'; statusEl.className = 'pd-status-pill active'; }
  }

  function initLogoUpload() {
    var dropzone = $('#coLogoDropzone');
    var input = $('#coLogoInput');
    dropzone.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      var file = input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        $('#coLogoPreview').innerHTML = '<img src="' + e.target.result + '" alt="شعار" style="width:100%;height:100%;object-fit:cover;" />';
      };
      reader.readAsDataURL(file);
      if (window.Shell) Shell.toast('تم تحديث الشعار (معاينة فقط في هذه النسخة)');
    });
  }

  function initCertUploads() {
    $all('[data-upload]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.cert-card');
        var small = card.querySelector('small');
        small.textContent = 'تم الرفع — قيد المراجعة';
        card.querySelector('.cert-icon').style.background = 'var(--success-bg)';
        card.querySelector('.cert-icon').style.color = 'var(--success)';
        btn.remove();
        if (window.Shell) Shell.toast('تم رفع الملف بنجاح', 'success');
      });
    });
  }

  function initDescCounter() {
    $('#coDesc').addEventListener('input', function () { $('#coDescCount').textContent = String($('#coDesc').value.length); });
  }

  function initSave() {
    $('#coSaveBtn').addEventListener('click', function () {
      var data = {
        description: $('#coDesc').value.trim(),
        website: $('#coWebsite').value.trim(),
        twitter: $('#coTwitter').value.trim(),
        instagram: $('#coInstagram').value.trim()
      };
      try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(data));
        var newName = $('#coName').value.trim();
        if (newName) localStorage.setItem('ammar_company_name', newName);
      } catch (e) { /* ignore */ }
      if (window.Shell) Shell.toast('تم حفظ ملف الشركة بنجاح', 'success');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initFields();
    initLogoUpload();
    initCertUploads();
    initDescCounter();
    initSave();
  });
})();
