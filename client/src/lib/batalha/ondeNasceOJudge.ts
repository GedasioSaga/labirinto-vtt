import type { MapData, Token } from '../../types/map'
import { paredesParaAndar } from '../barranco'
import { compileFloor } from '../floorSdf'
import { chaoQueLimita } from '../offFloor'
import { mapaDoPiso, pisoDe } from '../pisos'
import { conferirPasso, montarMapaDosBlocos } from './blocos'
import { ladoNaBatalha, type LadosDaBatalha } from './equipes'
import { judgePertoDoGrupo, type GradeDoJudge, type JudgeNaCena } from './judge'

/**
 * ONDE O JUDGE NASCE NO MAPA ABERTO (pedido de 19/11/2026: "em mapas muito
 * grande coloco o Juiz para nascer perto dos jogadores da batalha"). Monta a
 * `GradeDoJudge` com o piso da batalha e pergunta a `judgePertoDoGrupo`:
 * - o grupo: quem luta do lado dos jogadores (`doLadoDosJogadores`); o NPC
 *   contra eles, longe no mapa, não puxa o Judge. Sem ninguém desse lado no
 *   mapa (só NPCs na luta): todos os combatentes, como antes;
 * - o piso: o da maioria do grupo (empate: o de quem aparece primeiro);
 * - paredes: as do piso que barram o passo, com o barranco (`paredesParaAndar`,
 *   o que barra o MESTRE: objeto não barra), porta fechada inclusa;
 * - chão: o que limita o passo na cena (`chaoQueLimita`; cena livre = tudo);
 * - fichas: todas do piso, de qualquer tamanho, combatentes ou não.
 *
 * Fica fora do `judge.ts` para o modelo do mapa não entrar onde só a regra
 * entra (a batalha do Worker do Lobby, a tela do jogador). Só grade quadrada,
 * como o passo em batalha: hex, ou ninguém da batalha no mapa, dá `null`
 * (quem chama deixa o Judge para `judgeInicial`).
 */

/** Folga do encosto entre a casa do Judge e uma ficha, em casas (a mesma ideia do `OCCUPY_OVERLAP_TOLERANCE`). */
const FOLGA_DA_FICHA = 0.05

/**
 * Um combatente para o lugar do Judge: o token dele, se a ficha é de jogador
 * e o lado dele na luta (`null` = sem lado). Cada batalha diz o lado pela
 * regra dela: a do One Piece por `combatentesDoJudge`; a DBT pelo lado da
 * ordem (`judgeDBT.ts`).
 */
export interface CombatenteDoJudge {
  tokenId: string
  jogador: boolean
  lado: string | null
}

/**
 * Os tokens do lado dos jogadores: os jogadores e quem luta do lado de algum
 * deles (o NPC aliado). Vazio = nenhum jogador na luta.
 */
export function doLadoDosJogadores(combatentes: readonly CombatenteDoJudge[]): Set<string> {
  const ladosDosJogadores = new Set<string>()
  for (const combatente of combatentes) if (combatente.jogador && combatente.lado !== null) ladosDosJogadores.add(combatente.lado)
  const tokens = new Set<string>()
  for (const combatente of combatentes) {
    if (combatente.jogador || (combatente.lado !== null && ladosDosJogadores.has(combatente.lado))) tokens.add(combatente.tokenId)
  }
  return tokens
}

/**
 * As cartas da batalha do One Piece como o Judge as lê: o lado é o da luta
 * (`ladoNaBatalha`, a regra única de aliado). No Iniciar ainda não há
 * invocado em campo. Carta sem personagem (ou de personagem apagado): nem
 * jogador nem lado.
 */
export function combatentesDoJudge(
  cartas: readonly { tokenId: string; personagemId: string | null }[],
  mesa: Pick<LadosDaBatalha, 'equipes' | 'personagens'>,
): CombatenteDoJudge[] {
  const porId = new Map(mesa.personagens.map((personagem) => [personagem.id, personagem]))
  const lados: LadosDaBatalha = { ...mesa, invocados: [] }
  return cartas.map((carta) => ({
    tokenId: carta.tokenId,
    jogador: carta.personagemId !== null && porId.get(carta.personagemId)?.tipo === 'jogador',
    lado: ladoNaBatalha(carta.personagemId, lados),
  }))
}

/** O piso da maioria; empate fica com o de quem chegou primeiro à contagem. Grupo vazio: `null`. */
function pisoDoGrupo(grupo: readonly Token[]): number | null {
  const contagem = new Map<number, number>()
  let melhor: number | null = null
  let maior = 0
  for (const ficha of grupo) {
    const piso = pisoDe(ficha)
    const vezes = (contagem.get(piso) ?? 0) + 1
    contagem.set(piso, vezes)
    if (vezes > maior) {
      maior = vezes
      melhor = piso
    }
  }
  return melhor
}

/** A ficha cobre o ponto, para um Judge de uma casa? Ficha grande cobre as casas todas dela. */
function fichaCobre(ficha: Token, ponto: { x: number; y: number }, grid: number): boolean {
  const alcance = ((Number.isFinite(ficha.size) ? ficha.size : 1) / 2 + 0.5 - FOLGA_DA_FICHA) * grid
  return Math.abs(ficha.x - ponto.x) < alcance && Math.abs(ficha.y - ponto.y) < alcance
}

/**
 * A casa do Judge perto do lado dos jogadores de quem entrou na batalha
 * (`combatentes`, a ordem do Iniciar), no mapa aberto inteiro (`map`, com
 * todos os pisos). `lembrado`: o lugar que o mestre deixou neste mapa
 * (`lerJudgeLembrado`), que só vale perto do grupo.
 */
export function judgeNoMapaDaBatalha(map: MapData, combatentes: readonly CombatenteDoJudge[], lembrado: JudgeNaCena | null): JudgeNaCena | null {
  if (map.gridShape !== 'square') return null
  const ids = new Set(combatentes.map((combatente) => combatente.tokenId))
  const daBatalha = map.tokens.filter((ficha) => ids.has(ficha.id))
  const dosJogadores = doLadoDosJogadores(combatentes)
  const doLado = daBatalha.filter((ficha) => dosJogadores.has(ficha.id))
  const grupo = doLado.length > 0 ? doLado : daBatalha
  const piso = pisoDoGrupo(grupo)
  if (piso === null) return null
  const recorte = mapaDoPiso(map, piso)
  const blocos = montarMapaDosBlocos(paredesParaAndar(recorte.walls, recorte, piso), map.grid, map.width, map.height)
  const chao = compileFloor(chaoQueLimita(recorte))
  const grade: GradeDoJudge = {
    grid: map.grid,
    colunas: map.width,
    linhas: map.height,
    passoLivre: (de, para) => conferirPasso(blocos, de, para) === 'livre',
    noChao: (ponto) => chao.bounds === null || chao.sample(ponto.x, ponto.y) <= 0,
    ocupada: (ponto) => recorte.tokens.some((ficha) => fichaCobre(ficha, ponto, map.grid)),
  }
  return judgePertoDoGrupo(
    grupo.filter((ficha) => pisoDe(ficha) === piso),
    lembrado,
    grade,
  )
}
