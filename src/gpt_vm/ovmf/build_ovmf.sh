#!/bin/bash
# Prebuilt OVMF Retriever (Fedora Rawhide edk2-ovmf)
#
# Downloads, Verifies, and Extracts OVMF firmware with SEV-SNP support.
# Implements caching via mapped host directory to prevent redundant downloads.

set -euo pipefail

# Source RPM Info:
# https://packages.fedoraproject.org/pkgs/edk2/edk2-ovmf/
# https://koschei.fedoraproject.org/package/edk2?collection=f44
# https://koji.fedoraproject.org/koji/buildinfo?buildID=2878064
# https://kojipkgs.fedoraproject.org/packages/edk2/20251119/5.fc44/noarch/edk2-ovmf-20251119-5.fc44.noarch.rpm

# Configuration
readonly RPM_URL="https://kojipkgs.fedoraproject.org/packages/edk2/20251119/5.fc44/noarch/edk2-ovmf-20251119-5.fc44.noarch.rpm"
readonly RPM_FILENAME="edk2-ovmf.rpm"

# Hashes
readonly EXPECTED_RPM_SHA256="3579aedc9fe21bdde3ee3d0701b4def409b6681035c4222ab215d8547ffde4de"
readonly EXPECTED_OVMF_SHA256="117c3dfa6ea749700b61387120496d4bc6ad6405654c6819ec871a8bff32f229"

# Paths
readonly HOST_CACHE_DIR="/host_cache"
readonly WORK_DIR="/workspace"
readonly EXTRACT_DIR="${WORK_DIR}/rpm_extract"
readonly TARGET_OUTPUT="/output/OVMF.fd"
readonly RPM_OVMF_PATH="usr/share/edk2/ovmf/OVMF.amdsev.fd"

# Logging helpers
info() { printf '\033[34m▸\033[0m %s\n' "$*" >&2; }
ok() { printf '\033[32m✓\033[0m %s\n' "$*" >&2; }
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

# 1. Check Cache / Download / Update Cache
fetch_rpm() {
	local cached_file="${HOST_CACHE_DIR}/${RPM_FILENAME}"
	local dest_file="${WORK_DIR}/${RPM_FILENAME}"

	# A. Check Cache
	if [[ -f ${cached_file} ]]; then
		info "Checking cache for ${RPM_FILENAME}..."
		local cached_hash
		cached_hash=$(hash_file "${cached_file}")

		if [[ ${cached_hash} == "${EXPECTED_RPM_SHA256}" ]]; then
			ok "Cache hit: ${RPM_FILENAME} (Verified)"
			cp "${cached_file}" "${dest_file}"
			return 0
		else
			echo "Cache mismatch. Expected ${EXPECTED_RPM_SHA256}, got ${cached_hash}. Downloading fresh." >&2
			rm -f "${cached_file}"
		fi
	else
		info "No cache found for ${RPM_FILENAME}."
	fi

	# B. Download
	info "Downloading ${RPM_URL}..."
	if ! curl -fsSL --retry 3 -o "${dest_file}" "${RPM_URL}"; then
		die "Failed to download RPM from ${RPM_URL}"
	fi

	# C. Verify
	local downloaded_hash
	downloaded_hash=$(hash_file "${dest_file}")
	if [[ ${downloaded_hash} != "${EXPECTED_RPM_SHA256}" ]]; then
		err "Download verification failed for ${RPM_FILENAME}"
		err "  Expected: ${EXPECTED_RPM_SHA256}"
		err "  Actual:   ${downloaded_hash}"
		die "Security check failed. Aborting."
	fi
	ok "Download verified."

	# D. Update Cache
	info "Updating host cache..."
	cp "${dest_file}" "${cached_file}"

	# Fix ownership if running in docker with SUDO_UID passed
	if [[ -n ${SUDO_UID-} ]]; then
		chown "${SUDO_UID}:${SUDO_GID:-${SUDO_UID}}" "${cached_file}" || true
	fi
}

main() {
	rm -rf "${EXTRACT_DIR}"
	mkdir -p "${EXTRACT_DIR}"

	# 1. Get the RPM
	fetch_rpm

	# 2. Extract
	info "Extracting RPM..."
	cd "${EXTRACT_DIR}"
	rpm2cpio "${WORK_DIR}/${RPM_FILENAME}" | cpio -idmv >/dev/null 2>&1

	if [[ ! -f ${RPM_OVMF_PATH} ]]; then
		die "OVMF firmware not found in rpm at: ${RPM_OVMF_PATH}"
	fi

	# 3. Verify Extracted Content (Double check)
	info "Verifying extracted OVMF.amdsev.fd..."
	local actual_sha
	actual_sha=$(hash_file "${RPM_OVMF_PATH}")

	if [[ ${actual_sha} != "${EXPECTED_OVMF_SHA256}" ]]; then
		err "SHA256 mismatch for extracted contents (OVMF.amdsev.fd)"
		err "  Expected: ${EXPECTED_OVMF_SHA256}"
		err "  Actual:   ${actual_sha}"
		die "Integrity check failed."
	fi
	ok "Extracted content verified."

	# 4. Finalize
	info "Copying firmware to ${TARGET_OUTPUT}..."
	cp "${RPM_OVMF_PATH}" "${TARGET_OUTPUT}"

	# Fix permissions if Makefile passed host UID/GID
	if [[ -n ${SUDO_UID-} ]]; then
		chown "${SUDO_UID}:${SUDO_GID:-${SUDO_UID}}" "${TARGET_OUTPUT}" || true
	fi

	local final_sha
	final_sha=$(hash_file "${TARGET_OUTPUT}")

	ok "Build Complete."
	echo "  OVMF.fd SHA256: ${final_sha}"
}

main
