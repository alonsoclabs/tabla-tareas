/*! tabla-tareas v1.0.0 · Tabla editable de tareas de reuniones para un widget de Claude.
 * Uso: <div id="tt"></div><script src=".../tabla.js"></script>
 *      <script>TablaTareas.montar(document.getElementById('tt'), datos)</script>
 * datos = { o: 'persona'|'aparicion', p: [proyectos], r: { <reunión>: { t: título, f: fecha, g: [participantes] } },
 *          t: [{ r: <reunión>, n: número, x: tarea, p: proyecto, u: responsable, f: plazo, e: estado, c: cita, k: confianza }] }
 * Al guardar llama a sendPrompt() con la lista de cambios (lo define el chat de Claude; el servidor local lo reemplaza). */
(() => {
const CSS = '.tt{width:100%;border-collapse:collapse;table-layout:fixed;font-size:15px}\n.tt td{padding:5px 4px;border-bottom:0.5px solid var(--border);vertical-align:top}\n.tt tr.g td{padding:14px 4px 6px;border-bottom:0.5px solid var(--border-strong)}\n.tt tr.mod td{background:var(--bg-accent-muted)}\n.tt tr.ok td{background:color-mix(in srgb,var(--bg-success) 55%,transparent)}\n.tt tr.desc textarea{text-decoration:line-through;color:var(--text-muted)!important}\n.tt input[type=text],.tt textarea{width:100%!important;height:auto!important;min-height:30px!important;font-family:inherit!important;font-size:15px!important;line-height:1.5!important;padding:4px 8px!important;border:0.5px solid transparent!important;border-radius:6px!important;background:transparent!important;box-shadow:none!important;margin:0!important;color:var(--text-primary)!important}\n.tt input[type=text]:hover,.tt textarea:hover{border-color:var(--border)!important}\n.tt input[type=text]:focus,.tt textarea:focus{border-color:var(--border-accent)!important;background:var(--surface-2)!important}\n.tt textarea{resize:none!important;overflow:hidden;display:block}\n.tt input[type=checkbox]{width:17px;height:17px;margin:7px 0 0 4px;accent-color:var(--fill-success);cursor:pointer}\n.tt .ic{position:relative;display:inline-flex;align-items:center;justify-content:center;width:22px;height:20px;color:var(--text-muted);cursor:pointer;font-size:14px;border-radius:5px}\n.tt .ic:hover{color:var(--text-primary);background:var(--surface-1)}\n.tt .ic select{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%!important;height:100%!important}\n.tt .p{font-size:12px;color:var(--text-muted);padding:0 8px 2px}\n.tt .cita td{padding:0 8px 8px 40px;font-size:13px;color:var(--text-secondary);font-style:italic;line-height:1.45}\n.tt input.sub:not(:focus):not(:hover){opacity:.45}\n.tt tr.pp td{padding:0;border-bottom:0.5px solid var(--border)}\n.tt-o{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-secondary);padding:0 4px 6px}\n.tt-o button[aria-pressed=true]{background:var(--fill-ghost-selected)!important;color:var(--text-primary)!important}\n.tt-b{font-size:13px!important;height:26px!important;min-height:26px!important;padding:0 10px!important;border-radius:6px!important}';
const MARKUP = '<div id="tt-top" style="display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--text-secondary);padding:0 4px 4px"></div>\n<div class="tt-o" role="group" aria-label="Ordenar tareas">Ordenar por\n  <button type="button" class="tt-b" data-orden="aparicion" style="height:24px!important;min-height:24px!important;font-size:12px!important">Aparición</button>\n  <button type="button" class="tt-b" data-orden="persona" style="height:24px!important;min-height:24px!important;font-size:12px!important">Persona</button>\n</div>\n<table class="tt">\n  <colgroup><col style="width:30px"><col><col style="width:110px"><col style="width:28px"></colgroup>\n  <tbody id="tt-body"></tbody>\n</table>\n<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:10px 0 4px">\n  <button type="button" id="tt-save" class="tt-b">Guardar cambios ↗</button>\n  <span id="tt-n" style="font-size:12px;color:var(--text-secondary)">Sin cambios</span>\n</div>';
function expandir(d) {
  const REUNIONES = {};
  for (const [id, r] of Object.entries(d.r || {})) REUNIONES[id] = { titulo: r.t || '', fecha: r.f || '', participantes: r.g || [] };
  const TAREAS = (d.t || []).map((t) => ({
    id: `${t.r}-${t.n}`, reunion: t.r, reunion_titulo: (REUNIONES[t.r] || {}).titulo || '', reunion_fecha: (REUNIONES[t.r] || {}).fecha || '',
    tarea: t.x || '', proyecto: t.p || '', responsable: t.u || '', fecha: t.f || '', estado: t.e || 'propuesta', cita: t.c || '', confianza: t.k || '',
  }));
  return { TAREAS, PROYECTOS: d.p || [], REUNIONES };
}
function montar(root, datos) {
  const { TAREAS, PROYECTOS, REUNIONES } = expandir(datos);
  let ORDEN = datos.o || 'persona';
  if (!document.getElementById('tt-css')) document.head.append(Object.assign(document.createElement('style'), { id: 'tt-css', textContent: CSS }));
  root.innerHTML = MARKUP;
  const $ = (sel) => root.querySelector(sel);
  const POS = new Map(TAREAS.map((t, i) => [t.id, i]));
  const PALETA = ['purple', 'teal', 'coral', 'pink', 'blue', 'amber', 'green'];
  const COLOR = { purple: ['#EEEDFE', '#3C3489', '#3C3489', '#CECBF6'], teal: ['#E1F5EE', '#085041', '#085041', '#9FE1CB'], coral: ['#FAECE7', '#712B13', '#712B13', '#F5C4B3'], pink: ['#FBEAF0', '#72243E', '#72243E', '#F4C0D1'], blue: ['#E6F1FB', '#0C447C', '#0C447C', '#B5D4F4'], amber: ['#FAEEDA', '#633806', '#633806', '#FAC775'], green: ['#EAF3DE', '#27500A', '#27500A', '#C0DD97'] };
  const oscuro = matchMedia('(prefers-color-scheme: dark)').matches || document.documentElement.dataset.mode === 'dark';
  const norm = (x) => (x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const gente = [...new Set(Object.values(REUNIONES).flatMap((r) => r.participantes || []))];
  const colorDe = new Map(gente.map((g, i) => [norm(g).split(' ')[0], PALETA[i % PALETA.length]]));
  const tinta = (nombre) => { const c = colorDe.get(norm(nombre).split(' ')[0]); return c ? (oscuro ? COLOR[c][3] : COLOR[c][2]) : ''; };
  const chip = (nombre) => {
    const c = colorDe.get(norm(nombre).split(' ')[0]) || 'purple';
    const [bg, fg] = oscuro ? ['color-mix(in srgb,' + COLOR[c][1] + ' 70%,transparent)', COLOR[c][3]] : [COLOR[c][0], COLOR[c][1]];
    return Object.assign(document.createElement('span'), { textContent: nombre, style: `background:${bg};color:${fg};border-radius:999px;padding:2px 10px;font-size:13px;font-weight:500` });
  };
  const orig = new Map(TAREAS.map((t) => [t.id, { ...t }]));
  const cur = new Map(TAREAS.map((t) => [t.id, { ...t }]));
  const abiertas = new Set();
  const body = $('#tt-body');
  const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
  const CAMPOS = ['estado', 'tarea', 'proyecto', 'responsable'];

  const reuniones = [...new Map(TAREAS.map((t) => [t.reunion, t])).values()];
  $('#tt-top').append(...reuniones.map((t) => el('div', { style: 'display:flex;flex-direction:column;gap:6px' },
    el('div', {}, el('span', { textContent: t.reunion_titulo || t.reunion, style: 'color:var(--text-primary);font-weight:500;font-size:15px' }), ` · ${t.reunion_fecha || ''}`),
    el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;align-items:center' }, ...((REUNIONES[t.reunion] || {}).participantes || []).map(chip)))));
  const variasReuniones = reuniones.length > 1;

  function cambios() {
    const out = [];
    for (const [id, t] of cur) {
      const c = {};
      for (const k of CAMPOS) if ((t[k] || '') !== (orig.get(id)[k] || '')) c[k] = t[k] || '';
      if (Object.keys(c).length) out.push({ id, ...c });
    }
    return out;
  }
  function contar() {
    const n = cambios().length;
    $('#tt-n').textContent = n ? `${n} ${n === 1 ? 'tarea cambiada' : 'tareas cambiadas'} sin guardar` : 'Sin cambios';
  }
  function poner(id, campo, valor, tr) {
    cur.get(id)[campo] = valor;
    if (tr) pintar(tr, id);
    contar();
  }
  function pintar(tr, id) {
    const t = cur.get(id);
    tr.classList.toggle('ok', t.estado === 'aprobada');
    tr.classList.toggle('mod', t.estado !== 'aprobada' && CAMPOS.some((k) => (t[k] || '') !== (orig.get(id)[k] || '')));
  }
  function alto(ta) { ta.style.setProperty('height', 'auto', 'important'); ta.style.setProperty('height', Math.max(30, ta.scrollHeight) + 'px', 'important'); }

  function fila(t) {
    const tr = el('tr');
    const ok = el('input', { type: 'checkbox', checked: t.estado === 'aprobada', title: 'Enviar a este proyecto', ariaLabel: 'Enviar a este proyecto' });
    ok.onchange = () => { poner(t.id, 'estado', ok.checked ? 'aprobada' : 'propuesta', tr); tr.classList.remove('desc'); };
    const tarea = el('textarea', { rows: 1, value: t.tarea, ariaLabel: 'Tarea' });
    tarea.oninput = () => { alto(tarea); poner(t.id, 'tarea', tarea.value.trim(), tr); };
    tarea.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); tarea.blur(); } };
    const resp = el('input', { type: 'text', value: t.responsable || '', placeholder: 'Responsable', ariaLabel: 'Responsable' });
    const teñir = () => { const c = tinta(resp.value); resp.style.setProperty('color', c || 'var(--text-primary)', 'important'); resp.style.fontWeight = c ? '500' : ''; };
    teñir();
    if (ORDEN === 'persona') resp.classList.add('sub');
    resp.oninput = () => { teñir(); poner(t.id, 'responsable', resp.value.trim(), tr); };

    const mover = el('select', { ariaLabel: 'Mover a otro proyecto' }, el('option', { value: '', textContent: 'Sin proyecto' }),
      ...[...new Set([...PROYECTOS, ...(t.proyecto ? [t.proyecto] : [])])].map((p) => el('option', { value: p, textContent: p })));
    mover.value = t.proyecto || '';
    mover.onchange = () => { poner(t.id, 'proyecto', mover.value); dibujar(); };
    const icMover = el('span', { className: 'ic', title: 'Mover a otro proyecto' }, el('i', { className: 'ti ti-arrows-exchange', ariaHidden: 'true' }), mover);
    const icDesc = el('span', { className: 'ic', title: 'Descartar', role: 'button', tabIndex: 0 }, el('i', { className: 'ti ti-x', ariaHidden: 'true' }));
    icDesc.onclick = () => {
      const d = cur.get(t.id).estado !== 'descartada';
      poner(t.id, 'estado', d ? 'descartada' : 'propuesta', tr);
      tr.classList.toggle('desc', d);
      ok.checked = false;
      icDesc.title = d ? 'Recuperar' : 'Descartar';
    };
    const iconos = el('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:1px' });
    let citaTr = null;
    if (t.cita) {
      const baja = t.confianza === 'baja';
      const icCita = el('span', { className: 'ic' + (baja ? ' alerta' : ''), title: (baja ? 'Confianza baja, revisa la cita: ' : 'Cita: ') + '“' + t.cita + '”', role: 'button', tabIndex: 0 }, el('i', { className: 'ti ti-quote', ariaHidden: 'true' }));
      if (baja) icCita.style.color = 'var(--text-warning)';
      citaTr = el('tr', { className: 'cita', hidden: !abiertas.has(t.id) }, el('td', { colSpan: 4, textContent: `“${t.cita}”${t.confianza ? ' · confianza ' + t.confianza : ''}` }));
      icCita.onclick = () => { citaTr.hidden = !citaTr.hidden; citaTr.hidden ? abiertas.delete(t.id) : abiertas.add(t.id); };
      iconos.append(icCita);
    }
    iconos.append(icMover, icDesc);

    const celda = el('td', {}, tarea);
    const notas = [t.fecha ? 'Plazo mencionado: ' + t.fecha : '', variasReuniones ? (t.reunion_fecha || t.reunion) : ''].filter(Boolean).join(' · ');
    if (notas) celda.append(el('div', { className: 'p', textContent: notas }));
    tr.append(el('td', {}, ok), celda, el('td', {}, resp), el('td', {}, iconos));
    if (t.estado === 'descartada') tr.classList.add('desc');
    pintar(tr, t.id);
    requestAnimationFrame(() => alto(tarea));
    return citaTr ? [tr, citaTr] : [tr];
  }

  function dibujar() {
    body.replaceChildren();
    const grupos = new Map();
    for (const t of cur.values()) {
      const k = t.proyecto || '';
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(t);
    }
    const orden = [...grupos.keys()].sort((a, b) => (a === '') - (b === '') || a.localeCompare(b));
    if (!orden.length) body.append(el('tr', {}, el('td', { colSpan: 4, textContent: 'No hay tareas pendientes.', style: 'color:var(--text-secondary)' })));
    for (const k of orden) {
      const ts = grupos.get(k);
      const aprobar = el('button', { type: 'button', className: 'tt-b', textContent: 'Enviar todas', style: 'height:24px!important;min-height:24px!important;font-size:12px!important' });
      aprobar.onclick = () => { ts.forEach((t) => { if (t.estado === 'propuesta') poner(t.id, 'estado', 'aprobada'); }); dibujar(); };
      const titulo = el('div', { style: 'display:flex;align-items:baseline;gap:8px;min-width:0' },
        el('span', { textContent: k || 'Sin proyecto', style: `font-size:16px;font-weight:500;${k ? '' : 'color:var(--text-warning)'}` }),
        el('span', { textContent: k ? `${ts.length}` : 'elige un proyecto con ⇄', style: 'font-size:13px;color:var(--text-muted)' }));
      body.append(el('tr', { className: 'g' }, el('td', { colSpan: 4 },
        el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:8px' }, titulo, aprobar))));
      if (ORDEN === 'persona') {
        const quien = (t) => norm(t.responsable);
        ts.sort((a, b) => (!quien(a)) - (!quien(b)) || quien(a).localeCompare(quien(b)) || POS.get(a.id) - POS.get(b.id));
        let previo = null;
        for (const t of ts) {
          if (quien(t) !== previo) {
            previo = quien(t);
            const n = ts.filter((x) => quien(x) === previo).length;
            const banda = t.responsable ? chip(t.responsable) : el('span', { textContent: 'Sin responsable', style: 'color:var(--text-secondary);background:var(--surface-1)' });
            banda.style.cssText += ';display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;border-radius:0;padding:6px 10px;font-size:13px;font-weight:500';
            if (oscuro && t.responsable) banda.style.background = 'color-mix(in srgb,' + COLOR[colorDe.get(norm(t.responsable).split(' ')[0]) || 'purple'][1] + ' 45%,transparent)';
            banda.append(el('span', { textContent: `${n} ${n === 1 ? 'tarea' : 'tareas'}`, style: 'margin-left:auto;font-weight:400;opacity:.8' }));
            body.append(el('tr', { className: 'pp' }, el('td', { colSpan: 4 }, banda)));
          }
          body.append(...fila(t));
        }
      } else {
        ts.sort((a, b) => POS.get(a.id) - POS.get(b.id));
        for (const t of ts) body.append(...fila(t));
      }
    }
    contar();
  }

  $('#tt-save').onclick = () => {
    const c = cambios();
    if (!c.length) { $('#tt-n').textContent = 'No hay cambios que guardar'; return; }
    (window.sendPrompt || (() => {}))('Guarda estos cambios de la tabla de tareas con bin/tareas.py aplicar: ' + JSON.stringify(c));
    // Lo enviado pasa a ser el nuevo original: la tabla sigue en uso sin redibujarse.
    for (const { id } of c) orig.set(id, { ...cur.get(id) });
    dibujar();
    $('#tt-n').textContent = `${c.length} ${c.length === 1 ? 'tarea enviada' : 'tareas enviadas'} a guardar`;
  };
  const botonesOrden = [...root.querySelectorAll('.tt-o [data-orden]')];
  const marcarOrden = () => botonesOrden.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.orden === ORDEN)));
  botonesOrden.forEach((b) => { b.onclick = () => { ORDEN = b.dataset.orden; marcarOrden(); dibujar(); }; });
  marcarOrden();
  dibujar();
}
window.TablaTareas = { montar, version: '1.0.0' };
})();
