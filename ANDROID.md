# PoultryPro Android app

The Android app is a native shell that loads https://poultrypro.life. Publishing in Lovable updates the app instantly.

## Build on your computer (one time)
1. Install Android Studio and Node.js.
2. In Lovable, use "Export to GitHub", then clone the repo.
3. In the project folder run:
   ```
   npm install
   npx cap add android
   npx cap sync android
   npx cap open android
   ```
4. Add camera permission to `android/app/src/main/AndroidManifest.xml`:
   ```
   <uses-permission android:name="android.permission.CAMERA" />
   ```
5. Generate icons/splash: `npx @capacitor/assets generate --android` (using the PoultryPro logo in `resources/icon.png`).
6. In Android Studio: Build > Generate Signed Bundle (AAB) and upload to Google Play Console.

After pulling new code later, run `npx cap sync android`.
