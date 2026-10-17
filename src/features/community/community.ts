import type { LanguageId } from "../i18n/i18n";

/**
 * Happy's community channels.
 *
 * There are only TWO channels:
 *  - German  → for players running the game in German
 *  - English → for EVERY other language (it is not possible to run a channel
 *              per language, so English is the catch-all)
 */
export const WHATSAPP_CHANNEL_DE = "https://whatsapp.com/channel/0029Vb9Kq0zATRSeWo5Owu1s";
export const WHATSAPP_CHANNEL_EN = "https://whatsapp.com/channel/0029Vb9KhGfEVccIC2037f42";

export function isGerman(language: LanguageId | string): boolean {
  return typeof language === "string" && language.toLowerCase().startsWith("de");
}

/** The right channel for the player's language (German is the only exception). */
export function getCommunityLink(language: LanguageId | string): string {
  return isGerman(language) ? WHATSAPP_CHANNEL_DE : WHATSAPP_CHANNEL_EN;
}

/** Happy's very first line — localized. */
export function getCommunityGreeting(language: LanguageId | string, dogName: string): string {
  if (isGerman(language)) {
    return `Wuff, mein bester Freund! Ich bin ${dogName}. Was machen wir heute zusammen? 🐾`;
  }
  return `Woof! Hey best friend! I'm ${dogName}! What are we going to do together today? 🐾`;
}

/** The follow-up line that invites the player into the community. */
export function getCommunityInvite(language: LanguageId | string): string {
  if (isGerman(language)) {
    return `Tritt meiner Community bei – komm in meinen WhatsApp-Kanal! 🐾\n${WHATSAPP_CHANNEL_DE}`;
  }
  return `Join my community — join my WhatsApp channel! 🐾\n${WHATSAPP_CHANNEL_EN}`;
}

/** Short label for the pinned channel button. */
export function getCommunityButtonLabel(language: LanguageId | string): string {
  return isGerman(language) ? "WhatsApp-Kanal beitreten" : "Join the WhatsApp channel";
}

/** Tiny caption under the button. */
export function getCommunityCaption(language: LanguageId | string): string {
  return isGerman(language)
    ? "Neuigkeiten & Updates über Happy"
    : "News & updates about Happy";
}
