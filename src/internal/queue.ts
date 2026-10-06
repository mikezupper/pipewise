/** A FIFO with amortized constant-time removal; consumed values are released. */
export class Queue<T> {
  private items: (T | undefined)[] = [];
  private head = 0;

  get length(): number {
    return this.items.length - this.head;
  }

  push(value: T): void {
    this.items.push(value);
  }

  shift(): T | undefined {
    const { items } = this;
    if (this.head >= items.length) return undefined;
    const value = items[this.head];
    items[this.head++] = undefined;
    // Drop consumed slots once they fill half the array: amortized O(1).
    if (this.head * 2 >= items.length) {
      items.splice(0, this.head);
      this.head = 0;
    }
    return value;
  }

  clear(): void {
    this.items.length = 0;
    this.head = 0;
  }
}
