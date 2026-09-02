let currentDate = new Date();
let activeWeekIdx = 0;
let selectedDayKey = null;
let currentDayEvents = [];
let holidaysMap = {}; // Agora os feriados são carregados dinamicamente
let dayAppointmentsCache = {};
let appointmentsMap = {}; // Variável global de cache para os agendamentos do mês
let selectedGlobalRoom = "";
let isFetchingDots = false;

const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const daysName = ["Seg", "Ter", "Qua", "Qui", "Sex"];

const baseHours = [
  "07h10", "08h00", "09h00", "10h10", "11h00", "11h50", 
  "13h10", "14h00", "14h50", "15h40", "17h00"
];

const roomColors = {
  "Informática": "#00ff22",
  "Auditório": "#ea3333",
  "Química": "#0077ff",
  "Matemática": "#e5ff00"
};

// Função para buscar feriados nacionais online usando a BrasilAPI
async function fetchHolidays(year) {
  try {
    const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
    const data = await response.json();
    
    holidaysMap = {};
    data.forEach(holiday => {
      // Extrai apenas o formato "MM-DD" da data completa "YYYY-MM-DD"
      const mm_dd = holiday.date.slice(5); 
      holidaysMap[mm_dd] = holiday.name;
    });

    renderWeeks(); // Re-renderiza o calendário após obter os feriados
  } catch (err) {
    console.error('Erro ao buscar feriados online:', err);
    renderWeeks(); // Renderiza mesmo se falhar para o calendário não travar
  }
}

function updateHeader() {
  document.getElementById('monthLabel').innerText = monthNames[currentDate.getMonth()];
  document.getElementById('yearLabel').innerText = currentDate.getFullYear();
}

function renderWeeks() {
  const container = document.getElementById('weeksStack');
  container.innerHTML = '';
  updateHeader();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  
  let weeks = [];
  let currentWeek = [];

  for (let day = 1; day <= totalDaysInMonth; day++) {
    const dateObj = new Date(year, month, day);
    const dayOfWeek = dateObj.getDay();

    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      if (dayOfWeek === 1 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      
      if (weeks.length === 0 && currentWeek.length === 0 && dayOfWeek > 1) {
        for (let i = 1; i < dayOfWeek; i++) {
          currentWeek.push(null);
        }
      }

      currentWeek.push({ dayNumber: day, dayOfWeek: dayOfWeek - 1, fullDate: dateObj });
    }
  }
  
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  weeks.forEach((week, wIdx) => {
    const weekCard = document.createElement('div');
    weekCard.className = `week-card ${wIdx === activeWeekIdx ? 'active' : ''}`;
    
    weekCard.onclick = () => {
      if (activeWeekIdx !== wIdx) setActiveWeek(wIdx);
    };
    
    let html = `<div class="week-title">Semana ${wIdx + 1}</div><div class="days-row">`;

    for (let d = 0; d < 5; d++) {
      const dayData = week.find(item => item && item.dayOfWeek === d);

      if (!dayData) {
        html += `<div class="day-pill" style="opacity: 0"></div>`;
      } else {
        const mm = String(month + 1).padStart(2, '0');
        const dd = String(dayData.dayNumber).padStart(2, '0');
        const holidayKey = `${mm}-${dd}`;
        const holidayName = holidaysMap[holidayKey];
        const dateKey = `${year}-${mm}-${dd}`;

        let dayEvents = appointmentsMap[dateKey] ? [...appointmentsMap[dateKey]] : [];
        
        if (selectedGlobalRoom) {
          dayEvents = dayEvents.filter(ev => ev.location === selectedGlobalRoom);
        }

        const limitedEvents = dayEvents.slice(0, 12);
        
        // Ajustado para usar as classes exatas do seu CSS
        let dotsHtml = '<div class="day-dots-container">';
        limitedEvents.forEach(ev => {
          const color = roomColors[ev.location] || '#2563eb';
          dotsHtml += `<span class="calendar-dot" style="background-color: ${color};"></span>`;
        });
        dotsHtml += '</div>';
        
        const todayObj = new Date();
        const isToday = dayData.dayNumber === todayObj.getDate() && month === todayObj.getMonth() && year === todayObj.getFullYear();

        html += `
          <div class="day-pill ${holidayName ? 'holiday' : ''} ${isToday ? 'today' : ''}" 
                onclick="event.stopPropagation(); handleDayClick('${dateKey}', '${daysName[d]}', ${dayData.dayNumber}, '${holidayName || ''}', ${wIdx})">
            <span class="name">${daysName[d]}</span>
            <span class="number">${dayData.dayNumber}</span>
            ${holidayName ? '' : dotsHtml}
          </div>`;
      }
    }

    html += `</div>`;
    weekCard.innerHTML = html;
    container.appendChild(weekCard);
  });
}

async function renderEvents() {
  const list = document.getElementById('eventsList');
  list.innerHTML = '';

  try {
    const res = await fetch(`/api/appointments/${selectedDayKey}`);
    currentDayEvents = await res.json();

    // Aplica o filtro global de salas se houver alguma selecionada
    let eventsToDisplay = currentDayEvents;
    if (selectedGlobalRoom) {
      eventsToDisplay = currentDayEvents.filter(ev => ev.location === selectedGlobalRoom);
    }

    if (eventsToDisplay.length === 0) {
      const msg = selectedGlobalRoom 
        ? `Nenhum agendamento para a sala "${selectedGlobalRoom}" neste dia.` 
        : `Nenhum compromisso marcado para este dia.`;
      list.innerHTML = `<div class="no-events">${msg}</div>`;
      return;
    }

    eventsToDisplay.forEach(ev => {
      const color = roomColors[ev.location] || '#2563eb';
      const eventIdentifier = ev._id ? `'${ev._id}'` : `'${ev.time}', '${ev.location}'`;

      list.innerHTML += `
        <div class="event-card" style="border-left-color: ${color}">
          <div class="event-header">
            <div class="event-header-left">
              <span class="event-time">⏰ ${ev.time}</span>
              <span class="event-location" style="background-color: ${color}">${ev.location}</span>
            </div>
            <button class="btn-delete" title="Cancelar Agendamento" onclick="cancelAppointment(${eventIdentifier})">CANCELAR</button>
          </div>
          <span class="event-name">Reservado por: ${ev.title}</span>
        </div>`;
    });
  } catch (err) {
    console.error('Erro ao carregar eventos:', err);
  }
}

async function loadCalendarDots() {
  if (isFetchingDots) return;
  isFetchingDots = true;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const mm = String(month + 1).padStart(2, '0');
  const yearMonth = `${year}-${mm}`;
  
  dayAppointmentsCache = {};
  appointmentsMap = {};

  try {
    const res = await fetch('/api/appointments');
    if (res.ok) {
      const allAppointments = await res.json();
      const monthAppointments = allAppointments.filter(app => app.dayKey && app.dayKey.startsWith(yearMonth));

      monthAppointments.forEach(app => {
        if (!dayAppointmentsCache[app.dayKey]) {
          dayAppointmentsCache[app.dayKey] = [];
        }
        dayAppointmentsCache[app.dayKey].push(app);

        if (!appointmentsMap[app.dayKey]) {
          appointmentsMap[app.dayKey] = [];
        }
        appointmentsMap[app.dayKey].push(app);
      });

      if (selectedGlobalRoom) {
        Object.keys(appointmentsMap).forEach(dateKey => {
          appointmentsMap[dateKey] = appointmentsMap[dateKey].filter(
            app => app.location === selectedGlobalRoom
          );
        });
      }

      renderWeeks();
    }
  } catch (err) {
    console.error('Erro ao carregar dots:', err);
  } finally {
    isFetchingDots = false;
  }
}

function renderDotsForDay(dateKey, appointments) {
  const containers = document.querySelectorAll(`.dots-${dateKey}`);
  if (!containers || containers.length === 0) return;

  const selectedRoom = document.getElementById('globalRoomFilter')?.value || "";

  let listToRender = appointments;
  if (selectedRoom) {
    listToRender = appointments.filter(app => app.location === selectedRoom);
  }

  containers.forEach(container => {
    container.innerHTML = '';
    listToRender.slice(0, 10).forEach(app => {
      const dot = document.createElement('span');
      dot.className = 'calendar-dot';
      dot.style.backgroundColor = roomColors[app.location] || '#2563eb';
      container.appendChild(dot);
    });
  });
}

function setActiveWeek(index) {
  const cards = document.querySelectorAll('.week-card');
  if (index < 0 || index >= cards.length) return;
  activeWeekIdx = index;
  cards.forEach((card, idx) => {
    card.classList.toggle('active', idx === activeWeekIdx);
  });
}

async function fetchAllAppointments() {
  try {
    const res = await fetch('/api/appointments');
    const data = await res.json();
    
    appointmentsMap = {};
    data.forEach(ev => {
      if (!appointmentsMap[ev.dayKey]) {
        appointmentsMap[ev.dayKey] = [];
      }
      appointmentsMap[ev.dayKey].push(ev);
    });
  } catch (err) {
    console.error('Erro ao buscar todos os agendamentos:', err);
  } finally {
    renderWeeks(); // Desenha os dots atualizados no calendário
  }
}

function handleDayClick(dateKey, weekDayName, dayNum, holidayName, weekIndex) {
  if (activeWeekIdx !== weekIndex) {
    setActiveWeek(weekIndex);
    return;
  }
  openDay(dateKey, weekDayName, dayNum, holidayName);
}

function changeMonth(direction) {
  const page = document.getElementById('page');
  const animationClass = direction > 0 ? 'flip-out-next' : 'flip-out-prev';
  
  page.classList.add(animationClass);

  setTimeout(async () => {
    currentDate.setMonth(currentDate.getMonth() + direction);
    activeWeekIdx = 0;
    
    // Busca os feriados do novo ano/mês antes de re-renderizar
    await fetchHolidays(currentDate.getFullYear());
    await fetchAllAppointments(); // Atualiza os dots para o novo mês
    
    page.classList.remove('flip-out-next', 'flip-out-prev');
  }, 500);
}

function formatNiceDate(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);

  const options = { weekday: 'long', day: 'numeric', month: 'long' };
  let formatted = dateObj.toLocaleDateString('pt-BR', options);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function resetForm() {
  document.getElementById('eventTitle').value = '';
  document.getElementById('eventLocation').value = '';
  
  const selectTime = document.getElementById('eventTime');
  selectTime.disabled = true;
  selectTime.innerHTML = '<option value="" disabled selected hidden>Selecione o local primeiro</option>';
}

async function applyRoomFilter() {
  const selectElement = document.getElementById('globalRoomFilter');
  selectedGlobalRoom = selectElement.value;

  await loadCalendarDots();
  
  const drawer = document.getElementById('dayDrawer');
  if (drawer.classList.contains('open')) {
    await renderEvents();
    
    const roomSelect = document.getElementById('eventLocation');
    if (roomSelect) {
      roomSelect.value = selectedGlobalRoom;
      updateAvailableTimes();
    }
  }
}

async function openDay(dateKey, weekDayName, dayNum, holidayName) {
  selectedDayKey = dateKey;
  
  const formattedDate = formatNiceDate(dateKey);
  document.getElementById('drawerDate').innerText = formattedDate;
  
  const form = document.getElementById('bookingForm');
  const holidayNotice = document.getElementById('holidayNotice');
  const holidayNameEl = document.getElementById('holidayName');
  const eventsList = document.getElementById('eventsList');

  if (holidayName) {
    form.style.display = 'none';
    eventsList.style.display = 'none';
    holidayNameEl.innerText = holidayName;
    holidayNotice.style.display = 'flex';
  } else {
    holidayNotice.style.display = 'none';
    eventsList.style.display = 'flex';
    form.style.display = 'flex';
    resetForm();
    
    // Primeiro renderiza os eventos (que já filtram pela sala selecionada, se houver)
    await renderEvents();

    // Se houver uma sala selecionada no filtro superior, aplica no formulário e atualiza horários
    if (selectedGlobalRoom) {
      const roomSelect = document.getElementById('eventLocation');
      roomSelect.value = selectedGlobalRoom;
      updateAvailableTimes();
    }
  }
  
  const drawer = document.getElementById('dayDrawer');
  drawer.style.display = 'flex';
  
  setTimeout(() => {
    drawer.classList.add('open');
  }, 10);
}

function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  const icon = document.getElementById('themeIcon');
  const text = document.getElementById('themeText');
  
  if (isDark) {
    icon.innerText = '☀️';
    text.innerText = 'Modo Claro';
    localStorage.setItem('theme', 'dark');
  } else {
    icon.innerText = '🌘';
    text.innerText = 'Modo Escuro';
    localStorage.setItem('theme', 'light');
  }
}

function toggleMonthlyView() {
  const stack = document.getElementById('weeksStack');
  const btn = document.getElementById('monthlyViewBtn');
  
  stack.classList.toggle('monthly-view');
  
  const isMonthly = stack.classList.contains('monthly-view');
  btn.innerText = isMonthly ? '📆 Visão Semanal' : '📅 Visão Mensal';
}

// Atualize também o carregamento ao iniciar a página (DOMContentLoaded)
window.addEventListener('DOMContentLoaded', async () => {
  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    const icon = document.getElementById('themeIcon');
    const text = document.getElementById('themeText');
    if (icon && text) {
      icon.innerText = '☀️';
      text.innerText = 'Modo Claro';
    }
  }

  selectedGlobalRoom = "";
  const filterSelect = document.getElementById('globalRoomFilter');
  if (filterSelect) {
    filterSelect.value = "";
  }

  updateHeader();
  
  // Carrega feriados e agendamentos ao iniciar
  await fetchHolidays(currentDate.getFullYear());
  await fetchAllAppointments();
});

function closeDrawer() {
  const drawer = document.getElementById('dayDrawer');
  drawer.classList.remove('open');
  
  setTimeout(() => {
    drawer.style.display = 'none';
  }, 800);
}

async function cancelAppointment(idOrTime, location) {
  const confirmed = confirm("Tem certeza de que deseja cancelar este agendamento?");
  if (!confirmed) return;

  try {
    let url = `/api/appointments/${selectedDayKey}`;
    let options = {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    };

    if (location) {
      options.body = JSON.stringify({ time: idOrTime, location });
    } else {
      url += `/${idOrTime}`;
    }

    const res = await fetch(url, options);

    if (res.ok) {
      await fetchAllAppointments(); // sei nao 
      await renderEvents();
      updateAvailableTimes();
      loadCalendarDots();
    } else {
      alert('Erro ao cancelar o agendamento.');
    }
  } catch (err) {
    console.error('Erro ao cancelar agendamento:', err);
    alert('Erro de conexão com o servidor.');
  }
}

function updateAvailableTimes() {
  const roomSelect = document.getElementById('eventLocation');
  const selectedRoom = roomSelect.value;
  const selectTime = document.getElementById('eventTime');
  
  if (!selectedRoom) {
    selectTime.disabled = true;
    selectTime.innerHTML = '<option value="" disabled selected hidden>Selecione o local primeiro</option>';
    return;
  }

  selectTime.disabled = false;
  selectTime.innerHTML = '<option value="" disabled selected hidden>Selecione o Horário</option>';

  let availableHours = [...baseHours];
  if (selectedRoom === "Informática") {
    availableHours = availableHours.filter(h => h !== "17h00");
  }

  const busyTimes = currentDayEvents
    .filter(e => e.location === selectedRoom)
    .map(e => e.time);

  availableHours.forEach(h => {
    if (!busyTimes.includes(h)) {
      selectTime.innerHTML += `<option value="${h}">${h} - Disponível</option>`;
    }
  });
}

async function handleSchedule(e) {
  e.preventDefault();
  const title = document.getElementById('eventTitle').value;
  const location = document.getElementById('eventLocation').value;
  const time = document.getElementById('eventTime').value;

  if (!location || !time) return;

  try {
    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dayKey: selectedDayKey, title, location, time })
    });

    if (res.ok) {
      resetForm();
      await fetchAllAppointments();
      await renderEvents();
      updateAvailableTimes();
      loadCalendarDots();
    } else {
      const errData = await res.json();
      alert(errData.error || 'Erro ao agendar.');
    }
  } catch (err) {
    console.error('Erro ao agendar:', err);
  }
}

const stack = document.getElementById('weeksStack');
let isScrolling = false;

stack.addEventListener('wheel', e => {
  e.preventDefault();
  if (isScrolling) return;

  isScrolling = true;
  if (e.deltaY > 0) {
    setActiveWeek(activeWeekIdx + 1);
  } else {
    setActiveWeek(activeWeekIdx - 1);
  }

  setTimeout(() => { isScrolling = false; }, 250);
}, { passive: false });

function detectIosAndShowGuide() {
  const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator.standalone);

  // Se for iOS e o app ainda não estiver rodando instalado em tela cheia
  if (isIos && !isInStandaloneMode) {
    // Verifica se já mostrou o tutorial recentemente para não chatear o usuário toda vez
    const hasSeenGuide = localStorage.getItem('ios_install_guide_seen');
    if (!hasSeenGuide) {
      setTimeout(() => {
        const modal = document.createElement('div');
        modal.style.cssText = `
          position: fixed; inset: 0; background: rgba(0,0,0,0.6);
          display: flex; align-items: flex-end; justify-content: center;
          z-index: 2000; padding: 15px; animation: fadeIn 0.3s ease;
        `;
        modal.innerHTML = `
          <div style="background: var(--card-bg, #1e293b); color: var(--text, #f8fafc); width: 100%; max-width: 400px; padding: 24px; border-radius: 24px; border: 1px solid var(--border, #475569); box-shadow: 0 20px 40px rgba(0,0,0,0.4); text-align: center;">
            <div style="font-size: 1.2rem; font-weight: 800; margin-bottom: 8px;">Instale nosso App no iPhone</div>
            <p style="font-size: 0.85rem; opacity: 0.85; margin-bottom: 20px; line-height: 1.4;">
              Para a melhor experiência, adicione este calendário à sua Tela de Início tocando no ícone de compartilhamento <span style="font-size: 1.2rem;">⎋</span> e depois em <b>"Adicionar à Tela de Início"</b>.
            </p>
            <button id="ios-got-it-btn" style="background: var(--accent, #6f9c22); color: #fff; border: none; width: 100%; padding: 12px; border-radius: 12px; font-weight: bold; font-size: 0.95rem; cursor: pointer;">Entendido</button>
          </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('ios-got-it-btn').addEventListener('click', () => {
          modal.remove();
          localStorage.setItem('ios_install_guide_seen', 'true');
        });
      }, 2000); // Mostra o aviso 2 segundos após abrir o site
    }
  }
}

// Executa a verificação ao carregar a página
window.addEventListener('load', detectIosAndShowGuide);

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  // Previne o banner padrão do navegador de aparecer imediatamente
  e.preventDefault();
  deferredPrompt = e;

  // Cria o elemento do seu banner personalizado se ele ainda não existir
  if (!document.getElementById('pwa-install-banner')) {
    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.style.cssText = `
      position: fixed; bottom: 20px; left: 20px; right: 20px;
      background: var(--card-bg, #1e293b); color: var(--text, #f8fafc);
      padding: 16px; border-radius: 16px; border: 1px solid var(--border, #475569);
      box-shadow: 0 10px 25px rgba(0,0,0,0.3); display: flex;
      align-items: center; justify-content: space-between; z-index: 1000;
      font-family: inherit;
    `;
    banner.innerHTML = `
      <div>
        <div style="font-weight: 700; font-size: 0.95rem;">Instalar Aplicativo</div>
        <div style="font-size: 0.8rem; opacity: 0.8;">Adicione o agendador à tela inicial para acesso rápido.</div>
      </div>
      <div style="display: flex; gap: 8px;">
        <button id="pwa-install-btn" style="background: var(--accent, #6f9c22); color: #fff; border: none; padding: 8px 14px; border-radius: 8px; font-weight: bold; cursor: pointer;">Instalar</button>
        <button id="pwa-close-btn" style="background: transparent; color: var(--text-muted, #94a3b8); border: none; padding: 8px; cursor: pointer; font-size: 1.1rem;">✕</button>
      </div>
    `;
    document.body.appendChild(banner);

    document.getElementById('pwa-install-btn').addEventListener('click', async () => {
      banner.remove();
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('Usuário aceitou instalar o PWA');
      }
      deferredPrompt = null;
    });

    document.getElementById('pwa-close-btn').addEventListener('click', () => {
      banner.remove();
    });
  }
});