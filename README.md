# GPT Protocol: Decentralized AI Infrastructure

## 1. Summary

GPT Protocol is a decentralized infrastructure framework designed to facilitate verifiable, privacy-preserving AI inference. It solves the "black box" problem of centralized AI APIs by bridging the **Internet Computer (IC)** blockchain with **AMD SEV-SNP (Secure Encrypted Virtualization-Secure Nested Paging)**.

Unlike traditional architectures where data is decrypted on a provider's server (exposing it to operators, logs, and potential breaches), GPT Protocol enforces a **Sovereign AI** model. User data is encrypted at the client edge and only decrypted within a hardware-attested Trusted Execution Environment (TEE), ensuring that neither the protocol developers nor the node operators can access user prompts, documents, or inference results.

This repository is a monorepo containing the full stack: the frontend client, the on-chain orchestration contracts, the hypervisor daemon, and the enclave-resident worker node.

## 2. Technical Architecture

The protocol implements a separation of concerns between **Orchestration**, **Storage**, and **Compute**.

### 2.1 Orchestration Layer (`gpt_index`)

* **Role**: Network Coordinator & Registry.
* **Implementation**: Rust Canister (IC).
* **Key Functions**:
  * **Node Registry**: Maintains a cryptographic registry of authorized compute nodes. Nodes must submit a signed SEV-SNP Attestation Report proving they are running the exact, unmodified `gpt_node` binary on authentic AMD EPYC hardware.
  * **Topology Management**: Enforces security policies, such as minimum TCB (Trusted Computing Base) versions for AMD firmware (Microcode, SNP, TEE).
  * **Single-Tenant Provisioning**: Upon user registration via Internet Identity, the Index spawns a dedicated `gpt_user` canister. This ensures strict data isolation; no two users share a storage contract.

### 2.2 Data Layer (`gpt_user`)

* **Role**: Encrypted Personal Vault.
* **Implementation**: Rust Canister (IC).
* **Storage Engine**: Built on `ic-stable-structures`. It bypasses the WASM heap limit by writing directly to the IC's stable memory, enabling multi-gigabyte storage per user.
* **Data Schema**:
  * **Chats & Messages**: Stored as encrypted blobs (`Vec<u8>`) using AES-256-GCM.
  * **Virtual File System**: A hierarchical structure (Folders/Files) storing metadata and chunked embeddings for RAG.
  * **Vector Store**: Stores high-dimensional embeddings associated with text chunks, facilitating semantic search without exposing plaintext to the blockchain.

### 2.3 Confidential Compute Layer (`gpt_host` & `gpt_node`)

The compute layer is split into the **Host** (untrusted) and the **Node** (trusted/enclave).

#### The Hypervisor Daemon (`gpt_host`)

* **Environment**: Linux Bare Metal.
* **Responsibilities**:
  * **Lifecycle Management**: Uses `systemd` to manage QEMU processes for guest VMs.
  * **Asset Integrity**: Verifies the hashes of the OVMF firmware, Kernel (`vmlinuz`), and Initial RAM Disk (`initrd`) before booting a guest.
  * **Ingress Routing**: Runs an `Axum` HTTP server acting as a reverse proxy. It inspects SNI/Host headers to route WebSocket connections to the correct local port (QEMU instance).

#### The Enclave Worker (`gpt_node`)

* **Environment**: Alpine Linux (Ramdisk) inside AMD SEV-SNP.
* **Security Context**:
  * **Memory Encryption**: All runtime memory is encrypted with a key unique to the CPU and the VM instance.
  * **Identity**: During boot, the node extracts a 32-byte seed injected into the `host_data` field of the attestation report. This seed derives the node's ephemeral cryptographic identity (Age/X25519), binding the keypair to the hardware measurement.
* **Operations**:
  * **Attestation**: Fetches VCEK (Versioned Chip Endorsement Key) from AMD's Key Distribution Service (KDS) to sign its report.
  * **Inference**: Decrypts user prompts in memory, communicates with AI backends (e.g., OpenAI, Local LLMs), and streams encrypted tokens back to the client via WebSockets.

---

## 3. Cryptographic Specification

GPT Protocol employs a "Double-Lock" encryption strategy to ensure privacy across the entire lifecycle.

### 3.1 Storage Encryption (The Vault)

Data stored on the IC is encrypted before it leaves the client browser.

* **Key Derivation**: `Argon2id` (v1.3) is used to derive a 256-bit **Root Key** from the user's local PIN and a random 16-byte salt stored in the `gpt_user` canister.
* **Validator**: An `Age`-encrypted string ("GPT-VALID") is stored on-chain to verify correct PIN entry without storing the key itself.
* **Persistence**: The Root Key is held in browser session memory and never transmitted.

### 3.2 Transport/Inference Encryption (The Session)

When a user initiates a chat, the system establishes a secure channel to the specific TEE node handling the request.

1. **Session Key**: The client generates a symmetric **Chat Key** (AES-256).
2. **Key Wrapping**: The client fetches the target node's hardware-attested X25519 public key from the Index. It uses `age-encryption` to wrap the Chat Key for that specific node.
3. **Transmission**: The wrapped key is sent to the `gpt_user` canister (as opaque data) and passed to the `gpt_node` via the job queue.
4. **Unwrapping**: Inside the enclave, `gpt_node` uses its private identity to unwrap the Chat Key.
5. **Streaming**: Response tokens are encrypted with the Chat Key (AES-256-GCM) and streamed over the WebSocket. Only the client possesses the key to decrypt the stream.

---

## 4. Repository Structure

The project is structured as a Cargo workspace with a TypeScript frontend.

```text
.
├── candid/                  # Canonical Interface Definitions (.did)
├── makefiles/               # Component-specific build logic
├── src/
│   ├── gpt_frontend/        # Next.js 16 Client (Zustand, Tailwind)
│   ├── gpt_index/           # Orchestrator Canister (Governance)
│   ├── gpt_user/            # Data Canister (Single-Tenant Storage)
│   ├── gpt_host/            # Host Daemon (Rust, systemd integration)
│   ├── gpt_node/            # Enclave Binary (Rust, Axum, Async-OpenAI)
│   ├── gpt_types/           # Shared Domain Types & Mappers
│   ├── gpt_measurement/     # CLI Tool for SEV-SNP Launch Measurement
│   └── gpt_vm/              # Dockerized OS Assembly (Alpine + Kernel)
└── dfx.json                 # IC Network Configuration
```

---

## 5. Deployment Guide: Developer (Local)

This workflow deploys the blockchain components to a local Internet Computer replica.

### Prerequisites

* **Rust Toolchain**: 1.93.0+ (stable).
  * Targets: `wasm32-unknown-unknown`, `x86_64-unknown-linux-musl`.
* **DFX SDK**: v0.24.0+.
* **Node.js**: v20+ & npm.
* **Docker**: Required for deterministic VM builds.

### Installation

1. **Clone and Setup**:

    ```bash
    git clone https://github.com/onecompany/gpt.git
    cd gpt
    make install_tools  # Installs candid-extractor, ic-wasm, audit tools
    npm install         # Installs frontend dependencies
    ```

2. **Deploy Canisters**:
    The `Makefile` orchestrates the build order (II -> Index -> User Wasm -> Frontend).

    ```bash
    # Terminal 1: Start local replica
    make start

    # Terminal 2: Build WASM, deploy, and run frontend
    make deploy
    npm run dev
    ```

3. **Access**:
    * Frontend: `http://localhost:3000` (or the local asset canister URL).
    * Internet Identity: `http://<canister_id>.localhost:4943`.

---

## 6. Deployment Guide: Node Operator (Compute)

Operating a node requires bare-metal Linux with AMD EPYC hardware.

### Hardware Requirements

* **CPU**: AMD EPYC™ 7003 (Milan), 9004 (Genoa), or newer.
* **BIOS**: SEV-SNP enabled. SMT (Simultaneous Multithreading) settings must match the protocol's governance policy (currently requires SMT=Disabled for maximum security).
* **OS**: Ubuntu 24.04 LTS or newer (Kernel 6.x+ required for KVM/SNP support).

### Building the Trusted Stack

We use a Dockerized "Clean Room" build process to ensure the binary and OS image are bitwise reproducible. This is critical for attestation.

```bash
# Builds gpt_node (musl), assembles initrd/kernel, builds gpt_host
make build_host
```

*Output Artifacts (`target/x86_64-unknown-linux-gnu/release/`):*

* `gpt_host`: The control daemon.
* `artifacts/vm/`: Contains `OVMF.fd`, `vmlinuz`, `initrd.gz`.

### Initialization

1. **Initialize Identity**:
    Generates the host's persistent identity seed (`/etc/gpt_host/host_seed.bin`).

    ```bash
    sudo ./gpt_host init
    ```

2. **Retrieve Public Identity**:
    You need the Chip ID and Public Key to register the node in the Frontend UI.

    ```bash
    sudo ./gpt_host id
    # Output:
    # Unique Chip ID: <hex string>
    # Host Identity: age1...
    ```

3. **Register via UI**:
    Navigate to the **Settings > Nodes** tab in the GPT Protocol frontend. Input the Chip ID, Identity, and endpoint (hostname).

4. **Launch Node**:

    ```bash
    # Create systemd service for Node #1 on port 8000
    sudo ./gpt_host add --node-id 1 --port 8000
    
    # Start the service
    sudo ./gpt_host start --node-id 1
    ```

---

## 7. Advanced Features

### 7.1 Confidential RAG (Retrieval-Augmented Generation)

The protocol moves vector search to the client edge and secure enclave to prevent server-side data leaks.

1. **Ingestion**: Files are uploaded via the Frontend.
2. **Local Embedding**: The browser uses WebGPU/WASM (`transformers.js`) to generate embeddings locally using `mxbai-embed-xsmall-v1`.
3. **Storage**: Embeddings are stored in the user's private `gpt_user` canister.
4. **Retrieval**: During a chat, the frontend performs a Hybrid Search (Vector + Keyword) to find relevant chunks.
5. **Inference**: Only the specific relevant text chunks are encrypted and sent to the `gpt_node` enclave for the LLM to process. The full document never leaves the user's control.

### 7.2 Secure OCR Pipeline

Processing PDFs usually requires sending the file to a third-party OCR API. GPT Protocol solves this:

1. **Conversion**: PDF pages are rendered to high-res images inside the browser (using `pdf.js`).
2. **Enclave Processing**: Images are encrypted and sent to the `gpt_node` TEE.
3. **Vision Model**: The node uses a Vision-Language Model (e.g., Qwen-VL or GPT-4o) to transcribe the image to Markdown, ensuring the document content remains confidential.

---

## 8. Verifiability & Measurement

For the network to trust a node, the node must prove it is running the *exact* open-source code in this repository.

### Launch Digest Calculation

The SEV-SNP Attestation Report contains a `MEASUREMENT` field (SHA-384 hash). This hash is calculated from the memory contents of the VM at boot time.

To verify a node or register a new valid measurement in the Governance system:

```bash
# Calculates the expected launch digest based on current artifacts
make measure
```

This tool:

1. Reads `OVMF.fd`, `vmlinuz`, and `initrd.gz`.
2. Simulates the SEV-SNP launch process.
3. Outputs the expected 48-byte (96 hex char) measurement string.

If a malicious operator modifies `gpt_node` (e.g., to log prompts), the resulting binary will change the `initrd` hash, changing the launch measurement. The `gpt_index` canister will reject the node's attestation report, preventing it from joining the network.

---

## 9. Governance

The `gpt_index` canister includes a governance module controlled by a set of **Managers**.

* **Attestation Policies**: Managers define the allowable TCB versions (e.g., ensuring nodes patch critical AMD firmware vulnerabilities like *Inception* or *Downfall*).
* **Measurement Registry**: Managers approve specific hashes of `gpt_node` versions. This allows the network to upgrade securely.
* **Model Whitelist**: Configuration of available AI models, pricing per token, and provider configurations.

---

## 10. License & Disclaimer

**License**: MIT.

**Disclaimer**: GPT Protocol utilizes cutting-edge Confidential Computing technologies. While SEV-SNP provides robust isolation, hardware vulnerabilities (side-channels) are an area of active research. This software is in Beta; use at your own risk.

---

**Maintained by**: GPT Protocol Dev Team. [Website](https://gpt.one) • [X](https://x.com/gpticp) • [GitHub](https://github.com/onecompany/gpt)
