import { map, serveOperators } from "../../../src/index.js";

serveOperators({ double: () => map((n: number) => n * 2) });
