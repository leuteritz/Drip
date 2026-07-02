"""
Helper-Klassen für Bitcoin-Bot
"""
from coinbase.rest import RESTClient
from fear_and_greed import FearAndGreedIndex
from datetime import datetime, timedelta, timezone
import requests
import csv
from pathlib import Path


class BitcoinHelper:
    """Helper-Klasse für RSI-Berechnungen und technische Indikatoren"""
    
    def __init__(self, client: RESTClient):
        self.client = client
    
    def calculate_rsi_wilder(self, prices, period=14):
        """Berechnet RSI nach Wilder's Original-Methode"""
        if len(prices) < period + 1:
            return 50
        
        deltas = [prices[i] - prices[i-1] for i in range(1, len(prices))]
        gains = []
        losses = []
        
        for delta in deltas:
            if delta > 0:
                gains.append(delta)
                losses.append(0)
            else:
                gains.append(0)
                losses.append(abs(delta))
        
        avg_gain = sum(gains[:period]) / period
        avg_loss = sum(losses[:period]) / period
        
        for i in range(period, len(gains)):
            avg_gain = (avg_gain * (period - 1) + gains[i]) / period
            avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        
        if avg_loss == 0:
            return 100
        
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        return rsi
    
    def get_rsi_from_api(self):
        """Holt historische Daten und berechnet echten RSI"""
        try:
            end_time = datetime.now()
            start_time = end_time - timedelta(days=20)
            
            candles = self.client.get_candles(
                product_id="BTC-EUR",
                start=int(start_time.timestamp()),
                end=int(end_time.timestamp()),
                granularity="ONE_DAY"
            )
            
            if not candles or not candles.candles:
                print("⚠️  Keine Candle-Daten verfügbar, verwende RSI=50")
                return 50
            
            prices = [float(candle['close']) for candle in reversed(candles.candles)]
            rsi = self.calculate_rsi_wilder(prices, period=14)
            return rsi
        except Exception as e:
            print(f"⚠️  Fehler bei RSI-Berechnung: {e}, verwende RSI=50")
            return 50
    
    def get_moving_average(self, days=350):
        """Berechnet Moving Average für X Tage aus echten Coinbase-Daten"""
        try:
            print(f"📊 Berechne {days}-Tage Moving Average...")
            
            end_time = datetime.now()
            start_time = end_time - timedelta(days=days)
            
            candles = self.client.get_candles(
                product_id="BTC-EUR",
                start=int(start_time.timestamp()),
                end=int(end_time.timestamp()),
                granularity="ONE_DAY"
            )
            
            if not candles or not candles.candles:
                print(f"⚠️  Keine Daten verfügbar, verwende Fallback €86.000")
                return 86000
            
            prices = [float(candle['close']) for candle in candles.candles]
            
            if len(prices) < days * 0.8:
                print(f"⚠️  Nur {len(prices)} von {days} Tagen verfügbar, verwende Fallback")
                return 86000
            
            ma = sum(prices) / len(prices)
            print(f"✅ {days}d-MA berechnet: €{ma:,.2f} (basierend auf {len(prices)} Tagen)")
            
            return ma
        
        except Exception as e:
            print(f"⚠️  Fehler: {e}, verwende Fallback €86.000")
            return 86000
    
    def get_fear_and_greed(self):
        """Holt Fear & Greed Index"""
        fng = FearAndGreedIndex()
        return {
            'value': fng.get_current_value(),
            'classification': fng.get_current_classification()
        }
    
    def get_current_price(self):
        """Holt aktuellen BTC-EUR Preis"""
        product = self.client.get_product("BTC-EUR")
        return float(product.price)


class DiscordNotifier:
    """Helper-Klasse für Discord-Benachrichtigungen"""
    
    def __init__(self, webhook_url, enabled=True):
        self.webhook_url = webhook_url
        self.enabled = enabled
    
    def send_notification(self, title, description, color=0x00ff00, fields=None):
        """
        Sendet eine Embed-Nachricht via Discord Webhook
        
        color: 0x00ff00 = grün, 0xff0000 = rot, 0xffa500 = orange
        fields: Liste von {"name": "...", "value": "...", "inline": True/False}
        """
        if not self.enabled or not self.webhook_url:
            return False
        
        try:
            embed = {
                "title": title,
                "description": description,
                "color": color,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "footer": {
                    "text": "Bitcoin Smart Purchase Bot"
                }
            }
            
            if fields:
                embed["fields"] = fields
            
            payload = {
                "embeds": [embed],
                "username": "Schlierender Bitcoin Bot",
            }
            
            response = requests.post(
                self.webhook_url,
                json=payload,
                timeout=10
            )
            
            if response.status_code in [200, 204]:
                print("✅ Discord-Benachrichtigung gesendet")
                return True
            else:
                print(f"⚠️  Discord-Fehler: {response.status_code}")
                print(f"    Response: {response.text}")
                return False
        
        except Exception as e:
            print(f"⚠️  Discord-Fehler: {e}")
            return False


class PurchaseLogger:
    """Helper-Klasse für CSV-Logging"""
    
    def __init__(self, log_file="bitcoin_purchases.csv"):
        self.log_file = log_file
    
    def log_purchase(self, timestamp, price, amount_eur, btc_amount, fng, rsi, ma_350, score, order_id, status):
        """Loggt Käufe in CSV-Datei"""
        file_exists = Path(self.log_file).exists()
        
        with open(self.log_file, 'a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            
            if not file_exists:
                writer.writerow([
                    'Timestamp', 'BTC_Preis_EUR', 'Betrag_EUR', 'BTC_Menge', 
                    'Fear_Greed', 'RSI', 'MA_350d', 'Score', 'Order_ID', 'Status'
                ])
            
            writer.writerow([
                timestamp, price, amount_eur, btc_amount, 
                fng, rsi, ma_350, score, order_id, status
            ])
