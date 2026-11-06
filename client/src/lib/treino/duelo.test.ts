// @vitest-environment node
/**
 * A REGRA PURA DO DUELO (LOBBY v2, fatia T5; aceite em
 * docs/planos/lobby-jogadores-2026-11-05.md §8.2): dois robôs pelo duelo.ts
 * com a semente 7 terminam igual à lutaAutomatica; e os dois anti-trapaça
 * liberados na resposta 12.13: pedido com dano (custo, ação) forjado = mesmo
 * resultado que dano null; agir repetido com seq velho = recusado. Ambiente
 * node: o duelo roda no DO, sem DOM.
 */
import { describe, expect, it } from 'vitest'
import { DANO_MAX, chaveDaVez, type AcaoDaForma, type PedidoDeAcao } from '../batalha/combate'
import type { VezEsperada } from '../batalha/ponte'
import { cartaDaVez } from '../batalha/turnos'
import { novoCartao, type Personagem } from '../personagem'
import { recursoDeVida, vidaDoPersonagem } from '../vidaDaFicha'
import { aplicarJogada, criarDuelo, jogadaDoValor, type DueloGravado, type JogadaDoDuelo, type MotorDoDuelo, type ResultadoDaJogada } from './duelo'
import { LIA, lutadoresDe, MARINHEIRO, SISTEMA_DO_TESTE, ze } from './fichasDeTreino.testkit'
import { lutaAutomatica, type ResumoDaLuta } from './lutaAutomatica'
import { jogadaDoRobo } from './robo'
import { criarSorteio, type Sorteio } from './sorteio'

const CONTA_A = 'conta_a'
const CONTA_B = 'conta_b'
/** As vagas são a1, a2... e b1: o token de cada uma é `treino_tok_<vaga>`. */
const TOKEN_DO_ZE = 'treino_tok_a1'
const TOKEN_DO_MARINHEIRO = 'treino_tok_b1'

/** A ficha como o servidor a guarda: o doc completo, com o dono. */
function daConta(ficha: Personagem, contaId: string): Personagem {
  return { ...ficha, dono: contaId }
}

const ZE = daConta(ze(60), CONTA_A)
const LIA_DA_CONTA = daConta(LIA, CONTA_A)
const MARINHEIRO_DA_CONTA = daConta(MARINHEIRO, CONTA_B)

function motorDaSemente(semente: number): { motor: MotorDoDuelo; sorteio: Sorteio } {
  const sorteio = criarSorteio(semente)
  return { motor: { sistema: SISTEMA_DO_TESTE, rolarD20: () => sorteio.d20() }, sorteio }
}

function dueloDe(a: readonly Personagem[], b: readonly Personagem[], motor: MotorDoDuelo): DueloGravado {
  const criado = criarDuelo({ id: 'duelo_teste', a: { contaId: CONTA_A, nome: 'Ana', fichas: a }, b: { contaId: CONTA_B, nome: 'Bia', fichas: b } }, motor)
  if (!criado.ok) throw new Error(`duelo recusado: ${JSON.stringify(criado)}`)
  return criado.duelo
}

function aceita(resultado: ResultadoDaJogada, oQue: string): DueloGravado {
  if (!resultado.ok) throw new Error(`${oQue} recusada: ${resultado.motivo}`)
  return resultado.duelo
}

function contaDoToken(duelo: DueloGravado, tokenId: string): string {
  const vaga = duelo.lutadores.vagas.find((candidata) => candidata.tokenId === tokenId)
  if (vaga === undefined) throw new Error(`token ${tokenId} sem vaga`)
  return duelo.jogadores[vaga.lado].contaId
}

/**
 * Os dois lados jogados pelo robô (`jogadaDoRobo`), cada jogada mandada pela
 * conta do lado com o `seq` de agora: a reação; ou os golpes do mais forte ao
 * mais fraco até um ser aceito, e senão passar a vez (como `lutaAutomatica`).
 */
function duelarComRobos(inicio: DueloGravado, motor: MotorDoDuelo): DueloGravado {
  let duelo = inicio
  let golpesDaVez: { chave: string; golpes: number } | null = null
  while (duelo.fim === null) {
    const { turnos, regras } = duelo.cena
    const chaveDeAgora = turnos.vez === null ? null : chaveDaVez(turnos.rodada, turnos.vez)
    const golpesNaVez: number = golpesDaVez !== null && golpesDaVez.chave === chaveDeAgora ? golpesDaVez.golpes : 0
    const jogada = jogadaDoRobo({ turnos, regras, vagas: duelo.lutadores.vagas, personagens: duelo.lutadores.personagens, sistema: motor.sistema, golpesNaVez })
    if (jogada === null) throw new Error('o robô ficou sem jogada')
    if (jogada.tipo === 'reagir') {
      duelo = aceita(aplicarJogada(duelo, motor, contaDoToken(duelo, jogada.pedido.tokenId), { tipo: 'reagir', seq: duelo.seq, pedido: jogada.pedido }), 'a reação')
      continue
    }
    const conta = contaDoToken(duelo, jogada.tokenId)
    let depois: DueloGravado | null = null
    for (const pedido of jogada.golpes) {
      const feito = aplicarJogada(duelo, motor, conta, { tipo: 'agir', seq: duelo.seq, vez: jogada.esperado, pedido })
      if (!feito.ok) continue
      depois = feito.duelo
      golpesDaVez = { chave: chaveDaVez(jogada.esperado.rodada, jogada.esperado.cartaId), golpes: golpesNaVez + 1 }
      break
    }
    duelo = depois ?? aceita(aplicarJogada(duelo, motor, conta, { tipo: 'passar', seq: duelo.seq, vez: jogada.esperado }), 'passar a vez')
  }
  return duelo
}

/** O duelo acabado no formato do resumo da luta automática (mesma leitura da vida). */
function resumoDoDuelo(duelo: DueloGravado, sorteio: Sorteio): ResumoDaLuta {
  const { fim } = duelo
  if (fim === null || fim.tipo === 'ausencia' || fim.tipo === 'desistencia') throw new Error(`duelo sem fim de luta: ${JSON.stringify(fim)}`)
  const recurso = recursoDeVida(SISTEMA_DO_TESTE)
  const porId = new Map(duelo.lutadores.personagens.map((personagem) => [personagem.id, personagem]))
  return {
    semente: sorteio.estado().semente,
    fim,
    rodada: duelo.cena.turnos.rodada,
    passos: duelo.passos,
    d20: sorteio.estado().jogadas,
    lutadores: duelo.lutadores.vagas.map((vaga) => {
      const copia = porId.get(vaga.personagemId)
      return { vaga: vaga.id, lado: vaga.lado, nome: copia?.nome ?? vaga.id, vida: copia === undefined || recurso === null ? null : vidaDoPersonagem(copia, recurso) }
    }),
    registro: duelo.cena.registro.map((linha) => linha.texto),
  }
}

function vezDe(duelo: DueloGravado): VezEsperada {
  const { vez, rodada } = duelo.cena.turnos
  if (vez === null) throw new Error('duelo sem vez')
  return { cartaId: vez, rodada }
}

/** O Zé com o Corte Duplo sem Ação e sem recarga na ficha: só a ação gasta segura o 2º Corte na vez. */
function zeComCorteSemAcao(): Personagem {
  const habilidades = (ZE.abas.habilidades ?? []).map((cartao) => (cartao.id === 'tec_corte' ? { ...cartao, campos: { custo: '30 SP', dano: 'Força + 60' } } : cartao))
  return { ...ZE, abas: { ...ZE.abas, habilidades } }
}

/** O Zé com a forma Ira, que a ficha manda ativar com a Ação Completa. */
function zeComFormaCompleta(): Personagem {
  return { ...ZE, abas: { ...ZE.abas, transformacoes: [{ ...novoCartao('Ira'), id: 'forma_ira', campos: { acao: 'Completa' } }] } }
}

/** O 1×1 Zé contra Marinheiro na vez do Zé (se a ordem deu a vez ao Marinheiro, ele passa). */
function umContraUmNaVezDoZe(motor: MotorDoDuelo, zeDoDuelo: Personagem = ZE): DueloGravado {
  const duelo = dueloDe([zeDoDuelo], [MARINHEIRO_DA_CONTA], motor)
  if (cartaDaVez(duelo.cena.turnos)?.tokenId === TOKEN_DO_ZE) return duelo
  return aceita(aplicarJogada(duelo, motor, CONTA_B, { tipo: 'passar', seq: duelo.seq, vez: vezDe(duelo) }), 'o Marinheiro passar a vez')
}

/** O que o golpe fez: o dano de cada alvo, o registro e os recursos das cópias (o histórico da ficha leva a hora). */
function oQueOGolpeFez(duelo: DueloGravado): unknown {
  return {
    alvos: (duelo.cena.turnos.golpes ?? []).flatMap((golpe) => golpe.alvos.map(({ tokenId, dano }) => ({ tokenId, dano }))),
    registro: duelo.cena.registro.map((linha) => linha.texto),
    recursos: duelo.lutadores.personagens.map((personagem) => ({ id: personagem.id, recursos: personagem.recursos })),
  }
}

describe('duelo', () => {
  it('dois robôs pelo duelo.ts com a semente 7 terminam igual à lutaAutomatica', () => {
    const { motor, sorteio } = motorDaSemente(7)
    const duelo = duelarComRobos(dueloDe([ZE, LIA_DA_CONTA], [MARINHEIRO_DA_CONTA], motor), motor)
    const lutadores = lutadoresDe([
      { ficha: ZE, lado: 'a' },
      { ficha: LIA_DA_CONTA, lado: 'a' },
      { ficha: MARINHEIRO_DA_CONTA, lado: 'b' },
    ])
    const automatica = lutaAutomatica({ sistema: SISTEMA_DO_TESTE, lutadores, semente: 7 })
    expect(automatica.fim.tipo).toBe('vitoria')
    expect(resumoDoDuelo(duelo, sorteio)).toEqual(automatica)
  })

  it('pedido com dano e custo forjados = mesmo resultado que dano e custo null', () => {
    const { motor } = motorDaSemente(7)
    const duelo = umContraUmNaVezDoZe(motor)
    // Corte Duplo: Força + 60 (o Zé tem 60) e 30 SP na ficha.
    const corte = (dano: number | null, custo: number | null): JogadaDoDuelo => ({
      tipo: 'agir',
      seq: duelo.seq,
      vez: vezDe(duelo),
      pedido: { tipo: 'habilidade', cartaoId: 'tec_corte', armaId: null, alvos: [{ tokenId: TOKEN_DO_MARINHEIRO, dano }], surpresa: false, perfurante: false, custo, acao: null },
    })
    const comNull = aceita(aplicarJogada(duelo, motor, CONTA_A, corte(null, null)), 'o Corte com dano null')
    const forjado = aceita(aplicarJogada(duelo, motor, CONTA_A, corte(DANO_MAX, 0)), 'o Corte forjado')
    expect(oQueOGolpeFez(forjado)).toEqual(oQueOGolpeFez(comNull))
    expect(oQueOGolpeFez(comNull)).toMatchObject({
      alvos: [{ tokenId: TOKEN_DO_MARINHEIRO, dano: 120 }],
      recursos: [{ id: 'treino_a1', recursos: { sp: 70 } }, { id: 'treino_b1' }],
    })
  })

  it('ação Livre forjada na técnica cuja ficha não diz a ação = a Simples: o 2º Corte na vez é recusado', () => {
    const { motor } = motorDaSemente(7)
    const duelo = umContraUmNaVezDoZe(motor, zeComCorteSemAcao())
    const corteLivre = (agora: DueloGravado): JogadaDoDuelo => ({
      tipo: 'agir',
      seq: agora.seq,
      vez: vezDe(agora),
      pedido: { tipo: 'habilidade', cartaoId: 'tec_corte', armaId: null, alvos: [{ tokenId: TOKEN_DO_MARINHEIRO, dano: null }], surpresa: false, perfurante: false, custo: null, acao: 'livre' },
    })
    const primeiro = aceita(aplicarJogada(duelo, motor, CONTA_A, corteLivre(duelo)), 'o 1º Corte')
    // Sobram 70 SP (o 2º Corte caberia no custo): quem recusa é a Simples já gasta.
    expect(primeiro.lutadores.personagens.find((personagem) => personagem.id === 'treino_a1')?.recursos).toMatchObject({ sp: 70 })
    expect(aplicarJogada(primeiro, motor, CONTA_A, corteLivre(primeiro))).toEqual({ ok: false, motivo: 'regra' })
  })

  it('forma de Ação Completa pedida como Simples ou Bônus liga gastando a Completa', () => {
    const { motor } = motorDaSemente(7)
    const duelo = umContraUmNaVezDoZe(motor, zeComFormaCompleta())
    const vez = vezDe(duelo)
    const forjadas: readonly AcaoDaForma[] = ['simples', 'bonus']
    for (const acao of forjadas) {
      const ativar: JogadaDoDuelo = { tipo: 'agir', seq: duelo.seq, vez, pedido: { tipo: 'transformar', cartaoId: 'forma_ira', acao, trocarImagem: false } }
      const ligada = aceita(aplicarJogada(duelo, motor, CONTA_A, ativar), `a Ira pedida como ${acao}`)
      expect(ligada.lutadores.personagens.find((personagem) => personagem.id === 'treino_a1')?.cartoesAtivos).toContain('forma_ira')
      // A Completa gasta a Simples e o movimento; o Bônus fica livre.
      expect(ligada.cena.turnos.gastos[vez.cartaId]).toMatchObject({ simples: 1, movimento: 1, bonus: 0 })
    }
  })

  it('agir repetido com seq velho = recusado', () => {
    const { motor } = motorDaSemente(7)
    const duelo = umContraUmNaVezDoZe(motor)
    const ataque: PedidoDeAcao = { tipo: 'atacar', armaId: 'arma_espada', alvos: [{ tokenId: TOKEN_DO_MARINHEIRO, dano: null }], surpresa: false, perfurante: false }
    const jogada: JogadaDoDuelo = { tipo: 'agir', seq: duelo.seq, vez: vezDe(duelo), pedido: ataque }
    const primeira = aceita(aplicarJogada(duelo, motor, CONTA_A, jogada), 'o primeiro Atacar')
    expect(primeira.seq).toBe(duelo.seq + 1)
    expect(aplicarJogada(primeira, motor, CONTA_A, jogada)).toEqual({ ok: false, motivo: 'seqVelho' })
  })

  // Fatia M1: a grade 12 x 8 da Arena. No 1×1, o Zé nasce na casa (1, 3) e o Marinheiro na (10, 3).
  it('andar fora da vez = recusado no duelo (no treino local é livre); na vez, a ficha anda e o MOV conta', () => {
    const { motor } = motorDaSemente(7)
    const duelo = umContraUmNaVezDoZe(motor)
    const vez = vezDe(duelo)
    expect(duelo.posicoes).toEqual({ [TOKEN_DO_ZE]: { col: 1, row: 3 }, [TOKEN_DO_MARINHEIRO]: { col: 10, row: 3 } })
    const marinheiroAnda: JogadaDoDuelo = { tipo: 'andar', seq: duelo.seq, vez, tokenId: TOKEN_DO_MARINHEIRO, col: 9, row: 3 }
    expect(jogadaDoValor(JSON.parse(JSON.stringify(marinheiroAnda)))).toEqual(marinheiroAnda)
    expect(aplicarJogada(duelo, motor, CONTA_B, marinheiroAnda)).toEqual({ ok: false, motivo: 'regra' })
    expect(aplicarJogada(duelo, motor, CONTA_B, marinheiroAnda, 'livre')).toMatchObject({ ok: true, duelo: { posicoes: { [TOKEN_DO_MARINHEIRO]: { col: 9, row: 3 } } } })
    const zeAnda = aceita(aplicarJogada(duelo, motor, CONTA_A, { tipo: 'andar', seq: duelo.seq, vez, tokenId: TOKEN_DO_ZE, col: 4, row: 5 }), 'o Zé andar na vez dele')
    expect(zeAnda.posicoes[TOKEN_DO_ZE]).toEqual({ col: 4, row: 5 })
    expect(zeAnda.cena.turnos.gastos[vez.cartaId]).toMatchObject({ blocos: 3 })
    expect({ seq: zeAnda.seq, passos: zeAnda.passos }).toEqual({ seq: duelo.seq + 1, passos: duelo.passos })
  })

  it('andar para a casa ocupada (ou fora da grade) = recusado, e o duelo fica como estava', () => {
    const { motor } = motorDaSemente(7)
    const duelo = umContraUmNaVezDoZe(motor)
    const antes = structuredClone(duelo)
    const zeAndaPara = (col: number, row: number): JogadaDoDuelo => ({ tipo: 'andar', seq: duelo.seq, vez: vezDe(duelo), tokenId: TOKEN_DO_ZE, col, row })
    expect(aplicarJogada(duelo, motor, CONTA_A, zeAndaPara(10, 3))).toEqual({ ok: false, motivo: 'regra' })
    expect(aplicarJogada(duelo, motor, CONTA_A, zeAndaPara(10, 3), 'livre')).toEqual({ ok: false, motivo: 'regra' })
    expect(aplicarJogada(duelo, motor, CONTA_A, zeAndaPara(12, 3))).toEqual({ ok: false, motivo: 'regra' })
    expect(duelo).toEqual(antes)
  })
})
