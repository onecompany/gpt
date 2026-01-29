use anyhow::Result;
use msru::{Accessor, Msr};
use regex::Regex;
use sev::firmware::host::{Firmware, SnpPlatformStatus};
use std::arch::x86_64::__cpuid;
use std::fs;
use std::os::fd::AsRawFd;
use std::path::Path;
use std::process::Command;

/// Aggregated telemetry data for the host system.
#[derive(Debug)]
pub struct HostTelemetry {
    pub cpu: CpuInfo,
    pub kernel: KernelInfo,
    pub qemu: QemuInfo,
    pub sev: Option<SevInfo>,
    pub memory: MemoryInfo,
    pub kvm_api_version: Option<i32>,
}

#[derive(Debug)]
pub struct CpuInfo {
    pub vendor: String,
    pub model_display: String,
    pub microcode: String,
    pub phys_addr_bits: u8,
    pub c_bit: u8,
    pub max_encrypted_guests: u32,
    pub features: CpuFeatures,
}

#[derive(Debug)]
pub struct CpuFeatures {
    pub sme: bool,
    pub sev: bool,
    pub sev_es: bool,
    pub snp: bool,
    pub svm: bool,
}

#[derive(Debug)]
pub struct KernelInfo {
    pub version_string: String,
}

#[derive(Debug)]
pub struct QemuInfo {
    pub version_string: String,
    pub major: u32,
    pub minor: u32,
}

#[derive(Debug)]
pub struct SevInfo {
    pub platform_status: SnpPlatformStatus,
    pub chip_id: String,
    pub rmp_base: u64,
    pub rmp_end: u64,
}

#[derive(Debug)]
pub struct MemoryInfo {
    pub memlock_soft: u64,
    pub memlock_hard: u64,
}

pub fn gather_host_telemetry() -> Result<HostTelemetry> {
    let cpu = gather_cpu_info();
    let kernel = gather_kernel_info();
    let qemu = gather_qemu_info();
    let sev = gather_sev_info();
    let memory = gather_memory_info();
    let kvm_api_version = check_kvm_api();

    Ok(HostTelemetry {
        cpu,
        kernel,
        qemu,
        sev,
        memory,
        kvm_api_version,
    })
}

fn gather_cpu_info() -> CpuInfo {
    // 1. Vendor
    let cpuid0 = unsafe { __cpuid(0) };
    let mut vendor = [0u8; 12];
    vendor[0..4].copy_from_slice(&cpuid0.ebx.to_le_bytes());
    vendor[4..8].copy_from_slice(&cpuid0.edx.to_le_bytes());
    vendor[8..12].copy_from_slice(&cpuid0.ecx.to_le_bytes());
    let vendor_str = String::from_utf8_lossy(&vendor).trim().to_string();

    // 2. Microcode & Model (Leaves 0x80000002-4)
    let mut brand_bytes = Vec::with_capacity(48);
    for leaf in 0x8000_0002_u32..=0x8000_0004_u32 {
        let cp = unsafe { __cpuid(leaf) };
        brand_bytes.extend_from_slice(&cp.eax.to_le_bytes());
        brand_bytes.extend_from_slice(&cp.ebx.to_le_bytes());
        brand_bytes.extend_from_slice(&cp.ecx.to_le_bytes());
        brand_bytes.extend_from_slice(&cp.edx.to_le_bytes());
    }
    let model_display = String::from_utf8_lossy(&brand_bytes).trim().to_string();

    // 3. Features & Limits (Leaf 0x8000001F)
    let ext_cpuid = unsafe { __cpuid(0x8000_001F) };
    let sme = (ext_cpuid.eax & 1) == 1;
    let sev = ((ext_cpuid.eax >> 1) & 1) == 1;
    let sev_es = ((ext_cpuid.eax >> 3) & 1) == 1;
    let snp = ((ext_cpuid.eax >> 4) & 1) == 1;
    let phys_addr_bits = ((ext_cpuid.eax >> 6) & 0b111111) as u8;
    let c_bit = (ext_cpuid.ebx & 0b11_1111) as u8;
    let max_encrypted_guests = ext_cpuid.ecx;

    // SVM Check (Leaf 0x80000001)
    let svm_cpuid = unsafe { __cpuid(0x8000_0001) };
    let svm = ((svm_cpuid.ecx >> 2) & 1) == 1;

    // Actual microcode patch level usually requires reading MSR 0x8B after writing 0 to it,
    // but reading cpuid(1).eax gives Stepping/Model/Family.
    // For specific microcode version, we read /proc/cpuinfo or similar, but here we construct
    // a "Family-Model-Stepping" string as "Microcode" signature for identification.
    let cpuid1 = unsafe { __cpuid(1) };
    let stepping = cpuid1.eax & 0xF;
    let base_model = (cpuid1.eax >> 4) & 0xF;
    let base_family = (cpuid1.eax >> 8) & 0xF;
    let ext_model = (cpuid1.eax >> 16) & 0xF;
    let ext_family = (cpuid1.eax >> 20) & 0xFF;

    let family = if base_family == 15 {
        base_family + ext_family
    } else {
        base_family
    };
    let model = if base_family == 15 || base_family == 6 {
        (ext_model << 4) | base_model
    } else {
        base_model
    };

    let microcode_sig = format!("{:03X}-{:02X}-{:02X}", family, model, stepping);

    CpuInfo {
        vendor: vendor_str,
        model_display,
        microcode: microcode_sig,
        phys_addr_bits,
        c_bit,
        max_encrypted_guests,
        features: CpuFeatures {
            sme,
            sev,
            sev_es,
            snp,
            svm,
        },
    }
}

fn gather_kernel_info() -> KernelInfo {
    let version_string = fs::read_to_string("/proc/version")
        .unwrap_or_else(|_| "Unknown".to_string())
        .split(" (")
        .next()
        .unwrap_or("Unknown")
        .to_string();

    KernelInfo { version_string }
}

fn gather_qemu_info() -> QemuInfo {
    let output = Command::new("/usr/bin/qemu-system-x86_64")
        .arg("--version")
        .output();

    match output {
        Ok(o) if o.status.success() => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            let re = Regex::new(r"version (\d+)\.(\d+)").unwrap();
            if let Some(caps) = re.captures(&stdout) {
                let major = caps[1].parse().unwrap_or(0);
                let minor = caps[2].parse().unwrap_or(0);
                return QemuInfo {
                    version_string: format!("{}.{}", major, minor),
                    major,
                    minor,
                };
            }
        }
        _ => {}
    }

    QemuInfo {
        version_string: "Not Found".to_string(),
        major: 0,
        minor: 0,
    }
}

fn gather_sev_info() -> Option<SevInfo> {
    let mut fw = Firmware::open().ok()?;
    let status = fw.snp_platform_status().ok()?;

    let id = fw.get_identifier().ok()?;
    let chip_id = hex::encode(id.0);

    // Read RMP Base/End MSRs
    // MSR_AMD64_RMP_BASE = 0xC0010132
    // MSR_AMD64_RMP_END  = 0xC0010133
    let rmp_base = Msr::new(0xC001_0132, 0)
        .and_then(|mut m| m.read())
        .unwrap_or(0);
    let rmp_end = Msr::new(0xC001_0133, 0)
        .and_then(|mut m| m.read())
        .unwrap_or(0);

    Some(SevInfo {
        platform_status: status,
        chip_id,
        rmp_base,
        rmp_end,
    })
}

fn gather_memory_info() -> MemoryInfo {
    let mut limits = libc::rlimit {
        rlim_cur: 0,
        rlim_max: 0,
    };
    unsafe { libc::getrlimit(libc::RLIMIT_MEMLOCK, &mut limits as *mut _) };

    MemoryInfo {
        memlock_soft: limits.rlim_cur,
        memlock_hard: limits.rlim_max,
    }
}

fn check_kvm_api() -> Option<i32> {
    let path = Path::new("/dev/kvm");
    if !path.exists() {
        return None;
    }

    let file = fs::File::open(path).ok()?;
    let api_version = unsafe { libc::ioctl(file.as_raw_fd(), 0xAE00, 0) };
    if api_version >= 0 {
        Some(api_version)
    } else {
        None
    }
}
