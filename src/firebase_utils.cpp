#include "firebase_utils.h"
#include "config.h"
#include "debug.h"
#include "time_utils.h"
#include "addons/TokenHelper.h" // Включаем TokenHelper.h только в этом .cpp файле
#include <vector>
#include <algorithm>

// Определение глобальных объектов
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
String uid;

unsigned long sendDataPrevMillis = 0;
unsigned long timerDelay = 15000;
const unsigned long firebaseWriteInterval = 1000;
unsigned long lastFirebaseWrite = 0;

void initFirebase() {
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.token_status_callback = tokenStatusCallback; // Определено в TokenHelper.h
  config.max_token_generation_retry = 5;
  config.timeout.serverResponse = 30000;
  config.timeout.wifiReconnect = 15000;

  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;

  Firebase.reconnectWiFi(true);
  fbdo.setResponseSize(16384);

  Firebase.begin(&config, &auth);

  unsigned long uidTimeout = millis();
  while (auth.token.uid == "" && millis() - uidTimeout < 30000) {
    delay(100);
  }
  if (auth.token.uid == "") {
    DEBUG_PRINT("Failed to get UID");
  } else {
    uid = auth.token.uid.c_str();
    String uidMessage = "User UID: ";
    uidMessage.concat(uid);
    DEBUG_PRINT(uidMessage);
  }
}

void loadInitialCounterValues() {
  if (Firebase.ready()) {
    for (int i = 1; i <= 3; i++) {
      String path = "/UsersData/" + uid + "/count-" + String(i);
      if (!Firebase.RTDB.pathExisted(&fbdo, path.c_str())) {
        FirebaseJson initJson;
        FirebaseJson eventData;
        eventData.set("counterValue", 0);
        initJson.set(String(currentTimestamp) + "-00000", eventData); // Новый формат ключа
        String initPath = path + "/" + String(currentTimestamp);
        if (Firebase.RTDB.setJSON(&fbdo, initPath.c_str(), &initJson)) {
          DEBUG_PRINT("Initialized counter" + String(i) + " with 0");
        }
      }
    }

    int values[3] = {0, 0, 0};
    for (int i = 0; i < 3; i++) {
      String path = "/UsersData/" + uid + "/count-" + String(i + 1);
      QueryFilter query;
      query.orderBy("$key");
      query.limitToLast(1);

      if (Firebase.RTDB.getJSON(&fbdo, path.c_str(), &query)) {
        FirebaseJson* json = fbdo.jsonObjectPtr();
        size_t batchCount = json->iteratorBegin();
        if (batchCount > 0) {
          String batchKey, batchValue;
          int type;
          json->iteratorGet(0, type, batchKey, batchValue);

          FirebaseJson batchJson;
          batchJson.setJsonData(batchValue);
          size_t eventCount = batchJson.iteratorBegin();
          String latestKey = "";
          int lastValue = 0;

          // Ищем последнее событие, сравнивая ключи как строки
          for (size_t j = 0; j < eventCount; j++) {
            String eventKey, eventValue;
            int eventType;
            batchJson.iteratorGet(j, eventType, eventKey, eventValue);
            if (eventKey > latestKey) { // Лексикографическое сравнение строк
              FirebaseJsonData result;
              batchJson.get(result, eventKey + "/counterValue");
              if (result.success) {
                latestKey = eventKey;
                lastValue = result.to<int>();
              }
            }
          }
          values[i] = lastValue;
          DEBUG_PRINT("Loaded counter" + String(i + 1) + ": " + String(lastValue));
          batchJson.iteratorEnd();
        } else {
          DEBUG_PRINT("No data for counter" + String(i + 1));
        }
        json->iteratorEnd();
        json->clear();
      } else {
        DEBUG_PRINT("Failed to load " + path + ": " + fbdo.errorReason());
      }
      query.clear();
    }
    counter1Value = values[0];
    counter2Value = values[1];
    counter3Value = values[2];
    DEBUG_PRINT("Counters set to: c1=" + String(counter1Value) + ", c2=" + String(counter2Value) + ", c3=" + String(counter3Value));
  } else {
    DEBUG_PRINT("Firebase not ready, counters set to 0");
    counter1Value = 0;
    counter2Value = 0;
    counter3Value = 0;
  }
}

void processQueue() {
  if (Firebase.ready() && (millis() - sendDataPrevMillis > timerDelay || sendDataPrevMillis == 0)) {
    if (millis() - lastFirebaseWrite < firebaseWriteInterval) return;
    sendDataPrevMillis = millis();

    const int batchSize = 10;
    while (queueHead != queueTail) {
      std::vector<FirebaseJson> batchData(3);
      std::vector<bool> hasEvents(3, false);
      int eventsProcessed = 0;
      unsigned long batchTimestamp = 0;

      while (queueHead != queueTail && eventsProcessed < batchSize) {
        CounterEvent event;
        noInterrupts();
        event = eventQueue[queueHead];
        queueHead = (queueHead + 1) % QUEUE_SIZE;
        interrupts();

        if (eventsProcessed == 0) batchTimestamp = event.timestamp;

        // Формируем ключ в формате timestamp-sequence
        String sequencePart = String(event.sequence);
        while (sequencePart.length() < 5) sequencePart = "0" + sequencePart; // Дополняем нули до 5 цифр
        String eventKey = String(event.timestamp) + "-" + sequencePart;

        FirebaseJson eventData;
        eventData.set("counterValue", event.counterValue);
        batchData[event.counterId - 1].set(eventKey, eventData);
        hasEvents[event.counterId - 1] = true;
        eventsProcessed++;
      }

      for (int i = 0; i < 3; i++) {
        if (hasEvents[i]) {
          String path = "/UsersData/" + uid + "/count-" + String(i + 1) + "/" + String(batchTimestamp);
          if (Firebase.RTDB.setJSON(&fbdo, path.c_str(), &batchData[i])) {
            DEBUG_PRINT("Batch written to: " + path);
            lastFirebaseWrite = millis();
          }
        }
      }
    }
  }
}

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
      }
    }
    json->iteratorEnd();
    json->clear();
  }
}