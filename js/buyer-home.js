(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var search = '';
  var category = '';

  function fmt(n) { return Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 }); }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, kind) { if (window.Shell) Shell.toast(msg, kind); }

  var CATEGORY_ICONS = {
    steel: '<path d="M2 12h20"/><path d="M6 8v8"/><path d="M12 6v12"/><path d="M18 8v8"/>',
    cement: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/>',
    concrete: '<rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    finishing: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18"/><path d="M12 3v18"/>',
    blocks: '<rect x="2" y="4" width="9" height="7"/><rect x="13" y="4" width="9" height="7"/><rect x="2" y="13" width="9" height="7"/><rect x="13" y="13" width="9" height="7"/>',
    tools: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'
  };

  /* ---------------- البطاقات السريعة ---------------- */
  function renderQuickCards() {
    var orders = Buyer.orders();
    var active = orders.filter(function (o) {
      return ['pending', 'processing', 'ready', 'shipping'].indexOf(o.status) !== -1;
    }).length;

    var due = Buyer.invoices().filter(function (i) {
      return i.status === 'pending' || i.status === 'overdue';
    }).length;

    var pendingReviews = Buyer.reviewableProducts().filter(function (r) { return !r.review; }).length;

    $('#bhActiveOrders').textContent = active;
    $('#bhWishCount').textContent = Buyer.wishlist().length;
    $('#bhDueInvoices').textContent = due;
    $('#bhPendingReviews').textContent = pendingReviews;
  }

  /* ---------------- العروض النشطة ---------------- */
  function renderOffers() {
    // عروض تمثيلية للمشتري — تُقرأ من نفس منطق عروض المورد عند الربط الكامل
    var offers = [
      { discount: '15%', code: 'SAVE15', title: 'خصم على الحديد والصلب', sub: 'ساري حتى نهاية الشهر', cat: 'steel' },
      { discount: '20%', code: 'FINISH20', title: 'مواد التشطيب', sub: 'على مجموعة مختارة', cat: 'finishing' },
      { discount: '10%', code: 'BULK10', title: 'خصم الكميات الكبيرة', sub: 'للطلبات فوق 5,000 ر.س', cat: '' }
    ];

    $('#offers').innerHTML =
      '<div class="an-chart-card">' +
        '<div class="an-chart-head"><div><h3>عروض نشطة الآن</h3><p>استخدم الكود عند إتمام الطلب</p></div></div>' +
        '<div class="by-offer-strip">' +
          offers.map(function (o) {
            return '<a class="by-offer" href="buyer-home.html?category=' + encodeURIComponent(o.cat) + '">' +
              '<div class="by-offer-top">' +
                '<span class="by-offer-badge">-' + esc(o.discount) + '</span>' +
                '<span class="by-offer-code">' + esc(o.code) + '</span>' +
              '</div>' +
              '<strong>' + esc(o.title) + '</strong>' +
              '<small>' + esc(o.sub) + '</small>' +
            '</a>';
          }).join('') +
        '</div>' +
      '</div>';
  }

  /* ---------------- الفئات ---------------- */
  function renderCategories() {
    var cats = Buyer.categories();

    $('#bhCategories').innerHTML = cats.map(function (c) {
      return '<button type="button" class="by-category' + (category === c.key ? ' is-active' : '') + '" data-cat="' + esc(c.key) + '">' +
        '<span class="by-category-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
          (CATEGORY_ICONS[c.key] || CATEGORY_ICONS.tools) + '</svg></span>' +
        '<span class="by-category-body"><strong>' + esc(c.label) + '</strong><small>' + c.count + ' منتج</small></span>' +
      '</button>';
    }).join('');

    $all('[data-cat]', $('#bhCategories')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-cat');
        category = (category === key) ? '' : key;
        $('#bhSearchCategory').value = category;
        render();
      });
    });
  }

  /* ---------------- المنتجات ---------------- */
  function visibleProducts() {
    var q = search.trim().toLowerCase();

    // بدون بحث أو فئة: اعرض المقترح حسب اهتمامات المشتري
    if (!q && !category) return Buyer.recommended(8);

    return Store.getProducts().filter(function (p) {
      if (p.status !== 'active') return false;
      if (category && p.category !== category) return false;
      if (q) {
        var hay = (p.name + ' ' + (p.brand || '') + ' ' + (p.subcategory || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function effectivePrice(p) {
    return p.discount > 0 ? p.price * (1 - p.discount / 100) : p.price;
  }

  function renderProducts() {
    var list = visibleProducts();
    var filtering = !!(search.trim() || category);

    $('#bhRecoTitle').textContent = filtering ? 'نتائج البحث' : 'مقترح لك';
    $('#bhRecoSub').textContent = filtering
      ? list.length + ' منتج مطابق'
      : 'بناءً على فئات مشترياتك السابقة';

    $('#bhProductsEmpty').hidden = list.length > 0;
    $('#bhProducts').hidden = list.length === 0;

    if (!list.length) return;

    $('#bhProducts').innerHTML = list.map(function (p) {
      var fav = Buyer.inWishlist(p.id);
      var eff = effectivePrice(p);
      var avail = Store.deriveAvailability(p);
      var availLabel = { in_stock: 'متوفر', limited: 'كمية محدودة', out_of_stock: 'غير متوفر', on_demand: 'عند الطلب' }[avail];

      return '<div class="pd-card">' +
        '<div class="pd-card-img-wrap">' +
          '<img class="pd-card-img" src="' + esc(p.img) + '" alt="' + esc(p.name) + '" />' +
          '<span class="pd-card-status active">' + esc(p.brand || 'عام') + '</span>' +
          '<button type="button" class="by-fav-btn' + (fav ? ' is-on' : '') + '" data-fav="' + esc(p.id) + '" aria-label="إضافة للمفضلة">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="pd-card-body">' +
          '<a class="pd-card-name" href="buyer-product.html?id=' + encodeURIComponent(p.id) + '" style="color:inherit;text-decoration:none;display:block;">' + esc(p.name) + '</a>' +
          '<div class="pd-card-tags" style="margin-top:8px;">' +
            '<span class="pd-avail ' + avail + '">' + availLabel + '</span>' +
          '</div>' +
          '<div class="pd-card-price-row">' +
            '<span class="pd-price">' + fmt(eff) + ' ر.س</span>' +
            '<span class="pd-card-sku">/ ' + esc(p.unit || 'وحدة') + '</span>' +
            (eff < p.price ? '<span class="pd-price-old">' + fmt(p.price) + '</span>' : '') +
          '</div>' +
          '<a class="btn-full" href="buyer-product.html?id=' + encodeURIComponent(p.id) + '" style="display:block;text-align:center;text-decoration:none;margin-top:6px;">عرض التفاصيل</a>' +
        '</div>' +
      '</div>';
    }).join('');

    $all('[data-fav]', $('#bhProducts')).forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var added = Buyer.toggleWishlist(btn.getAttribute('data-fav'));
        btn.classList.toggle('is-on', added);
        renderQuickCards();
        toast(added ? 'أُضيف إلى المفضلة' : 'أُزيل من المفضلة', added ? 'success' : 'danger');
      });
    });
  }

  /* ---------------- البحث ---------------- */
  function initSearch() {
    var sel = $('#bhSearchCategory');
    sel.innerHTML = '<option value="">كل الفئات</option>' +
      Buyer.categories().map(function (c) { return '<option value="' + esc(c.key) + '">' + esc(c.label) + '</option>'; }).join('');

    $('#bhSearch').addEventListener('input', function () { search = this.value; renderProducts(); });
    $('#bhSearch').addEventListener('keydown', function (e) { if (e.key === 'Enter') renderProducts(); });
    sel.addEventListener('change', function () { category = this.value; render(); });
    $('#bhSearchBtn').addEventListener('click', renderProducts);
  }

  function render() {
    renderQuickCards();
    renderCategories();
    renderProducts();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var params = new URLSearchParams(window.location.search);
    category = params.get('category') || '';

    initSearch();
    if (category) $('#bhSearchCategory').value = category;

    setTimeout(function () {
      $('#bhLoading').hidden = true;
      $('#bhContent').hidden = false;

      $('#bhGreeting').textContent = 'أهلاً بك، ' + Buyer.profile().name;

      renderOffers();
      render();

      Store.subscribe(render);
    }, 220);
  });
})();
