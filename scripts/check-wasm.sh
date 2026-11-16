#!/usr/bin/env bash
# Rust-side quality gate: formatting and clippy for the WASM crate.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOOLCHAIN_BIN="$(dirname "$(rustup which cargo)")"
export PATH="$TOOLCHAIN_BIN:$PATH"

cd "$REPO_ROOT"
cargo fmt --manifest-path rust/Cargo.toml -- --check
cargo clippy --manifest-path rust/Cargo.toml --target wasm32-unknown-unknown -- -D warnings
