import { useId, type ReactNode } from 'react'
import { Tecla } from './Botao'
import './grimorio.css'

export interface CabecaProps {
  /** `CabecaRetrato` (token) ou `CabecaMedalha` (os outros tipos e a ferramenta). */
  marca: ReactNode
  nome: string
  /** A linha de baixo ("Token", a dica da ferramenta). Vazia, sem `onde`, a cabeça fica numa linha só. */
  tipo?: string
  /** Onde o item está ("Armazém 3"); vem depois de " · " no tipo. */
  onde?: string
  /** Botões da direita: Apagar e Mais ações. */
  acoes?: ReactNode
  /**
   * Nome acessível das ações. Presente, a cabeça inteira vira a barra delas
   * (`toolbar`), descrita pelo nome e pelo tipo: o leitor de tela diz de quem
   * são o Apagar e o Mais ações.
   */
  rotuloDasAcoes?: string
  /** Tecla da ferramenta, no lugar das ações (ficha da ferramenta). */
  atalho?: string
  /**
   * O nome é o título da página (`h2`): quem navega por títulos chega na
   * ficha por ele. Sem isto ele é texto, como no cartão do pino do jogador.
   */
  comoTitulo?: boolean
  /** Dito só ao leitor de tela, antes do nome ("Ferramenta · "): o nome sozinho não diz que é a ferramenta na mão. */
  prefixoOculto?: string
}

/** Topo da ficha (o `.cabeca`): marca, nome em serifa, tipo e as ações. */
export function Cabeca({ marca, nome, tipo, onde, acoes, rotuloDasAcoes, atalho, comoTitulo = false, prefixoOculto }: CabecaProps) {
  const Nome = comoTitulo ? 'h2' : 'div'
  const textoId = useId()
  const linhaDoTipo = [tipo, onde].filter((parte) => parte !== undefined && parte !== '').join(' · ')
  const barra = rotuloDasAcoes === undefined ? {} : { role: 'toolbar', 'aria-label': rotuloDasAcoes, 'aria-describedby': textoId }
  return (
    <div className="gr-cabeca" {...barra}>
      {marca}
      {/* O espaço entre o nome e o tipo não aparece (são blocos), mas separa as palavras na descrição lida. */}
      <div id={textoId}>
        <Nome className="gr-cabeca__nome">
          {prefixoOculto && <span className="gr-sr">{prefixoOculto}</span>}
          {nome}
        </Nome>
        {linhaDoTipo !== '' && (
          <>
            {' '}
            <div className="gr-cabeca__tipo">{linhaDoTipo}</div>
          </>
        )}
      </div>
      {acoes && <div className="gr-cabeca__acoes">{acoes}</div>}
      {atalho && <Tecla>{atalho}</Tecla>}
    </div>
  )
}

/** Retrato redondo do token, na cor dele, com as iniciais. Decorativo: o nome está ao lado. */
export function CabecaRetrato({ cor, iniciais }: { cor: string; iniciais: string }) {
  return (
    <span className="gr-cabeca__retrato" style={{ background: cor }} aria-hidden="true">
      {iniciais}
    </span>
  )
}

/** Medalha de latão com o ícone do tipo. Decorativa: o nome está ao lado. */
export function CabecaMedalha({ children }: { children: ReactNode }) {
  return (
    <span className="gr-cabeca__med" aria-hidden="true">
      {children}
    </span>
  )
}
