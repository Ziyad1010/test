/* ============================================================
   عمار — سوق مواد البناء | main.js
   Frontend-only: mock data rendering + light interactions.
   ============================================================ */

"use strict";

/* ---------- Mock data: categories ---------- */
const CATEGORIES = [
  { id: "cement",    name: "إسمنت",            img: "assets/images/cat-cement.jpg" },
  { id: "steel",     name: "حديد",             img: "assets/images/cat-steel.jpg" },
  { id: "concrete",  name: "خرسانة جاهزة",     img: "assets/images/cat-concrete.jpg" },
  { id: "blocks",    name: "طوب وبلوك",        img: "assets/images/cat-blocks.jpg" },
  { id: "finishing", name: "مواد تشطيب",        img: "assets/images/cat-finishing.jpg" },
  { id: "tools",     name: "أدوات ومعدات",      img: "assets/images/cat-tools.jpg" },
];

/* ---------- Mock data: featured products (prices in SAR) ---------- */
const PRODUCTS = [
  {
    id: 1,
    name: "خرسانة جاهزة",
    spec: "Ready mix Concrete",
    price: "2,850",
    unit: "طن",
    img: "assets/images/cat-concrete.jpg",
    available: true,
  },
  {
    id: 2,
    name: "طوب وبلوك",
    spec: "Blocks & Bricks",
    price: "2,850",
    unit: "طن",
    img: "assets/images/cat-blocks.jpg",
    available: true,
  },
  {
    id: 3,
    name: "حديد سابك",
    spec: "SABIC Steel",
    price: "2,850",
    unit: "طن",
    img: "assets/images/cat-steel.jpg",
    available: true,
  },
  {
    id: 4,
    name: "حديد سابك",
    spec: "SABIC Steel",
    price: "2,850",
    unit: "طن",
    img: "assets/images/cat-steel.jpg",
    available: true,
  },
  {
    id: 5,
    name: "خرسانة جاهزة",
    spec: "Blocks & Bricks",
    price: "2,850",
    unit: "طن",
    img: "assets/images/cat-concrete.jpg",
    available: true,
  },
  {
    id: 6,
    name: "أسمنت",
    spec: "Portland Cement",
    price: "2,850",
    unit: "طن",
    img: "assets/images/cat-cement.jpg",
    available: true,
  },
];

/* ---------- Render categories ---------- */
function renderCategories() {
  const grid = document.getElementById("catGrid");
  if (!grid) return;
  grid.innerHTML = CATEGORIES.map(
    (c) => `
    <a href="#" class="cat-card reveal" data-cat="${c.id}">
      <img src="${c.img}" alt="${c.name}" loading="lazy" />
      <div class="cat-card-body">
        <h3>${c.name}</h3>
        <span class="cat-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
        </span>
      </div>
    </a>`
  ).join("");
}

/* ---------- Render products ---------- */
function renderProducts() {
  const track = document.getElementById("prodTrack");
  if (!track) return;
  track.innerHTML = PRODUCTS.map(
    (p) => `
    <article class="prod-card reveal" data-id="${p.id}">
      ${p.available ? '<span class="prod-badge">متوفر</span>' : ''}
      <button class="wish-btn" aria-label="أضف للمفضلة">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      </button>
      <div class="prod-img"><img src="${p.img}" alt="${p.name}" loading="lazy" /></div>
      <h3 class="prod-name">${p.name}</h3>
      <p class="prod-spec">${p.spec}</p>
      <p class="prod-price">
        ${p.price} <span class="curr">ر.س</span> <span class="unit">/ ${p.unit}</span>
      </p>
      <button class="add-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        أضف للسلة
      </button>
    </article>`
  ).join("");
}

/* ---------- Cart (mock) ---------- */
let cartCount = 2;
function bindCart() {
  const badge = document.getElementById("cartCount");
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".add-btn");
    if (!btn) return;
    cartCount += 1;
    badge.textContent = cartCount;
    badge.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.45)" }, { transform: "scale(1)" }],
      { duration: 320, easing: "ease-out" }
    );
    const original = btn.innerHTML;
    btn.innerHTML = "تمت الإضافة ✓";
    btn.disabled = true;
    setTimeout(() => {
      btn.innerHTML = original;
      btn.disabled = false;
    }, 1200);
  });
}

/* ---------- Wishlist toggle ---------- */
function bindWishlist() {
  document.addEventListener("click", (e) => {
    const w = e.target.closest(".wish-btn");
    if (!w) return;
    w.classList.toggle("active");
  });
}

/* ---------- Product slider arrows ---------- */
function bindSlider() {
  const track = document.getElementById("prodTrack");
  const prev = document.getElementById("prodPrev");
  const next = document.getElementById("prodNext");
  if (!track || !prev || !next) return;
  const step = () => track.clientWidth * 0.6;
  /* RTL: scrolling "forward" means negative scrollLeft in most engines */
  next.addEventListener("click", () => track.scrollBy({ left: -step(), behavior: "smooth" }));
  prev.addEventListener("click", () => track.scrollBy({ left: step(), behavior: "smooth" }));
}

/* ---------- Mobile menu ---------- */
function bindMenu() {
  const toggle = document.getElementById("menuToggle");
  const nav = document.getElementById("mainNav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => nav.classList.toggle("open"));
  nav.addEventListener("click", (e) => {
    if (e.target.classList.contains("nav-link")) nav.classList.remove("open");
  });
}

/* ---------- Active nav link on scroll ---------- */
function bindActiveNav() {
  const links = document.querySelectorAll(".nav-link");
  const sections = [...links]
    .map((l) => document.querySelector(l.getAttribute("href")))
    .filter(Boolean);
  window.addEventListener(
    "scroll",
    () => {
      const y = window.scrollY + 120;
      let current = sections[0];
      sections.forEach((s) => {
        if (s.offsetTop <= y) current = s;
      });
      links.forEach((l) => l.classList.toggle("active", l.getAttribute("href") === "#" + current.id));
    },
    { passive: true }
  );
}

/* ---------- Search (mock) ---------- */
function bindSearch() {
  const form = document.getElementById("searchForm");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = document.getElementById("searchInput").value.trim();
    const cat = document.getElementById("searchCategory");
    const catName = cat.options[cat.selectedIndex].text;
    alert(q ? `جارٍ البحث عن: «${q}» في ${catName}` : "اكتب كلمة للبحث أولًا");
  });
}

/* ---------- Scroll reveal ---------- */
function bindReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("visible");
          observer.unobserve(en.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", () => {
  renderCategories();
  renderProducts();
  bindCart();
  bindWishlist();
  bindSlider();
  bindMenu();
  bindActiveNav();
  bindSearch();
  /* mark static blocks for reveal */
  document
    .querySelectorAll(".promo-card, .trust-item, .partners-inner")
    .forEach((el) => el.classList.add("reveal"));
  bindReveal();
});
