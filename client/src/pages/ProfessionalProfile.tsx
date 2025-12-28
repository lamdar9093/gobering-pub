import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapPin, Phone, Mail, ArrowLeft, Calendar, User, DollarSign, Timer } from "lucide-react";
import { useRoute, Link } from "wouter";
import type { Professional, ProfessionalSchedule, ProfessionalService } from "@shared/schema";
import BookingModal from "@/components/booking-modal";
import WaitlistModal from "@/components/waitlist-modal";
import { formatPrice } from "@/lib/utils";

export default function ProfessionalProfile() {
  const [match, params] = useRoute("/professionnel/:id");
  const professionalId = params?.id;
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false);
  
  // Get search params to build proper back link
  const searchParams = new URLSearchParams(window.location.search);
  const hasSearchParams = searchParams.has('profession') || searchParams.has('city') || searchParams.has('province');
  const backLink = hasSearchParams ? `/recherche?${searchParams.toString()}` : '/';

  const { data: professional, isLoading, error } = useQuery({
    queryKey: ['/api/professionals', professionalId],
    queryFn: async () => {
      const response = await fetch(`/api/professionals/${professionalId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch professional');
      }
      return response.json() as Promise<Professional>;
    },
    enabled: !!professionalId
  });

  // Get professional schedules (weekly recurring hours)
  const { data: schedules = [] } = useQuery({
    queryKey: ['/api/professionals', professionalId, 'schedules'],
    queryFn: async () => {
      const response = await fetch(`/api/professionals/${professionalId}/schedules`);
      if (!response.ok) {
        return [];
      }
      return response.json() as Promise<ProfessionalSchedule[]>;
    },
    enabled: !!professionalId
  });

  // Get professional services (public only)
  const { data: services = [] } = useQuery<ProfessionalService[]>({
    queryKey: [`/api/professionals/${professionalId}/services/public`],
    enabled: !!professionalId,
  });

  const handleBookingClick = () => {
    setBookingModalOpen(true);
  };

  const handleWaitlistClick = () => {
    setWaitlistModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Chargement du profil...</h1>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !professional) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-red-600 mb-4">Professionnel introuvable</h1>
            <p className="text-gray-600 mb-4">Le professionnel que vous recherchez n'existe pas ou n'est plus disponible.</p>
            <Link to="/">
              <Button>Retour à l'accueil</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Back button */}
        <div className="mb-6">
          <Link to={backLink}>
            <Button variant="ghost" className="mb-4" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {hasSearchParams ? 'Retour aux résultats' : "Retour à l'accueil"}
            </Button>
          </Link>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Profile Card */}
          <div className="lg:col-span-2">
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    {professional.profilePicture ? (
                      <img 
                        src={professional.profilePicture} 
                        alt={`${professional.firstName} ${professional.lastName}`}
                        className="h-24 w-24 rounded-full object-cover border-4 border-border"
                      />
                    ) : (
                      <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center border-4 border-border">
                        <User className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-3xl text-gray-800 mb-2" data-testid="professional-name">
                      Dr. {professional.firstName} {professional.lastName}
                    </CardTitle>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {professional.professions && professional.professions.length > 0 ? (
                        professional.professions.map((profession, index) => (
                          <Badge key={index} variant="default" className="text-lg px-3 py-1">
                            {profession}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="default" className="text-lg px-3 py-1">
                          Profession non spécifiée
                        </Badge>
                      )}
                    </div>
                    {professional.speciality && (
                      <p className="text-lg text-gray-600 font-medium" data-testid="professional-speciality">
                        {professional.speciality}
                      </p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {professional.description && (
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold text-gray-800 mb-3">À propos</h3>
                    <p className="text-gray-600 leading-relaxed" data-testid="professional-description">
                      {professional.description}
                    </p>
                  </div>
                )}

                <Separator className="my-6" />

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-3">Informations pratiques</h4>
                    <div className="space-y-3">
                      <div className="flex items-start text-gray-600">
                        <MapPin className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">Adresse</p>
                          <p data-testid="professional-address">
                            {professional.address}<br />
                            {professional.city} {professional.postalCode}
                          </p>
                        </div>
                      </div>
                      
                      {professional.phone && (
                        <div className="flex items-center text-gray-600">
                          <Phone className="h-5 w-5 mr-3 flex-shrink-0" />
                          <div>
                            <p className="font-medium">Téléphone</p>
                            <p data-testid="professional-phone">{professional.phone}</p>
                          </div>
                        </div>
                      )}
                      
                      {professional.email && (
                        <div className="flex items-center text-gray-600">
                          <Mail className="h-5 w-5 mr-3 flex-shrink-0" />
                          <div>
                            <p className="font-medium">Email</p>
                            <p data-testid="professional-email">{professional.email}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-3">Horaires</h4>
                    {schedules.length > 0 ? (
                      <div className="space-y-2 text-gray-600">
                        {[
                          { day: 1, label: "Lundi" },
                          { day: 2, label: "Mardi" },
                          { day: 3, label: "Mercredi" },
                          { day: 4, label: "Jeudi" },
                          { day: 5, label: "Vendredi" },
                          { day: 6, label: "Samedi" },
                          { day: 0, label: "Dimanche" }
                        ].map(({ day, label }) => {
                          const daySchedules = schedules.filter(s => s.dayOfWeek === day && s.isAvailable);
                          
                          const formatTime = (time: string) => {
                            return time.substring(0, 5);
                          };
                          
                          return (
                            <div key={day} className="flex justify-between" data-testid={`schedule-day-${day}`}>
                              <span>{label}</span>
                              {daySchedules.length > 0 ? (
                                <span>
                                  {daySchedules.map(s => `${formatTime(s.startTime)} - ${formatTime(s.endTime)}`).join(", ")}
                                </span>
                              ) : (
                                <span className="text-red-500">Fermé</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-600 text-sm">Horaires non renseignés</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Appointment Booking Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-8">
              <CardHeader>
                <CardTitle className="text-xl text-center">Prendre rendez-vous</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Services Section */}
                  {services.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-gray-800 mb-3">Services offerts</h4>
                      <div className="space-y-3">
                        {services.map((service) => (
                          <div
                            key={service.id}
                            className="p-3 border border-gray-200 rounded-lg"
                            data-testid={`service-${service.id}`}
                          >
                            <h5 className="font-medium text-gray-800 mb-1">{service.name}</h5>
                            {service.description && (
                              <p className="text-xs text-gray-600 mb-2">{service.description}</p>
                            )}
                            <div className="flex items-center gap-3 text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <Timer className="h-3 w-3" />
                                <span>{service.duration} min</span>
                              </div>
                              {service.price && (
                                <div className="flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  <span className="font-medium">{formatPrice(service.price)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator />
                  
                  <Button 
                    className="w-full" 
                    size="lg"
                    data-testid="button-book-appointment"
                    onClick={handleBookingClick}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Réserver en ligne
                  </Button>
                  
                  {professional.phone && (
                    <div className="text-center">
                      <p className="text-sm text-gray-500 mb-2">ou</p>
                      <Button 
                        variant="outline" 
                        className="w-full"
                        data-testid="button-call-appointment"
                        asChild
                      >
                        <a href={`tel:${professional.phone}`}>
                          <Phone className="h-4 w-4 mr-2" />
                          Appeler le cabinet
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <BookingModal 
        open={bookingModalOpen} 
        onOpenChange={setBookingModalOpen} 
        professional={professional}
      />

      <WaitlistModal
        open={waitlistModalOpen}
        onOpenChange={setWaitlistModalOpen}
        professional={professional}
      />
    </div>
  );
}
