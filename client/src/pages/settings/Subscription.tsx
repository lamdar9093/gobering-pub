import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  Check,
  Calendar,
  Download,
  ChevronRight,
  AlertCircle,
  Crown,
  Zap,
  Users,
  DollarSign,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  isTrialExpired,
  getTrialStatusMessage,
} from "@/lib/subscription-utils";
import type { ClinicMember, Professional } from "@shared/schema";
import DashboardLayout from "@/components/DashboardLayout";
import { DowngradePlanWarningDialog } from "@/components/DowngradePlanWarningDialog";
import { DowngradeFeedbackDialog } from "@/components/DowngradeFeedbackDialog";
import { UpgradeToProConfirmDialog } from "@/components/UpgradeToProConfirmDialog";
import ContactModal from "@/components/ContactModal";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SubscriptionData {
  planType: string;
  subscriptionStatus: string;
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  cancelAtPeriodEnd?: boolean;
}

interface ClinicMemberWithDetails extends ClinicMember {
  professional?: Professional;
}

export default function Subscription() {
  const { toast } = useToast();
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [showDowngradeFeedback, setShowDowngradeFeedback] = useState(false);
  const [showDowngradeWarning, setShowDowngradeWarning] = useState(false);
  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false);
  const [showLimitAlert, setShowLimitAlert] = useState(false);
  const [limitAlertType, setLimitAlertType] = useState<'90' | '95' | '100'>('90');
  const [showContactModal, setShowContactModal] = useState(false);
  const [downgradeEndsAt, setDowngradeEndsAt] = useState<string | null>(null);

  const { data: subscription, isLoading } = useQuery<SubscriptionData & { monthlyAppointmentCount?: number }>({
    queryKey: ["/api/subscription"],
  });

  const { data: currentProfessional } = useQuery<Professional>({
    queryKey: ["/api/auth/me"],
  });

  const { data: clinicMembers = [] } = useQuery<ClinicMemberWithDetails[]>({
    queryKey: [`/api/clinics/${currentProfessional?.clinicId}/members`],
    enabled: !!currentProfessional?.clinicId,
  });

  const { data: paymentMethod } = useQuery<{
    hasPaymentMethod: boolean;
    type?: string;
    last4?: string;
    expiryMonth?: number;
    expiryYear?: number;
  }>({
    queryKey: ["/api/subscription/payment-method"],
    enabled: !!subscription?.stripeCustomerId,
  });

  // Define currentPlan early so it's available in all functions
  const currentPlan = subscription?.planType || "legacy";
  const status = subscription?.subscriptionStatus || "legacy";
  const trialExpired = isTrialExpired(subscription?.trialEndsAt);
  const trialStatusMessage = getTrialStatusMessage(subscription?.trialEndsAt);

  // Calculate number of professional seats (excluding secretaries) and pricing
  const professionalMembers = clinicMembers.filter(
    (m) => m.role === "Professionnel" || m.role === "Admin"
  );
  const numberOfSeats = professionalMembers.length || 1;
  const basePricePerMonth = 39;
  const additionalSeatPrice = 15;
  const totalPrice = numberOfSeats <= 1 
    ? basePricePerMonth 
    : basePricePerMonth + (numberOfSeats - 1) * additionalSeatPrice;
  
  // Calculate current monthly cost (used for display in current plan section)
  const basePrice = currentPlan === "free" ? 0 : currentPlan === "pro" ? 39 : 0;
  // On free plan, cost is always 0 regardless of seats
  const monthlyCost = currentPlan === "free" ? 0 : basePrice + Math.max(numberOfSeats - 1, 0) * 15;

  // Check appointment limit and show alerts
  useEffect(() => {
    if (currentPlan === "free" && subscription?.monthlyAppointmentCount) {
      const count = subscription.monthlyAppointmentCount;
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const hasShown90 = localStorage.getItem(`appointmentAlert90-${currentMonth}`);
      const hasShown95 = localStorage.getItem(`appointmentAlert95-${currentMonth}`);
      const hasShown100 = localStorage.getItem(`appointmentAlert100-${currentMonth}`);
      
      if (count >= 100 && !hasShown100) {
        setLimitAlertType('100');
        setShowLimitAlert(true);
        localStorage.setItem(`appointmentAlert100-${currentMonth}`, 'true');
      } else if (count >= 95 && !hasShown95) {
        setLimitAlertType('95');
        setShowLimitAlert(true);
        localStorage.setItem(`appointmentAlert95-${currentMonth}`, 'true');
      } else if (count >= 90 && !hasShown90) {
        setLimitAlertType('90');
        setShowLimitAlert(true);
        localStorage.setItem(`appointmentAlert90-${currentMonth}`, 'true');
      }
    }
  }, [subscription?.monthlyAppointmentCount, currentPlan]);

  const handlePlanSelection = (planType: string) => {
    // Si on choisit le plan gratuit
    if (planType === "free") {
      // Si un downgrade est déjà planifié, annuler le downgrade au lieu de le planifier à nouveau
      if (subscription?.cancelAtPeriodEnd && currentPlan === "pro") {
        cancelDowngradeMutation.mutate();
        return;
      }
      
      // Si l'utilisateur est sur Pro, toujours montrer le warning d'abord
      if (currentPlan === "pro") {
        setShowDowngradeWarning(true);
      } else {
        // Si pas sur Pro, vérifier si on doit afficher l'avertissement
        const professionalMembers = clinicMembers.filter(
          (m) => m.role === "Professionnel" || m.role === "Admin",
        );
        const secretaryMembers = clinicMembers.filter(
          (m) => m.role === "Secrétaire",
        );
        const hasExtraMembers =
          professionalMembers.length > 1 || secretaryMembers.length > 1;

        if (hasExtraMembers) {
          setShowDowngradeWarning(true);
        } else {
          selectFreePlanMutation.mutate();
        }
      }
    } else {
      // Pour le plan Pro, vérifier si on a déjà un moyen de paiement
      if (paymentMethod?.hasPaymentMethod) {
        // Afficher le dialog de confirmation avant l'upgrade
        setShowUpgradeConfirm(true);
      } else {
        // Redirection vers Stripe Checkout pour ajouter une carte
        createCheckoutMutation.mutate(planType);
      }
    }
  };

  const handleFeedbackComplete = () => {
    setShowDowngradeFeedback(false);
    // Show success toast after feedback is complete
    toast({
      title: "Changement de plan confirmé",
      description: downgradeEndsAt 
        ? `Votre plan Pro reste actif jusqu'au ${format(new Date(downgradeEndsAt), "d MMMM yyyy", { locale: fr })}`
        : "Votre plan a été modifié avec succès",
    });
  };

  const handleConfirmDowngrade = () => {
    setShowDowngradeWarning(false);
    // After confirmation, perform the downgrade which will show feedback dialog on success
    selectFreePlanMutation.mutate();
  };

  const handleCancelDowngrade = () => {
    setShowDowngradeWarning(false);
    // L'utilisateur est déjà sur Pro et veut juste annuler le downgrade
    // Pas besoin de rediriger vers Stripe
  };

  const handleConfirmUpgrade = () => {
    setShowUpgradeConfirm(false);
    upgradeToProMutation.mutate();
  };

  const upgradeToProMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/subscription/upgrade-to-pro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Si le paiement nécessite une action, rediriger vers Stripe Checkout
        if (errorData.requiresAction) {
          throw new Error("REQUIRES_STRIPE_CHECKOUT");
        }
        throw new Error(errorData.error || "Erreur lors de l'upgrade");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Plan Pro activé",
        description: "Vous utilisez maintenant le plan Pro.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error: any) => {
      // Si le paiement nécessite une action, rediriger vers Stripe Checkout
      if (error.message === "REQUIRES_STRIPE_CHECKOUT") {
        createCheckoutMutation.mutate("pro");
      } else {
        toast({
          title: "Erreur",
          description: error.message || "Impossible d'activer le plan Pro",
          variant: "destructive",
        });
      }
    },
  });

  const createCheckoutMutation = useMutation({
    mutationFn: async (planType: string) => {
      const response = await fetch("/api/subscription/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType }),
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer la session de paiement",
        variant: "destructive",
      });
    },
  });

  const selectFreePlanMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        "POST",
        "/api/subscription/select-free-plan",
        {},
      );
      return response.json();
    },
    onSuccess: (data) => {
      // Store the subscription end date for display in feedback dialog
      if (data.subscriptionEndsAt) {
        setDowngradeEndsAt(data.subscriptionEndsAt);
      }
      
      // Show feedback dialog after successful downgrade
      setShowDowngradeFeedback(true);
      
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de planifier le changement de plan",
        variant: "destructive",
      });
    },
  });

  const cancelDowngradeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        "POST",
        "/api/subscription/cancel-downgrade",
        {},
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Downgrade annulé",
        description: "Votre abonnement Pro a été réactivé et continuera normalement",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'annuler le downgrade",
        variant: "destructive",
      });
    },
  });

  const cleanupSubscriptionsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(
        "POST",
        "/api/admin/cleanup-duplicate-subscriptions",
        {},
      );
    },
    onSuccess: (data: any) => {
      toast({
        title: "Nettoyage effectué",
        description:
          data.message || "Les abonnements en double ont été annulés",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de nettoyer les abonnements",
        variant: "destructive",
      });
    },
  });

  const createPortalMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/subscription/create-portal", {
        method: "POST",
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'ouvrir le portail de gestion",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950 min-h-screen">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                Abonnement
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-2">
                Gérez votre plan et votre facturation
              </p>
            </div>
            <div className="animate-pulse space-y-4">
              <div className="h-40 bg-slate-200 dark:bg-slate-700 rounded-2xl" />
              <div className="h-60 bg-slate-200 dark:bg-slate-700 rounded-2xl" />
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const planNames: Record<string, string> = {
    legacy: "Legacy",
    free: "Gratuit",
    pro: "Pro",
  };

  const plans = [
    {
      id: "free",
      name: "Plan Gratuit",
      price: 0,
      features: [
        "100 rendez-vous / mois",
        "1 professionnel + 1 assistant(e)",
        "1 widget de réservation",
        "Notifications par email",
        "Profil visible sur Gobering",
        "Profil professionnel individuel",
        "Support standard",
      ],
    },
    {
      id: "pro",
      name: "Plan Pro",
      price: 39,
      popular: true,
      features: [
        "Tout du plan Gratuit, plus :",
        "Rendez-vous illimités",
        "Professionnels et assistant(e)s illimités",
        "Gestion d'équipe avancée",
        "Widgets de réservation illimités",
        "Notifications par email et SMS",
        "Liste d'attente automatique",
        "Statistiques détaillées",
        "Support prioritaire",
      ],
    },
  ];

  return (
    <DashboardLayout>
      <div className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Header */}
          <div className="mb-5">
            <h1
              className="text-2xl font-bold text-slate-900 dark:text-white"
              data-testid="text-subscription-title"
            >
              Abonnement
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Gérez votre plan et votre facturation
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            {/* Colonne principale - 2/3 */}
            <div className="lg:col-span-2 space-y-4">
              {/* Plan actuel */}
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-5 text-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Crown className="w-5 h-5" />
                        <h2 className="text-xl font-bold">
                          Plan {planNames[currentPlan]}
                        </h2>
                      </div>
                      <p className="text-sm text-blue-100">Votre abonnement actuel</p>
                    </div>
                    {status === "trial" && (
                      <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                        <span className="text-sm font-semibold">
                          Essai gratuit
                        </span>
                      </div>
                    )}
                    {status === "active" && (
                      <Badge
                        className="bg-green-500 hover:bg-green-600"
                        data-testid="badge-subscription-status"
                      >
                        Actif
                      </Badge>
                    )}
                    {currentPlan === "legacy" && (
                      <Badge className="bg-yellow-500 hover:bg-yellow-600">
                        Gratuit à vie
                      </Badge>
                    )}
                  </div>

                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-4xl font-bold">
                      {currentPlan === "legacy" ? "0" : monthlyCost}$
                    </span>
                    <span className="text-sm text-blue-100">/mois</span>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {/* Période d'essai */}
                  {status === "trial" && subscription?.trialEndsAt && (
                    <div
                      className={`rounded-xl p-4 flex items-start gap-3 border ${
                        trialExpired
                          ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                          : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                      }`}
                    >
                      <AlertCircle
                        className={`w-5 h-5 mt-0.5 ${
                          trialExpired
                            ? "text-red-600 dark:text-red-400"
                            : "text-blue-600 dark:text-blue-400"
                        }`}
                      />
                      <div>
                        <p
                          className={`font-semibold ${
                            trialExpired
                              ? "text-red-900 dark:text-red-100"
                              : "text-blue-900 dark:text-blue-100"
                          }`}
                        >
                          {trialStatusMessage.title}
                        </p>
                        <p
                          className={`text-sm mt-1 ${
                            trialExpired
                              ? "text-red-700 dark:text-red-300"
                              : "text-blue-700 dark:text-blue-300"
                          }`}
                        >
                          {trialExpired ? (
                            trialStatusMessage.description
                          ) : (
                            <>
                              Votre essai se termine le{" "}
                              <span className="font-semibold">
                                {format(
                                  new Date(subscription.trialEndsAt),
                                  "d MMMM yyyy",
                                  { locale: fr },
                                )}
                              </span>
                              . Votre première facturation débutera après cette
                              date.
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Downgrade scheduled */}
                  {subscription?.cancelAtPeriodEnd && subscription?.subscriptionEndsAt && (
                    <div className="rounded-xl p-4 flex items-start gap-3 border bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                      <AlertCircle className="w-5 h-5 mt-0.5 text-amber-600 dark:text-amber-400" />
                      <div>
                        <p className="font-semibold text-amber-900 dark:text-amber-100">
                          Passage au plan Gratuit planifié
                        </p>
                        <p className="text-sm mt-1 text-amber-700 dark:text-amber-300">
                          Votre abonnement Pro restera actif jusqu'au{" "}
                          <span className="font-semibold">
                            {format(
                              new Date(subscription.subscriptionEndsAt),
                              "d MMMM yyyy",
                              { locale: fr },
                            )}
                          </span>
                          . Après cette date, vous passerez automatiquement au plan Gratuit.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Stats rapides */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                      <p className="text-xl font-bold text-slate-900 dark:text-white">
                        {currentPlan === "free" 
                          ? `${subscription?.monthlyAppointmentCount ?? 0} / 100`
                          : "∞"}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        Rendez-vous
                      </p>
                    </div>
                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                      <p className="text-xl font-bold text-slate-900 dark:text-white">
                        {currentPlan === "legacy" || currentPlan === "pro"
                          ? "∞"
                          : "-"}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        Services
                      </p>
                    </div>
                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                      <p className="text-xl font-bold text-slate-900 dark:text-white">
                        {currentPlan === "legacy" || currentPlan === "pro"
                          ? "∞"
                          : "1"}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        Widgets
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-3">
                    {currentPlan !== "legacy" && (
                      <>
                        <button
                          onClick={() => setShowChangePlan(!showChangePlan)}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2"
                          data-testid="button-change-plan"
                        >
                          <Zap className="w-4 h-4" />
                          {status === "trial"
                            ? "Choisir un plan"
                            : "Changer de plan"}
                        </button>
                        {subscription?.stripeCustomerId && (
                          <Button
                            onClick={() => createPortalMutation.mutate()}
                            disabled={createPortalMutation.isPending}
                            variant="outline"
                            className="px-4 py-2 border-2 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 rounded-lg text-sm font-semibold transition-all"
                            data-testid="button-manage-billing"
                          >
                            {createPortalMutation.isPending
                              ? "Chargement..."
                              : "Gérer l'abonnement"}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Comparaison des plans */}
              {showChangePlan && currentPlan !== "legacy" && (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                    Choisissez votre plan
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {plans.map((plan) => (
                      <div
                        key={plan.id}
                        className={`relative rounded-xl border-2 p-4 transition-all flex flex-col ${
                          plan.popular
                            ? "border-blue-500 shadow-lg shadow-blue-100 dark:shadow-blue-900/20"
                            : "border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-500"
                        }`}
                      >
                        {plan.popular && (
                          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-3 py-0.5 rounded-full">
                              POPULAIRE
                            </span>
                          </div>
                        )}

                        <div className="text-center mb-4">
                          <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                            {plan.name}
                          </h4>
                          <div className="flex items-baseline justify-center gap-1">
                            <span className="text-3xl font-bold text-slate-900 dark:text-white">
                              {plan.price}$
                            </span>
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              /mois
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            +15$ par professionnel ajouté
                          </p>
                        </div>

                        <ul className="space-y-2 mb-4 flex-grow">
                          {plan.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                              <span className="text-sm text-slate-700 dark:text-slate-300">
                                {feature}
                              </span>
                            </li>
                          ))}
                        </ul>

                        <Button
                          onClick={() => {
                            // Allow selecting current plan if trial expired (to activate payment)
                            // Or if canceling a scheduled downgrade
                            if (
                              currentPlan !== plan.id ||
                              (trialExpired && status === "trial") ||
                              (plan.id === "free" && subscription?.cancelAtPeriodEnd && currentPlan === "pro")
                            ) {
                              handlePlanSelection(plan.id);
                            }
                          }}
                          disabled={
                            (currentPlan === plan.id &&
                              (status === "active" || !trialExpired) &&
                              !(plan.id === "free" && subscription?.cancelAtPeriodEnd)) ||
                            createCheckoutMutation.isPending ||
                            cancelDowngradeMutation.isPending
                          }
                          className={`w-full py-3 rounded-xl font-semibold transition-all ${
                            currentPlan === plan.id &&
                            (status === "active" || !trialExpired) &&
                            !(plan.id === "free" && subscription?.cancelAtPeriodEnd)
                              ? "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                              : plan.popular
                                ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg text-white"
                                : plan.id === "free" && subscription?.cancelAtPeriodEnd && currentPlan === "pro"
                                  ? "bg-amber-600 hover:bg-amber-700 text-white hover:shadow-lg"
                                  : "bg-white dark:bg-slate-800 border-2 border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700"
                          }`}
                          data-testid={`button-select-${plan.id}`}
                        >
                          {createCheckoutMutation.isPending || cancelDowngradeMutation.isPending
                            ? "Chargement..."
                            : plan.id === "free" && subscription?.cancelAtPeriodEnd && currentPlan === "pro"
                              ? "Annuler le downgrade"
                              : currentPlan === plan.id && status === "active"
                                ? "Plan actuel"
                                : currentPlan === plan.id && !trialExpired
                                  ? "Plan actuel"
                                  : currentPlan === plan.id &&
                                      trialExpired &&
                                      status === "trial"
                                    ? "Ajouter une carte"
                                    : currentPlan !== "legacy" &&
                                        status !== "legacy"
                                      ? `Passer au plan ${plan.name.replace("Plan ", "")}`
                                      : "Choisir ce plan"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Facturation par siège */}
              {currentPlan !== "legacy" && (
                <div
                  className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4"
                  data-testid="card-seat-billing"
                >
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Facturation par professionnel
                  </h3>
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Professionnels actifs dans votre clinique
                        </p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
                          {numberOfSeats}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Coût total mensuel
                        </p>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                          {monthlyCost}$
                        </p>
                      </div>
                    </div>
                    <div className="border-t border-blue-200 dark:border-blue-800 pt-3">
                      <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                        <span className="text-slate-600 dark:text-slate-400">
                          Calcul: Prix de base ({basePrice}$) +{" "}
                          {Math.max(numberOfSeats - 1, 0)} siège
                          {Math.max(numberOfSeats - 1, 0) !== 1 ? "s" : ""} ×
                          15$
                        </span>
                        <span className="text-lg font-bold text-slate-900 dark:text-white">
                          {monthlyCost}$/mois
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 flex items-start gap-2">
                    <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                    {currentPlan === "free" 
                      ? "Plan gratuit : 1 professionnel (Admin) + 1 secrétaire inclus. Les professionnels supplémentaires sont en lecture seule."
                      : "Le coût augmente automatiquement de 15$/mois par professionnel additionnel ajouté."
                    }
                  </p>

                  {/* Liste des membres */}
                  {professionalMembers.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                        Professionnels de votre clinique (
                        {professionalMembers.length})
                      </h4>
                      <div className="space-y-2">
                        {[...professionalMembers]
                          .sort((a, b) => {
                            // Trier pour mettre l'Admin en premier
                            if (a.role === "Admin" && b.role !== "Admin")
                              return -1;
                            if (a.role !== "Admin" && b.role === "Admin")
                              return 1;
                            return 0;
                          })
                          .map((member, index) => {
                            // Sur le plan gratuit: Admin = write access, autres Professionnels = lecture seule
                            // Sur le plan pro, le premier siège paie le prix de base, les autres 15$
                            // Note: Secrétaires ne sont jamais affichés ici (filtré dans professionalMembers)
                            const isReadOnly = currentPlan === "free" && member.role === "Professionnel";
                            const memberCost = currentPlan === "free" 
                              ? 0 
                              : (index === 0 ? basePrice : 15);

                            return (
                              <div
                                key={member.id}
                                className={`flex items-center justify-between p-3 rounded-lg ${
                                  isReadOnly 
                                    ? "bg-slate-100 dark:bg-slate-800 opacity-60" 
                                    : "bg-slate-50 dark:bg-slate-700"
                                }`}
                                data-testid={`member-${member.professionalId}`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                    isReadOnly 
                                      ? "bg-slate-200 dark:bg-slate-700" 
                                      : "bg-blue-100 dark:bg-blue-900"
                                  }`}>
                                    <Users className={`w-5 h-5 ${
                                      isReadOnly 
                                        ? "text-slate-400 dark:text-slate-500" 
                                        : "text-blue-600 dark:text-blue-400"
                                    }`} />
                                  </div>
                                  <div>
                                    <p className={`font-medium ${
                                      isReadOnly 
                                        ? "text-slate-500 dark:text-slate-400" 
                                        : "text-slate-900 dark:text-white"
                                    }`}>
                                      {member.professional?.firstName}{" "}
                                      {member.professional?.lastName}
                                    </p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                      {member.role}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {isReadOnly && (
                                    <Badge variant="secondary" className="text-xs">
                                      Lecture seule
                                    </Badge>
                                  )}
                                  <Badge
                                    variant="outline"
                                    className={isReadOnly ? "opacity-50" : ""}
                                  >
                                    {memberCost}$/mois
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                      </div>

                      {clinicMembers.some((m) => m.role === "Secrétaire") && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 italic">
                          Note : Les secrétaires ne comptent pas comme des
                          sièges et ne sont pas facturés
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Plans disponibles pour legacy */}
              {currentPlan === "legacy" && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
                    Découvrez nos plans
                  </h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    {plans.map((plan) => (
                      <div
                        key={plan.id}
                        className={`relative rounded-2xl border-2 p-6 transition-all ${
                          plan.popular
                            ? "border-blue-500 shadow-lg shadow-blue-100 dark:shadow-blue-900/20"
                            : "border-slate-200 dark:border-slate-600"
                        }`}
                      >
                        {plan.popular && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                              RECOMMANDÉ
                            </span>
                          </div>
                        )}

                        <div className="text-center mb-6">
                          <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                            {plan.name}
                          </h4>
                          <div className="flex items-baseline justify-center gap-1">
                            <span className="text-4xl font-bold text-slate-900 dark:text-white">
                              {plan.price}$
                            </span>
                            <span className="text-slate-600 dark:text-slate-400">
                              /mois
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                            +15$ par professionnel ajouté
                          </p>
                        </div>

                        <ul className="space-y-3 mb-6">
                          {plan.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                              <span className="text-sm text-slate-700 dark:text-slate-300">
                                {feature}
                              </span>
                            </li>
                          ))}
                        </ul>

                        <Button
                          onClick={() => handlePlanSelection(plan.id)}
                          disabled={createCheckoutMutation.isPending}
                          className={`w-full py-2 rounded-lg text-sm font-semibold transition-all ${
                            plan.popular
                              ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg text-white"
                              : "bg-white dark:bg-slate-800 border-2 border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700"
                          }`}
                          data-testid={`button-upgrade-${plan.id}`}
                        >
                          {createCheckoutMutation.isPending
                            ? "Chargement..."
                            : "Essai gratuit 21 jours"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar - 1/3 */}
            <div className="space-y-4">
              {/* Méthode de paiement */}
              {currentPlan !== "legacy" && (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3">
                    Moyen de paiement
                  </h3>

                  {paymentMethod?.hasPaymentMethod ? (
                    <div className="space-y-3">
                      <div className="bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-700 dark:to-slate-800 rounded-lg p-3 text-white">
                        <div className="flex items-start justify-between mb-4">
                          <CreditCard className="w-6 h-6" />
                          <span className="text-xs font-semibold bg-white/20 px-2 py-0.5 rounded">
                            {paymentMethod.type?.toUpperCase() || "CARD"}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <p className="font-mono text-base">
                            •••• •••• •••• {paymentMethod.last4}
                          </p>
                          <p className="text-xs text-slate-400">
                            Expire{" "}
                            {paymentMethod.expiryMonth
                              ?.toString()
                              .padStart(2, "0")}
                            /{paymentMethod.expiryYear}
                          </p>
                        </div>
                      </div>

                      <Button
                        onClick={() => createPortalMutation.mutate()}
                        disabled={createPortalMutation.isPending}
                        variant="outline"
                        className="w-full"
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        {createPortalMutation.isPending
                          ? "Chargement..."
                          : "Modifier la carte"}
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CreditCard className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                      {status === "trial" && !trialExpired ? (
                        <>
                          <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
                            Aucune carte requise pendant l'essai
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-500 mb-4">
                            Vous pourrez ajouter une carte avant la fin de votre
                            période d'essai
                          </p>
                          <Button
                            onClick={() =>
                              currentPlan === "starter"
                                ? createCheckoutMutation.mutate("starter")
                                : createCheckoutMutation.mutate("pro")
                            }
                            disabled={createCheckoutMutation.isPending}
                            variant="outline"
                            className="w-full"
                          >
                            {createCheckoutMutation.isPending
                              ? "Chargement..."
                              : "Ajouter une carte à l'avance"}
                          </Button>
                        </>
                      ) : (
                        <>
                          <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
                            Aucune carte enregistrée
                          </p>
                          <Button
                            onClick={() =>
                              currentPlan === "starter"
                                ? createCheckoutMutation.mutate("starter")
                                : createCheckoutMutation.mutate("pro")
                            }
                            disabled={createCheckoutMutation.isPending}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                          >
                            {createCheckoutMutation.isPending
                              ? "Chargement..."
                              : "Ajouter une carte"}
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Prochaine facturation / Abonnement annulé */}
              {currentPlan !== "legacy" &&
                (status === "trial" || status === "active") && (
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded-lg flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {status === "trial"
                          ? "Fin de l'essai"
                          : subscription?.cancelAtPeriodEnd
                            ? "Date de fin"
                            : currentPlan === "free"
                              ? "Pas de facturation"
                              : "Prochaine facturation"}
                      </h3>
                    </div>
                    {subscription?.trialEndsAt && status === "trial" && (
                      <>
                        <p className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                          {format(
                            new Date(subscription.trialEndsAt),
                            "d MMMM yyyy",
                            { locale: fr },
                          )}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Montant après l'essai:{" "}
                          <span className="font-semibold text-blue-600 dark:text-blue-400">
                            {monthlyCost}$
                          </span>
                        </p>
                      </>
                    )}
                    {subscription?.subscriptionEndsAt &&
                      status === "active" && (
                        <>
                          <p className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                            {format(
                              new Date(subscription.subscriptionEndsAt),
                              "d MMMM yyyy",
                              { locale: fr },
                            )}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {subscription?.cancelAtPeriodEnd ? (
                              <>
                                Actif jusqu'au:{" "}
                                <span className="font-semibold text-orange-600 dark:text-orange-400">
                                  {format(
                                    new Date(subscription.subscriptionEndsAt),
                                    "d MMMM yyyy",
                                    { locale: fr },
                                  )}
                                </span>
                              </>
                            ) : (
                              <>
                                Montant:{" "}
                                <span className="font-semibold text-blue-600 dark:text-blue-400">
                                  {monthlyCost}$
                                </span>
                              </>
                            )}
                          </p>
                        </>
                      )}
                  </div>
                )}

              {/* Support */}
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                  Besoin d'aide?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                  Notre équipe est là pour vous aider avec toutes vos questions
                  sur la facturation.
                </p>
                <Button
                  onClick={() => setShowContactModal(true)}
                  className="w-full bg-white dark:bg-slate-700 border-2 border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-600 px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2"
                  variant="outline"
                  data-testid="button-contact-support"
                >
                  Contacter le support
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DowngradeFeedbackDialog
        open={showDowngradeFeedback}
        onOpenChange={setShowDowngradeFeedback}
        onComplete={handleFeedbackComplete}
        subscriptionEndsAt={downgradeEndsAt}
      />

      <DowngradePlanWarningDialog
        open={showDowngradeWarning}
        onOpenChange={setShowDowngradeWarning}
        numberOfMembers={clinicMembers.length}
        numberOfProfessionals={
          clinicMembers.filter(
            (m) => m.role === "Professionnel" || m.role === "Admin",
          ).length
        }
        numberOfSecretaries={
          clinicMembers.filter((m) => m.role === "Secrétaire").length
        }
        onContinueWithFree={handleConfirmDowngrade}
        onChoosePro={handleCancelDowngrade}
        isLoading={
          selectFreePlanMutation.isPending || createCheckoutMutation.isPending
        }
      />

      <AlertDialog open={showLimitAlert} onOpenChange={setShowLimitAlert}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-xl">
              {limitAlertType === '100' ? '🎯' : '⚠️'} 
              {limitAlertType === '100' 
                ? 'Limite atteinte !' 
                : limitAlertType === '95'
                ? 'Presque à la limite !' 
                : 'Attention !'}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-base">
              {limitAlertType === '100' ? (
                <>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Vous avez atteint 100 rendez-vous ce mois-ci !
                  </p>
                  <p>
                    Vous ne pouvez plus créer de rendez-vous jusqu'au 1er{' '}
                    {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('fr-FR', { month: 'long' })} 🗓️
                  </p>
                  <p className="font-semibold">
                    Passez au plan Pro pour des rendez-vous illimités ! 🚀
                  </p>
                </>
              ) : limitAlertType === '95' ? (
                <>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Il vous reste seulement 5 rendez-vous ce mois-ci !
                  </p>
                  <p>
                    Pensez à passer au plan Pro pour ne jamais être bloqué 🚀
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Il vous reste seulement 10 rendez-vous ce mois-ci !
                  </p>
                  <p>
                    Vous approchez de la limite du plan gratuit. Pensez au plan Pro ! 🚀
                  </p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowLimitAlert(false)}
              className="w-full sm:w-auto"
            >
              Compris
            </Button>
            {limitAlertType === '100' && (
              <Button
                onClick={() => {
                  setShowLimitAlert(false);
                  handlePlanSelection('pro');
                }}
                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                Passer au Pro
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UpgradeToProConfirmDialog
        open={showUpgradeConfirm}
        onOpenChange={setShowUpgradeConfirm}
        onConfirm={handleConfirmUpgrade}
        totalPrice={totalPrice}
        cardType={paymentMethod?.type}
        cardLast4={paymentMethod?.last4}
        isUpgrading={upgradeToProMutation.isPending}
      />

      <ContactModal
        open={showContactModal}
        onOpenChange={setShowContactModal}
      />
    </DashboardLayout>
  );
}
