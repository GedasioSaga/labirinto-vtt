/**
 * PRELÚDIO, voltar (pedido de 17/11: "eu aperto para entrar e não consigo
 * voltar fácil"): cada ida guarda o lugar de antes, e o "‹" do topo, o Alt+← e
 * o botão de voltar do mouse desfazem uma ida por vez. O disco é de mentira e
 * os verbetes, inventados (repositório público).
 */
import { afterEach, expect, it, vi } from 'vitest'
import { verbeteNovo } from '../../lib/preparo/enciclopedia'
import type { Verbete } from '../../lib/preparo/tipos'
import type { Lugar, Volta } from './preludio'

const disco = new Map<string, Verbete>()

vi.mock('../../lib/preparo/disco', () => ({
  lerIndiceDoPreparo: vi.fn(async () => ({ estado: 'novo' })),
  listarNoPreparo: vi.fn(async () => [...disco.keys()].sort()),
  lerVerbete: vi.fn(async (id: string) => {
    const verbete = disco.get(id)
    return verbete === undefined ? { estado: 'novo' } : { estado: 'ok', valor: structuredClone(verbete), aviso: null }
  }),
  gravarVerbete: vi.fn(async (verbete: Verbete) => {
    disco.set(verbete.id, structuredClone(verbete))
  }),
  lerTempo: vi.fn(async () => ({ estado: 'novo' })),
  gravarTempo: vi.fn(async () => undefined),
}))

vi.mock('../midia', () => ({ prepararMidia: vi.fn(async () => null) }))

const { usePreludio } = await import('./preludio')

const INICIO: Lugar = { secao: 'inicio' }
const LUGARES: Lugar = { secao: 'enciclopedia', tipo: 'lugar', verbeteId: null }
const QUADROS: Lugar = { secao: 'quadros', quadroId: null }

function lugarInventado(id: string, titulo: string): Lugar {
  disco.set(id, verbeteNovo('lugar', titulo, { campanhas: [] }, () => id))
  return { secao: 'enciclopedia', tipo: 'lugar', verbeteId: id }
}

function ondeEsta(): Lugar {
  return usePreludio.getState().lugar
}

afterEach(async () => {
  await usePreludio.getState().fechar()
  disco.clear()
})

it('cada ida guarda o lugar de antes; voltar desfaz uma por vez, com a volta ao quadro que a página oferecia, e fechar esquece', async () => {
  const farol = lugarInventado('vb-farol-inventado', 'Farol de mentira')
  await usePreludio.getState().carregar()
  const { ir, voltarUmPasso } = usePreludio.getState()
  const doQuadro: Volta = { lugar: { secao: 'quadros', quadroId: 'quadro-inventado' }, rotulo: 'Voltar ao quadro' }

  ir(LUGARES)
  ir(farol, doQuadro)
  // Ir aonde já está não é passo.
  ir(farol, doQuadro)
  ir(QUADROS)
  expect(usePreludio.getState().historico.map((passo) => passo.lugar)).toEqual([INICIO, LUGARES, farol])

  voltarUmPasso()
  expect(ondeEsta()).toEqual(farol)
  expect(usePreludio.getState().voltar).toEqual(doQuadro)
  voltarUmPasso()
  expect(ondeEsta()).toEqual(LUGARES)
  expect(usePreludio.getState().voltar).toBeNull()
  voltarUmPasso()
  // No Início e sem passo para trás, nada acontece.
  voltarUmPasso()
  expect(ondeEsta()).toEqual(INICIO)
  expect(usePreludio.getState().historico).toEqual([])

  for (let vez = 0; vez < 60; vez += 1) ir(vez % 2 === 0 ? LUGARES : QUADROS)
  expect(usePreludio.getState().historico).toHaveLength(50)

  await usePreludio.getState().fechar()
  expect(usePreludio.getState().historico).toEqual([])
  expect(ondeEsta()).toEqual(INICIO)
})

it('voltar pula o verbete que não existe mais e, sem passo para trás, sobe pela trilha até o Início', async () => {
  const farol = lugarInventado('vb-farol-inventado', 'Farol de mentira')
  const torre = lugarInventado('vb-torre-inventada', 'Torre de mentira')
  await usePreludio.getState().carregar()
  const { ir, voltarUmPasso } = usePreludio.getState()
  ir(farol)
  ir(torre)
  ir(LUGARES)
  // A torre saiu do Prelúdio enquanto a pessoa estava na lista.
  const semATorre = new Map(usePreludio.getState().verbetes)
  semATorre.delete('vb-torre-inventada')
  usePreludio.setState({ verbetes: semATorre })

  voltarUmPasso()
  expect(ondeEsta()).toEqual(farol)
  expect(usePreludio.getState().historico.map((passo) => passo.lugar)).toEqual([INICIO])

  // Aberto direto no Quadro de uma sessão, sem histórico: Roteiro, Sessões, Início, e lá fica.
  usePreludio.setState({ lugar: { secao: 'sessoes', sessaoId: 'sessao-inventada', aba: 'quadro' }, historico: [] })
  const caminho: Lugar[] = []
  for (let vez = 0; vez < 4; vez += 1) {
    voltarUmPasso()
    caminho.push(ondeEsta())
  }
  expect(caminho).toEqual([{ secao: 'sessoes', sessaoId: 'sessao-inventada' }, { secao: 'sessoes', sessaoId: null }, INICIO, INICIO])
})

it('voltar pula a página do verbete que foi para a Lixeira, que continua na loja', async () => {
  const farol = lugarInventado('vb-farol-inventado', 'Farol de mentira')
  const torre = lugarInventado('vb-torre-inventada', 'Torre de mentira')
  await usePreludio.getState().carregar()
  const { ir, voltarUmPasso, mudarVerbete } = usePreludio.getState()
  ir(farol)
  ir(torre)
  ir(LUGARES)
  // A torre foi para a Lixeira enquanto a pessoa estava na lista: guardada, não apagada.
  mudarVerbete('vb-torre-inventada', (atual) => ({ ...atual, lixeira: '2026-11-17T12:00:00.000Z' }))
  expect(usePreludio.getState().verbetes.has('vb-torre-inventada')).toBe(true)

  voltarUmPasso()
  expect(ondeEsta()).toEqual(farol)
})
