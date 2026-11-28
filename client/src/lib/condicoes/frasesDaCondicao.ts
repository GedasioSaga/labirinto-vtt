import { textoDaExcecao } from '../batalha/anulaODano'
import { nomeDoAtributoDaPeca } from '../batalha/mecanica/pecas'
import type { PecaDoGatilho } from '../itens/modelo'
import { ehDaFabrica, ehDeHoje, LISTA_DA_FABRICA } from './fabrica'
import {
  A_PARTIR_DO_TURNO_PADRAO,
  ATRIBUTOS_DA_CONDICAO_MAX,
  AURA_DESTA_MESMA,
  BLOQUEIOS_DA_CONDICAO,
  chaveDaCondicao,
  NOMES_DOS_TIPOS_DE_DANO,
  PECAS_DA_CONDICAO_MAX,
  SAIDAS_DA_CONDICAO_MAX,
  TETO_DE_PILHAS_PADRAO,
  turnosDoPrazo,
  type BloqueioDaCondicao,
  type CondicaoMontada,
  type FamiliaDaPecaDaCondicao,
  type PecaDaCondicao,
  type PecaDaCondicaoDa,
  type PrazoDaCondicao,
  type SaidaDaCondicao,
  type TipoDeDano,
} from './modelo'

/**
 * O CARTÃO SE ESCREVE SOZINHO (rework das condições, PLANO.md §2, E1; `frasePeca`, `fraseSaida`,
 * `frasePrazo`, `quemApaga`, `quemCita`, `frasesDe`, `naBatalha` e `avisosDe` do protótipo,
 * prototipo.html:713-856). Tudo o que se lê de uma condição sai das peças, do prazo e das saídas: nada
 * é digitado nem guardado duas vezes.
 *
 * A frase sai em PEDAÇOS (`PedacoDaFrase`), não em HTML: a tela pinta cada pedaço pela `tinta` (dano,
 * cura, gasto, o nome de outra condição) com o próprio componente, sem `innerHTML`; `textoDaFrase` dá o
 * texto corrido (o leitor de tela, a frase curta dos seletores, o título da técnica).
 *
 * Os nomes das condições que uma peça cita (a Aura, a Contra-condição) vêm do catálogo do `contexto`
 * (as de fábrica e as criadas, já montadas); sem ele, só as de fábrica.
 *
 * Puro: sem store, sem Tauri, sem DOM.
 *
 * API pública (estável para E4, E6 e E7): `TintaDaFrase`, `PedacoDaFrase`, `FraseDaCondicao`,
 * `ContextoDasFrases`, `LinhaDoCartao`, `AvisoDaCondicao`, `CitacaoDaCondicao`, `FRASE_DO_BLOQUEIO`,
 * `textoDaFrase`, `frasePeca`, `fraseSaida`, `frasePrazo`, `prazoCurto`, `quemApaga`, `quemCita`,
 * `frasesDoCartao`, `fraseCurta`, `naBatalha`, `avisosDe`, `temAvisoQueImpede`.
 */

/** A cor de um pedaço: o que tira (dano), o que dá (cura), o que se paga ou prende (gasto), o nome de outra condição (selo). */
export type TintaDaFrase = 'dano' | 'cura' | 'gasto' | 'selo'

/** Um pedaço da frase; sem `tinta` = o texto corrido. */
export interface PedacoDaFrase {
  readonly texto: string
  readonly tinta?: TintaDaFrase
}

export type FraseDaCondicao = readonly PedacoDaFrase[]

/** O catálogo em volta: as condições (de fábrica e criadas, montadas) que dão os nomes e o "quem apaga". Ausente = as 35 de fábrica. */
export interface ContextoDasFrases {
  todas?: readonly CondicaoMontada[]
}

/** O que quem está com o bloqueio não pode fazer, na frase (`FRASE_DO_BLOQUEIO` do protótipo). */
export const FRASE_DO_BLOQUEIO: Readonly<Record<BloqueioDaCondicao, string>> = {
  perdeVez: 'perde a vez',
  naoReage: 'não pode reagir',
  reageDesv: 'reage com desvantagem',
  naoDesvia: 'não pode desviar',
  naoMove: 'não pode se mover',
  naoTecnica: 'não pode usar técnica',
  soSimples: 'só usa ação simples',
  naoAlvo: 'não pode ser alvo de golpe',
}

const SEM_NOME = 'condição apagada'
/** O "metade da cura" da frase (o −50% da Cura reduzida). */
const METADE = -50
/** "O que aparece na batalha" mostra no máximo estas linhas. */
const NA_BATALHA_MAX = 4

// ─── Pedaços ───────────────────────────────────────────────────────────────

function corrido(texto: string): PedacoDaFrase {
  return { texto }
}

function pintado(texto: string, tinta: TintaDaFrase): PedacoDaFrase {
  return { texto, tinta }
}

/** O texto corrido da frase (sem as cores). */
export function textoDaFrase(frase: FraseDaCondicao): string {
  return frase.map((pedaco) => pedaco.texto).join('')
}

const plural = (n: number, um: string, varios: string): string => (Math.abs(n) === 1 ? um : varios)

/** "+25", "−20", "0" (o menos tipográfico, como no protótipo). */
const sinal = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0')

const deTipo = (tipo: TipoDeDano | undefined): string => (tipo === undefined || tipo === 'qualquer' ? '' : ` de ${NOMES_DOS_TIPOS_DE_DANO[tipo]}`)

/** "a, b e c" com as frases. */
function juntar(lista: readonly FraseDaCondicao[], e = 'e'): PedacoDaFrase[] {
  const cheias = lista.filter((frase) => frase.length > 0)
  const juntas: PedacoDaFrase[] = []
  cheias.forEach((frase, indice) => {
    if (indice > 0) juntas.push(corrido(indice === cheias.length - 1 ? ` ${e} ` : ', '))
    juntas.push(...frase)
  })
  return juntas
}

/** A frase com a 1ª letra maiúscula. */
function comMaiuscula(frase: readonly PedacoDaFrase[]): PedacoDaFrase[] {
  const [primeiro, ...resto] = frase
  if (primeiro === undefined || primeiro.texto === '') return [...frase]
  const texto = `${primeiro.texto.charAt(0).toLocaleUpperCase('pt-BR')}${primeiro.texto.slice(1)}`
  return [primeiro.tinta === undefined ? corrido(texto) : pintado(texto, primeiro.tinta), ...resto]
}

function nomeDaCondicao(id: string, contexto: ContextoDasFrases): string {
  return (contexto.todas ?? LISTA_DA_FABRICA).find((condicao) => condicao.id === id)?.nome ?? LISTA_DA_FABRICA.find((condicao) => condicao.id === id)?.nome ?? SEM_NOME
}

const temPilha = (condicao: Pick<CondicaoMontada, 'prazo'>): boolean => condicao.prazo.deNovo === 'pilha'

// ─── As peças ──────────────────────────────────────────────────────────────

const FRASE_DO_QUANDO: Readonly<Record<PecaDaCondicaoDa<'vez'>['quando'], string>> = { entrar: 'Ao entrar', comeco: 'No começo de cada vez dele', fim: 'No fim de cada vez dele' }
const NOME_DO_RECURSO: Readonly<Record<PecaDaCondicaoDa<'vez'>['recurso'], string>> = { vida: 'vida', sp: 'SP', escudo: 'Escudo' }
/** O "da vida máxima", o "do SP máximo": a vida é feminina; o SP e o Escudo, masculinos. */
const DO_RECURSO: Readonly<Record<PecaDaCondicaoDa<'vez'>['recurso'], { de: string; maxima: string; atual: string }>> = {
  vida: { de: 'da vida', maxima: 'máxima', atual: 'atual' },
  sp: { de: 'do SP', maxima: 'máximo', atual: 'atual' },
  escudo: { de: 'do Escudo', maxima: 'máximo', atual: 'atual' },
}

function fraseDaVez(peca: PecaDaCondicaoDa<'vez'>, pilha: string): PedacoDaFrase[] {
  const doRecurso = DO_RECURSO[peca.recurso]
  const quanto = peca.conta === 'fixo' ? `${peca.v} de ${NOME_DO_RECURSO[peca.recurso]}` : `${peca.v}% ${doRecurso.de} ${peca.conta === 'pctMax' ? doRecurso.maxima : doRecurso.atual}`
  const tinta: TintaDaFrase = peca.faz === 'tira' ? (peca.recurso === 'vida' ? 'dano' : 'gasto') : 'cura'
  const extra: string[] = []
  if (peca.faz === 'tira' && peca.recurso === 'vida' && peca.direto === true) extra.push('direto na vida, passando do Escudo')
  if (peca.faz === 'tira' && peca.rouba === true && peca.recurso !== 'escudo') extra.push('e quem pôs a condição ganha o mesmo')
  return [
    corrido(`${FRASE_DO_QUANDO[peca.quando]}, ${peca.faz === 'tira' ? 'perde' : 'ganha'} `),
    pintado(quanto, tinta),
    corrido(`${pilha}${extra.length > 0 ? `, ${extra.join(', ')}` : ''}.`),
  ]
}

function fraseDoAtributo(peca: PecaDaCondicaoDa<'atributo'>, pilha: string): PedacoDaFrase[] {
  const atributo = nomeDoAtributoDaPeca(peca.atr)
  if (peca.faz === 'fica') return [corrido(`${atributo} fica em `), pintado(String(peca.v), 'gasto'), corrido(' enquanto durar.')]
  if (peca.faz === 'maximo') return [corrido(`${atributo} fica no máximo em `), pintado(String(peca.v), 'gasto'), corrido(' enquanto durar.')]
  const menos = peca.faz === 'tira'
  const porcento = peca.conta === 'pct' ? '%' : ''
  const numero = pintado(`${menos ? '−' : '+'}${peca.v}${porcento} de ${atributo}`, menos ? 'dano' : 'cura')
  const teto = peca.tetoN === undefined ? '' : `, até ${menos ? '−' : '+'}${peca.tetoN}${porcento} no total`
  if (peca.ritmo === 'cada') return [numero, corrido(` a cada turno, somando${teto}${pilha}.`)]
  if (peca.ritmo === 'aPartir') return [corrido(`A partir do turno ${peca.aPartirN ?? A_PARTIR_DO_TURNO_PADRAO}, `), numero, corrido(` a cada turno, somando${teto}${pilha}.`)]
  return [numero, corrido(` enquanto durar${pilha}.`)]
}

function fraseDoBloqueio(peca: PecaDaCondicaoDa<'bloqueio'>): PedacoDaFrase[] {
  const ligados = BLOQUEIOS_DA_CONDICAO.filter((bloqueio) => peca.itens[bloqueio] === true).map((bloqueio) => [corrido(FRASE_DO_BLOQUEIO[bloqueio])])
  return ligados.length > 0 ? [...comMaiuscula(juntar(ligados)), corrido('.')] : [corrido('Bloqueio sem nada marcado: não impede nada.')]
}

function fraseDoDanoCura(peca: PecaDaCondicaoDa<'danoCura'>): PedacoDaFrase[] {
  const partes: FraseDaCondicao[] = []
  if (peca.recV !== undefined) partes.push([corrido('toma '), pintado(`${sinal(peca.recV)}% de dano${deTipo(peca.recTipo)}`, peca.recV > 0 ? 'dano' : 'cura')])
  if (peca.cauV !== undefined) partes.push([corrido('causa '), pintado(`${sinal(peca.cauV)}% de dano`, peca.cauV < 0 ? 'dano' : 'cura')])
  if (peca.curaV !== undefined) partes.push([corrido('recebe '), pintado(peca.curaV === METADE ? 'metade da cura' : `${sinal(peca.curaV)}% de cura`, peca.curaV < 0 ? 'dano' : 'cura')])
  if (peca.cddV !== undefined) partes.push([corrido('recupera '), pintado(`${peca.cddV}% do dano que causa`, 'cura'), corrido(', em vida')])
  return partes.length > 0 ? [...comMaiuscula(juntar(partes)), corrido('.')] : [corrido('Dano e cura sem nada marcado: não muda nada.')]
}

function fraseDoEfeitoDoGatilho(efeito: PecaDoGatilho): FraseDaCondicao {
  switch (efeito.tipo) {
    case 'dano':
      return [corrido('toma '), pintado(`${efeito.valor} de dano`, 'dano')]
    case 'curar':
      return [corrido('recupera '), pintado(`${efeito.fixo} de vida`, 'cura')]
    case 'condicao':
      return [corrido('fica '), pintado(efeito.nome, 'selo'), corrido(efeito.duracao === 'fim' ? ' até o fim da batalha' : ` por ${efeito.duracao} ${plural(efeito.duracao, 'turno', 'turnos')}`)]
    case 'tirar':
      return efeito.nome === null ? [corrido('perde as condições negativas')] : [corrido('perde '), pintado(efeito.nome, 'selo')]
  }
}

function fraseDoGatilho(peca: PecaDaCondicaoDa<'gatilho'>): PedacoDaFrase[] {
  const { turnos, vezes, aoDisparar, pecas } = peca.gatilho
  const efeitos = pecas.map(fraseDoEfeitoDoGatilho)
  return [
    corrido(`Depois de ${turnos} ${plural(turnos, 'turno', 'turnos')}${vezes === 'cada' ? ` (e a cada ${turnos})` : ''}: `),
    ...(efeitos.length > 0 ? juntar(efeitos) : [corrido('nada')]),
    corrido(`${aoDisparar === 'some' ? '; e esta condição some' : ''}.`),
  ]
}

function fraseDaMarca(peca: PecaDaCondicaoDa<'marca'>): PedacoDaFrase[] {
  return [
    corrido('O próximo golpe nele dá '),
    pintado(`${peca.mult}× o dano`, 'dano'),
    corrido(`${peca.quem === 'quemPos' ? ', só para quem pôs' : ''}${peca.sai ? '; a marca sai com esse golpe' : ''}${peca.desvDesv ? '. Desvia com desvantagem' : ''}.`),
  ]
}

const FRASE_DE_QUEM_PEGA: Readonly<Record<PecaDaCondicaoDa<'aura'>['quem'], string>> = { aliados: 'Os aliados dele', inimigos: 'Os inimigos dele', todos: 'Todos' }

function fraseDaAura(peca: PecaDaCondicaoDa<'aura'>, contexto: ContextoDasFrases): PedacoDaFrase[] {
  const pega: PedacoDaFrase[] =
    peca.cond === AURA_DESTA_MESMA ? [corrido(`pegam esta mesma condição${peca.espalha === true ? ' e passam adiante' : ', sem passar adiante'}`)] : [corrido('ficam '), pintado(nomeDaCondicao(peca.cond, contexto), 'selo')]
  return [corrido(`${FRASE_DE_QUEM_PEGA[peca.quem]} a até ${peca.casas} ${plural(peca.casas, 'casa', 'casas')} `), ...pega, corrido(', enquanto estiverem perto.')]
}

function fraseDaContra(peca: PecaDaCondicaoDa<'contra'>, contexto: ContextoDasFrases): PedacoDaFrase[] {
  if (peca.apaga.length === 0) return [corrido('Contra-condição sem condição escolhida: não apaga nada.')]
  const nomes = juntar(peca.apaga.map((id) => [pintado(nomeDaCondicao(id, contexto), 'selo')]))
  return [corrido('Ao entrar, apaga '), ...nomes, corrido(`${peca.impede ? `; enquanto durar, ${peca.apaga.length > 1 ? 'elas não pegam' : 'ela não pega'} nele` : ''}.`)]
}

/** A Intangível (pedido de 27/11/2026): "Toma 0 de dano dos golpes, a não ser que o golpe tenha Haki." (a exceção de `anulaODano.ts`). */
function fraseDoAnula(peca: PecaDaCondicaoDa<'anula'>): PedacoDaFrase[] {
  const exceto = textoDaExcecao(peca.exceto)
  return [corrido('Toma '), pintado('0 de dano', 'dano'), corrido(` dos golpes${exceto === '' ? '' : `, ${exceto}`}.`)]
}

/** A frase de uma peça no cartão (o "(vezes as pilhas)" quando a condição soma pilhas). */
export function frasePeca(peca: PecaDaCondicao, condicao: Pick<CondicaoMontada, 'prazo'>, contexto: ContextoDasFrases = {}): FraseDaCondicao {
  const pilha = temPilha(condicao) && (peca.tipo === 'vez' || peca.tipo === 'atributo') ? ' (vezes as pilhas)' : ''
  switch (peca.tipo) {
    case 'vez':
      return fraseDaVez(peca, pilha)
    case 'atributo':
      return fraseDoAtributo(peca, pilha)
    case 'bloqueio':
      return fraseDoBloqueio(peca)
    case 'danoCura':
      return fraseDoDanoCura(peca)
    case 'gatilho':
      return fraseDoGatilho(peca)
    case 'marca':
      return fraseDaMarca(peca)
    case 'aura':
      return fraseDaAura(peca, contexto)
    case 'contra':
      return fraseDaContra(peca, contexto)
    case 'anula':
      return fraseDoAnula(peca)
  }
}

// ─── Saídas e prazo ────────────────────────────────────────────────────────

function textoDoTeste(atributo: string | undefined, cd: number | undefined): string {
  return atributo === undefined || cd === undefined ? 'um teste' : `um teste de ${nomeDoAtributoDaPeca(atributo)} (CD ${cd})`
}

/** A frase de uma saída. */
export function fraseSaida(saida: SaidaDaCondicao): FraseDaCondicao {
  switch (saida.tipo) {
    case 'teste':
      return [corrido(`Sai se passar em ${textoDoTeste(saida.atr, saida.cd)}, no fim de cada vez dele.`)]
    case 'pagar': {
      const paga = saida.paga === 'acao' ? 'a ação simples' : `${saida.v ?? 0} de ${saida.paga === 'sp' ? 'SP' : 'vida'}`
      if (saida.como === 'pagar') return [corrido('Na vez dele, sai pagando '), pintado(paga, 'gasto'), corrido('.')]
      if (saida.como === 'teste') return [corrido(`Na vez dele, pode tentar sair com ${textoDoTeste(saida.atr, saida.cd)}.`)]
      return [corrido('Na vez dele, sai pagando '), pintado(paga, 'gasto'), corrido(` ${saida.como === 'e' ? 'e' : 'ou'} passando em ${textoDoTeste(saida.atr, saida.cd)}.`)]
    }
    case 'cura':
      return [corrido('Sai ao receber qualquer cura.')]
    case 'dano':
      return [corrido(`Sai ao tomar dano${deTipo(saida.dano)}.`)]
    case 'agir':
      return [corrido('Sai quando ele ataca ou usa técnica.')]
  }
}

function duracaoDoPrazo(prazo: PrazoDaCondicao): string {
  const turnos = turnosDoPrazo(prazo)
  if (turnos !== null) return `Dura ${turnos} ${plural(turnos, 'turno', 'turnos')}`
  if (prazo.modo === 'proximoGolpe') return 'Dura até o próximo golpe nele'
  return prazo.modo === 'ateTirar' ? 'Dura até alguém tirar' : 'Dura até o fim da batalha'
}

/** A frase do prazo e do "se ganhar de novo". */
export function frasePrazo(prazo: PrazoDaCondicao): FraseDaCondicao {
  const deNovo =
    prazo.deNovo === 'pilha'
      ? `se ganhar de novo, soma uma pilha (até ${prazo.teto ?? TETO_DE_PILHAS_PADRAO})`
      : prazo.deNovo === 'renova' && prazo.modo === 'turnos'
        ? 'se ganhar de novo, o prazo recomeça'
        : 'se ganhar de novo, nada muda'
  return [corrido(`${duracaoDoPrazo(prazo)}; ${deNovo}.`)]
}

/** O prazo curto, para a lista e o "fica X (3 turnos)". */
export function prazoCurto(prazo: PrazoDaCondicao): string {
  const turnos = turnosDoPrazo(prazo)
  if (turnos !== null) return `${turnos} ${plural(turnos, 'turno', 'turnos')}`
  if (prazo.modo === 'proximoGolpe') return 'até o próximo golpe'
  return prazo.modo === 'ateTirar' ? 'até tirarem' : 'a batalha toda'
}

// ─── Quem apaga e quem cita ────────────────────────────────────────────────

/** As outras condições que apagam esta (a Contra-condição se escreve uma vez, em quem apaga). */
export function quemApaga(condicao: Pick<CondicaoMontada, 'id'>, contexto: ContextoDasFrases = {}): CondicaoMontada[] {
  return (contexto.todas ?? LISTA_DA_FABRICA).filter((outra) => outra.id !== condicao.id && outra.pecas.some((peca) => peca.tipo === 'contra' && peca.apaga.includes(condicao.id)))
}

/** Uma condição que cita esta, e como: apaga (Contra-condição), põe ou tira pelo gatilho, ou põe pela aura. */
export interface CitacaoDaCondicao {
  condicao: CondicaoMontada
  como: 'apaga' | 'gatilho' | 'aura'
}

/** As outras que citam esta. O gatilho guarda nomes: acha pela chave do nome; a aura e a contra, pelo id. */
export function quemCita(condicao: Pick<CondicaoMontada, 'id' | 'nome'>, contexto: ContextoDasFrases = {}): CitacaoDaCondicao[] {
  const chave = chaveDaCondicao(condicao.nome)
  const citacoes: CitacaoDaCondicao[] = []
  for (const outra of contexto.todas ?? LISTA_DA_FABRICA) {
    if (outra.id === condicao.id) continue
    for (const peca of outra.pecas) {
      if (peca.tipo === 'contra' && peca.apaga.includes(condicao.id)) citacoes.push({ condicao: outra, como: 'apaga' })
      if (peca.tipo === 'aura' && peca.cond === condicao.id) citacoes.push({ condicao: outra, como: 'aura' })
      if (peca.tipo === 'gatilho' && chave !== '' && peca.gatilho.pecas.some((efeito) => (efeito.tipo === 'condicao' || efeito.tipo === 'tirar') && efeito.nome !== null && chaveDaCondicao(efeito.nome) === chave)) {
        citacoes.push({ condicao: outra, como: 'gatilho' })
      }
    }
  }
  return citacoes
}

// ─── O cartão ──────────────────────────────────────────────────────────────

/**
 * Uma linha do cartão e de onde ela vem (a tela leva o clique até a seção): uma peça (`indice` na
 * lista de peças), a falta de peça, o prazo, uma saída (`indice` nas saídas), outra condição que a
 * apaga, ou a regra do mapa (o Lento de sempre anda metade do passo, D11).
 */
export type LinhaDoCartao =
  | { de: 'peca'; indice: number; familia: FamiliaDaPecaDaCondicao; frase: FraseDaCondicao }
  | { de: 'semPeca'; frase: FraseDaCondicao }
  | { de: 'prazo'; frase: FraseDaCondicao }
  | { de: 'saida'; indice: number; frase: FraseDaCondicao }
  | { de: 'apagadaPor'; id: string; frase: FraseDaCondicao }
  | { de: 'mapa'; frase: FraseDaCondicao }

/** O id do Lento de sempre: no mapa, anda metade do passo (`lib/movementRules.ts`), regra da pastilha e não peça. */
const ID_DO_LENTO = 'lento'

/** As linhas do cartão, na ordem: as peças, o prazo, as saídas, quem a apaga e a regra do mapa. */
export function frasesDoCartao(condicao: CondicaoMontada, contexto: ContextoDasFrases = {}): LinhaDoCartao[] {
  const linhas = condicao.pecas.map((peca, indice): LinhaDoCartao => ({ de: 'peca', indice, familia: peca.tipo, frase: frasePeca(peca, condicao, contexto) }))
  if (condicao.pecas.length === 0) linhas.push({ de: 'semPeca', frase: [corrido('Sem peça: o mestre narra o que ela faz.')] })
  linhas.push({ de: 'prazo', frase: frasePrazo(condicao.prazo) })
  condicao.saidas.forEach((saida, indice) => linhas.push({ de: 'saida', indice, frase: fraseSaida(saida) }))
  for (const outra of quemApaga(condicao, contexto)) {
    linhas.push({ de: 'apagadaPor', id: outra.id, frase: [corrido('Sai se ganhar '), pintado(outra.nome, 'selo'), corrido(` (está na Contra-condição de ${outra.nome}).`)] })
  }
  if (condicao.id === ID_DO_LENTO) linhas.push({ de: 'mapa', frase: [corrido('No mapa, anda metade do passo (a regra do Lento de sempre).')] })
  return linhas
}

/** A frase curta dos seletores (técnica, item, "Pôr selo"): a 1ª linha do cartão, em texto corrido. */
export function fraseCurta(condicao: CondicaoMontada, contexto: ContextoDasFrases = {}): string {
  const [primeira] = frasesDoCartao(condicao, contexto)
  return primeira === undefined ? '' : textoDaFrase(primeira.frase)
}

/** "O que aparece na batalha": até 4 linhas, a pastilha primeiro. */
export function naBatalha(condicao: CondicaoMontada): string[] {
  const linhas = ['A pastilha aparece no token, na ficha, na batalha e na tela do jogador.']
  const { pecas, saidas } = condicao
  if (pecas.some((peca) => peca.tipo === 'vez' && peca.quando === 'comeco' && peca.faz === 'tira' && peca.recurso === 'vida')) linhas.push('No começo da vez dele, o mestre recebe o lembrete "Aplicar / pular".')
  if (pecas.some((peca) => peca.tipo === 'bloqueio' && peca.itens.perdeVez === true)) linhas.push('Na vez dele, só "Passar a vez" fica liberado.')
  if (saidas.some((saida) => saida.tipo === 'teste')) linhas.push('No fim da vez dele, a batalha pede o teste (d20 + mod.).')
  if (saidas.some((saida) => saida.tipo === 'pagar')) linhas.push('Na vez dele aparece o botão "Tentar sair".')
  if (temPilha(condicao)) linhas.push('A pastilha mostra o número de pilhas.')
  if (pecas.some((peca) => peca.tipo === 'gatilho')) linhas.push('A pastilha mostra quantos turnos faltam para o gatilho.')
  if (pecas.some((peca) => peca.tipo === 'aura')) linhas.push('O mapa desenha o raio da aura em volta do token.')
  return linhas.slice(0, NA_BATALHA_MAX)
}

// ─── Avisos ────────────────────────────────────────────────────────────────

/** Um aviso do cartão; `impedeSalvar` = o editor não salva até resolver (sem nome, nome repetido, acima do teto). */
export interface AvisoDaCondicao {
  texto: string
  impedeSalvar: boolean
}

function prejudica(peca: PecaDaCondicao): boolean {
  switch (peca.tipo) {
    case 'vez':
      return peca.faz === 'tira'
    case 'atributo':
      return peca.faz !== 'soma'
    case 'danoCura':
      return (peca.recV ?? 0) > 0 || (peca.cauV ?? 0) < 0 || (peca.curaV ?? 0) < 0
    case 'bloqueio':
      return BLOQUEIOS_DA_CONDICAO.some((bloqueio) => bloqueio !== 'naoAlvo' && peca.itens[bloqueio] === true)
    case 'marca':
      return true
    default:
      return false
  }
}

function ajuda(peca: PecaDaCondicao): boolean {
  switch (peca.tipo) {
    case 'vez':
      return peca.faz === 'da'
    case 'atributo':
      return peca.faz === 'soma'
    case 'danoCura':
      return (peca.recV ?? 0) < 0 || (peca.cauV ?? 0) > 0 || (peca.curaV ?? 0) > 0 || peca.cddV !== undefined
    case 'bloqueio':
      return peca.itens.naoAlvo === true
    case 'anula':
      return true
    default:
      return false
  }
}

/** O aviso do nome: vazio ou repetido impedem; o de uma das 25 novas de fábrica só avisa (a criada vale no lugar dela, D5). */
function avisoDoNome(condicao: CondicaoMontada, todas: readonly CondicaoMontada[]): AvisoDaCondicao | null {
  const nome = condicao.nome.trim()
  if (nome === '') return { texto: 'Sem nome: dê um nome antes de salvar.', impedeSalvar: true }
  const chave = chaveDaCondicao(nome)
  const outra = todas.find((candidata) => candidata.id !== condicao.id && chaveDaCondicao(candidata.nome) === chave)
  if (outra === undefined) return null
  if (ehDaFabrica(outra.id) && !ehDeHoje(outra.id) && !ehDaFabrica(condicao.id)) return { texto: `"${nome}" é também o nome de uma de fábrica: pelo nome, vale a sua no lugar dela.`, impedeSalvar: false }
  return { texto: `Já existe uma condição chamada "${nome}": escolha outro nome.`, impedeSalvar: true }
}

const ATRIBUTO_DA_VELOCIDADE = 'velocidade'
const ATRIBUTO_DA_AGILIDADE = 'agilidade'
const ATRIBUTO_DO_ALCANCE = 'alcance'

function avisosDosTetos(condicao: CondicaoMontada): AvisoDaCondicao[] {
  const avisos: AvisoDaCondicao[] = []
  if (condicao.pecas.length > PECAS_DA_CONDICAO_MAX) avisos.push({ texto: `Mais de ${PECAS_DA_CONDICAO_MAX} peças: tire alguma antes de salvar.`, impedeSalvar: true })
  if (condicao.pecas.filter((peca) => peca.tipo === 'atributo').length > ATRIBUTOS_DA_CONDICAO_MAX) avisos.push({ texto: `Mais de ${ATRIBUTOS_DA_CONDICAO_MAX} peças Muda atributo: a batalha guarda ${ATRIBUTOS_DA_CONDICAO_MAX} por condição.`, impedeSalvar: true })
  if (condicao.saidas.length > SAIDAS_DA_CONDICAO_MAX) avisos.push({ texto: `Mais de ${SAIDAS_DA_CONDICAO_MAX} saídas: tire alguma antes de salvar.`, impedeSalvar: true })
  return avisos
}

function avisosDasPecas(condicao: CondicaoMontada, contexto: ContextoDasFrases): AvisoDaCondicao[] {
  const { pecas } = condicao
  const textos: string[] = []
  const bloqueio = pecas.find((peca): peca is PecaDaCondicaoDa<'bloqueio'> => peca.tipo === 'bloqueio')
  if (bloqueio !== undefined && bloqueio.itens.perdeVez === true && (bloqueio.itens.naoMove === true || bloqueio.itens.naoTecnica === true || bloqueio.itens.soSimples === true)) {
    textos.push('"Perde a vez" já impede andar, usar técnica e agir: os outros bloqueios da vez sobram.')
  }
  if (temPilha(condicao) && !pecas.some((peca) => peca.tipo === 'vez' || (peca.tipo === 'atributo' && (peca.faz === 'tira' || peca.faz === 'soma')))) {
    textos.push('Soma pilhas, mas só o Efeito na vez e o Muda atributo usam pilhas: aqui elas não mudam nada.')
  }
  if (pecas.some((peca) => peca.tipo === 'aura' && peca.cond === AURA_DESTA_MESMA && peca.espalha === true)) textos.push('Passa adiante sem limite: pode pegar o grupo todo.')
  if (pecas.some((peca) => peca.tipo === 'contra' && peca.apaga.includes(condicao.id))) textos.push('A Contra-condição apaga a própria condição.')
  if (pecas.some((peca) => peca.tipo === 'atributo' && (peca.faz === 'tira' || peca.faz === 'soma') && peca.v === 0)) textos.push('Muda atributo com 0: não muda nada.')
  const atributos = pecas.filter((peca): peca is PecaDaCondicaoDa<'atributo'> => peca.tipo === 'atributo')
  if (atributos.some((peca) => peca.atr === ATRIBUTO_DA_VELOCIDADE) && atributos.some((peca) => peca.atr === ATRIBUTO_DA_AGILIDADE)) {
    textos.push('Na batalha a Velocidade é a Agilidade: mexer nas duas soma as duas na Agilidade.')
  }
  const noAlcance = atributos.filter((peca) => peca.atr === ATRIBUTO_DO_ALCANCE)
  if (noAlcance.length > 1) textos.push('Mais de uma peça no Alcance: só a primeira vale.')
  if (noAlcance.some((peca) => (peca.faz === 'tira' || peca.faz === 'soma') && (peca.ritmo !== 'umaVez' || peca.conta !== 'fixo'))) textos.push('O Alcance muda só de uma vez e em casas: o ritmo e a % não valem nele.')
  if (pecas.filter((peca) => peca.tipo === 'gatilho').length > 1) textos.push('Mais de um "Depois de X turnos": só o primeiro conta.')
  if (pecas.filter((peca) => peca.tipo === 'marca').length > 1) textos.push('Mais de uma Marca: só a primeira vale.')
  const todas = contexto.todas ?? LISTA_DA_FABRICA
  const existe = (id: string): boolean => todas.some((outra) => outra.id === id)
  if (pecas.some((peca) => (peca.tipo === 'aura' && peca.cond !== AURA_DESTA_MESMA && !existe(peca.cond)) || (peca.tipo === 'contra' && peca.apaga.some((id) => !existe(id))))) {
    textos.push('Uma peça cita uma condição que não existe mais: escolha outra.')
  }
  return textos.map((texto) => ({ texto, impedeSalvar: false }))
}

/** Os avisos do cartão: o nome, os tetos, o tipo que não bate com as peças, as peças que se anulam e a falta de saída. */
export function avisosDe(condicao: CondicaoMontada, contexto: ContextoDasFrases = {}): AvisoDaCondicao[] {
  const todas = contexto.todas ?? LISTA_DA_FABRICA
  const avisos: AvisoDaCondicao[] = []
  const doNome = avisoDoNome(condicao, todas)
  if (doNome !== null) avisos.push(doNome)
  avisos.push(...avisosDosTetos(condicao))
  const algumPrejudica = condicao.pecas.some(prejudica)
  const algumAjuda = condicao.pecas.some(ajuda)
  if (condicao.tipo === 'positiva' && algumPrejudica && !algumAjuda) avisos.push({ texto: 'Marcada como positiva, mas só prejudica: confira o tipo.', impedeSalvar: false })
  if (condicao.tipo === 'negativa' && algumAjuda && !algumPrejudica) avisos.push({ texto: 'Marcada como negativa, mas só ajuda: confira o tipo.', impedeSalvar: false })
  avisos.push(...avisosDasPecas(condicao, contexto))
  const semFim = condicao.prazo.modo === 'ateTirar' || condicao.prazo.modo === 'batalha'
  const saiSozinha = condicao.saidas.length > 0 || quemApaga(condicao, contexto).length > 0 || condicao.pecas.some((peca) => peca.tipo === 'gatilho' && peca.gatilho.aoDisparar === 'some')
  if (semFim && !saiSozinha) avisos.push({ texto: condicao.prazo.modo === 'ateTirar' ? 'Sem saída: só sai quando alguém tirar.' : 'Sem saída: dura a batalha inteira.', impedeSalvar: false })
  return avisos
}

/** Algum aviso impede salvar? */
export function temAvisoQueImpede(avisos: readonly AvisoDaCondicao[]): boolean {
  return avisos.some((aviso) => aviso.impedeSalvar)
}
