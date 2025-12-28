import twilio from "twilio";

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error("X_REPLIT_TOKEN not found for repl/depl");
  }

  connectionSettings = await fetch(
    "https://" +
      hostname +
      "/api/v2/connection?include_secrets=true&connector_names=twilio",
    {
      headers: {
        Accept: "application/json",
        X_REPLIT_TOKEN: xReplitToken,
      },
    },
  )
    .then((res) => res.json())
    .then((data) => data.items?.[0]);

  if (
    !connectionSettings ||
    !connectionSettings.settings.account_sid ||
    !connectionSettings.settings.api_key ||
    !connectionSettings.settings.api_key_secret
  ) {
    throw new Error("Twilio not connected");
  }
  return {
    accountSid: connectionSettings.settings.account_sid,
    apiKey: connectionSettings.settings.api_key,
    apiKeySecret: connectionSettings.settings.api_key_secret,
    phoneNumber: connectionSettings.settings.phone_number,
  };
}

export async function getTwilioClient() {
  const { accountSid, apiKey, apiKeySecret } = await getCredentials();
  return twilio(apiKey, apiKeySecret, {
    accountSid: accountSid,
  });
}

export async function getTwilioFromPhoneNumber() {
  const { phoneNumber } = await getCredentials();
  return phoneNumber;
}

interface AppointmentSMSDetails {
  patientPhone: string;
  patientFirstName: string;
  professionalFirstName: string;
  professionalLastName: string;
  profession: string;
  appointmentDate: string; // Format: "lundi 20 janvier 2025"
  appointmentTime: string; // Format: "14:00"
  serviceName?: string;
}

export async function sendAppointmentConfirmationSMS(
  details: AppointmentSMSDetails,
): Promise<void> {
  try {
    const client = await getTwilioClient();
    const fromNumber = await getTwilioFromPhoneNumber();

    // Format the message
    let message = `Bonjour ${details.patientFirstName},\n\n`;
    message += `Votre rendez-vous avec ${details.professionalFirstName} ${details.professionalLastName} (${details.profession}) est confirmé.\n\n`;
    message += `📅 ${details.appointmentDate}\n`;
    message += `⏰ ${details.appointmentTime}\n`;
    if (details.serviceName) {
      message += `📋 ${details.serviceName}\n`;
    }
    message += `\nÀ bientôt!\n- Gobering`;

    console.log(
      `[TWILIO SMS] Sending appointment confirmation to ${details.patientPhone}`,
    );
    console.log(`[TWILIO SMS] Message: ${message}`);

    await client.messages.create({
      body: message,
      from: fromNumber,
      to: details.patientPhone,
    });

    console.log(
      `[TWILIO SMS] Successfully sent SMS to ${details.patientPhone}`,
    );
  } catch (error) {
    console.error("[TWILIO SMS] Error sending SMS:", error);
    // Don't throw - we don't want SMS failures to block appointment creation
  }
}
