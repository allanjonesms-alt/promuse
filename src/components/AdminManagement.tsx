import React, { useState, useEffect } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  handleFirestoreError, 
  OperationType 
} from '../firebase';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User,
  getAuth
} from 'firebase/auth';
import { 
  doc, 
  getDoc,
  setDoc, 
  deleteDoc, 
  updateDoc, 
  collection, 
  onSnapshot, 
  Timestamp
} from 'firebase/firestore';
import { 
  ShieldAlert, 
  UserPlus, 
  Trash2, 
  Power, 
  LogOut, 
  ShieldCheck, 
  Loader2, 
  UserCheck, 
  Shield, 
  Mail, 
  Calendar, 
  User as UserIcon,
  Crown
} from 'lucide-react';

interface AdminAccount {
  email: string;
  name: string;
  role: string;
  status: 'Ativo' | 'Inativo';
  phone?: string;
  unit?: string;
  addedBy?: string;
  createdAt?: any;
}

export default function AdminManagement() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);
  const [userRole, setUserRole] = useState<'master' | 'admin' | 'none'>('none');
  
  // Administrators list state
  const [adminsList, setAdminsList] = useState<AdminAccount[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isEditingAdmin, setIsEditingAdmin] = useState(false);

  // New Admin Form State
  const [newAdminForm, setNewAdminForm] = useState({
    email: '',
    name: '',
    phone: '',
    unit: 'COXIM',
    role: 'admin',
    status: 'Ativo' as 'Ativo' | 'Inativo'
  });

  // Track Firebase Auth State Changes
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setIsAdminAuthorized(false);
      setUserRole('none');
      setAuthLoading(true);
      setErrorMsg(null);

      if (user && user.email) {
        const userEmail = user.email.toLowerCase().trim();
        
        // 1. Is it the Hardcoded Master Admin?
        if (userEmail === 'allanjonesms@gmail.com') {
          setIsAdminAuthorized(true);
          setUserRole('master');
          
          // Auto-provision Master Admin in Firestore if missing
          try {
            const { setDoc, Timestamp } = await import('firebase/firestore');
            const docRef = doc(db, 'admins', 'allanjonesms@gmail.com');
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) {
              const authInstance = getAuth();
              console.log("USER:", authInstance.currentUser);
              console.log("UID:", authInstance.currentUser?.uid);
              console.log("EMAIL:", authInstance.currentUser?.email);
              await setDoc(docRef, {
                email: 'allanjonesms@gmail.com',
                name: user.displayName || 'Allan Jones',
                role: 'master',
                status: 'Ativo',
                addedBy: 'Instanciação Automática',
                createdAt: Timestamp.now()
              });
              console.log('Master Admin auto-provisioned successfully in Firestore (Admin panel).');
            }
          } catch (error) {
            console.error("Error auto-provisioning Master Admin in Admin screen:", error);
          }

          setAuthLoading(false);
          return;
        }

        // 2. Check Firestore collection if exists and status is Active
        try {
          const docRef = doc(db, 'admins', userEmail);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.status === 'Ativo') {
              setIsAdminAuthorized(true);
              setUserRole(data.role === 'master' ? 'master' : 'admin');
            } else {
              setErrorMsg('Sua conta de administrador está configurada como INATIVA.');
            }
          } else {
            setErrorMsg('Acesso Restrito. Seu e-mail não foi incluído como administrador ativo do sistema.');
          }
        } catch (error) {
          console.error("Erro ao verificar autenticação de admin no Firestore:", error);
          setErrorMsg('Erro de verificação nos servidores do Firestore PROMUSE.');
        }
      }
      setAuthLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // Listen to Administrators Collection when Authorized
  useEffect(() => {
    if (!isAdminAuthorized || !currentUser) {
      setAdminsList([]);
      return;
    }

    setListLoading(true);
    const path = 'admins';
    const unsubscribeSnapshot = onSnapshot(collection(db, path), (querySnapshot) => {
      const records: AdminAccount[] = [];
      querySnapshot.forEach((doc) => {
        const d = doc.data();
        records.push({
          email: doc.id,
          name: d.name || 'Sem nome informado',
          role: d.role || 'admin',
          status: d.status || 'Inativo',
          phone: d.phone || '',
          unit: d.unit || '',
          addedBy: d.addedBy || 'N/A',
          createdAt: d.createdAt
        });
      });
      
      // Sort so 'allanjonesms@gmail.com' or Master comes first, followed by name alphabetically
      records.sort((a, b) => {
        if (a.email === 'allanjonesms@gmail.com') return -1;
        if (b.email === 'allanjonesms@gmail.com') return 1;
        return a.name.localeCompare(b.name);
      });

      setAdminsList(records);
      setListLoading(false);
    }, (error) => {
      setListLoading(false);
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribeSnapshot();
  }, [isAdminAuthorized, currentUser]);

  // Handle Login via Google Account
  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(`Erro de login do Google: ${e.message || String(e)}`);
      setAuthLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
    }
  };

  // Handle Edit Admin Click
  const handleEditAdminClick = (admin: AdminAccount) => {
    setNewAdminForm({
      email: admin.email,
      name: admin.name,
      phone: admin.phone || '',
      unit: admin.unit || 'COXIM',
      role: admin.role as 'master' | 'admin',
      status: admin.status
    });
    setIsEditingAdmin(true);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleCancelEdit = () => {
    setNewAdminForm({
      email: '',
      name: '',
      phone: '',
      unit: 'COXIM',
      role: 'admin',
      status: 'Ativo'
    });
    setIsEditingAdmin(false);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  // Handle Add/Edit Admin
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const targetEmail = newAdminForm.email.toLowerCase().trim();
    if (!targetEmail) return;

    if (!targetEmail.includes('@') || !targetEmail.includes('.')) {
      setErrorMsg('Por favor insira um e-mail Google válido!');
      return;
    }

    setActionLoading('creating');
    const path = `admins/${targetEmail}`;
    try {
      const adminDocRef = doc(db, 'admins', targetEmail);
      
      const adminData: any = {
        email: targetEmail,
        name: newAdminForm.name.trim() || 'Administrador PROMUSE',
        phone: newAdminForm.phone.trim(),
        unit: newAdminForm.unit,
        role: newAdminForm.role,
        status: newAdminForm.status
      };

      if (!isEditingAdmin) {
        adminData.addedBy = currentUser?.email || 'Sistema';
        adminData.createdAt = Timestamp.now();
      }

      await setDoc(adminDocRef, adminData, { merge: true });

      setSuccessMsg(isEditingAdmin ? `Administrador '${targetEmail}' atualizado com sucesso!` : `Administrador '${targetEmail}' cadastrado com sucesso!`);
      handleCancelEdit();
    } catch (error) {
      setErrorMsg('Erro de permissão ou de conexão ao salvar administrador.');
      handleFirestoreError(error, isEditingAdmin ? OperationType.UPDATE : OperationType.CREATE, path);
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle Admin Activation Status
  const handleToggleStatus = async (admin: AdminAccount) => {
    const targetEmail = admin.email.toLowerCase().trim();
    if (targetEmail === 'allanjonesms@gmail.com') {
      alert('Você não pode desativar o Administrador Master Oficial.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setActionLoading(`status-${targetEmail}`);

    const newStatus = admin.status === 'Ativo' ? 'Inativo' : 'Ativo';
    const path = `admins/${targetEmail}`;
    try {
      const adminDocRef = doc(db, 'admins', targetEmail);
      const authInstance = getAuth();
      console.log("USER:", authInstance.currentUser);
      console.log("UID:", authInstance.currentUser?.uid);
      console.log("EMAIL:", authInstance.currentUser?.email);
      await updateDoc(adminDocRef, {
        status: newStatus
      });
      setSuccessMsg(`Status do administrador '${targetEmail}' atualizado para ${newStatus}.`);
    } catch (error) {
      setErrorMsg('Erro de permissão ou conexão ao alterar status do administrador.');
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setActionLoading(null);
    }
  };

  // Delete Admin Credentials
  const handleDeleteAdmin = async (adminEmail: string) => {
    if (adminEmail === 'allanjonesms@gmail.com') {
      alert('O Administrador Master Oficial "allanjonesms@gmail.com" nunca pode ser excluído.');
      return;
    }

    if (!window.confirm(`Tem certeza absoluta de que deseja revogar o acesso do administrador "${adminEmail}"?`)) {
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setActionLoading(`delete-${adminEmail}`);

    const path = `admins/${adminEmail}`;
    try {
      const adminDocRef = doc(db, 'admins', adminEmail);
      const authInstance = getAuth();
      console.log("USER:", authInstance.currentUser);
      console.log("UID:", authInstance.currentUser?.uid);
      console.log("EMAIL:", authInstance.currentUser?.email);
      await deleteDoc(adminDocRef);
      setSuccessMsg(`Acesso do administrador '${adminEmail}' excluído com sucesso.`);
    } catch (error) {
      setErrorMsg('Erro de permissão ou conexão ao excluir o administrador.');
      handleFirestoreError(error, OperationType.DELETE, path);
    } finally {
      setActionLoading(null);
    }
  };

  // Format Dates Helper
  const formatDate = (val: any) => {
    if (!val) return 'Automático';
    if (val.toDate) {
      return val.toDate().toLocaleString('pt-BR');
    }
    return new Date(val).toLocaleString('pt-BR');
  };

  // --- RENDERING VIEWS ---

  // Loader View
  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-slate-300">
        <Loader2 className="w-8 h-8 text-emerald-450 animate-spin" />
        <span className="text-xs font-mono tracking-wider uppercase opacity-80">Processando Credenciais Google...</span>
      </div>
    );
  }

  // Unauthorized Logged In User View OR Guest Screen
  if (!isAdminAuthorized) {
    return (
      <div className="max-w-md w-full mx-auto my-12 p-6 md:p-8 bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl space-y-6">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 bg-rose-950/50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto border border-rose-800/30">
            <ShieldAlert className="w-8 h-8 text-rose-500" />
          </div>
          <h2 className="text-lg font-black uppercase tracking-wider text-slate-100">
            Portal de Administração
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Área de segurança restrita para controle de administradores e aprovação de guarnições do PROMUSE de Coxim-MS.
          </p>
        </div>

        {currentUser ? (
          // Logged-in Google user but NOT in firestore or inativo
          <div className="space-y-4 pt-2 border-t border-slate-850">
            <div className="p-3 bg-red-950/40 rounded-xl border border-red-900/40 text-xs text-red-300 space-y-2">
              <p className="font-extrabold flex items-center gap-1.5 uppercase text-[10px] tracking-wide">
                🚫 CADASTRO NÃO AUTORIZADO
              </p>
              <p className="leading-relaxed">
                A conta Google logada <strong>{currentUser.email}</strong> não possui privilégios de acesso administrativo.
              </p>
              <p className="text-[11px] text-slate-400">
                Se este for o seu primeiro acesso, solicite autorização informando seu e-mail ao Administrador Master: <strong className="text-slate-100">allanjonesms@gmail.com</strong>.
              </p>
            </div>

            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
              {currentUser.photoURL && (
                <img 
                  src={currentUser.photoURL} 
                  alt="Avatar" 
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full border border-slate-700 hover:scale-105 duration-200" 
                />
              )}
              <div className="text-xs leading-none truncate">
                <p className="font-bold text-slate-200 truncate">{currentUser.displayName}</p>
                <p className="text-[11px] text-slate-500 mt-1 truncate">{currentUser.email}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 hover:text-white border border-slate-800 font-bold text-slate-300 cursor-pointer text-xs flex items-center justify-center gap-2 transition-all"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              Sair desta Conta Google
            </button>
          </div>
        ) : (
          // Guest User (Login CTA)
          <div className="space-y-4 pt-2 border-t border-slate-850">
            <button
              id="google-signin-btn"
              onClick={handleGoogleLogin}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold tracking-wide uppercase text-xs flex items-center justify-center gap-3 shadow-md shadow-emerald-950/50 cursor-pointer transition-all hover:translate-y-[-1px] active:translate-y-[1px]"
            >
              <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24">
                <path d="M12.24 10.285V13.4h6.887C18.2 15.614 15.645 18 12.24 18c-3.86 0-7-3.14-7-7s3.14-7 7-7c1.7 0 3.25.61 4.5 1.62l2.422-2.425C17.653 1.944 15.122 1 12.24 1 6.574 1 2 5.574 2 11.24S6.574 21.48 12.24 21.48c5.92 0 9.87-4.16 9.87-10.02 0-.66-.06-1.16-.16-1.78H12.24z"/>
              </svg>
              Conectar com sua Conta Google
            </button>
            <div className="text-center">
              <span className="text-[10px] text-slate-500 mt-2 block font-mono">
                Admin Master: allanjonesms@gmail.com
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Logged In & Authorized Admin Interface ---
  return (
    <div className="space-y-6">
      
      {/* 👑 ADMIN HEADER CONTEXT */}
      <div className="bg-slate-950 rounded-3xl border border-slate-800 p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white border ${
            userRole === 'master' 
              ? 'bg-amber-600/10 border-amber-500 text-amber-400' 
              : 'bg-emerald-600/10 border-emerald-500 text-emerald-450'
          }`}>
            {userRole === 'master' ? <Crown className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                userRole === 'master' 
                  ? 'bg-amber-950 text-amber-400 border border-amber-900/60' 
                  : 'bg-emerald-950 text-emerald-450 border border-emerald-900/60'
              }`}>
                {userRole === 'master' ? '👑 Master Admin Activo' : '👮 Admin Geral'}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-slate-400">PAINEL EXCLUSIVO</span>
            </div>
            <h2 className="text-md font-bold text-slate-100 mt-1 leading-none">{currentUser?.displayName}</h2>
            <p className="text-[11px] text-slate-500 mt-1">{currentUser?.email}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-850 hover:text-white border border-slate-800 text-slate-400 font-bold text-xs rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-red-500" />
          Sair da Conta Google
        </button>

      </div>

      {/* STATUS TOASTS */}
      {errorMsg && (
        <div className="p-4 bg-red-950/50 border border-red-500 text-red-100 rounded-2xl text-xs flex items-center gap-2">
          <ShieldAlert className="w-4.5 h-4.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 rounded-2xl text-xs flex items-center gap-2">
          <UserCheck className="w-4.5 h-4.5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* TWO PANEL ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* 📋 LIST AND DATA GRID OF ADMINISTRATORS (7 COLS) */}
        <div className="lg:col-span-8 bg-slate-950 rounded-3xl border border-slate-850 p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-850 pb-3">
            <h2 className="text-xs font-black text-slate-100 uppercase tracking-widest flex items-center gap-1.5">
              <Shield className="w-4.5 h-4.5 text-emerald-450" />
              Administradores Credenciados ({adminsList.length})
            </h2>
          </div>

          {listLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Loader2 className="w-6 h-6 text-emerald-450 animate-spin" />
              <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">Acessando registros...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-300 border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 text-[10px] text-slate-400 uppercase tracking-wider">
                    <th className="pb-3 font-extrabold">E-mail Google</th>
                    <th className="pb-3 font-extrabold hidden sm:table-cell">Nome Completo</th>
                    <th className="pb-3 font-extrabold hidden md:table-cell">Contato/Unid.</th>
                    <th className="pb-3 font-extrabold text-center">Nível</th>
                    <th className="pb-3 font-extrabold text-center">Status</th>
                    <th className="pb-3 font-extrabold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                  {adminsList.map((admin) => (
                    <tr key={admin.email} className="group hover:bg-slate-900/30 transition-transform">
                      <td className="py-3.5 pr-2 font-mono font-bold text-slate-200">
                        <div className="flex items-center gap-1.5">
                          {admin.email === 'allanjonesms@gmail.com' && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                          <span className="truncate max-w-[180px]" title={admin.email}>{admin.email}</span>
                        </div>
                        {/* Mobile supplementary details displayed inline */}
                        <div className="sm:hidden text-[10px] text-slate-500 font-sans font-normal mt-0.5 max-w-[185px] truncate">
                          {admin.name}
                        </div>
                      </td>
                      <td className="py-3.5 hidden sm:table-cell pr-2 font-medium text-slate-400 truncate max-w-[160px]" title={admin.name}>
                        {admin.name}
                      </td>
                      <td className="py-3.5 hidden md:table-cell pr-2 font-medium text-slate-400">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-mono">{admin.phone || '—'}</span>
                          <span className="text-[9px] uppercase font-bold text-slate-500">{admin.unit || '—'}</span>
                        </div>
                      </td>
                      <td className="py-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          admin.role === 'master' || admin.email === 'allanjonesms@gmail.com'
                            ? 'bg-amber-950 text-amber-400 border border-amber-900/50'
                            : 'bg-slate-900 text-slate-400 border border-slate-800'
                        }`}>
                          {admin.role === 'master' || admin.email === 'allanjonesms@gmail.com' ? 'MASTER' : 'ADMIN'}
                        </span>
                      </td>
                      <td className="py-3.5 text-center">
                        <button
                          onClick={() => handleToggleStatus(admin)}
                          disabled={admin.email === 'allanjonesms@gmail.com' || actionLoading !== null}
                          className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border tracking-wider transition-all cursor-pointer ${
                            admin.status === 'Ativo'
                              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-900 hover:bg-emerald-900/40'
                              : 'bg-red-950/80 text-red-400 border-red-950 hover:bg-red-900/40'
                          } ${admin.email === 'allanjonesms@gmail.com' ? 'opacity-80 cursor-not-allowed' : ''}`}
                        >
                          {actionLoading === `status-${admin.email}` ? (
                            <Loader2 className="w-2.5 h-2.5 animate-spin mx-auto" />
                          ) : (
                            admin.status
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {admin.email !== 'allanjonesms@gmail.com' ? (
                            <>
                              <button
                                onClick={() => handleEditAdminClick(admin)}
                                disabled={actionLoading !== null}
                                title="Editar administrador"
                                className="p-1 px-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 hover:text-slate-300 rounded-md text-slate-400 cursor-pointer transition-colors"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                              </button>
                              <button
                                onClick={() => handleDeleteAdmin(admin.email)}
                                disabled={actionLoading !== null}
                                title="Excluir acesso deste administrador"
                                className="p-1 px-2.5 bg-slate-900 hover:bg-red-950/40 border border-slate-800 hover:border-red-900 hover:text-red-400 rounded-md text-slate-400 cursor-pointer transition-colors"
                              >
                                {actionLoading === `delete-${admin.email}` ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-600 select-none italic pr-1">Imutável</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {adminsList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 italic">
                        Nenhum administrador encontrado ou cadastrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ➕ ADD NEW ADMINISTRATOR FORM (4 COLS) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-950 rounded-3xl border border-slate-850 p-5 shadow-xl space-y-4">
            <h3 className="text-xs font-black text-slate-100 uppercase tracking-widest flex items-center gap-1.5 pb-3 border-b border-slate-850">
              <UserPlus className="w-4.5 h-4.5 text-emerald-450" />
              {isEditingAdmin ? 'Editar Administrador' : 'Adicionar Administrador'}
            </h3>

            <form onSubmit={handleAddAdmin} className="space-y-4">
              
              <div>
                <label className="block text-[10px] text-slate-400 font-extrabold uppercase mb-1 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-slate-500" />
                  E-mail Google
                </label>
                <input
                  type="email"
                  required
                  value={newAdminForm.email}
                  disabled={actionLoading !== null || isEditingAdmin}
                  onChange={(e) => setNewAdminForm({...newAdminForm, email: e.target.value})}
                  placeholder="exemplo@gmail.com"
                  className="w-full text-xs bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-extrabold uppercase mb-1 flex items-center gap-1">
                  <UserIcon className="w-3 h-3 text-slate-500" />
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={newAdminForm.name}
                  disabled={actionLoading !== null}
                  onChange={(e) => setNewAdminForm({...newAdminForm, name: e.target.value})}
                  placeholder="Ex: Tenente PM Souza"
                  className="w-full text-xs bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-extrabold uppercase mb-1 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-slate-500" />
                  Telefone
                </label>
                <input
                  type="text"
                  value={newAdminForm.phone}
                  disabled={actionLoading !== null}
                  onChange={(e) => setNewAdminForm({...newAdminForm, phone: e.target.value})}
                  placeholder="(00) 00000-0000"
                  className="w-full text-xs bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-extrabold uppercase mb-1 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-slate-500" />
                  Unidade
                </label>
                <select
                  value={newAdminForm.unit}
                  disabled={actionLoading !== null}
                  onChange={(e) => setNewAdminForm({...newAdminForm, unit: e.target.value})}
                  className="w-full text-xs font-bold bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-slate-200"
                >
                  <option value="COXIM">COXIM</option>
                  <option value="RIO VERDE">RIO VERDE</option>
                  <option value="ALCINÓPOLIS">ALCINÓPOLIS</option>
                  <option value="SONORA">SONORA</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-extrabold uppercase mb-1 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-slate-500" />
                  Nível de Acesso (Papel)
                </label>
                <select
                  value={newAdminForm.role}
                  disabled={actionLoading !== null}
                  onChange={(e) => setNewAdminForm({...newAdminForm, role: e.target.value})}
                  className="w-full text-xs font-bold bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-slate-200"
                >
                  <option value="admin">Administrador Geral</option>
                  <option value="master">Administrador Master</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-extrabold uppercase mb-1 flex items-center gap-1">
                  <Power className="w-3 h-3 text-slate-500" />
                  Status Inicial
                </label>
                <select
                  value={newAdminForm.status}
                  disabled={actionLoading !== null}
                  onChange={(e) => setNewAdminForm({...newAdminForm, status: e.target.value as 'Ativo' | 'Inativo'})}
                  className="w-full text-xs font-bold bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-slate-200"
                >
                  <option value="Ativo">Ativo (Permite Login Nativamente)</option>
                  <option value="Inativo">Inativo (Bloqueado)</option>
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={actionLoading !== null}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold tracking-wide uppercase text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading === 'creating' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      {isEditingAdmin ? 'Atualizar' : 'Registrar'}
                    </>
                  )}
                </button>
                {isEditingAdmin && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={actionLoading !== null}
                    className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold tracking-wide uppercase text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                )}
              </div>

            </form>
          </div>

          {/* Guidelines notes */}
          <div className="bg-slate-950/40 p-4 rounded-3xl border border-slate-850 text-[11px] text-slate-400 leading-relaxed space-y-2">
            <span className="font-extrabold text-slate-300 block flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              Invariante de Segurança
            </span>
            <p>
              Qualquer credencial criada requer autenticação de e-mail verificado pela Conta Google. O email cadastrado deve corresponder perfeitamente ao email do usuário no Google Sign-In.
            </p>
            <p>
              O e-mail <strong>allanjonesms@gmail.com</strong> possui privilégios estáticos de Administrador Master definidos no servidor e nas regras de segurança do banco de dados, protegidos contra edição e exclusão involuntárias.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
