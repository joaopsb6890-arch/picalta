/* Picalta 5.2 — Aparência, Bem-estar, Notas de 24 h, Publicações fixadas e pesquisa melhorada.
   Carrega depois de v5.js. Usa as preferências privadas já existentes (users/{uid}/picaltaData/preferences)
   e o documento público do utilizador (campos opcionais `note` e `pinned`). Não precisa de regras novas. */
(function () {
  'use strict';
  const S = window.PICALTA_STATE;
  const Q = (s, r) => (r || document).querySelector(s);
  const QA = (s, r) => [...(r || document).querySelectorAll(s)];
  const H = () => (window.PICALTA_V5 && window.PICALTA_V5.h) || {};
  const E = (s) => escapeHtml(s);
  const I = (n, s) => window.icon(n, s);
  const store = {
    get(k) { try { return window.PICALTA_STORAGE.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.PICALTA_STORAGE.setItem(k, v); } catch (e) { /* sem armazenamento */ } },
  };

  /* ====================================================================
     1. APARÊNCIA: tipo de letra, cor de destaque, densidade
     ==================================================================== */
  const FONTS = {
    padrao: { label: 'Padrão', sample: 'Plus Jakarta Sans', css: 'family=Plus+Jakarta+Sans:wght@400..700' },
    editorial: { label: 'Editorial', sample: 'Newsreader', css: 'family=Newsreader:opsz,wght@6..72,400..700' },
    legivel: { label: 'Legível', sample: 'Atkinson Hyperlegible', css: 'family=Atkinson+Hyperlegible:wght@400;700' },
    suave: { label: 'Suave', sample: 'Nunito', css: 'family=Nunito:wght@400..800' },
  };
  const ACCENTS = {
    violeta: { label: 'Violeta', color: '#672ea4' },
    rosa: { label: 'Rosa', color: '#b0275c' },
    verde: { label: 'Verde', color: '#1f7a4d' },
    azul: { label: 'Azul', color: '#1f5fbf' },
    laranja: { label: 'Laranja', color: '#b3500f' },
    grafite: { label: 'Grafite', color: '#3d3a45' },
  };
  const loadedFonts = new Set(['padrao']);
  function ensureFont(key) {
    const f = FONTS[key];
    if (!f || loadedFonts.has(key)) return;
    loadedFonts.add(key);
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?' + f.css + '&display=swap';
    document.head.appendChild(l);
  }
  function applyPrefs(p) {
    const b = document.body;
    const font = FONTS[p.font] ? p.font : 'padrao';
    ensureFont(font);
    b.dataset.font = font;
    b.dataset.accent = ACCENTS[p.accent] ? p.accent : 'violeta';
    b.dataset.density = p.density === 'compacta' ? 'compacta' : 'confortavel';
    schedule(p);
  }

  /* ====================================================================
     2. BEM-ESTAR: tempo de utilização, pausas e meta diária
     ==================================================================== */
  const dayKey = (d) => 'picalta_usage_' + (d || new Date()).toISOString().slice(0, 10);
  const wb = { sinceBreak: 0, today: 0, timer: null, snoozeUntil: 0, goalShown: false, cardOpen: false };
  function loadToday() { wb.today = parseInt(store.get(dayKey()) || '0', 10) || 0; wb.goalShown = store.get(dayKey() + '_goal') === '1'; }
  function schedule() {
    if (wb.timer) return;
    loadToday();
    wb.timer = setInterval(() => tick(10), 10000);
  }
  function tick(sec) {
    if (document.hidden || !(H().uid && H().uid())) return;
    wb.today += sec; wb.sinceBreak += sec;
    store.set(dayKey(), String(wb.today));
    const p = (H().prefs && H().prefs()) || {};
    const every = +p.breakEvery || 0, goal = +p.dailyGoal || 0;
    if (Date.now() < wb.snoozeUntil || wb.cardOpen || (H().overlay)) return;
    if (goal && !wb.goalShown && wb.today >= goal * 60) {
      wb.goalShown = true; store.set(dayKey() + '_goal', '1');
      wellbeingCard('Atingiste a tua meta de hoje', 'Já passaste ' + minutes(wb.today) + ' no Picalta. Podes continuar, mas talvez seja boa altura para uma pausa.');
    } else if (every && wb.sinceBreak >= every * 60) {
      wellbeingCard('Hora de uma pausa', 'Estás aqui há ' + minutes(wb.sinceBreak) + ' seguidos. Respirar um minuto ajuda a descansar os olhos e a cabeça.');
    }
    const el = Q('#wb-today'); if (el) el.textContent = minutes(wb.today);
  }
  const minutes = (sec) => { const m = Math.max(0, Math.round(sec / 60)); return m < 1 ? 'menos de 1 min' : m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60 ? (m % 60) + ' min' : ''); };
  function wellbeingCard(title, text) {
    wb.cardOpen = true;
    const el = document.createElement('div');
    el.className = 'wb-card'; el.setAttribute('role', 'status');
    el.innerHTML = `<div class="wb-card-icon">${I('leaf', 22)}</div><div class="wb-card-body"><b>${E(title)}</b><p>${E(text)}</p><div class="wb-card-actions"><button class="btn small" data-wb-break>Fazer uma pausa</button><button class="btn small ghost" data-wb-snooze>Mais tarde</button></div></div><button class="wb-card-close" data-wb-close aria-label="Fechar">${I('x', 18)}</button>`;
    document.body.appendChild(el);
  }
  function closeCard(snoozeMin) {
    const el = Q('.wb-card'); if (el) el.remove();
    wb.cardOpen = false;
    if (snoozeMin) wb.snoozeUntil = Date.now() + snoozeMin * 60000;
  }
  let breatheTimer = null;
  function breathe() {
    closeCard();
    if (Q('.wb-breathe')) return;
    let left = 60;
    const el = document.createElement('div');
    el.className = 'wb-breathe'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Pausa para respirar');
    el.innerHTML = `<div class="wb-breathe-inner"><span class="eyebrow">PAUSA</span><div class="wb-orb" aria-hidden="true"></div><h2 id="wb-phase">Inspira</h2><p>Segue o círculo. Tens <b id="wb-left">60</b> segundos.</p><button class="btn ghost" data-wb-end>Terminar pausa</button></div>`;
    document.body.appendChild(el);
    Q('[data-wb-end]', el).focus();
    const phase = Q('#wb-phase', el), leftEl = Q('#wb-left', el);
    const run = () => {
      left--; leftEl.textContent = left;
      const t = (60 - left) % 10;
      phase.textContent = t < 4 ? 'Inspira' : t < 5 ? 'Segura' : 'Expira devagar';
      if (left <= 0) endBreathe(true);
    };
    breatheTimer = setInterval(run, 1000);
  }
  function endBreathe(done) {
    clearInterval(breatheTimer); breatheTimer = null;
    const el = Q('.wb-breathe'); if (el) el.remove();
    wb.sinceBreak = 0;
    if (done && window.toast) toast('Pausa concluída. Bem-vindo de volta.');
  }
  function weekChart() {
    const days = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(Date.now() - i * 86400000); days.push({ d, sec: parseInt(store.get(dayKey(d)) || '0', 10) || 0 }); }
    if (days.length) days[days.length - 1].sec = Math.max(days[days.length - 1].sec, wb.today);
    const max = Math.max(60, ...days.map((x) => x.sec));
    const names = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    return `<div class="wb-chart" role="img" aria-label="Tempo no Picalta nos últimos sete dias">${days.map((x) => `<div><i style="height:${Math.max(4, Math.round(x.sec / max * 100))}%" title="${minutes(x.sec)}"></i><span>${names[x.d.getDay()]}</span></div>`).join('')}</div>`;
  }

  /* ====================================================================
     3. NOTAS DE 24 HORAS
     ==================================================================== */
  const NOTE_TTL = 24 * 3600 * 1000;
  const activeNote = (u) => (u && u.note && u.note.text && Date.now() - (u.note.at || 0) < NOTE_TTL) ? u.note : null;
  function notesList() {
    const p = (H().prefs && H().prefs()) || { blocked: [], muted: [] };
    const me = H().uid && H().uid();
    return Object.values(S.usersCache || {})
      .filter((u) => (u.uid || u.id) !== me && !p.blocked.includes(u.uid || u.id) && !p.muted.includes(u.uid || u.id) && activeNote(u))
      .sort((a, b) => b.note.at - a.note.at);
  }
  function renderNotes() {
    const me = H().uid && H().uid();
    if (!me) return;
    const feed = Q('#view-feed .home-main');
    if (!feed) return;
    let box = Q('#notes-strip');
    if (!box) {
      box = document.createElement('section');
      box.id = 'notes-strip'; box.className = 'notes-strip'; box.setAttribute('aria-label', 'Notas');
      const anchor = Q('.stories-top', feed);
      feed.insertBefore(box, anchor || feed.firstChild);
    }
    const mine = activeNote(S.usersCache[me] || S.profile);
    const others = notesList();
    box.innerHTML = `<div class="notes-head"><b>Notas</b><span>Duram 24 horas</span></div><div class="notes-row">
      <button class="note-item mine" data-note-edit aria-label="${mine ? 'Editar a tua nota' : 'Partilhar uma nota'}"><span class="note-bubble ${mine ? '' : 'empty'}">${mine ? E(mine.text) : 'Partilha uma nota'}</span>${H().avatar ? H().avatar(me) : ''}<small>A tua nota</small></button>
      ${others.map((u) => `<button class="note-item" data-note-view="${E(u.uid || u.id)}"><span class="note-bubble">${E(u.note.text)}</span>${H().avatar(u)}<small>${E((u.name || '').split(' ')[0])}</small></button>`).join('')}
    </div>`;
  }
  function noteDialog(targetUid) {
    const me = H().uid();
    const own = !targetUid || targetUid === me;
    if (!own) {
      const u = S.usersCache[targetUid]; const n = activeNote(u);
      if (!n) return;
      H().modal('note', 'Nota de ' + (u.name || '').split(' ')[0], `<div class="note-view"><div class="note-bubble big">${E(n.text)}</div><div class="note-view-user">${H().avatar(u)}<span><b>${E(u.name)}</b><small>@${E(u.username)} · ${ago(n.at)}</small></span></div></div><div class="dialog-actions"><button class="btn ghost" data-note-profile="${E(targetUid)}">Ver perfil</button><button class="btn" data-note-reply="${E(targetUid)}">${I('message-circle', 17)}Responder por mensagem</button></div>`, { kicker: 'NOTA' });
      return;
    }
    const cur = activeNote(S.usersCache[me] || S.profile);
    H().modal('note', 'Uma nota rápida', `<div class="note-compose"><label for="note-text" class="note-label">O que tens em mente? Aparece para quem te segue durante 24 horas.</label><textarea id="note-text" maxlength="60" rows="3" placeholder="Ex.: a descobrir um café novo">${cur ? E(cur.text) : ''}</textarea><div class="note-meta"><span id="note-count">${cur ? cur.text.length : 0} / 60</span></div><div class="note-ideas">${['A ouvir música sem parar', 'Boas vibrações hoje', 'Quem joga uma partida?', 'A precisar de ideias para o fim de semana'].map((t) => `<button class="chip" data-note-idea="${E(t)}">${E(t)}</button>`).join('')}</div></div><div class="dialog-actions">${cur ? '<button class="btn ghost danger-text" data-note-delete>Apagar nota</button>' : '<button class="btn ghost" data-close-overlay>Cancelar</button>'}<button class="btn" data-note-save>Partilhar nota</button></div>`, { kicker: 'NOTAS' });
    const ta = Q('#note-text'); ta.focus();
    ta.addEventListener('input', () => { Q('#note-count').textContent = ta.value.length + ' / 60'; });
  }
  const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'agora' : m < 60 ? 'há ' + m + ' min' : 'há ' + Math.round(m / 60) + ' h'; };
  async function saveNote(text) {
    const me = H().uid();
    const note = text ? { text, at: Date.now() } : null;
    await dbUpdateProfile(me, { note });
    if (S.usersCache[me]) S.usersCache[me].note = note;
    if (S.profile) S.profile.note = note;
    H().closeOverlay(true);
    renderNotes(); decorateProfile();
    if (window.toast) toast(note ? 'Nota partilhada durante 24 horas.' : 'Nota apagada.');
  }

  /* ====================================================================
     4. PUBLICAÇÕES FIXADAS NO PERFIL (até 3)
     ==================================================================== */
  const MAX_PINS = 3;
  const pinsOf = (uid) => { const u = S.usersCache[uid] || (uid === (H().uid && H().uid()) ? S.profile : null) || {}; return Array.isArray(u.pinned) ? u.pinned : []; };
  function pinButton(p) {
    const pinned = pinsOf(p.uid).includes(p.id);
    return H().btn(I(pinned ? 'pin-off' : 'pin') + (pinned ? 'Desafixar do perfil' : 'Fixar no perfil'), 'data-pin-post="' + E(p.id) + '"', 'menu-row');
  }
  async function togglePin(postId) {
    const me = H().uid();
    let pins = pinsOf(me).filter((id) => S.posts.some((p) => p.id === id));
    const had = pins.includes(postId);
    if (had) pins = pins.filter((id) => id !== postId);
    else {
      if (pins.length >= MAX_PINS) { H().closeOverlay(true); if (window.toast) toast('Só podes fixar ' + MAX_PINS + ' publicações. Desafixa uma primeiro.'); return; }
      pins = [postId, ...pins];
    }
    await dbUpdateProfile(me, { pinned: pins });
    if (S.usersCache[me]) S.usersCache[me].pinned = pins;
    if (S.profile) S.profile.pinned = pins;
    H().closeOverlay(true);
    if (window.toast) toast(had ? 'Publicação desafixada.' : 'Publicação fixada no teu perfil.');
    if (S.view === 'profile' && window.PICALTA_V5) window.PICALTA_V5.onNavigate('profile');
  }
  function decorateProfile() {
    const target = S._profileUid || (H().uid && H().uid());
    const grid = Q('#profile-grid');
    const head = Q('.profile-head');
    if (!grid || !head || !target) return;
    const pins = pinsOf(target);
    if (pins.length) {
      const tiles = QA('[data-photo-open]', grid);
      const first = grid.firstChild;
      pins.slice().reverse().forEach((id) => {
        const t = tiles.find((x) => x.dataset.photoOpen === id);
        if (t) { t.classList.add('is-pinned'); if (!Q('.pin-badge', t)) t.insertAdjacentHTML('beforeend', `<span class="pin-badge" title="Fixada">${I('pin', 14)}</span>`); grid.insertBefore(t, grid.firstChild); }
      });
    }
    const u = S.usersCache[target] || (target === H().uid() ? S.profile : null);
    const n = activeNote(u);
    let bubble = Q('.profile-note', head);
    if (!n) { if (bubble) bubble.remove(); return; }
    if (!bubble) { bubble = document.createElement('div'); bubble.className = 'profile-note'; const bio = Q('#profile-bio', head); (bio && bio.parentNode ? bio.parentNode : head).insertBefore(bubble, bio ? bio.nextSibling : null); }
    bubble.innerHTML = `${I('message-circle', 14)}<span>${E(n.text)}</span><small>${ago(n.at)}</small>`;
  }

  /* ====================================================================
     5. PESQUISA: recentes e jogos
     ==================================================================== */
  const RECENT_KEY = 'picalta_recent_search';
  const recents = () => { try { return JSON.parse(store.get(RECENT_KEY) || '[]'); } catch (e) { return []; } };
  function pushRecent(term) {
    term = (term || '').trim();
    if (term.length < 2) return;
    const list = [term, ...recents().filter((x) => x.toLowerCase() !== term.toLowerCase())].slice(0, 6);
    store.set(RECENT_KEY, JSON.stringify(list));
  }
  function searchHtml(term, mode, match) {
    let recent = '', games = '';
    if (!term && mode === 'Tudo') {
      const r = recents();
      if (r.length) recent = `<h3>RECENTES <button class="text-btn small" data-recent-clear>Limpar</button></h3><div class="recent-chips">${r.map((t) => `<button class="chip" data-recent-term="${E(t)}">${I('history', 14)}${E(t)}</button>`).join('')}</div>`;
    }
    if ((mode === 'Tudo' || mode === 'Ferramentas') && typeof GAMES !== 'undefined') {
      const g = Object.entries(GAMES).filter(([, x]) => (term ? match(x.label + ' jogo jogar') : mode === 'Ferramentas'));
      if (g.length) games = '<h3>JOGOS</h3>' + g.slice(0, term ? 5 : 8).map(([k, x]) => `<button class="command-result" data-command-game="${E(k)}"><span class="cmd-emoji" aria-hidden="true">${x.icon}</span><span><b>Jogar ${E(x.label)}</b><small>${E(x.hint || 'Uma pausa rápida')}</small></span>${I('arrow-right', 16)}</button>`).join('');
    }
    return { recent, games };
  }

  /* ====================================================================
     Definições: cartões novos
     ==================================================================== */
  function decorateSettings(box) {
    const p = (H().prefs && H().prefs()) || {};
    const fontKey = FONTS[p.font] ? p.font : 'padrao', accent = ACCENTS[p.accent] ? p.accent : 'violeta';
    const appearance = document.createElement('div');
    appearance.className = 'settings-card preference-card appearance-card';
    appearance.innerHTML = `<h2>Aparência</h2>
      <div class="pref-block"><div class="pref-title"><b>Tipo de letra</b><span>Muda o ar de todo o Picalta.</span></div>
        <div class="font-grid" role="radiogroup" aria-label="Tipo de letra">${Object.entries(FONTS).map(([k, f]) => `<button role="radio" aria-checked="${k === fontKey}" class="font-option ${k === fontKey ? 'active' : ''}" data-set-pref="font:${k}" data-font-preview="${k}"><span class="font-sample">Aa</span><b>${f.label}</b><small>${f.sample}</small></button>`).join('')}</div></div>
      <div class="pref-block"><div class="pref-title"><b>Cor de destaque</b><span>Botões, ligações e realces.</span></div>
        <div class="accent-grid" role="radiogroup" aria-label="Cor de destaque">${Object.entries(ACCENTS).map(([k, a]) => `<button role="radio" aria-checked="${k === accent}" class="accent-swatch ${k === accent ? 'active' : ''}" data-set-pref="accent:${k}" style="--sw:${a.color}" title="${a.label}"><span class="sr-only">${a.label}</span>${k === accent ? I('check', 18) : ''}</button>`).join('')}</div></div>
      <div class="pref-block row"><div class="pref-title"><b>Densidade</b><span>Compacta mostra mais conteúdo no ecrã.</span></div>
        <div class="seg" role="radiogroup" aria-label="Densidade">${[['confortavel', 'Confortável'], ['compacta', 'Compacta']].map(([k, l]) => `<button role="radio" aria-checked="${(p.density || 'confortavel') === k}" class="${(p.density || 'confortavel') === k ? 'active' : ''}" data-set-pref="density:${k}">${l}</button>`).join('')}</div></div>`;
    const wellbeing = document.createElement('div');
    wellbeing.className = 'settings-card preference-card wellbeing-card';
    const opt = (list, cur, unit) => list.map(([v, l]) => `<option value="${v}" ${(+cur || 0) === v ? 'selected' : ''}>${l}</option>`).join('');
    wellbeing.innerHTML = `<div class="section-row"><h2>Tempo e pausas</h2>${I('leaf', 22)}</div>
      <div class="wb-today"><div><span>Hoje no Picalta</span><b id="wb-today">${minutes(wb.today)}</b></div>${weekChart()}</div>
      <div class="preference-row"><div><b>Lembrete de pausa</b><span>Um aviso discreto a cada intervalo, com um minuto para respirar.</span></div><select data-pref-num="breakEvery" aria-label="Lembrete de pausa">${opt([[0, 'Desligado'], [20, '20 minutos'], [30, '30 minutos'], [45, '45 minutos'], [60, '1 hora']], p.breakEvery)}</select></div>
      <div class="preference-row"><div><b>Meta diária</b><span>Avisa-te quando chegares ao tempo que escolheste.</span></div><select data-pref-num="dailyGoal" aria-label="Meta diária de tempo">${opt([[0, 'Sem meta'], [30, '30 minutos'], [60, '1 hora'], [90, '1 hora e meia'], [120, '2 horas']], p.dailyGoal)}</select></div>
      <button class="text-btn" data-wb-try>${I('wind', 16)}Experimentar uma pausa agora</button>
      <p class="data-note">O tempo é contado só neste dispositivo, enquanto o separador está visível. Não é enviado para o servidor.</p>`;
    const cards = QA('.settings-card', box);
    if (cards[0]) cards[0].after(appearance); else box.appendChild(appearance);
    appearance.after(wellbeing);
  }

  /* ====================================================================
     Eventos
     ==================================================================== */
  document.addEventListener('click', async (e) => {
    const t = e.target;
    let el;
    if ((el = t.closest('[data-set-pref]'))) {
      const [k, v] = el.dataset.setPref.split(':');
      const up = H().updatePrefs;
      if (up) await up({ [k]: v }, 'Aparência atualizada.');
      return;
    }
    if (t.closest('[data-note-edit]')) { noteDialog(); return; }
    if ((el = t.closest('[data-note-view]'))) { noteDialog(el.dataset.noteView); return; }
    if ((el = t.closest('[data-note-idea]'))) { const ta = Q('#note-text'); if (ta) { ta.value = el.dataset.noteIdea; ta.dispatchEvent(new Event('input')); ta.focus(); } return; }
    if (t.closest('[data-note-save]')) {
      const v = (Q('#note-text').value || '').trim();
      if (!v) { if (window.toast) toast('Escreve algo antes de partilhar.'); return; }
      try { await saveNote(v.slice(0, 60)); } catch (err) { if (window.toast) toast('Não foi possível guardar a nota.'); }
      return;
    }
    if (t.closest('[data-note-delete]')) { try { await saveNote(''); } catch (err) { if (window.toast) toast('Não foi possível apagar a nota.'); } return; }
    if ((el = t.closest('[data-note-profile]'))) { H().closeOverlay(true); navigate('profile'); renderProfile(el.dataset.noteProfile); return; }
    if ((el = t.closest('[data-note-reply]'))) { H().closeOverlay(true); startChatWith(el.dataset.noteReply); return; }
    if ((el = t.closest('[data-pin-post]'))) { try { await togglePin(el.dataset.pinPost); } catch (err) { if (window.toast) toast('Não foi possível fixar a publicação.'); } return; }
    if ((el = t.closest('[data-command-game]'))) { const id = el.dataset.commandGame; const ci = Q('#command-input'); if (ci) pushRecent(ci.value); H().closeOverlay(true); navigate('games'); renderGamesHome(); openGame(id); return; }
    if ((el = t.closest('[data-recent-term]'))) { const i = Q('#command-input'); if (i) { i.value = el.dataset.recentTerm; i.dispatchEvent(new Event('input')); i.focus(); } return; }
    if (t.closest('[data-recent-clear]')) { store.set(RECENT_KEY, '[]'); const i = Q('#command-input'); if (i) i.dispatchEvent(new Event('input')); return; }
    if (t.closest('.command-result')) { const i = Q('#command-input'); if (i) pushRecent(i.value); return; }
    if (t.closest('[data-wb-break],[data-wb-try]')) { breathe(); return; }
    if (t.closest('[data-wb-snooze]')) { closeCard(10); return; }
    if (t.closest('[data-wb-close]')) { closeCard(5); return; }
    if (t.closest('[data-wb-end]')) { endBreathe(false); return; }
  }, true);
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-pref-num]');
    if (!el) return;
    e.stopPropagation();
    const up = H().updatePrefs;
    if (up) up({ [el.dataset.prefNum]: parseInt(el.value, 10) || 0 }, 'Preferência guardada.');
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && Q('.wb-breathe')) { e.stopPropagation(); endBreathe(false); }
    if (e.key === 'Enter' && e.target && e.target.matches && e.target.matches('#command-input')) pushRecent(e.target.value);
  }, true);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadToday(); });

  /* Ícones nos botões estáticos da folha «Mais» e títulos sem emoji */
  function polishStatic() {
    const map = { 'more-story-btn': ['plus', 'Nova história'], 'more-notif-btn': ['bell', 'Notificações'], 'more-settings-btn': ['settings', 'Definições'], 'more-logout-btn': ['log-out', 'Sair'] };
    Object.entries(map).forEach(([id, [ic, label]]) => { const b = document.getElementById(id); if (b) b.innerHTML = I(ic, 18) + '<span>' + label + '</span>'; });
  }
  polishStatic();

  window.PICALTA_EXTRAS = { applyPrefs, decorateSettings, renderNotes, decorateProfile, pinButton, searchHtml, FONTS, ACCENTS,
    _tick: tick, _usage: () => ({ ...wb }), _breathe: breathe };
})();
