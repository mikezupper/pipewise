// The browser half of the example. Every arrow below is a pipewise operator
// on a native ReadableStream.
import {
  catchError,
  filter,
  finalize,
  fromEvent,
  fromFetch,
  map,
  of,
  responseText,
  scan,
  sse,
  subscribe,
  switchMap,
  takeUntil,
  tap,
  throttleTime,
} from "pipewise";

const form = document.querySelector("#ask");
const stop = document.querySelector("#stop");
const answer = document.querySelector("#answer");
const metrics = document.querySelector("#metrics");
const wire = document.querySelector("#wire");

let requests = 0;
const log = (text, kind = "info") => {
  const entry = document.createElement("li");
  entry.dataset.kind = kind;
  entry.textContent = `${new Date().toLocaleTimeString()}  ${text}`;
  wire.append(entry);
};

/** One answer: request, parse, and fold the event stream into what to show. */
function ask(prompt) {
  const id = ++requests;
  let finished = false;
  log(`#${id} sent “${prompt}”`);
  return fromFetch("/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt }),
  })
    .pipeThrough(responseText())
    .pipeThrough(sse())
    .pipeThrough(takeUntil(fromEvent(stop, "click")))
    .pipeThrough(
      tap((event) => {
        if (event.event === "done") finished = true;
        if (event.event === "error") log(`#${id} server reported: ${event.data}`, "error");
      }),
    )
    .pipeThrough(
      finalize(() =>
        log(
          finished ? `#${id} complete` : `#${id} cancelled, connection closed`,
          finished ? "done" : "cancel",
        ),
      ),
    )
    .pipeThrough(
      scan(
        (state, event) => {
          if (event.event === "text") return { ...state, text: state.text + event.data };
          if (event.event === "metrics") return { ...state, metrics: JSON.parse(event.data) };
          if (event.event === "error")
            return { ...state, text: `${state.text}\n\n⚠ ${event.data}` };
          return state;
        },
        { text: "", metrics: undefined },
      ),
    )
    .pipeThrough(
      catchError((error) => {
        log(`#${id} failed: ${error.message}`, "error");
        return of({ text: `⚠ ${error.message}`, metrics: undefined });
      }),
    );
}

fromEvent(form, "submit")
  .pipeThrough(
    map((event) => {
      event.preventDefault();
      return form.elements.prompt.value.trim();
    }),
  )
  .pipeThrough(filter((prompt) => prompt !== ""))
  .pipeThrough(switchMap(ask))
  .pipeThrough(throttleTime(50, { trailing: true }))
  .pipeTo(
    subscribe(({ text, metrics: m }) => {
      answer.textContent = text;
      metrics.textContent = m ? `${m.tokens} tokens · ${m.perSecond} tokens/s` : "";
    }),
  );
