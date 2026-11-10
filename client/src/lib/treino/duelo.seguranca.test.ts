// @vitest-environment node
/**
 * FASE FINAL da unificação do combate (10/11/2026), risco 2: o servidor do
 * duelo deixou de refazer a regra (R3), então o que barra o cliente malicioso
 * é o que `lerJogadaDoDuelo` + `aplicarJogada` fazem com o que chega do fio.
 * Aqui cada ataque entra pelo fio de verdade (o texto JSON, como o Worker
 * recebe) e o resultado é comparado com o do pedido honesto e com o da store
 * do app chamada direto (o caminho do jogador por LAN). Fichas inventadas; no
 * máximo 2 testes por caso.
 */
import { describe, expect, it } from 'vitest'
import type { PedidoDeAcao, PedidoDeReacao } from '../batalha/combate'
import { ficha } from '../batalha/fichasDaFatiaB.testkit'
import { danoSugeridoDoAtaque } from '../batalha/golpe'
import { armasDe } from '../batalha/leituraDaFicha'
import type { VezEsperada } from '../batalha/ponte'
import { cartaDaVez, type AutorDaAcao } from '../batalha/turnos'
import { numeroDaFicha, type CartaoDaFicha, type Personagem } from '../personagem'
import { criarBatalhaStore, type BatalhaDaCena } from '../../stores/batalhaFabrica'
import { aplicarJogada, CENA_DO_DUELO, criarDuelo, jogadaDoValor, lerJogadaDoDuelo, type DueloGravado, type MotorDoDuelo, type ResultadoDaJogada } from './duelo'
import { SISTEMA_DO_TESTE } from './fichasDeTreino.testkit'
import { criarMesaEmMemoria } from './mesaEmMemoria'

const CONTA_A = 'conta_a'
const CONTA_B = 'conta_b'
/** O token da primeira ficha do lado A: a que abre a luta (a Curandeira; nos fechamentos de 10/11, a ficha de cada caso). */
const PRIMEIRA_DE_A = 'treino_tok_a1'
const CURANDEIRA = PRIMEIRA_DE_A
const ESCUDEIRO = 'treino_tok_a2'
const RIVAL = 'treino_tok_b1'
const D20_FIXO = 10

function cartao(id: string, nome: string, campos: Record<string, string>, extras: CartaoDaFicha['extras'] = []): CartaoDaFicha {
  return { id, nome, campos, extras, atributos: [], imagem: null, modificadores: [], subcartoes: [] }
}

/** A cura por peças: Espírito (50) de HP num aliado, 30 SP, 3 usos por batalha. */
const SOPRO: CartaoDaFicha = {
  ...cartao('cart_sopro', 'Sopro Morno', { dano: '', acao: 'Ação Simples', tipo: 'Buff' }),
  mecanica: {
    versao: 1,
    limite: { usosPorBatalha: 3 },
    teste: { tipo: 'reacao' },
    efeitos: [{ tipo: 'cura', recurso: 'hp', quanto: { formula: 'Espírito' }, emQuem: 'alvo' }],
    acao: 'simples',
    custos: [{ recurso: 'sp', quanto: { fixo: 30 }, quando: 'aoUsar' }],
    alvo: { quem: 'aliados', forma: { tipo: 'um' } },
  },
}
const ESTOCADA = cartao('cart_estocada', 'Estocada', { acao: 'Simples', custo: '20 SP', tempo: '2', dano: 'Força + 40' })
/** A "Explosão" inventada: o dano sai da vida de cada alvo, na batalha. */
const ESTOURO = cartao('cart_estouro', 'Estouro', { acao: 'Simples', custo: '40 SP', dano: '10% da vida atual do alvo' })
const SALTO = cartao('cart_salto', 'Salto', { acao: 'Simples', custo: '10 SP', dano: 'Força + 10' }, [
  { nome: 'Evolução', valor: 'O salto vira mergulho' },
  { nome: 'Condições da evolução', valor: 'Ter derrubado um inimigo nesta luta' },
])
const RAJADA = cartao('cart_rajada', 'Rajada', { acao: 'Simples', custo: '10 SP', dano: 'Força + 80' })
const FACA = cartao('arma_faca', 'Faca', { dano: '20' })
const MACHADO = cartao('arma_machado', 'Machado', { dano: '90' })

function daConta(base: Personagem, contaId: string, hp?: number): Personagem {
  return { ...base, dono: contaId, recursos: hp === undefined ? base.recursos : { ...base.recursos, hp } }
}

/** A Curandeira (a mais rápida: joga primeiro) e o Escudeiro ferido (120 de 400) contra o Rival. */
function fichasDoTeste(): { a: Personagem[]; b: Personagem[] } {
  const curandeira = ficha('Curandeira de Teste', { forca: 60, espirito: 50, agilidade: 90 }, { hp: 400, sp: 120, escudo: 0 }, { habilidades: [SOPRO, ESTOCADA, ESTOURO, SALTO], armas: [FACA] })
  const escudeiro = ficha('Escudeiro de Teste', { forca: 30, agilidade: 10 }, { hp: 400, sp: 0, escudo: 0 }, {})
  const rival = ficha('Rival de Teste', { forca: 50, agilidade: 40 }, { hp: 500, sp: 60, escudo: 0 }, { habilidades: [RAJADA], armas: [MACHADO] })
  return { a: [daConta(curandeira, CONTA_A), daConta(escudeiro, CONTA_A, 120)], b: [daConta(rival, CONTA_B)] }
}

/** O motor com o d20 fixo e a conta de quantos dados saíram. */
function motorContado(): { motor: MotorDoDuelo; dados: () => number } {
  let dados = 0
  return {
    motor: {
      sistema: SISTEMA_DO_TESTE,
      rolarD20: () => {
        dados += 1
        return D20_FIXO
      },
    },
    dados: () => dados,
  }
}

/** O duelo da Ana (lado A) contra a Bia (lado B) com as fichas dadas; quem abre é a primeira do lado A (a mais rápida). */
function dueloCom(a: Personagem[], b: Personagem[], motor: MotorDoDuelo): DueloGravado {
  const criado = criarDuelo({ id: 'duelo_seguranca', a: { contaId: CONTA_A, nome: 'Ana', fichas: a }, b: { contaId: CONTA_B, nome: 'Bia', fichas: b } }, motor)
  if (!criado.ok) throw new Error(`duelo recusado: ${JSON.stringify(criado)}`)
  if (cartaDaVez(criado.duelo.cena.turnos)?.tokenId !== PRIMEIRA_DE_A) throw new Error('a primeira ficha do lado A devia abrir a luta (Agilidade 90)')
  return criado.duelo
}

function novoDuelo(motor: MotorDoDuelo): DueloGravado {
  const { a, b } = fichasDoTeste()
  return dueloCom(a, b, motor)
}

function vezDe(duelo: DueloGravado): VezEsperada {
  const { vez, rodada } = duelo.cena.turnos
  if (vez === null) throw new Error('duelo sem vez')
  return { cartaId: vez, rodada }
}

/** A jogada como o Worker a recebe: o texto do fio, lido por `lerJogadaDoDuelo`. */
function peloFio(duelo: DueloGravado, motor: MotorDoDuelo, contaId: string, jogada: Record<string, unknown>): ResultadoDaJogada {
  const lida = lerJogadaDoDuelo(JSON.stringify(jogada))
  if (!lida.ok) throw new Error(`o fio recusou a forma: ${lida.motivo}`)
  return aplicarJogada(duelo, motor, contaId, lida.jogada)
}

function aceita(resultado: ResultadoDaJogada, oQue: string): DueloGravado {
  if (!resultado.ok) throw new Error(`${oQue} recusada: ${resultado.motivo} ${resultado.texto ?? ''}`)
  return resultado.duelo
}

function tecnica(cartaoId: string, alvo: string, dano: number | null = null): PedidoDeAcao {
  return { tipo: 'habilidade', cartaoId, armaId: null, alvos: [{ tokenId: alvo, dano }], surpresa: false, perfurante: false, custo: null, acao: null }
}

function agir(duelo: DueloGravado, pedido: Record<string, unknown> | PedidoDeAcao): Record<string, unknown> {
  return { tipo: 'agir', seq: duelo.seq, vez: vezDe(duelo), pedido }
}

/** Quem ainda deve reação: o golpe e o alvo. */
function pendentes(cena: BatalhaDaCena): { golpeId: string; tokenId: string }[] {
  return (cena.turnos.golpes ?? []).flatMap((golpe) => golpe.alvos.filter((alvo) => alvo.danoFinal === undefined).map((alvo) => ({ golpeId: golpe.id, tokenId: alvo.tokenId })))
}

function contaDoToken(tokenId: string): string {
  return tokenId === RIVAL ? CONTA_B : CONTA_A
}

/** Todo alvo que espera toma o golpe inteiro ("não reagir"), pela conta dona dele. */
function semReagir(inicio: DueloGravado, motor: MotorDoDuelo): DueloGravado {
  let duelo = inicio
  for (const { golpeId, tokenId } of pendentes(duelo.cena)) {
    duelo = aceita(peloFio(duelo, motor, contaDoToken(tokenId), { tipo: 'reagir', seq: duelo.seq, pedido: { tipo: 'naoReagir', golpeId, tokenId } }), 'não reagir')
  }
  return duelo
}

/** O que a jogada mudou e não depende de id sorteado: HP, SP e Escudo de cada ficha, recarga, usos, carga e os selos. */
function retrato(personagens: readonly Personagem[], cena: BatalhaDaCena) {
  return {
    fichas: personagens.map((personagem) => ({ nome: personagem.nome, hp: numeroDaFicha(personagem.recursos, 'hp'), sp: numeroDaFicha(personagem.recursos, 'sp'), escudo: numeroDaFicha(personagem.recursos, 'escudo') })),
    combate: Object.values(cena.turnos.combate ?? {}).map((combate) => ({ recargas: combate.recargas, usos: combate.usos, carga: combate.carga, overload: combate.overload, evoluidas: combate.evoluidas ?? [] })),
    selos: (cena.turnos.selos ?? []).map((selo) => ({ tokenId: selo.tokenId, nome: selo.nome, turnos: selo.turnos })),
    vez: cena.turnos.vez,
    rodada: cena.turnos.rodada,
  }
}

function retratoDoDuelo(duelo: DueloGravado) {
  return retrato(duelo.lutadores.personagens, duelo.cena)
}

/** O mesmo estado na store do app, chamada direto (o jogador por LAN): o pedido vai como a mira do app o manda. */
function noApp(duelo: DueloGravado, pedido: PedidoDeAcao) {
  const copia = structuredClone({ lutadores: duelo.lutadores, cena: duelo.cena })
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, copia.lutadores)
  const loja = criarBatalhaStore(mesa, { rolarD20: () => D20_FIXO, outraBatalhaLigada: () => false })
  loja.setState({ cenas: { [CENA_DO_DUELO]: copia.cena } })
  const jogador = (contaId: string): AutorDaAcao => ({ tipo: 'jogador', playerId: contaId, nome: contaId })
  const cena = (): BatalhaDaCena => {
    const atual = loja.getState().cenas[CENA_DO_DUELO]
    if (atual === undefined) throw new Error('a batalha do app não está ligada')
    return atual
  }
  const aceito = loja.getState().agir(CENA_DO_DUELO, jogador(CONTA_A), vezDe(duelo), pedido)
  for (const { golpeId, tokenId } of pendentes(cena())) {
    const reacao: PedidoDeReacao = { tipo: 'naoReagir', golpeId, tokenId }
    if (!loja.getState().reagir(CENA_DO_DUELO, jogador(contaDoToken(tokenId)), reacao)) throw new Error('o app recusou o não reagir')
  }
  return { aceito, retrato: retrato(mesa.personagens(), cena()) }
}

function copiaDe(duelo: DueloGravado, nome: string): Personagem {
  const achada = duelo.lutadores.personagens.find((personagem) => personagem.nome === nome)
  if (achada === undefined) throw new Error(`sem a cópia de ${nome}`)
  return achada
}

function hpDe(duelo: DueloGravado, nome: string): number {
  return numeroDaFicha(copiaDe(duelo, nome).recursos, 'hp')
}

function spDe(duelo: DueloGravado, nome: string): number {
  return numeroDaFicha(copiaDe(duelo, nome).recursos, 'sp')
}

// ─────────────────────────────────────────────────────────────────────────

describe('a mesma jogada dá o mesmo resultado no app (store direta) e no site (fio + aplicarJogada)', () => {
  it('Atacar, técnica com custo e recarga e a cura por peças: HP, SP, recarga, usos e selos iguais', () => {
    const { motor } = motorContado()
    const duelo = novoDuelo(motor)
    const curandeira = copiaDe(duelo, 'Curandeira de Teste')
    const faca = armasDe(curandeira).find((arma) => arma.id === FACA.id) ?? null
    const danoDaFaca = danoSugeridoDoAtaque(curandeira, SISTEMA_DO_TESTE, faca, null)
    if (faca === null || danoDaFaca === null) throw new Error('a Faca devia dar dano lido da ficha')
    const casos: readonly { nome: string; doApp: PedidoDeAcao; doSite: PedidoDeAcao }[] = [
      // O app manda o dano que a mira mostra; o site manda o mesmo pedido e o servidor ignora o número.
      { nome: 'Atacar', doApp: { tipo: 'atacar', armaId: FACA.id, alvos: [{ tokenId: RIVAL, dano: danoDaFaca }], surpresa: false, perfurante: false }, doSite: { tipo: 'atacar', armaId: FACA.id, alvos: [{ tokenId: RIVAL, dano: null }], surpresa: false, perfurante: false } },
      { nome: 'Estocada', doApp: tecnica(ESTOCADA.id, RIVAL, 100), doSite: tecnica(ESTOCADA.id, RIVAL) },
      { nome: 'Sopro Morno', doApp: tecnica(SOPRO.id, ESCUDEIRO), doSite: tecnica(SOPRO.id, ESCUDEIRO) },
    ]
    for (const { nome, doApp, doSite } of casos) {
      const app = noApp(duelo, doApp)
      const site = semReagir(aceita(peloFio(duelo, motor, CONTA_A, agir(duelo, doSite)), nome), motor)
      expect(app.aceito, nome).toBe(true)
      expect(retratoDoDuelo(site), nome).toEqual(app.retrato)
    }
    // Os números absolutos, para a igualdade não ser "os dois errados": Estocada = Força 60 + 40; o Sopro = Espírito 50.
    const estocada = semReagir(aceita(peloFio(duelo, motor, CONTA_A, agir(duelo, tecnica(ESTOCADA.id, RIVAL))), 'Estocada'), motor)
    expect([hpDe(estocada, 'Rival de Teste'), spDe(estocada, 'Curandeira de Teste')]).toEqual([400, 100])
    const sopro = aceita(peloFio(duelo, motor, CONTA_A, agir(duelo, tecnica(SOPRO.id, ESCUDEIRO))), 'Sopro Morno')
    expect([hpDe(sopro, 'Escudeiro de Teste'), spDe(sopro, 'Curandeira de Teste')]).toEqual([170, 90])
  })

  it('a "Explosão" (10% da vida atual do alvo) funciona no site: 500 → 450, 40 SP, igual ao app', () => {
    const { motor } = motorContado()
    const duelo = novoDuelo(motor)
    const app = noApp(duelo, tecnica(ESTOURO.id, RIVAL, 0))
    const site = semReagir(aceita(peloFio(duelo, motor, CONTA_A, agir(duelo, tecnica(ESTOURO.id, RIVAL))), 'Estouro'), motor)
    expect(app.aceito).toBe(true)
    expect(retratoDoDuelo(site)).toEqual(app.retrato)
    expect([hpDe(site, 'Rival de Teste'), spDe(site, 'Curandeira de Teste')]).toEqual([450, 80])
  })
})

describe('cliente malicioso: número inventado (dano, custo, cura)', () => {
  it('a cura com 9999 de cura, custo 0 e Ação Livre forjados = a cura honesta (+50 HP, -30 SP, 1 uso, a Simples gasta)', () => {
    const { motor } = motorContado()
    const duelo = novoDuelo(motor)
    const honesta = aceita(peloFio(duelo, motor, CONTA_A, agir(duelo, tecnica(SOPRO.id, ESCUDEIRO))), 'a cura honesta')
    const forjado = { tipo: 'habilidade', cartaoId: SOPRO.id, armaId: null, alvos: [{ tokenId: ESCUDEIRO, dano: -9999, cura: 9999 }], surpresa: false, perfurante: true, perfuracao: 100, custo: 0, acao: 'livre', cura: 9999, quanto: 9999 }
    const forjada = aceita(peloFio(duelo, motor, CONTA_A, agir(duelo, forjado)), 'a cura forjada')
    expect(retratoDoDuelo(forjada)).toEqual(retratoDoDuelo(honesta))
    expect([hpDe(forjada, 'Escudeiro de Teste'), spDe(forjada, 'Curandeira de Teste')]).toEqual([170, 90])
    // A ação "livre" forjada não vale: a Simples foi gasta, e a 2ª cura na mesma vez é recusada pela regra.
    const segunda = peloFio(forjada, motor, CONTA_A, agir(forjada, forjado))
    expect(segunda).toEqual({ ok: false, motivo: 'regra', texto: 'A ação simples deste turno já foi usada' })
  })

  it('o golpe com dano 9999, custo 0, Perfurante e 100% de perfuração forjados = o golpe honesto (100 de dano, 20 SP, recarga)', () => {
    const { motor } = motorContado()
    const duelo = novoDuelo(motor)
    const honesto = semReagir(aceita(peloFio(duelo, motor, CONTA_A, agir(duelo, tecnica(ESTOCADA.id, RIVAL))), 'o golpe honesto'), motor)
    const forjado = { tipo: 'habilidade', cartaoId: ESTOCADA.id, armaId: null, alvos: [{ tokenId: RIVAL, dano: 9999 }], surpresa: false, perfurante: true, perfuracao: 100, custo: 0, acao: 'livre' }
    const comForja = semReagir(aceita(peloFio(duelo, motor, CONTA_A, agir(duelo, forjado)), 'o golpe forjado'), motor)
    expect(retratoDoDuelo(comForja)).toEqual(retratoDoDuelo(honesto))
    expect([hpDe(comForja, 'Rival de Teste'), spDe(comForja, 'Curandeira de Teste')]).toEqual([400, 100])
  })
})

describe('cliente malicioso: a Vantagem pedida no d20 da reação', () => {
  it('rolar com "vantagem" rola 1 dado só e dá o mesmo que rolar sem ela; a passiva chega sem custo nem selo digitados', () => {
    const comum = motorContado()
    const inicio = novoDuelo(comum.motor)
    const duelo = aceita(peloFio(inicio, comum.motor, CONTA_A, agir(inicio, tecnica(ESTOCADA.id, RIVAL))), 'a Estocada')
    const [espera] = pendentes(duelo.cena)
    if (espera === undefined) throw new Error('o Rival devia esperar a reação')
    const rolar = (vantagem?: string) => ({ tipo: 'reagir', seq: duelo.seq, pedido: { tipo: 'rolar', golpeId: espera.golpeId, tokenId: RIVAL, modificador: 50, ...(vantagem === undefined ? {} : { vantagem }) } })
    const honesto = motorContado()
    const semVantagem = aceita(peloFio(duelo, honesto.motor, CONTA_B, rolar()), 'rolar')
    const malicioso = motorContado()
    const comVantagem = aceita(peloFio(duelo, malicioso.motor, CONTA_B, rolar('vantagem')), 'rolar com vantagem')
    expect([honesto.dados(), malicioso.dados()]).toEqual([1, 1])
    expect(retratoDoDuelo(comVantagem)).toEqual(retratoDoDuelo(semVantagem))

    const passiva = jogadaDoValor({ tipo: 'passiva', seq: 0, pedido: { tipo: 'passiva', tokenId: CURANDEIRA, cartaoId: 'cart_qualquer', ligar: true, custo: 0, selo: { nome: 'Imortal', duracao: 99 } } })
    expect(passiva).toEqual({ tipo: 'passiva', seq: 0, pedido: { tipo: 'passiva', tokenId: CURANDEIRA, cartaoId: 'cart_qualquer', ligar: true, custo: null } })
  })
})

describe('cliente malicioso: agir fora da vez', () => {
  it('a conta B, na vez da Curandeira, mente a vez (a carta dela) e tenta passar a vez dos outros: recusada, e o duelo fica como estava', () => {
    const { motor } = motorContado()
    const duelo = novoDuelo(motor)
    const antes = structuredClone(duelo)
    const cartaDoRival = duelo.cena.turnos.cartas.find((carta) => carta.tokenId === RIVAL)
    if (cartaDoRival === undefined) throw new Error('sem a carta do Rival')
    const vezMentida = { cartaId: cartaDoRival.id, rodada: duelo.cena.turnos.rodada }
    const golpe = { tipo: 'habilidade', cartaoId: RAJADA.id, armaId: null, alvos: [{ tokenId: CURANDEIRA, dano: 9999 }], surpresa: false, perfurante: false, custo: null, acao: null }
    expect(peloFio(duelo, motor, CONTA_B, { tipo: 'agir', seq: duelo.seq, vez: vezMentida, pedido: golpe })).toEqual({ ok: false, motivo: 'naoEDaConta' })
    expect(peloFio(duelo, motor, CONTA_B, { tipo: 'passar', seq: duelo.seq, vez: vezDe(duelo) })).toEqual({ ok: false, motivo: 'naoEDaConta' })
    expect(peloFio(duelo, motor, CONTA_B, { tipo: 'andar', seq: duelo.seq, vez: vezMentida, tokenId: RIVAL, col: 8, row: 4 })).toEqual({ ok: false, motivo: 'regra', texto: 'Só dá para andar na vez desta ficha' })
    expect(duelo).toEqual(antes)
  })

  it('a conta A com a vez de outra rodada, ou com um contra-ataque que não existe: recusada pela regra, com o motivo dela', () => {
    const { motor } = motorContado()
    const duelo = novoDuelo(motor)
    const antes = structuredClone(duelo)
    const deOutraRodada = peloFio(duelo, motor, CONTA_A, { tipo: 'agir', seq: duelo.seq, vez: { ...vezDe(duelo), rodada: duelo.cena.turnos.rodada + 1 }, pedido: tecnica(ESTOCADA.id, RIVAL) })
    expect(deOutraRodada).toMatchObject({ ok: false, motivo: 'regra' })
    const semContra = peloFio(duelo, motor, CONTA_A, { tipo: 'agir', seq: duelo.seq, vez: null, pedido: { ...tecnica(ESTOCADA.id, RIVAL), contraDe: 'golpe_que_nao_existe' } })
    expect(semContra).toMatchObject({ ok: false, motivo: 'regra' })
    expect(duelo).toEqual(antes)
  })
})

describe('cliente malicioso: agir com a ficha que não é dele', () => {
  it('a conta B não reage, não liga passiva, não troca armas nem evolui pelas fichas da conta A; a conta de fora não joga', () => {
    const { motor } = motorContado()
    const inicio = novoDuelo(motor)
    // O Rival passa a ser alvo: a reação esperando é dele, e a conta A tenta responder por ele.
    const duelo = aceita(peloFio(inicio, motor, CONTA_A, agir(inicio, tecnica(ESTOCADA.id, RIVAL))), 'a Estocada')
    const antes = structuredClone(duelo)
    const [espera] = pendentes(duelo.cena)
    if (espera === undefined) throw new Error('o Rival devia esperar a reação')
    const idDaCurandeira = copiaDe(duelo, 'Curandeira de Teste').id
    const tentativas: readonly { caso: string; conta: string; jogada: Record<string, unknown> }[] = [
      { caso: 'A reage pelo Rival', conta: CONTA_A, jogada: { tipo: 'reagir', seq: duelo.seq, pedido: { tipo: 'naoReagir', golpeId: espera.golpeId, tokenId: RIVAL } } },
      { caso: 'B liga passiva da Curandeira', conta: CONTA_B, jogada: { tipo: 'passiva', seq: duelo.seq, pedido: { tipo: 'passiva', tokenId: CURANDEIRA, cartaoId: SOPRO.id, ligar: true, custo: null } } },
      { caso: 'B troca as armas da Curandeira', conta: CONTA_B, jogada: { tipo: 'armas', seq: duelo.seq, personagemId: idDaCurandeira, armas: [] } },
      { caso: 'B evolui a técnica da Curandeira', conta: CONTA_B, jogada: { tipo: 'evoluir', seq: duelo.seq, pedido: { tipo: 'evoluir', tokenId: CURANDEIRA, cartaoId: SALTO.id, custo: 0 } } },
      { caso: 'B anda com o Escudeiro', conta: CONTA_B, jogada: { tipo: 'andar', seq: duelo.seq, vez: vezDe(duelo), tokenId: ESCUDEIRO, col: 5, row: 5 } },
    ]
    for (const { caso, conta, jogada } of tentativas) expect(peloFio(duelo, motor, conta, jogada), caso).toEqual({ ok: false, motivo: 'naoEDaConta' })
    expect(peloFio(duelo, motor, 'conta_de_fora', { tipo: 'passar', seq: duelo.seq, vez: vezDe(duelo) })).toEqual({ ok: false, motivo: 'naoJoga' })
    expect(duelo).toEqual(antes)
  })

  it('a passiva que a regra recusa volta com o motivo da regra (a tela do site não cai na frase genérica)', () => {
    const { motor } = motorContado()
    const duelo = novoDuelo(motor)
    const antes = structuredClone(duelo)
    const passiva = (cartaoId: string): Record<string, unknown> => ({ tipo: 'passiva', seq: duelo.seq, pedido: { tipo: 'passiva', tokenId: CURANDEIRA, cartaoId, ligar: true, custo: null } })
    expect(peloFio(duelo, motor, CONTA_A, passiva('cart_que_nao_existe'))).toEqual({ ok: false, motivo: 'regra', texto: 'Passiva não encontrada na ficha' })
    expect(peloFio(duelo, motor, CONTA_A, passiva(SOPRO.id))).toEqual({ ok: false, motivo: 'regra', texto: 'Esta habilidade não é passiva' })
    expect(duelo).toEqual(antes)
  })
})

describe('cliente malicioso: técnica e arma que a ficha não tem', () => {
  it('a Curandeira pede a Rajada e o Machado do Rival: a regra recusa com o motivo, sem gastar nada', () => {
    const { motor } = motorContado()
    const duelo = novoDuelo(motor)
    const antes = structuredClone(duelo)
    expect(peloFio(duelo, motor, CONTA_A, agir(duelo, tecnica(RAJADA.id, RIVAL, 9999)))).toEqual({ ok: false, motivo: 'regra', texto: 'Técnica não encontrada na ficha' })
    const comOMachado = peloFio(duelo, motor, CONTA_A, agir(duelo, { tipo: 'atacar', armaId: MACHADO.id, alvos: [{ tokenId: RIVAL, dano: 9999 }], surpresa: false, perfurante: false }))
    expect(comOMachado).toMatchObject({ ok: false, motivo: 'regra' })
    expect(comOMachado.ok ? '' : (comOMachado.texto ?? '')).not.toBe('')
    expect(duelo).toEqual(antes)
  })
})

describe('cliente malicioso: repetir a mesma jogada (seq)', () => {
  it('a cura mandada duas vezes com o mesmo seq cura uma vez só; o seq do futuro também é recusado', () => {
    const { motor } = motorContado()
    const duelo = novoDuelo(motor)
    const jogada = agir(duelo, tecnica(SOPRO.id, ESCUDEIRO))
    const curado = aceita(peloFio(duelo, motor, CONTA_A, jogada), 'a cura')
    const antes = structuredClone(curado)
    expect(peloFio(curado, motor, CONTA_A, jogada)).toEqual({ ok: false, motivo: 'seqVelho' })
    expect(peloFio(curado, motor, CONTA_A, { ...jogada, seq: curado.seq + 1 })).toEqual({ ok: false, motivo: 'seqVelho' })
    expect(curado).toEqual(antes)
    expect(hpDe(curado, 'Escudeiro de Teste')).toBe(170)
  })
})

describe('cliente malicioso: evoluir pagando 0', () => {
  const evoluir = (duelo: DueloGravado, custo: number | null) => ({ tipo: 'evoluir', seq: duelo.seq, pedido: { tipo: 'evoluir', tokenId: CURANDEIRA, cartaoId: SALTO.id, custo } })

  it('entre contas o Evoluir é recusado com o motivo (custo 0, sem custo ou pagando): nada evolui e nenhum SP sai', () => {
    const { motor } = motorContado()
    const duelo = novoDuelo(motor)
    const antes = structuredClone(duelo)
    for (const custo of [0, null, 30]) {
      const recusada = peloFio(duelo, motor, CONTA_A, evoluir(duelo, custo))
      expect(recusada, `custo ${String(custo)}`).toEqual({ ok: false, motivo: 'foraDoDuelo', texto: 'Evoluir é só no treino: o custo e a condição da evolução estão no texto da ficha, e na luta entre contas ninguém confere' })
    }
    expect(duelo).toEqual(antes)
  })

  it('no treino local (os dois lados são de quem joga) o Evoluir segue valendo, com o custo digitado', () => {
    const { motor } = motorContado()
    const duelo = novoDuelo(motor)
    const lida = lerJogadaDoDuelo(JSON.stringify(evoluir(duelo, 30)))
    if (!lida.ok) throw new Error('o fio recusou o Evoluir')
    const evoluido = aceita(aplicarJogada(duelo, motor, CONTA_A, lida.jogada, 'livre'), 'o Evoluir no treino')
    expect(retratoDoDuelo(evoluido).combate.flatMap((combate) => combate.evoluidas)).toEqual([SALTO.id])
    expect(spDe(evoluido, 'Curandeira de Teste')).toBe(90)
  })
})

// ─── Fechamentos de 10/11/2026: a frase da recusa, os alvos e o número perguntado ───

const PISTOLA = cartao('arma_pistola', 'Pistola de Tinta', { dano: '20', acao: 'Ação Simples', categoria: 'De fogo', atributoDoAtaque: 'Percepção' })
/** A passiva de marca inventada: o teste com CD ou 30 de SP. */
const OLHAR = cartao('cart_olhar', 'Olhar de Pintor', { acao: 'Passiva', tipo: 'Passiva', efeito: 'Ao acertar um tiro, pode deixar uma marca de tinta no alvo.', custo: 'Teste de Percepção Cd 15 ou Gastar 30 de SP' })

function rivalDeTeste(): Personagem {
  return daConta(ficha('Rival de Teste', { forca: 50, agilidade: 40 }, { hp: 500, sp: 60, escudo: 0 }, { armas: [MACHADO] }), CONTA_B)
}

/** O Pintor (20 de SP: não paga os 30 da marca) abre a luta contra o Rival. */
function dueloDoPintor(motor: MotorDoDuelo): DueloGravado {
  const pintor = ficha('Pintor de Teste', { forca: 10, percepcao: 35, agilidade: 90 }, { hp: 400, sp: 20, escudo: 0 }, { habilidades: [OLHAR], armas: [PISTOLA] })
  return dueloCom([daConta(pintor, CONTA_A)], [rivalDeTeste()], motor)
}

describe('a recusa volta com a frase da regra (a marca e a passiva pedida como técnica)', () => {
  it('pagar a marca sem o SP: "SP insuficiente", e o lembrete segue esperando', () => {
    const { motor } = motorContado()
    const inicio = dueloDoPintor(motor)
    const tiro = { tipo: 'atacar', armaId: PISTOLA.id, alvos: [{ tokenId: RIVAL, dano: null }], surpresa: false, perfurante: false }
    const duelo = semReagir(aceita(peloFio(inicio, motor, CONTA_A, agir(inicio, tiro)), 'o tiro'), motor)
    const lembreteId = duelo.cena.turnos.lembretesDaMarca?.[0]?.id
    if (lembreteId === undefined) throw new Error('o tiro que acerta devia lembrar a marca')
    const antes = structuredClone(duelo)
    expect(peloFio(duelo, motor, CONTA_A, { tipo: 'marcar', seq: duelo.seq, pedido: { tipo: 'marcar', lembreteId, como: 'sp' } })).toEqual({ ok: false, motivo: 'regra', texto: 'SP insuficiente: custa 30, você tem 20' })
    expect(duelo).toEqual(antes)
  })

  it('a passiva pedida como técnica: a regra manda usar a tira Passivas (não "dano digitado à mão")', () => {
    const { motor } = motorContado()
    const duelo = dueloDoPintor(motor)
    expect(peloFio(duelo, motor, CONTA_A, agir(duelo, tecnica(OLHAR.id, RIVAL)))).toEqual({ ok: false, motivo: 'regra', texto: 'Passiva: use a tira Passivas' })
  })
})
