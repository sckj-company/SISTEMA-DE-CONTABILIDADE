import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import pt from './locales/pt.json';
import en from './locales/en.json';
import zh from './locales/zh.json';

const resources = {
  pt: { translation: pt },
  en: { translation: en },
  zh: { translation: zh },
};

const TITULOS_DOCUMENTO = {
  pt: 'Sistema de Reconciliação Contabilística e Fiscal',
  en: 'Accounting & Tax Reconciliation System',
  zh: '会计与税务对账系统',
};

const atualizarAtributosDocumento = (lng) => {
  if (typeof document === 'undefined') return;
  const code = String(lng || 'pt').substring(0, 2);
  document.documentElement.lang = code === 'zh' ? 'zh-CN' : code === 'en' ? 'en' : 'pt';
  if (TITULOS_DOCUMENTO[code]) {
    document.title = TITULOS_DOCUMENTO[code];
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'pt',
    supportedLngs: ['pt', 'en', 'zh'],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
  });

atualizarAtributosDocumento(i18n.language);
i18n.on('languageChanged', atualizarAtributosDocumento);

export default i18n;