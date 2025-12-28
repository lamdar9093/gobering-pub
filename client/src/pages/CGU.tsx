import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function CGU() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Link href="/">
          <Button
            variant="ghost"
            className="mb-6"
            data-testid="button-back-home"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à l'accueil
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">
              Conditions Générales d'Utilisation
            </CardTitle>
            <p className="text-center text-muted-foreground mt-2">
              Dernière mise à jour : {new Date().toLocaleDateString('fr-CA')}
            </p>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-6 text-sm">
                <section>
                  <h2 className="text-xl font-semibold mb-3">1. Présentation du service</h2>
                  <p className="text-muted-foreground mb-2">
                    Gobering est une plateforme de prise de rendez-vous en ligne avec des professionnels de la santé et du bien-être, 
                    exploitée par Jamono, société dont le siège social est situé au Québec, Canada.
                  </p>
                  <p className="text-muted-foreground">
                    Le service permet aux patients de rechercher et de prendre rendez-vous avec des professionnels de santé, 
                    et aux professionnels de gérer leurs disponibilités et rendez-vous.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">2. Acceptation des conditions</h2>
                  <p className="text-muted-foreground mb-2">
                    En créant un compte ou en utilisant Gobering, vous acceptez sans réserve les présentes Conditions Générales d'Utilisation.
                  </p>
                  <p className="text-muted-foreground">
                    Si vous n'acceptez pas ces conditions, vous ne devez pas utiliser la plateforme.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">3. Inscription et compte utilisateur</h2>
                  <h3 className="text-lg font-semibold mt-4 mb-2">3.1 Conditions d'inscription</h3>
                  <p className="text-muted-foreground mb-2">
                    Pour utiliser Gobering, vous devez avoir au moins 18 ans ou l'âge de la majorité dans votre province de résidence.
                  </p>
                  <p className="text-muted-foreground mb-2">
                    Les mineurs peuvent utiliser la plateforme sous la supervision et avec le consentement d'un parent ou tuteur légal.
                  </p>
                  
                  <h3 className="text-lg font-semibold mt-4 mb-2">3.2 Informations de compte</h3>
                  <p className="text-muted-foreground mb-2">
                    Vous vous engagez à fournir des informations exactes, complètes et à jour lors de votre inscription.
                  </p>
                  <p className="text-muted-foreground">
                    Vous êtes responsable de la confidentialité de vos identifiants de connexion et de toutes les activités effectuées 
                    depuis votre compte.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">4. Utilisation du service</h2>
                  <h3 className="text-lg font-semibold mt-4 mb-2">4.1 Pour les patients</h3>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                    <li>Rechercher des professionnels de santé par profession et localisation</li>
                    <li>Consulter les disponibilités et prendre rendez-vous en ligne</li>
                    <li>Gérer vos rendez-vous (annulation, reprogrammation)</li>
                    <li>S'inscrire sur liste d'attente si aucun créneau n'est disponible</li>
                    <li>Recevoir des notifications par email concernant vos rendez-vous</li>
                  </ul>

                  <h3 className="text-lg font-semibold mt-4 mb-2">4.2 Pour les professionnels</h3>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                    <li>Créer et gérer votre profil professionnel</li>
                    <li>Définir vos services, tarifs et disponibilités</li>
                    <li>Gérer vos rendez-vous et votre calendrier</li>
                    <li>Accéder aux informations de vos patients</li>
                    <li>Créer des widgets de réservation pour votre site web</li>
                  </ul>

                  <h3 className="text-lg font-semibold mt-4 mb-2">4.3 Usages interdits</h3>
                  <p className="text-muted-foreground mb-2">Vous vous engagez à ne pas :</p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                    <li>Utiliser la plateforme à des fins illégales ou non autorisées</li>
                    <li>Publier du contenu diffamatoire, offensant ou inapproprié</li>
                    <li>Tenter d'accéder de manière non autorisée aux systèmes ou données</li>
                    <li>Perturber le fonctionnement normal de la plateforme</li>
                    <li>Utiliser des robots, scripts ou moyens automatisés non autorisés</li>
                    <li>Usurper l'identité d'une autre personne ou entité</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">5. Rendez-vous et annulations</h2>
                  <h3 className="text-lg font-semibold mt-4 mb-2">5.1 Confirmation de rendez-vous</h3>
                  <p className="text-muted-foreground mb-2">
                    Lorsque vous prenez un rendez-vous, vous recevez une confirmation par email contenant les détails du rendez-vous 
                    et un lien d'annulation sécurisé.
                  </p>

                  <h3 className="text-lg font-semibold mt-4 mb-2">5.2 Annulation</h3>
                  <p className="text-muted-foreground mb-2">
                    Les patients et professionnels peuvent annuler un rendez-vous via la plateforme ou le lien d'annulation envoyé par email.
                  </p>
                  <p className="text-muted-foreground mb-2">
                    Les politiques d'annulation spécifiques (délais, frais) sont définies par chaque professionnel.
                  </p>

                  <h3 className="text-lg font-semibold mt-4 mb-2">5.3 Liste d'attente</h3>
                  <p className="text-muted-foreground">
                    Si aucun créneau n'est disponible, vous pouvez vous inscrire sur liste d'attente. Vous serez notifié par email 
                    si un créneau se libère et disposerez de 24 heures pour le réserver en priorité.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">6. Responsabilités</h2>
                  <h3 className="text-lg font-semibold mt-4 mb-2">6.1 Responsabilité de Gobering</h3>
                  <p className="text-muted-foreground mb-2">
                    Gobering agit uniquement comme intermédiaire technologique entre patients et professionnels de santé.
                  </p>
                  <p className="text-muted-foreground mb-2">
                    Nous ne sommes pas responsables de :
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                    <li>La qualité, la sécurité ou la légalité des services fournis par les professionnels</li>
                    <li>L'exactitude des informations fournies par les professionnels ou patients</li>
                    <li>Les litiges entre professionnels et patients</li>
                    <li>Les rendez-vous non honorés ou annulés</li>
                  </ul>

                  <h3 className="text-lg font-semibold mt-4 mb-2">6.2 Responsabilité des professionnels</h3>
                  <p className="text-muted-foreground mb-2">
                    Les professionnels de santé sont seuls responsables de :
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                    <li>La qualité et la légalité de leurs services</li>
                    <li>Leurs qualifications et licences professionnelles</li>
                    <li>Le respect du secret médical et des normes déontologiques</li>
                    <li>L'exactitude des informations publiées sur leur profil</li>
                  </ul>

                  <h3 className="text-lg font-semibold mt-4 mb-2">6.3 Responsabilité des patients</h3>
                  <p className="text-muted-foreground">
                    Les patients sont responsables de fournir des informations exactes et de respecter les rendez-vous pris ou 
                    de les annuler dans les délais appropriés.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">7. Propriété intellectuelle</h2>
                  <p className="text-muted-foreground mb-2">
                    Tout le contenu de la plateforme Gobering (textes, graphiques, logos, icônes, images, code source) est la 
                    propriété de Jamono ou de ses concédants de licence.
                  </p>
                  <p className="text-muted-foreground">
                    Vous ne pouvez pas reproduire, distribuer, modifier ou créer des œuvres dérivées sans autorisation écrite préalable.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">8. Modification du service</h2>
                  <p className="text-muted-foreground mb-2">
                    Nous nous réservons le droit de modifier, suspendre ou interrompre tout ou partie du service à tout moment, 
                    avec ou sans préavis.
                  </p>
                  <p className="text-muted-foreground">
                    Nous pouvons également modifier ces CGU à tout moment. Les modifications prendront effet dès leur publication 
                    sur la plateforme.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">9. Résiliation</h2>
                  <p className="text-muted-foreground mb-2">
                    Vous pouvez fermer votre compte à tout moment depuis les paramètres de votre profil.
                  </p>
                  <p className="text-muted-foreground">
                    Nous pouvons suspendre ou résilier votre compte si vous violez ces CGU ou pour toute autre raison à notre discrétion, 
                    avec ou sans préavis.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">10. Limitation de responsabilité</h2>
                  <p className="text-muted-foreground mb-2">
                    Dans toute la mesure permise par la loi applicable, Gobering et Jamono ne seront pas responsables des dommages 
                    indirects, accessoires, spéciaux, consécutifs ou punitifs.
                  </p>
                  <p className="text-muted-foreground">
                    Notre responsabilité totale envers vous ne dépassera en aucun cas les montants que vous avez payés à Gobering 
                    au cours des 12 derniers mois.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">11. Droit applicable et juridiction</h2>
                  <p className="text-muted-foreground mb-2">
                    Les présentes CGU sont régies par les lois de la province de Québec et les lois fédérales du Canada applicables.
                  </p>
                  <p className="text-muted-foreground">
                    Tout litige découlant de ou lié à ces CGU sera soumis à la juridiction exclusive des tribunaux du Québec, Canada.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">12. Contact</h2>
                  <p className="text-muted-foreground mb-2">
                    Pour toute question concernant ces Conditions Générales d'Utilisation, vous pouvez nous contacter :
                  </p>
                  <ul className="list-none space-y-2 text-muted-foreground ml-4">
                    <li><strong>Par email :</strong> operations@gobering.com</li>
                    <li><strong>Responsable :</strong> Lamine Dieng</li>
                    <li><strong>Société :</strong> Jamono</li>
                    <li><strong>Siège social :</strong> Québec, Canada</li>
                  </ul>
                </section>

                <section className="border-t pt-6 mt-8">
                  <p className="text-xs text-muted-foreground italic">
                    En utilisant Gobering, vous reconnaissez avoir lu, compris et accepté l'intégralité de ces Conditions Générales d'Utilisation.
                  </p>
                </section>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
