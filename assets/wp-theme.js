(function () {
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function () {
    // Auto-submit collection filters and sort
    document.querySelectorAll('[data-wp-autosubmit]').forEach(function (el) {
      el.addEventListener('change', function () {
        var f = el.form || el.closest('form');
        if (f) f.submit();
      });
    });
    // Mobile header cart: slide the cart drawer open (falls back to the cart page)
    document.querySelectorAll('[data-wp-cart]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || !window.matchMedia('(max-width: 900px)').matches) return;
        var drawer = document.getElementById('cart-drawer');
        if (!drawer || typeof drawer.open !== 'function') return;
        e.preventDefault();
        drawer.open();
      });
    });
    // Quantity steppers
    document.querySelectorAll('[data-wp-qty]').forEach(function (box) {
      var input = box.querySelector('input');
      box.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () {
          var n = parseInt(input.value || '1', 10) + (b.dataset.step === 'up' ? 1 : -1);
          input.value = Math.max(1, n);
        });
      });
    });
    // Product page variant picker + gallery
    var root = document.querySelector('[data-wp-product]');
    if (!root) return;
    var data = JSON.parse(root.querySelector('script[data-wp-variants]').textContent);
    var form = root.querySelector('form');
    var idInput = form.querySelector('input[name=id]');
    var priceEl = root.querySelector('[data-wp-price]');
    var addBtn = root.querySelector('[data-wp-add]');
    var buyBtn = root.querySelector('[data-wp-buy]');
    var groups = Array.prototype.slice.call(root.querySelectorAll('[data-wp-option]'));
    var sel = groups.map(function (g) {
      var on = g.querySelector('[aria-pressed=true]');
      return on ? on.dataset.value : null;
    });
    function money(c) {
      try { return new Intl.NumberFormat(document.documentElement.lang || 'en', { style: 'currency', currency: data.currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(c / 100); }
      catch (e) { return (c / 100).toFixed(2); }
    }
    function find() {
      return data.variants.find(function (v) { return sel.every(function (s, i) { return v.options[i] === s; }); });
    }
    function update() {
      var v = find();
      groups.forEach(function (g, i) {
        var lab = g.querySelector('[data-wp-selected]');
        if (lab) lab.textContent = sel[i];
        g.querySelectorAll('button').forEach(function (b) {
          b.setAttribute('aria-pressed', b.dataset.value === sel[i] ? 'true' : 'false');
          var probe = sel.slice(); probe[i] = b.dataset.value;
          var m = data.variants.find(function (x) { return probe.every(function (s, k) { return x.options[k] === s; }); });
          if (!m || !m.available) b.setAttribute('data-unavailable', ''); else b.removeAttribute('data-unavailable');
        });
      });
      if (!v) { addBtn.disabled = true; if (buyBtn) buyBtn.disabled = true; addBtn.textContent = data.unavailableLabel; return; }
      idInput.value = v.id;
      priceEl.innerHTML = money(v.price) + (v.compare_at_price > v.price ? '<s>' + money(v.compare_at_price) + '</s>' : '');
      addBtn.disabled = !v.available; if (buyBtn) buyBtn.disabled = !v.available;
      addBtn.textContent = v.available ? data.addLabel : data.soldOutLabel;
      var u = new URL(window.location.href); u.searchParams.set('variant', v.id); window.history.replaceState({}, '', u);
      if (v.image) { var main = root.querySelector('[data-wp-main-img]'); if (main) { main.src = v.image; main.removeAttribute('srcset'); } }
    }
    groups.forEach(function (g, i) {
      g.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () { sel[i] = b.dataset.value; update(); });
      });
    });
    root.querySelectorAll('[data-wp-thumb]').forEach(function (t) {
      t.addEventListener('click', function () {
        var main = root.querySelector('[data-wp-main-img]');
        if (main) { main.src = t.dataset.src; main.removeAttribute('srcset'); }
        root.querySelectorAll('[data-wp-thumb]').forEach(function (o) { o.setAttribute('aria-current', o === t ? 'true' : 'false'); });
      });
    });
    update();
  });
})();
