import { useAppSelector } from "@/store/hooks";

export function useModules() {
  return useAppSelector((state) => state.auth.modules);
}
