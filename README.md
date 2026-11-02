# Amigo Secreto com QR

Página estática para sortear o amigo secreto da família e entregar o resultado por QR code, sem servidor. Roda inteira no celular do organizador.

## Como funciona
1. **Organizador** cadastra participantes (nome, família, e se é criança, quem é o responsável) e os dados do evento. Uma lista pronta pode ser carregada por um link privado `#setup=...`.
2. **Sortear** gera os pares respeitando: ninguém tira a si mesmo; ninguém tira alguém da própria família (opcional); responsável e criança nunca se tiram.
3. Para cada pessoa é gerado um **link secreto** `#t=<chave>.<iv>.<cifrado>`: o nome sorteado vai cifrado (AES-GCM) e a chave está dentro do próprio link. Ou seja, o QR é o segredo. O organizador não vê o resultado a não ser que escaneie o QR de alguém.
4. **Mostrar QRs um por um**: a tela diz "Vez de Marco", ele escaneia com a câmera, abre o link e toca no presente para revelar. Crianças aparecem logo após o responsável, que escaneia por elas.
5. **Lista de QRs**: reabrir o QR de quem faltou ou enviar o link por WhatsApp.

Nada sai do aparelho. O sorteio fica no armazenamento local do navegador; se for apagado, é preciso sortear de novo.

## Arquivos
- `index.html`, `styles.css`, `app.js`: o app.
- `qrcode.js`: pacote npm `qrcode` 1.5.4 (MIT) empacotado localmente a partir de `lib/browser.js`.

## Rodar localmente
```bash
cd ~/Desktop/AMIGO-SECRETO && python3 -m http.server 8766
```
A cifra usa WebCrypto, que exige HTTPS ou localhost.
