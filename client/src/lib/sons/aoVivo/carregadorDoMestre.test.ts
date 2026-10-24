import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-fs', async () => (await import('../discoFalso.fixture')).fsFalso)
vi.mock('@tauri-apps/api/path', async () => (await import('../discoFalso.fixture')).pathFalso)

const { arquivos, bytesDe, criarPastasAte, limparDisco, MIDIA_DO_APP, wav } = await import('../discoFalso.fixture')
const { useToastStore } = await import('../../../stores/toastStore')
const { arquivosDaMidiaDaAventura, carregarBytesDoMestre, criarCarregadorDoMestre, pesoDaMidiaComSons, tamanhoDaMidiaDaAventura } = await import('./carregadorDoMestre')
const { AUDIO_GUARDADO_SUMIU } = await import('../../midiaNoDisco')
const { idDoAudio } = await import('../../midia')
const { useBibliotecaDeSonsStore } = await import('../../../stores/bibliotecaDeSonsStore')
const { bibliotecaDeSonsVazia, comEfeitoNovo } = await import('../biblioteca')
type BibliotecaDeSons = import('../biblioteca').BibliotecaDeSons

/*
 * O LADO DO MESTRE dos sons ao vivo: os bytes que o motor toca vêm de
 * `<aventura>/midia/<id>` (e, sem eles lá, de `<appData>/midia/<id>`), e a
 * página mostra quanto pesa `<aventura>/midia/`.
 */

const ID = `${'ab'.repeat(32)}.wav`
const AVENTURA = 'C:/aventuras/navio'

beforeEach(() => {
  limparDisco()
  useToastStore.setState({ toasts: [] })
})

describe('carregarBytesDoMestre', () => {
  it('lê o áudio guardado pelo id; o que sumiu da pasta lança com a frase pronta; id que não é áudio também lança', async () => {
    criarPastasAte(MIDIA_DO_APP)
    arquivos.set(`${MIDIA_DO_APP}/${ID}`, wav(64, 3))
    expect(await carregarBytesDoMestre(ID)).toEqual(wav(64, 3))
    await expect(carregarBytesDoMestre(`${'cd'.repeat(32)}.wav`)).rejects.toThrow(AUDIO_GUARDADO_SUMIU)
    await expect(carregarBytesDoMestre('nao-e-audio.png')).rejects.toThrow('isso não é um áudio guardado')
  })

  it('o som da biblioteca vem de <aventura>/midia, sem cópia em <appData>/midia (fechamento (b) da F5); a pasta é a da biblioteca aberta', async () => {
    const bytes = wav(64, 7)
    const id = await idDoAudio(bytes)
    if (id === null) throw new Error('o teste montou bytes que não são áudio')
    criarPastasAte(`${AVENTURA}/midia`)
    arquivos.set(`${AVENTURA}/midia/${id}`, bytes)

    expect(await criarCarregadorDoMestre(() => AVENTURA)(id)).toEqual(bytes)
    expect(arquivos.has(`${MIDIA_DO_APP}/${id}`)).toBe(false)
    useBibliotecaDeSonsStore.setState({ dir: AVENTURA })
    try {
      expect(await carregarBytesDoMestre(id)).toEqual(bytes)
    } finally {
      useBibliotecaDeSonsStore.setState({ dir: null })
    }
  })

  it('sem a pasta (aventura nova) vem de <appData>/midia e nada é escrito; com a pasta aberta e o som faltando ou trocado nela, toca E volta para a pasta (de onde /sons serve a mesa)', async () => {
    const bytes = wav(64, 8)
    const id = await idDoAudio(bytes)
    if (id === null) throw new Error('o teste montou bytes que não são áudio')
    criarPastasAte(MIDIA_DO_APP)
    arquivos.set(`${MIDIA_DO_APP}/${id}`, bytes)
    expect(await criarCarregadorDoMestre(() => null)(id)).toEqual(bytes)
    expect(arquivos.has(`${AVENTURA}/midia/${id}`)).toBe(false)

    expect(await criarCarregadorDoMestre(() => AVENTURA)(id)).toEqual(bytes)
    expect(bytesDe(`${AVENTURA}/midia/${id}`)).toEqual(bytes)

    // Trocado com o mesmo tamanho: o hash decide, e a cópia certa volta.
    arquivos.set(`${AVENTURA}/midia/${id}`, wav(64, 9))
    expect(await criarCarregadorDoMestre(() => AVENTURA)(id)).toEqual(bytes)
    expect(bytesDe(`${AVENTURA}/midia/${id}`)).toEqual(bytes)
    expect(useToastStore.getState().toasts).toEqual([])

    arquivos.delete(`${MIDIA_DO_APP}/${id}`)
    arquivos.delete(`${AVENTURA}/midia/${id}`)
    await expect(criarCarregadorDoMestre(() => AVENTURA)(id)).rejects.toThrow(AUDIO_GUARDADO_SUMIU)
  })

  it('o que não dá para devolver à pasta vira aviso em texto simples, sem caminho; o mestre ainda ouve', async () => {
    // Em <appData>/midia com conteúdo que não é o do nome: ir para a pasta com esse nome daria o 404 de novo.
    criarPastasAte(MIDIA_DO_APP)
    arquivos.set(`${MIDIA_DO_APP}/${ID}`, wav(64, 3))
    criarPastasAte(`${AVENTURA}/midia`)

    expect(await criarCarregadorDoMestre(() => AVENTURA)(ID)).toEqual(wav(64, 3))
    expect(arquivos.has(`${AVENTURA}/midia/${ID}`)).toBe(false)
    const avisos = useToastStore.getState().toasts.map((toast) => toast.text)
    expect(avisos).toEqual([expect.stringContaining('não toca na mesa')])
    expect(avisos[0]).not.toMatch(/[A-Za-z]:[\\/]|appdata|aventuras|\.wav/i)
  })
})

describe('tamanhoDaMidiaDaAventura', () => {
  it('soma os arquivos de <aventura>/midia (pasta dentro não conta); sem a pasta, 0', async () => {
    expect(await tamanhoDaMidiaDaAventura(AVENTURA)).toBe(0)
    criarPastasAte(`${AVENTURA}/midia/sub`)
    arquivos.set(`${AVENTURA}/midia/${ID}`, new Uint8Array(1000))
    arquivos.set(`${AVENTURA}/midia/${'ef'.repeat(32)}.png`, new Uint8Array(234))
    arquivos.set(`${AVENTURA}/midia/sub/escondido.wav`, new Uint8Array(5000))
    arquivos.set(`${AVENTURA}/sons.json`, '{}')
    expect(await tamanhoDaMidiaDaAventura(AVENTURA)).toBe(1234)
    expect([...(await arquivosDaMidiaDaAventura(AVENTURA)).entries()].sort()).toEqual([
      [ID, 1000],
      [`${'ef'.repeat(32)}.png`, 234],
    ])
  })
})

describe('pesoDaMidiaComSons', () => {
  const comSom = (biblioteca: BibliotecaDeSons, id: string, idDaMidia: string, bytes: number): BibliotecaDeSons => {
    const passo = comEfeitoNovo(biblioteca, { nome: id, fonte: { tipo: 'arquivo', ref: `midia:${idDaMidia}`, bytes } }, id)
    if (passo === null) throw new Error(`não montou ${id}`)
    return passo.biblioteca
  }

  it('a pasta mais o áudio que ainda não chegou nela; o que já está lá e o repetido contam uma vez', () => {
    const naPasta = `${'ab'.repeat(32)}.wav`
    const aCaminho = `${'cd'.repeat(32)}.wav`
    let biblioteca = comSom(bibliotecaDeSonsVazia(), 'som_a', naPasta, 1000)
    biblioteca = comSom(biblioteca, 'som_b', aCaminho, 5000)
    biblioteca = comSom(biblioteca, 'som_c', aCaminho, 5000)
    const pasta = new Map([
      [naPasta, 1000],
      [`${'ef'.repeat(32)}.png`, 234],
    ])
    expect(pesoDaMidiaComSons(pasta, biblioteca)).toBe(6234)
    expect(pesoDaMidiaComSons(new Map(), bibliotecaDeSonsVazia())).toBe(0)
  })
})
