(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var S = Store.STATUS_META;

  var CATEGORY_LABELS = {
    steel: 'حديد وصلب', cement: 'أسمنت', concrete: 'خرسانة جاهزة',
    finishing: 'مواد تشطيب', blocks: 'طوب وبلوك', tools: 'أدوات ومعدات'
  };

  var AVAILABILITY = {
    in_stock: { label: 'متوفر', tone: 'ok' },
    limited: { label: 'كمية محدودة', tone: 'warn' },
    out_of_stock: { label: 'غير متوفر', tone: 'bad' },
    on_demand: { label: 'عند الطلب', tone: 'info' }
  };

  function fmt(n) { return Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 }); }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function row(label, value) {
    return '<div class="ord-info-row"><span>' + esc(label) + '</span><span>' + value + '</span></div>';
  }

  function render(p) {
    var avail = AVAILABILITY[Store.deriveAvailability(p)] || AVAILABILITY.in_stock;

    $('#pvName').innerHTML = esc(p.name) + ' <span class="ord-status ' + avail.tone + '" style="vertical-align:middle;">' + avail.label + '</span>';
    $('#pvSubtitle').textContent = (CATEGORY_LABELS[p.category] || p.category) +
      (p.subcategory ? ' — ' + p.subcategory : '') + ' — ' + (p.brand || 'عام');

    // إحصاءات مشتقة من الطلبات الفعلية
    var sold = 0, revenue = 0;
    var related = [];
    Store.getOrders().forEach(function (o) {
      (o.items || []).forEach(function (it) {
        if (it.productId !== p.id) return;
        related.push({ order: o, qty: it.qty });
        if (['processing', 'ready', 'shipping', 'delivered'].indexOf(o.status) !== -1) {
          sold += it.qty || 0;
          revenue += (it.price || 0) * (it.qty || 0);
        }
      });
    });

    $('#pvStock').textContent = fmt(p.stock);
    $('#pvSold').textContent = fmt(sold);
    $('#pvRevenue').textContent = fmt(revenue);
    $('#pvViews').textContent = fmt(p.views);

    // معرض الصور
    var images = (p.images && p.images.length) ? p.images : (p.img ? [p.img] : []);
    $('#pvGallery').innerHTML = images.map(function (src, i) {
      return '<div class="pd-media-item"><img src="' + esc(src) + '" alt="' + esc(p.name) + '" />' +
        (i === 0 ? '<span class="pd-media-main">رئيسية</span>' : '') + '</div>';
    }).join('');

    $('#pvInfo').innerHTML =
      row('اسم المنتج', esc(p.name)) +
      row('رمز التخزين (SKU)', '<span dir="ltr">' + esc(p.sku || '—') + '</span>') +
      (p.barcode ? row('الباركود', '<span dir="ltr">' + esc(p.barcode) + '</span>') : '') +
      (p.gtin ? row('GTIN', '<span dir="ltr">' + esc(p.gtin) + '</span>') : '') +
      (p.mpn ? row('MPN', '<span dir="ltr">' + esc(p.mpn) + '</span>') : '') +
      row('الفئة', esc(CATEGORY_LABELS[p.category] || p.category) + (p.subcategory ? ' / ' + esc(p.subcategory) : '')) +
      row('العلامة التجارية', esc(p.brand || 'عام')) +
      (p.origin ? row('بلد المنشأ', esc(p.origin)) : '') +
      row('المستودع', esc(p.warehouse || '—')) +
      row('الوزن', p.weight ? esc(p.weight + ' ' + (p.weightUnit || '')) : '—') +
      row('الحد الأدنى للطلب', esc((p.moq || 1) + ' ' + (p.unit || ''))) +
      (p.maxPerCustomer ? row('أقصى كمية لكل عميل', esc(p.maxPerCustomer)) : '') +
      (p.description ? row('الوصف', esc(p.description)) : '') +
      (p.video ? row('الفيديو', '<a class="ord-link" href="' + esc(p.video) + '" target="_blank" rel="noopener" dir="ltr">فتح الفيديو ↗</a>') : '');

    // المواصفات المخصّصة للفئة
    var attrs = p.attributes || {};
    var attrKeys = Object.keys(attrs);
    $('#pvAttrCard').hidden = attrKeys.length === 0;
    if (attrKeys.length) {
      $('#pvAttrs').innerHTML = attrKeys.map(function (k) { return row(k, esc(attrs[k])); }).join('');
    }

    // التسعير
    var vatRate = p.vatRate === undefined ? 15 : p.vatRate;
    var base = p.vatIncluded === false ? p.price : p.price / (1 + vatRate / 100);
    $('#pvPricing').innerHTML =
      row('السعر الأساسي', '<strong>' + fmt(p.price) + ' ر.س</strong> / ' + esc(p.unit || 'وحدة')) +
      row('قبل الضريبة', fmt(base) + ' ر.س') +
      row('نسبة الضريبة', vatRate + '%') +
      (p.specialPrice ? row('السعر الخاص', '<strong>' + fmt(p.specialPrice) + ' ر.س</strong>') : '') +
      (p.specialFrom || p.specialTo
        ? row('فترة العرض', '<span dir="ltr">' + esc(p.specialFrom || '—') + ' → ' + esc(p.specialTo || '—') + '</span>')
        : '') +
      row('حد تنبيه المخزون', esc(p.lowStock || 0));

    // شرائح التسعير المتدرج
    var tiers = p.tiers || [];
    $('#pvTiersCard').hidden = tiers.length === 0;
    if (tiers.length) {
      $('#pvTiers').innerHTML = tiers.map(function (t) {
        var range = t.to ? t.from + ' — ' + t.to : t.from + ' فأكثر';
        return row(range + ' ' + (p.unit || ''), '<strong>' + fmt(t.price) + ' ر.س</strong>');
      }).join('');
    }

    // المدن المدعومة
    var cities = p.cities || [];
    $('#pvCitiesCard').hidden = cities.length === 0;
    if (cities.length) {
      $('#pvCities').innerHTML = cities.map(function (c) {
        return '<span class="pd-tag">' + esc(c) + '</span>';
      }).join('');
    }

    // آخر الطلبات على المنتج — كل صف يفتح تفاصيل الطلب
    related.sort(function (a, b) { return a.order.date < b.order.date ? 1 : -1; });
    related = related.slice(0, 8);

    $('#pvNoOrders').hidden = related.length > 0;
    $('#pvOrders').innerHTML = related.map(function (r) {
      var meta = S[r.order.status] || S.pending;
      return '<tr class="ord-row" data-open="' + esc(r.order.id) + '" tabindex="0">' +
        '<td><span class="ord-id">' + esc(r.order.id) + '</span></td>' +
        '<td dir="ltr">' + esc(r.order.date) + '</td>' +
        '<td>' + esc(r.order.customer) + '</td>' +
        '<td>' + r.qty + '</td>' +
        '<td><span class="ord-status ' + meta.tone + '">' + meta.label + '</span></td>' +
      '</tr>';
    }).join('');

    Array.prototype.slice.call(document.querySelectorAll('#pvOrders [data-open]')).forEach(function (rowEl) {
      function open() { window.location.href = 'order-details.html?id=' + encodeURIComponent(rowEl.getAttribute('data-open')); }
      rowEl.addEventListener('click', open);
      rowEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });

    $('#pvEditLink').hidden = false;
  }

  function initCompanyName() {
    var name = null;
    try { name = localStorage.getItem('ammar_company_name'); } catch (e) { /* ignore */ }
    if (name) document.getElementById('dashCompanyName').textContent = name;
  }

  document.addEventListener('DOMContentLoaded', function () {
    initCompanyName();
    var id = new URLSearchParams(window.location.search).get('id') || '';

    setTimeout(function () {
      var p = Store.getProduct(id);
      $('#pvLoading').hidden = true;

      if (!p) {
        $('#pvNotFound').hidden = false;
        $('#pvSubtitle').textContent = 'المنتج غير موجود';
        return;
      }

      $('#pvContent').hidden = false;
      render(p);
    }, 220);
  });
})();
