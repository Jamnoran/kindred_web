import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedLayout } from "./components/Layout";
import { ChatPage } from "./pages/ChatPage";
import { ConversationsPage } from "./pages/ConversationsPage";
import { MatchProfilePage } from "./pages/MatchProfilePage";
import { DiscoveryPage } from "./pages/DiscoveryPage";
import { LikesPage } from "./pages/LikesPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PhotosPage } from "./pages/PhotosPage";
import { PreferencesPage } from "./pages/PreferencesPage";
import { PremiumPage } from "./pages/PremiumPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SignupPage } from "./pages/SignupPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";

function ConversationRedirect() {
  const { id } = useParams();
  return <Navigate to={`/chats/${id}`} replace />;
}

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
            <Route path="/chats/:id/profile" element={<MatchProfilePage />} />
            {/* Notification emails deep-link here (backend EmailNotificationChannel). */}
            <Route path="/conversations/:id" element={<ConversationRedirect />} />
            <Route path="/photos" element={<PhotosPage />} />
            <Route path="/premium" element={<PremiumPage />} />
            {/* Stripe redirect landings (backend STRIPE_SUCCESS_URL / STRIPE_CANCEL_URL). */}
            <Route path="/premium/success" element={<PremiumPage variant="success" />} />
            <Route path="/premium/cancelled" element={<PremiumPage variant="cancelled" />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/preferences" element={<PreferencesPage />} />
            {/* Unknown routes: keep the nav, offer a way home. */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
