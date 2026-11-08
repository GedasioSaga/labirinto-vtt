// @vitest-environment node
/**
 * CONSERTO DAS FICHAS F1, fatia S2 (bug 11 de
 * docs/auditoria-fichas/00-bugs-do-sistema.md): a gravação da ficha que a
 * mesa recusa (pasta publicada; o Lobby não aceitaria) não conta como feita.
 * A linha não guarda o que não entrou, e o Desfazer dela não devolve nada que
 * nunca saiu da ficha. Store do app (`criarBatalhaStore`) sobre a mesa em
 * memória do treino, com a recusa no lugar da pasta; ficha inventada.
 */
import { describe, expect, it } from 'vitest'
import type { MesaDaBatalha } from '../lib/batalha/mesa'
import type { PedidoDeAcao } from '../lib/batalha/combate'
import { combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import { personagemDoArquivo, type Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_da_batalha'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }

function ficha(dados: Record<string, unknown>): Personagem {
  const lida = personagemDoArquivo(dados)
  if (lida === null) throw new Error('ficha de teste inválida')
  return lida
}

/** Age primeiro, com 60 de 100 SP (o Desfazer que devolvesse os 30 não bateria no teto). */
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

/** A mesa do treino com a recusa da pasta publicada: como no app, a ficha nova é calculada e só a gravação não entra. */
function batalha(): { loja: LojaDaBatalha; mesa: MesaDaBatalha; recusar: (sim: boolean) => void } {
  const memoria = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: ATIRADOR, lado: 'a' }, { ficha: COVEIRO, lado: 'b' }]))
  let recusando = false
  const mesa: MesaDaBatalha = {
    ...memoria,
    ajustarPersonagem: (personagemId, ajustar) => {
      if (!recusando) return memoria.ajustarPersonagem(personagemId, ajustar)
      const atual = memoria.personagens().find((personagem) => personagem.id === personagemId)
      if (atual !== undefined) ajustar(atual)
      return false
    },
  }
  const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
  const tokens = memoria.tokens()
  const combatentes = combatentesIniciais(tokens, memoria.personagens(), memoria.sistema(), new Set(tokens.map((token) => token.id)))
  loja.getState().ligar(CENA, {}, { combatentes, regras: null, desempate: 'd20' })
  return { loja, mesa, recusar: (sim) => (recusando = sim) }
}

function cena(loja: LojaDaBatalha): BatalhaDaCena {
  const atual = loja.getState().cenas[CENA]
  if (atual === undefined) throw new Error('a batalha não ligou')
  return atual
}

/** O SP da cópia do atirador na mesa (o treino copia a ficha com outro id: acha pela carta dele). */
function spDoAtirador(loja: LojaDaBatalha, mesa: MesaDaBatalha): number | undefined {
  const personagemId = cena(loja).turnos.cartas.find((carta) => carta.nome === 'Atirador')?.personagemId
  return mesa.personagens().find((personagem) => personagem.id === personagemId)?.recursos.sp
}

describe('bug 11: a gravação recusada não conta como feita', () => {
  it('a mesa recusa o custo do "Desenhar o alvo": o SP fica 60, a linha não guarda o custo, e desfazê-la depois não dá 30 SP de presente', () => {
    const { loja, mesa, recusar } = batalha()
    const { turnos } = cena(loja)
    if (turnos.vez === null) throw new Error('sem vez')
    const coveiro = turnos.cartas.find((carta) => carta.nome === 'Coveiro')?.tokenId
    if (coveiro === undefined) throw new Error('sem o coveiro')
    const desenhar: PedidoDeAcao = { tipo: 'habilidade', cartaoId: 'tec_desenhar', armaId: null, alvos: [{ tokenId: coveiro, dano: 40 }], surpresa: false, perfurante: false, custo: null, acao: null }

    recusar(true)
    expect(loja.getState().agir(CENA, MESTRE, { cartaId: turnos.vez, rodada: turnos.rodada }, desenhar)).toBe(true)
    expect(spDoAtirador(loja, mesa)).toBe(60)
    const linha = [...cena(loja).registro].reverse().find((candidata) => candidata.texto.includes('Desenhar o alvo'))
    if (linha === undefined) throw new Error('sem a linha do Desenhar')
    const partes = linha.reversao.tipo === 'composta' ? linha.reversao.partes : [linha.reversao]
    expect(partes.some((parte) => parte.tipo === 'ficha')).toBe(false)

    recusar(false)
    expect(loja.getState().desfazer(CENA, linha.id, MESTRE)).toBe(true)
    expect(spDoAtirador(loja, mesa)).toBe(60)
  })
})
