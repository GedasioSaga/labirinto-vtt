/**
 * O MOTOR DOS SONS AO VIVO (`aoVivo/motor.ts`) com o contexto de som de
 * verdade (`criarMotorDeSom`) sobre o Web Audio de mentira: limites de sons e
 * de loops, Mudo que não para, saída sem o passa-baixa, nada antes do gesto,
 * uma leitura para dois toques, cache em duas camadas e o fade do Parar.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarSomStore } from '../../../stores/somStore'
import {
  BYTES_POR_SEGUNDO_FALSO,
  criarAudioFalso,
  criarElementoDeAudioFalso,
  type ElementoDeAudioFalso,
  type FonteFalsa,
  type GanhoFalso,
  type NoFalso,
} from '../audioFalso.fixture'
import { ehVideoDoYoutube, type FonteDoSom } from '../biblioteca'
import { criarMotorDeSom, type ContextoDeSom } from '../contexto'
import {
  criarMotorAoVivo,
  criarMotorAoVivoDoNavegador,
  DECODIFICADO_ATE_BYTES,
  ESPERA_DO_EFEITO_CURTO_MS,
  FADE_AO_PARAR_MS,
  MAX_LOOPS,
  MAX_SONS_SIMULTANEOS,
  PRAZO_DO_CARREGAMENTO_MS,
  type EventoDoMotor,
  type OpcoesDoToqueAoVivo,
} from './motor'

const MB = 1024 * 1024
/** Um arquivo de 10 s no áudio de mentira (160 KB a 16 KB/s): fica decodificado. */
const DEZ_SEGUNDOS = 10 * BYTES_POR_SEGUNDO_FALSO
/** O que 10 s decodificados ocupam: 480 mil quadros x 2 canais x 4 bytes. */
const CUSTO_DE_DEZ_SEGUNDOS = 10 * 48000 * 2 * 4

const curto: OpcoesDoToqueAoVivo = { loop: false, volumeDoEfeito: 0.8 }
const emLoop: OpcoesDoToqueAoVivo = { loop: true, volumeDoEfeito: 0.8 }

function idDeAudio(n: number, extensao = 'mp3'): string {
  return `${n.toString(16).padStart(64, '0')}.${extensao}`
}

/** Guardado antes de os relógios ficarem falsos: `assentar` precisa do de verdade. */
const setTimeoutDeVerdade = globalThis.setTimeout
/** Deixa assentar toda a corrente de promessas (bytes, decodificação, início); os relógios falsos não andam. */
const assentar = () => new Promise<void>((resolve) => setTimeoutDeVerdade(resolve, 0))

function item<T>(lista: readonly T[], indice: number): T {
  const achado = lista[indice]
  if (achado === undefined) throw new Error(`não há o item ${indice} (são ${lista.length})`)
  return achado
}

function montar({ estado = 'running', destravar = true, orcamento = 150 * MB, volume = 0.5 }: { estado?: AudioContextState; destravar?: boolean; orcamento?: number; volume?: number } = {}) {
  const audio = criarAudioFalso({ estado })
  const contexto = criarMotorDeSom((): ContextoDeSom<NoFalso> | null => audio.ctx)
  const alvo = new EventTarget()
  contexto.destravarNoPrimeiroGesto(alvo)
  const som = criarSomStore(null)
  som.getState().setVolume(volume)
  const tamanhos = new Map<string, number>()
  const carregarBytes = vi.fn(async (id: string): Promise<Uint8Array> => {
    const tamanho = tamanhos.get(id)
    if (tamanho === undefined) throw new Error(`não há o arquivo ${id}`)
    return new Uint8Array(tamanho)
  })
  const elementos: ElementoDeAudioFalso[] = []
  const criarUrlDoAudio = vi.fn((_bytes: Uint8Array, tipoMime: string) => `blob:${tipoMime}#${criarUrlDoAudio.mock.calls.length}`)
  const revogarUrl = vi.fn<(url: string) => void>()
  const eventos: EventoDoMotor[] = []
  const motor = criarMotorAoVivo<NoFalso>({
    carregarBytes,
    obterSaida: () => {
      const aoVivo = contexto.obterEntradaAoVivo()
      return aoVivo === null ? null : { ctx: audio.ctx, aoVivo }
    },
    aoDestravar: (ouvinte) => contexto.quandoRodar(ouvinte),
    lerPreferencia: () => som.getState(),
    assinarPreferencia: (ouvinte) => som.subscribe(() => ouvinte()),
    criarElementoDeAudio: () => {
      const elemento = criarElementoDeAudioFalso()
      elementos.push(elemento)
      return elemento
    },
    criarUrlDoAudio,
    revogarUrl,
    agora: () => Date.now(),
    orcamentoDoCacheBytes: orcamento,
  })
  motor.assinar((evento) => eventos.push(evento))
  const gesto = (): void => {
    alvo.dispatchEvent(new Event('pointerup'))
  }
  if (destravar) gesto()

  /** Um arquivo de áudio com `bytes` bytes que o carregador sabe trazer. */
  function arquivo(n: number, bytes: number, extensao = 'mp3'): FonteDoSom {
    const id = idDeAudio(n, extensao)
    tamanhos.set(id, bytes)
    return { tipo: 'arquivo', ref: `midia:${id}`, bytes }
  }
  /** As fontes que o motor tocou (o gesto também toca 1 amostra muda, que não ouve `ended`). */
  const fontesDoMotor = (): FonteFalsa[] => audio.fontes.filter((fonte) => fonte.addEventListener.mock.calls.length > 0)
  function ganhoDe(no: NoFalso): GanhoFalso {
    const ganho = audio.ganhos.find((candidato) => candidato === no.destino)
    if (ganho === undefined) throw new Error(`${no.nome} não está ligado a um ganho`)
    return ganho
  }
  const doTipo = <T extends EventoDoMotor['tipo']>(tipo: T) => eventos.filter((evento): evento is Extract<EventoDoMotor, { tipo: T }> => evento.tipo === tipo)
  const cargasDe = (fonte: FonteDoSom): number => carregarBytes.mock.calls.filter(([id]) => fonte.tipo === 'arquivo' && fonte.ref === `midia:${id}`).length

  return { audio, contexto, som, motor, carregarBytes, criarUrlDoAudio, revogarUrl, elementos, eventos, gesto, arquivo, fontesDoMotor, ganhoDe, doTipo, cargasDe }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('limites', () => {
  it(`${MAX_SONS_SIMULTANEOS} sons tocam juntos; o 9º efeito curto derruba o efeito curto MAIS ANTIGO (nunca o loop), com fade`, async () => {
    const m = montar()
    expect(m.motor.tocar('ambiente', m.arquivo(100, DEZ_SEGUNDOS), emLoop)).toEqual({ aceito: true })
    for (let i = 0; i < MAX_SONS_SIMULTANEOS - 1; i++) expect(m.motor.tocar(`curto_${i}`, m.arquivo(i + 1, DEZ_SEGUNDOS), curto)).toEqual({ aceito: true })
    await assentar()
    expect(m.doTipo('tocando')).toHaveLength(MAX_SONS_SIMULTANEOS)
    expect(m.doTipo('terminou')).toEqual([])

    const maisAntigo = item(m.fontesDoMotor(), 1)
    expect(m.motor.tocar('curto_novo', m.arquivo(50, DEZ_SEGUNDOS), curto)).toEqual({ aceito: true })
    expect(m.doTipo('terminou')).toEqual([{ tipo: 'terminou', instancia: 'curto_0', motivo: 'derrubado' }])
    expect(maisAntigo.stop).toHaveBeenCalledWith(m.audio.ctx.currentTime + FADE_AO_PARAR_MS / 1000)
    expect(item(m.fontesDoMotor(), 0).stop).not.toHaveBeenCalled()

    await assentar()
    expect(m.doTipo('tocando').map((evento) => evento.instancia)).toContain('curto_novo')
    expect(m.doTipo('tocando').length - m.doTipo('terminou').length).toBe(MAX_SONS_SIMULTANEOS)
  })

  it(`o ${MAX_LOOPS + 1}º loop é RECUSADO com motivo, e nenhum som novo começa nem é derrubado`, async () => {
    const m = montar()
    for (let i = 0; i < MAX_LOOPS; i++) expect(m.motor.tocar(`loop_${i}`, m.arquivo(i + 1, DEZ_SEGUNDOS), emLoop)).toEqual({ aceito: true })
    await assentar()
    const cargas = m.carregarBytes.mock.calls.length
    const fontes = m.audio.fontes.length
    const eventosAntes = m.eventos.length

    expect(m.motor.tocar('loop_demais', m.arquivo(9, DEZ_SEGUNDOS), emLoop)).toEqual({ aceito: false, motivo: 'limite-de-loops' })
    expect(m.eventos.slice(eventosAntes)).toEqual([{ tipo: 'recusado', instancia: 'loop_demais', motivo: 'limite-de-loops' }])
    await assentar()
    expect(m.carregarBytes).toHaveBeenCalledTimes(cargas)
    expect(m.audio.fontes).toHaveLength(fontes)
    expect(m.doTipo('terminou')).toEqual([])

    // O limite é de loops: um efeito curto ainda entra.
    expect(m.motor.tocar('sino', m.arquivo(10, DEZ_SEGUNDOS), curto)).toEqual({ aceito: true })
  })
})

describe('trocar a mesma instância', () => {
  it('tocar de novo a MESMA instância para a anterior (sem fade) e toca a nova no lugar', async () => {
    const m = montar()
    m.motor.tocar('x', m.arquivo(1, DEZ_SEGUNDOS), curto)
    await assentar()
    const primeira = item(m.fontesDoMotor(), 0)
    expect(m.motor.tocar('x', m.arquivo(2, DEZ_SEGUNDOS), curto)).toEqual({ aceito: true })
    expect(m.doTipo('terminou')).toEqual([{ tipo: 'terminou', instancia: 'x', motivo: 'parado' }])
    expect(primeira.stop).toHaveBeenCalledWith(m.audio.ctx.currentTime)
    await assentar()
    expect(m.doTipo('tocando').map((evento) => evento.instancia)).toEqual(['x', 'x'])
    // O fim da fonte trocada não encerra a nova.
    primeira.terminar()
    expect(m.doTipo('terminou')).toHaveLength(1)
  })

  it(`com ${MAX_LOOPS} loops, trocar um efeito curto por loop é recusado e o curto SEGUE tocando; trocar um loop por outro loop entra`, async () => {
    const m = montar()
    for (let i = 0; i < MAX_LOOPS; i++) m.motor.tocar(`loop_${i}`, m.arquivo(i + 1, DEZ_SEGUNDOS), emLoop)
    m.motor.tocar('x', m.arquivo(9, DEZ_SEGUNDOS), curto)
    await assentar()
    expect(m.motor.tocar('x', m.arquivo(10, DEZ_SEGUNDOS), emLoop)).toEqual({ aceito: false, motivo: 'limite-de-loops' })
    expect(m.doTipo('terminou')).toEqual([])
    for (const fonte of m.fontesDoMotor()) expect(fonte.stop).not.toHaveBeenCalled()

    expect(m.motor.tocar('loop_0', m.arquivo(11, DEZ_SEGUNDOS), emLoop)).toEqual({ aceito: true })
    expect(m.doTipo('terminou')).toEqual([{ tipo: 'terminou', instancia: 'loop_0', motivo: 'parado' }])
    await assentar()
    expect(m.doTipo('tocando').filter((evento) => evento.loop)).toHaveLength(MAX_LOOPS + 1)
  })
})

describe('volume, Mudo e saída', () => {
  it('Mudo zera o ganho SEM parar o loop: ele segue tocando em silêncio e volta ao desmutar', async () => {
    const m = montar({ volume: 0.5 })
    m.motor.tocar('chuva', m.arquivo(1, DEZ_SEGUNDOS), emLoop)
    await assentar()
    const fonte = item(m.fontesDoMotor(), 0)
    const ganho = m.ganhoDe(fonte)
    // 0,8 do efeito x 0,5² do aparelho.
    expect(ganho.gain.setValueAtTime).toHaveBeenCalledWith(0.2, expect.any(Number))

    m.som.getState().alternarMudo()
    expect(ganho.gain.linearRampToValueAtTime.mock.lastCall?.[0]).toBe(0)
    expect(fonte.stop).not.toHaveBeenCalled()
    expect(m.doTipo('terminou')).toEqual([])

    m.som.getState().alternarMudo()
    expect(ganho.gain.linearRampToValueAtTime.mock.lastCall?.[0]).toBeCloseTo(0.2)
    // Seguiu de onde estava: não recomeçou nem trocou de fonte.
    expect(fonte.start).toHaveBeenCalledTimes(1)
    expect(m.fontesDoMotor()).toHaveLength(1)
  })

  it('volume final = volume do efeito x volume do aparelho AO QUADRADO (a curva dos sons de clima), e muda ao vivo com o somStore e com mudarVolume', async () => {
    const m = montar({ volume: 0.5 })
    m.motor.tocar('vento', m.arquivo(1, DEZ_SEGUNDOS), { loop: true, volumeDoEfeito: 0.6 })
    await assentar()
    const ganho = m.ganhoDe(item(m.fontesDoMotor(), 0))
    const ultimoAlvo = (): number | undefined => ganho.gain.linearRampToValueAtTime.mock.lastCall?.[0]
    expect(ganho.gain.setValueAtTime.mock.calls[0]?.[0]).toBeCloseTo(0.15)

    m.som.getState().setVolume(1)
    expect(ultimoAlvo()).toBeCloseTo(0.6)
    m.motor.mudarVolume('vento', 0.25)
    expect(ultimoAlvo()).toBeCloseTo(0.25)
    m.som.getState().setVolume(0.5)
    expect(ultimoAlvo()).toBeCloseTo(0.0625)
  })

  it('o som ao vivo NÃO passa pelo passa-baixa: fonte -> ganho do efeito -> entrada aoVivo -> destination', async () => {
    const m = montar()
    m.motor.tocar('sino', m.arquivo(1, DEZ_SEGUNDOS), curto)
    await assentar()
    const aoVivo = m.contexto.obterEntradaAoVivo()
    if (aoVivo === null) throw new Error('sem entrada ao vivo depois do gesto')
    const fonte = item(m.fontesDoMotor(), 0)
    const ganho = m.ganhoDe(fonte)
    expect(ganho.destino).toBe(aoVivo)
    expect(aoVivo.destino).toBe(m.audio.destination)
    expect(m.audio.filtros).toHaveLength(1) // só o passa-baixa dos sons de clima existe, e ele está fora do caminho
    for (const filtro of m.audio.filtros) expect([fonte, ganho, aoVivo]).not.toContain(filtro)
  })
})

describe('antes do gesto', () => {
  it(`nada toca antes do gesto; efeito curto esperando há ${ESPERA_DO_EFEITO_CURTO_MS} ms é descartado com 'sem-gesto'`, async () => {
    const m = montar({ estado: 'suspended', destravar: false })
    expect(m.motor.tocar('sino', m.arquivo(1, DEZ_SEGUNDOS), curto)).toEqual({ aceito: true })
    expect(m.eventos).toEqual([{ tipo: 'esperando', instancia: 'sino' }])
    await assentar()
    // Os bytes já vêm; decodificar e tocar, só depois do gesto.
    expect(m.carregarBytes).toHaveBeenCalledTimes(1)
    expect(m.audio.decodeAudioData).not.toHaveBeenCalled()
    expect(m.audio.fontes).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(ESPERA_DO_EFEITO_CURTO_MS - 1)
    expect(m.doTipo('recusado')).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(m.doTipo('recusado')).toEqual([{ tipo: 'recusado', instancia: 'sino', motivo: 'sem-gesto' }])

    m.gesto()
    await assentar()
    expect(m.fontesDoMotor()).toHaveLength(0)
  })

  it('contexto já criado mas suspenso de novo (tela bloqueada no celular): espera o próximo gesto em vez de tocar', async () => {
    const m = montar()
    m.audio.definirEstado('suspended')
    m.motor.tocar('chuva', m.arquivo(1, DEZ_SEGUNDOS), emLoop)
    await assentar()
    expect(m.eventos).toEqual([{ tipo: 'esperando', instancia: 'chuva' }])
    expect(m.fontesDoMotor()).toHaveLength(0)

    m.gesto()
    await assentar()
    expect(m.fontesDoMotor()).toHaveLength(1)
    expect(item(m.doTipo('tocando'), 0).instancia).toBe('chuva')
  })

  it('contexto suspenso que volta a rodar SEM gesto (o bipe do mestre o retomou) começa o loop que esperava', async () => {
    const m = montar()
    m.audio.definirEstado('suspended')
    m.motor.tocar('chuva', m.arquivo(1, DEZ_SEGUNDOS), emLoop)
    await assentar()
    expect(m.fontesDoMotor()).toHaveLength(0)
    void m.audio.ctx.resume()
    await assentar()
    expect(m.fontesDoMotor()).toHaveLength(1)
    expect(item(m.doTipo('tocando'), 0).instancia).toBe('chuva')
  })

  it('efeito curto pedido antes do gesto toca do começo se o gesto vier antes de 2 s', async () => {
    const m = montar({ estado: 'suspended', destravar: false })
    m.motor.tocar('sino', m.arquivo(1, DEZ_SEGUNDOS), curto)
    await vi.advanceTimersByTimeAsync(1500)
    m.gesto()
    await assentar()
    expect(item(m.fontesDoMotor(), 0).start).toHaveBeenCalledWith(0, 0)
    expect(m.doTipo('recusado')).toEqual([])
  })

  it('loop pedido antes do gesto fica esperando (não expira) e começa, com o deslocamento corrigido, quando o gesto destrava', async () => {
    const m = montar({ estado: 'suspended', destravar: false })
    m.motor.tocar('chuva', m.arquivo(1, DEZ_SEGUNDOS), { loop: true, deslocamentoS: 7, volumeDoEfeito: 0.8 })
    await vi.advanceTimersByTimeAsync(6000)
    expect(m.doTipo('recusado')).toEqual([])
    expect(m.audio.fontes).toHaveLength(0)

    m.gesto()
    await assentar()
    const fonte = item(m.fontesDoMotor(), 0)
    expect(fonte.loop).toBe(true)
    // (7 s pedidos + 6 s esperando) dão a volta nos 10 s do arquivo: começa em 3 s.
    expect(fonte.start.mock.calls[0]?.[1]).toBeCloseTo(3)
    expect(item(m.doTipo('tocando'), 0)).toMatchObject({ instancia: 'chuva', loop: true, duracaoS: 10 })
    expect(item(m.doTipo('tocando'), 0).deslocamentoS).toBeCloseTo(3)
  })
})

describe('carregamento e cache', () => {
  it('dois toques do mesmo arquivo ao mesmo tempo = UMA leitura de bytes e uma decodificação; pré-carga + toque também', async () => {
    const m = montar()
    const sino = m.arquivo(1, DEZ_SEGUNDOS)
    m.motor.tocar('a', sino, curto)
    m.motor.tocar('b', sino, curto)
    await assentar()
    expect(m.carregarBytes).toHaveBeenCalledTimes(1)
    expect(m.audio.decodeAudioData).toHaveBeenCalledTimes(1)
    expect(m.fontesDoMotor()).toHaveLength(2)

    const trovao = m.arquivo(2, DEZ_SEGUNDOS)
    if (trovao.tipo !== 'arquivo') throw new Error('fonte errada')
    m.motor.precarregar([trovao.ref.slice('midia:'.length), 'nao-e-id', '../../etc/passwd'])
    m.motor.tocar('c', trovao, curto)
    await assentar()
    expect(m.cargasDe(trovao)).toBe(1)
    expect(m.carregarBytes).toHaveBeenCalledTimes(2)

    // Do cache: nenhuma leitura nova.
    m.motor.tocar('d', sino, curto)
    await assentar()
    expect(m.carregarBytes).toHaveBeenCalledTimes(2)
  })

  it('até 1 MB fica decodificado; o corte por tamanho total descarta o MENOS USADO (que não está tocando)', async () => {
    const m = montar({ orcamento: 2 * CUSTO_DE_DEZ_SEGUNDOS + DEZ_SEGUNDOS })
    const [a, b, c] = [1, 2, 3].map((n) => m.arquivo(n, DEZ_SEGUNDOS))
    if (a === undefined || b === undefined || c === undefined) throw new Error('arquivos do teste')
    const tocarEParar = async (instancia: string, fonte: FonteDoSom): Promise<void> => {
      m.motor.tocar(instancia, fonte, curto)
      await assentar()
      m.motor.parar(instancia, 0)
    }
    await tocarEParar('a', a)
    await tocarEParar('b', b)
    await tocarEParar('a_de_novo', a) // A ficou mais usado que B
    await tocarEParar('c', c) // não cabem 3: sai B
    expect(m.audio.decodeAudioData).toHaveBeenCalledTimes(3)
    expect(m.criarUrlDoAudio).not.toHaveBeenCalled()
    expect(m.audio.elementosLigados).toHaveLength(0)

    await tocarEParar('a_terceira', a)
    expect(m.cargasDe(a)).toBe(1)
    await tocarEParar('b_de_novo', b)
    expect(m.cargasDe(b)).toBe(2)
  })

  it('acima de 1 MB toca por Blob num <audio> ligado ao Web Audio, com seek no deslocamento (o loop dá a volta)', async () => {
    const m = montar()
    const trilha = m.arquivo(9, 2 * MB, 'ogg')
    expect(2 * MB).toBeGreaterThan(DECODIFICADO_ATE_BYTES)
    m.motor.tocar('trilha', trilha, { loop: true, deslocamentoS: 130, volumeDoEfeito: 0.8 })
    await assentar()
    expect(m.criarUrlDoAudio).toHaveBeenCalledWith(expect.any(Uint8Array), 'audio/ogg')
    expect(m.audio.decodeAudioData).not.toHaveBeenCalled()
    const elemento = item(m.elementos, 0)
    expect(elemento.src).toBe(m.criarUrlDoAudio.mock.results[0]?.value)
    expect(elemento.loop).toBe(true)
    const ligado = item(m.audio.elementosLigados, 0)
    expect(ligado.elemento).toBe(elemento)
    expect(m.ganhoDe(ligado.no).destino).toBe(m.contexto.obterEntradaAoVivo())
    expect(elemento.play).not.toHaveBeenCalled()

    // Os metadados chegam 2 s depois: (130 + 2) dá a volta nos 120 s do arquivo.
    await vi.advanceTimersByTimeAsync(2000)
    elemento.disparar('loadedmetadata')
    expect(elemento.currentTime).toBeCloseTo(12)
    expect(elemento.play).toHaveBeenCalledTimes(1)
    await assentar() // 'tocando' só depois de o play() responder
    expect(item(m.doTipo('tocando'), 0)).toMatchObject({ instancia: 'trilha', duracaoS: 120 })

    // Efeito curto grande: começa exatamente no deslocamento pedido.
    m.motor.tocar('discurso', m.arquivo(10, 3 * MB), { loop: false, deslocamentoS: 30, volumeDoEfeito: 0.8 })
    await assentar()
    const outro = item(m.elementos, 1)
    outro.disparar('loadedmetadata')
    expect(outro.currentTime).toBe(30)
  })

  it('os bytes que não vêm viram recusa com motivo, sem derrubar ninguém', async () => {
    const m = montar()
    m.motor.tocar('sumiu', { tipo: 'arquivo', ref: `midia:${idDeAudio(77)}`, bytes: 10 }, curto)
    await assentar()
    expect(m.doTipo('recusado')).toEqual([{ tipo: 'recusado', instancia: 'sumiu', motivo: 'nao-carregou' }])
  })
})

/** O próximo `carregarBytes` só responde quando o teste chamar a função devolvida. */
function segurarBytes(m: ReturnType<typeof montar>): (bytes: Uint8Array) => void {
  let entregar: (bytes: Uint8Array) => void = () => undefined
  m.carregarBytes.mockImplementationOnce(
    () =>
      new Promise<Uint8Array>((resolve) => {
        entregar = resolve
      }),
  )
  return (bytes) => entregar(bytes)
}

describe('prazo do carregamento e desmontar', () => {
  it(`carregamento que nunca responde cai em ${PRAZO_DO_CARREGAMENTO_MS} ms: a voz é recusada, a vaga de loop volta e o mesmo arquivo pode ser pedido de novo`, async () => {
    const m = montar()
    m.carregarBytes.mockImplementationOnce(() => new Promise<Uint8Array>(() => undefined))
    const pendurado = m.arquivo(1, DEZ_SEGUNDOS)
    m.motor.tocar('pendurado', pendurado, emLoop)
    await vi.advanceTimersByTimeAsync(PRAZO_DO_CARREGAMENTO_MS - 1)
    expect(m.doTipo('recusado')).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(m.doTipo('recusado')).toEqual([{ tipo: 'recusado', instancia: 'pendurado', motivo: 'nao-carregou' }])
    for (let i = 0; i < MAX_LOOPS; i++) expect(m.motor.tocar(`loop_${i}`, m.arquivo(10 + i, DEZ_SEGUNDOS), emLoop)).toEqual({ aceito: true })
    m.motor.pararTudo()

    // O pedido em andamento foi limpo: um toque novo lê de novo, e toca.
    m.motor.tocar('de_novo', pendurado, curto)
    await assentar()
    expect(m.cargasDe(pendurado)).toBe(2)
    expect(m.doTipo('tocando').map((evento) => evento.instancia)).toContain('de_novo')
  })

  it(`efeito curto cujo áudio chega ${ESPERA_DO_EFEITO_CURTO_MS} ms ou mais depois do PEDIDO é descartado com 'atrasado'; o loop toca`, async () => {
    const m = montar()
    const entregarCurto = segurarBytes(m)
    m.motor.tocar('sino', m.arquivo(1, DEZ_SEGUNDOS), curto)
    const entregarLoop = segurarBytes(m)
    m.motor.tocar('chuva', m.arquivo(2, DEZ_SEGUNDOS), emLoop)
    await vi.advanceTimersByTimeAsync(ESPERA_DO_EFEITO_CURTO_MS)
    entregarCurto(new Uint8Array(DEZ_SEGUNDOS))
    entregarLoop(new Uint8Array(DEZ_SEGUNDOS))
    await assentar()
    expect(m.doTipo('recusado')).toEqual([{ tipo: 'recusado', instancia: 'sino', motivo: 'atrasado' }])
    expect(m.doTipo('tocando').map((evento) => evento.instancia)).toEqual(['chuva'])
    expect(m.fontesDoMotor()).toHaveLength(1)
  })

  it('arquivo grande que chega depois de desmontar não deixa URL de Blob viva', async () => {
    const m = montar()
    const entregar = segurarBytes(m)
    m.motor.tocar('trilha', m.arquivo(9, 2 * MB), emLoop)
    await assentar()
    m.motor.desmontar()
    entregar(new Uint8Array(2 * MB))
    await assentar()
    const revogadas = new Set(m.revogarUrl.mock.calls.map(([url]) => url))
    const vivas = m.criarUrlDoAudio.mock.results.map((resultado) => String(resultado.value)).filter((url) => !revogadas.has(url))
    expect(vivas).toEqual([])
    expect(m.elementos).toHaveLength(0)
  })
})

describe('o <audio> dos arquivos grandes', () => {
  /** Toca um arquivo de 2 MB e devolve o `<audio>` dele, antes dos metadados. */
  async function tocarGrande(m: ReturnType<typeof montar>, instancia: string, opcoes: OpcoesDoToqueAoVivo, n = 9): Promise<ElementoDeAudioFalso> {
    m.motor.tocar(instancia, m.arquivo(n, 2 * MB), opcoes)
    await assentar()
    return item(m.elementos, m.elementos.length - 1)
  }
  const semGesto = (): DOMException => new DOMException('o navegador quer um gesto', 'NotAllowedError')

  it("só avisa 'tocando' quando o play() dá certo", async () => {
    const m = montar()
    const elemento = await tocarGrande(m, 'trilha', emLoop)
    let liberar: () => void = () => undefined
    elemento.play.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          liberar = resolve
        }),
    )
    elemento.disparar('loadedmetadata')
    expect(elemento.play).toHaveBeenCalledTimes(1)
    await assentar()
    expect(m.doTipo('tocando')).toEqual([])
    liberar()
    await assentar()
    expect(m.doTipo('tocando').map((evento) => evento.instancia)).toEqual(['trilha'])
  })

  it('loop recusado por falta de gesto (NotAllowedError) não avisa que tocou e ESPERA o próximo gesto em vez de ser descartado', async () => {
    const m = montar()
    const elemento = await tocarGrande(m, 'trilha', emLoop)
    elemento.play.mockRejectedValueOnce(semGesto())
    elemento.disparar('loadedmetadata')
    await assentar()
    expect(m.doTipo('tocando')).toEqual([])
    expect(m.doTipo('recusado')).toEqual([])
    expect(m.eventos).toContainEqual({ tipo: 'esperando', instancia: 'trilha' })
    expect(elemento.pause).toHaveBeenCalled()
    // Loop não expira, por mais que espere.
    await vi.advanceTimersByTimeAsync(10 * ESPERA_DO_EFEITO_CURTO_MS)
    expect(m.doTipo('recusado')).toEqual([])

    // O próximo destravamento toca num <audio> novo; o antigo não mexe mais na voz.
    m.audio.definirEstado('suspended')
    m.gesto()
    await assentar()
    const novo = item(m.elementos, 1)
    novo.disparar('loadedmetadata')
    await assentar()
    expect(m.doTipo('tocando').map((evento) => evento.instancia)).toEqual(['trilha'])
    elemento.disparar('error')
    expect(m.doTipo('recusado')).toEqual([])
  })

  it("efeito curto recusado por falta de gesto segue a regra dos 2 s desde o pedido: espera o resto e cai como 'sem-gesto'", async () => {
    const m = montar()
    const elemento = await tocarGrande(m, 'grito', curto)
    elemento.play.mockRejectedValueOnce(semGesto())
    await vi.advanceTimersByTimeAsync(500)
    elemento.disparar('loadedmetadata')
    await assentar()
    expect(m.doTipo('recusado')).toEqual([])
    await vi.advanceTimersByTimeAsync(ESPERA_DO_EFEITO_CURTO_MS - 500 - 1)
    expect(m.doTipo('recusado')).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(m.doTipo('recusado')).toEqual([{ tipo: 'recusado', instancia: 'grito', motivo: 'sem-gesto' }])
    expect(m.doTipo('tocando')).toEqual([])
  })

  it("efeito curto recusado por falta de gesto DEPOIS dos 2 s cai na hora como 'sem-gesto', sem pedir o toque", async () => {
    const m = montar()
    const elemento = await tocarGrande(m, 'grito', curto)
    elemento.play.mockRejectedValueOnce(semGesto())
    await vi.advanceTimersByTimeAsync(ESPERA_DO_EFEITO_CURTO_MS + 500)
    elemento.disparar('loadedmetadata')
    await assentar()
    expect(m.eventos).toEqual([{ tipo: 'recusado', instancia: 'grito', motivo: 'sem-gesto' }])
  })

  it("outro erro do play() vira 'nao-carregou', e o evento 'error' do <audio> também", async () => {
    const m = montar()
    const a = await tocarGrande(m, 'a', curto, 9)
    a.play.mockRejectedValueOnce(new Error('formato não suportado'))
    a.disparar('loadedmetadata')
    const b = await tocarGrande(m, 'b', emLoop, 10)
    b.disparar('error')
    await assentar()
    expect(m.doTipo('recusado')).toHaveLength(2)
    expect(m.doTipo('recusado')).toContainEqual({ tipo: 'recusado', instancia: 'a', motivo: 'nao-carregou' })
    expect(m.doTipo('recusado')).toContainEqual({ tipo: 'recusado', instancia: 'b', motivo: 'nao-carregou' })
    expect(m.doTipo('tocando')).toEqual([])
  })
})

describe('parar', () => {
  it(`Parar desce o ganho até 0 em ${FADE_AO_PARAR_MS} ms e só então para a fonte`, async () => {
    const m = montar({ volume: 0.5 })
    m.motor.tocar('sino', m.arquivo(1, DEZ_SEGUNDOS), curto)
    await assentar()
    const fonte = item(m.fontesDoMotor(), 0)
    const ganho = m.ganhoDe(fonte)
    m.audio.avancar(1)
    const agoraS = m.audio.ctx.currentTime

    m.motor.parar('sino')
    expect(ganho.gain.cancelScheduledValues).toHaveBeenLastCalledWith(agoraS)
    expect(ganho.gain.setValueAtTime).toHaveBeenLastCalledWith(0.2, agoraS)
    const [alvo, quando] = ganho.gain.linearRampToValueAtTime.mock.lastCall ?? []
    expect(alvo).toBe(0)
    expect(quando).toBeCloseTo(agoraS + FADE_AO_PARAR_MS / 1000)
    expect(fonte.stop.mock.calls[0]?.[0]).toBeCloseTo(agoraS + FADE_AO_PARAR_MS / 1000)
    expect(item(m.eventos, m.eventos.length - 1)).toEqual({ tipo: 'terminou', instancia: 'sino', motivo: 'parado' })

    // O fim da fonte depois do stop solta o nó e não vira um segundo "terminou".
    fonte.terminar()
    expect(ganho.disconnect).toHaveBeenCalled()
    expect(m.doTipo('terminou')).toHaveLength(1)
  })

  it(`pelo <audio>: o elemento só pausa no fim dos ${FADE_AO_PARAR_MS} ms (relógio falso)`, async () => {
    const m = montar()
    m.motor.tocar('trilha', m.arquivo(9, 2 * MB), emLoop)
    await assentar()
    const elemento = item(m.elementos, 0)
    elemento.disparar('loadedmetadata')

    m.motor.parar('trilha')
    expect(elemento.pause).not.toHaveBeenCalled()
    vi.advanceTimersByTime(FADE_AO_PARAR_MS - 1)
    expect(elemento.pause).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(elemento.pause).toHaveBeenCalledTimes(1)
  })

  it('pararTudo para todos com fade, e as vagas voltam', async () => {
    const m = montar()
    m.motor.tocar('chuva', m.arquivo(1, DEZ_SEGUNDOS), emLoop)
    m.motor.tocar('vento', m.arquivo(2, DEZ_SEGUNDOS), emLoop)
    m.motor.tocar('sino', m.arquivo(3, DEZ_SEGUNDOS), curto)
    await assentar()
    const agoraS = m.audio.ctx.currentTime

    m.motor.pararTudo()
    expect(m.doTipo('terminou').map((evento) => [evento.instancia, evento.motivo])).toEqual([
      ['chuva', 'parado'],
      ['vento', 'parado'],
      ['sino', 'parado'],
    ])
    for (const fonte of m.fontesDoMotor()) expect(fonte.stop.mock.calls[0]?.[0]).toBeCloseTo(agoraS + FADE_AO_PARAR_MS / 1000)
    for (let i = 0; i < MAX_LOOPS; i++) expect(m.motor.tocar(`loop_${i}`, m.arquivo(10 + i, DEZ_SEGUNDOS), emLoop)).toEqual({ aceito: true })
  })
})

describe('entradas tortas e o motor do navegador', () => {
  it('YouTube fica para a F6 e referência que não é de áudio guardado é recusada, cada uma com motivo', () => {
    const m = montar()
    const video = 'dQw4w9WgXcQ'
    if (!ehVideoDoYoutube(video)) throw new Error('vídeo inválido no teste')
    expect(m.motor.tocar('clipe', { tipo: 'youtube', video }, curto)).toEqual({ aceito: false, motivo: 'fonte-sem-suporte' })
    const foraDaMidia: FonteDoSom = { tipo: 'arquivo', ref: 'midia:../../segredo.mp3', bytes: 1 }
    expect(m.motor.tocar('torto', foraDaMidia, curto)).toEqual({ aceito: false, motivo: 'fonte-invalida' })
    expect(m.carregarBytes).not.toHaveBeenCalled()
    expect(m.doTipo('recusado').map((evento) => evento.motivo)).toEqual(['fonte-sem-suporte', 'fonte-invalida'])
  })

  it('no jsdom (sem Web Audio) o motor do navegador não lança: o toque espera o gesto, e desmontar solta tudo', () => {
    const carregar = vi.fn(async (_id: string) => new Uint8Array(DEZ_SEGUNDOS))
    const motor = criarMotorAoVivoDoNavegador(carregar)
    const eventos: EventoDoMotor[] = []
    motor.assinar((evento) => eventos.push(evento))
    expect(motor.tocar('sino', { tipo: 'arquivo', ref: `midia:${idDeAudio(1)}`, bytes: DEZ_SEGUNDOS }, curto)).toEqual({ aceito: true })
    expect(eventos).toEqual([{ tipo: 'esperando', instancia: 'sino' }])
    motor.desmontar()
    expect(item(eventos, 1)).toEqual({ tipo: 'terminou', instancia: 'sino', motivo: 'parado' })
  })
})
