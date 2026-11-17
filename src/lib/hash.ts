const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

/** SHA-256 as lowercase hex: media IDs (content-addressed) and note duplicate checksums. */
export async function sha256Hex(data: string | Blob | ArrayBuffer): Promise<string> {
  const bytes =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : data instanceof Blob
        ? await data.arrayBuffer()
        : data;
  return toHex(await crypto.subtle.digest("SHA-256", bytes));
}

/** Anki's notes.csum: the first 32 bits of the SHA-1 of the first field's text. */
export async function ankiChecksum(text: string): Promise<number> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text)),
  );
  return new DataView(digest.buffer).getUint32(0);
}
