import { Role, User } from '@koh/common'
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * A utility function to merge Tailwind CSS classes with clsx. "cn" stands for className.
 * Comes from shadcn
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * A utility function to convert a number to an ordinal string (e.g. 23 -> 23rd).
 * From https://gist.github.com/jlbruno/1535691/db35b4f3af3dcbb42babc01541410f291a8e8fac
 */
export function toOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'],
    v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/**
 * Transforms a name into initials.
 */
export function getInitialsFromName(name: string): string {
  if (name) {
    const initialsRegex =
      name.replace("'", '').replace('-', '').match(/\b\w/g) || []
    return (
      (initialsRegex.shift() || '') + (initialsRegex.pop() || '')
    ).toUpperCase()
  }
  return ''
}

const colorsToBeChosenFromForName = [
  '#1abc9c',
  '#2ecc71',
  '#3498db',
  '#9b59b6',
  '#34495e',
  '#16a085',
  '#27ae60',
  '#2980b9',
  '#8e44ad',
  '#2c3e50',
  '#f1c40f',
  '#e67e22',
  '#e74c3c',
  '#95a5a6',
  '#f39c12',
  '#d35400',
  '#c0392b',
  '#bdc3c7',
  '#7f8c8d',
]

export function nameToRGB(
  str: string,
  colors: string[] = colorsToBeChosenFromForName,
): string {
  if (!str) {
    throw new Error('Input string cannot be empty')
  }

  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0 // Convert to 32bit integer
  }

  return colors[Math.abs(hash) % colors.length]
}

/**
 * Convert a string to a hex color
 * @param str {string} The string to convert
 * @returns {string} The hex color
 */
export default function stringToHexColor(str: string): string {
  // Create a hash from the string
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }

  // Convert the hash to a hex string
  let color = '#'
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff
    color += `0${value.toString(16)}`.slice(-2)
  }

  return color
}

/**
 * Returns the role of the user in the course.
 */
export function getRoleInCourse(userInfo: User, courseId: number): Role {
  const role =
    userInfo?.courses.find((e) => e.course.id === courseId)?.role ??
    Role.STUDENT
  return role
}

/**
 * Use this to get the error message when catching an error and you have no idea what the error object looks like.
 * @param e error object
 * @returns an error message (or object)
 */
export function getErrorMessage(e: any): any {
  return (
    e.response?.data?.message ??
    e.response?.data ??
    e.body?.message ??
    e.message ??
    e
  )
}

/**
 * Gets the brightness of a color
 * @param color The color in hex
 * @returns a number between 0 and 255 representing the brightness of the color
 */
export function getBrightness(color: string): number {
  const rgb = parseInt(color.slice(1), 16)
  const r = (rgb >> 16) & 0xff
  const g = (rgb >> 8) & 0xff
  const b = (rgb >> 0) & 0xff
  return (r * 299 + g * 587 + b * 114) / 1000
}
