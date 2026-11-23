//! Port of `src/ui/CommandLine.tsx` — Bloomberg-style always-visible
//! command line with mnemonic dispatch, substring filtering and
//! arrow-key/Enter/Escape navigation.

use leptos::prelude::*;

// Resolution grammar is shared with the command palette — the definitions
// live in `crate::features::command_palette` (extracted verbatim from here).
use crate::features::command_palette::{
    normalize_symbol_arg, resolve_command_input, Command, ResolvedCommandInput,
};

const MAX_RESULTS: usize = 7;

/// `inputRef.current?.blur()` — resolved by id so no node ref is captured
/// by the reactive/event closures.
fn blur_input() {
    #[cfg(target_arch = "wasm32")]
    {
        use wasm_bindgen::JsCast;
        if let Some(el) = web_sys::window()
            .and_then(|w| w.document())
            .and_then(|d| d.get_element_by_id("qt-command-input"))
        {
            if let Some(html) = el.dyn_ref::<web_sys::HtmlElement>() {
                html.blur();
            }
        }
    }
}

#[component]
pub fn CommandLine(
    commands: Vec<Command>,
    on_open_palette: impl Fn(()) + Copy + Send + Sync + 'static,
    on_symbol_arg: impl Fn(String) + Copy + Send + Sync + 'static,
) -> impl IntoView {
    let commands = RwSignal::new(commands);
    let query = RwSignal::new(String::new());
    let highlight_index = RwSignal::new(0usize);
    let no_match = RwSignal::new(Option::<String>::None);

    let resolved = move || resolve_command_input(&query.get(), &commands.get());
    let items = move || match resolved() {
        ResolvedCommandInput::Exact(cmd) => vec![cmd],
        ResolvedCommandInput::Filtered(list) => list,
    };
    let safe_index = move || {
        let len = items().len();
        highlight_index.get().min(len.saturating_sub(1))
    };
    let show_results = move || !query.get().trim().is_empty() && !items().is_empty();

    let reset_input = move || {
        query.set(String::new());
        highlight_index.set(0);
        no_match.set(None);
        blur_input();
    };

    // "TOP <sym>" routes through on_symbol_arg when the mnemonic matches;
    // a bad TOP arg shows feedback and does not fall back to the action.
    let execute = move |command: Command| {
        let trimmed_query = query.get_untracked().trim().to_string();
        let lower = trimmed_query.to_lowercase();
        let is_top = command
            .mnemonic
            .is_some_and(|m| m.eq_ignore_ascii_case("TOP"));
        if is_top && lower.starts_with("top") {
            let arg = if lower.starts_with("top ") {
                &trimmed_query[4..]
            } else {
                &trimmed_query[3..]
            };
            match normalize_symbol_arg(arg) {
                Some(symbol) => {
                    on_symbol_arg(symbol);
                    reset_input();
                }
                None => {
                    no_match.set(Some(trimmed_query));
                }
            }
            return;
        }
        (command.action)();
        reset_input();
    };

    let on_keydown = move |ev: leptos::ev::KeyboardEvent| match ev.key().as_str() {
        "Enter" => {
            ev.prevent_default();
            match resolved() {
                ResolvedCommandInput::Exact(cmd) => execute(cmd),
                ResolvedCommandInput::Filtered(_) => {
                    let its = items();
                    if let Some(cmd) = its.get(safe_index()) {
                        if !query.get().trim().is_empty() {
                            execute(cmd.clone());
                        }
                    } else if !query.get().trim().is_empty() {
                        no_match.set(Some(query.get().trim().to_string()));
                    }
                }
            }
        }
        "ArrowDown" => {
            ev.prevent_default();
            let max = items().len().saturating_sub(1);
            highlight_index.update(|i| *i = (*i + 1).min(max));
        }
        "ArrowUp" => {
            ev.prevent_default();
            highlight_index.update(|i| *i = i.saturating_sub(1));
        }
        "Escape" => {
            ev.prevent_default();
            if !query.get().is_empty() {
                query.set(String::new());
                highlight_index.set(0);
                no_match.set(None);
            } else {
                blur_input();
            }
        }
        _ => {}
    };

    let results = move || {
        let is_filtered = matches!(resolved(), ResolvedCommandInput::Filtered(_));
        if !(show_results() && is_filtered) {
            return ().into_any();
        }
        let its = items();
        let safe = safe_index();
        view! {
            <ul id="command-line-results" class="command-line__results" role="listbox">
                {its.iter()
                    .take(MAX_RESULTS)
                    .enumerate()
                    .map(|(index, item)| {
                        let mnemonic = item.mnemonic;
                        let label = item.label.to_string();
                        let command = item.clone();
                        let active = index == safe;
                        view! {
                            <li role="option" aria-selected=active.to_string()>
                                <button
                                    type="button"
                                    class=if active { "command-line__option is-active" } else { "command-line__option" }
                                    on:mouseenter=move |_| highlight_index.set(index)
                                    on:click=move |_| execute(command.clone())
                                >
                                    {match mnemonic {
                                        Some(m) => view! { <kbd>{m}</kbd> }.into_any(),
                                        None => ().into_any(),
                                    }}
                                    <span>{label}</span>
                                    <svg
                                        width="12"
                                        height="12"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        aria-hidden="true"
                                    >
                                        <path d="m9 18 6-6-6-6"/>
                                    </svg>
                                </button>
                            </li>
                        }
                    })
                    .collect_view()}
            </ul>
        }
        .into_any()
    };

    let no_match_view = move || match no_match.get() {
        Some(msg) => view! {
            <div class="command-line__no-match" role="status">
                {format!("No match: {msg}")}
            </div>
        }
        .into_any(),
        None => ().into_any(),
    };

    view! {
        <div class="command-line" role="search">
            <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
            >
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <label class="visually-hidden" for="qt-command-input">"Command line"</label>
            <input
                id="qt-command-input"
                type="text"
                autocomplete="off"
                placeholder="Command… e.g. TOP BTC, LAB, NEWS"
                prop:value=move || query.get()
                on:input=move |ev| {
                    query.set(event_target_value(&ev));
                    highlight_index.set(0);
                    no_match.set(None);
                }
                on:keydown=on_keydown
                aria-invalid=move || no_match.get().is_some().to_string()
                aria-expanded=move || show_results().to_string()
                aria-controls=move || show_results().then_some("command-line-results")
                aria-autocomplete="list"
                {::leptos::attr::custom::custom_attribute("spellcheck", "false")}
            />
            {results}
            {no_match_view}
            <button
                type="button"
                class="command-line__palette-trigger"
                on:click=move |_| on_open_palette(())
                aria-label="Open command palette"
                title="Command palette (⌘K)"
            >
                <kbd aria-hidden="true">"⌘K"</kbd>
            </button>
        </div>
    }
}
