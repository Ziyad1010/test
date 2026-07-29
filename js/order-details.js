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

  // 2026-07-20T14:30 → 2026-07-20 · 14:30
  function prettyTime(s) {
    if (!s) return '—';
    var parts = String(s).split('T');
    return parts.length > 1 ? parts[0] + ' · ' + parts[1] : parts[0];
  }

  var PAY_STATUS = {
    paid: { label: 'مدفوع', tone: 'ok' },
    pending: { label: 'بانتظار الدفع', tone: 'warn' },
    failed: { label: 'فشل الدفع', tone: 'bad' }
  };

  /* ---------------- التنبيهات أعلى الصفحة ---------------- */
  function renderAlerts() {
    var out = '';

    if (order.paymentStatus === 'failed') {
      out += alertHtml('bad', '<strong>فشلت عملية الدفع لهذا الطلب.</strong> يُنصح بالتواصل مع العميل قبل التجهيز أو إلغاء الطلب.');
    }
    if (Store.isOverdue(order)) {
      out += alertHtml('warn', '<strong>هذا الطلب متأخر عن موعد الشحن المتوقع (' + esc(order.expectedShipDate) + ').</strong> سارع بتحديث حالته.');
    }
    if (Store.isStockHeld(order)) {
      out += alertHtml('warn', '<strong>الطلب معلّق على المخزون:</strong> الكمية المتاحة لأحد الأصناف أقل من المطلوب. راجع صفحة المنتجات قبل التجهيز.');
    }
    if (Store.isPartial(order)) {
      out += alertHtml('info', '<strong>تنفيذ جزئي:</strong> بعض الأصناف لم تُجهَّز بالكامل — الكميات المُجهَّزة موضحة في جدول المنتجات.');
    }
    if (order.status === 'cancelled' && order.cancelReason) {
      out += alertHtml('bad', '<strong>سبب الإلغاء:</strong> ' + esc(order.cancelReason));
    }

    $('#odAlerts').innerHTML = out;
  }

  function alertHtml(tone, body) {
    return '<div class="ord-alert ' + tone + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
      '<span>' + body + '</span></div>';
  }

  /* ---------------- الأصناف ---------------- */
  function renderItems() {
    var products = Store.getProducts();

    $('#odItems').innerHTML = (order.items || []).map(function (it) {
      var p = null;
      products.forEach(function (x) { if (x.id === it.productId) p = x; });
      var img = p ? p.img : 'assets/images/cat-steel.jpg';
      var fulfilled = it.fulfilled === undefined ? it.qty : it.fulfilled;
      var short = fulfilled < it.qty;

      // اسم المنتج يفتح صفحة تفاصيل المنتج في كتالوج البائع
      var nameCell = p
        ? '<a class="ord-link" href="product-details.html?id=' + encodeURIComponent(p.id) + '">' + esc(it.name) + '</a>'
        : '<span>' + esc(it.name) + '</span>';

      return '<tr>' +
        '<td><div class="ord-item-name"><img src="' + esc(img) + '" alt="' + esc(it.name) + '" />' + nameCell + '</div></td>' +
        '<td>' + it.qty + ' ' + esc(it.unit || '') + '</td>' +
        '<td>' + fulfilled + (short ? ' <span class="ord-flag partial">ناقص</span>' : '') + '</td>' +
        '<td>' + fmt(it.price) + ' ر.س</td>' +
        '<td><strong>' + fmt(it.price * it.qty) + ' ر.س</strong></td>' +
      '</tr>';
    }).join('');

    var vat = order.total * 0.15 / 1.15;
    var sub = order.total - vat;

    $('#odTotals').innerHTML =
      '<div class="ord-total-row"><span>المجموع قبل الضريبة</span><span>' + fmt(sub) + ' ر.س</span></div>' +
      '<div class="ord-total-row"><span>ضريبة القيمة المضافة (15%)</span><span>' + fmt(vat) + ' ر.س</span></div>' +
      '<div class="ord-total-row grand"><span>الإجمالي</span><span>' + fmt(order.total) + ' ر.س</span></div>';
  }

  /* ---------------- العميل ---------------- */
  function renderCustomer() {
    var custKey = order.customerId || order.customer;
    $('#odCustomer').innerHTML =
      '<div class="ord-info-row"><span>الاسم</span>' +
        '<a class="ord-link" href="customer.html?id=' + encodeURIComponent(custKey) + '">' + esc(order.customer) + '</a></div>' +
      '<div class="ord-info-row"><span>الجوال</span>' +
        '<a class="ord-link" href="tel:' + esc(String(order.phone).replace(/\s/g, '')) + '" dir="ltr">' + esc(order.phone) + '</a></div>' +
      (order.email
        ? '<div class="ord-info-row"><span>البريد</span><a class="ord-link" href="mailto:' + esc(order.email) + '" dir="ltr">' + esc(order.email) + '</a></div>'
        : '') +
      '<div class="ord-info-row"><span>عنوان الشحن</span><span>' + esc(order.address) + '</span></div>' +
      '<div class="ord-info-row"><span>المدينة</span><span>' + esc(order.city) + '</span></div>';
  }

  /* ---------------- الدفع والشحن ---------------- */
  function renderPayment() {
    var pay = PAY_STATUS[order.paymentStatus] || PAY_STATUS.pending;
    var out =
      '<div class="ord-info-row"><span>طريقة الدفع</span><span>' + esc(order.payment) + '</span></div>' +
      '<div class="ord-info-row"><span>حالة الدفع</span><span class="ord-status ' + pay.tone + '">' + pay.label + '</span></div>' +
      '<div class="ord-info-row"><span>تاريخ الطلب</span><span dir="ltr">' + esc(order.date) + '</span></div>' +
      '<div class="ord-info-row"><span>الشحن المتوقع</span><span dir="ltr">' + esc(order.expectedShipDate || '—') + '</span></div>';

    if (order.tracking && order.tracking.number) {
      var carrier = Store.carrierByKey(order.tracking.carrier);
      var url = Store.trackingUrl(order.tracking);
      out += '<div class="ord-info-row"><span>شركة الشحن</span><span>' + esc(carrier ? carrier.name : '—') + '</span></div>' +
        '<div class="ord-info-row"><span>رقم التتبع</span>' +
          '<a class="ord-link" href="' + esc(url) + '" target="_blank" rel="noopener" dir="ltr">' + esc(order.tracking.number) + ' ↗</a></div>';
    }

    $('#odPayment').innerHTML = out;
  }

  /* ---------------- سجل الحالة ---------------- */
  function renderTimeline() {
    var history = order.statusHistory || [];
    var done = {};
    history.forEach(function (h) { done[h.status] = h; });

    var steps;
    if (order.status === 'cancelled') steps = ['pending', 'cancelled'];
    else if (order.returnRequest) steps = FLOW.concat(['returned']);
    else steps = FLOW.slice();

    var html = steps.map(function (st) {
      var entry = done[st];
      var isBad = (st === 'cancelled' || st === 'returned');
      var cls = entry
        ? (order.status === st ? (isBad ? 'is-bad' : 'is-current') : 'is-done')
        : 'is-pending';

      var icon = entry
        ? (isBad
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>')
        : '';

      return '<div class="ord-tl-item ' + cls + '">' +
        '<span class="ord-tl-dot">' + icon + '</span>' +
        '<div class="ord-tl-body">' +
          '<div class="ord-tl-title">' + (S[st] ? S[st].label : st) + '</div>' +
          (entry
            ? '<span class="ord-tl-time">' + prettyTime(entry.at) + '</span>'
            : '<span class="ord-tl-time">— لم يتم بعد</span>') +
          (entry && entry.note ? '<div class="ord-tl-note">' + esc(entry.note) + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');

    // ملاحظات إضافية سُجّلت خارج مسار الحالات (مثل قرار الإرجاع)
    var extras = history.filter(function (h) { return h.note && steps.indexOf(h.status) === -1; });
    extras.forEach(function (h) {
      html += '<div class="ord-tl-item is-done"><span class="ord-tl-dot"></span>' +
        '<div class="ord-tl-body"><div class="ord-tl-title">ملاحظة</div>' +
        '<span class="ord-tl-time">' + prettyTime(h.at) + '</span>' +
        '<div class="ord-tl-note">' + esc(h.note) + '</div></div></div>';
    });

    $('#odTimeline').innerHTML = html;
  }

  /* ---------------- الإجراءات ---------------- */
  var NEXT_ACTION = {
    pending: { to: 'processing', label: 'بدء المعالجة' },
    processing: { to: 'ready', label: 'تعليم كجاهز للشحن' },
    ready: { to: 'shipping', label: 'شحن الطلب' },
    shipping: { to: 'delivered', label: 'تأكيد التسليم' }
  };

  function renderActions() {
    var out = '';
    var next = NEXT_ACTION[order.status];

    if (next) {
      out += '<button type="button" class="ord-action-btn primary" data-next="' + next.to + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
        next.label + '</button>';
    }

    // قائمة منسدلة لتغيير الحالة إلى أي حالة أخرى
    out += '<select class="pd-filter" id="odStatusSelect" style="width:100%;">' +
      '<option value="">تغيير الحالة يدوياً…</option>' +
      Object.keys(S).filter(function (k) { return k !== order.status; })
        .map(function (k) { return '<option value="' + k + '">' + S[k].label + '</option>'; }).join('') +
      '</select>';

    if (order.tracking && order.tracking.number) {
      out += '<button type="button" class="ord-action-btn" data-track>' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>' +
        'تعديل بيانات الشحنة</button>';
    }

    if (['delivered', 'cancelled', 'returned'].indexOf(order.status) === -1) {
      out += '<button type="button" class="ord-action-btn danger" data-cancel>' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>' +
        'إلغاء الطلب</button>';
    }

    $('#odActions').innerHTML = out;

    var sel = $('#odStatusSelect');
    if (sel) {
      sel.addEventListener('change', function () {
        if (this.value) requestStatus(this.value);
        this.value = '';
      });
    }

    var nextBtn = $('[data-next]', $('#odActions'));
    if (nextBtn) nextBtn.addEventListener('click', function () { requestStatus(nextBtn.getAttribute('data-next')); });

    var trackBtn = $('[data-track]', $('#odActions'));
    if (trackBtn) trackBtn.addEventListener('click', function () { promptTracking('shipping', true); });

    var cancelBtn = $('[data-cancel]', $('#odActions'));
    if (cancelBtn) cancelBtn.addEventListener('click', promptCancel);
  }

  /* ---------------- الإرجاع ---------------- */
  function renderReturn() {
    var r = order.returnRequest;
    $('#odReturnCard').hidden = !r;
    if (!r) return;

    var badge = r.status === 'approved' ? '<span class="ord-status ok">تمت الموافقة</span>'
      : r.status === 'rejected' ? '<span class="ord-status bad">مرفوض</span>'
      : '<span class="ord-status warn">بانتظار القرار</span>';

    var html = '<div class="ord-info-list">' +
      '<div class="ord-info-row"><span>الحالة</span><span>' + badge + '</span></div>' +
      '<div class="ord-info-row"><span>تاريخ الطلب</span><span dir="ltr">' + prettyTime(r.at) + '</span></div>' +
      '<div class="ord-info-row"><span>سبب الإرجاع</span><span>' + esc(r.reason) + '</span></div>' +
      (r.decision ? '<div class="ord-info-row"><span>سبب القرار</span><span>' + esc(r.decision) + '</span></div>' : '') +
      '</div>';

    if (r.status === 'pending') {
      html += '<div class="ord-actions" style="margin-top:14px;">' +
        '<button type="button" class="ord-action-btn primary" data-ret="approved">الموافقة على الإرجاع</button>' +
        '<button type="button" class="ord-action-btn danger" data-ret="rejected">رفض الإرجاع</button>' +
        '</div>';
    }

    $('#odReturn').innerHTML = html;

    $all('[data-ret]', $('#odReturn')).forEach(function (btn) {
      btn.addEventListener('click', function () { promptReturnDecision(btn.getAttribute('data-ret')); });
    });
  }

  /* ---------------- النوافذ المنبثقة ---------------- */
  var promptConfirmHandler = null;

  function openPrompt(title, bodyHtml, onConfirm) {
    $('#odPromptTitle').textContent = title;
    $('#odPromptBody').innerHTML = bodyHtml;
    promptConfirmHandler = onConfirm;
    $('#odPromptOverlay').hidden = false;
  }

  function closePrompt() {
    $('#odPromptOverlay').hidden = true;
    promptConfirmHandler = null;
  }

  var CANCEL_REASONS = [
    'نفاذ الكمية من المخزون',
    'مشكلة في التسعير',
    'تعذّر التواصل مع العميل',
    'العنوان خارج نطاق التوصيل',
    'بناءً على طلب العميل'
  ];

  function promptCancel() {
    openPrompt('إلغاء الطلب ' + order.id,
      '<div class="pd-field"><label for="odCancelReason">سبب الإلغاء <em>*</em></label>' +
        '<select id="odCancelReason"><option value="">اختر السبب</option>' +
        CANCEL_REASONS.map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('') +
        '<option value="__other">سبب آخر…</option></select>' +
        '<span class="field-error" id="odCancelError"></span></div>' +
      '<div class="pd-field" id="odCancelOtherWrap" hidden>' +
        '<label for="odCancelOther">اكتب السبب</label>' +
        '<input type="text" id="odCancelOther" placeholder="وضّح سبب الإلغاء" /></div>' +
      '<p style="font-size:0.82rem;color:var(--muted);line-height:1.7;">سيُحفظ السبب في سجل الطلب ويُشعَر به العميل.</p>',
      function () {
        var sel = $('#odCancelReason');
        var reason = sel.value === '__other' ? $('#odCancelOther').value.trim() : sel.value;
        if (!reason) {
          $('#odCancelError').textContent = 'يجب اختيار سبب الإلغاء';
          return false;
        }
        Store.setOrderStatus(order.id, 'cancelled', { reason: reason, note: 'سبب الإلغاء: ' + reason });
        toast('تم إلغاء الطلب وإشعار العميل', 'danger');
        return true;
      });

    $('#odCancelReason').addEventListener('change', function () {
      $('#odCancelOtherWrap').hidden = this.value !== '__other';
    });
  }

  function promptTracking(targetStatus, editOnly) {
    var current = order.tracking || { carrier: '', number: '' };

    openPrompt(editOnly ? 'تعديل بيانات الشحنة' : 'شحن الطلب ' + order.id,
      '<div class="pd-field"><label for="odCarrier">شركة الشحن <em>*</em></label>' +
        '<select id="odCarrier"><option value="">اختر شركة الشحن</option>' +
        Store.CARRIERS.map(function (c) {
          return '<option value="' + c.key + '"' + (c.key === current.carrier ? ' selected' : '') + '>' + esc(c.name) + '</option>';
        }).join('') + '</select></div>' +
      '<div class="pd-field"><label for="odTrackNo">رقم تتبع الشحنة <em>*</em></label>' +
        '<input type="text" id="odTrackNo" dir="ltr" placeholder="123456789" value="' + esc(current.number) + '" />' +
        '<span class="field-error" id="odTrackError"></span></div>' +
      '<p style="font-size:0.82rem;color:var(--muted);line-height:1.7;">سيتم توليد رابط تتبع قابل للنقر يوجّه العميل مباشرة إلى صفحة التتبع لدى شركة الشحن.</p>',
      function () {
        var carrier = $('#odCarrier').value;
        var number = $('#odTrackNo').value.trim();
        if (!carrier || !number) {
          $('#odTrackError').textContent = 'يجب اختيار شركة الشحن وإدخال رقم التتبع';
          return false;
        }
        if (editOnly) {
          Store.setTracking(order.id, carrier, number);
          toast('تم تحديث بيانات الشحنة', 'success');
        } else {
          Store.setOrderStatus(order.id, targetStatus, {
            tracking: { carrier: carrier, number: number },
            note: 'رقم التتبع: ' + number
          });
          toast('تم شحن الطلب وإشعار العميل برقم التتبع', 'success');
        }
        return true;
      });
  }

  function promptReturnDecision(decision) {
    var approving = decision === 'approved';
    openPrompt(approving ? 'الموافقة على الإرجاع' : 'رفض طلب الإرجاع',
      '<div class="pd-field"><label for="odRetReason">' + (approving ? 'ملاحظة للعميل (اختياري)' : 'سبب الرفض') + (approving ? '' : ' <em>*</em>') + '</label>' +
        '<textarea id="odRetReason" placeholder="' + (approving ? 'مثال: سيتم استلام المنتج خلال 3 أيام عمل' : 'وضّح سبب رفض الإرجاع') + '"></textarea>' +
        '<span class="field-error" id="odRetError"></span></div>',
      function () {
        var reason = $('#odRetReason').value.trim();
        if (!approving && !reason) {
          $('#odRetError').textContent = 'يجب توضيح سبب الرفض';
          return false;
        }
        Store.decideReturn(order.id, decision, reason);
        toast(approving ? 'تمت الموافقة على الإرجاع' : 'تم رفض طلب الإرجاع', approving ? 'success' : 'danger');
        return true;
      });
  }

  function requestStatus(status) {
    // الانتقال إلى "قيد التوصيل" يتطلب بيانات الشحنة أولاً
    if (status === 'shipping') { promptTracking('shipping', false); return; }
    if (status === 'cancelled') { promptCancel(); return; }

    Store.setOrderStatus(order.id, status, {});
    toast('تم تحديث الحالة إلى «' + S[status].label + '» وإشعار العميل', 'success');
    reload();
  }

  /* ---------------- الطباعة ---------------- */
  function printInvoice() {
    var company = 'شركتك';
    try { company = localStorage.getItem('ammar_company_name') || company; } catch (e) { /* ignore */ }

    var rows = (order.items || []).map(function (it) {
      return '<tr><td>' + esc(it.name) + '</td><td>' + it.qty + '</td><td>' + fmt(it.price) + '</td><td>' + fmt(it.price * it.qty) + '</td></tr>';
    }).join('');
    var vat = order.total * 0.15 / 1.15;

    var win = window.open('', '_blank');
    if (!win) { toast('تعذّر فتح نافذة الطباعة', 'danger'); return; }
    win.document.write('<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8" /><title>فاتورة ' + esc(order.id) + '</title>' +
      '<style>body{font-family:"IBM Plex Sans Arabic",Tahoma,sans-serif;padding:28px;color:#0f172a;}' +
      'h1{font-size:1.25rem;margin:0 0 4px;}.muted{color:#64748b;font-size:0.86rem;line-height:1.8;}' +
      'table{width:100%;border-collapse:collapse;margin-top:16px;}' +
      'th,td{border-bottom:1px solid #e2e8f0;padding:9px;text-align:right;font-size:0.86rem;}' +
      'th{background:#f8fafc;color:#64748b;}.tot{text-align:left;font-weight:800;margin-top:12px;}</style></head><body>' +
      '<h1>فاتورة ضريبية</h1><div class="muted">المورد: ' + esc(company) + '</div>' +
      '<h2>الطلب ' + esc(order.id) + '</h2>' +
      '<div class="muted">العميل: ' + esc(order.customer) + ' — ' + esc(order.phone) + '<br />' +
      'العنوان: ' + esc(order.address) + '<br />التاريخ: ' + esc(order.date) + ' — الدفع: ' + esc(order.payment) + '</div>' +
      '<table><thead><tr><th>الصنف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="tot">الإجمالي شامل الضريبة: ' + fmt(order.total) + ' ر.س</div>' +
      '<div class="muted tot">منها ضريبة القيمة المضافة (15%): ' + fmt(vat) + ' ر.س</div>' +
      '</body></html>');
    win.document.close();
    win.focus();
    setTimeout(function () { win.print(); }, 300);
  }

  /* ---------------- العرض ---------------- */
  function render() {
    var meta = S[order.status] || S.pending;

    $('#odTitle').innerHTML = 'الطلب <span dir="ltr">' + esc(order.id) + '</span> ' +
      '<span class="ord-status ' + meta.tone + '" style="vertical-align:middle;">' + meta.label + '</span>';
    $('#odSubtitle').textContent = 'أُنشئ في ' + prettyTime(order.createdAt || order.date) + ' — ' + (order.items || []).length + ' صنف';

    renderAlerts();
    renderItems();
    renderCustomer();
    renderPayment();
    renderTimeline();
    renderActions();
    renderReturn();

    $('#odNotesCard').hidden = !order.notes;
    if (order.notes) $('#odNotes').textContent = order.notes;

    $('#odPrintBtn').hidden = false;
  }

  function reload() {
    order = Store.getOrder(orderId);
    if (order) render();
  }

  function initCompanyName() {
    var name = null;
    try { name = localStorage.getItem('ammar_company_name'); } catch (e) { /* ignore */ }
    if (name) document.getElementById('dashCompanyName').textContent = name;
  }

  document.addEventListener('DOMContentLoaded', function () {
    initCompanyName();

    orderId = new URLSearchParams(window.location.search).get('id') || '';

    $('#odPromptClose').addEventListener('click', closePrompt);
    $('#odPromptCancel').addEventListener('click', closePrompt);
    $('#odPromptOverlay').addEventListener('click', function (e) {
      if (e.target === $('#odPromptOverlay')) closePrompt();
    });
    $('#odPromptConfirm').addEventListener('click', function () {
      if (!promptConfirmHandler) return;
      // المُعالج يُرجع false لإبقاء النافذة مفتوحة عند وجود خطأ تحقق
      if (promptConfirmHandler() !== false) {
        closePrompt();
        reload();
      }
    });
    $('#odPrintBtn').addEventListener('click', printInvoice);

    setTimeout(function () {
      order = Store.getOrder(orderId);
      $('#odLoading').hidden = true;

      if (!order) {
        $('#odNotFound').hidden = false;
        $('#odSubtitle').textContent = 'الطلب غير موجود';
        return;
      }

      // فتح الطلب يعني أن البائع اطّلع عليه — تختفي شارة "جديد"
      Store.markOrderSeen(order.id);
      $('#odContent').hidden = false;
      render();

      Store.subscribe(reload);
    }, 240);
  });
})();
