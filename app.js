// --- UPDATE YOUR GOOGLE APPS SCRIPT URL HERE ---
const API_URL = "https://script.google.com/macros/s/AKfycbzo6AvXg6iL1crIAzrKba2V9WbSsrFKh2RjxgIamuQUskzfYIdvg-4C7NpM-Sx4DMx-ww/exec"; 

const App = {
  currentUser: null,
  currentSet: "1",
  countdown: null,
  examQuestions: [],
  isFlexibleMode: true,
  currentBlock: 0,

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
      if(res.success) {
        // Built-in Custom CSS Success Message
        const box = document.getElementById('reg-success-box');
        box.innerHTML = `<h3>Registration Successful!</h3><p>Your Reg ID: <strong style="font-size:1.2rem;">${res.regNum}</strong></p><p>You can now switch to Login.</p>`;
        box.classList.remove('hidden');
        
        // Clear fields
        document.getElementById('reg-name').value = ""; document.getElementById('reg-email').value = ""; document.getElementById('reg-pass').value = "";
      } else {
        alert(res.message);
      }
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
          document.getElementById('exam-start-container').classList.remove('hidden');
        } else {
          document.getElementById('paper-status-box').innerHTML = `<h3 style="color:#d32f2f;">Exam Completed</h3><p>You have already submitted SET ${data.currentSet}</p>`;
          document.getElementById('exam-start-container').classList.add('hidden');
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
    App.isFlexibleMode = document.getElementById('mode-toggle').checked;
    
    document.getElementById('dashboard-page').classList.add('hidden');
    document.getElementById('exam-page').classList.remove('hidden');
    document.getElementById('questions-container').innerHTML = "<div class='loader'></div><p style='text-align:center;'>Loading Paper...</p>";
    
    fetch(`${API_URL}?action=getQuestions`)
      .then(res => res.json())
      .then(data => {
        App.examQuestions = data.questions;
        App.buildExamUI();
      });
  },

  buildExamUI: () => {
    let html = "";
    if (App.isFlexibleMode) {
      document.getElementById('banner-text').innerHTML = `Time Remaining: <span id="time-display">90:00</span>`;
      App.examQuestions.forEach((q, i) => {
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
      html += `<button type="button" class="btn btn-success" style="margin-top:20px;" onclick="App.submitExam(false)">Submit Exam</button>`;
      document.getElementById('questions-container').innerHTML = html;
      App.startTimer(90 * 60); // 90 mins
    } else {
      // STRICT MODE
      document.getElementById('banner-text').innerHTML = `Section Time Left: <span id="time-display">18:00</span>`;
      for (let b = 0; b < 5; b++) {
        html += `<div id="block-${b}" style="display: ${b === 0 ? 'block' : 'none'};">`;
        let startIdx = b * 20; let endIdx = startIdx + 20;
        for (let i = startIdx; i < endIdx && i < App.examQuestions.length; i++) {
          let q = App.examQuestions[i];
          html += `<div class="card" style="clear:both;">
            <p><strong>Q${i+1}. ${q.text}</strong></p>
            <label class="option-label"><input type="radio" name="${q.id}" value="A"> ${q.optA}</label>
            <label class="option-label"><input type="radio" name="${q.id}" value="B"> ${q.optB}</label>
            <label class="option-label"><input type="radio" name="${q.id}" value="C"> ${q.optC}</label>
            <label class="option-label"><input type="radio" name="${q.id}" value="D"> ${q.optD}</label>
            <button type="button" class="btn-clear" onclick="document.getElementsByName('${q.id}').forEach(r=>r.checked=false)">Clear</button>
            <div style="clear:both;"></div>
          </div>`;
        }
        html += `</div>`;
      }
      document.getElementById('questions-container').innerHTML = html;
      App.currentBlock = 0;
      App.startTimer(18 * 60); // 18 mins per block
    }
  },

  startTimer: (timeLeft) => {
    App.countdown = setInterval(() => {
      let m = Math.floor(timeLeft / 60); let s = timeLeft % 60;
      document.getElementById('time-display').innerText = `${m<10?'0':''}${m}:${s<10?'0':''}${s}`;
      
      if(timeLeft <= 0) { 
        clearInterval(App.countdown); 
        if (!App.isFlexibleMode && App.currentBlock < 4) {
          document.getElementById(`block-${App.currentBlock}`).style.display = 'none';
          document.getElementById('block-alert-msg').innerText = `Time is up for Section ${App.currentBlock + 1}. Moving to Section ${App.currentBlock + 2}.`;
          document.getElementById('block-alert-modal').style.display = 'flex';
        } else {
          // AUTO-SUBMIT: Bypasses checks if time runs out
          App.forceSubmit(); 
        }
      }
      timeLeft--;
    }, 1000);
  },

  nextBlock: () => {
    document.getElementById('block-alert-modal').style.display = 'none';
    App.currentBlock++;
    document.getElementById(`block-${App.currentBlock}`).style.display = 'block';
    window.scrollTo(0, 0);
    App.startTimer(18 * 60);
  },

  submitExam: (isAutoSubmit) => {
    if (isAutoSubmit) { App.forceSubmit(); return; }

    const formData = new FormData(document.getElementById('examForm'));
    let missing = [];
    
    // Check for missing questions before allowing manual submit
    App.examQuestions.forEach((q, index) => {
      if (!formData.get(q.id)) missing.push(`Q${index + 1}`);
    });

    if (missing.length > 0 && App.isFlexibleMode) {
      document.getElementById('missing-questions-list').textContent = missing.join(', ');
      document.getElementById('review-modal').style.display = 'flex';
    } else {
      if(confirm("Are you sure you want to submit?")) {
        App.forceSubmit();
      }
    }
  },

  forceSubmit: () => {
    document.getElementById('review-modal').style.display = 'none';
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
    
    App.postData('submit', payload, (res) => { 
      App.buildPdfAndShowResult(res); 
    });
  },

  // --- RESULT DISPLAY & NATIVE DOWNLOAD ---
  buildPdfAndShowResult: (res) => {
    App.latestPdfData = res.fileData;
    App.latestPdfName = res.fileName;
    
    document.getElementById('exam-page').innerHTML = `
      <div class="card" style="text-align:center;">
        <h2>Exam Complete!</h2>
        <p>Score: <strong>${res.score}</strong> / ${res.maxScore}</p>
        <p style="color:#666;">Detailed result and PDF have been emailed to you successfully.</p>
        <button class="btn btn-primary" onclick="App.downloadLatestPdf()">Download Answer Sheet PDF</button>
        <button class="btn btn-secondary" onclick="App.loadDashboard()">Back to Dashboard</button>
      </div>
    `;
  },
  
  downloadLatestPdf: () => {
    if(!App.latestPdfData) return alert("Error: PDF data not found.");
    const link = document.createElement('a');
    link.href = "data:application/pdf;base64," + App.latestPdfData;
    link.download = App.latestPdfName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  downloadRegCard: () => {
    const btn = document.querySelector('button[onclick="App.downloadRegCard()"]');
    const originalText = btn.innerText;
    btn.innerText = "Generating PDF...";
    btn.disabled = true;

    const payload = {
      name: App.currentUser.name,
      age: App.currentUser.age,
      gender: App.currentUser.gender,
      regNum: App.currentUser.regNum,
      email: App.currentUser.email
    };

    App.postData('downloadRegCard', payload, (res) => {
      btn.innerText = originalText;
      btn.disabled = false;
      
      if(res.success) {
        const link = document.createElement('a');
        link.href = "data:application/pdf;base64," + res.fileData;
        link.download = res.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert("Failed to generate PDF. Please try again.");
      }
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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js'); });
}
