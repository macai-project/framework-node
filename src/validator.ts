import Ajv, { JSONSchemaType } from "ajv";
import logger from "./logger";

const ajv = new Ajv();

export type EventSchema<T> = JSONSchemaType<T>;

export function validate<T>(schema: JSONSchemaType<T>, event: any): boolean {
  const validator = ajv.compile(schema);
  const isValid = validator(event);
  if (!isValid) {
    logger.error("Payload not valid", validator.errors);
  }
  return isValid;
}
