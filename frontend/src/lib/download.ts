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
  // Keep the link in the page and out of the way. display:none, and removing
  // the link in the same turn as the click, makes Chrome and Safari ignore it.
  anchor.style.position = "fixed";
  anchor.style.left = "0";
  anchor.style.top = "0";
  anchor.style.opacity = "0";
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 2000);
}

// Installed phone apps, especially on iOS, ignore a normal file download.
// Hand the file to the system share sheet from the tap itself so it can be
// saved. Desktop and mobile browsers download the file directly.
export function downloadTextFile(filename: string, contents: string, mimeType = "text/csv") {
  const payload = mimeType === "text/csv" ? `\uFEFF${contents}` : contents;
  const blob = new Blob([payload], { type: "application/octet-stream" });
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
