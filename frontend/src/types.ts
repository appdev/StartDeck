export type IconBackgroundMode = "auto" | "custom";
export type StartDeckThemeMode = "auto" | "light" | "dark";

export interface NavItem {
  id: string;
  title: string;
  url: string;
  lanUrl?: string;
  backupUrls?: (string | { name: string; url: string })[];
  backupLanUrls?: (string | { name: string; url: string })[];
  icon: string;
  // Horizontal mode custom text lines
  description1?: string;
  description2?: string;
  description3?: string;
  iconBackgroundMode?: IconBackgroundMode;
  iconAutoBackgroundColor?: string;
  iconCustomBackgroundColor?: string;
  color?: string;
  titleColor?: string;
  isPublic?: boolean;
  backgroundImage?: string;
  backgroundBlur?: number;
  backgroundMask?: number;
  iconSize?: number;
  containerId?: string;
  containerName?: string;
  allowRestart?: boolean;
  allowStop?: boolean;
}

export interface NavGroup {
  id: string;
  title: string;
  icon?: string;
  items: NavItem[];
  isPublic?: boolean;
  titleColor?: string;
  preset?: boolean;
  cardLayout?: "vertical" | "horizontal" | string;
  iconShape?:
    | "circle"
    | "rounded"
    | "leaf"
    | "square"
    | "diamond"
    | "pentagon"
    | "hexagon"
    | "octagon"
    | "none"
    | "hidden"
    | string;
  cardBgColor?: string;
  cardTitleColor?: string;
  cardTitleSize?: number;
  showCardBackground?: boolean;
  backgroundImage?: string;
  backgroundBlur?: number;
  backgroundMask?: number;
  autoHideTitle?: boolean;
  // Layout config overrides
  gridGap?: number;
  cardSize?: number;
  gap?: number;
  minWidth?: number;
  height?: number;
  iconSize?: number;
}

export interface CustomScript {
  id: string;
  name: string;
  content: string;
  enable: boolean;
  useProxy?: boolean;
}

export interface SearchEngine {
  id: string;
  key: string;
  label: string;
  urlTemplate: string;
  icon?: string;
  iconSourceUrl?: string;
  iconFetchedAt?: string;
  iconBackgroundMode?: IconBackgroundMode;
  iconAutoBackgroundColor?: string;
  iconCustomBackgroundColor?: string;
  custom?: boolean;
}

export interface WallpaperConfig {
  type: "api" | "local";
  url: string;
  enabled: boolean;
  lastUpdated?: number;
}

export interface NetworkLocationAddress {
  key: string;
  label: string;
  country: string;
  province: string;
  city: string;
  district: string;
}

export interface AppConfig {
  background: string;
  mobileBackground?: string;
  wallpaperConfig?: WallpaperConfig;
  mobileWallpaperConfig?: WallpaperConfig;
  solidBackgroundColor?: string;
  enableMobileWallpaper?: boolean;
  pcRotation?: boolean;
  pcRotationInterval?: number;
  pcRotationMode?: "random" | "sequential";
  mobileRotation?: boolean;
  mobileRotationInterval?: number;
  mobileRotationMode?: "random" | "sequential";
  deviceMode?: "auto" | "desktop" | "tablet" | "mobile";
  webGroupPagination?: boolean;
  webGroupPaginationDisableFlip?: boolean;
  backgroundBlur?: number;
  backgroundMask?: number;
  mobileBackgroundBlur?: number;
  mobileBackgroundMask?: number;
  themeMode?: StartDeckThemeMode;
  daylightModeEnabled?: boolean;
  daylightMask?: number;
  internalDomains?: string;
  internalLocation?: NetworkLocationAddress | null;
  networkRules?: string;
  networkPresets?: {
    tailscale?: boolean;
    zerotier?: boolean;
    frp?: boolean;
    cloudflareTunnel?: boolean;
    ngrok?: boolean;
  };
  forceNetworkMode?: "auto" | "lan" | "wan" | "latency";
  latencyThresholdMs?: number;
  whitelistLatencyMode?: boolean;
  customTitle: string;
  titleAlign: "left" | "center" | "right" | string;
  titleSize: number;
  titleColor: string;
  cardLayout: "vertical" | "horizontal" | string;
  cardBgColor: string;
  cardTitleColor: string;
  cardBorderColor: string;
  showCardBackground: boolean;
  iconShape:
    | "circle"
    | "rounded"
    | "leaf"
    | "square"
    | "diamond"
    | "pentagon"
    | "hexagon"
    | "octagon"
    | "none"
    | "hidden"
    | string;
  showHomeTitle?: boolean;
  showHomeTime?: boolean;
  showHomeSearch?: boolean;
  searchEngines?: SearchEngine[];
  defaultSearchEngine?: string;
  rememberLastEngine?: boolean;
  groupTitleColor: string;
  showFooterStats?: boolean;
  footerHtml?: string;
  footerHeight?: number;
  footerWidth?: number;
  footerMarginBottom?: number;
  footerFontSize?: number;
  // Wallpaper API management
  wallpaperApiPcList?: string;
  wallpaperApiPcUpload?: string;
  wallpaperApiPcDeleteBase?: string;
  wallpaperPcImageBase?: string;
  wallpaperApiMobileList?: string;
  wallpaperApiMobileUpload?: string;
  wallpaperApiMobileDeleteBase?: string;
  wallpaperMobileImageBase?: string;
  // Wallpaper Sorting
  pcWallpaperOrder?: string[];
  mobileWallpaperOrder?: string[];
  empireMode?: boolean;
  customCss?: string;
  customCssList?: CustomScript[];
  customJs?: string;
  customJsList?: CustomScript[];
  mouseHoverEffect?: "scale" | "lift" | "glow" | "none" | string;
  autoUltrawide?: boolean;
  hideHeaderOnMobile?: boolean;
}

export interface SystemConfig {
  enableDocker: boolean;
  dockerHost?: string;
}

export interface WidgetConfig {
  id: string;
  type: string;
  enable: boolean;
  colSpan?: number;
  rowSpan?: number;
  // Grid Layout props
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  isPublic?: boolean;
  hideOnMobile?: boolean;
  opacity?: number;
  textColor?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  layouts?: {
    desktop?: { x: number; y: number; w: number; h: number };
    tablet?: { x: number; y: number; w: number; h: number };
    mobile?: { x: number; y: number; w: number; h: number };
  };
}

export interface SimpleIcon {
  title: string;
  slug: string;
  hex: string;
  source: string;
  svg: string;
  path: string;
  guidelines?: string;
  license?: {
    type: string;
    url: string;
  };
}

export interface AliIcon {
  name: string;
  cnName: string;
  domain: string;
  filename: string;
  url: string;
  downloadUrl: string;
}

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

export interface LuckyStunData {
  ts?: number;
  data?: {
    stun?: string;
    port?: string | number;
    ip?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
