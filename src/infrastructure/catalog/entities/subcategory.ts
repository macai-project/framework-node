import { EntityState } from "./common";

export interface Subcategory {
  id: string;
  name: string;
  order?: number;
  state: EntityState;
}
