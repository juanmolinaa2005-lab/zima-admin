export type ApiProviderId =
  | "meta"
  | "youtube"
  | "blotato"
  | "openai"
  | "openai-api"
  | "superwall"
  | "higgsfield"
  | "replicate"
  | "fal"
  | "claude";

export type ApiProviderMeta = {
  id: ApiProviderId;
  name: string;
  usedBy: string;
  description: string;
  portalUrl: string;
  portalLabel: string;
  /** Fields shown in settings form */
  fields: ("apiKey" | "keyId" | "keySecret")[];
  placeholder?: string;
  keyIdPlaceholder?: string;
  keySecretPlaceholder?: string;
};

export const API_PROVIDERS: ApiProviderMeta[] = [
  {
    id: "meta",
    name: "Meta (Facebook)",
    usedBy: "Redes · Instagram",
    description:
      "Paste the Instagram App ID + App Secret from Meta → Instagram product panel (not only the Facebook App ID). OAuth uses Instagram Login with scopes instagram_business_basic + instagram_business_content_publish. Add the redirect URI in Instagram → API setup / Business login.",
    portalUrl: "https://developers.facebook.com/apps/",
    portalLabel: "Meta for Developers",
    fields: ["keyId", "keySecret"],
    keyIdPlaceholder: "Instagram App ID (product panel)",
    keySecretPlaceholder: "Instagram App Secret",
  },
  {
    id: "youtube",
    name: "YouTube (Google)",
    usedBy: "Redes · YouTube",
    description:
      "Google Cloud OAuth 2.0 Client ID + Secret (Web application). Enable YouTube Data API v3. Add the redirect URI below. Then connect each channel from Redes.",
    portalUrl:
      "https://console.cloud.google.com/apis/credentials/oauthclient",
    portalLabel: "Crear Client ID + Secret (Google Cloud)",
    fields: ["keyId", "keySecret"],
    keyIdPlaceholder: "OAuth Client ID (…apps.googleusercontent.com)",
    keySecretPlaceholder: "OAuth Client Secret",
  },
  {
    id: "blotato",
    name: "Blotato",
    usedBy: "Redes · TikTok",
    description:
      "Connect TikTok accounts in Blotato, then publish from Zima. Instagram uses Meta; YouTube uses Google API v3.",
    portalUrl: "https://my.blotato.com/settings/api",
    portalLabel: "Blotato Settings → API",
    fields: ["apiKey"],
    placeholder: "Blotato API key",
  },
  {
    id: "openai",
    name: "OpenAI",
    usedBy: "Analytics · AI Cost",
    description: "Admin API key for organization spend and usage.",
    portalUrl:
      "https://platform.openai.com/settings/organization/admin-keys",
    portalLabel: "OpenAI Admin keys",
    fields: ["apiKey"],
    placeholder: "sk-admin…",
  },
  {
    id: "openai-api",
    name: "OpenAI API",
    usedBy: "Creator Imagen · fotos de Influencers",
    description:
      "Standard API key (sk-) for GPT Image 2. Used for influencer portraits. Not the Admin key.",
    portalUrl: "https://platform.openai.com/api-keys",
    portalLabel: "OpenAI API keys",
    fields: ["apiKey"],
    placeholder: "sk-proj-… or sk-…",
  },
  {
    id: "superwall",
    name: "Superwall",
    usedBy: "Analytics · Billing",
    description: "Organization API key for revenue and subscriptions.",
    portalUrl: "https://superwall.com/dashboard",
    portalLabel: "Superwall dashboard",
    fields: ["apiKey"],
    placeholder: "Organization API key",
  },
  {
    id: "higgsfield",
    name: "Higgsfield",
    usedBy: "Creator Studio",
    description: "Key ID + Secret for video generation.",
    portalUrl: "https://cloud.higgsfield.ai",
    portalLabel: "cloud.higgsfield.ai",
    fields: ["keyId", "keySecret"],
  },
  {
    id: "replicate",
    name: "Replicate",
    usedBy: "Influencers · video (principal)",
    description:
      "API token from replicate.com. Primary for Kling/Veo influencer videos. fal.ai is used only if Replicate fails.",
    portalUrl: "https://replicate.com/account/api-tokens",
    portalLabel: "Replicate → API tokens",
    fields: ["apiKey"],
    placeholder: "r8_…",
  },
  {
    id: "fal",
    name: "fal.ai",
    usedBy: "Viral Content · video (respaldo)",
    description:
      "API key from fal.ai. Used for Viral Content and as fallback if Replicate fails on video.",
    portalUrl: "https://fal.ai/dashboard/keys",
    portalLabel: "fal.ai → API Keys",
    fields: ["apiKey"],
    placeholder: "fal key (uuid:secret)",
  },
  {
    id: "claude",
    name: "Claude",
    usedBy: "Legacy Anthropic admin",
    description: "Anthropic Admin API key (optional).",
    portalUrl: "https://console.anthropic.com/settings/admin-keys",
    portalLabel: "Anthropic Admin keys",
    fields: ["apiKey"],
    placeholder: "sk-ant-admin…",
  },
];

export function apiProvider(id: ApiProviderId): ApiProviderMeta {
  return API_PROVIDERS.find((p) => p.id === id)!;
}
