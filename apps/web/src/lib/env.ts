/// <reference types="vite/client" />

// Augments the global ImportMetaEnv type so TypeScript knows our VITE_* vars.
// Biome doesn't understand declaration merging on global interfaces so we
// suppress the unused-variable warning on ImportMeta.
interface ImportMetaEnv {
	readonly VITE_API_URL: string;
	readonly VITE_VAPID_PUBLIC_KEY: string;
}

// biome-ignore lint/correctness/noUnusedVariables: global interface augmentation
interface ImportMeta {
	readonly env: ImportMetaEnv;
}
