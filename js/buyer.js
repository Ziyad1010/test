/* ============================================================
   عمار — بوابة المشتري: طبقة البيانات + الهيكل المشترك
   ------------------------------------------------------------
   تُبنى فوق js/store.js نفسه المستخدم في بوابة المورد، فالطلبات
   والمنتجات والفواتير مصدرها واحد — ما يضمن أن ما يراه المشتري
   هو نفسه ما يراه المورد دون أي تكرار للبيانات.

   المشتري الحالي يُمثَّل بأحد عملاء المتجر (ammar_buyer_id)، فتظهر
   له طلبات وفواتير حقيقية بدل بيانات وهمية منفصلة.
   ============================================================ */

window.Buyer = (function () {
  'use strict';

  var K_BUYER_ID = 'ammar_buyer_id';
  var K_WISHLIST = 'ammar_buyer_wishlist';
  var K_ADDRESSES = 'ammar_buyer_addresses';
  var K_PAYMENTS = 'ammar_buyer_payments';
  var K_REVIEWS = 'ammar_buyer_reviews';
  var K_PROFILE = 'ammar_buyer_profile';
  var K_CART = 'ammar_buyer_cart';
  var K_VIEWED = 'ammar_buyer_viewed';
  var K_COMPARE = 'ammar_buyer_compare';
  var K_PROMO = 'ammar_buyer_promo';
  var K_GUEST = 'ammar_buyer_guest';
  var K_SEEDED = 'ammar_buyer_seeded_v1';

  /* ---------------- تخزين ---------------- */
  function read(key, fallback) {
    var raw;
    try { raw = localStorage.getItem(key); } catch (e) { return fallback; }
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function isoTime(d) { return iso(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  /* ---------------- هوية المشتري ---------------- */
  function buyerId() {
    var id = null;
    try { id = localStorage.getItem(K_BUYER_ID); } catch (e) { /* ignore */ }
    if (id) return id;

    // اربط المشتري بأكثر العملاء نشاطاً حتى يكون لديه سجل حقيقي
    var customers = Store.getCustomers().sort(function (a, b) { return b.orders - a.orders; });
    id = customers.length ? customers[0].id : 'CUS-1';
    try { localStorage.setItem(K_BUYER_ID, id); } catch (e) { /* ignore */ }
    return id;
  }

  function profile() {
    var customer = Store.getCustomer(buyerId());
    var saved = read(K_PROFILE, {});
    var name = '';
    try { name = localStorage.getItem('ammar_user_name') || ''; } catch (e) { /* ignore */ }

    return Object.assign({
      id: buyerId(),
      name: name || (customer ? customer.name : 'مشترٍ جديد'),
      email: customer ? customer.email : '',
      phone: customer ? customer.phone : '',
      city: customer ? customer.city : ''
    }, saved);
  }

  function saveProfile(patch) {
    var next = Object.assign(profile(), patch);
    write(K_PROFILE, next);
    if (next.name) {
      try { localStorage.setItem('ammar_user_name', next.name); } catch (e) { /* ignore */ }
    }
    Store.emit();
    return next;
  }

  /* ---------------- الطلبات والفواتير ---------------- */
  function orders() {
    return Store.ordersOfCustomer(buyerId()).sort(function (a, b) {
      return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
    });
  }

  function order(id) {
    var found = null;
    orders().forEach(function (o) { if (o.id === id) found = o; });
    return found;
  }

  function invoices() {
    return Store.getInvoices().filter(function (i) {
      return i.customerId === buyerId();
    }).sort(function (a, b) { return a.issue < b.issue ? 1 : -1; });
  }

  function invoice(id) {
    var found = null;
    invoices().forEach(function (i) { if (i.id === id) found = i; });
    return found;
  }

  /* ---------------- المفضلة ---------------- */
  function wishlist() { return read(K_WISHLIST, []); }

  function inWishlist(productId) {
    return wishlist().indexOf(String(productId)) !== -1;
  }

  function toggleWishlist(productId) {
    var list = wishlist();
    var key = String(productId);
    var idx = list.indexOf(key);
    if (idx === -1) list.push(key); else list.splice(idx, 1);
    write(K_WISHLIST, list);
    Store.emit();
    return idx === -1;
  }

  function wishlistProducts() {
    return wishlist().map(function (id) { return Store.getProduct(id); })
      .filter(Boolean);
  }

  /* ---------------- العناوين ---------------- */
  function addresses() { return read(K_ADDRESSES, []); }

  function address(id) {
    var found = null;
    addresses().forEach(function (a) { if (a.id === id) found = a; });
    return found;
  }

  function saveAddress(addr) {
    var list = addresses();

    if (addr.id) {
      list = list.map(function (a) { return a.id === addr.id ? Object.assign({}, a, addr) : a; });
    } else {
      addr.id = 'ADR-' + Date.now();
      addr.isDefault = list.length === 0;
      list.push(addr);
    }

    // عنوان افتراضي واحد فقط
    if (addr.isDefault) {
      list = list.map(function (a) { return Object.assign({}, a, { isDefault: a.id === addr.id }); });
    }

    write(K_ADDRESSES, list);
    Store.emit();
    return addr;
  }

  function removeAddress(id) {
    var target = address(id);
    var rest = addresses().filter(function (a) { return a.id !== id; });
    if (target && target.isDefault && rest.length) rest[0].isDefault = true;
    write(K_ADDRESSES, rest);
    Store.emit();
  }

  function setDefaultAddress(id) {
    write(K_ADDRESSES, addresses().map(function (a) {
      return Object.assign({}, a, { isDefault: a.id === id });
    }));
    Store.emit();
  }

  /* ---------------- طرق الدفع ---------------- */
  function payments() { return read(K_PAYMENTS, []); }

  function payment(id) {
    var found = null;
    payments().forEach(function (p) { if (p.id === id) found = p; });
    return found;
  }

  function savePayment(card) {
    var list = payments();

    if (card.id) {
      list = list.map(function (p) { return p.id === card.id ? Object.assign({}, p, card) : p; });
    } else {
      card.id = 'PAY-' + Date.now();
      card.isDefault = list.length === 0;
      list.push(card);
    }

    if (card.isDefault) {
      list = list.map(function (p) { return Object.assign({}, p, { isDefault: p.id === card.id }); });
    }

    write(K_PAYMENTS, list);
    Store.emit();
    return card;
  }

  function removePayment(id) {
    var target = payment(id);
    var rest = payments().filter(function (p) { return p.id !== id; });
    if (target && target.isDefault && rest.length) rest[0].isDefault = true;
    write(K_PAYMENTS, rest);
    Store.emit();
  }

  // سجل المعاملات مشتق من الطلبات — كل طلب مدفوع هو معاملة
  function transactions() {
    return orders().filter(function (o) {
      return ['processing', 'ready', 'shipping', 'delivered', 'returned'].indexOf(o.status) !== -1;
    }).map(function (o) {
      var inv = null;
      invoices().forEach(function (i) { if (i.orderId === o.id) inv = i; });
      return {
        id: 'TRX-' + o.id.replace('ORD-', ''),
        orderId: o.id,
        invoiceId: inv ? inv.id : '',
        date: o.date,
        amount: o.total,
        method: o.payment,
        status: o.status === 'returned' ? 'refunded' : 'paid'
      };
    });
  }

  /* ---------------- التقييمات ---------------- */
  function reviews() { return read(K_REVIEWS, {}); }

  function reviewFor(productId) {
    return reviews()[String(productId)] || null;
  }

  function saveReview(productId, rating, comment) {
    var all = reviews();
    all[String(productId)] = {
      rating: rating,
      comment: comment || '',
      at: isoTime(new Date())
    };
    write(K_REVIEWS, all);
    Store.emit();
  }

  // المنتجات التي اشتراها المشتري فعلاً ووصلته — القابلة للتقييم
  function reviewableProducts() {
    var seen = {};
    var out = [];

    orders().filter(function (o) { return o.status === 'delivered'; }).forEach(function (o) {
      (o.items || []).forEach(function (it) {
        if (seen[it.productId]) return;
        seen[it.productId] = true;
        var p = Store.getProduct(it.productId);
        if (!p) return;
        out.push({ product: p, orderId: o.id, date: o.date, review: reviewFor(it.productId) });
      });
    });

    return out;
  }

  /* ---------------- التوصيات ---------------- */
  // مقترحات مبنية على فئات ما اشتراه المشتري سابقاً
  function recommended(limit) {
    limit = limit || 8;
    var boughtCategories = {};
    var boughtIds = {};

    orders().forEach(function (o) {
      (o.items || []).forEach(function (it) {
        boughtIds[it.productId] = true;
        var p = Store.getProduct(it.productId);
        if (p) boughtCategories[p.category] = (boughtCategories[p.category] || 0) + it.qty;
      });
    });

    var active = Store.getProducts().filter(function (p) { return p.status === 'active'; });

    // رتّب حسب قرب الفئة من اهتمامات المشتري ثم حسب المشاهدات
    active.sort(function (a, b) {
      var wa = boughtCategories[a.category] || 0;
      var wb = boughtCategories[b.category] || 0;
      if (wa !== wb) return wb - wa;
      return (b.views || 0) - (a.views || 0);
    });

    return active.slice(0, limit);
  }

  function categories() {
    var LABELS = {
      steel: 'حديد وصلب', cement: 'أسمنت', concrete: 'خرسانة جاهزة',
      finishing: 'مواد تشطيب', blocks: 'طوب وبلوك', tools: 'أدوات ومعدات'
    };
    var counts = {};
    Store.getProducts().filter(function (p) { return p.status === 'active'; })
      .forEach(function (p) { counts[p.category] = (counts[p.category] || 0) + 1; });

    return Object.keys(LABELS).map(function (k) {
      return { key: k, label: LABELS[k], count: counts[k] || 0 };
    });
  }

  /* ---------------- الإشعارات ---------------- */
  // إشعارات مشتقة من حالة طلبات هذا المشتري وفواتيره وحده
  function notifications() {
    var out = [];

    orders().forEach(function (o) {
      if (o.status === 'shipping' && o.tracking) {
        out.push({
          id: 'BN-ship-' + o.id, type: 'shipping', priority: 'normal',
          title: 'طلبك ' + o.id + ' في الطريق إليك',
          body: 'شُحن عبر ' + (Store.carrierByKey(o.tracking.carrier) || {}).name + ' — يمكنك تتبعه الآن.',
          link: 'buyer-order-details.html?id=' + encodeURIComponent(o.id),
          at: o.statusHistory && o.statusHistory.length ? o.statusHistory[o.statusHistory.length - 1].at : o.date
        });
      } else if (o.status === 'delivered') {
        out.push({
          id: 'BN-done-' + o.id, type: 'order', priority: 'normal',
          title: 'تم تسليم طلبك ' + o.id,
          body: 'شاركنا رأيك في المنتجات التي استلمتها.',
          link: 'buyer-reviews.html',
          at: o.statusHistory && o.statusHistory.length ? o.statusHistory[o.statusHistory.length - 1].at : o.date
        });
      } else if (o.status === 'pending' || o.status === 'processing') {
        out.push({
          id: 'BN-proc-' + o.id, type: 'order', priority: 'normal',
          title: 'طلبك ' + o.id + ' قيد المعالجة',
          body: 'يجهّز المورد طلبك الآن وسيتم شحنه قريباً.',
          link: 'buyer-order-details.html?id=' + encodeURIComponent(o.id),
          at: o.createdAt || o.date
        });
      }
    });

    invoices().forEach(function (i) {
      if (i.status !== 'overdue' && i.status !== 'pending') return;
      out.push({
        id: 'BN-inv-' + i.id, type: 'invoice',
        priority: i.status === 'overdue' ? 'high' : 'normal',
        title: (i.status === 'overdue' ? 'فاتورة متأخرة: ' : 'فاتورة مستحقة: ') + i.id,
        body: 'بقيمة ' + Math.round(i.netAmount) + ' ر.س — تستحق في ' + i.due,
        link: 'buyer-invoices.html',
        at: i.issue
      });
    });

    // عرض نشط واحد كتنبيه ترويجي
    out.push({
      id: 'BN-offer-1', type: 'offer', priority: 'normal',
      title: 'عرض جديد على مواد البناء',
      body: 'خصومات تصل إلى 20% على مجموعة مختارة — تصفّح العروض الآن.',
      link: 'buyer-home.html#offers',
      at: iso(new Date())
    });

    var readMap = read('ammar_buyer_read_notifs', {});
    return out.map(function (n) {
      n.read = !!readMap[n.id];
      return n;
    }).sort(function (a, b) {
      if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
      return a.at < b.at ? 1 : a.at > b.at ? -1 : 0;
    });
  }

  function markNotificationRead(id) {
    var map = read('ammar_buyer_read_notifs', {});
    map[id] = true;
    write('ammar_buyer_read_notifs', map);
    Store.emit();
  }

  function markAllNotificationsRead() {
    var map = {};
    notifications().forEach(function (n) { map[n.id] = true; });
    write('ammar_buyer_read_notifs', map);
    Store.emit();
  }

  function unreadCount() {
    return notifications().filter(function (n) { return !n.read; }).length;
  }

  /* ---------------- السلة ---------------- */
  function cart() { return read(K_CART, []); }

  function cartCount() {
    return cart().reduce(function (s, i) { return s + (i.qty || 0); }, 0);
  }

  // سعر شريحة الكمية إن انطبقت، وإلا السعر بعد الخصم — نفس المنطق المعروض في صفحة المنتج
  function unitPriceOf(p, qty) {
    var base = p.discount > 0 ? p.price * (1 - p.discount / 100) : p.price;
    var match = null;

    (p.tiers || []).forEach(function (t) {
      var from = parseInt(t.from, 10) || 1;
      var to = parseInt(t.to, 10) || 0;
      var price = parseFloat(t.price) || 0;
      if (price > 0 && qty >= from && (!to || qty <= to)) match = price;
    });

    return match !== null ? match : base;
  }

  function cartLines() {
    return cart().map(function (i) {
      var p = Store.getProduct(i.productId);
      if (!p) return null;
      var unit = unitPriceOf(p, i.qty);
      return { product: p, qty: i.qty, unitPrice: unit, lineTotal: unit * i.qty };
    }).filter(Boolean);
  }

  function cartTotal() {
    return cartLines().reduce(function (s, l) { return s + l.lineTotal; }, 0);
  }

  function addToCart(productId, qty) {
    var p = Store.getProduct(productId);
    if (!p) return false;
    // لا تُضاف المنتجات النافدة إلى السلة
    if (Store.deriveAvailability(p) === 'out_of_stock') return false;

    var list = cart();
    var key = String(productId);
    var found = null;
    list.forEach(function (i) { if (String(i.productId) === key) found = i; });

    var step = qty || p.moq || 1;
    if (found) found.qty += step;
    else list.push({ productId: p.id, qty: step });

    write(K_CART, list);
    Store.emit();
    return true;
  }

  function setCartQty(productId, qty) {
    var list = cart().map(function (i) {
      return String(i.productId) === String(productId) ? { productId: i.productId, qty: Math.max(1, qty) } : i;
    });
    write(K_CART, list);
    Store.emit();
  }

  function removeFromCart(productId) {
    write(K_CART, cart().filter(function (i) { return String(i.productId) !== String(productId); }));
    Store.emit();
  }

  function clearCart() { write(K_CART, []); Store.emit(); }

  function inCart(productId) {
    return cart().some(function (i) { return String(i.productId) === String(productId); });
  }

  /* ---------------- شوهدت مؤخراً ---------------- */
  function recordView(productId) {
    var list = read(K_VIEWED, []).filter(function (id) { return String(id) !== String(productId); });
    list.unshift(String(productId));
    write(K_VIEWED, list.slice(0, 12));
  }

  function recentlyViewed(limit) {
    return read(K_VIEWED, []).map(function (id) { return Store.getProduct(id); })
      .filter(Boolean).slice(0, limit || 6);
  }

  /* ---------------- المقارنة ---------------- */
  function compareList() { return read(K_COMPARE, []); }

  function inCompare(productId) {
    return compareList().indexOf(String(productId)) !== -1;
  }

  function toggleCompare(productId) {
    var list = compareList();
    var key = String(productId);
    var idx = list.indexOf(key);

    if (idx !== -1) { list.splice(idx, 1); }
    else {
      if (list.length >= 4) return 'full';   // أربعة منتجات كحد أقصى للمقارنة
      list.push(key);
    }

    write(K_COMPARE, list);
    Store.emit();
    return idx === -1 ? 'added' : 'removed';
  }

  function compareProducts() {
    return compareList().map(function (id) { return Store.getProduct(id); }).filter(Boolean);
  }

  function clearCompare() { write(K_COMPARE, []); Store.emit(); }

  /* ---------------- التقييمات المجمّعة ----------------
     لا يوجد نظام مراجعات عام بدون خادم، فتُشتق قيمة ثابتة لكل منتج من
     معرّفه (لا تتغيّر مع كل تحديث) ويُضاف إليها تقييم المشتري الفعلي
     إن وُجد، حتى تعكس النجوم رأيه الحقيقي فور كتابته. */
  function ratingOf(productId) {
    var id = parseInt(productId, 10) || 1;
    var base = 3.6 + ((id * 37) % 13) / 10;          // 3.6 – 4.8
    var count = 8 + ((id * 91) % 140);

    var mine = reviewFor(productId);
    if (mine) {
      var total = base * count + mine.rating;
      count += 1;
      base = total / count;
    }

    return { value: Math.round(base * 10) / 10, count: count };
  }

  /* ---------------- الموردون ----------------
     الموردون في هذه النسخة مشتقّون من العلامات التجارية للمنتجات. */
  function suppliers() {
    var map = {};

    Store.getProducts().filter(function (p) { return p.status === 'active'; }).forEach(function (p) {
      var name = p.brand || 'عام';
      if (!map[name]) map[name] = { name: name, products: 0, categories: {}, views: 0 };
      map[name].products += 1;
      map[name].views += p.views || 0;
      map[name].categories[p.category] = true;
    });

    return Object.keys(map).map(function (name) {
      var s = map[name];
      var id = encodeURIComponent(name);
      var seed = name.length * 17;
      return {
        id: name,
        slug: id,
        name: name,
        products: s.products,
        categories: Object.keys(s.categories),
        rating: Math.round((4 + (seed % 9) / 10) * 10) / 10,
        views: s.views
      };
    }).sort(function (a, b) { return b.products - a.products || b.views - a.views; });
  }

  function supplier(name) {
    var found = null;
    suppliers().forEach(function (s) { if (s.name === name) found = s; });
    return found;
  }

  function supplierProducts(name) {
    return Store.getProducts().filter(function (p) {
      return p.status === 'active' && (p.brand || 'عام') === name;
    });
  }

  /* ---------------- أقسام المنتجات ---------------- */
  function activeProducts() {
    return Store.getProducts().filter(function (p) { return p.status === 'active'; });
  }

  // الأكثر مبيعاً: من كميات الطلبات الفعلية عبر المتجر كله
  function bestSellers(limit) {
    var sold = {};
    Store.getOrders().forEach(function (o) {
      (o.items || []).forEach(function (it) { sold[it.productId] = (sold[it.productId] || 0) + (it.qty || 0); });
    });

    return activeProducts().slice().sort(function (a, b) {
      return (sold[b.id] || 0) - (sold[a.id] || 0);
    }).slice(0, limit || 8);
  }

  function featured(limit) {
    // المميّزة: الأعلى مشاهدةً مع توفّر فعلي
    return activeProducts().filter(function (p) {
      return Store.deriveAvailability(p) !== 'out_of_stock';
    }).sort(function (a, b) { return (b.views || 0) - (a.views || 0); }).slice(0, limit || 8);
  }

  function newArrivals(limit) {
    // الأحدث: الأعلى معرّفاً (تُضاف المنتجات بمعرّفات تصاعدية)
    return activeProducts().slice().sort(function (a, b) { return b.id - a.id; }).slice(0, limit || 8);
  }

  function flashDeals(limit) {
    return activeProducts().filter(function (p) { return (p.discount || 0) > 0; })
      .sort(function (a, b) { return b.discount - a.discount; }).slice(0, limit || 6);
  }

  // نهاية عروض اليوم: منتصف ليل اليوم الحالي
  function flashDealEndsAt() {
    var d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }

  // منتجات اشتراها المشتري سابقاً — لإعادة الطلب السريع
  function buyAgain(limit) {
    var counts = {};
    orders().forEach(function (o) {
      (o.items || []).forEach(function (it) { counts[it.productId] = (counts[it.productId] || 0) + 1; });
    });

    return Object.keys(counts)
      .sort(function (a, b) { return counts[b] - counts[a]; })
      .map(function (id) { return Store.getProduct(id); })
      .filter(function (p) { return p && p.status === 'active'; })
      .slice(0, limit || 6);
  }

  /* ---------------- البحث الذكي ----------------
     يوحّد صور الحروف العربية قبل المطابقة، فيتساوى "اسمنت" و"أسمنت"
     و"إسمنت"، و"حديده" و"حديدة"، ويتجاهل التشكيل والتطويل. */
  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[ً-ْـ]/g, '')   // تشكيل وتطويل
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // مرادفات وأخطاء إملائية شائعة → الكلمة المعيارية
  var SYNONYMS = {
    'اسمنت': 'اسمنت', 'سمنت': 'اسمنت', 'إسمنت': 'اسمنت', 'اسمانت': 'اسمنت',
    'حديد': 'حديد', 'صلب': 'حديد', 'تسليح': 'حديد', 'شيش': 'حديد', 'زوايا': 'حديد',
    'بلوك': 'بلوك', 'طوب': 'بلوك', 'بلك': 'بلوك', 'انترلوك': 'بلوك',
    'خرسانه': 'خرسانه', 'خرصانه': 'خرسانه', 'باطون': 'خرسانه', 'بيتون': 'خرسانه', 'صبه': 'خرسانه',
    'بلاط': 'تشطيب', 'سيراميك': 'تشطيب', 'بورسلين': 'تشطيب', 'رخام': 'تشطيب',
    'دهان': 'تشطيب', 'بويه': 'تشطيب', 'صبغ': 'تشطيب', 'عزل': 'تشطيب', 'جبس': 'تشطيب',
    'عده': 'ادوات', 'عدد': 'ادوات', 'معدات': 'ادوات', 'خلاطه': 'ادوات', 'خلاط': 'ادوات',
    'سقاله': 'ادوات', 'سلامه': 'ادوات'
  };

  // الكلمة المعيارية → الفئة التي تنتمي إليها
  var TERM_CATEGORY = {
    'اسمنت': 'cement', 'حديد': 'steel', 'بلوك': 'blocks',
    'خرسانه': 'concrete', 'تشطيب': 'finishing', 'ادوات': 'tools'
  };

  // يوسّع الاستعلام بمرادفاته حتى تُطابق الكلمة الدارجة اسم المنتج الرسمي
  function expandQuery(query) {
    var norm = normalize(query);
    var terms = [norm];

    Object.keys(SYNONYMS).forEach(function (key) {
      var nk = normalize(key);
      if (norm.indexOf(nk) !== -1 || nk.indexOf(norm) !== -1) {
        var canon = normalize(SYNONYMS[key]);
        if (terms.indexOf(canon) === -1) terms.push(canon);
        if (terms.indexOf(nk) === -1) terms.push(nk);
      }
    });

    return terms;
  }

  // الفئة التي يقصدها الاستعلام — تُستخدم لاقتراح بدائل عند انعدام النتائج
  function categoryForQuery(query) {
    var terms = expandQuery(query);
    var hit = '';
    terms.forEach(function (t) { if (!hit && TERM_CATEGORY[t]) hit = TERM_CATEGORY[t]; });
    return hit;
  }

  function matchesQuery(haystack, query) {
    var hay = normalize(haystack);
    return expandQuery(query).some(function (t) { return t && hay.indexOf(t) !== -1; });
  }

  // نتائج البحث الكاملة — نفس منطق المطابقة المستخدم في الاقتراحات
  function search(query) {
    if (!String(query || '').trim()) return activeProducts();

    var cat = categoryForQuery(query);

    return activeProducts().filter(function (p) {
      var hay = p.name + ' ' + (p.brand || '') + ' ' + (p.subcategory || '') + ' ' +
        (p.description || '') + ' ' + (categories().filter(function (c) { return c.key === p.category; })[0] || {}).label;
      if (matchesQuery(hay, query)) return true;
      // "بويه" لا تظهر في اسم المنتج لكنها تدل على فئة التشطيب
      return cat && p.category === cat;
    });
  }

  // اقتراحات فورية: منتجات (بصورة وسعر) + فئات + موردون
  function suggest(query, limit) {
    var raw = String(query || '').trim();
    if (raw.length < 1) return [];

    var out = [];

    categories().forEach(function (c) {
      if (matchesQuery(c.label, raw) || TERM_CATEGORY[normalize(raw)] === c.key) {
        out.push({
          type: 'category', label: c.label, sub: c.count + ' منتج',
          href: 'buyer-market.html?category=' + encodeURIComponent(c.key)
        });
      }
    });

    suppliers().forEach(function (s) {
      if (matchesQuery(s.name, raw)) {
        out.push({
          type: 'supplier', label: s.name, sub: s.products + ' منتج',
          href: 'buyer-supplier.html?name=' + encodeURIComponent(s.name)
        });
      }
    });

    search(raw).forEach(function (p) {
      var eff = p.discount > 0 ? p.price * (1 - p.discount / 100) : p.price;
      out.push({
        type: 'product',
        label: p.name,
        sub: (p.brand || 'عام'),
        price: eff,
        unit: p.unit || 'وحدة',
        img: p.img,
        href: 'buyer-product.html?id=' + encodeURIComponent(p.id)
      });
    });

    return out.slice(0, limit || 8);
  }

  // منتجات ذات صلة: نفس الفئة أولاً ثم نفس المورد
  function relatedTo(productId, limit) {
    var p = Store.getProduct(productId);
    if (!p) return [];

    var others = activeProducts().filter(function (x) { return x.id !== p.id; });

    return others.sort(function (a, b) {
      var sa = (a.category === p.category ? 2 : 0) + ((a.brand || '') === (p.brand || '') ? 1 : 0);
      var sb = (b.category === p.category ? 2 : 0) + ((b.brand || '') === (p.brand || '') ? 1 : 0);
      if (sa !== sb) return sb - sa;
      return (b.views || 0) - (a.views || 0);
    }).slice(0, limit || 4);
  }

  /* ---------------- أكواد الخصم ---------------- */
  var PROMOS = {
    'SAVE15': { type: 'percent', value: 15, min: 0, label: 'خصم 15%' },
    'BULK10': { type: 'percent', value: 10, min: 5000, label: 'خصم 10% للطلبات فوق 5,000 ر.س' },
    'FINISH20': { type: 'percent', value: 20, min: 0, category: 'finishing', label: 'خصم 20% على مواد التشطيب' },
    'SHIP0': { type: 'freeship', value: 0, min: 1000, label: 'شحن مجاني للطلبات فوق 1,000 ر.س' },
    'WELCOME50': { type: 'fixed', value: 50, min: 500, label: 'خصم 50 ر.س على أول طلب' }
  };

  function getPromo() { return read(K_PROMO, null); }

  // يتحقق من الكود ويعيد سبباً واضحاً عند الرفض بدل رسالة عامة
  function applyPromo(code) {
    var key = String(code || '').trim().toUpperCase();
    if (!key) return { ok: false, message: 'أدخل كود الخصم أولاً' };

    var promo = PROMOS[key];
    if (!promo) return { ok: false, message: 'كود الخصم غير صحيح أو منتهي الصلاحية' };

    var subtotal = cartTotal();
    if (promo.min && subtotal < promo.min) {
      return { ok: false, message: 'هذا الكود يتطلب طلباً بقيمة ' + Math.round(promo.min) + ' ر.س على الأقل' };
    }

    if (promo.category) {
      var has = cartLines().some(function (l) { return l.product.category === promo.category; });
      if (!has) return { ok: false, message: 'هذا الكود يسري على مواد التشطيب فقط' };
    }

    write(K_PROMO, { code: key, label: promo.label });
    Store.emit();
    return { ok: true, message: 'تم تطبيق الكود: ' + promo.label, promo: promo };
  }

  function clearPromo() { write(K_PROMO, null); Store.emit(); }

  /* ---------------- الشحن والإجماليات ---------------- */
  // تقدير الشحن: رسوم أساسية + وزن، ومجاني فوق عتبة معيّنة
  function shippingEstimate(city) {
    var lines = cartLines();
    if (!lines.length) return { cost: 0, free: false, note: '' };

    var subtotal = lines.reduce(function (s, l) { return s + l.lineTotal; }, 0);
    var weight = lines.reduce(function (s, l) {
      return s + (l.product.weight || 0) * l.qty;
    }, 0);

    var FREE_OVER = 3000;
    var promo = getPromo();
    var freeByPromo = promo && PROMOS[promo.code] && PROMOS[promo.code].type === 'freeship';

    if (subtotal >= FREE_OVER || freeByPromo) {
      return { cost: 0, free: true, note: freeByPromo ? 'شحن مجاني بكود الخصم' : 'شحن مجاني للطلبات فوق ' + FREE_OVER + ' ر.س' };
    }

    var base = 45;
    var far = ['أبها', 'جازان', 'نجران', 'تبوك', 'حائل', 'عرعر', 'سكاكا'];
    if (city && far.indexOf(city) !== -1) base += 35;

    // كل طن إضافي يرفع التكلفة
    var heavy = Math.floor(weight / 1000) * 60;
    var cost = Math.min(base + heavy, 900);

    return {
      cost: cost,
      free: false,
      note: 'يصبح الشحن مجانياً عند تجاوز ' + FREE_OVER + ' ر.س'
    };
  }

  // ملخص مالي موحّد يُستخدم في السلة والدفع والتأكيد — مصدر واحد للأرقام
  function orderSummary(city) {
    var lines = cartLines();
    var subtotal = lines.reduce(function (s, l) { return s + l.lineTotal; }, 0);

    var promoState = getPromo();
    var discount = 0;
    if (promoState && PROMOS[promoState.code]) {
      var promo = PROMOS[promoState.code];
      if (promo.type === 'percent') {
        var base = promo.category
          ? lines.filter(function (l) { return l.product.category === promo.category; })
              .reduce(function (s, l) { return s + l.lineTotal; }, 0)
          : subtotal;
        discount = base * promo.value / 100;
      } else if (promo.type === 'fixed') {
        discount = Math.min(promo.value, subtotal);
      }
    }

    var afterDiscount = Math.max(0, subtotal - discount);
    var ship = shippingEstimate(city);
    // الأسعار المعروضة شاملة الضريبة، فتُستخرج منها لا تُضاف فوقها
    var vat = afterDiscount * Store.VAT_RATE / (1 + Store.VAT_RATE);

    return {
      lines: lines,
      count: lines.reduce(function (s, l) { return s + l.qty; }, 0),
      subtotal: subtotal,
      discount: discount,
      promo: promoState,
      shipping: ship.cost,
      shippingFree: ship.free,
      shippingNote: ship.note,
      vat: vat,
      total: afterDiscount + ship.cost
    };
  }

  /* ---------------- البذرة الأولية ---------------- */
  function ensureSeeded() {
    var seeded = false;
    try { seeded = localStorage.getItem(K_SEEDED) === 'true'; } catch (e) { /* ignore */ }
    if (seeded) return;

    var me = Store.getCustomer(buyerId());

    write(K_ADDRESSES, [
      {
        id: 'ADR-1', label: 'المنزل', recipient: me ? me.name : 'المشتري',
        phone: me ? me.phone : '+966501234567',
        city: me ? me.city : 'الرياض', district: 'حي النرجس',
        street: 'شارع الأمير محمد بن سلمان', buildingNo: '3421', postalCode: '13323',
        isDefault: true
      },
      {
        id: 'ADR-2', label: 'موقع المشروع', recipient: 'مهندس الموقع',
        phone: '+966555667788',
        city: me ? me.city : 'الرياض', district: 'حي العارض',
        street: 'طريق الملك سلمان', buildingNo: '7890', postalCode: '13544',
        isDefault: false
      }
    ]);

    write(K_PAYMENTS, [
      { id: 'PAY-1', brand: 'مدى', holder: me ? me.name : 'المشتري', last4: '4821', expiry: '09/28', isDefault: true },
      { id: 'PAY-2', brand: 'فيزا', holder: me ? me.name : 'المشتري', last4: '7135', expiry: '02/27', isDefault: false }
    ]);

    write(K_WISHLIST, ['3', '4']);

    try { localStorage.setItem(K_SEEDED, 'true'); } catch (e) { /* ignore */ }
  }

  ensureSeeded();

  return {
    buyerId: buyerId,
    profile: profile,
    saveProfile: saveProfile,

    orders: orders,
    order: order,
    invoices: invoices,
    invoice: invoice,

    wishlist: wishlist,
    inWishlist: inWishlist,
    toggleWishlist: toggleWishlist,
    wishlistProducts: wishlistProducts,

    addresses: addresses,
    address: address,
    saveAddress: saveAddress,
    removeAddress: removeAddress,
    setDefaultAddress: setDefaultAddress,

    payments: payments,
    payment: payment,
    savePayment: savePayment,
    removePayment: removePayment,
    transactions: transactions,

    reviews: reviews,
    reviewFor: reviewFor,
    saveReview: saveReview,
    reviewableProducts: reviewableProducts,

    recommended: recommended,
    categories: categories,

    cart: cart,
    cartLines: cartLines,
    cartCount: cartCount,
    cartTotal: cartTotal,
    addToCart: addToCart,
    setCartQty: setCartQty,
    removeFromCart: removeFromCart,
    clearCart: clearCart,
    inCart: inCart,

    recordView: recordView,
    recentlyViewed: recentlyViewed,

    compareList: compareList,
    compareProducts: compareProducts,
    inCompare: inCompare,
    toggleCompare: toggleCompare,
    clearCompare: clearCompare,

    ratingOf: ratingOf,
    suppliers: suppliers,
    supplier: supplier,
    supplierProducts: supplierProducts,

    activeProducts: activeProducts,
    featured: featured,
    bestSellers: bestSellers,
    newArrivals: newArrivals,
    flashDeals: flashDeals,
    flashDealEndsAt: flashDealEndsAt,
    buyAgain: buyAgain,

    normalize: normalize,
    expandQuery: expandQuery,
    matchesQuery: matchesQuery,
    categoryForQuery: categoryForQuery,
    search: search,
    suggest: suggest,
    relatedTo: relatedTo,

    getPromo: getPromo,
    applyPromo: applyPromo,
    clearPromo: clearPromo,
    shippingEstimate: shippingEstimate,
    orderSummary: orderSummary,

    guestInfo: function () { return read(K_GUEST, null); },
    saveGuestInfo: function (info) { write(K_GUEST, info); },

    notifications: notifications,
    markNotificationRead: markNotificationRead,
    markAllNotificationsRead: markAllNotificationsRead,
    unreadCount: unreadCount
  };
})();
