# Trabalho em paralelo com worktrees (camadas, Sons, Meio-Termo)

Aprovado pelo usuário em 23/10/2026. Ele afrouxou a regra de 27/09 ("tudo direto na main"): "não tenho problema com worktrees e várias branches, mas tem que tomar cuidado para não destruir tudo". A razão da regra antiga continua valendo e molda este plano: em setembro havia 818 branches e cerca de 120 worktrees, e a main ficava dias atrás. Por isso: poucas linhas, vida curta, main sempre em dia, sem pilha.

## Desenho

- **Tronco `main`** em `C:/dev/labirinto`: só o orquestrador (Claude principal) integra nela, e só o que passou nos testes. Exceção temporária: a fatia 3 das camadas termina na main onde está; da fatia 4 em diante as camadas também ganham worktree.
- **Linhas** (no máximo 3 escritores ao mesmo tempo): `feat/camadas` (a partir da fatia 4), `feat/sons-ao-vivo` em `C:/dev/labirinto-sons`, `feat/meio-termo` em `C:/dev/labirinto-meiotermo`. Cada uma com branch e worktree próprios, fora do repositório, preparados com `~/.claude/scripts/worktree-bootstrap.js` (junction de `node_modules`, `CARGO_TARGET_DIR` compartilhado, nunca copia `.env`).
- **Vida curta:** a branch de uma linha vive uma fatia (cerca de 2 h). Integrou, o orquestrador apaga a branch e o worktree e cria a próxima a partir da main nova. Limite duro: 3 worktrees de trabalho ao mesmo tempo, fora os 48 antigos que ficam como estão (decisão do usuário em 23/10: não mexer).
- **Portas:** o vite de cada worktree usa porta própria derivada do caminho (`client/porta.js`, de 1500 em diante); a main usa 1420. A suíte pesada continua UMA por vez na máquina inteira, sob o trinco `suite-lock.cjs`, entre todos os worktrees. Ganho esperado: cerca de 2x, não 3x. O custo em tokens é igual ou um pouco maior (merges).

## Integração na main (só o orquestrador, só na janela em que a linha de destino está parada)

1. A fatia da linha passa na revisão da própria linha (revisores e verificador).
2. Tag de volta na main (`pre-integra-<n>`) e, antes de cada integração, backup novo: `git bundle create C:/dev/labirinto-backup/<data>-<n>.bundle --all` (o primeiro, de 23/10, está verificado).
3. Dentro do worktree da linha: `git merge main`, resolver conflito ali, rodar tsc, os testes da linha, o golden de pixels e as 3 jornadas seladas de camada.
4. Só então a main avança com `git merge --ff-only`. Se algo falhar, volta-se pela tag. Nunca rebase de branch compartilhada e nunca force.
5. A fatia seguinte de cada linha nasce da main nova; assim os conflitos ficam pequenos.

## Trilhos de segurança

- **Agentes escritores proibidos de:** `git reset --hard`, `git clean`, `git checkout .` ou `git checkout -- <caminho>` fora de mutação própria restaurada, `git branch -D`, `git worktree remove` ou `prune`, `git push` de qualquer tipo, `git stash drop`, `rm -rf` fora de artefato que o próprio agente criou, tocar em outro worktree. Cada agente começa conferindo `git rev-parse --show-toplevel` e `git branch --show-current` contra a linha dele e PARA se forem outros.
- **Remoção de worktree** só pelo orquestrador, desfazendo antes cada junction de `node_modules` (senão o `node_modules` compartilhado é apagado, como já aconteceu).
- **`npm install`, `pip install` e `cargo` instalam** nunca dentro do worktree (a junction reescreve o `node_modules` da main).
- **Arquivos só do orquestrador, na main:** `scripts/portao-selo.json`, `docs/design/consolidado/PROGRESSO.md`, `PEDIDOS.md`, `HANDOFF.md`, `docs/diagrams/INDEX.md`. As linhas devolvem o texto; elas não editam esses arquivos.
- **Golden de pixels:** conflito em PNG nunca se resolve à mão; regrava-se rodando o spec sobre o resultado do merge, e só depois de a fase de camadas fechar (o Meio-Termo mantém a chave de obra desligada até lá).
- **Arquivos quentes** (conflito esperado no merge, não mais corrupção de commit): `types/map.ts`, `fogFilter.ts`, `hostSession.ts`, `mapStore.ts`, `lib/layers.ts`, `LivroDaMesa.tsx`, `keymap.ts`, `adventure.ts`, `PixiCanvas.tsx`, `PlayerView.tsx`, `App.tsx`. Quem terminar a fatia primeiro integra primeiro; as outras linhas fazem `git merge main` no começo da fatia seguinte.
- **Disco:** parar abaixo de 5 GB livres no C:. **Cota:** parar linhas novas quando a semana chegar a 85% (regra do usuário).
- **Os três itens sujos antigos** (`Minigames/`, `docs/verification/task4-e2e-evidencia.png`, `docs/design/telhado/provas/pagina-de-teste.html`) vivem só na main e nunca entram em commit.

## Pendências de integração já conhecidas

- A branch do motor de caminhamento dos NPCs (`worktree-wf_9821a8f8-eed-1`, 19 commits) entra pelo mesmo protocolo numa janela entre fatias, sem escritor novo.
- O selo das jornadas está velho para 67 de 100 jornadas; decisão do usuário pendente.
