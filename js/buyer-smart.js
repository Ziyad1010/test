/* ============================================================
   عمّار — محرّك الميزات الذكية في بوابة المشتري
   ------------------------------------------------------------
   كل ما هنا منطق حقيقي يعمل في المتصفح بلا خادم:

   • حاسبة الكميات: معاملات هندسية متعارف عليها في السوق السعودي
     (تقديرية للاسترشاد لا للتنفيذ الإنشائي).
   • مساعد التسوّق: محلّل نصّ عربي حتمي (قواعد + تعابير نمطية)
     يستخرج نوع العمل والأبعاد ثم يبني قائمة مواد. ليس نموذج لغة.
   • البحث بالصورة: تحليل ألوان حقيقي عبر <canvas> — يقرأ بصمة
     ألوان الصورة المرفوعة ويقارنها ببصمات صور الكتالوج. مطابقة
     لونية/نسيجية، وليست رؤية حاسوبية مدرّبة.
   • يُشترى معه غالباً: تواتر مشترك فعلي من سجل الطلبات.
   • تنبيه انخفاض السعر: لقطة أسعار محفوظة تُقارن عند كل زيارة.
   • نقاط الولاء: تُحتسب من الطلبات المسلّمة وتُستبدل خصماً.
   ============================================================ */

window.Smart = (function () {
  'use strict';

  var K_PRICE_SNAP = 'ammar_buyer_price_snapshot';
  var K_POINTS_USED = 'ammar_buyer_points_used';
  var K_TOUR = 'ammar_buyer_tour_done';
  var K_ASSISTANT = 'ammar_buyer_assistant_log';

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  /* ============================================================
     1) حاسبة تقدير الكميات
     ============================================================ */

  // معاملات استرشادية شائعة في تنفيذ المباني بالمملكة
  var COEFF = {
    // خرسانة: كيس أسمنت 50كجم لكل م³ (خلطة C25 تقريباً)
    cementBagsPerM3: 7,
    // حديد تسليح: كجم لكل م³ خرسانة (سقف/قواعد اعتيادية)
    steelKgPerM3: 90,
    // بلوك 20×20×40: عدد الحبات لكل م² جدار (وجه البلوكة 0.08 م²)
    blocksPerM2: 12.5,
    // مونة البناء: م³ لكل م² جدار
    mortarM3PerM2: 0.03,
    // بلاط: نسبة الهدر
    tileWaste: 0.10,
    // دهان: لتر لكل م² للوجه الواحد
    paintLPerM2: 0.25,
    paintCoats: 2
  };

  var CALC_MODES = {
    wall: {
      key: 'wall',
      label: 'جدار بلوك',
      hint: 'أدخل طول الجدار وارتفاعه',
      fields: [
        { key: 'length', label: 'طول الجدار', unit: 'متر', def: 20 },
        { key: 'height', label: 'ارتفاع الجدار', unit: 'متر', def: 3 }
      ],
      compute: function (v) {
        var area = v.length * v.height;
        return {
          area: area,
          areaLabel: 'مساحة الجدار: ' + round(area, 1) + ' م²',
          needs: [
            { category: 'blocks', qty: Math.ceil(area * COEFF.blocksPerM2), unitHint: 'حبة',
              note: round(COEFF.blocksPerM2, 1) + ' حبة/م²' },
            { category: 'cement', qty: Math.ceil(area * COEFF.mortarM3PerM2 * COEFF.cementBagsPerM3), unitHint: 'كيس',
              note: 'مونة البناء' }
          ]
        };
      }
    },

    slab: {
      key: 'slab',
      label: 'سقف / قاعدة خرسانية',
      hint: 'أدخل أبعاد السطح وسماكته',
      fields: [
        { key: 'length', label: 'الطول', unit: 'متر', def: 8 },
        { key: 'width', label: 'العرض', unit: 'متر', def: 6 },
        { key: 'thickness', label: 'السماكة', unit: 'سم', def: 20 }
      ],
      compute: function (v) {
        var volume = v.length * v.width * (v.thickness / 100);
        return {
          area: v.length * v.width,
          areaLabel: 'حجم الخرسانة: ' + round(volume, 2) + ' م³',
          needs: [
            { category: 'concrete', qty: Math.ceil(volume), unitHint: 'م³', note: 'خرسانة جاهزة' },
            { category: 'steel', qty: round(volume * COEFF.steelKgPerM3 / 1000, 2), unitHint: 'طن',
              note: COEFF.steelKgPerM3 + ' كجم/م³' },
            { category: 'cement', qty: Math.ceil(volume * COEFF.cementBagsPerM3), unitHint: 'كيس',
              note: 'بديل الخلط بالموقع' }
          ]
        };
      }
    },

    floor: {
      key: 'floor',
      label: 'تبليط أرضية',
      hint: 'أدخل أبعاد الغرفة',
      fields: [
        { key: 'length', label: 'الطول', unit: 'متر', def: 5 },
        { key: 'width', label: 'العرض', unit: 'متر', def: 4 }
      ],
      compute: function (v) {
        var area = v.length * v.width;
        var withWaste = area * (1 + COEFF.tileWaste);
        return {
          area: area,
          areaLabel: 'المساحة: ' + round(area, 1) + ' م² (+' + (COEFF.tileWaste * 100) + '% هدر = ' + round(withWaste, 1) + ' م²)',
          needs: [
            { category: 'finishing', qty: Math.ceil(withWaste), unitHint: 'م²', note: 'شامل الهدر' },
            { category: 'cement', qty: Math.ceil(area * 0.05 * COEFF.cementBagsPerM3), unitHint: 'كيس',
              note: 'مونة التثبيت' }
          ]
        };
      }
    },

    paint: {
      key: 'paint',
      label: 'دهان جدران',
      hint: 'أدخل مساحة الأسطح المراد دهانها',
      fields: [
        { key: 'area', label: 'المساحة', unit: 'م²', def: 60 }
      ],
      compute: function (v) {
        var liters = v.area * COEFF.paintLPerM2 * COEFF.paintCoats;
        return {
          area: v.area,
          areaLabel: round(liters, 1) + ' لتر لوجهين على ' + round(v.area, 1) + ' م²',
          needs: [
            { category: 'finishing', qty: Math.ceil(liters / 18), unitHint: 'عبوة 18 لتر',
              note: COEFF.paintCoats + ' وجه' }
          ]
        };
      }
    }
  };

  function round(n, d) {
    var f = Math.pow(10, d || 0);
    return Math.round(n * f) / f;
  }

  // يحوّل احتياجاً مجرّداً (فئة + كمية) إلى منتج حقيقي من الكتالوج
  function pickProduct(category, preferId) {
    var pool = Buyer.activeProducts().filter(function (p) { return p.category === category; });
    if (!pool.length) return null;

    if (preferId) {
      var exact = pool.filter(function (p) { return p.id === preferId; })[0];
      if (exact) return exact;
    }

    // الأفضل توفراً ثم الأكثر مشاهدة — لا اختيار عشوائي
    return pool.sort(function (a, b) {
      var av = Store.deriveAvailability(a) === 'out_of_stock' ? 1 : 0;
      var bv = Store.deriveAvailability(b) === 'out_of_stock' ? 1 : 0;
      if (av !== bv) return av - bv;
      return (b.views || 0) - (a.views || 0);
    })[0];
  }

  // يحوّل الكمية المقدّرة إلى كمية بوحدة المنتج المختار
  function toProductQty(need, product) {
    var qty = need.qty;

    // الحديد يُقدَّر بالطن والمنتج قد يُباع بالطن — نطابق الوحدات المعروفة
    if (need.unitHint === 'طن' && product.unit !== 'طن') {
      qty = Math.ceil(qty * 1000);      // إلى كيلوغرامات
    }

    var moq = Number(product.moq || 1) || 1;
    if (qty < moq) qty = moq;
    return Math.ceil(qty);
  }

  function calculate(modeKey, values, preferId) {
    var mode = CALC_MODES[modeKey];
    if (!mode) return null;

    var result = mode.compute(values);
    var lines = [];
    var total = 0;

    result.needs.forEach(function (need) {
      var product = pickProduct(need.category, preferId);
      if (!product) return;

      var qty = toProductQty(need, product);
      var unitPrice = ByUI.effectivePrice(product);
      var lineTotal = unitPrice * qty;
      total += lineTotal;

      lines.push({
        product: product, qty: qty, unitPrice: unitPrice,
        lineTotal: lineTotal, note: need.note
      });
    });

    return { mode: mode, summary: result.areaLabel, lines: lines, total: total };
  }

  /* ============================================================
     2) مساعد التسوّق — محلّل نصّ عربي حتمي
     ============================================================ */

  // كل نية مرتبطة بوضع حساب، وتُطابق بكلمات مفتاحية بعد التطبيع
  var INTENTS = [
    { mode: 'wall',  words: ['جدار', 'حائط', 'سور', 'بلوك', 'طوب', 'بناء جدار'] },
    { mode: 'slab',  words: ['سقف', 'سقفه', 'صبه', 'صبة', 'خرسانه', 'خرسانة', 'قاعده', 'قاعدة', 'اساس', 'ميده', 'بلاطه'] },
    { mode: 'floor', words: ['تبليط', 'بلاط', 'سيراميك', 'ارضيه', 'ارضية', 'بورسلين', 'رخام'] },
    { mode: 'paint', words: ['دهان', 'بويه', 'صبغ', 'طلاء'] }
  ];

  var AR_DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };

  function normalizeText(text) {
    return String(text || '')
      .replace(/[٠-٩]/g, function (d) { return AR_DIGITS[d]; })
      .replace(/[ً-ْـ]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[×xX*]/g, ' × ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  // يستخرج كل الأعداد مع وحداتها إن ذُكرت
  function extractNumbers(text) {
    var out = [];
    var re = /(\d+(?:[.,]\d+)?)\s*(متر|م٢|م2|م²|م³|م3|سم|سنتي|قدم)?/g;
    var m;
    while ((m = re.exec(text)) !== null) {
      out.push({ value: parseFloat(String(m[1]).replace(',', '.')), unit: m[2] || '' });
    }
    return out;
  }

  function detectIntent(text) {
    var found = null;
    INTENTS.forEach(function (intent) {
      if (found) return;
      intent.words.forEach(function (w) {
        if (!found && text.indexOf(normalizeText(w)) !== -1) found = intent.mode;
      });
    });
    return found;
  }

  // النتيجة: { ok, mode, values, missing[], message }
  function parseRequest(input) {
    var text = normalizeText(input);
    if (!text) return { ok: false, message: 'اكتب وصفاً لما تحتاجه، مثل: «أحتاج مواد لبناء جدار 20 متر بارتفاع 3».' };

    var mode = detectIntent(text);
    if (!mode) {
      return {
        ok: false,
        message: 'لم أتعرّف على نوع العمل. جرّب ذكر: جدار، سقف خرساني، تبليط، أو دهان.',
        suggestions: ['جدار بلوك 20 متر × 3', 'سقف 8 × 6 سماكة 20 سم', 'تبليط غرفة 5 × 4', 'دهان 60 م²']
      };
    }

    var nums = extractNumbers(text);
    var fields = CALC_MODES[mode].fields;
    var values = {};
    var missing = [];

    fields.forEach(function (f, i) {
      // السنتيمترات تُقرأ كما هي لحقل السماكة، والباقي بالأمتار
      var n = nums[i];
      if (n && isFinite(n.value)) values[f.key] = n.value;
      else missing.push(f);
    });

    // الارتفاع الافتراضي للجدران 3 أمتار إن لم يُذكر — نُعلن ذلك للمستخدم
    var assumed = [];
    missing.slice().forEach(function (f) {
      if (f.key === 'height' || f.key === 'thickness') {
        values[f.key] = f.def;
        assumed.push(f.label + ' = ' + f.def + ' ' + f.unit);
        missing = missing.filter(function (x) { return x.key !== f.key; });
      }
    });

    if (missing.length) {
      return {
        ok: false, mode: mode, missing: missing,
        message: 'أحتاج ' + missing.map(function (f) { return f.label; }).join(' و') + ' لإكمال الحساب.'
      };
    }

    return { ok: true, mode: mode, values: values, assumed: assumed };
  }

  // من النص مباشرة إلى قائمة مواد جاهزة
  function assist(input) {
    var parsed = parseRequest(input);
    if (!parsed.ok) return parsed;

    var result = calculate(parsed.mode, parsed.values);
    if (!result || !result.lines.length) {
      return { ok: false, message: 'لا توجد منتجات متاحة في الكتالوج تغطي هذا الطلب حالياً.' };
    }

    result.ok = true;
    result.assumed = parsed.assumed;
    return result;
  }

  function logAssistant(entry) {
    var log = read(K_ASSISTANT, []);
    log.unshift(entry);
    write(K_ASSISTANT, log.slice(0, 20));
  }

  function assistantLog() { return read(K_ASSISTANT, []); }

  /* ============================================================
     3) البحث بالصورة — بصمة لونية عبر canvas
     ============================================================ */

  // يقرأ الصورة على canvas مصغّر ويحسب متوسط اللون + التباين + الإشباع
  function fingerprint(imageEl) {
    var SIZE = 32;
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;

    var ctx = canvas.getContext('2d');
    ctx.drawImage(imageEl, 0, 0, SIZE, SIZE);

    var data;
    try {
      data = ctx.getImageData(0, 0, SIZE, SIZE).data;
    } catch (e) {
      return null;   // صورة من نطاق آخر تلوّث الـ canvas
    }

    var r = 0, g = 0, b = 0, n = 0;
    var lums = [];

    for (var i = 0; i < data.length; i += 4) {
      r += data[i]; g += data[i + 1]; b += data[i + 2];
      lums.push(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
      n++;
    }

    r /= n; g /= n; b /= n;

    var meanLum = lums.reduce(function (s, x) { return s + x; }, 0) / lums.length;
    var variance = lums.reduce(function (s, x) { return s + (x - meanLum) * (x - meanLum); }, 0) / lums.length;

    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var sat = max === 0 ? 0 : (max - min) / max;

    return {
      r: r, g: g, b: b,
      lum: meanLum,
      contrast: Math.sqrt(variance),   // بديل تقريبي لخشونة النسيج
      sat: sat
    };
  }

  function fingerprintFromSrc(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(fingerprint(img)); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  function distance(a, b) {
    if (!a || !b) return Infinity;
    var dr = (a.r - b.r) / 255;
    var dg = (a.g - b.g) / 255;
    var db = (a.b - b.b) / 255;
    var dc = (a.contrast - b.contrast) / 128;
    var ds = a.sat - b.sat;

    // اللون يحمل الوزن الأكبر، ثم خشونة النسيج، ثم الإشباع
    return Math.sqrt(dr * dr + dg * dg + db * db) * 1.0 +
           Math.abs(dc) * 0.6 +
           Math.abs(ds) * 0.4;
  }

  // يعيد وعداً بقائمة { product, score } مرتبة من الأقرب
  function searchByImage(fileOrSrc, limit) {
    return new Promise(function (resolve, reject) {
      var src = typeof fileOrSrc === 'string' ? Promise.resolve(fileOrSrc) : readFile(fileOrSrc);

      src.then(function (dataUrl) {
        var img = new Image();
        img.onload = function () {
          var target = fingerprint(img);
          if (!target) { reject(new Error('تعذّر تحليل الصورة')); return; }

          var products = Buyer.activeProducts();
          Promise.all(products.map(function (p) { return fingerprintFromSrc(p.img); }))
            .then(function (prints) {
              var scored = products.map(function (p, i) {
                return { product: p, score: distance(target, prints[i]) };
              }).filter(function (x) { return isFinite(x.score); })
                .sort(function (a, b) { return a.score - b.score; });

              // فتح الملفات مباشرة عبر file:// يُلوّث الـ canvas فيتعذّر
              // قراءة بكسلات صور الكتالوج — نوضّح السبب بدل قائمة فارغة
              if (!scored.length) {
                reject(new Error('تعذّر تحليل صور الكتالوج. شغّل الموقع عبر خادم محلي (http) بدل فتح الملف مباشرة، لأن المتصفح يمنع قراءة بكسلات الصور في وضع file://'));
                return;
              }

              resolve({ preview: dataUrl, matches: scored.slice(0, limit || 6), target: target });
            });
        };
        img.onerror = function () { reject(new Error('تعذّر قراءة الصورة')); };
        img.src = dataUrl;
      }).catch(reject);
    });
  }

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error('تعذّر قراءة الملف')); };
      reader.readAsDataURL(file);
    });
  }

  // يصف درجة التطابق بلغة مفهومة بدل رقم خام
  function matchLabel(score) {
    if (score < 0.18) return { label: 'تطابق قوي', tone: 'ok' };
    if (score < 0.35) return { label: 'تشابه جيد', tone: 'ok' };
    if (score < 0.6) return { label: 'تشابه جزئي', tone: 'warn' };
    return { label: 'تشابه ضعيف', tone: 'bad' };
  }

  /* ============================================================
     4) يُشترى معه غالباً — تواتر مشترك حقيقي
     ============================================================ */
  function boughtTogether(productId, limit) {
    var pairs = {};
    var appearances = 0;

    Store.getOrders().forEach(function (o) {
      var ids = (o.items || []).map(function (it) { return String(it.productId); });
      if (ids.indexOf(String(productId)) === -1) return;

      appearances++;
      ids.forEach(function (id) {
        if (id === String(productId)) return;
        pairs[id] = (pairs[id] || 0) + 1;
      });
    });

    return Object.keys(pairs)
      .map(function (id) {
        return {
          product: Store.getProduct(id),
          times: pairs[id],
          rate: appearances ? Math.round(pairs[id] / appearances * 100) : 0
        };
      })
      .filter(function (x) { return x.product && x.product.status === 'active'; })
      .sort(function (a, b) { return b.times - a.times; })
      .slice(0, limit || 3);
  }

  /* ============================================================
     5) تنبيه انخفاض السعر على المفضلة
     ============================================================ */
  function snapshotPrices() {
    var snap = read(K_PRICE_SNAP, {});
    var next = {};

    Buyer.wishlistProducts().forEach(function (p) {
      next[p.id] = ByUI.effectivePrice(p);
    });

    // نحتفظ بالقديم لما لم يتغيّر حتى لا نفقد المرجع
    Object.keys(next).forEach(function (id) {
      if (snap[id] === undefined) snap[id] = next[id];
    });

    write(K_PRICE_SNAP, snap);
    return snap;
  }

  function priceDrops() {
    var snap = read(K_PRICE_SNAP, {});
    var out = [];

    Buyer.wishlistProducts().forEach(function (p) {
      var old = snap[p.id];
      var now = ByUI.effectivePrice(p);
      if (old === undefined || now >= old) return;

      out.push({
        product: p, oldPrice: old, newPrice: now,
        diff: old - now,
        pct: Math.round((old - now) / old * 100)
      });
    });

    return out;
  }

  // بعد إبلاغ المستخدم نُحدّث المرجع فلا يتكرر التنبيه بلا نهاية
  function acknowledgeDrops() {
    var snap = read(K_PRICE_SNAP, {});
    Buyer.wishlistProducts().forEach(function (p) { snap[p.id] = ByUI.effectivePrice(p); });
    write(K_PRICE_SNAP, snap);
  }

  /* ============================================================
     6) نقاط الولاء
     ============================================================ */
  var POINTS_PER_RIYAL = 1 / 10;      // نقطة لكل 10 ريالات
  var RIYAL_PER_POINT = 0.05;         // كل نقطة = 5 هللات عند الاستبدال
  var MIN_REDEEM = 200;

  var TIERS = [
    { key: 'bronze', label: 'برونزي', min: 0, perk: 'شحن مخفّض على الطلبات فوق 2,000 ر.س' },
    { key: 'silver', label: 'فضي', min: 500, perk: 'أولوية في التجهيز + دعم مخصّص' },
    { key: 'gold', label: 'ذهبي', min: 1500, perk: 'شحن مجاني دائم + مدير حساب' }
  ];

  function earnedPoints() {
    var total = 0;
    Buyer.orders().forEach(function (o) {
      if (o.status === 'cancelled') return;
      total += Math.floor((o.total || 0) * POINTS_PER_RIYAL);
    });
    return total;
  }

  function usedPoints() { return read(K_POINTS_USED, 0) || 0; }

  function points() {
    return Math.max(0, earnedPoints() - usedPoints());
  }

  function pointsValue(n) {
    return round((n === undefined ? points() : n) * RIYAL_PER_POINT, 2);
  }

  function tier() {
    var total = earnedPoints();
    var current = TIERS[0];
    TIERS.forEach(function (t) { if (total >= t.min) current = t; });

    var next = null;
    TIERS.forEach(function (t) { if (!next && t.min > total) next = t; });

    return {
      current: current,
      next: next,
      total: total,
      toNext: next ? next.min - total : 0,
      progress: next ? Math.round((total - current.min) / (next.min - current.min) * 100) : 100
    };
  }

  function redeem(amount) {
    var available = points();
    var n = parseInt(amount, 10) || 0;

    if (n < MIN_REDEEM) return { ok: false, message: 'أقل استبدال ' + MIN_REDEEM + ' نقطة' };
    if (n > available) return { ok: false, message: 'رصيدك ' + available + ' نقطة فقط' };

    write(K_POINTS_USED, usedPoints() + n);
    Store.emit();
    return { ok: true, value: pointsValue(n), message: 'استبدلت ' + n + ' نقطة بخصم ' + pointsValue(n) + ' ر.س' };
  }

  /* ============================================================
     7) شهادات المطابقة
     ============================================================ */
  // المطابقة تُشتق من اكتمال بيانات المنتج: منتج بلا رمز أو مورد
  // معروف لا يُوسم موثّقاً — الشارة تعكس البيانات لا الادّعاء
  function certification(product) {
    if (!product) return null;

    var hasCode = !!product.sku;
    var hasBrand = !!(product.brand && product.brand !== 'عام');
    var hasSpecs = !!(product.weight && product.unit);
    // الترقيم العالمي إضافة مرغوبة لا شرط — كثير من المنتجات المحلية بلا GTIN
    var hasGlobalId = !!(product.barcode || product.gtin || product.mpn);

    if (!hasCode || !hasBrand || !hasSpecs) return null;

    // SASO ينطبق على مواد البناء الإنشائية أساساً
    var sasoCategories = ['steel', 'cement', 'concrete', 'blocks'];
    var isSaso = sasoCategories.indexOf(product.category) !== -1;

    return {
      kind: isSaso ? 'saso' : 'verified',
      label: isSaso ? 'مطابق للمواصفات السعودية' : 'منتج موثّق',
      code: (isSaso ? 'SASO-' : 'VRF-') + String(product.sku || product.id).toUpperCase(),
      issuer: isSaso ? 'الهيئة السعودية للمواصفات والمقاييس والجودة' : 'فريق التحقق في عمّار',
      standard: isSaso ? standardFor(product.category) : 'سياسة توثيق الموردين',
      checks: [
        { label: 'رمز المنتج (SKU) مسجّل لدى المورد', ok: hasCode },
        { label: 'المورد موثّق بسجل تجاري ورقم ضريبي', ok: hasBrand },
        { label: 'المواصفات الفنية والوزن مكتملة', ok: hasSpecs },
        { label: 'ترقيم عالمي (باركود / GTIN / MPN)', ok: hasGlobalId }
      ]
    };
  }

  function standardFor(category) {
    var map = {
      steel: 'SASO GSO 1461 — حديد التسليح',
      cement: 'SASO GSO 1914 — الأسمنت البورتلاندي',
      concrete: 'SASO GSO 2374 — الخرسانة الجاهزة',
      blocks: 'SASO GSO 1918 — الطوب والبلوك الخرساني'
    };
    return map[category] || 'مواصفة قياسية سعودية';
  }

  /* ============================================================
     8) لوحة المشتري المختصرة
     ============================================================ */
  function dashboard() {
    var orders = Buyer.orders();
    var now = new Date();
    var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    var monthSpend = 0;
    var active = 0;

    orders.forEach(function (o) {
      if (o.status === 'cancelled') return;
      if (o.date && new Date(o.date) >= monthStart) monthSpend += o.total || 0;
      if (['pending', 'confirmed', 'processing', 'ready', 'shipping'].indexOf(o.status) !== -1) active++;
    });

    return {
      monthSpend: monthSpend,
      activeOrders: active,
      totalOrders: orders.length,
      points: points(),
      tier: tier(),
      savedItems: Buyer.wishlist().length
    };
  }

  // إنفاق شهري لآخر 6 أشهر — لرسم بياني حقيقي في «طلباتي»
  function spendSeries(months) {
    var count = months || 6;
    var out = [];
    var now = new Date();

    for (var i = count - 1; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      var next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      var sum = 0;
      var n = 0;

      Buyer.orders().forEach(function (o) {
        if (o.status === 'cancelled' || !o.date) return;
        var od = new Date(o.date);
        if (od >= d && od < next) { sum += o.total || 0; n++; }
      });

      out.push({
        label: d.toLocaleDateString('ar-SA', { month: 'long' }),
        total: Math.round(sum),
        orders: n
      });
    }

    return out;
  }

  /* ============================================================
     9) الجولة التعريفية
     ============================================================ */
  function tourDone() {
    try { return localStorage.getItem(K_TOUR) === 'true'; } catch (e) { return true; }
  }

  function markTourDone() {
    try { localStorage.setItem(K_TOUR, 'true'); } catch (e) { /* ignore */ }
  }

  function resetTour() {
    try { localStorage.removeItem(K_TOUR); } catch (e) { /* ignore */ }
  }

  return {
    // الحاسبة
    CALC_MODES: CALC_MODES,
    COEFF: COEFF,
    calculate: calculate,
    pickProduct: pickProduct,

    // المساعد
    normalizeText: normalizeText,
    parseRequest: parseRequest,
    assist: assist,
    logAssistant: logAssistant,
    assistantLog: assistantLog,

    // البحث بالصورة
    searchByImage: searchByImage,
    fingerprint: fingerprint,
    matchLabel: matchLabel,

    // اقتراحات وتنبيهات
    boughtTogether: boughtTogether,
    snapshotPrices: snapshotPrices,
    priceDrops: priceDrops,
    acknowledgeDrops: acknowledgeDrops,

    // الولاء
    POINTS_PER_RIYAL: POINTS_PER_RIYAL,
    RIYAL_PER_POINT: RIYAL_PER_POINT,
    MIN_REDEEM: MIN_REDEEM,
    TIERS: TIERS,
    points: points,
    earnedPoints: earnedPoints,
    pointsValue: pointsValue,
    tier: tier,
    redeem: redeem,

    // الشهادات واللوحة
    certification: certification,
    dashboard: dashboard,
    spendSeries: spendSeries,

    // الجولة
    tourDone: tourDone,
    markTourDone: markTourDone,
    resetTour: resetTour
  };
})();
