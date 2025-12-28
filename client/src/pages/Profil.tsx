import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, Mail, Phone, MapPin, Briefcase, Camera, Upload, Loader2, Pencil, X, Trash2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingAnimation from "@/components/LoadingAnimation";
import type { Professional } from "@shared/schema";
import { HEALTH_PROFESSIONS } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const provinces = [
  "Alberta",
  "Colombie-Britannique",
  "Manitoba",
  "Nouveau-Brunswick",
  "Terre-Neuve-et-Labrador",
  "Nouvelle-Écosse",
  "Ontario",
  "Île-du-Prince-Édouard",
  "Québec",
  "Saskatchewan",
];

const profileFormSchema = z.object({
  firstName: z.string().min(1, "Le prénom est requis"),
  lastName: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Email invalide"),
  phone: z.string().min(1, "Le téléphone est requis"),
  address: z.string().min(1, "L'adresse est requise"),
  city: z.string().min(1, "La ville est requise"),
  postalCode: z.string().min(1, "Le code postal est requis"),
  province: z.string().optional(),
  description: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function Profil() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [imageError, setImageError] = useState(false);
  const [cacheBuster, setCacheBuster] = useState<number>(Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditingProfessions, setIsEditingProfessions] = useState(false);
  const [selectedProfessions, setSelectedProfessions] = useState<string[]>([]);

  const { data: professional, isError, isLoading } = useQuery<Professional & { isLamdaaAccount?: boolean }>({
    queryKey: ["/api/auth/me"],
  });

  // Helper function to add cache-busting parameter to image URL
  const getImageUrlWithCacheBuster = (url: string | null | undefined) => {
    if (!url) return "";
    
    try {
      // Handle both absolute and relative URLs
      const imageUrl = url.startsWith('http') 
        ? new URL(url) 
        : new URL(url, window.location.origin);
      
      // Add or update the cache-busting parameter
      imageUrl.searchParams.set('v', cacheBuster.toString());
      
      // Return relative URL if original was relative
      return url.startsWith('http') ? imageUrl.toString() : imageUrl.pathname + imageUrl.search;
    } catch (e) {
      // Fallback: append cache-busting parameter safely
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}v=${cacheBuster}`;
    }
  };

  const { data: members = [] } = useQuery<any[]>({
    queryKey: [`/api/clinics/${professional?.clinicId}/members`],
    enabled: !!professional?.clinicId,
  });

  const userRole = members.find(m => m.professionalId === professional?.id)?.role || null;
  const isAdmin = userRole === "Admin";
  const isSecretary = userRole === "Secrétaire";

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      postalCode: "",
      province: "",
      description: "",
    },
  });

  useEffect(() => {
    if (professional) {
      form.reset({
        firstName: professional.firstName || "",
        lastName: professional.lastName || "",
        email: professional.email || "",
        phone: professional.phone || "",
        address: professional.address || "",
        city: professional.city || "",
        postalCode: professional.postalCode || "",
        province: professional.province || "",
        description: professional.description || "",
      });
      setImageError(false);
    }
  }, [professional]);

  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("photo", file);
      
      const response = await fetch("/api/upload/profile-picture", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors du téléversement");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setCacheBuster(Date.now()); // Update cache buster to force image reload
      setSelectedFile(null);
      setPreviewUrl("");
      toast({
        title: "Photo téléversée",
        description: "Votre photo de profil a été mise à jour avec succès",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors du téléversement de la photo",
        variant: "destructive",
      });
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PATCH", `/api/professional/profile`, { profilePicture: null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setCacheBuster(Date.now());
      setImageError(false);
      toast({
        title: "Photo supprimée",
        description: "Votre photo de profil a été supprimée avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la suppression de la photo",
        variant: "destructive",
      });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      return await apiRequest("PATCH", `/api/professional/profile`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0]?.toString() || '';
        return key.includes('/timeslots');
      }});
      toast({
        title: "Profil mis à jour",
        description: "Votre profil a été mis à jour avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la mise à jour du profil",
        variant: "destructive",
      });
    },
  });


  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (300KB max)
    if (file.size > 300 * 1024) {
      toast({
        title: "Fichier trop volumineux",
        description: "La taille maximale est de 300 Ko",
        variant: "destructive",
      });
      return;
    }

    // Check file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Format non supporté",
        description: "Seules les images (JPEG, PNG, GIF, WebP) sont autorisées",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setImageError(false);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadPhoto = () => {
    if (selectedFile) {
      uploadPhotoMutation.mutate(selectedFile);
    }
  };

  const updateProfessionsMutation = useMutation({
    mutationFn: async (professions: string[]) => {
      return await apiRequest("PATCH", `/api/professional/professions`, { professions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0]?.toString() || '';
        return key.includes('/professionals');
      }});
      setIsEditingProfessions(false);
      toast({
        title: "Professions mises à jour",
        description: "Vos professions ont été mises à jour avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la mise à jour des professions",
        variant: "destructive",
      });
    },
  });

  const handleOpenEditProfessions = () => {
    setSelectedProfessions(professional?.professions || []);
    setIsEditingProfessions(true);
  };

  const handleSaveProfessions = () => {
    if (selectedProfessions.length === 0) {
      toast({
        title: "Validation",
        description: "Vous devez sélectionner au moins une profession",
        variant: "destructive",
      });
      return;
    }
    updateProfessionsMutation.mutate(selectedProfessions);
  };

  const toggleProfession = (profession: string) => {
    setSelectedProfessions(prev => 
      prev.includes(profession)
        ? prev.filter(p => p !== profession)
        : [...prev, profession]
    );
  };

  if (isError) {
    setLocation("/login-professionnel");
    return null;
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <LoadingAnimation />
        </div>
      </DashboardLayout>
    );
  }

  const onSubmit = (data: ProfileFormValues) => {
    updateProfileMutation.mutate(data);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold" data-testid="text-page-title">Mon Profil</h1>
            {professional?.isLamdaaAccount && (
              <Badge variant="secondary" className="bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-700 dark:to-pink-700 text-white font-semibold pointer-events-none" data-testid="badge-lamdaa">
                LAMDAA
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-xs mt-1">
            Gérez vos informations professionnelles
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4" />
              Informations personnelles
            </CardTitle>
            <CardDescription className="text-xs">
              Ces informations sont visibles par vos patients
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prénom</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-firstname" />
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
                          <Input {...field} data-testid="input-lastname" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="md:col-span-2">
                    <FormLabel className="text-sm">Photo de profil</FormLabel>
                    <div className="flex flex-col md:flex-row items-start gap-3 md:gap-4 mt-2">
                      {/* Current or Preview Photo */}
                      <div className="flex-shrink-0">
                        <div className="relative">
                          {(previewUrl || professional?.profilePicture) && !imageError ? (
                            <img 
                              src={previewUrl || getImageUrlWithCacheBuster(professional?.profilePicture)} 
                              alt="Photo de profil" 
                              className="h-40 w-32 rounded-lg object-cover border-2 border-border"
                              onError={() => setImageError(true)}
                            />
                          ) : (
                            <div className="h-40 w-32 rounded-lg bg-muted border-2 border-border flex items-center justify-center">
                              <Camera className="h-10 w-10 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Upload Controls */}
                      <div className="flex-1 min-w-0 w-full md:w-auto space-y-3">
                        <div className="space-y-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                            onChange={handleFileSelect}
                            className="hidden"
                            data-testid="input-file-photo"
                          />
                          
                          <div className="flex flex-wrap items-center gap-3">
                            <Button
                              type="button"
                              onClick={selectedFile ? handleUploadPhoto : () => fileInputRef.current?.click()}
                              disabled={uploadPhotoMutation.isPending}
                              className="gap-2"
                              data-testid="button-select-photo"
                            >
                              {uploadPhotoMutation.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Téléversement...
                                </>
                              ) : selectedFile ? (
                                <>
                                  <Camera className="h-4 w-4" />
                                  Confirmer la photo
                                </>
                              ) : (
                                <>
                                  <Upload className="h-4 w-4" />
                                  Choisir une photo
                                </>
                              )}
                            </Button>

                            {selectedFile && !uploadPhotoMutation.isPending && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedFile(null);
                                  setPreviewUrl("");
                                  if (fileInputRef.current) fileInputRef.current.value = "";
                                }}
                                className="text-muted-foreground hover:text-foreground"
                                data-testid="button-change-photo"
                              >
                                Changer de photo
                              </Button>
                            )}

                            {!selectedFile && professional?.profilePicture && !imageError && (
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => deletePhotoMutation.mutate()}
                                disabled={deletePhotoMutation.isPending}
                                className="gap-2"
                                data-testid="button-delete-photo"
                              >
                                {deletePhotoMutation.isPending ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Suppression...
                                  </>
                                ) : (
                                  <>
                                    <Trash2 className="h-4 w-4" />
                                    Supprimer
                                  </>
                                )}
                              </Button>
                            )}
                          </div>

                          {selectedFile && (
                            <p className="text-sm text-muted-foreground break-words">
                              Fichier sélectionné : {selectedFile.name}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs font-medium">Instructions :</p>
                          <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                            <li className="break-words">Format portrait (3:4), max 300 Ko</li>
                            <li className="break-words">JPEG, PNG, GIF, WebP acceptés</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input {...field} className="pl-10 bg-muted" data-testid="input-email" disabled />
                          </div>
                        </FormControl>
                        <p className="text-xs text-muted-foreground">L'email ne peut pas être modifié</p>
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
                            <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input {...field} className="pl-10" data-testid="input-phone" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Adresse</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input {...field} className="pl-10" data-testid="input-address" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ville</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-city" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="province"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Province</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-province">
                              <SelectValue placeholder="Sélectionnez" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {provinces.map((province) => (
                              <SelectItem key={province} value={province}>
                                {province}
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
                    name="postalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Code postal</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-postalcode" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Votre pratique, spécialités..."
                          rows={4}
                          data-testid="input-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => form.reset()}
                    data-testid="button-cancel"
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    data-testid="button-save"
                  >
                    {updateProfileMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Briefcase className="h-4 w-4" />
              Informations professionnelles
            </CardTitle>
            <CardDescription className="text-xs">
              Ces informations sont affichées dans votre profil public
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Professions</p>
                <div className="flex flex-wrap gap-2">
                  {professional?.professions && professional.professions.length > 0 ? (
                    professional.professions.map((profession, index) => (
                      <Badge key={index} variant="secondary" data-testid={`badge-profession-${index}`}>
                        {profession}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucune profession définie</p>
                  )}
                </div>
              </div>
              {professional?.speciality && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Spécialité</p>
                  <p className="text-lg" data-testid="text-speciality">{professional.speciality}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Dialog open={isEditingProfessions} onOpenChange={setIsEditingProfessions}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Modifier vos professions</DialogTitle>
              <DialogDescription>
                Sélectionnez une ou plusieurs professions. Vous serez visible dans les résultats de recherche pour chaque profession sélectionnée.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 mb-4 p-3 bg-muted rounded-lg">
                {selectedProfessions.length > 0 ? (
                  selectedProfessions.map((profession) => (
                    <Badge key={profession} variant="default" className="gap-1" data-testid={`selected-${profession}`}>
                      {profession}
                      <X 
                        className="h-3 w-3 cursor-pointer hover:text-destructive" 
                        onClick={() => toggleProfession(profession)}
                      />
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune profession sélectionnée</p>
                )}
              </div>

              <p className="text-sm font-medium mb-2">Professions disponibles :</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-96 overflow-y-auto p-2 border rounded-lg">
                {HEALTH_PROFESSIONS.map((profession) => (
                  <Button
                    key={profession}
                    variant={selectedProfessions.includes(profession) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleProfession(profession)}
                    className="justify-start"
                    data-testid={`profession-option-${profession}`}
                  >
                    {profession}
                  </Button>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsEditingProfessions(false)}
                data-testid="button-cancel-professions"
              >
                Annuler
              </Button>
              <Button 
                onClick={handleSaveProfessions}
                disabled={updateProfessionsMutation.isPending || selectedProfessions.length === 0}
                data-testid="button-save-professions"
              >
                {updateProfessionsMutation.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}
