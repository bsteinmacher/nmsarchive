export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadBytes(filename: string, bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  downloadBlob(
    filename,
    new Blob([copy], { type: "application/octet-stream" }),
  );
}

export function downloadText(
  filename: string,
  text: string,
  mime = "application/json",
) {
  downloadBlob(filename, new Blob([text], { type: mime }));
}

export function safeFilename(name: string): string {
  const trimmed = name.trim().replace(/[^\w.-]+/g, "_") || "item";
  return trimmed.slice(0, 80);
}
