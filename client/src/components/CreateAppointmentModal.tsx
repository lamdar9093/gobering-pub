import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Professional, ClinicMember, ProfessionalService } from "@shared/schema";
import { User, Mail, Phone } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useDateFormat } from "@/hooks/useDateFormat";
import { convertDateFormat, formatDate as formatDateUtil } from "@/lib/dateFormatUtils";

const createAppointmentSchema = z.object({
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide").or(z.literal("")).optional(),
  phone: z.string().min(10, "Numéro de téléphone invalide").or(z.literal("")).optional(),
  appointmentDate: z.string(),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format d'heure invalide (HH:MM)"),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format d'heure invalide (HH:MM)"),
  serviceId: z.string().optional(),
  notes: z.string().optional(),
  professionalId: z.string().optional(),
}).refine((data) => {
  const start = data.startTime.split(':').map(Number);
  const end = data.endTime.split(':').map(Number);
  return (start[0] * 60 + start[1]) < (end[0] * 60 + end[1]);
}, {
  message: "L'heure de fin doit être après l'heure de début",
  path: ["endTime"],
});

type CreateAppointmentFormData = z.infer<typeof createAppointmentSchema>;

interface CreateAppointmentModalProps {
  open: boolean;
  onClose: () => void;
  selectedDate?: Date;
  selectedStartTime?: string;
}

interface ClinicMemberWithDetails extends ClinicMember {
  professional?: Professional;
}

export default function CreateAppointmentModal({ open, onClose, selectedDate, selectedStartTime }: CreateAppointmentModalProps) {
  const { toast } = useToast();
  const { dateFormat, timeFormat } = useDateFormat();

  // Get current professional
  const { data: currentProfessional } = useQuery<Professional>({
    queryKey: ["/api/auth/me"],
  });

  // Get clinic members if professional is in a clinic
  const { data: clinicMembers = [] } = useQuery<ClinicMemberWithDetails[]>({
    queryKey: [`/api/clinics/${currentProfessional?.clinicId}/members`],
    enabled: !!currentProfessional?.clinicId,
  });

  // Filter only professionals and admins who can have appointments assigned to them
  const availableProfessionals = clinicMembers.filter(member => 
    member.role === 'Professionnel' || member.role === 'Admin'
  );

  // Determine default professional ID
  const getDefaultProfessionalId = () => {
    if (!currentProfessional?.clinicId || availableProfessionals.length === 0) {
      return currentProfessional?.id || "";
    }
    
    const currentUserIsProfessional = availableProfessionals.some(
      t => t.professionalId === currentProfessional?.id
    );
    
    if (currentUserIsProfessional) {
      return currentProfessional.id;
    }
    
    return availableProfessionals[0]?.professionalId || "";
  };

  const form = useForm<CreateAppointmentFormData>({
    resolver: zodResolver(createAppointmentSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      appointmentDate: selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      startTime: selectedStartTime || "09:00",
      endTime: "10:00",
      serviceId: "",
      notes: "",
      professionalId: getDefaultProfessionalId(),
    },
  });

  // Watch the selected professional ID to load their services
  const watchProfessionalId = form.watch("professionalId");
  const watchStartTime = form.watch("startTime");
  const watchServiceId = form.watch("serviceId");

  // Track previous professional to detect changes
  const prevProfessionalIdRef = useRef<string | undefined>(watchProfessionalId);

  // Get services for the selected professional
  const { data: services = [] } = useQuery<ProfessionalService[]>({
    queryKey: [`/api/professionals/${watchProfessionalId}/services/public`],
    enabled: !!watchProfessionalId,
  });

  // Calculate end time based on start time and default service duration
  const calculateEndTime = (startTime: string, serviceId?: string): string => {
    if (!startTime) return "10:00";
    
    const service = services.find((s: ProfessionalService) => s.id === serviceId);
    const duration = service?.duration || 60;
    
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + duration;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (watchStartTime) {
      const newEndTime = calculateEndTime(watchStartTime, watchServiceId);
      form.setValue("endTime", newEndTime);
    }
  }, [watchStartTime, watchServiceId, form]);

  // Reset service IMMEDIATELY when professional changes
  useEffect(() => {
    if (prevProfessionalIdRef.current !== watchProfessionalId) {
      form.setValue("serviceId", "");
      prevProfessionalIdRef.current = watchProfessionalId;
    }
  }, [watchProfessionalId, form]);

  // Reset form completely when modal opens
  useEffect(() => {
    if (open) {
      form.reset({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        appointmentDate: selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
        startTime: selectedStartTime || "09:00",
        endTime: "10:00",
        serviceId: "",
        notes: "",
        professionalId: getDefaultProfessionalId(),
      });
      prevProfessionalIdRef.current = getDefaultProfessionalId();
    }
  }, [open, selectedDate, selectedStartTime]);

  // Update professionalId when clinic members are loaded
  useEffect(() => {
    if (currentProfessional?.clinicId && availableProfessionals.length > 0) {
      const currentUserIsTherapist = availableProfessionals.some(
        t => t.professionalId === currentProfessional?.id
      );
      
      const defaultId = currentUserIsTherapist 
        ? currentProfessional.id 
        : availableProfessionals[0]?.professionalId || "";
      
      form.setValue('professionalId', defaultId);
    }
  }, [currentProfessional, availableProfessionals, form]);

  const createMutation = useMutation({
    mutationFn: async (data: CreateAppointmentFormData) => {
      return await apiRequest("POST", "/api/professional/appointments/create-manual", {
        ...data,
        status: "confirmed",
      });
    },
    onSuccess: (_, variables) => {
      const hasEmail = variables.email && variables.email.trim() !== '';
      const hasPhone = variables.phone && variables.phone.trim() !== '';
      
      let description = "Le rendez-vous a été créé avec succès.";
      if (hasEmail && hasPhone) {
        description = "Le rendez-vous a été créé avec succès. Le client a reçu une confirmation par email et SMS.";
      } else if (hasEmail) {
        description = "Le rendez-vous a été créé avec succès. Le client a reçu une confirmation par email.";
      } else if (hasPhone) {
        description = "Le rendez-vous a été créé avec succès. Le client a reçu une confirmation par SMS.";
      }
      
      toast({
        title: "Rendez-vous créé",
        description,
      });
      
      // Invalidate all relevant queries to refresh availability everywhere
      queryClient.invalidateQueries({ queryKey: ["/api/professional/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/professional/patients"] });
      
      // Invalidate timeslots queries for all professionals to refresh availability
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0]?.toString() || '';
          return key.startsWith('/api/professionals/') && key.includes('/timeslots');
        }
      });
      
      form.reset();
      onClose();
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Une erreur est survenue lors de la création du rendez-vous";
      
      // Check if it's a conflict error (409)
      const isConflict = errorMessage.includes("déjà réservé") || errorMessage.includes("already booked");
      
      toast({
        title: isConflict ? "Créneau indisponible" : "Erreur",
        description: isConflict 
          ? "Ce créneau horaire est déjà réservé. Veuillez en choisir un autre."
          : errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateAppointmentFormData) => {
    createMutation.mutate(data);
  };

  const selectedProfessional = availableProfessionals.find(
    m => m.professionalId === form.watch("professionalId")
  )?.professional || currentProfessional;

  const formattedDateTime = selectedDate && watchStartTime 
    ? `${format(selectedDate, convertDateFormat(dateFormat), { locale: fr })} à ${watchStartTime}`
    : "";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Réserver un rendez-vous avec {selectedProfessional?.firstName} {selectedProfessional?.lastName}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {selectedProfessional?.professions && selectedProfessional.professions.length > 0 
              ? selectedProfessional.professions.join(', ') 
              : 'Profession non spécifiée'}
          </p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {currentProfessional?.clinicId && availableProfessionals.length > 0 && (
              <FormField
                control={form.control}
                name="professionalId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Professionnel</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-professional">
                          <SelectValue placeholder="Sélectionnez un professionnel" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableProfessionals.map((member) => (
                          <SelectItem key={member.professionalId} value={member.professionalId}>
                            {member.professional?.firstName} {member.professional?.lastName}
                            {member.professionalId === currentProfessional?.id && " (Vous)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div>
              <h3 className="text-lg font-semibold mb-4">Vos informations</h3>

              {formattedDateTime && (
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground">Rendez-vous :</p>
                  <p className="text-blue-600 font-medium">{formattedDateTime}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prénom</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="Jean" {...field} className="pl-10" data-testid="input-firstName" />
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
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="Dupont" {...field} className="pl-10" data-testid="input-lastName" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>Email (optionnel)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="email" placeholder="jean.dupont@exemple.ca" {...field} className="pl-10" data-testid="input-email" />
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
                  <FormItem className="mb-4">
                    <FormLabel>Téléphone (optionnel)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="+1 514-123-4567" {...field} className="pl-10" data-testid="input-phone" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="serviceId"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>Service (optionnel)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-service">
                          <SelectValue placeholder="Sélectionnez un service" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {services.map((service) => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.name} - {service.duration} min - {formatPrice(service.price)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optionnel)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Raison de la consultation..."
                        rows={3}
                        {...field}
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                data-testid="button-cancel"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-submit"
              >
                {createMutation.isPending ? "Création..." : "Confirmer le rendez-vous"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
