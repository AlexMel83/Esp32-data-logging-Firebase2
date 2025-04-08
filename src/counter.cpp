#include "counter.h"
#include "debug.h"
#include "time_utils.h"

CounterEvent eventQueue[QUEUE_SIZE];
volatile int queueHead = 0;
volatile int queueTail = 0;

volatile int counter1Value = 0;
volatile int counter2Value = 0;
volatile int counter3Value = 0;

volatile bool counter1Triggered = false;
volatile bool counter2Triggered = false;
volatile bool counter3Triggered = false;

const int COUNTER1_PIN = 14;
const int COUNTER2_PIN = 26;
const int COUNTER3_PIN = 27;
const int RESET1_PIN = 32;
const int RESET2_PIN = 33;
const int RESET3_PIN = 25;

const unsigned long debounceDelay = 500;

static unsigned long lastResetTime1 = 0;
static unsigned long lastResetTime2 = 0;
static unsigned long lastResetTime3 = 0;

static int eventSequence = 0; // Счетчик последовательности событий

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

void processCounterEvent(int counterId, volatile int& counterValue) {
  counterValue++;
  DEBUG_PRINT("Counter" + String(counterId) + " incremented: " + String(counterValue));
  int queueSize = (queueTail >= queueHead) ? (queueTail - queueHead) : (queueTail + QUEUE_SIZE - queueHead);
  if (queueSize >= QUEUE_SIZE * 0.9) {
    DEBUG_PRINT("Queue almost full (" + String(queueSize) + "/" + String(QUEUE_SIZE) + "), event for counter " + String(counterId) + " dropped");
    return;
  }
  int nextTail = (queueTail + 1) % QUEUE_SIZE;
  if (nextTail != queueHead) {
    eventQueue[queueTail].counterId = counterId;
    eventQueue[queueTail].timestamp = currentTimestamp;
    eventQueue[queueTail].millisTimestamp = millis();
    eventQueue[queueTail].counterValue = counterValue;
    eventQueue[queueTail].sequence = eventSequence++; // Присваиваем порядковый номер
    DEBUG_PRINT("Event added to queue for counter " + String(counterId));
    queueTail = nextTail;
  } else {
    DEBUG_PRINT("Queue full, event for counter " + String(counterId) + " dropped");
  }
}

void setupCounters() {
  pinMode(COUNTER1_PIN, INPUT_PULLUP);
  pinMode(COUNTER2_PIN, INPUT_PULLUP);
  pinMode(COUNTER3_PIN, INPUT_PULLUP);
  pinMode(RESET1_PIN, INPUT_PULLUP);
  pinMode(RESET2_PIN, INPUT_PULLUP);
  pinMode(RESET3_PIN, INPUT_PULLUP);

  attachInterrupt(digitalPinToInterrupt(COUNTER1_PIN), counter1ISR, FALLING);
  attachInterrupt(digitalPinToInterrupt(COUNTER2_PIN), counter2ISR, FALLING);
  attachInterrupt(digitalPinToInterrupt(COUNTER3_PIN), counter3ISR, FALLING);
}

ResetEvent checkAndResetCounters() {
  ResetEvent result = {false, 0, 0};

  int resetPins[3] = {RESET1_PIN, RESET2_PIN, RESET3_PIN};
  volatile int* counters[3] = {&counter1Value, &counter2Value, &counter3Value};
  unsigned long lastResetTimes[3] = {lastResetTime1, lastResetTime2, lastResetTime3};

  for (int i = 0; i < 3; i++) {
    if (digitalRead(resetPins[i]) == LOW && millis() - lastResetTimes[i] > debounceDelay) {
      DEBUG_PRINT("Reset triggered for counter " + String(i + 1) + " on pin " + String(resetPins[i]));
      if (*counters[i] > 0) {
        result.triggered = true;
        result.counterId = i + 1;
        result.previousValue = *counters[i];
        *counters[i] = 0;
        DEBUG_PRINT("Counter" + String(i + 1) + " reset to 0");
      }
      lastResetTimes[i] = millis();
    }
  }

  lastResetTime1 = lastResetTimes[0];
  lastResetTime2 = lastResetTimes[1];
  lastResetTime3 = lastResetTimes[2];

  return result;
}