#include "config.h"
#include <Arduino.h>
#include "SPIFFS.h"
#include "debug.h"
#include "counter.h"
#include "network.h"
#include "time_utils.h"
#include "firebase_utils.h"

const int LED_PIN = 2;

void setup() {
  #ifdef DEBUG
    Serial.begin(115200);
  #endif

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  setupCounters();
  initWiFi();
  initTime();
  if (!SPIFFS.begin(true)) {
    DEBUG_PRINT("SPIFFS Mount Failed");
    while (true) delay(1000);
  }
  initFirebase();
  loadInitialCounterValues();
  setupNetworkServices();
}

void loop() {
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

  ResetEvent resetEvent = checkAndResetCounters();
  if (resetEvent.triggered) {
    if (resetEvent.previousValue > 0) {
      String storyPath = "/UsersData/" + uid + "/count_story/count-" + String(resetEvent.counterId) + "/" + String(currentTimestamp);
      FirebaseJson json;
      json.set("counterValue", resetEvent.previousValue);

      if (WiFi.status() == WL_CONNECTED && Firebase.ready()) {
        DEBUG_PRINT("Writing to count_story: " + storyPath);
        if (Firebase.RTDB.setJSON(&fbdo, storyPath.c_str(), &json)) {
          DEBUG_PRINT("Count story updated successfully for counter" + String(resetEvent.counterId));

          // Записываем событие с нулевым значением в count-X
          String batchPath = "/UsersData/" + uid + "/count-" + String(resetEvent.counterId) + "/" + String(currentTimestamp);
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
  }

  http.handleClient();
  ftpSrv.handleFTP();
  updateTime();
  processQueue();
  updateLed();
}