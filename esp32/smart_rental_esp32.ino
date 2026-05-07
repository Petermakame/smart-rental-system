/*
 * ============================================================
 * SMART RENTAL SYSTEM - ESP32 IoT Controller
 * ============================================================
 * Hardware Required:
 *   - ESP32 DevKit V1
 *   - RC522 RFID Reader (SPI)
 *   - R307/AS608 Fingerprint Sensor (UART)
 *   - 5V Relay Module
 *   - Solenoid Lock (12V)
 *   - Green LED (Access Granted)
 *   - Red LED (Access Denied)
 *   - Buzzer (optional)
 *
 * Libraries Required (Install via Arduino Library Manager):
 *   - MFRC522 by GithubCommunity
 *   - Adafruit Fingerprint Sensor Library
 *   - ArduinoJson by Benoit Blanchon
 *   - WiFi (built-in ESP32)
 *   - HTTPClient (built-in ESP32)
 * ============================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Adafruit_Fingerprint.h>
#include <HardwareSerial.h>

// ─── WiFi Configuration ────────────────────────────────────────────────────────
const char* ssid     = "YOUR_WIFI_NAME";        // ← Badilisha hapa
const char* password = "YOUR_WIFI_PASSWORD";    // ← Badilisha hapa

// ─── Server Configuration ─────────────────────────────────────────────────────
// For local development:
// const char* serverURL = "http://192.168.1.100:3000";
// For Render (production):
const char* serverURL = "https://your-app-name.onrender.com";  // ← Badilisha hapa
const char* deviceName = "Door1";
const char* apiKey = "esp32_secret_key_2024";  // Must match .env ESP32_API_KEY

// ─── Pin Configuration ─────────────────────────────────────────────────────────
// RFID RC522 (SPI)
#define RFID_SS_PIN   5    // SDA/SS
#define RFID_RST_PIN  22   // RST

// Relay (Active LOW - most relay modules)
#define RELAY_PIN     26   // Relay control pin

// LEDs
#define LED_GREEN     27   // Green LED - Access Granted
#define LED_RED       25   // Red LED - Access Denied

// Buzzer (optional)
#define BUZZER_PIN    32   // Buzzer

// Fingerprint Sensor (UART2)
#define FP_RX_PIN     16   // ESP32 RX2 ← Connect to Fingerprint TX
#define FP_TX_PIN     17   // ESP32 TX2 → Connect to Fingerprint RX

// ─── Hardware Instances ────────────────────────────────────────────────────────
MFRC522 rfid(RFID_SS_PIN, RFID_RST_PIN);
HardwareSerial fpSerial(2);
Adafruit_Fingerprint finger(&fpSerial);

// ─── State Variables ──────────────────────────────────────────────────────────
bool doorOpen = false;
unsigned long doorOpenTime = 0;
const unsigned long DOOR_OPEN_DURATION = 5000;  // 5 seconds open
unsigned long lastPingTime = 0;
const unsigned long PING_INTERVAL = 30000;       // Ping server every 30s

// ─── Setup ────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.println("\n╔════════════════════════════════╗");
  Serial.println("║  Smart Rental IoT Controller   ║");
  Serial.println("╚════════════════════════════════╝");

  // Pin setup
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  // Default state: door locked
  lockDoor();
  digitalWrite(LED_RED, HIGH);

  // Initialize SPI for RFID
  SPI.begin();
  rfid.PCD_Init();
  Serial.println("✅ RFID RC522 initialized");

  // Initialize Fingerprint Sensor
  fpSerial.begin(57600, SERIAL_8N1, FP_RX_PIN, FP_TX_PIN);
  finger.begin(57600);

  if (finger.verifyPassword()) {
    Serial.println("✅ Fingerprint sensor found!");
    finger.getParameters();
    Serial.print("   Templates stored: ");
    Serial.println(finger.templateCount);
  } else {
    Serial.println("⚠️  Fingerprint sensor not found - RFID only mode");
  }

  // Connect WiFi
  connectWiFi();

  // Initial ping to server
  pingServer();

  Serial.println("\n🔍 Ready - Scan RFID card or place finger...\n");
}

// ─── Main Loop ─────────────────────────────────────────────────────────────────
void loop() {
  // Auto-close door after duration
  if (doorOpen && (millis() - doorOpenTime > DOOR_OPEN_DURATION)) {
    lockDoor();
    Serial.println("🔒 Door auto-locked after timeout");
  }

  // Check RFID
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String rfidTag = getRFIDTag();
    Serial.print("📡 RFID scanned: ");
    Serial.println(rfidTag);
    checkAccessByRFID(rfidTag);
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    delay(1000); // Debounce
  }

  // Check Fingerprint
  int fingerprintId = getFingerprintId();
  if (fingerprintId > 0) {
    Serial.print("👆 Fingerprint ID: ");
    Serial.println(fingerprintId);
    checkAccessByFingerprint(fingerprintId);
    delay(1000);
  }

  // Periodic server ping (heartbeat)
  if (millis() - lastPingTime > PING_INTERVAL) {
    if (WiFi.status() == WL_CONNECTED) {
      pingServer();
    } else {
      reconnectWiFi();
    }
    lastPingTime = millis();
  }
}

// ─── RFID Helper ──────────────────────────────────────────────────────────────
String getRFIDTag() {
  String tag = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) tag += "0";
    tag += String(rfid.uid.uidByte[i], HEX);
  }
  tag.toUpperCase();
  return tag;
}

// ─── Fingerprint Helper ───────────────────────────────────────────────────────
int getFingerprintId() {
  uint8_t p = finger.getImage();
  if (p != FINGERPRINT_OK) return -1;

  p = finger.image2Tz();
  if (p != FINGERPRINT_OK) return -1;

  p = finger.fingerSearch();
  if (p == FINGERPRINT_OK) {
    return finger.fingerID;
  }
  return -1;
}

// ─── API: Check Access by RFID ────────────────────────────────────────────────
void checkAccessByRFID(String rfidTag) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ No WiFi - Cannot check access");
    denyAccess();
    return;
  }

  String url = String(serverURL) + "/api/door/access?rfid=" + rfidTag + "&deviceName=" + deviceName;

  HTTPClient http;
  http.begin(url);
  http.addHeader("x-api-key", apiKey);
  http.setTimeout(8000);

  int httpCode = http.GET();

  if (httpCode == 200) {
    String response = http.getString();
    processAccessResponse(response);
  } else {
    Serial.print("❌ HTTP Error: ");
    Serial.println(httpCode);
    denyAccess();
  }

  http.end();
}

// ─── API: Check Access by Fingerprint ────────────────────────────────────────
void checkAccessByFingerprint(int fingerprintId) {
  if (WiFi.status() != WL_CONNECTED) {
    denyAccess();
    return;
  }

  String url = String(serverURL) + "/api/door/access?fingerprint=" + String(fingerprintId) + "&deviceName=" + deviceName;

  HTTPClient http;
  http.begin(url);
  http.addHeader("x-api-key", apiKey);
  http.setTimeout(8000);

  int httpCode = http.GET();

  if (httpCode == 200) {
    String response = http.getString();
    processAccessResponse(response);
  } else {
    denyAccess();
  }

  http.end();
}

// ─── Process Server Response ──────────────────────────────────────────────────
void processAccessResponse(String jsonResponse) {
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, jsonResponse);

  if (error) {
    Serial.println("❌ JSON parse error");
    denyAccess();
    return;
  }

  bool access = doc["access"];
  int relay = doc["relay"];
  const char* tenantName = doc["tenantName"] | "Unknown";
  const char* message = doc["message"] | "";

  Serial.print("👤 Tenant: "); Serial.println(tenantName);
  Serial.print("📋 Message: "); Serial.println(message);
  Serial.print("🔑 Access: "); Serial.println(access ? "GRANTED ✅" : "DENIED ❌");

  if (access || relay == 1) {
    grantAccess();
  } else {
    denyAccess();
  }
}

// ─── Grant Access: Unlock door ────────────────────────────────────────────────
void grantAccess() {
  Serial.println("🟢 ACCESS GRANTED - Opening door!");
  doorOpen = true;
  doorOpenTime = millis();

  digitalWrite(RELAY_PIN, LOW);    // LOW = Relay ON (Active LOW)
  digitalWrite(LED_GREEN, HIGH);
  digitalWrite(LED_RED, LOW);

  // Beep 2 times - success
  beep(100); delay(100); beep(100);
}

// ─── Deny Access: Keep door locked ───────────────────────────────────────────
void denyAccess() {
  Serial.println("🔴 ACCESS DENIED - Door remains locked");
  doorOpen = false;

  digitalWrite(RELAY_PIN, HIGH);   // HIGH = Relay OFF (Active LOW)
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_RED, HIGH);

  // Long beep - denied
  beep(500);
}

// ─── Lock Door ────────────────────────────────────────────────────────────────
void lockDoor() {
  doorOpen = false;
  digitalWrite(RELAY_PIN, HIGH);   // Relay OFF → Lock engages
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_RED, HIGH);
}

// ─── Buzzer Helper ────────────────────────────────────────────────────────────
void beep(int duration) {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(duration);
  digitalWrite(BUZZER_PIN, LOW);
}

// ─── WiFi Connect ─────────────────────────────────────────────────────────────
void connectWiFi() {
  Serial.print("📶 Connecting to WiFi: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);
  int attempts = 0;

  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi Connected!");
    Serial.print("   IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("   Signal: "); Serial.print(WiFi.RSSI()); Serial.println(" dBm");
  } else {
    Serial.println("\n❌ WiFi Failed - Running offline (deny all)");
  }
}

void reconnectWiFi() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.disconnect();
    WiFi.begin(ssid, password);
    delay(3000);
  }
}

// ─── Ping Server (Heartbeat) ──────────────────────────────────────────────────
void pingServer() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(serverURL) + "/api/door/ping";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", apiKey);

  StaticJsonDocument<200> doc;
  doc["deviceName"] = deviceName;
  doc["ipAddress"] = WiFi.localIP().toString();
  doc["macAddress"] = WiFi.macAddress();

  String body;
  serializeJson(doc, body);

  int httpCode = http.POST(body);

  if (httpCode == 200) {
    Serial.println("💓 Server ping OK");
  } else {
    Serial.print("⚠️ Ping failed: "); Serial.println(httpCode);
  }

  http.end();
}
