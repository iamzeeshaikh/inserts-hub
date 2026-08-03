/**
 * Shared sizing for the hero slider so the component and the page-level
 * `<link rel="preload">` always describe the same rendition.
 *
 * A `slot="head"` inside HeroSlider would not reach BaseLayout — slots only
 * cross one component boundary — so the preload has to be emitted by the page.
 */
export const HERO_WIDTHS = [360, 480, 640, 800, 1120];
export const HERO_SIZES = '(min-width: 861px) 560px, 100vw';
