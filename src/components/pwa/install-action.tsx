import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InstallAction() {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => window.dispatchEvent(new Event("pp-request-install"))}
    >
      <Download /> Install PoultryPro
    </Button>
  );
}