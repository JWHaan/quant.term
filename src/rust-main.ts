// Entry point for the Leptos/Rust frontend (quant-ui crate).
// The generated wasm-bindgen bundle auto-initializes on import; the
// #[wasm_bindgen(start)] hook mounts the app to document.body.
import './wasm/quant-ui/quant_ui.js';

// Remove the static loader once the WASM app has mounted.
const loader = document.getElementById('initial-loader');
if (loader) loader.remove();
