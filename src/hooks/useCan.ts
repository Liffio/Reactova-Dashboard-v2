import { usePermissions } from "@/hooks/usePermissions";

export function useCan(moduleKey: string, action: string): boolean {
  const permissions = usePermissions();
  return permissions.includes(`${moduleKey}:${action}`);
}
