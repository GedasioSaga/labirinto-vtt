/**
 * O SISTEMA EDITADO COM A SALA ABERTA (entrega 6): o mestre salva no editor,
 * a biblioteca troca o objeto do sistema, e o host reenvia o `rpg.sistema` a
 * cada jogador UMA vez — sem reenviar a cada broadcast depois — e o livro que
 * o jogador pede de novo já é o editado. O caminho é o de sempre: a mesma
 * troca de referência que entrega o sistema importado (`personagensUpdate`).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  exists: vi.fn(async () => true),
  readTextFile: vi.fn(async () => '{}'),
  readDir: vi.fn(async () => []),
  stat: vi.fn(async () => ({ mtime: null })),
  remove: vi.fn(async () => undefined),
  copyFile: vi.fn(async () => undefined),
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined), isTauri: () => true }))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:/appdata'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (path: string) => path.slice(0, path.lastIndexOf('/'))),
}))

const { createEmptyMap } = await import('../lib/mapFactory')
const { rascunhoDoSistema, sistemaDoRascunho } = await import('../lib/editorDeSistema')
const { resumoDoLivro, sistemaSemLivro } = await import('../lib/livroDeRegras')
const { SISTEMA_ONE_PIECE } = await import('../lib/sistemaOnePiece')
const { sistemaPorId, useRpgStore } = await import('../stores/rpgStore')
const { createHostSession } = await import('./hostSession')
const { lerPacoteDoLivro } = await import('./protocoloDoLivro')

type HostWorld = import('./hostSession').HostWorld
type HostResult = import('./hostSession').HostResult
type SistemaDeRpg = import('../lib/sistemaDeRpg').SistemaDeRpg

const CODIGO = 'ABC123'
const CASA_ID = 'one-piece-da-mesa'

beforeEach(() => {
  useRpgStore.setState({ biblioteca: [SISTEMA_ONE_PIECE, { ...SISTEMA_ONE_PIECE, id: CASA_ID, nome: 'One Piece da Mesa' }] })
})

/** A sala com a aventura no sistema da casa: o mundo lê o sistema da biblioteca a cada broadcast, como `hostWorldOf`. */
function sala() {
  let ids = 0
  const mundo = (): HostWorld => ({
    open: { sceneId: 'cena-1', name: 'Navio', map: { ...createEmptyMap('m1', 'Navio', 40, 40, 50), tokens: [] } },
    background: [],
    rpg: { sistema: sistemaPorId(useRpgStore.getState().biblioteca, CASA_ID) ?? null, personagens: [] },
  })
  const session = createHostSession({ code: CODIGO, visionRadius: 2000, randomId: () => `id-${++ids}` })
  session.handleMessage('c1', { type: 'join', code: CODIGO, name: 'Ana' }, mundo())
  session.handleMessage('c2', { type: 'join', code: CODIGO, name: 'Beto' }, mundo())
  session.broadcast(mundo())
  return { session, mundo }
}

const sistemasEnviados = (r: HostResult, clientId: string) => r.outbound.filter((o) => o.clientId === clientId && o.msg.type === 'rpg.sistema').map((o) => o.msg)

/** O mestre muda a Força para "Poder" e reescreve o primeiro capítulo, e salva pelo editor. */
async function mestreEdita(): Promise<SistemaDeRpg> {
  const atual = sistemaPorId(useRpgStore.getState().biblioteca, CASA_ID)
  if (atual === undefined) throw new Error('o sistema da casa deveria estar na biblioteca')
  const rascunho = rascunhoDoSistema(atual)
  const resultado = sistemaDoRascunho(
    {
      ...rascunho,
      atributos: rascunho.atributos.map((atributo) => (atributo.id === 'forca' ? { ...atributo, nome: 'Poder' } : atributo)),
      livro: rascunho.livro.map((capitulo, i) => (i === 0 ? { ...capitulo, titulo: 'Mecânicas da Mesa', texto: 'Regra nova da casa.' } : capitulo)),
    },
    new Set(),
  )
  if (!resultado.ok) throw new Error(resultado.erros.map((erro) => erro.texto).join(' | '))
  await useRpgStore.getState().salvarSistema(resultado.sistema)
  return resultado.sistema
}

describe('host: o sistema editado chega a quem está na sala', () => {
  it('cada jogador recebe o sistema editado uma vez; o broadcast seguinte não reenvia', async () => {
    const { session, mundo } = sala()
    expect(sistemasEnviados(session.broadcast(mundo()), 'c1')).toEqual([])

    const editado = await mestreEdita()
    const depois = session.broadcast(mundo())
    for (const clientId of ['c1', 'c2']) {
      expect(sistemasEnviados(depois, clientId)).toEqual([{ type: 'rpg.sistema', sistema: sistemaSemLivro(editado), livro: resumoDoLivro(editado) }])
    }
    const msg = sistemasEnviados(depois, 'c1')[0]
    expect(msg?.type === 'rpg.sistema' ? msg.sistema?.atributos.find((atributo) => atributo.id === 'forca')?.nome : null).toBe('Poder')
    expect(sistemasEnviados(session.broadcast(mundo()), 'c1')).toEqual([])
  })

  it('o livro que o jogador pede depois da edição já é o editado', async () => {
    const { session, mundo } = sala()
    const editado = await mestreEdita()
    session.broadcast(mundo())
    const r = session.handleMessage('c1', { type: 'livro.pedir', reqId: 'l1', sistemaId: CASA_ID }, mundo())
    const partes = r.outbound.flatMap((o) => (o.clientId === 'c1' && o.msg.type === 'livro.parte' ? [o.msg] : []))
    expect(partes.length).toBeGreaterThan(0)
    const lido = lerPacoteDoLivro(
      [...partes]
        .sort((a, b) => a.indice - b.indice)
        .map((parte) => parte.texto)
        .join(''),
      sistemaSemLivro(editado),
    )
    expect(lido?.livro[0]).toEqual({ id: editado.livro?.[0].id, titulo: 'Mecânicas da Mesa', ordem: editado.livro?.[0].ordem, texto: 'Regra nova da casa.' })
  })
})
