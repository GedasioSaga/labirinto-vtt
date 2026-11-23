import type { MecanicaV1 } from '../../../../lib/batalha/mecanica/modelo'
import type { FichaDaPrevia } from '../../../../lib/batalha/mecanica/resumo'
import type { CartaoDaFicha } from '../../../../lib/personagem'
import { SomaNoAcumulador } from '../../acumulador/SomaNoAcumulador'
import { BlocoDosEfeitos } from '../../blocos/BlocoDosEfeitos'

/**
 * LINHA EFEITOS (EDITOR.md §5): selo, cura, tirar selos, dreno, reviver e o
 * lembrete à mão, com as peças do selo de hoje (`PecasDoSelo`). ED6: e o
 * "+N <acumulador>" ao usar, gravado como regra do acumulador (o motor de hoje
 * roda); só aparece para o mestre editando a ficha. ED7: a regra do acumulador
 * é "usar a técnica", então a arma e o item não a têm (`comAcumulador`).
 */
export function LinhaDosEfeitos({ mecanica, cartao, ficha, comAcumulador = true, onChange }: { mecanica: MecanicaV1; cartao: CartaoDaFicha; ficha: FichaDaPrevia; comAcumulador?: boolean; onChange: (mecanica: MecanicaV1) => void }) {
  return (
    <>
      <BlocoDosEfeitos mecanica={mecanica} ficha={ficha} onChange={onChange} />
      {comAcumulador && <SomaNoAcumulador cartao={cartao} />}
    </>
  )
}
