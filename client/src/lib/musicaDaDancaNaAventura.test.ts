import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-fs', async () => (await import('./sons/discoFalso.fixture')).fsFalso)
vi.mock('@tauri-apps/api/path', async () => (await import('./sons/discoFalso.fixture')).pathFalso)

const { arquivos, bytesDe, criarPastasAte, limparDisco, MIDIA_DO_APP, wav } = await import('./sons/discoFalso.fixture')
const { useToastStore } = await import('../stores/toastStore')
const { idDoAudio } = await import('./midia')
const { garantirMusicaNaAventura, guardarMusicaDaDanca, MUSICA_FORA_DA_AVENTURA, prepararMusicaDaDancaNaMesa } = await import('./musicaDaDancaNaAventura')
type MusicaDaDanca = import('../minigames/danca/tipos').MusicaDaDanca

/*
 * SONS F5d, lado do mestre: a música importada da dança mora também em
 * `<aventura>/midia` (de onde `/sons/<id>` serve a mesa), com o hash
 * conferido; sem pasta da aventura, o convite da sala com ela não sai.
 */

const AVENTURA = 'C:/aventuras/salao'

async function idDe(bytes: Uint8Array): Promise<string> {
  const id = await idDoAudio(bytes)
  if (id === null) throw new Error('o teste montou bytes que não são áudio')
  return id
}

function importada(midia: string): MusicaDaDanca {
  return { tipo: 'arquivo', midia, nome: 'Funky', bpm: 120, primeiraBatida: 0.5, fase4: 0, duracaoS: 30, coreografias: { diversao: [], expert: [] } }
}

const toasts = () => useToastStore.getState().toasts.map((t) => t.text)

beforeEach(() => {
  limparDisco()
  useToastStore.setState({ toasts: [] })
})

describe('guardarMusicaDaDanca', () => {
  it('com a aventura numa pasta, grava em <appData>/midia (o mestre toca) E em <aventura>/midia (a sala serve)', async () => {
    const bytes = wav(64, 1)
    const id = await idDe(bytes)
    expect(await guardarMusicaDaDanca(bytes, AVENTURA)).toBe(`midia:${id}`)
    expect(bytesDe(`${MIDIA_DO_APP}/${id}`)).toEqual(bytes)
    expect(bytesDe(`${AVENTURA}/midia/${id}`)).toEqual(bytes)
  })

  it('sem pasta (aventura nova), só em <appData>/midia', async () => {
    const bytes = wav(64, 2)
    const id = await idDe(bytes)
    await guardarMusicaDaDanca(bytes, null)
    expect(bytesDe(`${MIDIA_DO_APP}/${id}`)).toEqual(bytes)
    expect(arquivos.has(`${AVENTURA}/midia/${id}`)).toBe(false)
  })
})

describe('garantirMusicaNaAventura', () => {
  it('já na pasta e conferida: nada a copiar', async () => {
    const bytes = wav(64, 3)
    const id = await idDe(bytes)
    criarPastasAte(`${AVENTURA}/midia`)
    arquivos.set(`${AVENTURA}/midia/${id}`, bytes)
    expect(await garantirMusicaNaAventura(`midia:${id}`, AVENTURA)).toBe(true)
    expect(toasts()).toEqual([])
  })

  it('dança de antes da F5d (só em <appData>/midia): vai para a pasta; a cópia trocada na pasta é refeita pelo hash', async () => {
    const bytes = wav(64, 4)
    const id = await idDe(bytes)
    criarPastasAte(MIDIA_DO_APP)
    arquivos.set(`${MIDIA_DO_APP}/${id}`, bytes)
    expect(await garantirMusicaNaAventura(`midia:${id}`, AVENTURA)).toBe(true)
    expect(bytesDe(`${AVENTURA}/midia/${id}`)).toEqual(bytes)
    arquivos.set(`${AVENTURA}/midia/${id}`, wav(64, 5))
    expect(await garantirMusicaNaAventura(`midia:${id}`, AVENTURA)).toBe(true)
    expect(bytesDe(`${AVENTURA}/midia/${id}`)).toEqual(bytes)
  })

  it('a música não está em lugar nenhum, ou a de <appData> não é a do nome: aviso sem caminho e false', async () => {
    const bytes = wav(64, 6)
    const id = await idDe(bytes)
    expect(await garantirMusicaNaAventura(`midia:${id}`, AVENTURA)).toBe(false)
    criarPastasAte(MIDIA_DO_APP)
    arquivos.set(`${MIDIA_DO_APP}/${id}`, wav(64, 7))
    expect(await garantirMusicaNaAventura(`midia:${id}`, AVENTURA)).toBe(false)
    expect(arquivos.has(`${AVENTURA}/midia/${id}`)).toBe(false)
    expect(toasts()).toContain(MUSICA_FORA_DA_AVENTURA)
    for (const texto of toasts()) expect(texto).not.toMatch(/C:|aventuras|midia/)
  })
})

describe('prepararMusicaDaDancaNaMesa (antes do convite da sala)', () => {
  it('faixa demo sempre sai; importada sem pasta não sai; com pasta sai e a cópia é garantida', () => {
    const garantir = vi.fn(async () => true)
    expect(prepararMusicaDaDancaNaMesa({ tipo: 'demo' }, null, garantir)).toBe(true)
    expect(prepararMusicaDaDancaNaMesa(importada(`midia:${'ab'.repeat(32)}.wav`), null, garantir)).toBe(false)
    expect(garantir).not.toHaveBeenCalled()
    expect(prepararMusicaDaDancaNaMesa(importada(`midia:${'ab'.repeat(32)}.wav`), AVENTURA, garantir)).toBe(true)
    expect(garantir).toHaveBeenCalledWith(`midia:${'ab'.repeat(32)}.wav`, AVENTURA)
  })
})
