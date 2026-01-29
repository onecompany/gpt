INDEX_PKG = gpt_index
INDEX_DIR = src/$(INDEX_PKG)
INDEX_DID = $(BINDINGS_DIR)/$(INDEX_PKG).did
INDEX_TARGET = wasm32-unknown-unknown
INDEX_WASM = target/${INDEX_TARGET}/release/$(INDEX_PKG).wasm

.PHONY: build_index check_index_wasm deploy_index clean_index

build_index: check_user_wasm ## Build gpt_index
	@echo "Building .wasm for $(INDEX_PKG)..."
	@cargo generate-lockfile --manifest-path "$(INDEX_DIR)/Cargo.toml"
	@cargo build --manifest-path "$(INDEX_DIR)/Cargo.toml" --package "$(INDEX_PKG)" --release --locked --target $(INDEX_TARGET)

	@echo "Extracting .did for $(INDEX_PKG)..."
	@mkdir -p "$(BINDINGS_DIR)"
	@candid-extractor "$(INDEX_WASM)" > "$(INDEX_DID)"

	@echo "Optimizing .wasm for $(INDEX_PKG)..."
	@ic-wasm "$(INDEX_WASM)" -o "$(INDEX_WASM)" metadata candid:service -v public -f "$(INDEX_DID)"
	@ic-wasm "$(INDEX_WASM)" -o "$(INDEX_WASM)" shrink

	@echo "Generating bindings for $(INDEX_PKG)..."
	@npx icp-bindgen --did-file "./$(INDEX_DID)" --out-dir "./$(BINDINGS_DIR)" --force

check_index_wasm: ## Check for required gpt_index .wasm artifact
	@test -s '$(INDEX_WASM)' || { printf "error: missing or empty artifact: %s\n" '$(INDEX_WASM)' >&2; exit 1; }

deploy_index: check_index_wasm ## Deploy gpt_index
	@echo "Deploying $(INDEX_PKG)..."
	@dfx deploy "$(INDEX_PKG)" --no-wallet --network local

	@echo "Funding $(INDEX_PKG) locally..."
	@dfx ledger fabricate-cycles --canister "$$(dfx canister id "$(INDEX_PKG)" --network local)" --network local --t 100

clean_index: ## Clean gpt_index artifacts
	@echo "Cleaning $(INDEX_PKG)..."
	@rm -f "$(INDEX_WASM)"
