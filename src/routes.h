#ifndef ROUTES_H
#define ROUTES_H

#include <WebServer.h>
#include <Arduino.h>

// Оголошення зовнішньої змінної http
extern WebServer http;

void setupRoutes();
String getContentType(String filename);
bool handleFileRead(String path);

// Оголошення зовнішніх змінних для alarmStartTime і alarmActive
extern time_t alarmStartTime;
extern bool alarmActive;

#endif