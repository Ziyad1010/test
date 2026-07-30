(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var CATEGORY_LABELS = {
    steel: 'حديد وصلب', cement: 'أسمنت', concrete: 'خرسانة جاهزة',
    finishing: 'مواد تشطيب', blocks: 'طوب وبلوك', tools: 'أدوات ومعدات'
  };

  var AVAIL = {
    in_stock: { label: 'متوفر', tone: 'ok' },
    limited: { label: 'كمية محدودة', tone: 'warn' },
    out_of_stock: { label: 'غير متوفر', tone: 'bad' },
    on_demand: { label: 'عند الطلب', tone: 'info' }
  };

  var product = null;
  var draftRating = 0;

  function fmt(n) { return Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 }); }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, kind) { if (window.Shell) Shell.toast(msg, kind); }

  function row(label, value) {
    return '<div class="ord-info-row"><span>' + esc(label) + '</span><span>' + value + '</span></div>';
  }

  var STAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';

  function effectivePrice(p) {
    return p.discount > 0 ? p.price * (1 - p.discount / 100) : p.price;
  }

  function render() {
    var avail = AVAIL[Store.deriveAvailability(product)] || AVAIL.in_stock;

    $('#bpName').innerHTML = esc(product.name) +
      ' <span class="ord-status ' + avail.tone + '" style="vertical-align:middle;">' + avail.label + '</span>';
    $('#bpSubtitle').textContent = (CATEGORY_LABELS[product.category] || product.category) +
      ' — ' + (product.brand || 'عام');

    // الصور
    var images = (product.images && product.images.length) ? product.images : (product.img ? [product.img] : []);
    $('#bpGallery').innerHTML = images.map(function (src, i) {
      return '<div class="pd-media-item"><img src="' + esc(src) + '" alt="' + esc(product.name) + '" />' +
        (i === 0 ? '<span class="pd-media-main">رئيسية</span>' : '') + '</div>';
    }).join('');

    // المواصفات
    var attrs = product.attributes || {};
    $('#bpSpecs').innerHTML =
      row('العلامة التجارية', esc(product.brand || 'عام')) +
      row('الفئة', esc(CATEGORY_LABELS[product.category] || product.category) +
        (product.subcategory ? ' / ' + esc(product.subcategory) : '')) +
      (product.origin ? row('بلد المنشأ', esc(product.origin)) : '') +
      row('وحدة البيع', esc(product.unit || 'وحدة')) +
      (product.weight ? row('الوزن', esc(product.weight + ' ' + (product.weightUnit || ''))) : '') +
      Object.keys(attrs).map(function (k) { return row(k, esc(attrs[k])); }).join('') +
      (product.description ? row('الوصف', esc(product.description)) : '');

    // السعر والتوفر
    var eff = effectivePrice(product);
    $('#bpPricing').innerHTML =
      row('السعر', '<strong style="font-size:1.1rem;color:var(--primary-600);">' + fmt(eff) + ' ر.س</strong> / ' + esc(product.unit || 'وحدة')) +
      (eff < product.price
        ? row('السعر قبل الخصم', '<span style="text-decoration:line-through;color:var(--muted);">' + fmt(product.price) + ' ر.س</span>')
        : '') +
      row('التوفر', '<span class="ord-status ' + avail.tone + '">' + avail.label + '</span>') +
      row('الحد الأدنى للطلب', esc((product.moq || 1) + ' ' + (product.unit || ''))) +
      (product.warehouse ? row('يُشحن من', esc(product.warehouse)) : '');

    // الإجراءات
    var fav = Buyer.inWishlist(product.id);
    $('#bpActions').innerHTML =
      '<button type="button" class="ord-action-btn' + (fav ? '' : ' primary') + '" id="bpFavBtn">' +
        '<svg viewBox="0 0 24 24" fill="' + (fav ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
        (fav ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة') + '</button>' +
      '<a class="ord-action-btn" href="messaging.html" style="text-decoration:none;">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>' +
        'استفسار عن المنتج</a>';

    $('#bpFavBtn').addEventListener('click', function () {
      var added = Buyer.toggleWishlist(product.id);
      toast(added ? 'أُضيف إلى المفضلة' : 'أُزيل من المفضلة', added ? 'success' : 'danger');
      render();
    });

    // شرائح الكمية
    var tiers = product.tiers || [];
    $('#bpTiersCard').hidden = tiers.length === 0;
    if (tiers.length) {
      $('#bpTiers').innerHTML = tiers.map(function (t) {
        var range = t.to ? t.from + ' — ' + t.to : t.from + ' فأكثر';
        return row(range + ' ' + (product.unit || ''), '<strong>' + fmt(t.price) + ' ر.س</strong>');
      }).join('');
    }

    renderHistory();
    renderReview();
  }

  function renderHistory() {
    var bought = [];
    Buyer.orders().forEach(function (o) {
      (o.items || []).forEach(function (it) {
        if (it.productId === product.id) bought.push({ order: o, qty: it.qty });
      });
    });

    $('#bpHistoryCard').hidden = bought.length === 0;
    if (!bought.length) return;

    $('#bpHistory').innerHTML = bought.slice(0, 5).map(function (b) {
      return '<div class="ord-info-row"><span>' + b.qty + ' ' + esc(product.unit || '') + ' — ' + esc(b.order.date) + '</span>' +
        '<a class="ord-link" href="buyer-order-details.html?id=' + encodeURIComponent(b.order.id) + '" dir="ltr">' + esc(b.order.id) + '</a></div>';
    }).join('');
  }

  function renderReview() {
    // لا يمكن التقييم إلا لمنتج اشتراه المشتري ووصله فعلاً
    var canReview = Buyer.reviewableProducts().some(function (r) { return r.product.id === product.id; });
    var existing = Buyer.reviewFor(product.id);

    if (!canReview) {
      $('#bpReview').innerHTML = '<p style="font-size:0.85rem;color:var(--muted);line-height:1.8;">' +
        'يمكنك تقييم هذا المنتج بعد استلام طلب يحتوي عليه.</p>';
      return;
    }

    draftRating = existing ? existing.rating : 0;

    $('#bpReview').innerHTML =
      (existing
        ? '<div class="ord-alert info" style="margin-bottom:14px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>' +
          '<span>قيّمت هذا المنتج سابقاً — يمكنك تعديل تقييمك.</span></div>'
        : '') +
      '<div class="pd-field"><label>تقييمك</label>' +
        '<div class="by-star-input" id="bpStars">' +
          [1, 2, 3, 4, 5].map(function (n) {
            return '<button type="button" data-star="' + n + '" class="' + (n <= draftRating ? 'is-on' : '') + '" aria-label="' + n + ' نجوم">' + STAR + '</button>';
          }).join('') +
        '</div></div>' +
      '<div class="pd-field"><label for="bpComment">رأيك في المنتج</label>' +
        '<textarea id="bpComment" placeholder="ما رأيك في جودة المنتج وسرعة التوصيل؟">' + esc(existing ? existing.comment : '') + '</textarea></div>' +
      '<button type="button" class="ob-btn-primary" id="bpSaveReview">' + (existing ? 'تحديث التقييم' : 'إرسال التقييم') + '</button>';

    $all('[data-star]', $('#bpStars')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        draftRating = parseInt(btn.getAttribute('data-star'), 10);
        $all('[data-star]', $('#bpStars')).forEach(function (b) {
          b.classList.toggle('is-on', parseInt(b.getAttribute('data-star'), 10) <= draftRating);
        });
      });
    });

    $('#bpSaveReview').addEventListener('click', function () {
      if (!draftRating) { toast('اختر عدد النجوم أولاً', 'danger'); return; }
      Buyer.saveReview(product.id, draftRating, $('#bpComment').value.trim());
      toast('شكراً لك — تم حفظ تقييمك', 'success');
      renderReview();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var id = new URLSearchParams(window.location.search).get('id') || '';

    setTimeout(function () {
      product = Store.getProduct(id);
      $('#bpLoading').hidden = true;

      if (!product || product.status !== 'active') {
        $('#bpNotFound').hidden = false;
        $('#bpSubtitle').textContent = 'المنتج غير متاح';
        return;
      }

      $('#bpContent').hidden = false;
      render();
    }, 220);
  });
})();
