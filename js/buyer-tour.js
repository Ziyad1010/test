/* ============================================================
   عمّار — الجولة التعريفية للمستخدم الجديد
   ------------------------------------------------------------
   الحركة مبنية على مبدأ واحد: التركيز ينتقل ولا يقفز.

   • فتحة الإضاءة مرسومة داخل <svg> واحد بمسار fill-rule="evenodd"،
     ويُستكمل بين موضعين بـ requestAnimationFrame مع منحنى تسارع
     طبيعي. لا نُحرّك خصائص تخطيط (top/left/width/height) على عناصر
     DOM أثناء الانتقال، فالإطار كله إعادة رسم مسار واحد.
   • البطاقة تخرج ثم تدخل بتأثير معكوس فيبدو التتابع متصلاً.
   • السهم يُحسب بالبكسل من مستطيل الهدف، فيصحّ في RTL و LTR معاً
     بلا قواعد اتجاه منفصلة.
   ============================================================ */

window.Tour = (function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  var reduced = false;
  try {
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { reduced = false; }

  var MOVE_MS = reduced ? 0 : 380;   // انتقال بؤرة الإضاءة
  var SWAP_MS = reduced ? 0 : 170;   // خروج البطاقة قبل دخول التالية
  var PAD = 10;                      // هامش حول العنصر داخل الفتحة
  var GAP = 18;                      // مسافة البطاقة عن العنصر

  /* ---------------- محتوى الخطوات (كما هو) ---------------- */
  var STEPS = [
    {
      target: '.by-smart-search-inner',
      title: 'ابحث كما تتكلّم',
      body: 'اكتب «اسمنت» أو «أسمنت» أو حتى «سمنت» — البحث يفهم الاختلافات الإملائية والمرادفات ويعرض نتائج فورية مع الصور والأسعار.',
      place: 'bottom'
    },
    {
      target: '#bhVisualBtn',
      title: 'ابحث بصورة',
      body: 'صوّر بلاطاً أو حديداً بجوالك وارفع الصورة، فيبحث النظام في الكتالوج عن أقرب المنتجات بصرياً.',
      place: 'bottom'
    },
    {
      target: '#bhVoiceBtn',
      title: 'ابحث بصوتك',
      body: 'اضغط الميكروفون وتكلّم بالعربية — يُحوَّل كلامك إلى بحث مباشرة.',
      place: 'bottom'
    },
    {
      target: '#smAsstFab',
      title: 'مساعد التسوّق',
      body: 'صِف مشروعك بجملة واحدة — مثل «جدار 20 متر بارتفاع 3» — فيحسب لك المواد والكميات والتكلفة التقديرية ويضيفها للسلة بضغطة.',
      place: 'top'
    },
    {
      target: '#bhCityBtn',
      title: 'حدّد موقع مشروعك',
      body: 'اختيار المدينة يضبط مدة التوصيل المتوقعة وتكلفة الشحن في كل صفحة تتصفّحها.',
      place: 'bottom'
    },
    {
      target: '#bhCartLink',
      title: 'سلتك محفوظة دائماً',
      body: 'ما تضيفه يبقى في سلتك حتى لو أغلقت المتصفح، وتتبّع طلبك بعد الشراء يتحدّث لحظياً بلا إعادة تحميل.',
      place: 'bottom'
    }
  ];

  /* ---------------- الحالة ---------------- */
  var index = 0;
  var active = [];
  var layer = null;
  var dimPath = null;
  var ringPath = null;
  var card = null;

  var shown = { x: 0, y: 0, w: 0, h: 0 };   // المستطيل المرسوم حالياً
  var rafId = null;
  var busy = false;
  var syncScheduled = false;

  /* ---------------- أدوات الحركة ---------------- */
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function roundedRect(x, y, w, h, r) {
    var rr = Math.max(0, Math.min(r, w / 2, h / 2));
    return 'M' + (x + rr) + ',' + y +
      'h' + (w - 2 * rr) + 'a' + rr + ',' + rr + ' 0 0 1 ' + rr + ',' + rr +
      'v' + (h - 2 * rr) + 'a' + rr + ',' + rr + ' 0 0 1 ' + (-rr) + ',' + rr +
      'h' + (-(w - 2 * rr)) + 'a' + rr + ',' + rr + ' 0 0 1 ' + (-rr) + ',' + (-rr) +
      'v' + (-(h - 2 * rr)) + 'a' + rr + ',' + rr + ' 0 0 1 ' + rr + ',' + (-rr) + 'z';
  }

  function paint(rect) {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var hole = roundedRect(rect.x, rect.y, rect.w, rect.h, 14);

    // المستطيل الكامل + الفتحة، و evenodd يفرّغ الفتحة من التظليل
    dimPath.setAttribute('d', 'M0,0H' + vw + 'V' + vh + 'H0Z ' + hole);
    ringPath.setAttribute('d', hole);
  }

  // ينتقل من المستطيل الحالي إلى الهدف بمنحنى طبيعي
  function moveTo(rect, done) {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

    var from = { x: shown.x, y: shown.y, w: shown.w, h: shown.h };
    var first = !from.w && !from.h;

    // أول ظهور: تُفتح الفتحة من مركز الهدف بدل الانزلاق من الصفر
    if (first) {
      from = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, w: 0, h: 0 };
    }

    if (!MOVE_MS) {
      shown = rect;
      paint(rect);
      if (done) done();
      return;
    }

    var start = performance.now();

    (function frame(now) {
      var t = Math.min(1, (now - start) / MOVE_MS);
      var e = easeInOutCubic(t);

      shown = {
        x: lerp(from.x, rect.x, e),
        y: lerp(from.y, rect.y, e),
        w: lerp(from.w, rect.w, e),
        h: lerp(from.h, rect.h, e)
      };
      paint(shown);

      if (t < 1) { rafId = requestAnimationFrame(frame); return; }
      rafId = null;
      shown = rect;
      if (done) done();
    })(start);
  }

  /* ---------------- بناء الطبقة ---------------- */
  function build() {
    layer = document.createElement('div');
    layer.className = 'tr-layer';
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    layer.setAttribute('aria-label', 'جولة تعريفية');

    layer.innerHTML =
      '<div class="tr-block" id="trBlock"></div>' +
      '<svg class="tr-svg" id="trSvg" aria-hidden="true">' +
        '<path class="tr-dim" id="trDim" fill-rule="evenodd"></path>' +
        '<path class="tr-ring" id="trRing"></path>' +
      '</svg>' +

      '<div class="tr-card" id="trCard">' +
        '<span class="tr-arrow" id="trArrow"></span>' +

        '<div class="tr-head">' +
          '<span class="tr-count" id="trCount"></span>' +
          '<button type="button" class="tr-close" id="trClose" aria-label="إغلاق الجولة">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
          '</button>' +
        '</div>' +

        '<h4 id="trTitle"></h4>' +
        '<p id="trBody"></p>' +

        '<div class="tr-bar"><span id="trBarFill"></span></div>' +
        '<div class="tr-dots" id="trDots"></div>' +

        '<div class="tr-actions">' +
          '<button type="button" class="tr-back" id="trBack">السابق</button>' +
          '<button type="button" class="tr-next" id="trNext">التالي</button>' +
        '</div>' +

        '<button type="button" class="tr-skip" id="trSkip">تخطّي الجولة</button>' +
      '</div>';

    document.body.appendChild(layer);

    dimPath = $('#trDim');
    ringPath = $('#trRing');
    card = $('#trCard');

    $('#trClose').addEventListener('click', function () { finish(false); });
    $('#trSkip').addEventListener('click', function () { finish(false); });
    $('#trBlock').addEventListener('click', function () { finish(false); });
    $('#trBack').addEventListener('click', function () { go(index - 1); });
    $('#trNext').addEventListener('click', function () { go(index + 1); });

    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', scheduleSync, { passive: true });
    window.addEventListener('scroll', scheduleSync, { passive: true });

    requestAnimationFrame(function () { layer.classList.add('is-live'); });
  }

  /* ---------------- إعادة المزامنة مع تغيّر الصفحة ---------------- */
  function scheduleSync() {
    if (syncScheduled || busy || !layer) return;
    syncScheduled = true;

    requestAnimationFrame(function () {
      syncScheduled = false;
      var step = active[index];
      var el = step && $(step.target);
      if (!el) return;

      var rect = rectOf(el);
      shown = rect;
      paint(rect);
      placeCard(rect, step.place);
    });
  }

  function rectOf(el) {
    var b = el.getBoundingClientRect();
    return {
      x: Math.round(b.left - PAD),
      y: Math.round(b.top - PAD),
      w: Math.round(b.width + PAD * 2),
      h: Math.round(b.height + PAD * 2)
    };
  }

  /* ---------------- التمرير الناعم قبل القياس ----------------
     ننتظر استقرار موضع التمرير فعلياً بدل تخمين مدة ثابتة. */

  // العناصر المثبّتة (هيدر لاصق، زر عائم) لا تتحرك بالتمرير،
  // فمحاولة التمرير إليها تُزيح الصفحة بلا فائدة
  function isPinned(el) {
    var node = el;
    while (node && node !== document.body) {
      var pos = getComputedStyle(node).position;
      if (pos === 'fixed' || pos === 'sticky') return true;
      node = node.parentElement;
    }
    return false;
  }

  function ensureVisible(el, done) {
    if (isPinned(el)) { done(); return; }

    var b = el.getBoundingClientRect();
    var margin = 140;

    if (b.top >= margin && b.bottom <= window.innerHeight - margin) { done(); return; }

    el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });

    var last = null;
    var stable = 0;
    var guard = performance.now();

    (function poll() {
      var y = window.scrollY;
      if (y === last) stable++; else { stable = 0; last = y; }

      // ثلاث لقطات متطابقة أو مهلة قصوى تحسّباً لتوقف التمرير
      if (stable >= 3 || performance.now() - guard > 900) { done(); return; }
      requestAnimationFrame(poll);
    })();
  }

  /* ---------------- تموضع البطاقة والسهم ---------------- */
  function placeCard(rect, prefer) {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var cw = card.offsetWidth;
    var ch = card.offsetHeight;
    var M = 14;   // هامش أدنى عن حواف الشاشة

    var room = {
      bottom: vh - (rect.y + rect.h) - GAP,
      top: rect.y - GAP,
      right: vw - (rect.x + rect.w) - GAP,
      left: rect.x - GAP
    };

    // الأفضلية للجهة المطلوبة إن اتسعت، ثم الأوسع فعلياً
    var order = [prefer === 'top' ? 'top' : 'bottom', prefer === 'top' ? 'bottom' : 'top', 'right', 'left'];
    var side = null;

    order.forEach(function (s) {
      if (side) return;
      var need = (s === 'top' || s === 'bottom') ? ch : cw;
      if (room[s] >= need) side = s;
    });

    if (!side) {
      side = Object.keys(room).sort(function (a, b) { return room[b] - room[a]; })[0];
    }

    var top, left;

    if (side === 'bottom' || side === 'top') {
      top = side === 'bottom' ? rect.y + rect.h + GAP : rect.y - ch - GAP;
      left = rect.x + rect.w / 2 - cw / 2;
    } else {
      left = side === 'right' ? rect.x + rect.w + GAP : rect.x - cw - GAP;
      top = rect.y + rect.h / 2 - ch / 2;
    }

    left = Math.max(M, Math.min(left, vw - cw - M));
    top = Math.max(M, Math.min(top, vh - ch - M));

    card.style.top = Math.round(top) + 'px';
    card.style.left = Math.round(left) + 'px';
    card.setAttribute('data-side', side);

    // السهم يشير إلى مركز الهدف مهما انزاحت البطاقة عند الحواف
    var arrow = $('#trArrow');
    var cx = rect.x + rect.w / 2;
    var cy = rect.y + rect.h / 2;

    if (side === 'bottom' || side === 'top') {
      arrow.style.left = Math.round(Math.max(18, Math.min(cx - left, cw - 18))) + 'px';
      arrow.style.top = '';
    } else {
      arrow.style.top = Math.round(Math.max(18, Math.min(cy - top, ch - 18))) + 'px';
      arrow.style.left = '';
    }
  }

  /* ---------------- الانتقال بين الخطوات ---------------- */
  function fillCard(step) {
    $('#trCount').textContent = 'خطوة ' + (index + 1) + ' من ' + active.length;
    $('#trTitle').textContent = step.title;
    $('#trBody').textContent = step.body;

    $('#trNext').textContent = index === active.length - 1 ? 'أنهِ الجولة' : 'التالي';
    $('#trBack').hidden = index === 0;

    $('#trBarFill').style.width = Math.round((index + 1) / active.length * 100) + '%';

    $('#trDots').innerHTML = active.map(function (s, i) {
      return '<span class="' + (i === index ? 'is-on' : i < index ? 'is-past' : '') + '"></span>';
    }).join('');
  }

  function go(next, dir) {
    if (busy) return;
    if (next < 0) return;
    if (next >= active.length) { celebrate(); return; }

    var forward = dir === undefined ? next > index : dir;
    busy = true;

    // خروج البطاقة في اتجاه الحركة، ثم دخولها من الجهة المقابلة
    card.setAttribute('data-dir', forward ? 'fwd' : 'back');
    card.classList.remove('is-in');
    card.classList.add('is-out');

    setTimeout(function () {
      index = next;
      var step = active[index];
      var el = $(step.target);

      if (!el) { busy = false; go(forward ? next + 1 : next - 1, forward); return; }

      ensureVisible(el, function () {
        var rect = rectOf(el);
        fillCard(step);

        // البطاقة تُقاس وهي مخفية فيصحّ حساب الموضع قبل ظهورها
        placeCard(rect, step.place);

        moveTo(rect, function () { busy = false; });

        card.classList.remove('is-out');
        requestAnimationFrame(function () { card.classList.add('is-in'); });
      });
    }, SWAP_MS);
  }

  /* ---------------- الاحتفال بالنهاية ---------------- */
  function celebrate() {
    if (busy) return;
    busy = true;

    card.classList.remove('is-in');
    card.classList.add('is-out');

    // إغلاق الفتحة نحو مركز الشاشة قبل ظهور رسالة الختام
    var cx = window.innerWidth / 2;
    var cy = window.innerHeight / 2;

    moveTo({ x: cx, y: cy, w: 0, h: 0 }, function () {
      var finale = document.createElement('div');
      finale.className = 'tr-finale';
      finale.innerHTML =
        '<span class="tr-burst"><i></i><i></i><i></i></span>' +
        '<span class="tr-finale-ico">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
        '</span>' +
        '<strong>أنت جاهز الآن!</strong>' +
        '<small>ابدأ التسوّق — يمكنك إعادة الجولة متى شئت من الإعدادات.</small>';

      layer.appendChild(finale);
      requestAnimationFrame(function () { finale.classList.add('is-on'); });

      confetti();
      setTimeout(function () { finish(true); }, 1750);
    });
  }

  // احتفال مقتصد: قصاصات قليلة قصيرة العمر لا تُغرق الشاشة
  function confetti() {
    if (reduced) return;

    var colors = ['#00a8cc', '#0e2439', '#e11d48', '#f5cd6b'];
    var box = document.createElement('div');
    box.className = 'tr-confetti';

    for (var i = 0; i < 14; i++) {
      var bit = document.createElement('i');
      bit.style.left = (12 + Math.random() * 76) + '%';
      bit.style.background = colors[i % colors.length];
      bit.style.animationDelay = (Math.random() * 0.22).toFixed(2) + 's';
      bit.style.setProperty('--tr-drift', (Math.random() * 90 - 45).toFixed(0) + 'px');
      bit.style.setProperty('--tr-spin', (Math.random() * 540 - 270).toFixed(0) + 'deg');
      box.appendChild(bit);
    }

    layer.appendChild(box);
    setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 1700);
  }

  /* ---------------- الإنهاء ---------------- */
  function finish(completed) {
    if (!layer) return;

    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', scheduleSync);
    window.removeEventListener('scroll', scheduleSync);

    // كل العناصر تخرج في اللحظة نفسها: التظليل والبطاقة والإطار
    layer.classList.remove('is-live');
    layer.classList.add('is-closing');

    var node = layer;
    layer = null;
    busy = false;

    setTimeout(function () {
      if (node && node.parentNode) node.parentNode.removeChild(node);
    }, reduced ? 0 : 300);

    if (window.Smart) Smart.markTourDone();
    if (completed && window.ByUI) ByUI.toast('اكتملت الجولة — أهلاً بك في عمّار', 'success');
  }

  function onKey(e) {
    if (!layer) return;
    if (e.key === 'Escape') { finish(false); return; }

    // في RTL يقدّم السهم الأيسر ويؤخّر الأيمن
    var rtl = document.documentElement.getAttribute('dir') !== 'ltr';
    if (e.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) { e.preventDefault(); go(index + 1); }
    if (e.key === (rtl ? 'ArrowRight' : 'ArrowLeft')) { e.preventDefault(); go(index - 1); }
  }

  /* ---------------- التشغيل ---------------- */
  function start(force) {
    if (layer) return;
    if (!force && window.Smart && Smart.tourDone()) return;

    // الخطوات التي لا عنصر لها في هذه الصفحة تُستبعد قبل البدء
    active = STEPS.filter(function (s) {
      var el = $(s.target);
      if (!el) return false;
      var b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0;
    });

    if (active.length < 2) return;

    build();
    index = 0;
    shown = { x: 0, y: 0, w: 0, h: 0 };
    busy = true;              // يُفتح القفل بعد اكتمال أول انتقال

    var step = active[0];
    var el = $(step.target);

    ensureVisible(el, function () {
      var rect = rectOf(el);
      fillCard(step);
      placeCard(rect, step.place);
      moveTo(rect, function () { busy = false; });

      card.setAttribute('data-dir', 'fwd');
      requestAnimationFrame(function () {
        card.classList.add('is-in');
        $('#trNext').focus();
      });
    });
  }

  function autoStart() {
    if (!window.Smart || Smart.tourDone()) return;
    setTimeout(function () { start(false); }, 1400);
  }

  return { start: start, finish: finish, autoStart: autoStart };
})();
