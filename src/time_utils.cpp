#include "time_utils.h"
#include "debug.h"

volatile unsigned long currentTimestamp = 0;
unsigned long lastSyncTime = 0;
unsigned long lastSyncMillis = 0;

const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 7200;
const int daylightOffset_sec = 0;

void initTime() {
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
    DEBUG_PRINT("NTP sync failed, using hardcoded time");
    currentTimestamp = 1743255292;
  }
  lastSyncTime = currentTimestamp;
  lastSyncMillis = millis();
}

String getFormattedTime(unsigned long epochTime) {
  struct tm *ptm = localtime((time_t *)&epochTime);
  char buffer[20];
  sprintf(buffer, "%04d-%02d-%02d %02d:%02d:%02d",
          ptm->tm_year + 1900, ptm->tm_mon + 1, ptm->tm_mday,
          ptm->tm_hour, ptm->tm_min, ptm->tm_sec);
  return String(buffer);
}

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

void updateTime() {
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
}