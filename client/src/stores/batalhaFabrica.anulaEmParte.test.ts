// @vitest-environment node
/**
 * ANULA SÓ UMA PARTE (pedido do dono de 28/11/2026, 0.6.10: "coloca para eu anular tudo ou só uma parte,
 * número ou porcentagem"): a passiva "Corpo de Fumaça" com a peça Dispara sozinha, o gatilho "Ao ser
 * atingido (antes do dano)" e o efeito "Anula o dano", montada como o Salvar do editor monta
 * (`cartaoComAMecanica` + `cartaoComTextoGerado`) e usada na store do app (`criarBatalhaStore`) sobre a
 * mesa em memória do treino. O pirata bate 45 no Hector, o Hector não reage, e o motor
 * (`anulacaoNoGolpe`, `stores/batalha/golpe.ts` acertoComMarca) decide quanto chega na ficha.
 */
import { describe, expect, it } from 'vitest'
import { cartaoComAMecanica } from '../components/batalha/editor/gravarNoCartao'
import { ANULA_DE_PARTIDA, type CorteDoAnula } from '../lib/batalha/anulaODano'
import type { PedidoDeAcao } from '../lib/batalha/combate'
import { ficha } from '../lib/batalha/fichasDaFatiaB.testkit'
import type { MecanicaV1 } from '../lib/batalha/mecanica/modelo'
import { mecanicaDoModeloNovo } from '../lib/batalha/mecanica/modelos'
import { cartaoComTextoGerado } from '../lib/batalha/mecanica/textoGerado'
import type { VezEsperada } from '../lib/batalha/ponte'
import { combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import { novoCartao, numeroDaFicha, type CartaoDaFicha, type Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria, type MesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_do_anula'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }
const PASSIVA = 'Corpo de Fumaça'
const GOLPE = 45
const HP = 800
const ATRIBUTOS = { forca: 10, agilidade: 10, percepcao: 10, resistencia: 10, intuicao: 10, espirito: 10, carisma: 10, determinacao: 10 }

/** O Hector sem a passiva (age depois do pirata). */
const hectorSemPassiva = (): Personagem => ficha('Hector', ATRIBUTOS, { hp: HP, sp: 50, escudo: 0 }, {})
/** O pirata (age primeiro). */
const pirata = (): Personagem => ficha('Pirata', { ...ATRIBUTOS, agilidade: 40 }, { hp: 500, sp: 50, escudo: 0 }, {})

/**
 * A passiva como o Salvar do editor a grava (mestre): a peça Dispara sozinha "Ao ser atingido (antes do
 * dano)" com o "Anula o dano" de partida, sem limite (vale a cada golpe) e com o `corte` pedido
 * (ausente = tudo, toma 0). A base é a de toda passiva montada (o Fôlego de Batalha), sem as peças dele.
 */
function passivaDoEditor(heroi: Personagem, corte: CorteDoAnula | undefined): CartaoDaFicha {
  const anula = { tipo: 'anula' as const, ...ANULA_DE_PARTIDA, por: 'sempre' as const, ...(corte === undefined ? {} : { corte }) }
  const mecanica: MecanicaV1 = { ...mecanicaDoModeloNovo('folegoDeBatalha', SISTEMA_DO_TESTE), pecas: [{ tipo: 'gatilho', quando: 'aoSerAtingido', n: 2, vezes: 'sempre', pergunta: false, efeitos: [anula] }] }
  const base = novoCartao(PASSIVA)
  const montado = cartaoComAMecanica(base, mecanica, 'mestre', { personagem: heroi, sistema: SISTEMA_DO_TESTE })
  if (montado === null) throw new Error('o editor recusou a passiva')
  return cartaoComTextoGerado(base, montado, SISTEMA_DO_TESTE, 'tecnica')
}

function batalha(corte: CorteDoAnula | undefined): { loja: LojaDaBatalha; mesa: MesaEmMemoria } {
  const semPassiva = hectorSemPassiva()
  const hector: Personagem = { ...semPassiva, abas: { ...semPassiva.abas, habilidades: [passivaDoEditor(semPassiva, corte)] } }
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: pirata(), lado: 'a' }, { ficha: hector, lado: 'b' }]))
  const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
  const tokens = mesa.tokens()
  loja.getState().ligar(CENA, {}, { combatentes: combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id))), regras: null, desempate: 'd20' })
  return { loja, mesa }
}

function cena(loja: LojaDaBatalha): BatalhaDaCena {
  const atual = loja.getState().cenas[CENA]
  if (atual === undefined) throw new Error('a batalha não ligou')
  return atual
}

function naVezDe(loja: LojaDaBatalha, nome: string): VezEsperada {
  for (let i = 0; i < 4; i += 1) {
    const { turnos } = cena(loja)
    if (turnos.vez === null) throw new Error('sem vez')
    const vez = { cartaId: turnos.vez, rodada: turnos.rodada }
    if (turnos.cartas.find((carta) => carta.id === turnos.vez)?.nome === nome) return vez
    expect(loja.getState().passarVez(CENA, MESTRE, vez)).toBe(true)
  }
  throw new Error(`a vez de ${nome} não chegou`)
}

function token(loja: LojaDaBatalha, nome: string): string {
  const achada = cena(loja).turnos.cartas.find((carta) => carta.nome === nome)
  if (achada === undefined) throw new Error(`sem a carta de ${nome}`)
  return achada.tokenId
}

const hpDoHector = (mesa: MesaEmMemoria): number => numeroDaFicha(mesa.personagens().find((personagem) => personagem.nome === 'Hector')?.recursos ?? {}, 'hp')
const textos = (loja: LojaDaBatalha): string[] => cena(loja).registro.map((linha) => linha.texto)

/** O pirata bate `GOLPE` no Hector e o Hector não reage: o golpe resolve e o dano (ou o que sobra dele) entra na ficha. */
function golpeNoHector(loja: LojaDaBatalha): void {
  const doHector = token(loja, 'Hector')
  const atacar: PedidoDeAcao = { tipo: 'atacar', armaId: null, alvos: [{ tokenId: doHector, dano: GOLPE }], surpresa: false, perfurante: false }
  expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Pirata'), atacar)).toBe(true)
  const golpe = cena(loja).turnos.golpes?.[0]
  if (golpe === undefined) throw new Error('o golpe não esperou a reação do Hector')
  expect(loja.getState().reagir(CENA, MESTRE, { tipo: 'naoReagir', golpeId: golpe.id, tokenId: doHector })).toBe(true)
  expect(cena(loja).turnos.golpes ?? []).toHaveLength(0)
}

describe('Anula o dano em parte, na passiva montada no editor', () => {
  it('sem a passiva, o golpe de 45 tira 45 (a régua dos outros casos)', () => {
    const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: pirata(), lado: 'a' }, { ficha: hectorSemPassiva(), lado: 'b' }]))
    const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
    const tokens = mesa.tokens()
    loja.getState().ligar(CENA, {}, { combatentes: combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((tokenDaMesa) => tokenDaMesa.id))), regras: null, desempate: 'd20' })
    golpeNoHector(loja)
    expect(hpDoHector(mesa)).toBe(HP - GOLPE)
  })

  it('corte −15: 45 vira 30, e o registro diz "anulou 15 do dano (45 → 30)"', () => {
    const { loja, mesa } = batalha({ menos: 15 })
    golpeNoHector(loja)
    expect(hpDoHector(mesa)).toBe(HP - 30)
    expect(textos(loja).some((texto) => texto.includes(`${PASSIVA}: Hector anulou 15 do dano (45 → 30)`))).toBe(true)
  })

  it('corte −30%: 45 × 70% = 31,5 arredonda para 32 (Math.round, como os cortes do dano), "anulou 13 do dano (45 → 32)"', () => {
    const { loja, mesa } = batalha({ porcento: 30 })
    golpeNoHector(loja)
    expect(hpDoHector(mesa)).toBe(HP - 32)
    expect(textos(loja).some((texto) => texto.includes(`${PASSIVA}: Hector anulou 13 do dano (45 → 32)`))).toBe(true)
  })

  it('corte −60 maior que o golpe: o dano para em 0, nunca cura ("anulou 45 do dano (45 → 0)")', () => {
    const { loja, mesa } = batalha({ menos: 60 })
    golpeNoHector(loja)
    expect(hpDoHector(mesa)).toBe(HP)
    expect(textos(loja).some((texto) => texto.includes(`${PASSIVA}: Hector anulou 45 do dano (45 → 0)`))).toBe(true)
  })

  it('tudo (sem corte, o de partida) e −100%: toma 0, "Intangível: Hector tomou 0 de dano (Corpo de Fumaça)"', () => {
    for (const corte of [undefined, { porcento: 100 }] as const) {
      const { loja, mesa } = batalha(corte)
      golpeNoHector(loja)
      expect(hpDoHector(mesa)).toBe(HP)
      expect(textos(loja).some((texto) => texto.includes(`Intangível: Hector tomou 0 de dano (${PASSIVA})`))).toBe(true)
    }
  })
})
