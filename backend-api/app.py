# from flask import Flask, jsonify, request
import yfinance as yf
import logging
from datetime import datetime, timedelta
import os
import time
import random
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Lista de origens permitidas
origins = [
    "https://brunocflores.github.io",
    # Você pode adicionar outras origens se precisar, como o localhost para testes
    # "http://localhost",
    # "http://localhost:8080",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Permite todos os métodos (GET, POST, etc.)
    allow_headers=["*"], # Permite todos os cabeçalhos
)

# ... resto do seu código da API, com as rotas @app.get, @app.post, etc.
@app.get("/api/health")
def health_check():
    return {"status": "ok"}


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Extended cache to reduce Yahoo Finance calls
cache = {}
CACHE_DURATION = 600  # 10 minutes (updated per request)

# CORS headers for ALL responses
@app.after_request
def after_request(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,Accept,X-Requested-With'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
    response.headers['Access-Control-Allow-Credentials'] = 'false'
    response.headers['Access-Control-Max-Age'] = '3600'
    return response

# Handle all OPTIONS requests
@app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
@app.route('/<path:path>', methods=['OPTIONS'])
def handle_options(path):
    """Handle CORS preflight requests"""
    return '', 200

def get_stock_data_with_retry(symbol, max_retries=3):
    """Get stock data with exponential backoff retry - Updated for yfinance 0.2.66"""
    for attempt in range(max_retries):
        try:
            # Add random delay to avoid rate limiting
            if attempt > 0:
                delay = (2 ** attempt) + random.uniform(0, 1)  # Exponential backoff
                logger.info(f"Retry {attempt} for {symbol} - waiting {delay:.1f}s")
                time.sleep(delay)

            ticker = yf.Ticker(f"{symbol.upper()}.SA")
            hist = ticker.history(period="2d", interval="1d")

            if not hist.empty:
                return hist
            else:
                if attempt == max_retries - 1:
                    raise Exception(f"No data found for {symbol} after {max_retries} attempts")

        except Exception as e:
            if "429" in str(e) or "Too Many Requests" in str(e):
                if attempt == max_retries - 1:
                    raise Exception(f"Rate limit exceeded for {symbol} after {max_retries} attempts")
                logger.warning(f"Rate limit hit for {symbol}, attempt {attempt + 1}/{max_retries}")
            else:
                raise e

    raise Exception(f"Failed to fetch {symbol} after all retries")

def get_stock_data(symbol):
    """Get stock data using ONLY yfinance with retry logic"""
    cache_key = f"{symbol.upper()}.SA"
    
    # Check cache first (10 minute cache)
    if cache_key in cache:
        cached_data, cached_time = cache[cache_key]
        if datetime.now() - cached_time < timedelta(seconds=CACHE_DURATION):
            logger.info(f"Cache hit for {symbol} (age: {(datetime.now() - cached_time).seconds//60}min)")
            return cached_data
    
    logger.info(f"Fetching fresh data for {symbol} via yfinance (with retry)")
    
    # Use yfinance with retry logic
    hist = get_stock_data_with_retry(symbol)
    
    # Process the data - Updated for yfinance 0.2.66 (no Adj Close dependency)
    if 'Close' not in hist.columns:
        raise Exception(f"Close price not available for {symbol}")

    current_price = float(hist['Close'].iloc[-1])
    previous_close = float(hist['Close'].iloc[-2]) if len(hist) > 1 else current_price
    
    # Calculate change
    change = current_price - previous_close
    change_percent = (change / previous_close) * 100 if previous_close != 0 else 0
    
    stock_data = {
        'symbol': symbol.upper(),
        'price': round(current_price, 2),
        'change': round(change, 2),
        'changePercent': round(change_percent, 2),
        'currency': 'BRL',
        'timestamp': datetime.now().isoformat(),
        'source': 'Yahoo Finance (yfinance with retry)',
        'isMocked': False
    }
    
    # Cache the result for 10 minutes
    cache[cache_key] = (stock_data, datetime.now())

    logger.info(f"Successfully fetched {symbol}: R$ {current_price:.2f} (cached for 10min)")
    return stock_data

@app.route('/')
def home():
    """API status"""
    return jsonify({
        'status': 'OK',
        'message': 'Optimus Trading Stock API (yfinance 0.2.66)',
        'version': '1.4.0',
        'cache_entries': len(cache),
        'data_source': 'yfinance 0.2.66 - portfolio stocks only',
        'cache_duration_minutes': CACHE_DURATION // 60,
        'features': ['10min cache', 'portfolio-only fetching', 'no Adj Close dependency']
    })

@app.route('/api/health')
def health():
    """Health check"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'cache_entries': len(cache),
        'data_source': 'yfinance 0.2.66',
        'cache_duration_minutes': CACHE_DURATION // 60
    })

@app.route('/api/stock/<symbol>')
def get_single_stock(symbol):
    """Get single stock data"""
    try:
        stock_data = get_stock_data(symbol)
        return jsonify(stock_data)
    except Exception as e:
        logger.error(f"Error fetching {symbol}: {str(e)}")
        return jsonify({
            'error': True,
            'message': f'Failed to fetch {symbol}',
            'details': str(e),
            'note': 'Using yfinance 0.2.66 - no fallback available'
        }), 500

@app.route('/api/stocks')
def get_multiple_stocks():
    """Get multiple stocks data - Only for portfolio symbols"""
    symbols_param = request.args.get('symbols', '')

    if not symbols_param:
        return jsonify({
            'error': True,
            'message': 'Missing symbols parameter - provide only portfolio stocks'
        }), 400

    # Only process symbols that are provided (portfolio stocks only)
    symbols = [s.strip().upper() for s in symbols_param.split(',') if s.strip()]

    if len(symbols) > 20:  # Limit to 20 symbols max to avoid rate limiting
        return jsonify({
            'error': True,
            'message': 'Too many symbols requested. Maximum 20 portfolio stocks allowed.'
        }), 400

    results = {}
    errors = []

    logger.info(f"Fetching data for {len(symbols)} portfolio symbols: {symbols}")

    for symbol in symbols:
        try:
            stock_data = get_stock_data(symbol)
            results[symbol] = stock_data
        except Exception as e:
            errors.append(f"{symbol}: {str(e)}")
            logger.error(f"Error fetching portfolio symbol {symbol}: {str(e)}")

    return jsonify({
        'results': results,
        'total_requested': len(symbols),
        'total_successful': len(results),
        'errors': errors if errors else None,
        'data_source': 'yfinance 0.2.66 (portfolio stocks only)',
        'cache_duration_minutes': CACHE_DURATION // 60
    })

@app.route('/api/cache/clear')
def clear_cache():
    """Clear cache"""
    global cache
    cache.clear()
    return jsonify({'message': 'Cache cleared'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    logger.info(f"Starting yfinance 0.2.66 Stock API on port {port}")
    logger.info(f"Features: 10min cache, portfolio-only fetching, no Adj Close dependency")
    app.run(host='0.0.0.0', port=port, debug=False)