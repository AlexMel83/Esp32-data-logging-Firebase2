document.addEventListener("DOMContentLoaded", function () {
  const auth = firebase.auth();

  // Listen for auth status changes
  auth.onAuthStateChanged((user) => {
    if (user) {
      // console.log("user logged in");
      // console.log(user);
      setupUI(user); // Вызываем setupUI из index.js
      const uid = user.uid;
      // console.log("User UID:", uid);
    } else {
      console.log("user logged out");
      setupUI(); // Вызываем setupUI из index.js
    }
  });

  // Login
  const loginForm = document.querySelector("#login-form");
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = loginForm["input-email"].value;
    const password = loginForm["input-password"].value;
    auth
      .signInWithEmailAndPassword(email, password)
      .then((cred) => {
        loginForm.reset();
        console.log("Logged in:", email);
      })
      .catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        document.getElementById("error-message").innerHTML = errorMessage;
        console.log(errorMessage);
      });
  });

  // Logout
  const logout = document.querySelector("#logout-link");
  logout.addEventListener("click", (e) => {
    e.preventDefault();
    auth.signOut();
  });
});
