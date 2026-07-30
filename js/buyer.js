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

    notifications: notifications,
    markNotificationRead: markNotificationRead,
    markAllNotificationsRead: markAllNotificationsRead,
    unreadCount: unreadCount
  };
})();
