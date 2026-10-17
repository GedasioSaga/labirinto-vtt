import type { FloorPiece } from '../../types/map'
import { Essencial } from '../grimorio/Cartoes'
import { Fichas } from '../grimorio/Ficha'
import { FloorPieceControls, SHAPE_TITLES, type FloorPieceControlsProps } from '../FloorPieceControls'
import { FichaLembrada, type FichaLembradaProps } from './FichaLembrada'
import './fichaDoItem.css'

/*
 * FICHA DA PEÇA DE CHÃO (fatia 16b do design consolidado; decisão 4.1: a
 * gramática da porta, sem perder controle). O essencial diz o que a peça faz
 * no chão — Travar peça, Operação (Somar ou Subtrair) e a Cor desta peça, com
 * o "Voltar à cor do chão" — e as fichas: "Medidas" (os campos da forma e a
 * Rotação; aberta, é o que se acerta depois de desenhar), "Borda" (Arredondar
 * e Borda irregular) e "Ordem" (Descer, Subir e o Apagar de antes; a cabeça
 * tem o seu). "Camadas do chão" segue no pé da ficha. Os controles e os
 * handlers são os de `FloorPieceControls`, que segue inteiro fora da ficha.
 */

/** Chave da escolha lembrada de cada ficha: a família `lb-section:<id>` das seções recolhíveis. */
const PREFIXO_LEMBRADO = 'lb-section:ficha-peca-de-chao-'

export interface FichaDaPecaDeChaoProps {
  controles: FloorPieceControlsProps
}

/** A borda numa palavra: a irregular vence a arredondada. */
function resumoDaBorda({ modifiers }: FloorPiece): string {
  if (modifiers.noise !== undefined) return 'Irregular'
  return (modifiers.rounding ?? 0) > 0 ? 'Arredondada' : 'Reta'
}

function FichaDaPecaLembrada(props: Omit<FichaLembradaProps, 'prefixo'>) {
  return <FichaLembrada prefixo={PREFIXO_LEMBRADO} {...props} />
}

export function FichaDaPecaDeChao({ controles }: FichaDaPecaDeChaoProps) {
  const { piece, index, count } = controles
  const forma = SHAPE_TITLES[piece.shape.kind]
  return (
    <section className="lb-ficha-da-peca-de-chao">
      {/* O título do bloco de antes, só para o leitor de tela: a cabeça já diz o tipo. */}
      <h2 className="gr-sr">Peça de chão · {forma}</h2>
      <Essencial>
        <FloorPieceControls {...controles} parte="essencial" />
      </Essencial>
      <Fichas>
        <FichaDaPecaLembrada id="medidas" titulo="Medidas" icone="regua" padrao resumo={forma}>
          <FloorPieceControls {...controles} parte="medidas" />
        </FichaDaPecaLembrada>
        <FichaDaPecaLembrada id="borda" titulo="Borda" icone="varinha" padrao={false} resumo={resumoDaBorda(piece)}>
          <FloorPieceControls {...controles} parte="borda" />
        </FichaDaPecaLembrada>
        <FichaDaPecaLembrada id="ordem" titulo="Ordem" icone="troca" padrao={false} resumo={`${index + 1} de ${count}`}>
          <FloorPieceControls {...controles} parte="ordem" />
        </FichaDaPecaLembrada>
      </Fichas>
    </section>
  )
}
