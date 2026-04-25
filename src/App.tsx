import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/state/AppContext";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Automations from "./pages/Automations";
import ShortLinks from "./pages/ShortLinks";
import Scheduler from "./pages/Scheduler";
import BioLink from "./pages/BioLink";
import Analytics from "./pages/Analytics";
import Leads from "./pages/Leads";
import Affiliate from "./pages/Affiliate";
import Settings from "./pages/Settings";
import Agency from "./pages/Agency";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/automations" element={<Automations />} />
            <Route path="/short-links" element={<ShortLinks />} />
            <Route path="/scheduler" element={<Scheduler />} />
            <Route path="/bio-link" element={<BioLink />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/affiliate" element={<Affiliate />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/agency" element={<Agency />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
