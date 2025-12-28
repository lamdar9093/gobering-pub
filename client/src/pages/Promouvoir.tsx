import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { WidgetConfiguration, Professional, ClinicMember } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Check, Copy, Globe, Monitor, Smartphone, ExternalLink, Eye, EyeOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import DashboardLayout from "@/components/DashboardLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";

const widgetFormSchema = z.object({
  slug: z.string().min(3, "Le slug doit contenir au moins 3 caractères")
    .regex(/^[a-z0-9-]+$/, "Le slug ne peut contenir que des lettres minuscules, chiffres et tirets"),
  displayName: z.string().optional(),
  bannerImage: z.string().url("URL invalide").optional().or(z.literal("")),
  logoImage: z.string().url("URL invalide").optional().or(z.literal("")),
  buttonLabel: z.string().min(1, "Le libellé est requis"),
  buttonColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Couleur hexadécimale invalide"),
  allowAnyProfessional: z.boolean(),
  isActive: z.boolean(),
});

type WidgetFormValues = z.infer<typeof widgetFormSchema>;

export default function Promouvoir() {
  const { toast } = useToast();
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  const { data: professional, isLoading: isProfessionalLoading } = useQuery<Professional>({
    queryKey: ["/api/auth/me"],
  });

  const { data: clinicMembers } = useQuery<ClinicMember[]>({
    queryKey: ["/api/clinics", professional?.clinicId, "members"],
    enabled: !!professional?.clinicId,
  });

  const { data: widget, isLoading } = useQuery<WidgetConfiguration | null>({
    queryKey: ["/api/professional/widget"],
    queryFn: async () => {
      const res = await fetch("/api/professional/widget", { credentials: "include" });
      if (res.status === 404) {
        return null;
      }
      if (!res.ok) {
        throw new Error(`${res.status}: ${await res.text()}`);
      }
      return res.json();
    },
    retry: false,
  });

  const form = useForm<WidgetFormValues>({
    resolver: zodResolver(widgetFormSchema),
    defaultValues: {
      slug: "",
      displayName: "",
      bannerImage: "",
      logoImage: "",
      buttonLabel: "Prendre un rendez-vous",
      buttonColor: "#2196F3",
      allowAnyProfessional: true,
      isActive: true,
    },
  });

  useEffect(() => {
    if (widget) {
      form.reset({
        slug: widget.slug || "",
        displayName: widget.displayName || "",
        bannerImage: widget.bannerImage || "",
        logoImage: widget.logoImage || "",
        buttonLabel: widget.buttonLabel || "Prendre un rendez-vous",
        buttonColor: widget.buttonColor || "#2196F3",
        allowAnyProfessional: widget.allowAnyProfessional ?? true,
        isActive: widget.isActive ?? true,
      });
    }
  }, [widget, form]);

  const createMutation = useMutation({
    mutationFn: async (data: WidgetFormValues) => {
      const res = await apiRequest("POST", "/api/professional/widget", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/professional/widget"] });
      toast({
        title: "Widget créé",
        description: "Votre bouton de réservation a été créé avec succès.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer le widget",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: WidgetFormValues) => {
      const res = await apiRequest("PATCH", "/api/professional/widget", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/professional/widget"] });
      toast({
        title: "Widget mis à jour",
        description: "Votre bouton de réservation a été mis à jour avec succès.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour le widget",
        variant: "destructive",
      });
    },
  });

  const updateVisibilityMutation = useMutation({
    mutationFn: async (publiclyVisible: boolean) => {
      const res = await apiRequest("PATCH", "/api/professional/settings", { publiclyVisible, applyToClinic: true });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinics"] });
      toast({
        title: "Visibilité mise à jour",
        description: "La visibilité a été mise à jour pour tous les professionnels de votre clinique.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour la visibilité",
        variant: "destructive",
      });
    },
  });

  const checkSlugAvailability = async (slug: string) => {
    if (slug.length < 3 || !/^[a-z0-9-]+$/.test(slug)) {
      setSlugAvailable(null);
      return;
    }

    if (widget && slug === widget.slug) {
      setSlugAvailable(true);
      return;
    }

    setSlugChecking(true);
    try {
      const response = await fetch(`/api/professional/widget/check-slug/${slug}`);
      const data = await response.json();
      setSlugAvailable(data.available);
    } catch (error) {
      console.error("Error checking slug:", error);
      setSlugAvailable(null);
    } finally {
      setSlugChecking(false);
    }
  };

  const onSubmit = (data: WidgetFormValues) => {
    if (widget) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const bookingUrl = widget?.slug ? `${window.location.origin}/rdv/${widget.slug}` : "";
  
  const buttonEmbedCode = widget?.slug 
    ? `<a href="${window.location.origin}/rdv/${widget.slug}" target="_blank" style="display: inline-block; padding: 12px 24px; background-color: ${form.watch('buttonColor')}; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">${form.watch('buttonLabel')}</a>`
    : "";

  const iframeEmbedCode = widget?.slug
    ? `<iframe src="${window.location.origin}/rdv/${widget.slug}" width="100%" height="800" frameborder="0" style="border-radius: 8px;"></iframe>`
    : "";

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    toast({
      title: "Copié !",
      description: "Le code a été copié dans le presse-papiers.",
    });
  };

  if (isLoading || isProfessionalLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Hero Section */}
        <div className="text-center space-y-2 py-3">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-medium">
            <Globe className="h-3 w-3" />
            Promotion en ligne
          </div>
          <h1 className="text-xl md:text-2xl font-bold">Vous avez un site web?</h1>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
            Créez votre bouton <span className="text-primary font-semibold">"Prendre un rendez-vous"</span> et intégrez-le en quelques clics
          </p>
        </div>

        {/* Visibilité publique */}
        <Card className="max-w-3xl mx-auto">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              {professional?.publiclyVisible ? (
                <Eye className="h-4 w-4 text-primary" />
              ) : (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
              Visibilité sur Gobering
            </CardTitle>
            <CardDescription className="text-xs">
              Contrôlez si votre profil apparaît dans les recherches publiques sur Gobering
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1 flex-1">
                <div className="font-medium">
                  {professional?.publiclyVisible ? "Visible dans les recherches" : "Masqué des recherches"}
                </div>
                <p className="text-sm text-muted-foreground">
                  {professional?.publiclyVisible 
                    ? "Votre profil apparaît lorsque les patients recherchent des professionnels sur Gobering"
                    : "Votre profil n'apparaît pas dans les recherches publiques. Idéal si vous utilisez uniquement vos widgets de réservation."}
                </p>
                {professional?.clinicId && clinicMembers && clinicMembers.some(m => m.professionalId === professional.id && m.role === 'Admin') && (
                  <p className="text-xs text-primary font-medium mt-2">
                    {clinicMembers.filter(m => m.role === 'Professionnel' || m.role === 'Admin').length > 1 
                      ? `Ce changement s'appliquera automatiquement aux ${clinicMembers.filter(m => m.role === 'Professionnel' || m.role === 'Admin').length} professionnels de votre clinique`
                      : ""}
                  </p>
                )}
              </div>
              <Switch
                checked={professional?.publiclyVisible ?? true}
                onCheckedChange={(checked) => updateVisibilityMutation.mutate(checked)}
                disabled={updateVisibilityMutation.isPending}
                data-testid="switch-publicly-visible"
              />
            </div>
            
            {!professional?.publiclyVisible && (
              <Alert>
                <AlertDescription className="text-sm">
                  <strong>Note :</strong> Même masqué, vos widgets de réservation et votre page publique restent accessibles via leurs liens directs.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Split Screen Layout */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Left: Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Aperçu en temps réel</h2>
              <div className="flex gap-2">
                <Button
                  variant={previewDevice === 'desktop' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPreviewDevice('desktop')}
                  data-testid="button-preview-desktop"
                >
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button
                  variant={previewDevice === 'mobile' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPreviewDevice('mobile')}
                  data-testid="button-preview-mobile"
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Device Preview */}
            <div className="relative flex justify-center">
              {previewDevice === 'desktop' ? (
                <div className="relative w-full max-w-3xl">
                  {/* Laptop Frame */}
                  <div className="bg-gray-900 rounded-t-xl p-3 shadow-2xl">
                    {/* Screen */}
                    <div className="bg-white rounded-t-lg overflow-hidden" style={{ height: '400px' }}>
                      {/* Simulated Clinic Website */}
                      <div className="h-full flex flex-col">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                              <span className="text-blue-600 font-bold text-lg">C</span>
                            </div>
                            <div>
                              <h3 className="font-bold text-sm">Clinique Santé Plus</h3>
                              <p className="text-xs text-blue-100">Votre santé, notre priorité</p>
                            </div>
                          </div>
                          <nav className="flex gap-6 text-sm">
                            <span className="text-blue-100">Accueil</span>
                            <span className="text-blue-100">Services</span>
                            <span className="text-blue-100">Équipe</span>
                            <span className="text-blue-100">Contact</span>
                          </nav>
                        </div>
                        
                        {/* Hero Section */}
                        <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-gray-50 to-white px-8">
                          <div className="text-center space-y-4 max-w-xl">
                            <h1 className="text-2xl font-bold text-gray-900">
                              Des soins de qualité pour toute la famille
                            </h1>
                            <p className="text-gray-600 text-sm">
                              Notre équipe de professionnels est là pour vous accompagner dans votre parcours de santé.
                            </p>
                            <a
                              href="#"
                              style={{
                                display: 'inline-block',
                                padding: '14px 32px',
                                backgroundColor: form.watch('buttonColor') || '#2196F3',
                                color: 'white',
                                textDecoration: 'none',
                                borderRadius: '8px',
                                fontWeight: 600,
                                fontSize: '16px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                              }}
                              data-testid="preview-button"
                            >
                              {form.watch('buttonLabel') || 'Prendre un rendez-vous'}
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Laptop Base */}
                  <div className="bg-gray-900 h-4 rounded-b-xl shadow-lg"></div>
                  <div className="bg-gray-800 h-1.5 mx-auto w-48 rounded-b-lg"></div>
                </div>
              ) : (
                <div className="relative" style={{ width: '320px' }}>
                  {/* Mobile Frame */}
                  <div className="bg-gray-900 rounded-[2.5rem] p-3 shadow-2xl">
                    {/* Screen */}
                    <div className="bg-white rounded-[2rem] overflow-hidden" style={{ height: '600px' }}>
                      {/* Status Bar */}
                      <div className="bg-gradient-to-r from-blue-600 to-blue-700 h-8 flex items-center justify-between px-6 text-white text-xs">
                        <span>9:41</span>
                        <div className="flex gap-1 items-center">
                          <div className="w-4 h-3 border border-white rounded-sm"></div>
                          <div className="w-3 h-3 border border-white rounded-full"></div>
                        </div>
                      </div>
                      
                      {/* Mobile Website Content */}
                      <div className="flex flex-col h-full">
                        {/* Mobile Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                              <span className="text-blue-600 font-bold text-sm">C</span>
                            </div>
                            <div>
                              <h3 className="font-bold text-xs">Clinique Santé Plus</h3>
                              <p className="text-[10px] text-blue-100">Votre santé, notre priorité</p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Mobile Hero */}
                        <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-gray-50 to-white px-6 py-8">
                          <div className="text-center space-y-3">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <h1 className="text-lg font-bold text-gray-900">
                              Des soins de qualité
                            </h1>
                            <p className="text-gray-600 text-xs leading-relaxed">
                              Notre équipe est là pour vous accompagner
                            </p>
                            <a
                              href="#"
                              style={{
                                display: 'inline-block',
                                padding: '12px 24px',
                                backgroundColor: form.watch('buttonColor') || '#2196F3',
                                color: 'white',
                                textDecoration: 'none',
                                borderRadius: '8px',
                                fontWeight: 600,
                                fontSize: '14px',
                                cursor: 'pointer',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                              }}
                              data-testid="preview-button-mobile"
                            >
                              {form.watch('buttonLabel') || 'Prendre un rendez-vous'}
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Configuration */}
          <div>
            <Tabs defaultValue="configuration" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="configuration" data-testid="tab-configuration">
                  Configuration
                </TabsTrigger>
                <TabsTrigger value="integration" data-testid="tab-integration" disabled={!widget}>
                  Intégration
                </TabsTrigger>
              </TabsList>

              <TabsContent value="configuration" className="mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Personnalisez votre bouton</CardTitle>
                    <CardDescription className="text-xs">
                      Configurez l'apparence et le comportement de votre bouton de réservation
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="slug"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>URL de votre page de réservation</FormLabel>
                              <FormControl>
                                <div className="flex gap-2">
                                  <Input
                                    {...field}
                                    placeholder="mon-cabinet"
                                    data-testid="input-slug"
                                    onChange={(e) => {
                                      field.onChange(e);
                                      checkSlugAvailability(e.target.value);
                                    }}
                                  />
                                  {slugChecking && <Loader2 className="h-5 w-5 animate-spin mt-2" />}
                                  {slugAvailable === true && <Check className="h-5 w-5 text-green-500 mt-2" />}
                                  {slugAvailable === false && <span className="text-red-500 text-sm mt-2">Déjà pris</span>}
                                </div>
                              </FormControl>
                              <FormDescription>
                                {window.location.origin}/rdv/{field.value || "votre-slug"}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="displayName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nom d'affichage</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Clinique de Santé Globale" data-testid="input-display-name" />
                              </FormControl>
                              <FormDescription>
                                Le nom qui apparaîtra sur votre page de réservation (laissez vide pour utiliser le nom de votre clinique/profil)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="buttonLabel"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Texte du bouton</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Prendre un rendez-vous" data-testid="input-button-label" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="buttonColor"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Couleur du bouton</FormLabel>
                              <FormControl>
                                <div className="flex gap-2">
                                  <Input {...field} type="color" className="w-20" data-testid="input-button-color" />
                                  <Input {...field} placeholder="#2196F3" className="flex-1" />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="allowAnyProfessional"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">
                                  Permettre "N'importe quel professionnel"
                                </FormLabel>
                                <FormDescription>
                                  Les clients pourront choisir le premier professionnel disponible
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="switch-allow-any-professional"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="isActive"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Widget actif</FormLabel>
                                <FormDescription>
                                  Activez ou désactivez votre widget de réservation
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="switch-is-active"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <Button
                          type="submit"
                          className="w-full"
                          disabled={createMutation.isPending || updateMutation.isPending || slugAvailable === false}
                          data-testid="button-save-widget"
                        >
                          {(createMutation.isPending || updateMutation.isPending) && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          {widget ? "Mettre à jour le bouton" : "Créer mon bouton"}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="integration" className="mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Intégrer à votre site web</CardTitle>
                    <CardDescription className="text-xs">
                      Choisissez la méthode d'intégration qui vous convient le mieux
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* URL directe */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <ExternalLink className="h-4 w-4" />
                        URL directe
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Partagez ce lien directement avec vos clients
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 rounded bg-muted px-3 py-2 text-sm">
                          {bookingUrl}
                        </code>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(bookingUrl)}
                          data-testid="button-copy-url"
                        >
                          {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* Bouton HTML */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold">Bouton HTML (lien externe)</h3>
                      <p className="text-sm text-muted-foreground">
                        Ajoutez un bouton cliquable qui ouvre la page de réservation dans un nouvel onglet
                      </p>
                      <div className="rounded-lg border p-4 bg-muted/50">
                        <code className="text-xs block mb-3 whitespace-pre-wrap break-all">
                          {buttonEmbedCode}
                        </code>
                        <Button
                          variant="outline"
                          onClick={() => copyToClipboard(buttonEmbedCode)}
                          data-testid="button-copy-button-code"
                        >
                          {copiedCode ? (
                            <>
                              <Check className="mr-2 h-4 w-4" />
                              Copié !
                            </>
                          ) : (
                            <>
                              <Copy className="mr-2 h-4 w-4" />
                              Copier le code
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* iFrame */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold">Intégration complète (iFrame)</h3>
                      <p className="text-sm text-muted-foreground">
                        Intégrez la page de réservation directement dans votre site
                      </p>
                      <div className="rounded-lg border p-4 bg-muted/50">
                        <code className="text-xs block mb-3 whitespace-pre-wrap break-all">
                          {iframeEmbedCode}
                        </code>
                        <Button
                          variant="outline"
                          onClick={() => copyToClipboard(iframeEmbedCode)}
                          data-testid="button-copy-iframe-code"
                        >
                          {copiedCode ? (
                            <>
                              <Check className="mr-2 h-4 w-4" />
                              Copié !
                            </>
                          ) : (
                            <>
                              <Copy className="mr-2 h-4 w-4" />
                              Copier le code
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Instructions */}
                    <div className="rounded-lg border p-4 bg-blue-50 dark:bg-blue-950">
                      <h4 className="font-semibold mb-2">💡 Comment intégrer ?</h4>
                      <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                        <li>Choisissez l'option qui convient (URL, bouton ou iFrame)</li>
                        <li>Copiez le code en cliquant sur "Copier le code"</li>
                        <li>Collez-le dans votre site web</li>
                        <li>C'est prêt ! Vos clients peuvent maintenant prendre rendez-vous</li>
                      </ol>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
