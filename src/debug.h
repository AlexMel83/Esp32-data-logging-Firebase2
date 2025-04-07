#ifndef DEBUG_H
#define DEBUG_H

#define DEBUG // Закомментировать для отключения отладки
#ifdef DEBUG
  #define DEBUG_PRINT(x) do { if (Serial) Serial.println(x); } while (0)
#else
  #define DEBUG_PRINT(x)
#endif

#endif