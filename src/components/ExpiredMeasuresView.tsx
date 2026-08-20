import React, { useState, useMemo } from 'react';
import { 
  Clock, 
  Search, 
  ArrowLeft, 
  UserCheck, 
  Calendar, 
  FileText, 
  AlertTriangle,
  Layers,
  ChevronDown,
  ChevronUp,
  History,
  Trash2
} from 'lucide-react';
import { Victim } from '../types';
import { safeFormatDate } from '../lib/utils';

export interface GroupedExpiredVictim {
  key: string;
  name: string;
  cpf: string;
  phone: string;
  address: string;
  riskLevel: string;
  totalOrdersCount: number;
  orders: {
    victimId: string;
    orderNumber: string;
    defendantName?: string;
    judgeName?: string;
    issueDate?: string;
    expiryDate?: string;
    restrictions?: string;
    status?: string;
    createdAt?: string;
  }[];
}

interface ExpiredMeasuresViewProps {
  victims: Victim[];
  onBackToActive: () => void;
  onEditVictim: (victim: Victim) => void;
  onDeleteVictim?: (victim: Victim) => void;
}

export const ExpiredMeasuresView: React.FC<ExpiredMeasuresViewProps> = ({
  victims,
  onBackToActive,
  onEditVictim,
  onDeleteVictim
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  // Identifica se uma medida está expirada (status === 'Expirada' ou data de expiração anterior a hoje, e não está revogada)
  const isOrderExpired = (victim: Victim): boolean => {
    if (victim.protectiveOrder?.status === 'Expirada') return true;
    if (victim.protectiveOrder?.status === 'Revogada') return false;
    
    if (victim.protectiveOrder?.expiryDate) {
      if (/indeterminado/i.test(victim.protectiveOrder.expiryDate)) {
        return false;
      }
      const expDate = new Date(victim.protectiveOrder.expiryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (!isNaN(expDate.getTime()) && expDate < today) {
        return true;
      }
    }
    return false;
  };

  // Agrupa todas as medidas expiradas por CPF ou Nome normalizado
  const groupedExpired: GroupedExpiredVictim[] = useMemo(() => {
    const expiredVictims = victims.filter(isOrderExpired);
    const groupMap = new Map<string, GroupedExpiredVictim>();

    expiredVictims.forEach(v => {
      const cleanCpf = (v.cpf || '').replace(/\D/g, '');
      const cleanName = (v.name || '').trim().toLowerCase();
      const groupKey = cleanCpf && cleanCpf.length >= 8 ? `cpf_${cleanCpf}` : `name_${cleanName}`;

      const existing = groupMap.get(groupKey);

      const orderItem = {
        victimId: v.id,
        orderNumber: v.protectiveOrder?.orderNumber || 'Não informado',
        defendantName: v.protectiveOrder?.defendantName || 'Não informado',
        judgeName: v.protectiveOrder?.judgeName || 'Não informado',
        issueDate: v.protectiveOrder?.issueDate,
        expiryDate: v.protectiveOrder?.expiryDate,
        restrictions: v.protectiveOrder?.restrictions,
        status: v.protectiveOrder?.status || 'Expirada',
        createdAt: v.createdAt
      };

      if (existing) {
        existing.totalOrdersCount += 1;
        existing.orders.push(orderItem);
        if (!existing.phone && v.phone) existing.phone = v.phone;
        if (!existing.address && v.address) existing.address = v.address;
        if (v.riskLevel === 'Alto') existing.riskLevel = 'Alto';
      } else {
        groupMap.set(groupKey, {
          key: groupKey,
          name: v.name,
          cpf: v.cpf || 'Não informado',
          phone: v.phone || 'Não informado',
          address: v.address || 'Não informado',
          riskLevel: v.riskLevel,
          totalOrdersCount: 1,
          orders: [orderItem]
        });
      }
    });

    // Ordenar alfabeticamente por nome
    return Array.from(groupMap.values()).sort((a, b) => 
      (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' })
    );
  }, [victims]);

  // Filtro de busca
  const filteredExpired = useMemo(() => {
    if (!searchTerm.trim()) return groupedExpired;
    const term = searchTerm.toLowerCase().trim();

    return groupedExpired.filter(g => {
      const matchName = g.name.toLowerCase().includes(term);
      const matchCpf = g.cpf.toLowerCase().includes(term);
      const matchOrder = g.orders.some(o => 
        (o.orderNumber && o.orderNumber.toLowerCase().includes(term)) ||
        (o.defendantName && o.defendantName.toLowerCase().includes(term)) ||
        (o.judgeName && o.judgeName.toLowerCase().includes(term))
      );
      return matchName || matchCpf || matchOrder;
    });
  }, [groupedExpired, searchTerm]);

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const totalExpiredOrders = useMemo(() => {
    return victims.filter(isOrderExpired).length;
  }, [victims]);

  return (
    <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
      
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono uppercase tracking-wider">
            <span className="hover:text-slate-350 cursor-pointer" onClick={onBackToActive}>Início</span>
            <span>/</span>
            <span className="hover:text-slate-350 cursor-pointer" onClick={onBackToActive}>Assistidas</span>
            <span>/</span>
            <span className="text-amber-400 font-bold">Medidas Expiradas</span>
          </div>
          <h2 className="text-2xl font-black text-slate-100 uppercase tracking-wide flex items-center gap-3 mt-1">
            <div className="w-9 h-9 rounded-xl bg-amber-950/80 border border-amber-800/60 flex items-center justify-center text-amber-400 shadow-md">
              <Clock className="w-5 h-5" />
            </div>
            MEDIDAS PROTETIVAS EXPIRADAS
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Histórico de medidas com prazo de vigência judicial vencido. Registros agrupados por CPF e nome da assistida.
          </p>
        </div>

        <button
          onClick={onBackToActive}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:border-slate-700"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-400" />
          Voltar às Assistidas Ativas
        </button>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-950 p-4 rounded-2xl border border-amber-900/30 flex items-center justify-between shadow-md">
          <div>
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 block">Total de Medidas Expiradas</span>
            <span className="text-2xl font-black text-amber-400 mt-0.5 block">{totalExpiredOrders}</span>
            <span className="text-[10px] text-slate-500">Prazos de vigência concluídos</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-900/50 flex items-center justify-center text-amber-400">
            <History className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between shadow-md">
          <div>
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 block">Assistidas com Medidas Vencidas</span>
            <span className="text-2xl font-black text-slate-100 mt-0.5 block">{groupedExpired.length}</span>
            <span className="text-[10px] text-slate-500">Pessoas únicas com histórico expirado</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Busca */}
      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 flex items-center gap-3 text-xs">
        <div className="flex-1 flex items-center bg-slate-900 rounded-xl px-3.5 py-1.5 border border-slate-800">
          <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Pesquisar por nome da assistida, CPF, número do processo ou réu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent text-xs py-1.5 focus:outline-none placeholder-slate-500 text-slate-200"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="text-slate-400 hover:text-white text-xs font-bold px-1"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Lista de Registros Agrupados */}
      <div className="space-y-4">
        {filteredExpired.map((group) => {
          const isExpanded = expandedKeys[group.key] ?? true;
          const originalVictim = victims.find(v => v.id === group.orders[0]?.victimId);

          return (
            <div 
              key={group.key}
              className="bg-slate-950 rounded-2xl border border-amber-900/40 overflow-hidden shadow-xl hover:border-amber-700/60 transition-all duration-200"
            >
              {/* Cabeçalho do Grupo */}
              <div 
                className="bg-slate-900/90 p-4 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none"
                onClick={() => toggleExpand(group.key)}
              >
                <div className="flex items-start md:items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-800/60 flex items-center justify-center text-amber-400 shrink-0 mt-0.5 md:mt-0">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-base font-black text-slate-100 tracking-tight">
                        {group.name}
                      </h3>
                      <span className="inline-flex items-center gap-1 bg-amber-950/80 border border-amber-800/60 text-amber-300 text-[10.5px] font-extrabold px-2 py-0.5 rounded-md shadow-sm">
                        <Clock className="w-3 h-3 text-amber-400" />
                        {group.totalOrdersCount} Medida{group.totalOrdersCount > 1 ? 's' : ''} Expirada{group.totalOrdersCount > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-3 mt-1 flex-wrap">
                      <span>CPF: <strong className="text-slate-300">{group.cpf}</strong></span>
                      <span className="text-slate-600">•</span>
                      <span>Tel: <strong className="text-slate-300">{group.phone}</strong></span>
                      <span className="text-slate-600">•</span>
                      <span className="truncate max-w-xs" title={group.address}>Endereço: <strong className="text-slate-300">{group.address}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  {originalVictim && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditVictim(originalVictim);
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700/60"
                        title="Editar cadastro geral da assistida"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Editar Assistida
                      </button>
                      {onDeleteVictim && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteVictim(originalVictim);
                          }}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-rose-700 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer border border-slate-700/60"
                          title="Excluir Assistida e Medidas"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          <span className="hidden sm:inline">Excluir</span>
                        </button>
                      )}
                    </>
                  )}

                  <div className="p-1.5 text-slate-400 hover:text-white">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
              </div>

              {/* Corpo com a lista de medidas expiradas da pessoa */}
              {isExpanded && (
                <div className="p-4 space-y-3 bg-slate-950/60">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between pb-1">
                    <span>Histórico de Medidas Vencidas ({group.orders.length})</span>
                    <span className="font-mono text-slate-500">Agrupamento Ativo</span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {group.orders.map((ord, idx) => {
                      const vObj = victims.find(v => v.id === ord.victimId);

                      return (
                        <div 
                          key={ord.victimId || idx}
                          onClick={() => vObj && onEditVictim(vObj)}
                          className="bg-slate-900/90 rounded-xl border border-slate-800 p-3.5 space-y-2.5 hover:border-amber-500/50 hover:bg-slate-850/80 transition-all cursor-pointer shadow-md"
                          title="Clique para abrir detalhes e editar este registro"
                        >
                          <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2">
                            <div>
                              <span className="text-[9.5px] uppercase font-black text-amber-400 tracking-wider block">
                                MEDIDA EXPIRADA #{idx + 1}
                              </span>
                              <h4 className="text-xs font-black font-mono text-slate-100 mt-0.5">
                                Processo: {ord.orderNumber}
                              </h4>
                            </div>

                            <span className="px-2 py-0.5 rounded text-[9.5px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              Expirada
                            </span>
                          </div>

                          <div className="space-y-1 text-xs font-mono">
                            <div className="text-slate-300 text-[11px] truncate">
                              <strong className="text-slate-400 font-sans">Réu / Agressor:</strong> {ord.defendantName}
                            </div>
                            <div className="text-slate-300 text-[11px] truncate">
                              <strong className="text-slate-400 font-sans">Juiz(a) / Vara:</strong> {ord.judgeName}
                            </div>
                            <div className="flex items-center gap-4 text-[10.5px] text-slate-400 flex-wrap">
                              {ord.expiryDate && (
                                <span className="text-amber-300">
                                  <strong className="text-slate-500 font-sans">Data de Expiração:</strong> {safeFormatDate(ord.expiryDate)}
                                </span>
                              )}
                              {ord.issueDate && (
                                <span><strong className="text-slate-500 font-sans">Data de Expedição:</strong> {safeFormatDate(ord.issueDate)}</span>
                              )}
                            </div>
                            {ord.restrictions && (
                              <div className="text-[10px] text-slate-400 font-sans pt-1 border-t border-slate-800/60 leading-snug">
                                <strong>Restrições Aplicadas:</strong> {ord.restrictions}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[10px]">
                            <span className="text-slate-500">Clique para abrir ficha e editar</span>
                            <span className="text-amber-400 font-bold hover:underline">Abrir Ficha / Edição →</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredExpired.length === 0 && (
          <div className="py-16 text-center text-slate-400 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
              <Clock className="w-6 h-6" />
            </div>
            <p className="font-bold text-sm text-slate-300">Nenhuma medida protetiva expirada encontrada.</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Quando o prazo de vigência de uma medida protetiva for atingido ou o status for definido como expirado, ela será arquivada e listada nesta página.
            </p>
          </div>
        )}
      </div>

    </main>
  );
};

export default ExpiredMeasuresView;
