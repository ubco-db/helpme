import { UnauthorizedException } from '@nestjs/common';

export const APP_AUTH_KIND = 'app-auth' as const;
export const LOGIN_ENTRY_KIND = 'login-entry' as const;

type AuthTokenKind = typeof APP_AUTH_KIND | typeof LOGIN_ENTRY_KIND;
type AuthTokenPayload<K extends AuthTokenKind> = Record<string, unknown> & {
  kind: K;
  userId: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseAuthTokenPayload<K extends AuthTokenKind>(
  payload: unknown,
  expectedKind: K,
): AuthTokenPayload<K> {
  if (!isRecord(payload)) {
    throw new UnauthorizedException();
  }

  const userId = payload.userId;
  if (
    payload.kind !== expectedKind ||
    typeof userId !== 'number' ||
    !Number.isSafeInteger(userId) ||
    userId <= 0
  ) {
    throw new UnauthorizedException();
  }

  return { ...payload, kind: expectedKind, userId };
}

export function getAppAuthPayload(
  payload: unknown,
): AuthTokenPayload<typeof APP_AUTH_KIND> {
  return parseAuthTokenPayload(payload, APP_AUTH_KIND);
}

export function getLoginEntryUserId(payload: unknown): number {
  return parseAuthTokenPayload(payload, LOGIN_ENTRY_KIND).userId;
}
