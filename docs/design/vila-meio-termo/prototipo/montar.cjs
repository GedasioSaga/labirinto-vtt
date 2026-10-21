// Monta o protótipo do Meio-termo num arquivo só (vai para o Artifact), REAPROVEITANDO os dois
// protótipos anteriores sem copiar arquivo grande:
// - o telhado do app (client/src), empacotado pelo esbuild da raiz a partir de docs/design/vila/prototipo/entrada.js;
// - o pintor de objetos (docs/design/objetos/prototipo/objetos.js), com as formas e as cores internas abertas em Objetos._i;
// - vila.js e pagina.js de docs/design/vila/prototipo (a Textura), abertos em pontos conferidos;
// - mother.js de docs/design/vila-estilo-mother/prototipo, virado FÁBRICA: a mesma função gera o Estilo Mother
//   (com a paleta dele) e uma segunda cópia com a paleta do Meio-termo, que o meio.js usa;
// - meio.js (o que é novo) e fonte.html (a página), daqui.
// Cada abertura precisa casar o número exato de vezes; se um original mudar, a montagem para com erro.
// Rodar da raiz do repo: node docs/design/vila-meio-termo/prototipo/montar.cjs
const fs = require('fs')
const path = require('path')

const PASTA = __dirname
const RAIZ = path.resolve(PASTA, '..', '..', '..', '..')
const VILA = path.join(RAIZ, 'docs', 'design', 'vila', 'prototipo')
const MOTHER = path.join(RAIZ, 'docs', 'design', 'vila-estilo-mother', 'prototipo', 'mother.js')
const OBJETOS = path.join(RAIZ, 'docs', 'design', 'objetos', 'prototipo', 'objetos.js')

const ler = (arquivo) => fs.readFileSync(arquivo, 'utf8').replace(/\r\n/g, '\n')

function abrir(nome, codigo, aberturas) {
  let saida = codigo
  for (const { de, para, vezes = 1 } of aberturas) {
    const achou = saida.split(de).length - 1
    if (achou !== vezes) throw new Error(`${nome}: esperava ${vezes}x e achou ${achou}x o trecho:\n${de}`)
    saida = saida.split(de).join(para)
  }
  return saida
}

const ABERTURAS_DO_OBJETOS = [
  {
    de: 'gerarSprite, gerarAmostra, nivel, acertou,',
    para: `gerarSprite, gerarAmostra, nivel, acertou,
    // Aberto pelo montar.cjs: as mesmas formas, materiais e pintura, para as peças da vila;
    // as cores internas (prego, fechadura, cinza, chama, sombra) para o Meio-termo trocar na hora do desenho.
    _i: { P, caixa, elipse, capsula, poligono, uniao, menos, anel, barra, pintarCena, MATERIAIS, contato, rgb, escalar, misturar, hash, ruido, unir, SOMBRA_X, SOMBRA_Y,
      INTERNAS: { LENCOL, PREGO, BURACO, CINZA, CHAMA }, SOMBRA_COR },`,
  },
]

const ABERTURAS_DA_VILA = [
  {
    de: '  return {\n    G, MUNDO, ENQUADRE,',
    para: `  return {
    // Aberto pelo montar.cjs do Meio-termo: o que o mother.js e o meio.js reaproveitam sem cópia.
    _i: { paredesDaCasa, PRACA, pintarDesenho, LISOS: { AGUA, BRILHO_DA_AGUA, BARRO, TERRA, VIDRO, PAPEL }, FOLHAS, PRODUTOS },
    G, MUNDO, ENQUADRE,`,
  },
]

/** mother.js vira uma fábrica: sem ajuste, é o Estilo Mother de antes; com ajuste, troca paleta, traço e física. */
const ABERTURAS_DO_MOTHER = [
  { de: "var Mae = (function () {\n  'use strict'\n", para: "function fabricarMother(AJUSTE) {\n  'use strict'\n  AJUSTE = AJUSTE || {}\n" },
  { de: '  const PALETA = {\n', para: '  const PALETA = AJUSTE.paleta || {\n' },
  {
    de: '  const PISO_DO_CONTORNO = 0.065\n',
    para: '  const PISO_DO_CONTORNO = AJUSTE.piso ?? 0.065\n  /** Grossura do contorno (1 = a do Estilo Mother) e quanto ele escurece a cor (0,5 = metade da luz). */\n  const TRACO = AJUSTE.traco ?? 1\n  const ESCURO_DO_CONTORNO = AJUSTE.escuroDoContorno ?? 0.5\n',
  },
  { de: '      let lc = l * 0.5\n', para: '      let lc = l * ESCURO_DO_CONTORNO\n' },
  { de: '    const lc = o.contorno ?? 1.4\n', para: '    const lc = (o.contorno ?? 1.4) * TRACO\n' },
  { de: '    g.lineWidth = o.contorno ?? 2.4\n', para: '    g.lineWidth = (o.contorno ?? 2.4) * TRACO\n' },
  { de: '  const fisica = () => fis || (fis = V.montarFisica(obstaculos()))\n', para: '  const fisica = AJUSTE.fisica || (() => fis || (fis = V.montarFisica(obstaculos())))\n' },
  {
    de: '    tempoDoCenario: () => (cenario ? cenario.ms : null),\n  })\n})()',
    para: `    tempoDoCenario: () => (cenario ? cenario.ms : null),
    // Aberto pelo montar.cjs do Meio-termo: os pincéis, para o meio.js pintar com a paleta dele.
    _i: { pintar, folhagem, florzinha, tracos, dentro, sombraNoChao, sombraGirada, circulo, elipse, ret, poligono, capsula, caminhoDe, tinta, misturar, hexRgb, rgbHex,
      paraHsl, deHsl, carimbo, pintarSoleira, pintarBarranco, pintarDentroDaCasa, padraoDaPraca, ruido1, dentroDoPoligono, sombraDoChao },
  })
}
// eslint-disable-next-line no-var, no-unused-vars
var Mae = fabricarMother()`,
  },
]

/**
 * pagina.js ganha dois modos com pintor próprio ('mother' e 'meio'); "estilo()" devolve o pintor do modo aberto
 * (Mae ou Meio) e null na Textura e em Hoje. Tudo o que valia para "Depois" vale para os três modos novos.
 */
const ABERTURAS_DA_PAGINA = [
  { de: "    modo: 'depois',", para: "    modo: 'meio'," },
  { de: "est.modo === 'depois'", para: "est.modo !== 'antes'", vezes: 6 },
  {
    de: "  const fisicaAtual = () => (est.modo === 'antes' ? (fis.antes ||= V.montarFisica(V.obstaculosAntes())) : fis.depois)",
    para: `  /** O pintor do modo aberto: Mae (Estilo Mother), Meio (Meio-termo) ou null (Textura e Hoje, que são o vila.js). */
  const estilo = () => (est.modo === 'mother' ? Mae : est.modo === 'meio' ? Meio : null)
  const pintor = () => estilo() || V
  const fisicaAtual = () => (est.modo === 'antes' ? (fis.antes ||= V.montarFisica(V.obstaculosAntes())) : estilo() ? estilo().fisica() : fis.depois)`,
  },
  // Meio-termo e Estilo Mother têm a mesma colisão (Meio.fisica é Mae.fisica): uma navegação só para os dois
  { de: '    const m = est.modo\n    if (!nav[m])', para: "    const m = est.modo === 'meio' ? 'mother' : est.modo\n    if (!nav[m])" },
  {
    de: '    for (let S = rec.S; S >= 1; S -= 1) if (V.temImagem(p, S)) return V.imagemDaPeca(p, S)\n    return V.imagemDaPeca(p, 1)',
    para: '    const Q = pintor()\n    for (let S = Q === V ? rec.S : Q.S; S >= 1; S -= 1) if (Q.temImagem(p, S)) return Q.imagemDaPeca(p, S)\n    return Q.imagemDaPeca(p, 1)',
  },
  {
    de: '    const k = rec.S >= 2 && rec.telhados2 ? 2 : 1\n    return V.imagemDoTelhado(c, k)',
    para: '    const Q = estilo()\n    if (Q) return Q.imagemDoTelhado(c, Q.S >= 2 && Q.telhados2 ? 2 : 1)\n    const k = rec.S >= 2 && rec.telhados2 ? 2 : 1\n    return V.imagemDoTelhado(c, k)',
  },
  {
    de: '    return rec.chao.get(rec.kChao) || rec.chao.get(1)',
    para: '    if (estilo()) return estilo().chaoPronto()\n    if (!rec.chao.has(1)) rec.chao.set(1, V.pintarChaoDepois(1))\n    return rec.chao.get(rec.kChao) || rec.chao.get(1)',
  },
  {
    de: '    if (!rec.sombras.has(c.id)) rec.sombras.set(c.id, V.pintarSombraDaCasa(c, 1))\n    return rec.sombras.get(c.id)',
    para: "    const chave = (estilo() ? est.modo : 'depois') + ':' + c.id\n    if (!rec.sombras.has(chave)) rec.sombras.set(chave, pintor().pintarSombraDaCasa(c, 1))\n    return rec.sombras.get(chave)",
  },
  // nitidez: só o modo aberto gera as imagens 2x; trocar de modo com zoom pede as do modo novo
  { de: '    if (S <= 1) return\n', para: '    if (S <= 1) return\n    if (estilo()) return estilo().pedirNitidez(enfileirar)\n' },
  { de: '    est.onde = null\n    sujo = true\n  }\n', para: '    est.onde = null\n    sujo = true\n    pedirNitidez()\n  }\n' },
  {
    de: "    ctx.fillStyle = est.modo === 'antes' ? '#342e2b' : '#3b4631'",
    para: "    ctx.fillStyle = est.modo === 'antes' ? '#342e2b' : estilo() ? estilo().FUNDO : '#3b4631'",
  },
  { de: '      for (const p of EXTERNAS) {\n        const img = imagem(p)', para: '      for (const p of (estilo() ? estilo().EXTERNAS : EXTERNAS)) {\n        const img = imagem(p)' },
  {
    de: '      for (const c of V.CASAS) {\n        desenharPorta(c)\n        desenharPlaca(c)\n      }',
    para: '      for (const c of V.CASAS) {\n        if (estilo()) {\n          estilo().desenharPortaEPlaca(ctx, c, desenharIcone)\n          continue\n        }\n        desenharPorta(c)\n        desenharPlaca(c)\n      }',
  },
  { de: "    ctx.strokeStyle = 'rgba(18, 14, 10, 0.2)'", para: "    ctx.strokeStyle = estilo() ? estilo().COR_DA_GRADE : 'rgba(18, 14, 10, 0.2)'" },
  { de: '  function desenharDestino() {\n    const [x, y] = est.destino\n', para: '  function desenharDestino() {\n    const [x, y] = est.destino\n    if (estilo()) return estilo().desenharDestino(ctx, x, y)\n' },
  { de: '  function desenharPino() {\n    const [x, y] = est.pino\n', para: '  function desenharPino() {\n    const [x, y] = est.pino\n    if (estilo()) return estilo().desenharPino(ctx, x, y)\n' },
  { de: "    ctx.fillStyle = 'rgba(24, 22, 18, 0.8)'", para: "    ctx.fillStyle = estilo() ? estilo().ROTULO.fundo : 'rgba(24, 22, 18, 0.8)'" },
  { de: "    ctx.fillStyle = '#f3ece0'", para: "    ctx.fillStyle = estilo() ? estilo().ROTULO.texto : '#f3ece0'" },
  // a primeira pintura é a do Meio-termo (o modo que abre); Estilo Mother e Textura ficam prontos depois, na fila
  {
    de: `  const ETAPAS = [
    () => medir('ladrilhos', () => { for (const nome of ['pedras', 'lajes', 'muro', 'grama', 'mato', 'terra', 'tabuas', 'palha']) V.ladrilho(nome, 1) }),
    () => medir('chao', () => rec.chao.set(1, V.pintarChaoDepois(1))),
    () => {
      medir('telhados', () => { for (const c of V.CASAS) V.imagemDoTelhado(c, 1) })
      medir('sombras', () => { for (const c of V.CASAS) sombraDaCasa(c) })
    },
    () => medir('pecas', () => { for (const p of EXTERNAS.slice(0, 60)) V.imagemDaPeca(p, 1) }),
    () => medir('pecas2', () => { for (const p of EXTERNAS.slice(60)) V.imagemDaPeca(p, 1) }),`,
    para: `  const ETAPAS = [
    () => medir('cenario', () => Meio.prepararLadrilhos(1)),
    () => medir('chao', () => Meio.chao(1)),
    () => {
      medir('telhados', () => { for (const c of V.CASAS) Meio.imagemDoTelhado(c, 1) })
      medir('sombras', () => { for (const c of V.CASAS) sombraDaCasa(c) })
    },
    () => medir('pecas', () => { for (const p of Meio.EXTERNAS.slice(0, 40)) Meio.imagemDaPeca(p, 1) }),
    () => medir('pecas2', () => { for (const p of Meio.EXTERNAS.slice(40)) Meio.imagemDaPeca(p, 1) }),`,
  },
  {
    de: '    // em segundo plano: os móveis de dentro, a navegação e o chão de antes\n',
    para: `    // em segundo plano: os móveis de dentro, a navegação e o chão de antes;
    // e os outros dois modos inteiros (Estilo Mother e Textura), uma imagem por vez, para a troca de modo não travar
    V.PECAS_DE_DENTRO.forEach((p, i) => enfileirar('ed1:' + i, () => Meio.imagemDaPeca(p, 1)))
    enfileirar('m:cenario', () => Mae.prepararLadrilhos(1))
    enfileirar('m:chao', () => Mae.chao(1))
    for (const c of V.CASAS) enfileirar('m:t1:' + c.id, () => {
      Mae.imagemDoTelhado(c, 1)
      if (!rec.sombras.has('mother:' + c.id)) rec.sombras.set('mother:' + c.id, Mae.pintarSombraDaCasa(c, 1))
    })
    Mae.EXTERNAS.forEach((p, i) => enfileirar('m:p1:' + i, () => Mae.imagemDaPeca(p, 1)))
    V.PECAS_DE_DENTRO.forEach((p, i) => enfileirar('md1:' + i, () => Mae.imagemDaPeca(p, 1)))
    for (const nome of ['pedras', 'lajes', 'muro', 'grama', 'mato', 'terra', 'tabuas', 'palha']) enfileirar('l1:' + nome, () => V.ladrilho(nome, 1))
    enfileirar('c1', () => { if (!rec.chao.has(1)) rec.chao.set(1, V.pintarChaoDepois(1)) })
    for (const c of V.CASAS) enfileirar('t1:' + c.id, () => {
      V.imagemDoTelhado(c, 1)
      if (!rec.sombras.has('depois:' + c.id)) rec.sombras.set('depois:' + c.id, V.pintarSombraDaCasa(c, 1))
    })
    EXTERNAS.forEach((p, i) => enfileirar('p1:' + i, () => V.imagemDaPeca(p, 1)))
    enfileirar('nav-depois', () => { nav.depois ||= V.montarNavegacao(fis.depois) })
`,
  },
  {
    de: '    robo: (semente, i, extra) => V.robo(fis.depois, nav.depois || (nav.depois = V.montarNavegacao(fis.depois)), { semente, casa: V.CASAS[i], inicio: V.INICIO_DO_PINO, ...extra }),',
    para: '    robo: (semente, i, extra) => V.robo(fisicaAtual(), navAtual(), { semente, casa: V.CASAS[i], inicio: V.INICIO_DO_PINO, ...extra }),\n    pintor: () => pintor(),',
  },
]

function semFimDeScript(nome, codigo) {
  if (/<\/script/i.test(codigo)) throw new Error(`${nome} tem "</script" no texto; o HTML montado quebraria.`)
  return codigo
}

function montar() {
  const esbuild = require(path.join(RAIZ, 'node_modules', 'esbuild'))
  const pacote = esbuild.buildSync({
    entryPoints: [path.join(VILA, 'entrada.js')],
    bundle: true,
    format: 'iife',
    globalName: 'TelhadoLab',
    target: 'es2020',
    charset: 'utf8',
    legalComments: 'none',
    write: false,
  })
  const telhado = `// Gerado por montar.cjs (esbuild ${esbuild.version}) a partir de client/src. Não edite aqui.\n${pacote.outputFiles[0].text}`
  const pecas = {
    '/*__TELHADO__*/': telhado,
    '/*__OBJETOS__*/': abrir('objetos.js', ler(OBJETOS), ABERTURAS_DO_OBJETOS),
    '/*__VILA__*/': abrir('vila.js', ler(path.join(VILA, 'vila.js')), ABERTURAS_DA_VILA),
    '/*__MOTHER__*/': abrir('mother.js', ler(MOTHER), ABERTURAS_DO_MOTHER),
    '/*__MEIO__*/': ler(path.join(PASTA, 'meio.js')),
    '/*__PAGINA__*/': abrir('pagina.js', ler(path.join(VILA, 'pagina.js')), ABERTURAS_DA_PAGINA),
  }
  let html = ler(path.join(PASTA, 'fonte.html'))
  for (const [marca, codigo] of Object.entries(pecas)) {
    if (!html.includes(marca)) throw new Error(`fonte.html sem a marca ${marca}`)
    html = html.replace(marca, () => semFimDeScript(marca, codigo))
  }
  fs.writeFileSync(path.join(PASTA, 'index.html'), html)
  const aberturas = ABERTURAS_DO_OBJETOS.length + ABERTURAS_DA_VILA.length + ABERTURAS_DO_MOTHER.length + ABERTURAS_DA_PAGINA.length
  return { bytes: Buffer.byteLength(html), esbuild: esbuild.version, aberturas }
}

module.exports = { montar }

if (require.main === module) {
  const r = montar()
  console.log(`index.html: ${(r.bytes / 1024).toFixed(1)} KB (telhado com esbuild ${r.esbuild}; ${r.aberturas} aberturas conferidas)`)
}
