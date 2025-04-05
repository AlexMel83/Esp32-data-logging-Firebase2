#include "routes.h"
#include "config.h"
#include "SPIFFS.h"

// Оголошення зовнішньої змінної http
extern WebServer http;
extern time_t alarmStartTime;
extern bool alarmActive;
extern unsigned long lastCycleStartTime;

// Функция для обработки файлов
void handleFile(String path) {
  if (handleFileRead(path)) {
    return;
  }
  http.send(404, "text/plain", "File not found: " + path);
}

void setupRoutes() {
  // Явные маршруты для всех файлов
  http.on("/", HTTP_GET, []() { handleFile("/index.html"); });
  http.on("/index.html", HTTP_GET, []() { handleFile("/index.html"); });
  http.on("/style.css", HTTP_GET, []() { handleFile("/style.css"); });
  http.on("/firebase-config.js", HTTP_GET, []() { handleFile("/firebase-config.js"); });
  http.on("/auth.js", HTTP_GET, []() { handleFile("/auth.js"); });
  http.on("/charts-definition.js", HTTP_GET, []() { handleFile("/charts-definition.js"); });
  http.on("/gauges-definition.js", HTTP_GET, []() { handleFile("/gauges-definition.js"); });
  http.on("/index.js", HTTP_GET, []() { handleFile("/index.js"); });
  http.on("/favicon.png", HTTP_GET, []() { handleFile("/favicon.png"); });

  // Обработчик для всех остальных запросов
  http.onNotFound([]() {
    String uri = http.uri();
    String method = (http.method() == HTTP_GET) ? "GET" : "POST";
    Serial.printf("Not found: %s %s\n", method.c_str(), uri.c_str());

    if (!handleFileRead(uri)) {
      String message = "File Not Found\n\n";
      message += "URI: " + uri + "\n";
      message += "Method: " + method + "\n";
      message += "Arguments: " + String(http.args()) + "\n";
      for (uint8_t i = 0; i < http.args(); i++) {
        message += " " + http.argName(i) + ": " + http.arg(i) + "\n";
      }
      http.send(404, "text/plain", message);
    }
  });
}

String getContentType(String filename) {
  if (filename.endsWith(".html")) return "text/html";
  if (filename.endsWith(".css")) return "text/css";
  if (filename.endsWith(".js")) return "application/javascript";
  if (filename.endsWith(".png")) return "image/png";
  if (filename.endsWith(".gif")) return "image/gif";
  if (filename.endsWith(".jpg")) return "image/jpeg";
  if (filename.endsWith(".ico")) return "image/x-icon";
  return "text/plain";
}

bool handleFileRead(String path) {
  if (path.endsWith("/")) {
    path += "index.html";
  }

  String contentType = getContentType(path);
  if (!SPIFFS.exists(path)) {
    Serial.printf("File not found in SPIFFS: %s\n", path.c_str());
    return false;
  }

  File file = SPIFFS.open(path, "r");
  if (!file) {
    Serial.printf("Failed to open file: %s\n", path.c_str());
    return false;
  }

  // Добавляем заголовок кэширования
  http.sendHeader("Cache-Control", "max-age=3600"); // Кэшировать на 1 час

  size_t sent = http.streamFile(file, contentType);
  file.close();

  // Проверяем, что файл был отправлен успешно
  if (sent == 0) {
    Serial.printf("Failed to send file: %s (0 bytes sent)\n", path.c_str());
    return false;
  }

  // Лог не выводится, если файл успешно отправлен
  return true;
}