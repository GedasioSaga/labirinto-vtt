/**
 * A BIBLIOTECA DE SONS NA MEMÓRIA (`stores/bibliotecaDeSonsStore.ts`): grava
 * sozinha 400 ms depois da última mudança, fora do Ctrl+Z e sem deixar o mapa
 * "não salvo"; a aventura nova sem pasta guarda na memória e grava quando a
 * pasta aparece; o áudio importado viaja com a pasta da aventura.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-fs', async () => (await import('../lib/sons/discoFalso.fixture')).fsFalso)
vi.mock('@tauri-apps/api/path', async () => (await import('../lib/sons/discoFalso.fixture')).pathFalso)

const { arquivos, bytesDe, criarPastasAte, fsFalso, limparDisco, MIDIA_DO_APP, png, textoDe, wav } = await import('../lib/sons/discoFalso.fixture')
const { useToastStore } = await import('./toastStore')
const { useMapStore } = await import('./mapStore')
const { hasUnsavedWork, useAdventureStore } = await import('./adventureStore')
const { hashHex, MIDIA_AUDIO_MAX_BYTES } = await import('../lib/midia')
const { AUDIO_GRANDE_DEMAIS, AUDIO_NAO_E_AUDIO } = await import('../lib/midiaNoDisco')
const { trazerMidiaAoAbrir } = await import('../lib/midiaDaPasta')
const { ehVideoDoYoutube, bibliotecaDeSonsVazia } = await import('../lib/sons/biblioteca')
const { ESPERA_PARA_GRAVAR_SONS_MS, ligarBibliotecaAAventura, SONS_SEM_AVENTURA, useBibliotecaDeSonsStore } = await import('./bibliotecaDeSonsStore')
type FonteDoSom = import('../lib/sons/biblioteca').FonteDoSom
type Adventure = import('../lib/adventure').Adventure

const MB = 1024 * 1024
const AVENTURA = 'C:/aventuras/navio'
const SONS = `${AVENTURA}/sons.json`

function youtube(video: string): FonteDoSom {
  if (!ehVideoDoYoutube(video)) throw new Error(`vídeo inválido no teste: ${video}`)
  return { tipo: 'youtube', video }
}

function aventura(id: string): Adventure {
  return { version: 1, id, name: 'Navio', startSceneId: 'scene_1', scenes: [{ id: 'scene_1', name: 'Convés', file: 'map.json' }] }
}

const loja = () => useBibliotecaDeSonsStore.getState()

/** Quantas vezes o sons.json foi escrito (a gravação segura escreve o `.tmp` e renomeia). */
function gravacoesDoSons(pasta: string): number {
  return fsFalso.writeTextFile.mock.calls.filter(([caminho]) => caminho === `${pasta}/sons.json.tmp`).length
}

beforeEach(() => {
  limparDisco()
  criarPastasAte(AVENTURA)
  useToastStore.setState({ toasts: [] })
  useBibliotecaDeSonsStore.setState(useBibliotecaDeSonsStore.getInitialState())
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  useAdventureStore.setState({ adventure: null, dir: null })
})

describe('salvamento sozinho', () => {
  it(`grava ${ESPERA_PARA_GRAVAR_SONS_MS} ms depois da ÚLTIMA mudança, uma vez só, sem sujar o mapa nem entrar no Ctrl+Z`, async () => {
    await loja().sincronizarComAAventura('adv_e', AVENTURA)
    const { map, past, future } = useMapStore.getState()
    expect(hasUnsavedWork()).toBe(false)

    const efeito = loja().adicionarEfeito({ nome: 'Sino', fonte: youtube('dQw4w9WgXcQ') })
    if (efeito === null) throw new Error('não adicionou')
    expect(loja().pendente).toBe(true)
    await vi.advanceTimersByTimeAsync(ESPERA_PARA_GRAVAR_SONS_MS - 1)
    expect(arquivos.has(SONS)).toBe(false)

    // Mudança no meio da espera: o relógio recomeça.
    expect(loja().editarEfeito(efeito.id, { volume: 0.3 })).toBe(true)
    await vi.advanceTimersByTimeAsync(ESPERA_PARA_GRAVAR_SONS_MS - 1)
    expect(arquivos.has(SONS)).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await vi.waitFor(() => expect(arquivos.has(SONS)).toBe(true))
    expect(gravacoesDoSons(AVENTURA)).toBe(1)
    expect(JSON.parse(textoDe(SONS)).efeitos[0]).toMatchObject({ id: efeito.id, nome: 'Sino', volume: 0.3 })
    expect(loja().pendente).toBe(false)

    // O mapa e a aventura nem souberam: nada "não salvo", nada no Ctrl+Z.
    expect(hasUnsavedWork()).toBe(false)
    expect(useMapStore.getState().map).toBe(map)
    expect(useMapStore.getState().past).toBe(past)
    expect(useMapStore.getState().future).toBe(future)
  })

  it('trocar de aventura com mudança esperando: ela vai para a pasta da ANTERIOR antes de trocar', async () => {
    const outra = 'C:/aventuras/castelo'
    criarPastasAte(outra)
    await loja().sincronizarComAAventura('adv_1', AVENTURA)
    loja().adicionarEfeito({ nome: 'Gaivota', fonte: youtube('dQw4w9WgXcQ') })

    await loja().sincronizarComAAventura('adv_2', outra)
    expect(JSON.parse(textoDe(SONS)).efeitos.map((efeito: { nome: string }) => efeito.nome)).toEqual(['Gaivota'])
    expect(loja().biblioteca).toEqual(bibliotecaDeSonsVazia())
    expect(arquivos.has(`${outra}/sons.json`)).toBe(false)
  })
})

describe('aventura nova sem pasta', () => {
  it('guarda na memória e grava quando a pasta aparece', async () => {
    const nova = 'C:/aventuras/nova'
    await loja().sincronizarComAAventura('adv_f', null)
    expect(loja().adicionarEfeito({ nome: 'Trovão', fonte: youtube('a-b_C1234xY') })).not.toBeNull()
    await vi.advanceTimersByTimeAsync(ESPERA_PARA_GRAVAR_SONS_MS * 3)
    expect([...arquivos.keys()].some((caminho) => caminho.endsWith('sons.json'))).toBe(false)
    expect(loja().pendente).toBe(true)

    // A primeira gravação da aventura dá a pasta (mesma aventura, `dir` aparece).
    criarPastasAte(nova)
    await loja().sincronizarComAAventura('adv_f', nova)
    expect(JSON.parse(textoDe(`${nova}/sons.json`)).efeitos.map((efeito: { nome: string }) => efeito.nome)).toEqual(['Trovão'])
    expect(loja().pendente).toBe(false)
  })

  it('mapa solto (sem aventura) não guarda sons', async () => {
    await loja().sincronizarComAAventura(null, null)
    expect(loja().adicionarEfeito({ nome: 'Trovão', fonte: youtube('a-b_C1234xY') })).toBeNull()
    await expect(loja().importarArquivoDeSom('trovao.wav', wav(64))).rejects.toThrow(SONS_SEM_AVENTURA)
  })
})

describe('ligado à aventura aberta', () => {
  it('aventura antiga (sem sons.json) abre com biblioteca vazia, sem aviso; a nova ganha pasta e grava', async () => {
    const desligar = ligarBibliotecaAAventura()
    try {
      useAdventureStore.setState({ adventure: aventura('adv_velha'), dir: AVENTURA })
      await vi.waitFor(() => expect(loja()).toMatchObject({ aventuraId: 'adv_velha', carregando: false }))
      expect(loja()).toMatchObject({ biblioteca: bibliotecaDeSonsVazia(), aviso: null, podeGravar: true, pendente: false })
      expect(useToastStore.getState().toasts).toEqual([])
      expect(fsFalso.writeTextFile).not.toHaveBeenCalled()

      // Aventura nova, nascida do mapa solto: sem pasta até a primeira gravação.
      const nova = 'C:/aventuras/nova'
      useAdventureStore.setState({ adventure: aventura('adv_nova'), dir: null })
      await vi.waitFor(() => expect(loja().aventuraId).toBe('adv_nova'))
      loja().adicionarEfeito({ nome: 'Sino', fonte: youtube('dQw4w9WgXcQ') })
      criarPastasAte(nova)
      useAdventureStore.setState({ dir: nova })
      await vi.waitFor(() => expect(arquivos.has(`${nova}/sons.json`)).toBe(true))
    } finally {
      desligar()
    }
  })
})

describe('áudio importado viaja com a aventura', () => {
  it('wav de 14 MB: guardado no app, levado para <aventura>/midia ao gravar, e de volta em outro computador com o hash conferido', async () => {
    await loja().sincronizarComAAventura('adv_d', AVENTURA)
    const grande = wav(14 * MB, 5)
    const efeito = await loja().importarArquivoDeSom('C:\\sons\\Trovão.wav', grande)
    expect(efeito).toMatchObject({ nome: 'Trovão', fonte: { tipo: 'arquivo', bytes: 14 * MB }, volume: 0.8, loop: false })
    if (efeito.fonte.tipo !== 'arquivo') throw new Error('fonte errada')
    const id = efeito.fonte.ref.slice('midia:'.length)
    expect(id).toBe(`${await hashHex(grande)}.wav`)

    await loja().gravarAgora()
    expect(bytesDe(`${AVENTURA}/midia/${id}`).length).toBe(14 * MB)

    // Outro computador: só a pasta da aventura foi junto.
    arquivos.delete(`${MIDIA_DO_APP}/${id}`)
    const trazida = await trazerMidiaAoAbrir(`${AVENTURA}/map.json`, AVENTURA)
    expect(trazida.importados).toEqual([id])
    expect(`${await hashHex(bytesDe(`${MIDIA_DO_APP}/${id}`))}.wav`).toBe(id)
  })

  it('acima de 15 MB é recusado com AUDIO_GRANDE_DEMAIS; png renomeado para .mp3 com AUDIO_NAO_E_AUDIO; nada muda', async () => {
    await loja().sincronizarComAAventura('adv_d2', AVENTURA)
    const enorme = new Uint8Array(MIDIA_AUDIO_MAX_BYTES + 1)
    enorme.set([0x49, 0x44, 0x33])
    await expect(loja().importarArquivoDeSom('enorme.mp3', enorme)).rejects.toThrow(AUDIO_GRANDE_DEMAIS)
    await expect(loja().importarArquivoDeSom('foto.mp3', png(1))).rejects.toThrow(AUDIO_NAO_E_AUDIO)
    expect(loja().biblioteca).toEqual(bibliotecaDeSonsVazia())
    expect(loja().pendente).toBe(false)
    expect(fsFalso.writeFile).not.toHaveBeenCalled()
  })
})
