import type { MapData, Token } from '../../types/map'
import { paredesParaAndar } from '../barranco'
import { compileFloor } from '../floorSdf'
import { chaoQueLimita } from '../offFloor'
import { mapaDoPiso, pisoDe } from '../pisos'
import { conferirPasso, montarMapaDosBlocos } from './blocos'
import { judgePertoDoGrupo, type GradeDoJudge, type JudgeNaCena } from './judge'

/**
 * ONDE O JUDGE NASCE NO MAPA ABERTO (pedido de 19/11/2026: "em mapas muito
 * grande coloco o Juiz para nascer perto dos jogadores da batalha"). Monta a
 * `GradeDoJudge` com o piso da batalha e pergunta a `judgePertoDoGrupo`:
 * - o piso: o da maioria dos combatentes (empate: o de quem aparece primeiro);
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
 * A casa do Judge perto de quem entrou na batalha (`tokenIds`, a ordem do
 * Iniciar), no mapa aberto inteiro (`map`, com todos os pisos). `lembrado`: o
 * lugar que o mestre deixou neste mapa (`lerJudgeLembrado`), que só vale perto
 * do grupo.
 */
export function judgeNoMapaDaBatalha(map: MapData, tokenIds: readonly string[], lembrado: JudgeNaCena | null): JudgeNaCena | null {
  if (map.gridShape !== 'square') return null
  const ids = new Set(tokenIds)
  const daBatalha = map.tokens.filter((ficha) => ids.has(ficha.id))
  const piso = pisoDoGrupo(daBatalha)
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
    daBatalha.filter((ficha) => pisoDe(ficha) === piso),
    lembrado,
    grade,
  )
}
