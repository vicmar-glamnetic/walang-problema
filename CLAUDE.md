# Walang Problema: Shopify theme

Context for Claude Code working in this repo. Read this before making any change.

## The store
- Brand: Walang Problema ("No Problem" in Tagalog), island lifestyle clothing from El Nido, Palawan, Philippines. Playful, cheeky, never corporate.
- Client contact: Laura (walangproblemabrand@gmail.com). Developer: VJ Yanson.
- Store: walang-problema-gikh10et.myshopify.com. Old site: walangproblema.com on WooCommerce (still live until cutover).
- Currency PHP, prices include tax, tax not collected. Timezone set to Asia/Singapore (UTC+8, Shopify has no Manila option).
- Shipping: J&T Standard Delivery, flat ₱190, 5 to 15 business days, Philippines only.
- Returns: 7 days, unworn and in original packaging. No returns on underwear, swimwear or accessories.
- Payments shown in footer: GCash, Credit card, Bank transfer (BPI), Cash on delivery.
- In-store POS: Square (to be synced with Shopify).

## Repo and sync
- This repo is connected to the store through the Shopify GitHub app. `main` = the live theme.
- Pushing to `main` updates the live store immediately. Edits made in the Shopify admin come back as commits "Update from Shopify", so always `git pull` before starting work.
- `config/settings_data.json` and `templates/*.json` change when someone uses the theme editor. Never overwrite them blindly; merge.
- For anything risky, work on a `dev` branch connected to an unpublished theme, then merge.

## Theme structure
Base theme is Horizon. All brand work lives in custom `wp-` files; leave Horizon's own files alone unless needed.
- CSS: `assets/wp-theme.css` (all brand styles, mobile rules at 900px and 640px).
- Header and footer: `sections/wp-header.liquid` (includes the mobile hamburger `wp-mnav`), `sections/header-group.json`, `sections/footer-group.json`.
- Home and content sections: `wp-hero` (variants home/story), `wp-intro`, `wp-split`, `wp-values`, `wp-quote`, `wp-team`, `wp-cta`, `wp-page-banner`, `wp-page-content`.
- Shop: `wp-product` (has the color swatch map), `wp-collection` (filters collapse below 900px).
- Contact: `wp-contact` (form, reach box, Work with us, FAQ blocks).
- Blog: `wp-blog` (card grid, colored fallback tiles), `wp-article`.
- Page templates: `page.about.json` (Our Story), `page.contact.json`, `page.faq.json` (FAQs), `page.branded.json` (generic branded page, used by Size guide). Use `page.branded` for any new content page.

## Brand rules
- Colors: sand #F4EBDD (page background), teal #0E4D4F (headings, buttons), lagoon #2A8C8C (banners), coral #C2522B, gold #F7C873, olive #4B5A3A, ink #1B2421 (footer, text), brown #8A3416 (handwritten accents), line #E2D5BF, field #CDBFA6.
- Fonts: Fredoka 700 for headings (`.wp-hd`), Sue Ellen Francisco for handwritten accents (`.wp-hand`), Inter for body.
- Shapes: rounded cards (radius 20 to 28px), pill buttons (`.wp-btn`, `.wp-btn--ghost`), wavy SVG divider under banners.
- Copy tone: warm, funny, island-casual. English. No em-dashes.
- Reuse existing tokens and classes; do not introduce new colors or fonts.

## Catalog conventions
- 82 products, sizes XS to 3XL. Collections are tag-based smart collections. "Best sellers" = tag `best-seller`.
- 20 draft products are waiting on photos from Laura. Do not publish them.
- Filters (Size, Color) come from the Search & Discovery app.
- 129 URL redirects from the old WooCommerce paths are in place. Don't change page, product or collection handles without adding a redirect.

## Working rules
- Never ask for, write or commit passwords, API keys or tokens.
- Never change the domain or publish a different theme without VJ's explicit yes.
- Check every change at desktop (1440px) and mobile (390px) before pushing.
- Keep commits small with clear messages.
- Use `{{ value | escape }}` for text settings and `newline_to_br` where multi-line text is allowed.

## Still open (as of Nov 2026)
- Payment providers, Square sync app, photos for 20 drafts, 4 product reviews, missing blog images: all waiting on Laura.
- 9 of 10 blog posts have no featured image.
- Contact page shows hello@walangproblema.com; confirm the domain email works after the DNS switch or change to the Gmail address.
- Wishlist app: not installed yet, waiting on VJ.
- Cutover: paid plan, freeze Woo, import past orders and new customers, DNS switch, test redirects, test order.
