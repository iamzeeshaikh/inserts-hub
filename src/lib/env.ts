/**
 * Production is the only environment allowed to emit `index,follow`.
 *
 * Vercel sets VERCEL_ENV to "production" | "preview" | "development". Anything
 * that is not an explicit production build is treated as a preview so an
 * accidental deploy can never be indexed.
 */
const vercelEnv = import.meta.env.VERCEL_ENV ?? process.env.VERCEL_ENV ?? '';
const isVercel = Boolean(import.meta.env.VERCEL ?? process.env.VERCEL);

export const isPreview: boolean = isVercel ? vercelEnv !== 'production' : false;
