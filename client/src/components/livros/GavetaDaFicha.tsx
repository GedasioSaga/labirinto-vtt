import { aplicarAjustes, NOME_DO_MESTRE } from '../../lib/ajusteDaFicha'
import { escolherImagemDaFicha } from '../../lib/arquivosDaFicha'
import { soltarDoModelo } from '../../lib/livros/combate'
import { FORCA_PADRAO, type Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { useMundoDoLivroStore, usePersonagensDoMundo } from '../../stores/mundoDoLivroStore'
import { useToastStore } from '../../stores/toastStore'
import { FichaDePersonagemDialog } from '../FichaDePersonagemDialog'
import { gravarNoMundo, trocarFicha } from './comum'

/**
 * "Abrir ficha" no mundo do livro: a MESMA janela de ficha do app
 * (`FichaDePersonagemDialog`), só que o Salvar grava pelo funil do mundo
 * (`mundoDoLivroStore.mudar`, que passa por `editarRpgDaPasta`). Sem tokens
 * para ligar: o mundo não tem cena aberta.
 */

/**
 * As partes que a variação recebe do modelo (`sincronizarVariacoes`,
 * lib/livros/combate.ts). Só para AVISAR: mexer nelas na ficha da variação
 * some no próximo sincronismo, e o mestre precisa saber na hora.
 */
const PARTES_DO_MODELO = ['atributos', 'modificadoresDosAtributos', 'maximos', 'modificadoresDosRecursos', 'abas', 'escolhas', 'etiquetas', 'descricao'] as const

function mexeuNoQueVemDoModelo(antes: Personagem, salvo: Personagem): boolean {
  return PARTES_DO_MODELO.some((parte) => JSON.stringify(antes[parte]) !== JSON.stringify(salvo[parte]))
}

async function salvarNoMundo(salvo: Personagem, antes: Personagem, modelo: Personagem | undefined): Promise<void> {
  const gravou = await gravarNoMundo((lista) => trocarFicha(lista, salvo.id, () => salvo))
  if (!gravou || modelo === undefined || !mexeuNoQueVemDoModelo(antes, salvo)) return
  const modeloId = modelo.id
  useToastStore.getState().push('instrucao', `${salvo.nome} é variação de ${modelo.nome}: técnicas, atributos e máximos vêm do modelo, e a mudança nessas partes não ficou.`, undefined, {
    actions: [
      {
        label: 'Soltar do modelo e guardar',
        run: () =>
          void gravarNoMundo((lista) => trocarFicha(lista, salvo.id, () => soltarDoModelo(salvo)), {
            texto: `${salvo.nome} agora é NPC único, com a ficha que você salvou.`,
            desfazer: (lista) => trocarFicha(lista, salvo.id, (atual) => ({ ...atual, combate: { forca: atual.combate?.forca ?? FORCA_PADRAO, ...atual.combate, modeloId } })),
          }),
      },
    ],
  })
}

export interface GavetaDaFichaProps {
  sistema: SistemaDeRpg | undefined
  sistemaId: string
}

export function GavetaDaFicha({ sistema, sistemaId }: GavetaDaFichaProps) {
  const fichaAberta = useMundoDoLivroStore((state) => state.fichaAberta)
  const personagens = usePersonagensDoMundo()
  if (fichaAberta === null || personagens === null) return null
  const personagem = personagens.find((candidato) => candidato.id === fichaAberta.personagemId)
  if (personagem === undefined) return null
  const modeloId = personagem.combate?.modeloId
  const modelo = modeloId === undefined ? undefined : personagens.find((candidato) => candidato.id === modeloId)

  return (
    <FichaDePersonagemDialog
      key={personagem.id}
      personagem={personagem}
      sistema={sistema}
      sistemaId={sistemaId}
      editandoNoInicio={fichaAberta.editando}
      onSalvar={(salvo) => void salvarNoMundo(salvo, personagem, modelo)}
      onClose={() => useMundoDoLivroStore.getState().fecharFicha()}
      escolherImagem={escolherImagemDaFicha}
      tokens={[]}
      onLigarToken={() => undefined}
      onAjustar={
        sistema === undefined
          ? undefined
          : (ajuste) => void gravarNoMundo((lista) => trocarFicha(lista, personagem.id, (atual) => aplicarAjustes(atual, sistema, [ajuste], NOME_DO_MESTRE, Date.now())))
      }
    />
  )
}
