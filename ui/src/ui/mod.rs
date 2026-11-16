pub mod chrome;
mod command_line;

use crate::features::command_palette::Command;
use crate::stores::{use_stores, WorkspaceMode};
use self::command_line::CommandLine;
use leptos::prelude::*;
use wasm_bindgen::JsCast;

#[component]
pub fn AppHeader(
    is_global_connected: impl Fn() -> bool + Copy + Send + Sync + 'static,
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

    view! {
        <header class="app-header">
            <div class="header-left">
                <span class="logo">"quant.term"</span>
                <nav class="workspace-switch" aria-label="Workspace">
                    <button
                        class=move || if workspace.get() == WorkspaceMode::Monitor { "active" } else { "" }
                        on:click=move |_| on_workspace_change(WorkspaceMode::Monitor)
                    >"Monitor"</button>
                    <button
                        class=move || if workspace.get() == WorkspaceMode::StrategyLab { "active" } else { "" }
                        on:click=move |_| on_workspace_change(WorkspaceMode::StrategyLab)
                    >"Strategy Lab"</button>
                </nav>
            </div>
            <div class="header-center">
                <CommandLine
                    commands=commands
                    on_open_palette=on_open_command_palette
                    on_symbol_arg=on_symbol_arg
                />
            </div>
            <div class="header-right">
                <span class=move || if is_global_connected() { "status-dot connected" } else { "status-dot disconnected" } />
                <button class="cmd-btn" on:click=move |_| on_open_command_palette(())
                    title="Command palette (Ctrl+K)">"⌘K"</button>
                <button class="cmd-btn" on:click=move |_| on_toggle_theme(())
                    aria-label=move || if theme() == "dark" { "Switch to light theme" } else { "Switch to dark theme" }
                    title=move || if theme() == "dark" { "Light theme" } else { "Dark theme" }
                >{move || if theme() == "dark" { "☀" } else { "☾" }}</button>
                <button class="cmd-btn" on:click=move |_| stores.show_help.set(true)>"?"</button>
                <button class="cmd-btn" on:click=move |ev| on_toggle_fullscreen(ev)>
                    {move || if is_fullscreen() { "⤡" } else { "⤢" }}
                </button>
            </div>
        </header>
    }
}

#[component]
pub fn AppFooter(
    is_global_connected: impl Fn() -> bool + Copy + Send + Sync + 'static,
    selected_symbol: impl Fn() -> String + Copy + Send + Sync + 'static,
) -> impl IntoView {
    view! {
        <footer class="app-footer">
            <span>{move || if is_global_connected() { "● Live" } else { "○ Offline" }}</span>
            <span>{move || format!("Symbol: {}", selected_symbol())}</span>
            <span>"Binance Spot + Futures"</span>
        </footer>
    }
}

#[component]
pub fn StrategyFooter() -> impl IntoView {
    view! {
        <footer class="app-footer strategy">
            <span>"Strategy Lab — backtest engine (Rust core)"</span>
        </footer>
    }
}

#[component]
pub fn MobileGate(children: Children) -> impl IntoView {
    let too_small = RwSignal::new(false);
    Effect::new(move |_| {
        #[cfg(target_arch = "wasm32")]
        {
            let cb = wasm_bindgen::closure::Closure::<dyn FnMut()>::new(move || {
                too_small.set(
                    web_sys::window()
                        .map(|w| {
                            let d = w.document().unwrap();
                            let de = d.document_element().unwrap();
                            de.client_width() < 768 || de.client_height() < 500
                        })
                        .unwrap_or(false),
                );
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
                        <h1>"quant.term"</h1>
                        <p>"This terminal requires a larger screen. Please use a desktop or tablet."</p>
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
    view! {
        <Show when=move || is_open()>
            <div class="modal-overlay" on:click=move |_| on_close(())>
                <div class="modal" on:click=|e| e.stop_propagation()>
                    <h2>"Keyboard Shortcuts"</h2>
                    <table>
                        <tr><td><kbd>"Ctrl/⌘ + K"</kbd></td><td>"Command palette"</td></tr>
                        <tr><td><kbd>"?"</kbd></td><td>"Toggle this help"</td></tr>
                        <tr><td><kbd>"Esc"</kbd></td><td>"Close dialogs"</td></tr>
                    </table>
                    <button on:click=move |_| on_close(())>"Close"</button>
                </div>
            </div>
        </Show>
    }
}

#[component]
pub fn CommandPalette(
    is_open: impl Fn() -> bool + Copy + Send + Sync + 'static,
    on_close: impl Fn(()) + Copy + Send + Sync + 'static,
) -> impl IntoView {
    let stores = use_stores();
    view! {
        <Show when=move || is_open()>
            <div class="modal-overlay" on:click=move |_| on_close(())>
                <div class="command-palette" on:click=|e| e.stop_propagation()>
                    <input
                        class="palette-input"
                        type="text"
                        placeholder="Type a command..."
                        autofocus
                        on:keydown=move |e| {
                            if e.key() == "Escape" { on_close(()); }
                        }
                    />
                    <ul class="palette-list">
                        <li on:click=move |_| { stores.workspace.set(WorkspaceMode::Monitor); on_close(()); }>
                            "Switch to Monitor"
                        </li>
                        <li on:click=move |_| { stores.workspace.set(WorkspaceMode::StrategyLab); on_close(()); }>
                            "Switch to Strategy Lab"
                        </li>
                    </ul>
                </div>
            </div>
        </Show>
    }
}
