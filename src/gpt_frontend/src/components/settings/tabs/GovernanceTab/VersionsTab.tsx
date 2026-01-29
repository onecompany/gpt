import React, { useMemo } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import { useGovernanceStore } from "@/store/governanceStore";
import { Pencil } from "@phosphor-icons/react";

// The generations we support in the UI
export type GenerationKey = "milan" | "genoa" | "turin";

interface VersionsTabProps {
  onEdit: (generation: GenerationKey) => void;
}

const VersionsTab: React.FC<VersionsTabProps> = ({ onEdit }) => {
  const { attestationRequirements } = useGovernanceStore();

  const rows = useMemo(() => {
    if (!attestationRequirements) return [];

    const gens: { key: GenerationKey; name: string; genCode: string }[] = [
      { key: "milan", name: "Milan", genCode: "Gen 3" },
      { key: "genoa", name: "Genoa", genCode: "Gen 4" },
      { key: "turin", name: "Turin", genCode: "Gen 5" },
    ];

    return gens.map((g) => {
      // Access the specific policy for this generation
      const policy =
        attestationRequirements[
          `${g.key}_policy` as keyof typeof attestationRequirements
        ];

      // Since policy structure is known (GenTcbRequirements) we cast or access safely
      // Note: TypeScript might need help mapping the key string to the property
      // We assume attestationRequirements has milan_policy, genoa_policy, turin_policy

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tcb = (policy as any)?.min_tcb || {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const guestSvn = (policy as any)?.min_guest_svn ?? 0;

      return {
        key: g.key,
        name: g.name,
        code: g.genCode,
        snp: tcb.snp ?? 0,
        microcode: tcb.microcode ?? 0,
        tee: tcb.tee ?? 0,
        bootloader: tcb.bootloader ?? 0,
        guestSvn: guestSvn,
      };
    });
  }, [attestationRequirements]);

  if (!attestationRequirements) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        No policy data available.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-left px-5 w-32">Generation</TableHead>
            <TableHead className="text-center px-2">SNP</TableHead>
            <TableHead className="text-center px-2">Microcode</TableHead>
            <TableHead className="text-center px-2">TEE</TableHead>
            <TableHead className="text-center px-2">Bootloader</TableHead>
            <TableHead className="text-center px-2">Guest SVN</TableHead>
            <TableHead className="text-right px-5 w-20">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="px-5">
                <div className="flex flex-col">
                  <span className="font-medium text-zinc-200">{row.name}</span>
                  <span className="text-xs text-zinc-500">{row.code}</span>
                </div>
              </TableCell>
              <TableCell className="px-2 text-center text-zinc-400">
                {row.snp}
              </TableCell>
              <TableCell className="px-2 text-center text-zinc-400 ">
                {row.microcode}
              </TableCell>
              <TableCell className="px-2 text-center text-zinc-400">
                {row.tee}
              </TableCell>
              <TableCell className="px-2 text-center text-zinc-400">
                {row.bootloader}
              </TableCell>
              <TableCell className="px-2 text-center text-zinc-400">
                {row.guestSvn}
              </TableCell>
              <TableCell className="px-5 text-right">
                <button
                  onClick={() => onEdit(row.key)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-100 transition-colors rounded-md hover:bg-zinc-800"
                  title={`Edit ${row.name}`}
                >
                  <Pencil size={16} />
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default VersionsTab;
