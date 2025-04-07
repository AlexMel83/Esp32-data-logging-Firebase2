#ifndef TIME_UTILS_H
#define TIME_UTILS_H

#include <Arduino.h>

extern volatile unsigned long currentTimestamp;
extern unsigned long lastSyncTime;
extern unsigned long lastSyncMillis;

void initTime();
String getFormattedTime(unsigned long epochTime);
unsigned long getTime();
void updateTime();

#endif