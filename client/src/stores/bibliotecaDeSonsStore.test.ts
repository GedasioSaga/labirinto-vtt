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
const { ehVideoDoYoutube, bibliotecaDeSonsVazia, comEfeitoNovo, serializarBiblioteca } = await import('../lib/sons/biblioteca')
const { ESPERA_PARA_GRAVAR_SONS_MS, ligarBibliotecaAAventura, SONS_AINDA_LENDO, SONS_AVENTURA_TROCOU, SONS_NAO_GRAVAVEIS, SONS_SEM_AVENTURA, useBibliotecaDeSonsStore } =
  await import('./bibliotecaDeSonsStore')
type FonteDoSom = import('../lib/sons/biblioteca').FonteDoSom
type BibliotecaDeSons = import('../lib/sons/biblioteca').BibliotecaDeSons
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

/** Uma biblioteca com `n` efeitos chamados `<prefixo> 0`, `<prefixo> 1`... */
function bibliotecaCom(n: number, prefixo: string): BibliotecaDeSons {
  let biblioteca = bibliotecaDeSonsVazia()
  for (let i = 0; i < n; i++) {
    const passo = comEfeitoNovo(biblioteca, { nome: `${prefixo} ${i}`, fonte: youtube('dQw4w9WgXcQ') }, `som_${i}`)
    if (passo === null) throw new Error(`o teste não montou o efeito ${i}`)
    biblioteca = passo.biblioteca
  }
  return biblioteca
}

/** O texto de um sons.json com `n` efeitos chamados `<prefixo> 0`, `<prefixo> 1`... */
function sonsJsonCom(n: number, prefixo: string): string {
  return serializarBiblioteca(bibliotecaCom(n, prefixo))
}

const nomes = () => loja().biblioteca.efeitos.map((efeito) => efeito.nome)

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
    expect(loja().biblioteca.efeitos).toEqual([])
    expect(arquivos.has(`${outra}/sons.json`)).toBe(false)
  })
})

describe('troca de aventura e de pasta', () => {
  it('abrir a cópia B (3 sons, mesmo id) e depois a original A (10): o sons.json de A fica intacto e a biblioteca é a de A', async () => {
    const copia = 'C:/backup/navio'
    criarPastasAte(copia)
    const textoDeA = sonsJsonCom(10, 'A')
    arquivos.set(SONS, textoDeA)
    arquivos.set(`${copia}/sons.json`, sonsJsonCom(3, 'B'))

    await loja().sincronizarComAAventura('adv_mesmo', copia)
    expect(nomes()).toEqual(['B 0', 'B 1', 'B 2'])
    await loja().sincronizarComAAventura('adv_mesmo', AVENTURA)
    await vi.advanceTimersByTimeAsync(ESPERA_PARA_GRAVAR_SONS_MS * 3)

    expect(textoDe(SONS)).toBe(textoDeA)
    expect(nomes()).toHaveLength(10)
    expect(nomes()[9]).toBe('A 9')
    expect(loja()).toMatchObject({ dir: AVENTURA, carregando: false, pendente: false, podeGravar: true })
  })

  it('X → Y → X sem esperar: fica X, relida do disco, com a mudança que estava esperando', async () => {
    const outra = 'C:/aventuras/castelo'
    criarPastasAte(outra)
    await loja().sincronizarComAAventura('adv_x', AVENTURA)
    loja().adicionarEfeito({ nome: 'Gaivota', fonte: youtube('dQw4w9WgXcQ') })

    const indoParaY = loja().sincronizarComAAventura('adv_y', outra)
    const voltandoParaX = loja().sincronizarComAAventura('adv_x', AVENTURA)
    await Promise.all([indoParaY, voltandoParaX])

    expect(loja()).toMatchObject({ aventuraId: 'adv_x', dir: AVENTURA, carregando: false })
    expect(nomes()).toEqual(['Gaivota'])
  })

  it('trocando de aventura: mudança na anterior enquanto o disco grava é recusada, em vez de se perder', async () => {
    const outra = 'C:/aventuras/castelo'
    criarPastasAte(outra)
    await loja().sincronizarComAAventura('adv_1', AVENTURA)
    loja().adicionarEfeito({ nome: 'Gaivota', fonte: youtube('dQw4w9WgXcQ') })

    const trocando = loja().sincronizarComAAventura('adv_2', outra)
    expect(loja().adicionarEfeito({ nome: 'Perdido', fonte: youtube('a-b_C1234xY') })).toBeNull()
    await trocando

    expect(JSON.parse(textoDe(SONS)).efeitos.map((efeito: { nome: string }) => efeito.nome)).toEqual(['Gaivota'])
    expect(loja()).toMatchObject({ aventuraId: 'adv_2', biblioteca: bibliotecaDeSonsVazia(), pendente: false })
  })
})

describe('sem poder gravar: o sons.json existe e não foi lido', () => {
  /** Nada entra e o arquivo fica IGUAL, nem com a gravação forçada (pendente na mão + `gravarAgora`). */
  async function esperarArquivoIntacto(texto: string): Promise<void> {
    expect(loja().adicionarEfeito({ nome: 'Sino', fonte: youtube('dQw4w9WgXcQ') })).toBeNull()
    await expect(loja().importarArquivoDeSom('sino.wav', wav(64))).rejects.toThrow(SONS_NAO_GRAVAVEIS)
    useBibliotecaDeSonsStore.setState({ pendente: true, biblioteca: bibliotecaCom(1, 'Por cima') })
    await loja().gravarAgora()
    await vi.advanceTimersByTimeAsync(ESPERA_PARA_GRAVAR_SONS_MS * 3)
    expect(textoDe(SONS)).toBe(texto)
    expect(gravacoesDoSons(AVENTURA)).toBe(0)
    expect(fsFalso.writeFile).not.toHaveBeenCalled()
  }

  it('sons.json de uma versão mais nova do app', async () => {
    const texto = JSON.stringify({ versao: 2, pastas: [], efeitos: [{ id: 'som_do_futuro' }] })
    arquivos.set(SONS, texto)
    await loja().sincronizarComAAventura('adv_futuro', AVENTURA)
    expect(loja()).toMatchObject({ podeGravar: false, carregando: false })
    expect(loja().aviso).toContain('versão mais nova')
    await esperarArquivoIntacto(texto)
  })

  it('leitura com erro (o Windows negou o acesso): o aviso diz por quê', async () => {
    const texto = sonsJsonCom(2, 'Lá')
    arquivos.set(SONS, texto)
    fsFalso.readTextFile.mockRejectedValueOnce(new Error('os error 5'))
    await loja().sincronizarComAAventura('adv_negado', AVENTURA)
    expect(loja()).toMatchObject({ podeGravar: false, carregando: false, biblioteca: bibliotecaDeSonsVazia() })
    expect(loja().aviso).toContain('Windows negou')
    await esperarArquivoIntacto(texto)
  })
})

describe('lendo e gravando', () => {
  it('enquanto lê, recusa mudança (SONS_AINDA_LENDO); a leitura velha, de antes da troca, é descartada', async () => {
    const outra = 'C:/aventuras/castelo'
    criarPastasAte(outra)
    arquivos.set(SONS, sonsJsonCom(2, 'Velha'))
    arquivos.set(`${outra}/sons.json`, sonsJsonCom(1, 'Nova'))
    let soltar = (): void => {}
    const segura = new Promise<void>((resolve) => {
      soltar = resolve
    })
    fsFalso.readTextFile.mockImplementationOnce(async (caminho: string) => {
      await segura
      return textoDe(caminho)
    })

    const primeira = loja().sincronizarComAAventura('adv_velha', AVENTURA)
    await vi.waitFor(() => expect(fsFalso.readTextFile).toHaveBeenCalledTimes(1))
    expect(loja()).toMatchObject({ aventuraId: 'adv_velha', carregando: true })
    expect(loja().adicionarEfeito({ nome: 'Cedo', fonte: youtube('dQw4w9WgXcQ') })).toBeNull()
    await expect(loja().importarArquivoDeSom('cedo.wav', wav(64))).rejects.toThrow(SONS_AINDA_LENDO)

    const segunda = loja().sincronizarComAAventura('adv_nova', outra)
    soltar()
    await Promise.all([primeira, segunda])
    expect(loja()).toMatchObject({ aventuraId: 'adv_nova', dir: outra, carregando: false })
    expect(nomes()).toEqual(['Nova 0'])
  })

  it('a gravação falha: a mudança continua esperando, com o aviso; a próxima mudança grava', async () => {
    await loja().sincronizarComAAventura('adv_falha', AVENTURA)
    fsFalso.writeTextFile.mockRejectedValueOnce(new Error('os error 5'))
    const efeito = loja().adicionarEfeito({ nome: 'Sino', fonte: youtube('dQw4w9WgXcQ') })
    if (efeito === null) throw new Error('não adicionou')
    await vi.advanceTimersByTimeAsync(ESPERA_PARA_GRAVAR_SONS_MS)
    await vi.waitFor(() => expect(loja().aviso).toContain('Não foi possível gravar os sons'))
    expect(loja().pendente).toBe(true)
    expect(arquivos.has(SONS)).toBe(false)

    expect(loja().editarEfeito(efeito.id, { volume: 0.5 })).toBe(true)
    await vi.advanceTimersByTimeAsync(ESPERA_PARA_GRAVAR_SONS_MS)
    await vi.waitFor(() => expect(arquivos.has(SONS)).toBe(true))
    expect(loja()).toMatchObject({ pendente: false, aviso: null })
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
      expect(loja()).toMatchObject({ aviso: null, podeGravar: true, pendente: false })
      // Sem sons, e com as categorias sugeridas de cada parte, que só vão ao disco com a próxima mudança.
      expect(loja().biblioteca.efeitos).toEqual([])
      expect(loja().biblioteca.pastas.map((pasta) => `${pasta.parte ?? 'efeitos'}:${pasta.nome}`)).toEqual(['musicas:Ambiente', 'musicas:Batalha', 'musicas:Taverna', 'efeitos:Combate', 'efeitos:Magia', 'efeitos:Natureza'])
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
  it('wav de 14 MB: gravado direto em <aventura>/midia, nunca em <appData>/midia (que /media serve sem chave); reaberto, continua só na pasta', async () => {
    await loja().sincronizarComAAventura('adv_d', AVENTURA)
    const grande = wav(14 * MB, 5)
    const efeito = await loja().importarArquivoDeSom('C:\\sons\\Trovão.wav', grande)
    expect(efeito).toMatchObject({ nome: 'Trovão', fonte: { tipo: 'arquivo', bytes: 14 * MB }, volume: 0.8, loop: false })
    if (efeito.fonte.tipo !== 'arquivo') throw new Error('fonte errada')
    const id = efeito.fonte.ref.slice('midia:'.length)
    expect(id).toBe(`${await hashHex(grande)}.wav`)
    expect(bytesDe(`${AVENTURA}/midia/${id}`).length).toBe(14 * MB)
    expect(arquivos.has(`${MIDIA_DO_APP}/${id}`)).toBe(false)

    await loja().gravarAgora()
    expect(JSON.parse(textoDe(SONS)).efeitos[0].fonte.ref).toBe(`midia:${id}`)

    // Outro computador (ou o mesmo, reaberto): o som da biblioteca fica na pasta e só sai pela rota com chave.
    const trazida = await trazerMidiaAoAbrir(`${AVENTURA}/map.json`, AVENTURA)
    expect(trazida).toEqual({ importados: [], recusados: [], pastaIlegivel: false })
    expect(arquivos.has(`${MIDIA_DO_APP}/${id}`)).toBe(false)
    expect(`${await hashHex(bytesDe(`${AVENTURA}/midia/${id}`))}.wav`).toBe(id)
  })

  it('corrida: a abertura corre antes de a loja ler a aventura nova (a loja ainda está na anterior): quem decide é o sons.json do disco', async () => {
    const bytes = wav(64, 6)
    const id = `${await hashHex(bytes)}.wav`
    const passo = comEfeitoNovo(bibliotecaDeSonsVazia(), { nome: 'Sino', fonte: { tipo: 'arquivo', ref: `midia:${id}`, bytes: 64 } })
    if (passo === null) throw new Error('o teste não montou o efeito')
    criarPastasAte(`${AVENTURA}/midia`)
    arquivos.set(`${AVENTURA}/midia/${id}`, bytes)
    arquivos.set(SONS, serializarBiblioteca(passo.biblioteca))
    await loja().sincronizarComAAventura('adv_antes', 'C:/aventuras/antes')
    expect(loja().biblioteca.efeitos).toEqual([])

    expect((await trazerMidiaAoAbrir(`${AVENTURA}/map.json`, AVENTURA)).importados).toEqual([])
    expect(arquivos.has(`${MIDIA_DO_APP}/${id}`)).toBe(false)
    expect(bytesDe(`${AVENTURA}/midia/${id}`)).toEqual(bytes)
  })

  it('acima de 15 MB é recusado com AUDIO_GRANDE_DEMAIS; png renomeado para .mp3 com AUDIO_NAO_E_AUDIO; nada muda', async () => {
    await loja().sincronizarComAAventura('adv_d2', AVENTURA)
    const enorme = new Uint8Array(MIDIA_AUDIO_MAX_BYTES + 1)
    enorme.set([0x49, 0x44, 0x33])
    await expect(loja().importarArquivoDeSom('enorme.mp3', enorme)).rejects.toThrow(AUDIO_GRANDE_DEMAIS)
    await expect(loja().importarArquivoDeSom('foto.mp3', png(1))).rejects.toThrow(AUDIO_NAO_E_AUDIO)
    expect(loja().biblioteca.efeitos).toEqual([])
    expect(loja().pendente).toBe(false)
    expect(fsFalso.writeFile).not.toHaveBeenCalled()
  })

  it('a aventura troca para B enquanto o áudio grava: o efeito NÃO entra na biblioteca de B e o erro avisa', async () => {
    const outra = 'C:/aventuras/castelo'
    criarPastasAte(outra)
    await loja().sincronizarComAAventura('adv_a', AVENTURA)
    const gravarDeVerdade = fsFalso.writeFile.getMockImplementation()
    if (gravarDeVerdade === undefined) throw new Error('o disco falso perdeu o writeFile')
    // O disco segura o áudio até a troca para B terminar inteira (B lida, pronta para mudar).
    let soltarODisco = (): void => undefined
    const discoSegurado = new Promise<void>((soltar) => {
      soltarODisco = soltar
    })
    fsFalso.writeFile.mockImplementationOnce(async (...argumentos) => {
      await discoSegurado
      return gravarDeVerdade(...argumentos)
    })

    const importando = loja().importarArquivoDeSom('sino.wav', wav(64))
    const recusado = expect(importando).rejects.toThrow(SONS_AVENTURA_TROCOU)
    await vi.waitFor(() => expect(fsFalso.writeFile).toHaveBeenCalled())
    await loja().sincronizarComAAventura('adv_b', outra)
    expect(loja()).toMatchObject({ aventuraId: 'adv_b', dir: outra, carregando: false, podeGravar: true })
    soltarODisco()
    await recusado

    expect(loja().biblioteca.efeitos).toEqual([])
    expect(loja().pendente).toBe(false)
    await vi.advanceTimersByTimeAsync(ESPERA_PARA_GRAVAR_SONS_MS * 3)
    expect(arquivos.has(`${outra}/sons.json`)).toBe(false)
  })

  it('a aventura NOVA ganha a primeira pasta enquanto o áudio grava: é a mesma aventura, o efeito entra e vai para a pasta', async () => {
    await loja().sincronizarComAAventura('adv_nova', null)
    const gravarDeVerdade = fsFalso.writeFile.getMockImplementation()
    if (gravarDeVerdade === undefined) throw new Error('o disco falso perdeu o writeFile')
    let soltarODisco = (): void => undefined
    const discoSegurado = new Promise<void>((soltar) => {
      soltarODisco = soltar
    })
    fsFalso.writeFile.mockImplementationOnce(async (...argumentos) => {
      await discoSegurado
      return gravarDeVerdade(...argumentos)
    })

    const importando = loja().importarArquivoDeSom('Sino.wav', wav(64))
    await vi.waitFor(() => expect(fsFalso.writeFile).toHaveBeenCalled())
    await loja().sincronizarComAAventura('adv_nova', AVENTURA)
    soltarODisco()
    const efeito = await importando

    expect(nomes()).toEqual(['Sino'])
    await vi.advanceTimersByTimeAsync(ESPERA_PARA_GRAVAR_SONS_MS)
    await vi.waitFor(() => expect(arquivos.has(SONS)).toBe(true))
    expect(JSON.parse(textoDe(SONS)).efeitos[0]).toMatchObject({ id: efeito.id, nome: 'Sino' })
    // Sem pasta na hora de importar, o áudio esperou em <appData>/midia; a primeira gravação o levou para a pasta.
    if (efeito.fonte.tipo !== 'arquivo') throw new Error('fonte errada')
    expect(bytesDe(`${AVENTURA}/midia/${efeito.fonte.ref.slice('midia:'.length)}`)).toEqual(wav(64))
  })
})
