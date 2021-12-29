import { Context } from "aws-lambda/handler";
import { WrapperOptions } from "@sentry/serverless/dist/gcpfunction/general";

export type Handler<E, R> = (
  event: E,
  context: Context,
  callback: (error?: any, result?: R) => void
) => void | Promise<R>;

export interface WrapHandler<E = any, R = any> {
  (handler: Handler<E, R>, wrapOptions?: Partial<WrapperOptions>): Handler<
    E,
    R | undefined
  >;
}

export default undefined;
