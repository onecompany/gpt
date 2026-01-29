import React from "react";
import { TabKey } from "./SettingsTypes";
import NodeTab from "./tabs/NodeTab/NodeTab";
import StorageTab from "./tabs/StorageTab";
import GeneralTab from "./tabs/GeneralTab";
import GovernanceTab from "./tabs/GovernanceTab/GovernanceTab";
import ModelsTab from "./tabs/ModelsTab";
import AboutTab from "./tabs/AboutTab";

interface SettingsContentProps {
  activeTab: TabKey;
}

const SettingsContent: React.FC<SettingsContentProps> = ({ activeTab }) => {
  switch (activeTab) {
    case "nodes":
      return <NodeTab />;
    case "storage":
      return <StorageTab />;
    case "general":
      return <GeneralTab />;
    case "governance":
      return <GovernanceTab />;
    case "models":
      return <ModelsTab />;
    case "about":
      return <AboutTab />;
    default:
      return (
        <div className="px-5 py-4">
          <p className="text-sm text-zinc-400">Work in progress</p>
        </div>
      );
  }
};

export default SettingsContent;
