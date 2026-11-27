// @vitest-environment node
/**
 * Rework das condições, E8, teste 1 "Nada some" (docs/design/condicoes-rework/PLANO.md §4): as criadas de
 * antes leem como montadas e fazem na batalha o mesmo de antes; as de hoje postas pelo nome também; a criada
 * de mesmo nome vence a de fábrica; o arquivo sai na versão 2 e o de versão maior é recusado. Na store do app
 * (`criarBatalhaStore`) sobre a mesa em memória do treino, com fichas inventadas.
 */
import { describe, expect, it } from 'vitest'
import type { PedidoDeAcao } from '../lib/batalha/combate'
import { comportamentoDoSelo, curaComOsSelos } from '../lib/batalha/condicoes'
import type { VezEsperada } from '../lib/batalha/ponte'
import { combatentesIniciais, type AutorDaAcao, type CartaDaOrdem } from '../lib/batalha/turnos'
import { condicaoDoCatalogoPeloNome } from '../lib/condicoes/catalogo'
import { montadaDaAntiga } from '../lib/condicoes/montadaDaAntiga'
import { condicoesDoTexto, serializarCondicoes, versaoDasCondicoes } from '../lib/condicoesNoDisco'
import { lerCondicaoPropria } from '../lib/condicoesProprias'
import { numeroDaFicha, personagemDoArquivo, type Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import type { CondicaoPropria } from '../types/map'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_nada_some'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }

function ficha(dados: Record<string, unknown>): Personagem {
  const lida = personagemDoArquivo(dados)
  if (lida === null) throw new Error('ficha de teste inválida')
  return lida
}

/** Age primeiro; dá um soco de 10. */
const BROOK = ficha({
  id: 'pers_brook',
  tipo: 'jogador',
  nome: 'Brook',
  recursos: { hp: 300, sp: 60, escudo: 0 },
  maximos: { hp: 300, sp: 60 },
  atributos: { forca: 30, agilidade: 60 },
  abas: { habilidades: [{ id: 'tec_soco', nome: 'Soco', campos: { acao: 'Simples', custo: '-', tempo: '-', dano: '10' } }] },
})

/** Age depois, ferido (200 de 300), sem Escudo; cura 40 em si com uma ação livre. */
const HECTOR = ficha({
  id: 'pers_hector',
  tipo: 'jogador',
  nome: 'Hector',
  recursos: { hp: 200, sp: 60, escudo: 0 },
  maximos: { hp: 300, sp: 60 },
  atributos: { forca: 30, agilidade: 30 },
  abas: {
    habilidades: [
      {
        id: 'tec_balsamo',
        nome: 'Bálsamo',
        campos: {},
        mecanica: { versao: 1, acao: 'livre', custos: [], alvo: { quem: 'si', forma: { tipo: 'um' } }, teste: { tipo: 'naoErra' }, efeitos: [{ tipo: 'cura', recurso: 'hp', quanto: { fixo: 40 }, emQuem: 'alvo' }] },
      },
    ],
  },
})

// As quatro criadas de antes, como o app de antes as gravava (sem tipo, peças, prazo nem saídas).
const VIDA_5 = { id: 'cond_bruxa', nome: 'Veneno da Bruxa', cor: '#7ac74f', simbolo: 'gota', regra: 'vida', n: 5 }
const CURA_50 = { id: 'cond_maldicao', nome: 'Maldição Seca', cor: '#c77dd1', simbolo: 'cruz', regra: 'cura', n: 50 }
const NARRA = { id: 'cond_pressagio', nome: 'Presságio', cor: '#7fb8f0', simbolo: 'olho', regra: 'narra' }
const COM_GATILHO = { id: 'cond_pavio', nome: 'Pavio Curto', cor: '#ff8a5c', simbolo: 'chama', gatilho: { turnos: 2, vezes: 'uma', aoDisparar: 'some', pecas: [{ tipo: 'dano', valor: 30 }] } }

function lida(cru: Record<string, unknown>): CondicaoPropria {
  const propria = lerCondicaoPropria(cru)
  if (propria === null) throw new Error(`a criada ${String(cru.nome)} não leu`)
  return propria
}

interface Batalha {
  loja: LojaDaBatalha
  hpDe: (nome: string) => number
}

/** A mesa do treino com as criadas da pasta (`condicoesCriadas`, como a mesa da aventura). */
function batalha(criadas: readonly CondicaoPropria[]): Batalha {
  const base = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: BROOK, lado: 'a' }, { ficha: HECTOR, lado: 'b' }]))
  const mesa = { ...base, condicoesCriadas: (): readonly CondicaoPropria[] => criadas }
  const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
  const tokens = mesa.tokens()
  loja.getState().ligar(CENA, {}, { combatentes: combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id))), regras: null, desempate: 'd20' })
  const hpDe = (nome: string): number => {
    const achado = mesa.personagens().find((personagem) => personagem.nome === nome)
    if (achado === undefined) throw new Error(`sem ${nome} na mesa`)
    return numeroDaFicha(achado.recursos, 'hp')
  }
  return { loja, hpDe }
}

function cena(loja: LojaDaBatalha): BatalhaDaCena {
  const atual = loja.getState().cenas[CENA]
  if (atual === undefined) throw new Error('a batalha não ligou')
  return atual
}

function carta(loja: LojaDaBatalha, nome: string): CartaDaOrdem {
  const achada = cena(loja).turnos.cartas.find((candidata) => candidata.nome === nome && candidata.extra === undefined)
  if (achada === undefined) throw new Error(`sem a carta de ${nome}`)
  return achada
}

function naVezDe(loja: LojaDaBatalha, nome: string): VezEsperada {
  for (let i = 0; i < 4; i += 1) {
    const { turnos } = cena(loja)
    if (turnos.vez === null) throw new Error('sem vez')
    const vez = { cartaId: turnos.vez, rodada: turnos.rodada }
    if (turnos.cartas.find((candidata) => candidata.id === turnos.vez)?.nome === nome) return vez
    expect(loja.getState().passarVez(CENA, MESTRE, vez)).toBe(true)
  }
  throw new Error(`a vez de ${nome} não chegou`)
}

const ultimaLinha = (loja: LojaDaBatalha): string => cena(loja).registro[cena(loja).registro.length - 1]?.texto ?? ''

/** Na vez do Hector, o Aplicar do selo que tira por vez. */
function aplicarNoHector(loja: LojaDaBatalha): void {
  naVezDe(loja, 'Hector')
  const { tokenId, personagemId } = carta(loja, 'Hector')
  if (personagemId === null) throw new Error('a carta do Hector não tem ficha')
  const lembrete = (cena(loja).turnos.combate?.[personagemId]?.lembretes ?? []).find((candidato) => candidato.chave.endsWith(':sangra'))
  if (lembrete === undefined) throw new Error('o selo não pediu o Aplicar')
  expect(loja.getState().passiva(CENA, MESTRE, { tipo: 'lembrete', tokenId, cartaoId: lembrete.cartaoId, aplicar: true })).toBe(true)
}

function curarOHector(loja: LojaDaBatalha): void {
  const hector = carta(loja, 'Hector').tokenId
  const pedido: PedidoDeAcao = { tipo: 'habilidade', cartaoId: 'tec_balsamo', armaId: null, alvos: [{ tokenId: hector, dano: null }], surpresa: false, perfurante: false, custo: null, acao: null }
  expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Hector'), pedido)).toBe(true)
}

describe('E8 teste 1: as criadas de antes leem como montadas', () => {
  it('vida 5, cura 50, narra e gatilho viram peças; a regra de antes fica; a 2ª passada é a mesma referência', () => {
    const montadas = [VIDA_5, CURA_50, NARRA, COM_GATILHO].map((cru) => montadaDaAntiga(lida(cru)))
    expect(montadas.map((propria) => (propria.pecas ?? []).map((peca) => peca.tipo))).toEqual([['vez'], ['danoCura'], [], ['gatilho']])
    // "narra" é o padrão: o leitor de sempre não o guarda (ausente = narra).
    expect(montadas.map((propria) => [propria.regra, propria.n])).toEqual([['vida', 5], ['cura', 50], [undefined, undefined], [undefined, undefined]])
    for (const propria of montadas) expect(montadaDaAntiga(propria)).toBe(propria)
  })
})

describe('E8 teste 1: as criadas de antes fazem na batalha o mesmo de antes', () => {
  it('a criada "vida 5" tira 5 pelo Aplicar, direto', () => {
    const { loja, hpDe } = batalha([lida(VIDA_5)])
    expect(loja.getState().porSelo(CENA, carta(loja, 'Hector').tokenId, { nome: 'Veneno da Bruxa', turnos: 3 })).toBe(true)
    aplicarNoHector(loja)
    expect(hpDe('Hector')).toBe(195)
    expect(ultimaLinha(loja)).toContain('-5 HP')
  })

  it('a criada "cura 50": a cura 40 chega 20', () => {
    const { loja, hpDe } = batalha([lida(CURA_50)])
    expect(loja.getState().porSelo(CENA, carta(loja, 'Hector').tokenId, { nome: 'Maldição Seca', turnos: 3 })).toBe(true)
    curarOHector(loja)
    expect(hpDe('Hector')).toBe(220)
  })
})

describe('E8 teste 1: as de hoje postas pelo nome fazem o mesmo', () => {
  it('Atordoado só passa a vez e não reage; Aéreo sem Esquiva e Contra; Cego zera a Percepção; Cura reduzida corta 50%', () => {
    const { loja, hpDe } = batalha([])
    const brook = carta(loja, 'Brook').tokenId
    const hector = carta(loja, 'Hector').tokenId
    const soco: PedidoDeAcao = { tipo: 'habilidade', cartaoId: 'tec_soco', armaId: null, alvos: [{ tokenId: hector, dano: 10 }], surpresa: false, perfurante: false, custo: null, acao: null }
    // O Hector Atordoado não reage: o soco entra na hora.
    expect(loja.getState().porSelo(CENA, hector, { nome: 'Atordoado', turnos: 1 })).toBe(true)
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Brook'), soco)).toBe(true)
    expect(hpDe('Hector')).toBe(190)
    // O Brook Atordoado na vez dele: só passar a vez.
    expect(loja.getState().porSelo(CENA, brook, { nome: 'Atordoado', turnos: 1 })).toBe(true)
    expect(loja.getState().motivoDoAgir(CENA, MESTRE, naVezDe(loja, 'Brook'), soco)).toBe('Atordoado: nesta vez só dá para passar a vez')
    expect(loja.getState().passarVez(CENA, MESTRE, naVezDe(loja, 'Brook'))).toBe(true)
    // Pelo nome, sem a ficha: o comportamento de sempre.
    expect(comportamentoDoSelo('Atordoado')).toMatchObject({ perdeVez: true, naoReage: true })
    expect(comportamentoDoSelo('Aéreo')?.tiraSaidas).toEqual(expect.arrayContaining(['esquiva', 'contra']))
    expect(comportamentoDoSelo('Cego')?.zera).toBe('percepcao')
    expect(loja.getState().porSelo(CENA, hector, { nome: 'Cura reduzida', turnos: 3 })).toBe(true)
    expect(curaComOsSelos(40, cena(loja).turnos.selos, hector)).toBe(20)
  })
})

describe('E8 teste 1: a criada de mesmo nome e o arquivo', () => {
  it('a "Congelado" criada antes vence a de fábrica', () => {
    const minha = lida({ id: 'cond_meu_gelo', nome: 'Congelado', cor: '#7fb8f0', simbolo: 'floco', regra: 'narra' })
    expect(condicaoDoCatalogoPeloNome('Congelado', [minha])?.id).toBe('cond_meu_gelo')
    expect(condicaoDoCatalogoPeloNome('Congelado', [])?.id).toBe('congelado')
  })

  it('o arquivo com peças sai na versão 2; sem campo novo, na 1; o de versão maior é recusado', () => {
    const montada = montadaDaAntiga(lida(VIDA_5))
    expect(versaoDasCondicoes([lida(NARRA)])).toBe(1)
    expect(versaoDasCondicoes([montada])).toBe(2)
    const texto = serializarCondicoes([montada])
    expect(condicoesDoTexto(texto)).toMatchObject({ ok: true })
    const maisNovo = JSON.stringify({ ...JSON.parse(texto), versao: 3 })
    expect(condicoesDoTexto(maisNovo)).toEqual({ ok: false, motivo: 'versao-mais-nova' })
  })
})
