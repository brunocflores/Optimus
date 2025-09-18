from flask import Flask, jsonify, request
from flask_cors import CORS
import yfinance as yf
import logging
from datetime import datetime, timedelta
import os
from threading import Timer
import json

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cache for stock data (in-memory for simplicity)
cache = {}
CACHE_DURATION = 300  # 5 minutes in seconds

def is_cache_valid(symbol):
    """Check if cached data is still valid"""
    if symbol not in cache:
        return False
    
    cache_time = cache[symbol].get('cached_at')
    if not cache_time:
        return False
    
    return datetime.now() - cache_time < timedelta(seconds=CACHE_DURATION)

def get_stock_data(symbol):
    """Get stock data from yfinance with caching"""
    # Add .SA suffix for Brazilian stocks if not present
    if not symbol.endswith('.SA') and len(symbol) <= 6:
        yf_symbol = f"{symbol}.SA"
    else:
        yf_symbol = symbol
    
    # Check cache first
    if is_cache_valid(yf_symbol):
        logger.info(f"Returning cached data for {yf_symbol}")
        return cache[yf_symbol]['data']
    
    try:
        # Fetch from yfinance
        logger.info(f"Fetching fresh data for {yf_symbol}")
        ticker = yf.Ticker(yf_symbol)
        
        # Get current data and history for change calculation
        info = ticker.info
        hist = ticker.history(period="2d")
        
        if hist.empty:
            raise Exception(f"No data found for symbol {yf_symbol}")
        
        # Get current price and previous close
        current_price = float(hist['Close'].iloc[-1])
        previous_close = float(hist['Close'].iloc[-2]) if len(hist) > 1 else current_price
        
        # Calculate change
        change = current_price - previous_close
        change_percent = (change / previous_close) * 100 if previous_close != 0 else 0
        
        # Get additional info
        currency = info.get('currency', 'BRL')
        
        stock_data = {
            'symbol': symbol,  # Return original symbol
            'yf_symbol': yf_symbol,
            'price': round(current_price, 2),
            'change': round(change, 2),
            'changePercent': round(change_percent, 2),
            'currency': currency,
            'timestamp': datetime.now().isoformat(),
            'source': 'Yahoo Finance via yfinance',
            'isMocked': False
        }
        
        # Cache the data
        cache[yf_symbol] = {
            'data': stock_data,
            'cached_at': datetime.now()
        }
        
        logger.info(f"Successfully fetched {yf_symbol}: R$ {current_price:.2f} ({change_percent:+.2f}%)")
        return stock_data
        
    except Exception as e:
        logger.error(f"Error fetching data for {yf_symbol}: {str(e)}")
        raise

@app.route('/')
def home():
    """API status endpoint"""
    return jsonify({
        'status': 'OK',
        'message': 'Optimus Trading Stock API',
        'version': '1.0.0',
        'endpoints': {
            'single_stock': '/api/stock/<symbol>',
            'multiple_stocks': '/api/stocks?symbols=PETR4,VALE3',
            'health': '/api/health'
        }
    })

@app.route('/api/health')
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'cache_entries': len(cache)
    })

@app.route('/api/stock/<symbol>')
def get_single_stock(symbol):
    """Get data for a single stock"""
    try:
        stock_data = get_stock_data(symbol.upper())
        return jsonify(stock_data)
    except Exception as e:
        logger.error(f"Error in get_single_stock for {symbol}: {str(e)}")
        return jsonify({
            'error': True,
            'message': f'Failed to fetch data for {symbol}',
            'details': str(e)
        }), 500

@app.route('/api/stocks')
def get_multiple_stocks():
    """Get data for multiple stocks"""
    symbols_param = request.args.get('symbols', '')
    
    if not symbols_param:
        return jsonify({
            'error': True,
            'message': 'Missing symbols parameter. Use ?symbols=PETR4,VALE3,ITUB4'
        }), 400
    
    symbols = [s.strip().upper() for s in symbols_param.split(',') if s.strip()]
    
    if not symbols:
        return jsonify({
            'error': True,
            'message': 'No valid symbols provided'
        }), 400
    
    results = {}
    errors = []
    
    for symbol in symbols:
        try:
            stock_data = get_stock_data(symbol)
            results[symbol] = stock_data
        except Exception as e:
            error_msg = f"Failed to fetch {symbol}: {str(e)}"
            errors.append(error_msg)
            logger.error(error_msg)
    
    response = {
        'results': results,
        'total_requested': len(symbols),
        'total_successful': len(results),
        'total_errors': len(errors)
    }
    
    if errors:
        response['errors'] = errors
    
    return jsonify(response)

@app.route('/api/cache/clear')
def clear_cache():
    """Clear the cache (useful for testing)"""
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
    for symbol, data in cache.items():
        cache_info[symbol] = {
            'cached_at': data['cached_at'].isoformat(),
            'age_seconds': (datetime.now() - data['cached_at']).total_seconds(),
            'is_valid': is_cache_valid(symbol)
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
        'available_endpoints': [
            '/',
            '/api/health',
            '/api/stock/<symbol>',
            '/api/stocks?symbols=PETR4,VALE3'
        ]
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
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    logger.info(f"Starting Optimus Trading Stock API on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug)