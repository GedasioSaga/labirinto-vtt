import { useState } from 'react'
import { useImagemDaMesa } from './ImagemDaMesa'
import { iniciais, tomDoNome } from './FichaPecas'
import './miniaturaDoItem.css'

/**
 * A MINIATURA DO ITEM nos avisos de "você pegou" (pedido do mestre de
 * 21/11/2026: "quando a pessoa pegar o item aparece o mini icone também"): o
 * cartão "Abriu!" do baú, o aviso do item pego no chão (imagem ou estrelinha)
 * e o registro "Abertos agora" do mestre. A imagem vem da referência de mídia
 * que quem vê já recebeu junto do item; sem ela, ou se não carregar, as
 * iniciais no tom do nome.
 *
 * As iniciais saem do CSS (`data-iniciais`), não do texto: a linha do aviso
 * continua lendo só "Poção×1" ou "Poção está com você", para o leitor de tela
 * e para quem confere o texto.
 */
export function MiniaturaDoItem({ imagem, nome, className }: { imagem: string | undefined; nome: string; className?: string }) {
  const src = useImagemDaMesa()(imagem)
  const [falhou, setFalhou] = useState<string | null>(null)
  const comImagem = src !== null && falhou !== src
  return (
    <span className={className === undefined ? 'lb-miniatura' : `lb-miniatura ${className}`} data-tom={tomDoNome(nome)} data-iniciais={comImagem ? undefined : iniciais(nome)} aria-hidden="true">
      {comImagem && <img src={src} alt="" onError={() => setFalhou(src)} />}
    </span>
  )
}
