import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AdminProvider } from "@/hooks/useAdmin";
import { LanguageProvider } from "@/hooks/useLanguage";
import ProtectedRoute from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import CreateOrder from "./pages/CreateOrder";


import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AdminProducts from "./pages/AdminProducts";

import Inventory from "./pages/Inventory";
import ShippingLoads from "./pages/ShippingLoads";
import LoadDetail from "./pages/LoadDetail";
import ReleaseRequests from "./pages/ReleaseRequests";
import ShippedPallets from "./pages/ShippedPallets";
import ProductRequests from "./pages/ProductRequests";
import NewProductRequest from "./pages/NewProductRequest";
import ProductRequestDetail from "./pages/ProductRequestDetail";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AdminProvider>
            <LanguageProvider>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
                <Route path="/products/new" element={<ProtectedRoute><NewProductRequest /></ProtectedRoute>} />
                <Route path="/products/request/:id" element={<ProtectedRoute><ProductRequestDetail /></ProtectedRoute>} />
                <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
                <Route path="/orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
                <Route path="/orders/new" element={<ProtectedRoute><CreateOrder /></ProtectedRoute>} />
                
                
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/admin/products" element={<ProtectedRoute><AdminProducts /></ProtectedRoute>} />
                
                <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
                <Route path="/shipping-loads" element={<ProtectedRoute><ShippingLoads /></ProtectedRoute>} />
                <Route path="/shipping-loads/:id" element={<ProtectedRoute><LoadDetail /></ProtectedRoute>} />
                <Route path="/release-requests" element={<ProtectedRoute><ReleaseRequests /></ProtectedRoute>} />
                <Route path="/shipped-pallets" element={<ProtectedRoute><ShippedPallets /></ProtectedRoute>} />
                {/* Legacy redirects */}
                <Route path="/product-requests" element={<ProtectedRoute><ProductRequests /></ProtectedRoute>} />
                <Route path="/product-requests/new" element={<ProtectedRoute><NewProductRequest /></ProtectedRoute>} />
                <Route path="/product-requests/:id" element={<ProtectedRoute><ProductRequestDetail /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </LanguageProvider>
          </AdminProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
