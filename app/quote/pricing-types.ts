import type { QuotePieceOptionChoice, QuoteProductName } from "../quote-types";

export type ProductPricingBaseline = {
  product: QuoteProductName;
  unitPriceTomanPerKg: number;
  minPriceTomanPerKg: number;
  maxPriceTomanPerKg: number;
  rowCount: number;
  date: string;
  pieceOptions: QuotePieceOptionChoice[];
  branchWeight?: "rebar-12m";
  supportsPieceUnits: boolean;
};

export type QuotePricingBaselines = Partial<
  Record<QuoteProductName, ProductPricingBaseline>
>;
