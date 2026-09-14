import { parseHg, writeHg, type ParseResult } from "./parse";
import type { MappingFile } from "./mapping";
import type { WorkerJob, WorkerResponse } from "./worker-protocol";

type Pending = {
  resolve: (value: ParseResult | ArrayBuffer) => void;
  reject: (err: Error) => void;
};

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();
let workerFailed = false;

function rejectAll(error: Error) {
  for (const item of pending.values()) item.reject(error);
  pending.clear();
}

function getWorker(): Worker | null {
  if (workerFailed || typeof window === "undefined") return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
  } catch {
    workerFailed = true;
    return null;
  }
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const msg = event.data;
    const item = pending.get(msg.id);
    if (!item) return;
    pending.delete(msg.id);
    if (msg.type === "error") item.reject(new Error(msg.error));
    else if (msg.type === "parsed") item.resolve(msg.result);
    else item.resolve(msg.bytes);
  };
  worker.onerror = () => {
    workerFailed = true;
    rejectAll(new Error("Web Worker indisponível"));
    worker?.terminate();
    worker = null;
  };
  return worker;
}

function callWorker(job: WorkerJob): Promise<ParseResult | ArrayBuffer> {
  const w = getWorker();
  if (!w) {
    return Promise.reject(new Error("worker unavailable"));
  }
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ ...job, id });
  });
}

export async function parseHgClient(
  bytes: Uint8Array,
  mapping: MappingFile,
): Promise<ParseResult> {
  const copy = bytes.slice().buffer;
  try {
    const result = await callWorker({ type: "parse", bytes: copy, mapping });
    return result as ParseResult;
  } catch {
    return parseHg(bytes, mapping);
  }
}

export async function encodeHgClient(
  json: unknown,
  mapping: MappingFile,
): Promise<Uint8Array> {
  try {
    const buf = (await callWorker({ type: "encode", json, mapping })) as ArrayBuffer;
    return new Uint8Array(buf);
  } catch {
    return writeHg(json, mapping);
  }
}
