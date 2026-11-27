# Walang Problema: Shopify theme

Context for Claude Code working in this repo. Read this before making any change.

## The store
- Brand: Walang Problema ("No Problem" in Tagalog), island lifestyle clothing from El Nido, Palawan, Philippines. Playful, cheeky, never corporate.
- Client contact: Laura (walangproblemabrand@gmail.com). Developer: VJ Yanson.
- Store: walang-problema-gikh10et.myshopify.com. Old site: walangproblema.com on WooCommerce (still live until cutover).
- Currency PHP, prices include tax, tax not collected. Timezone set to Asia/Singapore (UTC+8, Shopify has no Manila option).
- Shipping: J&T Standard Delivery, flat ₱190, 5 to 15 business days, Philippines only.
- Returns: 7 days, unworn and in original packaging. No returns on underwear, swimwear or accessories.
- Payments shown in footer: GCash, Credit card, Bank transfer (BPI). No cash on delivery.
- In-store POS: Square (to be synced with Shopify).

## Repo and sync
- This repo is connected to the store through the Shopify GitHub app. `main` = the live theme.
- Pushing to `main` updates the live store within about a minute. Edits made in the Shopify admin come back as commits "Update from Shopify", so always `git pull` before starting work.
- `config/settings_data.json` and `templates/*.json` change when someone uses the theme editor. Never overwrite them blindly; merge.
- For anything risky, work on a `dev` branch connected to an unpublished theme, then merge.
- A push can succeed on GitHub while Shopify silently rejects or trims a file. After every push, compare the MD5 of each changed file with the live theme's `checksumMd5` (Admin GraphQL `theme.files`). Known traps:
  - A schema setting of `"type": "header"` over 50 characters gets the whole section rejected, and any JSON template that uses it. `shopify theme check` does not catch this.
  - New settings and the JSON that uses them in one push: Shopify may save the JSON first and drop the settings it does not know yet. Prefer schema or Liquid defaults, or push the section first and the JSON in a second commit.
- The Shopify connector's `theme_screenshot` and `theme_bash` can show an old copy of the theme after a GitHub push. Don't use them to verify a push, and don't `theme_commit` or `theme_publish` from them.

## Theme structure
Base theme is Horizon. All brand work lives in custom `wp-` files; leave Horizon's own files alone unless needed.
- CSS: `assets/wp-theme.css` (all brand styles, mobile rules at 900px and 640px). New blocks are appended, so later rules win: check for an earlier rule with the same selector.
- JS: `assets/wp-theme.js` (variant picker, photo strip, search panel, cart drawer, add to cart, filter auto-submit).
- Header: `sections/wp-header.liquid` and `sections/header-group.json`. Mobile is menu, centered logo, search and cart (wishlist icon hidden; "Wishlist" is in the mobile menu instead). Also holds the search panel, the wishlist panel and the `#wp-white-bg` SVG filter.
- Wishlist: built in, no app. Hearts (`snippets/wp-wish-btn.liquid`) on product cards and the product page save handles to `localStorage` (`wp-wishlist`), so the list is per browser, not per account. The header heart opens the panel, which loads each product from `/products/{handle}.js`. Turning off `show_wishlist` in the header hides the hearts too.
- Footer: `sections/wp-footer.liquid` and `sections/footer-group.json`. The Shop column shows the collection links from `main-menu`. "Powered by vjyanson" links to vjyanson.com; the photo credit is off on purpose.
- Home, in order: `wp-hero` (variant `wide`), `wp-value-strip`, `wp-product-grid` (WP favourites, hand-picked `products`), `wp-categories` (layout `mosaic`), `wp-brand-story` (layout `collage`, three photos), `wp-community` (layout `mosaic`, nine photos), `wp-newsletter`. Older layouts (`home`, `cards`, `panel`, `full`, `split`, `polaroids`) are still options in the theme editor.
- `wp-newsletter` is the island sunset scene, used on home and collection pages. The bangka is `snippets/wp-boat.liquid`, shared with the 404.
- Other content sections: `wp-hero` variant `story` (Our Story), `wp-intro`, `wp-split`, `wp-values`, `wp-quote`, `wp-team`, `wp-cta`, `wp-page-banner`, `wp-page-content`.
- Product: `wp-product` (color swatch map, all photos in a swipeable strip, quick facts, accordions) and `wp-related`.
  - Below 900px the order is photo, title, price, color, size, buttons, quick facts, description, accordions. It is done with CSS `order` and `display: contents` on the form.
  - The returns quick fact only shows on clothing types, because of the returns policy.
  - `wp-related` ("Complete the island look") shows four products mixed by `product.type`. Complementary products set in Search & Discovery come first.
- Collection: `wp-collection` (filters collapse below 900px).
- Search: `wp-search` (results page) and `wp-search-form` (the bar). The header icon opens a full-width panel with suggestions (products, collections, search terms) from `/search/suggest.json`. The results page lists products only.
- 404: `wp-404` plus a `wp-product-grid`.
- Shared snippets: `wp-product-card`, `wp-icon`, `wp-palm`, `wp-boat`, `wp-social`, `wp-search-form`.
- Contact: `wp-contact` (form, reach box, Work with us, FAQ blocks).
- Blog: `wp-blog` (card grid, colored fallback tiles), `wp-article`.
- Page templates: `page.about.json` (Our Story), `page.contact.json`, `page.faq.json` (FAQs), `page.branded.json` (generic branded page, used by Size guide). Use `page.branded` for any new content page.

## Cart
- The cart icon and Add to cart open Horizon's own cart drawer (`theme-drawer#cart-drawer`) at every width. Fallback is the cart page, and failures log to the console as `[wp-cart]`.
- Horizon's desktop drawer normally squeezes the page. `wp-theme.css` makes it slide over a dimmed page instead.
- Adding shows a loading screen (`.wp-loader`, built in `wp-theme.js`) and a spinner on the button. It clears itself after 20 seconds at most.
- The header icon has a count badge (`data-wp-cart-count`), updated from Horizon's `cartLinesUpdate` event.
- The drawer and cart page are styled only in `wp-theme.css`, scoped to `#cart-drawer` and `#MainContent` to beat Horizon. `templates/cart.json` ends with a `wp-product-grid`.
- The drawer is not rendered on the cart page. "Buy it now" keeps the normal form submit.
- From 990px up, `.page-wrapper` is the scroll container, not the document.

## Brand rules
- Colors: sand #F4EBDD (page background), teal #0E4D4F (headings, buttons), lagoon #2A8C8C (banners), coral #C2522B, gold #F7C873, olive #4B5A3A, ink #1B2421 (footer, text), brown #8A3416 (handwritten accents), line #E2D5BF, field #CDBFA6.
- Fonts: Fredoka 700 for headings (`.wp-hd`), Sue Ellen Francisco for handwritten accents (`.wp-hand`), Inter for body.
- Shapes: rounded cards (radius 20 to 28px), pill buttons (`.wp-btn`, `.wp-btn--ghost`), wavy SVG divider under banners.
- Copy tone: warm, funny, island-casual. English. No em-dashes.
- Reuse existing tokens and classes; do not introduce new colors or fonts.

## Catalog conventions
- 82 products (51 active, 31 draft in Nov 2026), sizes XS to 3XL. Collections are tag-based smart collections. "Best sellers" = tag `best-seller`.
- 20 draft products are waiting on photos from Laura. Do not publish them.
- Filters (Size, Color) come from the Search & Discovery app.
- Every product needs a product type. `wp-product` and `wp-related` use: T-shirts, Kids T-shirts, Tops, Shorts, Pants, Underwear, Caps, Hats, Bags, Beach Essentials, Accessories.
- Link a photo to every color variant, or picking that color will not change the photo. 29 colors still have no photo (Nov 2026).
- Tag `white-bg` turns a cream photo background white with a CSS filter (used on Animal Patched Cap). It does not edit the photo and does not work on real backgrounds such as wood.
- Social: @walangproblemabrand on Instagram and Facebook.
- 129 URL redirects from the old WooCommerce paths are in place. Don't change page, product or collection handles without adding a redirect.

## Working rules
- Never ask for, write or commit passwords, API keys or tokens.
- Never change the domain or publish a different theme without VJ's explicit yes.
- Check every change at desktop (1440px) and mobile (390px) before pushing.
- Commit and push only after VJ says yes to that change.
- Keep commits small with clear messages.
- Use `{{ value | escape }}` for text settings and `newline_to_br` where multi-line text is allowed.

## Still open (as of Nov 2026)
- Payment providers, Square sync app, photos for 20 drafts, 4 product reviews, missing blog images: all waiting on Laura.
- 9 of 10 blog posts have no featured image.
- Waiting on Laura: photos for 29 colors, a clean group photo without the round logo for the hero, an OK on "The Horny" cap on the homepage, and consent for the people in the social photos.
- Not yet checked on the storefront by Claude (password protected): cart drawer with real products, search suggestions, newsletter sign-up.
- Delete the test copy of `sections/wp-search.liquid` from the unpublished "Development" theme (the live theme needs its own).
- Contact page shows hello@walangproblema.com; confirm the domain email works after the DNS switch or change to the Gmail address.
- Cutover: paid plan, freeze Woo, import past orders and new customers, DNS switch, test redirects, test order.
