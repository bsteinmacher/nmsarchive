import type { MappingFile } from "./mapping";
import type { ParseResult } from "./parse";

export type WorkerJob =
  | { type: "parse"; bytes: ArrayBuffer; mapping: MappingFile }
  | { type: "encode"; json: unknown; mapping: MappingFile };

export type WorkerRequest = WorkerJob & { id: number };

export type WorkerResponse =
  | { id: number; type: "parsed"; result: ParseResult }
  | { id: number; type: "encoded"; bytes: ArrayBuffer }
  | { id: number; type: "error"; error: string };
