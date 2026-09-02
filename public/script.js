let currentDate = new Date();
let activeWeekIdx = 0;
let selectedDayKey = null;
let currentDayEvents = [];
let isFullMonthView = false;
let dayAppointmentsCache = {};

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

let holidaysMap = {};
let loadedHolidaysYear = null;

window.addEventListener('DOMContentLoaded', () => {
  const filterEl = document.getElementById('globalRoomFilter');
  if (filterEl) {
    filterEl.value = "";
    filterEl.addEventListener('change', applyGlobalFilter);
  }

  const roomSelect = document.getElementById('eventLocation');
  const bookingForm = document.getElementById('bookingForm');

  if (roomSelect) roomSelect.addEventListener('change', updateAvailableTimes);
  if (bookingForm) bookingForm.addEventListener('submit', handleSchedule);

  renderWeeks();
  setupScrollListeners();
});

function setupScrollListeners() {
  const stack = document.getElementById('weeksStack');
  let isScrolling = false;

  if (!stack) return;

  stack.addEventListener('wheel', e => {
    if (isFullMonthView) return;
    e.preventDefault();
    if (isScrolling) return;
    isScrolling = true;

    if (e.deltaY > 0) {
      if (activeWeekIdx < stack.children.length - 1) {
        setActiveWeek(activeWeekIdx + 1);
      }
    } else {
      if (activeWeekIdx > 0) {
        setActiveWeek(activeWeekIdx - 1);
      }
    }

    setTimeout(() => {
      isScrolling = false;
    }, 400);
  }, { passive: false });

  let touchStartY = 0;
  stack.addEventListener('touchstart', e => {
    touchStartY = e.touches[0].clientY;
  });

  stack.addEventListener('touchmove', e => {
    if (isFullMonthView) return;
    const touchEndY = e.touches[0].clientY;
    const diff = touchStartY - touchEndY;

    if (Math.abs(diff) > 40 && !isScrolling) {
      isScrolling = true;
      if (diff > 0 && activeWeekIdx < stack.children.length - 1) {
        setActiveWeek(activeWeekIdx + 1);
      } else if (diff < 0 && activeWeekIdx > 0) {
        setActiveWeek(activeWeekIdx - 1);
      }
      setTimeout(() => {
        isScrolling = false;
      }, 400);
    }
  });
}

async function fetchHolidays(year) {
  if (loadedHolidaysYear === year) return;

  try {
    const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
    if (!res.ok) return;
    
    const holidays = await res.json();
    holidaysMap = {}; 

    holidays.forEach(h => {
      const [y, m, d] = h.date.split('-');
      holidaysMap[`${m}-${d}`] = h.name;
    });

    loadedHolidaysYear = year;
  } catch (err) {
    console.error('Erro ao buscar feriados:', err);
  }
}

function updateHeader() {
  const monthLabel = document.getElementById('monthLabel');
  const yearLabel = document.getElementById('yearLabel');
  if (monthLabel) monthLabel.innerText = monthNames[currentDate.getMonth()];
  if (yearLabel) yearLabel.innerText = currentDate.getFullYear();
}

let isFetchingDots = false;

async function loadCalendarDots() {
  if (isFetchingDots) return;
  isFetchingDots = true;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const mm = String(month + 1).padStart(2, '0');
  const yearMonth = `${year}-${mm}`;
  
  dayAppointmentsCache = {};

  try {
    const res = await fetch(`/api/appointments/month/${yearMonth}`);
    if (res.ok) {
      const allAppointments = await res.json();

      allAppointments.forEach(app => {
        if (!dayAppointmentsCache[app.dayKey]) {
          dayAppointmentsCache[app.dayKey] = [];
        }
        dayAppointmentsCache[app.dayKey].push(app);
      });

      Object.keys(dayAppointmentsCache).forEach(dateKey => {
        renderDotsForDay(dateKey, dayAppointmentsCache[dateKey]);
      });
    }
  } catch (err) {
    console.error('Erro ao carregar dots:', err);
  } finally {
    isFetchingDots = false;
  }

  applyGlobalFilter();
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

function applyGlobalFilter() {
  const selectedRoom = document.getElementById('globalRoomFilter')?.value || "";
  
  Object.keys(dayAppointmentsCache).forEach(dateKey => {
    const apps = dayAppointmentsCache[dateKey] || [];
    renderDotsForDay(dateKey, apps);
  });

  if (selectedDayKey && document.getElementById('dayDrawer')?.classList.contains('open')) {
    renderEvents();
  }
}

async function toggleFullMonthView() {
  isFullMonthView = !isFullMonthView;
  const weeksStack = document.getElementById('weeksStack');
  const fullGrid = document.getElementById('fullMonthGrid');
  const btn = document.getElementById('viewToggleBtn');

  if (isFullMonthView) {
    if (btn) btn.innerText = "Visão Semanal";
    
    if (weeksStack) {
      weeksStack.classList.remove('view-visible');
      weeksStack.classList.add('view-hidden');
    }
    
    await renderFullMonthGrid();
    
    if (fullGrid) {
      fullGrid.classList.remove('view-hidden');
      fullGrid.classList.add('view-visible');
    }

    await loadCalendarDots();

  } else {
    if (btn) btn.innerText = "Visão Mensal";
    
    if (fullGrid) {
      fullGrid.classList.remove('view-visible');
      fullGrid.classList.add('view-hidden');
    }
    
    await renderWeeks();
    
    if (weeksStack) {
      weeksStack.classList.remove('view-hidden');
      weeksStack.classList.add('view-visible');
    }

    await loadCalendarDots();
  }
}

async function renderFullMonthGrid() {
  const container = document.getElementById('fullMonthGrid');
  if (!container) return;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

  await fetchHolidays(year);
  container.innerHTML = '';
  updateHeader();

  const firstDateObj = new Date(year, month, 1);
  let firstDayOfWeek = firstDateObj.getDay();

  // Correção robusta para inserir os espaços vazios (empty-pill) de acordo com o dia da semana do dia 1º
  // Domingo (0) ou Sábado (6) caem fora dos dias úteis, logo o mês útil visual começa na próxima segunda (4 ou 5 espaços)
  // Segunda (1) = 0 espaços, Terça (2) = 1 espaço, Quarta (3) = 2 espaços, Quinta (4) = 3 espaços, Sexta (5) = 4 espaços
  let emptySlots = 0;
  if (firstDayOfWeek === 0) {
    emptySlots = 4;
  } else if (firstDayOfWeek === 6) {
    emptySlots = 5;
  } else {
    emptySlots = firstDayOfWeek - 1;
  }

  for (let i = 0; i < emptySlots; i++) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'day-pill empty-pill';
    container.appendChild(emptyDiv);
  }

  for (let day = 1; day <= totalDaysInMonth; day++) {
    const dateObj = new Date(year, month, day);
    const dayOfWeek = dateObj.getDay();

    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const holidayKey = `${mm}-${dd}`;
      const holidayName = holidaysMap[holidayKey];
      const dateKey = `${year}-${mm}-${dd}`;
      const dName = daysName[dayOfWeek - 1];

      const pill = document.createElement('div');
      pill.className = `day-pill ${holidayName ? 'holiday' : ''}`;
      pill.setAttribute('data-date', dateKey);
      pill.onclick = () => openDay(dateKey, dName, day, holidayName || '');
      
      pill.innerHTML = `
        <span class="name">${dName}</span>
        <span class="number">${day}</span>
        <div class="day-dots-container dots-${dateKey}"></div>
      `;
      container.appendChild(pill);
    }
  }
  await loadCalendarDots();
}

async function renderWeeks() {
  const container = document.getElementById('weeksStack');
  if (!container) return;

  const year = currentDate.getFullYear();
  await fetchHolidays(year);

  container.innerHTML = '';
  updateHeader();

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
      currentWeek.push({ dayNumber: day, dayOfWeek: dayOfWeek - 1, fullDate: dateObj });
    }
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

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
        html += `<div class="day-pill empty-pill"></div>`;
      } else {
        const mm = String(month + 1).padStart(2, '0');
        const dd = String(dayData.dayNumber).padStart(2, '0');
        const holidayName = holidaysMap[`${mm}-${dd}`];
        const dateKey = `${year}-${mm}-${dd}`;

        html += `
          <div class="day-pill ${holidayName ? 'holiday' : ''}" data-date="${dateKey}">
            <span class="name">${daysName[d]}</span>
            <span class="number">${dayData.dayNumber}</span>
            <div class="day-dots-container dots-${dateKey}"></div>
          </div>`;
      }
    }
    html += `</div>`;
    weekCard.innerHTML = html;
    
    weekCard.querySelectorAll('.day-pill:not(.empty-pill)').forEach(pill => {
      const dKey = pill.getAttribute('data-date');
      const parts = dKey.split('-');
      const dNum = parseInt(parts[2], 10);
      const hName = holidaysMap[`${parts[1]}-${parts[2]}`] || '';
      const dName = pill.querySelector('.name').innerText;

      pill.onclick = (ev) => {
        ev.stopPropagation();
        handleDayClick(dKey, dName, dNum, hName, wIdx);
      };
    });

    container.appendChild(weekCard);
  });

  await loadCalendarDots();
}

function setActiveWeek(index) {
  const cards = document.querySelectorAll('.week-card');
  if (index < 0 || index >= cards.length) return;
  activeWeekIdx = index;
  cards.forEach((card, idx) => {
    card.classList.toggle('active', idx === activeWeekIdx);
  });
}

function handleDayClick(dateKey, weekDayName, dayNum, holidayName, weekIndex) {
  if (activeWeekIdx !== weekIndex) {
    setActiveWeek(weekIndex);
    return;
  }
  openDay(dateKey, weekDayName, dayNum, holidayName);
}

async function changeMonth(direction) {
  const page = document.getElementById('page');
  if (!page) return;

  page.classList.add(direction > 0 ? 'flip-out-next' : 'flip-out-prev');

  setTimeout(async () => {
    currentDate.setMonth(currentDate.getMonth() + direction);
    activeWeekIdx = 0;
    if (isFullMonthView) await renderFullMonthGrid();
    else await renderWeeks();
    page.classList.remove('flip-out-next', 'flip-out-prev');
  }, 500);
}

function formatNiceDate(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  let formatted = dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function resetForm() {
  const eventTitle = document.getElementById('eventTitle');
  if (eventTitle) eventTitle.value = '';

  const globalFilterVal = document.getElementById('globalRoomFilter')?.value || "";
  const roomSelect = document.getElementById('eventLocation');
  
  if (!roomSelect) return;

  if (globalFilterVal) {
    roomSelect.value = globalFilterVal;
    roomSelect.disabled = true;
    updateAvailableTimes();
  } else {
    roomSelect.disabled = false;
    roomSelect.value = "";
    const selectTime = document.getElementById('eventTime');
    if (selectTime) {
      selectTime.disabled = true;
      selectTime.innerHTML = '<option value="" disabled selected hidden>Selecione o local primeiro</option>';
    }
  }
}

async function openDay(dateKey, weekDayName, dayNum, holidayName) {
  selectedDayKey = dateKey;
  const drawerDate = document.getElementById('drawerDate');
  if (drawerDate) drawerDate.innerText = formatNiceDate(dateKey);
  
  const form = document.getElementById('bookingForm');
  const holidayNotice = document.getElementById('holidayNotice');
  const holidayNameEl = document.getElementById('holidayName');
  const eventsList = document.getElementById('eventsList');

  if (holidayName) {
    if (form) form.style.display = 'none';
    if (eventsList) eventsList.style.display = 'none';
    if (holidayNameEl) holidayNameEl.innerText = holidayName;
    if (holidayNotice) holidayNotice.style.display = 'flex';
  } else {
    if (holidayNotice) holidayNotice.style.display = 'none';
    if (eventsList) eventsList.style.display = 'flex';
    if (form) form.style.display = 'flex';
    resetForm();
    await renderEvents();
  }
  
  const drawer = document.getElementById('dayDrawer');
  if (drawer) {
    drawer.style.display = 'flex';
    setTimeout(() => drawer.classList.add('open'), 10);
  }
}

function closeDrawer() {
  const drawer = document.getElementById('dayDrawer');
  if (!drawer) return;
  drawer.classList.remove('open');
  setTimeout(() => { drawer.style.display = 'none'; }, 800);
}

async function renderEvents() {
  const list = document.getElementById('eventsList');
  if (!list) return;
  list.innerHTML = '';

  const globalRoomFilter = document.getElementById('globalRoomFilter')?.value || "";

  try {
    const res = await fetch(`/api/appointments/${selectedDayKey}`);
    if (!res.ok) return;
    currentDayEvents = await res.json();
    dayAppointmentsCache[selectedDayKey] = currentDayEvents;

    let eventsToDisplay = currentDayEvents;
    if (globalRoomFilter) {
      eventsToDisplay = currentDayEvents.filter(ev => ev.location === globalRoomFilter);
    }

    if (eventsToDisplay.length === 0) {
      list.innerHTML = `<div class="no-events">Nenhum compromisso encontrado para esta seleção.</div>`;
      return;
    }

    eventsToDisplay.forEach(ev => {
      const color = roomColors[ev.location] || '#2563eb';
      const eventIdentifier = ev._id ? `'${ev._id}'` : (ev.id ? `'${ev.id}'` : `'${ev.time}', '${ev.location}'`);

      list.innerHTML += `
        <div class="event-card" style="border-left-color: ${color}">
          <div class="event-header">
            <div class="event-header-left">
              <span class="event-time">⏰ ${ev.time}</span>
              <span class="event-location" style="background-color: ${color}">${ev.location}</span>
            </div>
            <button class="btn-delete" title="Cancelar" onclick="cancelAppointment(${eventIdentifier})">🗑️</button>
          </div>
          <span class="event-name">Reservado por: ${ev.title}</span>
        </div>`;
    });
  } catch (err) {
    console.error('Erro ao carregar eventos:', err);
  }
}

async function cancelAppointment(id) {
  if (!id || id === 'undefined') {
    alert('Erro: ID do agendamento não encontrado.');
    return;
  }

  if (!confirm("Tem certeza que deseja cancelar este agendamento?")) return;

  try {
    let res = await fetch(`/api/appointments/${id}`, { method: 'DELETE' });

    if (res.status === 404) {
      res = await fetch(`/api/appointments/id/${id}`, { method: 'DELETE' });
    }

    if (res.ok) {
      await renderEvents();
      updateAvailableTimes();
      loadCalendarDots();
    } else {
      const errData = await res.json();
      alert(errData.error || 'Erro ao cancelar.');
    }
  } catch (err) {
    console.error('Erro ao cancelar:', err);
    alert('Erro de conexão com o servidor.');
  }
}

function updateAvailableTimes() {
  const selectedRoom = document.getElementById('eventLocation')?.value;
  const selectTime = document.getElementById('eventTime');
  
  if (!selectTime) return;

  if (!selectedRoom) {
    selectTime.disabled = true;
    selectTime.innerHTML = '<option value="" disabled selected hidden>Selecione o local primeiro</option>';
    return;
  }

  selectTime.disabled = false;
  selectTime.innerHTML = '<option value="" disabled selected hidden>Selecione o Horário</option>';

  let availableHours = [...baseHours];
  if (selectedRoom === "Informática") availableHours = availableHours.filter(h => h !== "17h00");

  const busyTimes = currentDayEvents.filter(e => e.location === selectedRoom).map(e => e.time);

  availableHours.forEach(h => {
    if (!busyTimes.includes(h)) {
      selectTime.innerHTML += `<option value="${h}">${h} - Disponível</option>`;
    }
  });
}

async function handleSchedule(e) {
  e.preventDefault();
  const title = document.getElementById('eventTitle')?.value;
  const location = document.getElementById('eventLocation')?.value;
  const time = document.getElementById('eventTime')?.value;

  if (!location || !time) return;

  try {
    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dayKey: selectedDayKey, title, location, time })
    });

    if (res.ok) {
      resetForm();
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