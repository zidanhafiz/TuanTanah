import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import id from './locales/id.json'

export const SUPPORTED_LANGUAGES = ['en', 'id'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

// Per-player language: detected from localStorage (a returning player's choice)
// then the browser, falling back to Indonesian since the game is ID-themed.
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      id: { translation: id },
    },
    supportedLngs: SUPPORTED_LANGUAGES,
    fallbackLng: 'id',
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'tuan-tanah:lang',
      caches: ['localStorage'],
    },
  })

export default i18n
