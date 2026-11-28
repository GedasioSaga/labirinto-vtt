import { NOME_DA_EXCECAO_MAX, type ExcecaoDoAnula } from '../../../../lib/batalha/anulaODano'
import { Escolher, Nota, Texto, TextoCurto } from './controlesDaPeca'
import { EXCECOES_NA_TELA, excecaoDoValor, valorDaExcecao } from './vocabulario'

/**
 * "A NÃO SER QUE O GOLPE TENHA" (pedido de 27/11/2026, "Intangível"): a exceção do "toma 0", igual no "Anula o
 * dano" das passivas e na condição Intangível. Nada, um tipo de dano ou elemento, ou um nome (o Haki); o que
 * ela quer dizer na batalha é o `golpeAtravessa` (`lib/batalha/anulaODano.ts`). Vai dentro de uma `Frase`.
 */
export function EscolherExcecao({ exceto, aoMudar }: { exceto: ExcecaoDoAnula | undefined; aoMudar: (exceto: ExcecaoDoAnula | undefined) => void }) {
  return (
    <>
      <Texto>a não ser que o golpe tenha</Texto>
      <Escolher rotulo="A não ser que o golpe tenha" valor={valorDaExcecao(exceto)} opcoes={EXCECOES_NA_TELA} onChange={(valor) => aoMudar(excecaoDoValor(valor, exceto))} />
      {exceto !== undefined && 'nome' in exceto && (
        <TextoCurto rotulo="Nome que atravessa" valor={exceto.nome} maximo={NOME_DA_EXCECAO_MAX} placeholder="Haki" onChange={(nome) => aoMudar({ nome })} />
      )}
    </>
  )
}

/** Onde o nome da exceção vale (só com a exceção por nome). */
export function NotaDaExcecao({ exceto }: { exceto: ExcecaoDoAnula | undefined }) {
  if (exceto === undefined || !('nome' in exceto)) return null
  return <Nota>O nome vale no nome da técnica, numa condição de quem bate ou numa forma ligada dele.</Nota>
}
