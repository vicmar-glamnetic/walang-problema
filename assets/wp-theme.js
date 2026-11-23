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
    // Cart icon: slide the cart drawer open at every width.
    // The link still goes to the cart page if the drawer is missing or never loads.
    var cartDrawer = document.getElementById('cart-drawer');
    if (cartDrawer) cartDrawer.setAttribute('no-persist', '');
    function openCart() {
      return Promise.race([
        customElements.whenDefined('theme-drawer'),
        new Promise(function (_, fail) { setTimeout(function () { fail(new Error('cart drawer did not load')); }, 4000); })
      ]).then(function () { if (!cartDrawer.isOpen) cartDrawer.open(); });
    }
    document.querySelectorAll('[data-wp-cart]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        if (!cartDrawer || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        openCart().catch(function (err) { console.error('[wp-cart]', err); window.location.href = link.href; });
      });
    });
    // On desktop the drawer is not modal, so a click on the dimmed page (painted by body) closes it
    document.addEventListener('click', function (e) {
      if (e.target === document.body && cartDrawer && cartDrawer.isOpen && window.matchMedia('(min-width: 990px)').matches) cartDrawer.close();
    });
    // Header search: the icon opens a full-width bar with live suggestions.
    // Without JavaScript the icon is a plain link to the search page.
    (function () {
      var panel = document.querySelector('[data-wp-spanel]');
      var icon = document.querySelector('[data-wp-search]');
      if (!panel || !icon) return;
      var input = panel.querySelector('input[name=q]');
      var idle = panel.querySelector('[data-wp-search-idle]');
      var box = panel.querySelector('[data-wp-search-results]');
      var status = panel.querySelector('[data-wp-search-status]');
      var menu = document.querySelector('.wp-mnav');
      var timer, request, last = '';
      function make(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; }
      function link(cls, url, text) { var n = make('a', cls, text); n.href = url; return n; }
      function price(v) {
        var n = parseFloat(v);
        if (isNaN(n)) return '';
        try { return new Intl.NumberFormat(document.documentElement.lang || 'en', { style: 'currency', currency: panel.dataset.currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n); }
        catch (e) { return String(v); }
      }
      function showIdle() { last = ''; if (request) request.abort(); idle.hidden = false; box.hidden = true; status.textContent = ''; }
      function setOpen(open, refocus) {
        panel.hidden = !open;
        icon.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) { if (menu) menu.removeAttribute('open'); input.focus(); input.select(); search(); }
        else { clearTimeout(timer); if (request) request.abort(); last = ''; if (refocus) icon.focus(); }
      }
      function chips(list, label, text) {
        if (!list || !list.length) return;
        box.appendChild(make('p', 'wp-hand wp-spanel__label', label));
        var row = make('div', 'wp-spanel__chips');
        list.slice(0, 8).forEach(function (x) { row.appendChild(link('wp-chip', x.url, text(x))); });
        box.appendChild(row);
      }
      function draw(term, res) {
        var products = res.products || [], collections = res.collections || [], queries = res.queries || [];
        box.textContent = '';
        if (products.length) {
          box.appendChild(make('p', 'wp-hand wp-spanel__label', 'Catch of the day'));
          var grid = make('div', 'wp-spanel__grid');
          products.slice(0, 6).forEach(function (p) {
            var a = link('wp-spanel__item', p.url);
            var pic = make('span', 'wp-spanel__pic' + ((p.tags || []).indexOf('white-bg') > -1 ? ' wp-white-bg' : ''));
            var src = (p.featured_image && p.featured_image.url) || p.image;
            if (src) {
              var img = make('img');
              var u = new URL(src, window.location.href);
              u.searchParams.set('width', '400');
              img.src = u.href; img.alt = ''; img.loading = 'lazy';
              pic.appendChild(img);
            }
            a.appendChild(pic);
            a.appendChild(make('span', 'wp-spanel__name', p.title));
            a.appendChild(make('span', 'wp-spanel__price', price(p.price)));
            grid.appendChild(a);
          });
          box.appendChild(grid);
          var all = new URL(panel.dataset.searchUrl, window.location.href);
          all.searchParams.set('q', term);
          all.searchParams.set('type', 'product');
          all.searchParams.set('options[prefix]', 'last');
          box.appendChild(link('wp-btn wp-btn--primary wp-spanel__all', all.href, 'See all results'));
        } else {
          box.appendChild(make('p', 'wp-spanel__none', 'Nothing washed ashore for \u201c' + term + '\u201d. Try a shorter word like tee, cap or bag.'));
        }
        chips(collections.slice(0, 4).concat(queries.slice(0, 4)), 'Also try', function (x) { return x.title || x.text; });
        idle.hidden = products.length + collections.length + queries.length > 0;
        box.hidden = false;
        status.textContent = products.length ? products.length + (products.length === 1 ? ' product suggestion' : ' product suggestions') : 'No product suggestions';
      }
      async function search() {
        var term = input.value.trim();
        if (term.length < 2) { showIdle(); return; }
        if (term === last) return;
        last = term;
        if (request) request.abort();
        var mine = request = new AbortController();
        try {
          var q = new URLSearchParams({ q: term, 'resources[type]': 'product,collection,query', 'resources[limit]': '6', 'resources[limit_scope]': 'each', 'resources[options][unavailable_products]': 'last' });
          var res = await fetch(panel.dataset.url + '.json?' + q, { signal: mine.signal, headers: { Accept: 'application/json' } });
          if (!res.ok) throw new Error('suggest ' + res.status);
          var data = await res.json();
          if (mine === request && !panel.hidden) draw(term, data.resources.results);
        } catch (err) {
          // Suggestions are a bonus: on failure the bar still searches on Enter
          if (err.name !== 'AbortError' && mine === request) showIdle();
        }
      }
      icon.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        setOpen(panel.hidden, true);
      });
      panel.querySelector('[data-wp-search-close]').addEventListener('click', function () { setOpen(false, true); });
      input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(search, 220); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) setOpen(false, true); });
      document.addEventListener('click', function (e) { if (!panel.hidden && !panel.contains(e.target) && !icon.contains(e.target)) setOpen(false, false); });
      if (menu) menu.addEventListener('toggle', function () { if (menu.open && !panel.hidden) setOpen(false, false); });
    })();
    // Add to cart without leaving the page, then slide the cart drawer open.
    // "Buy it now" and pages without the drawer keep the normal form submit.
    document.querySelectorAll('.wp-card form, #wp-product-form').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        var items = cartDrawer && cartDrawer.querySelector('cart-items-component');
        if (!items) return;
        if (e.submitter && e.submitter.name === 'checkout') return;
        e.preventDefault();
        if (form.dataset.wpBusy) return;
        form.dataset.wpBusy = '1';
        addToCart(form, items.dataset.sectionId).then(function () { delete form.dataset.wpBusy; });
      });
    });
    function formMessage(form, text) {
      var el = form.querySelector('.wp-form-msg');
      if (!el) {
        el = document.createElement('p');
        el.className = 'wp-form-msg';
        el.setAttribute('role', 'alert');
        form.appendChild(el);
      }
      el.textContent = text;
      el.hidden = !text;
    }
    async function addToCart(form, sectionId) {
      var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
      var added = false;
      formMessage(form, '');
      try {
        var body = new FormData(form);
        body.append('sections', sectionId);
        var res = await fetch(root + 'cart/add.js', { method: 'POST', body: body, headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } });
        var data = await res.json();
        if (!res.ok || data.status) { formMessage(form, data.description || data.message || 'Sorry, we could not add that. Please try again.'); return; }
        added = true;
        var cart = await (await fetch(root + 'cart.js', { headers: { Accept: 'application/json' } })).json();
        var CartLinesUpdateEvent = (await import('@shopify/events')).CartLinesUpdateEvent;
        var deferred = CartLinesUpdateEvent.createPromise();
        form.dispatchEvent(new CartLinesUpdateEvent({
          action: 'add',
          context: 'product',
          lines: [{ merchandiseId: String(body.get('id')), quantity: Number(body.get('quantity')) || 1 }],
          promise: deferred.promise
        }));
        deferred.resolve({ cart: CartLinesUpdateEvent.createCartFromAjaxResponse(cart), detail: { items: cart.items, sections: data.sections, source: 'wp-theme', didError: false } });
        document.querySelectorAll('[data-wp-cart]').forEach(function (l) { l.setAttribute('aria-label', 'Cart (' + cart.item_count + ')'); });
        await openCart();
      } catch (err) {
        console.error('[wp-cart]', err);
        // The item may already be in the cart, so show the cart instead of adding it twice
        if (added) window.location.href = root + 'cart';
        else formMessage(form, 'Sorry, something went wrong. Please try again.');
      }
    }
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
    // Highlight the thumbnail that matches the main photo and bring it into view
    function markThumb(src) {
      var thumbs = Array.prototype.slice.call(root.querySelectorAll('[data-wp-thumb]'));
      var hit = thumbs.find(function (t) { return new URL(t.dataset.src, window.location.href).pathname === new URL(src, window.location.href).pathname; });
      if (!hit) return;
      thumbs.forEach(function (t) { t.setAttribute('aria-current', t === hit ? 'true' : 'false'); });
      var strip = hit.parentElement;
      strip.scrollTo({ left: hit.offsetLeft - strip.offsetLeft - (strip.clientWidth - hit.offsetWidth) / 2, behavior: 'smooth' });
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
      if (v.image) {
        var main = root.querySelector('[data-wp-main-img]');
        if (main) { main.src = v.image; main.removeAttribute('srcset'); }
        markThumb(v.image);
      }
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
