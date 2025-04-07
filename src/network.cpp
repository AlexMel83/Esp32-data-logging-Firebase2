#include "network.h"
#include "config.h"
#include "debug.h"
#include "routes.h"

WebServer http(80);
FtpServer ftpSrv;

const int LED_PIN = 2;
unsigned long lastBlinkMillis = 0;
const unsigned long blinkInterval = 1000;
bool ledState = false;

void initWiFi() {
  IPAddress primaryDNS(8, 8, 8, 8);
  IPAddress secondaryDNS(8, 8, 4, 4);
  WiFi.config(local_ip, gateway, subnet, primaryDNS, secondaryDNS);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  DEBUG_PRINT("Connecting to WiFi ..");

  unsigned long startAttemptTime = millis();
  const unsigned long wifiTimeout = 60000;

  while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < wifiTimeout) {
    if (millis() - lastBlinkMillis >= blinkInterval) {
      ledState = !ledState;
      digitalWrite(LED_PIN, ledState);
      lastBlinkMillis = millis();
    }
  }

  if (WiFi.status() == WL_CONNECTED) {
    DEBUG_PRINT(WiFi.localIP().toString());
    DEBUG_PRINT("WiFi connected");
    digitalWrite(LED_PIN, HIGH); // Устанавливаем HIGH при успешном подключении
  } else {
    DEBUG_PRINT("Failed to connect to WiFi, restarting...");
    digitalWrite(LED_PIN, LOW);
    delay(1000);
    ESP.restart();
  }
}

void setupNetworkServices() {
  http.begin();
  ftpSrv.begin("relay", "relay");
  String msg = "FTP server started @ ";
  msg.concat(WiFi.localIP().toString());
  DEBUG_PRINT(msg);
  setupRoutes();
}

void updateLed() {
  if (WiFi.status() == WL_CONNECTED) {
    if (millis() - lastBlinkMillis >= blinkInterval) {
      ledState = !ledState;
      digitalWrite(LED_PIN, ledState);
      lastBlinkMillis = millis();
    }
  } else {
    digitalWrite(LED_PIN, LOW); // Выключаем, если нет подключения
  }
}