/**
 * Fichas inventadas para os testes das 100 lutas (T4): o 2×1 da T3 (Zé e Lia
 * contra o Marinheiro) e o pedido montado. Só dados de teste; nada de ficha real.
 */
import { personagemDoArquivo, type Personagem } from '../personagem'
import { SISTEMA_ONE_PIECE } from '../sistemaOnePiece'
import { montarLutadores, type EscolhaDaVaga, type LutadoresDoTreino } from './mesaEmMemoria'

function ficha(dados: Record<string, unknown>): Personagem {
  const lida = personagemDoArquivo(dados)
  if (lida === null) throw new Error('ficha de teste inválida')
  return lida
}

function cartao(id: string, nome: string, campos: Record<string, string>): Record<string, unknown> {
  return { id, nome, campos }
}

/** O Zé com a Força pedida (60 na ficha; o rascunho de build muda só ela). */
export function ze(forca: number): Personagem {
  return ficha({
    id: 'pers_ze',
    tipo: 'jogador',
    nome: 'Zé',
    recursos: { hp: 300, sp: 100 },
    maximos: { hp: 300, sp: 100 },
    atributos: { forca, agilidade: 40 },
    abas: {
      armas: [cartao('arma_espada', 'Espada', { dano: '20' })],
      habilidades: [cartao('tec_corte', 'Corte Duplo', { acao: 'Simples', custo: '30 SP', tempo: '2', dano: 'Força + 60' })],
    },
  })
}

export const LIA = ficha({
  id: 'pers_lia',
  tipo: 'jogador',
  nome: 'Lia',
  recursos: { hp: 250, sp: 0 },
  maximos: { hp: 250, sp: 60 },
  atributos: { forca: 50, agilidade: 70 },
  abas: { armas: [cartao('arma_bastao', 'Bastão', { dano: '15' })] },
})

export const MARINHEIRO = ficha({
  id: 'pers_marinheiro',
  tipo: 'npc',
  nome: 'Marinheiro',
  recursos: { hp: 600, sp: 0 },
  maximos: { hp: 600, sp: 0 },
  atributos: { forca: 80, agilidade: 30 },
  abas: { armas: [cartao('arma_sabre', 'Sabre', { dano: '30' })] },
})

export const SISTEMA_DO_TESTE = SISTEMA_ONE_PIECE

/** As vagas e as cópias da escolha; montagem recusada = erro (é bug do teste). */
export function lutadoresDe(escolhas: readonly EscolhaDaVaga[]): LutadoresDoTreino {
  const montagem = montarLutadores(escolhas)
  if (!montagem.ok) throw new Error(`montagem recusada: lado ${montagem.lado} ${montagem.motivo}`)
  return montagem.lutadores
}

/** O 2×1 da T3, com o Zé na Força pedida. */
export function doisContraUm(forcaDoZe = 60): LutadoresDoTreino {
  return lutadoresDe([
    { ficha: ze(forcaDoZe), lado: 'a' },
    { ficha: LIA, lado: 'a' },
    { ficha: MARINHEIRO, lado: 'b' },
  ])
}
