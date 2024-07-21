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
