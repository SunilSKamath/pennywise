function isAppleTouchDevice() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isInstalledApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function shareableFile(filename: string, blob: Blob) {
  if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return null;
  for (const type of ["text/csv", "text/plain"]) {
    const file = new File([blob], filename, { type });
    if (navigator.canShare({ files: [file] })) return file;
  }
  return null;
}

function triggerAnchorDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  // Chrome on macOS often waits on a save dialog. Revoking the blob after a
  // couple of seconds cancels that download before the file is written.
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}

type SaveFilePicker = (options: {
  suggestedName?: string;
  types?: { description?: string; accept: Record<string, string[]> }[];
}) => Promise<{
  createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
}>;

function cancelled(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

// Chrome ignores a hidden blob link. The save picker writes the file directly.
async function saveWithPicker(filename: string, blob: Blob) {
  const showSaveFilePicker = (window as Window & { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
  if (typeof showSaveFilePicker !== "function") return false;
  try {
    const handle = await showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: "CSV", accept: { "text/csv": [".csv"] } }]
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch (error) {
    if (cancelled(error)) return true;
    return false;
  }
}

// Installed phone apps, especially on iOS, ignore a normal file download.
// Hand the file to the system share sheet from the tap itself so it can be
// saved. Desktop browsers use the save dialog.
export async function downloadTextFile(filename: string, contents: string, mimeType = "text/csv") {
  const payload = mimeType === "text/csv" ? `\uFEFF${contents}` : contents;
  const blob = new Blob([payload], { type: `${mimeType};charset=utf-8` });
  const file = isAppleTouchDevice() || isInstalledApp() ? shareableFile(filename, blob) : null;

  if (file) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      if (cancelled(error)) return;
    }
  }

  if (await saveWithPicker(filename, blob)) return;
  triggerAnchorDownload(filename, blob);
}
