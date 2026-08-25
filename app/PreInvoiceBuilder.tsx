import {
  ChangeEvent,
  FocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { siteConfig } from "./site-config";
import { toPersianDigits } from "./site-logic.mjs";
import {
  calculateInvoiceTotals,
  commitInvoiceNumber,
  defaultInvoiceRowCount,
  formatMoneyOrDash,
  makeBlankRow,
  makeBlankRows,
  netTotalWords,
  rowIsBlank,
  suggestInvoiceNumber,
  validateInvoiceForOutput,
} from "./preinvoice-engine";
import {
  DEFAULT_VALIDITY_MODE,
  resolveValidityValue,
  todayJalaliString,
  type ValidityMode,
} from "./preinvoice-dates";
import {
  formatBigRial,
  formatPercentBps,
  formatQtyMilli,
  strictMoney,
  strictPercent,
  strictQuantity,
} from "./preinvoice-numbers";
import {
  cleanupPrintDocument,
  preparePrintPlan,
  type PrintContext,
} from "./preinvoice-print";
import { useAppDialog } from "./preinvoice-dialog";
import type {
  InvoiceBuyer,
  InvoiceData,
  InvoiceItem,
  InvoiceOrientation,
  RowCalculation,
  SavedInvoiceEntry,
} from "./preinvoice-types";

const MM_TO_PX = 96 / 25.4;
const SAVED_ENTRY_PREFIX = "preinvoice.saved.entry.v1.";
const FIT_MIN_SCALE = 0.82;
const FIT_STEP = 0.03;
const FIT_SLACK_PX = 1;

const ROW_FIELD_LABELS: Record<keyof Omit<InvoiceItem, "id">, string> = {
  description: "شرح کالا یا خدمت",
  quantity: "تعداد یا مقدار",
  unit: "واحد",
  unitPrice: "مبلغ واحد",
  discount: "تخفیف",
};

/** Real, confirmed Foulad Bonyan Daria seller record — never editable here. */
const SELLER = {
  name: siteConfig.brand.name,
  nationalId: toPersianDigits(siteConfig.business.nationalId ?? ""),
  address: `${siteConfig.business.address}، ${siteConfig.business.city}`,
  postalCode: toPersianDigits(siteConfig.business.postalCode),
  phone: siteConfig.contact.phones.map((phone) => phone.label).join(" / "),
  website: siteConfig.siteUrl.replace(/^https?:\/\//, ""),
  logo: "/brand/preinvoice-logo-mark.png",
  stamp: "/brand/preinvoice-stamp.png",
};

function itemIndexLabel(index: number) {
  return toPersianDigits(index + 1);
}

function toPersianDigitsLive(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): string {
  const el = event.target;
  const converted = toPersianDigits(el.value);
  if (converted === el.value) return converted;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  el.value = converted;
  if (start !== null && end !== null) el.setSelectionRange(start, end);
  return converted;
}

function fitNumericEl(el: HTMLElement) {
  el.style.fontSize = "";
  el.classList.remove("numeric-overflow");
  if (!el.isConnected) return;
  const available = el.clientWidth + FIT_SLACK_PX;
  if (el.clientWidth === 0 || el.scrollWidth <= available) return;
  const basePx = parseFloat(window.getComputedStyle(el).fontSize);
  if (!basePx) return;
  let scale = 1;
  while (scale - FIT_STEP >= FIT_MIN_SCALE) {
    scale -= FIT_STEP;
    el.style.fontSize = (basePx * scale).toFixed(2) + "px";
    if (el.scrollWidth <= available) return;
  }
  el.classList.add("numeric-overflow");
}

function autoGrowTextarea(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = Math.max(el.scrollHeight, 18) + "px";
}

function makeBlankInvoice(nextRowId: { current: number }): InvoiceData {
  const orientation: InvoiceOrientation = "landscape";
  const invoiceDate = todayJalaliString();
  const items = makeBlankRows(defaultInvoiceRowCount(orientation), nextRowId.current);
  nextRowId.current += items.length;
  return {
    version: 1,
    orientation,
    headerGray: true,
    meta: {
      title: "پیش‌فاکتور",
      date: invoiceDate,
      number: suggestInvoiceNumber(invoiceDate),
      validityMode: DEFAULT_VALIDITY_MODE,
      validity: resolveValidityValue(DEFAULT_VALIDITY_MODE, invoiceDate),
    },
    buyer: { name: "", nationalId: "", address: "", postalCode: "", phone: "" },
    taxPercent: "۱۰",
    notes: "",
    includeStamp: true,
    items,
  };
}

/**
 * Deterministic placeholder shown for the one tick before the boot effect
 * replaces it with makeBlankInvoice's real (today's-date, suggested-number)
 * data. Unlike makeBlankInvoice, this touches neither the clock nor
 * localStorage, so it's safe to use as a useState initializer — reading
 * either of those directly during render is what React's purity rules (and
 * this project's lint config) forbid.
 */
function makeBootShellInvoice(): InvoiceData {
  const orientation: InvoiceOrientation = "landscape";
  return {
    version: 1,
    orientation,
    headerGray: true,
    meta: { title: "پیش‌فاکتور", date: "", number: "", validityMode: DEFAULT_VALIDITY_MODE, validity: "" },
    buyer: { name: "", nationalId: "", address: "", postalCode: "", phone: "" },
    taxPercent: "۱۰",
    notes: "",
    includeStamp: true,
    items: makeBlankRows(defaultInvoiceRowCount(orientation), 1),
  };
}

// Date.now()/Math.random() are impure and must not be called directly inside
// the component (React's purity rules apply to any code reachable from it,
// event handlers included) — kept as ordinary module-level helpers instead.
function generateSavedEntryId(): string {
  return "inv-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

function currentTimestampMs(): number {
  return Date.now();
}

function loadSavedList(): Record<string, SavedInvoiceEntry> {
  const list: Record<string, SavedInvoiceEntry> = {};
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || key.indexOf(SAVED_ENTRY_PREFIX) !== 0) continue;
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || "null");
        if (!parsed || typeof parsed !== "object") continue;
        const id = String(parsed.id || key.slice(SAVED_ENTRY_PREFIX.length));
        if (!id || !parsed.data) continue;
        list[id] = {
          id,
          name: String(parsed.name || "پیش‌فاکتور بدون نام"),
          savedAt: Number(parsed.savedAt) || 0,
          data: parsed.data as InvoiceData,
        };
      } catch {
        // Skip a corrupted individual entry; the rest of the list stays usable.
      }
    }
  } catch {
    // Storage inaccessible (private mode, disabled) — behave as an empty list.
  }
  return list;
}

function persistSavedEntry(entry: SavedInvoiceEntry) {
  localStorage.setItem(SAVED_ENTRY_PREFIX + entry.id, JSON.stringify(entry));
}

function removeSavedEntry(id: string) {
  localStorage.removeItem(SAVED_ENTRY_PREFIX + id);
}

function suggestEntryName(data: InvoiceData): string {
  if (data.buyer.name) return data.buyer.name;
  if (data.meta.date) return "پیش‌فاکتور " + data.meta.date;
  try {
    return "پیش‌فاکتور " + new Date().toLocaleTimeString("fa-IR");
  } catch {
    return "پیش‌فاکتور جدید";
  }
}

function formatSavedTime(ts: number): string {
  try {
    const d = new Date(ts);
    return d.toLocaleDateString("fa-IR") + " — " + d.toLocaleTimeString("fa-IR");
  } catch {
    return "";
  }
}

function safeFilenamePart(value: string): string {
  return value
    .replace(/[۰-۹٠-٩]/g, (d) => String(d.charCodeAt(0) & 0xf))
    .replace(/[\\/:*?"<>|\s]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeInvoiceData(raw: unknown, nextRowId: { current: number }): InvoiceData | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!r.meta || typeof r.meta !== "object") return null;
  if (!Array.isArray(r.items)) return null;
  const meta = r.meta as Record<string, unknown>;
  const buyer = (r.buyer && typeof r.buyer === "object" ? r.buyer : {}) as Record<string, unknown>;
  const orientation: InvoiceOrientation = r.orientation === "portrait" ? "portrait" : "landscape";
  const items: InvoiceItem[] = r.items.map((row) => {
    const item = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
    const id = nextRowId.current++;
    return {
      id,
      description: String(item.description ?? ""),
      quantity: String(item.quantity ?? ""),
      unit: String(item.unit ?? ""),
      unitPrice: String(item.unitPrice ?? ""),
      discount: String(item.discount ?? ""),
    };
  });
  const validityMode: ValidityMode =
    meta.validityMode === "tomorrow" || meta.validityMode === "manual" ? meta.validityMode : "today";
  return {
    version: 1,
    orientation,
    headerGray: r.headerGray != null ? !!r.headerGray : true,
    meta: {
      title: String(meta.title ?? "پیش‌فاکتور"),
      date: String(meta.date ?? ""),
      number: String(meta.number ?? ""),
      validityMode,
      validity: String(meta.validity ?? ""),
    },
    buyer: {
      name: String(buyer.name ?? ""),
      nationalId: String(buyer.nationalId ?? ""),
      address: String(buyer.address ?? ""),
      postalCode: String(buyer.postalCode ?? ""),
      phone: String(buyer.phone ?? ""),
    },
    taxPercent: String(r.taxPercent ?? "۱۰"),
    notes: String(r.notes ?? ""),
    includeStamp: r.includeStamp != null ? !!r.includeStamp : true,
    items: items.length ? items : makeBlankRows(defaultInvoiceRowCount(orientation), nextRowId.current),
  };
}

export function PreInvoiceBuilder() {
  const nextRowId = useRef(1000);
  const [data, setData] = useState<InvoiceData>(makeBootShellInvoice);
  const [isDirty, setIsDirty] = useState(false);
  const [status, setStatus] = useState("در حال آماده‌سازی…");
  const [validationRequested, setValidationRequested] = useState(false);
  const [savedPanelOpen, setSavedPanelOpen] = useState(false);
  const [savedEntries, setSavedEntries] = useState<Record<string, SavedInvoiceEntry>>({});
  const [busy, setBusy] = useState(false);
  // Rendered in the toolbar (current-document label, saved-list highlight),
  // so these live in state rather than a ref — React's purity rules forbid
  // reading a ref's .current during render.
  const [currentSavedId, setCurrentSavedId] = useState<string | null>(null);
  const [currentSavedName, setCurrentSavedName] = useState("");

  const currentSavedVersion = useRef<number | null>(null);
  const defaultRowCountManaged = useRef(true);
  const numberIsAutoSuggested = useRef(true);
  const dateIsAutoSuggested = useRef(true);
  const validityIsAutoSuggested = useRef(true);
  const prefillApplied = useRef(false);

  const sheetRef = useRef<HTMLElement>(null);
  const scaleWrapperRef = useRef<HTMLDivElement>(null);
  const printDocumentRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const validityInputRef = useRef<HTMLInputElement>(null);

  const { dialog, show, confirmApp, info } = useAppDialog();

  const totals = useMemo(() => calculateInvoiceTotals(data), [data]);

  const refreshSavedList = useCallback(() => setSavedEntries(loadSavedList()), []);

  // ---------- Boot: today's date, a suggested number, and the saved list ----------
  // Reads the clock and localStorage, so it can't run during render (see
  // makeBootShellInvoice above) — deferred one microtask, matching how the
  // rest of this codebase shapes effects that must resolve external state
  // before calling setState (see useMarketPrices).
  useEffect(() => {
    let active = true;
    (async () => {
      await Promise.resolve();
      if (!active) return;
      setData(makeBlankInvoice(nextRowId));
      refreshSavedList();
      setStatus("آماده برای ثبت پیش‌فاکتور جدید.");
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Deep link from a catalog price row: ?product=&dimensions= ----------
  useEffect(() => {
    if (prefillApplied.current) return;
    prefillApplied.current = true;
    const params = new URLSearchParams(window.location.search);
    const product = params.get("product")?.trim() ?? "";
    const dimensions = params.get("dimensions")?.slice(0, 240).trim() ?? "";
    const description = [product, dimensions].filter(Boolean).join(" ");
    if (!description) return;
    setData((current) => {
      const first = current.items[0];
      if (!first || first.description) return current;
      defaultRowCountManaged.current = false;
      return { ...current, items: [{ ...first, description }, ...current.items.slice(1)] };
    });
  }, []);

  // ---------- Shrink-to-fit + textarea auto-grow after every render ----------
  // useLayoutEffect (not useEffect): printInvoice() forces a synchronous
  // re-render via flushSync and then immediately inspects the DOM for
  // .numeric-overflow to decide whether to force landscape — that check only
  // sees this pass's work if it runs during the commit, before paint.
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.querySelectorAll<HTMLElement>(".inv-autogrow, .inv-textarea, .cell-textarea").forEach((el) => {
      if (el instanceof HTMLTextAreaElement) autoGrowTextarea(el);
    });
    sheet
      .querySelectorAll<HTMLElement>(
        ".cell-computed, .cell-input-num, .inv-tax-percent, .inv-meta .inv-input",
      )
      .forEach(fitNumericEl);
    sheet.querySelectorAll<HTMLElement>("[data-total]").forEach((el) => {
      if (el.getAttribute("data-total") !== "netTotalWords") fitNumericEl(el);
    });
  });

  // ---------- Screen preview scaling ----------
  useEffect(() => {
    const fit = () => {
      const wrapper = scaleWrapperRef.current;
      if (!wrapper) return;
      const sheetWidthPx = (data.orientation === "landscape" ? 297 : 210) * MM_TO_PX;
      const available = document.documentElement.clientWidth - 32;
      const scale = Math.min(1, available / sheetWidthPx);
      wrapper.style.zoom = scale >= 1 ? "" : String(scale);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [data.orientation]);

  // ---------- Keep automatic date/number/validity glued to "today" ----------
  const refreshAutomaticTemporalFields = useCallback(
    (current: InvoiceData, markDirty: boolean): InvoiceData => {
      let next = current;
      let changed = false;
      const today = todayJalaliString();

      if (dateIsAutoSuggested.current && today && next.meta.date !== today) {
        next = { ...next, meta: { ...next.meta, date: today } };
        changed = true;
      }
      if (numberIsAutoSuggested.current) {
        const latest = suggestInvoiceNumber(next.meta.date);
        if (latest && latest !== next.meta.number) {
          next = { ...next, meta: { ...next.meta, number: latest } };
          changed = true;
        }
      }
      if (validityIsAutoSuggested.current && next.meta.validityMode !== "manual") {
        const validity = resolveValidityValue(next.meta.validityMode, next.meta.date);
        if (validity !== next.meta.validity) {
          next = { ...next, meta: { ...next.meta, validity } };
          changed = true;
        }
      }
      if (changed && markDirty) setIsDirty(true);
      return next;
    },
    [],
  );

  useEffect(() => {
    const onFocus = () => setData((current) => refreshAutomaticTemporalFields(current, true));
    const onVisibility = () => {
      if (!document.hidden) setData((current) => refreshAutomaticTemporalFields(current, true));
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshAutomaticTemporalFields]);

  // ---------- beforeunload guard ----------
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const markTouched = () => {
    defaultRowCountManaged.current = false;
  };

  const updateItem = (id: number, patch: Partial<InvoiceItem>) => {
    markTouched();
    setData((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
    setIsDirty(true);
    setStatus("تغییرات ذخیره‌نشده");
  };

  const addRow = () => {
    markTouched();
    const id = nextRowId.current++;
    setData((current) => ({ ...current, items: [...current.items, makeBlankRow(id)] }));
    setIsDirty(true);
    setStatus("تغییرات ذخیره‌نشده");
    window.requestAnimationFrame(() => {
      const target = sheetRef.current?.querySelector<HTMLElement>(`[data-row-id="${id}"] [data-row-field="description"]`);
      target?.focus();
    });
    return id;
  };

  const deleteRow = async (id: number) => {
    const item = data.items.find((row) => row.id === id);
    if (item && !rowIsBlank(item)) {
      const confirmed = await confirmApp("حذف قلم", "این قلم از پیش‌فاکتور حذف شود؟", "حذف", true);
      if (!confirmed) return;
    }
    markTouched();
    setData((current) => ({ ...current, items: current.items.filter((row) => row.id !== id) }));
    setIsDirty(true);
    setStatus("قلم حذف شد؛ تغییرات ذخیره‌نشده");
  };

  const handleRowEnter = (field: keyof Omit<InvoiceItem, "id">, rowId: number) => {
    const index = data.items.findIndex((row) => row.id === rowId);
    const next = data.items[index + 1];
    if (next) {
      const target = sheetRef.current?.querySelector<HTMLElement>(`[data-row-id="${next.id}"] [data-row-field="${field}"]`);
      target?.focus();
    } else {
      const newId = addRow();
      window.requestAnimationFrame(() => {
        const target = sheetRef.current?.querySelector<HTMLElement>(`[data-row-id="${newId}"] [data-row-field="${field}"]`);
        target?.focus();
      });
    }
  };

  const setOrientation = (orientation: InvoiceOrientation) => {
    setData((current) => {
      if (current.orientation === orientation) return current;
      let items = current.items;
      if (defaultRowCountManaged.current) {
        const expectedCurrentCount = defaultInvoiceRowCount(current.orientation);
        if (items.length !== expectedCurrentCount || items.some((item) => !rowIsBlank(item))) {
          defaultRowCountManaged.current = false;
        } else {
          const targetCount = defaultInvoiceRowCount(orientation);
          const next = items.slice();
          while (next.length < targetCount) next.push(makeBlankRow(nextRowId.current++));
          while (next.length > targetCount) next.pop();
          items = next;
        }
      }
      return { ...current, orientation, items };
    });
    setIsDirty(true);
    setStatus("جهت چاپ: " + (orientation === "landscape" ? "افقی" : "عمودی"));
  };

  const updateBuyer = (patch: Partial<InvoiceBuyer>) => {
    setData((current) => ({ ...current, buyer: { ...current.buyer, ...patch } }));
    setIsDirty(true);
    setStatus("تغییرات ذخیره‌نشده");
  };

  const updateMetaDate = (value: string) => {
    dateIsAutoSuggested.current = false;
    setData((current) => ({ ...current, meta: { ...current.meta, date: value } }));
    setIsDirty(true);
    setStatus("تغییرات ذخیره‌نشده");
  };

  const commitMetaDateBlur = () => {
    setData((current) => {
      let next = current;
      if (numberIsAutoSuggested.current) {
        const latest = suggestInvoiceNumber(current.meta.date);
        if (latest && latest !== current.meta.number) next = { ...next, meta: { ...next.meta, number: latest } };
      }
      if (current.meta.validityMode !== "manual") {
        const validity = resolveValidityValue(current.meta.validityMode, current.meta.date);
        if (validity !== current.meta.validity) next = { ...next, meta: { ...next.meta, validity } };
      }
      return next;
    });
  };

  const updateMetaNumber = (value: string) => {
    numberIsAutoSuggested.current = false;
    setData((current) => ({ ...current, meta: { ...current.meta, number: value } }));
    setIsDirty(true);
    setStatus("تغییرات ذخیره‌نشده");
  };

  const updateValidityMode = (mode: ValidityMode) => {
    validityIsAutoSuggested.current = mode !== "manual";
    setData((current) => ({
      ...current,
      meta: { ...current.meta, validityMode: mode, validity: resolveValidityValue(mode, current.meta.date) },
    }));
    setIsDirty(true);
    setStatus("تغییرات ذخیره‌نشده");
    if (mode === "manual") {
      window.requestAnimationFrame(() => validityInputRef.current?.focus());
    }
  };

  const updateValidityManual = (value: string) => {
    validityIsAutoSuggested.current = false;
    setData((current) => ({ ...current, meta: { ...current.meta, validity: value } }));
    setIsDirty(true);
    setStatus("تغییرات ذخیره‌نشده");
  };

  const updateTaxPercent = (value: string) => {
    setData((current) => ({ ...current, taxPercent: value }));
    setIsDirty(true);
    setStatus("تغییرات ذخیره‌نشده");
  };

  const commitTaxPercentBlur = () => {
    setData((current) => {
      const percent = strictPercent(current.taxPercent);
      if (!percent.valid) return current;
      return { ...current, taxPercent: formatPercentBps(percent.value) };
    });
  };

  // ---------- New / Save / Open / Export ----------

  const startNew = async () => {
    if (isDirty) {
      const confirmed = await confirmApp("پیش‌فاکتور جدید", "تغییرات ذخیره‌نشده از بین می‌رود. یک سند جدید ایجاد شود؟", "ایجاد سند جدید");
      if (!confirmed) return;
    }
    setData(makeBlankInvoice(nextRowId));
    setCurrentSavedId(null);
    setCurrentSavedName("");
    currentSavedVersion.current = null;
    defaultRowCountManaged.current = true;
    numberIsAutoSuggested.current = true;
    dateIsAutoSuggested.current = true;
    validityIsAutoSuggested.current = true;
    setValidationRequested(false);
    setIsDirty(false);
    setStatus("سند جدید آماده است.");
  };

  const saveCurrent = async (forceNew: boolean) => {
    if (busy) {
      setStatus("ذخیره انجام نشد؛ ابتدا پنجرهٔ باز را ببندید.");
      return false;
    }
    setBusy(true);
    try {
      const refreshed = refreshAutomaticTemporalFields(data, false);
      const refreshedTotals = calculateInvoiceTotals(refreshed);
      if (refreshedTotals.financialBlockingErrors.length) {
        setValidationRequested(true);
        setStatus("ذخیره انجام نشد؛ خطاهای مالی را اصلاح کنید.");
        return false;
      }

      const list = loadSavedList();
      const isNewEntry = forceNew || !currentSavedId || !list[currentSavedId];
      let name: string;
      // Local copy: currentSavedId is React state, so setCurrentSavedId
      // below wouldn't be visible until the next render — persistSavedEntry
      // a few lines down needs the id this same call just generated.
      let savedId = currentSavedId;

      if (!isNewEntry && savedId) {
        name = list[savedId].name;
        if (currentSavedVersion.current != null && list[savedId].savedAt !== currentSavedVersion.current) {
          const keepOverwriting = await confirmApp(
            "تغییر همزمان سند",
            "این سند در برگهٔ دیگری تغییر کرده است. آیا می‌خواهید تغییرات فعلی جایگزین نسخهٔ جدید شوند؟",
            "جایگزینی",
            true,
          );
          if (!keepOverwriting) {
            setStatus("ذخیره انجام نشد؛ سند در برگهٔ دیگری تغییر کرده است.");
            return false;
          }
        }
      } else {
        const suggested = currentSavedName || suggestEntryName(refreshed);
        const result = await show({
          title: forceNew ? "ذخیره با نام جدید" : "نام سند",
          message: "نامی انتخاب کنید که بعداً در فهرست ذخیره‌شده‌ها به‌سادگی پیدا شود.",
          inputValue: suggested,
          actions: [
            { id: "save", label: "ذخیره", primary: true },
            { id: "cancel", label: "انصراف" },
          ],
        });
        if (result.action !== "save") return false;
        name = result.value || suggested;
        savedId = generateSavedEntryId();
      }

      setData(refreshed);
      const savedAt = currentTimestampMs();
      persistSavedEntry({ id: savedId!, name, savedAt, data: refreshed });
      commitInvoiceNumber(refreshed.meta.number);
      numberIsAutoSuggested.current = false;
      dateIsAutoSuggested.current = false;
      validityIsAutoSuggested.current = false;
      setCurrentSavedId(savedId);
      setCurrentSavedName(name);
      currentSavedVersion.current = savedAt;
      defaultRowCountManaged.current = false;
      setIsDirty(false);
      refreshSavedList();
      setStatus("ذخیره شد — ساعت " + new Date(savedAt).toLocaleTimeString("fa-IR"));
      return true;
    } catch {
      setStatus("ذخیره در مرورگر ناموفق بود؛ از «پشتیبان فایل» استفاده کنید.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openSavedEntry = async (id: string) => {
    const list = loadSavedList();
    const entry = list[id];
    if (!entry) return;
    if (isDirty) {
      const confirmed = await confirmApp("باز کردن سند", `تغییرات ذخیره‌نشده از بین می‌رود. «${entry.name}» باز شود؟`, "باز کردن");
      if (!confirmed) return;
    }
    setData(entry.data);
    setCurrentSavedId(id);
    setCurrentSavedName(entry.name);
    currentSavedVersion.current = entry.savedAt;
    defaultRowCountManaged.current = false;
    numberIsAutoSuggested.current = false;
    dateIsAutoSuggested.current = false;
    validityIsAutoSuggested.current = false;
    setIsDirty(false);
    setStatus("سند ذخیره‌شده باز شد.");
    setSavedPanelOpen(false);
  };

  const deleteSavedEntryById = async (id: string) => {
    const list = loadSavedList();
    const entry = list[id];
    if (!entry) return;
    const confirmed = await confirmApp("حذف سند", `«${entry.name}» حذف شود؟ این کار قابل بازگشت نیست.`, "حذف", true);
    if (!confirmed) return;
    removeSavedEntry(id);
    if (currentSavedId === id) {
      setCurrentSavedId(null);
      setCurrentSavedName("");
      currentSavedVersion.current = null;
    }
    refreshSavedList();
    setStatus(`«${entry.name}» حذف شد.`);
  };

  const exportEditable = () => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const parts = ["پیش-فاکتور", safeFilenamePart(data.meta.number), safeFilenamePart(data.buyer.name)].filter(Boolean);
    const a = document.createElement("a");
    a.href = url;
    a.download = parts.join("_") + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("فایل پشتیبان دانلود شد؛ وضعیت سند همچنان " + (isDirty ? "ذخیره‌نشده است." : "ذخیره است."));
  };

  const openFromFile = async (file: File) => {
    let text: string;
    try {
      text = await file.text();
    } catch {
      await info("خطا در خواندن فایل", `خواندن فایل «${file.name}» ممکن نشد. سند فعلی بدون تغییر باقی ماند.`);
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      await info("فایل نامعتبر", `فایل «${file.name}» خراب است یا ساختار JSON سالمی ندارد. سند فعلی بدون تغییر باقی ماند.`);
      return;
    }
    const next = normalizeInvoiceData(parsed, nextRowId);
    if (!next) {
      await info("این فایل پیش‌فاکتور نیست", `فایل «${file.name}» یک سند پیش‌فاکتور معتبر نیست و باز نشد. سند فعلی بدون تغییر باقی ماند.`);
      return;
    }
    if (isDirty) {
      const confirmed = await confirmApp("باز کردن فایل", `تغییرات ذخیره‌نشده از بین می‌رود. فایل «${file.name}» باز شود؟`, "باز کردن");
      if (!confirmed) return;
    }
    setData(next);
    setCurrentSavedId(null);
    setCurrentSavedName("");
    currentSavedVersion.current = null;
    defaultRowCountManaged.current = false;
    numberIsAutoSuggested.current = false;
    setIsDirty(false);
    setStatus(`فایل «${file.name}» بازشد.`);
  };

  // ---------- Print ----------

  const printInvoice = async () => {
    if (busy) {
      setStatus("چاپ انجام نشد؛ ابتدا پنجرهٔ باز را ببندید.");
      return;
    }
    setBusy(true);
    try {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      const refreshed = refreshAutomaticTemporalFields(data, true);
      const refreshedTotals = calculateInvoiceTotals(refreshed);
      if (refreshedTotals.financialBlockingErrors.length) {
        setValidationRequested(true);
        setData(refreshed);
        setStatus("چاپ انجام نشد؛ خطاهای مالی را اصلاح کنید.");
        return;
      }

      const warnings = validateInvoiceForOutput(refreshed, refreshedTotals);
      setValidationRequested(true);

      // Commit the state update to the DOM synchronously so the print engine
      // (which clones the live sheet) sees the refreshed date/number/validity.
      flushSync(() => setData(refreshed));

      if (document.fonts?.ready) await document.fonts.ready;

      const sheet = sheetRef.current;
      const printDocument = printDocumentRef.current;
      if (!sheet || !printDocument) return;

      let orientation = refreshed.orientation;
      const hasOverflow = () => !!sheet.querySelector(".inv-table .numeric-overflow, .inv-totals .numeric-overflow");

      if (orientation === "portrait" && hasOverflow()) {
        orientation = "landscape";
        flushSync(() => setData((current) => ({ ...current, orientation: "landscape" })));
        setIsDirty(true);
        warnings.push("برای خوانایی مبالغ، جهت چاپ به‌صورت خودکار افقی شد");
      }
      if (hasOverflow()) {
        warnings.push("حداقل یکی از مبالغ بسیار طولانی است؛ مقدار آن را بررسی کنید");
      }

      const ctx: PrintContext = {
        sheetEl: sheet,
        printDocumentEl: printDocument,
        companyName: SELLER.name,
        companyLogoSrc: SELLER.logo,
        stampRequested: refreshed.includeStamp,
      };
      const rows = Array.from(sheet.querySelectorAll<HTMLElement>("tbody tr"));
      const result = preparePrintPlan(ctx, rows, orientation);
      const allWarnings = [...warnings, ...result.extraWarnings];
      setPrintOutcome({ warnings: allWarnings, forData: refreshed });

      if (!result.ok) {
        cleanupPrintDocument(ctx);
        setStatus(result.statusMessage);
        return;
      }

      commitInvoiceNumber(refreshed.meta.number);
      numberIsAutoSuggested.current = false;
      dateIsAutoSuggested.current = false;
      validityIsAutoSuggested.current = false;

      const oldTitle = document.title;
      document.title = [
        "پیش‌فاکتور",
        safeFilenamePart(refreshed.meta.number),
        safeFilenamePart(refreshed.buyer.name || SELLER.name),
      ]
        .filter(Boolean)
        .join("_");
      window.setTimeout(() => {
        window.print();
        document.title = oldTitle;
      }, 0);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const cleanup = () => {
      const sheet = sheetRef.current;
      const printDocument = printDocumentRef.current;
      if (!sheet || !printDocument) return;
      cleanupPrintDocument({
        sheetEl: sheet,
        printDocumentEl: printDocument,
        companyName: SELLER.name,
        companyLogoSrc: SELLER.logo,
        stampRequested: true,
      });
    };
    window.addEventListener("afterprint", cleanup);
    return () => window.removeEventListener("afterprint", cleanup);
  }, []);

  // Extra warnings from the print pipeline (page overflow etc.) that live
  // outside calculationErrors — merged into the same banner. Tagged with the
  // exact data object they were computed for, so any later edit (which
  // always produces a new object) silently drops them instead of needing an
  // effect to watch `data` and clear them out.
  const [printOutcome, setPrintOutcome] = useState<{ warnings: string[]; forData: InvoiceData } | null>(null);

  const displayedWarnings = useMemo(() => {
    const printWarnings = printOutcome && printOutcome.forData === data ? printOutcome.warnings : [];
    const extra = validationRequested ? validateInvoiceForOutput(data, totals) : totals.calculationErrors;
    return Array.from(new Set([...extra, ...printWarnings]));
  }, [data, totals, validationRequested, printOutcome]);

  // ---------- Keyboard shortcuts ----------
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
        const key = event.key.toLowerCase();
        if (key === "s") {
          event.preventDefault();
          saveCurrent(false);
        } else if (key === "p") {
          event.preventDefault();
          printInvoice();
        }
      } else if (event.key === "Escape") {
        setSavedPanelOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isDirty, busy]);

  const validityValue = data.meta.validity;

  return (
    <div className="preinv-app" id="quote-form">
      <header className="preinv-toolbar no-print">
        <div className="preinv-toolbar-row">
          <div className="preinv-toolbar-brand" aria-label="پیش‌فاکتور بنیان فولاد داریا">
            <span className="preinv-toolbar-brand-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4" /><line x1="9.5" y1="11.5" x2="15" y2="11.5" /><line x1="9.5" y1="15" x2="15" y2="15" /></svg>
            </span>
            <strong>پیش‌فاکتور</strong>
          </div>

          <div className="preinv-toolbar-document-block" aria-label="سند جاری">
            <span className="preinv-toolbar-control-label">سند جاری</span>
            <strong>
              {currentSavedName || data.buyer.name || (data.meta.number ? `پیش‌فاکتور ${data.meta.number}` : "پیش‌فاکتور جدید")}
            </strong>
            <div className="preinv-toolbar-status-pill">
              <span
                className={
                  "preinv-status-dot" +
                  (isDirty ? " is-dirty" : "") +
                  (totals.financialBlockingErrors.length ? " has-error" : "")
                }
                aria-hidden="true"
              />
              <span role="status" aria-live="polite">{status}</span>
            </div>
          </div>

          <div className="preinv-toolbar-live-total" aria-label="مبلغ قابل پرداخت جاری">
            <span>قابل پرداخت</span>
            <strong>{formatMoneyOrDash(totals.netTotal, totals.filledRows) || "—"}</strong>
          </div>

          <div className="preinv-toolbar-spacer" />

          <button type="button" id="btn-print" className="primary" title="چاپ یا ذخیره PDF (Ctrl+P)" onClick={printInvoice} disabled={busy}>
            <svg><path d="M6.5 9V3.5h11V9" /><rect x="4" y="9" width="16" height="8" rx="1.5" /><path d="M6.5 17v3.5h11V17" /></svg>
            <span>چاپ / PDF</span>
          </button>
        </div>

        <div className="preinv-toolbar-quickbar" aria-label="ابزارهای در دسترس پیش‌فاکتور">
          <nav className="preinv-toolbar-actions" aria-label="عملیات سند">
            <button type="button" className="preinv-toolbar-btn" title="شروع یک پیش‌فاکتور جدید" onClick={startNew}>
              <span>پیش‌فاکتور جدید</span>
            </button>
            <button type="button" className="preinv-toolbar-btn" title="افزودن یک ردیف یا قلم جدید به انتهای جدول" onClick={() => addRow()}>
              <span>+ افزودن ردیف/قلم جدید</span>
            </button>
            <button type="button" className="preinv-toolbar-btn" title="ذخیره در همین مرورگر (Ctrl+S)" onClick={() => saveCurrent(false)} disabled={busy}>
              <span>ذخیره</span>
            </button>
            <button type="button" className="preinv-toolbar-btn" title="ذخیرهٔ یک نسخهٔ مستقل با نام جدید" onClick={() => saveCurrent(true)} disabled={busy}>
              <span>ذخیره با نام جدید</span>
            </button>
            <div className="preinv-toolbar-saved">
              <button
                type="button"
                className="preinv-toolbar-btn"
                title="فهرست پیش‌فاکتورهای ذخیره‌شده"
                aria-expanded={savedPanelOpen}
                onClick={(event) => {
                  event.stopPropagation();
                  setSavedPanelOpen((open) => !open);
                }}
              >
                <span>ذخیره‌شده‌ها <b className="preinv-toolbar-count">{toPersianDigits(Object.keys(savedEntries).length)}</b></span>
              </button>
              {savedPanelOpen ? (
                <div className="preinv-saved-panel no-print" onClick={(event) => event.stopPropagation()}>
                  <div className="preinv-saved-panel-header">
                    <strong>پیش‌فاکتورهای ذخیره‌شده</strong>
                    <button type="button" className="preinv-saved-panel-close" aria-label="بستن" onClick={() => setSavedPanelOpen(false)}>✕</button>
                  </div>
                  <p className="preinv-saved-panel-hint">نسخه‌های این فهرست روی همین مرورگر نگهداری می‌شوند. برای پشتیبان دائمی، از «پشتیبان فایل» استفاده کنید.</p>
                  {Object.keys(savedEntries).length === 0 ? (
                    <p className="preinv-saved-panel-empty">هنوز چیزی ذخیره نشده است.</p>
                  ) : (
                    <ul className="preinv-saved-list">
                      {Object.values(savedEntries)
                        .sort((a, b) => b.savedAt - a.savedAt)
                        .map((entry) => (
                          <li key={entry.id} className={entry.id === currentSavedId ? "is-current" : undefined}>
                            <div className="preinv-saved-item-info">
                              <span className="preinv-saved-item-name">{entry.name}</span>
                              <span className="preinv-saved-item-time">
                                {(entry.data.meta.number || "بدون شماره") + " · " + formatSavedTime(entry.savedAt) +
                                  (entry.id === currentSavedId ? " — در حال ویرایش" : "")}
                              </span>
                            </div>
                            <div className="preinv-saved-item-actions">
                              <button type="button" onClick={() => openSavedEntry(entry.id)}>باز کردن</button>
                              <button type="button" className="danger" onClick={() => deleteSavedEntryById(entry.id)}>حذف</button>
                            </div>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
            <button type="button" className="preinv-toolbar-btn" title="دریافت پشتیبان قابل انتقال" onClick={exportEditable}>
              <span>پشتیبان فایل</span>
            </button>
            <button type="button" className="preinv-toolbar-btn" title="باز کردن پشتیبان پیش‌فاکتور" onClick={() => fileInputRef.current?.click()}>
              <span>بازکردن پشتیبان</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) openFromFile(file);
                event.target.value = "";
              }}
            />
          </nav>

          <span className="preinv-toolbar-quick-divider" aria-hidden="true" />

          <div className="preinv-orientation-switch" role="radiogroup" aria-label="جهت صفحه">
            <label className="preinv-orientation-btn">
              <input type="radio" name="orientation" value="landscape" checked={data.orientation === "landscape"} onChange={() => setOrientation("landscape")} />
              <svg><rect x="2.5" y="6.5" width="19" height="11" rx="2" /></svg><span>افقی</span>
            </label>
            <label className="preinv-orientation-btn">
              <input type="radio" name="orientation" value="portrait" checked={data.orientation === "portrait"} onChange={() => setOrientation("portrait")} />
              <svg><rect x="6.5" y="2.5" width="11" height="19" rx="2" /></svg><span>عمودی</span>
            </label>
          </div>

          <label className="preinv-toolbar-toggle" title="پس‌زمینهٔ هدر و فوتر">
            <input
              type="checkbox"
              checked={data.headerGray}
              onChange={(event) => {
                setData((current) => ({ ...current, headerGray: event.target.checked }));
                setIsDirty(true);
                setStatus(event.target.checked ? "پس‌زمینهٔ خاکستری هدر و فوتر فعال شد." : "پس‌زمینهٔ هدر و فوتر خاموش شد.");
              }}
            />
            <span>هدر و فوتر خاکستری</span>
          </label>
          <label className="preinv-toolbar-toggle" title="نمایش مهر فروشنده در چاپ">
            <input
              type="checkbox"
              checked={data.includeStamp}
              onChange={(event) => {
                setData((current) => ({ ...current, includeStamp: event.target.checked }));
                setIsDirty(true);
                setStatus(event.target.checked ? "مهر فروشنده در پیش‌فاکتور نمایش داده می‌شود." : "مهر از پیش‌فاکتور حذف شد.");
              }}
            />
            <span>مهر فروشنده</span>
          </label>
        </div>
      </header>

      <p className="preinv-notice no-print">
        این ابزار فقط برای آماده‌سازی پیش‌نویس پیش‌فاکتور استفاده می‌شود؛ سند خروجی رسمی نیست. برای صدور پیش‌فاکتور
        رسمی، قیمت نهایی و تأیید موجودی، حتماً با واحد فروش تماس بگیرید.
      </p>

      {displayedWarnings.length > 0 ? (
        <div className="invoice-validation no-print" role="status" aria-live="polite">
          <strong>هشدارها</strong>
          <ul>
            {displayedWarnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <main className="preinv-sheet-viewport">
        <div className="preinv-sheet-scale-wrapper" ref={scaleWrapperRef}>
          <article
            className={`invoice-sheet orientation-${data.orientation}${data.headerGray ? " header-gray" : ""}${data.includeStamp ? " stamp-enabled" : ""}`}
            dir="rtl"
            data-company="fouladBonyanDaria"
            ref={sheetRef}
          >
            <header className="inv-head">
              <input
                className="inv-input inv-doc-title"
                data-field="meta.title"
                aria-label="عنوان سند"
                value={data.meta.title}
                placeholder="عنوان سند"
                onChange={(event) => {
                  const title = toPersianDigitsLive(event);
                  setData((current) => ({ ...current, meta: { ...current.meta, title } }));
                  setIsDirty(true);
                }}
              />
              <div className="inv-brand">
                <span className="inv-logo-chip">
                  <img className="inv-logo" src={SELLER.logo} alt="آرم شرکت" />
                </span>
                <div className="inv-brand-text">
                  {/* Not an <h1>: the page already has its own (InnerPageLayout's
                      title); a second top-level heading here would be an SEO/
                      a11y regression, so this is styled to match without being one. */}
                  <p id="inv-company-name">{SELLER.name}</p>
                </div>
              </div>
              <dl className="inv-meta">
                <div>
                  <dt><svg className="inv-meta-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2v4M16 2v4M3 10h18" /><rect x="3" y="4" width="18" height="18" rx="2" /></svg><span>تاریخ</span></dt>
                  <dd>
                    <input
                      type="text"
                      className="inv-input"
                      dir="ltr"
                      data-field="meta.date"
                      aria-label="تاریخ پیش‌فاکتور"
                      placeholder="۱۴۰۳/۰۱/۰۱"
                      value={data.meta.date}
                      aria-invalid={totals.dateError}
                      onChange={(event) => updateMetaDate(toPersianDigitsLive(event))}
                      onBlur={commitMetaDateBlur}
                    />
                  </dd>
                </div>
                <div>
                  <dt><svg className="inv-meta-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></svg><span>شماره پیش‌فاکتور</span></dt>
                  <dd>
                    <input
                      type="text"
                      className="inv-input"
                      dir="ltr"
                      data-field="meta.number"
                      aria-label="شماره پیش‌فاکتور"
                      placeholder="—"
                      value={data.meta.number}
                      onChange={(event) => updateMetaNumber(toPersianDigitsLive(event))}
                    />
                  </dd>
                </div>
                <div className="inv-meta-validity">
                  <dt><svg className="inv-meta-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg><span>اعتبار پیش‌فاکتور</span></dt>
                  <dd>
                    <select
                      className="inv-input inv-meta-validity-select no-print"
                      aria-label="نحوهٔ تعیین اعتبار پیش‌فاکتور"
                      value={data.meta.validityMode}
                      onChange={(event) => updateValidityMode(event.target.value as ValidityMode)}
                    >
                      <option value="today">پایان روز جاری</option>
                      <option value="tomorrow">فردا (محاسبهٔ خودکار)</option>
                      <option value="manual">تاریخ دلخواه</option>
                    </select>
                    <input
                      ref={validityInputRef}
                      type="text"
                      className={"inv-input" + (data.meta.validityMode !== "manual" ? " no-screen" : "")}
                      dir="ltr"
                      data-field="meta.validity"
                      aria-label="تاریخ اعتبار پیش‌فاکتور"
                      placeholder="۱۴۰۳/۰۱/۰۲"
                      value={validityValue}
                      readOnly={data.meta.validityMode !== "manual"}
                      onChange={(event) => updateValidityManual(toPersianDigitsLive(event))}
                    />
                  </dd>
                </div>
              </dl>
            </header>

            <section className="inv-parties">
              <div className="inv-card" aria-label="مشخصات فروشنده">
                <header className="inv-card-head"><svg className="inv-card-head-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21V7l8-4 8 4v14" /><path d="M9 21v-6h6v6M8 10h.01M12 10h.01M16 10h.01" /></svg>مشخصات فروشنده</header>
                <div className="inv-card-grid">
                  <div className="inv-field inv-field-wide">
                    <span className="inv-field-label">نام شخص حقیقی / حقوقی</span>
                    <span className="inv-input inv-field-value inv-field-static">{SELLER.name}</span>
                  </div>
                  <div className="inv-field inv-field-wide">
                    <span className="inv-field-label">نشانی</span>
                    <span className="inv-input inv-field-value inv-field-static">{SELLER.address}</span>
                  </div>
                  <div className="inv-field inv-field-wide inv-field-postal">
                    <span className="inv-field-label">کد پستی</span>
                    <span className="inv-input inv-field-value inv-field-static" dir="ltr">{SELLER.postalCode}</span>
                  </div>
                  <div className="inv-field inv-field-wide">
                    <span className="inv-field-label">شناسه ملی</span>
                    <span className="inv-input inv-field-value inv-field-static" dir="ltr">{SELLER.nationalId}</span>
                  </div>
                  <div className="inv-field inv-field-wide">
                    <span className="inv-field-label">تلفن</span>
                    <span className="inv-input inv-field-value inv-field-static" dir="ltr">{SELLER.phone}</span>
                  </div>
                </div>
              </div>

              <div className="inv-card" aria-label="مشخصات خریدار">
                <header className="inv-card-head"><svg className="inv-card-head-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>مشخصات خریدار</header>
                <div className="inv-card-grid">
                  <div className="inv-field inv-field-wide">
                    <span className="inv-field-label">نام شخص حقیقی / حقوقی</span>
                    <input
                      type="text"
                      className="inv-input inv-field-value"
                      dir="rtl"
                      data-field="buyer.name"
                      aria-label="نام خریدار"
                      placeholder="—"
                      aria-invalid={validationRequested && !data.buyer.name.trim()}
                      value={data.buyer.name}
                      onChange={(event) => updateBuyer({ name: toPersianDigitsLive(event) })}
                    />
                  </div>
                  <div className="inv-field inv-field-wide">
                    <span className="inv-field-label">نشانی</span>
                    <textarea
                      className="inv-input inv-field-value inv-autogrow"
                      dir="rtl"
                      data-field="buyer.address"
                      aria-label="نشانی خریدار"
                      rows={1}
                      value={data.buyer.address}
                      onChange={(event) => updateBuyer({ address: toPersianDigitsLive(event) })}
                    />
                  </div>
                  <div className="inv-field inv-field-wide inv-field-postal">
                    <span className="inv-field-label">کد پستی</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="inv-input inv-field-value"
                      dir="ltr"
                      data-field="buyer.postalCode"
                      aria-label="کد پستی خریدار"
                      placeholder="—"
                      value={data.buyer.postalCode}
                      onChange={(event) => updateBuyer({ postalCode: toPersianDigitsLive(event) })}
                    />
                  </div>
                  <div className="inv-field inv-field-wide">
                    <span className="inv-field-label">شناسه ملی</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="inv-input inv-field-value"
                      dir="ltr"
                      data-field="buyer.nationalId"
                      aria-label="شناسه ملی خریدار"
                      placeholder="—"
                      value={data.buyer.nationalId}
                      onChange={(event) => updateBuyer({ nationalId: toPersianDigitsLive(event) })}
                    />
                  </div>
                  <div className="inv-field inv-field-wide">
                    <span className="inv-field-label">تلفن</span>
                    <textarea
                      className="inv-input inv-field-value inv-autogrow"
                      dir="ltr"
                      inputMode="tel"
                      data-field="buyer.phone"
                      aria-label="تلفن خریدار"
                      rows={1}
                      placeholder="—"
                      value={data.buyer.phone}
                      onChange={(event) => updateBuyer({ phone: toPersianDigitsLive(event) })}
                    />
                  </div>
                </div>
              </div>
            </section>

            <div className="inv-table-frame">
              <table className="inv-table">
                <colgroup>
                  <col className="col-del" /><col className="col-row" /><col className="col-desc" /><col className="col-qty" />
                  <col className="col-unit" /><col className="col-price" /><col className="col-total" /><col className="col-discount" /><col className="col-net" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="no-print"></th>
                    <th>ردیف</th>
                    <th>شرح کالا یا خدمات</th>
                    <th>تعداد / مقدار</th>
                    <th>واحد</th>
                    <th>مبلغ واحد (ریال)</th>
                    <th>مبلغ کل (ریال)</th>
                    <th>تخفیف (ریال)</th>
                    <th>مبلغ پس از تخفیف (ریال)</th>
                  </tr>
                </thead>
                <tbody>
                  {totals.rows.map((calc) => (
                    <InvoiceRow
                      key={calc.item.id}
                      calc={calc}
                      canDelete={data.items.length > 1}
                      onChange={(patch) => updateItem(calc.item.id, patch)}
                      onDelete={() => deleteRow(calc.item.id)}
                      onEnter={(field) => handleRowEnter(field, calc.item.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <section className="inv-summary">
              <div className="inv-totals">
                <div>
                  <span>جمع کل</span>
                  <strong data-total="grossTotal">{formatMoneyOrDash(totals.grossTotal, totals.filledRows)}</strong>
                </div>
                <div>
                  <span>جمع تخفیف</span>
                  <strong data-total="discountTotal">{formatMoneyOrDash(totals.discountTotal, totals.filledRows)}</strong>
                </div>
                <div>
                  <span>جمع کل پس از تخفیف</span>
                  <strong data-total="afterDiscountTotal">{formatMoneyOrDash(totals.afterDiscountTotal, totals.filledRows)}</strong>
                </div>
                <div className="inv-tax-row">
                  <span>
                    مالیات و عوارض
                    <span className="inv-tax-percent-wrap">
                      (
                      <input
                        type="text"
                        inputMode="decimal"
                        className="inv-input inv-tax-percent"
                        data-field="taxPercent"
                        aria-label="درصد مالیات و عوارض"
                        aria-invalid={totals.taxPercentError}
                        value={data.taxPercent}
                        onChange={(event) => updateTaxPercent(toPersianDigitsLive(event))}
                        onBlur={commitTaxPercentBlur}
                      />٪)
                    </span>
                  </span>
                  <strong data-total="taxTotal">{formatMoneyOrDash(totals.taxTotal, totals.filledRows)}</strong>
                </div>
                <div className="inv-total-final">
                  <span>مبلغ قابل پرداخت</span>
                  <strong data-total="netTotal">{formatMoneyOrDash(totals.netTotal, totals.filledRows)}</strong>
                </div>
              </div>
              <section className={"inv-amount-words" + (totals.filledRows ? "" : " is-empty")}>
                <span className="inv-amount-words-label">مبلغ به حروف</span>
                <span className="inv-amount-words-value" data-total="netTotalWords">
                  {netTotalWords(totals.netTotal, totals.filledRows)}
                </span>
              </section>
              <div className="inv-notes">
                <span className="inv-notes-label">توضیحات</span>
                <textarea
                  className="inv-input inv-textarea"
                  dir="rtl"
                  data-field="notes"
                  aria-label="توضیحات پیش‌فاکتور"
                  rows={1}
                  value={data.notes}
                  onChange={(event) => {
                    const notes = toPersianDigitsLive(event);
                    setData((current) => ({ ...current, notes }));
                    setIsDirty(true);
                  }}
                />
              </div>
              <div className="inv-signature-block inv-signature-buyer">
                <p className="inv-signature-label">مهر و امضای خریدار</p>
                <div className="inv-signature-area" />
              </div>
              <div className="inv-signature-block inv-signature-seller">
                <p className="inv-signature-label">مهر و امضای فروشنده</p>
                <div className="inv-signature-area">
                  {data.includeStamp ? (
                    <img src={SELLER.stamp} alt="مهر شرکت" className="inv-signature-stamp" />
                  ) : (
                    <span className="inv-stamp-draft-note">بدون مهر</span>
                  )}
                </div>
              </div>
            </section>

            <footer className="inv-footer">
              <p className="inv-footer-site">
                <span className="inv-input inv-footer-site-input inv-field-static" dir="auto">
                  {SELLER.website}
                </span>
              </p>
            </footer>
          </article>
        </div>
      </main>

      <div className="preinv-print-document no-print" ref={printDocumentRef} aria-hidden="true" />
      {dialog}
    </div>
  );
}

function InvoiceRow({
  calc,
  canDelete,
  onChange,
  onDelete,
  onEnter,
}: {
  calc: RowCalculation;
  canDelete: boolean;
  onChange: (patch: Partial<InvoiceItem>) => void;
  onDelete: () => void;
  onEnter: (field: keyof Omit<InvoiceItem, "id">) => void;
}) {
  const { item, rowNumber, blank } = calc;
  const label = itemIndexLabel(rowNumber - 1);

  const keyDown = (field: keyof Omit<InvoiceItem, "id">) => (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    onEnter(field);
  };

  const blurPlain = (field: keyof Omit<InvoiceItem, "id">) => (event: FocusEvent<HTMLInputElement>) => {
    onChange({ [field]: toPersianDigits(event.target.value) } as Partial<InvoiceItem>);
  };

  const blurDescription = (event: FocusEvent<HTMLTextAreaElement>) => {
    onChange({ description: toPersianDigits(event.target.value) });
  };

  const blurQuantity = (event: FocusEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    if (!raw.trim()) return;
    const qty = strictQuantity(raw);
    if (qty.valid) onChange({ quantity: formatQtyMilli(qty.value) });
  };

  const blurMoney = (field: "unitPrice" | "discount") => (event: FocusEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    if (!raw.trim()) return;
    const amount = strictMoney(raw, field === "discount");
    if (!amount.valid) return;
    onChange({ [field]: amount.value === 0n && field === "discount" ? "" : formatBigRial(amount.value) } as Partial<InvoiceItem>);
  };

  return (
    <tr data-row-id={item.id} className={blank ? "is-blank-row" : undefined}>
      <td className="no-print">
        {canDelete ? (
          <button type="button" className="row-delete" aria-label={`حذف ردیف ${label}`} title="حذف ردیف" onClick={onDelete}>✕</button>
        ) : null}
      </td>
      <td className="row-index"><span className="row-index-badge">{label}</span></td>
      <td>
        <textarea
          rows={1}
          className="cell-input cell-textarea"
          data-row-field="description"
          aria-label={`ردیف ${label} — ${ROW_FIELD_LABELS.description}`}
          aria-invalid={calc.descriptionError}
          value={item.description}
          onFocus={(event) => event.target.select()}
          onChange={(event) => onChange({ description: toPersianDigitsLive(event) })}
          onBlur={blurDescription}
          onKeyDown={keyDown("description")}
        />
      </td>
      <td>
        <input
          type="text"
          inputMode="decimal"
          className="cell-input cell-input-num"
          data-row-field="quantity"
          aria-label={`ردیف ${label} — ${ROW_FIELD_LABELS.quantity}`}
          aria-invalid={calc.quantityError}
          value={item.quantity}
          onFocus={(event) => event.target.select()}
          onChange={(event) => onChange({ quantity: toPersianDigitsLive(event) })}
          onBlur={blurQuantity}
          onKeyDown={keyDown("quantity")}
        />
      </td>
      <td>
        <input
          type="text"
          className="cell-input"
          data-row-field="unit"
          aria-label={`ردیف ${label} — ${ROW_FIELD_LABELS.unit}`}
          value={item.unit}
          onFocus={(event) => event.target.select()}
          onChange={(event) => onChange({ unit: toPersianDigitsLive(event) })}
          onBlur={blurPlain("unit")}
          onKeyDown={keyDown("unit")}
        />
      </td>
      <td>
        <input
          type="text"
          inputMode="decimal"
          className="cell-input cell-input-num"
          data-row-field="unitPrice"
          aria-label={`ردیف ${label} — ${ROW_FIELD_LABELS.unitPrice}`}
          aria-invalid={calc.unitPriceError}
          value={item.unitPrice}
          onFocus={(event) => event.target.select()}
          onChange={(event) => onChange({ unitPrice: toPersianDigitsLive(event) })}
          onBlur={blurMoney("unitPrice")}
          onKeyDown={keyDown("unitPrice")}
        />
      </td>
      <td className="cell-computed" data-row-computed="total">
        {calc.total !== null ? formatBigRial(calc.total) : ""}
      </td>
      <td>
        <input
          type="text"
          inputMode="decimal"
          className="cell-input cell-input-num"
          data-row-field="discount"
          aria-label={`ردیف ${label} — ${ROW_FIELD_LABELS.discount}`}
          aria-invalid={calc.discountError}
          value={item.discount}
          onFocus={(event) => event.target.select()}
          onChange={(event) => onChange({ discount: toPersianDigitsLive(event) })}
          onBlur={blurMoney("discount")}
          onKeyDown={keyDown("discount")}
        />
      </td>
      <td className="cell-computed" data-row-computed="afterDiscount">
        {calc.afterDiscount !== null ? formatBigRial(calc.afterDiscount) : ""}
      </td>
    </tr>
  );
}
