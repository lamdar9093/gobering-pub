import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(priceInCents: number): string {
  const dollars = priceInCents / 100;
  // If the price has no cents (e.g., 80.00), show just "80$"
  // If it has cents (e.g., 80.50), show "80,50$"
  if (dollars % 1 === 0) {
    return `${Math.floor(dollars)}$`;
  }
  return `${dollars.toFixed(2).replace('.', ',')}$`;
}
