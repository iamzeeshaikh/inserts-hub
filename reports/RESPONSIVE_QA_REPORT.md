# Responsive QA report

Target: `http://localhost:4399`

Checked **11 pages × 5 breakpoints = 55 combinations**.
**55 clean**, **0 with findings**.

Breakpoints: 320px, 375px, 768px, 1024px, 1440px.

## Checks performed at every breakpoint

- Document horizontal overflow (`scrollWidth` vs `clientWidth`)
- Any element rendering outside the viewport, ignoring deliberate scroll containers
- Touch-target size for links, buttons, form controls and accordion summaries
- Exactly one `<h1>` per page
- Explicit `width`/`height` on every image (layout-shift prevention)
- JavaScript console and page errors

## Results

| Page | Route | Width | HTTP | Result |
| --- | --- | ---: | ---: | --- |
| home | `/` | 320 | 200 | clean |
| home | `/` | 375 | 200 | clean |
| home | `/` | 768 | 200 | clean |
| home | `/` | 1024 | 200 | clean |
| home | `/` | 1440 | 200 | clean |
| products | `/products/` | 320 | 200 | clean |
| products | `/products/` | 375 | 200 | clean |
| products | `/products/` | 768 | 200 | clean |
| products | `/products/` | 1024 | 200 | clean |
| products | `/products/` | 1440 | 200 | clean |
| products-page-2 | `/products/page/2/` | 320 | 200 | clean |
| products-page-2 | `/products/page/2/` | 375 | 200 | clean |
| products-page-2 | `/products/page/2/` | 768 | 200 | clean |
| products-page-2 | `/products/page/2/` | 1024 | 200 | clean |
| products-page-2 | `/products/page/2/` | 1440 | 200 | clean |
| product-standard | `/product/mini-cupcake-inserts/` | 320 | 200 | clean |
| product-standard | `/product/mini-cupcake-inserts/` | 375 | 200 | clean |
| product-standard | `/product/mini-cupcake-inserts/` | 768 | 200 | clean |
| product-standard | `/product/mini-cupcake-inserts/` | 1024 | 200 | clean |
| product-standard | `/product/mini-cupcake-inserts/` | 1440 | 200 | clean |
| product-long | `/product/white-cardboard-inserts/` | 320 | 200 | clean |
| product-long | `/product/white-cardboard-inserts/` | 375 | 200 | clean |
| product-long | `/product/white-cardboard-inserts/` | 768 | 200 | clean |
| product-long | `/product/white-cardboard-inserts/` | 1024 | 200 | clean |
| product-long | `/product/white-cardboard-inserts/` | 1440 | 200 | clean |
| category | `/product-category/cardboard-inserts/` | 320 | 200 | clean |
| category | `/product-category/cardboard-inserts/` | 375 | 200 | clean |
| category | `/product-category/cardboard-inserts/` | 768 | 200 | clean |
| category | `/product-category/cardboard-inserts/` | 1024 | 200 | clean |
| category | `/product-category/cardboard-inserts/` | 1440 | 200 | clean |
| about | `/about-us/` | 320 | 200 | clean |
| about | `/about-us/` | 375 | 200 | clean |
| about | `/about-us/` | 768 | 200 | clean |
| about | `/about-us/` | 1024 | 200 | clean |
| about | `/about-us/` | 1440 | 200 | clean |
| contact | `/contact-us/` | 320 | 200 | clean |
| contact | `/contact-us/` | 375 | 200 | clean |
| contact | `/contact-us/` | 768 | 200 | clean |
| contact | `/contact-us/` | 1024 | 200 | clean |
| contact | `/contact-us/` | 1440 | 200 | clean |
| refund | `/refund_returns/` | 320 | 200 | clean |
| refund | `/refund_returns/` | 375 | 200 | clean |
| refund | `/refund_returns/` | 768 | 200 | clean |
| refund | `/refund_returns/` | 1024 | 200 | clean |
| refund | `/refund_returns/` | 1440 | 200 | clean |
| terms | `/terms-conditions/` | 320 | 200 | clean |
| terms | `/terms-conditions/` | 375 | 200 | clean |
| terms | `/terms-conditions/` | 768 | 200 | clean |
| terms | `/terms-conditions/` | 1024 | 200 | clean |
| terms | `/terms-conditions/` | 1440 | 200 | clean |
| not-found | `/this-page-does-not-exist/` | 320 | 404 | clean |
| not-found | `/this-page-does-not-exist/` | 375 | 404 | clean |
| not-found | `/this-page-does-not-exist/` | 768 | 404 | clean |
| not-found | `/this-page-does-not-exist/` | 1024 | 404 | clean |
| not-found | `/this-page-does-not-exist/` | 1440 | 404 | clean |

## Findings

No layout, overflow, touch-target, heading or console problems were found at any breakpoint.

## Screenshots

Reference screenshots are in `reports/screenshots/` — mobile (375px, viewport) and desktop (1440px, full page) for each page.
