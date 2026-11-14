import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * CUTSCENES DO MESTRE (14/11/2026): a lista guardada em `<appData>/cutscenes.json`
 * e o acerto com a Galeria do site. O disco e a nuvem são de mentira: o que se
 * confere é a regra da loja (o que volta do disco, quando sobe, e o que a
 * releitura da Galeria muda quando o mestre tirou um vídeo pelo site).
 */

const falsos = vi.hoisted(() => ({
  disco: new Map<string, string>(),
  campanha: 'camp_1' as string | null,
  noSite: new Set<string>(),
  galeriaFalha: false,
  subidas: [] as string[],
}))

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: async () => 'C:/appdata',
  join: async (...partes: string[]) => partes.join('/'),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: async (caminho: string) => falsos.disco.has(caminho),
  readTextFile: async (caminho: string) => falsos.disco.get(caminho) ?? '',
  writeTextFile: async (caminho: string, texto: string) => {
    falsos.disco.set(caminho, texto)
  },
}))

vi.mock('../net/nuvem/galeriaNaNuvem', () => ({
  GALERIA_VIDEO_MAX_BYTES: 150 * 1024 * 1024,
  campanhaDaPastaAberta: async () => falsos.campanha,
  lerGaleria: async () => {
    if (falsos.galeriaFalha) throw { codigo: 'rede', mensagem: 'Sem conexão com o Lobby.' }
    return new Set(falsos.noSite)
  },
  enviarVideoParaAGaleria: async (campanhaId: string, videoId: string) => {
    falsos.subidas.push(`${campanhaId}/${videoId}`)
    falsos.noSite.add(videoId)
  },
  mensagemDaFalha: (erro: unknown) => String(erro),
}))

const { useCutscenesStore } = await import('./cutscenesStore')
type Cutscene = ReturnType<typeof useCutscenesStore.getState>['lista'][number]

const MB = 1024 * 1024
const video = (letra: string) => `${letra.repeat(64)}.mp4`
const cutscene = (id: string, letra: string, mais: Partial<Cutscene> = {}): Cutscene => ({ id, titulo: `Cena ${id}`, video: video(letra), tamanho: 10 * MB, naGaleria: true, exibida: true, ...mais })
const daLista = (id: string) => useCutscenesStore.getState().lista.find((c) => c.id === id)

beforeEach(() => {
  falsos.disco.clear()
  falsos.campanha = 'camp_1'
  falsos.noSite = new Set()
  falsos.galeriaFalha = false
  falsos.subidas = []
  useCutscenesStore.setState({ lista: [], carregada: false, exibicao: null })
})

describe('cutscenesStore', () => {
  it('a releitura da Galeria tira o que o mestre tirou pelo site e marca o que está lá; sem rede ou sem campanha não mexe', async () => {
    falsos.noSite = new Set([video('b'), video('c')])
    useCutscenesStore.setState({
      carregada: true,
      lista: [
        cutscene('tirada', 'a', { galeria: { estado: 'enviado', campanhaId: 'camp_1' } }),
        cutscene('ficou', 'b', { galeria: { estado: 'enviado', campanhaId: 'camp_1' } }),
        cutscene('subiu-noutra-sessao', 'c', { naGaleria: false, galeria: { estado: 'erro', campanhaId: null, erro: 'parou' } }),
        cutscene('subindo', 'd', { galeria: { estado: 'enviando', campanhaId: 'camp_1', pct: 40 } }),
        cutscene('outra-campanha', 'e', { galeria: { estado: 'enviado', campanhaId: 'camp_2' } }),
      ],
    })
    await useCutscenesStore.getState().conferirGaleria()
    expect(daLista('tirada')).toMatchObject({ naGaleria: false, galeria: undefined })
    expect(daLista('ficou')?.galeria).toEqual({ estado: 'enviado', campanhaId: 'camp_1' })
    expect(daLista('subiu-noutra-sessao')).toMatchObject({ naGaleria: true, galeria: { estado: 'enviado', campanhaId: 'camp_1' } })
    expect(daLista('subindo')?.galeria).toEqual({ estado: 'enviando', campanhaId: 'camp_1', pct: 40 })
    expect(daLista('outra-campanha')?.galeria).toEqual({ estado: 'enviado', campanhaId: 'camp_2' })
    // A mudança vai para o disco: fechar e abrir o app não traz a tirada de volta.
    await vi.waitFor(() => expect(falsos.disco.get('C:/appdata/cutscenes.json') ?? '').toContain('"naGaleria": false'))

    const antes = useCutscenesStore.getState().lista
    falsos.noSite = new Set()
    falsos.galeriaFalha = true
    await useCutscenesStore.getState().conferirGaleria()
    falsos.galeriaFalha = false
    falsos.campanha = null
    await useCutscenesStore.getState().conferirGaleria()
    expect(useCutscenesStore.getState().lista).toBe(antes)
  })

  it('do disco só volta o que confere ("enviando" vira erro); a 1ª exibição sobe com "Na Galeria" e acima de 150 MB não sobe', async () => {
    falsos.disco.set(
      'C:/appdata/cutscenes.json',
      JSON.stringify({
        versao: 1,
        cutscenes: [
          cutscene('ok', 'a', { exibida: false, galeria: undefined }),
          cutscene('meio', 'b', { galeria: { estado: 'enviando', campanhaId: 'camp_1', pct: 30 } }),
          { ...cutscene('torta', 'c'), video: 'https://exemplo.com/v.mp4' },
          { ...cutscene('titulo-longo', 'd'), titulo: 'x'.repeat(81) },
          cutscene('grande', 'e', { exibida: false, tamanho: 151 * MB }),
        ],
      }),
    )
    await useCutscenesStore.getState().carregar()
    expect(useCutscenesStore.getState().lista.map((c) => c.id)).toEqual(['ok', 'meio', 'grande'])
    expect(daLista('meio')?.galeria?.estado).toBe('erro')

    useCutscenesStore.getState().marcarExibida('ok')
    await vi.waitFor(() => expect(daLista('ok')?.galeria).toEqual({ estado: 'enviado', campanhaId: 'camp_1' }))
    expect(daLista('ok')?.exibida).toBe(true)
    // Exibir de novo não sobe de novo.
    useCutscenesStore.getState().marcarExibida('ok')
    useCutscenesStore.getState().marcarExibida('grande')
    await vi.waitFor(() => expect(daLista('grande')?.galeria).toEqual({ estado: 'grande' }))
    expect(falsos.subidas).toEqual([`camp_1/${video('a')}`])
  })
})
