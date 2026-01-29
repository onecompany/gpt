# Prebuilt OVMF exporter (Fedora edk2-ovmf rpm)

FROM alpine:3.23.0@sha256:51183f2cfa6320055da30872f211093f9ff1d3cf06f39a0bdb212314c5dc7375

RUN apk add \
    bash \
    curl \
    rpm2cpio \
    cpio \
    xz \
    coreutils

WORKDIR /workspace

COPY build_ovmf.sh /usr/local/bin/build_ovmf.sh
RUN chmod +x /usr/local/bin/build_ovmf.sh

# Create dedicated non-root user and prepare directories
# We also create /host_cache to serve as the mount point for the host's cache directory
RUN addgroup -S builder && adduser -S builder -G builder && \
    mkdir -p /workspace /output /host_cache && \
    chown -R builder:builder /workspace /output /host_cache

USER builder

# /output: Artifact destination
# /host_cache: Source for cached upstream RPMs
VOLUME ["/output", "/host_cache"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD bash -c 'test -x /usr/local/bin/build_ovmf.sh'

ENTRYPOINT ["/usr/local/bin/build_ovmf.sh"]