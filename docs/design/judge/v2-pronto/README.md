# Judge v2: modelo pronto

O Judge (o avatar do mestre na batalha) montado com modelos 3D grátis, de licença livre, e
ajustado à mão em three.js: o cavaleiro de armadura prateada vai sentado num falcão grande e
marrom, que faz o papel do grifo, com capa azul, chifres no elmo e o cartão vermelho.

## Como abrir

Dois cliques em `prototipo.html` (Chrome ou Edge do PC). Não precisa de servidor nem de
internet: os modelos estão dentro de `modelos-embutidos.js`.

A página tem três partes:

1. **O Judge de perto**: arraste para girar (setas também). `C` ergue e baixa o cartão, `F`
   volta para a vista de frente.
2. **A batalha falsa da v1**: 5 fichas, o Judge sai do token no canto. "Próxima vez" (`N`) o
   faz virar para quem tem a vez, "Desfazer" (`Z`) ergue o cartão, "Reiniciar" (`R`) começa de
   novo. Dá para arrastar as fichas e o próprio Judge. `M` troca entre o 3D ao vivo e os
   quadros da folha.
3. **A folha de quadros**: 8 direções, 12 quadros parado (respirando) e 8 erguendo o cartão,
   fotografados do mesmo 3D, com o peso em KB. Dá para ver em tamanho real e baixar o PNG.

"Movimento reduzido" segue a configuração do Windows e também pode ser ligado na página.

## De onde vieram os modelos

| Peça | Modelo | Autor | Licença | Link |
|---|---|---|---|---|
| Cavaleiro | "Knight" | Dawid2K | [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/) | https://poly.pizza/m/isC73B8SKq |
| Ave | "Hawk Lp Rigged" | Sherkiz | [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/) | https://poly.pizza/m/RkN6MEbP6g |
| Couraça e ombreiras | "Armor Metal" | Quaternius | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | https://poly.pizza/m/TMUoxiLh9w |

CC-BY pede crédito e aviso do que foi mudado. O que mudamos:

- **Cavaleiro**: cores trocadas por uma paleta nossa (aço prateado, braços de aço no lugar das
  mangas azuis, botas de aço escuro), metal e rugosidade por cor. A textura original era uma
  paleta de cores tirada de outro projeto; ela foi trocada e não vem nesta pasta. Posto sentado,
  com o braço direito que ergue o cartão e o esquerdo nas rédeas.
- **Ave**: textura recolorida para marrom (1024 px, JPEG), animação de voo retirada. Pescoço
  esticado, asas abertas para os lados, pernas e garras apoiadas no chão.
- **Couraça**: só a peça do peito, aumentada para virar as ombreiras grandes.
- **Feito aqui em three.js**: chifres, capa com dobras, cartão vermelho com brilho, elmo e
  rédeas da ave, manta da sela, penas fofas no peito, no pescoço e nas pernas, e a luz fria de
  contorno.

## Arquivos e peso

| Arquivo | Peso | O que é |
|---|---|---|
| `modelos/cavaleiro.glb` | 306 KB | o cavaleiro já recolorido |
| `modelos/ave.glb` | 675 KB | o falcão já recolorido |
| `modelos/armadura.glb` | 39 KB | a couraça |
| `modelos-embutidos.js` | 1,36 MB | os mesmos três `.glb` em base64, para abrir com dois cliques |
| `gltf-loader.js` | 47 KB | o leitor de `.glb` do three.js 0.186.1 (MIT), que o app ainda não tem |
| `modelo-judge-pronto.js` | | monta, pinta e posa o Judge |
| `prototipo.js` | | a página: vista, batalha e folha |

O three.js vem de `../vendor/three.min.js`, o mesmo da v1. A folha de 48 px por casa sai com
cerca de 1,1 MB em PNG.

## O que ainda fica abaixo da pintura

- A ave é um falcão low-poly esticado, não um grifo: a fofura das penas é só textura e tufos
  soltos, e o pescoço esticado estica um pouco a textura.
- Ela está de pé, parada, para caber no token. Na pintura ela salta, com as pernas recolhidas.
- A luz tem o contorno frio, mas não a névoa nem o contraste forte da pintura.
- A capa é uma folha com dobras simples; não esvoaça como na pintura.
- O cavaleiro tem 2 mil triângulos: as placas da armadura e o rosto do elmo são simples.
