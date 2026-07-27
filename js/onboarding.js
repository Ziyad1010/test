(function () {
  'use strict';

  var STORAGE_KEY = 'ammar_onboarding_data';
  var FLAG_KEY = 'ammar_supplier_onboarded';
  var VERIFIED_KEY = 'ammar_supplier_profile_verified';
  var PROGRESS_KEY = 'ammar_profile_progress';

  function getProgress() {
    var raw;
    try { raw = localStorage.getItem(PROGRESS_KEY); } catch (e) { raw = null; }
    var defaults = { cr: false, location: false, warehouse: false };
    if (!raw) return defaults;
    try { return Object.assign(defaults, JSON.parse(raw)); } catch (e) { return defaults; }
  }

  function setProgress(patch) {
    var current = getProgress();
    Object.assign(current, patch);
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(current)); } catch (e) { /* ignore */ }
  }

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var val = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };

  var state = {
    currentStep: 1,
    warehouses: [],
    location: { lat: null, lng: null },
    crFile: null,
    savedAddress: { region: '', city: '', district: '' }
  };

  var STEPS = [
    {
      num: 1,
      title: 'معلومات الشركة',
      sub: 'البيانات الأساسية',
      percent: 20,
      why: 'نحتاج إلى هذه البيانات الأساسية للتحقق من هوية شركتك كمورّد موثوق، وحماية حقوق منشأتك وحقوق عملائك على المنصة.',
      tips: [
        'تأكد من مطابقة جميع البيانات للسجل التجاري رسمياً',
        'استخدم بريداً إلكترونياً رسمياً تابعاً لنطاق الشركة',
        'رقم الجوال الأساسي يُستخدم لاستقبال إشعارات الطلبات المهمة'
      ],
      requirements: [
        { label: 'اسم الشركة كما في السجل التجاري', check: function () { return !!val('companyName'); } },
        { label: 'رقم السجل التجاري وتواريخه', check: function () { return !!val('crNumber') && !!val('crIssue') && !!val('crExpiry'); } },
        { label: 'وسائل التواصل الأساسية', check: function () { return !!val('mainMobile') && !!val('officialEmail'); } },
        { label: 'العنوان الرئيسي للشركة', check: function () {
          return !!val('region') && !!val('city') && !!districtValue() && !!val('buildingNo') &&
            !!val('postalCode') && !!val('street') && !!val('detailedAddress');
        } }
      ]
    },
    {
      num: 2,
      title: 'السجل التجاري',
      sub: 'رفع وتحقق السجل',
      percent: 40,
      why: 'رفع نسخة من السجل التجاري يسمح لفريق عمّار بالتحقق الآلي من بيانات شركتك وتفعيل حسابك بسرعة أكبر.',
      tips: [
        'ارفع صورة أو ملف PDF واضح وغير مقتصّ',
        'تأكد أن السجل ساري المفعول وغير منتهٍ',
        'مراجعة السجل تستغرق عادة أقل من 24 ساعة عمل'
      ],
      requirements: [
        { label: 'رفع ملف السجل التجاري', check: function () { return !!state.crFile; } },
        { label: 'التحقق من البيانات المستخرجة', check: function () { return !!state.crFile; } }
      ]
    },
    {
      num: 3,
      title: 'الموقع',
      sub: 'تحديد موقع الشركة',
      percent: 60,
      why: 'تحديد الموقع الجغرافي الدقيق يساعد المشترين والشركاء على إيجاد مقر شركتك، ويُستخدم في حساب تكاليف وأوقات التوصيل.',
      tips: [
        'استخدم زر "الموقع الحالي" إن كنت داخل مقر الشركة الآن',
        'تأكد أن الدبوس يشير لمدخل المبنى الرئيسي',
        'يمكن تعديل الموقع لاحقاً من إعدادات الشركة'
      ],
      requirements: [
        { label: 'تحديد الإحداثيات الجغرافية', check: function () { return state.location.lat !== null; } }
      ]
    },
    {
      num: 4,
      title: 'المستودعات',
      sub: 'إضافة مستودعات (اختياري)',
      percent: 80,
      why: 'إضافة مستودعاتك الآن تساعدنا على ربط منتجاتك بالمخزون الصحيح وحساب أوقات التوصيل بدقة — هذه الخطوة اختيارية بالكامل.',
      tips: [
        'يمكنك تخطي هذه الخطوة وإضافة المستودعات لاحقاً',
        'حدد مستودعاً رئيسياً واحداً فقط لكل شركة',
        'أضف عدداً غير محدود من المستودعات الفرعية'
      ],
      requirements: [
        { label: 'هذه الخطوة اختيارية — يمكن تخطيها', check: function () { return true; } }
      ]
    },
    {
      num: 5,
      title: 'مراجعة البيانات',
      sub: 'مراجعة نهائية',
      percent: 100,
      why: 'راجع جميع بياناتك قبل الإرسال. بعد الإرسال سيقوم فريق عمّار بالتحقق من السجل التجاري واعتماد حسابك.',
      tips: [
        'تأكد من صحة جميع البيانات قبل الإرسال',
        'يمكنك الرجوع لأي خطوة سابقة للتعديل',
        'ستصلك رسالة على بريدك الرسمي فور اعتماد الحساب'
      ],
      requirements: [
        { label: 'تأكيد صحة البيانات المدخلة', check: function () { return $('#obConfirmCheck') ? $('#obConfirmCheck').checked : false; } }
      ]
    }
  ];

  /* ---------------- Persistence ---------------- */
  function fieldIds() {
    return ['companyType', 'companyNameEn', 'companyName', 'crExpiry', 'crIssue', 'crNumber',
      'landline', 'altMobile', 'mainMobile', 'fax', 'altEmail', 'officialEmail',
      'region', 'city', 'district', 'districtOther', 'buildingNo', 'postalCode',
      'poBox', 'detailedAddress', 'street'];
  }

  // The address selects are rebuilt from js/saudi-regions.js and only make
  // sense in region → city → district order, so they are restored by the
  // cascade rather than by the generic field loop.
  var ADDRESS_IDS = ['region', 'city', 'district', 'districtOther'];

  function saveState() {
    var data = { fields: {}, warehouses: state.warehouses, location: state.location, currentStep: state.currentStep };
    fieldIds().forEach(function (id) {
      var el = document.getElementById(id);
      if (el) data.fields[id] = el.value;
    });
    // Persist the district the user actually settled on, whether it came from
    // the curated list or the free-text fallback.
    data.fields.district = districtValue();
    delete data.fields.districtOther;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }

  function loadState() {
    var raw;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
    if (!raw) return;
    try {
      var data = JSON.parse(raw);
      var fields = data.fields || {};
      Object.keys(fields).forEach(function (id) {
        if (ADDRESS_IDS.indexOf(id) !== -1) return;
        var el = document.getElementById(id);
        if (el && fields[id]) el.value = fields[id];
      });
      state.savedAddress = {
        region: fields.region || '',
        city: fields.city || '',
        district: fields.district || ''
      };
      if (data.warehouses && data.warehouses.length) state.warehouses = data.warehouses;
      if (data.location) state.location = data.location;
      if (data.currentStep && data.currentStep >= 1 && data.currentStep <= 5) state.currentStep = data.currentStep;
    } catch (e) { /* ignore */ }
  }

  /* ---------------- Address cascade: region → city → district ---------------- */
  var OTHER_DISTRICT = 'أخرى (حي غير مدرج)';

  function regionsData() { return window.SAUDI_REGIONS || []; }

  function findRegion(name) {
    var found = null;
    regionsData().forEach(function (r) { if (r.name === name) found = r; });
    return found;
  }

  function findCity(regionName, cityName) {
    var region = findRegion(regionName);
    if (!region) return null;
    var found = null;
    region.cities.forEach(function (c) { if (c.name === cityName) found = c; });
    return found;
  }

  function fillOptions(sel, items, placeholder) {
    sel.innerHTML = '';
    var ph = document.createElement('option');
    ph.value = '';
    ph.textContent = placeholder;
    sel.appendChild(ph);
    items.forEach(function (name) {
      var opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
  }

  function useDistrictSelect() {
    $('#district').hidden = false;
    $('#district').required = true;
    $('#districtOther').hidden = true;
    $('#districtOther').required = false;
  }

  function useDistrictFreeText() {
    $('#district').hidden = true;
    $('#district').required = false;
    $('#districtOther').hidden = false;
    $('#districtOther').required = true;
  }

  // Single source of truth for "which district did the user pick", regardless
  // of whether it came from the dropdown or the manual fallback input.
  function districtValue() {
    var other = document.getElementById('districtOther');
    if (other && !other.hidden) return other.value.trim();
    var sel = document.getElementById('district');
    if (!sel || sel.value === OTHER_DISTRICT) return '';
    return sel.value.trim();
  }

  function fillCities(regionName, keepCity) {
    var citySel = $('#city');
    var region = findRegion(regionName);
    if (!region) {
      fillOptions(citySel, [], 'اختر المنطقة أولاً');
      citySel.disabled = true;
      return;
    }
    fillOptions(citySel, region.cities.map(function (c) { return c.name; }), 'اختر المدينة');
    citySel.disabled = false;
    if (keepCity) citySel.value = keepCity;
  }

  function fillDistricts(regionName, cityName, keepDistrict) {
    var distSel = $('#district');
    var other = $('#districtOther');
    var city = findCity(regionName, cityName);

    if (!city) {
      fillOptions(distSel, [], 'اختر المدينة أولاً');
      distSel.disabled = true;
      useDistrictSelect();
      other.value = '';
      return;
    }

    if (!city.districts.length) {
      // No verified district list exists for this city, so accept free text
      // rather than offering invented names — see js/saudi-regions.js header.
      fillOptions(distSel, [], 'غير متاح لهذه المدينة');
      distSel.disabled = true;
      useDistrictFreeText();
      other.value = keepDistrict || '';
      return;
    }

    fillOptions(distSel, city.districts.concat([OTHER_DISTRICT]), 'اختر الحي');
    distSel.disabled = false;
    useDistrictSelect();
    other.value = '';

    if (keepDistrict) {
      distSel.value = keepDistrict;
      if (distSel.value !== keepDistrict) {
        // Saved district isn't in this city's list — it was typed manually.
        distSel.value = OTHER_DISTRICT;
        other.hidden = false;
        other.required = true;
        other.value = keepDistrict;
      }
    }
  }

  function initAddressCascade(saved) {
    var regionSel = $('#region');
    fillOptions(regionSel, regionsData().map(function (r) { return r.name; }), 'اختر المنطقة');

    regionSel.addEventListener('change', function () {
      fillCities(regionSel.value, '');
      fillDistricts(regionSel.value, '', '');
    });

    $('#city').addEventListener('change', function () {
      fillDistricts(regionSel.value, $('#city').value, '');
    });

    $('#district').addEventListener('change', function () {
      var other = $('#districtOther');
      if ($('#district').value === OTHER_DISTRICT) {
        other.hidden = false;
        other.required = true;
        other.value = '';
        other.focus();
      } else {
        other.hidden = true;
        other.required = false;
        other.value = '';
      }
    });

    if (saved && saved.region) {
      regionSel.value = saved.region;
      fillCities(saved.region, saved.city);
      fillDistricts(saved.region, saved.city, saved.district);
    }
  }

  /* ---------------- Stepper / Progress ---------------- */
  function renderStepper() {
    var wrap = $('#obStepper');
    wrap.innerHTML = '';
    STEPS.forEach(function (s) {
      var isDone = s.num < state.currentStep;
      var isCurrent = s.num === state.currentStep;
      var el = document.createElement('div');
      el.className = 'ob-step' + (isDone ? ' is-done' : '') + (isCurrent ? ' is-current' : '');
      el.innerHTML =
        '<div class="ob-step-circle">' + (isDone
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
          : s.num) + '</div>' +
        '<div class="ob-step-label">' + s.title + '</div>' +
        '<div class="ob-step-sub">' + s.sub + '</div>';
      wrap.appendChild(el);
    });
  }

  function updateProgress() {
    var step = STEPS[Math.min(state.currentStep, 5) - 1];
    var percent = state.currentStep > 5 ? 100 : step.percent;
    $('#ringPercent').textContent = percent + '%';
    $('#obSummaryPercent').textContent = percent + '%';
    $('#obSummaryFill').style.width = percent + '%';

    var circumference = 2 * Math.PI * 42;
    var offset = circumference - (percent / 100) * circumference;
    $('#ringFill').style.strokeDashoffset = offset;
    $('#ringFill').style.stroke = percent >= 100 ? 'var(--success)' : 'var(--primary-600)';
  }

  function renderInfoColumn() {
    var step = STEPS[Math.min(state.currentStep, 5) - 1];

    $('#obWhyText').textContent = step.why;

    var tipsList = $('#obTipsList');
    tipsList.innerHTML = step.tips.map(function (t) { return '<li>' + t + '</li>'; }).join('');

    renderChecklist(step);

    var summarySteps = $('#obSummarySteps');
    summarySteps.innerHTML = STEPS.map(function (s) {
      var isDone = s.num < state.currentStep;
      var isCurrent = s.num === state.currentStep;
      var statusText = isCurrent ? 'جاري الآن' : (isDone ? 'مكتمل' : 'قيد الانتظار');
      return '<li class="ob-summary-step' + (isDone ? ' is-done' : '') + (isCurrent ? ' is-current' : '') + '">' +
        '<span class="ob-summary-step-num">' + s.num + '</span>' +
        '<span class="ob-summary-step-name">' + s.title + '</span>' +
        '<span class="ob-summary-step-status">' + statusText + '</span></li>';
    }).join('');
  }

  function renderChecklist(step) {
    var list = $('#obChecklist');
    list.innerHTML = step.requirements.map(function (r) {
      var done = r.check();
      return '<li class="ob-checklist-item' + (done ? ' is-done' : '') + '">' +
        '<span class="ob-checklist-dot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>' +
        '<span>' + r.label + '</span></li>';
    }).join('');
  }

  function refreshChecklistOnly() {
    var step = STEPS[Math.min(state.currentStep, 5) - 1];
    renderChecklist(step);
  }

  /* ---------------- Step navigation ---------------- */
  function showStep(n) {
    $all('.ob-step-panel').forEach(function (p) { p.hidden = true; });
    var key = n > 5 ? 'done' : String(n);
    var panel = $('.ob-step-panel[data-step="' + key + '"]');
    if (panel) panel.hidden = false;

    if (n <= 5) {
      renderStepper();
      updateProgress();
      renderInfoColumn();
    }

    if (n === 2) fillRecap();
    if (n === 3) fillLocationFields();
    if (n === 5) renderReview();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goTo(n) {
    state.currentStep = n;
    saveState();
    showStep(n);
  }

  function validateStep1() {
    var required = ['companyName', 'crExpiry', 'crIssue', 'crNumber', 'mainMobile', 'officialEmail',
      'region', 'city', 'buildingNo', 'postalCode', 'detailedAddress', 'street'];

    var filled = required.every(function (id) { return !!val(id); }) && !!districtValue();

    // بالإضافة لوجود القيمة، يجب أن تجتاز قواعد الصيغة (جوال، بريد، سجل تجاري…)
    var panel = $('.ob-step-panel[data-step="1"]');
    var formatOk = window.Validate ? Validate.isValid(panel) : true;

    return filled && formatOk;
  }

  /* ---------------- Step 2: CR Upload ---------------- */
  function fillRecap() {
    $('#recapCr').textContent = val('crNumber') || '—';
    $('#recapIssue').textContent = val('crIssue') || '—';
    $('#recapExpiry').textContent = val('crExpiry') || '—';
  }

  function handleFile(file) {
    if (!file) return;
    state.crFile = { name: file.name, size: file.size };

    $('#obFileName').textContent = file.name;
    $('#obFileSize').textContent = (file.size / 1024).toFixed(0) + ' كيلوبايت';
    $('#obFilePreview').hidden = false;

    var statusTag = $('#obVerifyStatus');
    statusTag.textContent = 'قيد المراجعة';
    statusTag.className = 'ob-status-tag review';

    // Simulated OCR extraction from the data already entered in Step 1
    $('#ocrName').textContent = val('companyName') || '—';
    $('#ocrNumber').textContent = val('crNumber') || '—';
    $('#ocrIssue').textContent = val('crIssue') || '—';
    $('#ocrExpiry').textContent = val('crExpiry') || '—';

    var nextBtn = $('.ob-step-panel[data-step="2"] [data-next]');
    nextBtn.disabled = false;
    setProgress({ cr: true });
    refreshChecklistOnly();
  }

  function removeFile() {
    state.crFile = null;
    $('#obFilePreview').hidden = true;
    var statusTag = $('#obVerifyStatus');
    statusTag.textContent = 'لم يتم الرفع بعد';
    statusTag.className = 'ob-status-tag pending';
    $('.ob-step-panel[data-step="2"] [data-next]').disabled = true;
    $('#crFileInput').value = '';
    setProgress({ cr: false });
    refreshChecklistOnly();
  }

  function initDropzone() {
    var zone = $('#obDropzone');
    var input = $('#crFileInput');

    zone.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () { handleFile(input.files[0]); });

    ['dragenter', 'dragover'].forEach(function (evt) {
      zone.addEventListener(evt, function (e) {
        e.preventDefault();
        zone.classList.add('is-dragover');
      });
    });
    ['dragleave', 'drop'].forEach(function (evt) {
      zone.addEventListener(evt, function (e) {
        e.preventDefault();
        zone.classList.remove('is-dragover');
      });
    });
    zone.addEventListener('drop', function (e) {
      var file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    });

    $('#obFileRemove').addEventListener('click', function (e) {
      e.stopPropagation();
      removeFile();
    });
  }

  /* ---------------- Step 3: Location ---------------- */
  function fillLocationFields() {
    $('#locDistrict').value = districtValue();
    $('#locCity').value = val('city');
    $('#locAddress').value = val('detailedAddress');
  }

  function initLocation() {
    $('#obUseLocation').addEventListener('click', function () {
      var coordsEl = $('#obCoords');
      if (!navigator.geolocation) {
        coordsEl.textContent = 'المتصفح لا يدعم تحديد الموقع';
        return;
      }
      coordsEl.textContent = 'جارِ تحديد الموقع…';
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          state.location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          coordsEl.textContent = 'الإحداثيات: ' + state.location.lat.toFixed(5) + ', ' + state.location.lng.toFixed(5);
          saveState();
          setProgress({ location: true });
          refreshChecklistOnly();
        },
        function () {
          coordsEl.textContent = 'تعذّر الوصول إلى الموقع — يمكنك المتابعة وتحديده لاحقاً';
          state.location = { lat: 24.7136, lng: 46.6753 };
          setProgress({ location: true });
          refreshChecklistOnly();
        }
      );
    });
  }

  /* ---------------- Step 4: Warehouses ---------------- */
  function newWarehouse() {
    return {
      id: 'wh' + Date.now() + Math.floor(Math.random() * 1000),
      name: '', type: 'main', isMain: state.warehouses.length === 0,
      capacity: '', hoursFrom: '08:00', hoursTo: '17:00', contact: '', phone: '', address: ''
    };
  }

  function renderWarehouses() {
    var list = $('#obWarehouseList');
    if (!state.warehouses.length) state.warehouses.push(newWarehouse());

    list.innerHTML = state.warehouses.map(function (w, i) {
      return '<div class="ob-warehouse-card" data-id="' + w.id + '">' +
        '<div class="ob-warehouse-card-head">' +
          '<strong>مستودع ' + (i + 1) + '</strong>' +
          '<div style="display:flex;align-items:center;gap:14px;">' +
            '<label class="ob-toggle">' +
              '<input type="checkbox" class="wh-main" ' + (w.isMain ? 'checked' : '') + ' />' +
              '<span class="ob-toggle-switch"></span> مستودع رئيسي' +
            '</label>' +
            (state.warehouses.length > 1 ? '<button type="button" class="ob-warehouse-remove" aria-label="حذف"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' : '') +
          '</div>' +
        '</div>' +
        '<div class="ob-field-row cols-3">' +
          '<div class="ob-field"><label>اسم المستودع</label><input type="text" class="wh-name" placeholder="مستودع الرياض الرئيسي" value="' + w.name + '"/></div>' +
          '<div class="ob-field"><label>نوع المستودع</label><select class="wh-type">' +
            '<option value="main"' + (w.type === 'main' ? ' selected' : '') + '>مستودع رئيسي</option>' +
            '<option value="sub"' + (w.type === 'sub' ? ' selected' : '') + '>مستودع فرعي</option>' +
            '<option value="temp"' + (w.type === 'temp' ? ' selected' : '') + '>تخزين مؤقت</option>' +
          '</select></div>' +
          '<div class="ob-field"><label>السعة التخزينية (م²)</label><input type="text" class="wh-capacity" placeholder="1200" value="' + w.capacity + '"/></div>' +
        '</div>' +
        '<div class="ob-field-row cols-3">' +
          '<div class="ob-field"><label>مسؤول التواصل</label><input type="text" class="wh-contact" placeholder="اسم المسؤول" value="' + w.contact + '"/></div>' +
          '<div class="ob-field"><label>هاتف المستودع</label><input type="tel" class="wh-phone" placeholder="011 234 5678" value="' + w.phone + '"/></div>' +
          '<div class="ob-field"><label>ساعات العمل</label>' +
            '<div style="display:flex;gap:6px;align-items:center;">' +
              '<input type="time" class="wh-from" value="' + w.hoursFrom + '"/><span style="color:var(--muted);">إلى</span><input type="time" class="wh-to" value="' + w.hoursTo + '"/>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="ob-field-row cols-3">' +
          '<div class="ob-field span-2"><label>عنوان المستودع</label><input type="text" class="wh-address" placeholder="المدينة الصناعية الثانية، الرياض" value="' + w.address + '"/></div>' +
        '</div>' +
      '</div>';
    }).join('');

    bindWarehouseEvents();
  }

  function bindWarehouseEvents() {
    $all('.ob-warehouse-card').forEach(function (card) {
      var id = card.getAttribute('data-id');
      var w = state.warehouses.find(function (x) { return x.id === id; });
      if (!w) return;

      var map = { '.wh-name': 'name', '.wh-capacity': 'capacity', '.wh-contact': 'contact', '.wh-phone': 'phone', '.wh-address': 'address', '.wh-from': 'hoursFrom', '.wh-to': 'hoursTo' };
      Object.keys(map).forEach(function (sel) {
        var input = $(sel, card);
        if (input) input.addEventListener('input', function () {
          w[map[sel]] = input.value;
          saveState();
          if (sel === '.wh-name') {
            setProgress({ warehouse: state.warehouses.some(function (x) { return x.name.trim(); }) });
            refreshChecklistOnly();
          }
        });
      });

      var typeSel = $('.wh-type', card);
      if (typeSel) typeSel.addEventListener('change', function () { w.type = typeSel.value; saveState(); });

      var mainCheck = $('.wh-main', card);
      if (mainCheck) mainCheck.addEventListener('change', function () {
        state.warehouses.forEach(function (x) { x.isMain = false; });
        w.isMain = mainCheck.checked;
        if (w.isMain) state.warehouses.forEach(function (x) { if (x !== w) x.isMain = false; });
        saveState();
        renderWarehouses();
      });

      var removeBtn = $('.ob-warehouse-remove', card);
      if (removeBtn) removeBtn.addEventListener('click', function () {
        state.warehouses = state.warehouses.filter(function (x) { return x.id !== id; });
        saveState();
        renderWarehouses();
      });
    });
  }

  function initWarehouses() {
    renderWarehouses();
    $('#obAddWarehouse').addEventListener('click', function () {
      state.warehouses.push(newWarehouse());
      saveState();
      renderWarehouses();
    });
  }

  /* ---------------- Step 5: Review ---------------- */
  function row(label, value) {
    return '<dt>' + label + '</dt><dd>' + (value || '—') + '</dd>';
  }

  function renderReview() {
    var grid = $('#obReviewGrid');
    var companyTypeLabel = $('#companyType') ? $('#companyType').selectedOptions[0].text : '—';

    var cards = [];

    cards.push(
      '<div class="ob-review-card"><div class="ob-review-card-head"><strong>معلومات الشركة</strong><span class="ob-review-edit" data-jump="1">تعديل</span></div><dl>' +
      row('اسم الشركة', val('companyName')) +
      row('نوع الشركة', companyTypeLabel) +
      row('رقم السجل التجاري', val('crNumber')) +
      row('تاريخ الانتهاء', val('crExpiry')) +
      '</dl></div>'
    );

    cards.push(
      '<div class="ob-review-card"><div class="ob-review-card-head"><strong>التواصل والعنوان</strong><span class="ob-review-edit" data-jump="1">تعديل</span></div><dl>' +
      row('الجوال الأساسي', val('mainMobile')) +
      row('البريد الرسمي', val('officialEmail')) +
      row('المنطقة', val('region')) +
      row('المدينة / الحي', (val('city') || '—') + ' / ' + (districtValue() || '—')) +
      row('العنوان التفصيلي', val('detailedAddress')) +
      '</dl></div>'
    );

    cards.push(
      '<div class="ob-review-card"><div class="ob-review-card-head"><strong>السجل التجاري</strong><span class="ob-review-edit" data-jump="2">تعديل</span></div><dl>' +
      row('الملف المرفوع', state.crFile ? state.crFile.name : 'لم يتم الرفع') +
      row('حالة التحقق', state.crFile ? 'قيد المراجعة' : '—') +
      '</dl></div>'
    );

    cards.push(
      '<div class="ob-review-card"><div class="ob-review-card-head"><strong>الموقع والمستودعات</strong><span class="ob-review-edit" data-jump="3">تعديل</span></div><dl>' +
      row('الإحداثيات', state.location.lat ? state.location.lat.toFixed(4) + ', ' + state.location.lng.toFixed(4) : 'غير محددة') +
      row('عدد المستودعات', String(state.warehouses.filter(function (w) { return w.name; }).length || 0)) +
      '</dl></div>'
    );

    grid.innerHTML = cards.join('');

    $all('.ob-review-edit').forEach(function (el) {
      el.addEventListener('click', function () { goTo(parseInt(el.getAttribute('data-jump'), 10)); });
    });

    updateSubmitState();
  }

  function updateSubmitState() {
    var check = $('#obConfirmCheck');
    $('#obSubmitBtn').disabled = !(check && check.checked);
  }

  /* ---------------- Wire up ---------------- */
  function finishStep1AndEnterDashboard() {
    saveState();
    try {
      localStorage.setItem(FLAG_KEY, 'true');
      var name = val('companyName');
      if (name) localStorage.setItem('ammar_company_name', name);
    } catch (e) { /* ignore */ }
    window.location.href = 'dashboard.html';
  }

  function initStepButtons() {
    $all('[data-next]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.currentStep === 1) {
          if (!validateStep1()) { refreshChecklistOnly(); return; }
          finishStep1AndEnterDashboard();
          return;
        }
        goTo(state.currentStep + 1);
      });
    });
    $all('[data-back]').forEach(function (btn) {
      btn.addEventListener('click', function () { goTo(state.currentStep - 1); });
    });
    $all('[data-skip]').forEach(function (btn) {
      btn.addEventListener('click', function () { goTo(state.currentStep + 1); });
    });
  }

  function initStep1LiveValidation() {
    fieldIds().forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', function () { saveState(); refreshChecklistOnly(); });
      if (el) el.addEventListener('change', function () { saveState(); refreshChecklistOnly(); });
    });
  }

  function initSubmit() {
    $('#obConfirmCheck').addEventListener('change', updateSubmitState);
    $('#obSubmitBtn').addEventListener('click', function () {
      try {
        localStorage.setItem(FLAG_KEY, 'true');
        localStorage.setItem(VERIFIED_KEY, 'true');
        var name = val('companyName');
        if (name) localStorage.setItem('ammar_company_name', name);
      } catch (e) { /* ignore */ }
      goTo(6);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadState();

    var params = new URLSearchParams(window.location.search);
    var requestedStep = parseInt(params.get('step'), 10);
    var alreadyUnlocked = false;
    try { alreadyUnlocked = localStorage.getItem(FLAG_KEY) === 'true'; } catch (e) { /* ignore */ }

    if (requestedStep >= 2 && requestedStep <= 5 && alreadyUnlocked) {
      state.currentStep = requestedStep;
    } else if (!requestedStep && alreadyUnlocked) {
      // Step 1 is already done — nothing to do here, send them back in.
      window.location.replace('dashboard.html');
      return;
    } else {
      state.currentStep = 1;
    }

    // Must run before the live-validation wiring so the cascade's own change
    // handlers repopulate the dependent selects before state is re-saved.
    initAddressCascade(state.savedAddress);

    // loadState() wrote the saved YYYY-MM-DD values straight into the hidden
    // date inputs; refill the visible يوم/شهر/سنة boxes from them.
    if (window.DateField) DateField.refresh();

    // التحقق الفوري من صيغة الحقول (يقرأ data-validate من الـ HTML)
    if (window.Validate) Validate.attachAll(document);

    initDropzone();
    initLocation();
    initWarehouses();
    initStepButtons();
    initStep1LiveValidation();
    initSubmit();

    var savedName = null;
    try { savedName = localStorage.getItem('ammar_user_name'); } catch (e) { /* ignore */ }
    if (savedName) $('#obUserName').textContent = savedName;

    showStep(state.currentStep);
  });
})();
