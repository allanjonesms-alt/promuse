export interface ProtectiveOrder {
  id: string;
  orderNumber: string;
  defendantName?: string;
  issueDate: string;
  expiryDate: string;
  judgeName: string;
  restrictions: string;
  status: 'Ativa' | 'Expirada' | 'Revogada';
}

export interface Victim {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  address: string;
  riskLevel: 'Baixo' | 'Médio' | 'Alto';
  policeOfficerInCharge?: string;
  assignedPatrol?: string;
  createdAt: string;
  protectiveOrder?: ProtectiveOrder;
}

export interface PanicAlert {
  id: string;
  victimId: string;
  victimName: string;
  victimPhone: string;
  requestTime: string;
  location: {
    latitude: number;
    longitude: number;
    addressDescription?: string;
  };
  status: 'Ativo' | 'Em Atendimento' | 'Resolvido';
  dispatcherComments?: string;
}

export interface Occurrence {
  id: string;
  victimId: string;
  victimName: string;
  date: string;
  type: 'Visita Preventiva' | 'Ronda PROMUSE' | 'Descumprimento de Medida' | 'Ameaça/Agressão' | 'Outro';
  description: string;
  registeredByOfficer: string;
  actionsTaken: string;
}

export interface Hearing {
  id: string;
  victimId: string;
  victimName: string;
  date: string;
  time: string;
  courtroom: string;
  judge?: string;
  hearingType: 'Instrução e Julgamento' | 'Justificação' | 'Conciliação';
  status: 'Pendente' | 'Realizada' | 'Cancelada';
  notes?: string;
}

export interface AppDB {
  victims: Victim[];
  panicAlerts: PanicAlert[];
  occurrences: Occurrence[];
  hearings: Hearing[];
}
