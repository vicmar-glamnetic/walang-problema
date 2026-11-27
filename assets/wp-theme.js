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
    function frame() { return new Promise(function (done) { requestAnimationFrame(function () { done(); }); }); }
    function wait(ms) { return new Promise(function (done) { setTimeout(done, ms); }); }
    // Let the new cart contents finish drawing before the drawer moves, so the slide has the page to itself
    async function cartReady(wasEmpty) {
      var limit = performance.now() + 1500;
      while (wasEmpty && cartDrawer.querySelector('[data-cart-drawer-empty]') && performance.now() < limit) await frame();
      await frame();
      try {
        var running = (await import('@theme/utilities')).viewTransition.current;
        if (running) await Promise.race([running, wait(600)]);
      } catch (e) { /* no view transition to wait for */ }
      var photos = Array.prototype.slice.call(cartDrawer.querySelectorAll('.cart-items__media-image')).slice(0, 4);
      await Promise.race([Promise.all(photos.map(function (i) { return i.decode().catch(function () {}); })), wait(500)]);
      await frame();
    }
    document.querySelectorAll('[data-wp-cart]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        if (!cartDrawer || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        openCart().catch(function (err) { console.error('[wp-cart]', err); window.location.href = link.href; });
      });
    });
    // Cart count on the header icon, kept in step with every cart change
    function setCount(n) {
      document.querySelectorAll('[data-wp-cart]').forEach(function (l) { l.setAttribute('aria-label', n > 0 ? 'Cart (' + n + ')' : 'Cart'); });
      document.querySelectorAll('[data-wp-cart-count]').forEach(function (c) { c.textContent = n; c.hidden = n < 1; });
    }
    var events = import('@shopify/events');
    events.then(function (m) {
      document.addEventListener(m.StandardEvents.cartLinesUpdate, function (e) {
        if (e.promise) e.promise.then(function (r) { if (r && r.cart && typeof r.cart.totalQuantity === 'number') setCount(r.cart.totalQuantity); }).catch(function () {});
      });
    }).catch(function (err) { console.error('[wp-cart]', err); });
    // Loading screen while the cart is working
    var loader = document.createElement('div');
    loader.className = 'wp-s wp-loader';
    loader.inert = true;
    loader.innerHTML = '<div class="wp-loader__card"><span class="wp-loader__art" aria-hidden="true"><i class="wp-loader__sun"></i><i class="wp-loader__sea"></i></span><p class="wp-hand wp-loader__text" role="status"></p></div>';
    document.body.appendChild(loader);
    var loaderTimer;
    function loading(text) {
      clearTimeout(loaderTimer);
      loader.classList.toggle('is-on', !!text);
      loader.inert = !text;
      if (text) loader.querySelector('[role=status]').textContent = text;
      // Never trap the shopper: the screen always clears itself
      if (text) loaderTimer = setTimeout(function () { loading(''); }, 20000);
    }
    window.addEventListener('pageshow', function (e) { if (e.persisted) loading(''); });
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
    // Wishlist: hearts save products in this browser (localStorage), the header heart opens the list.
    // Hearts stay hidden if the header has the wishlist switched off.
    (function () {
      var panel = document.querySelector('[data-wp-wpanel]');
      if (!panel) return;
      var KEY = 'wp-wishlist';
      var list = panel.querySelector('[data-wp-wish-list]');
      var icon = document.querySelector('.wp-icons [data-wp-wish-open]');
      var menu = document.querySelector('.wp-mnav');
      var root = (window.Shopify && Shopify.routes && Shopify.routes.root) || '/';
      var opener = null;
      function read() {
        try { var v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v.filter(function (h) { return typeof h === 'string'; }) : []; }
        catch (e) { return []; }
      }
      var saved = read();
      function write() { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) { /* private mode: the list lasts for this page only */ } }
      function make(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; }
      function price(cents) {
        try { return new Intl.NumberFormat(document.documentElement.lang || 'en', { style: 'currency', currency: panel.dataset.currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(cents / 100); }
        catch (e) { return String(cents / 100); }
      }
      function sync() {
        document.querySelectorAll('[data-wp-wish]').forEach(function (b) {
          var on = saved.indexOf(b.dataset.wpWish) > -1;
          var name = (b.getAttribute('aria-label') || '').replace(/^(Save|Remove) /, '').replace(/ (to|from) wishlist$/, '');
          b.hidden = false;
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          b.setAttribute('aria-label', (on ? 'Remove ' : 'Save ') + name + (on ? ' from wishlist' : ' to wishlist'));
          b.title = on ? 'Saved to wishlist' : 'Save to wishlist';
        });
        document.querySelectorAll('[data-wp-wish-count]').forEach(function (c) { c.textContent = saved.length; c.hidden = saved.length === 0; });
        document.querySelectorAll('[data-wp-wish-total]').forEach(function (c) { c.textContent = saved.length ? '(' + saved.length + ')' : ''; });
        if (icon) icon.setAttribute('aria-label', 'Wishlist' + (saved.length ? ' (' + saved.length + ')' : ''));
      }
      function toggle(handle) {
        var i = saved.indexOf(handle);
        if (i > -1) saved.splice(i, 1); else saved.unshift(handle);
        write(); sync();
      }
      function empty() {
        list.textContent = '';
        list.appendChild(make('p', 'wp-hand wp-spanel__label', 'Nothing saved yet'));
        list.appendChild(make('p', 'wp-spanel__none', 'Tap the heart on any product to keep it here for later. Walang problema, no rush.'));
      }
      async function draw() {
        if (!saved.length) { empty(); return; }
        list.setAttribute('aria-busy', 'true');
        var handles = saved.slice();
        var found = await Promise.all(handles.map(function (h) {
          return fetch(root + 'products/' + encodeURIComponent(h) + '.js', { headers: { Accept: 'application/json' } })
            .then(function (r) { return r.ok ? r.json() : (r.status === 404 ? 'gone' : null); })
            .catch(function () { return null; });
        }));
        // Products that no longer exist drop off the list
        var gone = handles.filter(function (h, i) { return found[i] === 'gone'; });
        if (gone.length) { saved = saved.filter(function (h) { return gone.indexOf(h) < 0; }); write(); sync(); }
        list.removeAttribute('aria-busy');
        var items = found.filter(function (p) { return p && p !== 'gone'; });
        if (!items.length) { if (!saved.length) empty(); else { list.textContent = ''; list.appendChild(make('p', 'wp-spanel__none', 'Your wishlist could not load right now. Try again in a moment.')); } return; }
        list.textContent = '';
        list.appendChild(make('p', 'wp-hand wp-spanel__label', items.length === 1 ? '1 saved treasure' : items.length + ' saved treasures'));
        var grid = make('div', 'wp-spanel__grid');
        items.forEach(function (p) {
          var row = make('div', 'wp-wish__row');
          var a = make('a', 'wp-spanel__item'); a.href = p.url;
          var pic = make('span', 'wp-spanel__pic' + ((p.tags || []).indexOf('white-bg') > -1 ? ' wp-white-bg' : ''));
          if (p.featured_image) {
            var img = document.createElement('img');
            var src = p.featured_image.indexOf('//') === 0 ? 'https:' + p.featured_image : p.featured_image;
            img.src = src + (src.indexOf('?') > -1 ? '&' : '?') + 'width=400';
            img.alt = ''; img.loading = 'lazy';
            pic.appendChild(img);
          }
          a.appendChild(pic);
          a.appendChild(make('span', 'wp-spanel__name', p.title));
          a.appendChild(make('span', 'wp-spanel__price', p.available ? price(p.price) : 'Sold out'));
          var x = make('button', 'wp-wish__x');
          x.type = 'button';
          x.setAttribute('aria-label', 'Remove ' + p.title + ' from wishlist');
          x.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>';
          x.addEventListener('click', function () {
            toggle(p.handle);
            var next = row.nextElementSibling || row.previousElementSibling;
            row.remove();
            var left = grid.children.length;
            if (!left) { empty(); panel.querySelector('[data-wp-wish-close]').focus(); return; }
            list.querySelector('.wp-spanel__label').textContent = left === 1 ? '1 saved treasure' : left + ' saved treasures';
            next.querySelector('.wp-wish__x').focus();
          });
          row.appendChild(a); row.appendChild(x);
          grid.appendChild(row);
        });
        list.appendChild(grid);
      }
      function setOpen(open, from) {
        panel.hidden = !open;
        document.querySelectorAll('[data-wp-wish-open]').forEach(function (b) { b.setAttribute('aria-expanded', open ? 'true' : 'false'); });
        if (open) {
          opener = from || icon;
          if (menu) menu.removeAttribute('open');
          var search = document.querySelector('[data-wp-spanel]:not([hidden])');
          if (search) { var sc = search.querySelector('[data-wp-search-close]'); if (sc) sc.click(); }
          draw();
          panel.querySelector('[data-wp-wish-close]').focus();
        } else if (from !== false && opener && opener.offsetParent) opener.focus();
      }
      document.addEventListener('click', function (e) {
        var heart = e.target.closest('[data-wp-wish]');
        if (heart) { e.preventDefault(); toggle(heart.dataset.wpWish); return; }
        var open = e.target.closest('[data-wp-wish-open]');
        if (open) { e.preventDefault(); setOpen(panel.hidden, open); return; }
        if (e.target.closest('[data-wp-wish-close]')) { setOpen(false); return; }
        if (!panel.hidden && !panel.contains(e.target) && e.target.isConnected) setOpen(false, false);
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) setOpen(false); });
      if (menu) menu.addEventListener('toggle', function () { if (menu.open && !panel.hidden) setOpen(false, false); });
      // Keep other open tabs in step
      window.addEventListener('storage', function (e) { if (e.key === KEY) { saved = read(); sync(); if (!panel.hidden) draw(); } });
      sync();
    })();
    // Add to cart without leaving the page, then slide the cart drawer open.
    // "Buy it now" and pages without the drawer keep the normal form submit.
    document.querySelectorAll('.wp-card form, #wp-product-form').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        var items = cartDrawer && cartDrawer.querySelector('cart-items-component');
        if (!items) return;
        if (e.submitter && e.submitter.name === 'checkout') { loading('Paddling to checkout...'); return; }
        e.preventDefault();
        if (form.dataset.wpBusy) return;
        form.dataset.wpBusy = '1';
        var button = e.submitter || form.querySelector('[type=submit]');
        if (button) { button.classList.add('is-loading'); button.setAttribute('aria-busy', 'true'); }
        loading('Adding to your cart...');
        addToCart(form, items.dataset.sectionId).then(function (leaving) {
          delete form.dataset.wpBusy;
          if (button) { button.classList.remove('is-loading'); button.removeAttribute('aria-busy'); }
          if (!leaving) loading('');
        });
      });
    });
    // The checkout button in the cart shows it is working
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.cart__checkout-button');
      if (!b || b.disabled) return;
      b.classList.add('is-loading');
      setTimeout(function () { b.classList.remove('is-loading'); }, 8000);
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
      var stop = new AbortController();
      var slow = setTimeout(function () { stop.abort(); }, 15000);
      formMessage(form, '');
      try {
        var body = new FormData(form);
        body.append('sections', sectionId);
        var res = await fetch(root + 'cart/add.js', { method: 'POST', body: body, headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, signal: stop.signal });
        var data = await res.json();
        if (!res.ok || data.status) { formMessage(form, data.description || data.message || 'Sorry, we could not add that. Please try again.'); return; }
        added = true;
        var cart = await (await fetch(root + 'cart.js', { headers: { Accept: 'application/json' }, signal: stop.signal })).json();
        var CartLinesUpdateEvent = (await events).CartLinesUpdateEvent;
        var wasEmpty = !!cartDrawer.querySelector('[data-cart-drawer-empty]');
        var deferred = CartLinesUpdateEvent.createPromise();
        form.dispatchEvent(new CartLinesUpdateEvent({
          action: 'add',
          context: 'product',
          lines: [{ merchandiseId: String(body.get('id')), quantity: Number(body.get('quantity')) || 1 }],
          promise: deferred.promise
        }));
        deferred.resolve({ cart: CartLinesUpdateEvent.createCartFromAjaxResponse(cart), detail: { items: cart.items, sections: data.sections, source: 'wp-theme', didError: false } });
        setCount(cart.item_count);
        await cartReady(wasEmpty);
        loading('');
        await openCart();
      } catch (err) {
        console.error('[wp-cart]', err);
        // The item may already be in the cart, so show the cart instead of adding it twice
        if (added) { window.location.href = root + 'cart'; return true; }
        formMessage(form, err.name === 'AbortError' ? 'This is taking too long. Please check your cart before trying again.' : 'Sorry, something went wrong. Please try again.');
      } finally {
        clearTimeout(slow);
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
    // Work out which color each photo shows, so picking a color can hide the other photos.
    // In order: "#Color" in the alt text, the photo linked to a variant, then the color in the file name.
    var colorAt = groups.findIndex(function (g) { return g.classList.contains('wp-opt--color'); });
    var thumbList = Array.prototype.slice.call(root.querySelectorAll('[data-wp-thumb]'));
    function pathOf(src) { return new URL(src, window.location.href).pathname; }
    function squash(t) { return t.toLowerCase().replace(/[^a-z]/g, ''); }
    function colorsOf(thumb, names, linked) {
      var img = thumb.querySelector('img');
      var alt = ((img && img.alt) || '').toLowerCase();
      var tagged = names.filter(function (n) { return alt.indexOf('#' + n.toLowerCase()) > -1; });
      if (tagged.length) return tagged;
      var path = pathOf(thumb.dataset.src);
      if (linked[path]) return linked[path];
      var file = squash(path.split('/').pop().replace(/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/i, '').replace(/\.[a-z]+$/i, ''));
      var hits = names.map(function (n) { return { name: n, key: squash(n), at: file.indexOf(squash(n)) }; }).filter(function (h) { return h.key && h.at > -1; });
      // "army green" beats "green"; otherwise the first color in the name wins
      hits = hits.filter(function (h) { return !hits.some(function (o) { return o.key !== h.key && o.key.indexOf(h.key) > -1; }); });
      hits.sort(function (a, b) { return a.at - b.at; });
      return hits.length ? [hits[0].name] : [];
    }
    if (colorAt > -1 && thumbList.length > 1) {
      var names = [], linked = {};
      data.variants.forEach(function (v) {
        var n = v.options[colorAt];
        if (names.indexOf(n) < 0) names.push(n);
        if (v.image) { var k = pathOf(v.image); linked[k] = linked[k] || []; if (linked[k].indexOf(n) < 0) linked[k].push(n); }
      });
      if (names.length > 1) thumbList.forEach(function (t) { t.wpColors = colorsOf(t, names, linked); });
    }
    // All photos show until the shopper picks a color, then only that color's photos.
    // A color with no photos shows them all.
    function filterPhotos(color) {
      var own = thumbList.filter(function (t) { return t.wpColors && t.wpColors.indexOf(color) > -1; });
      thumbList.forEach(function (t) { t.hidden = colorPicked && own.length > 0 && own.indexOf(t) < 0; });
      return own;
    }
    function showPhoto(src) {
      var main = root.querySelector('[data-wp-main-img]');
      if (main) { main.src = src; main.removeAttribute('srcset'); }
      markThumb(src);
    }
    var shownColor = null, colorPicked = false;
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
      // Changing only the size keeps the photo the shopper is looking at
      var color = colorAt > -1 ? sel[colorAt] : '';
      var shown = color + (colorPicked ? '|picked' : '');
      if (colorAt < 0 || shown !== shownColor) {
        shownColor = shown;
        var own = colorAt > -1 ? filterPhotos(color) : [];
        if (v && v.image) showPhoto(v.image);
        else if (own.length) showPhoto(own[0].dataset.src);
      }
      if (!v) { addBtn.disabled = true; if (buyBtn) buyBtn.disabled = true; addBtn.textContent = data.unavailableLabel; return; }
      idInput.value = v.id;
      priceEl.innerHTML = money(v.price) + (v.compare_at_price > v.price ? '<s>' + money(v.compare_at_price) + '</s>' : '');
      addBtn.disabled = !v.available; if (buyBtn) buyBtn.disabled = !v.available;
      addBtn.textContent = v.available ? data.addLabel : data.soldOutLabel;
      var u = new URL(window.location.href); u.searchParams.set('variant', v.id); window.history.replaceState({}, '', u);
    }
    groups.forEach(function (g, i) {
      g.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () { sel[i] = b.dataset.value; if (i === colorAt) colorPicked = true; update(); });
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
