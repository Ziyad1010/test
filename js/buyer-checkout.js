(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var esc = ByUI.esc;
  var fmt = ByUI.fmt;

  var K_DRAFT = 'ammar_checkout_draft';

  var step = 1;
  var payMethod = 'mada';
  var draft = {};

  /* ---------------- مسودة محفوظة ---------------- */
  // ما يكتبه المستخدم يبقى إن أغلق الصفحة أو رجع للخلف
  function loadDraft() {
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(K_DRAFT) || '{}'); } catch (e) { saved = {}; }

    var guest = Buyer.guestInfo() || {};
    var addr = ByUI.defaultAddress() || {};
    var profile = Buyer.profile();

    draft = {
      name: saved.name || guest.name || addr.recipient || profile.name || '',
      phone: saved.phone || guest.phone || addr.phone || profile.phone || '',
      email: saved.email || guest.email || profile.email || '',
      city: saved.city || addr.city || ByUI.getCity() || 'الرياض',
      district: saved.district || addr.district || '',
      street: saved.street || addr.street || '',
      notes: saved.notes || '',
      saveAddress: saved.saveAddress !== false
    };

    payMethod = saved.payMethod || 'mada';
  }

  function saveDraft() {
    draft.payMethod = payMethod;
    try { localStorage.setItem(K_DRAFT, JSON.stringify(draft)); } catch (e) { /* ignore */ }
  }

  function clearDraft() {
    try { localStorage.removeItem(K_DRAFT); } catch (e) { /* ignore */ }
  }

  /* ---------------- مدن وأحياء ---------------- */
  function allCities() {
    var out = [];
    (window.SAUDI_REGIONS || []).forEach(function (r) {
      (r.cities || []).forEach(function (c) { out.push(c); });
    });
    if (!out.length) out = ByUI.CITIES.map(function (n) { return { name: n, districts: [] }; });
    return out;
  }

  function districtsOf(cityName) {
    var found = null;
    allCities().forEach(function (c) { if (c.name === cityName) found = c; });
    return (found && found.districts) || [];
  }

  function fillCities() {
    var select = $('#coCity');
    select.innerHTML = allCities().map(function (c) {
      return '<option value="' + esc(c.name) + '"' + (c.name === draft.city ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');
    fillDistricts();
  }

  function fillDistricts() {
    var select = $('#coDistrict');
    var list = districtsOf($('#coCity').value);

    if (!list.length) {
      // لا نملك أحياء موثّقة لكل مدينة، فنترك المستخدم يكتب الحي يدوياً
      select.innerHTML = '<option value="">— اكتب الحي في حقل الشارع —</option>';
      select.disabled = true;
      return;
    }

    select.disabled = false;
    select.innerHTML = '<option value="">اختر الحي</option>' + list.map(function (d) {
      return '<option value="' + esc(d) + '"' + (d === draft.district ? ' selected' : '') + '>' + esc(d) + '</option>';
    }).join('');
  }

  /* ---------------- التحقق الفوري ---------------- */
  var RULES = {
    name: function (v) {
      if (!v.trim()) return 'اكتب اسمك الكامل';
      if (v.trim().length < 4) return 'الاسم قصير جداً';
      return '';
    },
    phone: function (v) {
      var digits = v.replace(/[^0-9]/g, '');
      if (!digits) return 'رقم الجوال مطلوب لتأكيد التوصيل';
      if (!/^(05\d{8}|9665\d{8})$/.test(digits)) return 'أدخل رقماً سعودياً يبدأ بـ 05';
      return '';
    },
    email: function (v) {
      if (!v.trim()) return '';   // اختياري فعلاً
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())) return 'صيغة البريد غير صحيحة';
      return '';
    },
    city: function (v) { return v ? '' : 'اختر المدينة'; },
    district: function () {
      var select = $('#coDistrict');
      if (select.disabled) return '';
      return select.value ? '' : 'اختر الحي';
    },
    street: function (v) {
      if (!v.trim()) return 'اكتب اسم الشارع ورقم المبنى';
      if (v.trim().length < 5) return 'العنوان مختصر جداً';
      return '';
    },
    notes: function () { return ''; }
  };

  function fieldOf(key) { return $('[data-field="' + key + '"]'); }

  function validateField(key, quiet) {
    var wrap = fieldOf(key);
    if (!wrap) return true;

    var input = $('input, select, textarea', wrap);
    var error = RULES[key] ? RULES[key](input.value || '') : '';
    var msg = $('.by-field-msg', wrap);

    wrap.classList.remove('is-valid', 'is-invalid');

    if (error) {
      if (!quiet) { wrap.classList.add('is-invalid'); msg.textContent = error; }
      else { msg.textContent = ''; }
      return false;
    }

    if (input.value && key !== 'notes') wrap.classList.add('is-valid');
    msg.textContent = '';
    return true;
  }

  function validateStep1(quiet) {
    var keys = ['name', 'phone', 'email', 'city', 'district', 'street'];
    var ok = true;
    keys.forEach(function (k) { if (!validateField(k, quiet)) ok = false; });
    return ok;
  }

  /* ---------------- اقتراح العنوان ---------------- */
  function streetSuggestions(query) {
    var city = $('#coCity').value;
    var district = $('#coDistrict').value;
    var base = [];

    // عناوين المستخدم المحفوظة أولاً — هذه بيانات حقيقية لا تخمين
    Buyer.addresses().forEach(function (a) {
      if (a.street) base.push(a.street + (a.city ? ' — ' + a.city : ''));
    });

    // ثم أنماط شائعة تُكمل ما بدأ بكتابته
    ['طريق الملك فهد', 'طريق الملك عبدالعزيز', 'شارع الأمير سلطان', 'شارع التحلية', 'الطريق الدائري']
      .forEach(function (s) { base.push(s + (district ? '، ' + district : '') + '، ' + city); });

    var q = Buyer.normalize(query);
    return base.filter(function (s) { return Buyer.normalize(s).indexOf(q) !== -1; }).slice(0, 5);
  }

  function bindStreetSuggest() {
    var input = $('#coStreet');
    var box = $('#coStreetSuggest');

    input.addEventListener('input', function () {
      var value = this.value.trim();
      if (value.length < 2) { box.hidden = true; return; }

      var list = streetSuggestions(value);
      if (!list.length) { box.hidden = true; return; }

      box.hidden = false;
      box.innerHTML = list.map(function (s) {
        return '<button type="button" data-addr="' + esc(s) + '">' + esc(s) + '</button>';
      }).join('');

      $all('[data-addr]', box).forEach(function (btn) {
        btn.addEventListener('click', function () {
          input.value = btn.getAttribute('data-addr');
          box.hidden = true;
          draft.street = input.value;
          saveDraft();
          validateField('street');
        });
      });
    });

    input.addEventListener('blur', function () {
      setTimeout(function () { box.hidden = true; }, 160);
    });
  }

  /* ---------------- طرق الدفع ---------------- */
  var PAY_METHODS = [
    { key: 'mada', name: 'بطاقة مدى', desc: 'خصم مباشر من حسابك البنكي', logo: 'mada' },
    { key: 'card', name: 'بطاقة ائتمانية', desc: 'فيزا أو ماستركارد', logo: 'card' },
    { key: 'applepay', name: 'Apple Pay', desc: 'دفع سريع بلمسة واحدة', logo: 'apple' },
    { key: 'transfer', name: 'تحويل بنكي', desc: 'يُشحن الطلب بعد تأكيد التحويل', logo: 'bank' },
    { key: 'cod', name: 'الدفع عند الاستلام', desc: 'رسوم إضافية 25 ر.س على الطلبات أقل من 1,000 ر.س', logo: 'cod' }
  ];

  var LOGOS = {
    mada: '<span class="by-pay-logo mada">مدى</span>',
    card: '<span class="by-pay-logo visa">VISA</span><span class="by-pay-logo mc"><i></i><i></i></span>',
    apple: '<span class="by-pay-logo apple">&#63743; Pay</span>',
    bank: '<span class="by-pay-logo bank">IBAN</span>',
    cod: '<span class="by-pay-logo cod">نقداً</span>'
  };

  function codFee() {
    if (payMethod !== 'cod') return 0;
    return Buyer.orderSummary(draft.city).subtotal < 1000 ? 25 : 0;
  }

  function renderPayMethods() {
    $('#coPayMethods').innerHTML = PAY_METHODS.map(function (m) {
      return '<label class="by-choice' + (payMethod === m.key ? ' is-on' : '') + '">' +
        '<input type="radio" name="coPay" value="' + m.key + '"' + (payMethod === m.key ? ' checked' : '') + ' />' +
        '<span class="by-choice-body"><strong>' + esc(m.name) + '</strong><small>' + esc(m.desc) + '</small></span>' +
        '<span class="by-choice-logo">' + LOGOS[m.logo] + '</span>' +
      '</label>';
    }).join('');

    $all('input[name="coPay"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        payMethod = this.value;
        saveDraft();
        renderPayMethods();
        renderPayExtra();
        renderSummary();
      });
    });

    renderPayExtra();
  }

  function renderPayExtra() {
    var extra = $('#coPayExtra');

    if (payMethod === 'transfer') {
      var bank = (Store.getBankAccounts && Store.getBankAccounts()[0]) || null;
      extra.innerHTML = '<div class="by-note-box">' +
        '<strong>تفاصيل التحويل</strong>' +
        '<p>حوّل المبلغ إلى الحساب التالي، وأرفق إيصال التحويل من صفحة الطلب بعد التأكيد.</p>' +
        (bank
          ? '<p><b>' + esc(bank.bank || '') + '</b><br /><span dir="ltr">' + esc(bank.iban || '') + '</span></p>'
          : '<p><b>مصرف الراجحي</b><br /><span dir="ltr">SA00 0000 0000 0000 0000 0000</span></p>') +
      '</div>';
      return;
    }

    if (payMethod === 'cod') {
      var fee = codFee();
      extra.innerHTML = '<div class="by-note-box">' +
        '<strong>الدفع عند الاستلام</strong>' +
        '<p>' + (fee ? 'ستُضاف رسوم ' + fee + ' ر.س إلى إجمالي طلبك.' : 'لا رسوم إضافية على طلبك — القيمة تتجاوز 1,000 ر.س.') +
        ' جهّز المبلغ نقداً أو عبر الشبكة عند وصول المندوب.</p>' +
      '</div>';
      return;
    }

    if (payMethod === 'mada' || payMethod === 'card' || payMethod === 'applepay') {
      // لا واجهة بطاقة هنا: الدفع الفعلي يتم على صفحة البوابة الآمنة
      extra.innerHTML = '<div class="by-note-box">' +
        '<strong>تحويل آمن إلى بوابة الدفع</strong>' +
        '<p>بعد الضغط على «تأكيد الطلب والدفع» ستُحوَّل إلى صفحة البوابة البنكية لإتمام العملية. ' +
        'لا تُدخل بيانات بطاقتك داخل المنصة إطلاقاً.</p>' +
      '</div>';
      return;
    }

    extra.innerHTML = '';
  }

  /* ---------------- الملخص ---------------- */
  function summary() {
    return Buyer.orderSummary(draft.city);
  }

  function renderSummary() {
    var sum = summary();
    var fee = codFee();
    var total = sum.total + fee;

    $('#coSummary').innerHTML =
      '<h3 class="by-panel-title">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
        'ملخص الطلب' +
      '</h3>' +

      '<div class="by-summary-items">' +
        sum.lines.map(function (l) {
          return '<div class="by-summary-item">' +
            '<img src="' + esc(l.product.img) + '" alt="" />' +
            '<span><b>' + esc(l.product.name) + '</b><small>' + fmt(l.qty) + ' × ' + fmt(l.unitPrice) + ' ر.س</small></span>' +
            '<em>' + fmt(l.lineTotal) + '</em>' +
          '</div>';
        }).join('') +
      '</div>' +

      '<div class="by-totals">' +
        '<div class="by-total-row"><span>المجموع</span><span>' + fmt(sum.subtotal) + ' ر.س</span></div>' +
        (sum.discount ? '<div class="by-total-row save"><span>خصم ' + esc((sum.promo || {}).code || '') + '</span><span>-' + fmt(sum.discount) + ' ر.س</span></div>' : '') +
        '<div class="by-total-row"><span>الشحن إلى ' + esc(draft.city) + '</span><span>' +
          (sum.shippingFree ? 'مجاني' : fmt(sum.shipping) + ' ر.س') + '</span></div>' +
        (fee ? '<div class="by-total-row"><span>رسوم الدفع عند الاستلام</span><span>' + fmt(fee) + ' ر.س</span></div>' : '') +
        '<div class="by-total-row muted"><span>منها ضريبة القيمة المضافة ' + (Store.VAT_RATE * 100) + '%</span><span>' + fmt(sum.vat) + ' ر.س</span></div>' +
        '<div class="by-total-row grand"><span>الإجمالي</span><span>' + fmt(total) + ' ر.س</span></div>' +
      '</div>' +

      '<div class="by-trust" style="margin-top:14px;">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' +
        '<span>ضمان استرداد المبلغ إن لم يصل الطلب مطابقاً للوصف</span>' +
      '</div>' +
      '<div class="by-trust">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9"/><polyline points="3 3 3 12 12 12"/></svg>' +
        '<span>إرجاع مجاني خلال 7 أيام للمنتجات غير المستخدمة</span>' +
      '</div>' +

      '<div class="by-pay-logos">' + LOGOS.mada + LOGOS.card + LOGOS.apple + LOGOS.bank + '</div>';

    $('#coStickyTotal').textContent = fmt(total) + ' ر.س';
    $('#coStickyBtn').textContent = step === 3 ? 'تأكيد الطلب والدفع' : 'متابعة';
    $('#coSticky').hidden = false;
  }

  /* ---------------- المراجعة ---------------- */
  function renderReview() {
    var sum = summary();
    var method = PAY_METHODS.filter(function (m) { return m.key === payMethod; })[0] || PAY_METHODS[0];
    var eta = etaText();

    $('#coReviewAddress').innerHTML =
      '<p><b>' + esc(draft.name) + '</b> — <span dir="ltr">' + esc(draft.phone) + '</span></p>' +
      '<p>' + esc([draft.city, draft.district, draft.street].filter(Boolean).join('، ')) + '</p>' +
      (draft.email ? '<p dir="ltr">' + esc(draft.email) + '</p>' : '') +
      (draft.notes ? '<p class="muted">ملاحظات: ' + esc(draft.notes) + '</p>' : '') +
      '<p class="by-eta-inline">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>' +
        'التسليم المتوقع: <b>' + esc(eta) + '</b></p>';

    $('#coReviewPayment').innerHTML =
      '<p>' + LOGOS[method.logo] + ' <b>' + esc(method.name) + '</b></p>' +
      '<p class="muted">' + esc(method.desc) + '</p>';

    $('#coReviewItems').innerHTML = sum.lines.map(function (l) {
      return '<div class="by-summary-item">' +
        '<img src="' + esc(l.product.img) + '" alt="" />' +
        '<span><b>' + esc(l.product.name) + '</b><small>' + esc(l.product.brand || 'عام') + ' — ' +
          fmt(l.qty) + ' ' + esc(l.product.unit || 'وحدة') + '</small></span>' +
        '<em>' + fmt(l.lineTotal) + ' ر.س</em>' +
      '</div>';
    }).join('');
  }

  // مدة التسليم تُشتق من أبطأ منتج في السلة، لا من متوسط متفائل
  function etaDays() {
    var days = 2;
    Buyer.cartLines().forEach(function (l) {
      var a = Store.deriveAvailability(l.product);
      if (a === 'on_demand') days = Math.max(days, 4);
      else if (a === 'limited') days = Math.max(days, 3);
    });

    var far = ['أبها', 'جازان', 'نجران', 'تبوك', 'حائل', 'عرعر', 'سكاكا'];
    if (far.indexOf(draft.city) !== -1) days += 2;
    return days;
  }

  function etaText() {
    var d = new Date();
    d.setDate(d.getDate() + etaDays());
    return d.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  /* ---------------- التنقل بين الخطوات ---------------- */
  function goStep(next) {
    step = next;

    $('#coStep1').hidden = step !== 1;
    $('#coStep2').hidden = step !== 2;
    $('#coStep3').hidden = step !== 3;

    $all('.by-step').forEach(function (el) {
      var n = parseInt(el.getAttribute('data-step'), 10);
      el.classList.toggle('is-current', n === step);
      el.classList.toggle('is-done', n < step);
    });

    var remaining = 3 - step;
    $('#coRemain').textContent = remaining === 0
      ? 'خطوة أخيرة — راجع التفاصيل ثم أكّد'
      : remaining === 1 ? 'خطوة واحدة متبقية' : 'خطوتان متبقيتان — الحقول الاختيارية موضّحة بوضوح';

    if (step === 3) renderReview();
    renderSummary();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------- الإرسال ---------------- */
  function confirmOrder() {
    if (!$('#coTerms').checked) {
      $('#coTermsMsg').textContent = 'يجب الموافقة على الشروط قبل تأكيد الطلب';
      $('#coTermsMsg').style.color = 'var(--danger)';
      return;
    }

    var lines = Buyer.cartLines();
    if (!lines.length) return;

    var btn = $('#coConfirm');
    btn.disabled = true;
    btn.textContent = 'جارٍ تأكيد الطلب…';

    var sum = summary();
    var fee = codFee();
    var method = PAY_METHODS.filter(function (m) { return m.key === payMethod; })[0];
    var today = new Date().toISOString().slice(0, 10);

    var eta = new Date();
    eta.setDate(eta.getDate() + etaDays());

    // لا بوابة دفع ولا خادم هنا؛ الطلب يُسجَّل في نفس مخزن البيانات
    // فيظهر فوراً لدى المورد وفي صفحة "طلباتي"
    var order = {
      id: 'ORD-' + Date.now().toString().slice(-6),
      date: today,
      createdAt: today + 'T' + new Date().toTimeString().slice(0, 5),
      city: draft.city,
      district: draft.district || '',
      address: [draft.city, draft.district, draft.street].filter(Boolean).join(' - '),
      customerId: Buyer.buyerId(),
      customer: draft.name,
      email: draft.email || '',
      phone: draft.phone || '',
      payment: method ? method.name : 'غير محدد',
      paymentStatus: payMethod === 'cod' || payMethod === 'transfer' ? 'pending' : 'paid',
      status: 'pending',
      items: lines.map(function (l) {
        return {
          productId: l.product.id, name: l.product.name, qty: l.qty,
          price: l.unitPrice, unit: l.product.unit || '', fulfilled: 0
        };
      }),
      subtotal: Math.round(sum.subtotal * 100) / 100,
      discount: Math.round(sum.discount * 100) / 100,
      promoCode: (sum.promo || {}).code || '',
      shipping: Math.round((sum.shipping + fee) * 100) / 100,
      vat: Math.round(sum.vat * 100) / 100,
      total: Math.round((sum.total + fee) * 100) / 100,
      notes: draft.notes || '',
      expectedShipDate: today,
      expectedDelivery: eta.toISOString().slice(0, 10),
      tracking: null,
      cancelReason: '',
      returnRequest: null
    };

    Store.placeOrder(order);

    if (draft.saveAddress) {
      Buyer.saveAddress({
        label: 'عنوان التوصيل', recipient: draft.name, phone: draft.phone,
        city: draft.city, district: draft.district, street: draft.street
      });
    }
    Buyer.saveGuestInfo({ name: draft.name, phone: draft.phone, email: draft.email });

    Buyer.clearCart();
    Buyer.clearPromo();
    clearDraft();

    window.location.href = 'buyer-confirmation.html?id=' + encodeURIComponent(order.id);
  }

  /* ---------------- الربط ---------------- */
  function bindForm() {
    var map = {
      coName: 'name', coPhone: 'phone', coEmail: 'email',
      coCity: 'city', coDistrict: 'district', coStreet: 'street', coNotes: 'notes'
    };

    Object.keys(map).forEach(function (id) {
      var key = map[id];
      var el = $('#' + id);
      el.value = draft[key] || '';

      var evt = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(evt, function () {
        draft[key] = this.value;
        saveDraft();
        if (key === 'city') {
          ByUI.setCity(this.value);
          draft.district = '';          // أحياء المدينة السابقة لم تعد صالحة
          fillDistricts();
          renderSummary();
        }
        // نتحقق بهدوء أثناء الكتابة ونُظهر الخطأ عند مغادرة الحقل
        validateField(key, true);
      });
      el.addEventListener('blur', function () { validateField(key); });
    });

    $('#coPhone').addEventListener('input', function () {
      this.value = this.value.replace(/[^0-9+]/g, '');
    });

    $('#coSaveAddress').checked = draft.saveAddress;
    $('#coSaveAddress').addEventListener('change', function () {
      draft.saveAddress = this.checked;
      saveDraft();
    });

    $('#coTerms').addEventListener('change', function () {
      if (this.checked) $('#coTermsMsg').textContent = '';
    });
  }

  function renderSavedAddresses() {
    var list = Buyer.addresses();
    if (!list.length) { $('#coSavedAddresses').innerHTML = ''; return; }

    $('#coSavedAddresses').innerHTML =
      '<p class="by-saved-title">عناوينك المحفوظة — اختر واحداً لتعبئة الحقول تلقائياً</p>' +
      '<div class="by-saved-list">' +
        list.map(function (a) {
          return '<button type="button" class="by-saved-addr" data-saved="' + esc(a.id) + '">' +
            '<b>' + esc(a.label || 'عنوان') + '</b>' +
            '<small>' + esc([a.city, a.district, a.street].filter(Boolean).join('، ')) + '</small>' +
          '</button>';
        }).join('') +
      '</div>';

    $all('[data-saved]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var a = Buyer.address(btn.getAttribute('data-saved'));
        if (!a) return;

        draft.name = a.recipient || draft.name;
        draft.phone = a.phone || draft.phone;
        draft.city = a.city || draft.city;
        draft.district = a.district || '';
        draft.street = a.street || '';
        saveDraft();

        $('#coName').value = draft.name;
        $('#coPhone').value = draft.phone;
        fillCities();
        $('#coStreet').value = draft.street;

        validateStep1(true);
        renderSummary();
        ByUI.toast('تم تعبئة العنوان', 'success');
      });
    });
  }

  /* ---------------- التشغيل ---------------- */
  document.addEventListener('DOMContentLoaded', function () {
    loadDraft();

    if (!Buyer.cartLines().length) {
      $('#coGrid').hidden = true;
      $('#coSteps').hidden = true;
      $('#coRemain').hidden = true;
      $('#coEmpty').hidden = false;
      return;
    }

    fillCities();
    bindForm();
    bindStreetSuggest();
    renderSavedAddresses();
    renderPayMethods();
    goStep(1);

    $('#coNext1').addEventListener('click', function () {
      if (!validateStep1()) {
        ByUI.toast('أكمل الحقول المطلوبة أولاً', 'danger');
        var bad = $('.by-field.is-invalid input, .by-field.is-invalid select');
        if (bad) bad.focus();
        return;
      }
      goStep(2);
    });

    $('#coBack2').addEventListener('click', function () { goStep(1); });
    $('#coNext2').addEventListener('click', function () { goStep(3); });
    $('#coBack3').addEventListener('click', function () { goStep(2); });
    $('#coConfirm').addEventListener('click', confirmOrder);

    $('#coStickyBtn').addEventListener('click', function () {
      if (step === 1) { $('#coNext1').click(); return; }
      if (step === 2) { goStep(3); return; }
      confirmOrder();
    });
  });
})();
