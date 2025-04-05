#include "config.h"
#include <Arduino.h>
#include "SPIFFS.h"
#include <WiFi.h>
#include <WebServer.h>
#include <ESP8266FtpServer.h>
#include <Firebase_ESP_Client.h>
#include "routes.h"
#include "time.h"
#include <vector>
#include <algorithm>

#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// Определяем DEBUG_PRINT в самом начале
#define DEBUG // Можно закомментировать, чтобы отключить отладку
#ifdef DEBUG
  #define DEBUG_PRINT(x) do { if (Serial) Serial.println(x); } while (0)
#else
  #define DEBUG_PRINT(x)
#endif

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
  unsigned long timestamp; // Временная метка в секундах
  unsigned long millisTimestamp; // Миллисекунды для уникальности
  int counterValue;
};

// Queue for counter events
#define QUEUE_SIZE 50 // Уменьшено для экономии памяти
CounterEvent eventQueue[QUEUE_SIZE];
volatile int queueHead = 0;
volatile int queueTail = 0;

// Counter values
volatile int counter1Value;
volatile int counter2Value;
volatile int counter3Value;

// Флаги для обработки событий в loop()
volatile bool counter1Triggered = false;
volatile bool counter2Triggered = false;
volatile bool counter3Triggered = false;

// Pin definitions
const int COUNTER1_PIN = 14; // Увеличивает counter1
const int COUNTER2_PIN = 26; // Увеличивает counter2
const int COUNTER3_PIN = 27; // Увеличивает counter3
const int RESET1_PIN = 32;   // Сбрасывает counter1
const int RESET2_PIN = 33;   // Сбрасывает counter2
const int RESET3_PIN = 25;   // Сбрасывает counter3
const int LED_PIN = 2;

// Wi-Fi LED blink variables
unsigned long lastBlinkMillis = 0;
const unsigned long blinkInterval = 1000;
bool ledState = false;

// Debounce variables
unsigned long lastResetTime1 = 0; // Для сброса
unsigned long lastResetTime2 = 0;
unsigned long lastResetTime3 = 0;
const unsigned long debounceDelay = 500; // Увеличено до 500 мс

// Timer variables
unsigned long sendDataPrevMillis = 0;
unsigned long timerDelay = 15000; // Увеличено до 15 секунд
const unsigned long firebaseWriteInterval = 1000; // Минимальный интервал между запросами (1 секунда)
unsigned long lastFirebaseWrite = 0;

const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 7200;  // UTC+2 для Украины
const int daylightOffset_sec = 0;

// Variables for time synchronization
volatile unsigned long currentTimestamp = 0;
unsigned long lastSyncTime = 0;
unsigned long lastSyncMillis = 0;

// Interrupt Service Routines with debounce
void IRAM_ATTR counter1ISR() {
  static unsigned long lastTrigger = 0;
  unsigned long currentMillis = millis();
  if (currentMillis - lastTrigger > debounceDelay) {
    counter1Triggered = true;
    lastTrigger = currentMillis;
  }
}

void IRAM_ATTR counter2ISR() {
  static unsigned long lastTrigger = 0;
  unsigned long currentMillis = millis();
  if (currentMillis - lastTrigger > debounceDelay) {
    counter2Triggered = true;
    lastTrigger = currentMillis;
  }
}

void IRAM_ATTR counter3ISR() {
  static unsigned long lastTrigger = 0;
  unsigned long currentMillis = millis();
  if (currentMillis - lastTrigger > debounceDelay) {
    counter3Triggered = true;
    lastTrigger = currentMillis;
  }
}

// Функция для обработки событий счетчиков
void processCounterEvent(int counterId, volatile int& counterValue) {
  counterValue++;
  DEBUG_PRINT("Counter" + String(counterId) + " incremented: " + String(counterValue));
  int queueSize = (queueTail >= queueHead) ? (queueTail - queueHead) : (queueTail + QUEUE_SIZE - queueHead);
  if (queueSize >= QUEUE_SIZE * 0.9) { // Если очередь заполнена на 90%
    DEBUG_PRINT("Queue almost full (" + String(queueSize) + "/" + String(QUEUE_SIZE) + "), event for counter " + String(counterId) + " dropped");
    return;
  }
  int nextTail = (queueTail + 1) % QUEUE_SIZE;
  if (nextTail != queueHead) {
    eventQueue[queueTail].counterId = counterId;
    eventQueue[queueTail].timestamp = currentTimestamp;
    eventQueue[queueTail].millisTimestamp = millis(); // Сохраняем текущие миллисекунды
    eventQueue[queueTail].counterValue = counterValue;
    DEBUG_PRINT("Event added to queue for counter " + String(counterId));
  } else {
    DEBUG_PRINT("Queue full, event for counter " + String(counterId) + " dropped");
  }
  queueTail = nextTail;
}

// Initialize WiFi с явным указанием DNS
void initWiFi() {
  IPAddress primaryDNS(8, 8, 8, 8);   // Google DNS 1
  IPAddress secondaryDNS(8, 8, 4, 4); // Google DNS 2
  WiFi.config(local_ip, gateway, subnet, primaryDNS, secondaryDNS);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  DEBUG_PRINT("Connecting to WiFi ..");
  
  unsigned long startAttemptTime = millis();
  const unsigned long wifiTimeout = 60000; // Увеличено до 60 секунд

  while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < wifiTimeout) {
    if (millis() - lastBlinkMillis >= blinkInterval) {
      ledState = !ledState;
      digitalWrite(LED_PIN, ledState);
      lastBlinkMillis = millis();
    }
  }

  if (WiFi.status() == WL_CONNECTED) {
    DEBUG_PRINT("");
    DEBUG_PRINT(WiFi.localIP().toString());
    DEBUG_PRINT("WiFi connected");
    digitalWrite(LED_PIN, HIGH);
  } else {
    DEBUG_PRINT("");
    DEBUG_PRINT("Failed to connect to WiFi, restarting...");
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
    DEBUG_PRINT("Failed to obtain time");
    return 0;
  }
  time(&now);
  return now;
}

// Функция для очистки старых пачек событий
void cleanupOldEvents(String path, int maxBatches) {
  if (Firebase.RTDB.getJSON(&fbdo, path.c_str())) {
    FirebaseJson* json = fbdo.jsonObjectPtr();
    size_t count = json->iteratorBegin();
    if (count > maxBatches) {
      std::vector<String> keys;
      for (size_t i = 0; i < count; i++) {
        String key, value;
        int type;
        json->iteratorGet(i, type, key, value);
        keys.push_back(key);
      }
      std::sort(keys.begin(), keys.end());
      for (size_t i = 0; i < count - maxBatches; i++) {
        String batchPath = path + "/" + keys[i];
        Firebase.RTDB.deleteNode(&fbdo, batchPath.c_str());
        DEBUG_PRINT("Deleted old batch: " + batchPath);
      }
    }
    json->iteratorEnd();
    json->clear();
  }
}

void setup() {
  #ifdef DEBUG
    Serial.begin(115200);
  #endif

  pinMode(COUNTER1_PIN, INPUT_PULLUP);
  pinMode(COUNTER2_PIN, INPUT_PULLUP);
  pinMode(COUNTER3_PIN, INPUT_PULLUP);
  pinMode(RESET1_PIN, INPUT_PULLUP);
  pinMode(RESET2_PIN, INPUT_PULLUP);
  pinMode(RESET3_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // Проверяем, запустилась ли плата корректно
  unsigned long startTime = millis();
  delay(100);
  if (millis() - startTime < 50) { // Если время не прошло, значит плата зависла
    DEBUG_PRINT("Setup failed to progress, restarting...");
    ESP.restart();
  }

  DEBUG_PRINT("Setting up interrupts...");
  attachInterrupt(digitalPinToInterrupt(COUNTER1_PIN), counter1ISR, FALLING);
  attachInterrupt(digitalPinToInterrupt(COUNTER2_PIN), counter2ISR, FALLING);
  attachInterrupt(digitalPinToInterrupt(COUNTER3_PIN), counter3ISR, FALLING);
  DEBUG_PRINT("Interrupts set up");

  DEBUG_PRINT("Initializing WiFi...");
  initWiFi();

  if (WiFi.status() != WL_CONNECTED) {
    DEBUG_PRINT("WiFi failed to initialize, restarting...");
    ESP.restart(); // Программный сброс
  }

  DEBUG_PRINT("Configuring time...");
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

  DEBUG_PRINT("Mounting SPIFFS...");
  if (!SPIFFS.begin(true)) {
    DEBUG_PRINT("SPIFFS Mount Failed");
    while (true) {
      digitalWrite(LED_PIN, HIGH); // Индикация ошибки
      delay(500);
      digitalWrite(LED_PIN, LOW);
      delay(500);
    }
  }
  DEBUG_PRINT("SPIFFS Mounted successfully");

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.token_status_callback = tokenStatusCallback;
  config.max_token_generation_retry = 5;
  config.timeout.serverResponse = 30000; // Увеличено до 30 секунд
  config.timeout.wifiReconnect = 15000;  // Увеличено до 15 секунд

  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;

  Firebase.reconnectWiFi(true);
  fbdo.setResponseSize(16384); // Увеличено до 16 КБ

  DEBUG_PRINT("Initializing Firebase...");
  Firebase.begin(&config, &auth);

  DEBUG_PRINT("Getting User UID...");
  unsigned long uidTimeout = millis();
  while (auth.token.uid == "" && millis() - uidTimeout < 30000) {
    delay(100);
  }
  if (auth.token.uid == "") {
    DEBUG_PRINT("Failed to get UID, proceeding with empty UID");
  } else {
    uid = auth.token.uid.c_str();
    String uidMessage = "User UID: ";
    uidMessage.concat(uid);
    DEBUG_PRINT(uidMessage);
  }

  // Тестовая запись в Firebase и инициализация счетчиков
  if (Firebase.ready()) {
    FirebaseJson testJson;
    testJson.set("counterValue", 42);
    if (Firebase.RTDB.setJSON(&fbdo, "/UsersData/" + uid + "/test", &testJson)) {
      DEBUG_PRINT("Test data written successfully");
    } else {
      DEBUG_PRINT("Failed to write test data: " + fbdo.errorReason());
    }

    // Инициализация счетчиков, если данных нет
    for (int i = 1; i <= 3; i++) {
      String path = "/UsersData/" + uid + "/count-" + String(i);
      if (!Firebase.RTDB.pathExisted(&fbdo, path.c_str())) {
        FirebaseJson initJson;
        FirebaseJson eventData;
        eventData.set("counterValue", 0);
        initJson.set(String(currentTimestamp) + "000", eventData);
        String initPath = path + "/" + String(currentTimestamp);
        if (Firebase.RTDB.setJSON(&fbdo, initPath.c_str(), &initJson)) {
          DEBUG_PRINT("Initialized counter" + String(i) + " with 0");
        } else {
          DEBUG_PRINT("Failed to initialize counter" + String(i) + ": " + fbdo.errorReason());
        }
      }
    }
  }

  // Загрузка последних значений счетчиков из Firebase
  if (WiFi.status() == WL_CONNECTED && Firebase.ready()) {
    const int maxAttempts = 5;
    int attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;
      DEBUG_PRINT("Attempt " + String(attempt) + " to load counters from Firebase...");

      int values[3] = {0, 0, 0}; // Для хранения значений счетчиков
      bool allFailed = true;

      // Загружаем данные для каждого счетчика
      for (int i = 0; i < 3; i++) {
        String path = "/UsersData/" + uid + "/count-" + String(i + 1);
        FirebaseData queryFbdo;

        // Настраиваем QueryFilter для получения последней порции
        QueryFilter query;
        query.orderBy("$key"); // Сортируем по ключам (временным меткам)
        query.limitToLast(1);  // Берем только последнюю порцию

        if (Firebase.RTDB.getJSON(&queryFbdo, path.c_str(), &query)) {
          if (queryFbdo.dataType() == "json") {
            FirebaseJson* json = queryFbdo.jsonObjectPtr();
            size_t batchCount = json->iteratorBegin();
            if (batchCount > 0) {
              unsigned long latestTimestamp = 0;
              int lastValue = 0;

              // Получаем последнюю порцию
              String batchKey, batchValue;
              int type;
              json->iteratorGet(0, type, batchKey, batchValue);

              // Получаем содержимое порции
              FirebaseJson batchJson;
              batchJson.setJsonData(batchValue);
              size_t eventCount = batchJson.iteratorBegin();

              // Проходим по всем событиям в порции, чтобы найти последнее
              for (size_t k = 0; k < eventCount; k++) {
                String eventKey, eventValue;
                int eventType;
                batchJson.iteratorGet(k, eventType, eventKey, eventValue);

                // Преобразуем ключ (временную метку) в число
                unsigned long eventTimestamp = eventKey.toInt();
                if (eventTimestamp > latestTimestamp) {
                  FirebaseJsonData result;
                  batchJson.get(result, eventKey + "/counterValue");
                  if (result.success) {
                    latestTimestamp = eventTimestamp;
                    lastValue = result.to<int>();
                  }
                }
              }
              batchJson.iteratorEnd();
              batchJson.clear();

              values[i] = lastValue;
              DEBUG_PRINT("Loaded last value for counter" + String(i + 1) + ": " + String(lastValue));
              allFailed = false;
            } else {
              DEBUG_PRINT("No data for counter" + String(i + 1) + ", using 0");
            }
            json->iteratorEnd();
            json->clear();
          } else {
            DEBUG_PRINT("Unexpected data type for counter" + String(i + 1) + ": " + queryFbdo.dataType());
          }
        } else {
          String errorReason = queryFbdo.errorReason();
          if (errorReason == "") errorReason = "Unknown error";
          DEBUG_PRINT("Failed to load " + path + ": " + errorReason + ", using 0");
        }

        // Очищаем QueryFilter после использования
        query.clear();
      }

      if (!allFailed) {
        counter1Value = values[0];
        counter2Value = values[1];
        counter3Value = values[2];
        DEBUG_PRINT("Counters set to: c1=" + String(counter1Value) + ", c2=" + String(counter2Value) + ", c3=" + String(counter3Value));
        break;
      } else {
        DEBUG_PRINT("All counters failed, retrying...");
        delay(2000);
        Firebase.reconnectWiFi(true);
      }
    }

    if (attempt >= maxAttempts) {
      DEBUG_PRINT("Max attempts reached, setting counters to 0");
      counter1Value = 0;
      counter2Value = 0;
      counter3Value = 0;
    }
  } else {
    DEBUG_PRINT("No WiFi or Firebase not ready, counters set to 0");
    counter1Value = 0;
    counter2Value = 0;
    counter3Value = 0;
  }

  http.begin();
  ftpSrv.begin("relay", "relay");
  String msg = "FTP server started @ ";
  msg.concat(WiFi.localIP().toString());
  DEBUG_PRINT(msg);
  DEBUG_PRINT("Server listening");

  setupRoutes();
}

void loop() {
  // Обрабатываем события счетчиков
  if (counter1Triggered) {
    noInterrupts();
    counter1Triggered = false;
    interrupts();
    processCounterEvent(1, counter1Value);
  }
  if (counter2Triggered) {
    noInterrupts();
    counter2Triggered = false;
    interrupts();
    processCounterEvent(2, counter2Value);
  }
  if (counter3Triggered) {
    noInterrupts();
    counter3Triggered = false;
    interrupts();
    processCounterEvent(3, counter3Value);
  }

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
    Firebase.reconnectWiFi(true);
  }

  // Обработка пинов сброса
  int resetPins[3] = {RESET1_PIN, RESET2_PIN, RESET3_PIN};
  volatile int* counters[3] = {&counter1Value, &counter2Value, &counter3Value};
  unsigned long lastResetTimes[3] = {lastResetTime1, lastResetTime2, lastResetTime3};

  for (int i = 0; i < 3; i++) {
    if (digitalRead(resetPins[i]) == LOW && millis() - lastResetTimes[i] > debounceDelay) {
      DEBUG_PRINT("Reset triggered for counter " + String(i + 1) + " on pin " + String(resetPins[i]));
      if (*counters[i] > 0) {
        String storyPath = "/UsersData/" + uid + "/count_story/count-" + String(i + 1) + "/" + String(currentTimestamp);
        FirebaseJson json;
        json.set("counterValue", *counters[i]);

        if (WiFi.status() == WL_CONNECTED && Firebase.ready()) {
          DEBUG_PRINT("Writing to count_story: " + storyPath);
          if (Firebase.RTDB.setJSON(&fbdo, storyPath.c_str(), &json)) {
            DEBUG_PRINT("Count story updated successfully for counter" + String(i + 1));
            *counters[i] = 0;
            DEBUG_PRINT("Counter" + String(i + 1) + " reset to 0");

            // Записываем событие с нулевым значением в count-X
            String batchPath = "/UsersData/" + uid + "/count-" + String(i + 1) + "/" + String(currentTimestamp);
            FirebaseJson batchData;
            String eventKey = String(currentTimestamp) + String(millis() % 1000);
            FirebaseJson eventData;
            eventData.set("counterValue", 0);
            batchData.set(eventKey, eventData);
            if (Firebase.RTDB.setJSON(&fbdo, batchPath.c_str(), &batchData)) {
              DEBUG_PRINT("Reset event written to: " + batchPath);
            } else {
              DEBUG_PRINT("Failed to write reset event: " + fbdo.errorReason());
            }
          } else {
            DEBUG_PRINT("Failed to update count_story: " + fbdo.errorReason());
          }
        } else {
          DEBUG_PRINT("WiFi or Firebase not ready, skipping count_story write");
        }
        json.clear();
      }
      lastResetTimes[i] = millis();
    }
  }
  lastResetTime1 = lastResetTimes[0];
  lastResetTime2 = lastResetTimes[1];
  lastResetTime3 = lastResetTimes[2];

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

  // Очистка старых данных раз в час
  static unsigned long lastCleanup = 0;
  if (millis() - lastCleanup >= 3600000) { // Раз в час
    for (int i = 1; i <= 3; i++) {
      String path = "/UsersData/" + uid + "/count-" + String(i);
      cleanupOldEvents(path, 10); // Храним только последние 10 пачек
    }
    lastCleanup = millis();
  }

  // Обработка очереди событий
  if (Firebase.ready() && (millis() - sendDataPrevMillis > timerDelay || sendDataPrevMillis == 0)) {
    if (millis() - lastFirebaseWrite < firebaseWriteInterval) {
      return; // Пропускаем, если прошло меньше 1 секунды с последнего запроса
    }
    sendDataPrevMillis = millis();

    // Проверяем статус токена
    if (!Firebase.ready()) {
      DEBUG_PRINT("Firebase not ready, attempting to re-authenticate...");
      Firebase.reconnectWiFi(true);
      Firebase.begin(&config, &auth);
    }

    static bool queueEmptyLogged = false;
    if (queueHead == queueTail && !queueEmptyLogged) {
      String queueStatus = "Queue head: ";
      queueStatus.concat(String(queueHead));
      queueStatus.concat(", tail: ");
      queueStatus.concat(String(queueTail));
      DEBUG_PRINT(queueStatus);
      queueEmptyLogged = true;
    }

    static int maxQueueAttempts = 5; // Максимальное количество попыток обработки очереди
    static int queueAttempts = 0;

    const int batchSize = 10; // Максимальный размер порции (10 событий за раз)
    while (queueHead != queueTail) {
      queueEmptyLogged = false;
      String queueStatus = "Queue head: ";
      queueStatus.concat(String(queueHead));
      queueStatus.concat(", tail: ");
      queueStatus.concat(String(queueTail));
      DEBUG_PRINT(queueStatus);

      // Проверяем количество попыток обработки очереди
      queueAttempts++;
      if (queueAttempts >= maxQueueAttempts) {
        DEBUG_PRINT("Max queue attempts reached, clearing queue to prevent infinite loop");
        noInterrupts();
        queueHead = queueTail; // Очищаем очередь
        queueAttempts = 0;
        interrupts();
        break;
      }

      // Проверяем, что UID не пустой
      if (uid == "") {
        DEBUG_PRINT("UID is empty, cannot write to Firebase");
        break;
      }

      // Создаем одну пачку для каждого счетчика
      std::vector<FirebaseJson> batchData(3); // Массив для хранения данных по каждому счетчику
      std::vector<bool> hasEvents(3, false); // Флаги, чтобы отслеживать, есть ли события для счетчика
      int eventsProcessed = 0;
      unsigned long batchTimestamp = 0; // Временная метка для пачки (первого события)

      // Обрабатываем события порцией
      while (queueHead != queueTail && eventsProcessed < batchSize) {
        CounterEvent event;
        noInterrupts();
        event = eventQueue[queueHead];
        queueHead = (queueHead + 1) % QUEUE_SIZE;
        interrupts();

        DEBUG_PRINT("Processing event for counter " + String(event.counterId) + " at timestamp " + String(event.timestamp));

        // Если это первое событие, используем его временную метку как ключ пачки
        if (eventsProcessed == 0) {
          batchTimestamp = event.timestamp;
        }

        // Формируем уникальный ключ для события
        String eventKey = String(event.timestamp);
        String millisPart = String(event.millisTimestamp % 1000);
        while (millisPart.length() < 3) millisPart = "0" + millisPart; // Дополняем нули слева
        eventKey += millisPart;

        // Создаем JSON-объект для события
        FirebaseJson eventData;
        eventData.set("counterValue", event.counterValue);

        // Добавляем событие в соответствующую пачку для счетчика
        int counterIndex = event.counterId - 1;
        batchData[counterIndex].set(eventKey, eventData);
        hasEvents[counterIndex] = true;

        eventsProcessed++;
      }

      // Отправляем пачки для каждого счетчика
      if (WiFi.status() == WL_CONNECTED && WiFi.RSSI() > -80 && eventsProcessed > 0) {
        bool allSuccess = true;
        for (int i = 0; i < 3; i++) {
          if (hasEvents[i]) {
            String batchPath = "/UsersData/" + uid + "/count-" + String(i + 1) + "/" + String(batchTimestamp);
            const int maxRetryAttempts = 3;
            int retryAttempt = 0;
            bool success = false;
            while (retryAttempt < maxRetryAttempts && !success) {
              if (Firebase.RTDB.setJSON(&fbdo, batchPath.c_str(), &batchData[i])) {
                DEBUG_PRINT("Batch written to: " + batchPath + " with events for counter " + String(i + 1));
                lastFirebaseWrite = millis();
                success = true;
              } else {
                DEBUG_PRINT("Failed to write batch for counter " + String(i + 1) + " (attempt " + String(retryAttempt + 1) + "): " + fbdo.errorReason());
                if (fbdo.errorReason() == "Permission denied") {
                  DEBUG_PRINT("Permission denied, attempting to re-authenticate...");
                  Firebase.reconnectWiFi(true);
                  Firebase.begin(&config, &auth);
                }
                retryAttempt++;
                delay(2000);
              }
            }
            if (!success) {
              allSuccess = false;
              break;
            }
          }
        }
        if (!allSuccess) {
          DEBUG_PRINT("Max retry attempts reached, rolling back queue");
          noInterrupts();
          queueHead = (queueHead - eventsProcessed + QUEUE_SIZE) % QUEUE_SIZE; // Откатываем queueHead
          interrupts();
          break;
        }
      } else if (eventsProcessed > 0) {
        DEBUG_PRINT("WiFi not connected or signal too weak (RSSI: " + String(WiFi.RSSI()) + "), rolling back queue");
        noInterrupts();
        queueHead = (queueHead - eventsProcessed + QUEUE_SIZE) % QUEUE_SIZE; // Откатываем queueHead
        interrupts();
        break;
      }
    }
    if (queueHead == queueTail) {
      queueAttempts = 0; // Сбрасываем счетчик, если очередь пуста
    }
  }
}