// login.js

(function () {
  // Already logged in? skip straight to the dashboard.
  if (Session.getToken()) {
    window.location.href = "index.html";
    return;
  }

  const form = document.getElementById("loginForm");
  const errorBox = document.getElementById("loginError");
  const btn = document.getElementById("loginBtn");

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.add("show");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.classList.remove("show");
    btn.disabled = true;
    btn.textContent = "Signing in…";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    try {
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      Session.save(data.token, data.admin);
      window.location.href = "index.html";
    } catch (err) {
      showError(err.message || "Login failed.");
      btn.disabled = false;
      btn.textContent = "Sign in";
    }
  });
})();