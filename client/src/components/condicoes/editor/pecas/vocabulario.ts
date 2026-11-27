import { nomeDoAtributoDaPeca } from '../../../../lib/batalha/mecanica/pecas'
import { condicaoDaFabrica, LISTA_DA_FABRICA, pastilhaDaFabrica, pastilhaDeFabricaDoMapa } from '../../../../lib/condicoes/fabrica'
import type { ContextoDasFrases } from '../../../../lib/condicoes/frasesDaCondicao'
import {
  BLOQUEIOS_DA_CONDICAO,
  COMO_SE_PAGA,
  CONTA_DA_VEZ,
  CONTA_DO_ATRIBUTO,
  DE_NOVO_DA_CONDICAO,
  FAZ_DA_VEZ,
  FAZ_DO_ATRIBUTO,
  MODOS_DO_PRAZO,
  NOMES_DOS_TIPOS_DE_DANO,
  O_QUE_SE_PAGA,
  QUANDO_DA_VEZ,
  QUEM_DA_AURA,
  QUEM_DA_MARCA,
  RECURSOS_DA_VEZ,
  RITMOS_DO_ATRIBUTO,
  TIPOS_DA_CONDICAO,
  TIPOS_DE_DANO,
  TIPOS_DE_SAIDA,
  type BloqueioDaCondicao,
  type CondicaoMontada,
  type DeNovoDaCondicao,
  type ModoDoPrazo,
  type PecaDaCondicaoDa,
  type SaidaDaCondicao,
  type TipoDaCondicao,
  type TipoDaSaida,
  type TipoDeDano,
} from '../../../../lib/condicoes/modelo'
import { simboloDaCondicaoPropria } from '../../../../lib/condicoesProprias'
import type { PecaDoGatilho } from '../../../../lib/itens/modelo'
import { TOKEN_CONDITION_SYMBOLS, type ConditionSymbol } from '../../../../lib/tokenConditions'
import type { AtributoDaPeca } from '../registro'

/**
 * O VOCABULÁRIO DAS PEÇAS DA CONDIÇÃO NA TELA (rework das condições, PLANO.md E4; `ATRIBUTOS`, `STATUS`,
 * `BLOQUEIOS`, `SAIDAS`, `pecaNova`, `efeitoNovo` e `saidaNova` do protótipo, prototipo.html:532-600). Só
 * a forma de mostrar e escolher: o que vale, os tetos e os padrões do modelo moram em
 * `lib/condicoes/modelo.ts`, e o juiz do que se grava é o leitor (`lib/condicoes/leitura.ts`). Toda peça e
 * toda saída que nasce aqui passa no leitor do jeito que está.
 *
 * Os rótulos são as palavras do protótipo, dentro da frase da peça ("No começo de cada vez [tira] [10]
 * [de] [Vida]"): cada `Record` cobre todas as escolhas do modelo, e o tipo reclama se faltar uma.
 */

/** Uma escolha num campo da peça: o valor do modelo e as palavras da tela. */
export interface OpcaoDaCondicao<T extends string> {
  valor: T
  rotulo: string
}

/** As escolhas na ordem do modelo, com os rótulos da tela. */
function opcoes<T extends string>(valores: readonly T[], rotulos: Readonly<Record<T, string>>): readonly OpcaoDaCondicao<T>[] {
  return valores.map((valor) => ({ valor, rotulo: rotulos[valor] }))
}

/** A palavra "turno" ou "turnos" depois do número. */
export function turnos(n: number): string {
  return Math.abs(n) === 1 ? 'turno' : 'turnos'
}

/** A palavra "casa" ou "casas" depois do número. */
export function casas(n: number): string {
  return Math.abs(n) === 1 ? 'casa' : 'casas'
}

// ─── Atributos ─────────────────────────────────────────────────────────────

const comNome = (id: string): AtributoDaPeca => ({ id, nome: nomeDoAtributoDaPeca(id) })

/** Os 8 atributos da ficha de One Piece: os testes de saída (d20 + o mod do atributo). */
export const ATRIBUTOS_DA_FICHA: readonly AtributoDaPeca[] = ['forca', 'agilidade', 'percepcao', 'resistencia', 'intuicao', 'espirito', 'carisma', 'determinacao'].map(comNome)

/** O que o Muda atributo mexe sem o sistema da mesa (`STATUS` do protótipo): os 8, mais Velocidade, CA, Dano e Alcance. */
export const ATRIBUTOS_DO_STATUS: readonly AtributoDaPeca[] = [...ATRIBUTOS_DA_FICHA, ...['velocidade', 'ca', 'dano', 'alcance'].map(comNome)]

/** Os atributos como escolhas da lista. */
export function opcoesDosAtributos(atributos: readonly AtributoDaPeca[]): readonly OpcaoDaCondicao<string>[] {
  return atributos.map((atributo) => ({ valor: atributo.id, rotulo: atributo.nome }))
}

// ─── O tipo da condição e os tipos de dano ─────────────────────────────────

export const TIPOS_NA_TELA = opcoes<TipoDaCondicao>(TIPOS_DA_CONDICAO, { negativa: 'Negativa', positiva: 'Positiva' })

/** Os tipos de dano no "de que tipo": "de qualquer tipo", e "só de Fogo" (Dano e cura) ou "de Fogo" (a saída). */
export function tiposDeDanoNaTela(prefixo: 'só de' | 'de'): readonly OpcaoDaCondicao<TipoDeDano>[] {
  return TIPOS_DE_DANO.map((tipo) => ({ valor: tipo, rotulo: tipo === 'qualquer' ? 'de qualquer tipo' : `${prefixo} ${NOMES_DOS_TIPOS_DE_DANO[tipo]}` }))
}

// ─── Efeito na vez ─────────────────────────────────────────────────────────

type PecaDaVez = PecaDaCondicaoDa<'vez'>

export const QUANDO_NA_TELA = opcoes<PecaDaVez['quando']>(QUANDO_DA_VEZ, { entrar: 'Ao entrar', comeco: 'No começo de cada vez', fim: 'No fim de cada vez' })
export const FAZ_DA_VEZ_NA_TELA = opcoes<PecaDaVez['faz']>(FAZ_DA_VEZ, { tira: 'tira', da: 'dá' })
export const CONTA_DA_VEZ_NA_TELA = opcoes<PecaDaVez['conta']>(CONTA_DA_VEZ, { fixo: 'de', pctMax: '% da máxima de', pctAtual: '% da atual de' })
export const RECURSOS_NA_TELA = opcoes<PecaDaVez['recurso']>(RECURSOS_DA_VEZ, { vida: 'Vida', sp: 'SP', escudo: 'Escudo' })

// ─── Muda atributo ─────────────────────────────────────────────────────────

type PecaDoAtributo = PecaDaCondicaoDa<'atributo'>

export const FAZ_DO_ATRIBUTO_NA_TELA = opcoes<PecaDoAtributo['faz']>(FAZ_DO_ATRIBUTO, { tira: 'perde', soma: 'ganha', fica: 'fica em', maximo: 'fica no máximo em' })
export const CONTA_DO_ATRIBUTO_NA_TELA = opcoes<PecaDoAtributo['conta']>(CONTA_DO_ATRIBUTO, { fixo: 'pontos', pct: '% do valor' })
export const RITMOS_NA_TELA = opcoes<PecaDoAtributo['ritmo']>(RITMOS_DO_ATRIBUTO, { umaVez: 'De uma vez', cada: 'A cada turno, somando', aPartir: 'A partir do turno' })

// ─── Bloqueio ──────────────────────────────────────────────────────────────

const EXPLICACAO_DO_BLOQUEIO: Readonly<Record<BloqueioDaCondicao, { nome: string; explica: string }>> = {
  perdeVez: { nome: 'Perde a vez', explica: 'na vez dele só Passar a vez' },
  naoReage: { nome: 'Não pode reagir', explica: 'o golpe nele resolve sem reação' },
  reageDesv: { nome: 'Reage com desvantagem', explica: '2 d20, fica o menor' },
  naoDesvia: { nome: 'Não pode desviar', explica: 'sem Esquiva nem Contra-ataque' },
  naoMove: { nome: 'Não pode se mover', explica: 'fica na casa em que está' },
  naoTecnica: { nome: 'Não pode usar técnica', explica: 'só golpe comum e item' },
  soSimples: { nome: 'Só ação simples', explica: 'sem Completa nem Bônus' },
  naoAlvo: { nome: 'Não pode ser alvo', explica: 'ninguém consegue mirar nele' },
}

/** Os bloqueios na ordem da frase, com o nome e o que querem dizer na mesa (`BLOQUEIOS` do protótipo). */
export const BLOQUEIOS_NA_TELA: readonly { bloqueio: BloqueioDaCondicao; nome: string; explica: string }[] = BLOQUEIOS_DA_CONDICAO.map((bloqueio) => ({ bloqueio, ...EXPLICACAO_DO_BLOQUEIO[bloqueio] }))

// ─── Marca e Aura ──────────────────────────────────────────────────────────

export const QUEM_DA_MARCA_NA_TELA = opcoes<PecaDaCondicaoDa<'marca'>['quem']>(QUEM_DA_MARCA, { todos: 'qualquer um', quemPos: 'só quem pôs' })
export const QUEM_DA_AURA_NA_TELA = opcoes<PecaDaCondicaoDa<'aura'>['quem']>(QUEM_DA_AURA, { aliados: 'aliados dele', inimigos: 'inimigos dele', todos: 'todos' })

// ─── O "Depois de X turnos" ────────────────────────────────────────────────

type GatilhoDaPeca = PecaDaCondicaoDa<'gatilho'>['gatilho']

export const AO_DISPARAR_NA_TELA = opcoes<GatilhoDaPeca['aoDisparar']>(['some', 'continua'], { some: 'esta condição some', continua: 'continua' })
export const EFEITOS_DO_GATILHO_NA_TELA = opcoes<PecaDoGatilho['tipo']>(['dano', 'curar', 'condicao', 'tirar'], { dano: 'Dá dano', curar: 'Cura', condicao: 'Põe condição', tirar: 'Tira condição' })

/** Os números de partida do efeito (`efeitoNovo` do protótipo). */
const DANO_DE_PARTIDA = 30
const CURA_DE_PARTIDA = 20
/** A condição que o "Põe condição" sugere ao nascer (o "vira Atordoado" do dono, pedido de 26/11). */
const ID_DA_CONDICAO_DE_PARTIDA = 'atordoado'

/** Um efeito novo do gatilho; o "Põe condição" nasce com a Atordoado, ou a primeira da lista, por 1 turno. */
export function efeitoDoGatilhoNovo(tipo: PecaDoGatilho['tipo'], nomes: readonly string[]): PecaDoGatilho {
  switch (tipo) {
    case 'dano':
      return { tipo: 'dano', valor: DANO_DE_PARTIDA }
    case 'curar':
      return { tipo: 'curar', fixo: CURA_DE_PARTIDA }
    case 'condicao': {
      const sugerida = condicaoDaFabrica(ID_DA_CONDICAO_DE_PARTIDA)?.nome
      const nome = sugerida !== undefined && nomes.includes(sugerida) ? sugerida : (nomes[0] ?? sugerida ?? 'Atordoado')
      return { tipo: 'condicao', nome, duracao: 1 }
    }
    case 'tirar':
      return { tipo: 'tirar', nome: null }
  }
}

// ─── Prazo e saídas ────────────────────────────────────────────────────────

export const MODOS_NA_TELA = opcoes<ModoDoPrazo>(MODOS_DO_PRAZO, { turnos: 'Turnos', proximoGolpe: 'Até o próximo golpe', ateTirar: 'Até tirarem', batalha: 'A batalha toda' })
export const DE_NOVO_NA_TELA = opcoes<DeNovoDaCondicao>(DE_NOVO_DA_CONDICAO, { renova: 'O prazo recomeça', pilha: 'Soma uma pilha', nada: 'Nada muda' })

type SaidaPagando = Extract<SaidaDaCondicao, { tipo: 'pagar' }>

export const COMO_SE_PAGA_NA_TELA = opcoes<SaidaPagando['como']>(COMO_SE_PAGA, { pagar: 'Só pagar', teste: 'Só teste', e: 'Pagar e teste', ou: 'Pagar ou teste' })
export const O_QUE_SE_PAGA_NA_TELA = opcoes<SaidaPagando['paga']>(O_QUE_SE_PAGA, { sp: 'de SP', vida: 'de vida', acao: 'a ação simples' })
/** As saídas no "+ Saída" (`SAIDAS` do protótipo). */
export const SAIDAS_NA_TELA = opcoes<TipoDaSaida>(TIPOS_DE_SAIDA, {
  teste: 'Teste por turno (atributo e CD)',
  pagar: 'Pagar e/ou teste, na vez dele',
  cura: 'Ao receber cura',
  dano: 'Ao tomar dano de um tipo',
  agir: 'Ao atacar ou usar técnica',
})

/** O atributo, a CD e o quanto se paga com que a saída nasce (`saidaNova` do protótipo). */
export const ATRIBUTO_DO_TESTE_DE_PARTIDA = 'resistencia'
export const ATRIBUTO_DO_PAGAR_DE_PARTIDA = 'forca'
export const CD_DE_PARTIDA = 12
export const PAGA_DE_PARTIDA = 20

/** Uma saída nova, já no formato que o leitor aceita. */
export function saidaNova(tipo: TipoDaSaida): SaidaDaCondicao {
  switch (tipo) {
    case 'teste':
      return { tipo: 'teste', atr: ATRIBUTO_DO_TESTE_DE_PARTIDA, cd: CD_DE_PARTIDA }
    case 'pagar':
      return { tipo: 'pagar', como: 'ou', paga: 'sp', v: PAGA_DE_PARTIDA, atr: ATRIBUTO_DO_PAGAR_DE_PARTIDA, cd: CD_DE_PARTIDA }
    case 'cura':
      return { tipo: 'cura' }
    case 'dano':
      return { tipo: 'dano', dano: 'qualquer' }
    case 'agir':
      return { tipo: 'agir' }
  }
}

// ─── As outras condições do catálogo ───────────────────────────────────────

/** O catálogo em volta (as de fábrica e as criadas, montadas); sem contexto, as 35 de fábrica. */
export function condicoesDoContexto(contexto: ContextoDasFrases): readonly CondicaoMontada[] {
  return contexto.todas ?? LISTA_DA_FABRICA
}

/** As do catálogo menos esta (uma peça não cita a própria condição). */
export function outrasDoContexto(contexto: ContextoDasFrases, idDestaCondicao: string): readonly CondicaoMontada[] {
  return condicoesDoContexto(contexto).filter((condicao) => condicao.id !== idDestaCondicao)
}

/** O nome de uma condição do catálogo pelo id; a apagada ganha o aviso no lugar do nome. */
export function nomeNoContexto(id: string, contexto: ContextoDasFrases): string {
  return condicoesDoContexto(contexto).find((condicao) => condicao.id === id)?.nome ?? condicaoDaFabrica(id)?.nome ?? 'condição apagada'
}

/**
 * A pastilha de uma de fábrica pelo id: as 6 de sempre com o desenho do mapa (D11), as outras no molde das
 * criadas, pelo mesmo `simboloDaCondicaoPropria` do mapa. `null` = não é de fábrica.
 */
export function simboloDaFabricaPeloId(id: string): ConditionSymbol | null {
  const doMapa = pastilhaDeFabricaDoMapa(id)
  if (doMapa !== null) return TOKEN_CONDITION_SYMBOLS[doMapa]
  const deFabrica = condicaoDaFabrica(id)
  return deFabrica === null ? null : simboloDaCondicaoPropria(pastilhaDaFabrica(deFabrica))
}
