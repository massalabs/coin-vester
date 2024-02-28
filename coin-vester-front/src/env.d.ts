/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_IS_MAINNET: string;
  readonly VITE_SC_ADDRESS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
