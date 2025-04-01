#include "config.h"
#include <Arduino.h>
#include "SPIFFS.h"
#include <WiFi.h>
#include <WebServer.h>
#include <ESP8266FtpServer.h> // Используем nailbuster/ESP8266FtpServer
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

// Database paths
String databasePath;
String countersPath;

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
unsigned long timerDelay = 20000;

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

// Initialize WiFi
void initWiFi() {
  WiFi.config(local_ip, gateway, subnet, dns);
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

void listSPIFFSFiles() {
  File root = SPIFFS.open("/");
  File file = root.openNextFile();
  while (file) {
    Serial.print("File: ");
    Serial.print(file.name());
    Serial.print(" | Size: ");
    Serial.println(file.size());
    file = root.openNextFile();
  }
  root.close();
}

void readSPIFFSFile(const char* path) {
  File file = SPIFFS.open(path, "r");
  if (!file) {
    Serial.println("Failed to open file for reading");
    return;
  }
  Serial.print("Reading file: ");
  Serial.println(path);
  while (file.available()) {
    Serial.write(file.read());
  }
  Serial.println("\nEnd of file");
  file.close();
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
    DEBUG_PRINT("NTP sync failed, proceeding with default time");
    currentTimestamp = millis() / 1000;
  }
  lastSyncTime = currentTimestamp;
  lastSyncMillis = millis();

  // Форматирование SPIFFS
  DEBUG_PRINT("Formatting SPIFFS...");
  if (SPIFFS.format()) {
    DEBUG_PRINT("SPIFFS formatted successfully");
  } else {
    DEBUG_PRINT("SPIFFS formatting failed");
    while (true);
  }

  // Монтирование SPIFFS после форматирования
  if (!SPIFFS.begin(true)) {
    DEBUG_PRINT("SPIFFS Mount Failed");
    while (true);
  }
  DEBUG_PRINT("SPIFFS Mounted successfully");
  listSPIFFSFiles(); // Должно быть пусто после форматирования

  // Проверка объёма
  if (SPIFFS.totalBytes() == 0) {
    DEBUG_PRINT("SPIFFS not available or empty!");
  } else {
    String message = "SPIFFS total bytes: ";
    message.concat(SPIFFS.totalBytes());
    DEBUG_PRINT(message);
  }

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
  String message = "User UID: ";
  message.concat(uid);
  DEBUG_PRINT(message);

  databasePath = "/UsersData/";
  databasePath.concat(uid);
  databasePath.concat("/counter_events");
  
  countersPath = "/UsersData/";
  countersPath.concat(uid);
  countersPath.concat("/counter_values");

  http.begin();
  ftpSrv.begin("relay", "relay");
  DEBUG_PRINT("FTP server started @ " + WiFi.localIP().toString());
  File root = SPIFFS.open("/");
  if (!root) {
    DEBUG_PRINT("Failed to open SPIFFS root for FTP check");
  } else {
    DEBUG_PRINT("SPIFFS root opened successfully for FTP");
    root.close();
  }
  DEBUG_PRINT("Server listening");

  setupRoutes();
}

void loop() {
  http.handleClient();
  ftpSrv.handleFTP(); // Обработка FTP-запросов

  static unsigned long lastCheck = 0;
  if (millis() - lastCheck > 10000) {
    DEBUG_PRINT("Listing SPIFFS files:");
    listSPIFFSFiles();
    lastCheck = millis();
  }

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
    while (queueHead != queueTail) {
      CounterEvent event;
      noInterrupts();
      event = eventQueue[queueHead];
      queueHead = (queueHead + 1) % QUEUE_SIZE;
      interrupts();

      FirebaseJson json;
      String eventPath = databasePath;
      eventPath.concat("/");
      eventPath.concat(String(event.timestamp));
      eventPath.concat("_");
      eventPath.concat(String(event.counterId));
      json.set("/counter_id", event.counterId);
      json.set("/timestamp", getFormattedTime(event.timestamp));
      json.set("/epoch_time", event.timestamp);
      String errorMessage = "Set event json... ";
      errorMessage.concat(fbdo.errorReason());
      DEBUG_PRINT(Firebase.RTDB.setJSON(&fbdo, eventPath.c_str(), &json) ? "Set event json... ok" : errorMessage);
    }

    FirebaseJson counterJson;
    counterJson.set("/counter1", counter1Value);
    counterJson.set("/counter2", counter2Value);
    counterJson.set("/counter3", counter3Value);
    counterJson.set("/last_update", getFormattedTime(currentTimestamp));
    String errorMessage = "Set counter values... ";
    errorMessage.concat(fbdo.errorReason());
    DEBUG_PRINT(Firebase.RTDB.setJSON(&fbdo, countersPath.c_str(), &counterJson) ? "Set counter values... ok" : errorMessage);
  }
}