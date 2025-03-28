#include "config.h"
#include <Arduino.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include "time.h"

// Provide the token generation process info
#include "addons/TokenHelper.h"
// Provide the RTDB payload printing info and other helper functions
#include "addons/RTDBHelper.h"

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

// Debounce variables
unsigned long lastDebounceTime1 = 0;
unsigned long lastDebounceTime2 = 0;
unsigned long lastDebounceTime3 = 0;
const unsigned long debounceDelay = 600; // 600ms debounce time

// Timer variables
unsigned long sendDataPrevMillis = 0;
unsigned long timerDelay = 20000;

const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 7200;  // UTC+2 для Украины
const int daylightOffset_sec = 0; // Без летнего времени

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
      eventQueue[queueTail].timestamp = currentTimestamp; // Используем текущую переменную
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
      eventQueue[queueTail].timestamp = currentTimestamp; // Используем текущую переменную
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
      eventQueue[queueTail].timestamp = currentTimestamp; // Используем текущую переменную
      queueTail = (queueTail + 1) % QUEUE_SIZE;
    }
    lastDebounceTime3 = currentMillis;
  }
}

// Initialize WiFi
void initWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi ..");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print('.');
    delay(1000);
  }
  Serial.println(WiFi.localIP());
  Serial.println();
}

// Function to get formatted time string
String getFormattedTime(unsigned long epochTime) {
  struct tm *ptm = localtime((time_t *)&epochTime); // Учитываем часовой пояс
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

  // Initialize counter pins
  pinMode(COUNTER1_PIN, INPUT_PULLUP);
  pinMode(COUNTER2_PIN, INPUT_PULLUP);
  pinMode(COUNTER3_PIN, INPUT_PULLUP);

  // Attach interrupts
  attachInterrupt(digitalPinToInterrupt(COUNTER1_PIN), counter1ISR, FALLING);
  attachInterrupt(digitalPinToInterrupt(COUNTER2_PIN), counter2ISR, FALLING);
  attachInterrupt(digitalPinToInterrupt(COUNTER3_PIN), counter3ISR, FALLING);

  initWiFi();
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

  // Get initial time reference
  while (currentTimestamp == 0) {
    currentTimestamp = getTime();
    if (currentTimestamp == 0) {
      Serial.println("Waiting for NTP sync...");
      delay(1000);
    } else {
      Serial.print("Time synced: ");
      Serial.println(getFormattedTime(currentTimestamp));
    }
  }
  lastSyncTime = currentTimestamp;
  lastSyncMillis = millis();

  // Assign Firebase config
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.token_status_callback = tokenStatusCallback;
  config.max_token_generation_retry = 5;

  // Assign user credentials
  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;

  Firebase.reconnectWiFi(true);
  fbdo.setResponseSize(4096);

  Serial.println("Initializing Firebase...");
  Firebase.begin(&config, &auth);

  // Wait for UID
  Serial.println("Getting User UID...");
  while (auth.token.uid == "") {
    Serial.print('.');
    delay(1000);
  }
  uid = auth.token.uid.c_str();
  Serial.print("User UID: ");
  Serial.println(uid);

  // Set database paths
  databasePath = "/UsersData/";
  databasePath.concat(uid);
  databasePath.concat("/counter_events");
  
  countersPath = "/UsersData/";
  countersPath.concat(uid);
  countersPath.concat("/counter_values");
}

void loop() {
  // Synchronize time every hour
  if (millis() - lastSyncMillis >= 3600000) {
    unsigned long ntpTime = getTime();
    if (ntpTime != 0) {
      noInterrupts();
      currentTimestamp = ntpTime;
      interrupts();
      lastSyncTime = currentTimestamp;
      lastSyncMillis = millis();
      Serial.print("Time resynced: ");
      Serial.println(getFormattedTime(currentTimestamp));
    }
  } else {
    // Обновляем currentTimestamp каждую секунду
    if (millis() - lastSyncMillis >= 1000) {
      noInterrupts();
      currentTimestamp++;
      interrupts();
      lastSyncMillis = millis();
    }
  }

  if (Firebase.ready() && (millis() - sendDataPrevMillis > timerDelay || sendDataPrevMillis == 0)) {
    sendDataPrevMillis = millis();

    // Process all events in queue
    while (queueHead != queueTail) {
      CounterEvent event;
      noInterrupts();
      event = eventQueue[queueHead];
      queueHead = (queueHead + 1) % QUEUE_SIZE;
      interrupts();

      FirebaseJson json;
      String eventPath = databasePath;
      eventPath += "/";
      eventPath += String(event.timestamp);
      eventPath += "_";
      eventPath += String(event.counterId);

      json.set("/counter_id", event.counterId);
      json.set("/timestamp", getFormattedTime(event.timestamp));
      json.set("/epoch_time", event.timestamp);

      Serial.printf("Set event json... %s\n",
                    Firebase.RTDB.setJSON(&fbdo, eventPath.c_str(), &json) ? "ok" : fbdo.errorReason().c_str());
    }

    // Update counter values
    FirebaseJson counterJson;
    counterJson.set("/counter1", counter1Value);
    counterJson.set("/counter2", counter2Value);
    counterJson.set("/counter3", counter3Value);
    counterJson.set("/last_update", getFormattedTime(currentTimestamp));

    Serial.printf("Set counter values... %s\n",
                  Firebase.RTDB.setJSON(&fbdo, countersPath.c_str(), &counterJson) ? "ok" : fbdo.errorReason().c_str());
  }
}