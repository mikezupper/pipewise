/** Thrown when a stream completes without the value an operator or sink requires. */
export class EmptyError extends Error {
  override readonly name = "EmptyError";
  constructor(message = "Stream completed without emitting a value") {
    super(message);
  }
}

/** Thrown by `single()` when a stream emits more than one value. */
export class SequenceError extends Error {
  override readonly name = "SequenceError";
  constructor(message = "Stream emitted more than one value") {
    super(message);
  }
}

/** Thrown by `timeout()` when a stream is silent for too long. */
export class TimeoutError extends Error {
  override readonly name = "TimeoutError";
  constructor(message = "Stream timed out") {
    super(message);
  }
}

/** Thrown by `single()` when values arrived but none matched the predicate. */
export class NotFoundError extends Error {
  override readonly name = "NotFoundError";
  constructor(message = "No matching values") {
    super(message);
  }
}

/** Thrown by `elementAt()` when the stream ends before the requested index. */
export class ArgumentOutOfRangeError extends Error {
  override readonly name = "ArgumentOutOfRangeError";
  constructor(message = "Argument out of range") {
    super(message);
  }
}

/** Thrown when a bounded queue with `overflow: "error"` is full. */
export class BufferOverflowError extends Error {
  override readonly name = "BufferOverflowError";
  constructor(message = "Buffer overflow: the reader is not keeping up") {
    super(message);
  }
}

/** Thrown by `responseText()` when a response's status is not 2xx. */
export class HttpError extends Error {
  override readonly name = "HttpError";
  readonly status: number;
  readonly statusText: string;
  readonly response: Response;
  constructor(response: Response) {
    super(`HTTP ${String(response.status)} ${response.statusText}`.trim());
    this.status = response.status;
    this.statusText = response.statusText;
    this.response = response;
  }
}
