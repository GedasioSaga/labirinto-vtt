/**
 * A fatia do COMPANION da store da batalha One Piece (PLANO-COMPANION.md,
 * fatia 3): o dono (ou o mestre, "Escolher por ela") diz quem vai; os tokens
 * nascem colados no dono, cada um ganha carta própria pela Agilidade e a
 * escolha fica na ficha como o padrão da próxima vez.
 */
import { comUltimaEscolha, gruposParaEscolha, grupoDoCompanion, motivoDaEscolha } from '../../lib/caracteristicas/companions'
import { comCompanionsNaOrdem, type CompanionQueEntra } from '../../lib/caracteristicas/naBatalha'
import type { Reversao } from '../../lib/batalha/registro'
import type { BatalhaState } from './tipos'
import { comMudanca } from './cena'
import type { NucleoDaBatalha } from './nucleo'

export const MOTIVO_SEM_COMPANION_NA_MESA = 'Esta mesa não põe companion no mapa.'
export const MOTIVO_ESCOLHA_FEITA = 'A escolha dos companions já foi feita.'

/** "Aira levou Mimi e Bolota" / "Aira entrou sozinha". */
function textoDaEscolha(dono: string, nomes: readonly string[]): string {
  if (nomes.length === 0) return `${dono} entrou sem companion`
  const lista = nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
  return `${dono} levou ${lista}`
}

export function criarCompanions(nucleo: NucleoDaBatalha) {
  const { mesa, cenaDe, gravarCena } = nucleo

  const acoes: Pick<BatalhaState, 'escolherCompanions'> = {
    escolherCompanions: (sceneKey, autor, donoPersonagemId, escolhidos) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined || mesa.porCompanionsAoLado === undefined) return MOTIVO_SEM_COMPANION_NA_MESA
      const { turnos } = cena
      if (!(turnos.escolhendoCompanions ?? []).includes(donoPersonagemId)) return MOTIVO_ESCOLHA_FEITA
      const personagens = mesa.personagens()
      const sistema = mesa.sistema()
      const dono = personagens.find((personagem) => personagem.id === donoPersonagemId)
      const cartaDoDono = turnos.cartas.find((carta) => carta.personagemId === donoPersonagemId && carta.extra === undefined && carta.bando === undefined)
      if (dono === undefined || cartaDoDono === undefined) return 'O dono não está na ordem.'
      const motivo = motivoDaEscolha(gruposParaEscolha(dono, personagens, sistema), escolhidos)
      if (motivo !== null) return motivo
      const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
      const postos = escolhidos.length === 0 ? [] : mesa.porCompanionsAoLado(sceneKey, cartaDoDono.tokenId, escolhidos.map((personagemId) => ({ personagemId, nome: porId.get(personagemId)?.nome ?? 'Companion' })))
      if (postos === null) return 'Não deu para pôr os companions no mapa (a cena não está aberta).'
      const entram: CompanionQueEntra[] = []
      for (const posto of postos) {
        const ligado = grupoDoCompanion(dono, posto.personagemId)
        if (ligado === null) continue
        entram.push({
          nome: porId.get(posto.personagemId)?.nome ?? 'Companion',
          companion: { tokenId: posto.tokenId, personagemId: posto.personagemId, donoPersonagemId, donoTokenId: cartaDoDono.tokenId, grupoId: ligado.grupo.id, modo: ligado.modo, criado: posto.criado },
        })
      }
      const feito = comCompanionsNaOrdem(turnos, donoPersonagemId, entram, personagens, sistema)
      // O Desfazer tira as cartas novas (o token fica no mapa; o mestre o tira à mão).
      const partes: Reversao[] = feito.cartas.map((carta) => ({ tipo: 'cartaNova', cartaId: carta.id }))
      const texto = textoDaEscolha(dono.nome, entram.map((entra) => entra.nome))
      gravarCena(sceneKey, comMudanca(cena, feito.turnos, { tipo: 'combatente', texto, autor, tokenIds: [cartaDoDono.tokenId, ...entram.map((entra) => entra.companion.tokenId)], personagemIds: [donoPersonagemId], reversao: { tipo: 'composta', partes } }))
      // A escolha vira o padrão da próxima batalha (pasta publicada que recusa: fica a de antes, sem aviso).
      mesa.ajustarPersonagem(donoPersonagemId, (atual) => comUltimaEscolha(atual, escolhidos))
      return null
    },
  }
  return { acoes }
}
