import type { CarriedItem } from '../../types/map'
import type { FichaDBT } from '../dbt/modelo'
import { quantidadeDe } from '../items'
import type { CampoDaFichaDBT, CartaoDaFicha, Personagem } from '../personagem'
import {
  alvoDoCaminho,
  CAMPOS_DBT,
  CAMPOS_DO_ITEM,
  CAMPOS_DO_MESTRE,
  CAMPOS_SIMPLES_DO_CARTAO,
  chaveDaEtiqueta,
  MAPAS_NUMERICOS,
  ORDEM,
  quemEscreveAMudanca,
  type CampoDeOculta,
} from './caminho'
import { jsonIgual, paraJson, proprio, type Json } from './json'
import type { Mudanca, Papel } from './tipos'

/**
 * DIFERENÇAS (docs/planos/lobby-jogadores-2026-11-05.md §5.1): o que mudou
 * entre a ficha que o autor VIU (a base da janela, da sala ou do site) e o
 * rascunho dele, em mudanças pequenas por campo — nunca a ficha inteira. A
 * lei é a ida e volta: `aplicar(antes, diferencas(antes, depois))` dá `depois`.
 *
 * Fica fora, de propósito: `historico` (o log do servidor o substitui, §4.1),
 * `id` (é a ficha), a versão da ficha Dragon Ball (é a do app). Sem caminho na
 * tabela 4.7, a ficha vai inteira (apagar + criar, só o mestre, `atomico`:
 * tudo ou nada): troca de tipo jogador↔NPC e ficha que ganhou ou perdeu o
 * bloco Dragon Ball. A ordem da
 * mochila, das etiquetas e dos cartões ligados também não tem caminho: item,
 * etiqueta e cartão ligado novos entram no fim (o app nunca reordena esses).
 * Aba que só existe vazia de um lado não gera op (aba vazia = aba ausente).
 */

export interface OpcoesDaDiferenca {
  /**
   * `jogador`: só o que o jogador escreve. Campo do mestre (dono, nota, NPC,
   * imagem na v1, a ficha inteira) nunca vira op de jogador — nem para apagar
   * o que a projeção dele escondeu. A imagem fica de fora igual no cartão que
   * já existe (a troca não sai) e no cartão novo (entra sem imagem, nele e nos
   * subcartões). Padrão: `mestre`.
   */
  papel?: Papel
}

export function diferencas(antes: Personagem | null, depois: Personagem | null, opcoes: OpcoesDaDiferenca = {}): Mudanca[] {
  const todas = diferencasDaFicha(antes, depois)
  // Sem papel é o mestre: quem chama do lado do jogador (site, sala LAN) diz que é jogador.
  if ((opcoes.papel ?? 'mestre') === 'mestre') return todas
  return todas.map(cartaoNovoSemImagem).filter((mudanca) => quemEscreveAMudanca(mudanca) !== 'mestre')
}

/**
 * Imagem é só do mestre na v1 (12.4): o cartão que o jogador cria entra sem ela.
 * A `mecanica` que vale na batalha também (decisão 1 do mestre: o dono só propõe),
 * como o host da sala LAN faz com a que o jogador manda (`aplicarPartes`).
 */
function cartaoNovoSemImagem(mudanca: Mudanca): Mudanca {
  if (mudanca.acao !== 'criar' || mudanca.valor === undefined || alvoDoCaminho(mudanca.caminho)?.regra !== 'cartao') return mudanca
  return { ...mudanca, valor: semImagem(mudanca.valor) }
}

/** O cartão (já em JSON) com `imagem: null` e sem `mecanica`, nele e em todos os subcartões. */
function semImagem(cartao: Json): Json {
  if (cartao === null || typeof cartao !== 'object' || Array.isArray(cartao)) return cartao
  const { mecanica: _soDoMestre, oculta: _oculta, revelaAoUsar: _revela, ...resto } = cartao
  const subcartoes = proprio(resto, 'subcartoes')
  return { ...resto, imagem: null, ...(Array.isArray(subcartoes) ? { subcartoes: subcartoes.map(semImagem) } : {}) }
}

function definir(fichaId: string, caminho: string[], valor: unknown): Mudanca {
  return valor === undefined ? { fichaId, caminho, acao: 'definir' } : { fichaId, caminho, acao: 'definir', valor: paraJson(valor) }
}

function criarFicha(ficha: Personagem): Mudanca {
  return { fichaId: ficha.id, caminho: [], acao: 'criar', valor: paraJson(ficha) }
}

function apagarFicha(fichaId: string): Mudanca {
  return { fichaId, caminho: [], acao: 'apagar' }
}

function diferencasDaFicha(antes: Personagem | null, depois: Personagem | null): Mudanca[] {
  if (antes === null) return depois === null ? [] : [criarFicha(depois)]
  if (depois === null) return [apagarFicha(antes.id)]
  if (antes.id !== depois.id) throw new Error(`diferencas: fichas diferentes (${antes.id} e ${depois.id})`)
  if (antes.tipo !== depois.tipo || (antes.dbt === undefined) !== (depois.dbt === undefined)) {
    // Tudo ou nada: se o criar não entrar (ficha grande demais, por exemplo), o apagar também não entra e a ficha não some.
    return [
      { ...apagarFicha(antes.id), atomico: true },
      { ...criarFicha(depois), atomico: true },
    ]
  }
  const f = antes.id
  return [
    ...CAMPOS_DE_TEXTO.filter((campo) => antes[campo] !== depois[campo]).map((campo) => definir(f, [campo], depois[campo])),
    ...conjunto(antes.etiquetas, depois.etiquetas, {
      sai: (etiqueta) => ({ fichaId: f, caminho: ['etiquetas', chaveDaEtiqueta(etiqueta)], acao: 'apagar' }),
      entra: (etiqueta) => ({ fichaId: f, caminho: ['etiquetas', chaveDaEtiqueta(etiqueta)], acao: 'criar', valor: etiqueta }),
    }),
    ...registro(f, ['escolhas'], antes.escolhas, depois.escolhas),
    ...MAPAS_NUMERICOS.flatMap((mapa) => registro(f, [mapa], antes[mapa], depois[mapa])),
    ...conjunto(antes.cartoesAtivos, depois.cartoesAtivos, {
      sai: (cartaoId) => definir(f, ['cartoesAtivos', cartaoId], false),
      entra: (cartaoId) => definir(f, ['cartoesAtivos', cartaoId], true),
    }),
    ...abas(f, antes.abas, depois.abas),
    // Mochila ausente = vazia, moedas ausentes = zero (`Personagem.mochila/moedas`).
    ...mochila(f, antes.mochila ?? [], depois.mochila ?? []),
    ...moedas(f, antes.moedas ?? 0, depois.moedas ?? 0),
    ...dbt(f, antes.dbt, depois.dbt),
    ...CAMPOS_DO_MESTRE.filter((campo) => !jsonIgual(antes[campo], depois[campo])).map((campo) => definir(f, [campo], depois[campo])),
    // Fatia C7: a contagem "???" da projeção (o emissor a calcula; a ficha do mestre não a guarda).
    ...(jsonIgual(antes.ocultas, depois.ocultas) ? [] : [definir(f, ['ocultas'], depois.ocultas)]),
  ]
}

const CAMPOS_DE_OCULTA: readonly CampoDeOculta[] = ['oculta', 'revelaAoUsar']

const CAMPOS_DE_TEXTO: readonly ('nome' | 'descricao' | 'retrato')[] = ['nome', 'descricao', 'retrato']

/** Lista que é conjunto (etiquetas, cartões ligados): o que saiu e o que entrou, nessa ordem. */
function conjunto(antes: readonly string[], depois: readonly string[], ops: { sai: (valor: string) => Mudanca; entra: (valor: string) => Mudanca }): Mudanca[] {
  const emAntes = new Set(antes)
  const emDepois = new Set(depois)
  return [...[...emAntes].filter((valor) => !emDepois.has(valor)).map(ops.sai), ...[...emDepois].filter((valor) => !emAntes.has(valor)).map(ops.entra)]
}

/** Registro chave → valor (escolhas, números, campos do cartão): uma op por chave que mudou; chave que sumiu vai sem valor. */
function registro(f: string, base: string[], antes: Readonly<Record<string, unknown>>, depois: Readonly<Record<string, unknown>>): Mudanca[] {
  const chaves = [...new Set([...Object.keys(antes), ...Object.keys(depois)])]
  return chaves.filter((chave) => !jsonIgual(proprio(antes, chave), proprio(depois, chave))).map((chave) => definir(f, [...base, chave], proprio(depois, chave)))
}

function abas(f: string, antes: Readonly<Record<string, CartaoDaFicha[]>>, depois: Readonly<Record<string, CartaoDaFicha[]>>): Mudanca[] {
  const ids = [...new Set([...Object.keys(antes), ...Object.keys(depois)])]
  // Aba ausente de um lado é lista vazia (como `cartoesDaAba`).
  return ids.flatMap((aba) => listaDeCartoes(f, ['abas', aba], proprio(antes, aba) ?? [], proprio(depois, aba) ?? []))
}

/**
 * Cartões de uma lista (aba ou subcartões): apaga os que saíram, muda os que
 * ficaram, cria os novos (no fim) e, se a ordem final não sair igual, manda
 * o `ordenar` com a ordem do rascunho.
 */
function listaDeCartoes(f: string, base: string[], antes: readonly CartaoDaFicha[], depois: readonly CartaoDaFicha[]): Mudanca[] {
  const idsDepois = new Set(depois.map((cartao) => cartao.id))
  const porIdAntes = new Map(antes.map((cartao): [string, CartaoDaFicha] => [cartao.id, cartao]))
  const ficam = antes.filter((cartao) => idsDepois.has(cartao.id))
  const novos = depois.filter((cartao) => !porIdAntes.has(cartao.id))
  const ordemQueOAplicarDa = [...ficam, ...novos].map((cartao) => cartao.id)
  const ordemDoRascunho = depois.map((cartao) => cartao.id)
  const reordenar: Mudanca[] = jsonIgual(ordemQueOAplicarDa, ordemDoRascunho) ? [] : [{ fichaId: f, caminho: [...base, ORDEM], acao: 'ordenar', valor: ordemDoRascunho }]
  return [
    ...antes.filter((cartao) => !idsDepois.has(cartao.id)).map((cartao): Mudanca => ({ fichaId: f, caminho: [...base, cartao.id], acao: 'apagar' })),
    ...depois.flatMap((cartao) => {
      const velho = porIdAntes.get(cartao.id)
      return velho === undefined ? [] : umCartao(f, [...base, cartao.id], velho, cartao)
    }),
    ...novos.map((cartao): Mudanca => ({ fichaId: f, caminho: [...base, cartao.id], acao: 'criar', valor: paraJson(cartao) })),
    ...reordenar,
  ]
}

function umCartao(f: string, base: string[], antes: CartaoDaFicha, depois: CartaoDaFicha): Mudanca[] {
  return [
    ...CAMPOS_SIMPLES_DO_CARTAO.filter((campo) => !jsonIgual(antes[campo], depois[campo])).map((campo) => definir(f, [...base, campo], depois[campo])),
    ...(antes.imagem === depois.imagem ? [] : [definir(f, [...base, 'imagem'], depois.imagem)]),
    ...(jsonIgual(antes.mecanica, depois.mecanica) ? [] : [definir(f, [...base, 'mecanica'], depois.mecanica)]),
    // Fatia C7: a marca de oculta (só do mestre; o cartão oculto nem sobe ao Lobby, `semOcultas`).
    ...CAMPOS_DE_OCULTA.filter((campo) => antes[campo] !== depois[campo]).map((campo) => definir(f, [...base, campo], depois[campo])),
    ...registro(f, [...base, 'campos'], antes.campos, depois.campos),
    ...listaDeCartoes(f, [...base, 'subcartoes'], antes.subcartoes, depois.subcartoes),
  ]
}

/**
 * Mochila: tira as vagas que saíram ANTES de criar as novas (assim o item
 * empilhável que trocou de vaga não soma numa vaga que está saindo), muda
 * campo a campo as que ficaram e soma a diferença da quantidade.
 */
function mochila(f: string, antes: readonly CarriedItem[], depois: readonly CarriedItem[]): Mudanca[] {
  const idsDepois = new Set(depois.map((item) => item.id))
  const porIdAntes = new Map(antes.map((item): [string, CarriedItem] => [item.id, item]))
  return [
    ...antes.filter((item) => !idsDepois.has(item.id)).map((item): Mudanca => ({ fichaId: f, caminho: ['mochila', item.id], acao: 'apagar' })),
    ...depois.flatMap((item) => {
      const velho = porIdAntes.get(item.id)
      return velho === undefined ? [] : umItem(f, velho, item)
    }),
    ...depois.filter((item) => !porIdAntes.has(item.id)).map((item): Mudanca => ({ fichaId: f, caminho: ['mochila', item.id], acao: 'criar', valor: paraJson(item) })),
  ]
}

function umItem(f: string, antes: CarriedItem, depois: CarriedItem): Mudanca[] {
  const base = ['mochila', depois.id]
  const delta = quantidadeDe(depois) - quantidadeDe(antes)
  const soma: Mudanca[] = delta === 0 ? [] : [{ fichaId: f, caminho: [...base, 'quantidade'], acao: 'somar', delta }]
  return [...CAMPOS_DO_ITEM.filter((campo) => !jsonIgual(antes[campo], depois[campo])).map((campo) => definir(f, [...base, campo], depois[campo])), ...soma]
}

function moedas(f: string, antes: number, depois: number): Mudanca[] {
  return antes === depois ? [] : [{ fichaId: f, caminho: ['moedas'], acao: 'somar', delta: depois - antes }]
}

/** A mesma regra de `camposDBTMudados` (personagem.ts): variante e raça livre só valem com a raça delas, então mudou uma, vão as três. */
const CAMPOS_DBT_JUNTOS: readonly CampoDaFichaDBT[] = ['raca', 'variante', 'racaLivre']

function dbt(f: string, antes: FichaDBT | undefined, depois: FichaDBT | undefined): Mudanca[] {
  // Ganhar ou perder o bloco inteiro já virou apagar + criar da ficha (`diferencasDaFicha`).
  if (antes === undefined || depois === undefined) return []
  const mudaram = CAMPOS_DBT.filter((campo) => !jsonIgual(antes[campo], depois[campo]))
  const racaMudou = mudaram.some((campo) => CAMPOS_DBT_JUNTOS.includes(campo))
  const campos = racaMudou ? CAMPOS_DBT.filter((campo) => mudaram.includes(campo) || CAMPOS_DBT_JUNTOS.includes(campo)) : mudaram
  return campos.map((campo) => definir(f, ['dbt', campo], depois[campo]))
}
