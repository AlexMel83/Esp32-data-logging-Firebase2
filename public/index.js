document.addEventListener("DOMContentLoaded", function () {
  const auth = firebase.auth();

  auth.onAuthStateChanged((user) => {
    if (user) {
      console.log("user logged in");
      console.log(user);
      initializeDashboard(user);
      const uid = user.uid;
      console.log("User UID:", uid);
    } else {
      console.log("user logged out");
      setupUI();
    }
  });

  loginElement.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = loginElement["input-email"].value;
    const password = loginElement["input-password"].value;
    auth
      .signInWithEmailAndPassword(email, password)
      .then((cred) => {
        loginElement.reset();
        console.log("Logged in:", email);
      })
      .catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        document.getElementById("error-message").innerHTML = errorMessage;
        console.log(errorMessage);
      });
  });

  const logout = document.querySelector("#logout-link");
  logout.addEventListener("click", (e) => {
    e.preventDefault();
    auth.signOut();
  });
});
