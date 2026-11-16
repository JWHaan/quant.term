#!/usr/bin/env bash
# Build the Leptos/WASM UI crate and regenerate wasm-bindgen glue.
#
# Same rustup-toolchain PATH fix as build-wasm.sh: a Homebrew rustc may
# shadow the toolchain that has the wasm32 std installed.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOOLCHAIN_BIN="$(dirname "$(rustup which cargo)")"
export PATH="$TOOLCHAIN_BIN:$PATH"

cd "$REPO_ROOT/ui"
cargo build --release --target wasm32-unknown-unknown
wasm-bindgen --target bundler \
  --out-dir "$REPO_ROOT/src/wasm/quant-ui" \
  target/wasm32-unknown-unknown/release/quant_ui.wasm
