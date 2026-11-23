//! Small reactive hooks — ports of `useConnectionLatency` and
//! `useKeyboardShortcuts` from `src/hooks/`.

use std::cell::{Cell, RefCell};
use std::rc::Rc;
use std::sync::Arc;

use leptos::prelude::*;
use wasm_bindgen::closure::Closure;
use wasm_bindgen::JsCast;
use web_sys::{window, Event, KeyboardEvent};

use crate::services::rest::IntervalGuard;
use crate::services::telemetry::live_market_events;
use crate::stores::now_ms;

// ─── useConnectionLatency ────────────────────────────────────────────────────

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ConnectionQuality {
    Excellent,
    Good,
    Fair,
    Poor,
}

impl ConnectionQuality {
    pub fn as_str(&self) -> &'static str {
        match self {
            ConnectionQuality::Excellent => "Excellent",
            ConnectionQuality::Good => "Good",
            ConnectionQuality::Fair => "Fair",
            ConnectionQuality::Poor => "Poor",
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct LatencyStats {
    pub latency: f64,
    pub quality: ConnectionQuality,
    pub updates_per_second: u32,
}

impl Default for LatencyStats {
    fn default() -> Self {
        Self {
            latency: 0.0,
            quality: ConnectionQuality::Poor,
            updates_per_second: 0,
        }
    }
}

/// Handle returned by `use_connection_latency`.
pub struct ConnectionLatency {
    pub stats: RwSignal<LatencyStats>,
}

const STALE_TELEMETRY_AFTER_MS: f64 = 3_000.0;
const SAMPLE_INTERVAL_MS: f64 = 1_000.0;

fn quality_for_latency(latency: f64) -> ConnectionQuality {
    if latency > 200.0 {
        ConnectionQuality::Poor
    } else if latency > 100.0 {
        ConnectionQuality::Fair
    } else if latency > 50.0 {
        ConnectionQuality::Good
    } else {
        ConnectionQuality::Excellent
    }
}

fn median(samples: &[f64]) -> f64 {
    if samples.is_empty() {
        return 0.0;
    }
    let mut sorted = samples.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    js_round(sorted[sorted.len() / 2])
}

/// `Math.round` — halves toward +infinity.
fn js_round(x: f64) -> f64 {
    (x + 0.5).floor()
}

/// Reports timing from actual exchange messages for the selected symbol.
/// Mirrors `useConnectionLatency`: subscribes to live market events and
/// samples once per second.
///
/// NOTE: the TS version accumulates events between ticks via a subscription;
/// here each tick scans the telemetry ring for events received within the
/// last second — equivalent for the 1s sampling window.
pub fn use_connection_latency(symbol: Memo<String>) -> ConnectionLatency {
    let stats = RwSignal::new(LatencyStats::default());
    let guard_slot = Rc::new(RefCell::new(None::<IntervalGuard>));
    // Last non-empty median — the TS `lastLatencyRef` persists across ticks.
    let last_latency = Rc::new(Cell::new(0.0f64));

    Effect::new(move |_| {
        let sym = symbol.get().to_uppercase();
        last_latency.set(0.0);
        let last_latency = Rc::clone(&last_latency);
        *guard_slot.borrow_mut() = Some(IntervalGuard::start(SAMPLE_INTERVAL_MS, move |_: Event| {
            let now = now_ms();
            let window_start = now - SAMPLE_INTERVAL_MS;

            let mut updates = 0u32;
            let mut samples: Vec<f64> = Vec::new();
            let mut last_event_at = 0.0f64;
            for event in live_market_events() {
                if event.source != "binance" || event.symbol != sym {
                    continue;
                }
                if event.received_at <= window_start {
                    continue;
                }
                updates += 1;
                last_event_at = last_event_at.max(event.received_at);
                if let Some(latency) = event.latency_ms {
                    samples.push(latency);
                }
            }

            let is_stale = last_event_at == 0.0 || now - last_event_at > STALE_TELEMETRY_AFTER_MS;
            // TS: only overwrite lastLatency when fresh samples exist.
            if !samples.is_empty() {
                last_latency.set(median(&samples));
            }
            let latency = if is_stale { 0.0 } else { last_latency.get() };
            let quality = if is_stale || latency == 0.0 {
                ConnectionQuality::Poor
            } else {
                quality_for_latency(latency)
            };
            stats.set(LatencyStats {
                latency,
                quality,
                updates_per_second: updates,
            });
        }));
    });

    ConnectionLatency { stats }
}

// ─── useKeyboardShortcuts ────────────────────────────────────────────────────

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ShortcutCategory {
    Navigation,
    Panels,
    Actions,
}

impl ShortcutCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            ShortcutCategory::Navigation => "navigation",
            ShortcutCategory::Panels => "panels",
            ShortcutCategory::Actions => "actions",
        }
    }
}

/// A registered keyboard shortcut. `action` runs on a matching keydown.
pub struct KeyboardShortcut {
    pub key: String,
    pub ctrl: bool,
    pub shift: bool,
    pub alt: bool,
    pub description: String,
    pub category: ShortcutCategory,
    pub action: Arc<dyn Fn() + Send + Sync>,
}

/// Handle returned by `use_keyboard_shortcuts`.
pub struct KeyboardShortcuts {
    pub show_help: RwSignal<bool>,
    pub shortcuts: Arc<Vec<KeyboardShortcut>>,
}

fn is_editable_target(e: &KeyboardEvent) -> bool {
    let Some(target) = e.target() else {
        return false;
    };
    let Some(el) = target.dyn_ref::<web_sys::Element>() else {
        return false;
    };
    let tag = el.tag_name().to_lowercase();
    if tag == "input" || tag == "textarea" {
        return true;
    }
    // Approximate `isContentEditable`: the nearest ancestor-or-self carrying
    // a contenteditable attribute decides ("false" opts out).
    if let Ok(Some(editable)) = el.closest("[contenteditable]") {
        if let Some(v) = editable.get_attribute("contenteditable") {
            return !v.eq_ignore_ascii_case("false");
        }
    }
    false
}

/// Global keyboard shortcuts — mirrors `useKeyboardShortcuts`:
/// `?` opens help, `Escape` closes it, editable fields swallow bare keys,
/// and modifier combos still fire while typing. `show_help` is owned by
/// the caller (the app store) so the modal, header button and palette
/// command share one state.
pub fn use_keyboard_shortcuts(
    shortcuts: Vec<KeyboardShortcut>,
    enabled: bool,
    show_help: RwSignal<bool>,
) -> KeyboardShortcuts {
    let shortcuts = Arc::new(shortcuts);

    if enabled {
        let shortcuts = Arc::clone(&shortcuts);
        let cb = Closure::<dyn FnMut(KeyboardEvent)>::new(move |e: KeyboardEvent| {
            let key = e.key().to_lowercase();

            if key == "escape" {
                show_help.set(false);
                return;
            }

            if !(e.ctrl_key() || e.meta_key() || e.alt_key()) && is_editable_target(&e) {
                return;
            }

            // `?` needs Shift on most layouts — don't exclude it here.
            if key == "?" && !e.ctrl_key() && !e.alt_key() && !e.meta_key() {
                e.prevent_default();
                show_help.set(true);
                return;
            }

            for shortcut in shortcuts.iter() {
                let ctrl_match = if shortcut.ctrl {
                    e.ctrl_key() || e.meta_key()
                } else {
                    !e.ctrl_key() && !e.meta_key()
                };
                let shift_match = if shortcut.shift {
                    e.shift_key()
                } else {
                    !e.shift_key()
                };
                let alt_match = if shortcut.alt {
                    e.alt_key()
                } else {
                    !e.alt_key()
                };
                let key_match = key == shortcut.key.to_lowercase();

                if ctrl_match && shift_match && alt_match && key_match {
                    e.prevent_default();
                    (shortcut.action)();
                    return;
                }
            }
        });
        if let Some(w) = window() {
            let _ = w.add_event_listener_with_callback("keydown", cb.as_ref().unchecked_ref());
        }
        // The listener lives for the app lifetime (same as the TS hook
        // mounted at the root); intentionally forgotten.
        cb.forget();
    }

    KeyboardShortcuts {
        show_help,
        shortcuts,
    }
}
