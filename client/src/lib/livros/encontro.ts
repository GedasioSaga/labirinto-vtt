import { maximoComposto, valorDoRank } from '../ajusteDaFicha'
import { CAMPO_DO_DANO, danoDoAtaque } from '../batalha/formula'
import { armasDe, ehOverload, lerAcao, lerCusto, recursoDoCusto, recursoDoEscudo, tecnicasComForma, CAMPO_DA_ACAO, CAMPO_DO_CUSTO } from '../batalha/leituraDaFicha'
import { fatorDaSaida, saidasPossiveis } from '../batalha/reacao'
import { FORCA_MAX, FORCA_MIN, forcaDe, forcaNoPasso, numeroDaFicha, type CartaoDaFicha, type Personagem } from '../personagem'
import { rankDoValor, rotuloDoRank, type RecursoDoSistema, type SistemaDeRpg } from '../sistemaDeRpg'
import { recursoDeVida } from '../vidaDaFicha'
import { trocarForca } from './combate'
import { lerDanoDoCartao, type EstadoDaLeitura } from './saude'

/**
 * COMPARAR E BALANCEAR do mundo do livro de regras (M2,
 * docs/planos/livros-de-regras-plano.md, seção M2): as colunas do Comparar e o
 * peso do encontro (grupo x inimigos). Puro: sem store, sem disco, sem rede.
 *
 * Os números vêm SÓ de lib/batalha/formula.ts e lib/batalha/leituraDaFicha.ts
 * (e do `maximoComposto`, que já aplica a força): nunca uma cópia da conta.
 * O Comparar tem de dar o MESMO número que o menu da vez mostra na batalha
 * para a mesma ficha e arma.
 */

/** O veredito do encontro, do mais leve ao mais pesado. */
export type PesoDoEncontro = 'facil' | 'justo' | 'duro' | 'mortal'
/** Os botões "Deixar Fácil / Justo / Duro" (não há "Deixar Mortal"). */
export type AlvoDoPeso = Exclude<PesoDoEncontro, 'mortal'>

export const NOME_DO_PESO: Readonly<Record<PesoDoEncontro, string>> = { facil: 'Fácil', justo: 'Justo', duro: 'Duro', mortal: 'Mortal' }

/**
 * As faixas da razão (rodadas do grupo para derrubar / rodadas dos inimigos
 * para derrubar), como no protótipo: até 0,35 Fácil, até 0,7 Justo, até 1
 * Duro, acima Mortal.
 */
export const TETO_DO_PESO: Readonly<Record<AlvoDoPeso, number>> = { facil: 0.35, justo: 0.7, duro: 1 }
/** A razão que cada botão mira: o meio da faixa (protótipo, `ALVO_DO_PESO`). */
export const ALVO_DO_PESO: Readonly<Record<AlvoDoPeso, number>> = { facil: 0.25, justo: 0.55, duro: 0.85 }

/** O Comparar mostra de 2 a 4 fichas lado a lado. */
export const COMPARAR_MIN = 2
export const COMPARAR_MAX = 4

/** O nome do golpe sem técnica (o do menu da vez). */
export const NOME_DO_ATAQUE = 'Atacar'

const FACES_DO_D20 = 20
/** O modificador da reação na média: o encontro estima sem saber quem reage. */
const MODIFICADOR_DA_MEDIA = 0

/**
 * Quanto de um golpe passa, na média, pela reação do alvo: cada face do d20
 * (modificador 0) com a MELHOR saída que ela libera (`saidasPossiveis`) e o
 * fator dela (`fatorDaSaida`). Dá crítico 5% x1,5 + cheio 40% x1 + metade
 * 25% x0,5 + esquiva/contra 30% x0 = 0,6. Conta, não número mágico: mudou a
 * tabela da reação, muda aqui junto.
 */
export const FATOR_DA_REACAO: number =
  Array.from({ length: FACES_DO_D20 }, (_, i) => {
    const d20 = i + 1
    // `saidasPossiveis` nunca devolve lista vazia (abaixo de 10 é ['cheio']).
    return fatorDaSaida(saidasPossiveis(d20, d20 + MODIFICADOR_DA_MEDIA)[0])
  }).reduce((soma, fator) => soma + fator, 0) / FACES_DO_D20

/** Um golpe da ficha com o dano que a fórmula dá agora (força já aplicada). */
export interface GolpeDaFicha {
  /** A técnica; `null` = o Atacar ("Força + Dano da arma", `danoDoAtaque`). */
  cartao: CartaoDaFicha | null
  /** O nome da técnica, ou "Atacar (Gram)" / "Atacar". */
  nome: string
  /** Vem de transformação ligada: o nome da forma. */
  forma?: string
  /** O dano lido; `null` quando a leitura não fecha (À mão, Não lê, % da vida, arma que a ficha não tem). */
  valor: number | null
  /** A conta à vista ("188 x1,5 = 282"), ou o texto da ficha quando não lê. */
  conta: string
  /** Como a leitura saiu: "Na hora", "À mão" e "Não lê" aparecem em cinza. */
  estado: EstadoDaLeitura
}

/** Um número da ficha com atual e máximo (HP, SP); `null` na coluna = o sistema não tem. */
export interface AtualEMaximo {
  atual: number
  /** Com a força (HP do NPC) e os modificadores: `maximoComposto`. */
  maximo: number
}

export interface AtributoDaColuna {
  id: string
  nome: string
  abreviacao: string
  /** O TOTAL (`valorDoRank`). */
  valor: number
  /** "R7"; `null` = o atributo não tem tabela de rank. */
  rank: string | null
}

/** Uma coluna do Comparar. */
export interface ColunaDaComparacao {
  personagemId: string
  nome: string
  tipo: Personagem['tipo']
  /** A força do NPC (`forcaDe`); 1 para jogador. */
  forca: number
  hp: AtualEMaximo | null
  sp: AtualEMaximo | null
  /** O Escudo (o valor de agora); `null` = o sistema não tem. */
  escudo: number | null
  atributos: AtributoDaColuna[]
  /** O Atacar (um por arma, como no menu) e cada técnica que vale agora com Dano escrito ou À mão. */
  golpes: GolpeDaFicha[]
}

/** Um lado do encontro somado. */
export interface LadoDoEncontro {
  /** HP máximo + Escudo de todos (inimigo repetido conta N vezes). */
  vida: number
  /** Soma do melhor golpe de cada um x `FATOR_DA_REACAO`. */
  danoPorRodada: number
  /** Rodadas para ESTE lado derrubar o outro; `Infinity` = nunca (sem dano). */
  rodadasParaDerrubar: number
}

export interface ResultadoDoEncontro {
  grupo: LadoDoEncontro
  inimigos: LadoDoEncontro
  /** Rodadas do grupo / rodadas dos inimigos; 0 quando os inimigos nunca derrubam o grupo; `Infinity` quando só o grupo nunca derruba. */
  razao: number
  /** `null` = falta um dos lados (grupo vazio ou nenhum inimigo). */
  peso: PesoDoEncontro | null
  /** Fichas do encontro sem golpe com número: não somam dano (a tela avisa). Sem repetição, na ordem do grupo e depois dos inimigos. */
  semGolpe: string[]
}

/** O que "Deixar Fácil / Justo / Duro" muda: a força nova de cada NPC inimigo e a de antes (para o Desfazer). */
export interface AjusteDoPeso {
  /** Id do NPC -> força nova (já no passo e na faixa). */
  forcas: Record<string, number>
  /** Id do NPC -> força de antes. */
  antes: Record<string, number>
  /** O veredito com as forças novas (o aviso: "o encontro ficou Justo"). */
  pesoDepois: PesoDoEncontro | null
  /** Alguém bateu em `FORCA_MIN` ou `FORCA_MAX` e o alvo não foi alcançado: o aviso pede para mudar o número de inimigos. */
  noLimite: boolean
}

function atualEMaximo(personagem: Personagem, recurso: RecursoDoSistema | null): AtualEMaximo | null {
  if (recurso === null) return null
  return { atual: numeroDaFicha(personagem.recursos, recurso.id), maximo: maximoComposto(personagem, recurso.id).total }
}

/** O Escudo de agora: um número só (`Personagem.recursos`), ou o máximo se o sistema o fizer de atual e máximo. */
function escudoDe(personagem: Personagem, sistema: SistemaDeRpg): number | null {
  const escudo = recursoDoEscudo(sistema)
  if (escudo === null) return null
  return escudo.atualEMaximo === true ? maximoComposto(personagem, escudo.id).total : numeroDaFicha(personagem.recursos, escudo.id)
}

/** O Atacar como o menu da vez oferece: uma tira por arma; sem arma, o desarmado (Força). */
function ataquesDe(personagem: Personagem, sistema: SistemaDeRpg): GolpeDaFicha[] {
  const armas: (CartaoDaFicha | null)[] = armasDe(personagem)
  return (armas.length === 0 ? [null] : armas).map((arma) => {
    const lido = danoDoAtaque({ personagem, sistema, arma, vidaDoAlvo: null })
    const nome = arma === null ? NOME_DO_ATAQUE : `${NOME_DO_ATAQUE} (${arma.nome})`
    if (lido.tipo === 'valor') return { cartao: null, nome, valor: lido.valor, conta: lido.conta, estado: 'lido' }
    return { cartao: null, nome, valor: null, conta: arma === null ? 'Força' : `Força + ${arma.nome}`, estado: 'naoLe' }
  })
}

/** As técnicas que valem agora (`tecnicasComForma`: forma desligada fica fora) com o Dano pelo mesmo mapeamento da Saúde. */
function tecnicasComDano(personagem: Personagem, sistema: SistemaDeRpg): GolpeDaFicha[] {
  const golpes: GolpeDaFicha[] = []
  for (const { cartao, forma } of tecnicasComForma(personagem, sistema)) {
    const texto = cartao.campos[CAMPO_DO_DANO] ?? ''
    const dano = lerDanoDoCartao(texto, cartao, personagem, sistema)
    if (dano === null) continue
    const golpe: GolpeDaFicha = { cartao, nome: cartao.nome, valor: dano.valor, conta: dano.valor === null ? texto.trim() : dano.leitura, estado: dano.estado }
    if (forma !== undefined) golpe.forma = forma
    golpes.push(golpe)
  }
  return golpes
}

/** O Atacar e as técnicas, na ordem do menu da vez. */
export function golpesDaFicha(personagem: Personagem, sistema: SistemaDeRpg): GolpeDaFicha[] {
  return [...ataquesDe(personagem, sistema), ...tecnicasComDano(personagem, sistema)]
}

/**
 * A ficha paga o custo da técnica? Cabe no MÁXIMO do recurso (SP; HP precisa
 * sobrar 1). Custo que a leitura não fecha e sem sugestão: paga (não há como
 * saber, e cortar esconderia o golpe). Recurso que o sistema não tem: paga.
 */
function pagaOCusto(cartao: CartaoDaFicha, personagem: Personagem, sistema: SistemaDeRpg): boolean {
  const custo = lerCusto(cartao.campos[CAMPO_DO_CUSTO] ?? '', personagem)
  if (custo.tipo === 'nada') return true
  const valor = custo.tipo === 'valor' ? custo.valor : custo.sugestao
  if (valor === null) return true
  const recurso = recursoDoCusto(sistema, custo.recurso)
  if (recurso === null) return true
  const maximo = maximoComposto(personagem, recurso.id).total
  return custo.recurso === 'hp' ? valor < maximo : valor <= maximo
}

/**
 * O maior dano que a ficha consegue pagar: o Atacar e as técnicas que valem
 * agora (sem forma desligada), fora OVERLOAD (`ehOverload`) e Passiva, com
 * custo que cabe no máximo do recurso. Já com a força (vem do `lerDano`).
 * "Lê na hora" com a primeira arma entra com o número dela. `null` = nenhum
 * golpe com número.
 */
export function melhorGolpe(personagem: Personagem, sistema: SistemaDeRpg): GolpeDaFicha | null {
  let melhor: GolpeDaFicha | null = null
  let maior = -Infinity
  for (const golpe of golpesDaFicha(personagem, sistema)) {
    if (golpe.valor === null || golpe.valor <= maior) continue
    const cartao = golpe.cartao
    if (cartao !== null) {
      if (ehOverload(cartao) || lerAcao(cartao.campos[CAMPO_DA_ACAO] ?? '').acao === 'passiva') continue
      if (!pagaOCusto(cartao, personagem, sistema)) continue
    }
    melhor = golpe
    maior = golpe.valor
  }
  return melhor
}

/** A coluna do Comparar: recursos (HP com a força), atributos com rank e cada golpe com o dano que a fórmula dá agora. */
export function colunaDaComparacao(personagem: Personagem, sistema: SistemaDeRpg): ColunaDaComparacao {
  return {
    personagemId: personagem.id,
    nome: personagem.nome,
    tipo: personagem.tipo,
    forca: forcaDe(personagem),
    hp: atualEMaximo(personagem, recursoDeVida(sistema)),
    sp: atualEMaximo(personagem, recursoDoCusto(sistema, 'sp')),
    escudo: escudoDe(personagem, sistema),
    atributos: sistema.atributos.map((atributo) => {
      const valor = valorDoRank(personagem, atributo.id)
      const rank = rankDoValor(atributo.rank, valor)
      return { id: atributo.id, nome: atributo.nome, abreviacao: atributo.abreviacao, valor, rank: rank === null ? null : rotuloDoRank(rank) }
    }),
    golpes: golpesDaFicha(personagem, sistema),
  }
}

/** O veredito de uma razão pelas faixas. `Infinity` (o grupo nunca derruba) = Mortal; NaN ou negativa não é veredito. */
export function pesoDaRazao(razao: number): PesoDoEncontro | null {
  if (Number.isNaN(razao) || razao < 0) return null
  if (razao <= TETO_DO_PESO.facil) return 'facil'
  if (razao <= TETO_DO_PESO.justo) return 'justo'
  if (razao <= TETO_DO_PESO.duro) return 'duro'
  return 'mortal'
}

/** A quantidade válida de um inimigo: inteiro de 1 para cima; o resto é 0 (não entra). */
function quantidade(n: number): number {
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 0
}

/**
 * O peso do encontro: vida = HP máximo + Escudo; dano por rodada = melhor
 * golpe x `FATOR_DA_REACAO`; razão = rodadas do grupo / rodadas dos inimigos;
 * veredito pelas faixas de `TETO_DO_PESO`. Id que não está em `personagens`
 * é ignorado; quantidade abaixo de 1 não conta.
 */
export function pesoDoEncontro(
  grupo: readonly string[],
  inimigos: Readonly<Record<string, number>>,
  personagens: readonly Personagem[],
  sistema: SistemaDeRpg,
): ResultadoDoEncontro {
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const vidaDoHp = recursoDeVida(sistema)
  const golpes = new Map<string, number | null>()
  const danoDe = (personagem: Personagem): number | null => {
    if (!golpes.has(personagem.id)) golpes.set(personagem.id, melhorGolpe(personagem, sistema)?.valor ?? null)
    return golpes.get(personagem.id) ?? null
  }
  const vidaDe = (personagem: Personagem): number => (vidaDoHp === null ? 0 : maximoComposto(personagem, vidaDoHp.id).total) + (escudoDe(personagem, sistema) ?? 0)

  const doGrupo = [...new Set(grupo)].flatMap((id) => porId.get(id) ?? [])
  const dosInimigos = Object.entries(inimigos).flatMap(([id, n]) => {
    const personagem = porId.get(id)
    return personagem === undefined ? [] : Array.from({ length: quantidade(n) }, () => personagem)
  })

  const somar = (lista: readonly Personagem[]) => ({
    vida: lista.reduce((soma, personagem) => soma + vidaDe(personagem), 0),
    dano: lista.reduce((soma, personagem) => soma + (danoDe(personagem) ?? 0) * FATOR_DA_REACAO, 0),
  })
  const g = somar(doGrupo)
  const i = somar(dosInimigos)
  const rodadasDoGrupo = g.dano > 0 ? i.vida / g.dano : Infinity
  const rodadasDosInimigos = i.dano > 0 ? g.vida / i.dano : Infinity
  const temOsDois = doGrupo.length > 0 && dosInimigos.length > 0
  const razao = !temOsDois || rodadasDosInimigos === Infinity ? 0 : rodadasDoGrupo / rodadasDosInimigos

  const semGolpe = [...new Set([...doGrupo, ...dosInimigos].filter((personagem) => danoDe(personagem) === null).map((personagem) => personagem.id))]
  return {
    grupo: { vida: g.vida, danoPorRodada: g.dano, rodadasParaDerrubar: rodadasDoGrupo },
    inimigos: { vida: i.vida, danoPorRodada: i.dano, rodadasParaDerrubar: rodadasDosInimigos },
    razao,
    peso: temOsDois ? pesoDaRazao(razao) : null,
    semGolpe,
  }
}

/**
 * A força que leva a razão de agora ao alvo: força x raiz(alvo / razão) —
 * raiz porque a força mexe no HP e no dano ao mesmo tempo. Arredondada ao
 * passo (0,05) e presa em `FORCA_MIN`..`FORCA_MAX` (`forcaNoPasso`). Razão 0
 * ou não finita: não há para onde ir, devolve a força de agora.
 */
export function forcaParaOPeso(forca: number, alvo: AlvoDoPeso, razao: number): number {
  if (!Number.isFinite(razao) || razao <= 0) return forca
  return forcaNoPasso(forca * Math.sqrt(ALVO_DO_PESO[alvo] / razao))
}

/**
 * "Deixar Fácil / Justo / Duro": a força nova de cada NPC entre os inimigos
 * (jogador na lista de inimigos não muda), pela razão do encontro de agora.
 * A tela grava com `trocarForca` (lib/livros/combate.ts) pelo `mundo.mudar`,
 * e o Desfazer volta `antes`.
 */
export function ajusteDoPeso(
  grupo: readonly string[],
  inimigos: Readonly<Record<string, number>>,
  personagens: readonly Personagem[],
  sistema: SistemaDeRpg,
  alvo: AlvoDoPeso,
): AjusteDoPeso {
  const agora = pesoDoEncontro(grupo, inimigos, personagens, sistema)
  const forcas: Record<string, number> = {}
  const antes: Record<string, number> = {}
  if (agora.peso === null) return { forcas, antes, pesoDepois: null, noLimite: false }
  for (const [id, n] of Object.entries(inimigos)) {
    const personagem = personagens.find((candidato) => candidato.id === id)
    if (personagem === undefined || personagem.tipo !== 'npc' || quantidade(n) === 0) continue
    const atual = forcaDe(personagem)
    antes[id] = atual
    forcas[id] = forcaParaOPeso(atual, alvo, agora.razao)
  }
  const ajustados = personagens.map((personagem) => (personagem.id in forcas ? trocarForca(personagem, forcas[personagem.id]) : personagem))
  const pesoDepois = pesoDoEncontro(grupo, inimigos, ajustados, sistema).peso
  const noLimite = pesoDepois !== alvo && Object.values(forcas).some(forcaNoLimite)
  return { forcas, antes, pesoDepois, noLimite }
}

/** A força bateu numa ponta da faixa? (o aviso do "Deixar ...") */
export function forcaNoLimite(forca: number): boolean {
  return forca <= FORCA_MIN || forca >= FORCA_MAX
}
