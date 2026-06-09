/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_AUTH_SESSION_STORAGE?: "local" | "session";
  readonly VITE_REQUIRE_AUTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
