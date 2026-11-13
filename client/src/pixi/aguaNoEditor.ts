import type { Graphics } from 'pixi.js'
import type { Agua, RegionPoint } from '../types/map'
import { useMapStore } from '../stores/mapStore'
import { useFerramentaDaAgua } from '../stores/ferramentaDaAgua'
import { mapaDoPiso } from '../lib/pisos'
import { larguraDoRio, pontosMinimos, PONTOS_DO_TRACO_MAX, PONTOS_MAX, TRACOS_DE_AREIA_MAX } from '../lib/agua/dados'
import { aguaNoPonto, curvaDaAgua, curvaGuardada, curvaPelosPontos, decimarTraco, pontoNaAgua, AMOSTRA_DA_CURVA } from '../lib/agua/forma'
import { aguaComPincel, cantosDoPontoAPonto, naBordaDoMapa, retanguloDaAgua, type RetanguloDoMapa } from '../lib/agua/pincel'
import { arrastarBolinha, bolinhasDaForma, meiosDasBolinhas, moverForma, pontoDoMeio, pontoNoMeio, tirarBolinha } from '../lib/agua/bolinhas'
import { findNearestVertexHandleAt } from '../lib/handleHitArea'
import { mapBoundsRect } from './drawMapBounds'
import { CORNER_HANDLE_KEYLINE_COLOR, CORNER_HANDLE_KEYLINE_WIDTH, HANDLE_MIDPOINT_RADIUS, HANDLE_VISUAL_RADIUS, SELECTION_COLOR, STROKE_WEIGHT } from './constants'

/**
 * ÁGUA no editor: os gestos da ferramenta (pedido de 12/11/2026, protótipo
 * `docs/design/agua/`). O rio segue o traço da mão, no sentido da correnteza.
 * O lago e o mar nascem pela FORMA do painel (pedido "MAR MAIS FÁCIL",
 * 13/11/2026): à mão (o arrasto fecha a área ao soltar), retângulo (de canto
 * a canto) ou ponto a ponto (um clique por canto; duplo clique ou Enter fecha,
 * Esc cancela). O ponto que passa da borda do mapa fica na borda. Um clique
 * (sem arrastar) escolhe a água de cima no ponto, ou solta a escolhida. Delete
 * apaga a escolhida e Esc a solta.
 *
 * Na água escolhida (lago, mar e rio), BOLINHAS no contorno (no rio, no
 * traço): arrastar a bolinha muda a forma, arrastar o meio da linha cria uma
 * bolinha e já a arrasta, Alt+clique tira, arrastar dentro da água move a água
 * inteira (`lib/agua/bolinhas.ts`). Cada arrasto é UM passo do desfazer, e o
 * mapa muda no máximo uma vez por quadro durante ele.
 *
 * Com o pincel "Mais água / Menos água" do painel (lago e mar escolhidos), o
 * traço junta ou come área da escolhida ao soltar (`aguaComPincel`): a forma
 * volta a ser curva suave, sem buraco, e, se partir, fica o pedaço maior. Alt
 * troca o modo só no traço.
 *
 * Com o pincel "Tirar areia / Pôr areia" (só o mar escolhido), o traço entra
 * em `Agua.areia` ao soltar, um passo do desfazer; o desenho do mar lê a lista
 * (`pixi/aguaDoMapa.ts`). Alt troca o modo só no traço.
 *
 * O rascunho e o contorno da escolhida vão no `draftGraphics` do palco (fora
 * da imagem exportada), só com a ferramenta Água na mão.
 */

/** Distância entre os pontos de controle guardados, em casas (a curva suave sai deles). */
const PASSO_DOS_PONTOS = 0.5
/** Arrasto menor que isto (casas) é clique. */
const CLIQUE_ATE = 0.3
/** Dois cantos do ponto a ponto mais perto que isto (px de TELA) são um só: o duplo clique repete o último. */
const CANTOS_JUNTOS_PX = 8
/** O contorno da água escolhida: latão, como no protótipo. */
const COR_DA_ESCOLHIDA = 0xf3ba66
/** O rascunho do "Menos água": o escuro que come. */
const COR_DO_MENOS = 0x1b2a33
/** O rascunho do "Tirar areia" (a grama que encosta na água) e do "Pôr areia". */
const COR_DO_TIRAR_AREIA = 0x5f7a3a
const COR_DO_POR_AREIA = 0xd9c08c

export interface GestoDaAgua {
  /** `alt`: o Alt segurado no começo do gesto. */
  comecar: (p: RegionPoint, alt: boolean) => void
  mover: (p: RegionPoint) => void
  /** `null` = soltou fora do palco: o que já foi traçado vale. */
  soltar: (p: RegionPoint | null) => void
  /** O ponteiro parado (sem botão): a prévia do ponto a ponto segue ele. */
  pairar: (p: RegionPoint) => void
  /** Cantos do ponto a ponto em construção (0 = nenhum traçado aberto). */
  cantosDoTracado: () => number
  /** Duplo clique ou Enter: fecha o ponto a ponto. Com menos de 3 cantos avisa e deixa o traçado aberto. */
  fecharPontoAPonto: () => void
  /** Ctrl+Z/Backspace no ponto a ponto: tira o último canto. */
  tirarUltimoCanto: () => void
  /** Esc, troca de ferramenta: o gesto e o ponto a ponto abertos somem sem virar água. */
  cancelar: () => void
  emGesto: () => boolean
  /** Desenha de novo o contorno da escolhida (quem limpou o rascunho por fora chama). */
  redesenhar: () => void
  /** Delete com a ferramenta Água: apaga a escolhida. `false` = nenhuma escolhida. */
  apagarEscolhida: () => boolean
  /** Esc com a ferramenta Água: solta a escolhida. `false` = nenhuma. */
  soltarEscolhida: () => boolean
  /** O raio (px de mundo) do pincel na mão, para o anel em volta do ponteiro; `null` = sem pincel. */
  raioDoPincel: () => number | null
  destruir: () => void
}

/** O gesto do botão apertado. */
type Gesto =
  | { tipo: 'nenhum' }
  | { tipo: 'mao'; bruto: RegionPoint[] }
  | { tipo: 'retangulo'; de: RegionPoint; ate: RegionPoint }
  /** Um clique do ponto a ponto: o canto já entrou no apertar; o soltar só termina o toque. */
  | { tipo: 'canto' }
  /** O ponto a ponto sem traçado aberto, apertado numa água (ou com uma escolhida): o soltar escolhe ou solta. */
  | { tipo: 'escolher'; em: RegionPoint }
  /** Uma bolinha da escolhida na mão (`base` = os pontos do começo do arrasto, já com a bolinha nova do meio). */
  | { tipo: 'bolinha'; id: string; base: RegionPoint[]; antes: RegionPoint[]; marcadas: number[]; k: number; fechada: boolean; chave: string; mexeu: boolean }
  /** A escolhida inteira na mão; sem mexer, o soltar é um clique (escolhe no ponto). */
  | { tipo: 'mover'; id: string; base: RegionPoint[]; antes: RegionPoint[]; marcadas: number[]; de: RegionPoint; chave: string; mexeu: boolean }
  /** O apertar já fez o que tinha de fazer (Alt+clique tirou a bolinha): o soltar não faz nada. */
  | { tipo: 'feito' }
  /** O traço do pincel "Mais água / Menos água" na escolhida. */
  | { tipo: 'pincel-agua'; id: string; mais: boolean; raio: number; traco: RegionPoint[] }
  /** O traço do pincel "Tirar areia / Pôr areia" no mar escolhido. */
  | { tipo: 'pincel-areia'; id: string; modo: 'tirar' | 'por'; raio: number; traco: RegionPoint[] }

function corEmNumero(hex: string): number {
  const v = Number.parseInt(hex.slice(1, 7), 16)
  return Number.isFinite(v) ? v : 0x4b87a8
}

/** O retângulo e o ponto a ponto nascem de linhas retas: a curva suave de 4 pontos viraria uma bolha. */
const FORMA_RETA: Partial<Agua> = { reto: true }

/**
 * Os pontos que têm bolinha, pela identidade do objeto: o arrasto troca só os
 * pontos que mexeu, e o desfazer devolve os objetos de antes, então as
 * bolinhas não pulam de lugar depois de um arrasto nem de um Ctrl+Z.
 */
const comBolinha = new WeakSet<RegionPoint>()

/** Quais pontos da água têm bolinha, na ordem do contorno. Só olhar não muda ponto nenhum. */
function bolinhasDa(agua: Agua, grid: number): number[] {
  const fechada = agua.tipo !== 'rio'
  if (agua.reto === true) return agua.pontos.map((_, i) => i)
  const marcadas: number[] = []
  agua.pontos.forEach((p, i) => {
    if (comBolinha.has(p)) marcadas.push(i)
  })
  const ultimo = agua.pontos.length - 1
  if (marcadas.length >= (fechada ? 3 : 2) && (fechada || (marcadas[0] === 0 && marcadas[marcadas.length - 1] === ultimo))) return marcadas
  const novas = bolinhasDaForma(agua.pontos, fechada, grid, false)
  marcarBolinhas(agua.pontos, novas)
  return novas
}

/** Lembra quais pontos da lista nova têm bolinha. */
function marcarBolinhas(pontos: readonly RegionPoint[], marcadas: readonly number[]): void {
  for (const i of marcadas) {
    const p = pontos[i]
    if (p !== undefined) comBolinha.add(p)
  }
}

/** O pincel do painel que vale nesta água: o de água no lago e no mar, o de areia só no mar. `null` = bolinhas. */
function pincelDa(agua: Agua): 'agua' | 'areia' | null {
  const pincel = useFerramentaDaAgua.getState().pincel
  if (pincel === 'agua' && agua.tipo !== 'rio') return 'agua'
  if (pincel === 'areia' && agua.tipo === 'mar') return 'areia'
  return null
}

export function criarGestoDaAgua(dep: { rascunho: Graphics; avisar: (texto: string) => void }): GestoDaAgua {
  let gesto: Gesto = { tipo: 'nenhum' }
  /** A forma que espera o próximo quadro para entrar no mapa (no máximo uma mudança por quadro). */
  let pendente: { id: string; pontos: RegionPoint[]; chave: string } | null = null
  let quadro: number | null = null
  /** Cada arrasto tem a sua chave: é um passo só do desfazer, separado do arrasto seguinte. */
  let arrastos = 0
  /** Os cantos do ponto a ponto em construção (fica entre um clique e outro). */
  let cantos: RegionPoint[] = []
  /** Onde o ponteiro estava por último: a prévia do ponto a ponto vai até ele. */
  let cursor: RegionPoint | null = null

  const grid = (): number => useMapStore.getState().map.grid
  const escala = (): number => {
    const s = useMapStore.getState().camera.scale
    return Number.isFinite(s) && s > 0 ? s : 1
  }
  const borda = (): RetanguloDoMapa | null => mapBoundsRect(useMapStore.getState().map)
  const aguasDoPiso = (): readonly Agua[] => {
    const { map, pisoAtivo } = useMapStore.getState()
    return mapaDoPiso(map, pisoAtivo).aguas ?? []
  }
  const formaDoTipo = (): 'mao' | 'retangulo' | 'pontos' => {
    const f = useFerramentaDaAgua.getState()
    return f.tipo === 'rio' ? 'mao' : f.forma
  }
  /** O rascunho é do gesto (traço, retângulo, cantos): o contorno da escolhida espera. A bolinha e o mover desenham a escolhida. */
  const temRascunho = (): boolean =>
    cantos.length > 0 ||
    gesto.tipo === 'mao' ||
    gesto.tipo === 'retangulo' ||
    gesto.tipo === 'canto' ||
    gesto.tipo === 'pincel-agua' ||
    gesto.tipo === 'pincel-areia'

  const escolhidaNoPiso = (): Agua | undefined => {
    const id = useFerramentaDaAgua.getState().escolhida
    return id === null ? undefined : aguasDoPiso().find((a) => a.id === id)
  }

  /** O pincel do painel vale para esta água? Sem ele (ou no rio), a água mostra as bolinhas. */
  const comBolinhas = (agua: Agua): boolean => pincelDa(agua) === null

  const nomeDoTipo = (agua: Agua): string => (agua.tipo === 'rio' ? 'O rio' : agua.tipo === 'mar' ? 'O mar' : 'O lago')

  function descarregar(): void {
    if (quadro !== null) {
      cancelAnimationFrame(quadro)
      quadro = null
    }
    const x = pendente
    pendente = null
    if (x !== null) useMapStore.getState().mudarAgua(x.id, { pontos: x.pontos }, x.chave)
  }

  /** A forma nova entra no mapa no próximo quadro (a de antes, ainda esperando, é trocada por esta). */
  function mudarNoQuadro(id: string, pontos: RegionPoint[], chave: string): void {
    pendente = { id, pontos, chave }
    if (quadro === null)
      quadro = requestAnimationFrame(() => {
        quadro = null
        descarregar()
      })
  }

  function desenharBolinhas(agua: Agua): void {
    const g = dep.rascunho
    const s = escala()
    const marcadas = bolinhasDa(agua, grid())
    const fechada = agua.tipo !== 'rio'
    const faixa = CORNER_HANDLE_KEYLINE_WIDTH / s
    const raio = HANDLE_VISUAL_RADIUS / s
    const raioDoMeio = HANDLE_MIDPOINT_RADIUS / s
    const anel = STROKE_WEIGHT.thin / s
    for (const p of meiosDasBolinhas(agua.pontos, marcadas, fechada, agua.reto === true)) {
      g.circle(p.x, p.y, raioDoMeio + anel / 2 + faixa).fill({ color: CORNER_HANDLE_KEYLINE_COLOR })
      g.circle(p.x, p.y, raioDoMeio).stroke({ width: anel, color: SELECTION_COLOR })
    }
    for (const i of marcadas) {
      const p = agua.pontos[i]
      g.circle(p.x, p.y, raio + faixa).fill({ color: CORNER_HANDLE_KEYLINE_COLOR })
      g.circle(p.x, p.y, raio).fill({ color: SELECTION_COLOR })
    }
  }

  /**
   * Com a escolhida: a bolinha (Alt tira), o meio da linha (cria e arrasta) ou
   * o miolo da água (move tudo). `false` = o apertar não foi em nada dela.
   */
  function comecarNaEscolhida(p: RegionPoint, alt: boolean): boolean {
    const agua = escolhidaNoPiso()
    if (agua === undefined || !comBolinhas(agua)) return false
    const fechada = agua.tipo !== 'rio'
    const reto = agua.reto === true
    const marcadas = bolinhasDa(agua, grid())
    arrastos += 1
    const chave = `forma-${arrastos}`
    const naBolinha = findNearestVertexHandleAt(
      marcadas.map((i) => agua.pontos[i]),
      p,
      escala(),
    )
    if (naBolinha !== null) {
      if (alt) {
        const sem = tirarBolinha(agua.pontos, marcadas, naBolinha, fechada, pontosMinimos(agua.tipo))
        if (sem === null) dep.avisar(`${nomeDoTipo(agua)} precisa de pelo menos ${pontosMinimos(agua.tipo)} bolinhas.`)
        else {
          marcarBolinhas(sem.pontos, sem.marcadas)
          useMapStore.getState().mudarAgua(agua.id, { pontos: sem.pontos })
        }
        gesto = { tipo: 'feito' }
        return true
      }
      gesto = { tipo: 'bolinha', id: agua.id, base: agua.pontos, antes: agua.pontos, marcadas, k: naBolinha, fechada, chave, mexeu: false }
      return true
    }
    const naLinha = alt ? null : findNearestVertexHandleAt(meiosDasBolinhas(agua.pontos, marcadas, fechada, reto), p, escala())
    if (naLinha !== null) {
      const meio = pontoDoMeio(agua.pontos, marcadas, naLinha, fechada)
      if (meio !== null) {
        // Um ponto sem bolinha no meio do caminho: ele ganha a bolinha.
        const novas = [...marcadas.slice(0, naLinha + 1), meio, ...marcadas.slice(naLinha + 1)]
        gesto = { tipo: 'bolinha', id: agua.id, base: agua.pontos, antes: agua.pontos, marcadas: novas, k: naLinha + 1, fechada, chave, mexeu: false }
      } else {
        // As duas bolinhas são vizinhas na lista: um ponto novo entre elas (só entra no mapa se arrastar).
        const depoisDe = marcadas[naLinha]
        const novo = pontoNoMeio(agua.pontos, depoisDe, fechada, reto)
        const base = [...agua.pontos.slice(0, depoisDe + 1), novo, ...agua.pontos.slice(depoisDe + 1)]
        const deslocadas = marcadas.map((i) => (i > depoisDe ? i + 1 : i))
        const novas = [...deslocadas.slice(0, naLinha + 1), depoisDe + 1, ...deslocadas.slice(naLinha + 1)]
        gesto = { tipo: 'bolinha', id: agua.id, base, antes: agua.pontos, marcadas: novas, k: naLinha + 1, fechada, chave, mexeu: false }
      }
      return true
    }
    if (pontoNaAgua(agua, grid(), p.x, p.y)) {
      gesto = { tipo: 'mover', id: agua.id, base: agua.pontos, antes: agua.pontos, marcadas, de: { x: p.x, y: p.y }, chave, mexeu: false }
      return true
    }
    return false
  }

  /** O contorno da água escolhida (com a ferramenta Água na mão e sem gesto). */
  function desenharEscolhida(): void {
    const g = dep.rascunho
    g.clear()
    if (useMapStore.getState().activeTool !== 'agua') return
    const id = useFerramentaDaAgua.getState().escolhida
    const agua = id === null ? undefined : aguasDoPiso().find((a) => a.id === id)
    if (agua === undefined) return
    const xy = curvaGuardada(agua, grid())
    if (xy.length < 4) return
    g.moveTo(xy[0], xy[1])
    for (let i = 2; i + 1 < xy.length; i += 2) g.lineTo(xy[i], xy[i + 1])
    if (agua.tipo === 'rio') {
      g.stroke({ width: larguraDoRio(agua) * grid(), color: COR_DA_ESCOLHIDA, alpha: 0.18, cap: 'round', join: 'round' })
      g.moveTo(xy[0], xy[1])
      for (let i = 2; i + 1 < xy.length; i += 2) g.lineTo(xy[i], xy[i + 1])
    } else g.closePath()
    g.stroke({ width: Math.max(1.5, grid() * 0.04), color: COR_DA_ESCOLHIDA, alpha: 0.95, join: 'round' })
    if (comBolinhas(agua)) desenharBolinhas(agua)
  }

  /** A área do rascunho (lago e mar): preenchida e contornada na cor do painel. */
  function desenharArea(pts: readonly number[], fechar: boolean): void {
    const g = dep.rascunho
    const cor = corEmNumero(useFerramentaDaAgua.getState().cor)
    g.moveTo(pts[0], pts[1])
    for (let i = 2; i + 1 < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1])
    if (fechar) {
      g.closePath()
      g.fill({ color: cor, alpha: 0.4 })
    }
    g.stroke({ width: Math.max(1.5, grid() * 0.04), color: cor, alpha: 0.9, join: 'round' })
  }

  function desenharTraco(bruto: readonly RegionPoint[]): void {
    const g = dep.rascunho
    g.clear()
    if (bruto.length === 0) return
    const f = useFerramentaDaAgua.getState()
    const cor = corEmNumero(f.cor)
    const pts = curvaPelosPontos(decimarTraco(bruto, grid() * PASSO_DOS_PONTOS), f.tipo !== 'rio', grid() * AMOSTRA_DA_CURVA)
    if (pts.length < 4) {
      g.circle(bruto[0].x, bruto[0].y, f.tipo === 'rio' ? (f.largura * grid()) / 2 : grid() * 0.1).fill({ color: cor, alpha: 0.5 })
      return
    }
    if (f.tipo === 'rio') {
      g.moveTo(pts[0], pts[1])
      for (let i = 2; i + 1 < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1])
      g.stroke({ width: f.largura * grid(), color: cor, alpha: 0.55, cap: 'round', join: 'round' })
      return
    }
    desenharArea(pts, true)
  }

  function desenharRetangulo(de: RegionPoint, ate: RegionPoint): void {
    dep.rascunho.clear()
    const r = retanguloDaAgua(de, ate, borda())
    desenharArea(r.flatMap((p) => [p.x, p.y]), true)
  }

  /** O ponto a ponto aberto: os cantos, a linha até o cursor e a volta ao primeiro (tracejo leve). */
  function desenharCantos(): void {
    const g = dep.rascunho
    g.clear()
    if (cantos.length === 0) return
    const b = borda()
    const pts = cantos.map((c) => naBordaDoMapa(c, b))
    if (cursor !== null) pts.push(naBordaDoMapa(cursor, b))
    const cor = corEmNumero(useFerramentaDaAgua.getState().cor)
    const xy = pts.flatMap((p) => [p.x, p.y])
    if (pts.length >= 3) desenharArea(xy, true)
    else if (pts.length === 2) desenharArea(xy, false)
    const raio = 3.5 / escala()
    for (const c of cantos) {
      const p = naBordaDoMapa(c, b)
      g.circle(p.x, p.y, raio + 1.5 / escala()).fill({ color: 0x1e1e1e, alpha: 0.85 })
      g.circle(p.x, p.y, raio).fill({ color: cor })
    }
  }

  /** O pincel do painel na escolhida: qual, e o raio em px de mundo. `null` = bolinhas (ou o rio). */
  function pincelNaMao(): { qual: 'agua' | 'areia'; agua: Agua; raio: number } | null {
    const agua = escolhidaNoPiso()
    if (agua === undefined) return null
    const qual = pincelDa(agua)
    return qual === null ? null : { qual, agua, raio: (useFerramentaDaAgua.getState().tamanho * grid()) / 2 }
  }

  /** A cor do rascunho de cada pincel: a água que cresce, o escuro que come, a grama e a areia. */
  function corDoGesto(g: Gesto): number {
    if (g.tipo === 'pincel-areia') return g.modo === 'tirar' ? COR_DO_TIRAR_AREIA : COR_DO_POR_AREIA
    if (g.tipo === 'pincel-agua' && !g.mais) return COR_DO_MENOS
    const agua = escolhidaNoPiso()
    return corEmNumero(agua === undefined ? useFerramentaDaAgua.getState().cor : agua.cor)
  }

  /** A escolhida e, por cima, o traço do pincel. */
  function desenharPincelada(traco: readonly RegionPoint[], raio: number, cor: number): void {
    desenharEscolhida()
    const g = dep.rascunho
    if (traco.length === 1) {
      g.circle(traco[0].x, traco[0].y, raio).fill({ color: cor, alpha: 0.5 })
      return
    }
    g.moveTo(traco[0].x, traco[0].y)
    for (const q of traco.slice(1)) g.lineTo(q.x, q.y)
    g.stroke({ width: raio * 2, color: cor, alpha: 0.5, cap: 'round', join: 'round' })
  }

  /** O traço solto: a forma nova da escolhida, num passo do desfazer, com o porquê quando algo não ficou. */
  function aplicarPincelDeAgua(id: string, mais: boolean, raio: number, traco: readonly RegionPoint[]): void {
    const agua = aguasDoPiso().find((a) => a.id === id)
    if (agua === undefined) return
    const nome = agua.tipo === 'mar' ? 'O mar' : 'O lago'
    const r = aguaComPincel(curvaDaAgua(agua, grid()), traco, raio, mais, grid(), borda(), PONTOS_MAX)
    if (r.pontos === null) {
      dep.avisar(`${nome} sumiria inteiro. Para tirar a água, use Apagar.`)
      return
    }
    useMapStore.getState().mudarAgua(id, { pontos: r.pontos, reto: undefined })
    if (r.partiu) dep.avisar(`${nome} partiu em pedaços: ficou o maior.`)
    else if (r.buraco) dep.avisar(`${nome} não fica com buraco no meio: o furo foi fechado.`)
  }

  /** O traço do pincel de areia entra no fim da lista do mar (o último manda), num passo do desfazer. */
  function aplicarPincelDeAreia(id: string, modo: 'tirar' | 'por', raio: number, traco: readonly RegionPoint[]): void {
    const agua = aguasDoPiso().find((a) => a.id === id)
    if (agua === undefined || agua.tipo !== 'mar') return
    const antes = agua.areia ?? []
    if (antes.length >= TRACOS_DE_AREIA_MAX) {
      dep.avisar(`Este mar já tem ${TRACOS_DE_AREIA_MAX} traços de areia. Desfaça alguns para pintar mais.`)
      return
    }
    const pontos = traco.slice(0, PONTOS_DO_TRACO_MAX).map((q) => ({ x: Math.round(q.x * 10) / 10, y: Math.round(q.y * 10) / 10 }))
    useMapStore.getState().mudarAgua(id, { areia: [...antes, { modo, raio: Math.round(raio * 10) / 10, pontos }] })
  }

  function escolherNoPonto(p: RegionPoint): void {
    const agua = aguaNoPonto(aguasDoPiso(), grid(), p.x, p.y)
    useFerramentaDaAgua.getState().escolher(agua === null ? null : agua.id)
  }

  /** A água nova, com o que o painel diz, no mapa e escolhida. */
  function porAguaNova(pontos: RegionPoint[], extra: Partial<Agua>): void {
    const f = useFerramentaDaAgua.getState()
    const agua: Agua = {
      id: crypto.randomUUID(),
      tipo: f.tipo,
      pontos: pontos.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 })),
      cor: f.cor,
      ...(f.corPronta === null ? {} : { corPronta: f.corPronta }),
      ...(f.tipo === 'rio' ? { largura: f.largura } : {}),
      velocidade: f.velocidade,
      ondas: f.ondas,
      espuma: f.espuma,
      ...extra,
    }
    useMapStore.getState().porAgua(agua)
    f.escolher(agua.id)
  }

  function criarDaMao(bruto: readonly RegionPoint[]): void {
    const f = useFerramentaDaAgua.getState()
    const b = borda()
    const pontos = decimarTraco(
      bruto.map((p) => naBordaDoMapa(p, b)),
      grid() * PASSO_DOS_PONTOS,
    )
    if (pontos.length < pontosMinimos(f.tipo)) {
      dep.avisar(f.tipo === 'rio' ? 'Arraste um pouco mais para traçar o rio.' : 'Arraste o contorno em volta da área para fechar o lago ou o mar.')
      return
    }
    porAguaNova(pontos, {})
  }

  function criarRetangulo(de: RegionPoint, ate: RegionPoint): void {
    const r = retanguloDaAgua(de, ate, borda())
    const minimo = grid() * CLIQUE_ATE
    if (r[1].x - r[0].x < minimo || r[2].y - r[1].y < minimo) {
      dep.avisar('O retângulo ficou fino demais: arraste de um canto ao outro.')
      return
    }
    porAguaNova(r, FORMA_RETA)
  }

  function extensao(pts: readonly RegionPoint[]): number {
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const p of pts) {
      x0 = Math.min(x0, p.x)
      y0 = Math.min(y0, p.y)
      x1 = Math.max(x1, p.x)
      y1 = Math.max(y1, p.y)
    }
    return Math.max(x1 - x0, y1 - y0)
  }

  const cantosFechados = (): RegionPoint[] => cantosDoPontoAPonto(cantos, borda(), CANTOS_JUNTOS_PX / escala())

  // O contorno da escolhida segue o mapa, a escolha e a ferramenta.
  const soltarMapa = useMapStore.subscribe((s, antes) => {
    if (temRascunho()) return
    // O zoom muda o tamanho das bolinhas no mundo (elas têm tamanho fixo na tela).
    const zoom = s.camera.scale !== antes.camera.scale && s.activeTool === 'agua' && useFerramentaDaAgua.getState().escolhida !== null
    if (zoom || s.map !== antes.map || s.pisoAtivo !== antes.pisoAtivo || s.activeTool !== antes.activeTool) {
      if (s.activeTool === 'agua' || antes.activeTool === 'agua') desenharEscolhida()
    }
  })
  const soltarEscolha = useFerramentaDaAgua.subscribe((s, antes) => {
    if (!temRascunho() && (s.escolhida !== antes.escolhida || s.pincel !== antes.pincel)) desenharEscolhida()
  })

  return {
    comecar(p, alt) {
      const pincel = cantos.length === 0 ? pincelNaMao() : null
      if (pincel !== null) {
        // Alt troca o modo do painel só neste traço, lido no começo.
        const f = useFerramentaDaAgua.getState()
        const traco = [{ x: p.x, y: p.y }]
        if (pincel.qual === 'agua') gesto = { tipo: 'pincel-agua', id: pincel.agua.id, mais: (f.modoDaAgua === 'mais') !== alt, raio: pincel.raio, traco }
        else gesto = { tipo: 'pincel-areia', id: pincel.agua.id, modo: (f.modoDaAreia === 'tirar') !== alt ? 'tirar' : 'por', raio: pincel.raio, traco }
        desenharPincelada(traco, pincel.raio, corDoGesto(gesto))
        return
      }
      if (cantos.length === 0 && comecarNaEscolhida(p, alt)) return
      const forma = formaDoTipo()
      if (forma === 'pontos') {
        if (cantos.length === 0) {
          // Sem traçado aberto, o clique numa água a escolhe (e com uma escolhida, o clique fora a solta).
          const naAgua = aguaNoPonto(aguasDoPiso(), grid(), p.x, p.y)
          if (naAgua !== null || useFerramentaDaAgua.getState().escolhida !== null) {
            gesto = { tipo: 'escolher', em: { x: p.x, y: p.y } }
            return
          }
        }
        cantos = [...cantos, { x: p.x, y: p.y }]
        cursor = { x: p.x, y: p.y }
        gesto = { tipo: 'canto' }
        desenharCantos()
        return
      }
      if (forma === 'retangulo') {
        gesto = { tipo: 'retangulo', de: { x: p.x, y: p.y }, ate: { x: p.x, y: p.y } }
        desenharRetangulo(gesto.de, gesto.ate)
        return
      }
      gesto = { tipo: 'mao', bruto: [{ x: p.x, y: p.y }] }
      desenharTraco(gesto.bruto)
    },
    mover(p) {
      if (gesto.tipo === 'mao') {
        const u = gesto.bruto[gesto.bruto.length - 1]
        if (Math.hypot(p.x - u.x, p.y - u.y) < grid() * 0.08) return
        gesto.bruto.push({ x: p.x, y: p.y })
        desenharTraco(gesto.bruto)
      } else if (gesto.tipo === 'retangulo') {
        gesto.ate = { x: p.x, y: p.y }
        desenharRetangulo(gesto.de, gesto.ate)
      } else if (gesto.tipo === 'canto') {
        cursor = { x: p.x, y: p.y }
        desenharCantos()
      } else if (gesto.tipo === 'bolinha') {
        gesto.mexeu = true
        // A bolinha para na borda do mapa, como o ponto do traço novo.
        const pontos = arrastarBolinha(gesto.base, gesto.marcadas, gesto.k, naBordaDoMapa(p, borda()), gesto.fechada)
        marcarBolinhas(pontos, gesto.marcadas)
        mudarNoQuadro(gesto.id, pontos, gesto.chave)
      } else if (gesto.tipo === 'pincel-agua' || gesto.tipo === 'pincel-areia') {
        const u = gesto.traco[gesto.traco.length - 1]
        // Um ponto a cada quarto de raio: o traço não guarda cada passo do mouse.
        if (Math.hypot(p.x - u.x, p.y - u.y) < gesto.raio / 4) return
        gesto.traco.push({ x: p.x, y: p.y })
        desenharPincelada(gesto.traco, gesto.raio, corDoGesto(gesto))
      } else if (gesto.tipo === 'mover') {
        if (!gesto.mexeu && Math.hypot(p.x - gesto.de.x, p.y - gesto.de.y) < grid() * CLIQUE_ATE) return
        gesto.mexeu = true
        const pontos = moverForma(gesto.base, p.x - gesto.de.x, p.y - gesto.de.y)
        marcarBolinhas(pontos, gesto.marcadas)
        mudarNoQuadro(gesto.id, pontos, gesto.chave)
      }
    },
    soltar(p) {
      const g = gesto
      gesto = { tipo: 'nenhum' }
      if (g.tipo === 'canto') {
        desenharCantos()
        return
      }
      if (g.tipo === 'bolinha' || g.tipo === 'mover') {
        descarregar()
        // O mover sem mexer é um clique: escolhe a água de cima no ponto (pode ser outra).
        if (g.tipo === 'mover' && !g.mexeu) escolherNoPonto(g.de)
        desenharEscolhida()
        return
      }
      if (g.tipo === 'pincel-agua' || g.tipo === 'pincel-areia') {
        if (p !== null) g.traco.push({ x: p.x, y: p.y })
        if (g.tipo === 'pincel-agua') aplicarPincelDeAgua(g.id, g.mais, g.raio, g.traco)
        else aplicarPincelDeAreia(g.id, g.modo, g.raio, g.traco)
        desenharEscolhida()
        return
      }
      if (g.tipo === 'feito') {
        desenharEscolhida()
        return
      }
      if (g.tipo === 'mao') {
        if (p !== null) g.bruto.push({ x: p.x, y: p.y })
        if (extensao(g.bruto) < grid() * CLIQUE_ATE) escolherNoPonto(g.bruto[0])
        else criarDaMao(g.bruto)
      } else if (g.tipo === 'escolher') {
        escolherNoPonto(g.em)
      } else if (g.tipo === 'retangulo') {
        const ate = p ?? g.ate
        if (extensao([g.de, ate]) < grid() * CLIQUE_ATE) escolherNoPonto(g.de)
        else criarRetangulo(g.de, ate)
      }
      desenharEscolhida()
    },
    pairar(p) {
      cursor = { x: p.x, y: p.y }
      if (cantos.length > 0) desenharCantos()
    },
    cantosDoTracado: () => (cantos.length === 0 ? 0 : cantosFechados().length),
    fecharPontoAPonto() {
      if (cantos.length === 0) return
      const pontos = cantosFechados()
      const f = useFerramentaDaAgua.getState()
      if (pontos.length < 3) {
        const faltam = 3 - pontos.length
        dep.avisar(`O ${f.tipo === 'mar' ? 'mar' : 'lago'} precisa de 3 cantos para fechar: ${faltam === 1 ? 'falta 1' : `faltam ${faltam}`}.`)
        return
      }
      cantos = []
      gesto = { tipo: 'nenhum' }
      porAguaNova(pontos, FORMA_RETA)
      desenharEscolhida()
    },
    tirarUltimoCanto() {
      if (cantos.length === 0) return
      cantos = cantos.slice(0, -1)
      if (cantos.length > 0) desenharCantos()
      else desenharEscolhida()
    },
    cancelar() {
      const g = gesto
      if (g.tipo === 'bolinha' || g.tipo === 'mover') {
        // Esc no meio do arrasto: a forma volta à do começo, no mesmo passo do desfazer.
        pendente = null
        descarregar()
        if (g.mexeu) useMapStore.getState().mudarAgua(g.id, { pontos: g.antes }, g.chave)
      }
      if (!temRascunho() && g.tipo === 'nenhum') return
      gesto = { tipo: 'nenhum' }
      cantos = []
      desenharEscolhida()
    },
    emGesto: () => gesto.tipo !== 'nenhum',
    redesenhar() {
      if (cantos.length > 0) desenharCantos()
      else if (gesto.tipo === 'nenhum') desenharEscolhida()
    },
    apagarEscolhida() {
      const id = useFerramentaDaAgua.getState().escolhida
      if (id === null || !aguasDoPiso().some((a) => a.id === id)) return false
      useMapStore.getState().apagarAgua(id)
      useFerramentaDaAgua.getState().escolher(null)
      return true
    },
    raioDoPincel() {
      const pincel = pincelNaMao()
      return pincel === null ? null : pincel.raio
    },
    soltarEscolhida() {
      if (useFerramentaDaAgua.getState().escolhida === null) return false
      useFerramentaDaAgua.getState().escolher(null)
      return true
    },
    destruir() {
      if (quadro !== null) cancelAnimationFrame(quadro)
      quadro = null
      pendente = null
      soltarMapa()
      soltarEscolha()
      gesto = { tipo: 'nenhum' }
      cantos = []
    },
  }
}
