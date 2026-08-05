// shared/lib/contactDisplay.ts — отображение контактов (user / organization)

import type { IContactDataItem } from '@/entities/user/profileApi';

export type ContactIconKind = 'email' | 'telegram' | 'phone' | 'site' | 'location' | 'user';

export function getContactIconKind(contact: IContactDataItem): ContactIconKind {
  const name = (
    contact.contactType?.name
    ?? contact.contactType?.localizedName
    ?? contact.contactType?.namePath
    ?? ''
  ).toLowerCase();

  if (name.includes('email') || name.includes('почт') || name.includes('mail')) return 'email';
  if (name.includes('telegram') || name.includes('tg') || name.includes('vk') || name.includes('вконтакте') || name.includes('whatsapp')) return 'telegram';
  if (name.includes('телефон') || name.includes('phone') || name.includes('мобил')) return 'phone';
  if (name.includes('сайт') || name.includes('site') || name.includes('web')) return 'site';
  if (name.includes('город') || name.includes('city') || name.includes('location')) return 'location';
  return 'user';
}

export function isContactLink(contact: IContactDataItem): boolean {
  const value = contact.value.trim();
  const name = (
    contact.contactType?.name
    ?? contact.contactType?.localizedName
    ?? contact.contactType?.namePath
    ?? ''
  ).toLowerCase();

  if (name.includes('email') || name.includes('почт') || name.includes('mail')) {
    return value.includes('@');
  }
  if (name.includes('telegram') || name.includes('tg') || name.includes('vk') || name.includes('сайт') || name.includes('site')) {
    return true;
  }
  return /^https?:\/\//i.test(value);
}

export function formatContactHref(contact: IContactDataItem): string | null {
  const value = contact.value.trim();
  const name = (
    contact.contactType?.name
    ?? contact.contactType?.localizedName
    ?? contact.contactType?.namePath
    ?? ''
  ).toLowerCase();

  if (/^https?:\/\//i.test(value)) return value;
  if (name.includes('email') || name.includes('почт') || name.includes('mail')) {
    return `mailto:${value}`;
  }
  if (name.includes('telegram') || name.includes('tg')) {
    const handle = value.replace(/^@/, '');
    return `https://t.me/${handle}`;
  }
  return null;
}
