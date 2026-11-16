use crate::features::command_palette::{
    build_commands, CommandPalette, CommandsConfig,
};
use crate::features::{MonitorWorkspace, StrategyLab};
use crate::stores::{provide_stores, ConnectionStatus, WorkspaceMode};
use crate::ui::{
    AppFooter, AppHeader, KeyboardShortcutsModal, MobileGate, StrategyFooter,
};
use leptos::prelude::*;
use std::sync::Arc;
use wasm_bindgen::JsCast;

const WORKSPACE_STORAGE_KEY: &str = "quant-term-workspace";
const THEME_STORAGE_KEY: &str = "theme";

fn initial_workspace() -> WorkspaceMode {
    #[cfg(target_arch = "wasm32")]
    {
        web_sys::window()
            .and_then(|w| w.local_storage().ok().flatten())
            .and_then(|s| s.get_item(WORKSPACE_STORAGE_KEY).ok().flatten())
            .map(|v| {
                if v == "strategy-lab" {
                    WorkspaceMode::StrategyLab
                } else {
                    WorkspaceMode::Monitor
                }
            })
            .unwrap_or(WorkspaceMode::Monitor)
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        WorkspaceMode::Monitor
    }
}

/// `ThemeProvider` initial state — `localStorage.getItem('theme') || 'dark'`
/// (empty string is falsy in JS, so filter it out too).
fn initial_theme() -> String {
    #[cfg(target_arch = "wasm32")]
    {
        web_sys::window()
            .and_then(|w| w.local_storage().ok().flatten())
            .and_then(|s| s.get_item(THEME_STORAGE_KEY).ok().flatten())
            .filter(|v| !v.is_empty())
            .unwrap_or_else(|| "dark".to_string())
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        "dark".to_string()
    }
}

#[component]
pub fn App() -> impl IntoView {
    let stores = provide_stores();
    let workspace = stores.workspace;
    workspace.set(initial_workspace());

    // ThemeProvider equivalent: apply `data-theme` on <html> and persist.
    let theme = RwSignal::new(initial_theme());
    Effect::new(move |_| {
        let t = theme.get();
        #[cfg(target_arch = "wasm32")]
        {
            if let Some(el) = web_sys::window()
                .and_then(|w| w.document())
                .and_then(|d| d.document_element())
            {
                let _ = el.set_attribute("data-theme", &t);
            }
            if let Some(storage) = web_sys::window().and_then(|w| w.local_storage().ok().flatten()) {
                let _ = storage.set_item(THEME_STORAGE_KEY, &t);
            }
        }
    });
    let toggle_theme = move |_| {
        theme.update(|t| {
            *t = (if *t == "dark" { "light" } else { "dark" }).to_string();
        });
    };

    // Persist workspace selection.
    Effect::new(move |_| {
        let mode = workspace.get();
        #[cfg(target_arch = "wasm32")]
        if let Some(storage) = web_sys::window().and_then(|w| w.local_storage().ok().flatten()) {
            let _ = storage.set_item(WORKSPACE_STORAGE_KEY, mode.as_str());
        }
    });

    // Fullscreen tracking.
    Effect::new(move |_| {
        #[cfg(target_arch = "wasm32")]
        {
            let cb = wasm_bindgen::closure::Closure::<dyn FnMut()>::new(move || {
                let fs = web_sys::window()
                    .and_then(|w| w.document())
                    .map(|d| d.fullscreen_element().is_some())
                    .unwrap_or(false);
                stores.is_fullscreen.set(fs);
            });
            if let Some(w) = web_sys::window() {
                let _ = w.add_event_listener_with_callback(
                    "fullscreenchange",
                    cb.as_ref().unchecked_ref(),
                );
                cb.forget();
            }
        }
    });

    // Ctrl/Cmd+K command palette toggle.
    Effect::new(move |_| {
        #[cfg(target_arch = "wasm32")]
        {
            let cb = wasm_bindgen::closure::Closure::<dyn FnMut(web_sys::KeyboardEvent)>::new(
                move |e: web_sys::KeyboardEvent| {
                    if (e.meta_key() || e.ctrl_key()) && e.key() == "k" {
                        e.prevent_default();
                        stores.show_command_palette.update(|v| *v = !*v);
                    }
                },
            );
            if let Some(w) = web_sys::window() {
                let _ = w.add_event_listener_with_callback("keydown", cb.as_ref().unchecked_ref());
                cb.forget();
            }
        }
    });

    let is_global_connected = move || {
        let c = stores.connections.get();
        c.get("binance") == Some(&ConnectionStatus::Connected)
            && c.get("marketData") == Some(&ConnectionStatus::Connected)
    };

    let toggle_fullscreen = move |_| {
        #[cfg(target_arch = "wasm32")]
        {
            if let Some(doc) = web_sys::window().and_then(|w| w.document()) {
                if doc.fullscreen_element().is_some() {
                    let _ = doc.exit_fullscreen();
                } else if let Some(el) = doc.document_element() {
                    let _ = el.request_fullscreen();
                }
            }
        }
    };

    // openWorkspace(next, focusId?) — focuses the workspace root by default.
    let focus_workspace = move |mode: WorkspaceMode, focus_id: &'static str| {
        workspace.set(mode);
        #[cfg(target_arch = "wasm32")]
        {
            let cb = wasm_bindgen::closure::Closure::<dyn FnMut()>::new(move || {
                if let Some(el) = web_sys::window()
                    .and_then(|w| w.document())
                    .and_then(|d| d.get_element_by_id(focus_id))
                {
                    if let Some(html) = el.dyn_ref::<web_sys::HtmlElement>() {
                        html.scroll_into_view_with_bool(true);
                        let _ = html.focus();
                    }
                }
            });
            if let Some(w) = web_sys::window() {
                let _ = w.set_timeout_with_callback_and_timeout_and_arguments_0(
                    cb.as_ref().unchecked_ref(),
                    0,
                );
            }
            cb.forget();
        }
    };

    let open_workspace = move |mode: WorkspaceMode| {
        let focus_id = if mode == WorkspaceMode::Monitor {
            "terminal-workspace"
        } else {
            "strategy-lab-workspace"
        };
        focus_workspace(mode, focus_id);
    };

    // Command registry — shared by the header command line and the palette.
    let commands = build_commands(CommandsConfig {
        set_show_help: Arc::new(move |v: bool| stores.show_help.set(v)),
        set_symbol: Arc::new(move |sym: String| stores.set_symbol(&sym)),
        open_monitor: Arc::new(move || open_workspace(WorkspaceMode::Monitor)),
        open_strategy_lab: Arc::new(move || open_workspace(WorkspaceMode::StrategyLab)),
        scroll_to_market: Arc::new(move || {
            focus_workspace(WorkspaceMode::Monitor, "panel-market-watch")
        }),
        scroll_to_chart: Arc::new(move || {
            focus_workspace(WorkspaceMode::Monitor, "panel-chart")
        }),
        scroll_to_alpha: Arc::new(move || {
            focus_workspace(WorkspaceMode::Monitor, "panel-research")
        }),
        scroll_to_news: Arc::new(move || {
            focus_workspace(WorkspaceMode::Monitor, "panel-intelligence")
        }),
    });

    let skip_target = move || {
        if workspace.get() == WorkspaceMode::Monitor {
            "#terminal-workspace"
        } else {
            "#strategy-lab-workspace"
        }
    };
    let skip_label = move || {
        if workspace.get() == WorkspaceMode::Monitor {
            "Skip to market workspace"
        } else {
            "Skip to Strategy Lab"
        }
    };

    view! {
        <MobileGate>
            <div class="app-container">
                <a class="skip-link" href=move || skip_target()>{move || skip_label()}</a>
                <AppHeader
                    is_global_connected=is_global_connected
                    is_fullscreen=move || stores.is_fullscreen.get()
                    workspace=workspace
                    on_workspace_change=open_workspace
                    on_toggle_fullscreen=toggle_fullscreen
                    commands=commands.clone()
                    on_open_command_palette=move |_| stores.show_command_palette.set(true)
                    on_symbol_arg=move |sym| stores.selected_symbol.set(sym)
                    theme=move || theme.get()
                    on_toggle_theme=toggle_theme
                />
                {move || match workspace.get() {
                    WorkspaceMode::Monitor => view! { <MonitorWorkspace selected_symbol=move || stores.selected_symbol.get() is_global_connected=is_global_connected on_select_symbol=move |sym| stores.set_symbol(&sym) /> }.into_any(),
                    WorkspaceMode::StrategyLab => view! { <StrategyLab /> }.into_any(),
                }}
                {move || match workspace.get() {
                    WorkspaceMode::Monitor => view! {
                        <AppFooter
                            is_global_connected=is_global_connected
                            selected_symbol=move || stores.selected_symbol.get()
                        />
                    }.into_any(),
                    WorkspaceMode::StrategyLab => view! { <StrategyFooter /> }.into_any(),
                }}
                <KeyboardShortcutsModal is_open=move || stores.show_help.get() on_close=move |_| stores.show_help.set(false) />
                <CommandPalette
                    is_open=move || stores.show_command_palette.get()
                    on_close=move |_| stores.show_command_palette.set(false)
                    commands=commands
                />
            </div>
        </MobileGate>
    }
}
