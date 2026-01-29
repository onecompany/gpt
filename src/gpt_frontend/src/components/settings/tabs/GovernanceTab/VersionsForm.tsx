import React, { useState } from "react";
import { useGovernanceStore } from "@/store/governanceStore";
import type {
  AttestationRequirements,
  GenTcbRequirements,
} from "@candid/declarations/gpt_index.did";
import { WarningCircle, CaretRight } from "@phosphor-icons/react";
import clsx from "clsx";
import type { GenerationKey } from "./VersionsTab";
import { toast } from "sonner";

interface VersionsFormProps {
  generation: GenerationKey;
  onSuccess: (msg: string) => void;
}

type TcbField = keyof GenTcbRequirements["min_tcb"];
type VersionField = TcbField | "min_guest_svn";

const VersionsForm: React.FC<VersionsFormProps> = ({
  generation,
  onSuccess,
}) => {
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

  const generationTitle =
    generation.charAt(0).toUpperCase() + generation.slice(1);

  const getValue = (field: VersionField): number => {
    const policyKey = `${generation}_policy` as keyof AttestationRequirements;
    const genPolicy = localPolicy[policyKey] as GenTcbRequirements;

    if (field === "min_guest_svn") {
      return genPolicy.min_guest_svn;
    }
    return genPolicy.min_tcb[field as TcbField];
  };

  const rows: { label: string; field: VersionField; description: string }[] = [
    {
      label: "SNP Version",
      field: "snp",
      description: "Minimum Secure Nested Paging version.",
    },
    {
      label: "Microcode",
      field: "microcode",
      description: "Minimum CPU microcode patch level.",
    },
    {
      label: "TEE",
      field: "tee",
      description: "Minimum Trusted Execution Environment firmware version.",
    },
    {
      label: "Bootloader",
      field: "bootloader",
      description: "Minimum PSP Bootloader version.",
    },
    {
      label: "Guest SVN",
      field: "min_guest_svn",
      description: "Minimum Guest Security Version Number.",
    },
  ];

  if (generation === "turin") {
    rows.splice(2, 0, {
      label: "FMC",
      field: "fmc",
      description: "Minimum Firmware Management Controller version.",
    });
  }

  const handleInputChange = (field: VersionField, value: number) => {
    if (!localPolicy) return;

    const updatedPolicy = { ...localPolicy };
    const genKey = `${generation}_policy` as keyof AttestationRequirements;

    const currentGenPolicy = updatedPolicy[genKey] as GenTcbRequirements;
    const targetGen = {
      ...currentGenPolicy,
      min_tcb: { ...currentGenPolicy.min_tcb },
    };

    if (field === "min_guest_svn") {
      targetGen.min_guest_svn = value;
    } else {
      targetGen.min_tcb[field as TcbField] = value;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updatedPolicy as any)[genKey] = targetGen;
    setLocalPolicy(updatedPolicy);
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      if (!localPolicy) throw new Error("No policy data");
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { measurements, ...policies } = localPolicy;
      await updateAttestationPolicies(policies);
      onSuccess(`${generationTitle} versions updated successfully.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update versions.";
      toast.error(msg);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
          Configure the minimum required Trusted Computing Base (TCB) versions
          for <strong>{generationTitle}</strong>. Nodes running versions lower
          than these values will fail attestation checks.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {rows.map((row) => (
            <div key={row.field}>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                {row.label}
              </label>
              <input
                type="number"
                min={0}
                max={255}
                value={getValue(row.field)}
                onChange={(e) =>
                  handleInputChange(row.field, parseInt(e.target.value) || 0)
                }
                className="mt-0 block w-full px-3 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 placeholder-zinc-500  focus:ring-0 focus:border-zinc-500 transition-colors"
              />
              <p className="text-xs text-zinc-500 mt-1.5">{row.description}</p>
            </div>
          ))}
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
          {isLoading ? "Saving..." : "Save Changes"}
          {!isLoading && <CaretRight size={14} weight="bold" />}
        </button>
      </div>
    </div>
  );
};

export default VersionsForm;
