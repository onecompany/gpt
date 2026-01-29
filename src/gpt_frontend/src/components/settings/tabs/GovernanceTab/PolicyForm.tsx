import React, { useState } from "react";
import { useGovernanceStore } from "@/store/governanceStore";
import { CaretRight, CheckCircle } from "@phosphor-icons/react";
import clsx from "clsx";
import { Switch } from "@headlessui/react";
import type { AttestationRequirements } from "@candid/declarations/gpt_index.did";
import { toast } from "sonner";

interface PolicyFormProps {
  onSuccess: (msg: string) => void;
}

type PolicyBooleanKey =
  | "require_smt_disabled"
  | "require_tsme_disabled"
  | "require_ecc_enabled"
  | "require_rapl_disabled"
  | "require_ciphertext_hiding_enabled";

const PolicyForm: React.FC<PolicyFormProps> = ({ onSuccess }) => {
  const { attestationRequirements, updateAttestationPolicies } =
    useGovernanceStore();

  const [localPolicy, setLocalPolicy] =
    useState<AttestationRequirements | null>(() => {
      return attestationRequirements
        ? structuredClone(attestationRequirements)
        : null;
    });

  const [isLoading, setIsLoading] = useState(false);

  if (!localPolicy) return null;

  const globalFlags: {
    label: string;
    description: string;
    key: PolicyBooleanKey;
  }[] = [
    {
      label: "SMT Disabled",
      description: "Require Simultaneous Multithreading to be disabled.",
      key: "require_smt_disabled",
    },
    {
      label: "TSME Disabled",
      description:
        "Require Transparent Secure Memory Encryption to be disabled.",
      key: "require_tsme_disabled",
    },
    {
      label: "ECC Enabled",
      description: "Require Error-Correcting Code memory.",
      key: "require_ecc_enabled",
    },
    {
      label: "RAPL Disabled",
      description: "Require Running Average Power Limit to be disabled.",
      key: "require_rapl_disabled",
    },
    {
      label: "Ciphertext Hiding",
      description: "Require VMPL ciphertext hiding enabled.",
      key: "require_ciphertext_hiding_enabled",
    },
  ];

  const handleFlagToggle = (key: PolicyBooleanKey) => {
    setLocalPolicy({ ...localPolicy, [key]: !localPolicy[key] });
  };

  const handleParamChange = (
    field: "min_report_version" | "max_attestation_age_ns",
    value: string,
  ) => {
    const updated = { ...localPolicy };

    if (field === "min_report_version") {
      updated.min_report_version = parseInt(value) || 0;
    } else {
      try {
        updated.max_attestation_age_ns = BigInt(value || "0");
      } catch {
        // Ignore invalid BigInt inputs temporarily
      }
    }
    setLocalPolicy(updated);
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { measurements, ...policies } = localPolicy;
      await updateAttestationPolicies(policies);
      onSuccess("Policy updated successfully.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update policy.";
      toast.error(msg);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-7">
        {/* Global Security Flags */}
        <div>
          <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">
            Security Flags
          </h4>
          <div className="space-y-3">
            {globalFlags.map((flag) => {
              const isEnforced = localPolicy[flag.key];
              return (
                <div
                  key={flag.key}
                  className="flex items-center justify-between p-3.5 rounded-lg bg-zinc-800 border border-zinc-750"
                >
                  <div>
                    <div className="text-sm font-medium text-zinc-200">
                      {flag.label}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {flag.description}
                    </div>
                  </div>
                  <Switch
                    checked={isEnforced}
                    onChange={() => handleFlagToggle(flag.key)}
                    className={clsx(
                      isEnforced ? "bg-zinc-300" : "bg-zinc-700",
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out  focus-visible:ring-2 focus-visible:ring-white/75",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={clsx(
                        isEnforced
                          ? "translate-x-5 bg-zinc-900"
                          : "translate-x-0 bg-zinc-600",
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out",
                      )}
                    />
                  </Switch>
                </div>
              );
            })}
          </div>
        </div>

        {/* Numeric Parameters */}
        <div>
          <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">
            Parameters
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Min Report Version
              </label>
              <input
                type="number"
                value={localPolicy.min_report_version}
                onChange={(e) =>
                  handleParamChange("min_report_version", e.target.value)
                }
                className="block w-full px-3 py-2 rounded-md bg-zinc-800 text-sm text-zinc-200 placeholder-zinc-500  focus:ring-0 transition-colors"
              />
              <p className="text-xs text-zinc-500 mt-1.5">
                Minimum required version of the attestation report structure.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Max Attestation Age (ns)
              </label>
              <input
                type="text"
                value={localPolicy.max_attestation_age_ns.toString()}
                onChange={(e) =>
                  handleParamChange("max_attestation_age_ns", e.target.value)
                }
                className="block w-full px-3 py-2 rounded-md bg-zinc-800 text-sm text-zinc-200 placeholder-zinc-500  focus:ring-0 transition-colors"
              />
              <p className="text-xs text-zinc-500 mt-1.5">
                Maximum allowable age of an attestation report in nanoseconds.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-750 px-5 py-3 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className={clsx(
            "text-sm font-medium flex items-center gap-1.5  focus:ring-0 transition-colors",
            isLoading
              ? "text-zinc-500 "
              : "text-zinc-100 hover:text-zinc-200 cursor-pointer",
          )}
        >
          {isLoading ? "Saving..." : "Save Policy"}
          {!isLoading && <CaretRight size={14} weight="bold" />}
        </button>
      </div>
    </div>
  );
};

export default PolicyForm;
