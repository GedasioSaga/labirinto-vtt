/**
 * SONS AO VIVO, fatia F4: QUEM ESCUTA o som que o mestre manda tocar. Puro:
 * recebe o alvo do seletor (Todos, Só a cena, Escolhidos), a lista de jogadores
 * da sessão e as telas da mesa, e devolve os `clientId` que recebem a mensagem.
 * Decisão do usuário de 23/10: a TV também toca, em Todos e em Só a cena quando
 * mostra a cena; nunca em Escolhidos (que lista jogadores).
 */
import { describe, expect, it } from 'vitest'
import { destinatarios, type OuvinteDosSons } from './audienciaDosSons'

const ana: OuvinteDosSons = { clientId: 'c-ana', playerId: 'p-ana', connected: true, sceneId: 's-taverna' }
const bia: OuvinteDosSons = { clientId: 'c-bia', playerId: 'p-bia', connected: true, sceneId: 's-cripta' }
const caio: OuvinteDosSons = { clientId: 'c-caio', playerId: 'p-caio', connected: true }
/** Caiu: o assento continua na sessão, sem conexão. */
const duda: OuvinteDosSons = { clientId: null, playerId: 'p-duda', connected: false, sceneId: 's-taverna' }
/** Conexão marcada como fora mas com clientId velho (a varredura de quem ficou mudo). */
const eva: OuvinteDosSons = { clientId: 'c-eva', playerId: 'p-eva', connected: false, sceneId: 's-taverna' }

const JOGADORES = [ana, bia, caio, duda, eva]
const TV_NA_TAVERNA = { clientIds: ['tv-1'], cena: 's-taverna' }
const TV_ESPERANDO = { clientIds: ['tv-1'], cena: null }

describe('destinatarios', () => {
  it('Todos: só quem está conectado, e a TV junto', () => {
    expect(destinatarios({ tipo: 'todos' }, JOGADORES, TV_ESPERANDO)).toEqual(['c-ana', 'c-bia', 'c-caio', 'tv-1'])
  })

  it('Todos sem TV: só os jogadores conectados', () => {
    expect(destinatarios({ tipo: 'todos' }, JOGADORES)).toEqual(['c-ana', 'c-bia', 'c-caio'])
  })

  it('Só a cena: só quem está nela (o desconectado na cena não), e a TV quando mostra a cena', () => {
    expect(destinatarios({ tipo: 'cena', sceneId: 's-taverna' }, JOGADORES, TV_NA_TAVERNA)).toEqual(['c-ana', 'tv-1'])
  })

  it('Só a cena: a TV que mostra outra cena, ou que espera, não recebe', () => {
    expect(destinatarios({ tipo: 'cena', sceneId: 's-cripta' }, JOGADORES, TV_NA_TAVERNA)).toEqual(['c-bia'])
    expect(destinatarios({ tipo: 'cena', sceneId: 's-taverna' }, JOGADORES, TV_ESPERANDO)).toEqual(['c-ana'])
  })

  it('Só a cena: quem está sem cena (lobby, mapa solto) não recebe', () => {
    expect(destinatarios({ tipo: 'cena', sceneId: 's-vazia' }, JOGADORES, TV_ESPERANDO)).toEqual([])
  })

  it('Escolhidos: só os marcados que estão conectados; o desconectado não recebe e a TV nunca', () => {
    expect(destinatarios({ tipo: 'escolhidos', playerIds: ['p-bia', 'p-duda', 'p-eva'] }, JOGADORES, TV_NA_TAVERNA)).toEqual(['c-bia'])
  })

  it('Escolhidos com id que não existe, ou lista vazia: ninguém', () => {
    expect(destinatarios({ tipo: 'escolhidos', playerIds: ['p-fantasma'] }, JOGADORES, TV_NA_TAVERNA)).toEqual([])
    expect(destinatarios({ tipo: 'escolhidos', playerIds: [] }, JOGADORES, TV_NA_TAVERNA)).toEqual([])
  })

  it('o mesmo clientId nunca sai duas vezes (duas TVs, jogador repetido)', () => {
    expect(destinatarios({ tipo: 'todos' }, [ana, ana], { clientIds: ['tv-1', 'tv-1', 'tv-2'], cena: null })).toEqual(['c-ana', 'tv-1', 'tv-2'])
  })

  it('sala vazia: ninguém', () => {
    expect(destinatarios({ tipo: 'todos' }, [])).toEqual([])
  })
})
