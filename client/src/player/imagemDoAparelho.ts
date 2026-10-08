import { buildTokenPhotoData } from '../lib/tokenPhoto'

/**
 * Pede uma imagem ao aparelho do jogador (o seletor de arquivos do navegador)
 * e devolve a cópia pequena e embutida (`buildTokenPhotoData`: até 256 px e o
 * teto de envio da foto do token) — é quem escolhe que paga a redução, e o que
 * viaja já cabe numa mensagem da mesa. `null` = a pessoa cancelou.
 *
 * Chamar DENTRO do gesto (o toque em "Escolher retrato…"): fora dele o
 * navegador não abre o seletor. Navegador que não avisa o cancelar deixa a
 * promessa sem resposta, e nada espera por ela além do próprio botão.
 */
export function escolherImagemNoAparelho(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.addEventListener(
      'change',
      () => {
        const arquivo = input.files === null ? null : input.files.item(0)
        if (arquivo === null) resolve(null)
        else buildTokenPhotoData(arquivo).then(resolve, reject)
      },
      { once: true },
    )
    input.addEventListener('cancel', () => resolve(null), { once: true })
    input.click()
  })
}
