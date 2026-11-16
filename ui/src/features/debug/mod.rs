//! MemoryProfiler — port of `src/features/debug/MemoryProfiler.tsx`.
//! Chrome-only `performance.memory` snapshot, polled once per second.
//! Renders nothing when the API is unavailable.

use leptos::prelude::*;
use wasm_bindgen::JsValue;

use crate::services::rest::IntervalGuard;

const POLL_INTERVAL_MS: f64 = 1_000.0;

#[derive(Clone, Copy)]
struct MemorySnapshot {
    used_mb: f64,
    limit_mb: f64,
    percent: f64,
}

fn read_memory() -> Option<MemorySnapshot> {
    // `window.performance` is Chrome-only and the web-sys `Performance`
    // feature is not enabled, so reach it through Reflect on the global.
    let global = js_sys::global();
    let performance = js_sys::Reflect::get(&global, &JsValue::from_str("performance")).ok()?;
    if performance.is_undefined() || performance.is_null() {
        return None;
    }
    let memory = js_sys::Reflect::get(&performance, &JsValue::from_str("memory")).ok()?;
    if memory.is_undefined() || memory.is_null() {
        return None;
    }
    let num = |key: &str| -> Option<f64> {
        let v = js_sys::Reflect::get(&memory, &JsValue::from_str(key)).ok()?;
        v.as_f64().filter(|n| n.is_finite())
    };
    let used = num("usedJSHeapSize")?;
    let limit = num("jsHeapSizeLimit")?;
    if limit <= 0.0 {
        return None;
    }
    Some(MemorySnapshot {
        used_mb: used / 1_048_576.0,
        limit_mb: limit / 1_048_576.0,
        percent: used / limit * 100.0,
    })
}

/// Fixed-position heap usage indicator for Chrome.
#[component]
pub fn MemoryProfiler() -> impl IntoView {
    let snapshot = RwSignal::new(read_memory());

    {
        let guard_slot = std::rc::Rc::new(std::cell::RefCell::new(None::<IntervalGuard>));
        Effect::new(move |_| {
            // If `performance.memory` is unsupported, never start polling.
            // get_untracked: the effect must not re-run on each poll update.
            if snapshot.get_untracked().is_some() {
                *guard_slot.borrow_mut() = Some(IntervalGuard::start(
                    POLL_INTERVAL_MS,
                    move |_: web_sys::Event| {
                        snapshot.set(read_memory());
                    },
                ));
            }
        });
    }

    view! {
        {move || {
            let Some(snap) = snapshot.get() else {
                return ().into_any();
            };
            // TS: isWarning = used / limit > 0.8; colors #ff6673 / #36c98f.
            let warn = snap.used_mb / snap.limit_mb > 0.8;
            let color = if warn { "#ff6673" } else { "#36c98f" };
            view! {
                <div style=format!(
                    "position:fixed;bottom:36px;right:10px;background:rgba(0,0,0,0.85);color:{color};padding:5px 10px;border-radius:var(--radius-sm);font-family:'JetBrains Mono',monospace;font-size:10px;z-index:9999;pointer-events:none;border:1px solid var(--border-strong)"
                )>
                    {format!(
                        "MEM: {:.1}MB / {:.1}MB ({:.1}%)",
                        snap.used_mb, snap.limit_mb, snap.percent
                    )}
                </div>
            }
            .into_any()
        }}
    }
}
