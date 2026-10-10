import { cobertura, espalhar, naVolta, pontosPerto, pontosQueAlcancam, sorteador, type Cobertura, type Espalhamento } from './espalhar'
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
  /**
   * Lado do ladrilho em pixels (potência de 2), quando não é o padrão
   * (`LADO_DO_LADRILHO`). Ladrilho grande no mundo (`escala` alta, para a
   * repetição não aparecer) precisa de mais pixels para não borrar de perto.
   */
  lado?: number
  /**
   * Lado do ladrilho em CASAS da grade, no lugar da `escala` (que fica só
   * para a miniatura): chão de masmorra (convés, lajotas) mede contra a casa,
   * não contra o tamanho do mapa.
   */
  casas?: number
}

/** O ladrilho maior, das texturas de período longo (Bosque, Pântano, Terra). */
const LADO_GRANDE = 512
/** O ladrilho dos chãos de masmorra (8 casas): 128 px por casa, a tábua nítida de perto. */
const LADO_MAIOR = 1024

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

/** O que faz uma copa ser ela: a forma, as cores possíveis e o sorteio dela. */
type FormaDaCopa = Pick<Copas, 'forma' | 'galhos' | 'cores'>

/**
 * Uma copa no ponto (dx, dy) do centro dela, ou `null` fora dela. `raioBase`
 * na mesma unidade de dx, dy; `tamanho`, `fase` (radianos) e `sorteioDaCor`
 * em [0, 1) vêm do sorteio da árvore. A Floresta, os Pinheiros e o Bosque
 * desenham a árvore por aqui: a mesma copa, só espalhada de outro jeito.
 */
function umaCopa(dx: number, dy: number, raioBase: number, tamanho: number, fase: number, sorteioDaCor: number, forma: FormaDaCopa): CopaNoPonto | null {
  const d = Math.hypot(dx, dy)
  // Longe demais até para a ponta do maior lóbulo (folhosa +11,5%, galho
  // +20%): fora, sem a conta do recorte (a mais cara do ladrilho).
  if (d >= raioBase * (forma.forma === 'cone' ? 1.2 : 1.12)) return null
  const angulo = Math.atan2(dy, dx)
  // A borda da copa: lóbulos irregulares na folhosa (três ondas que não
  // casam, senão vira polígono), pontas de galho no pinheiro.
  const recorte =
    forma.forma === 'cone'
      ? 0.15 * Math.cos(forma.galhos * angulo + fase) + 0.05 * Math.cos(2 * forma.galhos * angulo - fase)
      : 0.05 * Math.sin(7 * angulo + fase) + 0.035 * Math.sin(11 * angulo - 2 * fase) + 0.03 * Math.sin(3 * angulo + fase / 2)
  const r = raioBase * (1 + recorte)
  if (d >= r) return null
  const t = d / r
  // As árvores maiores ficam mais altas: elas cobrem as menores ao lado.
  const topo = 0.75 + 0.25 * tamanho
  const altura = (forma.forma === 'cone' ? 1 - t : Math.sqrt(1 - t * t)) * topo
  const inclinacao = forma.forma === 'cone' ? 1.3 : (t / Math.max(0.25, Math.sqrt(1 - t * t))) * 0.8
  const nx = d === 0 ? 0 : (dx / d) * inclinacao
  const ny = d === 0 ? 0 : (dy / d) * inclinacao
  const cor = forma.cores[Math.floor(sorteioDaCor * forma.cores.length) % forma.cores.length]
  return { altura, nx, ny, cor, borda: passoSuave(1, 0.86, t) }
}

function copaNoPonto(u: number, v: number, cfg: Copas): CopasNoPonto {
  let melhor = null as CopaNoPonto | null
  let segundo = null as CopaNoPonto | null
  vizinhos(u, v, cfg.n, cfg.semente, 0.32, (p) => {
    const tamanho = hash(p.ix, p.iy, cfg.semente + 1)
    const raioBase = cfg.raio[0] + (cfg.raio[1] - cfg.raio[0]) * tamanho
    const fase = hash(p.ix, p.iy, cfg.semente + 2) * Math.PI * 2
    const copa = umaCopa(p.dx, p.dy, raioBase, tamanho, fase, hash(p.ix, p.iy, cfg.semente + 3), cfg)
    if (copa === null || (segundo !== null && copa.altura <= segundo.altura)) return
    if (melhor === null || copa.altura > melhor.altura) {
      segundo = melhor
      melhor = copa
    } else segundo = copa
  })
  return { melhor, segundo }
}

/** A cor de uma copa no ponto: a luz na inclinação dela, os cachos de folha e o grão; a borda escurece para `fundo`. */
function corDaCopa(copa: CopaNoPonto, fundo: Rgb, variacao: number): Rgb {
  const brilho = luzNaInclinacao(copa.nx, copa.ny) - LUZ_NO_PLANO
  return misturar(fundo, luz(copa.cor, brilho * 0.5 + variacao), copa.borda)
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
  let c = corDaCopa(aqui, cfg.chao, miudo + cacho)
  // Onde duas copas se encontram quase na mesma altura, a divisa é misturada
  // (meio a meio na linha, só a de cima um pouco adiante): sem ela a troca de
  // uma copa para a outra virava degrau de pixel no ladrilho ampliado.
  if (segundo !== null) c = misturar(corDaCopa(segundo, cfg.chao, miudo + cacho), c, 0.5 + 0.5 * passoSuave(0, 0.06, aqui.altura - segundo.altura))
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
// Bosque (pedido de 10/10/2026: "achei as árvores muito juntas... outra
// textura de floresta com árvores mais espaçadas"): as MESMAS copas da
// Floresta (forma, cores e luz), espalhadas sem grade sobre um chão de capim
// que aparece entre elas. Um campo de "mata" decide onde elas se ajuntam em
// grupinhos (com mato mais escuro por baixo) e onde abrem clareira; entre duas
// copas sempre sobra chão (distância mínima). O ladrilho é três vezes o da
// Floresta, para o desenho dos grupinhos não se repetir à vista.

/** Lado do ladrilho do Bosque, em px do protótipo do relevo. */
const BOSQUE_ESCALA = 120
/** 1 px do protótipo, em lados do ladrilho do Bosque. */
const BOSQUE_PX = 1 / BOSQUE_ESCALA
const BOSQUE_RAIO = { muda: [1.5, 2.1], arvore: [2.4, 3.4] } as const
/** Chance de uma árvore sair muda (menor), para o grupinho não ter tudo do mesmo tamanho. */
const BOSQUE_MUDAS = 0.16
/** Chão que sobra entre duas copas, em px do protótipo: pouco no grupinho, mais no aberto. */
const BOSQUE_FOLGA = { grupo: 0.7, aberto: 2.6 } as const
/** Para onde cai a sombra da copa (para baixo à direita, longe da luz), em px do protótipo. */
const BOSQUE_SOMBRA = 1.3
/** O recorte da borda da folhosa passa do raio em até 11,5% (`umaCopa`). */
const BOSQUE_LOBULO = 1.12
/** Células por lado da grade de busca das copas (~3 px do protótipo cada). */
const BOSQUE_GRADE = 40

const BOSQUE_COPAS: FormaDaCopa = { forma: 'domo', galhos: 0, cores: FLORESTA.cores }
/** A borda da copa escurece para este verde (a sombra da própria copa no mato). */
const BOSQUE_BORDA = rgb('#15604a')
const BOSQUE_CAPIM = rgb('#58945f')
const BOSQUE_CAPIM_CLARO = rgb('#639f62')
const BOSQUE_MATO = rgb('#4b845b')

/** Onde a mata se ajunta (1) ou abre clareira (0). Periódico no ladrilho. */
function mataDoBosque(u: number, v: number): number {
  return passoSuave(-0.25, 0.35, fbm(u, v, 6, 2, 141))
}

interface Arvores {
  arvores: Espalhamento
  /** Onde cada copa alcança (a borda lobulada passa do raio em até 12%). */
  copas: Cobertura
}

let arvoresDoBosque: Arvores | null = null

/** As árvores do Bosque: sorteadas uma vez (no primeiro ladrilho) e guardadas. */
function arvores(): Arvores {
  if (arvoresDoBosque !== null) return arvoresDoBosque
  const sorteadas = espalhar({
    semente: 142,
    dardos: 7000,
    grade: 12,
    raio: (s) => {
      const [min, max] = s < BOSQUE_MUDAS ? BOSQUE_RAIO.muda : BOSQUE_RAIO.arvore
      const t = s < BOSQUE_MUDAS ? s / BOSQUE_MUDAS : (s - BOSQUE_MUDAS) / (1 - BOSQUE_MUDAS)
      return (min + (max - min) * t) * BOSQUE_PX
    },
    fica: (x, y, s) => s < 0.03 + 0.97 * mataDoBosque(x, y) ** 1.3,
    distanciaMinima: (p, q) => {
      const folga = BOSQUE_FOLGA.aberto + (BOSQUE_FOLGA.grupo - BOSQUE_FOLGA.aberto) * mataDoBosque(p.x, p.y)
      return p.r + q.r + folga * BOSQUE_PX
    },
  })
  arvoresDoBosque = { arvores: sorteadas, copas: cobertura(sorteadas, (p) => p.r * BOSQUE_LOBULO, BOSQUE_GRADE) }
  return arvoresDoBosque
}

/** A copa do Bosque no ponto (as copas não se tocam, então há no máximo uma). */
function copaDoBosque(u: number, v: number): CopaNoPonto | null {
  let achada = null as CopaNoPonto | null
  const { arvores: todas, copas } = arvores()
  pontosQueAlcancam(todas, copas, u, v, (p, dx, dy) => {
    if (achada !== null) return
    const tamanho = (p.r / BOSQUE_PX - BOSQUE_RAIO.muda[0]) / (BOSQUE_RAIO.arvore[1] - BOSQUE_RAIO.muda[0])
    achada = umaCopa(dx / BOSQUE_PX, dy / BOSQUE_PX, p.r / BOSQUE_PX, tamanho, p.a * Math.PI * 2, p.b, BOSQUE_COPAS)
  })
  return achada
}

function bosque(u: number, v: number): number {
  const mata = mataDoBosque(u, v)
  const miudo = (valor(u * 288, v * 288, 288, 148) - 0.5) * 0.08
  const aqui = copaDoBosque(u, v)
  // Sombra: a copa que está para cima à esquerda (de onde vem a luz) cai aqui.
  const la = copaDoBosque(u - BOSQUE_SOMBRA * BOSQUE_PX, v - BOSQUE_SOMBRA * BOSQUE_PX)
  if (aqui !== null) {
    const cacho = (valor(u * 96, v * 96, 96, 149) - 0.5) * 0.14
    const c = corDaCopa(aqui, BOSQUE_BORDA, miudo + cacho)
    // A copa vizinha mais alta escurece a beirada desta (no Bosque, raro).
    const sombra = la === null ? 0 : passoSuave(0.05, 0.35, la.altura - aqui.altura)
    return empacotar(luz(c, -0.18 * sombra))
  }
  // O chão: capim em manchas largas, mato mais escuro onde a mata se ajunta,
  // moitas miúdas e o grão do capim.
  let c = misturar(BOSQUE_CAPIM, BOSQUE_CAPIM_CLARO, passoSuave(0.25, 0.8, fbm(u, v, 5, 3, 143) * 0.5 + 0.5))
  c = misturar(c, BOSQUE_MATO, passoSuave(0.3, 0.95, mata) * 0.35)
  c = misturar(c, BOSQUE_MATO, passoSuave(0.6, 0.95, fbm(u, v, 16, 2, 144) * 0.5 + 0.5) * 0.45)
  const sombra = la === null ? 0 : passoSuave(0.0, 0.5, la.altura) * (0.55 + 0.45 * la.borda)
  return empacotar(luz(c, -0.24 * sombra + miudo))
}

// ---------------------------------------------------------------------------
// Chão de floresta (pedido de 10/10/2026: "uma floresta escura mas tipo uma
// textura só do chão sem árvores"): o chão de mata fechada visto de cima, para
// ficar POR BAIXO dos carimbos de árvore. Parte do verde escuro chapado que o
// mestre já usa (#1f3a1f): manchas de musgo e de terra escura, folhas caídas
// miúdas, raízes finas soltas e umas manchas de sol filtrado. Nada de copa
// (os carimbos são as árvores) e contraste baixo, para pino, nome e ficha
// lerem por cima. Raiz é curta, torta e sem direção: não vira hachura.

const CHAO_ESCALA = 96
const CHAO_PX = 1 / CHAO_ESCALA
const CHAO_BASE = rgb('#1f3a1f')
const CHAO_MUSGO = rgb('#284b25')
const CHAO_TERRA = rgb('#1f2e1b')
const CHAO_SOL = rgb('#36552c')
const CHAO_FOLHAS: readonly Rgb[] = [rgb('#2c3c1e'), rgb('#34391d'), rgb('#26421f'), rgb('#3b3b20'), rgb('#223a20'), rgb('#403a22')]

interface FormaDaRaiz {
  cos: number
  sen: number
  comprimento: number
  curva: number
}

interface ChaoDeFloresta {
  raizes: Espalhamento
  formas: readonly FormaDaRaiz[]
  alcanceDasRaizes: Cobertura
  sol: Espalhamento
  alcanceDoSol: Cobertura
}

let chaoDeFloresta: ChaoDeFloresta | null = null

function pecasDoChao(): ChaoDeFloresta {
  if (chaoDeFloresta !== null) return chaoDeFloresta
  // Raízes: o ponto é onde a raiz começa; ela corre para um lado sorteado e entorta.
  const raizes = espalhar({
    semente: 221,
    dardos: 60,
    grade: 8,
    raio: (s) => (4 + 5 * s) * CHAO_PX,
    fica: () => true,
    distanciaMinima: () => 6 * CHAO_PX,
  })
  const formas = raizes.pontos.map((p) => {
    const angulo = p.a * Math.PI * 2
    return { cos: Math.cos(angulo), sen: Math.sin(angulo), comprimento: p.r, curva: (p.b - 0.5) * 0.7 }
  })
  const sol = espalhar({
    semente: 231,
    dardos: 140,
    grade: 16,
    raio: (s) => (2.5 + 4.5 * s * s) * CHAO_PX,
    fica: () => true,
    distanciaMinima: (p, q) => p.r + q.r + 3 * CHAO_PX,
  })
  chaoDeFloresta = {
    raizes,
    formas,
    alcanceDasRaizes: cobertura(raizes, (p) => p.r + 0.6 * CHAO_PX, 24),
    sol,
    alcanceDoSol: cobertura(sol, (p) => p.r, 24),
  }
  return chaoDeFloresta
}

/** Folha caída mais de cima no ponto: elipse miúda de lado sorteado, ou `null`. */
function folhaNoPonto(u: number, v: number): { cor: Rgb; borda: number } | null {
  let achada = null as { cor: Rgb; borda: number; altura: number } | null
  vizinhos(u, v, 72, 211, 0.45, (p) => {
    const altura = hash(p.ix, p.iy, 212)
    if (altura > 0.72 || (achada !== null && altura <= achada.altura)) return
    // Direção sorteada sem seno: um vetor de dois sorteios, normalizado.
    const ax = hash(p.ix, p.iy, 213) - 0.5
    const ay = hash(p.ix, p.iy, 214) - 0.5
    const n = Math.hypot(ax, ay) || 1
    const comprida = 0.42 + 0.3 * hash(p.ix, p.iy, 215)
    const lx = (p.dx * ax + p.dy * ay) / n / comprida
    const ly = (-p.dx * ay + p.dy * ax) / n / (comprida * 0.5)
    const e = lx * lx + ly * ly
    if (e >= 1) return
    const cor = CHAO_FOLHAS[Math.floor(hash(p.ix, p.iy, 216) * CHAO_FOLHAS.length) % CHAO_FOLHAS.length]
    achada = { cor, borda: passoSuave(1, 0.55, e), altura }
  })
  return achada
}

function chaoDaFloresta(u: number, v: number): number {
  const pecas = pecasDoChao()
  const tu = u + fbm(u, v, 3, 2, 203) * 0.03
  const tv = v + fbm(u, v, 3, 2, 204) * 0.03
  // Musgo e terra escura em manchas tortas, fracas.
  let c = misturar(CHAO_BASE, CHAO_MUSGO, passoSuave(0.55, 0.9, fbm(tu, tv, 7, 3, 201) * 0.5 + 0.5) * 0.9)
  c = misturar(c, CHAO_TERRA, passoSuave(0.58, 0.9, fbm(tu, tv, 6, 3, 202) * 0.5 + 0.5) * 0.9)
  const folha = folhaNoPonto(u, v)
  if (folha !== null) c = misturar(c, folha.cor, folha.borda)
  // Raízes: finas, afinando para a ponta, um pouco mais escuras que o chão.
  let raiz = 0
  pontosQueAlcancam(pecas.raizes, pecas.alcanceDasRaizes, u, v, (_p, dx, dy, i) => {
    const f = pecas.formas[i]
    const ao = (dx * f.cos + dy * f.sen) / CHAO_PX
    if (ao <= 0 || ao >= f.comprimento / CHAO_PX) return
    const t = ao / (f.comprimento / CHAO_PX)
    const at = (-dx * f.sen + dy * f.cos) / CHAO_PX - f.curva * ao * t
    const largura = 0.34 * (1 - 0.65 * t)
    raiz = Math.max(raiz, passoSuave(largura, largura * 0.35, Math.abs(at)) * passoSuave(0, 0.08, t))
  })
  c = luz(c, -0.22 * raiz)
  // Sol filtrado pela copa: manchas macias, um tom mais claro e mais quente.
  // O ruído recorta cada mancha em retalhos (a luz passa entre as folhas): sem bolinha redonda.
  let sol = 0
  const su = u + fbm(u, v, 8, 2, 206) * 0.025
  const sv = v + fbm(u, v, 8, 2, 207) * 0.025
  pontosQueAlcancam(pecas.sol, pecas.alcanceDoSol, su, sv, (p, dx, dy) => {
    const d2 = (dx * dx + dy * dy) / (p.r * p.r)
    if (d2 < 1) sol = Math.max(sol, (1 - d2) ** 2)
  })
  if (sol > 0) sol *= passoSuave(0.4, 0.7, fbm(u, v, 20, 2, 208) * 0.5 + 0.5)
  c = misturar(c, CHAO_SOL, sol * 0.75)
  return empacotar(luz(c, (valor(u * 300, v * 300, 300, 205) - 0.5) * 0.06))
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
//
// Refeito em 10/10/2026 ("o padrão do pântano é extremamente óbvio"): a água
// era um ruído de três manchas por ladrilho, e o ladrilho pequeno (48) repetia
// as mesmas manchas em diagonal pelo mapa. Agora o ladrilho é três vezes
// maior e a água são POÇAS soltas, espalhadas sem grade (`espalhar.ts`), de
// tamanhos e alongamentos sorteados, que se fundem quando ficam perto; o chão
// é torcido pelo próprio ruído (distorção de domínio), então nenhuma borda é
// círculo nem se alinha com a vizinha. Os juncos nascem na beira das poças.

const PANTANO_ESCALA = 144
const PANTANO_PX = 1 / PANTANO_ESCALA
/** Raio das poças, em px do protótipo: muitas pequenas, poucas grandes. */
const POCA_RAIO = [2.8, 10] as const
/** A influência da poça vai até 1,6 raio (o núcleo do "metaball"); 1 raio = a margem da água. */
const POCA_ALCANCE = 1.6
/** O campo de uma poça sozinha bem na margem dela: (1 - 1/1,6²)². */
const LIMIAR_DA_AGUA = (1 - 1 / POCA_ALCANCE ** 2) ** 2
/** O quanto o chão é torcido antes de medir a poça, em px do protótipo. */
const TORCAO = { larga: 5.5, miuda: 1.2 } as const
/** Células por lado da grade de busca das poças (3 px do protótipo cada). */
const POCA_GRADE = 48

const AGUA_FUNDA = rgb('#2f6b66')
const AGUA_RASA = rgb('#3d7f77')
const MATO = rgb('#5c8f71')
const MATO_SECO = rgb('#6f9673')
const MARGEM = rgb('#4a7563')

/** Onde o brejo é mais encharcado (mais poças): largo e fraco, só para a água não sair uniforme. */
function encharcado(u: number, v: number): number {
  return passoSuave(-0.6, 0.6, fbm(u, v, 3, 2, 182))
}

interface FormaDaPoca {
  cos: number
  sen: number
  /** Raiz do alongamento: o eixo longo é r·k, o curto r/k (a área fica). */
  k: number
}

interface Pocas {
  pocas: Espalhamento
  formas: readonly FormaDaPoca[]
  /** Onde cada poça alcança (o eixo longo dela). */
  alcance: Cobertura
}

let pocasDoPantano: Pocas | null = null

function pocas(): Pocas {
  if (pocasDoPantano !== null) return pocasDoPantano
  const pocas = espalhar({
    semente: 181,
    dardos: 650,
    grade: 14,
    raio: (s) => (POCA_RAIO[0] + (POCA_RAIO[1] - POCA_RAIO[0]) * s ** 1.8) * PANTANO_PX,
    fica: (x, y, s) => s < 0.45 + 0.3 * encharcado(x, y),
    // Perto o bastante para umas se fundirem (a poça grande de borda torta),
    // longe o bastante para não virar um lago só.
    distanciaMinima: (p, q) => (p.r + q.r) * 0.8 + 0.8 * PANTANO_PX,
  })
  const formas = pocas.pontos.map((p) => {
    const angulo = p.a * Math.PI
    return { cos: Math.cos(angulo), sen: Math.sin(angulo), k: Math.sqrt(1 + 0.8 * p.b) }
  })
  const alcance = cobertura(pocas, (p) => p.r * Math.sqrt(1 + 0.8 * p.b) * POCA_ALCANCE, POCA_GRADE)
  pocasDoPantano = { pocas, formas, alcance }
  return pocasDoPantano
}

/** O campo da água em (u, v) já torcido: cada poça soma um domo macio; acima do limiar, é água. */
function campoDaAgua(u: number, v: number): number {
  const { pocas: todas, formas, alcance } = pocas()
  let soma = 0
  pontosQueAlcancam(todas, alcance, u, v, (p, dx, dy, i) => {
    const f = formas[i]
    const ao = (dx * f.cos + dy * f.sen) / f.k
    const at = (-dx * f.sen + dy * f.cos) * f.k
    const d2 = (ao * ao + at * at) / (p.r * POCA_ALCANCE) ** 2
    if (d2 < 1) soma += (1 - d2) ** 2
  })
  return soma
}

/** O chão torcido pelo ruído (distorção de domínio): borda de poça nenhuma sai redonda. */
function torcido(u: number, v: number): [number, number] {
  const tu = fbm(u, v, 5, 2, 183) * TORCAO.larga + fbm(u, v, 18, 2, 185) * TORCAO.miuda
  const tv = fbm(u, v, 5, 2, 184) * TORCAO.larga + fbm(u, v, 18, 2, 186) * TORCAO.miuda
  return [u + tu * PANTANO_PX, v + tv * PANTANO_PX]
}

let juncosDoPantano: Espalhamento | null = null

/** Os juncos: tufos espalhados, quase todos na beira úmida das poças. */
function juncos(): Espalhamento {
  juncosDoPantano ??= espalhar({
    semente: 191,
    dardos: 9000,
    grade: 48,
    raio: (s) => (0.3 + 0.25 * s) * PANTANO_PX,
    fica: (x, y, s) => {
      const [tx, ty] = torcido(x, y)
      const campo = campoDaAgua(tx, ty)
      const beira = passoSuave(LIMIAR_DA_AGUA * 0.25, LIMIAR_DA_AGUA * 0.8, campo) * passoSuave(LIMIAR_DA_AGUA * 1.02, LIMIAR_DA_AGUA * 0.9, campo)
      return s < 0.04 + 0.7 * beira
    },
    distanciaMinima: (p, q) => p.r + q.r + 0.5 * PANTANO_PX,
  })
  return juncosDoPantano
}

function pantano(u: number, v: number): number {
  const [tu, tv] = torcido(u, v)
  const campo = campoDaAgua(tu, tv)
  const agua = passoSuave(LIMIAR_DA_AGUA * 0.9, LIMIAR_DA_AGUA * 1.1, campo)
  const aguaCor = misturar(AGUA_RASA, AGUA_FUNDA, passoSuave(LIMIAR_DA_AGUA * 1.1, LIMIAR_DA_AGUA * 3.5, campo))
  let terra = misturar(MATO, MATO_SECO, passoSuave(0.3, 0.8, fbm(u, v, 18, 3, 82) * 0.5 + 0.5))
  terra = misturar(MARGEM, terra, passoSuave(LIMIAR_DA_AGUA * 0.92, LIMIAR_DA_AGUA * 0.45, campo))
  let junco = 0
  pontosPerto(juncos(), u, v, 0.6 * PANTANO_PX, (p, dx, dy) => {
    junco = Math.max(junco, passoSuave(p.r, p.r * 0.45, Math.hypot(dx, dy)))
  })
  terra = luz(terra, -0.16 * junco)
  const c = misturar(terra, aguaCor, agua)
  // Um sopro largo de luz (mais seco, mais úmido) e o grão.
  const sopro = fbm(u, v, 4, 2, 187) * 0.025
  return empacotar(luz(c, sopro + (valor(u * 256, v * 256, 256, 85) - 0.5) * 0.04))
}

// ---------------------------------------------------------------------------
// Terra: chão batido castanho (do #a68d5d do mapa) com manchas úmidas e
// pedrinhas claras com luz e sombra.
//
// Revista em 10/10/2026 (na conferência do Pântano): as manchas eram três por
// ladrilho de 32, e de longe a terra virava uma grade de borrões escuros em
// fileira. Agora o ladrilho é três vezes maior, as manchas têm o mesmo tamanho
// de antes (nove por lado) e o chão é torcido pelo ruído antes de medi-las:
// nenhuma sai na mesma linha da vizinha. As pedrinhas ficaram do mesmo tamanho.

const TERRA_ESCALA = 96
const TERRA_CLARA = rgb('#a08559')
const TERRA_ESCURA = rgb('#8c7150')
const PEDRINHA = rgb('#a89574')

function terra(u: number, v: number): number {
  const tu = u + fbm(u, v, 3, 2, 96) * 0.03
  const tv = v + fbm(u, v, 3, 2, 97) * 0.03
  let c = misturar(TERRA_CLARA, TERRA_ESCURA, passoSuave(0.3, 0.75, fbm(tu, tv, 9, 4, 91) * 0.5 + 0.5))
  c = luz(c, (valor(u * 300, v * 300, 300, 92) - 0.5) * 0.06)
  // Pedrinhas: poucas, no tom da terra só um pouco mais claro, com luz em cima
  // à esquerda e a sombra caindo para baixo à direita. Clara e miúda demais,
  // virava pontilhado branco por cima do chão.
  const pedrinhaEm = (pu: number, pv: number) => {
    let achada = null as { t: number; nx: number; ny: number } | null
    vizinhos(pu, pv, 42, 93, 0.32, (p) => {
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
    const sombra = pedrinhaEm(u - 0.002, v - 0.002)
    return empacotar(sombra === null ? c : luz(c, -0.12 * passoSuave(1, 0.6, sombra.t)))
  }
  const { t, nx, ny } = pedrinha
  const brilho = luzNaInclinacao(nx * 1.4, ny * 1.4) - LUZ_NO_PLANO
  const pedra = luz(PEDRINHA, brilho * 0.3)
  return empacotar(misturar(c, pedra, passoSuave(1, 0.8, t)))
}

// ---------------------------------------------------------------------------
// Chão de masmorra, medido em CASAS da grade (`DefinicaoDeTextura.casas`):
// a tábua e a lajota têm o tamanho certo contra a casa (1,5 m) em qualquer
// mapa. Pedido de 10/10/2026: "uma textura de chão de madeira de um barco" e
// "um chão de tijolos de pedra de uma base da marinha".

/** Uma volta sem emenda em [0, 1). */
function naVoltaDoLadrilho(t: number): number {
  return t - Math.floor(t)
}

/** Ruído de valor sem período (período enorme): para o veio, medido na tábua e não no ladrilho. */
const SEM_PERIODO = 1 << 20

// Convés: tábuas compridas ao longo do comprimento do navio (na horizontal),
// quatro por casa (~37 cm cada: tábua larga de convés), com as emendas das
// pontas desencontradas fila a fila. A junta é larga e macia, de contraste
// baixo (de longe, nenhuma risca fina); o veio corre ao longo da tábua,
// fraco; uma ou outra tábua mais clara ou mais escura; cavilhas quase
// invisíveis nas pontas. Nos marrons do convés do mestre (#2e1a0c).

const CONVES_CASAS = 8
const CONVES_TABUAS_POR_CASA = 4
const CONVES_FILAS = CONVES_CASAS * CONVES_TABUAS_POR_CASA
/** Comprimento das tábuas, em casas (3 a 4,5 m). */
const CONVES_COMPRIMENTO = [2, 3] as const
/** Duas emendas de filas vizinhas nunca ficam mais perto que isto, em casas. */
const CONVES_EMENDA_MINIMA = 0.6
const CONVES_TONS: readonly Rgb[] = [rgb('#2e1a0c'), rgb('#311c0d'), rgb('#2c190b'), rgb('#331e0e'), rgb('#2f1b0c')]

/** As emendas de cada fila (início de cada tábua, em [0, 1) do ladrilho), em ordem. */
let emendasDoConves: readonly (readonly number[])[] | null = null

function emendas(): readonly (readonly number[])[] {
  if (emendasDoConves !== null) return emendasDoConves
  const sorteio = sorteador(301)
  const filas: number[][] = []
  for (let f = 0; f < CONVES_FILAS; f += 1) {
    const anterior = f > 0 ? filas[f - 1] : []
    let melhor: number[] = []
    // Algumas tentativas até nenhuma emenda cair perto da emenda da fila de cima.
    for (let tentativa = 0; tentativa < 12; tentativa += 1) {
      const quantas = Math.max(1, Math.round(CONVES_CASAS / (CONVES_COMPRIMENTO[0] + (CONVES_COMPRIMENTO[1] - CONVES_COMPRIMENTO[0]) * sorteio())))
      const pesos = Array.from({ length: quantas }, () => 0.75 + 0.5 * sorteio())
      const soma = pesos.reduce((a, b) => a + b, 0)
      const inicio = sorteio()
      let pos = inicio
      const fila = pesos.map((p) => {
        const aqui = naVoltaDoLadrilho(pos)
        pos += p / soma
        return aqui
      })
      fila.sort((a, b) => a - b)
      melhor = fila
      const perto = fila.some((e) => anterior.some((a) => Math.abs(naVolta(e - a)) * CONVES_CASAS < CONVES_EMENDA_MINIMA))
      if (!perto) break
    }
    filas.push(melhor)
  }
  emendasDoConves = filas
  return filas
}

function conves(u: number, v: number): number {
  // Meia tábua de deslocamento: a emenda do ladrilho cai no meio da tábua, nunca numa junta.
  const y = naVoltaDoLadrilho(v) * CONVES_FILAS + 0.5
  const fila = Math.floor(y) % CONVES_FILAS
  const fy = y - Math.floor(y)
  const doFila = emendas()[fila]
  const x = naVoltaDoLadrilho(u)
  // A tábua: a última emenda antes de x (dando a volta).
  let k = doFila.length - 1
  for (let i = 0; i < doFila.length; i += 1) if (doFila[i] <= x) k = i
  const inicio = doFila[k]
  const fim = doFila[(k + 1) % doFila.length]
  // Em casas, ao longo da tábua: contínuo através da emenda do ladrilho.
  const lx = naVoltaDoLadrilho(x - inicio) * CONVES_CASAS
  const comprimento = (naVoltaDoLadrilho(fim - inicio) || 1) * CONVES_CASAS
  const tabua = Math.round(inicio * 4096) + fila * 7919
  let c = CONVES_TONS[Math.floor(hash(tabua, fila, 302) * CONVES_TONS.length) % CONVES_TONS.length]
  c = luz(c, (hash(tabua, fila, 303) - 0.5) * 0.07)
  // O veio: manchas compridas ao longo da tábua, fracas, um pouco onduladas.
  const onda = (valor(lx * 0.6, fy * 2, SEM_PERIODO, tabua) - 0.5) * 0.5
  const veio = valor(lx * 1.1, (fy + onda) * 3, SEM_PERIODO, tabua + 1) - 0.5
  const no = valor(lx * 0.35, fy * 1.2, SEM_PERIODO, tabua + 2) - 0.5
  c = luz(c, veio * 0.07 + no * 0.06)
  // Juntas: as compridas entre as filas e as das pontas, largas e macias.
  const borda = Math.min(fy, 1 - fy)
  const ponta = Math.min(lx, comprimento - lx) * CONVES_TABUAS_POR_CASA
  const junta = Math.max(passoSuave(0.13, 0, borda), passoSuave(0.1, 0, ponta) * 0.85)
  // A beirada da tábua de baixo da junta pega a luz (vem de cima); a de cima fica na sombra.
  const chanfro = passoSuave(0.22, 0.05, fy) * 0.035 - passoSuave(0.78, 0.95, fy) * 0.035
  c = luz(c, chanfro - junta * 0.2)
  // Cavilhas nas pontas da tábua, quase invisíveis.
  let cavilha = 0
  for (const ly of [0.3, 0.7]) {
    for (const px of [0.22, comprimento * CONVES_TABUAS_POR_CASA - 0.22]) {
      const d = Math.hypot(lx * CONVES_TABUAS_POR_CASA - px, fy - ly)
      cavilha = Math.max(cavilha, passoSuave(0.07, 0.03, d))
    }
  }
  c = luz(c, -0.07 * cavilha)
  return empacotar(luz(c, (valor(u * 640, v * 640, 640, 304) - 0.5) * 0.03))
}

// Lajotas de pedra: o piso de uma base militar (a da Marinha, de One Piece):
// lajotas retangulares grandes (1 × ½ casa) em fiada, a fila de baixo meia
// lajota adiante; pedra clara e limpa entre o cinza e o bege, cada lajota no
// seu tom, juntas finas e macias, o chanfro de cima à esquerda pegando a luz.

const LAJOTA_CASAS = 8
const LAJOTA_FILAS = LAJOTA_CASAS * 2
const LAJOTA_TONS: readonly Rgb[] = [rgb('#cdc8bc'), rgb('#c9c5bc'), rgb('#cfc9bc'), rgb('#c7c3b9'), rgb('#ccc6b9'), rgb('#c9c4b8')]
const LAJOTA_JUNTA = rgb('#a9a397')

function lajotas(u: number, v: number): number {
  // A emenda do ladrilho cai no meio das lajotas (um quarto e três quartos), nunca numa junta.
  const y = naVoltaDoLadrilho(v) * LAJOTA_FILAS + 0.5
  const fila = Math.floor(y) % LAJOTA_FILAS
  const fy = y - Math.floor(y)
  const x = naVoltaDoLadrilho(u) * LAJOTA_CASAS + (fila % 2 === 1 ? 0.75 : 0.25)
  const coluna = Math.floor(x) % LAJOTA_CASAS
  const fx = x - Math.floor(x)
  let c = LAJOTA_TONS[Math.floor(hash(coluna, fila, 311) * LAJOTA_TONS.length) % LAJOTA_TONS.length]
  c = luz(c, (hash(coluna, fila, 312) - 0.5) * 0.025)
  // A superfície: manchas largas e fracas da pedra e o grão miúdo.
  c = luz(c, fbm(u, v, 12, 3, 313) * 0.025 + (valor(u * 700, v * 700, 700, 314) - 0.5) * 0.035)
  // Distância às bordas da lajota, em casas (a lajota tem 1 × ½ casa).
  const bx = Math.min(fx, 1 - fx)
  const by = Math.min(fy, 1 - fy) * 0.5
  const borda = Math.min(bx, by)
  // Chanfro: o lado de cima à esquerda clareia, o de baixo à direita escurece.
  const cima = Math.min(fx, fy * 0.5)
  const baixo = Math.min(1 - fx, (1 - fy) * 0.5)
  c = luz(c, passoSuave(0.05, 0.015, cima) * 0.04 - passoSuave(0.05, 0.015, baixo) * 0.045)
  c = misturar(c, LAJOTA_JUNTA, passoSuave(0.022, 0.006, borda) * 0.75)
  return empacotar(c)
}

/** A biblioteca inicial, na ordem do painel (do litoral para a montanha). */
export const TEXTURAS_EMBUTIDAS: readonly DefinicaoDeTextura[] = [
  { id: 'areia', nome: 'Areia', escala: 36, cor: areia },
  { id: 'duna', nome: 'Duna', escala: 64, cor: duna },
  { id: 'grama', nome: 'Campo', escala: 30, cor: grama },
  { id: 'floresta', nome: 'Floresta', escala: 40, cor: (u, v) => copas(u, v, FLORESTA) },
  { id: 'bosque', nome: 'Bosque', escala: BOSQUE_ESCALA, lado: LADO_GRANDE, cor: bosque },
  { id: 'pinheiros', nome: 'Pinheiros', escala: 36, cor: (u, v) => copas(u, v, PINHEIROS) },
  { id: 'chao-de-floresta', nome: 'Chão de floresta', escala: CHAO_ESCALA, lado: LADO_GRANDE, cor: chaoDaFloresta },
  { id: 'pantano', nome: 'Pântano', escala: PANTANO_ESCALA, lado: LADO_GRANDE, cor: pantano },
  { id: 'terra', nome: 'Terra', escala: TERRA_ESCALA, lado: LADO_GRANDE, cor: terra },
  { id: 'pedra', nome: 'Serra', escala: 56, cor: pedra },
  { id: 'neve', nome: 'Neve', escala: 56, cor: neve },
  // Chão de masmorra (medido em casas da grade): a escala só serve à miniatura.
  { id: 'conves', nome: 'Convés', escala: 64, casas: CONVES_CASAS, lado: LADO_MAIOR, cor: conves },
  { id: 'lajotas', nome: 'Lajotas de pedra', escala: 64, casas: LAJOTA_CASAS, lado: LADO_GRANDE, cor: lajotas },
]

/** Ids da biblioteca: o pacote não pode usar (a embutida ganha, como nas animações). */
export const IDS_DAS_EMBUTIDAS: readonly string[] = TEXTURAS_EMBUTIDAS.map((t) => t.id)
