import React, { memo, useState } from "react";
import { Wallet } from "@phosphor-icons/react";
import { GearFine, HardDrive, SignOut, SignIn } from "@phosphor-icons/react";
import { Icons } from "@/components/icons";
import { useAuthStore, AuthStatus } from "@/store/authStore";
import clsx from "clsx";
import { SettingsModal } from "@/components/settings";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "@/components/ui/Dropdown";

interface AvatarDropdownProps {
  handleLogout: () => void;
}

export const AvatarDropdown: React.FC<AvatarDropdownProps> = memo(
  ({ handleLogout }) => {
    const authStatus = useAuthStore((state) => state.authStatus);
    const handleLogin = useAuthStore((state) => state.login);
    const [showSettings, setShowSettings] = useState(false);

    const isUserAuthenticated = authStatus === AuthStatus.REGISTERED;
    const iconClass = "text-zinc-400 group-hover:text-zinc-200";

    return (
      <>
        <Dropdown as="div" className="relative inline-block text-left">
          {({ open }) => (
            <>
              <DropdownTrigger
                className={clsx(
                  "flex items-center p-1.5 rounded-lg cursor-pointer",
                  open ? "text-zinc-200" : "text-zinc-400 hover:text-zinc-200",
                )}
              >
                <span className="flex items-center">
                  <Icons.user weight="regular" data-slot="icon" size={20} />
                </span>
              </DropdownTrigger>

              <DropdownContent align="end" width="min-w-[9rem]">
                {isUserAuthenticated ? (
                  <>
                    <DropdownItem onClick={() => {}}>
                      <Wallet
                        weight="regular"
                        className={iconClass}
                        size={20}
                      />
                      <span className="ml-2.5">Wallet</span>
                    </DropdownItem>
                    <DropdownItem onClick={() => {}}>
                      <HardDrive
                        weight="regular"
                        className={iconClass}
                        size={20}
                      />
                      <span className="ml-2.5">Storage</span>
                    </DropdownItem>
                    <DropdownItem onClick={() => setShowSettings(true)}>
                      <GearFine
                        weight="regular"
                        className={iconClass}
                        size={20}
                      />
                      <span className="ml-2.5">Settings</span>
                    </DropdownItem>
                    <DropdownItem onClick={handleLogout}>
                      <SignOut
                        weight="regular"
                        className={iconClass}
                        size={20}
                      />
                      <span className="ml-2.5">Sign Out</span>
                    </DropdownItem>
                  </>
                ) : (
                  <DropdownItem onClick={handleLogin}>
                    <SignIn weight="regular" className={iconClass} size={20} />
                    <span className="ml-2.5">Sign In</span>
                  </DropdownItem>
                )}
              </DropdownContent>
            </>
          )}
        </Dropdown>

        {showSettings && (
          <SettingsModal
            open={showSettings}
            onClose={() => setShowSettings(false)}
          />
        )}
      </>
    );
  },
);

AvatarDropdown.displayName = "AvatarDropdown";
AvatarDropdown.displayName = "AvatarDropdown";
