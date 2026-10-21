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
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// Installed phone apps, especially on iOS, ignore a normal file download.
// Hand the file to the system share sheet from the tap itself so it can be
// saved. Desktop and mobile browsers download the file directly.
export function downloadTextFile(filename: string, contents: string, mimeType = "text/csv") {
  const payload = mimeType === "text/csv" ? `\uFEFF${contents}` : contents;
  const blob = new Blob([payload], { type: `${mimeType};charset=utf-8` });
  const file = isAppleTouchDevice() || isInstalledApp() ? shareableFile(filename, blob) : null;

  if (file) {
    return navigator.share({ files: [file] }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      triggerAnchorDownload(filename, blob);
    });
  }

  triggerAnchorDownload(filename, blob);
  return Promise.resolve();
}
