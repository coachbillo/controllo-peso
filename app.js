import Chart from "chart.js/auto";

const qs = sel => document.querySelector(sel);
const qsa = sel => Array.from(document.querySelectorAll(sel));

const profileForm = qs('#profile-form');
const bmiCard = qs('#bmi-card');
const bmiValueEl = qs('#bmi-value');
const bmiCatEl = qs('#bmi-cat');
const pesoFormaEl = qs('#peso-forma');
const resetBtn = qs('#reset-profile');
const saveBtn = qs('#save-profile');

const logSection = qs('#log-section');
const logForm = qs('#log-form');
const logsList = qs('#logs-list');
const clearLogsBtn = qs('#clear-logs');

const dataKey = 'peso_tracker_data_v1';

let state = {
  profile: null,
  logs: []
};

function loadState(){
  try{
    const raw = localStorage.getItem(dataKey);
    if(raw) state = JSON.parse(raw);
  }catch(e){}
}
function saveState(){
  localStorage.setItem(dataKey, JSON.stringify(state));
}

function calcBMI(peso, altezzaCm){
  const h = altezzaCm / 100;
  return peso / (h*h);
}
function bmiCategory(bmi){
  if(bmi < 18.5) return 'Sottopeso';
  if(bmi < 25) return 'Normale';
  if(bmi < 30) return 'Sovrappeso';
  return 'Obesità';
}
function calcPesoFormaRange(altezzaCm){
  const h = altezzaCm / 100;
  const min = 18.5 * h * h;
  const max = 24.9 * h * h;
  const mid = (min + max) / 2;
  return {min, max, mid};
}

function renderProfile(){
  if(!state.profile){
    bmiCard.classList.add('hidden');
    logSection.classList.add('hidden');
    return;
  }
  const p = state.profile;
  // show bmi using last weight if exists, otherwise placeholder
  const last = state.logs.length ? state.logs[state.logs.length-1] : null;
  const weightForCalc = last ? last.peso : null;
  if(weightForCalc){
    const bmi = calcBMI(weightForCalc, p.altezza);
    bmiValueEl.textContent = bmi.toFixed(1);
    bmiCatEl.textContent = bmiCategory(bmi);
  } else {
    bmiValueEl.textContent = '--';
    bmiCatEl.textContent = '--';
  }
  const pf = calcPesoFormaRange(p.altezza);
  pesoFormaEl.textContent = pf.mid.toFixed(1);
  bmiCard.classList.remove('hidden');
  logSection.classList.remove('hidden');
}

function populateProfileForm(){
  if(!state.profile) return;
  const p = state.profile;
  qs('#nome').value = p.nome;
  qs('#cognome').value = p.cognome;
  qs('#eta').value = p.eta;
  qs('#sesso').value = p.sesso;
  qs('#altezza').value = p.altezza;
  qs('#corporatura').value = p.corporatura;
}

profileForm.addEventListener('submit', e => {
  e.preventDefault();
  const form = Object.fromEntries(new FormData(profileForm).entries());
  const profile = {
    nome: form.nome.trim(),
    cognome: form.cognome.trim(),
    eta: Number(form.eta),
    sesso: form.sesso,
    altezza: Number(form.altezza),
    corporatura: form.corporatura
  };
  state.profile = profile;
  saveState();
  populateProfileForm();
  renderProfile();
  renderChart();
});

resetBtn.addEventListener('click', () => {
  if(confirm('Vuoi resettare i dati del profilo?')) {
    state.profile = null;
    saveState();
    profileForm.reset();
    renderProfile();
    renderChart();
  }
});

/* Logs management */
logForm.addEventListener('submit', e => {
  e.preventDefault();
  if(!state.profile){
    alert('Salva prima i dati personali.');
    return;
  }
  const form = new FormData(logForm);
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,8),
    peso: Number(form.get('peso')),
    orario: form.get('orario'),
    data: form.get('data'), // YYYY-MM-DD
    note: (form.get('note')||'').trim()
  };
  // keep logs sorted by datetime ascending
  state.logs.push(entry);
  state.logs.sort((a,b) => (a.data + 'T' + a.orario).localeCompare(b.data + 'T' + b.orario));
  saveState();
  logForm.reset();
  renderLogs();
  renderProfile();
  renderChart();
});

clearLogsBtn.addEventListener('click', () => {
  if(confirm('Eliminare tutti i rilevamenti?')){
    state.logs = [];
    saveState();
    renderLogs();
    renderProfile();
    renderChart();
  }
});

function renderLogs(){
  logsList.innerHTML = '';
  if(state.logs.length === 0){
    logsList.innerHTML = `<div class="small" style="color:var(--muted)">Nessun rilevamento</div>`;
    return;
  }
  state.logs.slice().reverse().forEach(log => {
    const el = document.createElement('div');
    el.className = 'log-item';
    const left = document.createElement('div'); left.className = 'log-left';
    const meta = document.createElement('div'); meta.className = 'log-meta';
    meta.textContent = `${log.data} • ${log.orario} • ${log.peso.toFixed(1)} kg`;
    const note = document.createElement('div'); note.className = 'log-note';
    note.textContent = log.note || '';
    left.appendChild(meta);
    left.appendChild(note);
    const del = document.createElement('button');
    del.className = 'del-btn';
    del.textContent = 'Elimina';
    del.addEventListener('click', () => {
      if(!confirm('Eliminare questo rilevamento?')) return;
      state.logs = state.logs.filter(l => l.id !== log.id);
      saveState();
      renderLogs();
      renderProfile();
      renderChart();
    });
    el.appendChild(left);
    el.appendChild(del);
    logsList.appendChild(el);
  });
}

/* Chart */
let chart = null;
function renderChart(){
  const ctx = qs('#weightChart').getContext('2d');
  if(!state.profile || state.logs.length === 0){
    if(chart){ chart.destroy(); chart = null; }
    // clear canvas
    ctx.clearRect(0,0,ctx.canvas.width, ctx.canvas.height);
    return;
  }
  const labels = state.logs.map(l => `${l.data} ${l.orario}`);
  const data = state.logs.map(l => l.peso);
  const pf = calcPesoFormaRange(state.profile.altezza);
  const pesoFormaLine = Array(data.length).fill(Number(pf.mid.toFixed(2)));

  if(chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Peso (kg)',
          data,
          borderColor: '#000',
          backgroundColor: 'rgba(0,0,0,0.05)',
          tension: 0.15,
          pointRadius: 4,
          pointBackgroundColor: '#000'
        },
        {
          label: 'Peso forma',
          data: pesoFormaLine,
          borderColor: '#c0392b',
          borderDash: [6,6],
          pointRadius: 0,
          tension: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y} kg`
          }
        }
      },
      scales: {
        x: {
          ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6 }
        },
        y: {
          beginAtZero: false,
          suggestedMin: Math.min(...data, pf.min) - 2,
          suggestedMax: Math.max(...data, pf.max) + 2
        }
      }
    }
  });
}

/* Init */
function init(){
  loadState();
  populateProfileForm();
  renderProfile();
  renderLogs();
  renderChart();
  // set default date and time in log form to now
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  qs('#data').value = now.toISOString().slice(0,10);
  qs('#orario').value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
init();