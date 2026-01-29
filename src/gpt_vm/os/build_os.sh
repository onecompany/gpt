#!/usr/bin/env bash
# GPT Node OS Builder (Alpine 3.23 + Ubuntu Mainline Kernel)
#
# Constructs a minimal, reproducible system running from RAM.
# Uses Alpine userspace for size and Ubuntu Mainline kernel for hardware support (SEV-SNP).
# Implements caching via mapped host directory to prevent redundant downloads.

set -euo pipefail
shopt -s inherit_errexit

# Normalize environment for reproducible builds.
normalize_init() {
	export SOURCE_DATE_EPOCH=0
	export LC_ALL=C
	export LANG=C
	export TZ=UTC
	export LANGUAGE=C
	umask 022
}

info() { printf '\033[34m▸\033[0m %s\n' "$*" >&2; }
ok() { printf '\033[32m✓\033[0m %s\n' "$*" >&2; }
warn() { printf '\033[33m!\033[0m %s\n' "$*" >&2; }
err() { printf '\033[31m✗\033[0m %s\n' "$*" >&2; }
die() {
	err "$*"
	exit 1
}

hash_file() {
	local file digest
	file="${1}"
	digest=$(sha256sum "${file}") || die "sha256sum failed on ${file}"
	printf '%s\n' "${digest%% *}"
}

normalize_times() {
	local root tmpfile path touch_failed
	root="${1}"
	touch_failed=""

	tmpfile=$(mktemp) || die "mktemp failed"

	# Generate deterministic file list
	if ! find "${root}" -depth -print0 >"${tmpfile}"; then
		rm -f "${tmpfile}"
		die "find failed in normalize_times"
	fi

	# Read-only loop: do NOT delete or write to tmpfile inside the loop
	while IFS= read -r -d '' path; do
		if ! touch -h -d "@${SOURCE_DATE_EPOCH}" "${path}"; then
			touch_failed="${path}"
			break
		fi
	done <"${tmpfile}"

	# Cleanup AFTER loop
	rm -f "${tmpfile}"

	if [[ -n ${touch_failed} ]]; then
		die "touch failed on ${touch_failed}"
	fi
}

make_cpio() {
	local src_dir listfile sortedfile
	src_dir="${1}"

	if ! cpio --help 2>/dev/null | grep -q -- '--reproducible'; then
		die "cpio in PATH does not support --reproducible (need GNU cpio ≥ 2.12)"
	fi

	cd "${src_dir}" || die "cannot cd into ${src_dir}"

	set -o pipefail

	listfile=$(mktemp) || die "mktemp failed"
	sortedfile=$(mktemp) || {
		rm -f "${listfile}"
		die "mktemp failed"
	}

	# Create file list
	if ! find . -print0 >"${listfile}"; then
		rm -f "${listfile}" "${sortedfile}"
		die "find failed building file list"
	fi

	# Sort deterministically
	if ! LC_ALL=C sort -z "${listfile}" >"${sortedfile}"; then
		rm -f "${listfile}" "${sortedfile}"
		die "sort failed"
	fi

	# Create deterministic archive
	if ! cpio \
		--null \
		-o \
		--format=newc \
		--owner=0:0 \
		--reproducible \
		<"${sortedfile}" \
		2>/dev/null; then
		rm -f "${listfile}" "${sortedfile}"
		die "cpio archive creation failed"
	fi

	rm -f "${listfile}" "${sortedfile}"

	set +o pipefail
}

# Initialize reproducible environment
normalize_init

# Version Pins
readonly ALPINE_VERSION="3.23.0"
readonly KERNEL_VERSION="6.18.0-061800-generic"
readonly KERNEL_PKG_VERSION="6.18.0-061800.202511302339_amd64"

# Expected SHA256 Hashes (Strict Verification)
readonly SHA256_ALPINE="ce8f782f1628d046fb6360eff880b898e5205ed91106d9d14ff4fcb97431bbde"
readonly SHA256_KERNEL="bd80b54b10ec9a90eeda23be6c52675be2932fb1a8c3dda63262dbacdebb5eb2"
readonly SHA256_MODULES="b1694100851fcd21a96abf1b4aeed06af692fcf4153400de6fd35fa0ae986d61"

# Source URLs
readonly ALPINE_URL="https://dl-cdn.alpinelinux.org/alpine/v3.23/releases/x86_64/alpine-minirootfs-${ALPINE_VERSION}-x86_64.tar.gz"
readonly KERNEL_BASE="https://kernel.ubuntu.com/mainline/v6.18/amd64"
readonly KERNEL_DEB_URL="${KERNEL_BASE}/linux-image-unsigned-${KERNEL_VERSION}_${KERNEL_PKG_VERSION}.deb"
readonly MODULES_DEB_URL="${KERNEL_BASE}/linux-modules-${KERNEL_VERSION}_${KERNEL_PKG_VERSION}.deb"

# Paths
readonly WORK_DIR="/workspace/build"
readonly DL_DIR="/workspace/downloads"
# This directory is mounted from the host (makefiles/vm.mk)
readonly HOST_CACHE_DIR="/host_cache"
readonly ROOTFS_DIR="${WORK_DIR}/rootfs"
readonly OUTPUT_DIR="/output"
readonly GPT_NODE_BIN="/workspace/gpt_node"
readonly INIT_SCRIPT="/workspace/init"
readonly UDHCP_SCRIPT="/workspace/udhcpc.script"

# Required Modules (paths relative to kernel module tree root)
readonly MODULES="
arch/x86/kernel/msr.ko
drivers/virt/coco/guest/tsm_report.ko
drivers/virt/coco/sev-guest/sev-guest.ko
"

# Fetches a resource:
# 1. Checks host cache for file + valid hash.
# 2. If invalid/missing, downloads to workspace.
# 3. Verifies hash of download.
# 4. Updates host cache for future runs.
fetch_resource() {
	local url="$1"
	local file_name="$2"
	local expected_hash="$3"

	local cached_file="${HOST_CACHE_DIR}/${file_name}"
	local dest_file="${DL_DIR}/${file_name}"

	mkdir -p "${DL_DIR}"

	# 1. Try Cache
	if [[ -f ${cached_file} ]]; then
		info "Checking cache for ${file_name}..."
		local cached_hash
		cached_hash=$(hash_file "${cached_file}")

		if [[ ${cached_hash} == "${expected_hash}" ]]; then
			ok "Cache hit: ${file_name} (Verified)"
			cp "${cached_file}" "${dest_file}"
			return 0
		else
			warn "Cache mismatch for ${file_name}. Expected ${expected_hash}, got ${cached_hash}. Downloading fresh."
			rm -f "${cached_file}"
		fi
	else
		info "No cache found for ${file_name}."
	fi

	# 2. Download
	info "Downloading ${url}..."
	if ! curl -fsSL --retry 3 -o "${dest_file}" "${url}"; then
		die "Failed to download ${url}"
	fi

	# 3. Verify Download
	local downloaded_hash
	downloaded_hash=$(hash_file "${dest_file}")
	if [[ ${downloaded_hash} != "${expected_hash}" ]]; then
		err "Download verification failed for ${file_name}"
		err "  Expected: ${expected_hash}"
		err "  Got:      ${downloaded_hash}"
		die "Security check failed. Aborting."
	fi
	ok "Download verified: ${file_name}"

	# 4. Update Cache
	info "Updating host cache: ${cached_file}"
	cp "${dest_file}" "${cached_file}"

	# Fix ownership so the host user (non-root) can manage the cache file.
	# The container runs as root (0:0) due to Makefile args, but SUDO_UID is passed via env.
	if [[ -n ${SUDO_UID-} ]]; then
		chown "${SUDO_UID}:${SUDO_GID:-${SUDO_UID}}" "${cached_file}" || true
	fi
}

main() {
	rm -rf "${WORK_DIR}"
	mkdir -p "${ROOTFS_DIR}" "${DL_DIR}"

	# 1. Fetch Resources (Cached & Verified)
	fetch_resource "${ALPINE_URL}" "alpine.tar.gz" "${SHA256_ALPINE}"
	fetch_resource "${KERNEL_DEB_URL}" "kernel.deb" "${SHA256_KERNEL}"
	fetch_resource "${MODULES_DEB_URL}" "modules.deb" "${SHA256_MODULES}"

	# 2. Build Rootfs
	info "Extracting Alpine Rootfs..."
	tar -xzf "${DL_DIR}/alpine.tar.gz" -C "${ROOTFS_DIR}"

	# 3. Install Binaries & Config
	info "Installing gpt_node & init..."
	install -m 755 "${GPT_NODE_BIN}" "${ROOTFS_DIR}/usr/local/bin/gpt_node"
	install -m 755 "${INIT_SCRIPT}" "${ROOTFS_DIR}/init"

	# DHCP hook script for udhcpc
	if [[ -x ${UDHCP_SCRIPT} ]]; then
		install -m 755 "${UDHCP_SCRIPT}" "${ROOTFS_DIR}/usr/local/bin/udhcpc.script"
	else
		warn "DHCP helper script ${UDHCP_SCRIPT} missing; network auto-config may fail."
	fi

	# 4. Extract Kernel & Modules
	info "Extracting Kernel & Modules..."
	local kdir mdir
	kdir="${WORK_DIR}/k_extract"
	mdir="${WORK_DIR}/m_extract"
	mkdir -p "${kdir}" "${mdir}"

	dpkg-deb -x "${DL_DIR}/kernel.deb" "${kdir}"
	dpkg-deb -x "${DL_DIR}/modules.deb" "${mdir}"

	# Move vmlinuz to work dir (avoid pipes in command substitution)
	local vmlinuz vmlinuz_candidate
	vmlinuz=""
	for vmlinuz_candidate in "${kdir}/boot"/vmlinuz-*; do
		if [[ -f ${vmlinuz_candidate} ]]; then
			vmlinuz=${vmlinuz_candidate}
			break
		fi
	done

	if [[ -z ${vmlinuz} ]]; then
		die "No vmlinuz-* kernel found under ${kdir}/boot"
	fi

	cp "${vmlinuz}" "${WORK_DIR}/vmlinuz"

	# Copy selected modules to rootfs
	local mod_root dest_mod_dir
	mod_root="${mdir}/lib/modules/${KERNEL_VERSION}/kernel"
	dest_mod_dir="${ROOTFS_DIR}/usr/lib/modules"
	mkdir -p "${dest_mod_dir}"

	local mod_path src name
	for mod_path in ${MODULES}; do
		src="${mod_root}/${mod_path}"
		name=$(basename "${mod_path}" .ko)

		# Handle compression (Ubuntu often ships .zst)
		if [[ -f ${src}.zst ]]; then
			zstd -d "${src}.zst" -o "${dest_mod_dir}/${name}.ko"
		elif [[ -f ${src} ]]; then
			cp "${src}" "${dest_mod_dir}/${name}.ko"
		else
			# Some modules might be built-in on some kernels.
			# Warn but don't fail, as init script handles missing modules gracefully.
			warn "Module ${mod_path} not found in package. (Built-in?)"
		fi
	done

	# 5. Pack Initrd
	info "Packing initrd.gz..."
	normalize_times "${ROOTFS_DIR}"

	make_cpio "${ROOTFS_DIR}" | gzip -n -9 >"${WORK_DIR}/initrd.gz"

	# 6. Finalize Output
	mkdir -p "${OUTPUT_DIR}"
	cp "${WORK_DIR}/vmlinuz" "${OUTPUT_DIR}/vmlinuz"
	cp "${WORK_DIR}/initrd.gz" "${OUTPUT_DIR}/initrd.gz"

	# Fix ownership if running in docker. This is best-effort only:
	# when running as non-root, chown may fail, but the build should still succeed.
	if [[ -n ${SUDO_UID-} ]]; then
		if ! chown "${SUDO_UID}:${SUDO_GID:-${SUDO_UID}}" \
			"${OUTPUT_DIR}/vmlinuz" "${OUTPUT_DIR}/initrd.gz" 2>/dev/null; then
			local current_uid
			if ! current_uid=$(id -u 2>/dev/null); then
				current_uid="unknown"
			fi
			info "Non-fatal: failed to chown artifacts to ${SUDO_UID}:${SUDO_GID:-${SUDO_UID}} (current uid: ${current_uid})."
		fi
	fi

	# Deterministic SHA256 output.
	local sha_vmlinuz sha_initrd
	sha_vmlinuz=$(hash_file "${OUTPUT_DIR}/vmlinuz")
	sha_initrd=$(hash_file "${OUTPUT_DIR}/initrd.gz")

	ok "Build Complete."
	echo "SHA256 vmlinuz: ${sha_vmlinuz}"
	echo "SHA256 initrd:  ${sha_initrd}"
}

main "$@"
