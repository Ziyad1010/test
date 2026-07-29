(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var CATEGORY_LABELS = {
    steel: 'حديد وصلب', cement: 'أسمنت', concrete: 'خرسانة جاهزة',
    finishing: 'مواد تشطيب', blocks: 'طوب وبلوك', tools: 'أدوات ومعدات'
  };

  var STATUS_LABELS = { active: 'نشط', draft: 'مسودة', archived: 'مؤرشف' };

  var AVAILABILITY_LABELS = {
    in_stock: 'متوفر', limited: 'كمية محدودة',
    out_of_stock: 'غير متوفر', on_demand: 'عند الطلب'
  };

  // التصنيفات الفرعية لكل فئة رئيسية (Dependent dropdown)
  var SUBCATEGORIES = {
    steel: ['حديد تسليح', 'مقاطع وزوايا', 'صاج وألواح', 'أسلاك وشبك', 'أنابيب'],
    cement: ['أسمنت بورتلاندي', 'أسمنت مقاوم للكبريتات', 'أسمنت أبيض', 'مونة جاهزة'],
    concrete: ['خرسانة جاهزة', 'خرسانة مسبقة الصب', 'إضافات خرسانة'],
    finishing: ['بلاط وسيراميك', 'دهانات', 'عوازل', 'جبس وأسقف', 'أدوات صحية'],
    blocks: ['طوب أسمنتي', 'طوب أحمر', 'بلوك خفيف', 'إنترلوك'],
    tools: ['معدات ثقيلة', 'عدد يدوية', 'سقالات', 'مستلزمات السلامة']
  };

  // خصائص مخصّصة لكل فئة — تظهر تلقائياً عند اختيار الفئة
  var CATEGORY_ATTRIBUTES = {
    steel: [
      { key: 'diameter', label: 'القطر', placeholder: '12 مم' },
      { key: 'length', label: 'الطول', placeholder: '12 متر' },
      { key: 'grade', label: 'الدرجة', placeholder: 'B500B' },
      { key: 'standard', label: 'المواصفة القياسية', placeholder: 'SASO 2/1990' }
    ],
    cement: [
      { key: 'type', label: 'النوع', placeholder: 'OPC 43' },
      { key: 'bagWeight', label: 'وزن الكيس', placeholder: '50 كجم' },
      { key: 'strength', label: 'مقاومة الضغط', placeholder: '42.5 نيوتن/مم²' }
    ],
    concrete: [
      { key: 'strengthClass', label: 'درجة المقاومة', placeholder: 'C30' },
      { key: 'slump', label: 'الهبوط (Slump)', placeholder: '120 مم' },
      { key: 'aggregate', label: 'مقاس الركام', placeholder: '20 مم' }
    ],
    finishing: [
      { key: 'size', label: 'المقاس', placeholder: '60×60 سم' },
      { key: 'finish', label: 'التشطيب', placeholder: 'مطفي' },
      { key: 'color', label: 'اللون', placeholder: 'رمادي فاتح' }
    ],
    blocks: [
      { key: 'size', label: 'المقاس', placeholder: '20×20×40 سم' },
      { key: 'weight', label: 'الوزن', placeholder: '16 كجم' },
      { key: 'color', label: 'اللون', placeholder: 'رمادي' },
      { key: 'compressive', label: 'مقاومة الضغط', placeholder: '7 نيوتن/مم²' }
    ],
    tools: [
      { key: 'power', label: 'القدرة', placeholder: '1500 واط' },
      { key: 'capacity', label: 'السعة', placeholder: '350 لتر' },
      { key: 'warranty', label: 'الضمان', placeholder: 'سنة واحدة' }
    ]
  };

  var CATEGORY_IMAGES = {
    steel: 'assets/images/cat-steel.jpg', cement: 'assets/images/cat-cement.jpg',
    concrete: 'assets/images/cat-concrete.jpg', finishing: 'assets/images/prod-porcelain.jpg',
    blocks: 'assets/images/cat-blocks.jpg', tools: 'assets/images/prod-mixer.jpg'
  };

  var products = [];
  var currentView = 'grid';
  var editingId = null;
  var openMenuId = null;
  var selectedIds = [];
  var modalImages = [];
  var tiers = [];
  var importRows = [];

  var TAB_META = [
    { key: 'basic', label: 'معلومات أساسية' },
    { key: 'pricing', label: 'التسعير والمخزون' },
    { key: 'shipping', label: 'التوصيل والوسائط' },
    { key: 'extra', label: 'خيارات إضافية' }
  ];
  var TABS = TAB_META.map(function (t) { return t.key; });
  var currentTab = 0;
  var CHECK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

  /* ---------------- Helpers ---------------- */
  function load() { products = Store.getProducts(); }

  // Store.saveProducts notifies every subscriber, including this page. Without
  // this flag our own writes would immediately re-render the list and throw
  // away the row the user is editing (and its "saved" confirmation).
  var localWrite = false;
  function persist() {
    localWrite = true;
    Store.saveProducts(products);
    localWrite = false;
  }

  // Sold quantity per product, tallied once per render instead of walking
  // every order again for each row.
  var orderCounts = {};
  function refreshOrderCounts() {
    orderCounts = {};
    Store.getOrders().forEach(function (o) {
      (o.items || []).forEach(function (it) {
        orderCounts[it.productId] = (orderCounts[it.productId] || 0) + (it.qty || 0);
      });
    });
  }
  function orderCountFor(id) { return orderCounts[id] || 0; }

  function availabilityOf(p) {
    return p.availability === 'on_demand' ? 'on_demand' : Store.deriveAvailability(p);
  }

  function stockState(p) {
    if (p.stock <= 0) return 'out';
    if (p.lowStock > 0 && p.stock <= p.lowStock) return 'low';
    return 'in';
  }

  function formatPrice(n) {
    return Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 });
  }

  // السعر الفعلي: السعر الخاص إن كان ضمن فترته، وإلا الأساسي بعد الخصم
  function effectivePrice(p) {
    var today = new Date().toISOString().slice(0, 10);
    if (p.specialPrice > 0) {
      var fromOk = !p.specialFrom || p.specialFrom <= today;
      var toOk = !p.specialTo || p.specialTo >= today;
      if (fromOk && toOk) return p.specialPrice;
    }
    return p.discount > 0 ? p.price * (1 - p.discount / 100) : p.price;
  }

  function getFiltered() {
    var q = $('#pdSearch').value.trim().toLowerCase();
    var cat = $('#pdFilterCategory').value;
    var status = $('#pdFilterStatus').value;
    var stock = $('#pdFilterStock').value;

    return products.filter(function (p) {
      if (q) {
        var haystack = (p.name + ' ' + (p.sku || '') + ' ' + (p.brand || '')).toLowerCase();
        if (haystack.indexOf(q) === -1) return false;
      }
      if (cat && p.category !== cat) return false;
      if (status && p.status !== status) return false;
      if (stock && stockState(p) !== stock) return false;
      return true;
    });
  }

  function toast(msg, kind) {
    if (window.Shell) Shell.toast(msg, kind);
  }

  /* ---------------- Stats ---------------- */
  function updateStats() {
    $('#pdStatTotal').textContent = products.length;
    $('#pdStatActive').textContent = products.filter(function (p) { return p.status === 'active'; }).length;
    $('#pdStatLow').textContent = products.filter(function (p) { return stockState(p) === 'low'; }).length;
    $('#pdStatOut').textContent = products.filter(function (p) { return stockState(p) === 'out'; }).length;
  }

  /* ---------------- Grid Rendering ---------------- */
  function stockLabel(p) {
    var s = stockState(p);
    if (s === 'out') return '<span class="pd-stock-out">نفد المخزون</span>';
    if (s === 'low') return '<span class="pd-stock-warn">باقي ' + p.stock + ' ' + (p.unit || '') + '</span>';
    return p.stock + ' ' + (p.unit || '');
  }

  function renderGrid(list) {
    var grid = $('#pdGrid');
    grid.innerHTML = list.map(function (p) {
      var avail = availabilityOf(p);
      var eff = effectivePrice(p);
      var discounted = eff < p.price;
      return '<div class="pd-card" data-id="' + p.id + '">' +
        '<div class="pd-card-img-wrap">' +
          '<img class="pd-card-img" src="' + p.img + '" alt="' + p.name + '" />' +
          '<span class="pd-card-status ' + p.status + '">' + STATUS_LABELS[p.status] + '</span>' +
          '<div class="pd-card-menu-wrap">' +
            '<button type="button" class="pd-card-menu-btn" data-menu="' + p.id + '" aria-label="خيارات">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>' +
            '</button>' +
            (openMenuId === p.id ? dropdownHtml(p.id) : '') +
          '</div>' +
        '</div>' +
        '<div class="pd-card-body">' +
          '<div class="pd-card-name">' + p.name + '</div>' +
          '<span class="pd-card-sku">SKU: ' + (p.sku || '—') + '</span>' +
          '<div class="pd-card-tags">' +
            '<span class="pd-tag">' + (CATEGORY_LABELS[p.category] || p.category) + '</span>' +
            '<span class="pd-tag">' + (p.brand || 'عام') + '</span>' +
            '<span class="pd-avail ' + avail + '">' + AVAILABILITY_LABELS[avail] + '</span>' +
          '</div>' +
          '<div class="pd-card-price-row">' +
            '<span class="pd-price">' + formatPrice(eff) + ' ر.س</span>' +
            '<span class="pd-card-sku">/ ' + (p.unit || 'وحدة') + '</span>' +
            (discounted ? '<span class="pd-price-old">' + formatPrice(p.price) + '</span>' : '') +
          '</div>' +
          '<div class="pd-card-meta"><span>' + stockLabel(p) + '</span><span>' + (p.warehouse || '—') + '</span></div>' +
          '<div class="pd-card-stats">' +
            '<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>' + (p.views || 0) + '</span>' +
            '<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>' + orderCountFor(p.id) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    bindMenuEvents(grid);
  }

  function dropdownHtml(id) {
    var product = products.filter(function (x) { return x.id === id; })[0];
    var archiveLabel = product && product.status === 'archived' ? 'إلغاء الأرشفة' : 'أرشفة المنتج';

    return '<div class="pd-dropdown" data-dropdown="' + id + '">' +
      '<button type="button" data-action="edit" data-id="' + id + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>تعديل المنتج</button>' +
      '<button type="button" data-action="duplicate" data-id="' + id + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>نسخ المنتج</button>' +
      '<button type="button" data-action="archive" data-id="' + id + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>' + archiveLabel + '</button>' +
      '<button type="button" class="danger" data-action="delete" data-id="' + id + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>حذف المنتج</button>' +
    '</div>';
  }

  function bindMenuEvents(root) {
    $all('[data-menu]', root).forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = parseInt(btn.getAttribute('data-menu'), 10);
        openMenuId = openMenuId === id ? null : id;
        renderCurrentView();
      });
    });
    $all('[data-action]', root).forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        handleAction(btn.getAttribute('data-action'), parseInt(btn.getAttribute('data-id'), 10));
      });
    });
  }

  /* ---------------- Table Rendering (with inline edit + selection) ---------------- */
  function renderTable(list) {
    var body = $('#pdTableBody');
    body.innerHTML = list.map(function (p) {
      var avail = availabilityOf(p);
      var checked = selectedIds.indexOf(p.id) !== -1 ? ' checked' : '';
      return '<tr data-id="' + p.id + '">' +
        '<td><input type="checkbox" class="pd-check" data-select="' + p.id + '"' + checked + ' aria-label="تحديد" /></td>' +
        '<td><div class="pd-table-product"><img src="' + p.img + '" alt="' + p.name + '"/><div>' +
          '<div class="pd-table-product-name"><a href="product-details.html?id=' + p.id + '" style="color:inherit;text-decoration:none;">' + p.name + '</a></div>' +
          '<div class="pd-table-product-sku">' + (p.sku || '—') + '</div></div></div></td>' +
        '<td>' + (CATEGORY_LABELS[p.category] || p.category) + '</td>' +
        '<td><input type="text" class="pd-inline" data-inline="price" data-id="' + p.id + '" value="' + p.price + '" inputmode="decimal" aria-label="السعر" /></td>' +
        '<td><input type="text" class="pd-inline" data-inline="stock" data-id="' + p.id + '" value="' + p.stock + '" inputmode="numeric" aria-label="الكمية" /></td>' +
        '<td>' + (p.unit || '—') + '</td>' +
        '<td><span class="pd-avail ' + avail + '">' + AVAILABILITY_LABELS[avail] + '</span></td>' +
        '<td>' + (p.warehouse || '—') + '</td>' +
        '<td>' + orderCountFor(p.id) + '</td>' +
        '<td><span class="pd-status-pill ' + p.status + '">' + STATUS_LABELS[p.status] + '</span></td>' +
        '<td><div class="pd-table-actions">' +
          '<button type="button" title="تعديل" data-action="edit" data-id="' + p.id + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg></button>' +
          '<button type="button" title="نسخ" data-action="duplicate" data-id="' + p.id + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>' +
          '<button type="button" title="حذف" data-action="delete" data-id="' + p.id + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
        '</div></td>' +
      '</tr>';
    }).join('');

    bindMenuEvents(body);
    bindInlineEdit(body);
    bindSelection(body);
  }

  // تحرير سريع للسعر والكمية مباشرة من الجدول
  function bindInlineEdit(root) {
    $all('[data-inline]', root).forEach(function (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { input.blur(); }
        if (e.key === 'Escape') { renderCurrentView(); }
      });

      input.addEventListener('blur', function () {
        var id = parseInt(input.getAttribute('data-id'), 10);
        var field = input.getAttribute('data-inline');
        var product = products.filter(function (p) { return p.id === id; })[0];
        if (!product) return;

        var raw = input.value.replace(/[^0-9.]/g, '');
        var value = field === 'stock' ? parseInt(raw, 10) : parseFloat(raw);

        if (isNaN(value) || value < 0) {
          input.value = product[field];
          toast('قيمة غير صالحة — تم التراجع', 'danger');
          return;
        }
        if (value === product[field]) return;

        product[field] = value;
        if (field === 'stock') product.availability = Store.deriveAvailability(product);
        persist();
        updateStats();

        input.classList.add('is-saved');
        setTimeout(function () { input.classList.remove('is-saved'); }, 900);
        toast('تم حفظ ' + (field === 'price' ? 'السعر' : 'الكمية') + ' لـ "' + product.name + '"', 'success');
      });
    });
  }

  function bindSelection(root) {
    $all('[data-select]', root).forEach(function (box) {
      box.addEventListener('change', function () {
        var id = parseInt(box.getAttribute('data-select'), 10);
        if (box.checked) {
          if (selectedIds.indexOf(id) === -1) selectedIds.push(id);
        } else {
          selectedIds = selectedIds.filter(function (x) { return x !== id; });
        }
        renderBulkBar();
      });
    });
  }

  function renderBulkBar() {
    var bar = $('#pdBulkBar');
    bar.hidden = selectedIds.length === 0;
    $('#pdBulkCount').textContent = 'تم تحديد ' + selectedIds.length + ' منتج';

    var all = $('#pdCheckAll');
    var visible = getFiltered();
    all.checked = visible.length > 0 && visible.every(function (p) { return selectedIds.indexOf(p.id) !== -1; });
  }

  /* ---------------- Bulk actions ---------------- */
  function handleBulk(action) {
    if (action === 'clear') {
      selectedIds = [];
      renderCurrentView();
      renderBulkBar();
      return;
    }

    var chosen = products.filter(function (p) { return selectedIds.indexOf(p.id) !== -1; });
    if (!chosen.length) return;

    if (action === 'activate' || action === 'deactivate') {
      var target = action === 'activate' ? 'active' : 'draft';
      chosen.forEach(function (p) { p.status = target; });
      persist();
      toast('تم تحديث حالة ' + chosen.length + ' منتج', 'success');

    } else if (action === 'price') {
      var input = window.prompt('أدخل نسبة تعديل السعر % (استخدم سالباً للتخفيض، مثال: -10)', '-10');
      if (input === null) return;
      var pct = parseFloat(input);
      if (isNaN(pct)) { toast('نسبة غير صالحة', 'danger'); return; }
      chosen.forEach(function (p) {
        p.price = Math.max(0, Math.round(p.price * (1 + pct / 100) * 100) / 100);
      });
      persist();
      toast('تم تعديل سعر ' + chosen.length + ' منتج بنسبة ' + pct + '%', 'success');

    } else if (action === 'export') {
      exportCsv(chosen, 'منتجات-محددة');
      return;

    } else if (action === 'delete') {
      if (!window.confirm('سيتم حذف ' + chosen.length + ' منتج نهائياً. هل تريد المتابعة؟')) return;
      products = products.filter(function (p) { return selectedIds.indexOf(p.id) === -1; });
      persist();
      toast('تم حذف ' + chosen.length + ' منتج', 'success');
      selectedIds = [];
    }

    updateStats();
    renderCurrentView();
    renderBulkBar();
  }

  /* ---------------- CSV export / import ---------------- */
  var CSV_COLUMNS = ['name', 'category', 'subcategory', 'brand', 'price', 'unit', 'stock', 'lowStock',
    'moq', 'weight', 'weightUnit', 'maxPerCustomer', 'sku', 'barcode', 'gtin', 'mpn', 'warehouse', 'status'];

  function csvEscape(v) {
    var s = v === undefined || v === null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function exportCsv(list, filename) {
    var header = CSV_COLUMNS.join(',');
    var rows = list.map(function (p) {
      return CSV_COLUMNS.map(function (c) { return csvEscape(p[c]); }).join(',');
    });
    // BOM حتى يفتح Excel الملف بترميز UTF-8 ويعرض العربية بشكل صحيح
    var csv = '﻿' + header + '\n' + rows.join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (filename || 'المنتجات') + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);

    toast('تم تصدير ' + list.length + ' منتج', 'success');
  }

  // محلّل CSV يدعم الحقول المقتبسة والفواصل داخلها
  function parseCsv(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;

    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += ch;
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field); field = '';
      } else if (ch === '\n') {
        row.push(field); field = '';
        rows.push(row); row = [];
      } else if (ch !== '\r') {
        field += ch;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return c.trim() !== ''; }); });
  }

  function categoryKeyFromLabel(value) {
    var v = (value || '').trim();
    if (CATEGORY_LABELS[v]) return v;
    var found = '';
    Object.keys(CATEGORY_LABELS).forEach(function (k) {
      if (CATEGORY_LABELS[k] === v) found = k;
    });
    return found;
  }

  function validateImportRow(obj, lineNo) {
    var errors = [];
    if (!obj.name || obj.name.trim().length < 2) errors.push('السطر ' + lineNo + ': اسم المنتج مفقود');
    if (!(parseFloat(obj.price) >= 0)) errors.push('السطر ' + lineNo + ': السعر غير صالح');
    if (!(parseInt(obj.stock, 10) >= 0)) errors.push('السطر ' + lineNo + ': الكمية غير صالحة');
    if (!(parseFloat(obj.weight) > 0)) errors.push('السطر ' + lineNo + ': وزن المنتج مطلوب');
    return errors;
  }

  function handleImportFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var rows = parseCsv(String(reader.result));
      var result = $('#pdImportResult');
      result.hidden = false;
      importRows = [];

      if (rows.length < 2) {
        result.innerHTML = '<span class="bad">الملف فارغ أو لا يحتوي على صف بيانات واحد على الأقل.</span>';
        $('#pdImportConfirm').disabled = true;
        return;
      }

      var header = rows[0].map(function (h) { return h.trim(); });
      var errors = [];

      rows.slice(1).forEach(function (r, idx) {
        var obj = {};
        header.forEach(function (h, i) { obj[h] = (r[i] || '').trim(); });

        var rowErrors = validateImportRow(obj, idx + 2);
        if (rowErrors.length) { errors = errors.concat(rowErrors); return; }
        importRows.push(obj);
      });

      var html = '<span class="ok">جاهز للاستيراد: ' + importRows.length + ' منتج</span>';
      if (errors.length) {
        html += '<br /><span class="bad">تم تخطي ' + errors.length + ' سطر بسبب أخطاء:</span>' +
          '<div class="pd-import-errors">' + errors.slice(0, 40).join('<br />') + '</div>';
      }
      result.innerHTML = html;
      $('#pdImportConfirm').disabled = importRows.length === 0;
    };
    reader.readAsText(file, 'UTF-8');
  }

  function confirmImport() {
    var added = 0;
    importRows.forEach(function (obj) {
      var cat = categoryKeyFromLabel(obj.category) || 'tools';
      products.push({
        id: Store.nextProductId() + added,
        name: obj.name.trim(),
        category: cat,
        subcategory: obj.subcategory || '',
        brand: obj.brand || 'عام',
        price: parseFloat(obj.price) || 0,
        unit: obj.unit || 'حبة',
        discount: 0,
        stock: parseInt(obj.stock, 10) || 0,
        lowStock: parseInt(obj.lowStock, 10) || 10,
        moq: parseInt(obj.moq, 10) || 1,
        weight: parseFloat(obj.weight) || 0,
        weightUnit: obj.weightUnit || 'كجم',
        maxPerCustomer: parseInt(obj.maxPerCustomer, 10) || 0,
        sku: obj.sku || '',
        barcode: obj.barcode || '',
        gtin: obj.gtin || '',
        mpn: obj.mpn || '',
        warehouse: obj.warehouse || 'مستودع الرياض الرئيسي',
        availability: 'auto',
        views: 0,
        status: obj.status === 'active' ? 'active' : 'draft',
        img: CATEGORY_IMAGES[cat] || CATEGORY_IMAGES.tools,
        images: [],
        tiers: []
      });
      added++;
    });

    persist();
    updateStats();
    renderCurrentView();
    closeImport();
    toast('تم استيراد ' + added + ' منتج كمسودة — راجعها قبل النشر', 'success');
  }

  function downloadTemplate() {
    var sample = [{
      name: 'حديد تسليح 10مم', category: 'حديد وصلب', subcategory: 'حديد تسليح', brand: 'حديد الراجحي',
      price: 2400, unit: 'طن', stock: 30, lowStock: 10, moq: 1, weight: 1000, weightUnit: 'كجم',
      maxPerCustomer: '', sku: 'STL-RJ-010', barcode: '', gtin: '', mpn: '',
      warehouse: 'مستودع الرياض الرئيسي', status: 'draft'
    }];
    exportCsv(sample, 'قالب-استيراد-المنتجات');
  }

  /* ---------------- Actions ---------------- */
  function handleAction(action, id) {
    var product = products.filter(function (p) { return p.id === id; })[0];
    if (!product) return;

    if (action === 'edit') {
      openModal(product);
    } else if (action === 'duplicate') {
      var copy = Object.assign({}, product, {
        id: Store.nextProductId(),
        name: product.name + ' (نسخة)',
        sku: product.sku ? product.sku + '-COPY' : '',
        status: 'draft'
      });
      products.push(copy);
      persist();
      toast('تم إنشاء نسخة كمسودة — عدّلها ثم انشرها', 'success');
    } else if (action === 'archive') {
      product.status = product.status === 'archived' ? 'active' : 'archived';
      persist();
    } else if (action === 'delete') {
      if (window.confirm('هل أنت متأكد من حذف "' + product.name + '"؟ لا يمكن التراجع عن هذا الإجراء.')) {
        products = products.filter(function (p) { return p.id !== id; });
        persist();
        toast('تم حذف المنتج', 'success');
      }
    }

    openMenuId = null;
    updateStats();
    renderCurrentView();
  }

  /* ---------------- View switching / filters ---------------- */
  function renderCurrentView() {
    refreshOrderCounts();
    var list = getFiltered();
    $('#pdEmpty').hidden = list.length > 0;
    $('#pdGrid').hidden = currentView !== 'grid' || list.length === 0;
    $('#pdTableWrap').hidden = currentView !== 'table' || list.length === 0;

    if (currentView === 'grid') renderGrid(list); else renderTable(list);
    renderBulkBar();
  }

  function initToolbar() {
    ['#pdSearch', '#pdFilterCategory', '#pdFilterStatus', '#pdFilterStock'].forEach(function (sel) {
      $(sel).addEventListener('input', renderCurrentView);
      $(sel).addEventListener('change', renderCurrentView);
    });

    $('#pdViewGrid').addEventListener('click', function () {
      currentView = 'grid';
      $('#pdViewGrid').classList.add('is-active');
      $('#pdViewTable').classList.remove('is-active');
      renderCurrentView();
    });
    $('#pdViewTable').addEventListener('click', function () {
      currentView = 'table';
      $('#pdViewTable').classList.add('is-active');
      $('#pdViewGrid').classList.remove('is-active');
      renderCurrentView();
    });

    $('#pdCheckAll').addEventListener('change', function () {
      var visible = getFiltered();
      if (this.checked) {
        visible.forEach(function (p) { if (selectedIds.indexOf(p.id) === -1) selectedIds.push(p.id); });
      } else {
        var visibleIds = visible.map(function (p) { return p.id; });
        selectedIds = selectedIds.filter(function (id) { return visibleIds.indexOf(id) === -1; });
      }
      renderCurrentView();
    });

    $all('[data-bulk]').forEach(function (btn) {
      btn.addEventListener('click', function () { handleBulk(btn.getAttribute('data-bulk')); });
    });

    $('#pdExportBtn').addEventListener('click', function () { exportCsv(getFiltered(), 'المنتجات'); });

    document.addEventListener('click', function () {
      if (openMenuId !== null) { openMenuId = null; renderCurrentView(); }
    });
  }

  /* ---------------- Category-dependent UI ---------------- */
  function renderSubcategories(category, keep) {
    var sel = $('#pfSubcategory');
    var list = SUBCATEGORIES[category] || [];
    sel.innerHTML = '';

    var ph = document.createElement('option');
    ph.value = '';
    ph.textContent = list.length ? 'اختر التصنيف الفرعي' : 'اختر الفئة الرئيسية أولاً';
    sel.appendChild(ph);

    list.forEach(function (name) {
      var o = document.createElement('option');
      o.value = name;
      o.textContent = name;
      sel.appendChild(o);
    });

    sel.disabled = list.length === 0;
    if (keep) sel.value = keep;
  }

  function renderAttributes(category, values) {
    var grid = $('#pfAttrGrid');
    var attrs = CATEGORY_ATTRIBUTES[category] || [];
    values = values || {};

    $('#pfAttrEmpty').hidden = attrs.length > 0;
    grid.innerHTML = attrs.map(function (a) {
      var v = values[a.key] ? String(values[a.key]).replace(/"/g, '&quot;') : '';
      return '<div class="pd-field">' +
        '<label for="attr_' + a.key + '">' + a.label + '</label>' +
        '<input type="text" id="attr_' + a.key + '" data-attr="' + a.key + '" placeholder="' + a.placeholder + '" value="' + v + '" />' +
      '</div>';
    }).join('');
  }

  function collectAttributes() {
    var out = {};
    $all('[data-attr]').forEach(function (input) {
      if (input.value.trim()) out[input.getAttribute('data-attr')] = input.value.trim();
    });
    return out;
  }

  /* ---------------- Tiered pricing ---------------- */
  function renderTiers() {
    var wrap = $('#pfTierTable');
    wrap.innerHTML = tiers.map(function (t, i) {
      return '<div class="pd-tier-row" data-tier="' + i + '">' +
        '<input type="text" data-tier-field="from" value="' + (t.from || '') + '" placeholder="1" inputmode="numeric" aria-label="من كمية" />' +
        '<input type="text" data-tier-field="to" value="' + (t.to || '') + '" placeholder="10" inputmode="numeric" aria-label="إلى كمية" />' +
        '<input type="text" data-tier-field="price" value="' + (t.price || '') + '" placeholder="2400" inputmode="decimal" aria-label="السعر" />' +
        '<button type="button" class="pd-tier-remove" data-tier-remove="' + i + '" aria-label="حذف الشريحة">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
      '</div>';
    }).join('');

    $all('[data-tier-field]', wrap).forEach(function (input) {
      input.addEventListener('input', function () {
        var idx = parseInt(input.closest('[data-tier]').getAttribute('data-tier'), 10);
        var field = input.getAttribute('data-tier-field');
        input.value = input.value.replace(field === 'price' ? /[^0-9.]/g : /[^0-9]/g, '');
        tiers[idx][field] = input.value;
      });
    });

    $all('[data-tier-remove]', wrap).forEach(function (btn) {
      btn.addEventListener('click', function () {
        tiers.splice(parseInt(btn.getAttribute('data-tier-remove'), 10), 1);
        renderTiers();
      });
    });
  }

  function collectTiers() {
    return tiers.filter(function (t) {
      return t.from !== '' && t.price !== '' && parseFloat(t.price) > 0;
    }).map(function (t) {
      return { from: parseInt(t.from, 10) || 1, to: parseInt(t.to, 10) || 0, price: parseFloat(t.price) || 0 };
    });
  }

  /* ---------------- VAT summary ---------------- */
  function updateVatSummary() {
    var price = parseFloat($('#pfPrice').value) || 0;
    var rate = parseFloat($('#pfVatRate').value);
    if (isNaN(rate)) rate = 15;
    var inclusive = $('#pfVatIncluded').checked;

    var base, vat, final;
    if (inclusive) {
      base = price / (1 + rate / 100);
      vat = price - base;
      final = price;
    } else {
      base = price;
      vat = price * (rate / 100);
      final = price + vat;
    }

    $('#pfVatBase').textContent = formatPrice(base) + ' ر.س';
    $('#pfVatAmount').textContent = formatPrice(vat) + ' ر.س';
    $('#pfVatFinal').textContent = formatPrice(final) + ' ر.س';
  }

  /* ---------------- Supported cities picker ---------------- */
  var DEFAULT_CITIES = ['الرياض', 'جدة'];
  var selectedCities = [];
  var citySearch = '';

  // كل المدن من js/saudi-regions.js مجمّعة حسب المنطقة الإدارية
  function cityGroups() {
    var regions = window.SAUDI_REGIONS || [];
    return regions.map(function (r) {
      return { region: r.name, cities: r.cities.map(function (c) { return c.name; }) };
    });
  }

  function renderCityPicker() {
    var list = $('#pfCityList');
    var q = citySearch.trim().toLowerCase();

    var html = cityGroups().map(function (g) {
      // البحث يطابق اسم المنطقة أو أي مدينة داخلها
      var regionMatches = g.region.toLowerCase().indexOf(q) !== -1;
      var cities = (!q || regionMatches)
        ? g.cities
        : g.cities.filter(function (c) { return c.toLowerCase().indexOf(q) !== -1; });

      if (!cities.length) return '';

      var pickedInRegion = cities.filter(function (c) { return selectedCities.indexOf(c) !== -1; }).length;

      return '<div class="pd-region-block">' +
        '<label class="pd-region-head">' +
          '<input type="checkbox" class="pd-check" data-region="' + g.region + '"' +
            (pickedInRegion === cities.length ? ' checked' : '') + ' />' +
          g.region +
          '<span class="pd-region-count">' + pickedInRegion + '/' + cities.length + '</span>' +
        '</label>' +
        '<div class="pd-city-grid">' +
          cities.map(function (c) {
            var on = selectedCities.indexOf(c) !== -1;
            return '<label class="pd-city-item' + (on ? ' is-checked' : '') + '">' +
              '<input type="checkbox" data-city="' + c + '"' + (on ? ' checked' : '') + ' />' +
              '<span>' + c + '</span>' +
            '</label>';
          }).join('') +
        '</div>' +
      '</div>';
    }).join('');

    list.innerHTML = html || '<p class="pd-city-empty">لا توجد نتائج مطابقة لبحثك</p>';

    // حالة "محدد جزئياً" لمربع المنطقة
    $all('[data-region]', list).forEach(function (box) {
      var group = null;
      cityGroups().forEach(function (g) { if (g.region === box.getAttribute('data-region')) group = g; });
      if (!group) return;
      var picked = group.cities.filter(function (c) { return selectedCities.indexOf(c) !== -1; }).length;
      box.indeterminate = picked > 0 && picked < group.cities.length;

      box.addEventListener('change', function () {
        if (box.checked) {
          group.cities.forEach(function (c) {
            if (selectedCities.indexOf(c) === -1) selectedCities.push(c);
          });
        } else {
          selectedCities = selectedCities.filter(function (c) { return group.cities.indexOf(c) === -1; });
        }
        renderCityPicker();
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
        renderCityPicker();
      });
    });

    $('#pfCityCount').textContent = selectedCities.length + ' مدينة';
  }

  function initCityPicker() {
    $('#pfCitySearch').addEventListener('input', function () {
      citySearch = this.value;
      renderCityPicker();
    });

    $('#pfCityAll').addEventListener('click', function () {
      selectedCities = [];
      cityGroups().forEach(function (g) {
        g.cities.forEach(function (c) { selectedCities.push(c); });
      });
      renderCityPicker();
    });

    $('#pfCityNone').addEventListener('click', function () {
      selectedCities = [];
      renderCityPicker();
    });
  }

  /* ---------------- Media ---------------- */
  function renderMedia() {
    var grid = $('#pfMediaGrid');
    grid.innerHTML = modalImages.map(function (src, i) {
      return '<div class="pd-media-item">' +
        '<img src="' + src + '" alt="صورة ' + (i + 1) + '" />' +
        (i === 0 ? '<span class="pd-media-main">رئيسية</span>' : '') +
        '<button type="button" class="pd-media-remove" data-img-remove="' + i + '" aria-label="حذف الصورة">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
      '</div>';
    }).join('');

    $all('[data-img-remove]', grid).forEach(function (btn) {
      btn.addEventListener('click', function () {
        modalImages.splice(parseInt(btn.getAttribute('data-img-remove'), 10), 1);
        renderMedia();
      });
    });
  }

  function handleImageFiles(files) {
    Array.prototype.slice.call(files).forEach(function (file) {
      if (!/^image\//.test(file.type)) return;
      var reader = new FileReader();
      reader.onload = function () {
        modalImages.push(String(reader.result));
        renderMedia();
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------------- Modal ---------------- */
  var TEXT_FIELDS = ['pfName', 'pfSku', 'pfBarcode', 'pfGtin', 'pfMpn', 'pfDesc', 'pfPrice',
    'pfSpecialPrice', 'pfStock', 'pfLowStock', 'pfMoq', 'pfReserved', 'pfWeight',
    'pfMaxPerCustomer', 'pfVideo', 'pfKeywords', 'pfMeta', 'pfShipCost', 'pfFreeThreshold', 'pfEta'];

  var SELECT_FIELDS = ['pfCategory', 'pfSubcategory', 'pfBrand', 'pfOrigin', 'pfWarehouse', 'pfUnit', 'pfAvailability', 'pfWeightUnit'];

  function resetModalFields() {
    TEXT_FIELDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    SELECT_FIELDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });

    $('#pfVatRate').value = '15';
    $('#pfVatIncluded').checked = true;
    $('#pfWeightUnit').value = 'كجم';
    $('#pfAvailability').value = 'auto';
    if ($('#pfDeliveryAvailable')) $('#pfDeliveryAvailable').checked = true;

    $('#pfDescCount').textContent = '0';
    $('#pfMetaCount').textContent = '0';

    modalImages = [];
    tiers = [];
    selectedCities = DEFAULT_CITIES.slice();
    citySearch = '';
    $('#pfCitySearch').value = '';
    renderCityPicker();
    renderMedia();
    renderTiers();
    renderSubcategories('', '');
    renderAttributes('', {});
    updateVatSummary();

    if (window.DateField) { DateField.clear('pfSpecialFrom'); DateField.clear('pfSpecialTo'); }
    $all('.field-error').forEach(function (e) { e.textContent = ''; });
    $all('.is-invalid').forEach(function (e) { e.classList.remove('is-invalid'); });
  }

  function fillModalFromProduct(p) {
    $('#pfName').value = p.name || '';
    $('#pfCategory').value = p.category || '';
    renderSubcategories(p.category, p.subcategory);
    renderAttributes(p.category, p.attributes || {});
    $('#pfBrand').value = p.brand || '';
    $('#pfOrigin').value = p.origin || '';
    $('#pfWarehouse').value = p.warehouse || '';
    $('#pfDesc').value = p.description || '';
    $('#pfDescCount').textContent = String((p.description || '').length);

    $('#pfPrice').value = p.price != null ? p.price : '';
    $('#pfUnit').value = p.unit || '';
    $('#pfVatRate').value = p.vatRate != null ? p.vatRate : 15;
    $('#pfVatIncluded').checked = p.vatIncluded !== false;
    $('#pfSpecialPrice').value = p.specialPrice || '';

    $('#pfStock').value = p.stock != null ? p.stock : '';
    $('#pfLowStock').value = p.lowStock != null ? p.lowStock : '';
    $('#pfAvailability').value = p.availability || 'auto';
    $('#pfMoq').value = p.moq || '';
    $('#pfReserved').value = p.reserved || '';
    $('#pfWeight').value = p.weight || '';
    $('#pfWeightUnit').value = p.weightUnit || 'كجم';
    $('#pfMaxPerCustomer').value = p.maxPerCustomer || '';
    $('#pfBarcode').value = p.barcode || '';
    $('#pfSku').value = p.sku || '';
    $('#pfGtin').value = p.gtin || '';
    $('#pfMpn').value = p.mpn || '';
    $('#pfVideo').value = p.video || '';

    selectedCities = (p.cities && p.cities.length) ? p.cities.slice() : [];
    renderCityPicker();

    modalImages = (p.images || []).slice();
    if (!modalImages.length && p.img) modalImages.push(p.img);
    renderMedia();

    tiers = (p.tiers || []).map(function (t) {
      return { from: String(t.from || ''), to: String(t.to || ''), price: String(t.price || '') };
    });
    renderTiers();

    $('#pfSpecialFrom').value = p.specialFrom || '';
    $('#pfSpecialTo').value = p.specialTo || '';
    if (window.DateField) DateField.refresh();

    updateVatSummary();
  }

  function openModal(product) {
    editingId = product ? product.id : null;
    $('#pdModalTitle').textContent = product ? 'تعديل المنتج' : 'إضافة منتج جديد';
    resetModalFields();
    if (product) fillModalFromProduct(product);
    currentTab = 0;
    renderTabs();
    $('#pdModalOverlay').hidden = false;
  }

  function closeModal() {
    $('#pdModalOverlay').hidden = true;
    editingId = null;
  }

  // يبني شريط خطوات المعالج من الصفر في كل استدعاء (مثل مؤشر تقدّم التسجيل)،
  // وينقل مباشرة عند الضغط على أي خطوة — لا قفل بين الخطوات هنا لأن التحقق
  // النهائي عند النشر يفحص كل التبويبات معاً عبر Validate.isValid على النافذة كاملة.
  function renderWizardSteps() {
    var wrap = $('#pdWizardSteps');
    wrap.innerHTML = TAB_META.map(function (t, i) {
      var done = i < currentTab;
      var current = i === currentTab;
      return '<button type="button" class="pd-wstep' + (done ? ' is-done' : '') + (current ? ' is-current' : '') + '" data-step-index="' + i + '">' +
        '<span class="pd-wstep-circle">' + (done ? CHECK_ICON : (i + 1)) + '</span>' +
        '<span class="pd-wstep-label">' + t.label + '</span>' +
      '</button>';
    }).join('');

    $all('[data-step-index]', wrap).forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentTab = parseInt(btn.getAttribute('data-step-index'), 10);
        renderTabs();
      });
    });
  }

  function renderTabs() {
    renderWizardSteps();
    $all('.pd-tab-panel').forEach(function (p) { p.classList.toggle('is-active', p.getAttribute('data-panel') === TABS[currentTab]); });
    $('#pdPrevTabBtn').hidden = currentTab === 0;
    var isLast = currentTab === TABS.length - 1;
    $('#pdNextTabBtn').hidden = isLast;
    $('#pdPublishBtn').hidden = !isLast;
  }

  function collectProductFromForm() {
    var category = $('#pfCategory').value || 'tools';
    var main = modalImages.length ? modalImages[0] : (CATEGORY_IMAGES[category] || CATEGORY_IMAGES.tools);

    return {
      name: $('#pfName').value.trim() || 'منتج بدون اسم',
      category: category,
      subcategory: $('#pfSubcategory').value || '',
      brand: $('#pfBrand').value || 'عام',
      origin: $('#pfOrigin').value || '',
      warehouse: $('#pfWarehouse').value || 'مستودع الرياض الرئيسي',
      description: $('#pfDesc').value.trim(),
      attributes: collectAttributes(),

      price: parseFloat($('#pfPrice').value) || 0,
      unit: $('#pfUnit').value || 'حبة',
      vatRate: parseFloat($('#pfVatRate').value) || 15,
      vatIncluded: $('#pfVatIncluded').checked,
      specialPrice: parseFloat($('#pfSpecialPrice').value) || 0,
      specialFrom: $('#pfSpecialFrom').value || '',
      specialTo: $('#pfSpecialTo').value || '',
      tiers: collectTiers(),
      discount: 0,

      stock: parseInt($('#pfStock').value, 10) || 0,
      lowStock: parseInt($('#pfLowStock').value, 10) || 10,
      availability: $('#pfAvailability').value || 'auto',
      moq: parseInt($('#pfMoq').value, 10) || 1,
      reserved: parseInt($('#pfReserved').value, 10) || 0,

      weight: parseFloat($('#pfWeight').value) || 0,
      weightUnit: $('#pfWeightUnit').value || 'كجم',
      maxPerCustomer: parseInt($('#pfMaxPerCustomer').value, 10) || 0,
      barcode: $('#pfBarcode').value.trim(),
      sku: $('#pfSku').value.trim(),
      gtin: $('#pfGtin').value.trim(),
      mpn: $('#pfMpn').value.trim(),

      cities: selectedCities.slice(),
      images: modalImages.slice(),
      img: main,
      video: $('#pfVideo').value.trim()
    };
  }

  function saveProduct(status) {
    // المسودة تُحفظ كما هي؛ النشر يتطلب اجتياز التحقق من الحقول الإلزامية
    if (status === 'active') {
      if (!window.Validate || !Validate.isValid($('#pdModalOverlay'))) {
        // اقفز إلى التبويب الذي يحتوي أول حقل غير صالح
        var invalid = $('.is-invalid', $('#pdModalOverlay'));
        if (invalid) {
          var panel = invalid.closest('.pd-tab-panel');
          if (panel) {
            var idx = TABS.indexOf(panel.getAttribute('data-panel'));
            if (idx > -1) { currentTab = idx; renderTabs(); }
          }
        }
        toast('يرجى تصحيح الحقول المطلوبة قبل النشر', 'danger');
        return;
      }
      if (!$('#pfCategory').value) { currentTab = 0; renderTabs(); toast('اختر الفئة الرئيسية', 'danger'); return; }
      if (!$('#pfUnit').value) { currentTab = 1; renderTabs(); toast('اختر وحدة القياس', 'danger'); return; }
    }

    var data = collectProductFromForm();
    data.status = status;

    if (editingId) {
      var idx = -1;
      products.forEach(function (p, i) { if (p.id === editingId) idx = i; });
      if (idx > -1) products[idx] = Object.assign({}, products[idx], data);
    } else {
      data.id = Store.nextProductId();
      data.views = 0;
      products.push(data);
    }

    persist();
    updateStats();
    renderCurrentView();
    closeModal();
    toast(status === 'draft' ? 'تم الحفظ كمسودة' : 'تم نشر المنتج بنجاح', 'success');
  }

  function initModal() {
    $('#pdAddBtn').addEventListener('click', function () { openModal(null); });
    $('#pdModalClose').addEventListener('click', closeModal);
    $('#pdCancelBtn').addEventListener('click', closeModal);
    $('#pdModalOverlay').addEventListener('click', function (e) { if (e.target === $('#pdModalOverlay')) closeModal(); });

    $('#pdNextTabBtn').addEventListener('click', function () { currentTab = Math.min(currentTab + 1, TABS.length - 1); renderTabs(); });
    $('#pdPrevTabBtn').addEventListener('click', function () { currentTab = Math.max(currentTab - 1, 0); renderTabs(); });

    $('#pdSaveDraftBtn').addEventListener('click', function () { saveProduct('draft'); });
    $('#pdPublishBtn').addEventListener('click', function () { saveProduct('active'); });

    $('#pfDesc').addEventListener('input', function () { $('#pfDescCount').textContent = String(this.value.length); });
    $('#pfMeta').addEventListener('input', function () { $('#pfMetaCount').textContent = String(this.value.length); });

    $('#pfCategory').addEventListener('change', function () {
      renderSubcategories(this.value, '');
      renderAttributes(this.value, {});
    });

    ['#pfPrice', '#pfVatRate'].forEach(function (sel) {
      $(sel).addEventListener('input', updateVatSummary);
    });
    $('#pfVatIncluded').addEventListener('change', updateVatSummary);

    $('#pfAddTierBtn').addEventListener('click', function () {
      tiers.push({ from: '', to: '', price: '' });
      renderTiers();
    });

    initCityPicker();

    $('#pdMediaDropzone').addEventListener('click', function () { $('#pfImageInput').click(); });
    $('#pfImageInput').addEventListener('change', function () {
      handleImageFiles(this.files);
      this.value = '';
    });
  }

  /* ---------------- Import modal ---------------- */
  function closeImport() {
    $('#pdImportOverlay').hidden = true;
    importRows = [];
    $('#pdImportResult').hidden = true;
    $('#pdImportResult').innerHTML = '';
    $('#pdImportFileName').textContent = 'اضغط لاختيار ملف CSV';
    $('#pdImportConfirm').disabled = true;
  }

  function initImport() {
    $('#pdImportBtn').addEventListener('click', function () { $('#pdImportOverlay').hidden = false; });
    $('#pdImportClose').addEventListener('click', closeImport);
    $('#pdImportCancel').addEventListener('click', closeImport);
    $('#pdImportOverlay').addEventListener('click', function (e) { if (e.target === $('#pdImportOverlay')) closeImport(); });

    $('#pdTemplateBtn').addEventListener('click', downloadTemplate);
    $('#pdImportDropzone').addEventListener('click', function () { $('#pdImportInput').click(); });

    $('#pdImportInput').addEventListener('change', function () {
      if (!this.files || !this.files[0]) return;
      $('#pdImportFileName').textContent = this.files[0].name;
      handleImportFile(this.files[0]);
    });

    $('#pdImportConfirm').addEventListener('click', confirmImport);
  }

  function initCompanyName() {
    var name = null;
    try { name = localStorage.getItem('ammar_company_name'); } catch (e) { /* ignore */ }
    if (name) document.getElementById('dashCompanyName').textContent = name;
  }

  document.addEventListener('DOMContentLoaded', function () {
    load();
    initCompanyName();
    initToolbar();
    initModal();
    initImport();

    if (window.Validate) Validate.attachAll(document);

    updateStats();
    renderCurrentView();

    // أعد الرسم إذا تغيّرت البيانات من مكان آخر (طلب جديد يخصم من المخزون مثلاً)،
    // مع تجاهل كتاباتنا نحن حتى لا يُعاد بناء الصف أثناء تحريره.
    Store.subscribe(function () {
      if (localWrite) return;
      load();
      updateStats();
      renderCurrentView();
    });
  });
})();
