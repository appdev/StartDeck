import { toValue, type MaybeRefOrGetter } from "vue";

export type DirtyCloseReason = "overlay" | "escape" | "programmatic";

interface DirtyStateGuardOptions {
  isDirty: MaybeRefOrGetter<boolean>;
  onCleanClose: (reason: DirtyCloseReason) => void;
  onDirtyAttempt: (reason: DirtyCloseReason) => void;
}

export const useDirtyStateGuard = ({
  isDirty,
  onCleanClose,
  onDirtyAttempt,
}: DirtyStateGuardOptions) => {
  const requestClose = (reason: DirtyCloseReason = "programmatic") => {
    if (toValue(isDirty)) {
      onDirtyAttempt(reason);
      return false;
    }

    onCleanClose(reason);
    return true;
  };

  const handleDismissAttempt = (reason: DirtyCloseReason) =>
    requestClose(reason);

  return {
    requestClose,
    handleDismissAttempt,
  };
};
