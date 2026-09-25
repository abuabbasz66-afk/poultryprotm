# PoultryPro Android app

Native shell (package `life.poultrypro.app`) that loads https://poultrypro.life
(`www.poultrypro.life` redirects there). Publishing the website updates the app instantly.
The `android/` folder is already generated, branded (icon, adaptive icon, splash) and hardened.

## Open and build
1. Install Android Studio (with JDK 21) and Node.js.
2. Export the project to GitHub and clone it.
3. `npm install` then `npx cap sync android` then `npx cap open android`.
4. Let Gradle sync. Run on a phone with the green Run button (debug build installs as `life.poultrypro.app.debug`).

## Release AAB for Google Play
1. Create a signing key once (keep it safe and backed up — losing it blocks future updates):
   `keytool -genkey -v -keystore poultrypro-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias poultrypro`
   Store the `.jks` file in the project root (it is git-ignored).
2. Copy `android/keystore.properties.example` to `android/keystore.properties` and fill in your passwords. Never commit it.
3. Before each release, raise `versionCode` (1, 2, 3…) and `versionName` in `android/app/build.gradle`.
4. Android Studio: Build > Generate Signed App Bundle, or run `cd android && ./gradlew bundleRelease`.
   Output: `android/app/build/outputs/bundle/release/app-release.aab`.
5. Upload in Google Play Console (enable Play App Signing). Data safety: account info, farm records, photos (receipts) — encrypted in transit, not sold.

## Security built in
HTTPS only, no cleartext, WebView debugging off, backups of session/offline data disabled,
only INTERNET + CAMERA permissions, no secrets in the app. Payments stay verified by the server.

## Device test checklist
Login/logout, back button (closes popups first, then goes back, exits at the start),
receipt photo (camera, gallery, cancel, deny permission), offline record → close app → reopen →
reconnect → exactly one record synced, report download/share, Paystack checkout.
