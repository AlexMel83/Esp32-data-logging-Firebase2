#ifndef COUNTER_H
#define COUNTER_H

#include <Arduino.h>

#define QUEUE_SIZE 50

struct CounterEvent {
  int counterId;
  unsigned long timestamp;
  unsigned long millisTimestamp;
  int counterValue;
  int sequence;
};

extern CounterEvent eventQueue[QUEUE_SIZE];
extern volatile int queueHead;
extern volatile int queueTail;

extern volatile int counter1Value;
extern volatile int counter2Value;
extern volatile int counter3Value;

extern volatile bool counter1Triggered;
extern volatile bool counter2Triggered;
extern volatile bool counter3Triggered;

extern const int COUNTER1_PIN;
extern const int COUNTER2_PIN;
extern const int COUNTER3_PIN;
extern const int RESET1_PIN;
extern const int RESET2_PIN;
extern const int RESET3_PIN;

extern const unsigned long debounceDelay;

void counter1ISR();
void counter2ISR();
void counter3ISR();
void processCounterEvent(int counterId, volatile int& counterValue);
void setupCounters();

struct ResetEvent {
  bool triggered;
  int counterId;
  int previousValue;
};

ResetEvent checkAndResetCounters();

#endif