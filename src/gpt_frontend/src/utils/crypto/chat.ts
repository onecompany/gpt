import * as age from "age-encryption";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";

// Standard AES-GCM IV length
const IV_LENGTH = 12;

export class ChatCrypto {
  /**
   * Generates a secure random 32-byte salt for a new chat.
   */
  static generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(32));
  }

  /**
   * Derives a symmetric AES-256 chat key from the user's root secret and the chat's salt.
   */
  static async deriveChatKey(
    rootKeyHex: string,
    salt: Uint8Array,
  ): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const ikm = encoder.encode(rootKeyHex);
    const info = encoder.encode("gpt_chat_v1");

    const derivedKeyBytes = hkdf(sha256, ikm, salt, info, 32);

    return await window.crypto.subtle.importKey(
      "raw",
      derivedKeyBytes as unknown as BufferSource,
      { name: "AES-GCM" },
      true,
      ["encrypt", "decrypt"],
    );
  }

  /**
   * Encrypts a plaintext string into a packed byte array.
   */
  static async encryptMessage(
    text: string,
    key: CryptoKey,
  ): Promise<Uint8Array> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encoded = new TextEncoder().encode(text);

    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encoded,
    );

    const ciphertext = new Uint8Array(ciphertextBuffer);
    const packed = new Uint8Array(iv.length + ciphertext.length);
    packed.set(iv, 0);
    packed.set(ciphertext, iv.length);

    return packed;
  }

  /**
   * Decrypts a packed byte array.
   */
  static async decryptMessage(
    packed: Uint8Array,
    key: CryptoKey,
  ): Promise<string> {
    if (packed.length < IV_LENGTH) {
      throw new Error("Invalid encrypted message: too short");
    }

    const iv = packed.slice(0, IV_LENGTH);
    const ciphertext = packed.slice(IV_LENGTH);

    try {
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        ciphertext,
      );
      return new TextDecoder().decode(decryptedBuffer);
    } catch (e) {
      console.error("Decryption failed", e);
      return "[Decryption Error]";
    }
  }

  /**
   * Helper to safely convert Uint8Array to Base64 string.
   */
  private static uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Wraps the symmetric chat key for the Node using Age encryption.
   * Returns a raw Base64 string of the binary Age file (NO Armor headers).
   * Matches the exact logic used in node creation.
   */
  static async wrapKeyForNode(
    chatKey: CryptoKey,
    nodePublicKey: string,
  ): Promise<string> {
    // 1. Export the Chat Key to raw bytes (32 bytes for AES-256)
    const rawKey = await window.crypto.subtle.exportKey("raw", chatKey);
    const keyBytes = new Uint8Array(rawKey);

    // 2. Initialize Age Encrypter
    const encrypter = new age.Encrypter();

    // 3. Validate and Add Recipient
    const cleanKey = nodePublicKey.trim();
    if (!cleanKey.startsWith("age1")) {
      throw new Error(
        `Invalid node public key format: ${cleanKey.substring(0, 10)}...`,
      );
    }
    encrypter.addRecipient(cleanKey);

    // 4. Encrypt the raw key bytes -> returns Uint8Array binary
    const encryptedBytes = await encrypter.encrypt(keyBytes);

    // 5. Convert to Base64 (Standard) without any headers/armor
    return this.uint8ArrayToBase64(encryptedBytes);
  }
}
