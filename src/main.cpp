#include "config.h"
#include <Arduino.h>
#include "SPIFFS.h"
#include <WiFi.h>
#include <WebServer.h>
#include <ESP8266FtpServer.h>
#include <Firebase_ESP_Client.h>
#include "routes.h"
#include "time.h"

#define DEBUG
#ifdef DEBUG
  #define DEBUG_PRINT(x) Serial.println(x)
#else
  #define DEBUG_PRINT(x)
#endif

#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// Define servers
WebServer http(80);
FtpServer ftpSrv;

// Define Firebase objects
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Variable to save USER UID
String uid;

// Structure to hold counter event data
struct CounterEvent {
  int counterId;
  unsigned long timestamp;
};

// Queue for counter events
#define QUEUE_SIZE 100
CounterEvent eventQueue[QUEUE_SIZE];
volatile int queueHead = 0;
volatile int queueTail = 0;

// Counter values
volatile int counter1Value = 0;
volatile int counter2Value = 0;
volatile int counter3Value = 0;

// Pin definitions
const int COUNTER1_PIN = 14;
const int COUNTER2_PIN = 27;
const int COUNTER3_PIN = 26;
const int LED_PIN = 2;

// Wi-Fi LED blink variables
unsigned long lastBlinkMillis = 0;
const unsigned long blinkInterval = 1000;
bool ledState = false;

// Debounce variables
unsigned long lastDebounceTime1 = 0;
unsigned long lastDebounceTime2 = 0;
unsigned long lastDebounceTime3 = 0;
const unsigned long debounceDelay = 600;

// Timer variables
unsigned long sendDataPrevMillis = 0;
unsigned long timerDelay = 5000;

const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 7200;  // UTC+2 для Украины
const int daylightOffset_sec = 0;

// Variables for time synchronization
volatile unsigned long currentTimestamp = 0;
unsigned long lastSyncTime = 0;
unsigned long lastSyncMillis = 0;

// Interrupt Service Routines with debounce
void IRAM_ATTR counter1ISR() {
  unsigned long currentMillis = millis();
  if (currentMillis - lastDebounceTime1 > debounceDelay) {
    counter1Value++;
    if ((queueTail + 1) % QUEUE_SIZE != queueHead) {
      eventQueue[queueTail].counterId = 1;
      eventQueue[queueTail].timestamp = currentTimestamp;
      queueTail = (queueTail + 1) % QUEUE_SIZE;
    }
    lastDebounceTime1 = currentMillis;
  }
}

void IRAM_ATTR counter2ISR() {
  unsigned long currentMillis = millis();
  if (currentMillis - lastDebounceTime2 > debounceDelay) {
    counter2Value++;
    if ((queueTail + 1) % QUEUE_SIZE != queueHead) {
      eventQueue[queueTail].counterId = 2;
      eventQueue[queueTail].timestamp = currentTimestamp;
      queueTail = (queueTail + 1) % QUEUE_SIZE;
    }
    lastDebounceTime2 = currentMillis;
  }
}

void IRAM_ATTR counter3ISR() {
  unsigned long currentMillis = millis();
  if (currentMillis - lastDebounceTime3 > debounceDelay) {
    counter3Value++;
    if ((queueTail + 1) % QUEUE_SIZE != queueHead) {
      eventQueue[queueTail].counterId = 3;
      eventQueue[queueTail].timestamp = currentTimestamp;
      queueTail = (queueTail + 1) % QUEUE_SIZE;
    }
    lastDebounceTime3 = currentMillis;
  }
}

// Initialize WiFi с явным указанием DNS
void initWiFi() {
  IPAddress primaryDNS(8, 8, 8, 8);   // Google DNS 1
  IPAddress secondaryDNS(8, 8, 4, 4); // Google DNS 2
  WiFi.config(local_ip, gateway, subnet, primaryDNS, secondaryDNS);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi ..");
  
  unsigned long startAttemptTime = millis();
  const unsigned long wifiTimeout = 30000;

  while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < wifiTimeout) {
    if (millis() - lastBlinkMillis >= blinkInterval) {
      ledState = !ledState;
      digitalWrite(LED_PIN, ledState);
      lastBlinkMillis = millis();
    }
    delay(100);
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println(WiFi.localIP());
    Serial.println("WiFi connected");
    digitalWrite(LED_PIN, HIGH);
    DEBUG_PRINT("DNS 1: " + WiFi.dnsIP(0).toString());
    DEBUG_PRINT("DNS 2: " + WiFi.dnsIP(1).toString());
  } else {
    Serial.println();
    Serial.println("Failed to connect to WiFi, restarting...");
    digitalWrite(LED_PIN, LOW);
    delay(1000);
    ESP.restart();
  }
}

// Function to get formatted time string
String getFormattedTime(unsigned long epochTime) {
  struct tm *ptm = localtime((time_t *)&epochTime);
  char buffer[20];
  sprintf(buffer, "%04d-%02d-%02d %02d:%02d:%02d",
          ptm->tm_year + 1900, ptm->tm_mon + 1, ptm->tm_mday,
          ptm->tm_hour, ptm->tm_min, ptm->tm_sec);
  return String(buffer);
}

// Function that gets current epoch time
unsigned long getTime() {
  time_t now;
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("Failed to obtain time");
    return 0;
  }
  time(&now);
  return now;
}

void setup() {
  Serial.begin(115200);

  pinMode(COUNTER1_PIN, INPUT_PULLUP);
  pinMode(COUNTER2_PIN, INPUT_PULLUP);
  pinMode(COUNTER3_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  attachInterrupt(digitalPinToInterrupt(COUNTER1_PIN), counter1ISR, FALLING);
  attachInterrupt(digitalPinToInterrupt(COUNTER2_PIN), counter2ISR, FALLING);
  attachInterrupt(digitalPinToInterrupt(COUNTER3_PIN), counter3ISR, FALLING);

  initWiFi();
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

  unsigned long ntpTimeout = millis();
  while (currentTimestamp == 0 && millis() - ntpTimeout < 10000) {
    currentTimestamp = getTime();
    if (currentTimestamp == 0) {
      DEBUG_PRINT("Waiting for NTP sync...");
      delay(1000);
    } else {
      String message = "Time synced: ";
      message.concat(getFormattedTime(currentTimestamp));
      DEBUG_PRINT(message);
    }
  }
  if (currentTimestamp == 0) {
    DEBUG_PRINT("NTP sync failed, using hardcoded time for testing");
    currentTimestamp = 1743255292;
  }
  lastSyncTime = currentTimestamp;
  lastSyncMillis = millis();

  if (!SPIFFS.begin(true)) {
    DEBUG_PRINT("SPIFFS Mount Failed");
    while (true);
  }
  DEBUG_PRINT("SPIFFS Mounted successfully");

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.token_status_callback = tokenStatusCallback;
  config.max_token_generation_retry = 5;

  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;

  Firebase.reconnectWiFi(true);
  fbdo.setResponseSize(4096);

  DEBUG_PRINT("Initializing Firebase...");
  Firebase.begin(&config, &auth);

  DEBUG_PRINT("Getting User UID...");
  while (auth.token.uid == "") {
    Serial.print('.');
    delay(1000);
  }
  uid = auth.token.uid.c_str();
  String uidMessage = "User UID: ";
  uidMessage.concat(uid);
  DEBUG_PRINT(uidMessage);

  http.begin();
  ftpSrv.begin("relay", "relay");
  DEBUG_PRINT("FTP server started @ " + WiFi.localIP().toString());
  DEBUG_PRINT("Server listening");

  setupRoutes();
}

void loop() {
  http.handleClient();
  ftpSrv.handleFTP();

  if (WiFi.status() == WL_CONNECTED) {
    if (millis() - lastBlinkMillis >= blinkInterval) {
      ledState = !ledState;
      digitalWrite(LED_PIN, ledState);
      lastBlinkMillis = millis();
    }
  } else {
    if (millis() - lastBlinkMillis >= 100) {
      ledState = !ledState;
      digitalWrite(LED_PIN, ledState);
      lastBlinkMillis = millis();
    }
    DEBUG_PRINT("WiFi disconnected, attempting to reconnect...");
    initWiFi();
  }

  if (millis() - lastSyncMillis >= 3600000) {
    unsigned long ntpTime = getTime();
    if (ntpTime != 0) {
      noInterrupts();
      currentTimestamp = ntpTime;
      interrupts();
      lastSyncTime = currentTimestamp;
      lastSyncMillis = millis();
      String message = "Time resynced: ";
      message.concat(getFormattedTime(currentTimestamp));
      DEBUG_PRINT(message);
    }
  } else if (millis() - lastSyncMillis >= 1000) {
    noInterrupts();
    currentTimestamp++;
    interrupts();
    lastSyncMillis = millis();
  }

  if (Firebase.ready() && (millis() - sendDataPrevMillis > timerDelay || sendDataPrevMillis == 0)) {
    sendDataPrevMillis = millis();

    String queueStatus = "Queue head: ";
    queueStatus.concat(String(queueHead));
    queueStatus.concat(", tail: ");
    queueStatus.concat(String(queueTail));
    DEBUG_PRINT(queueStatus);

    while (queueHead != queueTail) {
      CounterEvent event;
      noInterrupts();
      event = eventQueue[queueHead];
      queueHead = (queueHead + 1) % QUEUE_SIZE;
      interrupts();

      String eventPath = "/UsersData/";
      eventPath.concat(uid);
      eventPath.concat("/count-");
      eventPath.concat(String(event.counterId));
      eventPath.concat("/");
      eventPath.concat(String(event.timestamp));

      FirebaseJson json;
      json.set("counterValue", (event.counterId == 1) ? counter1Value : 
                              (event.counterId == 2) ? counter2Value : counter3Value);

      if (WiFi.status() == WL_CONNECTED) {
        DEBUG_PRINT("Attempting to write to: " + eventPath);
        if (Firebase.RTDB.setJSON(&fbdo, eventPath.c_str(), &json)) {
          DEBUG_PRINT("Set event ok: " + eventPath);
        } else {
          DEBUG_PRINT("Set event failed: " + String(fbdo.errorReason()));
          Firebase.reconnectWiFi(true);
        }
      } else {
        DEBUG_PRINT("WiFi not connected, skipping Firebase write");
      }
    }
  }
}