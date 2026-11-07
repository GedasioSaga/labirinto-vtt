import { useState, type ReactNode } from 'react'
import { useDoSite, useSite } from './contexto'
import { tomDe } from './textos'

/**
 * O ROSTO DE UMA CONTA (07/11/2026): o círculo que aparece onde está a
 * pessoa — o menu da conta, quem está na mesa, o autor no chat, no mural e no
 * histórico. Com foto de perfil nesta mesa, a foto; sem foto, enquanto ela
 * carrega ou se ela não vier, a inicial no tom da conta (a mesma de sempre:
 * a foto fica por cima da inicial, então nada pisca vazio).
 *
 * Sempre `aria-hidden`: o nome da pessoa está no texto ao lado.
 */

/** O endereço da foto de perfil da conta na mesa aberta; `null` = a inicial. */
export function useFotoDaConta(contaId: string | null): string | null {
  const site = useSite()
  const campanhaId = useDoSite((estado) => estado.campanha?.campanhaId ?? null)
  const foto = useDoSite((estado) => (contaId === null ? null : (estado.campanha?.membros.find((membro) => membro.contaId === contaId)?.foto ?? null)))
  return campanhaId === null || foto === null ? null : site.fonte.enderecoDaFoto(campanhaId, foto)
}

export function inicialDe(nome: string): string {
  return nome.trim().slice(0, 1).toUpperCase()
}

interface PropsDoRosto {
  /** A conta (a foto vem dela); `null` = sem conta conhecida, só a inicial. */
  contaId: string | null
  nome: string
  /** De onde sai o tom da inicial; sem ele, da conta. */
  semente?: string
  className?: string
  /** O ponto de presença, quando há. */
  children?: ReactNode
}

export function Rosto({ contaId, nome, semente, className, children }: PropsDoRosto) {
  const endereco = useFotoDaConta(contaId)
  // A foto que não carregou (apagada, sem acesso): volta para a inicial até a conta ter outra.
  const [semImagem, setSemImagem] = useState<string | null>(null)
  const comFoto = endereco !== null && endereco !== semImagem
  return (
    <span className={className === undefined ? 'lo-av' : `lo-av ${className}`} data-tom={tomDe(semente ?? contaId ?? nome)} data-foto={comFoto ? '1' : undefined} aria-hidden="true">
      {inicialDe(nome)}
      {comFoto && <img className="lo-av__foto" src={endereco} alt="" draggable={false} decoding="async" onError={() => setSemImagem(endereco)} />}
      {children}
    </span>
  )
}
