/**
 * O ÁUDIO TAMBÉM VIAJA COM A AVENTURA (`lib/midiaDaPasta.ts`, Sistema 4 dos
 * sons ao vivo): o efeito gravado mora em `<appData>/midia` como a imagem, e
 * a pasta da aventura leva uma cópia. Ao abrir em outro computador, cada áudio
 * volta conferido pela ASSINATURA dos bytes (não pelo nome), pelo hash e pelo
 * teto de 15 MB, que é só do áudio (a imagem continua com 2 MB).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-fs', async () => (await import('./sons/discoFalso.fixture')).fsFalso)
vi.mock('@tauri-apps/api/path', async () => (await import('./sons/discoFalso.fixture')).pathFalso)

const { arquivos, bytesDe, criarPastasAte, fsFalso, limparDisco, MIDIA_DO_APP, png, wav } = await import('./sons/discoFalso.fixture')
const { useToastStore } = await import('../stores/toastStore')
const { hashHex, idDoAudio, idDosBytes, MIDIA_AUDIO_MAX_BYTES } = await import('./midia')
const { copiarMidiaParaAPasta, importarMidiaDaPasta, trazerMidiaAoAbrir } = await import('./midiaDaPasta')

const MB = 1024 * 1024
const PASTA = 'C:/aventura/midia'

async function idDeAudio(bytes: Uint8Array): Promise<string> {
  const id = await idDoAudio(bytes)
  if (id === null) throw new Error('o teste montou bytes que não são áudio')
  return id
}

async function noApp(bytes: Uint8Array): Promise<string> {
  const id = await idDeAudio(bytes)
  criarPastasAte(MIDIA_DO_APP)
  arquivos.set(`${MIDIA_DO_APP}/${id}`, bytes)
  return id
}

beforeEach(() => {
  limparDisco()
  useToastStore.setState({ toasts: [] })
})

describe('copiarMidiaParaAPasta com áudio', () => {
  it('o wav guardado no app vai para a pasta da aventura com o mesmo nome', async () => {
    const id = await noApp(wav(64, 1))
    expect(await copiarMidiaParaAPasta(PASTA, [id])).toEqual({ copiados: [id], faltaram: [] })
    expect(bytesDe(`${PASTA}/${id}`)).toEqual(wav(64, 1))
  })
})

describe('importarMidiaDaPasta com áudio', () => {
  it('wav de 14 MB vai e volta: chega a outro computador com o hash conferido', async () => {
    const grande = wav(14 * MB, 7)
    const id = await noApp(grande)
    await copiarMidiaParaAPasta(PASTA, [id])
    // Outro computador: a mídia do app está vazia.
    arquivos.delete(`${MIDIA_DO_APP}/${id}`)

    const trazida = await trazerMidiaAoAbrir('C:/aventura/map.json', 'C:/aventura')
    expect(trazida).toEqual({ importados: [id], recusados: [], pastaIlegivel: false })
    const voltou = bytesDe(`${MIDIA_DO_APP}/${id}`)
    expect(`${await hashHex(voltou)}.wav`).toBe(id)
    expect(voltou.length).toBe(14 * MB)
  })

  it('png renomeado para .mp3 é recusado: o tipo vem da assinatura, não do nome', async () => {
    const foto = png(3)
    const nomeFalso = `${await hashHex(foto)}.mp3`
    criarPastasAte(PASTA)
    arquivos.set(`${PASTA}/${nomeFalso}`, foto)

    expect(await importarMidiaDaPasta(PASTA)).toEqual({ importados: [], recusados: [nomeFalso], pastaIlegivel: false })
    expect(arquivos.has(`${MIDIA_DO_APP}/${nomeFalso}`)).toBe(false)
  })

  it('áudio com o nome de outro (hash que não confere) é recusado', async () => {
    const idDoA = await idDeAudio(wav(32, 1))
    criarPastasAte(PASTA)
    arquivos.set(`${PASTA}/${idDoA}`, wav(32, 2))
    expect((await importarMidiaDaPasta(PASTA)).recusados).toEqual([idDoA])
  })

  it('acima de 15 MB é recusado sem ser lido; a imagem continua com o teto de 2 MB', async () => {
    const enorme = new Uint8Array(MIDIA_AUDIO_MAX_BYTES + 1)
    enorme.set([0x49, 0x44, 0x33])
    const idEnorme = `${'b'.repeat(64)}.mp3`
    criarPastasAte(PASTA)
    arquivos.set(`${PASTA}/${idEnorme}`, enorme)
    // Imagem de 3 MB com o hash certo: abaixo do teto do áudio, acima do da imagem.
    const imagem = new Uint8Array(3 * MB)
    imagem.set(png(1))
    const idImagem = await idDosBytes(imagem)
    if (idImagem === null) throw new Error('o teste montou bytes que não são imagem')
    arquivos.set(`${PASTA}/${idImagem}`, imagem)

    const trazida = await importarMidiaDaPasta(PASTA)
    expect(trazida.importados).toEqual([])
    expect([...trazida.recusados].sort()).toEqual([idEnorme, idImagem].sort())
    expect(fsFalso.readFile).not.toHaveBeenCalled()
  })

  it('o áudio recusado ao abrir vira aviso que fala de som, e a abertura segue', async () => {
    const idDoA = await idDeAudio(wav(16, 1))
    criarPastasAte(PASTA)
    arquivos.set(`${PASTA}/${idDoA}`, wav(16, 9))
    const trazida = await trazerMidiaAoAbrir('C:/aventura/map.json', 'C:/aventura')
    expect(trazida.recusados).toEqual([idDoA])
    expect(useToastStore.getState().toasts[0]?.text).toContain('1 som da pasta')
  })
})
