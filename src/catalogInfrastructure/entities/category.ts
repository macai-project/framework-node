import { EntityState } from "./common";

export interface Category {
  id: string;
  name: string;
  color?: string;
  order?: number;
  state: EntityState;
}
