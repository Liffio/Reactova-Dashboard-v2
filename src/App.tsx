import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Provider } from "react-redux";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/state/AppContext";
import { SocketProvider } from "@/socket/SocketProvider";
import { store } from "@/store";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PlatformAdminRoute } from "@/components/auth/PlatformAdminRoute";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import Register from "./pages/Register";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Automations from "./pages/Automations";
import ShortLinks from "./pages/ShortLinks";
import Scheduler from "./pages/Scheduler";
import BioLink from "./pages/BioLink";
import Analytics from "./pages/Analytics";
import Leads from "./pages/Leads";
import LeadsCapturedRedirect from "./pages/LeadsCapturedRedirect";
import Affiliate from "./pages/Affiliate";
import Settings from "./pages/Settings";
import Billing from "./pages/Billing";
import Agency from "./pages/Agency";
import RbacMaster from "./pages/RbacMaster";
import AcceptInvite from "./pages/AcceptInvite";
import PublicBioLink from "./pages/PublicBioLink";
import ShortLinkRedirect from "./pages/ShortLinkRedirect";
import ApiDocs from "./pages/ApiDocs";
import { DocsLayout } from "@/components/layout/DocsLayout";
import { ReferralCapture } from "@/components/ReferralCapture";

const queryClient = new QueryClient();
const isBioDomain = () => {
  const host = window.location.hostname.toLowerCase();
  return host === "bio.reactova.com" || host.startsWith("bio.reactova.");
};

const isShortLinkDomain = () => {
  const host = window.location.hostname.toLowerCase();
  return host === "go.reactova.com" || host.startsWith("go.reactova.");
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <Provider store={store}>
        <AppProvider>
          <SocketProvider>
            <BrowserRouter>
              <ReferralCapture />
              {isBioDomain() ? (
                <Routes>
                  <Route path="*" element={<PublicBioLink />} />
                </Routes>
              ) : isShortLinkDomain() ? (
                <Routes>
                  <Route path="*" element={<ShortLinkRedirect />} />
                </Routes>
              ) : (
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/docs" element={<DocsLayout />}>
                    <Route index element={<Navigate to="/docs/api" replace />} />
                    <Route path="api" element={<ApiDocs />} />
                  </Route>
                  <Route path="/login" element={<Login />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/accept-invite" element={<AcceptInvite />} />
                  <Route path="/dashboard" element={<ProtectedRoute module="workspace"><Dashboard /></ProtectedRoute>} />
                  <Route path="/automations" element={<ProtectedRoute module="automation"><Automations /></ProtectedRoute>} />
                  <Route path="/short-links" element={<ProtectedRoute module="shortlink"><ShortLinks /></ProtectedRoute>} />
                  <Route path="/scheduler" element={<ProtectedRoute module="automation"><Scheduler /></ProtectedRoute>} />
                  <Route path="/bio-link" element={<ProtectedRoute module="biolink"><BioLink /></ProtectedRoute>} />
                  <Route path="/analytics" element={<ProtectedRoute module="analytics"><Analytics /></ProtectedRoute>} />
                  <Route path="/leads-captured/:slug" element={<LeadsCapturedRedirect />} />
                  <Route path="/leads-captured" element={<ProtectedRoute module="lead"><Leads /></ProtectedRoute>} />
                  <Route path="/leads" element={<Navigate to="/leads-captured" replace />} />
                  <Route path="/affiliate" element={<ProtectedRoute module="affiliate"><Affiliate /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute module="workspace"><Settings /></ProtectedRoute>} />
                  <Route path="/billing" element={<ProtectedRoute module="workspace"><Billing /></ProtectedRoute>} />
                  <Route path="/agency" element={<ProtectedRoute module="agency"><Agency /></ProtectedRoute>} />
                  <Route path="/rbac-master" element={<PlatformAdminRoute><RbacMaster /></PlatformAdminRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              )}
            </BrowserRouter>
          </SocketProvider>
        </AppProvider>
      </Provider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
