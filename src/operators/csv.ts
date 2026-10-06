import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";

/** Options for `csv()`. */
export interface CsvOptions {
  /** Field separator. Defaults to `","`. */
  readonly separator?: string;
  /** Quote character. Defaults to `'"'`; a doubled quote inside quotes is a literal quote. */
  readonly quote?: string;
  /** Treat the first row as column names and emit objects keyed by them. Defaults to `false`. */
  readonly header?: boolean;
}

/**
 * Parses CSV (RFC 4180) from a stream of text chunks into rows of strings.
 * Quoted fields may contain separators, quotes, and line breaks, even across
 * chunks. Empty lines are skipped. An unterminated quote errors the stream.
 * With `header`, the first row names the columns and each later row is
 * emitted as an object; missing fields are empty strings.
 *
 * @example
 * file.stream().pipeThrough(new TextDecoderStream()).pipeThrough(csv()); // ["id", "name"], ["1", "Ada"], …
 * text.pipeThrough(csv({ header: true })); // { id: "1", name: "Ada" }, …
 */
export function csv(
  options: CsvOptions & { readonly header: true },
): Operator<string, Record<string, string>>;
export function csv(options?: CsvOptions): Operator<string, string[]>;
export function csv(options: CsvOptions = {}): Operator<string, string[] | Record<string, string>> {
  const { separator = ",", quote = '"', header = false } = options;
  if (separator.length !== 1 || quote.length !== 1) {
    throw new RangeError("csv separator and quote must be single characters");
  }
  let row: string[] = [];
  let field = "";
  let rowHasContent = false;
  let atFieldStart = true;
  let inQuotes = false;
  let quotePending = false;
  let columns: string[] | undefined;

  type Row = string[] | Record<string, string>;
  const emit = (controller: TransformStreamDefaultController<Row>, values: string[]): void => {
    if (!header) controller.enqueue(values);
    else if (!columns) columns = values;
    else controller.enqueue(Object.fromEntries(columns.map((name, i) => [name, values[i] ?? ""])));
  };
  const endRow = (controller: TransformStreamDefaultController<Row>): void => {
    row.push(field);
    if (rowHasContent) emit(controller, row);
    row = [];
    field = "";
    rowHasContent = false;
    atFieldStart = true;
  };

  return createTransform<string, Row>({
    transform(chunk, controller) {
      for (const char of chunk) {
        if (inQuotes) {
          if (quotePending) {
            quotePending = false;
            if (char === quote) {
              field += quote;
              continue;
            }
            inQuotes = false;
          } else {
            if (char === quote) quotePending = true;
            else field += char;
            continue;
          }
        }
        if (char === quote && atFieldStart) {
          inQuotes = true;
          rowHasContent = true;
          atFieldStart = false;
        } else if (char === separator) {
          row.push(field);
          field = "";
          rowHasContent = true;
          atFieldStart = true;
        } else if (char === "\n") {
          endRow(controller);
        } else if (char !== "\r") {
          field += char;
          rowHasContent = true;
          atFieldStart = false;
        }
      }
    },
    flush(controller) {
      if (inQuotes && !quotePending) throw new SyntaxError("CSV ends inside a quoted field");
      if (rowHasContent || field !== "") endRow(controller);
    },
  });
}
