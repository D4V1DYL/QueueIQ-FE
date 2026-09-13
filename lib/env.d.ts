// Build-time settings read by lib/api.ts. Vite replaces these at build time.
interface ImportMetaEnv {
  readonly VITE_QUEUEIQ_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
