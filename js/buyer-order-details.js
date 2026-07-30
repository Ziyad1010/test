(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var S = Store.STATUS_META;
  var FLOW = Store.STATUS_FLOW;

  var orderId = '';
  var order = null;

  function fmt(n) { return Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 }); }

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

  function row(label, value) {
    return '<div class="ord-info-row"><span>' + esc(label) + '</span><span>' + value + '</span></div>';
  }

  function alertHtml(tone, body) {
    return '<div class="ord-alert ' + tone + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
      '<span>' + body + '</span></div>';
  }

  function renderAlerts() {
    var out = '';

    if (order.status === 'shipping' && order.tracking) {
      var carrier = Store.carrierByKey(order.tracking.carrier);
      out += alertHtml('info', '<strong>طلبك في الطريق إليك.</strong> ' +
        'شُحن عبر ' + esc(carrier ? carrier.name : '') + ' — يمكنك تتبعه من زر التتبع في الأسفل.');
    }
    if (order.status === 'delivered') {
      out += alertHtml('info', '<strong>تم تسليم طلبك.</strong> ' +
        'شاركنا رأيك في المنتجات من <a class="ord-link" href="buyer-reviews.html">صفحة التقييمات</a>.');
    }
    if (order.status === 'cancelled') {
      out += alertHtml('bad', '<strong>هذا الطلب ملغي.</strong>' +
        (order.cancelReason ? ' السبب: ' + esc(order.cancelReason) : ''));
    }

    $('#bdAlerts').innerHTML = out;
  }

  function renderItems() {
    var products = Store.getProducts();

    $('#bdItems').innerHTML = (order.items || []).map(function (it) {
      var p = null;
      products.forEach(function (x) { if (x.id === it.productId) p = x; });
      var img = p ? p.img : 'assets/images/cat-steel.jpg';

      // اسم المنتج يفتح صفحة المنتج في المتجر
      var name = p
        ? '<a class="ord-link" href="buyer-product.html?id=' + encodeURIComponent(p.id) + '">' + esc(it.name) + '</a>'
        : '<span>' + esc(it.name) + '</span>';

      return '<tr>' +
        '<td><div class="ord-item-name"><img src="' + esc(img) + '" alt="' + esc(it.name) + '" />' + name + '</div></td>' +
        '<td>' + it.qty + ' ' + esc(it.unit || '') + '</td>' +
        '<td>' + fmt(it.price) + ' ر.س</td>' +
        '<td><strong>' + fmt(it.price * it.qty) + ' ر.س</strong></td>' +
      '</tr>';
    }).join('');

    var vat = order.total * 0.15 / 1.15;
    $('#bdTotals').innerHTML =
      '<div class="ord-total-row"><span>المجموع قبل الضريبة</span><span>' + fmt(order.total - vat) + ' ر.س</span></div>' +
      '<div class="ord-total-row"><span>ضريبة القيمة المضافة (15%)</span><span>' + fmt(vat) + ' ر.س</span></div>' +
      '<div class="ord-total-row grand"><span>الإجمالي المدفوع</span><span>' + fmt(order.total) + ' ر.س</span></div>';
  }

  function renderTimeline() {
    var history = order.statusHistory || [];
    var done = {};
    history.forEach(function (h) { done[h.status] = h; });

    var steps = order.status === 'cancelled' ? ['pending', 'cancelled'] : FLOW.slice();

    $('#bdTimeline').innerHTML = steps.map(function (st) {
      var entry = done[st];
      var isBad = st === 'cancelled';
      var cls = entry
        ? (order.status === st ? (isBad ? 'is-bad' : 'is-current') : 'is-done')
        : 'is-pending';

      var icon = entry
        ? (isBad
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>')
        : '';

      // مفردات موجّهة للمشتري بدل مفردات إدارة المورد
      var LABELS = {
        pending: 'تم استلام طلبك',
        processing: 'يجهّز المورد طلبك',
        ready: 'الطلب جاهز للشحن',
        shipping: 'الطلب في الطريق إليك',
        delivered: 'تم التسليم',
        cancelled: 'أُلغي الطلب'
      };

      return '<div class="ord-tl-item ' + cls + '">' +
        '<span class="ord-tl-dot">' + icon + '</span>' +
        '<div class="ord-tl-body">' +
          '<div class="ord-tl-title">' + (LABELS[st] || st) + '</div>' +
          (entry ? '<span class="ord-tl-time">' + prettyTime(entry.at) + '</span>'
                 : '<span class="ord-tl-time">— لم يتم بعد</span>') +
        '</div>' +
      '</div>';
    }).join('');
  }

  function renderShipping() {
    var out =
      row('عنوان التوصيل', esc(order.address)) +
      row('المدينة', esc(order.city)) +
      row('تاريخ الطلب', '<span dir="ltr">' + esc(order.date) + '</span>') +
      row('الوصول المتوقع', '<span dir="ltr">' + esc(order.expectedShipDate || '—') + '</span>');

    if (order.tracking && order.tracking.number) {
      var carrier = Store.carrierByKey(order.tracking.carrier);
      var url = Store.trackingUrl(order.tracking);
      out += row('شركة الشحن', esc(carrier ? carrier.name : '—')) +
        '<div class="ord-info-row"><span>رقم التتبع</span>' +
          '<a class="ord-link" href="' + esc(url) + '" target="_blank" rel="noopener" dir="ltr">' +
          esc(order.tracking.number) + ' ↗</a></div>';
    }

    if (order.notes) out += row('ملاحظاتك', esc(order.notes));

    $('#bdShipping').innerHTML = out;
  }

  function renderPayment() {
    var PAY = {
      paid: { label: 'مدفوع', tone: 'ok' },
      pending: { label: 'بانتظار الدفع', tone: 'warn' },
      failed: { label: 'فشل الدفع', tone: 'bad' }
    };
    var pay = PAY[order.paymentStatus] || PAY.pending;

    var inv = null;
    Buyer.invoices().forEach(function (i) { if (i.orderId === order.id) inv = i; });

    $('#bdPayment').innerHTML =
      row('طريقة الدفع', esc(order.payment)) +
      row('حالة الدفع', '<span class="ord-status ' + pay.tone + '">' + pay.label + '</span>') +
      row('الإجمالي', '<strong>' + fmt(order.total) + ' ر.س</strong>') +
      (inv
        ? '<div class="ord-info-row"><span>الفاتورة</span>' +
          '<a class="ord-link" href="buyer-invoices.html?id=' + encodeURIComponent(inv.id) + '" dir="ltr">' + esc(inv.id) + '</a></div>'
        : '');
  }

  function renderActions() {
    var out = '';

    if (order.tracking && order.tracking.number) {
      out += '<a class="ord-action-btn primary" href="' + esc(Store.trackingUrl(order.tracking)) + '" target="_blank" rel="noopener" style="text-decoration:none;">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>' +
        'تتبع الشحنة</a>';
    }

    if (order.status === 'delivered') {
      out += '<a class="ord-action-btn" href="buyer-reviews.html" style="text-decoration:none;">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' +
        'تقييم المنتجات</a>';
    }

    out += '<a class="ord-action-btn" href="buyer-invoices.html" style="text-decoration:none;">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
      'عرض الفاتورة</a>';

    out += '<a class="ord-action-btn" href="messaging.html" style="text-decoration:none;">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>' +
      'التواصل مع المورد</a>';

    $('#bdActions').innerHTML = out;
  }

  function render() {
    var meta = S[order.status] || S.pending;

    $('#bdTitle').innerHTML = 'الطلب <span dir="ltr">' + esc(order.id) + '</span> ' +
      '<span class="ord-status ' + meta.tone + '" style="vertical-align:middle;">' + meta.label + '</span>';
    $('#bdSubtitle').textContent = 'أُنشئ في ' + prettyTime(order.createdAt || order.date) +
      ' — ' + (order.items || []).length + ' صنف';

    renderAlerts();
    renderItems();
    renderTimeline();
    renderShipping();
    renderPayment();
    renderActions();
  }

  document.addEventListener('DOMContentLoaded', function () {
    orderId = new URLSearchParams(window.location.search).get('id') || '';

    setTimeout(function () {
      order = Buyer.order(orderId);
      $('#bdLoading').hidden = true;

      if (!order) {
        $('#bdNotFound').hidden = false;
        $('#bdSubtitle').textContent = 'الطلب غير موجود';
        return;
      }

      $('#bdContent').hidden = false;
      render();

      Store.subscribe(function () {
        order = Buyer.order(orderId);
        if (order) render();
      });
    }, 240);
  });
})();
