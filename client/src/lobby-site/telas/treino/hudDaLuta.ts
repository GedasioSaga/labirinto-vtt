import type { FichaDoJogador } from '../../../components/batalha/BatalhaDoJogador'
import { recursosDaCarta, type DadosDaFaixa } from '../../../components/batalha/dadosDaFaixa'
import { CASA_DA_ARENA } from '../../../lib/arena/grade'
import type { Personagem } from '../../../lib/personagem'
import type { DueloNoFio } from '../../../lib/treino/duelo'
import type { SistemaDeRpg } from '../../../lib/sistemaDeRpg'
import type { CasaDoTreino, VagaDaLuta } from '../../../lib/treino/mesaEmMemoria'
import { retratoDoBoneco } from './grade/retratos'
import { dePe } from './quemJoga'

/**
 * O que a Arena do site lê de uma luta: o fio do treino e do duelo
 * (`DueloNoFio`, 2 lados) e o da luta de N lados (`LutaNoFio`, Arena
 * multijogador F5) cabem aqui. Só os campos que a grade e o HUD leem.
 */
export interface FioDaArena {
  fim: { tipo: string } | null
  lutadores: { vagas: readonly VagaDaLuta[]; personagens: readonly Personagem[] }
  posicoes: Readonly<Record<string, CasaDoTreino>>
  turnos: DueloNoFio['turnos']
  regras: DueloNoFio['regras']
  efeitos: DueloNoFio['efeitos']
  registro: DueloNoFio['registro']
}

/**
 * O QUE O HUD DA ARENA LÊ numa luta do site (fatia H): o `BatalhaDoJogador` e
 * a `FaixaDaOrdem` do app pedem as fichas da tela (nome, retrato, posição) e
 * as cópias do lado de quem joga; aqui elas saem do fio (`DueloNoFio`), que o
 * treino monta no navegador e o duelo recebe do servidor. Puro: sem React.
 */

/** As fichas da luta como o HUD as lê: o id é o do token, o retrato é o da grade (na demo, o rosto inventado), a posição em px da grade. */
export function fichasDaLuta(fio: FioDaArena, demo: boolean): (FichaDoJogador & { characterId: string })[] {
  const porId = new Map(fio.lutadores.personagens.map((personagem) => [personagem.id, personagem]))
  return fio.lutadores.vagas.map((vaga) => {
    const doc = porId.get(vaga.personagemId)
    const casa = fio.posicoes[vaga.tokenId]
    const ficha: FichaDoJogador & { characterId: string } = {
      id: vaga.tokenId,
      name: doc?.nome ?? 'Ficha',
      imageData: retratoDoBoneco(doc?.retrato ?? null, vaga.origem, demo),
      characterId: vaga.personagemId,
    }
    if (casa !== undefined) {
      ficha.x = casa.col * CASA_DA_ARENA
      ficha.y = casa.row * CASA_DA_ARENA
    }
    return ficha
  })
}

/** As cópias de quem joga (`ehMinha`: no treino e no duelo, o lado inteiro; no time, só as da conta): o menu da vez, a reação e a mira leem a ficha delas. */
export function copiasDoLado(fio: FioDaArena, ehMinha: (vaga: VagaDaLuta) => boolean): Personagem[] {
  const ids = new Set(fio.lutadores.vagas.filter(ehMinha).map((vaga) => vaga.personagemId))
  return fio.lutadores.personagens.filter((personagem) => ids.has(personagem.id))
}

/**
 * A ficha é pública no treino e no duelo (revisão da M2): a carta do outro
 * lado, que a vista manda sem a Vida ("oculta", como na mesa), ganha os
 * números, o Escudo e o "caiu" da cópia que o fio já traz inteira, como as
 * cartas da Arena do app mostram os dois lados. Os números são os do sistema da campanha.
 */
export function faixaComFichaPublica(dados: DadosDaFaixa, fio: FioDaArena, sistema: SistemaDeRpg): DadosDaFaixa {
  const vagaDoToken = new Map(fio.lutadores.vagas.map((vaga) => [vaga.tokenId, vaga]))
  const porId = new Map(fio.lutadores.personagens.map((personagem) => [personagem.id, personagem]))
  const cartas = dados.cartas.map((carta) => {
    if (carta.vida !== 'oculta') return carta
    const vaga = vagaDoToken.get(carta.tokenId)
    const doc = vaga === undefined ? undefined : porId.get(vaga.personagemId)
    if (doc === undefined) return carta
    const recursos = recursosDaCarta(doc, sistema)
    const escudo = doc.recursos.escudo ?? 0
    return { ...carta, vida: recursos.length > 0 ? ('numeros' as const) : ('sem' as const), recursos, caiu: !dePe(doc, sistema), ...(escudo > 0 ? { escudo } : {}) }
  })
  return { ...dados, cartas }
}
