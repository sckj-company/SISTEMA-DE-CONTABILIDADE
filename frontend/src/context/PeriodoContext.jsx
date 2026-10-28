import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { empresaService } from '../services/api';

const CHAVE = 'periodoAuditoria';

const PeriodoContext = createContext(null);

const predefinido = () => ({
  empresaId: '',
  ano: String(new Date().getFullYear()),
  mes: '7',
});

export const PeriodoProvider = ({ children }) => {
  const location = useLocation();
  const [periodo, setPeriodo] = useState(() => {
    const base = predefinido();
    try {
      const guardado = JSON.parse(window.localStorage.getItem(CHAVE));
      if (guardado && typeof guardado === 'object') {
        return { ...base, ...guardado };
      }
    } catch (e) {
      // guarda corrompida — usa predefinição
    }
    return base;
  });

  const [empresas, setEmpresas] = useState([]);
  const [carregandoEmpresas, setCarregandoEmpresas] = useState(false);

  const carregarEmpresas = useCallback(async () => {
    const user = localStorage.getItem('user');
    if (!user) {
      setEmpresas([]);
      setPeriodo(predefinido());
      return [];
    }
    setCarregandoEmpresas(true);
    try {
      const res = await empresaService.getAll();
      const lista = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setEmpresas(lista);
      if (lista.length > 0) {
        setPeriodo((atual) => {
          const existe = lista.some((e) => String(e.id) === String(atual.empresaId));
          if (!existe || !atual.empresaId) {
            const sckj = lista.find((e) => e.nif === '5002830280');
            const novaId = String(sckj ? sckj.id : lista[0].id);
            return { ...atual, empresaId: novaId };
          }
          return atual;
        });
      } else {
        setPeriodo((atual) => ({ ...atual, empresaId: '' }));
      }
      return lista;
    } catch (err) {
      console.warn('Erro ao carregar empresas no contexto:', err);
      return [];
    } finally {
      setCarregandoEmpresas(false);
    }
  }, []);

  useEffect(() => {
    carregarEmpresas();

    const handleAuth = () => {
      carregarEmpresas();
    };

    window.addEventListener('storage', handleAuth);
    window.addEventListener('auth-changed', handleAuth);
    return () => {
      window.removeEventListener('storage', handleAuth);
      window.removeEventListener('auth-changed', handleAuth);
    };
  }, [carregarEmpresas]);

  const estadoEmpresasRef = React.useRef({ count: 0, loading: false });
  estadoEmpresasRef.current = { count: empresas.length, loading: carregandoEmpresas };

  // Se o utilizador estiver autenticado mas a lista de empresas ainda estiver vazia, tenta recarregar uma única vez ao mudar de rota
  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user && estadoEmpresasRef.current.count === 0 && !estadoEmpresasRef.current.loading) {
      carregarEmpresas();
    }
  }, [location.pathname, carregarEmpresas]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(periodo));
    } catch (e) {
      // sem localStorage disponível
    }
  }, [periodo]);

  // Empresa ativa calculada: se houver empresas, garante resolução instantânea
  const empresaAtual = React.useMemo(() => {
    if (!empresas || empresas.length === 0) return null;
    const match = empresas.find((e) => String(e.id) === String(periodo.empresaId));
    if (match) return match;
    const sckj = empresas.find((e) => e.nif === '5002830280');
    return sckj || empresas[0];
  }, [empresas, periodo.empresaId]);

  // Sincroniza o ID no período sempre que a empresa ativa for determinada
  useEffect(() => {
    if (empresaAtual && String(empresaAtual.id) !== String(periodo.empresaId)) {
      setPeriodo((atual) => ({ ...atual, empresaId: String(empresaAtual.id) }));
    }
  }, [empresaAtual, periodo.empresaId]);

  const atualizar = useCallback((parcial) => {
    setPeriodo((atual) => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const isAdmin = Boolean(user.is_admin || user.is_superuser || user.is_staff);
      const novo = { ...atual, ...parcial };

      // Se não for administrador, impede a troca para empresas fora da lista atribuída
      if (parcial.empresaId && !isAdmin && empresas.length > 0) {
        const pertence = empresas.some((e) => String(e.id) === String(parcial.empresaId));
        if (!pertence) {
          novo.empresaId = String(empresas[0].id);
        }
      }
      return novo;
    });
  }, [empresas]);

  const escolherSeAusente = useCallback((parcial) => {
    setPeriodo((atual) => {
      const emFalta = Object.keys(parcial).filter(
        (chave) => !atual[chave]
      );
      if (emFalta.length === 0) return atual;
      const novo = { ...atual };
      emFalta.forEach((chave) => {
        novo[chave] = parcial[chave];
      });
      return novo;
    });
  }, []);

  const valor = React.useMemo(
    () => ({
      ...periodo,
      empresas,
      empresaAtual,
      carregandoEmpresas,
      carregarEmpresas,
      atualizar,
      escolherSeAusente,
    }),
    [periodo, empresas, empresaAtual, carregandoEmpresas, carregarEmpresas, atualizar, escolherSeAusente]
  );

  return <PeriodoContext.Provider value={valor}>{children}</PeriodoContext.Provider>;
};

export const usePeriodo = () => useContext(PeriodoContext);

/** Semeia o contexto com ?empresa=&ano=&mes= uma única vez (montagem). */
export const usePeriodoDaUrl = () => {
  const [searchParams] = useSearchParams();
  const contexto = usePeriodo();

  useEffect(() => {
    if (!contexto) return;
    const parcial = {};
    const empresa = searchParams.get('empresa');
    const ano = searchParams.get('ano');
    const mes = searchParams.get('mes');
    if (empresa) parcial.empresaId = empresa;
    if (ano) parcial.ano = ano;
    if (mes) parcial.mes = mes;
    if (Object.keys(parcial).length > 0) {
      contexto.atualizar(parcial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
