# Portfolio Tracker PWA

Um aplicativo PWA profissional para acompanhamento de carteira de ações com design vaporwave e atualização em tempo real.

## ✨ Características

- 📱 **PWA (Progressive Web App)** - Instale no seu dispositivo
- 🎨 **Design Vaporwave** - Interface moderna com fundo preto e cores neon
- 📊 **Tempo Real** - Cotações atualizadas automaticamente
- 🔥 **Firebase** - Autenticação e banco de dados
- 📈 **P&L Tracking** - Acompanhe seus ganhos e perdas
- 💰 **Múltiplas Fontes** - Yahoo Finance + Alpha Vantage como backup

## 🚀 Tecnologias

- HTML5, CSS3, JavaScript ES6+
- Firebase (Auth + Firestore)
- Service Worker para funcionalidade offline
- API de cotações em tempo real

## 📋 Pré-requisitos

1. **Conta Firebase**: Crie um projeto em https://console.firebase.google.com
2. **Servidor HTTP**: Para servir o PWA localmente

## ⚙️ Configuração

### 1. Firebase Setup

1. Crie um projeto no Firebase Console
2. Ative Authentication (Email/Password)
3. Ative Firestore Database
4. Obtenha as credenciais do projeto
5. Substitua as configurações em `js/firebase-config.js`:

```javascript
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto-id",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def456"
};
```

### 2. Regras do Firestore

Configure as regras de segurança no Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /portfolio/{document} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
  }
}
```

### 3. Executar Localmente

```bash
# Instalar dependências (opcional)
npm install

# Servir o aplicativo (usando http-server)
npm start

# Ou use qualquer servidor HTTP
python -m http.server 3000
# ou
python3 -m http.server 3000
```

Acesse: http://localhost:3000

## 📱 Instalação como PWA

1. Abra o app no navegador
2. O navegador solicitará para instalar
3. Clique em "Instalar" para adicionar à tela inicial

## 🎨 Design Vaporwave

- **Fundo**: Preto com gradientes neon
- **Cores**: Rosa (#ff007f), Ciano (#00ffff), Roxo (#8a2be2), Amarelo (#ffff00)
- **Tipografia**: Orbitron (títulos) + Roboto Mono (corpo)
- **Efeitos**: Sombras neon, animações suaves, hover effects

## 📊 Funcionalidades

### Dashboard Principal
- P&L Total em tempo real
- Valor investido vs. valor atual
- Quantidade de ações em carteira
- Status do mercado (aberto/fechado)

### Gestão de Carteira
- Adicionar/remover ações
- Agrupamento automático por código
- Cálculo de preço médio
- P&L individual e percentual

### Cotações em Tempo Real
- Yahoo Finance (principal)
- Alpha Vantage (backup)
- Preços mock para desenvolvimento
- Atualização automática a cada 30 segundos

## 🏗️ Estrutura do Projeto

```
portfolio-tracker/
├── index.html              # Página principal
├── manifest.json           # Configuração PWA
├── sw.js                   # Service Worker
├── css/
│   └── styles.css          # Estilos vaporwave
├── js/
│   ├── app.js              # Aplicação principal
│   ├── auth.js             # Gerenciamento de autenticação
│   ├── portfolio.js        # Gestão de carteira
│   ├── stock-api.js        # APIs de cotação
│   └── firebase-config.js  # Configuração Firebase
├── icons/                  # Ícones PWA (precisa ser criado)
└── package.json           # Dependências
```

## 🔑 APIs de Cotação

### Yahoo Finance (Principal)
- Gratuita
- Dados em tempo real
- Suporte a ações brasileiras (.SA)

### Alpha Vantage (Backup)
- Requer API key gratuita
- Limite de requisições
- Configure em `stock-api.js`

### Dados Mock
- Para desenvolvimento/teste
- Variações aleatórias baseadas em preços reais
- Ativo quando APIs falham

## 📱 Responsividade

- Design mobile-first
- Breakpoints: 768px (tablet/desktop)
- Interface adaptada para touch
- PWA instalável em dispositivos móveis

## 🚀 Deploy

### GitHub Pages
```bash
npm run deploy
```

### Netlify/Vercel
1. Conecte o repositório
2. Build command: `npm run build`
3. Deploy directory: `.` (root)

### Firebase Hosting
```bash
firebase init hosting
firebase deploy
```

## 🛠️ Desenvolvimento

### Estrutura de Dados (Firestore)

```javascript
// Collection: portfolio
{
  userId: "user-uid",
  symbol: "PETR4",
  quantity: 100,
  purchasePrice: 35.50,
  purchaseDate: "2023-01-15",
  createdAt: "2023-01-15T10:00:00Z"
}
```

### Adicionando Novas Features

1. **Nova tela**: Adicione ao `index.html` e gerencie visibilidade
2. **Nova funcionalidade**: Estenda as classes em `js/`
3. **Novos estilos**: Adicione ao `css/styles.css` seguindo as variáveis CSS

## 📧 Suporte

Para dúvidas ou sugestões, abra uma issue no repositório.

## 📄 Licença

MIT License - veja LICENSE para detalhes.

---

**🌟 Portfolio Tracker - Acompanhe seus investimentos com estilo!**