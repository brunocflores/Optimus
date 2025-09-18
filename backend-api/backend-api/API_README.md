# 🐍 Optimus Trading Stock API

Backend Python com Flask + yfinance para fornecer cotações reais de ações brasileiras.

## 🚀 Deploy no Railway

### **1. Criar Conta no Railway**
1. Acesse: https://railway.app
2. Faça login com GitHub
3. É gratuito até $5/mês de uso

### **2. Deploy Automático**
1. No Railway, clique **"New Project"**
2. Selecione **"Deploy from GitHub repo"**
3. Conecte seu repositório
4. Selecione a pasta **`backend-api`**
5. Railway detecta automaticamente Python
6. Deploy acontece em ~2-3 minutos

### **3. Configuração Automática**
- ✅ Python 3.11 detectado automaticamente
- ✅ requirements.txt instalado
- ✅ Gunicorn configurado via railway.toml
- ✅ Health check ativo
- ✅ HTTPS automático

### **4. URL da API**
Após deploy você receberá uma URL como:
```
https://seu-projeto-production.up.railway.app
```

## 📊 Endpoints Disponíveis

### **Status da API**
```
GET /
GET /api/health
```

### **Cotação Individual**
```
GET /api/stock/PETR4
```
Resposta:
```json
{
  "symbol": "PETR4",
  "price": 38.45,
  "change": 0.75,
  "changePercent": 1.99,
  "currency": "BRL",
  "timestamp": "2025-09-18T12:00:00",
  "source": "Yahoo Finance via yfinance"
}
```

### **Múltiplas Cotações**
```
GET /api/stocks?symbols=PETR4,VALE3,ITUB4
```
Resposta:
```json
{
  "results": {
    "PETR4": { ... },
    "VALE3": { ... },
    "ITUB4": { ... }
  },
  "total_requested": 3,
  "total_successful": 3
}
```

### **Cache Management**
```
GET /api/cache/status    # Ver status do cache
GET /api/cache/clear     # Limpar cache
```

## 🧪 Teste Local

```bash
# Instalar dependências
pip install -r requirements.txt

# Executar API
python app.py

# Testar endpoint
curl http://localhost:5000/api/stock/PETR4
```

## 🔧 Funcionalidades

### **Cache Inteligente**
- Cache de 5 minutos por símbolo
- Reduz chamadas para yfinance
- Performance otimizada

### **Tratamento de Erros**
- Logs detalhados
- Fallback para símbolos inválidos
- Rate limiting natural via cache

### **Símbolos Brasileiros**
- Adiciona `.SA` automaticamente
- Suporte a PETR4, VALE3, ITUB4, etc.
- Retorna dados em BRL

### **CORS Habilitado**
- Permite requisições do frontend
- Sem limitações de origem
- Headers configurados

## 🔄 Após Deploy

1. **Copie a URL** da API do Railway
2. **Atualize** o frontend para usar a nova URL
3. **Teste** as cotações em produção
4. **Monitore** os logs no Railway

## 📈 Monitoramento

### **Railway Dashboard**
- Logs em tempo real
- Uso de CPU/Memória
- Requests por minuto
- Uptime monitoring

### **Health Check**
```bash
curl https://sua-api.up.railway.app/api/health
```

## 💰 Custos

### **Railway (Gratuito)**
- 512MB RAM
- 1GB Storage
- $5 crédito gratuito/mês
- Mais que suficiente para a API

### **yfinance (Gratuito)**
- Sem limites de requisições
- Dados em tempo real
- Yahoo Finance oficial

---

## 🎯 **Próximo Passo**

Após deploy no Railway, copie a URL e atualize o frontend:
```javascript
// Em stock-api.js
const API_BASE_URL = 'https://sua-api.up.railway.app';
```

**🚀 Cotações 100% reais funcionando!**