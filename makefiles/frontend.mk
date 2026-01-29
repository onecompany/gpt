FRONTEND_PKG = gpt_frontend
FRONTEND_DIR = src/$(FRONTEND_PKG)

.PHONY: build_frontend deploy_frontend reinstall_frontend clean_frontend

build_frontend: ## Build gpt_frontend
	@echo "Building $(FRONTEND_PKG)..."
	@dfx build $(FRONTEND_PKG) --network local

deploy_frontend: ## Deploy gpt_frontend
	@echo "Deploying $(FRONTEND_PKG)..."
	@dfx deploy $(FRONTEND_PKG) --no-wallet --network local

reinstall_frontend: ## Reinstall gpt_frontend
	@echo "Reinstalling $(FRONTEND_PKG)..."
	@dfx deploy $(FRONTEND_PKG) --no-wallet --network local --mode=reinstall --yes

clean_frontend: ## Clean gpt_frontend artifacts
	@echo "Cleaning $(FRONTEND_PKG)..."
	@rm -rf $(FRONTEND_DIR)/.next $(FRONTEND_DIR)/out
