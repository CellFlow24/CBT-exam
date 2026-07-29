// --- UPDATE YOUR GOOGLE APPS SCRIPT URL HERE ---
const API_URL = "https://script.google.com/macros/s/AKfycbzo6AvXg6iL1crIAzrKba2V9WbSsrFKh2RjxgIamuQUskzfYIdvg-4C7NpM-Sx4DMx-ww/exec"; 

const App = {
  currentUser: null,
  currentSet: "1",
  countdown: null,

  // --- UI CONTROLS ---
  toggleAuth: () => {
    document.getElementById('login-section').classList.toggle('hidden');
    document.getElementById('register-section').classList.toggle('hidden');
  },

  postData: (action, payload, callback) => {
    document.getElementById('auth-loading').classList.remove('hidden');
    payload.action = action;
    fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) })
      .then(res => res.json())
      .then(data => {
        document.getElementById('auth-loading').classList.add('hidden');
        callback(data);
      }).catch(err => {
        alert("Network Error! Check your connection.");
        document.getElementById('auth-loading').classList.add('hidden');
      });
  },

  // --- AUTHENTICATION ---
  register: () => {
    const data = {
      name: document.getElementById('reg-name').value,
      age: document.getElementById('reg-age').value,
      gender: document.getElementById('reg-gender').value,
      email: document.getElementById('reg-email').value,
      password: document.getElementById('reg-pass').value
    };
    if(!data.name || !data.email || !data.password) return alert("Fill all required fields!");
    
    App.postData('register', data, (res) => {
      alert(res.message + (res.regNum ? "\nYour Reg ID: " + res.regNum : ""));
      if(res.success) App.toggleAuth();
    });
  },

  login: () => {
    const data = {
      loginId: document.getElementById('login-id').value,
      password: document.getElementById('login-pass').value
    };
    if(!data.loginId || !data.password) return alert("Enter credentials!");
    
    App.postData('login', data, (res) => {
      if(res.success) {
        App.currentUser = res;
        App.loadDashboard();
      } else { alert(res.message); }
    });
  },

  logout: () => {
    App.currentUser = null;
    document.getElementById('dashboard-page').classList.add('hidden');
    document.getElementById('auth-page').classList.remove('hidden');
    document.getElementById('login-id').value = '';
    document.getElementById('login-pass').value = '';
  },

  // --- DASHBOARD ---
  loadDashboard: () => {
    document.getElementById('auth-page').classList.add('hidden');
    document.getElementById('exam-page').classList.add('hidden');
    document.getElementById('dashboard-page').classList.remove('hidden');
    
    document.getElementById('dash-name').innerText = App.currentUser.name;
    document.getElementById('dash-reg').innerText = App.currentUser.regNum;
    
    fetch(`${API_URL}?action=getDashboardData&email=${App.currentUser.email}`)
      .then(res => res.json())
      .then(data => {
        App.currentSet = data.currentSet;
        if(data.notification) {
          document.getElementById('notification-box').innerText = data.notification;
          document.getElementById('notification-box').classList.remove('hidden');
        } else {
          document.getElementById('notification-box').classList.add('hidden');
        }
        
        if(data.hasNewPaper) {
          document.getElementById('paper-status-box').innerHTML = `<h3 style="color:#2e7d32;">New Paper Available: SET ${data.currentSet}</h3>`;
          document.getElementById('btn-start-exam').classList.remove('hidden');
        } else {
          document.getElementById('paper-status-box').innerHTML = `<h3 style="color:#d32f2f;">Exam Completed</h3><p>You have already submitted SET ${data.currentSet}</p>`;
          document.getElementById('btn-start-exam').classList.add('hidden');
        }
      });
      
    fetch(`${API_URL}?action=getResults&name=${App.currentUser.email}`)
      .then(res => res.json())
      .then(data => {
        const tbody = document.getElementById('history-table');
        tbody.innerHTML = "";
        data.forEach(row => {
          tbody.innerHTML += `<tr><td>${row.date}</td><td>${row.setNum}</td><td><strong>${row.score}</strong></td></tr>`;
        });
      });
  },

  // --- EXAM LOGIC ---
  startExam: () => {
    document.getElementById('dashboard-page').classList.add('hidden');
    document.getElementById('exam-page').classList.remove('hidden');
    document.getElementById('questions-container').innerHTML = "<div class='loader'></div><p style='text-align:center;'>Loading Paper...</p>";
    
    fetch(`${API_URL}?action=getQuestions`)
      .then(res => res.json())
      .then(data => {
        let html = "";
        data.questions.forEach((q, i) => {
          html += `<div class="card" style="clear:both;">
            <p><strong>Q${i+1}. ${q.text}</strong></p>
            <label class="option-label"><input type="radio" name="${q.id}" value="A"> ${q.optA}</label>
            <label class="option-label"><input type="radio" name="${q.id}" value="B"> ${q.optB}</label>
            <label class="option-label"><input type="radio" name="${q.id}" value="C"> ${q.optC}</label>
            <label class="option-label"><input type="radio" name="${q.id}" value="D"> ${q.optD}</label>
            <button type="button" class="btn-clear" onclick="document.getElementsByName('${q.id}').forEach(r=>r.checked=false)">Clear</button>
            <div style="clear:both;"></div>
          </div>`;
        });
        document.getElementById('questions-container').innerHTML = html;
        App.startTimer();
      });
  },

  startTimer: () => {
    let timeLeft = 90 * 60; // 90 Minutes
    App.countdown = setInterval(() => {
      let m = Math.floor(timeLeft / 60); let s = timeLeft % 60;
      document.getElementById('time-display').innerText = `${m<10?'0':''}${m}:${s<10?'0':''}${s}`;
      if(timeLeft <= 0) { clearInterval(App.countdown); App.submitExam(); }
      timeLeft--;
    }, 1000);
  },

  submitExam: () => {
    if(!confirm("Are you sure you want to submit?")) return;
    clearInterval(App.countdown);
    
    const formData = new FormData(document.getElementById('examForm'));
    let answers = {};
    formData.forEach((val, key) => answers[key] = val);
    
    const payload = {
      name: App.currentUser.name,
      email: App.currentUser.email,
      setNumber: App.currentSet,
      answers: answers
    };

    document.getElementById('exam-page').innerHTML = "<div class='card text-center'><h2>Submitting...</h2><div class='loader'></div></div>";
    App.postData('submit', payload, (res) => { App.buildPdfAndShowResult(res); });
  },

  // --- PDF GENERATION ---
  buildPdfAndShowResult: (res) => {
    // FIX: Added "/ maxScore" and added "font-weight: bold;" to the answer text
    let printHtml = `
      <div class="pdf-container">
        <h2 style="color:#673ab7; text-align:center; margin-bottom:20px;">AIIMS CBT - Answer Key SET ${res.setNumber}</h2>
        <p class="pdf-text"><strong>Candidate:</strong> ${App.currentUser.name}</p>
        <p class="pdf-text"><strong>Reg No:</strong> ${App.currentUser.regNum}</p>
        <p class="pdf-text"><strong>Final Score:</strong> ${res.score} / ${res.maxScore}</p>
        <hr style="margin:20px 0; border:1px solid #ccc;">
    `;
    
    res.report.forEach(r => {
      let clr = r.isCorrect ? "#2e7d32" : (r.userAns === "Skipped" ? "#757575" : "#d32f2f");
      printHtml += `
        <div class="pdf-question-block">
          <p class="pdf-text"><strong>Q${r.qNum}. ${r.question}</strong></p>
          <p class="pdf-text" style="color:${clr}; margin:8px 0; font-weight: bold;">Your Ans: ${r.userAns} (${r.userText})</p>
          ${!r.isCorrect ? `<p class="pdf-text" style="color:#2e7d32; font-weight: bold;">Correct Ans: ${r.correctAns} (${r.correctText})</p>` : ''}
        </div>
      `;
    });
    printHtml += `</div>`;
    
    document.getElementById('print-area').innerHTML = printHtml;
    
    document.getElementById('exam-page').innerHTML = `
      <div class="card" style="text-align:center;">
        <h2>Exam Complete!</h2>
        <p>Score: <strong>${res.score}</strong> / ${res.maxScore}</p>
        <p style="color:#666;">Detailed result and PDF have been emailed to you successfully.</p>
        <button class="btn btn-primary" onclick="App.downloadPdf('print-area', '${App.currentUser.name}_Result_SET_${res.setNumber}')">Download Answer Sheet PDF</button>
        <button class="btn btn-secondary" onclick="App.loadDashboard()">Back to Dashboard</button>
      </div>
    `;
  },
  
  downloadRegCard: () => {
    let printHtml = `
      <div style="width: 100%; max-width: 700px; margin: 0 auto; padding: 30px; border: 2px solid #673ab7; text-align: center; background-color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif; box-sizing: border-box;">
        <img src="logo.png" style="width: 80px; margin-bottom: 15px;">
        <h2 style="color:#673ab7; margin-bottom: 5px; font-size: 24px;">AIIMS CBT Mock Test</h2>
        <h3 style="color:#333; margin-bottom: 20px; font-size: 18px;">Candidate Registration Card</h3>
        <hr style="border: 0; border-top: 1px solid #ccc; margin: 15px 0;">
        
        <div style="text-align: left; max-width: 350px; margin: 0 auto;">
            <p style="font-size:16px; margin: 8px 0; color: #000;"><strong>Name:</strong> ${App.currentUser.name}</p>
            <p style="font-size:16px; margin: 8px 0; color: #000;"><strong>Age:</strong> ${App.currentUser.age}</p>
            <p style="font-size:16px; margin: 8px 0; color: #000;"><strong>Gender:</strong> ${App.currentUser.gender}</p>
            <p style="font-size:16px; margin: 8px 0; color: #000;"><strong>Registration No:</strong> ${App.currentUser.regNum}</p>
            <p style="font-size:16px; margin: 8px 0; color: #000;"><strong>Email ID:</strong> ${App.currentUser.email}</p>
        </div>
        
        <hr style="border: 0; border-top: 1px solid #ccc; margin: 15px 0;">
        <p style="color:#757575; font-size: 14px;">Please keep this ID safe for future mock exams.</p>
      </div>
    `;
    
    // Create a temporary hidden container to hold this HTML
    const tempDiv = document.createElement('div');
    tempDiv.id = 'temp-reg-card';
    tempDiv.innerHTML = printHtml;
    tempDiv.style.display = 'none';
    document.body.appendChild(tempDiv);

    // Call the download function, then delete the temp container
    App.downloadPdf('temp-reg-card', `${App.currentUser.name}_Registration_Card`);
    setTimeout(() => document.body.removeChild(tempDiv), 2000);
  },

  downloadPdf: (elementId, filename) => {
    const rawHtml = document.getElementById(elementId).innerHTML;
    
    // Ghost Container Method for 100% Mobile Accuracy
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = rawHtml;
    tempContainer.style.position = 'absolute';
    tempContainer.style.top = '0';
    tempContainer.style.left = '0';
    tempContainer.style.zIndex = '-1'; // Hides it behind the app
    tempContainer.style.width = '800px'; 
    tempContainer.style.backgroundColor = '#ffffff'; 
    document.body.appendChild(tempContainer);

    const opt = {
      margin: 0.5,
      filename: `${filename}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, windowWidth: 800 },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(tempContainer).save().then(() => {
      document.body.removeChild(tempContainer);
    });
  }
};

// --- PWA INSTALLATION LOGIC ---
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('install-banner').classList.remove('hidden');
});

document.getElementById('btn-install-app').addEventListener('click', async () => {
  document.getElementById('install-banner').classList.add('hidden');
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
});

// --- REGISTER SERVICE WORKER ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js');
  });
}
