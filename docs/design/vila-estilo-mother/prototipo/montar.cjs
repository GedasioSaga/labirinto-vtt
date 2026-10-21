// Monta o protótipo do Estilo Mother num arquivo só (vai para o Artifact), REAPROVEITANDO o motor
// do protótipo anterior sem copiar arquivo grande:
// - o telhado do app (client/src), empacotado pelo esbuild da raiz a partir de docs/design/vila/prototipo/entrada.js
//   (é ele que desenha os telhados do modo Textura);
// - o pintor de objetos (docs/design/objetos/prototipo/objetos.js), com as formas abertas em Objetos._i;
// - vila.js e pagina.js de docs/design/vila/prototipo, lidos de lá e abertos em pontos conferidos (ABERTURAS);
// - mother.js (os pintores novos) e fonte.html (a página), daqui.
// Cada abertura precisa casar o número exato de vezes; se o original mudar, a montagem para com erro.
// Rodar da raiz do repo: node docs/design/vila-estilo-mother/prototipo/montar.cjs
const fs = require('fs')
const path = require('path')

const PASTA = __dirname
const RAIZ = path.resolve(PASTA, '..', '..', '..', '..')
const VILA = path.join(RAIZ, 'docs', 'design', 'vila', 'prototipo')
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
    // Aberto pelo montar.cjs: as mesmas formas, materiais e pintura, para as peças da vila.
    _i: { P, caixa, elipse, capsula, poligono, uniao, menos, anel, barra, pintarCena, MATERIAIS, contato, rgb, escalar, misturar, hash, ruido, unir, SOMBRA_X, SOMBRA_Y },`,
  },
]

const ABERTURAS_DA_VILA = [
  {
    de: '  return {\n    G, MUNDO, ENQUADRE,',
    para: '  return {\n    // Aberto pelo montar.cjs do Estilo Mother: o que o mother.js reaproveita sem cópia.\n    _i: { paredesDaCasa, PRACA },\n    G, MUNDO, ENQUADRE,',
  },
]

/** pagina.js ganha um terceiro modo ('mother'), que troca só os pintores pelos de mother.js. */
const ABERTURAS_DA_PAGINA = [
  { de: "    modo: 'depois',", para: "    modo: 'mother'," },
  // tudo o que valia para "Depois" vale para os dois modos novos (Textura e Estilo Mother)
  { de: "est.modo === 'depois'", para: "est.modo !== 'antes'", vezes: 6 },
  {
    de: "  const fisicaAtual = () => (est.modo === 'antes' ? (fis.antes ||= V.montarFisica(V.obstaculosAntes())) : fis.depois)",
    para: `  const fisicaAtual = () => (est.modo === 'antes' ? (fis.antes ||= V.montarFisica(V.obstaculosAntes())) : est.modo === 'mother' ? Mae.fisica() : fis.depois)
  /** Estilo Mother: os pintores de mother.js no lugar dos de vila.js (mesmas casas, portas e colisão das casas). */
  const pintor = () => (est.modo === 'mother' ? Mae : V)`,
  },
  {
    de: '    for (let S = rec.S; S >= 1; S -= 1) if (V.temImagem(p, S)) return V.imagemDaPeca(p, S)\n    return V.imagemDaPeca(p, 1)',
    para: '    const Q = pintor()\n    for (let S = Q === Mae ? Mae.S : rec.S; S >= 1; S -= 1) if (Q.temImagem(p, S)) return Q.imagemDaPeca(p, S)\n    return Q.imagemDaPeca(p, 1)',
  },
  {
    de: '    const k = rec.S >= 2 && rec.telhados2 ? 2 : 1\n    return V.imagemDoTelhado(c, k)',
    para: "    if (est.modo === 'mother') return Mae.imagemDoTelhado(c, Mae.S >= 2 && Mae.telhados2 ? 2 : 1)\n    const k = rec.S >= 2 && rec.telhados2 ? 2 : 1\n    return V.imagemDoTelhado(c, k)",
  },
  {
    de: '    return rec.chao.get(rec.kChao) || rec.chao.get(1)',
    para: "    if (est.modo === 'mother') return Mae.chaoPronto()\n    if (!rec.chao.has(1)) rec.chao.set(1, V.pintarChaoDepois(1))\n    return rec.chao.get(rec.kChao) || rec.chao.get(1)",
  },
  {
    de: '    if (!rec.sombras.has(c.id)) rec.sombras.set(c.id, V.pintarSombraDaCasa(c, 1))\n    return rec.sombras.get(c.id)',
    para: "    const chave = (est.modo === 'mother' ? 'mother:' : 'depois:') + c.id\n    if (!rec.sombras.has(chave)) rec.sombras.set(chave, pintor().pintarSombraDaCasa(c, 1))\n    return rec.sombras.get(chave)",
  },
  // nitidez: só o modo aberto gera as imagens 2x (no Estilo Mother, gerar a Textura 2x junto roubava quadros);
  // trocar de modo com zoom pede as do modo novo
  { de: '    if (S <= 1) return\n', para: "    if (S <= 1) return\n    if (est.modo === 'mother') return Mae.pedirNitidez(enfileirar)\n" },
  { de: '    est.onde = null\n    sujo = true\n  }\n', para: '    est.onde = null\n    sujo = true\n    pedirNitidez()\n  }\n' },
  {
    de: "    ctx.fillStyle = est.modo === 'antes' ? '#342e2b' : '#3b4631'",
    para: "    ctx.fillStyle = est.modo === 'antes' ? '#342e2b' : est.modo === 'mother' ? Mae.FUNDO : '#3b4631'",
  },
  { de: '      for (const p of EXTERNAS) {\n        const img = imagem(p)', para: "      for (const p of (est.modo === 'mother' ? Mae.EXTERNAS : EXTERNAS)) {\n        const img = imagem(p)" },
  {
    de: '      for (const c of V.CASAS) {\n        desenharPorta(c)\n        desenharPlaca(c)\n      }',
    para: "      for (const c of V.CASAS) {\n        if (est.modo === 'mother') {\n          Mae.desenharPortaEPlaca(ctx, c, desenharIcone)\n          continue\n        }\n        desenharPorta(c)\n        desenharPlaca(c)\n      }",
  },
  { de: "    ctx.strokeStyle = 'rgba(18, 14, 10, 0.2)'", para: "    ctx.strokeStyle = est.modo === 'mother' ? Mae.COR_DA_GRADE : 'rgba(18, 14, 10, 0.2)'" },
  { de: '  function desenharDestino() {\n    const [x, y] = est.destino\n', para: "  function desenharDestino() {\n    const [x, y] = est.destino\n    if (est.modo === 'mother') return Mae.desenharDestino(ctx, x, y)\n" },
  { de: '  function desenharPino() {\n    const [x, y] = est.pino\n', para: "  function desenharPino() {\n    const [x, y] = est.pino\n    if (est.modo === 'mother') return Mae.desenharPino(ctx, x, y)\n" },
  { de: "    ctx.fillStyle = 'rgba(24, 22, 18, 0.8)'", para: "    ctx.fillStyle = est.modo === 'mother' ? Mae.ROTULO.fundo : 'rgba(24, 22, 18, 0.8)'" },
  { de: "    ctx.fillStyle = '#f3ece0'", para: "    ctx.fillStyle = est.modo === 'mother' ? Mae.ROTULO.texto : '#f3ece0'" },
  // a primeira pintura é a do Estilo Mother (o modo que abre); a Textura fica pronta depois, na fila
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
    () => medir('cenario', () => Mae.prepararLadrilhos(1)),
    () => medir('chao', () => Mae.chao(1)),
    () => {
      medir('telhados', () => { for (const c of V.CASAS) Mae.imagemDoTelhado(c, 1) })
      medir('sombras', () => { for (const c of V.CASAS) sombraDaCasa(c) })
    },
    () => medir('pecas', () => { for (const p of Mae.EXTERNAS) Mae.imagemDaPeca(p, 1) }),`,
  },
  {
    de: '    // em segundo plano: os móveis de dentro, a navegação e o chão de antes\n',
    para: `    // em segundo plano: os móveis de dentro, a navegação e o chão de antes
    // e a Textura inteira (vila.js), uma imagem por vez, para a troca de modo não travar
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
    '/*__MOTHER__*/': ler(path.join(PASTA, 'mother.js')),
    '/*__PAGINA__*/': abrir('pagina.js', ler(path.join(VILA, 'pagina.js')), ABERTURAS_DA_PAGINA),
  }
  let html = ler(path.join(PASTA, 'fonte.html'))
  for (const [marca, codigo] of Object.entries(pecas)) {
    if (!html.includes(marca)) throw new Error(`fonte.html sem a marca ${marca}`)
    html = html.replace(marca, () => semFimDeScript(marca, codigo))
  }
  fs.writeFileSync(path.join(PASTA, 'index.html'), html)
  return { bytes: Buffer.byteLength(html), esbuild: esbuild.version, aberturas: ABERTURAS_DO_OBJETOS.length + ABERTURAS_DA_VILA.length + ABERTURAS_DA_PAGINA.length }
}

module.exports = { montar }

if (require.main === module) {
  const r = montar()
  console.log(`index.html: ${(r.bytes / 1024).toFixed(1)} KB (telhado com esbuild ${r.esbuild}; ${r.aberturas} aberturas conferidas)`)
}
