import { collection, doc, setDoc, getDocs, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getAuth } from 'firebase/auth';
import { parsePdfClientSide } from './pdfParser';

const generateId = (prefix: string) => `${prefix}_${Date.now()}`;

// Sanitizes objects for Firestore to ensure no undefined values, prototype chains, or invalid nested prototype entities exist
export function cleanForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as any;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  try {
    // Strips all custom class prototypes, non-enumerable properties, DOM entities, and converts to pure JSON plain object
    const serialized = JSON.stringify(data, (_, value) => {
      if (value === undefined) return null;
      if (typeof value === 'function' || typeof value === 'symbol') return undefined;
      return value;
    });
    return JSON.parse(serialized);
  } catch (_) {
    if (Array.isArray(data)) {
      return (data as any[]).map(cleanForFirestore) as any;
    }
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value !== undefined) {
        result[key] = cleanForFirestore(value);
      }
    }
    return result as T;
  }
}

const formatAttachment = (att: any) => {
  if (!att || typeof att !== 'object') return null;
  return cleanForFirestore({
    id: String(att.id || `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`),
    name: String(att.name || 'Documento.pdf'),
    size: typeof att.size === 'number' ? att.size : 0,
    type: String(att.type || 'application/pdf'),
    dataUrl: typeof att.dataUrl === 'string' ? att.dataUrl : '',
    uploadedAt: String(att.uploadedAt || new Date().toISOString()),
    category: String(att.category || 'MPU')
  });
};

const formatProtectiveOrder = (po: any) => {
  if (!po || typeof po !== 'object') return null;
  const mpuPdf = po.mpuPdf ? formatAttachment(po.mpuPdf) : null;
  const attachments = Array.isArray(po.attachments) 
    ? po.attachments.map(formatAttachment).filter(Boolean)
    : [];

  return cleanForFirestore({
    id: String(po.id || `ord_${Date.now()}`),
    orderNumber: String(po.orderNumber || ''),
    defendantName: String(po.defendantName || ''),
    distanceLimit: String(po.distanceLimit || ''),
    issueDate: String(po.issueDate || new Date().toISOString().split('T')[0]),
    expiryDate: String(po.expiryDate || ''),
    judgeName: String(po.judgeName || ''),
    restrictions: String(po.restrictions || ''),
    status: (po.status === 'Revogada' || po.status === 'Expirada') ? po.status : 'Ativa',
    revocationNoticeNumber: po.revocationNoticeNumber ? String(po.revocationNoticeNumber) : null,
    revocationDate: po.revocationDate ? String(po.revocationDate) : null,
    mpuPdf: mpuPdf,
    attachments: attachments
  });
};

const formatVictim = (body: any, explicitId?: string) => {
  if (!body || typeof body !== 'object') return null as any;
  const id = explicitId || body.id || generateId('vit');
  const po = body.protectiveOrder ? formatProtectiveOrder(body.protectiveOrder) : null;
  
  const mpuPdf = body.mpuPdf ? formatAttachment(body.mpuPdf) : (po?.mpuPdf || null);
  const attachments = Array.isArray(body.attachments)
    ? body.attachments.map(formatAttachment).filter(Boolean)
    : (po?.attachments || []);

  const coordinates = body.coordinates && typeof body.coordinates.latitude === 'number' && typeof body.coordinates.longitude === 'number'
    ? {
        latitude: Number(body.coordinates.latitude),
        longitude: Number(body.coordinates.longitude)
      }
    : null;

  return cleanForFirestore({
    id: String(id),
    name: String(body.name || '').trim(),
    cpf: String(body.cpf || '').trim(),
    phone: String(body.phone || '').trim(),
    address: String(body.address || '').trim(),
    riskLevel: (body.riskLevel === 'Alto' || body.riskLevel === 'Médio') ? body.riskLevel : 'Baixo',
    policeOfficerInCharge: String(body.policeOfficerInCharge || 'A definir'),
    assignedPatrol: String(body.assignedPatrol || 'VTR PROMUSE 5040'),
    createdAt: String(body.createdAt || new Date().toISOString()),
    acceptedPromuse: body.acceptedPromuse === 'SOMENTE RONDAS' 
      ? 'SOMENTE RONDAS' 
      : (body.acceptedPromuse === 'NÃO' || body.acceptedPromuse === false ? 'NÃO' : 'SIM'),
    victimPhotoUrl: body.victimPhotoUrl ? String(body.victimPhotoUrl) : null,
    aggressorPhotoUrl: body.aggressorPhotoUrl ? String(body.aggressorPhotoUrl) : (body.defendantPhotoUrl ? String(body.defendantPhotoUrl) : null),
    defendantPhotoUrl: body.defendantPhotoUrl ? String(body.defendantPhotoUrl) : (body.aggressorPhotoUrl ? String(body.aggressorPhotoUrl) : null),
    mpuPdf: mpuPdf,
    attachments: attachments,
    coordinates: coordinates,
    protectiveOrder: po
  });
};

const formatAlert = (body: any, explicitId?: string) => {
  const id = explicitId || body.id || generateId('alt');
  return cleanForFirestore({
    id: String(id),
    victimId: String(body.victimId || 'anonima'),
    victimName: String(body.victimName || 'Não identificada'),
    victimPhone: String(body.victimPhone || '(67) Emergência'),
    requestTime: String(body.requestTime || new Date().toISOString()),
    location: {
      latitude: Number(body.location?.latitude || 0),
      longitude: Number(body.location?.longitude || 0),
      addressDescription: String(body.location?.addressDescription || '')
    },
    status: (body.status === 'Resolvido' || body.status === 'Em Atendimento') ? body.status : 'Ativo',
    dispatcherComments: String(body.dispatcherComments || '')
  });
};

const formatOccurrence = (body: any, explicitId?: string) => {
  const id = explicitId || body.id || generateId('occ');
  return cleanForFirestore({
    id: String(id),
    victimId: String(body.victimId || ''),
    victimName: String(body.victimName || 'Vítima'),
    date: String(body.date || new Date().toISOString()),
    type: String(body.type || 'Visita Preventiva'),
    cadgProtocol: String(body.cadgProtocol || ''),
    description: String(body.description || ''),
    registeredByOfficer: String(body.registeredByOfficer || 'Policial Militar'),
    actionsTaken: String(body.actionsTaken || '')
  });
};

export const firebaseApiFetch = async (url: string, options?: any) => {
  const method = options?.method || 'GET';
  const body = options?.body ? JSON.parse(options.body) : null;
  const auth = getAuth();

  try {
    if (url === '/api/db' && method === 'GET') {
      let vSnap, aSnap, oSnap, hSnap;

      try {
        vSnap = await getDocs(collection(db, 'victims'));
        aSnap = await getDocs(collection(db, 'panicAlerts'));
        oSnap = await getDocs(collection(db, 'occurrences'));
        hSnap = await getDocs(collection(db, 'hearings'));
      } catch (error: any) {
        // Fallback to backend Express server if Firestore is unreachable/unauthenticated
        return fetch(url, options);
      }

      // Collect Firestore victims
      const firestoreVictims = vSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Also retrieve backend data to ensure full synchronization
      let backendData: any = null;
      try {
        const backendRes = await fetch(url, options);
        if (backendRes.ok) {
          backendData = await backendRes.json();
        }
      } catch (_) {}

      // If Firestore is empty, seed from backend
      if (vSnap.empty && backendData && backendData.victims && backendData.victims.length > 0) {
        if (auth.currentUser) {
          for (const v of backendData.victims) {
            const formatted = formatVictim(v, v.id);
            setDoc(doc(db, 'victims', v.id), formatted, { merge: true }).catch(() => {});
          }
        }
        return {
          ok: true,
          json: async () => backendData
        };
      }

      return {
        ok: true,
        json: async () => ({
          victims: firestoreVictims.length > 0 || vSnap.docs.length > 0 ? firestoreVictims : (backendData?.victims || []),
          panicAlerts: aSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          occurrences: oSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          hearings: hSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        })
      };
    }

    if (url === '/api/reset' && method === 'POST') {
      return { ok: true, json: async () => ({ message: 'Base de dados protegida.' }) };
    }

    if (url === '/api/victims' && method === 'POST') {
      const victim = formatVictim(body);
      try {
        await setDoc(doc(db, 'victims', victim.id), victim, { merge: true });
      } catch (firestoreErr) {
        console.warn('Firestore victim save bypassed/fallback to server:', firestoreErr);
      }
      try {
        await fetch(url, options);
      } catch (_) {}
      return { ok: true, json: async () => victim };
    }

    if (url.startsWith('/api/victims/') && method === 'PUT') {
      const id = url.split('/').pop()!;
      const victim = formatVictim(body, id);
      try {
        await setDoc(doc(db, 'victims', id), victim, { merge: true });
      } catch (firestoreErr) {
        console.warn('Firestore victim update bypassed/fallback to server:', firestoreErr);
      }
      try {
        await fetch(url, options);
      } catch (_) {}
      return { ok: true, json: async () => victim }; 
    }

    if (url.startsWith('/api/victims/') && method === 'DELETE') {
      const id = url.split('/').pop()!;
      try {
        await deleteDoc(doc(db, 'victims', id));
      } catch (firestoreErr) {
        console.warn('Firestore victim delete bypassed/fallback to server:', firestoreErr);
      }
      try {
        await fetch(url, { ...options, method: 'DELETE' });
      } catch (_) {}
      return { ok: true, json: async () => ({ message: 'Deleted' }) };
    }

    if (url === '/api/alerts' && method === 'POST') {
      const alert = formatAlert(body);
      try {
        await setDoc(doc(db, 'panicAlerts', alert.id), alert, { merge: true });
      } catch (firestoreErr) {
        console.warn('Firestore alert save bypassed/fallback to server:', firestoreErr);
      }
      try {
        await fetch(url, options);
      } catch (_) {}
      return { ok: true, json: async () => alert };
    }

    if (url.startsWith('/api/alerts/') && method === 'PUT') {
      const id = url.split('/').pop()!;
      const updateData = cleanForFirestore({
        status: body.status || 'Resolvido',
        dispatcherComments: body.dispatcherComments || ''
      });
      try {
        await setDoc(doc(db, 'panicAlerts', id), updateData, { merge: true });
      } catch (firestoreErr) {
        console.warn('Firestore alert update bypassed/fallback to server:', firestoreErr);
      }
      
      // Auto log occurrence
      if (body.status === 'Resolvido' && body.autoLogOccurrence) {
        try {
          const alertSnap = await getDoc(doc(db, 'panicAlerts', id));
          if (alertSnap.exists()) {
            const alertData = alertSnap.data();
            const occ = formatOccurrence({
              victimId: alertData.victimId || '',
              victimName: alertData.victimName || '',
              date: new Date().toISOString(),
              type: 'Descumprimento de Medida',
              description: `Acionamento de botão de Pânico resolvido pelo despachante. Descrição do atendimento: ${body.dispatcherComments || ''}`,
              registeredByOfficer: body.registeredByOfficer || 'Despachante 5ºBPM',
              actionsTaken: 'Acionamento emergencial respondido via deslocamento policial e encerrado.'
            });
            await setDoc(doc(db, 'occurrences', occ.id), occ, { merge: true });
          }
        } catch (_) {}
      }
      try {
        await fetch(url, options);
      } catch (_) {}
      return { ok: true, json: async () => ({ ...body, ...updateData }) };
    }

    if (url === '/api/occurrences' && method === 'POST') {
      const occ = formatOccurrence(body);
      try {
        await setDoc(doc(db, 'occurrences', occ.id), occ, { merge: true });
      } catch (firestoreErr) {
        console.warn('Firestore occurrence save bypassed/fallback to server:', firestoreErr);
      }
      try {
        await fetch(url, options);
      } catch (_) {}
      return { ok: true, json: async () => occ };
    }

    if (url === '/api/parse-pdf' && method === 'POST') {
      try {
        const res = await fetch(url, options);
        if (res.ok) {
          return res;
        }
      } catch (_) {}

      // Fallback to client-side PDF parsing
      try {
        const parsedData = await parsePdfClientSide(body?.pdfBase64 || '');
        return {
          ok: true,
          json: async () => parsedData
        };
      } catch (pdfErr: any) {
        return {
          ok: false,
          json: async () => ({ error: pdfErr.message || 'Erro ao analisar PDF no cliente.' })
        };
      }
    }

  } catch(e: any) {
    // If anything fails in Firestore, quietly and safely fallback to backend Express API without crashing
    return fetch(url, options);
  }
  
  // Fallback to real fetch for unhandled routes
  return fetch(url, options);
};
