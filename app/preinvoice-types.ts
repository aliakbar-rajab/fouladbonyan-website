export type InvoiceOrientation = "landscape" | "portrait";

export type InvoiceItem = {
  id: number;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discount: string;
};

export type InvoiceMeta = {
  title: string;
  date: string;
  number: string;
  validityMode: "today" | "tomorrow" | "manual";
  validity: string;
};

export type InvoiceBuyer = {
  name: string;
  nationalId: string;
  address: string;
  postalCode: string;
  phone: string;
};

export type InvoiceData = {
  version: 1;
  orientation: InvoiceOrientation;
  headerGray: boolean;
  meta: InvoiceMeta;
  buyer: InvoiceBuyer;
  taxPercent: string;
  notes: string;
  includeStamp: boolean;
  items: InvoiceItem[];
};

export type SavedInvoiceEntry = {
  id: string;
  name: string;
  savedAt: number;
  data: InvoiceData;
};

export type RowCalculation = {
  item: InvoiceItem;
  rowNumber: number;
  blank: boolean;
  total: bigint | null;
  afterDiscount: bigint | null;
  descriptionError: boolean;
  quantityError: boolean;
  unitPriceError: boolean;
  discountError: boolean;
};

export type InvoiceTotals = {
  rows: RowCalculation[];
  filledRows: number;
  grossTotal: bigint;
  discountTotal: bigint;
  afterDiscountTotal: bigint;
  taxTotal: bigint;
  netTotal: bigint;
  taxPercentError: boolean;
  dateError: boolean;
  /** Every warning worth showing the user, in display order. */
  calculationErrors: string[];
  /** Subset of calculationErrors that must block Print/Save. */
  financialBlockingErrors: string[];
};
