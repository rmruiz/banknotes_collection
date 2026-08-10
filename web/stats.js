/**
 * Dashboard de Estadísticas Numismáticas - Colección de Billetes
 * Renderiza métricas, mapa mundial interactivo (D3 + TopoJSON) y gráficos.
 */

(function () {
  'use strict';

  // Mapa de códigos ISO 3166-1 numéricos -> ISO 3166-1 Alpha-2
  const NUMERIC_TO_A2 = {
    "004": "AF", "008": "AL", "010": "AQ", "012": "DZ", "016": "AS", "020": "AD", "024": "AO", "028": "AG", "031": "AZ",
    "032": "AR", "036": "AU", "040": "AT", "044": "BS", "048": "BH", "050": "BD", "051": "AM", "052": "BB",
    "056": "BE", "060": "BM", "064": "BT", "068": "BO", "070": "BA", "072": "BW", "076": "BR", "084": "BZ",
    "090": "SB", "092": "VG", "096": "BN", "100": "BG", "104": "MM", "108": "BI", "112": "BY", "116": "KH",
    "120": "CM", "124": "CA", "132": "CV", "136": "KY", "140": "CF", "144": "LK", "148": "TD", "152": "CL",
    "156": "CN", "158": "TW", "170": "CO", "174": "KM", "178": "CG", "180": "CD", "184": "CK", "188": "CR",
    "191": "HR", "192": "CU", "196": "CY", "203": "CZ", "204": "BJ", "208": "DK", "212": "DM", "214": "DO",
    "218": "EC", "222": "SV", "226": "GQ", "231": "ET", "232": "ER", "233": "EE", "234": "FO", "238": "FK",
    "242": "FJ", "246": "FI", "250": "FR", "254": "GF", "258": "PF", "260": "TF", "262": "DJ", "266": "GA",
    "268": "GE", "270": "GM", "275": "PS", "276": "DE", "288": "GH", "292": "GI", "300": "GR", "304": "GL",
    "308": "GD", "312": "GP", "316": "GU", "320": "GT", "324": "GN", "328": "GY", "332": "HT", "336": "VA",
    "340": "HN", "344": "HK", "348": "HU", "352": "IS", "356": "IN", "360": "ID", "364": "IR", "368": "IQ",
    "372": "IE", "376": "IL", "380": "IT", "384": "CI", "388": "JM", "392": "JP", "398": "KZ", "400": "JO",
    "404": "KE", "408": "KP", "410": "KR", "414": "KW", "417": "KG", "418": "LA", "422": "LB", "426": "LS",
    "428": "LV", "430": "LR", "434": "LY", "438": "LI", "440": "LT", "442": "LU", "446": "MO", "450": "MG",
    "454": "MW", "458": "MY", "462": "MV", "466": "ML", "470": "MT", "474": "MQ", "478": "MR", "480": "MU",
    "484": "MX", "492": "MC", "496": "MN", "498": "MD", "499": "ME", "504": "MA", "508": "MZ", "512": "OM",
    "516": "NA", "520": "NR", "524": "NP", "528": "NL", "531": "CW", "533": "AW", "540": "NC", "548": "VU",
    "554": "NZ", "558": "NI", "562": "NE", "566": "NG", "578": "NO", "585": "PW", "586": "PK", "591": "PA",
    "598": "PG", "600": "PY", "604": "PE", "608": "PH", "616": "PL", "620": "PT", "624": "GW", "626": "TL",
    "630": "PR", "634": "QA", "638": "RE", "642": "RO", "643": "RU", "646": "RW", "654": "SH", "659": "KN",
    "662": "LC", "670": "VC", "674": "SM", "678": "ST", "682": "SA", "686": "SN", "688": "RS", "690": "SC",
    "694": "SL", "702": "SG", "703": "SK", "704": "VN", "705": "SI", "706": "SO", "710": "ZA", "716": "ZW",
    "724": "ES", "728": "SS", "729": "SD", "732": "EH", "740": "SR", "748": "SZ", "752": "SE", "756": "CH",
    "760": "SY", "762": "TJ", "764": "TH", "768": "TG", "776": "TO", "780": "TT", "784": "AE", "788": "TN",
    "792": "TR", "795": "TM", "800": "UG", "804": "UA", "807": "MK", "818": "EG", "826": "GB", "831": "GG",
    "832": "JE", "833": "IM", "834": "TZ", "840": "US", "854": "BF", "858": "UY", "860": "UZ", "862": "VE",
    "876": "WF", "882": "WS", "887": "YE", "894": "ZM"
  };

  let allNotes = [];
  let allCountries = {};
  let notesByCountryCode = {}; // code -> [notes]
  let notesByIsoA2 = {};        // ISO_A2 -> [notes]
  let missingCountriesList = [];

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    try {
      let notesData, countriesData;

      try {
        const notesRes = await fetch('data/collection.json');
        notesData = await notesRes.json();
      } catch (e) {
        console.error('Error cargando data/collection.json:', e);
      }

      try {
        const countriesRes = await fetch('data/countries.json');
        countriesData = await countriesRes.json();
      } catch (e) {
        try {
          const fallbackRes = await fetch('../_json/countries.json');
          countriesData = await fallbackRes.json();
        } catch (err2) {
          console.error('Error cargando countries.json:', err2);
        }
      }

      allNotes = notesData || [];
      allCountries = countriesData || {};

      processData();
      renderKPIs();
      renderMap();
      renderMissingCountries();
      renderCharts();

      // Ocultar botón de edición en producción (solo lectura)
      const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      if (!isLocal) {
        document.querySelectorAll('a[href="index-edit.html"]').forEach((el) => el.style.display = "none");
      }

      // Buscador de países faltantes
      const searchInput = document.getElementById('search-missing');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          filterMissingCountries(e.target.value);
        });
      }
    } catch (err) {
      console.error('Error al inicializar dashboard:', err);
    }
  }

  function processData() {
    notesByCountryCode = {};
    notesByIsoA2 = {};

    allNotes.forEach(note => {
      const code = (note.country_code || '').toLowerCase();
      if (!notesByCountryCode[code]) {
        notesByCountryCode[code] = [];
      }
      notesByCountryCode[code].push(note);

      // Mapear también por ISO Alpha 2 si existe en countries.json
      const cInfo = allCountries[code];
      if (cInfo && cInfo.iso_alpha2) {
        const a2 = cInfo.iso_alpha2.toUpperCase();
        if (!notesByIsoA2[a2]) notesByIsoA2[a2] = [];
        notesByIsoA2[a2].push(note);
      }
    });

    // Identificar países faltantes de countries.json
    missingCountriesList = [];
    Object.values(allCountries).forEach(cInfo => {
      const code = cInfo.code.toLowerCase();
      const count = (notesByCountryCode[code] || []).length;
      if (count === 0) {
        missingCountriesList.push(cInfo);
      }
    });

    missingCountriesList.sort((a, b) => a.name.es.localeCompare(b.name.es, 'es'));
  }

  function renderKPIs() {
    const totalNotes = allNotes.length;
    const totalCountriesInCatalog = Object.keys(allCountries).length;
    const ownedCountriesCount = Object.keys(allCountries).filter(code => (notesByCountryCode[code] || []).length > 0).length;
    const missingCount = missingCountriesList.length;
    const pctOwned = totalCountriesInCatalog ? ((ownedCountriesCount / totalCountriesInCatalog) * 100).toFixed(1) : 0;

    const verifiedCount = allNotes.filter(n => n.verificado).length;
    const pctVerified = totalNotes ? ((verifiedCount / totalNotes) * 100).toFixed(1) : 0;

    const currenciesSet = new Set(allNotes.map(n => (n.moneda || '').trim()).filter(Boolean));
    const specialCount = allNotes.filter(n => n.conmemorativo || n.remarcado).length;

    document.getElementById('kpi-total-notes').textContent = totalNotes.toLocaleString('es-ES');
    document.getElementById('kpi-countries-owned').textContent = `${ownedCountriesCount} / ${totalCountriesInCatalog}`;
    document.getElementById('kpi-countries-pct').textContent = `${pctOwned}%`;
    document.getElementById('kpi-countries-missing').textContent = missingCount;
    document.getElementById('kpi-verified-pct').textContent = `${pctVerified}%`;
    document.getElementById('kpi-currencies-count').textContent = currenciesSet.size;
    document.getElementById('kpi-special-count').textContent = specialCount;
    document.getElementById('missing-count-header').textContent = missingCount;
  }

  function renderMap() {
    const svg = d3.select('#world-map');
    const width = 960;
    const height = 500;

    svg.selectAll('*').remove(); // Limpiar

    const projection = d3.geoMercator()
      .scale(130)
      .translate([width / 2, height / 1.5]);

    const path = d3.geoPath().projection(projection);

    const g = svg.append('g');

    // Zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([1, 8])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    document.getElementById('zoom-in').onclick = () => svg.transition().call(zoom.scaleBy, 1.4);
    document.getElementById('zoom-out').onclick = () => svg.transition().call(zoom.scaleBy, 0.7);
    document.getElementById('zoom-reset').onclick = () => svg.transition().call(zoom.transform, d3.zoomIdentity);

    const tooltip = document.getElementById('map-tooltip');

    // Cargar TopoJSON del mundo (localmente primero, luego fallback CDN)
    const loadWorldMap = d3.json('data/world-110m.json')
      .catch(() => d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'));

    function findCountryInfo(d, a2) {
      if (a2) {
        const c = Object.values(allCountries).find(c => c.iso_alpha2 && c.iso_alpha2.toUpperCase() === a2);
        if (c) return c;
      }
      if (d && d.properties && d.properties.name) {
        const pName = d.properties.name.toLowerCase().trim();
        const cByName = Object.values(allCountries).find(c => {
          const esName = (c.name && c.name.es) ? c.name.es.toLowerCase().trim() : '';
          const enName = (c.name && c.name.en) ? c.name.en.toLowerCase().trim() : '';
          return esName === pName || enName === pName;
        });
        if (cByName) return cByName;
      }
      return null;
    }

    loadWorldMap.then(world => {
      const countriesGeo = topojson.feature(world, world.objects.countries).features;

      g.selectAll('path')
        .data(countriesGeo)
        .enter()
        .append('path')
        .attr('d', path)
        .attr('class', d => {
          const numId = d.id ? String(d.id).padStart(3, '0') : '';
          const a2 = NUMERIC_TO_A2[numId];
          const cInfo = findCountryInfo(d, a2);

          const notes = cInfo ? (notesByCountryCode[cInfo.code.toLowerCase()] || []) : [];
          if (notes.length > 0) return 'country-path owned';
          if (cInfo) return 'country-path missing';
          return 'country-path gray';
        })
        .on('mouseover', (event, d) => {
          const numId = d.id ? String(d.id).padStart(3, '0') : '';
          const a2 = NUMERIC_TO_A2[numId];
          const cInfo = findCountryInfo(d, a2);

          let name = d.properties ? d.properties.name : 'Desconocido';
          let count = 0;
          let flagUrl = '';

          if (cInfo) {
            name = cInfo.name.es;
            count = (notesByCountryCode[cInfo.code.toLowerCase()] || []).length;
            flagUrl = `../_flags/${cInfo.flag}`;
          }

          tooltip.removeAttribute('hidden');
          tooltip.style.left = (event.offsetX + 15) + 'px';
          tooltip.style.top = (event.offsetY - 10) + 'px';

          const statusBadge = count > 0 
            ? `<span style="color:#10b981; font-weight:bold;">🟢 ${count} billete(s)</span>`
            : (cInfo 
                ? `<span style="color:#ef4444; font-weight:bold;">🔴 Faltante</span>`
                : `<span style="color:#94a3b8; font-weight:bold;">⚪ Sin datos / Fuera de catálogo</span>`);

          const displayCode = (cInfo && cInfo.iso_alpha2) || a2 || (cInfo && cInfo.code ? cInfo.code.toUpperCase() : 'N/A');

          tooltip.innerHTML = `
            <div style="display:flex; align-items:center; gap:6px;">
              ${flagUrl ? `<img src="${flagUrl}" style="width:20px; height:14px; object-fit:cover; border-radius:2px;">` : ''}
              <strong>${name}</strong> (${displayCode})
            </div>
            <div style="margin-top:4px; font-size:0.75rem;">${statusBadge}</div>
          `;
        })
        .on('mousemove', (event) => {
          tooltip.style.left = (event.offsetX + 15) + 'px';
          tooltip.style.top = (event.offsetY - 10) + 'px';
        })
        .on('mouseout', () => {
          tooltip.setAttribute('hidden', '');
        })
        .on('click', (event, d) => {
          const numId = d.id ? String(d.id).padStart(3, '0') : '';
          const a2 = NUMERIC_TO_A2[numId];
          const cInfo = findCountryInfo(d, a2);
          if (cInfo) {
            openCountryModal(cInfo);
          }
        });
    }).catch(err => {
      console.error('Error al cargar mapa mundial TopoJSON:', err);
    });
  }

  function renderMissingCountries() {
    filterMissingCountries('');
  }

  function filterMissingCountries(query) {
    const grid = document.getElementById('missing-countries-grid');
    grid.innerHTML = '';

    const q = (query || '').toLowerCase().trim();
    const filtered = missingCountriesList.filter(c => 
      c.name.es.toLowerCase().includes(q) || 
      c.name.en.toLowerCase().includes(q) || 
      c.code.toLowerCase().includes(q)
    );

    if (filtered.length === 0) {
      grid.innerHTML = '<div style="color:#94a3b8; font-size:0.85rem;">No se encontraron países faltantes que coincidan con la búsqueda.</div>';
      return;
    }

    filtered.forEach(cInfo => {
      const card = document.createElement('div');
      card.className = 'missing-card';
      card.onclick = () => openCountryModal(cInfo);

      card.innerHTML = `
        <img src="../_flags/${cInfo.flag}" class="missing-flag" alt="" onerror="this.style.display='none'">
        <span class="missing-name" title="${cInfo.name.es}">${cInfo.name.es}</span>
        <span class="missing-code">${cInfo.iso_alpha2 || cInfo.code}</span>
      `;
      grid.appendChild(card);
    });
  }

  function renderCharts() {
    // 1. Top 15 Países
    const countryCounts = {};
    allNotes.forEach(n => {
      const pais = n.pais || 'Desconocido';
      countryCounts[pais] = (countryCounts[pais] || 0) + 1;
    });

    const sortedCountries = Object.entries(countryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    renderBarList('top-countries-list', sortedCountries, allNotes.length);

    // 2. Décadas
    const decadeCounts = {};
    allNotes.forEach(n => {
      const yr = parseInt(n.anio, 10);
      if (yr && yr > 1800 && yr < 2100) {
        const dec = Math.floor(yr / 10) * 10;
        const key = `${dec}s`;
        decadeCounts[key] = (decadeCounts[key] || 0) + 1;
      } else {
        decadeCounts['Sin fecha / Otro'] = (decadeCounts['Sin fecha / Otro'] || 0) + 1;
      }
    });

    const sortedDecades = Object.entries(decadeCounts)
      .sort((a, b) => {
        if (a[0].startsWith('Sin')) return 1;
        if (b[0].startsWith('Sin')) return -1;
        return parseInt(a[0]) - parseInt(b[0]);
      });

    renderBarList('decades-chart-list', sortedDecades, allNotes.length);

    // 3. Estado de Conservación
    const condCounts = {};
    allNotes.forEach(n => {
      const cond = (n.condicion || 'Sin especificar').trim().toUpperCase() || 'Sin especificar';
      condCounts[cond] = (condCounts[cond] || 0) + 1;
    });

    const sortedConds = Object.entries(condCounts).sort((a, b) => b[1] - a[1]);
    renderBarList('conditions-chart-list', sortedConds, allNotes.length);

    // 4. Monedas Más Frecuentes
    const currCounts = {};
    allNotes.forEach(n => {
      const curr = (n.moneda || 'Sin moneda').trim() || 'Sin moneda';
      currCounts[curr] = (currCounts[curr] || 0) + 1;
    });

    const sortedCurrs = Object.entries(currCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);
    renderBarList('currencies-chart-list', sortedCurrs, allNotes.length);
  }

  function renderBarList(elementId, dataItems, total) {
    const container = document.getElementById(elementId);
    container.innerHTML = '';

    const maxCount = dataItems.length ? Math.max(...dataItems.map(d => d[1])) : 1;

    dataItems.forEach(([label, count]) => {
      const pct = ((count / total) * 100).toFixed(1);
      const barWidthPct = ((count / maxCount) * 100).toFixed(1);

      const row = document.createElement('div');
      row.className = 'chart-row';
      row.innerHTML = `
        <div class="chart-row-meta">
          <span>${label}</span>
          <span><strong>${count}</strong> (${pct}%)</span>
        </div>
        <div class="chart-bar-bg">
          <div class="chart-bar-fill" style="width: ${barWidthPct}%;"></div>
        </div>
      `;
      container.appendChild(row);
    });
  }

  function openCountryModal(cInfo) {
    const modal = document.getElementById('country-modal');
    const nameEl = document.getElementById('country-modal-name');
    const flagEl = document.getElementById('country-modal-flag');
    const summaryEl = document.getElementById('country-modal-summary');
    const notesListEl = document.getElementById('country-modal-notes-list');

    nameEl.textContent = cInfo.name.es;
    flagEl.src = `../_flags/${cInfo.flag}`;

    const notes = notesByCountryCode[cInfo.code.toLowerCase()] || [];
    if (notes.length > 0) {
      summaryEl.innerHTML = `Tienes <strong>${notes.length}</strong> billete(s) de <strong>${cInfo.name.es}</strong> en la colección.`;
      notesListEl.innerHTML = '';
      notes.forEach(n => {
        const card = document.createElement('div');
        card.className = 'note-mini-card';
        card.innerHTML = `
          <span class="note-mini-pick">${n.pick || n.id}</span>
          <span class="note-mini-val">${n.denominacion || n.valor + ' ' + n.moneda}</span>
          <span class="note-mini-year">${n.anio || 's/f'}</span>
        `;
        notesListEl.appendChild(card);
      });
    } else {
      summaryEl.innerHTML = `Actualmente <strong>no tienes billetes</strong> de <strong>${cInfo.name.es}</strong>.`;
      notesListEl.innerHTML = '<div style="color:#94a3b8; font-size:0.8rem; grid-column: 1/-1;">País pendiente de colección.</div>';
    }

    modal.showModal();

    document.getElementById('country-modal-close').onclick = () => modal.close();
  }

})();
