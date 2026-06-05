let chartMonth = null;
let chartPollutant = null;
let chartWind = null;
let map = null;
let geoLayer = null;
let stationsLayer = null;
let dataStore = null;
let geojson = null;
let stationsGeojson = null;

const GAS_NAMES = {
  SO2:   'Oltingugurt dioksid (SO₂)',
  NO2:   'Azot dioksid (NO₂)',
  NH3:   'Ammiak (NH₃)',
  HF:    'Vodorod ftorid (HF)',
  NO:    'Azot oksid (NO)',
  Fenol: 'Fenol (C₆H₅OH)',
  CO:    'Uglerod oksid (CO)',
  CL:    'Xlor (Cl₂)',
  Chang: 'Chang (PM)',
};

function gasLabel(code) {
  return GAS_NAMES[code] || code;
}

function formatNumber(value) {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: 3 });
}

function updateSummary() {
  const year = document.getElementById('yearSelect').value;
  const pollutant = document.getElementById('pollutantSelect').value;
  const measure = document.getElementById('measureSelect').value;

  document.getElementById('summaryYear').textContent = year;
  document.getElementById('summaryPollutant').textContent = pollutant;
  document.getElementById('summaryMeasure').textContent = measure;
}

function buildTable(year, measure) {
  const table = document.getElementById('dataTable');
  const months = dataStore.months;
  const pollutants = dataStore.pollutants;

  let html = '<thead><tr><th>Parametr / Oy</th>';
  for (const month of months) {
    html += `<th>${month}</th>`;
  }
  html += '</tr></thead><tbody>';

  for (const pollutant of pollutants) {
    html += `<tr><td><strong>${pollutant}</strong></td>`;
    for (const month of months) {
      const value = dataStore.years[year][month]?.[pollutant]?.[measure];
      html += `<td>${formatNumber(value)}</td>`;
    }
    html += '</tr>';
  }

  if (dataStore.wind && dataStore.wind.years && dataStore.wind.years[year]) {
    html += `<tr class="section-row"><td colspan="${months.length + 1}"><strong>Shamol tezligi (m/s) yo'nalishlarga ko'ra</strong></td></tr>`;
    const directions = dataStore.wind.directions || [];
    for (const direction of directions) {
      html += `<tr><td>${direction}</td>`;
      for (const month of months) {
        const value = dataStore.wind.years[year][month]?.[direction];
        html += `<td>${formatNumber(value)}</td>`;
      }
      html += '</tr>';
    }
  }

  html += '</tbody>';
  table.innerHTML = html;
}

function buildWindChart(year) {
  const directions = dataStore.wind?.directions || [];
  if (!directions.length || !dataStore.wind.years[year]) {
    if (chartWind) {
      chartWind.destroy();
      chartWind = null;
    }
    return;
  }

  const directionValues = directions.map((direction) => {
    const values = dataStore.months.map((month) => dataStore.wind.years[year][month]?.[direction]);
    const valid = values.filter((v) => v !== null && v !== undefined);
    return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
  });

  const windCtx = document.getElementById('windChart').getContext('2d');
  if (chartWind) chartWind.destroy();

  chartWind = new Chart(windCtx, {
    type: 'radar',
    data: {
      labels: directions,
      datasets: [
        {
          label: `${year} yil shamol yo'nalishlari (o'rtacha)`,
          data: directionValues,
          backgroundColor: 'rgba(66, 194, 213, 0.25)',
          borderColor: '#4dd0e1',
          borderWidth: 2,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#4dd0e1',
          pointRadius: 4,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(8, 18, 42, 0.96)',
          titleColor: '#7eb8ff',
          bodyColor: '#eef3ff',
          borderColor: 'rgba(87,167,255,0.35)',
          borderWidth: 1,
          padding: 14,
          cornerRadius: 10,
          displayColors: false,
          callbacks: {
            title: (items) => items[0]?.label || '',
            label: (ctx) => ` Tezlik: ${formatNumber(ctx.parsed.r)} m/s`,
          },
        },
      },
      scales: {
        r: {
          beginAtZero: true,
          grid: { color: '#edf2f8' },
          angleLines: { color: '#edf2f8' },
          pointLabels: { color: '#f0f6ff' },
          ticks: {
            backdropColor: 'rgba(16, 31, 55, 0.8)',
            color: '#cbd8ff',
          },
        },
      },
    },
  });
}

function buildCharts(year, pollutant, measure) {
  const monthCtx = document.getElementById('monthChart').getContext('2d');
  const pollutantCtx = document.getElementById('pollutantChart').getContext('2d');

  if (chartMonth) chartMonth.destroy();
  if (chartPollutant) chartPollutant.destroy();

  const months = dataStore.months;
  const values = months.map((month) => dataStore.years[year][month]?.[pollutant]?.[measure]);

  chartMonth = new Chart(monthCtx, {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        {
          label: `${gasLabel(pollutant)} — ${measure === 'Mean' ? 'O\'rtacha' : 'Maksimal'}`,
          data: values,
          borderColor: '#4dd0e1',
          backgroundColor: 'rgba(77, 208, 225, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#4dd0e1',
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#b5c4e6', font: { size: 12 } },
        },
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(8, 18, 42, 0.96)',
          titleColor: '#7eb8ff',
          bodyColor: '#eef3ff',
          borderColor: 'rgba(87,167,255,0.35)',
          borderWidth: 1,
          padding: 14,
          cornerRadius: 10,
          displayColors: false,
          callbacks: {
            title: (items) => items[0]?.label || '',
            label: (ctx) => ` ${ctx.dataset.label}: ${formatNumber(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        y: {
          ticks: { color: '#9eb4db' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
        },
        x: {
          ticks: { color: '#9eb4db' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
        },
      },
    },
  });

  const pollutants = dataStore.pollutants;
  const pollutantValues = pollutants.map((p) => {
    const monthValues = dataStore.months.map((m) => dataStore.years[year][m]?.[p]?.[measure]);
    const valid = monthValues.filter((v) => v !== null && v !== undefined);
    return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
  });

  chartPollutant = new Chart(pollutantCtx, {
    type: 'bar',
    data: {
      labels: pollutants.map(gasLabel),
      datasets: [
        {
          label: measure === 'Mean' ? 'O\'rtacha' : 'Maksimal',
          data: pollutantValues,
          backgroundColor: 'rgba(87, 167, 255, 0.7)',
          borderColor: '#57a7ff',
          borderWidth: 1,
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#b5c4e6', font: { size: 12 } },
        },
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(8, 18, 42, 0.96)',
          titleColor: '#7eb8ff',
          bodyColor: '#eef3ff',
          borderColor: 'rgba(87,167,255,0.35)',
          borderWidth: 1,
          padding: 14,
          cornerRadius: 10,
          displayColors: false,
          callbacks: {
            title: (items) => items[0]?.label || '',
            label: (ctx) => ` ${ctx.dataset.label}: ${formatNumber(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        y: {
          ticks: { color: '#9eb4db' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
        },
        x: {
          ticks: {
            color: '#9eb4db',
            autoSkip: false,
            maxRotation: 45,
            minRotation: 30,
          },
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
        },
      },
    },
  });

  buildWindChart(year);
}

function updateDashboard() {
  const year = document.getElementById('yearSelect').value;
  const pollutant = document.getElementById('pollutantSelect').value;
  const measure = document.getElementById('measureSelect').value;

  buildTable(year, measure);
  buildCharts(year, pollutant, measure);
  buildWindChart(year);
}

function initSelectors() {
  const yearSelect = document.getElementById('yearSelect');
  const pollutantSelect = document.getElementById('pollutantSelect');
  const measureSelect = document.getElementById('measureSelect');

  dataStore.years && Object.keys(dataStore.years).forEach((year) => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    yearSelect.appendChild(option);
  });

  dataStore.pollutants.forEach((pollutant) => {
    const option = document.createElement('option');
    option.value = pollutant;
    option.textContent = gasLabel(pollutant);
    pollutantSelect.appendChild(option);
  });

  yearSelect.value = Object.keys(dataStore.years).slice(-1)[0];
  pollutantSelect.value = dataStore.pollutants[0];

  yearSelect.addEventListener('change', updateDashboard);
  pollutantSelect.addEventListener('change', updateDashboard);
  measureSelect.addEventListener('change', updateDashboard);
}

function initMap() {
  const mapContainer = document.getElementById('map');
  map = L.map(mapContainer, { zoomControl: true }).setView([39.6, 66.9], 11);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  geoLayer = L.geoJSON(geojson, {
    style: {
      color: '#285d9e',
      weight: 2,
      fillColor: '#5189d7',
      fillOpacity: 0.25,
    },
  }).addTo(map);

  stationsLayer = L.geoJSON(stationsGeojson, {
    pointToLayer: function (feature, latlng) {
      const color = feature.properties.color || '#e74c3c';
      return L.circleMarker(latlng, {
        radius: 10,
        fillColor: color,
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
      });
    },
    onEachFeature: function (feature, layer) {
      const name = feature.properties.name;
      layer.bindPopup(
        `<div style="font-weight:bold;font-size:13px;">${name}</div>`,
        { closeButton: true }
      );
      layer.bindTooltip(name, { permanent: true, direction: 'top', offset: [0, -12], className: 'station-label' });
    },
  }).addTo(map);

  const overlays = {
    'Stansiyalar': stationsLayer,
    'Samarqand': geoLayer,
  };
  L.control.layers(null, overlays, { collapsed: false }).addTo(map);

  map.fitBounds(geoLayer.getBounds(), { padding: [20, 20] });
}

function loadLeafletScript() {
  if (typeof L !== 'undefined') {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Leaflet skripti yuklanmadi. Iltimos, internet aloqangizni tekshiring.'));
    document.head.appendChild(script);
  });
}

async function loadData() {
  try {
    await loadLeafletScript();

    const [dataResp, geoResp, stationsResp] = await Promise.all([
      fetch('data/samarqand_data.json'),
      fetch('samarqand.json'),
      fetch('data/stations.geojson'),
    ]);

    if (!dataResp.ok || !geoResp.ok || !stationsResp.ok) {
      throw new Error('Data fayllarini yuklashda hatolik yuz berdi. Iltimos, dashboardni server orqali oching.');
    }

    dataStore = await dataResp.json();
    geojson = await geoResp.json();
    stationsGeojson = await stationsResp.json();

    initSelectors();
    initMap();
    updateDashboard();
  } catch (err) {
    document.body.innerHTML = `<div class="error"><h2>Xatolik</h2><p>${err.message}</p><p>Oddiy serverni ishga tushiring: <code>python -m http.server 8000</code></p></div>`;
  }
}

window.addEventListener('DOMContentLoaded', loadData);
