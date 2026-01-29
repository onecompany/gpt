import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  LockKey,
  CircleNotch,
  WarningCircle,
  ArrowRight,
  CaretLeft,
} from "@phosphor-icons/react";
import { useAuthStore } from "@/store/authStore";
import clsx from "clsx";

interface VaultGateProps {
  mode: "setup" | "unlock";
}

export const VaultGate: React.FC<VaultGateProps> = ({ mode }) => {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Animation trigger
  const [shakeKey, setShakeKey] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const { setupVault, unlockVault } = useAuthStore();

  useEffect(() => {
    // Keep focus on the input to ensure keyboard readiness
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [step, mode]);

  const triggerShake = () => {
    setShakeKey((prev) => prev + 1);
  };

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (step === "enter") {
      if (pin.length < 4) {
        setError("Use at least 4 digits");
        triggerShake();
        return;
      }
      setStep("confirm");
      return;
    }

    if (step === "confirm") {
      if (confirmPin !== pin) {
        setError("PINs do not match");
        triggerShake();
        setTimeout(() => {
          setStep("enter");
          setPin("");
          setConfirmPin("");
          setError(null);
        }, 1200);
        return;
      }

      setIsLoading(true);
      try {
        await setupVault(pin);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Setup failed";
        setError(errMsg);
        triggerShake();
        setStep("enter");
        setPin("");
        setConfirmPin("");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) {
      triggerShake();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await unlockVault(pin);
    } catch (err: unknown) {
      setError("Incorrect PIN");
      console.log("Vault unlock failed:", err);
      triggerShake();
      setPin("");
    } finally {
      setIsLoading(false);
    }
  };

  const resetSetup = () => {
    setStep("enter");
    setPin("");
    setConfirmPin("");
    setError(null);
  };

  const isSetup = mode === "setup";
  const currentPinValue = isSetup && step === "confirm" ? confirmPin : pin;

  const title = isSetup
    ? step === "confirm"
      ? "Confirm Vault PIN"
      : "Set Vault PIN"
    : "Unlock Workspace";

  const description =
    error ||
    (isSetup && step === "enter"
      ? "Create a local PIN to encrypt your session"
      : "Enter your PIN to continue");

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center bg-zinc-900 z-50 text-center p-4"
      role="main"
      aria-live="polite"
    >
      <motion.div
        key={shakeKey}
        animate={{ x: shakeKey > 0 ? [0, -10, 10, -10, 10, 0] : 0 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        className="flex flex-col items-center max-w-xs w-full"
      >
        {/* Icon (Matches FullScreenSpinner style) */}
        <div
          className={clsx(
            "mb-4 text-zinc-400 transition-colors duration-300",
            error ? "text-red-400" : "text-zinc-400",
          )}
        >
          {error ? <WarningCircle size={32} /> : <LockKey size={32} />}
        </div>

        {/* Text Status */}
        <h2 className="text-base font-medium text-zinc-200 mb-1">{title}</h2>

        <p
          className={clsx(
            "text-sm h-5 transition-colors duration-300",
            error ? "text-red-400" : "text-zinc-500",
          )}
        >
          {description}
        </p>

        {/* Minimalist Input Field */}
        <form
          onSubmit={isSetup ? handleSetupSubmit : handleUnlockSubmit}
          className="relative mt-8 w-full max-w-50"
        >
          <div className="relative flex items-center justify-center">
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={currentPinValue}
              onChange={(e) => {
                const val = e.target.value;
                if (!/^\d*$/.test(val)) return;
                if (isSetup && step === "confirm") setConfirmPin(val);
                else setPin(val);
                if (error) setError(null);
              }}
              className={clsx(
                "w-full bg-zinc-800/50 hover:bg-zinc-800/80 focus:bg-zinc-800 transition-colors",
                "rounded-full py-2.5 pl-6 pr-10",
                "text-center text-xl font-mono tracking-[0.5em] text-zinc-100 placeholder-zinc-700",
                "outline-none ring-1 ring-transparent  focus:ring-0",
                error && "ring-red-900/50 bg-red-900/10 focus:bg-red-900/20",
              )}
              placeholder="••••"
              maxLength={8}
              disabled={isLoading}
              autoFocus
            />

            {/* In-field Action Button */}
            <div className="absolute right-1.5 top-1.5 bottom-1.5">
              <button
                type="submit"
                disabled={currentPinValue.length < 4 || isLoading}
                className={clsx(
                  "h-full aspect-square flex items-center justify-center rounded-full transition-all duration-200",
                  currentPinValue.length < 4 || isLoading
                    ? "text-zinc-600 "
                    : "bg-zinc-100 text-zinc-900 hover:bg-white shadow-sm",
                )}
              >
                {isLoading ? (
                  <CircleNotch size={14} className="animate-spin" />
                ) : (
                  <ArrowRight size={14} weight="bold" />
                )}
              </button>
            </div>
          </div>

          {/* Back Navigation for Setup Flow */}
          {isSetup && step === "confirm" && (
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={resetSetup}
              className="absolute -bottom-10 left-0 right-0 mx-auto flex items-center justify-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-2"
            >
              <CaretLeft size={12} />
              <span>Back</span>
            </motion.button>
          )}
        </form>
      </motion.div>
    </div>
  );
};

VaultGate.displayName = "VaultGate";
