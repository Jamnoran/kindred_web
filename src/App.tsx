import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedLayout } from "./components/Layout";
import { ChatPage } from "./pages/ChatPage";
import { ConversationsPage } from "./pages/ConversationsPage";
import { DiscoveryPage } from "./pages/DiscoveryPage";
import { LikesPage } from "./pages/LikesPage";
import { LoginPage } from "./pages/LoginPage";
import { PhotosPage } from "./pages/PhotosPage";
import { PreferencesPage } from "./pages/PreferencesPage";
import { PremiumPage } from "./pages/PremiumPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SignupPage } from "./pages/SignupPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<DiscoveryPage />} />
            <Route path="/likes" element={<LikesPage />} />
            <Route path="/chats" element={<ConversationsPage />} />
            <Route path="/chats/:id" element={<ChatPage />} />
            <Route path="/photos" element={<PhotosPage />} />
            <Route path="/premium" element={<PremiumPage />} />
            {/* Stripe redirect landings (backend STRIPE_SUCCESS_URL / STRIPE_CANCEL_URL). */}
            <Route path="/premium/success" element={<PremiumPage variant="success" />} />
            <Route path="/premium/cancelled" element={<PremiumPage variant="cancelled" />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/preferences" element={<PreferencesPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
