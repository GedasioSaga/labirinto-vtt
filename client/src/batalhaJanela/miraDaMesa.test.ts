import { beforeEach, describe, expect, it } from 'vitest'
import type { CartaoDaFicha } from '../lib/personagem'
import type { MapaDoAlcance } from '../lib/batalha/alcance/quemEntra'
import { ficha, sistema } from '../lib/batalha/fichasDaFatiaB.testkit'
import { alvosNaOrdemDaMira, golpesDeHabilidade, type AlvoNaMira } from '../components/batalha/dadosDoMenu'
import { useMiraNoMapa, type MiraNoMapa } from '../stores/batalha/miraNoMapa'
import { miraDaMesaNoChao, mostrarMiraDaMesa } from './miraDaMesa'
import { lerPedido } from './protocolo'

/**
 * Sobra do alcance (23/11/2026): a Mesa da batalha escolhia golpe e alvo sem acender nada no mapa
 * principal. O pedido 'mira' leva a escolha à principal, que monta a mira com a conta do menu da vez.
 * Dados inventados; casas de 50 px.
 */

const CASA = 50
const MAPA: MapaDoAlcance = { segmentos: [], colunas: 12, linhas: 8, grade: CASA }

function cartao(id: string, nome: string, mecanica: CartaoDaFicha['mecanica']): CartaoDaFicha {
  return { id, nome, campos: {}, extras: [], atributos: [], imagem: null, modificadores: [], subcartoes: [], mecanica }
}

function naCasa(col: number, row: number): { x: number; y: number } {
  return { x: col * CASA + CASA / 2, y: row * CASA + CASA / 2 }
}

describe('a mira da Mesa da batalha no mapa', () => {
  beforeEach(() => useMiraNoMapa.getState().mostrar(null))

  it('o pedido da mira passa pelo protocolo; o apagar também; o torto não', () => {
    expect(lerPedido({ acao: 'mira', sceneKey: 'cena', mira: { tipo: 'vez', id: '1:carta', golpe: 'tecnica:x', alvos: ['a', 'b'] } })).toEqual({
      acao: 'mira',
      sceneKey: 'cena',
      mira: { tipo: 'vez', id: '1:carta', golpe: 'tecnica:x', alvos: ['a', 'b'] },
    })
    expect(lerPedido({ acao: 'mira', sceneKey: 'cena', mira: null })).toEqual({ acao: 'mira', sceneKey: 'cena', mira: null })
    expect(lerPedido({ acao: 'mira', sceneKey: 'cena', mira: { tipo: 'outro', id: 'x', golpe: 'g', alvos: [] } })).toBeNull()
    expect(lerPedido({ acao: 'mira', sceneKey: 'cena', mira: { tipo: 'vez', id: 'x', golpe: 'g', alvos: [7] } })).toBeNull()
  })

  it('a Bênção escolhida na mesa acende o raio de quem usa no mapa; apagar tira só a mira que a mesa pôs', () => {
    const bencao = cartao('cart_bencao_de_teste', 'Bênção de Teste', {
      versao: 1,
      acao: 'simples',
      alvo: { quem: 'aliados', forma: { tipo: 'raio', casas: 2 } },
      teste: { tipo: 'naoErra' },
    })
    const npc = ficha('Sacerdote de Teste', { forca: 30 }, { hp: 500, sp: 100, escudo: 0 }, { habilidades: [bencao] })
    const golpe = golpesDeHabilidade(npc, sistema, undefined, null, null).find((item) => item.chave === `tecnica:${bencao.id}`)
    if (golpe === undefined) throw new Error('a Bênção montada sumiu da lista')
    const fichas = [
      { id: 'quemUsa', ...naCasa(2, 2) },
      { id: 'perto', ...naCasa(3, 3) },
    ]
    const alvos = alvosNaOrdemDaMira(
      fichas.map((item): AlvoNaMira => ({ tokenId: item.id, nome: item.id, lado: item.id === 'quemUsa' ? 'eu' : 'aliado', caiu: false })),
      fichas,
      'quemUsa',
      CASA,
      MAPA,
    )

    const mira = miraDaMesaNoChao(golpe, alvos, ['quemUsa', 'perto'])
    expect(mira).toMatchObject({ tokenId: 'quemUsa', forma: { tipo: 'volta' }, acendeQuemUsa: true, mapa: MAPA, centro: null, alvos: [{ col: 3, row: 3, tamanho: 1 }] })
    // Sem a conta das casas (a mesa sem mapa nem grade), nada acende.
    expect(miraDaMesaNoChao(golpe, alvos.map((alvo) => ({ ...alvo, naGrade: undefined })), ['perto'])).toBeNull()

    mostrarMiraDaMesa(mira)
    expect(useMiraNoMapa.getState().local).toBe(mira)
    mostrarMiraDaMesa(null)
    expect(useMiraNoMapa.getState().local).toBeNull()

    // A mira do menu da vez, aberta depois da mesa, não apaga com o "apagar" da mesa.
    mostrarMiraDaMesa(mira)
    const doMenu: MiraNoMapa = { ...(mira ?? alvoFalhou()), tokenId: 'outro' }
    useMiraNoMapa.getState().mostrar(doMenu)
    mostrarMiraDaMesa(null)
    expect(useMiraNoMapa.getState().local).toBe(doMenu)
  })
})

function alvoFalhou(): never {
  throw new Error('a mira da mesa não montou')
}
