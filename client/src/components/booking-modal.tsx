import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format, addDays, addWeeks, startOfDay, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { User, Phone, Mail, ChevronLeft, ChevronRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Professional, TimeSlot, ProfessionalService } from "@shared/schema";
import { formatTime } from "@/lib/timeUtils";
import { formatPrice } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import WaitlistModal from "./waitlist-modal";
import { useDateFormat } from "@/hooks/useDateFormat";
import { convertDateFormat, formatDate as formatDateUtil } from "@/lib/dateFormatUtils";

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professional: Professional;
  initialSlot?: TimeSlot | null;
  initialServiceId?: string;
}

const bookingFormSchema = z.object({
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  phone: z.string().min(10, "Numéro de téléphone invalide"),
  notes: z.string().optional(),
  professionalServiceId: z.string().optional(),
  bookingFor: z.enum(["self", "other"]).default("self"),
  beneficiaryName: z.string().optional(),
  beneficiaryRelation: z.string().optional(),
  beneficiaryPhone: z.string().optional(),
  beneficiaryEmail: z.string().email("Email invalide").optional().or(z.literal("")),
});

type BookingFormData = z.infer<typeof bookingFormSchema>;

export default function BookingModal({ open, onOpenChange, professional, initialSlot, initialServiceId }: BookingModalProps) {
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(initialSlot || null);
  const [step, setStep] = useState<"week" | "info" | "preview">(initialSlot ? "info" : "week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [formData, setFormData] = useState<BookingFormData | null>(null);
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false);
  const { toast } = useToast();
  const { dateFormat, timeFormat } = useDateFormat();

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      notes: "",
      professionalServiceId: initialServiceId || "",
      bookingFor: "self",
      beneficiaryName: "",
      beneficiaryRelation: "",
      beneficiaryPhone: "",
      beneficiaryEmail: "",
    },
  });

  // Watch the selected service ID to trigger slot recalculation
  const selectedServiceId = form.watch("professionalServiceId");
  const bookingFor = form.watch("bookingFor");

  // Fetch professional services (public endpoint - only visible services)
  const { data: services = [] } = useQuery<ProfessionalService[]>({
    queryKey: [`/api/professionals/${professional.id}/services/public`],
    enabled: open,
  });

  // Update state when initialSlot or initialServiceId changes or modal opens
  useEffect(() => {
    if (open) {
      if (initialSlot) {
        setSelectedSlot(initialSlot);
        setStep("info");
      } else {
        setSelectedSlot(null);
        setStep("week");
        setWeekOffset(0);
      }
      // Update service selection if provided
      if (initialServiceId) {
        form.setValue("professionalServiceId", initialServiceId);
      }
    }
  }, [initialSlot, initialServiceId, open, form]);

  // Calculate the week start (Monday) based on offset
  const today = startOfDay(new Date());
  const currentWeekMonday = startOfWeek(today, { weekStartsOn: 1 }); // 1 = Monday
  const weekStart = addWeeks(currentWeekMonday, weekOffset);
  const weekEnd = addDays(weekStart, 6); // Include Sunday for API call

  // Récupérer les créneaux disponibles pour la semaine
  const { data: timeSlots = [], isLoading: slotsLoading } = useQuery<TimeSlot[]>({
    queryKey: [`/api/professionals/${professional.id}/timeslots`, weekStart, weekEnd, selectedServiceId],
    queryFn: async () => {
      const params = new URLSearchParams({
        fromDate: weekStart.toISOString(),
        toDate: weekEnd.toISOString(),
      });
      
      if (selectedServiceId) {
        params.append('professionalServiceId', selectedServiceId);
      }
      
      const response = await fetch(
        `/api/professionals/${professional.id}/timeslots?${params.toString()}`
      );
      if (!response.ok) return [];
      return response.json() as Promise<TimeSlot[]>;
    },
    enabled: step === "week",
  });

  // Group slots by date and filter out past days (only for current week)
  const slotsByDate: Record<string, TimeSlot[]> = {};
  timeSlots.forEach(slot => {
    const slotDate = new Date(slot.slotDate);
    const dateKey = format(slotDate, 'yyyy-MM-dd');
    
    // For current week (weekOffset === 0), only show slots from today onwards
    // For future weeks, show all slots
    const shouldIncludeSlot = weekOffset > 0 || slotDate >= startOfDay(today);
    
    if (shouldIncludeSlot) {
      if (!slotsByDate[dateKey]) {
        slotsByDate[dateKey] = [];
      }
      slotsByDate[dateKey].push(slot);
    }
  });

  // Generate weekdays (Mon-Fri) and conditionally add Saturday/Sunday if slots exist
  const saturdayDate = addDays(weekStart, 5);
  const sundayDate = addDays(weekStart, 6);
  const saturdayKey = format(saturdayDate, 'yyyy-MM-dd');
  const sundayKey = format(sundayDate, 'yyyy-MM-dd');
  const hasSaturdaySlots = slotsByDate[saturdayKey]?.length > 0;
  const hasSundaySlots = slotsByDate[sundayKey]?.length > 0;
  
  const displayDays: Date[] = [];
  for (let i = 0; i < 5; i++) {
    displayDays.push(addDays(weekStart, i)); // Mon-Fri
  }
  if (hasSaturdaySlots) {
    displayDays.push(saturdayDate);
  }
  if (hasSundaySlots) {
    displayDays.push(sundayDate);
  }

  // Check if at least one day is today or in the future
  const hasAnyFutureOrCurrentDate = displayDays.some(day => day >= startOfDay(today));

  // Count total visible slots after filtering
  const visibleSlotsCount = Object.values(slotsByDate).reduce((total, slots) => total + slots.length, 0);

  // Get week title based on offset
  const getWeekTitle = () => {
    if (weekOffset === 0) return "Cette semaine";
    if (weekOffset === 1) return "La semaine prochaine";
    return "Dans plus d'une semaine";
  };

  // Mutation pour créer un rendez-vous
  const bookingMutation = useMutation({
    mutationFn: async (data: BookingFormData & { professionalId: string; appointmentDate: string; startTime: string; endTime: string }) => {
      return await apiRequest("POST", "/api/appointments", data);
    },
    onSuccess: () => {
      toast({
        title: "Rendez-vous confirmé !",
        description: "Votre rendez-vous a été réservé avec succès. Vous recevrez un email de confirmation.",
        duration: 5000,
      });
      
      // Invalidate all relevant queries to refresh availability everywhere
      queryClient.invalidateQueries({ queryKey: ['/api/professional/appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/professional/patients'] });
      
      // Invalidate timeslots queries for all professionals to refresh availability
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0]?.toString() || '';
          return key.startsWith('/api/professionals/') && key.includes('/timeslots');
        }
      });
      
      onOpenChange(false);
      resetModal();
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Une erreur est survenue lors de la réservation. Veuillez réessayer.";
      
      // Check if it's a conflict error (409)
      const isConflict = errorMessage.includes("déjà réservé") || errorMessage.includes("already booked") || errorMessage.includes("n'est plus disponible");
      
      toast({
        title: isConflict ? "Créneau indisponible" : "Erreur",
        description: isConflict 
          ? "Ce créneau horaire n'est plus disponible. Veuillez en choisir un autre."
          : errorMessage,
        variant: "destructive",
      });
    },
  });

  const resetModal = () => {
    setStep("week");
    setWeekOffset(0);
    setSelectedSlot(null);
    form.reset();
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    setStep("info");
  };

  const handleSubmit = async (data: BookingFormData) => {
    if (!selectedSlot) return;
    setFormData(data);
    setStep("preview");
  };

  const handleFinalConfirm = async () => {
    if (!selectedSlot || !formData) return;
    
    // Format the date to YYYY-MM-DD
    const slotDate = new Date(selectedSlot.slotDate);
    const appointmentDate = format(slotDate, 'yyyy-MM-dd');
    
    await bookingMutation.mutateAsync({
      ...formData,
      professionalId: professional.id,
      appointmentDate,
      startTime: selectedSlot.startTime,
      endTime: selectedSlot.endTime,
    });
  };

  const handleBack = () => {
    if (step === "preview") {
      setStep("info");
    } else if (step === "info" && !initialSlot) {
      setStep("week");
      setSelectedSlot(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) resetModal();
    }}>
      <DialogContent className="max-w-[95vw] sm:max-w-[90vw] md:max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Réserver un rendez-vous avec {professional.firstName} {professional.lastName}
          </DialogTitle>
          <div className="flex flex-wrap gap-1 mt-1">
            {professional.professions && professional.professions.length > 0 ? (
              professional.professions.map((profession, index) => (
                <span key={index} className="text-sm text-gray-500">
                  {profession}{index < professional.professions.length - 1 ? ', ' : ''}
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-500">Profession non spécifiée</span>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Étape 1: Vue hebdomadaire avec créneaux */}
          {step === "week" && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Sélectionnez l'heure</h3>
              
              {/* Week navigation */}
              <div className="flex items-center justify-center gap-4 mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
                  disabled={weekOffset === 0}
                  data-testid="button-prev-week"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <span className="text-sm font-medium text-gray-700 min-w-[180px] text-center">
                  {getWeekTitle()}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setWeekOffset(weekOffset + 1)}
                  data-testid="button-next-week"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>

              {slotsLoading ? (
                <div className="flex justify-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <>
                  {/* Days and slots */}
                  <div className={`grid gap-2 sm:gap-4 grid-cols-2 sm:grid-cols-3 ${
                    displayDays.length === 7 ? 'md:grid-cols-7' :
                    displayDays.length === 6 ? 'md:grid-cols-6' :
                    'md:grid-cols-5'
                  }`}>
                    {displayDays.map((day, index) => {
                      const dateKey = format(day, 'yyyy-MM-dd');
                      const daySlots = slotsByDate[dateKey] || [];
                      
                      return (
                        <div key={index} className="text-center border rounded-lg p-2 sm:p-3">
                          <div className="font-medium text-sm text-gray-700 capitalize mb-1">
                            {format(day, 'EEE', { locale: fr })}
                          </div>
                          <div className="text-lg font-bold text-gray-900 mb-1">
                            {format(day, 'd', { locale: fr })}
                          </div>
                          <div className="text-xs text-gray-500 mb-3 capitalize">
                            {format(day, 'MMM', { locale: fr })}
                          </div>
                          <div className="space-y-2">
                            {daySlots.length > 0 ? (
                              daySlots.map((slot) => (
                                <button
                                  key={slot.id}
                                  className="w-full px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                                  onClick={() => handleSlotSelect(slot)}
                                  data-testid={`button-slot-${slot.id}`}
                                >
                                  {formatTime(slot.startTime)}
                                </button>
                              ))
                            ) : (
                              <div className="text-xs text-gray-400 py-2">
                                Aucun
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {visibleSlotsCount === 0 && hasAnyFutureOrCurrentDate && (
                    <div className="text-center py-6 space-y-4" data-testid="section-no-slots">
                      <p className="text-sm text-gray-500" data-testid="text-no-slots">
                        Aucune disponibilité pour cette semaine.
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => setWaitlistModalOpen(true)}
                        data-testid="button-join-waitlist"
                      >
                        Rejoindre la liste d'attente
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Étape 2: Informations du patient */}
          {step === "info" && selectedSlot && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h3 className="font-semibold text-lg">Vos informations</h3>
                {!initialSlot && (
                  <Button variant="ghost" onClick={handleBack} data-testid="button-back-to-slots">
                    ← Retour
                  </Button>
                )}
              </div>

              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Rendez-vous :</strong> {format(new Date(selectedSlot.slotDate), convertDateFormat(dateFormat), { locale: fr })} à {formatTime(selectedSlot.startTime)}
                </p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prénom</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                              <Input {...field} className="pl-10" placeholder="Jean" data-testid="input-firstname" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                              <Input {...field} className="pl-10" placeholder="Dupont" data-testid="input-lastname" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="bookingFor"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Ce rendez-vous est pour :</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col sm:flex-row gap-3 sm:gap-4"
                            data-testid="radio-booking-for"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="self" id="self" data-testid="radio-for-self" />
                              <Label htmlFor="self" className="font-normal cursor-pointer">Pour moi-même</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="other" id="other" data-testid="radio-for-other" />
                              <Label htmlFor="other" className="font-normal cursor-pointer">Pour quelqu'un d'autre</Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {bookingFor === "other" && (
                    <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="font-medium text-sm text-blue-900">Informations du bénéficiaire</h4>
                      
                      <FormField
                        control={form.control}
                        name="beneficiaryName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nom complet</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Louis Vachon" data-testid="input-beneficiary-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="beneficiaryRelation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Relation</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-beneficiary-relation">
                                  <SelectValue placeholder="Choisir une relation" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="enfant">Enfant</SelectItem>
                                <SelectItem value="parent">Parent</SelectItem>
                                <SelectItem value="conjoint">Conjoint(e)</SelectItem>
                                <SelectItem value="ami">Ami(e)</SelectItem>
                                <SelectItem value="autre">Autre</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="beneficiaryPhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Téléphone (optionnel)</FormLabel>
                              <FormControl>
                                <Input {...field} type="tel" placeholder="+1 514-123-4567" data-testid="input-beneficiary-phone" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="beneficiaryEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email (optionnel)</FormLabel>
                              <FormControl>
                                <Input {...field} type="email" placeholder="email@example.ca" data-testid="input-beneficiary-email" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input {...field} type="email" className="pl-10" placeholder="jean.dupont@example.ca" data-testid="input-email" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Téléphone</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input {...field} type="tel" className="pl-10" placeholder="+1 514-123-4567" data-testid="input-phone" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {services.length > 0 && (
                    <FormField
                      control={form.control}
                      name="professionalServiceId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Service (optionnel)</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value}
                            disabled={!!initialServiceId}
                          >
                            <FormControl>
                              <SelectTrigger 
                                data-testid="select-service"
                                className={initialServiceId ? "bg-gray-100 cursor-not-allowed" : ""}
                              >
                                <SelectValue placeholder="Sélectionnez un service" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {services.map((service) => (
                                <SelectItem key={service.id} value={service.id} data-testid={`option-service-${service.id}`}>
                                  {service.name} - {service.duration} min - {formatPrice(service.price)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {initialServiceId && (
                            <p className="text-xs text-gray-500 mt-1">
                              Le service a été sélectionné avec le créneau. Retournez à la sélection pour changer.
                            </p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (optionnel)</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Raison de la consultation..." rows={3} data-testid="input-notes" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                      Annuler
                    </Button>
                    <Button type="submit" data-testid="button-next-to-preview">
                      Continuer
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}

          {/* Étape 3: Aperçu et confirmation finale */}
          {step === "preview" && selectedSlot && formData && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h3 className="font-semibold text-lg">Confirmer votre rendez-vous</h3>
                <Button variant="ghost" onClick={handleBack} data-testid="button-back-to-info">
                  ← Retour
                </Button>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-4">Récapitulatif de votre rendez-vous</h4>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-start">
                    <span className="text-blue-700 font-medium">Professionnel :</span>
                    <span className="text-blue-900 font-semibold text-right" data-testid="text-preview-professional">
                      {professional.firstName} {professional.lastName}
                      <div className="text-xs text-blue-600" data-testid="text-preview-profession">
                        {professional.professions && professional.professions.length > 0 
                          ? professional.professions.join(', ') 
                          : 'Profession non spécifiée'}
                      </div>
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-blue-700 font-medium">Date :</span>
                    <span className="text-blue-900 font-semibold" data-testid="text-preview-date">
                      {format(new Date(selectedSlot.slotDate), convertDateFormat(dateFormat), { locale: fr })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-blue-700 font-medium">Heure :</span>
                    <span className="text-blue-900 font-semibold" data-testid="text-preview-time">
                      {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}
                    </span>
                  </div>

                  {formData.professionalServiceId && (
                    <div className="flex justify-between items-start">
                      <span className="text-blue-700 font-medium">Service :</span>
                      <span className="text-blue-900 font-semibold text-right" data-testid="text-preview-service">
                        {services.find(s => s.id === formData.professionalServiceId)?.name || "N/A"}
                      </span>
                    </div>
                  )}

                  <div className="border-t border-blue-300 my-3"></div>

                  {formData.bookingFor === "other" && formData.beneficiaryName && (
                    <>
                      <div className="flex justify-between items-start">
                        <span className="text-blue-700 font-medium">Bénéficiaire :</span>
                        <span className="text-blue-900 font-semibold text-right" data-testid="text-preview-beneficiary">
                          {formData.beneficiaryName}
                          {formData.beneficiaryRelation && (
                            <div className="text-xs text-blue-600" data-testid="text-preview-beneficiary-relation">
                              ({formData.beneficiaryRelation})
                            </div>
                          )}
                        </span>
                      </div>
                      <div className="border-t border-blue-300 my-3"></div>
                      <div className="text-xs text-blue-600 mb-2">Informations du réservant :</div>
                    </>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-blue-700 font-medium">Nom :</span>
                    <span className="text-blue-900 font-semibold" data-testid="text-preview-name">
                      {formData.firstName} {formData.lastName}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-blue-700 font-medium">Email :</span>
                    <span className="text-blue-900 font-semibold" data-testid="text-preview-email">{formData.email}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-blue-700 font-medium">Téléphone :</span>
                    <span className="text-blue-900 font-semibold" data-testid="text-preview-phone">{formData.phone}</span>
                  </div>

                  {formData.notes && (
                    <div className="flex justify-between items-start">
                      <span className="text-blue-700 font-medium">Notes :</span>
                      <span className="text-blue-900 text-right max-w-xs" data-testid="text-preview-notes">{formData.notes}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-800">
                  <strong>📧 Confirmation par email</strong><br />
                  Un email de confirmation sera envoyé à <strong data-testid="text-preview-confirmation-email">{formData.email}</strong> après validation de votre rendez-vous.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => onOpenChange(false)} 
                  data-testid="button-cancel-preview"
                >
                  Annuler
                </Button>
                <Button 
                  onClick={handleFinalConfirm} 
                  disabled={bookingMutation.isPending} 
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="button-final-confirm"
                >
                  {bookingMutation.isPending ? "Confirmation en cours..." : "✓ Confirmer le rendez-vous"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Waitlist Modal */}
      <WaitlistModal
        open={waitlistModalOpen}
        onOpenChange={setWaitlistModalOpen}
        professional={professional}
        selectedDate={weekStart}
        selectedServiceId={selectedServiceId}
      />
    </Dialog>
  );
}
