/**
 * Native (Capacitor) helpers. Every function is safe on the web/PWA:
 * native code is only loaded when running inside the Android app.
 */
import { Capacitor } from "@capacitor/core";

export function isNativeApp(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

export type ReceiptPhotoResult =
  | { status: "ok"; file: File }
  | { status: "cancelled" }
  | { status: "denied"; message: string }
  | { status: "unavailable"; message: string };

/** Opens the camera or gallery (user chooses) and returns the photo as a File. */
export async function takeReceiptPhoto(): Promise<ReceiptPhotoResult> {
  if (!isNativeApp()) return { status: "unavailable", message: "Camera is only available in the Android app." };
  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
  try {
    const photo = await Camera.getPhoto({
      source: CameraSource.Prompt,
      resultType: CameraResultType.Uri,
      quality: 70,
      width: 1600,
      correctOrientation: true,
      promptLabelHeader: "Receipt photo",
      promptLabelPhoto: "Choose from gallery",
      promptLabelPicture: "Take photo",
    });
    if (!photo.webPath) return { status: "cancelled" };
    const blob = await (await fetch(photo.webPath)).blob();
    const ext = photo.format || "jpeg";
    return { status: "ok", file: new File([blob], `receipt-${Date.now()}.${ext}`, { type: blob.type || `image/${ext}` }) };
  } catch (err) {
    const msg = String((err as { message?: string })?.message ?? err).toLowerCase();
    if (msg.includes("cancel")) return { status: "cancelled" };
    if (msg.includes("denied") || msg.includes("permission")) {
      return { status: "denied", message: "PoultryPro needs camera or photo access. Allow it in your phone's Settings > Apps > PoultryPro > Permissions." };
    }
    if (msg.includes("no camera") || msg.includes("unavailable") || msg.includes("not available")) {
      return { status: "unavailable", message: "No camera is available on this device. Use Choose file instead." };
    }
    return { status: "unavailable", message: "Could not open the camera. Use Choose file instead." };
  }
}

/** Closes the top-most open dialog, sheet, drawer or menu. Returns true if one was open. */
function closeTopOverlay(): boolean {
  const open = document.querySelectorAll<HTMLElement>(
    '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"], [role="listbox"][data-state="open"], [data-radix-popper-content-wrapper] [data-state="open"]',
  );
  if (!open.length) return false;
  const target = open[open.length - 1];
  const evt = { key: "Escape", code: "Escape", keyCode: 27, bubbles: true, cancelable: true };
  (target.contains(document.activeElement) ? (document.activeElement as HTMLElement) : target).dispatchEvent(
    new KeyboardEvent("keydown", evt),
  );
  return true;
}

/** Android hardware back button + status bar styling. */
export async function initNativeShell(navigateBack: () => boolean) {
  if (!isNativeApp()) return;
  const [{ App }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([
    import("@capacitor/app"),
    import("@capacitor/status-bar"),
    import("@capacitor/splash-screen"),
  ]);
  void StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);
  void StatusBar.setBackgroundColor({ color: "#FFFFFF" }).catch(() => undefined);
  void StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);
  void SplashScreen.hide().catch(() => undefined);
  App.addListener("backButton", () => {
    // 1. keyboard open → just dismiss it
    const el = document.activeElement as HTMLElement | null;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) && !el.closest('[role="dialog"]')) {
      el.blur();
      return;
    }
    // 2. modal / drawer / menu → close it
    if (closeTopOverlay()) return;
    // 3. in-app history → go back; 4. otherwise leave the app (never signs out)
    if (!navigateBack()) void App.minimizeApp();
  });
}
