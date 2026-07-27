(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var STATUS_LABELS = { active: 'نشط', scheduled: 'مجدول', ended: 'منتهي' };

  var offers = [
    { id: 1, name: 'عرض نهاية الأسبوع على الحديد', discount: 15, start: '2026-07-18', end: '2026-07-25', cities: ['الرياض', 'جدة'], products: ['حديد تسليح سعودي 12مم', 'حديد تسليح سعودي 16مم'], status: 'active', used: 64, limit: 200 },
    { id: 2, name: 'خصم الصيف على مواد التشطيب', discount: 20, start: '2026-06-01', end: '2026-07-10', cities: ['الدمام', 'الخبر'], products: ['بلاط بورسلين مطفي 60×60'], status: 'ended', used: 152, limit: 150 },
    { id: 3, name: 'عرض إطلاق موسم البناء', discount: 10, start: '2026-08-01', end: '2026-08-31', cities: ['الرياض', 'مكة المكرمة', 'المدينة المنورة'], products: ['أسمنت بورتلاندي عادي', 'خرسانة جاهزة C30'], status: 'scheduled', used: 0, limit: 300 },
    { id: 4, name: 'خصم كميات الجملة', discount: 12, start: '2026-07-10', end: '2026-07-30', cities: ['الرياض'], products: ['طوب أسمنتي مصمت 20سم'], status: 'active', used: 38, limit: 100 }
  ];

  var nextId = 5;
  var currentFilter = '';

  function renderGrid() {
    var list = currentFilter ? offers.filter(function (o) { return o.status === currentFilter; }) : offers;
    $('#offEmpty').hidden = list.length > 0;

    $('#offGrid').innerHTML = list.map(function (o) {
      var pct = o.limit ? Math.min(100, Math.round((o.used / o.limit) * 100)) : 0;
      return '<div class="offer-card">' +
        '<div class="offer-card-head">' +
          '<div><div class="offer-title">' + o.name + '</div><div class="offer-dates">' + o.start + ' — ' + o.end + '</div></div>' +
          '<div class="offer-discount">-' + o.discount + '%</div>' +
        '</div>' +
        '<span class="pd-status-pill ' + (o.status === 'active' ? 'active' : o.status === 'ended' ? 'archived' : 'draft') + '" style="width:fit-content;">' + STATUS_LABELS[o.status] + '</span>' +
        '<div class="offer-meta">' + o.cities.map(function (c) { return '<span class="pd-tag">' + c + '</span>'; }).join('') + '</div>' +
        '<div class="offer-meta">' + o.products.map(function (p) { return '<span class="pd-tag" style="color:var(--muted);background:var(--bg);">' + p + '</span>'; }).join('') + '</div>' +
        '<div class="offer-progress-bar"><div class="offer-progress-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="offer-stats"><span>تم استخدامه ' + o.used + ' مرة</span><span>الحد ' + o.limit + '</span></div>' +
        (o.status !== 'ended'
          ? '<button type="button" class="ob-btn-secondary" data-end="' + o.id + '" style="width:100%;">إنهاء العرض الآن</button>'
          : '') +
      '</div>';
    }).join('');

    $all('[data-end]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var offer = offers.find(function (o) { return o.id === parseInt(btn.getAttribute('data-end'), 10); });
        if (offer) {
          offer.status = 'ended';
          renderGrid();
          if (window.Shell) Shell.toast('تم إنهاء العرض "' + offer.name + '"');
        }
      });
    });
  }

  function initTabs() {
    $all('#offTabs .tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $all('#offTabs .tab-btn').forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        currentFilter = btn.getAttribute('data-status');
        renderGrid();
      });
    });
  }

  function selectedValues(select) {
    return Array.prototype.slice.call(select.selectedOptions).map(function (o) { return o.value; });
  }

  function initModal() {
    $('#offAddBtn').addEventListener('click', function () { $('#offModalOverlay').hidden = false; });
    $('#offModalClose').addEventListener('click', closeModal);
    $('#offCancelBtn').addEventListener('click', closeModal);
    $('#offModalOverlay').addEventListener('click', function (e) { if (e.target === $('#offModalOverlay')) closeModal(); });

    $('#offCreateBtn').addEventListener('click', function () {
      var name = $('#ofName').value.trim();
      var discount = parseInt($('#ofDiscount').value, 10);
      var start = $('#ofStart').value;
      var end = $('#ofEnd').value;

      if (!name || !discount || !start || !end) {
        if (window.Shell) Shell.toast('يرجى تعبئة اسم العرض ونسبة الخصم والتواريخ', 'danger');
        return;
      }

      var today = new Date().toISOString().slice(0, 10);
      offers.unshift({
        id: nextId++, name: name, discount: discount, start: start, end: end,
        cities: selectedValues($('#ofCities')), products: selectedValues($('#ofProducts')),
        status: start > today ? 'scheduled' : 'active', used: 0, limit: 200
      });

      renderGrid();
      closeModal();
      if (window.Shell) Shell.toast('تم إنشاء العرض بنجاح', 'success');
    });
  }

  function closeModal() {
    $('#offModalOverlay').hidden = true;
    $('#ofName').value = ''; $('#ofDiscount').value = ''; $('#ofCode').value = '';
    // Clearing through DateField also empties the visible يوم/شهر/سنة boxes.
    if (window.DateField) { DateField.clear('ofStart'); DateField.clear('ofEnd'); }
  }

  document.addEventListener('DOMContentLoaded', function () {
    initTabs();
    initModal();
    renderGrid();
  });
})();
