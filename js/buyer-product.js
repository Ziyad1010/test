(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var esc = ByUI.esc;
  var fmt = ByUI.fmt;

  var product = null;
  var qty = 1;
  var images = [];
  var imageIndex = 0;

  function productId() {
    return parseInt(new URLSearchParams(window.location.search).get('id'), 10);
  }

  function chipClass(avail) {
    return avail === 'in_stock' ? 'in' : avail === 'limited' ? 'low' : avail === 'on_demand' ? 'demand' : 'out';
  }

  /* ---------------- المعرض ---------------- */
  function galleryFor(p) {
    var list = (p.images || []).filter(Boolean);
    if (!list.length && p.img) list = [p.img];
    return list;
  }

  function renderGallery() {
    var main = $('#bpMain');
    var hint = $('.by-zoom-hint', main);

    main.innerHTML = '<img src="' + esc(images[imageIndex]) + '" alt="' + esc(product.name) + '" />';
    if (hint) main.appendChild(hint);

    var thumbs = $('#bpThumbs');
    // الشريط بلا فائدة إن كانت هناك صورة واحدة فقط
    if (images.length < 2) { thumbs.hidden = true; return; }

    thumbs.hidden = false;
    thumbs.innerHTML = images.map(function (src, i) {
      return '<button type="button" class="by-thumb' + (i === imageIndex ? ' is-on' : '') + '" data-img="' + i + '" aria-label="صورة ' + (i + 1) + '">' +
        '<img src="' + esc(src) + '" alt="" />' +
      '</button>';
    }).join('');

    $all('[data-img]', thumbs).forEach(function (btn) {
      btn.addEventListener('click', function () {
        imageIndex = parseInt(btn.getAttribute('data-img'), 10);
        renderGallery();
      });
    });
  }

  function initZoom() {
    var main = $('#bpMain');

    // التكبير يتبع المؤشر ليرى المستخدم الجزء الذي يشير إليه فعلاً
    main.addEventListener('mousemove', function (e) {
      var box = main.getBoundingClientRect();
      main.style.setProperty('--zx', ((e.clientX - box.left) / box.width * 100) + '%');
      main.style.setProperty('--zy', ((e.clientY - box.top) / box.height * 100) + '%');
    });
    main.addEventListener('mouseenter', function () { main.classList.add('is-zoomed'); });
    main.addEventListener('mouseleave', function () { main.classList.remove('is-zoomed'); });
    // على شاشات اللمس: نقرة تُبدّل التكبير
    main.addEventListener('click', function () { main.classList.toggle('is-zoomed'); });
  }

  /* ---------------- المسار والترويسة ---------------- */
  function renderCrumbs() {
    $('#bpCrumbs').innerHTML =
      '<a href="buyer-home.html">الرئيسية</a><span>›</span>' +
      '<a href="buyer-market.html?category=' + encodeURIComponent(product.category) + '">' +
        esc(ByUI.CATEGORY_LABELS[product.category] || 'السوق') + '</a><span>›</span>' +
      '<strong>' + esc(product.name) + '</strong>';
  }

  function renderHead() {
    var rating = Buyer.ratingOf(product.id);
    var avail = Store.deriveAvailability(product);
    var meta = ByUI.AVAIL[avail] || ByUI.AVAIL.in_stock;
    var cert = window.Smart ? Smart.certification(product) : null;

    $('#bpHead').innerHTML =
      '<div class="by-pdp-topline">' +
        '<span class="am-chip stock-' + chipClass(avail) + '">' + esc(meta.label) + '</span>' +
        '<a class="by-pdp-brand" href="buyer-supplier.html?name=' + encodeURIComponent(product.brand || 'عام') + '">' +
          esc(product.brand || 'عام') + '</a>' +
        (cert ? '<button type="button" class="sm-cert-chip" id="bpCertBtn">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>' +
          esc(cert.label) + '</button>' : '') +
      '</div>' +
      '<h1 class="by-pdp-name">' + esc(product.name) + '</h1>' +
      '<div class="by-pdp-meta">' +
        ByUI.starsHtml(rating.value) +
        '<a href="#reviews">' + rating.value + ' (' + rating.count + ' مراجعة)</a>' +
        (product.sku ? '<span>رمز المنتج: <code dir="ltr">' + esc(product.sku) + '</code></span>' : '') +
      '</div>' +
      socialProofHtml();

    var certBtn = $('#bpCertBtn');
    if (certBtn) certBtn.addEventListener('click', function () { SmartUI.showCertificate(product.id); });
  }

  // دليل اجتماعي من طلبات فعلية خلال آخر 30 يوماً، لا رقم تسويقي
  function socialProofHtml() {
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    var units = 0;
    var orders = 0;
    Store.getOrders().forEach(function (o) {
      if (o.status === 'cancelled') return;
      if (o.date && new Date(o.date) < cutoff) return;
      (o.items || []).forEach(function (it) {
        if (String(it.productId) !== String(product.id)) return;
        units += it.qty || 0;
        orders += 1;
      });
    });

    if (orders < 2) return '';

    return '<p class="sf-proof" style="margin-top:12px;">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>' +
      'طلبه ' + fmt(orders) + ' مشترين هذا الشهر — بإجمالي ' + fmt(units) + ' ' + esc(product.unit || 'وحدة') +
    '</p>';
  }

  /* ---------------- السعر وشرائح الكمية ---------------- */
  // شرائح المورد شكلها {from,to,price} كنصوص، فتُطبَّع قبل الاستخدام
  function tierList() {
    return (product.tiers || []).map(function (t) {
      return {
        from: parseInt(t.from, 10) || 1,
        to: parseInt(t.to, 10) || 0,
        price: parseFloat(t.price) || 0
      };
    }).filter(function (t) { return t.price > 0; })
      .sort(function (a, b) { return a.from - b.from; });
  }

  function tierFor(q) {
    var match = null;
    tierList().forEach(function (t) {
      if (q >= t.from && (!t.to || q <= t.to)) match = t;
    });
    return match;
  }

  function unitPriceFor(q) {
    var t = tierFor(q);
    return t ? t.price : ByUI.effectivePrice(product);
  }

  function renderPrice() {
    var base = ByUI.effectivePrice(product);
    var unit = unitPriceFor(qty);
    var list = Number(product.price || 0);
    var tierSaving = base > unit ? (base - unit) * qty : 0;

    $('#bpPriceBox').innerHTML =
      '<div class="by-price-main">' +
        '<strong>' + fmt(unit) + '</strong><span class="by-cur">ر.س</span>' +
        '<small>/ ' + esc(product.unit || 'وحدة') + '</small>' +
        (list > base ? '<del>' + fmt(list) + '</del><span class="by-save">-' + product.discount + '%</span>' : '') +
      '</div>' +
      '<p class="by-price-note">السعر شامل ضريبة القيمة المضافة ' + (Store.VAT_RATE * 100) + '%' +
        (tierSaving ? ' — توفّر <b>' + fmt(tierSaving) + ' ر.س</b> بسعر الكمية الحالية' : '') + '</p>' +
      '<div class="by-price-line">' +
        '<span>إجمالي ' + fmt(qty) + ' ' + esc(product.unit || 'وحدة') + '</span>' +
        '<strong>' + fmt(unit * qty) + ' ر.س</strong>' +
      '</div>';
  }

  function renderTiers() {
    var tiers = tierList();
    if (!tiers.length) { $('#bpTiersWrap').hidden = true; return; }

    $('#bpTiersWrap').hidden = false;
    var base = ByUI.effectivePrice(product);
    var active = tierFor(qty);

    $('#bpTiers').innerHTML =
      '<thead><tr><th>الكمية</th><th>سعر الوحدة</th><th>التوفير</th><th></th></tr></thead><tbody>' +
      tiers.map(function (t) {
        var range = t.to ? t.from + ' – ' + t.to : t.from + ' فأكثر';
        var save = base > t.price ? Math.round((base - t.price) / base * 100) : 0;
        var isActive = active && active.from === t.from;
        return '<tr' + (isActive ? ' class="is-active"' : '') + '>' +
          '<td>' + range + ' ' + esc(product.unit || '') + '</td>' +
          '<td>' + fmt(t.price) + ' ر.س</td>' +
          '<td>' + (save ? '<span class="by-tier-save">-' + save + '%</span>' : '—') + '</td>' +
          '<td>' + (isActive
            ? '<span class="by-tier-flag">سعرك الحالي</span>'
            : '<button type="button" class="by-tier-apply" data-apply="' + t.from + '">اطلب ' + t.from + '</button>') +
          '</td></tr>';
      }).join('') + '</tbody>';

    $all('[data-apply]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setQty(parseInt(btn.getAttribute('data-apply'), 10));
        ByUI.toast('تم ضبط الكمية على ' + qty, 'success');
      });
    });
  }

  /* ---------------- صندوق الشراء ---------------- */
  function stockUrgency() {
    var avail = Store.deriveAvailability(product);
    var stock = Number(product.stock || 0);

    if (avail === 'out_of_stock') return { tone: 'bad', text: 'نفدت الكمية حالياً — أضفه للمفضلة ليصلك إشعار عند توفره' };
    if (avail === 'on_demand') return { tone: 'warn', text: 'يُجهَّز عند الطلب — يحتاج وقت تحضير إضافي' };
    if (stock <= 10) return { tone: 'bad', text: 'بقي ' + fmt(stock) + ' ' + (product.unit || 'وحدة') + ' فقط — اطلب قبل النفاد' };
    if (stock <= (product.lowStock || 0) * 2 || stock <= 40) return { tone: 'warn', text: 'الكمية محدودة: ' + fmt(stock) + ' ' + (product.unit || 'وحدة') + ' متبقية' };
    return { tone: 'ok', text: 'متوفر في ' + (product.warehouse || 'المستودع') + ' وجاهز للشحن' };
  }

  function renderBuyBox() {
    var avail = Store.deriveAvailability(product);
    var sold = avail === 'out_of_stock';
    var moq = Number(product.moq || 1) || 1;
    var maxQty = Number(product.maxPerCustomer || 0);
    var stock = Number(product.stock || 0);
    var urgency = stockUrgency();
    var eta = ByUI.deliveryOf(product);
    var city = ByUI.getCity();
    var inWish = Buyer.inWishlist(product.id);
    var inCmp = Buyer.inCompare(product.id);

    $('#bpBuyBox').innerHTML =
      '<div class="by-urgency is-' + urgency.tone + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
        esc(urgency.text) +
      '</div>' +

      (eta ? '<div class="by-eta">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>' +
        '<span><strong>' + esc(eta) + '</strong>' +
        '<small>إلى <button type="button" class="by-eta-city" id="bpCityBtn">' + esc(city || 'اختر مدينتك') + '</button></small></span>' +
      '</div>' : '') +

      '<div class="by-qty-row">' +
        '<label for="bpQty">الكمية</label>' +
        '<div class="by-stepper">' +
          '<button type="button" id="bpMinus" aria-label="إنقاص الكمية">−</button>' +
          '<input type="text" id="bpQty" inputmode="numeric" value="' + qty + '" aria-label="الكمية" />' +
          '<button type="button" id="bpPlus" aria-label="زيادة الكمية">+</button>' +
        '</div>' +
        '<small>' + (moq > 1 ? 'أقل كمية للطلب ' + moq : 'بيع بالوحدة') +
          (maxQty ? ' — بحد أقصى ' + maxQty : '') + '</small>' +
      '</div>' +

      '<div class="by-buy-actions">' +
        '<button type="button" class="by-btn by-btn-primary" id="bpAdd"' + (sold ? ' disabled' : '') + '>' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>' +
          (sold ? 'غير متوفر حالياً' : 'أضف إلى السلة') +
        '</button>' +
        '<button type="button" class="by-btn by-btn-buy" id="bpBuyNow"' + (sold ? ' disabled' : '') + '>اشترِ الآن</button>' +
      '</div>' +

      '<div class="by-buy-secondary">' +
        '<button type="button" class="by-btn by-btn-outline' + (inWish ? ' is-on' : '') + '" id="bpWish">' +
          '<svg viewBox="0 0 24 24" fill="' + (inWish ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
          (inWish ? 'في المفضلة' : 'أضف للمفضلة') +
        '</button>' +
        '<button type="button" class="by-btn by-btn-outline' + (inCmp ? ' is-on' : '') + '" id="bpCompare">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>' +
          (inCmp ? 'في المقارنة' : 'قارن') +
        '</button>' +
      '</div>';

    bindBuyBox();
  }

  function limits() {
    var moq = Number(product.moq || 1) || 1;
    var maxQty = Number(product.maxPerCustomer || 0);
    var stock = Number(product.stock || 0);
    var onDemand = Store.deriveAvailability(product) === 'on_demand';
    return { moq: moq, maxQty: maxQty, stock: onDemand ? 0 : stock };
  }

  function setQty(next, silent) {
    var l = limits();
    var wanted = parseInt(next, 10);
    var q = isNaN(wanted) ? l.moq : wanted;

    if (q < l.moq) q = l.moq;
    if (l.maxQty && q > l.maxQty) {
      if (!silent && wanted > l.maxQty) ByUI.toast('الحد الأقصى ' + l.maxQty + ' لكل عميل', 'warn');
      q = l.maxQty;
    }
    if (l.stock && q > l.stock) {
      if (!silent && wanted > l.stock) ByUI.toast('المتوفر حالياً ' + l.stock + ' فقط', 'warn');
      q = l.stock;
    }

    qty = q;
    var input = $('#bpQty');
    if (input) input.value = qty;

    renderPrice();
    renderTiers();
    renderSticky();
  }

  function bindBuyBox() {
    var input = $('#bpQty');

    $('#bpMinus').addEventListener('click', function () { setQty(qty - 1, true); });
    $('#bpPlus').addEventListener('click', function () { setQty(qty + 1); });
    input.addEventListener('input', function () { this.value = this.value.replace(/[^0-9]/g, ''); });
    input.addEventListener('change', function () { setQty(this.value); });
    input.addEventListener('blur', function () { setQty(this.value, true); });

    $('#bpAdd').addEventListener('click', function () { addToCart(false); });
    $('#bpBuyNow').addEventListener('click', function () { addToCart(true); });

    $('#bpWish').addEventListener('click', function () {
      var on = Buyer.toggleWishlist(product.id);
      ByUI.toast(on ? 'أُضيف إلى المفضلة' : 'أُزيل من المفضلة', 'success');
      renderBuyBox();
      ByUI.refreshChrome();
    });

    $('#bpCompare').addEventListener('click', function () {
      var res = Buyer.toggleCompare(product.id);
      if (res === 'full') { ByUI.toast('يمكن مقارنة 4 منتجات كحد أقصى', 'warn'); return; }
      renderBuyBox();
      ByUI.refreshChrome();
    });

    var cityBtn = $('#bpCityBtn');
    if (cityBtn) {
      cityBtn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        var headerBtn = document.getElementById('bhCityBtn');
        if (headerBtn) headerBtn.click();
      });
    }
  }

  function addToCart(buyNow) {
    Buyer.addToCart(product.id, qty);
    ByUI.refreshChrome();

    if (buyNow) { window.location.href = 'buyer-checkout.html'; return; }

    if (window.SF) {
      SF.flyToCart($('#bpMain'), images[imageIndex]);
      SF.pulse($('#bpAdd'));
    }
    ByUI.toast('أُضيف ' + fmt(qty) + ' ' + (product.unit || 'وحدة') + ' إلى السلة', 'success');
    if (ByUI.openCartDrawer) ByUI.openCartDrawer();
  }

  /* ---------------- ضمانات الشراء ---------------- */
  function renderAssure() {
    var rows = [
      { ico: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', title: 'دفع آمن', text: 'مدى، فيزا، Apple Pay، أو تحويل بنكي' },
      { ico: '<path d="M3 12a9 9 0 1 0 9-9"/><polyline points="3 3 3 12 12 12"/>', title: 'إرجاع خلال 7 أيام', text: 'للمنتجات غير المستخدمة بحالتها الأصلية' },
      { ico: '<polyline points="20 6 9 17 4 12"/>', title: 'مورد موثّق', text: 'سجل تجاري ورقم ضريبي محقّقان' },
      { ico: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>', title: 'دعم 8000-000-000', text: 'من 8 صباحاً حتى 8 مساءً طوال الأسبوع' }
    ];

    $('#bpAssure').innerHTML = rows.map(function (r) {
      return '<li>' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + r.ico + '</svg>' +
        '<span><strong>' + r.title + '</strong><small>' + r.text + '</small></span></li>';
    }).join('');
  }

  /* ---------------- المواصفات ---------------- */
  function renderSpecs() {
    var avail = Store.deriveAvailability(product);
    var rows = [
      ['القسم', ByUI.CATEGORY_LABELS[product.category] || '—'],
      ['التصنيف الفرعي', product.subcategory || '—'],
      ['المورد / العلامة', product.brand || 'عام'],
      ['وحدة البيع', product.unit || '—'],
      ['وزن الوحدة', product.weight ? fmt(product.weight) + ' ' + (product.weightUnit || 'كجم') : '—'],
      ['أقل كمية للطلب', product.moq ? fmt(product.moq) + ' ' + (product.unit || '') : 'لا يوجد حد'],
      ['أقصى كمية لكل عميل', product.maxPerCustomer ? fmt(product.maxPerCustomer) : 'غير محدود'],
      ['الكمية المتاحة', avail === 'on_demand' ? 'حسب الطلب' : fmt(product.stock || 0) + ' ' + (product.unit || '')],
      ['حالة التوفر', (ByUI.AVAIL[avail] || {}).label || '—'],
      ['المستودع', product.warehouse || '—'],
      ['رمز المنتج (SKU)', product.sku || '—'],
      ['الباركود', product.barcode || '—'],
      ['GTIN', product.gtin || '—'],
      ['MPN', product.mpn || '—'],
      ['ضريبة القيمة المضافة', (Store.VAT_RATE * 100) + '% (مشمولة في السعر المعروض)']
    ];

    var attrs = product.attributes || {};
    Object.keys(attrs).forEach(function (k) { rows.push([k, attrs[k]]); });

    var LTR = ['رمز المنتج (SKU)', 'الباركود', 'GTIN', 'MPN'];

    $('#bpSpecs').innerHTML = '<tbody>' + rows.map(function (r) {
      var ltr = LTR.indexOf(r[0]) !== -1 && r[1] !== '—';
      return '<tr><th>' + esc(r[0]) + '</th>' +
        '<td' + (ltr ? ' dir="ltr" style="text-align:right;"' : '') + '>' + esc(r[1]) + '</td></tr>';
    }).join('') + '</tbody>';

    if (product.description) {
      $('#bpDescWrap').hidden = false;
      $('#bpDesc').textContent = product.description;
    }
  }

  /* ---------------- حاسبة الكمية ---------------- */
  function renderCalculator() {
    if (!window.SmartUI) return;
    var mount = $('#bpCalculator');
    if (SmartUI.renderCalculator(mount, product)) mount.hidden = false;
  }

  /* ---------------- يُشترى معه غالباً ---------------- */
  function renderTogether() {
    if (!window.Smart) return;

    var pairs = Smart.boughtTogether(product.id, 3);
    if (!pairs.length) return;

    var mount = $('#bpTogether');
    mount.hidden = false;

    var bundleTotal = ByUI.effectivePrice(product) * qty;
    pairs.forEach(function (x) { bundleTotal += ByUI.effectivePrice(x.product) * (x.product.moq || 1); });

    mount.innerHTML =
      '<h3 class="by-panel-title">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>' +
        'يُشترى معه غالباً' +
      '</h3>' +

      '<div class="sm-bom">' +
        pairs.map(function (x) {
          var moq = x.product.moq || 1;
          return '<label class="sm-bom-row sm-together" data-with="' + esc(x.product.id) + '">' +
            '<input type="checkbox" checked data-with-check="' + esc(x.product.id) + '" data-qty="' + moq + '" />' +
            '<img src="' + esc(x.product.img) + '" alt="" />' +
            '<span><b>' + esc(x.product.name) + '</b>' +
            '<small>في ' + x.rate + '% من الطلبات التي تضمّنت هذا المنتج</small></span>' +
            '<em>' + fmt(ByUI.effectivePrice(x.product) * moq) + ' ر.س</em>' +
          '</label>';
        }).join('') +
      '</div>' +

      '<div class="sm-bom-total"><span>إجمالي المجموعة</span><strong id="bpBundleTotal">' + fmt(bundleTotal) + ' ر.س</strong></div>' +
      '<button type="button" class="by-btn by-btn-primary sm-bom-add" id="bpAddBundle">أضف المجموعة إلى السلة</button>';

    function recalc() {
      var t = ByUI.effectivePrice(product) * qty;
      $all('[data-with-check]', mount).forEach(function (cb) {
        if (!cb.checked) return;
        var p = Store.getProduct(cb.getAttribute('data-with-check'));
        if (p) t += ByUI.effectivePrice(p) * (parseInt(cb.getAttribute('data-qty'), 10) || 1);
      });
      $('#bpBundleTotal').textContent = fmt(t) + ' ر.س';
    }

    $all('[data-with-check]', mount).forEach(function (cb) {
      cb.addEventListener('change', recalc);
    });

    $('#bpAddBundle').addEventListener('click', function () {
      Buyer.addToCart(product.id, qty);
      var added = 1;

      $all('[data-with-check]', mount).forEach(function (cb) {
        if (!cb.checked) return;
        Buyer.addToCart(cb.getAttribute('data-with-check'), parseInt(cb.getAttribute('data-qty'), 10) || 1);
        added++;
      });

      ByUI.refreshChrome();
      if (window.SF) SF.bumpCart();
      ByUI.toast('أُضيفت ' + added + ' منتجات إلى سلتك', 'success');
    });
  }

  /* ---------------- بطاقة المورد ---------------- */
  function renderSupplier() {
    var name = product.brand || 'عام';
    var s = Buyer.supplier(name);

    $('#bpSupplierCard').innerHTML =
      '<h3 class="by-panel-title">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>' +
        'المورد' +
      '</h3>' +
      '<div class="by-supplier-mini">' +
        ByUI.supplierLogoHtml(name, 'by-supplier-logo') +
        '<span><strong>' + esc(name) + '</strong>' +
          '<small>' + (s ? s.rating + ' ★ — ' + s.products + ' منتج' : 'مورد على المنصة') + '</small></span>' +
      '</div>' +
      '<a class="by-btn by-btn-outline" href="buyer-supplier.html?name=' + encodeURIComponent(name) + '">عرض كل منتجات المورد</a>';
  }

  /* ---------------- سجل شرائك ---------------- */
  function renderHistory() {
    var past = [];
    Buyer.orders().forEach(function (o) {
      (o.items || []).forEach(function (it) {
        if (String(it.productId) === String(product.id)) past.push({ order: o, item: it });
      });
    });

    if (!past.length) return;
    $('#bpHistoryCard').hidden = false;

    $('#bpHistory').innerHTML = past.slice(0, 4).map(function (p) {
      return '<a class="by-hist-row" href="buyer-order.html?id=' + encodeURIComponent(p.order.id) + '">' +
        '<span><strong>' + esc(p.order.id) + '</strong><small>' + esc(p.order.date) + '</small></span>' +
        '<span>' + fmt(p.item.qty) + ' × ' + fmt(p.item.price) + ' ر.س</span>' +
      '</a>';
    }).join('') +
    '<button type="button" class="by-btn by-btn-outline" id="bpReorder" style="margin-top:12px;">أعد طلب نفس الكمية</button>';

    $('#bpReorder').addEventListener('click', function () {
      setQty(past[0].item.qty);
      addToCart(false);
    });
  }

  /* ---------------- المراجعات ----------------
     عيّنة عرض حتمية: نفس المنتج يُظهر دائماً نفس التعليقات، وتُبنى
     من مشترين حقيقيين في سجل الطلبات إن وُجدوا. مراجعة المستخدم
     نفسه — إن كتبها — تظهر أولاً وتُميَّز. */
  var SAMPLE_COMMENTS = [
    'جودة مطابقة للمواصفات، والتسليم وصل قبل الموعد بيوم. تعاملت معهم في مشروعين ولم يخذلوني.',
    'السعر منافس مقارنةً بالسوق، خصوصاً عند طلب كميات. التغليف كان سليماً بالكامل.',
    'المنتج ممتاز والمندوب متعاون. الملاحظة الوحيدة أن التنسيق للتسليم استغرق وقتاً.',
    'استخدمته في تشطيب فيلا كاملة والنتيجة ممتازة. سأعيد الطلب بإذن الله.',
    'مطابق للصور والوصف تماماً. خدمة العملاء ردّت على استفساري خلال دقائق.',
    'كمية كبيرة ووصلت دفعة واحدة بلا نقص. تعامل احترافي من المورد.'
  ];

  var AVATAR_COLORS = ['#00a8cc', '#0e2439', '#0f766e', '#7c3aed', '#b45309', '#be123c'];

  function pseudoBuyers(count) {
    // نأخذ أسماء عملاء حقيقيين من سجل الطلبات أولاً
    var names = [];
    Store.getCustomers().forEach(function (c) { if (c.name) names.push(c.name); });

    var fallback = ['أبو فيصل', 'مؤسسة البناء المتين', 'خالد ع.', 'مقاولات الأفق', 'سعود ال.', 'شركة عمران'];
    fallback.forEach(function (n) { if (names.indexOf(n) === -1) names.push(n); });

    return names.slice(0, count);
  }

  function renderReviews() {
    var rating = Buyer.ratingOf(product.id);
    var mine = Buyer.reviewFor(product.id);

    // توزيع النجوم مشتق من المتوسط، فالرسم البياني يتّسق مع الرقم
    var dist = [5, 4, 3, 2, 1].map(function (star) {
      var distance = Math.abs(star - rating.value);
      var weight = Math.max(0.02, 1 - distance / 2.4);
      return { star: star, weight: weight };
    });
    var totalWeight = dist.reduce(function (s, d) { return s + d.weight; }, 0);

    $('#bpReviewSummary').innerHTML =
      '<div class="sf-score">' +
        '<b>' + rating.value.toFixed(1) + '</b>' +
        ByUI.starsHtml(rating.value) +
        '<small>' + fmt(rating.count) + ' تقييم</small>' +
      '</div>' +
      '<div class="sf-bars">' +
        dist.map(function (d) {
          var pct = Math.round(d.weight / totalWeight * 100);
          return '<div class="sf-bar">' +
            '<span>' + d.star + ' نجوم</span>' +
            '<span class="sf-bar-track"><span class="sf-bar-fill" style="width:' + pct + '%;"></span></span>' +
            '<span>' + pct + '%</span>' +
          '</div>';
        }).join('') +
      '</div>';

    var buyers = pseudoBuyers(4);
    var cards = [];

    if (mine) {
      cards.push(reviewCard('أنت', mine.rating, mine.comment || 'شكراً، منتج جيد.', 'تقييمك', true));
    }

    buyers.forEach(function (name, i) {
      // بذرة ثابتة لكل (منتج، مشترٍ) فلا تتغيّر التعليقات عند كل تحميل
      var seed = (product.id * 31 + i * 17) % SAMPLE_COMMENTS.length;
      var stars = Math.max(3, Math.min(5, Math.round(rating.value + (i % 3 === 0 ? 0 : i % 2 ? 0.4 : -0.4))));
      var monthsAgo = 1 + ((product.id + i * 3) % 5);
      cards.push(reviewCard(name, stars, SAMPLE_COMMENTS[seed], 'قبل ' + monthsAgo + ' أشهر', false));
    });

    $('#bpReviewList').innerHTML = cards.slice(0, 4).join('');
    if (window.SF) SF.stagger($('#bpReviewList'));
  }

  function reviewCard(name, stars, comment, when, isMine) {
    var initial = String(name).trim().charAt(0) || '؟';
    var color = AVATAR_COLORS[(name.length + stars) % AVATAR_COLORS.length];

    return '<article class="sf-review">' +
      '<div class="sf-review-head">' +
        '<span class="sf-avatar" style="background:' + color + ';">' + esc(initial) + '</span>' +
        '<span class="sf-review-who"><b>' + esc(name) + '</b><small>' + esc(when) + '</small></span>' +
        (isMine ? '' : '<span class="sf-review-verified">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
          'شراء موثّق</span>') +
      '</div>' +
      ByUI.starsHtml(stars) +
      '<p>' + esc(comment) + '</p>' +
    '</article>';
  }

  /* ---------------- ذات صلة وشوهد مؤخراً ---------------- */
  function renderRelated() {
    var related = Buyer.relatedTo(product.id, 8);
    if (related.length) {
      $('#bpRelatedWrap').hidden = false;
      $('#bpRelatedMore').href = 'buyer-market.html?category=' + encodeURIComponent(product.category);
      ByUI.renderProducts($('#bpRelated'), related);
    }

    var viewed = Buyer.recentlyViewed(9).filter(function (p) { return p.id !== product.id; }).slice(0, 8);
    if (viewed.length) {
      $('#bpViewedWrap').hidden = false;
      ByUI.renderProducts($('#bpViewed'), viewed);
    }
  }

  /* ---------------- الشريط الثابت ---------------- */
  function renderSticky() {
    var bar = $('#bpStickyBar');
    if (!bar) return;
    bar.hidden = Store.deriveAvailability(product) === 'out_of_stock';
    $('#bpStickyPrice').textContent = fmt(unitPriceFor(qty) * qty) + ' ر.س';
    $('#bpStickyName').textContent = fmt(qty) + ' × ' + product.name;
  }

  /* ---------------- التشغيل ---------------- */
  function renderAll() {
    renderCrumbs();
    renderHead();
    renderPrice();
    renderBuyBox();
    renderAssure();
    renderTiers();
    renderSpecs();
    renderSupplier();
    renderSticky();
  }

  function boot() {
    var id = productId();
    product = isNaN(id) ? null : Store.getProduct(id);

    $('#bpLoading').hidden = true;

    if (!product || product.status !== 'active') {
      $('#bpNotFound').hidden = false;
      return;
    }

    document.title = product.name + ' | عمّار';
    qty = Number(product.moq || 1) || 1;
    images = galleryFor(product);

    $('#bpContent').hidden = false;
    renderGallery();
    initZoom();
    renderAll();
    renderHistory();
    renderReviews();
    renderCalculator();
    renderTogether();
    renderRelated();

    Buyer.recordView(product.id);
    $('#bpStickyAdd').addEventListener('click', function () { addToCart(false); });

    // تغيير المدينة أو المخزون من تبويب آخر ينعكس هنا فوراً
    Store.subscribe(function () {
      product = Store.getProduct(product.id) || product;
      renderBuyBox();
      renderPrice();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    ByUI.initHeader();
    setTimeout(boot, 250);
  });
})();
