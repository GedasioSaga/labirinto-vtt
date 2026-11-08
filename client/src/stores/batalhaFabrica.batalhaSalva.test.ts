// @vitest-environment node
/**
 * CONSERTO DAS FICHAS F1, fatia S5 (P8 do grilling; S1 de
 * docs/auditoria-fichas/00-sistema.md): a batalha em andamento VOLTA ao
 * reabrir o app. Reprodução do relatório: liga a batalha, o atirador usa a
 * técnica com recarga no coveiro (custo, recarga, golpe esperando a reação,
 * linha no registro) e o app "fecha" (a store some). Antes do S5 a store nova
 * nascia vazia; agora o texto salvo volta pela `retomar` e a batalha continua
 * de onde parou. Store do app sobre a mesa em memória do treino; fichas inventadas.
 */
import { describe, expect, it } from 'vitest'
import { batalhaSalvaDoTexto, textoDaBatalhaSalva, VERSAO_DA_BATALHA_SALVA } from '../lib/batalha/batalhaSalva'
import type { PedidoDeAcao } from '../lib/batalha/combate'
import type { MesaDaBatalha } from '../lib/batalha/mesa'
import { combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import { personagemDoArquivo, type Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_do_porto'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }
const DEPS = { rolarD20: () => 10, outraBatalhaLigada: () => false }

function ficha(dados: Record<string, unknown>): Personagem {
  const lida = personagemDoArquivo(dados)
  if (lida === null) throw new Error('ficha de teste inválida')
  return lida
}

const ATIRADOR = ficha({
  id: 'pers_atirador',
  tipo: 'jogador',
  nome: 'Atirador',
  recursos: { hp: 300, sp: 60 },
  maximos: { hp: 300, sp: 100 },
  atributos: { forca: 30, agilidade: 70 },
  abas: { habilidades: [{ id: 'tec_desenhar', nome: 'Desenhar o alvo', campos: { acao: 'Simples', custo: '30 SP', tempo: '3', dano: '40' } }] },
})
const COVEIRO = ficha({ id: 'pers_coveiro', tipo: 'jogador', nome: 'Coveiro', recursos: { hp: 300, sp: 60 }, maximos: { hp: 300, sp: 60 }, atributos: { forca: 50, agilidade: 40 } })

/** A mesa (as fichas, que moram no disco da aventura e sobrevivem ao fechar) e a primeira abertura do app, com a batalha ligada. */
function mesaComBatalha(): { mesa: MesaDaBatalha; loja: LojaDaBatalha } {
  const memoria = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: ATIRADOR, lado: 'a' }, { ficha: COVEIRO, lado: 'b' }]))
  const loja = criarBatalhaStore(memoria, DEPS)
  const tokens = memoria.tokens()
  const combatentes = combatentesIniciais(tokens, memoria.personagens(), memoria.sistema(), new Set(tokens.map((token) => token.id)))
  loja.getState().ligar(CENA, {}, { combatentes, regras: null, desempate: 'd20' })
  return { mesa: memoria, loja }
}

function cena(loja: LojaDaBatalha): BatalhaDaCena {
  const atual = loja.getState().cenas[CENA]
  if (atual === undefined) throw new Error('a batalha não está ligada')
  return atual
}

function tokenDe(loja: LojaDaBatalha, nome: string): string {
  const tokenId = cena(loja).turnos.cartas.find((carta) => carta.nome === nome)?.tokenId
  if (tokenId === undefined) throw new Error(`sem a carta de ${nome}`)
  return tokenId
}

function personagemDe(loja: LojaDaBatalha, nome: string): string {
  const personagemId = cena(loja).turnos.cartas.find((carta) => carta.nome === nome)?.personagemId
  if (personagemId === undefined || personagemId === null) throw new Error(`sem a ficha de ${nome}`)
  return personagemId
}

/** O "Desenhar o alvo" do atirador no coveiro, na vez de agora. */
function desenharNoCoveiro(loja: LojaDaBatalha): boolean {
  const { turnos } = cena(loja)
  if (turnos.vez === null) throw new Error('sem vez')
  const desenhar: PedidoDeAcao = { tipo: 'habilidade', cartaoId: 'tec_desenhar', armaId: null, alvos: [{ tokenId: tokenDe(loja, 'Coveiro'), dano: 40 }], surpresa: false, perfurante: false, custo: null, acao: null }
  return loja.getState().agir(CENA, MESTRE, { cartaId: turnos.vez, rodada: turnos.rodada }, desenhar)
}

describe('S5 (P8): a batalha salva volta ao reabrir o app', () => {
  it('fecha no meio, com recarga, golpe esperando e registro: a store nova retoma igual (sem as animações) e o golpe ainda espera a reação', () => {
    const { mesa, loja } = mesaComBatalha()
    expect(desenharNoCoveiro(loja)).toBe(true)
    const antes = cena(loja)
    const atiradorId = personagemDe(loja, 'Atirador')
    expect(antes.turnos.combate?.[atiradorId]?.recargas).not.toEqual({})
    expect(antes.turnos.golpes).toHaveLength(1)
    expect(antes.efeitos?.length ?? 0).toBeGreaterThan(0)

    const lido = batalhaSalvaDoTexto(textoDaBatalhaSalva({ mesaId: 'adv_porto', salvaEm: 1, cenas: loja.getState().cenas }))
    if (!lido.ok) throw new Error(`não leu: ${lido.motivo}`)
    const salva = lido.salva.cenas[CENA]
    if (salva === undefined) throw new Error('a cena não foi salva')

    // O app reabre: store nova, vazia, sobre as mesmas fichas.
    const reaberta = criarBatalhaStore(mesa, DEPS)
    expect(reaberta.getState().cenas).toEqual({})
    expect(reaberta.getState().retomar(CENA, salva)).toBe(true)
    const depois = cena(reaberta)
    expect(depois.turnos).toEqual(antes.turnos)
    expect(depois.registro).toEqual(antes.registro)
    expect(depois.turnosRev).toBe(antes.turnosRev)
    expect(depois.efeitos).toBeUndefined()
    expect(reaberta.getState().anuncio).toBeNull()

    // A batalha continua valendo: o coveiro ainda não reagiu, e o "Não reagir" toma os 40.
    const golpe = depois.turnos.golpes?.[0]
    if (golpe === undefined) throw new Error('sem golpe esperando')
    expect(reaberta.getState().reagir(CENA, MESTRE, { tipo: 'naoReagir', golpeId: golpe.id, tokenId: tokenDe(reaberta, 'Coveiro') })).toBe(true)
    expect(mesa.personagens().find((personagem) => personagem.nome === 'Coveiro')?.recursos.hp).toBe(260)
    // Cena já em batalha não é retomada por cima.
    expect(reaberta.getState().retomar(CENA, salva)).toBe(false)
  })

  it('arquivo cortado ou de um app mais novo não volta; cena torta fica de fora e a boa volta', () => {
    const { loja } = mesaComBatalha()
    const texto = textoDaBatalhaSalva({ mesaId: 'adv_porto', salvaEm: 1, cenas: loja.getState().cenas })

    expect(batalhaSalvaDoTexto(texto.slice(0, texto.length / 2))).toEqual({ ok: false, motivo: 'ilegivel' })
    const maisNova = texto.replace(`"versao":${VERSAO_DA_BATALHA_SALVA}`, `"versao":${VERSAO_DA_BATALHA_SALVA + 1}`)
    expect(batalhaSalvaDoTexto(maisNova)).toEqual({ ok: false, motivo: 'versao-mais-nova' })

    const comTorta = textoDaBatalhaSalva({ mesaId: 'adv_porto', salvaEm: 1, cenas: { ...loja.getState().cenas, cena_torta: { ...cena(loja), rev: -1 } } })
    const lido = batalhaSalvaDoTexto(comTorta)
    if (!lido.ok) throw new Error(`não leu: ${lido.motivo}`)
    expect(Object.keys(lido.salva.cenas)).toEqual([CENA])
  })
})
