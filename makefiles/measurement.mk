MEASUREMENT_PKG = gpt_measurement
MEASUREMENT_DIR = src/$(MEASUREMENT_PKG)
MEASUREMENT_TARGET = x86_64-unknown-linux-gnu
MEASUREMENT_BIN_DIR = target/$(MEASUREMENT_TARGET)/release
MEASUREMENT_BIN = $(MEASUREMENT_BIN_DIR)/$(MEASUREMENT_PKG)

.PHONY: build_measurement_tool check_measurement_binary measure clean_measurement

build_measurement_tool: ## Build gpt_measurement (docker, reproducible)
	@echo "Building ${MEASUREMENT_PKG} (docker)..."
	@mkdir -p $(MEASUREMENT_BIN_DIR)
	@DOCKER_BUILDKIT=1 docker build --output type=local,dest=$(MEASUREMENT_BIN_DIR) -f $(MEASUREMENT_DIR)/Dockerfile .

check_measurement_binary: ## Check for required gpt_measurement binary
	@test -s '$(MEASUREMENT_BIN)' || { printf "error: missing or empty artifact: %s\n" '$(MEASUREMENT_BIN)' >&2; exit 1; }

measure: check_measurement_binary ## Calculate the SEV-SNP launch measurement
	@echo "Calculating SEV-SNP launch measurement..."
	@$(MEASUREMENT_BIN)

clean_measurement: ## Clean measurement tool artifacts
	@echo "Cleaning ${MEASUREMENT_PKG}..."
	@rm -f $(MEASUREMENT_BIN)
