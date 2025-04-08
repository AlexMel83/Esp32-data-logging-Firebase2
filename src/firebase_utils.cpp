#include "firebase_utils.h"
#include "config.h"
#include "debug.h"
#include "time_utils.h"
#include "addons/TokenHelper.h"
#include <vector>
#include <algorithm>

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
String uid;

unsigned long sendDataPrevMillis = 0;
unsigned long timerDelay = 15000;
const unsigned long firebaseWriteInterval = 1000;
unsigned long lastFirebaseWrite = 0;

bool firebaseInitialized = false;
bool firebaseErrorState = false;
unsigned long lastInitAttempt = 0;
const unsigned long initRetryInterval = 30000;

void initFirebase() {
  if (firebaseInitialized) return;
  DEBUG_PRINT("Initializing Firebase...");

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.token_status_callback = tokenStatusCallback;
  config.max_token_generation_retry = 5;
  config.timeout.serverResponse = 10000;
  config.timeout.wifiReconnect = 5000;

  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;

  Firebase.reconnectWiFi(true);
  fbdo.setResponseSize(16384);

  Firebase.begin(&config, &auth);

  unsigned long start = millis();
  while (auth.token.uid == "" && millis() - start < 5000) {
    delay(50);
  }
  if (auth.token.uid == "") {
    DEBUG_PRINT("Failed to get UID");
    firebaseErrorState = true;
    return;
  }
  uid = auth.token.uid.c_str();
  DEBUG_PRINT("User UID: " + uid);
  firebaseInitialized = true;
  firebaseErrorState = false;
}

void firebaseLoop() {
  if (!WiFi.isConnected()) {
    DEBUG_PRINT("WiFi disconnected, skipping firebaseLoop");
    return;
  }

  if (!firebaseInitialized || firebaseErrorState) {
    if (millis() - lastInitAttempt > initRetryInterval) {
      lastInitAttempt = millis();
      initFirebase();
    }
    return;
  }

  if (!Firebase.ready()) {
    DEBUG_PRINT("Firebase not ready, skipping firebaseLoop");
    return;
  }
}

void loadInitialCounterValues() {
  firebaseLoop();
  if (!firebaseInitialized || firebaseErrorState) return;

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

        for (size_t j = 0; j < eventCount; j++) {
          String eventKey, eventValue;
          int eventType;
          batchJson.iteratorGet(j, eventType, eventKey, eventValue);
          if (eventKey > latestKey) {
            FirebaseJsonData result;
            batchJson.get(result, eventKey + "/counterValue");
            if (result.success) {
              latestKey = eventKey;
              lastValue = result.to<int>();
            }
          }
        }
        values[i] = lastValue;
        batchJson.iteratorEnd();
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
}

void processQueue() {
  firebaseLoop();
  if (!firebaseInitialized || firebaseErrorState) return;

  if (millis() - sendDataPrevMillis > timerDelay || sendDataPrevMillis == 0) {
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

        String sequencePart = String(event.sequence);
        while (sequencePart.length() < 5) sequencePart = "0" + sequencePart;
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
          } else {
            DEBUG_PRINT("Failed to write batch: " + fbdo.errorReason());
            firebaseErrorState = true;
          }
        }
      }
    }
  }
}

void cleanupOldEvents(String path, int maxBatches) {
  firebaseLoop();
  if (!firebaseInitialized || firebaseErrorState) return;

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
