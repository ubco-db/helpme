import { UnauthorizedException } from '@nestjs/common';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function getAuthPayload(
  payload: unknown,
): Record<string, unknown> & { userId: number } {
  if (!isRecord(payload)) {
    throw new UnauthorizedException();
  }

  const userId = payload.userId;
  if (
    typeof userId !== 'number' ||
    !Number.isSafeInteger(userId) ||
    userId <= 0
  ) {
    throw new UnauthorizedException();
  }

  return { ...payload, userId };
}
