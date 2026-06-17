import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { AppDB, Victim, PanicAlert, Occurrence } from './src/types';

const PORT = 3000;
const DB_FILE_PATH = path.join(process.cwd(), 'promuse_db.json');

// Initialize Seed Data
const defaultDB: AppDB = {
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
      createdAt: '2026-01-15T10:00:00.000Z',
      protectiveOrder: {
        id: 'ord_1',
        orderNumber: '0001423-45.2026.8.12.0011',
        issueDate: '2026-01-16',
        expiryDate: '2026-07-16',
        judgeName: 'Dr. Cláudio Müller Pareja',
        restrictions: 'Proibição de aproximação física (mínimo de 300 metros) e proibição de qualquer tipo de contato por telefone, redes sociais ou terceiros.',
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
      createdAt: '2026-02-10T14:30:00.000Z',
      protectiveOrder: {
        id: 'ord_2',
        orderNumber: '0002891-12.2026.8.12.0011',
        issueDate: '2026-02-12',
        expiryDate: '2026-08-12',
        judgeName: 'Dra. Tatiana Dias de Oliveira',
        restrictions: 'Proibição de aproximação física (mínimo de 200 metros) do local de residência e do local de trabalho da vítima.',
        status: 'Ativa'
      }
    },
    {
      id: 'vit_3',
      name: 'Sandra Regina Medeiros',
      cpf: '345.987.654-88',
      phone: '(67) 99234-9876',
      address: 'Rua Márcio Lima, 88, Vila São Paulo, Coxim-MS',
      riskLevel: 'Alto',
      policeOfficerInCharge: 'Sgt PM Anderson',
      assignedPatrol: 'VTR PROMUSE 5042',
      createdAt: '2026-03-01T09:15:00.000Z',
      protectiveOrder: {
        id: 'ord_3',
        orderNumber: '0003112-90.2026.8.12.0011',
        issueDate: '2026-03-02',
        expiryDate: '2026-09-02',
        judgeName: 'Dr. Cláudio Müller Pareja',
        restrictions: 'Afastamento imediato do lar conjugal do agressor, proibição de contato por qualquer meio de comunicação e limite físico de 500 metros.',
        status: 'Ativa'
      }
    },
    {
      id: 'vit_4',
      name: 'Patrícia Oliveira Souza',
      cpf: '231.543.876-45',
      phone: '(67) 99654-3210',
      address: 'Rua Filinto Müller, 230, Centro, Coxim-MS',
      riskLevel: 'Baixo',
      policeOfficerInCharge: 'Cb PM Fernanda',
      assignedPatrol: 'VTR PROMUSE 5040',
      createdAt: '2026-04-18T16:45:00.000Z',
      protectiveOrder: {
        id: 'ord_4',
        orderNumber: '0004561-18.2026.8.12.0011',
        issueDate: '2026-04-20',
        expiryDate: '2026-10-20',
        judgeName: 'Dra. Tatiana Dias de Oliveira',
        restrictions: 'Proibição de aproximação do local de trabalho e residência da vítima em menos de 150 metros.',
        status: 'Ativa'
      }
    }
  ],
  panicAlerts: [
    {
      id: 'alert_pre_1',
      victimId: 'vit_3',
      victimName: 'Sandra Regina Medeiros',
      victimPhone: '(67) 99234-9876',
      requestTime: '2026-05-19T21:10:00.000Z',
      location: {
        latitude: -18.5085,
        longitude: -54.7582,
        addressDescription: 'Perto da Vila São Paulo, Coxim-MS (Próximo à quadra de esportes)'
      },
      status: 'Resolvido',
      dispatcherComments: 'Agressor avistado rondando a casa. Guarnição da VTR PROMUSE 5042 deslocou rapidamente, abordou o cidadão e efetuou a prisão por descumprimento de medida protetiva.'
    },
    {
      id: 'alert_pre_2',
      victimId: 'vit_1',
      victimName: 'Maria Eduarda Silva',
      victimPhone: '(67) 99876-5432',
      requestTime: '2026-05-20T10:30:00.000Z',
      location: {
        latitude: -18.5042,
        longitude: -54.7615,
        addressDescription: 'Bairro Senhor Divino, próximo ao Posto de Saúde'
      },
      status: 'Resolvido',
      dispatcherComments: 'Vítima acionou o botão por engano enquanto limpava a tela do celular. Guarnição fez contato telefônico e visita presencial preventiva para confirmação. Tudo sob controle.'
    }
  ],
  occurrences: [
    {
      id: 'occ_1',
      victimId: 'vit_1',
      victimName: 'Maria Eduarda Silva',
      date: '2026-05-15T09:00:00.000Z',
      type: 'Visita Preventiva',
      description: 'Visita periódica da equipe PROMUSE de Coxim para acompanhamento. Vítima relata que o agressor não tentou contato e se sente segura com o patrulhamento frequente.',
      registeredByOfficer: 'Sgt PM Anderson',
      actionsTaken: 'Registrado relatório de visita positiva no sistema e reforçados os canais de contato emergencial.'
    },
    {
      id: 'occ_2',
      victimId: 'vit_2',
      victimName: 'Ana Júlia Santos',
      date: '2026-05-17T15:30:00.000Z',
      type: 'Ronda PROMUSE',
      description: 'Fiscalização de rota preventiva ao redor da residência e comércio de trabalho da vítima. Nenhum suspeito avistado nas imediações.',
      registeredByOfficer: 'Cb PM Fernanda',
      actionsTaken: 'Envio de mensagem SMS para a vítima informando sobre a ronda preventiva.'
    },
    {
      id: 'occ_3',
      victimId: 'vit_1',
      victimName: 'Maria Eduarda Silva',
      date: '2026-05-18T18:40:00.000Z',
      type: 'Descumprimento de Medida',
      description: 'Agressor tentou enviar mensagens de ameaça usando número anônimo através do WhatsApp.',
      registeredByOfficer: 'Sgt PM Anderson',
      actionsTaken: 'Prints das telas anexados ao histórico. Orientada a vítima a lavrar boletim de ocorrência complementar na Delegacia da Mulher (DAM) Coxim.'
    }
  ],
  hearings: []
};

// Database read helper
function readDB(): AppDB {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const data = fs.readFileSync(DB_FILE_PATH, 'utf8');
      return JSON.parse(data) as AppDB;
    } else {
      writeDB(defaultDB);
      return defaultDB;
    }
  } catch (error) {
    console.error('Error reading system database file:', error);
    return defaultDB;
  }
}

// Database write helper
function writeDB(db: AppDB) {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing system database file:', error);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // Ensure DB gets seeded immediately on startup
  readDB();

  // ----- GEMINI PDF EXTRACTION -----
  app.post('/api/parse-pdf', async (req, res) => {
    try {
      const { pdfBase64 } = req.body;
      if (!pdfBase64) {
        return res.status(400).json({ error: 'Nenhum PDF enviado.' });
      }

      // We initialize the GoogleGenAI client here to ensure it uses the server env variable
      const { GoogleGenAI, Type } = await import('@google/genai');
      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      let response;
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: {
            parts: [
              {
                inlineData: {
                  data: pdfBase64,
                  mimeType: "application/pdf"
                }
              },
              {
                text: "Você é um assistente de IA perito em ler Medidas Protetivas de Urgência (MPU) decretadas no Brasil (TJMS, etc.). Analise minuciosamente o documento PDF anexo e extraia os dados necessários com extrema precisão:\n\n1. Nome da vítima (ofendida/requerente/assistida).\n2. Nome do réu (agressor/requerido/autor do fato).\n3. Número do processo/ordem extraído (ex: xxxxxxx-xx.xxxx.8.12.xxxx).\n4. Nome do Magistrado/Juiz prolator da sentença.\n5. Data da decisão/emissão (formato AAAA-MM-DD).\n6. Data de expiração (se descrita, senão preveja uma data padrão de 180 dias a contar da expedição, formato AAAA-MM-DD).\n7. Resumo simples e inteligível em português sobre as restrições impostas ao agressor (ex: distanciamento de no mínimo 300m, proibição de contato, afastamento do lar)."
              }
            ]
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                victimName: { type: Type.STRING, description: "Nome completo da vítima sem abreviações" },
                defendantName: { type: Type.STRING, description: "Nome completo do réu/agressor sem abreviações" },
                orderNumber: { type: Type.STRING, description: "Número completo do processo judicial no padrão CNJ" },
                issueDate: { type: Type.STRING, description: "Data de expedição ou assinatura da decisão (AAAA-MM-DD)" },
                expiryDate: { type: Type.STRING, description: "Data de expiração das medidas (AAAA-MM-DD)" },
                judgeName: { type: Type.STRING, description: "Nome do Juiz ou Juíza de Direito prolator da decisão" },
                restrictions: { type: Type.STRING, description: "Texto sintetizado com as restrições impostas" }
              },
              required: ["victimName", "defendantName", "orderNumber", "issueDate", "judgeName", "restrictions"]
            }
          }
        });
      } catch (firstError: any) {
        console.warn('Primary Gemini model (gemini-3.5-flash) failed, attempting fallback to gemini-3.1-flash-lite:', firstError);
        try {
          response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: {
              parts: [
                {
                  inlineData: {
                    data: pdfBase64,
                    mimeType: "application/pdf"
                  }
                },
                {
                  text: "Você é um assistente de IA perito em ler Medidas Protetivas de Urgência (MPU) decretadas no Brasil (TJMS, etc.). Analise minuciosamente o documento PDF anexo e extraia os dados necessários com extrema precisão:\n\n1. Nome da vítima (ofendida/requerente/assistida).\n2. Nome do réu (agressor/requerido/autor do fato).\n3. Número do processo/ordem extraído (ex: xxxxxxx-xx.xxxx.8.12.xxxx).\n4. Nome do Magistrado/Juiz prolator da sentença.\n5. Data da decisão/emissão (formato AAAA-MM-DD).\n6. Data de expiração (se descrita, senão preveja uma data padrão de 180 dias a contar da expedição, formato AAAA-MM-DD).\n7. Resumo simples e inteligível em português sobre as restrições impostas ao agressor (ex: distanciamento de no mínimo 300m, proibição de contato, afastamento do lar)."
                }
              ]
            },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  victimName: { type: Type.STRING, description: "Nome completo da vítima sem abreviações" },
                  defendantName: { type: Type.STRING, description: "Nome completo do réu/agressor sem abreviações" },
                  orderNumber: { type: Type.STRING, description: "Número completo do processo judicial no padrão CNJ" },
                  issueDate: { type: Type.STRING, description: "Data de expedição ou assinatura da decisão (AAAA-MM-DD)" },
                  expiryDate: { type: Type.STRING, description: "Data de expiração das medidas (AAAA-MM-DD)" },
                  judgeName: { type: Type.STRING, description: "Nome do Juiz ou Juíza de Direito prolator da decisão" },
                  restrictions: { type: Type.STRING, description: "Texto sintetizado com as restrições impostas" }
                },
                required: ["victimName", "defendantName", "orderNumber", "issueDate", "judgeName", "restrictions"]
              }
            }
          });
        } catch (secondError: any) {
          console.error('Secondary Gemini model (gemini-3.1-flash-lite) also failed:', secondError);
          throw new Error('Falha no processamento por IA devido à alta demanda global nos servidores da Google. Por favor, tente novamente em alguns instantes ou realize o cadastro manual. Detalhes: ' + secondError.message);
        }
      }
      
      const text = response.text || "{}";
      const data = JSON.parse(text);
      res.json(data);
    } catch (e: any) {
      console.error('Gemini error:', e);
      res.status(500).json({ error: 'Falha ao processar o PDF com IA. ' + e.message });
    }
  });

  // API Endpoints
  app.get('/api/db', (req, res) => {
    try {
      const db = readDB();
      res.json(db);
    } catch (e) {
      res.status(500).json({ error: 'Erro ao carregar o banco de dados.' });
    }
  });

  // Reset/Seed Database Endpoint
  app.post('/api/reset', (req, res) => {
    try {
      writeDB(defaultDB);
      res.json({ message: 'Banco de dados restaurado com sucesso!', db: defaultDB });
    } catch (e) {
      res.status(500).json({ error: 'Erro ao reiniciar banco de dados.' });
    }
  });

  // Victim Endpoints
  app.post('/api/victims', (req, res) => {
    try {
      const db = readDB();
      const newVictim: Victim = {
        id: req.body.id || 'vit_' + Date.now(),
        name: req.body.name,
        cpf: req.body.cpf,
        phone: req.body.phone,
        address: req.body.address,
        riskLevel: req.body.riskLevel || 'Baixo',
        policeOfficerInCharge: req.body.policeOfficerInCharge || 'A definir',
        assignedPatrol: req.body.assignedPatrol || 'A definir',
        createdAt: req.body.createdAt || new Date().toISOString(),
        protectiveOrder: req.body.protectiveOrder ? {
          id: req.body.protectiveOrder.id || 'ord_' + Date.now(),
          orderNumber: req.body.protectiveOrder.orderNumber || '00000-00.2026.8.12.0011',
          defendantName: req.body.protectiveOrder.defendantName,
          issueDate: req.body.protectiveOrder.issueDate || new Date().toISOString().split('T')[0],
          expiryDate: req.body.protectiveOrder.expiryDate || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          judgeName: req.body.protectiveOrder.judgeName || 'Juiz Titular Coxim',
          restrictions: req.body.protectiveOrder.restrictions || 'Medidas protetivas padrão impostas pelo juízo.',
          status: 'Ativa'
        } : undefined
      };

      db.victims.push(newVictim);
      writeDB(db);
      res.status(201).json(newVictim);
    } catch (e) {
      res.status(500).json({ error: 'Erro ao cadastrar vítima.' });
    }
  });

  app.put('/api/victims/:id', (req, res) => {
    try {
      const db = readDB();
      const index = db.victims.findIndex(v => v.id === req.params.id);
      if (index === -1) {
        return res.status(404).json({ error: 'Vítima não encontrada.' });
      }

      // Merge values
      const existing = db.victims[index];
      const updated: Victim = {
        ...existing,
        name: req.body.name !== undefined ? req.body.name : existing.name,
        cpf: req.body.cpf !== undefined ? req.body.cpf : existing.cpf,
        phone: req.body.phone !== undefined ? req.body.phone : existing.phone,
        address: req.body.address !== undefined ? req.body.address : existing.address,
        riskLevel: req.body.riskLevel !== undefined ? req.body.riskLevel : existing.riskLevel,
        policeOfficerInCharge: req.body.policeOfficerInCharge !== undefined ? req.body.policeOfficerInCharge : existing.policeOfficerInCharge,
        assignedPatrol: req.body.assignedPatrol !== undefined ? req.body.assignedPatrol : existing.assignedPatrol,
        protectiveOrder: req.body.protectiveOrder !== undefined ? req.body.protectiveOrder : existing.protectiveOrder
      };

      db.victims[index] = updated;

      // Automatically sync victim details in occurrences or other structures if necessary
      db.occurrences = db.occurrences.map(o => {
        if (o.victimId === updated.id) {
          return { ...o, victimName: updated.name };
        }
        return o;
      });

      db.hearings = db.hearings.map(h => {
        if (h.victimId === updated.id) {
          return { ...h, victimName: updated.name };
        }
        return h;
      });

      writeDB(db);
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: 'Erro ao atualizar vítima.' });
    }
  });

  app.delete('/api/victims/:id', (req, res) => {
    try {
      const db = readDB();
      db.victims = db.victims.filter(v => v.id !== req.params.id);
      // Clean up dependencies or leave for history? Better keep logs for audits
      writeDB(db);
      res.json({ message: 'Vítima excluída com sucesso!' });
    } catch (e) {
      res.status(500).json({ error: 'Erro ao excluir vítima.' });
    }
  });

  // Panic button alert activation trigger
  app.post('/api/alerts', (req, res) => {
    try {
      const db = readDB();
      const victimId = req.body.victimId;
      const victim = db.victims.find(v => v.id === victimId);

      const newAlert: PanicAlert = {
        id: 'alt_' + Date.now(),
        victimId: victimId || 'anonima',
        victimName: victim ? victim.name : req.body.victimName || 'Não identificada',
        victimPhone: victim ? victim.phone : req.body.victimPhone || '(67) Emergência',
        requestTime: new Date().toISOString(),
        location: {
          latitude: req.body.location?.latitude || -18.5068,
          longitude: req.body.location?.longitude || -54.7601,
          addressDescription: req.body.location?.addressDescription || 'Localização obtida por satélite (GPS)'
        },
        status: 'Ativo',
        dispatcherComments: ''
      };

      db.panicAlerts.unshift(newAlert); // Newest alerts come first
      writeDB(db);
      res.status(201).json(newAlert);
    } catch (e) {
      res.status(500).json({ error: 'Erro ao acionar botão de pânico.' });
    }
  });

  // Resolve Alert action
  app.put('/api/alerts/:id', (req, res) => {
    try {
      const db = readDB();
      const index = db.panicAlerts.findIndex(a => a.id === req.params.id);
      if (index === -1) {
        return res.status(404).json({ error: 'Alerta não encontrado.' });
      }

      db.panicAlerts[index].status = req.body.status || 'Resolvido';
      db.panicAlerts[index].dispatcherComments = req.body.dispatcherComments || '';
      
      // If resolving alert, let's also auto-create a standard "Descumprimento de Medida" or "Ronda Emergencial" occurrence log, keeping audit logs green!
      if (req.body.status === 'Resolvido' && req.body.autoLogOccurrence) {
        const alert = db.panicAlerts[index];
        const newOcc: Occurrence = {
          id: 'occ_' + Date.now(),
          victimId: alert.victimId,
          victimName: alert.victimName,
          date: new Date().toISOString(),
          type: 'Descumprimento de Medida',
          description: `Acionamento de botão de Pânico resolvido pelo despachante. Descrição do atendimento: ${req.body.dispatcherComments}`,
          registeredByOfficer: req.body.registeredByOfficer || 'Despachante 5ºBPM',
          actionsTaken: 'Acionamento emergencial respondido via deslocamento policial e encerrado.'
        };
        db.occurrences.unshift(newOcc);
      }

      writeDB(db);
      res.json(db.panicAlerts[index]);
    } catch (e) {
      res.status(500).json({ error: 'Erro ao atualizar alerta.' });
    }
  });

  // Occurrence Log routes
  app.post('/api/occurrences', (req, res) => {
    try {
      const db = readDB();
      const victim = db.victims.find(v => v.id === req.body.victimId);

      const newOcc: Occurrence = {
        id: 'occ_' + Date.now(),
        victimId: req.body.victimId,
        victimName: victim ? victim.name : 'Vítima não identificada',
        date: req.body.date || new Date().toISOString(),
        type: req.body.type || 'Visita Preventiva',
        description: req.body.description || 'Nenhuma descrição detalhada fornecida.',
        registeredByOfficer: req.body.registeredByOfficer || 'Policial PROMUSE',
        actionsTaken: req.body.actionsTaken || 'Nenhuma ação de acompanhamento registrada.'
      };

      db.occurrences.unshift(newOcc);
      writeDB(db);
      res.status(201).json(newOcc);
    } catch (e) {
      res.status(500).json({ error: 'Erro ao registrar ocorrência.' });
    }
  });




  // Serve assets/Vite
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PROMUSE backend server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start full-stack server application:', err);
});
