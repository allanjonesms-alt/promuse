import React, { useState, useMemo } from 'react';
import { 
  FileX, 
  Search, 
  ArrowLeft, 
  UserCheck, 
  ShieldCheck, 
  Calendar, 
  FileText, 
  AlertCircle, 
  RotateCcw,
  CheckCircle,
  Building,
  Hash,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  Trash2
} from 'lucide-react';
import { Victim, ProtectiveOrder } from '../types';
import { safeFormatDate } from '../lib/utils';

export interface GroupedRevokedVictim {
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
    revocationNoticeNumber?: string;
    revocationDate?: string;
    createdAt?: string;
  }[];
}

interface RevokedMeasuresViewProps {
  victims: Victim[];
  onBackToActive: () => void;
  onEditVictim: (victim: Victim) => void;
  onReactivateMeasure?: (victimId: string) => void;
  onDeleteVictim?: (victim: Victim) => void;
}

export const RevokedMeasuresView: React.FC<RevokedMeasuresViewProps> = ({
  victims,
  onBackToActive,
  onEditVictim,
  onReactivateMeasure,
  onDeleteVictim
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  // Group all revoked measures by CPF (or Normalized Name if CPF not present)
  const groupedRevoked: GroupedRevokedVictim[] = useMemo(() => {
    const revokedVictims = victims.filter(v => v.protectiveOrder?.status === 'Revogada');
    const groupMap = new Map<string, GroupedRevokedVictim>();

    revokedVictims.forEach(v => {
      // Normalize CPF or Name as aggregation key
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
        revocationNoticeNumber: v.protectiveOrder?.revocationNoticeNumber || 'Ofício Registrado',
        revocationDate: v.protectiveOrder?.revocationDate,
        createdAt: v.createdAt
      };

      if (existing) {
        existing.totalOrdersCount += 1;
        existing.orders.push(orderItem);
        // If the new entry has richer contact info, adopt it
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

    return Array.from(groupMap.values()).sort((a, b) => 
      (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' })
    );
  }, [victims]);

  // Filter grouped revoked records
  const filteredRevoked = useMemo(() => {
    if (!searchTerm.trim()) return groupedRevoked;
    const term = searchTerm.toLowerCase().trim();

    return groupedRevoked.filter(g => {
      const matchName = g.name.toLowerCase().includes(term);
      const matchCpf = g.cpf.toLowerCase().includes(term);
      const matchOrder = g.orders.some(o => 
        (o.orderNumber && o.orderNumber.toLowerCase().includes(term)) ||
        (o.defendantName && o.defendantName.toLowerCase().includes(term)) ||
        (o.revocationNoticeNumber && o.revocationNoticeNumber.toLowerCase().includes(term))
      );
      return matchName || matchCpf || matchOrder;
    });
  }, [groupedRevoked, searchTerm]);

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const totalRevokedOrders = useMemo(() => {
    return victims.filter(v => v.protectiveOrder?.status === 'Revogada').length;
  }, [victims]);

  return (
    <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
      
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono uppercase tracking-wider">
            <span className="hover:text-slate-350 cursor-pointer" onClick={onBackToActive}>Início</span>
            <span>/</span>
            <span className="hover:text-slate-350 cursor-pointer" onClick={onBackToActive}>Assistidas</span>
            <span>/</span>
            <span className="text-rose-400 font-bold">Medidas Revogadas</span>
          </div>
          <h2 className="text-2xl font-black text-slate-100 uppercase tracking-wide flex items-center gap-3 mt-1">
            <div className="w-9 h-9 rounded-xl bg-rose-950/80 border border-rose-800/60 flex items-center justify-center text-rose-400">
              <FileX className="w-5 h-5" />
            </div>
            MEDIDAS PROTETIVAS REVOGADAS
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Histórico das medidas arquivadas e revogadas judicialmente. Registros da mesma pessoa agrupados com histórico processual unificado.
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

      {/* Stats and Search bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-950 p-4 rounded-2xl border border-rose-900/30 flex items-center justify-between shadow-md">
          <div>
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 block">Total de Medidas Revogadas</span>
            <span className="text-2xl font-black text-rose-400 mt-0.5 block">{totalRevokedOrders}</span>
            <span className="text-[10px] text-slate-500">Decisões extintas ou finalizadas</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-950/60 border border-rose-900/50 flex items-center justify-center text-rose-400">
            <FileX className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between shadow-md">
          <div>
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 block">Assistidas no Histórico</span>
            <span className="text-2xl font-black text-slate-100 mt-0.5 block">{groupedRevoked.length}</span>
            <span className="text-[10px] text-slate-500">Pessoas únicas com medidas revogadas</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 flex items-center gap-3 text-xs">
        <div className="flex-1 flex items-center bg-slate-900 rounded-xl px-3.5 py-1.5 border border-slate-800">
          <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Pesquisar por nome da assistida, CPF, número do processo, réu ou ofício..."
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

      {/* Grouped Records List */}
      <div className="space-y-4">
        {filteredRevoked.map((group) => {
          const isExpanded = expandedKeys[group.key] ?? true; // expanded by default
          const originalVictim = victims.find(v => v.id === group.orders[0]?.victimId);

          return (
            <div 
              key={group.key}
              className="bg-slate-950 rounded-2xl border border-rose-900/40 overflow-hidden shadow-xl hover:border-rose-700/60 transition-all duration-200"
            >
              {/* Group Header */}
              <div 
                className="bg-slate-900/90 p-4 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none"
                onClick={() => toggleExpand(group.key)}
              >
                <div className="flex items-start md:items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-800/60 flex items-center justify-center text-rose-400 shrink-0 mt-0.5 md:mt-0">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-base font-black text-slate-100 tracking-tight">
                        {group.name}
                      </h3>
                      <span className="inline-flex items-center gap-1 bg-rose-950/80 border border-rose-800/60 text-rose-300 text-[10.5px] font-extrabold px-2 py-0.5 rounded-md shadow-sm">
                        <FileX className="w-3 h-3 text-rose-400" />
                        {group.totalOrdersCount} Medida{group.totalOrdersCount > 1 ? 's' : ''} Revogada{group.totalOrdersCount > 1 ? 's' : ''}
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

              {/* Grouped Orders List (Accordion Body) */}
              {isExpanded && (
                <div className="p-4 space-y-3 bg-slate-950/60">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between pb-1">
                    <span>Sentenças e Decisões Judiciais de Revogação ({group.orders.length})</span>
                    <span className="font-mono text-slate-500">Agrupamento Ativo</span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {group.orders.map((ord, idx) => {
                      const vObj = victims.find(v => v.id === ord.victimId);

                      return (
                        <div 
                          key={ord.victimId || idx}
                          onClick={() => vObj && onEditVictim(vObj)}
                          className="bg-slate-900/90 rounded-xl border border-slate-800 p-3.5 space-y-2.5 hover:border-indigo-500/50 hover:bg-slate-850/80 transition-all cursor-pointer shadow-md"
                          title="Clique para editar este registro de medida"
                        >
                          <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2">
                            <div>
                              <span className="text-[9.5px] uppercase font-black text-rose-400 tracking-wider block">
                                MEDIDA REVOGADA #{idx + 1}
                              </span>
                              <h4 className="text-xs font-black font-mono text-slate-100 mt-0.5">
                                Processo: {ord.orderNumber}
                              </h4>
                            </div>

                            <span className="px-2 py-0.5 rounded text-[9.5px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
                              Revogada
                            </span>
                          </div>

                          <div className="space-y-1 text-xs font-mono">
                            <div className="text-slate-300 text-[11px] truncate">
                              <strong className="text-slate-400 font-sans">Réu / Agressor:</strong> {ord.defendantName}
                            </div>
                            <div className="text-slate-400 text-[10.5px]">
                              <strong className="text-slate-500 font-sans">Ofício de Revogação:</strong> <span className="text-amber-300">{ord.revocationNoticeNumber}</span>
                            </div>
                            <div className="flex items-center gap-4 text-[10.5px] text-slate-400 flex-wrap">
                              {ord.revocationDate && (
                                <span><strong className="text-slate-500 font-sans">Data da Revogação:</strong> {safeFormatDate(ord.revocationDate)}</span>
                              )}
                              {ord.issueDate && (
                                <span><strong className="text-slate-500 font-sans">Expedição Original:</strong> {safeFormatDate(ord.issueDate)}</span>
                              )}
                            </div>
                            {ord.restrictions && (
                              <div className="text-[10px] text-slate-400 font-sans pt-1 border-t border-slate-800/60 leading-snug">
                                <strong>Restrições Anteriores:</strong> {ord.restrictions}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[10px]">
                            <span className="text-slate-500">Clique para abrir detalhes e editar</span>
                            <span className="text-indigo-400 font-bold hover:underline">Abrir Ficha / Edição →</span>
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

        {filteredRevoked.length === 0 && (
          <div className="py-16 text-center text-slate-400 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
              <FileX className="w-6 h-6" />
            </div>
            <p className="font-bold text-sm text-slate-300">Nenhuma medida protetiva revogada encontrada.</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Quando uma medida protetiva for revogada através do botão "REVOGAÇÃO" no cadastro de assistidas, ela será arquivada e listada nesta página.
            </p>
          </div>
        )}
      </div>

    </main>
  );
};

export default RevokedMeasuresView;
