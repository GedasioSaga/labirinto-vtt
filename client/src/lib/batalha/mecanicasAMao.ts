import type { SeloDoGolpe } from './combate'
import type { ContraDaDisputa, QuemRola } from './disputa'
import type { FormaDaArea, QuemEntraNaArea } from './area'
import { motivoDasRespostas, type PerguntaNaHora, type RespostasDoPedido } from './perguntaNaHora'

/**
 * AS MECÂNICAS DAS FICHAS DE HOJE, PROGRAMADAS À MÃO (conserto das fichas F2;
 * decisão do mestre de 08/11; seção 6 de
 * docs/planos/construtor-de-mecanicas-2026-11-08.md). Uma tabela por
 * `cartaoId` que só passa parâmetros às funções gerais (`disputa.ts`,
 * `area.ts`, `perguntaNaHora.ts`, a tabela de selos de `condicoes.ts`): nada de
 * `if (nome === ...)` espalhado, campo novo no pedido, regex nova ou extra com
 * nome mágico. Quando o construtor chegar, cada linha vira a peça do cartão.
 *
 * Os números saem de docs/auditoria-fichas/respostas-do-grilling.md (lei) e
 * os ids das fichas reais da pasta da mesa. O que ainda falta decidir fica
 * fora da linha (ver as pendências da fatia A no relatório).
 *
 * Puro: sem store, sem rede.
 */

/** O que muda com o resultado da disputa. */
export interface EfeitoDaDisputa {
  /** O selo que pega no alvo. */
  selo?: SeloDoGolpe
  /** A técnica não gasta: devolve o custo e o uso (Explosão quando o alvo passa). */
  devolveOCusto?: true
}

/**
 * A disputa que o app rola. `quando`: logo ao usar (antes do dano) ou só
 * depois do acerto. `testa`: quem rola o d20 principal. `seQuemUsaVence` /
 * `seQuemUsaPerde`: o efeito pelo lado de quem usa a técnica (quando o alvo
 * testa, "quem usa vence" = o alvo NÃO passou).
 */
export interface DisputaAMao {
  quando: 'uso' | 'acerto'
  testa: 'quemUsa' | 'alvo'
  rola: QuemRola
  contra: ContraDaDisputa
  seQuemUsaVence?: EfeitoDaDisputa
  seQuemUsaPerde?: EfeitoDaDisputa
}

/** A área do golpe e quem entra nela. */
export interface AreaAMao {
  forma: FormaDaArea
  quem: QuemEntraNaArea
}

export interface MecanicaAMao {
  /** Para quem lê a tabela: "Corta Cenoura (Jimboy)". */
  nome: string
  perguntas?: readonly PerguntaNaHora[]
  disputa?: DisputaAMao
  area?: AreaAMao
  /** O dano dividido entre os marcados, com o teto de alvos (`dividirDano`). */
  divide?: { teto: number }
}

const ATORDOADO_1: SeloDoGolpe = { nome: 'Atordoado', turnos: 1, natureza: 'debuff' }

/** A tabela. A chave é o `cartaoId` da técnica na ficha real. */
const MECANICAS_A_MAO: Readonly<Record<string, MecanicaAMao>> = {
  // Jimboy: depois do acerto, d20 + FOR (vantagem da Força Superior) contra d20 + RES do alvo; só atordoa se vencer.
  'cart_8d2a46e7-afa7-4b7a-bbaf-53ef36cb1669': {
    nome: 'Corta Cenoura (Jimboy)',
    disputa: { quando: 'acerto', testa: 'quemUsa', rola: { atributoId: 'forca', vantagem: 'vantagem' }, contra: { tipo: 'rolagem', quem: { atributoId: 'resistencia' } }, seQuemUsaVence: { selo: ATORDOADO_1 } },
  },
  // Guilherme: o alvo testa RES contra CD 11; se passar, nada acontece e a Explosão não gasta.
  'cart_14ed4fb4-817c-41ea-a417-517ece9782ed': {
    nome: 'Explosão (Guilherme)',
    disputa: { quando: 'uso', testa: 'alvo', rola: { atributoId: 'resistencia' }, contra: { tipo: 'cd', cd: { tipo: 'fixa', cd: 11 } }, seQuemUsaPerde: { devolveOCusto: true } },
  },
  // Siegfried: o alvo testa RES contra 12; falhou, Atordoado 1.
  'cart_3868a90d-a138-4fa0-a902-c30a7a53be7b': {
    nome: 'Gilgamesh: Entardecer (Siegfried)',
    disputa: { quando: 'acerto', testa: 'alvo', rola: { atributoId: 'resistencia' }, contra: { tipo: 'cd', cd: { tipo: 'fixa', cd: 12 } }, seQuemUsaVence: { selo: ATORDOADO_1 } },
  },
  // Vagn: o app pergunta "cortante ou perfurante?" e acerta todos na linha reta.
  'cart_d50ef507-dd18-4566-8015-94910a12136e': {
    nome: 'Projeção Letal (Vagn)',
    perguntas: [
      {
        chave: 'corte',
        texto: 'Cortante ou perfurante?',
        para: 'quemUsa',
        tipo: 'opcoes',
        opcoes: [
          { valor: 'cortante', rotulo: 'Cortante' },
          { valor: 'perfurante', rotulo: 'Perfurante' },
        ],
      },
    ],
  },
  // May, modo ataque: todos os INIMIGOS no 6x6 à frente dela.
  'cart_39e23a9c-84c7-4270-821d-bdd7701c32d3': { nome: 'Aplauso do Deus do Trovão (May)', area: { forma: { tipo: 'frente', lado: 6 }, quem: 'inimigos' } },
  // Harvey: os inimigos a 1 casa, marcados sozinhos (ele pode mudar a escolha).
  'cart_9500ae10-0bdc-4f08-b472-edb73cb70685': { nome: 'Giro de Pá (Harvey)', area: { forma: { tipo: 'raio', casas: 1 }, quem: 'inimigos' } },
  // Siegfried: a base dividida entre os marcados, para baixo, até 3 alvos.
  'cart_366f98ce-8206-473a-8646-e34ae6907dbe': { nome: 'Balmung: Lua Incandescente (Siegfried)', divide: { teto: 3 } },
  // Aira: o app pergunta quantos turnos o aliado fica com a Bênção.
  'cart_369efcd2-19cf-400d-a0f0-c19ceebc0070': {
    nome: 'A Virtude Traz Benção (Aira)',
    perguntas: [{ chave: 'turnos', texto: 'Quantos turnos o aliado fica com a Bênção?', para: 'quemUsa', tipo: 'numero', minimo: 1, maximo: 99 }],
  },
}

/** A mecânica à mão do cartão; `null` = a técnica segue só pelo texto da ficha. */
export function mecanicaDoCartao(cartaoId: string): MecanicaAMao | null {
  return Object.hasOwn(MECANICAS_A_MAO, cartaoId) ? MECANICAS_A_MAO[cartaoId] : null
}

/** As perguntas na hora da técnica (vazio = nenhuma). */
export function perguntasDoCartao(cartaoId: string): readonly PerguntaNaHora[] {
  return mecanicaDoCartao(cartaoId)?.perguntas ?? []
}

/** Por que as respostas do pedido não valem para a técnica, ou `null`. Técnica sem pergunta não aceita resposta. */
export function motivoDasRespostasDoCartao(cartaoId: string, respostas: RespostasDoPedido | undefined): string | null {
  return motivoDasRespostas(perguntasDoCartao(cartaoId), respostas)
}
