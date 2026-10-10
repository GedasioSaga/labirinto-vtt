# Pacote de animações

Animações (e texturas da ferramenta Texturas) que chegam ao app **sem instalador novo**: ficam aqui, são compiladas
e assinadas por `scripts/pacote-animacoes.cjs` e publicadas na release
`animacoes` do GitHub. O app procura ao abrir e no botão "Procurar animações
novas".

```
client/src/animacoes/
  transicao/<id>.ts + <id>.json   transição de viagem (3D, tela cheia)
  porta/<id>.ts     + <id>.json   porta abrindo no mapa
  cenario/<id>.ts   + <id>.json   imagem do pino "!" animada
  textura/<id>.ts   + <id>.json   textura da ferramenta Texturas (ladrilho que repete)
```

- `<id>`: `a-z`, `0-9` e `-`, até 40. Não pode ser o id de uma embutida.
- `<id>.ts`: um `export default` com a função do tipo (contrato no README da
  pasta). O arquivo vira **um** módulo ES autocontido: pode importar código do
  app (é embutido no módulo), mas `three` só como `import type` — a cena recebe
  o `three` por parâmetro. Nada de `import()` dinâmico, CSS ou imagem.
- `<id>.json`: o `nome` que aparece no app (até 60 letras) e as durações do tipo
  (na textura, a `escala` do ladrilho).
- `<id>.test.ts` (teste) e `_<nome>.ts` (código que duas animações dividem,
  embutido em cada uma pelo import) ficam na mesma pasta e o script os ignora.
- `aprovadas.json`: a lista `"<tipo>/<id>"` do que o mestre APROVOU no
  protótipo. O `--publicar` envia só essas; o resto da pasta (protótipos em
  andamento) não vai ao GitHub. Aprovar = acrescentar a linha.

Publicar (pede a chave em `%USERPROFILE%\.tauri\labirinto.key`):

```
node scripts/pacote-animacoes.cjs             # compila, assina e confere; saída em client/dist-animacoes/
node scripts/pacote-animacoes.cjs --publicar  # idem + envia para o GitHub
```
