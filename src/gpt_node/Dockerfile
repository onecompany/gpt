# src/gpt_node/Dockerfile

# Reproducible Builder for gpt_node (Musl/Alpine)
#
# Achieves bitwise reproducibility through:
# 1. Toolchain Pinning: Specific Rust Alpine image.
# 2. Path Remapping: Stripping build-environment paths.
# 3. Deterministic Time: Clamping file timestamps via SOURCE_DATE_EPOCH.

# Stage 1: Builder
FROM rust:1.93.0-alpine3.23@sha256:69d7b9d9aeaf108a1419d9a7fcf7860dcc043e9dbd1ab7ce88e44228774d99e9 AS builder

# Explicitly disable healthchecks for this build container
HEALTHCHECK NONE

# RUSTFLAGS: Remap absolute paths to ensure binaries built in different directories have identical hashes.
ENV SOURCE_DATE_EPOCH=0 \
    TZ=UTC \
    LC_ALL=C.UTF-8 \
    LANG=C.UTF-8 \
    RUSTFLAGS="--remap-path-prefix /build=/gpt_node --remap-path-prefix /usr/local/cargo/registry=/cargo"

# Create and use a non-root user for the build process
RUN addgroup -g 1000 builder && \
    adduser -u 1000 -G builder -D builder

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

# 2. Build Release Binary (Musl)
# --mount=type=cache: Persists the Cargo registry between builds.
# We specify uid=1000/gid=1000 so the cache is writable by our 'builder' user.
RUN --mount=type=cache,target=/usr/local/cargo/registry,uid=1000,gid=1000 \
    cargo build \
    --package gpt_node \
    --target x86_64-unknown-linux-musl \
    --release \
    --locked && \
    # Copy the binary out of the build output
    cp target/x86_64-unknown-linux-musl/release/gpt_node /build/gpt_node_bin

# Stage 2: Exporter
# We use 'scratch' (empty image) to ensure the output contains ONLY the binary
# and absolutely no filesystem metadata or OS files from the builder.
FROM scratch AS export
COPY --from=builder /build/gpt_node_bin /gpt_node