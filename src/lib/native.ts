/**
 * Native (Capacitor) helpers. Every function is safe on the web/PWA:
 * native code is only loaded when running inside the Android app.
 */
import { Capacitor } from "@capacitor/core";

export function isNativeApp(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

/** Opens the phone camera and returns the photo as a File, or null if cancelled. */
export async function takeReceiptPhoto(): Promise<File | null> {
  if (!isNativeApp()) return null;
  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
  try {
    const photo = await Camera.getPhoto({
      source: CameraSource.Prompt,
      resultType: CameraResultType.Uri,
      quality: 70,
      width: 1600,
      correctOrientation: true,
    });
    if (!photo.webPath) return null;
    const blob = await (await fetch(photo.webPath)).blob();
    const ext = photo.format || "jpeg";
    return new File([blob], `receipt-${Date.now()}.${ext}`, { type: blob.type || `image/${ext}` });
  } catch {
    return null; // user cancelled or denied permission
  }
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
  void StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);
  void SplashScreen.hide().catch(() => undefined);
  App.addListener("backButton", () => {
    if (!navigateBack()) void App.minimizeApp();
  });
}
