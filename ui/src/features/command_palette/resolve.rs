//! Shared command-input resolution — the single grammar used by both the
//! header command line (`CommandLine`) and the ⌘K palette (`CommandPalette`).
//! `resolve_command_input` was extracted verbatim from
//! `crate::ui::command_line` so both surfaces resolve identically.

use crate::features::command_palette::{
    analyze_command_for, normalize_symbol_arg, Command,
};

/// Mirrors `ResolvedCommandInput` in the TSX.
#[derive(Clone)]
pub enum ResolvedCommandInput {
    Exact(Command),
    Filtered(Vec<Command>),
}

/// `resolveCommandInput` — exact mnemonics win ("top <arg>" routes to the
/// first TOP command); anything else falls back to a case-insensitive
/// substring filter over mnemonic/label/description in registry order.
pub fn resolve_command_input(query: &str, commands: &[Command]) -> ResolvedCommandInput {
    let trimmed = query.trim();
    let lower = trimmed.to_lowercase();

    if lower.starts_with("top ") || lower == "top" {
        if let Some(top) = commands
            .iter()
            .find(|c| c.mnemonic.is_some_and(|m| m.eq_ignore_ascii_case("TOP")))
        {
            return ResolvedCommandInput::Exact(top.clone());
        }
    }

    if let Some(exact) = commands
        .iter()
        .find(|c| c.mnemonic.is_some_and(|m| m.to_lowercase() == lower))
    {
        return ResolvedCommandInput::Exact(exact.clone());
    }

    let items = commands
        .iter()
        .filter(|c| {
            c.label.to_lowercase().contains(&lower)
                || c.description.to_lowercase().contains(&lower)
                || c
                    .mnemonic
                    .is_some_and(|m| m.to_lowercase().contains(&lower))
        })
        .cloned()
        .collect();
    ResolvedCommandInput::Filtered(items)
}

/// Palette-side resolution: the ordered result list shown under the query.
/// Shares the command-line grammar and adds dynamic symbol results:
///
/// * `"top <arg>"` routes through the same TOP mnemonic path as the header —
///   the arg is normalized via [`normalize_symbol_arg`] and resolved to the
///   matching `Analyze` command, so Enter dispatches the identical
///   `set_symbol` action. An arg that doesn't normalize to a known instrument
///   yields an empty list (the palette analogue of the header's "Bad symbol"
///   feedback) rather than silently executing the wrong instrument.
/// * Any other query first resolves through [`resolve_command_input`]; when
///   the raw query itself normalizes to a symbol with an `Analyze` command
///   (e.g. typing `bnb`), that command is hoisted to the top so Enter selects
///   it even if it isn't the first substring match.
pub fn resolve_palette_query(query: &str, commands: &[Command]) -> Vec<Command> {
    let trimmed = query.trim();
    let lower = trimmed.to_lowercase();

    // TOP route — same `top <arg>` split as `resolve_command_input`, but the
    // palette resolves the arg all the way to its Analyze command instead of
    // returning the generic TOP verb (the header re-parses the arg in
    // `execute`; here the command itself carries the dispatch).
    if lower.starts_with("top ") || lower == "top" {
        let arg = if lower.starts_with("top ") {
            &trimmed[4..]
        } else {
            ""
        };
        return normalize_symbol_arg(arg)
            .and_then(|sym| analyze_command_for(&sym, commands))
            .map(|cmd| vec![cmd.clone()])
            .unwrap_or_default();
    }

    let mut items = match resolve_command_input(trimmed, commands) {
        ResolvedCommandInput::Exact(cmd) => vec![cmd],
        ResolvedCommandInput::Filtered(list) => list,
    };

    // Dynamic symbol result — hoist the matching Analyze command (or surface
    // it when the substring filter missed it entirely, e.g. "/sol").
    if !trimmed.is_empty() {
        if let Some(cmd) =
            normalize_symbol_arg(trimmed).and_then(|sym| analyze_command_for(&sym, commands))
        {
            items.retain(|c| c.id != cmd.id);
            items.insert(0, cmd.clone());
        }
    }

    items
}
