import { Essencial } from '../grimorio/Cartoes'
import { Fichas } from '../grimorio/Ficha'
import { WallStyleControls, type WallStyleControlsProps } from '../WallStyleControls'
import { FichaLembrada, type FichaLembradaProps } from './FichaLembrada'
import './fichaDoItem.css'

/*
 * FICHA DA PAREDE (fatia 16a do design consolidado, docs/design/consolidado/PLANO.md;
 * decisão 4.1: a gramática da porta, sem perder controle). Abaixo da cabeça, o
 * essencial — Cor da parede, Espessura, Ajuste fino e o Avançado com "Ponta e
 * canto" — e as fichas recolhidas "O que a parede deixa" (Janela, Deixa passar,
 * Deixa ver) e "Tipo" (Parede interna). "Virar porta" mora no "Mais ações" da
 * cabeça (`virarPortaAction`). Os controles e os handlers são os de
 * `WallStyleControls`, que segue inteiro na ferramenta Parede e na ficha
 * "Parede em volta" da porta. Parede presa a um desenho não chega aqui: o
 * painel mostra só o aviso (`AvisoParedePresa`).
 */

/** Chave da escolha lembrada de cada ficha: a família `lb-section:<id>` das seções recolhíveis. */
const PREFIXO_LEMBRADO = 'lb-section:ficha-parede-'

export interface FichaDaParedeProps {
  /** A ligação da parede selecionada, com o Avançado ("Ponta e canto") montado pelo painel. */
  estilo: WallStyleControlsProps
}

/** O que atravessa a parede, numa palavra: a janela e as duas passagens. */
function resumoDoQueDeixa({ janela, passagem }: WallStyleControlsProps): string {
  const passa = passagem?.deixaPassar === true
  const ve = janela === true || passagem?.deixaVer === true
  if (passa && ve) return 'Ver e passar'
  if (passa) return 'Passar'
  if (janela === true) return 'Janela'
  return ve ? 'Ver' : 'Nada'
}

/** Ficha da parede com a escolha lembrada: todas nascem fechadas, como as da porta. */
function FichaDaParedeLembrada(props: Omit<FichaLembradaProps, 'prefixo' | 'padrao'>) {
  return <FichaLembrada prefixo={PREFIXO_LEMBRADO} padrao={false} {...props} />
}

export function FichaDaParede({ estilo }: FichaDaParedeProps) {
  // Sem os handlers da janela e da passagem a ficha não teria o que mostrar.
  const temOQueDeixa = estilo.onJanelaChange !== undefined || estilo.passagem !== undefined
  return (
    <section className="lb-ficha-da-parede">
      {/* O título que as jornadas procuram ("Parede"), só para o leitor de tela: a cabeça já diz o tipo. */}
      <h2 className="gr-sr">Parede</h2>
      <Essencial>
        <WallStyleControls {...estilo} parte="essencial" />
      </Essencial>
      <Fichas>
        {temOQueDeixa && (
          <FichaDaParedeLembrada id="deixa" titulo="O que a parede deixa" icone="olho" resumo={resumoDoQueDeixa(estilo)}>
            <WallStyleControls {...estilo} parte="deixa" />
          </FichaDaParedeLembrada>
        )}
        <FichaDaParedeLembrada id="tipo" titulo="Tipo" icone="parede" resumo={estilo.wallKind === 'interior' ? 'Interna' : 'Externa'}>
          <WallStyleControls {...estilo} parte="tipo" />
        </FichaDaParedeLembrada>
      </Fichas>
    </section>
  )
}
