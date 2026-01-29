# Minimal OS Assembler (Alpine/Musl)
#
# Accepts a pre-built gpt_node binary and assembles the initrd.
# This strictly separates compilation from OS assembly.

FROM alpine:3.23.0@sha256:51183f2cfa6320055da30872f211093f9ff1d3cf06f39a0bdb212314c5dc7375 AS assembler

RUN apk add --no-cache \
    bash \
    curl \
    gzip \
    cpio \
    dpkg \
    zstd \
    findutils \
    coreutils

# Create dedicated non-root user and prepare directories
# We also create /host_cache to serve as the mount point for the host's cache directory
RUN addgroup -S builder && adduser -S builder -G builder && \
    mkdir -p /workspace /output /host_cache && \
    chown -R builder:builder /workspace /output /host_cache

WORKDIR /workspace

# Inject scripts
COPY src/gpt_vm/os/build_os.sh /usr/local/bin/build_os.sh
COPY src/gpt_vm/os/init /workspace/init
COPY src/gpt_vm/os/udhcpc.script /workspace/udhcpc.script

RUN chmod +x /usr/local/bin/build_os.sh /workspace/init /workspace/udhcpc.script

# Inject Pre-built Binary
# The makefile ensures this file exists in the build context at this path
COPY target/x86_64-unknown-linux-musl/release/gpt_node /workspace/gpt_node

# Make sure workspace artifacts are owned by the non-root builder user
RUN chown builder:builder /workspace/gpt_node /workspace/init /workspace/udhcpc.script

# /output: Artifact destination
# /host_cache: Source for cached upstream binaries (kernel, alpine rootfs)
VOLUME ["/output", "/host_cache"]

# Default to non-root user.
USER builder

# Basic healthcheck: verify the entrypoint script is present.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD sh -c 'test -x /usr/local/bin/build_os.sh'

ENTRYPOINT ["/usr/local/bin/build_os.sh"]