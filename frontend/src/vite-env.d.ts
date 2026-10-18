/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Página da extensão da Lumi na loja (Chrome Web Store / Edge). Sem ela, o botão mostra a instalação local. */
  readonly VITE_LUMI_EXTENSION_URL?: string;
  /** .xpi assinado pela Mozilla: no Firefox, abrir esse link mostra o aviso nativo de instalação. */
  readonly VITE_LUMI_EXTENSION_XPI_URL?: string;
}
