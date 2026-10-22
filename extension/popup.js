// ResumeFit Extension Popup Logic
(function () {
  'use strict';

  const BACKEND_URL = 'http://localhost:8000';

  // DOM Elements
  const jobFound = document.getElementById('job-found');
  const jobEmpty = document.getElementById('job-empty');
  const jobPlatform = document.getElementById('job-platform');
  const jobTitle = document.getElementById('job-title');
  const jobCompany = document.getElementById('job-company');
  const jobMeta = document.getElementById('job-meta');

  const resumeSummaryLabel = document.getElementById('resume-summary-label');
  const btnToggleResume = document.getElementById('btn-toggle-resume');
  const resumeEditor = document.getElementById('resume-editor');
  const resumeInput = document.getElementById('resume-input');
  const btnSaveResume = document.getElementById('btn-save-resume');

  const btnQuickEmail = document.getElementById('btn-quick-email');
  const btnQuickCover = document.getElementById('btn-quick-cover');
  const btnOpenResumeFit = document.getElementById('btn-open-resumefit');

  const resultBox = document.getElementById('result-box');
  const resultTypeLabel = document.getElementById('result-type-label');
  const btnCopyResult = document.getElementById('btn-copy-result');
  const resultSubject = document.getElementById('result-subject');
  const resultText = document.getElementById('result-text');
  const resultChips = document.getElementById('result-chips');

  // State
  let currentJob = null;
  let savedResume = '';
  let fullCopyText = '';

  // 1. Initialize Resume State from storage
  chrome.storage.local.get(['resumefit_resume'], (res) => {
    if (res && res.resumefit_resume && res.resumefit_resume.trim()) {
      savedResume = res.resumefit_resume.trim();
      const firstLine = savedResume.split('\n')[0].slice(0, 24);
      resumeSummaryLabel.textContent = 'Resume: ' + firstLine + ' (' + savedResume.length + ' chars)';
      resumeInput.value = savedResume;
    } else {
      resumeSummaryLabel.textContent = 'Resume: Click edit to paste';
      resumeEditor.classList.add('open');
    }
  });

  // Toggle Resume Editor
  btnToggleResume.addEventListener('click', () => {
    resumeEditor.classList.toggle('open');
  });

  btnSaveResume.addEventListener('click', () => {
    const val = resumeInput.value.trim();
    if (val.length < 30) {
      alert('Please paste at least 30 characters of your resume.');
      return;
    }
    savedResume = val;
    chrome.storage.local.set({ resumefit_resume: savedResume }, () => {
      const firstLine = savedResume.split('\n')[0].slice(0, 24);
      resumeSummaryLabel.textContent = 'Resume: ' + firstLine + ' (' + savedResume.length + ' chars)';
      resumeEditor.classList.remove('open');
    });
  });

  // 2. Extract Active Job from current Tab
  function detectJobInActiveTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0] || !tabs[0].id) return;
      const activeTab = tabs[0];

      // Try sending message to content script
      chrome.tabs.sendMessage(activeTab.id, { action: 'extractJob' }, (resp) => {
        if (chrome.runtime.lastError || !resp) {
          // Content script not injected yet, inject dynamically
          chrome.scripting.executeScript(
            {
              target: { tabId: activeTab.id },
              files: ['content.js']
            },
            () => {
              // Retry after injection
              setTimeout(() => {
                chrome.tabs.sendMessage(activeTab.id, { action: 'extractJob' }, (secondResp) => {
                  handleJobExtraction(secondResp);
                });
              }, 120);
            }
          );
        } else {
          handleJobExtraction(resp);
        }
      });
    });
  }

  function handleJobExtraction(resp) {
    if (resp && resp.success && resp.data) {
      currentJob = resp.data;
      jobPlatform.textContent = currentJob.platform || 'Job Board';
      jobTitle.textContent = currentJob.title || 'Target Role';
      jobCompany.textContent = currentJob.company + (currentJob.location ? ' • ' + currentJob.location : '');
      const words = currentJob.description.split(/\s+/).length;
      jobMeta.textContent = `${words} words (${currentJob.description.length} chars) detected`;

      jobFound.style.display = 'block';
      jobEmpty.style.display = 'none';
      btnQuickEmail.disabled = false;
      btnQuickCover.disabled = false;
      btnOpenResumeFit.disabled = false;
    } else {
      jobFound.style.display = 'none';
      jobEmpty.style.display = 'block';
      btnQuickEmail.disabled = true;
      btnQuickCover.disabled = true;
      btnOpenResumeFit.disabled = true;
    }
  }

  detectJobInActiveTab();

  // 3. Generate Email Handler
  async function generateOutreach(mode) {
    if (!currentJob) {
      alert('No job posting detected on this tab.');
      return;
    }

    if (!savedResume || savedResume.length < 30) {
      resumeEditor.classList.add('open');
      resumeInput.focus();
      alert('Please paste your resume text first so the AI can match your skills.');
      return;
    }

    const btn = mode === 'email' ? btnQuickEmail : btnQuickCover;
    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Writing...';

    try {
      const response = await fetch(`${BACKEND_URL}/api/quick-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_title: currentJob.title,
          company: currentJob.company,
          job_description: currentJob.description,
          resume_text: savedResume
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      resultBox.classList.add('visible');

      const isEmail = mode === 'email';
      resultTypeLabel.textContent = isEmail ? '⚡ Tailored Recruiter Email' : '📄 Tailored 1-Page Cover Letter';
      resultSubject.textContent = data.subject || 'Application';

      const bodyText = isEmail ? (data.email_body || '') : (data.cover_letter || '');
      resultText.textContent = bodyText;
      fullCopyText = (data.subject ? `Subject: ${data.subject}\n\n` : '') + bodyText;

      // Matched Skills Chips
      resultChips.replaceChildren();
      const skills = Array.isArray(data.key_matches) ? data.key_matches : [];
      skills.forEach(skill => {
        const chip = document.createElement('span');
        chip.className = 'skill-chip';
        chip.textContent = '✓ ' + skill;
        resultChips.appendChild(chip);
      });

      resultBox.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      console.error(err);
      alert('Could not generate text. Ensure ResumeFit backend is running on http://localhost:8000.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  }

  btnQuickEmail.addEventListener('click', () => generateOutreach('email'));
  btnQuickCover.addEventListener('click', () => generateOutreach('cover'));

  // 4. Copy to Clipboard
  btnCopyResult.addEventListener('click', async () => {
    if (!fullCopyText) return;
    try {
      await navigator.clipboard.writeText(fullCopyText);
      btnCopyResult.classList.add('copied');
      btnCopyResult.textContent = 'Copied!';
    } catch {
      btnCopyResult.textContent = 'Copied!';
    }
    setTimeout(() => {
      btnCopyResult.classList.remove('copied');
      btnCopyResult.textContent = 'Copy Text';
    }, 2000);
  });

  // 5. Open in ResumeFit Full Web App
  btnOpenResumeFit.addEventListener('click', () => {
    if (!currentJob) return;

    const encodedTitle = encodeURIComponent(currentJob.title || '');
    const encodedComp = encodeURIComponent(currentJob.company || '');

    chrome.tabs.create({ url: `${BACKEND_URL}/?import=extension&title=${encodedTitle}&company=${encodedComp}` }, (tab) => {
      // Inject the job text as soon as the tab finishes loading
      const checkInterval = setInterval(() => {
        chrome.tabs.get(tab.id, (t) => {
          if (t && t.status === 'complete') {
            clearInterval(checkInterval);
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (text, title, company) => {
                try {
                  localStorage.setItem('resumefit_auto_import_jd', text);
                  localStorage.setItem('resumefit_auto_import_title', title);
                  localStorage.setItem('resumefit_auto_import_company', company);
                  const evt = new CustomEvent('resumefit:import', { detail: { text, title, company } });
                  window.dispatchEvent(evt);
                } catch (e) {}
              },
              args: [currentJob.description, currentJob.title, currentJob.company]
            });
          }
        });
      }, 150);
    });
  });
})();
