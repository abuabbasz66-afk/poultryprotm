import type { CapacitorConfig } from "@capacitor/cli";

// The Android app is a native shell around the live PoultryPro site, so every
// published update reaches the app without a Play Store resubmission.
const config: CapacitorConfig = {
  appId: "life.poultrypro.app",
  appName: "PoultryPro",
  webDir: "native-shell",
  server: {
    url: "https://poultrypro.life",
    cleartext: false,
    allowNavigation: ["poultrypro.life", "www.poultrypro.life", "checkout.paystack.com", "*.paystack.com", "*.paystack.co"],
  },
  android: {
    allowMixedContent: false,
    // Never allow Chrome remote debugging of the WebView in store builds.
    webContentsDebuggingEnabled: false,
    captureInput: true,
  },
  plugins: {
    SplashScreen: { launchShowDuration: 1500, backgroundColor: "#ffffff", showSpinner: false, androidScaleType: "CENTER_INSIDE" },
    StatusBar: { style: "LIGHT", backgroundColor: "#ffffff", overlaysWebView: false },
  },
};

export default config;
