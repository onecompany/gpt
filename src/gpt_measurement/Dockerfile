# Reproducible Builder for gpt_measurement (GNU/Linux)
#
# Achieves bitwise reproducibility through:
# 1. Toolchain Pinning: Specific Rust image tag + digest.
# 2. Path Remapping: Strips build-environment paths from debug symbols.
# 3. Deterministic Time: Clamps timestamps via SOURCE_DATE_EPOCH.
# 4. Deterministic Output: Exports only the binary via scratch stage.

# Stage 1: Builder
FROM rust:1.93.0-slim-trixie@sha256:df6ca8f96d338697ccdbe3ccac57a85d2172e03a2429c2d243e74f3bb83ba2f5 AS builder

HEALTHCHECK NONE

# Deterministic environment + path remapping
ENV SOURCE_DATE_EPOCH=0 \
    TZ=UTC \
    LC_ALL=C.UTF-8 \
    LANG=C.UTF-8 \
    RUSTFLAGS="--remap-path-prefix /build=/gpt_measurement --remap-path-prefix /usr/local/cargo/registry=/cargo"

# Non-root build user (matches your other Dockerfiles)
RUN groupadd -g 1000 builder && \
    useradd -u 1000 -g builder -m -s /bin/bash builder

WORKDIR /build
RUN chown builder:builder /build
USER builder

# Copy workspace context so workspace deps resolve correctly.
COPY --chown=builder:builder Cargo.toml Cargo.lock ./
COPY --chown=builder:builder src ./src

# OPTIONAL: If gpt_measurement uses include_bytes!/compile-time paths into artifacts/vm,
# keep this copy. If not needed, you can remove these two lines.
COPY --chown=builder:builder artifacts/vm ./artifacts/vm

# Build release binary (GNU/Linux)
# Cache cargo registry to speed up rebuilds.
RUN --mount=type=cache,target=/usr/local/cargo/registry,uid=1000,gid=1000 \
    cargo build \
      --package gpt_measurement \
      --target x86_64-unknown-linux-gnu \
      --release \
      --locked && \
    cp target/x86_64-unknown-linux-gnu/release/gpt_measurement /build/gpt_measurement_bin

# Stage 2: Exporter (artifact-only)
FROM scratch AS export
COPY --from=builder /build/gpt_measurement_bin /gpt_measurement
