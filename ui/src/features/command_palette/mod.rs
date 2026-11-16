mod commands;

pub use commands::{build_commands, normalize_symbol_arg, Command, CommandsConfig};

use std::cell::RefCell;
use std::rc::Rc;

use leptos::html::Input;
use leptos::prelude::*;
use wasm_bindgen::closure::Closure;
use wasm_bindgen::JsCast;
use web_sys::{window, KeyboardEvent};

use crate::services::rest::TimeoutGuard;

/// Command palette overlay — port of `src/features/command-palette/CommandPalette.tsx`.
#[component]
pub fn CommandPalette(
    is_open: impl Fn() -> bool + Copy + Send + Sync + 'static,
    on_close: impl Fn(()) + Copy + Send + Sync + 'static,
    commands: Vec<Command>,
) -> impl IntoView {
    let commands = RwSignal::new(commands);
    let query = RwSignal::new(String::new());
    let selected_index = RwSignal::new(0usize);
    let input_ref: NodeRef<Input> = NodeRef::new();
    // Holds the focus timeout so it can be cleaned up on close/dispose.
    let focus_guard = Rc::new(RefCell::new(None::<TimeoutGuard>));
    let focus_guard_effect = Rc::clone(&focus_guard);

    // Filtered commands — label + description, case-insensitive substring.
    let filtered = Memo::new(move |_| {
        let q = query.get().to_lowercase();
        commands
            .get()
            .into_iter()
            .filter(|c| {
                q.is_empty()
                    || c.label.to_lowercase().contains(&q)
                    || c.description.to_lowercase().contains(&q)
            })
            .collect::<Vec<_>>()
    });

    // Reset selection whenever the query changes.
    Effect::new(move |_| {
        let _ = query.get();
        selected_index.set(0);
    });

    // Open: focus the input after a tick. Close: reset the query.
    Effect::new(move |_| {
        if is_open() {
            let guard_slot = Rc::clone(&focus_guard_effect);
            let input_ref = input_ref;
            *guard_slot.borrow_mut() = Some(TimeoutGuard::start(50.0, move |_: web_sys::Event| {
                if let Some(input) = input_ref.get() {
                    let _ = input.focus();
                }
            }));
        } else {
            *focus_guard_effect.borrow_mut() = None;
            query.set(String::new());
        }
    });

    let focus_guard_cleanup = crate::SendWrap(Rc::clone(&focus_guard));
    on_cleanup(move || {
        *focus_guard_cleanup.borrow_mut() = None;
    });

    // Keyboard navigation — window-level listener registered once.
    {
        let filtered = filtered;
        let selected_index = selected_index;
        let on_close = on_close;
        Effect::new(move |_| {
            let filtered = filtered;
            let selected_index = selected_index;
            let on_close = on_close;
            let cb = Closure::<dyn FnMut(KeyboardEvent)>::new(move |ev: KeyboardEvent| {
                if !is_open() {
                    return;
                }
                let items = untrack(|| filtered.get());
                let idx = selected_index.get_untracked();
                match ev.key().as_str() {
                    "ArrowDown" => {
                        ev.prevent_default();
                        if !items.is_empty() {
                            // TS: Math.min(prev + 1, len - 1) — clamps, no wrap.
                            selected_index
                                .set((idx + 1).min(items.len().saturating_sub(1)));
                        }
                    }
                    "ArrowUp" => {
                        ev.prevent_default();
                        // TS: Math.max(prev - 1, 0).
                        selected_index.set(idx.saturating_sub(1));
                    }
                    "Enter" => {
                        ev.prevent_default();
                        if let Some(cmd) = items.get(idx) {
                            (cmd.action)();
                            on_close(());
                        }
                    }
                    "Escape" => {
                        ev.prevent_default();
                        on_close(());
                    }
                    _ => {}
                }
            });
            let _ = window()
                .expect("window")
                .add_event_listener_with_callback("keydown", cb.as_ref().unchecked_ref());
            let cb_cleanup = crate::SendWrap(cb);
            on_cleanup(move || {
                let _ = window().expect("window").remove_event_listener_with_callback(
                    "keydown",
                    cb_cleanup.as_ref().unchecked_ref(),
                );
            });
        });
    }

    // Keep the selected row visible.
    Effect::new(move |_| {
        let idx = selected_index.get();
        let items = filtered.get();
        if let Some(cmd) = items.get(idx) {
            if let Some(doc) = window().and_then(|w| w.document()) {
                if let Some(el) = doc.get_element_by_id(&format!("cmd-option-{}", cmd.id)) {
                    el.scroll_into_view_with_bool(true);
                }
            }
        }
    });

    view! {
        {move || {
            if !is_open() {
                return ().into_any();
            }
            let items = filtered.get();
            view! {
                <div class="command-overlay" on:click=move |_| on_close(())>
                    <div class="command-dialog" on:click=|ev| ev.stop_propagation()>
                        <div class="command-search">
                            <span>"⌕"</span>
                            <input
                                node_ref=input_ref
                                type="text"
                                prop:value=move || query.get()
                                on:input=move |ev| query.set(event_target_value(&ev))
                                placeholder="Type a command or search..."
                            />
                            <div class="command-kbd">"ESC"</div>
                        </div>
                        <div class="command-list" role="listbox">
                            {if items.is_empty() {
                                let q = query.get();
                                view! {
                                    <div class="command-empty">
                                        {format!("No commands found matching \"{q}\"")}
                                    </div>
                                }
                                .into_any()
                            } else {
                                items
                                    .iter()
                                    .enumerate()
                                    .map(|(i, cmd)| {
                                        let id = cmd.id.to_string();
                                        let label = cmd.label.to_string();
                                        let description = cmd.description.to_string();
                                        let icon = cmd.icon.to_string();
                                        let action = cmd.action.clone();
                                        let is_selected = move || selected_index.get() == i;
                                        view! {
                                            <div
                                                id=format!("cmd-option-{}", id)
                                                class=move || {
                                                    if is_selected() {
                                                        "command-option is-selected"
                                                    } else {
                                                        "command-option"
                                                    }
                                                }
                                                on:click=move |_| {
                                                    action();
                                                    on_close(());
                                                }
                                                on:mouseenter=move |_| selected_index.set(i)
                                            >
                                                <div class="command-option__icon">{icon}</div>
                                                <div class="command-option__body">
                                                    <div class="command-option__label">{label}</div>
                                                    <div class="command-option__desc">{description}</div>
                                                </div>
                                                {move || {
                                                    is_selected().then(|| {
                                                        view! {
                                                            <span class="command-option__arrow">"→"</span>
                                                        }
                                                    })
                                                }}
                                            </div>
                                        }
                                    })
                                    .collect_view()
                                    .into_any()
                            }}
                        </div>
                        <div class="command-footer">
                            <div>"Command Palette"</div>
                            <div class="command-footer__keys">
                                <span><strong>"↑↓"</strong>" to navigate"</span>
                                <span><strong>"↵"</strong>" to select"</span>
                            </div>
                        </div>
                    </div>
                </div>
            }
            .into_any()
        }}
    }
}
