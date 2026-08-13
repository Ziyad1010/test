(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var DS = Store.DOC_STATUS;
  var currentDocKey = '';

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, kind) { if (window.Shell) Shell.toast(msg, kind); }

  function prettyTime(s) {
    if (!s) return '—';
    var parts = String(s).split('T');
    return parts.length > 1 ? parts[0] + ' · ' + parts[1] : parts[0];
  }

  // بيانات التسجيل الأولي تُستخدم كقيم مبدئية عند أول فتح للصفحة
  function onboardingFields() {
    try {
      var raw = localStorage.getItem('ammar_onboarding_data');
      return raw ? (JSON.parse(raw).fields || {}) : {};
    } catch (e) { return {}; }
  }

  /* ---------------- التبويبات ---------------- */
  function initTabs() {
    $all('#coTabs .tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $all('#coTabs .tab-btn').forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        var key = btn.getAttribute('data-tab');
        $all('.co-panel').forEach(function (p) {
          p.classList.toggle('is-active', p.getAttribute('data-panel') === key);
        });
      });
    });
  }

  function showTab(key) {
    $all('#coTabs .tab-btn').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-tab') === key); });
    $all('.co-panel').forEach(function (p) { p.classList.toggle('is-active', p.getAttribute('data-panel') === key); });
  }

  /* ---------------- المناطق والمدن ---------------- */
  function fillCities(regionName, keep) {
    var regions = window.SAUDI_REGIONS || [];
    var citySel = $('#coCity');
    var region = null;
    regions.forEach(function (r) { if (r.name === regionName) region = r; });

    if (!region) {
      citySel.innerHTML = '<option value="">اختر المنطقة أولاً</option>';
      citySel.disabled = true;
      return;
    }

    citySel.innerHTML = '<option value="">اختر المدينة</option>' +
      region.cities.map(function (c) { return '<option>' + esc(c.name) + '</option>'; }).join('');
    citySel.disabled = false;
    if (keep) citySel.value = keep;
  }

  function fillRegions(selectedRegion, selectedCity) {
    var regions = window.SAUDI_REGIONS || [];
    var regionSel = $('#coRegion');

    regionSel.innerHTML = '<option value="">اختر المنطقة</option>' +
      regions.map(function (r) { return '<option>' + esc(r.name) + '</option>'; }).join('');
    if (selectedRegion) regionSel.value = selectedRegion;

    fillCities(regionSel.value, selectedCity);
    regionSel.addEventListener('change', function () { fillCities(this.value, ''); });
  }

  /* ---------------- الملف الأساسي ---------------- */
  function fillProfile() {
    var c = Store.getCompany();
    var ob = onboardingFields();

    $('#coNameAr').value = c.nameAr || ob.companyName || '';
    $('#coNameEn').value = c.nameEn || ob.companyNameEn || '';
    $('#coCrNumber').value = c.crNumber || ob.crNumber || '';
    $('#coVatNumber').value = c.vatNumber || '';
    $('#coType').value = c.companyType || ob.companyType || '';
    $('#coWebsite').value = c.website || '';
    $('#coAbout').value = c.about || '';
    $('#coEmail').value = c.email || ob.officialEmail || '';
    $('#coPhone').value = c.phone || ob.mainMobile || '';
    $('#coDistrict').value = c.district || ob.district || '';
    $('#coStreet').value = c.street || ob.street || '';
    $('#coBuildingNo').value = c.buildingNo || ob.buildingNo || '';
    $('#coPostalCode').value = c.postalCode || ob.postalCode || '';

    fillRegions(c.region || ob.region, c.city || ob.city);
    renderLogo(c);
  }

  function renderLogo(c) {
    var box = $('#coLogoPreview');
    if (c.logo) {
      box.innerHTML = '<img src="' + esc(c.logo) + '" alt="شعار الشركة" style="width:100%;height:100%;object-fit:contain;" />';
    } else {
      box.textContent = (c.nameAr || 'ش').trim().charAt(0);
    }
  }

  function collectProfile() {
    return {
      nameAr: $('#coNameAr').value.trim(),
      nameEn: $('#coNameEn').value.trim(),
      crNumber: $('#coCrNumber').value.trim(),
      vatNumber: $('#coVatNumber').value.trim(),
      companyType: $('#coType').value,
      website: $('#coWebsite').value.trim(),
      about: $('#coAbout').value.trim(),
      email: $('#coEmail').value.trim(),
      phone: $('#coPhone').value.trim(),
      region: $('#coRegion').value,
      city: $('#coCity').value,
      district: $('#coDistrict').value.trim(),
      street: $('#coStreet').value.trim(),
      buildingNo: $('#coBuildingNo').value.trim(),
      postalCode: $('#coPostalCode').value.trim()
    };
  }

  function save() {
    var panel = $('.co-panel[data-panel="profile"]');
    if (window.Validate && !Validate.isValid(panel)) {
      showTab('profile');
      toast('يرجى تصحيح الحقول المطلوبة قبل الحفظ', 'danger');
      return;
    }

    var data = collectProfile();
    Store.saveCompany(data);

    // اسم الشركة يظهر في الشريط العلوي بكل الصفحات
    try { if (data.nameAr) localStorage.setItem('ammar_company_name', data.nameAr); } catch (e) { /* ignore */ }
    if (data.nameAr) $('#dashCompanyName').textContent = data.nameAr;

    renderLogo(Store.getCompany());
    renderAudit();
    renderAlerts();
    toast('تم حفظ بيانات الشركة', 'success');
  }

  /* ---------------- التنبيهات ---------------- */
  function alertHtml(tone, body) {
    return '<div class="ord-alert ' + tone + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
      '<span>' + body + '</span></div>';
  }

  function renderAlerts() {
    var c = Store.getCompany();
    var docs = Store.getDocuments();
    var out = '';

    if (!c.vatNumber) {
      out += alertHtml('warn', '<strong>الرقم الضريبي غير مكتمل.</strong> ' +
        'إضافته إلزامية لإصدار فواتير ضريبية نظامية للمشترين.');
    }

    var rejected = Store.DOC_TYPES.filter(function (d) { return docs[d.key] && docs[d.key].status === 'rejected'; });
    if (rejected.length) {
      out += alertHtml('bad', '<strong>' + rejected.length + ' مستند مرفوض.</strong> ' +
        'راجع سبب الرفض في تبويب المستندات وأعد رفع نسخة صحيحة.');
    }

    var missing = Store.DOC_TYPES.filter(function (d) {
      return d.required && (!docs[d.key] || docs[d.key].status === 'missing');
    });
    if (missing.length) {
      out += alertHtml('warn', '<strong>مستندات إلزامية ناقصة:</strong> ' +
        missing.map(function (d) { return esc(d.label); }).join('، ') + '.');
    }

    $('#coAlerts').innerHTML = out;
  }

  /* ---------------- المستندات ---------------- */
  function renderDocuments() {
    var docs = Store.getDocuments();

    $('#coDocuments').innerHTML = Store.DOC_TYPES.map(function (d) {
      var doc = docs[d.key] || { status: 'missing' };
      var meta = DS[doc.status] || DS.missing;
      var uploaded = doc.status !== 'missing';

      return '<div class="ord-card" style="margin-bottom:14px;">' +
        '<div class="ord-card-head" style="margin-bottom:12px;padding-bottom:10px;">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
          '<h3>' + esc(d.label) + (d.required ? ' <em style="color:var(--danger);font-style:normal;">*</em>' : '') + '</h3>' +
          '<span class="ord-status ' + meta.tone + '">' + meta.label + '</span>' +
        '</div>' +
        '<p style="font-size:0.81rem;color:var(--muted);line-height:1.7;margin-bottom:12px;">' + esc(d.hint) + '</p>' +
        (doc.status === 'rejected' && doc.reason
          ? alertHtml('bad', '<strong>سبب الرفض:</strong> ' + esc(doc.reason))
          : '') +
        (uploaded
          // المستند المرفوع قابل للنقر لفتح معاينته أو استبداله
          ? '<div class="cert-card" data-doc-open="' + d.key + '" tabindex="0" style="cursor:pointer;">' +
              '<span class="cert-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>' +
              '<div class="cert-info"><strong>' + esc(doc.fileName) + '</strong>' +
              '<small>رُفع في ' + prettyTime(doc.uploadedAt) + ' — اضغط للمعاينة أو الاستبدال</small></div>' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;color:var(--primary-600);"><polyline points="15 18 9 12 15 6"/></svg>' +
            '</div>'
          : '<button type="button" class="pd-dropzone-sm" data-doc-upload="' + d.key + '" style="width:100%;">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
              '<span>اضغط لرفع ' + esc(d.label) + ' (صورة أو PDF)</span>' +
            '</button>') +
      '</div>';
    }).join('');

    $all('[data-doc-upload]', $('#coDocuments')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentDocKey = btn.getAttribute('data-doc-upload');
        $('#coDocInput').click();
      });
    });

    $all('[data-doc-open]', $('#coDocuments')).forEach(function (card) {
      function open() { openDocModal(card.getAttribute('data-doc-open')); }
      card.addEventListener('click', open);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });
  }

  function openDocModal(key) {
    var docs = Store.getDocuments();
    var doc = docs[key];
    if (!doc || doc.status === 'missing') return;

    currentDocKey = key;
    var def = null;
    Store.DOC_TYPES.forEach(function (d) { if (d.key === key) def = d; });
    var meta = DS[doc.status] || DS.missing;

    $('#coDocTitle').textContent = def ? def.label : 'معاينة المستند';

    var preview;
    if (/^data:image\//.test(doc.dataUrl)) {
      preview = '<img src="' + esc(doc.dataUrl) + '" alt="' + esc(doc.fileName) + '" ' +
        'style="width:100%;border-radius:12px;border:1px solid var(--line);" />';
    } else if (doc.dataUrl) {
      // ملفات PDF تُفتح في تبويب مستقل — العرض المضمّن غير موثوق عبر المتصفحات
      preview = alertHtml('info', 'هذا الملف بصيغة PDF — ' +
        '<a class="ord-link" href="' + esc(doc.dataUrl) + '" target="_blank" rel="noopener">افتحه في تبويب جديد ↗</a>');
    } else {
      preview = '<p style="font-size:0.85rem;color:var(--muted);">لا تتوفر معاينة لهذا الملف.</p>';
    }

    $('#coDocBody').innerHTML =
      '<div class="ord-info-list" style="margin-bottom:16px;">' +
        '<div class="ord-info-row"><span>اسم الملف</span><span>' + esc(doc.fileName) + '</span></div>' +
        '<div class="ord-info-row"><span>الحالة</span><span class="ord-status ' + meta.tone + '">' + meta.label + '</span></div>' +
        '<div class="ord-info-row"><span>تاريخ الرفع</span><span dir="ltr">' + prettyTime(doc.uploadedAt) + '</span></div>' +
        (doc.reason ? '<div class="ord-info-row"><span>سبب الرفض</span><span>' + esc(doc.reason) + '</span></div>' : '') +
      '</div>' + preview;

    $('#coDocOverlay').hidden = false;
  }

  function handleDocFile(file) {
    if (!file || !currentDocKey) return;

    var reader = new FileReader();
    reader.onload = function () {
      Store.uploadDocument(currentDocKey, file.name, String(reader.result));
      renderDocuments();
      renderAlerts();
      renderAudit();
      $('#coDocOverlay').hidden = true;
      toast('تم رفع المستند — سيُراجع خلال 24 ساعة عمل', 'success');
    };
    reader.readAsDataURL(file);
  }

  function initDocModal() {
    $('#coDocClose').addEventListener('click', function () { $('#coDocOverlay').hidden = true; });
    $('#coDocOverlay').addEventListener('click', function (e) {
      if (e.target === $('#coDocOverlay')) $('#coDocOverlay').hidden = true;
    });

    $('#coDocReplace').addEventListener('click', function () { $('#coDocInput').click(); });

    $('#coDocRemove').addEventListener('click', function () {
      if (!window.confirm('حذف هذا المستند؟ ستحتاج لرفعه مجدداً للتوثيق.')) return;
      Store.removeDocument(currentDocKey);
      $('#coDocOverlay').hidden = true;
      renderDocuments();
      renderAlerts();
      renderAudit();
      toast('تم حذف المستند', 'danger');
    });

    $('#coDocInput').addEventListener('change', function () {
      if (this.files && this.files[0]) handleDocFile(this.files[0]);
      this.value = '';
    });
  }

  /* ---------------- سجل التدقيق ---------------- */
  function renderAudit() {
    var list = Store.getAudit();
    var wrap = $('#coAudit');

    if (!list.length) {
      wrap.innerHTML = '<p style="font-size:0.85rem;color:var(--muted);text-align:center;padding:24px 0;">' +
        'لم تُسجَّل أي تعديلات بعد — سيظهر هنا من عدّل بيانات الشركة ومتى.</p>';
      return;
    }

    wrap.innerHTML = '<div style="overflow-x:auto;"><table class="ord-items-table">' +
      '<thead><tr><th>التاريخ والوقت</th><th>المستخدم</th><th>الإجراء</th><th>التفاصيل</th></tr></thead><tbody>' +
      list.map(function (a) {
        return '<tr>' +
          '<td dir="ltr">' + prettyTime(a.at) + '</td>' +
          '<td><strong>' + esc(a.actor) + '</strong></td>' +
          '<td>' + esc(a.action) + '</td>' +
          '<td style="color:var(--muted);">' + esc(a.detail || '—') + '</td>' +
        '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ---------------- الشعار ---------------- */
  function initLogo() {
    $('#coLogoBtn').addEventListener('click', function () { $('#coLogoInput').click(); });
    $('#coLogoInput').addEventListener('change', function () {
      if (!this.files || !this.files[0]) return;
      var reader = new FileReader();
      reader.onload = function () {
        var url = String(reader.result);
        Store.saveCompany({ logo: url });
        // يُنشر أيضاً تحت اسم العلامة ليظهر في «موردون موثوقون» بالمتجر
        var brand = Store.getCompany().nameAr;
        if (brand) Store.setSupplierLogo(brand, url);
        renderLogo(Store.getCompany());
        renderAudit();
        toast('تم تحديث شعار الشركة', 'success');
      };
      reader.readAsDataURL(this.files[0]);
      this.value = '';
    });
  }

  function initCompanyName() {
    var name = null;
    try { name = localStorage.getItem('ammar_company_name'); } catch (e) { /* ignore */ }
    if (name) $('#dashCompanyName').textContent = name;
  }

  document.addEventListener('DOMContentLoaded', function () {
    initCompanyName();
    initTabs();
    initLogo();
    initDocModal();

    $('#coSaveBtn').addEventListener('click', save);

    setTimeout(function () {
      $('#coLoading').hidden = true;
      $('#coContent').hidden = false;

      fillProfile();
      renderDocuments();
      renderAudit();
      renderAlerts();

      if (window.Validate) Validate.attachAll(document);
    }, 220);
  });
})();
