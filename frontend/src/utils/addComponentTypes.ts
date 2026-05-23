import type { NavItem } from "@/types";
import type { WidgetCatalogSizeKey } from "@/utils/widgetCatalog";

export type AddSaveMode = "dirty" | "save" | "save-and-continue";

export interface AddBasePayload {
  destinationGroupId: string;
  saveMode: AddSaveMode;
}

export type AddComponentPayload =
  | (AddBasePayload & {
      kind: "widget";
      catalogItemId: string;
      sizeKey: WidgetCatalogSizeKey;
    })
  | (AddBasePayload & {
      kind: "site-shortcut";
      catalogItemId: string;
      navItem: Omit<NavItem, "id"> & { id?: string };
    })
  | (AddBasePayload & {
      kind: "custom-icon";
      navItem: Omit<NavItem, "id"> & { id?: string };
    });

export type AddComponentResult =
  | { status: "success"; id: string; groupId: string; message?: string }
  | { status: "duplicate"; id: string; groupId?: string; message: string }
  | { status: "validation-error"; message: string }
  | { status: "unauthorized"; message: string }
  | { status: "save-error"; message: string; rolledBack: boolean };
