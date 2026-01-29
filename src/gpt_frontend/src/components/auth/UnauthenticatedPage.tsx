import React from "react";
import { HomePageHeader } from "@/components/layouts";
import { AuthStatus } from "@/store/authStore";
import {
  HeroSection,
  SocialProofSection,
  ContrastSection,
  HowItWorksSection,
  UseCasesSection,
  DeveloperExperienceSection,
  FinalCtaSection,
  LandingPageFooter,
} from "@/components/landing";

export const UnauthenticatedPage: React.FC<{
  handleLogin: () => Promise<void>;
  authStatus: AuthStatus;
}> = ({ handleLogin, authStatus }) => {
  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-900 text-zinc-300">
      <HomePageHeader
        authStatus={authStatus}
        handleLogin={handleLogin}
        handleLogout={() => {}}
        handleCreateNewChat={() => {}}
        handleRenameChat={async () => {}}
        handleDeleteChat={async () => {}}
        archiveChatInStore={async () => {}}
        unarchiveChatInStore={async () => {}}
        currentChatId={null}
        chatTitle={""}
        messagesForTitle={[]}
        isChatArchived={false}
      />
      <div className="relative flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden overscroll-contain">
        <main>
          <HeroSection handleLogin={handleLogin} />
          <SocialProofSection />
          <ContrastSection />
          <HowItWorksSection />
          <UseCasesSection />
          <DeveloperExperienceSection />
          <FinalCtaSection handleLogin={handleLogin} />
          <LandingPageFooter />
        </main>
      </div>
    </div>
  );
};

UnauthenticatedPage.displayName = "UnauthenticatedPage";
