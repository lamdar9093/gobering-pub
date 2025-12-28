import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { User, Phone, Mail, Calendar, Clock } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Professional, ProfessionalService } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";

interface WaitlistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professional: Professional;
  selectedDate?: Date;
  selectedServiceId?: string;
}

const waitlistFormSchema = z.object({
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().min(10, "Numéro de téléphone invalide"),
  preferredDate: z.string().min(1, "Date souhaitée requise"),
  preferredTimeStart: z.string().optional(),
  preferredTimeEnd: z.string().optional(),
  professionalServiceId: z.string().optional(),
  notes: z.string().optional(),
});

type WaitlistFormData = z.infer<typeof waitlistFormSchema>;

export default function WaitlistModal({ 
  open, 
  onOpenChange, 
  professional, 
  selectedDate,
  selectedServiceId 
}: WaitlistModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<WaitlistFormData>({
    resolver: zodResolver(waitlistFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      preferredDate: selectedDate && selectedDate >= new Date() 
        ? format(selectedDate, 'yyyy-MM-dd') 
        : format(new Date(), 'yyyy-MM-dd'),
      preferredTimeStart: "none",
      preferredTimeEnd: "none",
      professionalServiceId: selectedServiceId || "none",
      notes: "",
    },
  });

  // Fetch professional services (public endpoint - only visible services)
  const { data: services = [] } = useQuery<ProfessionalService[]>({
    queryKey: [`/api/professionals/${professional.id}/services/public`],
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: async (data: WaitlistFormData) => {
      // Parse the date string and create a date at noon UTC to avoid timezone offset issues
      const dateStr = data.preferredDate; // yyyy-MM-dd format
      const dateAtNoonUTC = new Date(`${dateStr}T12:00:00Z`);
      
      return await apiRequest("POST", "/api/waitlist", {
        ...data,
        professionalId: professional.id,
        preferredDate: dateAtNoonUTC,
        professionalServiceId: (data.professionalServiceId && data.professionalServiceId !== "none") ? data.professionalServiceId : null,
        preferredTimeStart: (data.preferredTimeStart && data.preferredTimeStart !== "none") ? data.preferredTimeStart : null,
        preferredTimeEnd: (data.preferredTimeEnd && data.preferredTimeEnd !== "none") ? data.preferredTimeEnd : null,
      });
    },
    onSuccess: () => {
      toast({
        title: "Inscription réussie",
        description: "Vous avez été ajouté à la liste d'attente. Nous vous notifierons par email dès qu'un créneau se libère.",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de l'inscription",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: WaitlistFormData) => {
    setIsSubmitting(true);
    try {
      await mutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate time options (8:00 to 20:00 in 30-minute intervals)
  const timeOptions: string[] = [];
  for (let hour = 8; hour <= 20; hour++) {
    for (let minute of [0, 30]) {
      if (hour === 20 && minute === 30) break; // Stop at 20:00
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      timeOptions.push(timeStr);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[90vw] md:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6" data-testid="dialog-waitlist">
        <DialogHeader>
          <DialogTitle className="text-2xl" data-testid="text-waitlist-title">
            Rejoindre la liste d'attente
          </DialogTitle>
          <DialogDescription className="text-base" data-testid="text-waitlist-description">
            Soyez notifié par email dès qu'un créneau correspondant à vos préférences se libère
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Professional Info */}
          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg space-y-2" data-testid="section-professional-info">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <p className="font-semibold" data-testid="text-professional-name">
                {professional.firstName} {professional.lastName}
              </p>
            </div>
            <p className="text-sm text-muted-foreground" data-testid="text-profession">
              {professional.professions && professional.professions.length > 0 
                ? professional.professions.join(', ') 
                : 'Profession non spécifiée'}
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Personal Information Section */}
              <div className="space-y-4" data-testid="section-personal-info">
                <h3 className="font-semibold text-lg" data-testid="text-section-title-personal">
                  Vos informations
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prénom</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="Jean" 
                            data-testid="input-firstname"
                          />
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
                          <Input 
                            {...field} 
                            placeholder="Dupont" 
                            data-testid="input-lastname"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="email" 
                            placeholder="jean.dupont@example.com" 
                            data-testid="input-email"
                          />
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
                          <Input 
                            {...field} 
                            placeholder="5141234567" 
                            data-testid="input-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Preferences Section */}
              <div className="space-y-4 pt-4 border-t" data-testid="section-preferences">
                <h3 className="font-semibold text-lg flex items-center gap-2" data-testid="text-section-title-preferences">
                  <Calendar className="h-5 w-5" />
                  Vos préférences
                </h3>

                {services.length > 0 && (
                  <FormField
                    control={form.control}
                    name="professionalServiceId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service souhaité (optionnel)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-service">
                              <SelectValue placeholder="Sélectionner un service" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Aucune préférence</SelectItem>
                            {services.map((service) => (
                              <SelectItem 
                                key={service.id} 
                                value={service.id}
                                data-testid={`select-service-option-${service.id}`}
                              >
                                {service.name} - {service.duration} min - {service.price / 100}$
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="preferredDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date souhaitée</FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Sélectionner une date"
                          min={format(new Date(), 'yyyy-MM-dd')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <p className="text-sm font-medium">Plage horaire souhaitée (optionnel)</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4">
                    <FormField
                      control={form.control}
                      name="preferredTimeStart"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">De</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-time-start">
                                <SelectValue placeholder="Aucune" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none" data-testid="select-time-start-option-none">
                                Aucune préférence
                              </SelectItem>
                              {timeOptions.map((time) => (
                                <SelectItem 
                                  key={time} 
                                  value={time}
                                  data-testid={`select-time-start-option-${time.replace(':', '')}`}
                                >
                                  {time}
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
                      name="preferredTimeEnd"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">À</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-time-end">
                                <SelectValue placeholder="Aucune" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none" data-testid="select-time-end-option-none">
                                Aucune préférence
                              </SelectItem>
                              {timeOptions.map((time) => (
                                <SelectItem 
                                  key={time} 
                                  value={time}
                                  data-testid={`select-time-end-option-${time.replace(':', '')}`}
                                >
                                  {time}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes additionnelles (optionnel)</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="Infos complémentaires..." 
                          className="resize-none"
                          rows={3}
                          data-testid="textarea-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                  data-testid="button-cancel"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  data-testid="button-submit"
                >
                  {isSubmitting ? "Inscription..." : "Rejoindre la liste d'attente"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
