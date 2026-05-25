import { ref, shallowRef, type Ref } from "vue";
import {
  fetchSiteMetadata,
  getSiteIconUrl,
  normalizeSiteUrl,
} from "@/utils/siteMetadata";
import { normalizeIconBackgroundColor } from "@/utils/iconAppearance";

export interface SmartIconCandidate {
  url: string;
  source: "site";
  label?: string;
  backgroundColor?: string;
}

export interface SmartIconMatchResult {
  icon: string;
  source: SmartIconCandidate["source"];
  label?: string;
  backgroundColor?: string;
}

export interface SmartIconFormState {
  title?: string;
  url?: string;
  lanUrl?: string;
  icon?: string;
}

interface SmartIconMatchOptions {
  form: Ref<SmartIconFormState>;
  onSelect: (result: SmartIconMatchResult) => void;
  notify?: (message: string) => void;
}

const COMMON_DOMAIN_SUFFIXES = [
  ".com.cn",
  ".net.cn",
  ".org.cn",
  ".gov.cn",
  ".edu.cn",
  ".co.uk",
  ".co.jp",
  ".co.kr",
  ".com",
  ".cn",
  ".net",
  ".org",
  ".io",
  ".me",
  ".cc",
] as const;

const SMART_MATCH_TIMEOUT_MS = 3000;

export const resetSmartIconMatchCacheForTests = (): void => {
  // StartPage 风格的元数据由后端 iconserver 解析，前端不再缓存图标索引。
};

export const normalizeUserUrl = normalizeSiteUrl;

export const extractKeywordFromUrl = (input: string): string => {
  try {
    const normalized = normalizeUserUrl(input);
    if (!normalized) return "";

    const hostname = new URL(normalized).hostname.toLowerCase();
    let core = hostname.replace(/^www\./, "");

    for (const suffix of COMMON_DOMAIN_SUFFIXES) {
      if (core.endsWith(suffix)) {
        core = core.slice(0, -suffix.length);
        break;
      }
    }

    if (core.includes(".")) {
      const parts = core.split(".");
      return parts[parts.length - 1] || "";
    }

    return core;
  } catch {
    return "";
  }
};

const loadImageDimensions = (
  src: string,
): Promise<{ width: number; height: number; valid: boolean }> => {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = window.setTimeout(
      () => resolve({ width: 0, height: 0, valid: false }),
      SMART_MATCH_TIMEOUT_MS,
    );

    img.onload = () => {
      window.clearTimeout(timer);
      const width = img.naturalWidth || img.width || 0;
      const height = img.naturalHeight || img.height || 0;
      resolve({
        width,
        height,
        valid: width > 1 && height > 1,
      });
    };

    img.onerror = () => {
      window.clearTimeout(timer);
      resolve({ width: 0, height: 0, valid: false });
    };

    img.src = src;
  });
};

export const validateDataUriIcon = async (input: string): Promise<boolean> => {
  const raw = input.trim();
  if (!raw.startsWith("data:image/")) return false;
  const meta = raw
    .slice(5, raw.indexOf(",") > 0 ? raw.indexOf(",") : undefined)
    .toLowerCase();
  if (!meta.includes(";base64")) return false;
  const result = await loadImageDimensions(raw);
  return result.valid;
};

export const validateRemoteIconUrl = async (
  input: string,
): Promise<boolean> => {
  const raw = input.trim();
  if (!raw) return false;
  const result = await loadImageDimensions(raw);
  return result.valid;
};

export const validateIconCandidate = async (
  input: string,
): Promise<boolean> => {
  const raw = input.trim();
  if (!raw) return false;
  if (raw.startsWith("data:")) return validateDataUriIcon(raw);
  return validateRemoteIconUrl(raw);
};

const resolveTargetUrl = (form: SmartIconFormState): string => {
  return normalizeSiteUrl(form.url?.trim() || form.lanUrl?.trim() || "");
};

export const useSmartIconMatch = ({
  form,
  onSelect,
  notify,
}: SmartIconMatchOptions) => {
  const smartMatchCandidates = shallowRef<SmartIconCandidate[]>([]);
  const selectedSmartMatchCandidateUrl = ref("");
  const showSmartMatchModal = ref(false);
  const isSmartMatching = ref(false);
  const activeRunId = ref(0);

  const announce = notify ?? (() => undefined);

  const cancelActiveRun = () => {
    activeRunId.value += 1;
    isSmartMatching.value = false;
  };

  const closeSmartMatchModal = () => {
    cancelActiveRun();
    showSmartMatchModal.value = false;
  };

  const applySmartMatchCandidate = (candidate: SmartIconCandidate) => {
    selectedSmartMatchCandidateUrl.value = candidate.url;
    onSelect({
      icon: candidate.url,
      source: candidate.source,
      label: candidate.label,
      backgroundColor: candidate.backgroundColor,
    });
  };

  const selectSmartMatchCandidate = (candidate: SmartIconCandidate) => {
    cancelActiveRun();
    applySmartMatchCandidate(candidate);
    showSmartMatchModal.value = true;
  };

  const smartMatchIcons = async () => {
    const targetUrl = resolveTargetUrl(form.value);
    if (!targetUrl) {
      announce("请先填写链接！");
      return;
    }

    cancelActiveRun();
    const runId = activeRunId.value;
    isSmartMatching.value = true;
    smartMatchCandidates.value = [];
    selectedSmartMatchCandidateUrl.value = "";
    showSmartMatchModal.value = true;

    try {
      const metadata = await fetchSiteMetadata(targetUrl);
      if (activeRunId.value !== runId) return;

      const candidates: SmartIconCandidate[] = [];
      const metadataIcon = metadata?.icon?.trim();
      const metadataBackgroundColor = normalizeIconBackgroundColor(
        metadata?.backgroundColor,
      );
      if (metadataIcon && (await validateIconCandidate(metadataIcon))) {
        candidates.push({
          url: metadataIcon,
          source: "site",
          label: metadata?.title || extractKeywordFromUrl(targetUrl) || "site",
          backgroundColor: metadataBackgroundColor || undefined,
        });
      }

      if (candidates.length === 0) {
        const fallbackIcon = getSiteIconUrl(targetUrl);
        if (fallbackIcon && (await validateIconCandidate(fallbackIcon))) {
          candidates.push({
            url: fallbackIcon,
            source: "site",
            label:
              metadata?.title || extractKeywordFromUrl(targetUrl) || "site",
            backgroundColor: metadataBackgroundColor || undefined,
          });
        }
      }

      if (activeRunId.value !== runId) return;
      smartMatchCandidates.value = candidates;
      const firstCandidate = candidates[0];
      if (firstCandidate) {
        applySmartMatchCandidate(firstCandidate);
      }
    } catch (e) {
      console.warn("Site metadata lookup failed", e);
    } finally {
      if (activeRunId.value !== runId) return;
      isSmartMatching.value = false;
      if (smartMatchCandidates.value.length === 0) {
        announce("未找到匹配的图标，请手动上传或输入图标URL");
        showSmartMatchModal.value = false;
      }
    }
  };

  return {
    smartMatchCandidates,
    selectedSmartMatchCandidateUrl,
    showSmartMatchModal,
    isSmartMatching,
    smartMatchIcons,
    selectSmartMatchCandidate,
    closeSmartMatchModal,
  };
};
