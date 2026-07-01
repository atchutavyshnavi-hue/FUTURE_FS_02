// contact.js — handles the public (unauthenticated) lead submission form

(function () {
  const form = document.getElementById("contactForm");
  const errorBox = document.getElementById("formError");
  const successBox = document.getElementById("formSuccess");
  const btn = document.getElementById("submitBtn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.classList.remove("show");
    successBox.classList.remove("show");
    btn.disabled = true;
    btn.textContent = "Sending…";

    const payload = {
      name: document.getElementById("name").value.trim(),
      email: document.getElementById("email").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      company: document.getElementById("company").value.trim(),
      message: document.getElementById("message").value.trim(),
      source: "Website Contact Form",
    };

    try {
      const data = await apiFetch("/api/public/leads", {
        method: "POST",
        body: payload,
      });
      successBox.textContent = data.message || "Thanks! We'll be in touch.";
      successBox.classList.add("show");
      form.reset();
    } catch (err) {
      errorBox.textContent = err.message || "Something went wrong. Please try again.";
      errorBox.classList.add("show");
    } finally {
      btn.disabled = false;
      btn.textContent = "Send message";
    }
  });
})();