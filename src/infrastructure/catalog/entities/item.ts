import * as C from "io-ts/Codec";

interface Warehouse {
  price?: { currency: string; value: number };
  active?: boolean;
  quantity: number;
}

interface ItemOptional {
  description: string;
  additional_information: string;
  storage: string;
  origin: string;
  nutritional_value: string;
  item_size: {
    type: "gr" | "ml" | "unit";
    value: number;
  };
  manufacturer: string;
  brand: string;
  payable_with_tickets: boolean;
  allergens: string;
  ingredients: string;
  search_keywords: string[];
  max_allowed: number;
}

interface ItemMandatory {
  warehouses: Record<string, Warehouse>;
  price: { value: number; currency: string };
  vat: number;
  eans: string[];
}

interface ItemDraftMandatory {
  midec: string;
  name: string;
}

type DraftedItem = {
  state: "draft";
} & ItemDraftMandatory &
  Partial<ItemMandatory> &
  Partial<ItemOptional>;

type PublishedItem = {
  state: "published";
} & ItemDraftMandatory &
  ItemMandatory &
  Partial<ItemOptional>;

export type Item = DraftedItem | PublishedItem;
