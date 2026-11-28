/**
 * As VERSÕES do estandarte de pé (L03 do plano de arte por tema, 28/11/2026): a 1ª, a de hoje (a asna), é o desenho de
 * `MONTADORES` (`../estandarteDePe.ts`). As outras são o MESMO estandarte com os brasões da tapeçaria
 * (`tapecariaDeParedeVersoes.ts`): o leão, o dragão, a águia e a torre, da cor do pano, mais escura, no escudo de metal.
 *
 * A troca é a da tapeçaria: o desenho de hoje recebe uma fábrica de peças que entrega a figura no lugar da peça da asna
 * (semente `SEMENTE_DA_ASNA`), com o material, o tom e o chanfro dela. Lugares de material: os do estandarte (`pano`,
 * `madeira` e `metal`).
 */
import { dentroDe } from '../formas'
import type { MontarMovel } from '../contexto'
import { montarEstandarteDePe } from '../estandarteDePe'
import { escudoDoBrasao, FIGURAS, RECUO_DA_FIGURA, trocandoAPeca, type Figura } from './tapecariaDeParedeVersoes'
import type { VersoesDesenhadas } from '.'

/** A peça da asna no desenho de hoje (`../estandarteDePe.ts`): a que a figura substitui. */
const SEMENTE_DA_ASNA = 123
/** O escudo do estandarte (as medidas de `../estandarteDePe.ts`): o meio, em fração da altura, e a meia largura. */
const Y_DO_ESCUDO = 0.37
const MEIO_ESCUDO = 0.2
const MEIO_ESCUDO_PELA_ALTURA = 0.09
/** A figura no escudo: o centro um pouco abaixo do meio dele e a meia altura (em meias larguras do escudo). */
const DESCE_A_FIGURA = 0.12
const MEIA_ALTURA_DA_FIGURA = 0.96

function estandarteCom(figura: Figura): MontarMovel {
  return (c, cena) => {
    const me = Math.min(MEIO_ESCUDO * c.w, MEIO_ESCUDO_PELA_ALTURA * c.h)
    const ye = -c.hh + Y_DO_ESCUDO * c.h
    const carga = dentroDe(FIGURAS[figura](0, ye + me * DESCE_A_FIGURA, me * MEIA_ALTURA_DA_FIGURA), escudoDoBrasao(ye, me, RECUO_DA_FIGURA * 0.7))
    montarEstandarteDePe(trocandoAPeca(c, SEMENTE_DA_ASNA, carga), cena)
  }
}

export const versoesDoEstandarteDePe: VersoesDesenhadas = {
  leao: estandarteCom('leao'),
  dragao: estandarteCom('dragao'),
  aguia: estandarteCom('aguia'),
  torre: estandarteCom('torre'),
}
