import { sessionFetch } from "@/utils/sessionFetch";

export type SdWallpaperLocalAssetTarget = "pc" | "mobile";

export type SdWallpaperLocalAssetResult = {
  sourceUrl: string;
  localPath: string;
  filename: string;
  target: SdWallpaperLocalAssetTarget;
};

export type SdWallpaperLocalAssetErrorCode =
  | "missing_source"
  | "proxy_failed"
  | "invalid_blob"
  | "upload_failed"
  | "missing_local_path";

export class SdWallpaperLocalAssetError extends Error {
  code: SdWallpaperLocalAssetErrorCode;

  constructor(code: SdWallpaperLocalAssetErrorCode, message: string) {
    super(message);
    this.name = "SdWallpaperLocalAssetError";
    this.code = code;
  }
}

const DEFAULT_UPLOAD_ENDPOINTS: Record<SdWallpaperLocalAssetTarget, string> = {
  pc: "/api/backgrounds/upload",
  mobile: "/api/mobile_backgrounds/upload",
};

const stripTransientQueryParams = (url: string) => {
  if (!url) return "";
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;
  try {
    const parsed = new URL(url, window.location.origin);
    parsed.searchParams.delete("t");
    parsed.searchParams.delete("v");
    if (/^https?:\/\//.test(url)) {
      return `${parsed.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url.replace(/([?&])(t|v)=\d+/g, "$1").replace(/[?&]$/, "");
  }
};

const inferImageExtension = (blob: Blob, urlHint: string) => {
  const mime = (blob.type || "").toLowerCase();
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("svg")) return "svg";
  if (mime.includes("bmp")) return "bmp";
  if (mime.includes("avif")) return "avif";

  const normalizedHint = stripTransientQueryParams(urlHint);
  const matched = normalizedHint.match(/\.([a-zA-Z0-9]+)(?:$|[?#])/);
  return matched?.[1]?.toLowerCase() || "jpg";
};

const normalizeFilenameSeed = (seed: string) =>
  seed.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "") ||
  "bing-wallpaper";

const filenameFromPath = (path: string) => {
  const cleanPath = path.split(/[?#]/, 1)[0] || "";
  const filename = cleanPath.slice(cleanPath.lastIndexOf("/") + 1);
  return decodeURIComponent(filename || "");
};

const readUploadError = async (response: Response) => {
  const text = await response.text().catch(() => "");
  return text || response.statusText || `HTTP ${response.status}`;
};

const assertImageBlob = (blob: Blob | null) => {
  if (!blob || blob.size <= 0) {
    throw new SdWallpaperLocalAssetError(
      "invalid_blob",
      "壁纸代理返回了空图片。",
    );
  }
  if (!(blob.type || "").toLowerCase().startsWith("image/")) {
    throw new SdWallpaperLocalAssetError(
      "invalid_blob",
      "壁纸代理返回的内容不是图片。",
    );
  }
};

type UploadPayload = {
  success?: unknown;
  files?: Array<{
    path?: unknown;
    filename?: unknown;
  }>;
};

export const localizeSdWallpaperAsset = async (options: {
  sourceUrl: string;
  filenameSeed: string;
  target?: SdWallpaperLocalAssetTarget;
  uploadEndpoint?: string;
  requestId?: string;
}): Promise<SdWallpaperLocalAssetResult> => {
  const sourceUrl = stripTransientQueryParams(options.sourceUrl || "");
  if (!sourceUrl) {
    throw new SdWallpaperLocalAssetError(
      "missing_source",
      "壁纸缺少可下载的高清地址。",
    );
  }

  const target = options.target || "pc";
  const requestId =
    options.requestId || `bing-${normalizeFilenameSeed(options.filenameSeed)}-${Date.now()}`;
  const proxyResponse = await sessionFetch(
    `/api/wallpaper/proxy?url=${encodeURIComponent(sourceUrl)}&uuid=${encodeURIComponent(requestId)}`,
  );
  if (!proxyResponse.ok) {
    throw new SdWallpaperLocalAssetError(
      "proxy_failed",
      `壁纸代理请求失败：${proxyResponse.status}`,
    );
  }

  const blob = await proxyResponse.blob();
  assertImageBlob(blob);

  const formData = new FormData();
  const extension = inferImageExtension(blob, sourceUrl);
  const uploadFilename = `${normalizeFilenameSeed(options.filenameSeed)}_${Date.now()}.${extension}`;
  formData.append("files", blob, uploadFilename);

  const uploadResponse = await sessionFetch(
    options.uploadEndpoint || DEFAULT_UPLOAD_ENDPOINTS[target],
    {
      method: "POST",
      body: formData,
    },
  );
  if (!uploadResponse.ok) {
    throw new SdWallpaperLocalAssetError(
      "upload_failed",
      `壁纸上传失败：${await readUploadError(uploadResponse)}`,
    );
  }

  const payload = (await uploadResponse.json().catch(() => null)) as
    | UploadPayload
    | null;
  const firstFile = payload?.files?.[0];
  const localPath = typeof firstFile?.path === "string" ? firstFile.path : "";
  if (payload?.success !== true || !localPath) {
    throw new SdWallpaperLocalAssetError(
      "missing_local_path",
      "壁纸上传结果缺少本地路径。",
    );
  }

  const filename =
    typeof firstFile?.filename === "string" && firstFile.filename
      ? firstFile.filename
      : filenameFromPath(localPath);

  return {
    sourceUrl,
    localPath,
    filename,
    target,
  };
};
