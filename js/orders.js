(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var STATUS_LABELS = { review: 'قيد المراجعة', prep: 'يتم التجهيز', shipped: 'تم الشحن', delivered: 'تم التسليم', cancelled: 'ملغي' };
  var STATUS_CLASS = { review: 'prep', prep: 'prep', shipped: 'prep', delivered: 'active', cancelled: 'archived' };
  var TIMELINE_STEPS = ['تم استلام الطلب', 'تم التأكيد وقيد التجهيز', 'تم الشحن', 'تم التسليم'];
  var STATUS_STEP_INDEX = { review: 0, prep: 1, shipped: 2, delivered: 3, cancelled: -1 };

  var orders = [
    { id: 1024, customer: 'شركة البناء الحديث للمقاولات', items: '100 كيس أسمنت بورتلاندي عادي', amount: 2850, payment: 'مدى', date: '2026-07-20', status: 'prep', address: 'الرياض - حي الملز - شارع الأمير عبدالله', phone: '+966 50 123 4567' },
    { id: 1023, customer: 'مؤسسة الإعمار المتحدة', items: '5 طن حديد تسليح 12مم', amount: 12250, payment: 'تحويل بنكي', date: '2026-07-19', status: 'review', address: 'جدة - حي الروضة', phone: '+966 55 987 6543' },
    { id: 1022, customer: 'شركة الرياض للمقاولات العامة', items: '20 م³ خرسانة جاهزة C30', amount: 4900, payment: 'Apple Pay', date: '2026-07-18', status: 'shipped', address: 'الدمام - حي الشاطئ', phone: '+966 54 321 0987' },
    { id: 1021, customer: 'مجموعة التطوير العقاري', items: '300 م² بلاط بورسلين 60×60', amount: 11340, payment: 'مدى', date: '2026-07-17', status: 'delivered', address: 'الرياض - حي النرجس', phone: '+966 56 111 2222' },
    { id: 1020, customer: 'مقاولات الخليج المحدودة', items: '1000 طوبة أسمنتية مصمتة', amount: 3200, payment: 'تحويل بنكي', date: '2026-07-16', status: 'cancelled', address: 'الخبر - حي العقربية', phone: '+966 53 444 5555' },
    { id: 1019, customer: 'شركة البناء الحديث للمقاولات', items: '2 طن حديد تسليح 16مم', amount: 5040, payment: 'مدى', date: '2026-07-15', status: 'delivered', address: 'الرياض - حي الملز', phone: '+966 50 123 4567' },
    { id: 1018, customer: 'مؤسسة النخبة للمقاولات', items: 'خلاطة خرسانة كهربائية 350 لتر', amount: 3850, payment: 'فيزا', date: '2026-07-14', status: 'prep', address: 'مكة المكرمة - حي العزيزية', phone: '+966 58 666 7777' },
    { id: 1017, customer: 'شركة الرياض للمقاولات العامة', items: '150 كيس أسمنت مقاوم للكبريتات', amount: 3150, payment: 'تحويل بنكي', date: '2026-07-12', status: 'review', address: 'الدمام - حي الفيصلية', phone: '+966 54 321 0987' }
  ];

  var currentFilter = '';

  function fmt(n) { return Number(n).toLocaleString('ar-SA'); }

  function updateStats() {
    $('#ordStatTotal').textContent = orders.length;
    $('#ordStatPending').textContent = orders.filter(function (o) { return o.status === 'review'; }).length;
    $('#ordStatShipping').textContent = orders.filter(function (o) { return o.status === 'shipped'; }).length;
    $('#ordStatDone').textContent = orders.filter(function (o) { return o.status === 'delivered'; }).length;
  }

  function renderTable() {
    var list = currentFilter ? orders.filter(function (o) { return o.status === currentFilter; }) : orders;
    $('#ordEmpty').hidden = list.length > 0;
    document.querySelector('.pd-table-wrap').hidden = list.length === 0;

    $('#ordTableBody').innerHTML = list.map(function (o) {
      return '<tr>' +
        '<td class="order-id">#' + o.id + '</td>' +
        '<td>' + o.customer + '</td>' +
        '<td>' + o.items + '</td>' +
        '<td><strong>' + fmt(o.amount) + ' ر.س</strong></td>' +
        '<td>' + o.payment + '</td>' +
        '<td>' + o.date + '</td>' +
        '<td><span class="pd-status-pill ' + STATUS_CLASS[o.status] + '">' + STATUS_LABELS[o.status] + '</span></td>' +
        '<td><div class="pd-table-actions"><button type="button" title="عرض التفاصيل" data-view="' + o.id + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>' +
        '</button></div></td>' +
      '</tr>';
    }).join('');

    $all('[data-view]').forEach(function (btn) {
      btn.addEventListener('click', function () { openOrder(parseInt(btn.getAttribute('data-view'), 10)); });
    });
  }

  function initTabs() {
    $all('#ordTabs .tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $all('#ordTabs .tab-btn').forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        currentFilter = btn.getAttribute('data-status');
        renderTable();
      });
    });
  }

  /* ---------------- Order Detail Modal ---------------- */
  function timelineHtml(order) {
    var activeIndex = STATUS_STEP_INDEX[order.status];
    if (order.status === 'cancelled') {
      return '<div style="padding:14px;background:var(--danger-bg);border-radius:10px;color:var(--danger);font-weight:700;font-size:0.88rem;">تم إلغاء هذا الطلب</div>';
    }
    return '<div style="display:flex;gap:0;">' + TIMELINE_STEPS.map(function (step, i) {
      var done = i <= activeIndex;
      return '<div style="flex:1;text-align:center;position:relative;">' +
        '<div style="width:28px;height:28px;border-radius:50%;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;' +
          (done ? 'background:var(--success);color:#fff;' : 'background:var(--bg);color:var(--muted);border:1px solid var(--line);') + '">' +
          (done ? '✓' : (i + 1)) + '</div>' +
        '<div style="font-size:0.72rem;color:' + (done ? 'var(--ink)' : 'var(--muted)') + ';font-weight:' + (done ? '700' : '500') + ';">' + step + '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function openOrder(id) {
    var o = orders.find(function (x) { return x.id === id; });
    if (!o) return;

    $('#ordModalTitle').textContent = 'تفاصيل الطلب #' + o.id;
    $('#ordModalBody').innerHTML =
      '<div class="pd-subhead"><strong>حالة الطلب</strong></div>' +
      timelineHtml(o) +
      '<div class="pd-field-row cols-2" style="margin-top:26px;">' +
        '<div class="pd-field"><label>العميل</label><input type="text" value="' + o.customer + '" readonly /></div>' +
        '<div class="pd-field"><label>رقم التواصل</label><input type="text" value="' + o.phone + '" readonly /></div>' +
      '</div>' +
      '<div class="pd-field"><label>عنوان التوصيل</label><input type="text" value="' + o.address + '" readonly /></div>' +
      '<div class="pd-field-row cols-2">' +
        '<div class="pd-field"><label>المنتجات</label><input type="text" value="' + o.items + '" readonly /></div>' +
        '<div class="pd-field"><label>طريقة الدفع</label><input type="text" value="' + o.payment + '" readonly /></div>' +
      '</div>' +
      '<div class="pd-field"><label>المبلغ الإجمالي</label><input type="text" value="' + fmt(o.amount) + ' ر.س" readonly style="font-weight:800;" /></div>';

    var actions = '';
    if (o.status === 'review') {
      actions = '<button type="button" class="ob-btn-secondary" data-reject="' + o.id + '" style="color:var(--danger);">رفض الطلب</button>' +
                 '<button type="button" class="ob-btn-primary" data-accept="' + o.id + '">قبول الطلب</button>';
    } else {
      actions = '<button type="button" class="ob-btn-primary" id="ordCloseBtn2">إغلاق</button>';
    }
    $('#ordModalActions').innerHTML = actions;

    var acceptBtn = $('[data-accept]');
    if (acceptBtn) acceptBtn.addEventListener('click', function () { setStatus(o.id, 'prep'); });
    var rejectBtn = $('[data-reject]');
    if (rejectBtn) rejectBtn.addEventListener('click', function () { setStatus(o.id, 'cancelled'); });
    var closeBtn2 = $('#ordCloseBtn2');
    if (closeBtn2) closeBtn2.addEventListener('click', closeModal);

    $('#ordModalOverlay').hidden = false;
  }

  function setStatus(id, status) {
    var o = orders.find(function (x) { return x.id === id; });
    if (!o) return;
    o.status = status;
    updateStats();
    renderTable();
    closeModal();
    if (window.Shell) Shell.toast(status === 'prep' ? 'تم قبول الطلب #' + id + ' وبدء التجهيز' : 'تم رفض الطلب #' + id, status === 'prep' ? 'success' : 'danger');
  }

  function closeModal() { $('#ordModalOverlay').hidden = true; }

  function initModal() {
    $('#ordModalClose').addEventListener('click', closeModal);
    $('#ordModalOverlay').addEventListener('click', function (e) { if (e.target === $('#ordModalOverlay')) closeModal(); });
    $('#ordPrintBtn').addEventListener('click', function () { window.print(); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initTabs();
    initModal();
    updateStats();
    renderTable();
  });
})();
