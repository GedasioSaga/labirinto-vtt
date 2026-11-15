import type { Graphics } from 'pixi.js'
import type { RegionPoint } from '../types/map'
import { AMOSTRA_DA_CURVA, curvaPelosPontos, decimarTraco } from '../lib/agua/forma'
import { COMPRIMENTO_MINIMO_DO_MURO_EM_CASAS, PONTOS_DO_MURO_MAX, simplificarEixo } from '../lib/mobilia/muroDeFogo'
import { useFerramentaDoMuroDeFogo } from '../stores/ferramentaDoMuroDeFogo'
import { useMapStore } from '../stores/mapStore'

/**
 * MURO DE FOGO NO EDITOR (pedido do mestre de 15/11/2026): com o Muro de fogo
 * escolhido na ferramenta Objeto, o canvas TRAÇA em vez de pôr caixa.
 *
 * - "À mão": o arrasto vira curva suave (a mesma conta do rio da Água,
 *   `lib/agua/forma.ts`: um ponto de controle a cada meia casa e a curva por
 *   eles), sem encaixe na grade. Soltar cria o muro.
 * - "Ponto a ponto": cada clique é um canto (com o encaixe do Objeto; Alt
 *   inverte), os trechos são retos e a prévia vai até o ponteiro. Duplo clique
 *   ou Enter fecha; Esc cancela; Backspace ou Ctrl+Z tira o último ponto.
 *
 * Aqui moram só os pontos do rascunho e a prévia (no `Graphics` de rascunho do
 * canvas, que o `clearDrafts` de lá limpa). Quem cria o objeto é `criar`
 * (`stores/mobiliaNoPonto.ts`), num passo só do desfazer. Trocar de objeto ou
 * de forma com um traçado aberto o descarta (`descartar`).
 */

/** Um ponto de controle do traço à mão a cada meia casa, como no rio. */
const PASSO_DOS_PONTOS_EM_CASAS = 0.5
/** Quanto a linha final pode sair da curva, em casas: tira os pontos que não fazem diferença. */
const AFINAR_EM_CASAS = 0.02
/** A prévia: a faixa de 1 casa em laranja ralo e a linha do meio. */
const COR_DA_PREVIA = 0xe8842c
const ALFA_DA_FAIXA = 0.3
const ALFA_DA_LINHA = 0.95
/** Linha do meio e bolinha dos cantos, em px de tela. */
const LINHA_PX = 2
const CANTO_PX = 4

export interface OpcoesDoGestoDoMuroDeFogo {
  /** O `Graphics` de rascunho do canvas. */
  rascunho: Graphics
  /** Px de tela por px de mundo, para a linha da prévia ter sempre a mesma grossura na tela. */
  escala: () => number
  /** Cria o muro pelo traço (px de mundo); `false` = curto demais, não criou. */
  criar: (pontos: readonly RegionPoint[]) => boolean
  avisar: (texto: string) => void
  /** O traçado aberto perdeu o sentido (trocou o objeto ou a forma): o canvas limpa os rascunhos. */
  descartar: () => void
}

export interface GestoDoMuroDeFogo {
  /** Botão esquerdo no mapa. `ponto` é o do ponteiro; `encaixado`, o mesmo com o encaixe do Objeto. */
  comecar: (ponto: RegionPoint, encaixado: RegionPoint) => void
  mover: (ponto: RegionPoint, encaixado: RegionPoint) => void
  /** Botão solto; `null` = solto fora do canvas (à mão, vale o que já foi riscado; ponto a ponto, o canto não entra). */
  soltar: (ponto: RegionPoint | null, encaixado: RegionPoint | null) => void
  /** O ponteiro ocioso: a prévia do ponto a ponto vai até ele. */
  pairar: (encaixado: RegionPoint) => void
  /** Quantos cantos o ponto a ponto aberto tem (0 = nenhum traçado aberto). */
  pontosDoTracado: () => number
  /** Duplo clique ou Enter: o ponto a ponto vira muro. */
  fechar: () => void
  tirarUltimoPonto: () => void
  /** Larga o rascunho sem criar nada (não limpa o `Graphics`: quem chama já limpou). */
  cancelar: () => void
  destruir: () => void
}

const AVISO_DO_CURTO = `O muro de fogo precisa de pelo menos ${COMPRIMENTO_MINIMO_DO_MURO_EM_CASAS} casa de comprimento. Trace um pouco mais longe.`

/** `[x, y, x, y...]` em pontos. */
function emPontos(xy: readonly number[]): RegionPoint[] {
  const pontos: RegionPoint[] = []
  for (let i = 0; i + 1 < xy.length; i += 2) pontos.push({ x: xy[i], y: xy[i + 1] })
  return pontos
}

/** O traço da mão como o muro o guarda: a curva suave pelos pontos de controle, afinada. */
export function curvaDoTracoAMao(bruto: readonly RegionPoint[], grade: number): RegionPoint[] {
  const controle = decimarTraco(bruto, grade * PASSO_DOS_PONTOS_EM_CASAS)
  if (controle.length < 2) return controle
  const curva = simplificarEixo(emPontos(curvaPelosPontos(controle, false, grade * AMOSTRA_DA_CURVA)), grade * AFINAR_EM_CASAS)
  // Acima do teto do arquivo a leitura cortaria pontos por conta própria: afina mais, até caber.
  let afinada = curva
  for (let tolerancia = grade * AFINAR_EM_CASAS * 2; afinada.length > PONTOS_DO_MURO_MAX; tolerancia *= 2) afinada = simplificarEixo(curva, tolerancia)
  return afinada
}

export function criarGestoDoMuroDeFogo(opcoes: OpcoesDoGestoDoMuroDeFogo): GestoDoMuroDeFogo {
  const { rascunho, escala, criar, avisar, descartar } = opcoes
  /** À mão: os pontos crus do arrasto em andamento (`null` = sem arrasto). */
  let bruto: RegionPoint[] | null = null
  /** Ponto a ponto: os cantos já postos e onde o próximo cairia (o ponteiro). */
  let cantos: RegionPoint[] = []
  let ponteiro: RegionPoint | null = null

  const grade = (): number => useMapStore.getState().map.grid

  function desenhar(linha: readonly RegionPoint[], comCantos: boolean): void {
    rascunho.clear()
    if (linha.length === 0) return
    const px = 1 / Math.max(escala(), 1e-6)
    if (linha.length >= 2) {
      linha.forEach((p, i) => (i === 0 ? rascunho.moveTo(p.x, p.y) : rascunho.lineTo(p.x, p.y)))
      rascunho.stroke({ width: grade(), color: COR_DA_PREVIA, alpha: ALFA_DA_FAIXA, cap: 'round', join: 'round' })
      linha.forEach((p, i) => (i === 0 ? rascunho.moveTo(p.x, p.y) : rascunho.lineTo(p.x, p.y)))
      rascunho.stroke({ width: LINHA_PX * px, color: COR_DA_PREVIA, alpha: ALFA_DA_LINHA, cap: 'round', join: 'round' })
    }
    if (!comCantos) return
    for (const canto of cantos) rascunho.circle(canto.x, canto.y, CANTO_PX * px).fill({ color: COR_DA_PREVIA, alpha: ALFA_DA_LINHA })
  }

  function desenharPontoAPonto(): void {
    const ultimo = cantos[cantos.length - 1]
    const comPonteiro = ponteiro !== null && ultimo !== undefined && (ponteiro.x !== ultimo.x || ponteiro.y !== ultimo.y)
    desenhar(comPonteiro && ponteiro !== null ? [...cantos, ponteiro] : cantos, true)
  }

  function largar(): void {
    bruto = null
    cantos = []
    ponteiro = null
  }

  /** Trocar de objeto ou de forma com o traçado aberto: ele não é mais deste gesto. */
  const aoTrocar = (): void => {
    if (bruto === null && cantos.length === 0) return
    descartar()
  }
  const pararDeOuvirOObjeto = useMapStore.subscribe((estado, antes) => {
    if (estado.mobiliaTipo !== antes.mobiliaTipo) aoTrocar()
  })
  const pararDeOuvirAForma = useFerramentaDoMuroDeFogo.subscribe((estado, antes) => {
    if (estado.forma !== antes.forma) aoTrocar()
  })

  return {
    comecar(ponto, encaixado) {
      if (useFerramentaDoMuroDeFogo.getState().forma === 'mao') {
        cantos = []
        bruto = [ponto]
        return
      }
      bruto = null
      ponteiro = encaixado
      desenharPontoAPonto()
    },
    mover(ponto, encaixado) {
      if (bruto !== null) {
        bruto.push(ponto)
        desenhar(curvaDoTracoAMao(bruto, grade()), false)
        return
      }
      ponteiro = encaixado
      desenharPontoAPonto()
    },
    soltar(ponto, encaixado) {
      if (bruto !== null) {
        if (ponto !== null) bruto.push(ponto)
        const curva = curvaDoTracoAMao(bruto, grade())
        largar()
        rascunho.clear()
        if (!criar(curva)) avisar(AVISO_DO_CURTO)
        return
      }
      if (encaixado === null) return
      const ultimo = cantos[cantos.length - 1]
      if (ultimo === undefined || ultimo.x !== encaixado.x || ultimo.y !== encaixado.y) cantos = [...cantos, encaixado]
      ponteiro = encaixado
      desenharPontoAPonto()
    },
    pairar(encaixado) {
      if (cantos.length === 0) return
      ponteiro = encaixado
      desenharPontoAPonto()
    },
    pontosDoTracado: () => cantos.length,
    fechar() {
      if (cantos.length === 0) return
      const linha = cantos
      largar()
      rascunho.clear()
      if (!criar(linha)) avisar(AVISO_DO_CURTO)
    },
    tirarUltimoPonto() {
      if (cantos.length === 0) return
      cantos = cantos.slice(0, -1)
      if (cantos.length === 0) ponteiro = null
      desenharPontoAPonto()
    },
    cancelar: largar,
    destruir() {
      largar()
      pararDeOuvirOObjeto()
      pararDeOuvirAForma()
    },
  }
}
