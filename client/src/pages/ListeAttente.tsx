import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingAnimation from "@/components/LoadingAnimation";
import type { Professional, ClinicMember, WaitlistEntry, ProfessionalService } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Clock, CheckCircle, XCircle, Ban, Mail, Phone, Trash2, Crown, Sparkles } from "lucide-react";
import { useDateFormat } from "@/hooks/useDateFormat";
import { convertDateFormat, formatDate as formatDateUtil } from "@/lib/dateFormatUtils";

export default function ListeAttente() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedEntry, setSelectedEntry] = useState<WaitlistEntry | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const { dateFormat, timeFormat } = useDateFormat();

  const { data: professional, isError } = useQuery<Professional>({
    queryKey: ["/api/auth/me"],
  });

  // Block access for free plan users
  const isFreePlan = professional?.planType === 'free';

  // Fetch clinic members to determine user role
  const { data: members = [] } = useQuery<ClinicMember[]>({
    queryKey: [`/api/clinics/${professional?.clinicId}/members`],
    enabled: !!professional?.clinicId,
  });

  const userRole = members.find(m => m.professionalId === professional?.id)?.role || null;
  const isSecretary = userRole === "Secrétaire";

  // Fetch assigned professionals for secretaries
  const { data: assignedProfessionals = [] } = useQuery<Professional[]>({
    queryKey: ["/api/secretary/assigned-professionals"],
    enabled: isSecretary,
  });

  // State for selected professional (for secretaries)
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>("");
  const hasRestoredRef = useRef(false);

  // Restore selection from localStorage once professional is loaded
  useEffect(() => {
    if (professional?.id && isSecretary && !selectedProfessionalId && !hasRestoredRef.current && assignedProfessionals.length > 0) {
      const stored = localStorage.getItem(`secretary-selected-professional-${professional.id}`);
      // Verify the stored professional is still in the assigned list
      if (stored && assignedProfessionals.some(p => p.id === stored)) {
        setSelectedProfessionalId(stored);
        hasRestoredRef.current = true;
      } else if (stored) {
        // Stored professional is no longer assigned, clear it from localStorage
        localStorage.removeItem(`secretary-selected-professional-${professional.id}`);
      }
    }
  }, [professional, isSecretary, selectedProfessionalId, assignedProfessionals]);

  // Validate current selection is still in assigned professionals
  useEffect(() => {
    if (isSecretary && selectedProfessionalId) {
      const isStillAssigned = assignedProfessionals.length > 0 && assignedProfessionals.some(p => p.id === selectedProfessionalId);
      if (!isStillAssigned) {
        // Current selection is no longer valid (removed or no assignments), reset
        hasRestoredRef.current = false;
        setSelectedProfessionalId("");
        if (professional?.id) {
          localStorage.removeItem(`secretary-selected-professional-${professional.id}`);
        }
      }
    }
  }, [isSecretary, selectedProfessionalId, assignedProfessionals, professional]);

  // Persist selectedProfessionalId to localStorage
  useEffect(() => {
    if (selectedProfessionalId && professional?.id && isSecretary) {
      localStorage.setItem(`secretary-selected-professional-${professional.id}`, selectedProfessionalId);
    }
  }, [selectedProfessionalId, professional, isSecretary]);

  // Set default selected professional when assignedProfessionals loads (only if no stored value was restored)
  useEffect(() => {
    if (isSecretary && assignedProfessionals.length > 0 && !selectedProfessionalId && !hasRestoredRef.current) {
      setSelectedProfessionalId(assignedProfessionals[0].id);
    }
  }, [isSecretary, assignedProfessionals, selectedProfessionalId]);

  // Determine which professionalId to use for queries
  const effectiveProfessionalId = isSecretary ? selectedProfessionalId : professional?.id;

  const { data: waitlistEntries = [], isLoading } = useQuery<WaitlistEntry[]>({
    queryKey: ["/api/waitlist", effectiveProfessionalId],
    enabled: !!effectiveProfessionalId,
  });

  const { data: services = [] } = useQuery<ProfessionalService[]>({
    queryKey: effectiveProfessionalId ? [`/api/professionals/${effectiveProfessionalId}/services/public`] : [],
    enabled: !!effectiveProfessionalId,
  });

  const cancelEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      return await apiRequest("DELETE", `/api/waitlist/${entryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waitlist", effectiveProfessionalId] });
      toast({
        title: "Demande annulée",
        description: "La demande de liste d'attente a été annulée avec succès",
      });
      setShowCancelDialog(false);
      setSelectedEntry(null);
    },
  });

  if (isError) {
    return (
      <DashboardLayout>
        <Alert variant="destructive">
          <AlertDescription>
            Erreur de chargement. Veuillez vous reconnecter.
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  // Filter entries by status
  const filteredEntries = waitlistEntries.filter(entry => {
    if (statusFilter === "all") return true;
    return entry.status === statusFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300" data-testid={`badge-status-pending`}><Clock className="w-3 h-3 mr-1" /> En attente</Badge>;
      case "notified":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300" data-testid={`badge-status-notified`}><AlertCircle className="w-3 h-3 mr-1" /> Notifié</Badge>;
      case "fulfilled":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300" data-testid={`badge-status-fulfilled`}><CheckCircle className="w-3 h-3 mr-1" /> Confirmé</Badge>;
      case "expired":
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300" data-testid={`badge-status-expired`}><XCircle className="w-3 h-3 mr-1" /> Expiré</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300" data-testid={`badge-status-cancelled`}><Ban className="w-3 h-3 mr-1" /> Annulé</Badge>;
      default:
        return <Badge variant="outline" data-testid={`badge-status-${status}`}>{status}</Badge>;
    }
  };

  const getServiceName = (professionalServiceId: string | null) => {
    if (!professionalServiceId) return "Tous les services";
    const service = services.find(s => s.id === professionalServiceId);
    return service?.name || "Service inconnu";
  };

  const formatTime = (time: string | null | undefined): string | null => {
    if (!time) return null;
    // Remove seconds if present and ensure HH:mm format
    const parts = time.split(':');
    if (parts.length >= 2) {
      const hours = parts[0].padStart(2, '0');
      const minutes = parts[1].padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    return time;
  };

  const getTimeInfo = (entry: WaitlistEntry) => {
    // For notified or fulfilled entries, show the actual available slot
    if ((entry.status === "notified" || entry.status === "fulfilled") && entry.availableDate) {
      return {
        type: "actual" as const,
        date: entry.availableDate,
        startTime: formatTime(entry.availableStartTime),
        endTime: formatTime(entry.availableEndTime)
      };
    }
    
    // For other statuses, show preferences
    return {
      type: "preference" as const,
      date: entry.preferredDate,
      startTime: formatTime(entry.preferredTimeStart),
      endTime: formatTime(entry.preferredTimeEnd)
    };
  };

  const handleCancelEntry = (entry: WaitlistEntry) => {
    setSelectedEntry(entry);
    setShowCancelDialog(true);
  };

  // Show upgrade message for free plan users
  if (isFreePlan) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900" data-testid="heading-waitlist">Liste d'attente</h1>
          </div>

          <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
            <CardContent className="pt-6">
              <div className="text-center space-y-6">
                <div className="flex justify-center">
                  <div className="p-4 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-full">
                    <Crown className="h-16 w-16 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    Fonctionnalité PRO requise
                  </h2>
                  <p className="text-lg text-gray-700 dark:text-gray-300 max-w-2xl mx-auto">
                    La <span className="font-semibold text-blue-700 dark:text-blue-300">Liste d'attente automatique</span> est une fonctionnalité exclusive du plan PRO.
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md mx-auto border border-blue-200 dark:border-blue-800">
                  <h3 className="text-sm font-bold mb-4 text-blue-700 dark:text-blue-300 flex items-center justify-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Avec le plan PRO, débloquez :
                  </h3>
                  <ul className="space-y-3 text-sm text-left">
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400">✅</span>
                      <span>Liste d'attente automatique avec notifications email</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400">✅</span>
                      <span>Rendez-vous illimités (plus de limite de 100)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400">✅</span>
                      <span>Multi-professionnels et assistants sans limite</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400">✅</span>
                      <span>Widgets personnalisables et statistiques avancées</span>
                    </li>
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                  <Button
                    onClick={() => setLocation("/dashboard/parametres/abonnement")}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30 px-8"
                    data-testid="button-upgrade-pro-waitlist"
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    Passer au plan PRO
                  </Button>
                  <Button
                    onClick={() => setLocation("/dashboard")}
                    variant="outline"
                    data-testid="button-back-dashboard"
                  >
                    Retour au calendrier
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-bold text-gray-900" data-testid="heading-waitlist">Liste d'attente</h1>
          <p className="text-gray-600 mt-2 text-xs" data-testid="text-waitlist-description">
            Gérez les demandes de rendez-vous en liste d'attente
          </p>
        </div>

        {isSecretary && assignedProfessionals.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700">Professionnel :</label>
                <Select
                  value={selectedProfessionalId}
                  onValueChange={setSelectedProfessionalId}
                >
                  <SelectTrigger className="w-[300px]" data-testid="select-professional">
                    <SelectValue placeholder="Sélectionner un professionnel" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignedProfessionals.map((prof) => (
                      <SelectItem key={prof.id} value={prof.id} data-testid={`option-professional-${prof.id}`}>
                        {prof.firstName} {prof.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm" data-testid="heading-requests">Demandes</CardTitle>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]" data-testid="select-status-filter">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="filter-all">Tous</SelectItem>
                  <SelectItem value="pending" data-testid="filter-pending">En attente</SelectItem>
                  <SelectItem value="notified" data-testid="filter-notified">Notifié</SelectItem>
                  <SelectItem value="fulfilled" data-testid="filter-fulfilled">Confirmé</SelectItem>
                  <SelectItem value="expired" data-testid="filter-expired">Expiré</SelectItem>
                  <SelectItem value="cancelled" data-testid="filter-cancelled">Annulé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8" data-testid="loading-waitlist">
                <LoadingAnimation />
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="text-center py-8" data-testid="empty-waitlist">
                <p className="text-gray-500">Aucune demande trouvée</p>
              </div>
            ) : (
              <>
                {/* Vue Desktop - Tableau */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead data-testid="header-client">Client</TableHead>
                        <TableHead data-testid="header-contact">Contact</TableHead>
                        <TableHead data-testid="header-service">Service</TableHead>
                        <TableHead data-testid="header-preferences">Préférences</TableHead>
                        <TableHead data-testid="header-status">Statut</TableHead>
                        <TableHead data-testid="header-created">Créé le</TableHead>
                        <TableHead data-testid="header-actions">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntries.map((entry) => (
                        <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                          <TableCell data-testid={`cell-client-${entry.id}`}>
                            <div>
                              <div className="font-medium">{entry.firstName} {entry.lastName}</div>
                            </div>
                          </TableCell>
                          <TableCell data-testid={`cell-contact-${entry.id}`}>
                            <div className="text-sm">
                              <div data-testid={`text-email-${entry.id}`}>{entry.email}</div>
                              <div className="text-gray-500" data-testid={`text-phone-${entry.id}`}>{entry.phone}</div>
                            </div>
                          </TableCell>
                          <TableCell data-testid={`cell-service-${entry.id}`}>
                            {getServiceName(entry.professionalServiceId)}
                          </TableCell>
                          <TableCell data-testid={`cell-preferences-${entry.id}`}>
                            <div className="text-sm">
                              {(() => {
                                const timeInfo = getTimeInfo(entry);
                                if (timeInfo.date) {
                                  return (
                                    <>
                                      <div data-testid={`text-preferred-date-${entry.id}`}>
                                        {timeInfo.type === "actual" ? "Rendez-vous: " : "Date: "}
                                        {format(new Date(timeInfo.date), convertDateFormat(dateFormat), { locale: fr })}
                                      </div>
                                      {timeInfo.startTime && timeInfo.endTime && (
                                        <div className="text-gray-500" data-testid={`text-preferred-time-${entry.id}`}>
                                          Heure: {timeInfo.startTime} - {timeInfo.endTime}
                                        </div>
                                      )}
                                    </>
                                  );
                                }
                                return <span className="text-gray-400" data-testid={`text-no-preferences-${entry.id}`}>Aucune préférence</span>;
                              })()}
                            </div>
                          </TableCell>
                          <TableCell data-testid={`cell-status-${entry.id}`}>
                            {getStatusBadge(entry.status)}
                          </TableCell>
                          <TableCell data-testid={`cell-created-${entry.id}`}>
                            {entry.createdAt && `${formatDateUtil(new Date(entry.createdAt), convertDateFormat(dateFormat))} à ${format(new Date(entry.createdAt), 'HH:mm')}`}
                          </TableCell>
                          <TableCell data-testid={`cell-actions-${entry.id}`}>
                            {(entry.status === "pending" || entry.status === "notified") && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleCancelEntry(entry)}
                                data-testid={`button-cancel-${entry.id}`}
                              >
                                Annuler
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Vue Mobile - Cartes */}
                <div className="md:hidden space-y-3">
                  {filteredEntries.map((entry) => {
                    const timeInfo = getTimeInfo(entry);
                    const isCancelled = entry.status === "cancelled";
                    
                    return (
                      <div 
                        key={entry.id} 
                        className={`bg-white rounded-2xl p-5 shadow-sm relative overflow-hidden ${
                          isCancelled ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-blue-500'
                        }`}
                        data-testid={`card-entry-${entry.id}`}
                      >
                        {/* Header - Client info and status */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-lg text-gray-900 mb-2" data-testid={`card-client-${entry.id}`}>
                              {entry.firstName} {entry.lastName}
                            </h3>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm text-blue-600">
                                <Mail className="w-4 h-4 flex-shrink-0" />
                                <a 
                                  href={`mailto:${entry.email}`}
                                  className="truncate hover:underline"
                                  data-testid={`card-email-${entry.id}`}
                                >
                                  {entry.email}
                                </a>
                              </div>
                              {entry.phone && (
                                <div className="flex items-center gap-2 text-sm text-blue-600">
                                  <Phone className="w-4 h-4 flex-shrink-0" />
                                  <a 
                                    href={`tel:${entry.phone}`}
                                    className="hover:underline"
                                    data-testid={`card-phone-${entry.id}`}
                                  >
                                    {entry.phone}
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                          <div data-testid={`card-status-${entry.id}`}>
                            {getStatusBadge(entry.status)}
                          </div>
                        </div>

                        {/* Details Section - Gray background */}
                        <div className="bg-gray-50 rounded-xl p-4 space-y-3 mb-4">
                          <div className="flex items-start">
                            <span className="text-sm text-gray-600 font-semibold min-w-[100px]">Service :</span>
                            <span className="text-sm text-gray-900 font-medium" data-testid={`card-service-${entry.id}`}>
                              {getServiceName(entry.professionalServiceId)}
                            </span>
                          </div>
                          
                          {timeInfo.date && (
                            <div className="flex items-start" data-testid={`card-preferences-${entry.id}`}>
                              <span className="text-sm text-gray-600 font-semibold min-w-[100px]">
                                {timeInfo.type === "actual" ? "Rendez-vous :" : "Préférences :"}
                              </span>
                              <span className="text-sm text-blue-600 font-semibold">
                                {format(new Date(timeInfo.date), convertDateFormat(dateFormat), { locale: fr })}
                                {timeInfo.startTime && timeInfo.endTime && (
                                  <span className="ml-1">({timeInfo.startTime} - {timeInfo.endTime})</span>
                                )}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Footer - Date and actions */}
                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                          <div className="flex items-center gap-2 text-sm text-gray-500" data-testid={`card-created-${entry.id}`}>
                            <Clock className="w-3.5 h-3.5" />
                            {entry.createdAt && `Reçu le ${formatDateUtil(new Date(entry.createdAt), convertDateFormat(dateFormat))} à ${format(new Date(entry.createdAt), 'HH:mm')}`}
                          </div>
                        </div>

                        {/* Action buttons */}
                        {(entry.status === "pending" || entry.status === "notified") && (
                          <div className="mt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full text-red-500 border-red-500 hover:bg-red-50 rounded-lg h-10 font-semibold"
                              onClick={() => handleCancelEntry(entry)}
                              data-testid={`card-button-cancel-${entry.id}`}
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Annuler
                            </Button>
                          </div>
                        )}

                        {entry.status === "cancelled" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-3 rounded-lg h-10 font-semibold text-gray-700 border-gray-300 hover:bg-gray-50"
                            onClick={() => handleCancelEntry(entry)}
                            data-testid={`card-button-delete-${entry.id}`}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Supprimer
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cancel Entry Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[90vw] md:max-w-md p-4 sm:p-6" data-testid="dialog-cancel-entry">
          <DialogHeader>
            <DialogTitle data-testid="dialog-cancel-title">Annuler la demande</DialogTitle>
            <DialogDescription data-testid="dialog-cancel-description">
              Êtes-vous sûr de vouloir annuler cette demande de liste d'attente ?
            </DialogDescription>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-2">
              <p className="text-sm" data-testid="dialog-cancel-client">
                <strong>Client:</strong> {selectedEntry.firstName} {selectedEntry.lastName}
              </p>
              <p className="text-sm" data-testid="dialog-cancel-email">
                <strong>Email:</strong> {selectedEntry.email}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              data-testid="button-cancel-dialog-close"
            >
              Fermer
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedEntry && cancelEntryMutation.mutate(selectedEntry.id)}
              disabled={cancelEntryMutation.isPending}
              data-testid="button-cancel-dialog-confirm"
            >
              {cancelEntryMutation.isPending ? "Annulation..." : "Annuler la demande"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
