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

// Phones and the installed app have no normal file download. Desktop browsers,
// including Brave, save from a real link click instead of a scripted one.
export function prefersShareSheet() {
  return isAppleTouchDevice() || isInstalledApp();
}

export function csvObjectUrl(contents: string, mimeType = "text/csv") {
  const payload = mimeType === "text/csv" ? `\uFEFF${contents}` : contents;
  return URL.createObjectURL(new Blob([payload], { type: `${mimeType};charset=utf-8` }));
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
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}

function cancelled(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function shareTextFile(filename: string, contents: string, mimeType = "text/csv") {
  const payload = mimeType === "text/csv" ? `\uFEFF${contents}` : contents;
  const blob = new Blob([payload], { type: `${mimeType};charset=utf-8` });
  const file = shareableFile(filename, blob);
  if (!file) {
    triggerAnchorDownload(filename, blob);
    return;
  }
  try {
    await navigator.share({ files: [file] });
  } catch (error) {
    if (cancelled(error)) return;
    triggerAnchorDownload(filename, blob);
  }
}
