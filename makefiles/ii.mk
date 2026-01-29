II_PKG = internet_identity
II_DIR = $(ARTIFACTS_DIR)/${II_PKG}
II_DID = $(BINDINGS_DIR)/$(II_PKG).did
II_WASM = $(II_DIR)/internet_identity_dev.wasm
II_BASE_URL = https://github.com/dfinity/internet-identity/releases/download/$(II_RELEASE_TAG)
II_RELEASE_TAG = release-2026-01-05

.PHONY: build_ii check_ii_wasm deploy_ii clean_ii

build_ii: ## Build internet_identity
	@echo "Downloading .wasm for $(II_PKG)..."
	@mkdir -p "$(II_DIR)"
	@curl -L "$(II_BASE_URL)/internet_identity_dev.wasm.gz" | gunzip -c > "$(II_WASM)"

	@echo "Downloading .did for $(II_PKG)..."
	@mkdir -p "$(BINDINGS_DIR)"
	@curl -L "$(II_BASE_URL)/internet_identity.did" -o "$(II_DID)"

	@echo "Generating bindings for $(II_PKG)..."
	@npx icp-bindgen --did-file "./$(II_DID)" --out-dir "./$(BINDINGS_DIR)" --force

check_ii_wasm: ## Check for required internet_identity .wasm artifact
	@test -s '$(II_WASM)' || { printf "error: missing or empty artifact: %s\n" '$(II_WASM)' >&2; exit 1; }

deploy_ii: check_ii_wasm ## Deploy internet_identity
	@echo "Deploying $(II_PKG)..."
	@dfx deploy "$(II_PKG)" --no-wallet --network local

clean_ii: ## Clean internet_identity artifacts
	@echo "Cleaning $(II_PKG)..."
	@rm -rf "$(II_DIR)"
