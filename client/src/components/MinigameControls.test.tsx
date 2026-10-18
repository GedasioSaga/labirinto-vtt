import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUDIO_NAO_E_AUDIO } from '../lib/midiaNoDisco'
import type { AnaliseDaMusica, AudioDecodificado, MusicaPreparada } from '../minigames/danca/analise'
import { MINIGAME_PADRAO, type MinigameDanca, type MusicaDaDanca, type NotaDaDanca } from '../minigames/danca/tipos'
import { MINIGAME_PESCA_PADRAO } from '../minigames/pesca/tipos'
import { esquecerMusicasNaMemoria, MinigameControls, MUSICA_ERROS, type CaminhoDaMusica, type MinigameControlsProps } from './MinigameControls'
import { FichaDoPino, type FichaDoPinoProps } from './livro/FichaDoPino'
import { PinControls } from './PinControls'

/**
 * O DESAFIO DE DANÇA no painel do pino: cada campo grava no pino, importar uma
 * música grava a mídia e a música 'arquivo' com as setas, o ajuste do tempo
 * refaz as setas, música sem setas avisa, e a porta é a mesma lista da alavanca.
 * O disco e o Web Audio são de mentira (`CaminhoDaMusica`): o jsdom não tem nenhum dos dois.
 */

const REF = `midia:${'a'.repeat(64)}.mp3`
const PIN = 'pin-danca'
const NOTA: NotaDaDanca = { t: 1, lane: 0, len: 0, sub: 4 }

/** O decodificado de mentira: 30 s de silêncio a 48 kHz (a análise é de mentira também). */
const BUFFER: AudioDecodificado = {
  sampleRate: 48000,
  length: 48000 * 30,
  duration: 30,
  numberOfChannels: 1,
  getChannelData: () => new Float32Array(16),
}

/** Uma análise pequena e coerente: 120 BPM, ataque em toda batida, para `reajustar` de verdade dar setas. */
function analiseDeMentira(): AnaliseDaMusica {
  const hopS = 0.01
  const quadros = 3000
  const env = new Float32Array(quadros)
  const rms = new Float32Array(quadros).fill(0.3)
  for (let i = 50; i < quadros; i += 50) env[i] = 1
  return { bpm: 120, periodo: 0.5, primeiraBatida: 0.5, fase4: 0, duracao: 30, env, rms, hopS, confianca: 0.8 }
}

function preparada(coreografias: Record<'diversao' | 'expert', NotaDaDanca[]> = { diversao: [NOTA], expert: [NOTA, NOTA] }): MusicaPreparada {
  return { ritmo: { bpm: 120, primeiraBatida: 0.5, fase4: 0, duracaoS: 30, coreografias }, analise: analiseDeMentira() }
}

function caminhoDeMentira(extra: Partial<CaminhoDaMusica> = {}): CaminhoDaMusica {
  return {
    guardar: vi.fn(async () => REF),
    ler: vi.fn(async () => new Uint8Array([0x49, 0x44, 0x33, 0])),
    decodificar: vi.fn(async () => BUFFER),
    preparar: vi.fn(async () => preparada()),
    ...extra,
  }
}

function musicaArquivo(extra: Partial<Extract<MusicaDaDanca, { tipo: 'arquivo' }>> = {}): MusicaDaDanca {
  return { tipo: 'arquivo', midia: REF, nome: 'Funky Monkey', bpm: 119.8, primeiraBatida: 0.924, fase4: 1, duracaoS: 41.4, coreografias: { diversao: [NOTA], expert: [NOTA] }, ...extra }
}

describe('MinigameControls', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    esquecerMusicasNaMemoria()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function props(extra: Partial<MinigameControlsProps> = {}): MinigameControlsProps {
    return {
      pinId: PIN,
      minigame: MINIGAME_PADRAO,
      onChange: vi.fn(),
      porta: { value: null, options: [], onChange: vi.fn() },
      aoVivo: null,
      caminho: caminhoDeMentira(),
      ...extra,
    }
  }

  function render(p: MinigameControlsProps): void {
    act(() => root.render(<MinigameControls {...p} />))
  }

  function botao(nome: string): HTMLButtonElement {
    const achado = Array.from(container.querySelectorAll('button')).find((b) => (b.getAttribute('aria-label') ?? b.textContent) === nome)
    if (achado === undefined) throw new Error(`sem botão "${nome}"`)
    return achado
  }

  function campo<T extends HTMLElement>(rotulo: string, tipo: new () => T): T {
    const label = Array.from(container.querySelectorAll('label')).find((l) => l.textContent === rotulo)
    // O id vem de `useId` (":r1:"): por `getElementById`, que não precisa escapar os dois-pontos.
    const alvo = label?.htmlFor ? document.getElementById(label.htmlFor) : container.querySelector(`[aria-label="${rotulo}"]`)
    if (!(alvo instanceof tipo)) throw new Error(`sem campo "${rotulo}"`)
    return alvo
  }

  function digitarESair(el: HTMLInputElement | HTMLTextAreaElement, valor: string): void {
    const prototipo = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(prototipo, 'value')?.set
    act(() => {
      el.focus()
      setter?.call(el, valor)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => el.blur())
  }

  function escolher(el: HTMLSelectElement, valor: string): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
    act(() => {
      setter?.call(el, valor)
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  async function importar(arquivo: File): Promise<void> {
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')
    if (input === null) throw new Error('sem o campo de arquivo')
    Object.defineProperty(input, 'files', { value: [arquivo], configurable: true })
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    // Lê, grava, decodifica e prepara: quatro esperas encadeadas.
    for (let i = 0; i < 6; i += 1) await act(async () => {})
  }

  function ultimo(onChange: MinigameControlsProps['onChange']): MinigameDanca {
    const chamadas = vi.mocked(onChange).mock.calls
    const ultima = chamadas.at(-1)
    if (ultima === undefined) throw new Error('nada gravado')
    const gravado = ultima[0]
    if (gravado.jogo !== 'danca') throw new Error('o painel da dança gravou outro jogo')
    return gravado
  }

  it('quem desafia e a fala gravam ao sair do campo, não a cada letra', () => {
    const p = props()
    render(p)
    digitarESair(campo('Quem desafia', HTMLInputElement), 'Seu Bené  ')
    expect(p.onChange).toHaveBeenCalledTimes(1)
    expect(ultimo(p.onChange).npc).toBe('Seu Bené')
    digitarESair(campo('Fala do desafio', HTMLTextAreaElement), 'Dança comigo?')
    expect(ultimo(p.onChange).fala).toBe('Dança comigo?')
    // O resto do desafio fica como estava.
    expect(ultimo(p.onChange).premio).toEqual(MINIGAME_PADRAO.premio)
  })

  it('dificuldade, nota mínima, prêmio e consequência gravam no pino', () => {
    const p = props()
    render(p)
    act(() => botao('Só Expert').click())
    expect(ultimo(p.onChange).permitida).toBe('expert')
    act(() => botao('A').click())
    expect(ultimo(p.onChange).notaMin).toBe('A')
    escolher(campo('Tipo de prêmio', HTMLSelectElement), 'pista')
    expect(ultimo(p.onChange).premio).toEqual({ tipo: 'pista', texto: 'Chave de latão' })
    escolher(campo('Consequência', HTMLSelectElement), 'barulho')
    expect(ultimo(p.onChange).consequencia.tipo).toBe('barulho')
    expect(container.textContent).toContain('A consequência nunca tranca a história')
  })

  it('o texto do prêmio desliga com "Nenhum prêmio" e o da penalidade fora de "Penalidade no próximo teste"', () => {
    render(props({ minigame: { ...MINIGAME_PADRAO, premio: { tipo: 'nada', texto: '' }, consequencia: { tipo: 'espera', texto: '' } } }))
    expect(campo('Prêmio', HTMLInputElement).disabled).toBe(true)
    expect(campo('Penalidade', HTMLInputElement).disabled).toBe(true)
  })

  it('a pastilha marcada é a do pino', () => {
    render(props({ minigame: { ...MINIGAME_PADRAO, permitida: 'diversao', notaMin: 'C' } }))
    const marcadas = Array.from(container.querySelectorAll('[role="radio"][aria-checked="true"]')).map((b) => b.textContent)
    expect(marcadas).toEqual(['Só Diversão', 'C'])
  })

  it('"Abre a porta": as portas da cena, a escolha grava e "Nenhuma" solta', () => {
    const onPorta = vi.fn()
    const opcoes = [
      { id: 'w1', label: 'Porta 1' },
      { id: 'w2', label: 'Porta 2 · Cripta' },
    ]
    render(props({ porta: { value: 'w1', options: opcoes, onChange: onPorta } }))
    const select = campo('Abre a porta', HTMLSelectElement)
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['Nenhuma', 'Porta 1', 'Porta 2 · Cripta'])
    expect(select.value).toBe('w1')
    escolher(select, 'w2')
    expect(onPorta).toHaveBeenLastCalledWith('w2')
    escolher(select, '')
    expect(onPorta).toHaveBeenLastCalledWith(null)
  })

  it('sem porta no mapa a lista desliga e diz o que fazer; porta apagada vira "Nenhuma"', () => {
    render(props({ porta: { value: 'sumiu', options: [], onChange: vi.fn() } }))
    const select = campo('Abre a porta', HTMLSelectElement)
    expect(select.disabled).toBe(true)
    expect(select.value).toBe('')
    expect(container.textContent).toContain('Ponha uma porta no mapa para a dança abrir.')
  })

  it('importar: grava o áudio, prepara com o id do pino e grava a música "arquivo" com as setas', async () => {
    const caminho = caminhoDeMentira()
    const p = props({ caminho })
    render(p)
    const bytes = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0])
    await importar(new File([bytes], 'MOTHER 3 - Funky Monkey.mp3', { type: 'audio/mpeg' }))
    expect(caminho.guardar).toHaveBeenCalledTimes(1)
    expect(Array.from(vi.mocked(caminho.guardar).mock.calls[0][0])).toEqual(Array.from(bytes))
    expect(caminho.preparar).toHaveBeenCalledWith(BUFFER, PIN, expect.any(Function))
    expect(ultimo(p.onChange).musica).toEqual({
      tipo: 'arquivo',
      midia: REF,
      nome: 'MOTHER 3 - Funky Monkey',
      bpm: 120,
      primeiraBatida: 0.5,
      fase4: 0,
      duracaoS: 30,
      coreografias: { diversao: [NOTA], expert: [NOTA, NOTA] },
    })
  })

  it('arquivo que não é áudio: a frase de erro, e nada grava no pino', async () => {
    const p = props({ caminho: caminhoDeMentira({ guardar: vi.fn(async () => Promise.reject(new Error(AUDIO_NAO_E_AUDIO))) }) })
    render(p)
    await importar(new File([new Uint8Array([1, 2, 3])], 'foto.png'))
    expect(container.textContent).toContain(`Não deu para importar: ${AUDIO_NAO_E_AUDIO}.`)
    expect(p.onChange).not.toHaveBeenCalled()
  })

  it('áudio que não decodifica: "não abriu como áudio"', async () => {
    const p = props({ caminho: caminhoDeMentira({ decodificar: vi.fn(async () => Promise.reject(new Error('EncodingError'))) }) })
    render(p)
    await importar(new File([new Uint8Array([0x49, 0x44, 0x33])], 'quebrado.mp3'))
    expect(container.textContent).toContain(MUSICA_ERROS.naoAbriu)
    expect(p.onChange).not.toHaveBeenCalled()
  })

  it('a grade mostra o tempo do pino; ±0,1 BPM e ±10 ms refazem as setas e gravam', async () => {
    const p = props()
    render(p)
    await importar(new File([new Uint8Array([0x49, 0x44, 0x33])], 'x.mp3'))
    const gravada = ultimo(p.onChange)
    // O painel relê o pino com a música nova, como o App faria.
    render({ ...p, minigame: gravada })
    expect(container.textContent).toContain('120,0 BPM')
    expect(container.textContent).toContain('0,500 s')
    expect(container.textContent).toContain('alta')
    await act(async () => botao('Tempo mais 0,1 BPM').click())
    const mais = ultimo(p.onChange).musica
    if (mais.tipo !== 'arquivo') throw new Error('perdeu a música')
    expect(mais.bpm).toBe(120.1)
    expect(mais.primeiraBatida).toBe(0.5)
    expect(mais.midia).toBe(REF)
    // As setas são as de `reajustar` com o tempo novo, não as de antes.
    expect(mais.coreografias.expert.length).toBeGreaterThan(0)
    expect(mais.coreografias).not.toEqual(gravada.musica.tipo === 'arquivo' ? gravada.musica.coreografias : null)
    await act(async () => botao('Primeira batida 10 ms antes').click())
    const antes = ultimo(p.onChange).musica
    if (antes.tipo !== 'arquivo') throw new Error('perdeu a música')
    // O ajuste parte do tempo QUE ESTÁ NO PINO (120), não do último clique.
    expect(antes.bpm).toBe(120)
    expect(antes.primeiraBatida).toBeCloseTo(0.49, 10)
  })

  it('depois de reabrir o app: o primeiro ajuste lê o áudio guardado do disco e grava', async () => {
    const caminho = caminhoDeMentira()
    const p = props({ caminho, minigame: { ...MINIGAME_PADRAO, musica: musicaArquivo() } })
    render(p)
    expect(container.textContent).toContain('Funky Monkey: 41,4 s')
    expect(container.textContent).toContain('119,8 BPM')
    expect(caminho.ler).not.toHaveBeenCalled()
    await act(async () => botao('Primeira batida 10 ms depois').click())
    for (let i = 0; i < 4; i += 1) await act(async () => {})
    expect(caminho.ler).toHaveBeenCalledWith(REF)
    const musica = ultimo(p.onChange).musica
    if (musica.tipo !== 'arquivo') throw new Error('perdeu a música')
    expect(musica.bpm).toBe(119.8)
    expect(musica.primeiraBatida).toBeCloseTo(0.934, 10)
    expect(musica.nome).toBe('Funky Monkey')
  })

  it('a música guardada sumiu do disco: diz para importar de novo', async () => {
    const p = props({ caminho: caminhoDeMentira({ ler: vi.fn(async () => Promise.reject(new Error('não existe'))) }), minigame: { ...MINIGAME_PADRAO, musica: musicaArquivo() } })
    render(p)
    await act(async () => botao('Tempo menos 0,1 BPM').click())
    for (let i = 0; i < 4; i += 1) await act(async () => {})
    expect(container.textContent).toContain(MUSICA_ERROS.guardadaSumiu)
    expect(p.onChange).not.toHaveBeenCalled()
  })

  it('música sem setas numa dificuldade em jogo: o aviso diz qual e o que fazer', () => {
    const semExpert = musicaArquivo({ coreografias: { diversao: [NOTA], expert: [] } })
    render(props({ minigame: { ...MINIGAME_PADRAO, musica: semExpert } }))
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Esta música não deu setas no Expert: confira o tempo ou use a faixa demo.')
    // Só Diversão: o Expert vazio não importa.
    render(props({ minigame: { ...MINIGAME_PADRAO, permitida: 'diversao', musica: semExpert } }))
    expect(container.querySelector('[role="alert"]')).toBeNull()
    render(props({ minigame: { ...MINIGAME_PADRAO, musica: musicaArquivo({ coreografias: { diversao: [], expert: [] } }) } }))
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Esta música não deu setas: confira o tempo ou use a faixa demo.')
  })

  it('demo e arquivo: voltar à demo grava a demo, e o arquivo importado volta sem importar de novo', async () => {
    const p = props()
    render(p)
    const radios = () => Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]'))
    expect(radios()[1].disabled).toBe(true)
    await importar(new File([new Uint8Array([0x49, 0x44, 0x33])], 'x.mp3'))
    const comArquivo = ultimo(p.onChange)
    render({ ...p, minigame: comArquivo })
    act(() => radios()[0].click())
    expect(ultimo(p.onChange).musica).toEqual({ tipo: 'demo' })
    render({ ...p, minigame: ultimo(p.onChange) })
    expect(radios()[1].disabled).toBe(false)
    act(() => radios()[1].click())
    expect(ultimo(p.onChange).musica).toEqual(comArquivo.musica)
  })

  it('pino editado no meio da dança: o desfecho mostra o prêmio e a consequência do convite, não os do pino de agora', () => {
    const editado: MinigameDanca = { ...MINIGAME_PADRAO, premio: { tipo: 'item', texto: 'Moeda de ouro' }, consequencia: { tipo: 'espera', texto: '' } }
    const final = { precisao: 0.5, letra: 'D', falhou: true, perfeito: 1, bom: 1, ok: 1, errou: 9, comboMax: 2, segOk: 0, segTotal: 0 } as const
    render(
      props({
        minigame: editado,
        aoVivo: {
          players: [],
          danca: {
            sessao: 's1',
            pinId: PIN,
            npc: 'Dona Ziza',
            fase: 'fim',
            notaMin: 'B',
            temPorta: true,
            premio: { ...MINIGAME_PADRAO.premio },
            consequencia: { ...MINIGAME_PADRAO.consequencia },
            participantes: [{ playerId: 'p-ana', nome: 'Ana', status: 'terminou', conectado: true, final, passou: false }],
            desfecho: { todosPassaram: false, portaAberta: false },
          },
          onConvidar: vi.fn(() => null),
          onComecar: vi.fn(() => true),
          onPausar: vi.fn(() => true),
          onRetomar: vi.fn(() => true),
          onEncerrar: vi.fn(() => true),
        },
      }),
    )
    const texto = container.querySelector('.lb-danca__desfecho')?.textContent ?? ''
    expect(texto).toContain('Penalidade: −2 no próximo teste de Agilidade')
    expect(texto).not.toContain('Só tenta de novo na próxima rodada')
  })

  it('sem sala: no lugar do "Chamar para dançar", o que falta', () => {
    render(props())
    expect(container.textContent).toContain('Abra a sala, ou a Visão de jogador para testar sozinho, para chamar para dançar.')
    expect(Array.from(container.querySelectorAll('button')).some((b) => b.textContent === 'Chamar para dançar')).toBe(false)
  })

  it('na ficha do pino: o pino de minigame aberto mostra o desafio no essencial', () => {
    const base: FichaDoPinoProps = {
      pinId: PIN,
      kind: 'minigame',
      onKindChange: () => {},
      description: '',
      onDescriptionChange: () => {},
      locked: false,
      onLockedChange: () => {},
      marco: false,
      onMarcoChange: () => {},
      lerDePerto: null,
      onLerDePertoChange: () => {},
      image: null,
      onChooseImage: () => {},
      onClearImage: () => {},
      iconChoice: null,
      quemVe: null,
    }
    act(() => root.render(<FichaDoPino {...base} desafio={props()} />))
    expect(container.textContent).toContain('Quem desafia')
    expect(container.textContent).toContain('Nota mínima para passar')
    // Outro tipo, mesmos props: nada do desafio.
    act(() => root.render(<FichaDoPino {...base} kind="exclamacao" desafio={props()} />))
    expect(container.textContent).not.toContain('Quem desafia')
    // Nenhum pino aberto (a ferramenta Pino armada): só o recado de cravar.
    act(() => root.render(<PinControls {...base} description={null} onDelete={() => {}} desafio={null} />))
    expect(container.textContent).toContain('Crave o pino; no painel dele você monta o desafio de dança.')
  })

  it('pino de pesca (antes do painel dela): só o aviso, nenhum campo da dança e nada gravado', () => {
    const p = props({ minigame: { ...MINIGAME_PESCA_PADRAO } })
    render(p)
    expect(container.textContent).toContain('Pesca: painel em construção')
    expect(container.textContent).not.toContain('Quem desafia')
    expect(container.textContent).not.toContain('Chamar para dançar')
    expect(container.querySelectorAll('input, select, textarea, button')).toHaveLength(0)
    expect(p.onChange).not.toHaveBeenCalled()
  })
})
