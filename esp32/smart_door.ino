/*
 * ============================================================
 *  SMART RENTAL SYSTEM - ESP32 Door Controller
 *  Hardware: ESP32 + MFRC522 (RFID) + Relay + Solenoid Lock
 *  Author: Smart Rental System
 * ============================================================
 *
 *  WIRING:
 *  MFRC522 RFID:
 *    SDA  → GPIO 5
 *    SCK  → GPIO 18
 *    MOSI → GPIO 23
 *    MISO → GPIO 19
 *    RST  → GPIO 22
 *    3.3V → 3.3V
 *    GND  → GND
 *
 *  Relay Module:
 *    IN   → GPIO 4
 *    VCC  → 5V
 *    GND  → GND
 *    COM  → + of Solenoid
 *    NO   → (Normally Open - door LOCKED by default)
 *
 *  LED Indicators:
 *    Green LED (Access OK)  → GPIO 25
 *    Red LED   (Denied)     → GPIO 26
 *    Blue LED  (WiFi)       → GPIO 27
 *
 *  Buzzer  → GPIO 14
 *
 *  LIBRARIES NEEDED (Arduino IDE → Manage Libraries):
 *    - MFRC522 by GithubCommunity
 *    - ArduinoJson by Benoit Blanchon
 *    - ESP32 board package
 * ============================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>

// ── WiFi Configuration ─────────────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_SSID";        // ← Change this
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";     // ← Change this

// ── Server Configuration ────────────────────────────────────
// Replace with your Render URL after deployment
const char* SERVER_URL    = "https://your-app.onrender.com"; // ← Change this
const int   DEVICE_ID     = 1;  // Match ID from devices table

// ── Pin Definitions ─────────────────────────────────────────
#define RFID_SDA_PIN  5
#define RFID_RST_PIN  22
#define RELAY_PIN     4
#define LED_GREEN     25
#define LED_RED       26
#define LED_BLUE      27
#define BUZZER_PIN    14

// ── RFID ────────────────────────────────────────────────────
MFRC522 rfid(RFID_SDA_PIN, RFID_RST_PIN);

// ── State ────────────────────────────────────────────────────
unsigned long lastHeartbeat = 0;
const unsigned long HEARTBEAT_INTERVAL = 30000; // 30 seconds
const unsigned long DOOR_OPEN_MS = 5000;        // Door open for 5 seconds

// ── Setup ────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.println("\n🚀 Smart Rental Door System Starting...");

  // Initialize pins
  pinMode(RELAY_PIN,  OUTPUT);
  pinMode(LED_GREEN,  OUTPUT);
  pinMode(LED_RED,    OUTPUT);
  pinMode(LED_BLUE,   OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  // Default: door locked
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_RED,   HIGH); // Red on = locked
  digitalWrite(LED_BLUE,  LOW);

  // Initialize SPI and RFID
  SPI.begin();
  rfid.PCD_Init();
  Serial.println("✅ RFID reader initialized");

  // Connect to WiFi
  connectWiFi();
}

// ── Main Loop ────────────────────────────────────────────────
void loop() {
  // Send heartbeat to server
  if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }

  // Check for RFID card
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }

  String rfidCode = getRFIDString();
  Serial.println("📡 Card detected: " + rfidCode);
  indicateReading();

  // Check access with server
  checkAccess(rfidCode);

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  delay(2000); // Debounce
}

// ── WiFi Connection ──────────────────────────────────────────
void connectWiFi() {
  Serial.print("📶 Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;

  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    digitalWrite(LED_BLUE, !digitalRead(LED_BLUE)); // Blink while connecting
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi connected!");
    Serial.print("   IP: "); Serial.println(WiFi.localIP());
    digitalWrite(LED_BLUE, HIGH); // Solid blue = connected
  } else {
    Serial.println("\n❌ WiFi failed! Running in offline mode.");
    digitalWrite(LED_BLUE, LOW);
  }
}

// ── Get RFID as hex string ───────────────────────────────────
String getRFIDString() {
  String result = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) result += "0";
    result += String(rfid.uid.uidByte[i], HEX);
  }
  result.toUpperCase();
  return result;
}

// ── Check Access with Server ─────────────────────────────────
void checkAccess(String rfidCode) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️  No WiFi - denying access");
    denyAccess("No internet connection");
    return;
  }

  HTTPClient http;
  String url = String(SERVER_URL) + "/api/door/access?rfid=" + rfidCode + "&deviceId=" + String(DEVICE_ID);
  Serial.println("🌐 Checking: " + url);

  http.begin(url);
  http.setTimeout(8000);
  int httpCode = http.GET();

  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    Serial.println("📥 Response: " + payload);

    StaticJsonDocument<256> doc;
    DeserializationError err = deserializeJson(doc, payload);

    if (!err) {
      const char* access = doc["access"];
      const char* reason = doc["reason"];
      const char* tenant = doc["tenant"] | "Unknown";

      Serial.printf("👤 Tenant: %s | Decision: %s | Reason: %s\n", tenant, access, reason);

      if (String(access) == "ALLOW") {
        grantAccess(String(tenant));
      } else {
        denyAccess(String(reason));
      }
    } else {
      Serial.println("❌ JSON parse error");
      denyAccess("Parse error");
    }
  } else {
    Serial.printf("❌ HTTP error: %d\n", httpCode);
    denyAccess("Server error " + String(httpCode));
  }

  http.end();
}

// ── Grant Access ─────────────────────────────────────────────
void grantAccess(String tenantName) {
  Serial.println("✅ ACCESS GRANTED to: " + tenantName);

  // Visual + audio feedback
  digitalWrite(LED_RED,   LOW);
  digitalWrite(LED_GREEN, HIGH);
  buzzSuccess();

  // Unlock door (relay ON)
  digitalWrite(RELAY_PIN, HIGH);
  Serial.println("🚪 Door UNLOCKED");

  delay(DOOR_OPEN_MS);

  // Lock door again
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_RED,   HIGH);
  Serial.println("🔒 Door LOCKED");
}

// ── Deny Access ──────────────────────────────────────────────
void denyAccess(String reason) {
  Serial.println("🚫 ACCESS DENIED: " + reason);

  // Visual + audio feedback
  digitalWrite(LED_GREEN, LOW);
  buzzDenied();

  // Flash red
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_RED, LOW);  delay(150);
    digitalWrite(LED_RED, HIGH); delay(150);
  }
}

// ── Indicate Reading ─────────────────────────────────────────
void indicateReading() {
  tone(BUZZER_PIN, 1000, 100);
  delay(150);
}

// ── Buzzer Patterns ──────────────────────────────────────────
void buzzSuccess() {
  tone(BUZZER_PIN, 1000, 100); delay(120);
  tone(BUZZER_PIN, 1500, 200); delay(250);
}

void buzzDenied() {
  tone(BUZZER_PIN, 300, 500);
  delay(600);
}

// ── Heartbeat ────────────────────────────────────────────────
void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(SERVER_URL) + "/api/devices/heartbeat";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  String body = "{\"device_id\":" + String(DEVICE_ID) +
                ",\"ip_address\":\"" + WiFi.localIP().toString() + "\"}";

  http.POST(body);
  http.end();
}
