/** Creates a native transform with one writable slot and no readable prefetch. */
export function createTransform<In, Out>(
  transformer: Transformer<In, Out>,
): TransformStream<In, Out> {
  return new TransformStream(transformer, { highWaterMark: 1 }, { highWaterMark: 0 });
}
