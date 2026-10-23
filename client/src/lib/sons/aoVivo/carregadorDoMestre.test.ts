import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-fs', async () => (await import('../discoFalso.fixture')).fsFalso)
vi.mock('@tauri-apps/api/path', async () => (await import('../discoFalso.fixture')).pathFalso)

const { arquivos, criarPastasAte, limparDisco, MIDIA_DO_APP, wav } = await import('../discoFalso.fixture')
const { arquivosDaMidiaDaAventura, carregarBytesDoMestre, pesoDaMidiaComSons, tamanhoDaMidiaDaAventura } = await import('./carregadorDoMestre')
const { AUDIO_GUARDADO_SUMIU } = await import('../../midiaNoDisco')
const { bibliotecaDeSonsVazia, comEfeitoNovo } = await import('../biblioteca')
type BibliotecaDeSons = import('../biblioteca').BibliotecaDeSons

/*
 * O LADO DO MESTRE dos sons ao vivo: os bytes que o motor toca vêm de
 * `<appData>/midia/<id>`, e a página mostra quanto pesa `<aventura>/midia/`.
 */

const ID = `${'ab'.repeat(32)}.wav`
const AVENTURA = 'C:/aventuras/navio'

beforeEach(() => {
  limparDisco()
})

describe('carregarBytesDoMestre', () => {
  it('lê o áudio guardado pelo id; o que sumiu da pasta lança com a frase pronta; id que não é áudio também lança', async () => {
    criarPastasAte(MIDIA_DO_APP)
    arquivos.set(`${MIDIA_DO_APP}/${ID}`, wav(64, 3))
    expect(await carregarBytesDoMestre(ID)).toEqual(wav(64, 3))
    await expect(carregarBytesDoMestre(`${'cd'.repeat(32)}.wav`)).rejects.toThrow(AUDIO_GUARDADO_SUMIU)
    await expect(carregarBytesDoMestre('nao-e-audio.png')).rejects.toThrow('isso não é um áudio guardado')
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
