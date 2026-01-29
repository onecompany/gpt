pub(super) fn abbreviate_hex(hex_str: &str, len: usize) -> String {
    let total_abbr_len = len.saturating_mul(2).saturating_add(3);

    if hex_str.len() <= total_abbr_len {
        hex_str.to_string()
    } else {
        let prefix = &hex_str[..len];
        let suffix = &hex_str[hex_str.len() - len..];
        format!("{}...{}", prefix, suffix)
    }
}
