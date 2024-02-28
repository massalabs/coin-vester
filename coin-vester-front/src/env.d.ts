/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_IS_MAINNET: string;
  readonly VITE_SC_ADDRESS: string;
  readonly VITE_OP_FEES: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
