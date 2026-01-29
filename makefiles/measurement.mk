MEASUREMENT_PKG = gpt_measurement
MEASUREMENT_DIR = src/$(MEASUREMENT_PKG)
MEASUREMENT_BIN_DIR = target/$(MEASUREMENT_TARGET)/release
MEASUREMENT_BIN = $(MEASUREMENT_BIN_DIR)/$(MEASUREMENT_PKG)
MEASUREMENT_TARGET = x86_64-unknown-linux-gnu

.PHONY: build_measurement_tool check_measurement_binary measure clean_measurement

build_measurement_tool: ## Build gpt_measurement
	@echo "Building ${MEASUREMENT_PKG}..."
	@cargo build --manifest-path "$(MEASUREMENT_DIR)/Cargo.toml" --package "$(MEASUREMENT_PKG)" --release --locked --target $(MEASUREMENT_TARGET)

check_measurement_binary: ## Check for required gpt_measurement binary
	@test -s '$(MEASUREMENT_BIN)' || { printf "error: missing or empty artifact: %s\n" '$(MEASUREMENT_BIN)' >&2; exit 1; }

measure: check_measurement_binary ## Calculate the SEV-SNP launch measurement
	@echo "Calculating SEV-SNP launch measurement..."
	@$(MEASUREMENT_BIN)

clean_measurement: ## Clean measurement tool artifacts
	@echo "Cleaning ${MEASUREMENT_PKG}..."
	@rm -f $(MEASUREMENT_BIN)
