import React, { memo, useState, useRef, useEffect } from "react";
import clsx from "clsx";
import { motion } from "framer-motion";
import { Icons } from "@/components/icons";
import { useChatStore } from "@/store/chatStore/index";
import { SliderOption } from "@/types";
import { Palette, Brain } from "@phosphor-icons/react";
import { chatParameterOptions } from "@/constants/constants";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
} from "@/components/ui/Dropdown";

type InputValues = {
  Temperature: string;
  Output: string;
  Context: string;
};

export const OptionsDropdown: React.FC = memo(() => {
  const temperature = useChatStore((state) => state.temperature);
  const maxOutput = useChatStore((state) => state.maxOutput);
  const maxContext = useChatStore((state) => state.maxContext);
  const reasoningEffort = useChatStore((state) => state.reasoningEffort);
  const setTemperature = useChatStore((state) => state.setTemperature);
  const setMaxOutput = useChatStore((state) => state.setMaxOutput);
  const setMaxContext = useChatStore((state) => state.setMaxContext);
  const setReasoningEffort = useChatStore((state) => state.setReasoningEffort);
  const selectedModel = useChatStore((state) => state.selectedModel);

  const [inputValues, setInputValues] = useState<InputValues>({
    Temperature: temperature.toString(),
    Output: maxOutput.toString(),
    Context: maxContext.toString(),
  });
  const [editing, setEditing] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isReasoningModel = selectedModel?.isReasoning ?? false;

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const sliderOptions: SliderOption[] = [
    {
      label: "Context",
      description: "Limits memory for current chat.",
      value: maxContext,
      min: chatParameterOptions.context.min,
      max: selectedModel?.maxContext ?? chatParameterOptions.context.defaultMax,
      step: chatParameterOptions.context.step,
    },
    {
      label: "Output",
      description: "Limits the length of the response.",
      value: maxOutput,
      min: chatParameterOptions.output.min,
      max: selectedModel?.maxOutput ?? chatParameterOptions.output.defaultMax,
      step: chatParameterOptions.output.step,
    },
  ];

  if (!isReasoningModel) {
    sliderOptions.unshift({
      label: "Temperature",
      description: "Controls response variety.",
      value: temperature,
      min: chatParameterOptions.temperature.min,
      max: chatParameterOptions.temperature.max,
      step: chatParameterOptions.temperature.step,
    });
  }

  const handleValueClick = (label: string) => {
    setInputValues((prev) => ({
      ...prev,
      [label]:
        label === "Temperature"
          ? temperature.toString()
          : label === "Output"
            ? maxOutput.toString()
            : maxContext.toString(),
    }));
    setEditing(label);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    label: string,
  ) => {
    const inputValue = e.target.value;

    if (label === "Temperature" && !/^\d*\.?\d*$/.test(inputValue)) {
      return;
    }

    if (label !== "Temperature" && !/^\d*$/.test(inputValue)) {
      return;
    }

    setInputValues((prev) => ({
      ...prev,
      [label]: inputValue,
    }));
  };

  const handleInputBlur = (option: SliderOption) => {
    const inputValue = inputValues[option.label as keyof InputValues];

    let newValue =
      option.label === "Temperature"
        ? parseFloat(inputValue)
        : parseInt(inputValue, 10);

    if (isNaN(newValue)) {
      newValue = option.min;
    } else if (newValue < option.min) {
      newValue = option.min;
    } else if (newValue > option.max) {
      newValue = option.max;
    }

    if (option.label === "Temperature") {
      setTemperature(newValue);
    } else if (option.label === "Output") {
      setMaxOutput(newValue);
    } else if (option.label === "Context") {
      setMaxContext(newValue);
    }

    setEditing(null);
  };

  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    option: SliderOption,
  ) => {
    if (e.key === "Enter") {
      handleInputBlur(option);
    }
  };

  return (
    <Dropdown as="div" className="relative inline-block text-left">
      {({ open }) => (
        <>
          <DropdownTrigger
            className={clsx(
              "flex rounded-md p-1.5 items-center transition duration-150 cursor-pointer",
              open ? "text-zinc-200" : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            <Palette weight="regular" data-slot="icon" size={20} />
          </DropdownTrigger>

          <DropdownContent
            align="end"
            width="w-[18rem]"
            className="px-4 py-2.5"
          >
            <div className="pb-1.5 -mr-0.5 text-zinc-400 text-sm flex justify-between items-center">
              <span>{isReasoningModel ? "Reasoning" : "Style"}</span>
              <span title="Generation Parameters">
                <Icons.info
                  weight="bold"
                  className="text-zinc-500 cursor-pointer hover:text-zinc-300"
                  size={16}
                />
              </span>
            </div>

            <div className="flex flex-col space-y-4 mb-1">
              {/* Reasoning Effort Selector (Segmented Control) */}
              {isReasoningModel && (
                <div className="flex flex-col">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-1.5">
                      <Brain size={14} className="text-zinc-400" />
                      <label className="text-sm text-zinc-100">Effort</label>
                    </div>
                  </div>

                  {/* Segmented Control Container */}
                  <div
                    className="flex items-center rounded-lg bg-zinc-750 p-0.5 w-full"
                    role="radiogroup"
                    aria-label="Reasoning Effort"
                  >
                    {["low", "medium", "high"].map((level) => {
                      const isActive = reasoningEffort === level;
                      return (
                        <button
                          key={level}
                          onClick={() => setReasoningEffort(level)}
                          className={clsx(
                            "relative flex-1 py-1 text-xs font-medium rounded-md capitalize transition-colors duration-200  focus-visible:ring-0 cursor-pointer",
                            isActive
                              ? "text-zinc-100"
                              : "text-zinc-400 hover:text-zinc-200",
                          )}
                          role="radio"
                          aria-checked={isActive}
                        >
                          {isActive && (
                            <motion.div
                              layoutId="reasoning-effort-active"
                              className="absolute inset-0 bg-zinc-650 rounded-md shadow-sm"
                              transition={{
                                type: "spring",
                                stiffness: 400,
                                damping: 30,
                              }}
                            />
                          )}
                          <span className="relative z-10">{level}</span>
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-xs text-zinc-400 mt-2">
                    Controls depth of thought process.
                  </p>
                </div>
              )}

              {/* Sliders */}
              {sliderOptions.map((option) => (
                <div key={option.label} className="flex flex-col">
                  <div className="flex justify-between items-center mb-1">
                    <label
                      htmlFor={option.label}
                      className="text-sm text-zinc-100"
                    >
                      {option.label}
                    </label>
                    <div className="relative">
                      {editing === option.label ? (
                        <input
                          ref={inputRef}
                          type="text"
                          id={option.label}
                          value={inputValues[option.label as keyof InputValues]}
                          onChange={(e) => handleInputChange(e, option.label)}
                          onBlur={() => handleInputBlur(option)}
                          onKeyDown={(e) => handleInputKeyDown(e, option)}
                          className="text-sm bg-transparent text-zinc-200 text-right focus:outline-hidden max-w-16"
                        />
                      ) : (
                        <button
                          onClick={() => handleValueClick(option.label)}
                          className="text-sm text-zinc-400 cursor-pointer focus:outline-hidden hover:text-zinc-100 rounded-sm max-w-16"
                        >
                          {option.value}
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    id={option.label}
                    type="range"
                    min={option.min}
                    max={option.max}
                    step={option.step}
                    value={option.value}
                    onChange={(e) => {
                      const newValue =
                        option.label === "Temperature"
                          ? parseFloat(e.target.value)
                          : parseInt(e.target.value, 10);
                      if (!isNaN(newValue)) {
                        if (option.label === "Temperature") {
                          setTemperature(newValue);
                        } else if (option.label === "Output") {
                          setMaxOutput(newValue);
                        } else if (option.label === "Context") {
                          setMaxContext(newValue);
                        }
                      }
                    }}
                    className="custom-slider w-full h-1.5 bg-zinc-750 hover:bg-zinc-700 outline-hidden rounded-lg appearance-none cursor-pointer"
                  />
                  <p className="flex text-xs text-zinc-400 mt-2">
                    <span>{option.description}</span>
                  </p>
                </div>
              ))}
            </div>
          </DropdownContent>
        </>
      )}
    </Dropdown>
  );
});

OptionsDropdown.displayName = "OptionsDropdown";
OptionsDropdown.displayName = "OptionsDropdown";
