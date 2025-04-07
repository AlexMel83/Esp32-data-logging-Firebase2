function epochToJsDate(epochTime) {
  // Извлекаем часть до дефиса
  const seconds = Number(String(epochTime).split("-")[0]);
  // Преобразуем секунды в миллисекунды
  return new Date(seconds * 1000);
}

function epochToDateTime(epochTime) {
  const epochDate = epochToJsDate(epochTime);
  return (
    epochDate.getFullYear() +
    "/" +
    ("00" + (epochDate.getMonth() + 1)).slice(-2) +
    "/" +
    ("00" + epochDate.getDate()).slice(-2) +
    " " +
    ("00" + epochDate.getHours()).slice(-2) +
    ":" +
    ("00" + epochDate.getMinutes()).slice(-2) +
    ":" +
    ("00" + epochDate.getSeconds()).slice(-2) +
    "." +
    ("000" + epochDate.getMilliseconds()).slice(-3)
  );
}
