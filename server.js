const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const cron = require('node-cron');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuração da conexão com o Neon PostgreSQL usando a variável de ambiente do Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// 1. Buscar todos os agendamentos ou filtrar por mês
app.get('/api/appointments', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM appointments ORDER BY time ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar agendamentos:', err);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// 2. Buscar agendamentos de um dia específico
app.get('/api/appointments/:dayKey', async (req, res) => {
  const { dayKey } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM appointments WHERE "dayKey" = $1 ORDER BY time ASC',
      [dayKey]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar agendamentos do dia:', err);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// 3. Criar novo agendamento
app.post('/api/appointments', async (req, res) => {
  const { dayKey, title, location, time } = req.body;

  if (!dayKey || !title || !location || !time) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  }

  try {
    const checkExisting = await pool.query(
      'SELECT * FROM appointments WHERE "dayKey" = $1 AND location = $2 AND time = $3',
      [dayKey, location, time]
    );

    if (checkExisting.rows.length > 0) {
      return res.status(400).json({ error: 'Este horário já está reservado para este local.' });
    }

    const insertResult = await pool.query(
      'INSERT INTO appointments ("dayKey", title, location, time) VALUES ($1, $2, $3, $4) RETURNING *',
      [dayKey, title, location, time]
    );

    res.status(201).json(insertResult.rows[0]);
  } catch (err) {
    console.error('Erro ao criar agendamento:', err);
    res.status(500).json({ error: 'Erro interno ao salvar no banco.' });
  }
});

// 4. Deletar agendamento por ID
app.delete('/api/appointments/id/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const deleteResult = await pool.query('DELETE FROM appointments WHERE id = $1 RETURNING *', [id]);

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado.' });
    }

    res.json({ message: 'Agendamento cancelado com sucesso!' });
  } catch (err) {
    console.error('Erro ao deletar agendamento:', err);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// 5. Deletar por parâmetros alternativos (dia, hora e local)
app.delete('/api/appointments/:dayKey', async (req, res) => {
  const { dayKey } = req.params;
  const { time, location } = req.body || {};

  if (!time || !location) {
    return res.status(400).json({ error: 'Parâmetros insuficientes para exclusão.' });
  }

  try {
    const deleteResult = await pool.query(
      'DELETE FROM appointments WHERE "dayKey" = $1 AND time = $2 AND location = $3 RETURNING *',
      [dayKey, time, location]
    );

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado.' });
    }

    res.json({ message: 'Agendamento cancelado com sucesso!' });
  } catch (err) {
    console.error('Erro ao deletar agendamento:', err);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// Tarefa agendada para limpar agendamentos com mais de 1 ano (todo dia 1º à meia-noite)
cron.schedule('0 0 1 * *', async () => {
  try {
    await pool.query(`
      DELETE FROM appointments 
      WHERE "dayKey" < TO_CHAR(NOW() - INTERVAL '1 year', 'YYYY-MM-DD');
    `);
    console.log('Limpeza automática de agendamentos antigos executada com sucesso.');
  } catch (error) {
    console.error('Erro ao executar limpeza automática:', error);
  }
});

// Inicialização do servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});