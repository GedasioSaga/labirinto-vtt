import { ladoNaBatalha, mesmoLadoNaBatalha, quemLutaPeloDono } from '../../lib/batalha/equipes'
import type { Reversao } from '../../lib/batalha/registro'
import type { TurnosDaCena } from '../../lib/batalha/turnos'
import { comMudanca, nomeDaCarta, type LinhaNova } from './cena'
import type { NucleoDaBatalha } from './nucleo'
import { recargaAoReceber } from './recargaDoPente'
import type { BatalhaState } from './tipos'

/**
 * DAR ITEM NA BATALHA (docs/design/itens-rework/PLANO.md, etapa E6b; decisão 9). O "Dar a…" mora fora
 * da batalha (a mochila do mestre, o inventário do jogador); a batalha só:
 *
 * - recusa dar a quem está do outro lado da luta (item só vai para aliado: jogador para jogador,
 *   jogador para NPC aliado). Dar não gasta ação: nada daqui mexe no gasto da vez;
 * - depois de dar, recarrega a arma de quem recebeu munição com o pente vazio (a mesma recarga do pente
 *   zerado, decisão 3): agora se a ação cabe, senão no começo da próxima vez dele.
 */
export function criarDarNaBatalha(nucleo: NucleoDaBatalha) {
  const { mesa, get, mesaDoRpg, gravarCena } = nucleo

  /** As cenas com batalha ligada em que `personagemId` tem carta (fora do bando). */
  const lutasDe = (personagemId: string) => Object.entries(get().cenas).filter(([, cena]) => cena.turnos.cartas.some((carta) => carta.personagemId === personagemId && carta.bando === undefined))

  const acoes: Pick<BatalhaState, 'motivoDoDarNaLuta' | 'recebeuNaLuta'> = {
    motivoDoDarNaLuta: (deId, paraId) => {
      const { personagens } = mesaDoRpg()
      for (const [, cena] of lutasDe(deId)) {
        const lados = { equipes: mesa.equipes(), personagens, invocados: quemLutaPeloDono(cena.turnos) }
        if (ladoNaBatalha(deId, lados) !== null && !mesmoLadoNaBatalha(deId, paraId, lados)) {
          const nome = personagens.find((candidato) => candidato.id === paraId)?.nome.trim() || 'Essa ficha'
          return `Na batalha, item só vai para aliado: ${nome} está do outro lado`
        }
      }
      return null
    },

    recebeuNaLuta: (quem, autor, texto) => {
      const { personagens } = mesaDoRpg()
      const porToken = new Set(quem.tokenIds ?? [])
      const porFicha = new Set(quem.personagemIds ?? [])
      for (const [sceneKey, cena] of Object.entries(get().cenas)) {
        const cartas = cena.turnos.cartas.filter((carta) => carta.bando === undefined && carta.personagemId !== null && (porFicha.has(carta.personagemId) || porToken.has(carta.tokenId)))
        if (cartas.length === 0) continue
        let turnos: TurnosDaCena = cena.turnos
        const partes: Reversao[] = []
        const notas: string[] = []
        // Sem frase de quem deu (a mochila mudou pela LAN): só a recarga feita entra no registro, nunca o "recarrega depois".
        const comAEspera = texto !== null
        for (const carta of cartas) {
          const feita = recargaAoReceber(mesa, sceneKey, { carta, chaveDoGasto: carta.id, regras: cena.regras }, turnos, comAEspera)
          if (feita === 'recusada') continue
          turnos = feita.turnos
          partes.push(...feita.partes)
          if (feita.texto !== null) notas.push(texto === null ? `${nomeDaCarta(carta, personagens)}: ${feita.texto}` : feita.texto)
        }
        if (texto === null && notas.length === 0) continue
        const corpo = texto === null ? notas.join(' · ') : notas.length === 0 ? texto : `${texto} (${notas.join(' · ')})`
        const linha: LinhaNova = { tipo: 'acao', texto: corpo, autor, tokenIds: [...new Set(cartas.map((carta) => carta.tokenId))], reversao: { tipo: 'composta', partes } }
        gravarCena(sceneKey, comMudanca(cena, turnos, linha))
      }
    },
  }
  return { acoes }
}
