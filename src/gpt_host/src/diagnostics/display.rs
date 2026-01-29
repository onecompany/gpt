use super::checks::{CheckStatus, DiagnosticResult};
use super::telemetry::HostTelemetry;
use colorful::Colorful;
use sev::firmware::host::SnpPlatformStatus;

pub fn render_dashboard(t: &HostTelemetry, checks: &[DiagnosticResult]) {
    // 1. Host System Information
    println!("{}", "Host System Information".bold());
    print_kv("CPU Vendor", &t.cpu.vendor);
    print_kv("CPU Model", &t.cpu.model_display);
    print_kv("Microcode", &t.cpu.microcode);
    print_kv("Physical Address Bits", &t.cpu.phys_addr_bits.to_string());
    print_kv("C-Bit Position", &t.cpu.c_bit.to_string());
    print_kv(
        "Max Encrypted Guests",
        &t.cpu.max_encrypted_guests.to_string(),
    );

    // Detailed CPU Features
    print_kv("Feature: SVM", &format_bool(t.cpu.features.svm));
    print_kv("Feature: SME", &format_bool(t.cpu.features.sme));
    print_kv("Feature: SEV", &format_bool(t.cpu.features.sev));
    print_kv("Feature: SEV-ES", &format_bool(t.cpu.features.sev_es));
    print_kv("Feature: SEV-SNP", &format_bool(t.cpu.features.snp));

    // Memory limits
    let soft_mb = t.memory.memlock_soft / 1024 / 1024;
    let hard_mb = t.memory.memlock_hard / 1024 / 1024;
    print_kv(
        "Memlock Limit (Soft)",
        &format!("{} bytes ({} MB)", t.memory.memlock_soft, soft_mb),
    );
    print_kv(
        "Memlock Limit (Hard)",
        &format!("{} bytes ({} MB)", t.memory.memlock_hard, hard_mb),
    );

    // Software Versions
    print_kv("Kernel Version", &t.kernel.version_string);
    print_kv("QEMU Version", &t.qemu.version_string);
    if let Some(kvm) = t.kvm_api_version {
        print_kv("KVM API Version", &kvm.to_string());
    } else {
        print_kv("KVM API Version", "Not Available");
    }
    println!();

    // 2. SEV-SNP Firmware Status
    println!("{}", "SEV-SNP Firmware Status".bold());
    if let Some(sev) = &t.sev {
        print_kv("Platform State", &format_state(sev.platform_status.state));
        print_kv(
            "API Version",
            &format!(
                "{}.{}",
                sev.platform_status.version.0, sev.platform_status.version.1
            ),
        );
        print_kv(
            "Firmware Build ID",
            &sev.platform_status.build_id.to_string(),
        );
        print_kv(
            "Current Guest Count",
            &sev.platform_status.guest_count.to_string(),
        );

        // RMP Configuration
        print_kv("RMP Base Address", &format!("0x{:016X}", sev.rmp_base));
        print_kv("RMP End Address", &format!("0x{:016X}", sev.rmp_end));
        print_kv(
            "RMP Size",
            &format!("{} MB", (sev.rmp_end - sev.rmp_base + 1) / 1024 / 1024),
        );

        // Flags
        print_kv(
            "RMP Initialized",
            &format_bool(sev.platform_status.is_rmp_init.is_rmp_init()),
        );
        print_kv(
            "Alias Check Done",
            &format_bool(sev.platform_status.is_rmp_init.alias_check_complete()),
        );

        // Identity
        print_kv("Chip ID", &sev.chip_id);
    } else {
        println!(
            "  {}",
            "SEV Firmware interface unavailable (check /dev/sev permissions)".red()
        );
    }
    println!();

    // 3. TCB Version Detail
    if let Some(sev) = &t.sev {
        println!("{}", "TCB Version Details".bold());
        print_tcb_comparison(&sev.platform_status);
        println!();
    }

    // 4. Runtime Diagnostics
    println!("{}", "Runtime Diagnostics".bold());
    for check in checks {
        let status_str = match check.status {
            CheckStatus::Pass => "PASS".green(),
            CheckStatus::Fail => "FAIL".red(),
            CheckStatus::Warning => "WARN".yellow(),
        };
        // Format: [STATUS] Name: Detail
        println!("  [{}] {}: {}", status_str, check.name, check.detail);
    }
    println!();

    // Final Summary
    let failures = checks
        .iter()
        .filter(|c| c.status == CheckStatus::Fail)
        .count();
    if failures == 0 {
        println!("{}", "System Status: READY".green().bold());
    } else {
        println!(
            "{}",
            format!("System Status: NOT READY ({} failures)", failures)
                .red()
                .bold()
        );
    }
}

fn print_kv(key: &str, value: &str) {
    println!("  {:<24}: {}", key, value);
}

fn format_bool(val: bool) -> String {
    if val {
        "Enabled".green().to_string()
    } else {
        "Disabled".red().to_string()
    }
}

fn format_state(state: u8) -> String {
    match state {
        0 => "UNINITIALIZED".red().to_string(),
        1 => "INITIALIZED".yellow().to_string(),
        2 => "WORKING".green().to_string(),
        _ => format!("UNKNOWN ({})", state),
    }
}

fn print_tcb_comparison(status: &SnpPlatformStatus) {
    print_tcb_component(
        "Bootloader",
        status.platform_tcb_version.bootloader,
        status.reported_tcb_version.bootloader,
    );
    print_tcb_component(
        "TEE",
        status.platform_tcb_version.tee,
        status.reported_tcb_version.tee,
    );
    print_tcb_component(
        "SNP",
        status.platform_tcb_version.snp,
        status.reported_tcb_version.snp,
    );
    print_tcb_component(
        "Microcode",
        status.platform_tcb_version.microcode,
        status.reported_tcb_version.microcode,
    );

    // Always print FMC if platform reports it, otherwise check reported
    if let Some(plat_fmc) = status.platform_tcb_version.fmc {
        let rep_fmc = status.reported_tcb_version.fmc.unwrap_or(0);
        print_tcb_component("FMC", plat_fmc, rep_fmc);
    } else if let Some(rep_fmc) = status.reported_tcb_version.fmc {
        print_tcb_component("FMC", 0, rep_fmc);
    }
}

fn print_tcb_component(name: &str, platform: u8, reported: u8) {
    let status = if platform == reported {
        "MATCH".green()
    } else if platform > reported {
        "DOWNGRADE".yellow()
    } else {
        "UPGRADE".red()
    };

    println!(
        "  {:<24}: Platform={:<3} Reported={:<3} [{}]",
        name, platform, reported, status
    );
}
