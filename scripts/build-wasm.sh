#!/usr/bin/env bash
# Build the Rust/WASM indicator core and regenerate wasm-bindgen glue.
#
# cargo resolves `rustc` through PATH; a Homebrew rustc may shadow the
# rustup toolchain that actually has the wasm32 std installed, so we put
# the rustup toolchain's bin directory first.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOOLCHAIN_BIN="$(dirname "$(rustup which cargo)")"
export PATH="$TOOLCHAIN_BIN:$PATH"

cd "$REPO_ROOT"
cargo build --release --target wasm32-unknown-unknown --manifest-path rust/Cargo.toml
wasm-bindgen --target bundler \
    --out-dir src/wasm/quant-core \
    rust/target/wasm32-unknown-unknown/release/quant_core.wasm
