import { Functor2 } from "fp-ts/Functor";
import { Monad2 } from "fp-ts/Monad";
import { Alternative2 } from "fp-ts/Alternative";
import { Applicative2 } from "fp-ts/Applicative";
import { Foldable2 } from "fp-ts/Foldable";

import { array, either, task, writer } from "fp-ts";
import { pipe } from "fp-ts/function";
import { Writer } from "fp-ts/lib/Writer";
import { Task } from "fp-ts/lib/Task";
import { Either } from "fp-ts/Either";
import { sequenceS } from "fp-ts/lib/Apply";

// -------------------------------------------------------------------------------------
// writerEither
// -------------------------------------------------------------------------------------

type Log = string;

type TaskWriterEither<E, A> = Task<Writer<Log[], Either<E, A>>>;

export const URI = "TaskWriterEither";
export type URI = typeof URI;

declare module "fp-ts/HKT" {
  interface URItoKind2<E, A> {
    readonly [URI]: TaskWriterEither<E, A>;
  }
}

const writerMonad = writer.getMonad<Log[]>(array.getMonoid());

export const chain =
  <E, A, B>(f: (v: A) => TaskWriterEither<E, B>) =>
  (t: TaskWriterEither<E, A>): TaskWriterEither<E, B> => {
    return pipe(
      t,
      task.chain((w) => {
        const [oldE, oldLogs] = w();
        if (oldE._tag === "Right") {
          return pipe(
            f(oldE.right),
            task.chain((newW) => {
              const [newE, newLogs] = newW();
              return task.of(() => [
                newE,
                [...oldLogs, ...newLogs],
              ]) as TaskWriterEither<E, B>;
            })
          );
        }

        return task.of(() => [oldE, oldLogs]);
      })
    );
  };

export const map =
  <E, A, B>(f: (v: A) => B) =>
  (t: TaskWriterEither<E, A>): TaskWriterEither<E, B> => {
    return pipe(
      t,
      task.map((w) => writerMonad.map(w, (v) => pipe(v, either.map(f))))
    );
  };

export const tell = (l: Log) => task.of(writer.tell(l));
export const appendLog =
  <E, A>(log: Log) =>
  (t: TaskWriterEither<E, A>): TaskWriterEither<E, A> => {
    return pipe(
      t,
      task.map((w) => writerMonad.chain(w, (v) => () => [v, [log]]))
    );
  };

export const _map = <E, A, B>(
  t: TaskWriterEither<E, A>,
  f: (v: A) => B
): TaskWriterEither<E, B> => {
  return pipe(
    t,
    task.map((w) => writerMonad.map(w, (v) => pipe(v, either.map(f))))
  );
};

const _of = <E, A>(v: A): TaskWriterEither<E, A> => {
  return task.of(() => [either.right(v), []]);
};

const _chain = <E, A, B>(
  t: TaskWriterEither<E, A>,
  f: (v: A) => TaskWriterEither<E, B>
): TaskWriterEither<E, B> => {
  return pipe(
    t,
    task.chain((w) => {
      const [oldE, oldLogs] = w();
      if (oldE._tag === "Right") {
        return pipe(
          f(oldE.right),
          task.chain((newW) => {
            const [newE, newLogs] = newW();
            return task.of(() => [
              newE,
              [...oldLogs, ...newLogs],
            ]) as TaskWriterEither<E, B>;
          })
        );
      }

      return task.of(() => [oldE, oldLogs]);
    })
  );
};

const _ap = <E, A, B>(
  ap1: TaskWriterEither<E, (a: A) => B>,
  ap2: TaskWriterEither<E, A>
): TaskWriterEither<E, B> => {
  const parSeq = sequenceS(task.ApplicativePar);

  return pipe(
    parSeq({ ap1, ap2 }),
    task.chain(({ ap1, ap2 }) => {
      const [val1, logs1] = ap1();
      const [val2, logs2] = ap2();

      if (val1._tag === "Right") {
        if (val2._tag === "Right") {
          return task.of(() => [
            either.right(val1.right(val2.right)),
            [...logs1, ...logs2],
          ]);
        } else {
          return task.of(() => [val2, [...logs1, ...logs2]]);
        }
      } else {
        return task.of(() => [val1, [...logs1, ...logs2]]);
      }
    })
  );
};

export const taskWriterEither: Functor2<URI> & Monad2<URI> & Applicative2<URI> =
  {
    URI,
    map: _map,
    chain: _chain,
    of: _of,
    ap: _ap,
  };
