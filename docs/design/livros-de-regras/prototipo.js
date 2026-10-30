/* =========================================================================
 * Mundo do livro de regras: telas e painel da IA (protótipo).
 * Tudo vive na memória desta página: nada é salvo em disco, nada vai para a
 * rede, e as respostas da IA são de EXEMPLO (montadas aqui com os números
 * das fichas de exemplo). Recomeçar = recarregar a página.
 * ========================================================================= */
'use strict'
;(function () {
  const L = window.Livro
  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s))
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c])
  const ic = (nome) => `<svg class="ic" aria-hidden="true"><use href="#i-${nome}"/></svg>`
  const fmt = L.formatar
  const fmtX = (f) => '×' + f.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  const ROTULO_CAMPO = { custo: 'Custo', dano: 'Dano', acao: 'Ação', tempo: 'Tempo' }
  const STATUS = {
    lido: { rot: 'Lido', icone: 'ok' },
    ajuda: { rot: 'Lê na hora', icone: 'relogio' },
    nao: { rot: 'Não lê', icone: 'nao' },
    mao: { rot: 'À mão', icone: 'nota' },
  }
  const FORCA_MIN = 0.5
  const FORCA_MAX = 2
  const MAX_COMPARAR = 4
  const MAX_FICHAS_IA = 4
  const ESPERA_DA_IA_MS = 700
  const DURACAO_DO_AVISO_MS = 5000
  const ALVO_DO_PESO = { facil: 0.25, justo: 0.55, duro: 0.85 }
  const NOME_DO_PESO = { facil: 'Fácil', justo: 'Justo', duro: 'Duro', mortal: 'Mortal' }

  /* =====================================================================
   * Estado
   * ===================================================================== */
  const E = {
    tela: 'inicio',
    aba: 'jogadores',
    fichas: JSON.parse(JSON.stringify(L.FICHAS)),
    cenario: L.CENARIO.map((c) => ({ ...c })),
    besSel: 'recruta',
    cmpSel: ['lia', 'bruno', 'vera', 'otavio'],
    grupo: ['lia', 'bruno', 'duda', 'rafa'],
    inimigos: { recruta: 2, otavio: 1, vera: 1 },
    saudeFiltro: 'todos',
    corrigindo: null,
    catTipo: 'todos',
    catBusca: '',
    destino: 'lia',
    notSel: 'lia',
    novos: new Set(),
    iaAberta: window.innerWidth >= 1240,
    ia: { modo: 'conversa', fixas: [], conversa: [], pensando: false, config: false, chaves: 0, campos: 1, gerar: false, gerado: null },
    movimento: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduzido' : 'normal',
  }

  /* =====================================================================
   * Fichas: herança das variações, números com a força do NPC
   * ===================================================================== */
  const crua = (id) => E.fichas.find((f) => f.id === id)
  function completa(id) {
    const f = crua(id)
    if (!f) return null
    if (!f.modeloId) return f
    const m = crua(f.modeloId)
    return { ...m, id: f.id, nome: f.nome, modelo: false, unico: false, modeloId: f.modeloId, forca: f.forca, nota: f.nota }
  }
  const nomeDe = (id) => (crua(id) || { nome: '?' }).nome
  const jogadores = () => E.fichas.filter((f) => f.tipo === 'jogador')
  const bestiario = () => E.fichas.filter((f) => f.tipo === 'npc')
  const modelos = () => E.fichas.filter((f) => f.tipo === 'npc' && f.modelo)
  const variacoesDe = (id) => E.fichas.filter((f) => f.modeloId === id)
  const forcaDe = (f) => (f.tipo === 'npc' ? f.forca || 1 : 1)
  const hpMax = (f) => Math.floor(L.hpBase(f) * forcaDe(f))
  const spMax = (f) => L.spMax(f)

  function ler(campo, t, f) {
    if (campo === 'custo') return L.lerCusto(t.custo)
    if (campo === 'acao') return L.lerAcao(t.acao)
    if (campo === 'tempo') return L.lerTempo(t.tempo)
    return L.lerDano(t.dano, f, t)
  }

  /** O golpe de maior dano que a ficha consegue pagar, sem OVERLOAD (já com a força do NPC). */
  function melhorGolpe(f) {
    let melhor = null
    for (const t of f.tecnicas) {
      if (t.forma) continue
      const d = L.lerDano(t.dano, f, t)
      if (d.valor == null) continue
      const custo = L.lerCusto(t.custo)
      if (custo.valor && custo.valor > spMax(f)) continue
      if (/OVERLOAD/.test(L.lerAcao(t.acao).leitura || '') || L.lerTempo(t.tempo).leitura === 'OVERLOAD') continue
      const valor = Math.floor(d.valor * forcaDe(f))
      if (!melhor || valor > melhor.valor) melhor = { tec: t, valor }
    }
    return melhor
  }

  function iniciais(nome) {
    const TITULOS = new Set(['capita', 'capitã', 'sargento', 'tenente', 'recruta', 'bandido', 'dona', 'taberneiro', 'vendedora'])
    const partes = nome.split(/\s+/).filter((p) => !TITULOS.has(p.toLowerCase()))
    const usar = partes.length ? partes : nome.split(/\s+/)
    return usar.slice(0, 2).map((p) => p[0]).join('').toUpperCase()
  }
  const retrato = (f, tam = '') => `<span class="retrato${tam ? ' retrato--' + tam : ''}" style="--cor: var(--lb-color-${esc(f.cor || 'parchment-faint')})" aria-hidden="true">${esc(iniciais(f.nome))}</span>`
  function seloTipo(f) {
    if (f.tipo === 'jogador') return '<span class="selo selo--jogador">Jogador</span>'
    if (f.modelo && f.unico) return '<span class="selo selo--modelo">NPC único</span>'
    if (f.modelo) return '<span class="selo selo--modelo">Modelo</span>'
    return '<span class="selo selo--npc">NPC</span>'
  }
  function seloStatus(r) {
    const s = STATUS[r.status]
    if (!s) return ''
    return `<span class="status status--${r.status}">${ic(s.icone)}${s.rot}</span>`
  }

  /* =====================================================================
   * Saúde da ficha: o que o app lê sozinho
   * ===================================================================== */
  function saude() {
    const cont = {}
    for (const c of Object.keys(ROTULO_CAMPO)) cont[c] = { lido: 0, ajuda: 0, nao: 0, mao: 0 }
    const lista = []
    for (const f of E.fichas) {
      if (f.modeloId) continue // variação herda do modelo: conta uma vez só
      for (const t of f.tecnicas) {
        for (const campo of Object.keys(ROTULO_CAMPO)) {
          const r = ler(campo, t, f)
          if (r.status === 'sem') continue
          cont[campo][r.status] += 1
          if (r.status === 'nao' || r.status === 'ajuda') lista.push({ f, t, campo, r })
        }
      }
    }
    const pct = (c) => {
      const total = c.lido + c.ajuda + c.nao
      return total === 0 ? 100 : Math.round(((c.lido + c.ajuda) * 100) / total)
    }
    return { cont, lista, pct }
  }

  /* =====================================================================
   * Peso do encontro
   * ===================================================================== */
  function encontro(grupoIds = E.grupo, inimigos = E.inimigos) {
    const g = grupoIds.map(completa).filter(Boolean)
    const inim = []
    for (const [id, n] of Object.entries(inimigos)) {
      const f = completa(id)
      for (let i = 0; f && i < n; i++) inim.push(f)
    }
    const vida = (lista) => lista.reduce((s, f) => s + hpMax(f) + (f.escudo || 0), 0)
    const dano = (lista) => lista.reduce((s, f) => s + (melhorGolpe(f) ? melhorGolpe(f).valor : 0) * L.FATOR_DA_REACAO, 0)
    const Hg = vida(g)
    const Hi = vida(inim)
    const Dg = dano(g)
    const Di = dano(inim)
    const rg = Dg > 0 ? Hi / Dg : Infinity
    const ri = Di > 0 ? Hg / Di : Infinity
    let nivel = null
    let razao = 0
    if (g.length && inim.length) {
      razao = ri === Infinity ? 0 : rg / ri
      nivel = razao <= 0.35 ? 'facil' : razao <= 0.7 ? 'justo' : razao <= 1 ? 'duro' : 'mortal'
    }
    const semGolpe = [...g, ...inim].filter((f, i, a) => !melhorGolpe(f) && a.indexOf(f) === i)
    return { g, inim, Hg, Hi, Dg, Di, rg, ri, razao, nivel, semGolpe }
  }
  const rodadas = (r) => (r === Infinity ? 'nunca' : r < 1 ? 'menos de 1' : '~' + fmt(Math.round(r * 10) / 10))

  /* =====================================================================
   * Navegação entre telas
   * ===================================================================== */
  function irPara(tela) {
    E.tela = tela
    for (const t of $$('.tela')) t.hidden = t.dataset.tela !== tela
    const el = $(`#tela-${tela}`)
    if (E.movimento === 'normal') {
      el.classList.remove('tela--entra')
      void el.offsetWidth
      el.classList.add('tela--entra')
    }
    if (tela === 'inicio') $('#home-titulo').focus()
    if (tela === 'sistemas') $('#sistemas-titulo').focus()
    if (tela === 'mundo') {
      const mundo = $('#mundo')
      mundo.classList.add('mu-entra')
      setTimeout(() => mundo.classList.remove('mu-entra'), 700)
      renderTudo()
      $('#mundo-titulo').focus()
    }
  }

  function trocarAba(aba, focar = false) {
    E.aba = aba
    E.corrigindo = null
    renderPagina()
    $('#pagina').scrollTop = 0
    if (focar) $(`#aba-${aba}`).focus()
  }

  function moverFita(semAnimar) {
    const fita = $('#fita')
    const m = $(`#aba-${E.aba}`)
    if (!fita || !m || !m.offsetHeight) return
    if (semAnimar) fita.style.transition = 'none'
    fita.style.transform = `translateY(${m.offsetTop}px)`
    fita.style.height = `${m.offsetHeight}px`
    if (semAnimar) {
      void fita.offsetWidth
      fita.style.transition = ''
    }
  }

  function atualizarMarcadores() {
    for (const m of $$('.mu-marcador')) {
      const ativo = m.dataset.aba === E.aba
      m.setAttribute('aria-selected', String(ativo))
      m.tabIndex = ativo ? 0 : -1
    }
    $('#pagina').setAttribute('aria-labelledby', `aba-${E.aba}`)
    const s = saude()
    const problemas = s.lista.filter((p) => p.r.status === 'nao').length
    const n = {
      jogadores: jogadores().length,
      npcs: bestiario().length,
      comparar: E.cmpSel.length,
      saude: problemas,
      itens: L.CATALOGO.length,
      notas: E.fichas.filter((f) => (f.nota || '').trim()).length,
      mapa: '',
    }
    for (const el of $$('[data-n]')) {
      const k = el.dataset.n
      el.textContent = n[k] === '' ? '' : String(n[k])
      el.classList.toggle('mu-marcador__n--alerta', k === 'saude' && problemas > 0)
      if (k === 'saude') el.title = `${problemas} campos que o app não lê`
    }
    $('#sis-jog').textContent = String(jogadores().length)
    $('#sis-npc').textContent = String(bestiario().length)
    $('#mundo').dataset.ia = E.iaAberta ? 'aberto' : 'fechado'
    requestAnimationFrame(() => moverFita(false))
  }

  /** Chave estável de um controle, para devolver o foco depois de redesenhar a página. */
  function chaveDe(el) {
    if (!el || !el.dataset) return null
    if (el.dataset.foco) return 'f|' + el.dataset.foco
    if (el.dataset.acao) return ['a', el.dataset.acao, el.dataset.id || '', el.dataset.valor || '', el.dataset.tec || '', el.dataset.campo2 || ''].join('|')
    if (el.dataset.campo) return ['c', el.dataset.campo, el.dataset.id || ''].join('|')
    return null
  }

  function renderPagina() {
    const pagina = $('#pagina')
    const ativo = document.activeElement
    const chave = ativo && pagina.contains(ativo) ? chaveDe(ativo) : null
    const rolagem = pagina.scrollTop
    pagina.innerHTML = PAGINAS[E.aba]()
    pagina.scrollTop = rolagem
    if (chave) {
      const alvo = $$('button, input, select, textarea, [tabindex]', pagina).find((el) => chaveDe(el) === chave)
      if (alvo && !alvo.disabled) alvo.focus({ preventScroll: true })
      else pagina.focus({ preventScroll: true })
    }
    atualizarMarcadores()
    E.novos.clear()
  }

  function renderTudo() {
    renderPagina()
    renderIA()
    moverFita(true)
  }

  const botaoAbrirIA = () => (E.iaAberta ? '' : `<button type="button" class="bt bt--latao" data-acao="ia-abrir">${ic('ia')}Assistente</button>`)
  const cabecalho = (titulo, sub, acoes = '') => `
    <header class="pg-cab">
      <div class="pg-cab__txt"><h2 class="pg-titulo">${titulo}</h2><p class="pg-sub">${sub}</p></div>
      <div class="pg-acoes">${acoes}${botaoAbrirIA()}</div>
    </header>`

  /* =====================================================================
   * Página 1: Jogadores
   * ===================================================================== */
  function pgJogadores() {
    const lista = jogadores()
    const ligadoA = (nome) => lista.find((f) => f.jogador === nome)
    const linhas = lista.map((f) => {
      const visto = L.JOGADORES_DA_MESA.find((j) => j.nome === f.jogador)
      const opcoes = [`<option value="">Sem jogador</option>`]
        .concat(L.JOGADORES_DA_MESA.map((j) => {
          const outro = ligadoA(j.nome)
          const sufixo = outro && outro.id !== f.id ? ` (hoje com ${outro.nome.split(' ')[0]})` : ''
          return `<option value="${esc(j.nome)}"${f.jogador === j.nome ? ' selected' : ''}>${esc(j.nome)}${esc(sufixo)}</option>`
        }))
        .join('')
      const estado = f.jogador
        ? `<span class="jog__estado jog__estado--ok">Entra como “${esc(f.jogador)}”${visto ? ' · visto ' + esc(visto.visto) : ''} · nos ${L.MAPAS_DA_PASTA.length} mapas da pasta</span>`
        : '<span class="jog__estado jog__estado--falta">Sem jogador: no mapa, o token fica com o mestre.</span>'
      return `
        <li class="cartao jog">
          ${retrato(f)}
          <div><h3 class="jog__nome">${esc(f.nome)}</h3><p class="jog__tipo">${esc(f.raca)} · ${esc(f.oficio)}</p></div>
          <div class="jog__liga">
            <div class="jog__liga-linha">${ic('elo')}<label class="sr" for="liga-${f.id}">Jogador de ${esc(f.nome)}</label>
              <select class="seletor" id="liga-${f.id}" data-campo="jog-liga" data-id="${f.id}">${opcoes}</select></div>
            ${estado}
          </div>
          <div class="jog__acoes">
            <button type="button" class="bt bt--p" data-acao="abrir-ficha" data-id="${f.id}">Abrir ficha</button>
            <button type="button" class="bt bt--p bt--fantasma" data-acao="comparar-com" data-id="${f.id}">Comparar</button>
          </div>
        </li>`
    }).join('')
    const semFicha = L.JOGADORES_DA_MESA.filter((j) => !ligadoA(j.nome))
    const blocoSemFicha = semFicha.length === 0 ? '' : `
      <section class="pg-secao">
        <h3 class="pg-secao__tit">Entraram na mesa e não têm ficha <small>${semFicha.length}</small></h3>
        <ul class="linhas">${semFicha.map((j) => `
          <li class="cartao jog">
            <span class="retrato" style="--cor: var(--lb-color-parchment-faint)" aria-hidden="true">${esc(j.nome[0].toUpperCase())}</span>
            <div><h3 class="jog__nome">“${esc(j.nome)}”</h3><p class="jog__tipo">Visto ${esc(j.visto)}</p></div>
            <div class="jog__liga"><span class="jog__estado">Quando entrar, recebe um token sem ficha.</span></div>
            <div class="jog__acoes"><button type="button" class="bt bt--p" data-acao="jog-criar" data-valor="${esc(j.nome)}">${ic('mais')}Criar ficha para ${esc(j.nome)}</button></div>
          </li>`).join('')}</ul>
      </section>`
    return `<div class="pg">
      ${cabecalho('Jogadores', 'Cada personagem fica ligado ao jogador uma vez. Quando ele entrar em qualquer mapa deste livro, o token dele já vem com a ficha.')}
      <ol class="como">
        <li><b>1. Ligue a ficha ao jogador</b><span>Pelo nome com que ele entra na mesa.</span></li>
        <li><b>2. Ele entra em qualquer mapa</b><span>${L.MAPAS_DA_PASTA.map(esc).join(', ')}.</span></li>
        <li><b>3. O token já vem com a ficha</b><span>HP, SP, técnicas e armas, prontos para a batalha.</span></li>
      </ol>
      <ul class="linhas">${linhas}</ul>
      ${blocoSemFicha}
    </div>`
  }

  /* =====================================================================
   * Página 2: NPCs de combate (bestiário)
   * ===================================================================== */
  function pgNpcs() {
    const sel = completa(E.besSel) ? completa(E.besSel) : completa(modelos()[0] && modelos()[0].id)
    const item = (f, variacao) => {
      const forca = forcaDe(f)
      return `<button type="button" class="bes-item${variacao ? ' bes-item--var' : ''}" data-acao="bes-sel" data-id="${f.id}" aria-current="${sel && sel.id === f.id}">
        ${retrato(f, 'p')}
        <span><span class="bes-item__nome">${esc(f.nome)}</span><span class="bes-item__sub">${variacao ? 'Variação' : f.unico ? 'NPC único' : `Modelo · ${variacoesDe(f.id).length} variações`}</span></span>
        <span class="bes-item__forca${forca !== 1 ? ' bes-item__forca--mexida' : ''}" data-forca-lista="${f.id}">${fmtX(forca)}</span>
      </button>`
    }
    const lista = modelos().map((m) => item(m, false) + variacoesDe(m.id).map((v) => item(completa(v.id), true)).join('')).join('')
    const cenario = E.cenario.length === 0
      ? '<p class="pg-nota" style="padding: 4px 8px 8px">Nenhum NPC só de cenário.</p>'
      : E.cenario.map((c) => `<div class="bes-item" style="cursor:default">${retrato(c, 'p')}<span><span class="bes-item__nome">${esc(c.nome)}</span><span class="bes-item__sub">${esc(c.oficio)}</span></span>
          <button type="button" class="bt bt--p" data-acao="bes-dar-ficha" data-id="${c.id}">Dar ficha</button></div>`).join('')
    return `<div class="pg">
      ${cabecalho('NPCs de combate', 'Só quem tem ficha de batalha entra na ordem dos turnos. Crie a partir de um modelo e ajuste a força para balancear sem mexer na ficha.',
        `<button type="button" class="bt bt--primario" data-acao="bes-novo">${ic('mais')}Novo NPC</button>`)}
      <div class="bes">
        <div class="bes-lista">
          <div class="cartao bes-grupo"><div class="bes-grupo__tit"><span>Modelos e variações</span><span>Força</span></div>${lista}</div>
          <div class="cartao bes-grupo bes-cenario"><div class="bes-grupo__tit"><span>Só no cenário · fora da batalha</span></div>${cenario}</div>
        </div>
        ${sel ? detalheNpc(sel) : '<div class="vazio"><p>Nenhum NPC de combate ainda. Crie o primeiro a partir de um modelo.</p></div>'}
      </div>
    </div>`
  }

  function detalheNpc(f) {
    const forca = forcaDe(f)
    const pct = ((forca - FORCA_MIN) / (FORCA_MAX - FORCA_MIN)) * 100
    const de = f.modeloId
      ? `Variação de <b>${esc(nomeDe(f.modeloId))}</b>: técnicas, armas e atributos vêm do modelo.`
      : f.unico ? 'NPC único: não tem variações.' : `Modelo com ${variacoesDe(f.id).length} variações. Mudar a ficha do modelo muda todas.`
    const golpes = f.tecnicas.filter((t) => !t.forma).map((t) => ({ t, d: L.lerDano(t.dano, f, t) })).filter((x) => x.d.valor != null)
    const efeito = [
      `<div class="efeito__item"><span class="efeito__rot">HP máximo</span><span class="efeito__num" data-efeito="hp" data-base="${L.hpBase(f)}">${numComForca(L.hpBase(f), forca)}</span></div>`,
      ...golpes.map(({ t, d }) => `<div class="efeito__item"><span class="efeito__rot" title="${esc(t.dano)}">${esc(t.nome)}</span><span class="efeito__num" data-efeito="dano" data-base="${d.valor}">${numComForca(d.valor, forca)}</span></div>`),
    ].join('')
    const variacoes = f.modelo && !f.unico ? `
      <div class="bes-bloco">
        <h4 class="bes-bloco__tit">Variações</h4>
        <p class="bes-bloco__sub">Mesma ficha, outro nome e outra força. Bom para “3 recrutas”, cada um um pouco diferente.</p>
        <div class="pg-acoes">${variacoesDe(f.id).map((v) => `<button type="button" class="chip" data-acao="bes-sel" data-id="${v.id}">${retrato(completa(v.id), 'p')}${esc(v.nome)} · ${fmtX(v.forca)}</button>`).join('')}
          <button type="button" class="bt bt--p" data-acao="bes-variacao" data-id="${f.id}">${ic('copia')}Nova variação</button></div>
      </div>` : ''
    return `<section class="cartao bes-det" aria-labelledby="bes-nome">
      <div class="bes-det__cab">
        ${retrato(f, 'g')}
        <div><h3 class="bes-det__nome" id="bes-nome">${esc(f.nome)}</h3><p class="bes-det__de">${seloTipo(f)} ${esc(f.raca)} · ${esc(f.oficio)}</p></div>
        <div class="pg-acoes">
          <button type="button" class="bt bt--p" data-acao="abrir-ficha" data-id="${f.id}">Abrir ficha</button>
          <button type="button" class="bt bt--p bt--fantasma" data-acao="comparar-com" data-id="${f.id}">Comparar</button>
          ${f.modeloId ? `<button type="button" class="bt bt--p bt--ic" data-acao="bes-apagar" data-id="${f.id}" aria-label="Apagar ${esc(f.nome)}" title="Apagar">${ic('lixo')}</button>` : ''}
        </div>
      </div>
      <p class="pg-nota">${de}</p>
      <div class="bes-bloco">
        <h4 class="bes-bloco__tit"><label for="forca-${f.id}">Força do NPC</label></h4>
        <p class="bes-bloco__sub">Multiplica o HP e o dano das técnicas, de ×0,5 a ×2. Para balancear no meio da campanha sem reescrever a ficha. Os jogadores nunca veem esse número.</p>
        <div class="forca">
          <input type="range" class="deslizante" id="forca-${f.id}" data-campo="forca" data-id="${f.id}" min="${FORCA_MIN}" max="${FORCA_MAX}" step="0.05" value="${forca}" style="--pct: ${pct}%" aria-valuetext="${fmtX(forca)}">
          <output class="forca__valor" for="forca-${f.id}" data-forca-valor>${fmtX(forca)}</output>
          <div class="forca__marcas" aria-hidden="true"><span>×0,5</span><span>×1</span><span>×1,5</span><span>×2</span></div>
        </div>
        <div class="predef">${[0.5, 0.75, 1, 1.25, 1.5, 2].map((v) => `<button type="button" class="chip chip--sem-ret" data-acao="forca-predef" data-id="${f.id}" data-valor="${v}" aria-pressed="${v === forca}">${fmtX(v)}</button>`).join('')}</div>
        <div class="efeito">${efeito}</div>
      </div>
      ${variacoes}
      <div class="bes-bloco">
        <h4 class="bes-bloco__tit">Anotação do mestre</h4>
        <p class="bes-bloco__sub">${f.nota ? esc(f.nota) : 'Sem anotação.'} <button type="button" class="bt bt--p bt--fantasma" data-acao="ir-nota" data-id="${f.id}">${f.nota ? 'Editar' : 'Escrever'}</button></p>
      </div>
    </section>`
  }

  function numComForca(base, forca) {
    const final = Math.floor(base * forca)
    if (forca === 1) return fmt(final)
    return `<s>${fmt(base)}</s><span class="${forca > 1 ? 'efeito__num--sobe' : 'efeito__num--desce'}">${fmt(final)}</span>`
  }

  /** O deslizante muda os números na hora, sem redesenhar a página (o arrasto não pode parar). */
  function aplicarForca(id, valor, redesenhar) {
    const f = crua(id)
    if (!f) return
    f.forca = Math.round(valor * 100) / 100
    const det = $('.bes-det')
    if (det && !redesenhar) {
      $('[data-forca-valor]', det).textContent = fmtX(f.forca)
      const r = $(`#forca-${id}`)
      if (r) {
        r.style.setProperty('--pct', `${((f.forca - FORCA_MIN) / (FORCA_MAX - FORCA_MIN)) * 100}%`)
        r.setAttribute('aria-valuetext', fmtX(f.forca))
      }
      for (const el of $$('[data-efeito]', det)) el.innerHTML = numComForca(Number(el.dataset.base), f.forca)
      for (const b of $$('[data-acao="forca-predef"]', det)) b.setAttribute('aria-pressed', String(Number(b.dataset.valor) === f.forca))
      const lista = $(`[data-forca-lista="${id}"]`)
      if (lista) {
        lista.textContent = fmtX(f.forca)
        lista.classList.toggle('bes-item__forca--mexida', f.forca !== 1)
      }
    } else {
      renderPagina()
    }
  }

  /* =====================================================================
   * Página 3: Comparar e balancear
   * ===================================================================== */
  function pgComparar() {
    const todas = [...jogadores(), ...bestiario()]
    const cheio = E.cmpSel.length >= MAX_COMPARAR
    const chips = (lista) => lista.map((f) => {
      const on = E.cmpSel.includes(f.id)
      return `<button type="button" class="chip" data-acao="cmp-toggle" data-id="${f.id}" aria-pressed="${on}"${!on && cheio ? ' disabled' : ''}>${retrato(completa(f.id), 'p')}${esc(f.nome)}</button>`
    }).join('')
    const sel = E.cmpSel.map(completa).filter(Boolean)
    const tabela = sel.length < 2
      ? '<div class="vazio"><p>Escolha pelo menos 2 fichas acima para ver lado a lado.</p></div>'
      : tabelaComparar(sel)
    return `<div class="pg">
      ${cabecalho('Comparar e balancear', 'Até 4 fichas lado a lado: atributos, vida e o dano que as fórmulas dão de verdade. Embaixo, o peso de um grupo de inimigos contra os jogadores.')}
      <div class="cmp-escolha" role="group" aria-label="Fichas para comparar">
        <div class="cmp-escolha__lin"><span class="cmp-escolha__rot">Jogadores</span><div class="chips">${chips(jogadores())}</div></div>
        <div class="cmp-escolha__lin"><span class="cmp-escolha__rot">NPCs</span><div class="chips">${chips(bestiario())}</div></div>
        <p class="pg-nota">${E.cmpSel.length} de ${MAX_COMPARAR} escolhidas${cheio ? '. Tire uma para pôr outra.' : '.'} ${todas.length} fichas neste livro.</p>
      </div>
      <div class="cartao cmp">${tabela}</div>
      <p class="tabela-dica">A barra mais longa de cada linha marca quem lidera. NPC com força diferente de ×1 já aparece com a força aplicada.</p>
      ${secaoPeso()}
    </div>`
  }

  function linhaBarras(rotulo, sub, valores, classe, extra) {
    const max = Math.max(...valores, 1)
    const maiores = valores.filter((v) => v === max).length
    return `<tr><th scope="row">${rotulo}${sub ? `<small>${sub}</small>` : ''}</th>${valores.map((v, i) => `
      <td><div class="val${v === max && maiores === 1 && v > 0 ? ' val--lider' : ''}">
        <span class="barra ${classe || ''}" title="${esc(rotulo)}: ${fmt(v)}"><span class="barra__ench" style="transform: scaleX(${(v / max).toFixed(3)})"></span></span>
        <span class="val__num">${fmt(v)}${extra ? extra(i) : ''}</span>
      </div></td>`).join('')}</tr>`
  }

  function tabelaComparar(sel) {
    const cab = sel.map((f) => `<th scope="col"><div class="cmp-col">${retrato(f)}<div style="min-width:0"><span class="cmp-col__nome">${esc(f.nome)}</span><span class="cmp-col__sub">${seloTipo(f)}${forcaDe(f) !== 1 ? `<span class="selo selo--forca">${fmtX(forcaDe(f))}</span>` : ''}</span></div></div></th>`).join('')
    const grupo = (t) => `<tr class="cmp-grupo"><th scope="rowgroup" colspan="${sel.length + 1}">${t}</th></tr>`
    const atributos = L.ATRIBUTOS.map((a) => linhaBarras(a.nome, a.abrev, sel.map((f) => f.atributos[a.id] || 0), '', (i) => `<small>R${L.rank(sel[i], a.id)}</small>`)).join('')
    const golpes = sel.map((f) => {
      const itens = f.tecnicas.filter((t) => !t.forma).map((t) => {
        const d = L.lerDano(t.dano, f, t)
        if (d.status === 'sem') return ''
        if (d.valor == null) {
          const rot = d.status === 'ajuda' ? 'Na hora' : d.status === 'mao' ? 'À mão' : 'Não lê'
          return `<li class="golpe golpe--mao"><span class="golpe__nome">${esc(t.nome)}</span><span class="golpe__dano">${rot}</span><span class="golpe__conta">${esc(t.dano || d.motivo)}</span></li>`
        }
        const forca = forcaDe(f)
        const final = Math.floor(d.valor * forca)
        return `<li class="golpe"><span class="golpe__nome">${esc(t.nome)}</span><span class="golpe__dano">${fmt(final)}</span><span class="golpe__conta">${esc(d.conta)}${forca !== 1 ? ` · ${fmtX(forca)}` : ''}</span></li>`
      }).join('')
      return `<td style="vertical-align: top"><ul class="golpes">${itens || '<li class="golpe__conta">Sem golpe com dano.</li>'}</ul></td>`
    }).join('')
    const melhores = sel.map((f) => Math.round((melhorGolpe(f) ? melhorGolpe(f).valor : 0) * L.FATOR_DA_REACAO))
    return `<table>
      <caption class="sr">Comparação de ${sel.map((f) => esc(f.nome)).join(', ')}</caption>
      <thead><tr><th scope="col"><span class="sr">Atributo</span></th>${cab}</tr></thead>
      <tbody>
        ${grupo('Vida e fôlego')}
        ${linhaBarras('HP', 'com a força', sel.map(hpMax), 'barra--hp')}
        ${linhaBarras('SP', '', sel.map(spMax), 'barra--sp')}
        ${linhaBarras('Escudo', '', sel.map((f) => f.escudo || 0), 'barra--esc')}
        ${grupo('Atributos')}
        ${atributos}
        ${grupo('Dano pelas fórmulas da ficha')}
        <tr><th scope="row">Golpes<small>conta do app</small></th>${golpes}</tr>
        ${linhaBarras('Por rodada', 'melhor golpe × reação (0,6)', melhores, '')}
      </tbody>
    </table>`
  }

  function secaoPeso() {
    const p = encontro()
    const jog = jogadores().map((f) => `<button type="button" class="chip" data-acao="grupo-toggle" data-id="${f.id}" aria-pressed="${E.grupo.includes(f.id)}">${retrato(f, 'p')}${esc(f.nome)}</button>`).join('')
    const passos = bestiario().map((f0) => {
      const f = completa(f0.id)
      const n = E.inimigos[f.id] || 0
      return `<div class="passo">${retrato(f, 'p')}<span class="passo__nome">${esc(f.nome)}<small>HP ${fmt(hpMax(f))} · golpe ${fmt(melhorGolpe(f) ? melhorGolpe(f).valor : 0)}${forcaDe(f) !== 1 ? ' · ' + fmtX(forcaDe(f)) : ''}</small></span>
        <span class="passo__ctrl" role="group" aria-label="Quantos ${esc(f.nome)}">
          <button type="button" class="bt bt--ic bt--p" data-acao="inim-menos" data-id="${f.id}" aria-label="Um ${esc(f.nome)} a menos"${n === 0 ? ' disabled' : ''}>${ic('menos')}</button>
          <output aria-live="polite">${n}</output>
          <button type="button" class="bt bt--ic bt--p" data-acao="inim-mais" data-id="${f.id}" aria-label="Um ${esc(f.nome)} a mais"${n >= 6 ? ' disabled' : ''}>${ic('mais')}</button>
        </span></div>`
    }).join('')
    let veredito
    if (!p.nivel) {
      veredito = `<div class="cartao veredito"><div class="vazio" style="grid-column: 1 / -1"><p>Escolha pelo menos um jogador e um inimigo para ver o peso do encontro.</p></div></div>`
    } else {
      const maxR = Math.max(p.rg === Infinity ? 0 : p.rg, p.ri === Infinity ? 0 : p.ri, 1)
      const barra = (r, classe) => `<span class="barra"><span class="barra__ench" style="transform: scaleX(${r === Infinity ? 1 : (r / maxR).toFixed(3)})"></span></span>`
      const icone = { facil: 'ok', justo: 'balanca', duro: 'alerta', mortal: 'nao' }[p.nivel]
      const aviso = p.semGolpe.length
        ? `<p class="pg-nota" style="grid-column: 1 / -1">${ic('alerta')} ${p.semGolpe.map((f) => `<b>${esc(f.nome)}</b>`).join(', ')} não ${p.semGolpe.length === 1 ? 'tem' : 'têm'} golpe que o app lê: entra${p.semGolpe.length === 1 ? '' : 'm'} com dano 0. <button type="button" class="bt bt--p bt--fantasma" data-acao="trocar-aba" data-valor="saude">Ver na Saúde da ficha</button></p>`
        : ''
      veredito = `<div class="cartao veredito" data-peso="${p.nivel}">
        <div>
          <span class="veredito__selo">${ic(icone)}${NOME_DO_PESO[p.nivel]}</span>
          <p class="veredito__txt">O grupo derruba os inimigos em <b>${rodadas(p.rg)} rodadas</b>. Os inimigos derrubam o grupo em <b>${rodadas(p.ri)}</b>. ${p.nivel === 'mortal' ? 'Os inimigos chegam antes.' : p.nivel === 'duro' ? 'Perto demais: um azar no d20 vira derrota.' : p.nivel === 'justo' ? 'Dá trabalho, mas o grupo chega primeiro.' : 'O grupo atropela.'}</p>
        </div>
        <div class="rodadas" aria-label="Rodadas até cair">
          <div class="rodadas__lin rodadas__grupo"><span class="rodadas__rot"><span>Grupo derruba os inimigos</span><b>${rodadas(p.rg)}</b></span>${barra(p.rg)}</div>
          <div class="rodadas__lin rodadas__inim"><span class="rodadas__rot"><span>Inimigos derrubam o grupo</span><b>${rodadas(p.ri)}</b></span>${barra(p.ri)}</div>
        </div>
        ${aviso}
        <div class="veredito__acoes">
          <span class="pg-nota">Balancear a força dos inimigos para:</span>
          ${['facil', 'justo', 'duro'].map((k) => `<button type="button" class="bt bt--p${k === p.nivel ? ' bt--latao' : ''}" data-acao="balancear" data-valor="${k}">${ic('raio')}${NOME_DO_PESO[k]}</button>`).join('')}
          <button type="button" class="bt bt--p bt--fantasma" data-acao="ia-simular">${ic('ia')}Simular rodada a rodada</button>
        </div>
        <p class="premissas" style="grid-column: 1 / -1">Estimativa simples: cada um usa todo turno o melhor golpe que a ficha paga (sem OVERLOAD), a reação do alvo tira em média 40% do dano, e HP + Escudo somam a vida. Sem cura e sem transformação.</p>
      </div>`
    }
    return `<section class="pg-secao" aria-labelledby="peso-tit">
      <h3 class="pg-secao__tit" id="peso-tit">Peso do encontro <small>${p.g.length} jogadores contra ${p.inim.length} inimigos</small></h3>
      <div class="peso">
        <div class="cartao peso__lado"><h4 class="peso__tit">Jogadores <small class="pg-nota">HP ${fmt(p.Hg)} · ${fmt(Math.round(p.Dg))} por rodada</small></h4><div class="chips">${jog}</div></div>
        <div class="cartao peso__lado"><h4 class="peso__tit">Inimigos <small class="pg-nota">HP ${fmt(p.Hi)} · ${fmt(Math.round(p.Di))} por rodada</small></h4>${passos}</div>
        ${veredito}
      </div>
    </section>`
  }

  function balancear(alvo) {
    const p = encontro()
    if (!p.nivel || p.razao === 0) return
    const fator = Math.sqrt(ALVO_DO_PESO[alvo] / p.razao)
    const antes = {}
    for (const id of Object.keys(E.inimigos)) {
      if (!E.inimigos[id]) continue
      const f = crua(id)
      antes[id] = f.forca
      const novo = Math.round(Math.min(FORCA_MAX, Math.max(FORCA_MIN, (f.forca || 1) * fator)) * 20) / 20
      f.forca = novo
    }
    renderPagina()
    const depois = encontro()
    const travou = Object.keys(antes).some((id) => crua(id).forca === FORCA_MIN || crua(id).forca === FORCA_MAX)
    aviso(`Força dos inimigos ajustada: o encontro ficou ${NOME_DO_PESO[depois.nivel]}.${travou && depois.nivel !== alvo ? ' A força bateu no limite (×0,5 a ×2): mude o número de inimigos.' : ''}`, {
      desfazer: () => {
        for (const [id, v] of Object.entries(antes)) crua(id).forca = v
        renderPagina()
      },
    })
  }

  /* =====================================================================
   * Página 4: Saúde da ficha
   * ===================================================================== */
  function pgSaude() {
    const s = saude()
    const medidor = (campo) => {
      const c = s.cont[campo]
      const total = c.lido + c.ajuda + c.nao
      return `<div class="cartao medidor">
        <div class="medidor__cab"><span class="medidor__rot">${ROTULO_CAMPO[campo]}s lidos</span><span class="medidor__num">${s.pct(c)}%</span></div>
        <div class="medidor__barra" role="img" aria-label="${c.lido} lidos, ${c.ajuda} lidos na hora, ${c.nao} não lidos">
          <span class="m-lido" style="flex-grow: ${c.lido}"></span><span class="m-ajuda" style="flex-grow: ${c.ajuda}"></span><span class="m-nao" style="flex-grow: ${c.nao}"></span>
        </div>
        <p class="medidor__leg">${c.lido + c.ajuda} de ${total}${c.mao ? ` · ${c.mao} à mão de propósito` : ''}</p>
      </div>`
    }
    const filtros = ['todos', 'custo', 'dano', 'acao', 'tempo'].map((k) => {
      const n = k === 'todos' ? s.lista.length : s.lista.filter((p) => p.campo === k).length
      return `<button type="button" class="chip chip--sem-ret" data-acao="saude-filtro" data-valor="${k}" aria-pressed="${E.saudeFiltro === k}">${k === 'todos' ? 'Todos' : ROTULO_CAMPO[k]} · ${n}</button>`
    }).join('')
    const lista = s.lista
      .filter((p) => E.saudeFiltro === 'todos' || p.campo === E.saudeFiltro)
      .sort((a, b) => (a.r.status === b.r.status ? 0 : a.r.status === 'nao' ? -1 : 1))
    const itens = lista.length === 0
      ? `<div class="vazio"><p>${s.lista.length === 0 ? 'Tudo lido: a batalha automática entende todas as fichas deste livro.' : 'Nada neste filtro.'}</p></div>`
      : `<ul class="prob-lista">${lista.map(problema).join('')}</ul>`
    return `<div class="pg">
      ${cabecalho('Saúde da ficha', 'O que a batalha automática não consegue ler nas fichas deste livro, com uma sugestão de como escrever. Variação de NPC conta uma vez, pelo modelo.')}
      <div class="saude-resumo">${['custo', 'dano', 'acao', 'tempo'].map(medidor).join('')}</div>
      <ul class="legenda">
        <li>${seloStatus({ status: 'lido' })} o app faz a conta sozinho</li>
        <li>${seloStatus({ status: 'ajuda' })} precisa de algo na hora (arma, alvo ou confirmar um valor)</li>
        <li>${seloStatus({ status: 'nao' })} o app pergunta ou você digita</li>
      </ul>
      <div class="filtros" role="group" aria-label="Filtrar por campo">${filtros}</div>
      ${itens}
    </div>`
  }

  function problema(p) {
    const { f, t, campo, r } = p
    const sug = t.sugere && t.sugere[campo]
    const editando = E.corrigindo && E.corrigindo.tec === t.id && E.corrigindo.campo === campo
    const sugTexto = sug ? (sug[0] === '' ? `<b>Deixar à mão.</b> ${esc(sug[1])}` : `Escreva <q>${esc(sug[0])}</q>. ${esc(sug[1])}`) : ''
    const podeCorrigir = r.status === 'nao' || sug
    return `<li class="cartao prob">
      <div>
        <div class="prob__onde">${retrato(f, 'p')}<b>${esc(f.nome)}</b><span>${esc(t.nome)}${t.forma ? ' · forma ' + esc(t.forma) : ''}</span><span>· ${ROTULO_CAMPO[campo]}</span>${seloStatus(r)}</div>
        <p class="prob__escrito">Está escrito <q>${esc(t[campo])}</q></p>
        <p class="prob__porque">${esc(r.motivo || '')}</p>
        ${sugTexto ? `<p class="prob__sug">${sugTexto}</p>` : ''}
      </div>
      <div class="prob__acoes">
        ${podeCorrigir && !editando ? `<button type="button" class="bt bt--p bt--latao" data-acao="corrigir" data-id="${f.id}" data-tec="${t.id}" data-campo2="${campo}">Corrigir</button>` : ''}
        <button type="button" class="bt bt--p bt--fantasma" data-acao="abrir-ficha" data-id="${f.id}">Abrir ficha</button>
      </div>
      ${editando ? editorDeCorrecao(f, t, campo, sug) : ''}
    </li>`
  }

  function editorDeCorrecao(f, t, campo, sug) {
    const inicial = E.corrigindo.rascunho
    const id = `corrige-${t.id}-${campo}`
    return `<div class="corrige">
      <div class="campo"><label for="${id}">Novo ${ROTULO_CAMPO[campo].toLowerCase()} de ${esc(t.nome)}</label>
        <input class="entrada" id="${id}" data-campo="corrige" value="${esc(inicial)}" autocomplete="off" spellcheck="false" aria-describedby="${id}-leitura"></div>
      <div class="corrige__acoes" style="align-self: end">
        <button type="button" class="bt bt--primario" data-acao="corrigir-salvar" data-foco="corrigir-salvar">Salvar na ficha</button>
        ${campo === 'dano' ? '<button type="button" class="bt" data-acao="corrigir-mao">Deixar à mão</button>' : ''}
        <button type="button" class="bt bt--fantasma" data-acao="corrigir-cancelar">Cancelar</button>
      </div>
      <p class="corrige__leitura" id="${id}-leitura" aria-live="polite">${leituraAoVivo(f, t, campo, inicial)}</p>
    </div>`
  }

  function leituraAoVivo(f, t, campo, texto) {
    const r = ler(campo, { ...t, [campo]: texto, manual: false }, f)
    if (r.status === 'sem') return `<span class="status status--mao">${ic('nota')}Vazio</span> ${campo === 'dano' ? 'Sem dano: a técnica vira suporte.' : 'Sem valor neste campo.'}`
    if (r.status === 'nao') return `${seloStatus(r)} Ainda não lê: ${esc(r.motivo)}`
    const leitura = r.conta || r.leitura || ''
    return `${seloStatus(r)} O app lê: ${esc(leitura)}${r.status === 'ajuda' && r.motivo ? '. ' + esc(r.motivo) : ''}`
  }

  function salvarCorrecao(manual) {
    const c = E.corrigindo
    if (!c) return
    const f = crua(c.fichaId)
    const t = f.tecnicas.find((x) => x.id === c.tec)
    const antes = { valor: t[c.campo], efeito: t.efeito, manual: t.manual }
    const sug = t.sugere && t.sugere[c.campo]
    if (manual) {
      if (!t.efeito && t.dano) t.efeito = t.dano
      t.dano = ''
      t.manual = true
    } else {
      t[c.campo] = c.rascunho.trim()
      if (sug && sug[2] && c.rascunho.trim() === sug[0]) t.efeito = t.efeito ? `${t.efeito}. ${sug[2]}` : sug[2]
    }
    E.corrigindo = null
    const r = ler(c.campo, t, f)
    renderPagina()
    const frase = manual ? 'fica à mão de propósito' : r.status === 'lido' ? 'agora é lido' : r.status === 'ajuda' ? 'agora é lido na hora' : 'continua sem leitura'
    aviso(`${ROTULO_CAMPO[c.campo]} de ${t.nome} ${frase}.`, {
      desfazer: () => {
        t[c.campo] = antes.valor
        t.efeito = antes.efeito
        t.manual = antes.manual
        renderPagina()
      },
    })
  }

  /* =====================================================================
   * Página 5: Itens, armas e habilidades
   * ===================================================================== */
  const catItem = (id) => L.CATALOGO.find((c) => c.id === id)
  function catFiltrado() {
    const q = L.normalizar(E.catBusca)
    return L.CATALOGO.filter((c) => (E.catTipo === 'todos' || c.tipo === E.catTipo) && (!q || L.normalizar([c.nome, c.txt, ...Object.values(c.campos), L.TIPOS_DO_CATALOGO[c.tipo].um].join(' ')).includes(q)))
  }
  function pgItens() {
    const tipos = ['todos', ...Object.keys(L.TIPOS_DO_CATALOGO)].map((k) => {
      const tipo = L.TIPOS_DO_CATALOGO[k]
      return `<button type="button" class="chip chip--sem-ret" data-acao="cat-tipo" data-valor="${k}" aria-pressed="${E.catTipo === k}">${k === 'todos' ? 'Tudo' : tipo.nome}</button>`
    }).join('')
    return `<div class="pg">
      ${cabecalho('Itens, armas e habilidades', 'O catálogo do livro. Arraste para a ficha ao lado, ou use “Pôr na ficha”. Perícias, vantagens e desvantagens já existem no livro; armas, habilidades prontas e itens são novos.')}
      <div class="cat">
        <div>
          <div class="cat-busca">
            <div class="busca">${ic('busca')}<label class="sr" for="cat-busca">Buscar no catálogo</label>
              <input class="entrada entrada--busca" id="cat-busca" type="search" data-campo="cat-busca" value="${esc(E.catBusca)}" placeholder="Buscar por nome ou efeito (ex.: cura, escudo)" autocomplete="off"><kbd>/</kbd></div>
            <div class="chips" role="group" aria-label="Tipo">${tipos}</div>
          </div>
          <div id="cat-resultado">${listaDoCatalogo()}</div>
        </div>
        ${painelDestino()}
      </div>
    </div>`
  }

  function listaDoCatalogo() {
    const lista = catFiltrado()
    const destino = crua(E.destino)
    if (lista.length === 0) {
      return `<div class="vazio"><p>Nada com “${esc(E.catBusca)}”${E.catTipo !== 'todos' ? ' em ' + L.TIPOS_DO_CATALOGO[E.catTipo].nome : ''}. Tente pelo efeito (cura, escudo) ou pelo tipo (arma).</p>
        <button type="button" class="bt bt--p" data-acao="cat-limpar">Limpar a busca</button></div>`
    }
    return `<ul class="cat-lista" aria-label="Catálogo, ${lista.length} itens">${lista.map((c) => {
      const tipo = L.TIPOS_DO_CATALOGO[c.tipo]
      const campos = Object.entries(c.campos).map(([k, v]) => `<span>${esc(k)} <b>${esc(v)}</b></span>`).join('')
      return `<li><article class="cartao item" draggable="true" data-item="${c.id}" aria-label="${esc(tipo.um)}: ${esc(c.nome)}">
        <div class="item__cab"><h3 class="item__nome">${esc(c.nome)}</h3><span class="selo ${tipo.origem === 'livro' ? 'selo--livro' : 'selo--novo'}">${tipo.origem === 'livro' ? 'Do livro' : 'Novo'}</span></div>
        <p class="item__txt">${esc(tipo.um)} · ${esc(c.txt)}</p>
        ${campos ? `<p class="item__campos">${campos}</p>` : ''}
        <div class="item__pe"><span class="alca" title="Arraste para a ficha">${ic('alca')}</span>
          <button type="button" class="bt bt--p" data-acao="cat-por" data-id="${c.id}">Pôr em ${esc(destino.nome.split(' ')[0])}</button></div>
      </article></li>`
    }).join('')}</ul>`
  }

  function painelDestino() {
    const f = crua(E.destino)
    const opcoes = [...jogadores(), ...modelos()].map((x) => `<option value="${x.id}"${x.id === f.id ? ' selected' : ''}>${esc(x.nome)}</option>`).join('')
    const novo = (nome) => (E.novos.has(`${f.id}:${nome}`) ? ' class="e-novo"' : '')
    const lista = (itens, vazio) => (itens.length ? `<ul>${itens.join('')}</ul>` : `<p class="destino__vazio">${vazio}</p>`)
    const secao = (id, titulo, extra, conteudo) => `<div class="destino__secao" data-secao="${id}"><h4>${titulo}<small>${extra}</small></h4>${conteudo}<p class="destino__solta">Solte para pôr em ${titulo} de ${esc(f.nome.split(' ')[0])}</p></div>`
    return `<aside class="cartao destino" aria-label="Ficha que recebe">
      <div class="campo"><label for="cat-destino">Ficha que recebe</label><select class="seletor" id="cat-destino" data-campo="cat-destino">${opcoes}</select></div>
      ${secao('armas', 'Armas', `leva ${f.armasPorBatalha} por batalha`, lista(f.armas.map((a) => `<li${novo(a.nome)}><span>${esc(a.nome)}</span><span>${esc(a.dano)}</span></li>`), 'Nenhuma arma.'))}
      ${secao('tecnicas', 'Habilidades', `${f.tecnicas.length}`, lista(f.tecnicas.slice(-5).map((t) => `<li${novo(t.nome)}><span>${esc(t.nome)}</span></li>`), 'Nenhuma habilidade.'))}
      ${secao('itens', 'Itens', 'aba nova', lista(f.itens.map((i) => `<li${novo(i)}><span>${esc(i)}</span></li>`), 'Nenhum item. A ficha ganharia a aba Itens.'))}
      ${secao('pericias', 'Perícias', `${f.pericias.length}`, lista(f.pericias.map((i) => `<li${novo(i)}><span>${esc(i)}</span></li>`), 'Nenhuma perícia.'))}
      ${secao('vantagens', 'Vantagens', `${f.vantagens.length}`, lista(f.vantagens.map((i) => `<li${novo(i)}><span>${esc(i)}</span></li>`), 'Nenhuma vantagem.'))}
      ${secao('desvantagens', 'Desvantagens', `${f.desvantagens.length}`, lista(f.desvantagens.map((i) => `<li${novo(i)}><span>${esc(i)}</span></li>`), 'Nenhuma desvantagem.'))}
      <p class="pg-nota">Variações de NPC herdam do modelo: escolha o modelo para dar a todas.</p>
    </aside>`
  }

  function porNaFicha(itemId, fichaId) {
    const c = catItem(itemId)
    const f = crua(fichaId)
    if (!c || !f) return
    const tipo = L.TIPOS_DO_CATALOGO[c.tipo]
    const secao = tipo.secao
    const nomes = secao === 'armas' ? f.armas.map((a) => a.nome) : secao === 'tecnicas' ? f.tecnicas.map((t) => t.nome) : f[secao]
    if (nomes.includes(c.nome)) {
      aviso(`${f.nome} já tem ${c.nome}.`)
      return
    }
    let desfazer
    if (secao === 'armas') {
      const a = { id: 'a' + Date.now(), nome: c.nome, dano: c.campos.Dano || '', acao: c.campos['Ação'] || '', efeito: c.campos.Efeito || '' }
      f.armas.push(a)
      desfazer = () => { f.armas = f.armas.filter((x) => x !== a) }
    } else if (secao === 'tecnicas') {
      const t = { id: 't' + Date.now(), nome: c.nome, descricao: c.txt, acao: c.campos['Ação'] || '', custo: c.campos.Custo || '', dano: c.campos.Dano || '-', tempo: c.campos.Tempo || '', efeito: c.campos.Efeito || '' }
      f.tecnicas.push(t)
      desfazer = () => { f.tecnicas = f.tecnicas.filter((x) => x !== t) }
    } else {
      f[secao].push(c.nome)
      desfazer = () => { f[secao] = f[secao].filter((x) => x !== c.nome) }
    }
    E.novos.add(`${f.id}:${c.nome}`)
    renderPagina()
    const extra = secao === 'armas' && f.armas.length > f.armasPorBatalha ? ` Agora são ${f.armas.length} armas: na batalha ${f.nome.split(' ')[0]} escolhe ${f.armasPorBatalha}.` : ''
    aviso(`${c.nome} entrou em ${tipo.nome} de ${f.nome}.${extra}`, { desfazer: () => { desfazer(); renderPagina() } })
  }

  /* =====================================================================
   * Página 6: Anotações
   * ===================================================================== */
  function pgNotas() {
    const todas = [...jogadores(), ...bestiario()]
    const f = crua(E.notSel) || todas[0]
    const item = (x) => `<button type="button" class="not-item" data-acao="not-sel" data-id="${x.id}" aria-current="${x.id === f.id}">${retrato(completa(x.id), 'p')}
      <span style="min-width:0"><span class="not-item__nome">${esc(x.nome)}</span><span class="not-item__previa" data-previa="${x.id}">${x.nota ? esc(x.nota) : 'Sem nota'}</span></span></button>`
    return `<div class="pg">
      ${cabecalho('Anotações', 'Notas do mestre em cada ficha e cada NPC. Só você vê: não aparecem na tela do jogador.')}
      <div class="not">
        <nav class="cartao not-lista" aria-label="Fichas">
          <p class="bes-grupo__tit">Jogadores</p>${jogadores().map(item).join('')}
          <p class="bes-grupo__tit">NPCs de combate</p>${bestiario().map(item).join('')}
        </nav>
        <section class="cartao not-ed" aria-labelledby="not-nome">
          <div class="not-ed__cab">${retrato(completa(f.id))}<h3 class="not-ed__nome" id="not-nome">${esc(f.nome)}</h3><span class="privado">${ic('cadeado')}Só você vê</span></div>
          <label class="sr" for="nota-${f.id}">Anotação sobre ${esc(f.nome)}</label>
          <textarea class="area" id="nota-${f.id}" data-campo="nota" data-id="${f.id}" placeholder="Segredos, ganchos, o que ele quer, como reage se perder...">${esc(f.nota || '')}</textarea>
          <p class="salvo" data-salvo="${f.id}" aria-live="polite">${f.nota ? 'Guardada nesta página.' : ''}</p>
          <p class="pg-nota">A mesma nota aparece na ficha aberta e no bestiário.</p>
        </section>
      </div>
    </div>`
  }

  let relogioDaNota = 0
  function guardarNota(id, texto) {
    const f = crua(id)
    if (!f) return
    f.nota = texto
    for (const el of $$(`[data-previa="${id}"]`)) el.textContent = texto.trim() ? texto : 'Sem nota'
    for (const el of $$(`[data-salvo="${id}"]`)) el.textContent = 'Guardando…'
    clearTimeout(relogioDaNota)
    relogioDaNota = setTimeout(() => {
      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      for (const el of $$(`[data-salvo="${id}"]`)) el.textContent = `Guardada às ${hora}.`
      atualizarMarcadores()
    }, 400)
  }

  /* =====================================================================
   * Página 7: No mapa (o atalho do editor e a caixa do Iniciar batalha)
   * ===================================================================== */
  const TOKENS_DO_MAPA = [
    { id: 'lia', x: 22, y: 70 }, { id: 'bruno', x: 32, y: 78 }, { id: 'duda', x: 18, y: 84 },
    { id: 'ilo', x: 64, y: 30 }, { id: 'otavio', x: 74, y: 24 },
    { cen: 'juca', x: 78, y: 70 }, { cen: 'lu', x: 52, y: 62 },
  ]
  function pgMapa() {
    const tokens = TOKENS_DO_MAPA.map((t) => {
      const f = t.id ? completa(t.id) : E.cenario.find((c) => c.id === t.cen) || L.CENARIO.find((c) => c.id === t.cen)
      if (!f) return '' // NPC apagado do bestiário: o token sai do quadro
      return `<span class="ficha-tok${t.cen ? ' ficha-tok--sem' : ''}" style="left:${t.x}%; top:${t.y}%">${retrato(f)}${esc(f.nome.split(' ').slice(-1)[0])}</span>`
    }).join('')
    return `<div class="pg">
      ${cabecalho('No mapa', 'Como o mundo do livro aparece dentro do editor. Dois quadros: o atalho no livro do mestre e a pergunta do Iniciar batalha.')}
      <div class="quadros">
        <figure class="cartao quadro" style="margin:0">
          <figcaption class="quadro__leg"><b>Livro do mestre</b>, seção Livro de regras</figcaption>
          <div class="livro-mini">
            <p class="livro-mini__tit">Personagens · da pasta One Piece</p>
            ${jogadores().slice(0, 3).map((f) => `<div class="livro-mini__ficha">${retrato(f, 'p')}${esc(f.nome)}<span class="selo selo--jogador">Jogador</span></div>`).join('')}
            <button type="button" class="bt livro-mini__novo" data-acao="mapa-atalho">${ic('livro')}Abrir o mundo do One Piece</button>
            <p class="livro-mini__nota">Atalho novo: abre esta tela por cima do editor; fechar volta ao mapa.</p>
          </div>
        </figure>
        <figure class="cartao quadro" style="margin:0">
          <figcaption class="quadro__leg"><b>Iniciar batalha</b> com NPC sem ficha de combate no mapa</figcaption>
          <div class="mapa-mini">
            <div class="mapa-mini__sala" style="left:8%; top:52%; width:40%; height:42%"></div>
            <div class="mapa-mini__sala" style="left:46%; top:10%; width:46%; height:72%"></div>
            ${tokens}
            <div class="mapa-mini__barra"><button type="button" class="bt bt--primario" data-acao="iniciar-batalha">${ic('npc')}Iniciar batalha</button></div>
          </div>
          <p class="quadro__leg" style="border-bottom:0; border-top: 1px solid var(--lb-gr-filete)">Tokens em cinza não têm ficha de combate. Ao iniciar, o app pergunta quem entra.</p>
        </figure>
      </div>
    </div>`
  }

  function abrirIniciarBatalha() {
    const comFicha = TOKENS_DO_MAPA.filter((t) => t.id).map((t) => completa(t.id)).filter(Boolean)
    const sem = TOKENS_DO_MAPA.filter((t) => t.cen).map((t) => E.cenario.find((c) => c.id === t.cen) || L.CENARIO.find((c) => c.id === t.cen))
    const opcoes = `<option value="minima">Ficha mínima (HP 300, golpe 80)</option>${modelos().map((m) => `<option value="${m.id}">Como ${esc(m.nome)}</option>`).join('')}`
    abrirModal(`<form class="modal" id="form-batalha" role="dialog" aria-modal="true" aria-labelledby="bat-tit" novalidate>
      <div class="modal__cab"><h2 class="modal__tit" id="bat-tit">Quem entra na batalha?</h2>
        <p class="modal__sub">Há ${sem.length} tokens no mapa sem ficha de combate. Marque os que lutam; o resto fica fora da ordem dos turnos.</p></div>
      <div class="modal__corpo">
        <fieldset style="border:0; margin:0; padding:0"><legend class="pg-secao__tit">Têm ficha de combate</legend>
          <ul class="entra-lista">${comFicha.map((f) => `<li class="entra"><input type="checkbox" id="bat-${f.id}" name="entra" value="${f.id}" checked><label for="bat-${f.id}">${retrato(f, 'p')}<span class="entra__nome">${esc(f.nome)}<small>${f.tipo === 'jogador' ? 'Jogador' : 'NPC'} · HP ${fmt(hpMax(f))}</small></span></label><span></span></li>`).join('')}</ul>
        </fieldset>
        <fieldset style="border:0; margin:0; padding:0"><legend class="pg-secao__tit">Sem ficha de combate</legend>
          <ul class="entra-lista">${sem.map((c) => `<li class="entra"><input type="checkbox" id="bat-${c.id}" name="cenario" value="${c.id}"><label for="bat-${c.id}">${retrato(c, 'p')}<span class="entra__nome">${esc(c.nome)}<small>${esc(c.oficio)}</small></span></label>
            <span><select class="seletor" id="bat-como-${c.id}" name="como-${c.id}" aria-label="Como ${esc(c.nome)} entra" disabled>${opcoes}</select></span></li>`).join('')}</ul>
        </fieldset>
        <p class="pg-nota" id="bat-resumo" aria-live="polite"></p>
      </div>
      <div class="modal__pe"><button type="button" class="bt" data-acao="modal-fechar">Cancelar</button><button type="submit" class="bt bt--primario" id="bat-ok">Iniciar batalha</button></div>
    </form>`, () => atualizarResumoDaBatalha())
  }

  function atualizarResumoDaBatalha() {
    const form = $('#form-batalha')
    if (!form) return
    const n = $$('input[type="checkbox"]:checked', form).length
    for (const cb of $$('input[name="cenario"]', form)) $(`#bat-como-${cb.value}`).disabled = !cb.checked
    $('#bat-ok').textContent = n === 0 ? 'Marque quem entra' : `Iniciar com ${n}`
    $('#bat-ok').disabled = n === 0
    const extras = $$('input[name="cenario"]:checked', form).length
    $('#bat-resumo').textContent = extras ? `${extras} sem ficha ${extras === 1 ? 'entra' : 'entram'} com a ficha escolhida, só nesta batalha.` : 'Ninguém sem ficha entra.'
  }

  /* =====================================================================
   * Gaveta da ficha (abre de qualquer tela)
   * ===================================================================== */
  function htmlGaveta(id) {
    const f = completa(id)
    const forca = forcaDe(f)
    const caixa = (rot, val, extra = '') => `<div class="atr"><span class="atr__ab">${rot}</span><span class="atr__val">${val}${extra}</span></div>`
    const tecnicas = f.tecnicas.map((t) => {
      const linhas = [['Ação', 'acao'], ['Custo', 'custo'], ['Dano', 'dano'], ['Tempo', 'tempo']].map(([rot, campo]) => {
        const r = ler(campo, t, f)
        if (r.status === 'sem' && !(campo === 'dano' && t.manual)) return ''
        const conta = campo === 'dano' && r.conta ? ` <small class="pg-nota">(${esc(r.conta)}${forca !== 1 ? ' ' + fmtX(forca) : ''})</small>` : ''
        return `<dt>${rot}</dt><dd>${esc(t[campo] || '—')}${conta}</dd>${seloStatus(r)}`
      }).join('')
      return `<li class="cartao tec"><div class="tec__cab"><span class="tec__nome">${esc(t.nome)}</span>${t.forma ? `<span class="tec__forma">Forma: ${esc(t.forma)}</span>` : ''}</div>
        <dl class="tec__campos">${linhas}${t.efeito ? `<dt>Efeito</dt><dd>${esc(t.efeito)}</dd><span></span>` : ''}</dl></li>`
    }).join('')
    const juntar = (lista) => (lista && lista.length ? lista.map(esc).join(', ') : '—')
    return `<div class="fundo fundo--entrando" data-acao="fechar-gaveta"></div>
      <section class="gaveta gaveta--fora" role="dialog" aria-modal="true" aria-labelledby="gaveta-nome">
        <header class="gaveta__cab">${retrato(f, 'g')}
          <div><h2 class="gaveta__nome" id="gaveta-nome">${esc(f.nome)}</h2>
            <p class="gaveta__sub">${seloTipo(f)}${esc(f.raca)} · ${esc(f.oficio)}${f.tipo === 'jogador' ? (f.jogador ? ` · entra como “${esc(f.jogador)}”` : ' · sem jogador') : ''}${forca !== 1 ? ` <span class="selo selo--forca">Força ${fmtX(forca)}</span>` : ''}</p></div>
          <button type="button" class="bt bt--ic" data-acao="fechar-gaveta" aria-label="Fechar a ficha">${ic('x')}</button>
        </header>
        <div class="gaveta__corpo">
          ${f.modeloId ? `<p class="pg-nota">Variação de <b>${esc(nomeDe(f.modeloId))}</b>: técnicas e armas vêm do modelo.</p>` : ''}
          <div class="gaveta__sec"><h3>Vida e fôlego</h3><div class="recursos">${caixa('HP', fmt(hpMax(f)))}${caixa('SP', fmt(spMax(f)))}${caixa('Escudo', fmt(f.escudo || 0))}</div></div>
          <div class="gaveta__sec"><h3>Atributos</h3><div class="atrs">${L.ATRIBUTOS.map((a) => caixa(a.abrev, fmt(f.atributos[a.id] || 0), `<span class="atr__rank">R${L.rank(f, a.id)}</span>`)).join('')}</div></div>
          <div class="gaveta__sec"><h3>Técnicas <small class="pg-nota">${f.tecnicas.length}</small></h3><ul class="tec-lista">${tecnicas}</ul></div>
          <div class="gaveta__sec"><h3>Armas <small class="pg-nota">leva ${f.armasPorBatalha} por batalha</small></h3><p class="pg-nota">${f.armas.map((a) => `<b>${esc(a.nome)}</b> (${esc(a.dano)})`).join(' · ') || 'Nenhuma arma.'}</p></div>
          <div class="gaveta__sec"><h3>Itens, perícias, vantagens e desvantagens</h3>
            <p class="pg-nota"><b>Itens:</b> ${juntar(f.itens)}<br><b>Perícias:</b> ${juntar(f.pericias)}<br><b>Vantagens:</b> ${juntar(f.vantagens)}<br><b>Desvantagens:</b> ${juntar(f.desvantagens)}</p></div>
          <div class="gaveta__sec"><h3><label for="gaveta-nota">Anotações do mestre</label><span class="privado">${ic('cadeado')}Só você vê</span></h3>
            <textarea class="area" id="gaveta-nota" rows="4" data-campo="nota" data-id="${f.id}" placeholder="Só aparece para você.">${esc(f.nota || '')}</textarea>
            <p class="salvo" data-salvo="${f.id}" aria-live="polite"></p></div>
        </div>
      </section>`
  }

  let gavetaDe = null
  function abrirGaveta(id) {
    const camada = $('#camada-gaveta')
    gavetaDe = document.activeElement
    camada.innerHTML = htmlGaveta(id)
    const g = $('.gaveta', camada)
    const fundo = $('.fundo', camada)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      g.classList.remove('gaveta--fora')
      fundo.classList.remove('fundo--entrando')
    }))
    $('[data-acao="fechar-gaveta"].bt', camada).focus()
  }
  function fecharGaveta() {
    const camada = $('#camada-gaveta')
    const g = $('.gaveta', camada)
    if (!g) return
    g.classList.add('gaveta--fora', 'gaveta--saindo')
    $('.fundo', camada).classList.add('fundo--saindo')
    setTimeout(() => { camada.innerHTML = '' }, E.movimento === 'normal' ? 210 : 0)
    // A nota pode ter mudado na gaveta: redesenha a página e devolve o foco ao botão que abriu.
    const chave = chaveDe(gavetaDe)
    if (E.tela === 'mundo') renderPagina()
    const volta = gavetaDe && document.contains(gavetaDe) ? gavetaDe : chave && $$('#pagina button, #pagina [tabindex]').find((el) => chaveDe(el) === chave)
    if (volta) volta.focus()
    else if (E.tela === 'mundo') $('#pagina').focus()
    gavetaDe = null
  }

  /* =====================================================================
   * Diálogos, avisos, foco
   * ===================================================================== */
  let modalDe = null
  function abrirModal(html, aoAbrir) {
    const camada = $('#camada-modal')
    modalDe = document.activeElement
    camada.innerHTML = `<div class="modal-fundo modal-fundo--fora" data-fundo-modal>${html}</div>`
    const fundo = $('.modal-fundo', camada)
    requestAnimationFrame(() => requestAnimationFrame(() => fundo.classList.remove('modal-fundo--fora')))
    if (aoAbrir) aoAbrir()
    const primeiro = $('[data-foco-inicial]', camada) || $('input:not([disabled]), select:not([disabled]), textarea, button:not([disabled])', camada)
    if (primeiro) primeiro.focus()
  }
  function fecharModal() {
    const camada = $('#camada-modal')
    const fundo = $('.modal-fundo', camada)
    if (!fundo) return
    fundo.classList.add('modal-fundo--fora')
    setTimeout(() => { camada.innerHTML = '' }, E.movimento === 'normal' ? 160 : 0)
    if (modalDe && document.contains(modalDe)) modalDe.focus()
    modalDe = null
  }
  function prenderFoco(container, evento) {
    const focaveis = $$('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', container).filter((el) => el.offsetParent !== null)
    if (focaveis.length === 0) return
    const primeiro = focaveis[0]
    const ultimo = focaveis[focaveis.length - 1]
    if (evento.shiftKey && document.activeElement === primeiro) { ultimo.focus(); evento.preventDefault() }
    else if (!evento.shiftKey && document.activeElement === ultimo) { primeiro.focus(); evento.preventDefault() }
  }

  function aviso(texto, opcoes = {}) {
    const li = document.createElement('li')
    li.className = 'aviso aviso--fora'
    li.innerHTML = `<span class="aviso__txt">${esc(texto)}</span>`
    if (opcoes.acao) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'bt bt--p bt--latao'
      b.textContent = opcoes.acao.rotulo
      b.addEventListener('click', () => { opcoes.acao.fn(); sair() })
      li.append(b)
    }
    if (opcoes.desfazer) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'bt bt--p'
      b.textContent = 'Desfazer'
      b.addEventListener('click', () => { opcoes.desfazer(); sair(); aviso('Desfeito.') })
      li.append(b)
    }
    const fechar = document.createElement('button')
    fechar.type = 'button'
    fechar.className = 'bt bt--ic bt--p'
    fechar.setAttribute('aria-label', 'Dispensar aviso')
    fechar.innerHTML = ic('x')
    fechar.addEventListener('click', () => sair())
    li.append(fechar)
    const lista = $('#avisos')
    lista.append(li)
    while (lista.children.length > 3) lista.firstElementChild.remove()
    requestAnimationFrame(() => requestAnimationFrame(() => li.classList.remove('aviso--fora')))
    let relogio = setTimeout(sair, DURACAO_DO_AVISO_MS)
    li.addEventListener('mouseenter', () => clearTimeout(relogio))
    li.addEventListener('focusin', () => clearTimeout(relogio))
    li.addEventListener('mouseleave', () => { clearTimeout(relogio); relogio = setTimeout(sair, DURACAO_DO_AVISO_MS / 2) })
    function sair() {
      clearTimeout(relogio)
      if (!li.isConnected) return
      li.classList.add('aviso--fora', 'aviso--saindo')
      setTimeout(() => li.remove(), E.movimento === 'normal' ? 170 : 0)
    }
  }

  /* =====================================================================
   * NPC novo (modal) e ações do bestiário
   * ===================================================================== */
  function abrirNovoNpc({ modeloId = 'recruta', nome = '', deCenario = null } = {}) {
    const forcas = [0.5, 0.75, 1, 1.25, 1.5, 2]
    abrirModal(`<form class="modal" id="form-npc" role="dialog" aria-modal="true" aria-labelledby="npc-tit" novalidate data-cenario="${esc(deCenario || '')}">
      <div class="modal__cab"><h2 class="modal__tit" id="npc-tit">${deCenario ? 'Dar ficha de batalha' : 'Novo NPC de combate'}</h2>
        <p class="modal__sub">${deCenario ? 'Ele sai do cenário e passa a entrar na ordem dos turnos.' : 'Uma variação de um modelo: herda técnicas, armas e atributos.'}</p></div>
      <div class="modal__corpo">
        <div class="campo"><label for="npc-modelo">A partir do modelo</label><select class="seletor" id="npc-modelo">${modelos().map((m) => `<option value="${m.id}"${m.id === modeloId ? ' selected' : ''}>${esc(m.nome)}</option>`).join('')}</select></div>
        <div class="campo"><label for="npc-nome">Nome</label><input class="entrada" id="npc-nome" value="${esc(nome)}" maxlength="40" autocomplete="off" aria-describedby="npc-erro" data-foco-inicial><span class="campo__dica" id="npc-erro"></span></div>
        <div class="campo"><label for="npc-forca">Força</label><select class="seletor" id="npc-forca">${forcas.map((v) => `<option value="${v}"${v === 1 ? ' selected' : ''}>${fmtX(v)}</option>`).join('')}</select><span class="campo__dica">Multiplica HP e dano. Dá para mudar depois.</span></div>
      </div>
      <div class="modal__pe"><button type="button" class="bt" data-acao="modal-fechar">Cancelar</button><button type="submit" class="bt bt--primario">Criar no bestiário</button></div>
    </form>`)
  }

  function criarNpc(form) {
    const nomeEl = $('#npc-nome', form)
    const nome = nomeEl.value.trim()
    const erro = $('#npc-erro', form)
    let msg = ''
    if (!nome) msg = 'Dê um nome ao NPC.'
    else if (E.fichas.some((f) => L.normalizar(f.nome) === L.normalizar(nome))) msg = `Já existe “${nome}” neste livro. Use outro nome.`
    if (msg) {
      erro.textContent = msg
      erro.style.color = 'var(--mu-erro-texto)'
      nomeEl.setAttribute('aria-invalid', 'true')
      nomeEl.focus()
      return
    }
    const modeloId = $('#npc-modelo', form).value
    const forca = Number($('#npc-forca', form).value)
    const deCenario = form.dataset.cenario
    const novo = { id: 'n' + Date.now(), nome, tipo: 'npc', modeloId, forca, nota: deCenario ? 'Era NPC de cenário.' : '' }
    E.fichas.push(novo)
    let cen = null
    if (deCenario) {
      cen = E.cenario.find((c) => c.id === deCenario)
      E.cenario = E.cenario.filter((c) => c.id !== deCenario)
    }
    E.besSel = novo.id
    fecharModal()
    renderPagina()
    aviso(`${nome} entrou no bestiário como variação de ${nomeDe(modeloId)}.`, {
      desfazer: () => {
        E.fichas = E.fichas.filter((f) => f !== novo)
        if (cen) E.cenario.push(cen)
        E.besSel = modeloId
        renderPagina()
      },
    })
  }

  /* =====================================================================
   * Painel da IA
   * ===================================================================== */
  const MODOS = {
    conversa: {
      nome: 'Conversa',
      dica: 'Regras, fichas e criação de personagem. Cite alguém pelo nome e a ficha entra na conversa.',
      lugar: 'Pergunte sobre as regras ou uma ficha…',
      sugestoes: ['Que técnica cabe na Nina Farol?', 'Como funciona a reação no d20?', 'O que a Duda Sal faz bem e o que falta?'],
    },
    equilibrio: {
      nome: 'Equilíbrio',
      dica: 'Compara as fichas citadas e sugere ajustes com número. Sem fichas citadas, usa as 4 de Comparar.',
      lugar: 'Quem está fora da curva?',
      sugestoes: ['Quem está fora da curva entre Lia, Bruno, Vera e Otávio?', 'O Rafa Quilha está fraco demais?'],
    },
    simulacao: {
      nome: 'Simulação',
      dica: 'Combate rodada a rodada com as regras do livro. Sem NPC citado, usa o encontro montado em Comparar.',
      lugar: 'Quanto o grupo dura contra…',
      sugestoes: ['Quanto o grupo dura contra o encontro de Comparar?', 'E se a Capitã Vera Doca vier sozinha?'],
    },
  }
  const GENERICAS = new Set(['recruta', 'sargento', 'capita', 'bandido', 'marinha', 'porto', 'tenente', 'da', 'do', 'de'])

  function detectarFichas(texto) {
    const t = ' ' + L.normalizar(texto).replace(/[^a-z0-9 ]/g, ' ') + ' '
    const achadas = []
    for (const f of E.fichas) {
      const nome = L.normalizar(f.nome)
      const palavras = nome.split(' ').filter((p) => p.length >= 3 && !GENERICAS.has(p))
      const bate = t.includes(' ' + nome + ' ') || palavras.some((p) => new RegExp(`\\s${p}\\w{0,2}\\s`).test(t))
      if (bate) achadas.push(f.id)
    }
    return achadas
  }
  function fichasDaConversa() {
    const campo = $('#ia-texto')
    const auto = campo ? detectarFichas(campo.value).filter((id) => !E.ia.fixas.includes(id)) : []
    const todas = [...E.ia.fixas, ...auto]
    return { fixas: E.ia.fixas.slice(0, MAX_FICHAS_IA), auto: auto.slice(0, Math.max(0, MAX_FICHAS_IA - E.ia.fixas.length)), fora: todas.slice(MAX_FICHAS_IA) }
  }
  function secoesLidas(texto) {
    const t = L.normalizar(texto)
    return L.SECOES_DAS_REGRAS.filter((s) => s.chaves.some((k) => t.includes(k))).map((s) => s.titulo)
  }

  function htmlFichasDaIA() {
    const { fixas, auto, fora } = fichasDaConversa()
    const chip = (id, eAuto) => {
      const f = completa(id)
      return `<span class="ia-chip${eAuto ? ' ia-chip--auto' : ''}" title="${eAuto ? 'Citada no texto: entra ao enviar' : 'Na conversa'}">${retrato(f, 'p')}${esc(f.nome)}
        ${eAuto ? '' : `<button type="button" class="bt bt--ic bt--p" data-acao="ia-tirar" data-id="${id}" aria-label="Tirar ${esc(f.nome)} da conversa">${ic('x')}</button>`}</span>`
    }
    const usadas = new Set([...fixas, ...auto])
    const opcoes = E.fichas.filter((f) => !usadas.has(f.id)).map((f) => `<option value="${f.id}">${esc(f.nome)}</option>`).join('')
    const cheio = usadas.size >= MAX_FICHAS_IA
    return `<div class="ia-fichas__cab"><span>Fichas na conversa</span><span>${usadas.size} de ${MAX_FICHAS_IA}</span></div>
      ${usadas.size ? `<div class="chips">${fixas.map((id) => chip(id, false)).join('')}${auto.map((id) => chip(id, true)).join('')}</div>` : '<p class="ia-fichas__vazio">Nenhuma. Cite um nome na pergunta ou escolha abaixo.</p>'}
      ${fora.length ? `<p class="ia-fichas__vazio">Até ${MAX_FICHAS_IA} fichas por pergunta: ${fora.map((id) => esc(nomeDe(id))).join(', ')} ficou de fora.</p>` : ''}
      <label class="sr" for="ia-por">Pôr uma ficha na conversa</label>
      <select class="seletor" id="ia-por" data-campo="ia-por"${cheio ? ' disabled' : ''}><option value="">${cheio ? 'Já são 4 fichas' : '+ Pôr ficha na conversa'}</option>${opcoes}</select>`
  }
  function htmlLendo() {
    const campo = $('#ia-texto')
    const ultima = [...E.ia.conversa].reverse().find((m) => m.de === 'mestre')
    const texto = (campo && campo.value) || (ultima ? ultima.texto : '')
    const secoes = secoesLidas(texto)
    const { fixas, auto } = fichasDaConversa()
    const ids = [...fixas, ...auto]
    const retratos = ids.filter((id) => completa(id).retrato).length
    return `Lendo: <b>${secoes.length ? 'regras de ' + secoes.map(esc).join(', ') : 'nenhuma seção de regra (a pergunta não citou)'}</b> · <b>catálogos do livro</b> · <b>${ids.length} ${ids.length === 1 ? 'ficha' : 'fichas'}</b>${retratos ? ` · <b>${retratos} ${retratos === 1 ? 'retrato' : 'retratos'}</b>` : ''}`
  }
  function atualizarContexto() {
    const caixa = $('#ia-fichas')
    if (caixa) caixa.innerHTML = htmlFichasDaIA()
    const lendo = $('#ia-lendo')
    if (lendo) lendo.innerHTML = htmlLendo()
  }

  function renderIA() {
    const el = $('#ia')
    const modo = MODOS[E.ia.modo]
    const config = !E.ia.config ? '' : `<section class="ia-config" id="ia-config" aria-labelledby="ia-config-tit">
        <h3 class="ia-config__tit" id="ia-config-tit">Chave da IA</h3>
        <div class="ia-config__lin">
          <div class="campo"><label for="ia-prov">Provedor</label><select class="seletor" id="ia-prov" disabled aria-describedby="ia-prov-dica"><option>Gemini</option></select></div>
          <div class="campo"><label for="ia-modelo">Modelo</label><select class="seletor" id="ia-modelo"><option>gemini-2.5-flash-lite</option><option>gemini-2.5-flash</option></select></div>
        </div>
        <span class="campo__dica" id="ia-prov-dica">Só Gemini, como no projeto-rpg-v2.</span>
        ${Array.from({ length: E.ia.campos }, (_, i) => `<div class="campo"><label for="ia-chave-${i}">Chave ${E.ia.campos > 1 ? i + 1 : ''}</label><input class="entrada" type="password" id="ia-chave-${i}" data-chave autocomplete="off" spellcheck="false" placeholder="Cole a chave (exemplo: nada sai desta página)"></div>`).join('')}
        <span class="campo__dica">Mais de uma chave: quando uma esgota, o app passa para a próxima.</span>
        <div class="pg-acoes"><button type="button" class="bt bt--p" data-acao="ia-chave-mais"${E.ia.campos >= 3 ? ' disabled' : ''}>${ic('mais')}Outra chave</button><button type="button" class="bt bt--p bt--primario" data-acao="ia-chave-salvar">Guardar</button></div>
        <p class="ia-config__estado${E.ia.chaves ? ' ia-config__estado--ok' : ''}" aria-live="polite">${E.ia.chaves ? `${E.ia.chaves} ${E.ia.chaves === 1 ? 'chave guardada' : 'chaves guardadas'} neste computador. No protótipo, só nesta página e nada é enviado.` : 'Nenhuma chave guardada.'}</p>
      </section>`
    el.innerHTML = `
      <div class="ia-cab">
        <h2 class="ia-cab__tit" id="ia-titulo">Assistente do mestre<small>Lê as regras e as fichas deste livro</small></h2>
        ${E.ia.conversa.length ? `<button type="button" class="bt bt--p bt--fantasma" data-acao="ia-nova">Nova conversa</button>` : ''}
        <button type="button" class="bt bt--ic bt--p" data-acao="ia-config" aria-expanded="${E.ia.config}" aria-controls="ia-config" aria-label="Chave da IA" title="Chave da IA">${ic('engrenagem')}</button>
        <button type="button" class="bt bt--ic bt--p" data-acao="ia-fechar" aria-label="Fechar o assistente" title="Fechar">${ic('x')}</button>
      </div>
      ${config}
      <div class="ia-modos" role="radiogroup" aria-label="O que pedir">${Object.entries(MODOS).map(([k, m]) => `<button type="button" role="radio" class="ia-modo" data-acao="ia-modo" data-valor="${k}" aria-checked="${E.ia.modo === k}" tabindex="${E.ia.modo === k ? 0 : -1}">${m.nome}</button>`).join('')}</div>
      <p class="ia-modo__dica">${modo.dica}</p>
      <div class="ia-fichas" id="ia-fichas">${htmlFichasDaIA()}</div>
      <p class="ia-lendo" id="ia-lendo">${htmlLendo()}</p>
      <div class="ia-conversa" id="ia-conversa" aria-live="polite" aria-label="Conversa com o assistente">${htmlConversa()}</div>
      <div class="ia-compor">
        ${E.ia.chaves ? '' : '<p class="ia-semchave">Sem chave da IA: as respostas aqui são de exemplo. <button type="button" data-acao="ia-config-abrir">Pôr a chave</button></p>'}
        <div class="ia-compor__lin">
          <label class="sr" for="ia-texto">Pergunta ao assistente</label>
          <textarea class="area" id="ia-texto" data-campo="ia-texto" rows="1" placeholder="${esc(modo.lugar)}"></textarea>
          <button type="button" class="bt bt--primario" data-acao="ia-enviar" aria-label="Enviar">${ic('enviar')}</button>
        </div>
        <div class="ia-compor__pe"><button type="button" class="bt bt--p bt--latao" data-acao="ia-gerar-abrir" aria-expanded="${E.ia.gerar}">${ic('ia')}Gerar NPC</button><span><kbd>Enter</kbd> envia · <kbd>Shift</kbd>+<kbd>Enter</kbd> quebra a linha</span></div>
      </div>`
    rolarConversa()
  }

  function htmlConversa() {
    const modo = MODOS[E.ia.modo]
    const partes = []
    if (E.ia.conversa.length === 0 && !E.ia.gerar && !E.ia.gerado) {
      partes.push(`<p class="ia-vazio">${modo.dica}</p><div class="ia-sugestoes">${modo.sugestoes.map((s) => `<button type="button" class="ia-sugestao" data-acao="ia-sugestao" data-texto="${esc(s)}">${esc(s)}</button>`).join('')}</div>`)
    }
    for (const m of E.ia.conversa) {
      partes.push(m.de === 'mestre' ? `<div class="msg msg--mestre">${esc(m.texto)}</div>` : `<div class="msg msg--ia">${m.html}<span class="msg__exemplo">Resposta de exemplo: o protótipo não chama a IA.</span></div>`)
    }
    if (E.ia.gerar) partes.push(htmlGerar())
    if (E.ia.gerado) partes.push(htmlNpcGerado(E.ia.gerado))
    if (E.ia.pensando) partes.push('<div class="msg msg--pensando" role="status"><i></i><i></i><i></i><span class="sr">Pensando</span></div>')
    return partes.join('')
  }
  function renderConversa() {
    const c = $('#ia-conversa')
    if (!c) return
    c.innerHTML = htmlConversa()
    rolarConversa()
  }
  function rolarConversa() {
    const c = $('#ia-conversa')
    if (c) c.scrollTop = c.scrollHeight
  }

  function enviarPergunta(texto) {
    const limpo = texto.trim()
    if (!limpo || E.ia.pensando) return
    const { fixas, auto } = fichasDaConversa()
    E.ia.fixas = [...fixas, ...auto].slice(0, MAX_FICHAS_IA)
    const ids = E.ia.fixas.slice()
    E.ia.conversa.push({ de: 'mestre', texto: limpo })
    E.ia.pensando = true
    const campo = $('#ia-texto')
    if (campo) { campo.value = ''; campo.style.height = '' }
    renderIA()
    $('#ia-texto').focus()
    setTimeout(() => {
      E.ia.pensando = false
      E.ia.conversa.push({ de: 'ia', html: responder(E.ia.modo, limpo, ids) })
      renderConversa()
      atualizarContexto()
    }, ESPERA_DA_IA_MS)
  }

  /* ---- respostas de exemplo, montadas com os números das fichas ---- */
  function responder(modo, texto, ids) {
    if (modo === 'equilibrio') return respostaEquilibrio(ids)
    if (modo === 'simulacao') return respostaSimulacao(ids)
    return respostaConversa(texto, ids)
  }

  function atributosOrdenados(f) {
    return L.ATRIBUTOS.map((a) => ({ a, v: f.atributos[a.id] || 0 })).sort((x, y) => y.v - x.v)
  }

  function respostaConversa(texto, ids) {
    const t = L.normalizar(texto)
    if (t.includes('reacao') || /\bd20\b/.test(t)) {
      return `<p>No ataque, quem apanha rola 1d20, sem modificador:</p><ul><li>1: falha crítica, leva ×1,5.</li><li>2 a 9: leva o dano inteiro.</li><li>10 a 14: defende, leva metade.</li><li>15 a 19: esquiva, não leva nada. 20: contra-ataca.</li></ul><p>Uma reação por rodada; volta no começo da própria vez.</p>`
    }
    const f = ids.length ? completa(ids[0]) : null
    if (!f) return '<p>Cite uma ficha pelo nome (ex.: “que técnica cabe na Nina?”) ou troque para Equilíbrio ou Simulação.</p>'
    const [top, segundo] = atributosOrdenados(f)
    const fraco = atributosOrdenados(f).slice(-1)[0]
    if (/tecnica|ideia|habilidade|golpe novo/.test(t)) {
      const NOMES = { Cozinheiro: ['Brasa Guia', 'Caldo Fervente', 'Pimenta no Olho'], Navegador: ['Vento de Través', 'Corte de Proa', 'Rosa dos Ventos'], Ferreiro: ['Rebite Duplo', 'Têmpera', 'Faísca de Forja'], Médico: ['Pulso Firme', 'Compressa Fria', 'Ponto Cego'], Carpinteiro: ['Prego de Aço', 'Viga Solta', 'Encaixe'] }
      const nomes = NOMES[f.oficio] || ['Golpe Firme', 'Passo Rápido', 'Guarda Alta']
      const ideias = [
        `<li><b>${nomes[0]}</b>: Ação Bônus · -25 de SP · ${top.a.nome} + 30 de dano · Tempo 2</li>`,
        `<li><b>${nomes[1]}</b>: Ação Simples · -45 de SP · ${top.a.nome} + ${segundo.a.abrev} + 40 · Tempo 3</li>`,
        `<li><b>${nomes[2]}</b>: Ação Bônus · -20 de SP · Efeito: o alvo tem -2 na próxima reação</li>`,
      ]
      return `<p>Para ${esc(f.nome)}, puxando ${top.a.nome} (${fmt(top.v)}), o atributo mais alto:</p><ul>${ideias.join('')}</ul><p>Escritas no formato que o app lê: a Saúde da ficha fica em 100%.</p>`
    }
    const mg = melhorGolpe(f)
    return `<h4>${esc(f.nome)}</h4><ul><li>Papel: ${top.a.nome} ${fmt(top.v)} e ${segundo.a.nome} ${fmt(segundo.v)} puxam o jogo dele.</li><li>Ponto fraco: ${fraco.a.nome} ${fmt(fraco.v)}.</li><li>${mg ? `Melhor golpe hoje: ${esc(mg.tec.nome)}, ${fmt(mg.valor)} de dano.` : 'Nenhum golpe que o app lê: veja a Saúde da ficha.'} HP ${fmt(hpMax(f))}, SP ${fmt(spMax(f))}.</li></ul>`
  }

  function respostaEquilibrio(ids) {
    const usar = (ids.length >= 2 ? ids : E.cmpSel).map(completa).filter(Boolean)
    if (usar.length < 2) return '<p>Preciso de pelo menos 2 fichas. Cite os nomes ou escolha em Comparar.</p>'
    const dados = usar.map((f) => ({ f, mg: melhorGolpe(f), hp: hpMax(f) + (f.escudo || 0) }))
    const danos = dados.map((d) => (d.mg ? d.mg.valor : 0)).sort((a, b) => a - b)
    const mediana = danos[Math.floor(danos.length / 2)] || 1
    const leitura = dados.map((d) => `<li>${esc(d.f.nome)}: golpe ${d.mg ? fmt(d.mg.valor) : '0'}, vida ${fmt(d.hp)}${d.mg && d.mg.valor > d.hp / 4 ? ': bate mais do que aguenta' : d.hp > 1500 ? ': tanque' : ''}.</li>`).join('')
    const deslizes = []
    const sugestoes = []
    for (const d of dados) {
      if (!d.mg) {
        deslizes.push(`<li>${esc(d.f.nome)}: nenhum golpe lido, conta como 0.</li>`)
        sugestoes.push(`<li>Corrigir os danos de ${esc(d.f.nome)} na Saúde da ficha antes de comparar.</li>`)
        continue
      }
      if (d.mg.valor > mediana * 1.35) {
        deslizes.push(`<li>${esc(d.f.nome)}: ${esc(d.mg.tec.nome)} dá ${fmt(d.mg.valor)}, ${Math.round((d.mg.valor / mediana - 1) * 100)}% acima da mediana (${fmt(mediana)}).</li>`)
        const m = /\+\s*(\d+)/.exec(d.mg.tec.dano)
        if (m && !d.f.modeloId && d.f.tipo === 'jogador') {
          const novo = Math.max(10, Math.round((Number(m[1]) * 0.66) / 5) * 5)
          sugestoes.push(`<li>${esc(d.mg.tec.nome)}: “${esc(d.mg.tec.dano)}” → “${esc(d.mg.tec.dano.replace(m[0], '+ ' + novo))}”.</li>`)
        } else if (d.f.tipo === 'npc') {
          sugestoes.push(`<li>Força de ${esc(d.f.nome)}: ${fmtX(forcaDe(d.f))} → ${fmtX(Math.max(FORCA_MIN, Math.round(forcaDe(d.f) * (mediana / d.mg.valor) * 20) / 20))}.</li>`)
        }
      }
    }
    if (!deslizes.length) deslizes.push('<li>Ninguém passa de 35% acima da mediana de dano.</li>')
    if (!sugestoes.length) sugestoes.push('<li>Nada urgente. Se quiser apertar, suba a força dos NPCs em ×0,25.</li>')
    return `<h4>Leitura</h4><ul>${leitura}</ul><h4>Desequilíbrios</h4><ul>${deslizes.slice(0, 3).join('')}</ul><h4>Sugestões</h4><ul>${sugestoes.slice(0, 3).join('')}</ul>${ids.length < 2 ? '<p class="pg-nota">Usei as fichas de Comparar, porque a pergunta citou menos de 2.</p>' : ''}`
  }

  function respostaSimulacao(ids) {
    const citadosJog = ids.filter((id) => crua(id) && crua(id).tipo === 'jogador')
    const citadosNpc = ids.filter((id) => crua(id) && crua(id).tipo === 'npc')
    const inimigos = citadosNpc.length ? Object.fromEntries(citadosNpc.map((id) => [id, 1])) : E.inimigos
    const p = encontro(citadosJog.length ? citadosJog : E.grupo, inimigos)
    if (!p.g.length || !p.inim.length) return '<p>Monte o encontro em Comparar, ou cite jogadores e NPCs pelo nome.</p>'
    let hg = p.Hg
    let hi = p.Hi
    const linhas = []
    let r = 0
    while (hg > 0 && hi > 0 && r < 12) {
      r += 1
      hi = Math.max(0, hi - p.Dg)
      hg = Math.max(0, hg - p.Di)
      linhas.push(`<tr><td>${r}</td><td>${fmt(Math.round(hg))}</td><td>${fmt(Math.round(hi))}</td></tr>`)
    }
    const venceGrupo = hi <= 0 && hg > 0
    const resultado = venceGrupo
      ? `Grupo vence na rodada ${r}, com ~${Math.round((hg / p.Hg) * 100)}% do HP.`
      : hg <= 0 && hi > 0 ? `Inimigos vencem na rodada ${r}; sobram ~${Math.round((hi / p.Hi) * 100)}% do HP deles.` : hi <= 0 && hg <= 0 ? `Empate na rodada ${r}: os dois lados caem juntos.` : `Ninguém cai em ${r} rodadas.`
    return `<p><b>${resultado}</b> Margem alta: um 20 na reação muda uma rodada inteira.</p>
      <table class="simul"><thead><tr><th>Rodada</th><th>HP do grupo</th><th>HP dos inimigos</th></tr></thead><tbody>${linhas.join('')}</tbody></table>
      <h4>Premissas</h4><ul><li>${p.g.map((f) => esc(f.nome.split(' ')[0])).join(', ')} contra ${p.inim.length} inimigos, com a força atual.</li><li>Melhor golpe pagável todo turno; reação média tira 40%.</li><li>Sem cura, sem transformação, sem OVERLOAD.${p.semGolpe.length ? ` ${p.semGolpe.map((f) => esc(f.nome.split(' ')[0])).join(', ')} entra com 0 (dano não lido).` : ''}</li></ul>`
  }

  /* ---- Gerar NPC: devolve uma ficha estruturada para revisar e salvar ---- */
  function htmlGerar() {
    return `<form class="gerar" id="form-gerar" novalidate>
      <h3 class="gerar__tit">Gerar NPC</h3>
      <div class="campo"><label for="gerar-desc">Como é o NPC?</label><textarea class="area" id="gerar-desc" rows="3" placeholder="Ex.: tenente da Marinha que luta com correntes" aria-describedby="gerar-erro"></textarea><span class="campo__dica" id="gerar-erro"></span></div>
      <div class="campo"><label for="gerar-nivel">Força perto do grupo</label><select class="seletor" id="gerar-nivel"><option value="0.8">Mais fraco que o grupo</option><option value="1" selected>Do nível do grupo</option><option value="1.4">Chefe</option></select></div>
      <div class="pg-acoes"><button type="submit" class="bt bt--p bt--primario">${ic('ia')}Gerar ficha</button><button type="button" class="bt bt--p bt--fantasma" data-acao="ia-gerar-cancelar">Cancelar</button></div>
    </form>`
  }

  const TEMAS = [
    { chaves: ['corrente', 'elo', 'acorrent'], nome: 'Tenente Malha', oficio: 'Tenente', raca: 'Humano', cor: 'tide', enfase: { forca: 1.3, resistencia: 1.2 },
      tecs: [['Corrente Pesada', 'Ação Simples', '-30 de SP', 'Força + 70 de dano', '2', ''], ['Laço de Ferro', 'Ação Bônus', '-20 de SP', '-', '3', 'Prende o alvo por 1 turno'], ['Turbilhão de Elos', 'Ação Completa', '-60 de SP', '(Força + 40) x 2', 'OVERLOAD', '']] },
    { chaves: ['fogo', 'chama', 'fruta', 'akuma', 'logia'], nome: 'Dona Cinza', oficio: 'Capitã pirata', raca: 'Humano', cor: 'ember', enfase: { espirito: 1.4, agilidade: 1.1 },
      tecs: [['Fagulha', 'Ação Simples', '-25 de SP', 'Espírito + 60 de dano', '1', ''], ['Muro de Brasa', 'Ação Bônus', '-30 de SP', '-', '3', '+120 de Escudo'], ['Incêndio de Convés', 'Ação Completa', '-90 de SP', 'Espírito x 2', 'OVERLOAD', '']] },
    { chaves: [], nome: 'Guarda-costas Bento', oficio: 'Guarda-costas', raca: 'Ogro', cor: 'parchment-dim', enfase: { forca: 1.2, resistencia: 1.4 },
      tecs: [['Ombrada', 'Ação Simples', '', 'Força + 40 de dano', '', ''], ['Escudo Humano', 'Reação', '-20 de SP', '-', '2', 'Leva o golpe no lugar de um aliado'], ['Esmagar', 'Ação Completa', '-40 de SP', 'Força + Resistência / 2', '3', '']] },
  ]

  function gerarNpc(descricao, nivel) {
    const d = L.normalizar(descricao)
    const tema = TEMAS.find((t) => t.chaves.some((k) => d.includes(k))) || TEMAS[TEMAS.length - 1]
    const grupo = E.grupo.map(crua).filter(Boolean)
    const media = (id) => grupo.reduce((s, f) => s + (f.atributos[id] || 0), 0) / Math.max(1, grupo.length)
    const atributos = {}
    for (const a of L.ATRIBUTOS) atributos[a.id] = Math.max(5, Math.round((media(a.id) * nivel * (tema.enfase[a.id] || 0.85)) / 5) * 5)
    let n = 0
    const tecnicas = tema.tecs.map(([nome, acao, custo, dano, tempo, efeito]) => ({ id: 'g' + Date.now() + ++n, nome, descricao: '', acao, custo, dano, tempo, efeito }))
    return { id: 'g' + Date.now(), nome: tema.nome, tipo: 'npc', modelo: true, unico: true, raca: tema.raca, oficio: tema.oficio, cor: tema.cor, forca: 1, atributos, escudo: nivel > 1.2 ? 100 : 0, armasPorBatalha: 1, armas: [], itens: [], pericias: [], vantagens: [], desvantagens: [], formas: [], tecnicas, nota: `Gerado pela IA a partir de: “${descricao.trim()}”.` }
  }

  function htmlNpcGerado(f) {
    const lidos = f.tecnicas.flatMap((t) => ['custo', 'dano', 'acao', 'tempo'].map((c) => ler(c, t, f))).filter((r) => r.status !== 'sem')
    const ok = lidos.filter((r) => r.status === 'lido' || r.status === 'ajuda').length
    return `<section class="npc-gerado" aria-labelledby="gerado-nome">
      <div class="npc-gerado__cab">${retrato(f)}<div><h3 class="npc-gerado__nome" id="gerado-nome">${esc(f.nome)}</h3><p class="npc-gerado__sub">${esc(f.raca)} · ${esc(f.oficio)} · NPC único</p></div></div>
      <div class="campo"><label for="gerado-nomear">Nome</label><input class="entrada" id="gerado-nomear" data-campo="gerado-nome" value="${esc(f.nome)}" maxlength="40" autocomplete="off"></div>
      <div class="atrs">${L.ATRIBUTOS.map((a) => `<div class="atr"><span class="atr__ab">${a.abrev}</span><span class="atr__val">${fmt(f.atributos[a.id])}</span></div>`).join('')}</div>
      <p class="pg-nota">HP <b>${fmt(hpMax(f))}</b> · SP <b>${fmt(spMax(f))}</b> · Escudo <b>${fmt(f.escudo)}</b></p>
      <ul class="npc-gerado__tec">${f.tecnicas.map((t) => {
        const d = L.lerDano(t.dano, f, t)
        return `<li><b>${esc(t.nome)}</b><span>${esc(t.acao)}${t.custo ? ' · ' + esc(t.custo) : ''}${t.dano && t.dano !== '-' ? ' · ' + esc(t.dano) + (d.valor != null ? ` (= ${fmt(d.valor)})` : '') : ''}${t.tempo ? ' · Tempo ' + esc(t.tempo) : ''}${t.efeito ? ' · ' + esc(t.efeito) : ''}</span></li>`
      }).join('')}</ul>
      <p class="pg-nota">${seloStatus({ status: ok === lidos.length ? 'lido' : 'nao' })} O app lê ${ok} de ${lidos.length} campos desta ficha.</p>
      <div class="npc-gerado__acoes"><button type="button" class="bt bt--p bt--primario" data-acao="ia-salvar-npc">Salvar no bestiário</button><button type="button" class="bt bt--p" data-acao="ia-gerar-abrir">Gerar outro</button><button type="button" class="bt bt--p bt--fantasma" data-acao="ia-descartar">Descartar</button></div>
    </section>`
  }

  function salvarNpcGerado() {
    const f = E.ia.gerado
    if (!f) return
    const campo = $('#gerado-nomear')
    const nome = (campo ? campo.value : f.nome).trim() || f.nome
    if (E.fichas.some((x) => L.normalizar(x.nome) === L.normalizar(nome))) {
      aviso(`Já existe “${nome}” no livro. Troque o nome antes de salvar.`)
      if (campo) campo.focus()
      return
    }
    f.nome = nome
    E.fichas.push(f)
    E.ia.gerado = null
    E.besSel = f.id
    renderConversa()
    if (E.tela === 'mundo') renderPagina()
    aviso(`${nome} foi salvo no bestiário.`, {
      acao: { rotulo: 'Ver', fn: () => trocarAba('npcs') },
      desfazer: () => {
        E.fichas = E.fichas.filter((x) => x !== f)
        E.besSel = 'recruta'
        renderPagina()
      },
    })
  }

  /* =====================================================================
   * Perguntas para o usuário (as mesmas do README)
   * ===================================================================== */
  function abrirPerguntas() {
    abrirModal(`<div class="modal modal--largo" role="dialog" aria-modal="true" aria-labelledby="perg-tit">
      <div class="modal__cab"><h2 class="modal__tit" id="perg-tit">Para decidir</h2><p class="modal__sub">Cada uma vem com a recomendação. As mesmas estão no README.</p></div>
      <div class="modal__corpo"><ol class="perguntas">
        <li><b>Como o app reconhece o jogador?</b><span>Pelo nome que ele digita ao entrar (hoje), ou por um código guardado no navegador dele. <em>Recomendo o nome</em>, com aviso quando dois entram com o mesmo nome.</span></li>
        <li><b>NPC sem ficha de combate ao iniciar a batalha: entra com quê?</b><span>Ficha mínima (HP 300, golpe 80) ou um modelo do bestiário escolhido na hora. <em>Recomendo oferecer os dois</em>, com a ficha mínima marcada.</span></li>
        <li><b>A força do NPC mexe também no Escudo e no SP?</b><span>Hoje o protótipo mexe só em HP e dano. <em>Recomendo só HP e dano</em>: é o que se sente na mesa e é fácil de explicar.</span></li>
        <li><b>A ficha ganha uma aba Itens?</b><span>O livro tem armas por ficha, mas não inventário. <em>Recomendo sim</em>, simples: nome, quantidade e efeito.</span></li>
        <li><b>As anotações do mestre entram no contexto da IA?</b><span>Ajuda a IA a sugerir (“a Vera foge com 50% do HP”). <em>Recomendo sim</em>, só quando a ficha é citada.</span></li>
        <li><b>Golpe “à mão de propósito” conta contra a saúde da ficha?</b><span><em>Recomendo não</em>: aparece em cinza como “à mão”, fora da porcentagem.</span></li>
      </ol></div>
      <div class="modal__pe"><button type="button" class="bt bt--primario" data-acao="modal-fechar" data-foco-inicial>Fechar</button></div>
    </div>`)
  }

  /* =====================================================================
   * Tela inicial: o labirinto (as mesmas paredes de HomeMaze.tsx)
   * ===================================================================== */
  function desenharLabirinto() {
    const PAREDES = [[0, 0, 10, 0], [10, 0, 10, 4], [10, 6, 10, 10], [10, 10, 0, 10], [0, 10, 0, 6], [0, 4, 0, 0], [2, 2, 8, 2], [2, 2, 2, 8], [2, 8, 6, 8], [8, 2, 8, 6], [8, 8, 10, 8], [4, 4, 6, 4], [4, 4, 4, 6], [6, 6, 8, 6], [6, 8, 6, 10], [6, 4, 6, 6], [0, 4, 2, 4], [4, 0, 4, 2]]
    const CELULA = 40
    const PASSO_MS = 45
    const linhas = PAREDES.map(([x1, y1, x2, y2], i) => `<line class="lb-home__wall" x1="${x1 * CELULA}" y1="${y1 * CELULA}" x2="${x2 * CELULA}" y2="${y2 * CELULA}" pathLength="1" style="animation-delay: ${300 + i * PASSO_MS}ms"/>`).join('')
    $('#home-labirinto').innerHTML = `<g transform="translate(8 8)">${linhas}<circle class="lb-home__core-halo" cx="200" cy="200" r="34"/><circle class="lb-home__core" cx="200" cy="200" r="7"/></g>`
  }

  /* =====================================================================
   * Eventos (delegados)
   * ===================================================================== */
  const PAGINAS = { jogadores: pgJogadores, npcs: pgNpcs, comparar: pgComparar, saude: pgSaude, itens: pgItens, notas: pgNotas, mapa: pgMapa }

  const ACOES = {
    'porta-fora': () => { $('#home-aviso').textContent = 'No protótipo, só a porta 04 abre.' },
    'ir-inicio': () => irPara('inicio'),
    'ir-sistemas': () => irPara('sistemas'),
    'ir-mundo': () => irPara('mundo'),
    'trocar-aba': (b) => trocarAba(b.dataset.valor),
    'abrir-ficha': (b) => abrirGaveta(b.dataset.id),
    'fechar-gaveta': () => fecharGaveta(),
    'comparar-com': (b) => {
      const id = b.dataset.id
      if (!E.cmpSel.includes(id)) {
        if (E.cmpSel.length >= MAX_COMPARAR) E.cmpSel.pop()
        E.cmpSel.push(id)
      }
      trocarAba('comparar')
    },
    'jog-criar': (b) => {
      const nome = b.dataset.valor
      const f = { id: 'p' + Date.now(), nome: `Ficha de ${nome}`, tipo: 'jogador', jogador: nome, raca: 'Humano', oficio: 'Navegador', cor: 'parchment-dim', atributos: { forca: 10, agilidade: 10, percepcao: 10, resistencia: 0, intuicao: 10, espirito: 0, carisma: 10, determinacao: 10 }, escudo: 0, armasPorBatalha: 1, armas: [], itens: [], pericias: [], vantagens: [], desvantagens: [], formas: [], tecnicas: [], nota: '' }
      E.fichas.splice(jogadores().length, 0, f)
      renderPagina()
      aviso(`Ficha criada e ligada a “${nome}”.`, { desfazer: () => { E.fichas = E.fichas.filter((x) => x !== f); renderPagina() } })
      abrirGaveta(f.id)
    },
    'bes-sel': (b) => { E.besSel = b.dataset.id; renderPagina() },
    'bes-novo': () => abrirNovoNpc(),
    'bes-variacao': (b) => abrirNovoNpc({ modeloId: b.dataset.id, nome: `${nomeDe(b.dataset.id).split(' ')[0]} ${variacoesDe(b.dataset.id).length + 1}` }),
    'bes-dar-ficha': (b) => {
      const c = E.cenario.find((x) => x.id === b.dataset.id)
      abrirNovoNpc({ nome: c.nome, deCenario: c.id, modeloId: 'bandido' })
    },
    'bes-apagar': (b) => {
      const f = crua(b.dataset.id)
      const i = E.fichas.indexOf(f)
      E.fichas.splice(i, 1)
      E.cmpSel = E.cmpSel.filter((x) => x !== f.id)
      E.ia.fixas = E.ia.fixas.filter((x) => x !== f.id)
      const qtd = E.inimigos[f.id]
      delete E.inimigos[f.id]
      E.besSel = f.modeloId
      renderPagina()
      aviso(`${f.nome} saiu do bestiário.`, { desfazer: () => { E.fichas.splice(i, 0, f); if (qtd) E.inimigos[f.id] = qtd; E.besSel = f.id; renderPagina() } })
    },
    'forca-predef': (b) => aplicarForca(b.dataset.id, Number(b.dataset.valor), false),
    'ir-nota': (b) => { E.notSel = b.dataset.id; trocarAba('notas'); const a = $(`#nota-${b.dataset.id}`); if (a) a.focus() },
    'cmp-toggle': (b) => {
      const id = b.dataset.id
      E.cmpSel = E.cmpSel.includes(id) ? E.cmpSel.filter((x) => x !== id) : E.cmpSel.length < MAX_COMPARAR ? [...E.cmpSel, id] : E.cmpSel
      renderPagina()
    },
    'grupo-toggle': (b) => {
      const id = b.dataset.id
      E.grupo = E.grupo.includes(id) ? E.grupo.filter((x) => x !== id) : [...E.grupo, id]
      renderPagina()
    },
    'inim-mais': (b) => { E.inimigos[b.dataset.id] = Math.min(6, (E.inimigos[b.dataset.id] || 0) + 1); renderPagina() },
    'inim-menos': (b) => { E.inimigos[b.dataset.id] = Math.max(0, (E.inimigos[b.dataset.id] || 0) - 1); renderPagina() },
    'balancear': (b) => balancear(b.dataset.valor),
    'ia-simular': () => {
      abrirIA()
      E.ia.modo = 'simulacao'
      renderIA()
      enviarPergunta('Simule o encontro montado em Comparar, rodada a rodada.')
    },
    'saude-filtro': (b) => { E.saudeFiltro = b.dataset.valor; E.corrigindo = null; renderPagina() },
    'corrigir': (b) => {
      const f = crua(b.dataset.id)
      const t = f.tecnicas.find((x) => x.id === b.dataset.tec)
      const campo = b.dataset.campo2
      const sug = t.sugere && t.sugere[campo]
      E.corrigindo = { fichaId: f.id, tec: t.id, campo, rascunho: sug && sug[0] !== '' ? sug[0] : t[campo] }
      renderPagina()
      const campoEl = $(`#corrige-${t.id}-${campo}`)
      if (campoEl) { campoEl.focus(); campoEl.select() }
    },
    'corrigir-salvar': () => salvarCorrecao(false),
    'corrigir-mao': () => salvarCorrecao(true),
    'corrigir-cancelar': () => { E.corrigindo = null; renderPagina() },
    'cat-tipo': (b) => { E.catTipo = b.dataset.valor; renderPagina() },
    'cat-limpar': () => { E.catBusca = ''; E.catTipo = 'todos'; renderPagina(); $('#cat-busca').focus() },
    'cat-por': (b) => porNaFicha(b.dataset.id, E.destino),
    'not-sel': (b) => { E.notSel = b.dataset.id; renderPagina() },
    'mapa-atalho': () => { trocarAba('jogadores'); aviso('No editor, este botão abre o mundo do livro por cima do mapa.') },
    'iniciar-batalha': () => abrirIniciarBatalha(),
    'modal-fechar': () => fecharModal(),
    'perguntas': () => abrirPerguntas(),
    'movimento': () => {
      E.movimento = E.movimento === 'normal' ? 'reduzido' : 'normal'
      aplicarMovimento()
    },
    'recomecar': () => window.location.reload(),
    'ia-abrir': () => abrirIA(),
    'ia-fechar': () => {
      E.iaAberta = false
      atualizarMarcadores()
      renderPagina()
      const b = $('[data-acao="ia-abrir"]')
      if (b) b.focus()
    },
    'ia-modo': (b) => { E.ia.modo = b.dataset.valor; renderIA(); $(`.ia-modo[data-valor="${b.dataset.valor}"]`).focus() },
    'ia-config': () => { E.ia.config = !E.ia.config; renderIA(); if (E.ia.config) $('#ia-chave-0').focus(); else $('[data-acao="ia-config"]').focus() },
    'ia-config-abrir': () => { E.ia.config = true; renderIA(); $('#ia-chave-0').focus() },
    'ia-chave-mais': () => { E.ia.campos = Math.min(3, E.ia.campos + 1); renderIA(); $(`#ia-chave-${E.ia.campos - 1}`).focus() },
    'ia-chave-salvar': () => {
      const n = $$('[data-chave]').filter((c) => c.value.trim()).length
      E.ia.chaves = Math.max(E.ia.chaves, n)
      E.ia.campos = 1
      renderIA()
      $('[data-acao="ia-chave-salvar"]').focus()
      aviso(n ? `Chave de exemplo guardada (${n}). Nada saiu desta página.` : 'Nenhuma chave escrita: nada foi guardado.')
    },
    'ia-nova': () => { E.ia.conversa = []; E.ia.fixas = []; E.ia.gerado = null; E.ia.gerar = false; renderIA(); $('#ia-texto').focus() },
    'ia-tirar': (b) => { E.ia.fixas = E.ia.fixas.filter((x) => x !== b.dataset.id); atualizarContexto(); const s = $('#ia-por'); if (s) s.focus() },
    'ia-sugestao': (b) => {
      const campo = $('#ia-texto')
      campo.value = b.dataset.texto
      enviarPergunta(campo.value)
    },
    'ia-enviar': () => enviarPergunta($('#ia-texto').value),
    'ia-gerar-abrir': () => { E.ia.gerar = true; E.ia.gerado = null; renderConversa(); $('#gerar-desc').focus() },
    'ia-gerar-cancelar': () => { E.ia.gerar = false; renderConversa(); $('[data-acao="ia-gerar-abrir"]').focus() },
    'ia-descartar': () => { E.ia.gerado = null; renderConversa(); $('[data-acao="ia-gerar-abrir"]').focus() },
    'ia-salvar-npc': () => salvarNpcGerado(),
  }

  function abrirIA() {
    E.iaAberta = true
    atualizarMarcadores()
    renderPagina()
    renderIA()
    $('#ia-texto').focus()
  }

  document.addEventListener('click', (e) => {
    if (e.target.matches('[data-fundo-modal]')) { fecharModal(); return }
    const aba = e.target.closest('[data-aba]')
    if (aba) { trocarAba(aba.dataset.aba); return }
    const b = e.target.closest('[data-acao]')
    if (!b || b.disabled) return
    const f = ACOES[b.dataset.acao]
    if (f) f(b, e)
  })

  document.addEventListener('input', (e) => {
    const c = e.target.closest('[data-campo]')
    if (!c) return
    const k = c.dataset.campo
    if (k === 'forca') aplicarForca(c.dataset.id, Number(c.value), false)
    else if (k === 'corrige' && E.corrigindo) {
      E.corrigindo.rascunho = c.value
      const f = crua(E.corrigindo.fichaId)
      const t = f.tecnicas.find((x) => x.id === E.corrigindo.tec)
      $(`#${c.id}-leitura`).innerHTML = leituraAoVivo(f, t, E.corrigindo.campo, c.value)
    } else if (k === 'cat-busca') {
      E.catBusca = c.value
      $('#cat-resultado').innerHTML = listaDoCatalogo()
    } else if (k === 'nota') guardarNota(c.dataset.id, c.value)
    else if (k === 'ia-texto') {
      c.style.height = 'auto'
      c.style.height = `${Math.min(140, c.scrollHeight + 2)}px`
      atualizarContexto()
    } else if (k === 'gerado-nome' && E.ia.gerado) {
      const t = $('#gerado-nome')
      if (t) t.textContent = c.value.trim() || E.ia.gerado.nome
    }
  })

  document.addEventListener('change', (e) => {
    const c = e.target.closest('[data-campo]')
    if (!c) return
    const k = c.dataset.campo
    if (k === 'jog-liga') {
      const f = crua(c.dataset.id)
      const antes = f.jogador
      const novo = c.value || null
      const outro = novo ? jogadores().find((x) => x.jogador === novo && x.id !== f.id) : null
      f.jogador = novo
      if (outro) outro.jogador = null
      renderPagina()
      const frase = novo ? `“${novo}” agora entra como ${f.nome}.` : `${f.nome} ficou sem jogador.`
      aviso(`${frase}${outro ? ` ${outro.nome} ficou sem jogador.` : ''}`, { desfazer: () => { f.jogador = antes; if (outro) outro.jogador = novo; renderPagina() } })
    } else if (k === 'forca') {
      aplicarForca(c.dataset.id, Number(c.value), false)
    } else if (k === 'cat-destino') {
      E.destino = c.value
      renderPagina()
    } else if (k === 'ia-por' && c.value) {
      if (E.ia.fixas.length < MAX_FICHAS_IA) E.ia.fixas.push(c.value)
      atualizarContexto()
      const s = $('#ia-por')
      if (s) s.focus()
    }
  })
  document.addEventListener('change', (e) => { if (e.target.closest('#form-batalha')) atualizarResumoDaBatalha() })

  document.addEventListener('submit', (e) => {
    const form = e.target
    e.preventDefault()
    if (form.id === 'form-npc') criarNpc(form)
    else if (form.id === 'form-batalha') {
      const entram = $$('input[name="entra"]:checked', form).map((cb) => nomeDe(cb.value).split(' ').slice(-1)[0])
      const extras = $$('input[name="cenario"]:checked', form).map((cb) => (E.cenario.find((c) => c.id === cb.value) || L.CENARIO.find((c) => c.id === cb.value)).nome)
      fecharModal()
      aviso(`Batalha iniciada com ${entram.length + extras.length}: ${[...entram, ...extras].join(', ')}. No app, a ordem dos turnos abre aqui.`)
    } else if (form.id === 'form-gerar') {
      const desc = $('#gerar-desc', form)
      if (!desc.value.trim()) {
        const erro = $('#gerar-erro', form)
        erro.textContent = 'Descreva o NPC em uma frase.'
        erro.style.color = 'var(--mu-erro-texto)'
        desc.setAttribute('aria-invalid', 'true')
        desc.focus()
        return
      }
      const nivel = Number($('#gerar-nivel', form).value)
      const texto = desc.value
      E.ia.gerar = false
      E.ia.pensando = true
      renderConversa()
      setTimeout(() => {
        E.ia.pensando = false
        E.ia.gerado = gerarNpc(texto, nivel)
        renderConversa()
        const n = $('#gerado-nomear')
        if (n) n.focus()
      }, ESPERA_DA_IA_MS)
    }
  })

  /* ---- arrastar do catálogo para a ficha ---- */
  let arrastando = null
  document.addEventListener('dragstart', (e) => {
    const it = e.target.closest && e.target.closest('.item')
    if (!it) return
    arrastando = it.dataset.item
    e.dataTransfer.setData('text/plain', arrastando)
    e.dataTransfer.effectAllowed = 'copy'
    it.classList.add('item--arrastando')
    const secao = L.TIPOS_DO_CATALOGO[catItem(arrastando).tipo].secao
    const destino = $('.destino')
    if (destino) destino.classList.add('destino--ativo')
    for (const s of $$('.destino__secao')) s.dataset.aceita = s.dataset.secao === secao ? 'sim' : 'nao'
  })
  document.addEventListener('dragover', (e) => {
    if (!arrastando) return
    const destino = e.target.closest && e.target.closest('.destino')
    if (!destino) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    const s = $('.destino__secao[data-aceita="sim"]', destino)
    if (s) s.classList.add('e-sobre')
  })
  document.addEventListener('dragleave', (e) => {
    const destino = e.target.closest && e.target.closest('.destino')
    if (destino && !destino.contains(e.relatedTarget)) for (const s of $$('.e-sobre', destino)) s.classList.remove('e-sobre')
  })
  document.addEventListener('drop', (e) => {
    if (!arrastando) return
    const destino = e.target.closest && e.target.closest('.destino')
    if (!destino) return
    e.preventDefault()
    const id = arrastando
    limparArrasto()
    porNaFicha(id, E.destino)
  })
  document.addEventListener('dragend', () => limparArrasto())
  function limparArrasto() {
    arrastando = null
    for (const el of $$('.item--arrastando')) el.classList.remove('item--arrastando')
    for (const el of $$('.destino--ativo')) el.classList.remove('destino--ativo')
    for (const el of $$('.e-sobre')) el.classList.remove('e-sobre')
  }

  /* ---- teclado ---- */
  document.addEventListener('keydown', (e) => {
    const modal = $('#camada-modal .modal-fundo')
    const gaveta = $('#camada-gaveta .gaveta')
    if (modal) {
      if (e.key === 'Escape') { e.preventDefault(); fecharModal() }
      else if (e.key === 'Tab') prenderFoco(modal, e)
      return
    }
    if (gaveta) {
      if (e.key === 'Escape') { e.preventDefault(); fecharGaveta() }
      else if (e.key === 'Tab') prenderFoco(gaveta, e)
      return
    }
    if (e.key === 'F8') {
      const primeiro = $('#avisos button')
      if (primeiro) { e.preventDefault(); primeiro.focus() }
      return
    }
    const alvo = e.target
    const digitando = alvo.matches && alvo.matches('input, textarea, select')
    if (E.tela === 'inicio' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      const portas = $$('.lb-home__door')
      const atual = portas.indexOf(document.activeElement)
      const passo = e.key === 'ArrowDown' ? 1 : -1
      portas[atual === -1 ? 0 : (atual + passo + portas.length) % portas.length].focus()
      e.preventDefault()
      return
    }
    if (E.tela === 'sistemas' && e.key === 'Escape') { irPara('inicio'); return }
    if (E.tela !== 'mundo') return
    if (alvo.closest && alvo.closest('[role="tablist"]')) {
      const abas = $$('.mu-marcador')
      const i = abas.findIndex((a) => a.dataset.aba === E.aba)
      let j = null
      if (e.key === 'ArrowDown') j = (i + 1) % abas.length
      if (e.key === 'ArrowUp') j = (i - 1 + abas.length) % abas.length
      if (e.key === 'Home') j = 0
      if (e.key === 'End') j = abas.length - 1
      if (j !== null) { e.preventDefault(); trocarAba(abas[j].dataset.aba, true) }
      return
    }
    if (alvo.classList && alvo.classList.contains('ia-modo') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      const chaves = Object.keys(MODOS)
      const i = chaves.indexOf(E.ia.modo)
      E.ia.modo = chaves[(i + (e.key === 'ArrowRight' ? 1 : -1) + chaves.length) % chaves.length]
      renderIA()
      $(`.ia-modo[data-valor="${E.ia.modo}"]`).focus()
      e.preventDefault()
      return
    }
    if (alvo.id === 'ia-texto' && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviarPergunta(alvo.value)
      return
    }
    if (alvo.dataset && alvo.dataset.campo === 'corrige') {
      if (e.key === 'Enter') { e.preventDefault(); salvarCorrecao(false) }
      if (e.key === 'Escape') { e.preventDefault(); E.corrigindo = null; renderPagina() }
      return
    }
    if (!digitando && e.key === '/' && E.aba === 'itens') {
      e.preventDefault()
      $('#cat-busca').focus()
    }
  })

  window.addEventListener('resize', () => moverFita(true))

  function aplicarMovimento() {
    document.documentElement.dataset.movimento = E.movimento
    const b = $('#pt-movimento')
    b.setAttribute('aria-pressed', String(E.movimento === 'reduzido'))
  }

  /* ---- começo ---- */
  aplicarMovimento()
  desenharLabirinto()
  $('#home-titulo').focus()
})()
