/**
 * AS IMAGENS DAS FICHAS NO PUBLICAR (bug de 07/11/2026: as 11 fichas da pasta
 * One Piece chegaram ao Lobby com `retrato: 'midia:...'` e o servidor ficou
 * sem nenhuma imagem). O `publicarPasta` de verdade, com o Tauri, o disco da
 * nuvem e o sincronizador falsos: o `invoke` grava cada `nuvem_enviar_midia`.
 * Nunca toca o disco nem a rede. Dados inventados.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { novoCartao, novoPersonagem, type Personagem } from '../../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../../lib/sistemaOnePiece'
import { publicarPasta, type ProgressoDaPublicacao } from './ponteDoLobby'

const falso = vi.hoisted(() => ({
  /** O que o `POST publicar` responde. */
  respostaDoPublicar: null as unknown, // `as` só ALARGA o tipo do literal (null -> unknown); não esconde erro
  /** Os `midiaId` pedidos ao `nuvem_enviar_midia`, na ordem. */
  enviadas: [] as string[], // `as` dá tipo ao array vazio do fixture; não esconde erro
  /** Os argumentos inteiros de cada envio. */
  argumentos: [] as Record<string, unknown>[], // `as` dá tipo ao array vazio do fixture; não esconde erro
  /** O erro que a R1 devolve para cada imagem que falha. */
  falhas: new Map<string, unknown>(),
}))

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
  invoke: async (comando: string, argumentos?: Record<string, unknown>) => {
    if (comando === 'nuvem_pedir') return falso.respostaDoPublicar
    if (comando !== 'nuvem_enviar_midia' || argumentos === undefined) throw new Error(`comando inesperado no teste: ${comando}`)
    const midiaId = argumentos.midiaId
    if (typeof midiaId !== 'string') throw new Error('nuvem_enviar_midia sem midiaId')
    falso.enviadas.push(midiaId)
    falso.argumentos.push(argumentos)
    const falha = falso.falhas.get(midiaId)
    if (falha !== undefined) throw falha
    return { id: midiaId, tamanho: 1024, novo: true }
  },
}))

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: async () => 'C:/appdata',
  join: async (...partes: string[]) => partes.join('/'),
}))

vi.mock('../../net/nuvem/discoDaNuvem', () => ({
  pastaDaNuvemNoApp: async () => 'C:/appdata/nuvem',
  pastaNoDisco: () => ({}),
  primitivasDoTauri: {},
}))

// A pasta já publicada (o caso do bug: o mestre publica de novo), com o `clienteId` do sincronizador.
vi.mock('../../net/nuvem/estadoNoDisco', () => ({
  lerCampanhas: async () => [{ campanhaId: 'camp_one-piece', pastaId: 'pasta_one-piece', nome: 'One Piece' }],
  lerEstado: async () => ({ clienteId: 'cli_app' }),
  gravarEstado: async () => undefined,
  estadoNovo: () => ({}),
}))

vi.mock('../../net/nuvem/nuvemNoApp', () => ({
  registrarELigar: async () => true,
  retomarLobby: () => undefined,
  membrosPendentesDoApp: async () => ({}),
}))

vi.mock('../../lib/pastasDeMapas', () => ({
  lerRpgDaPasta: async () => ({ ok: false, motivo: 'sem disco no teste' }),
}))

const A = `${'a'.repeat(64)}.webp`
const B = `${'b'.repeat(64)}.png`
const C = `${'c'.repeat(64)}.jpg`

function jogador(nome: string, retrato: string, imagemDoCartao: string | null = null): Personagem {
  const ficha = novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', nome)
  const cartao = { ...novoCartao('Gomu Gomu'), imagem: imagemDoCartao === null ? null : `midia:${imagemDoCartao}` }
  return { ...ficha, retrato: `midia:${retrato}`, abas: { ...ficha.abas, tecnicas: [cartao] } }
}

function respostaDoPublicar(situacoes: readonly [Personagem, string][]) {
  return { campanhaId: 'camp_one-piece', rev: 12, fichas: situacoes.map(([ficha, t]) => ({ fichaId: ficha.id, resposta: { t, opId: `pub:${ficha.id}`, rev: 12 } })), treino: [] }
}

function publicar(personagens: Personagem[], progresso: ProgressoDaPublicacao[] = []) {
  return publicarPasta({ pastaId: 'pasta_one-piece', nome: 'One Piece', sistema: SISTEMA_ONE_PIECE, personagens, contas: [], inimigosLiberados: [] }, (passo) => progresso.push(passo))
}

beforeEach(() => {
  falso.enviadas = []
  falso.argumentos = []
  falso.falhas = new Map()
})

describe('publicar sobe as imagens das fichas', () => {
  it('3 fichas que usam 2 imagens: 2 envios, com os ids certos, mesmo com as fichas voltando ja-publicada', async () => {
    const luffy = jogador('Luffy', A)
    const zoro = jogador('Zoro', B)
    // A mesma imagem no retrato de outra ficha e num cartão não sobe duas vezes.
    const nami = jogador('Nami', A, B)
    falso.respostaDoPublicar = respostaDoPublicar([
      [luffy, 'ja-publicada'],
      [zoro, 'ja-publicada'],
      [nami, 'ja-publicada'],
    ])
    const progresso: ProgressoDaPublicacao[] = []

    const resultado = await publicar([luffy, zoro, nami], progresso)

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.valor.fichas.map((ficha) => ficha.situacao)).toEqual(['ja-publicada', 'ja-publicada', 'ja-publicada'])
    expect(falso.enviadas).toEqual([A, B])
    expect(falso.argumentos).toEqual([
      { campanhaId: 'camp_one-piece', pastaId: 'pasta_one-piece', midiaId: A },
      { campanhaId: 'camp_one-piece', pastaId: 'pasta_one-piece', midiaId: B },
    ])
    expect(resultado.valor.imagens).toEqual({ total: 2, enviadas: 2, falhas: [] })
    expect(progresso.at(-1)).toEqual({ t: 'imagens', feitas: 2, total: 2 })
  })

  it('a imagem que falha não para as outras nem as fichas, e volta listada com as fichas e o motivo', async () => {
    const luffy = jogador('Luffy', A)
    const zoro = jogador('Zoro', B)
    const nami = jogador('Nami', C, B)
    falso.respostaDoPublicar = respostaDoPublicar([
      [luffy, 'ack'],
      [zoro, 'ack'],
      [nami, 'ja-publicada'],
    ])
    // O erro da R1 para o arquivo acima do teto (`ler_imagem_para_enviar`, nuvem.rs).
    falso.falhas.set(B, { codigo: 'midia_invalida', mensagem: 'A imagem passa de 2 MiB.', status: null, detalhe: null })

    const resultado = await publicar([luffy, zoro, nami])

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.valor.fichas.map((ficha) => ficha.situacao)).toEqual(['publicada', 'publicada', 'ja-publicada'])
    expect([...falso.enviadas].sort()).toEqual([A, B, C])
    expect(resultado.valor.imagens).toEqual({
      total: 3,
      enviadas: 2,
      falhas: [{ midiaId: B, fichas: ['Zoro', 'Nami'], motivo: 'a imagem passa de 2 MB, o máximo do Lobby' }],
    })
  })
})
