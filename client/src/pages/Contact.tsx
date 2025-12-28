import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CalendarCheck, Mail, Phone, User, MessageSquare, Loader2, CheckCircle2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

export default function Contact() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.message) {
      toast({
        title: "Champs manquants",
        description: "Veuillez remplir tous les champs obligatoires.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await apiRequest("POST", "/api/contact", formData);
      
      // Reset form
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        message: "",
      });

      // Show success dialog
      setShowSuccessDialog(true);
    } catch (error) {
      console.error("Contact form error:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue. Veuillez réessayer.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseSuccessDialog = () => {
    setShowSuccessDialog(false);
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Header */}
      <nav className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer">
                <CalendarCheck className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Gobering</h1>
              </div>
            </Link>
            <Link href="/">
              <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-white">
                Retour à l'accueil
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Contact Form Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Contactez-nous
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Une question ? Une suggestion ? Nous sommes là pour vous écouter.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-100 dark:border-gray-800 p-8 shadow-xl">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* First Name and Last Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    Prénom <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <Input
                      id="firstName"
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      placeholder="Jean"
                      className="pl-10 py-6 rounded-xl border-gray-200 dark:border-gray-700"
                      data-testid="input-firstname"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    Nom <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <Input
                      id="lastName"
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      placeholder="Tremblay"
                      className="pl-10 py-6 rounded-xl border-gray-200 dark:border-gray-700"
                      data-testid="input-lastname"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="j.tremblay@exemple.com"
                    className="pl-10 py-6 rounded-xl border-gray-200 dark:border-gray-700"
                    data-testid="input-email"
                    required
                  />
                </div>
              </div>

              {/* Phone (Optional) */}
              <div>
                <label htmlFor="phone" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Téléphone <span className="text-gray-400 text-xs">(optionnel)</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(514) 555-0123"
                    className="pl-10 py-6 rounded-xl border-gray-200 dark:border-gray-700"
                    data-testid="input-phone"
                  />
                </div>
              </div>

              {/* Message */}
              <div>
                <label htmlFor="message" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Message <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 text-gray-400 h-5 w-5" />
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Votre message..."
                    rows={6}
                    className="pl-10 pt-3 rounded-xl border-gray-200 dark:border-gray-700 resize-none"
                    data-testid="textarea-message"
                    required
                  />
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full gradient-button text-white py-6 text-base font-semibold hover:opacity-90 transition-all shadow-lg"
                data-testid="button-submit"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  "Envoyer le message"
                )}
              </Button>
            </form>
          </div>

          {/* Alternative Contact Info */}
          <div className="mt-12 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Vous pouvez aussi nous contacter directement par email :
            </p>
            <a
              href="mailto:operations@gobering.com"
              className="text-primary font-semibold hover:underline text-lg"
            >
              operations@gobering.com
            </a>
          </div>
        </div>
      </section>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={handleCloseSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-[#2196F3] to-[#1976D2] rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
            </div>
            <DialogTitle className="text-center text-2xl font-bold text-gray-900 dark:text-white">
              Message envoyé !
            </DialogTitle>
            <DialogDescription className="text-center text-base text-gray-600 dark:text-gray-400 pt-2">
              Nous avons bien reçu votre message et vous répondrons dans les plus brefs délais.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center mt-6">
            <Button
              onClick={handleCloseSuccessDialog}
              className="gradient-button text-white px-8 py-6 text-base font-semibold hover:opacity-90 transition-all"
              data-testid="button-return-home"
            >
              Retour à l'accueil
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
