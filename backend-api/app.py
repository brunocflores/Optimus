from flask import Flask, jsonify, request
import requests
import logging
from datetime import datetime, timedelta
import os
import time

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Simple in-memory cache
cache = {}
CACHE_DURATION = 300  # 5 minutes

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

def get_stock_data_from_yahoo_direct(symbol):
    """Get stock data directly from Yahoo Finance"""
    try:
        # Yahoo Finance direct API (simple query)
        yahoo_symbol = f"{symbol.upper()}.SA"
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_symbol}"
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        logger.info(f"Fetching from Yahoo: {url}")
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            raise Exception(f"Yahoo API returned {response.status_code}")
        
        data = response.json()
        
        if not data.get('chart') or not data['chart'].get('result'):
            raise Exception("Invalid Yahoo Finance response structure")
        
        result = data['chart']['result'][0]
        meta = result.get('meta', {})
        
        current_price = meta.get('regularMarketPrice')
        previous_close = meta.get('previousClose', current_price)
        
        if current_price is None:
            raise Exception("No price data in Yahoo response")
        
        change = current_price - previous_close if previous_close else 0
        change_percent = (change / previous_close) * 100 if previous_close else 0
        
        return {
            'symbol': symbol.upper(),
            'price': round(float(current_price), 2),
            'change': round(float(change), 2),
            'changePercent': round(float(change_percent), 2),
            'currency': meta.get('currency', 'BRL'),
            'timestamp': datetime.now().isoformat(),
            'source': 'Yahoo Finance Direct',
            'isMocked': False
        }
        
    except Exception as e:
        logger.error(f"Yahoo Finance error for {symbol}: {str(e)}")
        raise

def get_mock_stock_data(symbol):
    """Generate realistic mock data as fallback"""
    base_prices = {
        'PETR4': 38.45, 'VALE3': 58.82, 'ITUB4': 32.25, 'BBDC4': 13.12,
        'ABEV3': 11.94, 'WEGE3': 51.95, 'MGLU3': 4.72, 'HYPE3': 22.98,
        'TAEE11': 35.32, 'TOTS3': 28.95, 'CMIG4': 10.92, 'BRAP4': 32.45
    }
    
    base_price = base_prices.get(symbol.upper(), 25.00)
    
    # Small random variation (±2%)
    import random
    variation = (random.random() - 0.5) * 0.04
    current_price = base_price * (1 + variation)
    
    change = current_price - base_price
    change_percent = (change / base_price) * 100
    
    return {
        'symbol': symbol.upper(),
        'price': round(current_price, 2),
        'change': round(change, 2),
        'changePercent': round(change_percent, 2),
        'currency': 'BRL',
        'timestamp': datetime.now().isoformat(),
        'source': 'Realistic Mock Data',
        'isMocked': True
    }

def get_stock_data(symbol):
    """Get stock data with caching and fallback"""
    cache_key = symbol.upper()
    
    # Check cache first
    if cache_key in cache:
        cached_data, cached_time = cache[cache_key]
        if datetime.now() - cached_time < timedelta(seconds=CACHE_DURATION):
            logger.info(f"Cache hit for {symbol}")
            return cached_data
    
    # Try to get real data first
    try:
        stock_data = get_stock_data_from_yahoo_direct(symbol)
        logger.info(f"Successfully fetched real data for {symbol}: R$ {stock_data['price']}")
    except Exception as e:
        logger.warning(f"Failed to get real data for {symbol}: {str(e)}")
        # Fall back to mock data
        stock_data = get_mock_stock_data(symbol)
        logger.info(f"Using mock data for {symbol}: R$ {stock_data['price']}")
    
    # Cache the result
    cache[cache_key] = (stock_data, datetime.now())
    return stock_data

@app.route('/')
def home():
    """API status"""
    return jsonify({
        'status': 'OK',
        'message': 'Optimus Trading Stock API (Working)',
        'version': '1.2.0',
        'cache_entries': len(cache),
        'note': 'Uses Yahoo Finance with fallback to realistic mock data'
    })

@app.route('/api/health')
def health():
    """Health check"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'cache_entries': len(cache)
    })

@app.route('/api/stock/<symbol>')
def get_single_stock(symbol):
    """Get single stock data"""
    try:
        stock_data = get_stock_data(symbol)
        return jsonify(stock_data)
    except Exception as e:
        logger.error(f"Error in get_single_stock for {symbol}: {str(e)}")
        return jsonify({
            'error': True,
            'message': f'Failed to fetch {symbol}',
            'details': str(e)
        }), 500

@app.route('/api/stocks')
def get_multiple_stocks():
    """Get multiple stocks data"""
    symbols_param = request.args.get('symbols', '')
    
    if not symbols_param:
        return jsonify({
            'error': True,
            'message': 'Missing symbols parameter. Use ?symbols=PETR4,VALE3'
        }), 400
    
    symbols = [s.strip().upper() for s in symbols_param.split(',') if s.strip()]
    results = {}
    errors = []
    
    for symbol in symbols:
        try:
            stock_data = get_stock_data(symbol)
            results[symbol] = stock_data
        except Exception as e:
            error_msg = f"{symbol}: {str(e)}"
            errors.append(error_msg)
            logger.error(error_msg)
    
    return jsonify({
        'results': results,
        'total_requested': len(symbols),
        'total_successful': len(results),
        'total_errors': len(errors),
        'errors': errors if errors else None
    })

@app.route('/api/cache/clear')
def clear_cache():
    """Clear cache"""
    global cache
    cache_size = len(cache)
    cache.clear()
    return jsonify({
        'message': f'Cache cleared. Removed {cache_size} entries.',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/cache/status')
def cache_status():
    """Get cache status"""
    cache_info = {}
    for symbol, (data, cached_time) in cache.items():
        cache_info[symbol] = {
            'cached_at': cached_time.isoformat(),
            'age_seconds': (datetime.now() - cached_time).total_seconds(),
            'price': data.get('price'),
            'source': data.get('source'),
            'is_mocked': data.get('isMocked', False)
        }
    
    return jsonify({
        'total_entries': len(cache),
        'cache_duration_seconds': CACHE_DURATION,
        'entries': cache_info
    })

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'error': True,
        'message': 'Endpoint not found',
        'available_endpoints': ['/', '/api/health', '/api/stock/<symbol>', '/api/stocks']
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'error': True,
        'message': 'Internal server error',
        'details': str(error)
    }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    logger.info(f"Starting Working Stock API on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)