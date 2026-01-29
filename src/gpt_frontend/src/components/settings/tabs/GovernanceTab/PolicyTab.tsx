import React from "react";
import { useGovernanceStore } from "@/store/governanceStore";
import { StatusBadge } from "@/components/ui/StatusBadge";
import clsx from "clsx";

const PolicyTab: React.FC = () => {
  const { attestationRequirements } = useGovernanceStore();

  if (!attestationRequirements) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
        No policy data available.
      </div>
    );
  }

  const globalFlags = [
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
  ] as const;

  const parameters = [
    {
      label: "Min Report Version",
      value: attestationRequirements.min_report_version,
    },
    {
      label: "Max Attestation Age",
      value: `${attestationRequirements.max_attestation_age_ns.toString()} ns`,
    },
  ];

  const SettingRow = ({
    label,
    description,
    children,
    className,
  }: {
    label: string;
    description?: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <div
      className={clsx(
        "flex items-center justify-between py-3 px-4 first:rounded-t-lg last:rounded-b-lg bg-zinc-800/40 border-b border-zinc-800 last:border-b-0",
        className,
      )}
    >
      <div className="flex flex-col pr-4 min-w-0">
        <span className="text-sm font-medium text-zinc-200 truncate">
          {label}
        </span>
        {description && (
          <span className="text-xs text-zinc-500 truncate mt-0.5">
            {description}
          </span>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="px-5 py-4 space-y-6">
        {/* Section: Security Flags */}
        <section>
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 px-1">
            Security Flags
          </h3>
          <div className="rounded-lg border border-zinc-800 overflow-hidden">
            {globalFlags.map((flag) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const isEnforced = (attestationRequirements as any)[flag.key];
              return (
                <SettingRow
                  key={flag.key}
                  label={flag.label}
                  description={flag.description}
                >
                  <StatusBadge
                    status={isEnforced ? "Active" : "Disabled"}
                    showLabel
                    className={clsx(
                      "w-20 justify-center text-xs",
                      !isEnforced && "bg-zinc-800 text-zinc-500",
                    )}
                  />
                </SettingRow>
              );
            })}
          </div>
        </section>

        {/* Section: Parameters */}
        <section>
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 px-1">
            Parameters
          </h3>
          <div className="rounded-lg border border-zinc-800 overflow-hidden">
            {parameters.map((param) => (
              <SettingRow key={param.label} label={param.label}>
                <span className="text-sm text-zinc-400 bg-zinc-900/50 px-2.5 py-1 rounded-md border border-zinc-800/50">
                  {param.value}
                </span>
              </SettingRow>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default PolicyTab;
