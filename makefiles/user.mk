USER_PKG = gpt_user
USER_DIR = src/$(USER_PKG)
USER_DID = $(BINDINGS_DIR)/$(USER_PKG).did
USER_WASM = target/wasm32-unknown-unknown/release/$(USER_PKG).wasm
USER_TARGET = wasm32-unknown-unknown

.PHONY: build_user check_user_wasm clean_user

build_user: ## Build gpt_user
	@echo "Building .wasm for $(USER_PKG)..."
	@cargo generate-lockfile --manifest-path "$(USER_DIR)/Cargo.toml"
	@cargo build --manifest-path "$(USER_DIR)/Cargo.toml" --package "$(USER_PKG)" --release --locked --target $(USER_TARGET)

	@echo "Extracting .did for $(USER_PKG)..."
	@mkdir -p "$(BINDINGS_DIR)"
	@candid-extractor "$(USER_WASM)" > "$(USER_DID)"

	@echo "Optimizing .wasm for $(USER_PKG)..."
	@ic-wasm "$(USER_WASM)" -o "$(USER_WASM)" metadata candid:service -v public -f "$(USER_DID)"
	@ic-wasm "$(USER_WASM)" -o "$(USER_WASM)" shrink

	@echo "Generating bindings for $(USER_PKG)..."
	@npx icp-bindgen --did-file "./$(USER_DID)" --out-dir "./$(BINDINGS_DIR)" --force

check_user_wasm: ## Check for required gpt_user .wasm artifact
	@test -s '$(USER_WASM)' || { printf "error: missing or empty artifact: %s\n" '$(USER_WASM)' >&2; exit 1; }

clean_user: ## Clean gpt_user artifacts
	@echo "Cleaning $(USER_PKG)..."
	@rm -f $(USER_WASM)
