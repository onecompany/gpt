import React, { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Plus,
  CheckCircle,
  Pencil,
  CircleNotch,
  ShieldCheck,
  LockKey,
  DotsThreeVertical,
  ArrowCounterClockwise,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { useGovernanceStore } from "@/store/governanceStore";
import { useModelsStore } from "@/store/modelsStore";
import { MODEL_PRESETS, BackendModelPreset } from "@/constants/modelPresets";
import { Model } from "@/types";
import { TransitionPanel } from "@/components/ui/TransitionPanel";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "@/components/ui/Dropdown";
import { ContentTabs } from "@/components/ui/ContentTabs";
import { SubHeader } from "@/components/ui/SubHeader";

// Sub-components
import RegistryTab from "./RegistryTab";
import ManagersTab from "./ManagersTab";
import CanistersTab from "./CanistersTab";
import ModelsTab from "./ModelsTab";
import ModelForm from "./ModelForm";
import VersionsTab, { GenerationKey } from "./VersionsTab";
import VersionsForm from "./VersionsForm";
import PolicyTab from "./PolicyTab";
import PolicyForm from "./PolicyForm";

type ActiveTab =
  | "registry"
  | "versions"
  | "policy"
  | "managers"
  | "canisters"
  | "models";
type ViewMode = "list" | "form";
type AnimationDirection = 1 | -1;

const GovernanceTab: React.FC = () => {
  const {
    loading,
    isManager,
    managers,
    hasFetchedInitialData,
    fetchInitialData,
    addModel,
    updateModel,
    provisionCanister,
    claimManagerRole,
    loadingCanisters,
    loading: governanceLoading,
  } = useGovernanceStore();

  const { models, loading: modelsLoading, fetchModels } = useModelsStore();

  const [activeTab, setActiveTab] = useState<ActiveTab>("registry");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [direction, setDirection] = useState<AnimationDirection>(1);

  // Specific state for editing items
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [editingGeneration, setEditingGeneration] =
    useState<GenerationKey | null>(null);

  const [restoring, setRestoring] = useState(false);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (!hasFetchedInitialData) {
      fetchInitialData();
    }
  }, [hasFetchedInitialData, fetchInitialData]);

  const isLoading =
    loading ||
    governanceLoading ||
    restoring ||
    modelsLoading ||
    loadingCanisters ||
    claiming;

  // --- Navigation Helpers ---

  const handleTabChange = (tab: ActiveTab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setViewMode("list");
    setDirection(1);
  };

  const handleEnterForm = () => {
    setDirection(1);
    setViewMode("form");
  };

  const handleExitForm = () => {
    setDirection(-1);
    setViewMode("list");
    setEditingModel(null);
    setEditingGeneration(null);
  };

  const handleSuccess = (msg: string) => {
    toast.success(msg, {
      icon: (
        // Changed from emerald-400 to zinc-100 for monochromatic theme
        <CheckCircle size={18} weight="fill" className="text-zinc-100" />
      ),
    });
    handleExitForm();
  };

  // --- Actions ---

  const handleRestoreDefaults = async () => {
    if (
      !confirm(
        "Add missing default models? Existing models will not be overwritten.",
      )
    )
      return;
    setRestoring(true);
    let added = 0;
    const existingIds = new Set(models.map((m) => m.modelId));

    for (const preset of MODEL_PRESETS) {
      if (!existingIds.has(preset.model_id)) {
        try {
          await addModel(preset);
          added++;
        } catch (e) {
          console.error(e);
        }
      }
    }
    await fetchModels(true);
    setRestoring(false);
    toast.success(
      added > 0 ? `Restored ${added} models.` : "All defaults present.",
      {
        icon: <CheckCircle size={18} weight="fill" className="text-zinc-100" />,
      },
    );
  };

  const handleEditModel = (model: Model) => {
    setEditingModel(model);
    handleEnterForm();
  };

  const handleEditVersion = (generation: GenerationKey) => {
    setEditingGeneration(generation);
    handleEnterForm();
  };

  const handleModelFormSubmit = async (preset: BackendModelPreset) => {
    if (editingModel) await updateModel(preset);
    else await addModel(preset);
    handleSuccess(`Model "${preset.name}" saved.`);
  };

  const handleProvisionCanister = async () => {
    if (!confirm("Provision new user canister? (Costs 1T cycles)")) return;
    try {
      await provisionCanister();
      toast.success("Canister provisioned successfully.", {
        icon: <CheckCircle size={18} weight="fill" className="text-zinc-100" />,
      });
    } catch {
      // Errors handled by component checking state
    }
  };

  const handleClaimManager = async () => {
    setClaiming(true);
    try {
      await claimManagerRole();
      toast.success("Governance initialized. You are now a manager.", {
        icon: <CheckCircle size={18} weight="fill" className="text-zinc-100" />,
      });
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Failed to claim role";
      toast.error(msg);
    } finally {
      setClaiming(false);
    }
  };

  // --- Render Header Actions (Desktop) ---

  const renderDesktopActions = () => {
    switch (activeTab) {
      case "registry":
        return (
          <button
            onClick={handleEnterForm}
            disabled={isLoading}
            className="hidden sm:flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100 transition-colors disabled:opacity-50"
          >
            Add Measurement <Plus weight="bold" />
          </button>
        );
      case "managers":
        return (
          <button
            onClick={handleEnterForm}
            disabled={isLoading}
            className="hidden sm:flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100 transition-colors disabled:opacity-50"
          >
            Add Manager <Plus weight="bold" />
          </button>
        );
      case "versions":
        return null;
      case "policy":
        return (
          <button
            onClick={handleEnterForm}
            disabled={isLoading}
            className="hidden sm:flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100 transition-colors disabled:opacity-50"
          >
            Edit Policy <Pencil weight="bold" />
          </button>
        );
      case "canisters":
        return (
          <button
            onClick={handleProvisionCanister}
            disabled={isLoading}
            className="hidden sm:flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            Provision <Plus weight="bold" />
          </button>
        );
      case "models":
        return (
          <div className="hidden sm:flex items-center gap-4">
            <button
              onClick={handleRestoreDefaults}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100 transition-colors disabled:opacity-50"
            >
              Restore{" "}
              {restoring ? (
                <CircleNotch className="animate-spin" />
              ) : (
                <ArrowCounterClockwise weight="bold" />
              )}
            </button>
            <button
              onClick={handleEnterForm}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100 transition-colors disabled:opacity-50"
            >
              Add Model <Plus weight="bold" />
            </button>
          </div>
        );
    }
  };

  // --- Render Header Actions (Mobile) ---

  const renderMobileActions = () => {
    switch (activeTab) {
      case "registry":
        return (
          <DropdownItem
            onClick={handleEnterForm}
            disabled={isLoading}
            className="justify-between"
          >
            <span>Add Measurement</span>
            <Plus weight="bold" size={16} />
          </DropdownItem>
        );
      case "managers":
        return (
          <DropdownItem
            onClick={handleEnterForm}
            disabled={isLoading}
            className="justify-between"
          >
            <span>Add Manager</span>
            <Plus weight="bold" size={16} />
          </DropdownItem>
        );
      case "policy":
        return (
          <DropdownItem
            onClick={handleEnterForm}
            disabled={isLoading}
            className="justify-between"
          >
            <span>Edit Policy</span>
            <Pencil weight="bold" size={16} />
          </DropdownItem>
        );
      case "canisters":
        return (
          <DropdownItem
            onClick={handleProvisionCanister}
            disabled={isLoading}
            className="justify-between"
          >
            <span>Provision</span>
            <Plus weight="bold" size={16} />
          </DropdownItem>
        );
      case "models":
        return (
          <>
            <DropdownItem
              onClick={handleRestoreDefaults}
              disabled={isLoading}
              className="justify-between"
            >
              <span>Restore Defaults</span>
              {restoring ? (
                <CircleNotch className="animate-spin" size={16} />
              ) : (
                <ArrowCounterClockwise weight="bold" size={16} />
              )}
            </DropdownItem>
            <DropdownItem
              onClick={handleEnterForm}
              disabled={isLoading}
              className="justify-between"
            >
              <span>Add Model</span>
              <Plus weight="bold" size={16} />
            </DropdownItem>
          </>
        );
      case "versions":
      default:
        return null;
    }
  };

  const getSubHeaderTitle = () => {
    switch (activeTab) {
      case "registry":
        return "Add Measurement";
      case "managers":
        return "Add Manager";
      case "versions":
        return editingGeneration
          ? `Edit ${
              editingGeneration.charAt(0).toUpperCase() +
              editingGeneration.slice(1)
            } Versions`
          : "Edit Versions";
      case "policy":
        return "Edit Security Policy";
      case "models":
        return editingModel ? "Edit Model" : "New Model";
      default:
        return "Edit";
    }
  };

  // --- Main Render ---

  if (loading && !hasFetchedInitialData) {
    return (
      <div className="flex items-center justify-center h-full">
        <CircleNotch className="animate-spin text-zinc-500" size={24} />
      </div>
    );
  }

  if (hasFetchedInitialData && managers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-in fade-in duration-300">
        <div className="p-4 bg-zinc-800 rounded-full mb-4 ring-1 ring-zinc-700">
          <ShieldCheck size={32} className="text-zinc-100" weight="duotone" />
        </div>
        <h3 className="text-xl font-medium text-zinc-100">
          Initialize Governance
        </h3>
        <p className="text-sm text-zinc-400 mt-2 max-w-sm leading-relaxed">
          No administrators are currently assigned to this canister. Claim the
          manager role to begin configuration.
        </p>
        <button
          onClick={handleClaimManager}
          disabled={claiming}
          className="mt-6 px-6 py-2 bg-zinc-300 hover:bg-zinc-200 text-zinc-900 rounded-lg text-sm font-medium transition-all shadow-lg hover:shadow-zinc-900/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
        >
          {claiming ? (
            <>
              <CircleNotch className="animate-spin" size={16} />
              Claiming...
            </>
          ) : (
            <>Claim</>
          )}
        </button>
      </div>
    );
  }

  if (!isManager) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-in fade-in duration-300">
        <div className="p-4 bg-zinc-800 rounded-full mb-4 ring-1 ring-zinc-700">
          <LockKey size={32} className="text-zinc-500" weight="duotone" />
        </div>
        <h3 className="text-lg font-medium text-zinc-100">Access Denied</h3>
        <p className="text-sm text-zinc-400 mt-2 max-w-sm">
          Governance settings are restricted to protocol administrators.
        </p>
      </div>
    );
  }

  const mobileActions = renderMobileActions();

  return (
    <div className="flex flex-col w-full h-full relative overflow-hidden">
      {viewMode === "form" ? (
        <SubHeader title={getSubHeaderTitle()} onBack={handleExitForm} />
      ) : (
        <ContentTabs
          activeTab={activeTab}
          onTabChange={handleTabChange}
          tabs={[
            { value: "registry", label: "Registry" },
            { value: "versions", label: "Versions" },
            { value: "policy", label: "Policy" },
            { value: "managers", label: "Managers" },
            { value: "canisters", label: "Canisters" },
            { value: "models", label: "Models" },
          ]}
        >
          {/* Desktop Actions */}
          {renderDesktopActions()}

          {/* Mobile Actions Dropdown */}
          {mobileActions && (
            <div className="sm:hidden">
              <Dropdown as="div" className="relative">
                <DropdownTrigger className="p-2 text-zinc-400 hover:text-zinc-100">
                  <DotsThreeVertical weight="bold" size={20} />
                </DropdownTrigger>
                <DropdownContent align="end" width="w-48">
                  {mobileActions}
                </DropdownContent>
              </Dropdown>
            </div>
          )}
        </ContentTabs>
      )}

      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <TransitionPanel
            key={`${activeTab}-${viewMode}`}
            variant={viewMode === "form" ? "slide" : "fade"}
            direction={direction}
            className="absolute inset-0 overflow-hidden"
          >
            {activeTab === "registry" && (
              <RegistryTab viewMode={viewMode} onSuccess={handleSuccess} />
            )}

            {activeTab === "versions" &&
              (viewMode === "list" ? (
                <VersionsTab onEdit={handleEditVersion} />
              ) : editingGeneration ? (
                <VersionsForm
                  generation={editingGeneration}
                  onSuccess={handleSuccess}
                />
              ) : null)}

            {activeTab === "policy" &&
              (viewMode === "list" ? (
                <PolicyTab />
              ) : (
                <PolicyForm onSuccess={handleSuccess} />
              ))}

            {activeTab === "managers" && (
              <ManagersTab viewMode={viewMode} onSuccess={handleSuccess} />
            )}

            {activeTab === "canisters" && <CanistersTab />}

            {activeTab === "models" &&
              (viewMode === "list" ? (
                <ModelsTab onEdit={handleEditModel} />
              ) : (
                <ModelForm
                  modelToEdit={editingModel}
                  onSubmit={handleModelFormSubmit}
                  isLoading={isLoading}
                />
              ))}
          </TransitionPanel>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default GovernanceTab;
