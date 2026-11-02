import { RACAS } from '../../../lib/dbt/dados/racas'
import { RANKS_DE_TECNICA } from '../../../lib/dbt/dados/ranks'
import { ROTULOS } from '../../../lib/dbt/dados/rotulos'
import { VIDA_POR_GOLPE } from '../../../lib/dbt/dados/tabelas'
import {
  fichaDBTVazia,
  LIMITES_DBT,
  type CategoriaDeNpcDBT,
  type FichaDBT,
  type NpcDaFichaDBT,
  type NpcProntoDBT,
  type RacaDBT,
  type RankDBT,
  type RotuloDBT,
  type RotuloEscolhidoDBT,
  type TecnicaProntaDBT,
} from '../../../lib/dbt/modelo'
import { fichaDepoisDoDescanso } from '../../../lib/dbt/batalha/leitura'
import { modificadorDoAtributo } from '../../../lib/dbt/regras/atributos'
import { distribuicaoDoAtaque } from '../../../lib/dbt/regras/dano'
import { derivadosDaFicha, NOME_DA_CATEGORIA, pkMaximo, pvMaximo, type DerivadosDaFichaDBT } from '../../../lib/dbt/regras/ficha'
import { ameacaPelaEscala, fichaDeNpcEmBranco, npcProntoParaFicha, type AmeacaDBT } from '../../../lib/dbt/regras/npc'
import { catalogoDeRotulos, indexarRanks, montarTecnica, nomeNormalizado, type TabelaDeRanksDBT, type TecnicaMontadaDBT } from '../../../lib/dbt/regras/tecnicas'
import { FORCA_PADRAO, novoPersonagem, type Personagem } from '../../../lib/personagem'
import type { SistemaDeRpg } from '../../../lib/sistemaDeRpg'

/**
 * CONTAS DO MUNDO DO LIVRO DRAGON BALL (plano docs/planos/sistema-dragon-ball.md,
 * item 9): montar o NPC (em branco ou pronto) como `Personagem`, os derivados
 * de quem está na pasta e o peso de um encontro. Puro; as regras de verdade
 * moram em lib/dbt/regras, aqui só a costura com o mundo.
 */

/** O catálogo do livro não muda com a mesa aberta: monta uma vez. Null = tabela de ranks torta (a tela avisa). */
export const RANKS_DO_LIVRO: TabelaDeRanksDBT | null = indexarRanks(RANKS_DE_TECNICA)
export const ROTULOS_DO_LIVRO: ReadonlyMap<string, RotuloDBT> = catalogoDeRotulos(ROTULOS)
const RACAS_POR_ID: ReadonlyMap<string, RacaDBT> = new Map(RACAS.map((raca) => [raca.id, raca]))

/** "ND 3": o livro dá o exemplo de 3 golpes (Livro do Narrador 4.0.2, p. 18). */
export const ND_SUGERIDO = 3
/** O mesmo teto do leitor da ficha (lib/dbt/modelo.ts). */
export const ND_MAXIMO = 1000
export const EP_MAXIMA = 100

// ───────────────────────────────────────────────────────────────────────────
// Ficha e derivados
// ───────────────────────────────────────────────────────────────────────────

/** A ficha DBT do personagem; sem ela (ficha feita antes do motor), a vazia: os números saem só dos atributos. */
export function fichaDe(personagem: Personagem): FichaDBT {
  return personagem.dbt ?? fichaDBTVazia()
}

export function racaDaFicha(ficha: FichaDBT): RacaDBT | null {
  return ficha.raca === '' ? null : (RACAS_POR_ID.get(ficha.raca) ?? null)
}

export function derivadosDoPersonagem(personagem: Personagem, ficha: FichaDBT, ranks: TabelaDeRanksDBT): DerivadosDaFichaDBT {
  return derivadosDaFicha(ficha, personagem.atributos, { raca: racaDaFicha(ficha), ranks, vidaPorGolpe: VIDA_POR_GOLPE })
}

/** "ND 3 – Rank E (Comum)", a notação do livro (4.0.2); sem ND escolhido, "ND a escolher". */
export function notacaoDoNpc(npc: NpcDaFichaDBT): string {
  return `${npc.nd === null ? 'ND a escolher' : `ND ${npc.nd}`} – Rank ${npc.rank} (${NOME_DA_CATEGORIA[npc.categoria]})`
}

// ───────────────────────────────────────────────────────────────────────────
// Rótulos impressos → catálogo (busca tolerante)
// ───────────────────────────────────────────────────────────────────────────

/**
 * As fichas prontas escrevem o rótulo abreviado ("Estocada" para "Alcance –
 * Estocada") e às vezes com erro ("Contudente", "Aumento de Dano por Ki").
 * Estes são os impressos que nem tirando prefixo e sufixo chegam ao nome do catálogo.
 */
const SINONIMOS: Readonly<Record<string, string>> = {
  'aumento de dano por ki': 'aumentar dano por ki',
  'aumenta dano por ki': 'aumentar dano por ki',
  'adicionar dano por ki': 'aumentar dano por ki',
  contudente: 'contundente',
  'dano contudente': 'dano contundente',
  'dando potente': 'dano potente',
  somatico: 'somatica',
  'queima roupa': 'tecnica a queima roupa',
  condicional: 'condicionada',
  'adicionar ca': 'adicionar classe de armadura',
}

/** Na ordem em que saem do nome: "Dano Elemental – Dano Sombrio" → "dano sombrio" → "sombrio". */
const PREFIXOS = ['dano elemental ', 'alcance ', 'dano de ', 'dano ', 'tecnica de ', 'tecnica ']
const SUFIXO_DE_KI = ' ki'

/** O nome e as formas curtas dele, sem repetir. */
function formasDoNome(normalizado: string): string[] {
  const formas = [normalizado]
  let atual = normalizado
  for (let mudou = true; mudou; ) {
    mudou = false
    for (const prefixo of PREFIXOS) {
      if (atual.startsWith(prefixo) && atual.length > prefixo.length) {
        atual = atual.slice(prefixo.length)
        formas.push(atual)
        mudou = true
        break
      }
    }
  }
  const comSufixo = formas.filter((forma) => forma.endsWith(SUFIXO_DE_KI) && forma.length > SUFIXO_DE_KI.length)
  return [...new Set([...formas, ...comSufixo.map((forma) => forma.slice(0, -SUFIXO_DE_KI.length))])]
}

/** O tipo da técnica já vem por `tipoPelosRotulos`: o rótulo de tipo não entra de novo na lista. */
function ehRotuloDeTipo(rotulo: RotuloDBT): boolean {
  return rotulo.categoria === 'base' && rotulo.alcance === null && nomeNormalizado(rotulo.nome).startsWith('tecnica')
}

interface IndiceDeRotulos {
  exatos: ReadonlyMap<string, RotuloDBT>
  /** Forma curta → rótulo; null = duas formas iguais (ambígua, não liga). */
  curtos: ReadonlyMap<string, RotuloDBT | null>
}

function indexarRotulos(catalogo: ReadonlyMap<string, RotuloDBT>): IndiceDeRotulos {
  const exatos = new Map<string, RotuloDBT>()
  const curtos = new Map<string, RotuloDBT | null>()
  for (const rotulo of catalogo.values()) {
    const [inteiro, ...resto] = formasDoNome(nomeNormalizado(rotulo.nome))
    exatos.set(inteiro, rotulo)
    for (const forma of resto) curtos.set(forma, curtos.has(forma) && curtos.get(forma) !== rotulo ? null : rotulo)
  }
  return { exatos, curtos }
}

const INDICE_DO_LIVRO = indexarRotulos(ROTULOS_DO_LIVRO)

/** "Adicionar Condição (Cego)" e "Efeito Negativo – Atordoar": o rótulo Efeito Negativo, com a condição na nota. */
const CONDICAO_IMPRESSA = /^\s*(adicionar condi[cç][aã]o|efeito negativo)\s*[(–-]\s*([^)]*?)\s*\)?\s*$/i

/** O rótulo do catálogo para o nome impresso; null = não achou com segurança (o nome fica só na descrição). */
export function rotuloPeloNomeImpresso(impresso: string, indice: IndiceDeRotulos = INDICE_DO_LIVRO): { rotulo: RotuloDBT; nota: string } | null {
  const condicao = CONDICAO_IMPRESSA.exec(impresso)
  if (condicao !== null) {
    const efeito = indice.exatos.get('efeito negativo')
    return efeito === undefined ? null : { rotulo: efeito, nota: condicao[2] }
  }
  const normalizado = nomeNormalizado(impresso)
  const procurado = SINONIMOS[normalizado] ?? normalizado
  for (const forma of formasDoNome(procurado)) {
    const exato = indice.exatos.get(forma)
    if (exato !== undefined) return { rotulo: exato, nota: '' }
    const curto = indice.curtos.get(forma)
    if (curto !== undefined) return curto === null ? null : { rotulo: curto, nota: '' }
  }
  return null
}

/** Os rótulos impressos da técnica pronta que o catálogo reconhece, positivos e negativos, sem o de tipo. */
export function rotulosDaPronta(tecnica: TecnicaProntaDBT): RotuloEscolhidoDBT[] {
  const escolhidos: RotuloEscolhidoDBT[] = []
  for (const nome of [...tecnica.rotulosPositivos.nomes, ...tecnica.rotulosNegativos.nomes]) {
    const achado = rotuloPeloNomeImpresso(nome)
    if (achado === null || ehRotuloDeTipo(achado.rotulo)) continue
    // Valor de rótulo variável fica em aberto (null): a ficha pede a escolha em vez de o app inventar um número.
    escolhidos.push({ rotuloId: achado.rotulo.id, pontosExtras: 0, variavel: null, investimento: 0, nota: achado.nota.slice(0, LIMITES_DBT.textoCurto) })
  }
  return escolhidos.slice(0, LIMITES_DBT.rotulosPorTecnica)
}

// ───────────────────────────────────────────────────────────────────────────
// NPC novo como Personagem
// ───────────────────────────────────────────────────────────────────────────

/** NPC do livro pronto: a ficha convertida (com os rótulos ligados ao catálogo), atributos e PV/PK cheios. */
export function personagemDoNpcPronto(sistema: SistemaDeRpg, npc: NpcProntoDBT, nd: number | null, nome: string): Personagem {
  const convertido = npcProntoParaFicha(npc, { nd, vidaPorGolpe: VIDA_POR_GOLPE })
  // A conversão mantém a ordem (só corta no teto): a técnica i saiu da pronta i.
  const tecnicas = convertido.ficha.tecnicas.map((tecnica, i) => {
    const pronta = npc.tecnicas[i]
    return pronta === undefined ? tecnica : { ...tecnica, rotulos: rotulosDaPronta(pronta) }
  })
  const base = novoPersonagem(sistema, 'npc', nome)
  return {
    ...base,
    atributos: { ...convertido.atributos },
    recursos: { ...base.recursos, ...convertido.recursos },
    maximos: { ...convertido.maximos },
    dbt: { ...convertido.ficha, tecnicas },
    combate: { forca: FORCA_PADRAO },
  }
}

export interface NpcEmBranco {
  categoria: CategoriaDeNpcDBT
  rank: RankDBT
  nd: number | null
  ep: number
}

/** NPC do zero: atributos 8 (os da ficha nova), o bloco de NPC e PV/PK já calculados. */
export function personagemDeNpcEmBranco(sistema: SistemaDeRpg, nome: string, { categoria, rank, nd, ep }: NpcEmBranco): Personagem {
  const base = novoPersonagem(sistema, 'npc', nome)
  const ficha: FichaDBT = { ...fichaDeNpcEmBranco(categoria, rank, nd), epInicial: ep }
  const pv = pvMaximo(ficha, base.atributos, null, VIDA_POR_GOLPE).valor
  const pk = pkMaximo(ficha, base.atributos).valor
  return { ...base, recursos: { ...base.recursos, pv, pk }, maximos: { pv, pk }, dbt: ficha, combate: { forca: FORCA_PADRAO } }
}

/**
 * A variação nasce inteira, como depois de um Descanso Longo: PV e PK atuais
 * nos máximos que veio do modelo, sem o desgaste dele (Ki bloqueado e os
 * contadores, `fichaDepoisDoDescanso`) e na forma normal (o modelo podia
 * estar transformado).
 */
export function variacaoInteira(variacao: Personagem): Personagem {
  const inteira: Personagem = { ...variacao, recursos: { ...variacao.recursos, ...variacao.maximos } }
  if (variacao.dbt === undefined) return inteira
  const descansada = fichaDepoisDoDescanso(variacao.dbt)
  return { ...inteira, dbt: descansada.transformacaoAtiva === null ? descansada : { ...descansada, transformacaoAtiva: null } }
}

// ───────────────────────────────────────────────────────────────────────────
// Peso do encontro (grupo x inimigos)
// ───────────────────────────────────────────────────────────────────────────

interface Lutador {
  id: string
  pv: number
  epTotal: number
  ca: number
  golpes: { montada: TecnicaMontadaDBT; modificador: number }[]
}

/** Como o Comparar (lib/dbt/regras/comparar.ts): técnicas de dano prontas para uso; no NPC, todas. */
function lutador(personagem: Personagem, ranks: TabelaDeRanksDBT): Lutador {
  const ficha = fichaDe(personagem)
  const derivados = derivadosDoPersonagem(personagem, ficha, ranks)
  const ehNpc = ficha.npc !== undefined
  const golpes = ficha.tecnicas
    .filter((tecnica) => (ehNpc || tecnica.ativa) && tecnica.efeitoDaFaixa === 'dano')
    .map((tecnica) => ({ montada: montarTecnica(tecnica, { rank: ranks[tecnica.rank], rotulos: ROTULOS_DO_LIVRO }), modificador: modificadorDoAtributo(personagem.atributos, tecnica.atributo) }))
    .filter(({ montada }) => montada.faixa.completo > 0)
  return { id: personagem.id, pv: derivados.pvMax.valor, epTotal: derivados.epTotal.valor, ca: derivados.ca.valor, golpes }
}

/** O dano esperado da melhor técnica de A contra B (d20 inteiro, crítico dobrado, faixa pela diferença de EP). */
function melhorDanoContra(a: Lutador, b: Lutador): number {
  let melhor = 0
  for (const golpe of a.golpes) {
    const { danoEsperado } = distribuicaoDoAtaque({
      modificador: golpe.modificador,
      extras: golpe.montada.acertoExtra,
      epAtacante: a.epTotal,
      epAlvo: b.epTotal,
      caDoAlvo: b.ca,
      faixa: golpe.montada.faixa,
    })
    if (danoEsperado > melhor) melhor = danoEsperado
  }
  return melhor
}

export interface LadoDoEncontroDBT {
  vida: number
  /** Soma do melhor dano esperado de cada um, na média dos alvos do outro lado. */
  danoPorRodada: number
  /** Rodadas para este lado derrubar o outro; Infinity = nunca. */
  rodadasParaDerrubar: number
  /** Quem não tem técnica de dano pronta para uso. */
  semGolpe: string[]
}

export interface EncontroDBT {
  grupo: LadoDoEncontroDBT
  inimigos: LadoDoEncontroDBT
  /** EP média do grupo, arredondada para baixo (a régua do livro é por EP). */
  epDoGrupo: number
  /** O inimigo de EP mais alta e o peso que o livro dá a ele (4.0.3); null sem grupo ou sem inimigo. */
  ameaca: { personagemId: string; ep: number; nivel: AmeacaDBT } | null
}

function lado(atacantes: readonly Lutador[], alvos: readonly Lutador[], nomes: ReadonlyMap<string, string>): Omit<LadoDoEncontroDBT, 'rodadasParaDerrubar'> {
  let danoPorRodada = 0
  const semGolpe = new Set<string>()
  for (const atacante of atacantes) {
    if (atacante.golpes.length === 0) semGolpe.add(nomes.get(atacante.id) ?? atacante.id)
    if (alvos.length === 0) continue
    danoPorRodada += alvos.reduce((soma, alvo) => soma + melhorDanoContra(atacante, alvo), 0) / alvos.length
  }
  return { vida: atacantes.reduce((soma, um) => soma + um.pv, 0), danoPorRodada, semGolpe: [...semGolpe] }
}

const rodadas = (vida: number, dano: number): number => (dano > 0 ? vida / dano : Infinity)

/**
 * Estimativa simples do encontro: cada um usa todo turno a melhor técnica de
 * dano (sem contar Ki, reação nem cura) contra um alvo médio do outro lado.
 * Ids que sumiram da pasta são ignorados.
 */
export function pesoDoEncontroDBT(
  grupoIds: readonly string[],
  inimigos: Readonly<Record<string, number>>,
  personagens: readonly Personagem[],
  ranks: TabelaDeRanksDBT,
): EncontroDBT {
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const nomes = new Map(personagens.map((personagem) => [personagem.id, personagem.nome]))
  const preparados = new Map<string, Lutador>()
  const preparar = (id: string): Lutador | null => {
    const personagem = porId.get(id)
    if (personagem === undefined) return null
    const pronto = preparados.get(id) ?? lutador(personagem, ranks)
    preparados.set(id, pronto)
    return pronto
  }
  const grupo = grupoIds.flatMap((id) => preparar(id) ?? [])
  const doOutroLado = Object.entries(inimigos).flatMap(([id, quantos]) => {
    const um = preparar(id)
    return um === null ? [] : Array.from({ length: Math.max(0, quantos) }, () => um)
  })
  const ladoDoGrupo = lado(grupo, doOutroLado, nomes)
  const ladoDosInimigos = lado(doOutroLado, grupo, nomes)
  const epDoGrupo = grupo.length === 0 ? 0 : Math.floor(grupo.reduce((soma, um) => soma + um.epTotal, 0) / grupo.length)
  const maisForte = doOutroLado.reduce<Lutador | null>((atual, um) => (atual === null || um.epTotal > atual.epTotal ? um : atual), null)
  return {
    grupo: { ...ladoDoGrupo, rodadasParaDerrubar: rodadas(ladoDosInimigos.vida, ladoDoGrupo.danoPorRodada) },
    inimigos: { ...ladoDosInimigos, rodadasParaDerrubar: rodadas(ladoDoGrupo.vida, ladoDosInimigos.danoPorRodada) },
    epDoGrupo,
    ameaca: maisForte === null || grupo.length === 0 ? null : { personagemId: maisForte.id, ep: maisForte.epTotal, nivel: ameacaPelaEscala(maisForte.epTotal, epDoGrupo) },
  }
}
