/* ============================================================
   عمّار — طبقة الحركة الدقيقة للمتجر
   ------------------------------------------------------------
   ظهور تدريجي عند التمرير، موجة ضغط على الأزرار، نبض بعد الإجراء،
   وطيران صورة المنتج إلى أيقونة السلة.

   كل شيء هنا يحترم prefers-reduced-motion، ويعمل على المحتوى
   المُنشأ لاحقاً بالجافاسكربت عبر MutationObserver.
   ============================================================ */

window.SF = (function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var reduced = false;
  try {
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { reduced = false; }

  // يُفعّل قواعد الإخفاء المسبق فقط بعد التأكد من عمل السكربت
  if (!reduced) document.documentElement.classList.add('sf-ready');

  /* ---------------- الظهور التدريجي ---------------- */
  var revealObserver = null;

  function initReveal() {
    if (reduced || !('IntersectionObserver' in window)) {
      $all('[data-reveal]').forEach(function (el) { el.classList.add('is-revealed'); });
      return;
    }

    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        // تأخير متدرّج داخل نفس المجموعة يعطي إحساس التتابع
        var delay = parseInt(entry.target.getAttribute('data-reveal-delay') || '0', 10);
        setTimeout(function () { entry.target.classList.add('is-revealed'); }, delay);
        revealObserver.unobserve(entry.target);
      });
      // هامش سالب على الحافة السفلى كان يستثني عناصر ظاهرة فعلياً
      // على الشاشة (مثل بطاقات التصنيف مباشرة أسفل الطية) فتبقى
      // شفافة إلى الأبد — تظهر كفراغ أبيض بلا منتجات. هامش موجب
      // يكشفها بمجرد اقترابها من الشاشة بدل استبعاد ما هو ظاهر فعلاً.
    }, { rootMargin: '0px 0px 120px 0px', threshold: 0.01 });

    observeAll();
  }

  function observeAll(root) {
    if (!revealObserver) {
      $all('[data-reveal]', root).forEach(function (el) { el.classList.add('is-revealed'); });
      return;
    }
    $all('[data-reveal]', root).forEach(function (el) {
      if (el.classList.contains('is-revealed') || el.dataset.sfWatched) return;
      el.dataset.sfWatched = '1';
      revealObserver.observe(el);

      // شبكة أمان: أي عنصر لم يُكشف خلال ١.٥ ثانية يُظهَر فوراً بلا
      // انتظار. هذا يضمن عدم بقاء أي محتوى مخفياً للأبد بسبب حافة
      // فيوبورت أو توقيت دقيق — أهم من نعومة حركة لا يراها أحد.
      setTimeout(function () {
        if (!el.classList.contains('is-revealed')) el.classList.add('is-revealed');
      }, 1500);
    });
  }

  // يوسم عناصر الشبكة بتأخير متدرّج فتظهر واحداً تلو الآخر
  function stagger(container, step) {
    if (!container) return;
    var gap = step || 55;
    Array.prototype.slice.call(container.children).forEach(function (child, i) {
      child.setAttribute('data-reveal', '');
      child.setAttribute('data-reveal-delay', String(Math.min(i, 7) * gap));
    });
    observeAll(container);
  }

  /* ---------------- موجة الضغط ---------------- */
  function initRipple() {
    if (reduced) return;

    document.addEventListener('pointerdown', function (e) {
      var btn = e.target.closest('.by-btn, .by-go, .by-sticky-cta, .by-quick-btn');
      if (!btn || btn.disabled) return;

      var box = btn.getBoundingClientRect();
      var size = Math.max(box.width, box.height);

      var wave = document.createElement('span');
      wave.className = 'sf-ripple';
      wave.style.width = wave.style.height = size + 'px';
      wave.style.left = (e.clientX - box.left - size / 2) + 'px';
      wave.style.top = (e.clientY - box.top - size / 2) + 'px';

      btn.appendChild(wave);
      setTimeout(function () { if (wave.parentNode) wave.parentNode.removeChild(wave); }, 600);
    }, { passive: true });
  }

  function pulse(el) {
    if (!el || reduced) return;
    el.classList.remove('sf-pulse');
    void el.offsetWidth;               // إعادة تشغيل الحركة
    el.classList.add('sf-pulse');
    setTimeout(function () { el.classList.remove('sf-pulse'); }, 520);
  }

  /* ---------------- الطيران إلى السلة ---------------- */
  function cartTarget() {
    return $('#bhCartBadge') || $('#bhCartLink') || $('.by-icon-btn[href="buyer-cart.html"]');
  }

  function bumpCart() {
    var icon = $('#bhCartLink') || cartTarget();
    if (!icon || reduced) return;
    icon.classList.remove('sf-cart-bump');
    void icon.offsetWidth;
    icon.classList.add('sf-cart-bump');
    setTimeout(function () { icon.classList.remove('sf-cart-bump'); }, 520);
  }

  // source: عنصر الصورة المصدر (أو أي عنصر له موقع)، imgSrc: مسار الصورة
  function flyToCart(source, imgSrc) {
    bumpCart();

    var target = cartTarget();
    if (reduced || !source || !target) return;

    var from = source.getBoundingClientRect();
    var to = target.getBoundingClientRect();
    if (!from.width || !to.width) return;

    var flyer = document.createElement(imgSrc ? 'img' : 'div');
    flyer.className = 'sf-fly';
    if (imgSrc) flyer.src = imgSrc;
    else flyer.style.background = 'var(--sf-brand)';

    flyer.style.left = (from.left + from.width / 2 - 34) + 'px';
    flyer.style.top = (from.top + from.height / 2 - 34) + 'px';
    document.body.appendChild(flyer);

    var dx = (to.left + to.width / 2) - (from.left + from.width / 2);
    var dy = (to.top + to.height / 2) - (from.top + from.height / 2);

    requestAnimationFrame(function () {
      flyer.style.transform = 'translate(' + dx + 'px, ' + dy + 'px) scale(0.16) rotate(-14deg)';
      flyer.style.opacity = '0.15';
    });

    setTimeout(function () { if (flyer.parentNode) flyer.parentNode.removeChild(flyer); }, 780);
  }

  // يُستدعى من بطاقة المنتج: يجد الصورة داخل البطاقة تلقائياً
  function flyFromCard(cardOrButton) {
    var card = cardOrButton && cardOrButton.closest ? cardOrButton.closest('.by-card, .by-pdp, .sf-tile') : null;
    var img = card ? card.querySelector('img') : null;
    flyToCart(img || cardOrButton, img ? img.currentSrc || img.src : '');
  }

  /* ---------------- صفوف التمرير الأفقي ----------------
     تُفعَّل بالاشتراك عبر data-rail فقط: صفوف العرض المنسّقة تتحول
     على الجوال إلى تمرير أفقي، أما شبكات نتائج البحث والمفضلة فتبقى
     شبكة كاملة لأن المستخدم يحتاج رؤية كل النتائج لا تمريرها. */
  function initRails() {
    $all('.by-products[data-rail]').forEach(function (grid) {
      grid.classList.add('sf-rail');
    });
  }

  /* ---------------- التشغيل ---------------- */
  function init() {
    initReveal();
    initRipple();
    initRails();

    // المحتوى المُنشأ لاحقاً يدخل نظام الظهور تلقائياً
    if ('MutationObserver' in window) {
      var mo = new MutationObserver(function () {
        initRails();
        observeAll();
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    reduced: reduced,
    reveal: observeAll,
    stagger: stagger,
    pulse: pulse,
    flyToCart: flyToCart,
    flyFromCard: flyFromCard,
    bumpCart: bumpCart
  };
})();
