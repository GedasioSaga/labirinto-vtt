import { afterEach, describe, expect, it } from 'vitest'
import { chavesDoDono, saidasTiradasDoDono } from '../../lib/batalha/mecanicasAMao'
import { chaveDoPorTurno } from '../../lib/batalha/passivas'
import {
  AGULHA,
  ARRANHAO,
  BOLHA,
  CAPITA,
  CORTE,
  CORTE_FUNDO,
  CURA_A_MAO,
  CURANDEIRA,
  ENTRADAS,
  FOLEGO,
  GIRO,
  MARTELADA,
  MARUJO,
  OGRA_COM_REGRA_NA_FICHA,
  OGRO_COMUM,
  PANCADA,
  SAPO,
  TARTARUGA,
  elencoDasOgras,
  elencoDoContrato,
  usar,
  type Elenco,
  type EntradaDoContrato,
  type NomeDaEntrada,
  type ResultadoDoPedido,
} from './contratoDoCombate.testkit'

/**
 * O CONTRATO DO COMBATE: O PORTÃO PERMANENTE (fase final do plano
 * docs/planos/unificacao-do-combate-2026-11-10.md). A mesma tabela de técnicas
 * inventadas, com a forma das reais, roda pela COLA de cada entrada (a Arena,
 * o mestre no mapa, o jogador no mapa pela rede, o site), e o resultado é o
 * mesmo nas quatro. Onde uma entrada difere POR DECISÃO do plano, a diferença
 * está escrita aqui, numa tabela por entrada com o motivo. Nada no combate
 * está consertado se uma coluna daqui quebra.
 *
 * A luta de sempre: Curandeira (jogadora), Sapo e Tartaruga (NPCs do lado
 * dela; a Tartaruga com 300 de Escudo) contra o Marujo e a Capitã. O Marujo
 * joga primeiro e, quando o caso pede feridos, bate antes: 200 no Sapo, 200
 * no Escudo da Tartaruga, 40 na Curandeira.
 */

const ACEITO: ResultadoDoPedido = { ok: true, tela: null }
const recusado = (tela: string): ResultadoDoPedido => ({ ok: false, tela })

/** O mestre opera (a Arena, o mestre no mapa): a recusa diz o nome do alvo. O jogador (a rede, o site): a frase dele. */
const ESCUDO_SEGUROU: Record<NomeDaEntrada, string> = {
  Arena: 'Tartaruga de Teste não está ferido: o Escudo segurou o golpe. Bolha de Teste cura só a vida.',
  'mapa (mestre)': 'Tartaruga de Teste não está ferido: o Escudo segurou o golpe. Bolha de Teste cura só a vida.',
  'mapa (jogador)': 'A mesa não aceitou: ninguém marcado está ferido: o Escudo segurou o golpe. Bolha de Teste cura só a vida.',
  site: 'Ninguém marcado está ferido: o Escudo segurou o golpe. Bolha de Teste cura só a vida.',
}

const SEM_FERIDO: Record<NomeDaEntrada, string> = {
  Arena: 'Ninguém marcado está ferido',
  'mapa (mestre)': 'Ninguém marcado está ferido',
  'mapa (jogador)': 'A mesa não aceitou: ninguém marcado está ferido.',
  site: 'Ninguém marcado está ferido',
}

/** A cura da ficha de JOGADOR no outro lado: recusada nas quatro (o mestre lê de quem é o alvo). */
const OUTRO_LADO_DA_JOGADORA: Record<NomeDaEntrada, string> = {
  Arena: 'Bolha de Teste só vale em quem usa ou num aliado. Marujo de Teste está do outro lado.',
  'mapa (mestre)': 'Bolha de Teste só vale em quem usa ou num aliado. Marujo de Teste está do outro lado.',
  'mapa (jogador)': 'A mesa não aceitou: bolha de Teste só vale em você ou num aliado.',
  site: 'Bolha de Teste só vale em você ou num aliado',
}

/**
 * A cura do NPC no outro lado, POR DECISÃO do plano: o mestre com NPC é juiz
 * (passa, e cura); o jogador que opera o NPC (a rede, o site) é recusado com o
 * motivo. O par é [o que o pedido deu, a vida do Marujo depois].
 */
const NPC_CURA_O_OUTRO_LADO: Record<NomeDaEntrada, [ResultadoDoPedido, number]> = {
  Arena: [ACEITO, 500],
  'mapa (mestre)': [ACEITO, 500],
  'mapa (jogador)': [recusado('A mesa não aceitou: bolha de Teste só vale em você ou num aliado.'), 450],
  site: [recusado('Bolha de Teste só vale em você ou num aliado'), 450],
}

/**
 * A cura pedida sem alvo nenhum. A mira barra antes de mandar ("Escolha ao
 * menos um alvo"); a página que manda assim mesmo ouve a regra, que recusa
 * antes de cobrar. Nenhuma técnica que cura ou limpa sai sem alvo de propósito.
 */
const CURA_SEM_ALVO: Record<NomeDaEntrada, string> = {
  Arena: 'Escolha quem vai receber',
  'mapa (mestre)': 'Escolha quem vai receber',
  'mapa (jogador)': 'A mesa não aceitou: escolha quem vai receber.',
  site: 'Escolha quem vai receber',
}

/**
 * O sangramento, POR DECISÃO: na mesa é lembrete com Aplicar ou pular (quem
 * responde é quem opera); no site não há mestre para responder e a luta
 * aplica sozinha. O dano é o mesmo. O par é [lembretes pedindo o Aplicar, a
 * vida do Marujo no fim].
 */
const SANGRA: Record<NomeDaEntrada, [number, number]> = {
  Arena: [1, 490],
  'mapa (mestre)': [1, 490],
  'mapa (jogador)': [1, 490],
  site: [0, 490],
}

describe.each(ENTRADAS)('contrato do combate: $nome', ({ nome, montar }) => {
  let aberta: EntradaDoContrato | null = null
  const abrir = (elenco: Elenco = elencoDoContrato()): EntradaDoContrato => {
    aberta = montar(elenco)
    return aberta
  }
  afterEach(() => {
    aberta?.fechar()
    aberta = null
  })

  const vidas = (e: EntradaDoContrato) => ({ curandeira: e.recurso(CURANDEIRA.nome, 'hp'), sapo: e.recurso(SAPO.nome, 'hp'), tartaruga: e.recurso(TARTARUGA.nome, 'hp'), escudoDaTartaruga: e.recurso(TARTARUGA.nome, 'escudo') })

  /** O Marujo abre a luta batendo; a vez para na Curandeira, com o lado dela ferido. */
  function comFeridos(e: EntradaDoContrato): EntradaDoContrato {
    e.vezDe(MARUJO.nome)
    expect([usar(e, MARUJO.nome, PANCADA.id, [SAPO.nome]), usar(e, MARUJO.nome, MARTELADA.id, [TARTARUGA.nome]), usar(e, MARUJO.nome, ARRANHAO.id, [CURANDEIRA.nome])]).toEqual([ACEITO, ACEITO, ACEITO])
    e.ninguemReage()
    expect(vidas(e)).toEqual({ curandeira: 460, sapo: 300, tartaruga: 500, escudoDaTartaruga: 100 })
    e.vezDe(CURANDEIRA.nome)
    return e
  }

  it('cura por peças no aliado ferido: cobra o custo, cura o Espírito sem passar do máximo e conta o uso', () => {
    const e = comFeridos(abrir())
    expect(usar(e, CURANDEIRA.nome, BOLHA.id, [SAPO.nome, CURANDEIRA.nome])).toEqual(ACEITO)
    expect({ ...vidas(e), sp: e.recurso(CURANDEIRA.nome, 'sp'), usos: e.usos(CURANDEIRA.nome, BOLHA.id) }).toEqual({ curandeira: 500, sapo: 350, tartaruga: 500, escudoDaTartaruga: 100, sp: 170, usos: 1 })
  })

  it('a mesma cura em quem está de vida cheia com o Escudo gasto: recusa sem cobrar, e a tela diz que o Escudo segurou', () => {
    const e = comFeridos(abrir())
    expect(usar(e, CURANDEIRA.nome, BOLHA.id, [TARTARUGA.nome])).toEqual(recusado(ESCUDO_SEGUROU[nome]))
    expect({ sp: e.recurso(CURANDEIRA.nome, 'sp'), usos: e.usos(CURANDEIRA.nome, BOLHA.id) }).toEqual({ sp: 200, usos: 0 })
  })

  it('ninguém ferido (a vida cheia, sem Escudo): a mira da cura abre sem alvo, e o pedido à força é recusado sem cobrar, com o motivo', () => {
    const e = abrir()
    e.vezDe(CURANDEIRA.nome)
    expect(e.mira(CURANDEIRA.nome, BOLHA.id).marcados).toEqual([])
    expect(usar(e, CURANDEIRA.nome, BOLHA.id, [CURANDEIRA.nome])).toEqual(recusado(SEM_FERIDO[nome]))
    expect({ sp: e.recurso(CURANDEIRA.nome, 'sp'), usos: e.usos(CURANDEIRA.nome, BOLHA.id) }).toEqual({ sp: 200, usos: 0 })
  })

  it('cura no outro lado: a da ficha de jogador é recusada com o motivo; a do NPC passa com o mestre e é recusada com o jogador', () => {
    const e = comFeridos(abrir())
    expect(usar(e, CURANDEIRA.nome, AGULHA.id, [MARUJO.nome])).toEqual(ACEITO)
    e.ninguemReage()
    expect(e.recurso(MARUJO.nome, 'hp')).toBe(450)
    expect(usar(e, CURANDEIRA.nome, BOLHA.id, [MARUJO.nome])).toEqual(recusado(OUTRO_LADO_DA_JOGADORA[nome]))
    e.vezDe(SAPO.nome)
    expect([usar(e, SAPO.nome, BOLHA.id, [MARUJO.nome]), e.recurso(MARUJO.nome, 'hp')]).toEqual(NPC_CURA_O_OUTRO_LADO[nome])
  })

  it('cura "à mão" da ficha de jogador no NPC do mesmo lado: passa, cura o Espírito e cobra o custo', () => {
    const e = comFeridos(abrir())
    expect(usar(e, CURANDEIRA.nome, CURA_A_MAO.id, [SAPO.nome])).toEqual(ACEITO)
    expect({ sapo: e.recurso(SAPO.nome, 'hp'), sp: e.recurso(CURANDEIRA.nome, 'sp'), usos: e.usos(CURANDEIRA.nome, CURA_A_MAO.id) }).toEqual({ sapo: 350, sp: 150, usos: 1 })
  })

  it('técnica de dano simples: cobra o custo e, sem reação, o dano da ficha entra inteiro', () => {
    const e = abrir()
    e.vezDe(CURANDEIRA.nome)
    expect(usar(e, CURANDEIRA.nome, CORTE.id, [MARUJO.nome])).toEqual(ACEITO)
    e.ninguemReage()
    expect({ marujo: e.recurso(MARUJO.nome, 'hp'), sp: e.recurso(CURANDEIRA.nome, 'sp') }).toEqual({ marujo: 400, sp: 180 })
  })

  it('cura pedida com a lista de alvos vazia (por peças e "à mão"): recusa sem cobrar, e a tela manda escolher quem recebe', () => {
    const e = comFeridos(abrir())
    const pedidos = { porPecas: usar(e, CURANDEIRA.nome, BOLHA.id, []), aMao: usar(e, CURANDEIRA.nome, CURA_A_MAO.id, []) }
    const depois = { ...vidas(e), sp: e.recurso(CURANDEIRA.nome, 'sp'), usos: [e.usos(CURANDEIRA.nome, BOLHA.id), e.usos(CURANDEIRA.nome, CURA_A_MAO.id)] }
    expect({ ...pedidos, ...depois }).toEqual({
      porPecas: recusado(CURA_SEM_ALVO[nome]),
      aMao: recusado(CURA_SEM_ALVO[nome]),
      curandeira: 460,
      sapo: 300,
      tartaruga: 500,
      escudoDaTartaruga: 100,
      sp: 200,
      usos: [0, 0],
    })
  })

  it('técnica de área na grade: a mira marca os dois inimigos da área nas quatro entradas, e o golpe acerta os dois', () => {
    const e = abrir(elencoDoContrato({ col: 6, row: 5 }))
    e.vezDe(CURANDEIRA.nome)
    const { marcados } = e.mira(CURANDEIRA.nome, GIRO.id)
    expect([marcados.length, marcados.every((alvo) => alvo === MARUJO.nome || alvo === CAPITA.nome)]).toEqual([2, true])
    expect(usar(e, CURANDEIRA.nome, GIRO.id, [MARUJO.nome, CAPITA.nome])).toEqual(ACEITO)
    e.ninguemReage()
    expect({ marujo: e.recurso(MARUJO.nome, 'hp'), capita: e.recurso(CAPITA.nome, 'hp') }).toEqual({ marujo: 460, capita: 460 })
  })

  it('selo com dano por vez: o Sangrando pega e tira 10 na vez de quem sangra', () => {
    const e = abrir()
    e.vezDe(CURANDEIRA.nome)
    expect(usar(e, CURANDEIRA.nome, CORTE_FUNDO.id, [MARUJO.nome])).toEqual(ACEITO)
    e.ninguemReage()
    expect(e.selos(MARUJO.nome)).toEqual(['Sangrando 3'])
    e.vezDe(MARUJO.nome)
    const pedindo = e.lembretes(MARUJO.nome).filter((lembrete) => lembrete.chave.endsWith(':sangra'))
    for (const lembrete of pedindo) expect(e.passiva(MARUJO.nome, { tipo: 'lembrete', tokenId: e.token(MARUJO.nome), cartaoId: lembrete.cartaoId, aplicar: true })).toBe(true)
    expect([pedindo.length, e.recurso(MARUJO.nome, 'hp')]).toEqual(SANGRA[nome])
  })

  it('passiva com lembrete: ligada na vez do dono, pede o Aplicar na vez seguinte dele e o Aplicar cura', () => {
    const e = comFeridos(abrir())
    expect(e.passiva(CURANDEIRA.nome, { tipo: 'passiva', tokenId: e.token(CURANDEIRA.nome), cartaoId: FOLEGO.id, ligar: true, custo: null })).toBe(true)
    e.passarAVez()
    e.vezDe(CURANDEIRA.nome)
    expect(e.lembretes(CURANDEIRA.nome).map((lembrete) => lembrete.chave)).toEqual([chaveDoPorTurno(FOLEGO.id)])
    expect(e.passiva(CURANDEIRA.nome, { tipo: 'lembrete', tokenId: e.token(CURANDEIRA.nome), cartaoId: FOLEGO.id, aplicar: true })).toBe(true)
    expect(e.recurso(CURANDEIRA.nome, 'hp')).toBe(490)
  })

  it('mecânica presa à ficha (ficha:<id>): vale na ficha que luta, mesmo cópia; a outra da mesma raça segue sem ela', () => {
    const e = abrir(elencoDasOgras())
    expect([saidasTiradasDoDono(chavesDoDono(e.copia(OGRA_COM_REGRA_NA_FICHA.nome))), saidasTiradasDoDono(chavesDoDono(e.copia(OGRO_COMUM.nome)))]).toEqual([[], ['esquiva', 'contra']])
  })

  it('a mira ao abrir: o golpe no inimigo de pé mais perto; a ajuda nos feridos do lado, o mais ferido primeiro (do jogador e do NPC)', () => {
    const e = comFeridos(abrir())
    // O golpe certo (a peça "não erra": ninguém reage) é golpe, não ajuda: abre no inimigo como o Corte.
    const aoAbrir = { golpe: e.mira(CURANDEIRA.nome, CORTE.id).marcados, golpeCerto: e.mira(CURANDEIRA.nome, CORTE_FUNDO.id).marcados, ajuda: e.mira(CURANDEIRA.nome, BOLHA.id).marcados }
    expect(aoAbrir).toEqual({ golpe: [MARUJO.nome], golpeCerto: [MARUJO.nome], ajuda: [SAPO.nome, CURANDEIRA.nome] })
    expect(e.mira(CURANDEIRA.nome, BOLHA.id).lados).toEqual({ [CURANDEIRA.nome]: 'eu', [SAPO.nome]: 'aliado', [TARTARUGA.nome]: 'aliado', [MARUJO.nome]: 'outro', [CAPITA.nome]: 'outro' })
    e.vezDe(SAPO.nome)
    expect(e.mira(SAPO.nome, BOLHA.id).marcados).toEqual([SAPO.nome, CURANDEIRA.nome])
  })
})
