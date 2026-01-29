use anyhow::{Context, Result, bail};
use sev_snp_utilities::CpuType;
use sev_snp_utilities::{SevMode, calc_launch_digest};
use std::path::Path;

const OUTPUT_DIR: &str = "artifacts/vm";
const OVMF_FILENAME: &str = "OVMF.fd";
const INITRD_FILENAME: &str = "initrd.gz";
const VMLINUZ_FILENAME: &str = "vmlinuz";
const KERNEL_CMDLINE: &str = "console=ttyS0 root=/dev/ram0 panic=1";
const VCPUS: usize = 4;
const CPU_TYPE: CpuType = CpuType::EpycMilan;
const SEV_MODE: SevMode = SevMode::SevSnp;

fn main() -> Result<()> {
    let base_path = Path::new(OUTPUT_DIR);
    let ovmf_path = base_path.join(OVMF_FILENAME);
    let initrd_path = base_path.join(INITRD_FILENAME);
    let vmlinuz_path = base_path.join(VMLINUZ_FILENAME);

    eprintln!(
        "Attempting to read boot files from: {}",
        base_path
            .canonicalize()
            .unwrap_or_else(|_| base_path.to_path_buf())
            .display()
    );

    if !ovmf_path.exists() {
        bail!(
            "Required firmware file not found at: {}. Ensure build artifacts are present.",
            ovmf_path.display()
        );
    }
    if !initrd_path.exists() {
        bail!(
            "Required initrd file not found at: {}. Ensure build artifacts are present.",
            initrd_path.display()
        );
    }
    if !vmlinuz_path.exists() {
        bail!(
            "Required kernel file not found at: {}. Ensure build artifacts are present.",
            vmlinuz_path.display()
        );
    }

    eprintln!("\nCalculating launch digest using the following parameters:");
    eprintln!("OVMF firmware: {}", ovmf_path.display());
    eprintln!("Kernel image: {}", vmlinuz_path.display());
    eprintln!("Initrd: {}", initrd_path.display());
    eprintln!("Kernel command line: '{}'", KERNEL_CMDLINE);
    eprintln!("vCPU count: {}", VCPUS);
    eprintln!("CPU type: {:?}", CPU_TYPE);
    eprintln!("SEV mode: {:?}", SEV_MODE);

    let digest = calc_launch_digest(
        SEV_MODE,
        VCPUS,
        CPU_TYPE,
        &ovmf_path,
        Some(&vmlinuz_path),
        Some(&initrd_path),
        Some(KERNEL_CMDLINE),
    )
    .context("Failed to calculate SEV-SNP launch digest")?;

    eprintln!("\nCalculated Launch Measurement Digest (Hex):");

    println!("{}", hex::encode(&digest));

    Ok(())
}
