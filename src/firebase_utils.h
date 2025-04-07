#ifndef FIREBASE_UTILS_H
#define FIREBASE_UTILS_H

#include <Firebase_ESP_Client.h>
#include "counter.h"

// Объявляем объекты Firebase как extern
extern FirebaseData fbdo;
extern FirebaseAuth auth;
extern FirebaseConfig config;
extern String uid;

// Объявляем функции
void initFirebase();
void loadInitialCounterValues();
void processQueue();
void cleanupOldEvents(String path, int maxBatches);

#endif