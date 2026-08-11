import { usePermissions } from "@/lib/rbac";
import { PermissionDenied } from "@/components/permission-denied";
import { Loader2 } from "lucide-react";

/**
 * Route-level access gate. Wrapping the route component (rather than early
 * returning inside it) keeps hook order stable while permissions load.
 */
export function RequirePermission({
  permission,
  anyOf,
  hint,
  children,
}: {
  permission?: string;
  anyOf?: string[];
  hint?: string;
  children: React.ReactNode;
}) {
  const { can, canAny, loading } = usePermissions();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const allowed = anyOf?.length ? canAny(anyOf) : permission ? can(permission) : true;
  if (!allowed) return <PermissionDenied hint={hint} />;

  return <>{children}</>;
}
