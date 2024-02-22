/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_IS_MAINNET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
