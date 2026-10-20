import { useEffect, useRef } from 'react'
import { CampoCor } from './grimorio/CampoCor'
import { CampoSeg } from './grimorio/CampoSeg'
import { CampoDeCorComPipeta } from './CampoDeCorComPipeta'
import { MODELOS_DO_TETO, NOME_DO_MODELO, PALETA_DO_TETO, corDaPaleta, corPadraoDoModelo, type ModeloDoTeto } from '../lib/telhado/paletas'
import type { RoomRoofStylePatch } from '../lib/mapFactory'
import type { PontoDoTelhado } from '../lib/telhado/aguas'
import { pintarTelhado, type ImagemDoTelhado } from '../texturas/telhado'

/*
 * MODELO E COR DO TELHADO, no painel da Sala, logo abaixo de "Teto fechado
 * para jogadores" (só com o teto ligado): Telhas | Madeira, cada um com a
 * miniatura do próprio desenho (`texturas/telhado.ts`), e as 6 cores do
 * modelo mais "Outra cor…" com a pipeta e "Cor padrão" — o mesmo padrão da cor
 * do pino (`livro/CorETamanhoDoPino.tsx`). "Cor padrão" grava AUSENTE.
 */

/** Telhado de 48 × 28 px de mapa (mais o beiral): lê as fileiras e as tábuas sem virar mancha. */
const SALA_DA_MINIATURA: readonly PontoDoTelhado[] = [
  { x: 9, y: 9 },
  { x: 57, y: 9 },
  { x: 57, y: 37 },
  { x: 9, y: 37 },
]
/** Pixels por px do mapa na miniatura: nítida em tela de densidade 2. */
const ESCALA_DA_MINIATURA = 2

const miniaturas = new Map<string, ImagemDoTelhado>()

/** A miniatura de cada (modelo, cor), pintada uma vez por sessão: são ~6 mil pixels, menos de 1 ms. */
export function miniaturaDoTelhado(modelo: ModeloDoTeto, cor: string): ImagemDoTelhado {
  const chave = `${modelo}|${cor}`
  const pronta = miniaturas.get(chave)
  if (pronta !== undefined) return pronta
  const imagem = pintarTelhado(SALA_DA_MINIATURA, modelo, cor, ESCALA_DA_MINIATURA)
  miniaturas.set(chave, imagem)
  return imagem
}

/** A cor que o modelo `alvo` mostraria ao trocar: cor da paleta de agora vira a padrão dele; cor livre continua. */
export function corAoTrocarDeModelo(atual: ModeloDoTeto, cor: string, alvo: ModeloDoTeto): string {
  if (alvo === atual) return cor
  return corDaPaleta(atual, cor) !== null ? corPadraoDoModelo(alvo) : cor
}

function MiniaturaDoTelhado({ modelo, cor }: { modelo: ModeloDoTeto; cor: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const imagem = miniaturaDoTelhado(modelo, cor)
  useEffect(() => {
    const canvas = ref.current
    // Sem 2D (jsdom nos testes): o botão fica com o nome, sem desenho.
    const g = canvas === null || typeof ImageData === 'undefined' ? null : canvas.getContext('2d')
    if (g === null || imagem.largura === 0) return
    g.putImageData(new ImageData(new Uint8ClampedArray(imagem.pixels), imagem.largura, imagem.altura), 0, 0)
  }, [imagem])
  return <canvas ref={ref} className="lb-telhado__miniatura" width={imagem.largura} height={imagem.altura} aria-hidden="true" />
}

export interface EstiloDoTelhadoProps {
  /** Já resolvidos: `undefined` do mapa chega aqui como telha e a cor padrão do modelo. */
  modelo: ModeloDoTeto
  cor: string
  onChange: (patch: RoomRoofStylePatch) => void
}

export function EstiloDoTelhado({ modelo, cor, onChange }: EstiloDoTelhadoProps) {
  const opcoesDeModelo = MODELOS_DO_TETO.map((valor) => ({
    valor,
    rotulo: NOME_DO_MODELO[valor],
    icone: <MiniaturaDoTelhado modelo={valor} cor={corAoTrocarDeModelo(modelo, cor, valor)} />,
  }))
  const opcoesDeCor = PALETA_DO_TETO[modelo].map((c) => ({ valor: c.hex, nome: c.nome }))
  // Cor livre: a amostra de "Outra cor…" leva o aro de marcada, já que nenhuma da paleta está.
  const outra = corDaPaleta(modelo, cor) === null
  return (
    <div className="lb-telhado" data-testid="estilo-do-telhado">
      <CampoSeg rotulo="Modelo do telhado" opcoes={opcoesDeModelo} valor={modelo} onChange={(valor) => onChange({ modelo: valor })} forma="icone" />
      <CampoCor
        rotulo="Cor do telhado"
        opcoes={opcoesDeCor}
        valor={cor}
        onChange={(valor) => onChange({ cor: valor })}
        onPadrao={() => onChange({ cor: null })}
        extra={
          <CampoDeCorComPipeta
            className={outra ? 'gr-cor lb-pin-outra-cor lb-pin-outra-cor--marcada' : 'gr-cor lb-pin-outra-cor'}
            aria-label="Outra cor…"
            title="Outra cor…"
            rotuloDaPipeta="Pegar a cor do telhado no mapa"
            value={cor}
            onChange={(valor) => onChange({ cor: valor })}
          />
        }
      />
    </div>
  )
}
