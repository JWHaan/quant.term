// Entry point for the Leptos/Rust frontend (quant-ui crate).
// The generated wasm-bindgen bundle auto-initializes on import; the
// #[wasm_bindgen(start)] hook mounts the app to document.body.
import './styles/global.css';
import './wasm/quant-ui/quant_ui.js';

// Remove the static loader and any legacy root container once the WASM app has mounted.
document.getElementById('initial-loader')?.remove();
document.getElementById('root')?.remove();
