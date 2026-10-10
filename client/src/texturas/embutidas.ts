import {
  cristas,
  empacotar,
  fbm,
  hash,
  luz,
  luzNaInclinacao,
  LUZ_NO_PLANO,
  misturar,
  passoSuave,
  rgb,
  sombreado,
  valor,
  vizinhos,
  type Rgb,
} from './ruido'

/**
 * A BIBLIOTECA INICIAL de texturas (pedido de 10/10/2026: "a maioria das
 * texturas vai vir de você, faça cada uma com cuidado para fazer sentido e
 * não ficar estourado").
 *
 * Cada textura é a cor de um ladrilho que se repete sem emenda (`ruido.ts`),
 * vista de cima com a luz do relevo (de cima à esquerda). As cores PARTEM do
 * mapa do usuário (Tasmaturi Village): a floresta do `#177c5c` dele, a serra
 * do `#9e8a74`, o pântano do `#47948c`, a neve do `#e3f0fb`... A variação é
 * de luz, não de tom: poucos por cento para cada lado, saturação no máximo a
 * da cor dele, nada de branco puro nem de listra fina (o teste
 * `embutidas.test.ts` mede as três coisas).
 *
 * `escala`: o lado do ladrilho no mapa, em px do protótipo do relevo (o mesmo
 * metro do pincel de penhasco), para a copa ter o mesmo tamanho na tela em
 * qualquer mapa de continente (`ladoDoLadrilhoNoMundo`).
 */

export interface DefinicaoDeTextura {
  id: string
  nome: string
  escala: number
  /** A cor (0xRRGGBB) do ponto (u, v) do ladrilho, u e v em [0, 1); repete em 1. */
  cor: (u: number, v: number) => number
}

// ---------------------------------------------------------------------------
// Areia: o bege claro das praias do mapa, manchado de leve, com grão fino e
// raras conchinhas. Plana: quem dá forma de onda é a Duna.

const AREIA_CLARA = rgb('#d6c286')
const AREIA_MEIA = rgb('#cbb57e')
const AREIA_ESCURA = rgb('#bfa774')

function areia(u: number, v: number): number {
  const mancha = fbm(u, v, 3, 4, 11) * 0.5 + 0.5
  let c = misturar(AREIA_CLARA, AREIA_MEIA, passoSuave(0.25, 0.85, mancha))
  // Úmido/batido: manchas largas um pouco mais escuras.
  c = misturar(c, AREIA_ESCURA, passoSuave(0.55, 0.95, fbm(u, v, 2, 3, 12) * 0.5 + 0.5) * 0.45)
  c = luz(c, (valor(u * 128, v * 128, 128, 13) - 0.5) * 0.05)
  let concha = 0
  vizinhos(u, v, 36, 14, 0.4, (p) => {
    if (hash(p.ix, p.iy, 15) > 0.22) return
    const d = Math.hypot(p.dx, p.dy)
    concha = Math.max(concha, 1 - passoSuave(0.09, 0.15, d))
  })
  c = luz(c, -0.07 * concha)
  return empacotar(c)
}

// ---------------------------------------------------------------------------
// Duna: ondas largas de areia, cada uma com a encosta suave do vento e a face
// íngreme do outro lado, sombreadas pela luz. A onda corre na diagonal
// (2u + v: coeficientes inteiros, então repete) e serpenteia pelo ruído.

const DUNA_LUZ = rgb('#d4b874')
const DUNA_BASE = rgb('#c4a45e')
const DUNA_SOMBRA = rgb('#a98a47')

function perfilDaDuna(t: number): number {
  // Sobe devagar por 60% da onda (barlavento) e desce no resto (sotavento).
  // Sotavento curto demais vira um risco escuro fino: listra, não duna.
  const f = t - Math.floor(t)
  return f < 0.6 ? passoSuave(0, 1, f / 0.6) : 1 - passoSuave(0, 1, (f - 0.6) / 0.4)
}

function alturaDaDuna(u: number, v: number): number {
  const curva = fbm(u, v, 2, 3, 21) * 0.3
  // A crista cresce e some ao longo da onda: duna de verdade não é régua.
  const crista = 0.55 + 0.45 * passoSuave(-0.6, 0.6, fbm(u, v, 3, 2, 24))
  return perfilDaDuna(2 * u + v + curva) * crista + fbm(u, v, 4, 3, 22) * 0.05
}

function duna(u: number, v: number): number {
  const s = sombreado(alturaDaDuna, u, v, 0.034)
  const c = s >= 0 ? misturar(DUNA_BASE, DUNA_LUZ, s * 2.6) : misturar(DUNA_BASE, DUNA_SOMBRA, -s * 2.1)
  return empacotar(luz(c, (valor(u * 128, v * 128, 128, 23) - 0.5) * 0.04))
}

// ---------------------------------------------------------------------------
// Grama / campo: os dois verdes de campo do mapa (#76c577 e #8ac459) em
// manchas largas, moitas um pouco mais escuras e tufos miúdos com luz.

const CAMPO_VERDE = rgb('#76c577')
const CAMPO_AMARELADO = rgb('#8ac459')
const CAMPO_MOITA = rgb('#62ab64')

function grama(u: number, v: number): number {
  let c = misturar(CAMPO_VERDE, CAMPO_AMARELADO, passoSuave(0.2, 0.8, fbm(u, v, 2, 4, 31) * 0.5 + 0.5))
  c = misturar(c, CAMPO_MOITA, passoSuave(0.55, 0.9, fbm(u, v, 5, 3, 32) * 0.5 + 0.5) * 0.7)
  // Tufos: domos baixos, claros do lado da luz e escuros do outro.
  let tufo = 0
  vizinhos(u, v, 26, 33, 0.38, (p) => {
    const r = 0.3 + hash(p.ix, p.iy, 34) * 0.14
    const d = Math.hypot(p.dx, p.dy)
    if (d >= r) return
    const h = Math.sqrt(1 - (d / r) ** 2)
    const brilho = luzNaInclinacao((p.dx / r) * 1.4, (p.dy / r) * 1.4) - LUZ_NO_PLANO
    tufo += brilho * passoSuave(r, r * 0.6, d) * (0.6 + 0.4 * h)
  })
  c = luz(c, tufo * 0.1 + (valor(u * 160, v * 160, 160, 35) - 0.5) * 0.04)
  return empacotar(c)
}

// ---------------------------------------------------------------------------
// Copas vistas de cima (floresta e pinheiros): cada árvore é um ponto de
// célula com raio e cor próprios; a copa mais alta no ponto ganha, a luz
// acende o lado de cima à esquerda, e a copa vizinha joga sombra para baixo à
// direita. Entre as copas, o chão escuro do mato.

interface Copas {
  n: number
  semente: number
  raio: readonly [number, number]
  /** Copa redonda (folhosa) ou cone (pinheiro, que de cima é uma estrela de galhos). */
  forma: 'domo' | 'cone'
  galhos: number
  cores: readonly Rgb[]
  chao: Rgb
  /** Quanto a copa vizinha joga de sombra, em células (para baixo à direita). */
  sombra: number
}

interface CopaNoPonto {
  altura: number
  nx: number
  ny: number
  cor: Rgb
  borda: number
}

/** As duas copas mais altas no ponto: a de cima e a que ela cobre (para amaciar a divisa entre as duas). */
interface CopasNoPonto {
  melhor: CopaNoPonto | null
  segundo: CopaNoPonto | null
}

function copaNoPonto(u: number, v: number, cfg: Copas): CopasNoPonto {
  let melhor = null as CopaNoPonto | null
  let segundo = null as CopaNoPonto | null
  vizinhos(u, v, cfg.n, cfg.semente, 0.32, (p) => {
    const tamanho = hash(p.ix, p.iy, cfg.semente + 1)
    const raioBase = cfg.raio[0] + (cfg.raio[1] - cfg.raio[0]) * tamanho
    const d = Math.hypot(p.dx, p.dy)
    const angulo = Math.atan2(p.dy, p.dx)
    const fase = hash(p.ix, p.iy, cfg.semente + 2) * Math.PI * 2
    // A borda da copa: lóbulos irregulares na folhosa (três ondas que não
    // casam, senão vira polígono), pontas de galho no pinheiro.
    const recorte =
      cfg.forma === 'cone'
        ? 0.15 * Math.cos(cfg.galhos * angulo + fase) + 0.05 * Math.cos(2 * cfg.galhos * angulo - fase)
        : 0.05 * Math.sin(7 * angulo + fase) + 0.035 * Math.sin(11 * angulo - 2 * fase) + 0.03 * Math.sin(3 * angulo + fase / 2)
    const r = raioBase * (1 + recorte)
    if (d >= r) return
    const t = d / r
    // As árvores maiores ficam mais altas: elas cobrem as menores ao lado.
    const topo = 0.75 + 0.25 * tamanho
    const altura = (cfg.forma === 'cone' ? 1 - t : Math.sqrt(1 - t * t)) * topo
    if (segundo !== null && altura <= segundo.altura) return
    const inclinacao = cfg.forma === 'cone' ? 1.3 : (t / Math.max(0.25, Math.sqrt(1 - t * t))) * 0.8
    const nx = d === 0 ? 0 : (p.dx / d) * inclinacao
    const ny = d === 0 ? 0 : (p.dy / d) * inclinacao
    const cor = cfg.cores[Math.floor(hash(p.ix, p.iy, cfg.semente + 3) * cfg.cores.length) % cfg.cores.length]
    const copa = { altura, nx, ny, cor, borda: passoSuave(1, 0.86, t) }
    if (melhor === null || altura > melhor.altura) {
      segundo = melhor
      melhor = copa
    } else segundo = copa
  })
  return { melhor, segundo }
}

/** A cor de uma copa no ponto: a luz na inclinação dela, os cachos de folha e o grão. */
function corDaCopa(copa: CopaNoPonto, cfg: Copas, variacao: number): Rgb {
  const brilho = luzNaInclinacao(copa.nx, copa.ny) - LUZ_NO_PLANO
  return misturar(cfg.chao, luz(copa.cor, brilho * 0.5 + variacao), copa.borda)
}

function copas(u: number, v: number, cfg: Copas): number {
  const { melhor: aqui, segundo } = copaNoPonto(u, v, cfg)
  // Sombra: a copa logo acima à esquerda (de onde vem a luz) mais alta que aqui.
  const deslocamento = cfg.sombra / cfg.n
  const la = copaNoPonto(u - deslocamento, v - deslocamento, cfg).melhor
  const alturaAqui = aqui?.altura ?? 0
  const sombra = la === null ? 0 : passoSuave(0.05, 0.35, la.altura - alturaAqui)
  const miudo = (valor(u * 96, v * 96, 96, cfg.semente + 9) - 0.5) * 0.08
  if (aqui === null) return empacotar(luz(cfg.chao, -0.22 * sombra + miudo))
  // Cachos de folha dentro da copa: manchas um pouco mais claras e escuras.
  const cacho = (valor(u * cfg.n * 4, v * cfg.n * 4, cfg.n * 4, cfg.semente + 8) - 0.5) * 0.14
  let c = corDaCopa(aqui, cfg, miudo + cacho)
  // Onde duas copas se encontram quase na mesma altura, a divisa é misturada
  // (meio a meio na linha, só a de cima um pouco adiante): sem ela a troca de
  // uma copa para a outra virava degrau de pixel no ladrilho ampliado.
  if (segundo !== null) c = misturar(corDaCopa(segundo, cfg, miudo + cacho), c, 0.5 + 0.5 * passoSuave(0, 0.06, aqui.altura - segundo.altura))
  return empacotar(luz(c, -0.2 * sombra))
}

const FLORESTA: Copas = {
  n: 8,
  semente: 41,
  raio: [0.5, 0.66],
  forma: 'domo',
  galhos: 0,
  cores: [rgb('#177c5c'), rgb('#1d8763'), rgb('#237f57'), rgb('#156f55'), rgb('#1b7a60')],
  chao: rgb('#0f4d3b'),
  sombra: 0.2,
}

const PINHEIROS: Copas = {
  n: 10,
  semente: 51,
  raio: [0.46, 0.6],
  forma: 'cone',
  galhos: 8,
  // Um tom abaixo da floresta do mapa (#177c5c), não preto: no zoom de continente
  // o pinheiral ainda tem de ler verde, só mais fechado.
  cores: [rgb('#1a6853'), rgb('#1e7158'), rgb('#165f4d'), rgb('#21765c')],
  chao: rgb('#284a3c'),
  sombra: 0.3,
}

// ---------------------------------------------------------------------------
// Pedra / serra: blocos de rocha (cristas macias misturadas a morros largos,
// tortos pelo próprio ruído) sombreados pela luz, mais claros no alto e no tom
// dos cinzas-castanhos das montanhas do mapa. Crista dura demais virava rede
// de vincos finos (lama rachada), não serra.

const PEDRA_BAIXA = rgb('#82766b')
const PEDRA_MEIA = rgb('#96887a')
const PEDRA_ALTA = rgb('#a89784')

function alturaDaPedra(u: number, v: number): number {
  const torto = fbm(u, v, 2, 2, 63) * 0.06
  return cristas(u + torto, v - torto, 3, 3, 61) * 0.6 + (fbm(u, v, 4, 3, 64) * 0.5 + 0.5) * 0.4
}

function pedra(u: number, v: number): number {
  const h = alturaDaPedra(u, v)
  let c = h < 0.5 ? misturar(PEDRA_BAIXA, PEDRA_MEIA, h * 2) : misturar(PEDRA_MEIA, PEDRA_ALTA, (h - 0.5) * 2)
  const s = sombreado(alturaDaPedra, u, v, 0.016)
  c = luz(c, s * 0.8 + (valor(u * 140, v * 140, 140, 62) - 0.5) * 0.04)
  return empacotar(c)
}

// ---------------------------------------------------------------------------
// Neve / gelo: montes macios de neve com sombra azulada (nunca branco puro) e
// placas de gelo mais lisas e um pouco mais azuis, do #e3f0fb e #b1bac6 do mapa.

const NEVE = rgb('#dfe8f0')
const NEVE_SOMBRA = rgb('#b9c6d6')
const GELO = rgb('#c9dbea')

function alturaDaNeve(u: number, v: number): number {
  return fbm(u, v, 2, 4, 71) * 0.5
}

function neve(u: number, v: number): number {
  const s = sombreado(alturaDaNeve, u, v, 0.03)
  let c = s >= 0 ? luz(NEVE, s * 0.1) : misturar(NEVE, NEVE_SOMBRA, -s * 2.4)
  const placa = passoSuave(0.62, 0.72, fbm(u, v, 3, 3, 72) * 0.5 + 0.5)
  c = misturar(c, GELO, placa * 0.55)
  return empacotar(luz(c, (valor(u * 120, v * 120, 120, 73) - 0.5) * 0.025))
}

// ---------------------------------------------------------------------------
// Pântano: poças de água parada (o teal do #47948c, escurecido) entre tapetes
// de mato baixo, com a margem úmida um pouco mais escura e juncos miúdos.

const AGUA_FUNDA = rgb('#2f6b66')
const AGUA_RASA = rgb('#3d7f77')
const MATO = rgb('#5c8f71')
const MATO_SECO = rgb('#6f9673')
const MARGEM = rgb('#4a7563')

function pantano(u: number, v: number): number {
  const h = fbm(u, v, 3, 4, 81) * 0.5 + 0.5
  const agua = passoSuave(0.44, 0.38, h)
  const aguaCor = misturar(AGUA_RASA, AGUA_FUNDA, passoSuave(0.38, 0.2, h))
  let terra = misturar(MATO, MATO_SECO, passoSuave(0.3, 0.8, fbm(u, v, 6, 3, 82) * 0.5 + 0.5))
  terra = misturar(MARGEM, terra, passoSuave(0.44, 0.52, h))
  let junco = 0
  vizinhos(u, v, 34, 83, 0.4, (p) => {
    if (hash(p.ix, p.iy, 84) > 0.45) return
    junco = Math.max(junco, 1 - passoSuave(0.1, 0.17, Math.hypot(p.dx, p.dy)))
  })
  terra = luz(terra, -0.16 * junco)
  const c = misturar(terra, aguaCor, agua)
  return empacotar(luz(c, (valor(u * 128, v * 128, 128, 85) - 0.5) * 0.04))
}

// ---------------------------------------------------------------------------
// Terra: chão batido castanho (do #a68d5d do mapa) com manchas úmidas e
// pedrinhas claras com luz e sombra.

const TERRA_CLARA = rgb('#a08559')
const TERRA_ESCURA = rgb('#8c7150')
const PEDRINHA = rgb('#a89574')

function terra(u: number, v: number): number {
  let c = misturar(TERRA_CLARA, TERRA_ESCURA, passoSuave(0.3, 0.75, fbm(u, v, 3, 4, 91) * 0.5 + 0.5))
  c = luz(c, (valor(u * 150, v * 150, 150, 92) - 0.5) * 0.06)
  // Pedrinhas: poucas, no tom da terra só um pouco mais claro, com luz em cima
  // à esquerda e a sombra caindo para baixo à direita. Clara e miúda demais,
  // virava pontilhado branco por cima do chão.
  const pedrinhaEm = (pu: number, pv: number) => {
    let achada = null as { t: number; nx: number; ny: number } | null
    vizinhos(pu, pv, 14, 93, 0.32, (p) => {
      if (hash(p.ix, p.iy, 94) > 0.2) return
      const r = 0.2 + hash(p.ix, p.iy, 95) * 0.12
      const d = Math.hypot(p.dx, p.dy)
      if (d >= r) return
      if (achada === null || d / r < achada.t) achada = { t: d / r, nx: p.dx / r, ny: p.dy / r }
    })
    return achada
  }
  const pedrinha = pedrinhaEm(u, v)
  if (pedrinha === null) {
    const sombra = pedrinhaEm(u - 0.006, v - 0.006)
    return empacotar(sombra === null ? c : luz(c, -0.12 * passoSuave(1, 0.6, sombra.t)))
  }
  const { t, nx, ny } = pedrinha
  const brilho = luzNaInclinacao(nx * 1.4, ny * 1.4) - LUZ_NO_PLANO
  const pedra = luz(PEDRINHA, brilho * 0.3)
  return empacotar(misturar(c, pedra, passoSuave(1, 0.8, t)))
}

/** A biblioteca inicial, na ordem do painel (do litoral para a montanha). */
export const TEXTURAS_EMBUTIDAS: readonly DefinicaoDeTextura[] = [
  { id: 'areia', nome: 'Areia', escala: 36, cor: areia },
  { id: 'duna', nome: 'Duna', escala: 64, cor: duna },
  { id: 'grama', nome: 'Campo', escala: 30, cor: grama },
  { id: 'floresta', nome: 'Floresta', escala: 40, cor: (u, v) => copas(u, v, FLORESTA) },
  { id: 'pinheiros', nome: 'Pinheiros', escala: 36, cor: (u, v) => copas(u, v, PINHEIROS) },
  { id: 'pantano', nome: 'Pântano', escala: 48, cor: pantano },
  { id: 'terra', nome: 'Terra', escala: 32, cor: terra },
  { id: 'pedra', nome: 'Serra', escala: 56, cor: pedra },
  { id: 'neve', nome: 'Neve', escala: 56, cor: neve },
]

/** Ids da biblioteca: o pacote não pode usar (a embutida ganha, como nas animações). */
export const IDS_DAS_EMBUTIDAS: readonly string[] = TEXTURAS_EMBUTIDAS.map((t) => t.id)
