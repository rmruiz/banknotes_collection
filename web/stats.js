/**
 * Dashboard de Estadísticas Numismáticas - Colección de Billetes
 * Renderiza métricas, mapa mundial interactivo (D3 + TopoJSON) y gráficos.
 */

(function () {
    'use strict';

    let allNotes = [];
    let allCountries = {};
    let allCurrencies = {};
    let notesByCountryCode = {}; // code -> [notes]
    let notesByIsoA2 = {};          // ISO_A2 -> [notes]
    let missingCountriesList = [];
    let numericToCountry = {};
    let ownedCurrencies = new Set(); // códigos ISO 4217 presentes en la colección

    // Códigos ISO 4217 de "fondo"/reporte que usa countries.json en
    // moneda_vigente (USN, COU, CHW, BOV, UYW…) mapeados al código de
    // circulación equivalente (USD, COP, CHF, BOB, UYU…) que usa la
    // colección. Sin esto, países como EE. UU. o Colombia quedarían en rojo
    // aunque se posea su moneda vigente.
    const FUND_CODE_ALIASES = {
        BOV: 'BOB', CHE: 'CHF', CHW: 'CHF', CHY: 'CHF', COU: 'COP',
        GWP: 'GPE', GYE: 'GYF', MXV: 'MXN', PTV: 'PTL',
        UYP: 'UYU', UYW: 'UYU', USN: 'USD'
    };
    function normalizeCurrency(code) {
        if (!code) return '';
        const up = String(code).trim().toUpperCase();
        return FUND_CODE_ALIASES[up] || up;
    }

    // Escapa caracteres especiales para insertar texto de forma segura en HTML
    // (copiado de web/app.js).
    function esc(s) {
        return String(s ?? "").replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
        }[c]));
    }

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        try {
            let notesData, countriesData, currenciesData;

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

            try {
                const currenciesRes = await fetch('data/currencies.json');
                currenciesData = await currenciesRes.json();
            } catch (e) {
                console.error('Error cargando data/currencies.json:', e);
            }

            allNotes = notesData || [];
            allCountries = countriesData || {};
            allCurrencies = currenciesData || {};

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
        numericToCountry = {};
        Object.values(allCountries).forEach(c => {
            if (c.iso_numeric) {
                numericToCountry[String(c.iso_numeric).padStart(3, '0')] = c;
             }
         });

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

        // Monedas (código ISO 4217) presentes en la colección, normalizando
        // los códigos "fund" a su equivalente de circulación.
        // Se usa para el mapa de "Cobertura de Moneda Vigente": los países
        // se colorean según si su moneda_vigente (también ISO 4217) está aquí.
        ownedCurrencies = new Set(
            allNotes.map(n => normalizeCurrency(n.currency_code)).filter(Boolean)
        );

        // Identificar países faltantes de countries.json
        missingCountriesList = [];
        Object.values(allCountries).forEach(cInfo => {
            // Ignorar paises sin moneda propia (no tienen billetes)
            if (cInfo.moneda_propia === 'no') return;
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
        // Paises del catalogo con moneda propia (con billetes);
        // los paises sin moneda propia no cuentan ni como tenidos ni como faltantes.
        const catalogCountryCodes = Object.keys(allCountries).filter(code => {
            const c = allCountries[code];
            return !(c && c.moneda_propia === 'no');
        });
        const totalCountriesInCatalog = catalogCountryCodes.length;
        const ownedCountriesCount = catalogCountryCodes.filter(code => (notesByCountryCode[code] || []).length > 0).length;
        const missingCount = missingCountriesList.length;
        const pctOwned = totalCountriesInCatalog ? ((ownedCountriesCount / totalCountriesInCatalog) * 100).toFixed(1) : 0;

        const currenciesSet = new Set(allNotes.map(n => n.currency_code || '').filter(Boolean));
        const specialCount = allNotes.filter(n => n.conmemorativo || n.remarcado).length;

        document.getElementById('kpi-total-notes').textContent = totalNotes.toLocaleString('es-ES');
        document.getElementById('kpi-countries-owned').textContent = `${ownedCountriesCount} / ${totalCountriesInCatalog}`;
        document.getElementById('kpi-countries-pct').textContent = `${pctOwned}%`;
        document.getElementById('kpi-countries-missing').textContent = missingCount;
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

        // Cobertura de Moneda Vigente:
        //  - 'owned'   (verde): la moneda_vigente del país está en la colección.
        //  - 'missing' (rojo):  el país existe en el catálogo y define
        //                       moneda_vigente, pero no la posee en la colección
        //                       (incluye países sin billetes o solo con billetes
        //                       de monedas históricas ya no vigentes).
        //  - 'gray'    (gris):  el país no está en el catálogo o no define
        //                       moneda_vigente (p. ej. sin moneda propia).
        function getMapStatus(cInfo) {
            if (!cInfo || !cInfo.moneda_vigente) return 'gray';
            return ownedCurrencies.has(normalizeCurrency(cInfo.moneda_vigente))
                ? 'owned'
                : 'missing';
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
                    const cInfo = numericToCountry[numId] || findCountryInfo(d, null);
                    return `country-path ${getMapStatus(cInfo)}`;
                })
                .on('mouseover', (event, d) => {
                    const numId = d.id ? String(d.id).padStart(3, '0') : '';
                    const cInfo = numericToCountry[numId] || findCountryInfo(d, null);

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

                    const mv = cInfo && cInfo.moneda_vigente;
                    const mapStatus = getMapStatus(cInfo);
                    const countLine = count > 0 ? ` · ${count} billete(s) en catálogo` : '';

                    let statusBadge;
                    if (!cInfo) {
                        statusBadge = `<span style="color:#94a3b8; font-weight:bold;">⚪ Sin datos / Fuera de catálogo</span>`;
                    } else if (!mv) {
                        statusBadge = `<span style="color:#94a3b8; font-weight:bold;">⚪ Sin moneda vigente definida</span>` + countLine;
                    } else if (mapStatus === 'owned') {
                        statusBadge = `<span style="color:#10b981; font-weight:bold;">🟢 Moneda vigente en la colección: ${mv}</span>` + countLine;
                    } else {
                        statusBadge = `<span style="color:#ef4444; font-weight:bold;">🔴 Moneda vigente faltante: ${mv}</span>` + countLine;
                    }

                    // (antes referenciaba `a2`, indefinida en este scope: ReferenceError)
                    const displayCode = (cInfo && cInfo.iso_alpha2) || (cInfo && cInfo.code ? cInfo.code.toUpperCase() : 'N/A');

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
                    const cInfo = numericToCountry[numId] || findCountryInfo(d, null);
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
            // 1. Países con más billetes (todos, sin límite)
        const countryCounts = {};
        allNotes.forEach(n => {
            const pais = n.pais || 'Desconocido';
            countryCounts[pais] = (countryCounts[pais] || 0) + 1;
        });

        const sortedCountries = Object.entries(countryCounts)
            .sort((a, b) => b[1] - a[1])
                ;

        renderBarList('top-countries-list', sortedCountries, allNotes.length, (label) => {
            if (label === 'DESCONOCIDO') return `pais:""`;
            return `pais:"${label}"`;
        });

        // 2. Décadas
        const decadeCounts = {};
        allNotes.forEach(n => {
            const yr = parseInt(n.anio, 10);
            if (yr && yr > 1800 && yr < 2100) {
                const dec = Math.floor(yr / 10) * 10;
                const key = `${dec}s`;
                decadeCounts[key] = (decadeCounts[key] || 0) + 1;
            } else {
                decadeCounts['Sin fecha'] = (decadeCounts['Sin fecha'] || 0) + 1;
            }
        });

        const sortedDecades = Object.entries(decadeCounts)
            .sort((a, b) => {
                if (a[0].startsWith('Sin')) return 1;
                if (b[0].startsWith('Sin')) return -1;
                return parseInt(a[0]) - parseInt(b[0]);
            });

        renderBarList('decades-chart-list', sortedDecades, allNotes.length, (label) => {
            const m = label.match(/(\d{4})/);
            if (m) {
                const start = parseInt(m[1], 10);
                const end = start + 10;
                return `anio>=${start} anio<${end}`;
            }
            if (label === 'SIN FECHA') return `anio:""`;
            return `anio:(${label})`;
        });

        // 3. Estado de Conservación
        const condCounts = {};
        allNotes.forEach(n => {
            const cond = (n.condicion || 'Sin especificar').trim().toUpperCase() || 'Sin especificar';
            condCounts[cond] = (condCounts[cond] || 0) + 1;
        });

        const sortedConds = Object.entries(condCounts).sort((a, b) => b[1] - a[1]);
        renderBarList('conditions-chart-list', sortedConds, allNotes.length, (label) => {
            if (label === 'SIN ESPECIFICAR') return `condicion:""`;
            return `condicion:"${label}"`;
        });

        // 4. Monedas Más Frecuentes
        const currCounts = {};
        allNotes.forEach(n => {
            const code = (n.currency_code || '').trim().toUpperCase();
            const info = allCurrencies[code];
            const names = info && (info.nombre_corto || info.nombres);
            const label = names && (names.es || names.en);
            const curr = code && label ? `${label} (${code})` : (code || 'Sin moneda vinculada');
            if (!currCounts[curr]) currCounts[curr] = { count: 0, code };
            currCounts[curr].count += 1;
        });

        const sortedCurrs = Object.entries(currCounts)
            .map(([label, value]) => [label, value.count, value.code])
                .sort((a, b) => b[1] - a[1]);
        renderBarList('currencies-chart-list', sortedCurrs, allNotes.length, (label, item) => {
            const code = item && item[2];
            return code ? `currency_code:"${code}"` : `currency_code:""`;
        });
    }

    function renderBarList(elementId, dataItems, total, queryBuilder) {
        const container = document.getElementById(elementId);
        container.innerHTML = '';

        const maxCount = dataItems.length ? Math.max(...dataItems.map(d => d[1])) : 1;

        dataItems.forEach((item) => {
            const [label, count] = item;
            const pct = ((count / total) * 100).toFixed(1);
            const barWidthPct = ((count / maxCount) * 100).toFixed(1);

            const row = document.createElement('div');
            row.className = 'chart-row';

            // Make the row clickable if a queryBuilder is provided
            if (queryBuilder) {
                row.style.cursor = 'pointer';
                row.style.transition = 'background-color 0.15s ease';
                row.style.borderRadius = '4px';
                row.style.padding = '4px 6px';
                row.title = `Ver en catálogo: ${label}`;

                const query = queryBuilder(label, item);
                row.addEventListener('click', () => {
                    window.location.href = `index.html?q=${encodeURIComponent(query)}`;
                });
                row.addEventListener('mouseenter', () => {
                    row.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                });
                row.addEventListener('mouseleave', () => {
                    row.style.backgroundColor = '';
                });
            }

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
                const imgSrc = n.img_full || n.thumb_f || n.thumb_a || "";
                card.innerHTML = `
                    ${imgSrc ? `<img class="note-mini-img" src="${esc(imgSrc)}" alt="${esc(n.pick || n.id)}" loading="lazy" onerror="this.style.display='none'">` : ""}
                    <div class="note-mini-meta">
                        <div class="note-mini-row">
                            <span class="note-mini-pick">${n.pick || n.id}</span>
                            <span class="note-mini-iso">${esc(n.currency_code || '')}</span>
                        </div>
                        <div class="note-mini-val">${n.denominacion || n.valor + ' ' + n.moneda}</div>
                        <div class="note-mini-year">${n.anio || 's/f'}</div>
                    </div>
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
