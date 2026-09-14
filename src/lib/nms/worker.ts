import { parseHg, writeHg } from "./parse";
import type { WorkerRequest, WorkerResponse } from "./worker-protocol";

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  try {
    if (msg.type === "parse") {
      const result = parseHg(new Uint8Array(msg.bytes), msg.mapping);
      const response: WorkerResponse = { id: msg.id, type: "parsed", result };
      self.postMessage(response);
      return;
    }
    if (msg.type === "encode") {
            const encoded = writeHg(msg.json, msg.mapping);
            const copy = encoded.slice().buffer;
            const response: WorkerResponse = {
              id: msg.id,
              type: "encoded",
              bytes: copy,
            };
            self.postMessage(response);
            return;
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : "Falha no worker do save";
    const response: WorkerResponse = { id: msg.id, type: "error", error };
    self.postMessage(response);
  }
};
