#include "config.h"
#include <Arduino.h>
#include "SPIFFS.h"
#include "debug.h"
#include "counter.h"
#include "network.h"
#include "time_utils.h"
#include "firebase_utils.h" // TokenHelper.h подключен только через firebase_utils.cpp

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

  http.handleClient();
  ftpSrv.handleFTP();
  updateTime();
  processQueue();
  updateLed(); // Добавляем управление светодиодом
}