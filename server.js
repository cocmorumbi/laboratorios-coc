const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const FILE_PATH = path.join(__dirname, 'agendamentos.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Função para ler dados do JSON
function readData() {
  if (!fs.existsSync(FILE_PATH)) {
    fs.writeFileSync(FILE_PATH, JSON.stringify([]));
    return [];
  }
  try {
    const content = fs.readFileSync(FILE_PATH, 'utf-8');
    return JSON.parse(content || '[]');
  } catch (err) {
    return [];
  }
}

// Função para salvar dados no JSON
function saveData(data) {
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
}

// 1. ROTA DE MÊS PRIMEIRO (para evitar conflito com a rota de dia específico)
app.get('/api/appointments/month/:yearMonth', (req, res) => {
  const { yearMonth } = req.params;
  const appointments = readData();
  const filtered = appointments.filter(a => a.dayKey && a.dayKey.startsWith(yearMonth));
  res.json(filtered);
});

// 2. Buscar agendamentos de um dia específico (ordenados por horário)
app.get('/api/appointments/:dayKey', (req, res) => {
  const { dayKey } = req.params;
  const appointments = readData();
  const filtered = appointments.filter(a => a.dayKey === dayKey);

  filtered.sort((a, b) => {
    const timeToMinutes = (t) => {
      if (!t) return 0;
      const clean = t.toLowerCase().replace(/h/g, ':').split(':');
      const hours = parseInt(clean[0], 10) || 0;
      const minutes = parseInt(clean[1], 10) || 0;
      return (hours * 60) + minutes;
    };
    return timeToMinutes(a.time) - timeToMinutes(b.time);
  });

  res.json(filtered);
});

// 3. Criar novo agendamento
app.post('/api/appointments', (req, res) => {
  const { dayKey, title, location, time } = req.body;

  if (!dayKey || !title || !location || !time) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  }

  const appointments = readData();

  const existing = appointments.find(
    a => a.dayKey === dayKey && a.location === location && a.time === time
  );

  if (existing) {
    return res.status(400).json({ error: 'Este horário já está reservado para este local.' });
  }

  const newAppointment = {
    _id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    dayKey,
    title,
    location,
    time
  };

  appointments.push(newAppointment);
  saveData(appointments);

  res.status(201).json(newAppointment);
});

// Função para deletar agendamento por ID
function deleteAppointmentById(req, res) {
  const { id } = req.params;
  let appointments = readData();

  const initialLength = appointments.length;
  appointments = appointments.filter(a => String(a._id).trim() !== String(id).trim());

  if (appointments.length === initialLength) {
    return res.status(404).json({ error: 'Agendamento não encontrado.' });
  }

  saveData(appointments);
  return res.json({ message: 'Agendamento cancelado com sucesso!' });
}

// 4. Rotas de Deleção (ID específico primeiro)
app.delete('/api/appointments/id/:id', deleteAppointmentById);

app.delete('/api/appointments/:param', (req, res) => {
  const { param } = req.params;
  const { time, location } = req.body || {};

  if (time && location) {
    let appointments = readData();
    const initialLength = appointments.length;

    appointments = appointments.filter(a => !(a.dayKey === param && a.time === time && a.location === location));

    if (appointments.length === initialLength) {
      return res.status(404).json({ error: 'Agendamento não encontrado.' });
    }

    saveData(appointments);
    return res.json({ message: 'Agendamento cancelado com sucesso!' });
  }

  req.params.id = param;
  return deleteAppointmentById(req, res);
});

// Inicialização do servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});