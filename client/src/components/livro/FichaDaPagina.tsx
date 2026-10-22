import { useEffect, useRef, type ReactNode } from 'react'
import { useAbertaGuardada } from '../CollapsibleSection'
import { Ficha } from '../grimorio/Ficha'
import { IconeDoLivro, type NomeDoIcone } from './icones'
import './paginas.css'

export interface FichaDaPaginaProps {
  /** Vira a chave `lb-section:<id>` e o `data-secao`: as mesmas da seção recolhível de antes. */
  id: string
  titulo: string
  icone: NomeDoIcone
  /** Aberta enquanto o mestre nunca abriu nem fechou esta ficha. */
  padrao: boolean
  /** O que há dentro, à vista com a ficha fechada ("3 pinos"). Fica fora do nome do cabeçalho. */
  resumo?: string
  /** Fechada, o miolo nem existe: lista longa (pinos, locais, objetos) fechada não custa nada a cada render do App. */
  lazy?: boolean
  /** Muda de valor para ABRIR a ficha de fora (o Ctrl+K); o valor da montagem não abre nada. */
  pedidoDeAbrir?: number
  children: ReactNode
}

/**
 * Ficha recolhível das páginas Cena e Aventura do livro do mestre (fatia 18):
 * o cartão do Grimório com a medalha e o resumo, no lugar da
 * `CollapsibleSection`, lembrando aberta/fechada na mesma chave de antes.
 */
export function FichaDaPagina({ id, titulo, icone, padrao, resumo, lazy = false, pedidoDeAbrir, children }: FichaDaPaginaProps) {
  const [aberta, setAberta] = useAbertaGuardada(id, padrao)
  /** Último pedido de abrir já atendido; o da montagem conta como atendido. */
  const pedidoVisto = useRef(pedidoDeAbrir)
  useEffect(() => {
    if (pedidoDeAbrir === pedidoVisto.current) return
    pedidoVisto.current = pedidoDeAbrir
    setAberta(true)
    // Fora das dependências: `setAberta` é refeita a cada render, e só o pedido novo abre.
  }, [pedidoDeAbrir])
  return (
    <Ficha titulo={titulo} icone={<IconeDoLivro nome={icone} />} resumo={resumo} resumoForaDoNome secao={id} aberta={aberta} onAlternar={setAberta}>
      {lazy && !aberta ? null : children}
    </Ficha>
  )
}
