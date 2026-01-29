import { Model, ModelType, ModelStatus } from "@/types";
import type { Model as BackendModel } from "@candid/declarations/gpt_index.did";
import { fromOpt, getVariantKey } from "./candidUtils";

export const enhanceModel = (backendModel: BackendModel): Model => {
  const {
    model_id,
    max_context,
    max_output,
    input_token_price,
    output_token_price,
    name,
    max_image_attachments,
    max_tools,
    aa_score,
    release_date,
    provider,
    provider_model,
    provider_endpoint,
    maker,
    status,
    extra_body_json,
    is_reasoning,
  } = backendModel;

  const statusKey = getVariantKey(status);
  const statusEnum: ModelStatus = statusKey === "Active" ? "Active" : "Paused";

  return {
    modelId: model_id,
    name: name,
    provider: provider,
    providerModel: provider_model,
    providerEndpoint: provider_endpoint,
    maker: maker.toLowerCase() as ModelType,
    nodeCount: 0,
    maxContext: Number(max_context),
    maxOutput: Number(max_output),
    inputTokenPrice: input_token_price,
    outputTokenPrice: output_token_price,
    max_image_attachments: Number(max_image_attachments),
    max_tools: Number(max_tools),
    aaScore: fromOpt(aa_score),
    releaseDate: fromOpt(release_date),
    status: statusEnum,
    extra_body_json: fromOpt(extra_body_json),
    isReasoning: is_reasoning,
  };
};
