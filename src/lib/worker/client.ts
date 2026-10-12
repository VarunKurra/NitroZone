/**
 * Promise wrapper around the analysis worker. One worker per tab, created lazily.
 */
import type { AnalysisPayload, ProgressStep, WorkerRequest, WorkerResponse } from "./protocol";

type Pending = {
  resolve: (p: AnalysisPayload) => void;
  reject: (e: Error) => void;
  onProgress?: (step: ProgressStep, message: string) => void;
};

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./analysis.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
    const msg = ev.data;
    const p = pending.get(msg.id);
    if (!p) return;
    if (msg.type === "progress") p.onProgress?.(msg.step, msg.message);
    else if (msg.type === "result") {
      pending.delete(msg.id);
      p.resolve(msg.payload);
    } else {
      pending.delete(msg.id);
      p.reject(new Error(msg.message));
    }
  };
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || "Analysis worker crashed"));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;

export function runInWorker(
  req: WithoutId<WorkerRequest>,
  onProgress?: (step: ProgressStep, message: string) => void,
): Promise<AnalysisPayload> {
  const id = ++seq;
  const w = getWorker();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    const transfer: Transferable[] = [];
    if (req.type === "analyze" && req.source.kind === "drone") transfer.push(req.source.file.buffer);
    w.postMessage({ ...req, id } as WorkerRequest, transfer);
  });
}
