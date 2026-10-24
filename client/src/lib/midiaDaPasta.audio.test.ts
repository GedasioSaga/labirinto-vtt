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

const { arquivos, bytesDe, criarPastasAte, fsFalso, limparDisco, links, MIDIA_DO_APP, png, wav } = await import('./sons/discoFalso.fixture')
const { useToastStore } = await import('../stores/toastStore')
const { hashHex, idDoAudio, idDosBytes, MIDIA_AUDIO_MAX_BYTES, tipoDoAudio } = await import('./midia')
const { AUDIO_NAO_FOI_PARA_A_PASTA, copiarMidiaParaAPasta, guardarAudioNaPasta, importarMidiaDaPasta, lerAudioDaPasta, trazerMidiaAoAbrir } = await import('./midiaDaPasta')
const { bibliotecaDeSonsVazia, comEfeitoNovo, serializarBiblioteca, SONS_JSON_MAX_BYTES } = await import('./sons/biblioteca')

const MB = 1024 * 1024
const PASTA = 'C:/aventura/midia'
const SONS = 'C:/aventura/sons.json'

/** O texto de um `sons.json` válido com um efeito para cada id de áudio. */
function sonsJsonQueCita(...ids: string[]): string {
  let biblioteca = bibliotecaDeSonsVazia()
  for (const [i, id] of ids.entries()) {
    const passo = comEfeitoNovo(biblioteca, { nome: `Som ${i}`, fonte: { tipo: 'arquivo', ref: `midia:${id}`, bytes: 64 } }, `som_${i}`)
    if (passo === null) throw new Error(`o teste não montou o efeito ${i}`)
    biblioteca = passo.biblioteca
  }
  return serializarBiblioteca(biblioteca)
}

/** Um áudio de verdade (hash conferido) já na pasta da aventura. */
async function naPasta(bytes: Uint8Array): Promise<string> {
  const id = await idDeAudio(bytes)
  criarPastasAte(PASTA)
  arquivos.set(`${PASTA}/${id}`, bytes)
  return id
}

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

  it('o alvo na pasta que é atalho não é escrito (poderia apontar para fora): o áudio conta como faltou', async () => {
    const id = await noApp(wav(64, 1))
    const vitima = 'C:/Windows/vitima.dll'
    criarPastasAte(vitima)
    arquivos.set(vitima, Uint8Array.from([1, 2, 3]))
    criarPastasAte(PASTA)
    links.set(`${PASTA}/${id}`, vitima)

    expect(await copiarMidiaParaAPasta(PASTA, [id])).toEqual({ copiados: [], faltaram: [id] })
    expect(bytesDe(vitima)).toEqual(Uint8Array.from([1, 2, 3]))
  })
})

describe('m4a: só a marca de áudio', () => {
  /** A primeira caixa de um MP4: tamanho, `ftyp` e a marca de 4 letras. */
  function ftyp(marca: string): Uint8Array {
    return Uint8Array.from([0, 0, 0, 0x20, ...new TextEncoder().encode(`ftyp${marca}`), 0, 0, 0, 0])
  }

  it('ftyp com M4A, M4B, mp42 ou isom é m4a; vídeo MP4, HEIC e AVIF não são áudio', () => {
    for (const marca of ['M4A ', 'M4B ', 'mp42', 'isom']) expect(tipoDoAudio(ftyp(marca)), marca).toBe('m4a')
    for (const marca of ['avc1', 'qt  ', 'M4V ', 'heic', 'mif1', 'avif', 'msf1', '    ']) expect(tipoDoAudio(ftyp(marca)), marca).toBeNull()
    expect(tipoDoAudio(Uint8Array.from([0, 0, 0, 0x20, ...new TextEncoder().encode('ftyp')]))).toBeNull()
  })

  it('o HEIC com nome de .m4a e o hash certo não entra pela pasta da aventura', async () => {
    const foto = ftyp('heic')
    const nomeFalso = `${await hashHex(foto)}.m4a`
    criarPastasAte(PASTA)
    arquivos.set(`${PASTA}/${nomeFalso}`, foto)
    expect(await importarMidiaDaPasta(PASTA)).toEqual({ importados: [], recusados: [nomeFalso], pastaIlegivel: false })
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

  it('áudio de exatamente 15 MB vai e volta: o teto entra', async () => {
    const noTeto = wav(MIDIA_AUDIO_MAX_BYTES, 4)
    const id = await noApp(noTeto)
    expect(await copiarMidiaParaAPasta(PASTA, [id])).toEqual({ copiados: [id], faltaram: [] })
    arquivos.delete(`${MIDIA_DO_APP}/${id}`)
    expect(await importarMidiaDaPasta(PASTA)).toEqual({ importados: [id], recusados: [], pastaIlegivel: false })
    expect(bytesDe(`${MIDIA_DO_APP}/${id}`).length).toBe(MIDIA_AUDIO_MAX_BYTES)
  })

  it('o aviso diz o que foi recusado: 1 imagem e 1 som juntos são "2 arquivos de mídia"; só imagens, "2 imagens"', async () => {
    async function imagemComHashDeOutra(marcaDoNome: number, marcaDoConteudo: number): Promise<void> {
      const id = await idDosBytes(png(marcaDoNome))
      if (id === null) throw new Error('o teste montou bytes que não são imagem')
      arquivos.set(`${PASTA}/${id}`, png(marcaDoConteudo))
    }
    criarPastasAte(PASTA)
    await imagemComHashDeOutra(1, 2)
    arquivos.set(`${PASTA}/${await idDeAudio(wav(16, 1))}`, wav(16, 9))
    await trazerMidiaAoAbrir('C:/aventura/map.json', 'C:/aventura')
    expect(useToastStore.getState().toasts.map((toast) => toast.text)).toEqual([expect.stringContaining('2 arquivos de mídia da pasta')])

    limparDisco()
    useToastStore.setState({ toasts: [] })
    criarPastasAte(PASTA)
    await imagemComHashDeOutra(1, 2)
    await imagemComHashDeOutra(4, 5)
    await trazerMidiaAoAbrir('C:/aventura/map.json', 'C:/aventura')
    expect(useToastStore.getState().toasts.map((toast) => toast.text)).toEqual([expect.stringContaining('2 imagens da pasta')])
  })
})

/*
 * FECHAMENTO (b) DA F5 (23/10/2026): `<appData>/midia` a sala serve em
 * `/media/{id}` sem chave, então o áudio que o `sons.json` cita fica na pasta
 * da aventura e só sai pela rota com chave (`/sons/{id}`, F5a). O resto da
 * pasta (imagem, áudio que a biblioteca não cita) volta como antes.
 */
describe('importarMidiaDaPasta: o áudio da biblioteca de sons fica na pasta', () => {
  it('o áudio que o sons.json cita NÃO vai para <appData>/midia; o que ele não cita e a imagem vão; nada sai da pasta', async () => {
    const daBiblioteca = await naPasta(wav(64, 1))
    const solto = await naPasta(wav(64, 2))
    const imagem = await idDosBytes(png(7))
    if (imagem === null) throw new Error('o teste montou bytes que não são imagem')
    arquivos.set(`${PASTA}/${imagem}`, png(7))
    arquivos.set(SONS, sonsJsonQueCita(daBiblioteca))

    const trazida = await trazerMidiaAoAbrir('C:/aventura/map.json', 'C:/aventura')

    expect(trazida).toEqual({ importados: [solto, imagem].sort(), recusados: [], pastaIlegivel: false })
    expect(arquivos.has(`${MIDIA_DO_APP}/${daBiblioteca}`)).toBe(false)
    expect(bytesDe(`${PASTA}/${daBiblioteca}`)).toEqual(wav(64, 1))
  })

  it('aventura sem sons.json: todo áudio volta como hoje', async () => {
    const id = await naPasta(wav(64, 3))
    expect(await importarMidiaDaPasta(PASTA)).toEqual({ importados: [id], recusados: [], pastaIlegivel: false })
    expect(bytesDe(`${MIDIA_DO_APP}/${id}`)).toEqual(wav(64, 3))
  })

  it('o efeito torto (que a leitura descartaria) também conta: o id citado fica', async () => {
    const id = await naPasta(wav(64, 4))
    arquivos.set(SONS, JSON.stringify({ versao: 1, pastas: [], efeitos: [{ id: '???', fonte: { tipo: 'arquivo', ref: `midia:${id}` } }] }))
    expect((await importarMidiaDaPasta(PASTA)).importados).toEqual([])
    expect(arquivos.has(`${MIDIA_DO_APP}/${id}`)).toBe(false)
  })

  it('na dúvida nenhum áudio vai, e a imagem vai: sons.json ilegível, de versão mais nova ou grande demais (este nem é lido)', async () => {
    const imagem = await idDosBytes(png(9))
    if (imagem === null) throw new Error('o teste montou bytes que não são imagem')
    const casos: Array<[string, string]> = [
      ['ilegível', '{ quebrado'],
      ['versão mais nova', JSON.stringify({ versao: 99, efeitos: [] })],
      ['grande demais', ' '.repeat(SONS_JSON_MAX_BYTES + 1)],
    ]
    for (const [caso, texto] of casos) {
      limparDisco()
      const id = await naPasta(wav(64, 5))
      arquivos.set(`${PASTA}/${imagem}`, png(9))
      arquivos.set(SONS, texto)
      expect((await importarMidiaDaPasta(PASTA)).importados, caso).toEqual([imagem])
      expect(arquivos.has(`${MIDIA_DO_APP}/${id}`), caso).toBe(false)
      expect(bytesDe(`${PASTA}/${id}`), caso).toEqual(wav(64, 5))
    }
    expect(fsFalso.readTextFile).not.toHaveBeenCalled()
  })

  it('o disco que recusa ler o sons.json conta como dúvida: o áudio fica', async () => {
    const id = await naPasta(wav(64, 6))
    arquivos.set(SONS, sonsJsonQueCita())
    fsFalso.readTextFile.mockRejectedValueOnce(new Error('os error 5'))
    expect((await importarMidiaDaPasta(PASTA)).importados).toEqual([])
    expect(arquivos.has(`${MIDIA_DO_APP}/${id}`)).toBe(false)
  })

  it('pasta só de imagens nem olha o sons.json', async () => {
    const imagem = await idDosBytes(png(3))
    if (imagem === null) throw new Error('o teste montou bytes que não são imagem')
    criarPastasAte(PASTA)
    arquivos.set(`${PASTA}/${imagem}`, png(3))
    arquivos.set(SONS, '{ quebrado')
    expect((await importarMidiaDaPasta(PASTA)).importados).toEqual([imagem])
    expect(fsFalso.exists).not.toHaveBeenCalled()
  })
})

describe('guardarAudioNaPasta e lerAudioDaPasta (o áudio direto na pasta da aventura)', () => {
  it('grava em <aventura>/midia e não em <appData>/midia; lê de volta conferido', async () => {
    const ref = await guardarAudioNaPasta(PASTA, wav(64, 1))
    const id = ref.slice('midia:'.length)
    expect(bytesDe(`${PASTA}/${id}`)).toEqual(wav(64, 1))
    expect(arquivos.has(`${MIDIA_DO_APP}/${id}`)).toBe(false)
    expect(await lerAudioDaPasta(PASTA, id)).toEqual(wav(64, 1))
  })

  it('o arquivo do MESMO tamanho com outro conteúdo (trocado ou corrompido) é regravado: o tamanho só não basta, o hash decide', async () => {
    const id = await idDeAudio(wav(64, 1))
    criarPastasAte(PASTA)
    arquivos.set(`${PASTA}/${id}`, wav(64, 2))
    expect(await guardarAudioNaPasta(PASTA, wav(64, 1))).toBe(`midia:${id}`)
    expect(bytesDe(`${PASTA}/${id}`)).toEqual(wav(64, 1))
    expect(await lerAudioDaPasta(PASTA, id)).toEqual(wav(64, 1))
    // A cópia que já confere não é regravada.
    fsFalso.writeFile.mockClear()
    await guardarAudioNaPasta(PASTA, wav(64, 1))
    expect(fsFalso.writeFile).not.toHaveBeenCalled()
  })

  it('o atalho com o nome do áudio não é escrito: lança a frase sem caminho, e o alvo do atalho fica intacto', async () => {
    const id = await idDeAudio(wav(64, 2))
    const vitima = 'C:/Windows/vitima.dll'
    criarPastasAte(vitima)
    arquivos.set(vitima, Uint8Array.from([1, 2, 3]))
    criarPastasAte(PASTA)
    links.set(`${PASTA}/${id}`, vitima)
    await expect(guardarAudioNaPasta(PASTA, wav(64, 2))).rejects.toThrow(AUDIO_NAO_FOI_PARA_A_PASTA)
    expect(bytesDe(vitima)).toEqual(Uint8Array.from([1, 2, 3]))
  })

  it('ler: o que não está lá, o de conteúdo trocado e o de mais de 15 MB (sem ler os bytes) dão null', async () => {
    const id = await idDeAudio(wav(64, 3))
    expect(await lerAudioDaPasta(PASTA, id)).toBeNull()
    criarPastasAte(PASTA)
    arquivos.set(`${PASTA}/${id}`, wav(64, 4))
    expect(await lerAudioDaPasta(PASTA, id)).toBeNull()
    const enorme = `${'c'.repeat(64)}.mp3`
    arquivos.set(`${PASTA}/${enorme}`, new Uint8Array(MIDIA_AUDIO_MAX_BYTES + 1))
    fsFalso.readFile.mockClear()
    expect(await lerAudioDaPasta(PASTA, enorme)).toBeNull()
    expect(fsFalso.readFile).not.toHaveBeenCalled()
  })
})
