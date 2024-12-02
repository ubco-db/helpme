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

/**
 * Checks a single name against a series of names for similarity
 * @param name
 * @param others
 */
export function checkNameAgainst(name: string, others: string[]) {
  return others.map((o) => o.toLowerCase()).includes(name.toLowerCase())
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
    e.response?.data?.message ?? // e.response.data is from axios
    e.response?.data?.error ??
    e.response?.data ?? // needed for error messages for creating/deleting question tags
    e.body?.message ??
    e.message ??
    e.statusText ?? // response.statusText from fetch
    JSON.stringify(e) ??
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

/**
 * @name getCroppedImg
 * @description Crops an image to the specified dimensions and returns a File object
 * @param imageSrc
 * @param crop
 * @param originalFileType
 * @returns a Promise that resolves to a File object of the cropped image
 */
export function getCroppedImg(
  imageSrc: string,
  crop: { width: number; height: number; x: number; y: number },
  originalFileType: string, // Pass the original file type
): Promise<File> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.src = imageSrc

    image.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      const { width, height, x, y } = crop

      // Set canvas width and height to match the cropped area
      canvas.width = width
      canvas.height = height

      // Draw the cropped area onto the canvas
      ctx.drawImage(
        image,
        x,
        y,
        width,
        height, // Source coordinates and dimensions
        0,
        0,
        width,
        height, // Destination coordinates and dimensions
      )

      // Choose the correct file extension and mime type based on the original file
      let fileExtension = 'png' // default to png
      let mimeType = 'image/png' // default to png

      if (
        originalFileType.includes('jpeg') ||
        originalFileType.includes('jpg')
      ) {
        fileExtension = 'jpg'
        mimeType = 'image/jpeg'
      } else if (originalFileType.includes('png')) {
        fileExtension = 'png'
        mimeType = 'image/png'
      } else if (originalFileType.includes('webp')) {
        fileExtension = 'webp'
        mimeType = 'image/webp'
      } else if (originalFileType.includes('avif')) {
        fileExtension = 'avif'
        mimeType = 'image/avif'
      } else if (originalFileType.includes('gif')) {
        fileExtension = 'gif'
        mimeType = 'image/gif'
      } else if (originalFileType.includes('tiff')) {
        fileExtension = 'tiff'
        mimeType = 'image/tiff'
      } else if (originalFileType.includes('svg')) {
        fileExtension = 'svg'
        mimeType = 'image/svg+xml'
      }

      // Convert the canvas content to a Blob and then to a File
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'))
          return
        }

        // Convert Blob to File, dynamically setting name and mime type
        const file = new File([blob], `cropped-image.${fileExtension}`, {
          type: mimeType,
        })
        resolve(file)
      }, mimeType) // Pass the appropriate mimeType here
    }

    image.onerror = () => {
      reject(new Error('Failed to load image'))
    }
  })
}
