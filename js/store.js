/* ============================================================
   عمار — طبقة البيانات المشتركة (Store)
   ------------------------------------------------------------
   مصدر واحد للحقيقة لكل من: المنتجات، الطلبات، الزيارات.
   كل الأرقام في لوحة التحكم (البطاقات العلوية والرسوم البيانية)
   تُحسب من هنا بدل أن تكون مكتوبة يدوياً، وتتحدث تلقائياً عند
   أي تغيير عبر نظام الاشتراك (subscribe) — وأيضاً بين تبويبات
   المتصفح المفتوحة عبر حدث storage.

   حدود هذه النسخة: لا يوجد خادم خلفي (backend)، فالتخزين يتم في
   localStorage داخل هذا المتصفح فقط. لربطها بقاعدة بيانات حقيقية
   يُستبدل جسم دوال read/write أدناه بنداءات API، دون تغيير أي كود
   يستهلك الـ Store.
   ============================================================ */

window.Store = (function () {
  'use strict';

  var K_PRODUCTS = 'ammar_products';
  var K_ORDERS = 'ammar_orders';
  var K_VISITS = 'ammar_visits';
  var K_SEEDED = 'ammar_store_seeded';

  var listeners = [];

  /* ---------------- منخفض المستوى ---------------- */
  function read(key, fallback) {
    var raw;
    try { raw = localStorage.getItem(key); } catch (e) { return fallback; }
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ممتلئ أو محظور */ }
  }

  function emit() {
    listeners.forEach(function (fn) {
      try { fn(); } catch (e) { /* لا تُسقط بقية المشتركين */ }
    });
  }

  /* ---------------- أدوات التاريخ ---------------- */
  var MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  var DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  function iso(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function parseISO(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function daysAgo(n) {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d;
  }

  /* ---------------- مولّد أرقام شبه عشوائي ثابت ----------------
     يضمن أن البيانات التجريبية لا تتغيّر مع كل تحديث للصفحة. */
  function seededRandom(seed) {
    var s = seed;
    return function () {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }

  /* ---------------- البيانات الأولية ---------------- */
  var SEED_PRODUCTS = [
    { id: 1, name: 'حديد تسليح سعودي 12مم', sku: 'STL-RJ-012', category: 'steel', subcategory: 'rebar',
      brand: 'حديد الراجحي', price: 2450, unit: 'طن', discount: 0, stock: 50, lowStock: 15, moq: 1,
      weight: 1000, weightUnit: 'كجم', warehouse: 'مستودع الرياض الرئيسي', availability: 'in_stock',
      views: 1240, status: 'active', img: 'assets/images/cat-steel.jpg' },
    { id: 2, name: 'أسمنت بورتلاندي عادي (50كجم)', sku: 'CEM-YM-050', category: 'cement', subcategory: 'opc',
      brand: 'أسمنت اليمامة', price: 18.5, unit: 'كيس', discount: 5, stock: 8, lowStock: 15, moq: 20,
      weight: 50, weightUnit: 'كجم', warehouse: 'مستودع الرياض الرئيسي', availability: 'in_stock',
      views: 2140, status: 'active', img: 'assets/images/cat-cement.jpg' },
    { id: 3, name: 'خرسانة جاهزة C30', sku: 'RMX-SR-030', category: 'concrete', subcategory: 'ready',
      brand: 'الخرسانة السعودية', price: 245, unit: 'م³', discount: 0, stock: 999, lowStock: 0, moq: 6,
      weight: 2400, weightUnit: 'كجم', warehouse: 'مستودع جدة', availability: 'on_demand',
      views: 860, status: 'active', img: 'assets/images/cat-concrete.jpg' },
    { id: 4, name: 'بلاط بورسلين مطفي 60×60', sku: 'TIL-SC-060', category: 'finishing', subcategory: 'tiles',
      brand: 'الخزف السعودي', price: 42, unit: 'م²', discount: 10, stock: 320, lowStock: 30, moq: 10,
      weight: 18, weightUnit: 'كجم', warehouse: 'مستودع الدمام', availability: 'in_stock',
      views: 1580, status: 'active', img: 'assets/images/prod-porcelain.jpg' },
    { id: 5, name: 'طوب أسمنتي مصمت 20سم', sku: 'BLK-FZ-020', category: 'blocks', subcategory: 'solid',
      brand: 'الفوزان لمواد البناء', price: 3.2, unit: 'حبة', discount: 0, stock: 0, lowStock: 500, moq: 500,
      weight: 16, weightUnit: 'كجم', warehouse: 'مستودع الرياض الرئيسي', availability: 'out_of_stock',
      views: 410, status: 'active', img: 'assets/images/cat-blocks.jpg' },
    { id: 6, name: 'خلاطة خرسانة كهربائية 350 لتر', sku: 'TL-MX-350', category: 'tools', subcategory: 'machines',
      brand: 'عام', price: 3850, unit: 'حبة', discount: 0, stock: 6, lowStock: 5, moq: 1,
      weight: 210, weightUnit: 'كجم', warehouse: 'مستودع جدة', availability: 'limited',
      views: 320, status: 'active', img: 'assets/images/prod-mixer.jpg' },
    { id: 7, name: 'حديد تسليح سعودي 16مم', sku: 'STL-RJ-016', category: 'steel', subcategory: 'rebar',
      brand: 'حديد الراجحي', price: 2520, unit: 'طن', discount: 0, stock: 22, lowStock: 15, moq: 1,
      weight: 1000, weightUnit: 'كجم', warehouse: 'مستودع الرياض الرئيسي', availability: 'in_stock',
      views: 980, status: 'active', img: 'assets/images/cat-steel.jpg' },
    { id: 8, name: 'أسمنت مقاوم للكبريتات', sku: 'CEM-AR-SRC', category: 'cement', subcategory: 'src',
      brand: 'أسمنت العربية', price: 21, unit: 'كيس', discount: 0, stock: 0, lowStock: 15, moq: 20,
      weight: 50, weightUnit: 'كجم', warehouse: 'مستودع الدمام', availability: 'out_of_stock',
      views: 145, status: 'draft', img: 'assets/images/cat-cement.jpg' }
  ];

  var SEED_CITIES = [
    { name: 'الرياض', weight: 34 }, { name: 'جدة', weight: 24 }, { name: 'الدمام', weight: 15 },
    { name: 'مكة المكرمة', weight: 10 }, { name: 'الخبر', weight: 8 },
    { name: 'المدينة المنورة', weight: 5 }, { name: 'أبها', weight: 4 }
  ];

  var SEED_BUYERS = ['مؤسسة الإعمار للمقاولات', 'شركة البناء المتين', 'مقاولات الخليج', 'شركة تعمير الحديثة',
    'مؤسسة الأساس الثابت', 'شركة الديار للتطوير', 'مقاولات النخبة', 'شركة رواسي البناء'];

  var SEED_PAYMENTS = ['مدى', 'تحويل بنكي', 'Apple Pay', 'فيزا', 'ماستركارد'];

  var SEED_DISTRICTS = {
    'الرياض': ['حي الملز', 'حي النرجس', 'حي العليا', 'حي الياسمين'],
    'جدة': ['حي الروضة', 'حي السلامة', 'حي الشاطئ', 'حي النعيم'],
    'الدمام': ['حي الفيصلية', 'حي الشاطئ', 'حي النور'],
    'مكة المكرمة': ['حي العزيزية', 'حي الشوقية', 'حي النسيم'],
    'الخبر': ['حي العقربية', 'حي الثقبة', 'حي الراكة'],
    'المدينة المنورة': ['حي قباء', 'حي العوالي', 'حي الخالدية'],
    'أبها': ['حي المنسك', 'حي الخالدية', 'حي السد']
  };

  function pickWeighted(rnd, list) {
    var total = list.reduce(function (s, x) { return s + x.weight; }, 0);
    var r = rnd() * total;
    for (var i = 0; i < list.length; i++) {
      r -= list[i].weight;
      if (r <= 0) return list[i];
    }
    return list[list.length - 1];
  }

  // يولّد 6 أشهر من الطلبات بتوزيع واقعي (نمو تدريجي + تذبذب أسبوعي)
  function buildSeedOrders(products) {
    var rnd = seededRandom(20260727);
    var orders = [];
    var counter = 2100;
    var sellable = products.filter(function (p) { return p.status === 'active'; });

    for (var back = 179; back >= 0; back--) {
      var day = daysAgo(back);
      // كثافة الطلبات تنمو مع الوقت، وتنخفض يومي الجمعة والسبت
      var growth = 0.6 + (179 - back) / 179 * 0.9;
      var weekday = day.getDay();
      var weekendFactor = (weekday === 5 || weekday === 6) ? 0.45 : 1;
      var perDay = Math.round((rnd() * 3 + 1) * growth * weekendFactor);

      for (var i = 0; i < perDay; i++) {
        var itemCount = 1 + Math.floor(rnd() * 3);
        var items = [];
        var total = 0;
        for (var j = 0; j < itemCount; j++) {
          var p = sellable[Math.floor(rnd() * sellable.length)];
          var qty = 1 + Math.floor(rnd() * (p.price > 1000 ? 4 : 60));
          var line = p.price * (1 - (p.discount || 0) / 100) * qty;
          items.push({ productId: p.id, name: p.name, qty: qty, price: p.price });
          total += line;
        }

        var status;
        if (back <= 1) status = 'new';
        else if (back <= 4) status = rnd() < 0.5 ? 'processing' : 'shipping';
        else if (back <= 8) status = rnd() < 0.35 ? 'shipping' : 'delivered';
        else status = rnd() < 0.06 ? 'cancelled' : 'delivered';

        var city = pickWeighted(rnd, SEED_CITIES).name;
        var districts = SEED_DISTRICTS[city] || [''];
        var phoneTail = 1000000 + Math.floor(rnd() * 8999999);

        orders.push({
          id: 'ORD-' + (counter++),
          date: iso(day),
          city: city,
          district: districts[Math.floor(rnd() * districts.length)],
          customer: SEED_BUYERS[Math.floor(rnd() * SEED_BUYERS.length)],
          payment: SEED_PAYMENTS[Math.floor(rnd() * SEED_PAYMENTS.length)],
          phone: '+966 5' + String(phoneTail).slice(0, 8),
          status: status,
          items: items,
          total: Math.round(total * 100) / 100
        });
      }
    }
    return orders;
  }

  function buildSeedVisits() {
    var rnd = seededRandom(88117);
    var visits = {};
    for (var back = 29; back >= 0; back--) {
      var day = daysAgo(back);
      var weekday = day.getDay();
      var base = (weekday === 5) ? 180 : 320;
      visits[iso(day)] = Math.round(base + rnd() * 260);
    }
    return visits;
  }

  function ensureSeeded() {
    var seeded = false;
    try { seeded = localStorage.getItem(K_SEEDED) === 'true'; } catch (e) { /* ignore */ }
    if (seeded) return;

    write(K_PRODUCTS, SEED_PRODUCTS);
    write(K_ORDERS, buildSeedOrders(SEED_PRODUCTS));
    write(K_VISITS, buildSeedVisits());
    try { localStorage.setItem(K_SEEDED, 'true'); } catch (e) { /* ignore */ }
  }

  /* ---------------- المنتجات ---------------- */
  function getProducts() { return read(K_PRODUCTS, []); }

  function saveProducts(list) {
    write(K_PRODUCTS, list);
    emit();
  }

  function nextProductId() {
    var max = 0;
    getProducts().forEach(function (p) { if (p.id > max) max = p.id; });
    return max + 1;
  }

  /* ---------------- الطلبات ---------------- */
  function getOrders() { return read(K_ORDERS, []); }

  // تسجيل طلب جديد + خصم الكميات من المخزون مباشرة (مزامنة المخزون)
  function placeOrder(order) {
    var orders = getOrders();
    var products = getProducts();

    (order.items || []).forEach(function (item) {
      var p = products.filter(function (x) { return x.id === item.productId; })[0];
      if (!p) return;
      p.stock = Math.max(0, (p.stock || 0) - (item.qty || 0));
      p.availability = deriveAvailability(p);
    });

    orders.push(order);
    write(K_ORDERS, orders);
    write(K_PRODUCTS, products);
    emit();
    return order;
  }

  function setOrderStatus(id, status) {
    var orders = getOrders();
    var changed = false;
    orders.forEach(function (o) {
      if (o.id === id) { o.status = status; changed = true; }
    });
    if (!changed) return;
    write(K_ORDERS, orders);
    emit();
  }

  // حالة التوفر المشتقة من الكمية — تمنع بيع منتج نفدت كميته
  function deriveAvailability(p) {
    if (p.availability === 'on_demand') return 'on_demand';
    if (!p.stock || p.stock <= 0) return 'out_of_stock';
    if (p.lowStock && p.stock <= p.lowStock) return 'limited';
    return 'in_stock';
  }

  /* ---------------- الزيارات ---------------- */
  function getVisits() { return read(K_VISITS, {}); }

  // يُستدعى عند فتح أي صفحة — زيارة فعلية مسجّلة لهذا المتصفح
  function recordVisit() {
    var visits = getVisits();
    var today = iso(new Date());
    visits[today] = (visits[today] || 0) + 1;

    // احتفظ بآخر 90 يوماً فقط حتى لا ينمو التخزين بلا حدود
    var cutoff = iso(daysAgo(90));
    Object.keys(visits).forEach(function (d) { if (d < cutoff) delete visits[d]; });

    write(K_VISITS, visits);
    emit();
  }

  /* ---------------- مقاييس مشتقة ---------------- */
  var REVENUE_STATUSES = ['delivered', 'shipping', 'processing'];

  function isRevenue(o) { return REVENUE_STATUSES.indexOf(o.status) !== -1; }

  function ordersBetween(fromDate, toDate) {
    var from = iso(fromDate);
    var to = iso(toDate);
    return getOrders().filter(function (o) { return o.date >= from && o.date <= to; });
  }

  function sumTotal(list) {
    return list.reduce(function (s, o) { return s + (o.total || 0); }, 0);
  }

  function pctChange(current, previous) {
    if (!previous) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 1000) / 10;
  }

  // بطاقات المؤشرات العلوية
  function kpis() {
    var today = new Date();
    var thisWeek = ordersBetween(daysAgo(6), today).filter(isRevenue);
    var prevWeek = ordersBetween(daysAgo(13), daysAgo(7)).filter(isRevenue);

    var all = getOrders();
    var products = getProducts();

    var weeklySales = sumTotal(thisWeek);
    var newOrders = all.filter(function (o) { return o.status === 'new'; }).length;
    var prevNewOrders = prevWeek.length;

    return {
      weeklySales: weeklySales,
      weeklySalesChange: pctChange(weeklySales, sumTotal(prevWeek)),
      newOrders: newOrders,
      newOrdersChange: pctChange(newOrders, prevNewOrders),
      inDelivery: all.filter(function (o) { return o.status === 'shipping'; }).length,
      stockAlerts: products.filter(function (p) {
        return p.status !== 'archived' && (p.stock <= 0 || (p.lowStock > 0 && p.stock <= p.lowStock));
      }).length,
      totalOrders: all.length
    };
  }

  // الإيرادات الشهرية لآخر N شهراً + نسبة التغيّر المحسوبة
  function monthlyRevenue(months) {
    months = months || 6;
    var now = new Date();
    var buckets = [];

    for (var i = months - 1; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ year: d.getFullYear(), month: d.getMonth(), label: MONTHS_AR[d.getMonth()], total: 0 });
    }

    getOrders().filter(isRevenue).forEach(function (o) {
      var d = parseISO(o.date);
      if (!d) return;
      for (var i = 0; i < buckets.length; i++) {
        if (buckets[i].year === d.getFullYear() && buckets[i].month === d.getMonth()) {
          buckets[i].total += o.total || 0;
          return;
        }
      }
    });

    var last = buckets[buckets.length - 1];
    var prev = buckets[buckets.length - 2];

    return {
      labels: buckets.map(function (b) { return b.label; }),
      values: buckets.map(function (b) { return Math.round(b.total); }),
      total: Math.round(buckets.reduce(function (s, b) { return s + b.total; }, 0)),
      change: pctChange(last ? last.total : 0, prev ? prev.total : 0)
    };
  }

  // الأكثر مبيعاً حسب الإيراد خلال فترة
  function topProducts(days, limit) {
    days = days || 30;
    limit = limit || 5;

    var totals = {};
    ordersBetween(daysAgo(days - 1), new Date()).filter(isRevenue).forEach(function (o) {
      (o.items || []).forEach(function (it) {
        var key = it.productId;
        if (!totals[key]) totals[key] = { name: it.name, revenue: 0, qty: 0 };
        totals[key].revenue += (it.price || 0) * (it.qty || 0);
        totals[key].qty += it.qty || 0;
      });
    });

    var rows = Object.keys(totals).map(function (k) { return totals[k]; });
    rows.sort(function (a, b) { return b.revenue - a.revenue; });
    rows = rows.slice(0, limit);

    return {
      labels: rows.map(function (r) { return r.name; }),
      values: rows.map(function (r) { return Math.round(r.revenue); })
    };
  }

  // توزيع الطلبات حسب مدينة الشحن
  function ordersByCity(days, limit) {
    days = days || 30;
    limit = limit || 6;

    var counts = {};
    ordersBetween(daysAgo(days - 1), new Date()).forEach(function (o) {
      if (!o.city) return;
      counts[o.city] = (counts[o.city] || 0) + 1;
    });

    var rows = Object.keys(counts).map(function (c) { return { city: c, count: counts[c] }; });
    rows.sort(function (a, b) { return b.count - a.count; });
    rows = rows.slice(0, limit);

    return {
      labels: rows.map(function (r) { return r.city; }),
      values: rows.map(function (r) { return r.count; })
    };
  }

  // الزوار خلال آخر N يوماً
  function visitors(days) {
    days = days || 7;
    var visits = getVisits();
    var labels = [];
    var values = [];

    for (var i = days - 1; i >= 0; i--) {
      var d = daysAgo(i);
      labels.push(DAYS_AR[d.getDay()]);
      values.push(visits[iso(d)] || 0);
    }
    return { labels: labels, values: values, total: values.reduce(function (s, v) { return s + v; }, 0) };
  }

  /* ---------------- الاشتراك ---------------- */
  function subscribe(fn) {
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (f) { return f !== fn; });
    };
  }

  // تحديث تلقائي عند تغيّر البيانات من تبويب آخر
  window.addEventListener('storage', function (e) {
    if ([K_PRODUCTS, K_ORDERS, K_VISITS].indexOf(e.key) !== -1) emit();
  });

  ensureSeeded();

  return {
    getProducts: getProducts,
    saveProducts: saveProducts,
    nextProductId: nextProductId,
    deriveAvailability: deriveAvailability,

    getOrders: getOrders,
    placeOrder: placeOrder,
    setOrderStatus: setOrderStatus,

    recordVisit: recordVisit,

    kpis: kpis,
    monthlyRevenue: monthlyRevenue,
    topProducts: topProducts,
    ordersByCity: ordersByCity,
    visitors: visitors,

    subscribe: subscribe,
    emit: emit,

    // لمسح كل البيانات ورؤية الحالة الفارغة (بائع جديد بلا مبيعات)
    clearAll: function () {
      [K_PRODUCTS, K_ORDERS, K_VISITS].forEach(function (k) {
        try { localStorage.setItem(k, JSON.stringify(k === K_VISITS ? {} : [])); } catch (e) { /* ignore */ }
      });
      emit();
    }
  };
})();
