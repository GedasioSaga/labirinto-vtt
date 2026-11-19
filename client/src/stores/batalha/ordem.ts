/**
 * A fatia da ORDEM da store da batalha One Piece: mover, ordenar pela Agilidade, desempate, incluir e
 * tirar combatente, carta extra, remover carta, as regras do campo e a ordem em dia com o mapa
 * (`normalizarCena`). Quem sai com a vez passa a vez antes (`passarAVezDeQuemSai`, da fatia da vez).
 */
import { textoDaLinha, type Reversao } from '../../lib/batalha/registro'
import {
  adicionarCartaExtra as adicionarCartaExtraNaOrdem,
  agilidadesDasCartas,
  incluirCombatente as incluirCombatenteNaOrdem,
  moverCarta as moverCartaNaOrdem,
  normalizar,
  novaCarta,
  ordenarPelaAgilidade as ordenarNaOrdem,
  removerCarta as removerCartaDaOrdem,
  tirarCombatente as tirarCombatenteDaOrdem,
  trocarDesempate as trocarDesempateNaOrdem,
} from '../../lib/batalha/turnos'
import type { BatalhaState } from './tipos'
import { nomeDaCarta, type LinhaNova, comMudanca, idsDaOrdem } from './cena'
import type { NucleoDaBatalha } from './nucleo'
import type { VezDaBatalha } from './vez'

/** Janela em que movimentos seguidos da mesma carta pelo mestre viram uma linha (Alt + seta repetido). */
export const JANELA_DO_MOVIMENTO_MS = 5_000

/** A ordem presa ao núcleo da store e à vez. */
export function criarOrdem(nucleo: NucleoDaBatalha, fatiaDaVez: VezDaBatalha) {
  const { deps, mesaDoRpg, cenaDe, gravarCena, mudarTurnos } = nucleo
  const { passarAVezDeQuemSai } = fatiaDaVez

  const acoes: Pick<BatalhaState, 'moverCarta' | 'ordenarPelaAgilidade' | 'trocarDesempate' | 'incluirCombatente' | 'tirarCombatente' | 'adicionarCartaExtra' | 'removerCarta' | 'definirRegras' | 'normalizarCena'> = {
    moverCarta: (sceneKey, cartaId, indice) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const turnos = moverCartaNaOrdem(cena.turnos, cartaId, indice)
      if (turnos === cena.turnos) return false
      const carta = turnos.cartas.find((candidata) => candidata.id === cartaId)
      const posicao = turnos.cartas.findIndex((candidata) => candidata.id === cartaId) + 1
      const texto = `${nomeDaCarta(carta, mesaDoRpg().personagens)} foi para a posição ${posicao}`
      const ultima = cena.registro[cena.registro.length - 1]
      // Alt + seta repetido: a mesma linha, com a ordem de ANTES do primeiro movimento.
      const mesmaLinha =
        ultima !== undefined &&
        ultima.tipo === 'ordem' &&
        ultima.autor.tipo === 'mestre' &&
        ultima.desfeita === undefined &&
        ultima.reversao.tipo === 'ordem' &&
        carta !== undefined &&
        ultima.envolve.tokenIds.length === 1 &&
        ultima.envolve.tokenIds[0] === carta.tokenId &&
        Date.now() - ultima.quando < JANELA_DO_MOVIMENTO_MS
      if (mesmaLinha) {
        const registro = [...cena.registro]
        registro[registro.length - 1] = { ...ultima, quando: Date.now(), texto: textoDaLinha(texto) }
        gravarCena(sceneKey, { ...cena, turnos, registro, turnosRev: cena.turnosRev + 1 })
        return true
      }
      gravarCena(sceneKey, comMudanca(cena, turnos, { tipo: 'ordem', texto, tokenIds: carta === undefined ? [] : [carta.tokenId], reversao: { tipo: 'ordem', antes: idsDaOrdem(cena.turnos) } }))
      return true
    },

    ordenarPelaAgilidade: (sceneKey) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const { personagens, sistema } = mesaDoRpg()
      const turnos = ordenarNaOrdem(cena.turnos, agilidadesDasCartas(cena.turnos.cartas, personagens, sistema), deps.rolarD20)
      const rolou = Object.keys(turnos.d20).length > 0
      // O número do d20 não vai no texto: o jogador lê o registro e nunca vê o d20.
      const texto = rolou ? 'Ordem pela Agilidade, empate no 1d20' : 'Ordem pela Agilidade'
      gravarCena(sceneKey, comMudanca(cena, turnos, { tipo: rolou ? 'desempate' : 'ordem', texto, reversao: { tipo: 'ordem', antes: idsDaOrdem(cena.turnos) } }))
      return true
    },

    trocarDesempate: (sceneKey, desempate) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const turnos = trocarDesempateNaOrdem(cena.turnos, desempate)
      if (turnos === cena.turnos) return false
      gravarCena(sceneKey, comMudanca(cena, turnos, null))
      return true
    },

    incluirCombatente: (sceneKey, token, indice) => {
      const carta = novaCarta(token.id, token.characterId, token.name)
      return mudarTurnos(
        sceneKey,
        (turnos) => incluirCombatenteNaOrdem(turnos, carta, indice),
        () => ({ tipo: 'combatente', texto: `${nomeDaCarta(carta, mesaDoRpg().personagens)} entrou na luta`, tokenIds: [token.id], reversao: { tipo: 'cartaNova', cartaId: carta.id } }),
      )
    },

    tirarCombatente: (sceneKey, tokenId) => {
      const inicio = cenaDe(sceneKey)
      // Invocação: a carta do bando não sai assim (todo Desfazer a recriaria sem aviso): saem os membros dela.
      if (inicio === undefined || inicio.turnos.cartas.some((carta) => carta.tokenId === tokenId && carta.bando !== undefined)) return false
      if (!inicio.turnos.cartas.some((carta) => carta.tokenId === tokenId)) return false
      passarAVezDeQuemSai(sceneKey, (carta) => carta.tokenId === tokenId)
      const cena = cenaDe(sceneKey) ?? inicio
      const { turnos, removidas } = tirarCombatenteDaOrdem(cena.turnos, tokenId)
      const primeira = removidas[0]
      if (primeira === undefined) return false
      // Desfazer volta as partes da última para a primeira: em ordem decrescente aqui, cada uma reentra no lugar certo.
      const partes: Reversao[] = [...removidas].sort((a, b) => b.indice - a.indice).map(({ carta, indice }) => ({ tipo: 'cartaRemovida', carta, indice }))
      const linha: LinhaNova = { tipo: 'combatente', texto: `${nomeDaCarta(primeira.carta, mesaDoRpg().personagens)} saiu da luta`, tokenIds: [tokenId], reversao: { tipo: 'composta', partes } }
      gravarCena(sceneKey, comMudanca(cena, turnos, linha))
      return true
    },

    adicionarCartaExtra: (sceneKey, tokenId, indice, duracao) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return null
      const feito = adicionarCartaExtraNaOrdem(cena.turnos, tokenId, indice, duracao)
      if (feito === null) return null
      const quanto = duracao === 'rodada' ? 'só nesta rodada' : 'em todas as rodadas'
      const texto = `Carta extra de ${nomeDaCarta(feito.carta, mesaDoRpg().personagens)} (${quanto})`
      gravarCena(sceneKey, comMudanca(cena, feito.turnos, { tipo: 'cartaExtra', texto, tokenIds: [tokenId], reversao: { tipo: 'cartaNova', cartaId: feito.carta.id } }))
      return feito.carta.id
    },

    removerCarta: (sceneKey, cartaId) => {
      const inicio = cenaDe(sceneKey)
      if (inicio === undefined) return false
      const antes = removerCartaDaOrdem(inicio.turnos, cartaId)
      // Invocação: a carta do bando não sai assim (todo Desfazer a recriaria sem aviso): saem os membros dela.
      if (antes === null || antes.removida.carta.bando !== undefined) return false
      passarAVezDeQuemSai(sceneKey, (carta) => carta.id === cartaId)
      const cena = cenaDe(sceneKey) ?? inicio
      const feito = removerCartaDaOrdem(cena.turnos, cartaId)
      // A virada da rodada já tirou a carta extra "só nesta rodada": a vez andou e ela saiu.
      if (feito === null) return true
      const { carta, indice } = feito.removida
      const nome = nomeDaCarta(carta, mesaDoRpg().personagens)
      const linha: LinhaNova = {
        tipo: carta.extra === undefined ? 'combatente' : 'cartaExtra',
        texto: carta.extra === undefined ? `${nome} saiu da luta` : `Carta extra de ${nome} saiu`,
        tokenIds: [carta.tokenId],
        reversao: { tipo: 'cartaRemovida', carta, indice },
      }
      gravarCena(sceneKey, comMudanca(cena, feito.turnos, linha))
      return true
    },

    definirRegras: (sceneKey, regras) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const texto = regras === null ? 'Sem regras do campo' : `Regras do campo: ${regras.nome}`
      gravarCena(sceneKey, comMudanca(cena, cena.turnos, { tipo: 'regras', texto, reversao: { tipo: 'regras', antes: cena.regras } }, regras))
      return true
    },

    normalizarCena: (sceneKey, tokenIdsDaCena) => {
      const inicio = cenaDe(sceneKey)
      if (inicio === undefined) return
      // A ficha apagada tinha a vez: ela anda antes pelo "Passar a vez" (começo de vez, virada), como no "Tirar".
      passarAVezDeQuemSai(sceneKey, (carta) => carta.bando === undefined && !tokenIdsDaCena.has(carta.tokenId))
      const cena = cenaDe(sceneKey) ?? inicio
      const turnos = normalizar(cena.turnos, tokenIdsDaCena)
      if (turnos !== cena.turnos) gravarCena(sceneKey, comMudanca(cena, turnos, null))
    },
  }
  return { acoes }
}

/** O que `criarOrdem` devolve. */
export type OrdemDaBatalha = ReturnType<typeof criarOrdem>
