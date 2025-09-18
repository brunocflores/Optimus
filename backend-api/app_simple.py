from flask import Flask, jsonify, request
import yfinance as yf
import logging
from datetime import datetime, timedelta
import os

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

def get_stock_data(symbol):
    """Get stock data with caching"""
    cache_key = f"{symbol.upper()}.SA"
    
    # Check cache
    if cache_key in cache:
        cached_data, cached_time = cache[cache_key]
        if datetime.now() - cached_time < timedelta(seconds=CACHE_DURATION):
            logger.info(f"Cache hit for {symbol}")
            return cached_data
    
    try:
        logger.info(f"Fetching fresh data for {symbol}")
        
        # Use yfinance with simplified approach
        ticker = yf.Ticker(f"{symbol.upper()}.SA")
        
        # Get recent data
        hist = ticker.history(period="2d", interval="1d")
        
        if hist.empty:
            raise Exception(f"No data found for {symbol}")
        
        # Get current and previous price
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
            'source': 'Yahoo Finance (yfinance)',
            'isMocked': False
        }
        
        # Cache the result
        cache[cache_key] = (stock_data, datetime.now())
        
        logger.info(f"Successfully fetched {symbol}: R$ {current_price:.2f}")
        return stock_data
        
    except Exception as e:
        logger.error(f"Error fetching {symbol}: {str(e)}")
        raise

@app.route('/')
def home():
    """API status"""
    return jsonify({
        'status': 'OK',
        'message': 'Optimus Trading Stock API (Simple)',
        'version': '1.1.0',
        'cache_entries': len(cache)
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
            'message': 'Missing symbols parameter'
        }), 400
    
    symbols = [s.strip().upper() for s in symbols_param.split(',') if s.strip()]
    results = {}
    errors = []
    
    for symbol in symbols:
        try:
            stock_data = get_stock_data(symbol)
            results[symbol] = stock_data
        except Exception as e:
            errors.append(f"{symbol}: {str(e)}")
    
    return jsonify({
        'results': results,
        'total_requested': len(symbols),
        'total_successful': len(results),
        'errors': errors if errors else None
    })

@app.route('/api/cache/clear')
def clear_cache():
    """Clear cache"""
    global cache
    cache.clear()
    return jsonify({'message': 'Cache cleared'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    logger.info(f"Starting Simple Stock API on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)