(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var STATUS_LABELS = { active: 'نشط', scheduled: 'مجدول', ended: 'منتهي' };
  var DEFAULT_CITIES = ['الرياض', 'جدة'];

  var offers = [
    { id: 1, name: 'عرض نهاية الأسبوع على الحديد', discount: 15, discountType: 'percentage', start: '2026-07-18', end: '2026-07-25', cities: ['الرياض', 'جدة'], products: ['حديد تسليح سعودي 12مم', 'حديد تسليح سعودي 16مم'], status: 'active', used: 64, limit: 200, minOrder: 0 },
    { id: 2, name: 'خصم الصيف على مواد التشطيب', discount: 20, discountType: 'percentage', start: '2026-06-01', end: '2026-07-10', cities: ['الدمام', 'الخبر'], products: ['بلاط بورسلين مطفي 60×60'], status: 'ended', used: 152, limit: 150, minOrder: 500 },
    { id: 3, name: 'عرض إطلاق موسم البناء', discount: 10, discountType: 'percentage', start: '2026-08-01', end: '2026-08-31', cities: ['الرياض', 'مكة المكرمة', 'المدينة المنورة'], products: ['أسمنت بورتلاندي عادي', 'خرسانة جاهزة C30'], status: 'scheduled', used: 0, limit: 300, minOrder: 0 },
    { id: 4, name: 'خصم كميات الجملة', discount: 12, discountType: 'percentage', start: '2026-07-10', end: '2026-07-30', cities: ['الرياض'], products: ['طوب أسمنتي مصمت 20سم'], status: 'active', used: 38, limit: 100, minOrder: 1000 }
  ];

  var CATEGORY_LABELS = {
    steel: 'حديد وصلب', cement: 'أسمنت', concrete: 'خرسانة جاهزة',
    finishing: 'مواد تشطيب', blocks: 'طوب وبلوك', tools: 'أدوات ومعدات'
  };

  var nextId = 5;
  var currentFilter = '';
  var selectedCities = [];
  var citySearch = '';
  var selectedProducts = [];
  var productSearch = '';

  function fmt(n) { return Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 }); }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, kind) { if (window.Shell) Shell.toast(msg, kind); }

  function discountLabel(o) {
    return o.discountType === 'fixed' ? ('-' + fmt(o.discount) + ' ر.س') : ('-' + o.discount + '%');
  }

  /* ---------------- عرض بطاقات العروض ---------------- */
  function renderGrid() {
    var list = currentFilter ? offers.filter(function (o) { return o.status === currentFilter; }) : offers;
    $('#offEmpty').hidden = list.length > 0;

    $('#offGrid').innerHTML = list.map(function (o) {
      var pct = o.limit ? Math.min(100, Math.round((o.used / o.limit) * 100)) : 0;
      return '<div class="offer-card">' +
        '<div class="offer-card-head">' +
          '<div><div class="offer-title">' + esc(o.name) + '</div><div class="offer-dates">' + esc(o.start) + ' — ' + esc(o.end) + '</div></div>' +
          '<div class="offer-discount">' + discountLabel(o) + '</div>' +
        '</div>' +
        '<span class="pd-status-pill ' + (o.status === 'active' ? 'active' : o.status === 'ended' ? 'archived' : 'draft') + '" style="width:fit-content;">' + STATUS_LABELS[o.status] + '</span>' +
        (o.minOrder ? '<div style="font-size:0.78rem;color:var(--muted);">الحد الأدنى للطلب: ' + fmt(o.minOrder) + ' ر.س</div>' : '') +
        '<div class="offer-meta">' + o.cities.map(function (c) { return '<span class="pd-tag">' + esc(c) + '</span>'; }).join('') + '</div>' +
        '<div class="offer-meta">' + o.products.map(function (p) { return '<span class="pd-tag" style="color:var(--muted);background:var(--bg);">' + esc(p) + '</span>'; }).join('') + '</div>' +
        (o.limit
          ? '<div class="offer-progress-bar"><div class="offer-progress-fill" style="width:' + pct + '%"></div></div>' +
            '<div class="offer-stats"><span>تم استخدامه ' + o.used + ' مرة</span><span>الحد ' + o.limit + '</span></div>'
          : '<div class="offer-stats"><span>تم استخدامه ' + o.used + ' مرة</span><span>بدون حد استخدام</span></div>') +
        (o.status !== 'ended'
          ? '<button type="button" class="ob-btn-secondary" data-end="' + o.id + '" style="width:100%;">إنهاء العرض الآن</button>'
          : '') +
      '</div>';
    }).join('');

    $all('[data-end]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var offer = offers.filter(function (o) { return o.id === parseInt(btn.getAttribute('data-end'), 10); })[0];
        if (offer) {
          offer.status = 'ended';
          renderGrid();
          toast('تم إنهاء العرض "' + offer.name + '"');
        }
      });
    });
  }

  function initTabs() {
    $all('#offTabs .tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $all('#offTabs .tab-btn').forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        currentFilter = btn.getAttribute('data-status');
        renderGrid();
      });
    });
  }

  /* ---------------- منتقي المدن المنسدل (Dropdown + Checkboxes) ---------------- */
  function cityGroups() {
    var regions = window.SAUDI_REGIONS || [];
    return regions.map(function (r) {
      return { region: r.name, cities: r.cities.map(function (c) { return c.name; }) };
    });
  }

  function renderCitiesTrigger() {
    var trigger = $('#ofCitiesTrigger');
    var textEl = $('#ofCitiesTriggerText');
    trigger.classList.toggle('has-value', selectedCities.length > 0);
    textEl.textContent = selectedCities.length
      ? selectedCities.length + ' مدينة محددة'
      : 'اختر المدن المستهدفة';
  }

  function renderCitiesChips() {
    $('#ofCitiesChips').innerHTML = selectedCities.map(function (c) {
      return '<span class="ofc-chip">' + esc(c) +
        '<button type="button" class="ofc-chip-x" data-chip-remove="' + esc(c) + '" aria-label="إزالة ' + esc(c) + '">×</button></span>';
    }).join('');

    $all('[data-chip-remove]', $('#ofCitiesChips')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var city = btn.getAttribute('data-chip-remove');
        selectedCities = selectedCities.filter(function (c) { return c !== city; });
        renderCityPanel();
        renderCitiesTrigger();
        renderCitiesChips();
        updatePreview();
      });
    });
  }

  function renderCityPanel() {
    var list = $('#ofCityList');
    var q = citySearch.trim().toLowerCase();

    var html = cityGroups().map(function (g) {
      var regionMatches = g.region.toLowerCase().indexOf(q) !== -1;
      var cities = (!q || regionMatches) ? g.cities : g.cities.filter(function (c) { return c.toLowerCase().indexOf(q) !== -1; });
      if (!cities.length) return '';

      var pickedInRegion = cities.filter(function (c) { return selectedCities.indexOf(c) !== -1; }).length;

      return '<div class="pd-region-block">' +
        '<label class="pd-region-head">' +
          '<input type="checkbox" class="pd-check" data-region="' + esc(g.region) + '"' +
            (pickedInRegion === cities.length ? ' checked' : '') + ' />' +
          esc(g.region) +
          '<span class="pd-region-count">' + pickedInRegion + '/' + cities.length + '</span>' +
        '</label>' +
        '<div class="pd-city-grid">' +
          cities.map(function (c) {
            var on = selectedCities.indexOf(c) !== -1;
            return '<label class="pd-city-item' + (on ? ' is-checked' : '') + '">' +
              '<input type="checkbox" data-city="' + esc(c) + '"' + (on ? ' checked' : '') + ' />' +
              '<span>' + esc(c) + '</span>' +
            '</label>';
          }).join('') +
        '</div>' +
      '</div>';
    }).join('');

    list.innerHTML = html || '<p class="pd-city-empty">لا توجد نتائج مطابقة لبحثك</p>';

    $all('[data-region]', list).forEach(function (box) {
      var group = null;
      cityGroups().forEach(function (g) { if (g.region === box.getAttribute('data-region')) group = g; });
      if (!group) return;
      var picked = group.cities.filter(function (c) { return selectedCities.indexOf(c) !== -1; }).length;
      box.indeterminate = picked > 0 && picked < group.cities.length;

      // لا نغلق اللوحة عند أي اختيار — تبقى مفتوحة ليتمكن البائع من تحديد
      // عدة مدن أو مناطق متتالية دون إعادة فتحها في كل مرة.
      box.addEventListener('change', function () {
        if (box.checked) {
          group.cities.forEach(function (c) { if (selectedCities.indexOf(c) === -1) selectedCities.push(c); });
        } else {
          selectedCities = selectedCities.filter(function (c) { return group.cities.indexOf(c) === -1; });
        }
        renderCityPanel();
        renderCitiesTrigger();
        renderCitiesChips();
        updatePreview();
      });
    });

    $all('[data-city]', list).forEach(function (box) {
      box.addEventListener('change', function () {
        var city = box.getAttribute('data-city');
        if (box.checked) {
          if (selectedCities.indexOf(city) === -1) selectedCities.push(city);
        } else {
          selectedCities = selectedCities.filter(function (c) { return c !== city; });
        }
        renderCityPanel();
        renderCitiesTrigger();
        renderCitiesChips();
        updatePreview();
      });
    });
  }

  function openCityPanel() {
    $('#ofCitiesPanel').hidden = false;
    $('#ofCitiesTrigger').classList.add('is-open');
  }
  function closeCityPanel() {
    $('#ofCitiesPanel').hidden = true;
    $('#ofCitiesTrigger').classList.remove('is-open');
  }

  function initCityPicker() {
    $('#ofCitiesTrigger').addEventListener('click', function (e) {
      e.stopPropagation();
      if ($('#ofCitiesPanel').hidden) openCityPanel(); else closeCityPanel();
    });

    $('#ofCitySearch').addEventListener('input', function () {
      citySearch = this.value;
      renderCityPanel();
    });
    // كتابة في مربع البحث لا يجب أن تغلق اللوحة
    $('#ofCitySearch').addEventListener('click', function (e) { e.stopPropagation(); });

    $('#ofCityAll').addEventListener('click', function (e) {
      e.stopPropagation();
      selectedCities = [];
      cityGroups().forEach(function (g) { g.cities.forEach(function (c) { selectedCities.push(c); }); });
      renderCityPanel(); renderCitiesTrigger(); renderCitiesChips(); updatePreview();
    });
    $('#ofCityNone').addEventListener('click', function (e) {
      e.stopPropagation();
      selectedCities = [];
      renderCityPanel(); renderCitiesTrigger(); renderCitiesChips(); updatePreview();
    });

    $('#ofCitiesPanel').addEventListener('click', function (e) { e.stopPropagation(); });

    // إغلاق اللوحة عند الضغط خارجها فقط
    document.addEventListener('click', function () {
      if (!$('#ofCitiesPanel').hidden) closeCityPanel();
    });
  }

  /* ---------------- منتقي المنتجات المنسدل (Dropdown + Checkboxes) ---------------- */
  // يقرأ الكتالوج الفعلي من js/store.js بدل قائمة أسماء ثابتة، ويستثني
  // المسودات والمنتجات المؤرشفة لأنها غير قابلة للبيع أصلاً.
  function sellableProducts() {
    if (!window.Store) return [];
    return Store.getProducts().filter(function (p) { return p.status === 'active'; });
  }

  function productGroups() {
    var byCategory = {};
    sellableProducts().forEach(function (p) {
      var key = p.category || 'tools';
      if (!byCategory[key]) byCategory[key] = [];
      byCategory[key].push(p.name);
    });
    return Object.keys(byCategory).map(function (key) {
      return { category: key, label: CATEGORY_LABELS[key] || key, products: byCategory[key] };
    });
  }

  function renderProductsTrigger() {
    var trigger = $('#ofProductsTrigger');
    var textEl = $('#ofProductsTriggerText');
    trigger.classList.toggle('has-value', selectedProducts.length > 0);
    textEl.textContent = selectedProducts.length
      ? selectedProducts.length + ' منتج محدد'
      : 'اختر المنتجات المستهدفة';
  }

  function renderProductsChips() {
    $('#ofProductsChips').innerHTML = selectedProducts.map(function (p) {
      return '<span class="ofc-chip">' + esc(p) +
        '<button type="button" class="ofc-chip-x" data-pchip-remove="' + esc(p) + '" aria-label="إزالة ' + esc(p) + '">×</button></span>';
    }).join('');

    $all('[data-pchip-remove]', $('#ofProductsChips')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = btn.getAttribute('data-pchip-remove');
        selectedProducts = selectedProducts.filter(function (p) { return p !== name; });
        renderProductPanel();
        renderProductsTrigger();
        renderProductsChips();
        updatePreview();
      });
    });
  }

  function renderProductPanel() {
    var list = $('#ofProductList');
    var q = productSearch.trim().toLowerCase();
    var groups = productGroups();

    if (!groups.length) {
      list.innerHTML = '<p class="pd-city-empty">لا توجد منتجات نشطة في كتالوجك بعد.</p>';
      return;
    }

    var html = groups.map(function (g) {
      var categoryMatches = g.label.toLowerCase().indexOf(q) !== -1;
      var products = (!q || categoryMatches) ? g.products : g.products.filter(function (p) { return p.toLowerCase().indexOf(q) !== -1; });
      if (!products.length) return '';

      var pickedInGroup = products.filter(function (p) { return selectedProducts.indexOf(p) !== -1; }).length;

      return '<div class="pd-region-block">' +
        '<label class="pd-region-head">' +
          '<input type="checkbox" class="pd-check" data-pcategory="' + esc(g.category) + '"' +
            (pickedInGroup === products.length ? ' checked' : '') + ' />' +
          esc(g.label) +
          '<span class="pd-region-count">' + pickedInGroup + '/' + products.length + '</span>' +
        '</label>' +
        '<div class="pd-city-grid">' +
          products.map(function (p) {
            var on = selectedProducts.indexOf(p) !== -1;
            return '<label class="pd-city-item' + (on ? ' is-checked' : '') + '">' +
              '<input type="checkbox" data-product="' + esc(p) + '"' + (on ? ' checked' : '') + ' />' +
              '<span>' + esc(p) + '</span>' +
            '</label>';
          }).join('') +
        '</div>' +
      '</div>';
    }).join('');

    list.innerHTML = html || '<p class="pd-city-empty">لا توجد نتائج مطابقة لبحثك</p>';

    $all('[data-pcategory]', list).forEach(function (box) {
      var group = null;
      groups.forEach(function (g) { if (g.category === box.getAttribute('data-pcategory')) group = g; });
      if (!group) return;
      var picked = group.products.filter(function (p) { return selectedProducts.indexOf(p) !== -1; }).length;
      box.indeterminate = picked > 0 && picked < group.products.length;

      box.addEventListener('change', function () {
        if (box.checked) {
          group.products.forEach(function (p) { if (selectedProducts.indexOf(p) === -1) selectedProducts.push(p); });
        } else {
          selectedProducts = selectedProducts.filter(function (p) { return group.products.indexOf(p) === -1; });
        }
        renderProductPanel();
        renderProductsTrigger();
        renderProductsChips();
        updatePreview();
      });
    });

    $all('[data-product]', list).forEach(function (box) {
      box.addEventListener('change', function () {
        var name = box.getAttribute('data-product');
        if (box.checked) {
          if (selectedProducts.indexOf(name) === -1) selectedProducts.push(name);
        } else {
          selectedProducts = selectedProducts.filter(function (p) { return p !== name; });
        }
        renderProductPanel();
        renderProductsTrigger();
        renderProductsChips();
        updatePreview();
      });
    });
  }

  function openProductPanel() {
    $('#ofProductsPanel').hidden = false;
    $('#ofProductsTrigger').classList.add('is-open');
  }
  function closeProductPanel() {
    $('#ofProductsPanel').hidden = true;
    $('#ofProductsTrigger').classList.remove('is-open');
  }

  function initProductPicker() {
    $('#ofProductsTrigger').addEventListener('click', function (e) {
      e.stopPropagation();
      if ($('#ofProductsPanel').hidden) openProductPanel(); else closeProductPanel();
    });

    $('#ofProductSearch').addEventListener('input', function () {
      productSearch = this.value;
      renderProductPanel();
    });
    $('#ofProductSearch').addEventListener('click', function (e) { e.stopPropagation(); });

    $('#ofProductAll').addEventListener('click', function (e) {
      e.stopPropagation();
      selectedProducts = [];
      productGroups().forEach(function (g) { g.products.forEach(function (p) { selectedProducts.push(p); }); });
      renderProductPanel(); renderProductsTrigger(); renderProductsChips(); updatePreview();
    });
    $('#ofProductNone').addEventListener('click', function (e) {
      e.stopPropagation();
      selectedProducts = [];
      renderProductPanel(); renderProductsTrigger(); renderProductsChips(); updatePreview();
    });

    $('#ofProductsPanel').addEventListener('click', function (e) { e.stopPropagation(); });

    document.addEventListener('click', function () {
      if (!$('#ofProductsPanel').hidden) closeProductPanel();
    });
  }

  /* ---------------- نوع الخصم (نسبة / مبلغ ثابت) ---------------- */
  function initDiscountType() {
    $('#ofDiscountType').addEventListener('change', function () {
      var fixed = this.value === 'fixed';
      $('#ofDiscountLabel').innerHTML = fixed ? 'قيمة الخصم (ر.س) <em>*</em>' : 'نسبة الخصم % <em>*</em>';
      $('#ofDiscount').placeholder = fixed ? '50' : '15';
      validateDiscount();
      updatePreview();
    });

    $('#ofDiscount').addEventListener('input', function () {
      this.value = this.value.replace(/[^0-9.]/g, '');
      validateDiscount();
      updatePreview();
    });
  }

  function validateDiscount() {
    var type = $('#ofDiscountType').value;
    var val = parseFloat($('#ofDiscount').value);
    var errEl = $('#ofDiscountError');
    var input = $('#ofDiscount');

    if ($('#ofDiscount').value === '') { errEl.textContent = ''; input.classList.remove('is-invalid'); return true; }

    if (isNaN(val) || val <= 0) {
      errEl.textContent = 'أدخل قيمة خصم صحيحة أكبر من صفر';
      input.classList.add('is-invalid');
      return false;
    }
    if (type === 'percentage' && val > 100) {
      errEl.textContent = 'نسبة الخصم كحد أقصى 100%';
      input.classList.add('is-invalid');
      return false;
    }

    errEl.textContent = '';
    input.classList.remove('is-invalid');
    return true;
  }

  /* ---------------- التحقق من نطاق التاريخ ---------------- */
  function validateDateRange() {
    var start = $('#ofStart').value;
    var end = $('#ofEnd').value;
    var errEl = $('#ofEndError');

    if (start && end && end < start) {
      errEl.textContent = 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية';
      return false;
    }
    errEl.textContent = '';
    return true;
  }

  function initDateValidation() {
    ['#ofStart', '#ofEnd'].forEach(function (sel) {
      $(sel).addEventListener('change', function () {
        validateDateRange();
        updatePreview();
      });
    });
  }

  /* ---------------- المعاينة الحية ---------------- */
  function updatePreview() {
    var type = $('#ofDiscountType').value;
    var discount = parseFloat($('#ofDiscount').value) || 0;
    var name = $('#ofName').value.trim();
    var code = $('#ofCode').value.trim();
    var start = $('#ofStart').value;
    var end = $('#ofEnd').value;
    var minOrder = parseFloat($('#ofMinOrder').value) || 0;
    var limit = parseInt($('#ofUsageLimit').value, 10) || 0;

    $('#ofPrevDiscount').textContent = type === 'fixed' ? ('-' + fmt(discount) + ' ر.س') : ('-' + fmt(discount) + '%');
    $('#ofPrevName').textContent = name || 'اسم العرض هنا';

    var codeEl = $('#ofPrevCode');
    codeEl.hidden = !code;
    if (code) codeEl.textContent = 'الكود: ' + code;

    $('#ofPrevDates').textContent = (start && end) ? (start + ' → ' + end) : 'حدّد تاريخ البداية والنهاية';
    $('#ofPrevMin').textContent = minOrder > 0 ? (fmt(minOrder) + ' ر.س') : 'بدون حد';
    $('#ofPrevLimit').textContent = limit > 0 ? (limit + ' استخدام') : 'غير محدود';
    $('#ofPrevCitiesCount').textContent = selectedCities.length + ' مدينة';

    $('#ofPrevCities').innerHTML = selectedCities.slice(0, 6).map(function (c) {
      return '<span class="pd-tag">' + esc(c) + '</span>';
    }).join('') + (selectedCities.length > 6 ? '<span class="pd-tag">+' + (selectedCities.length - 6) + '</span>' : '');
  }

  function initLivePreviewBindings() {
    ['#ofName', '#ofCode', '#ofMinOrder', '#ofUsageLimit'].forEach(function (sel) {
      $(sel).addEventListener('input', updatePreview);
    });
    ['#ofMinOrder', '#ofUsageLimit'].forEach(function (sel) {
      $(sel).addEventListener('input', function () { this.value = this.value.replace(/[^0-9.]/g, ''); });
    });
  }

  /* ---------------- التحقق الفوري + الحفظ ---------------- */
  function clearFieldErrors() {
    $all('.field-error', $('#offModalOverlay')).forEach(function (e) { e.textContent = ''; });
    $all('.is-invalid', $('#offModalOverlay')).forEach(function (e) { e.classList.remove('is-invalid'); });
  }

  function validateRequired() {
    var ok = true;

    var name = $('#ofName').value.trim();
    if (!name) { $('#ofNameError').textContent = 'اسم العرض مطلوب'; $('#ofName').classList.add('is-invalid'); ok = false; }

    if (!$('#ofDiscount').value.trim() || !validateDiscount()) {
      if (!$('#ofDiscount').value.trim()) $('#ofDiscountError').textContent = 'قيمة الخصم مطلوبة';
      $('#ofDiscount').classList.add('is-invalid');
      ok = false;
    }

    if (!$('#ofStart').value) { $('#ofStartError').textContent = 'تاريخ البداية مطلوب'; ok = false; }
    if (!$('#ofEnd').value) { $('#ofEndError').textContent = 'تاريخ نهاية صلاحية العرض مطلوب'; ok = false; }
    if ($('#ofStart').value && $('#ofEnd').value && !validateDateRange()) ok = false;

    return ok;
  }

  function initModal() {
    $('#offAddBtn').addEventListener('click', function () {
      resetForm();
      $('#offModalOverlay').hidden = false;
    });
    $('#offModalClose').addEventListener('click', closeModal);
    $('#offCancelBtn').addEventListener('click', closeModal);
    $('#offModalOverlay').addEventListener('click', function (e) { if (e.target === $('#offModalOverlay')) closeModal(); });

    $('#offCreateBtn').addEventListener('click', function () {
      clearFieldErrors();

      if (!validateRequired()) {
        toast('يرجى تصحيح الحقول المطلوبة قبل حفظ العرض', 'danger');
        return;
      }

      var name = $('#ofName').value.trim();
      var type = $('#ofDiscountType').value;
      var discount = parseFloat($('#ofDiscount').value);
      var start = $('#ofStart').value;
      var end = $('#ofEnd').value;
      var minOrder = parseFloat($('#ofMinOrder').value) || 0;
      var limit = parseInt($('#ofUsageLimit').value, 10) || 0;

      var today = new Date().toISOString().slice(0, 10);
      offers.unshift({
        id: nextId++, name: name, discount: discount, discountType: type, start: start, end: end,
        cities: selectedCities.slice(), products: selectedProducts.slice(),
        status: start > today ? 'scheduled' : 'active', used: 0, limit: limit, minOrder: minOrder
      });

      renderGrid();
      closeModal();
      toast('تم إنشاء العرض بنجاح', 'success');
    });
  }

  function resetForm() {
    $('#ofName').value = '';
    $('#ofDiscountType').value = 'percentage';
    $('#ofDiscountLabel').innerHTML = 'نسبة الخصم % <em>*</em>';
    $('#ofDiscount').value = '';
    $('#ofDiscount').placeholder = '15';
    $('#ofCode').value = '';
    $('#ofMinOrder').value = '';
    $('#ofUsageLimit').value = '';
    selectedCities = DEFAULT_CITIES.slice();
    citySearch = '';
    $('#ofCitySearch').value = '';
    closeCityPanel();

    var firstProduct = sellableProducts()[0];
    selectedProducts = firstProduct ? [firstProduct.name] : [];
    productSearch = '';
    $('#ofProductSearch').value = '';
    closeProductPanel();

    if (window.DateField) { DateField.clear('ofStart'); DateField.clear('ofEnd'); }
    clearFieldErrors();
    renderCityPanel();
    renderCitiesTrigger();
    renderCitiesChips();
    renderProductPanel();
    renderProductsTrigger();
    renderProductsChips();
    updatePreview();
  }

  function closeModal() {
    $('#offModalOverlay').hidden = true;
  }

  document.addEventListener('DOMContentLoaded', function () {
    initTabs();
    initModal();
    initCityPicker();
    initProductPicker();
    initDiscountType();
    initDateValidation();
    initLivePreviewBindings();
    resetForm();
    renderGrid();
  });
})();
