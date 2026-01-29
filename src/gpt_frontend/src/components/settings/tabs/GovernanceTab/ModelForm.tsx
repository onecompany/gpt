import React, { useState, useEffect } from "react";
import { CaretRight, WarningCircle } from "@phosphor-icons/react";
import { Model, ModelType } from "@/types";
import { BackendModelPreset } from "@/constants/modelPresets";
import { toast } from "sonner";
import clsx from "clsx";

interface ModelFormProps {
  modelToEdit: Model | null;
  onSubmit: (model: BackendModelPreset) => Promise<void>;
  isLoading: boolean;
}

const ModelForm: React.FC<ModelFormProps> = ({
  modelToEdit,
  onSubmit,
  isLoading,
}) => {
  const [formData, setFormData] = useState(() => {
    if (modelToEdit) {
      return {
        modelId: modelToEdit.modelId,
        name: modelToEdit.name,
        description: "",
        maker: modelToEdit.maker,
        provider: modelToEdit.provider,
        providerModel: modelToEdit.providerModel,
        providerEndpoint: modelToEdit.providerEndpoint,
        maxContext: modelToEdit.maxContext,
        maxOutput: modelToEdit.maxOutput,
        inputPrice: modelToEdit.inputTokenPrice * 1_000_000,
        outputPrice: modelToEdit.outputTokenPrice * 1_000_000,
        maxImageAttachments: modelToEdit.max_image_attachments,
        maxTools: modelToEdit.max_tools,
        extraBodyJson: modelToEdit.extra_body_json || "",
      };
    }
    return {
      modelId: "",
      name: "",
      description: "Custom Model",
      maker: "openai" as ModelType,
      provider: "",
      providerModel: "",
      providerEndpoint: "",
      maxContext: 128000,
      maxOutput: 4096,
      inputPrice: 0,
      outputPrice: 0,
      maxImageAttachments: 0,
      maxTools: 0,
      extraBodyJson: "",
    };
  });

  useEffect(() => {
    if (modelToEdit && modelToEdit.modelId !== formData.modelId) {
      setFormData({
        modelId: modelToEdit.modelId,
        name: modelToEdit.name,
        description: "",
        maker: modelToEdit.maker,
        provider: modelToEdit.provider,
        providerModel: modelToEdit.providerModel,
        providerEndpoint: modelToEdit.providerEndpoint,
        maxContext: modelToEdit.maxContext,
        maxOutput: modelToEdit.maxOutput,
        inputPrice: modelToEdit.inputTokenPrice * 1_000_000,
        outputPrice: modelToEdit.outputTokenPrice * 1_000_000,
        maxImageAttachments: modelToEdit.max_image_attachments,
        maxTools: modelToEdit.max_tools,
        extraBodyJson: modelToEdit.extra_body_json || "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelToEdit?.modelId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const backendModel: BackendModelPreset = {
        model_id: formData.modelId,
        name: formData.name,
        description: formData.description,
        max_context: Number(formData.maxContext),
        max_output: Number(formData.maxOutput),
        input_token_price: Number(formData.inputPrice) / 1_000_000,
        output_token_price: Number(formData.outputPrice) / 1_000_000,
        maker: formData.maker,
        provider: formData.provider,
        provider_model: formData.providerModel,
        provider_endpoint: formData.providerEndpoint,
        max_image_attachments: Number(formData.maxImageAttachments),
        max_tools: Number(formData.maxTools),
        aa_score: [],
        release_date: [],
        status: { Active: null },
        extra_body_json: formData.extraBodyJson || undefined,
      };
      await onSubmit(backendModel);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save model.";
      toast.error(msg);
    }
  };

  // Standardized styles
  const labelClass = "block text-sm font-medium text-zinc-300 mb-1.5";
  const inputClass =
    "mt-0 block w-full px-3 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 placeholder-zinc-500  focus:ring-0 focus:border-zinc-500 transition-colors";

  const isFormValid = formData.modelId && formData.name && formData.provider;

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
        <form id="model-form" onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>Model ID</label>
              <input
                required
                disabled={!!modelToEdit}
                value={formData.modelId}
                onChange={(e) =>
                  setFormData({ ...formData, modelId: e.target.value })
                }
                className={clsx(inputClass, !!modelToEdit && "opacity-50 ")}
                placeholder="e.g. provider-model-name"
              />
            </div>
            <div>
              <label className={labelClass}>Display Name</label>
              <input
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Maker</label>
              <select
                value={formData.maker}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    maker: e.target.value as ModelType,
                  })
                }
                className={inputClass}
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google</option>
                <option value="meta">Meta</option>
                <option value="mistral">Mistral</option>
                <option value="deepseek">DeepSeek</option>
                <option value="qwen">Qwen</option>
                <option value="xai">xAI</option>
                <option value="moonshotai">Moonshot AI</option>
                <option value="perplexity">Perplexity</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Provider Name</label>
              <input
                required
                value={formData.provider}
                onChange={(e) =>
                  setFormData({ ...formData, provider: e.target.value })
                }
                className={inputClass}
                placeholder="e.g. DeepInfra"
              />
            </div>

            <div>
              <label className={labelClass}>Provider Model ID</label>
              <input
                required
                value={formData.providerModel}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    providerModel: e.target.value,
                  })
                }
                className={inputClass}
                placeholder="e.g. meta-llama/Llama-3-70b"
              />
            </div>
            <div>
              <label className={labelClass}>Provider Endpoint</label>
              <input
                required
                value={formData.providerEndpoint}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    providerEndpoint: e.target.value,
                  })
                }
                className={inputClass}
                placeholder="https://api.provider.com/v1"
              />
            </div>

            <div>
              <label className={labelClass}>Max Context</label>
              <input
                type="number"
                required
                value={formData.maxContext}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    maxContext: parseInt(e.target.value),
                  })
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Max Output</label>
              <input
                type="number"
                required
                value={formData.maxOutput}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    maxOutput: parseInt(e.target.value),
                  })
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Input Price ($/1M)</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.inputPrice}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    inputPrice: parseFloat(e.target.value),
                  })
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Output Price ($/1M)</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.outputPrice}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    outputPrice: parseFloat(e.target.value),
                  })
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Max Image Attachments</label>
              <input
                type="number"
                required
                value={formData.maxImageAttachments}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    maxImageAttachments: parseInt(e.target.value),
                  })
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Max Tools</label>
              <input
                type="number"
                required
                value={formData.maxTools}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    maxTools: parseInt(e.target.value),
                  })
                }
                className={inputClass}
              />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className={labelClass}>Extra JSON (Advanced)</label>
              <textarea
                rows={3}
                value={formData.extraBodyJson}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    extraBodyJson: e.target.value,
                  })
                }
                className={`${inputClass} resize-none`}
                placeholder='{"web_search_options": {"search_type": "pro"}}'
              />
              <p className="text-xs text-zinc-500 mt-1.5">
                Valid JSON merged into the API request body.
              </p>
            </div>
          </div>
        </form>
      </div>
      <div className="border-t border-zinc-750 px-5 py-3 flex justify-end">
        <button
          form="model-form"
          type="submit"
          disabled={isLoading || !isFormValid}
          className={clsx(
            "text-sm font-medium flex items-center gap-1.5  focus:ring-0 transition-colors",
            isLoading || !isFormValid
              ? "text-zinc-500 "
              : "text-zinc-100 hover:text-zinc-200 cursor-pointer",
          )}
        >
          {isLoading
            ? "Saving..."
            : modelToEdit
              ? "Update Model"
              : "Create Model"}
          {!isLoading && <CaretRight size={14} weight="bold" />}
        </button>
      </div>
    </div>
  );
};

export default ModelForm;
