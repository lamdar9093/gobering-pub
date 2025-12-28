import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'Gobering <notifications@gobering.com>';

function getBaseUrl(): string {
  const isProduction = process.env.REPLIT_DEPLOYMENT === '1' || process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    return 'https://gobering.com';
  }
  
  return process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000';
}

export interface AppointmentEmailData {
  patientFirstName: string;
  patientLastName: string;
  patientEmail: string;
  patientPhone?: string;
  professionalFirstName: string;
  professionalLastName: string;
  professionalEmail: string;
  profession: string;
  appointmentDate: Date;
  appointmentTime: string;
  notes?: string;
  serviceName?: string;
  beneficiaryName?: string;
  beneficiaryRelation?: string;
  beneficiaryPhone?: string;
  beneficiaryEmail?: string;
}

export interface WelcomeEmailData {
  firstName: string;
  lastName: string;
  email: string;
  profession?: string;
}

export interface ProUpgradeEmailData {
  firstName: string;
  lastName: string;
  email: string;
}

export interface StarterUpgradeEmailData {
  firstName: string;
  lastName: string;
  email: string;
}

export interface FreePlanConfirmationEmailData {
  firstName: string;
  lastName: string;
  email: string;
}

export interface PasswordResetEmailData {
  email: string;
  firstName: string;
  resetToken: string;
  expiresAt: Date;
}

export interface EmailVerificationData {
  email: string;
  firstName: string;
  verificationToken: string;
}

export interface AppointmentEmailWithCancellation extends AppointmentEmailData {
  cancellationToken: string;
  cancellationDelayHours?: number;
}

export async function sendAppointmentConfirmationToPatient(data: AppointmentEmailWithCancellation) {
  const formattedDate = new Intl.DateTimeFormat('fr-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(data.appointmentDate);

  const cancellationLink = `${getBaseUrl()}/appointments/cancel/${data.cancellationToken}`;

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.patientEmail,
      subject: `Confirmation de rendez-vous - ${data.professionalFirstName} ${data.professionalLastName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2196F3, #1976D2); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Gobering</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Rendez-vous confirmé</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; color: #1f2937;">Bonjour ${data.patientFirstName},</p>
            
            <p style="font-size: 16px; color: #4b5563;">Votre rendez-vous a été confirmé avec succès.</p>
            
            ${data.beneficiaryName ? `
            <div style="background: linear-gradient(135deg, #f0f8ff, #e3f2fd); padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196F3;">
              <p style="margin: 0; color: #1f2937;"><strong>Rendez-vous pour :</strong> ${data.beneficiaryName}</p>
              ${data.beneficiaryRelation ? `<p style="margin: 5px 0 0 0; color: #4b5563;">Relation : ${data.beneficiaryRelation}</p>` : ''}
            </div>
            ` : ''}
            
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
              <h2 style="margin-top: 0; color: #1f2937; font-size: 18px;">Détails du rendez-vous</h2>
              <p style="color: #4b5563; margin: 8px 0;"><strong>Professionnel :</strong> ${data.professionalFirstName} ${data.professionalLastName}</p>
              <p style="color: #4b5563; margin: 8px 0;"><strong>Spécialité :</strong> ${data.profession}</p>
              ${data.serviceName ? `<p style="color: #4b5563; margin: 8px 0;"><strong>Service :</strong> ${data.serviceName}</p>` : ''}
              <p style="color: #4b5563; margin: 8px 0;"><strong>Date :</strong> ${formattedDate}</p>
              <p style="color: #4b5563; margin: 8px 0;"><strong>Heure :</strong> ${data.appointmentTime}</p>
              ${data.notes ? `<p style="color: #4b5563; margin: 8px 0;"><strong>Notes :</strong> ${data.notes}</p>` : ''}
            </div>
            
            <div style="background: linear-gradient(135deg, #fff3cd, #fef3c7); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <p style="margin: 0 0 15px 0; color: #92400e; font-weight: 600;">Besoin de modifier ou annuler ?</p>
              <p style="margin: 0; text-align: center;">
                <a href="${cancellationLink}" 
                   style="background: linear-gradient(135deg, #2196F3, #1976D2); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px;">
                  Annuler ou Modifier le rendez-vous
                </a>
              </p>
              ${data.cancellationDelayHours ? `
              <p style="margin: 15px 0 0 0; font-size: 13px; color: #92400e;">
                <strong>⏱️ Politique d'annulation :</strong> Toute annulation doit être effectuée au moins ${data.cancellationDelayHours}h à l'avance. 
                Les annulations tardives peuvent entraîner des frais.
              </p>
              ` : ''}
            </div>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Ceci est un email automatique, merci de ne pas y répondre.
            </p>
            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
              © ${new Date().getFullYear()} Gobering - Votre plateforme de prise de rendez-vous médicaux
            </p>
          </div>
        </div>
      `,
    });
    
    return result;
  } catch (error) {
    console.error('Error sending patient confirmation email:', error);
    throw error;
  }
}

export async function sendAppointmentNotificationToProfessional(data: AppointmentEmailData) {
  const formattedDate = new Intl.DateTimeFormat('fr-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(data.appointmentDate);

  // Determine if this is an appointment for someone else
  const isForSomeoneElse = !!data.beneficiaryName;

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.professionalEmail,
      subject: `Nouveau rendez-vous - ${isForSomeoneElse ? data.beneficiaryName : `${data.patientFirstName} ${data.patientLastName}`}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2196F3, #1976D2); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Gobering</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Nouveau rendez-vous</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; color: #1f2937;">Bonjour Dr ${data.professionalLastName},</p>
            
            <p style="font-size: 16px; color: #4b5563;">Vous avez un nouveau rendez-vous réservé via Gobering.</p>
            
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
              <h2 style="margin-top: 0; color: #1f2937; font-size: 18px;">Informations du rendez-vous</h2>
              ${isForSomeoneElse ? `
                <p style="color: #4b5563; margin: 8px 0;"><strong>Réservé par :</strong> ${data.patientFirstName} ${data.patientLastName}</p>
                <p style="color: #4b5563; margin: 8px 0;"><strong>Email :</strong> ${data.patientEmail}</p>
                ${data.patientPhone ? `<p style="color: #4b5563; margin: 8px 0;"><strong>Téléphone :</strong> ${data.patientPhone}</p>` : ''}
                <hr style="margin: 15px 0; border: 0; border-top: 1px solid #d1d5db;">
                <p style="color: #4b5563; margin: 8px 0;"><strong>Bénéficiaire :</strong> ${data.beneficiaryName}</p>
                ${data.beneficiaryRelation ? `<p style="color: #4b5563; margin: 8px 0;"><strong>Relation :</strong> ${data.beneficiaryRelation}</p>` : ''}
                ${data.beneficiaryEmail ? `<p style="color: #4b5563; margin: 8px 0;"><strong>Email du bénéficiaire :</strong> ${data.beneficiaryEmail}</p>` : ''}
                ${data.beneficiaryPhone ? `<p style="color: #4b5563; margin: 8px 0;"><strong>Téléphone du bénéficiaire :</strong> ${data.beneficiaryPhone}</p>` : ''}
              ` : `
                <p style="color: #4b5563; margin: 8px 0;"><strong>Patient :</strong> ${data.patientFirstName} ${data.patientLastName}</p>
                <p style="color: #4b5563; margin: 8px 0;"><strong>Email :</strong> ${data.patientEmail}</p>
                ${data.patientPhone ? `<p style="color: #4b5563; margin: 8px 0;"><strong>Téléphone :</strong> ${data.patientPhone}</p>` : ''}
              `}
              ${data.serviceName ? `<p style="color: #4b5563; margin: 8px 0;"><strong>Service :</strong> ${data.serviceName}</p>` : ''}
              <p style="color: #4b5563; margin: 8px 0;"><strong>Date :</strong> ${formattedDate}</p>
              <p style="color: #4b5563; margin: 8px 0;"><strong>Heure :</strong> ${data.appointmentTime}</p>
              ${data.notes ? `<p style="color: #4b5563; margin: 8px 0;"><strong>Notes du patient :</strong> ${data.notes}</p>` : ''}
            </div>
            
            <p style="text-align: center; margin: 20px 0;">
              <a href="${getBaseUrl()}/dashboard" 
                 style="background: linear-gradient(135deg, #2196F3, #1976D2); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px;">
                Voir dans votre espace professionnel
              </a>
            </p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Ceci est un email automatique, merci de ne pas y répondre.
            </p>
            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
              © ${new Date().getFullYear()} Gobering - Votre plateforme de prise de rendez-vous médicaux
            </p>
          </div>
        </div>
      `,
    });
    
    return result;
  } catch (error) {
    console.error('Error sending professional notification email:', error);
    throw error;
  }
}

export async function sendAppointmentReminder(data: AppointmentEmailData) {
  const formattedDate = new Intl.DateTimeFormat('fr-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(data.appointmentDate);

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.patientEmail,
      subject: `Rappel : Rendez-vous demain avec ${data.professionalFirstName} ${data.professionalLastName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2196F3, #1976D2); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Gobering</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Rappel de rendez-vous</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; color: #1f2937;">Bonjour ${data.patientFirstName},</p>
            
            <p style="font-size: 16px; color: #4b5563;">Ceci est un rappel pour votre rendez-vous de demain.</p>
            
            <div style="background: linear-gradient(135deg, #fff3cd, #fef3c7); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <h2 style="margin-top: 0; color: #92400e; font-size: 18px;">⏰ Rendez-vous demain</h2>
              <p style="color: #4b5563; margin: 8px 0;"><strong>Professionnel :</strong> ${data.professionalFirstName} ${data.professionalLastName}</p>
              <p style="color: #4b5563; margin: 8px 0;"><strong>Spécialité :</strong> ${data.profession}</p>
              <p style="color: #4b5563; margin: 8px 0;"><strong>Date :</strong> ${formattedDate}</p>
              <p style="color: #4b5563; margin: 8px 0;"><strong>Heure :</strong> ${data.appointmentTime}</p>
            </div>
            
            <p style="font-size: 16px; color: #4b5563;">N'oubliez pas d'arriver quelques minutes en avance.</p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Ceci est un email automatique, merci de ne pas y répondre.
            </p>
            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
              © ${new Date().getFullYear()} Gobering - Votre plateforme de prise de rendez-vous médicaux
            </p>
          </div>
        </div>
      `,
    });
    
    return result;
  } catch (error) {
    console.error('Error sending appointment reminder email:', error);
    throw error;
  }
}

export interface TeamInvitationEmailData {
  inviteeEmail: string;
  inviterFirstName: string;
  inviterLastName: string;
  clinicName: string;
  invitationToken: string;
  expiresAt: Date;
}

export interface NewMemberCredentialsEmailData {
  email: string;
  firstName: string;
  lastName: string;
  clinicName: string;
  role: string;
  temporaryPassword: string;
  username: string;
}

export async function sendTeamInvitation(data: TeamInvitationEmailData) {
  const formattedExpiry = new Intl.DateTimeFormat('fr-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(data.expiresAt);

  const invitationLink = `${getBaseUrl()}/invitation/${data.invitationToken}`;

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.inviteeEmail,
      subject: `Invitation à rejoindre ${data.clinicName} sur Gobering`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2196F3, #1976D2); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Gobering</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Invitation à rejoindre une clinique</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; color: #1f2937;">Bonjour,</p>
            
            <p style="font-size: 16px; color: #4b5563;"><strong>${data.inviterFirstName} ${data.inviterLastName}</strong> vous invite à rejoindre <strong>${data.clinicName}</strong> sur Gobering.</p>
            
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
              <h2 style="margin-top: 0; color: #1f2937; font-size: 18px;">Accepter l'invitation</h2>
              <p style="color: #4b5563; margin: 8px 0;">Cliquez sur le bouton ci-dessous pour créer votre compte professionnel et rejoindre la clinique.</p>
              <p style="text-align: center; margin: 20px 0;">
                <a href="${invitationLink}" 
                   style="background: linear-gradient(135deg, #2196F3, #1976D2); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px;">
                  Accepter l'invitation
                </a>
              </p>
              <p style="margin-top: 15px; font-size: 14px; color: #6b7280;">
                Ou copiez ce lien dans votre navigateur :<br>
                <code style="background-color: #e5e7eb; padding: 5px 10px; border-radius: 4px; font-size: 12px; word-break: break-all;">${invitationLink}</code>
              </p>
            </div>
            
            <div style="background: linear-gradient(135deg, #fee2e2, #fecaca); padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <p style="margin: 0; color: #7f1d1d; font-size: 14px;">
                ⏰ Cette invitation expire le ${formattedExpiry}
              </p>
            </div>
            
            <p style="font-size: 14px; color: #6b7280;">
              Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet email.
            </p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Ceci est un email automatique, merci de ne pas y répondre.
            </p>
            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
              © ${new Date().getFullYear()} Gobering - Votre plateforme de prise de rendez-vous médicaux
            </p>
          </div>
        </div>
      `,
    });
    
    return result;
  } catch (error) {
    console.error('Error sending team invitation email:', error);
    throw error;
  }
}

export async function sendWelcomeEmail(data: WelcomeEmailData) {
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: 'Bienvenue chez Gobering – Votre nouvelle ère de gestion commence maintenant ! 🚀',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2196F3, #1976D2); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 32px;">🎉 Bienvenue chez Gobering !</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 18px;">Prêt à transformer votre pratique ?</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 18px; color: #1f2937;"><strong>Bonjour ${data.firstName} ! 👋</strong></p>
            
            <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">
              <strong>Bravo pour cette excellente décision !</strong> Vous venez de franchir une étape importante : simplifier votre pratique pour vous concentrer sur ce qui compte vraiment – vos patients.
            </p>
            
            <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">
              Gobering a été pensé pour les professionnels de la santé du Québec qui veulent reprendre le contrôle de leur temps. <strong>Fini les casse-têtes administratifs, place à l'efficacité !</strong>
            </p>
            
            <div style="background: linear-gradient(135deg, #f0f8ff, #e3f2fd); padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #2196F3;">
              <h2 style="margin-top: 0; color: #1f2937; font-size: 20px;">🎯 Voici ce qui vous attend :</h2>
              
              <div style="margin: 15px 0;">
                <p style="margin: 0 0 5px 0; color: #1f2937; font-weight: 600; font-size: 15px;">📅 Votre agenda intelligent</p>
                <p style="margin: 0; color: #4b5563; font-size: 14px;">Une vue d'ensemble claire de vos rendez-vous. Créez, modifiez, annulez – tout en quelques clics.</p>
              </div>
              
              <div style="margin: 15px 0;">
                <p style="margin: 0 0 5px 0; color: #1f2937; font-weight: 600; font-size: 15px;">⏰ Notifications automatiques</p>
                <p style="margin: 0; color: #4b5563; font-size: 14px;">Vos patients reçoivent des rappels par email et SMS. Moins d'oublis = plus de revenus.</p>
              </div>
              
              <div style="margin: 15px 0;">
                <p style="margin: 0 0 5px 0; color: #1f2937; font-weight: 600; font-size: 15px;">🔗 Widget de réservation personnalisé</p>
                <p style="margin: 0; color: #4b5563; font-size: 14px;">Intégrez la prise de rendez-vous directement sur votre site web. Vos patients réservent 24/7.</p>
              </div>
              
              <div style="margin: 15px 0;">
                <p style="margin: 0 0 5px 0; color: #1f2937; font-weight: 600; font-size: 15px;">📊 Liste d'attente intelligente</p>
                <p style="margin: 0; color: #4b5563; font-size: 14px;">Aucun créneau perdu ! Quand un rendez-vous se libère, le système notifie automatiquement les patients en attente.</p>
              </div>
              
              <div style="margin: 15px 0;">
                <p style="margin: 0 0 5px 0; color: #1f2937; font-weight: 600; font-size: 15px;">💼 Gestion multi-cliniques</p>
                <p style="margin: 0; color: #4b5563; font-size: 14px;">Travaillez dans plusieurs cliniques ? Gérez tout depuis un seul tableau de bord.</p>
              </div>
            </div>
            
            <div style="background: linear-gradient(135deg, #d1fae5, #a7f3d0); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669; text-align: center;">
              <p style="margin: 0 0 5px 0; color: #047857; font-weight: 600; font-size: 16px;">🎁 Votre essai gratuit de 21 jours</p>
              <p style="margin: 0; color: #065f46; font-size: 14px;">Profitez de toutes les fonctionnalités PRO sans engagement. Aucune carte de crédit requise pour commencer !</p>
            </div>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="${getBaseUrl()}/dashboard" 
                 style="background: linear-gradient(135deg, #2196F3, #1976D2); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 18px; box-shadow: 0 4px 6px rgba(33, 150, 243, 0.3);">
                🚀 Accéder à mon tableau de bord
              </a>
            </p>
            
            <div style="border-top: 2px solid #e5e7eb; margin-top: 30px; padding-top: 20px;">
              <p style="font-size: 15px; color: #4b5563; margin: 0 0 10px 0;">
                <strong>Besoin d'un coup de main ?</strong>
              </p>
              <p style="font-size: 14px; color: #6b7280; margin: 0;">
                Notre équipe est là pour vous accompagner. Contactez-nous à <a href="mailto:operations@gobering.com" style="color: #2196F3; text-decoration: none;">operations@gobering.com</a>
              </p>
            </div>
            
            <p style="font-size: 16px; color: #1f2937; text-align: center; margin-top: 30px;">
              <strong>Bienvenue dans la famille Gobering ! 💙</strong>
            </p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Ceci est un email automatique, merci de ne pas y répondre.
            </p>
            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
              © ${new Date().getFullYear()} Gobering - Votre plateforme de prise de rendez-vous médicaux
            </p>
          </div>
        </div>
      `,
    });
    
    return result;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw error;
  }
}

export async function sendEmailVerification(data: EmailVerificationData) {
  const verificationLink = `${getBaseUrl()}/verify-email/${data.verificationToken}`;

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: 'Vérifiez votre adresse email - Gobering',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2196F3, #1976D2); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Gobering</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Vérification de votre email</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; color: #1f2937;">Bonjour ${data.firstName},</p>
            
            <p style="font-size: 16px; color: #4b5563;">Merci de vous être inscrit sur Gobering ! Pour activer votre compte et commencer à utiliser la plateforme, veuillez vérifier votre adresse email.</p>
            
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
              <h2 style="margin-top: 0; color: #1f2937; font-size: 18px;">Vérifier votre email</h2>
              <p style="color: #4b5563; margin: 8px 0;">Cliquez sur le bouton ci-dessous pour confirmer votre adresse email et activer votre compte.</p>
              
              <!-- Bulletproof button for Gmail/Outlook/Apple Mail compatibility -->
              <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin: 20px 0;">
                <tr>
                  <td align="center">
                    <table border="0" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td align="center" bgcolor="#2196F3" style="border-radius: 12px; mso-padding-alt: 14px 28px;">
                          <a href="${verificationLink}" target="_blank" rel="noopener noreferrer" style="display: block; font-family: Arial, sans-serif; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 12px; padding: 14px 28px; line-height: 1.5;">
                            Vérifier mon email
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin-top: 15px; font-size: 14px; color: #6b7280;">
                Ou copiez ce lien dans votre navigateur :<br>
                <code style="background-color: #e5e7eb; padding: 5px 10px; border-radius: 4px; font-size: 12px; word-break: break-all;">${verificationLink}</code>
              </p>
            </div>
            
            <div style="background: linear-gradient(135deg, #fee2e2, #fecaca); padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <p style="margin: 0; color: #7f1d1d; font-size: 14px;">
                ⏰ Ce lien de vérification expire dans 24 heures
              </p>
            </div>
            
            <p style="font-size: 14px; color: #6b7280;">
              Si vous n'avez pas créé de compte sur Gobering, vous pouvez ignorer cet email en toute sécurité.
            </p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Ceci est un email automatique, merci de ne pas y répondre.
            </p>
            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
              © ${new Date().getFullYear()} Gobering - Votre plateforme de prise de rendez-vous médicaux
            </p>
          </div>
        </div>
      `,
    });
    
    return result;
  } catch (error) {
    console.error('Error sending email verification:', error);
    throw error;
  }
}

export async function sendProUpgradeEmail(data: ProUpgradeEmailData) {
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: 'Félicitations ! Bienvenue dans votre nouveau plan Pro Gobering 🎉',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2196F3, #1976D2); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 32px;">🎉 Bienvenue dans le plan Pro !</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 18px;">Vous venez de passer à la vitesse supérieure</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 18px; color: #1f2937;"><strong>Bonjour ${data.firstName},</strong></p>
            
            <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">
              <strong>Félicitations et bienvenue dans votre nouveau plan Pro Gobering ! 🚀</strong>
            </p>
            
            <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">
              Vous venez de passer à la vitesse supérieure — et toute notre équipe est ravie de vous compter parmi les professionnels qui choisissent la <strong>performance, la simplicité et la liberté</strong>.
            </p>
            
            <div style="background: linear-gradient(135deg, #f0f8ff, #e3f2fd); padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #2196F3;">
              <h2 style="margin-top: 0; color: #1f2937; font-size: 20px;">✨ Votre compte bénéficie désormais de toutes les fonctionnalités Pro :</h2>
              
              <div style="margin: 15px 0;">
                <p style="margin: 0 0 5px 0; color: #1f2937; font-weight: 600; font-size: 15px;">📲 Notifications SMS illimitées</p>
                <p style="margin: 0; color: #4b5563; font-size: 14px;">Envoyez des rappels par SMS automatiques à vos patients via Twilio. Réduisez les absences et maximisez vos revenus.</p>
              </div>
              
              <div style="margin: 15px 0;">
                <p style="margin: 0 0 5px 0; color: #1f2937; font-weight: 600; font-size: 15px;">📊 Liste d'attente intelligente</p>
                <p style="margin: 0; color: #4b5563; font-size: 14px;">Système automatisé qui remplit vos créneaux libres en notifiant les patients en attente par priorité. Zéro créneau perdu.</p>
              </div>
              
              <div style="margin: 15px 0;">
                <p style="margin: 0 0 5px 0; color: #1f2937; font-weight: 600; font-size: 15px;">🔗 Widgets de réservation illimités</p>
                <p style="margin: 0; color: #4b5563; font-size: 14px;">Créez autant de widgets personnalisés que vous le souhaitez. Intégrez-les sur votre site web ou partagez-les par bouton HTML.</p>
              </div>
              
              <div style="margin: 15px 0;">
                <p style="margin: 0 0 5px 0; color: #1f2937; font-weight: 600; font-size: 15px;">💼 Professionnels illimités</p>
                <p style="margin: 0; color: #4b5563; font-size: 14px;">Ajoutez autant de professionnels que nécessaire à votre clinique. Collaborez en toute fluidité.</p>
              </div>
              
              <div style="margin: 15px 0;">
                <p style="margin: 0 0 5px 0; color: #1f2937; font-weight: 600; font-size: 15px;">📅 Rendez-vous illimités</p>
                <p style="margin: 0; color: #4b5563; font-size: 14px;">Aucune limite mensuelle sur le nombre de rendez-vous. Gérez votre pratique sans restriction.</p>
              </div>
              
              <div style="margin: 15px 0;">
                <p style="margin: 0 0 5px 0; color: #1f2937; font-weight: 600; font-size: 15px;">📈 Statistiques et analyses avancées</p>
                <p style="margin: 0; color: #4b5563; font-size: 14px;">Suivez vos performances avec des tableaux de bord détaillés. Prenez des décisions éclairées pour votre pratique.</p>
              </div>
            </div>
            
            <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">
              Prenez un moment pour <strong>explorer toutes ces nouveautés dès maintenant</strong>, et voyez à quel point votre gestion quotidienne devient plus fluide et efficace.
            </p>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="${getBaseUrl()}/dashboard" 
                 style="background: linear-gradient(135deg, #2196F3, #1976D2); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 18px; box-shadow: 0 4px 6px rgba(33, 150, 243, 0.3);">
                👉 Aller à mon espace Pro
              </a>
            </p>
            
            <p style="font-size: 16px; color: #4b5563; line-height: 1.6; text-align: center;">
              <strong>Gobering évolue chaque jour pour rendre vos rendez-vous plus simples et vos journées plus légères.</strong>
            </p>
            
            <div style="border-top: 2px solid #e5e7eb; margin-top: 30px; padding-top: 20px;">
              <p style="font-size: 15px; color: #4b5563; margin: 0 0 10px 0;">
                <strong>Besoin d'aide ou de conseils ?</strong>
              </p>
              <p style="font-size: 14px; color: #6b7280; margin: 0;">
                N'hésitez pas à nous contacter à tout moment. Notre équipe est là pour vous accompagner : <a href="mailto:operations@gobering.com" style="color: #2196F3; text-decoration: none;">operations@gobering.com</a>
              </p>
            </div>
            
            <p style="font-size: 16px; color: #1f2937; text-align: center; margin-top: 30px;">
              <strong>À très bientôt ! 💙</strong>
            </p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Ceci est un email automatique, merci de ne pas y répondre.
            </p>
            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
              © ${new Date().getFullYear()} Gobering - Votre plateforme de prise de rendez-vous médicaux
            </p>
          </div>
        </div>
      `,
    });
    
    return result;
  } catch (error) {
    console.error('Error sending Pro upgrade email:', error);
    throw error;
  }
}

export async function sendStarterUpgradeEmail(data: StarterUpgradeEmailData) {
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: 'Bienvenue dans votre plan Starter Gobering ! 🎉',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2196F3, #1976D2); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 32px;">🎉 Bienvenue dans le plan Starter !</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 18px;">Votre pratique professionnelle commence ici</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 18px; color: #1f2937;"><strong>Bonjour ${data.firstName},</strong></p>
            
            <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">
              <strong>Félicitations et bienvenue dans votre plan Starter Gobering ! 🚀</strong>
            </p>
            
            <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">
              Vous avez choisi de poursuivre avec nous — et toute notre équipe est ravie de vous compter parmi les professionnels qui font confiance à Gobering pour <strong>simplifier leur gestion quotidienne</strong>.
            </p>
            
            <div style="background: linear-gradient(135deg, #f0f8ff, #e3f2fd); padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #2196F3;">
              <h2 style="margin-top: 0; color: #1f2937; font-size: 20px;">✨ Votre plan Starter inclut :</h2>
              
              <div style="margin: 15px 0;">
                <p style="margin: 0 0 5px 0; color: #1f2937; font-weight: 600; font-size: 15px;">📅 100 rendez-vous par mois</p>
                <p style="margin: 0; color: #4b5563; font-size: 14px;">Gérez jusqu'à 100 rendez-vous mensuels avec un calendrier intelligent et facile à utiliser.</p>
              </div>
              
              <div style="margin: 15px 0;">
                <p style="margin: 0 0 5px 0; color: #1f2937; font-weight: 600; font-size: 15px;">⏰ Notifications par email</p>
                <p style="margin: 0; color: #4b5563; font-size: 14px;">Vos patients reçoivent automatiquement des rappels par email. Réduisez les oublis et les absences.</p>
              </div>
              
              <div style="margin: 15px 0;">
                <p style="margin: 0 0 5px 0; color: #1f2937; font-weight: 600; font-size: 15px;">🔗 Widget de réservation personnalisé</p>
                <p style="margin: 0; color: #4b5563; font-size: 14px;">Intégrez la prise de rendez-vous directement sur votre site web. Vos patients peuvent réserver 24/7.</p>
              </div>
              
              <div style="margin: 15px 0;">
                <p style="margin: 0 0 5px 0; color: #1f2937; font-weight: 600; font-size: 15px;">👥 1 professionnel + 1 secrétaire</p>
                <p style="margin: 0; color: #4b5563; font-size: 14px;">Collaborez avec un secrétaire pour gérer vos rendez-vous et vos patients efficacement.</p>
              </div>
              
              <div style="margin: 15px 0;">
                <p style="margin: 0 0 5px 0; color: #1f2937; font-weight: 600; font-size: 15px;">📋 Gestion complète des patients</p>
                <p style="margin: 0; color: #4b5563; font-size: 14px;">Base de données centralisée avec historique des rendez-vous et informations de contact.</p>
              </div>
              
              <div style="margin: 15px 0;">
                <p style="margin: 0 0 5px 0; color: #1f2937; font-weight: 600; font-size: 15px;">🌐 Visibilité sur Gobering</p>
                <p style="margin: 0; color: #4b5563; font-size: 14px;">Profil professionnel public pour que de nouveaux patients puissent vous découvrir.</p>
              </div>
            </div>
            
            <div style="background: linear-gradient(135deg, #e0f2fe, #bae6fd); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0284c7; text-align: center;">
              <p style="margin: 0 0 5px 0; color: #075985; font-weight: 600; font-size: 16px;">💡 Envie d'aller plus loin ?</p>
              <p style="margin: 0; color: #0c4a6e; font-size: 14px;">Passez au plan Pro pour débloquer les SMS, la liste d'attente intelligente, et un nombre illimité de rendez-vous et widgets !</p>
            </div>
            
            <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">
              Prenez un moment pour <strong>explorer votre tableau de bord</strong>, et voyez à quel point Gobering simplifie votre gestion quotidienne.
            </p>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="${getBaseUrl()}/dashboard" 
                 style="background: linear-gradient(135deg, #2196F3, #1976D2); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 18px; box-shadow: 0 4px 6px rgba(33, 150, 243, 0.3);">
                👉 Accéder à mon espace Starter
              </a>
            </p>
            
            <p style="font-size: 16px; color: #4b5563; line-height: 1.6; text-align: center;">
              <strong>Gobering évolue chaque jour pour rendre vos rendez-vous plus simples et vos journées plus légères.</strong>
            </p>
            
            <div style="border-top: 2px solid #e5e7eb; margin-top: 30px; padding-top: 20px;">
              <p style="font-size: 15px; color: #4b5563; margin: 0 0 10px 0;">
                <strong>Besoin d'aide ou de conseils ?</strong>
              </p>
              <p style="font-size: 14px; color: #6b7280; margin: 0;">
                N'hésitez pas à nous contacter à tout moment. Notre équipe est là pour vous accompagner : <a href="mailto:operations@gobering.com" style="color: #2196F3; text-decoration: none;">operations@gobering.com</a>
              </p>
            </div>
            
            <p style="font-size: 16px; color: #1f2937; text-align: center; margin-top: 30px;">
              <strong>À très bientôt ! 💙</strong>
            </p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Ceci est un email automatique, merci de ne pas y répondre.
            </p>
            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
              © ${new Date().getFullYear()} Gobering - Votre plateforme de prise de rendez-vous médicaux
            </p>
          </div>
        </div>
      `,
    });
    
    return result;
  } catch (error) {
    console.error('Error sending Starter upgrade email:', error);
    throw error;
  }
}

export async function sendNewMemberCredentialsEmail(data: NewMemberCredentialsEmailData) {
  const loginLink = `${getBaseUrl()}/login-professionnel`;

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: `Bienvenue dans ${data.clinicName} sur Gobering`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2196F3, #1976D2); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Gobering</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Bienvenue sur Gobering !</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; color: #1f2937;">Bonjour ${data.firstName} ${data.lastName},</p>
            
            <p style="font-size: 16px; color: #4b5563;">Un compte a été créé pour vous sur Gobering dans la clinique <strong>${data.clinicName}</strong>.</p>
            
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
              <h2 style="margin-top: 0; color: #1f2937; font-size: 18px;">🔑 Vos identifiants de connexion</h2>
              <p style="color: #4b5563; margin: 8px 0;"><strong>Email :</strong> <code style="background-color: #e5e7eb; padding: 5px 10px; border-radius: 4px;">${data.email}</code></p>
              <p style="color: #4b5563; margin: 8px 0;"><strong>Mot de passe temporaire :</strong> <code style="background-color: #e5e7eb; padding: 5px 10px; border-radius: 4px;">${data.temporaryPassword}</code></p>
              <p style="color: #4b5563; margin: 15px 0 8px 0;"><strong>Votre rôle :</strong> ${data.role}</p>
            </div>
            
            <div style="background: linear-gradient(135deg, #fff3cd, #fef3c7); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; color: #92400e;"><strong>⚠️ Important :</strong> Vous devrez changer votre mot de passe lors de votre première connexion.</p>
            </div>
            
            <p style="text-align: center; margin: 20px 0;">
              <a href="${loginLink}" 
                 style="background: linear-gradient(135deg, #2196F3, #1976D2); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px;">
                Se connecter maintenant
              </a>
            </p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Ceci est un email automatique, merci de ne pas y répondre.
            </p>
            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
              © ${new Date().getFullYear()} Gobering - Votre plateforme de prise de rendez-vous médicaux
            </p>
          </div>
        </div>
      `,
    });
    
    return result;
  } catch (error) {
    console.error('Error sending new member credentials email:', error);
    throw error;
  }
}

export interface TrialReminderEmailData {
  email: string;
  firstName: string;
  lastName: string;
  daysRemaining: number;
  appointmentsCount: number;
  dashboardLink?: string;
}

export async function sendTrialReminderDay14(data: TrialReminderEmailData) {
  const dashboardLink = data.dashboardLink || `${getBaseUrl()}/dashboard`;
  
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: '🎯 Vous avez déjà simplifié votre gestion avec Gobering PRO !',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2196F3, #1976D2); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Gobering</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">🎉 Bravo ${data.firstName} !</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; color: #1f2937;">Bonjour ${data.firstName},</p>
            
            <p style="font-size: 16px; color: #4b5563;">Vous avez déjà simplifié <strong>${data.appointmentsCount} rendez-vous</strong> grâce à Gobering PRO !</p>
            
            <div style="background: linear-gradient(135deg, #f0f8ff, #e3f2fd); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196F3;">
              <h2 style="margin-top: 0; color: #1f2937; font-size: 18px;">⏰ Il vous reste ${data.daysRemaining} jours d'essai PRO</h2>
              <p style="margin: 0; color: #4b5563;">Continuez à profiter de toutes les fonctionnalités avancées :</p>
              <ul style="margin: 10px 0; padding-left: 20px; color: #4b5563;">
                <li>Gestion de clinique illimitée</li>
                <li>Liste d'attente automatique</li>
                <li>Widgets de réservation personnalisés</li>
                <li>Statistiques avancées</li>
              </ul>
            </div>
            
            <p style="text-align: center; margin: 20px 0;">
              <a href="${dashboardLink}" 
                 style="background: linear-gradient(135deg, #2196F3, #1976D2); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px;">
                Accéder à mon tableau de bord
              </a>
            </p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Ceci est un email automatique, merci de ne pas y répondre.
            </p>
            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
              © ${new Date().getFullYear()} Gobering - Votre plateforme de prise de rendez-vous médicaux
            </p>
          </div>
        </div>
      `,
    });
    
    return result;
  } catch (error) {
    console.error('Error sending day 14 trial reminder:', error);
    throw error;
  }
}

export async function sendTrialReminderDay19(data: TrialReminderEmailData) {
  const pricingLink = `${getBaseUrl()}/pricing`;
  const subscriptionLink = `${getBaseUrl()}/dashboard/parametres/abonnement`;
  
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: '⏰ Votre période PRO se termine bientôt - Gobering',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2196F3, #1976D2); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Gobering</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">⏰ Votre période PRO se termine bientôt</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; color: #1f2937;">Bonjour ${data.firstName},</p>
            
            <p style="font-size: 16px; color: #4b5563;">Il ne vous reste que <strong>${data.daysRemaining} jours</strong> pour profiter de Gobering PRO.</p>
            
            <p style="font-size: 16px; color: #4b5563;">Vous avez déjà géré <strong>${data.appointmentsCount} rendez-vous</strong> avec facilité. Ne perdez pas vos fonctionnalités avancées !</p>
            
            <div style="background: linear-gradient(135deg, #fff3cd, #fef3c7); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <h2 style="margin-top: 0; color: #92400e; font-size: 18px;">💡 Choisissez votre plan pour continuer</h2>
              <p style="text-align: center; margin: 15px 0;">
                <a href="${subscriptionLink}" 
                   style="background: linear-gradient(135deg, #2196F3, #1976D2); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px;">
                  Je choisis mon plan
                </a>
              </p>
              <p style="margin-top: 15px; font-size: 14px; color: #92400e; text-align: center;">
                <strong>Gratuit</strong> (0$/mois) ou <strong>Pro</strong> à 39$/mois
              </p>
            </div>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Ceci est un email automatique, merci de ne pas y répondre.
            </p>
            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
              © ${new Date().getFullYear()} Gobering - Votre plateforme de prise de rendez-vous médicaux
            </p>
          </div>
        </div>
      `,
    });
    
    return result;
  } catch (error) {
    console.error('Error sending day 19 trial reminder:', error);
    throw error;
  }
}

export async function sendTrialReminderDay21(data: TrialReminderEmailData) {
  const subscriptionLink = `${getBaseUrl()}/dashboard/parametres/abonnement`;
  
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: '🎯 Votre essai PRO est terminé - Choisissez votre plan',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2196F3, #1976D2); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Gobering</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">🎯 Votre essai PRO est terminé</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; color: #1f2937;">Bonjour ${data.firstName},</p>
            
            <p style="font-size: 16px; color: #4b5563;">Votre période d'essai PRO de 21 jours est maintenant terminée.</p>
            
            <p style="font-size: 16px; color: #4b5563;">Vous avez géré <strong>${data.appointmentsCount} rendez-vous</strong> avec Gobering. C'est formidable !</p>
            
            <div style="background: linear-gradient(135deg, #fee2e2, #fecaca); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <h2 style="margin-top: 0; color: #7f1d1d; font-size: 18px;">⚠️ Action requise</h2>
              <p style="color: #7f1d1d; margin: 8px 0;">Choisissez un abonnement pour continuer à recevoir vos rendez-vous sans interruption.</p>
              <p style="text-align: center; margin: 15px 0;">
                <a href="${subscriptionLink}" 
                   style="background: linear-gradient(135deg, #2196F3, #1976D2); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px;">
                  Je choisis mon plan maintenant
                </a>
              </p>
            </div>
            
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
              <h3 style="margin-top: 0; color: #1f2937; font-size: 18px;">Nos plans</h3>
              <p style="color: #4b5563; margin: 8px 0;"><strong>Gratuit (0$/mois)</strong> - 100 rendez-vous, 1 professionnel</p>
              <p style="color: #4b5563; margin: 8px 0;"><strong>Pro (39$/mois)</strong> - Tout Gratuit + Rendez-vous illimités + Gestion d'équipe + Liste d'attente automatique</p>
            </div>
            
            <p style="font-size: 14px; color: #6b7280;">
              Sans abonnement, votre compte passera en mode lecture seule.
            </p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Ceci est un email automatique, merci de ne pas y répondre.
            </p>
            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
              © ${new Date().getFullYear()} Gobering - Votre plateforme de prise de rendez-vous médicaux
            </p>
          </div>
        </div>
      `,
    });
    
    return result;
  } catch (error) {
    console.error('Error sending day 21 trial reminder:', error);
    throw error;
  }
}

export async function sendPasswordResetEmail(data: PasswordResetEmailData) {
  const formattedExpiry = new Intl.DateTimeFormat('fr-CA', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(data.expiresAt);

  const resetLink = `${getBaseUrl()}/reset-password/${data.resetToken}`;

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: 'Réinitialisation de votre mot de passe - Gobering',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2196F3, #1976D2); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Gobering</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Réinitialisation de mot de passe</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; color: #1f2937;">Bonjour ${data.firstName},</p>
            
            <p style="font-size: 16px; color: #4b5563;">Vous avez demandé à réinitialiser votre mot de passe sur Gobering.</p>
            
            <div style="background: linear-gradient(135deg, #fff3cd, #fef3c7); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <h2 style="margin-top: 0; color: #92400e; font-size: 18px;">🔐 Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe</h2>
              
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="background-color: #2196F3; border-radius: 8px; padding: 14px 28px;">
                          <a href="${resetLink}" target="_blank" style="display: block; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none;">Réinitialiser mon mot de passe</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin-top: 15px; font-size: 14px; color: #6b7280;">
                Ou copiez ce lien dans votre navigateur :<br>
                <code style="background-color: #e5e7eb; padding: 5px 10px; border-radius: 4px; font-size: 12px; word-break: break-all;">${resetLink}</code>
              </p>
            </div>
            
            <div style="background: linear-gradient(135deg, #fee2e2, #fecaca); padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <p style="margin: 0; color: #7f1d1d; font-size: 14px;">
                ⏰ Ce lien expire dans 1 heure (${formattedExpiry})
              </p>
            </div>
            
            <div style="background: linear-gradient(135deg, #fee2e2, #fecaca); padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <p style="margin: 0; color: #7f1d1d;">
                <strong>⚠️ Attention :</strong> Si vous n'avez pas demandé cette réinitialisation, ignorez cet email et votre mot de passe restera inchangé.
              </p>
            </div>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Ceci est un email automatique, merci de ne pas y répondre.
            </p>
            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
              © ${new Date().getFullYear()} Gobering - Votre plateforme de prise de rendez-vous médicaux
            </p>
          </div>
        </div>
      `,
    });
    
    return result;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
}

export async function sendCancellationConfirmationToClient(data: AppointmentEmailData) {
  const formattedDate = new Intl.DateTimeFormat('fr-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(data.appointmentDate);

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.patientEmail,
      subject: `Annulation confirmée - ${data.professionalFirstName} ${data.professionalLastName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2196F3, #1976D2); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Gobering</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Rendez-vous annulé</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; color: #1f2937;">Bonjour ${data.patientFirstName},</p>
            
            <p style="font-size: 16px; color: #4b5563;">Votre rendez-vous a été annulé avec succès.</p>
            
            <div style="background: linear-gradient(135deg, #fee2e2, #fecaca); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <h2 style="margin-top: 0; color: #7f1d1d; font-size: 18px;">Rendez-vous annulé</h2>
              <p style="color: #7f1d1d; margin: 8px 0;"><strong>Professionnel :</strong> ${data.professionalFirstName} ${data.professionalLastName}</p>
              <p style="color: #7f1d1d; margin: 8px 0;"><strong>Spécialité :</strong> ${data.profession}</p>
              ${data.serviceName ? `<p style="color: #7f1d1d; margin: 8px 0;"><strong>Service :</strong> ${data.serviceName}</p>` : ''}
              <p style="color: #7f1d1d; margin: 8px 0;"><strong>Date :</strong> ${formattedDate}</p>
              <p style="color: #7f1d1d; margin: 8px 0;"><strong>Heure :</strong> ${data.appointmentTime}</p>
            </div>
            
            <p style="font-size: 16px; color: #4b5563;">Si vous souhaitez reprendre rendez-vous, vous pouvez rechercher un nouveau créneau sur Gobering.</p>
            
            <p style="text-align: center; margin: 20px 0;">
              <a href="${getBaseUrl()}/search" 
                 style="background: linear-gradient(135deg, #2196F3, #1976D2); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px;">
                Prendre un nouveau rendez-vous
              </a>
            </p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Ceci est un email automatique, merci de ne pas y répondre.
            </p>
            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
              © ${new Date().getFullYear()} Gobering - Votre plateforme de prise de rendez-vous médicaux
            </p>
          </div>
        </div>
      `,
    });
    
    return result;
  } catch (error) {
    console.error('Error sending cancellation confirmation to client:', error);
    throw error;
  }
}

export async function sendCancellationNotificationToProfessional(data: AppointmentEmailData) {
  const formattedDate = new Intl.DateTimeFormat('fr-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(data.appointmentDate);

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.professionalEmail,
      subject: `Annulation de rendez-vous - ${data.patientFirstName} ${data.patientLastName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2196F3, #1976D2); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Gobering</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Annulation de rendez-vous</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; color: #1f2937;">Bonjour Dr ${data.professionalLastName},</p>
            
            <p style="font-size: 16px; color: #4b5563;">Un rendez-vous a été annulé par le patient.</p>
            
            <div style="background: linear-gradient(135deg, #fee2e2, #fecaca); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <h2 style="margin-top: 0; color: #7f1d1d; font-size: 18px;">Rendez-vous annulé par le client</h2>
              <p style="color: #7f1d1d; margin: 8px 0;"><strong>Patient :</strong> ${data.patientFirstName} ${data.patientLastName}</p>
              <p style="color: #7f1d1d; margin: 8px 0;"><strong>Email :</strong> ${data.patientEmail}</p>
              ${data.serviceName ? `<p style="color: #7f1d1d; margin: 8px 0;"><strong>Service :</strong> ${data.serviceName}</p>` : ''}
              <p style="color: #7f1d1d; margin: 8px 0;"><strong>Date :</strong> ${formattedDate}</p>
              <p style="color: #7f1d1d; margin: 8px 0;"><strong>Heure :</strong> ${data.appointmentTime}</p>
            </div>
            
            <p style="font-size: 16px; color: #4b5563;">Ce créneau est maintenant disponible pour d'autres patients.</p>
            
            <p style="text-align: center; margin: 20px 0;">
              <a href="${getBaseUrl()}/calendrier" 
                 style="background: linear-gradient(135deg, #2196F3, #1976D2); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px;">
                Voir mon calendrier
              </a>
            </p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Ceci est un email automatique, merci de ne pas y répondre.
            </p>
            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
              © ${new Date().getFullYear()} Gobering - Votre plateforme de prise de rendez-vous médicaux
            </p>
          </div>
        </div>
      `,
    });
    
    return result;
  } catch (error) {
    console.error('Error sending cancellation notification to professional:', error);
    throw error;
  }
}

export async function sendCancellationNotificationToClient(data: AppointmentEmailData) {
  const formattedDate = new Intl.DateTimeFormat('fr-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(data.appointmentDate);

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.patientEmail,
      subject: `Annulation de rendez-vous - ${data.professionalFirstName} ${data.professionalLastName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2196F3, #1976D2); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Gobering</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Rendez-vous annulé</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; color: #1f2937;">Bonjour ${data.patientFirstName},</p>
            
            <p style="font-size: 16px; color: #4b5563;">Nous vous informons que votre rendez-vous a été annulé par le professionnel de santé.</p>
            
            <div style="background: linear-gradient(135deg, #fee2e2, #fecaca); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <h2 style="margin-top: 0; color: #7f1d1d; font-size: 18px;">Rendez-vous annulé par le professionnel</h2>
              <p style="color: #7f1d1d; margin: 8px 0;"><strong>Professionnel :</strong> ${data.professionalFirstName} ${data.professionalLastName}</p>
              <p style="color: #7f1d1d; margin: 8px 0;"><strong>Spécialité :</strong> ${data.profession}</p>
              ${data.serviceName ? `<p style="color: #7f1d1d; margin: 8px 0;"><strong>Service :</strong> ${data.serviceName}</p>` : ''}
              <p style="color: #7f1d1d; margin: 8px 0;"><strong>Date :</strong> ${formattedDate}</p>
              <p style="color: #7f1d1d; margin: 8px 0;"><strong>Heure :</strong> ${data.appointmentTime}</p>
            </div>
            
            <p style="font-size: 16px; color: #4b5563;">Nous nous excusons pour ce contretemps. Vous pouvez reprendre rendez-vous avec ce professionnel ou rechercher un autre praticien sur Gobering.</p>
            
            <p style="text-align: center; margin: 20px 0;">
              <a href="${getBaseUrl()}/search" 
                 style="background: linear-gradient(135deg, #2196F3, #1976D2); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px;">
                Prendre un nouveau rendez-vous
              </a>
            </p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Ceci est un email automatique, merci de ne pas y répondre.
            </p>
            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
              © ${new Date().getFullYear()} Gobering - Votre plateforme de prise de rendez-vous médicaux
            </p>
          </div>
        </div>
      `,
    });
    
    return result;
  } catch (error) {
    console.error('Error sending cancellation notification to client:', error);
    throw error;
  }
}

// Waitlist email types and functions

export interface WaitlistEmailData {
  firstName: string;
  lastName: string;
  email: string;
  professionalFirstName: string;
  professionalLastName: string;
  profession: string;
  serviceName?: string;
  preferredDate: Date;
  preferredTimeRange?: string;
  token?: string;
  expiresAt?: Date;
  availableStartTime?: string;
  availableEndTime?: string;
  beneficiaryName?: string;
}

export async function sendWaitlistConfirmation(data: WaitlistEmailData) {
  const formattedDate = new Intl.DateTimeFormat('fr-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(data.preferredDate);

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: `Inscription à la liste d'attente - ${data.professionalFirstName} ${data.professionalLastName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2196F3, #1976D2); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Gobering</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Inscription confirmée</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; color: #1f2937;">Bonjour ${data.firstName},</p>
            
            <p style="font-size: 16px; color: #4b5563;">Votre inscription à la liste d'attente a été enregistrée avec succès.</p>
            
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
              <h2 style="margin-top: 0; color: #1f2937; font-size: 18px;">Détails de votre demande</h2>
              <p style="color: #4b5563; margin: 8px 0;"><strong>Professionnel :</strong> ${data.professionalFirstName} ${data.professionalLastName}</p>
              <p style="color: #4b5563; margin: 8px 0;"><strong>Spécialité :</strong> ${data.profession}</p>
              ${data.serviceName ? `<p style="color: #4b5563; margin: 8px 0;"><strong>Service :</strong> ${data.serviceName}</p>` : ''}
              <p style="color: #4b5563; margin: 8px 0;"><strong>Date souhaitée :</strong> ${formattedDate}</p>
              ${data.preferredTimeRange ? `<p style="color: #4b5563; margin: 8px 0;"><strong>Plage horaire :</strong> ${data.preferredTimeRange}</p>` : ''}
            </div>
            
            <div style="background: linear-gradient(135deg, #f0f8ff, #e3f2fd); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196F3;">
              <p style="margin: 0; color: #1f2937; font-weight: 600;">📧 Vous serez notifié par email</p>
              <p style="margin: 10px 0 0 0; color: #4b5563;">Dès qu'un créneau correspondant à vos préférences se libère, nous vous enverrons un email avec un lien pour réserver en priorité.</p>
            </div>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Ceci est un email automatique, merci de ne pas y répondre.
            </p>
            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
              © ${new Date().getFullYear()} Gobering - Votre plateforme de prise de rendez-vous médicaux
            </p>
          </div>
        </div>
      `,
    });
    
    return result;
  } catch (error) {
    console.error('Error sending waitlist confirmation email:', error);
    throw error;
  }
}

export async function sendWaitlistSlotAvailable(data: WaitlistEmailData) {
  if (!data.token) {
    throw new Error('Token is required for waitlist slot available email');
  }

  const formattedDate = new Intl.DateTimeFormat('fr-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(data.preferredDate);

  const bookingLink = `${getBaseUrl()}/appointments/priority/${data.token}`;

  // Format expiry time in America/Toronto timezone
  const expiryText = data.expiresAt 
    ? new Intl.DateTimeFormat('fr-CA', {
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Toronto'
      }).format(data.expiresAt)
    : '24 heures';

  // Format available time slot if provided
  const availableTimeSlot = data.availableStartTime && data.availableEndTime 
    ? `${data.availableStartTime} - ${data.availableEndTime}`
    : null;

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: `🎉 Un créneau est disponible ! - ${data.professionalFirstName} ${data.professionalLastName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2196F3, #1976D2); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Gobering</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">🎉 Un créneau est disponible !</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; color: #1f2937;">Bonjour ${data.firstName},</p>
            
            <p style="font-size: 16px; color: #4b5563;">Bonne nouvelle ! Un créneau correspondant à vos préférences vient de se libérer.</p>
            
            <div style="background: linear-gradient(135deg, #d1fae5, #a7f3d0); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
              <h2 style="margin-top: 0; color: #065f46; font-size: 18px;">Créneau disponible</h2>
              <p style="color: #065f46; margin: 8px 0;"><strong>Professionnel :</strong> ${data.professionalFirstName} ${data.professionalLastName}</p>
              <p style="color: #065f46; margin: 8px 0;"><strong>Spécialité :</strong> ${data.profession}</p>
              ${data.serviceName ? `<p style="color: #065f46; margin: 8px 0;"><strong>Service :</strong> ${data.serviceName}</p>` : ''}
              <p style="color: #065f46; margin: 8px 0;"><strong>Date :</strong> ${formattedDate}</p>
              ${availableTimeSlot ? `<p style="color: #065f46; margin: 8px 0;"><strong>Heure :</strong> ${availableTimeSlot}</p>` : ''}
              ${data.beneficiaryName ? `<p style="color: #065f46; margin: 8px 0;"><strong>Bénéficiaire :</strong> ${data.beneficiaryName}</p>` : ''}
            </div>
            
            <div style="background: linear-gradient(135deg, #fff3cd, #fef3c7); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; color: #92400e; font-weight: 600;">⏰ Réservation prioritaire - Accès limité</p>
              <p style="margin: 10px 0 0 0; color: #92400e;">Ce lien de réservation prioritaire expire le <strong>${expiryText}</strong>. Cliquez ci-dessous pour réserver rapidement.</p>
            </div>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="${bookingLink}" 
                 style="background: linear-gradient(135deg, #059669, #047857); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px;">
                Réserver maintenant
              </a>
            </p>
            
            <p style="margin-top: 15px; font-size: 14px; color: #6b7280; text-align: center;">
              Ou copiez ce lien dans votre navigateur :<br>
              <span style="background-color: #e5e7eb; padding: 5px 10px; border-radius: 4px; font-size: 12px; word-break: break-all; display: inline-block; margin-top: 5px;">${bookingLink}</span>
            </p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Ceci est un email automatique, merci de ne pas y répondre.
            </p>
            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
              © ${new Date().getFullYear()} Gobering - Votre plateforme de prise de rendez-vous médicaux
            </p>
          </div>
        </div>
      `,
    });
    
    return result;
  } catch (error) {
    console.error('Error sending waitlist slot available email:', error);
    throw error;
  }
}

export async function sendWaitlistExpired(data: WaitlistEmailData) {
  const formattedDate = new Intl.DateTimeFormat('fr-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(data.preferredDate);

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: `Expiration de la réservation prioritaire - ${data.professionalFirstName} ${data.professionalLastName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2196F3, #1976D2); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Gobering</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Réservation prioritaire expirée</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; color: #1f2937;">Bonjour ${data.firstName},</p>
            
            <p style="font-size: 16px; color: #4b5563;">Votre lien de réservation prioritaire pour le créneau suivant a expiré :</p>
            
            <div style="background: linear-gradient(135deg, #fee2e2, #fecaca); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <p style="color: #7f1d1d; margin: 8px 0;"><strong>Professionnel :</strong> ${data.professionalFirstName} ${data.professionalLastName}</p>
              <p style="color: #7f1d1d; margin: 8px 0;"><strong>Spécialité :</strong> ${data.profession}</p>
              ${data.serviceName ? `<p style="color: #7f1d1d; margin: 8px 0;"><strong>Service :</strong> ${data.serviceName}</p>` : ''}
              <p style="color: #7f1d1d; margin: 8px 0;"><strong>Date :</strong> ${formattedDate}</p>
            </div>
            
            <p style="font-size: 16px; color: #4b5563;">Vous pouvez toujours rechercher d'autres créneaux disponibles ou rejoindre à nouveau la liste d'attente.</p>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="${getBaseUrl()}/search" 
                 style="background: linear-gradient(135deg, #2196F3, #1976D2); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px;">
                Rechercher des créneaux
              </a>
            </p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Ceci est un email automatique, merci de ne pas y répondre.
            </p>
            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
              © ${new Date().getFullYear()} Gobering - Votre plateforme de prise de rendez-vous médicaux
            </p>
          </div>
        </div>
      `,
    });
    
    return result;
  } catch (error) {
    console.error('Error sending waitlist expired email:', error);
    throw error;
  }
}

export async function sendWaitlistCancelled(data: WaitlistEmailData) {
  const formattedDate = new Intl.DateTimeFormat('fr-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(data.preferredDate);

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: `Annulation de la liste d'attente - ${data.professionalFirstName} ${data.professionalLastName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2196F3, #1976D2); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Gobering</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Retrait de la liste d'attente</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; color: #1f2937;">Bonjour ${data.firstName},</p>
            
            <p style="font-size: 16px; color: #4b5563;">Votre demande de liste d'attente a été annulée pour :</p>
            
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
              <p style="color: #4b5563; margin: 8px 0;"><strong>Professionnel :</strong> ${data.professionalFirstName} ${data.professionalLastName}</p>
              <p style="color: #4b5563; margin: 8px 0;"><strong>Spécialité :</strong> ${data.profession}</p>
              ${data.serviceName ? `<p style="color: #4b5563; margin: 8px 0;"><strong>Service :</strong> ${data.serviceName}</p>` : ''}
              <p style="color: #4b5563; margin: 8px 0;"><strong>Date souhaitée :</strong> ${formattedDate}</p>
            </div>
            
            <p style="font-size: 16px; color: #4b5563;">Si vous souhaitez toujours prendre rendez-vous avec ce professionnel, vous pouvez consulter les créneaux disponibles ou rejoindre à nouveau la liste d'attente.</p>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="${getBaseUrl()}/search" 
                 style="background: linear-gradient(135deg, #2196F3, #1976D2); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px;">
                Rechercher des créneaux
              </a>
            </p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Ceci est un email automatique, merci de ne pas y répondre.
            </p>
            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
              © ${new Date().getFullYear()} Gobering - Votre plateforme de prise de rendez-vous médicaux
            </p>
          </div>
        </div>
      `,
    });
    
    return result;
  } catch (error) {
    console.error('Error sending waitlist cancelled email:', error);
    throw error;
  }
}

export interface WaitlistProfessionalNotificationData {
  professionalEmail: string;
  professionalFirstName: string;
  professionalLastName: string;
  clientFirstName: string;
  clientLastName: string;
  clientEmail: string;
  clientPhone: string;
  serviceName?: string;
  preferredDate: Date;
  preferredTimeRange?: string;
  notes?: string;
}

export async function sendWaitlistNotificationToProfessional(data: WaitlistProfessionalNotificationData) {
  const formattedDate = new Intl.DateTimeFormat('fr-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(data.preferredDate);

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.professionalEmail,
      subject: `Nouvelle demande sur liste d'attente - ${data.clientFirstName} ${data.clientLastName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2196F3, #1976D2); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Gobering</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Nouvelle demande sur liste d'attente</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; color: #1f2937;">Bonjour Dr. ${data.professionalLastName},</p>
            
            <p style="font-size: 16px; color: #4b5563;">Un client souhaite être ajouté à votre liste d'attente.</p>
            
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
              <h2 style="margin-top: 0; color: #1f2937; font-size: 18px;">Informations du client</h2>
              <p style="color: #4b5563; margin: 8px 0;"><strong>Nom :</strong> ${data.clientFirstName} ${data.clientLastName}</p>
              <p style="color: #4b5563; margin: 8px 0;"><strong>Email :</strong> ${data.clientEmail}</p>
              <p style="color: #4b5563; margin: 8px 0;"><strong>Téléphone :</strong> ${data.clientPhone}</p>
            </div>
            
            <div style="background: linear-gradient(135deg, #f0f8ff, #e3f2fd); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196F3;">
              <h2 style="margin-top: 0; color: #1f2937; font-size: 18px;">Préférences</h2>
              ${data.serviceName ? `<p style="color: #4b5563; margin: 8px 0;"><strong>Service :</strong> ${data.serviceName}</p>` : '<p style="color: #4b5563; margin: 8px 0;"><em>Aucun service spécifique</em></p>'}
              <p style="color: #4b5563; margin: 8px 0;"><strong>Date souhaitée :</strong> ${formattedDate}</p>
              ${data.preferredTimeRange ? `<p style="color: #4b5563; margin: 8px 0;"><strong>Plage horaire :</strong> ${data.preferredTimeRange}</p>` : '<p style="color: #4b5563; margin: 8px 0;"><em>Aucune préférence horaire</em></p>'}
              ${data.notes ? `<p style="color: #4b5563; margin: 8px 0;"><strong>Notes :</strong> ${data.notes}</p>` : ''}
            </div>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="${getBaseUrl()}/liste-attente" 
                 style="background: linear-gradient(135deg, #2196F3, #1976D2); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px;">
                Gérer la liste d'attente
              </a>
            </p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Ceci est un email automatique, merci de ne pas y répondre.
            </p>
            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
              © ${new Date().getFullYear()} Gobering - Votre plateforme de prise de rendez-vous médicaux
            </p>
          </div>
        </div>
      `,
    });
    
    return result;
  } catch (error) {
    console.error('Error sending waitlist notification to professional:', error);
    throw error;
  }
}

export interface ContactFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  message: string;
}

export async function sendContactMessage(data: ContactFormData) {
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: 'operations@gobering.com',
      replyTo: data.email,
      subject: `Nouveau message de contact - ${data.firstName} ${data.lastName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2196F3, #1976D2); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Gobering</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Nouveau message de contact</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
              <h2 style="margin-top: 0; color: #1f2937; font-size: 18px;">Informations de contact</h2>
              <p style="color: #4b5563; margin: 8px 0;"><strong>Nom :</strong> ${data.firstName} ${data.lastName}</p>
              <p style="color: #4b5563; margin: 8px 0;"><strong>Email :</strong> <a href="mailto:${data.email}" style="color: #2196F3;">${data.email}</a></p>
              ${data.phone ? `<p style="color: #4b5563; margin: 8px 0;"><strong>Téléphone :</strong> ${data.phone}</p>` : ''}
            </div>
            
            <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
              <h3 style="margin-top: 0; color: #1f2937; font-size: 18px;">Message</h3>
              <p style="white-space: pre-wrap; line-height: 1.6; color: #4b5563;">${data.message}</p>
            </div>
            
            <p style="font-size: 14px; color: #6b7280;">
              Ceci est un email automatique généré depuis le formulaire de contact Gobering.<br>
              Vous pouvez répondre directement à cet email pour contacter ${data.firstName} ${data.lastName}.
            </p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Email automatique du formulaire de contact Gobering
            </p>
            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
              © ${new Date().getFullYear()} Gobering - Votre plateforme de prise de rendez-vous médicaux
            </p>
          </div>
        </div>
      `,
    });
    
    return result;
  } catch (error) {
    console.error('Error sending contact message:', error);
    throw error;
  }
}

export async function sendContactConfirmation(data: ContactFormData) {
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: 'Confirmation de réception - Gobering',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2196F3, #1976D2); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Gobering</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Plateforme de prise de rendez-vous</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <h2 style="color: #1f2937; margin-top: 0;">Bonjour ${data.firstName},</h2>
            
            <p style="color: #4b5563; line-height: 1.6; font-size: 16px;">
              Merci de nous avoir contactés ! Nous avons bien reçu votre message et nous vous répondrons dans les plus brefs délais.
            </p>
            
            <div style="background: linear-gradient(135deg, #f0f8ff, #e3f2fd); padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2196F3;">
              <p style="margin: 0; color: #1f2937; font-weight: 600;">Récapitulatif de votre message :</p>
              <p style="margin: 10px 0 0 0; color: #4b5563; white-space: pre-wrap; line-height: 1.6;">${data.message}</p>
            </div>
            
            <p style="color: #4b5563; line-height: 1.6; font-size: 16px;">
              Notre équipe traite votre demande et vous contactera bientôt à l'adresse <strong>${data.email}</strong>${data.phone ? ` ou au numéro <strong>${data.phone}</strong>` : ''}.
            </p>
            
            <p style="color: #4b5563; line-height: 1.6; font-size: 16px; margin-bottom: 0;">
              En attendant, n'hésitez pas à visiter notre plateforme pour découvrir tous nos services.
            </p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="margin: 0 0 15px 0; color: #6b7280; font-size: 14px;">
              Besoin d'aide ? Contactez-nous à operations@gobering.com
            </p>
            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
              © ${new Date().getFullYear()} Gobering - Tous droits réservés
            </p>
          </div>
        </div>
      `,
    });
    
    return result;
  } catch (error) {
    console.error('Error sending contact confirmation:', error);
    throw error;
  }
}

export async function sendFreePlanConfirmationEmail(data: FreePlanConfirmationEmailData) {
  const subscriptionLink = `${getBaseUrl()}/dashboard/parametres/abonnement`;
  
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: '✅ Plan Gratuit activé - Gobering',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Gobering</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">✅ Votre plan Gratuit est actif</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; color: #1f2937;">Bonjour ${data.firstName},</p>
            
            <p style="font-size: 16px; color: #4b5563;">Votre passage au <strong>plan Gratuit</strong> a été confirmé avec succès.</p>
            
            <div style="background: linear-gradient(135deg, #d1fae5, #a7f3d0); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
              <h2 style="margin-top: 0; color: #065f46; font-size: 18px;">✨ Votre plan Gratuit inclut :</h2>
              <ul style="color: #065f46; margin: 10px 0; padding-left: 20px;">
                <li style="margin: 8px 0;"><strong>100 rendez-vous</strong> par mois</li>
                <li style="margin: 8px 0;"><strong>1 professionnel</strong> + 1 assistant(e)</li>
                <li style="margin: 8px 0;"><strong>1 widget</strong> de réservation</li>
                <li style="margin: 8px 0;"><strong>Notifications par email</strong></li>
                <li style="margin: 8px 0;"><strong>Profil visible</strong> sur Gobering</li>
                <li style="margin: 8px 0;"><strong>Profil professionnel</strong> individuel</li>
                <li style="margin: 8px 0;"><strong>Support standard</strong></li>
              </ul>
            </div>
            
            <div style="background: linear-gradient(135deg, #f0f8ff, #e3f2fd); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196F3;">
              <h3 style="margin-top: 0; color: #1e40af; font-size: 16px;">💡 Envie d'aller plus loin ?</h3>
              <p style="color: #1e40af; margin: 8px 0;">Passez au <strong>plan Pro</strong> (39$/mois) pour débloquer :</p>
              <ul style="color: #1e40af; margin: 10px 0; padding-left: 20px;">
                <li style="margin: 6px 0;">Rendez-vous <strong>illimités</strong></li>
                <li style="margin: 6px 0;">Professionnels et assistants <strong>illimités</strong></li>
                <li style="margin: 6px 0;">Gestion d'équipe avancée</li>
                <li style="margin: 6px 0;">Widgets de réservation <strong>illimités</strong></li>
                <li style="margin: 6px 0;">Notifications par <strong>email et SMS</strong></li>
                <li style="margin: 6px 0;"><strong>Liste d'attente automatique</strong></li>
                <li style="margin: 6px 0;">Statistiques détaillées</li>
                <li style="margin: 6px 0;">Support prioritaire</li>
              </ul>
              <p style="text-align: center; margin: 15px 0 0 0;">
                <a href="${subscriptionLink}" 
                   style="background: linear-gradient(135deg, #2196F3, #1976D2); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 14px;">
                  Découvrir le plan Pro
                </a>
              </p>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
              Vous pouvez modifier votre abonnement à tout moment depuis vos <a href="${subscriptionLink}" style="color: #2196F3; text-decoration: none;">paramètres d'abonnement</a>.
            </p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Ceci est un email automatique, merci de ne pas y répondre.
            </p>
            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
              © ${new Date().getFullYear()} Gobering - Votre plateforme de prise de rendez-vous médicaux
            </p>
          </div>
        </div>
      `,
    });
    
    return result;
  } catch (error) {
    console.error('Error sending free plan confirmation email:', error);
    throw error;
  }
}

export interface ErrorNotificationData {
  errorType: 'backend' | 'frontend';
  errorMessage: string;
  errorStack?: string;
  path?: string;
  method?: string;
  userId?: number;
  userEmail?: string;
  userAgent?: string;
  timestamp: Date;
  environment: string;
}

export async function sendErrorNotification(data: ErrorNotificationData) {
  const OPERATIONS_EMAIL = process.env.OPERATIONS_EMAIL || 'operations@gobering.com';
  
  const formattedTimestamp = new Intl.DateTimeFormat('fr-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'America/Toronto'
  }).format(data.timestamp);

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: OPERATIONS_EMAIL,
      subject: `🚨 [${data.environment.toUpperCase()}] Erreur ${data.errorType} - Gobering`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #dc2626, #991b1b); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🚨 Alerte Erreur</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Gobering - ${data.environment.toUpperCase()}</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <div style="background: linear-gradient(135deg, #fee2e2, #fecaca); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <h2 style="margin-top: 0; color: #7f1d1d; font-size: 18px;">Détails de l'erreur</h2>
              <p style="color: #7f1d1d; margin: 8px 0;"><strong>Type :</strong> ${data.errorType === 'backend' ? 'Backend (API)' : 'Frontend (React)'}</p>
              <p style="color: #7f1d1d; margin: 8px 0;"><strong>Date/Heure :</strong> ${formattedTimestamp}</p>
              <p style="color: #7f1d1d; margin: 8px 0;"><strong>Environnement :</strong> ${data.environment}</p>
              ${data.path ? `<p style="color: #7f1d1d; margin: 8px 0;"><strong>Chemin :</strong> ${data.method || ''} ${data.path}</p>` : ''}
            </div>
            
            ${data.userId ? `
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
              <h3 style="margin-top: 0; color: #1f2937; font-size: 16px;">👤 Utilisateur concerné</h3>
              <p style="color: #4b5563; margin: 8px 0;"><strong>ID :</strong> ${data.userId}</p>
              ${data.userEmail ? `<p style="color: #4b5563; margin: 8px 0;"><strong>Email :</strong> ${data.userEmail}</p>` : ''}
            </div>
            ` : ''}
            
            <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #fecaca;">
              <h3 style="margin-top: 0; color: #991b1b; font-size: 16px;">💬 Message d'erreur</h3>
              <pre style="background-color: white; padding: 15px; border-radius: 4px; overflow-x: auto; font-size: 13px; color: #991b1b; font-family: monospace; white-space: pre-wrap; word-wrap: break-word;">${data.errorMessage}</pre>
            </div>
            
            ${data.errorStack ? `
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
              <h3 style="margin-top: 0; color: #374151; font-size: 16px;">📚 Stack trace</h3>
              <pre style="background-color: white; padding: 15px; border-radius: 4px; overflow-x: auto; font-size: 12px; color: #374151; font-family: monospace; white-space: pre-wrap; word-wrap: break-word; max-height: 300px; overflow-y: auto;">${data.errorStack}</pre>
            </div>
            ` : ''}
            
            ${data.userAgent ? `
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
              <h3 style="margin-top: 0; color: #374151; font-size: 14px;">🌐 User Agent</h3>
              <p style="color: #6b7280; margin: 0; font-size: 12px; font-family: monospace; word-break: break-all;">${data.userAgent}</p>
            </div>
            ` : ''}
            
            <div style="background: linear-gradient(135deg, #fff7ed, #fed7aa); padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                ⚡ Action requise : Vérifiez les logs serveur et corrigez l'erreur si nécessaire.
              </p>
            </div>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Email automatique - Système de monitoring Gobering
            </p>
            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
              © ${new Date().getFullYear()} Gobering - Operations Team
            </p>
          </div>
        </div>
      `,
    });
    
    return result;
  } catch (error) {
    console.error('Error sending error notification email to operations:', error);
    // Don't throw - we don't want email failures to crash the app
  }
}
