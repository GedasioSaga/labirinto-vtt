import type { ReactNode } from 'react'
import { PORCENTO_DO_DANO_MAX, PORCENTO_DO_DANO_MIN, PORCENTO_MAX, type PecaDaCondicaoDa, type TipoDeDano } from '../../../../lib/condicoes/modelo'
import { Caixa, Escolher, Frase, Nota, Numero, Texto } from '../../../batalha/editor/pecas/controlesDaPeca'
import type { PropsDaPecaDaCondicao } from '../registro'
import './estilo'
import { tiposDeDanoNaTela } from './vocabulario'

type PecaDoDanoCura = PecaDaCondicaoDa<'danoCura'>
type CampoDoDanoCura = 'recV' | 'cauV' | 'curaV' | 'cddV'

/** O número com que cada linha liga (`pecaNova` do protótipo): toma 25% a mais, causa 20% a menos, recebe metade da cura, recupera 10%. */
const DE_PARTIDA: Readonly<Record<CampoDoDanoCura, number>> = { recV: 25, cauV: -20, curaV: -50, cddV: 10 }

const TIPOS_DO_DANO_RECEBIDO = tiposDeDanoNaTela('só de')

/** A peça com uma linha ligada neste número. */
function comCampo(peca: PecaDoDanoCura, campo: CampoDoDanoCura, valor: number): PecaDoDanoCura {
  const com: PecaDoDanoCura = { ...peca }
  com[campo] = valor
  return com
}

/** A peça sem uma linha (desligada = ausente). O "de que tipo" só existe com o dano recebido. */
function semCampo(peca: PecaDoDanoCura, campo: CampoDoDanoCura): PecaDoDanoCura {
  const sem: PecaDoDanoCura = { ...peca }
  delete sem[campo]
  if (campo === 'recV') delete sem.recTipo
  return sem
}

/** O tipo do dano recebido; o "qualquer" é o ausente (guarda só o que difere do padrão). */
function comTipo(peca: PecaDoDanoCura, tipo: TipoDeDano): PecaDoDanoCura {
  const com: PecaDoDanoCura = { ...peca }
  if (tipo === 'qualquer') delete com.recTipo
  else com.recTipo = tipo
  return com
}

interface LinhaProps {
  peca: PecaDoDanoCura
  campo: CampoDoDanoCura
  rotulo: string
  minimo: number
  maximo: number
  depois: string
  aoMudar: (peca: PecaDoDanoCura) => void
  children?: ReactNode
}

/** Uma linha: a caixa liga com o número de partida; o número fica ao lado enquanto estiver ligada. */
function Linha({ peca, campo, rotulo, minimo, maximo, depois, aoMudar, children }: LinhaProps) {
  const valor = peca[campo]
  return (
    <Frase>
      <Caixa rotulo={rotulo} marcado={valor !== undefined} onChange={(ligado) => aoMudar(ligado ? comCampo(peca, campo, DE_PARTIDA[campo]) : semCampo(peca, campo))} />
      {valor !== undefined && (
        <>
          <Numero rotulo={`${rotulo} em %`} valor={valor} minimo={minimo} maximo={maximo} onChange={(numero) => aoMudar(comCampo(peca, campo, numero))} />
          <Texto>{depois}</Texto>
          {children}
        </>
      )}
    </Frase>
  )
}

/**
 * DANO E CURA (`corpoDanoCura` do protótipo): muda em % o dano que recebe (de qualquer tipo ou só de um),
 * o dano que causa e a cura que recebe; ou recupera em vida parte do dano que causa. Cada linha desligada
 * fica de fora da peça.
 */
export function PecaDanoCura({ peca, aoMudar }: PropsDaPecaDaCondicao<'danoCura'>) {
  return (
    <>
      <Linha peca={peca} campo="recV" rotulo="Dano que recebe" minimo={PORCENTO_DO_DANO_MIN} maximo={PORCENTO_DO_DANO_MAX} depois="%" aoMudar={aoMudar}>
        <Escolher rotulo="De que tipo" valor={peca.recTipo ?? 'qualquer'} opcoes={TIPOS_DO_DANO_RECEBIDO} onChange={(tipo) => aoMudar(comTipo(peca, tipo))} />
      </Linha>
      <Linha peca={peca} campo="cauV" rotulo="Dano que causa" minimo={PORCENTO_DO_DANO_MIN} maximo={PORCENTO_DO_DANO_MAX} depois="%" aoMudar={aoMudar} />
      <Linha peca={peca} campo="curaV" rotulo="Cura que recebe" minimo={PORCENTO_DO_DANO_MIN} maximo={PORCENTO_DO_DANO_MAX} depois="%" aoMudar={aoMudar} />
      <Linha peca={peca} campo="cddV" rotulo="Recupera do dano que causa" minimo={1} maximo={PORCENTO_MAX} depois="%, em vida" aoMudar={aoMudar} />
      <Nota>−20 = 20% a menos; +50 = 50% a mais.</Nota>
    </>
  )
}
