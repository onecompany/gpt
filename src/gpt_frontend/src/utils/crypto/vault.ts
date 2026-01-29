import { argon2id } from "hash-wasm";
import * as age from "age-encryption";
import { bech32 } from "@scure/base";

// Helper to convert a 32-byte Uint8Array to an age secret key string
function toAgeSecretKey(seed: Uint8Array): string {
  // CRITICAL: Age identities MUST be uppercase (AGE-SECRET-KEY-1...).
  // Bech32 libraries typically default to lowercase, which age rejects.
  return bech32.encode("age-secret-key-", bech32.toWords(seed)).toUpperCase();
}

export class VaultCrypto {
  // 1. Derive Root Key (32 bytes hex string formatted as Age Secret Key)
  static async deriveRootKey(pin: string, salt: Uint8Array): Promise<string> {
    // Use high memory cost for security
    const derived = await argon2id({
      password: pin,
      salt: salt,
      parallelism: 1,
      iterations: 32,
      memorySize: 16384, // 16 MB
      hashLength: 32,
      outputType: "binary",
    });

    return toAgeSecretKey(derived);
  }

  // 2. Encrypt Validator
  static async encryptValidator(rootKey: string): Promise<string> {
    try {
      const recipient = await age.identityToRecipient(rootKey);

      const dist = new age.Encrypter();
      dist.addRecipient(recipient);

      const encrypted = await dist.encrypt("GPT-VALID");
      // age-encryption returns Uint8Array, convert to base64 for storage
      return Buffer.from(encrypted).toString("base64");
    } catch (e) {
      console.error(
        "VaultCrypto: Failed to encrypt validator. RootKey format likely invalid.",
        rootKey,
      );
      throw e;
    }
  }

  // 3. Verify PIN
  static async verifyPin(
    pin: string,
    salt: Uint8Array,
    encryptedValidatorBase64: string,
  ): Promise<string | null> {
    try {
      const rootKey = await this.deriveRootKey(pin, salt);
      const dec = new age.Decrypter();

      dec.addIdentity(rootKey);

      const validatorBytes = Buffer.from(encryptedValidatorBase64, "base64");
      const result = await dec.decrypt(validatorBytes);
      const resultStr = new TextDecoder().decode(result);

      if (resultStr === "GPT-VALID") {
        return rootKey;
      }
      return null;
    } catch (e: unknown) {
      console.error("VaultCrypto: PIN Verification Failed", e);
      return null;
    }
  }

  // 4. Verify Cached Key
  static async verifyKey(
    rootKey: string,
    encryptedValidatorBase64: string,
  ): Promise<boolean> {
    try {
      const dec = new age.Decrypter();
      dec.addIdentity(rootKey);

      const validatorBytes = Buffer.from(encryptedValidatorBase64, "base64");
      const result = await dec.decrypt(validatorBytes);
      const resultStr = new TextDecoder().decode(result);

      return resultStr === "GPT-VALID";
    } catch (e) {
      console.warn("VaultCrypto: Cached key verification failed", e);
      return false;
    }
  }
}
