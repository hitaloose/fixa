export type ShareOutcome = "shared" | "downloaded" | "cancelled";

/**
 * Hands a file to the user: the system share sheet where files can be shared (phones: save to
 * Drive/Files, send to yourself), a regular download otherwise.
 */
export async function shareOrDownload(blob: Blob, fileName: string): Promise<ShareOutcome> {
  const file = new File([blob], fileName, { type: blob.type });
  if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return "cancelled";
      // Some browsers claim support but fail: fall back to a download.
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
