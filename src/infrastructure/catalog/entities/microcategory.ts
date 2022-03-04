import { EntityState } from "./common";

export interface Microcategory {
  id: string;
  name: string;
  order?: number;
  state: EntityState;
}
