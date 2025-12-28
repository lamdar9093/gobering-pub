import { lazy, Suspense } from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ReadOnlyProvider } from "@/contexts/ReadOnlyContext";
import { MutationErrorHandler } from "@/components/MutationErrorHandler";
import ChatWidget from "@/components/chat-widget";
import CookieConsent from "@/components/CookieConsent";
import LoadingAnimation from "@/components/LoadingAnimation";
import ScrollToTop from "@/components/ScrollToTop";

import Home from "@/pages/home";
import SearchResults from "@/pages/SearchResults";
import ProfessionalProfile from "@/pages/ProfessionalProfile";
import ProLanding from "@/pages/ProLanding";
import ProLogin from "@/pages/ProLogin";
import ProRegister from "@/pages/ProRegister";
import VerifyEmailPending from "@/pages/VerifyEmailPending";
import VerifyEmail from "@/pages/VerifyEmail";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import AcceptInvitation from "@/pages/AcceptInvitation";
import CancelAppointment from "@/pages/CancelAppointment";
import PriorityBooking from "@/pages/PriorityBooking";
import CGU from "@/pages/CGU";
import Confidentialite from "@/pages/Confidentialite";
import Pricing from "@/pages/Pricing";
import Contact from "@/pages/Contact";
import NotFound from "@/pages/not-found";

const Calendrier = lazy(() => import("@/pages/Calendrier"));
const Clients = lazy(() => import("@/pages/Clients"));
const PatientDetails = lazy(() => import("@/pages/PatientDetails"));
const Profil = lazy(() => import("@/pages/Profil"));
const Statistiques = lazy(() => import("@/pages/Statistiques"));
const Parametres = lazy(() => import("@/pages/Parametres"));
const GeneralSettings = lazy(() => import("@/pages/settings/General"));
const ReservationSettings = lazy(() => import("@/pages/settings/Reservation"));
const NotificationsSettings = lazy(() => import("@/pages/settings/Notifications"));
const SecuriteSettings = lazy(() => import("@/pages/settings/Securite"));
const CliniqueSettings = lazy(() => import("@/pages/settings/Clinique"));
const WaitlistSettings = lazy(() => import("@/pages/settings/Waitlist"));
const SubscriptionSettings = lazy(() => import("@/pages/settings/Subscription"));
const DangerSettings = lazy(() => import("@/pages/settings/Danger"));
const GestionClinique = lazy(() => import("@/pages/GestionClinique"));
const ListeAttente = lazy(() => import("@/pages/ListeAttente"));
const Promouvoir = lazy(() => import("@/pages/Promouvoir"));
const PublicBooking = lazy(() => import("@/pages/PublicBooking"));

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <LoadingAnimation />
  </div>
);

function Router() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/recherche" component={SearchResults} />
        <Route path="/professionnel/:id" component={ProfessionalProfile} />
        <Route path="/pro" component={ProLanding} />
        <Route path="/tarifs">
          <Redirect to="/pricing" />
        </Route>
        <Route path="/connexion-professionnel" component={ProLogin} />
        <Route path="/login-professionnel" component={ProLogin} />
        <Route path="/inscription-professionnel" component={ProRegister} />
        <Route path="/verify-email-pending" component={VerifyEmailPending} />
        <Route path="/verify-email/:token" component={VerifyEmail} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password/:token" component={ResetPassword} />
        <Route path="/invitation/:token" component={AcceptInvitation} />
        <Route path="/appointments/cancel/:token" component={CancelAppointment} />
        <Route path="/appointments/priority/:token" component={PriorityBooking} />
        <Route path="/dashboard" component={Calendrier} />
        <Route path="/clients" component={Clients} />
        <Route path="/clients/:id" component={PatientDetails} />
        <Route path="/dashboard/clients" component={Clients} />
        <Route path="/dashboard/profil" component={Profil} />
        <Route path="/dashboard/statistiques" component={Statistiques} />
        <Route path="/dashboard/parametres" component={Parametres} />
        <Route path="/dashboard/parametres/general" component={GeneralSettings} />
        <Route path="/dashboard/parametres/reservation" component={ReservationSettings} />
        <Route path="/dashboard/parametres/notifications" component={NotificationsSettings} />
        <Route path="/dashboard/parametres/securite" component={SecuriteSettings} />
        <Route path="/dashboard/parametres/clinique" component={CliniqueSettings} />
        <Route path="/dashboard/parametres/waitlist" component={WaitlistSettings} />
        <Route path="/dashboard/parametres/abonnement" component={SubscriptionSettings} />
        <Route path="/dashboard/parametres/danger" component={DangerSettings} />
        <Route path="/dashboard/gestion-clinique" component={GestionClinique} />
        <Route path="/dashboard/liste-attente" component={ListeAttente} />
        <Route path="/dashboard/promouvoir" component={Promouvoir} />
        <Route path="/rdv/:slug" component={PublicBooking} />
        <Route path="/cgu" component={CGU} />
        <Route path="/confidentialite" component={Confidentialite} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/contact" component={Contact} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ReadOnlyProvider>
        <MutationErrorHandler />
        <TooltipProvider>
          <ScrollToTop />
          <Toaster />
          <Router />
          <ChatWidget />
          <CookieConsent />
        </TooltipProvider>
      </ReadOnlyProvider>
    </QueryClientProvider>
  );
}

export default App;
