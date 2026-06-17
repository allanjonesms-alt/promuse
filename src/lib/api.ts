import { collection, doc, setDoc, getDocs, updateDoc, deleteDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

const generateId = (prefix: string) => `${prefix}_${Date.now()}`;

export const firebaseApiFetch = async (url: string, options?: any) => {
  const method = options?.method || 'GET';
  const body = options?.body ? JSON.parse(options.body) : null;

  try {
    if (url === '/api/db' && method === 'GET') {
      let vSnap, aSnap, oSnap, hSnap;

      try {
        vSnap = await getDocs(collection(db, 'victims'));
        aSnap = await getDocs(collection(db, 'panicAlerts'));
        oSnap = await getDocs(collection(db, 'occurrences'));
        hSnap = await getDocs(collection(db, 'hearings'));
      } catch (error: any) {
        console.warn('Firestore load failed (unauthenticated or permission denied):', error);
        throw error; // Let the general catch handle it so we return ok: false
      }

      return {
        ok: true,
        json: async () => ({
          victims: vSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          panicAlerts: aSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          occurrences: oSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          hearings: hSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        })
      };
    }

    if (url === '/api/reset' && method === 'POST') {
       // Since resetting whole DB is bad for real users, we will just return ok
       return { ok: true, json: async () => ({ message: 'Cannot reset cloud DB.' }) };
    }

    if (url === '/api/victims' && method === 'POST') {
      const id = body.id || generateId('vit');
      const victim = {
        name: body.name,
        cpf: body.cpf,
        phone: body.phone,
        address: body.address,
        riskLevel: body.riskLevel || 'Baixo',
        policeOfficerInCharge: body.policeOfficerInCharge || 'A definir',
        assignedPatrol: body.assignedPatrol || 'A definir',
        createdAt: body.createdAt || new Date().toISOString(),
        protectiveOrder: body.protectiveOrder || null
      };
      await setDoc(doc(db, 'victims', id), victim);
      return { ok: true, json: async () => ({ id, ...victim }) };
    }

    if (url.startsWith('/api/victims/') && method === 'PUT') {
      const id = url.split('/').pop()!;
      // For updates we assume the frontend sends the whole updated object for simplicity,
      // but updateDoc only patches provided fields.
      // We will remove id from the body
      const { id: _, ...updateData } = body;
      await updateDoc(doc(db, 'victims', id), updateData);
      return { ok: true, json: async () => body }; 
    }

    if (url.startsWith('/api/victims/') && method === 'DELETE') {
      const id = url.split('/').pop()!;
      await deleteDoc(doc(db, 'victims', id));
      return { ok: true, json: async () => ({ message: 'Deleted' }) };
    }

    if (url === '/api/alerts' && method === 'POST') {
      const id = body.id || generateId('alt');
      const alert = {
        victimId: body.victimId || 'anonima',
        victimName: body.victimName || 'Não identificada',
        victimPhone: body.victimPhone || '(67) Emergência',
        requestTime: body.requestTime || new Date().toISOString(),
        location: body.location || { latitude: 0, longitude: 0, addressDescription: '' },
        status: body.status || 'Ativo',
        dispatcherComments: body.dispatcherComments || ''
      };
      await setDoc(doc(db, 'panicAlerts', id), alert);
      return { ok: true, json: async () => ({ id, ...alert }) };
    }

    if (url.startsWith('/api/alerts/') && method === 'PUT') {
      const id = url.split('/').pop()!;
      const updateData = {
        status: body.status || 'Resolvido',
        dispatcherComments: body.dispatcherComments || ''
      };
      await updateDoc(doc(db, 'panicAlerts', id), updateData);
      
      // Auto log occurrence
      if (body.status === 'Resolvido' && body.autoLogOccurrence) {
        // get alert to auto log
        const alertSnap = await getDoc(doc(db, 'panicAlerts', id));
        if (alertSnap.exists()) {
          const alert = alertSnap.data();
          const occId = generateId('occ');
          const occ = {
            victimId: alert.victimId || '',
            victimName: alert.victimName || '',
            date: new Date().toISOString(),
            type: 'Descumprimento de Medida',
            description: `Acionamento de botão de Pânico resolvido pelo despachante. Descrição do atendimento: ${body.dispatcherComments || ''}`,
            registeredByOfficer: body.registeredByOfficer || 'Despachante 5ºBPM',
            actionsTaken: 'Acionamento emergencial respondido via deslocamento policial e encerrado.'
          };
          await setDoc(doc(db, 'occurrences', occId), occ);
        }
      }
      return { ok: true, json: async () => ({ ...body, ...updateData }) };
    }

    if (url === '/api/occurrences' && method === 'POST') {
      const id = body.id || generateId('occ');
      const occ = {
        victimId: body.victimId,
        victimName: body.victimName || 'Vítima',
        date: body.date || new Date().toISOString(),
        type: body.type || 'Visita Preventiva',
        description: body.description || '',
        registeredByOfficer: body.registeredByOfficer || 'Policial',
        actionsTaken: body.actionsTaken || ''
      };
      await setDoc(doc(db, 'occurrences', id), occ);
      return { ok: true, json: async () => ({ id, ...occ }) };
    }

  } catch(e: any) {
    console.warn('Firebase API intercepted error. Falling back gracefully to backend Express database (promuse_db.json):', e.message || e);
    return fetch(url, options);
  }
  
  // Fallback to real fetch for unhandled routes (like /api/parse-pdf)
  return fetch(url, options);
};
