import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import clsx from "clsx";
import {
  Plus,
  CircleNotch,
  DotsThreeVertical,
  UploadSimple,
} from "@phosphor-icons/react";
import { mapPublicNodeToSettingsNode } from "../../SettingsTypes";
import NodeList from "./NodeList";
import NodeWizard from "./NodeWizard";
import NodeImportReview, { ImportNodeData } from "./NodeImportReview";
import { useAuthStore, AuthStatus } from "@/store/authStore";
import { useModelsStore } from "@/store/modelsStore";
import { useChatStore } from "@/store/chatStore";
import { useGovernanceStore } from "@/store/governanceStore";
import { TransitionPanel } from "@/components/ui/TransitionPanel";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "@/components/ui/Dropdown";
import { ContentTabs } from "@/components/ui/ContentTabs";
import { SubHeader } from "@/components/ui/SubHeader";

// Interface for loose typing of import JSON data to avoid 'any'
interface RawNodeImport {
  hostname?: unknown;
  address?: unknown;
  host?: unknown;

  model?: unknown;
  model_id?: unknown;
  modelId?: unknown;

  apikey?: unknown;
  api_key?: unknown;
  apiKey?: unknown;
  key?: unknown;

  chipid?: unknown;
  chip_id?: unknown;
  chipId?: unknown;

  identity?: unknown;
  host_identity?: unknown;
  hostIdentity?: unknown;
  id?: unknown;
}

const NodeTab: React.FC = () => {
  const { authStatus, principal } = useAuthStore();
  const { models: allAvailableModels, loading: modelsLoading } =
    useModelsStore();
  const {
    myNodes,
    allNodes,
    myNodesLoading,
    allNodesLoading,
    hasFetchedAllNodes,
    hasFetchedMyNodes,
    fetchMyNodesAuth,
    fetchAllActiveNodesAuth,
    createNode,
  } = useChatStore();
  const { attestationRequirements } = useGovernanceStore();

  const [nodeWizardStep, setNodeWizardStep] = useState(0);
  const [nodeWizardDirection, setNodeWizardDirection] = useState(1);
  const [nodeListView, setNodeListView] = useState<"all" | "my">("all");
  const [isCreatingNode, setIsCreatingNode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hostIdentity, setHostIdentity] = useState("");
  const formStateRef = useRef({
    hostname: "",
    modelId: "",
    apiKey: "",
    chipId: "",
  });

  const [importNodes, setImportNodes] = useState<ImportNodeData[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setNewNodeHostname = (value: string) => {
    formStateRef.current.hostname = value;
  };
  const setNewNodeModelId = (value: string) => {
    formStateRef.current.modelId = value;
  };
  const setNewNodeApiKey = (value: string) => {
    formStateRef.current.apiKey = value;
  };
  const setNewNodeChipId = (value: string) => {
    formStateRef.current.chipId = value;
  };

  const isUserRegistered = authStatus === AuthStatus.REGISTERED;

  useEffect(() => {
    if (isUserRegistered) {
      if (!hasFetchedMyNodes) {
        fetchMyNodesAuth(false);
      }
    }
    if (!hasFetchedAllNodes) {
      fetchAllActiveNodesAuth(false);
    }
  }, [
    isUserRegistered,
    fetchMyNodesAuth,
    fetchAllActiveNodesAuth,
    hasFetchedMyNodes,
    hasFetchedAllNodes,
  ]);

  useEffect(() => {
    if (nodeListView === "my" && isUserRegistered) {
      fetchMyNodesAuth(false);
    } else if (nodeListView === "all") {
      fetchAllActiveNodesAuth(false);
    }
  }, [
    nodeListView,
    isUserRegistered,
    fetchMyNodesAuth,
    fetchAllActiveNodesAuth,
  ]);

  useEffect(() => {
    if (
      !modelsLoading &&
      allAvailableModels.length > 0 &&
      !formStateRef.current.modelId
    ) {
      formStateRef.current.modelId = allAvailableModels[0].modelId;
    }
  }, [modelsLoading, allAvailableModels]);

  const handleEnterWizard = () => {
    setError(null);
    setNodeWizardDirection(1);
    setNodeWizardStep(1);
  };

  const handleExitWizard = () => {
    setNodeWizardDirection(-1);
    setNodeWizardStep(0);
    if (nodeListView === "my") fetchMyNodesAuth(true);
  };

  const triggerFileImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const parseImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      if (!Array.isArray(json)) {
        throw new Error("JSON must be an array of node objects.");
      }

      const parsed: ImportNodeData[] = (json as RawNodeImport[]).map(
        (item, idx) => {
          const hostname = item.hostname || item.address || item.host || "";
          const modelId = item.model || item.model_id || item.modelId || "";
          const apiKey =
            item.apikey || item.api_key || item.apiKey || item.key || "";
          const chipId = item.chipid || item.chip_id || item.chipId || "";
          const hostIdentity =
            item.identity ||
            item.host_identity ||
            item.hostIdentity ||
            item.id ||
            "";

          return {
            _id: `import-${idx}-${Date.now()}`,
            hostname: String(hostname).trim(),
            modelId: String(modelId).trim(),
            apiKey: String(apiKey).trim(),
            chipId: String(chipId).trim(),
            hostIdentity: String(hostIdentity).trim(),
            status: "idle",
          };
        },
      );

      if (parsed.length === 0) {
        throw new Error("No nodes found in the imported file.");
      }

      setImportNodes(parsed);
      setError(null);
      setNodeWizardDirection(1);
      setNodeWizardStep(2);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to parse import file: ${msg}`);
    }
  };

  const handleCreateNode = async () => {
    const { hostname, modelId, apiKey, chipId } = formStateRef.current;

    setIsCreatingNode(true);
    setError(null);

    try {
      await createNode(hostname, modelId, apiKey, chipId, hostIdentity);
      handleExitWizard();
      setNodeListView("my");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to create node: ${msg || "Unknown error"}`);
    } finally {
      setIsCreatingNode(false);
    }
  };

  const isSetupComplete =
    (attestationRequirements?.measurements?.length ?? 0) > 0;

  const isNewNodeDisabled =
    !isUserRegistered ||
    modelsLoading ||
    allAvailableModels.length === 0 ||
    !isSetupComplete;

  const getNewNodeTitle = () => {
    if (!isUserRegistered) return "Please register to create nodes";
    if (!isSetupComplete)
      return "Attestation measurement not set. Configure it in the Governance tab before creating nodes.";
    if (modelsLoading) return "Loading available models...";
    if (allAvailableModels.length === 0)
      return "No models available to configure a node";
    return "Configure a new node";
  };

  // Convert Frontend PublicNodeInfo -> Settings NodeInfo
  const myNodesList = myNodes.map(mapPublicNodeToSettingsNode);
  const allActiveNodesList = allNodes.map(mapPublicNodeToSettingsNode);

  const nodesToDisplay =
    nodeListView === "my" ? myNodesList : allActiveNodesList;

  const renderListView = () => {
    if (!isUserRegistered && nodeListView === "my") {
      return (
        <div className="flex items-center justify-center text-sm h-full text-zinc-400 px-5 text-center">
          Please sign in and complete account setup to view your nodes.
        </div>
      );
    }

    const isLoading = nodeListView === "my" ? myNodesLoading : allNodesLoading;
    const hasFetched =
      nodeListView === "my" ? hasFetchedMyNodes : hasFetchedAllNodes;

    return (
      <AnimatePresence mode="wait" initial={false}>
        {isLoading && !hasFetched ? (
          <TransitionPanel
            key="loading"
            variant="fade"
            className="flex items-center justify-center h-full"
          >
            <CircleNotch size={24} className="text-zinc-400 animate-spin" />
          </TransitionPanel>
        ) : (
          <TransitionPanel
            key={nodeListView}
            variant="fade"
            className="w-full h-full"
          >
            <NodeList
              nodes={nodesToDisplay}
              nodeListView={nodeListView}
              currentUserPrincipal={principal}
            />
          </TransitionPanel>
        )}
      </AnimatePresence>
    );
  };

  const renderHeader = () => {
    if (nodeWizardStep === 1) {
      return (
        <SubHeader title="New Node Configuration" onBack={handleExitWizard} />
      );
    }
    if (nodeWizardStep === 2) {
      return <SubHeader title="Bulk Import Nodes" onBack={handleExitWizard} />;
    }
    return (
      <ContentTabs
        activeTab={nodeListView}
        onTabChange={setNodeListView}
        tabs={[
          { value: "all", label: "All Nodes" },
          { value: "my", label: "My Nodes", disabled: !isUserRegistered },
        ]}
      >
        <>
          {!allNodesLoading && nodeListView === "all" && (
            <span className="text-sm text-zinc-500 whitespace-nowrap">
              {allNodes.filter((n) => n.isActive && n.nodePrincipal).length}{" "}
              Online
            </span>
          )}

          {nodeListView === "my" && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={parseImportFile}
                accept=".json"
                className="hidden"
              />

              <div className="hidden sm:flex items-center gap-3">
                <button
                  onClick={triggerFileImport}
                  disabled={isNewNodeDisabled}
                  className={clsx(
                    "flex items-center gap-1.5 text-sm py-1 rounded-md transition duration-150 ",
                    isNewNodeDisabled
                      ? "text-zinc-600 "
                      : "text-zinc-400 hover:text-zinc-100 cursor-pointer",
                  )}
                  title="Import nodes from JSON"
                >
                  Import <UploadSimple size={14} weight="bold" />
                </button>
                <button
                  onClick={handleEnterWizard}
                  disabled={isNewNodeDisabled}
                  className={clsx(
                    "flex items-center gap-1 text-sm py-1 rounded-md transition duration-150 ",
                    isNewNodeDisabled
                      ? "text-zinc-600 "
                      : "text-zinc-400 hover:text-zinc-100 cursor-pointer",
                  )}
                  title={getNewNodeTitle()}
                >
                  New Node <Plus size={12} weight="bold" />
                </button>
              </div>

              <div className="sm:hidden">
                <Dropdown as="div" className="relative">
                  {({ open }: { open: boolean }) => (
                    <>
                      <DropdownTrigger
                        className={clsx(
                          "py-1 px-0.5 rounded-md ",
                          open
                            ? "text-zinc-50"
                            : "text-zinc-400 hover:text-zinc-50",
                        )}
                        aria-label="Node Actions"
                      >
                        <DotsThreeVertical size={20} weight="bold" />
                      </DropdownTrigger>
                      <DropdownContent align="end" width="w-40">
                        <DropdownItem
                          onClick={triggerFileImport}
                          disabled={isNewNodeDisabled}
                          className="justify-between"
                        >
                          <span>Import JSON</span>
                          <UploadSimple size={16} />
                        </DropdownItem>
                        <DropdownItem
                          onClick={handleEnterWizard}
                          disabled={isNewNodeDisabled}
                          className="justify-between"
                        >
                          <span>New Node</span>
                          <Plus size={16} />
                        </DropdownItem>
                      </DropdownContent>
                    </>
                  )}
                </Dropdown>
              </div>
            </>
          )}
        </>
      </ContentTabs>
    );
  };

  return (
    <div className="flex flex-col w-full h-full relative">
      {renderHeader()}

      {error && !isCreatingNode && nodeWizardStep !== 2 && (
        <div className="px-5 py-2 text-xs text-red-400 bg-red-900/30 border-b border-red-700/50">
          Error: {error}
        </div>
      )}

      <div className="relative flex-1 overflow-y-auto overflow-x-hidden">
        <AnimatePresence
          initial={false}
          mode="wait"
          custom={nodeWizardDirection}
        >
          {nodeWizardStep === 0 && (
            <TransitionPanel
              key="node-list-view"
              variant="slide"
              direction={nodeWizardDirection}
              className="absolute inset-0"
            >
              {renderListView()}
            </TransitionPanel>
          )}

          {nodeWizardStep === 1 && (
            <TransitionPanel
              key="new-node-wizard"
              variant="slide"
              direction={nodeWizardDirection}
              className="absolute inset-0 flex flex-col"
            >
              {modelsLoading ? (
                <div className="flex items-center justify-center h-full text-zinc-400">
                  Loading models...
                </div>
              ) : allAvailableModels.length === 0 ? (
                <div className="flex items-center justify-center h-full text-zinc-400 px-5 text-center">
                  No models available. Cannot create a node configuration.
                </div>
              ) : (
                <NodeWizard
                  hostname={formStateRef.current.hostname}
                  modelId={formStateRef.current.modelId}
                  apiKey={formStateRef.current.apiKey}
                  chipId={formStateRef.current.chipId}
                  availableModels={allAvailableModels}
                  isLoading={isCreatingNode}
                  onHostnameChange={setNewNodeHostname}
                  onModelIdChange={setNewNodeModelId}
                  onApiKeyChange={setNewNodeApiKey}
                  onChipIdChange={setNewNodeChipId}
                  onConfirm={handleCreateNode}
                  hostIdentity={hostIdentity}
                  onHostIdentityChange={(e) => setHostIdentity(e.target.value)}
                />
              )}
            </TransitionPanel>
          )}

          {nodeWizardStep === 2 && (
            <TransitionPanel
              key="import-node-review"
              variant="slide"
              direction={nodeWizardDirection}
              className="absolute inset-0 flex flex-col"
            >
              <NodeImportReview
                initialNodes={importNodes}
                availableModels={allAvailableModels}
                onCancel={handleExitWizard}
                onImportCompleted={() => {
                  handleExitWizard();
                  setNodeListView("my");
                }}
                createNodeAction={createNode}
              />
            </TransitionPanel>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default NodeTab;
