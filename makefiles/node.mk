NODE_PKG = gpt_node
NODE_DIR = src/${NODE_PKG}
NODE_TARGET = x86_64-unknown-linux-musl
NODE_BIN_DIR = target/$(NODE_TARGET)/release
NODE_BIN = $(NODE_BIN_DIR)/$(NODE_PKG)

.PHONY: build_node clean_node

build_node: ## Build check_node_binary gpt_node
	@echo "Building ${NODE_PKG}..."
	@mkdir -p $(NODE_BIN_DIR)
	@DOCKER_BUILDKIT=1 docker build --output type=local,dest=$(NODE_BIN_DIR) -f $(NODE_DIR)/Dockerfile .
	@sha256sum $(NODE_BIN)

check_node_binary: ## Check for required gpt_node binary
	@test -s '$(NODE_BIN)' || { printf "error: missing or empty artifact: %s\n" '$(NODE_BIN)' >&2; exit 1; }

clean_node: ## Clean gpt_node artifacts
	@echo "Cleaning ${NODE_PKG} artifacts..."
	@rm -f $(NODE_BIN)
