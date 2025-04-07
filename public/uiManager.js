async function setupUI(user) {
  console.log("setupUI called with user:", user);
  if (!user) {
    loginElement.style.display = "block";
    authBarElement.style.display = "none";
    userDetailsElement.style.display = "none";
    contentElement.style.display = "none";
    return false;
  }

  loginElement.style.display = "none";
  contentElement.style.display = "block";
  authBarElement.style.display = "block";
  userDetailsElement.style.display = "block";
  userDetailsElement.innerHTML = user.email;

  const uid = user.uid;
  console.log("User UID:", uid);

  if (uid !== "cRtGblv0T3R2vXazmLnjTSNrlpJ3") {
    console.error(
      "UID mismatch! Expected: cRtGblv0T3R2vXazmLnjTSNrlpJ3, Got:",
      uid
    );
    alert(
      "UID mismatch! Please ensure you are logged in with the correct user."
    );
    return false;
  }

  // Set initial state of UI elements
  cardsReadingsElement.style.display = cardsCheckboxElement.checked
    ? "block"
    : "none";
  gaugesReadingsElement.style.display = gaugesCheckboxElement.checked
    ? "block"
    : "none";
  chartsDivElement.style.display = chartsCheckboxElement.checked
    ? "block"
    : "none";
  tableContainerElement.style.display = "none";

  return uid;
}

function showLoadingSpinner(container) {
  container.innerHTML = '<div class="spinner">Loading...</div>';
}
