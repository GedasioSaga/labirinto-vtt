/* Protótipo navegável da Proposta 2, Grimório. Sem biblioteca externa. */
(function () {
  'use strict';

  const { MAPA, BARRA, TECLAS, FERRAMENTAS, TIPOS, CENA, AVENTURA, ACERVO, SALA, JOGADOR, JOGADORES } = window.GR;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const reduzido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ROT_PAG = { ficha: 'Ficha', cena: 'Cena', aventura: 'Aventura', acervo: 'Acervo', grupo: 'Grupo', chat: 'Chat', cenas: 'Cenas', mesa: 'Mesa' };
  const LARGURA_MINIMA_EDITOR = 1360;

  const E = {
    tela: 'editor', ferr: 'selecionar', sel: null, sub: null,
    pagEsq: 'ficha', pagDir: 'grupo', esqRecolhido: false, dirRecolhido: false,
    sala: false, brilhar: false, laser: false, mudo: false, npcsPausados: false, congelados: false,
    abertas: { 'pino:caixas/rec-cenario': true }, recNovo: null, gruposAbertos: {}, camadasOff: new Set(), apagados: [],
    novoToken: false, acervoAba: 'tokens', pastas: { NPCs: true },
    jogadorAberto: null, jogTab: 'acoes', soPedindo: false, pedidoFeito: false,
    chegando: SALA.chegando.slice(), jogadores: SALA.jogadores.map((j) => Object.assign({}, j)),
    msgs: SALA.chat.slice(), cenasPausadas: {}, cenasCongeladas: {},
    agenda: { dia: 2, apito: 3 }, avisouFerr: {}, ultimaCena: 'Armazém 3',
    jogAba: 'jogo', jogAcao: null, folhaAberta: true, voltoJa: false, rolagens: [], jogMsgs: SALA.chat.slice(0, 2),
  };
  const VAL = {};

  /* ---------------- valores */
  function semear(sc, campos) {
    const o = VAL[sc] || (VAL[sc] = {});
    (function anda(cs) {
      cs.forEach((c) => {
        if (c.campos) anda(c.campos);
        if (c.k && !(c.k in o) && c.v !== undefined) o[c.k] = Array.isArray(c.v) ? c.v.slice() : c.v;
      });
    })(campos);
    return o;
  }
  const leitor = (sc) => (k) => (VAL[sc] || {})[k];
  function todosCampos(def) {
    let cs = [];
    if (def.cabecaSeg) cs.push(def.cabecaSeg);
    if (def.essencial) cs = cs.concat(def.essencial);
    if (def.recursos) { cs.push({ k: 'recursos', v: def.recursos.v }); def.recursos.itens.forEach((i) => { cs = cs.concat(i.campos); }); }
    def.fichas.forEach((f) => { cs = cs.concat(f.campos); });
    if (def.cartoes) def.cartoes.itens.forEach((i) => { cs = cs.concat(i.campos); });
    return cs;
  }

  /* ---------------- campos */
  let uid = 0;
  function campo(c, sc, rotPadrao) {
    const g = leitor(sc);
    if (c.se && !c.se(g)) return '';
    const v = g(c.k);
    const id = 'c' + (++uid);
    const d = 'data-sc="' + sc + '" data-k="' + (c.k || '') + '"' + (c.r ? ' data-r="1"' : '');
    const rot = c.rot ? '<span class="campo__rot" id="' + id + '">' + esc(c.rot) + '</span>' : '';
    const nomeGrupo = c.rot ? 'aria-labelledby="' + id + '"' : 'aria-label="' + esc(rotPadrao || 'Opções') + '"';
    switch (c.t) {
      case 'seg': {
        /* o[4]: opção só com ícone (o rótulo vira nome acessível e balão) */
        const ops = c.ops.map((o) => '<button type="button" class="seg__op' + (o[4] ? ' seg__op--ic' : '') + '" role="radio" tabindex="' + (String(o[0]) === String(v) ? 0 : -1) + '" aria-checked="' + (String(o[0]) === String(v)) + '" data-v="' + esc(o[0]) + '" ' + d + ' data-tipo="seg"' + (o[3] ? ' title="' + esc(o[1]) + ' (' + o[3] + ')"' : '') + (o[4] ? ' aria-label="' + esc(o[1]) + '" data-balao="' + esc(o[1]) + '"' : '') + '>' + (o[2] ? ic(o[2]) : '') + (o[4] ? '' : '<span>' + esc(o[1]) + '</span>') + (c.grade && o[3] ? '<kbd>' + o[3] + '</kbd>' : '') + '</button>').join('');
        return '<div class="campo">' + rot + '<div class="seg' + (c.grade ? ' seg--grade' : '') + '" role="radiogroup" ' + nomeGrupo + '>' + ops + '</div></div>';
      }
      case 'liga':
        return '<button type="button" class="liga" role="switch" aria-checked="' + !!v + '" ' + d + ' data-tipo="liga"><span class="liga__rot">' + esc(c.rot) + '</span>' + (c.ajuda ? '<span class="liga__ajuda">' + esc(c.ajuda) + '</span>' : '') + '<span class="liga__trilho" aria-hidden="true"></span></button>';
      case 'chips':
        return '<div class="campo">' + rot + '<div class="chips" role="group" ' + nomeGrupo + '>' + c.ops.map((o) => '<button type="button" class="chip" aria-pressed="' + (v || []).includes(o) + '" data-v="' + esc(o) + '" ' + d + ' data-tipo="multi">' + esc(o) + '</button>').join('') + '</div></div>';
      case 'icones':
        return '<div class="campo">' + rot + '<div class="icones" role="group" ' + nomeGrupo + '>' + c.ops.map((o) => '<button type="button" class="icone-tg" aria-pressed="' + (v || []).includes(o[0]) + '" data-v="' + esc(o[0]) + '" ' + d + ' data-tipo="multi">' + ic(o[2]) + '<span>' + esc(o[1]) + '</span></button>').join('') + '</div></div>';
      case 'faixa':
        return '<div class="campo"><label class="campo__rot" for="' + id + '">' + esc(c.rot) + '<output id="' + id + 'o">' + v + (c.un ? ' ' + c.un : '') + '</output></label><input class="faixa" type="range" id="' + id + '" min="' + c.min + '" max="' + c.max + '" value="' + v + '" ' + d + ' data-tipo="faixa" data-un="' + (c.un || '') + '"></div>';
      case 'num':
        return '<div class="campo"><span class="campo__rot" id="' + id + '">' + esc(c.rot) + (c.un ? '<b>' + esc(c.un) + '</b>' : '') + '</span><div class="num" role="group" aria-labelledby="' + id + '"><button type="button" aria-label="Diminuir" data-passo="-1" data-min="' + (c.min == null ? 0 : c.min) + '" data-max="' + (c.max == null ? 999 : c.max) + '" ' + d + ' data-tipo="num">−</button><output aria-live="polite">' + v + '</output><button type="button" aria-label="Aumentar" data-passo="1" data-min="' + (c.min == null ? 0 : c.min) + '" data-max="' + (c.max == null ? 999 : c.max) + '" ' + d + ' data-tipo="num">+</button></div></div>';
      case 'texto':
        return '<div class="campo"><label class="campo__rot" for="' + id + '">' + esc(c.rot) + '</label><input class="entrada" id="' + id + '" type="text" autocomplete="off" value="' + esc(v) + '" placeholder="' + esc(c.ph || '') + '" ' + d + ' data-tipo="texto"></div>';
      case 'area':
        return '<div class="campo"><label class="campo__rot" for="' + id + '">' + esc(c.rot) + '</label><textarea class="entrada" id="' + id + '" rows="3" placeholder="' + esc(c.ph || '') + '" ' + d + ' data-tipo="texto">' + esc(v) + '</textarea></div>';
      case 'cor':
        return '<div class="campo">' + rot + '<div class="cores" role="radiogroup" ' + nomeGrupo + '>' + c.ops.map((h) => '<button type="button" class="cor" role="radio" tabindex="' + (h === v ? 0 : -1) + '" aria-checked="' + (h === v) + '" aria-label="Cor ' + h + '" style="background:' + h + '" data-v="' + h + '" ' + d + ' data-tipo="seg"></button>').join('') + (c.padrao ? '<button type="button" class="bt bt--fantasma bt--p" data-acao="cor-padrao" ' + d + ' data-v="' + c.ops[0] + '">Cor padrão</button>' : '') + '</div></div>';
      case 'tinta':
        return '<div class="campo">' + rot + '<div class="tintas" role="radiogroup" ' + nomeGrupo + '>' + c.ops.map((o) => '<button type="button" class="tinta" role="radio" tabindex="' + (o[0] === v ? 0 : -1) + '" aria-checked="' + (o[0] === v) + '" data-v="' + o[0] + '" ' + d + ' data-tipo="seg"><i style="background:' + o[2] + '"></i>' + esc(o[1]) + '</button>').join('') + '</div></div>';
      case 'sel':
        return '<div class="campo"><label class="campo__rot" for="' + id + '">' + esc(c.rot) + '</label><select class="entrada" id="' + id + '" ' + d + ' data-tipo="sel">' + c.ops.map((o) => '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select></div>';
      case 'acoes':
        return '<div class="campo">' + (c.rot ? '<span class="campo__rot">' + esc(c.rot) + '</span>' : '') + '<div class="acoes' + (c.col ? ' acoes--col' : '') + '">' + c.bts.map((b) => '<button type="button" class="bt bt--p' + (b[2] ? ' bt--' + b[2] : '') + '" data-acao="aviso" data-msg="' + esc(b[3] || b[0]) + '">' + (b[1] ? ic(b[1], 'ic--p') : '') + esc(b[0]) + '</button>').join('') + '</div></div>';
      case 'nota':
        return '<p class="nota">' + esc(c.txt) + (c.ir ? ' <button type="button" class="link" data-acao="' + (c.ir === 'config' ? 'config' : 'ir-esq') + '" data-pag="' + c.ir + '">' + (c.ir === 'config' ? 'Abrir configurações' : 'Ir para ' + ROT_PAG[c.ir]) + '</button>' : '') + '</p>';
      case 'vida': {
        const max = g(c.max) || 1;
        const pct = Math.max(0, Math.min(1, v / max));
        return '<div class="campo"><span class="campo__rot">Vida atual<b class="vida__num" data-vida="' + sc + '">' + v + ' / ' + max + '</b></span><div class="vida"><button type="button" class="bt bt--ic bt--p" aria-label="Tirar 1 de vida" data-tipo="vida" data-passo="-1" ' + d + '>−</button><div class="vida__barra" role="meter" aria-label="Vida" aria-valuemin="0" aria-valuemax="' + max + '" aria-valuenow="' + v + '"><i style="transform:scaleX(' + pct + ')"></i></div><button type="button" class="bt bt--ic bt--p" aria-label="Somar 1 de vida" data-tipo="vida" data-passo="1" ' + d + '>+</button></div></div>';
      }
      case 'lista':
        return '<div class="lista">' + c.itens.map((i) => '<div class="item"><span class="item__txt"><span class="item__nome">' + esc(i[0]) + '</span></span><span class="item__fim">' + esc(i[1]) + '</span><button type="button" class="bt bt--ic bt--p" aria-label="Tirar ' + esc(i[0]) + '" data-acao="aviso" data-msg="' + esc(i[0]) + ' saiu da loja.">' + ic('x', 'ic--p') + '</button></div>').join('') + '<button type="button" class="bt bt--fantasma bt--p" data-acao="aviso" data-msg="No app, abre o campo de nova mercadoria: nome e preço.">' + esc(c.mais) + '</button></div>';
      case 'grupo': {
        const chave = sc + '/' + c.rot;
        return '<details class="subgrupo" data-grupo="' + esc(chave) + '"' + (E.gruposAbertos[chave] ? ' open' : '') + '><summary>' + ic('dir') + esc(c.rot) + '</summary><div class="subgrupo__dentro">' + c.campos.map((x) => campo(x, sc)).join('') + '</div></details>';
      }
      case 'extras': {
        const ativos = v || [];
        const campos = ativos.map((x, i) => '<div class="campo"><label class="campo__rot" for="' + id + 'x' + i + '">' + esc(x) + '</label><input class="entrada" id="' + id + 'x' + i + '" type="text" placeholder="' + esc(x === 'Nota do mestre' ? 'Só você lê' : 'Preencha ou deixe em branco') + '"></div>').join('');
        const resto = c.ops.filter((o) => !ativos.includes(o));
        return campos + (resto.length ? '<div class="chips">' + resto.map((o) => '<button type="button" class="chip chip--mais" data-tipo="extra" data-v="' + esc(o) + '" ' + d + '>+ ' + esc(o) + '</button>').join('') + '</div>' : '');
      }
      case 'html':
        return typeof c.html === 'function' ? c.html() : c.html;
      case 'cena':
        return '<div class="campo">' + window.GR_CENA.html(Object.assign(dadosCena(sc), { sc: sc })) + '</div>';
      default:
        return '';
    }
  }

  function fichaHTML(f, sc, nova) {
    const g = leitor(sc);
    if (f.se && !f.se(g)) return '';
    const chave = sc + '/' + f.id;
    const aberta = chave in E.abertas ? E.abertas[chave] : !!f.aberta;
    const resumo = f.resumo ? f.resumo(g) : '';
    return '<section class="ficha' + (aberta ? ' e-aberta' : '') + (nova ? ' e-nova' : '') + '" data-ficha="' + esc(chave) + '">' +
      '<button type="button" class="ficha__cab" aria-expanded="' + aberta + '" data-acao="ficha"><span class="ficha__med">' + ic(f.ic) + '</span><span class="ficha__tit">' + esc(f.rot) + '</span>' +
      (resumo ? '<span class="ficha__resumo">' + esc(resumo) + '</span>' : '') + '<span class="ficha__seta">' + ic('dir') + '</span></button>' +
      '<div class="ficha__corpo"' + (aberta ? '' : ' inert') + '><div class="ficha__miolo"><div class="ficha__dentro">' + f.campos.map((c) => campo(c, sc, f.rot)).join('') + '</div></div></div></section>';
  }

  /* ---------------- objetos do mapa */
  function objeto(tipo, id) {
    const lista = { token: MAPA.tokens, porta: MAPA.portas, pino: MAPA.pinos, sala: MAPA.salas }[tipo];
    return lista ? lista.find((o) => o.id === id) : null;
  }
  const iniciais = (n) => String(n || '?').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  function nomeDoSelecionado() {
    if (!E.sel) return '';
    const o = objeto(E.sel.tipo, E.sel.id);
    const g = leitor(E.sel.tipo + ':' + E.sel.id);
    return g('nome') || (o && o.nome) || '';
  }

  /* ---------------- ferramenta */
  const itemBarra = (id) => BARRA.flatMap((g) => g.itens).find((i) => i.id === id);
  function campoVariante(id) { return (FERRAMENTAS[id].campos || []).find((c) => c.var); }
  function iconeFerr(id) {
    const base = itemBarra(id).ic;
    const cv = campoVariante(id);
    if (!cv || id === 'pino') return base;
    semear('fer:' + id, FERRAMENTAS[id].campos);
    const atual = cv.ops.find((o) => o[0] === leitor('fer:' + id)(cv.k));
    return atual && atual[2] ? atual[2] : base;
  }
  function atalhoAtual(id) {
    const cv = campoVariante(id);
    if (cv) {
      const atual = cv.ops.find((o) => o[0] === leitor('fer:' + id)(cv.k));
      if (atual && atual[3]) return atual[3];
    }
    return itemBarra(id).at || '';
  }

  /* ================================================================ LIVRO DA ESQUERDA */
  function pagFicha() {
    if (E.sel) return E.sub ? pagSubFicha() : pagFichaSel();
    if (E.novoToken) return novoTokenHTML() + pagFichaFerr();
    return pagFichaFerr();
  }

  function novoTokenHTML() {
    return '<form class="ficha ficha--plana" data-form="novo-token" style="margin-bottom:12px"><div class="ficha__dentro"><div class="campo"><label class="campo__rot" for="novo-nome">Nome do novo token</label><input class="entrada" id="novo-nome" autocomplete="off" placeholder="ex.: Capitã Iara"></div><div class="acoes"><button class="bt bt--primario bt--p" type="submit">Adicionar</button><button class="bt bt--fantasma bt--p" type="button" data-acao="cancelar-token">Cancelar</button></div></div></form>';
  }

  function pagFichaFerr() {
    const id = E.ferr;
    if (id === 'selecionar') return vazioSelecionar();
    const def = FERRAMENTAS[id];
    const sc = 'fer:' + id;
    semear(sc, def.campos);
    const it = itemBarra(id);
    return '<div class="cabeca"><span class="cabeca__med">' + ic(iconeFerr(id)) + '</span><div><div class="cabeca__nome">' + esc(it.rot) + '</div><div class="cabeca__tipo">' + esc(def.dica) + '</div></div>' + (atalhoAtual(id) ? '<kbd title="Atalho">' + atalhoAtual(id) + '</kbd>' : '<span></span>') + '</div>' +
      '<div class="ficha ficha--plana"><div class="ficha__dentro">' + def.campos.map((c) => campo(c, sc, it.rot)).join('') + '</div></div>';
  }

  function vazioSelecionar() {
    const exemplos = [['token', 'saga', 'Saga', 'Token de NPC', 'token'], ['porta', 'p2', 'Porta do armazém', 'Porta trancada', 'porta'], ['pino', 'caixas', 'Caixas suspeitas', 'Pino de exclamação', 'pino'], ['sala', 'cais', 'Cais do Porto', 'Sala', 'sala']];
    return '<div class="vazio"><p class="vazio__tit">Nada selecionado</p><p>Clique numa ficha, porta, pino ou sala do mapa e as propriedades dela aparecem aqui.</p>' +
      '<div class="atalhos-mini"><kbd>Ctrl K</kbd><span>Procurar no mapa</span><kbd>Esc</kbd><span>Limpar a seleção</span><kbd>Del</kbd><span>Apagar o selecionado</span></div></div>' +
      '<h3 class="titulo-secao">Neste mapa<small>para experimentar</small></h3><div class="lista entra-lista">' +
      exemplos.map((x, i) => '<button type="button" class="item" style="--i:' + i + '" data-acao="selecionar" data-tipo="' + x[0] + '" data-id="' + x[1] + '"><span class="item__ic">' + ic(x[4]) + '</span><span class="item__txt"><span class="item__nome">' + x[2] + '</span><span class="item__sub">' + x[3] + '</span></span>' + ic('dir', 'ic--p') + '</button>').join('') + '</div>';
  }

  function cabecalhoSel(def, sc, o) {
    const g = leitor(sc);
    const tipo = E.sel.tipo;
    const titulo = typeof def.rot === 'function' ? def.rot(g) : def.rot;
    const nome = tipo === 'porta' ? o.nome : (g('nome') || o.nome);
    const marca = tipo === 'token'
      ? '<span class="cabeca__retrato" style="background:' + g('cor') + '">' + esc(iniciais(nome)) + '</span>'
      : tipo === 'porta' ? medalhaPorta(o.id)
      : '<span class="cabeca__med">' + ic(tipo === 'pino' ? ({ '!': 'exclamacao', '?': 'interrogacao', viagem: 'viagem', alavanca: 'alavanca' })[g('tipo')] : def.ic) + '</span>';
    return '<div class="cabeca">' + marca + '<div><div class="cabeca__nome" data-nome-sel>' + esc(nome) + '</div><div class="cabeca__tipo">' + esc(titulo) + (def.sub ? ' · ' + esc(def.sub) : '') + '</div></div>' +
      '<div class="cabeca__acoes"><button type="button" class="bt bt--ic" aria-label="' + esc(def.apagar) + ' (Delete)" data-balao="' + esc(def.apagar) + '" data-at="Del" data-acao="apagar">' + ic('lixo') + '</button>' +
      '<button type="button" class="bt bt--ic" aria-label="Mais ações" aria-haspopup="menu" data-balao="Mais ações" data-acao="mais-acoes">' + ic('reticencias') + '</button></div></div>';
  }

  function pagFichaSel() {
    const tipo = E.sel.tipo;
    const o = objeto(tipo, E.sel.id);
    if (!o) { E.sel = null; return pagFichaFerr(); }
    const def = TIPOS[tipo](o);
    const sc = tipo + ':' + o.id;
    semear(sc, todosCampos(def));
    const g = leitor(sc);
    let h = cabecalhoSel(def, sc, o);
    if (def.cabecaSeg) h += '<div style="margin:-2px 0 12px">' + campo(def.cabecaSeg, sc, 'Tipo de ficha') + '</div>';
    if (tipo === 'token' && E.sala) h += '<div class="visto-por">' + ic('olho') + '<span>Visto por Vagn e Nami</span></div>';
    if (def.essencial) h += '<div class="ficha ficha--plana essencial"><div class="ficha__dentro">' + def.essencial.map((c) => campo(c, sc, titulo(def, g))).join('') + '</div></div>';
    if (def.recursos && (!def.recursos.se || def.recursos.se(g))) h += recursosHTML(def, sc);
    h += '<div class="fichas">' + def.fichas.map((f) => fichaHTML(f, sc)).join('') + '</div>';
    if (def.cartoes && (!def.cartoes.se || def.cartoes.se(g))) {
      h += '<h3 class="titulo-secao">' + esc(def.cartoes.rot) + '<small>abre em ficha própria</small></h3><div class="cartoes entra-lista">' +
        def.cartoes.itens.map((it, i) => {
          const ligado = it.ligado ? it.ligado(g) : false;
          if (it.desligado) return '<button type="button" class="cartao" style="--i:' + i + '" disabled aria-describedby="d-' + it.id + '">' + ic(it.ic, 'ic--g') + '<span class="cartao__rot">' + esc(it.rot) + '</span><span class="cartao__resumo" id="d-' + it.id + '">' + esc(it.desligado) + '</span></button>';
          return '<button type="button" class="cartao' + (ligado ? ' e-ligado' : '') + '" style="--i:' + i + '" data-acao="sub" data-sub="' + it.id + '">' + ic(it.ic, 'ic--g') + '<span class="cartao__rot">' + esc(it.rot) + '</span><span class="cartao__resumo">' + esc(it.resumo(g)) + '</span></button>';
        }).join('') + '</div>';
    }
    return h;
  }

  const titulo = (def, g) => (typeof def.rot === 'function' ? def.rot(g) : def.rot);

  /* recursos do pino (Mesa limpa): os ligados viram fichas na ordem em que
     entraram; o resto fica atrás de "+ Adicionar ao pino" */
  function recursosHTML(def, sc) {
    const ligados = leitor(sc)('recursos') || [];
    const itens = def.recursos.itens;
    const pe = (it) => ({ t: 'html', html: '<div class="rec__pe"><button type="button" class="bt bt--fantasma bt--p" data-acao="rec-tirar" data-rec="' + it.id + '">' + ic('x', 'ic--p') + 'Tirar do pino</button></div>' });
    const fichas = ligados.map((id) => itens.find((i) => i.id === id)).filter(Boolean)
      .map((it) => fichaHTML({ id: 'rec-' + it.id, rot: it.rot, ic: it.ic, resumo: it.resumo, campos: it.campos.concat(pe(it)) }, sc, E.recNovo === it.id)).join('');
    const sobra = itens.some((i) => ligados.indexOf(i.id) < 0);
    return '<div class="fichas recursos">' + fichas + '</div>' +
      (sobra ? '<button type="button" class="bt bt--p rec-mais" aria-haspopup="menu" aria-expanded="false" data-acao="rec-menu">' + ic('mais', 'ic--p') + 'Adicionar ao pino</button>' : '');
  }

  /* o que a prévia do cenário mostra: tudo vem da ficha do pino, ao vivo */
  function dadosCena(sc) {
    const g = leitor(sc);
    return { nome: g('nome') || '', desc: g('desc') || '', camera: g('camera') || 'pan', efeitos: g('efeitos') || [] };
  }

  /* ---------------- porta: a folha gira na dobradiça (mapa, ficha e tela do jogador) */
  const ANG_ABERTA = -70;
  const anguloPorta = (id) => (leitor('porta:' + id)('aberta') === 'aberta' ? ANG_ABERTA : 0);
  const trancadaPorta = (p) => { const t = leitor('porta:' + p.id)('trancada'); return t !== undefined ? t : !!p.trancada; };
  function medalhaPorta(id) {
    const p = objeto('porta', id);
    return '<span class="cabeca__med cabeca__med--porta"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.5 16h5 M16.5 16h5"/><rect class="porta-folha' + (trancadaPorta(p) ? ' trancada' : '') + '" data-porta-folha="' + id + '" x="7.5" y="15" width="9" height="2" rx="0.6" style="transform-origin:0 50%;transform:rotate(' + anguloPorta(id) + 'deg)"/></svg></span>';
  }
  /* fechada, a folha fica no vão; aberta, gira 70° para dentro do cômodo (como na Mesa limpa) */
  function portaSVG(p, jogador) {
    const esp = 4;
    const ang = anguloPorta(p.id);
    const vao = '<rect x="' + (p.vertical ? p.x - 2 : p.x) + '" y="' + (p.vertical ? p.y : p.y - 2) + '" width="' + (p.vertical ? 4 : p.comp) + '" height="' + (p.vertical ? p.comp : 4) + '" fill="' + (jogador ? '#2b343b' : '#333d45') + '"/>';
    const folha = '<rect class="porta-folha' + (jogador ? ' jog-mapa-porta' : '') + (trancadaPorta(p) && !jogador ? ' trancada' : '') + '" data-porta-folha="' + p.id + '" x="' + (p.vertical ? p.x - esp / 2 : p.x) + '" y="' + (p.vertical ? p.y : p.y - esp / 2) + '" width="' + (p.vertical ? esp : p.comp) + '" height="' + (p.vertical ? p.comp : esp) + '" rx="1" style="transform-origin:' + (p.vertical ? '50% 0' : '0 50%') + ';transform:rotate(' + ang + 'deg)"/>';
    if (jogador) return vao + folha;
    const x = p.vertical ? p.x - 3.5 : p.x;
    const y = p.vertical ? p.y : p.y - 3.5;
    return '<g class="alvo" data-tipo="porta" data-id="' + p.id + '"><rect x="' + (x - 8) + '" y="' + (y - 8) + '" width="' + ((p.vertical ? 7 : p.comp) + 16) + '" height="' + ((p.vertical ? p.comp : 7) + 16) + '" fill="transparent"/>' + vao + folha + '</g>';
  }
  /* muda a folha onde ela já está desenhada: a transição de CSS gira e pode ser
     interrompida no meio (clicar de novo inverte dali mesmo, sem salto) */
  function atualizarPorta(id, k) {
    const p = objeto('porta', id);
    const aberta = anguloPorta(id) !== 0;
    const anima = leitor('porta:' + id)('anim') !== false;
    $$('[data-porta-folha="' + id + '"]').forEach((f) => {
      f.classList.toggle('trancada', trancadaPorta(p) && !f.classList.contains('jog-mapa-porta'));
      if (k !== 'aberta') return;
      f.style.transitionDuration = anima && !reduzido() ? (aberta ? '300ms' : '260ms') : '0ms';
      f.style.transform = 'rotate(' + anguloPorta(id) + 'deg)';
      if (anima && reduzido()) f.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
    });
  }
  function alternarPorta(id, valor) {
    const sc = 'porta:' + id;
    VAL[sc] = VAL[sc] || {};
    VAL[sc].aberta = valor || (leitor(sc)('aberta') === 'aberta' ? 'fechada' : 'aberta');
    atualizarPorta(id, 'aberta');
    $$('#esq-corpo [data-sc="' + sc + '"][data-k="aberta"]').forEach((b) => { const s = b.dataset.v === VAL[sc].aberta; b.setAttribute('aria-checked', String(s)); b.tabIndex = s ? 0 : -1; });
    return VAL[sc].aberta;
  }

  function pagSubFicha() {
    const o = objeto(E.sel.tipo, E.sel.id);
    const def = TIPOS[E.sel.tipo](o);
    const sc = E.sel.tipo + ':' + o.id;
    const it = def.cartoes.itens.find((i) => i.id === E.sub);
    return '<button type="button" class="voltar-sub" data-acao="voltar-sub">' + ic('esq', 'ic--p') + esc(nomeDoSelecionado()) + '</button>' +
      '<div class="cabeca"><span class="cabeca__med">' + ic(it.ic) + '</span><div><div class="cabeca__nome">' + esc(it.rot) + '</div><div class="cabeca__tipo">' + esc(def.cartoes.rot) + ' de ' + esc(nomeDoSelecionado()) + '</div></div><span></span></div>' +
      '<div class="ficha ficha--plana"><div class="ficha__dentro">' + it.campos.map((c) => campo(c, sc, it.rot)).join('') + '</div></div>';
  }

  function pagCena() {
    semear('cena', CENA.chao);
    const locais = '<p class="nota" style="margin-bottom:6px">Clique num local para enquadrá-lo.</p><div class="lista">' + MAPA.salas.map((s) => '<button type="button" class="item" data-acao="enquadrar" data-id="' + s.id + '"><span class="item__ic">' + ic('sala') + '</span><span class="item__txt"><span class="item__nome">' + esc(s.nome) + '</span></span>' + ic('mira', 'ic--p') + '</button>').join('') + '</div>';
    const camadas = '<div class="lista">' + CENA.camadas.map((c) => {
      const off = E.camadasOff.has(c);
      return '<button type="button" class="item" aria-pressed="' + !off + '" data-acao="camada" data-camada="' + c + '"><span class="item__txt"><span class="item__nome" style="' + (off ? 'color:var(--lb-color-parchment-faint)' : '') + '">' + c + '</span></span><span class="item__ic">' + ic(off ? 'olhoFechado' : 'olho') + '</span></button>';
    }).join('') + '</div>';
    const camChao = '<div class="lista">' + CENA.camadasChao.map((c) => '<div class="item"><span class="bola" style="background:' + c[1] + ';width:18px;height:18px;border-radius:4px"></span><span class="item__txt"><span class="item__nome">' + c[0] + '</span></span><button type="button" class="bt bt--ic bt--p" aria-label="Travar ' + c[0] + '" data-acao="aviso" data-msg="' + c[0] + ' travada.">' + ic('cadeado', 'ic--p') + '</button><button type="button" class="bt bt--ic bt--p" aria-label="Ocultar ' + c[0] + '" data-acao="aviso" data-msg="' + c[0] + ' oculta.">' + ic('olho', 'ic--p') + '</button></div>').join('') + '<button type="button" class="bt bt--fantasma bt--p" data-acao="aviso" data-msg="Nova camada do chão criada.">+ Nova camada</button></div>';
    const territorio = '<div class="lista">' + CENA.faccoes.map((f) => '<div class="item"><span class="bola" style="background:' + f[1] + ';width:18px;height:18px"></span><span class="item__txt"><span class="item__nome">' + f[0] + '</span></span></div>').join('') + '</div>';
    const marcas = '<div class="lista">' + CENA.marcas.map((m) => '<div class="item"><span class="item__ic">' + ic('marcador') + '</span><span class="item__txt"><span class="item__nome">' + esc(m[1]) + '</span><span class="item__sub">' + m[0] + '</span></span><button type="button" class="bt bt--ic bt--p" aria-label="Apagar marca de ' + m[0] + '" data-acao="aviso" data-msg="Marca de ' + m[0] + ' apagada.">' + ic('lixo', 'ic--p') + '</button></div>').join('') + '</div>';
    semear('cena', [{ k: 'alerta', v: 'calmo' }, { k: 'pintarFac', v: false }]);
    return '<h2 class="titulo-pagina">Esta cena</h2><p class="sub-pagina">Porto de Tasmaturi, 60 × 40 casas de 70 px</p>' +
      '<div class="busca">' + ic('busca') + '<input class="entrada" id="busca-mapa" type="search" autocomplete="off" placeholder="Procurar no mapa" aria-label="Procurar no mapa" data-busca="mapa"><kbd>Ctrl K</kbd></div>' +
      '<div id="resultados" class="lista" aria-live="polite" style="margin:6px 0 4px"></div>' +
      '<div class="fichas" style="margin-top:8px">' +
      fichaHTML({ id: 'locais', rot: 'Locais', ic: 'sala', aberta: true, resumo: () => MAPA.salas.length + ' locais', campos: [{ t: 'html', html: locais }] }, 'cena') +
      fichaHTML({ id: 'chao', rot: 'Chão do mapa', ic: 'chao', aberta: false, resumo: () => 'Chapado', campos: CENA.chao }, 'cena') +
      fichaHTML({ id: 'camadas', rot: 'Camadas', ic: 'cenas', aberta: false, resumo: () => (CENA.camadas.length - E.camadasOff.size) + ' de ' + CENA.camadas.length + ' visíveis', campos: [{ t: 'html', html: camadas }] }, 'cena') +
      fichaHTML({ id: 'camchao', rot: 'Camadas do chão', ic: 'chao', aberta: false, resumo: () => CENA.camadasChao.length + ' peças', campos: [{ t: 'html', html: camChao }] }, 'cena') +
      fichaHTML({ id: 'territorio', rot: 'Território', ic: 'bandeira', aberta: false, resumo: () => 'Só você vê', campos: [{ t: 'html', html: territorio }, { t: 'liga', k: 'pintarFac', rot: 'Pintar salas pela cor da facção', ajuda: 'Só no editor.' }, { t: 'seg', k: 'alerta', rot: 'Alerta da cena', ops: [['calmo', 'Calmo'], ['atento', 'Atento'], ['alarme', 'Alarme']] }, { t: 'nota', txt: 'O jogador não vê o alerta.' }] }, 'cena') +
      fichaHTML({ id: 'marcas', rot: 'Marcas dos jogadores', ic: 'marcador', aberta: false, resumo: () => CENA.marcas.length + ' bilhetes', campos: [{ t: 'html', html: marcas }] }, 'cena') +
      '</div>';
  }

  function resultadosBusca(q) {
    q = q.trim().toLowerCase();
    if (!q) return '';
    const daqui = [].concat(
      MAPA.tokens.map((o) => ['token', o.id, leitor('token:' + o.id)('nome') || o.nome, 'Token', 'token']),
      MAPA.pinos.map((o) => ['pino', o.id, o.nome, 'Pino', 'pino']),
      MAPA.portas.map((o) => ['porta', o.id, o.nome, 'Porta', 'porta']),
      MAPA.salas.map((o) => ['sala', o.id, o.nome, 'Sala', 'sala'])
    ).filter((x) => x[2].toLowerCase().includes(q));
    const fora = AVENTURA.pinos.filter((p) => p.cena !== MAPA.cena && p.nome.toLowerCase().includes(q));
    if (!daqui.length && !fora.length) return '<p class="nota">Nada com "' + esc(q) + '" nesta aventura.</p>';
    return daqui.map((x, i) => '<button type="button" class="item" style="--i:' + i + '" data-acao="selecionar" data-tipo="' + x[0] + '" data-id="' + x[1] + '"><span class="item__ic">' + ic(x[4]) + '</span><span class="item__txt"><span class="item__nome">' + esc(x[2]) + '</span><span class="item__sub">' + x[3] + '</span></span><kbd>Enter</kbd></button>').join('') +
      (fora.length ? '<p class="nota" style="margin:6px 6px 2px">Em outras cenas</p>' + fora.map((p, i) => '<button type="button" class="item" style="--i:' + (daqui.length + i) + '" data-acao="aviso" data-msg="No app, abre ' + esc(p.cena) + ' com o pino selecionado."><span class="item__ic">' + ic('pino') + '</span><span class="item__txt"><span class="item__nome">' + esc(p.nome) + '</span><span class="item__sub">' + esc(p.cena) + '</span></span></button>').join('') : '') +
      (E.sala ? '<p class="nota" style="margin:6px">Shift+Enter manda a ficha para cá.</p>' : '');
  }

  function pagAventura() {
    semear('aventura', [{ k: 'filtroCena', v: 'Todas as cenas' }]);
    AVENTURA.estados.forEach((s) => semear('aventura', [{ k: s[0], v: s[3] }]));
    const filtro = leitor('aventura')('filtroCena');
    const pinos = AVENTURA.pinos.filter((p) => filtro === 'Todas as cenas' || p.cena === filtro);
    const icPino = { '!': 'exclamacao', '?': 'interrogacao', viagem: 'viagem', alavanca: 'alavanca' };
    const listaPinos = '<div class="busca">' + ic('busca') + '<input class="entrada" type="search" placeholder="Nome ou descrição" aria-label="Procurar pino" data-busca="pinos"></div>' +
      campo({ t: 'sel', k: 'filtroCena', rot: 'Cena', ops: ['Todas as cenas', 'Porto de Tasmaturi', 'Praça da Cidade Alta', 'Torre do sino', 'Galeria norte'], r: 1 }, 'aventura') +
      '<div class="lista" data-lista-pinos>' + pinos.map((p) => '<button type="button" class="item" data-nome="' + esc(p.nome.toLowerCase()) + '" ' + (p.cena === MAPA.cena ? 'data-acao="selecionar" data-tipo="pino" data-id="' + p.id + '"' : 'data-acao="aviso" data-msg="No app, abre ' + esc(p.cena) + ' com o pino selecionado."') + '><span class="item__ic">' + ic(icPino[p.tipo]) + '</span><span class="item__txt"><span class="item__nome">' + esc(p.nome) + '</span><span class="item__sub">' + esc(p.cena) + '</span></span></button>').join('') + '</div>';
    const agenda = '<p class="nota">Agora: dia ' + E.agenda.dia + ', ' + E.agenda.apito + 'º apito.</p><div class="lista">' + AVENTURA.agenda.map((a) => '<div class="item"><span class="item__ic">' + ic('relogio') + '</span><span class="item__txt"><span class="item__nome">' + a[0] + '</span><span class="item__sub">' + a[1] + '</span></span></div>').join('') + '</div>';
    const estados = AVENTURA.estados.map((s) => campo({ t: 'seg', k: s[0], rot: s[1], ops: s[2].map((x) => [x, x[0].toUpperCase() + x.slice(1)]) }, 'aventura')).join('') + '<p class="nota">Trocar um valor dispara a rotina dos NPCs.</p>';
    return '<h2 class="titulo-pagina">Aventura</h2><p class="sub-pagina">O que vale para todas as cenas</p><div class="fichas">' +
      fichaHTML({ id: 'pinos', rot: 'Pinos', ic: 'pino', aberta: true, resumo: () => AVENTURA.pinos.length + ' pinos', campos: [{ t: 'html', html: listaPinos }] }, 'aventura') +
      fichaHTML({ id: 'agenda', rot: 'Agenda', ic: 'relogio', aberta: false, resumo: () => 'Dia ' + E.agenda.dia, campos: [{ t: 'html', html: agenda }, { t: 'liga', k: 'alarmeAg', rot: 'Soar alarme ao disparar', v: true }, { t: 'html', html: '<div class="acoes"><button type="button" class="bt bt--p" data-acao="apito">Próximo apito</button><button type="button" class="bt bt--p" data-acao="dia">Próximo dia</button><button type="button" class="bt bt--fantasma bt--p" data-acao="aviso" data-msg="No app, abre o campo de novo evento: nome, dia e apito.">+ Novo evento</button></div>' }] }, 'aventura') +
      fichaHTML({ id: 'estado', rot: 'Estado do mundo', ic: 'pulso', aberta: false, resumo: () => 'Maré ' + leitor('aventura')('mare'), campos: [{ t: 'html', html: estados }, { t: 'html', html: '<button type="button" class="bt bt--fantasma bt--p" data-acao="aviso" data-msg="No app, abre o campo de novo estado e seus valores.">+ Novo estado</button>' }] }, 'aventura') +
      '</div>';
  }

  function pagAcervo() {
    const abas = '<div class="seg" role="radiogroup" aria-label="O que mostrar" style="margin-bottom:12px"><button type="button" class="seg__op" role="radio" aria-checked="' + (E.acervoAba === 'tokens') + '" data-acao="acervo-aba" data-v="tokens">' + ic('token') + '<span>Tokens</span></button><button type="button" class="seg__op" role="radio" aria-checked="' + (E.acervoAba === 'itens') + '" data-acao="acervo-aba" data-v="itens">' + ic('joia') + '<span>Itens</span></button></div>';
    let h = '<h2 class="titulo-pagina">Acervo</h2><p class="sub-pagina">Do app, vale para todas as aventuras</p>' + abas;
    if (E.acervoAba === 'tokens') {
      const tokenSel = E.sel && E.sel.tipo === 'token';
      h += '<p class="nota" style="margin-bottom:8px">Arraste uma ficha até o mapa.</p><div class="lista">' + ACERVO.pastas.map((p) => {
        const aberta = !!E.pastas[p.nome];
        const fichas = aberta ? (p.fichas.length ? '<div class="entra-lista">' + p.fichas.map((f, i) => '<div class="item item--recuo item--arrasta" style="--i:' + i + '" draggable="true" data-arrasta="' + esc(f[0]) + '|' + f[1] + '" aria-label="' + esc(f[0]) + ', arraste até o mapa"><span class="bola" style="background:' + f[1] + '">' + esc(iniciais(f[0])) + '</span><span class="item__txt"><span class="item__nome">' + esc(f[0]) + '</span></span><button type="button" class="bt bt--ic bt--p" aria-label="Pôr ' + esc(f[0]) + ' no centro do mapa" data-acao="por-no-mapa" data-v="' + esc(f[0]) + '|' + f[1] + '">' + ic('mais', 'ic--p') + '</button></div>').join('') + '</div>' : '<p class="nota" style="padding:4px 6px 8px 28px">Pasta vazia. Guarde uma ficha do mapa aqui.</p>') : '';
        return (p.nome === 'Sem pasta' ? '' : '<button type="button" class="item" aria-expanded="' + aberta + '" data-acao="pasta" data-v="' + p.nome + '"><span class="item__ic">' + ic(aberta ? 'baixo' : 'dir', 'ic--p') + '</span><span class="item__ic">' + ic('pasta') + '</span><span class="item__txt"><span class="item__nome">' + p.nome + '</span></span><span class="item__fim">' + p.conta + '</span></button>') + (p.nome === 'Sem pasta' ? '<p class="nota" style="margin:8px 6px 2px">Sem pasta</p>' + p.fichas.map((f) => '<div class="item item--arrasta" draggable="true" data-arrasta="' + esc(f[0]) + '|' + f[1] + '"><span class="bola" style="background:' + f[1] + '">' + esc(iniciais(f[0])) + '</span><span class="item__txt"><span class="item__nome">' + esc(f[0]) + '</span></span><button type="button" class="bt bt--ic bt--p" aria-label="Pôr ' + esc(f[0]) + ' no centro do mapa" data-acao="por-no-mapa" data-v="' + esc(f[0]) + '|' + f[1] + '">' + ic('mais', 'ic--p') + '</button></div>').join('') : fichas);
      }).join('') + '</div><div class="acoes" style="margin-top:12px"><button type="button" class="bt bt--p" data-acao="aviso" data-msg="Pasta nova criada no acervo.">' + ic('pasta', 'ic--p') + '+ Pasta</button><button type="button" class="bt bt--p" data-acao="guardar-token"' + (tokenSel ? '' : ' disabled aria-describedby="porque-guardar"') + '>' + ic('acervo', 'ic--p') + 'Guardar a ficha</button></div>' + (tokenSel ? '' : '<p class="nota" id="porque-guardar" style="margin-top:6px">Para guardar, selecione uma ficha no mapa.</p>');
    } else {
      semear('acervo', [{ k: 'cat', v: 'Todas' }]);
      const cat = leitor('acervo')('cat');
      h += campo({ t: 'seg', k: 'cat', rot: 'Categoria', grade: 0, r: 1, ops: ACERVO.categorias.map((c) => [c, c]) }, 'acervo') +
        '<div class="cartoes entra-lista" style="margin-top:10px">' + ACERVO.itens.filter((i) => cat === 'Todas' || i[2] === cat).map((i, n) => '<button type="button" class="cartao" style="--i:' + n + '" data-acao="aviso" data-msg="No app, abre ' + esc(i[0]) + ' para editar imagem e descrição.">' + ic(i[1], 'ic--g') + '<span class="cartao__rot">' + esc(i[0]) + '</span><span class="cartao__resumo">' + esc(i[2]) + '</span></button>').join('') + '</div>' +
        '<div class="acoes" style="margin-top:12px"><button type="button" class="bt bt--p" data-acao="aviso" data-msg="No app, abre o novo item: nome, imagem e categoria.">+ Novo item</button><button type="button" class="bt bt--fantasma bt--p" data-acao="aviso" data-msg="Categoria nova criada.">+ Nova categoria</button></div>';
    }
    return h;
  }

  function renderEsq(modo) {
    const corpo = $('#esq-corpo');
    const topo = corpo.scrollTop;
    const pag = { ficha: pagFicha, cena: pagCena, aventura: pagAventura, acervo: pagAcervo }[E.pagEsq];
    corpo.innerHTML = pag();
    corpo.classList.remove('entra', 'entra-lado');
    if (modo === 'anima' || modo === 'lado') {
      corpo.scrollTop = 0;
      void corpo.offsetWidth;
      corpo.classList.add(modo === 'lado' ? 'entra-lado' : 'entra');
    } else if (modo === 'instante') {
      corpo.scrollTop = 0;
    } else {
      corpo.scrollTop = topo;
    }
    marcadores('esq', E.pagEsq, modo === 'anima' || modo === 'lado');
    const ponto = $('[data-pag-esq="ficha"] .marcador__ponto');
    if (ponto) ponto.classList.toggle('vis', !!E.sel && E.pagEsq !== 'ficha');
    const busca = $('#busca-mapa');
    if (busca && E.buscaMapa) { busca.value = E.buscaMapa; $('#resultados').innerHTML = resultadosBusca(E.buscaMapa); }
  }

  /* ================================================================ LIVRO DA DIREITA */
  function topoDir() {
    if (!E.sala) {
      return '<div class="linha linha--entre"><h2 class="sala-titulo">Sala</h2><span class="sala-estado"><span class="ponto-off"></span>Fechada</span></div>' +
        '<button type="button" class="bt bt--primario bt--alto bt--largo" data-acao="abrir-sala">Abrir sala</button>' +
        '<div class="linha linha--entre"><button type="button" class="bt bt--p" data-acao="visao-jogador">' + ic('olho', 'ic--p') + 'Visão de jogador</button><button type="button" class="bt bt--fantasma bt--p" aria-haspopup="dialog" data-acao="rede">' + ic('ajuda', 'ic--p') + 'Rede</button></div>';
    }
    return '<div class="linha"><h2 class="sala-titulo">Sala</h2><button type="button" class="placa-codigo' + (E.brilhar ? ' brilha' : '') + '" data-acao="copiar-codigo" aria-label="Código da sala ' + SALA.codigo + '. Clique para copiar" data-balao="Copiar o código">' + SALA.codigo + ic('copiar') + '</button><button type="button" class="bt bt--ic empurra" aria-label="Mais da sala" aria-haspopup="menu" data-balao="Mais da sala" data-acao="menu-sala">' + ic('reticencias') + '</button></div>' +
      '<div class="linha"><button type="button" class="bt bt--p" aria-pressed="' + E.laser + '" data-acao="laser">' + ic('laser', 'ic--p') + 'Laser</button><button type="button" class="bt bt--p" aria-haspopup="dialog" data-acao="som">' + ic(E.mudo ? 'somMudo' : 'som', 'ic--p') + 'Som</button><button type="button" class="bt bt--p" aria-haspopup="dialog" data-acao="convidar">' + ic('convidar', 'ic--p') + 'Convidar</button></div>';
  }

  function linhaJogador(j) {
    const aberto = E.jogadorAberto === j.id;
    return '<div class="jogador' + (aberto ? ' e-aberto' : '') + '"><div class="jogador__linha"><button type="button" class="jogador__abrir" aria-expanded="' + aberto + '" data-acao="jogador" data-id="' + j.id + '"><span class="bola" style="background:' + j.cor + '">' + j.nome[0] + '</span><span class="item__txt"><span class="item__nome">' + esc(j.nome) + '</span><span class="item__sub">' + esc(j.ficha) + '</span></span><span class="' + (j.on ? 'ponto-on' : 'ponto-off') + '" role="img" aria-label="' + (j.on ? 'Conectado' : 'Fora do ar') + '"></span></button>' +
      '<div class="jogador__rapidas"><button type="button" class="bt bt--ic bt--p" aria-label="Ir lá: ' + esc(j.nome) + '" data-balao="Ir lá" data-acao="aviso" data-msg="A câmera foi até ' + esc(j.nome) + '.">' + ic('mira', 'ic--p') + '</button><button type="button" class="bt bt--ic bt--p" aria-label="Recado para ' + esc(j.nome) + '" data-balao="Recado" data-acao="aviso" data-msg="No app, abre o recado para ' + esc(j.nome) + '.">' + ic('carta', 'ic--p') + '</button></div></div>' +
      (aberto ? fichaJogador(j) : '') + '</div>';
  }

  function fichaJogador(j) {
    const abas = [['acoes', 'Ações'], ['mochila', 'Mochila'], ['visao', 'Visão'], ['ficha', 'Ficha']];
    const seg = '<div class="seg" role="radiogroup" aria-label="Ficha de ' + esc(j.nome) + '">' + abas.map((a) => '<button type="button" class="seg__op" role="radio" aria-checked="' + (E.jogTab === a[0]) + '" data-acao="jog-tab" data-v="' + a[0] + '">' + a[1] + '</button>').join('') + '</div>';
    const bt = (rot, icn, msg, estilo) => '<button type="button" class="bt bt--p' + (estilo ? ' bt--' + estilo : '') + '" data-acao="aviso" data-msg="' + esc(msg) + '">' + ic(icn, 'ic--p') + rot + '</button>';
    let corpo = '';
    if (E.jogTab === 'acoes') {
      corpo = '<h4>Mover</h4><div class="acoes">' + bt('Seguir', 'seguir', 'A câmera segue ' + j.nome + '.') + bt('Trazer', 'trazer', j.nome + ' veio para a sua cena.') + bt('Mandar para…', 'seta', 'No app, escolhe a cena ou o pino de destino.') + '</div>' +
        '<h4>Ver</h4><div class="acoes">' + bt('Ver tela', 'monitor', 'No app, abre o que ' + j.nome + ' está vendo.') + bt('Mostrar mapa de um a outro', 'cena', 'No app, escolhe quem mostra e quem vê.') + bt('Mapa de papel', 'caderno', 'Mapa de papel entregue a ' + j.nome + '.') + bt('Dar o que o grupo viu', 'olho', j.nome + ' agora sabe o que o grupo viu.') + '</div>' +
        '<h4>Ficha</h4><div class="acoes">' + bt('Tirar ficha', 'x', 'Ficha tirada de ' + j.nome + '.') + bt('Emprestar ajudante', 'pessoa', 'No app, escolhe o ajudante emprestado.') + bt('Emprestar fichas', 'token', 'No app, escolhe as fichas emprestadas.') + bt('Passar a outro jogador', 'troca', 'No app, escolhe quem recebe a ficha.') + bt('Guardar fichas', 'acervo', 'Fichas de ' + j.nome + ' guardadas.') + '</div>' +
        '<h4>Sair da mesa</h4><div class="acoes">' + bt('Dispensar', 'dispensar', j.nome + ' foi dispensado, pode voltar depois.', 'fantasma') + bt('Expulsar', 'expulsar', 'No app, pede confirmação antes de expulsar ' + j.nome + '.', 'perigo') + '</div>';
    } else if (E.jogTab === 'mochila') {
      corpo = '<div class="lista"><div class="item"><span class="item__ic">' + ic('chave') + '</span><span class="item__txt"><span class="item__nome">Chave de ferro</span><span class="item__sub">Achada no cais</span></span><button type="button" class="bt bt--p bt--fantasma" data-acao="aviso" data-msg="Chave de ferro tirada de ' + esc(j.nome) + '.">Tirar</button><button type="button" class="bt bt--p bt--fantasma" data-acao="aviso" data-msg="Chave de ferro devolvida ao chão.">Ao chão</button></div></div><p class="nota">14 moedas.</p><div class="acoes">' + bt('Dar item…', 'joia', 'No app, escolhe o item do acervo.') + bt('Moedas…', 'moedas', 'No app, abre o campo de moedas.') + bt('Propor troca…', 'troca', 'No app, monta a proposta de troca.') + '</div>';
    } else if (E.jogTab === 'visao') {
      semear('j:' + j.id, [{ k: 'raio', v: 6 }, { k: 'fator', v: 100 }]);
      corpo = campo({ t: 'faixa', k: 'raio', rot: 'Raio de visão', min: 1, max: 20, un: 'casas' }, 'j:' + j.id) + campo({ t: 'faixa', k: 'fator', rot: 'Fator de visão', min: 25, max: 200, un: '%' }, 'j:' + j.id) + '<div class="acoes">' + bt('Revelar planta', 'olho', 'Planta revelada para ' + j.nome + '.') + bt('Esconder de novo', 'olhoFechado', 'Planta escondida de novo.') + '</div>';
    } else {
      corpo = '<p class="nota">Personagem ligado: ' + esc(j.ficha) + '.</p><div class="acoes">' + bt('Abrir a ficha', 'ficha', 'No app, abre a ficha de ' + j.ficha + '.', 'latao') + bt('Atribuir outra ficha', 'token', 'No app, escolhe a ficha do mapa.') + '</div>';
    }
    return '<div class="jogador__ficha">' + seg + corpo + '</div>';
  }

  function pagGrupo() {
    const personagens = '<div class="lista">' + SALA.personagens.map((p) => '<div class="item"><span class="bola" style="background:' + p[2] + '">' + p[0][0] + '</span><span class="item__txt"><span class="item__nome">' + p[0] + '</span><span class="item__sub">' + p[1] + '</span></span><button type="button" class="bt bt--ic bt--p" aria-label="Abrir ficha de ' + p[0] + '" data-acao="aviso" data-msg="No app, abre a ficha de ' + p[0] + '.">' + ic('ficha', 'ic--p') + '</button><button type="button" class="bt bt--ic bt--p" aria-label="Apagar ' + p[0] + '" data-acao="aviso" data-msg="No app, pede confirmação antes de apagar ' + p[0] + '.">' + ic('lixo', 'ic--p') + '</button></div>').join('') + '</div><div class="acoes"><button type="button" class="bt bt--p" data-acao="aviso" data-msg="Personagem novo criado.">+ Personagem</button><button type="button" class="bt bt--fantasma bt--p" data-acao="aviso" data-msg="No app, abre a importação de personagens.">Importar…</button></div>';
    semear('grupo', [{ k: 'soConta', v: false }]);
    const contas = campo({ t: 'liga', k: 'soConta', rot: 'Só com conta', ajuda: 'Ligado, quem entra só digitando o nome é recusado. Quem já está na sala continua.' }, 'grupo') +
      '<div class="lista">' + SALA.contas.map((c) => '<div class="item"><span class="item__txt"><span class="item__nome">' + c[0] + '</span><span class="item__sub">' + c[1] + (c[1] === 1 ? ' personagem' : ' personagens') + ', ' + c[2] + (c[2] === 1 ? ' aparelho' : ' aparelhos') + '</span></span><button type="button" class="bt bt--ic bt--p" aria-label="Opções da conta de ' + c[0] + '" aria-haspopup="menu" data-acao="menu-conta" data-v="' + c[0] + '">' + ic('reticencias', 'ic--p') + '</button></div>').join('') + '</div><button type="button" class="bt bt--fantasma bt--p" data-acao="aviso" data-msg="No app, abre nova conta: nome e PIN.">+ Nova conta</button>';
    const pessoas = '<div class="fichas" style="margin-top:14px">' +
      fichaHTML({ id: 'personagens', rot: 'Personagens', ic: 'ficha', aberta: false, resumo: () => '10', campos: [{ t: 'html', html: personagens }] }, 'grupo') +
      fichaHTML({ id: 'contas', rot: 'Contas dos jogadores', ic: 'pessoa', aberta: false, resumo: () => '9', campos: [{ t: 'html', html: contas }] }, 'grupo') + '</div>';

    if (!E.sala) {
      return '<div class="vazio"><p class="vazio__tit">A mesa está vazia</p><p>Abra a sala e passe o código para os jogadores entrarem pelo celular.</p></div>' +
        '<button type="button" class="bt bt--fantasma bt--p" style="margin-top:10px" data-acao="livro">' + ic('livro', 'ic--p') + 'Livro de regras</button>' + pessoas;
    }
    const pedidos = E.pedidoFeito ? 0 : 1;
    let h = '<div class="aviso-npc">' + ic('rota') + '<span>' + (E.npcsPausados ? 'NPCs parados' : '2 NPCs andando sozinhos') + '</span><button type="button" class="bt bt--p empurra" data-acao="pausa-npcs">' + (E.npcsPausados ? 'Retomar' : 'Pausar todos') + '</button></div>' +
      '<div class="linha"><div class="busca" style="flex:1">' + ic('busca') + '<input class="entrada" type="search" autocomplete="off" placeholder="Buscar" aria-label="Buscar jogador" data-busca="jogador"></div><button type="button" class="chip" aria-pressed="' + E.soPedindo + '" data-acao="filtro-pedindo">Pedindo ' + pedidos + '</button></div>';
    if (E.chegando.length && !E.soPedindo) {
      h += '<div class="grupo-cena"><div class="grupo-cena__cab"><span class="grupo-cena__nome">Chegando<small>sem ficha</small></span></div>' + E.chegando.map((c) => '<div class="item" data-nome-jog="' + c.nome.toLowerCase() + '"><span class="bola" style="background:' + c.cor + '">' + c.nome[0] + '</span><span class="item__txt"><span class="item__nome">' + c.nome + '</span><span class="item__sub">Entrou agora</span></span><button type="button" class="bt bt--latao bt--p" aria-haspopup="menu" data-acao="atribuir" data-id="' + c.id + '">Atribuir ficha</button></div>').join('') + '</div>';
    }
    const cenas = {};
    E.jogadores.forEach((j) => { (cenas[j.cena] = cenas[j.cena] || []).push(j); });
    Object.keys(cenas).forEach((nome) => {
      const temPedido = !E.pedidoFeito && cenas[nome].some((j) => j.nome === SALA.pedido.quem);
      if (E.soPedindo && !temPedido) return;
      const cong = !!E.cenasCongeladas[nome];
      const paus = !!E.cenasPausadas[nome];
      h += '<div class="grupo-cena"><div class="grupo-cena__cab"><span class="grupo-cena__nome">' + esc(nome) + '<small>' + cenas[nome].length + '</small></span>' +
        '<button type="button" class="bt bt--ic bt--p" aria-label="Ir à cena ' + esc(nome) + '" data-balao="Ir à cena" data-acao="aviso" data-msg="No app, abre a cena ' + esc(nome) + '.">' + ic('seta', 'ic--p') + '</button>' +
        '<button type="button" class="bt bt--ic bt--p" aria-pressed="' + cong + '" aria-label="Congelar a cena" data-balao="' + (cong ? 'Descongelar a cena' : 'Congelar a cena') + '" data-acao="congelar-cena" data-v="' + esc(nome) + '">' + ic('floco', 'ic--p') + '</button>' +
        '<button type="button" class="bt bt--ic bt--p" aria-pressed="' + paus + '" aria-label="Pausar a cena" data-balao="' + (paus ? 'Retomar a cena' : 'Pausar a cena') + '" data-acao="pausar-cena" data-v="' + esc(nome) + '">' + ic('pausa', 'ic--p') + '</button></div>';
      if (temPedido) {
        h += '<div class="pedido" data-pedido><p><b>' + SALA.pedido.quem + '</b> pede passagem para a ' + SALA.pedido.para + '.</p><div class="acoes"><button type="button" class="bt bt--primario bt--p" data-acao="pedido" data-v="Ryo pode ir.">Deixar ir</button><button type="button" class="bt bt--p" data-acao="pedido" data-v="Pedido recusado.">Não</button><button type="button" class="bt bt--p" data-acao="pedido" data-v="Liberado só desta vez.">Liberar uma vez</button><button type="button" class="bt bt--fantasma bt--p" data-acao="pedido" data-v="A barra aguenta: a passagem segue fechada.">A barra aguenta</button></div></div>';
      }
      h += '<div class="entra-lista">' + cenas[nome].map((j, i) => '<div style="--i:' + i + '" data-nome-jog="' + j.nome.toLowerCase() + '">' + linhaJogador(j) + '</div>').join('') + '</div></div>';
    });
    h += '<div class="linha" style="margin-top:12px"><button type="button" class="bt bt--p" aria-pressed="' + E.congelados + '" data-acao="congelar-todos">' + ic('floco', 'ic--p') + (E.congelados ? 'Descongelar todos' : 'Congelar todos') + '</button></div>';
    return h + pessoas;
  }

  function pagChat() {
    if (!E.sala) return '<div class="vazio"><p class="vazio__tit">O chat abre junto com a sala</p><p>Quando os jogadores entrarem, a conversa de cada cena aparece aqui.</p><div class="acoes"><button type="button" class="bt bt--latao bt--p" data-acao="abrir-sala">Abrir sala</button></div></div>';
    return campo({ t: 'sel', k: 'canal', rot: 'Conversa', ops: ['Todas as cenas', 'Porto de Tasmaturi', 'Armazém 3'] }, 'chat') +
      '<div class="chat-msgs" style="margin-top:12px">' + E.msgs.map((m, i) => '<div class="msg' + (m.nova ? ' e-nova' : '') + '"><span class="bola" style="background:' + m.cor + '">' + m.quem[0] + '</span><div><div class="msg__quem"><b>' + esc(m.quem) + '</b>' + esc(m.cena) + '</div><div class="msg__txt">' + esc(m.txt) + '</div></div></div>').join('') + '</div>';
  }

  function pagCenas() {
    let h = '<div class="linha" style="margin-bottom:10px"><div class="busca" style="flex:1">' + ic('busca') + '<input class="entrada" type="search" placeholder="Filtrar cenas" aria-label="Filtrar cenas" data-busca="cenas"></div><button type="button" class="bt bt--p bt--latao" data-acao="aviso" data-msg="Cena nova criada na pasta Porto.">+ Cena</button></div>';
    SALA.cenas.forEach((p) => {
      h += '<p class="nota" style="margin:10px 6px 2px; display:flex; gap:6px; align-items:center">' + ic('pasta', 'ic--p') + p.pasta + '</p><div class="lista">';
      p.itens.forEach((c) => {
        const sub = [c[2] === 'inicial' ? 'Cena inicial' : '', c[1] ? c[1] + (c[1] === 1 ? ' jogador' : ' jogadores') : 'Ninguém aqui'].filter(Boolean).join(', ');
        h += '<div class="item' + (c[3] ? ' e-atual' : '') + '" data-nome-cena="' + esc(c[0].toLowerCase()) + '"><span class="item__ic">' + ic('cena') + '</span><span class="item__txt"><span class="item__nome">' + esc(c[0]) + '</span><span class="item__sub">' + sub + '</span></span><button type="button" class="bt bt--ic bt--p" aria-label="Configurar visão dos jogadores nesta cena" data-balao="Configurar" data-acao="aviso" data-msg="No app, abre a visão dos jogadores em ' + esc(c[0]) + '.">' + ic('engrenagem', 'ic--p') + '</button><button type="button" class="bt bt--ic bt--p" aria-label="Mais da cena ' + esc(c[0]) + '" aria-haspopup="menu" data-acao="menu-cena" data-v="' + esc(c[0]) + '">' + ic('reticencias', 'ic--p') + '</button></div>';
      });
      h += '</div>';
    });
    return h + '<div class="acoes" style="margin-top:14px"><button type="button" class="bt bt--p" data-acao="visao-geral">' + ic('cenas', 'ic--p') + 'Visão geral</button><button type="button" class="bt bt--fantasma bt--p" data-acao="aviso" data-msg="No app, abre o Revisor da aventura.">Revisor da aventura</button></div>';
  }

  function pagMesa() {
    semear('mesa', [{ k: 'rotTeste', v: 'Percepção' }, { k: 'quemTeste', v: ['Vagn', 'Nami'] }, { k: 'fichaVisao', v: 'Vagn' }, { k: 'vol', v: 70 }, { k: 'mudo', v: false }, { k: 'ruido', v: false }, { k: 'alcRuido', v: 4 }, { k: 'cenaTela', v: 'Porto de Tasmaturi' }]);
    const teste = E.sala
      ? campo({ t: 'texto', k: 'rotTeste', rot: 'Teste de', ph: 'ex.: Percepção' }, 'mesa') + campo({ t: 'chips', k: 'quemTeste', rot: 'Para quem', ops: JOGADORES }, 'mesa') + '<div class="acoes"><button type="button" class="bt bt--latao bt--p" data-acao="aviso" data-msg="Teste secreto pedido. Só você vê os resultados.">Pedir teste</button><button type="button" class="bt bt--fantasma bt--p" data-acao="aviso" data-msg="Teste encerrado.">Encerrar</button></div>'
      : '<p class="nota">Precisa de jogadores na sala.</p><div class="acoes"><button type="button" class="bt bt--p" disabled>Pedir teste</button></div>';
    const visao = campo({ t: 'sel', k: 'fichaVisao', rot: 'Ver como', ops: ['Vagn', 'Nami', 'Ryo', 'Saga'] }, 'mesa') + '<p class="nota">Só você vê. Nada fica no jogo.</p><div class="acoes"><button type="button" class="bt bt--p" data-acao="visao-jogador">' + ic('olho', 'ic--p') + 'Abrir visão de teste</button></div>';
    const som = campo({ t: 'faixa', k: 'vol', rot: 'Volume dos sons de clima', min: 0, max: 100, un: '%' }, 'mesa') + campo({ t: 'liga', k: 'mudo', rot: 'Mudo neste PC' }, 'mesa');
    const ruido = campo({ t: 'liga', k: 'ruido', rot: 'Armar o clique de ruído', ajuda: 'O próximo clique no mapa faz barulho.' }, 'mesa') + campo({ t: 'num', k: 'alcRuido', rot: 'Alcance', min: 1, max: 20, un: 'casas' }, 'mesa');
    const tela = '<div class="campo"><label class="campo__rot" for="url-tela">Endereço da tela da TV</label><div class="linha"><input class="entrada" id="url-tela" readonly value="http://192.168.0.20:5173/tela"><button type="button" class="bt bt--ic" aria-label="Copiar endereço" data-acao="aviso" data-msg="Endereço da tela copiado.">' + ic('copiar') + '</button></div></div>' + campo({ t: 'sel', k: 'cenaTela', rot: 'Cena na tela', ops: ['Porto de Tasmaturi', 'Armazém 3', 'Praça da Cidade Alta'] }, 'mesa');
    const diario = '<div class="lista"><div class="item"><span class="item__ic">' + ic('viagem') + '</span><span class="item__txt"><span class="item__nome">Ryo foi ao Armazém 3</span><span class="item__sub">há 4 min</span></span><button type="button" class="bt bt--p bt--fantasma" data-acao="aviso" data-msg="Viagem desfeita: Ryo voltou ao cais.">Desfazer</button></div></div>';
    return '<h2 class="titulo-pagina">Mesa</h2><p class="sub-pagina">Ferramentas da sessão</p><div class="fichas">' +
      fichaHTML({ id: 'teste', rot: 'Teste secreto', ic: 'olhoFechado', aberta: true, resumo: () => '', campos: [{ t: 'html', html: teste }] }, 'mesa') +
      fichaHTML({ id: 'visao', rot: 'Visão de jogador', ic: 'olho', aberta: false, resumo: () => 'Teste', campos: [{ t: 'html', html: visao }] }, 'mesa') +
      fichaHTML({ id: 'som', rot: 'Som da mesa', ic: 'som', aberta: false, resumo: () => leitor('mesa')('mudo') ? 'Mudo' : leitor('mesa')('vol') + '%', campos: [{ t: 'html', html: som }] }, 'mesa') +
      fichaHTML({ id: 'ruido', rot: 'Ruído', ic: 'ruido', aberta: false, resumo: () => leitor('mesa')('ruido') ? 'Armado' : 'Desarmado', campos: [{ t: 'html', html: ruido }] }, 'mesa') +
      fichaHTML({ id: 'tela', rot: 'Tela da mesa', ic: 'monitor', aberta: false, resumo: () => 'TV', campos: [{ t: 'html', html: tela }] }, 'mesa') +
      fichaHTML({ id: 'diario', rot: 'Diário de viagem', ic: 'caderno', aberta: false, resumo: () => '1 viagem', campos: [{ t: 'html', html: diario }] }, 'mesa') +
      '</div><div class="acoes" style="margin-top:12px"><button type="button" class="bt bt--p" data-acao="livro">' + ic('livro', 'ic--p') + 'Livro de regras</button></div>';
  }

  function renderDir(modo) {
    $('#dir-topo').innerHTML = topoDir();
    const corpo = $('#dir-corpo');
    const topo = corpo.scrollTop;
    corpo.innerHTML = { grupo: pagGrupo, chat: pagChat, cenas: pagCenas, mesa: pagMesa }[E.pagDir]();
    corpo.classList.remove('entra');
    if (modo === 'anima') { corpo.scrollTop = 0; void corpo.offsetWidth; corpo.classList.add('entra'); } else corpo.scrollTop = modo === 'instante' ? 0 : topo;
    $('#dir-pe').innerHTML = E.pagDir === 'chat' && E.sala ? '<form class="chat-envio" data-form="chat"><label class="sr" for="msg-mestre">Mensagem</label><input class="entrada" id="msg-mestre" autocomplete="off" placeholder="Escreva para a cena"><button class="bt bt--primario" type="submit">Enviar</button></form>' : '';
    marcadores('dir', E.pagDir, modo === 'anima');
    const conta = $('[data-pag-dir="chat"] .marcador__conta');
    if (conta) conta.hidden = !E.sala || E.pagDir === 'chat';
    const cg = $('[data-pag-dir="grupo"] .marcador__conta');
    if (cg) { cg.hidden = !E.sala || E.pedidoFeito; }
  }

  /* ---------------- marcadores e fita */
  function marcadores(lado, atual, anima) {
    const lista = $('#marc-' + lado);
    $$('.marcador', lista).forEach((m) => {
      const sel = m.dataset[lado === 'esq' ? 'pagEsq' : 'pagDir'] === atual;
      m.setAttribute('aria-selected', String(sel));
      m.tabIndex = sel ? 0 : -1;
    });
    const alvo = $('.marcador[aria-selected="true"]', lista);
    const fita = $('.fita', lista);
    if (!alvo || !fita) return;
    if (!anima || reduzido()) fita.classList.add('sem-anim');
    fita.style.transform = 'translateY(' + alvo.offsetTop + 'px)';
    if (!anima || reduzido()) { void fita.offsetWidth; fita.classList.remove('sem-anim'); }
  }

  /* ================================================================ BARRA */
  function renderBarra() {
    let h = '<div class="placa" id="placa" aria-hidden="true"></div>';
    BARRA.forEach((gr, i) => {
      if (i) h += '<span class="barra__div" aria-hidden="true"></span>';
      h += '<div class="barra__grupo" role="group" aria-label="' + gr.grupo + '">' + gr.itens.map((it) => {
        const temVar = !!campoVariante(it.id);
        const at = atalhoAtual(it.id);
        return '<button type="button" class="ferr" data-ferr="' + it.id + '" aria-pressed="' + (E.ferr === it.id) + '" aria-label="' + it.rot + (at ? ' (' + at + ')' : '') + '"' + (temVar ? ' aria-haspopup="true"' : '') + ' data-balao="' + it.rot + '" data-at="' + at + '" data-grupo="' + gr.grupo + '">' + ic(iconeFerr(it.id)) + (temVar ? '<span class="ferr__canto" aria-hidden="true"></span>' : '') + '</button>';
      }).join('') + '</div>';
    });
    $('#barra').innerHTML = h;
    moverPlaca(false);
  }

  function moverPlaca(anima) {
    const barra = $('#barra');
    const bt = $('.ferr[data-ferr="' + E.ferr + '"]', barra);
    const placa = $('#placa');
    if (!bt || !placa) return;
    const x = bt.getBoundingClientRect().left - barra.getBoundingClientRect().left;
    const escala = barra.getBoundingClientRect().width / barra.offsetWidth || 1;
    if (!anima || reduzido()) placa.classList.add('sem-anim');
    placa.style.transform = 'translateX(' + (x / escala) + 'px)';
    if (!anima || reduzido()) { void placa.offsetWidth; placa.classList.remove('sem-anim'); }
  }

  function atualizarBotoesBarra() {
    $$('.ferr').forEach((b) => {
      const id = b.dataset.ferr;
      b.setAttribute('aria-pressed', String(id === E.ferr));
      const svg = b.querySelector('svg');
      const novo = iconeFerr(id);
      if (svg && b.dataset.ic !== novo) { svg.outerHTML = ic(novo); b.dataset.ic = novo; }
      const at = atalhoAtual(id);
      b.dataset.at = at;
      b.setAttribute('aria-label', itemBarra(id).rot + (at ? ' (' + at + ')' : ''));
    });
  }

  /* via = 'mouse' anima; 'teclado' troca na hora (atalho de uso constante não anima) */
  function armar(id, via, variante) {
    const mudou = E.ferr !== id;
    if (variante) { semear('fer:' + id, FERRAMENTAS[id].campos); VAL['fer:' + id][variante[0]] = variante[1]; }
    E.ferr = id;
    E.sub = null;
    if (id !== 'selecionar') E.sel = null;
    E.novoToken = false;
    const trocouPagina = E.pagEsq !== 'ficha';
    E.pagEsq = 'ficha';
    if (E.esqRecolhido) recolher('esq', false);
    atualizarBotoesBarra();
    moverPlaca(via === 'mouse' && mudou);
    renderEsq(via === 'mouse' && (mudou || trocouPagina || variante) ? 'anima' : 'instante');
    renderMapa();
    $('#mapa').classList.toggle('arma', id !== 'selecionar');
  }

  /* ================================================================ MAPA */
  function renderMapa() {
    const off = (c) => (E.camadasOff.has(c) ? ' style="display:none"' : '');
    const s = [];
    s.push('<defs><pattern id="grade" width="35" height="35" patternUnits="userSpaceOnUse"><path d="M35 0H0V35" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1"/></pattern><radialGradient id="lampiao"><stop offset="0" stop-color="#f3ba66" stop-opacity="0.22"/><stop offset="1" stop-color="#f3ba66" stop-opacity="0"/></radialGradient></defs>');
    s.push('<rect width="1440" height="900" fill="url(#grade)" data-fundo="1"/>');
    s.push('<path class="mar" d="M330 140 L425 140 L425 520 L380 560 L330 600 Z"/>');
    s.push('<g' + off('Salas') + '>' + MAPA.corredores.map((c) => '<rect class="corredor" x="' + c.x + '" y="' + c.y + '" width="' + c.w + '" height="' + c.h + '"/>').join('') +
      MAPA.salas.map((r) => '<rect class="sala-chao alvo" data-tipo="sala" data-id="' + r.id + '" x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + r.h + '" style="stroke:none"/>').join('') + '</g>');
    s.push('<g' + off('Paredes') + ' pointer-events="none">' + MAPA.salas.map((r) => '<rect x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + r.h + '" fill="none" stroke="#d6d0c2" stroke-width="1.5"/>').join('') +
      MAPA.corredores.map((c) => (c.w > c.h ? '<path d="M' + c.x + ' ' + c.y + 'h' + c.w + 'M' + c.x + ' ' + (c.y + c.h) + 'h' + c.w + '" stroke="#d6d0c2" stroke-width="1.5"/>' : '<path d="M' + c.x + ' ' + c.y + 'v' + c.h + 'M' + (c.x + c.w) + ' ' + c.y + 'v' + c.h + '" stroke="#d6d0c2" stroke-width="1.5"/>')).join('') + '</g>');
    s.push('<g' + off('Iluminação') + ' pointer-events="none"><circle cx="500" cy="300" r="120" fill="url(#lampiao)"/></g>');
    s.push('<g' + off('Objetos') + ' pointer-events="none" stroke="#8e8778" stroke-width="1" fill="#4a4338">' + [[960, 200], [990, 200], [960, 230]].map((p) => '<rect x="' + p[0] + '" y="' + p[1] + '" width="24" height="24"/><path d="M' + p[0] + ' ' + p[1] + 'l24 24M' + (p[0] + 24) + ' ' + p[1] + 'l-24 24"/>').join('') + '</g>');
    s.push('<g' + off('Escadas') + ' pointer-events="none" stroke="#a9a293" stroke-width="1">' + [0, 1, 2, 3, 4, 5].map((i) => '<path d="M700 ' + (560 + i * 8) + 'h44"/>').join('') + '<rect x="700" y="556" width="44" height="50" fill="none"/></g>');
    s.push('<g' + off('Salas') + '>' + MAPA.salas.map((r) => '<text class="sala-nome" x="' + (r.x + r.w / 2) + '" y="' + (r.y + 22) + '">' + esc(leitor('sala:' + r.id)('nome') || r.nome) + '</text>').join('') + '</g>');
    s.push('<g' + off('Portas') + '>' + MAPA.portas.map((p) => portaSVG(p, false)).join('') + '</g>');
    s.push('<g' + off('Anotações') + '>' + MAPA.pinos.map((p) => {
      const tipo = leitor('pino:' + p.id)('tipo') || p.tipo;
      const sim = { '!': '!', '?': '?', viagem: '↑', alavanca: '⌐' }[tipo];
      return '<g class="alvo" data-tipo="pino" data-id="' + p.id + '" transform="translate(' + p.x + ' ' + p.y + ')"><path class="pino-corpo' + (tipo === 'viagem' ? ' viagem' : '') + '" d="M0 14 C-5 6 -11 1 -11 -6 A11 11 0 0 1 11 -6 C11 1 5 6 0 14Z"/><text class="pino-sim" y="-1.5">' + sim + '</text></g>';
    }).join('') + '</g>');
    s.push('<g' + off('Tokens') + '>' + MAPA.tokens.map((t) => {
      const g = leitor('token:' + t.id);
      const cor = g('cor') || t.cor;
      const nome = g('nome') || t.nome;
      return '<g class="alvo" data-tipo="token" data-id="' + t.id + '" transform="translate(' + t.x + ' ' + t.y + ')"><circle class="tok-corpo" r="15" fill="' + cor + '"/><text class="tok-letra" y="4">' + esc(iniciais(nome)) + '</text><text class="tok-nome" y="30">' + esc(nome) + '</text></g>';
    }).join('') + '</g>');
    s.push('<g id="sel-mapa">' + selecaoSVG() + '</g>');
    $('#mapa').innerHTML = s.join('');
    E.anelNovo = false;
  }

  function selecaoSVG() {
    if (!E.sel) return '';
    const o = objeto(E.sel.tipo, E.sel.id);
    if (!o) return '';
    const anel = 'anel' + (E.anelNovo && !reduzido() ? ' anel--entra' : '');
    const tique = (x, y, dx, dy) => '<path class="anel-tique" d="M' + x + ' ' + y + 'l' + dx + ' ' + dy + '"/>';
    if (E.sel.tipo === 'token') return '<g transform="translate(' + o.x + ' ' + o.y + ')"><circle class="' + anel + '" r="21"/></g>';
    if (E.sel.tipo === 'pino') return '<g transform="translate(' + o.x + ' ' + (o.y - 4) + ')"><circle class="' + anel + '" r="18"/></g>';
    if (E.sel.tipo === 'porta') {
      const w = o.vertical ? 7 : o.comp;
      const h = o.vertical ? o.comp : 7;
      const x = (o.vertical ? o.x - 3.5 : o.x) - 6;
      const y = (o.vertical ? o.y : o.y - 3.5) - 6;
      return '<rect class="' + anel + '" x="' + x + '" y="' + y + '" width="' + (w + 12) + '" height="' + (h + 12) + '" rx="4"/>';
    }
    const x = o.x - 4;
    const y = o.y - 4;
    const w = o.w + 8;
    const h = o.h + 8;
    return '<rect class="' + anel + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3"/>' + tique(x, y, 10, 0) + tique(x, y, 0, 10) + tique(x + w, y + h, -10, 0) + tique(x + w, y + h, 0, -10);
  }

  function selecionar(tipo, id, via) {
    E.anelNovo = via === 'mouse' || via === 'acervo';
    E.sel = { tipo: tipo, id: id };
    E.sub = null;
    E.novoToken = false;
    const trocouFerr = E.ferr !== 'selecionar';
    if (trocouFerr) { E.ferr = 'selecionar'; atualizarBotoesBarra(); moverPlaca(via === 'mouse'); $('#mapa').classList.remove('arma'); }
    if (via !== 'acervo') E.pagEsq = 'ficha';
    if (E.esqRecolhido && via !== 'acervo') recolher('esq', false);
    renderMapa();
    renderEsq(via === 'acervo' ? 'manter' : (via === 'mouse' ? 'anima' : 'instante'));
  }

  function deselecionar() {
    if (!E.sel) return;
    E.sel = null;
    E.sub = null;
    renderMapa();
    if (E.pagEsq === 'ficha') renderEsq('instante'); else renderEsq('manter');
  }

  function apagarSelecionado() {
    if (!E.sel) return;
    const { tipo, id } = E.sel;
    const lista = { token: MAPA.tokens, porta: MAPA.portas, pino: MAPA.pinos, sala: MAPA.salas }[tipo];
    const i = lista.findIndex((o) => o.id === id);
    if (i < 0) return;
    const nome = nomeDoSelecionado();
    const [o] = lista.splice(i, 1);
    E.apagados.push({ lista: lista, o: o, i: i, nome: nome });
    E.sel = null;
    E.sub = null;
    renderMapa();
    renderEsq('instante');
    aviso(nome + ' apagado.', 'Desfazer', desfazer);
  }

  function desfazer() {
    const u = E.apagados.pop();
    if (!u) { aviso('Nada para desfazer.'); return; }
    u.lista.splice(u.i, 0, u.o);
    renderMapa();
    aviso(u.nome + ' voltou ao mapa.');
  }

  function pontoNoMapa(clientX, clientY) {
    const svg = $('#mapa');
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  function novoTokenNoMapa(nome, cor, x, y) {
    const id = 'n' + Date.now();
    MAPA.tokens.push({ id: id, nome: nome, tipo: 'npc', cor: cor, x: Math.round(x), y: Math.round(y) });
    return id;
  }

  /* ================================================================ JOGADOR */
  function renderJogador() {
    const abas = [['jogo', 'Jogo'], ['caderno', 'Caderno'], ['lugares', 'Lugares'], ['dados', 'Dados'], ['chat', 'Chat']];
    $('#jog').innerHTML = '<div class="jog-legenda"><b>Tela do jogador</b>A mesma linguagem no celular: faixa de couro com os quatro atalhos de sempre, folha com marcadores, e a ação ligada vira placa de latão, igual à ferramenta armada do mestre.</div>' +
      '<div class="tel" id="tel"><svg class="tel__mapa" viewBox="420 -110 390 640" preserveAspectRatio="xMidYMid slice" aria-label="Mapa do jogador" role="img">' + mapaJogador() + '</svg>' +
      '<div class="tel__faixa" role="toolbar" aria-label="Atalhos do jogador">' +
      '<button type="button" class="tel__bt" aria-expanded="' + E.folhaAberta + '" aria-controls="folha" data-acao="j-painel">' + ic(E.folhaAberta ? 'cima' : 'baixo') + '<span>Painel</span></button>' +
      '<button type="button" class="tel__bt" data-acao="j-minha">' + ic('mira') + '<span>Minha ficha</span></button>' +
      '<button type="button" class="tel__bt" aria-haspopup="dialog" data-acao="j-inv">' + ic('mochila') + '<span>Inventário</span><kbd>I</kbd></button>' +
      '<button type="button" class="tel__bt" aria-haspopup="dialog" data-acao="j-ficha">' + ic('ficha') + '<span>Ficha</span></button></div>' +
      '<section class="folha' + (E.folhaAberta ? '' : ' e-fechada') + '" id="folha" aria-label="Painel"' + (E.folhaAberta ? '' : ' inert') + '><div class="abas" role="tablist" aria-label="Painel do jogador">' +
      abas.map((a) => '<button type="button" class="aba" role="tab" id="aba-' + a[0] + '" aria-selected="' + (E.jogAba === a[0]) + '" aria-controls="folha-corpo" tabindex="' + (E.jogAba === a[0] ? 0 : -1) + '" data-acao="j-aba" data-v="' + a[0] + '">' + a[1] + '</button>').join('') +
      '<span class="aba__ind" id="aba-ind" aria-hidden="true"></span></div><div class="folha__corpo" id="folha-corpo" role="tabpanel" aria-labelledby="aba-' + E.jogAba + '">' + corpoJogador() + '</div></section>' +
      '<button type="button" class="tel__chamar" data-acao="j-chamar" aria-label="Chamar o mestre">' + ic('mao') + '</button></div>';
    moverIndicadorAba(false);
  }

  function moverIndicadorAba(anima) {
    const ind = $('#aba-ind');
    const aba = $('.aba[aria-selected="true"]');
    if (!ind || !aba) return;
    ind.style.width = aba.offsetWidth + 'px';
    if (!anima || reduzido()) ind.style.transition = 'none';
    ind.style.transform = 'translateX(' + (aba.offsetLeft - 6) + 'px)';
    if (!anima || reduzido()) { void ind.offsetWidth; ind.style.transition = ''; }
  }

  function mapaJogador() {
    const salas = MAPA.salas.filter((s) => s.id !== 'armazem');
    return '<rect x="0" y="0" width="1440" height="900" fill="#0d0f10"/>' +
      '<rect x="0" y="0" width="1440" height="900" fill="url(#grade-j)"/><defs><pattern id="grade-j" width="35" height="35" patternUnits="userSpaceOnUse"><path d="M35 0H0V35" fill="none" stroke="rgba(255,255,255,0.03)"/></pattern></defs>' +
      MAPA.corredores.slice(1).map((c) => '<rect x="' + c.x + '" y="' + c.y + '" width="' + c.w + '" height="' + c.h + '" fill="#2b343b"/>').join('') +
      salas.map((r) => '<rect x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + r.h + '" fill="' + (r.id === 'cais' ? '#333d45' : '#262e34') + '" stroke="#cfc9bb" stroke-width="1.5"/><text class="sala-nome" x="' + (r.x + r.w / 2) + '" y="' + (r.y + r.h - 14) + '" style="font:400 13px var(--lb-font-display);fill:#b9b4a8;text-anchor:middle">' + r.nome + '</text>').join('') +
      portaSVG(objeto('porta', 'p3'), true) +
      '<g transform="translate(612 402)"><circle r="15" fill="#79a9cc" stroke="#101214" stroke-width="2"/><text y="4" style="font:600 11px var(--lb-font-utility);fill:#101214;text-anchor:middle">V</text><text y="30" style="font:500 10.5px var(--lb-font-sans);fill:#d8d3c7;text-anchor:middle;paint-order:stroke;stroke:#16191b;stroke-width:3px">Vagn</text></g>' +
      '<g transform="translate(680 268)"><circle r="15" fill="#7fb48a" stroke="#101214" stroke-width="2"/><text y="4" style="font:600 11px var(--lb-font-utility);fill:#101214;text-anchor:middle">J</text></g>' +
      '<g transform="translate(706 236)"><path d="M0 14 C-5 6 -11 1 -11 -6 A11 11 0 0 1 11 -6 C11 1 5 6 0 14Z" fill="#e9e4d6" stroke="#101214"/><text y="-1.5" style="font:700 12px var(--lb-font-utility);fill:#15181a;text-anchor:middle">!</text></g>';
  }

  function corpoJogador() {
    const J = JOGADOR;
    if (E.jogAba === 'jogo') {
      const acao = J.acoes.find((a) => a[0] === E.jogAcao);
      semear('jog', [{ k: 'brilho', v: 55 }, { k: 'grade', v: false }, { k: 'nomes', v: true }, { k: 'camera', v: false }, { k: 'jnome', v: 'Vagn' }]);
      return '<button type="button" class="persona" data-acao="j-minha"><span class="bola" style="background:' + J.personagem.cor + ';width:36px;height:36px;font-size:13px">V</span><span><span class="persona__nome">' + J.personagem.nome + '</span><span class="persona__sub">' + J.personagem.sub + ', no ' + J.personagem.onde + '</span></span></button>' +
        '<h3 class="titulo-secao">No mapa</h3><div class="pecas" role="group" aria-label="Ações no mapa">' +
        J.acoes.map((a) => '<button type="button" class="peca" ' + (a[0] === 'marcacoes' ? 'aria-haspopup="menu"' : 'aria-pressed="' + (E.jogAcao === a[0]) + '"') + ' data-acao="j-acao" data-v="' + a[0] + '">' + ic(a[2]) + '<span>' + a[1] + '</span></button>').join('') + '</div>' +
        '<p class="dica-acao" id="dica-acao" aria-live="polite">' + (acao ? acao[3] : 'Escolha uma ação e toque no mapa.') + '</p>' +
        '<div class="ficha" style="margin-top:6px"><button type="button" class="linha-acao" data-acao="j-mostrar" aria-haspopup="menu">' + ic('cena') + '<span class="item__txt"><span class="item__nome">Mostrar meu mapa a…</span><span class="item__sub">Um colega da cena vê o que você vê</span></span>' + ic('dir', 'ic--p') + '</button>' +
        '<button type="button" class="linha-acao" role="switch" aria-checked="' + E.voltoJa + '" data-acao="j-volto">' + ic('relogio') + '<span class="item__txt"><span class="item__nome">Volto já</span><span class="item__sub">Sua ficha fica parada e o mestre sabe que você saiu por um instante.</span></span><span class="liga__trilho" aria-hidden="true" style="flex:none"></span></button></div>' +
        '<div class="fichas" style="margin-top:12px">' +
        fichaHTML({ id: 'comigo', rot: 'Comigo', ic: 'mochila', aberta: true, resumo: () => J.comigo.length + ' itens', campos: [{ t: 'html', html: '<div class="lista">' + J.comigo.map((c) => '<div class="item"><span class="item__txt"><span class="item__nome">' + c[0] + '</span><span class="item__sub">' + c[1] + '</span></span></div>').join('') + '</div><p class="nota">' + J.moedas + ' moedas.</p><div class="acoes"><button type="button" class="bt bt--p" data-acao="aviso" data-msg="Escolha a quem dar e o item.">Dar a…</button><button type="button" class="bt bt--p" data-acao="aviso" data-msg="Escolha a quem pagar e quantas moedas.">Pagar a…</button></div>' }] }, 'jog') +
        fichaHTML({ id: 'grupoj', rot: 'Grupo', ic: 'grupo', aberta: true, resumo: () => J.grupo.length + ' colegas', campos: [{ t: 'html', html: '<div class="lista">' + J.grupo.map((c) => '<div class="item"><span class="bola" style="background:' + c[2] + '">' + c[0][0] + '</span><span class="item__txt"><span class="item__nome">' + c[0] + '</span><span class="item__sub">' + c[1] + '</span></span></div>').join('') + '</div>' }] }, 'jog') +
        fichaHTML({ id: 'meu', rot: 'Meu personagem', ic: 'pessoa', aberta: false, resumo: () => 'Vagn', campos: [{ t: 'texto', k: 'jnome', rot: 'Nome' }, { t: 'acoes', bts: [['Trocar foto', 'imagem', '', 'No app, abre a escolha de foto.'], ['Esconder', 'olhoFechado', 'fantasma', 'Pedido para esconder enviado ao mestre.']] }] }, 'jog') +
        fichaHTML({ id: 'visao', rot: 'Visão', ic: 'olho', aberta: false, resumo: () => 'Brilho ' + leitor('jog')('brilho') + '%', campos: [{ t: 'faixa', k: 'brilho', rot: 'Brilho do explorado', min: 0, max: 100, un: '%' }, { t: 'liga', k: 'grade', rot: 'Grade' }, { t: 'liga', k: 'nomes', rot: 'Nomes' }, { t: 'liga', k: 'camera', rot: 'Câmera segue minha ficha' }] }, 'jog') +
        '</div><button type="button" class="bt bt--fantasma bt--p" style="margin-top:12px" data-acao="j-sair">' + ic('dispensar', 'ic--p') + 'Sair da sala</button>';
    }
    if (E.jogAba === 'caderno') {
      return '<h3 class="titulo-secao" style="margin-top:4px">Minhas notas</h3><div class="lista entra-lista">' + J.notas.map((n, i) => '<div class="item" style="--i:' + i + '"><span class="item__ic">' + ic('caderno') + '</span><span class="item__txt"><span class="item__nome">' + n[0] + '</span><span class="item__sub">' + n[1] + '</span></span><button type="button" class="bt bt--ic bt--p" aria-label="Ir até a nota" data-acao="aviso" data-msg="A câmera foi até a nota.">' + ic('mira', 'ic--p') + '</button><button type="button" class="bt bt--ic bt--p" aria-label="Apagar nota" data-acao="aviso" data-msg="Nota apagada.">' + ic('lixo', 'ic--p') + '</button></div>').join('') + '</div><button type="button" class="bt bt--p" style="margin-top:12px" data-acao="aviso" data-msg="Caderno baixado: caderno-vagn.html">' + ic('importar', 'ic--p') + 'Baixar meu caderno</button>';
    }
    if (E.jogAba === 'lugares') {
      return '<h3 class="titulo-secao" style="margin-top:4px">Onde já estive</h3><div class="cartoes entra-lista">' + J.lugares.map((l, i) => '<button type="button" class="cartao' + (l[1] ? ' e-ligado' : '') + '" style="--i:' + i + '" data-acao="aviso" data-msg="' + (l[1] ? 'Você está aqui.' : 'Lembrança de ' + l[0] + '.') + '">' + ic('sala', 'ic--g') + '<span class="cartao__rot">' + l[0] + '</span><span class="cartao__resumo">' + (l[1] ? 'Você está aqui' : 'Visitado') + '</span></button>').join('') + '</div><h3 class="titulo-secao">Pontos conhecidos</h3><div class="lista"><div class="item"><span class="item__ic">' + ic('exclamacao') + '</span><span class="item__txt"><span class="item__nome">Caixas suspeitas</span><span class="item__sub">Cais do Porto</span></span></div></div>';
    }
    if (E.jogAba === 'dados') {
      semear('dados', [{ k: 'dado', v: 'd20' }, { k: 'qtd', v: 1 }, { k: 'mod', v: 2 }, { k: 'escondido', v: false }]);
      return campo({ t: 'seg', k: 'dado', rot: 'Dado', ops: ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'].map((x) => [x, x]) }, 'dados') +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">' + campo({ t: 'num', k: 'qtd', rot: 'Quantidade', min: 1, max: 20 }, 'dados') + campo({ t: 'num', k: 'mod', rot: 'Modificador', min: -20, max: 20 }, 'dados') + '</div>' +
        campo({ t: 'liga', k: 'escondido', rot: 'Rolar escondido', ajuda: 'Só você e o mestre veem.' }, 'dados') +
        '<button type="button" class="bt bt--primario bt--alto bt--largo" style="margin-top:8px" data-acao="rolar">' + ic('d20', 'ic--p') + 'Rolar</button><div class="dados-res" style="margin-top:12px" aria-live="polite">' +
        E.rolagens.map((r, i) => '<div class="rolagem' + (i === 0 && r.nova ? ' e-nova' : '') + '"><span class="rolagem__total">' + r.total + '</span><span class="item__txt"><span class="item__nome">' + r.desc + '</span><span class="item__sub">' + r.det + '</span></span></div>').join('') + '</div>';
    }
    return '<div class="chat-msgs">' + E.jogMsgs.map((m) => '<div class="msg' + (m.nova ? ' e-nova' : '') + '"><span class="bola" style="background:' + m.cor + '">' + m.quem[0] + '</span><div><div class="msg__quem"><b>' + esc(m.quem) + '</b></div><div class="msg__txt">' + esc(m.txt) + '</div></div></div>').join('') + '</div><form class="linha" style="margin-top:12px" data-form="chat-j"><label class="sr" for="msg-j">Mensagem</label><input class="entrada" id="msg-j" autocomplete="off" placeholder="Fale com a cena"><button class="bt bt--primario" type="submit">Enviar</button></form>';
  }

  function renderCorpoJogador(anima) {
    const c = $('#folha-corpo');
    c.innerHTML = corpoJogador();
    c.setAttribute('aria-labelledby', 'aba-' + E.jogAba);
    c.classList.remove('entra');
    if (anima) { c.scrollTop = 0; void c.offsetWidth; c.classList.add('entra'); }
  }

  /* ================================================================ AVISOS, POPOVERS, DIÁLOGOS */
  function aviso(msg, rotAcao, fn) {
    const t = document.createElement('div');
    t.className = 'torrada';
    t.setAttribute('role', 'status');
    t.innerHTML = '<span>' + esc(msg) + '</span>' + (rotAcao ? '<button type="button" class="bt bt--p bt--latao">' + esc(rotAcao) + '</button>' : '');
    if (rotAcao) t.querySelector('button').addEventListener('click', () => { fn(); fechar(); });
    const lista = $('#torradas');
    lista.appendChild(t);
    while (lista.children.length > 3) lista.firstElementChild.remove();
    let morto = false;
    function fechar() {
      if (morto) return;
      morto = true;
      t.classList.add('sai');
      setTimeout(() => t.remove(), reduzido() ? 130 : 160);
    }
    setTimeout(fechar, rotAcao ? 5200 : 2600);
  }

  let popAberto = null;
  function abrirPop(gatilho, html, lado, rotulo) {
    fecharPop(true);
    const r = gatilho.getBoundingClientRect();
    const p = document.createElement('div');
    p.className = 'pop';
    p.setAttribute('role', html.indexOf('menu__item') >= 0 ? 'menu' : 'dialog');
    if (rotulo) p.setAttribute('aria-label', rotulo);
    p.innerHTML = html;
    document.body.appendChild(p);
    const pw = p.offsetWidth;
    const ph = p.offsetHeight;
    let x;
    let y;
    let origem;
    if (lado === 'cima') { x = r.left + r.width / 2 - pw / 2; y = r.top - ph - 8; origem = '50% 100%'; }
    else if (lado === 'esq') { x = r.left - pw - 8; y = r.top; origem = '100% 0'; }
    else if (lado === 'dir') { x = r.right + 8; y = r.top; origem = '0 0'; }
    else { x = r.right - pw; y = r.bottom + 6; origem = '100% 0'; }
    x = Math.max(8, Math.min(window.innerWidth - pw - 8, x));
    y = Math.max(8, Math.min(window.innerHeight - ph - 8, y));
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    p.style.setProperty('--origem', origem);
    popAberto = { el: p, gatilho: gatilho };
    gatilho.setAttribute('aria-expanded', 'true');
    const foco = p.querySelector('button, input, select');
    if (foco) foco.focus({ preventScroll: true });
    return p;
  }
  function fecharPop(instante) {
    if (!popAberto) return;
    const { el, gatilho } = popAberto;
    popAberto = null;
    gatilho.setAttribute('aria-expanded', 'false');
    if (instante || reduzido()) { el.remove(); return; }
    el.classList.add('sai');
    setTimeout(() => el.remove(), 110);
  }
  const itemMenu = (rot, icn, acao, extra, classe) => '<button type="button" role="menuitem" class="menu__item' + (classe ? ' ' + classe : '') + '" data-acao="' + acao + '" ' + (extra || '') + '>' + (icn ? ic(icn) : '') + '<span>' + rot + '</span></button>';

  let dlgAberto = null;
  function abrirDialogo(titulo, corpo, classe) {
    fecharDialogo(true);
    const f = document.createElement('div');
    f.className = 'dlg-fundo';
    f.innerHTML = '<div class="dlg' + (classe ? ' ' + classe : '') + '" role="dialog" aria-modal="true" aria-labelledby="dlg-tit"><div class="dlg__topo"><h2 class="dlg__tit" id="dlg-tit">' + titulo + '</h2><button type="button" class="bt bt--ic" aria-label="Fechar" data-acao="fechar-dlg">' + ic('x') + '</button></div><div class="dlg__corpo">' + corpo + '</div></div>';
    document.body.appendChild(f);
    dlgAberto = { el: f, antes: document.activeElement };
    f.addEventListener('mousedown', (ev) => { if (ev.target === f) fecharDialogo(); });
    const foco = f.querySelector('.dlg__corpo button, .dlg__corpo input') || f.querySelector('[data-acao="fechar-dlg"]');
    foco.focus({ preventScroll: true });
  }
  function fecharDialogo(instante) {
    if (!dlgAberto) return;
    const { el, antes } = dlgAberto;
    dlgAberto = null;
    if (instante || reduzido()) el.remove();
    else { el.classList.add('sai'); setTimeout(() => el.remove(), 140); }
    if (antes && antes.focus) antes.focus({ preventScroll: true });
  }

  const CONFIG = [
    ['Grade', [{ t: 'liga', k: 'grade', rot: 'Mostrar grade', v: true }, { t: 'seg', k: 'formato', rot: 'Formato', ops: [['quad', 'Quadrada'], ['hex', 'Hexagonal']], v: 'quad' }, { t: 'cor', k: 'corGrade', rot: 'Cor', ops: ['#ffffff', '#d6d0c2', '#e0a44a'], v: '#ffffff' }, { t: 'faixa', k: 'opGrade', rot: 'Opacidade', min: 0, max: 100, v: 4, un: '%' }, { t: 'faixa', k: 'espGrade', rot: 'Espessura', min: 1, max: 4, v: 1, un: 'px' }, { t: 'seg', k: 'estGrade', rot: 'Estilo da linha', ops: [['cont', 'Contínua'], ['trac', 'Tracejada'], ['pont', 'Pontilhada']], v: 'cont' }]],
    ['Alinhar grade à imagem', [{ t: 'num', k: 'col', rot: 'Colunas', v: 60, min: 1, max: 400 }, { t: 'num', k: 'lin', rot: 'Linhas', v: 40, min: 1, max: 400 }, { t: 'num', k: 'dx', rot: 'Deslocamento X', v: 0, min: -70, max: 70, un: 'px' }, { t: 'num', k: 'dy', rot: 'Deslocamento Y', v: 0, min: -70, max: 70, un: 'px' }, { t: 'liga', k: 'previa', rot: 'Prévia', v: true }]],
    ['Medição', [{ t: 'texto', k: 'porCasa', rot: 'Unidades por casa', v: '1,5' }, { t: 'sel', k: 'unidade', rot: 'Unidade', ops: ['m', 'pés', 'km'], v: 'm' }, { t: 'num', k: 'casas', rot: 'Casas decimais', v: 1, min: 0, max: 3 }, { t: 'seg', k: 'modo', rot: 'Modo', ops: [['simples', 'Simples'], ['alt', '5-10-5'], ['eucl', 'Reta']], v: 'simples' }]],
    ['Rostos e movimento', [{ t: 'num', k: 'rostos', rot: 'Rostos só de perto', v: 3, min: 0, max: 20, un: 'casas' }, { t: 'seg', k: 'mov', rot: 'Movimento dos jogadores', ops: [['livre', 'Livre'], ['espaco', 'Fichas ocupam espaço']], v: 'livre' }]],
    ['Tamanho do mapa', [{ t: 'num', k: 'larg', rot: 'Largura', v: 60, min: 10, max: 400, un: 'casas' }, { t: 'num', k: 'alt', rot: 'Altura', v: 40, min: 10, max: 400, un: 'casas' }]],
    ['Texto de chegada', [{ t: 'area', k: 'chegada', rot: 'O jogador lê ao chegar', ph: 'ex.: O porto cheira a sal e alcatrão.', v: '' }]],
    ['Sistema de RPG', [{ t: 'sel', k: 'sistema', rot: 'Sistema', ops: ['Tormenta 20', 'D&D 5e', 'Nenhum'], v: 'Tormenta 20' }, { t: 'nota', txt: '"Categorias do painel" sai daqui: nesta proposta os marcadores do livro fazem esse papel.' }]],
  ];
  function abrirConfig(secao) {
    const i = secao || 0;
    CONFIG.forEach((c) => semear('cfg', c[1]));
    const nav = '<nav class="nav-vertical" aria-label="Seções">' + CONFIG.map((c, n) => '<button type="button" aria-current="' + (n === i) + '" data-acao="cfg-secao" data-v="' + n + '">' + c[0] + '</button>').join('') + '</nav>';
    const corpo = '<div class="dlg-duas">' + nav + '<div class="fichas"><div class="ficha ficha--plana"><div class="ficha__dentro" id="cfg-corpo">' + CONFIG[i][1].map((c) => campo(c, 'cfg', CONFIG[i][0])).join('') + '</div></div></div></div>';
    if (dlgAberto && $('#cfg-corpo')) {
      $('.dlg__corpo').innerHTML = corpo;
      const b = $('.nav-vertical [aria-current="true"]');
      if (b) b.focus({ preventScroll: true });
    } else abrirDialogo('Configurações do mapa', corpo);
  }

  function abrirAtalhos() {
    const ferrs = BARRA.flatMap((g) => g.itens).filter((i) => i.at).map((i) => [i.at, i.rot]);
    const extra = [['J', 'Sala circular'], ['Q', 'Sala em polígono'], ['G', 'Região'], ['B', 'Objeto: imagem'], ['L U C O R A', 'Desenho: linha, curva, círculo, elipse, retângulo, polígono']];
    const gerais = [['Ctrl Z', 'Desfazer'], ['Ctrl Y', 'Refazer'], ['Ctrl S', 'Salvar'], ['Ctrl K', 'Procurar no mapa'], ['Del', 'Apagar o selecionado'], ['Esc', 'Limpar a seleção, fechar'], ['Clique direito na ferramenta', 'Abre as variantes']];
    const lista = (xs) => '<div class="atalhos-mini" style="font-size:13px">' + xs.map((x) => '<kbd>' + x[0] + '</kbd><span>' + x[1] + '</span>').join('') + '</div>';
    abrirDialogo('Atalhos do teclado', '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px"><div><h3 class="titulo-secao" style="margin-top:0">Ferramentas</h3>' + lista(ferrs.concat(extra)) + '</div><div><h3 class="titulo-secao" style="margin-top:0">Geral</h3>' + lista(gerais) + '</div></div>');
  }

  const ONDE = [
    ['O que o consolidado trouxe das outras propostas', [
      ['Ficha do ponto de interesse (no Grimório: fichas recolhíveis e grade grande de tipo)', 'Layout da Mesa limpa: bloco essencial sempre aberto (Tipo, Nome, Descrição, Quem vê, Alcance). Ícone no mapa, Só o círculo e Travado foram para a ficha "Aparência".'],
      ['Recursos do pino (no Grimório: cartões que abriam ficha própria)', 'Botão "+ Adicionar ao pino": o recurso entra aberto na própria ficha e sai com "Tirar do pino", com Desfazer. Os valores ficam guardados.'],
      ['Animação do cenário (antes: só um aviso de texto)', 'Recurso do pino com prévia viva da revelação do local: Assistir, Ver grande; nome, descrição, câmera e efeitos mudam a prévia na hora (ideia do Estúdio).'],
      ['Porta: Aberta ou Fechada', 'Topo da ficha da porta (Mesa limpa). No mapa a folha gira na dobradiça e o ícone da ficha gira junto; "Animação ao abrir" fica em Aparência.'],
      ['Abrir agora (Mais ações da porta) e Acionar agora (alavanca)', 'Abrem e fecham a porta de verdade, com a mesma folha girando no mapa.'],
    ]],
    ['Barra da esquerda', [
      ['Cabeçalho: "+ Token"', 'Cabeçalho do livro da esquerda, logo abaixo do nome do app.'],
      ['Ícone de expandir ("Ver todas as cenas")', 'Chip da cena no topo do mapa, opção "Ver todas as cenas", com o nome certo.'],
      ['Engrenagem (Configurações do mapa)', 'Cabeçalho da esquerda, mesmo ícone, com balão "Configurações do mapa".'],
      ['Linha "Nome · LxA · Npx" (cortada)', 'Nome inteiro no chip da cena; medidas no marcador Cena e nas Configurações.'],
      ['Faixa da seleção (tipo, Apagar, Mais ações)', 'Marcador Ficha: cabeçalho da ficha, com Apagar e "Mais ações".'],
      ['Opções da ferramenta + setinhas da barra', 'Marcador Ficha ("ficha da ferramenta"); a setinha virou o cantinho do botão: clique direito ou segurar abre as variantes.'],
      ['Endireitar', 'Menu "Mais ações" da ficha (sala, parede, caminho).'],
      ['Seleção múltipla (Limpar, Alinhar e distribuir, Oculto em lote)', 'Marcador Ficha quando há 2 ou mais itens (não montado no protótipo).'],
      ['AVENTURA: Pinos, Agenda, Estado do mundo', 'Marcador Aventura.'],
      ['ESTA CENA: Objetos do mapa', 'Busca do topo do marcador Cena (Ctrl+K continua).'],
      ['ESTA CENA: Locais, Chão do mapa, Camadas, Camadas do chão, Território, Marcas', 'Marcador Cena, em fichas recolhíveis.'],
      ['Acervo de tokens e Acervo de itens', 'Marcador Acervo, com Tokens e Itens lado a lado. Fica a um clique mesmo com uma ficha aberta.'],
      ['Desfazer, Refazer, Salvar', 'Cabeçalho da esquerda, ícones.'],
      ['Voltar (cena anterior)', 'Chip da cena, seta à esquerda do nome.'],
      ['Abrir…, Importar/Exportar mapa, Exportar imagem, Imagem de fundo e conversão, Início', 'Menu "Arquivo" no cabeçalho da esquerda.'],
      ['Atalhos do teclado (?)', 'Ícone "?" no cabeçalho da esquerda.'],
    ]],
    ['Barra da direita', [
      ['Abas Jogo e Chat + região Cenas', 'Marcadores Grupo, Chat, Cenas e Mesa na lombada da direita.'],
      ['Abrir sala, código, Laser', 'Cabeçalho fixo da direita.'],
      ['Visão de jogador', 'Cabeçalho (sala fechada) e marcador Mesa.'],
      ['REDE LOCAL (parágrafo fixo)', '"O celular não abre?" no cabeçalho e dentro de Convidar.'],
      ['Livro de regras', 'Marcador Mesa (e Grupo, com a sala fechada).'],
      ['Personagens e Contas dos jogadores', 'Marcador Grupo, abaixo dos jogadores, em fichas recolhidas.'],
      ['Som da mesa', 'Botão Som do cabeçalho e marcador Mesa.'],
      ['Ruído, Teste secreto, Diário de viagem, Tela da mesa', 'Marcador Mesa.'],
      ['Grupo (mais de 25 ações por jogador)', 'Marcador Grupo: 2 ações rápidas na linha; o resto na ficha do jogador, por assunto (Mover, Ver, Ficha, Sair da mesa) e nas abas Mochila e Visão.'],
      ['Convidar jogadores', 'Botão Convidar do cabeçalho.'],
      ['Fechar sala', 'Menu "Mais da sala" do cabeçalho, com confirmação.'],
      ['Pausa geral dos NPCs', 'Faixa no topo do marcador Grupo.'],
      ['Esconder a coluna da direita', 'Seta no pé da lombada.'],
    ]],
    ['Barra de ferramentas', [
      ['Sala, Sala circular, Polígono regular, Sala livre, Região', 'Um botão "Sala" com 5 formas; N, J, Q e G continuam funcionando.'],
      ['Objetos (mobília) e Peça (imagem)', 'Um botão "Objeto" (B continua).'],
      ['Setinhas de quase todo botão', 'Cantinho do botão + ficha da ferramenta.'],
    ]],
    ['Tela do jogador', [
      ['6 botões largos (Sinalizar, Marcações, Medir, Laser, Mostrar meu mapa, Volto já)', '4 peças "No mapa" (Sinalizar, Medir, Laser, Marcações) + 2 linhas (Mostrar meu mapa a…, Volto já).'],
      ['Dica de texto entre cada botão', 'Uma linha só, da ação ligada.'],
      ['Visão e Meu personagem', 'Fichas recolhidas no fim da aba Jogo.'],
      ['Sair', 'Rodapé da aba Jogo.'],
    ]],
  ];
  function abrirOnde() {
    abrirDialogo('Onde foi parar cada controle', '<p class="nota" style="font-size:13px">Nada some: o que saiu da tela principal mudou de lugar. A coluna da esquerda é o que existe hoje; a da direita, onde fica nesta proposta.</p><table class="tabela-onde">' + ONDE.map((s) => '<tr><th colspan="2">' + s[0] + '</th></tr>' + s[1].map((l) => '<tr><td>' + esc(l[0]) + '</td><td>' + esc(l[1]) + '</td></tr>').join('')).join('') + '</table>');
  }

  /* ================================================================ RECOLHER LIVROS */
  function recolher(lado, valor) {
    const k = lado === 'esq' ? 'esqRecolhido' : 'dirRecolhido';
    E[k] = valor;
    const livro = $('#livro-' + lado);
    livro.classList.toggle('e-recolhido', valor);
    const pag = $('.pagina-trilho', livro);
    if (valor) pag.setAttribute('inert', ''); else pag.removeAttribute('inert');
    const bt = $('.lombada__recolher', livro);
    bt.setAttribute('aria-expanded', String(!valor));
    bt.setAttribute('aria-label', valor ? 'Abrir a página' : 'Recolher a página');
    bt.dataset.balao = valor ? 'Abrir a página' : 'Recolher a página';
  }

  /* ================================================================ BALÃO (tooltip) */
  const balao = { el: null, timer: 0, quente: 0, alvo: null };
  function mostrarBalao(alvo) {
    clearTimeout(balao.timer);
    const quente = Date.now() - balao.quente < 600;
    const mostra = () => {
      if (!document.body.contains(alvo)) return;
      const b = balao.el;
      b.innerHTML = '<span>' + esc(alvo.dataset.balao) + '</span>' + (alvo.dataset.at ? '<kbd>' + esc(alvo.dataset.at) + '</kbd>' : '') + (alvo.dataset.grupo ? '<small>' + esc(alvo.dataset.grupo) + '</small>' : '');
      b.classList.toggle('instantaneo', quente);
      const r = alvo.getBoundingClientRect();
      const emBaixo = r.top < 60;
      b.style.left = '0px';
      b.style.top = '0px';
      b.classList.add('medir');
      const bw = b.offsetWidth;
      const bh = b.offsetHeight;
      b.style.left = Math.max(8, Math.min(window.innerWidth - bw - 8, r.left + r.width / 2 - bw / 2)) + 'px';
      b.style.top = (emBaixo ? r.bottom + 8 : r.top - bh - 8) + 'px';
      b.style.transformOrigin = emBaixo ? '50% 0' : '50% 100%';
      b.classList.add('vis');
      balao.alvo = alvo;
    };
    if (quente) mostra(); else balao.timer = setTimeout(mostra, 320);
  }
  function esconderBalao() {
    clearTimeout(balao.timer);
    if (balao.el.classList.contains('vis')) balao.quente = Date.now();
    balao.el.classList.remove('vis');
    balao.alvo = null;
  }

  /* ================================================================ EVENTOS */
  function aoMudarValor(alvo, valor, opts) {
    const sc = alvo.dataset.sc;
    const k = alvo.dataset.k;
    VAL[sc] = VAL[sc] || {};
    VAL[sc][k] = valor;
    refletir(sc, k);
    if (alvo.dataset.r || (opts && opts.redesenha)) {
      if (alvo.closest('#esq-corpo')) renderEsq('manter');
      else if (alvo.closest('#dir-corpo')) renderDir('manter');
      else if (alvo.closest('.pop')) { /* gaveta: a ficha da esquerda redesenha abaixo */ }
      else if (alvo.closest('#folha-corpo')) renderCorpoJogador(false);
      else if (alvo.closest('#cfg-corpo')) abrirConfig(Number($('.nav-vertical [aria-current="true"]').dataset.v));
    }
  }

  /* o que muda no mapa enquanto se mexe na ficha */
  function refletir(sc, k) {
    if (sc.indexOf('fer:') === 0) {
      atualizarBotoesBarra();
      const id = sc.slice(4);
      if (id === E.ferr && !E.sel && E.pagEsq === 'ficha') renderEsq('manter');
      return;
    }
    if (sc.indexOf('token:') === 0 && (k === 'cor' || k === 'nome' || k === 'kind')) { renderMapa(); if (k !== 'nome') renderEsq('manter'); else { const n = $('[data-nome-sel]'); if (n) n.textContent = leitor(sc)('nome'); } }
    if (sc.indexOf('porta:') === 0 && (k === 'aberta' || k === 'trancada')) atualizarPorta(sc.slice(6), k);
    if (sc.indexOf('pino:') === 0 && k === 'tipo') { renderMapa(); renderEsq('manter'); }
    if (sc.indexOf('pino:') === 0 && (k === 'nome' || k === 'desc' || k === 'efeitos' || k === 'camera')) {
      $$('.cena-bloco[data-sc="' + sc + '"]').forEach((b) => {
        window.GR_CENA.atualizar(b, dadosCena(sc));
        /* trocar a câmera é escolher um movimento: mostra o movimento escolhido */
        if (k === 'camera') window.GR_CENA.tocar(b);
      });
    }
    if (sc.indexOf('pino:') === 0 && k === 'nome') { const n = $('[data-nome-sel]'); if (n) n.textContent = leitor(sc)('nome'); }
    if (sc.indexOf('sala:') === 0 && k === 'nome') { renderMapa(); const n = $('[data-nome-sel]'); if (n) n.textContent = leitor(sc)('nome'); }
    if (sc === 'mesa' && k === 'mudo') { E.mudo = leitor('mesa')('mudo'); $('#dir-topo').innerHTML = topoDir(); }
  }

  function aoClicar(ev) {
    const alvo = ev.target.closest('button, [data-acao], .alvo, [data-fundo]');
    if (popAberto && !ev.target.closest('.pop') && (!alvo || alvo !== popAberto.gatilho)) fecharPop();
    if (!alvo) return;

    if (alvo.classList.contains('ferr')) { armar(alvo.dataset.ferr, ev.detail === 0 ? 'teclado' : 'mouse'); return; }
    if (alvo.closest('#mapa')) { cliqueNoMapa(ev, alvo); return; }

    const tipo = alvo.dataset.tipo;
    if (tipo === 'seg') {
      const grupo = alvo.parentElement;
      $$('[role="radio"]', grupo).forEach((b) => { const s = b === alvo; b.setAttribute('aria-checked', String(s)); b.tabIndex = s ? 0 : -1; });
      aoMudarValor(alvo, alvo.dataset.v);
      return;
    }
    if (tipo === 'liga') {
      const v = alvo.getAttribute('aria-checked') !== 'true';
      alvo.setAttribute('aria-checked', String(v));
      aoMudarValor(alvo, v);
      return;
    }
    if (tipo === 'multi') {
      const v = alvo.getAttribute('aria-pressed') !== 'true';
      alvo.setAttribute('aria-pressed', String(v));
      const sc = alvo.dataset.sc;
      const atual = (VAL[sc] && VAL[sc][alvo.dataset.k]) || [];
      aoMudarValor(alvo, v ? atual.concat(alvo.dataset.v) : atual.filter((x) => x !== alvo.dataset.v));
      return;
    }
    if (tipo === 'num') {
      const out = alvo.parentElement.querySelector('output');
      const novo = Math.max(Number(alvo.dataset.min), Math.min(Number(alvo.dataset.max), Number(out.textContent) + Number(alvo.dataset.passo)));
      out.textContent = novo;
      aoMudarValor(alvo, novo);
      if (alvo.dataset.k === 'vidaMax') atualizarVida(alvo.dataset.sc);
      return;
    }
    if (tipo === 'vida') {
      const sc = alvo.dataset.sc;
      const g = leitor(sc);
      VAL[sc].vida = Math.max(0, Math.min(g('vidaMax'), g('vida') + Number(alvo.dataset.passo)));
      atualizarVida(sc);
      return;
    }
    if (tipo === 'extra') {
      const sc = alvo.dataset.sc;
      VAL[sc][alvo.dataset.k] = (VAL[sc][alvo.dataset.k] || []).concat(alvo.dataset.v);
      renderEsq('manter');
      const campos = $$('#esq-corpo [data-ficha$="/extras"] input');
      if (campos.length) campos[campos.length - 1].focus();
      return;
    }
    acao(alvo.dataset.acao, alvo, ev);
  }

  function atualizarVida(sc) {
    const g = leitor(sc);
    const num = $('[data-vida="' + sc + '"]');
    if (!num) return;
    num.textContent = g('vida') + ' / ' + g('vidaMax');
    const barra = num.closest('.campo').querySelector('.vida__barra');
    barra.setAttribute('aria-valuenow', g('vida'));
    barra.setAttribute('aria-valuemax', g('vidaMax'));
    barra.firstElementChild.style.transform = 'scaleX(' + Math.max(0, Math.min(1, g('vida') / g('vidaMax'))) + ')';
    const resumo = num.closest('.ficha').querySelector('.ficha__resumo');
    if (resumo) resumo.textContent = g('vida') + ' / ' + g('vidaMax');
  }

  function cliqueNoMapa(ev, alvo) {
    const tipo = alvo.dataset.tipo;
    if (tipo && alvo.dataset.id) { selecionar(tipo, alvo.dataset.id, 'mouse'); return; }
    if (E.ferr === 'selecionar') { deselecionar(); return; }
    const p = pontoNoMapa(ev.clientX, ev.clientY);
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'carimbo');
    g.innerHTML = '<circle cx="' + p.x + '" cy="' + p.y + '" r="16" fill="rgba(224,164,74,0.16)" stroke="#e0a44a" stroke-width="1.5" stroke-dasharray="3 3"/>';
    $('#mapa').appendChild(g);
    setTimeout(() => g.remove(), 650);
    if (!E.avisouFerr[E.ferr]) { E.avisouFerr[E.ferr] = true; aviso('Protótipo: com ' + itemBarra(E.ferr).rot + ' armada, aqui o app desenha no mapa.'); }
  }

  /* clique com detail 0 veio de Enter/Espaço ou de click() disparado por tecla: troca sem animar */
  const peloTeclado = (ev) => !!ev && ev.detail === 0;

  function acao(nome, alvo, ev) {
    switch (nome) {
      case 'ficha': {
        const f = alvo.closest('.ficha');
        const abre = !f.classList.contains('e-aberta');
        f.classList.toggle('e-aberta', abre);
        alvo.setAttribute('aria-expanded', String(abre));
        const corpo = f.querySelector('.ficha__corpo');
        if (abre) corpo.removeAttribute('inert'); else corpo.setAttribute('inert', '');
        E.abertas[f.dataset.ficha] = abre;
        return;
      }
      case 'marcador-esq': {
        const pag = alvo.dataset.pagEsq;
        if (E.esqRecolhido) { recolher('esq', false); if (pag === E.pagEsq) return; }
        if (pag === E.pagEsq) return;
        E.pagEsq = pag;
        if (pag !== 'ficha') E.sub = null;
        renderEsq(peloTeclado(ev) ? 'instante' : 'anima');
        return;
      }
      case 'marcador-dir': {
        const pag = alvo.dataset.pagDir;
        if (E.dirRecolhido) { recolher('dir', false); if (pag === E.pagDir) return; }
        if (pag === E.pagDir) return;
        E.pagDir = pag;
        renderDir(peloTeclado(ev) ? 'instante' : 'anima');
        return;
      }
      case 'recolher-esq': recolher('esq', !E.esqRecolhido); return;
      case 'recolher-dir': recolher('dir', !E.dirRecolhido); return;
      case 'ir-esq': E.pagEsq = alvo.dataset.pag; renderEsq(peloTeclado(ev) ? 'instante' : 'anima'); return;
      case 'selecionar': selecionar(alvo.dataset.tipo, alvo.dataset.id, peloTeclado(ev) ? 'teclado' : 'mouse'); return;
      case 'sub': E.sub = alvo.dataset.sub; renderEsq(peloTeclado(ev) ? 'instante' : 'lado'); return;
      case 'voltar-sub': E.sub = null; renderEsq(peloTeclado(ev) ? 'instante' : 'anima'); return;
      case 'apagar': apagarSelecionado(); return;
      case 'mais-acoes': {
        const o = objeto(E.sel.tipo, E.sel.id);
        const def = TIPOS[E.sel.tipo](o);
        const mais = typeof def.mais === 'function' ? def.mais(leitor(E.sel.tipo + ':' + o.id)) : def.mais;
        abrirPop(alvo, mais.map((m) => m.acao ? itemMenu(m.rot, m.ic, m.acao) : m[2] === null ? '<button type="button" role="menuitem" class="menu__item" disabled>' + ic(m[1]) + '<span>' + m[0] + '<small>' + m[3] + '</small></span></button>' : itemMenu(m[0], m[1], 'aviso', 'data-msg="' + esc(m[2]) + '"')).join(''), 'baixo', 'Mais ações');
        return;
      }
      case 'aviso': fecharPop(); aviso(alvo.dataset.msg); return;
      case 'porta-alternar': {
        fecharPop();
        const nova = alternarPorta(E.sel.id);
        aviso(nova === 'aberta' ? 'Porta aberta.' : 'Porta fechada.');
        return;
      }
      case 'porta-trancar': {
        fecharPop();
        const sc = 'porta:' + E.sel.id;
        VAL[sc] = VAL[sc] || {};
        VAL[sc].trancada = !leitor(sc)('trancada');
        atualizarPorta(E.sel.id, 'trancada');
        renderEsq('manter');
        aviso(VAL[sc].trancada ? 'Porta trancada.' : 'Porta destrancada.');
        return;
      }
      case 'alavanca-acionar': {
        const nome = leitor('pino:' + E.sel.id)('portaAlv');
        const p = MAPA.portas.find((x) => x.nome === nome);
        if (!p) return;
        const nova = alternarPorta(p.id);
        aviso('Alavanca acionada: ' + nome + (nova === 'aberta' ? ' aberta.' : ' fechada.'));
        return;
      }
      case 'rec-menu': {
        const sc = 'pino:' + E.sel.id;
        const def = TIPOS.pino(objeto('pino', E.sel.id));
        const ligados = leitor(sc)('recursos') || [];
        abrirPop(alvo, '<p class="menu__rot">Adicionar ao pino</p>' + def.recursos.itens.filter((i) => ligados.indexOf(i.id) < 0).map((i) => '<button type="button" role="menuitem" class="menu__item" data-acao="rec-por" data-rec="' + i.id + '">' + ic(i.ic) + '<span>' + esc(i.rot) + '<small>' + esc(i.desc) + '</small></span></button>').join(''), 'baixo', 'Adicionar ao pino');
        return;
      }
      case 'rec-por': {
        fecharPop(true);
        const sc = 'pino:' + E.sel.id;
        const id = alvo.dataset.rec;
        VAL[sc].recursos = (VAL[sc].recursos || []).concat(id);
        E.abertas[sc + '/rec-' + id] = true;
        /* pelo teclado entra na hora, como o resto do Grimório */
        E.recNovo = peloTeclado(ev) ? null : id;
        renderEsq('manter');
        E.recNovo = null;
        const cab = $('#esq-corpo [data-ficha="' + sc + '/rec-' + id + '"] .ficha__cab');
        if (cab) { cab.focus({ preventScroll: true }); cab.scrollIntoView({ block: 'nearest', behavior: peloTeclado(ev) || reduzido() ? 'auto' : 'smooth' }); }
        return;
      }
      case 'rec-tirar': {
        const sc = 'pino:' + E.sel.id;
        const id = alvo.dataset.rec;
        const antes = (VAL[sc].recursos || []).slice();
        const onde = antes.indexOf(id);
        VAL[sc].recursos = antes.filter((x) => x !== id);
        renderEsq('manter');
        const mais = $('#esq-corpo .rec-mais');
        if (mais) mais.focus({ preventScroll: true });
        const it = TIPOS.pino(objeto('pino', E.sel.id)).recursos.itens.find((x) => x.id === id);
        /* os valores do recurso ficam guardados: desfazer devolve tudo como estava */
        aviso('"' + it.rot + '" saiu do pino.', 'Desfazer', () => {
          const l = (VAL[sc].recursos || []).slice();
          if (l.indexOf(id) >= 0) return;
          l.splice(Math.min(onde, l.length), 0, id);
          VAL[sc].recursos = l;
          if (E.sel && E.sel.tipo + ':' + E.sel.id === sc && E.pagEsq === 'ficha' && !E.sub) renderEsq('manter');
        });
        return;
      }
      case 'cena-tocar': window.GR_CENA.alternar(alvo.closest('.cena-bloco')); return;
      case 'cena-grande': {
        const sc = alvo.closest('.cena-bloco').dataset.sc;
        window.GR_CENA.parar(alvo.closest('.cena-bloco'));
        abrirDialogo('Animação do cenário · ' + esc(leitor(sc)('nome') || ''), window.GR_CENA.html(Object.assign(dadosCena(sc), { sc: sc, grande: true })), 'dlg--cena');
        window.GR_CENA.tocar($('.dlg .cena-bloco'));
        return;
      }
      case 'cor-padrao': {
        const sc = alvo.dataset.sc;
        VAL[sc][alvo.dataset.k] = alvo.dataset.v;
        refletir(sc, alvo.dataset.k);
        renderEsq('manter');
        return;
      }
      case 'novo-token':
        E.pagEsq = 'ficha'; E.sel = null; E.sub = null; E.novoToken = true;
        if (E.esqRecolhido) recolher('esq', false);
        renderMapa(); renderEsq('anima');
        setTimeout(() => { const i = $('#novo-nome'); if (i) i.focus(); }, 0);
        return;
      case 'cancelar-token': E.novoToken = false; renderEsq('instante'); return;
      case 'procurar': focarBusca(); return;
      case 'config': abrirConfig(alvo.dataset.pag === 'config' ? 2 : 0); return;
      case 'cfg-secao': abrirConfig(Number(alvo.dataset.v)); return;
      case 'atalhos': abrirAtalhos(); return;
      case 'onde': abrirOnde(); return;
      case 'fechar-dlg': fecharDialogo(); return;
      case 'desfazer': desfazer(); return;
      case 'refazer': aviso('Nada para refazer.'); return;
      case 'salvar': aviso('Mapa salvo.'); return;
      case 'arquivo':
        abrirPop(alvo, itemMenu('Abrir…', 'arquivo', 'aviso', 'data-msg="No app, abre a escolha de mapa."') + itemMenu('Importar mapa (pasta)…', 'importar', 'aviso', 'data-msg="No app, abre a escolha de pasta."') + itemMenu('Exportar mapa (pasta)…', 'exportar', 'aviso', 'data-msg="Mapa exportado para uma pasta."') + itemMenu('Exportar imagem (PNG)…', 'imagem', 'aviso', 'data-msg="Imagem do mapa exportada."') +
          '<div class="menu__sep"></div><div class="menu__rot">Imagem de fundo e conversão</div>' + itemMenu('Trocar imagem de fundo…', 'imagem', 'aviso', 'data-msg="No app, abre a escolha de imagem de fundo."') + itemMenu('Chão a partir da imagem', 'varinha', 'aviso', 'data-msg="Chão gerado a partir da imagem."') + itemMenu('Linhas e portas a partir da imagem', 'varinha', 'aviso', 'data-msg="Linhas e portas geradas a partir da imagem."') + itemMenu('Recriar minimapa completo', 'varinha', 'aviso', 'data-msg="Minimapa recriado."') +
          '<div class="menu__sep"></div>' + itemMenu('Voltar ao início', 'casa', 'aviso', 'data-msg="No app, volta à tela inicial."'), 'dir', 'Arquivo');
        return;
      case 'cena-chip':
        abrirPop(alvo, '<div class="menu__rot">Porto</div>' + itemMenu('Porto de Tasmaturi', 'cena', 'aviso', 'data-msg="Você já está nesta cena."') + itemMenu('Armazém 3', 'cena', 'aviso', 'data-msg="No app, abre a cena Armazém 3."') + itemMenu('Navio Carcará', 'cena', 'aviso', 'data-msg="No app, abre a cena Navio Carcará."') + '<div class="menu__rot">Cidade Alta</div>' + itemMenu('Praça da Cidade Alta', 'cena', 'aviso', 'data-msg="No app, abre a cena Praça da Cidade Alta."') + itemMenu('Torre do sino', 'cena', 'aviso', 'data-msg="No app, abre a cena Torre do sino."') + '<div class="menu__sep"></div>' + itemMenu('Ver todas as cenas', 'cenas', 'visao-geral'), 'baixo', 'Trocar de cena');
        return;
      case 'voltar-cena': aviso('No app, volta para a cena anterior: ' + E.ultimaCena + '.'); return;
      case 'visao-geral': {
        fecharPop(true);
        const cards = SALA.cenas.map((p) => '<h3 class="titulo-secao">' + p.pasta + '</h3><div class="cartoes" style="grid-template-columns:repeat(4,1fr)">' + p.itens.map((c) => '<button type="button" class="cartao' + (c[3] ? ' e-ligado' : '') + '" data-acao="aviso" data-msg="No app, abre a cena ' + esc(c[0]) + '.">' + ic('cena', 'ic--g') + '<span class="cartao__rot">' + esc(c[0]) + '</span><span class="cartao__resumo">' + (c[1] ? c[1] + ' jogadores' : 'Vazia') + '</span></button>').join('') + '</div>').join('');
        abrirDialogo('Todas as cenas', cards);
        return;
      }
      case 'enquadrar': {
        const s = MAPA.salas.find((x) => x.id === alvo.dataset.id);
        const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        r.setAttribute('class', 'pulso-local');
        ['x', 'y', 'width', 'height'].forEach((a, i) => r.setAttribute(a, [s.x - 6, s.y - 6, s.w + 12, s.h + 12][i]));
        r.setAttribute('rx', '6');
        $('#mapa').appendChild(r);
        setTimeout(() => r.remove(), 950);
        return;
      }
      case 'camada': {
        const c = alvo.dataset.camada;
        if (E.camadasOff.has(c)) E.camadasOff.delete(c); else E.camadasOff.add(c);
        renderMapa(); renderEsq('manter');
        return;
      }
      case 'apito': E.agenda.apito = E.agenda.apito >= 6 ? 1 : E.agenda.apito + 1; if (E.agenda.apito === 1) E.agenda.dia += 1; renderEsq('manter'); aviso('Dia ' + E.agenda.dia + ', ' + E.agenda.apito + 'º apito.'); return;
      case 'dia': E.agenda.dia += 1; E.agenda.apito = 1; renderEsq('manter'); aviso('Dia ' + E.agenda.dia + ' começou.'); return;
      case 'acervo-aba': E.acervoAba = alvo.dataset.v; renderEsq('manter'); return;
      case 'pasta': E.pastas[alvo.dataset.v] = !E.pastas[alvo.dataset.v]; renderEsq('manter'); return;
      case 'por-no-mapa': {
        const [nome, cor] = alvo.dataset.v.split('|');
        const id = novoTokenNoMapa(nome, cor, 600 + Math.random() * 80, 300 + Math.random() * 60);
        selecionar('token', id, 'acervo');
        aviso(nome + ' está no mapa. A ficha dele está no marcador Ficha.');
        return;
      }
      case 'guardar-token': aviso(nomeDoSelecionado() + ' guardado no Acervo, pasta NPCs.'); return;
      case 'abrir-sala':
        E.sala = true; E.brilhar = true; E.pagDir = 'grupo';
        if (E.dirRecolhido) recolher('dir', false);
        renderDir('anima');
        E.brilhar = false;
        aviso('Sala aberta. Passe o código ' + SALA.codigo + ' para os jogadores.');
        if (E.sel && E.pagEsq === 'ficha') renderEsq('manter');
        return;
      case 'copiar-codigo': aviso('Código ' + SALA.codigo + ' copiado.'); return;
      case 'laser': E.laser = !E.laser; alvo.setAttribute('aria-pressed', String(E.laser)); aviso(E.laser ? 'Laser ligado: clique no mapa para apontar.' : 'Laser desligado.'); return;
      case 'som':
        semear('mesa', [{ k: 'vol', v: 70 }, { k: 'mudo', v: false }]);
        abrirPop(alvo, '<p class="pop__tit">Som da mesa</p><div class="pop__corpo">' + campo({ t: 'faixa', k: 'vol', rot: 'Sons de clima neste PC', min: 0, max: 100, un: '%' }, 'mesa') + campo({ t: 'liga', k: 'mudo', rot: 'Mudo' }, 'mesa') + '</div>', 'esq', 'Som da mesa');
        return;
      case 'convidar':
        abrirPop(alvo, '<p class="pop__tit">Convidar jogadores</p><div class="pop__corpo"><div class="qr" aria-label="QR code do endereço" role="img">' + qr() + '</div>' + campo({ t: 'liga', k: 'tunel', rot: 'Link público (fora da rede local)' }, 'mesa') + '<div class="campo"><span class="campo__rot">Na rede local</span><div class="linha"><input class="entrada" readonly value="http://192.168.0.20:5173" aria-label="Endereço na rede local"><button type="button" class="bt bt--ic" aria-label="Copiar endereço" data-acao="aviso" data-msg="Endereço copiado.">' + ic('copiar') + '</button></div></div><p class="nota">O celular não abre? Libere o app no Firewall do Windows (rede Privada).</p></div>', 'esq', 'Convidar jogadores');
        return;
      case 'rede':
        abrirPop(alvo, '<p class="pop__tit">Rede local</p><div class="pop__corpo"><p class="nota" style="font-size:13px;color:var(--lb-color-parchment-dim)">Se o celular não abrir o link, libere o app no Firewall do Windows (rede Privada).</p></div>', 'baixo', 'Rede local');
        return;
      case 'menu-sala':
        abrirPop(alvo, itemMenu('Visão de jogador…', 'olho', 'visao-jogador') + itemMenu(E.npcsPausados ? 'Retomar os NPCs' : 'Pausar todos os NPCs', 'pausa', 'pausa-npcs') + '<div class="menu__sep"></div>' + itemMenu('Fechar sala…', 'dispensar', 'fechar-sala', '', 'menu__item--perigo'), 'baixo', 'Mais da sala');
        return;
      case 'fechar-sala':
        fecharPop(true);
        abrirDialogo('Fechar a sala?', '<p style="margin:0 0 16px;color:var(--lb-color-parchment-dim)">Os 4 jogadores conectados saem da mesa. O mapa e as fichas ficam como estão.</p><div class="acoes"><button type="button" class="bt bt--perigo" data-acao="confirma-fechar">Fechar sala</button><button type="button" class="bt bt--fantasma" data-acao="fechar-dlg">Continuar jogando</button></div>', 'dlg--p');
        return;
      case 'confirma-fechar': fecharDialogo(); E.sala = false; E.laser = false; renderDir('anima'); if (E.pagEsq === 'ficha') renderEsq('manter'); aviso('Sala fechada.'); return;
      case 'visao-jogador': fecharPop(true); aviso('No app, abre a janela de teste com a visão da ficha escolhida. Só você vê.'); return;
      case 'livro': aviso('No app, abre o livro de regras do sistema.'); return;
      case 'pausa-npcs': fecharPop(true); E.npcsPausados = !E.npcsPausados; renderDir('manter'); aviso(E.npcsPausados ? 'Todos os NPCs pararam.' : 'NPCs andando de novo.'); return;
      case 'filtro-pedindo': E.soPedindo = !E.soPedindo; renderDir('manter'); return;
      case 'atribuir': {
        const id = alvo.dataset.id;
        abrirPop(alvo, '<div class="menu__rot">Fichas sem dono</div>' + ['Capitã Iara', 'Estivador', 'Gato do porto'].map((n) => itemMenu(n, 'token', 'atribuir-ficha', 'data-id="' + id + '" data-v="' + n + '"')).join(''), 'esq', 'Atribuir ficha');
        return;
      }
      case 'atribuir-ficha': {
        const c = E.chegando.find((x) => x.id === alvo.dataset.id);
        E.chegando = E.chegando.filter((x) => x.id !== alvo.dataset.id);
        E.jogadores.push({ id: c.id, nome: c.nome, ficha: alvo.dataset.v, cor: '#e0a44a', cena: 'Porto de Tasmaturi', on: true });
        fecharPop(true); renderDir('manter'); aviso(c.nome + ' agora joga com ' + alvo.dataset.v + '.');
        return;
      }
      case 'jogador': E.jogadorAberto = E.jogadorAberto === alvo.dataset.id ? null : alvo.dataset.id; E.jogTab = 'acoes'; renderDir('manter'); return;
      case 'jog-tab': E.jogTab = alvo.dataset.v; renderDir('manter'); return;
      case 'pedido': {
        const card = alvo.closest('.pedido');
        E.pedidoFeito = true;
        aviso(alvo.dataset.v);
        if (reduzido()) { renderDir('manter'); return; }
        card.classList.add('sai');
        setTimeout(() => renderDir('manter'), 170);
        return;
      }
      case 'congelar-cena': E.cenasCongeladas[alvo.dataset.v] = !E.cenasCongeladas[alvo.dataset.v]; renderDir('manter'); aviso((E.cenasCongeladas[alvo.dataset.v] ? 'Cena congelada: ' : 'Cena descongelada: ') + alvo.dataset.v + '.'); return;
      case 'pausar-cena': E.cenasPausadas[alvo.dataset.v] = !E.cenasPausadas[alvo.dataset.v]; renderDir('manter'); aviso((E.cenasPausadas[alvo.dataset.v] ? 'Cena pausada: ' : 'Cena retomada: ') + alvo.dataset.v + '.'); return;
      case 'congelar-todos': E.congelados = !E.congelados; renderDir('manter'); aviso(E.congelados ? 'Todos congelados.' : 'Todos descongelados.'); return;
      case 'menu-conta': abrirPop(alvo, itemMenu('Trocar PIN…', 'cadeado', 'aviso', 'data-msg="No app, abre a troca de PIN de ' + esc(alvo.dataset.v) + '."') + itemMenu('Aparelhos lembrados', 'monitor', 'aviso', 'data-msg="No app, lista os aparelhos de ' + esc(alvo.dataset.v) + '."') + itemMenu('Personagens desta conta', 'ficha', 'aviso', 'data-msg="No app, lista os personagens de ' + esc(alvo.dataset.v) + '."') + '<div class="menu__sep"></div>' + itemMenu('Apagar conta…', 'lixo', 'aviso', 'data-msg="No app, pede confirmação antes de apagar a conta."', 'menu__item--perigo'), 'esq', 'Conta de ' + alvo.dataset.v); return;
      case 'menu-cena': {
        const c = alvo.dataset.v;
        const m = (r, i) => itemMenu(r, i, 'aviso', 'data-msg="' + esc(r.replace('…', '')) + ': ' + esc(c) + '."');
        abrirPop(alvo, m('Renomear…', 'texto') + m('Recado para quem está na cena…', 'carta') + m('Abalo…', 'abalo') + m('Alarme', 'sino') + m('Pausar', 'pausa') + m('Planta conhecida por todos', 'olho') + m('Revelar planta para…', 'olho') + '<div class="menu__sep"></div>' + m('Duplicar', 'copiar') + m('Mover para dentro de…', 'pasta') + itemMenu('Apagar…', 'lixo', 'aviso', 'data-msg="No app, pede confirmação antes de apagar a cena."', 'menu__item--perigo'), 'esq', 'Cena ' + c);
        return;
      }
      /* jogador */
      case 'j-painel':
        E.folhaAberta = !E.folhaAberta;
        $('#folha').classList.toggle('e-fechada', !E.folhaAberta);
        if (E.folhaAberta) $('#folha').removeAttribute('inert'); else $('#folha').setAttribute('inert', '');
        alvo.setAttribute('aria-expanded', String(E.folhaAberta));
        alvo.querySelector('svg').outerHTML = ic(E.folhaAberta ? 'cima' : 'baixo');
        return;
      case 'j-minha': aviso('A câmera centralizou em Vagn.'); return;
      case 'j-inv': abrirDialogo('Inventário de Vagn', '<div class="lista">' + JOGADOR.comigo.map((c) => '<div class="item"><span class="item__txt"><span class="item__nome">' + c[0] + '</span><span class="item__sub">' + c[1] + '</span></span></div>').join('') + '</div><p class="nota" style="margin-top:10px">O inventário completo não foi redesenhado nesta proposta.</p>', 'dlg--p'); return;
      case 'j-ficha': abrirDialogo('Ficha de Vagn', '<p class="nota" style="font-size:13px">A ficha do sistema de RPG abre aqui. Ela não foi redesenhada nesta proposta.</p>', 'dlg--p'); return;
      case 'j-aba': {
        if (E.jogAba === alvo.dataset.v) return;
        E.jogAba = alvo.dataset.v;
        $$('.aba').forEach((a) => { const s = a === alvo; a.setAttribute('aria-selected', String(s)); a.tabIndex = s ? 0 : -1; });
        moverIndicadorAba(!peloTeclado(ev));
        renderCorpoJogador(!peloTeclado(ev));
        return;
      }
      case 'j-acao': {
        const v = alvo.dataset.v;
        if (v === 'marcacoes') {
          abrirPop(alvo, itemMenu('Marcar destino', 'pino', 'aviso', 'data-msg="Toque no mapa para marcar o destino."') + itemMenu('Anotar', 'caderno', 'aviso', 'data-msg="Toque no mapa para anotar."') + itemMenu('Deixar marca aqui…', 'marcador', 'aviso', 'data-msg="Escreva o bilhete da marca."') + itemMenu('Tirar marca', 'x', 'aviso', 'data-msg="Marca tirada."'), 'baixo', 'Marcações');
          return;
        }
        E.jogAcao = E.jogAcao === v ? null : v;
        $$('.peca[aria-pressed]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === E.jogAcao)));
        const dica = $('#dica-acao');
        const a = JOGADOR.acoes.find((x) => x[0] === E.jogAcao);
        dica.textContent = a ? a[3] : 'Escolha uma ação e toque no mapa.';
        return;
      }
      case 'j-mostrar': abrirPop(alvo, '<div class="menu__rot">Quem está na cena</div>' + itemMenu('Nami', 'pessoa', 'aviso', 'data-msg="Nami está vendo o seu mapa."'), 'cima', 'Mostrar meu mapa a'); return;
      case 'j-volto': E.voltoJa = !E.voltoJa; alvo.setAttribute('aria-checked', String(E.voltoJa)); aviso(E.voltoJa ? 'O mestre sabe que você volta já.' : 'Bem-vindo de volta.'); return;
      case 'j-sair': abrirDialogo('Sair da sala?', '<p style="margin:0 0 16px;color:var(--lb-color-parchment-dim)">Você sai da sala e deste aparelho. Sua ficha fica com o mestre.</p><div class="acoes"><button type="button" class="bt bt--perigo" data-acao="aviso" data-msg="No app, você sairia da sala.">Sair</button><button type="button" class="bt bt--fantasma" data-acao="fechar-dlg">Ficar</button></div>', 'dlg--p'); return;
      case 'j-chamar': aviso('O mestre foi chamado.'); return;
      case 'rolar': {
        const g = leitor('dados');
        const faces = Number(String(g('dado')).slice(1));
        const rol = Array.from({ length: g('qtd') }, () => 1 + Math.floor(Math.random() * faces));
        const total = rol.reduce((a, b) => a + b, 0) + g('mod');
        E.rolagens.forEach((r) => { r.nova = false; });
        E.rolagens.unshift({ total: total, desc: g('qtd') + g('dado') + (g('mod') ? (g('mod') > 0 ? ' + ' : ' − ') + Math.abs(g('mod')) : '') + (g('escondido') ? ', escondido' : ''), det: '[' + rol.join(', ') + ']', nova: true });
        E.rolagens = E.rolagens.slice(0, 5);
        renderCorpoJogador(false);
        return;
      }
      case 'tela': trocarTela(alvo.dataset.v); return;
      default:
    }
  }

  function qr() {
    let h = '';
    let semente = 7;
    for (let i = 0; i < 441; i++) {
      const x = i % 21;
      const y = Math.floor(i / 21);
      const canto = (a, b) => x >= a && x < a + 7 && y >= b && y < b + 7;
      let cheio;
      if (canto(0, 0) || canto(14, 0) || canto(0, 14)) {
        const lx = x < 7 ? x : x - 14;
        const ly = y < 7 ? y : y - 14;
        cheio = lx === 0 || ly === 0 || lx === 6 || ly === 6 || (lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4);
      } else { semente = (semente * 9301 + 49297) % 233280; cheio = semente / 233280 > 0.52; }
      h += '<i' + (cheio ? '' : ' class="b"') + '></i>';
    }
    return h;
  }

  function focarBusca() {
    E.pagEsq = 'cena';
    if (E.esqRecolhido) recolher('esq', false);
    renderEsq('instante');
    const b = $('#busca-mapa');
    if (b) b.focus();
  }

  function aoDigitar(ev) {
    const t = ev.target;
    if (t.dataset.busca === 'mapa') { E.buscaMapa = t.value; $('#resultados').innerHTML = '<div class="entra-lista">' + resultadosBusca(t.value) + '</div>'; return; }
    if (t.dataset.busca === 'pinos') { const q = t.value.toLowerCase(); $$('[data-lista-pinos] .item').forEach((i) => { i.hidden = q && i.dataset.nome.indexOf(q) < 0; }); return; }
    if (t.dataset.busca === 'jogador') { const q = t.value.toLowerCase(); $$('[data-nome-jog]').forEach((i) => { i.hidden = q && i.dataset.nomeJog.indexOf(q) < 0; }); return; }
    if (t.dataset.busca === 'cenas') { const q = t.value.toLowerCase(); $$('[data-nome-cena]').forEach((i) => { i.hidden = q && i.dataset.nomeCena.indexOf(q) < 0; }); return; }
    if (t.dataset.tipo === 'faixa') {
      const out = document.getElementById(t.id + 'o');
      if (out) out.textContent = t.value + (t.dataset.un ? ' ' + t.dataset.un : '');
      VAL[t.dataset.sc] = VAL[t.dataset.sc] || {};
      VAL[t.dataset.sc][t.dataset.k] = Number(t.value);
      return;
    }
    if (t.dataset.tipo === 'texto') aoMudarValor(t, t.value);
  }

  function aoMudar(ev) {
    const t = ev.target;
    if (t.dataset.tipo === 'sel') aoMudarValor(t, t.value);
    if (t.dataset.tipo === 'faixa') aoMudarValor(t, Number(t.value));
  }

  function aoEnviar(ev) {
    const f = ev.target;
    ev.preventDefault();
    if (f.dataset.form === 'novo-token') {
      const nome = $('#novo-nome').value.trim();
      if (!nome) { $('#novo-nome').focus(); aviso('Escreva um nome para o token.'); return; }
      const id = novoTokenNoMapa(nome, '#a2a09a', 640, 360);
      E.novoToken = false;
      selecionar('token', id, 'mouse');
      aviso(nome + ' criado no centro do mapa.');
    }
    if (f.dataset.form === 'chat') {
      const i = $('#msg-mestre');
      if (!i.value.trim()) return;
      E.msgs.forEach((m) => { m.nova = false; });
      E.msgs.push({ quem: 'Mestre', cor: '#e0a44a', cena: 'Todas as cenas', txt: i.value.trim(), nova: true });
      renderDir('manter');
      const c = $('#dir-corpo');
      c.scrollTop = c.scrollHeight;
      $('#msg-mestre').focus();
    }
    if (f.dataset.form === 'chat-j') {
      const i = $('#msg-j');
      if (!i.value.trim()) return;
      E.jogMsgs.forEach((m) => { m.nova = false; });
      E.jogMsgs.push({ quem: 'Vagn', cor: '#79a9cc', txt: i.value.trim(), nova: true });
      renderCorpoJogador(false);
      $('#msg-j').focus();
    }
  }

  function aoTeclar(ev) {
    const t = ev.target;
    const digitando = t.matches && t.matches('input, textarea, select');
    const ctrl = ev.ctrlKey || ev.metaKey;
    if (ev.key === 'Escape') {
      if (popAberto) { const g = popAberto.gatilho; fecharPop(); g.focus(); return; }
      if (dlgAberto) { fecharDialogo(); return; }
      if (digitando) { t.blur(); return; }
      if (E.tela !== 'editor') return;
      if (E.novoToken) { E.novoToken = false; renderEsq('instante'); return; }
      if (E.sub) { E.sub = null; renderEsq('instante'); return; }
      deselecionar();
      return;
    }
    if (t.getAttribute && t.getAttribute('role') === 'radio' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(ev.key)) {
      const irmaos = $$('[role="radio"]', t.parentElement);
      const i = irmaos.indexOf(t);
      const n = irmaos[(i + (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 1) + irmaos.length) % irmaos.length];
      n.focus();
      n.click();
      ev.preventDefault();
      return;
    }
    if (t.getAttribute && t.getAttribute('role') === 'tab' && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) {
      const abas = $$('.aba');
      const n = abas[(abas.indexOf(t) + (ev.key === 'ArrowLeft' ? -1 : 1) + abas.length) % abas.length];
      n.focus(); n.click(); ev.preventDefault();
      return;
    }
    if (t.classList && t.classList.contains('marcador') && (ev.key === 'ArrowUp' || ev.key === 'ArrowDown')) {
      const ms = $$('.marcador', t.parentElement);
      const n = ms[(ms.indexOf(t) + (ev.key === 'ArrowUp' ? -1 : 1) + ms.length) % ms.length];
      n.focus(); n.click(); ev.preventDefault();
      return;
    }
    if (E.tela === 'jogador') {
      if (!digitando && !dlgAberto && ev.key.toLowerCase() === 'i' && !ctrl) { acao('j-inv', $('[data-acao="j-inv"]')); }
      return;
    }
    if (ctrl && ev.key.toLowerCase() === 'k') { ev.preventDefault(); focarBusca(); return; }
    if (ctrl && ev.key.toLowerCase() === 's') { ev.preventDefault(); aviso('Mapa salvo.'); return; }
    if (digitando || dlgAberto) {
      if (t.dataset && t.dataset.busca === 'mapa' && ev.key === 'Enter') {
        const primeiro = $('#resultados [data-acao="selecionar"]');
        if (primeiro) {
          ev.preventDefault();
          if (ev.shiftKey && E.sala) aviso('No app, a ficha vem para cá.');
          else { primeiro.click(); }
        }
      }
      return;
    }
    if (ctrl && ev.key.toLowerCase() === 'z') { ev.preventDefault(); desfazer(); return; }
    if (ctrl && ev.key.toLowerCase() === 'y') { ev.preventDefault(); aviso('Nada para refazer.'); return; }
    if (ctrl || ev.altKey) return;
    if (ev.key === 'Delete' || ev.key === 'Backspace') { if (E.sel) { ev.preventDefault(); apagarSelecionado(); } return; }
    if (ev.key === '?') { abrirAtalhos(); return; }
    const k = TECLAS[ev.key.toLowerCase()];
    if (k && !ev.repeat) {
      if ((ev.target.closest && ev.target.closest('.pop'))) return;
      armar(k[0], 'teclado', k[1] ? [k[1], k[2]] : null);
    }
  }

  /* gaveta de variantes: clique direito ou segurar o botão da ferramenta */
  function abrirGaveta(bt) {
    const id = bt.dataset.ferr;
    const cv = campoVariante(id);
    if (!cv) return;
    semear('fer:' + id, FERRAMENTAS[id].campos);
    esconderBalao();
    abrirPop(bt, '<p class="pop__tit">' + itemBarra(id).rot + '</p><div class="pop__corpo">' + campo(Object.assign({}, cv, { r: 0 }), 'fer:' + id, itemBarra(id).rot) + '</div>', 'cima', 'Variantes de ' + itemBarra(id).rot);
    if (E.ferr !== id) armar(id, 'mouse');
  }

  function trocarTela(t) {
    E.tela = t;
    fecharPop(true);
    $$('.proto__alternar button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === t)));
    $('#palco').hidden = t !== 'editor';
    $('#jog').hidden = t !== 'jogador';
    if (t === 'jogador') renderJogador(); else ajustarEscala();
    try { history.replaceState(null, '', '#' + t); } catch (e) { /* sem histórico em file:// */ }
  }

  function ajustarEscala() {
    const palco = $('#palco');
    const caixa = $('#escala');
    const w = palco.clientWidth;
    const h = palco.clientHeight;
    const s = w < LARGURA_MINIMA_EDITOR ? w / LARGURA_MINIMA_EDITOR : 1;
    caixa.style.width = w / s + 'px';
    caixa.style.height = h / s + 'px';
    caixa.style.transform = s < 1 ? 'scale(' + s + ')' : 'none';
    moverPlaca(false);
    marcadores('esq', E.pagEsq, false);
    marcadores('dir', E.pagDir, false);
  }

  /* ================================================================ INÍCIO */
  function iniciar() {
    const params = new URLSearchParams(location.search);
    if (params.has('limpo')) document.body.classList.add('limpo');
    $$('i[data-ic]').forEach((el) => { el.outerHTML = ic(el.dataset.ic, el.dataset.icc); });
    balao.el = $('#balao');
    renderBarra();
    renderMapa();
    renderEsq('instante');
    renderDir('instante');
    if (params.has('sala')) { E.sala = true; renderDir('instante'); }
    document.addEventListener('click', aoClicar);
    document.addEventListener('input', aoDigitar);
    document.addEventListener('change', aoMudar);
    document.addEventListener('submit', aoEnviar);
    document.addEventListener('keydown', aoTeclar);
    document.addEventListener('toggle', (ev) => { const d = ev.target; if (d.dataset && d.dataset.grupo) E.gruposAbertos[d.dataset.grupo] = d.open; }, true);
    document.addEventListener('pointerover', (ev) => { const a = ev.target.closest('[data-balao]'); if (a && a !== balao.alvo && ev.pointerType === 'mouse') mostrarBalao(a); });
    document.addEventListener('pointerout', (ev) => { const a = ev.target.closest('[data-balao]'); if (a && !a.contains(ev.relatedTarget)) esconderBalao(); });
    document.addEventListener('pointerdown', esconderBalao);
    document.addEventListener('focusin', (ev) => { const a = ev.target.closest && ev.target.closest('[data-balao]'); if (a && a.matches(':focus-visible')) mostrarBalao(a); });
    document.addEventListener('focusout', esconderBalao);

    const barra = $('#barra');
    barra.addEventListener('contextmenu', (ev) => { const b = ev.target.closest('.ferr'); if (b) { ev.preventDefault(); abrirGaveta(b); } });
    let segurar = 0;
    barra.addEventListener('pointerdown', (ev) => { const b = ev.target.closest('.ferr'); if (b && ev.button === 0) segurar = setTimeout(() => { segurar = -1; abrirGaveta(b); }, 450); });
    barra.addEventListener('pointerup', () => { if (segurar > 0) clearTimeout(segurar); segurar = 0; });
    barra.addEventListener('pointerleave', () => { if (segurar > 0) clearTimeout(segurar); });

    /* arrastar do acervo para o mapa, com o alvo aparecendo onde vai cair */
    const alvoSolta = $('#alvo-solta');
    document.addEventListener('dragstart', (ev) => { const i = ev.target.closest && ev.target.closest('[data-arrasta]'); if (!i) return; ev.dataTransfer.setData('text/plain', i.dataset.arrasta); ev.dataTransfer.effectAllowed = 'copy'; });
    const camada = $('#escala');
    camada.addEventListener('dragover', (ev) => {
      if (!ev.target.closest('#mapa')) { alvoSolta.classList.remove('vis'); return; }
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'copy';
      const r = camada.getBoundingClientRect();
      const s = r.width / camada.offsetWidth;
      alvoSolta.style.left = (ev.clientX - r.left) / s + 'px';
      alvoSolta.style.top = (ev.clientY - r.top) / s + 'px';
      alvoSolta.classList.add('vis');
    });
    camada.addEventListener('dragleave', (ev) => { if (!camada.contains(ev.relatedTarget)) alvoSolta.classList.remove('vis'); });
    camada.addEventListener('drop', (ev) => {
      alvoSolta.classList.remove('vis');
      if (!ev.target.closest('#mapa')) return;
      ev.preventDefault();
      const dado = ev.dataTransfer.getData('text/plain');
      if (!dado) return;
      const [nome, cor] = dado.split('|');
      const p = pontoNoMapa(ev.clientX, ev.clientY);
      const id = novoTokenNoMapa(nome, cor, p.x, p.y);
      selecionar('token', id, 'acervo');
      aviso(nome + ' está no mapa. A ficha dele está no marcador Ficha.');
    });
    document.addEventListener('dragend', () => alvoSolta.classList.remove('vis'));

    window.addEventListener('resize', () => { if (E.tela === 'editor') ajustarEscala(); else moverIndicadorAba(false); fecharPop(true); });
    ajustarEscala();
    trocarTela(location.hash === '#jogador' ? 'jogador' : 'editor');
    if (params.has('sel')) { const [t, i] = params.get('sel').split(':'); selecionar(t, i, 'teclado'); }
    if (params.has('ferr')) armar(params.get('ferr'), 'teclado');
    document.documentElement.dataset.pronto = '1';
  }

  window.GR_APP = { E: E, armar: armar, selecionar: selecionar, renderEsq: renderEsq };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
