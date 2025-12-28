import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle, XCircle, Clock, Calendar as CalendarIcon, MapPin, Mail, Phone, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDateFormat } from "@/hooks/useDateFormat";
import { convertDateFormat, formatDate as formatDateUtil } from "@/lib/dateFormatUtils";
import { apiRequest } from "@/lib/queryClient";
import { formatPrice } from "@/lib/utils";
import LoadingAnimation from "@/components/LoadingAnimation";
import type { WaitlistEntry, Professional, ProfessionalService } from "@shared/schema";

interface WaitlistWithDetails extends WaitlistEntry {
  professional: Professional;
  service: ProfessionalService | null;
}

export default function PriorityBooking() {
  const [, params] = useRoute("/appointments/priority/:token");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { dateFormat, timeFormat } = useDateFormat();
  const token = params?.token;

  const { data: waitlistData, isLoading, error, refetch } = useQuery<WaitlistWithDetails>({
    queryKey: ["/api/waitlist/priority", token],
    enabled: !!token,
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/waitlist/priority/${token}/confirm`, {});
    },
    onSuccess: () => {
      toast({
        title: "Rendez-vous confirmé !",
        description: "Vous allez recevoir un email de confirmation avec tous les détails.",
      });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de la confirmation",
        variant: "destructive",
      });
    },
  });

  const releaseMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/waitlist/priority/${token}/release`, {});
    },
    onSuccess: () => {
      toast({
        title: "Créneau libéré",
        description: "Le créneau a été transmis à la personne suivante dans la liste d'attente.",
      });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de la libération",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <LoadingAnimation />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !waitlistData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <XCircle className="w-8 h-8 text-red-600" />
              <div>
                <CardTitle className="text-red-600">Lien invalide ou expiré</CardTitle>
                <CardDescription>Ce lien de réservation n'est plus valide</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>
                Le lien de réservation prioritaire que vous avez utilisé est invalide ou a expiré (24h après notification).
                Veuillez contacter le professionnel directement pour prendre rendez-vous.
              </AlertDescription>
            </Alert>
            <Button 
              onClick={() => setLocation("/")} 
              className="w-full mt-4"
              data-testid="button-go-home"
            >
              Retour à l'accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if already booked (status fulfilled)
  if (waitlistData.status === "fulfilled") {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
              <h1 className="text-3xl font-bold text-green-600" data-testid="heading-fulfilled">
                Rendez-vous confirmé
              </h1>
            </div>
            <p className="text-gray-600" data-testid="text-fulfilled-description">
              Vous avez déjà utilisé ce lien pour réserver un rendez-vous
            </p>
          </div>

          {/* Professional Info */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle data-testid="heading-professional-info-fulfilled">Professionnel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-500" />
                  <div>
                    <div className="font-semibold" data-testid="text-professional-name-fulfilled">
                      {waitlistData.professional.firstName} {waitlistData.professional.lastName}
                    </div>
                    <div className="text-sm text-gray-600" data-testid="text-professional-profession-fulfilled">
                      {waitlistData.professional.professions && waitlistData.professional.professions.length > 0 
                        ? waitlistData.professional.professions.join(', ') 
                        : 'Profession non spécifiée'}
                    </div>
                  </div>
                </div>
                
                {waitlistData.professional.address && (
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-gray-500" />
                    <span className="text-gray-700" data-testid="text-professional-address-fulfilled">
                      {waitlistData.professional.address}
                    </span>
                  </div>
                )}
                
                {waitlistData.service && (
                  <div className="flex items-center gap-3">
                    <CalendarIcon className="w-5 h-5 text-gray-500" />
                    <div>
                      <div className="font-medium" data-testid="text-service-name-fulfilled">{waitlistData.service.name}</div>
                      <div className="text-sm text-gray-600" data-testid="text-service-details-fulfilled">
                        {waitlistData.service.duration} min · {formatPrice(waitlistData.service.price)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Success Card */}
          <Card>
            <CardContent className="pt-6">
              <Alert className="mb-4 bg-green-50 border-green-200">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Votre rendez-vous a été confirmé. Consultez votre email pour les détails complets.
                </AlertDescription>
              </Alert>
              <Button 
                onClick={() => setLocation("/")} 
                className="w-full"
                data-testid="button-go-home-fulfilled"
              >
                Retour à l'accueil
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Check if expired or cancelled
  if (waitlistData.status === "expired" || waitlistData.status === "cancelled") {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <XCircle className="w-10 h-10 text-orange-600" />
              <h1 className="text-3xl font-bold text-orange-600" data-testid="heading-expired">
                {waitlistData.status === "expired" ? "Lien expiré" : "Demande annulée"}
              </h1>
            </div>
            <p className="text-gray-600" data-testid="text-expired-description">
              {waitlistData.status === "expired" 
                ? "La période de réservation prioritaire est terminée (validité 24h)" 
                : "Cette demande de liste d'attente a été annulée"}
            </p>
          </div>

          {/* Professional Info */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle data-testid="heading-professional-info-expired">Professionnel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-500" />
                  <div>
                    <div className="font-semibold" data-testid="text-professional-name-expired">
                      {waitlistData.professional.firstName} {waitlistData.professional.lastName}
                    </div>
                    <div className="text-sm text-gray-600" data-testid="text-professional-profession-expired">
                      {waitlistData.professional.professions && waitlistData.professional.professions.length > 0 
                        ? waitlistData.professional.professions.join(', ') 
                        : 'Profession non spécifiée'}
                    </div>
                  </div>
                </div>
                
                {waitlistData.professional.address && (
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-gray-500" />
                    <span className="text-gray-700" data-testid="text-professional-address-expired">
                      {waitlistData.professional.address}
                    </span>
                  </div>
                )}
                
                {waitlistData.service && (
                  <div className="flex items-center gap-3">
                    <CalendarIcon className="w-5 h-5 text-gray-500" />
                    <div>
                      <div className="font-medium" data-testid="text-service-name-expired">{waitlistData.service.name}</div>
                      <div className="text-sm text-gray-600" data-testid="text-service-details-expired">
                        {waitlistData.service.duration} min · {formatPrice(waitlistData.service.price)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Action Card */}
          <Card>
            <CardContent className="pt-6">
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>
                  {waitlistData.status === "expired" 
                    ? "Ce lien de réservation prioritaire a expiré. Vous pouvez toujours consulter les disponibilités du professionnel et prendre rendez-vous normalement."
                    : "Cette demande de liste d'attente a été annulée. Vous pouvez toujours consulter les disponibilités du professionnel."}
                </AlertDescription>
              </Alert>
              <Button 
                onClick={() => setLocation(`/professionnel/${waitlistData.professionalId}`)} 
                className="w-full"
                data-testid="button-view-professional-expired"
              >
                Consulter les disponibilités
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Valid waitlist entry - show available slot with confirm/release buttons
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <Badge className="mb-4 bg-green-600" data-testid="badge-priority">
            Réservation prioritaire
          </Badge>
          <h1 className="text-3xl font-bold text-gray-900" data-testid="heading-priority">
            Un créneau s'est libéré !
          </h1>
          <p className="text-gray-600 mt-2" data-testid="text-priority-description">
            Vous avez jusqu'au {waitlistData.expiresAt && format(new Date(waitlistData.expiresAt), `${convertDateFormat(dateFormat)} 'à' HH:mm`, { locale: fr })} pour réserver
          </p>
        </div>

        {/* Available Slot Card */}
        {waitlistData.availableDate && waitlistData.availableStartTime && (
          <Card className="mb-6 border-green-500 border-2">
            <CardHeader className="bg-green-50">
              <CardTitle className="text-green-700" data-testid="heading-available-slot">Créneau disponible</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Service */}
                {waitlistData.service && (
                  <div className="text-center pb-4 border-b border-green-200">
                    <div className="text-xl font-bold text-green-700" data-testid="text-slot-service-name">
                      {waitlistData.service.name}
                    </div>
                    <div className="text-sm text-gray-600 mt-1" data-testid="text-slot-service-details">
                      {waitlistData.service.duration} min · {formatPrice(waitlistData.service.price)}
                    </div>
                  </div>
                )}
                
                {/* Date and Time */}
                <div className="flex items-center justify-center gap-8">
                  <div className="text-center">
                    <CalendarIcon className="w-8 h-8 mx-auto mb-2 text-green-600" />
                    <div className="font-semibold text-lg" data-testid="text-available-date">
                      {format(new Date(waitlistData.availableDate), convertDateFormat(dateFormat), { locale: fr })}
                    </div>
                  </div>
                  <div className="text-center">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-green-600" />
                    <div className="font-semibold text-lg" data-testid="text-available-time">
                      {waitlistData.availableStartTime} - {waitlistData.availableEndTime || waitlistData.availableStartTime}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Professional Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle data-testid="heading-professional-info">Professionnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-500" />
                <div>
                  <div className="font-semibold" data-testid="text-professional-name">
                    {waitlistData.professional.firstName} {waitlistData.professional.lastName}
                  </div>
                  <div className="text-sm text-gray-600" data-testid="text-professional-profession">
                    {waitlistData.professional.professions && waitlistData.professional.professions.length > 0 
                      ? waitlistData.professional.professions.join(', ') 
                      : 'Profession non spécifiée'}
                  </div>
                </div>
              </div>
              
              {waitlistData.professional.address && (
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-gray-500" />
                  <span className="text-gray-700" data-testid="text-professional-address">
                    {waitlistData.professional.address}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Client Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle data-testid="heading-your-info">Vos informations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-500" />
                <span data-testid="text-client-name">
                  {waitlistData.firstName} {waitlistData.lastName}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gray-500" />
                <span data-testid="text-client-email">{waitlistData.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-gray-500" />
                <span data-testid="text-client-phone">{waitlistData.phone}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Card */}
        <Card>
          <CardHeader>
            <CardTitle data-testid="heading-decision">Votre décision</CardTitle>
            <CardDescription>
              Souhaitez-vous prendre ce créneau ou le libérer pour la personne suivante ?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending || releaseMutation.isPending}
              className="w-full bg-green-600 hover:bg-green-700"
              size="lg"
              data-testid="button-confirm-slot"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              {confirmMutation.isPending ? "Confirmation en cours..." : "Je le prends"}
            </Button>
            <Button
              onClick={() => releaseMutation.mutate()}
              disabled={confirmMutation.isPending || releaseMutation.isPending}
              variant="outline"
              className="w-full"
              size="lg"
              data-testid="button-release-slot"
            >
              <XCircle className="w-5 h-5 mr-2" />
              {releaseMutation.isPending ? "Libération en cours..." : "Je le libère"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
