import { useEffect, useId, useRef } from "react";
import { Button } from "./Button";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
      return;
    }

    if (dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={onCancel}
      onClose={onCancel}
      onClick={(event) => {
        if (event.target === dialogRef.current) onCancel();
      }}
    >
      <div className="confirm-dialog__panel" onClick={(event) => event.stopPropagation()}>
        <h2 id={titleId} className="text-lg font-extrabold text-ink dark:text-stone-50">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="mt-2 text-sm leading-6 text-stone-500 dark:text-stone-400">
            {description}
          </p>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" className="min-h-11 w-full sm:w-auto" autoFocus onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            className={tone === "danger" ? "min-h-11 w-full bg-coral shadow-none hover:bg-coral/90 sm:w-auto" : "min-h-11 w-full sm:w-auto"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
