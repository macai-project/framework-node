import * as C from "io-ts/Codec";

export const Warehouse = C.intersect(
  C.struct({
    quantity: C.number,
  })
)(
  C.partial({
    price: C.struct({ currency: C.string, value: C.number }),
    active: C.boolean,
  })
);
export type Warehouse = C.TypeOf<typeof Warehouse>;

const ItemOptional = {
  description: C.string,
  additional_information: C.string,
  storage: C.string,
  origin: C.string,
  nutritional_value: C.string,
  item_size: C.struct({
    type: C.literal("gr", "ml", "unit"),
    value: C.number,
  }),
  manufacturer: C.string,
  brand: C.string,
  payable_with_tickets: C.boolean,
  allergens: C.string,
  ingredients: C.string,
  search_keywords: C.array(C.string),
  max_allowed: C.number,
};

const ItemPublishedMandatory = {
  warehouses: C.record(Warehouse),
  price: C.struct({ value: C.number, currency: C.string }),
  vat: C.number,
  eans: C.array(C.string),
};

const ItemMandatory = {
  midec: C.string,
  name: C.string,
};

export const ItemProps = {
  ...ItemOptional,
  ...ItemPublishedMandatory,
  ...ItemMandatory,
  state: C.literal("draft", "published"),
};

const DraftedItemMandatory = C.intersect(
  C.struct({
    state: C.literal("draft"),
  })
)(C.struct(ItemMandatory));

const PublishedItemMandatory = C.intersect(
  C.intersect(
    C.struct({
      state: C.literal("published"),
    })
  )(C.struct(ItemMandatory))
)(C.struct(ItemPublishedMandatory));

const DraftedItem = C.intersect(
  C.intersect(DraftedItemMandatory)(C.partial(ItemPublishedMandatory))
)(C.partial(ItemOptional));
type DraftedItem = C.TypeOf<typeof DraftedItem>;

const PublishedItem = C.intersect(PublishedItemMandatory)(
  C.partial(ItemOptional)
);
type PublishedItem = C.TypeOf<typeof PublishedItem>;

export const Item = C.sum("state")({
  draft: DraftedItem,
  published: PublishedItem,
});
export type Item = C.TypeOf<typeof Item>;
