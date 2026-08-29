/**
 * Extracts a human-readable error message from an HTTP fetch Response.
 * Handles JSON responses (including nested error objects and array messages),
 * plain text responses, and falls back gracefully to status text or a default error message.
 *
 * @param response - The Fetch Response object.
 * @param defaultMessage - Optional fallback message if no specific error text is found.
 * @returns A promise resolving to the extracted error message string.
 */
export async function getFetchErrorMessage(
  response: Response,
  defaultMessage = 'An error occurred',
): Promise<string> {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.toLowerCase().includes('application/json')) {
    try {
      const data = await response.json();
      const parsedMessage = extractMessageFromData(data);
      if (parsedMessage) {
        return parsedMessage;
      }
    } catch (error) {
      console.error('Failed to parse JSON error response:', error);
    }
  } else {
    try {
      const text = await response.text();
      if (text && text.trim()) {
        return text.trim();
      }
    } catch (error) {
      console.error('Failed to parse text error response:', error);
    }
  }

  return response.statusText || defaultMessage;
}

/**
 * Helper function to extract a string message from arbitrary JSON response payload.
 */
function extractMessageFromData(data: unknown): string | null {
  if (!data) return null;

  if (typeof data === 'string' && data.trim()) {
    return data.trim();
  }

  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;

    // Handle `message` field (string or array of strings, e.g., NestJS validation errors)
    if (typeof obj.message === 'string' && obj.message.trim()) {
      return obj.message.trim();
    }
    if (Array.isArray(obj.message) && obj.message.length > 0) {
      return obj.message.filter((m) => typeof m === 'string').join(', ');
    }

    // Handle `error` field (string or nested object, e.g., OpenAI error format)
    if (typeof obj.error === 'string' && obj.error.trim()) {
      return obj.error.trim();
    }
    if (typeof obj.error === 'object' && obj.error !== null) {
      const nestedMsg = extractMessageFromData(obj.error);
      if (nestedMsg) return nestedMsg;
    }

    // Handle `details` or `detail` field
    if (typeof obj.details === 'string' && obj.details.trim()) {
      return obj.details.trim();
    }
    if (typeof obj.detail === 'string' && obj.detail.trim()) {
      return obj.detail.trim();
    }
  }

  return null;
}
