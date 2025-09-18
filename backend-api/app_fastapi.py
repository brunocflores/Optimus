from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import logging
from datetime import datetime, timedelta
import os
import time
import random
from typing import Optional, List

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Optimus Trading Stock API",
    description="API for stock quotes using yfinance 0.2.66",
    version="2.0.0"
)

# Define allowed origins
origins = [
    "https://brunocflores.github.io/Optimus",
    "https://brunocflores.github.io/Optimus/",
    "https://brunocflores.github.io",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
    "http://127.0.0.1:8080"
]

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Extended cache to reduce Yahoo Finance calls
cache = {}
CACHE_DURATION = 600  # 10 minutes (updated per request)

def get_stock_data_with_retry(symbol: str, max_retries: int = 3):
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

def get_stock_data(symbol: str):
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

@app.get("/")
async def root():
    """API status"""
    return {
        'status': 'OK',
        'message': 'Optimus Trading Stock API (yfinance 0.2.66)',
        'version': '2.0.0',
        'cache_entries': len(cache),
        'data_source': 'yfinance 0.2.66 - portfolio stocks only',
        'cache_duration_minutes': CACHE_DURATION // 60,
        'features': ['10min cache', 'portfolio-only fetching', 'no Adj Close dependency', 'FastAPI + CORS'],
        'allowed_origins': origins
    }

@app.get("/api/health")
async def health():
    """Health check"""
    return {
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'cache_entries': len(cache),
        'data_source': 'yfinance 0.2.66',
        'cache_duration_minutes': CACHE_DURATION // 60
    }

@app.get("/api/stock/{symbol}")
async def get_single_stock(symbol: str):
    """Get single stock data"""
    try:
        stock_data = get_stock_data(symbol)
        return stock_data
    except Exception as e:
        logger.error(f"Error fetching {symbol}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                'error': True,
                'message': f'Failed to fetch {symbol}',
                'details': str(e),
                'note': 'Using yfinance 0.2.66 - no fallback available'
            }
        )

@app.get("/api/stocks")
async def get_multiple_stocks(symbols: str = Query(..., description="Comma-separated list of stock symbols")):
    """Get multiple stocks data - Only for portfolio symbols"""

    if not symbols:
        raise HTTPException(
            status_code=400,
            detail={
                'error': True,
                'message': 'Missing symbols parameter - provide only portfolio stocks'
            }
        )

    # Only process symbols that are provided (portfolio stocks only)
    symbol_list = [s.strip().upper() for s in symbols.split(',') if s.strip()]

    if len(symbol_list) > 20:  # Limit to 20 symbols max to avoid rate limiting
        raise HTTPException(
            status_code=400,
            detail={
                'error': True,
                'message': 'Too many symbols requested. Maximum 20 portfolio stocks allowed.'
            }
        )

    results = {}
    errors = []

    logger.info(f"Fetching data for {len(symbol_list)} portfolio symbols: {symbol_list}")

    for symbol in symbol_list:
        try:
            stock_data = get_stock_data(symbol)
            results[symbol] = stock_data
        except Exception as e:
            errors.append(f"{symbol}: {str(e)}")
            logger.error(f"Error fetching portfolio symbol {symbol}: {str(e)}")

    return {
        'results': results,
        'total_requested': len(symbol_list),
        'total_successful': len(results),
        'errors': errors if errors else None,
        'data_source': 'yfinance 0.2.66 (portfolio stocks only)',
        'cache_duration_minutes': CACHE_DURATION // 60
    }

@app.delete("/api/cache/clear")
async def clear_cache():
    """Clear cache"""
    global cache
    cache.clear()
    return {'message': 'Cache cleared'}

if __name__ == '__main__':
    import uvicorn
    port = int(os.environ.get('PORT', 5001))
    logger.info(f"Starting FastAPI yfinance 0.2.66 Stock API on port {port}")
    logger.info(f"Features: 10min cache, portfolio-only fetching, no Adj Close dependency, CORS enabled")
    logger.info(f"Allowed origins: {origins}")
    uvicorn.run(app, host='0.0.0.0', port=port)