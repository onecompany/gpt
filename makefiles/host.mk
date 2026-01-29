HOST_PKG = gpt_host
HOST_DIR = src/${HOST_PKG}
HOST_TARGET = x86_64-unknown-linux-gnu
HOST_BIN_DIR = target/$(HOST_TARGET)/release
HOST_BIN = $(HOST_BIN_DIR)/$(HOST_PKG)

.PHONY: build_host build_host_binary check_host_binary send_host clean_host

build_host: ## Build full gpt_host: node -> os -> ovmf -> host
	@echo "Building ${HOST_PKG}: build_node -> build_os -> build_ovmf -> build_host_binary"
	@+$(MAKE) build_node
	@+$(MAKE) build_os
	@+$(MAKE) build_ovmf
	@+$(MAKE) build_host_binary
	@+$(MAKE) build_measurement_tool
	@+$(MAKE) measure

build_host_binary: check_vm_artifacts ## Build gpt_host (binary only)
	@echo "Building ${HOST_PKG} binary..."
	@mkdir -p $(HOST_BIN_DIR)
	@DOCKER_BUILDKIT=1 docker build --output type=local,dest=$(HOST_BIN_DIR) -f $(HOST_DIR)/Dockerfile .

check_host_binary: ## Check for required gpt_host binary
	@test -s '$(HOST_BIN)' || { printf "error: missing or empty artifact: %s\n" '$(HOST_BIN)' >&2; exit 1; }

send_host: check_host_binary ## Send gpt_host to a remote machine via croc
	@echo "Sending ${HOST_PKG} via croc..."
	@croc send $(HOST_BIN)

clean_host: ## Clean gpt_host artifacts
	@echo "Cleaning ${HOST_PKG} artifacts..."
	@rm -f $(HOST_BIN)
