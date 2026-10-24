import { useEffect, useState } from 'react'
import { type AvisoDePortaTrancada, textoDoAviso } from '../lib/avisosDaRotina'
import { usePatrulhaAndandoStore } from '../stores/patrulhaAndandoStore'
import { useRotinaAndandoStore } from '../stores/rotinaAndandoStore'
import { Botao } from './grimorio/Botao'
import { CloseIcon, LockIcon } from './icons'
import './AvisoDaRotina.css'

/** Quantos avisos à vista ao mesmo tempo; o resto vira "e mais N". */
export const AVISOS_A_VISTA = 3

/** Tira de `fechados` o que não está mais em `avisos`: a porta que trancar de novo avisa de novo. */
function soOsQueSeguem(fechados: ReadonlySet<string>, avisos: readonly AvisoDePortaTrancada[]): ReadonlySet<string> {
  if (fechados.size === 0) return fechados
  const presentes = new Set(avisos.map((a) => a.chave))
  const seguem = [...fechados].filter((chave) => presentes.has(chave))
  return seguem.length === fechados.size ? fechados : new Set(seguem)
}

/**
 * AVISO AO MESTRE (caminhos, F0): "Porta da sala Cozinha trancada: Guarda
 * parou" — o NPC que anda sozinho (rotina ou patrulha) e parou numa porta
 * trancada. Discreto, no canto de baixo à esquerda do mapa, acima da barra de
 * ferramentas e fora dos dois livros; no máximo 3 à vista e "e mais N". Some
 * sozinho quando a porta destranca ou o NPC passa (`lib/avisosDaRotina.ts`);
 * "Fechar" dispensa só aquele, até ele sumir e voltar.
 *
 * Só do mestre: lê os stores do editor, que nunca vão ao jogador.
 */
export function AvisoDaRotina() {
  const daRotina = useRotinaAndandoStore((estado) => estado.avisos)
  const daPatrulha = usePatrulhaAndandoStore((estado) => estado.avisos)
  const [fechados, setFechados] = useState<ReadonlySet<string>>(() => new Set())
  const avisos = daPatrulha.length === 0 ? daRotina : [...daRotina, ...daPatrulha]

  useEffect(() => {
    setFechados((antes) => soOsQueSeguem(antes, [...daRotina, ...daPatrulha]))
  }, [daRotina, daPatrulha])

  const abertos = avisos.filter((aviso) => !fechados.has(aviso.chave))
  if (abertos.length === 0) return null
  const aVista = abertos.slice(0, AVISOS_A_VISTA)
  const resto = abertos.length - aVista.length
  const fechar = (chave: string) => setFechados((antes) => new Set([...antes, chave]))

  return (
    // `div` com papel de região, e não `section`: as jornadas acham seções pela tag.
    <div className="lb-aviso-rotina" role="region" aria-label="Avisos dos NPCs">
      <ul className="lb-aviso-rotina__lista" aria-live="polite">
        {aVista.map((aviso) => {
          const texto = textoDoAviso(aviso)
          return (
            <li key={aviso.chave} className="lb-aviso-rotina__item">
              <span className="lb-aviso-rotina__icone">
                <LockIcon size={16} />
              </span>
              <span className="lb-aviso-rotina__texto">{texto}</span>
              <Botao soIcone tamanho="p" className="lb-aviso-rotina__fechar" aria-label={`Fechar aviso: ${texto}`} onClick={() => fechar(aviso.chave)}>
                <CloseIcon />
              </Botao>
            </li>
          )
        })}
      </ul>
      {resto > 0 && <p className="lb-aviso-rotina__mais">e mais {resto}</p>}
    </div>
  )
}
