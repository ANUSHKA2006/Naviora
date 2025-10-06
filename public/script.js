// -------------------------
// ELEMENTS
// -------------------------
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const showSignup = document.getElementById("show-signup");
const backToLogin = document.getElementById("back-to-login");

// -------------------------
// TOGGLE LOGIN / SIGNUP
// -------------------------
showSignup.addEventListener("click", e => {
  e.preventDefault();
  loginForm.style.display = "none";
  signupForm.style.display = "block";
});

backToLogin.addEventListener("click", e => {
  e.preventDefault();
  signupForm.style.display = "none";
  loginForm.style.display = "block";
  resetSignupSteps();
});

// -------------------------
// MULTI-STEP SIGNUP
// -------------------------
function nextStep(step){
  document.getElementById("step1").style.display = "none";
  document.getElementById("step2").style.display = "none";
  document.getElementById("step3").style.display = "none";
  document.getElementById("step"+step).style.display = "block";
}
function resetSignupSteps(){ nextStep(1); }

// Step 1: Send verification code
document.querySelector("#step1 button").addEventListener("click", async () => {
  const email = document.getElementById("signup-email").value;
  if(!email){ alert("Enter email!"); return; }
  try {
    const res = await fetch("/send-code", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if(!res.ok) alert(data.msg);
    else { alert(data.msg); nextStep(2); }
  } catch(err){ console.error(err); alert("Error sending code!"); }
});

// Step 2: Verify code
document.querySelector("#step2 button").addEventListener("click", async () => {
  const email = document.getElementById("signup-email").value;
  const code = document.getElementById("signup-code").value;
  if(!code){ alert("Enter verification code!"); return; }
  try {
    const res = await fetch("/verify-code", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ email, code })
    });
    const data = await res.json();
    if(!res.ok) alert(data.msg);
    else { alert(data.msg); nextStep(3); }
  } catch(err){ console.error(err); alert("Error verifying code!"); }
});

// Step 3: Final signup
document.getElementById("final-signup-btn").addEventListener("click", async (e) => {
  e.preventDefault();
  const email = document.getElementById("signup-email").value;
  const name = document.getElementById("signup-name").value;
  const password = document.getElementById("signup-password").value;
  const confirm = document.getElementById("signup-confirm").value;

  if(!name || !password || !confirm){ alert("Fill all fields!"); return; }
  if(password !== confirm){ alert("Passwords do not match!"); return; }

  try {
    const res = await fetch("/signup", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ email, password, name })
    });
    const data = await res.json();
    if(!res.ok) alert(data.msg);
    else {
      alert(data.msg);
      resetSignupSteps();
      signupForm.style.display="none";
      loginForm.style.display="block";
      document.querySelectorAll("input").forEach(input => input.value = "");
    }
  } catch(err){ console.error(err); alert("Signup failed!"); }
});

// -------------------------
// LOGIN
// -------------------------
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;
  try {
    const res = await fetch("/login", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if(!res.ok) alert(data.msg);
    else {
      alert(data.msg);
      localStorage.setItem("token", data.token);
      document.querySelectorAll("input").forEach(input => input.value = "");
    }
  } catch(err){ console.error(err); alert("Login failed!"); }
});

// -------------------------
// FORGOT PASSWORD
// -------------------------
document.getElementById("forgot-password").addEventListener("click", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value;

  if (!email) {
    alert("Please enter your email first!");
    return;
  }

  try {
    const res = await fetch("/forgot-password", {
      method:"POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    alert(data.msg);
  } catch(err){
    console.error(err);
    alert("Error sending reset email!");
  }
});

// -------------------------
// RESET PASSWORD PAGE
// -------------------------
// RESET PASSWORD PAGE FUNCTION
async function resetPassword() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token"); // get token from URL
  const password = document.getElementById("password").value;

  if (!password) {
    alert("Please enter a new password!");
    return;
  }

  try {
    const res = await fetch("/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password })
    });
    const data = await res.json();
    document.getElementById("msg").innerText = data.msg;
  } catch (err) {
    console.error(err);
    alert("Error resetting password!");
  }
}

// Attach listener if button exists (only on reset page)
document.getElementById("resetBtn")?.addEventListener("click", resetPassword);



// -------------------------
// GOOGLE LOGIN
// -------------------------
function handleCredentialResponse(response){
  fetch("/google-login", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ credential: response.credential })
  })
  .then(res => res.json())
  .then(data => {
    if(data.msg){
      alert(data.msg);
      localStorage.setItem("token", data.token);
      document.querySelectorAll("input").forEach(input => input.value = "");
    }
    else alert("Google login failed!");
  })
  .catch(err => { console.error(err); alert("Google login failed!"); });
}

// -------------------------
// ON PAGE LOAD
// -------------------------
window.onload = function(){
  document.querySelectorAll("input").forEach(input => input.value = "");

  if(window.location.pathname.includes("reset-password.html")) return;

  google.accounts.id.initialize({
    client_id: "614926776175-014lh4vat8nif3dkdcbjb69b5s1rdv8h.apps.googleusercontent.com",
    callback: handleCredentialResponse
  });
  google.accounts.id.renderButton(
    document.querySelector(".g_id_signin"),
    { theme: "outline", size: "large" }
  );
};
