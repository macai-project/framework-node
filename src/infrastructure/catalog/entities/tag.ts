import { EntityState } from "./common";

interface _Tag<T extends string, B = never> {
  id: string;
  name: string;
  type: T;
  state: EntityState;
  body: B;
}

export type Tag = _Tag<"in-evidence", Partial<{ order: number }>>;
