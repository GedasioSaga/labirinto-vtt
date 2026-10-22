// Entrada do pacote do protótipo (montar.cjs → index.html): a vitrine e o laboratório das provas.
import { instalarLaboratorio } from './laboratorio'
import { iniciar } from './pagina'

instalarLaboratorio()
iniciar().catch((erro: unknown) => {
  const aviso = document.querySelector<HTMLElement>('#aviso-global')
  if (aviso !== null) aviso.textContent = `A vitrine não abriu: ${erro instanceof Error ? erro.message : String(erro)}. Ela precisa de WebGL ligado no navegador.`
  document.documentElement.dataset.pronto = 'erro'
  throw erro
})
