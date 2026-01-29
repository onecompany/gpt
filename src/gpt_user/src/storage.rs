use candid::{CandidType, Deserialize, Principal};
use gpt_types::domain::node::LocalNode;
use gpt_types::domain::{Chat, FileId, FileMetadata, Folder, FolderId, Job, JobId, Message, Model};
use gpt_types::prelude::NodeId;
use ic_stable_structures::{
    DefaultMemoryImpl, StableBTreeMap, StableCell, Storable,
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    storable::Bound,
};
use serde::Serialize;
use std::borrow::Cow;
use std::cell::RefCell;
use std::ops::{Deref, DerefMut};

// --- Memory ID Allocation ---
const MEMORY_ID_CONFIG: MemoryId = MemoryId::new(0);
const MEMORY_ID_CHATS: MemoryId = MemoryId::new(1);
const MEMORY_ID_MESSAGES: MemoryId = MemoryId::new(2);
const MEMORY_ID_JOBS: MemoryId = MemoryId::new(3);
const MEMORY_ID_FOLDERS: MemoryId = MemoryId::new(4);
const MEMORY_ID_FILES_METADATA: MemoryId = MemoryId::new(5);
const MEMORY_ID_FILES_CONTENT: MemoryId = MemoryId::new(6);
const MEMORY_ID_NODES: MemoryId = MemoryId::new(7);
const MEMORY_ID_MODELS: MemoryId = MemoryId::new(8);
const MEMORY_ID_FOLDER_INDEX: MemoryId = MemoryId::new(9);

type Memory = VirtualMemory<DefaultMemoryImpl>;

// --- Storable Wrappers ---

/// Generic wrapper to make any Candid-serializable type Storable.
#[derive(Default, Clone, Debug)]
pub struct CandidWrapper<T>(pub T)
where
    T: CandidType + for<'a> Deserialize<'a>;

impl<T> Storable for CandidWrapper<T>
where
    T: CandidType + for<'a> Deserialize<'a>,
{
    fn to_bytes(&self) -> Cow<'_, [u8]> {
        Cow::Owned(candid::encode_one(&self.0).expect("Failed to encode"))
    }

    fn into_bytes(self) -> Vec<u8> {
        candid::encode_one(&self.0).expect("Failed to encode")
    }

    fn from_bytes(bytes: Cow<'_, [u8]>) -> Self {
        Self(candid::decode_one(&bytes).expect("Failed to decode"))
    }

    const BOUND: Bound = Bound::Unbounded;
}

impl<T> Deref for CandidWrapper<T>
where
    T: CandidType + for<'a> Deserialize<'a>,
{
    type Target = T;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl<T> DerefMut for CandidWrapper<T>
where
    T: CandidType + for<'a> Deserialize<'a>,
{
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

/// Storable String Key wrapper for model IDs
#[derive(Clone, PartialEq, Eq, PartialOrd, Ord, Debug)]
pub struct StorableString(pub String);

impl Storable for StorableString {
    fn to_bytes(&self) -> Cow<'_, [u8]> {
        Cow::Owned(self.0.as_bytes().to_vec())
    }

    fn into_bytes(self) -> Vec<u8> {
        self.0.into_bytes()
    }

    fn from_bytes(bytes: Cow<'_, [u8]>) -> Self {
        Self(String::from_utf8(bytes.to_vec()).expect("Invalid UTF-8"))
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 256,
        is_fixed_size: false,
    };
}

// --- Canister Configuration (Single User) ---

/// Consolidated configuration for the single-user canister.
/// Replaces all the separate RefCell counters and user storage.
#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct CanisterConfig {
    /// THE single user bound to this canister (None = unbound)
    pub owner: Option<Principal>,
    /// The parent gpt_index canister
    pub parent_canister: Option<Principal>,
    /// When the user registered
    pub registered_at: u64,
    /// Vault encryption salt (16+ bytes for Argon2id)
    pub enc_salt: Option<Vec<u8>>,
    /// Vault validator (Age-encrypted PIN validator)
    pub enc_validator: Option<String>,
    /// User's root folder ID
    pub root_folder_id: Option<FolderId>,
    /// Next chat ID counter
    pub next_chat_id: u64,
    /// Next message ID counter
    pub next_message_id: u64,
    /// Next job ID counter
    pub next_job_id: JobId,
    /// Next folder ID counter
    pub next_folder_id: FolderId,
    /// Next file ID counter
    pub next_file_id: FileId,
}

impl Default for CanisterConfig {
    fn default() -> Self {
        Self {
            owner: None,
            parent_canister: None,
            registered_at: 0,
            enc_salt: None,
            enc_validator: None,
            root_folder_id: None,
            next_chat_id: 1,
            next_message_id: 1,
            next_job_id: 1,
            next_folder_id: 1,
            next_file_id: 1,
        }
    }
}

// --- Folder Contents Index Value ---

/// Stores the child folder IDs and file IDs for a folder.
#[derive(CandidType, Deserialize, Serialize, Default, Clone, Debug)]
pub struct FolderContents {
    pub child_folder_ids: Vec<FolderId>,
    pub child_file_ids: Vec<FileId>,
}

// --- Storage Definition ---

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    // ============================================
    // STABLE MEMORY (Persists across upgrades)
    // ============================================

    /// Core configuration: owner, counters, vault data
    pub static CONFIG: RefCell<StableCell<CandidWrapper<CanisterConfig>, Memory>> = RefCell::new(
        StableCell::new(
            MEMORY_MANAGER.with(|m| m.borrow().get(MEMORY_ID_CONFIG)),
            CandidWrapper(CanisterConfig::default()),
        )
    );

    /// Chat storage: chat_id -> Chat
    pub static CHATS: RefCell<StableBTreeMap<u64, CandidWrapper<Chat>, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MEMORY_ID_CHATS)))
    );

    /// Message storage: message_id -> Message
    pub static MESSAGES: RefCell<StableBTreeMap<u64, CandidWrapper<Message>, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MEMORY_ID_MESSAGES)))
    );

    /// Job storage: job_id -> Job
    pub static CHAT_JOBS: RefCell<StableBTreeMap<JobId, CandidWrapper<Job>, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MEMORY_ID_JOBS)))
    );

    /// Folder storage: folder_id -> Folder
    pub static FOLDERS: RefCell<StableBTreeMap<FolderId, CandidWrapper<Folder>, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MEMORY_ID_FOLDERS)))
    );

    /// File metadata storage: file_id -> FileMetadata
    pub static FILES_METADATA: RefCell<StableBTreeMap<FileId, CandidWrapper<FileMetadata>, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MEMORY_ID_FILES_METADATA)))
    );

    /// File content storage: file_id -> Vec<u8>
    pub static FILES_CONTENT: RefCell<StableBTreeMap<FileId, CandidWrapper<Vec<u8>>, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MEMORY_ID_FILES_CONTENT)))
    );

    /// Node cache (synced from gpt_index): node_id -> LocalNode
    pub static NODES: RefCell<StableBTreeMap<NodeId, CandidWrapper<LocalNode>, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MEMORY_ID_NODES)))
    );

    /// Model cache (synced from gpt_index): model_id -> Model
    pub static MODELS: RefCell<StableBTreeMap<StorableString, CandidWrapper<Model>, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MEMORY_ID_MODELS)))
    );

    /// Folder contents index: folder_id -> FolderContents
    pub static FOLDER_CONTENTS_INDEX: RefCell<StableBTreeMap<FolderId, CandidWrapper<FolderContents>, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MEMORY_ID_FOLDER_INDEX)))
    );
}

// --- Helper Functions for CONFIG Access ---

/// Gets the next chat ID and increments the counter
pub fn get_next_chat_id() -> u64 {
    CONFIG.with(|c| {
        let mut cell = c.borrow_mut();
        let mut config = cell.get().0.clone();
        let id = config.next_chat_id;
        config.next_chat_id += 1;
        let _ = cell.set(CandidWrapper(config));
        id
    })
}

/// Gets the next message ID and increments the counter
pub fn get_next_message_id() -> u64 {
    CONFIG.with(|c| {
        let mut cell = c.borrow_mut();
        let mut config = cell.get().0.clone();
        let id = config.next_message_id;
        config.next_message_id += 1;
        let _ = cell.set(CandidWrapper(config));
        id
    })
}

/// Gets the next job ID and increments the counter
pub fn get_next_job_id() -> JobId {
    CONFIG.with(|c| {
        let mut cell = c.borrow_mut();
        let mut config = cell.get().0.clone();
        let id = config.next_job_id;
        config.next_job_id += 1;
        let _ = cell.set(CandidWrapper(config));
        id
    })
}

/// Gets the next folder ID and increments the counter
pub fn get_next_folder_id() -> FolderId {
    CONFIG.with(|c| {
        let mut cell = c.borrow_mut();
        let mut config = cell.get().0.clone();
        let id = config.next_folder_id;
        config.next_folder_id += 1;
        let _ = cell.set(CandidWrapper(config));
        id
    })
}

/// Gets the next file ID and increments the counter
pub fn get_next_file_id() -> FileId {
    CONFIG.with(|c| {
        let mut cell = c.borrow_mut();
        let mut config = cell.get().0.clone();
        let id = config.next_file_id;
        config.next_file_id += 1;
        let _ = cell.set(CandidWrapper(config));
        id
    })
}

/// Gets the owner principal (if bound)
pub fn get_owner() -> Option<Principal> {
    CONFIG.with(|c| c.borrow().get().0.owner)
}

/// Gets the parent canister principal
pub fn get_parent_canister() -> Option<Principal> {
    CONFIG.with(|c| c.borrow().get().0.parent_canister)
}

/// Gets the root folder ID (if exists)
pub fn get_root_folder_id() -> Option<FolderId> {
    CONFIG.with(|c| c.borrow().get().0.root_folder_id)
}

/// Sets the parent canister (called during init)
pub fn set_parent_canister(parent: Principal) {
    CONFIG.with(|c| {
        let mut cell = c.borrow_mut();
        let mut config = cell.get().0.clone();
        config.parent_canister = Some(parent);
        let _ = cell.set(CandidWrapper(config));
    });
}

/// Binds the canister to a single owner (called during finalize_registration)
/// Returns false if already bound to a different owner
pub fn bind_owner(owner: Principal, enc_salt: Vec<u8>, enc_validator: String) -> bool {
    CONFIG.with(|c| {
        let mut cell = c.borrow_mut();
        let mut config = cell.get().0.clone();

        // Check if already bound
        if let Some(existing_owner) = config.owner {
            return existing_owner == owner;
        }

        config.owner = Some(owner);
        config.registered_at = ic_cdk::api::time();
        config.enc_salt = Some(enc_salt);
        config.enc_validator = Some(enc_validator);
        let _ = cell.set(CandidWrapper(config));
        true
    })
}

/// Sets the root folder ID
pub fn set_root_folder_id(folder_id: FolderId) {
    CONFIG.with(|c| {
        let mut cell = c.borrow_mut();
        let mut config = cell.get().0.clone();
        config.root_folder_id = Some(folder_id);
        let _ = cell.set(CandidWrapper(config));
    });
}

/// Gets the full canister config (for whoami, etc.)
pub fn get_config() -> CanisterConfig {
    CONFIG.with(|c| c.borrow().get().0.clone())
}
