// entities/agreement/api.ts
// Анонимные соглашения (client JWT)

import { apiClient } from '@/shared/api/client';

/** Подтверждён ли возраст 18+ для текущего анонимного клиента */
export async function getAnonymousAgeAgreement(): Promise<boolean> {
  return apiClient.getStatusWithClientJwt('/api/agreements/age/anonymous/get');
}

/** Подтвердить возраст 18+ для анонимного клиента */
export async function agreeAnonymousAge(): Promise<void> {
  await apiClient.getWithClientJwt('/api/agreements/age/anonymous/agree');
}
