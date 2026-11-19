/**
 * O JUDGE NA BATALHA (fatia J da F3, seções 2.2 e 3.1 de
 * docs/planos/batalha-one-piece-f3-plano.md, com Q7 e Q8 no fim do plano): o
 * juiz que fica no mapa enquanto a batalha está ligada, por cima das fichas e
 * sempre visível. Vira para a ficha da vez que a tela vê (Q8: vez fora da
 * vista = fica como estava) e ergue a carta quando o MESTRE desfaz uma linha.
 *
 * Aqui só a regra: a posição (`JudgeNaCena`, na sessão do mestre e no
 * `batalha.estado`), a direção, o quadro da folha a cada instante, a posição
 * inicial (perto do grupo da batalha: `judgePertoDoGrupo`) e a lembrança por
 * mapa no aparelho do mestre. O desenho é do `pixi/judgeDoMapa.ts`. A direção
 * nem vai ao fio: cada tela calcula. Quem lê o mapa aberto para a posição
 * inicial é `ondeNasceOJudge.ts`.
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

import type { Casa } from './blocos'

/** Px do mundo, mesma convenção de `Token.x/y`: o centro da casa (os pés do Judge). */
export interface JudgeNaCena {
  x: number
  y: number
}

/** Linha da folha: sul, sudeste, leste, nordeste, norte, noroeste, oeste, sudoeste. */
export type DirecaoDoJudge = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

/**
 * A folha `docs/design/judge/v2-mcp/judge-folha.json`: 8 direções x 20
 * quadros, 1-12 a respiração em laço, 13-20 erguer a carta. Conferir contra o
 * `.json` ao trocar a folha.
 */
// `as const`: fixa os números como literais de leitura (não é cast de tipo).
export const FOLHA_DO_JUDGE = {
  quadro: { largura: 192, altura: 240 },
  pxPorCasa: 64,
  chao: { x: 96, y: 200.3 },
  colunas: 20,
  linhas: 8,
  fps: 12,
  respiracao: { inicio: 0, quadros: 12 },
  erguer: { inicio: 12, quadros: 8 },
} as const

/** Quanto a carta fica erguida, parada no último quadro. */
export const SEGURA_A_CARTA_MS = 1000
/** Um passo da virada (uma direção da folha por vez). */
export const PASSO_DA_VIRADA_MS = 70
/** Movimento reduzido: a carta aparece erguida e parada por este tempo. */
export const CARTA_REDUZIDA_MS = 1500
/** Teto de cada coordenada no fio e no aparelho (o mesmo do `batalha.estado`). */
export const COORDENADA_DO_JUDGE_MAX = 1_000_000
/** Antes da primeira vez visível, ele olha para o sul (de frente para a tela). */
export const DIRECAO_INICIAL: DirecaoDoJudge = 0
/** Casas ao norte da primeira ficha da ordem onde ele nasce (sem o mapa à mão: `judgeInicial`). */
const CASAS_AO_NORTE = 2
/**
 * Pedido de 19/11/2026 ("em mapas muito grande coloco o Juiz para nascer perto
 * dos jogadores da batalha"): o lugar lembrado deste mapa só vale a até tantos
 * blocos da batalha. Mais longe, é de outra luta noutro canto do mapa.
 */
export const BLOCOS_DO_LEMBRADO = 6
/** Até quantos blocos dos combatentes ele procura casa (a busca nunca anda o mapa inteiro). */
const BLOCOS_DA_BUSCA = 8

const DIRECOES: readonly DirecaoDoJudge[] = [0, 1, 2, 3, 4, 5, 6, 7]
const QUADRO_MS = 1000 / FOLHA_DO_JUDGE.fps
const SOBE_MS = FOLHA_DO_JUDGE.erguer.quadros * QUADRO_MS
const DESCE_DESDE_MS = SOBE_MS + SEGURA_A_CARTA_MS
const GESTO_MS = DESCE_DESDE_MS + SOBE_MS
const ULTIMA_DO_ERGUER = FOLHA_DO_JUDGE.erguer.inicio + FOLHA_DO_JUDGE.erguer.quadros - 1

/** Resto sempre positivo (o `%` do JS devolve negativo para negativo). */
function modulo(valor: number, divisor: number): number {
  return ((valor % divisor) + divisor) % divisor
}

/** A direção do índice 0..7 (qualquer inteiro dá a volta). */
function direcaoDoIndice(indice: number): DirecaoDoJudge {
  return DIRECOES[modulo(indice, DIRECOES.length)] ?? DIRECAO_INICIAL
}

function coordenadaValida(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && Math.abs(valor) <= COORDENADA_DO_JUDGE_MAX
}

/**
 * Lê `{ x, y }` de fonte hostil (o fio, o aparelho): números finitos dentro do
 * teto. Campo a mais é ignorado e não sai. Torto = `null`.
 */
export function lerJudgeNaCena(valor: unknown): JudgeNaCena | null {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return null
  const x: unknown = Reflect.get(valor, 'x')
  const y: unknown = Reflect.get(valor, 'y')
  if (!coordenadaValida(x) || !coordenadaValida(y)) return null
  return { x, y }
}

/**
 * Para onde ele olha para ver `alvo`, pelo ângulo na tela (y para baixo):
 * `round((90 - graus(atan2(dy, dx))) / 45) mod 8`. Mesma posição (ou número
 * torto): `null`, e ele fica como está.
 */
export function direcaoPara(judge: JudgeNaCena, alvo: { x: number; y: number }): DirecaoDoJudge | null {
  const dx = alvo.x - judge.x
  const dy = alvo.y - judge.y
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return null
  const graus = (Math.atan2(dy, dx) * 180) / Math.PI
  return direcaoDoIndice(Math.round((90 - graus) / 45))
}

/**
 * Q8: a direção depois de olhar para a ficha da vez. `alvo` null (vez sem
 * ficha que esta tela vê) ou na mesma casa dele: fica como estava.
 */
export function direcaoSeguinte(atual: DirecaoDoJudge, judge: JudgeNaCena, alvo: { x: number; y: number } | null): DirecaoDoJudge {
  if (alvo === null) return atual
  return direcaoPara(judge, alvo) ?? atual
}

/**
 * As direções que ele passa até `para`, sem a de partida, pelo lado mais
 * curto; o oposto gira pelo índice crescente. `(0, 4) = [1, 2, 3, 4]`,
 * `(7, 1) = [0, 1]`, `(3, 3) = []`.
 */
export function passosDaVirada(de: DirecaoDoJudge, para: DirecaoDoJudge): DirecaoDoJudge[] {
  const diferenca = modulo(para - de, DIRECOES.length)
  if (diferenca === 0) return []
  const sentido = diferenca <= DIRECOES.length / 2 ? 1 : -1
  const quantos = sentido === 1 ? diferenca : DIRECOES.length - diferenca
  const passos: DirecaoDoJudge[] = []
  for (let passo = 1; passo <= quantos; passo += 1) passos.push(direcaoDoIndice(de + sentido * passo))
  return passos
}

/**
 * A direção no meio de uma virada começada em `inicio` (`performance.now()`):
 * um passo por `PASSO_DA_VIRADA_MS`, o primeiro já em `inicio`. Movimento
 * reduzido: vira de uma vez.
 */
export function direcaoNaVirada(de: DirecaoDoJudge, para: DirecaoDoJudge, inicio: number, agora: number, reduzido: boolean): DirecaoDoJudge {
  if (reduzido) return para
  const decorrido = agora - inicio
  if (!Number.isFinite(decorrido) || decorrido < 0) return de
  const passos = passosDaVirada(de, para)
  const indice = Math.floor(decorrido / PASSO_DA_VIRADA_MS)
  return passos[Math.min(indice, passos.length - 1)] ?? para
}

/** O gesto de erguer a carta: `performance.now()` do começo; `null` = nenhum. Gesto novo no meio recomeça do zero. */
export type GestoDoJudge = { inicio: number } | null

/**
 * A coluna da folha (0..19) agora, a 12 fps. Sem gesto: a respiração em laço
 * de 1 s. Gesto: sobe (12 a 19) em 667 ms, segura na 19 por
 * `SEGURA_A_CARTA_MS`, desce (19 a 12) e volta a respirar. Movimento reduzido:
 * sempre a 0; o gesto é a 19 por `CARTA_REDUZIDA_MS`.
 */
export function colunaDoJudge(agora: number, gesto: GestoDoJudge, reduzido: boolean): number {
  const decorrido = gesto === null ? Number.NaN : agora - gesto.inicio
  const noGesto = Number.isFinite(decorrido) && decorrido >= 0
  if (reduzido) return noGesto && decorrido < CARTA_REDUZIDA_MS ? ULTIMA_DO_ERGUER : FOLHA_DO_JUDGE.respiracao.inicio
  if (noGesto && decorrido < GESTO_MS) {
    if (decorrido < SOBE_MS) return FOLHA_DO_JUDGE.erguer.inicio + Math.floor(decorrido / QUADRO_MS)
    if (decorrido < DESCE_DESDE_MS) return ULTIMA_DO_ERGUER
    return ULTIMA_DO_ERGUER - Math.floor((decorrido - DESCE_DESDE_MS) / QUADRO_MS)
  }
  const quadro = Number.isFinite(agora) ? Math.floor(agora / QUADRO_MS) : 0
  return FOLHA_DO_JUDGE.respiracao.inicio + modulo(quadro, FOLHA_DO_JUDGE.respiracao.quadros)
}

/** Prende entre meia casa e o limite menos meia casa (os pés numa casa do mapa); mapa menor que uma casa: o meio. */
function presoNoEixo(valor: number, limite: number, meiaCasa: number): number {
  if (limite <= 2 * meiaCasa) return limite / 2
  return Math.min(limite - meiaCasa, Math.max(meiaCasa, valor))
}

function presoNoMapa(ponto: { x: number; y: number }, tamanhoDaCasa: number, limites: { largura: number; altura: number }): JudgeNaCena {
  const meiaCasa = Number.isFinite(tamanhoDaCasa) && tamanhoDaCasa > 0 ? tamanhoDaCasa / 2 : 0
  return { x: presoNoEixo(ponto.x, limites.largura, meiaCasa), y: presoNoEixo(ponto.y, limites.altura, meiaCasa) }
}

/** O lembrado fica a até `BLOCOS_DO_LEMBRADO` blocos (diagonal = 1) da ficha? Casa sem tamanho não mede: vale. */
function lembradoPertoDaFicha(lembrado: JudgeNaCena, ficha: { x: number; y: number }, tamanhoDaCasa: number): boolean {
  if (!Number.isFinite(tamanhoDaCasa) || tamanhoDaCasa <= 0) return true
  const blocos = Math.max(Math.abs(lembrado.x - ficha.x), Math.abs(lembrado.y - ficha.y)) / tamanhoDaCasa
  return blocos <= BLOCOS_DO_LEMBRADO
}

/**
 * Onde ele aparece quando a batalha liga sem Judge e sem o mapa à mão (a
 * arena, a batalha retomada sem Judge, a DBT): o lembrado deste mapa, preso no
 * mapa, se está a até `BLOCOS_DO_LEMBRADO` blocos da primeira ficha da ordem
 * (ou se não há ficha); senão `CASAS_AO_NORTE` casas ao norte dela (preso no
 * mapa); senão o centro do mapa. Com o mapa à mão, `judgePertoDoGrupo` vem antes.
 */
export function judgeInicial(
  lembrado: JudgeNaCena | null,
  primeiraFicha: { x: number; y: number } | null,
  centroDoMapa: { x: number; y: number },
  tamanhoDaCasa: number,
  limites: { largura: number; altura: number },
): JudgeNaCena {
  if (lembrado !== null && (primeiraFicha === null || lembradoPertoDaFicha(lembrado, primeiraFicha, tamanhoDaCasa))) return presoNoMapa(lembrado, tamanhoDaCasa, limites)
  if (primeiraFicha !== null) return presoNoMapa({ x: primeiraFicha.x, y: primeiraFicha.y - CASAS_AO_NORTE * tamanhoDaCasa }, tamanhoDaCasa, limites)
  return { x: centroDoMapa.x, y: centroDoMapa.y }
}

/**
 * O mapa da batalha como o Judge o vê: a grade QUADRADA (como o passo em
 * batalha) e três perguntas sobre o piso da batalha. Quem monta a partir do
 * `MapData` é `ondeNasceOJudge.ts`; aqui não entra modelo de mapa.
 */
export interface GradeDoJudge {
  /** Tamanho da casa em px de mundo. */
  grid: number
  /** Casas do mapa na horizontal e na vertical. */
  colunas: number
  linhas: number
  /** O passo de 1 bloco entre duas casas vizinhas vale (sem parede, porta fechada nem quina)? */
  passoLivre: (de: Casa, para: Casa) => boolean
  /** O ponto está no chão do piso da batalha? (sem chão desenhado, tudo é chão) */
  noChao: (ponto: { x: number; y: number }) => boolean
  /** Alguma ficha ocupa o ponto? */
  ocupada: (ponto: { x: number; y: number }) => boolean
}

/** Os 8 vizinhos, o norte primeiro. */
const VIZINHOS_DO_JUDGE: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
]

/** Uma casa achada pela busca e a quantos blocos (pelos passos que valem) do combatente mais perto. */
interface CasaAlcancada {
  casa: Casa
  blocos: number
}

/**
 * Busca em largura a partir das casas dos combatentes, até `BLOCOS_DA_BUSCA`
 * blocos, só por passos que valem e só no chão. Ficha não barra a busca (o
 * Judge não anda: só não pode ficar em cima dela). Volta na ordem da busca.
 */
function casasPertoDoGrupo(fontes: readonly Casa[], grade: GradeDoJudge, colunas: number, linhas: number): CasaAlcancada[] {
  const chave = (casa: Casa): number => casa.col + casa.row * colunas
  const centro = (casa: Casa): { x: number; y: number } => ({ x: (casa.col + 0.5) * grade.grid, y: (casa.row + 0.5) * grade.grid })
  const vistas = new Set<number>()
  const fila: CasaAlcancada[] = []
  for (const casa of fontes) {
    if (vistas.has(chave(casa))) continue
    vistas.add(chave(casa))
    fila.push({ casa, blocos: 0 })
  }
  for (let indice = 0; indice < fila.length; indice += 1) {
    const atual = fila[indice]
    if (atual === undefined || atual.blocos >= BLOCOS_DA_BUSCA) continue
    for (const [dc, dr] of VIZINHOS_DO_JUDGE) {
      const vizinha = { col: atual.casa.col + dc, row: atual.casa.row + dr }
      const fora = vizinha.col < 0 || vizinha.row < 0 || vizinha.col >= colunas || vizinha.row >= linhas
      if (fora || vistas.has(chave(vizinha))) continue
      if (!grade.passoLivre(atual.casa, vizinha) || !grade.noChao(centro(vizinha))) continue
      vistas.add(chave(vizinha))
      fila.push({ casa: vizinha, blocos: atual.blocos + 1 })
    }
  }
  return fila
}

/**
 * Onde o Judge nasce PERTO DO GRUPO da batalha (pedido de 19/11/2026, mapa
 * grande inclusive), no piso dela (`grade`), numa casa no chão, sem ficha em
 * cima e do mesmo lado das paredes que os combatentes (`casasPertoDoGrupo`):
 * - o lembrado deste mapa, se a casa dele foi achada a até
 *   `BLOCOS_DO_LEMBRADO` blocos e está livre;
 * - senão a casa livre achada mais perto do centro do grupo (empate: a mais
 *   ao norte, depois a mais a oeste).
 * Nenhum combatente na grade ou nenhuma casa livre: `null` (quem chama cai em `judgeInicial`).
 */
export function judgePertoDoGrupo(grupo: readonly { x: number; y: number }[], lembrado: JudgeNaCena | null, grade: GradeDoJudge): JudgeNaCena | null {
  const { grid } = grade
  const colunas = Math.ceil(grade.colunas)
  const linhas = Math.ceil(grade.linhas)
  if (!Number.isFinite(grid) || grid <= 0 || !Number.isFinite(colunas) || !Number.isFinite(linhas)) return null
  const casaDe = (ponto: { x: number; y: number }): Casa => ({ col: Math.floor(ponto.x / grid), row: Math.floor(ponto.y / grid) })
  const naGrade = (casa: Casa): boolean => casa.col >= 0 && casa.row >= 0 && casa.col < colunas && casa.row < linhas
  const centro = (casa: Casa): { x: number; y: number } => ({ x: (casa.col + 0.5) * grid, y: (casa.row + 0.5) * grid })
  const livre = (casa: Casa): boolean => grade.noChao(centro(casa)) && !grade.ocupada(centro(casa))

  const noMapa = grupo.filter((ficha) => Number.isFinite(ficha.x) && Number.isFinite(ficha.y) && naGrade(casaDe(ficha)))
  if (noMapa.length === 0) return null
  const achadas = casasPertoDoGrupo(noMapa.map(casaDe), grade, colunas, linhas)

  if (lembrado !== null) {
    const casa = casaDe(lembrado)
    const achada = achadas.find((item) => item.casa.col === casa.col && item.casa.row === casa.row)
    if (achada !== undefined && achada.blocos <= BLOCOS_DO_LEMBRADO && livre(casa)) return { x: lembrado.x, y: lembrado.y }
  }

  const meio = { x: noMapa.reduce((soma, ficha) => soma + ficha.x, 0) / noMapa.length, y: noMapa.reduce((soma, ficha) => soma + ficha.y, 0) / noMapa.length }
  // Folga do empate: a média de 3 fichas não fecha conta exata, e a casa ao norte deve ganhar da do sul na mesma distância.
  const folga = grid * grid * 1e-6
  let melhor: Casa | null = null
  let menor = Number.POSITIVE_INFINITY
  for (const { casa } of achadas) {
    if (!livre(casa)) continue
    const ponto = centro(casa)
    const distancia = (ponto.x - meio.x) ** 2 + (ponto.y - meio.y) ** 2
    const empata = melhor !== null && Math.abs(distancia - menor) <= folga
    const antes = melhor !== null && (casa.row < melhor.row || (casa.row === melhor.row && casa.col < melhor.col))
    if (distancia < menor - folga || (empata && antes)) {
      melhor = casa
      menor = distancia
    }
  }
  return melhor === null ? null : centro(melhor)
}

const PREFIXO = 'lb-batalha:judge:'
/** A chave de quem abre um mapa sem aventura (a mesma da abertura lembrada). */
const SEM_AVENTURA = '-'

/** `lb-batalha:judge:<aventuraId ou ->:<sceneKey>`. */
export function chaveDoJudgeLembrado(aventuraId: string | null, sceneKey: string): string {
  return `${PREFIXO}${aventuraId ?? SEM_AVENTURA}:${sceneKey}`
}

/** A posição deixada pelo mestre neste mapa, neste aparelho; nada guardado, guardado torto ou armazenamento bloqueado = `null`. */
export function lerJudgeLembrado(armazem: Pick<Storage, 'getItem'> | null, aventuraId: string | null, sceneKey: string): JudgeNaCena | null {
  if (armazem === null) return null
  try {
    const bruto = armazem.getItem(chaveDoJudgeLembrado(aventuraId, sceneKey))
    if (bruto === null) return null
    return lerJudgeNaCena(JSON.parse(bruto))
  } catch {
    return null
  }
}

/** Guarda para a próxima batalha neste mapa. Sem armazenamento (ou cheio), vale só nesta batalha. */
export function gravarJudgeLembrado(armazem: Pick<Storage, 'setItem'> | null, aventuraId: string | null, sceneKey: string, judge: JudgeNaCena): void {
  if (armazem === null) return
  const valido = lerJudgeNaCena(judge)
  if (valido === null) return
  try {
    armazem.setItem(chaveDoJudgeLembrado(aventuraId, sceneKey), JSON.stringify(valido))
  } catch {
    // Armazenamento cheio ou bloqueado: a posição vale só nesta batalha.
  }
}
