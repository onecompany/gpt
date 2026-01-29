use super::telemetry::HostTelemetry;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CheckStatus {
    Pass,
    Fail,
    Warning,
}

pub struct DiagnosticResult {
    pub name: &'static str,
    pub status: CheckStatus,
    pub detail: String,
}

pub fn evaluate_system(t: &HostTelemetry) -> Vec<DiagnosticResult> {
    let mut results = Vec::new();

    // 1. Device Node Access
    if t.sev.is_some() {
        results.push(DiagnosticResult {
            name: "/dev/sev access",
            status: CheckStatus::Pass,
            detail: "Accessible".to_string(),
        });
    } else {
        results.push(DiagnosticResult {
            name: "/dev/sev access",
            status: CheckStatus::Fail,
            detail: "Missing or permission denied".to_string(),
        });
    }

    // 2. KVM API
    if let Some(ver) = t.kvm_api_version {
        results.push(DiagnosticResult {
            name: "KVM API",
            status: CheckStatus::Pass,
            detail: format!("Version {}", ver),
        });
    } else {
        results.push(DiagnosticResult {
            name: "KVM API",
            status: CheckStatus::Fail,
            detail: "Missing /dev/kvm".to_string(),
        });
    }

    // 3. AMD SVM (Base Virtualization Support)
    if t.cpu.features.svm {
        results.push(DiagnosticResult {
            name: "AMD SVM",
            status: CheckStatus::Pass,
            detail: "Enabled".to_string(),
        });
    } else {
        results.push(DiagnosticResult {
            name: "AMD SVM",
            status: CheckStatus::Fail,
            detail: "Disabled in BIOS/CPU".to_string(),
        });
    }

    // 4. Hardware Features (SME/SEV/ES/SNP)
    let features_ok =
        t.cpu.features.sme && t.cpu.features.sev && t.cpu.features.sev_es && t.cpu.features.snp;

    if features_ok {
        results.push(DiagnosticResult {
            name: "AMD Features",
            status: CheckStatus::Pass,
            detail: "SME+SEV+ES+SNP Enabled".to_string(),
        });
    } else {
        let mut missing = Vec::new();
        if !t.cpu.features.sme {
            missing.push("SME");
        }
        if !t.cpu.features.sev {
            missing.push("SEV");
        }
        if !t.cpu.features.sev_es {
            missing.push("SEV-ES");
        }
        if !t.cpu.features.snp {
            missing.push("SNP");
        }
        results.push(DiagnosticResult {
            name: "AMD Features",
            status: CheckStatus::Fail,
            detail: format!("Missing: {}", missing.join(", ")),
        });
    }

    // 5. IOMMU / ASID
    if t.cpu.phys_addr_bits >= 40 && t.cpu.c_bit > 40 {
        results.push(DiagnosticResult {
            name: "Memory/C-Bit",
            status: CheckStatus::Pass,
            detail: format!("Phys:{} C:{}", t.cpu.phys_addr_bits, t.cpu.c_bit),
        });
    } else {
        results.push(DiagnosticResult {
            name: "Memory/C-Bit",
            status: CheckStatus::Fail,
            detail: "Invalid addressing config".to_string(),
        });
    }

    // 6. ASID Range
    if t.cpu.max_encrypted_guests > 0 {
        results.push(DiagnosticResult {
            name: "ASID Capacity",
            status: CheckStatus::Pass,
            detail: format!("{} guests", t.cpu.max_encrypted_guests),
        });
    } else {
        results.push(DiagnosticResult {
            name: "ASID Capacity",
            status: CheckStatus::Fail,
            detail: "Zero encrypted guests supported".to_string(),
        });
    }

    // 7. RMP Validity (only if SEV info available)
    if let Some(sev) = &t.sev {
        if sev.rmp_base > 0 && sev.rmp_end > sev.rmp_base {
            results.push(DiagnosticResult {
                name: "RMP Table",
                status: CheckStatus::Pass,
                detail: "Valid range".to_string(),
            });
        } else {
            results.push(DiagnosticResult {
                name: "RMP Table",
                status: CheckStatus::Fail,
                detail: "Invalid or zero range".to_string(),
            });
        }

        // 8. Initialization Status
        if sev.platform_status.is_rmp_init.is_rmp_init() {
            results.push(DiagnosticResult {
                name: "RMP Init",
                status: CheckStatus::Pass,
                detail: "Initialized".to_string(),
            });
        } else {
            results.push(DiagnosticResult {
                name: "RMP Init",
                status: CheckStatus::Fail,
                detail: "Not Initialized".to_string(),
            });
        }

        // 9. TCB Consistency
        if sev.platform_status.platform_tcb_version == sev.platform_status.reported_tcb_version {
            results.push(DiagnosticResult {
                name: "TCB Sync",
                status: CheckStatus::Pass,
                detail: "Consistent".to_string(),
            });
        } else {
            results.push(DiagnosticResult {
                name: "TCB Sync",
                status: CheckStatus::Warning,
                detail: "Platform/Reported mismatch".to_string(),
            });
        }
    } else {
        // Add placeholders if SEV driver failed
        results.push(DiagnosticResult {
            name: "RMP Table",
            status: CheckStatus::Fail,
            detail: "Driver unavailable".to_string(),
        });
    }

    // 10. QEMU Version
    if t.qemu.major > 10 || (t.qemu.major == 10 && t.qemu.minor >= 1) {
        results.push(DiagnosticResult {
            name: "QEMU Version",
            status: CheckStatus::Pass,
            detail: t.qemu.version_string.clone(),
        });
    } else {
        results.push(DiagnosticResult {
            name: "QEMU Version",
            status: CheckStatus::Fail,
            detail: format!("Found {}, need >= 10.1", t.qemu.version_string),
        });
    }

    results
}
