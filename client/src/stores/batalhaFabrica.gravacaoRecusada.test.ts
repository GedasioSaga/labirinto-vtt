// @vitest-environment node
/**
 * CONSERTO DAS FICHAS F1, fatia S2 (bug 11 de
 * docs/auditoria-fichas/00-bugs-do-sistema.md): a gravação da ficha que a
 * mesa recusa (pasta publicada; o Lobby não aceitaria) não conta como feita.
 * A ação que cobra custo ou dá dano não acontece (sem linha, sem recarga,
 * sem animação) e diz `false`, para a tela do jogador mostrar a recusa; o
 * que ela já tinha gravado em outra ficha volta. Store do app
 * (`criarBatalhaStore`) sobre a mesa em memória do treino, com a recusa no
 * lugar da pasta; fichas inventadas.
 */
import { describe, expect, it } from 'vitest'
import type { MesaDaBatalha } from '../lib/batalha/mesa'
import { combateVazio, type PedidoDeAcao } from '../lib/batalha/combate'
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

/**
 * A mesa do treino com a recusa da pasta publicada: como no app, a ficha nova é calculada e só a gravação não entra.
 * `recusar` diz de quem a ficha é recusada (a pasta recusa a ficha que o Lobby não aceitaria, não a mesa inteira).
 */
function batalha(): { loja: LojaDaBatalha; mesa: MesaDaBatalha; recusar: (de: (personagemId: string) => boolean) => void } {
  const memoria = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: ATIRADOR, lado: 'a' }, { ficha: COVEIRO, lado: 'b' }]))
  let recusada: (personagemId: string) => boolean = () => false
  const mesa: MesaDaBatalha = {
    ...memoria,
    ajustarPersonagem: (personagemId, ajustar) => {
      if (!recusada(personagemId)) return memoria.ajustarPersonagem(personagemId, ajustar)
      const atual = memoria.personagens().find((personagem) => personagem.id === personagemId)
      if (atual !== undefined) ajustar(atual)
      return false
    },
  }
  const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
  const tokens = memoria.tokens()
  const combatentes = combatentesIniciais(tokens, memoria.personagens(), memoria.sistema(), new Set(tokens.map((token) => token.id)))
  loja.getState().ligar(CENA, {}, { combatentes, regras: null, desempate: 'd20' })
  return { loja, mesa, recusar: (de) => (recusada = de) }
}

function cena(loja: LojaDaBatalha): BatalhaDaCena {
  const atual = loja.getState().cenas[CENA]
  if (atual === undefined) throw new Error('a batalha não ligou')
  return atual
}

/** O personagem da carta (o treino copia a ficha com outro id: acha pela carta). */
function personagemDe(loja: LojaDaBatalha, nome: string): string {
  const personagemId = cena(loja).turnos.cartas.find((carta) => carta.nome === nome)?.personagemId
  if (personagemId === undefined || personagemId === null) throw new Error(`sem a carta de ${nome}`)
  return personagemId
}

function recursos(loja: LojaDaBatalha, mesa: MesaDaBatalha, nome: string): Personagem['recursos'] {
  const id = personagemDe(loja, nome)
  const personagem = mesa.personagens().find((candidato) => candidato.id === id)
  if (personagem === undefined) throw new Error(`sem ${nome} na mesa`)
  return personagem.recursos
}

/** O "Desenhar o alvo" do atirador no coveiro, na vez de agora. */
function desenharNoCoveiro(loja: LojaDaBatalha): boolean {
  const { turnos } = cena(loja)
  if (turnos.vez === null) throw new Error('sem vez')
  const coveiro = turnos.cartas.find((carta) => carta.nome === 'Coveiro')?.tokenId
  if (coveiro === undefined) throw new Error('sem o coveiro')
  const desenhar: PedidoDeAcao = { tipo: 'habilidade', cartaoId: 'tec_desenhar', armaId: null, alvos: [{ tokenId: coveiro, dano: 40 }], surpresa: false, perfurante: false, custo: null, acao: null }
  return loja.getState().agir(CENA, MESTRE, { cartaId: turnos.vez, rodada: turnos.rodada }, desenhar)
}

describe('bug 11: a gravação recusada não conta como feita', () => {
  it('a mesa recusa o custo do "Desenhar o alvo": a técnica não sai (agir diz não), o SP fica 60, sem linha, recarga nem golpe', () => {
    const { loja, mesa, recusar } = batalha()
    const antes = cena(loja)

    recusar(() => true)
    expect(desenharNoCoveiro(loja)).toBe(false)

    expect(recursos(loja, mesa, 'Atirador').sp).toBe(60)
    // A cena nem foi gravada: o registro, a recarga e o golpe esperando são os de antes.
    expect(cena(loja)).toBe(antes)
  })

  it('o custo entra e a mesa recusa o DANO no alvo (que já gastou a reação e toma na hora): o custo volta, sem linha nem animação de dano', () => {
    const { loja, mesa, recusar } = batalha()
    // R5: o coveiro gastou a reação no contador, então o golpe nele resolve na hora (o dano vai direto à ficha).
    const coveiroId = personagemDe(loja, 'Coveiro')
    const inicio = cena(loja)
    loja.setState({ cenas: { ...loja.getState().cenas, [CENA]: { ...inicio, turnos: { ...inicio.turnos, combate: { ...(inicio.turnos.combate ?? {}), [coveiroId]: { ...combateVazio(), semReacao: true } } } } } })
    const antes = cena(loja)

    recusar((personagemId) => personagemId === coveiroId)
    expect(desenharNoCoveiro(loja)).toBe(false)

    expect(recursos(loja, mesa, 'Atirador').sp).toBe(60)
    expect(recursos(loja, mesa, 'Coveiro').hp).toBe(300)
    expect(cena(loja)).toBe(antes)
  })
})
