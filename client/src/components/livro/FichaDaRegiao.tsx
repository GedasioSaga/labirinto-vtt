import type { ReactNode } from 'react'
import { AREA_TRIGGER_LABELS } from '../../lib/areaTriggers'
import { AreaTriggerControls, type AreaTriggerControlsProps } from '../AreaTriggerControls'
import { Essencial } from '../grimorio/Cartoes'
import { Fichas } from '../grimorio/Ficha'
import { ItemTransformControls, type ItemTransformControlsProps } from '../ItemTransformControls'
import { FichaLembrada, type FichaLembradaProps } from './FichaLembrada'
import './fichaDoItem.css'

/*
 * FICHA DA REGIÃO QUE NÃO É SALA (fatia 16b; decisão 4.1: a gramática da
 * porta, sem perder controle). O essencial é o que a Sala tem na ficha
 * Aparência — Cor, Hachurado, Preenchido, Opacidade e o Avançado com a
 * Espessura do contorno, Cantos, Suavizar e "Criar parede na borda", como no
 * protótipo — e as fichas "Trava" (Travado e Oculto para jogadores; aberta,
 * gestos de mesa, como o "No mapa" do objeto) e "Gatilho" (o gatilho da área
 * e o Mostrar aos jogadores). A ferramenta Região segue com os blocos soltos.
 * Os controles e os handlers são os de antes.
 */

/** Chave da escolha lembrada de cada ficha: a família `lb-section:<id>` das seções recolhíveis. */
const PREFIXO_LEMBRADO = 'lb-section:ficha-regiao-'

export interface FichaDaRegiaoProps {
  /** Os blocos da aparência, montados pelo painel (os mesmos da Aparência da Sala). */
  aparencia?: ReactNode
  /** Travado e Oculto para jogadores da região. */
  trava?: ItemTransformControlsProps
  /** O gatilho da área. */
  gatilho?: AreaTriggerControlsProps
}

/** O que pesa na trava, numa palavra: oculta antes de travada. */
function resumoDaTrava({ locked, secret }: ItemTransformControlsProps): string {
  if (secret === true) return 'Oculta'
  return locked ? 'Travada' : 'Livre'
}

function FichaDaRegiaoLembrada(props: Omit<FichaLembradaProps, 'prefixo'>) {
  return <FichaLembrada prefixo={PREFIXO_LEMBRADO} {...props} />
}

export function FichaDaRegiao({ aparencia, trava, gatilho }: FichaDaRegiaoProps) {
  return (
    <section className="lb-ficha-da-regiao">
      {/* O título dos blocos de antes, só para o leitor de tela: a cabeça já diz o tipo. */}
      <h2 className="gr-sr">Região</h2>
      {aparencia !== undefined && <Essencial>{aparencia}</Essencial>}
      {(trava !== undefined || gatilho !== undefined) && (
        <Fichas>
          {trava !== undefined && (
            <FichaDaRegiaoLembrada id="trava" titulo="Trava" icone="cadeado" padrao resumo={resumoDaTrava(trava)}>
              <ItemTransformControls {...trava} semTitulo />
            </FichaDaRegiaoLembrada>
          )}
          {gatilho !== undefined && (
            <FichaDaRegiaoLembrada
              id="gatilho"
              titulo="Gatilho"
              icone="pulso"
              padrao={false}
              resumo={gatilho.kind === null ? 'Nenhum' : AREA_TRIGGER_LABELS[gatilho.kind]}
            >
              <AreaTriggerControls {...gatilho} />
            </FichaDaRegiaoLembrada>
          )}
        </Fichas>
      )}
    </section>
  )
}
