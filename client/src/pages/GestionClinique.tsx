import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/utils";
import { Users, Trash2, Mail, Loader2, Clock, CheckCircle, Copy, UserPlus, Shield, X, XCircle, ChevronDown, Briefcase, Plus, Edit, UserCheck, Crown, Lock } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingAnimation from "@/components/LoadingAnimation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ClinicMember, Professional, TeamInvitation, SecretaryAssignment, ClinicService, ProfessionalServiceAssignment } from "@shared/schema";
import { z } from "zod";
import { HEALTH_PROFESSIONS } from "@/lib/constants";
import { EmojiPicker } from "@/components/EmojiPicker";

interface ClinicMemberWithDetails extends ClinicMember {
  professional?: Professional;
  isReadOnly?: boolean;
}

const createMemberSchema = z.object({
  firstName: z.string().min(1, "Le prénom est requis"),
  lastName: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Email invalide"),
  profession: z.string().optional(),
  customProfession: z.string().optional(),
  role: z.enum(["Admin", "Professionnel", "Secrétaire"]),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  province: z.string().optional(),
  assignedProfessionals: z.array(z.string()).optional(),
}).refine((data) => {
  if (data.profession === "Autre" && !data.customProfession) {
    return false;
  }
  return true;
}, {
  message: "Veuillez préciser votre profession",
  path: ["customProfession"],
});

const serviceSchema = z.object({
  name: z.string().min(1, "Le nom du service est requis"),
  emoji: z.string().optional(),
  duration: z.number().min(5, "La durée minimale est de 5 minutes"),
  price: z.number().min(0, "Le prix doit être positif"),
  description: z.string().optional(),
  bufferTime: z.number().min(0, "Le temps de battement doit être positif").optional(),
});

export default function GestionClinique() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Professionnel");
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isCreateMemberDialogOpen, setIsCreateMemberDialogOpen] = useState(false);
  const [selectedUserType, setSelectedUserType] = useState<"Admin" | "Professionnel" | "Secrétaire" | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null);
  const [removeConfirmText, setRemoveConfirmText] = useState("");
  const [selectedSecretaryForAssignment, setSelectedSecretaryForAssignment] = useState<string | null>(null);
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ClinicService | null>(null);
  const [serviceToManage, setServiceToManage] = useState<string | null>(null);
  const [isManageServiceDialogOpen, setIsManageServiceDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);
  const [deleteErrorDialogOpen, setDeleteErrorDialogOpen] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string>("");
  const [deleteErrorAppointmentCount, setDeleteErrorAppointmentCount] = useState<number>(0);
  const [deleteAssignmentErrorDialogOpen, setDeleteAssignmentErrorDialogOpen] = useState(false);
  const [deleteErrorAssignedProfessionals, setDeleteErrorAssignedProfessionals] = useState<string[]>([]);
  const [roleChangeConfirmation, setRoleChangeConfirmation] = useState<{ professionalId: string; newRole: string; memberName: string } | null>(null);

  const { data: professional, isError, isLoading: isProfessionalLoading } = useQuery<Professional>({
    queryKey: ["/api/auth/me"],
  });

  const clinicId = professional?.clinicId;

  const { data: members = [], isLoading: isMembersLoading } = useQuery<ClinicMemberWithDetails[]>({
    queryKey: [`/api/clinics/${clinicId}/members`],
    enabled: !!clinicId,
  });

  const { data: allMembers = [] } = useQuery<ClinicMember[]>({
    queryKey: [`/api/clinics/${clinicId}/members`],
    enabled: !!clinicId,
  });

  const currentUserRole = allMembers.find(m => m.professionalId === professional?.id)?.role;

  const { data: invitations = [], isLoading: isLoadingInvitations } = useQuery<TeamInvitation[]>({
    queryKey: [`/api/clinics/${clinicId}/invitations`],
    enabled: !!clinicId,
  });

  const { data: clinicServices = [], isLoading: isLoadingServices } = useQuery<ClinicService[]>({
    queryKey: [`/api/clinics/${clinicId}/services`],
    enabled: !!clinicId && currentUserRole === "Admin",
  });

  const sendInvitationMutation = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const response = await apiRequest('POST', `/api/clinics/${clinicId}/invite`, data);
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
      setInviteRole("Professionnel");
      setIsInviteDialogOpen(false);
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
      const response = await apiRequest('PATCH', `/api/invitations/${invitationId}/cancel`);
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

  const deleteInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await apiRequest('DELETE', `/api/invitations/${invitationId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invitation supprimée",
        description: "L'invitation a été supprimée définitivement.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/clinics/${clinicId}/invitations`] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer l'invitation.",
        variant: "destructive",
      });
    },
  });

  const updateMemberRoleMutation = useMutation({
    mutationFn: async (data: { professionalId: string; role: string }) => {
      const response = await apiRequest('PATCH', `/api/clinics/${clinicId}/members/${data.professionalId}/role`, {
        role: data.role
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Rôle mis à jour",
        description: "Le rôle du membre a été modifié avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/clinics/${clinicId}/members`] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de modifier le rôle.",
        variant: "destructive",
      });
    },
  });

  const cancelMemberMutation = useMutation({
    mutationFn: async (professionalId: string) => {
      const response = await apiRequest('PATCH', `/api/clinics/${clinicId}/members/${professionalId}/cancel`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Membre annulé",
        description: "Le membre a été annulé. Vous pouvez maintenant le supprimer définitivement.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/clinics/${clinicId}/members`] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'annuler le membre.",
        variant: "destructive",
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (professionalId: string) => {
      const response = await apiRequest('DELETE', `/api/clinics/${clinicId}/members/${professionalId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Membre retiré",
        description: "Le professionnel a été retiré de la clinique.",
      });
      setMemberToRemove(null);
      setRemoveConfirmText("");
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

  const handleRemoveMember = () => {
    if (removeConfirmText !== "SUPPRIMER") {
      toast({
        title: "Confirmation incorrecte",
        description: "Veuillez taper SUPPRIMER pour confirmer",
        variant: "destructive",
      });
      return;
    }
    if (memberToRemove) {
      removeMemberMutation.mutate(memberToRemove.id);
    }
  };

  const { data: secretaryAssignments = [] } = useQuery<SecretaryAssignment[]>({
    queryKey: [`/api/secretary/assignments/${selectedSecretaryForAssignment}`],
    enabled: !!selectedSecretaryForAssignment,
  });

  const createAssignmentMutation = useMutation({
    mutationFn: async (data: { secretaryId: string; professionalId: string }) => {
      const response = await apiRequest('POST', `/api/secretary/assignments`, {
        ...data,
        clinicId,
      });
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Affectation créée",
        description: "Le professionnel a été assigné au secrétaire avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/secretary/assignments/${variables.secretaryId}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer l'affectation.",
        variant: "destructive",
      });
    },
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: async (data: { secretaryId: string; professionalId: string }) => {
      const response = await apiRequest('DELETE', `/api/secretary/assignments/${data.secretaryId}/${data.professionalId}`);
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Affectation supprimée",
        description: "Le professionnel a été retiré du secrétaire avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/secretary/assignments/${variables.secretaryId}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer l'affectation.",
        variant: "destructive",
      });
    },
  });

  const createMemberMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createMemberSchema>) => {
      // Use customProfession if profession is "Autre", otherwise use profession
      const finalProfession = data.profession === "Autre" ? data.customProfession : data.profession;
      const { customProfession, assignedProfessionals, profession, ...restData } = data;
      // Transform single profession to array for backend
      const requestData = { ...restData, professions: finalProfession ? [finalProfession] : [] };
      
      const response = await apiRequest('POST', `/api/clinics/${clinicId}/members/create`, requestData);
      const result = await response.json();
      
      // If creating a secretary with assigned professionals, create the assignments
      if (data.role === "Secrétaire" && assignedProfessionals && assignedProfessionals.length > 0) {
        const secretaryId = result.professional.id;
        for (const professionalId of assignedProfessionals) {
          await apiRequest('POST', `/api/secretary/assignments`, {
            secretaryId,
            professionalId,
            clinicId,
          });
        }
      }
      
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Membre créé avec succès",
        description: "Le nouveau membre a reçu un email avec ses identifiants temporaires.",
      });
      setIsCreateMemberDialogOpen(false);
      setSelectedUserType(null);
      createMemberForm.reset();
      queryClient.invalidateQueries({ queryKey: [`/api/clinics/${clinicId}/members`] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer le membre.",
        variant: "destructive",
      });
    },
  });

  const createServiceMutation = useMutation({
    mutationFn: async (data: z.infer<typeof serviceSchema>) => {
      const response = await apiRequest('POST', `/api/clinics/${clinicId}/services`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Service créé",
        description: "Le service a été créé avec succès.",
      });
      setIsServiceDialogOpen(false);
      serviceForm.reset();
      queryClient.invalidateQueries({ queryKey: [`/api/clinics/${clinicId}/services`] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer le service.",
        variant: "destructive",
      });
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<z.infer<typeof serviceSchema>> }) => {
      const response = await apiRequest('PUT', `/api/clinic-services/${data.id}`, data.updates);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Service mis à jour",
        description: "Le service a été modifié avec succès.",
      });
      setIsServiceDialogOpen(false);
      setEditingService(null);
      serviceForm.reset();
      queryClient.invalidateQueries({ queryKey: [`/api/clinics/${clinicId}/services`] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de modifier le service.",
        variant: "destructive",
      });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const response = await fetch(`/api/clinic-services/${serviceId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw { status: response.status, ...errorData };
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Service supprimé",
        description: "Le service a été supprimé avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/clinics/${clinicId}/services`] });
    },
    onError: (error: any) => {
      if (error.status === 400 && error.assignedProfessionals) {
        // Service has professionals assigned - show assignment error dialog
        setDeleteErrorMessage(error.message || "Ce service ne peut pas être supprimé");
        setDeleteErrorAssignedProfessionals(error.assignedProfessionals || []);
        setDeleteAssignmentErrorDialogOpen(true);
      } else if (error.status === 409) {
        // Service has appointments - show dialog
        setDeleteErrorMessage(error.message || "Ce service ne peut pas être supprimé");
        setDeleteErrorAppointmentCount(error.appointmentCount || 0);
        setDeleteErrorDialogOpen(true);
      } else {
        toast({
          title: "Erreur",
          description: error.message || "Impossible de supprimer le service.",
          variant: "destructive",
        });
      }
    },
  });

  const assignServiceMutation = useMutation({
    mutationFn: async (data: { serviceId: string; professionalId: string }) => {
      const response = await apiRequest('POST', `/api/clinic-services/${data.serviceId}/assign`, {
        professionalId: data.professionalId
      });
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Service assigné",
        description: "Le service a été assigné au professionnel avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/clinic-services/${variables.serviceId}/assignments`] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'assigner le service.",
        variant: "destructive",
      });
    },
  });

  const unassignServiceMutation = useMutation({
    mutationFn: async (data: { serviceId: string; professionalId: string }) => {
      const response = await apiRequest('DELETE', `/api/clinic-services/${data.serviceId}/assign/${data.professionalId}`);
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Service retiré",
        description: "Le service a été retiré du professionnel avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/clinic-services/${variables.serviceId}/assignments`] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de retirer le service.",
        variant: "destructive",
      });
    },
  });

  const createMemberForm = useForm<z.infer<typeof createMemberSchema>>({
    resolver: zodResolver(createMemberSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      profession: "",
      customProfession: "",
      role: "Professionnel",
      phone: "",
      address: "",
      city: "",
      postalCode: "",
      province: "",
      assignedProfessionals: [],
    },
  });

  const serviceForm = useForm<z.infer<typeof serviceSchema>>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: "",
      duration: 30,
      price: 0,
      description: "",
      bufferTime: 0,
    },
  });

  const selectedProfession = createMemberForm.watch("profession");
  const selectedRole = createMemberForm.watch("role");

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
    sendInvitationMutation.mutate({ email: inviteEmail, role: inviteRole });
  };

  const copyInvitationLink = (token: string) => {
    const invitationUrl = `${window.location.origin}/invitation/${token}`;
    navigator.clipboard.writeText(invitationUrl);
    toast({
      title: "Lien copié!",
      description: "Le lien d'invitation a été copié dans le presse-papier.",
    });
  };

  const getRoleBadge = (role: string) => {
    if (role === "Admin") {
      return <Badge variant="default" className="text-xs"><Shield className="h-3 w-3 mr-1" />Admin</Badge>;
    } else if (role === "Secrétaire") {
      return <Badge variant="secondary" className="text-xs">Secrétaire</Badge>;
    } else {
      return <Badge variant="outline" className="text-xs">Professionnel</Badge>;
    }
  };

  const pendingInvitations = invitations.filter(inv => inv.status === 'pending');
  const cancelledInvitations = invitations.filter(inv => inv.status === 'cancelled');
  const allPendingAndCancelled = [...pendingInvitations, ...cancelledInvitations];

  // Separate pending members (not yet connected) from active members
  const allPendingMembers = members.filter(m => !m.professional?.isActive);
  const pendingMembers = allPendingMembers.filter(m => !m.cancelled);
  const cancelledMembers = allPendingMembers.filter(m => m.cancelled);
  const allPendingAndCancelledMembers = [...pendingMembers, ...cancelledMembers];
  
  // Sort members by role: Admin → Professionnel → Secrétaire
  const getRoleOrder = (role: string) => {
    if (role === "Admin") return 1;
    if (role === "Professionnel") return 2;
    if (role === "Secrétaire") return 3;
    return 4;
  };
  
  const activeMembers = members
    .filter(m => m.professional?.isActive)
    .sort((a, b) => getRoleOrder(a.role) - getRoleOrder(b.role));

  // Handle service form when editing
  useEffect(() => {
    if (editingService) {
      serviceForm.reset({
        name: editingService.name,
        emoji: editingService.emoji || "",
        duration: editingService.duration,
        price: editingService.price / 100,
        description: editingService.description || "",
        bufferTime: editingService.bufferTime || 0,
      });
    } else {
      serviceForm.reset({
        name: "",
        emoji: "",
        duration: 30,
        price: 0,
        description: "",
        bufferTime: 0,
      });
    }
  }, [editingService]);

  // Redirect if loading is done and user is not authorized
  useEffect(() => {
    if (!isProfessionalLoading && !isMembersLoading && (isError || !professional?.clinicId || currentUserRole !== "Admin")) {
      setLocation("/dashboard");
    }
  }, [isProfessionalLoading, isMembersLoading, isError, professional?.clinicId, currentUserRole, setLocation]);

  // Show loading state while checking permissions
  if (isProfessionalLoading || isMembersLoading || !currentUserRole) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // Free plan restrictions
  const isFreePlan = professional?.planType === 'free';
  const professionalCount = activeMembers.filter(m => m.role === 'Professionnel' || m.role === 'Admin').length;
  const secretaryCount = activeMembers.filter(m => m.role === 'Secrétaire').length;
  
  // Free plan limits: 1 professional + 1 secretary
  const canAddProfessional = !isFreePlan || professionalCount < 1;
  const canAddSecretary = !isFreePlan || secretaryCount < 1;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-bold" data-testid="text-page-title">Gestion Clinique</h1>
          <p className="text-muted-foreground text-xs mt-1">
            Gérez les membres, invitations et rôles de votre clinique
          </p>
        </div>

        {/* Add Member Options */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <UserPlus className="h-4 w-4" />
              Inviter ou ajouter un nouveau membre
            </CardTitle>
            <CardDescription className="text-xs">
              Invitez un professionnel existant ou créez un nouveau compte
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isFreePlan && (!canAddProfessional || !canAddSecretary) && (
              <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs text-blue-900 dark:text-blue-100 flex items-start gap-2">
                  <Crown className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>Limite du plan Gratuit atteinte :</strong> {!canAddProfessional && "Vous avez déjà 1 professionnel (max du plan Gratuit). "}{!canAddSecretary && "Vous avez déjà 1 secrétaire (max du plan Gratuit). "}
                    <button onClick={() => setLocation("/dashboard/parametres/abonnement")} className="underline font-semibold hover:text-blue-700 dark:hover:text-blue-300">
                      Passer au PRO
                    </button> pour ajouter plus de membres.
                  </span>
                </p>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="flex-1" 
                    data-testid="button-open-invite-dialog"
                    disabled={!canAddProfessional}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Inviter un professionnel
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-[90vw] md:max-w-md p-4 sm:p-6">
                  <DialogHeader>
                    <DialogTitle>Inviter un professionnel existant</DialogTitle>
                    <DialogDescription>
                      Envoyez une invitation à un professionnel qui possède déjà un compte
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSendInvitation} className="space-y-3">
                    <div>
                      <Label htmlFor="invite-email">Email</Label>
                      <Input
                        id="invite-email"
                        type="email"
                        placeholder="j.dupont@exemple.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        data-testid="input-invite-email"
                      />
                    </div>
                    <div>
                      <Label htmlFor="invite-role">Rôle</Label>
                      <Select value={inviteRole} onValueChange={setInviteRole}>
                        <SelectTrigger id="invite-role" data-testid="select-invite-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Admin">Admin</SelectItem>
                          <SelectItem value="Professionnel">Professionnel</SelectItem>
                          <SelectItem value="Secrétaire">Secrétaire</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
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
                          Envoyer l'invitation
                        </>
                      )}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="flex-1" data-testid="button-open-create-user-menu">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Créer un Utilisateur
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem 
                    onClick={() => {
                      if (!canAddProfessional) return;
                      setSelectedUserType("Admin");
                      createMemberForm.setValue("role", "Admin");
                      setIsCreateMemberDialogOpen(true);
                    }}
                    data-testid="menu-item-create-admin"
                    disabled={!canAddProfessional}
                    className={!canAddProfessional ? "opacity-50 cursor-not-allowed" : ""}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    <span>
                      Admin
                      {!canAddProfessional && <span className="text-xs ml-2">(Limite PRO)</span>}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => {
                      if (!canAddProfessional) return;
                      setSelectedUserType("Professionnel");
                      createMemberForm.setValue("role", "Professionnel");
                      const allProfessionalIds = activeMembers
                        .filter(m => m.role === "Professionnel")
                        .map(m => m.professionalId);
                      createMemberForm.setValue("assignedProfessionals", []);
                      setIsCreateMemberDialogOpen(true);
                    }}
                    data-testid="menu-item-create-professional"
                    disabled={!canAddProfessional}
                    className={!canAddProfessional ? "opacity-50 cursor-not-allowed" : ""}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    <span>
                      Professionnel
                      {!canAddProfessional && <span className="text-xs ml-2">(Limite PRO)</span>}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => {
                      if (!canAddSecretary) return;
                      setSelectedUserType("Secrétaire");
                      createMemberForm.setValue("role", "Secrétaire");
                      const allProfessionalIds = activeMembers
                        .filter(m => m.role === "Professionnel" || m.role === "Admin")
                        .map(m => m.professionalId);
                      createMemberForm.setValue("assignedProfessionals", allProfessionalIds);
                      setIsCreateMemberDialogOpen(true);
                    }}
                    data-testid="menu-item-create-secretary"
                    disabled={!canAddSecretary}
                    className={!canAddSecretary ? "opacity-50 cursor-not-allowed" : ""}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    <span>
                      Secrétaire
                      {!canAddSecretary && <span className="text-xs ml-2">(Limite PRO)</span>}
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>

        {/* Create Member Dialog */}
        <Dialog open={isCreateMemberDialogOpen} onOpenChange={(open) => {
          setIsCreateMemberDialogOpen(open);
          if (!open) {
            setSelectedUserType(null);
            createMemberForm.reset();
          }
        }}>
          <DialogContent className="max-w-[95vw] sm:max-w-[90vw] md:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>
                {selectedUserType === "Admin" && "Créer un Admin"}
                {selectedUserType === "Professionnel" && "Créer un Professionnel"}
                {selectedUserType === "Secrétaire" && "Créer un Secrétaire"}
              </DialogTitle>
              <DialogDescription>
                Créez un compte pour un nouveau membre. Un email avec un mot de passe temporaire sera envoyé.
              </DialogDescription>
            </DialogHeader>
                  <Form {...createMemberForm}>
                    <form onSubmit={createMemberForm.handleSubmit((data) => createMemberMutation.mutate(data))} className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <FormField
                          control={createMemberForm.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Prénom *</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-create-firstname" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={createMemberForm.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nom *</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-create-lastname" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={createMemberForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email *</FormLabel>
                            <FormControl>
                              <Input type="email" {...field} data-testid="input-create-email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {selectedUserType === "Professionnel" && (
                        <FormField
                          control={createMemberForm.control}
                          name="profession"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Profession *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-create-profession">
                                    <SelectValue placeholder="Sélectionner une profession" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {HEALTH_PROFESSIONS.map((prof) => (
                                    <SelectItem key={prof} value={prof}>
                                      {prof}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {selectedProfession === "Autre" && selectedUserType === "Professionnel" && (
                        <FormField
                          control={createMemberForm.control}
                          name="customProfession"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Précisez votre profession *</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Entrez votre profession" data-testid="input-create-custom-profession" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {selectedUserType === "Secrétaire" && (
                        <FormField
                          control={createMemberForm.control}
                          name="assignedProfessionals"
                          render={() => (
                            <FormItem>
                              <div className="mb-4">
                                <FormLabel>Professionnels assignés (optionnel)</FormLabel>
                                <FormDescription>
                                  Sélectionnez les professionnels que ce secrétaire pourra gérer
                                </FormDescription>
                              </div>
                              <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-3">
                                {activeMembers.filter(m => m.role === "Professionnel" || m.role === "Admin").length === 0 ? (
                                  <p className="text-sm text-muted-foreground">Aucun professionnel disponible</p>
                                ) : (
                                  activeMembers
                                    .filter(m => m.role === "Professionnel" || m.role === "Admin")
                                    .map((professional) => (
                                      <FormField
                                        key={professional.id}
                                        control={createMemberForm.control}
                                        name="assignedProfessionals"
                                        render={({ field }) => {
                                          return (
                                            <FormItem
                                              key={professional.id}
                                              className="flex flex-row items-start space-x-3 space-y-0"
                                            >
                                              <FormControl>
                                                <Checkbox
                                                  checked={field.value?.includes(professional.professionalId)}
                                                  onCheckedChange={(checked) => {
                                                    return checked
                                                      ? field.onChange([...field.value || [], professional.professionalId])
                                                      : field.onChange(
                                                          field.value?.filter(
                                                            (value) => value !== professional.professionalId
                                                          )
                                                        )
                                                  }}
                                                  data-testid={`checkbox-assign-${professional.id}`}
                                                />
                                              </FormControl>
                                              <div className="space-y-0 leading-none">
                                                <FormLabel className="font-normal cursor-pointer">
                                                  {professional.professional?.firstName} {professional.professional?.lastName}
                                                </FormLabel>
                                                <p className="text-xs text-muted-foreground">
                                                  {professional.professional?.professions && professional.professional.professions.length > 0 
                                                    ? professional.professional.professions.join(', ') 
                                                    : 'Profession non spécifiée'}
                                                </p>
                                              </div>
                                            </FormItem>
                                          )
                                        }}
                                      />
                                    ))
                                )}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={createMemberForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Téléphone</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="514-123-4567" data-testid="input-create-phone" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={createMemberForm.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Adresse</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-create-address" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={createMemberForm.control}
                          name="city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Ville</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-create-city" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={createMemberForm.control}
                          name="postalCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Code postal</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="H1A 1A1" data-testid="input-create-postalcode" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={createMemberForm.control}
                          name="province"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Province</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-create-province">
                                    <SelectValue placeholder="Sélectionner" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="QC">Québec</SelectItem>
                                  <SelectItem value="ON">Ontario</SelectItem>
                                  <SelectItem value="BC">Colombie-Britannique</SelectItem>
                                  <SelectItem value="AB">Alberta</SelectItem>
                                  <SelectItem value="MB">Manitoba</SelectItem>
                                  <SelectItem value="SK">Saskatchewan</SelectItem>
                                  <SelectItem value="NS">Nouvelle-Écosse</SelectItem>
                                  <SelectItem value="NB">Nouveau-Brunswick</SelectItem>
                                  <SelectItem value="PE">Île-du-Prince-Édouard</SelectItem>
                                  <SelectItem value="NL">Terre-Neuve-et-Labrador</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={createMemberMutation.isPending}
                        data-testid="button-create-member-submit"
                      >
                        {createMemberMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Création...
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-4 w-4 mr-2" />
                            Créer le membre
                          </>
                        )}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
        </Dialog>

        {/* Pending and Cancelled Invitations */}
        {(isLoadingInvitations ? true : allPendingAndCancelled.length > 0) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-orange-600" />
                Invitations ({allPendingAndCancelled.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Invitations en attente ({pendingInvitations.length}) et annulées ({cancelledInvitations.length})
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingInvitations ? (
                <LoadingAnimation />
              ) : (
                <div className="space-y-2">
                  {allPendingAndCancelled.map((invitation) => (
                    <Card key={invitation.id} data-testid={`invitation-card-${invitation.id}`}>
                      <CardContent className="p-3">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <div className="flex-1 w-full sm:w-auto">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold break-words">{invitation.email}</p>
                              {getRoleBadge(invitation.role)}
                              {invitation.status === 'cancelled' && (
                                <Badge variant="destructive" className="text-xs">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Annulée
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Invité le {invitation.createdAt ? new Date(invitation.createdAt).toLocaleDateString('fr-CA') : 'Date inconnue'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            {invitation.status === 'pending' && (
                              <>
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
                                  <XCircle className="h-4 w-4 text-orange-600" />
                                </Button>
                              </>
                            )}
                            {invitation.status === 'cancelled' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteInvitationMutation.mutate(invitation.id)}
                                disabled={deleteInvitationMutation.isPending}
                                title="Supprimer définitivement l'invitation"
                                data-testid={`button-delete-invitation-${invitation.id}`}
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
            </CardContent>
          </Card>
        )}

        {/* Pending Members (not yet connected) */}
        {(isMembersLoading ? true : allPendingAndCancelledMembers.length > 0) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-orange-600" />
                Membres en attente ({allPendingAndCancelledMembers.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Membres créés qui ne se sont pas encore connectés ({pendingMembers.length}) et annulés ({cancelledMembers.length})
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isMembersLoading ? (
                <LoadingAnimation />
              ) : (
                <div className="space-y-2">
                  {allPendingAndCancelledMembers.map((member) => (
                    <Card key={member.id} data-testid={`member-card-${member.id}`}>
                      <CardContent className="p-3">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <div className="flex-1 w-full sm:w-auto">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold">
                                {member.professional?.firstName} {member.professional?.lastName}
                              </p>
                              {getRoleBadge(member.role)}
                              {member.cancelled && (
                                <Badge variant="destructive" className="text-xs">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Annulé
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground break-words">
                              {member.professional?.email}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {member.professional?.professions && member.professional.professions.length > 0 
                                ? member.professional.professions.join(', ') 
                                : 'Profession non spécifiée'}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                            {!member.cancelled && (
                              <>
                                <div 
                                  className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100" 
                                  role="img"
                                  aria-label="En attente"
                                  title="En attente de première connexion"
                                >
                                  <Clock className="h-4 w-4 text-orange-600" />
                                </div>
                                <Select
                                  value={member.role}
                                  onValueChange={(newRole) => 
                                    updateMemberRoleMutation.mutate({ 
                                      professionalId: member.professionalId, 
                                      role: newRole 
                                    })
                                  }
                                  disabled={member.role === "Admin" && members.filter(m => m.role === "Admin").length === 1}
                                >
                                  <SelectTrigger className="w-[140px]" data-testid={`select-role-${member.id}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Admin">Admin</SelectItem>
                                    <SelectItem value="Professionnel">Professionnel</SelectItem>
                                    <SelectItem value="Secrétaire">Secrétaire</SelectItem>
                                  </SelectContent>
                                </Select>
                                {member.role !== "Admin" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => cancelMemberMutation.mutate(member.professionalId)}
                                    disabled={cancelMemberMutation.isPending}
                                    title="Annuler le membre"
                                    data-testid={`button-cancel-member-${member.id}`}
                                  >
                                    <XCircle className="h-4 w-4 text-orange-600" />
                                  </Button>
                                )}
                              </>
                            )}
                            {member.cancelled && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setMemberToRemove({ 
                                  id: member.professionalId, 
                                  name: `${member.professional?.firstName || ''} ${member.professional?.lastName || ''}`
                                })}
                                title="Supprimer définitivement le membre"
                                data-testid={`button-delete-member-${member.id}`}
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
            </CardContent>
          </Card>
        )}

        {/* Active Members */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Membres actifs ({activeMembers.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Gérez les rôles et accès des membres de la clinique
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isMembersLoading ? (
              <LoadingAnimation />
            ) : activeMembers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucun membre actif dans la clinique
              </p>
            ) : (
              <div className="space-y-1">
                {activeMembers.map((member) => (
                  <Card key={member.id} data-testid={`member-card-${member.id}`}>
                    <CardContent className="p-3">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div className="flex-1 w-full sm:w-auto">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">
                              {member.professional?.firstName} {member.professional?.lastName}
                            </p>
                            {getRoleBadge(member.role)}
                            {member.role !== "Secrétaire" && member.isReadOnly && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="destructive" className="text-xs cursor-help">
                                      <Lock className="h-3 w-3 mr-1" />
                                      Lecture seule
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Ce professionnel ne peut pas accepter de nouveaux rendez-vous</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground break-words">
                            {member.professional?.email}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {member.professional?.professions && member.professional.professions.length > 0 
                              ? member.professional.professions.join(', ') 
                              : 'Profession non spécifiée'}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                          <div 
                            className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100" 
                            role="img"
                            aria-label="Actif"
                            title="Actif"
                          >
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </div>
                          <Select
                            value={member.role}
                            onValueChange={(newRole) => {
                              // Show confirmation dialog before changing role
                              setRoleChangeConfirmation({
                                professionalId: member.professionalId,
                                newRole,
                                memberName: `${member.professional?.firstName || ''} ${member.professional?.lastName || ''}`
                              });
                            }}
                            disabled={true}
                          >
                            <SelectTrigger className="w-[140px]" data-testid={`select-role-${member.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Admin">Admin</SelectItem>
                              <SelectItem value="Professionnel">Professionnel</SelectItem>
                              <SelectItem value="Secrétaire">Secrétaire</SelectItem>
                            </SelectContent>
                          </Select>
                          {member.role !== "Admin" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setMemberToRemove({ 
                                id: member.professionalId, 
                                name: `${member.professional?.firstName || ''} ${member.professional?.lastName || ''}`
                              })}
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
          </CardContent>
        </Card>

        {/* Services de la clinique - Admin Only */}
        {currentUserRole === "Admin" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Briefcase className="h-5 w-5" />
                Services de la clinique
              </CardTitle>
              <CardDescription className="text-xs">
                Créez des services et assignez-les aux professionnels de la clinique
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Dialog open={isServiceDialogOpen} onOpenChange={(open) => {
                  setIsServiceDialogOpen(open);
                  if (!open) {
                    setEditingService(null);
                    serviceForm.reset();
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-create-service">
                      <Plus className="h-4 w-4 mr-2" />
                      Nouveau service
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[95vw] sm:max-w-[90vw] md:max-w-md p-4 sm:p-6">
                    <DialogHeader>
                      <DialogTitle>{editingService ? "Modifier le service" : "Créer un nouveau service"}</DialogTitle>
                      <DialogDescription>
                        {editingService ? "Modifiez les informations du service" : "Créez un service qui pourra être assigné aux professionnels"}
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...serviceForm}>
                      <form onSubmit={serviceForm.handleSubmit((data) => {
                        const dataWithCents = {
                          ...data,
                          price: Math.round(data.price * 100)
                        };
                        if (editingService) {
                          updateServiceMutation.mutate({ id: editingService.id, updates: dataWithCents });
                        } else {
                          createServiceMutation.mutate(dataWithCents);
                        }
                      })} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <FormField
                            control={serviceForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem className="sm:col-span-2">
                                <FormLabel>Nom du service *</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Ex: Consultation générale" data-testid="input-service-name" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={serviceForm.control}
                            name="emoji"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Emoji</FormLabel>
                                <FormControl>
                                  <EmojiPicker value={field.value} onChange={field.onChange} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField
                            control={serviceForm.control}
                            name="duration"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Durée (minutes) *</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    type="number" 
                                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                                    data-testid="input-service-duration" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={serviceForm.control}
                            name="price"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Prix (CAD) *</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    type="number" 
                                    step="0.01"
                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    data-testid="input-service-price" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={serviceForm.control}
                          name="bufferTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Temps de battement (minutes)</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="number" 
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  data-testid="input-service-buffer" 
                                />
                              </FormControl>
                              <FormDescription>
                                Temps ajouté après chaque rendez-vous (pause, nettoyage, préparation)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={serviceForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Textarea {...field} rows={3} data-testid="input-service-description" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end gap-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => {
                              setIsServiceDialogOpen(false);
                              setEditingService(null);
                              serviceForm.reset();
                            }}
                            data-testid="button-cancel-service"
                          >
                            Annuler
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createServiceMutation.isPending || updateServiceMutation.isPending}
                            data-testid="button-save-service"
                          >
                            {(createServiceMutation.isPending || updateServiceMutation.isPending) ? (
                              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enregistrement...</>
                            ) : editingService ? "Modifier" : "Créer"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              {isLoadingServices ? (
                <LoadingAnimation />
              ) : clinicServices.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Aucun service créé. Créez votre premier service pour commencer.
                </p>
              ) : (
                <div className="space-y-2">
                  {clinicServices.map((service) => (
                    <Card key={service.id} data-testid={`service-card-${service.id}`}>
                      <CardContent className="pt-6">
                        <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                          <div className="flex-1 w-full sm:w-auto">
                            <p className="font-semibold break-words">{service.name}</p>
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-1">
                              <span>{service.duration} min</span>
                              <span>{formatPrice(service.price)}</span>
                              {service.bufferTime && service.bufferTime > 0 && (
                                <span>Battement: {service.bufferTime} min</span>
                              )}
                            </div>
                            {service.description && (
                              <p className="text-sm text-muted-foreground mt-2 break-words">{service.description}</p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setServiceToManage(service.id);
                                setIsManageServiceDialogOpen(true);
                              }}
                              data-testid={`button-manage-assignments-${service.id}`}
                            >
                              <UserCheck className="h-4 w-4 mr-2" />
                              Assigner
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingService(service);
                                setIsServiceDialogOpen(true);
                              }}
                              data-testid={`button-edit-service-${service.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setServiceToDelete(service.id);
                                setIsDeleteDialogOpen(true);
                              }}
                              data-testid={`button-delete-service-${service.id}`}
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
            </CardContent>
          </Card>
        )}

        {/* Secretary Assignment Management - Admin Only */}
        {currentUserRole === "Admin" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Gérer les assignations des secrétaires</CardTitle>
              <CardDescription className="text-xs">
                Cliquez sur un secrétaire pour gérer les professionnels qui lui sont assignés
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const secretaries = activeMembers.filter(m => m.role === "Secrétaire");
                
                if (secretaries.length === 0) {
                  return (
                    <p className="text-center text-muted-foreground py-8">
                      Aucun secrétaire dans la clinique. Créez un secrétaire pour gérer les affectations.
                    </p>
                  );
                }

                return (
                  <div className="space-y-3">
                    {secretaries.map((secretary) => (
                      <Card 
                        key={secretary.id} 
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => {
                          setSelectedSecretaryForAssignment(secretary.professionalId);
                          setIsAssignmentDialogOpen(true);
                        }}
                        data-testid={`secretary-assignment-${secretary.id}`}
                      >
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">
                                {secretary.professional?.firstName} {secretary.professional?.lastName}
                              </p>
                              <p className="text-sm text-muted-foreground break-words">
                                {secretary.professional?.email}
                              </p>
                            </div>
                            <ChevronDown className="h-5 w-5 text-muted-foreground -rotate-90 flex-shrink-0" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Role Descriptions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Description des rôles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-semibold">Admin</p>
                <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                  Accès complet : tous les onglets, dashboards, agendas des autres professionnels, et gestion de la clinique
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-semibold">Professionnel</p>
                <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                  Accès limité : uniquement ses propres données, agenda et patients. Pas d'accès à la gestion clinique
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-semibold">Secrétaire</p>
                <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                  Accès aux agendas et clients des professionnels assignés uniquement. Peut créer, modifier et annuler des rendez-vous. Ne peut pas modifier les services ni les disponibilités
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role Change Confirmation Dialog */}
      <AlertDialog open={!!roleChangeConfirmation} onOpenChange={(open) => {
        if (!open) setRoleChangeConfirmation(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer le changement de rôle</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment changer le rôle de <strong>{roleChangeConfirmation?.memberName}</strong> en <strong>{roleChangeConfirmation?.newRole}</strong> ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-role-change">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (roleChangeConfirmation) {
                  updateMemberRoleMutation.mutate({
                    professionalId: roleChangeConfirmation.professionalId,
                    role: roleChangeConfirmation.newRole
                  });
                  setRoleChangeConfirmation(null);
                }
              }}
              data-testid="button-confirm-role-change"
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Member Confirmation Dialog */}
      <Dialog open={!!memberToRemove} onOpenChange={(open) => {
        if (!open) {
          setMemberToRemove(null);
          setRemoveConfirmText("");
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[90vw] md:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Vous êtes sur le point de retirer <strong>{memberToRemove?.name}</strong> de la clinique. 
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="confirm-text">
                Pour confirmer, tapez <strong>SUPPRIMER</strong> ci-dessous :
              </Label>
              <Input
                id="confirm-text"
                value={removeConfirmText}
                onChange={(e) => setRemoveConfirmText(e.target.value)}
                placeholder="SUPPRIMER"
                data-testid="input-confirm-remove"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setMemberToRemove(null);
                  setRemoveConfirmText("");
                }}
                data-testid="button-cancel-remove"
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={handleRemoveMember}
                disabled={removeConfirmText !== "SUPPRIMER" || removeMemberMutation.isPending}
                data-testid="button-confirm-remove"
              >
                {removeMemberMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Suppression...
                  </>
                ) : (
                  "Supprimer"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Secretary Assignment Dialog */}
      <Dialog open={isAssignmentDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsAssignmentDialogOpen(false);
          setSelectedSecretaryForAssignment(null);
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[90vw] md:max-w-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Gérer les affectations</DialogTitle>
            <DialogDescription>
              {(() => {
                const secretary = activeMembers.find(m => m.professionalId === selectedSecretaryForAssignment);
                return secretary ? `${secretary.professional?.firstName} ${secretary.professional?.lastName}` : '';
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">Professionnels disponibles</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {(() => {
                  const availableProfessionals = activeMembers.filter(m => 
                    (m.role === "Professionnel" || m.role === "Admin") && 
                    m.professionalId !== selectedSecretaryForAssignment &&
                    !secretaryAssignments.some(a => a.professionalId === m.professionalId)
                  );
                  
                  if (availableProfessionals.length === 0) {
                    return (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Aucun professionnel disponible
                      </p>
                    );
                  }
                  
                  return availableProfessionals.map((professional) => (
                    <div key={professional.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2 border rounded">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {professional.professional?.firstName} {professional.professional?.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {professional.professional?.professions && professional.professional.professions.length > 0 
                            ? professional.professional.professions.join(', ') 
                            : 'Profession non spécifiée'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (selectedSecretaryForAssignment) {
                            createAssignmentMutation.mutate({
                              secretaryId: selectedSecretaryForAssignment,
                              professionalId: professional.professionalId,
                            });
                          }
                        }}
                        disabled={createAssignmentMutation.isPending}
                        data-testid={`button-assign-${professional.id}`}
                        className="w-full sm:w-auto"
                      >
                        Assigner
                      </Button>
                    </div>
                  ));
                })()}
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold mb-2">Professionnels assignés</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {secretaryAssignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucun professionnel assigné
                  </p>
                ) : (
                  secretaryAssignments.map((assignment) => {
                    const professional = activeMembers.find(m => m.professionalId === assignment.professionalId);
                    return (
                      <div key={assignment.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2 border rounded bg-muted">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {professional?.professional?.firstName} {professional?.professional?.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {professional?.professional?.professions && professional.professional.professions.length > 0 
                              ? professional.professional.professions.join(', ') 
                              : 'Profession non spécifiée'}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (selectedSecretaryForAssignment) {
                              deleteAssignmentMutation.mutate({
                                secretaryId: selectedSecretaryForAssignment,
                                professionalId: assignment.professionalId,
                              });
                            }
                          }}
                          disabled={deleteAssignmentMutation.isPending}
                          data-testid={`button-unassign-${assignment.id}`}
                          className="w-full sm:w-auto"
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAssignmentDialogOpen(false);
                  setSelectedSecretaryForAssignment(null);
                }}
                data-testid="button-close-assignments"
              >
                Fermer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Service Assignment Dialog */}
      <Dialog open={isManageServiceDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsManageServiceDialogOpen(false);
          setServiceToManage(null);
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[90vw] md:max-w-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Gérer les professionnels assignés</DialogTitle>
            <DialogDescription>
              {(() => {
                const service = clinicServices.find(s => s.id === serviceToManage);
                return service ? service.name : '';
              })()}
            </DialogDescription>
          </DialogHeader>
          {serviceToManage && (
            <ServiceAssignmentManager 
              serviceId={serviceToManage}
              activeMembers={activeMembers}
              assignServiceMutation={assignServiceMutation}
              unassignServiceMutation={unassignServiceMutation}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Service Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce service ? Cette action est irréversible et supprimera également toutes les assignations de ce service aux professionnels.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-service">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (serviceToDelete) {
                  deleteServiceMutation.mutate(serviceToDelete);
                  setServiceToDelete(null);
                  setIsDeleteDialogOpen(false);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete-service"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Service Error Dialog - Service has appointments */}
      <AlertDialog open={deleteErrorDialogOpen} onOpenChange={setDeleteErrorDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Service impossible à supprimer
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="text-base">{deleteErrorMessage}</p>
              {deleteErrorAppointmentCount > 0 && (
                <div className="bg-muted p-3 rounded-md">
                  <p className="text-sm font-medium">
                    {deleteErrorAppointmentCount === 1 
                      ? "1 rendez-vous utilise ce service"
                      : `${deleteErrorAppointmentCount} rendez-vous utilisent ce service`}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Pour supprimer ce service, vous devez d'abord annuler ou modifier ces rendez-vous.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setDeleteErrorDialogOpen(false)}
              data-testid="button-close-delete-error"
            >
              J'ai compris
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Service Error Dialog - Service has professionals assigned */}
      <AlertDialog open={deleteAssignmentErrorDialogOpen} onOpenChange={setDeleteAssignmentErrorDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Professionnels assignés
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-base">{deleteErrorMessage}</p>
                {deleteErrorAssignedProfessionals.length > 0 && (
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-sm font-medium mb-2">
                      {deleteErrorAssignedProfessionals.length === 1 
                        ? "1 professionnel est assigné à ce service :"
                        : `${deleteErrorAssignedProfessionals.length} professionnels sont assignés à ce service :`}
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {deleteErrorAssignedProfessionals.map((name, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <Users className="h-3 w-3" />
                          {name}
                        </li>
                      ))}
                    </ul>
                    <p className="text-sm text-muted-foreground mt-3">
                      Vous devez d'abord désassigner ces professionnels avant de supprimer le service.
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setDeleteAssignmentErrorDialogOpen(false)}
              data-testid="button-close-assignment-error"
            >
              J'ai compris
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

// Component to manage service assignments
function ServiceAssignmentManager({ 
  serviceId, 
  activeMembers, 
  assignServiceMutation, 
  unassignServiceMutation 
}: { 
  serviceId: string; 
  activeMembers: ClinicMemberWithDetails[];
  assignServiceMutation: any;
  unassignServiceMutation: any;
}) {
  const { data: assignments = [] } = useQuery<ProfessionalServiceAssignment[]>({
    queryKey: [`/api/clinic-services/${serviceId}/assignments`],
  });

  const assignedProfessionalIds = new Set(assignments.filter(a => a.isVisible).map(a => a.professionalId));
  const availableProfessionals = activeMembers.filter(m => 
    (m.role === "Professionnel" || m.role === "Admin") && 
    !assignedProfessionalIds.has(m.professionalId)
  );
  const assignedProfessionals = activeMembers.filter(m => 
    assignedProfessionalIds.has(m.professionalId)
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-2">Professionnels disponibles</h3>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {availableProfessionals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Tous les professionnels sont déjà assignés
            </p>
          ) : (
            availableProfessionals.map((professional) => (
              <div key={professional.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2 border rounded">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {professional.professional?.firstName} {professional.professional?.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {professional.professional?.professions && professional.professional.professions.length > 0 
                      ? professional.professional.professions.join(', ') 
                      : 'Profession non spécifiée'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    assignServiceMutation.mutate({
                      serviceId,
                      professionalId: professional.professionalId,
                    });
                  }}
                  disabled={assignServiceMutation.isPending}
                  data-testid={`button-assign-service-${professional.id}`}
                  className="w-full sm:w-auto"
                >
                  Assigner
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Professionnels assignés</h3>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {assignedProfessionals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun professionnel assigné
            </p>
          ) : (
            assignedProfessionals.map((professional) => (
              <div key={professional.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2 border rounded bg-muted/30">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {professional.professional?.firstName} {professional.professional?.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {professional.professional?.professions && professional.professional.professions.length > 0 
                      ? professional.professional.professions.join(', ') 
                      : 'Profession non spécifiée'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    unassignServiceMutation.mutate({
                      serviceId,
                      professionalId: professional.professionalId,
                    });
                  }}
                  disabled={unassignServiceMutation.isPending}
                  data-testid={`button-unassign-service-${professional.id}`}
                  className="w-full sm:w-auto"
                >
                  <X className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
