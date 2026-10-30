import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import pt from './locales/pt.json';
import en from './locales/en.json';
import zh from './locales/zh.json';

/**
 * Constrói dinamicamente o dicionário bilingue Português / Chinês (PT / 中文)
 * lado a lado para todas as páginas e componentes do sistema.
 */
const buildBilingual = (ptObj, zhObj, keyPath = '') => {
  if (typeof ptObj === 'string') {
    const p = ptObj.trim();
    const z = (typeof zhObj === 'string' ? zhObj : '').trim();
    if (!z || p === z) return ptObj;
    // Rótulos puros dos botões do seletor de idiomas
    if (keyPath.endsWith('langBilingual')) return 'Português / 中文';
    if (keyPath.endsWith('langPt')) return 'Português';
    if (keyPath.endsWith('langChinese')) return '中文';
    if (keyPath.endsWith('langEn')) return 'English';
    return `${ptObj} / ${z}`;
  }
  if (ptObj && typeof ptObj === 'object' && !Array.isArray(ptObj)) {
    const res = {};
    const allKeys = new Set([...Object.keys(ptObj), ...(zhObj && typeof zhObj === 'object' ? Object.keys(zhObj) : [])]);
    for (const k of allKeys) {
      res[k] = buildBilingual(ptObj[k], zhObj ? zhObj[k] : undefined, keyPath ? `${keyPath}.${k}` : k);
    }
    return res;
  }
  return ptObj || zhObj;
};

const bi = buildBilingual(pt, zh);

const resources = {
  bi: { translation: bi },
  pt: { translation: pt },
  en: { translation: en },
  zh: { translation: zh },
};

const TITULOS_DOCUMENTO = {
  bi: 'Sistema de Reconciliação Contabilística e Fiscal / 会计与税务对账系统',
  pt: 'Sistema de Reconciliação Contabilística e Fiscal',
  en: 'Accounting & Tax Reconciliation System',
  zh: '会计与税务对账系统',
};

const atualizarAtributosDocumento = (lng) => {
  if (typeof document === 'undefined') return;
  const raw = String(lng || 'bi').toLowerCase();
  const code = raw === 'bi' || raw === 'pt-zh' ? 'bi' : raw.substring(0, 2);
  document.documentElement.lang = code === 'zh' ? 'zh-CN' : code === 'en' ? 'en' : code === 'bi' ? 'zh-CN' : 'pt';
  if (TITULOS_DOCUMENTO[code]) {
    document.title = TITULOS_DOCUMENTO[code];
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'bi',
    supportedLngs: ['bi', 'pt', 'en', 'zh'],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  });

atualizarAtributosDocumento(i18n.language);
i18n.on('languageChanged', atualizarAtributosDocumento);

export default i18n;
