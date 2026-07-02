#!/usr/bin/env python3
"""
Bitcoin Wöchentlicher Smart-Kauf Bot
MIT DISCORD BENACHRICHTIGUNGEN
"""

from coinbase.rest import RESTClient
from datetime import datetime
import sys
import traceback

from helper import BitcoinHelper, DiscordNotifier, PurchaseLogger


# ============= KONFIGURATION =============
BASE_AMOUNT_EUR = 50
DRY_RUN = True  # True = Testmodus, False = Echter Kauf
LOG_FILE = "bitcoin_purchases.csv"
API_KEY_FILE = "cdp_api_key.json"

# DISCORD KONFIGURATION
DISCORD_WEBHOOK_URL = ""  # Entfernt vor GitHub-Veroeffentlichung - alte Webhook-URL bei Discord widerrufen!
DISCORD_ENABLED = True
# =========================================


class BitcoinBot:
    """Hauptklasse für den Bitcoin-Kauf-Bot"""
    
    def __init__(self, base_amount_eur, api_key_file, discord_webhook_url, 
                 dry_run=True, discord_enabled=True, log_file="bitcoin_purchases.csv"):
        self.base_amount_eur = base_amount_eur
        self.dry_run = dry_run
        self.timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Coinbase Client initialisieren
        self.client = RESTClient(key_file=api_key_file)
        
        # Helper-Objekte erstellen
        self.helper = BitcoinHelper(self.client)
        self.discord = DiscordNotifier(discord_webhook_url, discord_enabled)
        self.logger = PurchaseLogger(log_file)
    
    def print_header(self):
        """Gibt Bot-Header aus"""
        print(f"\n{'='*60}")
        print(f"🤖 BITCOIN WEEKLY PURCHASE BOT")
        print(f"📅 {self.timestamp}")
        print(f"💰 Basis-Betrag: €{self.base_amount_eur}")
        print(f"🔧 Modus: {'DRY RUN (Test)' if self.dry_run else 'LIVE TRADING'}")
        print(f"📱 Discord: {'✅ Aktiviert' if self.discord.enabled else '❌ Deaktiviert'}")
        print(f"{'='*60}\n")
    
    def calculate_score(self):
        """Berechnet den Kauf-Score basierend auf verschiedenen Indikatoren"""
        score = 0
        factors = []
        
        # 1. Fear & Greed Index
        print("📊 Lade Fear & Greed Index...")
        fng_data = self.helper.get_fear_and_greed()
        fear_level = fng_data['value']
        fng_classification = fng_data['classification']
        
        if fear_level < 25:
            score += 3
            factors.append(f"FNG={fear_level} ({fng_classification}, +3)")
        elif fear_level < 45:
            score += 2
            factors.append(f"FNG={fear_level} ({fng_classification}, +2)")
        elif fear_level < 55:
            score += 0
            factors.append(f"FNG={fear_level} ({fng_classification}, +0)")
        else:
            score -= 2
            factors.append(f"FNG={fear_level} ({fng_classification}, -2)")
        
        # 2. Aktuellen Preis abrufen
        print("💱 Lade aktuellen BTC-Preis...")
        current_price = self.helper.get_current_price()
        
        # 3. RSI berechnen
        print("📈 Berechne RSI...")
        rsi_value = self.helper.get_rsi_from_api()
        
        if rsi_value < 30:
            score += 3
            factors.append(f"RSI={rsi_value:.1f} (Stark überverkauft, +3)")
        elif rsi_value < 45:
            score += 1
            factors.append(f"RSI={rsi_value:.1f} (Leicht überverkauft, +1)")
        elif rsi_value > 70:
            score -= 2
            factors.append(f"RSI={rsi_value:.1f} (Überkauft, -2)")
        else:
            factors.append(f"RSI={rsi_value:.1f} (Neutral, +0)")
        
        # 4. 350-Tage Moving Average
        ma_350 = self.helper.get_moving_average(days=350)
        
        if current_price < ma_350:
            score += 2
            price_diff_pct = ((current_price - ma_350) / ma_350) * 100
            factors.append(f"Preis < 350d-MA ({price_diff_pct:.1f}%, +2)")
        else:
            price_diff_pct = ((current_price - ma_350) / ma_350) * 100
            factors.append(f"Preis > 350d-MA (+{price_diff_pct:.1f}%, +0)")
        
        return {
            'score': score,
            'factors': factors,
            'current_price': current_price,
            'fear_level': fear_level,
            'fng_classification': fng_classification,
            'rsi': rsi_value,
            'ma_350': ma_350
        }
    
    def print_analysis(self, result):
        """Gibt Analyse-Ergebnis aus"""
        print(f"\n{'='*60}")
        print("📊 ANALYSE-ERGEBNIS")
        print(f"{'='*60}")
        print(f"💰 Aktueller BTC-Preis: €{result['current_price']:,.2f}")
        print(f"📉 350-Tage Moving Avg: €{result['ma_350']:,.2f}")
        print(f"\n🎯 Bewertungsfaktoren:")
        for i, factor in enumerate(result['factors'], 1):
            print(f"   {i}. {factor}")
        print(f"\n🏆 Gesamt-Score: {result['score']}/8")
        print(f"{'='*60}\n")
    
    def determine_purchase_strategy(self, score):
        """Bestimmt Kaufstrategie basierend auf Score - Bot kauft IMMER"""
        if score >= 5:
            return {
                'multiplier': 1.5,
                'signal': "🚀 STARKES KAUFSIGNAL",
                'emoji': "🚀",
                'color': 0x00ff00
            }
        elif score >= 3:
            return {
                'multiplier': 1.25,
                'signal': "✅ GUTES KAUFSIGNAL",
                'emoji': "✅",
                'color': 0x32cd32
            }
        elif score >= 1:
            return {
                'multiplier': 1.0,
                'signal': "💰 NORMALES KAUFSIGNAL",
                'emoji': "💰",
                'color': 0xffa500
            }
        elif score >= -1:
            return {
                'multiplier': 0.75,
                'signal': "⚠️ SCHWACHES KAUFSIGNAL",
                'emoji': "⚠️",
                'color': 0xff8c00
            }
        else:
            return {
                'multiplier': 0.5,
                'signal': "🔻 MINIMALKAUF",
                'emoji': "🔻",
                'color': 0xff6347
            }
    
    def execute_purchase(self, amount_eur, result, strategy):
        """Führt Kauf aus (oder simuliert ihn im Dry-Run)"""
        btc_amount = amount_eur / result['current_price']
        
        print(f"\n💶 Kaufbetrag: €{amount_eur:.2f}")
        print(f"₿  BTC-Menge: {btc_amount:.8f} BTC")
        
        order_id = "DRY_RUN"
        status = "Test"
        
        if not self.dry_run:
            print(f"\n🔄 Führe Kauf aus...")
            try:
                order = self.client.market_order_buy(
                    client_order_id="",
                    product_id="BTC-EUR",
                    quote_size=str(amount_eur)
                )
                
                if order['success']:
                    order_id = order['success_response']['order_id']
                    status = "Erfolgreich"
                    print(f"✅ Kauf erfolgreich!")
                    print(f"📝 Order ID: {order_id}")
                    
                    self.send_success_notification(amount_eur, btc_amount, result, strategy, order_id)
                else:
                    error_response = order.get('error_response', 'Unbekannter Fehler')
                    status = f"Fehler: {error_response}"
                    print(f"❌ Order fehlgeschlagen: {error_response}")
                    
                    self.send_error_notification(amount_eur, result, error_response)
                    
                    self.logger.log_purchase(
                        self.timestamp, result['current_price'], amount_eur, btc_amount,
                        result['fear_level'], result['rsi'], result['ma_350'],
                        result['score'], "ERROR", status
                    )
                    return None
            
            except Exception as e:
                status = f"Fehler: {str(e)}"
                print(f"❌ Fehler beim Kauf: {e}")
                
                self.send_error_notification(amount_eur, result, str(e))
                
                self.logger.log_purchase(
                    self.timestamp, result['current_price'], amount_eur, btc_amount,
                    result['fear_level'], result['rsi'], result['ma_350'],
                    result['score'], "ERROR", status
                )
                return None
        else:
            print(f"\n🧪 DRY RUN - Kein echter Kauf ausgeführt")
            self.send_dry_run_notification(amount_eur, btc_amount, result, strategy)
        
        # Logging
        self.logger.log_purchase(
            self.timestamp, result['current_price'], amount_eur, btc_amount,
            result['fear_level'], result['rsi'], result['ma_350'],
            result['score'], order_id, status
        )
        
        print(f"\n📝 Eintrag in {self.logger.log_file} gespeichert")
        print(f"{'='*60}\n")
        
        return {
            'timestamp': self.timestamp,
            'price': result['current_price'],
            'amount': amount_eur,
            'btc': btc_amount,
            'fng': result['fear_level'],
            'rsi': result['rsi'],
            'ma_350': result['ma_350'],
            'score': result['score'],
            'order_id': order_id
        }
    
    def send_success_notification(self, amount_eur, btc_amount, result, strategy, order_id):
        """Sendet Discord-Benachrichtigung bei erfolgreichem Kauf"""
        fields = [
            {"name": "💰 BTC-Preis", "value": f"€{result['current_price']:,.2f}", "inline": True},
            {"name": "💶 Betrag", "value": f"€{amount_eur:.2f}", "inline": True},
            {"name": "₿  Bitcoin", "value": f"{btc_amount:.8f} BTC", "inline": True},
            {"name": "🏆 Score", "value": f"{result['score']}/8 - {strategy['signal']}", "inline": False},
            {"name": "😱 Fear & Greed", "value": f"{result['fear_level']} ({result['fng_classification']})", "inline": True},
            {"name": "📈 RSI", "value": f"{result['rsi']:.1f}", "inline": True},
            {"name": "📉 350d-MA", "value": f"€{result['ma_350']:,.0f}", "inline": True},
            {"name": "🆔 Order ID", "value": f"`{order_id}`", "inline": False}
        ]
        
        self.discord.send_notification(
            title=f"{strategy['emoji']} Bitcoin erfolgreich gekauft!",
            description=f"**{self.timestamp}**\n✅ Kauf abgeschlossen",
            color=strategy['color'],
            fields=fields
        )
    
    def send_error_notification(self, amount_eur, result, error):
        """Sendet Discord-Benachrichtigung bei Fehler"""
        fields = [
            {"name": "💰 BTC-Preis", "value": f"€{result['current_price']:,.2f}", "inline": True},
            {"name": "💶 Versuchter Betrag", "value": f"€{amount_eur:.2f}", "inline": True},
            {"name": "⚠️ Fehler", "value": str(error), "inline": False}
        ]
        
        self.discord.send_notification(
            title="❌ Bitcoin Kauf FEHLGESCHLAGEN!",
            description=f"**{self.timestamp}**\nBitte Logs prüfen!",
            color=0xff0000,
            fields=fields
        )
    
    def send_dry_run_notification(self, amount_eur, btc_amount, result, strategy):
        """Sendet Discord-Benachrichtigung für Dry-Run"""
        fields = [
            {"name": "💰 BTC-Preis", "value": f"€{result['current_price']:,.2f}", "inline": True},
            {"name": "💶 Kaufbetrag", "value": f"€{amount_eur:.2f}", "inline": True},
            {"name": "₿  Bitcoin", "value": f"{btc_amount:.8f} BTC", "inline": True},
            {"name": "🏆 Score", "value": f"{result['score']}/8 - {strategy['signal']}", "inline": False},
            {"name": "😱 Fear & Greed", "value": f"{result['fear_level']} ({result['fng_classification']})", "inline": True},
            {"name": "📈 RSI", "value": f"{result['rsi']:.1f}", "inline": True},
            {"name": "📉 350d-MA", "value": f"€{result['ma_350']:,.0f}", "inline": True},
            {"name": "🧪 Modus", "value": "Test-Modus aktiv (kein echter Kauf)", "inline": False}
        ]
        
        self.discord.send_notification(
            title=f"{strategy['emoji']} Bitcoin Bot - Dry Run",
            description=f"**{self.timestamp}**\n🧪 Test-Durchlauf",
            color=strategy['color'],
            fields=fields
        )
    
    def run(self):
        """Hauptausführung des Bots"""
        self.print_header()
        
        try:
            # Score berechnen
            result = self.calculate_score()
            self.print_analysis(result)
            
            # Kaufstrategie bestimmen
            strategy = self.determine_purchase_strategy(result['score'])
            
            print(f"{strategy['signal']} - Kaufe {int(strategy['multiplier']*100)}% des Basis-Betrags!")
            
            # Kaufbetrag berechnen
            amount_eur = float(self.base_amount_eur) * strategy['multiplier']
            
            # Kauf IMMER ausführen
            purchase_result = self.execute_purchase(amount_eur, result, strategy)
            
            if purchase_result:
                print("✅ Skript erfolgreich ausgeführt")
                return purchase_result
            else:
                print("⚠️  Kauf mit Fehler abgeschlossen")
                return None
        
        except Exception as e:
            print(f"\n❌ FEHLER: {e}")
            traceback.print_exc()
            
            # Discord: Schwerer Fehler
            fields = [
                {"name": "⚠️ Fehler", "value": str(e)[:1024], "inline": False},
                {"name": "📝 Hinweis", "value": "Bitte Logs auf Raspberry Pi prüfen!", "inline": False}
            ]
            
            self.discord.send_notification(
                title="❌ Bitcoin Bot - KRITISCHER FEHLER!",
                description=f"**{self.timestamp}**\nBot konnte nicht ausgeführt werden",
                color=0xff0000,
                fields=fields
            )
            
            return None


# ============= HAUPTPROGRAMM =============
if __name__ == "__main__":
    # Argumente verarbeiten
    if len(sys.argv) > 1 and sys.argv[1] == "--live":
        print("⚠️  LIVE-MODUS aktiviert - Echter Kauf wird ausgeführt!")
        input("Drücke ENTER zum Fortfahren oder CTRL+C zum Abbrechen...")
        DRY_RUN = False
    
    # Bot erstellen und ausführen
    bot = BitcoinBot(
        base_amount_eur=BASE_AMOUNT_EUR,
        api_key_file=API_KEY_FILE,
        discord_webhook_url=DISCORD_WEBHOOK_URL,
        dry_run=DRY_RUN,
        discord_enabled=DISCORD_ENABLED,
        log_file=LOG_FILE
    )
    
    result = bot.run()
    
    if result:
        sys.exit(0)
    else:
        sys.exit(1)
