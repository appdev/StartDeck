import type {
  AiUsageProviderDefinition,
  AiUsageProviderId,
} from "./aiUsageTypes";

export const AI_USAGE_PROVIDER_ICON_BASE = "/ai-usage/providers";

export const AI_USAGE_PROVIDERS: AiUsageProviderDefinition[] = [
  {
    id: "openai",
    name: "OpenAI",
    iconKey: "openai",
    iconUrl: `${AI_USAGE_PROVIDER_ICON_BASE}/openai.svg`,
    querySupport: "available",
    defaultDisplayName: "OpenAI 使用量",
  },
  {
    id: "claude",
    name: "Claude",
    iconKey: "claude",
    iconUrl: `${AI_USAGE_PROVIDER_ICON_BASE}/claude-color.svg`,
    querySupport: "planned",
    defaultDisplayName: "Claude 使用量",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    iconKey: "deepseek",
    iconUrl: `${AI_USAGE_PROVIDER_ICON_BASE}/deepseek-color.svg`,
    querySupport: "planned",
    defaultDisplayName: "DeepSeek 使用量",
  },
];

export const getAiUsageProvider = (
  providerId: AiUsageProviderId,
): AiUsageProviderDefinition =>
  AI_USAGE_PROVIDERS.find((provider) => provider.id === providerId) ||
  AI_USAGE_PROVIDERS[0];

export const isAiUsageProviderQueryAvailable = (
  providerId: AiUsageProviderId,
) => getAiUsageProvider(providerId).querySupport === "available";
