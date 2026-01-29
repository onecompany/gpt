use std::time::Duration;

pub(super) const KDS_BASE_URL: &str = "https://kdsintf.amd.com";
pub(super) const KDS_RETRY_DELAY: Duration = Duration::from_secs(5);
pub(super) const KDS_TIMEOUT: Duration = Duration::from_secs(300);
pub(super) const P384_SCALAR_SIZE: usize = 48;
pub(super) const SIGNED_DATA_LEN: usize = 672;
