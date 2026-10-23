/**
 * O MODELO DE CAMADAS mexido pelo painel (fatia 7 de
 * `docs/planos/camadas-fase3-2026-10-22.md`): criar, renomear, ordenar e
 * apagar camada livre. Funções puras sobre o mapa aberto (`modeloCamadas` é a
 * cópia em memória do modelo da aventura, para o Ctrl+Z): a store embrulha
 * cada uma no `withHistory`, um passo por gesto, e a aventura copia o modelo
 * do mapa aberto (`stores/adventureStore.ts`).
 *
 * Mudança que não muda nada devolve o MESMO mapa (sem passo vazio no Ctrl+Z).
 * Lista igual à padrão (os 13 ids na ordem de hoje, sem nomes) TIRA o modelo:
 * o mapa e a aventura voltam a gravar como antes.
 */
import type { CamadaDef, CamadaId, MapData, NaCamada } from '../../types/map'
import { NOME_DE_CAMADA_MAX, lerNomeDeCamada } from './arquivo'
import { CAMADAS_PADRAO, MODELO_PADRAO, ehCamadaPadrao, novoIdDeCamadaLivre } from './padrao'

/** 13 padrão + 51 livres = 64, o teto da lista que o jogador aceita (`MAX_CAMADAS_DO_JOGADOR`). */
export const MAX_CAMADAS_LIVRES = 51

/** O nome com que a camada nasce (o campo de renomear abre com ele selecionado). */
export const NOME_DA_CAMADA_NOVA = 'Nova camada'

export { NOME_DE_CAMADA_MAX }

/** O aviso de quem passa do teto (o botão "Nova camada" já se desliga antes; este é para o caminho que escapar). */
export const AVISO_DO_TETO = `Já há ${MAX_CAMADAS_LIVRES} camadas novas: apague uma para criar outra.`

/** "Camada "Cripta" apagada: 3 itens voltaram às camadas padrão." (e, se ela estava escondida, que os jogadores passam a vê-los). */
export function avisoDaCamadaApagada(nome: string | undefined, apagada: Pick<CamadaApagada, 'voltaram' | 'estavaEscondidaDosJogadores'>): string {
  const titulo = `Camada "${nome ?? 'Sem nome'}" apagada`
  if (apagada.voltaram === 0) return `${titulo}.`
  const quantos = apagada.voltaram === 1 ? '1 item voltou à camada padrão' : `${apagada.voltaram} itens voltaram às camadas padrão`
  // A camada estava escondida dos jogadores: os itens passam a seguir o olho da padrão, e o mestre precisa saber.
  return `${titulo}: ${quantos}${apagada.estavaEscondidaDosJogadores ? ' (estavam escondidos dos jogadores)' : ''}.`
}

function ordemDe(map: Pick<MapData, 'modeloCamadas'>): readonly CamadaDef[] {
  return (map.modeloCamadas ?? MODELO_PADRAO).ordem
}

function ehAPadrao(ordem: readonly CamadaDef[]): boolean {
  return ordem.length === CAMADAS_PADRAO.length && ordem.every((c, i) => c.id === CAMADAS_PADRAO[i] && c.nome === undefined)
}

/** O mapa com esta lista; a lista padrão tira a chave. */
function comOrdem(map: MapData, ordem: CamadaDef[]): MapData {
  if (ehAPadrao(ordem)) {
    if (map.modeloCamadas === undefined) return map
    const { modeloCamadas: _padrao, ...semModelo } = map
    return semModelo
  }
  return { ...map, modeloCamadas: { ordem } }
}

/** "Nova camada", ou "Nova camada 2", 3…: o primeiro que a lista ainda não tem. */
export function nomeDaCamadaNova(map: Pick<MapData, 'modeloCamadas'>): string {
  const nomes = new Set(ordemDe(map).map((c) => c.nome))
  if (!nomes.has(NOME_DA_CAMADA_NOVA)) return NOME_DA_CAMADA_NOVA
  for (let n = 2; ; n += 1) if (!nomes.has(`${NOME_DA_CAMADA_NOVA} ${n}`)) return `${NOME_DA_CAMADA_NOVA} ${n}`
}

export function quantasLivres(map: Pick<MapData, 'modeloCamadas'>): number {
  return ordemDe(map).filter((c) => !ehCamadaPadrao(c.id)).length
}

/**
 * Camada livre nova: id aleatório (`novoIdDeCamadaLivre`, nunca o nome),
 * logo ACIMA de `acimaDe` (a linha aberta no painel) ou no topo da lista.
 * Nasce visível para todos, a 100% e destravada: nenhum campo de estado muda.
 * `null` no teto de `MAX_CAMADAS_LIVRES`.
 */
export function criarCamadaLivre(map: MapData, opcoes: { nome?: string; acimaDe?: CamadaId }): { map: MapData; id: CamadaId } | null {
  if (quantasLivres(map) >= MAX_CAMADAS_LIVRES) return null
  const ordem = [...ordemDe(map)]
  const id = novoIdDeCamadaLivre(new Set(ordem.map((c) => c.id)))
  const nome = lerNomeDeCamada(opcoes.nome) ?? nomeDaCamadaNova(map)
  const abaixo = opcoes.acimaDe === undefined ? -1 : ordem.findIndex((c) => c.id === opcoes.acimaDe)
  ordem.splice(abaixo === -1 ? ordem.length : abaixo + 1, 0, { id, nome })
  return { map: comOrdem(map, ordem), id }
}

/**
 * Nome novo de camada LIVRE, saneado (`lerNomeDeCamada`: sem controle nem
 * marca de direção, 40 caracteres visíveis). As 13 padrão guardam o nome de
 * sempre (avisos, seletor e jornadas falam por ele). Em branco, igual, padrão
 * ou desconhecida: o mesmo mapa.
 */
export function renomearCamada(map: MapData, id: CamadaId, nome: string): MapData {
  if (ehCamadaPadrao(id)) return map
  const limpo = lerNomeDeCamada(nome)
  const ordem = ordemDe(map)
  const i = ordem.findIndex((c) => c.id === id)
  if (limpo === undefined || i === -1 || ordem[i].nome === limpo) return map
  return comOrdem(map, ordem.map((c, j) => (j === i ? { id, nome: limpo } : c)))
}

/**
 * Leva `id` ao índice `destino` da lista (0 = a de BAIXO, a que desenha por
 * baixo de todas). Vale para as 13 padrão e as livres; a camada movida vira
 * bloco entre as vizinhas novas (`lib/camadas/ordem.ts`). Índice fora da
 * lista fica no extremo; sem mudança, o mesmo mapa.
 */
export function moverCamada(map: MapData, id: CamadaId, destino: number): MapData {
  const ordem = [...ordemDe(map)]
  const de = ordem.findIndex((c) => c.id === id)
  if (de === -1 || !Number.isFinite(destino)) return map
  const para = Math.min(ordem.length - 1, Math.max(0, Math.round(destino)))
  if (para === de) return map
  const [movida] = ordem.splice(de, 1)
  ordem.splice(para, 0, movida)
  return comOrdem(map, ordem)
}

function soltarDe<T extends NaCamada>(lista: readonly T[], id: CamadaId, conta: { n: number }): T[] {
  if (!lista.some((item) => item.camada === id)) return lista as T[]
  return lista.map((item) => {
    if (item.camada !== id) return item
    conta.n += 1
    const { camada: _apagada, ...semCamada } = item
    return semCamada as T // as: o item sem o campo opcional `camada` continua sendo um T
  })
}

function semId<L extends readonly CamadaId[]>(lista: L | undefined, id: CamadaId): L | CamadaId[] | undefined {
  return lista === undefined || !lista.includes(id) ? lista : lista.filter((c) => c !== id)
}

export interface CamadaApagada {
  map: MapData
  /** Quantos itens desta cena voltaram à camada padrão do tipo (o telhado de uma sala conta 1). */
  voltaram: number
  /** A camada estava escondida dos jogadores: os itens que voltaram passam a seguir a padrão (o aviso diz). */
  estavaEscondidaDosJogadores: boolean
}

/**
 * Apaga uma camada LIVRE: sai da lista, e o estado dela (olhos, cadeado,
 * opacidade) sai do mapa; cada item dela VOLTA à camada padrão do tipo (o
 * campo `camada` sai). Um passo só de Ctrl+Z na store, que desfaz tudo. As 13
 * padrão não se apagam. Outras cenas da aventura não mudam aqui: lá o item
 * com a camada que sumiu cai na padrão pela leitura (`camadaDe`), e a camada
 * escondida dos jogadores continua escondida (falha FECHADA, `jogadorVeItem`).
 */
export function apagarCamadaLivre(map: MapData, id: CamadaId): CamadaApagada {
  const ordem = ordemDe(map)
  if (ehCamadaPadrao(id) || !ordem.some((c) => c.id === id)) return { map, voltaram: 0, estavaEscondidaDosJogadores: false }
  const conta = { n: 0 }
  const regions = soltarDe(map.regions, id, conta).map((r) => {
    if (r.room?.camadaDoTelhado !== id) return r
    conta.n += 1
    const { camadaDoTelhado: _apagada, ...room } = r.room
    return { ...r, room }
  })
  const ocultas = map.ocultasDoJogador ?? map.hiddenLayers
  const opacidades = map.opacidadeDasCamadas
  let semOpacidade = opacidades
  if (opacidades !== undefined && id in opacidades) {
    semOpacidade = { ...opacidades }
    delete semOpacidade[id]
  }
  const ocultasDoJogador = semId(map.ocultasDoJogador, id)
  const carimbos = map.carimbos === undefined ? undefined : soltarDe(map.carimbos, id, conta)
  const solto: MapData = {
    ...map,
    walls: soltarDe(map.walls, id, conta),
    lights: soltarDe(map.lights, id, conta),
    regions,
    tokens: soltarDe(map.tokens, id, conta),
    props: soltarDe(map.props, id, conta),
    stairs: soltarDe(map.stairs, id, conta),
    drawings: soltarDe(map.drawings, id, conta),
    floor: soltarDe(map.floor, id, conta),
    lines: soltarDe(map.lines, id, conta),
    markers: soltarDe(map.markers, id, conta),
    pins: soltarDe(map.pins, id, conta),
    hiddenLayers: semId(map.hiddenLayers, id) ?? [],
    lockedLayers: semId(map.lockedLayers, id) ?? [],
    ...(carimbos === undefined ? {} : { carimbos }),
    ...(ocultasDoJogador === undefined ? {} : { ocultasDoJogador }),
    ...(semOpacidade === undefined ? {} : { opacidadeDasCamadas: semOpacidade }),
  }
  return {
    map: comOrdem(solto, ordem.filter((c) => c.id !== id)),
    voltaram: conta.n,
    estavaEscondidaDosJogadores: ocultas.includes(id),
  }
}
