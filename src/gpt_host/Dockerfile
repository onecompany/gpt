# Reproducible Builder for gpt_host Hypervisor Binary
#
# Achieves bitwise reproducibility through:
# 1. Toolchain Pinning: Specific Rust image tag.
# 2. Path Remapping: Stripping build-environment paths from DWARF debug symbols.
# 3. Deterministic Time: Clamping file timestamps via SOURCE_DATE_EPOCH.
# 4. Deterministic Output: Using a clean scratch export stage.

# Stage 1: Builder
FROM rust:1.93.0-slim-trixie@sha256:df6ca8f96d338697ccdbe3ccac57a85d2172e03a2429c2d243e74f3bb83ba2f5 AS builder

# Explicitly disable healthchecks for this build container
HEALTHCHECK NONE

# RUSTFLAGS: Remap absolute paths to ensure binaries built in different directories have identical hashes.
ENV SOURCE_DATE_EPOCH=0 \
    TZ=UTC \
    LC_ALL=C.UTF-8 \
    LANG=C.UTF-8 \
    RUSTFLAGS="--remap-path-prefix /build=/gpt_host --remap-path-prefix /usr/local/cargo/registry=/cargo"

# Create and use a non-root user for the build process
RUN groupadd -g 1000 builder && \
    useradd -u 1000 -g builder -m -s /bin/bash builder

# Prepare build directory with correct permissions for the builder user
WORKDIR /build
RUN chown builder:builder /build

# Switch to non-root user for all subsequent commands
USER builder

# 1. Copy Manifests and Source
# We copy the full workspace context to ensure workspace-level dependencies resolve correctly.
# We use --chown to ensure the 'builder' user can read/write these files.
COPY --chown=builder:builder Cargo.toml Cargo.lock ./
COPY --chown=builder:builder src ./src

# 2. Copy VM Artifacts
# These are required for the include_bytes! macro in the host binary to embed the VM.
COPY --chown=builder:builder artifacts/vm ./artifacts/vm

# 3. Build Release Binary (GNU/Linux)
# --mount=type=cache: Persists the Cargo registry between builds.
# We specify uid=1000/gid=1000 so the cache is writable by our 'builder' user.
RUN --mount=type=cache,target=/usr/local/cargo/registry,uid=1000,gid=1000 \
    cargo build \
    --package gpt_host \
    --target x86_64-unknown-linux-gnu \
    --release \
    --locked && \
    # Copy the binary out of the build output
    cp target/x86_64-unknown-linux-gnu/release/gpt_host /build/gpt_host_bin

# Stage 2: Exporter
# We use 'scratch' (empty image) to ensure the output contains ONLY the binary
# and absolutely no filesystem metadata or OS files from the builder.
FROM scratch AS export
COPY --from=builder /build/gpt_host_bin /gpt_host