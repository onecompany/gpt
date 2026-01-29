import React, { useCallback, Fragment } from "react";
import { Menu, MenuItem, Transition } from "@headlessui/react";
import clsx from "clsx";
import {
  CaretRight,
  Microphone,
  CircleNotch,
  Paperclip,
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import TextareaAutosize from "react-textarea-autosize";
import useVoiceInput from "@/hooks/useVoiceInput";
import useFilePicker from "@/hooks/useFilePicker";
import { Icons } from "@/components/icons";
import { AttachmentPreview } from "./AttachmentPreview";
import { ScrollToBottomButton } from "./ScrollToBottomButton";
import { useChatStore } from "@/store/chatStore";
import { processAndCompressFiles } from "@/utils/fileProcessor";
import { useChatReadiness } from "@/hooks/useChatReadiness";

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  sendMessage: () => void;
  isGenerating: boolean;
  variant?: "chat" | "new";
  isUserScrolledUp?: boolean;
  hasUnread?: boolean;
  onScrollToBottomClick?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = React.memo(
  ({
    input,
    setInput,
    sendMessage,
    isGenerating,
    variant = "chat",
    isUserScrolledUp = false,
    hasUnread = false,
    onScrollToBottomClick = () => {},
  }) => {
    const {
      addAttachments,
      attachments,
      selectedModel,
      compressionLevel,
      currentChatId,
    } = useChatStore();
    const { transcript, listening, startListening, stopListening } =
      useVoiceInput();

    const { isReady, message: readinessMessage } =
      useChatReadiness(currentChatId);

    const handleFilesSelected = useCallback(
      async (files: File[]) => {
        const newAttachments = await processAndCompressFiles(
          files,
          compressionLevel,
        );
        const imageAttachments = newAttachments.filter(
          (att) => att.type === "image",
        );
        addAttachments(imageAttachments);
      },
      [addAttachments, compressionLevel],
    );

    const {
      FileInputElement: ImageFileInput,
      openFilePicker: openImagePicker,
    } = useFilePicker({
      accept: "image/jpeg,image/png,image/webp",
      multiple: true,
      onFilesSelected: handleFilesSelected,
    });

    React.useEffect(() => {
      if (transcript) {
        setInput(transcript);
      }
    }, [transcript, setInput]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (!isGenerating && isReady) {
            sendMessage();
          }
        }
      },
      [sendMessage, isGenerating, isReady],
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
      },
      [setInput],
    );

    const handleButtonClick = useCallback(() => {
      if (isGenerating || !isReady) return;

      if (input.trim() || attachments.length > 0) {
        sendMessage();
      } else {
        if (!listening) {
          startListening();
        } else {
          stopListening();
        }
      }
    }, [
      input,
      attachments,
      listening,
      sendMessage,
      startListening,
      stopListening,
      isGenerating,
      isReady,
    ]);

    const isDisabled = isGenerating || !isReady;
    const iconSize = variant === "new" ? 19 : 18;

    const renderButtonIcon = useCallback(() => {
      if (isGenerating) {
        return (
          <CircleNotch
            weight="regular"
            size={iconSize}
            className="inline-block animate-spin text-zinc-400"
          />
        );
      }
      if (input.trim() || attachments.length > 0) {
        return <CaretRight weight="bold" size={iconSize} />;
      }
      return <Microphone weight="regular" size={iconSize} />;
    }, [isGenerating, input, attachments, iconSize]);

    const imageLimit = selectedModel?.max_image_attachments ?? 0;
    const currentImageCount = attachments.filter(
      (attachment) => attachment.type === "image",
    ).length;
    const isImageUploadDisabled = isDisabled || currentImageCount >= imageLimit;
    const isTextUploadDisabled = true;

    const placeholderText =
      !isReady && !isGenerating
        ? readinessMessage
        : variant === "new"
          ? "Chat with Assistant"
          : "Message";

    const buttonAriaLabel = isGenerating
      ? "Generating..."
      : !isReady
        ? readinessMessage
        : input.trim() || attachments.length > 0
          ? "Send Message"
          : listening
            ? "Stop Voice Input"
            : "Start Voice Input";

    const renderAttachMenu = (menuOrigin: "bottom" | "top") => (
      <Menu
        as="div"
        className={clsx(
          "relative",
          variant === "new" ? "inline-block text-left" : "mr-2 mb-2 flex items-center",
        )}
      >
        {({ open }) => (
          <>
            <Menu.Button
              className={clsx(
                "transition-colors duration-200",
                variant === "new" && "items-center flex text-sm gap-0.75",
                isDisabled
                  ? "text-zinc-600"
                  : "text-zinc-400 hover:text-zinc-300 cursor-pointer",
              )}
              disabled={isDisabled}
              aria-label="Attach Files"
            >
              <Paperclip weight="regular" size={iconSize} />
              {variant === "new" && "Attach"}
            </Menu.Button>
            <Transition
              as={Fragment}
              show={open && !isDisabled}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items
                className={clsx(
                  "absolute ml-0 left-0 min-w-40 z-30",
                  "bg-zinc-825 ring-1 ring-zinc-700 rounded-xl p-1 overflow-y-auto shadow-lg",
                  menuOrigin === "bottom"
                    ? "bottom-full mb-2 origin-bottom-left"
                    : "top-full mt-2 origin-top-left",
                )}
              >
                <div>
                  <MenuItem>
                    {({ active }) => (
                      <button
                        disabled={isTextUploadDisabled}
                        className={clsx(
                          "group flex items-center w-full px-2 py-1.5 rounded-lg text-sm",
                          active && !isTextUploadDisabled
                            ? "bg-zinc-750 text-zinc-50"
                            : "text-zinc-200",
                          isTextUploadDisabled ? "opacity-50" : "cursor-pointer",
                        )}
                      >
                        <Icons.fileText size={18} className="mr-2 text-zinc-400" />
                        Text
                      </button>
                    )}
                  </MenuItem>
                  <MenuItem>
                    {({ active }) => (
                      <button
                        onClick={openImagePicker}
                        disabled={isImageUploadDisabled}
                        className={clsx(
                          "group flex items-center w-full px-2 py-1.5 rounded-lg text-sm",
                          active && !isImageUploadDisabled
                            ? "bg-zinc-750 text-zinc-50"
                            : "text-zinc-200",
                          isImageUploadDisabled ? "opacity-50" : "cursor-pointer",
                        )}
                      >
                        <Icons.imageSquare size={18} className="mr-2 text-zinc-400" />
                        Images
                      </button>
                    )}
                  </MenuItem>
                </div>
              </Menu.Items>
            </Transition>
          </>
        )}
      </Menu>
    );

    if (variant === "new") {
      const sendButtonClasses = `flex items-center justify-center transition-all duration-200 ${
        isDisabled
          ? "text-zinc-600"
          : "text-zinc-400 hover:text-zinc-300 cursor-pointer"
      }`;

      return (
        <div className="flex flex-col w-full">
          <AnimatePresence mode="wait">
            {attachments.length > 0 && <AttachmentPreview key="attachments" />}
          </AnimatePresence>
          <div className="relative z-10 flex flex-col w-full bg-zinc-800 rounded-2xl transition-colors duration-200">
            <div className="flex items-start pl-3.5 pr-2 pt-2 pb-2 mx-auto w-full">
              <TextareaAutosize
                className="flex-1 text-[1rem] font-system leading-5.5 pt-1 px-0.5 bg-transparent placeholder-zinc-500 focus:outline-hidden focus:ring-0 resize-none text-zinc-100 disabled:text-zinc-500 max-h-80 overflow-y-auto transition-colors"
                placeholder={placeholderText}
                value={input}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                minRows={1}
                maxRows={15}
                aria-label="Message Input"
                disabled={isDisabled && !isGenerating}
              />
            </div>
            <div className="flex justify-between items-center mb-1.5 py-1 ml-3.5 mr-3">
              <div className="flex space-x-1">
                <ImageFileInput />
                {renderAttachMenu("top")}
              </div>
              <motion.button
                type="button"
                onClick={handleButtonClick}
                whileTap={{ scale: isDisabled ? 1 : 0.95 }}
                className={sendButtonClasses}
                aria-label={buttonAriaLabel}
                title={!isReady ? readinessMessage : undefined}
                disabled={isDisabled}
              >
                {renderButtonIcon()}
              </motion.button>
            </div>
          </div>
        </div>
      );
    }

    const buttonClasses = `ml-2 flex items-center justify-center rounded-full p-1 my-1 transition-all duration-200 ${
      isDisabled
        ? "text-zinc-600"
        : "text-zinc-400 hover:text-zinc-300 cursor-pointer"
    }`;

    return (
      <div className="fixed md:absolute pb-safe-offset-2 bottom-0 px-2 left-0 right-0 w-full md:px-4 bg-transparent z-30 pointer-events-none">
        <div className="flex flex-col items-center mx-auto w-full sm:max-w-216">
          <div className="w-full flex justify-center mb-2.5">
            <AnimatePresence>
              {isUserScrolledUp && (
                <div className="pointer-events-auto">
                  <ScrollToBottomButton
                    hasUnread={hasUnread}
                    onClick={onScrollToBottomClick}
                  />
                </div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence mode="wait">
            {attachments.length > 0 && (
              <div className="pointer-events-auto w-full">
                <AttachmentPreview key="attachments" />
              </div>
            )}
          </AnimatePresence>
          <div
            className={clsx(
              "relative z-10 flex items-end bg-zinc-800 rounded-2xl md:rounded-2xl pl-3 pr-2 md:py-0.5 py-0.75 w-full pointer-events-auto transition-colors duration-200",
            )}
          >
            <ImageFileInput />
            {renderAttachMenu("bottom")}

            <TextareaAutosize
              className="flex-1 text-[1rem] font-system leading-5.5 mb-1.75 pt-1 px-0.5 bg-transparent placeholder-zinc-500 focus:outline-hidden focus:ring-0 resize-none text-zinc-100 disabled:text-zinc-500 max-h-screen h-6.5 overflow-y-auto disabled: transition-colors"
              placeholder={placeholderText}
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              minRows={1}
              maxRows={12}
              aria-label="Message Input"
              disabled={isDisabled && !isGenerating}
            />
            <motion.button
              type="button"
              onClick={handleButtonClick}
              whileTap={{ scale: isDisabled ? 1 : 0.95 }}
              className={buttonClasses}
              aria-label={buttonAriaLabel}
              title={!isReady ? readinessMessage : undefined}
              disabled={isDisabled}
            >
              {renderButtonIcon()}
            </motion.button>
          </div>
        </div>
      </div>
    );
  },
);

ChatInput.displayName = "ChatInput";
