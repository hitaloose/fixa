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
