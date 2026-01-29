//! VM launcher for QEMU with SEV-SNP support.

use anyhow::{Context, Result};
use base64::Engine;
use nix::unistd::execv;
use std::ffi::CString;
use std::path::PathBuf;
use zeroize::Zeroize;

use crate::identity;
use crate::vm::assets;

// VM configuration constants.
// These define the resource allocation for each GPT Node instance.
pub const CORES: u32 = 4;
pub const MEMORY_MB: u32 = 8192;

// SEV-SNP Guest Policy Calculation:
// This bitmask defines the security constraints enforced by the AMD Secure Processor.
// Bit 16 (SMT Allowed):          1 (Allowed) - Compatibility fix for hosts with SMT enabled.
// Bit 17 (Reserved):             1 (Required by spec)
// Bit 18 (Migrate Allowed):      0 (Disabled) - Prevents state export/migration.
// Bit 19 (Debug Allowed):        0 (Disabled) - Prevents hypervisor from reading guest memory.
// Bit 20 (Single Socket):        0 (Disabled) - Compatibility fix for various board topologies.
// Bit 21 (CXL Allowed):          0 (Disabled)
// Bit 22 (AES-256-XTS):          1 (Required) - Enforces strongest available memory encryption.
// Total: 0x400000 (Bit 22) + 0x20000 (Bit 17) + 0x10000 (Bit 16) = 0x430000 (currently without Bit 22 below)
pub const POLICY: u32 = 0x30000;

/// Prepares resources and replaces the current process with QEMU using `execv`.
/// This is the core launch logic. It ensures assets are present, constructs the
/// complex QEMU command line for SEV-SNP, and then execs into QEMU.
/// This ensures signals (like SIGTERM from systemd) are handled directly by QEMU.
pub fn launch_node_vm(
    host_port: u16,
    node_id: u64,
    seed_path_override: Option<&PathBuf>,
) -> Result<()> {
    // 1. Setup Assets (Cached)
    // Extracts embedded firmware/kernel if not present or if hashes mismatch.
    println!("Verifying VM assets...");
    let assets = assets::ensure_assets().context("Failed to ensure VM assets")?;

    // 2. Load Identity & Generate Host Data
    // The host data blob is injected into the guest's pre-encrypted memory block.
    // It serves as the initial trust anchor for the guest to derive its identity.
    println!("Loading identity...");
    let mut seed = identity::load_seed(seed_path_override)?;
    let mut host_data_bytes = [0u8; identity::HOST_DATA_LENGTH];
    // First 8 bytes: Node ID (little-endian)
    host_data_bytes[0..8].copy_from_slice(&node_id.to_le_bytes());
    // Next 24 bytes: Identity Seed
    host_data_bytes[8..identity::HOST_DATA_LENGTH].copy_from_slice(&seed);
    // Encode as Base64 for QEMU argument
    let host_data_b64 = base64::engine::general_purpose::STANDARD.encode(host_data_bytes);

    // Secure cleanup of sensitive data from memory before exec.
    seed.zeroize();
    host_data_bytes.zeroize();

    // 3. Resolve System QEMU
    // We strictly require the system-provided QEMU (10.1+) which supports modern SNP syntax.
    let qemu_bin_str = "/usr/bin/qemu-system-x86_64".to_string();

    // 4. Build QEMU Args
    // This configuration is tuned for AMD SEV-SNP on QEMU 10.1+.
    let args_vec = vec![
        qemu_bin_str.clone(),
        "-name".to_string(),
        format!("gpt_node_{}", node_id),
        "-enable-kvm".to_string(),
        // CPU Configuration:
        // Explicitly using EPYC-Milan to match typical hardware and avoid potential v4 incompatibilities.
        // host-phys-bits=on is essential for correct C-bit position handling in SEV.
        // pmu=off reduces complexity and potential side channels.
        "-cpu".to_string(),
        "EPYC-Milan,host-phys-bits=on,pmu=off".to_string(),
        // SMP Topology:
        // We configure 4 vCPUs. threads=1 ensures we present them as distinct cores,
        // avoiding SMT topology hints even if the host has SMT enabled.
        "-smp".to_string(),
        format!("cpus={0},sockets=1,cores={0},threads=1,maxcpus={0}", CORES),
        // Machine Type:
        // q35 is the standard chipset.
        // confidential-guest-support links to the sev0 object (modern syntax).
        // vmport=off is required for SEV-SNP as VMWare backdoor ports are incompatible.
        "-machine".to_string(),
        "q35,confidential-guest-support=sev0,vmport=off".to_string(),
        // Memory Backend:
        // Using memfd with prealloc=on guarantees memory is reserved and resident.
        // 'reserve=off' is NOT used here as it conflicts with 'prealloc=on' in newer QEMU/Kernel versions.
        "-object".to_string(),
        format!(
            "memory-backend-memfd,id=ram1,size={}M,share=true,prealloc=on",
            MEMORY_MB
        ),
        "-machine".to_string(),
        "memory-backend=ram1".to_string(),
        // SEV-SNP Guest Object (Upstream Syntax for QEMU 10.1+)
        // cbitpos=51: Standard for Milan/Genoa.
        // reduced-phys-bits=1: Standard for AMD.
        // host-data: The injected identity blob.
        // policy: The calculated security policy bitmask.
        // kernel-hashes=on: MANDATORY when booting via -kernel to include kernel/initrd/cmdline in the measurement.
        "-object".to_string(),
        format!(
            "sev-snp-guest,id=sev0,cbitpos=51,reduced-phys-bits=1,host-data={},policy=0x{:X},kernel-hashes=on",
            host_data_b64, POLICY
        ),
        // BIOS/Firmware:
        // We use -bios instead of -drive if=pflash because it is robust against "readonly memory support"
        // errors on various KVM configurations while still correctly mapping the OVMF code for measurement.
        "-bios".to_string(),
        assets.ovmf.to_string_lossy().to_string(),
        // Kernel & Initrd:
        // Direct kernel boot is used to ensure the guest runs the exact, verified gpt_node binary
        // contained within the initrd, rather than relying on a disk image state.
        "-kernel".to_string(),
        assets.kernel.to_string_lossy().to_string(),
        "-initrd".to_string(),
        assets.initrd.to_string_lossy().to_string(),
        // Boot parameters: panic=1 ensures the VM restarts quickly if it crashes.
        "-append".to_string(),
        "console=ttyS0 root=/dev/ram0 panic=1".to_string(),
        // Networking:
        // User mode networking (SLIRP) with port forwarding.
        // This isolates the guest network stack from the host while allowing the API port access.
        // iommu_platform=true is required for virtio devices in restricted DMA environments (SEV).
        "-netdev".to_string(),
        format!("user,id=vmnic,hostfwd=tcp::{}-:8000", host_port),
        "-device".to_string(),
        "virtio-net-pci,disable-legacy=on,iommu_platform=true,netdev=vmnic,romfile=".to_string(),
        // Serial / Monitor:
        // Configures headless operation with access to the monitor via socket if needed.
        "-nographic".to_string(),
        "-serial".to_string(),
        "mon:stdio".to_string(),
        "-monitor".to_string(),
        "pty".to_string(),
        "-monitor".to_string(),
        "unix:monitor,server,nowait".to_string(),
        // No reboot:
        // We want QEMU to exit on guest shutdown/reboot so systemd can handle the restart logic
        // or fail status correctly.
        "-no-reboot".to_string(),
    ];

    println!("Launching Node {}: {}", node_id, args_vec.join(" "));
    println!("Replacing process with QEMU...");

    // Convert to CString for execv
    let c_args: Vec<CString> = args_vec
        .iter()
        .map(|s| CString::new(s.as_str()).unwrap())
        .collect();
    let c_bin = CString::new(qemu_bin_str.as_str()).unwrap();

    // Execv replaces the current process image with QEMU.
    // This is crucial for signal handling (e.g., stopping the systemd service stops QEMU immediately).
    execv(&c_bin, &c_args).context("Failed to exec QEMU")?;

    unreachable!("execv should not return");
}
