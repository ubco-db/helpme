import { Role, User } from '@koh/common'
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * A utility function to merge Tailwind CSS classes with clsx.
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
 * Returns the role of the user in the course.
 */
export function getRoleInCourse(userInfo: User, courseId: number): Role {
  const role =
    userInfo?.courses.find((e) => e.course.id === courseId)?.role ??
    Role.STUDENT
  return role
}
