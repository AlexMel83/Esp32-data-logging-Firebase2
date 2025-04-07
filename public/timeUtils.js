function epochToJsDate(epochTime) {
  const seconds = Number(String(epochTime).split("-")[0]);
  // Check if the timestamp is already in milliseconds (13 digits) or seconds (10 digits)
  if (String(seconds).length > 11) {
    return new Date(seconds); // Already in milliseconds
  }
  return new Date(seconds * 1000); // Convert seconds to milliseconds
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
