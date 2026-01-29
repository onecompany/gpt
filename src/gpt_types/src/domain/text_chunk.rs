use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Deserialize, Clone, Debug, Serialize, PartialEq)]
pub struct TextChunk {
    pub chunk_index: u32,
    pub start_char: u32,
    pub end_char: u32,
    #[serde(with = "serde_bytes")]
    pub embedding: Vec<u8>,
}
