use serde::{Deserialize, Deserializer};

/// Custom deserializer that accepts both JSON Numbers and JSON Strings for u64 fields.
/// This ensures compatibility with JavaScript clients that stringify 64-bit integers
/// to avoid precision loss (SafeInteger limit).
fn deserialize_u64_from_string_or_number<'de, D>(deserializer: D) -> Result<u64, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum StringOrInt {
        String(String),
        Int(u64),
    }

    match StringOrInt::deserialize(deserializer)? {
        StringOrInt::String(s) => s.parse().map_err(serde::de::Error::custom),
        StringOrInt::Int(i) => Ok(i),
    }
}

/// WebSocket conversation request from the client.
#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConversationRequest {
    #[serde(deserialize_with = "deserialize_u64_from_string_or_number")]
    pub job_id: u64,
    pub user_canister_id: String,
}
