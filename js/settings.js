(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var editingBankId = '';
  var coverage = [];
  var citySearch = '';

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, kind) { if (window.Shell) Shell.toast(msg, kind); }

  /* ---------------- التبويبات الجانبية ---------------- */
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

  /* ---------------- الحساب والأمان ---------------- */
  function fillAccount() {
    var c = Store.getCompany();
    var s = Store.getSettings();

    $('#stEmail').value = c.email || '';
    $('#stPhone').value = c.phone || '';
    $('#stTwoFactor').checked = !!s.twoFactor;
    $('#stLoginAlerts').checked = s.loginAlerts !== false;
  }

  function initAccount() {
    $('#stSaveAccount').addEventListener('click', function () {
      var panel = $('.settings-panel[data-panel="account"]');
      if (window.Validate && !Validate.isValid(panel)) {
        toast('يرجى تصحيح البريد أو رقم الجوال', 'danger');
        return;
      }
      Store.saveCompany({ email: $('#stEmail').value.trim(), phone: $('#stPhone').value.trim() });
      toast('تم حفظ بيانات الحساب', 'success');
    });

    $('#pwSaveBtn').addEventListener('click', function () {
      var current = $('#pwCurrent').value;
      var next = $('#pwNew').value;
      var confirmVal = $('#pwConfirm').value;
      var err = $('#pwError');
      err.textContent = '';

      if (!current || !next) { err.textContent = 'يرجى تعبئة كلمة المرور الحالية والجديدة'; return; }
      if (next.length < 8) { err.textContent = 'يجب ألا تقل كلمة المرور عن 8 أحرف'; return; }
      if (next !== confirmVal) { err.textContent = 'كلمة المرور الجديدة غير متطابقة'; return; }

      $('#pwCurrent').value = ''; $('#pwNew').value = ''; $('#pwConfirm').value = '';
      Store.addAudit('المالك', 'تغيير كلمة المرور', '');
      toast('تم تحديث كلمة المرور بنجاح', 'success');
    });

    $('#stTwoFactor').addEventListener('change', function () {
      Store.saveSettings({ twoFactor: this.checked });
      toast(this.checked ? 'تم تفعيل التحقق بخطوتين' : 'تم إيقاف التحقق بخطوتين', this.checked ? 'success' : 'danger');
    });

    $('#stLoginAlerts').addEventListener('change', function () {
      Store.saveSettings({ loginAlerts: this.checked });
      toast('تم تحديث تنبيهات تسجيل الدخول', 'success');
    });
  }

  /* ---------------- الحسابات البنكية ---------------- */
  function maskIban(iban) {
    var s = String(iban || '');
    return s.length > 8 ? s.slice(0, 6) + ' •••• ' + s.slice(-4) : s;
  }

  function renderBanks() {
    var list = Store.getBankAccounts();
    var wrap = $('#stBanks');

    if (!list.length) {
      wrap.innerHTML = '<div class="ord-state" style="padding:36px 18px;">' +
        '<span class="ord-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></span>' +
        '<strong>لا توجد حسابات بنكية</strong>' +
        '<p>أضف حساباً بنكياً باسم المنشأة لاستلام مستحقاتك من المنصة.</p></div>';
      return;
    }

    var STATUS = {
      verified: { label: 'موثّق', tone: 'ok' },
      review: { label: 'قيد التحقق', tone: 'warn' },
      rejected: { label: 'مرفوض', tone: 'bad' }
    };

    // كل حساب بنكي قابل للنقر لعرض/تعديل تفاصيله
    wrap.innerHTML = list.map(function (b) {
      var st = STATUS[b.status] || STATUS.review;
      return '<div class="cert-card" data-bank="' + esc(b.id) + '" tabindex="0" style="cursor:pointer;margin-bottom:10px;">' +
        '<span class="cert-icon" style="background:var(--primary-50);color:var(--primary-600);">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></span>' +
        '<div class="cert-info">' +
          '<strong>' + esc(b.bank) + (b.primary ? ' <span class="wh-main-badge">رئيسي</span>' : '') + '</strong>' +
          '<small dir="ltr">' + esc(maskIban(b.iban)) + '</small>' +
        '</div>' +
        '<span class="ord-status ' + st.tone + '">' + st.label + '</span>' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;color:var(--primary-600);"><polyline points="15 18 9 12 15 6"/></svg>' +
      '</div>';
    }).join('');

    $all('[data-bank]', wrap).forEach(function (card) {
      function open() { openBankModal(card.getAttribute('data-bank')); }
      card.addEventListener('click', open);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });
  }

  function openBankModal(id) {
    editingBankId = id || '';
    var acc = id ? Store.getBankAccount(id) : null;

    $('#stBankTitle').textContent = acc ? 'تفاصيل الحساب البنكي' : 'إضافة حساب بنكي';
    $('#stBankName').value = acc ? acc.bank : '';
    $('#stBankHolder').value = acc ? acc.holder : '';
    $('#stBankIban').value = acc ? acc.iban : '';
    $('#stBankPrimary').checked = acc ? !!acc.primary : false;
    $('#stBankDelete').hidden = !acc;

    $('#stBankError').textContent = '';
    $('#stIbanError').textContent = '';
    $('#stBankOverlay').hidden = false;
  }

  function saveBank() {
    var bank = $('#stBankName').value;
    var holder = $('#stBankHolder').value.trim();
    var iban = $('#stBankIban').value.trim().toUpperCase().replace(/\s/g, '');

    $('#stBankError').textContent = '';
    $('#stIbanError').textContent = '';

    if (!bank) { $('#stBankError').textContent = 'يجب اختيار البنك'; return; }
    if (holder.length < 3) { toast('أدخل اسم صاحب الحساب', 'danger'); return; }
    // الآيبان السعودي: SA يتبعه 22 رقماً
    if (!/^SA\d{22}$/.test(iban)) {
      $('#stIbanError').textContent = 'رقم الآيبان يجب أن يبدأ بـ SA يتبعه 22 رقماً';
      return;
    }

    Store.saveBankAccount({
      id: editingBankId || undefined,
      bank: bank, holder: holder, iban: iban,
      primary: $('#stBankPrimary').checked
    });

    $('#stBankOverlay').hidden = true;
    renderBanks();
    toast(editingBankId ? 'تم تحديث الحساب البنكي' : 'تمت إضافة الحساب — قيد التحقق', 'success');
  }

  function initBanks() {
    $('#stAddBankBtn').addEventListener('click', function () { openBankModal(''); });
    $('#stBankClose').addEventListener('click', function () { $('#stBankOverlay').hidden = true; });
    $('#stBankCancel').addEventListener('click', function () { $('#stBankOverlay').hidden = true; });
    $('#stBankOverlay').addEventListener('click', function (e) {
      if (e.target === $('#stBankOverlay')) $('#stBankOverlay').hidden = true;
    });
    $('#stBankSave').addEventListener('click', saveBank);

    $('#stBankIban').addEventListener('input', function () {
      this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24);
    });

    $('#stBankDelete').addEventListener('click', function () {
      if (!window.confirm('حذف هذا الحساب البنكي؟')) return;
      Store.removeBankAccount(editingBankId);
      $('#stBankOverlay').hidden = true;
      renderBanks();
      toast('تم حذف الحساب البنكي', 'danger');
    });
  }

  /* ---------------- الشحن ---------------- */
  function renderCarriers() {
    var selected = Store.getSettings().carriers || [];

    $('#stCarriers').innerHTML = Store.CARRIERS.map(function (c) {
      var on = selected.indexOf(c.key) !== -1;
      return '<div class="toggle-row">' +
        '<div><strong>' + esc(c.name) + '</strong>' +
        '<small style="direction:ltr;display:block;">' + esc(c.url.replace('{n}', '…')) + '</small></div>' +
        '<label class="ob-toggle"><input type="checkbox" data-carrier="' + esc(c.key) + '"' + (on ? ' checked' : '') + ' />' +
        '<span class="ob-toggle-switch"></span></label>' +
      '</div>';
    }).join('');

    $all('[data-carrier]', $('#stCarriers')).forEach(function (box) {
      box.addEventListener('change', function () {
        var current = Store.getSettings().carriers || [];
        var key = box.getAttribute('data-carrier');
        if (box.checked) {
          if (current.indexOf(key) === -1) current.push(key);
        } else {
          current = current.filter(function (k) { return k !== key; });
        }
        Store.saveSettings({ carriers: current });
        toast('تم تحديث شركات الشحن المفضّلة', 'success');
      });
    });
  }

  function cityGroups() {
    var regions = window.SAUDI_REGIONS || [];
    return regions.map(function (r) {
      return { region: r.name, cities: r.cities.map(function (c) { return c.name; }) };
    });
  }

  function renderCoverage() {
    var list = $('#stCityList');
    var q = citySearch.trim().toLowerCase();

    var html = cityGroups().map(function (g) {
      var regionMatches = g.region.toLowerCase().indexOf(q) !== -1;
      var cities = (!q || regionMatches) ? g.cities : g.cities.filter(function (c) { return c.toLowerCase().indexOf(q) !== -1; });
      if (!cities.length) return '';

      var picked = cities.filter(function (c) { return coverage.indexOf(c) !== -1; }).length;

      return '<div class="pd-region-block">' +
        '<label class="pd-region-head">' +
          '<input type="checkbox" class="pd-check" data-region="' + esc(g.region) + '"' + (picked === cities.length ? ' checked' : '') + ' />' +
          esc(g.region) + '<span class="pd-region-count">' + picked + '/' + cities.length + '</span>' +
        '</label>' +
        '<div class="pd-city-grid">' +
          cities.map(function (c) {
            var on = coverage.indexOf(c) !== -1;
            return '<label class="pd-city-item' + (on ? ' is-checked' : '') + '">' +
              '<input type="checkbox" data-city="' + esc(c) + '"' + (on ? ' checked' : '') + ' /><span>' + esc(c) + '</span></label>';
          }).join('') +
        '</div></div>';
    }).join('');

    list.innerHTML = html || '<p class="pd-city-empty">لا توجد نتائج مطابقة لبحثك</p>';
    $('#stCityCount').textContent = coverage.length + ' مدينة';

    $all('[data-region]', list).forEach(function (box) {
      var group = null;
      cityGroups().forEach(function (g) { if (g.region === box.getAttribute('data-region')) group = g; });
      if (!group) return;
      var picked = group.cities.filter(function (c) { return coverage.indexOf(c) !== -1; }).length;
      box.indeterminate = picked > 0 && picked < group.cities.length;

      box.addEventListener('change', function () {
        if (box.checked) {
          group.cities.forEach(function (c) { if (coverage.indexOf(c) === -1) coverage.push(c); });
        } else {
          coverage = coverage.filter(function (c) { return group.cities.indexOf(c) === -1; });
        }
        renderCoverage();
      });
    });

    $all('[data-city]', list).forEach(function (box) {
      box.addEventListener('change', function () {
        var city = box.getAttribute('data-city');
        if (box.checked) {
          if (coverage.indexOf(city) === -1) coverage.push(city);
        } else {
          coverage = coverage.filter(function (c) { return c !== city; });
        }
        renderCoverage();
      });
    });
  }

  function initShipping() {
    $('#stCitySearch').addEventListener('input', function () { citySearch = this.value; renderCoverage(); });

    $('#stCityAll').addEventListener('click', function () {
      coverage = [];
      cityGroups().forEach(function (g) { g.cities.forEach(function (c) { coverage.push(c); }); });
      renderCoverage();
    });
    $('#stCityNone').addEventListener('click', function () { coverage = []; renderCoverage(); });

    $('#stSaveShipping').addEventListener('click', function () {
      Store.saveSettings({ coverageCities: coverage.slice() });
      toast('تم حفظ مناطق التغطية (' + coverage.length + ' مدينة)', 'success');
    });
  }

  /* ---------------- التفضيلات ---------------- */
  function syncThemeButtons() {
    if (!window.Shell) return;
    var theme = Shell.getTheme();
    $('#themeLightBtn').style.outline = theme === 'light' ? '2px solid var(--primary-600)' : 'none';
    $('#themeDarkBtn').style.outline = theme === 'dark' ? '2px solid var(--primary-600)' : 'none';
  }

  function initPreferences() {
    var s = Store.getSettings();
    $('#stLanguage').value = s.language || 'ar';
    $('#stCurrency').value = s.currency || 'SAR';

    $('#stLanguage').addEventListener('change', function () {
      Store.saveSettings({ language: this.value });
      // الترجمة الكاملة للواجهة تحتاج ملفات لغة — الاختيار محفوظ فقط حالياً
      toast(this.value === 'ar'
        ? 'تم حفظ اللغة: العربية'
        : 'تم حفظ التفضيل — ترجمة الواجهة للإنجليزية ستتوفر عند الإطلاق', 'success');
    });

    $('#stCurrency').addEventListener('change', function () {
      Store.saveSettings({ currency: this.value });
      toast('تم حفظ العملة المعروضة', 'success');
    });

    if (window.Shell) {
      $('#themeLightBtn').addEventListener('click', function () {
        Shell.setTheme('light'); syncThemeButtons(); toast('تم تفعيل الوضع الفاتح');
      });
      $('#themeDarkBtn').addEventListener('click', function () {
        Shell.setTheme('dark'); syncThemeButtons(); toast('تم تفعيل الوضع الداكن');
      });
      syncThemeButtons();
    }
  }

  /* ---------------- منطقة الخطر ---------------- */
  function initDanger() {
    $('#stDeactivateBtn').addEventListener('click', function () {
      if (!window.confirm('تعطيل حساب المورد مؤقتاً؟ سيُخفى متجرك عن المشترين وتتوقف الطلبات الجديدة.')) return;
      Store.addAudit('المالك', 'تعطيل الحساب مؤقتاً', '');
      toast('تم تعطيل الحساب مؤقتاً — يمكنك إعادة تفعيله في أي وقت', 'danger');
    });

    // تأكيد مزدوج: نافذة تأكيد ثم كتابة كلمة صريحة، لمنع الحذف بالخطأ
    $('#stDeleteBtn').addEventListener('click', function () {
      if (!window.confirm('تحذير: سيتم حذف حسابك وكل بياناتك نهائياً. هل تريد المتابعة؟')) return;

      var typed = window.prompt('لتأكيد الحذف النهائي، اكتب كلمة: حذف');
      if (typed === null) return;
      if (typed.trim() !== 'حذف') {
        toast('لم تُكتب كلمة التأكيد بشكل صحيح — أُلغي الحذف', 'danger');
        return;
      }

      Store.clearAll();
      try {
        ['ammar_supplier_onboarded', 'ammar_supplier_profile_verified', 'ammar_onboarding_data',
          'ammar_profile_progress', 'ammar_company_name', 'ammar_company_profile',
          'ammar_company_documents', 'ammar_audit_log', 'ammar_users', 'ammar_custom_roles',
          'ammar_user_activity', 'ammar_settings', 'ammar_bank_accounts']
          .forEach(function (k) { localStorage.removeItem(k); });
      } catch (e) { /* ignore */ }

      toast('تم حذف الحساب — سيتم تسجيل خروجك الآن', 'danger');
      setTimeout(function () { window.location.href = 'login.html'; }, 1200);
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
    initAccount();
    initBanks();
    initShipping();
    initPreferences();
    initDanger();

    coverage = (Store.getSettings().coverageCities || []).slice();

    fillAccount();
    renderBanks();
    renderCarriers();
    renderCoverage();

    if (window.Validate) Validate.attachAll(document);
    Store.subscribe(renderBanks);
  });
})();
