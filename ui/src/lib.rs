#![allow(unused_crate_dependencies)]
use wasm_bindgen::prelude::*;

pub mod app;
pub mod data;
pub mod features;
pub mod services;
pub mod stores;
mod ui;

pub use app::App;

/// WASM runs single-threaded; this lets non-`Send` browser handles (`Rc`,
/// `Closure`, timer guards) satisfy Leptos's `Send + Sync` cleanup bounds.
/// The wrapped value never actually crosses a thread boundary.
pub struct SendWrap<T>(pub T);
unsafe impl<T> Send for SendWrap<T> {}
unsafe impl<T> Sync for SendWrap<T> {}

impl<T> std::ops::Deref for SendWrap<T> {
    type Target = T;
    fn deref(&self) -> &T {
        &self.0
    }
}
impl<T> std::ops::DerefMut for SendWrap<T> {
    fn deref_mut(&mut self) -> &mut T {
        &mut self.0
    }
}

#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
    leptos::mount::mount_to_body(App);
}
