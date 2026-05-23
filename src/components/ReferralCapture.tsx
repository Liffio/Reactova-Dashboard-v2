import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { captureReferralFromUrl } from "@/lib/referralAttribution";

export function ReferralCapture() {
  const location = useLocation();

  useEffect(() => {
    captureReferralFromUrl(location.search);
  }, [location.search]);

  return null;
}
