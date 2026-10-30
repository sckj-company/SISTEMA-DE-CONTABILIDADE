import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { kzExacto } from '../../utils/formato';

/**
 * Tabela de taxas e regimes em vigor.
 *
 * Vinha escrita à mão no JSX, o que a fazia envelhecer sem ninguém dar conta
 * — e divergir das percentagens que os motores realmente usavam. Agora vem de
 * `/api/taxas/`, da mesma tabela que o Rule Engine consulta: o que se lê aqui
 * é exactamente o que o sistema aplica.
 */

const pct = (taxa) => `${(Number(taxa) * 100).toFixed(2).replace(/\.?0+$/, '')}%`;

const Seccao = ({ titulo, children }) => (
  <div style={{ marginBottom: 26 }}>
    <h6
      className="fw-600 color-dark mb-10"
      style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}
    >
      {titulo}
    </h6>
    {children}
  </div>
);

const Tabela = ({ cabecalhos, linhas }) => (
  <div className="table-responsive">
    <table className="table table-bordered mb-0" style={{ fontSize: 13, background: '#ffffff' }}>
      <thead style={{ background: '#ffffff' }}>
        <tr>
          {cabecalhos.map((c, idx) => (
            <th key={idx} style={{ fontSize: 12, background: '#ffffff', color: '#1e293b' }}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody style={{ background: '#ffffff' }}>
        {linhas.map((linha, i) => (
          <tr key={i} style={{ background: '#ffffff' }}>
            {linha.map((celula, j) => (
              <td key={j} style={{ background: '#ffffff' }}>{celula}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Taxas = () => {
  const { t } = useTranslation();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api
      .get('/taxas/')
      .then((r) => setDados(r.data))
      .catch(() => setErro(t('taxasUi.loadError', 'Não foi possível carregar a tabela de taxas.')));
  }, [t]);

  if (erro) {
    return <div className="alert alert-danger" style={{ background: '#ffffff', border: '1px solid #fecaca', color: '#dc2626' }}>{erro}</div>;
  }
  if (!dados) {
    return <p className="text-muted" style={{ fontSize: 13 }}>{t('common.loading', 'A carregar...')}</p>;
  }

  return (
    <div className="card card-default" style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}>
      <div className="card-body" style={{ padding: 24, background: '#ffffff' }}>
        <div className="d-flex justify-content-between align-items-center flex-wrap mb-20" style={{ gap: 10 }}>
          <div>
            <h5 className="fw-700 color-dark mb-2" style={{ fontSize: 15 }}>
              {t('taxasUi.title', 'Taxas e regimes em vigor')}
            </h5>
            <span className="text-muted" style={{ fontSize: 12.5 }}>
              {t('taxasUi.subtitle', 'São estas as percentagens que os motores aplicam.')}
            </span>
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              background: '#ffffff',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
              padding: '4px 12px',
              borderRadius: 12,
            }}
          >
            {dados.vigencia}
          </span>
        </div>

        <Seccao titulo={t('taxasUi.vatRegimes', 'Regimes de IVA')}>
          <Tabela
            cabecalhos={[
              t('taxasUi.headerRegime', 'Regime'),
              t('taxasUi.headerWhenApplies', 'Quando se aplica'),
              t('taxasUi.headerHowPays', 'Como paga')
            ]}
            linhas={dados.regimes_iva.map((r) => [
              <strong>{r.nome}</strong>,
              r.limite,
              r.resumo,
            ])}
          />
        </Seccao>

        <Seccao titulo={t('taxasUi.vatRates', 'Taxas de IVA')}>
          <Tabela
            cabecalhos={[
              t('taxasUi.headerRate', 'Taxa'),
              t('taxasUi.headerOperation', 'Operação'),
              t('taxasUi.headerLegalBase', 'Base legal')
            ]}
            linhas={dados.iva.map((tItem) => [
              <strong>{pct(tItem.taxa)}</strong>,
              tItem.descricao,
              <span style={{ fontSize: 11.5 }} className="text-muted">
                {tItem.base_legal}
              </span>,
            ])}
          />
        </Seccao>

        <Seccao titulo={t('taxasUi.industrialTax', 'Imposto Industrial')}>
          <Tabela
            cabecalhos={[
              t('taxasUi.headerRate', 'Taxa'),
              t('taxasUi.headerAppliesTo', 'Aplica-se a'),
              t('taxasUi.headerLegalBase', 'Base legal')
            ]}
            linhas={dados.imposto_industrial.map((tItem) => [
              <strong>{pct(tItem.taxa)}</strong>,
              tItem.descricao,
              <span style={{ fontSize: 11.5 }} className="text-muted">
                {tItem.base_legal}
              </span>,
            ])}
          />
        </Seccao>

        <Seccao titulo={`IRT — ${t('taxasUi.irtExemption', 'isento até')} ${kzExacto(dados.irt.isencao_mensal)} Kz/${t('common.month', 'mês')}`}>
          <Tabela
            cabecalhos={[
              t('taxasUi.headerUpTo', 'Até (Kz)'),
              t('taxasUi.headerFixedPart', 'Parcela fixa'),
              t('taxasUi.headerRate', 'Taxa'),
              t('taxasUi.headerOverExcess', 'Sobre o excesso de')
            ]}
            linhas={dados.irt.escaloes.map((e) => [
              e.ate ? kzExacto(e.ate) : t('taxasUi.above', 'acima'),
              kzExacto(e.parcela_fixa),
              pct(e.taxa),
              kzExacto(e.excesso_sobre),
            ])}
          />
          <p className="text-muted" style={{ fontSize: 11.5, marginTop: 8 }}>
            {dados.irt.base_legal} · {t('taxasUi.groupB', 'Grupo B (prestadores)')}: {pct(dados.irt.grupo_b)}
          </p>
        </Seccao>

        <Seccao titulo={t('taxasUi.otherRates', 'Outras taxas')}>
          <Tabela
            cabecalhos={[t('taxasUi.headerRate', 'Taxa'), t('taxasUi.headerDescription', 'Descrição')]}
            linhas={[
              [
                <strong>{pct(dados.seguranca_social.patronal)}</strong>,
                `${t('taxasUi.socialSecurityEmployer', 'Segurança Social — entidade patronal')} (${dados.seguranca_social.base_legal})`,
              ],
              [
                <strong>{pct(dados.seguranca_social.trabalhador)}</strong>,
                t('taxasUi.socialSecurityWorker', 'Segurança Social — trabalhador, retido no salário'),
              ],
              [
                <strong>{pct(dados.retencao_servicos)}</strong>,
                t('taxasUi.withholdingServices', 'Retenção na fonte sobre prestações de serviço'),
              ],
              [
                <strong>{pct(dados.imposto_predial.arrendamento_efectiva)}</strong>,
                `${t('taxasUi.propertyTaxRents', 'Imposto Predial sobre rendas')} — ${pct(
                  dados.imposto_predial.arrendamento_nominal
                )} sobre ${pct(1 - Number(dados.imposto_predial.deducao_conservacao))} ${t('taxasUi.ofRent', 'da renda')}`,
              ],
              [
                <strong>{pct(dados.imposto_selo_quitacao)}</strong>,
                t('taxasUi.stampTaxReceipts', 'Imposto do Selo sobre quitações não sujeitas a IVA'),
              ],
            ]}
          />
        </Seccao>

        <p
          className="text-muted mb-0"
          style={{ fontSize: 11.5, borderTop: '1px solid #eef0f3', paddingTop: 12 }}
        >
          <i className="la la-info-circle mr-5"></i>
          {dados.aviso}
        </p>
      </div>
    </div>
  );
};

export default Taxas;
