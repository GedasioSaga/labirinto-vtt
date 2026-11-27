import type { CondicaoPropria, TokenCondition } from '../../types/map'
import { camposDoDesenho, corDaPaleta, type DesenhoDeCondicao, type NomeDaCorDeCondicao } from '../condicoesProprias'
import type { GatilhoDaCondicao } from '../itens/modelo'
import { TOKEN_CONDITION_LABELS, TOKEN_CONDITION_ORDER } from '../tokenConditions'
import {
  AURA_DESTA_MESMA,
  chaveDaCondicao,
  type BloqueioDaCondicao,
  type CondicaoMontada,
  type PecaDaCondicao,
  type PecaDaCondicaoDa,
  type PrazoDaCondicao,
  type SaidaDaCondicao,
  type TipoDaCondicao,
} from './modelo'

/**
 * AS 35 CONDIÇÕES DE FÁBRICA (rework das condições, PLANO.md §2 e decisão 9 do protótipo, E1): todas
 * montadas com as mesmas peças das criadas (`fabrica()`, prototipo.html:616-653), 26 negativas e 9
 * positivas. As 10 de antes (`IDS_DE_HOJE`) ficam com o MESMO id: fichas, itens e batalhas salvas não
 * mudam. Vale no app, no site, no jogador e no Worker (é código, não pasta).
 *
 * Cada uma é uma `CondicaoPropria` inteira (nome, cor, desenho e a regra), para "Usar como modelo"
 * copiar como está. A de fábrica não se edita (decisão 8): o conserto daqui chega a todas as mesas.
 *
 * Pelo nome (D5): a de antes vence a criada de mesmo nome (como era); a criada vence as 25 novas (como
 * era: antes elas não existiam). Os apelidos acham a mesma ("Atordoada", "Ferido por prata", e o
 * "Eletrizado" da peça Imbuir acha o Eletrocutado). Os prefixos são a tolerância da batalha pelo nome do
 * selo ("Atordoado 2", "Queimado"), a mesma da tabela de antes (`COMPORTAMENTOS_DOS_SELOS`).
 *
 * Puro: sem store, sem Tauri, sem `lib/batalha/condicoes.ts` e sem `catalogo.ts` (que importa daqui).
 *
 * API pública: `CondicaoDeFabrica`, `LISTA_DA_FABRICA`, `IDS_DE_HOJE`, `condicaoDaFabrica`, `ehDaFabrica`,
 * `ehDeHoje`, `condicaoDaFabricaPeloNome`, `condicaoDaFabricaPeloApelido`, `condicaoDaFabricaDoSelo`,
 * `apelidosDaFabrica`, `pastilhaDaFabrica`, `pastilhaDeFabricaDoMapa`.
 */

/** Uma condição de fábrica: a pastilha e a regra inteiras, já com o tipo, as peças, o prazo e as saídas. */
export type CondicaoDeFabrica = CondicaoPropria & CondicaoMontada

// ─── Os moldes (o `pecaNova` e o `saidaNova` do protótipo, só com o que difere do padrão) ───

type CamposDe<F extends PecaDaCondicao['tipo']> = Omit<PecaDaCondicaoDa<F>, 'tipo'>

function vez(campos: Partial<CamposDe<'vez'>> = {}): PecaDaCondicao {
  return { tipo: 'vez', quando: 'comeco', faz: 'tira', v: 10, conta: 'fixo', recurso: 'vida', ...campos }
}

function atributo(atr: string, campos: Partial<Omit<CamposDe<'atributo'>, 'atr'>> = {}): PecaDaCondicao {
  return { tipo: 'atributo', atr, faz: 'tira', v: 10, conta: 'fixo', ritmo: 'umaVez', ...campos }
}

function bloqueio(...ligados: readonly BloqueioDaCondicao[]): PecaDaCondicao {
  const itens: Partial<Record<BloqueioDaCondicao, true>> = {}
  for (const item of ligados) itens[item] = true
  return { tipo: 'bloqueio', itens }
}

function danoCura(campos: CamposDe<'danoCura'>): PecaDaCondicao {
  return { tipo: 'danoCura', ...campos }
}

function gatilho(regra: GatilhoDaCondicao): PecaDaCondicao {
  return { tipo: 'gatilho', gatilho: regra }
}

function marca(): PecaDaCondicao {
  return { tipo: 'marca', mult: 2, quem: 'todos', sai: true, desvDesv: true }
}

function aura(casas: number): PecaDaCondicao {
  return { tipo: 'aura', casas, quem: 'aliados', cond: AURA_DESTA_MESMA }
}

function contra(apaga: readonly string[], impede: boolean): PecaDaCondicao {
  return { tipo: 'contra', apaga, impede }
}

/** Por N turnos; "se ganhar de novo" e o teto de pilhas só quando diferem do padrão (o prazo recomeça). */
function turnos(n: number, deNovo: PrazoDaCondicao['deNovo'] = 'renova', teto?: number): PrazoDaCondicao {
  return { modo: 'turnos', n, deNovo, ...(teto === undefined ? {} : { teto }) }
}

/** Até alguém tirar, e nada muda se ganhar de novo. */
const ATE_TIRAR: PrazoDaCondicao = { modo: 'ateTirar', deNovo: 'nada' }

const SAI_COM_CURA: SaidaDaCondicao = { tipo: 'cura' }
const SAI_COM_DANO: SaidaDaCondicao = { tipo: 'dano', dano: 'qualquer' }
const SAI_PAGANDO_A_ACAO: SaidaDaCondicao = { tipo: 'pagar', como: 'pagar', paga: 'acao' }

function teste(atr: string, cd: number): SaidaDaCondicao {
  return { tipo: 'teste', atr, cd }
}

function fabricada(
  id: string,
  nome: string,
  tipo: TipoDaCondicao,
  cor: NomeDaCorDeCondicao,
  desenho: DesenhoDeCondicao,
  pecas: readonly PecaDaCondicao[],
  prazo: PrazoDaCondicao,
  saidas: readonly SaidaDaCondicao[] = [],
): CondicaoDeFabrica {
  return { id, nome, cor: corDaPaleta(cor), ...camposDoDesenho(desenho), tipo, pecas, prazo, saidas }
}

const nomeDaPastilha = (condicao: TokenCondition): string => TOKEN_CONDITION_LABELS[condicao]

// ─── As 35 ─────────────────────────────────────────────────────────────────

/** As 35, na ordem da lista (as negativas, depois as positivas), como no protótipo. */
export const LISTA_DA_FABRICA: readonly CondicaoDeFabrica[] = [
  fabricada('envenenado', nomeDaPastilha('envenenado'), 'negativa', 'Verde', 'caveira', [vez({ v: 3 }), danoCura({ curaV: -50 })], turnos(3, 'pilha', 5), [teste('resistencia', 12)]),
  fabricada('sangrando', 'Sangrando', 'negativa', 'Vermelho', 'gota', [vez({ v: 10, direto: true })], turnos(3, 'pilha', 3), [SAI_COM_CURA]),
  fabricada('queimando', 'Queimando', 'negativa', 'Laranja', 'chama', [vez({ v: 10 })], turnos(3), [SAI_PAGANDO_A_ACAO]),
  fabricada(
    'congelado',
    'Congelado',
    'negativa',
    'Azul',
    'floco',
    [atributo('velocidade'), bloqueio('reageDesv'), danoCura({ recV: 50, recTipo: 'impacto' }), contra(['queimando'], false)],
    turnos(2),
    [{ tipo: 'dano', dano: 'fogo' }],
  ),
  fabricada('molhado', 'Molhado', 'negativa', 'Turquesa', 'onda', [danoCura({ recV: 50, recTipo: 'eletricidade' }), contra(['queimando'], true)], turnos(2), [{ tipo: 'dano', dano: 'fogo' }]),
  fabricada('eletrocutado', 'Eletrocutado', 'negativa', 'Amarelo', 'raio', [vez({ quando: 'fim', recurso: 'sp' }), bloqueio('reageDesv')], turnos(2)),
  fabricada('atordoado', nomeDaPastilha('atordoado'), 'negativa', 'Roxo', 'estrela', [bloqueio('perdeVez', 'naoReage')], turnos(1, 'nada')),
  fabricada('paralisado', 'Paralisado', 'negativa', 'Amarelo', 'xis', [bloqueio('perdeVez', 'naoReage')], turnos(2, 'nada'), [teste('resistencia', 14)]),
  fabricada('aereo', 'Aéreo', 'negativa', 'Cinza', 'sobe', [bloqueio('naoDesvia')], turnos(1)),
  fabricada('enraizado', 'Enraizado', 'negativa', 'Verde', 'raiz', [bloqueio('naoMove')], ATE_TIRAR, [{ tipo: 'pagar', como: 'e', paga: 'acao', atr: 'forca', cd: 15 }]),
  fabricada('lento', nomeDaPastilha('lento'), 'negativa', 'Terra', 'ampulheta', [atributo('velocidade', { ritmo: 'cada', tetoN: 30 }), bloqueio('soSimples')], turnos(3)),
  fabricada('cego', 'Cego', 'negativa', 'Cinza', 'olhoRiscado', [atributo('percepcao', { faz: 'fica', v: 0 })], turnos(1)),
  fabricada('silenciado', 'Silenciado', 'negativa', 'Roxo', 'calado', [bloqueio('naoTecnica')], turnos(2), [{ tipo: 'pagar', como: 'ou', paga: 'sp', v: 20, atr: 'espirito', cd: 13 }]),
  fabricada('amedrontado', 'Amedrontado', 'negativa', 'Roxo', 'olho', [atributo('determinacao'), danoCura({ cauV: -20 })], turnos(3), [teste('determinacao', 12)]),
  fabricada('confuso', 'Confuso', 'negativa', 'Rosa', 'espiral', [atributo('intuicao'), bloqueio('soSimples')], turnos(2), [SAI_COM_DANO]),
  fabricada('enfraquecido', 'Enfraquecido', 'negativa', 'Terra', 'desce', [atributo('forca', { conta: 'pct', v: 20 }), danoCura({ cauV: -10 })], turnos(2)),
  fabricada('vulneravel', 'Vulnerável', 'negativa', 'Vermelho', 'alvo', [danoCura({ recV: 25 })], turnos(2)),
  fabricada('cura-reduzida', 'Cura reduzida', 'negativa', 'Rosa', 'cruz', [danoCura({ curaV: -50 })], turnos(3)),
  fabricada('fadiga', 'Fadiga', 'negativa', 'Terra', 'desce', [atributo('agilidade')], turnos(2, 'nada')),
  fabricada('marcado', 'Marcado', 'negativa', 'Vermelho', 'alvo', [marca()], turnos(3)),
  fabricada('drenado', 'Drenado', 'negativa', 'Roxo', 'gota', [vez({ quando: 'fim', recurso: 'sp', rouba: true })], turnos(3)),
  fabricada('corroido', 'Corroído', 'negativa', 'Verde', 'desce', [atributo('ca', { v: 1, ritmo: 'aPartir', aPartirN: 2, tetoN: 3 })], turnos(4, 'nada')),
  fabricada('infectado', 'Infectado', 'negativa', 'Verde', 'rede', [vez({ v: 5 }), aura(1)], turnos(3, 'nada'), [SAI_COM_CURA]),
  fabricada('dormindo', nomeDaPastilha('dormindo'), 'negativa', 'Azul', 'lua', [bloqueio('perdeVez', 'naoReage'), danoCura({ recV: 25 })], ATE_TIRAR, [SAI_COM_DANO]),
  fabricada('caido', nomeDaPastilha('caido'), 'negativa', 'Cinza', 'desce', [bloqueio('naoDesvia')], ATE_TIRAR, [SAI_PAGANDO_A_ACAO]),
  fabricada(
    'pavio',
    'Pavio aceso',
    'negativa',
    'Laranja',
    'bomba',
    [gatilho({ turnos: 2, vezes: 'uma', aoDisparar: 'some', pecas: [{ tipo: 'dano', valor: 30 }, { tipo: 'condicao', nome: 'Queimando', duracao: 2 }] })],
    ATE_TIRAR,
    [{ tipo: 'pagar', como: 'e', paga: 'acao', atr: 'agilidade', cd: 12 }, { tipo: 'dano', dano: 'gelo' }],
  ),
  fabricada('regenerando', 'Regenerando', 'positiva', 'Verde', 'coracao', [vez({ faz: 'da', v: 15 })], turnos(3)),
  fabricada('fortalecido', 'Fortalecido', 'positiva', 'Laranja', 'sobe', [atributo('forca', { faz: 'soma', v: 20 }), danoCura({ cauV: 10 })], turnos(3)),
  fabricada('acelerado', 'Acelerado', 'positiva', 'Turquesa', 'sobe', [atributo('velocidade', { faz: 'soma', v: 15 }), atributo('agilidade', { faz: 'soma', v: 10 })], turnos(2)),
  fabricada('protegido', 'Protegido', 'positiva', 'Azul', 'escudo', [vez({ quando: 'entrar', faz: 'da', recurso: 'escudo', v: 30 }), danoCura({ recV: -20 })], turnos(2)),
  fabricada('focado', 'Focado', 'positiva', 'Roxo', 'olho', [atributo('percepcao', { faz: 'soma', v: 15 }), atributo('intuicao', { faz: 'soma', v: 10 })], turnos(3), [SAI_COM_DANO]),
  fabricada('inspirado', 'Inspirado', 'positiva', 'Amarelo', 'estrela', [atributo('determinacao', { faz: 'soma', v: 10 }), danoCura({ cauV: 10 }), aura(2)], turnos(2)),
  fabricada('invisivel', nomeDaPastilha('invisivel'), 'positiva', 'Cinza', 'fantasma', [bloqueio('naoAlvo')], turnos(2), [{ tipo: 'agir' }]),
  fabricada('abencoado', 'Abençoado', 'positiva', 'Rosa', 'coracao', [danoCura({ cddV: 10 })], turnos(3)),
  fabricada('embalado', 'Embalado', 'positiva', 'Vermelho', 'sobe', [atributo('forca', { faz: 'soma', v: 5 })], turnos(2, 'pilha', 5)),
]

/** As 10 de antes do rework, com o mesmo id (`IDS_DE_HOJE` do protótipo): pelo nome, vencem a criada de mesmo nome. */
export const IDS_DE_HOJE: readonly string[] = ['envenenado', 'caido', 'dormindo', 'atordoado', 'invisivel', 'lento', 'sangrando', 'queimando', 'cura-reduzida', 'fadiga']

/** Os outros nomes que acham a mesma de fábrica (o feminino, o nome velho, o da peça Imbuir). Exatos, pela chave. */
const APELIDOS: Readonly<Record<string, readonly string[]>> = {
  envenenado: ['Envenenada'],
  sangrando: ['Sangrenta'],
  atordoado: ['Atordoada'],
  paralisado: ['Paralisada'],
  aereo: ['Aérea'],
  enraizado: ['Enraizada'],
  lento: ['Lenta'],
  cego: ['Cega'],
  silenciado: ['Silenciada'],
  amedrontado: ['Amedrontada'],
  confuso: ['Confusa'],
  enfraquecido: ['Enfraquecida'],
  'cura-reduzida': ['Ferido por prata', 'Ferida por prata'],
  marcado: ['Marcada'],
  drenado: ['Drenada'],
  corroido: ['Corroída'],
  infectado: ['Infectada'],
  caido: ['Caída'],
  fortalecido: ['Fortalecida'],
  acelerado: ['Acelerada'],
  protegido: ['Protegida'],
  focado: ['Focada'],
  inspirado: ['Inspirada'],
  abencoado: ['Abençoada'],
  embalado: ['Embalada'],
  // A peça Imbuir da Eletricidade põe "Eletrizado" (ELEMENTOS_DE_FABRICA, lib/batalha/mecanica/pecas.ts).
  eletrocutado: ['Eletrizado', 'Eletrizada', 'Eletrocutada'],
}

/**
 * O começo de nome que a batalha aceita pelo selo, já na chave (`chaveDaCondicao`): a tolerância da
 * tabela de antes (`sinal`, lib/batalha/condicoes.ts), para "Atordoado 2" e "Queimado" seguirem achados.
 */
const PREFIXOS_DO_SELO: Readonly<Record<string, readonly string[]>> = {
  atordoado: ['atordoad'],
  paralisado: ['paralisad'],
  aereo: ['aereo', 'aerea'],
  cego: ['cego', 'cega'],
  marcado: ['marcado', 'marcada'],
  'cura-reduzida': ['cura reduzida', 'ferido por prata', 'ferida por prata'],
  sangrando: ['sangr'],
  queimando: ['queima'],
  enraizado: ['enraizad'],
}

const POR_ID: ReadonlyMap<string, CondicaoDeFabrica> = new Map(LISTA_DA_FABRICA.map((condicao) => [condicao.id, condicao]))
const DE_HOJE: ReadonlySet<string> = new Set(IDS_DE_HOJE)

/** A de fábrica deste id; `null` = não é de fábrica. */
export function condicaoDaFabrica(id: string): CondicaoDeFabrica | null {
  return POR_ID.get(id) ?? null
}

/** O id é de uma das 35? */
export function ehDaFabrica(id: string): boolean {
  return POR_ID.has(id)
}

/** O id é de uma das 10 de antes do rework? */
export function ehDeHoje(id: string): boolean {
  return DE_HOJE.has(id)
}

/** Os apelidos de uma de fábrica (vazio = nenhum). */
export function apelidosDaFabrica(id: string): readonly string[] {
  return APELIDOS[id] ?? []
}

/** A de fábrica com este NOME exato (pela chave, sem acento nem caixa); `null` = nenhuma. Os apelidos não contam. */
export function condicaoDaFabricaPeloNome(nome: string): CondicaoDeFabrica | null {
  const chave = chaveDaCondicao(nome)
  if (chave === '') return null
  return LISTA_DA_FABRICA.find((condicao) => chaveDaCondicao(condicao.nome) === chave) ?? null
}

/** A de fábrica com este APELIDO exato ("Atordoada", "Eletrizado"); `null` = nenhuma. */
export function condicaoDaFabricaPeloApelido(nome: string): CondicaoDeFabrica | null {
  const chave = chaveDaCondicao(nome)
  if (chave === '') return null
  return LISTA_DA_FABRICA.find((condicao) => apelidosDaFabrica(condicao.id).some((apelido) => chaveDaCondicao(apelido) === chave)) ?? null
}

/**
 * A de fábrica pelo nome de um SELO da batalha: o nome exato, o apelido, e por fim o começo de nome que
 * a tabela de antes aceitava ("Atordoado 2", "Queimado", "Ferida por prata 3"). `null` = nenhuma.
 */
export function condicaoDaFabricaDoSelo(nomeDoSelo: string): CondicaoDeFabrica | null {
  const exata = condicaoDaFabricaPeloNome(nomeDoSelo) ?? condicaoDaFabricaPeloApelido(nomeDoSelo)
  if (exata !== null) return exata
  const chave = chaveDaCondicao(nomeDoSelo)
  if (chave === '') return null
  return LISTA_DA_FABRICA.find((condicao) => (PREFIXOS_DO_SELO[condicao.id] ?? []).some((prefixo) => chave.startsWith(prefixo))) ?? null
}

/**
 * A pastilha da de fábrica no molde das criadas, só com o que se desenha (id, nome, cor, desenho e a
 * reserva): é o que vai na ficha (`Token.condicoesProprias`) quando o nome a acende, sem a regra.
 */
export function pastilhaDaFabrica(condicao: CondicaoDeFabrica): CondicaoPropria {
  return { id: condicao.id, nome: condicao.nome, cor: condicao.cor, simbolo: condicao.simbolo, ...(condicao.desenho === undefined ? {} : { desenho: condicao.desenho }) }
}

/** A pastilha de sempre do mapa (as 6 de `TokenCondition`, D11: mantêm o desenho do mapa); `null` = a de fábrica usa a pastilha no molde das criadas. */
export function pastilhaDeFabricaDoMapa(id: string): TokenCondition | null {
  return TOKEN_CONDITION_ORDER.find((condicao) => condicao === id) ?? null
}
