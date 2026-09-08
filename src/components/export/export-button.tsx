import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportDialog } from "@/components/export/export-dialog";
import { usePermissions } from "@/lib/rbac";
import { SECTION_PRESETS, DESCRIPTOR_BY_KEY } from "@/lib/export/registry";

/**
 * Standard "Export Records" trigger. Hidden entirely when the signed-in member
 * cannot read any of the section's record types.
 */
export function ExportRecordsButton({
  section,
  label = "Export Records",
  size = "sm",
  variant = "outline",
  className,
}: {
  section: keyof typeof SECTION_PRESETS | string;
  label?: string;
  size?: "sm" | "default";
  variant?: "outline" | "secondary" | "default" | "ghost";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { can } = usePermissions();
  const preset = SECTION_PRESETS[section];
  const allowed =
    !preset ||
    preset.keys.some((k) => {
      const desc = DESCRIPTOR_BY_KEY[k];
      return desc ? can(desc.permission) : false;
    });
  if (!allowed) return null;

  return (
    <>
      <Button size={size} variant={variant} className={className} onClick={() => setOpen(true)}>
        <Download className="mr-2 h-4 w-4" />
        {label}
      </Button>
      <ExportDialog open={open} onOpenChange={setOpen} section={section} />
    </>
  );
}
