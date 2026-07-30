(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var currentTab = 'pending';
  var editingProductId = '';
  var draftRating = 0;

  var STAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, kind) { if (window.Shell) Shell.toast(msg, kind); }

  function starsHtml(rating) {
    var out = '';
    for (var i = 1; i <= 5; i++) {
      out += '<span class="' + (i <= rating ? 'is-on' : '') + '">' + STAR + '</span>';
    }
    return '<span class="by-stars">' + out + '</span>';
  }

  function visible() {
    var all = Buyer.reviewableProducts();
    return currentTab === 'pending'
      ? all.filter(function (r) { return !r.review; })
      : all.filter(function (r) { return !!r.review; });
  }

  function renderTabs() {
    var all = Buyer.reviewableProducts();
    var pending = all.filter(function (r) { return !r.review; }).length;
    var done = all.length - pending;

    $all('#brTabs .tab-btn').forEach(function (btn) {
      var key = btn.getAttribute('data-tab');
      btn.classList.toggle('is-active', key === currentTab);
      var count = key === 'pending' ? pending : done;
      var label = key === 'pending' ? 'بانتظار التقييم' : 'تقييماتي السابقة';
      btn.innerHTML = label + '<span class="count">(' + count + ')</span>';
    });
  }

  function renderGrid() {
    var list = visible();

    $('#brLoading').hidden = true;
    $('#brGrid').hidden = list.length === 0;
    $('#brEmpty').hidden = list.length > 0;

    if (!list.length) {
      $('#brEmptyTitle').textContent = currentTab === 'pending'
        ? 'لا توجد منتجات بانتظار التقييم'
        : 'لم تكتب أي تقييم بعد';
      $('#brEmptyText').textContent = currentTab === 'pending'
        ? 'بعد استلام أي طلب ستتمكن من تقييم منتجاته هنا.'
        : 'قيّم منتجاتك المستلمة لتظهر هنا.';
      return;
    }

    // كل منتج قابل للنقر يفتح نافذة كتابة التقييم مباشرة
    $('#brGrid').innerHTML = list.map(function (r) {
      var p = r.product;
      return '<button type="button" class="by-tile" data-review="' + esc(p.id) + '">' +
        '<div class="by-tile-head">' +
          '<img src="' + esc(p.img) + '" alt="' + esc(p.name) + '" style="width:44px;height:44px;border-radius:10px;object-fit:cover;flex-shrink:0;" />' +
          '<strong>' + esc(p.name) + '</strong>' +
        '</div>' +
        (r.review
          ? '<div>' + starsHtml(r.review.rating) + '</div>' +
            '<p>' + esc(r.review.comment || 'بدون تعليق') + '</p>'
          : '<p>اشتريته في ' + esc(r.date) + ' — اضغط لكتابة تقييمك</p>') +
        '<span class="ord-link" style="font-size:0.8rem;">' + (r.review ? 'تعديل التقييم' : 'اكتب تقييمك') + ' ←</span>' +
      '</button>';
    }).join('');

    $all('[data-review]', $('#brGrid')).forEach(function (btn) {
      btn.addEventListener('click', function () { openModal(btn.getAttribute('data-review')); });
    });
  }

  function openModal(productId) {
    editingProductId = productId;
    var p = Store.getProduct(productId);
    if (!p) return;

    var existing = Buyer.reviewFor(productId);
    draftRating = existing ? existing.rating : 0;

    $('#brModalTitle').textContent = 'تقييم: ' + p.name;

    $('#brModalBody').innerHTML =
      '<div class="ord-info-row" style="margin-bottom:16px;">' +
        '<img src="' + esc(p.img) + '" alt="' + esc(p.name) + '" style="width:56px;height:56px;border-radius:12px;object-fit:cover;" />' +
        '<span><strong>' + esc(p.name) + '</strong><br />' +
        '<a class="ord-link" href="buyer-product.html?id=' + encodeURIComponent(p.id) + '">عرض صفحة المنتج</a></span>' +
      '</div>' +
      '<div class="pd-field"><label>تقييمك <em>*</em></label>' +
        '<div class="by-star-input" id="brStars">' +
          [1, 2, 3, 4, 5].map(function (n) {
            return '<button type="button" data-star="' + n + '" class="' + (n <= draftRating ? 'is-on' : '') + '" aria-label="' + n + ' نجوم">' + STAR + '</button>';
          }).join('') +
        '</div><span class="field-error" id="brError"></span></div>' +
      '<div class="pd-field"><label for="brComment">رأيك في المنتج</label>' +
        '<textarea id="brComment" placeholder="ما رأيك في جودة المنتج وسرعة التوصيل؟">' + esc(existing ? existing.comment : '') + '</textarea></div>';

    $all('[data-star]', $('#brStars')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        draftRating = parseInt(btn.getAttribute('data-star'), 10);
        $all('[data-star]', $('#brStars')).forEach(function (b) {
          b.classList.toggle('is-on', parseInt(b.getAttribute('data-star'), 10) <= draftRating);
        });
        $('#brError').textContent = '';
      });
    });

    $('#brOverlay').hidden = false;
  }

  function save() {
    if (!draftRating) { $('#brError').textContent = 'اختر عدد النجوم أولاً'; return; }

    Buyer.saveReview(editingProductId, draftRating, $('#brComment').value.trim());
    $('#brOverlay').hidden = true;
    render();
    toast('شكراً لك — تم حفظ تقييمك', 'success');
  }

  function render() {
    renderTabs();
    renderGrid();
  }

  document.addEventListener('DOMContentLoaded', function () {
    $all('#brTabs .tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentTab = btn.getAttribute('data-tab');
        render();
      });
    });

    $('#brClose').addEventListener('click', function () { $('#brOverlay').hidden = true; });
    $('#brCancel').addEventListener('click', function () { $('#brOverlay').hidden = true; });
    $('#brOverlay').addEventListener('click', function (e) {
      if (e.target === $('#brOverlay')) $('#brOverlay').hidden = true;
    });
    $('#brSave').addEventListener('click', save);

    setTimeout(function () {
      render();
      Store.subscribe(render);
    }, 220);
  });
})();
