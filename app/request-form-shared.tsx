import { siteConfig } from "./site-config";

export function ErrorMessage({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <span className="field-error" id={id} role="alert">
      {message}
    </span>
  );
}

export function PreparedRequest({
  title,
  preparedText,
  copyMessage,
  resultRef,
  onCopy,
  contactLabel,
  contactHref,
}: {
  title: string;
  preparedText: string;
  copyMessage: string;
  resultRef: React.RefObject<HTMLDivElement | null>;
  onCopy: () => void;
  contactLabel: string;
  contactHref: string;
}) {
  if (!preparedText) return null;

  return (
    <div className="prepared-request" ref={resultRef} tabIndex={-1}>
      <h3>{title}</h3>
      <p>
        این متن هنوز برای واحد فروش یا مدیریت ارسال نشده است. آن را کپی کنید و
        هنگام تماس در اختیار پاسخ‌گو بگذارید.
      </p>
      <textarea readOnly value={preparedText} aria-label="متن آماده‌شده درخواست" />
      <PreparedRequestActions
        onCopy={onCopy}
        contactLabel={contactLabel}
        contactHref={contactHref}
        emailTitle={title}
        emailBody={preparedText}
      />
      <p className="copy-status" role="status" aria-live="polite">
        {copyMessage}
      </p>
    </div>
  );
}

export function PreparedRequestActions({
  onCopy,
  copyLabel = "کپی متن درخواست",
  contactLabel,
  contactHref,
  emailTitle,
  emailBody,
}: {
  onCopy: () => void;
  copyLabel?: string;
  contactLabel: string;
  contactHref: string;
  emailTitle?: string;
  emailBody?: string;
}) {
  return (
    <div className="prepared-actions">
      <button type="button" onClick={onCopy}>
        {copyLabel}
      </button>
      <a href={contactHref}>{contactLabel}</a>
      {siteConfig.contact.officialEmail && emailTitle && emailBody ? (
        <a
          href={`mailto:${siteConfig.contact.officialEmail}?subject=${encodeURIComponent(emailTitle)}&body=${encodeURIComponent(emailBody)}`}
        >
          ارسال با ایمیل رسمی
        </a>
      ) : null}
    </div>
  );
}
