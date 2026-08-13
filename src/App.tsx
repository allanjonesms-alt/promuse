import { firebaseApiFetch } from './lib/api';
import { safeFormatDate, safeFormatTime, safeFormatDateTime } from './lib/utils';
import React, { useState, useEffect, useMemo } from 'react';
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
  Map as MapIcon,
  Filter,
  UsersRound,
  FileCheck2,
  Printer,
  ArrowLeft,
  History,
  FileX,
  ShieldAlert
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { PrintableFicha } from './components/PrintableFicha';
import { AppDB, Victim, PanicAlert, Occurrence, ProtectiveOrder } from './types';
import VictimPortal from './components/VictimPortal';
import AdminManagement from './components/AdminManagement';
import { SafeAdvancedMarker } from './components/SafeAdvancedMarker';
import { APIProvider, Map as GoogleMap, Pin } from '@vis.gl/react-google-maps';
import AddressInput, { validateAddress } from './components/AddressInput';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import firebaseConfig from '../firebase-applet-config.json';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  firebaseConfig?.apiKey ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY' && API_KEY !== '';

export default function App() {
  if (!hasValidKey) {
    console.warn("Google Maps API Key Requerida (GOOGLE_MAPS_PLATFORM_KEY). O mapa pode não carregar corretamente.");
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
  const [adminUnit, setAdminUnit] = useState<string>('COXIM');
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [syncingData, setSyncingData] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showMapsTroubleshooter, setShowMapsTroubleshooter] = useState(!hasValidKey);
  const [activeRole, setActiveRole] = useState<'police' | 'victim' | 'admin'>('police');
  const [policeView, setPoliceView] = useState<'dashboard' | 'victims'>('dashboard');
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
  const [issueMonthFilter, setIssueMonthFilter] = useState<string>('Todos');
  const [alertStatusFilter, setAlertStatusFilter] = useState<'Todos' | 'Ativo' | 'Resolvido'>('Todos');
  const [occurrenceTypeFilter, setOccurrenceTypeFilter] = useState<string>('Todos');

  // Parse year/month for protective order issue dates
  const parseIssueYearMonth = (issueDateStr?: string): { key: string; label: string } | null => {
    if (!issueDateStr) return null;
    let year = '';
    let month = '';

    if (issueDateStr.includes('-')) {
      const parts = issueDateStr.split('T')[0].split('-');
      if (parts.length >= 2) {
        year = parts[0];
        month = parts[1].padStart(2, '0');
      }
    } else if (issueDateStr.includes('/')) {
      const parts = issueDateStr.split('/');
      if (parts.length === 3) {
        if (parts[2].length === 4) {
          year = parts[2];
          month = parts[1].padStart(2, '0');
        } else if (parts[0].length === 4) {
          year = parts[0];
          month = parts[1].padStart(2, '0');
        }
      }
    } else {
      const d = new Date(issueDateStr);
      if (!isNaN(d.getTime())) {
        year = String(d.getFullYear());
        month = String(d.getMonth() + 1).padStart(2, '0');
      }
    }

    const MONTH_NAMES: Record<string, string> = {
      '01': 'Janeiro',
      '02': 'Fevereiro',
      '03': 'Março',
      '04': 'Abril',
      '05': 'Maio',
      '06': 'Junho',
      '07': 'Julho',
      '08': 'Agosto',
      '09': 'Setembro',
      '10': 'Outubro',
      '11': 'Novembro',
      '12': 'Dezembro',
    };

    if (!year || !month || !MONTH_NAMES[month]) return null;

    const key = `${year}-${month}`;
    const monthName = MONTH_NAMES[month];
    const label = `${month}/${year} - ${monthName}`;

    return { key, label };
  };

  // Compute available months with expedida protective measures in descending order
  const availableIssueMonths = useMemo(() => {
    const monthMap: Record<string, string> = {};
    db.victims.forEach(v => {
      const parsed = parseIssueYearMonth(v.protectiveOrder?.issueDate);
      if (parsed) {
        monthMap[parsed.key] = parsed.label;
      }
    });

    return Object.entries(monthMap)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, label]) => ({ key, label }));
  }, [db.victims]);

  // Administrators list state for Police Officer Auto-complete
  const [adminAccounts, setAdminAccounts] = useState<{ email: string; name: string; rankRole?: string; status?: string }[]>([]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    const loadAdmins = async () => {
      try {
        const { collection, onSnapshot } = await import('firebase/firestore');
        const { db: firestoreDb } = await import('./firebase');
        const unsubs = onSnapshot(collection(firestoreDb, 'admins'), (snapshot) => {
          const list: { email: string; name: string; rankRole?: string; status?: string }[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.status !== 'Inativo') {
              list.push({
                email: doc.id || data.email,
                name: data.name || data.email,
                rankRole: data.rankRole || '',
                status: data.status || 'Ativo'
              });
            }
          });
          setAdminAccounts(list);
        }, (err) => {
          console.warn("Firestore admins listener note:", err);
        });
        unsubscribe = unsubs;
      } catch (err) {
        console.warn("Error setting up admins listener in App.tsx:", err);
      }
    };
    loadAdmins();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const adminOfficerNames = useMemo(() => {
    const names = adminAccounts.map(a => {
      if (a.rankRole && !a.name.toLowerCase().includes(a.rankRole.toLowerCase())) {
        return `${a.rankRole} ${a.name}`.trim();
      }
      return a.name.trim();
    }).filter(Boolean);

    const defaults = ['Sgt PM Anderson', 'Cb PM Fernanda', 'Ten PM Rodrigo', 'SubTen PM Marcio', 'Allan Jones'];
    const combined = Array.from(new Set([...names, ...defaults]));
    return combined;
  }, [adminAccounts]);

  // Modal / Form States
  const [isVictimModalOpen, setIsVictimModalOpen] = useState(false);
  const [isOfficerSuggestionsOpen, setIsOfficerSuggestionsOpen] = useState(false);
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
    aggressorPhotoUrl: '',
    judgeName: 'Dr. Cláudio Müller Pareja',
    restrictions: 'Proibição de aproximação física (mínimo de 300 metros) do local de residência da vítima.',
    issueDate: '',
    expiryDate: '',
    coordinates: null as { latitude: number; longitude: number } | null
  });

  // Revogação Modal State
  const [isRevocationModalOpen, setIsRevocationModalOpen] = useState(false);
  const [revocationVictim, setRevocationVictim] = useState<Victim | null>(null);
  const [revocationForm, setRevocationForm] = useState({
    noticeNumber: '',
    date: new Date().toISOString().split('T')[0],
    reason: ''
  });
  const [isSubmittingRevocation, setIsSubmittingRevocation] = useState(false);

  const handleOpenRevocationModal = (victim: Victim) => {
    setRevocationVictim(victim);
    setRevocationForm({
      noticeNumber: victim.protectiveOrder?.revocationNoticeNumber || '',
      date: victim.protectiveOrder?.revocationDate || new Date().toISOString().split('T')[0],
      reason: ''
    });
    setIsRevocationModalOpen(true);
  };

  const handleConfirmRevocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revocationVictim || !revocationVictim.protectiveOrder) return;
    if (!revocationForm.noticeNumber.trim() || !revocationForm.date) {
      alert("Por favor, preencha o número do ofício e a data da revogação.");
      return;
    }

    setIsSubmittingRevocation(true);

    const updatedProtectiveOrder: ProtectiveOrder = {
      ...revocationVictim.protectiveOrder,
      status: 'Revogada',
      revocationNoticeNumber: revocationForm.noticeNumber.trim(),
      revocationDate: revocationForm.date
    };

    const updatedVictim: Victim = {
      ...revocationVictim,
      protectiveOrder: updatedProtectiveOrder
    };

    const formattedRevDate = safeFormatDate(revocationForm.date);
    const newOcc: Occurrence = {
      id: 'occ_rev_' + Date.now(),
      victimId: revocationVictim.id,
      victimName: revocationVictim.name,
      date: revocationForm.date || new Date().toISOString().split('T')[0],
      type: 'Outro',
      cadgProtocol: revocationForm.noticeNumber.trim(),
      description: `[MEDIDA PROTETIVA REVOGADA] Medida Protetiva nº ${revocationVictim.protectiveOrder.orderNumber || ''} foi REVOGADA conforme Ofício nº ${revocationForm.noticeNumber.trim()} emitido em ${formattedRevDate}.${revocationForm.reason ? ' Observações: ' + revocationForm.reason : ''}`,
      registeredByOfficer: 'Policial Coordenador PROMUSE',
      actionsTaken: `Anotação de revogação de MPU no sistema PROMUSE e alteração do status para Inativa conforme Ofício nº ${revocationForm.noticeNumber.trim()}.`
    };

    try {
      await firebaseApiFetch(`/api/victims/${revocationVictim.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedVictim)
      });

      await firebaseApiFetch('/api/occurrences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOcc)
      });

      setDb(prev => ({
        ...prev,
        victims: prev.victims.map(v => v.id === revocationVictim.id ? updatedVictim : v),
        occurrences: [newOcc, ...prev.occurrences]
      }));

      setIsRevocationModalOpen(false);
      setRevocationVictim(null);
    } catch (err) {
      console.warn("Erro ao salvar revogação na API, atualizando localmente:", err);
      setDb(prev => ({
        ...prev,
        victims: prev.victims.map(v => v.id === revocationVictim.id ? updatedVictim : v),
        occurrences: [newOcc, ...prev.occurrences]
      }));
      setIsRevocationModalOpen(false);
      setRevocationVictim(null);
    } finally {
      setIsSubmittingRevocation(false);
    }
  };



  const [isOccurrenceModalOpen, setIsOccurrenceModalOpen] = useState(false);
  const printRef = React.useRef<HTMLDivElement>(null);
  const handlePrint = async () => {
    if (!printRef.current) return;
    
    try {
      // We dynamically import to keep initial bundle size smaller
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      
      const element = printRef.current;
      
      // We temporarily make it visible for html2canvas to capture it properly
      const originalPosition = element.style.position;
      const originalTop = element.style.top;
      const originalLeft = element.style.left;
      const originalDisplay = element.style.display;
      
      element.style.position = 'absolute';
      element.style.top = '0';
      element.style.left = '0';
      element.style.display = 'block';
      element.style.zIndex = '-1000'; // keep it behind other elements
      
      const pages = element.querySelectorAll('.pdf-page');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i] as HTMLElement;
        const canvas = await html2canvas(page, {
          scale: 2, // better resolution
          useCORS: true, // for images
          logging: false
        });
        
        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        if (i > 0) {
          pdf.addPage();
        }
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }
      
      // Restore styles
      element.style.position = originalPosition;
      element.style.top = originalTop;
      element.style.left = originalLeft;
      element.style.display = originalDisplay;
      element.style.zIndex = '';
      
      const fileName = newOccurrenceForm.victimId 
        ? `Ficha_Atendimento_${newOccurrenceForm.victimId}.pdf` 
        : 'Ficha_Atendimento.pdf';
        
      pdf.save(fileName);
    } catch (err) {
      console.error("Error generating PDF:", err);
      alert("Houve um erro ao gerar o PDF da ficha.");
    }
  };
  
  const [newOccurrenceForm, setNewOccurrenceForm] = useState({
    victimId: '',
    type: 'Visita Preventiva' as 'Visita Preventiva' | 'Ronda PROMUSE' | 'Descumprimento de Medida' | 'Ameaça/Agressão' | 'Outro',
    description: '',
    registeredByOfficer: 'Sgt PM Anderson',
    actionsTaken: '',
    cadgProtocol: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Active Map Selection State
  const [selectedMapAlert, setSelectedMapAlert] = useState<PanicAlert | null>(null);
  const [selectedMapVictim, setSelectedMapVictim] = useState<Victim | null>(null);
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
            const { getAuth } = await import('firebase/auth');
            const docRef = doc(firestoreDb, 'admins', 'allanjonesms@gmail.com');
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) {
              const authInstance = getAuth();
              await setDoc(docRef, {
                email: 'allanjonesms@gmail.com',
                name: user.displayName || 'Allan Jones',
                unit: 'COXIM',
                role: 'master',
                status: 'Ativo',
                addedBy: 'Instanciação Automática',
                createdAt: Timestamp.now()
              });
              setAdminUnit('COXIM');
            } else {
              if (docSnap.data().unit) {
                setAdminUnit(docSnap.data().unit);
              }
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
            if (docSnap.data().unit) {
              setAdminUnit(docSnap.data().unit);
            }
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

  const getMapCenter = (unit: string) => {
    switch (unit) {
      case 'RIO VERDE': return { lat: -18.9181, lng: -54.8442 };
      case 'PEDRO GOMES': return { lat: -18.1025, lng: -54.5519 };
      case 'ALCINÓPOLIS': return { lat: -18.3242, lng: -53.7028 };
      case 'SONORA': return { lat: -17.5756, lng: -54.7431 };
      case 'COXIM':
      default:
        return { lat: -18.5067, lng: -54.7600 };
    }
  };

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
          coordinates: victim.coordinates,
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
    
    const smsMessage = `🚨 ALERTA PROMUSE 🚨\nBOTAO DE PANICO acionado por: ${vName}.\nContato: ${vPhone}\n📍 Local: ${location.addressDescription}\nCoordenadas: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}\nUnidades de serviço mobilizadas de imediato.`;
    
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
        receiver: 'Coordenadora PROMUSE',
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
        actionsTaken: 'Aguardando revisão policial no quartel.'
      };
      const updatedOccs = [newOcc, ...db.occurrences];
      updateDbState({ ...db, occurrences: updatedOccs });
    }
  };

  // Reset database to default seed helper
  const handleResetDB = async () => {
    if (window.confirm('Tem certeza que deseja restaurar o banco de dados original?')) {
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

    // Enforce restricted MS cities validation before submit
    const addressCheck = validateAddress(newVictimForm.address);
    if (!addressCheck.isValid) {
      alert(`Restrição de Município:\n\n${addressCheck.error}\n\nPor favor, informe um endereço válido dentro de um dos municípios atendidos pelo PROMUSE.`);
      return;
    }
    const payload = {
      name: newVictimForm.name,
      cpf: newVictimForm.cpf,
      phone: newVictimForm.phone,
      address: newVictimForm.address,
      riskLevel: newVictimForm.riskLevel,
      policeOfficerInCharge: newVictimForm.policeOfficerInCharge,
      assignedPatrol: newVictimForm.assignedPatrol,
      coordinates: newVictimForm.coordinates || undefined,
      protectiveOrder: {
        orderNumber: newVictimForm.orderNumber,
        defendantName: newVictimForm.defendantName,
        judgeName: newVictimForm.judgeName,
        restrictions: newVictimForm.restrictions,
        issueDate: newVictimForm.issueDate || new Date().toISOString().split('T')[0],
        expiryDate: newVictimForm.expiryDate || new Date(Date.now() + 180*24*60*60*1000).toISOString().split('T')[0],
        status: editingVictim?.protectiveOrder?.status || 'Ativa',
        revocationNoticeNumber: editingVictim?.protectiveOrder?.revocationNoticeNumber,
        revocationDate: editingVictim?.protectiveOrder?.revocationDate
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
              aggressorPhotoUrl: newVictimForm.aggressorPhotoUrl,
              coordinates: newVictimForm.coordinates || undefined,
              protectiveOrder: {
                id: v.protectiveOrder?.id || 'ord_fb_' + Date.now(),
                orderNumber: newVictimForm.orderNumber,
                defendantName: newVictimForm.defendantName,
                judgeName: newVictimForm.judgeName,
                restrictions: newVictimForm.restrictions,
                issueDate: newVictimForm.issueDate || new Date().toISOString().split('T')[0],
                expiryDate: newVictimForm.expiryDate || new Date(Date.now() + 180*24*60*60*1000).toISOString().split('T')[0],
                status: v.protectiveOrder?.status || 'Ativa',
                revocationNoticeNumber: v.protectiveOrder?.revocationNoticeNumber,
                revocationDate: v.protectiveOrder?.revocationDate
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
          aggressorPhotoUrl: newVictimForm.aggressorPhotoUrl,
          createdAt: new Date().toISOString(),
          coordinates: newVictimForm.coordinates || undefined,
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
      aggressorPhotoUrl: v.aggressorPhotoUrl || '',
      judgeName: v.protectiveOrder?.judgeName || 'Dr. Cláudio Müller Pareja',
      restrictions: v.protectiveOrder?.restrictions || '',
      issueDate: v.protectiveOrder?.issueDate || '',
      expiryDate: v.protectiveOrder?.expiryDate || '',
      coordinates: v.coordinates || null
    });
    setIsVictimModalOpen(true);
    setIsOccurrenceModalOpen(false);
  };

  const handleDeleteVictimClick = async (victimId: string) => {
    if (window.confirm(`Excluir esta assistida permanentemente do cadastro da unidade ${adminUnit}?`)) {
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
      policeOfficerInCharge: currentUser?.displayName || 'A definir',
      assignedPatrol: 'VTR PROMUSE 5040',
      orderNumber: '',
      defendantName: '',
      aggressorPhotoUrl: '',
      judgeName: 'Dr. Cláudio Müller Pareja',
      restrictions: 'Proibição de aproximação física (mínimo de 300 metros) do local de residência da vítima.',
      issueDate: '',
      expiryDate: '',
      coordinates: null
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
          actionsTaken: '',
          cadgProtocol: '',
          date: new Date().toISOString().split('T')[0]
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
        date: newOccurrenceForm.date ? new Date(newOccurrenceForm.date).toISOString() : new Date().toISOString(),
        cadgProtocol: newOccurrenceForm.cadgProtocol,
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
          dispatcherComments: resolveComments || `Atendimento emergencial resolvido e registrado via rádio da unidade ${adminUnit}.`,
          autoLogOccurrence: true,
          registeredByOfficer: 'Coordenação PROMUSE'
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
    
    let matchesMonth = true;
    if (issueMonthFilter !== 'Todos') {
      const parsed = parseIssueYearMonth(v.protectiveOrder?.issueDate);
      matchesMonth = parsed ? (parsed.key === issueMonthFilter || parsed.key.endsWith('-' + issueMonthFilter)) : false;
    }

    return matchesSearch && matchesMonth;
  });

  // Filtered Alerts
  const filteredAlerts = db.panicAlerts.filter(a => {
    if (alertStatusFilter === 'Todos') return true;
    return a.status === alertStatusFilter;
  });

  const activePanicCount = db.panicAlerts.filter(a => a.status === 'Ativo').length;

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-300">
          <div className="w-8 h-8 rounded-full border-4 border-t-emerald-500 border-emerald-900 animate-spin"></div>
          <span className="text-xs font-mono tracking-wider uppercase opacity-80">Carregando Sistema...</span>
        </div>
      </div>
    );
  }

  if (!isAdminAuthorized) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col pt-12 items-center px-4">
        <AdminManagement />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans transition-all selection:bg-rose-600 selection:text-white">
      
      {/* 🇨🇷 MILITARY HEADER */}
      <header className="bg-[#420B34] border-b border-[#5E164C]/20 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg sticky top-0 z-40">
        <div 
          className="flex items-center gap-4 cursor-pointer hover:opacity-95 transition-opacity"
          onClick={() => {
            if (activeRole === 'police') {
              setIsVictimModalOpen(false);
              setIsOccurrenceModalOpen(false);
              setPoliceView('dashboard');
            }
          }}
          title="Ir para o Dashboard"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-900/30 shrink-0 border border-emerald-400/20">
            <Shield className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#FFCCD6] bg-black/40 px-2 py-0.5 rounded border border-white/10">PMMS</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#FFCCD6] bg-black/40 px-2 py-0.5 rounded border border-white/10">UNIDADE {adminUnit}</span>
            </div>
            <h1 className="text-xl font-black text-white tracking-tight mt-0.5">PROMUSE <span className="font-light text-rose-300">Mulher Segura</span></h1>
          </div>
        </div>

        {/* Global Simulated Environment State & Role Swapping */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-black/40 p-1.5 rounded-xl border border-white/10 shadow-inner">
            <button
              id="switch_police_role"
              onClick={() => {
                setActiveRole('police');
                setIsVictimModalOpen(false);
                setIsOccurrenceModalOpen(false);
                setPoliceView('dashboard');
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 cursor-pointer ${
                activeRole === 'police' 
                  ? 'bg-emerald-600/90 text-white shadow-md' 
                  : 'text-slate-300 hover:text-white hover:bg-white/20'
              }`}
            >
              <Activity className="w-4 h-4" />
              PAINEL
            </button>
            <button
              id="switch_victim_role"
              onClick={() => setActiveRole('victim')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 cursor-pointer ${
                activeRole === 'victim' 
                  ? 'bg-rose-700/90 text-white shadow-md animate-pulse' 
                  : 'text-slate-300 hover:text-white hover:bg-white/20'
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
                  : 'text-slate-300 hover:text-white hover:bg-white/20'
              }`}
            >
              <Lock className="w-4 h-4" />
              Gestão de Admins
            </button>
          </div>

          <button
            onClick={handleResetDB}
            title="Restaurar Banco de Dados"
            className="p-2.5 bg-black/40 hover:bg-white/20 hover:text-white border border-white/10 text-slate-300 rounded-xl cursor-pointer transition-all flex items-center justify-center"
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
                O PROMUSE é distribuído como aplicativo instalável no celular das mulheres sob medida protetiva. Selecione a assistida abaixo para simular o telefone dela:
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
                npx cap init PROMUSE com.promuse.app<br/>
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
      {activeRole === 'police' && !isVictimModalOpen && !isOccurrenceModalOpen && policeView === 'dashboard' && (
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
            <div 
              onClick={() => setPoliceView('victims')}
              className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between shadow-md cursor-pointer hover:bg-slate-900 transition-colors"
            >
              <div className="text-slate-300">
                <span className="text-[10px] uppercase font-black opacity-80 tracking-widest block">ASSISTIDAS MONITORADAS (PROMUSE)</span>
                <span className="text-3xl font-black block mt-1 tracking-tight text-slate-100">{db.victims.length}</span>
                <span className="text-[10px] block text-emerald-400 font-medium">{db.victims.filter(v => v.riskLevel === 'Alto').length} de Alto Risco</span>
              </div>
              <div className="w-12 h-12 rounded-full bg-slate-900 text-emerald-400 flex items-center justify-center shrink-0">
                <UsersRound className="w-6 h-6" />
              </div>
            </div>

            {/* General Patrol Actions Tracked */}
            <div 
              onClick={() => { setIsVictimModalOpen(false); setIsOccurrenceModalOpen(true); }}
              className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between shadow-md cursor-pointer hover:bg-slate-900 transition-colors"
              title="Clique para acessar Ficha e Registrar Evoluções"
            >
              <div className="text-slate-300">
                <span className="text-[10px] uppercase font-black opacity-80 tracking-widest block">OCORRÊNCIAS & RONDAS LOGADAS</span>
                <span className="text-3xl font-black block mt-1 tracking-tight text-slate-100">{db.occurrences.length}</span>
                <span className="text-[10px] block text-blue-400 font-medium">{db.occurrences.length} registro{db.occurrences.length !== 1 ? 's' : ''} de evolução gravado{db.occurrences.length !== 1 ? 's' : ''}</span>
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
                <div className="bg-slate-900/40 px-5 py-4 border-b border-slate-850 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></div>
                    <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                      <MapIcon className="w-4 h-4 text-emerald-400" />
                      Mapeamento em Tempo Real - {adminUnit}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3">

                    <span className="text-xs text-slate-400 font-mono hidden sm:inline">Total de acionamentos: {db.panicAlerts.length}</span>
                  </div>
                </div>

                {/* Collapsible API Troubleshooting Panel */}
                {showMapsTroubleshooter && (
                  <div className="bg-amber-950/90 border-b border-amber-900/50 p-5 text-slate-250 z-20 relative">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black uppercase text-amber-300 tracking-widest flex items-center gap-1.5">
                            Guia de Resolução: Erro do Google Maps API
                          </h4>
                          <button 
                            onClick={() => setShowMapsTroubleshooter(false)}
                            className="text-amber-400 hover:text-amber-200 font-black text-[10px] uppercase bg-slate-950/60 px-2 py-0.5 rounded border border-amber-900/30"
                          >
                            Fechar ×
                          </button>
                        </div>
                        <p className="text-xs text-amber-200/90 leading-relaxed">
                          Se o mapa ou o campo de endereço de novas assistidas mostrar a mensagem <strong className="text-white">"Esta página não carregou o Google Maps corretamente"</strong>, isso significa que a chave de API ativa precisa ser configurada com as permissões corretas no console do Google Cloud.
                        </p>
                        <div className="bg-slate-950/90 p-4 rounded-xl border border-amber-900/40 text-xs space-y-2.5">
                          <p className="font-bold text-amber-300">Siga estes 4 passos simples para ativar o serviço:</p>
                          <ol className="list-decimal pl-4 space-y-1.5 text-slate-300">
                            <li>
                              Acesse o seu <a href="https://console.cloud.google.com/" target="_blank" rel="norereferrer" className="text-blue-400 underline hover:text-blue-300 font-bold inline-flex items-center gap-0.5">Google Cloud Console <ExternalLink className="w-3 h-3 inline" /></a> e selecione seu projeto.
                            </li>
                            <li>
                              No menu lateral, vá em <strong className="text-white">APIs e Serviços &gt; Biblioteca</strong> e certifique-se de que ambas as APIs abaixo estejam <span className="text-emerald-400 font-bold">ATIVADAS</span>:
                              <ul className="list-disc pl-5 mt-1 space-y-1 text-amber-200/80">
                                <li><strong className="text-white">Maps JavaScript API</strong> (responsável por renderizar o mapa visual)</li>
                                <li><strong className="text-white">Places API (New)</strong> ou <strong className="text-white">Places API</strong> (responsável pelo autocompletar e busca de endereços)</li>
                              </ul>
                            </li>
                            <li>
                              Acesse <strong className="text-white">APIs e Serviços &gt; Credenciais</strong> e pegue sua <strong className="text-white">Chave de API (API Key)</strong>. Verifique se a chave não possui restrições de API que impeçam o uso do Maps/Places.
                            </li>
                            <li>
                              No AI Studio, clique nas <strong className="text-white">Settings</strong> (ícone de engrenagem ⚙️ no canto superior direito) &gt; aba <strong className="text-white">Secrets</strong>. Adicione ou atualize a chave <code className="bg-slate-900 text-emerald-400 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold">GOOGLE_MAPS_PLATFORM_KEY</code> com sua chave copiada e aperte Enter. O aplicativo recompilará em segundos com a nova chave!
                            </li>
                          </ol>
                        </div>
                        <p className="text-[10px] text-amber-400/80 font-mono italic">
                          * Nota de Segurança: O sistema tentou carregar a chave de API nativa do Firebase como fallback, mas chaves geradas automaticamente pelo Firebase costumam possuir restrições severas de API que bloqueiam serviços de mapas por segurança.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Map Interface Body */}
                <div className="relative h-[340px] bg-slate-900 flex items-center justify-center overflow-hidden">
                  
                  {/* Visual Blueprint Grid of Coxim-MS Map */}
                  <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1.2px,transparent_1.2px)] [background-size:16px_16px] opacity-40"></div>
                  
                  <GoogleMap
                    key={adminUnit}
                    defaultZoom={13}
                    defaultCenter={getMapCenter(adminUnit)}
                    mapId="promuse-map-id"
                    disableDefaultUI={true}
                    gestureHandling="greedy"
                    className="absolute inset-0 w-full h-full"
                    internalUsageAttributionIds="gmp_mcp_codeassist_v1_aistudio"
                  >
                    {/* Active/Resolved Panic Alerts */}
                    {db.panicAlerts.map((alert) => {
                      const isSelected = selectedMapAlert?.id === alert.id;
                      const isActive = alert.status === 'Ativo';
                      
                      return (
                        <SafeAdvancedMarker
                          key={alert.id}
                          position={{ lat: alert.location.latitude, lng: alert.location.longitude }}
                          onClick={() => {
                            setSelectedMapAlert(alert);
                            setSelectedMapVictim(null);
                          }}
                        >
                          <Pin
                            background={isActive ? '#ef4444' : '#10b981'}
                            borderColor={isActive ? '#991b1b' : '#047857'}
                            glyphColor="#fff"
                            scale={isSelected ? 1.2 : 1}
                          />
                          {isActive && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-red-500 rounded-full animate-ping opacity-50 -z-10"></div>
                          )}
                        </SafeAdvancedMarker>
                      );
                    })}

                    {/* Georeferenced Victims */}
                    {db.victims.filter(v => v.coordinates).map((victim) => {
                      const isSelected = selectedMapVictim?.id === victim.id;
                      
                      return (
                        <SafeAdvancedMarker
                          key={'vic_marker_' + victim.id}
                          position={{ lat: victim.coordinates!.latitude, lng: victim.coordinates!.longitude }}
                          onClick={() => {
                            setSelectedMapVictim(victim);
                            setSelectedMapAlert(null);
                          }}
                        >
                          <Pin
                            background="#3b82f6"
                            borderColor="#1d4ed8"
                            glyphColor="#fff"
                            scale={isSelected ? 1.25 : 1.05}
                          />
                        </SafeAdvancedMarker>
                      );
                    })}
                  </GoogleMap>

                  {/* Empty Map State Indicator */}
                  {db.panicAlerts.length === 0 && db.victims.filter(v => v.coordinates).length === 0 && (
                    <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center p-6 text-center z-10">
                      <Compass className="w-12 h-12 text-slate-700 animate-spin mb-3" />
                      <p className="text-sm font-bold text-slate-400">Nenhum botão de pânico ou residência georreferenciada cadastrada no mapa.</p>
                      <p className="text-xs text-slate-600 max-w-xs mt-1">O mapa exibirá pings azuis para as residências das assistidas e vermelhos/verdes para acionamentos do botão de pânico.</p>
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
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                      <span className="text-slate-400">Residência de Assistida (Georreferenciada)</span>
                    </div>
                  </div>
                </div>

                {/* Selected Marker Control / Action Panel (Panic Alert) */}
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
                        <span className="text-xs text-slate-400 font-medium">Acionado às: {safeFormatTime(selectedMapAlert.requestTime)}</span>
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

                {/* Selected Marker Control / Action Panel (Registered Victim Residence) */}
                {selectedMapVictim && (
                  <div className="p-5 bg-slate-900 border-t border-slate-850">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                            selectedMapVictim.riskLevel === 'Alto' 
                              ? 'bg-rose-950 text-rose-400 border border-rose-800/50' 
                              : selectedMapVictim.riskLevel === 'Médio'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800/50'
                              : 'bg-blue-950 text-blue-400 border border-blue-800/50'
                          }`}>
                            Risco: {selectedMapVictim.riskLevel}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">ID Assistida: {selectedMapVictim.id}</span>
                        </div>
                        <h4 className="text-lg font-black text-blue-300 flex items-center gap-2">
                          {selectedMapVictim.name}
                          <span className="text-xs font-normal text-slate-400 font-mono">({selectedMapVictim.phone || 'Sem telefone'})</span>
                        </h4>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
                          <span>Residência: <strong className="text-slate-100">{selectedMapVictim.address}</strong></span>
                        </p>
                        {selectedMapVictim.protectiveOrder && (
                          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-850 mt-2 text-xs text-slate-300">
                            <p className="font-bold text-slate-200">Processo MPU: <span className="font-mono text-blue-400">{selectedMapVictim.protectiveOrder.orderNumber}</span></p>
                            <p className="mt-1 leading-relaxed"><strong className="text-slate-400">Restrições:</strong> {selectedMapVictim.protectiveOrder.restrictions}</p>
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 flex flex-col items-start md:items-end gap-1.5 text-xs text-slate-400">
                        <span className="bg-slate-950 px-2 py-1 rounded font-bold text-slate-300">Responsável: {selectedMapVictim.policeOfficerInCharge || 'Não definido'}</span>
                        <span className="bg-slate-950 px-2 py-1 rounded font-bold text-slate-300">VTR Ronda: {selectedMapVictim.assignedPatrol || 'Não definido'}</span>
                        <div className="flex gap-1.5 mt-2 w-full">
                          <button
                            onClick={() => {
                              setSelectedSimulatedVictimId(selectedMapVictim.id);
                              setActiveRole('victim');
                              setShowFlashNotification(`Simulador APK ativado para ${selectedMapVictim.name}.`);
                            }}
                            className="flex-1 text-center bg-blue-650 hover:bg-blue-600 text-white font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase transition-colors"
                          >
                            Simular Disparo de Pânico
                          </button>
                          <button
                            onClick={() => setSelectedMapVictim(null)}
                            className="bg-slate-950 hover:bg-slate-850 text-slate-400 font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase transition-colors border border-slate-800"
                          >
                            Fechar
                          </button>
                        </div>
                      </div>
                    </div>
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
                          <span className="text-slate-500 font-mono">{adminUnit} Network</span>
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

          {/* 📃 MIDDLE BANNER: AÇÕES DE REGISTRO E CONTROLE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CADASTRAR MEDIDA PROTETIVA */}
            <button
              id="btn_new_victim"
              onClick={() => { resetVictimForm(); setIsVictimModalOpen(true); setIsOccurrenceModalOpen(false); }}
              className="bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-800/50 p-6 rounded-3xl shadow-xl flex flex-col items-center justify-center text-center transition-all cursor-pointer group"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-950/80 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <PlusCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-slate-100 uppercase tracking-widest mb-2">
                Cadastrar Medida Protetiva
              </h3>
              <p className="text-sm text-slate-400">
                Inserir nova assistida, definir nível de risco e vincular dados processuais.
              </p>
            </button>

            {/* FICHA INDIVIDUAL */}
            <button
              onClick={() => { setIsVictimModalOpen(false); setIsOccurrenceModalOpen(true); }}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 p-6 rounded-3xl shadow-xl flex flex-col items-center justify-center text-center transition-all cursor-pointer group"
            >
              <div className="w-16 h-16 rounded-full bg-slate-950 text-slate-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FileText className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-xl font-black text-slate-100 uppercase tracking-widest mb-2">
                Ficha Individual
              </h3>
              <p className="text-sm text-slate-400">
                Registrar visita preventiva, ocorrência de descumprimento ou emitir relatório PROMUSE.
              </p>
            </button>
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
                onClick={() => { setIsVictimModalOpen(false); setIsOccurrenceModalOpen(true); }}
                className="text-[10px] bg-slate-900 hover:bg-slate-800 text-white font-bold tracking-wider uppercase px-2.5 py-1 rounded-md cursor-pointer border border-slate-800"
              >
                FICHA INDIVIDUAL
              </button>
            </div>

            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
              {db.occurrences.map((o) => (
                <div key={o.id} className="bg-slate-900 border border-slate-850 p-3 rounded-xl space-y-1.5 text-xs text-slate-350">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-extrabold text-slate-200 underline">{o.victimName}</span>
                    <div className="flex gap-2">
                      {o.cadgProtocol && <span className="font-mono text-emerald-400 font-bold">CADG: {o.cadgProtocol}</span>}
                      <span className="text-slate-500">{safeFormatDate(o.date)}</span>
                    </div>
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

      {/* 👮 ROLE 2: MILITARY COMMAND / VICTIMS LIST */}
      {activeRole === 'police' && !isVictimModalOpen && !isOccurrenceModalOpen && policeView === 'victims' && (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-black text-slate-100 uppercase tracking-widest flex items-center gap-3">
              <UsersRound className="w-6 h-6 text-emerald-400" />
              ASSISTIDAS MONITORADAS
            </h2>
            <button
              onClick={() => setPoliceView('dashboard')}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 text-xs font-bold rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              Voltar ao Dashboard
            </button>
          </div>

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
                  id="btn_new_victim_list"
                  onClick={() => { resetVictimForm(); setIsVictimModalOpen(true); setIsOccurrenceModalOpen(false); }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  Cadastrar Assistida e Medida
                </button>
                <button
                  onClick={() => { setIsVictimModalOpen(false); setIsOccurrenceModalOpen(true); }}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-emerald-400" />
                  FICHA INDIVIDUAL
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
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-slate-400 text-xs font-bold">Mês de Expedição:</span>
                <select
                  value={issueMonthFilter}
                  onChange={(e) => setIssueMonthFilter(e.target.value)}
                  className="bg-slate-950 text-slate-200 text-xs py-1.5 px-3 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500 font-bold cursor-pointer"
                >
                  <option value="Todos">Todos os Meses ({availableIssueMonths.length})</option>
                  {availableIssueMonths.map((m) => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </select>
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
                    <th className="px-5 py-3">Sentença Protetiva</th>
                    <th className="px-5 py-3 text-right">Ações de Gestão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {filteredVictims.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {v.protectiveOrder?.expiryDate && (() => {
                            try {
                              const expiryStr = v.protectiveOrder.expiryDate.split('T')[0];
                              const expiry = new Date(expiryStr + 'T12:00:00');
                              if (isNaN(expiry.getTime())) return null;
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                              if (diffDays < 16) {
                                return (
                                  <AlertTriangle 
                                    className="w-4 h-4 text-rose-500 shrink-0 animate-pulse" 
                                    title={`Atenção: Medida protetiva expira em ${diffDays} dias! (Menos de 16 dias)`} 
                                  />
                                );
                              }
                            } catch (e) {
                              return null;
                            }
                            return null;
                          })()}
                          <span className="font-extrabold text-slate-100 text-sm block">{v.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                          <span>CPF: {v.cpf}</span>
                          <span>•</span>
                          <span>Cadastrada em {safeFormatDate(v.createdAt)}</span>
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
                      <td className="px-5 py-4 max-w-[220px]">
                        {v.protectiveOrder ? (
                          <div>
                            <span className="font-bold text-slate-300 block font-mono text-[10.5px] truncate" title={v.protectiveOrder.orderNumber}>
                              Proc: {v.protectiveOrder.orderNumber}
                            </span>
                            {v.protectiveOrder.defendantName && (
                              <span className="text-[10px] text-amber-300 block mt-0.5 truncate" title={v.protectiveOrder.defendantName}>Réu: {v.protectiveOrder.defendantName}</span>
                            )}
                            {v.protectiveOrder.issueDate && (
                              <span className="text-[10px] text-sky-300 block mt-0.5">
                                Expedição: {safeFormatDate(v.protectiveOrder.issueDate)}
                              </span>
                            )}
                            <span className="text-[10px] text-rose-300 block mt-0.5">Expira: {safeFormatDate(v.protectiveOrder.expiryDate)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">Nenhuma medida cadastrada</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 px-1">
                          <button
                            onClick={() => {
                              setNewOccurrenceForm(prev => ({ ...prev, victimId: v.id }));
                              setIsVictimModalOpen(false);
                              setIsOccurrenceModalOpen(true);
                            }}
                            className="px-2 py-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-900/35 hover:text-white text-emerald-400 font-bold tracking-wider uppercase text-[9px] rounded-lg cursor-pointer flex items-center gap-1"
                            title="Ficha Individual"
                          >
                            <FileText className="w-3 h-3" />
                            FICHA INDIVIDUAL
                          </button>
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
                      <td colSpan={5} className="px-5 py-10 text-center text-slate-550 italic text-sm">
                        Nenhuma assistida encontrada com os termos ou filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </main>
      )}

      {/* 🔮 VICTIM INCLUSION MODAL (NOW PAGE) */}
      {isVictimModalOpen && (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
          
          {/* Breadcrumb Navigation & Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                <span className="hover:text-slate-350 cursor-pointer" onClick={() => { setIsVictimModalOpen(false); setPoliceView('dashboard'); }}>Início</span>
                <span>/</span>
                <span className="hover:text-slate-350 cursor-pointer" onClick={() => { setIsVictimModalOpen(false); setPoliceView('victims'); }}>Assistidas</span>
                <span>/</span>
                <span className="text-slate-400">{editingVictim ? 'Editar Cadastro' : 'Novo Cadastro'}</span>
              </div>
              <h2 className="text-xl font-black text-slate-100 uppercase tracking-wider flex items-center gap-2 mt-1">
                <Shield className="w-5.5 h-5.5 text-emerald-400" />
                {editingVictim ? 'Editar Cadastro da Assistida' : 'Cadastrar Nova Assistida PROMUSE'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">Informe os dados cadastrais da vítima e os termos da Medida Protetiva de Urgência decretados pelo Fórum da Comarca.</p>
            </div>

            <button
              onClick={() => { setIsVictimModalOpen(false); setPoliceView('dashboard'); }}
              className="px-4 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Painel
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Form (Takes 2/3 width on wide screens) */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl">
                <form onSubmit={handleSaveVictim} className="space-y-6">
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="col-span-1 sm:col-span-2">
                      <label className="block text-[10px] text-slate-500 font-extrabold uppercase tracking-widest mb-1.5">Nome Completo da Assistida</label>
                      <input
                        type="text"
                        required
                        value={newVictimForm.name}
                        onChange={(e) => setNewVictimForm({...newVictimForm, name: e.target.value})}
                        placeholder="Nome completo sem abreviações"
                        className="w-full bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-slate-100 font-extrabold focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 font-extrabold uppercase tracking-widest mb-1.5">CPF (Opcional)</label>
                      <input
                        type="text"
                        value={newVictimForm.cpf}
                        onChange={(e) => setNewVictimForm({...newVictimForm, cpf: e.target.value})}
                        placeholder="000.000.000-00"
                        className="w-full bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-slate-100 font-extrabold focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 font-extrabold uppercase tracking-widest mb-1.5">Celular (WhatsApp) (Opcional)</label>
                      <input
                        type="text"
                        value={newVictimForm.phone}
                        onChange={(e) => setNewVictimForm({...newVictimForm, phone: e.target.value})}
                        placeholder="(67) 99000-1234"
                        className="w-full bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-slate-100 font-extrabold focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="col-span-1 sm:col-span-2">
                      <label className="block text-[10px] text-slate-500 font-extrabold uppercase tracking-widest mb-1.5">Endereço de Residência (Opcional)</label>
                      <AddressInput
                        value={newVictimForm.address}
                        onChange={(val) => setNewVictimForm({...newVictimForm, address: val})}
                        coordinates={newVictimForm.coordinates}
                        onCoordinatesChange={(coords) => setNewVictimForm(prev => ({ ...prev, coordinates: coords }))}
                        className="w-full bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-slate-100 font-extrabold focus:outline-none focus:border-emerald-500"
                      />
                      {newVictimForm.coordinates && (
                        <span className="text-[10px] text-emerald-400 font-mono mt-2 block">
                          ✓ Coordenadas capturadas: {newVictimForm.coordinates.latitude.toFixed(5)}, {newVictimForm.coordinates.longitude.toFixed(5)}
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 font-extrabold uppercase tracking-widest mb-1.5">Grau de Risco Operacional</label>
                      <select
                        value={newVictimForm.riskLevel}
                        onChange={(e) => setNewVictimForm({...newVictimForm, riskLevel: e.target.value as any})}
                        className="w-full bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-slate-100 font-extrabold"
                      >
                        <option value="Baixo" className="bg-slate-900 text-white">Baixo Risco</option>
                        <option value="Médio" className="bg-slate-900 text-white">Médio Risco</option>
                        <option value="Alto" className="bg-slate-900 text-white">ALTO RISCO (Patrulhamento frequente)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 font-extrabold uppercase tracking-widest mb-1.5">Viatura da Rota Escala</label>
                      <input
                        type="text"
                        required
                        value={newVictimForm.assignedPatrol}
                        onChange={(e) => setNewVictimForm({...newVictimForm, assignedPatrol: e.target.value})}
                        placeholder="VTR PROMUSE 5040"
                        className="w-full bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-slate-100 font-extrabold focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 font-extrabold uppercase tracking-widest mb-1.5">
                        Policial PM Responsável (Administrador)
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={newVictimForm.policeOfficerInCharge}
                          onChange={(e) => {
                            setNewVictimForm({ ...newVictimForm, policeOfficerInCharge: e.target.value });
                            setIsOfficerSuggestionsOpen(true);
                          }}
                          onFocus={() => setIsOfficerSuggestionsOpen(true)}
                          onBlur={() => setTimeout(() => setIsOfficerSuggestionsOpen(false), 200)}
                          placeholder="Digite o nome para buscar administrador..."
                          className="w-full bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-slate-100 font-extrabold focus:outline-none focus:border-emerald-500 text-xs"
                        />
                        {isOfficerSuggestionsOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 max-h-52 overflow-y-auto divide-y divide-slate-800/80">
                            {(() => {
                              const searchVal = (newVictimForm.policeOfficerInCharge || '').toLowerCase().trim();
                              const filtered = adminOfficerNames.filter(name =>
                                name.toLowerCase().includes(searchVal)
                              );
                              if (filtered.length === 0) {
                                return (
                                  <div className="px-3 py-2.5 text-xs text-slate-400 italic">
                                    Nenhum administrador encontrado com "{newVictimForm.policeOfficerInCharge}"
                                  </div>
                                );
                              }
                              return filtered.map((officer) => (
                                <button
                                  key={officer}
                                  type="button"
                                  onMouseDown={() => {
                                    setNewVictimForm({ ...newVictimForm, policeOfficerInCharge: officer });
                                    setIsOfficerSuggestionsOpen(false);
                                  }}
                                  className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer transition-colors flex items-center justify-between font-bold"
                                >
                                  <span className="flex items-center gap-2">
                                    <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    {officer}
                                  </span>
                                  <span className="text-[9px] uppercase tracking-wider font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-1.5 py-0.5 rounded">
                                    Admin
                                  </span>
                                </button>
                              ));
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Legal Protection Order Info fields inside the form */}
                  <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4 text-xs">
                    <h4 className="text-[11px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-800 pb-2">
                      <FileText className="w-4.5 h-4.5" /> SENTENÇA JURÍDICA E RESTRIÇÕES PROTETIVAS
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9.5px] text-slate-500 font-extrabold uppercase tracking-widest mb-1.5">Número Processual</label>
                        <input
                          type="text"
                          required
                          value={newVictimForm.orderNumber}
                          onChange={(e) => setNewVictimForm({...newVictimForm, orderNumber: e.target.value})}
                          placeholder="0001000-00.2026.8.12.0011"
                          className="w-full bg-slate-900 p-2.5 rounded border border-slate-800 text-slate-100 font-extrabold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="col-span-1 sm:col-span-2">
                        <label className="block text-[9.5px] text-slate-500 font-extrabold uppercase tracking-widest mb-1.5">Nome do Réu / Agressor</label>
                        <input
                          type="text"
                          required
                          value={newVictimForm.defendantName}
                          onChange={(e) => setNewVictimForm({...newVictimForm, defendantName: e.target.value})}
                          placeholder="Nome completo do réu"
                          className="w-full bg-slate-900 p-2.5 rounded border border-slate-800 text-slate-100 font-extrabold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="col-span-1 sm:col-span-2">
                        <label className="block text-[9.5px] text-slate-500 font-extrabold uppercase tracking-widest mb-1.5">Foto do Agressor (Opcional)</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setNewVictimForm({...newVictimForm, aggressorPhotoUrl: reader.result as string});
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="w-full text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-800 file:text-emerald-450 hover:file:bg-slate-700 bg-slate-900 rounded border border-slate-800 font-bold"
                        />
                        {newVictimForm.aggressorPhotoUrl && (
                          <div className="mt-3 h-32 w-32 rounded bg-slate-800 overflow-hidden border border-slate-700 relative group">
                            <img 
                              src={newVictimForm.aggressorPhotoUrl} 
                              alt="Preview da foto do agressor" 
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => setNewVictimForm({...newVictimForm, aggressorPhotoUrl: ''})}
                              className="absolute inset-0 bg-red-900/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                              <Trash2 className="w-6 h-6 text-white" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="col-span-1 sm:col-span-2">
                        <label className="block text-[9.5px] text-slate-500 font-extrabold uppercase tracking-widest mb-1.5">Magistrado(a) Emitente</label>
                        <input
                          type="text"
                          required
                          value={newVictimForm.judgeName}
                          onChange={(e) => setNewVictimForm({...newVictimForm, judgeName: e.target.value})}
                          placeholder="Dr. Cláudio Müller Pareja"
                          className="w-full bg-slate-900 p-2.5 rounded border border-slate-800 text-slate-100 font-extrabold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[9.5px] text-slate-500 font-extrabold uppercase tracking-widest mb-1.5">Data de Expedição</label>
                        <input
                          type="date"
                          required
                          value={newVictimForm.issueDate}
                          onChange={(e) => setNewVictimForm({...newVictimForm, issueDate: e.target.value})}
                          className="w-full bg-slate-900 p-2.5 rounded border border-slate-800 text-slate-100 font-extrabold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[9.5px] text-slate-500 font-extrabold uppercase tracking-widest mb-1.5">Prazo de Expiração</label>
                        <input
                          type="date"
                          required
                          value={newVictimForm.expiryDate}
                          onChange={(e) => setNewVictimForm({...newVictimForm, expiryDate: e.target.value})}
                          className="w-full bg-slate-900 p-2.5 rounded border border-slate-800 text-slate-100 font-extrabold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="col-span-1 sm:col-span-2">
                        <label className="block text-[9.5px] text-slate-500 font-extrabold uppercase tracking-widest mb-1.5">Restrições Impostas ao Réu</label>
                        <textarea
                          required
                          value={newVictimForm.restrictions}
                          onChange={(e) => setNewVictimForm({...newVictimForm, restrictions: e.target.value})}
                          placeholder="Proibição de contato, distância física mínima, etc."
                          rows={2}
                          className="w-full bg-slate-900 p-2.5 rounded border border-slate-800 text-slate-100 font-extrabold focus:outline-none focus:border-emerald-500 resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 text-xs border-t border-slate-800 pt-4">
                    <button
                      type="button"
                      onClick={() => { setIsVictimModalOpen(false); setPoliceView('dashboard'); }}
                      className="px-5 py-2.5 bg-slate-850 border border-slate-800 text-slate-400 rounded-lg cursor-pointer hover:bg-slate-800"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer transition-colors"
                    >
                      {editingVictim ? 'Salvar Alterações' : 'Confirmar e Registrar Assistida'}
                    </button>
                  </div>

                </form>
              </div>
            </div>

            {/* Right Column: PDF Smart Upload & Assistance Rules (Takes 1/3 width) */}
            <div className="space-y-6">
              {!editingVictim && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
                  <div className="border-b border-slate-800 pb-3">
                    <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                      <FileCheck2 className="w-5 h-5 text-emerald-400" />
                      Leitor Inteligente
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1">Carregue o PDF da Medida Protetiva. Nossa IA lerá os dados e preencherá o formulário para você automaticamente.</p>
                  </div>

                  <div className="relative w-full">
                    <input 
                      type="file" 
                      accept="application/pdf" 
                      onChange={handlePdfUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={isParsingPdf}
                    />
                    <button 
                      type="button" 
                      disabled={isParsingPdf} 
                      className={`w-full px-4 py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 border ${
                        isParsingPdf 
                          ? 'bg-slate-800 border-slate-700 text-slate-500' 
                          : 'bg-emerald-950/40 border-emerald-800/80 hover:bg-emerald-900/40 text-emerald-400 hover:text-emerald-300 transition-colors'
                      }`}
                    >
                      {isParsingPdf ? (
                        <>
                          <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                          LENDO PDF...
                        </>
                      ) : (
                        <>
                          <FileText className="w-4.5 h-4.5 text-emerald-500" />
                          ANEXAR PDF MPU
                        </>
                      )}
                    </button>
                  </div>

                  {pdfParseStatus && (
                    <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
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
                </div>
              )}

              {/* Operational / Support Guidelines Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
                <div className="border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                    <Shield className="w-5 h-5 text-amber-500" />
                    Diretrizes PROMUSE
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">Orientações operacionais para o acompanhamento de mulheres assistidas sob medida protetiva.</p>
                </div>

                <ul className="space-y-3 text-[11px] text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
                    <span><strong>Frequência de Visitas:</strong> Assistidas classificadas como <strong>Alto Risco</strong> devem receber patrulhamento diário.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
                    <span><strong>Atualização Cadastral:</strong> Certifique-se de que os dados de geolocalização e telefone estão atualizados no sistema.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
                    <span><strong>Termos da Medida:</strong> O descumprimento de qualquer termo judicial da MPU pelo agressor autoriza a prisão em flagrante.</span>
                  </li>
                </ul>
              </div>

            </div>

          </div>
        </main>
      )}



      {/* 📃 OCCURRENCE LOG PAGE (FORMERLY MODAL) */}
      {isOccurrenceModalOpen && (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
          
          {/* Breadcrumb Navigation & Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                <span className="hover:text-slate-350 cursor-pointer" onClick={() => { setIsOccurrenceModalOpen(false); setPoliceView('dashboard'); }}>Início</span>
                <span>/</span>
                <span className="hover:text-slate-350 cursor-pointer" onClick={() => { setIsOccurrenceModalOpen(false); setPoliceView('victims'); }}>Assistadas</span>
                <span>/</span>
                <span className="text-slate-400">Ficha Individual de Atendimento</span>
              </div>
              <h2 className="text-xl font-black text-slate-100 uppercase tracking-wider flex items-center gap-2 mt-1">
                <FileText className="w-5.5 h-5.5 text-emerald-400" />
                FICHA INDIVIDUAL DE ATENDIMENTO
              </h2>
              <p className="text-xs text-slate-400 mt-1">Preencha os dados da evolução e acompanhamento da assistida para alimentar o relatório do 5º BPM.</p>
            </div>

            <button
              onClick={() => { setIsOccurrenceModalOpen(false); setPoliceView('dashboard'); }}
              className="px-4 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Painel
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Form (Takes 2/3 width) */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl">
                <form onSubmit={handleSaveOccurrence} className="space-y-6">
                  
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">Assistida Relacionada</label>
                      {newOccurrenceForm.victimId && (() => {
                        const vic = db.victims.find(v => v.id === newOccurrenceForm.victimId);
                        if (!vic) return null;
                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              handleOpenRevocationModal(vic);
                            }}
                            className="px-3 py-1 bg-rose-950/90 hover:bg-rose-900 border border-rose-800/80 text-rose-200 font-black text-xs rounded-xl cursor-pointer flex items-center gap-1.5 transition-all shadow-sm uppercase tracking-wider"
                            title="Registrar Revogação da Medida Protetiva"
                          >
                            <FileX className="w-3.5 h-3.5 text-rose-400" />
                            REVOGAÇÃO
                          </button>
                        );
                      })()}
                    </div>
                    <select
                      required
                      value={newOccurrenceForm.victimId}
                      onChange={(e) => setNewOccurrenceForm({...newOccurrenceForm, victimId: e.target.value})}
                      className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 text-slate-100 font-extrabold focus:outline-none focus:border-emerald-500 text-xs"
                    >
                      <option value="" className="bg-white text-slate-100 font-extrabold">-- Selecionar Assistida --</option>
                      {db.victims.map(v => (
                        <option key={v.id} value={v.id} className="bg-white text-slate-100 font-extrabold">{v.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-4 border-t border-slate-800/85">
                    <h4 className="text-xs font-black text-slate-150 uppercase mb-4 flex items-center gap-2 tracking-wider">
                      <Activity className="w-4.5 h-4.5 text-blue-400" /> EVOLUÇÃO E ATENDIMENTO
                    </h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block text-[10px] text-slate-500 font-extrabold uppercase tracking-widest mb-1.5">Data do Atendimento</label>
                        <input
                          type="date"
                          required
                          value={newOccurrenceForm.date}
                          onChange={(e) => setNewOccurrenceForm({...newOccurrenceForm, date: e.target.value})}
                          className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 text-slate-100 font-extrabold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 font-extrabold uppercase tracking-widest mb-1.5">Protocolo CADG (Opcional)</label>
                        <input
                          type="text"
                          value={newOccurrenceForm.cadgProtocol}
                          onChange={(e) => setNewOccurrenceForm({...newOccurrenceForm, cadgProtocol: e.target.value})}
                          placeholder="Ex: 5833446"
                          className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 text-slate-100 font-extrabold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="mt-4 text-xs">
                      <label className="block text-[10px] text-slate-500 font-extrabold uppercase tracking-widest mb-1.5">Histórico Detalhado da Evolução</label>
                      <textarea
                        required
                        value={newOccurrenceForm.description}
                        onChange={(e) => setNewOccurrenceForm({...newOccurrenceForm, description: e.target.value})}
                        placeholder="Descreva o andamento do atendimento, ex: Realizada visita de retorno à residência da assistida. Ela declarou sentir-se segura com as patrulhas e informou que o réu não tem frequentado as imediações..."
                        rows={6}
                        className="w-full bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-slate-100 font-extrabold focus:outline-none focus:border-emerald-500 resize-none font-sans text-xs leading-relaxed"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                    <div className="flex items-center gap-2">
                      {newOccurrenceForm.victimId && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              if (printRef.current) {
                                handlePrint();
                              } else {
                                console.error("printRef is not available");
                              }
                            }}
                            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-100 font-bold rounded-lg cursor-pointer flex items-center gap-2 transition-all border border-slate-700 text-xs shadow-sm hover:text-white"
                          >
                            <Printer className="w-4 h-4 text-sky-400" />
                            Gerar & Imprimir Ficha Completa
                          </button>
                          {(() => {
                            const vic = db.victims.find(v => v.id === newOccurrenceForm.victimId);
                            if (!vic) return null;
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleOpenRevocationModal(vic);
                                }}
                                className="px-4 py-2.5 bg-rose-950/80 hover:bg-rose-900 text-rose-200 font-extrabold text-xs rounded-lg cursor-pointer flex items-center gap-2 transition-all border border-rose-800/80 shadow-sm"
                                title="Registrar Revogação da Medida Protetiva"
                              >
                                <FileX className="w-4 h-4 text-rose-400" />
                                REVOGAÇÃO
                              </button>
                            );
                          })()}
                        </>
                      )}
                    </div>
                    <div className="flex justify-end gap-3 text-xs">
                      <button
                        type="button"
                        onClick={() => { setIsOccurrenceModalOpen(false); setPoliceView('dashboard'); }}
                        className="px-5 py-2.5 bg-slate-850 border border-slate-800 text-slate-400 rounded-lg cursor-pointer hover:bg-slate-800"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer transition-colors"
                      >
                        Salvar Evolução
                      </button>
                    </div>
                  </div>

                  {/* Hidden Print Component */}
                  <div style={{ position: 'absolute', top: '-10000px', left: '-10000px' }}>
                    {newOccurrenceForm.victimId && (() => {
                      const vic = db.victims.find(v => v.id === newOccurrenceForm.victimId);
                      if (!vic) return null;
                      const occs = db.occurrences.filter(o => o.victimId === newOccurrenceForm.victimId);
                      return <PrintableFicha ref={printRef} victim={vic} occurrences={occs} />;
                    })()}
                  </div>
                </form>
              </div>
            </div>

            {/* Right Column: Informações da Assistida Selecionada e Histórico (Takes 1/3 width) */}
            <div className="space-y-6">
              
              {/* Box 1: Dados da Medida Protetiva da Assistida */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
                <div className="border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                    <Shield className="w-5 h-5 text-emerald-400" />
                    Dados de Resguardo
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">Informações processuais e de segurança da assistida ativa no formulário.</p>
                </div>

                {newOccurrenceForm.victimId ? (() => {
                  const v = db.victims.find(vic => vic.id === newOccurrenceForm.victimId);
                  if (!v) return null;
                  return (
                    <div className="space-y-3.5 text-xs">
                      <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 space-y-2 text-[11px] text-slate-300 font-mono">
                        <div className="flex justify-between border-b border-slate-850 pb-1">
                          <span className="text-slate-500 font-bold">PROCESSO:</span> 
                          <span className="text-slate-200">{v.protectiveOrder?.orderNumber || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-850 pb-1">
                          <span className="text-slate-500 font-bold">VÍTIMA:</span> 
                          <span className="text-slate-200 font-sans font-bold">{v.name}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-850 pb-1">
                          <span className="text-slate-500 font-bold">TELEFONE:</span> 
                          <span className="text-slate-200">{v.phone || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-850 pb-1">
                          <span className="text-slate-500 font-bold">RESTRITO:</span> 
                          <span className="text-rose-400">{v.protectiveOrder?.distanceLimit || '100 metros'}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-850 pb-1">
                          <span className="text-slate-500 font-bold">AGRESSOR:</span> 
                          <span className="text-amber-400 font-sans">{v.protectiveOrder?.defendantName || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-850 pb-1">
                          <span className="text-slate-500 font-bold">EXPIRAÇÃO:</span> 
                          <span className="text-rose-300">{safeFormatDate(v.protectiveOrder?.expiryDate)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-slate-500 font-bold">SITUAÇÃO MPU:</span> 
                          {v.protectiveOrder?.status === 'Revogada' ? (
                            <span className="text-rose-400 font-sans font-black bg-rose-950/80 border border-rose-800/80 px-2 py-0.5 rounded uppercase text-[10px]">
                              REVOGADA (INATIVA)
                            </span>
                          ) : (
                            <span className="text-emerald-400 font-sans font-black bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded uppercase text-[10px]">
                              ATIVA
                            </span>
                          )}
                        </div>
                        {v.protectiveOrder?.status === 'Revogada' && (
                          <div className="mt-2 p-2 bg-rose-950/40 border border-rose-900/50 rounded-lg text-rose-300 font-sans text-[10px] space-y-0.5">
                            <p><strong>Ofício Revogação:</strong> {v.protectiveOrder.revocationNoticeNumber || 'N/A'}</p>
                            <p><strong>Data Revogação:</strong> {safeFormatDate(v.protectiveOrder.revocationDate)}</p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5 text-[11px] text-slate-400">
                        <div className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mt-1.5 shrink-0"></span>
                          <span><strong>Endereço:</strong> {v.address || 'Não cadastrado'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0"></span>
                          <span><strong>Risco Operacional:</strong> <span className={`font-bold ${v.riskLevel === 'Alto' ? 'text-red-400' : v.riskLevel === 'Médio' ? 'text-amber-400' : 'text-emerald-400'}`}>{v.riskLevel}</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0"></span>
                          <span><strong>Guarnição Rota:</strong> {v.assignedPatrol}</span>
                        </div>
                      </div>
                    </div>
                  );
                })() : (
                  <div className="text-center py-6 text-slate-550 italic text-xs">
                    Nenhuma assistida selecionada. Escolha uma assistida para visualizar as restrições e termos protetivos.
                  </div>
                )}
              </div>

              {/* Box 2: Histórico de Evoluções já Registradas desta assistida */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
                <div className="border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-5 h-5 text-amber-500" />
                    Histórico da Assistida
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">Evoluções registradas anteriormente no sistema.</p>
                </div>

                {newOccurrenceForm.victimId ? (() => {
                  const occs = db.occurrences.filter(o => o.victimId === newOccurrenceForm.victimId);
                  if (occs.length === 0) {
                    return (
                      <div className="text-center py-6 text-slate-550 italic text-xs">
                        Nenhuma evolução registrada anteriormente para esta assistida.
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                      {occs.map((oc) => (
                        <div key={oc.id} className="bg-slate-950 p-3 rounded-xl border border-slate-850 space-y-1.5 text-xs">
                          <div className="flex justify-between items-center text-[10px] font-mono text-slate-450 border-b border-slate-900 pb-1">
                            <span>{safeFormatDate(oc.date)}</span>
                            {oc.cadgProtocol && <span className="text-emerald-400 font-bold">CADG: {oc.cadgProtocol}</span>}
                          </div>
                          <p className="text-[11px] text-slate-300 leading-relaxed font-sans">{oc.description}</p>
                        </div>
                      ))}
                    </div>
                  );
                })() : (
                  <div className="text-center py-6 text-slate-550 italic text-xs">
                    Selecione uma assistida para consultar o histórico anterior.
                  </div>
                )}
              </div>

            </div>

          </div>
        </main>
      )}

      {/* 👑 PORTAL DE GERENCIAMENTO DE ADMINISTRADORES (GOOGLE LOGIN) */}
      {activeRole === 'admin' && (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
          <AdminManagement />
        </main>
      )}

      {/* 🔴 MODAL DE REVOGAÇÃO DE MEDIDA PROTETIVA */}
      {isRevocationModalOpen && revocationVictim && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6 relative animate-in fade-in zoom-in duration-150">
            
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-950 border border-rose-800 text-rose-400 flex items-center justify-center shrink-0">
                  <FileX className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-100 uppercase tracking-wider">
                    Revogação de Medida Protetiva
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Assistida: <strong className="text-slate-200">{revocationVictim.name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setIsRevocationModalOpen(false); setRevocationVictim(null); }}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmRevocation} className="space-y-4 text-xs">
              
              {/* Process Info */}
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-slate-300 space-y-1.5 font-mono">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-bold">PROCESSO MPU:</span>
                  <span className="text-slate-100 font-bold">{revocationVictim.protectiveOrder?.orderNumber || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-bold">REQUERIDO (RÉU):</span>
                  <span className="text-amber-400 font-bold">{revocationVictim.protectiveOrder?.defendantName || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-bold">SITUAÇÃO ATUAL:</span>
                  <span className={`font-bold ${revocationVictim.protectiveOrder?.status === 'Revogada' ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {revocationVictim.protectiveOrder?.status || 'Ativa'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-1.5">
                  Número do Ofício de Revogação *
                </label>
                <input
                  type="text"
                  required
                  value={revocationForm.noticeNumber}
                  onChange={(e) => setRevocationForm({ ...revocationForm, noticeNumber: e.target.value })}
                  placeholder="Ex: Ofício nº 452/2026 - 2ª Vara Criminal"
                  className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 text-slate-100 font-extrabold focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-1.5">
                  Data da Revogação *
                </label>
                <input
                  type="date"
                  required
                  value={revocationForm.date}
                  onChange={(e) => setRevocationForm({ ...revocationForm, date: e.target.value })}
                  className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 text-slate-100 font-extrabold focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-1.5">
                  Motivo / Observações do Juízo (Opcional)
                </label>
                <textarea
                  value={revocationForm.reason}
                  onChange={(e) => setRevocationForm({ ...revocationForm, reason: e.target.value })}
                  placeholder="Descreva o despacho ou determinação de revogação do magistrado..."
                  rows={3}
                  className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 text-slate-100 font-extrabold focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>

              <div className="bg-rose-950/40 p-3 rounded-xl border border-rose-900/50 text-[11px] text-rose-300 leading-relaxed font-sans">
                ⚠️ Ao concluir estes dados, a Medida Protetiva será arquivada no histórico como <strong>REVOGADA (INATIVA)</strong>.
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsRevocationModalOpen(false); setRevocationVictim(null); }}
                  className="px-4 py-2.5 bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-400 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRevocation}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl cursor-pointer transition-colors flex items-center gap-2"
                >
                  {isSubmittingRevocation ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileX className="w-4 h-4" />}
                  Concluir Revogação
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* 👮 BOTTOM FOOTER SYSTEM INFO */}
      <footer className="bg-slate-950 border-t border-slate-900 px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-emerald-600" />
          <span>PROMUSE © 2026. Segurança pública integrada e inteligente.</span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px]">
          <span className="text-emerald-500 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
            Canal Operativo
          </span>
          <span>{adminUnit}, BR</span>
        </div>
      </footer>

    </div>
  );
}
