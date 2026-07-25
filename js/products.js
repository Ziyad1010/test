(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var CATEGORY_LABELS = {
    steel: 'حديد وصلب', cement: 'أسمنت', concrete: 'خرسانة جاهزة',
    finishing: 'مواد تشطيب', blocks: 'طوب وبلوك', tools: 'أدوات ومعدات'
  };

  var STATUS_LABELS = { active: 'نشط', draft: 'مسودة', archived: 'مؤرشف' };

  var products = [
    { id: 1, name: 'حديد تسليح سعودي 12مم', sku: 'STL-RJ-012', category: 'steel', brand: 'حديد الراجحي',
      price: 2450, unit: 'طن', discount: 0, stock: 50, lowStock: 15, warehouse: 'مستودع الرياض الرئيسي',
      views: 1240, orders: 38, status: 'active', img: 'assets/images/cat-steel.jpg' },
    { id: 2, name: 'أسمنت بورتلاندي عادي (50كجم)', sku: 'CEM-YM-050', category: 'cement', brand: 'أسمنت اليمامة',
      price: 18.5, unit: 'كيس', discount: 5, stock: 8, lowStock: 15, warehouse: 'مستودع الرياض الرئيسي',
      views: 2140, orders: 96, status: 'active', img: 'assets/images/cat-cement.jpg' },
    { id: 3, name: 'خرسانة جاهزة C30', sku: 'RMX-SR-030', category: 'concrete', brand: 'الخرسانة السعودية',
      price: 245, unit: 'م³', discount: 0, stock: 999, lowStock: 0, warehouse: 'مستودع جدة',
      views: 860, orders: 21, status: 'active', img: 'assets/images/cat-concrete.jpg' },
    { id: 4, name: 'بلاط بورسلين مطفي 60×60', sku: 'TIL-SC-060', category: 'finishing', brand: 'الخزف السعودي',
      price: 42, unit: 'م²', discount: 10, stock: 320, lowStock: 30, warehouse: 'مستودع الدمام',
      views: 1580, orders: 64, status: 'active', img: 'assets/images/prod-porcelain.jpg' },
    { id: 5, name: 'طوب أسمنتي مصمت 20سم', sku: 'BLK-FZ-020', category: 'blocks', brand: 'الفوزان لمواد البناء',
      price: 3.2, unit: 'قطعة', discount: 0, stock: 0, lowStock: 500, warehouse: 'مستودع الرياض الرئيسي',
      views: 410, orders: 12, status: 'active', img: 'assets/images/cat-blocks.jpg' },
    { id: 6, name: 'خلاطة خرسانة كهربائية 350 لتر', sku: 'TL-MX-350', category: 'tools', brand: 'عام',
      price: 3850, unit: 'قطعة', discount: 0, stock: 6, lowStock: 5, warehouse: 'مستودع جدة',
      views: 320, orders: 4, status: 'active', img: 'assets/images/prod-mixer.jpg' },
    { id: 7, name: 'حديد تسليح سعودي 16مم', sku: 'STL-RJ-016', category: 'steel', brand: 'حديد الراجحي',
      price: 2520, unit: 'طن', discount: 0, stock: 22, lowStock: 15, warehouse: 'مستودع الرياض الرئيسي',
      views: 980, orders: 27, status: 'active', img: 'assets/images/cat-steel.jpg' },
    { id: 8, name: 'أسمنت مقاوم للكبريتات', sku: 'CEM-AR-SRC', category: 'cement', brand: 'أسمنت العربية',
      price: 21, unit: 'كيس', discount: 0, stock: 0, lowStock: 15, warehouse: 'مستودع الدمام',
      views: 145, orders: 0, status: 'draft', img: 'assets/images/cat-cement.jpg' }
  ];

  var nextId = 9;
  var currentView = 'grid';
  var editingId = null;
  var openMenuId = null;

  var TABS = ['basic', 'pricing', 'shipping', 'extra'];
  var currentTab = 0;

  /* ---------------- Helpers ---------------- */
  function stockState(p) {
    if (p.stock <= 0) return 'out';
    if (p.stock <= p.lowStock) return 'low';
    return 'in';
  }

  function formatPrice(n) {
    return Number(n).toLocaleString('ar-SA', { maximumFractionDigits: 2 });
  }

  function getFiltered() {
    var q = $('#pdSearch').value.trim().toLowerCase();
    var cat = $('#pdFilterCategory').value;
    var status = $('#pdFilterStatus').value;
    var stock = $('#pdFilterStock').value;

    return products.filter(function (p) {
      if (q && p.name.toLowerCase().indexOf(q) === -1 && p.sku.toLowerCase().indexOf(q) === -1) return false;
      if (cat && p.category !== cat) return false;
      if (status && p.status !== status) return false;
      if (stock && stockState(p) !== stock) return false;
      return true;
    });
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
    if (s === 'low') return '<span class="pd-stock-warn">باقي ' + p.stock + ' ' + p.unit + '</span>';
    return p.stock + ' ' + p.unit;
  }

  function renderGrid(list) {
    var grid = $('#pdGrid');
    grid.innerHTML = list.map(function (p) {
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
          '<span class="pd-card-sku">SKU: ' + p.sku + '</span>' +
          '<div class="pd-card-tags"><span class="pd-tag">' + CATEGORY_LABELS[p.category] + '</span><span class="pd-tag">' + p.brand + '</span></div>' +
          '<div class="pd-card-price-row">' +
            '<span class="pd-price">' + formatPrice(priceAfterDiscount(p)) + ' ر.س</span>' +
            (p.discount > 0 ? '<span class="pd-price-old">' + formatPrice(p.price) + '</span><span class="pd-discount-badge">-' + p.discount + '%</span>' : '') +
          '</div>' +
          '<div class="pd-card-meta"><span>' + stockLabel(p) + '</span><span>' + p.warehouse + '</span></div>' +
          '<div class="pd-card-stats">' +
            '<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>' + p.views + '</span>' +
            '<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>' + p.orders + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    bindMenuEvents(grid);
  }

  function priceAfterDiscount(p) {
    return p.discount > 0 ? p.price * (1 - p.discount / 100) : p.price;
  }

  function dropdownHtml(id) {
    var product = products.find(function (x) { return x.id === id; });
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

  /* ---------------- Table Rendering ---------------- */
  function renderTable(list) {
    var body = $('#pdTableBody');
    body.innerHTML = list.map(function (p) {
      return '<tr data-id="' + p.id + '">' +
        '<td><div class="pd-table-product"><img src="' + p.img + '" alt="' + p.name + '"/><div><div class="pd-table-product-name">' + p.name + '</div><div class="pd-table-product-sku">' + p.sku + '</div></div></div></td>' +
        '<td>' + CATEGORY_LABELS[p.category] + '</td>' +
        '<td>' + p.brand + '</td>' +
        '<td>' + formatPrice(priceAfterDiscount(p)) + ' ر.س' + (p.discount > 0 ? ' <small style="color:var(--muted);text-decoration:line-through;">' + formatPrice(p.price) + '</small>' : '') + '</td>' +
        '<td>' + stockLabel(p) + '</td>' +
        '<td>' + p.warehouse + '</td>' +
        '<td>' + p.views + '</td>' +
        '<td>' + p.orders + '</td>' +
        '<td><span class="pd-status-pill ' + p.status + '">' + STATUS_LABELS[p.status] + '</span></td>' +
        '<td><div class="pd-table-actions">' +
          '<button type="button" title="تعديل" data-action="edit" data-id="' + p.id + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg></button>' +
          '<button type="button" title="نسخ" data-action="duplicate" data-id="' + p.id + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>' +
          '<button type="button" title="حذف" data-action="delete" data-id="' + p.id + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
        '</div></td>' +
      '</tr>';
    }).join('');

    bindMenuEvents(body);
  }

  /* ---------------- Actions ---------------- */
  function handleAction(action, id) {
    var product = products.find(function (p) { return p.id === id; });
    if (!product) return;

    if (action === 'edit') {
      openModal(product);
    } else if (action === 'duplicate') {
      var copy = Object.assign({}, product, { id: nextId++, name: product.name + ' (نسخة)', sku: product.sku + '-COPY', status: 'draft' });
      products.push(copy);
    } else if (action === 'archive') {
      product.status = product.status === 'archived' ? 'active' : 'archived';
    } else if (action === 'delete') {
      if (window.confirm('هل أنت متأكد من حذف "' + product.name + '"؟ لا يمكن التراجع عن هذا الإجراء.')) {
        products = products.filter(function (p) { return p.id !== id; });
      }
    }

    openMenuId = null;
    updateStats();
    renderCurrentView();
  }

  /* ---------------- View switching / filters ---------------- */
  function renderCurrentView() {
    var list = getFiltered();
    $('#pdEmpty').hidden = list.length > 0;
    $('#pdGrid').hidden = currentView !== 'grid' || list.length === 0;
    $('#pdTableWrap').hidden = currentView !== 'table' || list.length === 0;

    if (currentView === 'grid') renderGrid(list); else renderTable(list);
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

    document.addEventListener('click', function () {
      if (openMenuId !== null) { openMenuId = null; renderCurrentView(); }
    });
  }

  /* ---------------- Modal ---------------- */
  var modalFields = {
    basic: ['pfCategory', 'pfName', 'pfOrigin', 'pfBrand', 'pfSku', 'pfBarcode', 'pfDesc'],
    pricing: ['pfPrice', 'pfDiscount', 'pfVatIncluded', 'pfMinOrder', 'pfMaxOrder', 'pfStock', 'pfReserved', 'pfLowStock', 'pfWarehouse'],
    shipping: ['pfDeliveryAvailable', 'pfShipCost', 'pfFreeThreshold', 'pfEta'],
    extra: ['pfKeywords', 'pfMeta']
  };

  function resetModalFields() {
    Object.keys(modalFields).forEach(function (tab) {
      modalFields[tab].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        if (el.type === 'checkbox') el.checked = (id === 'pfVatIncluded' || id === 'pfDeliveryAvailable');
        else el.value = '';
      });
    });
    $('#pfDescCount').textContent = '0';
    $('#pfMetaCount').textContent = '0';
  }

  function fillModalFromProduct(p) {
    $('#pfCategory').value = p.category;
    $('#pfName').value = p.name;
    $('#pfBrand').value = p.brand;
    $('#pfSku').value = p.sku;
    $('#pfDesc').value = p.description || '';
    $('#pfDescCount').textContent = String((p.description || '').length);
    $('#pfPrice').value = p.price;
    $('#pfDiscount').value = p.discount;
    $('#pfStock').value = p.stock;
    $('#pfLowStock').value = p.lowStock;
    $('#pfWarehouse').value = p.warehouse;
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

  function renderTabs() {
    $all('.pd-tab').forEach(function (t, i) { t.classList.toggle('is-active', i === currentTab); });
    $all('.pd-tab-panel').forEach(function (p) { p.classList.toggle('is-active', p.getAttribute('data-panel') === TABS[currentTab]); });
    $('#pdPrevTabBtn').hidden = currentTab === 0;
    var isLast = currentTab === TABS.length - 1;
    $('#pdNextTabBtn').hidden = isLast;
    $('#pdPublishBtn').hidden = !isLast;
  }

  function collectProductFromForm() {
    var category = $('#pfCategory').value || 'tools';
    var priceVal = parseFloat($('#pfPrice').value) || 0;
    var stockVal = parseInt($('#pfStock').value, 10) || 0;
    return {
      name: $('#pfName').value.trim() || 'منتج بدون اسم',
      sku: $('#pfSku').value.trim() || ('SKU-' + Date.now()).slice(0, 12),
      category: category,
      brand: $('#pfBrand').value || 'عام',
      description: $('#pfDesc').value.trim(),
      price: priceVal,
      discount: parseInt($('#pfDiscount').value, 10) || 0,
      stock: stockVal,
      lowStock: parseInt($('#pfLowStock').value, 10) || 10,
      warehouse: $('#pfWarehouse').value || 'مستودع الرياض الرئيسي',
      unit: 'وحدة',
      views: 0,
      orders: 0,
      img: 'assets/images/cat-' + (category === 'tools' ? 'tools' : category === 'concrete' ? 'concrete' : category === 'finishing' ? 'finishing' : category === 'blocks' ? 'blocks' : category === 'cement' ? 'cement' : 'steel') + '.jpg'
    };
  }

  function saveProduct(status) {
    var data = collectProductFromForm();
    data.status = status;

    if (editingId) {
      var idx = products.findIndex(function (p) { return p.id === editingId; });
      if (idx > -1) products[idx] = Object.assign({}, products[idx], data);
    } else {
      data.id = nextId++;
      products.push(data);
    }

    updateStats();
    renderCurrentView();
    closeModal();
  }

  function initModal() {
    $('#pdAddBtn').addEventListener('click', function () { openModal(null); });
    $('#pdModalClose').addEventListener('click', closeModal);
    $('#pdCancelBtn').addEventListener('click', closeModal);
    $('#pdModalOverlay').addEventListener('click', function (e) { if (e.target === $('#pdModalOverlay')) closeModal(); });

    $all('.pd-tab').forEach(function (tab, i) {
      tab.addEventListener('click', function () { currentTab = i; renderTabs(); });
    });
    $('#pdNextTabBtn').addEventListener('click', function () { currentTab = Math.min(currentTab + 1, TABS.length - 1); renderTabs(); });
    $('#pdPrevTabBtn').addEventListener('click', function () { currentTab = Math.max(currentTab - 1, 0); renderTabs(); });

    $('#pdSaveDraftBtn').addEventListener('click', function () { saveProduct('draft'); });
    $('#pdPublishBtn').addEventListener('click', function () { saveProduct('active'); });

    $('#pfDesc').addEventListener('input', function () { $('#pfDescCount').textContent = String($('#pfDesc').value.length); });
    $('#pfMeta').addEventListener('input', function () { $('#pfMetaCount').textContent = String($('#pfMeta').value.length); });
  }

  function initCompanyName() {
    var name = null;
    try { name = localStorage.getItem('ammar_company_name'); } catch (e) { /* ignore */ }
    if (name) document.getElementById('dashCompanyName').textContent = name;
  }

  document.addEventListener('DOMContentLoaded', function () {
    initCompanyName();
    initToolbar();
    initModal();
    updateStats();
    renderCurrentView();
  });
})();
