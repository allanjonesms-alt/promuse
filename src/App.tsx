import { firebaseApiFetch } from './lib/api';
import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Users, 
  Bell, 
  MapPin, 
  FileText, 
  Calendar, 
  Smartphone, 
  Activity, 
  AlertTriangle, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  PlusCircle, 
  CheckCircle, 
  PhoneCall, 
  Lock, 
  X, 
  RefreshCw,
  Compass,
  AlertOctagon,
  Clock,
  ExternalLink,
  Map,
  Filter,
  UsersRound,
  FileCheck2
} from 'lucide-react';
import { AppDB, Victim, PanicAlert, Occurrence } from './types';
import VictimPortal from './components/VictimPortal';
import AdminManagement from './components/AdminManagement';
import { APIProvider } from '@vis.gl/react-google-maps';
import AddressInput from './components/AddressInput';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

export default function App() {
  if (!hasValidKey) {
    console.warn("Google Maps API Key Requerida (VITE_GOOGLE_MAPS). O mapa pode não carregar corretamente.");
  }

  return (
    <APIProvider apiKey={API_KEY || ''} version="weekly">
      <AppInner />
    </APIProvider>
  );
}

function AppInner() {
  const [db, setDb] = useState<AppDB>({
    victims: [],
    panicAlerts: [],
    occurrences: [],
    hearings: []
  });
  
  // App UI State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [syncingData, setSyncingData] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<'police' | 'victim' | 'admin'>('police');
  const [selectedSimulatedVictimId, setSelectedSimulatedVictimId] = useState<string>('');
  
  // Notification logs simulating messages sent to coordinators & patrol officers' phones
  const [incomingSMSLogs, setIncomingSMSLogs] = useState<{
    id: string;
    timestamp: string;
    receiver: string;
    message: string;
    type: 'SMS' | 'WHATSAPP';
  }[]>([]);
  
  // Real-time flash notification for the screen
  const [showFlashNotification, setShowFlashNotification] = useState<string | null>(null);

  // Search & Filters Inside Admin Dashboard
  const [victimSearch, setVictimSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<'Todos' | 'Baixo' | 'Médio' | 'Alto'>('Todos');
  const [alertStatusFilter, setAlertStatusFilter] = useState<'Todos' | 'Ativo' | 'Resolvido'>('Todos');
  const [occurrenceTypeFilter, setOccurrenceTypeFilter] = useState<string>('Todos');

  // Modal / Form States
  const [isVictimModalOpen, setIsVictimModalOpen] = useState(false);
  const [editingVictim, setEditingVictim] = useState<Victim | null>(null);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [pdfParseStatus, setPdfParseStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [newVictimForm, setNewVictimForm] = useState({
    name: '',
    cpf: '',
    phone: '',
    address: '',
    riskLevel: 'Baixo' as 'Baixo' | 'Médio' | 'Alto',
    policeOfficerInCharge: 'A definir',
    assignedPatrol: 'VTR PROMUSE 5040',
    orderNumber: '',
    defendantName: '',
    judgeName: 'Dr. Cláudio Müller Pareja',
    restrictions: 'Proibição de aproximação física (mínimo de 300 metros) do local de residência da vítima.',
    issueDate: '',
    expiryDate: ''
  });



  const [isOccurrenceModalOpen, setIsOccurrenceModalOpen] = useState(false);
  const [newOccurrenceForm, setNewOccurrenceForm] = useState({
    victimId: '',
    type: 'Visita Preventiva' as 'Visita Preventiva' | 'Ronda PROMUSE' | 'Descumprimento de Medida' | 'Ameaça/Agressão' | 'Outro',
    description: '',
    registeredByOfficer: 'Sgt PM Anderson',
    actionsTaken: ''
  });

  // Active Map Selection State
  const [selectedMapAlert, setSelectedMapAlert] = useState<PanicAlert | null>(null);
  const [resolveComments, setResolveComments] = useState('');

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingPdf(true);
    setPdfParseStatus(null);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64String = (reader.result as string).split(',')[1];
        
        try {
          const res = await fetch('/api/parse-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdfBase64: base64String })
          });
          
          if (res.ok) {
            const data = await res.json();
            setNewVictimForm(prev => ({
              ...prev,
              name: data.victimName || prev.name,
              defendantName: data.defendantName || prev.defendantName,
              orderNumber: data.orderNumber || prev.orderNumber,
              judgeName: data.judgeName || prev.judgeName,
              issueDate: data.issueDate || prev.issueDate,
              expiryDate: data.expiryDate || prev.expiryDate,
              restrictions: data.restrictions || prev.restrictions
            }));
            setPdfParseStatus({
              type: 'success',
              message: `PDF de "${data.victimName || 'Assistida'}" lido com sucesso pela Inteligência Artificial! Dados preenchidos abaixo automaticamente.`
            });
          } else {
            const errData = await res.json().catch(() => ({}));
            const errMsg = errData.error || 'Falha ao processar o PDF com a Inteligência Artificial. Verifique se é uma medida protetiva válida do TJMS.';
            setPdfParseStatus({
              type: 'error',
              message: errMsg
            });
          }
        } catch (fetchErr: any) {
          setPdfParseStatus({
            type: 'error',
            message: 'Erro ao conectar-se ao assistente de IA PROMUSE: ' + fetchErr.message
          });
        }
        setIsParsingPdf(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setIsParsingPdf(false);
      setPdfParseStatus({
        type: 'error',
        message: 'Erro inesperado ao ler o arquivo PDF localmente.'
      });
    }
    
    // Clear input
    e.target.value = '';
  };

  // Initial Fetch Setup
  const fetchDatabase = async () => {
    try {
      setLoading(true);
      const res = await firebaseApiFetch('/api/db');
      if (res.ok) {
        const data = await res.json();
        setDb(data);
        if (data.victims && data.victims.length > 0) {
          setSelectedSimulatedVictimId(data.victims[0].id);
        }
        setApiError(null);
      } else {
        throw new Error('Erro ao buscar dados do servidor local do PROMUSE');
      }
    } catch (err: any) {
      console.warn('Backend server unreachable, falling back to mock LocalStorage db.', err);
      // Setup mock fallback
      const saved = localStorage.getItem('promuse_fallback_db');
      if (saved) {
        const parsed = JSON.parse(saved) as AppDB;
        setDb(parsed);
        if (parsed.victims?.length > 0) {
          setSelectedSimulatedVictimId(parsed.victims[0].id);
        }
      } else {
        // Seed default
        const mockDB: AppDB = {
          victims: [
            {
              id: 'vit_1',
              name: 'Maria Eduarda Silva',
              cpf: '023.456.789-99',
              phone: '(67) 99876-5432',
              address: 'Rua Delmira Bandeira, 1205, Bairro Senhor Divino, Coxim-MS',
              riskLevel: 'Alto',
              policeOfficerInCharge: 'Sgt PM Anderson',
              assignedPatrol: 'VTR PROMUSE 5040',
              createdAt: new Date().toISOString(),
              protectiveOrder: {
                id: 'ord_1',
                orderNumber: '0001423-45.2026.8.12.0011',
                issueDate: '2026-01-16',
                expiryDate: '2026-07-16',
                judgeName: 'Dr. Cláudio Müller Pareja',
                restrictions: 'Proibição de aproximação física (mínimo de 300 metros) e contato por telefone ou redes sociais.',
                status: 'Ativa'
              }
            },
            {
              id: 'vit_2',
              name: 'Ana Júlia Santos',
              cpf: '124.365.129-12',
              phone: '(67) 99123-4567',
              address: 'Avenida Virgínia Ferreira, 452, Bairro Santo André, Coxim-MS',
              riskLevel: 'Médio',
              policeOfficerInCharge: 'Cb PM Fernanda',
              assignedPatrol: 'VTR PROMUSE 5040',
              createdAt: new Date().toISOString(),
              protectiveOrder: {
                id: 'ord_2',
                orderNumber: '0002891-12.2026.8.12.0011',
                issueDate: '2026-02-12',
                expiryDate: '2026-08-12',
                judgeName: 'Dra. Tatiana Dias de Oliveira',
                restrictions: 'Proibição de aproximação física do local de residência e trabalho da vítima em menos de 200 metros.',
                status: 'Ativa'
              }
            }
          ],
          panicAlerts: [],
          occurrences: [
            {
              id: 'occ_1',
              victimId: 'vit_1',
              victimName: 'Maria Eduarda Silva',
              date: new Date().toISOString(),
              type: 'Visita Preventiva',
              description: 'Visita realizada preventiva da equipe PROMUSE da PM de Coxim. Tudo sob controle.',
              registeredByOfficer: 'Sgt PM Anderson',
              actionsTaken: 'Verificação física residencial efetuada com sucesso.'
            }
          ],
          hearings: [
            {
              id: 'hear_1',
              victimId: 'vit_1',
              victimName: 'Maria Eduarda Silva',
              date: '2026-06-12',
              time: '14:30',
              courtroom: 'Vara Judicial Criminal - Fórum de Coxim-MS',
              judge: 'Dr. Cláudio Müller Pareja',
              hearingType: 'Instrução e Julgamento',
              status: 'Pendente',
              notes: 'Presença indispensável da vítima assistida pela equipe PROMUSE.'
            }
          ]
        };
        setDb(mockDB);
        localStorage.setItem('promuse_fallback_db', JSON.stringify(mockDB));
        setSelectedSimulatedVictimId('vit_1');
      }
    } finally {
      setLoading(false);
    }
  };

  // Track Firebase Auth State Changes at Root
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setIsAdminAuthorized(false);
      setCheckingAuth(false);

      if (user && user.email) {
        const userEmail = user.email.toLowerCase().trim();
        
        // Is it the Master Admin? (allanjonesms@gmail.com)
        if (userEmail === 'allanjonesms@gmail.com') {
          setIsAdminAuthorized(true);
          
          // Auto-provision Master Admin in Firestore if missing
          try {
            const { doc, getDoc, setDoc, Timestamp } = await import('firebase/firestore');
            const { db: firestoreDb } = await import('./firebase');
            const docRef = doc(firestoreDb, 'admins', 'allanjonesms@gmail.com');
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) {
              await setDoc(docRef, {
                email: 'allanjonesms@gmail.com',
                name: user.displayName || 'Allan Jones',
                role: 'master',
                status: 'Ativo',
                addedBy: 'Instanciação Automática',
                createdAt: Timestamp.now()
              });
              console.log('Master Admin auto-provisioned successfully in Firestore.');
            }
          } catch (error) {
            console.error("Error auto-provisioning Master Admin:", error);
          }
          return;
        }

        // Check if user is active admin
        try {
          const { doc, getDoc } = await import('firebase/firestore');
          const { db: firestoreDb } = await import('./firebase');
          const docRef = doc(firestoreDb, 'admins', userEmail);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists() && docSnap.data().status === 'Ativo') {
            setIsAdminAuthorized(true);
          }
        } catch (error) {
          console.error("Error verifying admin authority at root status:", error);
        }
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Fetch db either initially or when authority updates
  useEffect(() => {
    if (!checkingAuth) {
      fetchDatabase();
    }
  }, [isAdminAuthorized, checkingAuth]);

  // Identify offline/locally created entries (prefixed with _fb_)
  const getUnsyncedData = () => {
    const unsyncedVictims = db.victims.filter(v => v.id.startsWith('vit_fb_'));
    const unsyncedOccurrences = db.occurrences.filter(o => o.id.startsWith('occ_fb_'));
    const unsyncedAlerts = db.panicAlerts.filter(a => a.id.startsWith('alt_fb_'));
    return {
      victims: unsyncedVictims,
      occurrences: unsyncedOccurrences,
      alerts: unsyncedAlerts,
      totalCount: unsyncedVictims.length + unsyncedOccurrences.length + unsyncedAlerts.length
    };
  };

  const handleSyncLocalData = async () => {
    const unsynced = getUnsyncedData();
    if (unsynced.totalCount === 0) return;
    setSyncingData(true);
    setSyncStatus('idle');

    try {
      // 1. Sync Victims
      for (const victim of unsynced.victims) {
        const payload = {
          id: victim.id, // preserve the temporary local ID so foreign keys reference it correctly
          name: victim.name,
          cpf: victim.cpf,
          phone: victim.phone,
          address: victim.address,
          riskLevel: victim.riskLevel,
          policeOfficerInCharge: victim.policeOfficerInCharge,
          assignedPatrol: victim.assignedPatrol,
          createdAt: victim.createdAt,
          protectiveOrder: victim.protectiveOrder ? {
            orderNumber: victim.protectiveOrder.orderNumber,
            defendantName: victim.protectiveOrder.defendantName,
            judgeName: victim.protectiveOrder.judgeName,
            restrictions: victim.protectiveOrder.restrictions,
            issueDate: victim.protectiveOrder.issueDate,
            expiryDate: victim.protectiveOrder.expiryDate,
            status: victim.protectiveOrder.status
          } : undefined
        };

        const res = await firebaseApiFetch('/api/victims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Falha ao sincronizar assistidas');
      }

      // 2. Sync Occurrences
      for (const occ of unsynced.occurrences) {
        const payload = {
          id: occ.id,
          victimId: occ.victimId,
          victimName: occ.victimName,
          date: occ.date,
          type: occ.type,
          description: occ.description,
          registeredByOfficer: occ.registeredByOfficer,
          actionsTaken: occ.actionsTaken
        };

        const res = await firebaseApiFetch('/api/occurrences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Falha ao sincronizar ocorrências');
      }

      // 3. Sync Panic Alerts
      for (const alert of unsynced.alerts) {
        const payload = {
          id: alert.id,
          victimId: alert.victimId,
          victimName: alert.victimName,
          victimPhone: alert.victimPhone,
          requestTime: alert.requestTime,
          location: alert.location,
          status: alert.status,
          dispatcherComments: alert.dispatcherComments
        };

        const res = await firebaseApiFetch('/api/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Falha ao sincronizar alertas');
      }

      // Success! Reload complete database from cloud
      const freshDbRes = await firebaseApiFetch('/api/db');
      if (freshDbRes.ok) {
        const freshDb = await freshDbRes.json();
        setDb(freshDb);
        localStorage.setItem('promuse_fallback_db', JSON.stringify(freshDb));
      }
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 5000);
    } catch (e) {
      console.error('Error synchronizing local data to cloud:', e);
      setSyncStatus('error');
    } finally {
      setSyncingData(false);
    }
  };

  // Update Database state and sync with local fallback just in case
  const updateDbState = (newDB: AppDB) => {
    setDb(newDB);
    localStorage.setItem('promuse_fallback_db', JSON.stringify(newDB));
  };

  // Triggering the Panic Button (Simulating GPS, live database alert, and on-duty phone dispatch alerts)
  const triggerPanicAlert = async (location: { latitude: number; longitude: number; addressDescription: string }) => {
    const victim = db.victims.find(v => v.id === selectedSimulatedVictimId);
    const vName = victim ? victim.name : 'Vítima não localizada';
    const vPhone = victim ? victim.phone : '(67) s/número';
    
    const payload = {
      victimId: selectedSimulatedVictimId,
      victimName: vName,
      victimPhone: vPhone,
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        addressDescription: location.addressDescription
      }
    };

    let createdAlert: PanicAlert;

    try {
      const res = await firebaseApiFetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        createdAlert = data;
        // Refetch complete DB
        const dbRes = await firebaseApiFetch('/api/db');
        if (dbRes.ok) {
          const freshDb = await dbRes.json();
          setDb(freshDb);
        }
      } else {
        throw new Error('Fallback logic needed');
      }
    } catch (_) {
      // Local fallback
      createdAlert = {
        id: 'alt_fb_' + Date.now(),
        victimId: selectedSimulatedVictimId,
        victimName: vName,
        victimPhone: vPhone,
        requestTime: new Date().toISOString(),
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          addressDescription: location.addressDescription
        },
        status: 'Ativo',
        dispatcherComments: ''
      };
      const updatedAlerts = [createdAlert, ...db.panicAlerts];
      const updatedDB = { ...db, panicAlerts: updatedAlerts };
      updateDbState(updatedDB);
    }

    // Auto-select on the dispatch board
    setSelectedMapAlert(createdAlert);

    // Trigger visual role notification and SMS cellular simulators dispatch
    const currentTimeString = new Date().toLocaleTimeString('pt-BR');
    
    const smsMessage = `🚨 ALERTA PROMUSE 5°BPM 🚨\nBOTAO DE PANICO acionado por: ${vName}.\nContato: ${vPhone}\n📍 Local Coxim: Bairro Senhor Divino (${location.addressDescription})\nCoordenadas: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}\nUnidades de servico do 5°BPM Coxim-MS mobilizadas de imediato.`;
    
    const newSMSLogs = [
      {
        id: 'sms_' + Date.now() + '_1',
        timestamp: currentTimeString,
        receiver: 'Ten. Cel PM Adriano - Comandante 5º BPM',
        message: smsMessage,
        type: 'WHATSAPP' as const
      },
      {
        id: 'sms_' + Date.now() + '_2',
        timestamp: currentTimeString,
        receiver: 'Coordenadora PROMUSE Coxim - Cb PM Fernanda',
        message: smsMessage,
        type: 'SMS' as const
      },
      {
        id: 'sms_' + Date.now() + '_3',
        timestamp: currentTimeString,
        receiver: 'Rádio-Patrulha de Plantão (VTR 5040)',
        message: smsMessage,
        type: 'SMS' as const
      }
    ];

    setIncomingSMSLogs(prev => [...newSMSLogs, ...prev]);
    setShowFlashNotification(`🚨 PÂNICO: ${vName} acionou socorro imediato via GPS! Policiais mobilizados.`);
    
    // Automatically close notification after 10s
    setTimeout(() => {
      setShowFlashNotification(null);
    }, 10000);
  };

  // Register incident callback from child Victim Portal
  const registerIncidentFromPortal = async (type: string, description: string) => {
    const victim = db.victims.find(v => v.id === selectedSimulatedVictimId);
    const payload = {
      victimId: selectedSimulatedVictimId,
      type,
      description,
      registeredByOfficer: 'Auto-relato da Vítima'
    };

    try {
      const res = await firebaseApiFetch('/api/occurrences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const freshDbRes = await firebaseApiFetch('/api/db');
        if (freshDbRes.ok) {
          const freshDb = await freshDbRes.json();
          setDb(freshDb);
        }
      } else {
        throw new Error('Local fallback');
      }
    } catch (_) {
      const newOcc: Occurrence = {
        id: 'occ_fb_' + Date.now(),
        victimId: selectedSimulatedVictimId,
        victimName: victim ? victim.name : 'Vítima não localizada',
        date: new Date().toISOString(),
        type: type as any,
        description,
        registeredByOfficer: 'Auto-relato da Vítima',
        actionsTaken: 'Aguardando revisão policial no quartel de Coxim.'
      };
      const updatedOccs = [newOcc, ...db.occurrences];
      updateDbState({ ...db, occurrences: updatedOccs });
    }
  };

  // Reset database to default seed helper
  const handleResetDB = async () => {
    if (window.confirm('Tem certeza que deseja restaurar o banco de dados original de Coxim-MS?')) {
      try {
        const res = await firebaseApiFetch('/api/reset', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          setDb(data.db);
          setApiError(null);
          alert('Sistema redefinido com dados originais do PROMUSE!');
        }
      } catch (_) {
        localStorage.removeItem('promuse_fallback_db');
        fetchDatabase();
        alert('Memória local restaurada com sucesso!');
      }
    }
  };

  // Create or Update Victim Form Submit
  const handleSaveVictim = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: newVictimForm.name,
      cpf: newVictimForm.cpf,
      phone: newVictimForm.phone,
      address: newVictimForm.address,
      riskLevel: newVictimForm.riskLevel,
      policeOfficerInCharge: newVictimForm.policeOfficerInCharge,
      assignedPatrol: newVictimForm.assignedPatrol,
      protectiveOrder: {
        orderNumber: newVictimForm.orderNumber,
        defendantName: newVictimForm.defendantName,
        judgeName: newVictimForm.judgeName,
        restrictions: newVictimForm.restrictions,
        issueDate: newVictimForm.issueDate || new Date().toISOString().split('T')[0],
        expiryDate: newVictimForm.expiryDate || new Date(Date.now() + 180*24*60*60*1000).toISOString().split('T')[0],
        status: 'Ativa' as const
      }
    };

    try {
      let res;
      if (editingVictim) {
        res = await firebaseApiFetch(`/api/victims/${editingVictim.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await firebaseApiFetch('/api/victims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        const returnedVictim = await res.json();
        const finalId = returnedVictim.id || editingVictim?.id || 'vit_' + Date.now();
        const updatedVictim: Victim = {
          ...payload,
          id: finalId,
          createdAt: returnedVictim.createdAt || editingVictim?.createdAt || new Date().toISOString(),
          protectiveOrder: payload.protectiveOrder ? {
            ...payload.protectiveOrder,
            id: returnedVictim.protectiveOrder?.id || editingVictim?.protectiveOrder?.id || 'ord_' + Date.now()
          } : undefined
        };

        // Update local React state instantly so there's zero latency and perfect feedback
        setDb(prev => {
          const exists = prev.victims.some(v => v.id === finalId);
          const newVictims = exists 
            ? prev.victims.map(v => v.id === finalId ? updatedVictim : v)
            : [...prev.victims, updatedVictim];
          return { ...prev, victims: newVictims };
        });

        // Trigger background fetch to fully align with service/firestore cache
        firebaseApiFetch('/api/db')
          .then(async (freshDbRes) => {
            if (freshDbRes.ok) {
              const freshDb = await freshDbRes.json();
              setDb(freshDb);
            }
          })
          .catch(err => console.warn('Delayed db sync warning:', err));

        setIsVictimModalOpen(false);
        setEditingVictim(null);
        resetVictimForm();
      } else {
        throw new Error('Local update');
      }
    } catch (_) {
      // Local Storage Fallback
      if (editingVictim) {
        const updatedVictims = db.victims.map(v => {
          if (v.id === editingVictim.id) {
            return {
              ...v,
              name: newVictimForm.name,
              cpf: newVictimForm.cpf,
              phone: newVictimForm.phone,
              address: newVictimForm.address,
              riskLevel: newVictimForm.riskLevel,
              policeOfficerInCharge: newVictimForm.policeOfficerInCharge,
              assignedPatrol: newVictimForm.assignedPatrol,
              protectiveOrder: {
                id: v.protectiveOrder?.id || 'ord_fb_' + Date.now(),
                orderNumber: newVictimForm.orderNumber,
                defendantName: newVictimForm.defendantName,
                judgeName: newVictimForm.judgeName,
                restrictions: newVictimForm.restrictions,
                issueDate: newVictimForm.issueDate || new Date().toISOString().split('T')[0],
                expiryDate: newVictimForm.expiryDate || new Date(Date.now() + 180*24*60*60*1000).toISOString().split('T')[0],
                status: 'Ativa' as const
              }
            };
          }
          return v;
        });
        updateDbState({ ...db, victims: updatedVictims });
      } else {
        const newV: Victim = {
          id: 'vit_fb_' + Date.now(),
          name: newVictimForm.name,
          cpf: newVictimForm.cpf,
          phone: newVictimForm.phone,
          address: newVictimForm.address,
          riskLevel: newVictimForm.riskLevel,
          policeOfficerInCharge: newVictimForm.policeOfficerInCharge,
          assignedPatrol: newVictimForm.assignedPatrol,
          createdAt: new Date().toISOString(),
          protectiveOrder: {
            id: 'ord_fb_' + Date.now(),
            orderNumber: newVictimForm.orderNumber,
            defendantName: newVictimForm.defendantName,
            issueDate: newVictimForm.issueDate || new Date().toISOString().split('T')[0],
            expiryDate: newVictimForm.expiryDate || new Date(Date.now() + 180*24*60*60*1000).toISOString().split('T')[0],
            judgeName: newVictimForm.judgeName,
            restrictions: newVictimForm.restrictions,
            status: 'Ativa'
          }
        };
        updateDbState({ ...db, victims: [...db.victims, newV] });
      }
      setIsVictimModalOpen(false);
      setEditingVictim(null);
      resetVictimForm();
    }
  };

  const handleEditVictimClick = (v: Victim) => {
    setEditingVictim(v);
    setNewVictimForm({
      name: v.name,
      cpf: v.cpf,
      phone: v.phone,
      address: v.address,
      riskLevel: v.riskLevel,
      policeOfficerInCharge: v.policeOfficerInCharge || 'A definir',
      assignedPatrol: v.assignedPatrol || 'VTR PROMUSE 5040',
      orderNumber: v.protectiveOrder?.orderNumber || '',
      defendantName: v.protectiveOrder?.defendantName || '',
      judgeName: v.protectiveOrder?.judgeName || 'Dr. Cláudio Müller Pareja',
      restrictions: v.protectiveOrder?.restrictions || '',
      issueDate: v.protectiveOrder?.issueDate || '',
      expiryDate: v.protectiveOrder?.expiryDate || ''
    });
    setIsVictimModalOpen(true);
  };

  const handleDeleteVictimClick = async (victimId: string) => {
    if (window.confirm('Excluir esta assistida permanentemente do cadastro do 5°BPM Coxim-MS?')) {
      try {
        const res = await firebaseApiFetch(`/api/victims/${victimId}`, { method: 'DELETE' });
        if (res.ok) {
          const freshDbRes = await firebaseApiFetch('/api/db');
          if (freshDbRes.ok) {
            const data = await freshDbRes.json();
            setDb(data);
          }
        } else {
          throw new Error('Local fallback delete');
        }
      } catch (_) {
        const filtered = db.victims.filter(v => v.id !== victimId);
        updateDbState({ ...db, victims: filtered });
      }
    }
  };

  const resetVictimForm = () => {
    setNewVictimForm({
      name: '',
      cpf: '',
      phone: '',
      address: '',
      riskLevel: 'Baixo',
      policeOfficerInCharge: 'A definir',
      assignedPatrol: 'VTR PROMUSE 5040',
      orderNumber: '',
      defendantName: '',
      judgeName: 'Dr. Cláudio Müller Pareja',
      restrictions: 'Proibição de aproximação física (mínimo de 300 metros) do local de residência da vítima.',
      issueDate: '',
      expiryDate: ''
    });
    setPdfParseStatus(null);
  };

  // Add Occurrence/Preventive Patrol Log submit
  const handleSaveOccurrence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOccurrenceForm.victimId) {
      alert('Favor selecionar a assistida relacionada!');
      return;
    }

    try {
      const res = await firebaseApiFetch('/api/occurrences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOccurrenceForm)
      });
      if (res.ok) {
        const freshDbRes = await firebaseApiFetch('/api/db');
        if (freshDbRes.ok) {
          const data = await freshDbRes.json();
          setDb(data);
        }
        setIsOccurrenceModalOpen(false);
        setNewOccurrenceForm({
          victimId: '',
          type: 'Visita Preventiva',
          description: '',
          registeredByOfficer: 'Sgt PM Anderson',
          actionsTaken: ''
        });
      } else {
        throw new Error('Local');
      }
    } catch (_) {
      const v = db.victims.find(victim => victim.id === newOccurrenceForm.victimId);
      const newO: Occurrence = {
        id: 'occ_fb_' + Date.now(),
        victimId: newOccurrenceForm.victimId,
        victimName: v ? v.name : 'Vítima',
        date: new Date().toISOString(),
        type: newOccurrenceForm.type,
        description: newOccurrenceForm.description,
        registeredByOfficer: newOccurrenceForm.registeredByOfficer,
        actionsTaken: newOccurrenceForm.actionsTaken
      };
      updateDbState({ ...db, occurrences: [newO, ...db.occurrences] });
      setIsOccurrenceModalOpen(false);
    }
  };

  // Resolve Alert Event
  const handleResolveAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMapAlert) return;

    try {
      const res = await firebaseApiFetch(`/api/alerts/${selectedMapAlert.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Resolvido',
          dispatcherComments: resolveComments || 'Atendimento emergencial resolvido e registrado via rádio da PM Coxim.',
          autoLogOccurrence: true,
          registeredByOfficer: 'Coordenação 5ºBPM'
        })
      });
      if (res.ok) {
        const freshDbRes = await firebaseApiFetch('/api/db');
        if (freshDbRes.ok) {
          const data = await freshDbRes.json();
          setDb(data);
        }
        setSelectedMapAlert(null);
        setResolveComments('');
        alert('Botão de pânico solucionado e registrado no histórico de ocorrências com sucesso!');
      } else {
        throw new Error('Local');
      }
    } catch (_) {
      const updatedAlerts = db.panicAlerts.map(a => {
        if (a.id === selectedMapAlert.id) {
          return { ...a, status: 'Resolvido' as const, dispatcherComments: resolveComments };
        }
        return a;
      });

      // Auto occurrence log
      const newO: Occurrence = {
        id: 'occ_fb_' + Date.now(),
        victimId: selectedMapAlert.victimId,
        victimName: selectedMapAlert.victimName,
        date: new Date().toISOString(),
        type: 'Descumprimento de Medida',
        description: `Botão de pânico neutralizado. Comentários do Comando: ${resolveComments || 'Resolvido sem reincidências físicas graves.'}`,
        registeredByOfficer: 'Coordenação 5ºBPM',
        actionsTaken: 'Guarnição mobilizada e encerramento positivo de ocorrência.'
      };

      updateDbState({
        ...db,
        panicAlerts: updatedAlerts,
        occurrences: [newO, ...db.occurrences]
      });

      setSelectedMapAlert(null);
      setResolveComments('');
      alert('Botão de pânico solucionado localmente!');
    }
  };

  // Filtered victims
  const filteredVictims = db.victims.filter(v => {
    const matchesSearch = v.name.toLowerCase().includes(victimSearch.toLowerCase()) || 
                          v.cpf.includes(victimSearch) || 
                          (v.protectiveOrder?.orderNumber && v.protectiveOrder.orderNumber.includes(victimSearch));
    const matchesRisk = riskFilter === 'Todos' || v.riskLevel === riskFilter;
    return matchesSearch && matchesRisk;
  });

  // Filtered Alerts
  const filteredAlerts = db.panicAlerts.filter(a => {
    if (alertStatusFilter === 'Todos') return true;
    return a.status === alertStatusFilter;
  });

  const activePanicCount = db.panicAlerts.filter(a => a.status === 'Ativo').length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans transition-all selection:bg-rose-600 selection:text-white">
      
      {/* 🇨🇷 MILITARY HEADER */}
      <header className="bg-[#420B34] border-b border-[#5E164C]/20 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-900/30 shrink-0 border border-emerald-400/20">
            <Shield className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#FFCCD6] bg-black/40 px-2 py-0.5 rounded border border-white/10">PMMS</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#FFCCD6] bg-black/40 px-2 py-0.5 rounded border border-white/10">5º BPM COXIM</span>
            </div>
            <h1 className="text-xl font-black text-white tracking-tight mt-0.5">PROMUSE <span className="font-light text-rose-300">Mulher Segura</span></h1>
          </div>
        </div>

        {/* Global Simulated Environment State & Role Swapping */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-black/40 p-1.5 rounded-xl border border-white/10 shadow-inner">
            <button
              id="switch_police_role"
              onClick={() => setActiveRole('police')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 cursor-pointer ${
                activeRole === 'police' 
                  ? 'bg-emerald-600/90 text-white shadow-md' 
                  : 'text-slate-300 hover:text-slate-100 hover:bg-white/5'
              }`}
            >
              <Activity className="w-4 h-4" />
              Painel PMMS Comando
            </button>
            <button
              id="switch_victim_role"
              onClick={() => setActiveRole('victim')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 cursor-pointer ${
                activeRole === 'victim' 
                  ? 'bg-rose-700/90 text-white shadow-md animate-pulse' 
                  : 'text-slate-300 hover:text-slate-100 hover:bg-white/5'
              }`}
            >
              <Smartphone className="w-4 h-4 animate-bounce" />
              Celular da Vítima
            </button>
            <button
              id="switch_admin_role"
              onClick={() => setActiveRole('admin')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 cursor-pointer ${
                activeRole === 'admin' 
                  ? 'bg-blue-600/90 text-white shadow-md' 
                  : 'text-slate-300 hover:text-slate-100 hover:bg-white/5'
              }`}
            >
              <Lock className="w-4 h-4" />
              Gestão de Admins
            </button>
          </div>

          <button
            onClick={handleResetDB}
            title="Restaurar Banco de Dados"
            className="p-2.5 bg-black/40 hover:bg-black/70 hover:text-white border border-white/10 text-slate-300 rounded-xl cursor-pointer transition-all flex items-center justify-center"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 📢 FLASH EMERGENCY NOTIFICATION TOAST */}
      {showFlashNotification && (
        <div className="bg-red-600 text-white px-6 py-4 flex items-center justify-between shadow-xl animate-bounce border-b border-red-500 text-sm font-bold tracking-wide relative z-50">
          <div className="flex items-center gap-3.5">
            <AlertOctagon className="w-6 h-6 animate-spin duration-1000 shrink-0 text-white" />
            <span>{showFlashNotification}</span>
          </div>
          <button 
            onClick={() => setShowFlashNotification(null)}
            className="text-white hover:text-red-100 bg-red-800/50 p-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
          >
            <X className="w-4 h-4" /> Ocultar
          </button>
        </div>
      )}

      {/* 🔄 OFFLINE / SYNCHRONIZATION BAR */}
      {(!isAdminAuthorized || getUnsyncedData().totalCount > 0) && (
        <div className={`bg-slate-950 border-b border-slate-900 px-6 py-3.5 flex flex-col md:flex-row items-center justify-between text-xs gap-3 ${getUnsyncedData().totalCount > 0 ? 'border-amber-600/30 bg-amber-950/5' : ''}`}>
          <div className="flex flex-wrap items-center gap-2">
            {!isAdminAuthorized ? (
              <span className="flex items-center gap-2 text-slate-400">
                <span className="w-2   h-2 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                <strong>Acesso Local:</strong> Atuando em modo demonstrativo. As Medidas Protetivas que cadastrar agora ficam salvas com segurança no navegador. Para enviar permanentemente para o banco de dados na nuvem, entre como <strong>Gestão de Admins</strong>.
              </span>
            ) : (
              <span className="flex items-center gap-2 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0"></span>
                <strong>Modo Nuvem:</strong> Conectado com um e-mail Administrador do PROMUSE no Firebase Firestore!
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {getUnsyncedData().totalCount > 0 && (
              <span className="bg-amber-500/10 text-amber-500 font-bold px-2 py-1 rounded border border-amber-500/20 flex items-center gap-1.5 font-mono text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5" />
                {getUnsyncedData().totalCount} {getUnsyncedData().totalCount === 1 ? 'REGISTRO LOCAL' : 'REGISTROS LOCAIS'}
              </span>
            )}

            {getUnsyncedData().totalCount > 0 && (
              isAdminAuthorized ? (
                <button
                  onClick={handleSyncLocalData}
                  disabled={syncingData}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-black px-4.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-amber-950/20 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingData ? 'animate-spin' : ''}`} />
                  {syncingData ? 'Sincronizando...' : 'Sincronizar com Firebase'}
                </button>
              ) : (
                <button
                  onClick={() => setActiveRole('admin')}
                  className="bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 border border-slate-700"
                >
                  <Lock className="w-3 h-3 text-amber-500" />
                  Faça login para subir no banco
                </button>
              )
            )}

            {syncStatus === 'success' && (
              <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-emerald-500" /> Dados enviados à nuvem!
              </span>
            )}
            {syncStatus === 'error' && (
              <span className="text-rose-400 font-extrabold flex items-center gap-1">
                <AlertOctagon className="w-4 h-4 text-rose-500" /> Falha no envio de dados.
              </span>
            )}
          </div>
        </div>
      )}

      {/* 🚀 ROLE 1: VICTIM PORTAL SIMULATOR (APK PACKAGE PREVIEW) */}
      {activeRole === 'victim' && (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* SIMULATOR CONTROLLER PANEL */}
          <div className="md:col-span-1 space-y-4">
            <div className="bg-slate-950/80 p-5 rounded-3xl border border-slate-800/80 shadow-md">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-rose-500" />
                Seletor de Simulação APK
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                O PROMUSE é distribuído como aplicativo instalável no celular das mulheres sob medida protetiva em Coxim. Selecione a assistida abaixo para simular o telefone dela:
              </p>

              <div>
                <label className="block text-[11px] text-slate-400 font-extrabold uppercase mb-1.5">Escolher Assistida Cadastrada:</label>
                <select
                  value={selectedSimulatedVictimId}
                  onChange={(e) => setSelectedSimulatedVictimId(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl bg-slate-900 border border-slate-800 focus:outline-none focus:border-rose-500 font-bold text-slate-200"
                >
                  {db.victims.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.riskLevel === 'Alto' ? '⚠️ ALTO RISCO' : v.riskLevel})
                    </option>
                  ))}
                  {db.victims.length === 0 && (
                    <option value="">Nenhuma cadastrada. Crie assistidas no Painel.</option>
                  )}
                </select>
              </div>

              <div className="mt-5 p-3.5 bg-rose-950/20 rounded-2xl border border-rose-900/30 text-xs space-y-2">
                <p className="font-extrabold text-rose-400 flex items-center gap-1">
                  <Activity className="w-4 h-4" /> SIMULADOR DE BOTÃO DE PÂNICO
                </p>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Ao clicar no botão de pânico do celular ao lado:
                </p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400">
                  <li>Iniciará um timer de 3 segundos de segurança.</li>
                  <li>Injetará o alerta de socorro no servidor do BPM.</li>
                  <li>Simulará o envio de mensagens em lote via celular para a inteligência e guarnição de serviço.</li>
                </ul>
              </div>
            </div>

            {/* Mobile packing information helpful for client */}
            <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800 text-xs text-slate-400 leading-relaxed space-y-2">
              <span className="font-bold text-slate-300 block">📁 Empacotamento para Android (.APK)</span>
              <span>Esta interface responsiva utiliza HTML5 Geolocation API e CSS3 perfeitamente aderente ao <strong className="text-slate-200">Apache Cordova</strong> e <strong className="text-slate-200">Capacitor JS</strong>. Para gerar o APK nativo:</span>
              <code className="block bg-slate-900 p-2 rounded text-[10px] font-mono text-emerald-400">
                npm run build<br/>
                npx cap init PROMUSE com.promuse.coxim<br/>
                npx cap add android<br/>
                npx cap copy && npx cap open android
              </code>
            </div>
          </div>

          {/* TELEPHONE PREVIEW SHELL WITH VICTIM APP SCREEN */}
          <div className="md:col-span-2 flex justify-center items-center">
            {selectedSimulatedVictimId ? (
              (() => {
                const victim = db.victims.find(v => v.id === selectedSimulatedVictimId);
                if (!victim) return <div className="text-slate-400 text-xs">Assistida não encontrada.</div>;
                return (
                  <div className="bg-slate-950 p-4 pb-6 rounded-[45px] shadow-2xl border-[10px] border-slate-800 flex justify-center items-center w-full max-w-sm">
                    <div className="w-full">
                      <VictimPortal
                        victim={victim}
                        hearings={db.hearings}
                        occurrences={db.occurrences}
                        onTriggerAlert={triggerPanicAlert}
                        onRegisterIncident={registerIncidentFromPortal}
                      />
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="text-slate-400 bg-slate-950/50 p-10 rounded-2xl border border-slate-800 text-center max-w-md">
                Nenhuma assistida selecionada. Por favor, cadastre uma assistida no painel PMMS primeiro para ver o simulador mobile.
              </div>
            )}
          </div>

        </main>
      )}

      {/* 👮 ROLE 2: MILITARY COMMAND / MONITORING DASHBOARD */}
      {activeRole === 'police' && (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
          
          {/* ⚡ STATISTICS BANNER & ACTIVE PANIC COUNTER */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-4">
            
            {/* Live Panic Alert Count */}
            <div className={`p-4 rounded-2xl transition-all border flex items-center justify-between shadow-md ${
              activePanicCount > 0 
                ? 'bg-red-950/80 border-red-500 animate-pulse text-white' 
                : 'bg-slate-950/80 border-slate-800/80 text-slate-300'
            }`}>
              <div>
                <span className="text-[10px] uppercase font-black opacity-80 tracking-widest block">ALERTAS DE PÂNICO EM ANDAMENTO</span>
                <span className="text-3xl font-black block mt-1 tracking-tight">{activePanicCount}</span>
                <span className="text-[10px] block text-red-400 font-medium">Batalhão 100% de Prontidão</span>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                activePanicCount > 0 ? 'bg-red-600 text-white animate-spin duration-[4000ms]' : 'bg-slate-900 text-slate-500'
              }`}>
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>

            {/* Total Active Victims Enrolled */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between shadow-md">
              <div className="text-slate-300">
                <span className="text-[10px] uppercase font-black opacity-80 tracking-widest block">ASSISTIDAS MONITORADAS (PROMUSE)</span>
                <span className="text-3xl font-black block mt-1 tracking-tight text-slate-100">{db.victims.length}</span>
                <span className="text-[10px] block text-emerald-400 font-medium">{db.victims.filter(v => v.riskLevel === 'Alto').length} de Alto Risco em Coxim</span>
              </div>
              <div className="w-12 h-12 rounded-full bg-slate-900 text-emerald-400 flex items-center justify-center shrink-0">
                <UsersRound className="w-6 h-6" />
              </div>
            </div>

            {/* General Patrol Actions Tracked */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between shadow-md">
              <div className="text-slate-300">
                <span className="text-[10px] uppercase font-black opacity-80 tracking-widest block">OCORRÊNCIAS & RONDAS LOGADAS</span>
                <span className="text-3xl font-black block mt-1 tracking-tight text-slate-100">{db.occurrences.length}</span>
                <span className="text-[10px] block text-blue-400 font-medium">Patrulhamento ostensivo diário</span>
              </div>
              <div className="w-12 h-12 rounded-full bg-slate-900 text-blue-400 flex items-center justify-center shrink-0">
                <FileCheck2 className="w-6 h-6" />
              </div>
            </div>
            
          </div>

          {/* 🗺️ DYNAMIC GEOLOCATION MONITOR & INCOMING EMERGENCY LOGS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT AREA: MAP AND ALERT ACTIONS (7 COLS) */}
            <div className="lg:col-span-8 space-y-6">
              
              <div className="bg-slate-950 rounded-3xl border border-slate-850 overflow-hidden shadow-xl">
                {/* Map header */}
                <div className="bg-slate-900/40 px-5 py-4 border-b border-slate-850 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></div>
                    <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                      <Map className="w-4 h-4 text-emerald-400" />
                      Mapeamento em Tempo Real - Coxim-MS
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">Total de acionamentos: {db.panicAlerts.length}</span>
                </div>

                {/* Map Interface Body */}
                <div className="relative h-[340px] bg-slate-900 flex items-center justify-center overflow-hidden">
                  
                  {/* Visual Blueprint Grid of Coxim-MS Map */}
                  <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1.2px,transparent_1.2px)] [background-size:16px_16px] opacity-40"></div>
                  
                  {/* Dynamic Custom SVG Map with real live points */}
                  <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                    {/* Simulated Taquari River route passing through Coxim */}
                    <path
                      d="M 50 0 Q 150 120 220 180 T 400 340"
                      fill="none"
                      stroke="#0f3460"
                      strokeWidth="20"
                      strokeLinecap="round"
                      opacity="0.3"
                    />
                    <path
                      d="M 50 0 Q 150 120 220 180 T 400 340"
                      fill="none"
                      stroke="#1a3f6c"
                      strokeWidth="10"
                      strokeLinecap="round"
                      opacity="0.5"
                    />
                    <text x="140" y="80" fill="#2d4a77" fontSize="10" transform="rotate(35, 140, 80)" className="font-mono tracking-widest font-bold">RIO TAQUARI</text>

                    {/* Major roads like BR-163 */}
                    <path
                      d="M 0 100 L 600 240"
                      fill="none"
                      stroke="#334155"
                      strokeWidth="6"
                      strokeDasharray="4 4"
                      opacity="0.5"
                    />
                    <text x="20" y="90" fill="#475569" fontSize="9" className="font-mono">BR-163 (Sentido Pedro Gomes)</text>
                    <text x="350" y="210" fill="#475569" fontSize="9" className="font-mono">BR-163 (Sentido Campo Grande)</text>

                    {/* Neighborhood tags */}
                    <text x="50" y="40" fill="#334155" fontSize="10" className="font-sans font-bold">VILA SÃO PAULO</text>
                    <text x="450" y="290" fill="#334155" fontSize="10" className="font-sans font-bold">BAIRRO SANTO ANDRÉ</text>
                    <text x="550" y="60" fill="#334155" fontSize="10" className="font-sans font-bold">SENHOR DIVINO</text>
                    <text x="300" y="150" fill="#334155" fontSize="10" className="font-sans font-bold">CENTRO HISTÓRICO</text>

                    {/* GPS Grid rings for aesthetics */}
                    <circle cx="280" cy="170" r="130" stroke="#059669" strokeWidth="1" strokeDasharray="3 6" fill="none" opacity="0.1" />
                    <circle cx="280" cy="170" r="80" stroke="#059669" strokeWidth="1" strokeDasharray="2 4" fill="none" opacity="0.15" />

                    {/* Map Markers for panic alerts */}
                    {db.panicAlerts.map((alert, idx) => {
                      // Deterministic coordinate calculation mock mapping to SVG viewbox (approx relative based on seconds of time)
                      const seed = parseInt(alert.id.replace(/\D/g, '')) || 0;
                      const x = 100 + (seed % 400);
                      const y = 80 + ((seed >> 2) % 200);
                      const isSelected = selectedMapAlert?.id === alert.id;
                      const isActive = alert.status === 'Ativo';

                      return (
                        <g 
                          key={alert.id} 
                          className="cursor-pointer transition-all"
                          onClick={() => setSelectedMapAlert(alert)}
                        >
                          {isActive && (
                            <>
                              <circle cx={x} cy={y} r="18" fill="#ef4444" opacity="0.25" className="animate-ping" />
                              <circle cx={x} cy={y} r="8" fill="#ef4444" opacity="0.4" />
                            </>
                          )}
                          <circle 
                            cx={x} 
                            cy={y} 
                            r={isSelected ? "11" : "7"} 
                            fill={isActive ? "#ef4444" : "#10b981"} 
                            stroke="#ffffff" 
                            strokeWidth="2" 
                          />
                          <text 
                            x={x} 
                            y={y - 14} 
                            fill={isActive ? "#fca5a5" : "#a7f3d0"} 
                            fontSize="9" 
                            className="font-bold drop-shadow bg-slate-900/90 text-center" 
                            textAnchor="middle"
                          >
                            {alert.victimName.split(' ')[0]}
                          </text>
                        </g>
                      );
                    })}
                  </svg>

                  {/* Empty Map State Indicator */}
                  {db.panicAlerts.length === 0 && (
                    <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center p-6 text-center z-10">
                      <Compass className="w-12 h-12 text-slate-700 animate-spin mb-3" />
                      <p className="text-sm font-bold text-slate-400">Nenhum botão de pânico cadastrado para exibir no mapa.</p>
                      <p className="text-xs text-slate-600 max-w-xs mt-1">O mapa exibirá pings coloridos com ondas vermelhas assim que uma vítima disparar socorros.</p>
                    </div>
                  )}

                  {/* Corner Legend */}
                  <div className="absolute bottom-3 left-3 bg-slate-950/90 px-3 py-2 rounded-xl text-[10px] space-y-1.5 border border-slate-800/80 max-w-xs z-10">
                    <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-1">
                      <span>Legenda do Sistema</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                      <span className="text-slate-400">PÂNICO ATIVO (Guarnição PM em curso)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      <span className="text-slate-400">Ocorrência Solucionada / Patrulha Concluída</span>
                    </div>
                  </div>
                </div>

                {/* Selected Marker Control / Action Panel */}
                {selectedMapAlert && (
                  <div className="p-5 bg-slate-900 border-t border-slate-850">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                            selectedMapAlert.status === 'Ativo' ? 'bg-red-950 text-red-400 border border-red-800/50' : 'bg-emerald-950 text-emerald-400'
                          }`}>
                            Alerta {selectedMapAlert.status}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">Id: {selectedMapAlert.id}</span>
                        </div>
                        <h4 className="text-lg font-black text-rose-300 mt-1 flex items-center gap-2">
                          {selectedMapAlert.victimName}
                          <span className="text-xs font-normal text-slate-400 font-mono">({selectedMapAlert.victimPhone})</span>
                        </h4>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                          <span>Local: <strong className="text-slate-100">{selectedMapAlert.location.addressDescription}</strong></span>
                        </p>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        <span className="text-xs text-slate-400 font-medium">Acionado às: {new Date(selectedMapAlert.requestTime).toLocaleTimeString('pt-BR')}</span>
                      </div>
                    </div>

                    {selectedMapAlert.status === 'Ativo' ? (
                      <form onSubmit={handleResolveAlert} className="mt-4 bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                        <h5 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Ações do Despachante Policial:</h5>
                        <div className="space-y-2">
                          <label className="block text-[10px] text-slate-400 font-bold uppercase">Relatório de Encerramento (Breve histórico médico / prisão / ocorrência):</label>
                          <textarea
                            value={resolveComments}
                            onChange={(e) => setResolveComments(e.target.value)}
                            placeholder="Descreva o atendimento: ex: Cidadão abordado a 100m, preso por descumprimento, guarnição no local."
                            rows={2}
                            required
                            className="w-full text-xs p-2.5 bg-slate-900 rounded-lg border border-slate-800 focus:outline-none focus:border-red-500 text-slate-200"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Finalizar Alerta & Registar Ocorrência de Descumprimento
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedMapAlert(null)}
                            className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-400 text-xs rounded-lg cursor-pointer"
                          >
                            Fechar
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="mt-4 bg-emerald-950/20 border border-emerald-900/30 p-3 rounded-xl text-xs space-y-1">
                        <p className="font-bold text-emerald-400">Atendimento Encerrado e Auditado pelo Comando</p>
                        <p className="text-slate-300">"{selectedMapAlert.dispatcherComments}"</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* RIGHT AREA: CELLULAR ALERT SENDER LOGS / RADIO TRANSMISSION SIMULATOR (4 COLS) */}
            <div className="lg:col-span-4 space-y-6">
              
              <div className="bg-slate-950 rounded-3xl border border-slate-850 p-5 shadow-xl flex flex-col h-[525px]">
                <div className="flex items-center justify-between border-b border-slate-850 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-emerald-400 shrink-0" />
                    <h3 className="text-xs font-black text-slate-100 uppercase tracking-widest">
                      SMS/Whats PMMS Simulador
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[9px] font-black tracking-widest animate-pulse border border-emerald-900">
                    CANAL ON-LINE
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                  Quando o botão de pânico é pressionado, mensagens imediatas de socorro são encaminhadas em massa para os celulares da guarnição e oficiais gestores:
                </p>

                {/* SMS Live feeds scrollbox */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1.5">
                  {incomingSMSLogs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-600 text-xs">
                      <Bell className="w-8 h-8 text-slate-700 mb-2" />
                      Nenhum SMS/WhatsApp disparado recentemente. Ative o simulador da Vítima ao lado e clique em PÂNICO.
                    </div>
                  ) : (
                    incomingSMSLogs.map(log => (
                      <div key={log.id} className="bg-slate-900 p-3 rounded-xl border border-slate-850 text-[11px] relative space-y-1 hover:border-slate-800">
                        <div className="flex justify-between items-center bg-slate-950 px-2 py-1 rounded">
                          <span className="font-bold text-[10px] text-slate-300 truncate tracking-tight">{log.receiver}</span>
                          <span className="text-slate-500 text-[9px]">{log.timestamp}</span>
                        </div>
                        <p className="text-emerald-300 font-mono text-[10px] whitespace-pre-line leading-relaxed p-1">
                          {log.message}
                        </p>
                        <div className="flex justify-between items-center text-[9px]">
                          <span className="text-slate-500 font-mono">Coxim-MS 5BPM Network</span>
                          <span className="text-[9px] bg-emerald-950 text-emerald-400 px-1 py-0.2 rounded font-extrabold uppercase">{log.type} TRANSMITIDO</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {incomingSMSLogs.length > 0 && (
                  <button
                    onClick={() => setIncomingSMSLogs([])}
                    className="mt-3 w-full py-1.5 bg-slate-900 hover:bg-slate-850 hover:text-slate-200 border border-slate-800 rounded-lg text-slate-400 text-[10px] uppercase font-bold cursor-pointer transition-colors"
                  >
                    Limpar logs de celular
                  </button>
                )}
              </div>

            </div>

          </div>

          {/* 📃 MIDDLE BANNER: ASSISTIDAS TAB & INCLUSION CONTROL */}
          <div className="bg-slate-950 rounded-3xl border border-slate-850 p-5 shadow-xl space-y-4">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-850 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-100 flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-emerald-500 rounded-sm inline-block"></span>
                  Cadastro Geral de Assistidas (Medidas Protetivas)
                </h3>
                <p className="text-xs text-slate-400">Verifique os níveis de risco, patrulhas de monitoramento e medidas protetivas expedidas eletronicamente pelo fórum.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  id="btn_new_victim"
                  onClick={() => { resetVictimForm(); setIsVictimModalOpen(true); }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  Cadastrar Assistida e Medida
                </button>
                <button
                  onClick={() => setIsOccurrenceModalOpen(true)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-emerald-400" />
                  Registrar Ronda/Acompanhamento
                </button>
              </div>
            </div>

            {/* Filter controls */}
            <div className="flex flex-col md:flex-row gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-850 text-xs">
              <div className="flex-1 flex items-center bg-slate-950 rounded-xl px-3 border border-slate-800">
                <Search className="w-4 h-4 text-slate-500 mr-2" />
                <input
                  type="text"
                  placeholder="Pesquisar por nome, CPF ou processo judicial..."
                  value={victimSearch}
                  onChange={(e) => setVictimSearch(e.target.value)}
                  className="w-full bg-transparent text-xs py-2 focus:outline-none placeholder-slate-550 text-slate-200"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-slate-400 text-xs">Filtrar por Gravidade:</span>
                <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                  {['Todos', 'Baixo', 'Médio', 'Alto'].map(risk => (
                    <button
                      key={risk}
                      onClick={() => setRiskFilter(risk as any)}
                      className={`px-3 py-1 rounded text-[11px] font-bold uppercase transition-all whitespace-nowrap cursor-pointer ${
                        riskFilter === risk 
                          ? 'bg-slate-800 text-white text-[11.5px]' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {risk}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Table or Responsive list */}
            <div className="overflow-x-auto rounded-2xl border border-slate-850">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-900/40 border-b border-slate-850">
                  <tr>
                    <th className="px-5 py-3">Vítima Assistida</th>
                    <th className="px-5 py-3">Dados de Contato</th>
                    <th className="px-5 py-3">Risco Operacional</th>
                    <th className="px-5 py-3">Diligência / Patrulha Designada</th>
                    <th className="px-5 py-3">Sentença Protetiva</th>
                    <th className="px-5 py-3 text-right">Ações de Gestão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {filteredVictims.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-5 py-4">
                        <span className="font-extrabold text-slate-100 text-sm block">{v.name}</span>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                          <span>CPF: {v.cpf}</span>
                          <span>•</span>
                          <span>Cadastrada em {new Date(v.createdAt).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-semibold block">{v.phone}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5 truncate max-w-[200px]" title={v.address}>
                          {v.address}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider ${
                          v.riskLevel === 'Alto' ? 'bg-red-950 text-red-400 border border-red-900/40 animate-pulse' :
                          v.riskLevel === 'Médio' ? 'bg-amber-950 text-amber-400 border border-amber-900/40' :
                          'bg-emerald-950 text-emerald-400'
                        }`}>
                          {v.riskLevel} Gravidade
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-slate-200">
                          <span className="font-bold text-slate-300 block">{v.assignedPatrol}</span>
                          <span className="text-[10px] text-slate-400 block">Responsável: {v.policeOfficerInCharge}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 max-w-[220px]">
                        {v.protectiveOrder ? (
                          <div>
                            <span className="font-bold text-slate-300 block font-mono text-[10.5px] truncate" title={v.protectiveOrder.orderNumber}>
                              Proc: {v.protectiveOrder.orderNumber}
                            </span>
                            {v.protectiveOrder.defendantName && (
                              <span className="text-[10px] text-amber-300 block mt-0.5 truncate" title={v.protectiveOrder.defendantName}>Réu: {v.protectiveOrder.defendantName}</span>
                            )}
                            <span className="text-[10px] text-rose-300 block mt-0.5">Expira: {new Date(v.protectiveOrder.expiryDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">Nenhuma medida cadastrada</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 px-1">
                          <button
                            onClick={() => handleEditVictimClick(v)}
                            className="p-1.5 bg-slate-900 hover:bg-slate-840 border border-slate-800 hover:text-white text-slate-450 rounded-lg cursor-pointer"
                            title="Editar Assistida"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteVictimClick(v.id)}
                            className="p-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-900/35 hover:text-white text-red-400 rounded-lg cursor-pointer"
                            title="Excluir Assistida"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredVictims.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-slate-550 italic text-sm">
                        Nenhuma assistida encontrada com os termos ou filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>

          {/* 📬 LOWER PANEL: OCCURRENCES HISTORY */}
          <div className="bg-slate-950 rounded-3xl border border-slate-850 p-5 shadow-xl space-y-4 w-full">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <h3 className="text-xs font-black text-slate-100 uppercase tracking-widest">
                  Histórico de Acompanhamento (PROMUSE)
                </h3>
              </div>
              <button
                onClick={() => setIsOccurrenceModalOpen(true)}
                className="text-[10px] bg-slate-900 hover:bg-slate-800 text-white font-bold tracking-wider uppercase px-2.5 py-1 rounded-md cursor-pointer border border-slate-800"
              >
                Registrar Ronda
              </button>
            </div>

            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
              {db.occurrences.map((o) => (
                <div key={o.id} className="bg-slate-900 border border-slate-850 p-3 rounded-xl space-y-1.5 text-xs text-slate-350">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-extrabold text-slate-200 underline">{o.victimName}</span>
                    <span className="text-slate-500">{new Date(o.date).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div>
                    <span className="font-black bg-emerald-950 text-emerald-400 px-2.5 py-0.5 rounded text-[9px] uppercase tracking-wider">{o.type}</span>
                  </div>
                  <p className="italic leading-relaxed text-[11px] text-slate-300">"{o.description}"</p>
                  <div className="flex justify-between items-center text-[9.5px] border-t border-slate-850 pt-1.5 text-slate-450 mt-1">
                    <span>Registrado por: <strong>{o.registeredByOfficer}</strong></span>
                    {o.actionsTaken && <span className="bg-slate-950 px-1.5 py-0.5 rounded text-emerald-300 max-w-[150px] truncate" title={o.actionsTaken}>Ação: {o.actionsTaken}</span>}
                  </div>
                </div>
              ))}

              {db.occurrences.length === 0 && (
                <p className="text-center text-slate-500 italic text-xs py-8">Nenhuma ronda policial cadastrada.</p>
              )}
            </div>
          </div>

        </main>
      )}

      {/* 🔮 VICTIM INCLUSION MODAL */}
      {isVictimModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setIsVictimModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-lg font-black text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-5 h-5 text-emerald-400" />
                {editingVictim ? 'Editar Cadastro da Assistida' : 'Cadastrar Nova Assistida PROMUSE'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Informe os dados cadastrais da vítima e os termos da Medida Protetiva de Urgência decretados pelo Fórum de Coxim-MS.</p>
            </div>

            <form onSubmit={handleSaveVictim} className="space-y-4">
              
              {!editingVictim && (
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex flex-col sm:flex-row items-center gap-4 justify-between">
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-200">Autopreenchimento Inteligente</h4>
                    <p className="text-xs text-slate-400 mt-1">Carregue o PDF da Medida Protetiva. Nossa IA lerá os dados e preencherá o formulário para você automaticamente.</p>
                  </div>
                  <div className="relative">
                    <input 
                      type="file" 
                      accept="application/pdf" 
                      onChange={handlePdfUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={isParsingPdf}
                    />
                    <button type="button" disabled={isParsingPdf} className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 ${isParsingPdf ? 'bg-slate-700 text-slate-500' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}>
                      {isParsingPdf ? (
                         <>
                           <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                           LENDO PDF...
                         </>
                      ) : (
                         <>
                           <FileText className="w-4 h-4" />
                           ANEXAR PDF MPU
                         </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {pdfParseStatus && (
                <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                  pdfParseStatus.type === 'success' 
                    ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300' 
                    : 'bg-rose-950/40 border-rose-800/80 text-rose-300'
                }`}>
                  {pdfParseStatus.type === 'success' ? (
                    <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
                  )}
                  <div>
                    <span className="font-bold block uppercase mb-0.5">
                      {pdfParseStatus.type === 'success' ? 'Leitura Concluída' : 'Erro na Leitura'}
                    </span>
                    <p className="text-[11px] leading-relaxed">{pdfParseStatus.message}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Nome Completo da Assistida</label>
                  <input
                    type="text"
                    required
                    value={newVictimForm.name}
                    onChange={(e) => setNewVictimForm({...newVictimForm, name: e.target.value})}
                    placeholder="Nome completo sem abreviações"
                    className="w-full bg-slate-955 p-2.5 rounded-lg border border-slate-800 text-slate-250 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">CPF (Opcional)</label>
                  <input
                    type="text"
                    value={newVictimForm.cpf}
                    onChange={(e) => setNewVictimForm({...newVictimForm, cpf: e.target.value})}
                    placeholder="000.000.000-00"
                    className="w-full bg-slate-955 p-2.5 rounded-lg border border-slate-800 text-slate-250 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Celular (WhatsApp) (Opcional)</label>
                  <input
                    type="text"
                    value={newVictimForm.phone}
                    onChange={(e) => setNewVictimForm({...newVictimForm, phone: e.target.value})}
                    placeholder="(67) 99000-1234"
                    className="w-full bg-slate-955 p-2.5 rounded-lg border border-slate-800 text-slate-250 focus:outline-none"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Endereço de Residência em Coxim-MS (Opcional)</label>
                  <AddressInput
                    value={newVictimForm.address}
                    onChange={(val) => setNewVictimForm({...newVictimForm, address: val})}
                    className="w-full bg-slate-955 p-2.5 rounded-lg border border-slate-800 text-slate-250 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Grau de Risco Operacional</label>
                  <select
                    value={newVictimForm.riskLevel}
                    onChange={(e) => setNewVictimForm({...newVictimForm, riskLevel: e.target.value as any})}
                    className="w-full bg-slate-955 p-2.5 rounded-lg border border-slate-800 text-slate-250 font-bold"
                  >
                    <option value="Baixo">Baixo Risco</option>
                    <option value="Médio">Médio Risco</option>
                    <option value="Alto">ALTO RISCO (Patrulhamento frequente)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Viatura da Rota Escala</label>
                  <input
                    type="text"
                    required
                    value={newVictimForm.assignedPatrol}
                    onChange={(e) => setNewVictimForm({...newVictimForm, assignedPatrol: e.target.value})}
                    placeholder="VTR PROMUSE 5040"
                    className="w-full bg-slate-955 p-2.5 rounded-lg border border-slate-800 text-slate-250 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Policial PM Responsável</label>
                  <input
                    type="text"
                    required
                    value={newVictimForm.policeOfficerInCharge}
                    onChange={(e) => setNewVictimForm({...newVictimForm, policeOfficerInCharge: e.target.value})}
                    placeholder="Sgt PM Anderson"
                    className="w-full bg-slate-955 p-2.5 rounded-lg border border-slate-800 text-slate-250 focus:outline-none"
                  />
                </div>
              </div>

              {/* Legal Protection Order Info fields inside the form */}
              <div className="bg-slate-955 p-4 rounded-xl border border-slate-800 space-y-3.5 text-xs">
                <h4 className="text-[11px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                  <FileText className="w-4.5 h-4.5" /> SENTENÇA JURÍDICA E RESTRIÇÕES PROTETIVAS
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9.5px] text-slate-400 font-bold uppercase mb-0.5">Número Processual</label>
                    <input
                      type="text"
                      required
                      value={newVictimForm.orderNumber}
                      onChange={(e) => setNewVictimForm({...newVictimForm, orderNumber: e.target.value})}
                      placeholder="0001000-00.2026.8.12.0011"
                      className="w-full bg-slate-900 p-2 rounded border border-slate-800 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9.5px] text-slate-400 font-bold uppercase mb-0.5">Nome do Réu / Agressor</label>
                    <input
                      type="text"
                      required
                      value={newVictimForm.defendantName}
                      onChange={(e) => setNewVictimForm({...newVictimForm, defendantName: e.target.value})}
                      placeholder="Nome completo do réu"
                      className="w-full bg-slate-900 p-2 rounded border border-slate-800 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-[9.5px] text-slate-400 font-bold uppercase mb-0.5">Magistrado(a) Emitente</label>
                    <input
                      type="text"
                      required
                      value={newVictimForm.judgeName}
                      onChange={(e) => setNewVictimForm({...newVictimForm, judgeName: e.target.value})}
                      placeholder="Dr. Cláudio Müller Pareja"
                      className="w-full bg-slate-900 p-2 rounded border border-slate-800 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9.5px] text-slate-400 font-bold uppercase mb-0.5">Data de Expedição</label>
                    <input
                      type="date"
                      required
                      value={newVictimForm.issueDate}
                      onChange={(e) => setNewVictimForm({...newVictimForm, issueDate: e.target.value})}
                      className="w-full bg-slate-900 p-2 rounded border border-slate-800 text-slate-250 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9.5px] text-slate-400 font-bold uppercase mb-0.5">Prazo de Expiração</label>
                    <input
                      type="date"
                      required
                      value={newVictimForm.expiryDate}
                      onChange={(e) => setNewVictimForm({...newVictimForm, expiryDate: e.target.value})}
                      className="w-full bg-slate-900 p-2 rounded border border-slate-800 text-slate-200"
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-[9.5px] text-slate-400 font-bold uppercase mb-0.5">Restrições Impostas ao Réu</label>
                    <textarea
                      required
                      value={newVictimForm.restrictions}
                      onChange={(e) => setNewVictimForm({...newVictimForm, restrictions: e.target.value})}
                      placeholder="Proibição de contato, distância física mínima, etc."
                      rows={2}
                      className="w-full bg-slate-900 p-2 rounded border border-slate-800 text-slate-250 focus:outline-none resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsVictimModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-955 border border-slate-800 text-slate-400 rounded-lg cursor-pointer hover:bg-slate-850"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer transition-colors"
                >
                  Confirmar e Registrar Assistida
                </button>
              </div>

            </form>
          </div>
        </div>
      )}



      {/* 📃 OCCURRENCE LOG MODAL */}
      {isOccurrenceModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <button 
              onClick={() => setIsOccurrenceModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-5 h-5 text-emerald-400" />
                Registrar Ronda de Fiscalização / Incidente
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Adicione o relatório periódico de visitas ou violações cometidas pelo réu.</p>
            </div>

            <form onSubmit={handleSaveOccurrence} className="space-y-4 text-xs text-slate-350">
              
              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Vítima Relacionada</label>
                <select
                  required
                  value={newOccurrenceForm.victimId}
                  onChange={(e) => setNewOccurrenceForm({...newOccurrenceForm, victimId: e.target.value})}
                  className="w-full bg-slate-955 p-2.5 rounded-lg border border-slate-800 text-slate-200"
                >
                  <option value="">-- Selecionar Assistida --</option>
                  {db.victims.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Tipo de Acompanhamento</label>
                <select
                  value={newOccurrenceForm.type}
                  onChange={(e) => setNewOccurrenceForm({...newOccurrenceForm, type: e.target.value as any})}
                  className="w-full bg-slate-955 p-2.5 rounded-lg border border-slate-800 text-slate-250 font-bold"
                >
                  <option value="Visita Preventiva">Visita Preventiva Regular</option>
                  <option value="Ronda PROMUSE">Ronda Preventiva nas Proximidades</option>
                  <option value="Descumprimento de Medida">Descumprimento de Medida Judicial</option>
                  <option value="Ameaça/Agressão">Ameaça ou Agressão física constatada</option>
                  <option value="Outro">Outras Condutas / Ocorrências específicas</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Descrição Detalhada do Ocorrido</label>
                <textarea
                  required
                  value={newOccurrenceForm.description}
                  onChange={(e) => setNewOccurrenceForm({...newOccurrenceForm, description: e.target.value})}
                  placeholder="Relatório oficial da guarnição, ex: Visita feita à residência da Maria. Mesma afirma que está conseguindo trabalhar normalmente sem assédio do agressor."
                  rows={4}
                  className="w-full bg-slate-955 p-2 rounded-lg border border-slate-800 text-slate-200 resize-none font-sans"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Policial Relator</label>
                <input
                  type="text"
                  required
                  value={newOccurrenceForm.registeredByOfficer}
                  onChange={(e) => setNewOccurrenceForm({...newOccurrenceForm, registeredByOfficer: e.target.value})}
                  className="w-full bg-slate-955 p-2.5 rounded-lg border border-slate-800 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Ações Corretivas / Encaminhamentos</label>
                <input
                  type="text"
                  value={newOccurrenceForm.actionsTaken}
                  onChange={(e) => setNewOccurrenceForm({...newOccurrenceForm, actionsTaken: e.target.value})}
                  placeholder="Ex: Auto boletim de ocorrência complementar ou relatório ao Juiz."
                  className="w-full bg-slate-955 p-2.5 rounded-lg border border-slate-800 text-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOccurrenceModalOpen(false)}
                  className="px-4 py-2 bg-slate-955 border border-slate-800 text-slate-400 rounded-lg cursor-pointer hover:bg-slate-850"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer"
                >
                  Registrar Ocorrência
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 👑 PORTAL DE GERENCIAMENTO DE ADMINISTRADORES (GOOGLE LOGIN) */}
      {activeRole === 'admin' && (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
          <AdminManagement />
        </main>
      )}

      {/* 👮 BOTTOM FOOTER SYSTEM INFO */}
      <footer className="bg-slate-950 border-t border-slate-900 px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-emerald-600" />
          <span>PROMUSE Coxim-MS © 2026. Segurança pública integrada e inteligente.</span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px]">
          <span className="text-emerald-500 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
            Canal Operativo 5º BPM
          </span>
          <span>Coxim-MS, BR</span>
        </div>
      </footer>

    </div>
  );
}
