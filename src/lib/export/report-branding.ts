import logoAsset from "../../assets/poultrypro-logo.png.asset.json";

export const REPORT_TAGLINE = "Smart Farming. Better Decisions. Higher Profits.";

let logoDataUrlPromise: Promise<string> | null = null;

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not prepare the PoultryPro logo."));
    };
    reader.onerror = () => reject(new Error("Could not prepare the PoultryPro logo."));
    reader.readAsDataURL(blob);
  });
}

/** Shared source for official branding across every generated PDF report. */
export function getPoultryProReportLogo() {
  if (!logoDataUrlPromise) {
    logoDataUrlPromise = fetch(logoAsset.url)
      .then((response) => {
        if (!response.ok) throw new Error("Could not load the PoultryPro logo.");
        return response.blob();
      })
      .then(blobToDataUrl)
      .catch((error) => {
        logoDataUrlPromise = null;
        throw error;
      });
  }
  return logoDataUrlPromise;
}