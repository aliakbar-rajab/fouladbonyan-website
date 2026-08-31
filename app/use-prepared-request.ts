import { useRef, useState } from "react";

export function usePreparedRequest() {
  const [preparedText, setPreparedText] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);

  /*
   * `resultRef` has to be attached by the caller for the focus move to happen;
   * PreparedRequest does that, and the quote form -- which renders its own
   * QuoteDocument instead -- moves focus there itself. Guarded rather than
   * assumed, so a caller that never mounts the panel is simply a caller that
   * does not get the focus move.
   */
  const prepare = (text: string) => {
    setPreparedText(text);
    setCopyMessage("");
    window.requestAnimationFrame(() => resultRef.current?.focus());
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(preparedText);
      setCopyMessage("متن درخواست کپی شد.");
    } catch {
      setCopyMessage(
        "کپی خودکار ممکن نشد؛ متن را انتخاب و به‌صورت دستی کپی کنید.",
      );
    }
  };

  const clear = () => {
    setPreparedText("");
    setCopyMessage("");
  };

  return { preparedText, copyMessage, resultRef, prepare, copy, clear };
}
