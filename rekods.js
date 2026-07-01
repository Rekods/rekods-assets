/*!
 * rekods.js — site-wide behaviour for the Rekods marketing site.
 *
 * Loaded once via a single <script src> tag in Webflow's site Footer.
 * Add new site-wide scripts to THIS file over time, rather than pasting
 * more code into Webflow's custom-code fields (which cap at 10,000 chars).
 *
 * Pricing NUMBERS are NOT here. They live in window.REKODS_PRICING, defined
 * inline in the Webflow Footer (spec 7.0, single source of truth). This file
 * only contains logic and reads those numbers — it never hardcodes a price.
 *
 * Contents:
 *   A. UI interactions bundle
 *        1. Persona-switcher active-pill routing (URL-driven)
 *        2. "Share this page" copy-to-clipboard
 *        3. Nav dropdown close (outside-click / Escape)
 *        4. Scroll-reveal fade-ins (elements tagged [data-reveal])
 *        5. Hamburger mobile nav (styles live in Webflow Head CSS)
 *   B. Region + currency detection (window.REKODS_REGION, spec 7.1 / 10)
 */

/* =====================================================================
 * A. UI INTERACTIONS BUNDLE
 * ===================================================================== */
(function () {
  "use strict";
  var d = document;

  /* 1. Persona switcher: give the pill whose href matches the current URL
   *    aria-current="page" so the active persona highlights. Runs on every
   *    load, so refresh and the back button always show the right pill. */
  (function () {
    function norm(p) { return (p || "").replace(/\/+$/, "").toLowerCase() || "/"; }
    var here = norm(location.pathname);
    [].forEach.call(d.querySelectorAll("a.switcher-pill"), function (a) {
      var href = a.getAttribute("href") || "", path;
      try { path = norm(new URL(href, location.origin).pathname); }
      catch (e) { path = norm(href); }
      if (path === here) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  })();

  /* 2. "Share this page": any element with data-action="share" copies the
   *    current page URL to the clipboard and briefly shows "Link copied". */
  (function () {
    function copyText(t) {
      if (navigator.clipboard && navigator.clipboard.writeText)
        return navigator.clipboard.writeText(t);
      return new Promise(function (resolve, reject) {
        try {
          var ta = d.createElement("textarea");
          ta.value = t; ta.setAttribute("readonly", "");
          ta.style.position = "fixed"; ta.style.opacity = "0";
          d.body.appendChild(ta); ta.select();
          d.execCommand("copy"); d.body.removeChild(ta); resolve();
        } catch (e) { reject(e); }
      });
    }
    d.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest('[data-action="share"]') : null;
      if (!btn) return;
      e.preventDefault();
      var url = btn.getAttribute("data-share-url") || (location.origin + location.pathname);
      copyText(url).then(function () {
        if (btn.getAttribute("data-busy")) return;
        btn.setAttribute("data-busy", "1");
        var prev = btn.textContent;
        btn.textContent = "Link copied";
        setTimeout(function () { btn.textContent = prev; btn.removeAttribute("data-busy"); }, 1800);
      }).catch(function () { window.prompt("Copy this link:", url); });
    });
  })();

  /* 3. Nav dropdown: close any open <details class="nav-dropdown"> when the
   *    visitor clicks outside it or presses Escape. */
  (function () {
    d.addEventListener("click", function (e) {
      var inside = e.target.closest ? e.target.closest("details.nav-dropdown") : null;
      [].forEach.call(d.querySelectorAll("details.nav-dropdown[open]"), function (x) {
        if (x !== inside) x.removeAttribute("open");
      });
    });
    d.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      [].forEach.call(d.querySelectorAll("details.nav-dropdown[open]"), function (x) {
        x.removeAttribute("open");
      });
    });
  })();

  /* 4. Scroll reveals: elements tagged [data-reveal] fade/rise in once when
   *    they scroll into view (one-shot). The hidden/animated styles live in
   *    the Webflow Head CSS; reduced-motion is handled there too. */
  (function () {
    var els = [].slice.call(d.querySelectorAll("[data-reveal]"));
    if (!els.length) return;
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-revealed"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("is-revealed");
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.1 });
    els.forEach(function (el) { io.observe(el); });
  })();

  /* 5. Hamburger mobile nav: injects the burger button into the nav bar and
   *    toggles the slide-down menu (styles are in the Webflow Head CSS).
   *    Closes on link tap, Escape, outside-click, or resize back to desktop. */
  (function () {
    var nav = d.querySelector(".nav-bar");
    if (!nav) return;
    var container = nav.querySelector(".nav-container") || nav;
    var menu = nav.querySelector(".nav-menu");
    if (!menu) return;
    nav.classList.add("nav-js");
    if (!menu.id) menu.id = "primary-nav-menu";

    var btn = d.createElement("button");
    btn.type = "button";
    btn.className = "nav-burger";
    btn.setAttribute("aria-label", "Menu");
    btn.setAttribute("aria-controls", menu.id);
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = '<span class="nav-burger-bar" aria-hidden="true"></span>';
    container.appendChild(btn);

    function setOpen(open) {
      nav.classList.toggle("nav-open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    }
    btn.addEventListener("click", function () { setOpen(!nav.classList.contains("nav-open")); });
    menu.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("a")) setOpen(false); });
    d.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
    d.addEventListener("click", function (e) {
      if (nav.classList.contains("nav-open") && !nav.contains(e.target)) setOpen(false);
    });
    window.addEventListener("resize", function () { if (window.innerWidth > 991) setOpen(false); });
  })();
})();

/* =====================================================================
 * B. REGION + CURRENCY DETECTION  (spec 7.1 / 10)
 *
 * On load, looks up the visitor's country by IP, then decides:
 *   tier     = 'developed' if the country is on the DEV allowlist below,
 *              otherwise 'emerging'  (World Bank income-group rule)
 *   currency = the mapped local currency in CUR, otherwise 'USD'
 * The result is published on window.REKODS_REGION for the pricing UI, fired
 * as a "rekods:region-ready" event, and cached for the session.
 * Fails safe to Developed/USD if detection is slow, blocked, or returns
 * nothing — it never blocks page render.
 * window.rekodsSetRegion('XX') is the manual override for the "Change
 * region" control (remembered for the rest of the session).
 * ===================================================================== */
(function () {
  "use strict";

  // Eurozone country codes — all show EUR, all Developed.
  var EUROZONE = ["AT","BE","HR","CY","EE","FI","FR","DE","GR","IE",
                  "IT","LV","LT","LU","MT","NL","PT","SK","SI","ES"];

  // CUR = the ONLY countries that display a local currency (spec 7.1 map).
  //       Everyone else shows USD at whichever tier they fall into.
  var CUR = {
    US:"USD", GB:"GBP", CA:"CAD", AU:"AUD", NZ:"NZD",
    SG:"SGD", AE:"AED", IL:"ILS",
    GH:"GHS", NG:"NGN", KE:"KES", ZA:"ZAR", IN:"INR",
    PK:"PKR", PH:"PHP", VN:"VND", ID:"IDR"
  };
  EUROZONE.forEach(function (c) { CUR[c] = "EUR"; });

  // DEV = the Developed (high-income) allowlist. Any detected country NOT on
  //       this list resolves to Emerging automatically. Deliberate emerging
  //       exceptions (Chile, Uruguay, Panama, Bahamas, Trinidad, Barbados,
  //       Seychelles, Guyana, China, Thailand, Malaysia) are simply absent.
  var DEV = {};
  ["US","GB","CA","AU","NZ","SG","AE","IL",
   "CH","NO","SE","DK","IS","PL","CZ","HU","RO","BG",
   "AD","MC","SM","LI",
   "SA","QA","KW","BH","OM",
   "JP","KR","TW","HK","MO","BN"].concat(EUROZONE).forEach(function (c) { DEV[c] = 1; });

  var KEY = "rekods_region";                                 // sessionStorage key
  var TIMEOUT = 2500;                                          // ms before failing safe
  var PROVIDER = "https://get.geojs.io/v1/ip/country.json";   // no-key IP geolocation

  // Resolve a country code to { country, tier, currency }.
  function lookup(cc) {
    cc = (cc || "").toUpperCase();
    if (!cc) return { country: null, tier: "developed", currency: "USD" };
    return {
      country: cc,
      tier: DEV[cc] ? "developed" : "emerging",
      currency: CUR[cc] || "USD"
    };
  }
  // Publish globally + notify any listening pricing scripts.
  function publish(region) {
    window.REKODS_REGION = region;
    try { document.dispatchEvent(new CustomEvent("rekods:region-ready", { detail: region })); }
    catch (e) {}
  }
  // Remember the resolved region for the rest of the session.
  function cache(region) {
    try { sessionStorage.setItem(KEY, JSON.stringify(region)); } catch (e) {}
  }

  // Set a valid default immediately so nothing ever waits on the network.
  window.REKODS_REGION = { country: null, tier: "developed", currency: "USD", source: "default" };

  // Manual override for the "Change region" control.
  window.rekodsSetRegion = function (countryCode) {
    var r = lookup(countryCode); r.source = "manual"; cache(r); publish(r); return r;
  };

  // Session cache hit → use it, skip the network call entirely.
  try {
    var saved = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (saved && saved.tier && saved.currency) { publish(saved); return; }
  } catch (e) {}

  // Otherwise detect. Hard timeout falls back to Developed/USD (safe default).
  var done = false;
  var controller = ("AbortController" in window) ? new AbortController() : null;
  var timer = setTimeout(function () {
    if (done) return;
    done = true;
    if (controller) controller.abort();
    publish({ country: null, tier: "developed", currency: "USD", source: "fallback" });
  }, TIMEOUT);

  fetch(PROVIDER, controller ? { signal: controller.signal } : undefined)
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function (data) {
      if (done) return;
      done = true; clearTimeout(timer);
      var region = lookup(data && data.country); region.source = "detected";
      cache(region); publish(region);
    })
    .catch(function () {
      if (done) return;
      done = true; clearTimeout(timer);
      publish({ country: null, tier: "developed", currency: "USD", source: "fallback" });
    });
})();
