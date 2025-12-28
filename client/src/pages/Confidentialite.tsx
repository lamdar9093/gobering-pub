import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Confidentialite() {
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
              Politique de Confidentialité
            </CardTitle>
            <p className="text-center text-muted-foreground mt-2">
              Dernière mise à jour : {new Date().toLocaleDateString('fr-CA')}
            </p>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-6 text-sm">
                <section>
                  <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
                  <p className="text-muted-foreground mb-2">
                    Chez Gobering, service développé par Jamono, nous prenons très au sérieux la protection de vos renseignements personnels.
                  </p>
                  <p className="text-muted-foreground mb-2">
                    La présente Politique de Confidentialité décrit comment nous collectons, utilisons, divulguons et protégeons vos données 
                    personnelles conformément aux lois canadiennes applicables, notamment :
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                    <li>La Loi sur la protection des renseignements personnels et les documents électroniques (LPRPDE)</li>
                    <li>La Loi 25 (Loi modernisant des dispositions législatives en matière de protection des renseignements personnels) au Québec</li>
                    <li>Les lois provinciales applicables en matière de protection des données de santé</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">2. Identité du responsable</h2>
                  <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                    <p className="text-muted-foreground"><strong>Nom de l'organisation :</strong> Jamono</p>
                    <p className="text-muted-foreground"><strong>Service :</strong> Gobering</p>
                    <p className="text-muted-foreground"><strong>Siège social :</strong> Québec, Canada</p>
                    <p className="text-muted-foreground"><strong>Contact :</strong> Lamine Dieng</p>
                    <p className="text-muted-foreground"><strong>Email :</strong> operations@gobering.com</p>
                  </div>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">3. Hébergement des données</h2>
                  <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                    <p className="text-muted-foreground"><strong>Hébergeur :</strong> OVHcloud Canada</p>
                    <p className="text-muted-foreground"><strong>Localisation :</strong> Toronto (Cambridge), Ontario, Canada</p>
                    <p className="text-muted-foreground mb-2">
                      Toutes vos données sont hébergées au Canada, conformément aux exigences de souveraineté des données.
                    </p>
                  </div>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">4. Renseignements personnels collectés</h2>
                  <h3 className="text-lg font-semibold mt-4 mb-2">4.1 Pour les patients</h3>
                  <p className="text-muted-foreground mb-2">Nous collectons les renseignements suivants :</p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                    <li><strong>Identité :</strong> Prénom, nom</li>
                    <li><strong>Coordonnées :</strong> Email, numéro de téléphone</li>
                    <li><strong>Rendez-vous :</strong> Dates, heures, services demandés, professionnels consultés</li>
                    <li><strong>Bénéficiaires :</strong> Nom et relation avec le réservant (pour les rendez-vous pris pour autrui)</li>
                  </ul>

                  <h3 className="text-lg font-semibold mt-4 mb-2">4.2 Pour les professionnels</h3>
                  <p className="text-muted-foreground mb-2">Nous collectons les renseignements suivants :</p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                    <li><strong>Identité :</strong> Prénom, nom</li>
                    <li><strong>Coordonnées :</strong> Email, numéro de téléphone, adresse professionnelle</li>
                    <li><strong>Informations professionnelles :</strong> Profession, spécialité, description, services offerts</li>
                    <li><strong>Photo de profil :</strong> Image téléchargée volontairement</li>
                    <li><strong>Disponibilités :</strong> Horaires et calendrier</li>
                  </ul>

                  <h3 className="text-lg font-semibold mt-4 mb-2">4.3 Données techniques</h3>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                    <li>Adresse IP</li>
                    <li>Type de navigateur et appareil</li>
                    <li>Pages visitées et durée des sessions</li>
                    <li>Données de connexion et d'authentification (mots de passe chiffrés)</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">5. Finalités du traitement</h2>
                  <p className="text-muted-foreground mb-2">Vos renseignements personnels sont utilisés pour :</p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                    <li>Créer et gérer votre compte utilisateur</li>
                    <li>Faciliter la prise de rendez-vous entre patients et professionnels</li>
                    <li>Envoyer des confirmations, rappels et notifications de rendez-vous</li>
                    <li>Gérer les annulations et la liste d'attente</li>
                    <li>Permettre aux professionnels de gérer leurs calendriers et leurs patients</li>
                    <li>Améliorer et personnaliser nos services</li>
                    <li>Assurer la sécurité et prévenir la fraude</li>
                    <li>Respecter nos obligations légales</li>
                    <li>Communiquer avec vous concernant le service</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">6. Base légale du traitement</h2>
                  <p className="text-muted-foreground mb-2">Le traitement de vos données repose sur :</p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                    <li><strong>Votre consentement :</strong> En créant un compte et en utilisant nos services</li>
                    <li><strong>L'exécution du contrat :</strong> Pour fournir les services que vous avez demandés</li>
                    <li><strong>Obligations légales :</strong> Pour nous conformer aux lois applicables</li>
                    <li><strong>Intérêts légitimes :</strong> Pour améliorer nos services et assurer la sécurité</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">7. Partage des renseignements</h2>
                  <h3 className="text-lg font-semibold mt-4 mb-2">7.1 Avec les professionnels de santé</h3>
                  <p className="text-muted-foreground mb-2">
                    Lorsque vous prenez un rendez-vous, vos informations de contact et les détails du rendez-vous sont partagés avec 
                    le professionnel concerné pour lui permettre de vous recevoir et de communiquer avec vous.
                  </p>

                  <h3 className="text-lg font-semibold mt-4 mb-2">7.2 Avec des tiers</h3>
                  <p className="text-muted-foreground mb-2">
                    Nous ne vendons, ne louons ni n'échangeons vos renseignements personnels avec des tiers à des fins commerciales.
                  </p>
                  <p className="text-muted-foreground mb-2">
                    Nous pouvons partager vos données avec :
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                    <li><strong>Fournisseurs de services :</strong> OVHcloud (hébergement), services d'email transactionnel</li>
                    <li><strong>Autorités légales :</strong> Si requis par la loi ou pour protéger nos droits</li>
                  </ul>

                  <h3 className="text-lg font-semibold mt-4 mb-2">7.3 Transferts internationaux</h3>
                  <p className="text-muted-foreground">
                    Vos données sont hébergées au Canada et ne font l'objet d'aucun transfert international.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">8. Durée de conservation</h2>
                  <p className="text-muted-foreground mb-2">
                    Nous conservons vos renseignements personnels conformément aux exigences légales applicables :
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                    <li><strong>Comptes actifs :</strong> Pendant toute la durée d'utilisation du service</li>
                    <li><strong>Comptes fermés :</strong> Les données sont supprimées ou anonymisées dans un délai raisonnable après la fermeture, 
                    sauf obligation légale de conservation</li>
                    <li><strong>Dossiers de santé :</strong> Conformément aux délais prescrits par les lois provinciales de protection 
                    de la santé (généralement 5 à 10 ans après le dernier contact)</li>
                    <li><strong>Données de facturation :</strong> Conformément aux lois fiscales (généralement 7 ans)</li>
                  </ul>
                  <p className="text-muted-foreground mt-2">
                    Après ces périodes, vos données sont définitivement supprimées ou anonymisées de manière irréversible.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">9. Sécurité des données</h2>
                  <p className="text-muted-foreground mb-2">
                    Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles appropriées pour protéger vos 
                    renseignements personnels contre tout accès, utilisation, divulgation, modification ou destruction non autorisés :
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                    <li>Chiffrement des données en transit (HTTPS/TLS)</li>
                    <li>Chiffrement des mots de passe (bcrypt)</li>
                    <li>Hébergement sécurisé au Canada (OVHcloud)</li>
                    <li>Contrôles d'accès et authentification</li>
                    <li>Sauvegardes régulières</li>
                    <li>Surveillance et détection des incidents de sécurité</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">10. Vos droits</h2>
                  <p className="text-muted-foreground mb-2">
                    Conformément aux lois canadiennes sur la protection des données, vous disposez des droits suivants :
                  </p>
                  
                  <h3 className="text-lg font-semibold mt-4 mb-2">10.1 Droit d'accès</h3>
                  <p className="text-muted-foreground mb-2">
                    Vous pouvez demander l'accès aux renseignements personnels que nous détenons à votre sujet.
                  </p>

                  <h3 className="text-lg font-semibold mt-4 mb-2">10.2 Droit de rectification</h3>
                  <p className="text-muted-foreground mb-2">
                    Vous pouvez corriger ou mettre à jour vos informations directement depuis votre profil ou en nous contactant.
                  </p>

                  <h3 className="text-lg font-semibold mt-4 mb-2">10.3 Droit à l'effacement</h3>
                  <p className="text-muted-foreground mb-2">
                    Vous pouvez demander la suppression de votre compte et de vos données personnelles depuis les paramètres de votre profil. 
                    Certaines données peuvent être conservées pour respecter nos obligations légales.
                  </p>

                  <h3 className="text-lg font-semibold mt-4 mb-2">10.4 Droit de retirer le consentement</h3>
                  <p className="text-muted-foreground mb-2">
                    Vous pouvez retirer votre consentement au traitement de vos données à tout moment, sous réserve de nos 
                    obligations légales et contractuelles.
                  </p>

                  <h3 className="text-lg font-semibold mt-4 mb-2">10.5 Droit de portabilité</h3>
                  <p className="text-muted-foreground mb-2">
                    Vous pouvez demander une copie de vos données dans un format structuré et couramment utilisé.
                  </p>

                  <h3 className="text-lg font-semibold mt-4 mb-2">10.6 Droit d'opposition et de restriction</h3>
                  <p className="text-muted-foreground mb-2">
                    Vous pouvez vous opposer à certains traitements de vos données ou en demander la limitation.
                  </p>

                  <p className="text-muted-foreground mt-4">
                    Pour exercer ces droits, contactez-nous à : <strong>operations@gobering.com</strong>
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">11. Cookies et technologies similaires</h2>
                  <p className="text-muted-foreground mb-2">
                    <strong>État actuel :</strong> Gobering n'utilise actuellement aucun cookie de suivi, de publicité ou d'analytique tiers.
                  </p>
                  <p className="text-muted-foreground mb-2">
                    Nous utilisons uniquement des cookies essentiels au fonctionnement de la plateforme, notamment pour :
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                    <li>Maintenir votre session de connexion</li>
                    <li>Assurer la sécurité et prévenir la fraude</li>
                    <li>Mémoriser vos préférences d'interface</li>
                  </ul>
                  <p className="text-muted-foreground mt-2">
                    Si nous devions utiliser des cookies analytiques ou marketing à l'avenir, nous vous en informerons et 
                    demanderons votre consentement conformément à la loi.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">12. Âge minimum</h2>
                  <p className="text-muted-foreground mb-2">
                    Gobering est destiné aux personnes ayant atteint l'âge de la majorité dans leur province de résidence 
                    (18 ans ou 19 ans selon la province).
                  </p>
                  <p className="text-muted-foreground">
                    Les mineurs peuvent utiliser la plateforme sous la supervision et avec le consentement d'un parent ou tuteur légal. 
                    Nous ne collectons pas sciemment de renseignements personnels auprès de mineurs sans consentement parental.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">13. Modifications de la politique</h2>
                  <p className="text-muted-foreground mb-2">
                    Nous pouvons mettre à jour cette Politique de Confidentialité périodiquement pour refléter les changements 
                    dans nos pratiques ou pour des raisons opérationnelles, légales ou réglementaires.
                  </p>
                  <p className="text-muted-foreground">
                    La date de « dernière mise à jour » en haut de ce document indique quand la politique a été révisée pour la dernière fois. 
                    Nous vous encourageons à consulter régulièrement cette page.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">14. Plaintes et recours</h2>
                  <p className="text-muted-foreground mb-2">
                    Si vous avez des préoccupations concernant notre traitement de vos renseignements personnels, 
                    veuillez nous contacter à : <strong>operations@gobering.com</strong>
                  </p>
                  <p className="text-muted-foreground mb-2">
                    Si vous n'êtes pas satisfait de notre réponse, vous avez le droit de déposer une plainte auprès de l'autorité 
                    de protection des données compétente :
                  </p>
                  <div className="bg-muted/30 p-4 rounded-lg space-y-2 mt-2">
                    <p className="text-muted-foreground"><strong>Commission d'accès à l'information du Québec (CAI)</strong></p>
                    <p className="text-muted-foreground">Site web : www.cai.gouv.qc.ca</p>
                    <p className="text-muted-foreground">Téléphone : 1 888 528-7741</p>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg space-y-2 mt-2">
                    <p className="text-muted-foreground"><strong>Commissariat à la protection de la vie privée du Canada</strong></p>
                    <p className="text-muted-foreground">Site web : www.priv.gc.ca</p>
                    <p className="text-muted-foreground">Téléphone : 1 800 282-1376</p>
                  </div>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">15. Contact</h2>
                  <p className="text-muted-foreground mb-2">
                    Pour toute question concernant cette Politique de Confidentialité ou pour exercer vos droits, contactez-nous :
                  </p>
                  <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                    <p className="text-muted-foreground"><strong>Email :</strong> operations@gobering.com</p>
                    <p className="text-muted-foreground"><strong>Responsable :</strong> Lamine Dieng</p>
                    <p className="text-muted-foreground"><strong>Société :</strong> Jamono</p>
                    <p className="text-muted-foreground"><strong>Service :</strong> Gobering</p>
                    <p className="text-muted-foreground"><strong>Siège social :</strong> Québec, Canada</p>
                  </div>
                </section>

                <section className="border-t pt-6 mt-8">
                  <p className="text-xs text-muted-foreground italic">
                    En utilisant Gobering, vous reconnaissez avoir lu, compris et accepté l'intégralité de cette Politique de Confidentialité.
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
