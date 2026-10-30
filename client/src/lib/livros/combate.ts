import type { Token } from '../../types/map'
import { maximoComposto } from '../ajusteDaFicha'
import {
  FORCA_PADRAO,
  RECURSO_QUE_A_FORCA_MULTIPLICA,
  forcaDe,
  forcaNoPasso,
  novoCartao,
  novoIdDePersonagem,
  novoPersonagem,
  type Personagem,
} from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'

/**
 * NPCS DE COMBATE do mundo do livro de regras (M1,
 * docs/planos/livros-de-regras-plano.md §2.1): quem entra na batalha, a
 * força, os modelos e as variações, a ficha mínima e a caixa "Quem entra na
 * batalha?". Puro: sem store, sem disco, sem rede.
 *
 * A força em si (`forcaDe`, `aplicarForca`) mora em lib/personagem.ts: os
 * funis do HP e do dano a leem, e eles não podem importar daqui sem ciclo.
 */

/** Os atalhos do deslizante da força, na ordem da tela. */
export const ATALHOS_DA_FORCA: readonly number[] = [0.5, 0.75, 1, 1.25, 1.5, 2]
/** "Ficha mínima (HP 300, golpe 80)" (decisão 2 do README). */
export const FICHA_MINIMA_HP = 300
export const FICHA_MINIMA_DANO = '80'
export const NOME_DO_GOLPE_MINIMO = 'Golpe'
/** O texto de ação que o leitor da batalha entende (`lerAcao`, lib/batalha/leituraDaFicha.ts). */
const ACAO_DO_GOLPE_MINIMO = 'Ação Simples'
/** A aba das técnicas (`ABA_DAS_TECNICAS`, lib/batalha/leituraDaFicha.ts): importá-la puxaria a batalha inteira para cá. */
const ABA_DAS_TECNICAS = 'habilidades'
const CAMPO_DO_DANO = 'dano'
const CAMPO_DA_ACAO = 'acao'

/**
 * Entra na ordem dos turnos? Jogador sempre; NPC sim, salvo "Só no cenário".
 * NPC antigo sem marca nenhuma conta como de combate (decisão D5): nada muda
 * para quem já usa a batalha.
 */
export function entraNaBatalha(personagem: Personagem): boolean {
  return personagem.tipo === 'jogador' || personagem.soCenario !== true
}

/** É variação de um modelo (a ficha vem dele, `sincronizarVariacoes`). */
export function ehVariacao(personagem: Personagem): boolean {
  return personagem.combate?.modeloId !== undefined
}

/** As variações do modelo, na ordem da lista. */
export function variacoesDe(modeloId: string, personagens: readonly Personagem[]): Personagem[] {
  return personagens.filter((personagem) => personagem.combate?.modeloId === modeloId)
}

/**
 * O mesmo personagem com força 1: a conta "riscada" do detalhe do NPC passa
 * pelos MESMOS funis (`maximoComposto`, `danoDoAtaque`) com esta cópia, em vez
 * de dividir o número de volta (o arredondamento não desfaz).
 */
export function semForca(personagem: Personagem): Personagem {
  if (personagem.combate === undefined || personagem.combate.forca === FORCA_PADRAO) return personagem
  return { ...personagem, combate: { ...personagem.combate, forca: FORCA_PADRAO } }
}

/**
 * Grava a força nova (no passo do deslizante) e reescala o HP ATUAL na mesma
 * proporção: o NPC a 50% continua a 50%. O máximo não é gravado multiplicado
 * — a força só entra na leitura (`maximoComposto`). Jogador não tem força: sai
 * como entrou. Mesma força = a mesma referência.
 */
export function trocarForca(personagem: Personagem, nova: number): Personagem {
  if (personagem.tipo !== 'npc') return personagem
  const antiga = forcaDe(personagem)
  const forca = forcaNoPasso(nova)
  if (forca === antiga && personagem.combate !== undefined) return personagem
  const copia: Personagem = { ...personagem, combate: { ...personagem.combate, forca } }
  const atual = personagem.recursos[RECURSO_QUE_A_FORCA_MULTIPLICA]
  if (atual !== undefined && forca !== antiga) {
    copia.recursos = { ...personagem.recursos, [RECURSO_QUE_A_FORCA_MULTIPLICA]: Math.round((atual * forca) / antiga) }
  }
  return copia
}

/** "Soltar do modelo": a variação vira NPC único, com a ficha que tem agora. */
export function soltarDoModelo(personagem: Personagem): Personagem {
  if (personagem.combate?.modeloId === undefined) return personagem
  return { ...personagem, combate: { forca: personagem.combate.forca } }
}

/** O mesmo valor de dado (JSON do disco): a cópia lida de novo não conta como mudança. */
function mesmoValor(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b)
}

/** O que a variação recebe do modelo; o resto (id, nome, recursos atuais, cartões ligados, histórico, combate, nota) é dela. */
const PARTES_DO_MODELO = ['atributos', 'modificadoresDosAtributos', 'maximos', 'modificadoresDosRecursos', 'abas', 'escolhas', 'etiquetas', 'descricao'] as const

/** O modelo na raiz: variação de variação copia do primeiro modelo. Ciclo ou modelo ausente = `undefined`. */
function modeloRaiz(modeloId: string, porId: ReadonlyMap<string, Personagem>): Personagem | undefined {
  const vistos = new Set<string>()
  let atual = porId.get(modeloId)
  while (atual !== undefined && atual.combate?.modeloId !== undefined) {
    if (vistos.has(atual.id)) return undefined
    vistos.add(atual.id)
    atual = porId.get(atual.combate.modeloId)
  }
  return atual
}

/** A variação com a ficha do modelo; a mesma referência quando já está igual. */
function variacaoSincronizada(variacao: Personagem, modelo: Personagem): Personagem {
  let copia: Personagem | null = null
  for (const parte of PARTES_DO_MODELO) {
    if (mesmoValor(variacao[parte], modelo[parte])) continue
    copia ??= { ...variacao }
    // Cada parte com o tipo dela: a atribuição por chave genérica não estreita a união.
    if (parte === 'descricao') copia.descricao = modelo.descricao
    else if (parte === 'etiquetas') copia.etiquetas = modelo.etiquetas
    else if (parte === 'abas') copia.abas = modelo.abas
    else if (parte === 'escolhas') copia.escolhas = modelo.escolhas
    else copia[parte] = modelo[parte]
  }
  if (variacao.retrato === null && modelo.retrato !== null) {
    copia ??= { ...variacao }
    copia.retrato = modelo.retrato
  }
  return copia ?? variacao
}

/**
 * VARIAÇÃO MATERIALIZADA: cada variação recebe do modelo atributos,
 * modificadores, máximos, abas, escolhas, etiquetas e descrição; fica com o
 * id, o nome, o retrato próprio (sem ele, o do modelo), os recursos atuais,
 * os cartões ligados, o histórico, o combate e a nota. Modelo apagado (ou
 * ciclo de modelos, de arquivo mexido à mão): a variação perde `modeloId` e
 * vira NPC único. Idempotente; devolve a MESMA lista quando nada muda (o
 * host compara por referência para não reenviar).
 *
 * Por que materializar: dezenas de leitores (ficha, batalha, rede, IA) leem
 * `Personagem` cru; materializar mexe num funil de gravação só
 * (`mundoDoLivroStore.mudar` e `donoDosPersonagens().gravar`).
 */
export function sincronizarVariacoes(personagens: Personagem[]): Personagem[] {
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  let mudou = false
  const novos = personagens.map((personagem) => {
    const modeloId = personagem.combate?.modeloId
    if (modeloId === undefined) return personagem
    const modelo = modeloRaiz(modeloId, porId)
    const sincronizado = modelo === undefined || modelo.id === personagem.id ? soltarDoModelo(personagem) : variacaoSincronizada(personagem, modelo)
    if (sincronizado !== personagem) mudou = true
    return sincronizado
  })
  return mudou ? novos : personagens
}

/**
 * "Ficha mínima (HP 300, golpe 80)": NPC de combate com força 1, HP 300/300
 * no recurso da força e a técnica "Golpe" de dano 80, quando o sistema os
 * tem. Sistema sem esse recurso ou sem a aba das técnicas: o que faltar fica
 * de fora (a ficha vazia com o nome, no pior caso).
 */
export function fichaMinima(sistema: SistemaDeRpg, nome: string): Personagem {
  const ficha: Personagem = { ...novoPersonagem(sistema, 'npc', nome), combate: { forca: FORCA_PADRAO } }
  if (sistema.recursos.some((recurso) => recurso.id === RECURSO_QUE_A_FORCA_MULTIPLICA)) {
    ficha.recursos = { ...ficha.recursos, [RECURSO_QUE_A_FORCA_MULTIPLICA]: FICHA_MINIMA_HP }
    ficha.maximos = { [RECURSO_QUE_A_FORCA_MULTIPLICA]: FICHA_MINIMA_HP }
  }
  const aba = sistema.abas.find((candidata) => candidata.id === ABA_DAS_TECNICAS)
  if (aba !== undefined && aba.campos.some((campo) => campo.id === CAMPO_DO_DANO)) {
    const golpe = novoCartao(NOME_DO_GOLPE_MINIMO)
    golpe.campos = { [CAMPO_DO_DANO]: FICHA_MINIMA_DANO }
    if (aba.campos.some((campo) => campo.id === CAMPO_DA_ACAO)) golpe.campos[CAMPO_DA_ACAO] = ACAO_DO_GOLPE_MINIMO
    ficha.abas = { ...ficha.abas, [ABA_DAS_TECNICAS]: [golpe] }
  }
  return ficha
}

/**
 * "Nova variação" (e o "Como Recruta da Marinha" do Iniciar): a ficha do
 * modelo copiada, com id e nome novos, força 1, HP cheio, sem histórico, sem
 * nota e sem ligação a jogador. Variação de variação aponta para o modelo raiz.
 */
export function novaVariacao(modelo: Personagem, nome: string): Personagem {
  const raiz = modelo.combate?.modeloId ?? modelo.id
  const { dono: _dono, nomeDoJogador: _nome, notaDoMestre: _nota, soCenario: _cenario, ...ficha } = modelo // a variação nasce sem nada que é do modelo como pessoa
  const variacao: Personagem = {
    ...ficha,
    id: novoIdDePersonagem(),
    tipo: 'npc',
    nome: nome.trim() || modelo.nome,
    historico: [],
    combate: { forca: FORCA_PADRAO, modeloId: raiz },
  }
  const temHp = variacao.recursos[RECURSO_QUE_A_FORCA_MULTIPLICA] !== undefined || variacao.maximos[RECURSO_QUE_A_FORCA_MULTIPLICA] !== undefined
  if (temHp) variacao.recursos = { ...variacao.recursos, [RECURSO_QUE_A_FORCA_MULTIPLICA]: maximoComposto(variacao, RECURSO_QUE_A_FORCA_MULTIPLICA).total }
  return variacao
}

// ───────────────────────────────────────────────────────────────────────────
// "Quem entra na batalha?" (o Iniciar batalha, components/livro/QuemEntraNaBatalha.tsx)
// ───────────────────────────────────────────────────────────────────────────

/** Como o token está para a batalha: com ficha de combate, sem ficha nenhuma, ou com ficha "Só no cenário". */
export type SituacaoNaBatalha = 'combate' | 'semFicha' | 'soCenario'

export interface CandidatoDaBatalha {
  tokenId: string
  /** O nome do token no mapa (o de trabalho do mestre). */
  nome: string
  /** O personagem ligado que ainda existe; `null` = sem ficha. */
  personagemId: string | null
  situacao: SituacaoNaBatalha
}

/**
 * Com que ficha o token marcado entra: a própria (só quem tem uma, inclusive
 * a "Só no cenário", que entra só nesta batalha), a mínima, ou uma variação
 * nova do modelo, com o nome do token.
 */
export type ComoEntra = { tipo: 'propria' } | { tipo: 'minima' } | { tipo: 'modelo'; modeloId: string }

/** Um token MARCADO na caixa. Token desmarcado não aparece na lista. */
export interface EscolhaDaBatalha {
  tokenId: string
  como: ComoEntra
}

type TokenDaCaixa = Pick<Token, 'id' | 'characterId' | 'name' | 'hidden'>

/**
 * Os tokens da cena que a caixa lista, na ordem do mapa: os não escondidos no
 * editor (os escondidos já ficam fora da ordem, `combatentesIniciais`).
 * Ligado a personagem apagado = sem ficha.
 */
export function quemPodeEntrar(tokens: readonly TokenDaCaixa[], personagens: readonly Personagem[]): CandidatoDaBatalha[] {
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  return tokens
    .filter((token) => token.hidden !== true)
    .map((token): CandidatoDaBatalha => {
      const personagem = token.characterId === null ? undefined : porId.get(token.characterId)
      if (personagem === undefined) return { tokenId: token.id, nome: token.name, personagemId: null, situacao: 'semFicha' }
      return { tokenId: token.id, nome: token.name, personagemId: personagem.id, situacao: entraNaBatalha(personagem) ? 'combate' : 'soCenario' }
    })
}

/** A caixa só abre quando há token sem ficha de combate; sem nenhum, o Iniciar segue direto como antes. */
export function precisaPerguntar(candidatos: readonly CandidatoDaBatalha[]): boolean {
  return candidatos.some((candidato) => candidato.situacao !== 'combate')
}
