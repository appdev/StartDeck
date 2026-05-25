# Base UI Components

This directory owns the non-home shared UI primitives and shells for the macOS redesign.

## Rules

- `OverlayMotion.vue` is the only shared dismissal and focus primitive.
- Shared shells consume semantic tokens from `frontend/src/assets/main.css`.
- Feature components should reuse these components before creating a new parallel shell or control.

## Components

| Component                     | Responsibility                                                                                                    | Notes                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `OverlayMotion.vue`           | Overlay, focus trap, Escape, outside-click dismissal contract                                                     | Primitive only                                       |
| `AppWindowBar.vue`            | Shared modal/window title bar with centered title and macOS-vs-standard close affordance contract                 | Used by `AppModalShell`                              |
| `ConfirmDialog.vue`           | Shared confirmation dialog                                                                                        | Rebuilt on top of `AppModalShell`                    |
| `AppModalShell.vue`           | Standard dialog/sheet shell with title, close policy, footer, scheme override                                     | For blocking and ordinary modal flows                |
| `AppSettingsShell.vue`        | Settings window shell with sidebar/content/inspector layout and shared desktop `750px` / mobile fallback contract | For `SettingsModal.vue`                              |
| `AppButton.vue`               | Semantic action button variants and size system                                                                   | Replaces repeated button class bundles               |
| `AppSwitch.vue`               | Shared switch/toggle control                                                                                      | For settings and editors                             |
| `AppSectionCard.vue`          | Grouped section card with title/description/actions slots                                                         | For settings/editor sections                         |
| `AppSegmentedControl.vue`     | Segmented selection control                                                                                       | For mode/tab choices                                 |
| `AppRangeField.vue`           | Label/value/range wrapper                                                                                         | For blur, opacity, size, threshold controls          |
| `AppFieldRow.vue`             | Shared label/help/control row                                                                                     | For grouped settings, credentials, and service forms |
| `ActionFooter.vue`            | Shared footer action row with desktop/mobile stacking                                                             | For settings and editor action zones                 |
| `AppInspectorPanel.vue`       | Shared inspector / preview rail container                                                                         | For settings/editors that need a right-side preview  |
| `BlockingProgressOverlay.vue` | Shared blocking progress surface                                                                                  | For import/restore/backfill flows                    |
| `ToastHost.vue`               | Shared transient feedback host                                                                                    | For app-shell and modal success/error feedback       |
| `StatusBanner.vue`            | Shared non-blocking inline banner                                                                                 | For warnings and persistent notices                  |
| `PopoverSurface.vue`          | Shared popover shell                                                                                              | For anchored lightweight flows                       |
| `ContextMenuSurface.vue`      | Shared context-menu shell                                                                                         | For right-click / long-press command lists           |
| `useDirtyStateGuard.ts`       | Shared ordinary-dialog dirty-close escalation                                                                     | Current first consumer is `EditModal.vue`            |

## Theming

- system light/dark is driven by `prefers-color-scheme`;
- shell-level override uses `data-sd-scheme="light|dark"`;
- feature files should not introduce new standalone dark palettes.

## Feedback Host

- `frontend/src/stores/uiFeedback.ts` owns shared toast, alert, and confirm state.
- `App.vue` is the only global host for `ToastHost`, shared alert shell, and shared confirm dialog.
- feature files should call the shared feedback store instead of native `alert()` / `confirm()`.

## Current Consumers

- `ContextMenuSurface.vue` is currently used by `GridPanel.vue`.
- Compact `AppModalShell` variants are currently used by `MarketplaceModal.vue`.
- `useDirtyStateGuard.ts` is currently used by `EditModal.vue` to route dirty close into a blocking discard confirmation.
