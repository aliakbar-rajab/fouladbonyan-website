import { useCallback, useEffect, useRef, useState } from "react";

type DialogAction = {
  id: string;
  label: string;
  primary?: boolean;
  danger?: boolean;
};

type DialogOptions = {
  title: string;
  message: string;
  details?: string[];
  inputValue?: string;
  actions?: DialogAction[];
};

type DialogResult = { action: string; value: string };

type DialogState = (DialogOptions & { hasInput: boolean; actions: DialogAction[] }) | null;

/**
 * Promise-based confirm/prompt dialog, ported from the standalone
 * پیش‌فاکتور app's showAppDialog/confirmApp (js/app.js). A second call while
 * one dialog is still open resolves the first as a cancel before replacing
 * it, exactly like the original — the abandoned caller sees what it would
 * see had the user clicked «انصراف».
 */
export function useAppDialog() {
  const [state, setState] = useState<DialogState>(null);
  const [inputValue, setInputValue] = useState("");
  const resolveRef = useRef<((result: DialogResult) => void) | null>(null);
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dialogElRef = useRef<HTMLDialogElement | null>(null);

  const close = useCallback((result: DialogResult) => {
    dialogElRef.current?.close();
    setState(null);
    const resolve = resolveRef.current;
    resolveRef.current = null;
    resolve?.(result);
  }, []);

  const show = useCallback((options: DialogOptions): Promise<DialogResult> => {
    if (resolveRef.current) {
      const abandoned = resolveRef.current;
      resolveRef.current = null;
      abandoned({ action: "cancel", value: "" });
    }
    const hasInput = options.inputValue !== undefined;
    const actions = options.actions ?? [
      { id: "ok", label: "تأیید", primary: true },
      { id: "cancel", label: "انصراف" },
    ];
    setInputValue(options.inputValue ?? "");
    setState({ ...options, hasInput, actions });
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const confirmApp = useCallback(
    (title: string, message: string, confirmLabel?: string, danger?: boolean) =>
      show({
        title,
        message,
        actions: [
          { id: "confirm", label: confirmLabel || "تأیید", primary: !danger, danger: !!danger },
          { id: "cancel", label: "انصراف" },
        ],
      }).then((result) => result.action === "confirm"),
    [show],
  );

  const info = useCallback(
    (title: string, message: string, details?: string[]) =>
      show({ title, message, details, actions: [{ id: "ok", label: "متوجه شدم", primary: true }] }),
    [show],
  );

  // A native <dialog> instead of a hand-rolled backdrop + focus trap: showModal()
  // gets us top-layer stacking, a real ::backdrop, Tab contained inside the
  // dialog, and Escape (as the "cancel" event, handled below) for free.
  useEffect(() => {
    const el = dialogElRef.current;
    if (!el) return;
    if (state && !el.open) el.showModal();
    else if (!state && el.open) el.close();
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const timer = window.setTimeout(() => {
      if (state.hasInput) {
        inputRef.current?.focus();
        inputRef.current?.select();
      } else {
        primaryButtonRef.current?.focus();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [state]);

  const dialog = (
    <dialog
      ref={dialogElRef}
      className="preinv-dialog no-print"
      aria-labelledby="preinv-dialog-title"
      aria-describedby="preinv-dialog-message"
      onCancel={(event) => {
        // The browser's own Escape handling fires this; route it through
        // close() so the pending promise still resolves (as a cancel).
        event.preventDefault();
        close({ action: "cancel", value: "" });
      }}
    >
      {state ? (
        <>
          <h2 id="preinv-dialog-title">{state.title}</h2>
          <p id="preinv-dialog-message">{state.message}</p>
          {state.details && state.details.length > 0 ? (
            <ul className="preinv-dialog-details">
              {state.details.map((text, index) => (
                <li key={index}>{text}</li>
              ))}
            </ul>
          ) : null}
          {state.hasInput ? (
            <label className="preinv-dialog-input-wrap">
              <span>نام سند</span>
              <input
                ref={inputRef}
                type="text"
                autoComplete="off"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  primaryButtonRef.current?.click();
                }}
              />
            </label>
          ) : null}
          <div className="preinv-dialog-actions">
            {state.actions.map((action) => (
              <button
                key={action.id}
                type="button"
                ref={action.primary ? primaryButtonRef : undefined}
                className={action.primary ? "primary" : action.danger ? "danger" : undefined}
                onClick={() => close({ action: action.id, value: inputValue.trim() })}
              >
                {action.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </dialog>
  );

  return { dialog, show, confirmApp, info, isOpen: state !== null };
}
