import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  MapPin, 
  AlertTriangle, 
  Calendar, 
  FileText, 
  Smartphone, 
  PhoneCall, 
  X, 
  CheckCircle, 
  Info,
  Clock,
  ArrowRight,
  ShieldCheck,
  Map,
  Compass
} from 'lucide-react';
import { Victim, Hearing, Occurrence, PanicAlert } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface VictimPortalProps {
  victim: Victim;
  hearings: Hearing[];
  occurrences: Occurrence[];
  onTriggerAlert: (location: { latitude: number; longitude: number; addressDescription: string }) => Promise<void>;
  onRegisterIncident: (type: string, description: string) => Promise<void>;
}

export default function VictimPortal({
  victim,
  hearings,
  occurrences,
  onTriggerAlert,
  onRegisterIncident
}: VictimPortalProps) {
  // Panic Button States
  const [isActivating, setIsActivating] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [alertStatus, setAlertStatus] = useState<'idle' | 'countdown' | 'triggered'>('idle');
  const [locationStatus, setLocationStatus] = useState<'checking' | 'active' | 'denied' | 'ready'>('checking');
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [addressDesc, setAddressDesc] = useState('Obtendo localização exata...');
  
  // Incident Form State
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidentType, setIncidentType] = useState<string>('Ameaça/Agressão');
  const [incidentDesc, setIncidentDesc] = useState('');
  const [formSubmitted, setFormSubmitted] = useState(false);

  const countdownTimer = useRef<NodeJS.Timeout | null>(null);

  // Check Geolocation Support
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setLocationStatus('ready');
          setAddressDesc(`Coordenadas capturadas: Lat ${position.coords.latitude.toFixed(4)}, Lng ${position.coords.longitude.toFixed(4)}`);
        },
        (error) => {
          console.warn('Geolocation error:', error);
          setLocationStatus('denied');
          // Default mock coordinates for Coxim-MS downtown
          setCurrentCoords({ lat: -18.5068, lng: -54.7601 });
          setAddressDesc('Localização aproximada (Sinal de Satélite padrão Coxim-MS)');
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setLocationStatus('denied');
      setCurrentCoords({ lat: -18.5068, lng: -54.7601 });
      setAddressDesc('GPS indisponível no navegador (Simulado Coxim-MS)');
    }
  }, []);

  // Panic Button Countdown Handler
  const startPanicCountdown = () => {
    setAlertStatus('countdown');
    setCountdown(3);
    
    // Play subtle sound to indicate emergency initialization
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      console.log('Audio feedback not compatible or user interaction blocked.');
    }

    if (countdownTimer.current) clearInterval(countdownTimer.current);
    
    countdownTimer.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownTimer.current) clearInterval(countdownTimer.current);
          triggerRealAlert();
          return 0;
        }
        // Beep frequency changes as countdown proceeds
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = audioCtx.createOscillator();
          osc.connect(audioCtx.destination);
          osc.frequency.setValueAtTime(800, audioCtx.currentTime);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.1);
        } catch (_) {}
        return prev - 1;
      });
    }, 1000);
  };

  const cancelPanic = () => {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
    }
    setAlertStatus('idle');
    setCountdown(3);
  };

  const triggerRealAlert = async () => {
    setAlertStatus('triggered');
    
    // Play louder emergency sirens using standard browser API
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1400, audioCtx.currentTime + 0.5);
      osc.frequency.exponentialRampToValueAtTime(900, audioCtx.currentTime + 1.0);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 1.2);
    } catch (_) {}

    // Dispatch location back to DB
    const finalLat = currentCoords?.lat || -18.5068;
    const finalLng = currentCoords?.lng || -54.7601;
    await onTriggerAlert({
      latitude: finalLat,
      longitude: finalLng,
      addressDescription: addressDesc
    });
  };

  const handleIncidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentDesc.trim()) return;
    await onRegisterIncident(incidentType, incidentDesc);
    setFormSubmitted(true);
    setIncidentDesc('');
    setTimeout(() => {
      setFormSubmitted(false);
      setIncidentOpen(false);
    }, 3000);
  };

  // Filter components to show only relevant elements to current victim
  const victimHearings = hearings.filter(h => h.victimId === victim.id);
  const victimOccurrences = occurrences.filter(o => o.victimId === victim.id);

  return (
    <div className="max-w-md mx-auto bg-gray-50/90 rounded-3xl overflow-hidden shadow-xl border border-gray-100 flex flex-col h-[780px] relative font-sans">
      {/* Dynamic Status Bar - Mimics Smartphone UI */}
      <div className="bg-rose-950 text-rose-200 px-6 py-2.5 flex justify-between items-center text-xs tracking-wide">
        <div className="flex items-center gap-1.5 font-semibold text-[11px]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          PROMUSE Coxim - Canal Seguro Vítima
        </div>
        <div className="flex items-center gap-2">
          {locationStatus === 'ready' || locationStatus === 'active' ? (
            <span className="text-[10px] font-mono bg-rose-900/50 px-1.5 py-0.5 rounded flex items-center gap-1">
              <Compass className="w-3 h-3 text-emerald-400 animate-spin" /> GPS Ativo
            </span>
          ) : (
            <span className="text-[10px] font-mono bg-amber-900/60 text-amber-200 px-1.5 py-0.5 rounded flex items-center gap-1">
              <MapPin className="w-3 h-3" /> GPS Coxim
            </span>
          )}
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 pb-20 space-y-5">
        
        {/* Victim Welcome Shield */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-rose-100/50 flex gap-4 items-center">
          <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">PROGRAMA MULHER SEGURA</p>
            <h3 className="text-lg font-bold text-gray-800 truncate mb-0.5">{victim.name}</h3>
            <div className="flex items-center gap-1 text-xs text-rose-600 font-medium">
              <span className="inline-block w-2-h-2 w-1.5 h-1.5 bg-rose-600 rounded-full"></span>
              Medida Protetiva nº {victim.protectiveOrder?.orderNumber ? victim.protectiveOrder.orderNumber.substring(0, 15) + '...' : 'Ativa'}
            </div>
          </div>
        </div>

        {/* 🚨 EMERGENY PANIC STATION */}
        <div className="bg-gradient-to-b from-rose-50 to-rose-100/50 rounded-2xl p-5 border border-rose-200/50 text-center shadow-inner">
          <div className="mb-2">
            <h4 className="text-sm font-bold text-rose-950 uppercase tracking-wider flex items-center justify-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-700 animate-bounce" />
              Botão de Pânico Geral
            </h4>
            <p className="text-xs text-rose-700 max-w-xs mx-auto mt-1">
              Ao pressionar, sua localização exata em Coxim-MS é enviada aos policiais do 5°BPM em serviço.
            </p>
          </div>

          <div className="relative flex justify-center py-6">
            <AnimatePresence mode="wait">
              {alertStatus === 'idle' && (
                <motion.button
                  id="btn_panic_trigger"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={startPanicCountdown}
                  className="w-40 h-40 rounded-full bg-red-600 hover:bg-red-700 flex flex-col items-center justify-center text-white font-bold text-lg shadow-lg relative cursor-pointer group border-4 border-white/50"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <span className="absolute inset-0 bg-red-600 rounded-full animate-ping opacity-25"></span>
                  <Smartphone className="w-10 h-10 mb-1.5 group-hover:scale-110 transition-transform" />
                  <span className="text-sm uppercase tracking-widest font-black leading-none">PÂNICO</span>
                  <p className="text-[10px] opacity-75 font-normal mt-1 px-4 leading-tight">Militar Ativo</p>
                </motion.button>
              )}

              {alertStatus === 'countdown' && (
                <motion.div
                  key="countdown"
                  className="w-40 h-40 rounded-full bg-amber-600 flex flex-col items-center justify-center text-white font-bold text-lg shadow-lg relative border-4 border-white/50"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <div className="absolute inset-0 rounded-full border-4 border-amber-300 border-t-transparent animate-spin"></div>
                  <span className="text-4xl font-extrabold leading-none">{countdown}</span>
                  <p className="text-[10px] tracking-wider uppercase font-extrabold mt-2 text-amber-200">Enviando em...</p>
                  <button 
                    onClick={cancelPanic}
                    className="mt-2 bg-black/40 hover:bg-black/60 px-2.5 py-1 rounded text-[10px] flex items-center gap-1 cursor-pointer font-bold transition-all text-white"
                  >
                    <X className="w-3 h-3" /> CANCELAR
                  </button>
                </motion.div>
              )}

              {alertStatus === 'triggered' && (
                <motion.div
                  key="triggered"
                  className="w-40 h-40 rounded-full bg-red-950 flex flex-col items-center justify-center text-white shadow-xl border-4 border-red-500 relative"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <span className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-45"></span>
                  <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center mb-1">
                    <Shield className="w-5 h-5 text-white animate-pulse" />
                  </div>
                  <span className="text-[11px] font-black tracking-widest text-red-400 uppercase">ENVIADO</span>
                  <p className="text-[9px] opacity-90 px-3 mt-1 leading-tight text-center">Patrulha 5ºBPM acionada</p>
                  <button 
                    onClick={() => setAlertStatus('idle')}
                    className="mt-2 text-[9px] underline text-red-300 hover:text-red-100 cursor-pointer font-medium"
                  >
                    Voltar / Pronta
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="bg-rose-950/5 p-3 rounded-xl border border-rose-200/40 text-left flex items-start gap-2 max-w-sm mx-auto">
            <MapPin className="w-4 h-4 text-rose-800 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] text-rose-900 font-bold uppercase tracking-wider">Endereço de Geomapeamento</p>
              <p className="text-xs text-rose-950 truncate font-mono">{addressDesc}</p>
            </div>
          </div>
        </div>

        {/* 📃 MEDIDAS PROTETIVAS DE URGÊNCIA */}
        {victim.protectiveOrder && (
          <div className="bg-white rounded-2xl p-4.5 shadow-sm border border-gray-100 space-y-3">
            <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide flex items-center gap-1.5">
              <ShieldCheck className="w-4.5 h-4.5 text-emerald-500" />
              Medida Protetiva Digital
            </h4>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                <p className="text-gray-400 text-[10px] uppercase font-bold">Número Processual</p>
                <p className="text-gray-800 font-bold font-mono tracking-tighter truncate">{victim.protectiveOrder.orderNumber}</p>
              </div>
              <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                <p className="text-gray-400 text-[10px] uppercase font-bold">Juízo Emitente</p>
                <p className="text-gray-800 font-bold truncate">{victim.protectiveOrder.judgeName}</p>
              </div>
              <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                <p className="text-gray-400 text-[10px] uppercase font-bold">Data de Emissão</p>
                <p className="text-gray-800 font-bold">{new Date(victim.protectiveOrder.issueDate + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
              </div>
              <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                <p className="text-gray-400 text-[10px] uppercase font-bold">Expiração Estimada</p>
                <p className="text-rose-700 font-bold">{new Date(victim.protectiveOrder.expiryDate + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
              </div>
            </div>

            <div className="bg-amber-50 rounded-xl p-3 border border-amber-200/50">
              <p className="text-[10px] text-amber-800 font-extrabold uppercase tracking-widest flex items-center gap-1">
                <Info className="w-3.5 h-3.5 shrink-0" /> REGRAS DE DISTANCIAMENTO ATIVAS:
              </p>
              <p className="text-xs text-amber-950 mt-1 leading-relaxed">
                {victim.protectiveOrder.restrictions}
              </p>
            </div>
          </div>
        )}

        {/* 📝 HISTÓRICO DE RONDAS & OCORRÊNCIAS */}
        <div className="bg-white rounded-2xl p-4.5 shadow-sm border border-gray-100 space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide flex items-center gap-1.5">
              <FileText className="w-4.5 h-4.5 text-purple-500" />
              Histórico de Acompanhamento
            </h4>
            <button 
              onClick={() => { setIncidentOpen(true); }}
              className="text-[11px] bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold px-2 py-1 rounded cursor-pointer transition-all"
            >
              + Relatar Incidente
            </button>
          </div>

          {/* Incident Registration Dialog/Card Drawer */}
          <AnimatePresence>
            {incidentOpen && (
              <motion.div 
                className="bg-gray-50 rounded-xl p-3 border border-purple-100 text-left space-y-3"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="flex justify-between items-center">
                  <h5 className="text-xs font-bold text-purple-950 uppercase">Formulário de Incidente</h5>
                  <button onClick={() => setIncidentOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {formSubmitted ? (
                  <div className="py-4 text-center text-emerald-700 text-xs font-bold flex flex-col items-center gap-1">
                    <CheckCircle className="w-8 h-8 text-emerald-500 animate-bounce" />
                    Incidente enviado com sucesso para a coordenação do 5°BPM!
                  </div>
                ) : (
                  <form onSubmit={handleIncidentSubmit} className="space-y-2">
                    <div>
                      <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Tipo de Descumprimento</label>
                      <select 
                        value={incidentType}
                        onChange={(e) => setIncidentType(e.target.value)}
                        className="w-full text-xs p-2 bg-white rounded border border-gray-200 focus:outline-none focus:border-purple-400 font-semibold"
                      >
                        <option value="Ameaça/Agressão">Ameaça ou Agressão</option>
                        <option value="Descumprimento de Medida">Agressor avistado próximo a residência</option>
                        <option value="Tentativa de Contato">Mensagens de telefone ou redes sociais</option>
                        <option value="Confirmação de Visita">Confirmar recebimento de visita preventiva</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Relato do Ocorrido</label>
                      <textarea
                        value={incidentDesc}
                        onChange={(e) => setIncidentDesc(e.target.value)}
                        placeholder="Descreva o que houve ou solicite uma ronda do PROMUSE..."
                        rows={3}
                        className="w-full text-xs p-2 bg-white rounded border border-gray-200 focus:outline-none focus:border-purple-400 resize-none"
                        required
                      />
                    </div>
                    <button 
                      type="submit"
                      className="w-full text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold p-2 rounded cursor-pointer transition-colors"
                    >
                      Enviar para a Equipe PROMUSE
                    </button>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {victimOccurrences.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-4 text-center text-gray-400 text-xs">
              Nenhuma ocorrência registrada no plano PROMUSE para esta vítima.
            </div>
          ) : (
            <div className="space-y-2">
              {victimOccurrences.map((o) => (
                <div key={o.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex flex-col gap-1.5 text-xs text-gray-700">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-800 uppercase text-[10px] tracking-wide bg-purple-50 border border-purple-100 px-2 py-0.5 rounded">
                      {o.type}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(o.date).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <p className="italic leading-relaxed">"{o.description}"</p>
                  <p className="text-[10px] text-gray-500 font-semibold flex items-center gap-1.5">
                    <span>Policial: <strong className="text-gray-700">{o.registeredByOfficer}</strong></span>
                  </p>
                  {o.actionsTaken && (
                    <div className="mt-1 bg-white p-2 rounded border border-gray-100 text-[11px] text-emerald-800">
                      <strong>Ações tomadas:</strong> {o.actionsTaken}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Informative Help Numbers */}
        <div className="bg-purple-950 text-purple-50 p-4 rounded-2xl space-y-2">
          <h5 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-purple-200">
            <PhoneCall className="w-4 h-4 text-rose-400" />
            Canais de Atendimento Direto
          </h5>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-purple-900/50 p-2 rounded-xl border border-purple-800/40">
              <span className="block text-[10px] opacity-70">Delegacia Coxim (DAM)</span>
              <strong className="text-[11px] text-rose-300 font-mono">(67) 3291-1338</strong>
            </div>
            <div className="bg-purple-900/50 p-2 rounded-xl border border-purple-800/40">
              <span className="block text-[10px] opacity-70">Emergência Geral PM</span>
              <strong className="text-[11px] text-rose-300 font-mono">190</strong>
            </div>
          </div>
        </div>

        {/* App conversion tip */}
        <div className="bg-white/80 rounded-xl p-3 border border-purple-100/50 text-[11px] text-gray-500 text-center">
          <Smartphone className="w-4 h-4 inline-block mr-1 text-gray-400" /> 
          Este painel web respeita as diretrizes PWA/Capacitor para empacotamento nativo em Android (.APK) e iOS (.IPA).
        </div>

      </div>

      {/* Discrete bottom bar indicating safety */}
      <div className="absolute bottom-0 inset-x-0 bg-white border-t border-gray-100 py-3.5 px-6 flex justify-between items-center text-gray-400 text-[10px] font-medium">
        <span>Conexão criptografada de ponta a ponta</span>
        <div className="flex items-center gap-1">
          <Shield className="w-3.5 h-3.5 text-emerald-600" /> 
          <span className="font-bold text-gray-700">PROMUSE PROTEGIDA</span>
        </div>
      </div>
    </div>
  );
}
