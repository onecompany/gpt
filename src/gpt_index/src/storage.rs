use candid::{CandidType, Deserialize, Principal};
use gpt_types::{
    api::common::CanisterPoolEntry,
    domain::{Model, Node, User, node::AttestationRequirements},
};
use ic_stable_structures::{
    DefaultMemoryImpl, StableBTreeMap, StableCell, Storable,
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    storable::Bound,
};
use std::borrow::Cow;
use std::cell::RefCell;
use std::collections::{BTreeMap, BTreeSet};
use std::ops::{Deref, DerefMut};

// --- Memory ID Allocation ---
const MEMORY_ID_CONFIG: MemoryId = MemoryId::new(0);
const MEMORY_ID_USERS: MemoryId = MemoryId::new(1);
const MEMORY_ID_NODES: MemoryId = MemoryId::new(2);
const MEMORY_ID_MODELS: MemoryId = MemoryId::new(3);
const MEMORY_ID_USER_CANISTERS: MemoryId = MemoryId::new(4);
const MEMORY_ID_MANAGERS: MemoryId = MemoryId::new(5);

type Memory = VirtualMemory<DefaultMemoryImpl>;

// --- Storable Wrappers ---

// Generic wrapper to make any Candid-serializable type Storable.
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

// Wrapper for Principal keys to implement Storable + Ord
#[derive(Clone, PartialEq, Eq, PartialOrd, Ord, Debug)]
pub struct StorablePrincipal(pub Principal);

impl Storable for StorablePrincipal {
    fn to_bytes(&self) -> Cow<'_, [u8]> {
        Cow::Owned(self.0.as_slice().to_vec())
    }

    fn from_bytes(bytes: Cow<'_, [u8]>) -> Self {
        Self(Principal::from_slice(&bytes))
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 29,
        is_fixed_size: false,
    };
}

// --- Global Config ---
#[derive(CandidType, Deserialize, Default, Clone)]
pub struct GlobalConfig {
    pub next_user_id: u64,
    pub next_node_id: u64,
    pub attestation_requirements: Option<AttestationRequirements>,
    pub pool_target_size: u32,
}

// --- Storage Definition ---

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    // Canonical State (Stable Memory)

    pub static CONFIG: RefCell<StableCell<CandidWrapper<GlobalConfig>, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MEMORY_ID_CONFIG)),
            CandidWrapper(GlobalConfig::default()),
        ).expect("Failed to init config")
    );

    pub static USERS: RefCell<StableBTreeMap<StorablePrincipal, CandidWrapper<User>, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MEMORY_ID_USERS))
        )
    );

    pub static NODES: RefCell<StableBTreeMap<u64, CandidWrapper<Node>, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MEMORY_ID_NODES))
        )
    );

    pub static MODELS: RefCell<StableBTreeMap<String, CandidWrapper<Model>, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MEMORY_ID_MODELS))
        )
    );

    pub static CANISTER_POOL: RefCell<StableBTreeMap<StorablePrincipal, CandidWrapper<CanisterPoolEntry>, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MEMORY_ID_USER_CANISTERS))
        )
    );

    pub static MANAGERS: RefCell<StableBTreeMap<StorablePrincipal, (), Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MEMORY_ID_MANAGERS))
        )
    );

    // Derived Indexes (Heap Memory - Rebuilt on Upgrade)

    pub static NODE_OWNER_INDEX: RefCell<BTreeMap<Principal, BTreeSet<u64>>> = const { RefCell::new(BTreeMap::new()) };
    pub static NODE_PRINCIPAL_INDEX: RefCell<BTreeMap<Principal, u64>> = const { RefCell::new(BTreeMap::new()) };

    // Tracks Pending users for GC. Maps User Principal -> Timestamp (ns)
    pub static PENDING_USERS: RefCell<BTreeMap<Principal, u64>> = const { RefCell::new(BTreeMap::new()) };

    // Pool management indexes (Heap Memory - Rebuilt on Upgrade)
    // Tracks canisters available in the pool (no code installed)
    pub static AVAILABLE_CANISTERS: RefCell<BTreeSet<Principal>> = const { RefCell::new(BTreeSet::new()) };
    // Tracks trial canisters with their expiry times. Maps Canister Principal -> Expiry Timestamp (ns)
    pub static TRIAL_EXPIRIES: RefCell<BTreeMap<Principal, u64>> = const { RefCell::new(BTreeMap::new()) };
}
