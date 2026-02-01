export const LAMDAA_EMAILS: string[] = [
  "leuz20028@yahoo.fr",
  "sodasarrdieng@gmail.com",
  "simrodrigue@outlook.com",
];

export function isLamdaaEmail(email: string): boolean {
  return LAMDAA_EMAILS.includes(email.toLowerCase().trim());
}
