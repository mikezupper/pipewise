// The same pipelines in pipewise, RxJS, and a plain loop, run against the
// built package. Run: pnpm bench. Results are recorded in docs/performance.md.
import { cpus } from "node:os";
import { lastValueFrom, from as rxFrom, of as rxOf } from "rxjs";
import {
  filter as rxFilter,
  map as rxMap,
  mergeMap as rxMergeMap,
  reduce as rxReduce,
  scan as rxScan,
  switchMap as rxSwitchMap,
  toArray as rxToArray,
} from "rxjs/operators";
import { Bench } from "tinybench";
import {
  collect,
  filter,
  fromIterable,
  lines,
  map,
  mergeMap,
  ndjson,
  of,
  reduce,
  scan,
  switchMap,
} from "../dist/index.js";

const N = 100_000;
const numbers = Array.from({ length: N }, (_, i) => i);
const chunks = Array.from({ length: 2_000 }, (_, i) =>
  `{"id":${i},"level":"${i % 7 ? "info" : "error"}"}\n`.repeat(5),
);

const suites = {
  [`map → filter → reduce, ${N.toLocaleString("en")} values`]: {
    "plain loop": () => {
      let sum = 0;
      for (const n of numbers) {
        const m = n * 2;
        if (m % 3 === 0) sum += m;
      }
      return sum;
    },
    rxjs: () =>
      lastValueFrom(
        rxFrom(numbers).pipe(
          rxMap((n) => n * 2),
          rxFilter((n) => n % 3 === 0),
          rxReduce((a, b) => a + b, 0),
        ),
      ),
    pipewise: () =>
      collect(
        fromIterable(numbers)
          .pipeThrough(map((n) => n * 2))
          .pipeThrough(filter((n) => n % 3 === 0))
          .pipeThrough(reduce((a, b) => a + b, 0)),
      ),
  },
  [`scan, ${N.toLocaleString("en")} values`]: {
    rxjs: () =>
      lastValueFrom(
        rxFrom(numbers).pipe(
          rxScan((a, b) => a + b, 0),
          rxToArray(),
        ),
      ),
    pipewise: () => collect(fromIterable(numbers).pipeThrough(scan((a, b) => a + b, 0))),
  },
  "mergeMap, 2,000 inner streams of 10": {
    rxjs: () =>
      lastValueFrom(
        rxFrom(numbers.slice(0, 2_000)).pipe(
          rxMergeMap(() => rxFrom(numbers.slice(0, 10))),
          rxToArray(),
        ),
      ),
    pipewise: () =>
      collect(
        fromIterable(numbers.slice(0, 2_000)).pipeThrough(
          mergeMap(() => fromIterable(numbers.slice(0, 10))),
        ),
      ),
  },
  "switchMap, 2,000 inner streams of 3": {
    rxjs: () =>
      lastValueFrom(
        rxFrom(numbers.slice(0, 2_000)).pipe(
          rxSwitchMap((n) => rxOf(n, n, n)),
          rxToArray(),
        ),
      ),
    pipewise: () =>
      collect(fromIterable(numbers.slice(0, 2_000)).pipeThrough(switchMap((n) => of(n, n, n)))),
  },
  "NDJSON, 10,000 records in 2,000 chunks": {
    "plain split + JSON.parse": () =>
      chunks
        .join("")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l)),
    "pipewise lines() + ndjson()": () => collect(fromIterable(chunks).pipeThrough(ndjson())),
    "pipewise lines() only": () => collect(fromIterable(chunks).pipeThrough(lines())),
  },
};

console.log(
  `${process.release.name} ${process.version}, ${cpus()[0]?.model ?? "unknown CPU"}, ${new Date().toISOString().slice(0, 10)}\n`,
);
for (const [title, cases] of Object.entries(suites)) {
  const suite = new Bench({ time: 1000, warmupTime: 200 });
  for (const [name, fn] of Object.entries(cases)) suite.add(name, fn);
  await suite.run();
  const rows = suite.tasks.map((task) => ({
    name: task.name,
    hz: task.result?.throughput?.mean ?? task.result?.hz ?? 0,
  }));
  const fastest = Math.max(...rows.map((r) => r.hz));
  console.log(`### ${title}`);
  for (const { name, hz } of rows) {
    console.log(
      `  ${name.padEnd(28)} ${hz.toFixed(1).padStart(9)} ops/s   ${(fastest / hz).toFixed(1).padStart(5)}× slower than fastest`,
    );
  }
  console.log();
}
