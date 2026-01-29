VM_ARTIFACTS_DIR = $(ARTIFACTS_DIR)/vm
VM_CACHE_DIR = $(ARTIFACTS_DIR)/vm_cache
VM_DIR = src/gpt_vm
OS_NAME = os
OVMF_NAME = ovmf
OS_DIR = src/gpt_vm/${OS_NAME}
OVMF_DIR = src/gpt_vm/${OVMF_NAME}
REQ_ASSETS = $(VM_ARTIFACTS_DIR)/OVMF.fd $(VM_ARTIFACTS_DIR)/vmlinuz $(VM_ARTIFACTS_DIR)/initrd.gz
DOCKER_RUN_ARGS = --rm -u 0:0 -v "$(PWD)/$(VM_ARTIFACTS_DIR):/output" -v "$(PWD)/$(VM_CACHE_DIR):/host_cache" -e SUDO_UID=$(shell id -u) -e SUDO_GID=$(shell id -g)

.PHONY: check_vm_artifacts build_os build_ovmf

check_vm_artifacts: ## Check for required VM artifacts
	@$(foreach f,$(REQ_ASSETS),test -s '$(f)' || { printf "error: missing or empty artifact: %s\n" '$(f)' >&2; exit 1; };)

build_os: check_node_binary ## Build OS image
	@echo "Building OS image..."
	@mkdir -p $(VM_ARTIFACTS_DIR)
	@mkdir -p $(VM_CACHE_DIR)
	@DOCKER_BUILDKIT=1 docker build --no-cache -t $(OS_NAME) -f $(OS_DIR)/Dockerfile .
	@docker run $(DOCKER_RUN_ARGS) $(OS_NAME)

build_ovmf: ## Build OVMF firmware
	@echo "Building OVMF firmware..."
	@mkdir -p $(VM_ARTIFACTS_DIR)
	@mkdir -p $(VM_CACHE_DIR)
	@DOCKER_BUILDKIT=1 docker build --no-cache -t $(OVMF_NAME) $(OVMF_DIR)
	@docker run $(DOCKER_RUN_ARGS) $(OVMF_NAME)
