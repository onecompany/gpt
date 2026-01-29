SHELL = /bin/bash
.DEFAULT_GOAL = help
DAEMON_DOMAIN ?= daemon-dev.gptprotocol.dev
DFX_DOMAINS = localhost $(DAEMON_DOMAIN)
ARTIFACTS_DIR = artifacts
BINDINGS_DIR = candid

include $(wildcard makefiles/*.mk)

.PHONY: deploy start stop clean clean_artifacts clean_dfx clean_cargo install_tools help

deploy: ## Deploy all
	@+$(MAKE) build_ii
	@+$(MAKE) deploy_ii
	@+$(MAKE) build_user
	@+$(MAKE) build_index
	@+$(MAKE) deploy_index
	@+$(MAKE) deploy_frontend
	@echo "Full local deployment complete."

start: ## Start replica
	@dfx start --clean --verbose $(foreach domain,$(DFX_DOMAINS),--domain $(domain))

stop: ## Stop replica
	@dfx stop

clean: clean_ii clean_user clean_index clean_frontend clean_artifacts clean_dfx clean_cargo ## Clean all artifacts
	@echo "Full clean complete."

clean_artifacts: ## Clean output directory
	@echo "Cleaning output directory..."
	@rm -rf $(ARTIFACTS_DIR)

clean_dfx: ## Clean dfx artifacts
	@echo "Cleaning dfx state..."
	@rm -rf .dfx .env

clean_cargo: ## Clean cargo artifacts
	@echo "Cleaning cargo artifacts..."
	@cargo clean

install_tools: ## Install tools
	@cargo install candid-extractor ic-wasm cargo-audit

help: ## Show this help message
	@grep -h -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
