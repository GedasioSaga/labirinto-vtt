import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MotorAoVivo } from '../../lib/sons/aoVivo/motor'

/*
 * A PÁGINA SONS (Sistema 4, fatia F3, só local) com a biblioteca, o disco e o
 * motor de verdade sobre o Web Audio e o disco de mentira: o clique toca na
 * hora e a barra anda; as teclas 1 a 9 valem com a página fechada e não valem
 * em campo de texto, com modificador nem com diálogo modal; Parar tudo para
 * os loops com o fade; importar recusa o que não serve; o lápis edita e grava
 * sozinho; sem aventura nada é guardado; 200 nomes difíceis não quebram nada.
 */

vi.mock('@tauri-apps/plugin-fs', async () => (await import('../../lib/sons/discoFalso.fixture')).fsFalso)
vi.mock('@tauri-apps/api/path', async () => (await import('../../lib/sons/discoFalso.fixture')).pathFalso)

/** O motor da vez: a página pede `obterMotorDoMestre()` e recebe o do áudio de mentira. */
const daVez = vi.hoisted(() => ({ motor: null as MotorAoVivo | null }))
vi.mock('../../lib/sons/aoVivo/carregadorDoMestre', async (original) => {
  const real = await original<typeof import('../../lib/sons/aoVivo/carregadorDoMestre')>()
  return {
    ...real,
    obterMotorDoMestre: () => {
      if (daVez.motor === null) throw new Error('o teste não montou o motor')
      return daVez.motor
    },
  }
})

const { arquivos, fsFalso, limparDisco, png, wav } = await import('../../lib/sons/discoFalso.fixture')
const { criarAudioFalso, criarElementoDeAudioFalso, BYTES_POR_SEGUNDO_FALSO } = await import('../../lib/sons/audioFalso.fixture')
type NoFalso = import('../../lib/sons/audioFalso.fixture').NoFalso
type FonteFalsa = import('../../lib/sons/audioFalso.fixture').FonteFalsa
const { criarMotorDeSom } = await import('../../lib/sons/contexto')
const { criarMotorAoVivo, FADE_AO_PARAR_MS, MAX_LOOPS } = await import('../../lib/sons/aoVivo/motor')
const { carregarBytesDoMestre } = await import('../../lib/sons/aoVivo/carregadorDoMestre')
const { MIDIA_AUDIO_MAX_BYTES } = await import('../../lib/midia')
const { AUDIO_GRANDE_DEMAIS, AUDIO_NAO_E_AUDIO } = await import('../../lib/midiaNoDisco')
const { bibliotecaDeSonsVazia, comEfeitoMudado, comEfeitoNovo, EFEITOS_DE_SOM_MAX } = await import('../../lib/sons/biblioteca')
type BibliotecaDeSons = import('../../lib/sons/biblioteca').BibliotecaDeSons
const { useAdventureStore, hasUnsavedWork } = await import('../../stores/adventureStore')
const { SONS_AINDA_LENDO, SONS_NAO_GRAVAVEIS, SONS_SEM_AVENTURA, useBibliotecaDeSonsStore } = await import('../../stores/bibliotecaDeSonsStore')
const { useToastStore } = await import('../../stores/toastStore')
const { useLivroDaMesaStore } = await import('../../stores/livroDaMesaStore')
const { NO_CHAT_UNREAD } = await import('../MasterChatPanel')
const { LivroDaMesa } = await import('./LivroDaMesa')
const { PaginaSons } = await import('./PaginaSons')
const { Dialogo } = await import('../grimorio/Dialogo')

const MB = 1024 * 1024
const AVENTURA = 'C:/aventuras/navio'
/** 2 s no áudio de mentira (16 KB por segundo). */
const DOIS_SEGUNDOS = 2 * BYTES_POR_SEGUNDO_FALSO

let container: HTMLDivElement
let root: Root
let audio: ReturnType<typeof criarAudioFalso>

function montarMotor(): void {
  audio = criarAudioFalso({ estado: 'running' })
  const contexto = criarMotorDeSom(() => audio.ctx)
  const alvo = new EventTarget()
  contexto.destravarNoPrimeiroGesto(alvo)
  alvo.dispatchEvent(new Event('pointerup'))
  daVez.motor = criarMotorAoVivo<NoFalso>({
    // O carregador de verdade do mestre: lê `<appData>/midia/<id>` do disco (de mentira).
    carregarBytes: carregarBytesDoMestre,
    obterSaida: () => {
      const aoVivo = contexto.obterEntradaAoVivo()
      return aoVivo === null ? null : { ctx: audio.ctx, aoVivo }
    },
    aoDestravar: (ouvinte) => contexto.quandoRodar(ouvinte),
    lerPreferencia: () => ({ volume: 1, mudo: false }),
    assinarPreferencia: () => () => undefined,
    criarElementoDeAudio: () => criarElementoDeAudioFalso(),
    criarUrlDoAudio: () => 'blob:som',
    revogarUrl: () => undefined,
    agora: () => performance.now(),
    orcamentoDoCacheBytes: 150 * MB,
  })
}

/** As fontes que o motor tocou (a amostra muda do destravamento não ouve `ended`). */
const tocadas = (): FonteFalsa[] => audio.fontes.filter((fonte) => fonte.addEventListener.mock.calls.length > 0 && fonte.start.mock.calls.length > 0)

/** Deixa a corrente de promessas e o React assentarem até `conferir` passar. */
async function esperar(conferir: () => void, prazoMs = 3000): Promise<void> {
  const fim = Date.now() + prazoMs
  for (;;) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
    try {
      conferir()
      return
    } catch (erro) {
      if (Date.now() > fim) throw erro
    }
  }
}

async function abrirAventura(dir: string | null = AVENTURA): Promise<void> {
  if (dir !== null) fsFalso.mkdir(dir)
  useAdventureStore.setState({ adventure: { version: 1, id: 'adv_navio', name: 'Navio', startSceneId: 'scene_1', scenes: [{ id: 'scene_1', name: 'Convés', file: 'map.json' }] }, dir })
  await esperar(() => expect(useBibliotecaDeSonsStore.getState()).toMatchObject({ aventuraId: 'adv_navio', carregando: false }))
}

async function montarPagina(): Promise<void> {
  await act(async () => root.render(<PaginaSons medirMidia={async () => new Map([['mapa.png', 3.4 * MB]])} />))
}

const botao = (nome: string | RegExp): HTMLButtonElement => {
  const achado = [...document.body.querySelectorAll<HTMLButtonElement>('button')].find((b) => (typeof nome === 'string' ? b.getAttribute('aria-label') === nome || b.textContent?.trim() === nome : nome.test(b.getAttribute('aria-label') ?? b.textContent ?? '')))
  if (achado === undefined) throw new Error(`sem o botão ${String(nome)}`)
  return achado
}
const naTela = (): string => document.body.textContent ?? ''

function escolher(...escolhidos: File[]): void {
  const campo = container.querySelector<HTMLInputElement>('input[type="file"][aria-label="Arquivo de som"]')
  if (campo === null) throw new Error('sem o campo de arquivo')
  Object.defineProperty(campo, 'files', { configurable: true, value: escolhidos })
  act(() => {
    campo.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

const arquivoWav = (nome: string, bytes = DOIS_SEGUNDOS, marca = 1) => new File([new Uint8Array(wav(bytes, marca))], nome, { type: 'audio/wav' })

/** Importa pela página e espera o botão do som aparecer. */
async function importar(nome: string, marca = 1): Promise<string> {
  escolher(arquivoWav(nome, DOIS_SEGUNDOS, marca))
  const semExtensao = nome.replace(/\.[^.]*$/, '')
  await esperar(() => expect(useBibliotecaDeSonsStore.getState().biblioteca.efeitos.some((efeito) => efeito.nome === semExtensao)).toBe(true))
  const efeito = useBibliotecaDeSonsStore.getState().biblioteca.efeitos.find((candidato) => candidato.nome === semExtensao)
  if (efeito === undefined) throw new Error('o som não entrou')
  return efeito.id
}

function teclar(alvo: EventTarget, key: string, extras: KeyboardEventInit = {}): void {
  act(() => {
    alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extras }))
  })
}

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  limparDisco()
  montarMotor()
  useAdventureStore.setState({ adventure: null, dir: null })
  useToastStore.setState({ toasts: [] })
  useLivroDaMesaStore.setState({ pagina: 'sons', trocaAnimada: false })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  act(() => root.unmount())
  container.remove()
  daVez.motor?.desmontar()
  await useBibliotecaDeSonsStore.getState().gravarAgora()
  vi.restoreAllMocks()
})

describe('tocar', () => {
  it('clicar num botão toca na hora (o AudioContext falso registra o start) e mostra a barra de progresso', async () => {
    await montarPagina()
    await abrirAventura()
    const id = await importar('porta rangendo.wav')
    expect(tocadas()).toHaveLength(0)
    act(() => botao('porta rangendo').click())
    await esperar(() => expect(tocadas()).toHaveLength(1))
    expect(container.querySelector('.lb-efeito--tocando')).not.toBeNull()
    const barra = container.querySelector<HTMLElement>('.lb-efeito__barra')
    expect(barra?.style.animationDuration).toBe('2s')
    expect(naTela()).toContain('1 tocando')
    // O fim natural tira a barra e o estado de tocando.
    act(() => tocadas()[0]?.terminar())
    await esperar(() => expect(container.querySelector('.lb-efeito__barra')).toBeNull())
    expect(id).toMatch(/./)
  })

  it('a tecla 3 toca o som do atalho 3 com a página Sons FECHADA; em campo de texto, com modificador ou com diálogo modal, não', async () => {
    useLivroDaMesaStore.setState({ pagina: 'cenas' })
    await act(async () =>
      root.render(
        <>
          <input aria-label="Nome do mapa" />
          <LivroDaMesa aberto onAbertoChange={() => undefined} cenas={<p>cenas</p>} pedidos={0} naoLidas={NO_CHAT_UNREAD} />
        </>,
      ),
    )
    await abrirAventura()
    const id = await importar('trovao.wav')
    act(() => {
      expect(useBibliotecaDeSonsStore.getState().editarEfeito(id, { atalho: 3 })).toBe(true)
    })
    expect(container.querySelector<HTMLElement>('[data-pagina="sons"]')?.hidden).toBe(true)

    teclar(container.querySelector('input[aria-label="Nome do mapa"]') ?? document.body, '3')
    teclar(document.body, '3', { ctrlKey: true })
    teclar(document.body, '3', { altKey: true })
    teclar(document.body, '3', { shiftKey: true })
    teclar(document.body, '4')
    await esperar(() => undefined)
    expect(tocadas()).toHaveLength(0)

    teclar(document.body, '3')
    await esperar(() => expect(tocadas()).toHaveLength(1))

    // Com um diálogo modal aberto a tecla é dele.
    act(() => tocadas()[0]?.terminar())
    await act(async () =>
      root.render(
        <>
          <Dialogo aberto titulo="Outra janela" onFechar={() => undefined}>
            <p>conteúdo</p>
          </Dialogo>
          <LivroDaMesa aberto onAbertoChange={() => undefined} cenas={<p>cenas</p>} pedidos={0} naoLidas={NO_CHAT_UNREAD} />
        </>,
      ),
    )
    teclar(document.body, '3')
    await esperar(() => undefined)
    expect(tocadas()).toHaveLength(1)
  })

  it('Parar tudo para todos os loops com o fade de 150 ms', async () => {
    await montarPagina()
    await abrirAventura()
    const chuva = await importar('chuva.wav', 1)
    const vento = await importar('vento.wav', 2)
    act(() => {
      useBibliotecaDeSonsStore.getState().editarEfeito(chuva, { loop: true })
      useBibliotecaDeSonsStore.getState().editarEfeito(vento, { loop: true })
    })
    expect(botao('Parar tudo').disabled).toBe(true)
    act(() => botao(/^chuva/).click())
    act(() => botao(/^vento/).click())
    await esperar(() => expect(tocadas()).toHaveLength(2))
    expect(tocadas().every((fonte) => fonte.loop)).toBe(true)
    expect(naTela()).toContain('2 tocando')
    act(() => botao('Parar tudo').click())
    for (const fonte of tocadas()) expect(fonte.stop).toHaveBeenCalledWith(audio.ctx.currentTime + FADE_AO_PARAR_MS / 1000)
    await esperar(() => expect(naTela()).toContain('Nada tocando'))
    expect(botao('Parar tudo').disabled).toBe(true)
  })

  it(`o loop acima do limite (${MAX_LOOPS}) vira um aviso só, com chave, sem pilha de avisos`, async () => {
    await montarPagina()
    await abrirAventura()
    const ids: string[] = []
    for (const [indice, nome] of ['a.wav', 'b.wav', 'c.wav', 'd.wav'].entries()) ids.push(await importar(nome, indice + 1))
    act(() => {
      for (const id of ids) useBibliotecaDeSonsStore.getState().editarEfeito(id, { loop: true })
    })
    // Só as recusas de toque contam aqui (o aviso de "entrou na biblioteca" é da importação).
    act(() => useToastStore.setState({ toasts: [] }))
    for (const nome of ['a', 'b', 'c']) act(() => botao(new RegExp(`^${nome},`)).click())
    await esperar(() => expect(tocadas()).toHaveLength(3))
    act(() => botao(/^d,/).click())
    act(() => botao(/^d,/).click())
    await esperar(() => expect(useToastStore.getState().toasts).toHaveLength(1))
    expect(useToastStore.getState().toasts[0]?.text).toBe(`d não tocou: já há ${MAX_LOOPS} sons repetindo. Pare um deles antes.`)
  })
})

describe('o que ninguém via (revisão da F3)', () => {
  it('clicar num loop que já toca PARA o loop, com o fade de 150 ms (o efeito curto recomeçaria)', async () => {
    await montarPagina()
    await abrirAventura()
    const chuva = await importar('chuva.wav')
    act(() => {
      useBibliotecaDeSonsStore.getState().editarEfeito(chuva, { loop: true })
    })
    act(() => botao(/^chuva,/).click())
    await esperar(() => expect(tocadas()).toHaveLength(1))
    act(() => botao(/^chuva,/).click())
    expect(tocadas()).toHaveLength(1)
    expect(tocadas()[0]?.stop).toHaveBeenCalledWith(audio.ctx.currentTime + FADE_AO_PARAR_MS / 1000)
    await esperar(() => expect(naTela()).toContain('Nada tocando'))
  })

  it('o loop tocando mostra o que o clique faz: "parar" no lugar de "repete"', async () => {
    await montarPagina()
    await abrirAventura()
    const chuva = await importar('chuva.wav')
    act(() => {
      useBibliotecaDeSonsStore.getState().editarEfeito(chuva, { loop: true })
    })
    const legenda = () => container.querySelector('.lb-efeito__loop')
    expect(legenda()?.textContent).toBe('repete')
    act(() => botao(/^chuva,/).click())
    await esperar(() => expect(legenda()?.textContent).toBe('parar'))
    expect(legenda()?.classList.contains('lb-efeito__loop--parar')).toBe(true)
  })

  it('apagar um som que está tocando para o som', async () => {
    await montarPagina()
    await abrirAventura()
    const chuva = await importar('chuva.wav')
    act(() => {
      useBibliotecaDeSonsStore.getState().editarEfeito(chuva, { loop: true })
    })
    act(() => botao(/^chuva,/).click())
    await esperar(() => expect(tocadas()).toHaveLength(1))
    act(() => botao('Editar chuva').click())
    act(() => botao('Apagar som…').click())
    act(() => botao('Apagar').click())
    expect(useBibliotecaDeSonsStore.getState().biblioteca.efeitos).toHaveLength(0)
    expect(tocadas()[0]?.stop).toHaveBeenCalledWith(audio.ctx.currentTime + FADE_AO_PARAR_MS / 1000)
  })

  it('a tecla segurada (repeat) não toca de novo; com o foco no canvas do mapa a tecla toca', async () => {
    await act(async () =>
      root.render(
        <>
          <canvas aria-label="Mapa" tabIndex={0} />
          <PaginaSons medirMidia={async () => new Map()} />
        </>,
      ),
    )
    await abrirAventura()
    const sino = await importar('sino.wav')
    act(() => {
      useBibliotecaDeSonsStore.getState().editarEfeito(sino, { atalho: 2 })
    })
    const canvas = container.querySelector<HTMLCanvasElement>('canvas')
    if (canvas === null) throw new Error('sem o canvas')
    canvas.focus()
    teclar(canvas, '2', { repeat: true })
    await esperar(() => undefined)
    expect(tocadas()).toHaveLength(0)
    teclar(canvas, '2')
    await esperar(() => expect(tocadas()).toHaveLength(1))
  })

  it('no teclado AZERTY a fileira de números sem Shift (key ", code Digit3) toca o atalho 3', async () => {
    await montarPagina()
    await abrirAventura()
    const trovao = await importar('trovao.wav')
    act(() => {
      useBibliotecaDeSonsStore.getState().editarEfeito(trovao, { atalho: 3 })
    })
    teclar(document.body, '"', { code: 'Digit3' })
    await esperar(() => expect(tocadas()).toHaveLength(1))
  })

  it('editar o efeito NÃO entra no histórico do mapa: o Ctrl+Z (undo) não desfaz a mudança do som', async () => {
    const { useMapStore } = await import('../../stores/mapStore')
    await montarPagina()
    await abrirAventura()
    const porta = await importar('porta.wav')
    const passado = useMapStore.getState().past.length
    act(() => botao('Editar porta').click())
    const interruptor = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] [role="switch"]')].find((b) => b.textContent?.startsWith('Repetir até parar'))
    act(() => interruptor?.click())
    expect(useBibliotecaDeSonsStore.getState().biblioteca.efeitos.find((efeito) => efeito.id === porta)?.loop).toBe(true)
    expect(useMapStore.getState().past).toHaveLength(passado)
    act(() => useMapStore.getState().undo())
    expect(useBibliotecaDeSonsStore.getState().biblioteca.efeitos.find((efeito) => efeito.id === porta)?.loop).toBe(true)
  })
})

describe('a página sai ou a aventura troca', () => {
  /** Importa um som, faz dele loop e toca pelo clique; devolve a fonte que soa. */
  async function tocarLoop(nome: string): Promise<FonteFalsa> {
    const id = await importar(`${nome}.wav`)
    act(() => {
      useBibliotecaDeSonsStore.getState().editarEfeito(id, { loop: true })
    })
    act(() => botao(new RegExp(`^${nome},`)).click())
    await esperar(() => expect(tocadas()).toHaveLength(1))
    const fonte = tocadas()[0]
    if (fonte === undefined) throw new Error('o loop não tocou')
    expect(fonte.stop).not.toHaveBeenCalled()
    return fonte
  }

  it('desmontar a página (o editor sai ao voltar ao menu) para o loop com o fade; remontada, nada aparece tocando e nada soa', async () => {
    await montarPagina()
    await abrirAventura()
    const fonte = await tocarLoop('chuva')
    act(() => root.unmount())
    expect(fonte.stop).toHaveBeenCalledWith(audio.ctx.currentTime + FADE_AO_PARAR_MS / 1000)
    root = createRoot(container)
    await montarPagina()
    await esperar(() => expect(naTela()).toContain('Nada tocando'))
    expect(botao('Parar tudo').disabled).toBe(true)
    expect(botao(/^chuva,/).getAttribute('aria-pressed')).toBe('false')
    expect(tocadas().every((tocada) => tocada.stop.mock.calls.length > 0)).toBe(true)
  })

  it('trocar de aventura com um som tocando para o som; a outra abre sem nada tocando', async () => {
    await montarPagina()
    await abrirAventura()
    const fonte = await tocarLoop('chuva')
    fsFalso.mkdir('C:/aventuras/castelo')
    act(() => useAdventureStore.setState({ adventure: { version: 1, id: 'adv_castelo', name: 'Castelo', startSceneId: 'scene_1', scenes: [{ id: 'scene_1', name: 'Pátio', file: 'map.json' }] }, dir: 'C:/aventuras/castelo' }))
    expect(fonte.stop).toHaveBeenCalledWith(audio.ctx.currentTime + FADE_AO_PARAR_MS / 1000)
    await esperar(() => expect(useBibliotecaDeSonsStore.getState()).toMatchObject({ aventuraId: 'adv_castelo', carregando: false }))
    await esperar(() => expect(naTela()).toContain('Nada tocando'))
  })

  it('a aventura nova que ganha a primeira pasta (Salvar) NÃO é troca: o loop segue', async () => {
    await montarPagina()
    await abrirAventura(null)
    const fonte = await tocarLoop('vento')
    fsFalso.mkdir(AVENTURA)
    act(() => useAdventureStore.setState({ dir: AVENTURA }))
    await esperar(() => expect(useBibliotecaDeSonsStore.getState().dir).toBe(AVENTURA))
    expect(fonte.stop).not.toHaveBeenCalled()
    expect(naTela()).toContain('1 tocando')
  })
})

describe('importar', () => {
  it('o wav entra com o nome do arquivo; 15 MB + 1 e o png renomeado para .mp3 são recusados com texto claro', async () => {
    await montarPagina()
    await abrirAventura()
    await importar('Sino da igreja.wav')
    expect(botao('Sino da igreja')).toBeDefined()

    escolher(new File([new Uint8Array(MIDIA_AUDIO_MAX_BYTES + 1)], 'trovao enorme.wav', { type: 'audio/wav' }))
    await esperar(() => expect(container.querySelector('[role="alert"]')?.textContent).toBe(`Não deu para importar trovao enorme.wav: ${AUDIO_GRANDE_DEMAIS}.`))

    escolher(new File([new Uint8Array(png(7))], 'falso.mp3', { type: 'audio/mpeg' }))
    await esperar(() => expect(container.querySelector('[role="alert"]')?.textContent).toBe(`Não deu para importar falso.mp3: ${AUDIO_NAO_E_AUDIO}.`))
    expect(useBibliotecaDeSonsStore.getState().biblioteca.efeitos.map((efeito) => efeito.nome)).toEqual(['Sino da igreja'])
  })
})

describe('o lápis', () => {
  it('nome, volume, repetir, atalho, pasta e favorito gravam sozinhos no sons.json, fora do Ctrl+Z; o atalho dado tira do outro e diz isso', async () => {
    await montarPagina()
    await abrirAventura()
    const trovao = await importar('trovao.wav', 1)
    const porta = await importar('porta.wav', 2)
    act(() => {
      useBibliotecaDeSonsStore.getState().editarEfeito(trovao, { atalho: 3 })
    })

    act(() => botao('Editar porta').click())
    const janela = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]')
    if (janela === null) throw new Error('o lápis não abriu')
    const nome = janela.querySelector<HTMLInputElement>('input[type="text"]')
    if (nome === null) throw new Error('sem o campo do nome')
    act(() => {
      const definir = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      definir?.call(nome, 'Porta da cripta 🚪')
      nome.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const faixa = janela.querySelector<HTMLInputElement>('input[type="range"]')
    act(() => {
      const definir = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      definir?.call(faixa, '35')
      faixa?.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const interruptor = (rotulo: string) => [...janela.querySelectorAll<HTMLButtonElement>('[role="switch"]')].find((b) => b.textContent?.startsWith(rotulo))
    act(() => interruptor('Repetir até parar')?.click())
    act(() => interruptor('Favorito')?.click())
    const selecionar = (rotulo: string, valor: string) => {
      const lista = [...janela.querySelectorAll<HTMLSelectElement>('select')].find((s) => s.labels?.[0]?.textContent === rotulo)
      if (lista === undefined) throw new Error(`sem a lista ${rotulo}`)
      act(() => {
        lista.value = valor
        lista.dispatchEvent(new Event('change', { bubbles: true }))
      })
    }
    selecionar('Tecla de atalho', '3')
    expect(janela.textContent).toContain('A tecla 3 era de trovao. Agora é deste som, e trovao ficou sem tecla.')
    selecionar('Pasta', 'nova')
    const campoDaPasta = janela.querySelector<HTMLInputElement>('input[aria-label="Nome da nova pasta"]')
    act(() => {
      const definir = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      definir?.call(campoDaPasta, 'Cripta')
      campoDaPasta?.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => [...janela.querySelectorAll('button')].find((b) => b.textContent === 'Criar pasta')?.click())

    const efeitos = () => useBibliotecaDeSonsStore.getState().biblioteca.efeitos
    const editado = efeitos().find((efeito) => efeito.id === porta)
    const pasta = useBibliotecaDeSonsStore.getState().biblioteca.pastas[0]
    expect(editado).toMatchObject({ nome: 'Porta da cripta 🚪', volume: 0.35, loop: true, favorito: true, atalho: 3, pastaId: pasta?.id })
    expect(pasta?.nome).toBe('Cripta')
    expect(efeitos().find((efeito) => efeito.id === trovao)?.atalho).toBeUndefined()
    // Configuração: nunca deixa o mapa "não salvo".
    expect(hasUnsavedWork()).toBe(false)
    await esperar(() => {
      const gravado = arquivos.get(`${AVENTURA}/sons.json`)
      expect(typeof gravado).toBe('string')
      const lido = JSON.parse(String(gravado)) as BibliotecaDeSons
      expect(lido.efeitos.find((efeito) => efeito.id === porta)).toMatchObject({ nome: 'Porta da cripta 🚪', volume: 0.35, loop: true, favorito: true, atalho: 3 })
      expect(lido.efeitos.find((efeito) => efeito.id === trovao)?.atalho).toBeUndefined()
    })
  })

  it('apagar pede confirmação, com o foco em Cancelar; confirmado, o botão sai', async () => {
    await montarPagina()
    await abrirAventura()
    await importar('grito.wav')
    act(() => botao('Editar grito').click())
    act(() => botao('Apagar som…').click())
    expect(document.activeElement?.textContent).toBe('Cancelar')
    expect(useBibliotecaDeSonsStore.getState().biblioteca.efeitos).toHaveLength(1)
    act(() => botao('Apagar').click())
    expect(useBibliotecaDeSonsStore.getState().biblioteca.efeitos).toHaveLength(0)
    expect(naTela()).toContain('Nenhum som ainda')
  })
})

describe('o topo (revisão de design da F3)', () => {
  const topo = (): string => container.querySelector('.lb-sons__topo')?.textContent ?? ''

  it('um botão só para importar, "Importar sons"; o sucesso vira aviso passageiro e não cresce o topo', async () => {
    await montarPagina()
    await abrirAventura()
    expect(() => botao('Importar')).toThrow()
    expect(() => botao('Importar arquivo')).toThrow()
    expect(botao('Importar sons').disabled).toBe(false)
    await importar('porta.wav')
    await esperar(() => expect(useToastStore.getState().toasts.map((aviso) => aviso.text)).toContain('porta entrou na biblioteca.'))
    expect(topo()).not.toContain('entrou na biblioteca')
  })

  it('as recusas saem do topo fixo: no máximo 3 linhas, "e mais N" e Fechar', async () => {
    await montarPagina()
    await abrirAventura()
    const grande = (nome: string) => new File([new Uint8Array(MIDIA_AUDIO_MAX_BYTES + 1)], nome, { type: 'audio/wav' })
    escolher(grande('a.wav'), grande('b.wav'), grande('c.wav'), grande('d.wav'), grande('e.wav'))
    await esperar(() => expect(container.querySelector('.lb-sons__recusas')).not.toBeNull())
    expect(topo()).not.toContain('Não deu para importar')
    const alerta = container.querySelector('.lb-sons__recusas [role="alert"]')
    expect(alerta?.querySelectorAll('p')).toHaveLength(4)
    expect(alerta?.textContent).toContain('E mais 2 arquivos recusados.')
    act(() => botao('Fechar').click())
    expect(container.querySelector('.lb-sons__recusas')).toBeNull()
  })

  it('com 200 sons o motivo de não importar fica NO TOPO, logo abaixo dos botões', async () => {
    let biblioteca = bibliotecaDeSonsVazia()
    for (let i = 0; i < EFEITOS_DE_SOM_MAX; i++) {
      const passo = comEfeitoNovo(biblioteca, { nome: `som ${i}`, fonte: { tipo: 'arquivo', ref: `midia:${i.toString(16).padStart(64, '0')}.wav`, bytes: 1000 } }, `som_${i}`)
      if (passo === null) throw new Error(`não montou o som ${i}`)
      biblioteca = passo.biblioteca
    }
    await montarPagina()
    await abrirAventura()
    act(() => useBibliotecaDeSonsStore.setState({ biblioteca }))
    const linha = container.querySelector('.lb-sons__topo .lb-sons__linha')
    expect(linha?.nextElementSibling?.textContent).toBe(`A biblioteca chegou a ${EFEITOS_DE_SOM_MAX} sons. Apague algum para importar outro.`)
    expect(naTela().split('Apague algum para importar outro.')).toHaveLength(2)
  })

  it('mapa solto: o vazio explica o caminho real (Cenas, + Nova cena) e não oferece um botão que não funciona', async () => {
    await montarPagina()
    await esperar(() => expect(naTela()).toContain('Sons moram numa aventura'))
    expect(naTela()).toContain('Em Cenas, + Nova cena transforma este mapa na primeira cena de uma aventura')
    expect(container.querySelector('.lb-sons__vazio button')).toBeNull()
    expect(naTela()).not.toContain('Salve como aventura')
  })
})

describe('o lápis quando a loja recusa', () => {
  const mudarFaixa = (janela: HTMLElement, valor: string) => {
    const faixa = janela.querySelector<HTMLInputElement>('input[type="range"]')
    if (faixa === null) throw new Error('sem a faixa do volume')
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(faixa, valor)
      faixa.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }
  const lapisAberto = (): HTMLElement => {
    const janela = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]')
    if (janela === null) throw new Error('o lápis não abriu')
    return janela
  }

  it('aceito, o volume do lápis chega ao som que toca (motor.mudarVolume); recusado, nem a loja nem o som mudam e o motivo aparece DENTRO do lápis', async () => {
    await montarPagina()
    await abrirAventura()
    const chuva = await importar('chuva.wav')
    act(() => {
      useBibliotecaDeSonsStore.getState().editarEfeito(chuva, { loop: true })
    })
    act(() => botao(/^chuva,/).click())
    await esperar(() => expect(tocadas()).toHaveLength(1))
    const motor = daVez.motor
    if (motor === null) throw new Error('sem motor')
    const mudarVolume = vi.spyOn(motor, 'mudarVolume')
    act(() => botao('Editar chuva').click())
    mudarFaixa(lapisAberto(), '35')
    expect(mudarVolume).toHaveBeenCalledWith(chuva, 0.35)
    expect(useBibliotecaDeSonsStore.getState().biblioteca.efeitos[0]?.volume).toBe(0.35)

    // O sons.json existe e não foi lido: a loja recusa toda mudança.
    act(() => useBibliotecaDeSonsStore.setState({ podeGravar: false }))
    mudarFaixa(lapisAberto(), '90')
    expect(mudarVolume).toHaveBeenCalledTimes(1)
    expect(useBibliotecaDeSonsStore.getState().biblioteca.efeitos[0]?.volume).toBe(0.35)
    expect(lapisAberto().querySelector('[role="alert"]')?.textContent).toBe(`Nada mudou. ${SONS_NAO_GRAVAVEIS}`)
  })

  it('apagar recusado pela loja não para o som, não fecha o lápis e diz o motivo dentro dele', async () => {
    await montarPagina()
    await abrirAventura()
    const chuva = await importar('chuva.wav')
    act(() => {
      useBibliotecaDeSonsStore.getState().editarEfeito(chuva, { loop: true })
    })
    act(() => botao(/^chuva,/).click())
    await esperar(() => expect(tocadas()).toHaveLength(1))
    act(() => botao('Editar chuva').click())
    act(() => botao('Apagar som…').click())
    act(() => useBibliotecaDeSonsStore.setState({ carregando: true }))
    act(() => botao('Apagar').click())
    expect(useBibliotecaDeSonsStore.getState().biblioteca.efeitos).toHaveLength(1)
    expect(tocadas()[0]?.stop).not.toHaveBeenCalled()
    expect(lapisAberto().querySelector('[role="alert"]')?.textContent).toBe(`chuva não foi apagado. ${SONS_AINDA_LENDO}`)
    act(() => useBibliotecaDeSonsStore.setState({ carregando: false }))
  })
})

describe('sem pasta da aventura', () => {
  it('mapa solto: diz que sons moram numa aventura, não importa e não grava nada', async () => {
    await montarPagina()
    await esperar(() => expect(naTela()).toContain('Sons moram numa aventura'))
    expect(botao('Importar sons').disabled).toBe(true)
    escolher(arquivoWav('porta.wav'))
    await esperar(() => expect(container.querySelector('[role="alert"]')?.textContent).toBe(`Não deu para importar porta.wav. ${SONS_SEM_AVENTURA}`))
    expect(fsFalso.writeFile).not.toHaveBeenCalled()
    expect(fsFalso.writeTextFile).not.toHaveBeenCalled()
  })

  it('aventura nova ainda sem pasta: o som entra na memória e o sons.json não é gravado até a aventura ganhar pasta', async () => {
    await montarPagina()
    await abrirAventura(null)
    expect(naTela()).toContain('Os sons ficam guardados quando a aventura for salva.')
    await importar('porta.wav')
    await new Promise((resolve) => setTimeout(resolve, 500))
    expect([...arquivos.keys()].some((caminho) => caminho.endsWith('sons.json'))).toBe(false)
  })
})

describe('pior caso', () => {
  it(`${EFEITOS_DE_SOM_MAX} sons com nomes de 40 caracteres, emoji e escrita não latina: um botão para cada, nome inteiro no rótulo, importar parado com o motivo`, async () => {
    const nomes = ['Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '🐉🔥 Dragão acorda 🔥🐉', 'Колокол собора на рассвете', '雷鳴が城に響く', 'ثعلب الصحراء يعوي']
    let biblioteca = bibliotecaDeSonsVazia()
    for (let i = 0; i < EFEITOS_DE_SOM_MAX; i++) {
      const passo = comEfeitoNovo(biblioteca, { nome: nomes[i % nomes.length] ?? 'x', fonte: { tipo: 'arquivo', ref: `midia:${i.toString(16).padStart(64, '0')}.wav`, bytes: 1000 } }, `som_${i}`)
      if (passo === null) throw new Error(`não montou o som ${i}`)
      biblioteca = passo.biblioteca
    }
    biblioteca = comEfeitoMudado(biblioteca, 'som_0', { atalho: 9, favorito: true, loop: true }) ?? biblioteca
    await montarPagina()
    await abrirAventura()
    act(() => useBibliotecaDeSonsStore.setState({ biblioteca }))
    expect(container.querySelectorAll('.lb-efeito__tocar')).toHaveLength(EFEITOS_DE_SOM_MAX)
    expect(botao(/^Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, tecla 9, repete até parar$/)).toBeDefined()
    expect(container.querySelector('[aria-label="Колокол собора на рассвете"]')).not.toBeNull()
    expect(botao('Importar sons').disabled).toBe(true)
    expect(naTela()).toContain(`A biblioteca chegou a ${EFEITOS_DE_SOM_MAX} sons. Apague algum para importar outro.`)
  })
})

describe('o peso da mídia', () => {
  it('mostra o total em MB da pasta de mídia da aventura e avisa acima de 200 MB', async () => {
    let bytes = 12.5 * MB
    // A pasta só tem a imagem: os áudios importados entram no peso pela biblioteca (32 KB cada).
    await act(async () => root.render(<PaginaSons medirMidia={async () => new Map([['mapa.png', bytes]])} />))
    await abrirAventura()
    await esperar(() => expect(naTela()).toContain('Mídia da aventura: 12,5 MB'))
    expect(naTela()).not.toContain('Passou de 200 MB')
    bytes = 201 * MB
    await importar('pesado.wav')
    await esperar(() => expect(naTela()).toContain('Mídia da aventura: 201 MB'))
    expect(naTela()).toContain('Passou de 200 MB: levar e abrir a aventura fica lento.')
    // Um efeito curto não vira "0,0 MB".
    bytes = 4000
    await importar('estalo.wav', 2)
    await esperar(() => expect(naTela()).toContain('Mídia da aventura: menos de 0,1 MB'))
  })
})

describe('o aviso da mídia pesada diz a verdade', () => {
  it('acima de 200 MB não manda apagar sons (apagar não tira o áudio da pasta midia); diz que o arquivo fica', async () => {
    await act(async () => root.render(<PaginaSons medirMidia={async () => new Map([['trovoes.wav', 201 * MB]])} />))
    await abrirAventura()
    await esperar(() => expect(naTela()).toContain('Mídia da aventura: 201 MB'))
    expect(naTela()).not.toContain('Apague sons que não usa')
    expect(naTela()).toContain('Apagar um som tira o botão, mas o áudio dele continua na pasta midia da aventura.')
  })
})

describe('o selo pulsa', () => {
  it('no clique o selo pulsa em 150 ms; pela tecla, não (ação de teclado não anima); com movimento reduzido, não', async () => {
    const animar = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animar })
    try {
      await montarPagina()
      await abrirAventura()
      const id = await importar('sino.wav')
      act(() => {
        useBibliotecaDeSonsStore.getState().editarEfeito(id, { atalho: 5 })
      })
      // Enter ou Espaço no cartão focado chegam como clique de detail 0: teclado não anima.
      act(() => botao(/^sino,/).click())
      expect(animar).not.toHaveBeenCalled()
      await esperar(() => expect(tocadas()).toHaveLength(1))
      act(() => {
        botao(/^sino,/).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }))
      })
      expect(animar).toHaveBeenCalledTimes(1)
      expect(animar.mock.calls[0]?.[1]).toMatchObject({ duration: 150 })
      await esperar(() => expect(tocadas()).toHaveLength(2))
      teclar(document.body, '5')
      await esperar(() => expect(tocadas()).toHaveLength(3))
      expect(animar).toHaveBeenCalledTimes(1)
      Object.defineProperty(window, 'matchMedia', { configurable: true, value: (consulta: string) => ({ matches: consulta.includes('reduce'), media: consulta }) })
      act(() => {
        botao(/^sino,/).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }))
      })
      expect(animar).toHaveBeenCalledTimes(1)
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, 'animate')
      Reflect.deleteProperty(window, 'matchMedia')
    }
  })
})
