/* ============================================================
   عمّار — واجهات الميزات الذكية
   ------------------------------------------------------------
   معاينة سريعة، بحث بالصورة، بحث صوتي، مساعد التسوّق، حاسبة
   الكميات، شهادة المطابقة، الخط الزمني، الجولة التعريفية،
   ومبدّل الوضع الداكن — كلها تُحقن في الصفحة عند الحاجة.
   ============================================================ */

window.SmartUI = (function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  // مستقلّة عن ByUI حتى تعمل مكوّنات مثل الخط الزمني في صفحات
  // لوحة المشتري التي لا تُحمّل طبقة واجهة المتجر
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmt(n) {
    return Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 });
  }

  function toast(message, kind) {
    if (window.ByUI && ByUI.toast) { ByUI.toast(message, kind); return; }
    if (window.Shell && Shell.toast) { Shell.toast(message, kind); return; }
  }

  function refreshChrome() {
    if (window.ByUI && ByUI.refreshChrome) ByUI.refreshChrome();
  }

  /* ============================================================
     نافذة عامة قابلة لإعادة الاستخدام
     ============================================================ */
  var modalReady = false;

  function ensureModal() {
    if (modalReady || $('#smModal')) { modalReady = true; return; }
    modalReady = true;

    var wrap = document.createElement('div');
    wrap.className = 'sm-modal';
    wrap.id = 'smModal';
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="sm-modal-backdrop" id="smBackdrop"></div>' +
      '<div class="sm-modal-card" role="dialog" aria-modal="true" aria-labelledby="smModalTitle">' +
        '<div class="sm-modal-head">' +
          '<h3 id="smModalTitle"></h3>' +
          '<button type="button" class="sm-modal-close" id="smClose" aria-label="إغلاق">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="sm-modal-body" id="smModalBody"></div>' +
      '</div>';

    document.body.appendChild(wrap);

    $('#smBackdrop').addEventListener('click', closeModal);
    $('#smClose').addEventListener('click', closeModal);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('#smModal').hidden) closeModal();
    });
  }

  function openModal(title, html, size) {
    ensureModal();
    $('#smModalTitle').textContent = title;
    $('#smModalBody').innerHTML = html;

    var card = $('.sm-modal-card');
    card.className = 'sm-modal-card' + (size ? ' is-' + size : '');

    $('#smModal').hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { $('#smModal').classList.add('is-open'); });
    return $('#smModalBody');
  }

  function closeModal() {
    var m = $('#smModal');
    if (!m) return;
    m.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(function () { m.hidden = true; }, 220);
  }

  /* ============================================================
     1) المعاينة السريعة
     ============================================================ */
  function quickView(productId) {
    if (!window.ByUI) return;
    var p = Store.getProduct(productId);
    if (!p) return;

    var rating = Buyer.ratingOf(p.id);
    var avail = Store.deriveAvailability(p);
    var meta = ByUI.AVAIL[avail] || ByUI.AVAIL.in_stock;
    var eff = ByUI.effectivePrice(p);
    var cert = Smart.certification(p);
    var moq = Number(p.moq || 1) || 1;
    var eta = ByUI.deliveryOf(p);

    var body = openModal('معاينة سريعة', '' +
      '<div class="sm-qv">' +
        '<div class="sm-qv-media">' +
          '<img src="' + esc(p.img) + '" alt="' + esc(p.name) + '" />' +
          (p.discount > 0 ? '<span class="sf-badge sf-badge--sale sm-qv-badge">خصم ' + p.discount + '%</span>' : '') +
        '</div>' +

        '<div class="sm-qv-info">' +
          '<a class="by-pdp-brand" href="buyer-supplier.html?name=' + encodeURIComponent(p.brand || 'عام') + '">' + esc(p.brand || 'عام') + '</a>' +
          '<h4>' + esc(p.name) + '</h4>' +

          '<div class="by-pdp-meta">' +
            ByUI.starsHtml(rating.value) +
            '<span>' + rating.value + ' (' + rating.count + ')</span>' +
            '<span class="am-chip stock-' + (avail === 'in_stock' ? 'in' : avail === 'limited' ? 'low' : avail === 'on_demand' ? 'demand' : 'out') + '">' + esc(meta.label) + '</span>' +
          '</div>' +

          (cert ? '<button type="button" class="sm-cert-chip" data-cert="' + esc(p.id) + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>' +
            esc(cert.label) + '</button>' : '') +

          '<div class="sm-qv-price">' +
            '<strong>' + fmt(eff) + '</strong><span>ر.س</span><small>/ ' + esc(p.unit || 'وحدة') + '</small>' +
            (eff < p.price ? '<del>' + fmt(p.price) + '</del>' : '') +
          '</div>' +

          (eta ? '<p class="sm-qv-eta">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>' +
            esc(eta) + '</p>' : '') +

          '<dl class="sm-qv-specs">' +
            row('القسم', ByUI.CATEGORY_LABELS[p.category] || '—') +
            row('أقل كمية', moq + ' ' + (p.unit || '')) +
            row('المتاح', avail === 'on_demand' ? 'حسب الطلب' : fmt(p.stock || 0) + ' ' + (p.unit || '')) +
            (p.sku ? row('رمز المنتج', '<code dir="ltr">' + esc(p.sku) + '</code>') : '') +
          '</dl>' +

          '<div class="sm-qv-actions">' +
            '<button type="button" class="by-btn by-btn-primary" id="smQvAdd"' + (avail === 'out_of_stock' ? ' disabled' : '') + '>' +
              (avail === 'out_of_stock' ? 'غير متوفر' : 'أضف ' + moq + ' إلى السلة') +
            '</button>' +
            '<a class="by-btn by-btn-outline" href="buyer-product.html?id=' + encodeURIComponent(p.id) + '">التفاصيل الكاملة</a>' +
          '</div>' +
        '</div>' +
      '</div>', 'wide');

    var addBtn = $('#smQvAdd', body);
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        if (Buyer.addToCart(p.id, moq)) {
          if (window.SF) { SF.flyToCart($('.sm-qv-media img', body), p.img); SF.pulse(addBtn); }
          toast('أُضيف إلى السلة', 'success');
          refreshChrome();
          setTimeout(closeModal, 420);
        }
      });
    }

    var certBtn = $('[data-cert]', body);
    if (certBtn) certBtn.addEventListener('click', function () { showCertificate(p.id); });
  }

  function row(label, value) {
    return '<div><dt>' + esc(label) + '</dt><dd>' + value + '</dd></div>';
  }

  /* ============================================================
     2) شهادة المطابقة
     ============================================================ */
  function showCertificate(productId) {
    var p = Store.getProduct(productId);
    var cert = p && Smart.certification(p);
    if (!cert) return;

    openModal('شهادة ' + cert.label, '' +
      '<div class="sm-cert">' +
        '<div class="sm-cert-seal">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>' +
        '</div>' +

        '<h4>' + esc(p.name) + '</h4>' +
        '<p class="sm-cert-code" dir="ltr">' + esc(cert.code) + '</p>' +

        '<dl class="sm-qv-specs sm-cert-specs">' +
          row('المواصفة', cert.standard) +
          row('جهة التوثيق', cert.issuer) +
          row('المورد', p.brand || 'عام') +
          row('تاريخ التحقق', new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' })) +
        '</dl>' +

        '<ul class="sm-cert-checks">' +
          cert.checks.map(function (c) {
            return '<li class="' + (c.ok ? 'is-ok' : 'is-no') + '">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' +
              (c.ok ? '<polyline points="20 6 9 17 4 12"/>' : '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>') +
              '</svg>' + esc(c.label) + '</li>';
          }).join('') +
        '</ul>' +

        '<p class="sm-cert-note">تُشتق حالة التوثيق آلياً من اكتمال بيانات المنتج والمورد المسجّلة على المنصة. ' +
        'للحصول على نسخة شهادة المطابقة الرسمية الصادرة عن الجهة المختصة، تواصل مع المورد مباشرة.</p>' +
      '</div>');
  }

  /* ============================================================
     3) البحث بالصورة
     ============================================================ */
  function openVisualSearch() {
    var body = openModal('البحث بالصورة', '' +
      '<div class="sm-vs">' +
        '<label class="sm-vs-drop" id="smVsDrop">' +
          '<input type="file" id="smVsFile" accept="image/*" hidden />' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' +
          '<strong>اختر صورة منتج أو اسحبها هنا</strong>' +
          '<small>بلاط، حديد، بلوك… أي صورة من جوالك</small>' +
        '</label>' +

        '<p class="sm-vs-note">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>' +
          'المطابقة تتم داخل متصفحك بتحليل بصمة ألوان الصورة وخشونة نسيجها ومقارنتها بصور الكتالوج — ' +
          'لا تُرفع صورتك إلى أي خادم، ولا يُستخدم نموذج رؤية مدرّب، فالنتائج تشابه لوني لا تعرّف على المنتج.' +
        '</p>' +

        '<div id="smVsResult"></div>' +
      '</div>', 'wide');

    var input = $('#smVsFile', body);
    var drop = $('#smVsDrop', body);

    input.addEventListener('change', function () {
      if (this.files && this.files[0]) runVisualSearch(this.files[0]);
    });

    ['dragenter', 'dragover'].forEach(function (evt) {
      drop.addEventListener(evt, function (e) { e.preventDefault(); drop.classList.add('is-over'); });
    });
    ['dragleave', 'drop'].forEach(function (evt) {
      drop.addEventListener(evt, function (e) { e.preventDefault(); drop.classList.remove('is-over'); });
    });
    drop.addEventListener('drop', function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) runVisualSearch(f);
    });
  }

  function runVisualSearch(file) {
    var mount = $('#smVsResult');
    mount.innerHTML = '<div class="sm-loading"><span class="sm-spinner"></span>جارٍ تحليل الصورة ومقارنتها بالكتالوج…</div>';

    Smart.searchByImage(file, 6).then(function (res) {
      mount.innerHTML =
        '<div class="sm-vs-head">' +
          '<img class="sm-vs-preview" src="' + esc(res.preview) + '" alt="الصورة المرفوعة" />' +
          '<div>' +
            '<strong>بصمة الصورة</strong>' +
            '<span class="sm-swatch" style="background:rgb(' +
              Math.round(res.target.r) + ',' + Math.round(res.target.g) + ',' + Math.round(res.target.b) + ');"></span>' +
            '<small>سطوع ' + Math.round(res.target.lum) + ' · خشونة ' + Math.round(res.target.contrast) + '</small>' +
          '</div>' +
        '</div>' +
        '<div class="sm-vs-list">' +
          res.matches.map(function (m) {
            var lbl = Smart.matchLabel(m.score);
            return '<a class="sm-vs-item" href="buyer-product.html?id=' + encodeURIComponent(m.product.id) + '">' +
              '<img src="' + esc(m.product.img) + '" alt="" />' +
              '<span class="sm-vs-body">' +
                '<b>' + esc(m.product.name) + '</b>' +
                '<small>' + esc(m.product.brand || 'عام') + ' — ' + fmt(ByUI.effectivePrice(m.product)) + ' ر.س</small>' +
              '</span>' +
              '<span class="sm-match is-' + lbl.tone + '">' + lbl.label + '</span>' +
            '</a>';
          }).join('') +
        '</div>';
    }).catch(function (err) {
      mount.innerHTML = '<p class="sm-error">' + esc(err.message || 'تعذّر تحليل الصورة') + '</p>';
    });
  }

  /* ============================================================
     4) البحث الصوتي — Web Speech API
     ============================================================ */
  function speechAvailable() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function startVoiceSearch(inputEl, onDone) {
    var Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      toast('البحث الصوتي غير مدعوم في هذا المتصفح — جرّب Chrome أو Edge', 'warn');
      return null;
    }

    var rec = new Ctor();
    rec.lang = 'ar-SA';
    rec.interimResults = true;
    rec.continuous = false;

    var bubble = document.createElement('div');
    bubble.className = 'sm-voice';
    bubble.innerHTML =
      '<span class="sm-voice-wave"><i></i><i></i><i></i><i></i><i></i></span>' +
      '<strong id="smVoiceText">تكلّم الآن…</strong>' +
      '<button type="button" id="smVoiceStop">إيقاف</button>';
    document.body.appendChild(bubble);
    requestAnimationFrame(function () { bubble.classList.add('is-open'); });

    function cleanup() {
      bubble.classList.remove('is-open');
      setTimeout(function () { if (bubble.parentNode) bubble.parentNode.removeChild(bubble); }, 220);
    }

    $('#smVoiceStop', bubble).addEventListener('click', function () { rec.stop(); });

    rec.onresult = function (e) {
      var text = '';
      for (var i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      $('#smVoiceText', bubble).textContent = text || 'تكلّم الآن…';
      if (inputEl) inputEl.value = text;

      if (e.results[e.results.length - 1].isFinal) {
        cleanup();
        if (onDone) onDone(text);
      }
    };

    rec.onerror = function (e) {
      cleanup();
      var msg = e.error === 'not-allowed'
        ? 'لم تُمنح الصفحة إذن الميكروفون'
        : e.error === 'no-speech' ? 'لم أسمع شيئاً — حاول مجدداً' : 'تعذّر تشغيل البحث الصوتي';
      toast(msg, 'danger');
    };

    rec.onend = cleanup;

    try { rec.start(); } catch (e) { cleanup(); }
    return rec;
  }

  /* ============================================================
     5) مساعد التسوّق
     ============================================================ */
  var assistantReady = false;

  function ensureAssistant() {
    if (assistantReady || $('#smAsst')) { assistantReady = true; return; }
    assistantReady = true;

    var el = document.createElement('div');
    el.id = 'smAsst';
    el.className = 'sm-asst';
    el.innerHTML =
      '<button type="button" class="sm-asst-fab" id="smAsstFab" aria-label="مساعد التسوّق">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/></svg>' +
        '<span class="sm-asst-dot"></span>' +
      '</button>' +

      '<div class="sm-asst-panel" id="smAsstPanel" hidden>' +
        '<div class="sm-asst-head">' +
          '<span class="sm-asst-avatar">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>' +
          '</span>' +
          '<span><b>مساعد التسوّق</b><small>يحسب مواد مشروعك من وصفك</small></span>' +
          '<button type="button" class="sm-asst-close" id="smAsstClose" aria-label="إغلاق">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
          '</button>' +
        '</div>' +

        '<div class="sm-asst-body" id="smAsstBody"></div>' +

        '<form class="sm-asst-input" id="smAsstForm">' +
          '<input type="text" id="smAsstText" placeholder="مثال: أحتاج مواد لبناء جدار 20 متر" autocomplete="off" />' +
          '<button type="button" class="sm-asst-mic" id="smAsstMic" aria-label="إدخال صوتي">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>' +
          '</button>' +
          '<button type="submit" aria-label="إرسال">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
          '</button>' +
        '</form>' +
      '</div>';

    document.body.appendChild(el);

    $('#smAsstFab').addEventListener('click', toggleAssistant);
    $('#smAsstClose').addEventListener('click', toggleAssistant);
    $('#smAsstForm').addEventListener('submit', function (e) {
      e.preventDefault();
      sendAssistant($('#smAsstText').value);
    });

    var mic = $('#smAsstMic');
    if (!speechAvailable()) mic.hidden = true;
    mic.addEventListener('click', function () {
      startVoiceSearch($('#smAsstText'), function (text) { sendAssistant(text); });
    });

    greetAssistant();
  }

  function toggleAssistant() {
    var panel = $('#smAsstPanel');
    var open = panel.hidden;
    panel.hidden = !open;
    $('#smAsstFab').classList.toggle('is-open', open);
    if (open) {
      $('#smAsstDot') && ($('#smAsstDot').hidden = true);
      setTimeout(function () { $('#smAsstText').focus(); }, 120);
    }
  }

  function pushBubble(kind, html) {
    var body = $('#smAsstBody');
    var b = document.createElement('div');
    b.className = 'sm-bubble is-' + kind;
    b.innerHTML = html;
    body.appendChild(b);
    body.scrollTop = body.scrollHeight;
    return b;
  }

  function greetAssistant() {
    pushBubble('bot',
      '<p>أهلاً بك. صِف لي ما تريد بناءه وسأحسب لك المواد والكميات التقديرية.</p>' +
      '<div class="sm-chips">' +
        ['جدار بلوك 20 متر × 3', 'سقف 8 × 6 سماكة 20 سم', 'تبليط غرفة 5 × 4', 'دهان 60 م²']
          .map(function (s) { return '<button type="button" class="sm-chip" data-ask="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') +
      '</div>' +
      '<p class="sm-disclaimer">التقديرات استرشادية مبنية على معاملات تنفيذ متعارف عليها، وليست بديلاً عن حساب المهندس المشرف.</p>'
    );
    bindAskChips();
  }

  function bindAskChips() {
    $all('[data-ask]', $('#smAsstBody')).forEach(function (btn) {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () { sendAssistant(btn.getAttribute('data-ask')); });
    });
  }

  function sendAssistant(text) {
    var value = String(text || '').trim();
    if (!value) return;

    $('#smAsstText').value = '';
    pushBubble('me', '<p>' + esc(value) + '</p>');

    var thinking = pushBubble('bot', '<span class="sm-typing"><i></i><i></i><i></i></span>');

    setTimeout(function () {
      var res = Smart.assist(value);
      thinking.remove();

      if (!res.ok) {
        pushBubble('bot',
          '<p>' + esc(res.message) + '</p>' +
          (res.suggestions
            ? '<div class="sm-chips">' + res.suggestions.map(function (s) {
                return '<button type="button" class="sm-chip" data-ask="' + esc(s) + '">' + esc(s) + '</button>';
              }).join('') + '</div>'
            : '')
        );
        bindAskChips();
        return;
      }

      Smart.logAssistant({ q: value, at: Date.now(), total: res.total });

      pushBubble('bot',
        '<p><b>' + esc(res.mode.label) + '</b> — ' + esc(res.summary) + '</p>' +
        (res.assumed && res.assumed.length
          ? '<p class="sm-assumed">افترضتُ: ' + esc(res.assumed.join('، ')) + '</p>' : '') +

        '<div class="sm-bom">' +
          res.lines.map(function (l) {
            return '<div class="sm-bom-row">' +
              '<img src="' + esc(l.product.img) + '" alt="" />' +
              '<span><b>' + esc(l.product.name) + '</b>' +
              '<small>' + fmt(l.qty) + ' ' + esc(l.product.unit || 'وحدة') + ' · ' + esc(l.note) + '</small></span>' +
              '<em>' + fmt(l.lineTotal) + ' ر.س</em>' +
            '</div>';
          }).join('') +
        '</div>' +

        '<div class="sm-bom-total"><span>التكلفة التقديرية</span><strong>' + fmt(res.total) + ' ر.س</strong></div>' +
        '<button type="button" class="by-btn by-btn-primary sm-bom-add" data-bom="1">أضف القائمة كاملة إلى السلة</button>' +
        '<p class="sm-disclaimer">الكميات تقديرية وشاملة الضريبة، وقد تختلف حسب طريقة التنفيذ والهدر الفعلي.</p>'
      );

      var addBtn = $('.sm-bom-add', $('#smAsstBody').lastChild);
      addBtn.addEventListener('click', function () {
        res.lines.forEach(function (l) { Buyer.addToCart(l.product.id, l.qty); });
        refreshChrome();
        if (window.SF) SF.bumpCart();
        toast('أُضيفت ' + res.lines.length + ' مواد إلى سلتك', 'success');
        addBtn.disabled = true;
        addBtn.textContent = 'أُضيفت إلى السلة ✓';
      });
    }, 420);
  }

  /* ============================================================
     6) حاسبة الكميات (داخل صفحة المنتج)
     ============================================================ */
  // كل فئة ترتبط بوضع الحساب الأنسب لها
  var CATEGORY_MODE = {
    blocks: 'wall', cement: 'wall', concrete: 'slab',
    steel: 'slab', finishing: 'floor'
  };

  function calculatorFor(product) {
    return CATEGORY_MODE[product.category] || null;
  }

  function renderCalculator(mount, product) {
    var modeKey = calculatorFor(product);
    if (!mount || !modeKey) return false;

    var mode = Smart.CALC_MODES[modeKey];
    var modeKeys = Object.keys(Smart.CALC_MODES);

    mount.innerHTML =
      '<h3 class="by-panel-title">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="18"/><line x1="8" y1="18" x2="12" y2="18"/></svg>' +
        'حاسبة الكمية' +
      '</h3>' +
      '<p class="sm-calc-lead">أدخل أبعاد مشروعك لنقدّر الكمية والتكلفة تلقائياً.</p>' +

      '<div class="sm-calc-modes" id="smCalcModes">' +
        modeKeys.map(function (k) {
          return '<button type="button" class="by-chip' + (k === modeKey ? ' is-on' : '') + '" data-mode="' + k + '">' +
            esc(Smart.CALC_MODES[k].label) + '</button>';
        }).join('') +
      '</div>' +

      '<div class="sm-calc-fields" id="smCalcFields"></div>' +
      '<div id="smCalcResult"></div>';

    var current = modeKey;

    function drawFields() {
      var m = Smart.CALC_MODES[current];
      $('#smCalcFields').innerHTML = m.fields.map(function (f) {
        return '<label class="sm-calc-field">' +
          '<span>' + esc(f.label) + ' <small>(' + esc(f.unit) + ')</small></span>' +
          '<input type="text" inputmode="decimal" data-calc="' + f.key + '" value="' + f.def + '" />' +
        '</label>';
      }).join('');

      $all('[data-calc]').forEach(function (input) {
        input.addEventListener('input', function () {
          this.value = this.value.replace(/[^0-9.]/g, '');
          compute();
        });
      });

      compute();
    }

    function compute() {
      var values = {};
      $all('[data-calc]').forEach(function (input) {
        values[input.getAttribute('data-calc')] = parseFloat(input.value) || 0;
      });

      var bad = Object.keys(values).some(function (k) { return values[k] <= 0; });
      if (bad) {
        $('#smCalcResult').innerHTML = '<p class="sm-calc-hint">أدخل قيماً أكبر من صفر لعرض التقدير.</p>';
        return;
      }

      // المنتج المعروض يُفضَّل في نتيجته إن كان من نفس الفئة
      var res = Smart.calculate(current, values, product.id);
      if (!res || !res.lines.length) {
        $('#smCalcResult').innerHTML = '<p class="sm-calc-hint">لا توجد منتجات متاحة لتغطية هذا الحساب.</p>';
        return;
      }

      $('#smCalcResult').innerHTML =
        '<p class="sm-calc-summary">' + esc(res.summary) + '</p>' +
        '<div class="sm-bom">' +
          res.lines.map(function (l) {
            return '<div class="sm-bom-row">' +
              '<img src="' + esc(l.product.img) + '" alt="" />' +
              '<span><b>' + esc(l.product.name) + '</b>' +
              '<small>' + fmt(l.qty) + ' ' + esc(l.product.unit || 'وحدة') + ' · ' + esc(l.note) + '</small></span>' +
              '<em>' + fmt(l.lineTotal) + ' ر.س</em>' +
            '</div>';
          }).join('') +
        '</div>' +
        '<div class="sm-bom-total"><span>التكلفة التقديرية</span><strong>' + fmt(res.total) + ' ر.س</strong></div>' +
        '<button type="button" class="by-btn by-btn-primary" id="smCalcAdd">أضف الكميات إلى السلة</button>' +
        '<p class="sm-disclaimer">تقدير استرشادي وفق معاملات تنفيذ شائعة — راجع المهندس المشرف قبل الطلب النهائي.</p>';

      $('#smCalcAdd').addEventListener('click', function () {
        res.lines.forEach(function (l) { Buyer.addToCart(l.product.id, l.qty); });
        refreshChrome();
        if (window.SF) SF.bumpCart();
        toast('أُضيفت ' + res.lines.length + ' مواد إلى سلتك', 'success');
      });
    }

    $all('[data-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        current = btn.getAttribute('data-mode');
        $all('[data-mode]').forEach(function (b) { b.classList.toggle('is-on', b === btn); });
        drawFields();
      });
    });

    drawFields();
    return true;
  }

  /* ============================================================
     7) الخط الزمني المرئي للطلب
     ============================================================ */
  var TIMELINE = [
    { key: 'pending', label: 'تم استلام الطلب', ico: '<polyline points="20 6 9 17 4 12"/>' },
    { key: 'processing', label: 'قيد التجهيز', ico: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>' },
    { key: 'shipping', label: 'في الطريق إليك', ico: '<rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>' },
    { key: 'delivered', label: 'تم التسليم', ico: '<path d="M20 6 9 17l-5-5"/><path d="M3 12a9 9 0 1 0 9-9"/>' }
  ];

  // الحالات الوسيطة تُطوى إلى المرحلة المرئية التي تنتمي إليها
  var STAGE_OF = {
    pending: 0, confirmed: 1, processing: 1, ready: 1,
    shipping: 2, delivered: 3, cancelled: -1, failed: -1, returned: -1
  };

  function renderTimeline(mount, order) {
    if (!mount || !order) return;

    var stage = STAGE_OF[order.status];
    if (stage === undefined) stage = 0;

    if (stage === -1) {
      var meta = Store.STATUS_META[order.status] || { label: order.status };
      mount.innerHTML =
        '<div class="sm-tl-halt">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>' +
          '<div><strong>' + esc(meta.label) + '</strong>' +
          (order.cancelReason ? '<small>' + esc(order.cancelReason) + '</small>' : '') + '</div>' +
        '</div>';
      return;
    }

    // آخر وقت مسجّل لكل مرحلة من سجل الحالات الفعلي
    var times = {};
    (order.statusHistory || []).forEach(function (h) {
      var s = STAGE_OF[h.status];
      if (s !== undefined && s >= 0 && !times[s]) times[s] = h.at;
    });

    mount.innerHTML =
      '<div class="sm-tl" style="--sm-tl-progress:' + Math.round(stage / (TIMELINE.length - 1) * 100) + '%;">' +
        '<div class="sm-tl-track"><span class="sm-tl-fill"></span></div>' +
        TIMELINE.map(function (step, i) {
          var state = i < stage ? 'is-done' : i === stage ? 'is-current' : '';
          return '<div class="sm-tl-step ' + state + '">' +
            '<span class="sm-tl-dot">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + step.ico + '</svg>' +
            '</span>' +
            '<span class="sm-tl-label">' + esc(step.label) + '</span>' +
            '<span class="sm-tl-time">' + (times[i] ? esc(shortTime(times[i])) : (i <= stage ? '—' : 'قيد الانتظار')) + '</span>' +
          '</div>';
        }).join('') +
      '</div>' +
      (order.tracking
        ? '<a class="sm-tl-track-link" href="' + esc(Store.trackingUrl(order.tracking) || '#') + '" target="_blank" rel="noopener">' +
          'تتبّع الشحنة لدى ' + esc((Store.carrierByKey(order.tracking.carrier) || {}).name || 'شركة الشحن') +
          ' — <code dir="ltr">' + esc(order.tracking.number) + '</code></a>'
        : '');
  }

  function shortTime(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' }) +
      ' · ' + d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  }

  /* ============================================================
     8) مبدّل الوضع الداكن
     ============================================================ */
  function currentTheme() {
    try { return localStorage.getItem('ammar_theme') === 'dark' ? 'dark' : 'light'; } catch (e) { return 'light'; }
  }

  function setTheme(theme) {
    var next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('ammar_theme', next); } catch (e) { /* ignore */ }
    syncThemeButtons();
  }

  function syncThemeButtons() {
    var dark = currentTheme() === 'dark';
    $all('[data-theme-toggle]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
      btn.title = dark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن';
    });
  }

  function initThemeToggle() {
    var tools = $('.by-tools');
    if (!tools || $('[data-theme-toggle]')) { syncThemeButtons(); return; }

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'by-icon-btn sm-theme-btn';
    btn.setAttribute('data-theme-toggle', '');
    btn.setAttribute('aria-label', 'تبديل الوضع الداكن');
    btn.innerHTML =
      '<svg class="sm-ico-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.2" y1="4.2" x2="5.6" y2="5.6"/><line x1="18.4" y1="18.4" x2="19.8" y2="19.8"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.2" y1="19.8" x2="5.6" y2="18.4"/><line x1="18.4" y1="5.6" x2="19.8" y2="4.2"/></svg>' +
      '<svg class="sm-ico-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

    btn.addEventListener('click', function () {
      setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
      toast(currentTheme() === 'dark' ? 'تم تفعيل الوضع الداكن' : 'تم تفعيل الوضع الفاتح', 'success');
    });

    tools.insertBefore(btn, tools.firstChild);
    syncThemeButtons();
  }

  return {
    openModal: openModal,
    closeModal: closeModal,
    quickView: quickView,
    showCertificate: showCertificate,
    openVisualSearch: openVisualSearch,
    speechAvailable: speechAvailable,
    startVoiceSearch: startVoiceSearch,
    ensureAssistant: ensureAssistant,
    calculatorFor: calculatorFor,
    renderCalculator: renderCalculator,
    renderTimeline: renderTimeline,
    initThemeToggle: initThemeToggle,
    setTheme: setTheme,
    currentTheme: currentTheme
  };
})();
