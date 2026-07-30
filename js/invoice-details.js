(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var S = Store.INVOICE_STATUS;
  var invoiceId = '';
  var invoice = null;

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

  /* ---------------- التنبيهات ---------------- */
  function renderAlerts() {
    var out = '';

    if (invoice.status === 'overdue') {
      var daysLate = Math.round((new Date() - new Date(invoice.due)) / 86400000);
      out += alertHtml('bad', '<strong>هذه الفاتورة متأخرة عن موعد الاستحقاق بـ ' + daysLate + ' يوم.</strong> ' +
        'يمكنك إرسال تذكير للعميل من قائمة الإجراءات.');
    }
    if (invoice.status === 'cancelled') {
      out += alertHtml('bad', '<strong>هذه الفاتورة ملغاة.</strong>' +
        (invoice.cancelReason ? ' السبب: ' + esc(invoice.cancelReason) : ''));
    }
    if (invoice.creditTotal > 0) {
      out += alertHtml('info', '<strong>صدرت إشعارات دائنة بقيمة ' + fmt(invoice.creditTotal) + ' ر.س</strong> ' +
        'على هذه الفاتورة — الصافي المستحق ' + fmt(invoice.netAmount) + ' ر.س.');
    }

    $('#ivAlerts').innerHTML = out;
  }

  function alertHtml(tone, body) {
    return '<div class="ord-alert ' + tone + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
      '<span>' + body + '</span></div>';
  }

  /* ---------------- البنود ---------------- */
  function renderItems() {
    var products = Store.getProducts();

    $('#ivItems').innerHTML = (invoice.items || []).map(function (it) {
      var exists = null;
      products.forEach(function (p) { if (p.id === it.productId) exists = p; });

      var name = exists
        ? '<a class="ord-link" href="product-details.html?id=' + encodeURIComponent(exists.id) + '">' + esc(it.name) + '</a>'
        : '<span>' + esc(it.name) + '</span>';

      return '<tr>' +
        '<td>' + name + '</td>' +
        '<td>' + it.qty + ' ' + esc(it.unit || '') + '</td>' +
        '<td>' + fmt(it.price) + ' ر.س</td>' +
        '<td><strong>' + fmt(it.price * it.qty) + ' ر.س</strong></td>' +
      '</tr>';
    }).join('');

    var rate = Store.VAT_RATE;
    var vat = invoice.amount * rate / (1 + rate);
    var sub = invoice.amount - vat;

    var totals =
      '<div class="ord-total-row"><span>المجموع قبل الضريبة</span><span>' + fmt(sub) + ' ر.س</span></div>' +
      '<div class="ord-total-row"><span>ضريبة القيمة المضافة (' + Math.round(rate * 100) + '%)</span><span>' + fmt(vat) + ' ر.س</span></div>';

    if (invoice.creditTotal > 0) {
      totals += '<div class="ord-total-row"><span>إشعارات دائنة</span><span style="color:var(--danger);">-' + fmt(invoice.creditTotal) + ' ر.س</span></div>';
    }
    totals += '<div class="ord-total-row grand"><span>الصافي المستحق</span><span>' + fmt(invoice.netAmount) + ' ر.س</span></div>';

    $('#ivTotals').innerHTML = totals;
  }

  /* ---------------- الإشعارات الدائنة ---------------- */
  function renderCreditNotes() {
    var notes = invoice.creditNotes || [];
    $('#ivCreditCard').hidden = notes.length === 0;
    if (!notes.length) return;

    $('#ivCreditNotes').innerHTML = notes.map(function (c) {
      return '<tr>' +
        '<td><span class="ord-id">' + esc(c.id) + '</span></td>' +
        '<td dir="ltr">' + prettyTime(c.at) + '</td>' +
        '<td>' + esc(c.reason || '—') + '</td>' +
        '<td><strong style="color:var(--danger);">-' + fmt(c.amount) + ' ر.س</strong></td>' +
      '</tr>';
    }).join('');
  }

  function renderReminders() {
    var reminders = invoice.reminders || [];
    $('#ivRemindersCard').hidden = reminders.length === 0;
    if (!reminders.length) return;

    $('#ivReminders').innerHTML = reminders.map(function (r, i) {
      return row('التذكير ' + (i + 1), '<span dir="ltr">' + prettyTime(r.at) + '</span>');
    }).join('');
  }

  /* ---------------- العميل والبيانات ---------------- */
  function renderCustomer() {
    $('#ivCustomer').innerHTML =
      '<div class="ord-info-row"><span>الاسم</span>' +
        '<a class="ord-link" href="customer.html?id=' + encodeURIComponent(invoice.customerId) + '">' + esc(invoice.customer) + '</a></div>' +
      (invoice.phone
        ? '<div class="ord-info-row"><span>الجوال</span><a class="ord-link" href="tel:' + esc(String(invoice.phone).replace(/\s/g, '')) + '" dir="ltr">' + esc(invoice.phone) + '</a></div>'
        : '') +
      (invoice.email
        ? '<div class="ord-info-row"><span>البريد</span><a class="ord-link" href="mailto:' + esc(invoice.email) + '" dir="ltr">' + esc(invoice.email) + '</a></div>'
        : '') +
      row('الرقم الضريبي', '<span dir="ltr">' + esc(invoice.taxNo) + '</span>') +
      row('العنوان', esc(invoice.address || '—'));
  }

  function renderMeta() {
    var meta = S[invoice.status] || S.pending;
    $('#ivMeta').innerHTML =
      row('حالة الدفع', '<span class="ord-status ' + meta.tone + '">' + meta.label + '</span>') +
      '<div class="ord-info-row"><span>الطلب المرتبط</span>' +
        '<a class="ord-link" href="order-details.html?id=' + encodeURIComponent(invoice.orderId) + '" dir="ltr">' + esc(invoice.orderId) + '</a></div>' +
      row('تاريخ الإصدار', '<span dir="ltr">' + esc(invoice.issue) + '</span>') +
      row('تاريخ الاستحقاق', '<span dir="ltr">' + esc(invoice.due) + '</span>') +
      row('طريقة الدفع', esc(invoice.payment || '—')) +
      row('أُرسلت للعميل', '<span dir="ltr">' + prettyTime(invoice.sentAt) + '</span>');
  }

  /* ---------------- الإجراءات ---------------- */
  function renderActions() {
    var out = '';

    out += '<button type="button" class="ord-action-btn primary" data-act="print">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>' +
      'تنزيل / طباعة PDF</button>';

    if (invoice.status === 'pending' || invoice.status === 'overdue') {
      out += '<button type="button" class="ord-action-btn" data-act="paid">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
        'تعليم كمدفوعة</button>';

      out += '<button type="button" class="ord-action-btn" data-act="remind">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' +
        'إرسال تذكير للعميل</button>';
    }

    if (invoice.status !== 'cancelled') {
      out += '<button type="button" class="ord-action-btn" data-act="credit">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>' +
        'إصدار إشعار دائن</button>';

      out += '<button type="button" class="ord-action-btn danger" data-act="cancel">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>' +
        'إلغاء الفاتورة</button>';
    }

    $('#ivActions').innerHTML = out;

    $all('[data-act]', $('#ivActions')).forEach(function (btn) {
      btn.addEventListener('click', function () { handleAction(btn.getAttribute('data-act')); });
    });
  }

  function handleAction(act) {
    if (act === 'print') { printInvoice(); return; }

    if (act === 'paid') {
      if (!window.confirm('تأكيد استلام قيمة الفاتورة ' + invoice.id + '؟')) return;
      Store.markInvoicePaid(invoice.id);
      toast('تم تعليم الفاتورة كمدفوعة', 'success');
      reload();
      return;
    }

    if (act === 'remind') {
      Store.remindInvoice(invoice.id);
      toast('تم تسجيل تذكير للعميل «' + invoice.customer + '»', 'success');
      reload();
      return;
    }

    if (act === 'credit') { promptCreditNote(); return; }
    if (act === 'cancel') { promptCancel(); return; }
  }

  /* ---------------- النوافذ ---------------- */
  var promptHandler = null;

  function openPrompt(title, body, onConfirm) {
    $('#ivPromptTitle').textContent = title;
    $('#ivPromptBody').innerHTML = body;
    promptHandler = onConfirm;
    $('#ivPromptOverlay').hidden = false;
  }

  function closePrompt() {
    $('#ivPromptOverlay').hidden = true;
    promptHandler = null;
  }

  var CREDIT_REASONS = [
    'استرجاع كامل للطلب',
    'استرجاع جزئي لبعض الأصناف',
    'إلغاء جزئي لعدم توفر الكمية',
    'خصم تسوية تجارية',
    'خطأ في التسعير'
  ];

  function promptCreditNote() {
    var maxAmount = invoice.netAmount;

    openPrompt('إصدار إشعار دائن — ' + invoice.id,
      '<p style="font-size:0.83rem;color:var(--muted);line-height:1.7;margin-bottom:14px;">' +
        'الصافي المستحق حالياً <strong>' + fmt(maxAmount) + ' ر.س</strong>. ' +
        'الإشعار الدائن يخصم من قيمة الفاتورة عند الاسترجاع أو الإلغاء الجزئي.</p>' +
      '<div class="pd-field"><label for="ivCreditAmount">قيمة الإشعار الدائن (ر.س) <em>*</em></label>' +
        '<input type="text" id="ivCreditAmount" inputmode="decimal" dir="ltr" placeholder="0.00" />' +
        '<span class="field-error" id="ivCreditError"></span></div>' +
      '<div class="pd-field"><label for="ivCreditReason">سبب الإصدار <em>*</em></label>' +
        '<select id="ivCreditReason"><option value="">اختر السبب</option>' +
        CREDIT_REASONS.map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('') +
        '<option value="__other">سبب آخر…</option></select></div>' +
      '<div class="pd-field" id="ivCreditOtherWrap" hidden>' +
        '<label for="ivCreditOther">اكتب السبب</label>' +
        '<input type="text" id="ivCreditOther" placeholder="وضّح سبب الإشعار الدائن" /></div>',
      function () {
        var amount = parseFloat($('#ivCreditAmount').value);
        var sel = $('#ivCreditReason');
        var reason = sel.value === '__other' ? $('#ivCreditOther').value.trim() : sel.value;

        if (isNaN(amount) || amount <= 0) {
          $('#ivCreditError').textContent = 'أدخل قيمة صحيحة أكبر من صفر';
          return false;
        }
        if (amount > maxAmount) {
          $('#ivCreditError').textContent = 'القيمة تتجاوز الصافي المستحق (' + fmt(maxAmount) + ' ر.س)';
          return false;
        }
        if (!reason) {
          $('#ivCreditError').textContent = 'يجب اختيار سبب الإصدار';
          return false;
        }

        Store.addCreditNote(invoice.id, amount, reason);
        toast('تم إصدار إشعار دائن بقيمة ' + fmt(amount) + ' ر.س', 'success');
        return true;
      });

    $('#ivCreditAmount').addEventListener('input', function () {
      this.value = this.value.replace(/[^0-9.]/g, '');
    });
    $('#ivCreditReason').addEventListener('change', function () {
      $('#ivCreditOtherWrap').hidden = this.value !== '__other';
    });
  }

  function promptCancel() {
    openPrompt('إلغاء الفاتورة ' + invoice.id,
      '<div class="pd-field"><label for="ivCancelReason">سبب الإلغاء <em>*</em></label>' +
        '<textarea id="ivCancelReason" placeholder="وضّح سبب إلغاء الفاتورة"></textarea>' +
        '<span class="field-error" id="ivCancelError"></span></div>' +
      '<p style="font-size:0.82rem;color:var(--muted);line-height:1.7;">سيُحفظ السبب مع الفاتورة ولن تُحتسب ضمن المستحقات.</p>',
      function () {
        var reason = $('#ivCancelReason').value.trim();
        if (!reason) { $('#ivCancelError').textContent = 'يجب توضيح سبب الإلغاء'; return false; }
        Store.cancelInvoice(invoice.id, reason);
        toast('تم إلغاء الفاتورة', 'danger');
        return true;
      });
  }

  /* ---------------- الطباعة ---------------- */
  function printInvoice() {
    var company = 'شركتك';
    try { company = localStorage.getItem('ammar_company_name') || company; } catch (e) { /* ignore */ }

    var rows = (invoice.items || []).map(function (it) {
      return '<tr><td>' + esc(it.name) + '</td><td>' + it.qty + ' ' + esc(it.unit || '') + '</td>' +
        '<td>' + fmt(it.price) + '</td><td>' + fmt(it.price * it.qty) + '</td></tr>';
    }).join('');

    var rate = Store.VAT_RATE;
    var vat = invoice.amount * rate / (1 + rate);
    var sub = invoice.amount - vat;

    var creditRows = (invoice.creditNotes || []).map(function (c) {
      return '<tr><td colspan="3">إشعار دائن ' + esc(c.id) + ' — ' + esc(c.reason) + '</td><td>-' + fmt(c.amount) + '</td></tr>';
    }).join('');

    var win = window.open('', '_blank');
    if (!win) { toast('تعذّر فتح نافذة الطباعة — يرجى السماح بالنوافذ المنبثقة', 'danger'); return; }

    win.document.write('<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8" />' +
      '<title>فاتورة ' + esc(invoice.id) + '</title>' +
      '<style>body{font-family:"IBM Plex Sans Arabic",Tahoma,sans-serif;padding:34px;color:#0f172a;}' +
      '.head{display:flex;justify-content:space-between;border-bottom:2px solid #0f172a;padding-bottom:14px;margin-bottom:20px;}' +
      'h1{font-size:1.3rem;margin:0 0 4px;}.muted{color:#64748b;font-size:0.85rem;line-height:1.8;}' +
      'table{width:100%;border-collapse:collapse;margin-top:16px;}' +
      'th,td{border-bottom:1px solid #e2e8f0;padding:9px;text-align:right;font-size:0.86rem;}' +
      'th{background:#f8fafc;color:#64748b;}' +
      '.totals{margin-top:18px;width:300px;margin-inline-start:auto;}' +
      '.totals div{display:flex;justify-content:space-between;padding:6px 0;font-size:0.88rem;}' +
      '.totals .grand{font-weight:800;font-size:1.05rem;border-top:2px solid #0f172a;padding-top:10px;}</style></head><body>' +
      '<div class="head"><div><h1>فاتورة ضريبية</h1><div class="muted">' + esc(company) + '</div></div>' +
      '<div style="text-align:left;"><div><strong>' + esc(invoice.id) + '</strong></div>' +
      '<div class="muted">الإصدار: ' + esc(invoice.issue) + '<br />الاستحقاق: ' + esc(invoice.due) + '</div></div></div>' +
      '<div class="muted"><strong>العميل:</strong> ' + esc(invoice.customer) + ' — الرقم الضريبي: ' + esc(invoice.taxNo) +
      '<br />العنوان: ' + esc(invoice.address) + '<br />الطلب المرتبط: ' + esc(invoice.orderId) + ' — الدفع: ' + esc(invoice.payment) + '</div>' +
      '<table><thead><tr><th>البند</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>' +
      '<tbody>' + rows + creditRows + '</tbody></table>' +
      '<div class="totals">' +
        '<div><span>المجموع قبل الضريبة</span><span>' + fmt(sub) + ' ر.س</span></div>' +
        '<div><span>ضريبة القيمة المضافة (' + Math.round(rate * 100) + '%)</span><span>' + fmt(vat) + ' ر.س</span></div>' +
        (invoice.creditTotal > 0 ? '<div><span>إشعارات دائنة</span><span>-' + fmt(invoice.creditTotal) + ' ر.س</span></div>' : '') +
        '<div class="grand"><span>الصافي المستحق</span><span>' + fmt(invoice.netAmount) + ' ر.س</span></div>' +
      '</div></body></html>');
    win.document.close();
    win.focus();
    setTimeout(function () { win.print(); }, 300);
  }

  /* ---------------- العرض ---------------- */
  function render() {
    var meta = S[invoice.status] || S.pending;

    $('#ivTitle').innerHTML = 'الفاتورة <span dir="ltr">' + esc(invoice.id) + '</span> ' +
      '<span class="ord-status ' + meta.tone + '" style="vertical-align:middle;">' + meta.label + '</span>';
    $('#ivSubtitle').textContent = 'صادرة في ' + invoice.issue + ' — مستحقة في ' + invoice.due;

    renderAlerts();
    renderItems();
    renderCreditNotes();
    renderReminders();
    renderCustomer();
    renderMeta();
    renderActions();
  }

  function reload() {
    invoice = Store.getInvoice(invoiceId);
    if (invoice) render();
  }

  function initCompanyName() {
    var name = null;
    try { name = localStorage.getItem('ammar_company_name'); } catch (e) { /* ignore */ }
    if (name) document.getElementById('dashCompanyName').textContent = name;
  }

  document.addEventListener('DOMContentLoaded', function () {
    initCompanyName();
    invoiceId = new URLSearchParams(window.location.search).get('id') || '';

    $('#ivPromptClose').addEventListener('click', closePrompt);
    $('#ivPromptCancel').addEventListener('click', closePrompt);
    $('#ivPromptOverlay').addEventListener('click', function (e) {
      if (e.target === $('#ivPromptOverlay')) closePrompt();
    });
    $('#ivPromptConfirm').addEventListener('click', function () {
      if (!promptHandler) return;
      // المُعالج يُرجع false لإبقاء النافذة مفتوحة عند وجود خطأ تحقق
      if (promptHandler() !== false) { closePrompt(); reload(); }
    });

    setTimeout(function () {
      invoice = Store.getInvoice(invoiceId);
      $('#ivLoading').hidden = true;

      if (!invoice) {
        $('#ivNotFound').hidden = false;
        $('#ivSubtitle').textContent = 'الفاتورة غير موجودة';
        return;
      }

      $('#ivContent').hidden = false;
      render();
      Store.subscribe(reload);
    }, 240);
  });
})();
