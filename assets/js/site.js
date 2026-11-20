// Endeavour Industries — small progressive enhancements. Every page works without JS.

// Where enquiries are sent. FormSubmit e-mails each submission to this address
// (the very first submission triggers a one-time "activate" e-mail to sales@ — click it).
// To switch services (e.g. Web3Forms), change this URL and the payload in submitForm().
const FORM_ENDPOINT = "https://formsubmit.co/ajax/sales@endeavourindustries.in";
const SALES_EMAIL = "sales@endeavourindustries.in";

document.addEventListener("DOMContentLoaded", () => {
  // Mobile nav
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("primary-nav");
  toggle?.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav?.classList.contains("open")) { nav.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); toggle.focus(); }
  });

  initCatalogue();
  initGallery();
  document.querySelectorAll("form[data-enquiry]").forEach(initForm);

  // Keep the floating WhatsApp button off the enquiry form while the form is on screen
  const wa = document.querySelector(".wa-float");
  const forms = document.querySelectorAll("form[data-enquiry]");
  if (wa && forms.length && "IntersectionObserver" in window) {
    const seen = new Set();
    const fo = new IntersectionObserver((entries) => {
      entries.forEach((en) => (en.isIntersecting ? seen.add(en.target) : seen.delete(en.target)));
      wa.classList.toggle("hide", seen.size > 0);
    });
    forms.forEach((f) => fo.observe(f));
  }

  // Scroll reveal
  const els = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    }), { rootMargin: "0px 0px -8% 0px" });
    els.forEach((el) => io.observe(el));
  } else els.forEach((el) => el.classList.add("in"));
});

// Category chips + search on products.html
function initCatalogue() {
  const grid = document.getElementById("catalogue");
  if (!grid) return;
  const cards = [...grid.querySelectorAll(".product-card")];
  const chips = [...document.querySelectorAll(".chip[data-cat]")];
  const search = document.getElementById("product-search");
  const count = document.getElementById("result-count");
  const empty = document.getElementById("catalogue-empty");
  const params = new URLSearchParams(location.search);
  let cat = params.get("category") || "all";
  if (!chips.some((c) => c.dataset.cat === cat)) cat = "all";
  if (search && params.get("q")) search.value = params.get("q");

  const labels = Object.fromEntries(chips.map((c) => [c.dataset.cat, c.firstChild.textContent.trim()]));

  function apply() {
    const q = (search?.value || "").trim().toLowerCase();
    let shown = 0;
    cards.forEach((card) => {
      const ok = (cat === "all" || card.dataset.cat.split(" ").includes(cat)) && (!q || card.dataset.search.includes(q));
      card.hidden = !ok;
      if (ok) shown++;
      // Under an industry filter, show that industry's label and printed bag on the card
      const own = card.dataset.cat.split(" ");
      const c = cat === "all" ? own[0] : cat;
      const tag = card.querySelector(".cat-tag"), img = card.querySelector(".pack-thumb img");
      if (tag && labels[c]) tag.textContent = labels[c] + (cat === "all" && own.length > 1 ? ` +${own.length - 1}` : "");
      const pack = (card.dataset.packs || "").split("|").map((x) => x.split("=")).find((x) => x[0] === c);
      if (img && pack && img.getAttribute("src") !== pack[1]) img.src = pack[1];
    });
    chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.cat === cat)));
    count.textContent = `Showing ${shown} of ${cards.length} products`;
    empty.hidden = shown > 0;
    const url = new URL(location.href);
    cat === "all" ? url.searchParams.delete("category") : url.searchParams.set("category", cat);
    history.replaceState(null, "", url);
  }
  chips.forEach((c) => c.addEventListener("click", () => { cat = c.dataset.cat; apply(); }));
  search?.addEventListener("input", apply);
  apply();
}

// Product page: switch between product photo and packaging photo
function initGallery() {
  const main = document.querySelector(".pd-main");
  if (!main) return;
  const thumbs = document.querySelectorAll(".pd-thumb");
  thumbs.forEach((t) => t.addEventListener("click", () => {
    thumbs.forEach((x) => x.setAttribute("aria-pressed", String(x === t)));
    main.innerHTML = t.dataset.html;
    main.classList.toggle("is-pack", t.classList.contains("pack"));
  }));
}

function initForm(form) {
  const status = form.querySelector(".form-status");
  const params = new URLSearchParams(location.search);
  const product = form.querySelector("[name=product]");
  if (product && params.get("product")) {
    const want = params.get("product");
    const opt = [...product.options].find((o) => o.value === want);
    if (opt) product.value = want;
  }

  form.querySelectorAll("[required]").forEach((f) => f.addEventListener("blur", () => validate(f)));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fields = [...form.querySelectorAll("[required]")];
    const bad = fields.filter((f) => !validate(f));
    if (bad.length) {
      show(`Please check ${bad.length === 1 ? "the highlighted field" : bad.length + " highlighted fields"}.`, false);
      bad[0].focus();
      return;
    }
    const data = Object.fromEntries(new FormData(form));
    if (data._honey) return; // bot
    const btn = form.querySelector("[type=submit]");
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = "Sending…";
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          _subject: `Website enquiry: ${data.product || "General"} — ${data.name}`,
          _template: "table", _captcha: "false",
          Name: data.name, Company: data.company, Email: data.email, Phone: data.phone,
          Country: data.country, Product: data.product, Quantity: data.quantity, Message: data.message,
          Page: location.href,
        }),
      });
      if (!res.ok) throw new Error(res.status);
      // FormSubmit answers HTTP 200 with success:"false" when it did not deliver (e.g. form not activated yet)
      const out = await res.json().catch(() => ({}));
      if (String(out.success) === "false") throw new Error(out.message || "not delivered");
      form.reset();
      show("Thank you — your enquiry has reached our sales team. We usually reply within one working day.", true);
    } catch {
      // Network/service failure: fall back to the visitor's own mail app so the lead is never lost.
      const body = Object.entries({ Name: data.name, Company: data.company, Email: data.email, Phone: data.phone, Country: data.country, Product: data.product, Quantity: data.quantity, Message: data.message })
        .map(([k, v]) => `${k}: ${v || "-"}`).join("\r\n");
      show(`We couldn't send that automatically. Your e-mail app will open with the enquiry pre-filled — or write to ${SALES_EMAIL}.`, false);
      location.href = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent("Enquiry: " + (data.product || "General"))}&body=${encodeURIComponent(body)}`;
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  });

  function show(msg, ok) {
    status.textContent = msg;
    status.className = `form-status show ${ok ? "ok" : "bad"}`;
    if (ok) status.focus();
  }
}

function validate(f) {
  const wrap = f.closest(".field");
  const ok = f.value.trim() !== "" && f.checkValidity();
  wrap?.classList.toggle("invalid", !ok);
  f.setAttribute("aria-invalid", String(!ok));
  return ok;
}
