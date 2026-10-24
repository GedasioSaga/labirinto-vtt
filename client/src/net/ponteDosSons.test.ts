/**
 * SONS AO VIVO, fatia F4: a ponte que liga o motor do mestre à rede. O som
 * toca no computador do mestre (se "Tocar neste computador") e vai à mesa pela
 * ponte da sala, registrada só com a sala aberta. À rede vai um apelido
 * sorteado (nunca o id da biblioteca) e o id do áudio; o nome nunca.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MotorAoVivo } from '../lib/sons/aoVivo/motor'
import { ehVideoDoYoutube, type EfeitoDeSom } from '../lib/sons/biblioteca'
import { assinarRedeDosSons, avisarFalhaDeSom, criarPonteDosSons, fonteDeSomNaRede, redeDosSons, registrarRedeDosSons, type RedeDosSons } from './ponteDosSons'

const ID = `${'c'.repeat(64)}.wav`

const efeito = (id: string, loop = false): EfeitoDeSom => ({
  id,
  nome: 'Grito do Lich',
  fonte: { tipo: 'arquivo', ref: `midia:${ID}`, bytes: 1234 },
  volume: 0.7,
  loop,
  pastaId: 'pasta-chefes',
  ordem: 0,
})

function motorFalso(recusa?: 'limite-de-loops') {
  const motor = {
    tocar: vi.fn<MotorAoVivo['tocar']>(() => (recusa === undefined ? { aceito: true } : { aceito: false, motivo: recusa })),
    parar: vi.fn<MotorAoVivo['parar']>(),
    pararTudo: vi.fn<MotorAoVivo['pararTudo']>(),
    mudarVolume: vi.fn<MotorAoVivo['mudarVolume']>(),
    precarregar: vi.fn<MotorAoVivo['precarregar']>(),
    assinar: vi.fn<MotorAoVivo['assinar']>(() => () => undefined),
    desmontar: vi.fn<MotorAoVivo['desmontar']>(),
  } satisfies MotorAoVivo
  return motor
}

function redeFalsa() {
  const rede = {
    tocarSomAoVivo: vi.fn<RedeDosSons['tocarSomAoVivo']>(() => ({ ok: true, enviados: 2 })),
    pararSomAoVivo: vi.fn<RedeDosSons['pararSomAoVivo']>(() => 2),
    pararTodosOsSons: vi.fn<RedeDosSons['pararTodosOsSons']>(() => 2),
    volumeDoSom: vi.fn<RedeDosSons['volumeDoSom']>(() => 2),
    precarregarSonsAoVivo: vi.fn<RedeDosSons['precarregarSonsAoVivo']>(() => 2),
    falhasDoSom: vi.fn<RedeDosSons['falhasDoSom']>(() => 0),
    midiasDeSomLiberadas: vi.fn<RedeDosSons['midiasDeSomLiberadas']>(() => []),
    // A rede ganhou a pasta da aventura na F5 (coberta em ponteDosSons.pasta.test.ts).
    mudarPastaDosSons: vi.fn<RedeDosSons['mudarPastaDosSons']>(),
  } satisfies RedeDosSons
  return rede
}

const apelidos = () => {
  let n = 0
  return () => `apelido-${++n}`
}

describe('registro da rede dos sons', () => {
  let tirar: (() => void) | null = null
  afterEach(() => {
    tirar?.()
    tirar = null
  })

  it('a sala registra, quem assina é avisado, e tirar o registro só vale para a própria ponte', () => {
    const ouvinte = vi.fn()
    const desassinar = assinarRedeDosSons(ouvinte)
    const primeira = redeFalsa()
    const tirarPrimeira = registrarRedeDosSons(primeira)
    expect(redeDosSons()).toBe(primeira)
    const segunda = redeFalsa()
    tirar = registrarRedeDosSons(segunda)
    // A ponte velha saindo não derruba a nova.
    tirarPrimeira()
    expect(redeDosSons()).toBe(segunda)
    avisarFalhaDeSom()
    expect(ouvinte).toHaveBeenCalledTimes(3)
    tirar()
    tirar = null
    expect(redeDosSons()).toBeNull()
    desassinar()
  })
})

describe('criarPonteDosSons', () => {
  it('toca no mestre pelo id da biblioteca e manda à rede só apelido, id do áudio, volume e loop', () => {
    const motor = motorFalso()
    const rede = redeFalsa()
    const ponte = criarPonteDosSons({ motor, rede: () => rede, novaInstancia: apelidos() })
    const resultado = ponte.tocar(efeito('som_1', true), { tipo: 'cena', sceneId: 's-taverna' }, { local: true })
    expect(resultado).toEqual({ local: { aceito: true }, rede: { ok: true, enviados: 2 } })
    expect(motor.tocar).toHaveBeenCalledWith('som_1', efeito('som_1', true).fonte, { loop: true, volumeDoEfeito: 0.7 })
    expect(rede.tocarSomAoVivo).toHaveBeenCalledWith({ instancia: 'apelido-1', fonte: { tipo: 'arquivo', midia: ID }, volume: 0.7, loop: true }, { tipo: 'cena', sceneId: 's-taverna' })
    expect(JSON.stringify(rede.tocarSomAoVivo.mock.calls)).not.toMatch(/Lich|som_1|pasta-chefes|midia:/)
  })

  it('o mesmo efeito tem sempre o mesmo apelido (tocar de novo troca o toque nos dois lados); outro efeito, outro', () => {
    const rede = redeFalsa()
    const ponte = criarPonteDosSons({ motor: motorFalso(), rede: () => rede, novaInstancia: apelidos() })
    ponte.tocar(efeito('som_1'), { tipo: 'todos' }, { local: true })
    ponte.tocar(efeito('som_1'), { tipo: 'todos' }, { local: true })
    ponte.tocar(efeito('som_2'), { tipo: 'todos' }, { local: true })
    expect(rede.tocarSomAoVivo.mock.calls.map(([pedido]) => pedido.instancia)).toEqual(['apelido-1', 'apelido-1', 'apelido-2'])
  })

  it('o que o motor do mestre recusa na hora (4º loop) não vai à mesa', () => {
    const rede = redeFalsa()
    const ponte = criarPonteDosSons({ motor: motorFalso('limite-de-loops'), rede: () => rede })
    expect(ponte.tocar(efeito('som_1', true), { tipo: 'todos' }, { local: true })).toEqual({ local: { aceito: false, motivo: 'limite-de-loops' }, rede: null })
    expect(rede.tocarSomAoVivo).not.toHaveBeenCalled()
  })

  it('"Tocar neste computador" desligado: só a rede', () => {
    const motor = motorFalso()
    const rede = redeFalsa()
    const ponte = criarPonteDosSons({ motor, rede: () => rede })
    expect(ponte.tocar(efeito('som_1'), { tipo: 'todos' }, { local: false })).toEqual({ local: null, rede: { ok: true, enviados: 2 } })
    expect(motor.tocar).not.toHaveBeenCalled()
  })

  it('sem sala: só o mestre ouve; o YouTube vai pela rede só como id do vídeo e trecho (F6)', () => {
    const motor = motorFalso()
    const semSala = criarPonteDosSons({ motor, rede: () => null })
    expect(semSala.tocar(efeito('som_1'), { tipo: 'todos' }, { local: true })).toEqual({ local: { aceito: true }, rede: null })
    const video = 'dQw4w9WgXcQ'
    if (!ehVideoDoYoutube(video)) throw new Error('id de vídeo válido')
    const rede = redeFalsa()
    const comSala = criarPonteDosSons({ motor, rede: () => rede, novaInstancia: apelidos() })
    comSala.tocar({ ...efeito('som_yt'), nome: 'Bardo da Taverna', fonte: { tipo: 'youtube', video, inicioS: 42, fimS: 90 } }, { tipo: 'todos' }, { local: true })
    expect(rede.tocarSomAoVivo).toHaveBeenCalledWith(expect.objectContaining({ instancia: 'apelido-1', fonte: { tipo: 'youtube', video, inicioS: 42, fimS: 90 } }), { tipo: 'todos' })
    // Nunca o link nem o nome: só o id de 11 caracteres atravessa.
    expect(JSON.stringify(rede.tocarSomAoVivo.mock.calls)).not.toMatch(/youtube\.com|youtu\.be|https?:|Bardo|som_yt/)
  })

  it('YouTube com id torto (vindo de fora do validador) não vira fonte da rede', () => {
    // O JSON cru passa por cima do tipo (o `Object.assign` com `unknown` não muda o tipo declarado): a ponte confere de novo.
    const torto: unknown = JSON.parse('{"tipo":"youtube","video":"https://youtu.be/dQw4w9WgXcQ"}')
    expect(fonteDeSomNaRede(Object.assign({ tipo: 'arquivo' as const, ref: '', bytes: 1 }, torto))).toBeNull()
  })

  it('parar e volume usam o apelido; efeito que nunca foi à rede não manda nada; Parar tudo para os dois lados', () => {
    const motor = motorFalso()
    const rede = redeFalsa()
    const ponte = criarPonteDosSons({ motor, rede: () => rede, novaInstancia: apelidos() })
    ponte.tocar(efeito('som_1', true), { tipo: 'todos' }, { local: true })
    ponte.mudarVolume('som_1', 0.3)
    ponte.parar('som_1')
    ponte.parar('som_nunca')
    ponte.pararTudo()
    expect(motor.mudarVolume).toHaveBeenCalledWith('som_1', 0.3)
    expect(rede.volumeDoSom).toHaveBeenCalledWith('apelido-1', 0.3)
    expect(motor.parar.mock.calls).toEqual([['som_1'], ['som_nunca']])
    expect(rede.pararSomAoVivo.mock.calls).toEqual([['apelido-1']])
    expect(motor.pararTudo).toHaveBeenCalledTimes(1)
    expect(rede.pararTodosOsSons).toHaveBeenCalledTimes(1)
  })

  it('fonteDeSomNaRede: ref de áudio vira o id; ref torta não vai', () => {
    expect(fonteDeSomNaRede({ tipo: 'arquivo', ref: `midia:${ID}`, bytes: 1 })).toEqual({ tipo: 'arquivo', midia: ID })
    expect(fonteDeSomNaRede({ tipo: 'arquivo', ref: 'C:/aventura/grito.mp3', bytes: 1 })).toBeNull()
  })
})

// ─── Revisão da F4 (23/10) ───

describe('criarPonteDosSons: apelidos moram junto da rede', () => {
  it('remontar a ponte com o loop tocando: a ponte nova muda o volume e para o loop pelo MESMO apelido', () => {
    const rede = redeFalsa()
    const primeira = criarPonteDosSons({ motor: motorFalso(), rede: () => rede, novaInstancia: apelidos() })
    primeira.tocar(efeito('som_1', true), { tipo: 'todos' }, { local: true })
    const segunda = criarPonteDosSons({ motor: motorFalso(), rede: () => rede, novaInstancia: () => 'apelido-novo' })
    segunda.mudarVolume('som_1', 0.4)
    segunda.parar('som_1')
    expect(rede.volumeDoSom).toHaveBeenCalledWith('apelido-1', 0.4)
    expect(rede.pararSomAoVivo.mock.calls).toEqual([['apelido-1']])
  })

  it('o mapa encolhe: parar tira o apelido do efeito (o próximo toque ganha outro); Parar tudo tira todos', () => {
    const rede = redeFalsa()
    const ponte = criarPonteDosSons({ motor: motorFalso(), rede: () => rede, novaInstancia: apelidos() })
    ponte.tocar(efeito('som_1', true), { tipo: 'todos' }, { local: true })
    ponte.parar('som_1')
    ponte.tocar(efeito('som_1', true), { tipo: 'todos' }, { local: true })
    ponte.tocar(efeito('som_2'), { tipo: 'todos' }, { local: true })
    ponte.pararTudo()
    ponte.parar('som_2')
    ponte.tocar(efeito('som_1', true), { tipo: 'todos' }, { local: true })
    expect(rede.tocarSomAoVivo.mock.calls.map(([pedido]) => pedido.instancia)).toEqual(['apelido-1', 'apelido-2', 'apelido-3', 'apelido-4'])
    expect(rede.pararSomAoVivo.mock.calls).toEqual([['apelido-1']])
  })

  it('outra rede (outra sala), outros apelidos: nada vaza entre elas', () => {
    const redeA = redeFalsa()
    const redeB = redeFalsa()
    let rede = redeA
    const ponte = criarPonteDosSons({ motor: motorFalso(), rede: () => rede, novaInstancia: apelidos() })
    ponte.tocar(efeito('som_1', true), { tipo: 'todos' }, { local: true })
    rede = redeB
    ponte.parar('som_1')
    expect(redeB.pararSomAoVivo).not.toHaveBeenCalled()
  })
})

describe('criarPonteDosSons: o mestre ouve o que a mesa ouve', () => {
  it('o motor local aceitou e a rede recusou (4º loop na mesa): o local para, e a recusa volta para a tela avisar', () => {
    const motor = motorFalso()
    const rede = redeFalsa()
    rede.tocarSomAoVivo.mockReturnValue({ ok: false, motivo: 'limite-de-loops' })
    const ponte = criarPonteDosSons({ motor, rede: () => rede })
    expect(ponte.tocar(efeito('som_4', true), { tipo: 'todos' }, { local: true })).toEqual({ local: { aceito: true }, rede: { ok: false, motivo: 'limite-de-loops' } })
    expect(motor.parar).toHaveBeenCalledWith('som_4')
  })

  it('sem sala na hora (sem-sala) o mestre segue ouvindo sozinho', () => {
    const motor = motorFalso()
    const rede = redeFalsa()
    rede.tocarSomAoVivo.mockReturnValue({ ok: false, motivo: 'sem-sala' })
    const ponte = criarPonteDosSons({ motor, rede: () => rede })
    ponte.tocar(efeito('som_1', true), { tipo: 'todos' }, { local: true })
    expect(motor.parar).not.toHaveBeenCalled()
  })
})
