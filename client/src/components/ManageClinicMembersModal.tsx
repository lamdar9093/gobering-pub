import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import LoadingAnimation from "@/components/LoadingAnimation";
import { Users, Trash2, Mail, Loader2, Clock, CheckCircle, Copy, DollarSign, AlertCircle, Undo } from "lucide-react";
import type { ClinicMember, Professional, TeamInvitation } from "@shared/schema";

interface ManageClinicMembersModalProps {
  open: boolean;
  onClose: () => void;
  clinicId: string;
}

interface ClinicMemberWithDetails extends ClinicMember {
  professional?: Professional;
}

export default function ManageClinicMembersModal({ open, onClose, clinicId }: ManageClinicMembersModalProps) {
  const { toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState("");
  const [lastDeletedMember, setLastDeletedMember] = useState<{ id: string; name: string } | null>(null);

  const { data: currentProfessional } = useQuery<Professional>({
    queryKey: ['/api/auth/me'],
    enabled: open,
  });

  const { data: members = [], isLoading } = useQuery<ClinicMemberWithDetails[]>({
    queryKey: [`/api/clinics/${clinicId}/members`],
    enabled: open && !!clinicId,
  });

  const { data: invitations = [], isLoading: isLoadingInvitations } = useQuery<TeamInvitation[]>({
    queryKey: [`/api/clinics/${clinicId}/invitations`],
    enabled: open && !!clinicId,
  });

  // Calculate current and future costs
  // Count all members except secretaries (Admin and any other roles are billable seats)
  const professionalMembers = members.filter(m => m.role !== 'Secrétaire');
  const currentSeats = professionalMembers.length || 1;
  const futureSeats = currentSeats + 1; // After accepting invitation
  
  const planType = currentProfessional?.planType || 'free';
  const basePrice = planType === 'pro' ? 39 : 0;
  
  const currentCost = basePrice + Math.max(currentSeats - 1, 0) * 15;
  const futureCost = basePrice + Math.max(futureSeats - 1, 0) * 15;
  const costIncrease = futureCost - currentCost;
  
  const isInTrial = currentProfessional?.subscriptionStatus === 'trial';
  const isLegacy = planType === 'legacy';

  const sendInvitationMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest('POST', `/api/clinics/${clinicId}/invite`, {
        email,
        role: "professional",
      });
      return response.json();
    },
    onSuccess: (data) => {
      const invitationUrl = `${window.location.origin}/invitation/${data.token}`;
      
      toast({
        title: "Invitation envoyée",
        description: (
          <div className="space-y-2">
            <p>Une invitation a été envoyée à {inviteEmail}</p>
            <div className="flex items-center gap-2 text-xs">
              <code className="flex-1 bg-muted px-2 py-1 rounded">{invitationUrl}</code>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => {
                  navigator.clipboard.writeText(invitationUrl);
                  toast({ title: "Lien copié!" });
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ),
      });
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: [`/api/clinics/${clinicId}/invitations`] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'envoyer l'invitation.",
        variant: "destructive",
      });
    },
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await apiRequest('DELETE', `/api/invitations/${invitationId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invitation annulée",
        description: "L'invitation a été annulée.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/clinics/${clinicId}/invitations`] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'annuler l'invitation.",
        variant: "destructive",
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ professionalId, memberName }: { professionalId: string; memberName: string }) => {
      const response = await apiRequest('DELETE', `/api/clinics/${clinicId}/members/${professionalId}`);
      return { ...(await response.json()), memberName, originalProfessionalId: professionalId };
    },
    onSuccess: (data) => {
      const memberName = data.memberName;
      // Use the professionalId from the response if available, otherwise use the original from mutation variables
      const professionalId = data.professionalId || data.originalProfessionalId;
      
      setLastDeletedMember({ id: professionalId, name: memberName });
      
      toast({
        title: "Membre retiré",
        description: "Le professionnel a été retiré de la clinique. Cliquez sur 'Annuler' pour le restaurer.",
        duration: 10000, // 10 secondes pour avoir le temps de cliquer
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => restoreMemberMutation.mutate(professionalId)}
            data-testid="button-undo-delete"
            className="gap-2"
          >
            <Undo className="h-4 w-4" />
            Annuler
          </Button>
        ),
      });
      queryClient.invalidateQueries({ queryKey: [`/api/clinics/${clinicId}/members`] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de retirer le membre.",
        variant: "destructive",
      });
    },
  });

  const restoreMemberMutation = useMutation({
    mutationFn: async (professionalId: string) => {
      const response = await apiRequest('POST', `/api/clinics/${clinicId}/members/${professionalId}/restore`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Membre restauré",
        description: "Le professionnel a été restauré dans la clinique.",
      });
      setLastDeletedMember(null);
      queryClient.invalidateQueries({ queryKey: [`/api/clinics/${clinicId}/members`] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de restaurer le membre.",
        variant: "destructive",
      });
    },
  });

  const handleSendInvitation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteEmail.includes('@')) {
      toast({
        title: "Email invalide",
        description: "Veuillez entrer une adresse email valide.",
        variant: "destructive",
      });
      return;
    }
    sendInvitationMutation.mutate(inviteEmail);
  };

  const copyInvitationLink = (token: string) => {
    const invitationUrl = `${window.location.origin}/invitation/${token}`;
    navigator.clipboard.writeText(invitationUrl);
    toast({
      title: "Lien copié!",
      description: "Le lien d'invitation a été copié dans le presse-papier.",
    });
  };

  const pendingInvitations = invitations.filter(inv => inv.status === 'pending');
  const expiredInvitations = invitations.filter(inv => inv.status === 'expired');

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        setInviteEmail("");
        onClose();
      }
    }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="title-manage-members">
            <Users className="h-5 w-5" />
            Gérer les membres de la clinique
          </DialogTitle>
          <DialogDescription>
            Invitez de nouveaux professionnels ou gérez les membres actuels
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Invitation Form */}
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSendInvitation} className="space-y-4">
                <div>
                  <Label htmlFor="invite-email">Inviter un professionnel par email</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="j.dupont@exemple.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      data-testid="input-invite-email"
                    />
                    <Button
                      type="submit"
                      disabled={sendInvitationMutation.isPending || !inviteEmail}
                      data-testid="button-send-invitation"
                    >
                      {sendInvitationMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Envoi...
                        </>
                      ) : (
                        <>
                          <Mail className="h-4 w-4 mr-2" />
                          Envoyer
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Le professionnel recevra un email avec un lien pour créer son compte et rejoindre votre clinique
                  </p>
                  
                  {/* Cost information alert */}
                  {!isLegacy && inviteEmail && inviteEmail.includes('@') && (
                    <Alert className="mt-4" data-testid="alert-cost-info">
                      <DollarSign className="h-4 w-4" />
                      <AlertDescription>
                        {isInTrial ? (
                          <div className="space-y-1">
                            <p className="font-medium">
                              Invitations gratuites pendant votre essai
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Une fois ce professionnel inscrit, votre abonnement passera à <span className="font-semibold">{futureSeats} professionnels</span> 
                              {' '}pour <span className="font-semibold">{futureCost}$/mois</span> après votre période d'essai.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <p className="font-medium">
                              Impact sur votre abonnement
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Une fois ce professionnel inscrit, votre abonnement passera de <span className="font-semibold">{currentSeats} {currentSeats === 1 ? 'professionnel' : 'professionnels'}</span> ({currentCost}$/mois) 
                              {' '}à <span className="font-semibold">{futureSeats} professionnels</span> ({futureCost}$/mois).
                              {' '}Augmentation : <span className="font-semibold text-blue-600">+{costIncrease}$/mois</span>
                            </p>
                          </div>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Pending Invitations */}
          {(isLoadingInvitations ? true : pendingInvitations.length > 0) && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Invitations en attente ({pendingInvitations.length})</h3>
              
              {isLoadingInvitations ? (
                <LoadingAnimation />
              ) : (
                <div className="space-y-2">
                  {pendingInvitations.map((invitation) => (
                    <Card key={invitation.id} data-testid={`invitation-card-${invitation.id}`}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{invitation.email}</p>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Invité le {invitation.createdAt ? new Date(invitation.createdAt).toLocaleDateString('fr-CA') : 'Date inconnue'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div 
                              className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100" 
                              role="img"
                              aria-label="En attente"
                              title="En attente"
                            >
                              <Clock className="h-4 w-4 text-orange-600" />
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyInvitationLink(invitation.token)}
                              title="Copier le lien d'invitation"
                              data-testid={`button-copy-link-${invitation.id}`}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => cancelInvitationMutation.mutate(invitation.id)}
                              disabled={cancelInvitationMutation.isPending}
                              title="Annuler l'invitation"
                              data-testid={`button-cancel-invitation-${invitation.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Active Members */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Membres actifs ({members.filter(m => !m.professional?.deletedAt).length})</h3>
            
            {isLoading ? (
              <LoadingAnimation />
            ) : members.filter(m => !m.professional?.deletedAt).length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    Aucun membre actif dans la clinique
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {members.filter(m => !m.professional?.deletedAt).map((member) => (
                  <Card key={member.id} data-testid={`member-card-${member.id}`}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">
                              {member.professional?.firstName} {member.professional?.lastName}
                            </p>
                            {member.role === "Admin" && (
                              <Badge variant="default" className="text-xs">
                                Admin
                              </Badge>
                            )}
                            {member.role === "Secrétaire" && (
                              <Badge variant="secondary" className="text-xs">
                                Secrétaire
                              </Badge>
                            )}
                            {member.role === "Professionnel" && (
                              <Badge variant="outline" className="text-xs">
                                Professionnel
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {member.professional?.email}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {member.professional?.professions?.[0]}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div 
                            className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100" 
                            role="img"
                            aria-label="Actif"
                            title="Actif"
                          >
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </div>
                          {member.role !== "Admin" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeMemberMutation.mutate({
                                professionalId: member.professionalId,
                                memberName: `${member.professional?.firstName} ${member.professional?.lastName}`
                              })}
                              disabled={removeMemberMutation.isPending}
                              data-testid={`button-remove-member-${member.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Deleted Members (48-hour grace period) */}
          {members.filter(m => m.professional?.deletedAt).length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg text-orange-600">Suppressions en attente ({members.filter(m => m.professional?.deletedAt).length})</h3>
              
              <div className="space-y-2">
                {members.filter(m => m.professional?.deletedAt).map((member) => {
                  const deletedAt = member.professional?.deletedAt ? new Date(member.professional.deletedAt) : null;
                  const hoursRemaining = deletedAt ? Math.max(0, 48 - Math.floor((Date.now() - deletedAt.getTime()) / (1000 * 60 * 60))) : 0;
                  
                  return (
                    <Card key={member.id} data-testid={`deleted-member-card-${member.id}`} className="opacity-60 border-orange-300">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold line-through text-muted-foreground">
                                {member.professional?.firstName} {member.professional?.lastName}
                              </p>
                              {member.role === "Admin" && (
                                <Badge variant="outline" className="text-xs opacity-70">
                                  Admin
                                </Badge>
                              )}
                              {member.role === "Secrétaire" && (
                                <Badge variant="outline" className="text-xs opacity-70">
                                  Secrétaire
                                </Badge>
                              )}
                              {member.role === "Professionnel" && (
                                <Badge variant="outline" className="text-xs opacity-70">
                                  Professionnel
                                </Badge>
                              )}
                              <Badge variant="destructive" className="text-xs">
                                Suppression dans {hoursRemaining}h
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {member.professional?.email}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {member.professional?.professions?.[0]}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => restoreMemberMutation.mutate(member.professionalId)}
                              disabled={restoreMemberMutation.isPending}
                              data-testid={`button-restore-member-${member.id}`}
                              className="gap-2 text-green-600 hover:text-green-700 border-green-600 hover:border-green-700"
                              title="Restaurer ce membre"
                            >
                              <Undo className="h-4 w-4" />
                              Annuler la suppression
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Expired Invitations (optional, hidden by default) */}
          {expiredInvitations.length > 0 && (
            <details className="space-y-3">
              <summary className="font-semibold text-sm cursor-pointer text-muted-foreground">
                Invitations expirées ({expiredInvitations.length})
              </summary>
              <div className="space-y-2 mt-2">
                {expiredInvitations.map((invitation) => (
                  <Card key={invitation.id} className="opacity-60">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm">{invitation.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Expirée le {invitation.expiresAt ? new Date(invitation.expiresAt).toLocaleDateString('fr-CA') : 'Date inconnue'}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-gray-500 border-gray-500">
                          Expirée
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </details>
          )}

          <div className="flex justify-end">
            <Button onClick={onClose} data-testid="button-close-members">
              Fermer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
