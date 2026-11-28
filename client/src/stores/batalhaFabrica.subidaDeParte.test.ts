// @vitest-environment node
/**
 * BUGS DA BATALHA (testadores de 28/11/2026): a Fúria do Dragão (a técnica que sobe de Parte) ligada a um
 * marco do acumulador. A Ryoko (fichasDaFatiaE) ganha a Raiva pelo "+ Acumulador" da ficha (máximo 5) e a
 * Fúria da Parte 1 ganha, pelas funções que a peça do editor chama, "liberada na Raiva 2" e "gasta o nível".
 * Na store do app (`criarBatalhaStore`) sobre a mesa em memória do treino.
 */
import { describe, expect, it } from 'vitest'
import { acumuladoresNaFicha, comAcumuladorNovo, comOAcumuladorGravado } from '../components/batalha/acumulador/acumuladoresDaFicha'
import { cartaoComAMecanica } from '../components/batalha/editor/gravarNoCartao'
import { comATecnicaNoNivel, comOGastoNoNivel } from '../components/batalha/editor/pecas/ligacoes'
import { custosDasFormasNaTela } from '../lib/batalha/custoPorTurno'
import { mecanicaDoModeloNovo } from '../lib/batalha/mecanica/modelos'
import { cartaoComTextoGerado } from '../lib/batalha/mecanica/textoGerado'
import { nivelDoAcumulador } from '../lib/batalha/acumuladorNaBatalha'
import type { PedidoDeAcao } from '../lib/batalha/combate'
import { ficha } from '../lib/batalha/fichasDaFatiaB.testkit'
import { FURIA_1, PARTE_1, PARTE_2, ryokoCom } from '../lib/batalha/fichasDaFatiaE.testkit'
import type { VezEsperada } from '../lib/batalha/ponte'
import { combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import { novoCartao, numeroDaFicha, type Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria, type MesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_da_subida'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }
const JOGADOR: AutorDaAcao = { tipo: 'jogador', playerId: 'jogador_1', nome: 'Jogador' }
const NOME = 'Ryoko D. Violet'

/** A Ryoko na Parte 1 com a Raiva no nível `inicial`; a Fúria liberada na Raiva 2, gastando o nível, e (com `sobe`) com o "Ao usar, sobe uma Parte". */
function ryokoComRaiva(inicial: number, sobe: boolean): { ryoko: Personagem; raivaId: string } {
  const novo = comAcumuladorNovo(ryokoCom([PARTE_1.id]))
  const item = acumuladoresNaFicha(novo.personagem).find((candidato) => candidato.acumulador.id === novo.id)
  if (item === undefined) throw new Error('o + Acumulador não criou nada')
  const definicao = { ...item.acumulador, nome: 'Raiva', maximo: 5, inicial }
  const comRaiva = comOAcumuladorGravado(novo.personagem, item, definicao)
  const ref = { id: definicao.id, nome: 'Raiva' }
  const liberada = comOGastoNoNivel(comATecnicaNoNivel(FURIA_1, ref, 2), ref, 'nivel')
  const furia = sobe ? { ...liberada, requisitos: { ...(liberada.requisitos ?? {}), aoUsar: { sobeParte: true } } } : liberada
  const parte1 = { ...PARTE_1, subcartoes: PARTE_1.subcartoes.map((subcartao) => (subcartao.id === FURIA_1.id ? furia : subcartao)) }
  const ryoko = { ...comRaiva, abas: { ...comRaiva.abas, transformacoes: (comRaiva.abas.transformacoes ?? []).map((cartao) => (cartao.id === PARTE_1.id ? parte1 : cartao)) } }
  return { ryoko, raivaId: definicao.id }
}

interface Subida {
  loja: LojaDaBatalha
  mesa: MesaEmMemoria
  /** A Fúria pelo `agir` de `autor` na vez da Ryoko. */
  usarAFuria: (autor: AutorDaAcao) => boolean
  raiva: () => number
  ativas: () => readonly string[]
  cena: () => BatalhaDaCena
}

function subida(inicial: number, sobe: boolean): Subida {
  const { ryoko, raivaId } = ryokoComRaiva(inicial, sobe)
  const alvo = ficha('Pirata', { agilidade: 1 }, { hp: 500, sp: 0, escudo: 0 }, {})
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: ryoko, lado: 'a' }, { ficha: alvo, lado: 'b' }]))
  const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
  const tokens = mesa.tokens()
  loja.getState().ligar(CENA, {}, { combatentes: combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id))), regras: null, desempate: 'd20' })
  const cena = (): BatalhaDaCena => {
    const atual = loja.getState().cenas[CENA]
    if (atual === undefined) throw new Error('a batalha não ligou')
    return atual
  }
  const daRyoko = (): Personagem | undefined => mesa.personagens().find((personagem) => personagem.nome === NOME)
  return {
    loja,
    mesa,
    cena,
    usarAFuria: (autor) => {
      const { turnos } = cena()
      const vez: VezEsperada = { cartaId: turnos.vez ?? '', rodada: turnos.rodada }
      if (turnos.cartas.find((carta) => carta.id === turnos.vez)?.nome !== NOME) throw new Error('a vez não é da Ryoko')
      const pedido: PedidoDeAcao = { tipo: 'habilidade', cartaoId: FURIA_1.id, armaId: null, alvos: [], surpresa: false, perfurante: false, custo: null, acao: null }
      return loja.getState().agir(CENA, autor, vez, pedido)
    },
    raiva: () => nivelDoAcumulador(cena().turnos.combate?.[daRyoko()?.id ?? ''], raivaId),
    ativas: () => daRyoko()?.cartoesAtivos ?? [],
  }
}

describe('a Fúria com requisito do acumulador, pelo "Ao usar, sobe uma Parte"', () => {
  it('Raiva 3: liga a Parte 2 gastando o nível (Raiva 1); o Desfazer volta a Parte 1 e a Raiva 3', () => {
    const s = subida(3, true)
    expect(s.raiva()).toBe(3)
    expect(s.usarAFuria(MESTRE)).toBe(true)
    expect([s.ativas().includes(PARTE_2.id), s.raiva()]).toEqual([true, 1])
    const linha = s.cena().registro.at(-1)
    if (linha === undefined) throw new Error('sem a linha da subida')
    expect(s.loja.getState().desfazer(CENA, linha.id, MESTRE)).toBe(true)
    expect([s.ativas().includes(PARTE_1.id), s.ativas().includes(PARTE_2.id), s.raiva()]).toEqual([true, false, 3])
  })

  it('Raiva 1, pelo jogador: o host recusa (falta Raiva 2) e a Parte 1 continua', () => {
    const s = subida(1, true)
    expect(s.usarAFuria(JOGADOR)).toBe(false)
    expect([s.ativas().includes(PARTE_1.id), s.ativas().includes(PARTE_2.id), s.raiva()]).toEqual([true, false, 1])
  })
})

describe('a Fúria da tabela que ganhou só o requisito no editor (sem marcar "sobe uma Parte")', () => {
  it('continua subindo para a Parte 2, agora gastando a Raiva', () => {
    const s = subida(3, false)
    expect(s.usarAFuria(MESTRE)).toBe(true)
    expect([s.ativas().includes(PARTE_2.id), s.raiva()]).toEqual([true, 1])
  })
})

describe('a forma montada "Ligar e manter" com custo (o modelo Fúria do Dragão do editor: 20 SP)', () => {
  it('ligar cobra os 20 SP (25 -> 5), e a forma entra no custo por vez, já sem SP para a vez seguinte', () => {
    const semForma = ficha('Herói', { agilidade: 40 }, { hp: 500, sp: 25, escudo: 0 }, {})
    const base = novoCartao('Fúria do Dragão')
    const montado = cartaoComAMecanica(base, mecanicaDoModeloNovo('furiaDoDragao', SISTEMA_DO_TESTE), 'mestre', { personagem: semForma, sistema: SISTEMA_DO_TESTE })
    if (montado === null) throw new Error('o editor recusou a forma')
    const forma = cartaoComTextoGerado(base, montado, SISTEMA_DO_TESTE, 'tecnica')
    const heroi: Personagem = { ...semForma, abas: { ...semForma.abas, transformacoes: [forma] } }
    const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: heroi, lado: 'a' }, { ficha: ficha('Pirata', { agilidade: 1 }, { hp: 500, sp: 0, escudo: 0 }, {}), lado: 'b' }]))
    const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
    const tokens = mesa.tokens()
    loja.getState().ligar(CENA, {}, { combatentes: combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id))), regras: null, desempate: 'd20' })
    const turnos = loja.getState().cenas[CENA]?.turnos
    if (turnos?.vez == null) throw new Error('sem vez')
    expect(loja.getState().agir(CENA, MESTRE, { cartaId: turnos.vez, rodada: turnos.rodada }, { tipo: 'transformar', cartaoId: forma.id, acao: 'livre', trocarImagem: false })).toBe(true)
    const depois = mesa.personagens().find((personagem) => personagem.nome === 'Herói')
    expect([depois?.cartoesAtivos.includes(forma.id), numeroDaFicha(depois?.recursos ?? {}, 'sp')]).toEqual([true, 5])
    expect(custosDasFormasNaTela(depois, SISTEMA_DO_TESTE)).toEqual([expect.objectContaining({ cartaoId: forma.id, semRecurso: expect.anything() })])
  })
})
