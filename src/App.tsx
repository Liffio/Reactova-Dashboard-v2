import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Provider } from "react-redux";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/state/AppContext";
import { store } from "@/store";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
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
      <Provider store={store}>
        <AppProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/dashboard" element={<ProtectedRoute module="workspace"><Dashboard /></ProtectedRoute>} />
              <Route path="/automations" element={<ProtectedRoute module="automation"><Automations /></ProtectedRoute>} />
              <Route path="/short-links" element={<ProtectedRoute module="shortlink"><ShortLinks /></ProtectedRoute>} />
              <Route path="/scheduler" element={<ProtectedRoute module="automation"><Scheduler /></ProtectedRoute>} />
              <Route path="/bio-link" element={<ProtectedRoute module="biolink"><BioLink /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute module="analytics"><Analytics /></ProtectedRoute>} />
              <Route path="/leads" element={<ProtectedRoute module="lead"><Leads /></ProtectedRoute>} />
              <Route path="/affiliate" element={<ProtectedRoute module="affiliate"><Affiliate /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute module="workspace"><Settings /></ProtectedRoute>} />
              <Route path="/agency" element={<ProtectedRoute module="agency"><Agency /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AppProvider>
      </Provider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
