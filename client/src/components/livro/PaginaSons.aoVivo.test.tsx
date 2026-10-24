import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MotorAoVivo } from '../../lib/sons/aoVivo/motor'
import type { RedeDosSons } from '../../net/ponteDosSons'

/*
 * A PÁGINA SONS na sala (sons ao vivo, F5; contrato em
 * `docs/planos/sons-f5-plano-tecnico-2026-10-23.md`, seção 3): o clique toca
 * no computador do mestre E na mesa, pela ponte, com o alvo Todos; parar,
 * Parar tudo e o volume chegam à mesa; a mesa recusar o 4º loop vira o mesmo
 * aviso do motor; os favoritos de até 1 MB são pré-carregados ao abrir a sala
 * e ao carregar a biblioteca (com o alvo, sempre); a pasta da aventura vai à
 * ponte. O motor e a rede são de mentira; a biblioteca e a aventura, de verdade
 * sobre o disco de mentira.
 */

vi.mock('@tauri-apps/plugin-fs', async () => (await import('../../lib/sons/discoFalso.fixture')).fsFalso)
vi.mock('@tauri-apps/api/path', async () => (await import('../../lib/sons/discoFalso.fixture')).pathFalso)

const { fsFalso, limparDisco } = await import('../../lib/sons/discoFalso.fixture')
const { useAdventureStore } = await import('../../stores/adventureStore')
const { useBibliotecaDeSonsStore } = await import('../../stores/bibliotecaDeSonsStore')
const { useToastStore } = await import('../../stores/toastStore')
const { registrarRedeDosSons } = await import('../../net/ponteDosSons')
const { midiasParaPreCarregar, PaginaSons, PRE_CARGA_MAX_BYTES } = await import('./PaginaSons')
const { PRE_CARGA_MAX_ARQUIVOS } = await import('../../lib/sons/aoVivo/motor')
const { SOM_PRECARGA_MAX } = await import('../../net/protocol')
type EfeitoDeSom = import('../../lib/sons/biblioteca').EfeitoDeSom

const AVENTURA = 'C:/aventuras/farol'
const MB = 1024 * 1024
const TODOS = { tipo: 'todos' }
const idDe = (letra: string, ext = 'mp3') => `${letra.repeat(64)}.${ext}`

const efeito = (id: string, letra: string, extras: Partial<EfeitoDeSom> = {}): EfeitoDeSom => ({
  id,
  nome: `Som ${id}`,
  fonte: { tipo: 'arquivo', ref: `midia:${idDe(letra)}`, bytes: 200 * 1024 },
  volume: 0.6,
  loop: false,
  pastaId: null,
  ordem: 0,
  ...extras,
})

const CHUVA = efeito('chuva', 'a', { loop: true, favorito: true })
const GRITO = efeito('grito', 'b', { favorito: true, ordem: 1 })
const TROVAO = efeito('trovao', 'c', { favorito: true, ordem: 2, fonte: { tipo: 'arquivo', ref: `midia:${idDe('c')}`, bytes: 3 * MB } })
const PASSOS = efeito('passos', 'd', { ordem: 3 })

function motorFalso() {
  return {
    tocar: vi.fn<MotorAoVivo['tocar']>(() => ({ aceito: true })),
    parar: vi.fn<MotorAoVivo['parar']>(),
    pararTudo: vi.fn<MotorAoVivo['pararTudo']>(),
    mudarVolume: vi.fn<MotorAoVivo['mudarVolume']>(),
    precarregar: vi.fn<MotorAoVivo['precarregar']>(),
    assinar: vi.fn<MotorAoVivo['assinar']>(() => () => undefined),
    desmontar: vi.fn<MotorAoVivo['desmontar']>(),
  } satisfies MotorAoVivo
}

/** O ouvinte que a página assinou no motor de mentira: o teste manda os eventos por ele. */
function ouvirOMotor(motor: ReturnType<typeof motorFalso>): { atual: Parameters<MotorAoVivo['assinar']>[0] | null } {
  const ouvinte: { atual: Parameters<MotorAoVivo['assinar']>[0] | null } = { atual: null }
  motor.assinar.mockImplementation((novo) => {
    ouvinte.atual = novo
    return () => undefined
  })
  return ouvinte
}

function redeFalsa(tocar: RedeDosSons['tocarSomAoVivo'] = () => ({ ok: true, enviados: 2 })) {
  return {
    tocarSomAoVivo: vi.fn<RedeDosSons['tocarSomAoVivo']>(tocar),
    pararSomAoVivo: vi.fn<RedeDosSons['pararSomAoVivo']>(() => 2),
    pararTodosOsSons: vi.fn<RedeDosSons['pararTodosOsSons']>(() => 2),
    volumeDoSom: vi.fn<RedeDosSons['volumeDoSom']>(() => 2),
    precarregarSonsAoVivo: vi.fn<RedeDosSons['precarregarSonsAoVivo']>(() => 2),
    falhasDoSom: vi.fn<RedeDosSons['falhasDoSom']>(() => 0),
    midiasDeSomLiberadas: vi.fn<RedeDosSons['midiasDeSomLiberadas']>(() => []),
    mudarPastaDosSons: vi.fn<RedeDosSons['mudarPastaDosSons']>(),
  } satisfies RedeDosSons
}

let container: HTMLDivElement
let root: Root
const desfazer: (() => void)[] = []

async function assentar(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5))
  })
}

async function esperar(conferir: () => void, prazoMs = 3000): Promise<void> {
  const fim = Date.now() + prazoMs
  for (;;) {
    await assentar()
    try {
      conferir()
      return
    } catch (erro) {
      if (Date.now() > fim) throw erro
    }
  }
}

/** A aventura aberta com a biblioteca lida, e então os efeitos postos na biblioteca. */
async function abrirComSons(efeitos: EfeitoDeSom[]): Promise<void> {
  fsFalso.mkdir(AVENTURA)
  useAdventureStore.setState({ adventure: { version: 1, id: 'adv_farol', name: 'Farol', startSceneId: 'scene_1', scenes: [{ id: 'scene_1', name: 'Praia', file: 'map.json' }] }, dir: AVENTURA })
  await esperar(() => expect(useBibliotecaDeSonsStore.getState()).toMatchObject({ aventuraId: 'adv_farol', carregando: false }))
  await act(async () => {
    useBibliotecaDeSonsStore.setState((antes) => ({ biblioteca: { ...antes.biblioteca, efeitos } }))
  })
}

async function montar(motor: MotorAoVivo): Promise<void> {
  await act(async () => root.render(<PaginaSons motor={motor} medirMidia={async () => new Map()} />))
}

const botaoDo = (nome: string): HTMLButtonElement => {
  const botao = [...container.querySelectorAll<HTMLButtonElement>('.lb-efeito__tocar')].find((candidato) => candidato.title === nome)
  if (botao === undefined) throw new Error(`sem botão para ${nome}`)
  return botao
}

const clicar = async (botao: HTMLElement) => {
  await act(async () => {
    botao.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
  })
}

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  limparDisco()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  for (const tirar of desfazer.splice(0)) tirar()
  useAdventureStore.setState({ adventure: null, dir: null })
  await assentar()
  useToastStore.setState({ toasts: [] })
})

describe('Página Sons na sala: a ponte leva o som à mesa', () => {
  it('o clique toca aqui e na mesa com o alvo Todos; o mesmo botão no loop tocando para nos dois', async () => {
    const motor = motorFalso()
    const ouvinte = ouvirOMotor(motor)
    const rede = redeFalsa()
    desfazer.push(registrarRedeDosSons(rede))
    await montar(motor)
    await abrirComSons([CHUVA, GRITO])
    await clicar(botaoDo(GRITO.nome))
    expect(motor.tocar).toHaveBeenCalledWith('grito', GRITO.fonte, { loop: false, volumeDoEfeito: 0.6 })
    expect(rede.tocarSomAoVivo).toHaveBeenCalledTimes(1)
    const [pedido, alvo] = rede.tocarSomAoVivo.mock.calls[0] ?? []
    expect(alvo).toEqual(TODOS)
    expect(pedido).toMatchObject({ fonte: { tipo: 'arquivo', midia: idDe('b') }, volume: 0.6, loop: false })
    // Nada do nome nem do id da biblioteca vai à rede.
    expect(JSON.stringify(pedido)).not.toContain('grito')

    // O loop tocando: o mesmo botão para aqui e na mesa, pelo apelido que foi à rede.
    await clicar(botaoDo(CHUVA.nome))
    const [pedidoDaChuva] = rede.tocarSomAoVivo.mock.calls[1] ?? []
    if (pedidoDaChuva === undefined) throw new Error('a chuva não foi à mesa')
    await act(async () => ouvinte.atual?.({ tipo: 'tocando', instancia: 'chuva', loop: true, duracaoS: 10, deslocamentoS: 0, inicioEmMs: performance.now() }))
    await clicar(botaoDo(CHUVA.nome))
    expect(motor.parar).toHaveBeenCalledWith('chuva')
    expect(rede.pararSomAoVivo).toHaveBeenCalledWith(pedidoDaChuva.instancia)
    expect(rede.tocarSomAoVivo).toHaveBeenCalledTimes(2)
  })

  it('o motor daqui recusa DEPOIS do clique (o arquivo não abriu neste computador): a mesa para o loop também', async () => {
    const motor = motorFalso()
    const ouvinte = ouvirOMotor(motor)
    const rede = redeFalsa()
    desfazer.push(registrarRedeDosSons(rede))
    await montar(motor)
    await abrirComSons([CHUVA])
    await clicar(botaoDo(CHUVA.nome))
    const [pedido] = rede.tocarSomAoVivo.mock.calls[0] ?? []
    if (pedido === undefined) throw new Error('a chuva não foi à mesa')
    expect(rede.pararSomAoVivo).not.toHaveBeenCalled()
    await act(async () => ouvinte.atual?.({ tipo: 'recusado', instancia: 'chuva', motivo: 'nao-carregou' }))
    expect(rede.pararSomAoVivo).toHaveBeenCalledWith(pedido.instancia)
    expect(useToastStore.getState().toasts.map((aviso) => aviso.text)).toContain('Som chuva não tocou: o arquivo não abriu neste computador.')
  })

  it('trocar de aventura e sair da página param aqui e na mesa; sair tira a pasta da ponte', async () => {
    const motor = motorFalso()
    const rede = redeFalsa()
    desfazer.push(registrarRedeDosSons(rede))
    await montar(motor)
    await abrirComSons([CHUVA])
    await clicar(botaoDo(CHUVA.nome))
    const antesNaMesa = rede.pararTodosOsSons.mock.calls.length
    const antesAqui = motor.pararTudo.mock.calls.length
    fsFalso.mkdir('C:/aventuras/outra')
    await act(async () => {
      useAdventureStore.setState({ adventure: { version: 1, id: 'adv_outra', name: 'Outra', startSceneId: 'scene_1', scenes: [{ id: 'scene_1', name: 'Cais', file: 'map.json' }] }, dir: 'C:/aventuras/outra' })
    })
    expect(rede.pararTodosOsSons).toHaveBeenCalledTimes(antesNaMesa + 1)
    expect(motor.pararTudo).toHaveBeenCalledTimes(antesAqui + 1)

    await act(async () => root.render(<div />))
    expect(rede.pararTodosOsSons).toHaveBeenCalledTimes(antesNaMesa + 2)
    expect(motor.pararTudo).toHaveBeenCalledTimes(antesAqui + 2)
    expect(rede.mudarPastaDosSons).toHaveBeenLastCalledWith(null)
  })

  it('Parar tudo para aqui e na mesa', async () => {
    const motor = motorFalso()
    let ouvinte: Parameters<MotorAoVivo['assinar']>[0] | null = null
    motor.assinar.mockImplementation((novo) => {
      ouvinte = novo
      return () => undefined
    })
    const rede = redeFalsa()
    desfazer.push(registrarRedeDosSons(rede))
    await montar(motor)
    await abrirComSons([CHUVA])
    await clicar(botaoDo(CHUVA.nome))
    await act(async () => ouvinte?.({ tipo: 'tocando', instancia: 'chuva', loop: true, duracaoS: 10, deslocamentoS: 0, inicioEmMs: performance.now() }))
    const parar = [...container.querySelectorAll('button')].find((botao) => botao.textContent?.includes('Parar tudo'))
    if (parar === undefined) throw new Error('sem Parar tudo')
    // Abrir a aventura já parou tudo uma vez (troca de aventura); o que conta é o clique.
    const antesMotor = motor.pararTudo.mock.calls.length
    const antesRede = rede.pararTodosOsSons.mock.calls.length
    await clicar(parar)
    expect(motor.pararTudo).toHaveBeenCalledTimes(antesMotor + 1)
    expect(rede.pararTodosOsSons).toHaveBeenCalledTimes(antesRede + 1)
  })

  it('o volume do lápis e o apagar chegam à mesa; o Ouvir do lápis fica só aqui', async () => {
    const motor = motorFalso()
    const rede = redeFalsa()
    desfazer.push(registrarRedeDosSons(rede))
    await montar(motor)
    await abrirComSons([GRITO])
    await clicar(botaoDo(GRITO.nome))
    const [pedido] = rede.tocarSomAoVivo.mock.calls[0] ?? []
    const lapis = container.querySelector<HTMLButtonElement>(`button[aria-label="Editar ${GRITO.nome}"]`)
    if (lapis === null || pedido === undefined) throw new Error('sem lápis ou sem toque na mesa')
    await clicar(lapis)
    const ouvir = [...document.querySelectorAll<HTMLButtonElement>('button')].find((botao) => botao.getAttribute('aria-label') === `Ouvir ${GRITO.nome}`)
    if (ouvir === undefined) throw new Error('sem Ouvir no lápis')
    await clicar(ouvir)
    expect(motor.tocar).toHaveBeenCalledTimes(2)
    expect(rede.tocarSomAoVivo).toHaveBeenCalledTimes(1)
    const volume = document.querySelector<HTMLInputElement>('.lb-sons-editor__volume input[type="range"]')
    if (volume === null) throw new Error('sem a faixa de volume')
    await act(async () => {
      const definir = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      definir?.call(volume, '30')
      volume.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(rede.volumeDoSom).toHaveBeenCalledWith(pedido.instancia, 0.3)

    // Apagar o som para o toque dele na mesa também, pelo apelido.
    expect(rede.pararSomAoVivo).not.toHaveBeenCalled()
    const botaoComTexto = (texto: string): HTMLButtonElement => {
      const botao = [...document.querySelectorAll<HTMLButtonElement>('button')].find((candidato) => candidato.textContent?.trim() === texto)
      if (botao === undefined) throw new Error(`sem o botão ${texto}`)
      return botao
    }
    await clicar(botaoComTexto('Apagar som…'))
    await clicar(botaoComTexto('Apagar'))
    expect(useBibliotecaDeSonsStore.getState().biblioteca.efeitos).toEqual([])
    expect(motor.parar).toHaveBeenCalledWith('grito')
    expect(rede.pararSomAoVivo).toHaveBeenCalledWith(pedido.instancia)
  })

  it('a mesa recusa o 4º loop: o mestre vê o mesmo aviso do motor', async () => {
    const rede = redeFalsa(() => ({ ok: false, motivo: 'limite-de-loops' }))
    desfazer.push(registrarRedeDosSons(rede))
    await montar(motorFalso())
    await abrirComSons([CHUVA])
    await clicar(botaoDo(CHUVA.nome))
    expect(useToastStore.getState().toasts.map((aviso) => aviso.text)).toContain('Som chuva não tocou: já há 3 sons repetindo. Pare um deles antes.')
  })

  it('pré-carga: os favoritos de até 1 MB, com o alvo Todos, ao abrir a sala e ao carregar a biblioteca', async () => {
    await montar(motorFalso())
    await abrirComSons([CHUVA, GRITO, TROVAO, PASSOS])
    const rede = redeFalsa()
    // A sala abre com a página já montada.
    await act(async () => {
      desfazer.push(registrarRedeDosSons(rede))
    })
    await esperar(() => expect(rede.precarregarSonsAoVivo).toHaveBeenCalled())
    expect(rede.precarregarSonsAoVivo.mock.calls.at(-1)).toEqual([[idDe('a'), idDe('b')], TODOS])
    // A biblioteca muda (um favorito novo, pequeno): a pré-carga é trocada.
    const SINO = efeito('sino', 'e', { favorito: true, ordem: 4 })
    await act(async () => {
      useBibliotecaDeSonsStore.setState((antes) => ({ biblioteca: { ...antes.biblioteca, efeitos: [...antes.biblioteca.efeitos, SINO] } }))
    })
    await esperar(() => expect(rede.precarregarSonsAoVivo.mock.calls.at(-1)).toEqual([[idDe('a'), idDe('b'), idDe('e')], TODOS]))
    const vezes = rede.precarregarSonsAoVivo.mock.calls.length
    // Mexer no que não muda a lista (o volume de um favorito) não manda de novo.
    await act(async () => {
      useBibliotecaDeSonsStore.setState((antes) => ({ biblioteca: { ...antes.biblioteca, efeitos: antes.biblioteca.efeitos.map((e) => (e.id === 'grito' ? { ...e, volume: 0.9 } : e)) } }))
    })
    await assentar()
    expect(rede.precarregarSonsAoVivo).toHaveBeenCalledTimes(vezes)
  })

  it('a pasta da aventura vai à ponte da sala', async () => {
    const rede = redeFalsa()
    desfazer.push(registrarRedeDosSons(rede))
    await montar(motorFalso())
    await abrirComSons([GRITO])
    await esperar(() => expect(rede.mudarPastaDosSons).toHaveBeenLastCalledWith(AVENTURA))
  })

  it(`pré-carga: 33 favoritos pequenos viram só ${PRE_CARGA_MAX_ARQUIVOS}, na ordem; 1 MB exato entra e 1 MB + 1 byte não`, () => {
    const hex = (n: number) => `${n.toString(16).padStart(64, '0')}.mp3`
    const favoritos = Array.from({ length: 33 }, (_, i) =>
      efeito(`f${i}`, 'a', { favorito: true, ordem: i, fonte: { tipo: 'arquivo', ref: `midia:${hex(i + 1)}`, bytes: i === 0 ? PRE_CARGA_MAX_BYTES : i === 1 ? PRE_CARGA_MAX_BYTES + 1 : 1024 } }),
    )
    const midias = midiasParaPreCarregar({ versao: 1, pastas: [], efeitos: favoritos })
    expect(midias).toHaveLength(PRE_CARGA_MAX_ARQUIVOS)
    expect(midias).toEqual([hex(1), hex(3), hex(4), hex(5)])
    expect(midias.length).toBeLessThan(SOM_PRECARGA_MAX)
  })

  it('sem sala, o som toca só aqui e nada vai à rede', async () => {
    const motor = motorFalso()
    await montar(motor)
    await abrirComSons([GRITO])
    await clicar(botaoDo(GRITO.nome))
    expect(motor.tocar).toHaveBeenCalledTimes(1)
  })
})
