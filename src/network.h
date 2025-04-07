#ifndef NETWORK_H
#define NETWORK_H

#include <WiFi.h>
#include <WebServer.h>
#include <ESP8266FtpServer.h>

extern WebServer http;
extern FtpServer ftpSrv;

void initWiFi();
void setupNetworkServices();
void updateLed();

#endif