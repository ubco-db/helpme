import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * A utility function to merge Tailwind CSS classes with clsx.
 * Comes from shadcn
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
