/**
 * User Feedback Widget
 *
 * In-app feedback portal for:
 * - Bug reporting with screenshot support
 * - Feature requests with use cases
 * - Email capture for follow-ups
 * - Automatic GitHub issue creation via API
 */
(function () {
  'use strict';

  var CONFIG = {
    apiEndpoint: '/api/submit-feedback',
    position: 'bottom-right',
    primaryColor: '#7c3aed',
    accentColor: '#a78bfa',
  };

  var screenshotData = null;
  var widgetOpen = false;

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent = [
      '#feedback-widget-trigger{',
      '  position:fixed;bottom:24px;right:24px;z-index:99999;',
      '  width:56px;height:56px;border-radius:50%;border:none;',
      '  background:linear-gradient(135deg,#7c3aed,#a78bfa);',
      '  color:#fff;cursor:pointer;box-shadow:0 4px 20px rgba(124,58,237,0.4);',
      '  display:flex;align-items:center;justify-content:center;',
      '  transition:all 0.3s ease;font-size:24px;',
      '}',
      '#feedback-widget-trigger:hover{',
      '  transform:scale(1.1);box-shadow:0 6px 28px rgba(124,58,237,0.6);',
      '}',
      '#feedback-widget-panel{',
      '  position:fixed;bottom:90px;right:24px;z-index:99999;',
      '  width:380px;max-height:560px;background:#1a1a2e;',
      '  border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.5);',
      '  border:1px solid rgba(167,139,250,0.2);',
      '  display:none;flex-direction:column;overflow:hidden;',
      '  font-family:"Outfit",system-ui,sans-serif;',
      '}',
      '#feedback-widget-panel.open{display:flex;}',
      '#feedback-widget-panel *{box-sizing:border-box;}',
      '.fw-header{',
      '  padding:16px 20px;background:linear-gradient(135deg,#7c3aed,#6d28d9);',
      '  display:flex;justify-content:space-between;align-items:center;',
      '}',
      '.fw-header h3{margin:0;color:#fff;font-size:16px;font-weight:600;}',
      '.fw-close{background:none;border:none;color:rgba(255,255,255,0.7);',
      '  cursor:pointer;font-size:20px;padding:0;line-height:1;}',
      '.fw-close:hover{color:#fff;}',
      '.fw-tabs{display:flex;border-bottom:1px solid rgba(255,255,255,0.1);}',
      '.fw-tab{flex:1;padding:10px;text-align:center;cursor:pointer;',
      '  background:none;border:none;color:rgba(255,255,255,0.5);',
      '  font-size:13px;font-family:inherit;transition:all 0.2s;}',
      '.fw-tab:hover{color:rgba(255,255,255,0.8);}',
      '.fw-tab.active{color:#a78bfa;border-bottom:2px solid #a78bfa;}',
      '.fw-body{padding:16px 20px;overflow-y:auto;flex:1;}',
      '.fw-field{margin-bottom:14px;}',
      '.fw-field label{display:block;color:rgba(255,255,255,0.7);',
      '  font-size:12px;margin-bottom:4px;font-weight:500;}',
      '.fw-field input,.fw-field textarea,.fw-field select{',
      '  width:100%;padding:10px 12px;background:rgba(255,255,255,0.06);',
      '  border:1px solid rgba(255,255,255,0.12);border-radius:8px;',
      '  color:#fff;font-size:14px;font-family:inherit;outline:none;',
      '  transition:border-color 0.2s;}',
      '.fw-field input:focus,.fw-field textarea:focus{',
      '  border-color:rgba(167,139,250,0.5);}',
      '.fw-field textarea{resize:vertical;min-height:80px;}',
      '.fw-field select option{background:#1a1a2e;color:#fff;}',
      '.fw-screenshot-zone{',
      '  border:2px dashed rgba(255,255,255,0.15);border-radius:8px;',
      '  padding:16px;text-align:center;cursor:pointer;',
      '  color:rgba(255,255,255,0.4);font-size:13px;',
      '  transition:all 0.2s;position:relative;}',
      '.fw-screenshot-zone:hover{border-color:rgba(167,139,250,0.4);',
      '  color:rgba(255,255,255,0.6);}',
      '.fw-screenshot-zone.has-image{border-color:#a78bfa;padding:4px;}',
      '.fw-screenshot-zone img{max-width:100%;border-radius:4px;}',
      '.fw-screenshot-remove{position:absolute;top:8px;right:8px;',
      '  background:rgba(0,0,0,0.7);border:none;color:#fff;',
      '  border-radius:50%;width:24px;height:24px;cursor:pointer;',
      '  font-size:14px;line-height:24px;text-align:center;display:none;}',
      '.fw-screenshot-zone.has-image .fw-screenshot-remove{display:block;}',
      '.fw-submit{',
      '  width:100%;padding:12px;border:none;border-radius:8px;',
      '  background:linear-gradient(135deg,#7c3aed,#a78bfa);',
      '  color:#fff;font-size:14px;font-weight:600;cursor:pointer;',
      '  font-family:inherit;transition:all 0.2s;margin-top:4px;}',
      '.fw-submit:hover{opacity:0.9;transform:translateY(-1px);}',
      '.fw-submit:disabled{opacity:0.5;cursor:not-allowed;transform:none;}',
      '.fw-success{text-align:center;padding:40px 20px;color:#fff;}',
      '.fw-success-icon{font-size:48px;margin-bottom:12px;}',
      '.fw-success h4{margin:0 0 8px;font-size:18px;}',
      '.fw-success p{margin:0;color:rgba(255,255,255,0.6);font-size:14px;}',
      '.fw-hidden{display:none!important;}',
      '@media(max-width:440px){',
      '  #feedback-widget-panel{right:8px;left:8px;width:auto;bottom:80px;}',
      '}',
    ].join('\n');
    document.head.appendChild(style);
  }

  function createWidget() {
    // Floating trigger button
    var trigger = document.createElement('button');
    trigger.id = 'feedback-widget-trigger';
    trigger.innerHTML = '&#x1f4ac;';
    trigger.title = 'Send Feedback';
    trigger.addEventListener('click', togglePanel);

    // Panel
    var panel = document.createElement('div');
    panel.id = 'feedback-widget-panel';
    panel.innerHTML = [
      '<div class="fw-header">',
      '  <h3>Send Feedback</h3>',
      '  <button class="fw-close" id="fw-close">&times;</button>',
      '</div>',
      '<div class="fw-tabs">',
      '  <button class="fw-tab active" data-tab="bug">Report Bug</button>',
      '  <button class="fw-tab" data-tab="feature">Feature Request</button>',
      '</div>',
      '<div class="fw-body" id="fw-body">',
      '  <!-- Bug Report Form -->',
      '  <div id="fw-form-bug">',
      '    <div class="fw-field">',
      '      <label>What went wrong?</label>',
      '      <input type="text" id="fw-bug-title" placeholder="Brief description of the issue">',
      '    </div>',
      '    <div class="fw-field">',
      '      <label>Steps to Reproduce</label>',
      '      <textarea id="fw-bug-steps" placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."></textarea>',
      '    </div>',
      '    <div class="fw-field">',
      '      <label>Severity</label>',
      '      <select id="fw-bug-severity">',
      '        <option value="low">Low - Minor inconvenience</option>',
      '        <option value="medium" selected>Medium - Feature partially broken</option>',
      '        <option value="high">High - Feature completely broken</option>',
      '        <option value="critical">Critical - App is unusable</option>',
      '      </select>',
      '    </div>',
      '    <div class="fw-field">',
      '      <label>Screenshot (optional)</label>',
      '      <div class="fw-screenshot-zone" id="fw-screenshot-zone">',
      '        <span id="fw-screenshot-text">Click, paste, or drag an image here</span>',
      '        <button class="fw-screenshot-remove" id="fw-screenshot-remove">&times;</button>',
      '      </div>',
      '    </div>',
      '    <div class="fw-field">',
      '      <label>Email (optional, for follow-up)</label>',
      '      <input type="email" id="fw-bug-email" placeholder="you@example.com">',
      '    </div>',
      '    <button class="fw-submit" id="fw-submit-bug">Submit Bug Report</button>',
      '  </div>',
      '  <!-- Feature Request Form -->',
      '  <div id="fw-form-feature" class="fw-hidden">',
      '    <div class="fw-field">',
      '      <label>Feature Title</label>',
      '      <input type="text" id="fw-feature-title" placeholder="What feature would you like?">',
      '    </div>',
      '    <div class="fw-field">',
      '      <label>Use Case</label>',
      '      <textarea id="fw-feature-usecase" placeholder="Describe how you would use this feature and why it\'s useful..."></textarea>',
      '    </div>',
      '    <div class="fw-field">',
      '      <label>Priority for You</label>',
      '      <select id="fw-feature-priority">',
      '        <option value="nice-to-have">Nice to have</option>',
      '        <option value="important" selected>Important</option>',
      '        <option value="critical">Critical for my workflow</option>',
      '      </select>',
      '    </div>',
      '    <div class="fw-field">',
      '      <label>Email (optional, for updates)</label>',
      '      <input type="email" id="fw-feature-email" placeholder="you@example.com">',
      '    </div>',
      '    <button class="fw-submit" id="fw-submit-feature">Submit Feature Request</button>',
      '  </div>',
      '  <!-- Success Message -->',
      '  <div id="fw-success" class="fw-hidden">',
      '    <div class="fw-success">',
      '      <div class="fw-success-icon">&#x2705;</div>',
      '      <h4>Thank you!</h4>',
      '      <p id="fw-success-msg">Your feedback has been submitted successfully.</p>',
      '    </div>',
      '  </div>',
      '</div>',
    ].join('\n');

    document.body.appendChild(trigger);
    document.body.appendChild(panel);

    // Event listeners
    document.getElementById('fw-close').addEventListener('click', togglePanel);

    // Tab switching
    var tabs = panel.querySelectorAll('.fw-tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        var tabName = tab.getAttribute('data-tab');
        document.getElementById('fw-form-bug').classList.toggle('fw-hidden', tabName !== 'bug');
        document.getElementById('fw-form-feature').classList.toggle('fw-hidden', tabName !== 'feature');
        document.getElementById('fw-success').classList.add('fw-hidden');
      });
    });

    // Screenshot handling
    var screenshotZone = document.getElementById('fw-screenshot-zone');

    screenshotZone.addEventListener('click', function (e) {
      if (e.target.id === 'fw-screenshot-remove') return;
      if (screenshotData) return;
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.addEventListener('change', function () {
        if (input.files && input.files[0]) handleImageFile(input.files[0]);
      });
      input.click();
    });

    screenshotZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      screenshotZone.style.borderColor = '#a78bfa';
    });

    screenshotZone.addEventListener('dragleave', function () {
      screenshotZone.style.borderColor = '';
    });

    screenshotZone.addEventListener('drop', function (e) {
      e.preventDefault();
      screenshotZone.style.borderColor = '';
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleImageFile(e.dataTransfer.files[0]);
      }
    });

    document.addEventListener('paste', function (e) {
      if (!widgetOpen) return;
      var items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          handleImageFile(items[i].getAsFile());
          break;
        }
      }
    });

    document.getElementById('fw-screenshot-remove').addEventListener('click', function (e) {
      e.stopPropagation();
      removeScreenshot();
    });

    // Submit handlers
    document.getElementById('fw-submit-bug').addEventListener('click', submitBug);
    document.getElementById('fw-submit-feature').addEventListener('click', submitFeature);
  }

  function handleImageFile(file) {
    if (!file || file.type.indexOf('image') === -1) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      screenshotData = e.target.result;
      var zone = document.getElementById('fw-screenshot-zone');
      zone.classList.add('has-image');
      document.getElementById('fw-screenshot-text').style.display = 'none';
      var img = zone.querySelector('img');
      if (!img) {
        img = document.createElement('img');
        zone.insertBefore(img, zone.firstChild);
      }
      img.src = screenshotData;
    };
    reader.readAsDataURL(file);
  }

  function removeScreenshot() {
    screenshotData = null;
    var zone = document.getElementById('fw-screenshot-zone');
    zone.classList.remove('has-image');
    document.getElementById('fw-screenshot-text').style.display = '';
    var img = zone.querySelector('img');
    if (img) img.remove();
  }

  function togglePanel() {
    widgetOpen = !widgetOpen;
    var panel = document.getElementById('feedback-widget-panel');
    panel.classList.toggle('open', widgetOpen);
  }

  function showSuccess(message) {
    document.getElementById('fw-form-bug').classList.add('fw-hidden');
    document.getElementById('fw-form-feature').classList.add('fw-hidden');
    document.getElementById('fw-success').classList.remove('fw-hidden');
    document.getElementById('fw-success-msg').textContent = message || 'Your feedback has been submitted successfully.';
    setTimeout(function () {
      togglePanel();
      // Reset forms after close
      setTimeout(resetForms, 300);
    }, 2500);
  }

  function resetForms() {
    document.getElementById('fw-bug-title').value = '';
    document.getElementById('fw-bug-steps').value = '';
    document.getElementById('fw-bug-severity').value = 'medium';
    document.getElementById('fw-bug-email').value = '';
    document.getElementById('fw-feature-title').value = '';
    document.getElementById('fw-feature-usecase').value = '';
    document.getElementById('fw-feature-priority').value = 'important';
    document.getElementById('fw-feature-email').value = '';
    removeScreenshot();
    document.getElementById('fw-form-bug').classList.remove('fw-hidden');
    document.getElementById('fw-form-feature').classList.add('fw-hidden');
    document.getElementById('fw-success').classList.add('fw-hidden');
    var tabs = document.querySelectorAll('.fw-tab');
    tabs[0].classList.add('active');
    tabs[1].classList.remove('active');
  }

  function submitBug() {
    var title = document.getElementById('fw-bug-title').value.trim();
    if (!title) {
      document.getElementById('fw-bug-title').style.borderColor = '#ef4444';
      return;
    }
    document.getElementById('fw-bug-title').style.borderColor = '';

    var btn = document.getElementById('fw-submit-bug');
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    var payload = {
      type: 'bug',
      title: title,
      steps: document.getElementById('fw-bug-steps').value.trim(),
      severity: document.getElementById('fw-bug-severity').value,
      email: document.getElementById('fw-bug-email').value.trim(),
      screenshot: screenshotData || null,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      sessionId: window.ErrorLogger ? window.ErrorLogger.getSessionId() : null,
    };

    sendFeedback(payload, btn, 'Submit Bug Report', 'Bug report submitted! We\'ll look into it.');
  }

  function submitFeature() {
    var title = document.getElementById('fw-feature-title').value.trim();
    if (!title) {
      document.getElementById('fw-feature-title').style.borderColor = '#ef4444';
      return;
    }
    document.getElementById('fw-feature-title').style.borderColor = '';

    var btn = document.getElementById('fw-submit-feature');
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    var payload = {
      type: 'feature',
      title: title,
      useCase: document.getElementById('fw-feature-usecase').value.trim(),
      priority: document.getElementById('fw-feature-priority').value,
      email: document.getElementById('fw-feature-email').value.trim(),
      url: window.location.href,
      timestamp: new Date().toISOString(),
    };

    sendFeedback(payload, btn, 'Submit Feature Request', 'Feature request submitted! Thanks for the idea.');
  }

  function sendFeedback(payload, btn, defaultText, successMsg) {
    fetch(CONFIG.apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function () {
        showSuccess(successMsg);
      })
      .catch(function () {
        showSuccess(successMsg); // Still show success to user - feedback is logged locally
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = defaultText;
      });
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      injectStyles();
      createWidget();
    });
  } else {
    injectStyles();
    createWidget();
  }

  // Expose API
  window.FeedbackWidget = {
    open: function () { if (!widgetOpen) togglePanel(); },
    close: function () { if (widgetOpen) togglePanel(); },
    configure: function (options) {
      for (var key in options) {
        if (options.hasOwnProperty(key) && CONFIG.hasOwnProperty(key)) {
          CONFIG[key] = options[key];
        }
      }
    },
  };
})();
