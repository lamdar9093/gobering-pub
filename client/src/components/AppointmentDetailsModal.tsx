import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Mail, Phone, User, FileText, AlertCircle, Stethoscope } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Appointment, Professional } from "@shared/schema";
import { useDateFormat } from "@/hooks/useDateFormat";
import { convertDateFormat, formatDate as formatDateUtil } from "@/lib/dateFormatUtils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AppointmentDetailsModalProps {
  open: boolean;
  onClose: () => void;
  appointment: Appointment | null;
}

const statusLabels = {
  pending: { label: "En attente", color: "bg-gray-500" },
  confirmed: { label: "Confirmé", color: "bg-green-500" },
  cancelled: { label: "Annulé", color: "bg-red-500" },
  draft: { label: "Brouillon", color: "bg-yellow-500" },
};

export default function AppointmentDetailsModal({ open, onClose, appointment }: AppointmentDetailsModalProps) {
  const { toast } = useToast();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");
  const { dateFormat, timeFormat } = useDateFormat();

  // Fetch professional details
  const { data: professional } = useQuery<Professional>({
    queryKey: ["/api/professionals", appointment?.professionalId],
    enabled: !!appointment?.professionalId,
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("PATCH", `/api/professional/appointments/${id}/cancel`, {});
    },
    onSuccess: () => {
      toast({
        title: "Rendez-vous annulé",
        description: "Le rendez-vous a été annulé avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/professional/appointments"] });
      setShowCancelDialog(false);
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de l'annulation",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest("PATCH", `/api/professional/appointments/${id}/status`, { status });
    },
    onSuccess: () => {
      toast({
        title: "Statut mis à jour",
        description: "Le statut du rendez-vous a été mis à jour avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/professional/appointments"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de la mise à jour",
        variant: "destructive",
      });
    },
  });

  if (!appointment) return null;

  const appointmentDate = parseISO(appointment.appointmentDate.toString());
  const status = statusLabels[appointment.status as keyof typeof statusLabels];

  const handleStatusChange = (status: string) => {
    setNewStatus(status);
    updateStatusMutation.mutate({ id: appointment.id, status });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Détails du rendez-vous</DialogTitle>
              <Badge className={status.color} data-testid="badge-status">
                {status.label}
              </Badge>
            </div>
            <DialogDescription>
              Rendez-vous du {format(appointmentDate, convertDateFormat(dateFormat), { locale: fr })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Patient Info */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                Informations du patient
              </h3>
              <div className="grid grid-cols-2 gap-4 pl-6">
                <div>
                  <p className="text-sm text-muted-foreground">Nom complet</p>
                  <p className="font-medium" data-testid="text-patient-name">
                    {appointment.firstName} {appointment.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    Email
                  </p>
                  <p className="font-medium" data-testid="text-patient-email">{appointment.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Téléphone
                  </p>
                  <p className="font-medium" data-testid="text-patient-phone">{appointment.phone}</p>
                </div>
              </div>
            </div>

            {/* Appointment Info */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Informations du rendez-vous
              </h3>
              <div className="grid grid-cols-2 gap-4 pl-6">
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium" data-testid="text-appointment-date">
                    {format(appointmentDate, convertDateFormat(dateFormat), { locale: fr })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Heure
                  </p>
                  <p className="font-medium" data-testid="text-appointment-time">
                    {appointment.startTime} - {appointment.endTime}
                  </p>
                </div>
                {(appointment as any).serviceName && (
                  <div>
                    <p className="text-sm text-muted-foreground">Service</p>
                    <p className="font-medium" data-testid="text-service-name">
                      {(appointment as any).serviceName}
                    </p>
                  </div>
                )}
                {professional && (
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Stethoscope className="h-3 w-3" />
                      Professionnel
                    </p>
                    <p className="font-medium" data-testid="text-therapist-name">
                      Dr. {professional.firstName} {professional.lastName}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {appointment.notes && (
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Notes
                </h3>
                <p className="text-sm pl-6 text-muted-foreground" data-testid="text-notes">
                  {appointment.notes}
                </p>
              </div>
            )}

            {/* Status Change */}
            <div className="space-y-2">
              <h3 className="font-semibold">Changer le statut</h3>
              <Select 
                value={newStatus || appointment.status} 
                onValueChange={handleStatusChange}
                disabled={updateStatusMutation.isPending}
              >
                <SelectTrigger data-testid="select-status-change">
                  <SelectValue placeholder="Sélectionnez un statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Brouillon</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="confirmed">Confirmé</SelectItem>
                  <SelectItem value="cancelled">Annulé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button
                variant="outline"
                onClick={onClose}
                data-testid="button-close"
              >
                Fermer
              </Button>
              {appointment.status !== "cancelled" && (
                <Button
                  variant="destructive"
                  onClick={() => setShowCancelDialog(true)}
                  data-testid="button-cancel-appointment"
                >
                  Annuler le rendez-vous
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Annuler le rendez-vous ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir annuler ce rendez-vous avec{" "}
              <strong>{appointment.firstName} {appointment.lastName}</strong> ?
              Cette action ne peut pas être annulée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-dialog-cancel">
              Non, conserver
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelMutation.mutate(appointment.id)}
              disabled={cancelMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-cancel-dialog-confirm"
            >
              {cancelMutation.isPending ? "Annulation..." : "Oui, annuler"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
