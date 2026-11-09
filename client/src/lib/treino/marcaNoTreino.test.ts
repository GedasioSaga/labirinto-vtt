// @vitest-environment node
/**
 * A MARCA DO VINCENT NO SITE (bug de 09/11: o lembrete "Marcar o alvo?" do
 * Olhar Artístico chegava no fio e a Arena do site não o desenhava, porque a
 * jogada `marcar` não existia). A ficha aqui é inventada com os campos da
 * real que importam: a Rosa Fúnebre (De fogo) e a passiva com o custo "Teste
 * de Percepção Cd 15 ou Gastar 30 de SP". Quem rola é o Vincent (o d20 do
 * motor) ou ele paga o SP, como no app. Ambiente node: o duelo e a luta rodam
 * no DO, sem DOM.
 */
import { describe, expect, it } from 'vitest'
import type { GolpeDaBatalha } from '../batalha/combate'
import { cartaDaVez, type TurnosDaCena } from '../batalha/turnos'
import { personagemDoArquivo, type Personagem } from '../personagem'
import { comecarLutaLocal, jogarNaLuta, passoDoInimigo } from '../../lobby-site/telas/treino/lutaDeTreino'
import { aplicarJogada, criarDuelo, jogadaDoValor, type DueloGravado, type JogadaDoDuelo, type MotorDoDuelo, type ResultadoDaJogada } from './duelo'
import { LIA, MARINHEIRO, SISTEMA_DO_TESTE } from './fichasDeTreino.testkit'
import { aplicarJogadaNaLuta, criarLuta, type EstadoDaLuta } from './luta'
import { criarSorteio } from './sorteio'
import { dueloParaOsLados } from './vistaDoDuelo'
import { lutaParaTodos } from './vistaDaLuta'

const ROSA = 'arma_rosa'

function lerFicha(dados: Record<string, unknown>): Personagem {
  const lida = personagemDoArquivo(dados)
  if (lida === null) throw new Error('ficha de teste inválida')
  return lida
}

const VINCENT = lerFicha({
  id: 'pers_vincent',
  tipo: 'jogador',
  nome: 'Vincent G.',
  recursos: { hp: 600, sp: 60 },
  maximos: { hp: 600, sp: 60 },
  atributos: { forca: 10, agilidade: 35, percepcao: 35 },
  abas: {
    armas: [{ id: ROSA, nome: 'Rosa Fúnebre', campos: { dano: '20', acao: 'Ação Simples', categoria: 'De fogo', atributoDoAtaque: 'Percepção' } }],
    habilidades: [
      {
        id: 'tec_olhar',
        nome: 'Olhar artístico',
        campos: {
          acao: 'Passiva',
          tipo: 'Passiva',
          efeito: 'Ao atingir inimigos com disparos de sua pistola, ao passar em um teste de percepção, Vincent pode realizar uma marca de tinta em seu alvo.',
          custo: 'Teste de Percepção Cd 15 ou Gastar 30 de SP',
        },
      },
    ],
  },
})

/** O d20 fixo (o teste da marca e as reações): a mesma luta sempre. */
function motorDoD20(d20: number): MotorDoDuelo {
  return { sistema: SISTEMA_DO_TESTE, rolarD20: () => d20 }
}

function aceita(resultado: ResultadoDaJogada, oQue: string): DueloGravado {
  if (!resultado.ok) throw new Error(`${oQue} recusada: ${resultado.motivo}`)
  return resultado.duelo
}

/** A jogada como chega ao servidor: JSON de ida e volta, lida pelo fio. */
function peloFio(jogada: unknown): JogadaDoDuelo {
  const lida = jogadaDoValor(JSON.parse(JSON.stringify(jogada)))
  if (lida === null) throw new Error('jogada torta no fio')
  return lida
}

function golpeEsperando(turnos: TurnosDaCena): GolpeDaBatalha | undefined {
  return (turnos.golpes ?? []).find((golpe) => golpe.alvos.some((alvo) => alvo.danoFinal === undefined))
}

/** Vincent (Ana, lado A) contra o Marinheiro (Bia, lado B): o Vincent age primeiro (Agilidade 35 contra 30). */
function dueloDoVincent(motor: MotorDoDuelo): DueloGravado {
  const criado = criarDuelo({ id: 'duelo_marca', a: { contaId: 'conta_ana', nome: 'Ana', fichas: [{ ...VINCENT, dono: 'conta_ana' }] }, b: { contaId: 'conta_bia', nome: 'Bia', fichas: [{ ...MARINHEIRO, dono: 'conta_bia' }] } }, motor)
  if (!criado.ok) throw new Error(`duelo recusado: ${criado.motivo}`)
  return criado.duelo
}

/** O Vincent atira com a Rosa Fúnebre no Marinheiro e a Bia não reage: o golpe entra cheio. */
function tiroQueAcerta(duelo: DueloGravado, motor: MotorDoDuelo): DueloGravado {
  const carta = cartaDaVez(duelo.cena.turnos)
  if (carta === null) throw new Error('sem vez')
  const alvo = 'treino_tok_b1'
  const atirou = aceita(aplicarJogada(duelo, motor, 'conta_ana', peloFio({ tipo: 'agir', seq: duelo.seq, vez: { cartaId: carta.id, rodada: duelo.cena.turnos.rodada }, pedido: { tipo: 'atacar', armaId: ROSA, alvos: [{ tokenId: alvo, dano: null }], surpresa: false, perfurante: false } })), 'tiro')
  const golpe = golpeEsperando(atirou.cena.turnos)
  if (golpe === undefined) throw new Error('o tiro não esperou reação')
  return aceita(aplicarJogada(atirou, motor, 'conta_bia', peloFio({ tipo: 'reagir', seq: atirou.seq, pedido: { tipo: 'naoReagir', golpeId: golpe.id, tokenId: alvo } })), 'reação')
}

/** O "recebeu N" da última linha de golpe. */
function danoRecebido(duelo: DueloGravado): number {
  const linha = [...duelo.cena.registro].reverse().find((candidata) => candidata.texto.includes('recebeu'))
  const numero = linha === undefined ? undefined : /recebeu (\d+)/.exec(linha.texto)?.[1]
  if (numero === undefined) throw new Error('sem golpe no registro')
  return Number(numero)
}

describe('a marca do Vincent no duelo (o fio do servidor)', () => {
  it('o lembrete chega só ao Vincent; pagar 30 SP marca, e o próximo acerto dobra', () => {
    const motor = motorDoD20(10)
    let duelo = tiroQueAcerta(dueloDoVincent(motor), motor)
    const primeiro = danoRecebido(duelo)
    const lados = dueloParaOsLados(duelo, SISTEMA_DO_TESTE)
    const marcas = (lados.a.vista.meus ?? []).flatMap((meu) => meu.marcas ?? [])
    expect(marcas).toHaveLength(1)
    expect((lados.b.vista.meus ?? []).flatMap((meu) => meu.marcas ?? [])).toEqual([])
    const lembreteId = marcas[0]?.id ?? ''
    duelo = aceita(aplicarJogada(duelo, motor, 'conta_ana', peloFio({ tipo: 'marcar', seq: duelo.seq, pedido: { tipo: 'marcar', lembreteId, como: 'sp' } })), 'marcar')
    expect(duelo.cena.registro.at(-1)?.texto).toBe('Vincent G. marcou Marinheiro (Olhar artístico · 30 SP)')
    expect(duelo.lutadores.personagens.find((personagem) => personagem.nome === 'Vincent G.')?.recursos.sp).toBe(30)
    expect((duelo.cena.turnos.selos ?? []).some((selo) => selo.tokenId === 'treino_tok_b1' && selo.marca === true)).toBe(true)
    // O próximo acerto (na vez seguinte do Vincent: o Marinheiro passa) dobra o dano e gasta a marca.
    const daVez = cartaDaVez(duelo.cena.turnos)
    if (daVez === null) throw new Error('sem vez')
    duelo = aceita(aplicarJogada(duelo, motor, 'conta_ana', peloFio({ tipo: 'passar', seq: duelo.seq, vez: { cartaId: daVez.id, rodada: duelo.cena.turnos.rodada } })), 'passar do Vincent')
    const doMarinheiro = cartaDaVez(duelo.cena.turnos)
    if (doMarinheiro === null) throw new Error('sem vez')
    duelo = aceita(aplicarJogada(duelo, motor, 'conta_bia', peloFio({ tipo: 'passar', seq: duelo.seq, vez: { cartaId: doMarinheiro.id, rodada: duelo.cena.turnos.rodada } })), 'passar do Marinheiro')
    duelo = tiroQueAcerta(duelo, motor)
    expect(danoRecebido(duelo)).toBe(primeiro * 2)
    expect((duelo.cena.turnos.selos ?? []).some((selo) => selo.marca === true)).toBe(false)
  })

  it('o teste rola o d20 do servidor com o modificador da ficha; o outro lado e o "rolei fora" são recusados', () => {
    const motor = motorDoD20(14)
    const duelo = tiroQueAcerta(dueloDoVincent(motor), motor)
    const lembreteId = duelo.cena.turnos.lembretesDaMarca?.[0]?.id ?? ''
    const marcar = (contaId: string, como: string, extra: Record<string, unknown> = {}) => aplicarJogada(duelo, motor, contaId, peloFio({ tipo: 'marcar', seq: duelo.seq, pedido: { tipo: 'marcar', lembreteId, como, ...extra } }))
    expect(marcar('conta_bia', 'sp')).toEqual({ ok: false, motivo: 'naoEDaConta' })
    expect(marcar('conta_ana', 'passou')).toEqual({ ok: false, motivo: 'foraDoDuelo' })
    // O modificador digitado (99) não vale: a Percepção 35 da ficha dá +1 (14 + 1 = 15, passa raspando).
    const marcou = aceita(marcar('conta_ana', 'teste', { modificador: 99 }), 'teste')
    expect(marcou.cena.registro.at(-1)?.texto).toBe('Vincent G. marcou Marinheiro (Olhar artístico · Percepção d20 14+1 = 15 contra CD 15)')
    expect(marcou.cena.turnos.lembretesDaMarca ?? []).toEqual([])
    expect(marcou.lutadores.personagens.find((personagem) => personagem.nome === 'Vincent G.')?.recursos.sp).toBe(60)
    // A marca não conta passo do relógio da luta (não é golpe nem vez).
    expect(marcou.passos).toBe(duelo.passos)
  })
})

describe('a marca do Vincent no treino solo', () => {
  it('o robô do treino responde a marca do Vincent dele com o teste (o d20 da semente) antes de seguir', () => {
    const comeco = comecarLutaLocal({ minhas: [MARINHEIRO], inimigos: [VINCENT] }, SISTEMA_DO_TESTE, 7)
    if (!comeco.ok) throw new Error(comeco.motivo)
    let luta = comeco.luta
    // O robô atira (o Vincent age primeiro); o Marinheiro (meu) não reage; o robô responde o lembrete.
    for (let passo = 0; passo < 6 && !luta.duelo.cena.registro.some((linha) => linha.texto.includes('marcou')); passo += 1) {
      const golpe = golpeEsperando(luta.duelo.cena.turnos)
      if (golpe !== undefined) {
        const feito = jogarNaLuta(luta, { tipo: 'reagir', seq: luta.duelo.seq, pedido: { tipo: 'naoReagir', golpeId: golpe.id, tokenId: 'treino_tok_a1' } })
        if (!feito.ok) throw new Error(feito.motivo)
        luta = feito.luta
        continue
      }
      const depois = passoDoInimigo(luta, false)
      if (depois === null) break
      luta = depois
    }
    expect(luta.duelo.cena.registro.map((linha) => linha.texto)).toContainEqual(expect.stringMatching(/^Vincent G\. (não )?marcou Marinheiro \(Olhar artístico · Percepção d20 \d+\+1 = \d+ contra CD 15( · falhou)?\)$/))
    expect(luta.duelo.cena.turnos.lembretesDaMarca ?? []).toEqual([])
  })
})

describe('a marca do Vincent na luta de N jogadores', () => {
  it('só a conta do Vincent responde; pelo fio, o teste marca e a vista dela leva o lembrete', () => {
    const sorteio = criarSorteio(3)
    const motor: MotorDoDuelo = { sistema: SISTEMA_DO_TESTE, rolarD20: () => sorteio.d20() }
    const fixo = motorDoD20(15)
    const inscricoes = [
      { contaId: 'conta_ana', nome: 'Ana', papel: 'jogador' as const, lado: 'a' as const, fichas: [{ ...VINCENT, dono: 'conta_ana' }] },
      { contaId: 'conta_bia', nome: 'Bia', papel: 'jogador' as const, lado: 'b' as const, fichas: [{ ...MARINHEIRO, dono: 'conta_bia' }] },
      { contaId: 'conta_caio', nome: 'Caio', papel: 'jogador' as const, lado: 'c' as const, fichas: [{ ...LIA, dono: 'conta_caio' }] },
    ]
    const criada = criarLuta({ id: 'luta_marca', modo: 'todos', inscricoes }, motor)
    if (!criada.ok) throw new Error(`luta recusada: ${criada.motivo}`)
    let luta: EstadoDaLuta = criada.luta
    const jogar = (contaId: string, jogada: unknown, comMotor: MotorDoDuelo = fixo): EstadoDaLuta => {
      const feito = aplicarJogadaNaLuta(luta, comMotor, contaId, peloFio(jogada))
      if (!feito.ok) throw new Error(`${contaId} recusada: ${feito.motivo}`)
      return feito.luta
    }
    const contaDoToken = (tokenId: string) => luta.lutadores.vagas.find((vaga) => vaga.tokenId === tokenId)?.contaId ?? ''
    const tokenDa = (contaId: string) => luta.lutadores.vagas.find((vaga) => vaga.contaId === contaId)?.tokenId ?? ''
    // Quem vem antes do Vincent passa a vez (a Lia, Agilidade 70).
    for (let passo = 0; passo < 4; passo += 1) {
      const carta = cartaDaVez(luta.cena.turnos)
      if (carta === null || carta.tokenId === tokenDa('conta_ana')) break
      luta = jogar(contaDoToken(carta.tokenId), { tipo: 'passar', seq: luta.seq, vez: { cartaId: carta.id, rodada: luta.cena.turnos.rodada } })
    }
    const carta = cartaDaVez(luta.cena.turnos)
    if (carta === null) throw new Error('sem vez')
    const alvo = tokenDa('conta_bia')
    luta = jogar('conta_ana', { tipo: 'agir', seq: luta.seq, vez: { cartaId: carta.id, rodada: luta.cena.turnos.rodada }, pedido: { tipo: 'atacar', armaId: ROSA, alvos: [{ tokenId: alvo, dano: null }], surpresa: false, perfurante: false } })
    const golpe = golpeEsperando(luta.cena.turnos)
    if (golpe === undefined) throw new Error('o tiro não esperou reação')
    luta = jogar('conta_bia', { tipo: 'reagir', seq: luta.seq, pedido: { tipo: 'naoReagir', golpeId: golpe.id, tokenId: alvo } })
    const daAna = lutaParaTodos(luta, SISTEMA_DO_TESTE).get('conta_ana')
    const lembreteId = (daAna?.vista.meus ?? []).flatMap((meu) => meu.marcas ?? [])[0]?.id
    if (lembreteId === undefined) throw new Error('o lembrete não chegou à vista do Vincent')
    const pedido = { tipo: 'marcar', seq: luta.seq, pedido: { tipo: 'marcar', lembreteId, como: 'teste' } }
    expect(aplicarJogadaNaLuta(luta, fixo, 'conta_caio', peloFio(pedido))).toEqual({ ok: false, motivo: 'naoEDaConta' })
    luta = jogar('conta_ana', pedido)
    expect(luta.cena.registro.at(-1)?.texto).toBe('Vincent G. marcou Marinheiro (Olhar artístico · Percepção d20 15+1 = 16 contra CD 15)')
    expect((luta.cena.turnos.selos ?? []).some((selo) => selo.tokenId === alvo && selo.marca === true)).toBe(true)
  })
})
