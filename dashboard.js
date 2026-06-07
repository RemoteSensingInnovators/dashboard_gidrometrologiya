let chartMonth = null;
let chartPollutant = null;
let chartWind = null;
let map = null;
let geoLayer = null;
let stationsLayer = null;
let dataStore = null;
let geojson = null;
let stationsGeojson = null;

function makeTooltip(labelFn) {
  return {
    enabled: false,
    external(context) {
      const { chart, tooltip } = context;
      let el = document.getElementById('chart-tooltip');
      if (!el) {
        el = document.createElement('div');
        el.id = 'chart-tooltip';
        document.body.appendChild(el);
      }

      if (tooltip.opacity === 0) {
        el.style.opacity = '0';
        return;
      }

      const item = tooltip.dataPoints?.[0];
      if (!item) return;

      const title = tooltip.title?.[0] || '';
      const value = labelFn(item);

      el.innerHTML = `
        <div class="ct-title">${title}</div>
        <div class="ct-value">${value}</div>
      `;

      const rect = chart.canvas.getBoundingClientRect();
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;

      let left = rect.left + scrollX + tooltip.caretX;
      let top  = rect.top  + scrollY + tooltip.caretY - 58;

      el.style.opacity = '1';
      el.style.left = left + 'px';
      el.style.top  = top  + 'px';
    },
  };
}

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

// Har bir modda uchun xarita chegarasi rangi:
// max  → tuqroq (to'q) rang  (Maksimal ko'rsatkich uchun)
// mean → ochroq rang         (O'rtacha ko'rsatkich uchun)
const POLLUTANT_COLORS = {
  SO2:   { max: '#7a4400', mean: '#d4843e' },  // to'q sariq-jigarrang → ochiq sariq-jigarrang
  NO2:   { max: '#6b1515', mean: '#c04040' },  // to'q qizil-jigarrang → ochiq qizil
  NH3:   { max: '#1a4a2e', mean: '#3a9a60' },  // to'q yashil → ochiq yashil
  HF:    { max: '#3d1a5c', mean: '#8a50c8' },  // to'q binafsha → ochiq binafsha
  NO:    { max: '#5c3300', mean: '#c07020' },  // to'q to'q sariq → ochiq sariq-to'q
  Fenol: { max: '#5c1a3d', mean: '#c04080' },  // to'q pushti-qizil → ochiq pushti
  CO:    { max: '#4a0000', mean: '#aa2020' },  // juda to'q qizil → qizil
  CL:    { max: '#3a4a00', mean: '#86aa00' },  // to'q zaytun → ochiq zaytun-yashil
  Chang: { max: '#3a2710', mean: '#8a6040' },  // to'q tuproq-jigarrang → ochiq jigarrang
};

function darkenHex(hex, amount) {
  const factor = amount !== undefined ? amount : 0.55;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const toHex = (v) => Math.round(v * factor).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function updateMapColor() {
  if (!geoLayer) return;
  const pollutant = document.getElementById('pollutantSelect').value;
  const measure = document.getElementById('measureSelect').value;
  const colors = POLLUTANT_COLORS[pollutant] || { max: '#3a2710', mean: '#8a6040' };
  const fillColor = measure === 'Max' ? colors.max : colors.mean;
  const borderColor = darkenHex(fillColor, 0.6);

  geoLayer.setStyle({
    color: borderColor,
    weight: 2,
    fillColor: fillColor,
    fillOpacity: 0.45,
  });
}

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
        tooltip: makeTooltip((item) => `${formatNumber(item.parsed.r)} m/s`),
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
        legend: { labels: { color: '#b5c4e6', font: { size: 12 } } },
        tooltip: makeTooltip((item) => formatNumber(item.parsed.y)),
      },
      scales: {
        y: { ticks: { color: '#9eb4db' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        x: { ticks: { color: '#9eb4db' }, grid: { color: 'rgba(255,255,255,0.05)' } },
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
        legend: { labels: { color: '#b5c4e6', font: { size: 12 } } },
        tooltip: makeTooltip((item) => formatNumber(item.parsed.y)),
      },
      scales: {
        y: { ticks: { color: '#9eb4db' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        x: {
          ticks: { color: '#9eb4db', autoSkip: false, maxRotation: 45, minRotation: 30 },
          grid: { color: 'rgba(255,255,255,0.05)' },
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
  updateMapColor();
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
