import type { Drawing, DrawingPoint, MapData, ParedesDoDesenho, Wall, WallThicknessPreset } from '../types/map'
import { aceitaParedesAoRedor, segmentosDasParedesPresas, type SegmentoDeParede } from './paredesDoDesenho'

/**
 * PAREDES PRESAS AO DESENHO (pedido de 08/10/2026, "Paredes ao redor"): as
 * paredes que um desenho cria no próprio contorno são DERIVADAS dele. Nascem,
 * andam, mudam e somem com o desenho; o mestre não as edita uma a uma — para
 * isso existe "Soltar", que as transforma em paredes comuns.
 *
 * Por que um ponto central (`sincronizarParedesDosDesenhos`) e não um remendo
 * em cada ação da store: o desenho muda por dezenas de caminhos (mover ao
 * vivo, alças, cantos, raio, pontas, pontos da curva, espessura, ponta,
 * preenchimento, borracha que divide, apagar, recortar, colar, duplicar,
 * desfazer, refazer, trocar de cena, abrir arquivo). Ligar cada um deles à
 * parede seria uma lista que esquece o próximo caminho criado. A store chama
 * esta função em TODO `set` que troca o mapa, comparando o mapa de antes com o
 * de depois: o que não mudou volta pela mesma referência, e o custo de um
 * passo que não mexe em desenho nem parede é uma comparação de duas listas.
 *
 * Regra das presas: cada uma é `idDaParedePresa(desenho, i)`, na ordem dos
 * segmentos do contorno (`segmentosDasParedesPresas`). A mesma entrada dá as
 * mesmas paredes — mesmos ids, mesmas pontas —, o que mantém o desfazer, o
 * envio ao jogador e o render estáveis. Presa mexida por fora (apagada,
 * arrastada, ganhou porta) volta a ser o que o desenho diz.
 */

/** O que ligar o interruptor escreve num desenho que nunca teve paredes. */
export const PAREDES_DO_DESENHO_PADRAO: Readonly<ParedesDoDesenho> = {
  ativo: true,
  invisivel: false,
  passagem: 'bloqueia',
}

/**
 * Espessura das presas: o fio de planta (1 px de tela). Elas correm dos dois
 * lados de um traço que costuma ter 4 px de mundo; parede média ou grossa ali
 * viraria um borrão da cor da parede por cima do desenho.
 */
const ESPESSURA_DA_PRESA: WallThicknessPreset = 'thin'

/** Coordenada que anda menos que isto entre dois pontos do desenho ainda conta como o mesmo arrasto. */
const FOLGA_DO_ARRASTO = 1e-6
/** As presas saem arredondadas a 0,01 px, como o contorno (`lib/paredesDoDesenho.ts`). */
const CENTESIMOS = 100

const NENHUMA: readonly Wall[] = []

/** Id determinístico da i-ésima parede presa ao desenho. */
export function idDaParedePresa(desenhoId: string, indice: number): string {
  return `${desenhoId}:parede:${indice}`
}

/** As paredes presas do desenho estão ligadas (e o tipo de desenho aceita paredes)? */
export function temParedesAoRedor(desenho: Drawing): boolean {
  return desenho.paredes?.ativo === true && aceitaParedesAoRedor(desenho)
}

/**
 * O `patch` do painel aplicado às paredes do desenho. Ligar um desenho que
 * nunca teve paredes parte do padrão. Escolher "Invisível" passa a passagem
 * para "Vê mas não passa": parede invisível que barra a visão deixaria uma
 * borda de escuridão sem nenhuma parede à vista do jogador. O mestre pode
 * trocar de volta depois (o patch que traz `passagem` junto manda). Nada
 * mudou = a MESMA referência, para a store não gastar passo de desfazer.
 */
export function mesclarParedesDoDesenho(atual: ParedesDoDesenho | undefined, patch: Partial<ParedesDoDesenho>): ParedesDoDesenho {
  const base = atual ?? PAREDES_DO_DESENHO_PADRAO
  const virouInvisivel = patch.invisivel === true && !base.invisivel
  const cor = 'cor' in patch ? patch.cor : base.cor
  const junto: ParedesDoDesenho = {
    ativo: patch.ativo ?? base.ativo,
    invisivel: patch.invisivel ?? base.invisivel,
    passagem: patch.passagem ?? (virouInvisivel ? 'janela' : base.passagem),
    ...(cor === undefined ? {} : { cor }),
  }
  if (atual !== undefined && mesmasEscolhas(atual, junto)) return atual
  return junto
}

function mesmasEscolhas(a: ParedesDoDesenho, b: ParedesDoDesenho): boolean {
  return a.ativo === b.ativo && a.invisivel === b.invisivel && a.passagem === b.passagem && a.cor === b.cor
}

/** O mapa com as escolhas de paredes do desenho trocadas; mesmo mapa se nada mudou. */
export function aplicarParedesDoDesenho(map: MapData, desenhoId: string, patch: Partial<ParedesDoDesenho>): MapData {
  const desenho = map.drawings.find((d) => d.id === desenhoId)
  if (desenho === undefined || !aceitaParedesAoRedor(desenho)) return map
  const paredes = mesclarParedesDoDesenho(desenho.paredes, patch)
  if (paredes === desenho.paredes) return map
  return { ...map, drawings: map.drawings.map((d) => (d.id === desenhoId ? { ...d, paredes } : d)) }
}

/**
 * SOLTAR: as presas viram paredes comuns — sem `desenhoId` e com id novo
 * (`novoId`), para não colidir com as presas que o desenho criar se as
 * paredes forem religadas — e o desenho desliga as paredes ao redor,
 * guardando as outras escolhas. Mesmo mapa se não há o que soltar.
 */
export function soltarParedesDoDesenho(map: MapData, desenhoId: string, novoId: () => string): MapData {
  const desenho = map.drawings.find((d) => d.id === desenhoId)
  const paredes = desenho?.paredes
  if (desenho === undefined || paredes === undefined || !paredes.ativo) return map
  return {
    ...map,
    drawings: map.drawings.map((d) => (d.id === desenhoId ? { ...d, paredes: { ...paredes, ativo: false } } : d)),
    walls: map.walls.map((parede) => {
      if (parede.desenhoId !== desenhoId) return parede
      const solta = { ...parede, id: novoId() }
      delete solta.desenhoId
      return solta
    }),
  }
}

/** Quantas paredes estão presas ao desenho agora. */
export function quantasParedesPresas(map: Pick<MapData, 'walls'>, desenhoId: string): number {
  let total = 0
  for (const parede of map.walls) if (parede.desenhoId === desenhoId) total += 1
  return total
}

// ── Sincronizar ──────────────────────────────────────────────────────────────

/**
 * Onde as presas de um desenho estão: os segmentos de quando o contorno foi
 * calculado (ou lido do arquivo) e quanto o desenho andou desde então. Mover
 * não recalcula o contorno — o arrasto ao vivo de um rabisco grande custaria
 * ~10 ms por quadro —, só soma o deslocamento.
 */
interface GeometriaDasPresas {
  base: readonly SegmentoDeParede[]
  dx: number
  dy: number
}

/**
 * Por referência do desenho: o mapa nunca muda no lugar, então o mesmo objeto
 * tem sempre a mesma forma. Some sozinho quando o desenho sai do histórico.
 */
const geometriaPorDesenho = new WeakMap<Drawing, GeometriaDasPresas>()

/**
 * `depois` com as paredes presas de acordo com os desenhos de `depois`:
 * desenho com paredes ligadas tem exatamente as presas que o contorno dele
 * dá; desenho sem paredes ligadas, apagado ou de outro mapa não tem nenhuma.
 * `antes` é o mapa de onde `depois` saiu: diz o que mudou (o resto não é
 * recalculado) e, num arrasto, de onde o desenho veio. Nada a acertar = a
 * MESMA referência de `depois`.
 */
export function sincronizarParedesDosDesenhos(antes: MapData, depois: MapData): MapData {
  if (antes === depois || (antes.drawings === depois.drawings && antes.walls === depois.walls)) return depois
  // Outro mapa (abrir arquivo, trocar de cena): nada do anterior vale como
  // "de onde veio", e as presas que chegam com o mapa valem como estão.
  const mesmoMapa = antes.id === depois.id
  const desenhosAntes = mesmoMapa ? new Map(antes.drawings.map((d) => [d.id, d])) : new Map<string, Drawing>()
  const presasDepois = presasPorDesenho(depois.walls)
  const presasAntes = !mesmoMapa ? new Map<string, Wall[]>() : antes.walls === depois.walls ? presasDepois : presasPorDesenho(antes.walls)

  const alvo = new Map<string, readonly Wall[]>()
  let mudou = false
  for (const desenho of depois.drawings) {
    const atuais = presasDepois.get(desenho.id) ?? NENHUMA
    const paredes = desenho.paredes
    if (paredes === undefined || !paredes.ativo || !aceitaParedesAoRedor(desenho)) {
      if (atuais.length > 0) mudou = true
      continue
    }
    const anterior = desenhosAntes.get(desenho.id)
    const presasDoAnterior = presasAntes.get(desenho.id) ?? NENHUMA
    // Nem o desenho nem as presas dele mudaram: o caso de quase todo passo.
    if (anterior === desenho && mesmasReferencias(presasDoAnterior, atuais)) {
      alvo.set(desenho.id, atuais)
      continue
    }
    const esperadas = paredesEsperadas(desenho, paredes, geometriaDasPresas(desenho, anterior, atuais, presasDoAnterior), atuais)
    alvo.set(desenho.id, esperadas)
    if (esperadas !== atuais) mudou = true
  }
  // Presa cujo desenho saiu do mapa (ou desligou as paredes, já contado acima).
  if (!mudou) {
    for (const dono of presasDepois.keys()) {
      if (!alvo.has(dono)) {
        mudou = true
        break
      }
    }
  }
  return mudou ? { ...depois, walls: montarParedes(depois.walls, alvo) } : depois
}

function presasPorDesenho(paredes: readonly Wall[]): Map<string, Wall[]> {
  const porDono = new Map<string, Wall[]>()
  for (const parede of paredes) {
    const dono = parede.desenhoId
    if (dono === undefined) continue
    const lista = porDono.get(dono)
    if (lista) lista.push(parede)
    else porDono.set(dono, [parede])
  }
  return porDono
}

function mesmasReferencias(a: readonly Wall[], b: readonly Wall[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false
  return true
}

function geometriaDasPresas(desenho: Drawing, anterior: Drawing | undefined, atuais: readonly Wall[], presasDoAnterior: readonly Wall[]): GeometriaDasPresas {
  const guardada = geometriaPorDesenho.get(desenho)
  if (guardada !== undefined) return guardada
  const nova = geometriaNova(desenho, anterior, atuais, presasDoAnterior)
  geometriaPorDesenho.set(desenho, nova)
  return nova
}

function geometriaNova(desenho: Drawing, anterior: Drawing | undefined, atuais: readonly Wall[], presasDoAnterior: readonly Wall[]): GeometriaDasPresas {
  if (anterior !== undefined && anterior !== desenho) {
    // Arrastado, ou só mudou o que não é forma (cor, escolhas das paredes,
    // piso): a geometria é a do desenho de antes, deslocada.
    const deslocamento = deslocamentoDoDesenho(anterior, desenho)
    const deAntes = deslocamento === null ? undefined : geometriaPorDesenho.get(anterior) ?? geometriaLida(presasDoAnterior)
    if (deslocamento !== null && deAntes !== undefined) {
      return { base: deAntes.base, dx: deAntes.dx + deslocamento.dx, dy: deAntes.dy + deslocamento.dy }
    }
  }
  // Desenho que chega de fora (arquivo, outra cena, desfazer um apagar) com as
  // presas prontas: valem as que vieram, sem recalcular o contorno.
  if (anterior === undefined) {
    const lida = geometriaLida(atuais)
    if (lida !== undefined) return lida
  }
  return { base: segmentosDasParedesPresas(desenho), dx: 0, dy: 0 }
}

/** As pontas de presas que já existem; `undefined` sem nenhuma (aí o contorno é calculado). */
function geometriaLida(presas: readonly Wall[]): GeometriaDasPresas | undefined {
  if (presas.length === 0) return undefined
  return { base: presas.map((p) => ({ x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2 })), dx: 0, dy: 0 }
}

/**
 * As presas que o desenho deve ter, reaproveitando os objetos de `atuais` que
 * já estão certos. Todas certas = a própria lista `atuais` (quem chama lê
 * isso como "nada mudou").
 */
function paredesEsperadas(desenho: Drawing, paredes: ParedesDoDesenho, geometria: GeometriaDasPresas, atuais: readonly Wall[]): readonly Wall[] {
  const atuaisPorId = new Map(atuais.map((p) => [p.id, p]))
  let iguais = geometria.base.length === atuais.length
  const saida = geometria.base.map((segmento, indice) => {
    const nova = paredePresa(desenho, paredes, deslocar(segmento, geometria), indice)
    const velha = atuaisPorId.get(nova.id)
    if (velha !== undefined && mesmaParede(velha, nova)) {
      if (atuais[indice] !== velha) iguais = false
      return velha
    }
    iguais = false
    return nova
  })
  return iguais ? atuais : saida
}

function deslocar(segmento: SegmentoDeParede, geometria: GeometriaDasPresas): SegmentoDeParede {
  if (geometria.dx === 0 && geometria.dy === 0) return segmento
  return {
    x1: centesimo(segmento.x1 + geometria.dx),
    y1: centesimo(segmento.y1 + geometria.dy),
    x2: centesimo(segmento.x2 + geometria.dx),
    y2: centesimo(segmento.y2 + geometria.dy),
  }
}

function centesimo(valor: number): number {
  return Math.round(valor * CENTESIMOS) / CENTESIMOS
}

/**
 * Uma presa: barra sempre o passo; a visão só em 'bloqueia' (em 'janela' a
 * visão atravessa, como "Deixa ver" da parede comum, `setWallPassagem`);
 * invisível vira `hidden` (o jogador não a recebe, `lib/fogFilter.ts`). Mora
 * no piso do desenho.
 */
function paredePresa(desenho: Drawing, paredes: ParedesDoDesenho, segmento: SegmentoDeParede, indice: number): Wall {
  return {
    id: idDaParedePresa(desenho.id, indice),
    x1: segmento.x1,
    y1: segmento.y1,
    x2: segmento.x2,
    y2: segmento.y2,
    blocksLight: paredes.passagem === 'bloqueia',
    blocksMove: true,
    door: null,
    thickness: ESPESSURA_DA_PRESA,
    desenhoId: desenho.id,
    ...(paredes.invisivel ? { hidden: true } : {}),
    ...(paredes.cor === undefined ? {} : { color: paredes.cor }),
    ...(desenho.piso === undefined ? {} : { piso: desenho.piso }),
  }
}

/** Mesmo conteúdo, campo a campo (a presa nunca tem porta). */
function mesmaParede(a: Wall, b: Wall): boolean {
  return (
    a === b ||
    (a.id === b.id &&
      a.x1 === b.x1 &&
      a.y1 === b.y1 &&
      a.x2 === b.x2 &&
      a.y2 === b.y2 &&
      a.blocksLight === b.blocksLight &&
      a.blocksMove === b.blocksMove &&
      a.door === null &&
      b.door === null &&
      a.thickness === b.thickness &&
      a.desenhoId === b.desenhoId &&
      a.hidden === b.hidden &&
      a.color === b.color &&
      a.piso === b.piso &&
      a.janela === b.janela &&
      a.wallKind === b.wallKind &&
      a.lineStyle === b.lineStyle &&
      a.locked === b.locked &&
      a.regionId === b.regionId &&
      a.regionEdgeIndex === b.regionEdgeIndex)
  )
}

/**
 * As paredes do mapa com as presas de cada desenho trocadas pelas de `alvo`,
 * no lugar onde estavam (a ordem é a ordem de desenho e de clique). Presa de
 * desenho fora de `alvo` sai; desenho sem presas ainda as ganha no fim.
 */
function montarParedes(paredes: readonly Wall[], alvo: ReadonlyMap<string, readonly Wall[]>): Wall[] {
  const saida: Wall[] = []
  const postas = new Set<string>()
  for (const parede of paredes) {
    const dono = parede.desenhoId
    if (dono === undefined) {
      saida.push(parede)
      continue
    }
    const doDono = alvo.get(dono)
    if (doDono === undefined || postas.has(dono)) continue
    postas.add(dono)
    for (const presa of doDono) saida.push(presa)
  }
  for (const [dono, doDono] of alvo) {
    if (postas.has(dono)) continue
    for (const presa of doDono) saida.push(presa)
  }
  return saida
}

// ── Arrasto: o desenho só andou? ─────────────────────────────────────────────

/**
 * `depois` é o `antes` só arrastado (mesma forma, todos os pontos somados do
 * mesmo delta)? Devolve o delta; `{0, 0}` quando a forma é a mesma e nada
 * andou (mudou só cor, escolha de parede, piso); `null` quando a forma mudou.
 */
export function deslocamentoDoDesenho(antes: Drawing, depois: Drawing): { dx: number; dy: number } | null {
  if (formaDoDesenho(antes) !== formaDoDesenho(depois)) return null
  const a = posicaoDoDesenho(antes)
  const b = posicaoDoDesenho(depois)
  if (a === b) return { dx: 0, dy: 0 }
  if (a.length !== b.length || a.length === 0) return null
  const dx = b[0].x - a[0].x
  const dy = b[0].y - a[0].y
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null
  for (let i = 1; i < a.length; i += 1) {
    if (!(Math.abs(b[i].x - a[i].x - dx) <= FOLGA_DO_ARRASTO && Math.abs(b[i].y - a[i].y - dy) <= FOLGA_DO_ARRASTO)) return null
  }
  return { dx, dy }
}

/** O que diz a forma do contorno, fora a posição: espessura, ponta, textura, preenchimento, tamanho. */
function formaDoDesenho(desenho: Drawing): string {
  switch (desenho.kind) {
    case 'freehand':
      return `freehand|${desenho.width}|${desenho.cap}|${desenho.texture}`
    case 'line':
    case 'curve':
      return `${desenho.kind}|${desenho.width}|${desenho.cap}`
    case 'rect':
      return `rect|${desenho.width}|${desenho.filled}|${desenho.w}|${desenho.h}`
    case 'circle':
      return `circle|${desenho.width}|${desenho.filled}|${desenho.radius}`
    case 'ellipse':
      return `ellipse|${desenho.width}|${desenho.filled}|${desenho.rx}|${desenho.ry}`
    case 'polygon':
      return `polygon|${desenho.width}|${desenho.filled}`
    case 'text':
    case 'path':
      return desenho.kind
  }
}

/** Os pontos que somar o mesmo delta move (é o que `mapFactory.moveDrawing` faz). */
function posicaoDoDesenho(desenho: Drawing): readonly DrawingPoint[] {
  switch (desenho.kind) {
    case 'line':
      return [{ x: desenho.x1, y: desenho.y1 }, { x: desenho.x2, y: desenho.y2 }]
    case 'rect':
    case 'text':
      return [{ x: desenho.x, y: desenho.y }]
    case 'circle':
    case 'ellipse':
      return [{ x: desenho.cx, y: desenho.cy }]
    case 'freehand':
    case 'curve':
    case 'polygon':
    case 'path':
      return desenho.points
  }
}

// ── Arquivo e cópia de cena ──────────────────────────────────────────────────

/** Cor de parede no arquivo: só `#rrggbb`, a forma que o seletor de cor grava. */
const COR_HEX = /^#[0-9a-fA-F]{6}$/

/**
 * `Drawing.paredes` lido do arquivo: sem `ativo` booleano o campo some (o
 * desenho abre sem paredes ao redor); `invisivel` e `passagem` tortos voltam ao
 * padrão; cor fora de `#rrggbb` some (a cor padrão de parede). Texto e Caminho
 * perdem o campo. Campo certo = o MESMO desenho (o round-trip não muda nada).
 */
export function paredesDoDesenhoDoArquivo(desenho: Drawing): Drawing {
  if (desenho.paredes === undefined) return desenho
  const lidas = aceitaParedesAoRedor(desenho) ? lerParedes(desenho.paredes) : undefined
  if (lidas === undefined) {
    const sem = { ...desenho }
    delete sem.paredes
    return sem
  }
  return mesmoValorLido(desenho.paredes, lidas) ? desenho : { ...desenho, paredes: lidas }
}

function lerParedes(valor: unknown): ParedesDoDesenho | undefined {
  if (typeof valor !== 'object' || valor === null || !('ativo' in valor) || typeof valor.ativo !== 'boolean') return undefined
  const invisivel = 'invisivel' in valor && typeof valor.invisivel === 'boolean' ? valor.invisivel : PAREDES_DO_DESENHO_PADRAO.invisivel
  const passagem = 'passagem' in valor && (valor.passagem === 'bloqueia' || valor.passagem === 'janela') ? valor.passagem : PAREDES_DO_DESENHO_PADRAO.passagem
  const cor = 'cor' in valor && typeof valor.cor === 'string' && COR_HEX.test(valor.cor) ? valor.cor : undefined
  return { ativo: valor.ativo, invisivel, passagem, ...(cor === undefined ? {} : { cor }) }
}

/** O valor do arquivo já era exatamente o lido (nenhum campo a mais, nenhum diferente)? */
function mesmoValorLido(doArquivo: ParedesDoDesenho, lidas: ParedesDoDesenho): boolean {
  return Object.keys(doArquivo).length === Object.keys(lidas).length && mesmasEscolhas(doArquivo, lidas)
}

/**
 * Vínculo `Wall.desenhoId` lido do arquivo: parede presa a desenho que não
 * existe, que não tem as paredes ligadas ou que não aceita paredes perde o
 * vínculo e fica como parede comum — perder a parede seria perder o que o
 * mestre construiu. Nada a soltar = a MESMA lista.
 */
export function vinculosDeParedeDoArquivo(paredes: Wall[], desenhos: readonly Drawing[]): Wall[] {
  if (!paredes.some((parede) => parede.desenhoId !== undefined)) return paredes
  const comParedes = new Set(desenhos.filter(temParedesAoRedor).map((d) => d.id))
  let mudou = false
  const lidas = paredes.map((parede) => {
    if (parede.desenhoId === undefined) return parede
    if (typeof parede.desenhoId === 'string' && comParedes.has(parede.desenhoId)) return parede
    mudou = true
    const solta = { ...parede }
    delete solta.desenhoId
    return solta
  })
  return mudou ? lidas : paredes
}

/**
 * Presa na CÓPIA de uma cena inteira: passa a ser do desenho copiado
 * (`novoIdDoDesenho`), com o id determinístico dele, contando na ordem em que
 * aparecem (`contagem`, uma por cena copiada). Dono que não foi copiado = a
 * cópia fica como parede comum, que é como ela chega (`cloneWall` não leva o
 * vínculo).
 */
export function presaNaCopiaDaCena(copia: Wall, donoOriginal: string, novoIdDoDesenho: ReadonlyMap<string, string>, contagem: Map<string, number>): Wall {
  const novoDono = novoIdDoDesenho.get(donoOriginal)
  if (novoDono === undefined) return copia
  const indice = contagem.get(novoDono) ?? 0
  contagem.set(novoDono, indice + 1)
  return { ...copia, id: idDaParedePresa(novoDono, indice), desenhoId: novoDono }
}
