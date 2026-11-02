/**
 * DRAGON BALL TALES — dados do "Comparar" do mundo do livro: 2 a 4
 * personagens lado a lado (PDL, EP, PV, PK, CA, ST) e, para cada técnica de
 * dano, a chance de acerto e o dano esperado contra a CA de cada outro, com a
 * diferença de EP e a vitória automática (2.3.4). Puro: a tela só desenha.
 */
import type { FaixaDeDanoDBT, FichaDBT, RacaDBT, RankDBT, RotuloDBT, TabelaVidaPorGolpe, TecnicaDBT } from '../modelo'
import { type AtributosDBT, modificadorDoAtributo } from './atributos'
import { type DistribuicaoDoAtaqueDBT, distribuicaoDoAtaque, vitoriaAutomatica } from './dano'
import { type DerivadosDaFichaDBT, derivadosDaFicha } from './ficha'
import { type TabelaDeRanksDBT, type TecnicaMontadaDBT, montarTecnica } from './tecnicas'

export const COMPARAR_MIN = 2
export const COMPARAR_MAX = 4

export interface PersonagemParaCompararDBT {
  id: string
  nome: string
  ficha: FichaDBT
  /** `Personagem.atributos`. */
  atributos: AtributosDBT
  /** A raça do catálogo de `ficha.raca`; null = sem raça ou raça livre. */
  raca: RacaDBT | null
}

export interface ContextoDoCompararDBT {
  ranks: TabelaDeRanksDBT
  /** `catalogoDeRotulos(ROTULOS)`. */
  rotulos: ReadonlyMap<string, RotuloDBT>
  /** PV do NPC pelo ND; null = conta do jogador. */
  vidaPorGolpe: TabelaVidaPorGolpe | null
}

export interface TecnicaContraAlvoDBT extends DistribuicaoDoAtaqueDBT {
  alvoId: string
}

export interface TecnicaComparadaDBT {
  id: string
  nome: string
  rank: RankDBT
  ki: number
  faixa: FaixaDeDanoDBT
  /** Soma no d20 além da EP: modificador do atributo + Aumentar/Diminuir Precisão. */
  acerto: number
  /** O montador não achou erro de regra. */
  valida: boolean
  contra: TecnicaContraAlvoDBT[]
}

export interface ColunaDoCompararDBT {
  id: string
  nome: string
  pdl: number
  epBase: number
  epTotal: number
  pv: number
  pk: number
  ca: number
  st: number
  stUsados: number
  /** Técnicas de dano prontas para uso: as ativas; no NPC, todas (o NPC não usa ST). */
  tecnicas: TecnicaComparadaDBT[]
  /** Tudo da ficha, com as fórmulas, para a tela mostrar de onde veio cada número. */
  derivados: DerivadosDaFichaDBT
}

export interface ParDoCompararDBT {
  aId: string
  bId: string
  /** EP total de A − EP total de B. */
  diferencaDeEP: number
  /** Id de quem vence por vitória automática; null = ninguém. */
  vitoriaAutomatica: string | null
}

export interface ComparacaoDBT {
  colunas: ColunaDoCompararDBT[]
  pares: ParDoCompararDBT[]
  /** Fora de 2 a 4 personagens: o que aconteceu. */
  avisos: string[]
}

interface Preparado {
  pessoa: PersonagemParaCompararDBT
  derivados: DerivadosDaFichaDBT
  tecnicas: { tecnica: TecnicaDBT; montada: TecnicaMontadaDBT }[]
}

function preparar(pessoa: PersonagemParaCompararDBT, contexto: ContextoDoCompararDBT): Preparado {
  const derivados = derivadosDaFicha(pessoa.ficha, pessoa.atributos, { raca: pessoa.raca, ranks: contexto.ranks, vidaPorGolpe: contexto.vidaPorGolpe })
  const ehNpc = pessoa.ficha.npc !== undefined
  const tecnicas = pessoa.ficha.tecnicas
    .filter((tecnica) => (ehNpc || tecnica.ativa) && tecnica.efeitoDaFaixa === 'dano')
    .map((tecnica) => ({ tecnica, montada: montarTecnica(tecnica, { rank: contexto.ranks[tecnica.rank], rotulos: contexto.rotulos }) }))
    .filter(({ montada }) => montada.faixa.completo > 0)
  return { pessoa, derivados, tecnicas }
}

function coluna(atual: Preparado, indice: number, todos: readonly Preparado[]): ColunaDoCompararDBT {
  const { pessoa, derivados } = atual
  const tecnicas = atual.tecnicas.map(({ tecnica, montada }): TecnicaComparadaDBT => {
    const modificador = modificadorDoAtributo(pessoa.atributos, tecnica.atributo)
    const contra = todos
      .filter((_, outro) => outro !== indice)
      .map((alvo) => ({
        alvoId: alvo.pessoa.id,
        ...distribuicaoDoAtaque({
          modificador,
          extras: montada.acertoExtra,
          epAtacante: derivados.epTotal.valor,
          epAlvo: alvo.derivados.epTotal.valor,
          caDoAlvo: alvo.derivados.ca.valor,
          faixa: montada.faixa,
        }),
      }))
    return {
      id: tecnica.id,
      nome: tecnica.nome,
      rank: tecnica.rank,
      ki: montada.ki,
      faixa: montada.faixa,
      acerto: modificador + montada.acertoExtra,
      valida: montada.valida,
      contra,
    }
  })
  return {
    id: pessoa.id,
    nome: pessoa.nome,
    pdl: pessoa.ficha.pdl,
    epBase: derivados.epBase.valor,
    epTotal: derivados.epTotal.valor,
    pv: derivados.pvMax.valor,
    pk: derivados.pkMax.valor,
    ca: derivados.ca.valor,
    st: derivados.st.valor,
    stUsados: derivados.stUsados,
    tecnicas,
    derivados,
  }
}

export function compararPersonagens(lista: readonly PersonagemParaCompararDBT[], contexto: ContextoDoCompararDBT): ComparacaoDBT {
  const avisos: string[] = []
  if (lista.length < COMPARAR_MIN) avisos.push(`Escolha pelo menos ${COMPARAR_MIN} personagens para comparar.`)
  const sobra = lista.length - COMPARAR_MAX
  if (sobra > 0) avisos.push(`Só os ${COMPARAR_MAX} primeiros entram; ${sobra === 1 ? '1 ficou' : `${sobra} ficaram`} de fora.`)
  const preparados = lista.slice(0, COMPARAR_MAX).map((pessoa) => preparar(pessoa, contexto))
  const colunas = preparados.map((atual, indice) => coluna(atual, indice, preparados))
  const pares: ParDoCompararDBT[] = []
  for (let i = 0; i < colunas.length; i++) {
    for (let j = i + 1; j < colunas.length; j++) {
      const a = colunas[i]
      const b = colunas[j]
      const vence = vitoriaAutomatica(a.epTotal, b.epTotal)
      pares.push({
        aId: a.id,
        bId: b.id,
        diferencaDeEP: a.epTotal - b.epTotal,
        vitoriaAutomatica: vence === 'a' ? a.id : vence === 'b' ? b.id : null,
      })
    }
  }
  return { colunas, pares, avisos }
}
