import { CORTE_DA_RACA_MAX } from '../../../../lib/batalha/mecanica/pecas'
import { Caixa, Escolher, Frase, Nota, Numero, Texto } from './controlesDaPeca'
import type { PropsDaPeca } from './registro'

/**
 * PASSIVA DE RAÇA (mecânica 4; `corpoRaca` do protótipo; só na passiva): sempre ligada, sem botão e sem
 * custo. Corta uma parte de todo dano que o dono recebe (antes do Escudo, decisão 13), soma dano nos
 * golpes físicos ou só nos corpo a corpo, e proíbe desviar (o dono ou quem ele acerta).
 */
export function PecaRaca({ peca, aoMudar }: PropsDaPeca<'raca'>) {
  return (
    <>
      <Frase>
        <Caixa rotulo="Corta" marcado={peca.corta} onChange={(corta) => aoMudar({ ...peca, corta })} />
        {peca.corta ? (
          <>
            <Numero rotulo="Porcentagem cortada" valor={peca.cortaPorcento} minimo={1} maximo={CORTE_DA_RACA_MAX} onChange={(cortaPorcento) => aoMudar({ ...peca, cortaPorcento })} />
            <Texto>% de todo dano que o dono recebe</Texto>
          </>
        ) : (
          <Texto>uma parte do dano recebido</Texto>
        )}
      </Frase>
      <Frase>
        <Caixa rotulo="Soma" marcado={peca.soma} onChange={(soma) => aoMudar({ ...peca, soma })} />
        {peca.soma ? (
          <>
            <Numero rotulo="Dano somado" valor={peca.somaValor} minimo={1} maximo={200} onChange={(somaValor) => aoMudar({ ...peca, somaValor })} />
            <Texto>no dano</Texto>
            <Escolher
              rotulo="Em que golpes"
              valor={peca.somaEm}
              opcoes={[
                { valor: 'fisico', rotulo: 'dos golpes físicos (Impacto, Cortante, Perfurante)' },
                { valor: 'corpo', rotulo: 'só dos golpes corpo a corpo' },
              ]}
              onChange={(somaEm) => aoMudar({ ...peca, somaEm })}
            />
          </>
        ) : (
          <Texto>dano nos golpes físicos</Texto>
        )}
      </Frase>
      <Frase>
        <Caixa rotulo="Não pode desviar:" marcado={peca.naoDesvia} onChange={(naoDesvia) => aoMudar({ ...peca, naoDesvia })} />
        {peca.naoDesvia && (
          <Escolher
            rotulo="Quem não pode desviar"
            valor={peca.naoDesviaQuem}
            opcoes={[
              { valor: 'dono', rotulo: 'o próprio dono (grande demais)' },
              { valor: 'alvo', rotulo: 'quem o dono acerta' },
            ]}
            onChange={(naoDesviaQuem) => aoMudar({ ...peca, naoDesviaQuem })}
          />
        )}
      </Frase>
      {!peca.corta && !peca.soma && !peca.naoDesvia && <Nota>Marque pelo menos uma das três: sem nenhuma, a raça não muda nada na batalha.</Nota>}
      <Nota>Sem botão e sem custo: vale desde o começo da batalha, como a raça na ficha.</Nota>
    </>
  )
}
