import type { FichaDoJogador } from '../../../components/batalha/BatalhaDoJogador'
import { recursosDaCarta, type DadosDaFaixa } from '../../../components/batalha/dadosDaFaixa'
import { CASA_DA_ARENA } from '../../../lib/arena/grade'
import type { Personagem } from '../../../lib/personagem'
import type { DueloNoFio } from '../../../lib/treino/duelo'
import type { LadoDoTreino } from '../../../lib/treino/mesaEmMemoria'
import { SISTEMA_DO_LOBBY } from '../contexto'
import { retratoDoBoneco } from './grade/retratos'
import { dePe } from './quemJoga'

/**
 * O QUE O HUD DA ARENA LÊ numa luta do site (fatia H): o `BatalhaDoJogador` e
 * a `FaixaDaOrdem` do app pedem as fichas da tela (nome, retrato, posição) e
 * as cópias do lado de quem joga; aqui elas saem do fio (`DueloNoFio`), que o
 * treino monta no navegador e o duelo recebe do servidor. Puro: sem React.
 */

/** As fichas da luta como o HUD as lê: o id é o do token, o retrato é o da grade (na demo, o rosto inventado), a posição em px da grade. */
export function fichasDaLuta(fio: DueloNoFio, demo: boolean): (FichaDoJogador & { characterId: string })[] {
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

/** As cópias do lado de quem joga: o menu da vez, a reação e a mira leem a ficha delas. */
export function copiasDoLado(fio: DueloNoFio, lado: LadoDoTreino): Personagem[] {
  const ids = new Set(fio.lutadores.vagas.filter((vaga) => vaga.lado === lado).map((vaga) => vaga.personagemId))
  return fio.lutadores.personagens.filter((personagem) => ids.has(personagem.id))
}

/**
 * A ficha é pública no treino e no duelo (revisão da M2): a carta do outro
 * lado, que a vista manda sem a Vida ("oculta", como na mesa), ganha os
 * números, o Escudo e o "caiu" da cópia que o fio já traz inteira, como as
 * cartas da Arena do app mostram os dois lados.
 */
export function faixaComFichaPublica(dados: DadosDaFaixa, fio: DueloNoFio): DadosDaFaixa {
  const vagaDoToken = new Map(fio.lutadores.vagas.map((vaga) => [vaga.tokenId, vaga]))
  const porId = new Map(fio.lutadores.personagens.map((personagem) => [personagem.id, personagem]))
  const cartas = dados.cartas.map((carta) => {
    if (carta.vida !== 'oculta') return carta
    const vaga = vagaDoToken.get(carta.tokenId)
    const doc = vaga === undefined ? undefined : porId.get(vaga.personagemId)
    if (doc === undefined) return carta
    const recursos = recursosDaCarta(doc, SISTEMA_DO_LOBBY)
    const escudo = doc.recursos.escudo ?? 0
    return { ...carta, vida: recursos.length > 0 ? ('numeros' as const) : ('sem' as const), recursos, caiu: !dePe(doc), ...(escudo > 0 ? { escudo } : {}) }
  })
  return { ...dados, cartas }
}
