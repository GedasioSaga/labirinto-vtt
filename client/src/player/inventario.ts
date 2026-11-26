import type { CarriedItem, CondicaoPropria, LuzDoItem, MapData, Pin, Token, TokenCondition } from '../types/map'
import type { RegraDaVaga, TipoDoItem } from '../lib/itens/modelo'
import { condicoesPropriasOf } from '../lib/condicoesProprias'
import { itemOfPin, quantidadeDe, tokensTouch } from '../lib/items'
import { healthFraction, healthState, readTokenHealth, type HealthState } from '../lib/tokenHealth'
import { tokenConditionsOf } from '../lib/tokenConditions'
import { selectedTokenColor } from '../lib/tokenColor'
import { isTokenPhotoData, tokenPhotoRef } from '../lib/tokenPhoto'
import { moedasDe, moedasLabel } from '../lib/troca'

/**
 * INVENTÁRIO ESTILO RESIDENT EVIL — regras puras da tela do jogador
 * (`PlayerInventory`). Sem DOM e sem rede.
 *
 * SEGURANÇA: tudo aqui sai da ficha COMO O JOGADOR JÁ A RECEBE, pelo recorte
 * de `lib/fogFilter.ts` (`tokenForPlayer`). Nenhum campo novo atravessa para
 * ele por causa desta tela: a condição vem da PROPORÇÃO da vida, que só chega
 * quando o mestre deixou os jogadores verem a barra; sem ela, a condição é
 * "oculta", nunca um palpite. E o que sai daqui é só o estado, nunca número.
 */

/** A condição da faixa do ECG: um dos três estados da barra, ou oculta. */
export type InventoryCondition = { kind: 'known'; state: HealthState } | { kind: 'hidden' }

/** As palavras do ECG do RE em português — Fine, Caution, Danger. */
export const CONDITION_WORDS: Readonly<Record<HealthState, string>> = {
  fine: 'Bem',
  caution: 'Cuidado',
  danger: 'Perigo',
}

/**
 * A condição da ficha. Os cortes são os de `healthState` (`lib/tokenHealth.ts`:
 * até 50% cuidado, até 25% perigo) — os MESMOS que pintam a barra sob a ficha
 * no mapa, para as duas telas nunca discordarem.
 */
export function inventoryCondition(token: Pick<Token, 'health'>): InventoryCondition {
  const health = readTokenHealth(token.health)
  if (health === null || !health.shownToPlayers) return { kind: 'hidden' }
  return { kind: 'known', state: healthState(healthFraction(health)) }
}

/** O desenho da vaga. O nome manda; o desenho só ajuda a achar de relance. */
export type ItemGlyph = 'moedas' | 'chave' | 'papel' | 'erva' | 'frasco' | 'arma' | 'item'

/** Palavras que puxam cada desenho, sem acento e em minúsculas. A ordem decide o empate. */
const GLYPH_WORDS: readonly (readonly [ItemGlyph, RegExp])[] = [
  ['chave', /\b(chave|gazua|cartao de acesso)/],
  ['papel', /\b(carta|bilhete|mapa|nota|diario|livro|pagina|pergaminho|documento|jornal|recado|foto|relatorio)/],
  ['erva', /\b(erva|planta|flor|raiz|cogumelo|folha|musgo|semente)/],
  ['frasco', /\b(poca|frasco|remedio|elixir|antidoto|tonico|garrafa|spray|curativo|bandagem|atadura|ampola|seringa|kit)/],
  ['arma', /\b(faca|adaga|punhal|espada|lamina|machado|lanca|arco|besta|pistola|revolver|rifle|espingarda|arma|cajado|clava|martelo|flecha|municao)/],
]

/** Tira os acentos e baixa a caixa: "Poção" casa com "poca". */
function plain(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function itemGlyph(nome: string): ItemGlyph {
  const texto = plain(nome)
  return GLYPH_WORDS.find(([, palavras]) => palavras.test(texto))?.[0] ?? 'item'
}

/**
 * O pente da vaga como a tela o mostra: quantas balas, de qual (o nome achado na
 * mochila ou na lista do que a arma aceita) e, quando a vaga traz a regra, quantas cabem.
 */
export interface PenteNaTela {
  balaId: string
  n: number
  /** O nome da bala; `null` = nem a mochila nem a lista da arma dizem (a bala acabou e a arma não a declara). */
  bala: string | null
}

/**
 * Uma vaga da grade. SISTEMA DE ITENS REFEITO (PLANO §1.3, E5a): uma vaga da
 * mochila é uma vaga da grade — a pilha empilhável ocupa uma só, e duas armas
 * iguais são duas, cada uma com o seu "em uso" e o seu pente. O pego de pino
 * de antes, sem item do Acervo, ainda junta pelo nome: para a porta e para o
 * host, duas "Chave do Escudo" são a mesma chave.
 * `itemIds`: os ids das vagas na ordem em que chegaram; "Dar a…" passa o primeiro.
 */
export interface InventorySlot {
  key: string
  kind: 'item' | 'moedas'
  nome: string
  quantidade: number
  itemIds: string[]
  glyph: ItemGlyph
  /** ACERVO DE ITENS: a imagem do item (referência de mídia); ausente = o desenho do nome. */
  imagem?: string
  /** ACERVO DE ITENS: o texto do item, que viaja com ele na mochila (o pego de pino não tem). */
  descricao?: string
  /**
   * ITEM QUE ILUMINA: a vaga que o "Acender/Apagar" troca — a acesa, se há
   * uma entre as juntas, senão a primeira que ilumina. Ausente = não ilumina.
   */
  luz?: { vagaId: string; acesa: boolean }
  /** O tipo do item (cópia de exibição do Acervo); ausente = vaga de antes da conversão. */
  tipo?: TipoDoItem
  /** A vaga está em uso (arma, arremesso ou equipamento). */
  equipado: boolean
  /** O pente carregado (De fogo e Híbrida); ausente = vazio. */
  pente?: PenteNaTela
  /** Quantas balas cabem no pente: só quando a vaga traz a regra do item (o jogador não vê o Acervo). */
  capacidade?: number
  /** As munições que a arma aceita (id do item e nome); vazia = a arma não declara (aceita qualquer munição). */
  aceita: { itemId: string; nome: string }[]
  /** A frase do efeito ("Cura 100 de HP. Gasta 1."): sem ela, o item não tem regra e o mestre narra. */
  efeitoResumo?: string
  /** O texto que o mestre escreveu só nesta vaga (A4). */
  notaDaVaga?: string
  /** O item do Acervo da vaga; ausente = pego de pino de antes. */
  acervoId?: string
  /** Decisão 18: a regra do item em instantâneo (A1), de onde sai o cartão inteiro; ausente = vaga dada antes dela. */
  regra?: RegraDaVaga
  /** A luz do item (o alcance), para a frase do cartão; ausente = não ilumina. */
  luzDoItem?: LuzDoItem
}

/** A vaga de um item como a grade a mostra (sem o pente, que precisa da mochila inteira para achar o nome da bala). */
function slotDaVaga(item: CarriedItem, chave: string): InventorySlot {
  const slot: InventorySlot = { key: chave, kind: 'item', nome: item.nome, quantidade: quantidadeDe(item), itemIds: [item.id], glyph: glyphDaVaga(item), equipado: item.equipado === true, aceita: aceitaDaVaga(item) }
  if (item.imagem !== undefined) slot.imagem = item.imagem
  if (item.descricao !== undefined) slot.descricao = item.descricao
  if (item.luz !== undefined) slot.luz = { vagaId: item.id, acesa: item.acesa === true }
  if (item.tipo !== undefined) slot.tipo = item.tipo
  const capacidade = item.regra?.pente?.capacidade
  if (capacidade !== undefined && capacidade >= 1) slot.capacidade = capacidade
  if (item.efeitoResumo !== undefined) slot.efeitoResumo = item.efeitoResumo
  if (item.notaDaVaga !== undefined) slot.notaDaVaga = item.notaDaVaga
  if (item.itemId !== undefined) slot.acervoId = item.itemId
  if (item.regra !== undefined) slot.regra = item.regra
  if (item.luz !== undefined) slot.luzDoItem = item.luz
  return slot
}

/** O desenho pelo tipo, quando a vaga o tem; senão, pelo nome, como sempre. */
function glyphDaVaga(item: Pick<CarriedItem, 'nome' | 'tipo'>): ItemGlyph {
  switch (item.tipo) {
    case 'corpo':
    case 'fogo':
    case 'hibrida':
    case 'arremesso':
    case 'municao':
      return 'arma'
    case 'consumivel':
      return itemGlyph(item.nome) === 'erva' ? 'erva' : 'frasco'
    default:
      return itemGlyph(item.nome)
  }
}

/** O que a arma aceita: a lista que viaja com a vaga (com os nomes); sem ela, os ids da regra, sem nome. */
function aceitaDaVaga(item: Pick<CarriedItem, 'municoes' | 'regra'>): { itemId: string; nome: string }[] {
  if (item.municoes !== undefined) return item.municoes.map((m) => ({ ...m }))
  return (item.regra?.pente?.aceita ?? []).map((itemId) => ({ itemId, nome: 'Munição' }))
}

/** O nome da bala do pente: a vaga dela na mochila, senão a lista do que a arma aceita. */
function nomeDaBala(balaId: string, mochila: readonly CarriedItem[], aceita: readonly { itemId: string; nome: string }[]): string | null {
  return mochila.find((vaga) => vaga.itemId === balaId)?.nome ?? aceita.find((m) => m.itemId === balaId)?.nome ?? null
}

/** A bolsa primeiro (como o dinheiro no topo da mochila), depois os itens na ordem em que foram pegos. */
export function inventorySlots(token: Pick<Token, 'mochila' | 'moedas'>): InventorySlot[] {
  const slots: InventorySlot[] = []
  const moedas = moedasDe(token)
  if (moedas > 0) slots.push({ key: 'moedas', kind: 'moedas', nome: 'Moedas', quantidade: moedas, itemIds: [], glyph: 'moedas', equipado: false, aceita: [] })
  const porNome = new Map<string, InventorySlot>()
  // A mesma leitura de `carriedItemsOf`: mochila ausente é vazia.
  const mochila = token.mochila ?? []
  for (const item of mochila) {
    // Item do Acervo: uma vaga da mochila, uma vaga da grade (a pilha conta inteira em `quantidade`).
    if (item.itemId !== undefined) {
      const slot = slotDaVaga(item, `vaga:${item.id}`)
      if (item.pente !== undefined) slot.pente = { ...item.pente, bala: nomeDaBala(item.pente.balaId, mochila, slot.aceita) }
      slots.push(slot)
      continue
    }
    // O pego de pino de antes junta pelo nome. ITEM QUE ILUMINA: entre as juntas, o interruptor fica com a acesa.
    const chave = `item:${item.nome}`
    const existente = porNome.get(chave)
    if (existente === undefined) {
      const slot = slotDaVaga(item, chave)
      porNome.set(chave, slot)
      slots.push(slot)
      continue
    }
    existente.quantidade += quantidadeDe(item)
    existente.itemIds.push(item.id)
    const luz = item.luz === undefined ? undefined : { vagaId: item.id, acesa: item.acesa === true }
    if (luz !== undefined && (existente.luz === undefined || (luz.acesa && !existente.luz.acesa))) existente.luz = luz
  }
  return slots
}

/**
 * A ordem que a tela mostra, estável entre um mapa e o próximo. A ordem
 * natural (`inventorySlots`) muda sozinha: a bolsa só existe com saldo e entra
 * na frente de tudo, e uma vaga de mesmo nome acompanha o primeiro exemplar
 * que resta (dar a primeira de duas Ervas manda a Erva para depois da Chave).
 * `anterior` são as chaves na ordem que a grade já mostrou: quem continua fica
 * na mesma ordem, quem saiu libera o lugar (a grade fecha o vão sem trocar
 * ninguém de posição relativa) e quem chegou entra no fim, na ordem natural.
 */
export function stableSlotOrder(anterior: readonly string[] | undefined, slots: readonly InventorySlot[]): InventorySlot[] {
  if (anterior === undefined) return [...slots]
  const porChave = new Map(slots.map((slot) => [slot.key, slot]))
  const conhecidas = new Set(anterior)
  const mantidas = anterior.flatMap((key) => {
    const slot = porChave.get(key)
    return slot === undefined ? [] : [slot]
  })
  const novas = slots.filter((slot) => !conhecidas.has(slot.key))
  return [...mantidas, ...novas]
}

/** Colunas da grade, em qualquer largura: as setas contam com elas. */
export const INVENTORY_COLUMNS = 4
/** As vagas da mochila do jogador (protótipo aprovado, E5a): 16, e a pilha empilhável ocupa uma. */
export const VAGAS_DA_MOCHILA = 16
/** A grade nunca mostra menos que as 16 vagas — o desenho da mochila do RE. */
export const INVENTORY_MIN_SLOTS = VAGAS_DA_MOCHILA

/** Vagas vazias depois das cheias: completam a fileira, e a grade tem pelo menos `INVENTORY_MIN_SLOTS`. */
export function emptySlotCount(filled: number): number {
  const total = Math.max(INVENTORY_MIN_SLOTS, Math.ceil(filled / INVENTORY_COLUMNS) * INVENTORY_COLUMNS)
  return total - filled
}

/**
 * Para onde a tecla leva o foco na grade, ou `null` quando a tecla não é da
 * grade. Direita e esquerda andam pela ordem (passam de fileira); cima e
 * baixo andam uma coluna e, sem vaga cheia lá, ficam onde estão. Home e End
 * vão às pontas da fileira; com Ctrl, às pontas da grade.
 */
export function gridMove(index: number, key: string, count: number, ctrl: boolean): number | null {
  const last = count - 1
  const rowStart = index - (index % INVENTORY_COLUMNS)
  switch (key) {
    case 'ArrowRight':
      return Math.min(index + 1, last)
    case 'ArrowLeft':
      return Math.max(index - 1, 0)
    case 'ArrowDown':
      return index + INVENTORY_COLUMNS <= last ? index + INVENTORY_COLUMNS : index
    case 'ArrowUp':
      return index - INVENTORY_COLUMNS >= 0 ? index - INVENTORY_COLUMNS : index
    case 'Home':
      return ctrl ? 0 : rowStart
    case 'End':
      return ctrl ? last : Math.min(rowStart + INVENTORY_COLUMNS - 1, last)
    default:
      return null
  }
}

/** Uma ficha DELE que o host pode cobrar ao pagar um colega. */
export interface InventoryPayer {
  tokenId: string
  name: string
  /** O personagem próprio: a frase diz "sua bolsa". */
  editable: boolean
  moedas: number
}

/** Um colega a quem dar ou pagar: ficha de outro jogador encostada NESTA ficha. */
export interface InventoryColleague {
  tokenId: string
  name: string
  /**
   * As fichas DELE encostadas neste colega, na ordem do mapa — a ordem em que
   * o host procura quem paga (`handleCoinsGive`, net/hostSession.ts). Inclui
   * fichas que não são a aberta: o `coins.give` não diz de qual ficha sai.
   */
  payers: InventoryPayer[]
}

/**
 * De qual bolsa o host tira `quanto` moedas para este colega: a PRIMEIRA ficha
 * dele, na ordem do mapa, encostada no colega e com saldo bastante — a mesma
 * procura de `handleCoinsGive`. `undefined` = ninguém encostado tem tanto (o
 * host responderia "short").
 */
export function payerFor(colleague: Pick<InventoryColleague, 'payers'>, quanto: number): InventoryPayer | undefined {
  return colleague.payers.find((payer) => payer.moedas >= quanto)
}

/** Uma ficha do jogador como o inventário a mostra. */
export interface InventoryCharacter {
  tokenId: string
  name: string
  /** A foto que já viaja no recorte (`data:image/...`), ou `null`. */
  photo: string | null
  /** A cor da ficha no mapa, para a inicial quando não há foto. */
  color: string
  /** O personagem PRÓPRIO: ajudante contratado e NPC emprestado não trocam foto nem nome. */
  editable: boolean
  condition: InventoryCondition
  conditions: TokenCondition[]
  /** As condições que o mestre criou e marcou nesta ficha: é aqui que quem joga lê o NOME delas (no mapa só vai a pastilha). */
  condicoesProprias: CondicaoPropria[]
  slots: InventorySlot[]
  moedas: number
  colleagues: InventoryColleague[]
  /** O "Armas por batalha" da ficha (o limite do Equipar); `null` = sem limite, ou a ficha não chegou. */
  limiteDeArmas: number | null
}

/**
 * As fichas DELE que estão no mapa da tela, a própria primeiro. Colegas são
 * fichas de OUTROS jogadores (`partyTokenIds`) encostadas nesta — NPC do
 * mestre o host recusaria —, a mesma régua do "Dar a…" do "Comigo".
 */
export function inventoryCharacters(
  map: MapData,
  ownTokenIds: readonly string[],
  partyTokenIds: readonly string[],
  fallbackColor: string,
  limiteDe: (token: Token) => number | null = SEM_LIMITE,
): InventoryCharacter[] {
  const own = ownTokenIds.flatMap((id) => {
    const token = map.tokens.find((t) => t.id === id)
    return token === undefined ? [] : [token]
  })
  const party = map.tokens.filter((t) => partyTokenIds.includes(t.id) && !ownTokenIds.includes(t.id))
  // Na ORDEM DO MAPA, e não na de `ownTokenIds`: é a ordem em que o host procura quem paga.
  const ownInMapOrder = map.tokens.filter((t) => ownTokenIds.includes(t.id))
  const colleagueOf = (colleague: Token): InventoryColleague => ({
    tokenId: colleague.id,
    name: colleague.name,
    payers: ownInMapOrder
      .filter((t) => tokensTouch(t, colleague, map.grid))
      .map((t) => ({ tokenId: t.id, name: t.name, editable: isOwnCharacter(t), moedas: moedasDe(t) })),
  })
  const lista = own.map((token): InventoryCharacter => {
    const foto = tokenPhotoRef(token)
    return {
      tokenId: token.id,
      name: token.name,
      photo: isTokenPhotoData(foto) ? foto : null,
      color: selectedTokenColor(token) ?? fallbackColor,
      editable: isOwnCharacter(token),
      condition: inventoryCondition(token),
      conditions: tokenConditionsOf(token),
      condicoesProprias: condicoesPropriasOf(token),
      slots: inventorySlots(token),
      moedas: moedasDe(token),
      colleagues: party.filter((t) => tokensTouch(token, t, map.grid)).map(colleagueOf),
      limiteDeArmas: limiteDe(token),
    }
  })
  // A própria primeiro; ajudante e NPC emprestado depois, na ordem em que chegaram.
  return [...lista.filter((c) => c.editable), ...lista.filter((c) => !c.editable)]
}

/** Sem a ficha do personagem (o host de antes não manda), o Equipar não tem limite na tela: quem confere é o host. */
function SEM_LIMITE(): null {
  return null
}

/** O personagem PRÓPRIO: nem ajudante contratado nem NPC emprestado. */
function isOwnCharacter(token: Pick<Token, 'contrato' | 'emprestada'>): boolean {
  return token.contrato === undefined && token.emprestada !== true
}

/** A frase da pergunta Sim/Não quando o dinheiro sai de outra bolsa que não a da ficha aberta. */
export function payerLine(payer: Pick<InventoryPayer, 'name' | 'editable'>): string {
  return payer.editable ? 'Sai da sua bolsa.' : `Sai da bolsa de ${payer.name}.`
}

/** Quem a frase chama de "sua": a ficha própria. A emprestada vai pelo nome. */
type Owner = Pick<InventoryCharacter, 'name' | 'editable'>

/**
 * O que o jogador LEU de cada item, pelo id: o texto que o mestre escreveu no
 * pino (`description`). O "Pegar" tira o pino do mapa e põe na mochila um item
 * com o MESMO id, e a mochila chega ao jogador só como `{ id, nome }` — então
 * o texto só existe no cliente, lido enquanto o pino estava à vista.
 */
export type ItemTexts = ReadonlyMap<string, string>

/**
 * Soma à memória o texto dos pinos de ITEM (`itemOfPin`) que chegaram agora.
 * Texto vazio não apaga: o pino "só de perto" visto de longe chega vazio e
 * marcado `longe`, e o devolvido ao chão volta sem texto — o que o jogador já
 * leu continua dele. Texto novo (o mestre reescreveu) vale numa memória nova;
 * sem nada novo, a MESMA memória volta, para a tela não redesenhar à toa.
 */
export function rememberItemTexts(memory: ItemTexts, pins: readonly Pin[]): ItemTexts {
  let next: Map<string, string> | null = null
  for (const pin of pins) {
    if (itemOfPin(pin) === null) continue
    const texto = pin.description.trim()
    if (texto === '' || (next ?? memory).get(pin.id) === texto) continue
    next ??= new Map(memory)
    next.set(pin.id, texto)
  }
  return next ?? memory
}

/** O texto do mestre para a vaga: o do primeiro item dela que o jogador leu. A bolsa não tem pino. */
export function slotDescription(slot: InventorySlot, memory: ItemTexts): string | null {
  if (slot.kind === 'moedas') return null
  // O texto do acervo viaja com o item; o do pino só a tela lembra.
  if (slot.descricao !== undefined) return slot.descricao
  for (const id of slot.itemIds) {
    const texto = memory.get(id)
    if (texto !== undefined) return texto
  }
  return null
}

/**
 * Sem o texto do mestre, o que dá para FAZER com a vaga — pelo tipo do item,
 * que é o que o jogador tem na mão. Nada de "na sua mochila": o retrato ao
 * lado já diz de quem é. E nada que o app não faça: usar um item é com o
 * mestre, e a chave só age pelo cartão da passagem trancada.
 */
const FALLBACK_BY_GLYPH: Readonly<Record<Exclude<ItemGlyph, 'moedas'>, string>> = {
  chave: 'Se for a chave certa, abre uma passagem trancada: encoste a ficha nela e use pelo cartão da passagem.',
  papel: 'Para ler o que está escrito, peça ao mestre.',
  erva: 'Para usar, avise o mestre: o efeito é com ele.',
  frasco: 'Para usar, avise o mestre: o efeito é com ele.',
  arma: 'Para atacar, avise o mestre: o dano é com ele.',
  item: 'Para usar, diga ao mestre o que quer fazer com ele.',
}

/** Sem o texto do mestre, o que o TIPO do item diz (o item do Acervo convertido sempre tem tipo). */
const FALLBACK_BY_TIPO: Readonly<Record<TipoDoItem, string>> = {
  corpo: 'Arma de corpo a corpo. Equipada, aparece no Atacar da batalha.',
  fogo: 'Arma de fogo. Equipada e com bala no pente, aparece no Atacar da batalha.',
  hibrida: 'Bate e atira. Equipada, aparece no Atacar da batalha; o tiro gasta do pente.',
  municao: 'Munição: vai para o pente pelo Recarregar da arma que a aceita.',
  arremesso: 'Arremesso: equipado, você o joga na batalha.',
  consumivel: 'Consumível: use em você ou num colega.',
  equipamento: 'Equipamento: vista para valer.',
  outros: 'Um objeto que você carrega.',
}

export function slotFallbackLine(slot: InventorySlot): string {
  if (slot.kind === 'moedas' || slot.glyph === 'moedas') return `${moedasLabel(slot.quantidade)} para pagar um colega ou oferecer numa troca.`
  const uso = slot.tipo !== undefined ? FALLBACK_BY_TIPO[slot.tipo] : FALLBACK_BY_GLYPH[slot.glyph]
  return slot.quantidade > 1 ? `${slot.quantidade} unidades. ${uso}` : uso
}

/** A caixa do desenho do ECG (`viewBox` da faixa), em unidades do SVG. */
export const ECG_WIDTH = 240
export const ECG_HEIGHT = 56
/** A linha de base do traço: abaixo do meio, porque o pico R sobe muito mais do que o S desce. */
const ECG_BASE = 36
/** Largura de um complexo P-QRS-T inteiro, antes de apertar. */
const ECG_COMPLEX = 43

/**
 * O ritmo de cada estado — a pista que não é cor: Bem bate calmo e alto,
 * Cuidado mais apertado, Perigo curto, fraco e irregular.
 */
const ECG_RHYTHM: Readonly<Record<HealthState, { beats: number; amplitude: number; variation: readonly number[] }>> = {
  fine: { beats: 3, amplitude: 22, variation: [1] },
  caution: { beats: 4, amplitude: 17, variation: [1, 0.85] },
  danger: { beats: 6, amplitude: 12, variation: [1, 0.55, 1.15, 0.7, 0.95, 0.5] },
}

/**
 * O traço do ECG como `d` de um `path` na caixa `ECG_WIDTH` × `ECG_HEIGHT`.
 * Determinístico: o mesmo estado dá sempre o mesmo desenho. Oculta é a linha
 * de base só — a faixa a pinta pontilhada ("sem leitura").
 */
export function ecgPath(kind: HealthState | 'hidden'): string {
  if (kind === 'hidden') return `M0 ${ECG_BASE} H${ECG_WIDTH}`
  const { beats, amplitude, variation } = ECG_RHYTHM[kind]
  const width = ECG_WIDTH / beats
  // Batida estreita aperta o complexo, que nunca invade a batida seguinte.
  const squeeze = Math.min(1, (width * 0.7) / ECG_COMPLEX)
  const parts = [`M0 ${ECG_BASE}`]
  for (let beat = 0; beat < beats; beat += 1) {
    const a = amplitude * (variation[beat % variation.length] ?? 1)
    const start = beat * width + width * 0.3
    const x = (dx: number): string => (start + dx * squeeze).toFixed(1)
    const y = (dy: number): string => (ECG_BASE + dy).toFixed(1)
    parts.push(
      `L${x(0)} ${ECG_BASE}`,
      `Q${x(4)} ${y(-a * 0.18)} ${x(8)} ${ECG_BASE}`,
      `L${x(12)} ${ECG_BASE}`,
      `L${x(14)} ${y(a * 0.2)}`,
      `L${x(18)} ${y(-a)}`,
      `L${x(22)} ${y(a * 0.45)}`,
      `L${x(25)} ${ECG_BASE}`,
      `L${x(31)} ${ECG_BASE}`,
      `Q${x(37)} ${y(-a * 0.32)} ${x(ECG_COMPLEX)} ${ECG_BASE}`,
    )
  }
  parts.push(`L${ECG_WIDTH} ${ECG_BASE}`)
  return parts.join(' ')
}

/** Por que a condição está oculta — dito pelo que o jogador entende: o mestre guarda a vida. */
export function hiddenConditionLine(owner: Owner): string {
  return owner.editable ? 'Só o mestre vê a sua vida.' : `Só o mestre vê a vida de ${owner.name}.`
}
