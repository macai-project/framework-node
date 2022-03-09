import * as D from "io-ts/Decoder";

export const Warehouse = D.intersect(
  D.struct({
    quantity: D.number,
  })
)(
  D.partial({
    price: D.struct({ currency: D.string, value: D.number }),
    active: D.boolean,
  })
);
export type Warehouse = D.TypeOf<typeof Warehouse>;

const ItemOptional = {
  description: D.string,
  additional_information: D.string,
  storage: D.string,
  origin: D.string,
  nutritional_value: D.string,
  item_size: D.struct({
    type: D.literal("gr", "ml", "unit"),
    value: D.number,
  }),
  manufacturer: D.string,
  brand: D.string,
  payable_with_tickets: D.boolean,
  allergens: D.string,
  ingredients: D.string,
  search_keywords: D.array(D.string),
  max_allowed: D.number,
};

const ItemPublishedMandatory = {
  warehouses: D.record(Warehouse),
  price: D.struct({ value: D.number, currency: D.string }),
  vat: D.number,
  eans: D.array(D.string),
};

const ItemMandatory = {
  midec: D.string,
  name: D.string,
};

const DraftedItemMandatory = D.intersect(
  D.struct({
    state: D.literal("draft"),
  })
)(D.struct(ItemMandatory));

const DraftedItem = D.intersect(
  D.intersect(DraftedItemMandatory)(D.partial(ItemPublishedMandatory))
)(D.partial(ItemOptional));
type DraftedItem = D.TypeOf<typeof DraftedItem>;

const PublishedItem = D.intersect(
  D.intersect(DraftedItemMandatory)(D.struct(ItemPublishedMandatory))
)(D.partial(ItemOptional));
type PublishedItem = D.TypeOf<typeof PublishedItem>;

export const Item = D.union(DraftedItem, PublishedItem);
export type Item = D.TypeOf<typeof Item>;
