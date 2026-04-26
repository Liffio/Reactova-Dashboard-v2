import { useAppSelector } from "@/store/hooks";

export function usePermissions() {
  return useAppSelector((state) => state.auth.permissions);
}
