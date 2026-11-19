import type { Carimbo, CarimboImportado, MapData } from '../types/map'
import type { Point } from './world'
import { criarSpray, criarTraco, idsDebaixoDaBorracha, raioDoSpray, tamanhoNatural, TETO_DE_CARIMBOS, type ResultadoDoCarimbo, type Spray } from '../lib/carimbos'
import { carimboDoCatalogo, tracoDoCarimbo } from '../carimbos/catalogo'
import { consultaDaTerra, unidadeDoRelevo } from '../lib/relevo'
import { visibleRegions } from '../lib/layers'
import { useMapStore } from '../stores/mapStore'
import { AVISO_CARIMBO_AUSENTE, AVISO_CARIMBO_NADA_A_APAGAR, AVISO_CARIMBO_TETO } from '../components/labels'

/**
 * O GESTO DA FERRAMENTA CARIMBOS no editor: o clique, o spray, o traço ou a
 * borracha de objetos. Saiu do `PixiCanvas.tsx` (máquina de gestos) no molde
 * de `neblinaNoEditor.ts`. O gesto em curso fica aqui, fora da store, e vira
 * mapa ao soltar: um Ctrl+Z por gesto. O spray e a borracha mostram a prévia no
 * renderer dos carimbos (`drawCarimbos.ts`), que é de quem chama.
 */

/** O tamanho natural de um carimbo da biblioteca, em px do protótipo; o importado usa o de um pinheiro. */
const TAMANHO_NATURAL_DO_IMPORTADO = 14

/**
 * Movimento mínimo, em px de TELA, para o clique virar spray: abaixo disso a
 * mão só tremeu no clique e sai um objeto só.
 */
const LIMIAR_DO_SPRAY_PX = 6

/** O que a tela diz depois de soltar o gesto da ferramenta Carimbos, ou `null` quando fez o que se pediu. */
function avisoDoCarimbo(resultado: ResultadoDoCarimbo): string | null {
  switch (resultado) {
    case 'nada-a-apagar':
      return AVISO_CARIMBO_NADA_A_APAGAR
    case 'tipo-ausente':
      return AVISO_CARIMBO_AUSENTE
    case 'teto':
      return AVISO_CARIMBO_TETO
    // A store já avisou qual camada segurou, com "Destravar".
    case 'camada-travada':
    case 'carimbou':
    case 'apagou':
      return null
  }
}

export interface GestoDoCarimbo {
  /** Começa o gesto no ponto (px de mundo); `tela` é o mesmo ponto em px de tela. Alt troca carimbo e borracha só neste gesto. */
  comecar: (p: Point, tela: Point, altKey: boolean) => void
  /** O ponteiro andou: o spray espalha pelo trecho; a borracha soma o que passa debaixo dela. */
  mover: (p: Point, tela: Point) => void
  /** Solta: o clique, o spray inteiro ou o caminho da borracha vira UMA mudança no mapa. `null` = soltou fora do canvas. */
  soltar: (last: { world: Point; screen: Point } | null) => void
  /** Esc ou troca de ferramenta: o spray (ou a borracha) cancelado não vira passo no mapa. */
  descartar: () => void
  /** Sem spray em curso: no gesto, é a borracha (o anel do Traço só aparece nela). */
  semSpray: () => boolean
}

export function criarGestoDoCarimbo(dep: {
  previa: {
    mostrar: (novos: readonly Carimbo[], apagando: ReadonlySet<string>, importados: readonly CarimboImportado[] | undefined) => void
    limpar: () => void
  }
  /** O mapa do piso em edição. */
  doPiso: (map: MapData) => MapData
  /** O anel do pincel em volta do ponteiro. */
  anel: (p: Point) => void
  /** Mostra o aviso, se ele já não estiver na tela. */
  avisar: (texto: string) => void
}): GestoDoCarimbo {
  let spray: Spray | null = null
  let borracha: Point[] = []
  let raio = 0
  /** Onde o gesto começou, em px de TELA (`LIMIAR_DO_SPRAY_PX`). */
  let inicioNaTela: Point | null = null
  /** Os carimbos que a borracha em curso vai apagar (somem da prévia já). */
  let apagando: Set<string> = new Set()

  const avisar = (resultado: ResultadoDoCarimbo): void => {
    const aviso = avisoDoCarimbo(resultado)
    if (aviso === null) return
    dep.avisar(aviso)
  }

  const mover = (worldPoint: Point, screen: Point): void => {
    dep.anel(worldPoint)
    const map = dep.doPiso(useMapStore.getState().map)
    if (spray === null) {
      const last = borracha[borracha.length - 1]
      if (last !== undefined && Math.hypot(worldPoint.x - last.x, worldPoint.y - last.y) < raio / 4) return
      // Só o trecho novo é conferido: mil objetos não pesam no arrasto.
      const trecho = last === undefined ? [worldPoint] : [last, worldPoint]
      borracha.push(worldPoint)
      const novos = idsDebaixoDaBorracha(map.carimbos, trecho, raio)
      if ([...novos].some((id) => !apagando.has(id))) {
        apagando = new Set([...apagando, ...novos])
        dep.previa.mostrar([], apagando, map.carimbosImportados)
      }
      return
    }
    // Abaixo do limiar a mão só tremeu no clique: continua um objeto só.
    const inicio = inicioNaTela
    if (!spray.espalhou() && inicio !== null && Math.hypot(screen.x - inicio.x, screen.y - inicio.y) < LIMIAR_DO_SPRAY_PX) return
    if (spray.passar(worldPoint).length > 0) dep.previa.mostrar(spray.soltos(), apagando, map.carimbosImportados)
  }

  return {
    /**
     * Carimbo: o primeiro objeto cai no ponto exato (o clique), e o spray só
     * espalha se a mão andar. Traço: o primeiro também, e o arrasto solta um a
     * cada passo fixo ao longo do caminho (`criarTraco`). Borracha (ou Alt):
     * guarda o caminho e apaga na prévia o que vai sair.
     */
    comecar(worldPoint, screen, alt) {
      const { map: mapaInteiro, carimboModo, carimboEscolhido, carimboTamanho, carimboLargura, carimboDensidade, carimboEspaco } = useMapStore.getState()
      // PISOS: a terra, os objetos que o spray evita e os que a borracha apaga são os do piso em edição.
      const map = dep.doPiso(mapaInteiro)
      const unidade = unidadeDoRelevo(map)
      raio = raioDoSpray(unidade, carimboLargura)
      inicioNaTela = screen
      if ((carimboModo === 'borracha') !== alt) {
        spray = null
        borracha = [worldPoint]
        apagando = idsDebaixoDaBorracha(map.carimbos, borracha, raio)
        dep.previa.mostrar([], apagando, map.carimbosImportados)
        return
      }
      borracha = []
      apagando = new Set()
      const existentes = map.carimbos ?? []
      const natural = carimboDoCatalogo(carimboEscolhido)?.tamanho ?? TAMANHO_NATURAL_DO_IMPORTADO
      const tamanho = tamanhoNatural(unidade, map.grid, natural, carimboTamanho)
      const vagas = TETO_DE_CARIMBOS - existentes.length
      let novo: Spray
      if (carimboModo === 'traco') {
        // O traço vai aonde a mão vai: sem a costa nem o espaço dos que já estão (a sebe por cima da
        // sebe, a trilha de pedras que entra na água). Barra e camada travada: o `carimbar` do soltar.
        novo = criarTraco({ tipo: carimboEscolhido, tamanho, espaco: carimboEspaco, jeito: tracoDoCarimbo(carimboEscolhido), vagas })
      } else {
        // A costa manda no spray: começou na terra, só põe na terra; no mar,
        // só no mar (pedras no mar). Sem terra no mapa, em qualquer lugar.
        const naTerra = consultaDaTerra(visibleRegions(map.regions, map.hiddenLayers))
        const comecouNaTerra = naTerra(worldPoint)
        novo = criarSpray({
          tipo: carimboEscolhido,
          tamanho,
          raio,
          densidade: carimboDensidade,
          existentes,
          aceita: (p) => naTerra(p) === comecouNaTerra,
          vagas,
        })
      }
      spray = novo
      novo.comecar(worldPoint)
      dep.previa.mostrar(novo.soltos(), apagando, map.carimbosImportados)
    },
    mover,
    soltar(last) {
      if (last !== null) mover(last.world, last.screen)
      const solto = spray
      const caminho = borracha
      spray = null
      borracha = []
      apagando = new Set()
      inicioNaTela = null
      dep.previa.limpar()
      const store = useMapStore.getState()
      if (solto !== null) {
        // O traço fecha o caminho até onde a mão soltou (o módulo que emenda ganha a ponta).
        solto.terminar(last === null ? null : last.world)
        const soltos = solto.soltos()
        // Nenhum objeto no gesto: a cena já estava no teto.
        avisar(soltos.length === 0 ? 'teto' : store.carimbar(soltos))
      } else if (caminho.length > 0) {
        avisar(store.apagarCarimbos(caminho, raio))
      }
    },
    descartar() {
      spray = null
      borracha = []
      apagando = new Set()
      inicioNaTela = null
      dep.previa.limpar()
    },
    semSpray: () => spray === null,
  }
}
