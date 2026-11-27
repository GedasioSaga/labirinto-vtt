// @vitest-environment node
/**
 * REWORK DO EDITOR DE HABILIDADES (0.6.5, docs/design/habilidades-rework/PLANO.md, E8): os dois exemplos
 * do dono montados como o editor monta (`cartaoComAMecanica` + `cartaoComTextoGerado`, o Salvar) e
 * usados na store do app (`criarBatalhaStore`) sobre a mesa em memória do treino. Nenhum número é posto
 * à mão no estado da batalha: tudo entra por `agir` e `passarVez`.
 *
 * 2. A Caçada Começa (Overload de transformação): dura 3 vezes, +1 ação, +20 de Agilidade, marca a cada
 *    acerto, sem desvio, Fadiga −10 de Agilidade por 2 turnos.
 * 3. Corte Gelado (Diminui atributo): −5 de Velocidade por vez a partir da 1ª, teto 15, volta em 4.
 */
import { describe, expect, it } from 'vitest'
import { cartaoComAMecanica } from '../components/batalha/editor/gravarNoCartao'
import type { PedidoDeAcao } from '../lib/batalha/combate'
import { ficha } from '../lib/batalha/fichasDaFatiaB.testkit'
import { mecanicaDoModeloNovo, type IdDoModeloNovo } from '../lib/batalha/mecanica/modelos'
import { cartaoComTextoGerado } from '../lib/batalha/mecanica/textoGerado'
import type { VezEsperada } from '../lib/batalha/ponte'
import { bonusDaBatalha, totalDoBonus } from '../lib/batalha/selos'
import { combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import { valorDoRank } from '../lib/ajusteDaFicha'
import { novoCartao, numeroDaFicha, type CartaoDaFicha, type Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria, type MesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_da_batalha'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }
const HEROI = 'Caçador'
const ATRIBUTOS_DO_HEROI = { forca: 40, agilidade: 30, percepcao: 20, resistencia: 30, intuicao: 10, espirito: 10, carisma: 10, determinacao: 20 }
const ATRIBUTOS_DO_PIRATA = { forca: 10, agilidade: 10, percepcao: 10, resistencia: 10, intuicao: 10, espirito: 10, carisma: 10, determinacao: 10 }
const pirata = (): Personagem => ficha('Pirata 1', ATRIBUTOS_DO_PIRATA, { hp: 2000, sp: 50, escudo: 0 }, {})

/** O cartão como o Salvar do editor o grava (mestre): a mecânica do modelo e os campos que ela gera. */
function montadoPeloEditor(modelo: IdDoModeloNovo, nome: string, heroi: Personagem): CartaoDaFicha {
  const base = novoCartao(nome)
  const montado = cartaoComAMecanica(base, mecanicaDoModeloNovo(modelo, SISTEMA_DO_TESTE), 'mestre', { personagem: heroi, sistema: SISTEMA_DO_TESTE })
  if (montado === null) throw new Error(`o editor recusou o modelo ${modelo}`)
  return cartaoComTextoGerado(base, montado, SISTEMA_DO_TESTE, 'tecnica')
}

function batalha(heroi: Personagem): { loja: LojaDaBatalha; mesa: MesaEmMemoria } {
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: heroi, lado: 'a' }, { ficha: pirata(), lado: 'b' }]))
  const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
  const tokens = mesa.tokens()
  const combatentes = combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id)))
  loja.getState().ligar(CENA, {}, { combatentes, regras: null, desempate: 'd20' })
  return { loja, mesa }
}

function cena(loja: LojaDaBatalha): BatalhaDaCena {
  const atual = loja.getState().cenas[CENA]
  if (atual === undefined) throw new Error('a batalha não ligou')
  return atual
}

/** Passa a vez até chegar a de `nome`; `passarAntes` = passa a de agora primeiro (a próxima vez dele). */
function naVezDe(loja: LojaDaBatalha, nome: string, passarAntes = false): VezEsperada {
  for (let i = 0; i < 8; i += 1) {
    const { turnos } = cena(loja)
    if (turnos.vez === null) throw new Error('sem vez')
    const vez = { cartaId: turnos.vez, rodada: turnos.rodada }
    if (!(passarAntes && i === 0) && turnos.cartas.find((carta) => carta.id === turnos.vez)?.nome === nome) return vez
    expect(loja.getState().passarVez(CENA, MESTRE, vez)).toBe(true)
  }
  throw new Error(`a vez de ${nome} não chegou`)
}

function token(loja: LojaDaBatalha, nome: string): string {
  const achada = cena(loja).turnos.cartas.find((carta) => carta.nome === nome)
  if (achada === undefined) throw new Error(`sem a carta de ${nome}`)
  return achada.tokenId
}

function pessoa(mesa: MesaEmMemoria, nome: string): Personagem {
  const achada = mesa.personagens().find((candidato) => candidato.nome === nome)
  if (achada === undefined) throw new Error(`sem ${nome}`)
  return achada
}

const atacar = (tokenId: string): PedidoDeAcao => ({ tipo: 'atacar', armaId: null, alvos: [{ tokenId, dano: 100 }], surpresa: false, perfurante: false })
const hpDe = (mesa: MesaEmMemoria, nome: string): number => numeroDaFicha(pessoa(mesa, nome).recursos, 'hp')
const golpesEsperando = (loja: LojaDaBatalha): number => (cena(loja).turnos.golpes ?? []).length
const textos = (loja: LojaDaBatalha): string[] => cena(loja).registro.map((linha) => linha.texto)
const selosDe = (loja: LojaDaBatalha, tokenId: string): string[] => (cena(loja).turnos.selos ?? []).filter((selo) => selo.tokenId === tokenId).map((selo) => selo.nome)
/** A Agilidade que os selos da batalha somam no token (a mesma conta do menu e da mira). */
const agilidadeDosSelos = (loja: LojaDaBatalha, tokenId: string): number => totalDoBonus(bonusDaBatalha(cena(loja).turnos.selos, tokenId), 'agilidade')
/** Quanto de Agilidade os selos tiram do token (0 = nada). */
const perdeu = (loja: LojaDaBatalha, tokenId: string): number => 0 - agilidadeDosSelos(loja, tokenId)

describe('A Caçada Começa montada no editor (Overload de transformação do dono)', () => {
  it('liga, age 2 vezes na vez, marca e dobra no marcado, +20 de Agilidade por 3 vezes; acaba sozinha com a Fadiga e não liga de novo', () => {
    const semForma = ficha(HEROI, ATRIBUTOS_DO_HEROI, { hp: 800, sp: 200, escudo: 0 }, {})
    const cacada = montadoPeloEditor('aCacadaComeca', 'A Caçada Começa', semForma)
    const { loja, mesa } = batalha({ ...semForma, abas: { ...semForma.abas, transformacoes: [cacada] } })
    const doHeroi = token(loja, HEROI)
    const doPirata = token(loja, 'Pirata 1')
    const vez = naVezDe(loja, HEROI)
    const agilidadeAntes = valorDoRank(pessoa(mesa, HEROI), 'agilidade')

    // Overload liga como ação Livre, e a vez continua com a dele.
    expect(loja.getState().agir(CENA, MESTRE, vez, { tipo: 'transformar', cartaoId: cacada.id, acao: 'livre', trocarImagem: false })).toBe(true)
    expect(pessoa(mesa, HEROI).cartoesAtivos).toContain(cacada.id)
    expect(valorDoRank(pessoa(mesa, HEROI), 'agilidade')).toBe(agilidadeAntes + 20)

    // 1º acerto: sem desvio (o pirata nem reage), 100 na hora, e a marca fica no pirata.
    expect(loja.getState().agir(CENA, MESTRE, vez, atacar(doPirata))).toBe(true)
    expect(golpesEsperando(loja)).toBe(0)
    expect(hpDe(mesa, 'Pirata 1')).toBe(1900)
    expect(selosDe(loja, doPirata)).toContain('Marcado')

    // 2º acerto na MESMA vez (+1 ação): o golpe do dono no marcado dá o dobro; a marca usada some e o acerto deixa outra.
    expect(loja.getState().agir(CENA, MESTRE, vez, atacar(doPirata))).toBe(true)
    expect(golpesEsperando(loja)).toBe(0)
    expect(hpDe(mesa, 'Pirata 1')).toBe(1700)
    expect(selosDe(loja, doPirata).filter((nome) => nome === 'Marcado')).toHaveLength(1)

    // Dura 3 vezes depois da que ligou: na 3ª ainda ligada; no fim dela desliga sozinha, com a Fadiga e sem o cansaço antigo.
    for (let vezes = 0; vezes < 3; vezes += 1) naVezDe(loja, HEROI, true)
    expect(pessoa(mesa, HEROI).cartoesAtivos).toContain(cacada.id)
    naVezDe(loja, HEROI, true)
    expect(pessoa(mesa, HEROI).cartoesAtivos).not.toContain(cacada.id)
    expect(valorDoRank(pessoa(mesa, HEROI), 'agilidade')).toBe(agilidadeAntes)
    expect(selosDe(loja, doHeroi)).toContain('Fadiga')
    expect(selosDe(loja, doHeroi)).not.toContain('Cansaço do Overload')
    expect(agilidadeDosSelos(loja, doHeroi)).toBe(-10)
    expect(textos(loja).some((texto) => texto.includes('A Caçada Começa'))).toBe(true)

    // Overload é uma vez por batalha: ligar de novo é recusado.
    const outra = naVezDe(loja, HEROI, true)
    expect(loja.getState().motivoDoAgir(CENA, MESTRE, outra, { tipo: 'transformar', cartaoId: cacada.id, acao: 'livre', trocarImagem: false })).not.toBeNull()
  })
})

describe('Corte Gelado montado no editor (Diminui atributo por turno)', () => {
  // A conta é a do protótipo aprovado (`valorDaQueda`, prototipo.html:1760): "depois de 1 turno" = começa a perder
  // do 2º turno em diante; a queda anda no fim de cada vez de quem tem o selo, e "volta em 4" conta do último acerto.
  it('a Agilidade do pirata cai 5, 10, 15, 15 (o 2º golpe no meio); o golpe novo não soma, só recomeça o prazo; no fim do prazo volta ao normal', () => {
    const semTecnica = ficha(HEROI, ATRIBUTOS_DO_HEROI, { hp: 800, sp: 200, escudo: 0 }, {})
    const corte = montadoPeloEditor('corteGelado', 'Corte Gelado', semTecnica)
    const { loja } = batalha({ ...semTecnica, abas: { ...semTecnica.abas, habilidades: [corte] } })
    const doPirata = token(loja, 'Pirata 1')
    const golpear = (): void => {
      const vez = naVezDe(loja, HEROI)
      expect(loja.getState().agir(CENA, MESTRE, vez, { tipo: 'habilidade', cartaoId: corte.id, armaId: null, alvos: [{ tokenId: doPirata, dano: 50 }], surpresa: false, perfurante: false, custo: null, acao: null })).toBe(true)
      const golpe = cena(loja).turnos.golpes?.[0]
      if (golpe !== undefined) expect(loja.getState().reagir(CENA, MESTRE, { tipo: 'naoReagir', golpeId: golpe.id, tokenId: doPirata })).toBe(true)
    }
    /** A Agilidade que o pirata perdeu depois de cada vez dele (a queda anda na vez de quem tem o selo). */
    const depoisDaVezDoPirata = (): number => {
      naVezDe(loja, 'Pirata 1')
      naVezDe(loja, HEROI)
      return perdeu(loja, doPirata)
    }

    const lento = (): { turnos: number | null } | undefined => (cena(loja).turnos.selos ?? []).find((selo) => selo.tokenId === doPirata && selo.nome === 'Lento')

    golpear()
    expect(perdeu(loja, doPirata)).toBe(0)
    const queda = [depoisDaVezDoPirata(), depoisDaVezDoPirata(), depoisDaVezDoPirata()]
    expect(queda).toEqual([5, 10, 15])
    // Sem golpe novo, o selo teria só mais 1 vez do pirata.
    expect(lento()?.turnos).toBe(1)

    // Golpe novo da mesma técnica: não soma (fica 15, um selo só), o prazo de 4 recomeça.
    golpear()
    expect(perdeu(loja, doPirata)).toBe(15)
    expect(selosDe(loja, doPirata).filter((nome) => nome === 'Lento')).toHaveLength(1)
    expect(lento()?.turnos).toBe(4)
    const prazo: number[] = []
    for (let vezes = 0; vezes < 4; vezes += 1) prazo.push(depoisDaVezDoPirata())
    // A 4ª vez do pirata ainda perde 15: a sequência dele foi 5, 10, 15, 15.
    expect([...queda, prazo[0]]).toEqual([5, 10, 15, 15])
    expect(prazo).toEqual([15, 15, 15, 0])
    expect(lento()).toBeUndefined()
  })
})
