// ResumeFit Content Script: extracts job details from active tab
(function () {
  function extractIndeedJob() {
    // 1. Job Description text
    const jdEl = document.getElementById('jobDescriptionText') ||
      document.querySelector('.jobsearch-JobComponent-description') ||
      document.querySelector('[data-testid="jobsearch-JobComponent"]');

    // 2. Job Title
    const titleEl = document.querySelector('h2.jobsearch-JobInfoHeader-title') ||
      document.querySelector('h1.jobsearch-JobInfoHeader-title') ||
      document.querySelector('[data-testid="simpler-jobTitle"]') ||
      document.querySelector('.jobsearch-JobInfoHeader-title-container') ||
      document.querySelector('.jobsearch-JobInfoHeader-title');

    // 3. Company Name
    const companyEl = document.querySelector('[data-testid="inlineHeader-companyName"]') ||
      document.querySelector('[data-company-name="true"]') ||
      document.querySelector('.jobsearch-InlineCompanyRating-companyHeader') ||
      document.querySelector('.jobsearch-CompanyInfoContainer');

    // 4. Location
    const locEl = document.querySelector('[data-testid="inlineHeader-companyLocation"]') ||
      document.querySelector('[data-testid="jobsearch-JobInfoHeader-companyLocation"]');

    if (jdEl && jdEl.innerText.trim().length > 30) {
      return {
        platform: 'Indeed',
        title: titleEl ? titleEl.innerText.trim() : 'Software Engineer',
        company: companyEl ? companyEl.innerText.trim() : 'Company',
        location: locEl ? locEl.innerText.trim() : '',
        url: window.location.href,
        description: jdEl.innerText.trim()
      };
    }
    return null;
  }

  function extractLinkedInJob() {
    const jdEl = document.querySelector('.jobs-description__content') ||
      document.getElementById('job-details') ||
      document.querySelector('.jobs-box__html-content') ||
      document.querySelector('.jobs-description');

    const titleEl = document.querySelector('.job-details-jobs-unified-top-card__job-title') ||
      document.querySelector('h1.t-24') ||
      document.querySelector('.jobs-unified-top-card__job-title');

    const companyEl = document.querySelector('.job-details-jobs-unified-top-card__company-name') ||
      document.querySelector('.jobs-unified-top-card__company-name') ||
      document.querySelector('.jobs-unified-top-card__subtitle-primary-grouping a');

    if (jdEl && jdEl.innerText.trim().length > 30) {
      return {
        platform: 'LinkedIn',
        title: titleEl ? titleEl.innerText.trim() : 'Target Role',
        company: companyEl ? companyEl.innerText.trim() : 'Company',
        url: window.location.href,
        description: jdEl.innerText.trim()
      };
    }
    return null;
  }

  function extractGenericJob() {
    // Check Greenhouse
    const ghContent = document.getElementById('content') || document.querySelector('.body');
    const ghTitle = document.querySelector('.app-title') || document.querySelector('h1');
    const ghCompany = document.querySelector('.company-name');
    if (ghContent && ghContent.innerText.trim().length > 100 && ghTitle) {
      return {
        platform: 'Greenhouse',
        title: ghTitle.innerText.trim(),
        company: ghCompany ? ghCompany.innerText.trim() : document.title.split('-')[0].trim(),
        url: window.location.href,
        description: ghContent.innerText.trim()
      };
    }

    // Check Lever
    const leverSections = document.querySelector('.section-page') || document.querySelector('.posting-headline');
    if (leverSections && window.location.hostname.includes('lever.co')) {
      const lTitle = document.querySelector('.posting-headline h2') || document.querySelector('h2');
      const lCompany = document.querySelector('.main-header-logo img')?.alt || 'Company';
      const mainContent = document.querySelector('.content') || document.body;
      return {
        platform: 'Lever',
        title: lTitle ? lTitle.innerText.trim() : 'Role',
        company: lCompany,
        url: window.location.href,
        description: mainContent.innerText.trim()
      };
    }

    // Generic Fallback: look for largest readable section with keywords
    const candidates = Array.from(document.querySelectorAll('main, article, section, [role="main"], body'));
    let bestText = '';
    for (const el of candidates) {
      const text = el.innerText || '';
      if (text.length > bestText.length && /responsibilit|requirement|qualification|experience/i.test(text)) {
        bestText = text;
      }
    }

    if (bestText.length > 150) {
      const title = document.querySelector('h1')?.innerText?.trim() || document.title.split(/[-|]/)[0].trim();
      return {
        platform: window.location.hostname.replace('www.', ''),
        title: title || 'Role',
        company: document.title.split(/[-|]/)[1]?.trim() || 'Company',
        url: window.location.href,
        description: bestText.slice(0, 8000)
      };
    }

    return null;
  }

  // Listen for messages from extension popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractJob') {
      const host = window.location.hostname.toLowerCase();
      let jobData = null;

      if (host.includes('indeed.')) {
        jobData = extractIndeedJob();
      } else if (host.includes('linkedin.')) {
        jobData = extractLinkedInJob();
      }

      if (!jobData) {
        jobData = extractGenericJob();
      }

      sendResponse({ success: !!jobData, data: jobData });
    }
    return true;
  });
})();
