pub mod chrome;
mod command_line;

use crate::features::command_palette::Command;
use crate::stores::{use_stores, WorkspaceMode};
use self::command_line::CommandLine;
use leptos::html::Button;
use leptos::prelude::*;
use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::JsCast;

#[component]
pub fn AppHeader(
    feed_state: impl Fn() -> &'static str + Copy + Send + Sync + 'static,
    is_fullscreen: impl Fn() -> bool + Copy + Send + Sync + 'static,
    workspace: RwSignal<WorkspaceMode>,
    on_workspace_change: impl Fn(WorkspaceMode) + Copy + Send + Sync + 'static,
    on_toggle_fullscreen: impl Fn(leptos::ev::MouseEvent) + Send + Sync + 'static,
    commands: Vec<Command>,
    on_open_command_palette: impl Fn(()) + Copy + Send + Sync + 'static,
    on_symbol_arg: impl Fn(String) + Copy + Send + Sync + 'static,
    theme: impl Fn() -> String + Copy + Send + Sync + 'static,
    on_toggle_theme: impl Fn(()) + Copy + Send + Sync + 'static,
) -> impl IntoView {
    let stores = use_stores();
    let is_strategy_lab = move || workspace.get() == WorkspaceMode::StrategyLab;
    let connection_state = move || if is_strategy_lab() { "replay" } else { feed_state() };
    let status_label = move || {
        if is_strategy_lab() {
            "LAB"
        } else {
            match feed_state() {
                "connected" => "LIVE",
                "connecting" => "CONNECTING",
                _ => "OFFLINE",
            }
        }
    };
    let status_description = move || {
        if is_strategy_lab() {
            "Deterministic research workspace is active"
        } else {
            match feed_state() {
                "connected" => "Primary market data feeds are live",
                "connecting" => "Market data feeds are connecting or reconnecting",
                _ => "A primary market data feed is unavailable",
            }
        }
    };

    view! {
        <header class="app-header" aria-label="Application command bar">
            <div class="logo-section">
                <div class="brand-mark" aria-hidden="true">"QT"</div>
                <div class="logo-text">
                    <h1>"quant"<span>".term"</span></h1>
                    <span class="version">"Crypto market intelligence"</span>
                </div>
            </div>

            <nav class="workspace-nav" aria-label="Workspace">
                <button
                    type="button"
                    aria-current=move || if workspace.get() == WorkspaceMode::Monitor { "page" } else { "false" }
                    on:click=move |_| on_workspace_change(WorkspaceMode::Monitor)
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>
                    </svg>
                    "Monitor"
                </button>
                <button
                    type="button"
                    aria-current=move || if workspace.get() == WorkspaceMode::StrategyLab { "page" } else { "false" }
                    on:click=move |_| on_workspace_change(WorkspaceMode::StrategyLab)
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path d="M4.5 3h15"/><path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3"/><path d="M6 14h12"/>
                    </svg>
                    "Strategy Lab"
                </button>
            </nav>

            <div class="header-controls">
                <CommandLine
                    commands=commands
                    on_open_palette=on_open_command_palette
                    on_symbol_arg=on_symbol_arg
                />

                <div class="header-tool-group" aria-label="Display controls">
                    <button
                        type="button"
                        class="header-icon-button"
                        on:click=move |_| on_toggle_theme(())
                        aria-label=move || if theme() == "dark" { "Switch to light theme" } else { "Switch to dark theme" }
                        title=move || if theme() == "dark" { "Light theme" } else { "Dark theme" }
                    >
                        {move || if theme() == "dark" {
                            view! {
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
                                </svg>
                            }.into_any()
                        } else {
                            view! {
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
                                </svg>
                            }.into_any()
                        }}
                    </button>

                    <button
                        type="button"
                        class="header-icon-button"
                        on:click=move |ev| on_toggle_fullscreen(ev)
                        aria-label=move || if is_fullscreen() { "Exit fullscreen" } else { "Enter fullscreen" }
                        aria-pressed=move || is_fullscreen().to_string()
                        title=move || if is_fullscreen() { "Exit fullscreen" } else { "Fullscreen" }
                    >
                        {move || if is_fullscreen() {
                            view! {
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
                                </svg>
                            }.into_any()
                        } else {
                            view! {
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="M9 21H3v-6"/><path d="m3 21 7-7"/>
                                </svg>
                            }.into_any()
                        }}
                    </button>

                    <button
                        type="button"
                        class="header-icon-button"
                        on:click=move |_| stores.show_help.set(true)
                        aria-label="Keyboard shortcuts"
                        title="Keyboard shortcuts (?)"
                    >
                        <span style="font-family: var(--font-mono); font-weight: 700; font-size: 13px">"?"</span>
                    </button>

                    <a
                        class="header-icon-button"
                        href="https://github.com/JWHaan/quant.term"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="View quant.term source on GitHub (opens in a new tab)"
                        title="GitHub"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                        </svg>
                    </a>
                </div>

                <div
                    class="connection-status"
                    data-state=move || connection_state()
                    role="status"
                    aria-live="polite"
                    aria-label=move || status_description()
                    title=move || status_description()
                >
                    <span class="status-dot" aria-hidden="true" />
                    <span>{move || status_label()}</span>
                </div>

                <div class="user-profile" aria-label="Read-only research terminal">
                    <div class="avatar">"READ ONLY"</div>
                </div>
            </div>
        </header>
    }
}

#[component]
pub fn AppFooter(
    feed_state: impl Fn() -> &'static str + Copy + Send + Sync + 'static,
    selected_symbol: impl Fn() -> String + Copy + Send + Sync + 'static,
) -> impl IntoView {
    let utc_time = RwSignal::new(String::new());
    #[cfg(target_arch = "wasm32")]
    {
        let update_time = move || {
            let date = js_sys::Date::new_0();
            let hours = date.get_utc_hours();
            let mins = date.get_utc_minutes();
            let secs = date.get_utc_seconds();
            format!("{hours:02}:{mins:02}:{secs:02} UTC")
        };
        utc_time.set(update_time());
        let cb = wasm_bindgen::closure::Closure::<dyn FnMut()>::new(move || {
            utc_time.set(update_time());
        });
        if let Some(w) = web_sys::window() {
            let _ = w.set_interval_with_callback_and_timeout_and_arguments_0(
                cb.as_ref().unchecked_ref(),
                1000,
            );
        }
        cb.forget();
    }

    view! {
        <footer class="app-footer" aria-label="Market data status">
            <div
                class="status-item status-item--connection"
                data-state=move || feed_state()
                role="status"
                aria-live="polite"
            >
                <span class="status-dot" aria-hidden="true" />
                <span class="label">"FEED"</span>
                <span class="value">{move || match feed_state() {
                    "connected" => "CONNECTED",
                    "connecting" => "CONNECTING",
                    _ => "OFFLINE",
                }}</span>
            </div>

            <div class="status-item status-item--exchange">
                <span class="label">"VENUE"</span>
                <span class="value">"BINANCE SPOT + USDⓈ-M"</span>
            </div>

            <div class="status-item status-item--symbol">
                <span class="label">"INSTRUMENT"</span>
                <span class="value">{move || selected_symbol()}</span>
            </div>

            <div class="status-item status-item--rate">
                <span class="label">"TELEMETRY"</span>
                <span class="value">"STREAMING"</span>
            </div>

            <div class="status-item right" style="margin-left: auto;">
                <span class="label">"TIME"</span>
                <time class="value">{move || utc_time.get()}</time>
            </div>
        </footer>
    }
}

#[component]
pub fn StrategyFooter() -> impl IntoView {
    view! {
        <footer class="app-footer strategy" aria-label="Backtest engine status">
            <div
                class="status-item status-item--connection"
                data-state="connected"
                role="status"
                aria-live="polite"
            >
                <span class="status-dot" aria-hidden="true" />
                <span class="label">"ENGINE"</span>
                <span class="value">"DETERMINISTIC RUST CORE"</span>
            </div>
            <div class="status-item">
                <span class="label">"SCHEMA"</span>
                <span class="value" title="Replay result contract: backtest-v1">"V1"</span>
            </div>
            <div class="status-item status-item--symbol">
                <span class="label">"INSTRUMENT"</span>
                <span class="value">"BTCUSDT · 1M"</span>
            </div>
            <div class="status-item">
                <span class="label">"DATASET"</span>
                <span class="value">"SYNTHETIC FIXTURE"</span>
            </div>
            <div class="status-item right" style="margin-left: auto;">
                <span class="label">"MODE"</span>
                <span class="value">"RESEARCH"</span>
            </div>
        </footer>
    }
}

#[component]
pub fn MobileGate(children: Children) -> impl IntoView {
    let too_small = RwSignal::new(false);
    Effect::new(move |_| {
        #[cfg(target_arch = "wasm32")]
        {
            let check_size = move || {
                web_sys::window()
                    .and_then(|w| w.document())
                    .and_then(|d| d.document_element())
                    .map(|de| de.client_width() < 1024 || de.client_height() < 500)
                    .unwrap_or(false)
            };
            too_small.set(check_size());
            let cb = wasm_bindgen::closure::Closure::<dyn FnMut()>::new(move || {
                too_small.set(check_size());
            });
            if let Some(w) = web_sys::window() {
                let _ = w.add_event_listener_with_callback("resize", cb.as_ref().unchecked_ref());
            }
            cb.forget();
        }
    });

    view! {
        <>
            <Show when=move || too_small.get()>
                {move || view! {
                    <div class="mobile-gate">
                        <div style="font-size: 36px; margin-bottom: 12px">"🖥️"</div>
                        <h1>"quant.term requires a desktop screen"</h1>
                        <p>"This terminal is designed for multi-column resizable panels and dense financial data streams. Please open on a desktop display or tablet in landscape mode (≥ 1024px)."</p>
                    </div>
                }}
            </Show>
            <div class=move || if too_small.get() { "app-hidden" } else { "app-visible" }>
                {children()}
            </div>
        </>
    }
}

#[component]
pub fn KeyboardShortcutsModal(
    is_open: impl Fn() -> bool + Copy + Send + Sync + 'static,
    on_close: impl Fn(()) + Copy + Send + Sync + 'static,
) -> impl IntoView {
    let close_ref: NodeRef<Button> = NodeRef::new();
    // Element that held focus when the modal opened — restored on close.
    let prev_focus = Rc::new(RefCell::new(None::<web_sys::Element>));

    // Open: capture the invoking element, focus the close control once the
    // modal is in the DOM. Close: hand focus back to the invoking element.
    Effect::new(move |_| {
        if is_open() {
            *prev_focus.borrow_mut() = web_sys::window()
                .and_then(|w| w.document())
                .and_then(|d| d.active_element());
            if let Some(w) = web_sys::window() {
                let cb = wasm_bindgen::closure::Closure::<dyn FnMut()>::new(move || {
                    if let Some(btn) = close_ref.get() {
                        let _ = btn.focus();
                    }
                });
                let _ = w.set_timeout_with_callback_and_timeout_and_arguments_0(
                    cb.as_ref().unchecked_ref(),
                    0,
                );
                cb.forget();
            }
        } else if let Some(el) = prev_focus.borrow_mut().take() {
            if let Some(h) = el.dyn_ref::<web_sys::HtmlElement>() {
                let _ = h.focus();
            }
        }
    });

    // Keep Tab focus inside the open modal — Escape is handled globally by
    // `use_keyboard_shortcuts`.
    Effect::new(move |_| {
        let cb = wasm_bindgen::closure::Closure::<dyn FnMut(web_sys::KeyboardEvent)>::new(
            move |ev: web_sys::KeyboardEvent| {
                if !is_open() || ev.key() != "Tab" {
                    return;
                }
                if let Some(dialog) = web_sys::window()
                    .and_then(|w| w.document())
                    .and_then(|d| d.query_selector(".modal").ok().flatten())
                {
                    chrome::trap_focus(&ev, &dialog);
                }
            },
        );
        if let Some(w) = web_sys::window() {
            let _ = w.add_event_listener_with_callback("keydown", cb.as_ref().unchecked_ref());
        }
        let cb_cleanup = crate::SendWrap(cb);
        on_cleanup(move || {
            let _ = web_sys::window()
                .expect("window")
                .remove_event_listener_with_callback(
                    "keydown",
                    cb_cleanup.as_ref().unchecked_ref(),
                );
        });
    });

    view! {
        <Show when=move || is_open()>
            <div class="modal-overlay" on:click=move |_| on_close(())>
                <div class="modal" role="dialog" aria-modal="true" aria-labelledby="shortcuts-modal-title" on:click=|e| e.stop_propagation()>
                    <h2 id="shortcuts-modal-title">
                        <span>"Keyboard Shortcuts"</span>
                        <span style="font-size: 11px; font-weight: normal; color: var(--text-muted)">"ESC to close"</span>
                    </h2>
                    <table>
                        <tbody>
                            <tr><td><kbd>"Ctrl/⌘ + K"</kbd></td><td>"Open command palette"</td></tr>
                            <tr><td><kbd>"?"</kbd></td><td>"Toggle keyboard shortcuts help"</td></tr>
                            <tr><td><kbd>"Esc"</kbd></td><td>"Close open dialogs and menus"</td></tr>
                            <tr><td><kbd>"Arrow keys"</kbd></td><td>"Navigate tabs and command items"</td></tr>
                        </tbody>
                    </table>
                    <h3>"Command line"</h3>
                    <table>
                        <tbody>
                            <tr><td><kbd>"TOP <SYM>"</kbd></td><td>"Switch instrument (e.g. TOP ETH)"</td></tr>
                            <tr><td><kbd>"MON"</kbd></td><td>"Open Market Monitor"</td></tr>
                            <tr><td><kbd>"LAB"</kbd></td><td>"Open Strategy Lab"</td></tr>
                            <tr><td><kbd>"MW"</kbd></td><td>"Focus Market Watch"</td></tr>
                            <tr><td><kbd>"CHART"</kbd></td><td>"Focus Chart"</td></tr>
                            <tr><td><kbd>"ALPHA"</kbd></td><td>"Focus Research Monitor"</td></tr>
                            <tr><td><kbd>"NEWS"</kbd></td><td>"Focus Market Intelligence"</td></tr>
                            <tr><td><kbd>"KEYS"</kbd></td><td>"Show Keyboard Shortcuts"</td></tr>
                        </tbody>
                    </table>
                    <button node_ref=close_ref type="button" class="modal-close-btn" on:click=move |_| on_close(())>"Close (Esc)"</button>
                </div>
            </div>
        </Show>
    }
}
